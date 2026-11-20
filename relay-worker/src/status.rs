//! What `GET /status` answers, as plain functions with no Worker types so they are tested natively. A browser cannot read why a
//! WebSocket upgrade failed (no status, no body), so the game asks this small route after a failed connect and tells the player why.
//! The answers are always 200 JSON with CORS, so that the browser can read them; the reason is in the body.
use crate::proto::origin_allowed;

/// The object answered. `budget` is the asking address having used its frames for today, `full` is every place taken.
pub fn status_body(online: u16, max: usize, full: bool, budget: bool) -> String {
    if budget {
        r#"{"ok":false,"why":"budget"}"#.to_string()
    } else if full {
        format!(r#"{{"ok":false,"why":"full","online":{online},"max":{max}}}"#)
    } else {
        format!(r#"{{"ok":true,"online":{online},"max":{max}}}"#)
    }
}

/// The call to the object failed. Cloudflare documents only that further operations "will fail with an error" once a free daily
/// limit is used (the messages people report read "Exceeded allowed volume of requests in Durable Objects free tier", "Exceeded
/// allowed duration ..." and so on), so a message that talks about exceeding something, a limit, a quota or the free tier is
/// the daily allowance, and anything else is an error we do not name.
pub fn failure_body(message: &str) -> String {
    let m = message.to_ascii_lowercase();
    let quota = ["exceeded allowed", "free tier", "daily limit", "quota", "limit exceeded"].iter().any(|k| m.contains(k));
    format!(r#"{{"ok":false,"why":"{}"}}"#, if quota { "quota" } else { "error" })
}

/// The value for Access-Control-Allow-Origin: the caller's own origin if it may talk to us (the same rule as the socket), else none.
pub fn cors_origin<'a>(origin: Option<&'a str>, allowed: &str) -> Option<&'a str> {
    origin.filter(|o| origin_allowed(Some(o), allowed))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers() {
        assert_eq!(status_body(5, 300, false, false), r#"{"ok":true,"online":5,"max":300}"#);
        assert_eq!(status_body(300, 300, true, false), r#"{"ok":false,"why":"full","online":300,"max":300}"#);
        assert_eq!(status_body(300, 300, true, true), r#"{"ok":false,"why":"budget"}"#, "the address's own budget is the more useful thing to say");
    }

    #[test]
    fn a_failure_is_quota_only_when_the_message_says_a_limit() {
        assert_eq!(failure_body("Exceeded allowed volume of requests in Durable Objects free tier."), r#"{"ok":false,"why":"quota"}"#);
        assert_eq!(failure_body("Error: Exceeded allowed duration in Durable Objects free tier"), r#"{"ok":false,"why":"quota"}"#);
        assert_eq!(failure_body("Durable Object reset because its code was updated"), r#"{"ok":false,"why":"error"}"#);
        assert_eq!(failure_body(""), r#"{"ok":false,"why":"error"}"#);
    }

    #[test]
    fn cors_follows_the_socket_rule() {
        let list = "https://palermo-drive.it";
        assert_eq!(cors_origin(Some("https://palermo-drive.it"), list), Some("https://palermo-drive.it"));
        assert_eq!(cors_origin(Some("http://localhost:8080"), list), Some("http://localhost:8080"));
        assert_eq!(cors_origin(Some("http://127.0.0.1:1"), list), Some("http://127.0.0.1:1"));
        assert_eq!(cors_origin(Some("https://evil.example"), list), None);
        assert_eq!(cors_origin(None, list), None);
    }
}
