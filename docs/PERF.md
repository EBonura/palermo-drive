# Performance pass

Owner of this file: performance agent. Raw measurement reports are in `docs/perf/*.json` (one per run, same schema as `tools/build/measure.mjs` prints).

## Result in one table

Paired runs (baseline and final back to back on the same busy machine, headless Chrome on an M-series Mac, local gzip server, CDP network and CPU throttling).
"Ready" is the moment the loading element is removed and the first frame is drawn. Slow 4G = 1.6 Mbit/s, 150 ms RTT; 4G = 9 Mbit/s, 60 ms RTT; phone = 844x390 at DPR 3, touch UI, 4x CPU slowdown.

| | baseline | final |
| --- | --- | --- |
| Bytes over the wire (gzip) | 3,724,230 | 2,151,976 (of which 487 KB facade photos and 368 KB far-city data arrive after the game has started) |
| Bytes before the first frame | about 3.3 MB (everything except the photos) | about 1.25 MB (html 8 KB, js 472 KB, core data 659 KB, fonts 77 KB, splash 36 KB) |
| Requests | 45 | 23 |
| Ready, desktop, slow 4G | 19.6 s | 8.1 s |
| Ready, phone, slow 4G | 25.8 s | 12.7 s |
| Ready, phone, 4G | 10.9 s | 8.1 s |
| Ready, desktop, no throttle | 2.8 s | 1.8 s |
| DOMContentLoaded, desktop slow 4G | 19.6 s (blocking scripts) | 5.3 s |
| GL triangles per frame, Quattro Canti, desktop (shadows on) | 3.50 M | 1.59 M |
| GL triangles per frame, Quattro Canti, phone profile (shadows off) | 2.85 M | 1.13 M |
| GL triangles, Teatro / La Cala / Stazione, phone profile | 2.86 / 3.41 / 2.36 M | 1.12 / 1.94 / 0.65 M |
| Main-thread render cost, phone (4x CPU), median | 12.7 / 12.8 / 15.7 / 11.3 ms | 8.6 / 9.2 / 11.0 / 6.3 ms |
| Draw calls per frame, Quattro Canti, desktop / phone | 673 / 454 | 674 / 534 |
| JS heap after load (phone) | 92 MB | 81 MB |

Notes on reading it.
- Content grew while I worked (day/night, vehicles, landmarks, new props, a world streamer), so the final tree draws more things than the baseline tree. The triangle drop is therefore a lower bound on what the optimisations did. Draw calls did not drop: 250 m building chunks and the new content added some, the triangle savings are what matters on a phone GPU.
- Before r182 `renderer.info.render` left the shadow pass out; since r18x it counts it. All draw call and triangle numbers in this file come from hooks on the WebGL context (`glCalls`, `glTriangles` in the JSONs), which count every pass on every version.
- The machine was shared with other agents and an OSM bake. Timings move by 10-30 % between identical runs; byte counts and triangle counts do not. Do not read small timing differences.
- Headless Chrome on this Mac has a fast GPU, so frame times say little about phone GPUs. Triangles per frame and main-thread render time are the numbers to trust.
- Not measurable here: real phone GPU time. `src/perf.js` exists because of that (it adapts to whatever device it lands on).

Live check on the real GitHub Pages site after the last deploy (`docs/perf/06-live-final-phone-slow4g.json`, phone profile, slow 4G, CDP byte counts): 23 requests, 2,163,635 bytes, ready in 12.8 s, no console errors.

### Per step (each step measured on the tree as it was at that moment, so the content differs a little between rows)

| step | wire | requests | ready, desktop slow 4G | ready, phone slow 4G |
| --- | --- | --- | --- | --- |
| 1 baseline (python server layout, r160 from jsDelivr, JSON-in-JS data) | 3.78 MB | 46 | 19.3 s | 24.8 s |
| 2 esbuild bundle, minified, tree-shaken, CSS inlined, still JSON data | 3.56 MB | 19 | 17.9 s | 23.6 s |
| 3 binary data (+ context pruning, street simplification) | 1.87 MB | 17 | 11.7 s | 14.5 s |
| 4 three.js r187 (bundle grew by 40 KB gzip: r187 is bigger) | 1.91 MB | 17 | 9.8 s | 15.0 s |
| 5 rendering and startup work, far city and photos off the critical path, webp photos | 2.15 MB total, 1.25 MB before first frame | 23 | 8.1 s | 12.7 s |

