// What the pub fronts (src/pubs.js, src/pub-fronts.js) cost a frame, and whether a front is still the same picture.
//   tools/release/withbrowser.sh node tools/perf/pubfront.mjs drive --root <dist> [--time 22.5] [--cpu 6] [--runs 3] [--speed 16]
//       drives the lapa from (15, 5) to (371, -177) with game.placeAt every frame, the fronts thrown away first so each one is built on the way, and prints the
//       longest frame, the longest and the total time of the pubs' update in a frame, and which fronts were built with the longest step of each
//   tools/release/withbrowser.sh node tools/perf/pubfront.mjs tour --root <dist> [--time 22.5] [--cpu 6] [--speed 30]
//       the same over a long tour past every pub of the city centre and the west, one line per front
//   tools/release/withbrowser.sh node tools/perf/pubfront.mjs identity [--old <git ref>] [--files src/pub-fronts.js]
//       [--cpu 6] builds every kind of front the old way (the file as it was at <git ref>, default HEAD~N is given with --old) and the new way in one page, in the same order,
//       and compares the geometry arrays and the canvases' pixels byte for byte. Runs from the source tree (three.js from tools/build/node_modules).
// --root is a built site (node tools/build/build.mjs --out=<dir> --minify=false). The page needs ?debug (window.__missions.pubs) and runs muted.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const MODE = process.argv[2];
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const launch = () => puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

