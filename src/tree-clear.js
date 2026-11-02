// Ground the generic trees of src/props.js keep clear of: [x, z, radius] in metres. A landmark that is a tree itself (the strangler figs of the Villa Garibaldi, src/lmc-g.js)
// is the one tree there; the generic lumps under its crown only hide its aerial roots. The bollards that src/props.js sets along the edges of pavements keep clear of them too.
export const TREE_CLEAR = [
  [648, -224, 24],   // the giant fig, crown about 40 m wide
  [704, -168, 16],   // and the second one
  [279.5, 526.8, 3.6],   // the mouth of the Arco di Cutò (src/lmc-cuto.js): the OSM palm of the palace courtyard is mapped 4 m out in the street, and the bollards would stand across the way in
];
export const treeCleared = (x, z) => { for (const c of TREE_CLEAR) if (Math.hypot(x - c[0], z - c[1]) < c[2]) return true; return false; };
