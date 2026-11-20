// Shared helpers for the multiplayer tests (docs/ONLINE.md). They need a build whose page policy lets a page reach a relay on this machine, and run through the browser slot wrapper:
//   node tools/build/build.mjs --test-relay --out <dist>
//   tools/release/withbrowser.sh node tools/online/<script>.mjs --root <dist> [--relay ws://127.0.0.1:8787/r]
// With no --relay each run starts its own relay simulator (tools/online/relaysim.mjs) and talks to nothing else. With --relay the pages use that relay instead (a `wrangler dev` of relay-worker/ on this machine):
// the simulator's limits are then the real relay's, for example 24 connections per address, which a crowd of pages from one machine can hit. Never a public service: the tools refuse any address that is not local.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const puppeteer = createRequire(path.join(HERE, '../build/package.json'))('puppeteer-core');   // installed with tools/build (npm install there)
const { startServer } = await import(path.join(HERE, '../build/serve.mjs'));
const { startRelaySim } = await import('./relaysim.mjs');
export const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const until = async (fn, ms = 8000, step = 150) => { for (let t = 0; t < ms; t += step) { const v = await fn(); if (v) return v; await sleep(step); } return null; };
export async function start({ root = arg('root'), headless = 'new', extraArgs = [], sim = {} } = {}) {   // sim: options for the relay simulator (tools/online/relaysim.mjs)
  const { server, port } = await startServer(path.resolve(root), '');
  const given = arg('relay', ''), relay = given ? null : await startRelaySim({ perAddress: 1000, ...sim });
  const relayUrl = given || relay.url;
  if (!/^wss?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(relayUrl)) throw new Error('the tools only talk to a relay on this machine: ' + relayUrl);
  const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless, protocolTimeout: 600000,
    args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--no-first-run', ...extraArgs] });
  const more = [];   // newRelay(): another relay for a scenario that must not meet the players of an earlier one (the same spots are used again). With --relay there is only the one
  const newRelay = async (o = {}) => { if (given) return given; const r = await startRelaySim({ perAddress: 1000, ...sim, ...o }); more.push(r); return r.url; };
  return { server, port, browser, relay, relayUrl, newRelay, close: async () => { await browser.close().catch(() => {}); server.close(); if (relay) await relay.close(); for (const r of more) await r.close(); } };
}
// one player: a page at the map point (x, z) heading th, named name, all on the run's relay
export async function player(h, { name, x, z, th = 0, extra = '', size = [480, 270], cpu = 1, phone = false, p2p = 'p2p', isolated = false, relay = h.relayUrl }) {
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
  await page.goto(`http://127.0.0.1:${h.port}/?help=0&play&debug&${p2p}&name=${name}&relay=${encodeURIComponent(relay)}${/cash=/.test(extra) ? '' : '&cash=0'}${phone ? '&touch' : ''}${extra ? '&' + extra : ''}`, { waitUntil: 'domcontentloaded' });
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
export const snap = p => p.page.evaluate(() => { const d = window.__p2p; return { t: Math.round(performance.now()), peers: d.peers.size, drawn: d.remotes.size, stats: { ...d.stats }, relay: d.relay(), car: [Math.round(window.game.car.x), Math.round(window.game.car.z)] }; });
export const events = p => p.page.evaluate(() => window.__p2p.log.slice());
// how many other players this page draws right now
export const drawn = p => p.page.evaluate(() => window.__p2p.remotes.size);
// a Node client for the cases that need many players and no pages: a raw WebSocket to the run's relay speaking protocol v2 (tools/online/bot.mjs)
export { startBot } from './bot.mjs';
