// Race bot: a scripted driver follows the racing line through a whole race (countdown, laps, checkpoints, result panel, prize, saved progress) and logs what the event system does.
//   node tools/build/racebot.mjs <regione|scienze|olimpo|corse> [host=http://localhost:8792/] [W=1280] [H=720] [extra query, e.g. "assist=1&time=23"]
// env: MAXWAIT=minutes (12), OUT=directory for the screenshots and the json (os tmp dir), CHROME=path. `assist=1` teleports the lapa on along the line when it is stuck or at a dead-end
// turning point (a bot cannot do a three point turn); without it the bot reports STUCK. The night Corse needs `time=23` to be dark (`night=1` only lets the race stage).
import os from 'os'; import path from 'path'; import fs from 'fs'; import puppeteer from 'puppeteer-core';
const OUT = process.env.OUT || os.tmpdir();
const [id, host = 'http://localhost:8792/', W = 1280, H = 720, extra = ''] = process.argv.slice(2);
const night = id === 'corse';
const b = await puppeteer.launch({ executablePath: process.env.CHROME || (process.env.PD_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: +W, height: +H, deviceScaleFactor: 1, hasTouch: +W < 900, isMobile: +W < 900 });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' || (m.type() === 'warn' && !/toNonIndexed|noShadow/.test(m.text()))) errs.push(m.text().slice(0, 200)); });
const tag = `${id}-${W}`;
await p.exposeFunction('nodeLog', (m) => console.log('PAGE', m)); p.on('framenavigated', f => { if (f === p.mainFrame()) console.log('NAV', f.url().slice(0, 120)); });
await p.goto(host + `?help=0&play&debug&event=race:${id}&auto&cash=0${night ? '&night=1' : ''}${extra ? '&' + extra : ''}`, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.game && window.__missions && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
await p.evaluate(() => {
  const M = window.__missions, G = window.game, keys = G.keys, races = M.races, log = window.__log = [], ev = window.__ev = [];
  let t0 = performance.now(), fr = 0, stuck = 0, last = {}; const T = () => +((performance.now() - t0) / 1000).toFixed(2);
  const note = (k, v) => { if (last[k] !== v) { last[k] = v; ev.push([T(), k, v]); } };
  window.__cash0 = M.X.vehicle.garage.cash; window.__assist = new URLSearchParams(location.search).has('assist'); addEventListener('pd-drowned', () => nodeLog('DROWNED at ' + Math.round(G.car.x) + ',' + Math.round(G.car.z) + ' state ' + (races.R && races.R.state)));
  window.__drive = setInterval(() => {
    fr++;
    const R = races.R;
    note('busy', M.api.busy()); note('stage', !!races.stage);
    const cnt = document.querySelector('.ev-count'); if (cnt) note('count', cnt.textContent + '|' + cnt.className);
    const res = document.querySelector('.ev-result'); if (res && res.classList.contains('on')) note('result', res.innerText.replace(/\n+/g, ' / '));
    for (const el of document.querySelectorAll('.ev-toast')) note('toast', el.innerText.replace(/\n+/g, ' / '));
    if (!R) { keys.ArrowUp = keys.ArrowLeft = keys.ArrowRight = keys.ArrowDown = false; return; }
    note('state', R.state);
    const car = G.car, trk = R.trk;
    if (R.state !== 'race' && R.state !== 'count') { keys.ArrowUp = keys.ArrowLeft = keys.ArrowRight = keys.ArrowDown = false; return; }
    if (R.state === 'count') { keys.ArrowUp = true; keys.ArrowLeft = keys.ArrowRight = false; }
    const v = Math.hypot(car.vx, car.vz), s = R.prevS, la = Math.max(9, Math.min(42, v * 0.8)), a = trk.at(s + la), cap = trk.at(s + 28).cap;
    const want = Math.atan2(a.x - car.x, a.z - car.z); let e = want - car.th; e = Math.atan2(Math.sin(e), Math.cos(e));
    const duty = Math.min(1, Math.abs(e) / 0.3), pulse = (fr % 4) < duty * 4 + 0.001 && duty > 0.05, dir = (window.__steerSign || 1) * Math.sign(e);
    if (R.state === 'race') {
      const U = window.__U || (window.__U = { mode: 'drive', slow: 0, t: 0 });
      if (U.mode === 'drive') { if (v < 0.8) U.stk = (U.stk || 0) + 1 / 30; else U.stk = 0; if (U.stk > 0.6) { U.mode = 'rev'; U.t = 0; U.slow = -99; U.stk = 0; ev.push([T(), 'REVERSE', Math.round(car.x) + ',' + Math.round(car.z)]); } else if (Math.abs(e) > 1.9 && v < 10) { U.mode = 'fwd'; U.t = 0; U.slow = 0; ev.push([T(), 'UTURN', Math.round(car.x) + ',' + Math.round(car.z)]); } }
      else { U.t += 1 / 30; if (Math.abs(e) < 0.9 || (U.slow === -99 && U.t > 1.3)) { U.mode = 'drive'; U.slow = 0; } else { if (v < 1.0) U.slow += 1 / 30; else U.slow = 0; if (U.slow > 0.5) { U.mode = U.mode === 'fwd' ? 'rev' : 'fwd'; U.slow = 0; } } }
      if (U.mode === 'drive') { keys.ArrowLeft = pulse && dir > 0; keys.ArrowRight = pulse && dir < 0; keys.ArrowUp = v < cap * 0.98; keys.ArrowDown = v > cap * 1.15; }
      else if (U.mode === 'fwd') { keys.ArrowLeft = dir > 0; keys.ArrowRight = dir < 0; keys.ArrowUp = v < 6; keys.ArrowDown = false; }
      else { keys.ArrowLeft = dir < 0; keys.ArrowRight = dir > 0; keys.ArrowUp = false; keys.ArrowDown = true; }
    }
    if (R.state === 'race' && window.__assist) {
      const t1 = trk.at(s + 7), t0x = t1.tx, t0z = t1.tz, t2 = trk.at(s - 7), dotp = t0x * t2.tx + t0z * t2.tz;
      window.__tipT = (window.__tipT || 0);
      if (dotp < -0.4 && v < 3) { window.__tipT += 1 / 30; if (window.__tipT > 0.7) { const q = trk.at(s + 16); const th = Math.atan2(q.tx, q.tz); M.X.vehicle.teleport(q.x, q.z, th); ev.push([T(), 'ASSIST-UTURN', Math.round(q.x) + ',' + Math.round(q.z)]); window.__tipT = 0; } } else window.__tipT = 0;
    }
    if (v < 1.5 && R.state === 'race') stuck++; else stuck = 0;
    if (stuck > (window.__assist ? 60 : 90)) { ev.push([T(), 'STUCK', Math.round(car.x) + ',' + Math.round(car.z)]); stuck = 0; if (window.__assist) { const q = trk.at(s + 10); M.X.vehicle.teleport(q.x, q.z, Math.atan2(q.tx, q.tz)); ev.push([T(), 'ASSIST-RECOVER', Math.round(q.x) + ',' + Math.round(q.z)]); } }
    if (fr % 60 === 0 && R) nodeLog('t' + T() + ' ' + R.state + ' tot ' + Math.round(R.total) + ' x ' + Math.round(car.x) + ' z ' + Math.round(car.z) + ' v ' + v.toFixed(1) + ' U ' + (window.__U ? window.__U.mode : '-'));
    if (fr % 30 === 0) { const off = (() => { const q = trk.at(s); return Math.round(Math.hypot(car.x - q.x, car.z - q.z)); })(); log.push({ t: T(), st: R.state, rt: +R.t.toFixed(1), tot: Math.round(R.total), of: Math.round(R.finishS), rank: R.rank, cpi: R.cpi, v: +v.toFixed(1), off, x: Math.round(car.x), z: Math.round(car.z), riv: R.rivals.map(r => Math.round(r.total)).join(',') }); }
  }, 33);
});
const shot = async n => p.screenshot({ path: path.join(OUT, `race-${tag}-${n}.png`) });
const shots = {}; const tStart = Date.now(), maxWait = +(process.env.MAXWAIT || 12) * 60 * 1000; let sawRace = false, endAt = 0;
while (Date.now() - tStart < maxWait) {
  await new Promise(r => setTimeout(r, 1000));
  const st = await p.evaluate(() => { const R = window.__missions.races.R; return { R: R ? { state: R.state, t: R.t, total: R.total, fin: R.finishS, rank: R.rank, v: Math.hypot(window.game.car.vx, window.game.car.vz) } : null, busy: window.__missions.api.busy(), cash: window.__missions.X.vehicle.garage.cash }; });
  const R = st.R;
  if (R) sawRace = true;
  if (R && R.state === 'count' && !shots.count) { shots.count = 1; await new Promise(r => setTimeout(r, 1500)); await shot('count'); }
  if (R && R.state === 'race' && !shots.mid1 && R.total > R.fin * 0.25) { shots.mid1 = 1; await shot('mid1'); }
  if (R && R.state === 'race' && !shots.mid2 && R.total > R.fin * 0.7) { shots.mid2 = 1; await shot('mid2'); }
  if (R && R.state === 'finish' && !shots.fin) { shots.fin = 1; await new Promise(r => setTimeout(r, 1500)); await shot('result'); }
  if (!shots.stuck && await p.evaluate(() => window.__ev.some(e => e[1] === 'STUCK'))) { shots.stuck = 1; await shot('stuck'); await p.evaluate(() => { const c = window.game.car; window.__stuckInfo = { x: c.x, z: c.z, th: c.th }; }); if (process.env.STOPSTUCK) break; }
  if (sawRace && !R && !st.busy) { if (!endAt) endAt = Date.now(); if (Date.now() - endAt > 4000) break; }
  if ((Date.now() - tStart) % 20000 < 1000) process.stdout.write(`.. ${R ? R.state + ' ' + Math.round(R.total) + '/' + Math.round(R.fin) + ' rank ' + R.rank + ' v ' + R.v.toFixed(1) : 'no race'}\n`);
}
await shot('after');
const out = await p.evaluate(() => { const M = window.__missions; return { log: window.__log, ev: window.__ev, prog: M.prog, ls: localStorage.getItem('palermoDrive.events.v1'), cash0: window.__cash0, cash: M.X.vehicle.garage.cash, busy: M.api.busy(), car: [Math.round(window.game.car.x), Math.round(window.game.car.z)], slot: (() => { const s = M.slots.find(s => s.id === 'race:' + new URLSearchParams(location.search).get('event').split(':')[1]); return s && [Math.round(s.x), Math.round(s.z), s.coolUntil && Math.round(s.coolUntil)]; })(), sceneKids: window.game.scene.children.length }; });
fs.writeFileSync(path.join(OUT, `race-${tag}.json`), JSON.stringify(out, null, 1));
console.log('events:'); for (const e of out.ev) console.log('  ', JSON.stringify(e).slice(0, 220));
console.log('log (every ~2nd sample):'); out.log.filter((_, i) => i % 3 === 0).forEach(l => console.log('  ', JSON.stringify(l)));
console.log('cash', out.cash0, '->', out.cash, 'prog', JSON.stringify(out.prog.races), 'ls', out.ls, 'busy', out.busy, 'car', out.car, 'slot', out.slot, 'sceneKids', out.sceneKids);
console.log(errs.join('\n') || 'no console errors'); await b.close(); console.log('FIN');
