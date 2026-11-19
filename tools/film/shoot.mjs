// Films a clip of the game frame by frame for the trailer: the game's clock is held and stepped a sixtieth of a second per frame, and every frame of the WebGL canvas is saved.
// The clip is smooth whatever the machine's speed, the same script gives the same drive (but for traffic and people, which use Math.random), and nothing in the game's own code changes.
//   tools/release/withbrowser.sh node tools/film/shoot.mjs <out dir> <shot.json>
// shot.json: { query: "spot=1&time=17.5", size: 1920, fps: 60, seconds: 5, settle: 6, preroll: 1,
//              keys: [{ key: "ArrowUp", from: 0, to: 5 }, { key: "Space", from: 2.4, to: 3 }] }   (times in seconds of the clip; preroll runs the keys' t < 0 part unfilmed)
// Writes <out dir>/f_00001.jpg ...; tools/film/take.sh shoots one format, encodes it and makes a contact sheet. The picture is the canvas only: no HUD, menu or bubbles.
// shot.json may also have: height (with size as the width), heading (degrees, set before the clip), cam (a film camera, see below; it needs the filmCam hook of src/main.js, which ?debug exposes).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { startServer } from '../build/serve.mjs';
const puppeteer = createRequire(new URL('../build/package.json', import.meta.url))('puppeteer-core');
const [out, shotFile] = process.argv.slice(2), shot = JSON.parse(fs.readFileSync(shotFile, 'utf8'));
const size = shot.size || 1920, fps = shot.fps || 60, wait = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(new URL('../..', import.meta.url).pathname), srv = await startServer(root), base = `http://127.0.0.1:${srv.port}/`;
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(), errs = []; await p.setViewport({ width: size, height: shot.height || size, deviceScaleFactor: 1 });
p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
// the held clock: until hold() the page runs in real time through these wrappers; after it, time and animation frames move only when step() says so
await p.evaluateOnNewDocument(() => {
  const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame.bind(window), d0 = Date.now() - performance.now();
  let held = false, vt = 0, q = [], id = 0;
  const now = () => held ? vt : realNow();
  performance.now = now; Date.now = () => Math.round(d0 + now());
  window.requestAnimationFrame = cb => { const i = ++id; q.push([i, cb]); return i; };
  window.cancelAnimationFrame = i => { q = q.filter(e => e[0] !== i); };
  const pump = ts => { const run = q; q = []; for (const e of run) { try { e[1](ts); } catch (err) { console.error(err); } } };
  const loop = () => { if (!held) { pump(realNow()); realRAF(loop); } }; realRAF(loop);
  window.__film = { hold() { held = true; vt = realNow(); }, step(ms) { vt += ms; pump(vt); } };
});
await p.goto(base + '?help=0&debug&play&clean&fixres&gfx=high&p2p=off&' + (shot.query || ''), { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForFunction(() => !document.getElementById('loading') && window.game && window.game.car, { timeout: 240000, polling: 250 });
await wait((shot.settle ?? 6) * 1000);   // the tiles round the start finish building
if (shot.heading !== undefined) await p.evaluate(d => { const c = window.game.car; c.th = d * Math.PI / 180; c.vx = c.vz = 0; }, shot.heading);   // degrees: 0 south (+z), 90 east, 180 north, 270 west
await p.evaluate(() => window.__film.hold());
// the film camera (shot.cam): placed every frame in place of the chase camera. Offsets are in the lapa's own frame at the moment the clip is set up: [right, up, forward] in metres.
//   { type: 'fixed', rel: [3, 1.4, 30], fov: 40 }                a tripod: stands where it is put and turns to follow the lapa
//   { type: 'fixed', pos: [30, 12], up: 1.6 }                   the same, at a place on the map (x, z in metres) and a height over its ground
//   { type: 'follow', rel: [2.5, 1.6, -7], look: [0, 0.9, 2], smooth: 2 }   rides with the lapa at that offset; smooth: how slowly it swings behind a turning lapa (seconds)
//   { type: 'orbit', radius: 9, up: 3, speed: 40, start: 180 }     circles the lapa, degrees a second
//   { type: 'dolly', rel: [-4, 2, 10], to: [4, 2, 40], seconds: 5 } slides between two points, looking at the lapa (or at lookRel: [r, u, f])
if (shot.cam) await p.evaluate((C, secs) => {
  const G = window.game, car = G.car, th0 = car.th, x0 = car.x, z0 = car.z, gy = (x, z) => G.groundY(x, z);
  const at = (rel, th, cx, cz) => { const s = Math.sin(th), c = Math.cos(th), x = cx + c * rel[0] + s * rel[2], z = cz - s * rel[0] + c * rel[2]; return [x, gy(x, z) + rel[1], z]; };
  const carY = () => gy(car.x, car.z) + (car.flying ? (car.fy || 0) : 0) + (C.lookUp ?? 0.9);
  const ease = u => u * u * (3 - 2 * u);
  // the same pull-in as the game's chase camera: a wall, a trunk or a kiosk between the lapa and the camera brings the camera in front of it (fast in, slowly back out)
  const hit = (x0, z0, x1, z1) => { let tMin = 1; G.walls2d.query(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), s => { if (s.lv !== undefined) return; const rx = x1 - x0, rz = z1 - z0, sx = s[2] - s[0], sz = s[3] - s[1], den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) return; const t = ((s[0] - x0) * sz - (s[1] - z0) * sx) / den, u = ((s[0] - x0) * rz - (s[1] - z0) * rx) / den; if (t >= 0 && t < tMin && u >= 0 && u <= 1) tMin = t; }); if (C.props && G.props && G.props.occlude) tMin = Math.min(tMin, G.props.occlude(x0, z0, x1, z1)); return tMin; };   // walls always; trunks, poles and kiosks only with cam.props (in a busy square they pull the camera onto the lapa's roof)
  // a wall between the lapa and where the camera wants to be: the camera swings round the lapa to the nearest clear angle (as an operator steps aside) and swings back when it can;
  // only if every angle is walled in does it come closer, rising as it does
  let pull = 1, ang = 0; const clear = (x, z, dt) => {
    const ox = x - car.x, oz = z - car.z, rot = a => { const c = Math.cos(a), s = Math.sin(a); return [car.x + ox * c + oz * s, car.z - ox * s + oz * c]; };
    let want = 0, bestT = -1, found = false; const first = ang < 0 ? -1 : 1;
    for (let k = 0; k <= 9 && !found; k++) for (const sg of k ? [first, -first] : [1]) { const a = sg * k * 0.35, q = rot(a), t = hit(car.x, car.z, q[0], q[1]); if (t >= 0.999) { want = a; found = true; break; } if (t > bestT) { bestT = t; want = a; } }
    const d = want - ang; ang += Math.sign(d) * Math.min(Math.abs(d), 4.5 * dt);
    const q = rot(ang), t = hit(car.x, car.z, q[0], q[1]), w = t < 0.999 ? Math.max(0.08, t * 0.86) : 1; pull = w < pull ? w : pull + (w - pull) * Math.min(1, dt * 1.5);
    return [car.x + (q[0] - car.x) * pull, car.z + (q[1] - car.z) * pull]; };
  let t = 0, th = th0; const fixed = C.pos ? [C.pos[0], gy(C.pos[0], C.pos[1]) + (C.up || 1.6), C.pos[1]] : C.rel ? at(C.rel, th0, x0, z0) : null, end = C.to ? at(C.to, th0, x0, z0) : null, lookAt = C.lookRel ? at(C.lookRel, th0, x0, z0) : null;
  G.filmCam = (cam, _car, dt) => {
    t += dt;
    if (C.fov && cam.fov !== C.fov) { cam.fov = C.fov; cam.updateProjectionMatrix(); }
    if (C.type === 'follow') {
      let d = car.th - th; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; th += d * Math.min(1, dt / (C.smooth || 0.001));
      const p = at(C.rel, th, car.x, car.z), l = at(C.look || [0, 0.9, 2], car.th, car.x, car.z), q = clear(p[0], p[2], dt); cam.position.set(q[0], p[1] + (1 - pull) * 4.5 + (car.flying ? (car.fy || 0) : 0), q[1]); if (hit(car.x, car.z, q[0], q[1]) < 0.999) window.__filmBlocked = (window.__filmBlocked || 0) + 1; cam.lookAt(l[0], l[1] + (car.flying ? (car.fy || 0) : 0), l[2]);
    } else if (C.type === 'orbit') {
      const a = ((C.start || 0) + (C.speed || 30) * t) * Math.PI / 180, q = clear(car.x + Math.sin(a) * C.radius, car.z + Math.cos(a) * C.radius, dt), x = q[0], z = q[1];
      cam.position.set(x, Math.max(gy(x, z) + 0.6, carY() + (C.up || 2)), z); cam.lookAt(car.x, carY(), car.z);
    } else {
      const u = end ? ease(Math.min(1, t / (C.seconds || secs))) : 0, p = end ? [fixed[0] + (end[0] - fixed[0]) * u, fixed[1] + (end[1] - fixed[1]) * u, fixed[2] + (end[2] - fixed[2]) * u] : fixed;
      cam.position.set(p[0], p[1], p[2]); if (lookAt) cam.lookAt(lookAt[0], lookAt[1], lookAt[2]); else cam.lookAt(car.x, carY(), car.z);
    }
  };
}, shot.cam, shot.seconds);
// the driver (shot.drive): steers for a list of points instead of pressing keys by the clock, so a bump does not leave the lapa parked against a table.
//   { points: [[x, z], ...] world metres, or rel: [[right, forward], ...] from where the lapa starts; nitro: true; drift: 0.7 (handbrake past this heading error, radians); loop: true }
// Standing still for half a second, it backs off turning and goes again. Keys from shot.keys still apply on top (a horn, the wings).
if (shot.drive) await p.evaluate(D => {
  const car = window.game.car, th0 = car.th, x0 = car.x, z0 = car.z;
  const pts = (D.rel || []).map(([r, f]) => [x0 + Math.cos(th0) * r + Math.sin(th0) * f, z0 - Math.sin(th0) * r + Math.cos(th0) * f]).concat(D.points || []);
  let i = 0, slow = 0, back = 0, backDir = 1; window.__filmStuck = 0;
  window.__filmDrive = dt => {
    const k = {}; if (i >= pts.length) { if (D.loop) i = 0; else { k.ArrowUp = true; return k; } }
    const dx = pts[i][0] - car.x, dz = pts[i][1] - car.z, sp = Math.hypot(car.vx, car.vz);
    if (Math.hypot(dx, dz) < (D.reach || 9)) i++;
    let err = Math.atan2(dx, dz) - car.th; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    if (back > 0) { back -= dt; k.ArrowDown = true; k[backDir > 0 ? 'ArrowRight' : 'ArrowLeft'] = true; return k; }
    slow = sp < 1.2 ? slow + dt : 0;
    if (slow > 0.5) { slow = 0; back = 0.8; backDir = err > 0 ? 1 : -1; window.__filmStuck++; return k; }
    k.ArrowUp = true; if (D.nitro) k.ShiftLeft = true;
    if (err > 0.05) k.ArrowLeft = true; else if (err < -0.05) k.ArrowRight = true;
    if (Math.abs(err) > (D.drift || 0.7) && sp > 7) k.Space = true;
    return k;
  };
}, shot.drive);
const keysAt = t => { const k = {}; for (const e of shot.keys || []) if (t >= e.from && t < e.to) k[e.key] = true; return k; };

