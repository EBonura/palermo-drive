// A player without a game: a raw WebSocket client (node:http upgrade, masked binary frames) that speaks protocol v2 through src/online/wire.js, for tests that need a crowd, a misbehaving client
// or exact timing. It keeps what the relay told it: its handle, the players it was introduced to (enter / leave), the states it was sent.
//   const bot = await startBot(url, { name: 'Bot1', x: 100, z: 200 });   bot.state({ x, z }); bot.say(2); bot.to(handle, [4, 0, 1]); bot.close()
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import { IN, helloFrame, helloFrame2, infoFrame, packInfo, sayFrame, stateFrame, toFrame, parseFrame } from '../../src/online/wire.js';

export function startBot(url, { name = 'Bot', vehicle = 0, livery = 0, x = NaN, z = NaN, origin = 'http://127.0.0.1:1', hello = true, ip = null, onFrame = null, extensions = '', ver = 3, wantK = 0 } = {}) {   // ip: the address to be counted as (the CF-Connecting-IP header a Cloudflare worker reads); onFrame(payload, headerBytes, firstInChunk): take over reading frames; extensions: a Sec-WebSocket-Extensions offer (bot.extensions has the answer)
  const u = new URL(url), bot = { name, handle: 0, online: 0, entered: new Map(), left: [], states: new Map(), says: [], tos: [], bad: 0, closed: null, rx: 0, rxBytes: 0, txBytes: 0, tx: 0, x, z };
  return new Promise((resolve, reject) => {
    const req = (u.protocol === 'wss:' ? https : http).request({ host: u.hostname, port: u.port || (u.protocol === 'wss:' ? 443 : 80), path: u.pathname + u.search, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), Origin: origin, ...(ip ? { 'CF-Connecting-IP': ip } : {}), ...(extensions ? { 'Sec-WebSocket-Extensions': extensions } : {}) } });
    req.on('response', res => reject(new Error('refused ' + res.statusCode)));
    req.on('error', reject);
    req.on('upgrade', (res, sock) => {
      bot.extensions = res.headers['sec-websocket-extensions'] || '';
      let buf = Buffer.alloc(0);
      const raw = (op, payload) => {
        const n = payload.length, mask = crypto.randomBytes(4), head = n < 126 ? Buffer.from([128 | op, 128 | n]) : Buffer.from([128 | op, 128 | 126, n >> 8, n & 255]), body = Buffer.from(payload);
        for (let i = 0; i < n; i++) body[i] ^= mask[i & 3];
        sock.write(Buffer.concat([head, mask, body]));
      };
      const send = b => { if (sock.writable) { raw(2, b); bot.tx++; bot.txBytes += b.length; } };
      bot.send = send;   // any bytes, for the malformed ones
      bot.info = (n = name, v = vehicle, l = livery) => send(infoFrame(packInfo(v, l, n)));
      bot.state = s => { Object.assign(bot, { x: s.x ?? bot.x, z: s.z ?? bot.z }); send(stateFrame({ t: performance.now(), x: bot.x, z: bot.z, th: 0, v: 0, steer: 0, roll: 0, lean: 0, fl: 0, k: 0, a: 0, h: 0, ...s })); };
      bot.say = i => send(sayFrame(i));
      bot.to = (handle, direct) => send(toFrame(handle, Uint8Array.from(direct)));
      bot.close = () => new Promise(r => { if (bot.closed !== null) return r(); sock.once('close', r); try { raw(8, Buffer.from([3, 232])); } catch (e) { /* gone */ } setTimeout(() => sock.destroy(), 200); });
      sock.on('data', d => {
        buf = Buffer.concat([buf, d]); let first = true;
        for (;;) {   // frames from a relay are never masked
          if (buf.length < 2) break;
          const op = buf[0] & 15; let len = buf[1] & 127, o = 2;
          if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); o = 4; }
          if (buf.length < o + len) break;
          const payload = new Uint8Array(buf.subarray(o, o + len)); buf = buf.subarray(o + len);
          if (op === 8) { bot.closed = payload.length >= 2 ? (payload[0] << 8) | payload[1] : 1005; sock.end(); return; }
          if (op !== 2) continue;
          bot.rx++; bot.rxBytes += payload.length;
          if (onFrame) { if (payload[0] === 1 && (payload.length === 6 || payload.length === 7)) { bot.handle = payload[2] | (payload[3] << 8); bot.online = payload[4] | (payload[5] << 8); } onFrame(payload, o, first); first = false; continue; }   // a crowd tool (crowd.mjs) reads frames itself: parsing every one in Node would be the slowest thing in a run of 300 bots
          const f = parseFrame(payload);
          if (!f) { bot.bad++; continue; }
          if (f.type === IN.WELCOME) { bot.handle = f.handle; bot.online = f.online; }
          else if (f.type === IN.ONLINE) bot.online = f.online;
          else if (f.type === IN.ENTER) bot.entered.set(f.handle, f.info);
          else if (f.type === IN.LEAVE) { bot.entered.delete(f.handle); bot.left.push(f.handle); }
          else if (f.type === IN.STATE) { const e = bot.states.get(f.handle) || { n: 0 }; bot.states.set(f.handle, { n: e.n + 1, s: f.s, at: performance.now(), first: e.first || performance.now() }); }
          else if (f.type === IN.BATCH) { for (const e of f.entries) { const q = bot.states.get(e.handle) || { n: 0 }; bot.states.set(e.handle, { n: q.n + 1, s: e.s, at: performance.now(), first: q.first || performance.now() }); } }
          else if (f.type === IN.AUDIENCE) bot.audience = f.band;
          else if (f.type === IN.SAY) bot.says.push([f.handle, f.phrase]);
          else if (f.type === IN.TO) bot.tos.push([f.handle, [...f.direct]]);
        }
      });
      sock.on('close', () => { if (bot.closed === null) bot.closed = 1006; });
      sock.on('error', () => {});
      if (hello) send(ver === 2 ? helloFrame2(packInfo(vehicle, livery, name)) : helloFrame(packInfo(vehicle, livery, name), wantK));
      const t0 = Date.now(); const wait = () => { if (bot.handle || !hello) resolve(bot); else if (Date.now() - t0 > 5000) reject(new Error('no WELCOME')); else setTimeout(wait, 10); }; wait();
    });
    req.end();
  });
}
