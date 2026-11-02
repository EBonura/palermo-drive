// Writes assets/peds/lpc/CREDITS.md and LICENSE.md from CREDITS.json (the layers the atlas uses, as the generator's own credits export lists them): node tools/lpc/credits.mjs
import fs from 'fs'; import path from 'path'; import { ROOT, PIN } from './lib.mjs';
const OUT = process.argv[2] || path.join(ROOT, 'assets/peds/lpc'), c = JSON.parse(fs.readFileSync(path.join(OUT, 'CREDITS.json'), 'utf8'));
const permOpt = L => L.filter(x => /^(CC0|OGA-BY|CC-BY( |$))/.test(x)), isPerm = L => permOpt(L).length > 0, onlyPerm = L => L.every(x => /^(CC0|OGA-BY|CC-BY( |$))/.test(x)), cc0 = L => L.length === 1 && L[0] === 'CC0';
const lines = ['# Pedestrian sprites (LPC): credits', '', `The people of Palermo Drive are composed from layers of the [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) (commit ${PIN}), whose art comes from the Liberated Pixel Cup and many contributors on OpenGameArt, with our own painted details on top (see LICENSE.md).`, 'Every layer used is listed with its authors, the licences its authors offer it under, and its source. Where a layer is offered under a permissive licence (CC0, CC-BY or OGA-BY) as well as CC-BY-SA / GPL, we use it under the permissive one (shown in the last column); no layer used is share-alike only. All of them require credit, given here and in the game\'s credits.', ''];
lines.push('| Layer | Authors | Licences offered | Used under | Links |', '| --- | --- | --- | --- | --- |');
for (const e of c.sort((a, b) => a.file.localeCompare(b.file))) lines.push(`| \`${e.file}\` | ${e.authors.join(', ')} | ${e.licenses.join(', ')} | ${permOpt(e.licenses).join(', ') || '**share-alike only**'} | ${(e.urls || []).map(u => `[link](${u})`).join(' ')} |`);
lines.push('', 'Our own additions (caps and hats, the fazzoletto, glasses, stubble, band logos, tattoos, vest patches, scarves, bags, bottles, the dog, the pram, the wheelchair rider placement, the dungaree bib of the mechanic, spanner and rag) are painted by the Palermo Drive authors in `tools/lpc/extras.mjs`.');
fs.writeFileSync(path.join(OUT, 'CREDITS.md'), lines.join('\n') + '\n');
const sa = c.filter(e => !isPerm(e.licenses)), mixed = c.filter(e => isPerm(e.licenses) && !onlyPerm(e.licenses));
fs.writeFileSync(path.join(OUT, 'LICENSE.md'), `# Licence of assets/peds/lpc

This folder holds third-party art (layers of the Universal LPC Spritesheet Character Generator, composed into atlas.png and garage.png) and our own painted layers on top. It is NOT covered by the licence of the rest of the repository.

- Every layer keeps its authors' licences, listed in CREDITS.md, and credit is required for all of them.
- ${c.length} layers are used: ${c.filter(e => cc0(e.licenses)).length} are CC0 only, ${c.filter(e => onlyPerm(e.licenses) && !cc0(e.licenses)).length} are permissive only (CC-BY / OGA-BY), ${mixed.length} are offered under a permissive licence (OGA-BY or CC-BY) as well as CC-BY-SA / GPL (we use the permissive one), and ${sa.length} are share-alike only${sa.length ? ': ' + sa.map(e => '`' + e.file + '`').join(', ') : ''}.
- Some of the layers offered under OGA-BY were also made by authors who contributed CC-BY-SA / GPL work to the same base. To stay on the safe side, treat atlas.png, garage.png, and anything derived from it, as available under CC-BY-SA 3.0 (or later) or GPL 3.0 (or later) as well, and keep the credits. This is kept to this folder; the game's code is not affected.
- Our own painted additions are released under the same terms as the atlas, so that any share-alike part stays in this one folder.
- The source layers (build inputs, same terms) are kept in tools/lpc/layers and are not shipped with the game; rebuild the atlas with \`node tools/lpc/build.mjs\`.
`);
console.log('credits ok;', c.length, 'layers,', sa.length, 'share-alike only', sa.map(e => e.file).join(', '), '| mixed', mixed.length);
