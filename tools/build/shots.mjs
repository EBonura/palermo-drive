// Visual regression: screenshots the same views from several roots and prints how much they differ.
//   node tools/build/shots.mjs --roots .,dist [--cdn <three r160 dir for the source tree>] --out /tmp/shots
// The first root is the reference. Pixels count as different when any channel moves by more than 24/255.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { startServer } from './serve.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const roots = arg('roots', '.,dist').split(',').map(r => path.resolve(r));
const OUT = path.resolve(arg('out', '/tmp/pd-shots')); fs.mkdirSync(OUT, { recursive: true });
const CDN = arg('cdn', '');
const VIEWS = {
  quattro: 'spot=1&cam=0&help=0', teatro: 'spot=2&cam=0&help=0', cala: 'spot=6&cam=0&help=0',
  street: 'campos=250,40,300&look=0,5,0', aerial: 'campos=1800,300,-1500&look=0,0,0',
};
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, defaultViewport: { width: 1280, height: 720 },
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const files = {};
for (const root of roots) {
  const { server, port } = await startServer(root, CDN);
  const tag = path.basename(root) || 'root';
  for (const [name, q] of Object.entries(VIEWS)) {
    const page = await browser.newPage();
    if (CDN) { await page.setRequestInterception(true); page.on('request', r => { const m = r.url().match(/^https:\/\/cdn\.jsdelivr\.net(\/npm\/.*)$/); m ? r.continue({ url: `http://127.0.0.1:${port}/__cdn${m[1]}` }) : r.continue(); }); }
    await page.goto(`http://127.0.0.1:${port}/?${q}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => !document.getElementById('loading') && !!document.getElementById('view') && document.readyState !== 'loading', { timeout: 120000, polling: 250 });
    await new Promise(r => setTimeout(r, 6000));
    const f = path.join(OUT, `${tag}-${name}.png`); await page.screenshot({ path: f }); (files[name] ||= []).push(f);
    await page.close();
  }
  server.close();
}
const page = await browser.newPage();
for (const [name, fs_] of Object.entries(files)) {
  const imgs = fs_.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
  for (let i = 1; i < imgs.length; i++) {
    const r = await page.evaluate(async (a, b) => {
      const load = s => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = s; });
      const [A, B] = [await load(a), await load(b)];
      const c = document.createElement('canvas'); c.width = A.width; c.height = A.height; const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data; g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, big = 0; for (let k = 0; k < da.length; k += 4) { const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2])); sum += d; if (d > 24) big++; }
      return { meanAbs: +(sum / (da.length / 4)).toFixed(2), pctBig: +(100 * big / (da.length / 4)).toFixed(2) };
    }, imgs[0], imgs[i]);
    console.log(name.padEnd(8), path.basename(roots[0]), 'vs', path.basename(roots[i]), JSON.stringify(r));
  }
}
await browser.close();
