// The player's own driver ("Il tuo autista"). The Garage's driver screen (src/garage-ui.js, src/driver-compose.js) builds a pixel-art person from LPC layers; what the street needs of
// it is only three small pictures (seated, seen from the front, the side and the back), which are kept here, saved in localStorage next to the options that made them, so
// that driving never downloads the layers. In every vehicle the driver is a billboard in the seat: it turns to the camera but shows the picture that matches the angle between where
// the vehicle points and where the camera is (the back of the head in the chase view, the face through the windscreen from the front). Without a saved driver nothing changes:
// the lapa keeps its blocky 3D driver.
//   driver.has()              a driver was made
//   driver.spec()             the options it was made from (the creator reopens with them)
//   driver.set(frames, spec)  frames: { front, left, back }, each 64x64 RGBA bytes of the seated person (src/driver-compose.js); saves, and every lapa on screen updates
//   driver.clear()            forget the driver: the lapae go back to the 3D one
//   driver.dress(rig)         called for a vehicle rig that is made (street and Garage): puts the sprite in the seat
import * as THREE from 'three';

const KEY = 'pd.driver', CELL = { x: 12, y: 6, w: 40, h: 58 };   // the part of each 64x64 frame that is kept: x, y of the top left, size in pixels (fits every hat, hairdo and arm)
const PX = 0.0215;                      // metres per pixel on the lapa's seat: a seated person is 0.8 m from the seat to the top of the head (the 3D driver it replaces is about 0.75)
const SEAT_ROW = 47;                    // the row of the frame where the hips are in the seated pose
const SEAT = { y: 1.06, z: 0.14 };      // the top of the seat cushion and where the driver sits (vehicle units of the lapa, before the Lapa 50's 0.86 scale)

let spec = null, tex = null, canvas = null, ready = false;
const dressed = new Set(), lapas = new Set(), listeners = new Set();   // dressed: the sprites that exist; lapas: every lapa rig that is alive (so a driver made later reaches them)
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _c = new THREE.Vector3(), _f = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

function makeTexture() {
  if (tex) return;
  canvas = document.createElement('canvas'); canvas.width = CELL.w * 3; canvas.height = CELL.h;
  tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
}
function paint(frames) {   // the three frames next to each other: front, left, back
  makeTexture();
  const g = canvas.getContext('2d'), out = g.createImageData(CELL.w * 3, CELL.h);
  ['front', 'left', 'back'].forEach((d, k) => { const f = frames[d]; for (let y = 0; y < CELL.h; y++) for (let x = 0; x < CELL.w; x++) {
    const i = ((CELL.y + y) * 64 + CELL.x + x) * 4, o = (y * CELL.w * 3 + k * CELL.w + x) * 4; out.data[o] = f[i]; out.data[o + 1] = f[i + 1]; out.data[o + 2] = f[i + 2]; out.data[o + 3] = f[i + 3]; } });
  g.putImageData(out, 0, 0); tex.needsUpdate = true; ready = true;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, spec, png: canvas.toDataURL('image/png') })); } catch (e) { /* private window or full: the driver lasts until the page is closed */ }
}
(function load() {   // a saved driver: its pictures come back from the data URL (a few KB), no layers are fetched
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { return; }
  if (!s || s.v !== 1 || !s.spec || typeof s.png !== 'string' || !s.png.startsWith('data:image/png;base64,')) return;   // only our own kind of picture: a tampered save cannot make the page fetch an address
  const img = new Image();
  img.onload = () => { if (ready) return; makeTexture(); spec = s.spec; canvas.getContext('2d').drawImage(img, 0, 0); tex.needsUpdate = true; ready = true; dressAll(); for (const f of listeners) f(); };
  img.src = s.png;
})();

