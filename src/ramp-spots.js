// Where the ramps stand and what shape they are (src/ramps.js draws and drives them). Data and arithmetic only, no imports, so the props (src/props.js, no parked cars inside a
// work zone) and the traffic (src/main.js, cars steer round the zone) can read the same list.
//
// kinds: profile = [s, height] points along the ramp from its foot (metres, linear between them, nothing before the first and after the last: the end is a cliff, the lip the lapa
// leaves from), w = width. The tilt never goes over 0.25 (the steepest climb the lapa's slope limit lets through is 0.7).
export const KINDS = {
  ramp: { w: 4.6, profile: [[0, 0], [10, 2.2]] },
  truck: { w: 3.2, profile: [[0, 0], [6, 1.25], [16, 2.55]] },
};
export const ZONE_BEFORE = 6, ZONE_AFTER = 3;   // metres of road works in front of the foot and behind the lip: barriers on both flanks, cones, a sign

// A ramp stands on the RIGHT of its street (looking the way the lapa climbs, the way the traffic of that side goes), as road works on the right lane do, with its right edge
// KERB_GAP from the kerb. Each: x, z of the middle of the street, heading in radians (0 = facing south; forward is (sin th, cos th)), kind, how far the right kerb is from the
// middle (metres, measured in the game with the kerb mask on a straight stretch at least 10 m wide, flat), where.
export const KERB_GAP = 0.9;
export const SPOTS = [
  [976.9, -322.6, -2.602, 'ramp', 7.25, 'Foro Italico'],
  [940.9, -382.7, -2.602, 'truck', 7.25, 'Foro Italico, 70 m on: a car transporter trailer'],
  [1035.1, 221.2, 2.105, 'ramp', 5.75, 'Via Abramo Lincoln'],
  [1189.3, 128.2, 2.105, 'truck', 7.5, 'Via Abramo Lincoln, further on: a car transporter trailer'],
  [753.3, -437.6, 2.103, 'ramp', 6.5, 'Via della Cala'],
];

// the placed pieces: foot x, z, heading, kind, length, width, and the middle of the work zone with its length and width (for the traffic and the parked cars)
export function placed(list = SPOTS) {
  return list.map(([cx, cz, th, kind, kerb]) => {
    const K = KINDS[kind], L = K.profile[K.profile.length - 1][0], w = K.w, off = -(kerb - KERB_GAP - w / 2);   // off: along the street's right (negative local x)
    const sn = Math.sin(th), cs = Math.cos(th), x = cx + cs * off, z = cz - sn * off;
    const zl = L + ZONE_BEFORE + ZONE_AFTER, mid = (L + ZONE_AFTER - ZONE_BEFORE) / 2;
    return { x, z, th, kind, L, w, zx: x + sn * mid, zz: z + cs * mid, zl, zw: w + 1.6 };
  });
}
