//! CPU the relay's hub spends on one incoming state, as a function of how many receivers hold the sender (`W`), natively and as WebAssembly.
//!   bench [--reps 15] [--events 4000]             native, JSON lines
//!   wasm32-wasip1 build run under node (tools/online/hubbench-wasm.mjs): the same code in V8's WebAssembly, the engine Workers use.
//! Method: `W + 1` players in a 60 m square, the hub's K set to W so that every one holds every other; one sender sends a state every 100 ms
//! (10 a second: one event in ten recomputes the sender's set, one a second is the rule) and the time for `on_binary` is taken over a batch of events,
//! `reps` times. B: the sender sends every 1.1 s, so every event recomputes the set. The hub only builds the frames to send; the Worker glue's cost per
//! `send_with_bytes` is not in these numbers (see the docs for how it was estimated from workerd).
use hubbench::hub::Hub;
use hubbench::sim::*;
use std::time::Instant;

fn setup(w: usize, extra_far: usize) -> (Hub, Vec<u16>, Vec<St>) {
    let mut hub = Hub::new(1);
    hub.k = w.max(1);
    let mut rng = Rng(42);
    let n = w + 1 + extra_far;
    let mut hs = vec![];
    let mut sts = vec![];
    for i in 0..n {
        let h = hub.accept(&format!("10.1.{}.{}", i / 250, i % 250), 0).unwrap().0;
        hub.on_binary(h, &[1, 2, 0, 0, 3, b'a', b'b', b'c'], 0);
        hs.push(h);
        // the first w + 1 near each other; extra players far away (their positions are known but they are nobody's neighbours)
        let (x, z) = if i <= w { (rng.range(0.0, 60.0), rng.range(0.0, 60.0)) } else { (rng.range(3000.0, 9000.0), rng.range(3000.0, 9000.0)) };
        sts.push(St { x, z, v: 5.0, th: 1.0, ..Default::default() });
    }
    // three rounds a little over a second apart: every set is complete after that
    for round in 0..3u64 {
        for i in 0..n {
            hub.on_binary(hs[i], &state_frame(&sts[i], round * 1100), round * 1100);
        }
    }
    (hub, hs, sts)
}

fn time_events(w: usize, extra_far: usize, gap_ms: u64, events: usize) -> (f64, u64) {
    let (mut hub, hs, mut sts) = setup(w, extra_far);
    let mut t = 4000u64;
    let mut sink = 0u64;
    let t0 = Instant::now();
    for i in 0..events {
        t += gap_ms;
        sts[0].x += 0.1 * (i % 7) as f64 - 0.3;
        let f = state_frame(&sts[0], t);
        let acts = hub.on_binary(hs[0], &f, t);
        sink += acts.len() as u64;
    }
    let ns = t0.elapsed().as_nanos() as f64 / events as f64;
    (ns, sink / events as u64)
}

fn stats(mut v: Vec<f64>) -> (f64, f64, f64) {
    v.sort_by(|a, b| a.total_cmp(b));
    (v[0], v[v.len() / 2], v[v.len() - 1])
}

/// Amplification of one state in a crowd of v3 players (`--indegree`): how many receivers hold the most held player, with every set full, and what the worst disconnect costs.
fn indegree() {
    for (k, n, side) in [(8usize, 300usize, 100.0), (32, 300, 100.0), (64, 300, 100.0), (32, 300, 400.0), (64, 300, 400.0)] {
        let mut hub = Hub::new(1);
        let mut rng = Rng(7);
        let (mut hs, mut sts) = (vec![], vec![]);
        for i in 0..n {
            let h = hub.accept(&format!("10.2.{}.{}", i / 250, i % 250), 0).unwrap().0;
            let hello = if k == 8 { vec![1u8, 2, 0, 0, 3, b'a', b'b', b'c'] } else { vec![1u8, 3, k as u8, 0, 0, 3, b'a', b'b', b'c'] };
            hub.on_binary(h, &hello, 0);
            hs.push(h);
            sts.push(St { x: rng.range(0.0, side), z: rng.range(0.0, side), v: 5.0, th: 1.0, ..Default::default() });
        }
        for round in 0..4u64 {
            for i in 0..n {
                hub.on_binary(hs[i], &state_frame(&sts[i], round * 1100), round * 1100);
            }
        }
        let mut deg = vec![0usize; n];
        for h in &hs {
            for m in &hub.conn(*h).unwrap().set {
                deg[hs.iter().position(|x| x == m).unwrap()] += 1;
            }
        }
        let (mx, mi) = deg.iter().enumerate().map(|(i, d)| (*d, i)).max().unwrap();
        let t0 = Instant::now();
        let acts = hub.on_close(hs[mi], 10_000);
        let ns = t0.elapsed().as_nanos();
        println!("{{\"k\":{k},\"players\":{n},\"square_m\":{side},\"mean_holders\":{:.1},\"max_holders\":{mx},\"worst_disconnect_us\":{},\"worst_disconnect_actions\":{}}}", deg.iter().sum::<usize>() as f64 / n as f64, ns / 1000, acts.len());
    }
}