// ---- the billboard in the seat
function undress(rec) {
  rec.mesh.parent && rec.mesh.parent.remove(rec.mesh); rec.mesh.geometry.dispose(); rec.mesh.material.dispose();
  for (const c of rec.hidden) c.visible = true;
  dressed.delete(rec);
}
function dressTo(rig) {
  const tp = rig.tpl.spec.tiltPivot, s = tp[1] / 0.45, k = PX * s, w = CELL.w * k, h = CELL.h * k;   // the lapae scale their whole model (the Lapa 50 by 0.86) and pivot at 0.45 m of it
  const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), uv = geo.attributes.uv;
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  if (rig.kind === 'lapa') mesh.position.set(0 - tp[0], SEAT.y * s - (64 - SEAT_ROW) * k - tp[1], SEAT.z * s - tp[2]);   // the plane's bottom edge is the bottom row of the frame
  else {   // the two-wheelers, the cart and the car: where the 3D driver it replaces is, with the head at the same height
    rig.driver.updateWorldMatrix(true, true); const box = new THREE.Box3().setFromObject(rig.driver).applyMatrix4(rig.driver.matrixWorld.clone().invert());
    if (box.isEmpty()) { const st = rig.seats?.[0] || { x: 0, y: 1, z: 0 }; box.set(new THREE.Vector3(st.x - tp[0], st.y - tp[1], st.z - tp[2]), new THREE.Vector3(st.x - tp[0], st.y - tp[1] + 0.8, st.z - tp[2])); }
    mesh.position.set((box.min.x + box.max.x) / 2, box.max.y - h, (box.min.z + box.max.z) / 2);
  }
  const hidden = rig.driver.children.filter(c => c.visible); for (const c of hidden) c.visible = false;
  const rec = { rig, mesh, hidden }; rig.driver.add(mesh); dressed.add(rec);
  mesh.onBeforeRender = (r, sc, cam) => {   // upright, towards the camera; the picture that matches the angle between the vehicle's nose and the camera
    const par = mesh.parent; par.getWorldQuaternion(_q); _f.set(0, 0, 1).applyQuaternion(_q); _f.y = 0;
    mesh.getWorldPosition(_p); cam.getWorldPosition(_c); const dx = _c.x - _p.x, dz = _c.z - _p.z, a = Math.atan2(dx, dz);
    _q2.setFromAxisAngle(_y, a); mesh.quaternion.copy(_q).invert().multiply(_q2);
    const fl = Math.hypot(_f.x, _f.z) || 1, fx = _f.x / fl, fz = _f.z / fl, right = fx * Math.cos(a) - fz * Math.sin(a), toCam = fx * Math.sin(a) + fz * Math.cos(a), th = Math.atan2(right, toCam);
    let cell = 0, flip = false; if (Math.abs(th) < Math.PI / 4) cell = 0; else if (Math.abs(th) > Math.PI * 3 / 4) cell = 2; else { cell = 1; flip = th > 0; }
    const u0 = cell / 3, u1 = (cell + 1) / 3, l = flip ? u1 : u0, rr = flip ? u0 : u1;
    uv.setXY(0, l, 1); uv.setXY(1, rr, 1); uv.setXY(2, l, 0); uv.setXY(3, rr, 0); uv.needsUpdate = true;
    mesh.updateMatrixWorld();
  };
}

const isDressed = rig => { for (const r of dressed) if (r.rig === rig) return true; return false; };
const dressAll = () => { for (const rig of lapas) if (!isDressed(rig)) dressTo(rig); };
export const driver = {
  has: () => ready,
  spec: () => spec,
  set(frames, s) { spec = s; paint(frames); save(); dressAll(); for (const f of listeners) f(); },
  clear() { spec = null; ready = false; try { localStorage.removeItem(KEY); } catch (e) { /* nothing saved */ } for (const r of [...dressed]) undress(r); for (const f of listeners) f(); },
  dress(rig) {
    if (!rig || lapas.has(rig)) return;
    lapas.add(rig); const od = rig.dispose; rig.dispose = () => { lapas.delete(rig); for (const r of [...dressed]) if (r.rig === rig) undress(r); od(); };
    if (ready) dressTo(rig);
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
