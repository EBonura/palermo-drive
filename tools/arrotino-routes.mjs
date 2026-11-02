// Bakes the loops of the knife-grinders (l'arrotino, src/arrotini.js) into src/arrotino-routes.js: for each quarter a few streets in a ring, joined by the shortest way a three-wheeler may take
// on the game's own road graph (src/traffic-graph.js fed with the baked tiles: class 3, no fast roads, pedestrian streets only when there is no other way), the way back avoiding the way out where it can.
// A stop is "Street name" or "Street name@dx,dz" (the vertex of that street nearest to the quarter's centre c, moved by dx, dz metres). Run: node tools/arrotino-routes.mjs [id] (prints each loop and writes the file when all of them work).
import fs from 'fs'; import vm from 'vm';
import { createGraph } from '../src/traffic-graph.js';
const root = new URL('../', import.meta.url).pathname;
const QUARTERS = [
  { id: 'kalsa', name: 'Kalsa', c: [38.1150, 13.3695], stops: ['Via Magione', 'Piazza della Kalsa', 'Foro Italico Umberto I', 'Piazza Marina'] },
  { id: 'zisa', name: 'Zisa', c: [38.1150, 13.3440], stops: ['Via Zisa@-80,-76', 'Via Cipressi@-72,174', 'Via Colonna Rotta@320,118', 'Via Marco Polo@325,-207', 'Via Guglielmo il Buono@56,-186'] },
  { id: 'noce', name: 'Noce', c: [38.1215, 13.3385], stops: ['Via Dante@341,-27', 'Via Serradifalco@86,-258', 'Via Tommaso Aversa@-154,-319', 'Via Noce@-64,122'] },
  { id: 'brancaccio', name: 'Brancaccio', c: [38.0995, 13.3800], stops: ['Via Brancaccio@41,-38', 'Via Pasquale Matera@97,-85', "Viale Amedeo D'Aosta@379,-192", 'Via Salvatore Cappello@-15,-481', 'Corso dei Mille@30,-312'] },
  { id: 'mondello', name: 'Mondello', c: [38.1995, 13.3290], stops: ['Viale Regina Elena', 'Via Principe di Scalea', 'Viale delle Viole'] },
  { id: 'liberta', name: 'Libertà', c: [38.1290, 13.3450], stops: ['Via Malaspina', 'Via Emanuele Notarbartolo', 'Via Terrasanta', 'Via Catania'] },
];
const win = {}; vm.runInNewContext(fs.readFileSync(root + 'palermo-data.js', 'utf8'), { window: win });
const K = 111320 * Math.cos(38.11572 * Math.PI / 180), proj = (la, lo) => [(lo - 13.36126) * K, -(la - 38.11572) * 110540];
const G = createGraph(); G.setBaked(win.PALERMO_DATA.roads);
const { NX, NZ, NOUT } = G, loaded = new Set();
function load(x, z, r) {
  for (let i = Math.floor(x / 500) - r; i <= Math.floor(x / 500) + r; i++) for (let j = Math.floor(z / 500) - r; j <= Math.floor(z / 500) + r; j++) {
    const key = i + '_' + j; if (loaded.has(key)) continue; loaded.add(key);
    let t; try { t = JSON.parse(fs.readFileSync(root + 'world/tiles/' + key + '.json')); } catch (e) { continue; }
    if (!t.roads || !t.roads.length) continue;
    const st = G.addTile(key, t.roads, i * 500, j * 500); while (!G.stepTile(st, 50));
  }
}
const allowed = c => G.baseAllowed(c, 3) && G.alive[3][c.id] === 1;   // the ape's own rule; a pedestrian street costs six times its length, so a loop only crosses one when there is no other way
function shortest(a, b, banned) {   // Dijkstra on length, big roads a little dearer
  const dist = new Map([[a, 0]]), prev = new Map(), open = [[0, a]];
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [d, n] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (n === b) break; if (d > dist.get(n)) continue;
    for (const c of NOUT[n]) { if (!allowed(c) || (banned && banned.has(c.id))) continue; const nd = d + c.len * (c.ped ? 6 : c.rank >= 4 ? 1.3 : 1); if (nd < (dist.get(c.b) ?? 1e9)) { dist.set(c.b, nd); prev.set(c.b, c); open.push([nd, c.b]); } }
  }
  if (!prev.has(b)) return null; const out = []; for (let e = prev.get(b); e; e = prev.get(e.a)) out.unshift(e); return out;
}
const reachOf = a => { const seen = new Set([a]); let fr = [a]; while (fr.length) { const nf = []; for (const n of fr) for (const e of NOUT[n]) if (allowed(e) && !seen.has(e.b)) { seen.add(e.b); nf.push(e.b); } fr = nf; } return seen; };
const strongOf = a => {   // the nodes a three-wheeler can reach from a and get back from: a stop must be in one of these
  const fwd = reachOf(a), seen = new Set([a]); let fr = [a];
  while (fr.length) { const nf = []; for (const n of fr) for (const e of G.NIN[n]) if (allowed(e) && !seen.has(e.a)) { seen.add(e.a); nf.push(e.a); } fr = nf; }
  return new Set([...fwd].filter(n => seen.has(n)));
};
const only = process.argv[2], baked = [];
for (const Q of QUARTERS) {
  if (only && Q.id !== only) continue;
  const c0 = proj(Q.c[0], Q.c[1]); load(c0[0], c0[1], 2);
  const at = spec => {
    const [nm, off] = spec.split('@'), [ox, oz] = off ? off.split(',').map(Number) : [0, 0]; let best = null, bd = 1e18;
    for (let i = Math.floor(c0[0] / 500) - 2; i <= Math.floor(c0[0] / 500) + 2; i++) for (let j = Math.floor(c0[1] / 500) - 2; j <= Math.floor(c0[1] / 500) + 2; j++) {
      let t; try { t = JSON.parse(fs.readFileSync(root + 'world/tiles/' + i + '_' + j + '.json')); } catch (e) { continue; }
      for (const rd of t.roads || []) if (rd.n === nm && !rd.tn) for (let q = 0; q + 1 < rd.p.length; q += 2) { const d = Math.hypot(rd.p[q] - c0[0] - ox, rd.p[q + 1] - c0[1] - oz); if (d < bd) { bd = d; best = [rd.p[q], rd.p[q + 1]]; } }
    }
    if (!best) throw new Error('no street ' + nm); load(best[0], best[1], 1); return best;
  };
  const ps = Q.stops.map(at); G.recomputeAlive();
  const near = p => { const m = new Map(); G.eachEdgeNear(p[0], p[1], 150, e => { if (!allowed(e) || e.ped) return; for (const n of [e.a, e.b]) m.set(n, (NX[n] - p[0]) ** 2 + (NZ[n] - p[1]) ** 2); }); return [...m].sort((x, y) => x[1] - y[1]).map(x => x[0]); };
  let base = null, home = -1; const ns = [];
  for (const p of ps) {
    const cs = near(p); let pick = -1;
    if (!base) { let bs = 0; for (const n of cs.slice(0, 12)) { const r = strongOf(n); if (r.size > bs) { bs = r.size; base = r; home = n; pick = n; } } }
    else for (const n of cs) if (base.has(n)) { pick = n; break; }
    if (process.env.DBG) console.log('  stop', p.map(Math.round), 'cands', cs.length, 'in base', cs.filter(n => base && base.has(n)).length, 'base', base && base.size, 'pick', pick);
    ns.push(pick);
  }
  if (ns.some(n => n < 0)) { console.log(Q.id, 'a stop has no node', ns); process.exit(1); }
  for (let i = ns.length - 1; i > 0; i--) if (ns[i] === ns[i - 1]) ns.splice(i, 1);
  let edges;
  for (let tries = 0; ; tries++) {   // the loop must never turn round in a street (a vehicle on the graph does not): a stop that makes it do so is dropped
    edges = []; const ban = new Set();
    for (let i = 0; i < ns.length; i++) {
      const last = i === ns.length - 1, l = (last ? shortest(ns[i], ns[0], ban) : null) || shortest(ns[i], ns[(i + 1) % ns.length], null);
      if (!l) { console.log(Q.id, 'no way from stop', i); process.exit(1); }
      for (const e of l) { if (!last) { ban.add(e.id); if (e.rev >= 0) ban.add(e.rev); } edges.push(e); }
    }
    const bad = edges.findIndex((e, i) => edges[(i + 1) % edges.length].id === e.rev);
    if (bad < 0) break;
    const si = ns.indexOf(edges[bad].b); if (si < 0 || ns.length < 3 || tries > 4) { console.log(Q.id, 'turns round at', NX[edges[bad].b] | 0, NZ[edges[bad].b] | 0, 'and no stop to drop'); process.exit(1); }
    console.log('  ' + Q.id + ': dropped the stop at ' + (NX[ns[si]] | 0) + ', ' + (NZ[ns[si]] | 0) + ' (the loop turned round there)'); ns.splice(si, 1);
  }
  let len = 0, uturn = 0, ped = 0; const names = [];
  for (let i = 0; i < edges.length; i++) { const e = edges[i], n = edges[(i + 1) % edges.length]; len += e.len; if (e.ped) ped += e.len; if (n.id === e.rev) uturn++; if (e.b !== n.a) { console.log(Q.id, 'broken at', i); process.exit(1); } if (names[names.length - 1] !== (e.name || '?')) names.push(e.name || '?'); }
  const pts = [NX[edges[0].a], NZ[edges[0].a]]; for (const e of edges) pts.push(NX[e.b], NZ[e.b]);
  console.log(Q.id, edges.length + ' edges', Math.round(len) + ' m', uturn + ' u-turns, ' + Math.round(ped) + ' m of pedestrian street\n  ' + names.join(' > '));
  baked.push({ id: Q.id, name: Q.name, len: Math.round(len), pts: pts.map(v => +v.toFixed(1)) });
}
if (!only) {
  const head = `// The loops of the knife-grinders (l'arrotino, src/arrotini.js), one per quarter: the vertices (x, z) of a closed route along real streets, out and back to where it started, for a three-wheeler (the road graph
// of src/traffic-graph.js, no fast roads, no pedestrian streets). Baked by tools/arrotino-routes.mjs from the world tiles: edit the stops there and run it, not this file.\n`;
  fs.writeFileSync(root + 'src/arrotino-routes.js', head + 'export const ARROTINO_ROUTES = [\n' + baked.map(r => `  { id: '${r.id}', name: '${r.name}', len: ${r.len}, pts: [${r.pts.join(',')}] },`).join('\n') + '\n];\n');
  console.log('written src/arrotino-routes.js');
}
