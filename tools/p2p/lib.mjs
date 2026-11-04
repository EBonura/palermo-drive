// Shared helpers for the peer to peer experiment tests (docs/P2P-MULTIPLAYER.md). Run scripts through the browser slot wrapper:
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/<script>.mjs --root <dist>
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const puppeteer = createRequire(path.join(HERE, '../build/package.json'))('puppeteer-core');   // installed with tools/build (npm install there)
const { startServer } = await import(path.join(HERE, '../build/serve.mjs'));
export const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function start({ root = arg('root'), headless = 'new', extraArgs = [] } = {}) {   // extraArgs: more Chrome flags (tools/p2p/stress.mjs)
  const { server, port } = await startServer(path.resolve(root), '');
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || (process.env.PD_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless, protocolTimeout: 600000,
    args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--no-first-run', ...extraArgs] });
  return { server, port, browser, close: async () => { await browser.close().catch(() => {}); server.close(); } };
}
// one player: a page at the map point (x, z) heading th, named name; all players of a run share the ns so they only meet each other
export async function player(h, { name, ns, x, z, th = 0, extra = '', size = [480, 270], cpu = 1, phone = false, p2p = 'p2p', isolated = false }) {
  // a window of its own, so that every player is a visible page and keeps running at full rate (background tabs are throttled)
  // isolated: a browser context of its own too (its own storage, as a second person's browser has), so one player's saved wallet and settings never reach another
  let page, ctx = null;
  if (isolated) { ctx = await h.browser.createBrowserContext(); page = await ctx.newPage(); }
  else { const { targetId } = await (h.root || (h.root = await h.browser.target().createCDPSession())).send('Target.createTarget', { url: 'about:blank', newWindow: true }); page = await (await h.browser.waitForTarget(t => t._targetId === targetId)).page(); }
  if (phone) await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); else await page.setViewport({ width: size[0], height: size[1], deviceScaleFactor: 1 });
  // the game pauses itself when the page is hidden (ui.js): in a test with several windows that must never happen, or nobody drives or sends
  await page.evaluateOnNewDocument(() => { Object.defineProperty(document, 'hidden', { get: () => false }); Object.defineProperty(document, 'visibilityState', { get: () => 'visible' }); document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true); });
  const cdp = await page.createCDPSession();
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await page.goto(`http://127.0.0.1:${h.port}/?help=0&play&debug&${p2p}&name=${name}&ns=${ns}${/cash=/.test(extra) ? "" : "&cash=0"}${phone ? '&touch' : ''}${extra ? '&' + extra : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(want => window.game && (!want || window.__p2p) && !document.getElementById('loading'), { timeout: 300000, polling: 250 }, /(^|&)p2p/.test(p2p));
  await page.evaluate(([x, z, th]) => { const c = window.game.car; c.x = x; c.z = z; c.th = th; c.vx = c.vz = 0; }, [x, z, th]);
  console.log('  player', name, 'ready');
  return { page, cdp, errs, name, ctx };
}
// scripted driver: sets the car's position every frame along a polyline at `speed` m/s (physics and walls ignored: this is about the network)
export function drivePath(p, pts, speed, loop = false) {
  return p.page.evaluate(([pts, speed, loop]) => {
    const c = window.game.car; let seg = 0, d = 0; window.__drive && cancelAnimationFrame(window.__drive); let last = performance.now();
    const step = now => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now; d += speed * dt;
      for (;;) {
        const a = pts[seg], b = pts[(seg + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= L) { c.x = a[0] + (b[0] - a[0]) * d / L; c.z = a[1] + (b[1] - a[1]) * d / L; c.th = Math.atan2(b[0] - a[0], b[1] - a[1]); c.vf = speed; c.vx = Math.sin(c.th) * speed; c.vz = Math.cos(c.th) * speed; break; }
        if (seg + 2 >= pts.length && !loop) { c.x = b[0]; c.z = b[1]; c.vf = 0; c.vx = c.vz = 0; return; }   // end of the path
        d -= L; seg = (seg + 1) % pts.length;
      }
      window.__drive = requestAnimationFrame(step);
    };
    window.__drive = requestAnimationFrame(step);
  }, [pts, speed, loop]);
}
export const snap = p => p.page.evaluate(async () => { const d = window.__p2p; return { t: Math.round(performance.now()), rooms: [...d.rooms.values()].map(r => `${r.i},${r.j}:${r.peers.size}`), peers: d.peers.size, drawn: d.remotes.size, stats: { ...d.stats }, wire: await d.wire(), car: [Math.round(window.game.car.x), Math.round(window.game.car.z)] }; });
export const events = p => p.page.evaluate(() => window.__p2p.log.slice());
// a player without the game (tools/p2p/bot.html): served from the repo root, so it needs a second static server
export async function bots(h, { n, room, kind = 'nostr', x, z, relays = '' }) {
  if (!h.rootServer) { const { startServer } = await import(path.join(HERE, '../build/serve.mjs')); h.rootServer = await startServer(path.resolve(HERE, '../..'), ''); }
  const out = [];
  for (let i = 0; i < n; i++) {
    const page = await h.browser.newPage();   // bots draw nothing: background tabs are fine (timers still run)
    await page.goto(`http://127.0.0.1:${h.rootServer.port}/tools/p2p/bot.html?kind=${kind}&room=${encodeURIComponent(room)}&x=${x}&z=${z}&name=bot${i}${relays ? '&relays=' + relays : ''}`, { waitUntil: 'domcontentloaded' });
    out.push(page);
  }
  return out;
}
export const closeAll = async h => { h.rootServer && h.rootServer.server.close(); await h.close(); };
