// Stand-in for src/remotes.js in the stress bots: the same calls src/p2p/p2p.js makes, but nothing is built or drawn. Records are kept in a Map so the
// netcode's own checks (how many are shown, who is far) behave as in the game.
export const PLAYER_DOT = '#00e1ff';
export function createRemotes() {
  const remotes = new Map();
  const ensure = id => { let r = remotes.get(id); if (!r) { r = { id, name: '', livery: -1, far: false, info: null, snaps: [], have: false, shown: true, marker: { x: 0, z: 0 } }; remotes.set(id, r); } return r; };
  return {
    remotes, ensure,
    remove: id => { remotes.delete(id); },
    setInfo: (r, name, liv, type) => { if (r) r.info = [name, liv, type]; },
    setFar: (r, far) => { if (r) r.far = far; },
    addSnap: (r, s) => { r.snaps.push(s); if (r.snaps.length > 16) r.snaps.shift(); r.have = true; },
    retire() {}, dropAll: () => remotes.clear(), update() {}, say() {}, list: () => [],
  };
}
