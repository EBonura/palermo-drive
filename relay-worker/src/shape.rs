//! Payload shape check for table frames, with no Worker types. The relay does not play BLATERO, but it checks that a
//! payload LOOKS like one of BLATERO's four messages, so that it is not worth borrowing as a general JSON bus: valid
//! UTF-8, one JSON object, exactly the top-level keys that kind has (required ones present, optional ones allowed,
//! nothing else), each with the JSON type BLATERO gives it, inside the kind's size cap, with bounded depth and token
//! count. Values are walked to be sure the whole payload is well formed JSON, and then forgotten: nothing below the top
//! level is interpreted (no rules, no turn order, no field names).
//!
//! A hand written scanner rather than `serde_json`: see the README ("Why a scanner"). In short, it bounds depth and
//! tokens itself, rejects duplicate and escaped top-level keys (which a lenient parser reads as the same key), builds
//! nothing, and is smaller than the compressed cost of pulling serde_json's parser into the Worker.
//!
//! The key lists are the contract with BLATERO's `src/net/session.ts` and `src/room/state.ts`. Changing a message's
//! top-level shape there means changing this file and deploying the relay first.

pub const KIND_HELLO: u8 = 1;
pub const KIND_STATE: u8 = 2;
pub const KIND_PATCH: u8 = 3;
pub const KIND_ACT: u8 = 4;

/// Deepest nesting accepted, the top level object counting as 1. BLATERO's patches nest about twice as deep as the
/// state they describe (a whole `RoomState` is about 6 deep), so 32 leaves a wide margin and still stops `[[[[...`.
pub const MAX_DEPTH: usize = 32;
/// A number written with more characters than this is refused (a JavaScript number never needs more).
const MAX_NUMBER_LEN: usize = 40;

const STR: u8 = 1;
const NUM: u8 = 2;
const BOOL: u8 = 4;
const OBJ: u8 = 8;
const ARR: u8 = 16;
const NULL: u8 = 32;

struct Key {
    name: &'static str,
    /// The JSON types allowed, as a bit set.
    types: u8,
    required: bool,
}

const fn req(name: &'static str, types: u8) -> Key {
    Key { name, types, required: true }
}
const fn opt(name: &'static str, types: u8) -> Key {
    Key { name, types, required: false }
}

// `hello`: `{version, ask?, full?}`. Who the sender is comes from the roster and from the state, not from this message.
const HELLO: &[Key] = &[req("version", NUM), opt("ask", BOOL), opt("full", BOOL)];
// `state`: a whole `RoomState` (src/room/state.ts). `votes`, `ready`, `chosen` and `recent` are left out of the JSON
// when undefined, so they are optional. `game` is always there, null outside a game.
const STATE: &[Key] = &[
    req("code", STR),
    req("version", NUM),
    req("phase", STR),
    req("players", ARR),
    opt("votes", OBJ),
    opt("ready", ARR),
    opt("chosen", OBJ),
    req("game", OBJ | NULL),
    opt("recent", ARR),
];
// `patch`: `{from, to, f, p}` (`StatePatch` in session.ts). `p` is null when the two states are equal.
const PATCH: &[Key] = &[req("from", NUM), req("to", NUM), req("f", STR), req("p", OBJ | NULL)];
// `act`: `{nonce, action}` (`Envelope` in session.ts).
const ACT: &[Key] = &[req("nonce", STR), req("action", OBJ)];

fn keys(kind: u8) -> Option<&'static [Key]> {
    match kind {
        KIND_HELLO => Some(HELLO),
        KIND_STATE => Some(STATE),
        KIND_PATCH => Some(PATCH),
        KIND_ACT => Some(ACT),
        _ => None,
    }
}

/// The most bytes of payload a kind may carry. A state and a patch are also bounded by the frame, which is 16,384
/// bytes in all, header included.
pub fn cap(kind: u8) -> Option<usize> {
    match kind {
        KIND_HELLO => Some(512),
        KIND_STATE | KIND_PATCH => Some(16_384),
        KIND_ACT => Some(1_024),
        _ => None,
    }
}

/// The most JSON tokens (every value and every key) a kind may carry. A real state is about a thousand; the size cap
/// alone would allow about 8,000, so this is what stops a payload made of nothing but tiny values.
fn max_tokens(kind: u8) -> usize {
    match kind {
        KIND_HELLO => 32,
        KIND_ACT => 256,
        _ => 4_096,
    }
}

