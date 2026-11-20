// TEST TOOLING ONLY. This is not the game's relay (that is relay-worker/, Rust, on Cloudflare). It is a small Node implementation of relay protocol v2
// (docs/ONLINE.md) that the tools in tools/online/ run against, so that the game client can be tested with no network and no deployed relay. It follows the
// document's "Who gets whom" rules, limits and frame layouts closely enough to test ENTER, LEAVE, the cap, thinning, the rate limits and the refusals. Where it
// and the real relay disagree, the real relay wins; run the main tests against both (tools/online/README in docs/ONLINE.md says how).
// No dependencies: the WebSocket server handshake and framing (RFC 6455, binary frames only, no extensions) are done on node:http.
//   node tools/online/relaysim.mjs [--port 8787]        a relay for a manual session
//   import { startRelaySim } from './relaysim.mjs'      { url, port, stats(), conns(), refuse(code), close() }
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const POS_UNITS = 20, POS_MID = 1 << 19, WORLD = 20000;
const MAX_FRAME = 96, MAX_NAME_BYTES = 64;
const C = { HELLO: 1, INFO: 2, STATE: 3, SAY: 4, TO: 5 }, S = { WELCOME: 1, ENTER: 2, LEAVE: 3, STATE: 4, SAY: 5, TO: 6, ONLINE: 7 };
const bucketOf = (rate, burst) => ({ rate, burst, tokens: burst, t: Date.now() });
const take = (b, now = Date.now()) => { b.tokens = Math.min(b.burst, b.tokens + (now - b.t) * b.rate / 1000); b.t = now; if (b.tokens < 1) return false; b.tokens--; return true; };

