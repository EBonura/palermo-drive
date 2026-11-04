// The wake of a lapa on floats (src/vehicle-water.js): a narrow V opening behind the hull, thin foam lines on both sides that fade out and a little fine white churn right
// behind the stern. Owned by the sea work. createWake({ scene, seaY, uniforms }) -> { step(dt, car | null), clear(), count() }; src/sea.js calls step with the car while it is wet
// and with null otherwise (the rows left behind go on fading), and does the small spray and the ripple of a landing itself.
//
// One flat mesh on the water (a draw call, a fixed buffer, nothing allocated per frame, hidden when there is nothing left): rows across the track, one every STEP seconds of the
// stern's passing (newest first, shifted along in fixed arrays) plus a live row on the stern and a tip of the bow (BOWL ahead along the same track, where the two arms meet). Each row lies across the path actually travelled (from its neighbours, not the heading of the
// hull), so the wake curves smoothly in a turn. A row is two vertices, wide enough for the arm of its age (the varyings are linear across it); the fragment shader draws the two broken,
// uneven foam lines that taper to nothing and the churn from the distance across the track (in metres) and the age, with noise on the world position so the foam stays where it was left. The colour is the sea's own foam colour times its day/night light (uniforms.uAmb of
// src/sea.js), with the same fog. A jump of the hull (a teleport) clears the rows, so there is never a wake across the map.
import * as THREE from 'three';

const R = 56;                 // rows (slot 0 is the live stern row, 1.. the history)
const STEP = 0.09;            // seconds between two history rows
const LIFE = (R - 1) * STEP - 0.1;   // seconds a row lives (4.85 s: 80 m of V at 17 m/s)
const U = [-1, 1], K = U.length;
const RR = R + 1;             // vertex rows: the bow tip, then slots 0..R-1
const W0 = 1.15, WMAX = 4.5, JUMP = 20, BOWL = 2.9, BOWAGE = -0.14;   // the bow tip is BOWL metres ahead of the stern along the track, a BOWAGE of spread behind it (the arms meet there)   // metres: half the width of the hull with its floats, and the jump of the stern that means a teleport
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const VERT = [
  'attribute vec4 aA; attribute vec2 aB; varying vec4 vA; varying vec2 vB; varying vec2 vP;',   // aA: across (-1..1), extent (m), arm (m), age (s); aB: strength, churn
  '#include <fog_pars_vertex>',
  'void main(){ vA = aA; vB = aB; vP = position.xz; vec4 mvPosition = viewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;',
  '#include <fog_vertex>',
  '}',
].join('\n');
const FRAG = [
  'uniform vec3 uAmb; uniform float uLife; uniform float uTime; varying vec4 vA; varying vec2 vB; varying vec2 vP;',
  '#include <fog_pars_fragment>',
  'float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }',
  // a foam line at distance d (m) from its centre: soft edged, width w, broken into dashes by g, with ragged bubbles round it
  'float foam(float d, float w, float fw, float g, float sp){',
  '  float lp = max(w, fw * 0.8), q = d / lp;',
  '  float line = exp(-q * q * 1.6) * min(1.0, w / lp) * g;',
  '  float r = d / (lp * 3.0 + 0.05);',
  '  return clamp(line + exp(-r * r * 1.5) * sp * 0.8 * min(1.0, w / lp), 0.0, 1.0);',
  '}',
  'void main(){',
  '  float x = vA.x * vA.y, ax = abs(x), W = vA.z, age = vA.w, t = clamp(age / uLife, 0.0, 1.0);',
  '  float fade = pow(1.0 - t, 1.2) * vB.x;',
  '  if (fade < 0.01) discard;',
  '  float fw = fwidth(x);',
  '  float n1 = vn(vP * 0.8), n2 = vn(vP * 2.6 + 7.3), n3 = vn(vP * 9.0), n4 = vn(vP * 1.9 + 3.1), n5 = vn(vP * 1.4 + 11.0);',
  '  float taper = 1.0 - smoothstep(0.3, 1.0, t), grow = 0.1 + 0.085 * clamp(age, 0.0, 3.0), start = smoothstep(-0.14, -0.02, age);',
  // the outer arm: width varies along it, it breaks into dashes and thins out to nothing at the far end
  '  float wv = 0.3 + 1.5 * n1, wob = (n2 - 0.5) * 0.3 + (n3 - 0.5) * 0.14;',
  '  float arm = foam(abs(ax - W - wob), grow * wv * taper, fw, mix(smoothstep(0.3, 0.58, n4 * 0.5 + n5 * 0.5), 1.0, 0.45 * (1.0 - smoothstep(0.3, 2.0, age))), smoothstep(0.5, 0.75, n3)) * start;',
  // the inner arm: fainter, shorter, more broken
  '  float inner = foam(abs(ax - W * 0.55 - wob * 0.6), grow * 0.7 * (0.4 + 1.0 * n4) * taper * (1.0 - t), fw, smoothstep(0.35, 0.6, n2 * 0.5 + n1 * 0.5), smoothstep(0.62, 0.85, n3)) * 0.5 * start;',
  // fine churn behind the stern, soft at the edges and gone after two seconds
  '  float cw = 0.6 + 0.6 * age, g = exp(-ax * ax / (cw * cw) * 1.5);',
  '  float churn = smoothstep(0.38, 0.62, vn(vP * 7.0 + uTime * vec2(1.1, -0.8)) * 0.65 + n3 * 0.35) * g * (1.0 - smoothstep(0.0, 2.2, age)) * vB.y;',
  '  float a = clamp(max(max(arm, inner), churn), 0.0, 1.0) * fade;',
  '  if (a < 0.01) discard;',
  '  gl_FragColor = vec4(vec3(0.96, 0.98, 1.0) * 0.9 * uAmb, a);',
  '  #include <fog_fragment>',
  '}',
].join('\n');

