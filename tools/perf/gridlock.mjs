// Traffic gridlock scan: run the traffic fast-forward at a list of junctions and count the vehicles that stand still there.
//   tools/release/withbrowser.sh node tools/perf/gridlock.mjs --dist <dir> [--secs 240] [--only zw18,qc] [--player at|off] [--seed 1] [--json out.json] [--dump [all]] [--warm s] [--runs n]
// One page, teleported from spot to spot. At each spot Math.random is seeded, the signal clock runs on the simulated time, the camera stands at eye height on the
// spot and the traffic is stepped by hand as fast as it goes (the game's own frame loop no longer steps it). --player off moves the lapa off the road (no road within
// 12 m) after the tiles are in, as it is an obstacle to the traffic; at, the default, leaves it on the spot facing the heading, as a survey shot does. --runs n runs
// each spot n times with different seeds, each starting with no vehicles (the first run also has the road graph still building, as just after a teleport);
// --warm s runs s seconds first and then clears the vehicles. Takes a few seconds per spot and run.
// Per spot: jam s (seconds in which 3 or more vehicles within 60 m of the spot have moved less than 6 m in the last 30 s; a vehicle waiting at a red light, at a bus stop,
// behind the lapa or behind a double-parked car, directly or down a queue, is not counted),
// max (most such vehicles at once), long (vehicles that stood like that for over 60 s), gone (vehicles that vanished after standing for over 30 s: the safety net),
// pass (vehicles that came within 25 m of the spot),
// red (crossed the stop line on red; + the ones a light let go after holding them a minute), overlap (pair-seconds of two vehicles more than 0.4 m into each other),
// held (vehicle-seconds of giving way at a junction), and the mean and worst traffic step in ms. --dump prints the vehicles standing still the first time a spot jams (all: every 20 s after).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const DIST = path.resolve(arg('dist', 'dist')), SECS = +arg('secs', 240), ONLY = arg('only', null), PLAYER = arg('player', 'at'), SEED = +arg('seed', 1), DUMP = arg('dump', false), WARM = +arg('warm', 0), RUNS = +arg('runs', 1);
const LAT0 = 38.11572, LON0 = 13.36126, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540, proj = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
// name: [x, z, heading in degrees (0 = north, 90 = east)]
const SPOTS = {
  zw18: [-5646, -1072, 42],                       // Passo di Rigano, Via Bronte at Via Castellana (the jam that was seen)
  qc: [...proj(38.11573, 13.36138), 0],           // Quattro Canti
  politeama: [...proj(38.12460, 13.35580), 0],    // Piazza Politeama / Via Ruggero Settimo
  indip: [...proj(38.11080, 13.35240), 90],       // Piazza Indipendenza
  stazione: [...proj(38.10940, 13.36690), 0],     // Piazza Giulio Cesare, the station
  croci: [...proj(38.12870, 13.35360), 0],        // Piazza Croci
  notarb: [...proj(38.13470, 13.34730), 0],       // Via Libertà at Via Notarbartolo
  zw14: [-5997, 3547, 0],                         // Monreale old town, Via Palermo
  zw25: [-4823, -1764, 0],                        // Passo di Rigano, Viale Michelangelo
  zw27: [-4609, -1199, 0],                        // Viale Leonardo da Vinci
  zw36: [-3512, 604, 0],                          // Altarello, Via Giuseppe Pitrè
  zw40: [-3092, -1327, 0],                        // Uditore, Viale Leonardo da Vinci
  zw45: [-2737, 883, 0],                          // Borgo Nuovo, Viale Regione Siciliana
  zw01: [-8817, 3316, 0],                         // far west hills, a three-lane junction
};
const names = Object.keys(SPOTS).filter(n => !ONLY || ONLY.split(',').includes(n));
const { server, port } = await startServer(DIST, '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1024, height: 640 });
page.on('pageerror', e => console.log('pageerror', e.message.slice(0, 200)));
const [x0, z0] = SPOTS[names[0]];
await page.goto(`http://127.0.0.1:${port}/?help=0&debug&play&p2p=off&peds=0&time=11&clean&at=${x0},${z0}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('loading') && window.game?.traffic && window.__signals, { timeout: 240000, polling: 250 });
await page.evaluate(() => { const T = window.game.traffic; window.__tupd = T.update; T.update = () => {}; window.__simT = 1.7e9; window.__signals.clock.now = () => window.__simT; });
const rows = [];
for (const name of names) for (let run = 0; run < RUNS; run++) {
  const [x, z, hd] = SPOTS[name];
  await page.evaluate((x, z, hd) => new Promise(res => {
    const g = window.game; let done = false; g.world.teleport(x, z, () => { g.placeAt(x, z, Math.PI - hd * Math.PI / 180); done = true; });
    const t0 = performance.now(); let calm = 0;
    const tick = () => { calm = done && g.world.visiblePending() === 0 ? calm + 1 : 0; if (calm >= 30 || performance.now() - t0 > 60000) res(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), x, z, hd);
  const r = await page.evaluate((x, z, hd, secs, seed, player, dump, warm) => {
    const g = window.game, T = g.traffic, vs = T.debug.vs, cam = g.camera, upd = window.__tupd;
    let s = seed * 2654435761 >>> 0; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    if (player === 'off') {   // somewhere near with no road within 12 m
      const G = T.debug.G, o = {};
      for (let k = 0; k < 64; k++) { const a = k * 2.4, r = 25 + k; const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!G.edgeFor(px, pz, 1, 0, 12, o)) { g.car.x = px; g.car.z = pz; break; } }
    }
    const h = hd * Math.PI / 180, y = g.groundY(x, z) + 1.6;
    const aim = () => { cam.position.set(x, y, z); cam.up.set(0, 1, 0); cam.lookAt(x + Math.sin(h) * 50, y, z - Math.cos(h) * 50); cam.updateMatrixWorld(); };
    for (const v of vs) v.x += 1e5; aim(); upd(0.1, cam);   // the vehicles of the last run go (they are culled as out of range)
    if (warm) { for (let t = 0; t < warm; t += 0.1) { aim(); window.__simT += 0.1; upd(0.1, cam); } for (const v of vs) v.x += 1e5; aim(); upd(0.1, cam); }   // --warm: the road graph complete and the first vehicles gone
    // a queue behind the lapa, a red light, a double-parked car or a bus at its stop is not a gridlock: follow who it waits for
    const waitsForReason = v => { for (let o = v, k = 0; o && k < 30; k++) { if (o === 'player') return true; if (o.sigHold || o.hold2 || o.dwell > 0) return true; o = o.blocker || (o.hold ? o.why2 : null); } return false; };
    const near = (v, r) => (v.x - x) ** 2 + (v.z - z) ** 2 < r * r;
    let jam = 0, max = 0, gone = 0, steps = 0, ms = 0, worst = 0, dumped = null, red = 0, redLet = 0, overlap = 0, held = 0;
    const L = window.__signals.light, front = new Map();   // id -> metres from its front to the stop line of the light ahead, last step
    const long = new Set(), pass = new Set(), seen = new Map(), jt = new Map();   // jt: id -> [x, z, seconds within 6 m of there]
    for (let t = 0; t < secs; t += 0.1) {
      aim(); window.__simT += 0.1;
      const a = performance.now(); upd(0.1, cam); const d = performance.now() - a; ms += d; steps++; if (d > worst && t > 20) worst = d;
      for (const v of vs) {   // red runs: the front crosses the stop line (6.5 m before the node) while the light is red
        const e = v.route[0]; if (!e.sg || v.fly || !near(v, 120)) { front.delete(v.id); continue; }
        const f = e.len - v.t - v.ty.L / 2 - 6.5, f0 = front.get(v.id); front.set(v.id, f);
        if (f0 !== undefined && f0 > 0 && f <= 0 && L(e.sg.site, e.sg.g, window.__simT) === 2) { if (v.sigW >= 60) redLet++; else red++; }
      }
      if (Math.round(t * 10) % 10 === 0) {
        const ids = new Set(vs.map(v => v.id));
        for (const [id, st] of seen) if (!ids.has(id) && st > 30) gone++;
        seen.clear();
        let n = 0; const stuck = [];
        for (const v of vs) {
          let j = jt.get(v.id); if (!j || Math.abs(v.x - j[0]) > 6 || Math.abs(v.z - j[1]) > 6) jt.set(v.id, j = [v.x, v.z, 0]); else if (!v.sigHold && !v.dwell && !v.hold2) j[2]++;
          seen.set(v.id, j[2]);
          if (near(v, 25)) pass.add(v.id);
          if (j[2] > 60 && near(v, 60)) long.add(v.id);
          if (j[2] > 30 && !v.fly && near(v, 60) && !waitsForReason(v)) { n++; stuck.push(v); }
        }
        if (n >= 3) jam++;
        for (let i = 0; i < vs.length; i++) { const v = vs[i]; if (v.fly || !near(v, 60)) continue; if (v.hold) held++;   // overlaps: two vehicles' collision circles more than 0.4 m into each other
          for (let k = i + 1; k < vs.length; k++) { const o = vs[k]; if (o.fly || Math.abs(o.x - v.x) > 8 || Math.abs(o.z - v.z) > 8) continue; let hit = false;
            for (const [za, ra] of v.ty.circ) for (const [zb, rb] of o.ty.circ) { const dx = v.x + Math.sin(v.h) * za - o.x - Math.sin(o.h) * zb, dz = v.z + Math.cos(v.h) * za - o.z - Math.cos(o.h) * zb; if (dx * dx + dz * dz < (ra + rb - 0.4) ** 2) hit = true; }
            if (hit) overlap++; } }
        if (n > max) max = n;
        if (dump && n >= 3 && (!dumped || (dump === 'all' && Math.round(t) % 20 === 0))) (dumped = dumped || []).push('t=' + Math.round(t), ...vs.filter(v => (v.stuck > 5 || v.v < 0.3) && near(v, 70)).map(v => { const e = v.route[0], fx = Math.sin(v.h), fz = Math.cos(v.h);
          return { id: v.id, ty: v.name, x: +v.x.toFixed(1), z: +v.z.toFixed(1), v: +v.v.toFixed(2), stuck: +v.stuck.toFixed(0), jam: +(v.jamT || 0).toFixed(0), gh: !!(v.ghost && v.ghost.until > 0), wait: +v.wait.toFixed(1), t: +v.t.toFixed(1), elen: +e.len.toFixed(1),
            edge: `${e.id} ${e.name || '-'} ow${+e.ow} r${e.rank} a${e.a} b${e.b}`, along: +(e.dx * fx + e.dz * fz).toFixed(2), next: v.route.slice(1).map(q => q.id + ':' + (q.name || '-')).join(','),
            hold: v.hold, why2: v.why2 && v.why2.id, blocker: v.blocker === 'player' ? 'player' : v.blocker && v.blocker.id, sigHold: v.sigHold, sigW: +v.sigW.toFixed(0), lazy: v.lazy, fly: !!v.fly, stopT: +v.stopT.toFixed(1), hold2: v.hold2, dp: !!v.dp, cop: !!v.cop, dwell: +(v.dwell || 0).toFixed(1),
            chain: (() => { const out = []; for (let o = v, k = 0; o && k < 80; k++) { if (o === 'player') { out.push('player'); break; } out.push(o.id + (o.sigHold ? 'R' : '') + (o.hold2 ? 'D' : '') + (o.hold ? 'h' : '') + (!o.route[1] ? 'E' : '') + (o.v > 0.5 ? 'm' : '') + '@' + o.route[0].id); o = o.blocker || (o.hold ? o.why2 : null); } return out.join(' '); })() }; }));
      }
    }
    return { jam, max, long: long.size, gone, pass: pass.size, red, redLet, overlap, held, stepMs: +(ms / steps).toFixed(2), worstMs: +worst.toFixed(1), n: vs.length, dumped };
  }, x, z, hd, SECS, SEED + run * 101, PLAYER, DUMP, WARM);
  rows.push({ name, run, ...r });
  console.log((name + (RUNS > 1 ? '/' + run : '')).padEnd(10), `jam ${String(r.jam).padStart(3)} s  max ${String(r.max).padStart(2)}  long ${String(r.long).padStart(2)}  gone ${String(r.gone).padStart(2)}  pass ${String(r.pass).padStart(3)}  red ${r.red}+${r.redLet}  overlap ${r.overlap}  held ${r.held}  step ${r.stepMs} ms (worst ${r.worstMs})  vehicles ${r.n}`);
  if (r.dumped) for (const d of r.dumped) console.log('   ', JSON.stringify(d));
}
if (RUNS > 1) for (const name of names) { const rs = rows.filter(r => r.name === name), sum = k => rs.reduce((a, r) => a + r[k], 0);
  console.log((name + ' all').padEnd(10), `jam ${String(sum('jam')).padStart(3)} s  max ${Math.max(...rs.map(r => r.max))}  long ${sum('long')}  gone ${sum('gone')}  pass ${sum('pass')}  red ${sum('red')}+${sum('redLet')}  overlap ${sum('overlap')}  held ${sum('held')}  step ${(sum('stepMs') / rs.length).toFixed(2)} ms`); }
if (arg('json', null)) fs.writeFileSync(arg('json'), JSON.stringify(rows, null, 1));
await browser.close(); server.close(); process.exit(0);
