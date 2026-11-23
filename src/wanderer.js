// "The Sicilian Wanderer": a likeness cameo of Dario Cascio, a Sicilian creator and a friend of the owner. He stands in the Vucciria filming on his phone, held in front of his chest in both hands (the cast entries
// 'wanderer' and 'wanderer_tweed' of assets/peds/sprites.js, drawn by tools/lpc/cast.mjs and assets/peds/lpc/extras.js). He is the passenger of the job in src/job-wanderer.js.
// He is a scripted character of the crowd (pedestrians.spawnScripted), added when the lapa comes within SHOW_R and taken away again beyond HIDE_R. ?wanderer=tweed puts him in the tweed jacket and flat cap.
// A small name tag floats over his head (one sprite, one canvas, drawn when he is within LABEL_R metres), so nobody can miss who he is.
// createWanderer(h) -> { update(dt), id(), x, z, lx, lz, grab() -> id, give(walkHome) }
//   grab(): the job takes him (spawned if he is not there yet, and never hidden while held); give(true): the job lets him go and he walks back to his spot and takes up filming again.
import * as THREE from 'three';
export const WANDERER = {
  lat: 38.1180, lon: 13.3647,   // Piazza Garraffello, in the Vucciria: the market square (to be checked on the ground)
  look: { lat: 38.1182, lon: 13.3643 },   // what he is filming: the way he faces
};
export const WANDERER_NAME = 'The Sicilian Wanderer';
const SHOW_R = 260, HIDE_R = 340, LABEL_R = 70;

function makeLabel(scene) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = 'rgba(13,7,10,.82)'; g.beginPath(); g.roundRect(2, 6, 508, 68, 34); g.fill();
  g.fillStyle = '#f5a9c9'; g.beginPath(); g.arc(40, 40, 11, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = '700 38px "Barlow Condensed","Arial Narrow",system-ui,sans-serif'; g.textBaseline = 'middle'; g.fillText(WANDERER_NAME.toUpperCase(), 66, 42);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthWrite: false })); sp.scale.set(2.7, 0.42, 1); sp.visible = false; sp.renderOrder = 40; scene.add(sp);
  return sp;
}

export function createWanderer(h) {
  const { env, car, pedestrians, params, scene } = h;
  const [x, z] = env.proj(WANDERER.lat, WANDERER.lon), [lx, lz] = env.proj(WANDERER.look.lat, WANDERER.look.lon);
  const look = (params && params.get('wanderer')) === 'tweed' ? 'wanderer_tweed' : 'wanderer';
  let cid = -1, held = false, home = false, label = null;
  function update() {
    if (cid >= 0 && !pedestrians.info(cid)) cid = -1;   // the crowd system dropped him
    const d = Math.hypot(car.x - x, car.z - z);
    if (!held) {
      if (cid < 0 && d < SHOW_R) { cid = pedestrians.spawnScripted(look, x, z); if (cid >= 0) pedestrians.face(cid, lx, lz); }
      else if (cid >= 0 && d > HIDE_R && !home) { pedestrians.remove(cid); cid = -1; }
      if (home && cid >= 0) { const i = pedestrians.info(cid); if (i && Math.hypot(i.x - x, i.z - z) < 1.1) { pedestrians.face(cid, lx, lz); home = false; } }
    }
    const i = cid >= 0 ? pedestrians.info(cid) : null;
    if (i && scene && Math.hypot(i.x - car.x, i.z - car.z) < LABEL_R) {
      if (!label) label = makeLabel(scene);
      label.position.set(i.x, i.y + 2.45, i.z); label.visible = true;
    } else if (label) label.visible = false;
  }
  function grab() {
    if (cid < 0) { cid = pedestrians.spawnScripted(look, x, z); if (cid >= 0) pedestrians.face(cid, lx, lz); }
    held = true; home = false; return cid;
  }
  function give(walkHome) {
    held = false;
    if (cid >= 0 && walkHome) { pedestrians.detach(cid); pedestrians.walkTo(cid, x, z, 2.2); home = true; }
  }
  return { update, id: () => cid, x, z, lx, lz, grab, give };
}
