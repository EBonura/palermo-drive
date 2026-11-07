// Hostile messages through the real handlers of a running game page: wrong sizes and types, huge and odd names, markup, control and bidi characters,
// out-of-range values, a flood. Passes when nothing throws, bad frames are counted and dropped, and names come out as plain text.
import { start, player, sleep } from './lib.mjs';
const h = await start();
try {
  const a = await player(h, { name: 'Anna', ns: 'fuzz' + Date.now().toString(36), x: -1250, z: 250, p2p: 'p2p=nostr' });
  const r = await a.page.evaluate(() => {
    const enc = s => new TextEncoder().encode(s), info = (liv, nameBytes, veh = 0) => { const b = new Uint8Array(4 + nameBytes.length); b[0] = 1; b[1] = veh; b[2] = liv; b[3] = nameBytes.length; b.set(nameBytes, 4); return b; };
    const state = (mut) => { const b = new Uint8Array(13); b[0] = 2; b[1] = 1; mut && mut(b); return b; };
    const D = window.__p2p, out = {};
    const run = (label, msgs) => { const before = { ...D.stats }; const res = D.fuzz(msgs); out[label] = { ...res, newBad: D.stats.rxBad - before.rxBad }; };
    run('markup name', [['i', info(0, enc('<img src=x onerror=alert(1)>'))]]);
    run('control + bidi + zero width', [['i', info(0, enc('A‮evil​\u0000⁦x⁩\n\tB'))]]);
    run('emoji + long name (kept to 16)', [['i', info(0, enc('😀'.repeat(40).slice(0, 60)))]]);
    run('name length field lies', [['i', (() => { const b = info(0, enc('abc')); b[3] = 200; return b; })()]]);
    run('name over 64 bytes', [['i', info(0, new Uint8Array(65).fill(65))]]);
    run('livery out of range (first livery)', [['i', info(99, enc('x'))]]);
    run('vehicle out of range (the lapa)', [['i', info(0, enc('x'), 99)], ['i', info(250, enc('x'), 255)]]);
    run('invalid utf-8', [['i', info(0, new Uint8Array([0xff, 0xfe, 0xc0, 0x80]))]]);
    run('not bytes', [['i', 'string'], ['i', null], ['i', { a: 1 }], ['s', 12345], ['s', undefined], ['s', new Uint8Array(0)]]);
    run('wrong state sizes', [['s', new Uint8Array(12)], ['s', new Uint8Array(14)], ['s', new Uint8Array(1000)]]);
    run('wrong type byte', [['s', state(b => { b[0] = 7; })], ['i', new Uint8Array([9, 0, 0, 0])]]);
    run('position beyond +-20 km', [['s', state(b => { b.set([255, 255, 255, 255, 255], 2); })]]);
    run('state of a peer without info', [['s', state()]]);
    let sq = 20; const lifted = n => { const b = new Uint8Array(15); b[0] = 2; b[1] = ++sq; b.set([0, 0, 8, 0, 128], 2); b[12] = 8; new DataView(b.buffer).setUint16(13, n, true); return b; };
    run('height flag but no height bytes (bad)', [['s', state(b => { b[12] = 8; })]]);
    run('height bytes without the flag (bad)', [['s', new Uint8Array(15).fill(0).map((v, i) => i === 0 ? 2 : i === 1 ? 3 : 0)]]);
    run('reserved flag bits (bad)', [['s', state(b => { b[12] = 0x10; })], ['s', state(b => { b[12] = 0x80; })]]);
    run('height of 6553 m (bad)', [['s', lifted(65535)]]);
    run('height of 1000.1 m (bad)', [['s', lifted(10001)]]);
    run('height of 12.3 m (fine)', [['s', lifted(123)]]);
    // the fast STATE channel (src/p2p/p2p.js, HELLO and FAST)
    const fast = (mut, n = 19) => { const b = new Uint8Array(n); b[0] = 10; b[1] = ++sq; b.set([0, 0, 8, 0, 128], 3); mut && mut(b); return b; };
    run('fast: hello of the wrong size or value (bad)', [['f', new Uint8Array([9])], ['f', new Uint8Array([9, 2])], ['f', new Uint8Array([9, 0, 0])]]);
    run('fast: not bytes, empty, unknown type (bad)', [['f', 'x'], ['f', null], ['f', new Uint8Array(0)], ['f', new Uint8Array([11, 0])]]);
    run('fast: wrong sizes (bad)', [['f', fast(null, 18)], ['f', fast(null, 20)], ['f', fast(null, 2000)]]);
    run('fast: reserved flag bits, height flag without bytes (bad)', [['f', fast(b => { b[15] = 0x20; })], ['f', fast(b => { b[15] = 8; })]]);
    run('fast: position beyond +-20 km (bad)', [['f', fast(b => { b.set([255, 255, 255, 255, 255], 3); })]]);
    run('fast: height of 6553 m (bad)', [['f', fast(b => { b[15] = 8; new DataView(b.buffer).setUint16(19, 65535, true); }, 21)]]);
    run('fast: extreme speed, curvature, accel (clamped, fine)', [['f', fast(b => { const v = new DataView(b.buffer); v.setInt16(10, -32768, true); v.setInt16(16, 32767, true); v.setInt8(18, -128); })]]);
    run('fast: a copy and an older one (dropped)', (() => { const a = fast(b => { b[1] = 200; b[2] = 0; }), o = fast(b => { b[1] = 100; b[2] = 0; }); return [['f', a], ['f', a.slice()], ['f', o]]; })());
    return out;
  });
  for (const [k, v] of Object.entries(r)) console.log(k.padEnd(34), JSON.stringify(v));
  // flood: 500 valid states in one go from one peer, bucket not refilled: about 60 get through, the rest are dropped
  const fl = await a.page.evaluate(() => {
    const D = window.__p2p, p = () => D.peers.get('fuzz-peer'); D.fuzz([]); p().tokens = 60; p().tokT = performance.now(); const before = D.stats.rxDropped;
    const msgs = []; for (let i = 0; i < 500; i++) { const b = new Uint8Array(13); b[0] = 2; b[1] = i & 255; msgs.push(['s', b]); }
    const res = D.fuzz(msgs, false); return { ...res, dropped: D.stats.rxDropped - before };
  });
  console.log('flood of 500 states'.padEnd(34), JSON.stringify(fl));
  console.log('page errors', a.errs);
} finally { await h.close(); }
