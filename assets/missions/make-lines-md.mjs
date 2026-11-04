// Regenerates assets/missions/lines.md (review copy for the owner) from lines.js: node assets/missions/make-lines-md.mjs
import { writeFileSync } from 'node:fs';
import * as L from './lines.js';
import { FARE_SPOTS } from '../../src/event-places.js';
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
const pairs = (title, arr) => { out.push(title, ''); for (const [t, g] of arr) out.push(`- ${t}  \n  _${g}_`); out.push(''); };
out.push('# Night (after dark, new)', '');
out.push('## Easter egg "u spacciaturi" (stop a few seconds in Ballarò, Vucciria, Capo, Zisa or Noce at night)', '');
pairs('### the hooded guy (owner\'s line, kept as is)', [L.SPACCIA.hail]);
pairs('### the driver answers (dismissive, no drugs mechanics: you can only drive off)', L.SPACCIA.driver);
out.push('## Night mission "A Favorita" (needs ?world=1)', '');
for (const [k, arr] of Object.entries(L.FAVORITA.client)) pairs(`### client: ${k}`, arr);
for (const [k, arr] of Object.entries(L.FAVORITA.driver)) pairs(`### driver: ${k}`, arr);
pairs('### the glam night folk on the avenue greet him', L.FAVORITA.chorus);
out.push('## Two more night clients (Via Lincoln, Via Bandiera)', '');
for (const [id, o] of Object.entries(L.NIGHT_CLIENTS)) { for (const [k, arr] of Object.entries(o.client)) pairs(`### ${id} client: ${k}`, arr); for (const [k, arr] of Object.entries(o.driver)) pairs(`### ${id} driver: ${k}`, arr); }
out.push('## The horns mission (Arco di Cutò)', '');
for (const [k, arr] of Object.entries(L.HORNS_LINES)) pairs(`### ${k}`, arr);
out.push('## The landfill mission (Bellolampo; the title is the owner\'s, the lines are drafts)', '');
for (const [k, arr] of Object.entries(L.DUMP_LINES)) pairs(`### ${k}`, arr);
out.push('## Pollanche (Santuario di Santa Rosalia, needs ?world=1)', '');
pairs('### cries', L.POLLANCHE.cry); pairs('### when serving', L.POLLANCHE.serve);
out.push('## U Barettu (granita kiosk, Piazza Valdesi in Mondello, needs ?world=1)', '');
pairs('### cries', L.GRANITA.cry); pairs('### when serving', L.GRANITA.serve); pairs('### the driver after the granita', L.GRANITA.driver); pairs('### the toast', [L.GRANITA.toast]);
out.push('## "Pezzo nni Ganci" (the Ganci branches, src/friend-places.js; drafts for the owner)', '');
pairs('### cries', L.GANCI.cry); pairs('### when serving', L.GANCI.serve); pairs('### the driver after the pezzo', L.GANCI.driver); pairs('### the toast', [L.GANCI.toast]);
out.push('## "A preghiera alla Santuzza" (the shrine of the Santuario and the Festino carro; drafts)', '');
pairs('### what the driver says while praying', L.PREGHIERA.pray); pairs('### after the blessing', L.PREGHIERA.amen); pairs('### while the cooldown runs', [L.PREGHIERA.cool]);
pairs('### the toast when there was something to forgive', [[L.PREGHIERA.toastDone[0], L.PREGHIERA.toastDone[1][0] + ' / ' + L.PREGHIERA.toastDone[1][1]]]); pairs('### the toast when there was nothing', [[L.PREGHIERA.toastNone[0], L.PREGHIERA.toastNone[1][0] + ' / ' + L.PREGHIERA.toastNone[1][1]]]);
out.push('## "Cornetto i menzannuatti" (the night kiosks; drafts)', '');
pairs('### cries', L.CORNETTO.cry); pairs('### when serving', L.CORNETTO.serve); pairs('### the driver after the cornetto', L.CORNETTO.driver); pairs('### the toast', [L.CORNETTO.toast]);
out.push('## Appartati (parked cars with steamed windows, Pellegrino and Favorita, needs ?world=1)', '');
pairs('### what they yell when the headlights or the horn hit them', L.APPARTATI.yell);
out.push('## Free roam events: callers, "a pulle" tourists, urgent passengers, food sellers', '');
for (const [k, arr] of Object.entries(L.CALL)) pairs(`### call: ${k}`, arr);
for (const [k, arr] of Object.entries(L.PULLE)) pairs(`### a pulle by day: ${k}`, arr);
for (const [k, arr] of Object.entries(L.URGENT_LINES)) pairs(`### urgent: ${k}`, arr);
for (const [k, arr] of Object.entries(L.FOOD)) pairs(`### food: ${k}`, arr);
out.push('## The clienti: mission titles (src/event-places.js FARE_SPOTS, `title`)', '');
for (const f of FARE_SPOTS) if (f.title) out.push(`- ${f.title}  \n  _${f.id}, ${f.name}_`);
out.push('');
out.push('## The clienti: a story each (draft, fare spot by fare spot)', '');
for (const [id, o] of Object.entries(L.STORIES)) {
  out.push(`### ${((FARE_SPOTS.find(f => f.id === id) || {}).title || id) + ` (${id})`}`, '');
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) pairs(`#### ${id}: ${k}`, v);
    else { out.push(`#### ${id}: ${k}`, ''); for (const [n, arr] of Object.entries(v)) for (const t of arr) out.push(`- (${n}) ${t}`); out.push(''); }
  }
}
out.push('## Vabbè u sai: variations of the night client of "a pulle"', '');
for (const [id, o] of Object.entries(L.FAVORITA_VARIANTS)) for (const [k, arr] of Object.entries(o)) pairs(`### ${id}: ${k}`, arr);
writeFileSync(new URL('./lines.md', import.meta.url), out.join('\n') + '\n');
