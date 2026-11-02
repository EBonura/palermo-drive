// The vendors' calls: the Apes with a loudspeaker on the roof (sfincione, pane e panelle), the fruit seller's Ape and the tourist carrozze shout a short line now and then,
// in the same speech balloon as everybody else (T.shoutAt). Rate-limited so the street never turns into a chorus: one call at a time, at least GAP seconds between any two
// (SCENE_GAP when somebody just shouted at the lapa), each vehicle only every 30 to 70 seconds, and only the ones near enough to be heard and in view.
// Owned by the traffic work; driven by src/traffic.js (createVendors(env, T)). The lines are Palermitan, written for the game: the owner may want to put his own.
const rand = (a, b) => a + Math.random() * (b - a);
export const LINES = {
  apeSfincione: ['Sfinciuni càvudu! Sfinciuni!', 'Cu voli u sfinciuni? Càvudu càvudu!', 'Sfinciuni, sfinciuni di Bagheria!'],
  apeFood: ['Panelle e crocchè, càvuri càvuri!', 'Pani e panelle! Pani e panelle!', 'Cu voli i panelle? Sunnu càvudi!'],
  apeFrutta: ['Aranci duci, aranci!', 'Frutta frisca! Bedda frutta frisca!', 'Chi bedda frutta, signura! Pigghiatilla!'],
  carrozza: ['Giru in carrozza, signuri! Giru in carrozza!', 'Cu voli fari u giru? Quattru Canti e Tiatru!'],
};
const GAP = 9, RANGE = [8, 46];

export function createVendors(env, T) {
  const { camera } = env, vs = T.vs;
  let time = 0, tickT = 0, nextAny = 6; const last = {};
  function update(dt) {
    time += dt; tickT += dt; if (tickT < 0.5) return; tickT = 0;
    if (time < nextAny) return;
    for (const v of vs) {
      const L = LINES[v.name]; if (!L || v.dead || v.fly || v.hide || v.cop) continue;
      const d = Math.hypot(v.x - camera.position.x, v.z - camera.position.z); if (d < RANGE[0] || d > RANGE[1]) continue;
      if (v.callAt === undefined) v.callAt = time + rand(2, 14);
      if (time < v.callAt || !T.inView(v.x, 1.5, v.z, 3)) continue;
      let line; do line = L[(Math.random() * L.length) | 0]; while (line === last[v.name] && L.length > 1);
      last[v.name] = line; T.shoutAt(v, line);
      v.callAt = time + rand(30, 70); nextAny = time + GAP + rand(0, 4);
      break;
    }
  }
  return { update, LINES };
}
