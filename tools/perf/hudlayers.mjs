// What do the page's layers over the canvas (the HUD, the minimap, the touch pads, the balloons) cost the browser's compositor? Counted, in headless Chrome, at the window of the owner's Android phone (680 x 277 at device ratio 3, touch).
//   tools/release/withbrowser.sh node tools/perf/hudlayers.mjs --root <dist> [--label base] [--out dir] [--scenes parked,drive,mission,balloons,night,arrow] [--cpu 4] [--secs 4] [--q 'ctx=old'] [--size 680x277x3] [--raw 1] [--shots 1]
// Per scene one page load, a settle, then a trace of --secs seconds under CDP CPU throttling. Two things come out of it.
//   What the page does per frame (a frame is one BeginMainThreadFrame): style recalculations and how many elements each touched, layouts, paints and of what, raster tasks, layers updated, commits, canvas textures handed
//   over (the WebGL canvas is one of them every frame), DOM writes and on which element, which 2D canvas was drawn into in how many frames, and the animations that are running.
//   What the compositor draws per frame, from its own description of the frame: render passes, quads, and the area it has to blend against the area it can lay down opaque, in screens (1 = the whole window once);
//   and every layer with its size, where it sits and why it is a layer.
// --q clean (every page layer hidden) is the floor: the canvas alone.
// Counts and areas are exact and are what to compare. Times are this Mac's with only the page's main thread slowed down: never a phone's. Chrome's emulation keeps the compositor at scale 1, so a layer's size here is
// in CSS pixels: the phone holds DPR x DPR times as many.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), OUT = path.resolve(arg('out', '.')), LABEL = arg('label', 'run'), SECS = +arg('secs', 4), CPU = +arg('cpu', 4), EXTRA = arg('q', '');
const [VW, VH, DPR] = arg('size', '680x277x3').split('x').map(Number), RAW = arg('raw'), SHOTS = arg('shots');
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));

// A scene: the address, and what to do in the page before the trace starts.
const MAQUEDA = [133, 229, 102, 169, 78, 121, 63, 92, 44, 55, 30, 28, 16, 0, 0, -30, -50, -126, -69, -164, -94, -214, -115, -254, -136, -296, -179, -379, -211, -443, -240, -500, -255, -529, -277, -573, -297, -609];
const SCENES = {
  parked: { q: 'time=13&at=17.5,0,0' },
  night: { q: 'time=22&at=17.5,0,0' },
  drive: { q: 'time=13&at=133,229,-2.66', drive: [MAQUEDA, 12] },
  mission: { q: 'time=13&event=fare:qc&auto', pre: async page => { await page.waitForFunction(() => window.__missions?.S?.ev, { timeout: 90000, polling: 250 }).catch(() => {}); } },
  balloons: { q: 'time=13&at=17.5,0,0', pre: async page => { await page.evaluate(() => { const G = window.game, c = G.car; window.__bal = setInterval(() => { for (let i = 0; i < 2; i++) G.shout(c.x + (Math.random() - 0.5) * 14, 2.2, c.z + 6 + Math.random() * 14); }, 500); }); } },
};
SCENES.arrow = { q: 'time=13&at=17.5,0,0', pre: async page => { await page.evaluate(() => { const e = document.querySelector('.ev-edge'); e.classList.add('on'); e.style.transform = 'translate(340px, 150px)'; }); } };   // parked, with a mission's arrow at the edge shown by hand: its pulse alone
const names = String(arg('scenes', 'parked,drive')).split(',');

