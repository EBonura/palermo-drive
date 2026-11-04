// Route check: can the car really drive the pink guidance line of every mission? (src/route-guide.js, src/event-routes.js)
//
//   /private/tmp/claude-501/withbrowser.sh node tools/route-check/check.mjs [--root dist] [--only <regexp on leg id>] [--drive N] [--drive-only <regexp>] [--src <checkout>] [--no-returns] [--no-replans] [--out dir]
//
// Build first (cd tools/build && node build.mjs); --root is the dist folder (default: ../../dist). The script serves it itself and opens one headless Chrome (silent).
// Prints one line per failed leg: FAIL <leg> (<kind>) at <x>,<z> (<m> m along it): <reason> [...], and a summary; exits 1 when any leg fails, 0 when none does.
//
// What is a leg: see legs.mjs. Baked lines (fares, urgent, horns, rave, races), the line the guide computes when the car strays from a baked one (3 stray points per line), and
// the way back to the vendor / the pub / the pal from every lost item (the guide works it out on the traffic graph).
// What is checked, on the REAL loaded world (page.js, tiles at full detail, samples every 2 m). The car may be up to 2 m beside the line (17 offsets) and must be able to follow it
// as a circle of the lapa's radius, moving at most 0.5 m sideways per 2 m:
//   offroad  no drivable ground (grass, sand, scrub; gravel counts) beside the line for 5 m or more
//   wall     buildings, walls, landmark walls, quay walls, solid props (bus shelter, kiosk, hydrant...) and bridge parapets on the line's own level leave no way through
//   level    the line changes between the ground and a deck or tunnel floor with a height jump of more than 1.2 m
//   noroute  the guide found no way (strays and returns)
//   unloaded the world did not load there in time (counts as a failure: it was not checked)
//   WARN     a breakable fence or a market stall across the line (the drives went through them), or a lane with under 1.5 m of free width for 4 m or more (narrow: a bend there can stop a lapa)
// Time: about 16 minutes for the whole sweep (800 legs, 280000 samples, 160 tile loads for the baked lines); a drive is 20 s to 10 min of real time each.
// --drive N: then N real drives (drive.mjs): a scripted driver steers the real car along each line through the real physics. The drives chosen are every leg the geometry flags
// (up to N) and then a spread of the legs it passes.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadLegs } from './legs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = k => process.argv.includes('--' + k);
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), OUT = path.resolve(arg('out', '/private/tmp/claude-501/routecheck/out'));
const ONLY = arg('only') ? new RegExp(arg('only')) : null, DRIVE_N = +arg('drive', 0);
fs.mkdirSync(OUT, { recursive: true });

// ---- thresholds
export const CFG = {
  STEP: 2,            // m between samples
  CAR_R: 0.74,        // half width of the lapa (R in src/vehicle.js)
  MARGIN: 0.10,       // a wall closer than CAR_R + MARGIN to the line blocks it
  OFFROAD_RUN: 5,     // m of non-road before it counts
  LEVEL_STEP: 1.2,    // m of height change in one 2 m step (the car steps up onto a deck at most 1.2 m above it: hooks.level in src/bridges.js)
  STRAYS: [0.25, 0.5, 0.75],
  NARROW: 1.5,        // m of free travel for the car centre below which a stretch is reported as narrow (a warning)
  FENCE_GAP: 0,       // m: a fence or stall across the line with no gap narrower than this fails. 0: a fence is only a warning. With 1.0 the drives showed it too strict: 7 of 9 drives through fence-only lines went through (the panel breaks above 2.6 m/s); the two that stopped were slow starts
};

const t0 = Date.now(), log = (...a) => console.error(((Date.now() - t0) / 1000).toFixed(0).padStart(5) + 's', ...a);
const { baked, returns, SNAP } = await loadLegs(path.resolve(arg("src", REPO)));   // --src <checkout>: the data (event-routes.js, event-places.js, ...) of another source tree, with --root its dist
let legs = baked.filter(l => !ONLY || ONLY.test(l.id)), rets = flag('no-returns') ? [] : returns.filter(l => !ONLY || ONLY.test(l.id));

