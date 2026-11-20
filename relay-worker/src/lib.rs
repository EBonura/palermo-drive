//! Palermo Drive relay, protocol v2: see README.md. The rules live in `proto`, `interest` and `hub`, which have no
//! Worker types and are tested natively; `glue` is the thin Cloudflare layer around them.
pub mod hub;
pub mod interest;
pub mod proto;

#[cfg(target_arch = "wasm32")]
mod glue;