const frame = (t, grab) => p.evaluate((ks, ms, grab) => {
  const K = window.game.keys; for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'KeyF', 'KeyH', 'KeyW', 'KeyA', 'KeyS', 'KeyD']) K[k] = !!ks[k];
  if (window.__filmDrive) { const d = window.__filmDrive(ms / 1000); for (const k in d) if (d[k]) K[k] = true; }
  window.__film.step(ms);
  return grab ? window.game.renderer.domElement.toDataURL('image/jpeg', 0.95) : null;
}, keysAt(t), 1000 / fps, grab);
const pre = Math.round((shot.preroll ?? 1) * fps), n = Math.round(shot.seconds * fps), t0 = Date.now();
for (let i = -pre; i < n; i++) {
  const url = await frame(i / fps, i >= 0);
  if (url) fs.writeFileSync(path.join(out, 'f_' + String(i + 1).padStart(5, '0') + '.jpg'), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  if (i > 0 && i % 60 === 0) await wait(150);   // a breath for the tile workers and the garbage collector
}
const st = await p.evaluate(() => { const c = window.game.car, r = window.game.renderer.domElement; return { behindWall: window.__filmBlocked || 0, stuck: window.__filmStuck || 0,  x: Math.round(c.x), z: Math.round(c.z), kmh: Math.round(Math.hypot(c.vx, c.vz) * 3.6), canvas: r.width + 'x' + r.height }; });
const th = await p.evaluate(() => Math.round(window.game.car.th * 180 / Math.PI));
console.log('heading', th, `${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`, JSON.stringify(st), errs.length ? 'ERR ' + errs.join(' | ') : 'no errors');
await b.close(); process.exit(0);
