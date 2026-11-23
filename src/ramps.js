// Ramps: wedges standing in the streets that the lapa can drive up and leave the ground from (the air physics of the sphere model, src/vehicle-sphere.js).
// Two kinds, both one rigid piece with a height profile along its length: a plain "rampa" (a steel kicker) and a parked car transporter trailer, whose loading
// ramp leads up on to the bed and on to the rise over the cab. The surface is absolute (a base height plus the profile), so a ramp on a sloping street stays one solid
// piece; the base is the lowest ground under its footprint and is looked up again every half second while the tiles around it improve.
//
// The physics asks surfaceAt(x, z) (the height of the top, or NaN when there is no ramp there) and the sphere model takes the higher of the ground and that.
// The meshes are two merged geometries (one per kind, built once, all ramps of a kind in one draw call each) that are only visible within SEE metres.
// Each piece stands on the right of its street as road works do: barrier boards on both flanks from 6 m before the foot to 3 m after the lip, cones, a "lavori in corso" sign
// on its pole, and the boards on the traffic side are walls for the lapa. The traffic steers round the whole zone (it sees it as one long parked obstacle, zonesNear below) and no
// car is parked inside it (src/props.js reads the same list, src/ramp-spots.js).
// ?ramp=x,z,th[,kind][;x,z,th...] puts ramps there instead (screenshots, tests); kind is 'ramp' or 'truck'.
import * as THREE from 'three';
import { KINDS, placed, ZONE_BEFORE, ZONE_AFTER } from './ramp-spots.js';   // where they stand and the shapes (shared with the props and the traffic)

const SEE = 450, EDGE = 0.3;
const STICKER_TEXT = ['PROPERTY OF', 'EDDY'];   // the easter egg on the cones of the work zones   // metres: drawn within SEE, the sides fall away over EDGE