// ---- sampling
function resample(flat, step) {
  const xs = [], zs = [], ss = [], hx = [], hz = []; let acc = 0;
  for (let i = 0; i + 3 < flat.length; i += 2) {
    const x0 = flat[i], z0 = flat[i + 1], L = Math.hypot(flat[i + 2] - x0, flat[i + 3] - z0), n = Math.max(1, Math.ceil(L / step)), dx = L ? (flat[i + 2] - x0) / L : 0, dz = L ? (flat[i + 3] - z0) / L : 1;
    for (let k = 0; k < n; k++) { const u = k / n; xs.push(x0 + (flat[i + 2] - x0) * u); zs.push(z0 + (flat[i + 3] - z0) * u); ss.push(acc + L * u); hx.push(dx); hz.push(dz); }
    acc += L;
  }
  xs.push(flat[flat.length - 2]); zs.push(flat[flat.length - 1]); ss.push(acc); hx.push(hx[hx.length - 1] || 0); hz.push(hz[hz.length - 1] || 1);
  return { xs, zs, ss, hx, hz };
}

// ---- the browser
const { server, port } = await startServer(ROOT, '');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || (process.env.PD_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless: 'new', protocolTimeout: 900000,
  args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--no-first-run'] });
const closeAll = async () => { await browser.close().catch(() => {}); server.close(); };
process.on('SIGINT', async () => { await closeAll(); process.exit(130); });
const page = await browser.newPage(); await page.setViewport({ width: 480, height: 270, deviceScaleFactor: 1 });
const pageErrs = []; page.on('pageerror', e => pageErrs.push(e.message.slice(0, 160)));
const first = (legs[0] || rets[0]).from;
await page.goto(`http://127.0.0.1:${port}/?help=0&p2p=off&debug&fixres&play&time=14&cash=0&tricap=1e9&rfull=800&at=${Math.round(first[0])},${Math.round(first[1])},0`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.game && window.__missions && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
await page.evaluate(fs.readFileSync(path.join(HERE, 'page.js'), 'utf8'));
if (!(await page.evaluate(() => !!window.__rc))) { console.error('page.js did not install:', pageErrs.join(' | '), '(is the build current? it needs window.game.props and .hooks from ?debug)'); await closeAll(); process.exit(2); }
log('game loaded; tiles of the world:', await page.evaluate(() => Object.keys(window.game.world.manifest.tiles).length));

const T = 500, tkey = (x, z) => Math.floor(x / T) + '_' + Math.floor(z / T);
let cur = first.slice(), tileMs = [], unloadedTiles = new Set();
// Probe a list of polylines [{key, flat}]: tile by tile (nearest next), each tile focused once. Returns Map key -> { xs, zs, ss, rows }.
async function sweep(items) {
  const res = new Map(), buckets = new Map();
  for (const it of items) {
    const sm = resample(it.flat, CFG.STEP), rows = new Array(sm.xs.length).fill(null); res.set(it.key, { ...sm, rows });
    for (let i = 0; i < sm.xs.length; i++) { const k = tkey(sm.xs[i], sm.zs[i]); let b = buckets.get(k); if (!b) buckets.set(k, b = []); b.push([it.key, i]); }
  }
  const todo = new Set(buckets.keys());
  while (todo.size) {
    let best = null, bd = 1e18;
    for (const k of todo) { const [i, j] = k.split('_').map(Number), d = Math.hypot((i + 0.5) * T - cur[0], (j + 0.5) * T - cur[1]); if (d < bd) { bd = d; best = k; } }
    todo.delete(best);
    { const [i0, j0] = best.split("_").map(Number), cx = (i0 + 0.5) * T, cz = (j0 + 0.5) * T; let bd2 = 1e18; for (const [bk, bi] of buckets.get(best)) { const rr = res.get(bk), d = Math.hypot(rr.xs[bi] - cx, rr.zs[bi] - cz); if (d < bd2) { bd2 = d; cur = [rr.xs[bi], rr.zs[bi]]; } } }
    const ms = await page.evaluate((x, z) => window.__rc.focus(x, z), cur[0], cur[1]); tileMs.push(ms); if (flag("verbose") || tileMs.length % 25 === 0) log("tile", best, "focus ms", ms, "left", todo.size);
    if (ms < 0) { unloadedTiles.add(best); log("tile", best, "not ready:", await page.evaluate(() => window.__rc_bad.join(" "))); }
    const pts = buckets.get(best);
    for (let c = 0; c < pts.length; c += 3000) {
      const part = pts.slice(c, c + 3000), flat = []; for (const [key, idx] of part) { const r = res.get(key); flat.push(r.xs[idx], r.zs[idx], r.hx[idx], r.hz[idx]); }
      const out = await page.evaluate(f => window.__rc.probe(f), flat);
      part.forEach(([key, idx], q) => { res.get(key).rows[idx] = out[q]; });
    }
  }
  return res;
}

// ---- analysis of one probed line: a list of problems { r (reason), s (m along), x, z, len, info }
const DP_REACH = 2;   // the car moves at most 2 offsets (0.5 m) sideways per 2 m step
const FULL = (1 << 17) - 1;
const dil = m => { let r = m; for (let k = 1; k <= DP_REACH; k++) r |= (m << k) | (m >>> k); return r & FULL; };
// is there a way through? masks[i] = the free offsets at sample i. Returns fail[i] = true where the set of reachable offsets became empty (and the walk restarts there)
function dp(masks) {
  const fail = new Array(masks.length).fill(false); let reach = FULL;
  for (let i = 0; i < masks.length; i++) { let r = dil(reach) & masks[i]; if (!r) { fail[i] = true; r = masks[i] || FULL; } reach = r; }
  return fail;
}
function analyse(sm) {
  const { xs, zs, ss, rows } = sm, P = [], n = rows.length;
  const open = {}, close = (r, i) => { const o = open[r]; if (!o) return; o.len = ss[i] - o.s0 + CFG.STEP; P.push({ r, s: o.s0, x: o.x, z: o.z, len: o.len, info: o.info }); delete open[r]; };
  const flag = (r, i, info) => { if (!open[r]) open[r] = { s0: ss[i], x: xs[i], z: zs[i], info }; };
  // the height the car is at (ground or a deck within a step of the last height), and which wall mask applies
  const M = { sf: new Array(n), w: new Array(n), fe: new Array(n) }; let y = null, lastUp = false;
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    if (!r) { flag('unloaded', i, {}); M.sf[i] = M.w[i] = M.fe[i] = FULL; continue; } else close('unloaded', i - 1);
    const [surf, deck, gy, sf, wg, wd, fe, dwc, soft] = r, onDeck = deck !== null && deck === deck && deck !== undefined;
    let up = false;
    if (y === null) { up = onDeck && Math.abs(deck - gy) < 1.5; y = up ? deck : gy; }
    else { const up0 = lastUp; const cand = [[gy, false]]; if (onDeck) cand.push([deck, true]); let b = cand[0]; for (const c of cand) if (Math.abs(c[0] - y) < Math.abs(b[0] - y)) b = c; if (b[1] !== up0 && Math.abs(b[0] - y) > CFG.LEVEL_STEP) flag('level', i, { dy: +(b[0] - y).toFixed(1) }); else close('level', i - 1); y = b[0]; up = b[1]; }
    M.sf[i] = sf; M.w[i] = up ? wd : wg; M.fe[i] = fe; lastUp = up;
  }
  for (const r of Object.keys(open)) close(r, n - 1);
  // surface first: a stretch of at least OFFROAD_RUN m with no drivable ground beside the line is off road; shorter gaps (a seam in the street polygons, a kerb) are ignored
  let fa = dp(M.sf), runStart = -1;
  const sfOk = M.sf.slice();
  for (let i = 0; i <= n; i++) { if (i < n && fa[i]) { if (runStart < 0) runStart = i; } else if (runStart >= 0) { if ((i - runStart) * CFG.STEP >= CFG.OFFROAD_RUN) { flag('offroad', runStart, { surf: ['hard', 'gravel', 'grass', 'sand', 'rough'][rows[runStart][0]] }); close('offroad', i - 1); } else for (let q = runStart; q < i; q++) sfOk[q] = FULL; runStart = -1; } }
  const wallM = sfOk.map((m, i) => m & M.w[i]), fenceM = wallM.map((m, i) => m & M.fe[i]);
  const fw = dp(wallM), ff = dp(fenceM), fs0 = dp(sfOk);
  const runs = (arr, skip, r, info) => { let st = -1; for (let i = 0; i <= n; i++) { const on = i < n && arr[i] && !skip[i]; if (on && st < 0) st = i; if (!on && st >= 0) { flag(r, st, info(st)); close(r, i - 1); st = -1; } } };
  runs(fw, fs0, 'wall', i => ({ free: freeWidth(M.sf[i] & M.w[i]) }));
  runs(ff, fw, 'fence', i => ({ free: freeWidth(wallM[i] & M.fe[i]) }));
  // narrow: the widest band the car's centre can travel in, beside the line, is under NARROW m for 4 m or more (a street of about 3 m between walls: a lapa gets through on a straight, not round a bend)
  { let st = -1; for (let i = 0; i <= n; i++) { const w = i < n ? freeWidth(sfOk[i] & M.w[i]) : 99, on = w < CFG.NARROW && w > 0; if (on && st < 0) st = i; if (!on && st >= 0) { if ((i - st) * CFG.STEP >= 4) { flag('narrow', st, { free: Math.min(...Array.from({ length: i - st }, (_, q) => freeWidth(sfOk[st + q] & M.w[st + q]))) }); close('narrow', i - 1); } st = -1; } } }
  return P.sort((a, b) => a.s - b.s);
}
const freeWidth = m => { let best = 0, run = 0; for (let k = 0; k < 17; k++) { if (m >> k & 1) { run++; best = Math.max(best, run); } else run = 0; } return +(best * 0.25).toFixed(2); };

// ---- 1. the baked lines
const fails = [], legStat = new Map();   // legStat: leg id -> { checked: n samples, problems }
const note = (leg, sub, problems, extra = {}) => { const id = sub ? leg.id + ' ' + sub : leg.id; legStat.set(id, { leg, sub, problems, ...extra }); };
log(`${legs.length} baked lines, ${rets.length} return starts; sweeping`);
const sw = await sweep(legs.map(l => ({ key: l.id, flat: l.pts })));
for (const l of legs) note(l, '', analyse(sw.get(l.id)), { sm: sw.get(l.id), flat: l.pts });
log('baked lines done; tiles focused:', tileMs.length, 'median focus ms', tileMs.slice().sort((a, b) => a - b)[tileMs.length >> 1]);

// ---- 2. the line the guide computes when the car strays from a baked one
if (!flag('no-replans')) {
  const R = [];
  for (const l of legs) { if (l.kind === 'race') continue; const total = (() => { let a = 0; for (let i = 0; i + 3 < l.pts.length; i += 2) a += Math.hypot(l.pts[i + 2] - l.pts[i], l.pts[i + 3] - l.pts[i + 1]); return a; })(); for (const f of CFG.STRAYS) R.push({ l, s: f * total, f }); }
  // by tile of the stray point: one focus each
  const byTile = new Map(); for (const r of R) { const k = (() => { let acc = 0, p = r.l.pts; for (let i = 0; i + 3 < p.length; i += 2) { const L = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]); if (acc + L >= r.s) { const u = L ? (r.s - acc) / L : 0; r.px = p[i] + (p[i + 2] - p[i]) * u; r.pz = p[i + 1] + (p[i + 3] - p[i + 1]) * u; return tkey(r.px, r.pz); } acc += L; } return tkey(p[p.length - 2], p[p.length - 1]); })(); (byTile.get(k) || byTile.set(k, []).get(k)).push(r); }
  const todo = new Set(byTile.keys()), plans = [];
  while (todo.size) {
    let best = null, bd = 1e18; for (const k of todo) { const [i, j] = k.split('_').map(Number), d = Math.hypot((i + 0.5) * T - cur[0], (j + 0.5) * T - cur[1]); if (d < bd) { bd = d; best = k; } }
    todo.delete(best); { const r0 = byTile.get(best)[0]; cur = [r0.px, r0.pz]; }
    await page.evaluate((x, z) => window.__rc.focus(x, z), cur[0], cur[1]);
    await new Promise(r => setTimeout(r, 2500));   // the traffic graph takes the tile a moment after it is built (it adds it in 2 ms slices and judges the roads a second later)
    for (const r of byTile.get(best)) {
      const p = await page.evaluate((flat, s) => window.__rc.replanOff(flat, s), r.l.pts, r.s);
      let pts = p.pts;
      if (pts) {   // keep the new part only: up to where the line is back on the baked one
        const A = r.l.pts; let cut = pts.length;
        for (let q = 0; q + 1 < pts.length; q += 2) { let d = 1e9; for (let k = 0; k + 3 < A.length; k += 2) { const dx = A[k + 2] - A[k], dz = A[k + 3] - A[k + 1], l2 = dx * dx + dz * dz, u = l2 ? Math.max(0, Math.min(1, ((pts[q] - A[k]) * dx + (pts[q + 1] - A[k + 1]) * dz) / l2)) : 0; d = Math.min(d, Math.hypot(pts[q] - A[k] - dx * u, pts[q + 1] - A[k + 1] - dz * u)); if (d < 1.5) break; } if (d < 1.5 && q > 6) { cut = q + 2; break; } }
        pts = pts.slice(0, cut);
      }
      plans.push({ ...r, p, pts });
    }
  }
  const ok = plans.filter(p => p.pts && p.pts.length >= 4);
  const sw2 = await sweep(ok.map((p, n) => ({ key: 'stray' + n, flat: p.pts })));
  ok.forEach((p, n) => { const sub = `stray@${Math.round(p.f * 100)}% from ${Math.round(p.p.from[0])},${Math.round(p.p.from[1])}`; note(p.l, sub, analyse(sw2.get('stray' + n)), { sm: sw2.get('stray' + n), flat: p.pts, stray: true }); });
  for (const p of plans) if (!p.pts || p.pts.length < 4) note(p.l, `stray@${Math.round(p.f * 100)}%`, [{ r: 'noroute', s: p.s, x: p.px, z: p.pz, len: 0, info: { why: (p.p && p.p.why) || 'none' } }], { stray: true, flat: null });
  log('strays done:', plans.length, 'plans,', plans.filter(p => !p.pts).length, 'without a line');
}

