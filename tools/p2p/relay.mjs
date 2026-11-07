// A small local Nostr relay for the load tests (tools/p2p/stress.mjs). TEST TOOL ONLY: listens on 127.0.0.1, never leaves the machine, checks no signatures.
// Why it exists: the game's signalling runs over public Nostr relays run by volunteers. A 64-player test must not put that load on them, so the test points the game at
// these (?relays=wss://127.0.0.1:PORT,...) and counts every frame they see, which is what the real relays would have to take.
//
// It speaks enough of NIP-01 for Trystero (room announcements: ephemeral or regular events, one REQ with a '#x' filter), for src/p2p/fallback.js (ephemeral, '#t') and for src/p2p/presence.js (kind 30078,
// addressable, NIP-40 expiration): EVENT (answered with OK, kept unless the kind is ephemeral, replaced if the kind is replaceable or addressable, forwarded to every
// matching subscription), REQ (stored matches, then EOSE, then live events), CLOSE. It serves TLS with a throw-away self-signed certificate, because the shipped client only
// accepts wss:// addresses in ?relays= (src/p2p/p2p.js); the test browser is started with --ignore-certificate-errors.
//
//   node tools/p2p/relay.mjs [--n 5] [--base 9910]          stand-alone: prints the addresses and a one-line rate summary every 10 s
//   import { startRelays } from './relay.mjs'               as a library: { urls, snapshot(), close() }
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { WebSocketServer } = createRequire(path.join(HERE, '../build/package.json'))('ws');   // installed with tools/build (npm install there)

