// Shared helpers for the tables (BLATERO) end to end and load scripts: frame encoders and decoders, a small client,
// and payload fixtures shaped like BLATERO's own messages. Plain Node 22, no dependencies.
// Node's WebSocket accepts a `headers` option, which is how a test sets Origin and CF-Connecting-IP.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

export const BASE = process.env.RELAY || 'http://127.0.0.1:8799';
export const T_URL = BASE.replace(/^http/, 'ws') + '/t';
/** BLATERO's game frame on itch.io: the real Origin the relay is configured for. */
export const ORIGIN = 'https://html-classic.itch.zone';
export const PALERMO_ORIGIN = 'https://palermo-drive.it';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const freshCode = () => Array.from({ length: 5 }, () => ALPHABET[(Math.random() * 32) | 0]).join('');

let ipCounter = Math.floor(Math.random() * 60000);
/** A fresh fake client address, so tests do not eat each other's per address allowances. */
export const freshIp = () => { const n = ipCounter++; return `172.${16 + ((n >> 16) & 15)}.${(n >> 8) & 255}.${n & 255}`; };

/** A UUID (v4) as the 16 raw bytes the HELLO carries. */
export const freshPid = () => Uint8Array.from(randomUUID().replace(/-/g, '').match(/../g).map(h => parseInt(h, 16)));
export const pidHex = p => Array.from(p, b => b.toString(16).padStart(2, '0')).join('');

export const KIND = { hello: 1, state: 2, patch: 3, act: 4 };
const enc = new TextEncoder();
const bytes = p => (typeof p === 'string' ? enc.encode(p) : p);

export const helloFrame = (pid, code, create = false) => Uint8Array.from([1, 1, create ? 1 : 0, ...pid, ...enc.encode(code)]);
export const bcastFrame = (kind, payload) => Uint8Array.from([2, kind, ...bytes(typeof payload === 'object' && !(payload instanceof Uint8Array) ? JSON.stringify(payload) : payload)]);
export const toFrame = (slot, kind, payload) => Uint8Array.from([3, slot, kind, ...bytes(typeof payload === 'object' && !(payload instanceof Uint8Array) ? JSON.stringify(payload) : payload)]);
export const beatFrame = () => Uint8Array.from([4]);

const dec = new TextDecoder();
/** Decodes a relay frame into a plain object. */
export function decode(f) {
  switch (f[0]) {
    case 1: { const n = f[3], others = []; for (let i = 0; i < n; i++) others.push({ slot: f[4 + i * 17], pid: pidHex(f.slice(5 + i * 17, 21 + i * 17)) }); return { t: 'WELCOME', ver: f[1], slot: f[2], others, len: f.length }; }
    case 2: return { t: 'JOIN', slot: f[1], pid: pidHex(f.slice(2, 18)), len: f.length };
    case 3: return { t: 'LEAVE', slot: f[1], len: f.length };
    case 4: return { t: 'BCAST', from: f[1], kind: f[2], raw: f.slice(3), text: dec.decode(f.slice(3)) };
    case 5: return { t: 'TO', from: f[1], kind: f[2], raw: f.slice(3), text: dec.decode(f.slice(3)) };
    case 6: return { t: 'BEAT', len: f.length };
    default: return { t: '?' + f[0] };
  }
}

export class TClient {
  /** Opens a socket (no HELLO yet). Rejects if the upgrade is refused. */
  static open({ ip = freshIp(), origin = ORIGIN } = {}) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(T_URL, { headers: { ...(origin ? { Origin: origin } : {}), ...(ip ? { 'CF-Connecting-IP': ip } : {}) } });
      ws.binaryType = 'arraybuffer';
      const c = new TClient(ws);
      c.ip = ip;
      ws.onopen = () => resolve(c);
      ws.onerror = () => reject(new Error('upgrade refused'));
    });
  }

  constructor(ws) {
    this.ws = ws; this.inbox = []; this.waiters = []; this.closeCode = null; this.slot = -1; this.pid = null; this.code = null;
    ws.onmessage = e => { if (typeof e.data === 'string') return; this.inbox.push({ at: performance.now(), f: decode(new Uint8Array(e.data)) }); this.wake(); };
    ws.onclose = e => { this.closeCode = e.code; this.wake(); };
  }
  wake() { const w = this.waiters; this.waiters = []; w.forEach(r => r()); }
  send(b) { this.ws.send(b); }
  /** HELLO and wait for the WELCOME (or a close, which is returned as the closeCode in `closed`). */
  async join(code, { pid = freshPid(), create = false } = {}) {
    this.pid = pid; this.code = code;
    this.send(helloFrame(pid, code, create));
    const w = await this.maybe(f => f.t === 'WELCOME', 3000);
    if (!w) throw new Error('no WELCOME' + (this.closeCode !== null ? ` (closed ${this.closeCode})` : ''));
    this.slot = w.slot; this.welcome = w;
    return this;
  }
  /** Removes and returns the first frame matching `pred`, waiting up to `ms` for it; null on timeout or close. */
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
  drain() { return this.inbox.splice(0).map(m => m.f); }
  async closed(ms = 2000) {
    const end = performance.now() + ms;
    while (this.closeCode === null && performance.now() < end) await new Promise(r => { this.waiters.push(r); setTimeout(r, 50); });
    return this.closeCode;
  }
  close() { try { this.ws.close(); } catch { /* already gone */ } }
}

