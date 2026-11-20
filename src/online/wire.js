// The relay's frames (protocol v2, docs/ONLINE.md), packed and read. No DOM and no socket, so a Node script can run it (tools/online/fuzz.mjs does).
// Every frame is binary, little endian, the first byte its type. Everything the relay sends is bytes that strangers made, so parseFrame() checks type, exact length and
// every range, and returns null for anything a real client would not send. The game never reads a frame by hand anywhere else.
//   to the relay    HELLO [1][3][wanted set size u8, 0 for the relay's own][info]   (protocol 2, [1][2][info], is still understood by the relay)   INFO [2][info]   STATE [3][state]   SAY [4][phrase]   TO [5][handle u16][direct 1..8 bytes]
//   from the relay  WELCOME [1][3][handle u16][online u16][set size u8]   (protocol 2: [1][2][handle][online], no set size)   ENTER [2][handle][info]   LEAVE [3][handle]   STATE [4][handle][state]   SAY [5][handle][phrase]   TO [6][from handle][direct]   ONLINE [7][online u16]
//                   BATCH [8][n u8, 2 to 16][handle u16][state] x n   (states the relay held for up to 40 ms to send together; each entry is a STATE)   AUDIENCE [9][band u8]   (how far the nearest player that holds you is: 0 nobody, 1 to 8 by 50, 100, 150, 250, 350, 600, 1200 m)
//   info   [vehicle u8][livery u8][nameLen u8][name utf8]: vehicle indexes VEHICLES (src/garage.js), livery the LIVERIES of that vehicle (the receiver turns anything out of range into the lapa or its first livery)
//   state  [time u16][position 5][heading u16][speed i16][steer i8][roll i8][lean i8][flags u8][curvature i16][accel i8][height u16]?   18 bytes, 20 with a height (flags bit 3)
//          time: the sender's clock in ms mod 65536; position: x and z in 1/20 m, 20 bits each, offset by 2^19; heading in 1/65536 turn; speed in 1/100 m/s; flags: bit 0 nitro, 1 brake, 2 drift, 3 height follows
//          (the other bits must be 0); curvature of the path in 1/10000 per metre; acceleration in 1/10 m/s2; height: tenths of a metre above the ground at x, z (a bridge deck, a roof, the air), sent only above 0.6 m
import { PHRASES } from './phrases.js';

export const PROTOCOL = 3, MAX_FRAME = 96, MAX_BATCH = 16, MAX_BATCH_FRAME = 2 + MAX_BATCH * 22, MAX_SET = 64;   // MAX_FRAME is what the relay may send in one frame, a BATCH aside: it is what a client may send
export const AUDIENCE_LOW = [Infinity, 0, 50, 100, 150, 250, 350, 600, 1200];   // by band: the distance the nearest holder is at least
export const OUT = { HELLO: 1, INFO: 2, STATE: 3, SAY: 4, TO: 5 };
export const IN = { WELCOME: 1, ENTER: 2, LEAVE: 3, STATE: 4, SAY: 5, TO: 6, ONLINE: 7, BATCH: 8, AUDIENCE: 9 };
export const MAX_NAME_BYTES = 64, MAX_NAME_RUNES = 16;
export const MAX_DIRECT = 8;
const STATE_LEN = 18, MAX_LIFT = 1000, LIFT_MIN = 0.6;   // metres: the ceiling of src/vehicle-air.js is 700 above the sea
const POS_UNITS = 20, POS_MID = 1 << 19, POS_MAX = (1 << 20) - 1, WORLD = 20000;   // the map is inside 13 km of the origin; anything beyond 20 km is a lie
const TAU = Math.PI * 2;

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const q8 = (v, scale) => clamp(Math.round(v / scale * 127), -127, 127);

// a name from a stranger, or from the player's own box: plain text only (control, zero width, direction override and line separator characters removed, whitespace collapsed), 16 characters
export const cleanName = s => Array.from(String(s).replace(/[\p{C}\p{Zl}\p{Zp}‎‏‪-‮⁦-⁩]/gu, '').replace(/\s+/g, ' ').trim()).slice(0, MAX_NAME_RUNES).join('');

