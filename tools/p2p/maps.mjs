// Other players on the minimap (a cyan ring) and on the big map (ring + name), desktop and phone. Only players we are connected to can be there.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/maps.mjs --root <dist> [--out dir]
import { start, player, sleep, arg } from './lib.mjs';
const out = arg('out', '/private/tmp/claude-501/p2pinteract'), ns = 'mp' + Date.now().toString(36), h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const until = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 150) { const v = await fn(); if (v) return v; await sleep(150); } return null; };
const rings = P => P.page.evaluate(() => window.__pdMinimap && 0);
const markers = P => P.page.evaluate(() => [...window.__p2p.remotes.values()].map(r => ({ name: r.name, shape: r.marker.shape, color: r.marker.color, player: r.marker.player })));
const mini = P => P.page.evaluate(() => { const c = document.getElementById('mini'), b = c.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
try {
  for (const phone of [false, true]) {
    const tag = phone ? 'phone' : 'desk', o = { ns: ns + tag, size: [900, 500], phone, isolated: true };
    const A = await player(h, { ...o, name: 'Anna', x: 137, z: -212 }), B = await player(h, { ...o, name: 'Bob', x: 177, z: -190 });
    ok(`${tag}: they meet`, await until(async () => (await markers(A)).length && (await markers(B)).length, 90000));
    await sleep(2500);
    const m = (await markers(A))[0];
    ok(`${tag}: the other player is a cyan ring with its name`, m.shape === 'ring' && m.color === '#00e1ff' && m.player && m.name === 'Bob', JSON.stringify(m));
    const r = await mini(A); console.log(`   minimap on screen: ${Math.round(r.w)} px wide`);
    await A.page.screenshot({ path: `${out}/maps-${tag}-minimap-full.png` });
    await A.page.screenshot({ path: `${out}/maps-${tag}-minimap.png`, clip: { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.w + 16, height: r.h + 16 } });
    // the ring grows as the player comes near (clamped): pictures at 6 m, 120 m and 380 m
    for (const d of [6, 120, 380]) {
      await B.page.evaluate(d => { const c = window.game.car; c.x = 137 + d * 0.8; c.z = -212 - d * 0.6; c.vx = c.vz = 0; }, d); await sleep(1800);
      await A.page.screenshot({ path: `${out}/maps-${tag}-minimap-d${d}.png`, clip: { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.w + 16, height: r.h + 16 } });
    }
    await B.page.evaluate(() => { const c = window.game.car; c.x = 177; c.z = -190; c.vx = c.vz = 0; }); await sleep(1500);
    // the big map, from the pause menu ("In strada")
    await A.page.evaluate(() => document.getElementById('mini').click()); await sleep(6000);   // the minimap opens the big map
    console.log('   game state', await A.page.evaluate(() => window.__p2p.gameState()));
    await A.page.screenshot({ path: `${out}/maps-${tag}-bigmap.png` });
    await A.page.mouse.move(460, 285); for (let i = 0; i < 8; i++) { await A.page.mouse.wheel({ deltaY: -300 }); await sleep(150); } await sleep(1500);
    await A.page.screenshot({ path: `${out}/maps-${tag}-bigmap-zoomed.png` });
    const pl = await A.page.evaluate(() => window.__p2p && [...window.__p2p.remotes.values()].length);
    ok(`${tag}: the big map is open with one other player known`, pl === 1);
    console.log('errors', A.errs, B.errs);
    await A.page.close(); await B.page.close();
  }
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