/**
 * A raw HTTP upgrade request, for what Node's WebSocket cannot do (no Origin, a refused upgrade's status code).
 * Resolves { status, socket } where socket exists only on a 101. The socket is sent a WebSocket ping right away: the
 * local runtime does not deliver a close frame to a socket that never sent anything, and the ping is answered by the
 * runtime without waking the relay's own logic.
 */
export function rawUpgrade({ ip, origin, path = '/t', upgrade = true } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE);
    const headers = {};
    if (upgrade) Object.assign(headers, { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' });
    if (origin) headers.Origin = origin;
    if (ip) headers['CF-Connecting-IP'] = ip;
    const req = http.request({ host: u.hostname, port: u.port, path, headers, agent: false });
    req.on('upgrade', (res, socket) => {
      const r = { status: res.statusCode, socket, got: Buffer.alloc(0) };
      socket.on('data', d => { r.got = Buffer.concat([r.got, d]); });
      socket.on('error', () => {});
      socket.write(Buffer.from([0x89, 0x80, 1, 2, 3, 4]));
      /** The close code the relay sent on this socket, or null. */
      r.closeCode = () => { const at = r.got.indexOf(0x88); return at >= 0 ? r.got.readUInt16BE(at + 2) : null; };
      resolve(r);
    });
    req.on('response', res => { res.resume(); resolve({ status: res.statusCode }); });
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------- payload fixtures shaped like BLATERO's messages
// Built from the types in BLATERO's src/room/state.ts, src/net/session.ts, src/net/patch.ts and src/game/rules.ts.

const STATS = ['gd', 'prog', 'graf', 'audio'];
const uuid = () => randomUUID();
const cardId = i => `${['gd', 'prog', 'graf', 'audio', 'jolly'][i % 5]}-${['ritmo', 'bug', 'asset', 'demo', 'crunch', 'idea', 'mix', 'build'][i % 8]}#${(i % 3) + 1}`;

/** A GameState: the shape of `GameState` in rules.ts, with `moves` events in its log. */
export function gameState(players, moves) {
  const ids = players.map(p => p.id);
  const events = [];
  for (let i = 0; i < moves; i++) {
    const e = { seq: i, turn: i, player: ids[i % ids.length], kind: i % 7 === 6 ? 'imprevisto' : 'play', card: cardId(i), stat: STATS[i % 4], value: (i % 5) + 1 };
    if (e.kind === 'imprevisto') { e.hits = [{ stat: STATS[i % 4], t: 7 }]; e.before = { gd: 7, prog: 5, graf: 3, audio: 4 }; }
    events.push(e);
  }
  return {
    seed: 1234567, sheet: 'sheet-' + (moves % 9), stats: { gd: 7, prog: 5, graf: 3, audio: 4 }, overflowed: [],
    deck: Array.from({ length: 60 - Math.min(moves, 40) }, (_, i) => cardId(i + 7)), discard: Array.from({ length: Math.min(moves, 40) }, (_, i) => cardId(i)),
    impDeck: Array.from({ length: 12 }, (_, i) => `imp-${i}`), impDiscard: [], order: ids, turn: moves, hand: Array.from({ length: 5 }, (_, i) => cardId(i + 20)),
    toPlay: 1, blind: false, imprevistoThisTurn: false, next: {}, undo: { stats: { gd: 6, prog: 5, graf: 3, audio: 4 }, overflowed: [] }, limit: 48, result: 'playing', events,
  };
}

/** A RoomState (state.ts). `moves` = 0 gives a lobby. */
export function roomState(code, nPlayers, moves = 0, version = 5) {
  const players = Array.from({ length: nPlayers }, (_, i) => ({ id: uuid(), name: ['Turi', 'Rosalia', 'Totò', 'Concetta', 'Peppino', 'Ninetta'][i], seat: i }));
  const s = { code, version, phase: moves ? 'playing' : 'lobby', players, game: moves ? gameState(players, moves) : null };
  if (moves) s.recent = Array.from({ length: 32 }, () => Math.random().toString(36).slice(2, 11));
  return s;
}
/** The same, with the optional keys of the voting phase. */
export function votingState(code, nPlayers) {
  const s = roomState(code, nPlayers);
  s.phase = 'voting';
  s.votes = Object.fromEntries(s.players.map(p => [p.id, ['sheet-1', 'sheet-4']]));
  s.ready = [s.players[0].id];
  s.chosen = { sheet: 'sheet-1', votes: 3, tied: ['sheet-1'] };
  return s;
}
export const helloMsg = (version = 3, extra = {}) => ({ version, ...extra });
export const nonce = () => Array.from({ length: 9 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
export const actMsg = (id = uuid(), type = 'move') => ({ nonce: nonce(), action: type === 'move' ? { type: 'move', id, move: { type: 'play', card: cardId(3), stat: 'gd', value: 3 }, at: 12 } : type === 'vote' ? { type: 'vote', id, sheets: ['sheet-1', 'sheet-4'] } : { type, id } });
/** A patch (patch.ts): the node `{o: {...}}` of a version bump and one appended event. */
export const patchMsg = (from = 12) => ({ from, to: from + 1, f: 'k3j2h1', p: { o: { version: { v: from + 1 }, game: { o: { turn: { v: from + 1 }, events: { s: 0, t: [{ seq: from, turn: from, player: uuid(), kind: 'play', card: cardId(from), stat: 'gd', value: 2 }] } } } } } });
