// Traffic signals: which road legs each mapped signal (OpenStreetMap highway=traffic_signals, props k 'signal') governs and what light each leg sees at any moment.
// Owned by the traffic work. Everything is a pure function of the tile's roads, the signal's own position and a wall clock, so the heads (src/props.js) and the
// cars (src/traffic.js) agree without talking to each other, and so do two players: the clock is Date.now(), nothing is sent between them.
//
// The plan is a design value, not data (the tiles only say where a signal stands): a junction runs two phases, one for the legs along its main road and one for the
// rest, each with a green, an amber and an all-red gap, and every signal starts at an offset of its own so the whole city does not change at once. A signal that has
// no cross road to stop (a pedestrian crossing in the middle of a road) is green for the cars most of the time and red for the walkers' turn.
import * as THREE from 'three';

// seconds. Two-phase junction: [0, G) green for group 0, then A amber, then R all red, and the same again for group 1 (cycle 2 * (G + A + R)).
export const PLAN = { G: 20, A: 3, R: 2, crossCycle: 40, crossGreen: 28 };
export const STOP_BACK = 6.5;   // m before the signal's node where the stop line is painted (src/streets.js) and the pole stands a metre beyond it
const CLUSTER = 35;             // m: signals this close belong to one junction
const SNAP = 3;                 // m: a signal further than this from every road vertex does not stand at a junction, so it governs nothing
const RANK = { trunk: 5, primary: 5, secondary: 4, tertiary: 3, unclassified: 2, residential: 2, trunk_link: 4, primary_link: 4, secondary_link: 3, tertiary_link: 3 };   // the roads cars queue on (no service roads, alleys or pedestrian streets)

export const clock = { now: () => Date.now() / 1000 };   // seconds; ?debug lets a test replace it

const hash01 = (x, z) => ((Math.imul(Math.round(x * 10), 73856093) ^ Math.imul(Math.round(z * 10), 19349663)) >>> 0) % 10007 / 10007;