const PRESENCE_KIND = 30078, FALLBACK_KIND = 20078;   // src/p2p/presence.js, src/p2p/fallback.js
export function makeCert(dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-relay-'))) {
  const key = path.join(dir, 'key.pem'), crt = path.join(dir, 'crt.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '2', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
  return { key: fs.readFileSync(key), cert: fs.readFileSync(crt), dir };
}
const matches = (f, ev) => {
  if (f.ids && !f.ids.includes(ev.id)) return false;
  if (f.authors && !f.authors.includes(ev.pubkey)) return false;
  if (f.kinds && !f.kinds.includes(ev.kind)) return false;
  if (f.since != null && ev.created_at < f.since) return false;
  if (f.until != null && ev.created_at > f.until) return false;
  for (const k of Object.keys(f)) if (k[0] === '#') { const want = f[k]; if (!Array.isArray(want) || !ev.tags.some(t => t[0] === k.slice(1) && want.includes(t[1]))) return false; }
  return true;
};
const expiry = ev => { const t = ev.tags.find(t => t[0] === 'expiration'); return t ? +t[1] : Infinity; };

function startOne(tls, port) {
  const store = new Map();   // id -> event (and replace keys below)
  const slot = new Map();    // replace key -> id
  const clients = new Set();
  const c = { conns: 0, connsTotal: 0, inFrames: 0, outFrames: 0, inBytes: 0, outBytes: 0, in: { EVENT: 0, REQ: 0, CLOSE: 0, other: 0 }, out: { EVENT: 0, EOSE: 0, OK: 0, NOTICE: 0 },
    eventsIn: 0, eventsInPresence: 0, eventsOut: 0, eventsOutPresence: 0, bytesInPresence: 0, bytesOutPresence: 0, eventsInFb: 0, eventsOutFb: 0, bytesInFb: 0, bytesOutFb: 0, stored: 0, subsMax: 0, maxFrameOut: 0 };
  const series = [];   // [second, frames in, frames out] once per second, for the peak rate
  let lastIn = 0, lastOut = 0;
  const tick = setInterval(() => { series.push([Math.round(Date.now() / 1000), c.inFrames - lastIn, c.outFrames - lastOut]); lastIn = c.inFrames; lastOut = c.outFrames; if (series.length > 4000) series.shift(); }, 1000);
  const server = https.createServer(tls, (req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('local test relay\n'); });
  const wss = new WebSocketServer({ server, perMessageDeflate: false, maxPayload: 1 << 20 });
  const out = (cl, arr) => {
    if (cl.ws.readyState !== 1) return; const s = JSON.stringify(arr); c.outFrames++; c.outBytes += s.length; c.out[arr[0]] = (c.out[arr[0]] || 0) + 1;
    if (arr[0] === 'EVENT') { c.eventsOut++; if (arr[2].kind === PRESENCE_KIND) { c.eventsOutPresence++; c.bytesOutPresence += s.length; } else if (arr[2].kind === FALLBACK_KIND) { c.eventsOutFb++; c.bytesOutFb += s.length; } }
    if (s.length > c.maxFrameOut) c.maxFrameOut = s.length;
    cl.ws.send(s);
  };
  wss.on('connection', ws => {
    const cl = { ws, subs: new Map() }; clients.add(cl); c.conns++; c.connsTotal++;
    ws.on('message', (data, isBin) => {
      const raw = data.toString(); c.inFrames++; c.inBytes += raw.length;
      let m; try { m = JSON.parse(raw); } catch (e) { c.in.other++; return out(cl, ['NOTICE', 'bad json']); }
      if (!Array.isArray(m)) { c.in.other++; return; }
      if (m[0] === 'EVENT') {
        c.in.EVENT++; const ev = m[1];
        if (!ev || typeof ev.id !== 'string' || typeof ev.kind !== 'number' || !Array.isArray(ev.tags) || typeof ev.pubkey !== 'string') return out(cl, ['OK', ev && ev.id, false, 'invalid: malformed']);
        c.eventsIn++; if (ev.kind === PRESENCE_KIND) { c.eventsInPresence++; c.bytesInPresence += raw.length; } else if (ev.kind === FALLBACK_KIND) { c.eventsInFb++; c.bytesInFb += raw.length; }
        if (expiry(ev) <= Date.now() / 1000) return out(cl, ['OK', ev.id, false, 'invalid: expired']);
        if (store.has(ev.id)) return out(cl, ['OK', ev.id, true, 'duplicate:']);
        const ephemeral = ev.kind >= 20000 && ev.kind < 30000;
        if (!ephemeral) {
          const rk = ev.kind === 0 || ev.kind === 3 || (ev.kind >= 10000 && ev.kind < 20000) ? `${ev.pubkey}:${ev.kind}` : ev.kind >= 30000 && ev.kind < 40000 ? `${ev.pubkey}:${ev.kind}:${(ev.tags.find(t => t[0] === 'd') || [])[1] || ''}` : null;
          if (rk) { const old = slot.get(rk); if (old) { const o = store.get(old); if (o && o.created_at > ev.created_at) return out(cl, ['OK', ev.id, true, 'duplicate: newer exists']); store.delete(old); } slot.set(rk, ev.id); }
          store.set(ev.id, ev); c.stored = store.size;
          if (store.size > 50000) store.delete(store.keys().next().value);
        }
        out(cl, ['OK', ev.id, true, '']);
        for (const o of clients) for (const [sid, fs_] of o.subs) if (fs_.some(f => matches(f, ev))) out(o, ['EVENT', sid, ev]);
      } else if (m[0] === 'REQ') {
        c.in.REQ++; const sid = m[1], filters = m.slice(2).filter(f => f && typeof f === 'object');
        if (typeof sid !== 'string') return;
        cl.subs.set(sid, filters); let n = 0; for (const o of clients) n += o.subs.size; c.subsMax = Math.max(c.subsMax, n);
        const now = Date.now() / 1000;
        for (const f of filters) {
          const hit = [...store.values()].filter(ev => expiry(ev) > now && matches(f, ev)).sort((a, b) => b.created_at - a.created_at).slice(0, Math.min(f.limit || 500, 500));
          for (const ev of hit.reverse()) out(cl, ['EVENT', sid, ev]);
        }
        out(cl, ['EOSE', sid]);
      } else if (m[0] === 'CLOSE') { c.in.CLOSE++; cl.subs.delete(m[1]); }
      else c.in.other++;
    });
    ws.on('close', () => { clients.delete(cl); c.conns--; });
    ws.on('error', () => {});
  });
  return new Promise(res => server.listen(port, '127.0.0.1', () => res({
    port, url: `wss://127.0.0.1:${server.address().port}`,
    snapshot: () => JSON.parse(JSON.stringify({ ...c, t: Date.now() })),
    peak: (fromSec, toSec) => { let a = 0, b = 0; for (const [s, i, o] of series) if (s >= fromSec && s <= toSec) { a = Math.max(a, i); b = Math.max(b, o); } return { peakIn: a, peakOut: b }; },
    close: () => { clearInterval(tick); for (const cl of clients) cl.ws.terminate(); wss.close(); server.close(); },
  })));
}
// n relays on consecutive ports (port 0 = any free ports)
export async function startRelays({ n = 5, base = 0 } = {}) {
  const tls = makeCert(), rs = [];
  for (let i = 0; i < n; i++) rs.push(await startOne(tls, base ? base + i : 0));
  return { urls: rs.map(r => r.url), relays: rs, snapshot: () => rs.map(r => r.snapshot()), peak: (a, b) => rs.map(r => r.peak(a, b)), close: () => { rs.forEach(r => r.close()); try { fs.rmSync(tls.dir, { recursive: true, force: true }); } catch (e) { /* gone */ } } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const R = await startRelays({ n: +arg('n', 5), base: +arg('base', 9910) });
  console.log('relays (self-signed TLS; start the browser with --ignore-certificate-errors):\n' + R.urls.join('\n'));
  let last = R.snapshot();
  setInterval(() => { const s = R.snapshot(); console.log(s.map((x, i) => `#${i} conns ${x.conns} in ${((x.inFrames - last[i].inFrames) / 10).toFixed(1)}/s out ${((x.outFrames - last[i].outFrames) / 10).toFixed(1)}/s stored ${x.stored}`).join('  |  ')); last = s; }, 10000);
}
