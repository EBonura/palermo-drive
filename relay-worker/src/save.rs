//! Cloud saves: the rules, with no Worker types so they are tested natively (`cargo test`). `sglue` is the thin Cloudflare layer around them.
//!
//! A player has no account. The browser makes a random secret key (26 characters of Crockford base32, 128 bits) and keeps it; the same key typed on another device brings the save over.
//! The key is never stored: the save lives in a Durable Object named by the SHA-256 of the key (see `object_name`), so the data cannot be found without the key and nothing here can
//! read a key back. One object per player, made in the EU jurisdiction like the room, so no single object is hot and a player's data is one small unit that can be deleted whole.
//!
//! The save itself is opaque to the server: the game's own localStorage entries as one JSON text (`blob`) and the driver's picture (`driver`, a PNG data URL) kept apart because it
//! is large and rarely changes. The server looks at three things only: the key, the size, and the wallet (`cash`, which the client sends beside the blob) for a sanity check. That
//! check is not security (anybody can edit their own browser's storage): it only keeps an absurd or impossible wallet from being stored and carried to the next device.

/// Largest blob and largest driver picture, in bytes. The game's saves are a few KB; the driver's PNG is the big one.
pub const MAX_BLOB: usize = 100_000;
pub const MAX_DRIVER: usize = 150_000;
/// Fewest milliseconds between two writes of one player: a page saves on events, not in a loop.
pub const MIN_GAP_MS: u64 = 4_000;
/// A save nobody touches for this long is deleted by the object's own alarm (every write pushes it back).
pub const RETENTION_MS: i64 = 365 * 24 * 3600 * 1000;
/// The wallet: never above CASH_MAX, and a new value may exceed the stored one by at most CASH_JUMP plus CASH_PER_S for every second since the last write. These are loose on purpose (the
/// game pays at most about a euro a second for hits and a few hundred for a job, src/economy.js); they only catch a wallet that is plainly made up.
pub const CASH_MAX: u64 = 10_000_000;
pub const CASH_JUMP: u64 = 5_000;
pub const CASH_PER_S: u64 = 25;

const ALPHABET: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/// A key is exactly 26 characters of the alphabet (upper case; the client shows it in groups with dashes, which it takes out first).
pub fn valid_key(k: &str) -> bool {
    k.len() == 26 && k.bytes().all(|b| ALPHABET.contains(&b))
}

/// The name of the object that holds a key's save: the hex SHA-256 of a fixed prefix and the key.
pub fn object_name(key: &str) -> String {
    let mut m = b"pd-save-v1:".to_vec();
    m.extend_from_slice(key.as_bytes());
    sha256(&m).iter().map(|b| format!("{:02x}", b)).collect()
}

/// What a write asks for, from a request body of the form `key \n cash \n blob`, or why not. The blob may contain anything, newlines included.
pub struct Write<'a> {
    pub key: &'a str,
    pub cash: u64,
    pub blob: &'a str,
}

#[derive(Debug, PartialEq)]
pub enum Refuse {
    Malformed,
    TooBig,
    Wallet,
    TooSoon,
}

pub fn parse_write(body: &str) -> Result<Write<'_>, Refuse> {
    let mut it = body.splitn(3, '\n');
    let (key, cash, blob) = (it.next().unwrap_or(""), it.next().ok_or(Refuse::Malformed)?, it.next().ok_or(Refuse::Malformed)?);
    if !valid_key(key) {
        return Err(Refuse::Malformed);
    }
    let cash: u64 = cash.parse().map_err(|_| Refuse::Malformed)?;
    if blob.len() > MAX_BLOB {
        return Err(Refuse::TooBig);
    }
    if !blob.starts_with('{') || !blob.ends_with('}') {
        return Err(Refuse::Malformed);
    }
    Ok(Write { key, cash, blob })
}

/// The driver body is `key \n png data url`.
pub fn parse_driver(body: &str) -> Result<(&str, &str), Refuse> {
    let (key, png) = body.split_once('\n').ok_or(Refuse::Malformed)?;
    if !valid_key(key) {
        return Err(Refuse::Malformed);
    }
    if png.len() > MAX_DRIVER {
        return Err(Refuse::TooBig);
    }
    if !png.starts_with("data:image/png;base64,") || !png[22..].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/' || b == b'=') {
        return Err(Refuse::Malformed);
    }
    Ok((key, png))
}