/// True when `payload` is acceptable as a table message of this kind.
pub fn check(kind: u8, payload: &[u8]) -> bool {
    let (Some(keys), Some(cap)) = (keys(kind), cap(kind)) else { return false };
    if payload.len() > cap || payload.first() != Some(&b'{') || payload.last() != Some(&b'}') || std::str::from_utf8(payload).is_err() {
        return false;
    }
    let mut s = Scan { b: payload, i: 1, tokens: 1, max_tokens: max_tokens(kind) };
    let mut seen = vec![false; keys.len()];
    let ok = s.members(1, &mut |raw, ty| {
        // A key with an escape in it is refused: a lenient parser reads "vers\u0069on" as "version", so the same key
        // could be present twice without this check noticing.
        let Some(at) = keys.iter().position(|k| k.name.as_bytes() == raw) else { return false };
        if seen[at] || keys[at].types & ty == 0 {
            return false;
        }
        seen[at] = true;
        true
    });
    ok.is_some() && s.i == payload.len() && keys.iter().zip(&seen).all(|(k, s)| *s || !k.required)
}

struct Scan<'a> {
    b: &'a [u8],
    i: usize,
    tokens: usize,
    max_tokens: usize,
}

impl Scan<'_> {
    fn peek(&self) -> Option<u8> {
        self.b.get(self.i).copied()
    }

    fn ws(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\t' | b'\n' | b'\r')) {
            self.i += 1;
        }
    }

    fn token(&mut self) -> Option<()> {
        self.tokens += 1;
        (self.tokens <= self.max_tokens).then_some(())
    }

    fn lit(&mut self, word: &[u8]) -> Option<()> {
        if self.b[self.i..].starts_with(word) {
            self.i += word.len();
            Some(())
        } else {
            None
        }
    }

    fn eat(&mut self, c: u8) -> Option<()> {
        (self.peek()? == c).then(|| self.i += 1)
    }

    /// Any value; returns its type bit. `depth` is the nesting of the container it sits in.
    fn value(&mut self, depth: usize) -> Option<u8> {
        self.token()?;
        match self.peek()? {
            b'"' => self.string().map(|_| STR),
            b'{' => {
                if depth + 1 > MAX_DEPTH {
                    return None;
                }
                self.i += 1;
                self.members(depth + 1, &mut |_, _| true)?;
                Some(OBJ)
            }
            b'[' => {
                if depth + 1 > MAX_DEPTH {
                    return None;
                }
                self.i += 1;
                self.ws();
                if self.peek()? == b']' {
                    self.i += 1;
                    return Some(ARR);
                }
                loop {
                    self.ws();
                    self.value(depth + 1)?;
                    self.ws();
                    match self.peek()? {
                        b',' => self.i += 1,
                        b']' => {
                            self.i += 1;
                            return Some(ARR);
                        }
                        _ => return None,
                    }
                }
            }
            b't' => self.lit(b"true").map(|_| BOOL),
            b'f' => self.lit(b"false").map(|_| BOOL),
            b'n' => self.lit(b"null").map(|_| NULL),
            b'-' | b'0'..=b'9' => self.number().map(|_| NUM),
            _ => None,
        }
    }

    /// The members of an object whose `{` is already read, up to and including its `}`. `on_key` gets each key's raw
    /// bytes (between the quotes, escapes not decoded) and the type of its value, and says whether to go on.
    fn members(&mut self, depth: usize, on_key: &mut dyn FnMut(&[u8], u8) -> bool) -> Option<()> {
        self.ws();
        if self.peek()? == b'}' {
            self.i += 1;
            return Some(());
        }
        loop {
            self.ws();
            self.token()?;
            let (a, z) = self.string()?;
            self.ws();
            self.eat(b':')?;
            self.ws();
            let ty = self.value(depth)?;
            if !on_key(&self.b[a..z], ty) {
                return None;
            }
            self.ws();
            match self.peek()? {
                b',' => self.i += 1,
                b'}' => {
                    self.i += 1;
                    return Some(());
                }
                _ => return None,
            }
        }
    }

    /// A string starting at its opening quote; returns the range between the quotes. Control characters and unknown
    /// escapes are refused as in the JSON grammar; the UTF-8 was checked for the whole payload before.
    fn string(&mut self) -> Option<(usize, usize)> {
        self.eat(b'"')?;
        let start = self.i;
        loop {
            match self.peek()? {
                b'"' => {
                    self.i += 1;
                    return Some((start, self.i - 1));
                }
                b'\\' => {
                    self.i += 1;
                    match self.peek()? {
                        b'"' | b'\\' | b'/' | b'b' | b'f' | b'n' | b'r' | b't' => self.i += 1,
                        b'u' => {
                            let hex = self.b.get(self.i + 1..self.i + 5)?;
                            if !hex.iter().all(u8::is_ascii_hexdigit) {
                                return None;
                            }
                            self.i += 5;
                        }
                        _ => return None,
                    }
                }
                0..=0x1f => return None,
                _ => self.i += 1,
            }
        }
    }

    /// `-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?`
    fn number(&mut self) -> Option<()> {
        let start = self.i;
        let digits = |s: &mut Self| {
            let from = s.i;
            while s.peek().is_some_and(|c| c.is_ascii_digit()) {
                s.i += 1;
            }
            s.i > from
        };
        self.eat(b'-').or(Some(()))?;
        match self.peek()? {
            b'0' => self.i += 1,
            b'1'..=b'9' => {
                digits(self);
            }
            _ => return None,
        }
        if self.peek() == Some(b'.') {
            self.i += 1;
            digits(self).then_some(())?;
        }
        if matches!(self.peek(), Some(b'e' | b'E')) {
            self.i += 1;
            if matches!(self.peek(), Some(b'+' | b'-')) {
                self.i += 1;
            }
            digits(self).then_some(())?;
        }
        (self.i - start <= MAX_NUMBER_LEN).then_some(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ok(kind: u8, s: &str) -> bool {
        check(kind, s.as_bytes())
    }

    const STATE_OK: &str = r#"{"code":"K7Q2M","version":3,"phase":"lobby","players":[{"id":"a","name":"Turi","seat":0}],"game":null}"#;

    #[test]
    fn hello_shape() {
        assert!(ok(1, r#"{"version":0}"#));
        assert!(ok(1, r#"{"version":12,"ask":true}"#));
        assert!(ok(1, r#"{"version":12,"ask":false,"full":true}"#));
        assert!(!ok(1, "{}"), "version is required");
        assert!(!ok(1, r#"{"version":"1"}"#), "version is a number");
        assert!(!ok(1, r#"{"version":1,"ask":1}"#), "ask is a boolean");
        assert!(!ok(1, r#"{"version":1,"ask":null}"#), "optional keys are absent, not null");
        assert!(!ok(1, r#"{"version":1,"p":2}"#), "the old p key is gone");
        assert!(!ok(1, r#"{"id":"x","name":"y","version":1}"#), "id and name now come from the roster");
        assert!(!ok(1, r#"{"version":1,"version":2}"#), "duplicate key");
        assert!(!ok(1, r#"{"version":1,"extra":{}}"#), "unknown key");
        assert!(!ok(1, &format!(r#"{{"version":1,"ask":true,"pad":"{}"}}"#, "x".repeat(600))), "over 512 bytes");
    }

    #[test]
    fn state_shape() {
        assert!(ok(2, STATE_OK));
        assert!(ok(2, r#"{"code":"K7Q2M","version":3,"phase":"playing","players":[],"game":{"seed":1},"votes":{"a":["x"]},"ready":["a"],"chosen":{"sheet":"s"},"recent":["n1"]}"#));
        assert!(!ok(2, &STATE_OK.replace(r#""code":"K7Q2M","#, "")), "code missing");
        assert!(!ok(2, &STATE_OK.replace(r#""game":null"#, r#""gamer":null"#)), "game missing and an unknown key");
        assert!(!ok(2, &STATE_OK.replace(r#""game":null"#, r#""game":1"#)), "game is an object or null");
        assert!(!ok(2, &STATE_OK.replace(r#""version":3"#, r#""version":"3""#)));
        assert!(!ok(2, &STATE_OK.replace(r#""players":[{"id":"a","name":"Turi","seat":0}]"#, r#""players":{}"#)), "players is an array");
        assert!(!ok(2, &STATE_OK.replace(r#""code":"K7Q2M""#, r#""code":5"#)));
        assert!(!ok(2, &STATE_OK.replace("}", r#","votes":[]}"#)), "votes is an object");
        assert!(!ok(2, &STATE_OK.replace("}", r#","ready":{}}"#)), "ready is an array");
        assert!(!ok(2, &STATE_OK.replace("}", r#","chosen":null}"#)), "chosen is an object, never null");
        assert!(!ok(2, &STATE_OK.replace("}", r#","chat":"hi"}"#)), "a key the game does not have");
    }

    #[test]
    fn patch_and_act_shape() {
        assert!(ok(3, r#"{"from":3,"to":4,"f":"1a2b","p":{"o":{"version":{"v":4}}}}"#));
        assert!(ok(3, r#"{"from":3,"to":4,"f":"1a2b","p":null}"#));
        assert!(!ok(3, r#"{"from":3,"to":4,"f":"1a2b"}"#), "p is required");
        assert!(!ok(3, r#"{"from":3,"to":4,"f":7,"p":null}"#));
        assert!(!ok(3, r#"{"from":"3","to":4,"f":"x","p":null}"#));
        assert!(!ok(3, r#"{"from":3,"to":4,"f":"x","p":[]}"#), "p is an object or null");
        assert!(ok(4, r#"{"nonce":"abc123def","action":{"type":"vote","id":"a","sheets":["x"]}}"#));
        assert!(!ok(4, r#"{"nonce":"abc123def"}"#));
        assert!(!ok(4, r#"{"nonce":"abc","action":"vote"}"#), "action is an object");
        assert!(!ok(4, r#"{"nonce":1,"action":{}}"#));
        assert!(!ok(4, r#"{"nonce":"a","action":{},"x":1}"#));
        assert!(!ok(4, &format!(r#"{{"nonce":"a","action":{{"pad":"{}"}}}}"#, "x".repeat(1100))), "over 1 KiB");
        assert!(!ok(0, "{}") && !ok(5, "{}"), "no such kind");
    }

    #[test]
    fn json_grammar_is_strict() {
        for bad in [
            r#"{"version":01}"#, r#"{"version":1.}"#, r#"{"version":.5}"#, r#"{"version":+1}"#, r#"{"version":1e}"#, r#"{"version":-}"#,
            r#"{"version":0x10}"#, r#"{"version":NaN}"#, r#"{"version":1,}"#, r#"{,"version":1}"#, r#"{"version":1"#, r#"{"version" 1}"#,
            r#"{'version':1}"#, r#"{version:1}"#, r#"{"version":1}x"#, r#"{"version":1}{"#, "{\"version\":1}\n", " {\"version\":1}",
            r#"{"version":tru}"#, r#"{"version":nul}"#, "{\"version\":\"a\nb\"}", r#"{"version":1,"ask":"\x"}"#, r#"{"version":1,"ask":"\u12"}"#,
            r#"{"version":1,"ask":"\uzzzz"}"#,
        ] {
            assert!(!ok(1, bad), "{bad:?}");
        }
        assert!(ok(1, "{ \"version\" :\n 1 ,\t\"ask\" : true }"), "whitespace between tokens is allowed");
        assert!(ok(1, r#"{"version":-1.5e+3}"#) && ok(1, r#"{"version":0}"#) && ok(1, r#"{"version":10e2}"#));
        assert!(!ok(1, &format!(r#"{{"version":{}}}"#, "1".repeat(41))), "a number of 41 characters");
        assert!(ok(1, &format!(r#"{{"version":{}}}"#, "1".repeat(40))));
    }

    #[test]
    fn escaped_keys_are_refused() {
        assert!(!ok(1, r#"{"vers\u0069on":1}"#), "an escaped spelling of a known key");
        assert!(!ok(1, r#"{"version":1,"vers\u0069on":2}"#), "would be a duplicate to a lenient parser");
        assert!(!ok(1, r#"{"version":1,"as\k":true}"#));
    }

    #[test]
    fn strings_with_escapes_and_unicode_pass() {
        assert!(ok(2, r#"{"code":"a\"b\\c\/d\n\u00e8\ud83d\ude00","version":1,"phase":"è😀","players":[],"game":null}"#));
        assert!(ok(2, r#"{"code":"\ud83d","version":1,"phase":"p","players":[],"game":null}"#), "a lone surrogate escape is legal JSON");
    }

    #[test]
    fn utf8_is_checked() {
        let mut b = br#"{"nonce":"a","action":{"n":""#.to_vec();
        b.extend_from_slice(&[0xff, 0xfe]);
        b.extend_from_slice(br#""}}"#);
        assert!(!check(4, &b), "invalid UTF-8 inside a string");
        let mut b = br#"{"nonce":"a","action":{"n":""#.to_vec();
        b.extend_from_slice(&[0xc3]); // a truncated two byte sequence
        b.extend_from_slice(br#""}}"#);
        assert!(!check(4, &b));
        assert!(!check(1, &[]), "empty");
        assert!(!check(1, b"{"), "one byte");
    }

    #[test]
    fn depth_is_bounded() {
        // the root is depth 1 and `action` is depth 2, so `d` objects in all make `d` levels
        let nest = |d: usize| format!(r#"{{"nonce":"a","action":{}{}{}}}"#, r#"{"a":"#.repeat(d - 1), "1", "}".repeat(d - 1));
        assert!(ok(4, &nest(32)), "32 deep");
        assert!(!ok(4, &nest(33)), "33 deep");
        let arrays = format!(r#"{{"nonce":"a","action":{{"a":{}{}}}}}"#, "[".repeat(40), "]".repeat(40));
        assert!(!ok(4, &arrays));
        // a hostile unbalanced run neither overflows the stack nor takes long
        let hostile = format!(r#"{{"nonce":"a","action":{{"a":{}"#, "[".repeat(1000));
        assert!(!ok(4, &hostile));
        let deep = format!(r#"{{"code":"x","version":1,"phase":"p","players":{},"game":null}}"#, "[".repeat(8_000) + &"]".repeat(8_000));
        assert!(!ok(2, &deep));
    }

    #[test]
    fn tokens_are_bounded() {
        // 4096 tokens in all for a state: the root object, five keys and their values, then a long array
        let arr = |n: usize| format!(r#"{{"code":"x","version":1,"phase":"p","players":[{}],"game":null}}"#, vec!["1"; n].join(","));
        let fixed = 1 + 2 * 5; // root + five keys and their values, the array counted as one value
        assert!(ok(2, &arr(4096 - fixed - 1)));
        assert!(!ok(2, &arr(4096 - fixed + 2)));
        // hello is limited to 32
        assert!(!ok(1, &format!(r#"{{"version":1,"ask":true,"full":false,"x":[{}]}}"#, vec!["1"; 40].join(","))));
        // many empty objects in an array, a cheap shape for a scanner that does not count
        let objs = format!(r#"{{"nonce":"a","action":{{"a":[{}]}}}}"#, vec!["{}"; 300].join(","));
        assert!(!ok(4, &objs));
    }

    #[test]
    fn a_real_sized_state_passes() {
        let events: Vec<String> = (0..60).map(|i| format!(r#"{{"t":"play","who":"3f2a9c1e-8b7d-4c2a-9e11-5d6f7a8b9c0d","card":"card-{i}","stat":"code","delta":{i}}}"#)).collect();
        let s = format!(
            r#"{{"code":"K7Q2M","version":48,"phase":"playing","players":[{{"id":"3f2a9c1e-8b7d-4c2a-9e11-5d6f7a8b9c0d","name":"Turi","seat":0}}],"game":{{"seed":123456,"events":[{}],"deck":[{}]}},"recent":["a","b"]}}"#,
            events.join(","),
            (0..80).map(|i| format!("\"c{i}\"")).collect::<Vec<_>>().join(",")
        );
        assert!(s.len() > 5_000 && s.len() < 16_384, "{}", s.len());
        assert!(ok(2, &s));
        assert!(!check(2, &[s.as_bytes(), &vec![b' '; 16_384][..]].concat()[..]), "over the cap");
    }

    #[test]
    fn what_a_scanner_could_trip_on() {
        // a quote or brace inside a string does not end anything
        assert!(ok(4, r#"{"nonce":"}{\"]","action":{"x":"}"}}"#));
        // a key that only looks like another
        assert!(!ok(4, r#"{"nonce ":"a","action":{}}"#));
        assert!(!ok(4, r#"{"Nonce":"a","action":{}}"#), "keys are case sensitive");
        assert!(!ok(4, r#"{"nonce":"a","action":{}}garbage"#));
        assert!(!ok(4, r#"[{"nonce":"a","action":{}}]"#));
        assert!(!ok(4, r#"{"nonce":"a","action":{},"":1}"#), "the empty key");
    }
}
