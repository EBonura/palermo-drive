// Does a relay compress its WebSocket frames (permessage-deflate)? Offers the extension the way every browser does and prints what the relay answers. One upgrade request, no frames, closed at once.
//   node tools/online/extensions.mjs [--url wss://pd-relay.bonniestudios.workers.dev/r] [--origin https://palermo-drive.it]       (default: the local `wrangler dev` of relay-worker/)
// The relay is meant to answer with no extension: a 21 byte state compresses by about 7 % at 90 microseconds of CPU a frame (docs/ONLINE-CROWD.md), and the relay sends 30 or more of them for every one it takes in.
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const u = new URL(arg('url', 'ws://127.0.0.1:8799/r')), origin = arg('origin', 'http://127.0.0.1:1');
const req = (u.protocol === 'wss:' ? https : http).request({ host: u.hostname, port: u.port || (u.protocol === 'wss:' ? 443 : 80), path: u.pathname, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), Origin: origin, 'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits' } });
req.on('upgrade', (res, sock) => { const e = res.headers['sec-websocket-extensions'] || null; console.log(e ? `COMPRESSING: the relay answered "${e}"` : 'not compressing: no extension in the answer'); sock.destroy(); process.exit(e ? 1 : 0); });
req.on('response', r => { console.log('refused: HTTP ' + r.statusCode); process.exit(2); });
req.on('error', e => { console.log('error: ' + e.message); process.exit(2); });
req.end(); setTimeout(() => { console.log('timeout'); process.exit(2); }, 8000);
