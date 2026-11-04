// Cost of the trees at the dense-tree spots: triangles and draw calls, chase camera, one screenshot per spot.
//   tools/release/withbrowser.sh node tools/tree_cost.mjs --base http://127.0.0.1:PORT/ --out cost.json [--shots DIR] [--only liberta,foro] [--time 11]
// The game is served by the caller (the source tree or a dist; tools/build/serve.mjs startServer does it). The page loads with ?debug&fixres at 1024 x 768, the car is dropped at each spot
// (Via della Liberta, Viale Lazio, the Foro Italico, Viale Diana in the Favorita, Viale Regione Siciliana, the Mondello beach front, Via Ruggero Settimo, Quattro Canti), the tile streamer
// is waited out, and one frame is counted: renderer.info (everything, shadow pass included) and, over the visible tree meshes whose bounding sphere meets the frustum, instances x triangles
// (instanced meshes are not culled per instance, so that is what the GPU is given). Compare two builds by running this against both: the sum of the instances in view varies a little
// with how many tiles the streamer had loaded when it went quiet, so read triangles per tree as well as the sum. Used for docs/faithfulness/vegetation.md.
import { createRequire } from 'module'; import fs from 'fs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const base = arg('base'), out = arg('out'), shots = arg('shots', '');
const only = arg('only', '') ? arg('only').split(',') : null, time = arg('time', '11');
const SPOTS = [
  ['liberta', 38.12577, 13.35493, 153], ['lazio', 38.14207, 13.33787, 247], ['foro', 38.11749, 13.37313, 144], ['favorita', 38.16115, 13.34213, 337],
  ['regsic', 38.08708, 13.34864, 119], ['mondello', 38.2013, 13.32614, 65], ['ruggero', 38.12396, 13.35505, 59], ['quattro', 38.115684, 13.36146, 0],
].filter(s => !only || only.includes(s[0]));
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const p = await b.newPage(); await p.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await p.goto(base + '?help=0&debug&clean&fixres&time=' + time + '&play&p2p=off&at=0,0', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('loading') && window.game?.world, { timeout: 240000, polling: 250 });
const res = {};
if (shots) fs.mkdirSync(shots, { recursive: true });
for (const [id, lat, lon, hd] of SPOTS) {
  await p.evaluate((lat, lon, hd) => new Promise(res => {
    const g = window.game, [x, z] = g.proj(lat, lon), th = Math.PI - hd * Math.PI / 180; let done = false;
    g.world.teleport(x, z, () => { g.placeAt(x, z, th); done = true; });
    const t0 = performance.now(); let calm = 0;
    const tick = () => { const pend = g.world.visiblePending?.() ?? 0; calm = done && pend === 0 ? calm + 1 : 0; if (calm >= 30 || performance.now() - t0 > 60000) res(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), lat, lon, hd);
  await new Promise(r => setTimeout(r, 3000));
  const r = await p.evaluate(() => new Promise(res => {
    const g = window.game, ren = g.renderer; ren.info.autoReset = false;
    requestAnimationFrame(() => { ren.info.reset(); requestAnimationFrame(() => {
      const cam = g.camera; cam.updateMatrixWorld();
      const info = { calls: ren.info.render.calls, tris: ren.info.render.triangles };
      ren.info.autoReset = true;
      // trees in view: instanced meshes of tree models that are visible and whose bounding sphere meets the frustum
      const THREE_FR = g.__fr || null;
      const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements;
      const row = i => [m[i], m[4 + i], m[8 + i], m[12 + i]], P = []; for (const i of [0, 1, 2]) for (const s of [1, -1]) { const a = row(i), w = row(3); P.push(w.map((v, k) => v + s * a[k])); }
      const inView = (c, rad) => P.every(p => (p[0] * c.x + p[1] * c.y + p[2] * c.z + p[3]) / Math.hypot(p[0], p[1], p[2]) >= -rad);
      const by = {}; let tt = 0, tm = 0, tinst = 0;
      g.scene.traverse(o => {
        if (!o.isInstancedMesh || !o.visible) return;
        let ok = o.parent; while (ok && ok.visible) ok = ok.parent; if (ok) return;
        const nm = o.name || ''; if (!/^(prop_(plane|ficus|tree|holm|orange|pine|aleppo|palm|shrub|stone|oak|cyp|jac|oleander|olive|carob|hedge)|trees_|roadtrees_)/.test(nm)) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        if (!o.boundingSphere) o.computeBoundingSphere();
        const bs = o.boundingSphere, c = bs.center.clone().applyMatrix4(o.matrixWorld);
        if (!inView(c, bs.radius)) return;
        const per = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3, n = o.count * per;
        const k = nm.replace(/^prop_/, ''); by[k] = by[k] || { meshes: 0, inst: 0, tris: 0 }; by[k].meshes++; by[k].inst += o.count; by[k].tris += n; tt += n; tm++; tinst += o.count;
      });
      res({ info, treeTris: tt, treeMeshes: tm, treeInst: tinst, by, pos: [Math.round(g.car.x), Math.round(g.car.z)] });
    }); });
  }));
  res[id] = r; console.log(id, JSON.stringify({ calls: r.info.calls, tris: r.info.tris, treeTris: r.treeTris, treeMeshes: r.treeMeshes, treeInst: r.treeInst }));
  if (shots) await p.screenshot({ path: `${shots}/${id}.png` });
}
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(errs.length ? 'page errors: ' + [...new Set(errs)].slice(0, 5).join(' | ') : 'no page errors');
await b.close();
