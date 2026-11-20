//! Wire format and fixed limits of the tables protocol (`/t`), with no Worker types. The frame table is the contract
//! with BLATERO's client: see README.md, "Tables". Nothing here may change without the client changing with it.

use crate::shape;

pub const VERSION: u8 = 1;
/// A whole frame, header included.
pub const MAX_FRAME: usize = 16_384;
/// Sockets in one table: BLATERO seats 6 and a 7th device can claim a dropped seat.
pub const SLOTS: usize = 8;
pub const MAX_SOCKETS: usize = 180;
pub const MAX_TABLES: usize = 30;
pub const MAX_PER_IP: usize = 24;
pub const MAX_TABLES_PER_IP: usize = 4;
/// Distinct codes one address may name in an hour. Also the guessing limit.
pub const MAX_CODES_PER_IP_HOUR: usize = 8;
pub const HOUR_MS: u64 = 3_600_000;
pub const FRAMES_PER_IP_PER_DAY: u32 = 100_000;
/// Entries of each per address table before it is emptied (the same idea as `Hub`'s).
pub const MAX_ADDRESSES: usize = 50_000;
pub const MAX_MALFORMED: u32 = 20;
pub const MAX_RATE_STRIKES: u32 = 100;
pub const RATE_FORGIVE_MS: u64 = 10_000;
pub const HELLO_DEADLINE_MS: u64 = 10_000;
/// The client beats every 15 s, so this is about two and a half missed beats.
pub const MEMBER_IDLE_MS: u64 = 40_000;
/// A table where nothing but beats has been sent for this long is closed.
pub const TABLE_IDLE_MS: u64 = 30 * 60_000;

/// Frames per second and burst, per socket; bytes per second and burst, per socket; frames per table.
pub const RATE_FRAMES: (f64, f64) = (8.0, 24.0);
pub const RATE_BYTES: (f64, f64) = (32_768.0, 65_536.0);
pub const RATE_TABLE: (f64, f64) = (40.0, 120.0);

/// The browser origin of BLATERO's game frame on itch.io. That host is shared by every HTML5 game on itch.
/// Keep in step with `TABLE_ORIGINS` in wrangler.toml (a test checks).
pub const DEFAULT_TABLE_ORIGINS: &str = "https://html-classic.itch.zone";

/// 4001 and up are the application's own close codes.
pub const CLOSE_REPLACED: u16 = 4001;
pub const CLOSE_EXISTS: u16 = 4002;
pub const CLOSE_TABLE_IDLE: u16 = 4003;
pub const CLOSE_TABLE_FULL: u16 = 4004;

/// The game's table code alphabet (BLATERO's `CODE_ALPHABET`): no 0, O, 1 or I.
pub const CODE_ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

pub type Code = [u8; 5];
pub type Pid = [u8; 16];

