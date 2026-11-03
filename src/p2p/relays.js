// The Nostr relays the peer to peer client uses to find other players (they only carry the handshake, never the game).
// Pinned instead of Trystero's list of 29 volunteer hosts: the build's Content-Security-Policy allows exactly these (tools/build/build.mjs).
// Picked from the defaults because they answered a subscription in under a second from a home connection; revisit if one goes quiet.
export const RELAYS = ['nos.lol', 'nostr.chaima.info', 'nostr.christiansass.de', 'nostr.stakey.net', 'relay.bitmacro.cloud'].map(h => 'wss://' + h);
// The three of them that accepted and stored the presence events (src/p2p/presence.js) when tried; a player uses two, picked at random (any two of three share one).
export const PRESENCE_RELAYS = ['nos.lol', 'nostr.stakey.net', 'nostr.chaima.info'].map(h => 'wss://' + h);
