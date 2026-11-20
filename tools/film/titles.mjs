// Renders the trailer's title graphics (tools/film/titles.html) frame by frame: transparent ones as ProRes 4444 with alpha, the ones on black as H.264.
//   tools/release/withbrowser.sh node tools/film/titles.mjs <out dir> <wide|tall> <titles.json>
// titles.json: [{ name, kind: 'over'|'place'|'card'|'review'|'links'|'logo'|'bonnie'|'flip', text: 'line|line', color, dur, scale, seq (the lines land one by one, all big) }]; anchor (where every text sits) is set once for the format.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { startServer } from '../build/serve.mjs';
const puppeteer = createRequire(new URL('../build/package.json', import.meta.url))('puppeteer-core');
const [out, V, listFile] = process.argv.slice(2), list = JSON.parse(fs.readFileSync(listFile, 'utf8')), [W, H] = V === 'tall' ? [1080, 1920] : [1920, 1080], ANCHOR = V === 'tall' ? 0.6 : 0.76, FPS = 60;
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(new URL('../..', import.meta.url).pathname), srv = await startServer(root), base = `http://127.0.0.1:${srv.port}/`;
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
// the game's own logo, taken from its title screen
let logo = '';
{ const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 }); await p.goto(base + '?help=0', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('.pd-logo svg', { timeout: 120000 }); logo = await p.evaluate(() => document.querySelector('.pd-logo').innerHTML); await p.close(); }
for (const t of list) {
  const p = await b.newPage(); await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await p.evaluateOnNewDocument(svg => { window.__logoSVG = svg; }, logo);
  const q = new URLSearchParams({ kind: t.kind, text: t.text || '', color: t.color || 'white', dur: String(t.dur || 1.6), anchor: String(t.anchor || ANCHOR), scale: String(t.scale || 1), bg: t.alpha ? 'none' : '', seq: t.seq ? '1' : '', seq0: String(t.seq0 || ''), seq1: String(t.seq1 || ''), side: t.side || '', sub: t.sub || '' });
  await p.goto(base + 'tools/film/titles.html?' + q, { waitUntil: 'load' }); await p.evaluate(() => window.ready);
  const dir = path.join(out, `.${t.name}-${V}`); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const alpha = t.kind === 'over' || t.kind === 'place' || t.kind === 'flip' || !!t.alpha, n = Math.round((t.dur || 1.6) * FPS);
  for (let i = 0; i < n; i++) { await p.evaluate(s => window.draw(s), i / FPS); await p.screenshot({ path: path.join(dir, `f_${String(i + 1).padStart(4, '0')}.png`), omitBackground: alpha }); }
  await p.close();
  const dst = path.join(out, `${t.name}-${V}.${alpha ? 'mov' : 'mp4'}`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f_%04d.png'), ...(alpha ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16'] : ['-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p']), dst]);
  fs.rmSync(dir, { recursive: true, force: true }); console.log(path.basename(dst), n, 'frames');
}
await b.close(); process.exit(0);