// ---------------------------------------------------------------------------------------------------------------------------------- the drive
async function drive(tourMode) {
  const { server, port } = await startServer(path.resolve(arg('root', path.join(REPO, 'dist'))), '');
  const browser = await launch(), TIME = arg('time', '22.5'), CPU = +arg('cpu', 6), RUNS = +arg('runs', 1), SPEED = +arg('speed', tourMode ? 30 : 16);
  const WAY = tourMode ? [[15, 5], [371, -177], [705, 280], [15, 5], [-1187, 20], [-733, -955], [-755, -974]] : [[15, 5], [371, -177]];
  const all = [];
  for (let run = 0; run < RUNS; run++) {
    const page = await browser.newPage(), errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await page.goto(`http://127.0.0.1:${port}/?debug&play&p2p=off&help=0&time=${TIME}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.game && window.__missions && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
    await wait(6000);
    await page.evaluate(async (x, z) => { await new Promise(res => { const t = setTimeout(res, 20000); window.game.world.teleport(x, z, () => { clearTimeout(t); res(); }); }); }, WAY[0][0], WAY[0][1]);
    await wait(4000);
    // every front is thrown away, so that each is built the way a first visit builds it (the shader programs are linked already, as after the loading screen)
    await page.evaluate(() => {
      const P = window.__missions.pubs, G = window.game;
      for (const v of P.venues) { if (v.front) { G.scene.remove(v.front.group); v.front.dispose(); v.front = null; v.shown = false; } v.build = null; }
      window.__log = []; const o = P.update, st = () => P.venues.map(v => (v.front ? 1 : 0) + (v.build ? 2 : 0)).join('');
      P.update = function (dt, idle) {
        const t0 = performance.now(), before = st(), cb = P.building ? P.building.def.id : '';   // (P.building: the front the new code is on; the old code has none)
        const r = o.call(this, dt, idle), dur = performance.now() - t0;
        window.__log.push([t0, dur, before, st(), cb, P.building ? P.building.def.id : '', window.game.car.x, window.game.car.z]); return r;
      };
    });
    const cdp = await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const res = await page.evaluate(async (way, speed) => {
      const G = window.game, P = window.__missions.pubs, c = G.car;
      const ids = P.venues.map(v => v.def.id), frames = [];
      let leg = 0, x = way[0][0], z = way[0][1], last = performance.now();
      return await new Promise(done => {
        const tick = now => {
          const dt = Math.min(0.2, (now - last) / 1000); frames.push([now, now - last]); last = now;
          let step = speed * dt;
          while (step > 0 && leg < way.length - 1) {
            const [bx, bz] = way[leg + 1], dx = bx - x, dz = bz - z, d = Math.hypot(dx, dz);
            if (d <= step) { x = bx; z = bz; step -= d; leg++; } else { x += dx / d * step; z += dz / d * step; step = 0; }
          }
          if (leg >= way.length - 1) return done({ frames, log: window.__log, ids, doors: P.venues.map(v => [v.door.x, v.door.z]) });
          const [bx, bz] = way[leg + 1];
          G.placeAt(x, z, Math.atan2(bx - x, bz - z)); requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, WAY, SPEED);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.close();
    // per frame: the time of the pubs' update calls that ran in it
    const F = res.frames.slice(2), L = res.log; let li = 0; const per = [];
    for (let i = 0; i < F.length; i++) { const t1 = i + 1 < F.length ? F[i + 1][0] : Infinity; let s = 0; while (li < L.length && L[li][0] < t1) { if (L[li][0] >= F[i][0] - F[i][1]) s += L[li][1]; li++; } per.push(s); }
    // the steps of each front: a call in which it was the one being built, was asked for or was finished; the frames after it was finished; where the lapa was
    const built = {}, n = res.ids.length, T0 = F[0][0];
    for (const [t, dur, b, a, cb, ca, cx, cz] of L) for (let k = 0; k < n; k++) {
      const id = res.ids[k], bk = +b[k], ak = +a[k];
      if (!(id === cb || id === ca || (bk !== ak))) continue;
      const B = built[id] = built[id] || { steps: 0, longest: 0, total: 0, asked: null, done: null, after: 0 }, dist = Math.hypot(cx - res.doors[k][0], cz - res.doors[k][1]);
      B.steps++; B.total += dur; B.longest = Math.max(B.longest, dur);
      if (bk === 0 && !B.asked) B.asked = [t, dist]; if (ak % 2 === 1 && bk % 2 === 0 && !B.done) { B.done = [t, dist]; B.after = Math.max(0, ...F.filter(f => f[0] >= t && f[0] <= t + 250).map(f => f[1])); }
    }
    const frameMs = F.map(f => f[1]);
    const longs = F.map((f, i) => [i, f[1], per[i], (f[0] - F[0][0]) / 1000]).filter(x => x[1] > 50).map(x => `#${x[0]} at ${x[3].toFixed(1)} s ${x[1].toFixed(0)} ms (pubs ${x[2].toFixed(1)})`);
    all.push({ frames: F.length, longestFrame: Math.max(...frameMs), longestPubs: Math.max(0, ...per), totalPubs: per.reduce((a, b) => a + b, 0), over50: frameMs.filter(f => f > 50).length, over100: frameMs.filter(f => f > 100).length, built, errs });
    console.log(`run ${run + 1}: ${F.length} frames, longest frame ${Math.max(...frameMs).toFixed(0)} ms, longest pubs update in a frame ${Math.max(0, ...per).toFixed(1)} ms, pubs update in all ${per.reduce((a, b) => a + b, 0).toFixed(0)} ms, frames over 50 ms ${frameMs.filter(f => f > 50).length}, over 100 ms ${frameMs.filter(f => f > 100).length}, median frame ${median(frameMs).toFixed(1)} ms${errs.length ? ' ERRORS ' + errs.join(' | ') : ''}`);
    if (longs.length) console.log('   frames over 50 ms: ' + longs.join(', '));
    for (const [id, b] of Object.entries(built)) console.log(`   ${id.padEnd(11)} ${String(b.steps).padStart(3)} calls with the build in them, longest ${b.longest.toFixed(1)} ms, together ${b.total.toFixed(1)} ms; asked at ${b.asked ? b.asked[1].toFixed(0) : '?'} m, whole after ${b.asked && b.done ? ((b.done[0] - b.asked[0]) / 1000).toFixed(2) : '?'} s at ${b.done ? b.done[1].toFixed(0) : '?'} m, longest frame in the 250 ms after ${b.after.toFixed(0)} ms`);
  }
  if (RUNS > 1) console.log(`median of ${RUNS}: longest frame ${median(all.map(a => a.longestFrame)).toFixed(0)} ms, longest pubs update ${median(all.map(a => a.longestPubs)).toFixed(1)} ms, pubs update in all ${median(all.map(a => a.totalPubs)).toFixed(0)} ms`);
  await browser.close(); server.close();
}

// ---------------------------------------------------------------------------------------------------------------------------------- the same picture
async function identity() {
  const ref = arg('old', 'HEAD'), file = arg('files', 'src/pub-fronts.js');
  const oldSrc = execFileSync('git', ['show', `${ref}:${file}`], { cwd: REPO, maxBuffer: 1 << 26 }).toString();
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' };
  const THREE_DIR = path.join(fs.realpathSync(path.join(REPO, 'tools/build/node_modules')), 'three');
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/old-pub-fronts.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end(oldSrc.replace(/from '\.\//g, "from '/src/")); }
    if (u === '/') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(`<!doctype html><script type="importmap">{"imports":{"three":"/__three/build/three.module.js","three/addons/":"/__three/examples/jsm/"}}</script><body>`); }
    let f = u.startsWith('/__three/') ? path.join(THREE_DIR, u.slice(8)) : path.join(REPO, u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await launch(), page = await browser.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 300))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'load' });
  const CPU = +arg('cpu', 1); if (CPU > 1) { const c = await page.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
  const out = await page.evaluate(async () => {
    const [O, N] = await Promise.all([import('/old-pub-fronts.js'), import('/src/pub-fronts.js')]);
    const KINDS = ['krust', 'whisky', 'taverna', 'punkfunk', 'wdmagione', 'lizard', 'monkey', 'sanlorenzo', 'polacco', 'drunks', 'mindhouse'];
    const THREE = await import('three');
    const hash = a => { let h = 2166136261 >>> 0; const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; return h; };
    // everything of one front that makes the picture: for each mesh its geometry arrays, material parameters and the texture's canvas pixels, in the order of the tree
    const describe = F => {
      const rows = [];
      F.group.traverse(o => {
        const r = { type: o.type, pos: [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z].join(), vis: o.visible, ro: o.renderOrder };
        if (o.geometry) { r.geo = {}; for (const k of Object.keys(o.geometry.attributes)) { const a = o.geometry.attributes[k]; r.geo[k] = a.count + ':' + a.itemSize + ':' + hash(a.array); } r.index = o.geometry.index ? hash(o.geometry.index.array) : null; }
        const m = o.material;
        if (m) {
          r.mat = [m.type, m.color && m.color.getHexString(), m.roughness, m.transparent, m.opacity, m.blending, m.depthWrite, m.fog, m.vertexColors, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.emissive && m.emissive.getHexString(), m.emissiveIntensity, m.toneMapped].join();
          r.tex = {};
          for (const k of ['map', 'emissiveMap']) { const t = m[k]; if (!t) continue; const im = t.image, g = im.getContext('2d'), d = g.getImageData(0, 0, im.width, im.height).data; r.tex[k] = [im.width, im.height, t.colorSpace, t.anisotropy, t.generateMipmaps, t.minFilter, t.magFilter, t.wrapS, t.wrapT, hash(d)].join(); }
        }
        rows.push(r);
      });
      return rows;
    };
    const res = [];
    // the same order, one front after the other, the random stream of the file runs on from front to front as it does in the game
    for (const k of KINDS) {
      const t0 = performance.now(), a = O.buildFront(k), tOld = performance.now() - t0;
      // the new way, a step at a time as src/pubs.js does it (a step is what runs between two yields); with --cpu the page runs slowed down
      const it = N.buildFrontIter(k); let steps = 0, longest = 0, total = 0, b;
      for (;;) { const s0 = performance.now(), r = it.next(), d = performance.now() - s0; steps++; total += d; longest = Math.max(longest, d); if (r.done) { b = r.value; break; } }
      const A = describe(a), B = describe(b);
      let same = A.length === B.length, why = same ? '' : 'mesh count ' + A.length + ' against ' + B.length;
      for (let i = 0; same && i < A.length; i++) if (JSON.stringify(A[i]) !== JSON.stringify(B[i])) { same = false; why = 'mesh ' + i + ' ' + A[i].type + '\n  old ' + JSON.stringify(A[i]).slice(0, 500) + '\n  new ' + JSON.stringify(B[i]).slice(0, 500); }
      // the sign hooks of both give the same visibility at day and night, shut and open
      for (const [n, o] of [[0, false], [1, false], [1, true]]) { a.update(n, o, 3.3); b.update(n, o, 3.3); const va = [], vb = []; a.group.traverse(x => va.push(x.visible + ':' + (x.material && (x.material.opacity + ':' + x.material.emissiveIntensity)))); b.group.traverse(x => vb.push(x.visible + ':' + (x.material && (x.material.opacity + ':' + x.material.emissiveIntensity)))); if (va.join() !== vb.join()) { same = false; why += ' update(' + n + ',' + o + ') differs'; } }
      let px = 0, verts = 0; for (const r of A) { if (r.geo) verts += +r.geo.position.split(':')[0]; if (r.tex) for (const t of Object.values(r.tex)) px += +t.split(',')[0] * +t.split(',')[1]; }
      res.push({ kind: k, same, why, meshes: A.length, verts, texels: px, tOld, steps, longest, total }); a.dispose(); b.dispose();
    }
    return res;
  });
  let bad = 0;
  for (const r of out) { console.log(`${r.kind.padEnd(11)} ${r.same ? 'IDENTICAL' : 'DIFFERENT ' + r.why}  (${r.meshes} objects, ${r.verts} vertices, ${(r.texels / 1e6).toFixed(2)} Mpx of canvas)  old in one go ${r.tOld.toFixed(1)} ms; new ${r.steps} steps, longest ${r.longest.toFixed(1)} ms, together ${r.total.toFixed(1)} ms`); if (!r.same) bad++; }
  console.log(bad ? `${bad} of ${out.length} differ` : `all ${out.length} identical`, errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await browser.close(); srv.close();
  process.exitCode = bad ? 1 : 0;
}

if (MODE === 'drive') await drive(false); else if (MODE === 'tour') await drive(true); else if (MODE === 'identity') await identity(); else console.log('pubfront.mjs drive|tour|identity (see the top of the file)');