// ---- 3. the way back from each lost item (guide.to on the traffic graph)
if (rets.length) {
  const groups = new Map(); for (const r of rets) { const k = r.id.split('#')[0]; (groups.get(k) || groups.set(k, []).get(k)).push(r); }
  const todo = new Set(groups.keys()), pending = [];
  while (todo.size) {
    let best = null, bd = 1e18; for (const k of todo) { const g = groups.get(k)[0], d = Math.hypot(g.to[0] - cur[0], g.to[1] - cur[1]); if (d < bd) { bd = d; best = k; } }
    todo.delete(best); const g = groups.get(best); cur = g[0].to.slice();
    const ms = await page.evaluate((x, z) => window.__rc.focus(x, z), cur[0], cur[1]); tileMs.push(ms);
    await new Promise(r => setTimeout(r, 2500));
    for (const r of g) { const p = await page.evaluate((a, b, c, d) => window.__rc.planTo(a, b, c, d), r.from[0], r.from[1], r.to[0], r.to[1]); pending.push({ r, p }); }
    // probe now, while the place is loaded
    const withPts = pending.filter(q => q.p.pts && q.p.pts.length >= 4 && !q.done);
    const swr = await sweep(withPts.map(q => ({ key: q.r.id, flat: q.p.pts })));
    for (const q of withPts) { q.done = true; note(q.r, '', analyse(swr.get(q.r.id)), { sm: swr.get(q.r.id), flat: q.p.pts }); }
    for (const q of pending) if (!q.done && !q.p.pts) { q.done = true; note(q.r, '', [{ r: 'noroute', s: 0, x: q.r.from[0], z: q.r.from[1], len: 0, info: { why: q.p.why || 'none' } }], { flat: null }); }
  }
  log('returns done:', pending.length);
}

