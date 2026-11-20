//! Wire format and fixed limits of relay protocol v2 and v3, with no Worker types so it runs under plain `cargo test`.

use std::net::IpAddr;

pub const VERSION: u8 = 2;
/// Protocol v3: the same frames plus a wanted set size in HELLO, a longer WELCOME, radius sets, BATCH and AUDIENCE frames
/// (relay-worker/README.md). A v2 client gets exactly what it always got.
pub const VERSION_3: u8 = 3;
pub const MAX_FRAME: usize = 96;
pub const MAX_MALFORMED: u32 = 20;
/// Frames refused by the per connection rate before the socket is closed. The client paces itself under the rate, so
/// this is only ever reached by a script. Closing matters because a dropped frame still costs the day's request
/// allowance and CPU, and a closed socket sends no more.
pub const MAX_RATE_STRIKES: u32 = 100;
/// A quiet spell this long forgives the strikes.
pub const RATE_FORGIVE_MS: u64 = 10_000;
/// Entries of the per address table before it is emptied (see `Hub::address_allowed`).
pub const MAX_ADDRESSES: usize = 200_000;
pub const MAX_CONNS: usize = 300;
// Mobile carriers in Italy put many phones behind one address, so this cannot be a household-sized number.
pub const MAX_PER_IP: usize = 24;
pub const FRAMES_PER_IP_PER_DAY: u32 = 800_000;
pub const HELLO_DEADLINE_MS: u64 = 10_000;
pub const IDLE_MS: u64 = 60_000;
pub const ONLINE_EVERY_MS: u64 = 10_000;
pub const INFO_EVERY_MS: u64 = 2_000;

/// Frames per second and burst: all frames, SAY, TO.
pub const RATE_ALL: (f64, f64) = (12.0, 30.0);
pub const RATE_SAY: (f64, f64) = (1.0, 3.0);
pub const RATE_TO: (f64, f64) = (2.0, 6.0);

/// Players held at once by a v2 client: the game's old MAX_PLAYERS (a v2 page holds 16 and draws 8, and must never be sent more).
pub const K: usize = 8;
/// Players a v3 client holds unless it asks for another number in HELLO, and the most it can ask for. Everything that costs the relay
/// by the number of receivers (frames sent for a state, work for a recompute) is bounded by K_MAX, so this is the one place to change it.
pub const K_V3: usize = 32;
pub const K_MAX: usize = 64;
/// A v3 player's set is the players within this many metres (the game's DRAW_R: nothing a player does reaches farther, only the rings of the maps), the nearest K of them,
/// plus the nearest FAR_SLOTS beyond it so that the maps are not empty. A member stays until it is this much farther than the radius, so nobody flickers at the edge.
pub const SET_RADIUS_M: f32 = 400.0;
pub const SET_RADIUS_STAY: f32 = 1.15;
pub const FAR_SLOTS: usize = 2;
/// Least time between two states of a far slot player forwarded to one receiver.
pub const FAR_GAP_MS: u64 = 5_000;
/// A receiver holding more than this many players shares BUDGET_STATES_PER_S states a second among them by distance (weight 1 / (1 + d / 60 m)),
/// so that a crowd cannot cost it more than that however big K is. At 32 a tight crowd of drivers is about 210 a second, so this only acts above it.
pub const BUDGET_ABOVE: usize = 32;
pub const BUDGET_STATES_PER_S: f32 = 120.0;
/// Batching (v3 receivers holding at least BATCH_MIN_HELD players): the states due for one receiver wait up to BATCH_MS for the next event of anybody, which carries
/// them as one frame. At most BATCH_MAX in a frame. There is no timer: see `Hub::flush_due` for what bounds the wait.
pub const BATCH_MS: u64 = 40;
pub const BATCH_MIN_HELD: usize = 12;
pub const BATCH_MAX: usize = 16;
/// How many events in a row must have arrived less than BATCH_MS after the one before for the relay to count as busy (see `Hub::flush_due`).
pub const BUSY_GAPS: usize = 1;
/// Frame types of v3, relay to client.
pub const T_BATCH: u8 = 8;
pub const T_AUDIENCE: u8 = 9;
/// Audience bands (AUDIENCE frame): 0 nobody holds the player; 1.. the distance of the nearest player that holds it, by these upper edges in metres; the last band is beyond them all.
pub const AUDIENCE_EDGES: [f32; 7] = [50.0, 100.0, 150.0, 250.0, 350.0, 600.0, 1200.0];
/// How much farther than a band's edge the nearest holder must be before the player is told it is in a farther band (the other way it is told at once).
pub const AUDIENCE_STAY: f32 = 1.2;
/// A player outside the set replaces the farthest inside it only if this many metres nearer.
pub const HYSTERESIS_M: f32 = 30.0;
/// Least time between two recomputes of one player's set.
pub const RECOMPUTE_MS: u64 = 1_000;
/// A phrase reaches players this close: the game's DRAW_R (the spec said 250).
pub const SAY_RADIUS_M: f32 = 400.0;
/// The game rejects any position with |x| or |z| at or beyond this (src/p2p/p2p.js, unpackFast).
pub const WORLD_LIMIT_M: f32 = 20_000.0;

