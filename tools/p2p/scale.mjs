// Cost of N peers in one room: one full game page (the measured player, optionally on a phone profile with CPU throttle) and N bot pages.
// Measures the game page for --secs: frame time (mean, p95, p99, fps), main-thread script time, JS heap, WebRTC upload and download.
//   node tools/p2p/scale.mjs --root <dist> --n 8 [--phone] [--cpu 4] [--secs 15] [--kind nostr] [--relays wss://a,wss://b]
import { start, player, bots, closeAll, sleep, arg } from './lib.mjs';
const N = +arg('n', 4), phone = process.argv.includes('--phone'), cpu = +arg('cpu', phone ? 4 : 1), secs = +arg('secs', 15), kind = arg('kind', 'nostr'), relays = arg('relays', ''), none = process.argv.includes('--nop2p');
const ns = 'sc' + Date.now().toString(36), cx = -1250, cz = 250, room = `${ns}:500:-3:0`;
const h = await start();
try {
  const t0 = Date.now();
  const me = await player(h, { name: 'Me', ns, x: cx, z: cz, phone, cpu, p2p: none ? 'nop2p' : `p2p=${kind}${relays ? '&relays=' + relays : ''}` });
  const botPages = none ? [] : await bots(h, { n: N, room, kind, x: cx, z: cz, relays });
  await me.page.bringToFront();
  // wait for all peers (or give up)
  let drawn = 0, tConn = null;
  if (!none) for (let i = 0; i < 90; i++) { await sleep(1000); drawn = await me.page.evaluate(() => window.__p2p.remotes.size); if (drawn >= N) { tConn = (Date.now() - t0) / 1000; break; } }
  const botStates = await Promise.all(botPages.map(p => p.evaluate(() => ({ peers: window.bot.peers, errs: window.bot.errors.length, first: Math.round(window.bot.firstPeerAt) })).catch(() => null)));
  console.log(`N=${N} ${phone ? 'phone 844x390 cpu x' + cpu : 'desktop'}: me sees ${drawn}/${N} (all connected after ${tConn ? tConn.toFixed(1) + ' s from load' : 'never'}); bots see peers`, JSON.stringify(botStates.map(b => b && b.peers)), 'bot join errors', botStates.reduce((s, b) => s + (b ? b.errs : 0), 0));
  await sleep(3000);
  const m0 = await me.page.metrics(), w0 = none ? null : await me.page.evaluate(() => window.__p2p.wire());
  const frames = await me.page.evaluate(secs => new Promise(res => { const ts = []; let last = performance.now(); const t = setTimeout(() => { cancelAnimationFrame(id); res(ts); }, secs * 1000); let id; const f = now => { ts.push(now - last); last = now; id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); }), secs);
  const m1 = await me.page.metrics(), w1 = none ? null : await me.page.evaluate(() => window.__p2p.wire());
  frames.sort((a, b) => a - b); const mean = frames.reduce((s, v) => s + v, 0) / frames.length, pc = p => frames[Math.min(frames.length - 1, Math.floor(frames.length * p))];
  const heap = await me.page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  const st = none ? null : await me.page.evaluate(() => ({ ...window.__p2p.stats, drawn: window.__p2p.remotes.size, peers: window.__p2p.peers.size }));
  console.log(`  frame ms mean ${mean.toFixed(1)} p50 ${pc(0.5).toFixed(1)} p95 ${pc(0.95).toFixed(1)} p99 ${pc(0.99).toFixed(1)} (${(1000 / mean).toFixed(0)} fps); script ${(((m1.ScriptDuration - m0.ScriptDuration) / secs) * 1000).toFixed(0)} ms/s, task ${(((m1.TaskDuration - m0.TaskDuration) / secs) * 1000).toFixed(0)} ms/s; heap ${heap} MB; nodes ${m1.Nodes}`);
  if (w1) console.log(`  webrtc pcs ${w1.pcs} open ${w1.open}; up ${((w1.sent - w0.sent) / secs / 1024).toFixed(1)} KB/s, down ${((w1.recv - w0.recv) / secs / 1024).toFixed(1)} KB/s (data channels); on the wire incl. headers up ${(((w1.tsent - w0.tsent) || 0) / secs / 1024).toFixed(1)} down ${(((w1.trecv - w0.trecv) || 0) / secs / 1024).toFixed(1)} KB/s; app: ${JSON.stringify(st)}`);
  console.log('  page errors', me.errs.slice(0, 3));
} finally { await closeAll(h); }