#[derive(Debug, PartialEq, Eq)]
pub enum Frame<'a> {
    Hello { must_be_new: bool, pid: Pid, code: Code },
    Bcast { kind: u8, payload: &'a [u8] },
    To { slot: u8, kind: u8, payload: &'a [u8] },
    Beat,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum ParseError {
    /// Over 16,384 bytes: the socket is closed with 1009.
    Oversize,
    /// A HELLO that breaks its rules: the socket is closed with 1008.
    BadHello,
    /// Any other frame that breaks its rules, an unknown type included: dropped and counted.
    Malformed,
}

pub fn valid_code(c: &[u8]) -> bool {
    c.len() == 5 && c.iter().all(|b| CODE_ALPHABET.contains(b))
}

/// A UUID's 16 raw bytes with the version 4 and variant bits set.
pub fn valid_pid(p: &[u8]) -> bool {
    p.len() == 16 && p[6] >> 4 == 4 && p[8] >> 6 == 0b10
}

pub fn parse(b: &[u8]) -> Result<Frame<'_>, ParseError> {
    use ParseError::*;
    if b.len() > MAX_FRAME {
        return Err(Oversize);
    }
    let Some(&ty) = b.first() else { return Err(Malformed) };
    match ty {
        // [1][ver u8][flags u8][pid 16][code 5]: exactly 24 bytes, version 1, only flag bit 0 may be set.
        1 => {
            if b.len() != 24 || b[1] != VERSION || b[2] & !1 != 0 || !valid_pid(&b[3..19]) || !valid_code(&b[19..24]) {
                return Err(BadHello);
            }
            Ok(Frame::Hello { must_be_new: b[2] & 1 != 0, pid: b[3..19].try_into().unwrap(), code: b[19..24].try_into().unwrap() })
        }
        2 if b.len() >= 3 && payload_ok(b[1], &b[2..]) => Ok(Frame::Bcast { kind: b[1], payload: &b[2..] }),
        3 if b.len() >= 4 && (b[1] as usize) < SLOTS && payload_ok(b[2], &b[3..]) => Ok(Frame::To { slot: b[1], kind: b[2], payload: &b[3..] }),
        4 if b.len() == 1 => Ok(Frame::Beat),
        _ => Err(Malformed),
    }
}

fn payload_ok(kind: u8, payload: &[u8]) -> bool {
    shape::check(kind, payload)
}

pub fn welcome(slot: u8, others: &[(u8, Pid)]) -> Vec<u8> {
    let mut o = vec![1, VERSION, slot, others.len() as u8];
    for (s, pid) in others {
        o.push(*s);
        o.extend_from_slice(pid);
    }
    o
}

pub fn join(slot: u8, pid: &Pid) -> Vec<u8> {
    let mut o = vec![2, slot];
    o.extend_from_slice(pid);
    o
}

pub fn leave(slot: u8) -> Vec<u8> {
    vec![3, slot]
}

pub fn bcast(from: u8, kind: u8, payload: &[u8]) -> Vec<u8> {
    let mut o = Vec::with_capacity(3 + payload.len());
    o.extend_from_slice(&[4, from, kind]);
    o.extend_from_slice(payload);
    o
}

pub fn to_frame(from: u8, kind: u8, payload: &[u8]) -> Vec<u8> {
    let mut o = Vec::with_capacity(3 + payload.len());
    o.extend_from_slice(&[5, from, kind]);
    o.extend_from_slice(payload);
    o
}

pub fn beat() -> Vec<u8> {
    vec![6]
}

#[cfg(test)]
pub mod tests {
    use super::*;

    pub const PID_A: Pid = [0x3f, 0x2a, 0x9c, 0x1e, 0x8b, 0x7d, 0x4c, 0x2a, 0x9e, 0x11, 0x5d, 0x6f, 0x7a, 0x8b, 0x9c, 0x0d];

    /// A valid pid that differs from `PID_A` in its first byte.
    pub fn pid(n: u8) -> Pid {
        let mut p = PID_A;
        p[0] = n;
        p
    }

    pub fn hello(pid: &Pid, code: &str, must_be_new: bool) -> Vec<u8> {
        let mut o = vec![1, VERSION, must_be_new as u8];
        o.extend_from_slice(pid);
        o.extend_from_slice(code.as_bytes());
        o
    }

    pub fn bcast_frame(kind: u8, json: &str) -> Vec<u8> {
        let mut o = vec![2, kind];
        o.extend_from_slice(json.as_bytes());
        o
    }

    pub fn to_bytes(slot: u8, kind: u8, json: &str) -> Vec<u8> {
        let mut o = vec![3, slot, kind];
        o.extend_from_slice(json.as_bytes());
        o
    }

    pub const ACT: &str = r#"{"nonce":"abc123def","action":{"type":"ready","id":"x"}}"#;
    pub const HELLO_JSON: &str = r#"{"version":1}"#;

    #[test]
    fn hello_rules() {
        let ok = hello(&PID_A, "K7Q2M", false);
        assert_eq!(parse(&ok), Ok(Frame::Hello { must_be_new: false, pid: PID_A, code: *b"K7Q2M" }));
        assert!(matches!(parse(&hello(&PID_A, "K7Q2M", true)), Ok(Frame::Hello { must_be_new: true, .. })));
        assert_eq!(parse(&ok[..23]), Err(ParseError::BadHello), "short");
        assert_eq!(parse(&[&ok[..], &[0]].concat()), Err(ParseError::BadHello), "long");
        let mut b = ok.clone();
        b[1] = 2;
        assert_eq!(parse(&b), Err(ParseError::BadHello), "version");
        let mut b = ok.clone();
        b[1] = 0;
        assert_eq!(parse(&b), Err(ParseError::BadHello), "version 0");
        for bit in 1..8 {
            let mut b = ok.clone();
            b[2] = 1 << bit;
            assert_eq!(parse(&b), Err(ParseError::BadHello), "reserved flag bit {bit}");
        }
        let mut b = ok.clone();
        b[3 + 6] = 0x30 | (b[3 + 6] & 0x0f);
        assert_eq!(parse(&b), Err(ParseError::BadHello), "uuid version 3");
        let mut b = ok.clone();
        b[3 + 8] = 0x40;
        assert_eq!(parse(&b), Err(ParseError::BadHello), "uuid variant");
        assert_eq!(parse(&hello(&[0; 16], "K7Q2M", false)), Err(ParseError::BadHello), "all zero pid");
        for code in ["K7Q2", "K7Q2M3", "k7q2m", "K7Q20", "K7Q2O", "K7Q21", "K7Q2I", "K7Q2 ", "K7Q2\0", "K7Q2-"] {
            assert_eq!(parse(&hello(&PID_A, code, false)), Err(ParseError::BadHello), "{code:?}");
        }
        let mut b = ok.clone();
        b[23] = 0xc3;
        assert_eq!(parse(&b), Err(ParseError::BadHello), "non ASCII code byte");
        assert!(parse(&hello(&PID_A, "23456", false)).is_ok() && parse(&hello(&PID_A, "ABCDE", false)).is_ok() && parse(&hello(&PID_A, "ZYXWV", false)).is_ok());
    }

    #[test]
    fn every_symbol_of_the_alphabet_is_accepted_and_nothing_else() {
        for b in 0..=255u8 {
            let want = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789".contains(&b);
            assert_eq!(valid_code(&[b; 5]), want, "{b}");
        }
        assert_eq!(CODE_ALPHABET.len(), 32);
    }

    #[test]
    fn bcast_and_to_rules() {
        assert_eq!(parse(&bcast_frame(4, ACT)), Ok(Frame::Bcast { kind: 4, payload: ACT.as_bytes() }));
        assert_eq!(parse(&to_bytes(7, 1, HELLO_JSON)), Ok(Frame::To { slot: 7, kind: 1, payload: HELLO_JSON.as_bytes() }));
        assert_eq!(parse(&to_bytes(8, 1, HELLO_JSON)), Err(ParseError::Malformed), "slot 8");
        assert_eq!(parse(&to_bytes(255, 1, HELLO_JSON)), Err(ParseError::Malformed));
        for kind in [0u8, 5, 6, 255] {
            assert_eq!(parse(&bcast_frame(kind, ACT)), Err(ParseError::Malformed), "kind {kind}");
            assert_eq!(parse(&to_bytes(0, kind, ACT)), Err(ParseError::Malformed), "kind {kind}");
        }
        assert_eq!(parse(&[2]), Err(ParseError::Malformed));
        assert_eq!(parse(&[2, 4]), Err(ParseError::Malformed), "no payload");
        assert_eq!(parse(&[3, 0, 1]), Err(ParseError::Malformed));
        assert_eq!(parse(&[3]), Err(ParseError::Malformed));
        assert_eq!(parse(&bcast_frame(1, "[1]")), Err(ParseError::Malformed), "not an object");
        assert_eq!(parse(&bcast_frame(1, r#"{"nonce":"a","action":{}}"#)), Err(ParseError::Malformed), "an act's payload sent as a hello");
        assert_eq!(parse(&bcast_frame(4, HELLO_JSON)), Err(ParseError::Malformed), "a hello's payload sent as an act");
        assert_eq!(parse(&[&[2u8, 4][..], &[0xff, 0xfe]].concat()), Err(ParseError::Malformed));
    }

    #[test]
    fn beat_and_unknown_types() {
        assert_eq!(parse(&[4]), Ok(Frame::Beat));
        assert_eq!(parse(&[4, 0]), Err(ParseError::Malformed), "a beat with a body");
        assert_eq!(parse(&[]), Err(ParseError::Malformed));
        for t in [0u8, 5, 6, 7, 99, 255] {
            assert_eq!(parse(&[t, 1, 2, 3]), Err(ParseError::Malformed), "type {t}");
        }
    }

    #[test]
    fn size_limit_is_the_whole_frame() {
        assert_eq!(parse(&vec![2u8; 16_385]), Err(ParseError::Oversize));
        assert_eq!(parse(&vec![0u8; 100_000]), Err(ParseError::Oversize));
        // a state payload that fills the frame exactly: 2 bytes of header + 16,382 of payload
        let pad = "x".repeat(16_382 - r#"{"code":"K7Q2M","version":1,"phase":"lobby","players":[],"game":null,"recent":[""]}"#.len());
        let json = format!(r#"{{"code":"K7Q2M","version":1,"phase":"lobby","players":[],"game":null,"recent":["{pad}"]}}"#);
        assert_eq!(json.len(), 16_382);
        let f = bcast_frame(2, &json);
        assert_eq!(f.len(), 16_384);
        assert!(matches!(parse(&f), Ok(Frame::Bcast { .. })));
        let f = bcast_frame(2, &format!("{json} "));
        assert!(f.len() == 16_385 && parse(&f) == Err(ParseError::Oversize));
        // as a TO the header is one byte longer, so the same payload is over
        assert_eq!(parse(&to_bytes(0, 2, &json)), Err(ParseError::Oversize));
    }

    #[test]
    fn the_per_kind_caps_apply_inside_a_frame() {
        let big_act = format!(r#"{{"nonce":"a","action":{{"p":"{}"}}}}"#, "x".repeat(1_100));
        assert_eq!(parse(&bcast_frame(4, &big_act)), Err(ParseError::Malformed));
        let big_hello = format!(r#"{{"version":1,"ask":true,"full":{}}}"#, "x".repeat(600));
        assert_eq!(parse(&bcast_frame(1, &big_hello)), Err(ParseError::Malformed));
    }

    #[test]
    fn frame_builders_are_the_contract() {
        assert_eq!(welcome(2, &[]), vec![1, 1, 2, 0]);
        let w = welcome(0, &[(3, PID_A), (5, pid(9))]);
        assert_eq!(&w[..4], &[1, 1, 0, 2]);
        assert_eq!(w[4], 3);
        assert_eq!(&w[5..21], &PID_A);
        assert_eq!(w[21], 5);
        assert_eq!(w.len(), 4 + 2 * 17);
        let j = join(4, &PID_A);
        assert_eq!((j[0], j[1], j.len()), (2, 4, 18));
        assert_eq!(&j[2..], &PID_A);
        assert_eq!(leave(6), vec![3, 6]);
        assert_eq!(bcast(1, 4, b"{}"), vec![4, 1, 4, b'{', b'}']);
        assert_eq!(to_frame(1, 2, b"{}"), vec![5, 1, 2, b'{', b'}']);
        assert_eq!(beat(), vec![6]);
    }

    #[test]
    fn origins_are_separate_from_the_games() {
        use crate::proto::origin_allowed;
        assert!(origin_allowed(Some("https://html-classic.itch.zone"), DEFAULT_TABLE_ORIGINS));
        assert!(!origin_allowed(Some("https://palermo-drive.it"), DEFAULT_TABLE_ORIGINS), "a Palermo Drive page cannot open a table socket");
        assert!(!origin_allowed(Some("https://html-classic.itch.zone"), "https://palermo-drive.it"), "and a BLATERO page cannot open a room socket");
        assert!(!origin_allowed(Some("https://bonnie-studios.itch.io"), DEFAULT_TABLE_ORIGINS), "the itch.io page itself is not the game frame");
        assert!(!origin_allowed(Some("http://html-classic.itch.zone"), DEFAULT_TABLE_ORIGINS));
        assert!(!origin_allowed(Some("https://evil.html-classic.itch.zone"), DEFAULT_TABLE_ORIGINS));
        assert!(!origin_allowed(None, DEFAULT_TABLE_ORIGINS));
        assert!(origin_allowed(Some("http://localhost:8080"), DEFAULT_TABLE_ORIGINS));
        assert!(origin_allowed(Some("http://127.0.0.1:5173"), DEFAULT_TABLE_ORIGINS));
        assert!(!origin_allowed(Some("http://localhost"), DEFAULT_TABLE_ORIGINS));
    }

    #[test]
    fn wrangler_toml_carries_the_same_default() {
        let toml = include_str!("../wrangler.toml");
        assert!(toml.contains(&format!("TABLE_ORIGINS = \"{DEFAULT_TABLE_ORIGINS}\"")));
        assert!(toml.contains("ORIGINS = \"https://palermo-drive.it\""));
    }
}
