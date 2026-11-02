// The crowd of the Stadio Renzo Barbera: rosanero fans on the seats of both tiers, one InstancedMesh of upright quads (a few thousand fans, two triangles each, one draw call) that
// src/lmc-a.js adds to the stadium model. The pictures are the LPC fans of the cast (assets/peds/lpc/tifosi.png, tools/lpc/tifosi.mjs), seen from the front: every fan faces the pitch, so
// the pitch sees faces whichever stand it looks at. All the animation is in the vertex shader (no per-frame JS work): the fans hop and, when a wave runs round the bowl every so often,
// throw up their arms with the scarf (pose 1); while the lapa is on the pitch (crowdState.hype, set by src/stadium.js) they all jump and cheer. Lit like the rest of the scene (Lambert).
import * as THREE from 'three';
import { TIFOSI } from '../assets/peds/lpc/tifosi.js';

export const crowdState = { hype: 0, seats: [] };   // seats: a few positions in the stands for the chant balloons (src/stadium.js)
const URL_PNG = new URL('../assets/peds/lpc/tifosi.png', import.meta.url).href;
const SCALE = 0.85, ROW = 1.0, SPACE = 1.05, FILL = 0.6;   // the fan is the crowd's person at this scale; rows 1 m up the slope, a fan every 1.05 m along them; the share of seats taken
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const lerp3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

// ST[i][k]: the seat surface rows (x, y, z) of the bowl at sample k; tiers: [first row, second row, from, to]: the slopes the fans stand on; I, O: the inner and outer rings per sample;
// skip(x, y, z): true where there must be nobody (the vehicle gate)
export function buildCrowd({ ST, I, O, tiers, skip }) {
  const N = I.length, R = mulberry(20260502), P = [], A = [];
  for (const [ia, ib, f0, f1] of tiers) for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N, fx = I[k][0] - O[k][0], fz = I[k][1] - O[k][1], fl = Math.hypot(fx, fz) || 1, yaw = Math.atan2(fx / fl, fz / fl);   // facing the pitch
    const slope = Math.hypot(ST[ib][k][0] - ST[ia][k][0], ST[ib][k][1] - ST[ia][k][1], ST[ib][k][2] - ST[ia][k][2]) * (f1 - f0), nr = Math.max(2, Math.floor(slope / ROW));
    for (let r = 0; r < nr; r++) {
      const f = f0 + (f1 - f0) * (r + 0.5) / nr, a = lerp3(ST[ia][k], ST[ib][k], f), b = lerp3(ST[ia][k1], ST[ib][k1], f), len = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.round(len / SPACE));
      for (let j = 0; j < n; j++) {
        if (R() > FILL) continue;
        const t = (j + 0.3 + R() * 0.4) / n, p = lerp3(a, b, t); p[0] += (R() - 0.5) * 0.3; p[2] += (R() - 0.5) * 0.3;
        if (skip && skip(p[0], p[1], p[2])) continue;
        P.push([p[0], p[1], p[2], yaw, 0.9 + R() * 0.2]); A.push([Math.floor(R() * TIFOSI.fans), R(), (k + t) / N, R()]);
      }
    }
  }
  const n = P.length, [cw, ch] = TIFOSI.cell, W = cw * TIFOSI.px * SCALE, H = ch * TIFOSI.px * SCALE, foot = TIFOSI.ground * TIFOSI.px * SCALE;
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), fan = new Float32Array(n * 4);
  geo.setAttribute('aFan', new THREE.InstancedBufferAttribute(fan, 4));
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  const img = new Image();   // transparent until the picture is in; then a texture of its own size replaces the 1 pixel one
  img.onload = () => { const t2 = new THREE.Texture(img); t2.colorSpace = THREE.SRGBColorSpace; t2.magFilter = THREE.NearestFilter; t2.minFilter = THREE.NearestFilter; t2.generateMipmaps = false; t2.needsUpdate = true; mat.map = t2; tex.dispose(); };
  img.src = URL_PNG;
  const U = { uTime: { value: 0 }, uHype: { value: 0 }, uGrid: { value: new THREE.Vector2(TIFOSI.cols, TIFOSI.rows) } };
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aFan; uniform float uTime; uniform float uHype; uniform vec2 uGrid;\nfloat gWave, gJump;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        float wv = fract(uTime / 16.0 - aFan.z);
        gWave = step(wv, 0.06);                                                    // the wave: a stretch of the bowl that stands up and cheers while it passes
        gJump = sin(uTime * (5.0 + aFan.w * 2.5) + aFan.y * 6.2831);              // each fan jumps in its own time
        float armsUp = max(gWave, uHype > 0.5 ? step(0.0, sin(uTime * (2.2 + aFan.w) + aFan.y * 6.2831)) : 0.0);
        float cellIdx = aFan.x * 2.0 + armsUp;
        vec2 cr = vec2(mod(cellIdx, uGrid.x), floor(cellIdx / uGrid.x));
        vMapUv = vec2((cr.x + uv.x) / uGrid.x, 1.0 - (cr.y + 1.0 - uv.y) / uGrid.y);`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n        transformed.y += gWave * 0.05 + uHype * max(gJump, 0.0) * 0.1;');
  };
  mat.customProgramCacheKey = () => 'stadium-crowd';
  const mesh = new THREE.InstancedMesh(geo, mat, n), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), v = new THREE.Vector3();
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const [x, y, z, yaw, sz] = P[i]; q.setFromAxisAngle(e, yaw); s.set(W * sz, H * sz, 1); v.set(x, y - foot * sz, z);
    mesh.setMatrixAt(i, M.compose(v, q, s)); fan.set(A[i], i * 4); const k = 0.82 + R() * 0.22; c.setRGB(k, k, k); mesh.setColorAt(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.name = 'stadium-crowd'; mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.onBeforeRender = () => { U.uTime.value = performance.now() / 1000; U.uHype.value = crowdState.hype; };
  crowdState.seats = []; for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 240))) crowdState.seats.push([P[i][0], P[i][1] + 1.2, P[i][2]]);
  mesh.userData.tris = n * 2;
  return mesh;
}