## Pipeline

- `tools/build/` (own `package.json`, pinned: esbuild 0.28.2, three 0.187.0, sharp, puppeteer-core). `cd tools/build && npm ci && node build.mjs` writes `dist/`. The source tree, the import map and the python dev server are untouched.
- `.github/workflows/pages.yml`: on push to `main` (and manually) builds `dist/` and deploys it with `actions/upload-pages-artifact` + `actions/deploy-pages`. Pages source is now "GitHub Actions" (switched with `gh api -X PUT repos/EBonura/palermo-drive/pages -f build_type=workflow`, verified live: 17 requests, no console errors). A push that does not build now leaves the previous deployment up instead of publishing a broken tree. Roll back to branch deploy with
  `GH_TOKEN=$(gh auth token --user EBonura) gh api -X PUT repos/EBonura/palermo-drive/pages -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'`.
- `dist/` is in `.gitignore` (and `node_modules/`): the autopush loop does `git add -A`.
- What the build does: bundles `src/` + three + the addons actually imported (`Sky`, `BufferGeometryUtils`); define `__PD_PROD__`; entry loads the data blobs with top-level await before `main.js` runs, so `window.PALERMO_DATA` etc. exist exactly as before; inlines `src/mobile.css` + `src/ui.css` (fonts hashed, the two title fonts preloaded); removes the import map and the data `<script>` tags; preloads the bundle and the core data blob; copies `assets/` except tooling and source-only files (`*.md` except CREDITS, `*.js` (bundled), `cover-src/`, `cover-portrait.png`, `contact-sheet*`); converts the facade photos to webp and rewrites `map.json`.
- `index.html` is parsed by the build (it fails loudly if the stylesheet links, the importmap or the main.js script tag change). New classic `<script src="*-data.js">` data files are picked up automatically.
- Flags: `--data=raw` (ship the JSON scripts as they are), `--no-prune`, `--simplify=0` (exact streets), `--minify=false` (readable bundle for profiling), `--src=<dir>` (build another checkout), `--nodes=<dir>` (try another three.js), `--meta`.
- GitHub Pages serves gzip only (checked with `Accept-Encoding: br`: no brotli), at a level about 2.6 % weaker than gzip -6, `Cache-Control: max-age=600`, and gzips `.bin` too. wav and woff2 are not compressed. So there is no pre-compressed brotli option on Pages.
- `world/` and `data/` are in `.gitignore`, so CI cannot build or deploy the whole-city tiles. The build handles `world/manifest.json` + `world/tiles/*.json` when they exist (local builds do: 615 tiles, 76.7 MB raw / 20.8 MB gzip become 11.3 MB / 8.2 MB), but the published site only gets them if the tiles are committed or produced in CI. Decision for the lead (see the report).

## Data codec (tools/build/codec.mjs, runtime/decode.js)

Generic binary form of JSON-like data ("PDB1"); decoder is about 2 KB minified, ~15 ms for the whole centro. It returns the same JS values:
- number arrays are stored as zigzag varints of the scaled integers, delta coded (stride 1 or 2, optionally second order, optionally after a raw 2 or 4 value header); the encoder picks the cheapest variant per array
- decimals are kept exactly (round(v*10^d) / 10^d is the same double; checked per array), so palermo-data, props-data and the bus routes decode bit-identical (every blob is decoded again and compared with its source during the build, `assert.deepStrictEqual`)
- object key lists are stored once as shapes, strings in a frequency-sorted table, OSM ids ("w123", "r45.0") as delta coded numbers; tags, lengths, values and floats live in separate streams so gzip sees homogeneous bytes
- two lossy content steps, both reported in the build log and both optional: the street layers drop vertices closer than 0.06 m to the line through their neighbours (the data is 0.1 m precise; 296k to 145k vertices; screenshot diff against the old output: 0.05 % of pixels differ in a street view, 0.08 % in an aerial view) and curbs are rounded to 0.1 m (were 0.01); the context city is pruned to the buildings `src/context.js` would draw anyway (42,288 to 16,969 rows, far footprints already turned into rectangles) using the same rule (`src/context-select.js`, shared by the game and the build)
- fewer street vertices also means fewer triangles to build at startup and to draw