export function toBytes(d) {
  return d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : null;
}

// ---------- packing (what we send) ----------
export function packInfo(vehicle, livery, name) {
  const nm = new TextEncoder().encode(name).slice(0, MAX_NAME_BYTES), b = new Uint8Array(3 + nm.length);
  b[0] = vehicle; b[1] = livery; b[2] = nm.length; b.set(nm, 3);
  return b;
}
// wantK: how many players to receive (0: the relay's number); the relay cuts it to 64. The game asks for its own number only on a page served from this machine (?k=, src/online/online.js).
export const helloFrame = (info, wantK = 0) => { const b = new Uint8Array(3 + info.length); b[0] = OUT.HELLO; b[1] = PROTOCOL; b[2] = clamp(wantK | 0, 0, MAX_SET); b.set(info, 3); return b; };
export const helloFrame2 = info => { const b = new Uint8Array(2 + info.length); b[0] = OUT.HELLO; b[1] = 2; b.set(info, 2); return b; };   // protocol 2, for the tests of a page from before
export const infoFrame = info => { const b = new Uint8Array(1 + info.length); b[0] = OUT.INFO; b.set(info, 1); return b; };
export const sayFrame = phrase => new Uint8Array([OUT.SAY, phrase]);
export const toFrame = (handle, direct) => { const b = new Uint8Array(3 + direct.length); b[0] = OUT.TO; b[1] = handle & 255; b[2] = handle >> 8; b.set(direct, 3); return b; };
// s: { t (ms), x, z, th, v, steer, roll, lean, fl (bits 0 to 2), k, a, h (metres above the ground) }. The frame is [3][state], so the state starts at byte 1.
export function stateFrame(s) {
  const lift = s.h > LIFT_MIN ? Math.min(MAX_LIFT, s.h) : 0, b = new Uint8Array(lift ? STATE_LEN + 3 : STATE_LEN + 1), dv = new DataView(b.buffer);
  b[0] = OUT.STATE; dv.setUint16(1, Math.round(s.t) & 0xffff, true);
  const xq = clamp(Math.round(s.x * POS_UNITS) + POS_MID, 0, POS_MAX), zq = clamp(Math.round(s.z * POS_UNITS) + POS_MID, 0, POS_MAX);
  dv.setUint32(3, (xq | ((zq & 0xfff) << 20)) >>> 0, true); b[7] = zq >>> 12;
  dv.setUint16(8, Math.round(((s.th % TAU) + TAU) % TAU / TAU * 65536) & 0xffff, true);
  dv.setInt16(10, clamp(Math.round(s.v * 100), -32767, 32767), true);
  dv.setInt8(12, q8(s.steer, 0.7)); dv.setInt8(13, q8(s.roll, 0.5)); dv.setInt8(14, q8(s.lean, 1));
  b[15] = (s.fl & 7) | (lift ? 8 : 0);
  dv.setInt16(16, clamp(Math.round(s.k * 10000), -30000, 30000), true);
  dv.setInt8(18, clamp(Math.round(s.a * 10), -127, 127));
  if (lift) dv.setUint16(19, Math.round(lift * 10), true);
  return b;
}

