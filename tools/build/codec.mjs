// "PDB1": compact binary encoding of JSON-like data (numbers, strings, arrays, plain objects).
// The decoder (runtime/decode.js, ~2 KB minified) rebuilds exactly the same JS values.
//
// Why it beats JSON + gzip on the baked map data:
//  - number arrays (coordinates, grids) are stored as zigzag varints of the scaled integers, delta coded
//    (stride 1 or 2, optionally second order, optionally after a raw header of 2 or 4 values), the encoder
//    picks the cheapest variant per array. Decimal numbers are kept exactly: a value with at most 6 decimals
//    is stored as round(v * 10^d) and rebuilt as q / 10^d, which is the very same double (checked per array).
//  - object keys are stored once as "shapes" (one id per distinct key list), strings in a frequency-sorted table
//  - OSM ids ("w123456", "r395010.0") are delta coded numbers
//  - separate streams (tags / lengths / numbers / floats) so gzip sees homogeneous bytes
// Layout: 'PDB1', 5 varints (byte length of S, T, L, V, F), then the five streams. Root value is the first
// value in T.
import { Buffer } from 'node:buffer';

const NULL = 0, FALSE = 1, TRUE = 2, INT = 3, DEC = 4 /* 4..9 = 1..6 decimals */, F64 = 10, STR = 11, ARR = 12, OBJ = 13, NUMARR = 14, ID = 15;
const P10 = [1, 10, 100, 1e3, 1e4, 1e5, 1e6];
const ID_RE = /^([wrn])(0|[1-9]\d{0,14})(?:\.(0|[1-9]\d{0,3}))?$/;

class Sink {
  constructor() { this.b = new Uint8Array(1 << 16); this.n = 0; }
  need(k) { if (this.n + k > this.b.length) { const nb = new Uint8Array(Math.max(this.b.length * 2, this.n + k)); nb.set(this.b); this.b = nb; } }
  byte(x) { this.need(1); this.b[this.n++] = x; }
  varint(u) { this.need(8); const b = this.b; while (u >= 128) { b[this.n++] = (u % 128) | 128; u = Math.floor(u / 128); } b[this.n++] = u; }
  bytes(a) { this.need(a.length); this.b.set(a, this.n); this.n += a.length; }
  out() { return this.b.subarray(0, this.n); }
}
const zz = n => n < 0 ? -2 * n - 1 : 2 * n;
const vlen = u => u < 128 ? 1 : u < 16384 ? 2 : u < 2097152 ? 3 : u < 268435456 ? 4 : u < 34359738368 ? 5 : 6;

function decimalsOf(arr) { // smallest d (0..6) that represents every value exactly, or -1
  let d = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!Number.isFinite(v)) return -1;
    while (d <= 6 && Math.round(v * P10[d]) / P10[d] !== v) d++;
    if (d > 6) return -1;
  }
  return d;
}

// cost in bytes of coding q[] with the given transform, bailing out above `limit`
function cost(q, head, stride, order, limit) {
  let c = 0;
  const n = q.length;
  for (let i = 0; i < head && i < n; i++) c += vlen(zz(q[i]));
  if (stride === 0) { for (let i = head; i < n; i++) { c += vlen(zz(q[i])); if (c > limit) return c; } return c; }
  for (let i = head; i < n; i++) {
    const a = i - stride >= head ? q[i - stride] : 0;
    let e;
    if (order && i - 2 * stride >= head) e = q[i] - (2 * a - q[i - 2 * stride]); else e = q[i] - a;
    c += vlen(zz(e));
    if (c > limit) return c;
  }
  return c;
}