export function startRelaySim({ port = 0, origins = [], maxConns = 300, perAddress = 24, k = 8, sayR = 400, frameDay = 800000, onlineGapMs = 10000, helloMs = 10000, idleMs = 60000 } = {}) {
  const conns = new Map();   // handle -> connection
  const perIp = new Map(), frames = new Map();   // address -> live connections; address -> frames today
  const counters = { upgrades: 0, refused: 0, frames: 0, malformed: 0, dropped: 0, rateDropped: 0, forwarded: 0, closed: 0 };
  let refuseCode = 0, nextHandle = 1 + Math.floor(Math.random() * 1000);

  // the real relay counts an IPv6 client by its /64 (relay-worker/src/proto.rs address_key): one device owns the whole block
  const addressKey = s => { const v = String(s).replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, '$1'); if (!v.includes(':')) return v; const [head, tail = ''] = v.split('::'), a = head.split(':').filter(Boolean), t = tail.split(':').filter(Boolean); const full = [...a, ...Array(Math.max(0, 8 - a.length - t.length)).fill('0'), ...t]; return full.slice(0, 4).map(g => parseInt(g || '0', 16).toString(16)).join(':') + '::/64'; };
  const allowed = o => typeof o === 'string' && (origins.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
  const server = http.createServer((req, res) => {
    if (req.url === '/stats') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ...counters, connected: conns.size })); return; }
    res.writeHead(404); res.end();
  });
  server.on('upgrade', (req, sock) => {
    const refuse = (code, why) => { counters.refused++; sock.end(`HTTP/1.1 ${code} ${why}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); };
    if (!req.url.startsWith('/r') || req.url.length > 2 && req.url[2] !== '?') return refuse(404, 'Not Found');
    if (!allowed(req.headers.origin)) return refuse(403, 'Forbidden');
    if (refuseCode) return refuse(refuseCode, 'Unavailable');
    const key = req.headers['sec-websocket-key']; if (!key) return refuse(400, 'Bad Request');
    const ip = addressKey(req.headers['cf-connecting-ip'] || req.socket.remoteAddress);
    if ((frames.get(ip) || 0) >= frameDay) return refuse(429, 'Too Many Requests');
    if (conns.size >= maxConns) return refuse(503, 'Unavailable');
    if ((perIp.get(ip) || 0) >= perAddress) return refuse(429, 'Too Many Requests');
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')}\r\n\r\n`);
    counters.upgrades++; perIp.set(ip, (perIp.get(ip) || 0) + 1);
    accept(sock, ip);
  });

  // ---------- one connection ----------
  function accept(sock, ip) {
    let handle = nextHandle; while (conns.has(handle) || handle === 0) handle = handle % 65535 + 1; nextHandle = handle % 65535 + 1;
    const c = { handle, sock, ip, hello: false, info: null, x: NaN, z: NaN, posT: 0, set: new Set(), recomputed: -1e9, fwd: new Map(), lastFrame: Date.now(), bad: 0, told: 0, toldAt: 0, closed: false,
      all: bucketOf(12, 30), say: bucketOf(1, 3), to: bucketOf(2, 6), infoT: -1e9 };
    conns.set(handle, c);
    let buf = Buffer.alloc(0);
    sock.on('data', d => { buf = Buffer.concat([buf, d]); for (;;) { const f = readFrame(buf); if (!f) break; buf = buf.subarray(f.used); if (!onWs(c, f)) return; } if (buf.length > 4096) kill(c, 1009); });
    sock.on('close', () => drop(c)); sock.on('error', () => drop(c));
    c.helloTimer = setTimeout(() => { if (!c.hello) kill(c, 1008); }, helloMs);
    c.idleTimer = setInterval(() => { if (Date.now() - c.lastFrame > idleMs) kill(c, 1001); }, Math.max(50, Math.min(5000, idleMs / 4)));
  }
  function readFrame(b) {   // one client frame (always masked), or null until the rest has come
    if (b.length < 2) return null;
    const op = b[0] & 15, masked = !!(b[1] & 128); let len = b[1] & 127, o = 2;
    if (len === 126) { if (b.length < 4) return null; len = b.readUInt16BE(2); o = 4; } else if (len === 127) { if (b.length < 10) return null; len = Number(b.readBigUInt64BE(2)); o = 10; }
    if (len > 1 << 20) return { op: 8, payload: Buffer.alloc(0), used: b.length, huge: true };
    if (b.length < o + (masked ? 4 : 0) + len) return null;
    const mask = masked ? b.subarray(o, o + 4) : null; if (masked) o += 4;
    const payload = Buffer.from(b.subarray(o, o + len)); if (mask) for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
    return { op, payload, used: o + len, fin: !!(b[0] & 128) };
  }
  const wsFrame = (op, payload) => { const n = payload.length, h = n < 126 ? Buffer.from([128 | op, n]) : Buffer.from([128 | op, 126, n >> 8, n & 255]); return Buffer.concat([h, payload]); };
  const raw = (c, bytes) => { if (!c.closed && c.sock.writable) c.sock.write(wsFrame(2, Buffer.from(bytes))); };
  function kill(c, code) {
    if (c.closed) return; counters.closed++;
    try { c.sock.write(wsFrame(8, Buffer.from([code >> 8, code & 255]))); c.sock.end(); } catch (e) { /* gone */ }
    drop(c);
  }
  function drop(c) {
    if (c.closed) return; c.closed = true; clearTimeout(c.helloTimer); clearInterval(c.idleTimer);
    conns.delete(c.handle); perIp.set(c.ip, Math.max(0, (perIp.get(c.ip) || 1) - 1));
    for (const r of conns.values()) if (r.set.delete(c.handle)) { send(r, Buffer.from([S.LEAVE, c.handle & 255, c.handle >> 8])); recompute(r); }   // a member of its set went: at once
    for (const r of conns.values()) r.fwd.delete(c.handle);
  }
  // every frame to a client goes through here: ONLINE is added at most once per onlineGapMs, never on a timer
  function send(c, bytes) {
    raw(c, bytes); const now = Date.now();
    if (conns.size !== c.told && now - c.toldAt >= onlineGapMs) { c.told = conns.size; c.toldAt = now; raw(c, [S.ONLINE, conns.size & 255, conns.size >> 8]); }
  }
  function onWs(c, f) {
    if (f.op === 8) { kill(c, 1000); return false; }
    if (f.op === 9) { c.sock.write(wsFrame(10, f.payload)); return true; }
    if (f.op === 1) { kill(c, 1003); return false; }   // the protocol has no text frames
    if (f.op === 10) return true;
    if (f.op !== 2 || !f.fin) return true;
    c.lastFrame = Date.now();
    if (f.payload.length > MAX_FRAME) { kill(c, 1009); return false; }
    const day = (frames.get(c.ip) || 0) + 1; frames.set(c.ip, day); counters.frames++;
    if (day > frameDay) { counters.dropped++; kill(c, 1008); return false; }   // closed, as the real relay does: a dropped frame is still billed
    if (!take(c.all)) { counters.rateDropped++; return true; }
    const ok = frame(c, new Uint8Array(f.payload));
    if (ok === false) { counters.malformed++; if (++c.bad >= 20) { kill(c, 1008); return false; } }
    return !c.closed;
  }

  // ---------- frames ----------
  const infoOk = (b, o) => b.length - o >= 3 && b[o + 2] <= MAX_NAME_BYTES && b.length === o + 3 + b[o + 2];
  const readPos = (b, o) => { const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), lo = dv.getUint32(o, true); return [((lo & 0xfffff) - POS_MID) / POS_UNITS, (((lo >>> 20) | (b[o + 4] << 12)) - POS_MID) / POS_UNITS]; };
  function frame(c, b) {   // false: malformed
    if (!c.hello) {
      if (b[0] !== C.HELLO) return false;
      if (b.length < 2 || b[1] !== 2 || !infoOk(b, 2)) { kill(c, 1008); return true; }
      c.hello = true; c.info = b.slice(2); clearTimeout(c.helloTimer);
      raw(c, [S.WELCOME, 2, c.handle & 255, c.handle >> 8, conns.size & 255, conns.size >> 8]); c.told = conns.size; c.toldAt = Date.now();
      return true;
    }
    switch (b[0]) {
      case C.HELLO: kill(c, 1008); return true;
      case C.INFO: {
        if (!infoOk(b, 1)) return false;
        const now = Date.now(); if (now - c.infoT < 2000) { counters.rateDropped++; return true; } c.infoT = now;
        c.info = b.slice(1);
        for (const r of conns.values()) if (r.set.has(c.handle)) send(r, enter(c));
        return true;
      }
      case C.STATE: {
        if (b.length !== 19 && b.length !== 21) return false;
        if (b.length === 21 !== !!(b[15] & 8)) return false;   // [3] then the 18 byte body: flags are at 15; the height flag (8) says the two extra bytes follow
        if (b[15] & 0xf0) return false;
        const [x, z] = readPos(b, 3); if (!(Math.abs(x) < WORLD && Math.abs(z) < WORLD)) return false;
        const now = Date.now(); c.x = x; c.z = z; c.posT = now; c.lastState = Buffer.from(b.subarray(1));
        if (now - c.recomputed >= 1000) recompute(c);
        for (const r of conns.values()) {
          if (!r.set.has(c.handle)) continue;
          const d = Math.hypot(r.x - x, r.z - z), gap = d < 150 ? 0 : d < 350 ? 195 : d < 1200 ? 995 : 2495;
          if (gap && now - (c.fwd.get(r.handle) || 0) < gap) continue;
          c.fwd.set(r.handle, now); counters.forwarded++;
          send(r, Buffer.concat([Buffer.from([S.STATE, c.handle & 255, c.handle >> 8]), b.subarray(1)]));
        }
        return true;
      }
      case C.SAY: {
        if (b.length !== 2) return false;
        if (!take(c.say)) { counters.rateDropped++; return true; }
        for (const r of conns.values()) if (r.set.has(c.handle) && Math.hypot(r.x - c.x, r.z - c.z) <= sayR) send(r, Buffer.from([S.SAY, c.handle & 255, c.handle >> 8, b[1]]));
        return true;
      }
      case C.TO: {
        if (b.length < 4 || b.length > 11) return false;
        if (!take(c.to)) { counters.rateDropped++; return true; }
        const t = conns.get(b[1] | (b[2] << 8));
        if (t && t.set.has(c.handle)) send(t, Buffer.concat([Buffer.from([S.TO, c.handle & 255, c.handle >> 8]), b.subarray(3)]));
        return true;
      }
      default: return false;
    }
  }
  const enter = c => Buffer.concat([Buffer.from([S.ENTER, c.handle & 255, c.handle >> 8]), c.info]);
  // R's set: the k nearest by last position. A player outside replaces the farthest inside only if it is at least 30 m nearer.
  function recompute(r) {
    r.recomputed = Date.now(); if (!Number.isFinite(r.x)) return;
    const d = o => Math.hypot(o.x - r.x, o.z - r.z);
    const others = [...conns.values()].filter(o => o !== r && o.hello && Number.isFinite(o.x)).sort((a, b) => d(a) - d(b));
    const inside = others.filter(o => r.set.has(o.handle)), outside = others.filter(o => !r.set.has(o.handle));
    const next = new Set(inside.map(o => o.handle));
    while (next.size < k && outside.length) next.add(outside.shift().handle);
    for (const o of outside) {
      let far = null; for (const h of next) { const m = conns.get(h); if (!far || d(m) > d(far)) far = m; }
      if (far && d(far) - d(o) >= 30) { next.delete(far.handle); next.add(o.handle); } else break;
    }
    for (const h of r.set) if (!next.has(h)) { send(r, Buffer.from([S.LEAVE, h & 255, h >> 8])); }
    for (const h of next) if (!r.set.has(h)) { const o = conns.get(h); send(r, enter(o)); if (o.lastState) send(r, Buffer.concat([Buffer.from([S.STATE, h & 255, h >> 8]), o.lastState])); }   // a newcomer to the set arrives with its latest state
    r.set = next;
  }

  return new Promise(res => server.listen(port, '127.0.0.1', () => {
    const p = server.address().port;
    res({ port: p, url: `ws://127.0.0.1:${p}/r`, stats: () => ({ ...counters, connected: conns.size }), conns: () => [...conns.values()].map(c => ({ handle: c.handle, x: c.x, z: c.z, set: [...c.set] })),
      refuse: code => { refuseCode = code; },   // 503 and friends: the relay is full or over its daily allowance
      dropAll: () => { for (const c of [...conns.values()]) kill(c, 1001); },
      close: () => new Promise(r => { for (const c of [...conns.values()]) { try { c.sock.destroy(); } catch (e) { /* gone */ } drop(c); } server.close(() => r()); server.closeAllConnections?.(); }) });
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port'), sim = await startRelaySim({ port: i > 0 ? +process.argv[i + 1] : 8787, perAddress: 100 });
  console.log('relay simulator (test tooling) on', sim.url);
}