export function createWake({ scene, seaY, uniforms }) {
  const pos = new Float32Array(RR * K * 3), aA = new Float32Array(RR * K * 4), aB = new Float32Array(RR * K * 2), idx = [];
  for (let j = 0; j < RR - 1; j++) for (let c = 0; c < K - 1; c++) { const a = j * K + c, b = a + K; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aA', new THREE.BufferAttribute(aA, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aB', new THREE.BufferAttribute(aB, 2).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLife: { value: LIFE } }]), vertexShader: VERT, fragmentShader: FRAG, fog: true,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8,
  });
  mat.uniforms.uAmb = uniforms.uAmb; mat.uniforms.uTime = uniforms.uTime;   // the sea's own, so the day and night light and the clock are shared
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false; scene.add(mesh);

  // the rows: position, heading, strength, spread rate (m/s of arm per second of age), age
  const X = new Float32Array(R), Z = new Float32Array(R), SN = new Float32Array(R), CS = new Float32Array(R), S = new Float32Array(R), RT = new Float32Array(R), AG = new Float32Array(R);
  let count = 0, acc = 0, live = false;

  function clear() { count = 0; acc = 0; live = false; mesh.visible = false; }
  function setRow(i, x, z, sn, cs, s, rt, age) { X[i] = x; Z[i] = z; SN[i] = sn; CS[i] = cs; S[i] = s; RT[i] = rt; AG[i] = age; }

  // the direction of the track at slot s (from its neighbours: the path actually travelled; the hull's heading where the lapa has hardly moved), into _dx, _dz
  let _dx = 0, _dz = 1;
  function dirAt(s, first) {
    const nw = Math.max(first, s - 2), od = Math.min(count, s + 2);   // two rows each way: a baseline of metres, so the direction does not jitter with the moment of the last row
    let dx = X[nw] - X[od], dz = Z[nw] - Z[od]; const l = Math.hypot(dx, dz);
    if (l > 0.3) { _dx = dx / l; _dz = dz / l; } else { _dx = SN[s]; _dz = CS[s]; }
  }
  function build() {
    const first = live ? 0 : 1, y = seaY + 0.035;
    for (let j = 0; j < RR; j++) {
      const bow = j === 0; let s = bow ? 0 : j - 1, on = true;
      if (bow) { on = live; if (!live) s = 1; } else if (s < first) { on = false; s = 1; } else if (s > count) { on = false; s = count; }
      dirAt(s, first);
      let px = X[s], pz = Z[s], age = AG[s];
      if (bow && on) { px += _dx * BOWL; pz += _dz * BOWL; age = BOWAGE; }   // the tip of the bow: the lines start here, along the floats, on the same smooth track as the rest
      const w = W0 + WMAX * (1 - Math.exp(-RT[s] * age / WMAX)), E = w + 0.9, rx = _dz, rz = -_dx, st = on ? S[s] : 0;
      for (let c = 0; c < K; c++) {
        const v = j * K + c, u = U[c], o = v * 3;
        pos[o] = px + rx * u * E; pos[o + 1] = y; pos[o + 2] = pz + rz * u * E;
        aA[v * 4] = u; aA[v * 4 + 1] = E; aA[v * 4 + 2] = w; aA[v * 4 + 3] = age;
        aB[v * 2] = st; aB[v * 2 + 1] = bow ? 0 : 1;
      }
    }
    g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true; g.attributes.aB.needsUpdate = true;
  }

  return {
    clear,
    count: () => count,
    // once per frame; car: the lapa while it is wet (x, z, th, vf, wet), null to let the rows left behind fade
    step(dt, car) {
      live = !!car;
      if (car) {
        const sn = Math.sin(car.th), cs = Math.cos(car.th), sp = Math.abs(car.vf || 0), s = sstep(1.5, 9, sp) * clamp((car.wet || 0) * 1.6, 0, 1), rt = 0.5 + 0.07 * sp;
        const sx = car.x - sn * 1.4, sz = car.z - cs * 1.4;
        if (count && (Math.abs(sx - X[1]) > JUMP || Math.abs(sz - Z[1]) > JUMP)) clear();   // teleported
        live = true;
        setRow(0, sx, sz, sn, cs, s, rt, 0);
        if ((acc += dt) >= STEP || !count) {
          acc = clamp(acc - STEP, 0, STEP);
          X.copyWithin(2, 1, R - 1); Z.copyWithin(2, 1, R - 1); SN.copyWithin(2, 1, R - 1); CS.copyWithin(2, 1, R - 1); S.copyWithin(2, 1, R - 1); RT.copyWithin(2, 1, R - 1); AG.copyWithin(2, 1, R - 1);
          setRow(1, sx, sz, sn, cs, s, rt, 0);
          if (count < R - 1) count++;
        }
      } else acc = 0;
      for (let i = 1; i <= count; i++) AG[i] += dt;
      while (count && AG[count] >= LIFE) count--;
      if (!live && count === 0) { mesh.visible = false; return; }
      build(); mesh.visible = true;
    },
  };
}
