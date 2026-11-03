// BigQuery over its REST API, as the service's own account. There is no key: on Cloud Run the access token comes from the metadata server and lives in memory for under an hour.
// Rows go in with a DML INSERT whose values are query parameters (the statement text is fixed, no value is ever spliced into it). That path is free for this volume:
// the first 1 TiB of query processing a month costs nothing, and every query here is capped at 20 MB billed (maximumBytesBilled), so a statement that scanned more would fail instead of costing.
// Legacy streaming inserts and the Storage Write API over REST are paid, so they are not used.
use crate::report::Val;
use serde_json::{json, Value};
use std::time::{Duration, Instant};

const API: &str = "https://bigquery.googleapis.com/bigquery/v2/projects";
const TOKEN_URL: &str = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const MAX_BILLED: &str = "20971520";

pub struct Bq {
    http: reqwest::Client,
    project: String,
    table: String,
    location: String,
    token: tokio::sync::Mutex<Option<(String, Instant)>>,
    dev_sink: Option<String>,
}

impl Bq {
    pub fn new(project: String, dataset: String, table: String, location: String, dev_sink: Option<String>) -> Bq {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(10)).build().expect("http client");
        Bq { http, table: format!("{project}.{dataset}.{table}"), project, location, token: tokio::sync::Mutex::new(None), dev_sink }
    }

    async fn token(&self) -> Option<String> {
        let mut t = self.token.lock().await;
        if let Some((tok, exp)) = t.as_ref() {
            if Instant::now() < *exp {
                return Some(tok.clone());
            }
        }
        let v: Value = self.http.get(TOKEN_URL).header("Metadata-Flavor", "Google").send().await.ok()?.error_for_status().ok()?.json().await.ok()?;
        let tok = v["access_token"].as_str()?.to_string();
        let life = v["expires_in"].as_u64().unwrap_or(300).saturating_sub(60);
        *t = Some((tok.clone(), Instant::now() + Duration::from_secs(life)));
        Some(tok)
    }

    async fn query(&self, sql: &str, params: Vec<Value>) -> Option<Value> {
        let tok = self.token().await?;
        let body = json!({ "query": sql, "useLegacySql": false, "parameterMode": "NAMED", "queryParameters": params, "location": self.location,
                           "timeoutMs": 8000, "maximumBytesBilled": MAX_BILLED });
        let res = self.http.post(format!("{API}/{}/queries", self.project)).bearer_auth(tok).json(&body).send().await.ok()?;
        if !res.status().is_success() {
            return None;
        }
        let v: Value = res.json().await.ok()?;
        if v["jobComplete"].as_bool() != Some(true) || v.get("errors").is_some() {
            return None;
        }
        Some(v)
    }

    pub async fn insert(&self, row: &[(&'static str, Val)]) -> bool {
        if let Some(path) = &self.dev_sink {
            return dev_append(path, row);
        }
        let cols: Vec<&str> = row.iter().map(|(k, _)| *k).collect();
        let sql = format!("INSERT INTO `{}` (ts, {}) VALUES (CURRENT_TIMESTAMP(), {})", self.table, cols.join(", "), cols.iter().map(|c| format!("@{c}")).collect::<Vec<_>>().join(", "));
        let params = row
            .iter()
            .map(|(k, v)| match v {
                Val::S(s) => json!({ "name": k, "parameterType": { "type": "STRING" }, "parameterValue": { "value": s } }),
                Val::I(i) => json!({ "name": k, "parameterType": { "type": "INT64" }, "parameterValue": { "value": i.map(|x| x.to_string()) } }),
            })
            .collect();
        match self.query(&sql, params).await {
            Some(v) => v["numDmlAffectedRows"].as_str() == Some("1"),
            None => false,
        }
    }

    // rows already written today (UTC), so that a restarted instance cannot start a fresh daily allowance
    pub async fn count_today(&self) -> Option<u64> {
        if let Some(path) = &self.dev_sink {
            return Some(std::fs::read_to_string(path).map(|s| s.lines().count() as u64).unwrap_or(0));
        }
        let sql = format!("SELECT COUNT(*) FROM `{}` WHERE ts >= TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), DAY)", self.table);
        let v = self.query(&sql, vec![]).await?;
        v["rows"][0]["f"][0]["v"].as_str()?.parse().ok()
    }
}

// local testing only (JOINLOG_DEV_SINK set): one JSON line per row instead of BigQuery
fn dev_append(path: &str, row: &[(&'static str, Val)]) -> bool {
    use std::io::Write;
    let mut o = serde_json::Map::new();
    for (k, v) in row {
        o.insert((*k).into(), match v {
            Val::S(s) => json!(s),
            Val::I(i) => json!(i),
        });
    }
    std::fs::OpenOptions::new().create(true).append(true).open(path).and_then(|mut f| writeln!(f, "{}", Value::Object(o))).is_ok()
}
