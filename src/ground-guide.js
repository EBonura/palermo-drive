// Ground guide: design 4 in the game since 21 Nov 2026 (?gg=1..4 shows the others): discreet marks on the road ahead that show the way to the next objective, along the route the minimap draws
// (mapRoute: a mission's, pink; followRoute: a player we follow, blue). One instanced quad per mark, laid flat on the ground every SPACING metres from
// a little ahead of the lapa, faded in and out at both ends; what is drawn on each quad is a fragment shader, so the four designs are one mesh:
//   1 pulse rings: thin rings with a faint fill, a wave of growing and shrinking running forward along the way
//   2 breathing ovals: dots that stretch forward and relax in turn, so the stretch itself points the way
//   3 comet: small soft dots, a bright head travelling forward along them like runway lights
//   4 chevron rings: a ring with a small chevron inside pointing the way, fading in one after the other
 // Each mark is STRETCH times longer along the way than across it: seen from the chase camera, low behind the lapa, the road is foreshortened that much, so the marks read as round.
//   createGroundGuide({ scene, car, groundY, routes: [[route, colour], ...] }) -> { update(dt), setDesign(n) }
import * as THREE from 'three';

const N = 12, SPACING = 7, START = 9, STRETCH = 1.7, SIZE = 1.9;   // SIZE: metres across (the owner chose design 4, smaller, 21 Nov 2026)   // marks, metres between them, metres ahead of the car where the first one stands

const VERT = `
attribute float aK;      // the mark's phase in the wave, growing along the way
attribute float aFade;   // fade at the ends of the run and with distance
varying vec2 vUv; varying float vK; varying float vFade;
void main() {
  vUv = uv * 2.0 - 1.0; vK = aK; vFade = aFade;
  vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  mv.xyz *= 1.0 - 0.4 / max(length(mv.xyz), 1.0);   // 40 cm towards the camera: on top of the street's own layers and their depth offsets, on a slope too
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform float uT; uniform int uDesign; uniform vec3 uCol;
varying vec2 vUv; varying float vK; varying float vFade;
float ring(float r, float rad, float w) { return smoothstep(rad - w, rad - w * 0.4, r) * (1.0 - smoothstep(rad + w * 0.4, rad + w, r)); }
void main() {
  // vUv.y points the way (forward), vUv.x across it
  float a = 0.0, dk = 0.0;
  float wave = fract(uT * 0.55 - vK);                       // a wave running forward along the marks (vK grows along the way)
  float pulse = exp(-pow((wave - 0.5) * 4.0, 2.0));          // 0..1, peaks as the wave passes
  if (uDesign == 1) {
    float s = 0.62 + 0.3 * pulse;
    float r = length(vUv) / s;
    a = ring(r, 0.84, 0.13) * (0.75 + 0.25 * pulse) + (1.0 - smoothstep(0.72, 0.82, r)) * 0.16;
    dk = ring(r, 0.84, 0.24) * 0.35;
  } else if (uDesign == 2) {
    vec2 p = vUv / vec2(0.42, 0.42 + 0.5 * pulse);
    p.y -= 0.35 * pulse;                                       // the stretch leans forward
    float r = length(p);
    a = (1.0 - smoothstep(0.82, 1.0, r)) * (0.3 + 0.3 * pulse) + ring(r, 0.92, 0.12) * (0.7 + 0.3 * pulse);
    dk = ring(r, 0.92, 0.22) * 0.35;
  } else if (uDesign == 3) {
    float head = fract(uT * 0.7);                             // the head's place along the run
    float d = vK - head; d = d < -0.5 ? d + 1.0 : d;
    float glow = exp(-pow(d * 6.0, 2.0)) + (d < 0.0 ? exp(d * 9.0) * 0.6 : 0.0);   // bright at the head, a tail behind it
    float r = length(vUv) / (0.28 + 0.22 * glow);
    a = (1.0 - smoothstep(0.55, 1.0, r)) * (0.3 + 0.7 * glow);
    dk = (1.0 - smoothstep(0.8, 1.15, r)) * 0.3;
  } else {
    float s = 0.78; float r = length(vUv) / s;
    float on = smoothstep(0.0, 0.25, pulse);
    vec2 c = vUv / s;
    float f = abs(c.x) * 0.9 + c.y;                            // a V opening backwards: its tip points the way (uv.y forward)
    float chev = (1.0 - smoothstep(0.06, 0.12, abs(f - 0.25))) * step(abs(c.x), 0.48) * step(-0.45, c.y) * step(c.y, 0.5);
    a = ring(r, 0.86, 0.11) * (0.5 + 0.4 * on) + chev * (0.4 + 0.6 * on);
    dk = (ring(r, 0.86, 0.2) + chev * 0.8) * 0.3;
  }
  a = clamp(a, 0.0, 1.0) * vFade; dk *= vFade;
  float al = a + dk * (1.0 - a);                               // the colour over a soft dark halo, so it reads on pale stone as on asphalt
  if (al < 0.01) discard;
  gl_FragColor = vec4(uCol * (a / max(al, 1e-3)), al);
}`;