| | JSON (gzip) | binary (gzip) |
| --- | --- | --- |
| palermo-data.js 5.5 MB | 1,569 KB | 640 KB (codec alone, no simplification: 767 KB) |
| context-data.js 2.8 MB | 1,114 KB | 368 KB (codec alone: 941 KB, pruning is the rest) |
| props-data.js | 40 KB | 30 KB |
| bus-routes.js | about 9 KB | 6 KB |
| total | 2,692 KB | 1,044 KB, split in a 659 KB core blob and a 368 KB far-city blob fetched after start |
| world tiles (615) | 20.8 MB | 8.2 MB |

Where the 659 KB core goes: streets 340 KB (raised 190, asphalt 65, curbs 43, paving 29, green 13), buildings 222 KB, roads 45 KB, far terrain 20 KB, props 30 KB.
Tiles: `world/manifest.json` and `world/tiles/*.json` become `.bin` twins in `dist/`. `runtime/loader.js` installs a `fetch` shim (only when the build produced tiles) that serves those URLs from the `.bin`, decodes per tile and returns an object with `json()` and `text()`. World code must read tiles with `fetch(url).then(r => r.json())` (or `.text()`); `arrayBuffer()`, `blob()` and workers that call their own fetch do not get the shim. Tested with `?world=1`: 142 requests, no errors.

## three.js r160 to r187

Read the migration guide r160 to r187. What actually broke here:
- `vColor` is always a `vec4` since r180: custom chunks that did `dot(vColor, ...)`, `vColor = vec3(...)` or `vColor = color * ...` fail to compile. Fixed in `src/buildings.js` (`vColor.rgb`), `assets/traffic/models.js` and (by its owner) `src/sea.js`, written so they also work on the old vec3 (`!THREE.ShaderChunk.color_pars_vertex.includes('vec3 vColor')`).
- Sky (`src/main.js`): r183 removed its legacy gamma, the old patch string no longer matched. The patch now puts the gamma back (sunfade is 1 with the sun above the horizon, so `pow(texColor, 1/2.4) * 0.42`). Aerial and street screenshots against r160: 0.1 % / 0.04 % of pixels differ.
- `PCFSoftShadowMap` was folded into `PCFShadowMap` (soft) in r182: `src/main.js` uses it from r182 on.
- Other guide items checked and not needed here: `useLegacyLights`, `WebGLMultipleRenderTargets`, `envMapIntensity` (only `roadwear.js` puddles set it, no envMap, 1.1 vs 1.0 is invisible), `Clock`, `copyTextureToTexture`, `lightmap_fragment`, `Material.type`, `matrixWorldNeedsUpdate` (`matrixAutoUpdate = false` sites call `updateMatrix()`).
- Appearance: PBR energy conservation and indirect specular changed (r181), the PMREM was rebuilt (r187); roughness-heavy surfaces are a touch brighter. Side by side screenshots at 4 street and 2 aerial views look the same to the eye; if the lead wants it exact, nudge `toneMappingExposure` (0.85) down a few percent.
- Bundle size: r187 tree-shakes worse than r160 (about +40 KB gzip for the same code) because `three.core.js` is large. A re-exported `THREE` namespace (`lmc-kit.js` did `export { THREE }`) defeats tree shaking entirely: +147 KB raw. Rule below.
- WebGPURenderer: not adopted. Every custom shader here is GLSL (`ShaderMaterial`, `onBeforeCompile` chunk surgery in buildings, sea, traffic, pedestrians, missions, the Sky addon); WebGPURenderer works with NodeMaterial/TSL materials (also on its WebGL2 backend, as far as I could tell from the docs; I did not run it), so adopting it means rewriting all of them. The gain would be draw-call overhead, which is not what limits this game on phones (triangles and fill rate are). Revisit when the world streamer and the shader set have settled.
- BatchedMesh: evaluated, not adopted. Props are already `InstancedMesh` per cell and model (one draw call per visible cell and kind, distance culled in `props.js`), buildings and landmarks are merged per chunk, so there are no "many small distinct meshes" left to batch; the remaining draw calls are building and landmark chunks plus visible prop cells, vehicles and effects (about 530 per frame in the phone profile, no shadow pass), costing 6-11 ms of main-thread render time per frame at a 4x slowdown. Moving props to BatchedMesh would be a rewrite of a 100 KB module for a small gain.

## Rendering and startup (what I changed)