pub const MAX_NAME_BYTES: usize = 64;
pub const MAX_NAME_RUNES: usize = 16;
pub const MAX_DIRECT: usize = 8;
/// FAST body without its type byte, and with the optional height.
pub const STATE_LEN: usize = 18;
pub const STATE_LEN_H: usize = 20;
const FLAGS_AT: usize = 14;
const MAX_HEIGHT_RAW: u16 = 10_000; // the game's MAX_LIFT of 1000 m in tenths

/// Text frames are not part of the protocol.
pub const CLOSE_UNSUPPORTED: u16 = 1003;
pub const CLOSE_POLICY: u16 = 1008;
pub const CLOSE_TOO_BIG: u16 = 1009;
pub const CLOSE_GOING_AWAY: u16 = 1001;
/// Sent to make room for a player from an address that holds fewer places than this one.
pub const CLOSE_TRY_AGAIN: u16 = 1013;

/// A client frame that passed every check for its type.
#[derive(Debug, PartialEq)]
pub enum Frame<'a> {
    /// `ver` 2 or 3; `want_k` is what a v3 client asks for (0 for the default), always 0 for v2.
    Hello { ver: u8, want_k: u8, info: &'a [u8] },
    Info { info: &'a [u8] },
    State { body: &'a [u8], x: f32, z: f32 },
    Say { phrase: u8 },
    To { handle: u16, direct: &'a [u8] },
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum ParseError {
    /// Over 96 bytes: the socket is closed with 1009.
    Oversize,
    /// A HELLO that breaks its rules: the socket is closed with 1008.
    BadHello,
    /// Any other frame that breaks its rules, an unknown type included: dropped and counted.
    Malformed,
}

/// `[vehicle u8][livery u8][nameLen u8][name]`: the length must be exact and the name valid UTF-8 within the limits.
/// The relay does not interpret vehicle or livery; the game maps an unknown one to its default.
pub fn valid_info(b: &[u8]) -> bool {
    if b.len() < 3 || b.len() != 3 + b[2] as usize || b[2] as usize > MAX_NAME_BYTES {
        return false;
    }
    std::str::from_utf8(&b[3..]).is_ok_and(|s| s.chars().count() <= MAX_NAME_RUNES && !s.chars().any(|c| c.is_control()))
}

/// What a client is counted under. An IPv4 address counts as itself. An IPv6 address counts by its /64, because one
/// device owns the whole /64 and can use any address in it: counting full addresses would limit nothing. An IPv4
/// address written as IPv6 (`::ffff:1.2.3.4`) counts as the IPv4 one. Anything that is not an address (a test, a
/// missing header) is kept as written, cut to 45 characters so the attachment stays small.
pub fn address_key(ip: &str) -> String {
    match ip.trim().parse::<IpAddr>() {
        Ok(IpAddr::V4(a)) => a.to_string(),
        Ok(IpAddr::V6(a)) => match a.to_ipv4_mapped() {
            Some(v4) => v4.to_string(),
            None => {
                let s = a.segments();
                format!("{:x}:{:x}:{:x}:{:x}::/64", s[0], s[1], s[2], s[3])
            }
        },
        Err(_) => ip.chars().take(45).collect(),
    }
}

/// The 40 bit position at the start of a state (same encoding as relay/src/protocol.rs and the game's packFast):
/// x in the low 20 bits, z in the high 20, 0.05 m units, 2^19 added.
pub fn decode_pos(p: &[u8]) -> (f32, f32) {
    let v = u32::from_le_bytes([p[0], p[1], p[2], p[3]]) as u64 | (p[4] as u64) << 32;
    let x = (v & 0xF_FFFF) as i32 - (1 << 19);
    let z = (v >> 20) as i32 - (1 << 19);
    (x as f32 / 20.0, z as f32 / 20.0)
}

pub fn encode_pos(x: f64, z: f64) -> [u8; 5] {
    let q = |m: f64| ((m * 20.0).round() as i64 + (1 << 19)).clamp(0, 0xF_FFFF) as u64;
    let v = q(x) | q(z) << 20;
    [v as u8, (v >> 8) as u8, (v >> 16) as u8, (v >> 24) as u8, (v >> 32) as u8]
}

/// Checks a state the way the game's unpackFast does, and returns where the car is.
fn check_state(b: &[u8]) -> Option<(f32, f32)> {
    if b.len() < STATE_LEN || b[FLAGS_AT] & 0xf0 != 0 {
        return None;
    }
    let has_height = b[FLAGS_AT] & 8 != 0;
    if b.len() != if has_height { STATE_LEN_H } else { STATE_LEN } {
        return None;
    }
    if has_height && u16::from_le_bytes([b[18], b[19]]) > MAX_HEIGHT_RAW {
        return None;
    }
    let (x, z) = decode_pos(&b[2..7]);
    (x.abs() < WORLD_LIMIT_M && z.abs() < WORLD_LIMIT_M).then_some((x, z))
}

pub fn parse(b: &[u8]) -> Result<Frame<'_>, ParseError> {
    use ParseError::*;
    if b.len() > MAX_FRAME {
        return Err(Oversize);
    }
    let Some(&ty) = b.first() else { return Err(Malformed) };
    match ty {
        1 => {
            if b.len() >= 2 && b[1] == VERSION && valid_info(&b[2..]) {
                Ok(Frame::Hello { ver: VERSION, want_k: 0, info: &b[2..] })
            } else if b.len() >= 3 && b[1] == VERSION_3 && valid_info(&b[3..]) {
                Ok(Frame::Hello { ver: VERSION_3, want_k: b[2], info: &b[3..] })
            } else {
                Err(BadHello)
            }
        }
        2 if valid_info(&b[1..]) => Ok(Frame::Info { info: &b[1..] }),
        3 => check_state(&b[1..]).map(|(x, z)| Frame::State { body: &b[1..], x, z }).ok_or(Malformed),
        4 if b.len() == 2 => Ok(Frame::Say { phrase: b[1] }),
        5 if (4..=3 + MAX_DIRECT).contains(&b.len()) => Ok(Frame::To { handle: u16::from_le_bytes([b[1], b[2]]), direct: &b[3..] }),
        _ => Err(Malformed),
    }
}

pub fn welcome(handle: u16, online: u16) -> Vec<u8> {
    let (h, o) = (handle.to_le_bytes(), online.to_le_bytes());
    vec![1, VERSION, h[0], h[1], o[0], o[1]]
}

/// The answer to a v3 HELLO: the set size this connection got.
pub fn welcome3(handle: u16, online: u16, k: usize) -> Vec<u8> {
    let (h, o) = (handle.to_le_bytes(), online.to_le_bytes());
    vec![1, VERSION_3, h[0], h[1], o[0], o[1], k as u8]
}

/// What a v3 client asked for, made into the set size it gets.
pub fn clamp_k(want: u8) -> usize {
    if want == 0 {
        K_V3
    } else {
        (want as usize).clamp(1, K_MAX)
    }
}

/// The band of a distance to the nearest holder (1 to 8), see `AUDIENCE_EDGES`.
pub fn audience_band(d: f32) -> u8 {
    1 + AUDIENCE_EDGES.iter().filter(|e| d >= **e).count() as u8
}

/// `[8][n][handle u16][state] x n` from n entries already laid out (handle then state, 18 or 20 bytes of state by the height flag).
pub fn batch_frame(n: usize, entries: &[u8]) -> Vec<u8> {
    let mut o = vec![T_BATCH, n as u8];
    o.extend_from_slice(entries);
    o
}

pub fn audience_frame(band: u8) -> Vec<u8> {
    vec![T_AUDIENCE, band]
}

pub fn enter(handle: u16, info: &[u8]) -> Vec<u8> {
    let mut o = vec![2];
    o.extend_from_slice(&handle.to_le_bytes());
    o.extend_from_slice(info);
    o
}

pub fn leave(handle: u16) -> Vec<u8> {
    let h = handle.to_le_bytes();
    vec![3, h[0], h[1]]
}

pub fn state_frame(from: u16, body: &[u8]) -> Vec<u8> {
    let mut o = vec![4];
    o.extend_from_slice(&from.to_le_bytes());
    o.extend_from_slice(body);
    o
}

pub fn say_frame(from: u16, phrase: u8) -> Vec<u8> {
    let h = from.to_le_bytes();
    vec![5, h[0], h[1], phrase]
}

pub fn to_frame(from: u16, direct: &[u8]) -> Vec<u8> {
    let mut o = vec![6];
    o.extend_from_slice(&from.to_le_bytes());
    o.extend_from_slice(direct);
    o
}

pub fn online_frame(n: u16) -> Vec<u8> {
    let o = n.to_le_bytes();
    vec![7, o[0], o[1]]
}

/// Least time between two states forwarded to one receiver, by distance: the game's own send bands.
pub fn forward_interval_ms(d: f32) -> u64 {
    // Each band is 5 ms short of its nominal gap, as the game's own sender is: a client that sends exactly on the
    // band's period would otherwise lose a state to timer jitter and wait a whole period for the next one.
    if d < 150.0 {
        0
    } else if d < 350.0 {
        195
    } else if d < 1200.0 {
        995
    } else {
        2495
    }
}

/// Browsers always send Origin on a WebSocket upgrade, so a missing one is refused too.
/// `allowed` is the comma separated ORIGINS variable; local development origins are always let in.
pub fn origin_allowed(origin: Option<&str>, allowed: &str) -> bool {
    let Some(o) = origin else { return false };
    if allowed.split(',').any(|a| !a.trim().is_empty() && a.trim() == o) {
        return true;
    }
    ["http://localhost:", "http://127.0.0.1:"]
        .iter()
        .any(|p| o.strip_prefix(p).is_some_and(|port| !port.is_empty() && port.len() <= 5 && port.bytes().all(|b| b.is_ascii_digit())))
}

/// The attachment travels as a hex string: a plain JS string clones compactly and needs no extra crate.
pub fn to_hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

pub fn from_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 || !s.is_ascii() {
        return None;
    }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok()).collect()
}

/// Token bucket: refills continuously, holds at most `burst`.
#[derive(Debug, Clone)]
pub struct Bucket {
    rate: f64,
    burst: f64,
    tokens: f64,
    last_ms: u64,
}

impl Bucket {
    pub fn full((rate, burst): (f64, f64), now_ms: u64) -> Self {
        Bucket { rate, burst, tokens: burst, last_ms: now_ms }
    }

    pub fn take(&mut self, now_ms: u64) -> bool {
        self.take_n(now_ms, 1.0)
    }

    /// Takes `n` tokens at once (a byte budget takes one per byte); nothing is taken when there are not enough.
    pub fn take_n(&mut self, now_ms: u64, n: f64) -> bool {
        let dt = now_ms.saturating_sub(self.last_ms) as f64 / 1000.0;
        self.last_ms = now_ms.max(self.last_ms);
        self.tokens = (self.tokens + dt * self.rate).min(self.burst);
        if self.tokens >= n {
            self.tokens -= n;
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    pub fn info(name: &str) -> Vec<u8> {
        let mut v = vec![2, 1, 0, name.len() as u8];
        v.extend_from_slice(name.as_bytes());
        v
    }

    pub fn hello(name: &str) -> Vec<u8> {
        [&[1u8, 2][..], &info(name)[1..]].concat()
    }

    /// A valid state at (x, z), optionally with a height.
    pub fn state_body(x: f64, z: f64, height: Option<u16>) -> Vec<u8> {
        let mut b = vec![0u8; if height.is_some() { 20 } else { 18 }];
        b[2..7].copy_from_slice(&encode_pos(x, z));
        if let Some(h) = height {
            b[14] = 8;
            b[18..20].copy_from_slice(&h.to_le_bytes());
        }
        b
    }

    pub fn state(x: f64, z: f64) -> Vec<u8> {
        [&[3u8][..], &state_body(x, z, None)].concat()
    }

    #[test]
    fn position_roundtrip_matches_the_game_encoding() {
        for (x, z) in [(0.0, 0.0), (-11500.0, 8000.0), (123.45, -987.65), (19999.9, -19999.9)] {
            let (dx, dz) = decode_pos(&encode_pos(x, z));
            assert!((dx as f64 - x).abs() < 0.03 && (dz as f64 - z).abs() < 0.03, "{x} {z} -> {dx} {dz}");
        }
        // bytes worked out by hand from the game's packFast: x = 0 m, z = 0 m is 2^19 in both fields: 0x80000 in the low 20 bits, the same shifted up 20 bits
        assert_eq!(encode_pos(0.0, 0.0), [0x00, 0x00, 0x08, 0x00, 0x80]);
    }

    #[test]
    fn v3_hello_carries_the_wanted_set_size() {
        let h3 = |k: u8, name: &str| [&[1u8, 3, k][..], &info(name)[1..]].concat();
        assert_eq!(parse(&h3(0, "ab")), Ok(Frame::Hello { ver: 3, want_k: 0, info: &info("ab")[1..] }));
        assert!(matches!(parse(&h3(64, "ab")), Ok(Frame::Hello { ver: 3, want_k: 64, .. })));
        assert_eq!(parse(&[1, 3]), Err(ParseError::BadHello), "no wanted size or info");
        assert_eq!(parse(&[1, 4, 0, 1, 0, 0]), Err(ParseError::BadHello), "version 4 is not known");
        assert_eq!(parse(&h3(0, &"a".repeat(17))), Err(ParseError::BadHello));
        // a v2 hello is read exactly as before: the byte after the version is the vehicle, not a set size
        assert_eq!(parse(&hello("ab")), Ok(Frame::Hello { ver: 2, want_k: 0, info: &info("ab")[1..] }));
        assert_eq!((clamp_k(0), clamp_k(1), clamp_k(32), clamp_k(64), clamp_k(65), clamp_k(255)), (32, 1, 32, 64, 64, 64));
        assert_eq!(welcome3(0x0102, 3, 32), vec![1, 3, 2, 1, 3, 0, 32]);
    }

    #[test]
    fn audience_bands() {
        assert_eq!((audience_band(0.0), audience_band(49.9), audience_band(50.0), audience_band(149.0), audience_band(349.0), audience_band(1199.0), audience_band(1200.0), audience_band(1e6)), (1, 1, 2, 3, 5, 7, 8, 8));
        assert_eq!(audience_frame(3), vec![9, 3]);
    }

    #[test]
    fn hello_rules() {
        assert!(matches!(parse(&hello("Totò")), Ok(Frame::Hello { .. })));
        assert!(matches!(parse(&hello("")), Ok(Frame::Hello { .. })));
        assert_eq!(parse(&[1, 1, 1, 1, 0]), Err(ParseError::BadHello), "wrong version");
        assert_eq!(parse(&[1]), Err(ParseError::BadHello));
        assert_eq!(parse(&hello(&"a".repeat(17))), Err(ParseError::BadHello), "17 runes");
        assert!(parse(&hello(&"a".repeat(16))).is_ok());
        assert!(parse(&hello(&"è".repeat(16))).is_ok(), "16 runes of two bytes");
        assert_eq!(parse(&[1, 2, 0, 0, 2, 0xff, 0xfe]), Err(ParseError::BadHello), "not utf8");
        assert_eq!(parse(&hello("a\u{7}b")), Err(ParseError::BadHello), "control character");
        let mut long = hello("abc");
        long.push(0);
        assert_eq!(parse(&long), Err(ParseError::BadHello), "trailing byte");
        let mut short = hello("abc");
        short.pop();
        assert_eq!(parse(&short), Err(ParseError::BadHello));
        assert_eq!(parse(&[1, 2, 0, 0, 65, 0]), Err(ParseError::BadHello), "name over 64 bytes");
    }

    #[test]
    fn info_rules() {
        assert!(matches!(parse(&info("Ciccio")), Ok(Frame::Info { .. })));
        assert_eq!(parse(&info(&"a".repeat(17))), Err(ParseError::Malformed));
        assert!(parse(&[2, 0, 0, 0]).is_ok());
        assert_eq!(parse(&[2, 0]), Err(ParseError::Malformed));
        assert_eq!(parse(&[2, 0, 0, 1]), Err(ParseError::Malformed));
    }

    #[test]
    fn size_limit() {
        assert_eq!(parse(&[3; 97]), Err(ParseError::Oversize));
        assert_eq!(parse(&[]), Err(ParseError::Malformed));
        assert_eq!(parse(&[9; 20]), Err(ParseError::Malformed));
    }

    #[test]
    fn state_rules() {
        let ok = state(100.0, -250.5);
        match parse(&ok) {
            Ok(Frame::State { body, x, z }) => {
                assert_eq!(body.len(), 18);
                assert!((x - 100.0).abs() < 0.03 && (z + 250.5).abs() < 0.03);
            }
            other => panic!("{other:?}"),
        }
        assert!(matches!(parse(&[&[3u8][..], &state_body(1.0, 2.0, Some(500))].concat()), Ok(Frame::State { .. })));
        assert!(parse(&ok[..ok.len() - 1]).is_err(), "17 bytes");
        assert!(parse(&[&ok[..], &[0]].concat()).is_err(), "19 bytes");
        // flag bit 3 set but no height bytes, and height bytes without the flag
        let mut b = ok.clone();
        b[15] = 8;
        assert!(parse(&b).is_err());
        assert!(parse(&[&state(0.0, 0.0)[..], &[0, 0]].concat()).is_err());
        // reserved flag bits
        let mut b = ok.clone();
        b[15] = 0x10;
        assert!(parse(&b).is_err());
        // height above the game's 1000 m
        assert!(parse(&[&[3u8][..], &state_body(0.0, 0.0, Some(10_001))].concat()).is_err());
        assert!(parse(&[&[3u8][..], &state_body(0.0, 0.0, Some(10_000))].concat()).is_ok());
        // outside the map
        assert!(parse(&state(20_000.0, 0.0)).is_err());
        assert!(parse(&state(0.0, -20_100.0)).is_err());
        assert!(parse(&state(19_999.0, -19_999.0)).is_ok());
    }

    #[test]
    fn say_and_to_rules() {
        assert_eq!(parse(&[4, 17]), Ok(Frame::Say { phrase: 17 }));
        assert_eq!(parse(&[4]), Err(ParseError::Malformed));
        assert_eq!(parse(&[4, 1, 2]), Err(ParseError::Malformed));
        assert_eq!(parse(&[5, 0x34, 0x12, 9]), Ok(Frame::To { handle: 0x1234, direct: &[9] }));
        assert_eq!(parse(&[5, 1, 0]), Err(ParseError::Malformed), "no payload");
        assert!(parse(&[&[5u8, 1, 0][..], &[7; 8]].concat()).is_ok());
        assert_eq!(parse(&[&[5u8, 1, 0][..], &[7; 9]].concat()), Err(ParseError::Malformed));
    }

    #[test]
    fn thinning_bands_are_the_games() {
        assert_eq!(forward_interval_ms(0.0), 0);
        assert_eq!(forward_interval_ms(149.9), 0);
        assert_eq!(forward_interval_ms(150.0), 195);
        assert_eq!(forward_interval_ms(349.0), 195);
        assert_eq!(forward_interval_ms(350.0), 995);
        assert_eq!(forward_interval_ms(1199.0), 995);
        assert_eq!(forward_interval_ms(1200.0), 2495);
    }

    #[test]
    fn origin_check() {
        let list = "https://palermo-drive.it, https://other.example";
        assert!(origin_allowed(Some("https://palermo-drive.it"), list));
        assert!(origin_allowed(Some("https://other.example"), list));
        assert!(origin_allowed(Some("http://localhost:8080"), list));
        assert!(origin_allowed(Some("http://127.0.0.1:3000"), ""));
        assert!(!origin_allowed(None, list));
        assert!(!origin_allowed(Some("https://evil.example"), list));
        assert!(!origin_allowed(Some("https://palermo-drive.it.evil.example"), list));
        assert!(!origin_allowed(Some("http://palermo-drive.it"), list));
        assert!(!origin_allowed(Some("http://localhost"), list), "needs a port");
        assert!(!origin_allowed(Some("http://localhost:80.evil.com"), list));
        assert!(!origin_allowed(Some("http://localhost:"), list));
        assert!(!origin_allowed(Some(""), ""));
    }

    #[test]
    fn ipv4_counts_as_itself() {
        assert_eq!(address_key("203.0.113.9"), "203.0.113.9");
        assert_eq!(address_key("::ffff:203.0.113.9"), "203.0.113.9", "mapped IPv4");
    }

    #[test]
    fn ipv6_counts_by_its_64() {
        let a = address_key("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
        assert_eq!(a, address_key("2001:db8:1:2::1"), "same /64, any interface id");
        assert_eq!(a, address_key("2001:0DB8:0001:0002:ffff:ffff:ffff:ffff"), "spelling and case do not matter");
        assert_ne!(a, address_key("2001:db8:1:3::1"), "next /64");
        assert_ne!(a, address_key("2001:db8:2:2::1"));
        assert_eq!(a, "2001:db8:1:2::/64");
    }

    #[test]
    fn a_string_that_is_not_an_address_is_kept_but_bounded() {
        assert_eq!(address_key("unknown"), "unknown");
        assert_eq!(address_key(&"é".repeat(300)).chars().count(), 45);
        assert!(address_key(&"é".repeat(300)).len() < 256, "fits the attachment's one byte length");
    }

    #[test]
    fn hex_roundtrip() {
        let b = vec![0, 1, 0xab, 0xff];
        assert_eq!(from_hex(&to_hex(&b)), Some(b));
        assert_eq!(from_hex("abc"), None);
        assert_eq!(from_hex("zz"), None);
    }

    #[test]
    fn bucket_burst_then_rate() {
        let mut b = Bucket::full(RATE_ALL, 0);
        assert_eq!((0..50).filter(|_| b.take(0)).count(), 30);
        assert_eq!((0..30).filter(|_| b.take(1000)).count(), 12);
        assert_eq!((0..60).filter(|_| b.take(100_000)).count(), 30, "a long pause never stores more than the burst");
        let mut s = Bucket::full(RATE_SAY, 0);
        assert_eq!((0..10).filter(|_| s.take(0)).count(), 3);
        assert!(!s.take(900));
        assert!(s.take(1000));
    }

    #[test]
    fn frame_builders() {
        assert_eq!(welcome(0x0102, 3), vec![1, 2, 2, 1, 3, 0]);
        assert_eq!(enter(0x0102, &[5, 6, 0]), vec![2, 2, 1, 5, 6, 0]);
        assert_eq!(leave(0x0102), vec![3, 2, 1]);
        assert_eq!(state_frame(0x0102, &[9, 9]), vec![4, 2, 1, 9, 9]);
        assert_eq!(say_frame(0x0102, 7), vec![5, 2, 1, 7]);
        assert_eq!(to_frame(0x0102, &[1, 2]), vec![6, 2, 1, 1, 2]);
        assert_eq!(online_frame(300), vec![7, 44, 1]);
    }
}
