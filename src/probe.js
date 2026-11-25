// Do the workers' canvases draw what the page's canvas draws? Asked once, by whoever first wants to paint in a worker (the buildings' atlas, the walls' texture): the answer is a promise of true or false, false
// when there is no pool, a worker failed, or three real layers of the atlas painted in a worker differ from the same painted here (see probeMatches in src/atlas-task.js; WebKit fails it, Chrome passes).
import * as workPool from './work-pool.js';
import { probeMatches } from './atlas-task.js';

let verdict = null;
export const workersDrawLikePage = () => verdict || (verdict = workPool.usesWorkers()
  ? workPool.run('probe', {}).then(px => workPool.usesWorkers() && probeMatches(px), () => false)
  : Promise.resolve(false));
