// The icons of the two maps, drawn once: the round minimap (src/minimap.js) and the big map (src/startmap.js) both call drawIcon, so a
// thing looks the same on both. An icon is a coloured chip with a dark edge and a dark picture on it. At the size of a phone's minimap
// only the chip's shape and colour can be read, so those carry the meaning; the picture is for the big map and the larger minimaps.
//
// The shape of the chip says what kind of thing it is:
//   circle          a job to take (a caller on the minimap, an event pin on the big map)
//   triangle        an urgent fare
//   rounded square  somewhere to eat or drink (the food and pub jobs, the stalls)
//   chequered       a race
//   arch            a shrine
//   diamond         something to pick up during a job (in the job's colour)
//   target          where to go now (in the job's colour)
//   cross           a SUCA tag to spray
//   ring            another player
//   cassette        a tape (grey and faint once collected)
//
//   drawIcon(g, kind, x, y, r, { color, found, night, on })   centred on (x, y); r is half the icon's height in the canvas's own units

const INK = '#0b0709';
export const ICON_COLOR = {
  fare: '#ffc83d', urgent: '#ff4a3a', food: '#ff8a3d', pub: '#ffb02e', race: '#fdfdfd', rave: '#b16bff', leaf: '#7ad65a', horns: '#ffb02e', dump: '#8a6a3a', penna: '#3a8dde', carro: '#f5d77a',
  granita: '#59c9e8', grill: '#ff7a1a', ganci: '#ff5a36', shrine: '#f5d77a', friend: '#ff9ec4', arrotino: '#c9d3da',
  pickup: '#ffd24a', target: '#e8559a', suca: '#ff4fd8', player: '#00e1ff', tape: '#ffb347',
};
const SQUARE = new Set(['food', 'pub', 'granita', 'grill', 'ganci']);

function rrect(g, x, y, w, h, r) { if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }

// the picture, in a box of 24 units centred on the origin
function glyph(g, kind) {
  g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round';
  switch (kind) {   // every picture keeps clear of the chip's edge: inside 8 units of the centre on a circle, 7.5 on a square
    case 'fare': g.font = "700 14px 'Barlow Condensed', system-ui, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('€', 0, 0.5); break;
    case 'urgent': g.fillRect(-1.5, -4.5, 3, 7); g.fillRect(-1.5, 4.2, 3, 3); break;
    case 'food': g.beginPath(); g.moveTo(-5.5, -6); g.lineTo(5.5, -6); g.lineTo(0, 6.5); g.closePath(); g.fillStyle = '#7a2a12'; g.fill(); g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(-1, -2.6, 1.5, 0, 7); g.arc(1.6, -0.4, 1.2, 0, 7); g.fill(); break;
    case 'pub': g.lineWidth = 1.8; g.beginPath(); g.arc(2.6, 0.5, 3, -1.5, 1.5); g.stroke(); g.fillStyle = '#fff8e0'; g.fillRect(-6.5, -5.5, 9, 11); g.fillStyle = '#7a4a12'; g.fillRect(-6.5, -5.5, 9, 3.6); break;
    case 'rave': [6, 12, 10, 6].forEach((h, i) => g.fillRect(-7.4 + i * 4.1, -h / 2, 2.6, h)); break;
    case 'leaf': g.beginPath(); g.ellipse(0, 0, 3.8, 7.4, 0.6, 0, 7); g.fill(); break;
    case 'horns': g.lineWidth = 2.6; g.beginPath(); g.moveTo(-5, -5.5); g.quadraticCurveTo(-5.5, 4, 0, 4.5); g.quadraticCurveTo(5.5, 4, 5, -5.5); g.stroke(); break;
    case 'dump': g.fillRect(-6.5, -5, 13, 2.4); g.beginPath(); g.moveTo(-5.6, -1.4); g.lineTo(-3.8, 5.5); g.lineTo(3.8, 5.5); g.lineTo(5.6, -1.4); g.closePath(); g.fill(); break;   // a bin: the lid, a gap, the body
    case 'penna': g.lineWidth = 3; g.beginPath(); g.moveTo(-3.6, 4.4); g.lineTo(4.4, -5.4); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.moveTo(-3.6, 4.4); g.lineTo(-5.4, 6.6); g.stroke(); break;   // a pen, nib down
    case 'carro': g.fillRect(-7, 1.5, 14, 3.6); g.beginPath(); g.moveTo(-3, 1.5); g.lineTo(-3, -5.2); g.lineTo(0, -7.8); g.lineTo(3, -5.2); g.lineTo(3, 1.5); g.closePath(); g.fill(); break;   // the float: a hull and a tower
    case 'granita': g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -1.6, 4.8, Math.PI, 0); g.closePath(); g.fill(); g.fillStyle = INK; g.beginPath(); g.moveTo(-5, -0.6); g.lineTo(5, -0.6); g.lineTo(2.8, 7); g.lineTo(-2.8, 7); g.closePath(); g.fill(); break;   // a cup with its heap of ice
    case 'grill': g.lineWidth = 1.8; g.beginPath(); g.moveTo(-6, 6); g.lineTo(6, -6); g.stroke(); for (const t of [-3.3, 0, 3.3]) { g.beginPath(); g.arc(t, -t, 2.4, 0, 7); g.fill(); } break;   // a skewer
    case 'ganci': g.lineWidth = 2.8; g.beginPath(); g.moveTo(3, -6.6); g.lineTo(3, 2.4); g.arc(-0.2, 2.4, 3.2, 0, Math.PI); g.stroke(); break;   // a butcher's hook
    case 'shrine': g.fillRect(-1.4, -5, 2.8, 12); g.fillRect(-4.4, -2, 8.8, 2.8); break;   // a cross
    case 'friend': g.beginPath(); g.arc(0, -3.6, 3.1, 0, 7); g.fill(); g.beginPath(); g.arc(0, 6.6, 5.4, Math.PI, 0); g.closePath(); g.fill(); break;   // head and shoulders
    case 'arrotino': g.rotate(-Math.PI / 4); g.fillRect(-7.8, -1.5, 5, 3); g.beginPath(); g.moveTo(-1.6, -2.3); g.lineTo(7.8, -2.3); g.lineTo(4.6, 1.9); g.lineTo(-1.6, 1.9); g.closePath(); g.fill(); break;   // the knife he sharpens: handle and blade
  }
}

