// Palermo Drive relay protocol, version 2. All messages are WebSocket binary frames, little endian.
// (Statistics use a separate plain HTTP endpoint, POST /ping, see stats.rs.)
//
// Client to server
//   0x01 INFO   [type][livery u8][nameLen u8][name utf8, at most 64 bytes]   on join and when name or livery change
//   0x02 STATE  [type][STATE 11 bytes]                                       about 8-10 Hz, only when something changed
//   0x03 PING   [type]                                                       every ~10 s of silence
//
// Server to client
//   0x20 WELCOME [type][version u8][yourId u8][maxPlayers u16]
//   0x21 COUNT   [type][playersInRoom u16]                                   when it changes
//   0x22 INFO    [type][id u8][livery u8][nameLen u8][name][position 5 bytes]  a player entered your interest radius, or changed
//   0x23 REMOVE  [type][id u8]                                               a player left your interest radius or the room
//   0x24 STATES  [type][nFull u8][nShort u8], nFull times FULL, nShort times SHORT   batched, one frame per receiver per tick
//                FULL  [id u8][x16 u16][z16 u16][heading u8][speed i8][steer i8][roll i8][lean i8][flags u8]   within 150 m
//                SHORT [id u8][x16 u16][z16 u16][heading u8][speed i8]                                         farther away
//   0x25 BEAT    [type]                                                       keep-alive when nothing else was sent for a while
//
// Version 2 (version 1 had a u8 maxPlayers and count, 32 players per room, and 10 byte states with i16 positions):
// a room holds up to 256 players, ids are still one byte (slot 0..255), maxPlayers and the count are u16.
//
// STATE (11 bytes): position 5 bytes, then heading u8 (0..255 = 0..2pi), speed i8 (units of 0.5 m/s, signed, along the heading),
//   steer i8 (-127..127 = -0.7..0.7 rad), roll i8 (-127..127 = -0.5..0.5 rad), lean i8 (signed tip amount, -127..127 = -1..1),
//   flags u8 (bit0 nitro, bit1 brake, bit2 handbrake).
// Position: one 40 bit little endian number, x in the low 20 bits and z in the high 20 bits, each in units of 0.05 m from the
//   world origin (Quattro Canti, +x east, +z south) with 524288 added: 0..1048575 covers -26214.4 m to +26214.35 m.
//   The map's tiles span x -11500..8500 and z -12500..8000 (world/tiles, 500 m tiles), so this is more than twice the needed range.
//
// Positions in STATES entries are the low 16 bits of the two 20 bit position numbers (x16, z16). The client adds the wrapped
// (signed 16 bit) difference to the position it already has for that player, starting from the position in the INFO message.
// That is exact because a player cannot be 1.6 km (32768 units) from where it last was while both places are inside someone's
// 456 m radius. A SHORT entry is the first 7 bytes of a FULL one: it carries only what can be seen from afar, steer, roll, lean and
// flags keep their last value. The relay sends FULL entries within 150 m and for a player's first state after its INFO.

use unicode_general_category::{get_general_category, GeneralCategory as Gc};

pub const VERSION: u8 = 2;
pub const MAX_PLAYERS: usize = 256;
pub const MAX_NAME_RUNES: usize = 16;
pub const MAX_NAME_BYTES: usize = 64;
pub const MAX_LIVERY: u8 = 15;
pub const STATE_LEN: usize = 11;
/// Longest client message: INFO with a 64 byte name is 67 bytes.
pub const MAX_CLIENT_MSG: usize = 80;

pub const C_INFO: u8 = 0x01;
pub const C_STATE: u8 = 0x02;
pub const C_PING: u8 = 0x03;

pub const S_WELCOME: u8 = 0x20;
pub const S_COUNT: u8 = 0x21;
pub const S_INFO: u8 = 0x22;
pub const S_REMOVE: u8 = 0x23;
pub const S_STATES: u8 = 0x24;
pub const S_BEAT: u8 = 0x25;

const POS_UNITS: f32 = 20.0; // per metre
const POS_MID: i32 = 1 << 19;

/// Decodes the 5 byte position at the start of a STATE into metres (x, z).
#[inline]
pub fn decode_pos(s: &[u8]) -> (f32, f32) {
    let v = u32::from_le_bytes([s[0], s[1], s[2], s[3]]) as u64 | (s[4] as u64) << 32;
    let x = (v & 0xF_FFFF) as i32 - POS_MID;
    let z = (v >> 20) as i32 - POS_MID;
    (x as f32 / POS_UNITS, z as f32 / POS_UNITS)
}

