//! The relay's rules (proto, interest, hub: included from ../../src, so they are the real ones) and a crowd of
//! simulated players to run them with. See `sim`.
#![allow(dead_code)]
#[path = "../../src/proto.rs"]
pub mod proto;
#[path = "../../src/interest.rs"]
pub mod interest;
#[path = "../../src/hub.rs"]
pub mod hub;
pub mod sim;
