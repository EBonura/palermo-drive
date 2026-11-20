// Shared helpers for the end to end and load scripts: frame encoders and decoders, and a small client.
// Plain Node 22, no dependencies. Node's WebSocket accepts a `headers` option, which is how a test sets Origin
// and CF-Connecting-IP (the relay's per address caps read the latter).
import http from 'node:http';

export const BASE = process.env.RELAY || 'http://127.0.0.1:8799';
export const WS_URL = BASE.replace(/^http/, 'ws') + '/r';
export const ORIGIN = 'http://localhost:5173';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const T = { WELCOME: 1, ENTER: 2, LEAVE: 3, STATE: 4, SAY: 5, TO: 6, ONLINE: 7 };

let ipCounter = Math.floor(Math.random() * 60000);
/** A fresh fake client address, so tests do not eat each other's 24-per-address allowance. */
export const freshIp = () => { const n = ipCounter++; return `10.${(n >> 8) & 255}.${n & 255}.7`; };

/** The game's 40 bit position: x in the low 20 bits, z in the high 20, 0.05 m units, 2^19 added. */
export function encPos(x, z) {
  const q = m => Math.min(0xfffff, Math.max(0, Math.round(m * 20) + (1 << 19)));
  const v = BigInt(q(x)) | (BigInt(q(z)) << 20n);
  return [0, 8, 16, 24, 32].map(s => Number((v >> BigInt(s)) & 0xffn));
}
export function decPos(b, at) {
  let v = 0n; for (let i = 0; i < 5; i++) v |= BigInt(b[at + i]) << BigInt(8 * i);
  return [(Number(v & 0xfffffn) - (1 << 19)) / 20, (Number(v >> 20n) - (1 << 19)) / 20];
}

/** A STATE body (18 bytes, 20 with a height) as the game's packFast builds it; `tag` goes in the time field. */
export function stateBody(x, z, { tag = 0, height = null } = {}) {
  const b = new Uint8Array(height === null ? 18 : 20);
  b[0] = tag & 255; b[1] = (tag >> 8) & 255;
  b.set(encPos(x, z), 2);
  if (height !== null) { b[14] = 8; b[18] = height & 255; b[19] = height >> 8; }
  return b;
}
export const stateFrame = (x, z, opts) => Uint8Array.from([3, ...stateBody(x, z, opts)]);
export const infoBytes = (name, vehicle = 1, livery = 0) => { const n = new TextEncoder().encode(name); return [vehicle, livery, n.length, ...n]; };
export const helloFrame = (name, vehicle, livery) => Uint8Array.from([1, 2, ...infoBytes(name, vehicle, livery)]);
export const infoFrame = (name, vehicle, livery) => Uint8Array.from([2, ...infoBytes(name, vehicle, livery)]);
export const sayFrame = p => Uint8Array.from([4, p]);
export const toFrame = (h, data) => Uint8Array.from([5, h & 255, h >> 8, ...data]);

/** Decodes a relay frame into a plain object. */
export function decode(f) {
  const u16 = i => f[i] | (f[i + 1] << 8);
  switch (f[0]) {
    case T.WELCOME: return { t: 'WELCOME', ver: f[1], handle: u16(2), online: u16(4) };
    case T.ENTER: { const n = f[5]; return { t: 'ENTER', handle: u16(1), vehicle: f[3], livery: f[4], name: new TextDecoder().decode(f.slice(6, 6 + n)) }; }
    case T.LEAVE: return { t: 'LEAVE', handle: u16(1) };
    case T.STATE: return { t: 'STATE', handle: u16(1), body: f.slice(3), tag: f[3] | (f[4] << 8), pos: decPos(f, 5) };
    case T.SAY: return { t: 'SAY', handle: u16(1), phrase: f[3] };
    case T.TO: return { t: 'TO', from: u16(1), data: f.slice(3) };
    case T.ONLINE: return { t: 'ONLINE', online: u16(1) };
    default: return { t: '?' + f[0] };
  }
}

export class Client {
  /** Opens a socket (not yet said HELLO). Rejects if the upgrade is refused. */
  static open({ ip = freshIp(), origin = ORIGIN } = {}) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL, { headers: { ...(origin ? { Origin: origin } : {}), ...(ip ? { 'CF-Connecting-IP': ip } : {}) } });
      ws.binaryType = 'arraybuffer';
      const c = new Client(ws);
      ws.onopen = () => resolve(c);
      ws.onerror = () => reject(new Error('upgrade refused'));
    });
  }

  constructor(ws) {
    this.ws = ws; this.inbox = []; this.waiters = []; this.closeCode = null; this.handle = 0; this.online = 0;
    ws.onmessage = e => { if (typeof e.data === 'string') return; this.inbox.push({ at: performance.now(), f: decode(new Uint8Array(e.data)) }); this.wake(); };
    ws.onclose = e => { this.closeCode = e.code; this.wake(); };
  }
  wake() { const w = this.waiters; this.waiters = []; w.forEach(r => r()); }
  send(bytes) { this.ws.send(bytes); }
  /** HELLO and wait for WELCOME. */
  async join(name = 'p', vehicle, livery) {
    this.send(helloFrame(name, vehicle, livery));
    const w = await this.next(f => f.t === 'WELCOME', 3000);
    this.handle = w.handle; this.online = w.online; this.name = name;
    return this;
  }
  /** Removes and returns the first frame matching `pred`, waiting up to `ms` for it; null on timeout. */
  async maybe(pred, ms = 1500) {
    const end = performance.now() + ms;
    for (;;) {
      const i = this.inbox.findIndex(m => pred(m.f));
      if (i >= 0) return this.inbox.splice(i, 1)[0].f;
      const left = end - performance.now();
      if (left <= 0 || this.closeCode !== null) return null;
      await new Promise(r => { this.waiters.push(r); setTimeout(r, left); });
    }
  }
  async next(pred, ms = 1500) { const f = await this.maybe(pred, ms); if (!f) throw new Error('timed out waiting for a frame' + (this.closeCode !== null ? ` (closed ${this.closeCode})` : '')); return f; }
  /** Everything received so far, removed from the inbox. */
  drain() { return this.inbox.splice(0).map(m => m.f); }
  async closed(ms = 2000) {
    const end = performance.now() + ms;
    while (this.closeCode === null && performance.now() < end) await new Promise(r => { this.waiters.push(r); setTimeout(r, 50); });
    return this.closeCode;
  }
  close() { try { this.ws.close(); } catch { /* already gone */ } }
}

export async function stats() { return (await fetch(BASE + '/stats')).json(); }

/**
 * A raw HTTP upgrade request, for what Node's WebSocket cannot do (no Origin, a refused upgrade's status code).
 * Resolves { status, socket } where socket exists only on a 101.
 */
export function rawUpgrade({ ip, origin, path = '/r', upgrade = true } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE);
    const headers = {};
    if (upgrade) Object.assign(headers, { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' });
    if (origin) headers.Origin = origin;
    if (ip) headers['CF-Connecting-IP'] = ip;
    const req = http.request({ host: u.hostname, port: u.port, path, headers, agent: false });
    req.on('upgrade', (res, socket) => resolve({ status: res.statusCode, socket }));
    req.on('response', res => { res.resume(); resolve({ status: res.statusCode }); });
    req.on('error', reject);
    req.end();
  });
}
