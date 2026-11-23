//! Palermo Drive relay, protocol v2, and the tables protocol for BLATERO: see README.md. The rules live in `proto`,
//! `interest` and `hub` (Palermo Drive's room) and in `tproto`, `shape` and `tables` (tables), which have no Worker
//! types and are tested natively; `glue` and `tglue` are the thin Cloudflare layer around them.
pub mod hub;
pub mod interest;
pub mod proto;
pub mod save;
pub mod shape;
pub mod tables;
pub mod tproto;
pub mod status;

#[cfg(target_arch = "wasm32")]
mod glue;
#[cfg(target_arch = "wasm32")]
mod sglue;
#[cfg(target_arch = "wasm32")]
mod tglue;
