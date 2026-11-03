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
export default {
  // Piazza Marina: bare golden tufa, three storeys of pointed/round-arched windows, banded ground floor, crenellated cornice.
  'r4779985.0': { name: 'Palazzo Galletti', style: 'bar', floors: 3, g0: 4.8, win: 'arch', balc: 'none', ground: 'rustic', corn: 0.5, stone: true, col: '#b5a070', grime: 0.35,
    src: 'https://commons.wikimedia.org/wiki/File:Palazzo_Galletti_-_Piazza_Marina_-_Palermo_-_Italy_2015.JPG' },
  // Piazza Pretoria: pale grey-cream plaster, pedimented windows, iron balconies on the piano nobile, rusticated base.
  'w86870880': { name: 'Palazzo Guggino', style: 'bar', floors: 4, g0: 4.6, nobH: 5.0, win: 'ped', balc: 'nobile', ground: 'rustic', corn: 0.6, col: '#d9d6cc', grime: 0.35,
    src: 'https://commons.wikimedia.org/wiki/File:Palazzo_Guggino_-_Palermo_-_Italy_2015.JPG' },
  // Near Piazza Marina / Corso: near-white plaster, grey stone frames, a small iron balcony per bay on every floor, shops below.
  'r6457022.0': { name: 'Hotel de France', style: 'n19', floors: 5, g0: 4.4, win: 'rect', balc: 'every', ground: 'shops', corn: 0.45, col: '#e8e4dc', grime: 0.2,
    src: 'https://commons.wikimedia.org/wiki/File:Hotel_de_France_Palermo.jpg' },
  // Piazza Bologni: weathered golden stone and patchy plaster, brown louvred shutters, individual balconies, arched portal.
  'r20108989.0': { name: 'Palazzo Alliata di Villafranca', style: 'bar', floors: 4, g0: 4.8, win: 'ped', balc: 'alt', ground: 'rustic', portal: { bay: 3 }, corn: 0.6, stone: true, col: '#a98a62', grime: 0.6,
    src: 'https://commons.wikimedia.org/wiki/File:Palazzo_Alliata_di_Villafranca_(Palermo)_-_Exterior.jpg' },
  // Albergheria: dark decayed tufa, rusticated ground floor with shutters, heavy balconies on the piano nobile.
  'r3233025.0': { name: 'Palazzo Aiutamicristo', style: 'bar', floors: 4, g0: 5.0, nobH: 5.4, win: 'ped', balc: 'nobile', ground: 'rustic', corn: 0.5, stone: true, col: '#8f8268', grime: 0.7,
    src: 'https://commons.wikimedia.org/wiki/File:Palermo-Palazzo-Aiutamicristo-bjs2007-01.jpg' },
  // Via Marchese Ugo area, near Piazza Marina side: near-white plaster, grey frames, small iron balconies, arcaded ground floor.
  'w174497955': { name: 'Palazzo Fatta', style: 'n19', floors: 5, g0: 4.8, win: 'rect', balc: 'every', ground: 'arcade', corn: 0.5, col: '#e2ded4', grime: 0.25,
    src: 'https://commons.wikimedia.org/wiki/File:Palermo-AP-p1070639.jpg' },
  // Salmon-ochre plaster with pale stone bands, round-arched ground floor, three tall floors.
  'r12541932.0': { name: 'Ex-Collegio Massimo dei Gesuiti', style: 'n19', floors: 4, g0: 5.2, win: 'rect', balc: 'none', ground: 'arcade', corn: 0.6, col: '#d6ab86', grime: 0.3,
    src: 'https://commons.wikimedia.org/wiki/File:Palermo,_Convitto_Nazionale.jpg' },
  // Corso Vittorio Emanuele: golden stone, a balcony at every window of the piano nobile and the floor above, rusticated ground.
  'r3949534.0': { name: 'Palazzo Celestri di Santa Croce', style: 'bar', floors: 4, g0: 5.0, nobH: 5.4, win: 'ped', balc: 'every', ground: 'rustic', corn: 0.6, stone: true, col: '#b8985c', grime: 0.45,
    src: 'https://commons.wikimedia.org/wiki/File:Palazzo_Sant%27Elia.jpg' },
  // Courtyard palace: white plaster, yellow-ochre window frames.
  'r403465.0': { name: 'Palazzo Arcivescovile', style: 'bar', floors: 4, g0: 4.8, win: 'ped', balc: 'nobile', ground: 'blind', corn: 0.5, col: '#e6e2d8', grime: 0.2,
    src: 'https://commons.wikimedia.org/wiki/File:Palermo-Palazzo-Arcivescovile-bjs-1.jpg' },
  // Ochre-orange plaster, one continuous balustraded balcony on the piano nobile, pedimented windows, shuttered ground-floor windows.
  'w249119795': { name: 'Palazzo Asmundo', style: 'bar', floors: 4, g0: 5.5, nobH: 6.2, win: 'ped', balc: 'cont', ground: 'blind', corn: 0.6, col: '#d9a86a', grime: 0.35,
    src: 'https://commons.wikimedia.org/wiki/File:Palazzo_asmundo.jpg' },
  // Eroded golden tufa with plaster patches, small balconies, arched portal.
  'w279881853': { name: 'Palazzo Conte Federico', style: 'bar', floors: 3, g0: 5.0, win: 'rect', balc: 'alt', ground: 'rustic', portal: { bay: 1 }, corn: 0.3, stone: true, col: '#b69362', grime: 0.8,
    src: 'https://commons.wikimedia.org/wiki/File:Palazzo_Conte_Federico_02.jpg' },
  // Pale grey-white stone, arched upper windows, central ground-floor portico.
  'w558123501': { name: 'Monte di Pieta (Banca Carige)', style: 'bar', floors: 3, g0: 5.6, win: 'arch', balc: 'none', ground: 'blind', portal: { bay: 3 }, corn: 0.7, col: '#dad6ca', grime: 0.2,
    src: 'https://commons.wikimedia.org/wiki/File:Piazza_Monte_Piet%C3%A0,_Palermo_2026.jpg' },
  // The hand-drawn facades (src/hero-facades.js) that replace the photo walls. `bl` lists the layer of every bay as the wall reads from the street, left to right.
  // Palazzo Belmonte Riso, Corso Vittorio Emanuele: golden stone, an arcade of five arches with a portal between two columns, tall pedimented windows over a continuous balcony, small windows on iron balconies.
  'w926546486': { name: 'Palazzo Belmonte Riso', style: 'bar', floors: 3, g0: 6.0, nobH: 7.3, balc: 'none', corn: 0.9, stone: true, col: '#d9b774', grime: 0.35,
    walls: { 5: { bays: 5, bl: { ground: ['hr_riso_ga', 'hr_riso_ga', 'hr_riso_gp', 'hr_riso_ga', 'hr_riso_ga'], nob: ['hr_riso_nt', 'hr_riso_ns', 'hr_riso_na', 'hr_riso_ns', 'hr_riso_nt'], up: ['hr_riso_t'] } } },
    src: 'https://commons.wikimedia.org/wiki/File:Palazzo_Belmonte_Riso_Palermo_2024-07-26_11.52.14.jpg' },
  // Palazzo Valguarnera-Gangi, Piazza Croce dei Vespri: cream plaster, terracotta pilasters and frames, a frieze of white swags, a central portal with columns and arms.
  'r4779709.0': { name: 'Palazzo Valguarnera-Gangi', style: 'bar', floors: 3, g0: 4.6, nobH: 7.2, balc: 'none', corn: 0.7, col: '#f4ebd6', grime: 0.3,
    walls: { 8: { bays: 5, bl: { ground: ['hr_gangi_gs', 'hr_gangi_gw', 'hr_gangi_gp', 'hr_gangi_gw', 'hr_gangi_gd'], nob: ['hr_gangi_nt', 'hr_gangi_ns', 'hr_gangi_nm', 'hr_gangi_ns', 'hr_gangi_nt'], up: ['hr_gangi_u'] } } },
    src: 'https://commons.wikimedia.org/wiki/File:Palazzo_Gangi_(Palermo)_14_07_2024_01.jpg' },
  // Grand Hotel Piazza Borsa (the former Cassa Centrale di Risparmio): rusticated ground floor of round arches, pedimented windows between pilasters, the bank's name in a frieze, a balustraded cornice.
  'w182675995': { name: 'Grand Hotel Piazza Borsa', style: 'bar', floors: 4, g0: 6.0, nobH: 6.4, balc: 'none', corn: 1.1, stone: true, col: '#dccfae', grime: 0.4,
    walls: { 8: { bays: 8, bl: { ground: ['hr_borsa_g'], nob: ['hr_borsa_n'], up: ['hr_borsa_s'], top: ['hr_borsa_t0', 'hr_borsa_t1', 'hr_borsa_t2', 'hr_borsa_t3', 'hr_borsa_t4', 'hr_borsa_t5', 'hr_borsa_t6', 'hr_borsa_t7'] } } },
    src: 'https://commons.wikimedia.org/wiki/File:Cassa_di_Risparmio_(Palermo).jpg' },
  // Teatro Biondo, Via Roma: grey-beige stone, a rusticated ground floor of arches (the middle one a lit entrance), a piano nobile of tall round-arched windows between pilasters.
  'w143740363': { name: 'Teatro Biondo', style: 'bar', floors: 3, g0: 5.5, nobH: 8.2, balc: 'none', corn: 0.9, stone: true, col: '#d3c6aa', grime: 0.4,
    walls: { 1: { bays: 9, bl: { ground: ['hr_biondo_g', 'hr_biondo_g', 'hr_biondo_g', 'hr_biondo_g', 'hr_biondo_gc', 'hr_biondo_g', 'hr_biondo_g', 'hr_biondo_g', 'hr_biondo_g'], nob: ['hr_biondo_n'], up: ['hr_biondo_u'] } } },
    src: 'https://commons.wikimedia.org/wiki/File:Facciata_del_Teatro_Biondo.jpg' },
  // Villa Malfitano: pale stone, a four-column portico with a terrace over it, shuttered windows with moulded frames in the wings.
  'w250508063': { name: 'Villa Malfitano', style: 'bar', floors: 2, g0: 6.0, nobH: 8.6, balc: 'none', corn: 0.8, col: '#e6dcc4', grime: 0.4, wtol: 6.5,
    walls: { 7: { bays: 7, bl: { ground: ['hr_malf_w', 'hr_malf_w', 'hr_malf_pl', 'hr_malf_pc', 'hr_malf_pr', 'hr_malf_w', 'hr_malf_w'], nob: ['hr_malf_wu', 'hr_malf_wu', 'hr_malf_ul', 'hr_malf_uc', 'hr_malf_ur', 'hr_malf_wu', 'hr_malf_wu'], up: ['hr_malf_wu'] } } },
    src: 'https://commons.wikimedia.org/wiki/File:Villa_Malfitano_-_Fa%C3%A7ade_.jpg' },
  // Grand Hotel et des Palmes: cream-yellow facade of five storeys, small iron balconies on the wings, a centre block with a balustraded balcony and an entrance canopy.
  'w278478513': { name: 'Grand Hotel et des Palmes', style: 'n19', floors: 5, g0: 4.4, nobH: 3.9, balc: 'none', corn: 0.6, col: '#f0e2ac', grime: 0.3,
    walls: { 2: { bays: 16, bl: {
      ground: ['hr_palm_gw', 'hr_palm_gw', 'hr_palm_gw', 'hr_palm_gw', 'hr_palm_gw', 'hr_palm_gh', 'hr_palm_gh', 'hr_palm_ge', 'hr_palm_ge', 'hr_palm_gh', 'hr_palm_gh', 'hr_palm_gw', 'hr_palm_gw', 'hr_palm_gw', 'hr_palm_gw', 'hr_palm_gw'],
      nob: ['hr_palm_w', 'hr_palm_w', 'hr_palm_w', 'hr_palm_w', 'hr_palm_w', 'hr_palm_c', 'hr_palm_c', 'hr_palm_cb', 'hr_palm_cb', 'hr_palm_c', 'hr_palm_c', 'hr_palm_w', 'hr_palm_w', 'hr_palm_w', 'hr_palm_w', 'hr_palm_w'],
      up: ['hr_palm_w', 'hr_palm_w', 'hr_palm_w', 'hr_palm_w', 'hr_palm_w', 'hr_palm_c', 'hr_palm_c', 'hr_palm_c', 'hr_palm_c', 'hr_palm_c', 'hr_palm_c', 'hr_palm_w', 'hr_palm_w', 'hr_palm_w', 'hr_palm_w', 'hr_palm_w'] } } },
    src: 'https://commons.wikimedia.org/wiki/File:Grand_Hotel_et_des_Palmes_(Palermo)_-_Fa%C3%A7ade.jpg' },
  // Palazzo Jung, Via Lincoln: a long white neoclassical front, brown shutters, small iron balconies on the middle floors, an arched central portal.
  'w279882476': { name: 'Palazzo Jung', style: 'n19', floors: 4, g0: 4.5, nobH: 4.3, balc: 'none', corn: 0.7, col: '#f0ece0', grime: 0.25,
    walls: { 10: { bays: 13, bl: {
      ground: ['hr_jung_g', 'hr_jung_g', 'hr_jung_g', 'hr_jung_g', 'hr_jung_g', 'hr_jung_g', 'hr_jung_gp', 'hr_jung_g', 'hr_jung_g', 'hr_jung_g', 'hr_jung_g', 'hr_jung_g', 'hr_jung_g'],
      nob: ['hr_jung_n', 'hr_jung_ns', 'hr_jung_n', 'hr_jung_ns', 'hr_jung_n', 'hr_jung_ns', 'hr_jung_n', 'hr_jung_ns', 'hr_jung_n', 'hr_jung_ns', 'hr_jung_n', 'hr_jung_ns', 'hr_jung_n'],
      up: ['hr_jung_u'], top: ['hr_jung_t'] } } },
    src: 'https://commons.wikimedia.org/wiki/File:Palermo,_Palazzo_Jung_01.jpg' },
};
