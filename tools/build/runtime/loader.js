// Boot-time loader for the build's binary data blobs. Runs (with top-level await) before the game modules.
// Each blob decodes to { globalName: value }; the values are put on window exactly like the old data scripts did.
// When the build converted the world tiles it also installs a fetch shim: requests for world/manifest.json and
// world/tiles/*.json are served from the .bin twin and decoded per tile, so streaming code keeps calling
// fetch(url).then(r => r.json()) unchanged.
import { decode, decodeSteps } from './decode.js';

export async function loadBlobs(base, blobs, opts = {}) {
  const get = async b => {
    const r = await fetch(base + b.file);
    if (!r.ok) throw new Error('data blob ' + b.file + ': ' + r.status);
    Object.assign(window, decode(new Uint8Array(await r.arrayBuffer())));
  };
  await Promise.all(blobs.filter(b => !b.late).map(get));
  // late blobs (the far city) start downloading once the critical data is in, so they never compete with it.
  // main.js builds the far city when window.__pdLate resolves.
  const late = blobs.filter(b => b.late);
  if (late.length) window.__pdLate = Promise.all(late.map(get));
  if (opts.tiles) installTileShim();
}

function installTileShim() {
  const orig = window.fetch.bind(window);
  const RE = /(^|\/)(world\/(?:manifest|tiles\/[^/?#]+))\.json(\?[^#]*)?(#.*)?$/;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
    if (!RE.test(url)) return orig(input, init);
    return orig(url.replace(/\.json(\?[^#]*)?(#.*)?$/, '.bin'), init).then(async r => {
      if (!r.ok) return r;
      const it = decodeSteps(new Uint8Array(await r.arrayBuffer()), 1.5);
      let obj;
      // a piece per frame while the game is running; all at once while a loading screen or a transition covers it (world.hurry)
      for (;;) { const s = it.next(); if (s.done) { obj = s.value; break; } if (window.__pdHurry && !window.__pdHurry()) await new Promise(res => { requestAnimationFrame(res); setTimeout(res, 100); }); }
      return { ok: true, status: 200, statusText: 'OK', url: r.url, headers: r.headers, redirected: false, type: r.type,
        json: () => Promise.resolve(obj), text: () => Promise.resolve(JSON.stringify(obj)), clone() { return this; } };
    });
  };
}
