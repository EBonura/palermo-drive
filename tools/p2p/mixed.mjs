// An older client and this one in the same spot (docs/P2P-MULTIPLAYER.md, "Bytes on the wire"): the older one has no STATE channel of its own, so this one must notice and
// send it STATE through Trystero as before. Both must see each other move, with no page error and nothing counted as bad on either side.
//   tools/release/withbrowser.sh node tools/p2p/mixed.mjs --root <this dist> --old <older dist> --local
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { start, player, sleep, arg } from './lib.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { startServer } = await import(path.join(HERE, '../build/serve.mjs'));
const ns = 'mx' + Date.now().toString(36), h = await start(), old = await startServer(path.resolve(arg('old')), '');
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(70), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const look = P => P.page.evaluate(() => { const d = window.__p2p, r = [...d.remotes.values()][0]; return { drawn: d.remotes.size, pos: r && r.model ? [+r.model.root.position.x.toFixed(1), +r.model.root.position.z.toFixed(1)] : null, bad: d.stats.rxBad, fast: d.peerInfo ? d.peerInfo().map(p => [p.fast, p.chan]) : null, hellos: d.stats.hellos, fastTx: d.stats.fastTx }; });
try {
  const N = await player(h, { name: 'Nuovo', ns, x: 137, z: -212 });
  const O = await player({ ...h, port: old.port }, { name: 'Vecchio', ns, x: 141, z: -205 });
  let n, o;
  for (let t = 0; t < 120; t++) { n = await look(N); o = await look(O); if (n.drawn && o.drawn) break; await sleep(500); }
  ok('they see each other', n.drawn === 1 && o.drawn === 1, JSON.stringify({ n, o }));
  // both drive in a slow circle; each must see the other move
  for (const P of [N, O]) await P.page.evaluate(() => { const c = window.game.car, x0 = c.x, z0 = c.z; let a = 0, last = performance.now(); const pose = { x: x0, z: z0, th: 0, vf: 6, vx: 0, vz: 0 }; for (const k of Object.keys(pose)) Object.defineProperty(c, k, { get: () => pose[k], set: () => {}, configurable: true }); const f = now => { const dt = Math.min(0.1, (now - last) / 1000); last = now; a += dt * 6 / 15; pose.x = x0 + Math.sin(a) * 15; pose.z = z0 + Math.cos(a) * 15 - 15; pose.th = a + Math.PI / 2; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const n0 = await look(N), o0 = await look(O); await sleep(25000); const n1 = await look(N), o1 = await look(O);
  const moved = (a, b) => a.pos && b.pos && Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]) > 1;
  ok('the new client sees the old one move', moved(n0, n1), JSON.stringify([n0.pos, n1.pos]));
  ok('the old client sees the new one move', moved(o0, o1), JSON.stringify([o0.pos, o1.pos]));
  ok('the new client gave up on the fast channel and sends through Trystero', n1.fast && n1.fast[0][0] === false && n1.fastTx === 0, JSON.stringify(n1));
  ok('no bad messages on either side', n1.bad === 0 && o1.bad === 0, `new ${n1.bad} old ${o1.bad}`);
  ok('no page errors', !N.errs.length && !O.errs.length, JSON.stringify([N.errs, O.errs]));
} finally { await h.close(); old.server ? old.server.close() : old.close && old.close(); }
process.exit(bad ? 1 : 0);
