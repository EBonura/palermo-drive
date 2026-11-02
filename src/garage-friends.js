// The two friends of the officina, as billboard sprites in the pixel art of the street crowd (assets/peds/lpc/garage.png, made by tools/lpc/garage.mjs: they have an atlas of
// their own, loaded only when the Garage is built, so the crowd's atlas is untouched). The mechanic works at the vice on the bench, the other one leans in the light of the
// door with an espresso. Each sprite always faces the camera, but shows the cell that matches how the person stands to it (front, side, back) as the view turns round the vehicle.
// createFriends({ tint(x, z, out), day }) returns { group, update(sec), dispose() }; tint is the room's baked light at a spot, so the sprites sit in the room's lighting.
import * as THREE from 'three';
import { canvasTex, soft } from './garage-kit.js';

const BASE = new URL('../assets/peds/lpc/', import.meta.url).href;
// x, z: where they stand; face: the way they look (radians from +z towards +x); beat(sec): which of the two poses is shown
const PEOPLE = [
  { id: 'mechanic', x: -3.1, z: -1.5, face: -Math.PI / 2, beat: t => (t % 1.7) < 0.85 ? 0 : 1 },
  { id: 'loiterer', x: 1.25, z: -3.5, face: -0.35, beat: t => { const c = t % 6.5; return c > 3.6 && c < 5.0 ? 1 : 0; } },
];
const _c = new THREE.Vector3(), _l = { r: 1, g: 1, b: 1 };

export function createFriends({ tint, day = true } = {}) {
  const group = new THREE.Group(), sprites = []; let alive = true, tex = null, clock = 0;
  const shadow = canvasTex(64, 64, g => soft(g, 32, 32, 30, 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'));
  (async () => {
    try {
      const info = await (await fetch(BASE + 'garage.json')).json();
      tex = await new THREE.TextureLoader().loadAsync(BASE + 'garage.png');
      if (!alive) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
      const [CW, CH] = info.cell, [W, H] = info.atlas, w = CW * info.px, h = CH * info.px;
      for (const p of PEOPLE) {
        const cells = info.who[p.id]; if (!cells) continue;
        const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2 - info.ground * info.px, 0), uv = geo.attributes.uv;
        const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, fog: false }); if (tint) { tint(p.x, p.z, _l); mat.color.setRGB(Math.min(_l.r, 1.15), Math.min(_l.g, 1.15), Math.min(_l.b, 1.15)); }
        const mesh = new THREE.Mesh(geo, mat); mesh.position.set(p.x, 0, p.z); mesh.frustumCulled = false; mesh.renderOrder = 2;
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        sh.position.set(p.x, 0.012, p.z); sh.renderOrder = 1; group.add(sh); sprites.push({ p, mesh: sh, set: () => {} });
        let pose = 0;
        mesh.onBeforeRender = (r, sc, cam) => {   // turn to the camera, and pick the cell that matches the angle between where the person looks and where the camera is
          cam.getWorldPosition(_c); const dx = _c.x - p.x, dz = _c.z - p.z, a = Math.atan2(dx, dz);
          mesh.rotation.y = a; mesh.updateMatrixWorld();
          const fx = Math.sin(p.face), fz = Math.cos(p.face), onRight = fx * Math.cos(a) - fz * Math.sin(a), toCam = fx * Math.sin(a) + fz * Math.cos(a), th = Math.atan2(onRight, toCam);
          let dir = 0, flip = false; if (Math.abs(th) < Math.PI / 4) dir = 0; else if (Math.abs(th) > Math.PI * 3 / 4) dir = 2; else { dir = 1; flip = th > 0; }
          const n = cells[dir * 2 + pose], col = n % info.cols, row = Math.floor(n / info.cols), u0 = col * CW / W, u1 = (col + 1) * CW / W, v1 = 1 - row * CH / H, v0 = 1 - (row + 1) * CH / H;
          const l = flip ? u1 : u0, r2 = flip ? u0 : u1;
          uv.setXY(0, l, v1); uv.setXY(1, r2, v1); uv.setXY(2, l, v0); uv.setXY(3, r2, v0); uv.needsUpdate = true;
        };
        group.add(mesh); sprites.push({ p, mesh, set: v => { pose = v; } });
      }
    } catch (e) { console.warn('garage friends failed to load', e); }
  })();
  return {
    group,
    update(sec) { clock = sec; for (const s of sprites) s.set(s.p.beat(clock)); },
    dispose() {
      alive = false;
      for (const s of sprites) { s.mesh.geometry.dispose(); s.mesh.material.dispose(); }
      shadow.dispose(); if (tex) tex.dispose();
    },
  };
}
