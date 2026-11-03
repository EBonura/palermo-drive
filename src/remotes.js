// Other players drawn in the world: their own vehicle (a lapa unless the feed names another) with a name tag and a minimap dot, positions interpolated from a few snapshots.
// Shared by src/net.js (relay) and src/p2p/p2p.js (peer to peer). They feed it: ensure(id), setInfo(r, name, livery[, vehicle]), addSnap(r, snap),
// retire(r) / remove(id) when somebody leaves; the owner calls update(dt, now) every frame.
// A snapshot is { t (performance.now), x, z, th, v, steer, roll, lean, fl }: fl bit0 nitro.
import * as THREE from 'three';
import { LIVERIES as ALL_LIVERIES } from './garage.js';

const DELAY = 150;             // interpolation buffer, ms
const EXTRAP = 250;            // longest extrapolation, ms
const FADE = 0.5;              // seconds
const TAU = Math.PI * 2;
const PINK = '#ff6fae', PINK_D = '#e8559a';
export const PLAYER_DOT = '#00e1ff';   // other players on the maps: a cyan RING, a colour and a shape nothing else on the minimap or the big map uses (mission marks are filled green, orange, yellow, purple and pink discs, diamonds, triangles and crosses)

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrapPI = a => a - TAU * Math.floor((a + Math.PI) / TAU);

