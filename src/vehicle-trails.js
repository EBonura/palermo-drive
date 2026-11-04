// Wing trails: two long ribbons of vapour from the wing tips while the lapa flies (src/vehicle-air.js). Owned by the driving work.
//
// createTrails({ scene }) -> { update(dt, car, rig, camera, onRoof), clear() }. update runs once per frame from updateVisual (src/vehicle.js), after the rig is posed: the tips are
// A.wing of the template (addWings in src/vehicle-models.js, in model coordinates) carried to the world through the tilt group, so the ribbons follow the bank and the pitch.
// Each ribbon keeps the last R rows of its tip (one every STEP seconds, newest first, shifted along in fixed arrays) plus a live row on the wing itself; the rows are turned to face
// the camera every frame (width = cross(tangent, to the camera)), so a trail reads from the chase camera, from the side and from above. One mesh, one draw call, two ribbons in one
// fixed buffer, nothing allocated per frame, nothing drawn (mesh hidden) when there is nothing left to fade. The head of a ribbon is strongest, a row fades with its age; the vapour
// is stronger and thicker the faster it flies and while it climbs. A jump of the tip (a teleport) or another rig clears the rows, so there is never a ribbon across the map.
import * as THREE from 'three';

const R = 56;                 // rows per ribbon: the live one plus 55 of history
const H = R - 1;              // history rows
const STEP = 0.04;            // seconds between two history rows
const LIFE = H * STEP;        // 2.2 s: a row is gone after this (at the 45 m/s cap the ribbon is a hundred metres long)
const JUMP = 30;              // metres: a tip further than this from its last row has been teleported
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const VERT = 'attribute vec3 aT; varying vec3 vT; void main(){ vT = aT; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }';   // aT: across (-1..1), age (0..1), strength
const FRAG = [
  'varying vec3 vT; uniform vec3 uRim;',
  'void main(){',
  '  float e = 1.0 - abs(vT.x), age = vT.y;',
  '  float a = (0.3 + 0.7 * vT.z) * pow(1.0 - age, 1.4) * smoothstep(0.0, 0.5, e);',
  '  if (a < 0.01) discard;',
  '  vec3 c = mix(uRim, vec3(1.0), smoothstep(0.3, 0.85, e));',
  '  gl_FragColor = vec4(c, a);',
  '}',
].join('\n');

export function createTrails({ scene }) {
  const pos = new Float32Array(2 * R * 2 * 3), aT = new Float32Array(2 * R * 2 * 3), idx = [];
  for (let k = 0; k < 2; k++) for (let j = 0; j < R - 1; j++) { const a = (k * R + j) * 2, b = a + 2; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 3).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ uniforms: { uRim: { value: new THREE.Color(0.96, 0.74, 0.9) } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = false; scene.add(mesh);

  // slot 0 of each array is the live row on the wing (rewritten every frame while flying), slots 1..H the history, newest first; count = history rows in use
  const hp = [new Float32Array(R * 3), new Float32Array(R * 3)], ha = new Float32Array(R), hs = new Float32Array(R);
  let count = 0, acc = 0, lastRig = null;
  const tp = [new THREE.Vector3(), new THREE.Vector3()];
  const _t = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

  function clear() { count = 0; acc = 0; mesh.visible = false; }

  // the rows of ribbon k into the buffers: slots o0..count (o0 = 1 when the live row is not there), the unused rows collapse on the last one
  function fill(k, o0, cam) {
    const P = hp[k], last = count, n = last - o0 + 1;
    for (let j = 0; j < R; j++) {
      const m = j < n ? o0 + j : last, o = (k * R + j) * 6, m0 = Math.max(o0, m - 1) * 3, m1 = Math.min(last, m + 1) * 3;
      _s.set(P[m * 3], P[m * 3 + 1], P[m * 3 + 2]);
      // the width runs across the tangent and the way to the camera
      _t.set(P[m0] - P[m1], P[m0 + 1] - P[m1 + 1], P[m0 + 2] - P[m1 + 2]);
      _v.set(cam.x - _s.x, cam.y - _s.y, cam.z - _s.z);
      _t.cross(_v);
      const l = _t.length(); if (l > 1e-5) _t.multiplyScalar(1 / l); else _t.set(0, 0, 0);
      const v = j < n ? ha[m] / LIFE : 1, s = j < n ? hs[m] : 0, hw = (0.06 + 0.11 * s) * (1 + 1.6 * v);
      for (let e = 0; e < 2; e++) {
        const sg = e ? 1 : -1, q = o + e * 3;
        pos[q] = _s.x + _t.x * hw * sg; pos[q + 1] = _s.y + _t.y * hw * sg; pos[q + 2] = _s.z + _t.z * hw * sg;
        aT[q] = sg; aT[q + 1] = v; aT[q + 2] = s;
      }
    }
  }

  return {
    clear,
    update(dt, car, rig, camera, onRoof) {
      if (rig !== lastRig) { lastRig = rig; clear(); }
      const W = rig && rig.A && rig.A.wing, live = !!(W && car.wings && car.flying && !onRoof && car.agl > 0.8);
      if (!live && count === 0) { if (mesh.visible) mesh.visible = false; return; }
      if (live) {
        const spd = Math.hypot(car.vx, car.vz, car.fvy || 0), strength = clamp(0.3 + 0.45 * sstep(8, 40, spd) + 0.45 * sstep(1, 9, car.fvy || 0), 0, 1), sp = rig.tpl.spec.tiltPivot;
        rig.tilt.updateWorldMatrix(true, false);
        for (let k = 0; k < 2; k++) rig.tilt.localToWorld(tp[k].set((k ? W.x : -W.x) - sp[0], W.y - sp[1], W.z - sp[2]));
        if (count && (Math.abs(tp[0].x - hp[0][3]) > JUMP || Math.abs(tp[0].y - hp[0][4]) > JUMP || Math.abs(tp[0].z - hp[0][5]) > JUMP)) clear();   // teleported: no ribbon across the map
        for (let k = 0; k < 2; k++) { hp[k][0] = tp[k].x; hp[k][1] = tp[k].y; hp[k][2] = tp[k].z; }
        ha[0] = 0; hs[0] = strength;
        if ((acc += dt) >= STEP || !count) {   // a new history row now and then
          acc = Math.min(acc - STEP, STEP); if (acc < 0) acc = 0;
          for (let k = 0; k < 2; k++) { hp[k].copyWithin(6, 3, (R - 1) * 3); hp[k][3] = tp[k].x; hp[k][4] = tp[k].y; hp[k][5] = tp[k].z; }
          ha.copyWithin(2, 1, R - 1); hs.copyWithin(2, 1, R - 1); ha[1] = 0; hs[1] = strength;
          if (count < H) count++;
        }
      } else acc = 0;
      for (let i = 1; i <= count; i++) ha[i] += dt;   // age the history; the oldest rows are last
      while (count && ha[count] >= LIFE) count--;
      if (!live && count === 0) { mesh.visible = false; return; }
      for (let k = 0; k < 2; k++) fill(k, live ? 0 : 1, camera.position);
      g.attributes.position.needsUpdate = true; g.attributes.aT.needsUpdate = true;
      mesh.visible = true;
    },
  };
}
