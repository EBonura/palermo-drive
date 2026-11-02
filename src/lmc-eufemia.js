// City landmarks: the sign of the Hotel Eufemia in Isola delle Femmine, the destination of the "U cuinnutu" fare (docs/cuinnutu.md). Registered in src/landmarks-city.js.
// The hotel itself is not modelled: it is the generic building w1211538241 of the tiles (OSM building=hotel, no name, 18 m, 774 m2), 35 m back from Via Nazionale (SS113) behind a car park,
// 3 minutes' walk from the railway station, about 20 m from the coordinate the Kayak page of the Hotel Eufemia gives (38.19337, 13.25114). The model only adds what says the name:
// a sign board on the wall that faces the road, and a blade sign on posts at the mouth of the car park lane. Nothing else is said about the hotel: no stars, no details.
// Measured on the tile footprint (tile -20_-18): the wall that faces the road runs from (-9655, -8573) to (-9641, -8595), 26 m long, its outward normal points to the road (east).
import { begin, end, defMat, panel, box, bx, frame, groundY } from './lmc-kit.js';

const A = [-9655, -8573], B = [-9641, -8595];   // the wall of the hotel that faces Via Nazionale
const WL = Math.hypot(B[0] - A[0], B[1] - A[1]), WN = [(B[1] - A[1]) / WL * -1, (B[0] - A[0]) / WL];   // unit normal out of the wall, towards the road
const WM = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
const BLADE = { x: -9615.5, z: -8589.5, t: [-0.21, 0.98] };   // the blade sign: 7.5 m off the middle of Via Nazionale (the road point is (-9610.4, -8576.3), 10 m wide), 12 m up the road from the car park lane

function paintSign(g, w, h) {
  g.fillStyle = '#22385c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#e9e2cf'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#e9e2cf'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 150; do { g.font = `700 ${fs}px Arial, Helvetica, sans-serif`; fs -= 4; } while (g.measureText('HOTEL EUFEMIA').width > w - 90);
  g.fillText('HOTEL EUFEMIA', w / 2, h / 2 + 4);
}

function buildEufemia() {
  defMat('euSign', 1024, 180, [1, 1], paintSign, { roughness: 0.6 });
  defMat('euPost', 0, 0, [1, 1], null, { roughness: 0.8 });
  begin(groundY(WM[0], WM[1]));
  // the board on the wall, near the top: a dark backing a hand's width off the plaster, the lettering in front of it
  const gy = groundY(WM[0], WM[1]), M = frame(WM[0] + WN[0] * 0.2, gy + 12.0, WM[1] + WN[1] * 0.2, WN[0], WN[1]);
  bx('euPost', M, -5.9, 5.9, 0, 2.1, -0.1, 0.1, { c: '#1a1e26', noao: true });
  panel('euSign', 11.4, 1.9, { M: frame(WM[0] + WN[0] * 0.32, gy + 12.1, WM[1] + WN[1] * 0.32, WN[0], WN[1]), noao: true });
  // the blade sign: two posts and a board, readable from both ways along the road
  const by = groundY(BLADE.x, BLADE.z), tl = Math.hypot(BLADE.t[0], BLADE.t[1]), tx = BLADE.t[0] / tl, tz = BLADE.t[1] / tl;
  for (const s of [-1, 1]) box('euPost', 0.14, 2.7, 0.14, { p: [BLADE.x - tz * s * 1.9, by, BLADE.z + tx * s * 1.9], c: '#2b2d33', noao: true });
  bx('euPost', frame(BLADE.x, by + 2.0, BLADE.z, tx, tz), -2.2, 2.2, 0, 0.8, -0.06, 0.06, { c: '#1a1e26', noao: true });
  panel('euSign', 4.2, 0.74, { M: frame(BLADE.x + tx * 0.07, by + 2.03, BLADE.z + tz * 0.07, tx, tz), noao: true });
  panel('euSign', 4.2, 0.74, { M: frame(BLADE.x - tx * 0.07, by + 2.03, BLADE.z - tz * 0.07, -tx, -tz), noao: true });
  return end('Hotel Eufemia sign');
}

export const EUFEMIA = { name: 'Hotel Eufemia (sign)', x: (WM[0] + BLADE.x) / 2, z: (WM[1] + BLADE.z) / 2, radius: 40, skipIds: [], build: buildEufemia };
