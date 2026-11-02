// The colour ramps (6 steps, dark to light) of the LPC generator's palettes, shared by the painters of extras.js: tools/lpc/lib.mjs fills them from the generator's palette files
// when the atlas is built, src/driver-compose.js from driver/driver.json when the driver creator runs in the browser.
let PAL = {};
export const setPalettes = p => { PAL = p; };
const hex2 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const ramp = (material, name) => { const r = PAL[material] && PAL[material][name]; if (!r) throw new Error(`no ${material} ramp ${name}`); return r.map(hex2); };