export function createGroundGuide({ scene, car, groundY, heightAt = groundY, routes, design = 4 }) {   // heightAt: the drivable surface (kerbs and pavements included)
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);   // flat; uv.y along +z after the rotation is "forward" once the instance faces the way
  const aK = new THREE.InstancedBufferAttribute(new Float32Array(N), 1), aFade = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  geo.setAttribute('aK', aK); geo.setAttribute('aFade', aFade);
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uDesign: { value: design }, uCol: { value: new THREE.Color('#ffffff') } },
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const mesh = new THREE.InstancedMesh(geo, mat, N); mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 3; mesh.name = 'groundGuide';
  scene.add(mesh);
  const FWD = new THREE.Vector3(0, 0, -1), dir = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let t = 0;
  // The marks stand still on the road: at every SPACING metres of the route counted from its start (not from the car), so driving on only
  // brings new ones in ahead and lets the passed ones fade; the wave of light runs over them in the direction to go.
  const P = { x: 0, z: 0, dx: 0, dz: 1, ok: false };
  function carS(route) {   // how far along the route the car is (route.i0, .px/.pz: its place on it, src/route-guide.js)
    let s = 0; const i0 = Math.min(route.i0 || 0, route.length - 1);
    for (let i = 1; i < i0; i++) s += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
    if (i0 > 0) s += Math.hypot(route.px - route[i0 - 1][0], route.pz - route[i0 - 1][1]);
    return s;
  }
  function at(route, s) {   // the point s metres from the route's start, and the direction there
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (L > 1e-6 && s <= L) { P.x = a[0] + dx * s / L; P.z = a[1] + dz * s / L; P.dx = dx / L; P.dz = dz / L; P.ok = true; return P; }
      s -= L;
    }
    P.ok = false; return P;
  }
  const sm = (a, b, x) => { const t2 = Math.min(1, Math.max(0, (x - a) / (b - a))); return t2 * t2 * (3 - 2 * t2); };
  function update(dt) {
    t += dt; mat.uniforms.uT.value = t;
    const pick = routes.find(([r]) => r.length > 1);
    if (!pick) { mesh.count = 0; return; }
    const [route, col] = pick; mat.uniforms.uCol.value.set(col);
    const s0 = carS(route), first = Math.ceil((s0 + START * 0.5) / SPACING), reach = START + N * SPACING;
    let n = 0;
    for (let k = first; k < first + N + 1 && n < N; k++) {
      const s = k * SPACING, ahead = s - s0, p = at(route, s); if (!p.ok) break;
      const fade = sm(START * 0.5, START + SPACING, ahead) * (1 - sm(reach - SPACING * 3, reach, ahead));   // in ahead of the lapa, out at the far end
      if (fade <= 0.01) continue;
      const y = heightAt(p.x, p.z) + 0.05, size = SIZE;
      const slope = (heightAt(p.x + p.dx * 1.5, p.z + p.dz * 1.5) - heightAt(p.x - p.dx * 1.5, p.z - p.dz * 1.5)) / 3;   // tilted with the street, along the way
      q.setFromUnitVectors(FWD, dir.set(p.dx, slope, p.dz).normalize());   // the quad's forward (uv.y, which the flat plane has along -z) along the way
      pos.set(p.x, y, p.z); scl.set(size, 1, size * STRETCH); m4.compose(pos, q, scl); mesh.setMatrixAt(n, m4);
      aK.array[n] = (k % 1000) * 0.13;   // the mark's own phase in the wave: it belongs to the mark, so the wave does not jump as the car moves
      aFade.array[n] = fade;
      n++;
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; aK.needsUpdate = true; aFade.needsUpdate = true;
  }
  return { update, mesh, setDesign: d => { mat.uniforms.uDesign.value = d; } };
}
