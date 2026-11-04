// Notes, sound lines and "horns" hand signs floating out of a pub's door while its music is audible (src/pubs.js, Krust). One InstancedMesh of camera-facing
// quads (one draw call, 16 instances), a 4-glyph atlas painted in code. The glyphs are drawn white with a dark outline and tinted per instance.
//   createNotes(scene, { glyphs }) -> { update(dt, level 0..1, x, y, z, nx, nz), dispose() }   (x, y, z the doorway, nx, nz the outward normal; glyphs: the atlas cells to pick from, default GLYPHS)
import * as THREE from 'three';

const N = 16, TAU = Math.PI * 2;
const pick = a => a[(Math.random() * a.length) | 0];
const GLYPHS = [0, 0, 0, 1, 1, 2, 2, 3];   // cells of the atlas: 0 eighth note, 1 beamed notes, 2 horns, 3 sound lines (weights by repetition)
const TINT = [[1, 0.25, 0.2], [1, 1, 1], [1, 0.62, 0.15]];

function atlas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';
  const ink = (fn, ox) => { g.save(); g.translate(ox, 0); g.strokeStyle = '#120a0a'; g.lineWidth = 9; fn(true); g.stroke(); g.fillStyle = '#fff'; fn(false); g.fill(); g.restore(); };
  // 0: an eighth note
  ink(o => { g.beginPath(); g.ellipse(46, 92, 20, 15, -0.4, 0, TAU); }, 0);
  g.save(); g.strokeStyle = '#120a0a'; g.lineWidth = 17; g.beginPath(); g.moveTo(62, 88); g.lineTo(62, 20); g.quadraticCurveTo(76, 30, 92, 54); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 8; g.stroke(); g.restore();
  // 1: two beamed notes
  ink(o => { g.beginPath(); g.ellipse(160, 96, 17, 13, -0.4, 0, TAU); }, 0); ink(o => { g.beginPath(); g.ellipse(214, 86, 17, 13, -0.4, 0, TAU); }, 0);
  g.save(); g.strokeStyle = '#120a0a'; g.lineWidth = 17; g.beginPath(); g.moveTo(173, 92); g.lineTo(173, 28); g.lineTo(227, 18); g.lineTo(227, 82); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 8; g.stroke(); g.restore();
  // 2: the sign of the horns, a fist with the index and little fingers up and the thumb across
  g.save(); g.translate(256, 0);
  const hand = fill => { g.beginPath();
    g.moveTo(40, 120); g.lineTo(34, 78); g.quadraticCurveTo(30, 62, 44, 60); g.lineTo(44, 24); g.quadraticCurveTo(46, 12, 56, 14); g.quadraticCurveTo(66, 16, 64, 30); g.lineTo(64, 58);   // index
    g.lineTo(76, 58); g.lineTo(76, 70); g.lineTo(86, 70); g.lineTo(88, 26); g.quadraticCurveTo(90, 14, 100, 16); g.quadraticCurveTo(110, 18, 108, 32); g.lineTo(104, 76);                      // little finger
    g.quadraticCurveTo(104, 96, 96, 120); g.closePath(); };
  g.strokeStyle = '#120a0a'; g.lineWidth = 9; hand(); g.stroke(); g.fillStyle = '#fff'; hand(); g.fill();
  g.strokeStyle = '#120a0a'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 74); g.lineTo(80, 74); g.moveTo(52, 92); g.quadraticCurveTo(70, 104, 92, 92); g.stroke(); g.restore();
  // 3: sound lines
  g.save(); g.translate(384, 0);
  for (const [r, w] of [[24, 12], [44, 11], [64, 10]]) { g.strokeStyle = '#120a0a'; g.lineWidth = w + 8; g.beginPath(); g.arc(30, 64, r, -0.9, 0.9); g.stroke(); }
  for (const [r, w] of [[24, 12], [44, 11], [64, 10]]) { g.strokeStyle = '#fff'; g.lineWidth = w - 3; g.beginPath(); g.arc(30, 64, r, -0.9, 0.9); g.stroke(); }
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}

const VERT = `
  attribute vec3 iPos; attribute vec4 iA; attribute vec3 iCol;
  varying vec2 vUv; varying float vAlpha; varying vec3 vCol;
  void main() {
    vec3 c = (viewMatrix * vec4(iPos, 1.0)).xyz;
    float s = iA.z * (0.65 + 0.45 * iA.x), cs = cos(iA.w), sn = sin(iA.w);
    vec2 q = mat2(cs, -sn, sn, cs) * position.xy * s;
    gl_Position = projectionMatrix * vec4(c + vec3(q, 0.0), 1.0);
    vUv = vec2((uv.x + iA.y) * 0.25, uv.y); vCol = iCol;
    vAlpha = smoothstep(0.0, 0.07, iA.x) * (1.0 - smoothstep(0.55, 1.0, iA.x)) * step(iA.x, 1.0);
  }`;
