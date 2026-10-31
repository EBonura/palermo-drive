// Per-building facade specs, measured from reference photos (Wikimedia Commons, reference only).
// Keyed by building id from palermo-data.js. src/buildings.js falls back to its style logic for anything missing.
// Fields (all optional):
//   style: 'bar' | 'n19' | 'res' | 'pw' | 'church'
//   floors: total storeys incl. ground floor; g0: ground floor height m; nobH: piano nobile height m
//   bay: target bay width m; bays: { <b.p edge index>: n } or a number for every street wall
//   win: 'rect' | 'arch' | 'ped'      (upper window type)
//   balc: 'every' | 'alt' | 'nobile' | 'cont' | 'none'; rail: 'rail_a' | 'rail_b'
//   ground: 'shops' | 'arcade' | 'blind' | 'rustic' | 'mixed'; portal: { bay: i, wall?: edgeIndex }
//   corn: cornice projection m (0 = none); stone: true = exposed tufa; col: '#hex' plaster/stone colour; grime: 0..1
//   walls: { <b.p edge index>: { any of bays/ground/portal/balc/win/up } }   per-wall overrides
//   src: photo source note (not used by the game)
export default {};
