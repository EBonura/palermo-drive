// Every player is drawn in the vehicle they chose, both ways: at the join (?veh=) and when they change it while connected (the Garage's
// setVehicle), for all seven vehicles. Also times how long a refreshed player takes to show up again on the other side.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/vehicles.mjs --root <dist built with --p2p>
import { start, player, sleep } from './lib.mjs';
const ns = 'veh' + Date.now().toString(36), TYPES = ['calessino', 'cassone', 'lapa50', 'vespa', 'scooterone', 'motorino', 'tascia'];
const h = await start();
let bad = 0;
const seen = P => P.page.evaluate(() => [...window.__p2p.remotes.values()].map(r => ({ type: r.type, kind: r.model && r.model.kind, liv: r.model && r.model.livery, visible: !!(r.model && r.model.root.visible && r.model.root.parent), name: r.name })));
async function expect(label, P, type, liv) {   // P must be drawing exactly one other player, in `type`
  const t0 = Date.now(); let s;
  while (Date.now() - t0 < 15000) { s = await seen(P); if (s.length === 1 && s[0].type === type && s[0].visible && (!liv || s[0].liv === liv)) break; await sleep(100); }
  const ok = s.length === 1 && s[0].type === type && s[0].visible && (!liv || s[0].liv === liv);
  console.log(label.padEnd(44), ok ? 'OK  ' : 'FAIL', ok ? ((Date.now() - t0) / 1000).toFixed(1) + ' s' : '', JSON.stringify(s)); if (!ok) bad++;
}
try {
  const A = await player(h, { name: 'Anna', ns, x: -300, z: 250 });   // the lapa
  let B = await player(h, { name: 'Bob', ns, x: -290, z: 250, extra: 'veh=motorino&liv=rosso' });
  await expect('joined: Anna sees Bob as a motorino', A, 'motorino', 'rosso');
  await expect('joined: Bob sees Anna as a calessino', B, 'calessino');
  // cold cost of building each model for the first time on this device (what the first sighting costs, once)
  const cold = await A.page.evaluate(types => Object.fromEntries(types.map(t => { const t0 = performance.now(); const r = window.pdVehicle.buildVehicleModel({ type: t, livery: undefined }); const ms = performance.now() - t0; r.dispose(); return [t, +ms.toFixed(1)]; })), TYPES);
  console.log('first build of each model (ms), on Anna:', JSON.stringify(cold));
  for (const t of TYPES) { await B.page.evaluate(t => window.pdVehicle.garage.setVehicle(t), t); await expect(`Bob changes to ${t}: Anna sees`, A, t); }
  for (const t of TYPES) { await A.page.evaluate(t => window.pdVehicle.garage.setVehicle(t), t); await expect(`Anna changes to ${t}: Bob sees`, B, t); }
  const paint = await B.page.evaluate(() => { const L = window.pdVehicle.LIVERIES, cur = window.pdVehicle.look().livery, to = L.find(l => l.id !== cur).id; window.pdVehicle.garage.setLivery(to); return to; });
  await expect(`Bob repaints (${paint})`, A, 'tascia', paint);
  // refresh timing: Bob reloads, how long until Anna draws him again and he draws Anna
  const times = [];
  for (let i = 0; i < 3; i++) {
    const oldId = await B.page.evaluate(() => window.__p2p.selfId), t0 = Date.now();
    // Anna polls from the moment Bob starts to reload, for a different, live, drawn peer than the old one
    const watch = (async () => { for (;;) { if (await A.page.evaluate(id => [...window.__p2p.peers.values()].some(q => q.id !== id && q.shown && performance.now() - q.lastRx < 1000), oldId)) return Date.now() - t0; if (Date.now() - t0 > 60000) return -1; await sleep(100); } })();
    await B.page.reload({ waitUntil: 'domcontentloaded' });
    await B.page.waitForFunction(() => window.game && window.__p2p && !document.getElementById('loading'), { timeout: 300000, polling: 100 });
    const tReady = Date.now() - t0;
    await B.page.evaluate(() => { const c = window.game.car; c.x = -290; c.z = 250; c.vx = c.vz = 0; });
    let b = 0; const tb = Date.now();
    while (!b && Date.now() - tb < 30000) { if (await B.page.evaluate(() => [...window.__p2p.peers.values()].some(q => q.shown && performance.now() - q.lastRx < 1000))) b = Date.now() - t0; else await sleep(100); }
    times.push({ pageReadyMs: tReady, annaSeesBobMs: await watch, bobSeesAnnaMs: b });   // all from the moment of the reload
  }
  console.log('refresh timing (ms from the reload):', JSON.stringify(times));
  console.log('errors', A.errs, B.errs);
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
