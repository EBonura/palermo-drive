// One report from the game, checked field by field. Anything unexpected (an unknown field, a wrong type, a value out of range, a name that is too long) refuses the whole report:
// nothing is repaired except the name, which is cleaned. The result is a fixed list of columns and typed values; the SQL text never contains a value (see bq.rs).
use serde::Deserialize;
use std::collections::BTreeMap;

pub const MAX_BODY: usize = 2048;

pub enum Val {
    S(Option<String>),
    I(Option<i64>),
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Raw {
    v: u8,
    t: String,
    vid: String,
    n: Option<String>,
    d: String,
    l: String,
    g: String,
    s: u32,
    pl: Option<u32>,
    ps: Option<u32>,
    fps: Option<u32>,
    p1: Option<u32>,
    lv: Option<u32>,
    mo: Option<u32>,
    sh: Option<u32>,
    rs: Option<u32>,
    mem: Option<u32>,
    gpu: Option<String>,
    gfx: Option<String>,
    iab: Option<u32>,
    hid: Option<u32>,
    veh: Option<String>,
    dist: Option<u32>,
    cash: Option<u32>,
    bust: Option<u32>,
    m: Option<BTreeMap<String, [u32; 3]>>,
    // the device, once a visit, in the join report (worked out on the page: the user agent itself is never sent)
    gm: Option<String>,
    dm: Option<String>,
    os: Option<String>,
    ov: Option<String>,
    br: Option<String>,
    bv: Option<u32>,
    scw: Option<u32>,
    sch: Option<u32>,
    dpr: Option<u32>,
    cw: Option<u32>,
    ch: Option<u32>,
    co: Option<u32>,
    ram: Option<u32>,
    gl: Option<u32>,
    mts: Option<u32>,
}

fn within(v: Option<u32>, lo: u32, hi: u32) -> Option<Option<i64>> {
    match v {
        None => Some(None),
        Some(x) if x >= lo && x <= hi => Some(Some(x as i64)),
        _ => None,
    }
}

fn one_of(v: &str, list: &[&'static str]) -> Option<&'static str> {
    list.iter().copied().find(|x| *x == v)
}

// ids from the game: lower case letters, digits and _ . : -
fn ident(s: &str, max: usize) -> bool {
    !s.is_empty() && s.len() <= max && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"_.:-".contains(&b))
}

// a short label the page has already cleaned (a GPU's or a phone's model name): letters, digits, spaces and ( ) . _ , / + : - only
fn label(v: &Option<String>, max: usize) -> Option<Option<String>> {
    match v {
        None => Some(None),
        Some(s) if !s.is_empty() && s.len() <= max && s.trim() == s && s.bytes().all(|b| b.is_ascii_alphanumeric() || b" ()._,/+:-".contains(&b)) => Some(Some(s.clone())),
        _ => None,
    }
}

// an operating system's version: digits and dots
fn dotted(v: &Option<String>, max: usize) -> Option<Option<String>> {
    match v {
        None => Some(None),
        Some(s) if !s.is_empty() && s.len() <= max && s.bytes().all(|b| b.is_ascii_digit() || b == b'.') && s.as_bytes()[0] != b'.' => Some(Some(s.clone())),
        _ => None,
    }
}

fn version_ok(s: &str) -> bool {
    let p: Vec<&str> = s.split('.').collect();
    let num = |x: &str, n: usize| !x.is_empty() && x.len() <= n && x.bytes().all(|b| b.is_ascii_digit());
    p.len() == 3 && num(p[0], 3) && num(p[1], 3) && (num(p[2], 7) || p[2] == "dev")
}

fn invisible(c: char) -> bool {
    c.is_control() || matches!(c, '\u{ad}' | '\u{200b}'..='\u{200f}' | '\u{2028}'..='\u{202e}' | '\u{2060}'..='\u{2069}' | '\u{feff}')
}

// plain text, at most 16 characters: invisible and control characters go, runs of spaces become one, the ends are trimmed. Too long or too many bytes: refused.
fn clean_name(raw: &str) -> Option<Option<String>> {
    if raw.len() > 128 {
        return None;
    }
    let mut out = String::new();
    let mut gap = false;
    for c in raw.chars().filter(|c| !invisible(*c) || c.is_whitespace()) {
        if c.is_whitespace() {
            gap = !out.is_empty();
        } else {
            if gap {
                out.push(' ');
                gap = false;
            }
            out.push(c);
        }
    }
    let n = out.chars().count();
    if n > 16 {
        return None;
    }
    Some(if n == 0 { None } else { Some(out) })
}

pub fn parse(body: &[u8]) -> Option<Vec<(&'static str, Val)>> {
    let r: Raw = serde_json::from_slice(body).ok()?;
    if r.v != 1 {
        return None;
    }
    let event = one_of(&r.t, &["join", "alive", "leave", "ctxlost", "ctxrestored"])?;
    if r.vid.len() != 16 || !r.vid.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) {
        return None;
    }
    let name = match &r.n {
        None => None,
        Some(n) => clean_name(n)?,
    };
    let device = one_of(&r.d, &["phone", "desktop"])?;
    let lang = one_of(&r.l, &["it", "en"])?;
    if !version_ok(&r.g) {
        return None;
    }
    if r.s > 172_800 {
        return None;
    }
    let gpu = match &r.gpu {
        None => None,
        Some(g) => Some(one_of(g, &["apple", "nvidia", "amd", "intel", "adreno", "mali", "other"])?.to_string()),
    };
    let gfx = match &r.gfx {
        None => None,
        Some(g) => Some(one_of(g, &["auto", "low", "medium", "high"])?.to_string()),
    };
    let veh = match &r.veh {
        None => None,
        Some(v) if ident(v, 24) => Some(v.clone()),
        _ => return None,
    };
    let os = match &r.os {
        None => None,
        Some(v) => Some(one_of(v, &["android", "ios", "windows", "macos", "linux", "chromeos", "other"])?.to_string()),
    };
    let browser = match &r.br {
        None => None,
        Some(v) => Some(one_of(v, &["chrome", "safari", "firefox", "edge", "samsung", "opera", "duckduckgo", "other"])?.to_string()),
    };
    let mo = within(r.mo, 30, 60)?;
    if matches!(mo, Some(x) if x != 30 && x != 60) {
        return None;
    }
    let sh = within(r.sh, 0, 4096)?;
    if matches!(sh, Some(x) if ![0, 256, 512, 1024, 2048, 4096].contains(&x)) {
        return None;
    }
    // missions: "id=started.done.failed;..." (at most 8 ids, each count 0 to 50)
    let missions = match &r.m {
        None => None,
        Some(m) if m.is_empty() => None,
        Some(m) if m.len() <= 8 => {
            let mut parts = Vec::new();
            for (id, c) in m {
                if !ident(id, 40) || c.iter().any(|x| *x > 50) {
                    return None;
                }
                parts.push(format!("{}={}.{}.{}", id, c[0], c[1], c[2]));
            }
            Some(parts.join(";"))
        }
        _ => return None,
    };
    Some(vec![
        ("event", Val::S(Some(event.to_string()))),
        ("visit", Val::S(Some(r.vid.clone()))),
        ("name", Val::S(name)),
        ("device", Val::S(Some(device.to_string()))),
        ("lang", Val::S(Some(lang.to_string()))),
        ("version", Val::S(Some(r.g.clone()))),
        ("secs", Val::I(Some(r.s as i64))),
        ("players", Val::I(within(r.pl, 0, 100)?)),
        ("play_s", Val::I(within(r.ps, 0, 7200)?)),
        ("fps", Val::I(within(r.fps, 0, 1000)?)),
        ("fps_slow_ms", Val::I(within(r.p1, 0, 5000)?)),
        ("auto_lvl", Val::I(within(r.lv, 0, 10)?)),
        ("fps_mode", Val::I(mo)),
        ("shadow", Val::I(sh)),
        ("res_pct", Val::I(within(r.rs, 10, 400)?)),
        ("mem_mb", Val::I(within(r.mem, 0, 65_535)?)),
        ("gpu", Val::S(gpu)),
        ("gfx", Val::S(gfx)),
        ("iab", Val::I(within(r.iab, 0, 1)?)),
        ("hidden", Val::I(within(r.hid, 0, 1)?)),
        ("vehicle", Val::S(veh)),
        ("dist_m", Val::I(within(r.dist, 0, 500_000)?)),
        ("cash", Val::I(within(r.cash, 0, 1_000_000)?)),
        ("busts", Val::I(within(r.bust, 0, 1000)?)),
        ("missions", Val::S(missions)),
        ("gpu_model", Val::S(label(&r.gm, 80)?)),
        ("model", Val::S(label(&r.dm, 40)?)),
        ("os", Val::S(os)),
        ("os_ver", Val::S(dotted(&r.ov, 16)?)),
        ("browser", Val::S(browser)),
        ("browser_ver", Val::I(within(r.bv, 1, 999)?)),
        ("screen_w", Val::I(within(r.scw, 100, 10_000)?)),
        ("screen_h", Val::I(within(r.sch, 100, 10_000)?)),
        ("dpr_pct", Val::I(within(r.dpr, 50, 800)?)),
        ("canvas_w", Val::I(within(r.cw, 1, 16_384)?)),
        ("canvas_h", Val::I(within(r.ch, 1, 16_384)?)),
        ("cores", Val::I(within(r.co, 1, 512)?)),
        ("ram_mb", Val::I(within(r.ram, 128, 65_536)?)),
        ("webgl", Val::I(within(r.gl, 1, 2)?)),
        ("max_tex", Val::I(within(r.mts, 256, 65_536)?)),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    const OK: &str = r#"{"v":1,"t":"alive","vid":"0123456789abcdef","n":"Anna","d":"phone","l":"it","g":"0.4.12","s":600,"pl":2,"ps":170,"fps":58,"p1":31,"lv":2,"mo":60,"sh":1024,"rs":100,"mem":210,"gpu":"apple","gfx":"high","iab":0,"hid":1,"veh":"calessino","dist":3200,"cash":12,"bust":1,"m":{"fare:taxi":[1,1,0]}}"#;

    fn name_of(rows: &[(&str, Val)]) -> Option<String> {
        match rows.iter().find(|(k, _)| *k == "name").unwrap() {
            (_, Val::S(s)) => s.clone(),
            _ => None,
        }
    }

    #[test]
    fn accepts_a_full_report() {
        let r = parse(OK.as_bytes()).expect("valid");
        assert_eq!(r.len(), 40);
        assert_eq!(name_of(&r).as_deref(), Some("Anna"));
    }

    #[test]
    fn accepts_the_context_events_and_nothing_extra() {
        let ok = |t: &str| parse(format!(r#"{{"v":1,"t":"{t}","vid":"0123456789abcdef","d":"phone","l":"it","g":"0.4.12","s":90,"gfx":"high","sh":2048,"rs":200,"mem":210,"gpu":"apple","iab":1}}"#).as_bytes());
        assert!(ok("ctxlost").is_some());
        assert!(ok("ctxrestored").is_some());
        assert!(ok("ctxgone").is_none());
        assert!(parse(br#"{"v":1,"t":"ctxlost","vid":"0123456789abcdef","d":"phone","l":"it","g":"0.4.12","s":90,"ua":"Mozilla/5.0"}"#).is_none()); // a user agent is never accepted
    }

    #[test]
    fn accepts_a_nameless_minimal_report() {
        let r = parse(br#"{"v":1,"t":"join","vid":"0123456789abcdef","d":"desktop","l":"en","g":"0.4.dev","s":0}"#).expect("valid");
        assert_eq!(name_of(&r), None);
    }

    #[test]
    fn accepts_the_device_details_of_a_join() {
        const J: &str = r#"{"v":1,"t":"join","vid":"0123456789abcdef","d":"phone","l":"it","g":"0.4.12","s":5,"gm":"ANGLE (ARM, Mali-G72, OpenGL ES 3.2)","dm":"SM-A515F","os":"android","ov":"10","br":"chrome","bv":131,"scw":360,"sch":800,"dpr":300,"cw":1360,"ch":554,"co":8,"ram":4096,"gl":2,"mts":8192}"#;
        let r = parse(J.as_bytes()).expect("valid");
        let s = |k: &str| match r.iter().find(|(c, _)| *c == k).unwrap() {
            (_, Val::S(v)) => v.clone(),
            _ => None,
        };
        assert_eq!(s("gpu_model").as_deref(), Some("ANGLE (ARM, Mali-G72, OpenGL ES 3.2)"));
        assert_eq!(s("model").as_deref(), Some("SM-A515F"));
        assert_eq!(s("os_ver").as_deref(), Some("10"));
        let bad = |from: &str, to: &str| assert!(parse(J.replace(from, to).as_bytes()).is_none(), "{to}");
        bad("SM-A515F", "SM-A515F<script>");
        bad("SM-A515F", " SM-A515F");
        bad("SM-A515F", &"x".repeat(41));
        bad("Mali-G72", "Mali-G72\\u0000");
        bad("\"android\"", "\"symbian\"");
        bad("\"ov\":\"10\"", "\"ov\":\"10; rv\"");
        bad("\"chrome\"", "\"netscape\"");
        bad("\"bv\":131", "\"bv\":0");
        bad("\"dpr\":300", "\"dpr\":5000");
        bad("\"gl\":2", "\"gl\":3");
    }

    #[test]
    fn refuses_bad_shapes() {
        let bad = |s: &str| assert!(parse(s.as_bytes()).is_none(), "{s}");
        bad("");
        bad("[]");
        bad("null");
        bad(&OK.replace("\"v\":1", "\"v\":2"));
        bad(&OK.replace("alive", "hello"));
        bad(&OK.replace("0123456789abcdef", "0123456789ABCDEF"));
        bad(&OK.replace("0123456789abcdef", "0123"));
        bad(&OK.replace("\"it\"", "\"fr\""));
        bad(&OK.replace("phone", "tv"));
        bad(&OK.replace("0.4.12", "0.4.12 "));
        bad(&OK.replace("\"s\":600", "\"s\":999999999"));
        bad(&OK.replace("\"s\":600", "\"s\":-1"));
        bad(&OK.replace("\"s\":600", "\"s\":1.5"));
        bad(&OK.replace("\"s\":600", "\"s\":\"600\""));
        bad(&OK.replace("\"mo\":60", "\"mo\":45"));
        bad(&OK.replace("\"sh\":1024", "\"sh\":1000"));
        bad(&OK.replace("apple", "Apple M2 Pro"));
        bad(&OK.replace("calessino", "Calessino!"));
        bad(&OK.replace("\"gfx\":\"high\"", "\"gfx\":\"ultra\""));
        bad(&OK.replace("\"iab\":0", "\"iab\":2"));
        bad(&OK.replace("\"hid\":1", "\"hid\":2"));
        bad(&OK.replace("\"bust\":1", "\"bust\":1,\"ip\":\"1.2.3.4\""));
        bad(&OK.replace("[1,1,0]", "[1,1]"));
        bad(&OK.replace("[1,1,0]", "[1,1,99]"));
        bad(&OK.replace("fare:taxi", "FARE TAXI"));
    }

    #[test]
    fn name_is_cleaned_or_refused() {
        let with = |n: &str| parse(OK.replace("Anna", n).as_bytes()).map(|r| name_of(&r));
        assert_eq!(with("  Anna   Maria "), Some(Some("Anna Maria".into())));
        assert_eq!(with("An\\u200bna"), Some(Some("Anna".into())));
        assert_eq!(with("An\\u0000na"), Some(Some("Anna".into())));
        assert_eq!(with("   "), Some(None));
        assert_eq!(with("0123456789abcdef"), Some(Some("0123456789abcdef".into())));
        assert_eq!(with("0123456789abcdefg"), None);
        assert_eq!(with(&"x".repeat(500)), None);
        // text that looks like SQL or HTML is only text: it is never part of the statement
        assert_eq!(with("'; DROP TABLE t;--"), None); // 18 characters: too long, refused
        assert_eq!(with("'); DELETE--"), Some(Some("'); DELETE--".into())));
        assert_eq!(with("<script>x</script>"), None);
        assert_eq!(with("<b>hi</b>"), Some(Some("<b>hi</b>".into())));
    }
}
