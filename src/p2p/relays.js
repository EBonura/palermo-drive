// The Nostr relays the peer to peer client uses to find other players (they only carry the handshake, never the game).
// Pinned instead of Trystero's list of 29 volunteer hosts: the build's Content-Security-Policy allows exactly these (tools/build/build.mjs).
// Picked from the defaults because they answered a subscription in under a second from a home connection; revisit if one goes quiet.
export const RELAYS = ['nos.lol', 'nostr.chaima.info', 'nostr.christiansass.de', 'nostr.stakey.net', 'relay.bitmacro.cloud'].map(h => 'wss://' + h);
