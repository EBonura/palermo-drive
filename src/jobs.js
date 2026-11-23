// The job modules of the director (src/mission-director.js, docs/missions-director.md): one file per new mission type, each loaded on its own so that one that fails
// leaves the others and the game alone. loadJobs(X) is called once by src/missions.js when the director exists; a module's default export is setup(X).
const MODULES = [
  () => import('./job-hit.js'),         // hit so many people
  () => import('./job-quiet.js'),       // the quiet job, by night in the worst quarters
  () => import('./job-delivery.js'),    // Tekkamancia deliveries
  () => import('./job-roadworks.js'),   // streets closed for works
  () => import('./job-pedalo.js'),      // the pedalò of Mondello
  () => import('./job-festino.js'),     // the Festino di Santa Rosalia
  () => import('./job-wanderer.js'),    // the Sicilian Wanderer: a drive for his video, and back to do it again
];
export function loadJobs(X) {
  for (const load of MODULES) load().then(m => m.default(X)).catch(e => { if (X.params.has('debug')) console.warn('[missions] job module not loaded:', e && e.message); });
}