export function drawIcon(g, kind, x, y, r, o = {}) {
  const col = o.color || ICON_COLOR[kind] || '#e8559a', s = r / 12;
  g.save(); g.translate(x, y); g.scale(s, s);
  g.lineJoin = 'round'; g.lineCap = 'butt'; g.fillStyle = col; g.strokeStyle = o.night ? '#1d2a5a' : INK; g.lineWidth = Math.max(o.night ? 3 : 2.2, 1.5 / s);   // the edge never thinner than 1.5 px
  if (kind === 'tape') {
    if (o.found) { g.globalAlpha *= 0.5; g.fillStyle = '#b9b2ad'; }
    g.beginPath(); g.rect(-12, -8, 24, 16); g.fill(); g.stroke();
    g.fillStyle = o.found ? '#e6e1dc' : '#fff3d6'; g.fillRect(-9.5, -5.5, 19, 5);
    g.fillStyle = INK; for (const d of [-1, 1]) { g.beginPath(); g.arc(d * 5.3, 3.2, 2.6, 0, 7); g.fill(); }
  } else if (kind === 'suca') {
    g.beginPath(); g.moveTo(-9, -9); g.lineTo(9, 9); g.moveTo(9, -9); g.lineTo(-9, 9); g.lineCap = 'round';
    g.lineWidth = Math.max(8, 4.5 / s); g.stroke(); g.strokeStyle = col; g.lineWidth = Math.max(4, 2.2 / s); g.stroke();
  } else if (kind === 'player') {
    g.beginPath(); g.arc(0, 0, 9, 0, 7); g.lineWidth = Math.max(7, 6.5 / s); g.strokeStyle = INK; g.stroke(); g.lineWidth = Math.max(3.6, 3.4 / s); g.strokeStyle = col; g.stroke();
  } else if (kind === 'target') {
    g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fillStyle = '#fff'; g.fill(); g.stroke();
    g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fillStyle = col; g.fill(); g.stroke();
  } else if (kind === 'pickup') {
    g.beginPath(); g.moveTo(0, -13); g.lineTo(10.5, 0); g.lineTo(0, 13); g.lineTo(-10.5, 0); g.closePath(); g.fill(); g.stroke();
  } else {
    g.beginPath();
    if (kind === 'urgent') { g.moveTo(0, -13); g.lineTo(13, 10); g.lineTo(-13, 10); g.closePath(); }
    else if (SQUARE.has(kind)) rrect(g, -11, -11, 22, 22, 6);
    else if (kind === 'race') g.rect(-11, -11, 22, 22);
    else if (kind === 'shrine') { g.moveTo(-9, 12); g.lineTo(-9, -3); g.arc(0, -3, 9, Math.PI, 0); g.lineTo(9, 12); g.closePath(); }
    else g.arc(0, 0, 12, 0, 7);
    g.fill();
    if (kind === 'race') { g.save(); g.fillStyle = INK; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) & 1) g.fillRect(-11 + i * 5.5, -11 + j * 5.5, 5.5, 5.5); g.restore(); }   // the chip is the flag: the chequers run to the edge, under the outline
    g.stroke();
    glyph(g, kind);
    if (o.night) { g.fillStyle = '#c8d4ff'; g.beginPath(); g.arc(12, -12, 6, 0, 7); g.fill(); g.fillStyle = '#1d2a5a'; g.beginPath(); g.arc(14.5, -13.5, 5, 0, 7); g.fill(); }
    if (o.on) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 14.5, 0, 7); g.stroke(); }
  }
  g.restore();
}
