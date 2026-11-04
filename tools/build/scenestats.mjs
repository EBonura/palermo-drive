// Where do the triangles and draw calls come from? Loads the game (?debug) and lists the heaviest meshes at a spot.
//   node tools/build/scenestats.mjs --root dist --spot "38.115684,13.361460" [--top 30]
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { startServer } from './serve.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', 'dist')), CDN = arg('cdn', ''), TOP = +arg('top', 30);
const [lat, lon] = arg('spot', '38.115684,13.361460').split(',').map(Number);
const { server, port } = await startServer(ROOT, CDN);
const browser = await puppeteer.launch({ executablePath: (process.env.PD_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless: true, defaultViewport: { width: 1280, height: 720 }, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
if (CDN) { await page.setRequestInterception(true); page.on('request', r => { const m = r.url().match(/^https:\/\/cdn\.jsdelivr\.net(\/npm\/.*)$/); m ? r.continue({ url: `http://127.0.0.1:${port}/__cdn${m[1]}` }) : r.continue(); }); }
await page.goto(`http://127.0.0.1:${port}/?debug&help=0`);
await page.waitForFunction(() => window.game && window.game.scene, { timeout: 120000 });
await new Promise(r => setTimeout(r, 3000));
const out = await page.evaluate((lat, lon, TOP) => {
  const g = window.game; g.placeAt(...g.proj(lat, lon));
  return new Promise(res => setTimeout(() => {
    const cam = g.camera; cam.updateMatrixWorld();
    const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements;
    const planes = [[3,0],[3,1],[3,2]].flatMap(([a,b]) => [1,-1].map(s => [m[a]+s*m[b], m[7]+s*m[4+b], m[11]+s*m[8+b], m[15]+s*m[12+b]]));
    // rows of the clip matrix (column-major elements): plane = row3 +/- row_i
    const row = i => [m[i], m[4+i], m[8+i], m[12+i]];
    const P = []; for (const i of [0,1,2]) for (const s of [1,-1]) { const r = row(i), w = row(3); P.push(w.map((v, k) => v + s * r[k])); }
    const inView = (c, rad) => P.every(p => { const n = Math.hypot(p[0], p[1], p[2]); return (p[0]*c.x + p[1]*c.y + p[2]*c.z + p[3]) / n >= -rad; });
    const rows = []; let all = 0, vis = 0, visCasters = 0, calls = 0, visCalls = 0, casterCalls = 0;
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      const geo = o.geometry; if (!geo) return;
      const n = (geo.index ? geo.index.count : geo.attributes.position.count) / 3 * (o.count || 1);
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const bs = geo.boundingSphere, c = bs.center.clone().applyMatrix4(o.matrixWorld);
      const sc = o.matrixWorld.getMaxScaleOnAxis(), rad = bs.radius * sc;
      const v = o.visible && (!o.frustumCulled || o.isInstancedMesh && false || inView(c, rad));
      all += n; calls++;
      if (o.visible && v) { vis += n; visCalls++; if (o.castShadow) { visCasters += n; casterCalls++; } }
      rows.push({ name: o.name || (o.parent && o.parent.name) || o.type, kind: o.isInstancedMesh ? 'inst' + o.count : 'mesh', tris: Math.round(n), vis: !!v, shadow: o.castShadow, r: Math.round(rad), d: Math.round(c.distanceTo(cam.position)), mat: Array.isArray(o.material) ? 'multi' : o.material.type, fc: o.frustumCulled });
    });
    rows.sort((a, b) => b.tris - a.tris);
    res({ totals: { meshes: calls, tris: Math.round(all), visibleMeshes: visCalls, visibleTris: Math.round(vis), casterMeshes: casterCalls, casterVisibleTris: Math.round(visCasters) }, info: JSON.parse(JSON.stringify({ calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles })), top: rows.slice(0, TOP) });
  }, 2500));
}, lat, lon, TOP);
console.log(JSON.stringify(out.totals), JSON.stringify(out.info));
for (const r of out.top) console.log(String(r.tris).padStart(8), r.vis ? 'V' : '.', r.shadow ? 'S' : '.', r.kind.padEnd(9), r.mat.padEnd(22), ('r' + r.r + ' d' + r.d).padEnd(14), r.name);
await browser.close(); server.close();