- Street layers: see the recommendation for `src/streets.js` below (1.4 M of 2.3 M visible triangles at Quattro Canti before). The streaming agent applied the flat-ground rule.
- Buildings: chunks of 250 m instead of 400 m in the centro (frustum and shadow culling work better): minus 16 % triangles at Quattro Canti for plus 5 % draw calls.
- Dynamic resolution (`src/perf.js`, hooked in `src/main.js`): phones aim at 30 fps, desktop at 60. The quality tier sets the ceiling, the pixel ratio moves between 0.5 (phone) / 0.75 (desktop) and that ceiling in steps of 0.125 from the measured frame interval. Lowers fast (proportional), raises slowly with back-off, ignores hitches and the first 90 frames, and checks two seconds after each lowering that the frame time really improved (if not the game is CPU bound and the sharp image comes back). `?fixres` disables it (benchmarks), `game.perf.stats()` with `?debug`.
- Shadows on phones: the default phone tier is already "low" (shadow map off), medium is 1024. I left the tiers alone; with dynamic resolution a phone could afford a higher ceiling (see vehicles agent below).
- Anisotropic filtering is capped at 4x on phones whatever the modules ask for (`renderer.capabilities.getMaxAnisotropy` override in `main.js`).
- Production only: `renderer.debug.checkShaderErrors = false` and `renderer.compile(scene, camera)` before the first frame, so the 56 shader programs are linked together instead of one at a time on first use.
- Masks: `core.js` `rasterMask()` rasterises street layers into a bit-packed mask in 1024 px tiles. `main.js` (raised ground) and `props.js` (asphalt, paving) used one canvas for the whole map (4100 x 4060 px at 0.5 m) and kept its RGBA read-back alive: about 66 MB each, close to the 16 M px canvas limit on iOS Safari. Now about 2 MB each and a 4 MB scratch canvas. Edge pixels can differ by one cell (0.5 m) from the old version (about 1.7 % of sampled points inside the shape, all on the boundary).
- Startup CPU: `core.js` `inPoly` without array destructuring (2.5x faster, it ran ~10 M times); the far city and the facade photos are no longer on the critical path; photos are webp (817 KB to 487 KB).
- Per-frame garbage: shared materials in `props.js` flipped between "instanceColor / no instanceColor" from one mesh to the next, which made three recompute program parameters for ~400 objects per pass per frame (about 100 MB of garbage in 6 s); every pooled mesh now has an instance colour (white when untinted): 12 MB. The cell visibility loop used `Math.hypot` (boxes a number per call) 1300 times per frame; `Math.hypot` with two arguments in the per-frame code of `props.js`, `pedestrians.js`, `traffic.js`, `roadwear.js` became `hyp2` (sqrt). Remaining allocation top list while driving: three's `setValueV3f/M4` uniform uploads, `painterSortStable`, `pedestrians.update`.
- Profile of startup at 4x CPU slowdown (tools/build/profile.mjs, `--minify=false`): `buildBuildings` 2.6-3.6 s, `buildProps` 1.9-2.2 s, `createRoadWear` 0.9-1.4 s, `buildStreets` 0.9-1.1 s, `createSea` 0.8-0.9 s, pedestrian atlas 0.9-1.1 s, landmarks 0.65 s, context 0.3-0.6 s, shader linking about 1 s. Divide by about 4 for an M-series Mac, by about 2 for a recent phone.

## Rules for module authors (they keep the build small and the frame cheap)

1. Import `THREE` where you use it (`import * as THREE from 'three'`). Never re-export it or pass the namespace object around: the bundler then keeps all of three.
2. In custom shader chunks `vColor` is a `vec4`. Write `vColor.rgb`, and if you need to initialise it use the feature test from `models.js` / `sea.js`.
3. No `Math.hypot`, array destructuring, object/array literals or `.map/.filter` in per-frame loops; reuse vectors. Do not give one material to meshes with different attribute sets (instanced with and without `instanceColor`, colour attribute of 3 and 4 components).
4. New baked data goes through the codec: ship it as a classic `<script src="x-data.js">` setting a `window.*` global (picked up automatically) or an ES module in `assets/` that is imported (then add it to `tools/build/data.mjs`, as bus-routes is).
5. Read world tiles with `fetch(url).then(r => r.json())`.
6. Big canvases: do not `getImageData` a whole-map canvas; tile it (see `rasterMask`).
7. Assets: put runtime-fetched files under `assets/` and reference them relative to `import.meta.url` or the page (`../assets/...` from `src/` works in the bundle because it lives in `js/`).
8. Re-check shader compile after changing a custom shader (`tools/shot.sh` prints console errors) and run `node tools/build/measure.mjs --root dist` before and after anything that adds geometry.