// ---------- reading (what strangers send) ----------
// a state that starts at byte o of b and ends with b, or null
export function readState(b, o) {
  const n = b.length - o;
  if (n !== STATE_LEN && n !== STATE_LEN + 2) return null;
  const fl = b[o + 14];
  if (fl & 0xf0 || n !== (fl & 8 ? STATE_LEN + 2 : STATE_LEN)) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const lo = dv.getUint32(o + 2, true), xq = lo & 0xfffff, zq = (lo >>> 20) | (b[o + 6] << 12);
  const x = (xq - POS_MID) / POS_UNITS, z = (zq - POS_MID) / POS_UNITS, h = fl & 8 ? dv.getUint16(o + 18, true) / 10 : 0;
  if (!(Math.abs(x) < WORLD && Math.abs(z) < WORLD) || h > MAX_LIFT) return null;
  return { t16: dv.getUint16(o, true), x, z, th: dv.getUint16(o + 7, true) / 65536 * TAU, v: clamp(dv.getInt16(o + 9, true) / 100, -60, 60), steer: dv.getInt8(o + 11) / 127 * 0.7, roll: dv.getInt8(o + 12) / 127 * 0.5,
    lean: dv.getInt8(o + 13) / 127, fl: fl & 7, k: clamp(dv.getInt16(o + 15, true) / 10000, -3, 3), a: dv.getInt8(o + 17) / 10, h };
}
// an info that starts at byte o and ends with b: { vehicle, livery, name } (indexes as sent: the caller maps them, and a name is cleaned here), or null
export function readInfo(b, o) {
  if (b.length - o < 3) return null;
  const n = b[o + 2];
  if (n > MAX_NAME_BYTES || b.length !== o + 3 + n) return null;
  return { vehicle: b[o], livery: b[o + 1], name: cleanName(new TextDecoder().decode(b.subarray(o + 3))) };
}
const u16 = (b, o) => b[o] | (b[o + 1] << 8);

// One frame from the relay as { type, ... }, or null if it is not one a real relay sends: wrong type, wrong length, handle 0, a phrase index we do not have, a state out of range.
export function parseFrame(data) {
  const b = toBytes(data);
  if (!b || !b.length || b.length > (b[0] === IN.BATCH ? MAX_BATCH_FRAME : MAX_FRAME)) return null;
  switch (b[0]) {
    case IN.WELCOME: {   // protocol 2: 6 bytes, no set size (a relay from before this one); protocol 3: 7 bytes with the number of players it will send
      if (!(b[1] === 2 && b.length === 6) && !(b[1] === 3 && b.length === 7 && b[6] >= 1 && b[6] <= MAX_SET) || !u16(b, 2)) return null;
      return { type: IN.WELCOME, handle: u16(b, 2), online: u16(b, 4), version: b[1], k: b[1] === 3 ? b[6] : 8 };
    }
    case IN.BATCH: {   // n entries of [handle][state], each state 18 or 20 bytes by its own flags: the count, every length and every state are checked, and the frame must end exactly where the last entry does
      const n = b[1]; if (b.length < 2 || !(n >= 2 && n <= MAX_BATCH)) return null;
      const entries = []; let o = 2;
      for (let i = 0; i < n; i++) {
        if (o + 2 + STATE_LEN > b.length || !u16(b, o)) return null;
        const len = b[o + 2 + 14] & 8 ? STATE_LEN + 2 : STATE_LEN;
        if (o + 2 + len > b.length) return null;
        const s = readState(b.subarray(o + 2, o + 2 + len), 0); if (!s) return null;
        entries.push({ handle: u16(b, o), s }); o += 2 + len;
      }
      return o === b.length ? { type: IN.BATCH, entries } : null;
    }
    case IN.AUDIENCE: return b.length === 2 && b[1] <= 8 ? { type: IN.AUDIENCE, band: b[1] } : null;
    case IN.ENTER: { if (b.length < 6 || !u16(b, 1)) return null; const info = readInfo(b, 3); return info && { type: IN.ENTER, handle: u16(b, 1), info }; }
    case IN.LEAVE: return b.length === 3 && u16(b, 1) ? { type: IN.LEAVE, handle: u16(b, 1) } : null;
    case IN.STATE: { if (b.length < 3 + STATE_LEN || !u16(b, 1)) return null; const s = readState(b, 3); return s && { type: IN.STATE, handle: u16(b, 1), s }; }
    case IN.SAY: return b.length === 4 && u16(b, 1) && b[3] < PHRASES.length ? { type: IN.SAY, handle: u16(b, 1), phrase: b[3] } : null;
    case IN.TO: return b.length >= 4 && b.length <= 3 + MAX_DIRECT && u16(b, 1) ? { type: IN.TO, handle: u16(b, 1), direct: b.subarray(3) } : null;
    case IN.ONLINE: return b.length === 3 ? { type: IN.ONLINE, online: u16(b, 1) } : null;
    default: return null;
  }
}
