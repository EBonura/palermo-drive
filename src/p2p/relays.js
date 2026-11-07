// The Nostr relays the peer to peer client uses to find other players (they carry the handshake and, for a pair whose direct connection does not open, the relay fallback).
// Pinned instead of Trystero's list of 29 volunteer hosts: the build's Content-Security-Policy allows exactly these (tools/build/build.mjs).
// Picked from the defaults because they answered a subscription in under a second from a home connection; revisit if one goes quiet.
// 7 Nov: nostr.stakey.net rate-limited test players at the game jam and refused 170 of 178 fallback events in tools/p2p/fbrelays.mjs; relay.grigic.org took its place (all 120 taken and delivered, 106 ms median).
export const RELAYS = ['nos.lol', 'nostr.chaima.info', 'nostr.christiansass.de', 'relay.grigic.org', 'relay.bitmacro.cloud'].map(h => 'wss://' + h);
// Three that accepted and stored the presence events (src/p2p/presence.js) when tried; a player uses two, picked at random (any two of three share one). nostr.christiansass.de replaced nostr.stakey.net (7 Nov).
export const PRESENCE_RELAYS = ['nos.lol', 'nostr.christiansass.de', 'nostr.chaima.info'].map(h => 'wss://' + h);
// The relay fallback (src/p2p/fallback.js): everybody listens on both and writes to one. The two fastest that took and delivered every event of tools/p2p/fbrelays.mjs (3 a second from each of two keys on one address).
export const FALLBACK_RELAYS = ['nostr.chaima.info', 'nostr.christiansass.de'].map(h => 'wss://' + h);
