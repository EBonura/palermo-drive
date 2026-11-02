// Tick timing (p50, p99, max), allocations per tick and bytes per player-minute. Built only with `--features metrics`;
// without it every function here is empty and inlined away, so a normal build pays nothing.

#[cfg(not(feature = "metrics"))]
mod imp {
    pub type Token = ();
    #[inline(always)]
    pub fn tick_begin() -> Token {}
    #[inline(always)]
    pub fn tick_end(_: Token, _players: usize) {}
    #[inline(always)]
    pub fn frame_out(_bytes: usize) {}
    pub fn report(_final: bool) {}
}

#[cfg(feature = "metrics")]
mod imp {
    use std::alloc::{GlobalAlloc, Layout, System};
    use std::sync::atomic::{AtomicU64, Ordering::Relaxed};
    use std::sync::Mutex;
    use std::time::Instant;

    struct Counting;
    static ALLOCS: AtomicU64 = AtomicU64::new(0);
    static ALLOC_BYTES: AtomicU64 = AtomicU64::new(0);

    unsafe impl GlobalAlloc for Counting {
        unsafe fn alloc(&self, l: Layout) -> *mut u8 {
            ALLOCS.fetch_add(1, Relaxed);
            ALLOC_BYTES.fetch_add(l.size() as u64, Relaxed);
            System.alloc(l)
        }
        unsafe fn dealloc(&self, p: *mut u8, l: Layout) {
            System.dealloc(p, l)
        }
        unsafe fn alloc_zeroed(&self, l: Layout) -> *mut u8 {
            ALLOCS.fetch_add(1, Relaxed);
            ALLOC_BYTES.fetch_add(l.size() as u64, Relaxed);
            System.alloc_zeroed(l)
        }
        unsafe fn realloc(&self, p: *mut u8, l: Layout, n: usize) -> *mut u8 {
            ALLOCS.fetch_add(1, Relaxed);
            ALLOC_BYTES.fetch_add(n as u64, Relaxed);
            System.realloc(p, l, n)
        }
    }

    #[global_allocator]
    static A: Counting = Counting;

    pub struct Token(Instant, u64);
    static BYTES_OUT: AtomicU64 = AtomicU64::new(0);
    static FRAMES_OUT: AtomicU64 = AtomicU64::new(0);
    static PLAYER_NS: AtomicU64 = AtomicU64::new(0); // players x time, summed over ticks

    struct State {
        samples: Vec<(u32, u32)>, // (microseconds, allocations) of every tick
        mark: usize,              // start of the current report window
        last_tick: Option<Instant>,
        win_bytes: u64,
        win_frames: u64,
        win_player_ns: u64,
        win_start: Instant,
        win_allocs: u64,
        total_start: Instant,
    }
    static S: Mutex<Option<State>> = Mutex::new(None);

    fn with<R>(f: impl FnOnce(&mut State) -> R) -> R {
        let mut g = S.lock().unwrap();
        let s = g.get_or_insert_with(|| State {
            samples: Vec::new(),
            mark: 0,
            last_tick: None,
            win_bytes: 0,
            win_frames: 0,
            win_player_ns: 0,
            win_start: Instant::now(),
            win_allocs: 0,
            total_start: Instant::now(),
        });
        f(s)
    }

    pub fn tick_begin() -> Token {
        Token(Instant::now(), ALLOCS.load(Relaxed))
    }

    pub fn tick_end(t: Token, players: usize) {
        let us = t.0.elapsed().as_micros().min(u32::MAX as u128) as u32;
        let allocs = (ALLOCS.load(Relaxed) - t.1).min(u32::MAX as u64) as u32;
        let now = Instant::now();
        with(|s| {
            if s.samples.len() < 4_000_000 {
                s.samples.push((us, allocs));
            }
            if let Some(l) = s.last_tick {
                PLAYER_NS.fetch_add(players as u64 * now.duration_since(l).as_nanos() as u64, Relaxed);
            }
            s.last_tick = Some(now);
        });
    }

    pub fn frame_out(bytes: usize) {
        BYTES_OUT.fetch_add(bytes as u64, Relaxed);
        FRAMES_OUT.fetch_add(1, Relaxed);
    }

    fn pct(v: &mut [u32], p: f64) -> u32 {
        if v.is_empty() {
            return 0;
        }
        v.sort_unstable();
        v[(((v.len() - 1) as f64) * p).round() as usize]
    }

    /// Prints the window since the last report (and the whole run when final is true) on stderr.
    pub fn report(fin: bool) {
        let (bytes, frames, pns, allocs_now) = (BYTES_OUT.load(Relaxed), FRAMES_OUT.load(Relaxed), PLAYER_NS.load(Relaxed), ALLOCS.load(Relaxed));
        let (line, total) = with(|s| {
            let now = Instant::now();
            let win = &s.samples[s.mark..];
            let mut us: Vec<u32> = win.iter().map(|x| x.0).collect();
            let al: f64 = if win.is_empty() { 0.0 } else { win.iter().map(|x| x.1 as f64).sum::<f64>() / win.len() as f64 };
            let secs = now.duration_since(s.win_start).as_secs_f64();
            let (db, df, dp) = (bytes - s.win_bytes, frames - s.win_frames, pns - s.win_player_ns);
            let pm = dp as f64 / 1e9 / 60.0;
            let line = format!(
                "metrics window {:.0}s: ticks={} tick us p50={} p99={} max={} | allocs/tick={:.1} | allocs/s total={:.0} | out {:.1} kB/s, {:.0} frames/s, {:.0} B/player-min ({:.1} players avg)",
                secs, win.len(), pct(&mut us, 0.5), pct(&mut us, 0.99), us.last().copied().unwrap_or(0), al,
                (allocs_now - s.win_allocs) as f64 / secs, db as f64 / secs / 1000.0, df as f64 / secs,
                if pm > 0.0 { db as f64 / pm } else { 0.0 }, dp as f64 / 1e9 / secs
            );
            s.mark = s.samples.len();
            s.win_bytes = bytes;
            s.win_frames = frames;
            s.win_player_ns = pns;
            s.win_start = now;
            s.win_allocs = allocs_now;
            let total = if fin {
                let mut all: Vec<u32> = s.samples.iter().map(|x| x.0).collect();
                let al: f64 = s.samples.iter().map(|x| x.1 as f64).sum::<f64>() / s.samples.len().max(1) as f64;
                let pm = pns as f64 / 1e9 / 60.0;
                Some(format!(
                    "metrics total {:.0}s: ticks={} tick us p50={} p99={} max={} | allocs/tick={:.1} | {:.0} B/player-min over {:.1} player-minutes, {} frames, {} alloc bytes",
                    now.duration_since(s.total_start).as_secs_f64(), all.len(), pct(&mut all, 0.5), pct(&mut all, 0.99), all.last().copied().unwrap_or(0), al,
                    if pm > 0.0 { bytes as f64 / pm } else { 0.0 }, pm, frames, ALLOC_BYTES.load(Relaxed)
                ))
            } else {
                None
            };
            (line, total)
        });
        eprintln!("{line}");
        if let Some(t) = total {
            eprintln!("{t}");
        }
    }
}

pub use imp::*;