## Recommendations per module (files I did not or could not change)

- `src/streets.js` (world-streaming agent): applied. Also: the centro path still builds one mesh per layer for the whole map, so frustum culling never helps; per-tile meshes in `world.js` fix that for `?world=1`; the centro path could be split into ~250 m cells. At startup `buildStreets` is 0.9-1.1 s at 4x CPU: triangulation plus `drape` recursion with `Vector2.clone()` allocations.
- `src/world.js`: read tiles with `r.json()`; consider `streetsIter` with larger `drape` for far tiles and the flat-ground rule; tile `streets` already go through the same 0.06 m simplification in the build.
- `src/sea.js` (sea agent): vColor fix is in. `createSea` costs 0.8-0.9 s at 4x CPU at startup (the land raster at line ~64 uses a canvas + `getImageData`: `rasterMask` from `core.js` does it in a tenth of the memory); `QUALITY.mobile` already lowers anisotropy, good.
- `src/roadwear.js` (free now, left alone so as not to collide with the vehicles agent): `createRoadWear` is 0.9-1.4 s at 4x CPU, almost all of it the 2048 px tiled raster + per-pixel bit loop (same job as `rasterMask`) and per-road sampling; build it after the first frame (it only matters once the lapa drives over asphalt) or reuse `rasterMask`.
- `src/vehicle.js`, `src/mobile.js`, `src/mobile.css`, garage in `src/ui.js` (vehicles agent): `QUALITY.pixelRatio` (1.25 on touch) and the tier table in `main.js` (`low: [1, 0]`) were chosen before dynamic resolution existed. A phone at DPR 3 renders at 1x CSS pixels, which is soft; `perf.js` now backs off when a device struggles, so the ceiling could be 1.5-2 on phones that hold 30 fps (change the tier table or `QUALITY.pixelRatio`, `perf.setMax` takes it). `assets/audio/skid.wav` is 150 KB and `impact.wav` 29 KB: Pages does not gzip wav; mono 16-bit at 22 kHz, or ogg/mp3, would cut that by 4-10x. `assets/cars/hatchback-sports.glb` (198 KB) and `Textures/` do not seem to be referenced any more.
- `src/net.js`, `src/radio.js`: no startup cost seen (the relay and `assets/music/*.mp3`, 14 MB, are only fetched when used; keep it lazy: nothing under `assets/music` may be touched before the first tap).
- `src/daynight.js`: constant light count (2 point + 1 spot at intensity 0), so no program recompiles; good. Keep it that way: changing the number of lights or toggling `castShadow` recompiles every material.
- `src/main.js` / `index.html` (lead): edits I made are marked `[perf pass]`: PCFShadowMap/Sky patch for r182+, `perf` hooks (import, `createPerf`, `applySettings`, loop, `game.perf`), `checkShaderErrors` in production, anisotropy cap, `renderer.compile`, `centroRaised` via `rasterMask`, deferred far city (`if (WORLD && window.__pdLate) await ...`, a top-level await), import map version. The `raisedMask`/`mapCanvas` minimap canvas: `mapCanvas` is 2.4 k x 2.4 k px, fine.
- `tools/tiles.py`, `world/`: emit coordinates at 0.1 m (already) and keep field names stable; the codec adapts to any JSON, but a tile format change that nests numbers inside objects (instead of flat arrays) compresses 3-4x worse.

## Measuring

```
node tools/build/build.mjs                                    # dist/
node tools/build/measure.mjs --root dist --profile phone --net slow4g --cpu 4 --out /tmp/x.json
node tools/build/measure.mjs --url https://ebonura.github.io/palermo-drive/ --profile desktop      # the live site
node tools/build/shots.mjs --roots <ref dir>,dist --out /tmp/shots                                  # screenshot diff
node tools/build/scenestats.mjs --root dist --spot "38.115684,13.361460"                            # heaviest meshes
node tools/build/profile.mjs --root <dist built with --minify=false> --profile phone                # CPU + allocation profile
```
`measure.mjs --root <source tree> --cdn <dir with three@r160>` measures the old layout (how the baseline was taken: `git archive bd6bf5f`).
