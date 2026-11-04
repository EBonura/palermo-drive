// Page side of tools/route-check/check.mjs: injected into the game page (needs ?debug, which puts window.game there). Everything here reads the REAL loaded world:
// the surface mask the car drives on (world.surfaceAt), the wall grid (every building footprint, fence, wall, landmark, stall, quay and parapet the physics collides with),
// the solid props and the bridge levels. Nothing is computed from the tile json, so what this says is what the car meets.
(() => {
  const G = window.game, W = G.world, T = 500, WALLS = G.walls2d;
  const nk = (i, j) => (i + 200) * 1000 + (j + 200);
  const tileAt = (x, z) => W.tiles.get(nk(Math.floor(x / T), Math.floor(z / T)));
  const ready = (x, z) => { const t = tileAt(x, z); return !!t && t.lod === 2 && !!t.phys && t.hard !== undefined; };
  const exists = (i, j) => !!(W.manifest && W.manifest.tiles && W.manifest.tiles[i + '_' + j]);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Move the streaming focus to (x, z) and wait until the tile under it and its existing neighbours are at full detail with their walls and masks built.
  async function focus(x, z, timeoutMs = 60000) {
    const t0 = performance.now();
    await Promise.race([new Promise(res => W.teleport(x, z, res)), sleep(15000)]);
    window.__missions.X.vehicle.teleport(x, z, 0);   // the focus follows the camera, which follows the car; (x, z) must be a land point (a lapa on the water would end the run)
    const i = Math.floor(x / T), j = Math.floor(z / T);
    for (;;) {
      let ok = true;
      for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1; b++) if (exists(i + a, j + b) && !ready((i + a + 0.5) * T, (j + b + 0.5) * T)) { ok = false; break; }
      if (ok) return Math.round(performance.now() - t0);
      window.__rc_bad = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (exists(i + a, j + b) && !ready((i + a + 0.5) * T, (j + b + 0.5) * T)) { const q = tileAt((i + a + 0.5) * T, (j + b + 0.5) * T); window.__rc_bad.push((i + a) + '_' + (j + b) + ':' + (q ? q.lod + '/' + !!q.phys + '/' + (q.hard === undefined ? 'U' : 'ok') : 'none')); }
      if (performance.now() - t0 > timeoutMs) return -1;
      await sleep(60);
    }
  }

  const SOLID = new Set(['shelter', 'hydrant', 'phone', 'cabinet', 'postbox', 'monument', 'kiosk', 'fountain']);
  const PG = G.props && G.props.grid, PCELL = (i, j) => (i + 4096) * 8192 + (j + 4096);
  const segD = (px, pz, s) => { const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz, u = l2 ? Math.max(0, Math.min(1, ((px - s[0]) * dx + (pz - s[1]) * dz) / l2)) : 0; return Math.hypot(px - s[0] - dx * u, pz - s[1] - dz * u); };
  const kindOf = s => s.lv !== undefined ? 'L' : s.fn ? 'F' : s.t !== undefined && typeof s.t === 'string' ? (s.t[0] === 'f' ? 'F' : s.t[0] === 'q' ? 'Q' : s.t[0] === 's' ? 'S' : 'B') : 'B';

  // One sample at (x, z) on a line heading (hx, hz). The car does not have to be exactly on the line: it can be up to 2 m beside it (17 lateral offsets, 0.25 m apart, left of the heading
  // positive). For each class of obstacle a bit mask says which offsets are free for a lapa (circle of the car's radius): sf surface drivable (hard, gravel, a deck), wg walls and solid props
  // at ground level (level-tagged parapets only those within a step of the ground), wd the same for a car up on a deck, fe no fence panel. Also: the surface at the line itself (0 hard, 1 gravel,
  // 2 grass, 3 sand, 4 rough), the highest deck there (NaN none), the ground height, the distance of the line to the nearest wall (any kind), and 1 when a soft prop (tree, bin, hedge) is on it.
  const NOFF = 17, OFFS = []; for (let k = 0; k < NOFF; k++) OFFS.push((k - 8) * 0.25);
  const RF = 0.78;
  function sample(x, z, hx, hz) {
    const surf = W.surfaceAt(x, z, false), deck = G.hooks.level(x, z, 1e9), gy = G.groundY(x, z), nx = -hz, nz = hx;
    const segs = [], B = 2 + RF + 0.3;
    WALLS.query(x - B, z - B, x + B, z + B, s => { segs.push(s); });
    const circles = [];
    let soft = 0, dwc = 9;
    if (PG) {
      const i0 = Math.floor((x - 4) / 8), i1 = Math.floor((x + 4) / 8), j0 = Math.floor((z - 4) / 8), j1 = Math.floor((z + 4) / 8);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const lst = PG.get(PCELL(i, j)); if (!lst) continue;
        for (const c of lst) {
          if (!c || c.dead || c.st === 'gone' || c.st === 'down' || c.st === 'fall' || c.st === 'fly' || c.st === 'pfly') continue;
          const cr = Math.cos(c.rot), sr = Math.sin(c.rot);
          for (const [ox, oz, r0] of c.circ) {
            const wx = c.x + ox * cr + oz * sr, wz = c.z - ox * sr + oz * cr;
            if (SOLID.has(c.model)) circles.push([wx, wz, r0]); else if (Math.hypot(x - wx, z - wz) - r0 < 0.74 && c.sp && c.sp.kind !== 'park') soft = 1;
          }
        }
      }
    }
    let sf = 0, wg = 0, wd = 0, fe = 0;
    for (let k = 0; k < NOFF; k++) {
      const px = x + nx * OFFS[k], pz = z + nz * OFFS[k], bit = 1 << k;
      const dk = G.hooks.level(px, pz, 1e9), ok = dk === dk || (W.surfaceAt(px, pz, false) <= 1);
      if (ok) sf |= bit;
      let gOk = true, dOk = true, fOk = true;
      for (const s of segs) {
        const d = segD(px, pz, s); if (d >= RF) continue;
        if (s.lv !== undefined) { if (Math.abs(gy - s.lv) <= 2.6) gOk = false; if (dk === dk && Math.abs(dk - s.lv) <= 2.6) dOk = false; }
        else if (s.fn || (typeof s.t === 'string' && s.t[0] === 'f')) fOk = false;
        else { gOk = false; dOk = false; }
      }
      for (const c of circles) if (Math.hypot(px - c[0], pz - c[1]) - c[2] < RF) { gOk = false; dOk = false; }
      if (gOk) wg |= bit; if (dOk) wd |= bit; if (fOk) fe |= bit;
    }
    for (const s of segs) { const d = segD(x, z, s); if (d < dwc && s.lv === undefined) dwc = d; }
    return [surf, deck, gy, sf, wg, wd, fe, +dwc.toFixed(2), soft];
  }

  // samples: flat [x, z, hx, hz, ...]; the tile of every point must be ready (call focus first). Returns one array per sample, null where the tile is not ready.
  function probe(flat) {
    const out = new Array(flat.length / 4);
    for (let k = 0; k < flat.length; k += 4) out[k / 4] = ready(flat[k], flat[k + 1]) ? sample(flat[k], flat[k + 1], flat[k + 2], flat[k + 3]) : null;
    return out;
  }
  // ---- the guide, as the game runs it (src/route-guide.js): the way back to a place from where the car is, and the new line after leaving a baked one
  const M = () => window.__missions, guide = () => M().X.guide, veh = () => M().X.vehicle;
  const flatOf = r => Array.from(r);
  function planTo(fx, fz, tx, tz) {   // guide.to(x, z) with the car at (fx, fz) facing the target: what a hunt's return trip shows
    const car = G.car; let th = Math.atan2(tx - fx, tz - fz);
    // a car on a road faces along it (the nearer way round to the target), not straight at the target through the houses
    { const o = { e: null, t: 0, d: 0 }, g = G.traffic && G.traffic.graph; if (g && g.edgeFor(fx, fz, 0, 0, 30, o)) { const dx = o.e.dx, dz = o.e.dz, s = (tx - fx) * dx + (tz - fz) * dz >= 0 ? 1 : -1; th = Math.atan2(dx * s, dz * s); } }
    guide().off(); veh().teleport(fx, fz, th); car.vx = car.vz = 0;
    guide().to(tx, tz);
    const r = guide().route(), st = guide().state();
    return { pts: r ? flatOf(r) : null, why: st.why || '', kind: st.kind || '' };
  }
  const polyDist = (flat, x, z) => { let best = 1e9; for (let i = 0; i + 3 < flat.length; i += 2) { const d = segD(x, z, [flat[i], flat[i + 1], flat[i + 2], flat[i + 3]]); if (d < best) best = d; } return best; };
  const at = (flat, s) => { let acc = 0; for (let i = 0; i + 3 < flat.length; i += 2) { const L = Math.hypot(flat[i + 2] - flat[i], flat[i + 3] - flat[i + 1]); if (acc + L >= s) { const u = L ? (s - acc) / L : 0; return [flat[i] + (flat[i + 2] - flat[i]) * u, flat[i + 1] + (flat[i + 3] - flat[i + 1]) * u, Math.atan2(flat[i + 2] - flat[i], flat[i + 3] - flat[i + 1])]; } acc += L; } return [flat[flat.length - 2], flat[flat.length - 1], 0]; };
  // The car on the baked line at arc length s (so the guide knows its progress), then moved to a road point 45 to 140 m off the line, and the guide asked for a new way.
  function replanOff(flat, s, want = 90) {
    const g = G.traffic && G.traffic.debug && G.traffic.debug.G; if (!g) return { pts: null, why: 'no traffic graph' };
    const [px, pz, hd] = at(flat, s), car = G.car;
    let best = null, bd = 1e9;
    for (let i = 0; i < g.NX.length; i++) {
      if (!g.NOUT[i].length && !g.NIN[i].length) continue;
      if (!g.NOUT[i].some(e => !e.ped || e.transit) && !g.NIN[i].some(e => !e.ped || e.transit)) continue;   // a pedestrian street is no road for the guide
      const dx = g.NX[i] - px, dz = g.NZ[i] - pz, d = Math.hypot(dx, dz); if (d < 45 || d > 200) continue;
      const off = polyDist(flat, g.NX[i], g.NZ[i]); if (off < 45) continue;
      const sc = Math.abs(off - want); if (sc < bd) { bd = sc; best = [g.NX[i], g.NZ[i], off]; }
    }
    if (!best) return { pts: null, why: 'no road point off the line near s=' + Math.round(s) };
    const gd = guide(); gd.off(); veh().teleport(px, pz, hd); car.vx = car.vz = 0; gd.path(flat);
    for (let k = 0; k < 4; k++) gd.update(0.1);
    veh().teleport(best[0], best[1], hd + 1.2); car.vx = car.vz = 0;
    const ok = gd.replan('test'), st = gd.state();
    return { pts: ok && gd.route() ? flatOf(gd.route()) : null, why: st.why || '', kind: st.kind || '', from: [best[0], best[1]], off: best[2], s };
  }

  // ---- a plan view of a failure, as a JPEG data URL: the walls the physics has (black buildings, orange fences, blue parapets), the surface (grey hard, green and brown not), solid props (red), the line (pink) and the lapa's two circles along it
  function picture(cx, cz, flat, half = 60, px = 800) {
    const cv = document.createElement('canvas'); cv.width = cv.height = px; const g = cv.getContext('2d'), k = px / (2 * half), X = x => (x - cx + half) * k, Z = z => (z - cz + half) * k;
    const st = Math.max(1, Math.round(1 / k * 4));
    for (let zz = cz - half; zz < cz + half; zz += st) for (let xx = cx - half; xx < cx + half; xx += st) {
      const s = ready(xx, zz) ? W.surfaceAt(xx, zz, false) : -1, d = G.hooks.level(xx, zz, 1e9);
      g.fillStyle = s === 0 || d === d ? '#8a8a86' : s === 1 ? '#a38d62' : s === 2 ? '#5f8a4a' : s === 3 ? '#d6c28a' : s === 4 ? '#6f7a52' : '#222';
      g.fillRect(X(xx), Z(zz), st * k + 1, st * k + 1);
    }
    g.lineWidth = 2;
    WALLS.query(cx - half, cz - half, cx + half, cz + half, s => { g.strokeStyle = s.lv !== undefined ? '#2a6fe0' : s.fn ? '#f08a00' : '#000'; g.beginPath(); g.moveTo(X(s[0]), Z(s[1])); g.lineTo(X(s[2]), Z(s[3])); g.stroke(); });
    if (PG) for (let i = Math.floor((cx - half) / 8); i <= Math.floor((cx + half) / 8); i++) for (let j = Math.floor((cz - half) / 8); j <= Math.floor((cz + half) / 8); j++) { const l = PG.get(PCELL(i, j)); if (!l) continue; for (const c of l) if (c && !c.dead && SOLID.has(c.model)) for (const [ox, oz, r0] of c.circ) { const cr = Math.cos(c.rot), sr = Math.sin(c.rot); g.fillStyle = '#e02020'; g.beginPath(); g.arc(X(c.x + ox * cr + oz * sr), Z(c.z - ox * sr + oz * cr), Math.max(2, r0 * k), 0, 7); g.fill(); } }
    g.strokeStyle = '#ff3fa4'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < flat.length; i += 2) g[i ? 'lineTo' : 'moveTo'](X(flat[i]), Z(flat[i + 1])); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1;
    for (let s = 0, acc = 0, i = 0; i + 3 < flat.length; i += 2) { const L = Math.hypot(flat[i + 2] - flat[i], flat[i + 3] - flat[i + 1]); for (; s - acc < L; s += 6) { const u = (s - acc) / L, x = flat[i] + (flat[i + 2] - flat[i]) * u, z = flat[i + 1] + (flat[i + 3] - flat[i + 1]) * u; g.beginPath(); g.arc(X(x), Z(z), 0.74 * k, 0, 7); g.stroke(); } acc += L; }
    g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(`${Math.round(cx)}, ${Math.round(cz)}  ${2 * half} m   grey road, green grass, brown rough, black wall, orange fence, red solid prop`, 8, px - 8);
    return cv.toDataURL('image/jpeg', 0.8);
  }
  window.__rc = { focus, probe, ready, sample, planTo, replanOff, picture };
})();