/// The low 16 bits of x and z (little endian each), as sent in SHORT entries.
#[inline]
pub fn pos16(s: &[u8]) -> [u8; 4] {
    let v = u32::from_le_bytes([s[0], s[1], s[2], s[3]]) as u64 | (s[4] as u64) << 32;
    let (x, z) = (v as u16, (v >> 20) as u16);
    [x as u8, (x >> 8) as u8, z as u8, (z >> 8) as u8]
}

/// Encodes a position (used by the load test). Out of range values are clamped to the edge of the range.
#[allow(dead_code)]
pub fn encode_pos(x: f64, z: f64) -> [u8; 5] {
    let q = |m: f64| ((m * POS_UNITS as f64).round() as i64 + POS_MID as i64).clamp(0, 0xF_FFFF) as u64;
    let v = q(x) | q(z) << 20;
    [v as u8, (v >> 8) as u8, (v >> 16) as u8, (v >> 24) as u8, (v >> 32) as u8]
}

/// Strips control, format and layout characters, collapses spaces, limits the length to 16 characters and drops runaway
/// combining marks. Returns "" for invalid UTF-8.
pub fn clean_name(b: &[u8]) -> String {
    if b.len() > MAX_NAME_BYTES {
        return String::new();
    }
    let Ok(s) = std::str::from_utf8(b) else { return String::new() };
    let mut out: Vec<char> = Vec::with_capacity(MAX_NAME_RUNES);
    let mut prev_mark = false;
    for r in s.chars() {
        if r.is_whitespace() {
            if out.last().is_some_and(|&c| c != ' ') {
                out.push(' ');
            }
            prev_mark = false;
        } else {
            match get_general_category(r) {
                Gc::Control | Gc::Format | Gc::PrivateUse | Gc::Surrogate => {}
                _ if r == '\u{FFFD}' => {}
                Gc::NonspacingMark | Gc::EnclosingMark => {
                    if !out.is_empty() && !prev_mark {
                        out.push(r);
                        prev_mark = true;
                    }
                }
                _ => {
                    out.push(r);
                    prev_mark = false;
                }
            }
        }
        if out.len() >= MAX_NAME_RUNES {
            break;
        }
    }
    out.iter().collect::<String>().trim().to_string()
}

fn is_letter(c: char) -> bool {
    matches!(get_general_category(c), Gc::UppercaseLetter | Gc::LowercaseLetter | Gc::TitlecaseLetter | Gc::ModifierLetter | Gc::OtherLetter)
}

// A deliberately tiny block list (slurs only). Substring match on a letters-only, de-leetspeaked copy of the name.
const BLOCKED: [&str; 8] = ["nazi", "hitler", "nigg", "fuck", "cunt", "faggot", "puttana", "negrodimerda"];

pub fn is_blocked(name: &str) -> bool {
    let mut s = String::with_capacity(name.len());
    for r in name.chars().flat_map(char::to_lowercase) {
        let r = match r {
            '0' => 'o',
            '1' | '!' | '|' => 'i',
            '3' => 'e',
            '4' | '@' => 'a',
            '5' | '$' => 's',
            r => r,
        };
        if is_letter(r) {
            s.push(r);
        }
    }
    BLOCKED.iter().any(|w| s.contains(w))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pos_round_trip_over_the_whole_map() {
        for &(x, z) in &[(0.0, 0.0), (-11500.0, -12500.0), (8500.0, 8000.0), (-3941.0, -7170.0), (12.35, -0.05)] {
            let (dx, dz) = decode_pos(&encode_pos(x, z));
            assert!((dx as f64 - x).abs() <= 0.026 && (dz as f64 - z).abs() <= 0.026, "{x},{z} -> {dx},{dz}");
        }
        let (x, z) = decode_pos(&encode_pos(1e9, -1e9));
        assert!(x > 26214.0 && z < -26214.0);
    }

    #[test]
    fn names() {
        assert_eq!(clean_name("  Ma\u{200B}rio   Rossi  ".as_bytes()), "Mario Rossi");
        assert_eq!(clean_name(&[0xff, 0xfe]), "");
        assert_eq!(clean_name("abcdefghijklmnopqrstuvwxyz".as_bytes()), "abcdefghijklmnop");
        assert_eq!(clean_name("e\u{301}\u{301}\u{301}x".as_bytes()), "e\u{301}x");
        assert!(is_blocked("N4z1 boy") && is_blocked("h1tler") && !is_blocked("Mario"));
    }
}
