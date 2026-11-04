// The table of a tools/perf/cpuprofile.mjs run, or two side by side:   node tools/perf/table.mjs <out dir> <label> [<other label>]
import fs from 'node:fs';
import path from 'node:path';

const [dir, ...labels] = process.argv.slice(2);
const SCENES = ['qc', 'maqueda', 'ballaro', 'viale', 'mondello'], TITLE = { qc: 'QC standing', maqueda: 'Maqueda drive', ballaro: 'Ballaro drive', viale: 'Viale fast', mondello: 'Mondello' };
const load = (l, s, c) => { try { return JSON.parse(fs.readFileSync(path.join(dir, `${l}-${s}-${c}x.json`))); } catch { return null; } };
const sys = (R, re) => R.cpuProfile.systems.filter(([k]) => re.test(k)).reduce((a, [, v]) => a + v, 0);
const COLS = [
  ['fps', R => R.timing.fps],
  ['main ms/fr', R => R.timing.mainMsPerFrame],
  ['render', R => sys(R, /^render \[drunk/).toFixed(1)],
  ['world', R => sys(R, /^update \[world/).toFixed(2)],
  ['crowd', R => (sys(R, /pedestrians/)).toFixed(2)],
  ['traffic', R => sys(R, /traffic/).toFixed(2)],
  ['map', R => sys(R, /minimap/).toFixed(2)],
  ['work p99', R => R.timing.workP99],
  ['work max', R => R.timing.workMax],
  ['>33/>50 ms', R => `${R.trace.longOver33}/${R.trace.longOver50}`],
  ['GC ms (worst)', R => `${R.trace.gcMs} (${R.trace.gcWorst})`],
  ['style+layout', R => (R.trace.styleMsPerFrame + R.trace.layoutMsPerFrame).toFixed(2)],
  ['KB/s', R => R.alloc.kbPerSec],
  ['people', R => R.crowd.peds],
];
console.log(`| label | scene | CPU | ${COLS.map(c => c[0]).join(' | ')} |`);
console.log(`|${'---|'.repeat(COLS.length + 3)}`);
for (const c of [4, 6]) for (const s of SCENES) for (const l of labels) {
  const R = load(l, s, c); if (!R || R.failed) continue;
  console.log(`| ${l} | ${TITLE[s]} | ${c}x | ${COLS.map(k => k[1](R)).join(' | ')} |`);
}