export function createRamps(env) {
  const { scene, camera, groundY, walls2d, raisedMask, CURB } = env;   // raisedMask, CURB: a kerb or pavement is a little above the terrain (the cones stand on it)
  const zones = placed(), list = zones.map(p => ({ x: p.x, z: p.z, th: p.th, kind: p.kind }));
  const q = new URLSearchParams(location.search).get('ramp');   // ?ramp=x,z,th[,kind];...
  if (q) { list.length = 0; for (const t of q.split(';')) { const [x, z, th, kind] = t.split(','); list.push({ x: +x, z: +z, th: +th || 0, kind: kind || 'ramp' }); } }
  for (const r of list) {
    const K = KINDS[r.kind]; r.K = K; r.L = K.profile[K.profile.length - 1][0]; r.hw = K.w / 2;
    r.sn = Math.sin(r.th); r.cs = Math.cos(r.th); r.base = NaN; r.reach = Math.hypot(r.L, r.hw) + 1;
  }
  // the lowest ground under the footprint, so the foot of the ramp is never in the air
  function lowest(r) {
    let y = 1e9;
    for (const s of [0, r.L * 0.5, r.L]) for (const t of [-r.hw, 0, r.hw]) y = Math.min(y, groundY(r.x + r.sn * s + r.cs * t, r.z + r.cs * s - r.sn * t));
    return y - 0.02;
  }
  const heightAt = (K, s) => {
    const p = K.profile; if (s < p[0][0] || s > p[p.length - 1][0]) return NaN;
    for (let i = 1; i < p.length; i++) if (s <= p[i][0]) return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (s - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
    return p[p.length - 1][1];
  };
  // absolute height of the top at (x, z), or NaN: for the physics. A handful of ramps, so a plain loop after a cheap distance test.
  function surfaceAt(x, z) {
    for (let i = 0; i < list.length; i++) {
      const r = list[i], dx = x - r.x, dz = z - r.z;
      if (dx > r.reach || dx < -r.reach || dz > r.reach || dz < -r.reach || r.base !== r.base) continue;
      const s = dx * r.sn + dz * r.cs, t = Math.abs(dx * r.cs - dz * r.sn);
      if (t > r.hw) continue;
      const h = heightAt(r.K, s); if (h !== h) continue;
      return r.base + h * Math.min(1, (r.hw - t) / EDGE);
    }
    return NaN;
  }

  // ---------- the meshes ----------
  // The surface of every solid piece: the flat vertex colours get a light weathering in the shader, with no texture coordinates needed (the geometry has none): a fine grain and big soft
  // blotches (triplanar, from one small noise texture), dirt thrown up from the ground, and faint vertical streaks where rain ran down. Subtle: it breaks up the plain colours, it does not paint.
  const noiseTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), d = x.createImageData(64, 64);
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 64 * 64; i++) { const v = 90 + rnd() * 165; d.data.set([v, v, v, 255], i * 4); } x.putImageData(d, 0, 0);
    const b = document.createElement('canvas'); b.width = b.height = 128; const y = b.getContext('2d'); y.imageSmoothingEnabled = true; y.drawImage(c, 0, 0, 128, 128);   // up-scaled with smoothing: soft value noise
    const t = new THREE.CanvasTexture(b); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; })();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.08, side: THREE.DoubleSide });   // thin plates and mesh bars are seen from both sides
  mat.onBeforeCompile = sh => {
    sh.uniforms.tNoise = { value: noiseTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = position; vWN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D tNoise; varying vec3 vWP; varying vec3 vWN;
      float triN(vec3 p, vec3 n, float k) { vec3 w = abs(n); w /= (w.x + w.y + w.z + 1e-4); return texture2D(tNoise, p.zy * k).r * w.x + texture2D(tNoise, p.xz * k).r * w.y + texture2D(tNoise, p.xy * k).r * w.z; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float g = triN(vWP, vWN, 1.7), b = triN(vWP + 7.3, vWN, 0.23), st = texture2D(tNoise, vec2((vWP.x + vWP.z) * 1.6, vWP.y * 0.3)).r;
        float dirt = smoothstep(0.75, 0.0, vWP.y);
        diffuseColor.rgb *= 0.84 + 0.32 * g;
        diffuseColor.rgb *= 0.86 + 0.24 * b;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.6, 0.55, 0.48), dirt * (0.3 + 0.55 * b));
        diffuseColor.rgb *= 1.0 - 0.2 * smoothstep(0.58, 0.95, st) * smoothstep(0.0, 1.6, vWP.y); }`);
  };
  mat.customProgramCacheKey = () => 'ramps-weathered';
  const C = {
    yellow: [0.96, 0.74, 0.05], black: [0.1, 0.1, 0.11], plate: [0.44, 0.46, 0.5], plateD: [0.3, 0.32, 0.36], rust: [0.4, 0.27, 0.12], dark: [0.13, 0.13, 0.14], tyre: [0.06, 0.06, 0.07],
    white: [0.92, 0.92, 0.9], red: [0.75, 0.1, 0.08], orange: [0.97, 0.4, 0.04], amber: [1, 0.62, 0.02], blue: [0.12, 0.3, 0.62], deck: [0.36, 0.38, 0.42], mesh: [0.62, 0.64, 0.66], sand: [0.6, 0.52, 0.36], grey: [0.6, 0.6, 0.6],
  };
  function geo(kind) {
    const K = KINDS[kind], P = [], Cc = [], SG = [], SGU = [], NT = [], NTU = [], hw = K.w / 2, p = K.profile, L = p[p.length - 1][0], truck = kind === 'truck', hL = p[p.length - 1][1];
    const tri = (a, b, c, col) => { P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) Cc.push(...col); };
    const quad = (a, b, c, d, col) => { tri(a, b, c, col); tri(a, c, d, col); };
    const tri2 = (a, b, c, col) => { tri(a, b, c, col); tri(a, c, b, col); };   // seen from both sides (signs)
    const box = (x0, x1, y0, y1, z0, z1, col) => {   // local x lateral, y up, z forward; closed
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col); quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col);
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col); quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col);
      quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col);
    };
    const cyl = (cx, cy, cz, r, w, col, n = 10) => {   // a wheel with its axle along x
      for (let i = 0; i < n; i++) {
        const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, y0 = cy + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, y1 = cy + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
        quad([cx - w, y0, z0], [cx - w, y1, z1], [cx + w, y1, z1], [cx + w, y0, z0], col);
        tri([cx + w, cy, cz], [cx + w, y0, z0], [cx + w, y1, z1], col); tri([cx - w, cy, cz], [cx - w, y1, z1], [cx - w, y0, z0], col);
      }
    };
    const hAt = s => { for (let i = 1; i < p.length; i++) if (s <= p[i][0]) return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (s - p[i - 1][0]) / (p[i][0] - p[i - 1][0]); return hL; };
    // a side panel under the deck between z0 and z1, from y0 up to the deck line, on the side sg (+1 left x=+hw, -1 right), pushed out by o
    const side = (sg, z0, z1, y0, col, o = 0) => { const x = sg * (hw + o), a = hAt(z0), b = hAt(z1); if (a <= y0 && b <= y0) return; sg > 0 ? quad([x, y0, z1], [x, y0, z0], [x, Math.max(y0, a), z0], [x, Math.max(y0, b), z1], col) : quad([x, y0, z0], [x, y0, z1], [x, Math.max(y0, b), z1], [x, Math.max(y0, a), z0], col); };

    // ----- the deck: strips along the profile, a thin slab edge, the kerb lips -----
    for (let i = 1; i < p.length; i++) {
      const [s0, h0] = p[i - 1], [s1, h1] = p[i], n = Math.max(1, Math.round((s1 - s0) / 0.5));
      const first = i === 1;
      for (let k = 0; k < n; k++) {
        const a = s0 + (s1 - s0) * k / n, b = s0 + (s1 - s0) * (k + 1) / n, ya = h0 + (h1 - h0) * k / n, yb = h0 + (h1 - h0) * (k + 1) / n;
        const col = !truck ? (k % 2 ? C.black : C.yellow) : first ? (k % 2 ? C.black : C.yellow) : (k % 4 < 2 ? C.deck : [0.33, 0.35, 0.39]);   // the loading ramp of the trailer wears the same warning stripes, its bed is plank-grey
        quad([-hw, ya, a], [-hw, yb, b], [hw, yb, b], [hw, ya, a], col);   // facing up
      }
      const lip = 0.12;   // the kerb lip along each side, in white-grey (trailer) or yellow (ramp)
      const lc = truck ? C.white : C.yellow;
      quad([-hw, h0, s0], [-hw, h1, s1], [-hw, h1 + lip, s1], [-hw, h0 + lip, s0], lc); quad([hw, h1, s1], [hw, h0, s0], [hw, h0 + lip, s0], [hw, h1 + lip, s1], lc);
    }
    if (!truck) {
      // the steel kicker: solid side plates the whole height with ribs standing out, a skid rail under, a yellow top edge, the back closed and braced, a bent lip
      for (const sg of [-1, 1]) {
        for (let r = 1.2; r < L; r += 2.2) { const h = hAt(r) - 0.12; box(sg > 0 ? hw : hw * -1 - 0.1, sg > 0 ? hw + 0.1 : -hw, 0.12, h, r - 0.07, r + 0.07, [0.55, 0.57, 0.61]); }   // ribs
        box(sg > 0 ? hw : -hw - 0.12, sg > 0 ? hw + 0.12 : -hw, 0, 0.14, 0, L, C.dark);   // the skid rail
        side(sg, 0, L, 0, C.plate, 0);
      }
      quad([-hw, 0, L], [hw, 0, L], [hw, hL, L], [-hw, hL, L], C.plateD);   // the back, facing the way the lapa leaves
      box(-hw, hw, hL - 0.14, hL, L - 0.35, L + 0.02, C.dark);   // the lip plate
      for (let k = 0; k < Math.round(K.w / 0.4); k++) { const a = -hw + k * 0.4; quad([a, hL - 0.5, L + 0.012], [a + 0.4, hL - 0.5, L + 0.012], [a + 0.4, hL - 0.2, L + 0.012], [a, hL - 0.2, L + 0.012], k % 2 ? C.black : C.yellow); }   // a hazard band across the back face
      for (const x of [-hw + 0.35, hw - 0.35]) { box(x - 0.15, x + 0.15, 0.3, hL - 0.3, L, L + 0.05, C.plate); }   // braces on the back face
      for (const sg of [-1, 1]) for (let k = 0; k < 4; k++) quad([sg * (hw + 0.13), hL + 0.001, L - 0.7 + k * 0.2], [sg * (hw + 0.13), hL + 0.001, L - 0.7 + k * 0.2 + 0.1], [sg * (hw + 0.13), hL - 0.14, L - 0.7 + k * 0.2 + 0.1], [sg * (hw + 0.13), hL - 0.14, L - 0.7 + k * 0.2], k % 2 ? C.red : C.white);   // reflective lip marks (thin, on the outside)
    } else {
      // the car transporter trailer: the loading ramp (steel sides), then the bed with a white body skirt over a dark chassis, rails, three axles, a landing leg, a blue band
      for (const sg of [-1, 1]) {
        side(sg, 0, 6, 0, C.plate);                          // the loading ramp's sides
        side(sg, 6, L, 0.62, C.white);                       // the skirt, 0.62 m off the ground
        const x0 = sg > 0 ? hw : -hw - 0.02, x1 = sg > 0 ? hw + 0.02 : -hw;
        box(x0, x1, 0.95, 1.2, 6, L, C.blue);                // the band along the skirt
        for (let z = 8.8; z < L - 0.2; z += 2.2) { box(sg > 0 ? hw : -hw - 0.012, sg > 0 ? hw + 0.012 : -hw, 0.66, hAt(z), z - 0.03, z + 0.03, [0.78, 0.8, 0.82]); }   // the seams of the skirt panels
        for (let z = 6.6; z < L - 0.2; z += 2.2) { const h = hAt(z); box(sg > 0 ? hw : -hw - 0.06, sg > 0 ? hw + 0.06 : -hw, h, h + 0.95, z - 0.04, z + 0.04, C.plateD); }   // posts of the side rail
        for (const dy of [0.45, 0.9]) { for (let z = 6.6; z < L - 2.4; z += 2.2) { const h0 = hAt(z), h1 = hAt(z + 2.2); tri2([sg * (hw + 0.06), h0 + dy, z], [sg * (hw + 0.06), h1 + dy, z + 2.2], [sg * (hw + 0.06), h1 + dy + 0.07, z + 2.2], C.plateD), tri2([sg * (hw + 0.06), h0 + dy, z], [sg * (hw + 0.06), h1 + dy + 0.07, z + 2.2], [sg * (hw + 0.06), h0 + dy + 0.07, z], C.plateD); } }
      }
      box(-hw + 0.35, hw - 0.35, 0.62, 1.0, 6, L - 0.4, C.dark);   // the chassis under the bed
      for (const z of [9.6, 11.0, 12.4]) for (const sg of [-1, 1]) { cyl(sg * (hw + 0.04), 0.5, z, 0.5, 0.15, [0.09, 0.09, 0.1], 14); cyl(sg * (hw + 0.2), 0.5, z, 0.24, 0.02, C.grey, 10); }   // wheels standing out of the skirt, with a hub
      for (const sg of [-1, 1]) box(sg > 0 ? hw - 0.1 : -hw - 0.4, sg > 0 ? hw + 0.4 : -hw + 0.1, 1.04, 1.1, 8.9, 13.1, C.dark);   // mudguards over the wheels
      for (const sg of [-1, 1]) box(sg * (hw - 0.5) - 0.05, sg * (hw - 0.5) + 0.05, 0, 0.9, 6.6, 6.7, C.dark);   // the landing legs
      for (const sg of [-1, 1]) box(sg * (hw - 0.3) - 0.14, sg * (hw - 0.3) + 0.14, 0.7, 0.8, 5.9, 6.03, C.red);   // rear reflectors on the hinge
      quad([-hw, 0.62, L], [hw, 0.62, L], [hw, hL, L], [-hw, hL, L], C.white); box(-hw, hw, hL - 0.1, hL + 0.001, L - 0.3, L + 0.02, C.dark);   // the front end of the trailer: white like its skirt, with a blue band, a red and white reflective strip and two marker lights
      quad([-hw, 1.05, L + 0.004], [hw, 1.05, L + 0.004], [hw, 1.3, L + 0.004], [-hw, 1.3, L + 0.004], C.blue);
      for (let k = 0; k < Math.round(K.w / 0.25); k++) { const a = -hw + k * 0.25; quad([a, 0.66, L + 0.004], [a + 0.25, 0.66, L + 0.004], [a + 0.25, 0.8, L + 0.004], [a, 0.8, L + 0.004], k % 2 ? C.white : C.red); }
      for (const sg of [-1, 1]) box(sg * (hw - 0.25) - 0.1, sg * (hw - 0.25) + 0.1, 1.45, 1.6, L, L + 0.05, C.amber);
      box(-hw + 0.3, hw - 0.3, hL - 0.02, hL + 0.001, L - 0.3, L, C.yellow);
    }

    // ----- the road works, as they are in Palermo (the owner's photos, 23 Nov 2026): red and white diagonal barrier boards on folding frames on the traffic side, an orange plastic net on stakes on the kerb side
    // with the white plates "LAVORI IN CORSO" and "VIETATO L'INGRESSO", the triangle sign (yellow, a black man with a shovel) on a stand with an orange sandbag, the blue arrow disc, cones with collars -----
    const bx0 = -ZONE_BEFORE, bx1 = L + ZONE_AFTER, xT = hw + 0.55, xK = -(hw + 0.45), NET_H = 1.3, stand = [0.55, 0.57, 0.6], orangeBag = [0.93, 0.42, 0.08];
    const rect = (x, y, w, h) => [x / 1024, 1 - (y + h) / 512, (x + w) / 1024, 1 - y / 512];   // a cell of the sign atlas as uv (u0, vBottom, u1, vTop)
    const R_TRI = rect(0, 0, 256, 256), R_BLUE = rect(0, 256, 256, 256), R_LAV = rect(256, 0, 256, 512), R_VIE = rect(512, 0, 256, 512);
    const signZ = (r, cx, cy, cz, w, h) => {   // a plate facing back along the ramp (towards the traffic coming up the street): seen from there the +x side is on the left
      SG.push(cx + w / 2, cy - h / 2, cz, cx - w / 2, cy - h / 2, cz, cx - w / 2, cy + h / 2, cz, cx + w / 2, cy - h / 2, cz, cx - w / 2, cy + h / 2, cz, cx + w / 2, cy + h / 2, cz);
      SGU.push(r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[1], r[2], r[3], r[0], r[3]);
    };
    const signX = (r, cx, cy, cz, w, h) => {   // a plate on the net facing the street (+x): seen from there the +z side is on the left
      SG.push(cx, cy - h / 2, cz + w / 2, cx, cy - h / 2, cz - w / 2, cx, cy + h / 2, cz - w / 2, cx, cy - h / 2, cz + w / 2, cx, cy + h / 2, cz - w / 2, cx, cy + h / 2, cz + w / 2);
      SGU.push(r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[1], r[2], r[3], r[0], r[3]);
    };
    // the barrier boards: diagonal stripes (the bottom edge of a stripe is 0.45 m behind its top edge), clipped to the zone, on folding frames with two legs
    const cl = v => Math.min(bx1, Math.max(bx0, v));
    for (let a = bx0 - 0.5; a < bx1; a += 0.5) {
      const col = Math.round((a - bx0) / 0.5) % 2 ? C.white : C.red, b0 = cl(a), b1 = cl(a + 0.5), t0 = cl(a + 0.45), t1 = cl(a + 0.95);
      if (b1 - b0 < 1e-4 && t1 - t0 < 1e-4) continue;
      quad([xT + 0.045, 0.5, b0], [xT + 0.045, 0.5, b1], [xT + 0.045, 1.0, t1], [xT + 0.045, 1.0, t0], col);
    }
    box(xT - 0.02, xT + 0.04, 0.5, 1.0, bx0, bx1, [0.8, 0.8, 0.8]); box(xT - 0.02, xT + 0.05, 0.48, 0.5, bx0, bx1, C.dark); box(xT - 0.02, xT + 0.05, 1.0, 1.02, bx0, bx1, C.dark);   // the board behind the stripes and its rims
    for (let a = bx0 + 0.35; a < bx1 - 0.2; a += 2) { for (const sg of [-0.28, 0.28]) { box(xT - 0.02 + sg * 0.0, xT + 0.02, 0, 0.55, a + sg, a + sg + 0.035, stand); } box(xT - 0.26, xT + 0.26, 0, 0.03, a - 0.3, a + 0.3, stand); }   // the folding frame: two legs and a spreader foot
    for (const z of [bx0 + 0.15, bx1 - 0.25]) { box(xT - 0.09, xT + 0.09, 1.0, 1.1, z, z + 0.12, C.dark); box(xT - 0.07, xT + 0.07, 1.1, 1.22, z + 0.01, z + 0.11, C.amber); }   // the lamps
    // the orange net on the kerb side: a textured sheet, stakes every 2 m with an orange cap
    NT.push(xK, 0.08, bx0, xK, 0.08, bx1, xK, NET_H, bx1, xK, 0.08, bx0, xK, NET_H, bx1, xK, NET_H, bx0); { const u1 = (bx1 - bx0) / 0.3, v1 = (NET_H - 0.08) / 0.3; NTU.push(0, 0, u1, 0, u1, v1, 0, 0, u1, v1, 0, v1); }
    for (let a = bx0; a <= bx1 + 0.01; a += 2) { const z = Math.min(a, bx1 - 0.03); box(xK - 0.025, xK + 0.025, 0, NET_H + 0.12, z, z + 0.05, [0.2, 0.4, 0.2]); box(xK - 0.04, xK + 0.04, NET_H + 0.12, NET_H + 0.2, z - 0.01, z + 0.06, C.orange); }
    signX(R_LAV, xK + 0.035, 0.85, bx0 + 3.4, 0.55, 0.85); signX(R_VIE, xK + 0.035, 0.85, bx0 + 4.5, 0.55, 0.85);
    const cone = null;   // (the cones are their own instances, see coneGeos)
    const sandbag = (x, s, col = C.sand) => box(x - 0.2, x + 0.2, 0, 0.13, s - 0.12, s + 0.12, col);
    { const x = hw + 1.3, s = bx0 - 0.5;   // the triangle sign on a folding stand (two legs apart at the bottom), an orange sandbag on its foot
      for (const dx of [-1, 1]) {   // splayed legs, flat steel: wide at the ground, close together under the sign
        quad([x + dx * 0.52, 0, s - 0.025], [x + dx * 0.52, 0, s + 0.025], [x + dx * 0.3, 0.78, s + 0.025], [x + dx * 0.3, 0.78, s - 0.025], stand);
        quad([x + dx * 0.52 - 0.025, 0, s], [x + dx * 0.52 + 0.025, 0, s], [x + dx * 0.3 + 0.025, 0.78, s], [x + dx * 0.3 - 0.025, 0.78, s], stand);
        sandbag(x + dx * 0.4, s - 0.02, orangeBag); }
      box(x - 0.31, x + 0.31, 0.7, 0.76, s - 0.025, s + 0.03, stand); box(x - 0.5, x + 0.5, 0.02, 0.05, s - 0.02, s + 0.02, stand);
      signZ(R_TRI, x, 1.2, s - 0.04, 1.05, 1.05);
      const bx = hw + 3.3, bs = bx0 - 2.6;   // the blue disc with the white arrow, on its own stand
      box(bx - 0.025, bx + 0.025, 0, 0.8, bs - 0.025, bs + 0.025, stand); box(bx - 0.35, bx + 0.35, 0, 0.04, bs - 0.03, bs + 0.03, stand); box(bx - 0.03, bx + 0.03, 0, 0.04, bs - 0.3, bs + 0.3, stand); sandbag(bx - 0.3, bs - 0.15, orangeBag);   // one pole on a cross foot with a sandbag
      signZ(R_BLUE, bx, 1.0, bs - 0.04, 0.8, 0.8);
    }
    sandbag(xT + 0.2, bx1 + 0.3, orangeBag); sandbag(xT + 0.2, bx1 + 0.45, orangeBag);
    const g = new THREE.BufferGeometry();
    const uvg = (pos, uv) => { const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); q.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); q.computeVertexNormals(); return q; };
    g.userData.signs = uvg(SG, SGU); g.userData.net = uvg(NT, NTU);
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    g.computeVertexNormals();
    return g;
  }
  // the sticker: white label, black letters, a red rule (a canvas texture, one for all the cones)
  const stickerTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
    x.fillStyle = '#f6f2e8'; x.fillRect(0, 0, 256, 160);                                   // white label
    x.fillStyle = '#c0231c'; x.fillRect(0, 0, 256, 62);                                      // a red band across the top with the small words in white
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '800 33px sans-serif'; x.fillText(STICKER_TEXT[0], 128, 44);
    x.fillStyle = '#16161a'; x.font = '900 92px sans-serif'; x.fillText(STICKER_TEXT[1], 128, 142);   // the name big and black under it
    x.strokeStyle = '#16161a'; x.lineWidth = 8; x.strokeRect(4, 4, 248, 152);                // a black edge round all of it
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
  const stickerMat = new THREE.MeshStandardMaterial({ map: stickerTex, roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // the sign atlas (1024x512): the triangle "lavori" sign and the blue arrow disc on the left (transparent outside their shapes), the two white plates beside them
  const signTex = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
    const triPath = (cx, top, bot, half) => { x.beginPath(); x.moveTo(cx, top); x.lineTo(cx + half, bot); x.lineTo(cx - half, bot); x.closePath(); };
    const worker = (ox, oy, k) => {   // a black man bent over a shovel, and the heap
      x.save(); x.translate(ox, oy); x.scale(k, k); x.fillStyle = x.strokeStyle = '#111'; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.arc(-16, -40, 15, 0, 6.2832); x.fill();
      x.lineWidth = 22; x.beginPath(); x.moveTo(-18, -20); x.lineTo(-4, 16); x.stroke();                                                         // the bent back
      x.lineWidth = 18; x.beginPath(); x.moveTo(-4, 16); x.lineTo(-24, 46); x.moveTo(-4, 16); x.lineTo(18, 44); x.stroke();                        // the legs
      x.lineWidth = 15; x.beginPath(); x.moveTo(-12, -8); x.lineTo(16, 8); x.stroke();                                                           // the arm
      x.lineWidth = 8; x.beginPath(); x.moveTo(16, 8); x.lineTo(46, 44); x.stroke();                                                              // the shovel
      x.beginPath(); x.moveTo(30, 46); x.lineTo(70, 46); x.lineTo(54, 26); x.closePath(); x.fill(); x.restore(); };
    triPath(128, 10, 238, 118); x.fillStyle = '#d1261b'; x.fill(); triPath(128, 62, 214, 80); x.fillStyle = '#f5c518'; x.fill(); worker(120, 150, 0.95);   // the triangle sign
    x.fillStyle = '#1f5fb5'; x.beginPath(); x.arc(128, 384, 120, 0, 6.2832); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.arc(128, 384, 112, 0, 6.2832); x.stroke();
    x.fillStyle = '#fff'; x.save(); x.translate(128, 384); x.rotate(-0.6); x.beginPath(); x.moveTo(-80, 0); x.lineTo(-20, -44); x.lineTo(-20, -18); x.lineTo(78, -18); x.lineTo(78, 18); x.lineTo(-20, 18); x.lineTo(-20, 44); x.closePath(); x.fill(); x.restore();   // the arrow
    const plate = ox => { x.fillStyle = '#f7f6f2'; x.fillRect(ox + 4, 4, 248, 504); x.strokeStyle = '#999'; x.lineWidth = 3; x.strokeRect(ox + 4, 4, 248, 504); };
    plate(256); triPath(256 + 128, 24, 190, 86); x.fillStyle = '#d1261b'; x.fill(); triPath(256 + 128, 62, 172, 54); x.fillStyle = '#f5c518'; x.fill(); worker(256 + 124, 124, 0.6);
    x.fillStyle = '#111'; x.textAlign = 'center'; x.font = '900 52px sans-serif'; x.fillText('LAVORI', 256 + 128, 300); x.fillText('IN', 256 + 128, 372); x.fillText('CORSO', 256 + 128, 444);
    plate(512); x.strokeStyle = '#d1261b'; x.lineWidth = 16; x.beginPath(); x.arc(512 + 128, 130, 72, 0, 6.2832); x.stroke(); x.beginPath(); x.moveTo(512 + 78, 80); x.lineTo(512 + 178, 180); x.stroke();
    { const hx = 512 + 128, hy = 130; x.fillStyle = '#111';   // a raised hand
      x.beginPath(); x.roundRect(hx - 22, hy - 4, 44, 46, 10); x.fill();
      for (const [fx, fh] of [[-22, 44], [-8, 54], [6, 54], [20, 44]]) { x.beginPath(); x.roundRect(hx + fx - 6, hy - fh + 6, 12, fh, 6); x.fill(); }
      x.beginPath(); x.roundRect(hx - 38, hy + 6, 30, 12, 6); x.fill(); }
    x.fillStyle = '#111'; x.font = '800 32px sans-serif';
    ['VIETATO', 'L’INGRESSO', 'AI NON', 'ADDETTI', 'AI LAVORI'].forEach((t, i) => x.fillText(t, 512 + 128, 262 + i * 52));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
  const netTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');   // the orange plastic net: a diamond lattice of strands, open between
    x.strokeStyle = '#f26a14'; x.lineWidth = 5; x.lineCap = 'butt';
    for (let k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(k * 32, 0); x.lineTo(k * 32 + 64, 64); x.stroke(); x.beginPath(); x.moveTo(k * 32, 64); x.lineTo(k * 32 + 64, 0); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; })();
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, alphaTest: 0.4, roughness: 0.55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const netMat = new THREE.MeshStandardMaterial({ map: netTex, alphaTest: 0.35, roughness: 0.8, side: THREE.DoubleSide });
  const meshes = {}, geos = {};
  for (const kind of Object.keys(KINDS)) {
    const mine = list.filter(r => r.kind === kind); if (!mine.length) continue;
    geos[kind] = geo(kind);
    const m = new THREE.InstancedMesh(geos[kind], mat, mine.length);
    m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.visible = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const ex = [new THREE.InstancedMesh(geos[kind].userData.signs, signMat, mine.length), new THREE.InstancedMesh(geos[kind].userData.net, netMat, mine.length)];
    for (const e of ex) { e.frustumCulled = false; e.visible = false; e.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    ex[1].castShadow = true; scene.add(m, ...ex); meshes[kind] = { m, mine, ex };
  }
  // ----- the cones: one cone (with its square foot and the sticker) instanced for all of them, each standing on the ground under it, not on the ramp's base (a kerb or a camber would bury it) -----
  const coneGeos = (() => {
    const P = [], Cc = [], SP = [], SU = [];
    const tri = (a, b, c, col) => { P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) Cc.push(...col); };
    const quad = (a, b, c, d, col) => { tri(a, b, c, col); tri(a, c, d, col); };
    const box = (x0, x1, y0, y1, z0, z1, col) => {
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col); quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col);
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col); quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col);
      quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col);
    };
    const x = 0, s = 0, n = 8, r0 = 0.15, r1 = 0.035, h = 0.7, y0 = 0.085, rr = y => r0 + (r1 - r0) * (y / h), band = [0.34, 0.5];
    box(x - 0.23, x + 0.23, 0, 0.02, s - 0.23, s + 0.23, [0.2, 0.2, 0.21]); box(x - 0.23, x + 0.23, 0.02, 0.055, s - 0.23, s + 0.23, C.dark); box(x - 0.2, x + 0.2, 0.055, y0, s - 0.2, s + 0.2, C.dark);   // the square rubber foot, in three steps
    const ring = (ya, yb, col) => { for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, ra = rr(ya), rb = rr(yb);
      quad([x + Math.cos(a0) * ra, y0 + ya, s + Math.sin(a0) * ra], [x + Math.cos(a0) * rb, y0 + yb, s + Math.sin(a0) * rb], [x + Math.cos(a1) * rb, y0 + yb, s + Math.sin(a1) * rb], [x + Math.cos(a1) * ra, y0 + ya, s + Math.sin(a1) * ra], col); } };
    ring(0, band[0], C.orange); ring(band[0], band[1], C.white); ring(band[1], h, C.orange);
    { const zz = -0.09, yc = y0 + 0.42, w = 0.07, hh = 0.045;   // the sticker on the white band, facing back along the ramp's direction, towards the traffic coming up the street (the easter egg: STICKER_TEXT)
      SP.push(x + w, yc - hh, zz, x - w, yc - hh, zz, x - w, yc + hh, zz, x + w, yc - hh, zz, x - w, yc + hh, zz, x + w, yc + hh, zz); SU.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.computeVertexNormals();
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(SP, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(SU, 2)); sg.computeVertexNormals();
    return { g, sg };
  })();
  // where the cones stand, in each ramp's frame (x to its left, s along it): a taper out into the street in front, three at the end, two at the entrance
  const coneSpots = r => { const hw = r.K.w / 2, bx0 = -ZONE_BEFORE, bx1 = r.L + ZONE_AFTER; return [[hw + 1.2, bx0 - 1.2], [hw + 1.9, bx0 - 3.4], [hw + 2.6, bx0 - 5.6], [hw + 0.55, bx1 + 0.9], [-(hw + 0.45), bx1 + 0.9], [hw + 1.7, bx1 + 0.9], [-hw, bx0 - 0.5], [hw, bx0 - 0.5]]; };
  const NC = coneSpots(list[0] || { K: KINDS.ramp, L: 10 }).length, coneN = list.length * NC;
  const hasSticker = i => { let h = Math.imul(i + 1, 0x9e3779b1); h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; return (h >>> 0) % 5 === 0; };   // the same cones every time: about a fifth of them
  let coneMesh = null, stickMesh = null;
  if (coneN) {
    coneMesh = new THREE.InstancedMesh(coneGeos.g, mat, coneN); stickMesh = new THREE.InstancedMesh(coneGeos.sg, stickerMat, coneN);
    for (const m of [coneMesh, stickMesh]) { m.frustumCulled = false; m.visible = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    coneMesh.castShadow = true; coneMesh.receiveShadow = true; scene.add(coneMesh, stickMesh);
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3();
  // the boards on the traffic side are walls for the lapa (the right ones stand 0.45 m from the ramp, in the gap by the kerb)
  if (walls2d) for (const z of zones) {
    const hw = z.w / 2 + 0.55, sn = Math.sin(z.th), cs = Math.cos(z.th), s0 = -ZONE_BEFORE, s1 = z.L + ZONE_AFTER;
    const a = [z.x + sn * s0 + cs * hw, z.z + cs * s0 - sn * hw], b = [z.x + sn * s1 + cs * hw, z.z + cs * s1 - sn * hw];
    walls2d.addSeg([a[0], a[1], b[0], b[1]], a[0], a[1], b[0], b[1]);
  }
  // the traffic's view of a work zone: one long parked obstacle made of circles (the same fields as a parked car, src/props.js parked.near)
  const obstacles = zones.map(z => { const r = z.zw / 2, c = []; for (let zo = -z.zl / 2 + r; zo <= z.zl / 2 - r + 0.01; zo += r * 1.2) c.push([0, zo, r]); return { x: z.zx, z: z.zz, rot: z.th, st: 0, ramp: true, sp: { L: z.zl, W: z.zw, m: 1e6, c, kind: 'ramp' } }; });
  function zonesNear(x, z, r, out) { for (const o of obstacles) if (Math.hypot(o.x - x, o.z - z) < r + o.sp.L / 2 + 2) out.push(o); return out.length; }
  let tick = 1;
  function update(dt) {
    tick += dt; if (tick < 0.5) return; tick = 0;
    const cx = camera.position.x, cz = camera.position.z;
    let anyCone = false;
    for (let zi = 0; zi < list.length && coneMesh; zi++) {
      const r = list[zi], near = Math.hypot(r.x - cx, r.z - cz) < SEE, sp = coneSpots(r);
      for (let k = 0; k < sp.length; k++) {
        const [lx, ls] = sp[k], wx = r.x + r.cs * lx + r.sn * ls, wz = r.z - r.sn * lx + r.cs * ls;
        m4.compose(p3.set(wx, near ? groundY(wx, wz) + (raisedMask && raisedMask(wx, wz) ? CURB : 0) + 0.005 : -1000, wz), q4.setFromAxisAngle(up, r.th), one); coneMesh.setMatrixAt(zi * NC + k, m4);
        if (hasSticker(zi * NC + k)) stickMesh.setMatrixAt(zi * NC + k, m4); else stickMesh.setMatrixAt(zi * NC + k, m4.compose(p3.set(0, -1000, 0), q4.set(0, 0, 0, 1), one));   // the easter egg is on about one cone in five
      }
      if (near) anyCone = true;
    }
    if (coneMesh) { coneMesh.instanceMatrix.needsUpdate = stickMesh.instanceMatrix.needsUpdate = true; coneMesh.visible = stickMesh.visible = anyCone; }
    for (const kind in meshes) {
      const { m, mine, ex } = meshes[kind]; let any = false;
      for (let i = 0; i < mine.length; i++) {
        const r = mine[i], near = Math.hypot(r.x - cx, r.z - cz) < SEE;
        if (near) { r.base = lowest(r); any = true; }
        m.setMatrixAt(i, m4.compose(p3.set(r.x, near ? r.base : -1000, r.z), q4.setFromAxisAngle(up, r.th), one)); for (const e of ex) e.setMatrixAt(i, m4);
      }
      m.instanceMatrix.needsUpdate = true; m.visible = any; for (const e of ex) { e.instanceMatrix.needsUpdate = true; e.visible = any; }
    }
  }
  return { surfaceAt, update, list, zonesNear };
}