// The signals of one tile: roads = tile roads[], items = props items (k 'signal' ones are used).
// Returns [{ x, z (the junction vertex), ix, iz (the mapped position), off (clock offset, 0..1), cross (nothing to stop but one axis), legs: [{ ax, az (unit, away from the
// junction), pts (the road's own line away from it), inb (cars arrive along it), g (phase group), w (road width), k (class), ow (one-way), rank }] }].
export function signalSites(roads, items) {
  const out = [], seen = new Set();
  for (const it of items) {
    if (it.k !== 'signal') continue;
    let bx = 0, bz = 0, bd = SNAP * SNAP, found = false;
    for (const r of roads) {
      if (!RANK[r.k] || r.tn || r.br) continue;
      const p = r.p;
      for (let i = 0; i + 1 < p.length; i += 2) { const d = (p[i] - it.x) * (p[i] - it.x) + (p[i + 1] - it.z) * (p[i + 1] - it.z); if (d < bd) { bd = d; bx = p[i]; bz = p[i + 1]; found = true; } }
    }
    if (!found) continue;
    const key = Math.round(bx * 2) + ',' + Math.round(bz * 2); if (seen.has(key)) continue; seen.add(key);
    const legs = [];
    for (const r of roads) {
      if (!RANK[r.k] || r.tn || r.br) continue;
      const p = r.p, n = p.length;
      for (let i = 0; i + 1 < n; i += 2) {
        if (Math.abs(p[i] - bx) > 0.35 || Math.abs(p[i + 1] - bz) > 0.35) continue;
        const add = (step, inb) => {   // step -2 / +2: along the road towards the start / the end; pts: the road's own line away from the junction for the first 30 m
          const dx = p[i + step] - bx, dz = p[i + step + 1] - bz, l = Math.sqrt(dx * dx + dz * dz); if (l < 0.5) return;
          const pts = [bx, bz]; let run = 0;
          for (let j = i + step; j >= 0 && j + 1 < n && run < 30; j += step) { pts.push(p[j], p[j + 1]); run += Math.hypot(pts[pts.length - 2] - pts[pts.length - 4], pts[pts.length - 1] - pts[pts.length - 3]); }
          legs.push({ ax: dx / l, az: dz / l, inb, g: 0, w: r.w || 4, k: r.k, ow: !!r.o, rank: RANK[r.k], pts });
        };
        if (i >= 2) add(-2, r.o !== -1);   // towards the previous vertex: cars come from there when the road runs forward (o 1) or both ways
        if (i + 3 < n) add(2, r.o !== 1);
      }
    }
    if (!legs.some(l => l.inb)) continue;
    out.push({ x: bx, z: bz, ix: it.x, iz: it.z, off: 0, cross: false, legs });
  }
  // A big junction is often mapped as several signals a few metres apart (one per arm, or per carriageway): they share one clock and one reference axis (the widest
  // road of the lot), or the phases of its arms would disagree. A site with no cross road of its own then simply takes the phase of its road.
  const par = out.map((_, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) if (Math.hypot(out[i].x - out[j].x, out[i].z - out[j].z) < CLUSTER) par[find(j)] = find(i);
  const groups = new Map(); out.forEach((st, i) => { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(st); });
  for (const sites of groups.values()) {
    let ref = null, first = sites[0];
    for (const st of sites) {
      if (st.ix < first.ix || (st.ix === first.ix && st.iz < first.iz)) first = st;
      for (const l of st.legs) if (!ref || l.rank * 100 + l.w > ref.rank * 100 + ref.w) ref = l;
    }
    const off = hash01(first.ix, first.iz);
    let cross = true;
    for (const st of sites) for (const l of st.legs) { l.g = Math.abs(l.ax * ref.ax + l.az * ref.az) >= 0.7071 ? 0 : 1; if (l.inb && l.g === 1) cross = false; }   // within 45 degrees of the main road's line: its phase
    for (const st of sites) { st.off = off; st.cross = cross; }
  }
  return out;
}

// the point d metres along a leg from the junction, following the road's own line, and the unit direction there (away from the junction): [x, z, tx, tz]
export function legPoint(leg, site, d) {
  const q = leg.pts; let rem = d;
  for (let i = 0; i + 3 < q.length; i += 2) {
    const dx = q[i + 2] - q[i], dz = q[i + 3] - q[i + 1], l = Math.sqrt(dx * dx + dz * dz);
    if (l >= rem || i + 5 >= q.length) { const f = Math.min(rem, l) / (l || 1); return [q[i] + dx * f, q[i + 1] + dz * f, dx / (l || 1), dz / (l || 1)]; }
    rem -= l;
  }
  return [site.x + leg.ax * d, site.z + leg.az * d, leg.ax, leg.az];
}

// 0 green, 1 amber, 2 red, for phase group g of a site at clock time t (seconds)
export function light(site, g, t) {
  if (site.cross) {
    const C = PLAN.crossCycle, u = (((t + site.off * C) % C) + C) % C;
    return u < PLAN.crossGreen ? 0 : u < PLAN.crossGreen + PLAN.A ? 1 : 2;
  }
  const H = PLAN.G + PLAN.A + PLAN.R, C = 2 * H, u = ((((t + site.off * C) - g * H) % C) + C) % C;
  return u < PLAN.G ? 0 : u < PLAN.G + PLAN.A ? 1 : 2;
}

// The lit lamp of every signal head standing in the scene. A head's InstancedMesh carries its state in the red channel of the instance colour (0 dark, 1 red, 2 amber,
// 3 green: the material of src/props.js reads it), so a state change is a few floats in a small buffer, no light, no extra draw call.
export function createSignalLamps() {
  const items = []; let lastQ = -1;
  return {
    items,
    add(mesh, i, site, g, coll) { items.push({ mesh, i, site, g, coll, code: -1 }); lastQ = -1; },
    drop(meshes) { for (let k = items.length - 1; k >= 0; k--) if (meshes.has(items[k].mesh)) items.splice(k, 1); },
    update() {
      const t = clock.now(), q = Math.floor(t * 4); if (q === lastQ) return; lastQ = q;
      for (let k = 0; k < items.length; k++) {
        const s = items[k], code = s.coll && s.coll.st !== 0 ? 0 : 3 - light(s.site, s.g, t);   // a signal that has been knocked down is dark
        if (code !== s.code) { s.code = code; s.mesh.instanceColor.array[s.i * 3] = code; s.mesh.instanceColor.needsUpdate = true; }
      }
    },
  };
}

// The material of the heads: the housing is vertex-coloured like every prop, and the lens vertices (attribute lamp 1 red, 2 amber, 3 green; lampC their centre) glow when
// their colour is the one the instance shows. The lit lens also grows with the distance (up to 6 times, from 30 m on) so that a 25 cm lamp still reads at a hundred metres;
// that is a vertex shader line, not geometry. Unlit lenses are almost black glass.
export function signalMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.0 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float lamp;\nattribute vec3 lampC;\nvarying float vLit;\nvarying float vLens;')
      .replace('#include <color_vertex>', `vColor = vec4( 1.0 );
#ifdef USE_COLOR
vColor.rgb *= color;
#endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vLens = lamp > 0.5 ? 1.0 : 0.0;
vLit = ( lamp > 0.5 && abs( lamp - instanceColor.r ) < 0.5 ) ? 1.0 : 0.0;
if ( vLit > 0.5 ) {
  float dl = length( ( modelViewMatrix * instanceMatrix * vec4( lampC, 1.0 ) ).xyz );
  transformed.xy = lampC.xy + ( position.xy - lampC.xy ) * clamp( dl / 30.0, 1.0, 6.0 );
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLit;\nvarying float vLens;')
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 lensCol = diffuseColor.rgb;
if ( vLens > 0.5 ) diffuseColor.rgb *= vLit > 0.5 ? 0.12 : 0.07;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += lensCol * vLit * 1.5;`);
  };
  m.customProgramCacheKey = () => 'signal-lens';
  return m;
}
