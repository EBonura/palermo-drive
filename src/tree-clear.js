// Ground the generic trees of src/props.js keep clear of: [x, z, radius] in metres. A landmark that is a tree itself (the strangler figs of the Villa Garibaldi, src/lmc-g.js)
// is the one tree there; the generic lumps under its crown only hide its aerial roots.
export const TREE_CLEAR = [
  [648, -224, 24],   // the giant fig, crown about 40 m wide
  [704, -168, 16],   // and the second one
];
export const treeCleared = (x, z) => { for (const c of TREE_CLEAR) if (Math.hypot(x - c[0], z - c[1]) < c[2]) return true; return false; };