const FRAG = `
  uniform sampler2D uMap; varying vec2 vUv; varying float vAlpha; varying vec3 vCol;
  void main() {
    vec4 t = texture2D(uMap, vUv); if (t.a < 0.04 || vAlpha < 0.01) discard;
    gl_FragColor = vec4(t.rgb * vCol, t.a * vAlpha);
    #include <colorspace_fragment>
  }`;

export function createNotes(scene, opts = {}) {
  const cells = opts.glyphs || GLYPHS;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2)); geo.setIndex([0, 1, 2, 0, 2, 3]);
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3), A = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), col = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  for (let i = 0; i < N; i++) A.array[i * 4] = 2;                                  // age past 1: not drawn
  geo.setAttribute('iPos', pos); geo.setAttribute('iA', A); geo.setAttribute('iCol', col); geo.instanceCount = N;
  const map = (opts.atlas || atlas)(), mat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: map } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 7; mesh.visible = false; scene.add(mesh);
  const P = Array.from({ length: N }, () => ({ on: false, age: 0, life: 3.4, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sw: 0, ph: 0, sz: 1, rot: 0, wob: 0 }));
  let emit = 0, alive = 0;
  function spawn(p, x, y, z, nx, nz) {
    const cell = pick(cells), side = (Math.random() - 0.5) * 3.2, sp = 1.1 + Math.random() * 1.0;
    p.on = true; p.age = 0; p.life = 3.0 + Math.random() * 1.4; p.cell = cell;
    p.x = x + nz * side * 0.6; p.z = z - nx * side * 0.6; p.y = y + (Math.random() - 0.3) * 0.5;
    p.vx = nx * sp + nz * side * 0.45; p.vz = nz * sp - nx * side * 0.45; p.vy = 0.55 + Math.random() * 0.55;
    p.sw = 0.25 + Math.random() * 0.3; p.ph = Math.random() * TAU; p.sz = cell === 2 ? 1.15 : cell === 3 ? 0.95 : 0.85; p.rot = (Math.random() - 0.5) * 0.7; p.wob = 0.6 + Math.random() * 0.8;
    p.tint = opts.tints ? pick(opts.tints) : cell === 2 ? TINT[1] : pick(TINT);
    p.nx = nx; p.nz = nz;
  }
  // level: how loud the song is at the lapa (0..1); (x, y, z) the doorway, n the outward normal
  function update(dt, level, x, y, z, nx, nz) {
    if (level > 0.04) { emit -= dt; if (emit <= 0) { emit = (1.15 - 0.5 * level) * (0.7 + Math.random() * 0.6); const p = P.find(q => !q.on); if (p) spawn(p, x, y, z, nx, nz); } }
    alive = 0;
    for (let i = 0; i < N; i++) {
      const p = P[i], a = A.array, k = i * 4;
      if (!p.on) { a[k] = 2; continue; }
      p.age += dt / p.life; if (p.age >= 1) { p.on = false; a[k] = 2; continue; }
      alive++;
      const t = p.age * p.life;
      p.x += p.vx * dt + p.nz * Math.cos(t * 2.2 + p.ph) * p.sw * dt; p.z += p.vz * dt - p.nx * Math.cos(t * 2.2 + p.ph) * p.sw * dt; p.y += p.vy * dt; p.vx *= 1 - 0.18 * dt; p.vz *= 1 - 0.18 * dt;
      pos.array[i * 3] = p.x; pos.array[i * 3 + 1] = p.y; pos.array[i * 3 + 2] = p.z;
      a[k] = p.age; a[k + 1] = p.cell; a[k + 2] = p.sz; a[k + 3] = p.rot + Math.sin(t * 3 + p.ph) * 0.18 * p.wob;
      col.array[i * 3] = p.tint[0]; col.array[i * 3 + 1] = p.tint[1]; col.array[i * 3 + 2] = p.tint[2];
    }
    mesh.visible = alive > 0;
    if (alive || emit > -1) { pos.needsUpdate = A.needsUpdate = col.needsUpdate = true; }
  }
  function dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); map.dispose(); }
  return { update, dispose, get alive() { return alive; } };
}