const PAGE_DRIVER = () => {
  const G = window.game, keys = G.keys, car = G.car; let timer = null, S = null;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const stop = () => { if (timer) clearInterval(timer); timer = null; keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false; };
  function tick() {
    const P = S.P; S.fr++;
    while (S.i < P.length - 2 && Math.hypot(P[S.i] - car.x, P[S.i + 1] - car.z) < clamp(car.vf * 0.8, 10, 40)) S.i += 2;
    const e = wrap(Math.atan2(P[S.i] - car.x, P[S.i + 1] - car.z) - car.th), fwd = car.vx * Math.sin(car.th) + car.vz * Math.cos(car.th);
    const duty = Math.min(1, Math.abs(e) / 0.25), pulse = (S.fr % 4) < duty * 4 + 0.001 && duty > 0.05, cap = Math.abs(e) > 0.5 ? Math.min(S.v, 6) : S.v;
    keys.ArrowLeft = pulse && e > 0; keys.ArrowRight = pulse && e < 0; keys.ArrowUp = fwd < cap * 0.98; keys.ArrowDown = fwd > cap * 1.25;
  }
  window.__drv = { start(P, v) { stop(); S = { P, v, i: 2, fr: 0 }; timer = setInterval(tick, 33); }, stop };
};

// What the page itself can see: DOM writes by element, the frames in which each 2D canvas was drawn into (a frame is told by the document timeline's time, which stands still within one), the animations running.
const PAGE_WATCH = () => {
  const tag = n => { const e = n && n.nodeType === 1 ? n : n && n.parentElement; if (!e) return '?'; return e.tagName.toLowerCase() + (e.id ? '#' + e.id : typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : ''); };
  const M = window.__watch = { n: 0, by: {}, cv: {}, tag };
  M.ob = new MutationObserver(L => { for (const m of L) { M.n++; const k = tag(m.target) + ' ' + (m.type === 'attributes' ? '@' + m.attributeName : m.type === 'characterData' ? 'text' : 'children'); M.by[k] = (M.by[k] || 0) + 1; } });
  M.ob.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  const c2 = CanvasRenderingContext2D.prototype;
  for (const m of ['clearRect', 'drawImage', 'fillRect', 'fill', 'stroke', 'fillText', 'putImageData']) { const o = c2[m]; c2[m] = function (...a) { if (this.canvas.isConnected) { const k = tag(this.canvas); (M.cv[k] = M.cv[k] || new Set()).add(document.timeline.currentTime); } return o.apply(this, a); }; }
};
const PAGE_READ = () => {
  const M = window.__watch; M.ob.disconnect();
  const g = window.game.renderer.getContext(), c = g.canvas;
  return { n: M.n, by: M.by, cv: Object.fromEntries(Object.entries(M.cv).map(([k, s]) => [k, s.size])),
    anims: document.getAnimations().filter(a => a.playState === 'running').map(a => (a.animationName || a.transitionProperty || 'animation') + ' on ' + M.tag(a.effect && a.effect.target)),
    attr: g.getContextAttributes(), buf: [g.drawingBufferWidth, g.drawingBufferHeight], css: [c.clientWidth, c.clientHeight], dpr: devicePixelRatio };
};

const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'disabled-by-default-devtools.timeline.invalidationTracking', 'blink', 'cc', 'disabled-by-default-cc.debug', 'disabled-by-default-viz.quads', 'disabled-by-default-devtools.timeline.layers'];
// the events worth a column: name in the trace -> what it is
const COLS = [['UpdateLayoutTree', 'style'], ['Layout', 'layout'], ['Paint', 'paint'], ['RasterTask', 'raster'], ['PictureLayer::Update', 'layers updated'], ['Commit', 'commit'], ['TextureLayer::PushPropertiesTo', 'canvas textures']];

const { server, port } = await startServer(ROOT, '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const report = { label: LABEL, root: ROOT, size: [VW, VH, DPR], cpu: CPU, secs: SECS, q: EXTRA, scenes: {} };
const md = [`## ${LABEL} (${VW} x ${VH} at ratio ${DPR}, CPU ${CPU}x, ${SECS} s${EXTRA ? ', ?' + EXTRA : ''})`, ''];
const VIEW = VW * VH, lname = l => String(l.layer_name || '').replace(/^Layout\w+ ?(\([^)]*\))? ?/, '').replace(/^DIV /, 'div ').replace(/^CANVAS /, 'canvas ').slice(0, 48);

