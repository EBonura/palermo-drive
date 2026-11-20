// Where online play connects (src/online/online.js, docs/ONLINE.md): the address of the game's relay, for example 'wss://relay.example.workers.dev/r'.
// EMPTY means the game never opens a connection: "Gioca online" is on the card and in Options, but nobody is ever there. Filling it in also adds this address's origin to the page's
// Content-Security-Policy (tools/build/build.mjs reads this same constant), and it is the only host the page may talk to for the game.
// A test may point a page served from localhost or 127.0.0.1 at another relay with ?relay=ws://127.0.0.1:8787/r (the build needs --test-relay for the policy to allow it).
export const RELAY_URL = 'wss://pd-relay.bonniestudios.workers.dev/r';