/// `--roundrobin`: W + 1 players in a 60 m square all sending in turn, an event every 5 ms (so the relay is busy and a v3 receiver is batched), protocol 2 or 3: the hub's CPU and the frames it sends for each event.
fn roundrobin() {
    for w in [8usize, 16, 32, 63] {
        for v3 in [false, true] {
            let mut best = (f64::MAX, 0.0);
            for _ in 0..7 {
                let mut hub = Hub::new(1);
                hub.k = w.max(1);
                let mut rng = Rng(5);
                let (mut hs, mut sts) = (vec![], vec![]);
                for i in 0..=w {
                    let h = hub.accept(&format!("10.3.{}.{}", i / 250, i % 250), 0).unwrap().0;
                    let hello = if v3 { vec![1u8, 3, (w as u8).min(64), 0, 0, 3, b'a', b'b', b'c'] } else { vec![1u8, 2, 0, 0, 3, b'a', b'b', b'c'] };
                    hub.on_binary(h, &hello, 0);
                    hs.push(h);
                    sts.push(St { x: rng.range(0.0, 60.0), z: rng.range(0.0, 60.0), v: 5.0, th: 1.0, ..Default::default() });
                }
                for round in 0..3u64 {
                    for i in 0..=w {
                        hub.on_binary(hs[i], &state_frame(&sts[i], round * 1100), round * 1100);
                    }
                }
                let n = 6000usize;
                let (mut t, mut frames) = (4000u64, 0usize);
                let t0 = Instant::now();
                for e in 0..n {
                    t += 5;
                    let i = e % (w + 1);
                    sts[i].x += 0.01;
                    let acts = hub.on_binary(hs[i], &state_frame(&sts[i], t), t);
                    frames += acts.iter().filter(|a| matches!(a, hubbench::hub::Action::Send(..))).count();
                }
                let ns = t0.elapsed().as_nanos() as f64 / n as f64;
                if ns < best.0 {
                    best = (ns, frames as f64 / n as f64);
                }
            }
            println!("{{\"w\":{w},\"protocol\":{},\"hub_ns_per_event\":{:.0},\"frames_sent_per_event\":{:.2}}}", if v3 { 3 } else { 2 }, best.0, best.1);
        }
    }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.iter().any(|x| x == "--roundrobin") {
        return roundrobin();
    }
    if a.iter().any(|x| x == "--indegree") {
        return indegree();
    }
    let get = |k: &str, d: usize| a.iter().position(|x| *x == format!("--{k}")).map(|i| a[i + 1].parse().unwrap()).unwrap_or(d);
    let reps = get("reps", 15);
    let events = get("events", 4000);
    let far = get("far", 0);
    for w in [0usize, 1, 2, 4, 8, 16, 32, 64, 128, 256] {
        if w + 1 + far > 5000 {
            continue;
        }
        let ev_b = (events / 8).max(300);
        let mut ra = vec![];
        let mut rb = vec![];
        let mut sent = 0;
        for _ in 0..reps {
            let (n, s) = time_events(w, far, 100, events);
            ra.push(n);
            sent = s;
            rb.push(time_events(w, far, 1100, ev_b).0);
        }
        let (amin, amed, amax) = stats(ra);
        let (bmin, bmed, bmax) = stats(rb);
        println!("{{\"w\":{w},\"far\":{far},\"sent_per_event\":{sent},\"a_ns\":[{amin:.0},{amed:.0},{amax:.0}],\"b_ns\":[{bmin:.0},{bmed:.0},{bmax:.0}]}}");
    }
}
