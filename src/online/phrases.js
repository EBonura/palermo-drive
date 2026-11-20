// The things a player can say to the others (no free text). Only the index travels; the receiver looks the words up here.
// Palermitan spelling as the owner wrote it; do not "correct" it. Append new phrases at the end: the index is the wire format.
export const PHRASES = [
  'cuinnutu',
  'ciao curò',
  'bba ieccati',
  'ciao sagnò',
  'fraaaagola',
  'tu puazzu offriri un cottel?',
  'sagnu mio ra me vita',
  'ue cucì appo\'?',
  'chi ssi rici?',
  'talé cu c\'è',
  'vie\' camina cu mmia',
  'minchia chi ssì llariu',
  'grazzi curò',
  'ni viriamu!',
  'chi bedda jurnata!',
  'runni minchia vai?',
  'ammuninni!',
  'amunì',
  'mi scusassi, un t’avia vistu',
  'assabbinirica',
  'talìa chi beddu!',
  'ti manciassi!',
  'biedda matzi!',
  'sì u meggh\'i tutti!',
  'a to saluti!',
  'saluti e figghi masculi!',
  'viviemu cucì',
  'a birra l’offru iu',
  'canziati',
];

// The wheel (src/p2p/wheel.js) sorts the phrases into categories. Indexes into PHRASES, so a spelling change above cannot break it; every phrase is in
// exactly one category (tools/p2p/phrases-check.mjs). The category names and the grouping are a first guess for the owner to rearrange.
// `drinks` are the two real offers (cicchetto, birra), listed with the toasts in the same category.
export const CATEGORIES = [
  { id: 'saluti', icon: '👋', it: 'Saluti', en: 'Hellos', phrases: [1, 3, 7, 8, 9, 6, 12, 13] },
  { id: 'complimenti', icon: '😍', it: 'Complimenti', en: 'Compliments', phrases: [20, 22, 23, 21, 11, 14] },
  { id: 'brindisi', icon: '🍻', it: 'Brindisi e da bere', en: 'Toasts and drinks', phrases: [5, 27, 24, 25, 26], drinks: [0, 1] },
  { id: 'strada', icon: '🚗', it: 'In strada', en: 'On the road', phrases: [16, 17, 10, 15, 18, 4] },
  { id: 'sfotto', icon: '😈', it: 'Sfottò', en: 'Banter', phrases: [0, 2, 19, 28] },
];
