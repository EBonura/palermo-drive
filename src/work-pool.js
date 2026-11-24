// A pool of Web Workers for work that does not touch the DOM or WebGL: run('atlas', payload, transferList) hands a named task (src/tasks.js) to an idle worker and resolves with its result, whose buffers
// came back by transfer, not by copy. The game never depends on it: with no Worker or no OffscreenCanvas, with ?workers=off (?workers=N asks for N workers instead of the size below), or when a worker cannot start (the file is blocked or missing, an old engine
// without module workers) the same task function runs on the main thread instead and the promise still resolves. usesWorkers() says which of the two a caller is getting, for work it would rather slice
// itself than run in one go.
//
// Size: the cores the device reports, less one for the main thread, at least 1 and at most 4. A phone reports 8 cores but only four of them are fast ones, and every worker holds its own copy of the
// painters and a canvas (a few tens of megabytes at most), so more than four would cost memory for no time.
// Workers are made when a task first needs one, never at load. A worker file is the same source in both ways the game is served: src/worker.js beside this file, or, in the build, the bundle
// that tools/build/build.mjs writes next to the game's (it defines __PD_WORKER__ as its name).
// A task that is no longer wanted: pass an AbortSignal; its promise rejects with an AbortError at once, a task still in the queue never starts and a running one has its result dropped.
import { TASKS } from './tasks.js';

const ASKED = /[?&]workers=(\d+)(&|$)/.exec(location.search);   // ?workers=N sets the size (to measure the cap on a phone); ?workers=off turns the pool off
const SIZE = ASKED ? Math.max(+ASKED[1], 1) : Math.min(Math.max((navigator.hardwareConcurrency || 2) - 1, 1), 4);
let live = !/[?&]workers=off(&|$)/.test(location.search) && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
const workers = [], queue = [];   // workers: { w, job }; queue: jobs not yet on a worker
let nextId = 1;

export const usesWorkers = () => live;

function fallback(job) {   // the same function on the main thread, one task per turn so that the page can breathe between them
  setTimeout(() => {
    if (job.done) return;
    job.done = true;
    try { job.resolve(TASKS[job.name](job.payload).value); } catch (e) { job.reject(e); }
  }, 0);
}
function fail() {   // a worker would not start: nothing more goes to workers, what was waiting or running there is done here
  live = false;
  const lost = workers.splice(0).map(s => { s.w.terminate(); return s.job; }).filter(Boolean).concat(queue.splice(0));
  for (const j of lost) fallback(j);
}
function spawn() {
  let w;
  try { w = new Worker(typeof __PD_WORKER__ !== 'undefined' ? new URL(__PD_WORKER__, import.meta.url) : new URL('./worker.js', import.meta.url), { type: 'module' }); } catch (e) { fail(); return null; }
  const slot = { w, job: null };
  w.onmessage = e => {
    const j = slot.job; slot.job = null;
    if (j && !j.done) { j.done = true; if (e.data.error) j.reject(new Error(e.data.error)); else j.resolve(e.data.value); }
    pump();
  };
  w.onerror = e => { e.preventDefault(); fail(); };
  workers.push(slot);
  return slot;
}
function pump() {
  while (queue.length) {
    if (!live) { fallback(queue.shift()); continue; }
    const slot = workers.find(s => !s.job) || (workers.length < SIZE ? spawn() : null);
    if (!slot) { if (!live) continue; return; }
    const job = queue.shift();
    slot.job = job;
    slot.w.postMessage({ id: job.id, name: job.name, payload: job.payload }, job.transfer);
  }
}

export function run(name, payload, transfer = [], signal = null) {
  return new Promise((resolve, reject) => {
    const job = { id: nextId++, name, payload, transfer, resolve, reject, done: false };
    if (signal) {
      const abort = () => { if (job.done) return; job.done = true; const i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1); reject(new DOMException('aborted', 'AbortError')); };
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
    }
    queue.push(job);
    pump();
  });
}
