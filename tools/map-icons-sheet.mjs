// A picture of the map icon sheet (tools/map-icons-sheet.html), headless:
//   PD_CHROME=<headless chrome> node tools/map-icons-sheet.mjs outdir
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import os from 'os';
import { startServer } from './build/serve.mjs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer(new URL('..', import.meta.url).pathname.replace(/\/$/, ''));
const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'pdicons-'));
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--user-data-dir=' + udd] });
const p = await b.newPage(); let errs = 0; p.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
await p.goto(`http://127.0.0.1:${srv.port}/tools/map-icons-sheet.html`, { waitUntil: 'load' });
await p.waitForFunction(() => document.title === 'ready', { timeout: 20000 });
await (await p.$('#c')).screenshot({ path: path.join(out, 'map-icons-sheet.png') });
console.log('errors', errs); await b.close(); srv.close?.(); fs.rmSync(udd, { recursive: true, force: true }); process.exit(errs ? 1 : 0);