// ---- report
let failedLegs = 0, nBaked = 0, nStray = 0, nRet = 0, failBaked = 0, failStray = 0, failRet = 0, sampleCount = 0;
const reasons = {}, lines = [], raveLines = [], failList = [], warnLines = []; let warnLegs = 0;
for (const [id, st] of legStat) {
  const kind = st.leg.id.startsWith('return:') ? 'ret' : st.stray ? 'stray' : 'baked';
  if (kind === 'ret') nRet++; else if (kind === 'stray') nStray++; else nBaked++;
  if (st.sm) sampleCount += st.sm.xs.length;
  // a breakable fence or a market stall with a gap of a metre or more is a warning (the lapa goes through the gap or smashes it); with no gap it stops a lapa that is not going fast: a failure (a drive was blocked by one at the start of fare:pn>focacceria)
  const hardFence = p => p.r === 'fence' && p.info.free < CFG.FENCE_GAP, pr = st.problems.filter(p => (p.r !== 'fence' && p.r !== 'narrow') || hardFence(p)), fw = st.problems.filter(p => (p.r === 'fence' && !hardFence(p)) || p.r === 'narrow');
  if (fw.length) { warnLegs++; warnLines.push(`WARN ${id} (${st.leg.kind}) breakable fence, market stall or a lane under ${CFG.NARROW} m of free width on the line at ${Math.round(fw[0].x)},${Math.round(fw[0].z)} (${Math.round(fw[0].s)} m along), ${fw.length} place${fw.length > 1 ? "s" : ""}, free width ${fw[0].info.free} m`); }
  if (!pr.length) continue;
  failedLegs++; if (kind === 'ret') failRet++; else if (kind === 'stray') failStray++; else failBaked++;
  const worst = pr.slice().sort((a, b) => (b.r === 'wall') - (a.r === 'wall') || b.len - a.len)[0], cnt = {}; for (const p of pr) { cnt[p.r] = (cnt[p.r] || 0) + 1; reasons[p.r] = (reasons[p.r] || 0) + 1; }
  const line = `FAIL ${id} (${st.leg.kind}) at ${Math.round(worst.x)},${Math.round(worst.z)} (${Math.round(worst.s)} m along): ${worst.r}${worst.info && Object.keys(worst.info).length ? ' ' + JSON.stringify(worst.info) : ''} ${worst.len ? Math.round(worst.len) + ' m' : ''}${pr.length > 1 ? '; all: ' + Object.entries(cnt).map(([k, v]) => k + 'x' + v).join(' ') : ''}${st.leg.rave ? '  [rave: re-run after the rave move]' : ''}`;
  (st.leg.rave ? raveLines : lines).push(line); failList.push({ id, st, worst });
}
for (const l of lines.concat(raveLines)) console.log(l);
if (!flag("no-warn")) for (const l of warnLines) console.log(l);
console.log(`SUMMARY legs checked ${legStat.size} (baked ${nBaked}, strays ${nStray}, returns ${nRet}), samples ${sampleCount}, failed ${failedLegs} (baked ${failBaked}, strays ${failStray}, returns ${failRet}); reasons ${JSON.stringify(reasons)}; warnings (breakable fence / market stall across the line, not failures) ${warnLegs} legs; page errors ${pageErrs.length}; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ when: new Date().toISOString(), checked: legStat.size, failed: failedLegs, lines: lines.concat(raveLines), reasons }, null, 1));

// ---- pictures of the failures (JPEG, 800 px), one per failed baked/return leg: the worst spot
if (!flag('no-pictures')) {
  const maxPics = +arg('pictures', 40); let n = 0;
  for (const f of failList.slice(0, maxPics)) {
    if (!f.st.flat) continue;
    const w = f.worst; await page.evaluate((x, z) => window.__rc.focus(x, z), w.x, w.z);
    const url = await page.evaluate((x, z, flat) => window.__rc.picture(x, z, flat), w.x, w.z, f.st.flat);
    fs.writeFileSync(path.join(OUT, f.id.replace(/[^a-z0-9]+/gi, '_').slice(0, 80) + '.jpg'), Buffer.from(url.split(',')[1], 'base64')); n++;
  }
  log('pictures:', n, 'in', OUT);
}

globalThis.__rc_state = { legStat, failList, page, browser, port, closeAll, baked, SNAP, CFG, OUT, ROOT };
if (DRIVE_N > 0 || arg("drive-only")) { const { runDrives } = await import('./drive.mjs'); await runDrives({ ...globalThis.__rc_state, DRIVE_N, REPO, puppeteer, arg, log }); }
await closeAll();
process.exit(failedLegs ? 1 : 0);