for (const name of names) {
  const sc = SCENES[name]; if (!sc) { console.error('no scene', name); continue; }
  const page = await browser.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: DPR, hasTouch: true, isMobile: true });
  await page.goto(`http://127.0.0.1:${port}/?help=0&play&debug&p2p=off&${sc.q}${EXTRA ? '&' + EXTRA : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.game && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  await wait(6000);
  if (sc.pre) await sc.pre(page);
  if (sc.drive) { await page.evaluate(PAGE_DRIVER); await page.evaluate((P, v) => window.__drv.start(P, v), ...sc.drive); await wait(2500); }
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await wait(1500);
  await page.evaluate(PAGE_WATCH);
  await page.tracing.start({ categories: CATS });
  const t0 = Date.now(); await wait(SECS * 1000);
  const buf = Buffer.from(await page.tracing.stop()), real = (Date.now() - t0) / 1000;
  const info = await page.evaluate(PAGE_READ);
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `${LABEL}-${name}.png`) });
  await page.close();

  // ---- the trace
  const tr = JSON.parse(buf.toString('utf8')), ev = tr.traceEvents || tr;
  if (RAW) fs.writeFileSync(path.join(OUT, `${LABEL}-${name}.trace.json`), buf);
  const cnt = new Map(), dur = new Map(); let styleEls = 0;
  for (const e of ev) {
    if (e.ph !== 'X' && e.ph !== 'I' && e.ph !== 'i' && e.ph !== 'B') continue;
    cnt.set(e.name, (cnt.get(e.name) || 0) + 1); if (e.dur) dur.set(e.name, (dur.get(e.name) || 0) + e.dur / 1000);
    if (e.name === 'UpdateLayoutTree') styleEls += e.args?.elementCount || 0;
  }
  const frames = cnt.get('BeginMainThreadFrame') || 1, per = n => +((cnt.get(n) || 0) / frames).toFixed(2), ms = n => +((dur.get(n) || 0) / frames).toFixed(3);
  // the compositor's frames: passes, quads, blended and opaque area, averaged over every frame it described; the layers from the last one
  const snaps = ev.filter(e => e.name === 'LayerTreeHostImpl:snapshot' && e.args?.snapshot?.frame?.render_passes).map(e => e.args.snapshot);
  let passes = 0, quads = 0, blended = 0, opaque = 0, maxPasses = 0;
  for (const s of snaps) {
    passes += s.frame.render_passes.length; maxPasses = Math.max(maxPasses, s.frame.render_passes.length);
    for (const rp of s.frame.render_passes) for (const qd of rp.quad_list) { const t = qd.visible_rect_as_target_space_quad, a = Math.abs(t[4] - t[0]) * Math.abs(t[5] - t[1]); quads++; if (qd.needs_blending) blended += a; else opaque += a; }
  }
  const ns = snaps.length || 1, last = snaps[snaps.length - 1], layersAll = last ? last.active_tree.layers : [];
  const layers = layersAll.filter(l => l.draws_content).map(l => ({ name: lname(l), w: l.bounds.width, h: l.bounds.height, x: Math.round(l.layer_quad[0]), y: Math.round(l.layer_quad[1]), why: (l.compositing_reason_ids || []).join('+'), kb: l.gpu_memory_usage >> 10 }));
  // what was painted, by layer
  const byId = new Map(), paintBy = {};
  for (const sn of snaps) for (const l of sn.active_tree.layers) if (!byId.has(l.layer_id)) byId.set(l.layer_id, `${lname(l) || 'unnamed'} ${l.bounds.width}x${l.bounds.height}`);
  for (const e of ev) if (e.name === 'Paint' && e.args?.data) { const d = e.args.data, k = d.nodeName || byId.get(d.layerId) || 'layer ' + d.layerId; paintBy[k] = (paintBy[k] || 0) + 1; }
  // why: what Blink says it had to restyle, lay out and repaint (node and reason), and which layer the raster tasks were for
  const why = { style: {}, layout: {} }, rasterBy = {};
  for (const e of ev) {
    const d = e.args?.data;
    if (e.name === 'StyleRecalcInvalidationTracking' && d) { const k = `${d.nodeName} (${d.reason || d.extraData || ''})`; why.style[k] = (why.style[k] || 0) + 1; }
    else if (e.name === 'LayoutInvalidationTracking' && d) { const k = `${d.nodeName} (${d.reason || ''})`; why.layout[k] = (why.layout[k] || 0) + 1; }
    else if (e.name === 'RasterTask' && e.ph === 'X') { const k = byId.get(e.args?.tileData?.layerId) || 'layer ' + e.args?.tileData?.layerId; rasterBy[k] = (rasterBy[k] || 0) + 1; }
  }
  const top = (o, n = 8) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${(v / frames).toFixed(2)}`).join(', ') || 'nothing';
  const S = report.scenes[name] = { why, rasterBy, frames, fps: +(frames / real).toFixed(1), errs, info, per: Object.fromEntries(COLS.map(([n, k]) => [k, per(n)])), ms: Object.fromEntries(COLS.map(([n, k]) => [k, ms(n)])), styleEls: +(styleEls / frames).toFixed(2),
    writes: +(info.n / frames).toFixed(2), paintBy, frame: { passes: +(passes / ns).toFixed(2), maxPasses, quads: +(quads / ns).toFixed(1), blended: +(blended / ns / VIEW).toFixed(2), opaque: +(opaque / ns / VIEW).toFixed(2) }, layers, layerCount: layersAll.length };
  const px = layers.reduce((s, l) => s + l.w * l.h, 0), F = S.frame;
  md.push(`### ${name}: ${frames} frames in ${real.toFixed(1)} s (${S.fps} a second)${errs.length ? ', ERRORS ' + errs.join(' | ') : ''}`, '',
    `context alpha ${info.attr.alpha}, antialias ${info.attr.antialias}, desynchronized ${info.attr.desynchronized}, powerPreference ${info.attr.powerPreference}; buffer ${info.buf.join(' x ')}, canvas ${info.css.join(' x ')} CSS px at ratio ${info.dpr}`, '',
    '| per frame | ' + COLS.map(c => c[1]).join(' | ') + ' | style elements | DOM writes |', '| --- | ' + COLS.map(() => '---').join(' | ') + ' | --- | --- |',
    '| count | ' + COLS.map(c => S.per[c[1]]).join(' | ') + ` | ${S.styleEls} | ${S.writes} |`, '| ms (this Mac) | ' + COLS.map(c => S.ms[c[1]]).join(' | ') + ' | | |', '',
    `the compositor's frame: ${F.passes} passes (most ${F.maxPasses}), ${F.quads} quads, ${F.blended} screens blended, ${F.opaque} opaque`, '',
    'DOM writes: ' + (Object.entries(info.by).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${(v / frames).toFixed(2)}`).join(', ') || 'none'), '',
    'painted: ' + (Object.entries(paintBy).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${(v / frames).toFixed(2)}`).join(', ') || 'nothing'), '',
    'rastered: ' + top(rasterBy), '', 'restyled because: ' + top(why.style), '', 'laid out because: ' + top(why.layout), '',
    '2D canvases drawn into: ' + (Object.entries(info.cv).map(([k, v]) => `${k} in ${v} of ${frames} frames`).join(', ') || 'none'), '',
    'animations running: ' + (info.anims.join(', ') || 'none'), '',
    `${layersAll.length} layers, ${layers.length} with content, ${(px / VIEW).toFixed(2)} screens of layer`, '',
    '| layer | size | at | why | KB |', '| --- | --- | --- | --- | --- |', ...layers.map(l => `| ${l.name || '(none)'} | ${l.w} x ${l.h} | ${l.x},${l.y} | ${l.why} | ${l.kb} |`), '');
  console.log(`${LABEL} ${name}: ${frames} fr, per frame style ${S.per.style} (${S.styleEls} el) layout ${S.per.layout} paint ${S.per.paint} raster ${S.per.raster} layers updated ${S.per['layers updated']} textures ${S.per['canvas textures']} writes ${S.writes}; ${F.passes} passes ${F.quads} quads blended ${F.blended} opaque ${F.opaque}; ${layers.length} layers ${(px / VIEW).toFixed(2)} screens; anims ${info.anims.length}`);
}
fs.writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify(report));
fs.writeFileSync(path.join(OUT, `${LABEL}.md`), md.join('\n') + '\n');
await browser.close(); server.close();
