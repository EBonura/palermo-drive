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
  // Piazza Croce dei Vespri: cream-ochre upper floors over a salmon base, pedimented windows, balconied piano nobile, central portal.
  'r4779709.0': { name: 'Palazzo Valguarnera-Gangi', style: 'bar', floors: 3, g0: 4.6, nobH: 5.4, win: 'ped', balc: 'nobile', ground: 'blind', portal: { bay: 2 }, corn: 0.7, col: '#e0cf98', grime: 0.3,
    src: 'https://commons.wikimedia.org/wiki/File:Piazza_Croce_dei_Vespri_Palazzo_Valguarnera_Gangi_Palermo.jpg' },
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
};