export function createRemotes(env) {
  const { scene, camera, groundY, raisedMask, CURB, vehicle, mapMarkers } = env;
  const remotes = new Map(), dying = [];

  function addSnap(r, s) {
    const l = r.snaps[r.snaps.length - 1];
    if (l) {
      const gap = s.t - l.t, d = Math.hypot(s.x - l.x, s.z - l.z);
      if (d > 25 + 0.045 * gap) r.snaps.length = 0; // teleport (respawn, or came back from far away)
      else if (gap > 300 && Math.abs(l.v) < 0.5) r.snaps.push({ ...l, t: s.t - 100 }); // it sat still until just now
    }
    r.snaps.push(s); if (r.snaps.length > 16) r.snaps.shift();
    r.have = true;
  }

  const flameGeo = new THREE.ConeGeometry(0.1, 1, 8, 1, true).translate(0, 0.5, 0).rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

  function tagTexture(name) {
    const c = document.createElement('canvas'), g = c.getContext('2d'), f = '700 30px system-ui,-apple-system,sans-serif';
    g.font = f; const w = Math.ceil(g.measureText(name).width) + 30, h = 46;
    c.width = Math.max(w, 60); c.height = h;
    g.font = f; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(13,7,9,0.72)'; g.beginPath(); g.roundRect ? g.roundRect(1.5, 1.5, c.width - 3, h - 3, 12) : g.rect(1.5, 1.5, c.width - 3, h - 3); g.fill();
    g.strokeStyle = PINK_D; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#fff'; g.fillText(name, 15, h / 2 + 1);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
    return t;
  }

  // A speech bubble: white, rounded, dark text, with a tail pointing down at the car (the name tag stays the dark pink pill)
  function bubbleTexture(text) {
    const c = document.createElement('canvas'), g = c.getContext('2d'), f = '700 34px system-ui,-apple-system,sans-serif', tail = 22, pad = 22, bh = 62;
    g.font = f; const bw = Math.max(Math.ceil(g.measureText(text).width) + pad * 2, 90);
    c.width = bw + 8; c.height = bh + tail + 8;
    const x = 4, y = 4, r = 22, mx = c.width / 2;
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + bw - r, y); g.quadraticCurveTo(x + bw, y, x + bw, y + r); g.lineTo(x + bw, y + bh - r); g.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh);
    g.lineTo(mx + 14, y + bh); g.lineTo(mx, y + bh + tail); g.lineTo(mx - 14, y + bh); g.lineTo(x + r, y + bh); g.quadraticCurveTo(x, y + bh, x, y + bh - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
    g.fillStyle = '#fffaf0'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#1b0f14'; g.lineJoin = 'round'; g.stroke();
    g.font = f; g.fillStyle = '#1b0f14'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(text, mx, y + bh / 2 + 1);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
    return t;
  }

  function makeRemote(id) {
    const marker = { x: 0, z: 0, color: PLAYER_DOT, size: 5, shape: 'ring', player: true, name: '' };   // name: plain text, drawn with fillText by the maps
    return { id, name: '', livery: -1, snaps: [], have: false, qx: 0, qz: 0, hq: false, model: null, type: '', tag: null, flames: null, marker, alpha: 0, target: 1, lift: 0, y: 0, shadow: true, fadeMats: null, spin: 0, shown: false };
  }
  // liv indexes the livery list of `type` (a vehicle id); without a type it is the old relay call: the local vehicle's list, drawn as a lapa.
  // Both come from the network, so an unknown vehicle is a lapa and an unknown livery is the first one of its vehicle.
  function setInfo(r, name, liv, type) {
    const vt = type && ALL_LIVERIES[type] && type !== 'sulky' ? type : 'calessino', list = type ? ALL_LIVERIES[vt] : vehicle.LIVERIES;
    const lid = (list && list[liv] && list[liv].id) || ALL_LIVERIES[vt][0].id;
    if (r.livery !== liv || r.type !== vt || !r.model) {
      const old = r.model;
      if (old) { old.root.remove(...old.root.children.filter(c => c === r.tag || (r.bubble && c === r.bubble.sprite))); old.dispose(); r.fadeMats = null; }
      r.livery = liv; r.type = vt;
      r.model = vehicle.buildVehicleModel ? vehicle.buildVehicleModel({ type: vt, livery: lid }) : vehicle.buildLapa(lid);
      if (r.model) {
        r.model.root.visible = r.shown; scene.add(r.model.root);   // a rebuilt model of a car that is already on the street stays on it
        const A = r.model.A, tp = r.model.tpl.spec.tiltPivot, ex = A.exh ? (A.kind === 'bike' ? A.exh.slice(0, 1) : A.exh) : [];
        r.flames = ex.map(([x, y, z]) => { const m = new THREE.Mesh(flameGeo, flameMat); m.position.set(x - tp[0], y - tp[1], z - tp[2] - 0.2); m.visible = false; m.frustumCulled = false; r.model.tilt.add(m); return m; });
        if (r.tag) r.model.root.add(r.tag);
        if (r.bubble) r.model.root.add(r.bubble.sprite);
        r.shadow = true; for (const me of r.model.meshes) me.userData.sh = me.castShadow;
      }
    }
    if (name !== r.name || !r.tag) {
      r.name = name; r.marker.name = name;
      if (r.tag) { r.tag.material.map.dispose(); r.tag.material.dispose(); r.model && r.model.root.remove(r.tag); }
      const map = tagTexture(name || '?');
      r.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
      r.tag.scale.set(0.066 * map.image.width / map.image.height, 0.066, 1);
      r.tag.position.set(0, 2.55, 0); r.tag.renderOrder = 20;
      if (r.model) r.model.root.add(r.tag);
    }
  }

  function applyAlpha(r) {
    const a = r.alpha;
    if (a >= 0.999) {
      if (r.fadeMats) { for (const [m, o, c] of r.fadeMats) { m.material = o; c.dispose(); } r.fadeMats = null; }
    } else if (r.model) {
      if (!r.fadeMats) {
        r.fadeMats = r.model.meshes.map(m => { const o = m.material, c = o.clone(); c.userData.base = o.opacity; c.transparent = true; m.material = c; return [m, o, c]; });
      }
      for (const [, , c] of r.fadeMats) c.opacity = c.userData.base * a;
    }
    if (r.tag) r.tag.material.opacity = a * r.tagA;
    if (r.bubble) r.bubble.sprite.material.opacity = a * Math.max(r.tagA, 0.6);   // a phrase stays readable a little farther out than a name
  }

  function retire(r) { // player left: fade out, then free
    r.target = 0;
    const i = mapMarkers.indexOf(r.marker); if (i >= 0) mapMarkers.splice(i, 1);
    dying.push(r);
  }
  function dispose(r) {
    r.fadeMats && r.fadeMats.forEach(([, , c]) => c.dispose()); r.fadeMats = null;
    if (r.model) { scene.remove(r.model.root); if (r.model.dispose) r.model.dispose(); }   // dispose: the shared template is free to go when nobody uses it
    if (r.tag) { r.tag.material.map.dispose(); r.tag.material.dispose(); }
    clearBubble(r);
    const i = mapMarkers.indexOf(r.marker); if (i >= 0) mapMarkers.splice(i, 1);
  }
  function dropAll() {
    for (const r of remotes.values()) retire(r);
    remotes.clear();
  }

  function sample(r, now) {
    const s = r.snaps, rt = now - DELAY;
    while (s.length > 2 && s[1].t <= rt) s.shift();
    const a = s[0], b = s[1];
    if (!b || rt >= b.t) {
      const l = s[s.length - 1], dt = clamp(rt - l.t, 0, EXTRAP) / 1000;
      return { x: l.x + Math.sin(l.th) * l.v * dt, z: l.z + Math.cos(l.th) * l.v * dt, th: l.th, v: l.v, steer: l.steer, roll: l.roll, lean: l.lean, fl: l.fl, h: l.h || 0 };
    }
    if (rt <= a.t) return a;
    const k = (rt - a.t) / (b.t - a.t), m = (p, q) => p + (q - p) * k;
    return { x: m(a.x, b.x), z: m(a.z, b.z), th: a.th + wrapPI(b.th - a.th) * k, v: m(a.v, b.v), steer: m(a.steer, b.steer), roll: m(a.roll, b.roll), lean: m(a.lean, b.lean), fl: b.fl, h: m(a.h || 0, b.h || 0) };
  }

    function poseRemote(r, dt, now) {
    const m = r.model; if (!m || !r.snaps.length) return;
    const p = sample(r, now);
    // height over the ground: a curb, or what the sender says (a bridge deck, a roof, the air), brought along with the same interpolation as x and z, then eased a little
    const gy = groundY(p.x, p.z), lt = Math.max(p.h || 0, raisedMask(p.x, p.z) ? CURB : 0);
    r.lift += (lt - r.lift) * Math.min(1, (p.h > 0.3 || r.lift > 0.6 ? 30 : 12) * dt);
    m.root.position.set(p.x, gy + r.lift, p.z); m.root.rotation.y = p.th;
    r.spin += p.v * dt / ((m.wheels[0] && m.wheels[0].r) || 0.23);
    m.pose({ pitch: 0, roll: p.roll, lean: p.lean, steer: p.steer, spin: r.spin, t: now / 1000, speed: Math.abs(p.v) });
    if (r.flames) { const on = (p.fl & 1) === 1; for (const f of r.flames) { f.visible = on; if (on) f.scale.set(1.3, 1.3, 1.6 + Math.random() * 0.8); } }
    r.marker.x = p.x; r.marker.z = p.z;
    const d = Math.hypot(p.x - camera.position.x, p.z - camera.position.z);
    r.tagA = clamp((330 - d) / 100, 0, 1);
    const sh = d < 90; if (sh !== r.shadow) { r.shadow = sh; for (const me of m.meshes) me.castShadow = sh && me.userData.sh; }
    if (!r.shown) { r.shown = true; m.root.visible = true; mapMarkers.push(r.marker); }
  }

  // A short phrase above a player's car for a few seconds (the p2p phrase picker). The text is drawn on a canvas, never inserted as HTML.
  function clearBubble(r) {
    if (!r.bubble) return;
    if (r.model) r.model.root.remove(r.bubble.sprite);
    r.bubble.sprite.material.map.dispose(); r.bubble.sprite.material.dispose(); r.bubble = null;
  }
  function say(r, text, now, ms = 4500) {
    if (!r || !r.model) return;
    clearBubble(r);
    const map = bubbleTexture(text), sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
    sprite.scale.set(0.085 * map.image.width / map.image.height, 0.085, 1); sprite.center.set(0.5, 0); sprite.position.set(0, 3.0, 0); sprite.renderOrder = 21;   // the tail's tip is the anchor, just above the name tag
    r.model.root.add(sprite); r.bubble = { sprite, until: now + ms };
  }

  const ensure = id => { let r = remotes.get(id); if (!r) { r = makeRemote(id); remotes.set(id, r); } return r; };
  const remove = id => { const r = remotes.get(id); if (r) { remotes.delete(id); retire(r); } };

  function update(dt, now) {
    if (remotes.size || dying.length) {
      for (const r of remotes.values()) {
        if (r.bubble && now > r.bubble.until) clearBubble(r);
        if (r.have) { r.alpha = Math.min(1, r.alpha + dt / FADE); }
        if (r.tagA === undefined) r.tagA = 0;
        if (!r.have) continue;
        poseRemote(r, dt, now); applyAlpha(r);
      }
      for (let i = dying.length - 1; i >= 0; i--) {
        const r = dying[i]; r.alpha = Math.max(0, r.alpha - dt / FADE);
        if (r.alpha <= 0) { dispose(r); dying.splice(i, 1); continue; }
        if (r.tagA === undefined) r.tagA = 0;
        applyAlpha(r);
      }
    }
  }

  // the players on the street right now, for the big map: [{ id, name, x, z }] (only those we are connected to and have seen)
  const list = () => [...remotes.values()].filter(r => r.shown).map(r => ({ id: r.id, name: r.name, x: r.marker.x, z: r.marker.z }));
  return { remotes, ensure, remove, setInfo, addSnap, retire, dropAll, update, say, list };
}