/// Is `cash` an acceptable wallet given the last stored one (`None`: nothing stored) and the milliseconds since it was written?
pub fn wallet_ok(cash: u64, old: Option<(u64, u64)>) -> bool {
    if cash > CASH_MAX {
        return false;
    }
    match old {
        None => cash <= CASH_JUMP * 4,   // a first save from a browser that already played: some money, not a fortune
        Some((o, gap_ms)) => cash <= o.saturating_add(CASH_JUMP).saturating_add(CASH_PER_S.saturating_mul(gap_ms / 1000)),
    }
}

pub fn too_soon(gap_ms: u64) -> bool {
    gap_ms < MIN_GAP_MS
}

/// SHA-256 (FIPS 180-4), a plain implementation: the Worker has no hashing crate and this is the only hash it needs.
pub fn sha256(data: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
        0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
        0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let mut h: [u32; 8] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    let mut msg = data.to_vec();
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&((data.len() as u64) * 8).to_be_bytes());
    for chunk in msg.chunks(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([chunk[4 * i], chunk[4 * i + 1], chunk[4 * i + 2], chunk[4 * i + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ (!e & g);
            let t1 = hh.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2);
        }
        for (x, y) in h.iter_mut().zip([a, b, c, d, e, f, g, hh]) {
            *x = x.wrapping_add(y);
        }
    }
    let mut out = [0u8; 32];
    for (i, v) in h.iter().enumerate() {
        out[4 * i..4 * i + 4].copy_from_slice(&v.to_be_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    const KEY: &str = "0123456789ABCDEFGHJKMNPQRS";

    fn hex(b: &[u8]) -> String {
        b.iter().map(|x| format!("{:02x}", x)).collect()
    }

    #[test]
    fn sha256_known_vectors() {
        assert_eq!(hex(&sha256(b"")), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        assert_eq!(hex(&sha256(b"abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert_eq!(hex(&sha256(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    }

    #[test]
    fn keys() {
        assert!(valid_key(KEY));
        assert!(!valid_key("0123456789ABCDEFGHJKMNPQR"));   // 25
        assert!(!valid_key("0123456789ABCDEFGHJKMNPQRI"));  // I is not in the alphabet
        assert!(!valid_key("0123456789abcdefghjkmnpqrs"));  // lower case: the client upper-cases first
        assert_ne!(object_name(KEY), object_name("1123456789ABCDEFGHJKMNPQRS"));
        assert_eq!(object_name(KEY).len(), 64);
    }

    #[test]
    fn writes() {
        let ok = format!("{}\n120\n{{\"a\":1}}", KEY);
        let w = parse_write(&ok).unwrap();
        assert_eq!((w.key, w.cash, w.blob), (KEY, 120, "{\"a\":1}"));
        assert_eq!(parse_write(&format!("{}\n12x\n{{}}", KEY)).err(), Some(Refuse::Malformed));
        assert_eq!(parse_write(&format!("{}\n12\nnot json", KEY)).err(), Some(Refuse::Malformed));
        assert_eq!(parse_write("short\n1\n{}").err(), Some(Refuse::Malformed));
        assert_eq!(parse_write(&format!("{}\n1\n{{{}}}", KEY, "a".repeat(MAX_BLOB))).err(), Some(Refuse::TooBig));
        assert!(parse_write(&format!("{}\n1\n{{\"x\":\"a\nb\"}}", KEY)).is_ok());   // newlines inside the blob are fine
    }

    #[test]
    fn drivers() {
        assert!(parse_driver(&format!("{}\ndata:image/png;base64,iVBORw0KGgo=", KEY)).is_ok());
        assert_eq!(parse_driver(&format!("{}\ndata:image/svg+xml;base64,AAAA", KEY)).err(), Some(Refuse::Malformed));
        assert_eq!(parse_driver(&format!("{}\ndata:image/png;base64,<script>", KEY)).err(), Some(Refuse::Malformed));
        assert_eq!(parse_driver(&format!("{}\ndata:image/png;base64,{}", KEY, "A".repeat(MAX_DRIVER))).err(), Some(Refuse::TooBig));
    }

    #[test]
    fn wallet() {
        assert!(wallet_ok(50, None));
        assert!(!wallet_ok(1_000_000, None));
        assert!(wallet_ok(300, Some((100, 10_000))));
        assert!(!wallet_ok(900_000, Some((100, 10_000))));
        assert!(wallet_ok(0, Some((9_000_000, 1))));   // spending is always fine
        assert!(!wallet_ok(CASH_MAX + 1, Some((CASH_MAX, 1e12 as u64))));
        assert!(too_soon(100) && !too_soon(MIN_GAP_MS));
    }
}
