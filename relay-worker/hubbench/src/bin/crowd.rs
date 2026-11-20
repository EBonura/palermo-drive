//! `crowd --layout tight|street|city|mix --n 64 --k 8 [--drive 0.5] [--secs 60] [--warm 10] [--seed 1]`: one crowd against the hub, one JSON line out.
use hubbench::hub::Hub;
use hubbench::sim::*;
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let get = |k: &str, d: &str| a.iter().position(|x| *x == format!("--{k}")).map(|i| a[i + 1].clone()).unwrap_or(d.to_string());
    let layout = Layout::parse(&get("layout", "tight")).expect("layout: tight street city mix");
    let n: usize = get("n", "64").parse().unwrap();
    let mut hub = Hub::new(1);
    hub.k = get("k", "8").parse().unwrap();   // what a v2 player receives; `--k3` is what a v3 player gets (the relay's K_V3 unless said)
    hub.k3 = get("k3", "32").parse().unwrap();
    let ver: u8 = get("ver", "2").parse().unwrap();
    let opt0 = |k: &str| a.iter().position(|x| *x == format!("--{k}")).map(|i| a[i + 1].parse::<f64>().unwrap());
    if let Some(v) = opt0("radius") { hub.tune.radius = v as f32; }
    if let Some(v) = opt0("far-slots") { hub.tune.far_slots = v as usize; }
    if let Some(v) = opt0("batch-ms") { hub.tune.batch_ms = v as u64; }
    if let Some(v) = opt0("busy-gaps") { hub.tune.busy_gaps = v as usize; }
    if let Some(v) = opt0("batch-min") { hub.tune.batch_min_held = v as usize; }
    if let Some(v) = opt0("budget-above") { hub.tune.budget_above = v as usize; }
    if let Some(v) = opt0("budget-rate") { hub.tune.budget_rate = v as f32; }
    let opt = |k: &str| a.iter().position(|x| *x == format!("--{k}")).map(|i| a[i + 1].parse::<f64>().unwrap());
    let mut rule = if get("rule", "today") == "shipped" { Rule::shipped() } else { Rule::default() };
    if let Some(v) = opt("dr-pos") { rule.dr_pos = v; }
    if let Some(v) = opt("dr-th") { rule.dr_th = v; }
    if let Some(v) = opt("dr-v") { rule.dr_v = v; }
    if let Some(v) = opt("dr-roll") { rule.dr_roll = v; }
    if let Some(v) = opt("dist-scale") { rule.dist_scale = v; }
    if let Some(v) = opt("keep-parked") { rule.keep_parked = v; }
    if let Some(v) = opt("keep-moving") { rule.keep_moving = v; }
    if let Some(v) = opt("send-near") { rule.send_near = v; }
    if let Some(v) = opt("keep-moving-nobody") { rule.keep_moving_nobody = v; }
    if let Some(v) = opt("keep-parked-aud") { rule.keep_parked_aud = v; }
    if let Some(v) = opt("keep-parked-nobody") { rule.keep_parked_nobody = v; }
    if a.iter().any(|x| x == "--no-audience") { rule.use_audience = false; }
    let run_ = Run { ver, want_k: get("want-k", "0").parse().unwrap(), layout, n, drive: get("drive", "0.5").parse().unwrap(), seed: get("seed", "1").parse().unwrap(), secs: get("secs", "60").parse().unwrap(), warm: get("warm", "10").parse().unwrap(), rule, obs_n: get("obs", "24").parse().unwrap(), fps: get("fps", "60").parse().unwrap(), calm: get("loops", "calm") == "calm", why: Default::default() };
    unsafe {
        ROLL_NOISE = get("roll-noise", "0.06").parse().unwrap();
        ROLL_FROM_SERIES = get("roll", "series") == "series"; // the real recorded roll (default) or the noise model
    }
    let rep = run(&mut hub, &run_);
    eprintln!("send reasons (first, keepalive, position, heading, speed, roll): {:?}", &run_.why.borrow()[1..]);
    let pc = |v: &Vec<f32>, p: f64| { if v.is_empty() { 0.0 } else { let mut s = v.clone(); s.sort_by(|a, b| a.total_cmp(b)); s[((s.len() as f64 * p) as usize).min(s.len() - 1)] } };
    let errs: Vec<String> = rep.err.iter().map(|v| format!("[{},{:.3},{:.3},{:.3}]", v.len(), pc(v, 0.5), pc(v, 0.95), pc(v, 0.99))).collect();
    eprintln!("ERR_JSON {{\"err_by_dist\":{{\"lt50\":{},\"lt150\":{},\"lt400\":{},\"far\":{}}}}}", errs[0], errs[1], errs[2], errs[3]);
    let bw = &hub.stats.batch_wait;
    if !bw.is_empty() {
        let tot: u64 = bw.iter().sum();
        let q = |p: f64| { let mut acc = 0; for (i, c) in bw.iter().enumerate() { acc += c; if acc as f64 >= tot as f64 * p { return i; } } 1000 };
        eprintln!("BATCH_WAIT_MS p50 {} p95 {} p99 {} max {} (frames {} states {})", q(0.5), q(0.95), q(0.99), bw.iter().rposition(|c| *c > 0).unwrap_or(0), hub.stats.batches, hub.stats.batched_states);
    }
    println!("{}", rep.json(&format!("{} n={} k={} drive={} seed={}", get("layout", "tight"), n, hub.k, run_.drive, run_.seed)));
}