export function encode(root, { lossless = true } = {}) {
  // pass 1: string frequencies
  const freq = new Map();
  const count = s => freq.set(s, (freq.get(s) || 0) + 1);
  (function walk(v) {
    if (typeof v === 'string') { if (!ID_RE.test(v)) count(v); }
    else if (Array.isArray(v)) { for (const x of v) walk(x); }
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) { count(k); walk(v[k]); }
  })(root);
  const table = [...freq.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(e => e[0]);
  const sidx = new Map(table.map((s, i) => [s, i]));
  const S = new Sink(); const enc = new TextEncoder();
  for (const s of table) { if (s.includes('\u0000')) throw new Error('NUL in string'); const b = enc.encode(s); S.varint(b.length); S.bytes(b); }

  const T = new Sink(), L = new Sink(), V = new Sink(), F = new Sink();
  const shapes = new Map(); const prevId = { w: 0, r: 0, n: 0 };
  const f64 = new DataView(new ArrayBuffer(8));
  const stats = { numarr: 0, nums: 0 };

  function scalar(v) {
    if (Number.isInteger(v) && Math.abs(v) < 2 ** 52) { T.byte(INT); V.varint(zz(v)); return; }
    const d = Number.isFinite(v) ? decimalsOf([v]) : -1;
    if (d > 0 && Math.abs(v) * P10[d] < 2 ** 52) { T.byte(DEC + d - 1); V.varint(zz(Math.round(v * P10[d]))); return; }
    T.byte(F64); f64.setFloat64(0, v, true); for (let i = 0; i < 8; i++) F.byte(f64.getUint8(i));
  }

  function numarr(a) {
    const d = decimalsOf(a);
    if (d < 0) return false;
    const q = d === 0 ? a : a.map(v => Math.round(v * P10[d]));
    if (q.some(v => Math.abs(v) >= 2 ** 50)) return false;
    let best = null;
    const n = q.length;
    const heads = n >= 8 ? [0, 2, 4] : [0];
    for (const hs of heads) for (const stride of [0, 1, 2]) for (const order of (stride ? [0, 1] : [0])) {
      if (stride && n - hs < 2 * stride + 1) continue;
      if (!stride && hs) continue;
      const c = cost(q, hs, stride, order, best ? best.c : Infinity);
      if (!best || c < best.c) best = { c, hs, stride, order };
    }
    const { hs, stride, order } = best;
    T.byte(NUMARR); L.varint(n);
    T.byte(d | (stride << 3) | ((hs >> 1) << 5) | (order << 7));
    for (let i = 0; i < hs; i++) V.varint(zz(q[i]));
    for (let i = hs; i < n; i++) {
      if (!stride) { V.varint(zz(q[i])); continue; }
      const a = i - stride >= hs ? q[i - stride] : 0;
      V.varint(zz(order && i - 2 * stride >= hs ? q[i] - (2 * a - q[i - 2 * stride]) : q[i] - a));
    }
    stats.numarr++; stats.nums += n;
    return true;
  }

  function put(v) {
    if (v === null) T.byte(NULL);
    else if (v === true) T.byte(TRUE);
    else if (v === false) T.byte(FALSE);
    else if (typeof v === 'number') scalar(v);
    else if (typeof v === 'string') {
      const m = ID_RE.exec(v);
      if (m) { // 'w' / 'r' / 'n' + number, optional .sub
        T.byte(ID); const kind = m[1], num = +m[2];
        L.varint('wrn'.indexOf(kind)); V.varint(zz(num - prevId[kind])); prevId[kind] = num;
        L.varint(m[3] === undefined ? 0 : 1 + +m[3]);
      } else { T.byte(STR); L.varint(sidx.get(v)); }
    } else if (Array.isArray(v)) {
      if (v.length >= 1 && v.every(x => typeof x === 'number') && numarr(v)) return;
      T.byte(ARR); L.varint(v.length);
      for (const x of v) put(x);
    } else if (typeof v === 'object') {
      const keys = Object.keys(v), sig = keys.join('\u0000');
      T.byte(OBJ);
      let id = shapes.get(sig);
      if (id === undefined) { id = shapes.size; shapes.set(sig, id); L.varint(0); L.varint(keys.length); for (const k of keys) L.varint(sidx.get(k)); }
      else L.varint(id + 1);
      for (const k of keys) put(v[k]);
    } else throw new Error('unsupported value ' + typeof v);
  }
  put(root);

  const head = new Sink(); head.bytes(Buffer.from('PDB1'));
  const streams = [S, T, L, V, F].map(s => s.out());
  for (const s of streams) head.varint(s.length);
  for (const s of streams) head.bytes(s);
  const out = Buffer.from(head.out());
  out.stats = { ...stats, sizes: Object.fromEntries(['S', 'T', 'L', 'V', 'F'].map((k, i) => [k, streams[i].length])) };
  return out;
}
