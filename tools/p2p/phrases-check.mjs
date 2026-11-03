// Every phrase is in exactly one wheel category, every category has at most 8 entries (what the wheel can lay out), indexes exist.
//   node tools/p2p/phrases-check.mjs
import { PHRASES, CATEGORIES } from '../../src/p2p/phrases.js';
const seen = new Map(); let bad = 0;
for (const c of CATEGORIES) {
  const n = c.phrases.length + (c.drinks ? c.drinks.length : 0);
  if (n > 8) { console.log('too many entries in', c.id, n); bad++; }
  for (const i of c.phrases) { if (!(i >= 0 && i < PHRASES.length)) { console.log('no such phrase', i, 'in', c.id); bad++; } seen.set(i, (seen.get(i) || 0) + 1); }
}
PHRASES.forEach((s, i) => { if (seen.get(i) !== 1) { console.log('phrase', i, JSON.stringify(s), 'is in', seen.get(i) || 0, 'categories'); bad++; } });
console.log(bad ? 'FAIL' : `OK: ${PHRASES.length} phrases in ${CATEGORIES.length} categories`);
process.exit(bad ? 1 : 0);
