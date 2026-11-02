// The one HTML escaper of the game: text that is not ours (OSM names, credits, saved names) goes through esc() before it is put in an innerHTML template string.
// Escapes & < > " and ' so a value is safe in element text and in a double- or single-quoted attribute. See docs/SECURITY.md.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s).replace(/[&<>"']/g, c => MAP[c]);
