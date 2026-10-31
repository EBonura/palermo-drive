// Regenerates assets/missions/lines.md (review copy for the owner) from lines.js: node assets/missions/make-lines-md.mjs
import { writeFileSync } from 'node:fs';
import * as L from './lines.js';
const out = [];
out.push('# Lines to review', '', 'Generated from `lines.js` (edit there, then run `node assets/missions/make-lines-md.mjs`).',
  'Driver and vendor lines are Palermitan/Italian with an English gloss. Please correct spelling and idiom: anything marked (?) is one I am less sure of.', '');
out.push('## Driver (Palermitan)', '');
for (const [k, arr] of Object.entries(L.DRIVER)) { out.push(`### ${k}`, ''); for (const [t, g] of arr) out.push(`- ${t}  \n  _${g}_`); out.push(''); }
out.push('## Stigghiulari street cries', '');
for (const [t, g] of L.VENDOR) out.push(`- ${t}  \n  _${g}_`);
out.push('', '### when serving', '');
for (const [t, g] of L.VENDOR_SERVE) out.push(`- ${t}  \n  _${g}_`);
out.push('', '## Tourists (English clichés per nationality)', '');
for (const [k, o] of Object.entries(L.TOURIST)) { out.push(`### ${k}`, ''); for (const [n, arr] of Object.entries(o)) for (const t of arr) out.push(`- (${n}) ${t}`); out.push(''); }
writeFileSync(new URL('./lines.md', import.meta.url), out.join('\n') + '\n');
