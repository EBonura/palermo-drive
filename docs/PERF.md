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

## Automatic graphics (`src/perf.js`, off since 4 Nov 2026)

Players no longer choose or get an automatic level: every device runs the full graphics (`applySettings` in `src/main.js`). `?gfx=auto|low|medium|high` remains for tests. What follows describes the ladder, which only `?gfx=auto` still uses.

Auto is the default for new players and for everyone who never chose a tier. One target on every device: 60 fps. There is no phone profile; a weak device simply ends up lower on the same ladder. Low, medium and high stay in Options as manual choices and are fixed: nothing adapts under them, and the draw distance slider applies. While Auto is on, Auto owns the draw distance (the slider is overridden).

**Saved settings.** `localStorage` `palermoDrive.settings.v1` has written the then-default `quality` into every save since the first preview, and the default has changed twice (low on phones / high on desktop, then medium on 1 November), so a saved low, medium or high cannot be told from an old default. A saved tier now counts only if the save also has `qualityChosen: true`, which `src/ui.js` writes when the player taps the Graphics control. Older saves become Auto. Cost: someone who deliberately picked high or low before this change is on Auto until they pick again.

**The ladder** (`LADDER` in `src/perf.js`, step 0 is the best; resolution is the continuous rung before step 0):

| rung | what it does | lowered | rebuilds? |
| --- | --- | --- | --- |
| 1 resolution | pixel ratio, steps of 0.125, ceiling min(devicePixelRatio, 2), floor 0.75 (0.625 at 30 fps) | first, proportionally (cost follows pixels) | no, a buffer resize of a few ms |
| 2 draw distance | step 0: 1.0, step 1: 0.85, step 2: 0.7 (far plane and fog) | after the floor | no |
| 3 shadows | step 3: map 512 (from 1024), step 4: off | next | size: reallocates the map. On or off: every program recompiles |
| 4 crowd and traffic | step 5: pedestrians 'low' tier (240 within 75 m) and traffic cap 30 instead of 60 | last | no |

Steps 0 to 3 are the 60 fps ladder (`S60`): shadows must stay on, because shadows off is "giving up a lot". Steps 0 to 5 are the 30 fps ladder. Auto never goes above today's medium for crowd and shadows (1024 map, medium crowd); the high tier (2048 map, 1000 pedestrians) is manual only. Roadwear stays on its medium tier in Auto (changing it unloads every cell).

**CPU bound.** After a resolution lowering, the next 3 s window is compared with the one before. If it did not improve by 7 % and is still slow, the game is CPU bound: the sharp image comes back, the resolution is left alone for 2 min, and the next moves skip the rungs that only help the GPU (draw distance) and go straight to the ones with `cpu: true` (shadows, crowd).

**30 fps.** If the 60 fps ladder is used up and six windows in a row (18 s) are still slow, the game settles at 30: the animation loop skips frames so that one in every `floor(33.3 / refresh + 0.25)` display refreshes runs (2 at 60 Hz, 3 at 90 Hz, 4 at 120 Hz, 2 at 75 Hz = 37.5 fps). The refresh interval is measured from the raw animation frame deltas (lowest estimate seen, snapped to a real rate), not assumed. The same rules then run at a 33.3 ms target from step 1, resolution 1. Every 5 min at first, doubling to 80 min each time it returns to 30, a 60 fps trial runs for two windows at the floor resolution and the same step (no rebuild); if it holds, 60 stays and the ladder climbs from there. In Auto, 60 fps mode is capped too on displays at 120 Hz or more: every `floor(refresh / 60 + 0.05)`th refresh runs (2nd at 120 and 144 Hz: 60 and 72 fps, an even cadence; 3rd at 180 Hz, 4th at 240 Hz), to save battery and heat. 90 and 100 Hz have no even way to 60 and run uncapped. The governor's target is `max(16.7 ms, cap interval)`. Manual tiers are never capped.

**Slow on purpose** (all constants are in `DEFAULTS`, and every one is a guess until it meets a real phone):

| constant | value | meaning |
| --- | --- | --- |
| window | 3 s | one decision per window of frame times; windows with under 12 frames are dropped |
| slow | 1.15 x target (19.2 ms at 60) | lower above this; the old resolution-only code used 1.23 |
| very slow | 1.7 x target | one window is enough |
| fast | 1.05 x target | a window below this counts as having room |
| lowering | two slow windows in a row | one if very slow |
| raise | 15 s of good windows | doubled (up to 10 min) after every failed raise, halved again after 5 min without a change |
| failed raise | a lowering within 25 s, or the first window after a raise above 1.12 x target | the raise is taken back at once (when it does not rebuild) and that level is banned for 20 min |
| grace | 2.5 s | ignored after each change and after loading, a transition, the menu closing |
| rebuilding change | shadow size: on a transition (`pd-cover`), else 90 s since the last one when lowering, 300 s when raising (the first one in a session also waits for a transition or 90 s). Shadows on or off: only on a transition, never mid-drive | a pending lowering to shadows off is saved as already done, so the next start (covered) begins there |

Frames are not measured on the title, in menus, in the Garage, in a hidden page, under a transition or in the grace period after any of those. Streaming while driving is real cost and counts. The transition (`src/transition.js`) dispatches `pd-cover` on `window` (detail true once the screen is covered, false when free again); the governor does its waiting rebuild when it sees true.

**Remembering.** After 60 s without a change the level is saved in `palermoDrive.autogfx.v1` (mode, step, resolution, back-off state) with a signature of devicePixelRatio, screen size and GPU renderer string; a different signature is ignored. The next start begins there ("saved"). Without a saved level: 60 fps mode, step 1, resolution 1.0, or step 2 and 0.875 when `hardwareConcurrency` or `deviceMemory` is 4 or less. That is a start point, not a profile: the same ladder and rules follow.

**Tests stay deterministic.** `?fixres` and an automated browser (`navigator.webdriver`) turn Auto into the old fixed medium (ceiling 1.5, 1024 shadows, medium crowd) and nothing adapts, so every script in `tools/build` and the scripts that load `?fixres` give the numbers they gave before. `?gfx=auto|low|medium|high` overrides the setting for one page load (automation can test Auto with `?gfx=auto`). In tests, `window.__pdPerfCfg = { win: 1500, ... }` (set before load) shortens the governor constants, and `game.perf.force({ mode, s, ratio })` jumps to a level (`?debug`).

**Readout.** Options > Debug (`game.settings.coords`, or `?coords`) adds lines to the coordinates box: fps and mode, step, limit (CPU after a CPU verdict, GPU for two minutes after a resolution lowering helped, - otherwise), the refresh rate, resolution and the buffer size, and draw distance, shadow size and crowd tier. It reads state the governor keeps anyway and updates eight times a second.

**Tests of the logic.** `node tools/build/perfsim.mjs` runs the governor on a fake clock against cost models (CPU bound, GPU bound, both, load that comes and goes, 50 to 144 Hz) and checks the frame caps on fake timestamps from 50 to 240 Hz (rate, and an even cadence with 0.3 ms of timestamp jitter), that manual tiers are never capped, and that shadows never switch outside a transition. `tools/build/perfsim.mjs` is also where the thresholds were first tuned, so it is tuned to its own model: it proves the state machine, not the constants.

**Measured** (headless Chrome 156, M3 Max, `--use-angle=metal --enable-gpu`, 1280x720 at DPR 2 so the ceiling is 2, spot 1 Quattro Canti, `?gfx=auto`; the machine was shared with other agents' browser runs, load average 117 to 250 during these, so frame times are noisy and I read states and orders, not single frame numbers). Short runs used `__pdPerfCfg` with 1.5 s windows and 6 s raise waits (about 4x faster than the real constants); the long run used the real constants. Noise was handled by the design (3 s windows, two in a row, six at the bottom of the ladder, relative comparisons for the CPU verdict, back-off after failed raises) and by repeating the key runs; the logs are in `/private/tmp/claude-501/autogfx/`.

| case | what happened |
| --- | --- |
| no load, fast constants | climbs from step 1 and resolution 1 to step 0 and resolution 2.0 in about 80 s (9 raises), 60 fps, then 70 s without a change |
| CPU x4 and x6 (CDP) | resolution lowered once, the next window did not improve, "CPU bound": resolution back, then straight to step 3 (shadows 512) within 5 s, then, still slow, to 30 fps after six slow windows; at 30 the frame time sits at 33.3 ms. At x6 even step 5 gave 34 to 40 ms on this loaded machine, so it stayed at 28 fps |
| GPU stress (a full-screen shader, cost follows pixels) | two runs: resolution to the 0.75 floor first, then draw distance (steps 1, 2), then shadow 512 (step 3), then 30 fps at step 1 and resolution 1 and a resolution search at 30 (0.75 to 1.0), the order of the ladder both times. 1200 iterations (a lighter load) only moved resolution (1.125 to 0.875) and never touched a step |
| load goes away | CPU case: climbed from step 5 / 0.625 back to step 0 / 2.0 in 145 s (fast constants), and a 60 fps trial took place; GPU case: a trial succeeded about 70 s after the stress stopped and 60 fps came back. Under the shared load the 60 ladder then dropped steps again (the machine was busy), the order was still correct |
| manual and fixres | `gfx=medium`, `high`, `low`, `auto&fixres` and the webdriver default, 60 s under CPU x6 and a GPU stress: pixel ratio, shadow flag and far plane unchanged in every case (1.5 / 2 / 1 / 1.5 / 1.5), the governor off (`auto: false`) |
| 30 fps cadence | steady 30.0 to 30.1 fps with a 33.3 ms mean at 60 Hz; the caps at 90, 120 and 144 Hz were only run on fake timestamps (`perfsim.mjs`): every 3rd, 4th and 5th refresh, 30, 30 and 28.8 fps |
| rebuild on a transition | a shadow-off step that could not run was deferred 16 times; a real `transition()` from `src/transition.js` dispatched `pd-cover` and the step ran at the cover (shadows off) |
| remembered level | after a settled run the key held mode, step, resolution and back-off; the next start read "saved" and began at 30 fps, step 0, resolution 1.125 as saved |
| 10 minutes, real constants, CPU x3, load average above 100 | 15 states, the last six in the second half (one resolution lowering at 330 s that led to a CPU verdict and step 3, two resolution steps at 530 and 540 s, one at 590 s, and the 30 fps verdict at 600 s when the machine got busier). Not flat, but no flicker either; more moves than a quiet device would make, and I put them down to the load. The six-window rule before 30 fps was added after this run, so the 600 s verdict would now need 18 s of slow windows |
| tools | `csp` none, `garagecheck` no errors (title, drive, phone, garage, garage-phone), `drivecmp` no errors at the eight spots (spot 12 drove only 4 m, with fences and without; I did not look into it, it is not the fences) |
| `perfsim.mjs` | 15 modelled devices pass (strong, GPU bound, CPU bound, cannot hold 60, very weak, borderline for 40 min, load that comes and goes, 90 / 120 Hz, saved 30, rebuilds waiting for covers); the borderline 40 minute case changed 19 times, about once every 2 minutes, because of its slow retries (raises that fail are banned for 20 min) |

**What the pictures show.** `/private/tmp/claude-501/autogfx/qc-L0` to `qc-L6` (Quattro Canti, chase camera) and `high-L0` to `high-L6` (a high camera), 1280x720 at DPR 2: top (2.0), resolution 1.0, 0.75, draw 0.7, shadow 512, shadows off (30 fps), crowd low and resolution 0.625 (30 fps).

**Shadow rebuild cost (measured on the production build).** `node tools/build/build.mjs` to `dist/`, served statically, 1280x720 at DPR 2, CDP CPU x4, the governor held still (`__pdPerfCfg = { win: 1e9 }`) and `game.perf.force()` flipping shadows off and on, longest animation frame gap over 7 s after each flip (`/private/tmp/claude-501/autogfx/stall.mjs`):

| | first shadows off | later flips (off, on, off, on, on) |
| --- | --- | --- |
| production build | 767 ms | 33, 50, 50, 150 ms (the 150 had two frames over 100 ms) |
| dev tree (status query on) | 1700 ms | 117, 67, 83, 133, 83 ms |

The first switch compiles the other program variants and is the stall; three.js keeps the programs, so later flips are cheap. 767 ms is over the half second, so shadows on or off now switch only during a transition (or the loading that starts the game), never while driving. A new shadow map size (1024 / 512) needs no recompile and keeps the 90 s rule. The price: a device that needs shadows off waits at step 3 until the next transition (a mission start, a teleport, the menu); `perfsim.mjs` models one every 4 minutes. One run per build, on the shared machine.

**Untested.** A real phone (GPU time, thermal throttling, iOS Safari's refresh handling and its `hardwareConcurrency` and `deviceMemory`, 120 Hz ProMotion), a real 90 / 120 / 144 Hz display (only fake timestamps), a real 120 or 144 Hz display for the new 60 fps cap (fake timestamps only), Low Power Mode (a 30 Hz display is handled by the target following the refresh, but never run), and the weak-device start hint. Every threshold in the table above is a guess tuned on the model and this Mac.


## The main thread (JS cost and stutter, November 2026)

Tools in `tools/perf/`: `cpuprofile.mjs` (five scenes, timing, CPU profile by system, allocation, worst frames), `table.mjs`, `crowdcheck.mjs` (everybody on the screen has an instance), `gamecheck.mjs` (a fare, a pub, the discarica, collisions, scripted), `tilehash.mjs` (what the tile build makes, two builds compared), `shotdiff.mjs` (pixel diff).

Before and after, headless Chrome on the M3 Max, phone profile (844x390 at DPR 3, full graphics), CDP CPU throttling, builds alternated on a quiet machine (load average 2 to 5). Before is ded93926; after is this work on top of a main that also holds the rendering and memory passes (not the last five commits of main), so the totals are not this work's alone: read the crowd and map columns for that. 4x is two runs each, shown as a mean; 6x is one run. Not an iPhone: it is a stand-in for JS cost, GPU cost does not scale with it, and Safari's GC and layout are not Chrome's.

| scene | CPU | main ms per frame | crowd ms | map ms | rAF p99 ms | worst frame ms | tasks over 33 ms | MB/s allocated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Quattro Canti, standing | 4x | 10.6 to 7.0 | 2.14 to 0.98 | 0.20 to 0.02 | 11.9 to 9.0 | 13.5 to 10.8 | 0 to 0 | 16.4 to 10.6 |
| Via Maqueda, driving | 4x | 12.8 to 11.8 | 1.40 to 0.81 | 0.19 to 0.08 | 27.2 to 24.7 | 41.8 to 52.1 | 5.5 to 4.5 | 63 to 37 |
| Ballaro, driving | 4x | 12.9 to 9.9 | 2.20 to 1.11 | 0.20 to 0.10 | 15.7 to 11.9 | 111 to 104 | 1 to 1 | 45 to 33 |
| Viale Regione, fast | 4x | 10.9 to 10.1 | 0.57 to 0.37 | 0.11 to 0.07 | 26.6 to 20.4 | 38.4 to 26.9 | 5 to 0 | 56 to 37 |
| Mondello | 4x | 14.2 to 10.9 | 1.67 to 0.97 | 0.17 to 0.09 | 22.6 to 18.9 | 36.7 to 36.2 | 3 to 1 | 21 to 16 |
| Quattro Canti, standing | 6x | 12.4 to 8.9 | 2.89 to 1.35 | 0.25 to 0.02 | 15.6 to 12.8 | 17.5 to 15.7 | 0 to 0 | 16.1 to 10.6 |
| Via Maqueda, driving | 6x | 18.6 to 15.8 | 2.03 to 1.27 | 0.24 to 0.11 | 34.8 to 26.7 | 66 to 56 | 12 to 7 | 52 to 30 |
| Ballaro, driving | 6x | 18.2 to 15.0 | 3.28 to 1.62 | 0.26 to 0.14 | 22.6 to 17.5 | 128 to 124 | 1 to 2 | 30 to 26 |
| Viale Regione, fast | 6x | 17.8 to 13.9 | 0.95 to 0.53 | 0.18 to 0.10 | 44.9 to 30.0 | 60 to 51 | 24 to 8 | 54 to 43 |
| Mondello | 6x | 18.4 to 15.2 | 2.44 to 1.29 | 0.20 to 0.14 | 30.7 to 26.8 | 50 to 55 | 9 to 4 | 22 to 16 |

What each cut does, as far as it could be told apart:
- **Crowd**: its JS about halves, in every scene with people in it. Only who is in a wedge round the camera gets an instance (about 300 of 1000 at Quattro Canti), which also spares the GPU; `crowdcheck.mjs` found nobody on the screen without one in 361077 checks.
- **Minimap**: its JS falls about 90 % standing and about half driving. What it saves on Safari (a canvas composited every frame) cannot be measured here.
- **Program recomputes**: 8 a frame to 2 at Quattro Canti and 4 at the other spots checked; the rest is the shadow pass's depth material between plain and instanced meshes.
- **Traffic rates**: no saving could be measured on its own.
- **Tile steps by the clock, decoding in pieces**: against the main of that day, rAF p99 and the worst frames while streaming improve on Viale (6x, median of 3 pairs, 49.9 to 40.7 and 67.7 to 51.0 ms), little or nothing elsewhere, and the mean does not move. The garbage they first saved was already saved by the memory pass.

What is still dear: `renderer.render` is half or more of the main thread everywhere. Tile build steps still reach 30 to 40 ms at 4x now and then: a step cannot stop inside one big building, one street polygon's triangulation or a garbage collection. Every Ballaro run has a task of 100 to 190 ms: it comes with the tool's teleport at the start of a pass and was not looked into further. One Ballaro run of this work had a single task of 1.37 s that did not come back in eight more runs of the scene: not explained.

Noise: on a shared machine (load average 50 to 90, the first tables of this work) a pair of runs could go either way by 30 %, and one set of pairs even showed the crowd cut as a loss in total. The table above is the only one to read.

## One profile for every device, and the far city (LOD pass)

The owner's rule: desktop and phone show exactly the same graphics. Only the render scale follows the screen (`QUALITY.pixelRatio` in `src/mobile.js`: 1.25 on touch, 2 elsewhere, and, since the Auto graphics pass below, `perf.js` aims at 60 fps on every device and falls back to a steady 30 on its own). Everything else is one set of numbers, tuned on the phone test (844x390, touch, CDP CPU x4, `?fixres`) and then shared. The old per-device branches (`QUALITY.mobile`, `QUALITY.shadowMap`, `(pointer: coarse)` in the files below) are gone.

| what | value (every device) | was phone / desktop | why |
| --- | --- | --- | --- |
| `world.js` rFull | 450 m | 380 / 650 | full detail is about 175k triangles per dense tile; 450 m keeps the 4 tiles round Quattro Canti (the worst case, the spawn) in |
| rLow | 1400 m | 1300 / 2200 | past that the far boxes look the same at phone resolution |
| guard | 150 m | none | tiles this close to the camera always get full detail (walls and the raised-ground mask exist only there) |
| triCap | 1.2 M resident | 650k / 2.8 M | low tiles are cheap to draw (about 22k each, frustum culled); going from 750k to 1.3 M cost under 1 ms of main thread at x4. The expensive things are full tiles and the shadow pass |
| conc, budgetMs, keepData | 3, 2 ms, 6 tiles | 3, 2, 4 / 4, 3.5, 10 | 2 ms and 50 row mask bands keep a x4 slowdown from stepping more than 5 ms at a time |
| trees (pines per tile) | 14 m spacing, 1400 max | 17 m, 900 / 11 m, 2400 | |
| props | density 0.8, draw distance x0.85, build budget 3 ms | 0.55, x0.7, 2.5 / 1, x1, 4 | 1.0 vs 0.55 was inside the noise (+90 draw calls, 90k triangles); 0.8 keeps the streets lived in |
| shadows | 1024 map in the default tier (medium), 2048 in high, none in low | 1024 / 4096 | +3 ms of main thread and about +480k GL triangles at Quattro Canti at x4, the biggest single item. Kept: shadows are most of what makes the streets look right |
| default tier | Auto (see "Automatic graphics" below); medium, high and low are manual choices. Medium = shadows, peds 240 within 100 m, pixel ratio ceiling 1.5, the two real night lights |
| anisotropy cap | 4 | 4 / none | `main.js` (all textures), `sea.js`, `suca.js` |
| sea | `LOW` shader (two wave layers, no weed), coarse field 32 m, fine window 1.2 km at 3 m | LOW, 32 m, 1.2 km at 3 m / full shader, 24 m, 1.6 km at 2 m | the water covers a big share of the screen on the coast: the fragment cost is the one to keep low |
| pedestrian atlases | far: whole cast at 1 texel per design unit, 6.2 MB (8.3 with mips); near: 3 texels per unit for the people close to the camera, 3.7 MB phone / 5.6 MB desktop (see the pedestrian sprites section) | half / full | |
| suca atlas | 0.625 scale | 0.5 / 0.75 | the tags are baked (src/suca-tags.js), so there is no placement work at run time any more |
| minimap pieces | 256 px per tile, 18 kept | 192, 14 / 384, 24 | |
| day/night | env map re-bake at most once a second; the real night lights follow the quality tier only (no longer "never on phones") | 1.4 s / 0.55 s | |

Not touched (not my files, still branch on `(pointer: coarse)`, so they are device differences left over): `src/traffic.js` (MAXV 42 vs 95, buses/carrozze/carretti caps, graph step budget), `src/police.js` (MAXCOPS 3 vs 5), `src/gags.js` (market gags 2 vs 3, one vs two dumped peds). They change how many cars and cops you see.

### The far city (`src/context.js`, `tools/farcity.mjs`, `assets/world/far.bin`)

The old context city (OSM buildings of the old playable box, 1 km chunks, hidden by the tile under the chunk centre) never filled the band between the low detail ring and the horizon: it only reached about 5 km east-west, was pruned to 17k buildings, and a chunk disappeared as soon as the tile under its centre had buildings, so it also punched holes. It is replaced.

- Bake: `node tools/farcity.mjs` reads `world/tiles/*.json`, applies the same district heights the game applies, rasterises footprints on a 20 m grid (a cell is built when 4 of 9 samples are inside a building), snaps heights to 11 storey classes, closes one-cell gaps, merges cells whose classes differ by at most one into rectangles, drops lone one-cell houses of one or two storeys, and keeps only the walls a neighbour does not hide. One flat colour per box (48 k-means colours of the plaster the low ring uses). Result: 82k buildings become 19,916 boxes in 604 tiles, 8.6 triangles per box, 172k triangles in all (155k within 9 km of Quattro Canti), 1.8 s to bake.
- Download: one file, 143 KB raw, 63 KB gzip (the context data it replaces was 368 KB gzip). It is fetched after the manifest and counted as queued work, so the loading screen waits for it. It does not fetch any tile.
- Runtime: boxes are extruded on the far terrain (same triangulation as the far mesh, 6 m skirt), 4 x 4 tiles (2 km) per mesh, so about 25 draw calls reach the horizon. The material is the low detail roof material (vertex colours, no texture), so no new shader program. Chunks are built within 1.25 / fog density (8.9 km at the default fog) of the camera in 256 box slices behind the tile work, dropped 1.5 km beyond. A tile's boxes leave the chunk's index range once the tile has low or full buildings and come back when it is released.
- Cost per dense tile: 120 to 140 boxes, about 1,000 triangles (a low tile is about 22k, a full one about 175k). The whole layer within the fog is about 155k resident triangles, of which the frustum draws about a third.
- To rebake after a tile rebake: `node tools/farcity.mjs`. `--stats` prints counts only; `--cell`, `--tol`, `--close`, `--minc` change the merge (cell 16 gives 30k boxes and 260k triangles).
- `index.html` still loads `context-data.js` (2.8 MB, 368 KB gzip in the build) and `tools/build/data.mjs` still prunes it; nothing reads it any more. Removing the script tag saves that download (for the lead).

### Budget allocation (`updateWanted` in `src/world.js`)

Every tile in range is always covered: the far boxes cost a few hundred triangles and never go away, so a tile that gets nothing better is not a hole. Grants, in order, against `triCap` (far boxes count too): (1) tiles within `guard` of the camera get full detail whatever it costs; (2) every tile of the low detail ring gets low detail, nearest first, while the budget lasts; (3) full detail goes to the nearest tiles of the full ring, nearest first, until the next one does not fit. Tiles that already hold a level get 8 % slack so the estimate shifting as real counts arrive does not make them flap. The title (`world.overview`) still gives full detail only to the tile under the camera.

At Quattro Canti, where four dense tiles meet, step 1 alone takes 700k of the 1.2 M; step 2 then gives low detail to about 15 tiles and the far boxes cover the rest. Before, the same spot on the phone profile spent all 650k on four full tiles and left the ring bare.

### Measurements (same machine, same route, `?fixres`, phone = 844x390 DPR 3 touch x4 CPU, desktop = 1280x720)

Route: Quattro Canti to Politeama to Via della Liberta, kinematic at 14 m/s (200 s), everything else running. "Main ms" is CDP TaskDuration per frame. Both profiles are vsync bound at 16.7 ms on this Mac, so frame time says little; main ms and triangles are the numbers to read.

| | desktop before | desktop after | phone before | phone after |
| --- | --- | --- | --- | --- |
| title: loading screen up (cold, cache off) | 6.3 s | 5.6 s | 13.2 s | 15.4 s |
| title at reveal: tiles full / low / none, GL triangles, draw calls | 1/73/0, 1.19 M, 484 | 1/35/0, 1.03 M, 353 | 1/17/0, 0.78 M, 337 | 1/35/0, 1.06 M, 355 |
| GL triangles per frame, drive median / max | 1.66 M / 2.31 M | 1.04 M / 1.50 M | 0.28 M / 0.93 M (horizon bare) | 1.07 M / 1.47 M |
| draw calls, median / max | 757 / 889 | 476 / 571 | 195 / 416 | 488 / 587 |
| main thread ms per frame | 4.8 | 3.5 | 9.1 | 14.6 |
| render() CPU ms p50 / p95 | 2.8 / 3.8 | 1.9 / 3.0 | 3.7 / 6.3 | 7.6 / 11.4 |
| frames over 50 ms | 2 | 0 | 0 | 3 |
| streamer work over 8 ms (count) | 5 | 5 | 36 | 65 |
| JS heap, max | 709 MB | 339 MB | 456 MB | 434 MB |

What got worse: the phone now does what the desktop used to approach (a shadow pass, 4 full tiles plus a low ring and a horizon), so its main thread is 60 % busier at x4 (14.6 of 16.7 ms), and it has about twice as many streamer steps over 8 ms (more tiles are fetched and parsed; a dense tile parse is the largest step). The lever if a real phone struggles: default tier low (no shadows, about -3.5 ms and -480k triangles), or `triCap` / `rFull` through the URL (`?tricap=`, `?rfull=`) to test.

### Reveal when the view is built, not the whole ring (`visiblePending` in `src/world.js`)

The loading screen (`waitForCity` in `src/main.js`) and the start checkerboard (`settle` in `src/ui.js`) used to wait until the streamer was idle over the whole ring around the camera, including tiles behind it. Now `world.visiblePending()` counts what the camera can see and still needs: tiles whose box meets the camera frustum widened by 80 m (or lying within 220 m of the focus, so the tile under the car always counts) that are below the detail they want, plus far city chunks in view that are not built (and 1 until the manifest, the first allocation and `far.bin` are in). Computed once per frame at the end of `world.update`. Both places lift after two frames at 0 (one frame is drawn after the last build); caps are 25 s (loading) and 7 s / 2.5 s (start / back to the menu). The first-check delay (450 ms) and the 150 ms polls are gone, and the minimum hold in `transition.js` went from 380 to 250 ms.

Order of work follows the same flag (`markView`): visible tiles nearest first, then the rest of the ring nearest first (tasks and fetches both sort on `pd`); the far chunk task goes ahead of the invisible tiles while chunks in view are missing, and `sync` in `src/context.js` picks visible chunks first. `world.overview` is now a setter that asks for a new allocation at once: leaving the title used to wait for the next 0.5 s tick before the ring got its full tiles, so the first reveal could show tiles popping in.

`world.hurry` (set by `waitForCity` and by `startAt` / `quit` in `ui.js` while the screen is covered) raises the per-frame build budget from 2 ms to `cfg.hurryMs` (12 ms, `?whurry=` to tune): the hitches are under the checkerboard. It is the bigger half of the gain on the phone: counter alone, phone cold load 16.0 s to 12.3 s; with hurry 6.7 s.

Cold load, cache off, local server (source tree, not the bundle), `?help=0`. "Start" = click on the spot in the list to the moment the squares start flipping out (cover 0.8 s included). Before = the commit this was built on, after = this change. One run each, noise is a few tenths of a second (desktop) and about 0.5 s (phone).

| | desktop before | desktop after | phone before | phone after |
| --- | --- | --- | --- | --- |
| first loading screen up | 5.4 s | 1.9 s | 16.0 s | 6.7 s |
| start, Teatro Massimo (near) | 2.8 s | 1.2 s | 6.5 s | 2.8 s |
| start, Mondello (far) | 2.8 s | 1.2 s | 7.2 s | 2.8 s |
| start, Monte Pellegrino (far) | 2.5 s | 1.1 s | 6.6 s | 2.0 s |

Pop-in check (`vis` per frame sampled in the page, screenshots at the reveal and 2.5 s and 7 s later from the same camera; the title camera is frozen at its first position for the comparison): the counter stays at 0 after the reveal on the title (frozen camera), Teatro Massimo and Monte Pellegrino, desktop and phone. The static scene (terrain, buildings, streets) is identical between the frames; only pedestrians, traffic, the HUD and the clock change. With the title flyover running, the counter shows 1 now and then: a low detail tile at the edge of the ring (1.4 km, where the far boxes stand in until it is built) flipping in and out of range, and the tile under the camera going to full detail as the flyover passes over it (as before). The rest of the ring (the tiles behind and beside the camera) keeps building after the reveal.

Worse or unchanged: the main thread is blocked for up to 12 ms a frame while covered (the lapa spinner may stutter, not measured); a short stretch right after the reveal still has the rest of the ring building at the normal 2 ms budget, so the full ring is complete later than the reveal (1.6 s on the phone for Mondello, measured). Props, pedestrians and traffic are not in the counter (they appear around the player as they always did).

## Street markets (src/markets.js, tools/make_markets.py, board item 1)

Ballaro, the Vucciria and the Capo carry 197, 143 and 151 stalls laid out along their real streets (`src/markets-data.js`, 18 KB, generated by `tools/make_markets.py` from the baked tiles). Every stall is an instance of a vertex-coloured low-poly model (a table with its goods and frame, 190 to 360 triangles; an awning or a tarp, 42 or 8; a string of bulbs, 42; a pile of crates, 60), one `InstancedMesh` per model and market, 12 per market, drawn only within the market's radius plus 330 m of the camera. The tables and crates cast no shadow (the shadow pass is the expensive one), the awnings do. About 36 stalls get a vendor from the crowd's own sprites (scripted slots, within 62 m of the camera, none at night); the stalls are solid for the lapa (four wall segments each, four more for the pile of crates beside a stall; out of play while the market is not drawn: at night, far away, `?markets=0`) until it hits one fast enough to yeet it (below), and the market lanes are out of the traffic graph.

Measured in the dev tree, same camera on a market street, `?markets=0` against the default (`renderer.info`, per frame, 1280x720, `?fixres`):

| market | draw calls | triangles | frame (p50 / p95 ms, vsync-bound) |
| --- | --- | --- | --- |
| Ballaro | +24 | +69,000 (of about 1.3 M) | 16.7 / 18.3, unchanged |
| Vucciria | +15 | +46,000 | 16.7 / 18.3, unchanged |
| Capo | +22 | +57,000 | 16.7 / 18.4, unchanged |

The ground-floor atlas grew by nine 256 x 256 layers (75 to 84, about 2.4 MB of texels and a third more with the mips) for the new shopfronts (`src/buildings.js`, `g_bar`, `g_tabacchi`, `g_pane`, `g_bottega`, `g_portone`, `g_farm`, `g_mk_a`, `g_mk_b`, `g_mk_c`). Phone profile (844x390 at DPR 3, 4x CPU, at the Ballaro spot, the x5 capture script, `?markets=0` against default): 60.1 fps both, main thread 10.79 against 10.88 ms per frame, 529 against 547 draw calls, 1.55 M against 1.61 M triangles. Desktop: 3.41 against 3.40 ms per frame. `?markets=0` switches the stalls off.

Yeeting the stalls (src/markets.js, `throwPiece` and `lump` in src/props.js): a stall hit at 3 m/s or more (the pile of crates at 1.6) breaks free through the same hook the fence panels use (`hooks.breakFence`, both physics models). Its table is drawn as one mesh until then; at the first smash of a kind the frame and the goods of that kind get a mesh each (`market_wreck`, 64 pieces, drawn only while a market is in range), the whole table is scaled to nothing and the two halves fly apart, the canopy and its bulbs fly off as instances of the market's own meshes, and a dozen loose lumps (fruit, vegetables, fish, cuts, olives, in the colours of the heaps) come out of the bag pool. Everything is thrown like the other yeeted props (`launch`, shared with `yeet`), lands and lies there; a smashed stall stays smashed for the session and its wall segments leave the grid for good, so nothing invisible is left. The lapa gives up 30 percent of its speed into the stall and goes on. Below the threshold a stall is a wall, as before. Cost: nothing per frame (no new meshes or draw calls until a stall breaks, same triangles); each kind of table smashed adds two draw calls while a market is in range (at most ten). Paired runs, same camera on each market street, before against after, `renderer.info`: Ballaro 503 / 494 against 502 / 497 draw calls, 1.30 / 1.29 M against 1.30 / 1.29 M triangles, `renderer.render` on the CPU 2.96 / 2.66 against 2.60 / 2.22 ms, frame 16.6 / 16.6 against 16.6 / 16.7 ms p50 (vsync-bound); Vucciria and Capo the same within noise. Phone profile (844x390 at DPR 3, 4x CPU): draw calls within 3 of each other, frame times scatter by more than the change on a busy machine. Smashing at 12 and 16 m/s: worst frame 19 to 31 ms on desktop, 21 ms on the phone profile (a few programs the smash makes visible for the first time, a traffic tint and the sprites' material, compile then, as before).

## The crowd (src/pedestrians.js, board item 2 of the crowd pass)

Asked for "way more people on the street, everywhere, especially by day". What changed: the quality caps (low / medium / high) from 100 / 240 / 380 to 240 / 640 / 1000 (the default is medium, the phone too), the arrays from 420 to 1000 slots, every district profile multiplied (day: centro streets 2.2x, old town 3x, Libertà 4x, the working-class quarters 7x, ZEN 4.5x, CEP 6x, the coast and the port 5x, Favorita 3.5x, Pellegrino 4x, the beaches 2.2x and 1.6x; night 0.9 of that), the hand-stamped centro hot spots 1.75x by day and 1.7x at night, and a smooth curve over the hour (`todCurve`: half the crowd at 3 in the morning, a rise from 6 to 9, the peak from 11 to 18, an evening decline) on top of the day and night maps. Still one instanced draw for all of them. `?pedk=0.4&peds=240` gives about the old crowd, `?pedk=k` scales the new one.

People on screen (desktop, medium, the camera at each place, from `window.__peds.stats.count`):

| hour | Brancaccio | ZEN | centro | Mondello |
| --- | --- | --- | --- | --- |
| 3 | 43 | 89 | 214 | 45 |
| 8 | 198 | 406 | 656 | 426 |
| 13 | 271 | 510 | 700 (cap) | 578 |
| 19 | 70 | 131 | 347 | 79 |
| 22 | 32 | 86 | 208 | 51 |

Before: Brancaccio 24, ZEN 75 and the centro 240 (the cap) at any hour by day. Cost, phone profile (844x390 at DPR 3, 4x CPU, the x5 capture script, centro, three paired runs, before = `?pedk=0.4&peds=240`): 235 people against 669; the people's own update 0.64 against 1.61 ms per frame; main thread 13.2 against 14.5 ms per frame; 60 fps both. The worst place is the Ballaro market (700 people at the old cap of 700, stalls and 36 vendors on top): 58 to 60 fps at 97 to 99 percent busy on a machine that was busy with other work, which is why medium is 640 and not 700. Desktop: 0.37 ms for 681 people, 20 percent busy. The cost is about 2.5 microseconds per person per frame on the phone profile, plus the spatial hash.

## Pedestrian sprites at 3x (assets/peds, src/pedestrians.js)

The crowd is no longer 75 hand-drawn variants but a cast of 153 generated people (types in `assets/peds/sprites.js`, faces and hair from `people.js`, drawn by a small software rasteriser, `raster.js` + `model.js`: swept solids shaded in four tones, pixel decals for eyes, brows, mouth, stubble, then the outline pass). Same 4 directions (right is the mirrored left) and the same walk cycle, plus a drink pose; same billboard shader, one draw call for the crowd and one for the scripted characters.

LOD (`assets/peds/atlas.js`, 16-bit RGB5_A1 textures filled on the GPU one cell at a time with `copyTextureToTexture`, so no big CPU copy stays):
- far atlas: every cell of the cast at 24 x 54 texels (today's resolution), built after start at 1.2 to 10 ms per frame, entries that are about to spawn first. 2,373 cells, 3.08 Mtexel, 6.2 MB (8.3 MB with the mip chain).
- near atlas: cells at 72 x 162 (3x), filled for a cast entry only when a person of it stands close enough that one near texel covers at least 0.8 screen pixels (leaves at 0.6): that depends on the screen height and the camera lens, so a phone at pixel ratio 1.25 gets about 8 m and a desktop at 1.5 about 17 m, no per-device look switch. LRU slots, 128 cells on touch devices (3.4 MB) and 240 on desktop (5.6 MB, about 15 people), nearest filtered, no mips. At most 2 ms of cell drawing per frame (0.3 to 0.4 ms per near cell on this Mac, 1.4 ms at x4).
- the CPU puts the texel origin of the cell into the instance data, so a person can switch between the two atlases frame by frame; the fragment shader samples both and picks.

Measured before and after (`cap.mjs` style run: spot, `?fixres&debug`, 6 s of frames, CDP TaskDuration; desktop 1280x720 DPR 1, phone 844x390 DPR 3 touch, 4x CPU):

| | before | after |
| --- | --- | --- |
| pedestrian texture memory, desktop (incl. mips) | 7.6 MB RGBA8 (10.1) | 6.2 MB far (8.3) + 5.6 MB near = 13.9 MB |
| pedestrian texture memory, phone (incl. mips) | same (7.6, 10.1) | 6.2 far (8.3) + 3.4 near = 11.7 MB |
| main ms per frame, phone x4: market / Mondello / Politeama / stadium | 13.6 / 12.0 / 12.3 / 10.5 | 11.7 / 11.3 / 11.2 / 10.4 |
| main ms per frame, desktop | 2.5 / 2.7 / 3.0 / 2.6 | 2.6 / 2.3 / 3.2 / 2.7 |
| draw calls (market, Mondello, Politeama, stadium), both profiles | 540 / 496 / 597 / 426 | 540 / 494 / 592 / 426 |
| pedestrian update, phone avg ms | 0.65 / 0.41 / 0.52 / 0.39 | 1.0 / 0.57 / 0.53 / 0.42 (includes the LOD pick and the cell drawing) |
| start: atlas build | blocking, 0.9 to 1.1 s at x4 | none on the loading path; 1.1 s of drawing spread over the first seconds at x4 (0.2 s desktop) |

Notes. The variation between before and after is inside the machine noise listed above; the point is that it did not get worse. Near cells are drawn on the main thread (a worker would need a second bundle entry in `tools/build`, not done). The near atlas capacity is a memory cap, not a look difference (`?pednear=n` sets it as a number of people, `?pednear=0` turns the near LOD off). The pedestrian module gets the renderer from `onBeforeRender` of the sprite mesh (main.js does not pass it), and `UniformsUtils.merge` clones textures, so the atlases are assigned to the material uniforms after the merge.

Stage 2 changes to the same sprites (no cost change, the atlases are the same size): the cel ramp now puts a flat front on the base tone and keeps the light tone for surfaces tilted towards the light (before, every front was the light tone, which made people pale at 10 to 30 m); the far cells get a two pixel outline (one inside, one outside, 0.6 of the deep shade) so the silhouette survives the mip chain; the sprite shader decodes with `pow(c, 2.2)` instead of squaring. Compare `midrange-before-stage1-stage2.png` in the stage 2 shots.

### Pedestrians from the LPC layers (assets/peds/lpc, tools/lpc)

The people are no longer drawn at load time. `node tools/lpc/build.mjs` composes every cast entry (assets/peds/sprites.js) from layers of the Universal LPC Spritesheet Character Generator (body, head, hair, beard, shirt, apron, trousers, shoes...), recoloured with the generator's own palettes, paints our details on top (`tools/lpc/extras.mjs`: caps, fazzoletto, glasses, stubble, band logos, tattoos, vest patches, scarves, bags, bottles, the sip arm, dog, pram, wheelchair), crops all frames to one 38x55 px cell and packs them into `assets/peds/lpc/atlas.png` with `index.json`. At runtime `assets/peds/lpc/atlas.js` fetches both, packs the pixels to 16 bit (RGB 5-5-5 + 1 bit alpha) and uploads one mipmapped texture; there is one level of detail (LPC art is made for about 3.5 cm per pixel, the density the far cells of the generated renderer had) and no CPU drawing at all. `?pedgen` brings the generated renderer back.

| | stage 4 (generated, far + near) | LPC atlas |
| --- | --- | --- |
| pedestrian texture memory (incl. mips) | 6.84 MB far (9.16) + 5.28 MB near = 12.1 MB (14.4) | 10.63 MB (14.25), 2,014 x 2,640, 2,529 cells for 153 entries |
| on the wire | nothing (drawn at load) | atlas.png 727 KB + index.json 27 KB |
| drawing at load and while walking | 0.2 s (desktop) / 1.1 s (x4) of cell drawing spread over the first seconds, 0.4 ms per near cell | none; one PNG decode and a 5.3 Mpixel pack once (measured with the load) |
| main ms per frame, desktop / phone x4, Politeama | 3.6 / 10.6 | 4.4 / 11.9 (machine noise and other scene changes between the runs) |
| draw calls | unchanged | unchanged |

Cells: 3 directions (right is the mirror of left) x poses 0 idle, 1 to 4 walk (run for the joggers), 5 a drink held (drinkers), 6 sit and 7 sit and sip (only the people with a drink can sit). To stay at today's memory the cell is 38 px wide (the couples are cropped to it), sitting cells are lifted 2 px to the standing ground line and the cast keeps sit cells for drinkers only. Credits and the licence note are in `assets/peds/lpc/CREDITS.md` and `LICENSE.md`.

## Phone budget pass (board item x5)

Goal: take main-thread time off the phone profile (844x390, DPR 3, touch UI, 4x CPU slowdown) at the five worst places without changing how either device looks. Desktop and phone run the same graphics settings; nothing below is behind a device check.

### Method

`node tools/build/spotbench.mjs --url <dev server or a served dist> [--runs 3] [--spots qc,ballaro,zisa,porto,mondello] [--desktop]` (new, `tools/build/spotbench.mjs`). Per spot: `?fixres&debug&at=x,z,th`, 7 s to settle, the 4x slowdown on, 4 s more, then 6 s measured. Main ms per frame is CDP `TaskDuration` divided by frames; script, layout plus style, time inside `renderer.render`, draw calls and triangles of the last frame (shadow pass included) come with it. The spots are Quattro Canti (17.5, 0), Ballaro (24.9, 488.6), Piazza Zisa (-1758.8, -43.6), the port at Via Crispi (91.6, -1300.1) and Mondello's piazza (-3033.1, -10177.4), headings as in the script.

Noise is the problem on a shared Mac: the same build moves 1 to 3 ms between runs minutes apart, and the first measuring window after a load is slower than the next ones. So before and after were built from two snapshots of the same tree that differ only in the files listed below (`build.mjs --src=<snapshot>`), served side by side, and measured as concurrent pairs (both pages load and run at the same moment under the same machine load), three pairs per spot, median. Read differences under about 0.5 ms as noise; the draw call counts and the layout column are exact.

### Where the main thread goes (phone profile, 4x, Quattro Canti and Ballaro)

CPU profile, inclusive, per second of wall time at about 30 fps (the frame callback is 570 to 690 ms of that second):
- `renderer.render` 430 to 510 ms: drawing 190 to 250, of which `setProgram` (uniforms and binding state per draw) 110 to 130; `projectObject` (walking the scene) 88 to 97; the shadow pass 79 to 89 (it is on: the default tier is medium on every device, 1024 map); `updateMatrixWorld` 52 to 60.
- game code 110 to 130 ms: pedestrians 20 to 38, traffic 34 to 54, sea 11, minimap 11, police beacons 12.

So the frame is dominated by what three.js does per draw call and per object, about 560 calls (360 in the main pass, 195 in the shadow pass at Quattro Canti), not by triangles or by any one game system. Switching pieces off in one page, one 3 s window each (main ms per frame against the window before and after; differences of 0.5 ms or less are noise):

| piece off | Quattro Canti | Ballaro | Porto | Mondello | calls removed (QC / Ballaro) |
| --- | --- | --- | --- | --- | --- |
| shadow pass | -1.5 | -2.0 | -2.3 | -1.3 | 195 / 189 |
| all props (groups hidden) | -0.8 | -1.9 | | | 231 / 249 (105k / 190k triangles) |
| rubbish piles (bags, bag_pile, mega, litter, cardboard, dump, mwaste, mcrates) | 0.0 | -0.4 | | | 45 / 63 (21k / 43k triangles) |
| trees and shrubs | -0.4 | -0.4 | | -0.1 | 56 / 60 |
| street furniture (lamps, bollards, benches, kiosks ...) | -0.8 | 0.0 | | | 62 / 47 |
| boats | -0.4 | -0.7 | -0.6 | -0.1 | 0 |
| far city (context chunks, far terrain) | -0.6 | -1.7 | 0.0 | -0.7 | 38 / 50 |
| streets and terrain | -1.5 | | -0.9 | -1.3 | 62 / |

The rubbish piles are 8 to 11 % of the draw calls and 1 to 3 % of the triangles but cost 0 to 0.4 ms of main thread, so thinning them would change the look for almost nothing. I left them. The same goes for every prop kind on its own: props as a whole are 40 % of the calls and 1 to 2 ms, spread over 100 cell meshes a pass.

### What changed (phone and desktop alike, nothing looks different)

1. DOM writes every frame (`src/main.js`, `src/event-hud.js`). A MutationObserver on the running page showed 3 mutations a frame: the speed digits and the `km/h` label were rewritten every frame, and my own edge arrow for event destinations (x e4) toggled its class twice a frame even when nothing changed. A DOM write of the same value still invalidates style, so the browser did a style recalculation every frame. The HUD text and the arrow class are now written only when they change. Layout plus style: 0.5 to 0.7 ms a frame down to 0.2 to 0.3 (0.15 desktop to 0.05).
2. Frozen matrices for the prop cells (`src/props.js`). Every prop tile group and every cell mesh composed and multiplied its matrix every frame, and a group that updates forces all of its children to as well. The groups and the instanced meshes (they never move, the instances do) now have `matrixAutoUpdate = false`. Objects that recompute their world matrix every frame at Quattro Canti: 1301 down to 534.
3. Shadow distance for small props (`SHADOW_D` in `src/props.js`). Parked cars already stopped casting beyond 60 m. Things narrower than about a metre (bollards, hydrants, phone boxes, post boxes, cabinets, small bins, fountains, litter, cardboard, crates, bus stop signs: 60 m) and up to about two metres (bag piles, big bins, scooters, cafe sets, benches, stall tables: 80 m) now stop casting at those distances too. At 1024 texels over 320 m a texel is 0.31 m, so these are one to three texels of shadow, and the mesh is still drawn. This is the only change that is not pixel-identical (a far bollard shadow is gone); it removes 9 to 30 shadow draws a frame (30 at Quattro Canti and Ballaro, 18 at Zisa, 27 at the port, 9 at Mondello). The table is one line to revert.
4. Boats far away are sampled less often (`animateBoats` in `src/sea.js`): within 500 m every frame, to 2 km every 4th, beyond every 8th. The matrix still comes from the absolute time, only the sampling is sparser; heave is 5 cm and pitch under 2 degrees, invisible at that distance.
5. Window size reads (`src/viewport.js`, new, used by `src/police.js`, `src/shouts.js`, `src/vehicle.js`, `src/event-hud.js`). `innerWidth` and `innerHeight` can make the browser lay the page out when something changed this frame; they are read once and on resize instead.

### Result (median of three concurrent pairs, phone profile 4x; "before" is the same tree without the five items above)

| | main ms before | main ms after | change | calls before / after | layout + style before / after |
| --- | --- | --- | --- | --- | --- |
| Quattro Canti | 12.43 | 11.48 | -0.95 (-8 %) | 568 / 538 | 0.53 / 0.19 |
| Ballaro market | 15.75 | 14.51 | -1.24 (-8 %) | 595 / 565 | 0.62 / 0.22 |
| Piazza Zisa | 12.35 | 11.30 | -1.05 (-9 %) | 471 / 453 | 0.64 / 0.21 |
| the port | 10.37 | 9.64 | -0.73 (-7 %) | 469 / 442 | 0.55 / 0.20 |
| Mondello piazza | 12.39 | 11.14 | -1.25 (-10 %) | 468 / 459 | 0.72 / 0.34 |

The absolute numbers are higher than a quiet run (two browsers share the machine in a pair; a single quiet run of the old build reads 9 to 13 ms); the differences are the point, and in all 15 pairs (taken in the order they finished) the new build was ahead. Desktop (1280x720, no slowdown, one run each): Quattro Canti 3.29 to 3.02 ms and Ballaro 3.88 to 3.52 ms, calls 535 to 502 and 583 to 551.

### Not done, and why

- Thinning the rubbish piles: see the table, 0 to 0.4 ms for a visible change.
- Updating the shadow map every other frame, or tightening the shadow box: the biggest single piece (1.3 to 2.3 ms, 13 to 20 %), but it would show (lagging shadows on moving things, less shadow range). If a real phone needs it, the least visible lever is the shadow box (`left/right/top/bottom` 160 m in `src/main.js`) or the tier (`low` has no shadow pass).
- Fewer, bigger prop meshes (one per tile instead of per 250 m cell and model): a bigger mesh has a bigger bounding sphere, so small props would be drawn further out than their `FAR` distance. That changes the look.
- Far city chunks (23 draws at Quattro Canti, 0.6 to 1.7 ms): already 2 km chunks with one material; the cost is the draws themselves.
- Pedestrians and traffic: already budgeted (docs above); 1 to 2 ms together and nothing that stood out in the profile.

### For `src/world.js` (not touched, routed to the lead)

- Freeze the tile parts. 279 of the 534 objects that still recompute a world matrix every frame at Quattro Canti are under the `world` root (groups made at `world.js` 444, 634, 713, 783, 800, 817 and their meshes; only the meshes made at 453 and in `buildings.js` are frozen already, and a parent that updates forces its children anyway). `setPart` (line 328) could freeze each part it adds: `obj.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; })`. Setting it from the page console on the whole `world` subtree took the count from 534 to 256 and the objects are static (a grep of the landmark, building, garden, stadium, fence and world code finds no `rotation` or `position` writes on them). The frame time effect is inside the noise on this machine (the profile puts `updateMatrixWorld` plus its multiplications at about 60 to 80 ms per second at 4x for 1300 objects, so the remaining half is worth up to roughly 0.5 ms a frame); the object count is exact.
- The building chunks are the biggest part of the shadow pass (17 meshes, 297k triangles at Quattro Canti, 275k of them cast). A chunk is drawn into the shadow map whole if its bounding sphere touches the 320 m shadow box, so most of that is outside the box. Splitting the chunks smaller for the shadow pass (or a depth-only low detail version) would cut GPU work in the shadow pass; it does not change the draw call count, so on the main thread it is worth nothing, on a real phone GPU it may.

## Cost of the 7 November releases, and the night wash (perf7)

Main (ce0aecbd) against 2029a851 (the evening before), production builds loaded side by side in one headless Chrome, phone profile (844x390 at DPR 3, touch, 4x CPU, `?fixres`), two runs per spot at 12:00 and 22:00, eight spots. Main thread: within noise everywhere (pairs differ by -0.9 to +0.7 ms, mostly +0.1 to +0.3) except Via Guadagna (+0.6 and +2.7 by day, +0.6 and +0.9 at night, on a busy machine) and Belmonte (+0.3 to +1.3). Draw calls: unchanged (Belmonte 25 fewer). Triangles: Via Guadagna +26k by day and +41k at night (the parked cars of the outskirts pass), Belmonte +61k and +92k (the town), elsewhere within 15k. GPU memory: Belmonte +22 MB, elsewhere +1 to +5 MB. The parked cars stay 13 draws at Via Guadagna (four models in 100 m cells) and the wire lamps, zebras and billboards were already merged or instanced.

The one clear GPU cost is the night wash on every material (5fecdaa0). In WebKit on this Mac's GPU (`tools/perf/gpucost.mjs costs --q time=22`, k = 4) switching the wash off saves 10 to 15 % of the GPU frame at night. Changed in `src/daynight.js`, no pixel changes:
- the floodlight loop runs only on walls inside the box round the seven discs, and each disc only within its radius (outside, the term was exactly 0): 2 to 5 % of the GPU frame at night (`--v washorig` puts the old loop back in the same page; `gpucost diff --v washorig`: no pixel differs at Via Maqueda, Ballaro, Via Guadagna and Monreale, 0.002 % by at most 4 of 255 at Quattro Canti).
- the discs are constants in the shader text instead of a uniform array (three.js flattens and uploads a uniform array on every draw that changes material, by day too): `uniform4fv` 42 calls a frame to none at Quattro Canti.
- the hook that washes a material on its first draw takes itself off the material afterwards (it ran on every standard draw).
The main thread did not move measurably (main against this, two concurrent pairs per spot and hour: -0.5 to +0.6 ms).

## Night against day on the main thread, and the freeze at dusk

The perf7 tables read night as 1 to 4 ms dearer than day on the main thread. Measured in one page (the clock frozen with `?timespeed=0` and jumped with `pd-time-hour`, so the place, the tiles and the load are the same; phone profile, 4x CPU, headless Chrome on the M3 Max), it is not: at Quattro Canti `renderer.render` is 6.6 to 6.8 ms by day and 6.7 to 7.0 at night, and the whole main thread is the same or lower at night because the night crowd is smaller (271 people against 999). Mondello: render 8.0 to 8.2 by day, 8.1 to 8.4 at night. The big gaps in perf7 were separate page loads measured two at a time on a busy machine (the same build moves 1 to 3 ms between loads).

What night did cost:
- **A freeze at the first dusk**: the two point lights and the headlight spot were added to the scene the first time it got dark. The number of lights is part of every three.js program, so every lit material in view recompiled in that frame: one task of 340 to 560 ms at Quattro Canti, Via Maqueda, Ballaro and Mondello (32 to 40 programs). A phone compiles slower. A game started at night paid the same, during loading or just after.
- **About 30 programs kept twice**: each material keeps its program from before the lights as well, 93 to 106 programs at night against 63 to 68 by day.
- The night-only materials (lamp glows, light pools, headlight cones and decals) compiled on their first frame too.

Changed in `src/daynight.js`: the three real lights are in the scene from the start (not on Low quality), at intensity 0 by day, so the light count never changes; the lamp materials are made once and reused when the lamps are rebuilt; the night-only materials are compiled while the game loads (`renderer.compile`). Going from day to night now compiles nothing (+0 programs at Quattro Canti and Ballaro, +2 from elsewhere at Via Maqueda and Mondello) and the worst frame of the change is 17 to 67 ms; programs are 64 to 70 by day and at night.

The price: by day the dark lights' uniforms are uploaded with each program change (`uniform3f` 94 to 190 calls a frame at Quattro Canti), 0.2 to 0.35 ms of `renderer.render` at 4x (lights in against lights out in one page, five alternating windows, Quattro Canti and Mondello). On the GPU a dark light costs a branch (`src/shading.js` skips its BRDF). By day the picture is the same: with and without the dark lights in one page, at most 6 of 5.3 million colour values differ, by 1 of 255.

Main ms per frame, phone profile 4x, `?fixres`, before (e0c4db68) and after, two runs each, the builds alternated in turn (not side by side), mean of the two:

| spot | day before | day after | night before | night after | programs day / night before | after |
| --- | --- | --- | --- | --- | --- | --- |
| Quattro Canti | 11.19 | 12.05 | 11.76 | 10.84 | 68 / 96 | 70 / 70 |
| Via Maqueda | 12.20 | 12.21 | 11.66 | 11.91 | 66 / 99 | 68 / 69 |
| Ballaro | 12.51 | 12.88 | 12.93 | 12.69 | 66 / 96 | 68 / 68 |
| Mondello | 11.81 | 12.60 | 12.44 | 12.76 | 63 / 93 | 65 / 65 |

The two runs of one cell differ by up to 3.2 ms, so this table cannot show 0.3 ms either way; the in-page numbers above are the ones to read. Desktop Chrome with CPU throttling is a stand-in for a phone: it scales the JS, not the GPU or Safari's shader compiler.

## The week of 4 to 8 November: what it cost, and what was taken back (11 November)

The goal behind this pass: the game at 60 fps with full graphics on an older iPhone (XR or 11). The pass of 4 November ended at aa685c26; main is 45 commits on (e0ba3fd7), with real clouds and their shadows, weather, the night wash on the whole city, supermarkets, billboards, the survey buildings of the towns, tunnel portals, graffiti, parked cars on every street and traffic that overtakes. This is what those cost, measured, and the part that could be removed without changing the picture. **No iPhone was measured.** A Mac's GPU is never the limit at the phone's resolution, so GPU costs are shares of the frame at 16 times the phone's pixels (`gpucost.mjs`, k = 4), not phone milliseconds.

About the noise, because it decides what the numbers can carry. The Mac was shared with other agents all day (load average 10 to 40, other WebKit and Chrome pages drawing at the same time). Counts are exact (draws, triangles, GL calls, programs, bytes). Times are not: the same build moved by 1 to 3 ms of main thread between runs, and by 5 % or more of the GPU frame between rounds. So every time below comes from alternation: two builds loaded at the same moment and run side by side, or one page that switches a feature off and on in turn. A GPU share under about 3 % is inside the noise unless the rounds agree in sign.

### What the week cost

**Draw calls and triangles: nothing, except the new towns.** `gpucost.mjs census --frames 40` (WebKit, mean of 40 frames, what reaches GL: the part drawing of `src/engine-lean.js` makes three's own count too high), cumulus sky, the high camera of the earlier passes, aa685c26 against e0ba3fd7. The shadow pass is included in the draws and triangles; its own column is the usual frame (the cached static map redraws a slice of 100k to 400k triangles on about one frame in ten, in both builds).

| spot, hour | draws base | draws main | triangles base | triangles main | shadow pass triangles, usual frame (base / main) | programs | uniform calls a frame |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Quattro Canti, 12 h | 353 | 353 | 363k | 360k | 12k / 12k | 71 / 73 | 395 / 562 |
| Quattro Canti, 22 h | 361 | 372 | 357k | 334k | 12k / 12k | 100 / 72 | 502 / 542 |
| Via Maqueda, 12 h | 381 | 374 | 444k | 431k | 24k / 23k | 69 / 71 | 498 / 687 |
| Via Maqueda, 22 h | 400 | 392 | 441k | 426k | 23k / 22k | 103 / 72 | 620 / 668 |
| Ballaro, 12 h | 451 | 446 | 669k | 655k | 22k / 22k | 68 / 70 | 408 / 576 |
| Ballaro, 22 h | 444 | 438 | 594k | 575k | 22k / 21k | 97 / 70 | 502 / 538 |
| Vucciria, 12 h | 243 | 241 | 229k | 230k | 17k / 19k | 68 / 71 | 310 / 461 |
| Vucciria, 22 h | 318 | 308 | 238k | 225k | 19k / 16k | 97 / 73 | 545 / 576 |
| Viale Regione, 12 h | 488 | 492 | 808k | 803k | 21k / 22k | 67 / 70 | 327 / 500 |
| Viale Regione, 22 h | 495 | 499 | 800k | 793k | 21k / 22k | 96 / 70 | 430 / 484 |
| Mondello, 12 h | 484 | 474 | 716k | 713k | 18k / 18k | 67 / 68 | 324 / 496 |
| Mondello, 22 h | 472 | 468 | 699k | 710k | 19k / 19k | 94 / 68 | 428 / 482 |
| Monreale, Duomo, 12 h | 314 | 405 | 303k | 597k | 19k / 21k | 66 / 67 | 436 / 619 |
| Monreale, Duomo, 22 h | 323 | 405 | 299k | 586k | 20k / 19k | 97 / 68 | 552 / 605 |
| Via Guadagna, 12 h | 327 | 340 | 281k | 282k | 16k / 17k | 66 / 69 | 492 / 661 |
| Via Guadagna, 22 h | 336 | 338 | 256k | 279k | 17k / 16k | 98 / 69 | 604 / 645 |

Seven of the eight spots draw what they drew on 4 November, within the traffic and crowd of the moment. Monreale went from 303k to 597k triangles and from 314 to 405 draws: that is the town itself (392f5942, aeda4dc4: survey buildings, walls and fences, trees and props, the far relief). Supermarkets, billboards, graffiti, tunnel portals, the pine row and the parked cars went into the existing pools and atlases and do not show as draws. Programs: 1 to 3 more by day (clouds, rain, the billboards' poster), about 28 fewer at night since the lights stay in the scene all day.

The same count from the chase camera (the game's default, and the one the GPU shares below use), noon, with the tree after this pass as the third figure:

| spot, hour | draws base | draws main | draws cut | triangles base | triangles main | triangles cut | shadow pass triangles, usual frame (base / main / cut) | programs | uniform calls a frame |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Quattro Canti, 12 h | 334 | 342 | 326 | 327k | 329k | 337k | 12k / 12k / 13k | 71 / 73 / 73 | 389 / 548 / 452 |
| Via Maqueda, 12 h | 370 | 370 | 384 | 417k | 408k | 414k | 25k / 25k / 25k | 69 / 71 / 71 | 493 / 681 / 569 |
| Ballaro, 12 h | 423 | 424 | 419 | 601k | 594k | 585k | 21k / 22k / 22k | 69 / 71 / 71 | 411 / 581 / 477 |
| Vucciria, 12 h | 339 | 329 | 381 | 344k | 335k | 425k | 17k / 18k / 19k | 70 / 74 / 73 | 350 / 521 / 443 |
| Viale Regione, 12 h | 490 | 492 | 497 | 751k | 745k | 723k | 20k / 20k / 20k | 67 / 70 / 70 | 331 / 508 / 408 |
| Mondello, 12 h | 490 | 470 | 485 | 684k | 699k | 688k | 19k / 19k / 19k | 67 / 67 / 68 | 324 / 496 / 404 |
| Monreale, Duomo, 12 h | 321 | 409 | 405 | 276k | 544k | 559k | 19k / 19k / 20k | 66 / 67 / 68 | 474 / 667 / 567 |
| Via Guadagna, 12 h | 325 | 332 | 327 | 283k | 295k | 309k | 18k / 18k / 18k | 66 / 69 / 69 | 492 / 661 / 561 |

The 381 draws and 425k triangles of the last tree at Vucciria were the moment, not the tree: two more loads of each gave 333 draws on main and 330 on the last tree, 334k triangles on both, 521 and 417 uniform calls.

**Uniform calls: +150 to +190 a frame by day, +30 to +55 at night.** Three sources: the two lamp lights and the headlight kept in the scene all day (their place in view space changes with the camera, so each program gets `uniform3f` calls for them every frame: about 110), the light probe that carries the sky's reflection since c9fc36a9 (a `uniform3fv` of 9 vectors on every material change, about 44; three.js does not compare arrays) and the cloud shadows' box, which moves with the wind (a `uniform4f` in each program, about 27).

**Main thread: about +1.2 ms a frame at the 4x slowdown.** `cpuprofile.mjs`, phone profile (844 x 390 at DPR 3), unminified production builds of both trees loaded at the same moment, two pairs per scene and hour. The absolute numbers are high because two throttled pages share a busy machine; read the differences.

| scene, hour | main thread ms a frame, base to main (each pair) | renderer.render | clouds.update | traffic |
| --- | --- | --- | --- | --- |
| Quattro Canti, 12 h | 13.32 to 13.93 (+0.47, +0.74) | 8.62 to 8.91 | 0.00 to 0.37 | 0.68 to 0.69 |
| Quattro Canti, 22 h | 14.59 to 15.44 (+0.87, +0.83) | 10.10 to 10.51 | 0.00 to 0.35 | 0.80 to 0.91 |
| Via Maqueda, 12 h | 20.75 to 22.05 (+1.07, +1.53) | 11.48 to 12.02 | 0.00 to 0.32 | 1.35 to 1.55 |
| Via Maqueda, 22 h | 18.68 to 20.42 (+1.91, +1.57) | 10.88 to 11.59 | 0.00 to 0.37 | 1.47 to 2.08 |
| Ballaro, 12 h | 20.42 to 20.51 (+0.83, -0.65) | 10.65 to 10.57 | 0.00 to 0.40 | 1.73 to 1.78 |
| Ballaro, 22 h | 28.05 to 28.25 (-0.31, +0.71) | 15.29 to 14.84 | 0.00 to 0.44 | 3.12 to 3.17 |
| Vucciria, 12 h | 11.43 to 12.00 (+0.38, +0.76) | 6.46 to 6.62 | 0.00 to 0.31 | 0.63 to 0.69 |
| Vucciria, 22 h | 13.29 to 14.20 (+0.95, +0.87) | 7.96 to 8.31 | 0.00 to 0.36 | 0.80 to 0.97 |
| Viale Regione (driving), 12 h | 19.45 to 20.31 (+1.90, -0.19) | 10.82 to 11.31 | 0.00 to 0.40 | 2.46 to 2.62 |
| Viale Regione (driving), 22 h | 23.05 to 24.64 (+2.18, +0.99) | 13.11 to 13.55 | 0.00 to 0.31 | 2.92 to 3.21 |
| Mondello, 12 h | 22.41 to 23.25 (+1.28, +0.38) | 12.98 to 13.28 | 0.00 to 0.41 | 1.25 to 1.41 |
| Mondello, 22 h | 23.88 to 24.84 (+0.84, +1.08) | 14.91 to 15.03 | 0.00 to 0.39 | 1.89 to 1.86 |
| Monreale, Duomo, 12 h | 18.23 to 21.74 (+2.06, +4.96) | 12.67 to 14.58 | 0.00 to 0.46 | 1.09 to 1.27 |
| Monreale, Duomo, 22 h | 17.46 to 19.81 (+2.58, +2.13) | 12.48 to 14.09 | 0.00 to 0.36 | 1.13 to 1.24 |
| Via Guadagna, 12 h | 16.29 to 17.57 (+1.41, +1.15) | 10.93 to 11.46 | 0.00 to 0.49 | 1.39 to 1.85 |
| Via Guadagna, 22 h | 17.19 to 18.16 (+1.59, +0.37) | 11.75 to 12.21 | 0.00 to 0.23 | 1.00 to 1.35 |

29 of 32 pairs are slower on main, by 1.16 ms on average (median 0.99). Where it goes: `clouds.update` 0.3 to 0.5 ms (new), `renderer.render` +0.2 to +0.7 ms (the uniforms above; +1.6 to +1.9 at Monreale for its 91 extra draws), traffic +0.05 to +0.6 where there is traffic (42ada03f, overtaking), the weather and the palette 0.05. Ballaro is inside the noise.

**Memory: +19 MB of textures, 8 of them for nothing.** `memory.mjs --phone --at x,z --no-drive --starts 0`, after a load at each spot, MiB (aa685c26 / e0ba3fd7 / after this pass):

| spot | GPU textures (base / main / cut) | GPU buffers | geometry kept in JS | 2D canvases | heap + ArrayBuffers after a collection | renderer process |
| --- | --- | --- | --- | --- | --- | --- |
| Quattro Canti | 255 / 273 / 265 | 75 / 74 / 74 | 47 / 48 / 48 | 16 / 16 / 16 | 118 / 122 / 123 | 262 / 281 / 274 |
| Via Maqueda | 255 / 273 / 265 | 33 / 34 / 34 | 75 / 74 / 73 | 16 / 16 / 16 | 140 / 140 / 140 | 289 / 293 / 291 |
| Ballaro | 262 / 281 / 273 | 72 / 70 / 70 | 44 / 49 / 53 | 16 / 16 / 16 | 115 / 124 / 135 | 255 / 286 / 285 |
| Vucciria | 256 / 275 / 267 | 30 / 30 / 30 | 71 / 71 / 72 | 16 / 17 / 17 | 134 / 137 / 137 | 285 / 297 / 292 |
| Viale Regione | 206 / 224 / 216 | 45 / 46 / 45 | 55 / 55 / 55 | 11 / 11 / 11 | 125 / 127 / 128 | 271 / 271 / 269 |
| Mondello | 210 / 223 / 215 | 50 / 49 / 50 | 23 / 24 / 23 | 11 / 11 / 11 | 87 / 90 / 89 | 228 / 234 / 227 |
| Monreale, Duomo | 206 / 231 / 223 | 24 / 32 / 32 | 51 / 68 / 62 | 11 / 11 / 11 | 117 / 141 / 132 | 250 / 287 / 274 |
| Via Guadagna | 243 / 262 / 254 | 38 / 38 / 39 | 67 / 68 / 67 | 11 / 11 / 11 | 134 / 137 / 136 | 275 / 289 / 280 |

The +19 MB of GPU textures on main: the billboards' advert atlas 8.0 (2048 x 768, uploaded at the start wherever the player is), the supermarket signs 5.3 where a store is near, three more layers in the wall array 4.0, two more facade layers 0.7, the puff atlas and the cloud shadows 0.5. Canvases did not grow (every new painted texture is freed after upload). Monreale holds 17 MB more geometry in JS and 8 MB more buffers: the town.

**GPU, by feature, in WebKit.** One page, the feature switched off and on in turn, chase camera, median of the paired rounds, share of the frame at 16 times the phone's pixels. On main at noon under cumulus (10 rounds):

| spot | the three dark lights hidden | cloud shadows off | the old painted sky put back |
| --- | --- | --- | --- |
| Quattro Canti | -12.3 % | -3.5 % | +0.7 % |
| Via Maqueda | -13.4 % | -3.5 % | -2.7 % |
| Ballaro | -11.0 % | -1.2 % | +1.6 % |
| Vucciria | -13.1 % | -1.7 % | +0.4 % |
| Viale Regione | -6.7 % | -4.0 % | +12.3 % |
| Mondello | -7.6 % | -2.7 % | +7.3 % |
| Monreale, Duomo | -8.7 % | -1.0 % | -6.0 % |
| Via Guadagna | -12.7 % | +1.2 % | +4.9 % |

The dearest thing by day was not a feature anyone sees: the lamp lights and the headlight, dark, cost 7 to 13 % of every noon frame, because three.js works a light out for each pixel before finding it dark. The cloud shadows are 1 to 4 %. The painted clouds the sky dome had before cost 7 to 12 % where the sky is open and nothing in the centro; the dome no longer paints them, so under cumulus the real clouds about pay for themselves.

The cloud puffs, hidden against shown, and drawn as whole squares against fitted (below), on the tree after this pass, 6 rounds:

| spot, sky, hour | puffs hidden | whole squares for fitted |
| --- | --- | --- |
| Quattro Canti, cumulus, 12 h | -3.7 % | -0.7 % |
| Viale Regione, cumulus, 12 h | -9.5 % | +6.3 % |
| Mondello, cumulus, 12 h | -4.6 % | +0.1 % |
| Monreale, cumulus, 12 h | +3.9 % | -0.6 % |
| Viale Regione, cumulus, 22 h | -9.2 % | |
| Quattro Canti, overcast, 12 h | -3.4 % | -2.6 % |
| Viale Regione, overcast, 12 h | -20.4 % | +8.4 % |
| Mondello, overcast, 12 h | -13.8 % | +7.3 % |
| Quattro Canti, rain, 12 h | -3.3 % | -1.3 % |
| Viale Regione, rain, 12 h | -20.6 % | +7.5 % |
| Mondello, rain, 12 h | -9.9 % | +5.2 % |

Each weather against cumulus in the same page (`--v wx=...`, 45 s for the sky to settle, 6 rounds): clear +0.8 % at Quattro Canti, -5.6 % on Viale Regione, -3.8 % at Mondello; scirocco +0.7, +2.2, -3.2 %; overcast +5.4, +21.3, +20.0 %; rain +2.8, +20.5, +30.6 %. A grey sky costs a fifth of the frame where the sky is open, and it is the puffs: there are nearly twice as many clouds, they are bigger, and every one is blended over the last. In rain the streaks themselves are inside the noise (+2.4, 0.0, -4.0 %) and the wet ground is 0 to 6 % (-5.6 % at Quattro Canti, -5.9 and +1.0 on Viale Regione in two runs, -4.4 and -1.0 at Mondello).

At 22:00 on main (10 rounds): the night wash off takes 7 to 15 % from the frame (Quattro Canti -14.7, Via Maqueda -11.4, Ballaro -9.8, Vucciria -15.4, Viale Regione -7.0, Mondello -12.9, Monreale -11.1, Via Guadagna -12.8), the two lamp lights and the headlight, lit, 5 to 24 % (-13.9, -20.6, -18.1, -24.2, -4.8, -7.5, -23.8, -8.9; a second run after this pass gave -15.3 at Quattro Canti, -15.1 at Ballaro and -17.2 on Viale Regione, so the low figures of the open spots are not firm).

The new town was not switched off in a page; the two checkouts were loaded in turn instead (`whole`, three loads each, noon). In the Duomo square of Monreale the frame at 16 times the phone's pixels went from 6.9 to 8.3 ms a draw, about 20 % longer, every sample of main above every sample of aa685c26. About 9 points of that are the dark lights of the table above; the rest is the town and the sky, not separated.

### What was taken back

Each is its own commit with its numbers; the picture was compared in one page at a fixed instant, the saving switched off and on (`gpucost.mjs diff`).

- **The dark lights cost nothing in the shader** (`src/shading.js`): a light whose colour is zero is skipped before its direction, distance, falloff and cone. The old path against the new one at noon, the frame longer by 7.6 % at Quattro Canti, 10.0 Via Maqueda, 6.3 Ballaro, 13.0 Vucciria, 5.8 Viale Regione, 5.7 Mondello, 5.6 Monreale, 11.0 Via Guadagna.
- **The dark lights send no uniforms** (`src/daynight.js`): while a light is at intensity 0 the vectors three keeps for it are held still, so no program's copy changes. Uniform calls a frame, chase camera, noon: 548 to 452 at Quattro Canti, 681 to 569 Via Maqueda, 581 to 477 Ballaro, 521 to 443 Vucciria, 508 to 408 Viale Regione, 496 to 404 Mondello, 667 to 567 Monreale, 661 to 561 Via Guadagna. The time it saves could not be resolved (0.20 ms a frame, give or take 0.88, at 4x). It reaches into three.js r187 internals and does nothing where they are not as expected.
- **The cloud shadow is looked up only where the sun reaches**: too small to measure (the whole shadow is 1 to 4 %).
- **The night wash reads one lamp field a pixel, not two**: inside the noise as well (the old form against the new one, between 4.7 % shorter and 3.4 % longer over eight spots).
- **Clouds out of view are not placed, sorted and uploaded** (`src/clouds.js`): `clouds.update` in a tight loop at 4x with the camera turning, 0.37 to 0.05 ms a frame on a clear day, 0.29 to 0.08 under cumulus, 0.50 to 0.30 under an overcast sky. Over 400 random views each under cumulus and rain, none of the puffs left out was inside the frustum.
- **The advert atlas is painted when the first billboard is placed** (`src/props.js`): 8 MB of GPU memory less everywhere but near a billboard (the memory table above).
- **A puff is an octagon round what its texture holds, cut at the cloud's base** (`src/clouds.js`, the last column of the puff table): 6 to 8 % of the frame on Viale Regione under every sky, 5 to 7 % at Mondello under a grey one, nothing in the centro.

The pixel comparisons, on the final tree on top of a4a50947 (whose `diff` holds the clock between the two draws), at Quattro Canti, Ballaro, Viale Regione, Mondello and the Duomo square of Monreale at 12:00, 18:30 and 22:00, each saving put back as it was: 0 pixels differ for the dark lights, the uniform hold, the cloud shadow, the wash and the cloud cull, at every spot and hour, and the frame against itself is 0 everywhere. The fitted puffs differ on 13 to 39 of the frame's 1.3 million pixels in the centro, 187 to 320 on Viale Regione and 131 to 202 at Mondello, never by more than 1 of 255 (0 at Monreale): a puff's texture coordinate is interpolated across other triangles, which moves its last bit. In rain and under an overcast sky on Viale Regione and at Mondello the same (438 pixels at most, 0.033 %, by 1). Before the clock was held, Quattro Canti and Mondello could not be read (two captures of one instant differed by themselves); they can now. The billboard was compared by eye in pictures from the two trees.

Tried and dropped: skipping a lit lamp or the headlight for a pixel beyond its range. Same picture, but at 22:00 the frame was 2.3 to 4.7 % shorter without the test than with it, so it is not in.

### Not cut, and what each costs

Nothing here can go without changing the picture, or it needs work beyond a perf pass.

- **The puffs under a grey sky**: still 10 to 21 % of the frame where the sky is open, after the fitting. What would take it down changes the picture: fewer or smaller clouds in the grey sky (`EXTRA` in `src/clouds.js`), the clouds drawn into a smaller buffer, or one flat layer for the far ones.
- **The night wash**: 7 to 15 % of a night frame.
- **The lamp lights and the headlight when lit**: 5 to 24 % of a night frame.
- **The cloud shadows**: 1 to 4 % by day. **The wet ground**: 0 to 6 % in rain.
- **Monreale's town**: +91 draws, +290k triangles, +2 to +5 ms of main thread at 4x in the Duomo square. Merging its buildings by material at build time, or a coarser far copy, would be the way; neither was tried.
- **Traffic that overtakes**: +0.05 to +0.6 ms at 4x where there is traffic.
- **The light probe's and the cloud box's uniforms**: about 70 calls a frame.
- **Textures**: the supermarket signs 5.3 MB near a store, three wall layers 4.0 MB, two facade layers 0.7 MB.

### Switches for measuring (test links and `?debug` calls)

`?weather=clear|cumulus|overcast|scirocco|rain` holds a state and `?clouds=off` leaves the clouds and their shadows out (both existed); `?lighthold=off` lets the dark lights' uniforms follow the camera again (new). With `?debug`: `game.weather.set(name, seconds)`, `game.clouds.setOn(v)`, `.setShadows(v)`, `.setCull(v)`, `.setTight(v)`, `game.dayNight.setLightHold(v)`. In `gpucost.mjs`: `--v clouds0,rain0,wet0,csh0,wash0,lamps0` switch a feature off, `skyfbm` puts the old painted sky back, `--v wx=rain` is another weather against the page's own, `--v darklights,cshall,wash2,cloudquad,cloudcull0,lhold0` put each saving of this pass back as it was, `--v same` is the floor of `diff`; `census --frames 40` counts what reaches GL; `whole` times a checkout's frame for comparing two. `switchcost.mjs` (new) times a switch inside one Chrome page, and with `--bench` in tight loops. `clouds0` and `rain0` first hid a mesh that its own update showed again the next frame, and measured nothing; they hold it hidden now.

### Smells met on the way (not touched)

- The boats (three instanced meshes, 53k triangles) are drawn whenever the coast is inside the frustum, from Monreale too.
- `washtex0` in `tools/perf/probe.js` no longer matches the wash's shader (it reports a third of the frame, which is wrong).
- `gpucost.mjs --spots` splits on commas, so a raw `x,z` cannot be passed; and it defaults to the high camera, which hides the sky.
- three.js uploads array uniforms without comparing them: the light probe's 9 vectors go up on every material change.
- `src/traffic.js`, `src/police.js` and `src/gags.js` still branch on a coarse pointer, against the one profile for every device.
- The uniform hold of the dark lights depends on three.js r187 internals: check it at the next three.js update.

## Pipeline

- `tools/build/` (own `package.json`, pinned: esbuild 0.28.2, three 0.187.0, sharp, puppeteer-core). `cd tools/build && npm ci && node build.mjs` writes `dist/`. The source tree, the import map and the python dev server are untouched.
- `.github/workflows/pages.yml`: on push to `main` (and manually) builds `dist/` and deploys it with `actions/upload-pages-artifact` + `actions/deploy-pages`. Pages source is now "GitHub Actions" (switched with `gh api -X PUT repos/EBonura/palermo-drive/pages -f build_type=workflow`, verified live: 17 requests, no console errors). A push that does not build now leaves the previous deployment up instead of publishing a broken tree. Roll back to branch deploy with
  `GH_TOKEN=$(gh auth token --user EBonura) gh api -X PUT repos/EBonura/palermo-drive/pages -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'`.
- `dist/` is in `.gitignore` (and `node_modules/`): the autopush loop does `git add -A`.
- What the build does: bundles `src/` + three + the addons actually imported (`Sky`, `BufferGeometryUtils`); define `__PD_PROD__`; entry loads the data blobs with top-level await before `main.js` runs, so `window.PALERMO_DATA` etc. exist exactly as before; inlines `src/mobile.css` + `src/ui.css` (fonts hashed, the two title fonts preloaded); removes the import map and the data `<script>` tags; preloads the bundle and the core data blob; copies `assets/` except tooling and source-only files (`*.md` except CREDITS, `*.js` (bundled), `cover-src/`, `cover-portrait.png`, `contact-sheet*`); converts the facade photos to webp and rewrites `map.json`.
- `index.html` is parsed by the build (it fails loudly if the stylesheet links, the importmap or the main.js script tag change). New classic `<script src="*-data.js">` data files are picked up automatically.
- Flags: `--data=raw` (ship the JSON scripts as they are), `--no-prune`, `--simplify=0` (exact streets), `--minify=false` (readable bundle for profiling), `--src=<dir>` (build another checkout), `--nodes=<dir>` (try another three.js), `--meta`.
- GitHub Pages serves gzip only (checked with `Accept-Encoding: br`: no brotli), at a level about 2.6 % weaker than gzip -6, `Cache-Control: max-age=600`, and gzips `.bin` too. wav and woff2 are not compressed. So there is no pre-compressed brotli option on Pages.
- `world/` is tracked (it is published; the tiles are committed, 1,122 files, about 137 MB of JSON) and `data/` (raw downloads, the Mapillary token) is the only ignored data folder (`.gitignore`). So CI builds the whole city: `build.mjs` turns `world/manifest.json` + `world/tiles/*.json` into `.bin` twins (a recent build: 126.9 MB raw / 32.7 MB gzip become 26.6 MB / 16.2 MB, see the `world:` line of its log). This note used to say the opposite while the tiles were still local; the first measurements above (615 tiles) predate the committed tiles.

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
- WebGPURenderer: dropped (owner's decision, 8 Nov), after a trial on 4 Nov. It can't be swapped in: a test showed it ignores the `onBeforeCompile` patches and can't run the GLSL `ShaderMaterial`s, even on its WebGL2 backend, so adopting it means rewriting about 21 files (the sea, day and night, buildings, pedestrians, traffic, `shading.js`, `engine-lean.js`) in TSL. It wasn't faster where measured either: a 251-draw, 301k-triangle test scene took about 1.6 to 1.9x the CPU per frame with shadows off and about the same with them on, and on its WebGL fallback shadows didn't render. All of that was on the Mac, none on an iPhone. Safari only has it from iOS 26 (iPhone 11 or newer). The trial's test tools were deleted with its branch.
- BatchedMesh: evaluated, not adopted. Props are already `InstancedMesh` per cell and model (one draw call per visible cell and kind, distance culled in `props.js`), buildings and landmarks are merged per chunk, so there are no "many small distinct meshes" left to batch; the remaining draw calls are building and landmark chunks plus visible prop cells, vehicles and effects (about 530 per frame in the phone profile, no shadow pass), costing 6-11 ms of main-thread render time per frame at a 4x slowdown. Moving props to BatchedMesh would be a rewrite of a 100 KB module for a small gain.

## Rendering and startup (what I changed)

- Street layers: see the recommendation for `src/streets.js` below (1.4 M of 2.3 M visible triangles at Quattro Canti before). The streaming agent applied the flat-ground rule.
- Buildings: chunks of 250 m instead of 400 m in the centro (frustum and shadow culling work better): minus 16 % triangles at Quattro Canti for plus 5 % draw calls.
- Dynamic resolution (`src/perf.js`, hooked in `src/main.js`): first version, phones aimed at 30 fps and desktop at 60. Replaced by the Auto graphics ladder (section "Automatic graphics"): same target everywhere, resolution is its first rung, `?fixres` still disables it, `game.perf.stats()` with `?debug`.
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
- `src/vehicle.js`, `src/mobile.js`, `src/mobile.css`, garage in `src/ui.js` (vehicles agent): `QUALITY.pixelRatio` (1.25 on touch) and the tier table in `main.js` (`low: [1, 0]`) were chosen before dynamic resolution existed. A phone at DPR 3 renders at 1x CSS pixels, which is soft; `perf.js` now backs off when a device struggles, so the ceiling could be 1.5-2 on phones that hold 30 fps (Auto now uses a ceiling of min(devicePixelRatio, 2) on every device and climbs to it only while frames hold; `QUALITY.pixelRatio` still caps the manual tiers). `assets/audio/skid.wav` is 150 KB and `impact.wav` 29 KB: Pages does not gzip wav; mono 16-bit at 22 kHz, or ogg/mp3, would cut that by 4-10x. `assets/cars/hatchback-sports.glb` (198 KB) and `Textures/` do not seem to be referenced any more.
- `src/net.js`, `src/radio.js`: no startup cost seen (the relay and `assets/music/*.mp3`, 14 MB, are only fetched when used; keep it lazy: nothing under `assets/music` may be touched before the first tap).
- `src/daynight.js`: constant light count (2 point + 1 spot at intensity 0), so no program recompiles; good. Keep it that way: changing the number of lights or toggling `castShadow` recompiles every material.
- `src/main.js` / `index.html` (lead): edits I made are marked `[perf pass]`: PCFShadowMap/Sky patch for r182+, `perf` hooks (import, `createPerf`, `applySettings`, loop, `game.perf`), `checkShaderErrors` in production, anisotropy cap, `renderer.compile`, `centroRaised` via `rasterMask`, deferred far city (`if (WORLD && window.__pdLate) await ...`, a top-level await), import map version. The `raisedMask`/`mapCanvas` minimap canvas: `mapCanvas` is 2.4 k x 2.4 k px, fine.
- `tools/tiles.py`, `world/`: emit coordinates at 0.1 m (already) and keep field names stable; the codec adapts to any JSON, but a tile format change that nests numbers inside objects (instead of flat arrays) compresses 3-4x worse.

## Chase camera under ceilings (src/camera-clear.js)

The high camera (7 m up, 13 m back) went through gate vaults, flyover decks and the stadium's entrance roof; the chase camera now keeps the line from the car to itself, and itself, under whatever hangs over them. Ceilings are read from the landmark and bridge/tunnel meshes already in the scene (downward-facing triangles near the car, binned in 16 m tiles a little each frame under 0.8 ms, rasterised to 1 m cells on first use), nothing is registered or baked, and `?noclear` switches it off.

Cost per frame inside `updateCamera` (`window.__camClear.stats()` with `?debug`), phone profile (844x390, DPR 3, 4x CPU slowdown, `?fixres`), camera driving through each place for 6 s: stadium entrance 0.056 ms average (0.8 ms worst, the budgeted indexing chunk), Ballaro 0.017 ms (no indexed group within 170 m), Quattro Canti 0.040 ms. Main ms per frame with and without (`?noclear`, three alternating pairs, medians): 14.26 / 14.27, 16.78 / 17.63, 13.75 / 14.38, that is inside the noise of the shared Mac. The index holds 406 triangles for the stadium and 2854 at Quattro Canti; a tile rasterises in well under a millisecond.

## Memory (tools/perf/memory.mjs)

iOS Safari reloads a tab that uses too much memory, and past a total for all canvases it may leave new ones blank (from memory, not verified on a device; an older iPhone showed a sea-blue minimap in the centre, which fits). None of this was measured on an iPhone. Everything below is headless Chrome on an M3 Max, the production build, base and final at the same moment, MiB. Base is the tree before this work, final is the same tree with it, before the rendering and tree changes that landed alongside.

The number people quote is misleading: `performance.memory` read about 300 at Quattro Canti, and about 240 of that was garbage waiting for a collection. Typed arrays do not appear in it at all, and they were the largest live item.

| Desktop 1280x720, ratio 2, 2048 shadows | load: base | load: final | 3.8 km drive: base | drive: final | 8 starts, back at Quattro Canti: base | starts: final |
| --- | --- | --- | --- | --- | --- | --- |
| V8 heap after a collection | 62 | 53 | 55 | 46 | 76 | 62 |
| ArrayBuffers | 222 | 86 | 199 | 64 | 220 | 80 |
| of which the JS copy of the geometry | 135 | 69 | 111 | 47 | 130 | 60 |
| 2D canvases | 65 | 16 | 67 | 11 | 131 | 19 |
| GPU textures (tally of the allocations) | 213 | 255 | 223 | 252 | 336 | 295 |
| GPU buffers | 80 | 78 | 74 | 73 | 92 | 86 |
| Renderer process footprint | 454 | 280 | 411 | 238 | 559 | 360 |
| Peak heap + ArrayBuffers, garbage included | 511 | 308 | 383 | 191 | 533 | 406 |

Phone profile (844x390, ratio 3, touch), final: canvases 16 / 11 / 19, renderer 282 / 248 / 386, against base 65 / 67 / 113 and 449 / 415 / 590.

GPU textures are higher after a load because painted textures now upload at once instead of when first seen; the same memory was reached before by looking around. The GPU process footprint (about 1100 to 1800 here) moves far more than the tally and follows no change clearly: it is not understood, and it may be specific to Chrome on the Mac.

What was cut, largest first:

- The JS copy of tile geometry goes after upload (`freeAfterUpload` in `src/world.js`): terrain, streets, buildings, far terrain, far city, hills, road wear. Fences edit theirs, `src/camera-clear.js` reads landmarks and bridges, instanced parts move: those keep their arrays. A mesh not drawn yet keeps its arrays until it is first drawn, which is most of what is left.
- Facade and wall atlas pixels in JS (59 and 10) go after upload and are painted again on restore: the layers are seeded, so the same pixels return.
- Painted canvases (`freeCanvas` in `src/core.js`): uploaded one a frame soon after painting, then the canvas shrinks to a pixel. Temporary canvases are zeroed as soon as they are used, since iOS counts one until it is collected (also from memory). The start map and transition canvases (two full screens) shrink when hidden.
- Three leaks: landmark textures painted again on every return of their tile; a disposed mesh uploaded again by the static shadow job, with a buffer nothing deleted; a style cache keeping one entry per old-town house.
- Decoder arrays sized at once (PALERMO_DATA 7.9 to 5.1 in the snapshot). Build: the centro street layers nothing reads are left out (core data 689 to 374 KB gzip).
- Garbage while tiles build: typed buffers in low buildings and street layers, one set of arrays in the terrain. V8 allocation during a load, unminified build: 2529 to 1845.

Tile JSON was not the problem (2 to 6 MB resident), so the parsed-tile LRU stayed as it was.

**A lost GL context** (phones can do this in the background) can no longer re-upload from arrays. `world.contextRestored` hides the freed meshes before the next frame and streams their tiles again; the far meshes and road wear are rebuilt; the car waits. Tested with WEBGL_lose_context on the desktop and phone profiles: view back in 3 to 7 s, no errors, the picture right by eye. Ground textures with random speckle come back with different noise. A listener added before the renderer exists runs before three's own, so it must not upload: that gave black textures for one build.

**Minimap.** 18 pieces made at startup and kept. Every paint sets the whole context state; a style that does not read back, a lost context or a transparent piece paints again; while one stays blank the land is drawn under it. Blanking the pieces on a running game was repaired; the reset check and the context events have not fired in any test. `?coords` shows live canvas MB and the map's counters: the way to find out on a real phone.

**Streaming.** Paired drives on a quiet machine, base / final: frames over 33 ms 6 / 6, 7 / 6, 6 / 7, 6 / 7, 6 / 3; over 50 ms 1 / 1, 3 / 3, 3 / 3, 2 / 2, 1 / 1; worst streamer frame 30 / 31, 23 / 24, 40 / 45, 23 / 25, 17 / 21 ms. On a machine at load 50, before textures went up one a frame, the final build had more long frames (over 33 ms 26 / 34, 34 / 41, 35 / 73).

**What is still big.** GPU: facade atlas 78 (235 layers of 256 x 256 with mips), shadow maps 48, crowd atlas 15, drawing buffer at ratio 2 about 140 by estimate. Visited landmark textures stay cached, up to about 100 by adding up their sizes: bounded, not a leak. Vertex format: 48 bytes per building vertex, of which normals and colours could shrink (touches shaders, needs the image comparison). A baked compressed atlas would be the largest single saving, and would change pixels. The motorway sign atlas is a 2048 x 2048 canvas (16) that is drawn on as signs appear, so it keeps its canvas.

## The phone measures itself (`?bench`, `src/bench.js`)

Every number above this section comes from an M3 Max, whose GPU never limits, so none of them says how an iPhone's frame splits between the game's code, draw calls, vertices, pixels and shadows. `https://ebonura.github.io/palermo-drive/?bench` makes the device measure it: open the link, leave the phone alone for about four minutes, then screenshot the two result pages (buttons `1 summary` and `2 costs`) or press `Copy JSON`. Nothing is sent anywhere; the last result is kept in `localStorage`, and a reload within 20 minutes shows it again instead of running (Safari reloads a heavy tab when you come back from another app). If the page dies during a run, the next load says at which step and shows what it had.

Nothing changes for players: `main.js` imports `src/bench.js` only when the address has `bench`, and the production build keeps it as a file of its own next to the bundle (`js/bench.<hash>.js`, see `tools/build/build.mjs`), so nobody else downloads it. The variants it switches exist only inside it, to measure. Several change the picture; none is an option of the game.

**What it does.** The lapa is parked and the chase camera still. The clock is stopped, the weather held at fair (the schedule's own weather is noted on the page), the radio off, and each place is given until its tile is at full detail, nothing in view is still being built and the crowd has had a couple of seconds. The crowd fills and thins slowly after a change of place or hour (a few people a frame, `src/pedestrians.js`), slower than the run can wait for, so the count that was there when each place was measured is on the summary page, and the reload without MSAA goes through the same hours in the same order as the first load so that both catch the crowd near the same point. That works where the page starts (Quattro Canti: 553 and 559 people in one run) and less well after a journey (Vucciria: 675 and 813), so both counts are printed with each pair and a pair whose crowds differ by more than a tenth is marked as not a fair one.

1. *The device*: user agent, screen and pixel ratio, the canvas size actually drawn, WebGL renderer string, limits and every extension, the context's attributes, canvas memory (the `?coords` figure), the step of the page's clock, and the display: animation frames a second with nothing drawn at all. 30 there on a phone is iOS holding the page back, which is what Low Power Mode does, and the page says so in a line starting with `!`.
2. *The tour*: Quattro Canti first (where the game starts, while the phone is cool), then Vucciria, Ballarò, Viale Luigi Castiglia, Viale Regione, Monreale and Mondello, each further away than the one before (the spots of `tools/perf/gpucost.mjs` plus the owner's three test links), each by day (12:00) and by night (22:30). At each: frames per second and the time between animation frames (median, 95th percentile, worst) as the player gets them; then the game's code in a frame (`JS`) and the finished frame (`frame`), which runs from the start of the animation callbacks to the end of a 1-pixel `readPixels`, so the GPU has finished: the clock of `gpucost.mjs`. `GPU` is the difference. Safari's clock steps in whole milliseconds, so every figure is a mean over a chunk of frames with the top and bottom 15 % dropped. The game's code is also split by system (the calls `main.js` makes each frame, timed where they are called): `draw` is three.js walking, sorting and issuing the frame.
3. *The costs*: the fourteen that matter most at Quattro Canti before the tour leaves it, then, with the time left after the tour, a shorter list at the heaviest two of the other spots and the rest of the list back at Quattro Canti. One thing at a time is switched off or changed inside the same page, in blocks of about a quarter of a second that alternate with the page as shipped (A B A B A B A). Each changed block is compared with the mean of its two neighbours; the page shows the mean difference in ms of finished frame, `±` half the spread of those differences (what noise alone does: a figure smaller than its `±` is nothing), the part that is the game's code, and the change in draw calls.
4. *Pictures*: the same instant drawn two ways in one task and compared pixel by pixel. The ground hidden (is it drawn at all?), the 16-bit meshes that `src/engine-lean.js` draws by parts hidden (commit b54dff6b: `WEBGL_multi_draw` lost exactly these on an older iPhone), parts against whole meshes (must be 0 %), and the two other draw orders below against the shipped one (must be 0 % for the comparison to mean anything).
5. *MSAA* is a context attribute and cannot change in a page, so the run ends with one reload at `?aa=0` that repeats the day's baseline at Quattro Canti (where the page starts, so no journey) and, when the time allows the journey, at the heaviest of the other spots, and puts the pairs on the summary page. It is a measurement: the page it loads is never offered to anyone.

| variant | what is switched | note |
| --- | --- | --- |
| `shoff`, `shpass0`, `shrecv0` | shadows: the pass skipped and the lookups branched out by the `receiveShadow` uniform; each alone | no program is compiled; `sh0` of `gpucost.mjs` compiles the lookups out instead |
| `half`, `tiny` | pixel ratio 1 and 0.25 | `tiny` leaves almost no pixels: what it saves is the pixels' share of the frame, what is left is draw calls, vertices and the shadow pass |
| `crowd0`, `traffic0`, `props0`, `build0`, `ground0`, `transp0` | things hidden: by the streamer's own part names (`world.tiles`, `t.parts`) and by object name | the cached shadow map keeps them |
| `lean0`, `whole` | `src/engine-lean.js` bypassed (`bypass`), parts drawn as whole meshes (`wholeParts`) | the switches of `tools/build/enginebench.mjs` and `gpucost.mjs` |
| `order0`, `sort` | the opaque list in three's own order, as it was before the cut-outs went after the solid draws (`cutoutsLast`, `docs/PERF-ENGINE.md`; the `order0` of `gpucost.mjs`); front to back with the cut-outs still last (the comparison of the `sort` part of `?lean=`) | the page as shipped is the baseline, so a plus on `order0` is what the shipped order saves: on a tile-based GPU a discard in the middle of the opaque list undoes hidden surface removal for what came before it. Both put `cutoutsLast` back afterwards |
| `clouds0`, `csh0`, `rain` | the clouds and their shadows, the shadows alone (their uniform), rain against fair weather | `rain` reads the other way round: plus is what rain costs |
| `hud0`, `balloons` | every page layer over the canvas hidden (what `?clean` does); 12 speech balloons forced on screen, 4 of them with the blurred backdrop | the compositor works outside the frame, so these also give `iv`, the change in the mean time between animation frames |
| `wash0` | the night wash of `src/daynight.js`, by its uniform | night only |
| `sh0`, `flat`, `shade0`, `lamps0`, `fog0`, `tone0`, `env0`, `mediump`, `alpha0` | as in `gpucost.mjs`; `shade0` puts three's own chunks back in place of `src/shading.js` | each compiles every program again. In WebKit on the M3 Max the 40 programs of `sh0` took 13 s in one run and two minutes in another, with the machine busy both times, so they only run when asked for: `?bench&bs=qc&bv=sh0,flat,shade0` |

`?bs=qc,mondello` narrows the tour, `?bv=` the variants (then nothing is skipped for time), `?benchaa=0` leaves the MSAA reload out, `?bench=new` runs even when a fresh result is stored. The run aims at four minutes on any device: Quattro Canti and its first fourteen variants always run, the rest only while they fit, and what was skipped is shown as `skipped (time)`. A device too slow for the whole tour leaves out the spots it has not reached when the time is up (the far ones), and the MSAA reload if the run is already half a minute over; the summary page says so on their lines. A variant that could not be switched is shown as `not measured` with the reason, never as a zero.

**What a page cannot measure, and what that does to the numbers.**
- There is no GPU timer in Safari (`EXT_disjoint_timer_query_webgl2` is not exposed). `frame` is a wait for one pixel: it holds the game's code, WebKit's GPU process issuing the commands (draw call overhead lives there) and the GPU itself, and cannot tell the last two apart. `tiny` is what separates the pixels from the rest.
- The page compositor (the HUD's layers, the balloons' blur, putting the canvas on screen) works after the frame and outside it. It shows only in the time between animation frames, which the display quantises (16.7, 33.3, 50 ms): `iv` moves only when a change pushes frames across a refresh.
- No thermal state, no battery level, no Low Power flag. Heat shows as drift during the run, which the alternating blocks cancel inside one variant but not between the tour's spots.
- The first frames after a switch are thrown away until three in a row are back near the usual time, and a variant whose frames never settle is given up.
- Reading the pixel of an antialiased canvas makes WebKit resolve it once more than a normal frame does, so `frame` is a little over what the player pays. The fps columns are measured without that wait.

**On the phone**: Low Power Mode off, on the charger or well charged, the phone cool, other tabs and apps closed, in Safari itself (not inside Instagram or another app). Turn it sideways before or after opening the link. The page keeps the screen awake itself where the browser lets it (iOS 16.4 and later); where it cannot it asks for one tap, and says on the summary page if the screen was not kept awake.

`tools/perf/benchrun.mjs` runs the same page here, in headless Chrome or in real WebKit (`--webkit`, the off-screen `tools/perf/wk.swift`), at the phone's window size, and keeps the two pages as pictures, their text and the JSON. On the M3 Max (11 Nov 2026, the machine busy with other work, so the figures wander) the whole run takes just under four minutes in both, every spot holds 60 fps with frames finished in 6 to 16 ms, and the costs are small against the noise, which is why the phone has to do this itself. At Quattro Canti the frame agrees with `gpucost.mjs costs --k 1 --rep 1` (12.0 ms against 11.6) and the five switches the two tools share (`shpass0`, `whole`, `csh0`, `transp0`, `cutout0`) all come out under 1.5 ms in both. The benchmark's file is 34 KB (15 KB gzip) and only `?bench` fetches it; the app bundle grew by 634 bytes for the hook in `main.js` and the mesh names.

## The draw path (`src/engine-lean.js`, `?draw=`, 11 November 2026)

The owner's old Android phone (Mali-G72, Chrome 131) put `draw`, which is `renderer.render` with the shadow pass inside it, at 21.2 ms of the 31.2 ms the game's code takes in a frame at Quattro Canti by day (267 draws, 620k triangles) and at 25.8 of 39.2 at night (236 draws): about 80 microseconds of main thread a draw. The aim of this pass was to halve that with the picture the same to the pixel. It was not halved. What is in takes about a tenth off `renderer.render` on the throttled Mac and 6 to 8 % off the GL calls of a frame, and the rest of this section says where the remainder sits and why it does not come out of the draw path. No phone was measured after the change: the switches below are there so that the benchmark can.

### Method

`tools/perf/drawcpu.mjs`, in headless Chrome at the phone's window (844 x 390 at ratio 3), the main thread throttled 6 times, the lapa parked and the clock held. One page has every GL function wrapped before the game's scripts run and counts the calls of a frame by name. Another, with nothing wrapped, calls `renderer.render` over and over inside one task with the camera turned a hair each call (as it is while driving, so every uniform that follows the view goes up again) and times it. The machine was doing other agents' work the whole time, so two runs cannot be compared: on a quiet machine the unchanged build took 6.9 ms a call at Quattro Canti at noon and 7.4 at night, later runs of the same code 11 to 13. Every saving below therefore comes from one page, the switch off and on in alternating blocks of the same loop (24 pairs, the mean of the differences, plus or minus 1.96 standard errors).

### What the profile showed

Nothing stands out. With the three parts below in, at Quattro Canti at noon, of the time in `renderer.render`:

| stage | share |
| --- | --- |
| three issuing the draws (`renderObjects`), of which its per-draw `setProgram` is over half | 46 % |
| the occlusion cull of `src/engine-lean.js` (`scene.onBeforeRender`) | 24 % |
| three walking the scene and filling its lists (`projectObject`) | 14 % |
| the shadow pass | 8 % |
| the props' distance cull, which also runs in `scene.onBeforeRender` | 4 % |
| `updateMatrixWorld`, the sort | 3 %, 2 % |

What reaches GL in a frame there, before: 1350 calls for 259 draws of three's, so about five a draw. 352 are draws (a mesh drawn by parts sends several), 400 uniforms, 270 `bindVertexArray`, 94 `bindTexture` and 76 `activeTexture`, 62 `useProgram`, 86 changes of render state. three already leaves out a call that would change nothing, with one exception: an array uniform (the light probe's nine vectors, a shadow matrix) is sent on every change of material whether or not it changed.

The main view's 232 draws come in 89 runs of one material, on 40 programs. The first draw of a run needs all of three's work (the material's uniforms, its render state, its textures). The other 143 repeat the material of the draw before them, and for those three still asks which program, compares every render state, looks at the shadow maps' texture units and goes through the vertex array's attributes one by one, to find nothing to do.

### What changed

Three parts, each with its own switch, none of which changes what is drawn or in what order.

- **`tree`: the occlusion test asks a tree over the rays.** A box used to be tested against every ray of the fan it spans. A binary tree over the rays, rebuilt with the fan each frame, keeps for each node the furthest first wall and the lowest slope among its rays (and the same of the last walls, and the widest view), so a box behind all of them is settled at one node; where a node cannot say, its halves are asked, down to the single ray and the test as it was. The answer is the same as asking every ray.
- **`quick`: a draw with the material of the draw before it goes straight to GL.** The three matrices through three's own uniform cache, the vertex array three made for the mesh, the draw. It is taken only when everything three would look at is known to be as it was (same material and version, camera, scene, side, tone mapping, the same instancing, winding, vertex colour and tangent bits, `receiveShadow`, no callbacks on the mesh, no clipping planes, the geometry's attributes and index unchanged); a skinned or morphed mesh, a wireframe, a shader material that asks for its uniforms again and anything else it cannot check cheaply are left to three. The shadow map's draws go the same way with a vertex array of their own. 143 of the main view's 232 draws at Quattro Canti take it, and 12 of the shadow pass's 36.
- **`uni`: an array uniform is not sent again while it holds the same numbers.** Vector arrays longer than one vector and 4 x 4 matrices, remembered by uniform location; a call with an offset or a transpose is passed through and forgotten.

In one page, at 6x, ms of `renderer.render` a call and GL calls a frame:

| spot, hour | three's draws | old path, ms | new, ms | saves, ms | GL calls | of which uniforms |
| --- | --- | --- | --- | --- | --- | --- |
| Quattro Canti 12:00 | 259 | 12.06 | 10.93 | 1.21 ± 0.15 (10 %) | 1350 to 1239 | 400 to 290 |
| Quattro Canti 22:30 | 261 | 12.78 | 11.42 | 1.26 ± 0.16 (10 %) | 1478 to 1374 | 506 to 398 |
| Viale Regione 12:00 | 370 | 14.63 | 13.44 | 1.28 ± 0.36 (9 %) | 1541 to 1446 | 350 to 254 |
| Viale Regione 22:30 | 382 | 17.56 | 16.43 | 0.82 ± 0.54 (5 %) | 1686 to 1591 | 460 to 364 |
| Vucciria 12:00 | 243 | 15.13 | 14.70 | 1.47 ± 1.63 | 1416 to 1309 | 505 to 398 |
| Vucciria 22:30 | 242 | 16.01 | 14.20 | 1.59 ± 1.30 | 1519 to 1419 | 613 to 513 |
| Mondello 12:00 | 392 | 8.50 | 5.62 | 1.79 ± 1.09 | 1553 to 1442 | 345 to 235 |
| Mondello 22:30 | 384 | 17.03 | 15.08 | 1.40 ± 0.49 (8 %) | 1663 to 1553 | 447 to 337 |

The two ms columns are medians of their blocks and the saving is the mean of the 24 paired differences, so on a noisy run they need not subtract. The old path was the dearer one in all 24 pairs at Quattro Canti, day and night, and in 14 to 22 of 24 elsewhere; the Vucciria and Mondello runs fell in a busy stretch of the machine (Mondello at noon swung between 3 and 8 ms a call by itself) and their spread says so. Nowhere did the new path come out dearer.

Each part alone at Quattro Canti, noon and night: `tree` 0.57 ± 0.26 and 0.71 ± 0.28 ms, `quick` 0.82 ± 0.30 and 0.83 ± 0.25, `uni` 0.01 ± 0.39 and 0.08 ± 0.31. `uni` saves no time that this Mac can see; it is in for the 95 to 110 calls a frame it keeps from GL, each of which on Android is written into a buffer for another process. Draws, `bindVertexArray`, `useProgram`, texture and state calls are the same before and after: three was not sending redundant ones, and `quick` only saves the JavaScript that found that out.

### The picture

`gpucost.mjs diff --v same,draw0` draws one instant through the new path and through the old one in the same page, at a batch of random places on the roads round a spot (`--points`). At Quattro Canti, Viale Regione, Vucciria and Mondello, at 12:00, 18:30 and 22:30, 8 views each: 0 pixels differ in all 96, and the frame against itself is 0 as well. Each part alone (`tree0`, `quick0`, `uni0`) at Quattro Canti and Ballarò at 12:00 and 22:30, 6 views each: 0. `tools/release/smoke.mjs` and `tools/perf/gamecheck.mjs` pass on the build, and a lost GL context comes back with its tiles and no error (`memory.mjs --lose`): the vertex arrays and the uniforms remembered are dropped with it.

### Why not half

The 89 first draws of a material run are where the time is now, and they need what three does for them. Fewer of them means fewer materials in view or an order that groups them by program, and neither is exact: where two surfaces of different materials cross, the odd sample has the same depth in both and the later draw wins it, so any change of order between materials moves pixels (below). The cull is a quarter of the call and pays for itself in draws. The walk, the sort and the matrix update are a fifth together, spread over the whole scene. The idle sway moves the camera every frame even when the lapa is parked, so nothing can be kept from one frame to the next. What would take the next large piece is outside the draw path: fewer materials and fewer meshes in view from the builders (86 materials on 40 programs at Quattro Canti), so that more draws are repeats and there are fewer of them.

### Tried and dropped

- **The opaque list by program, then material** (solids before cut-outs kept): 62 program binds a frame towards 40. Not exact: at Quattro Canti at noon, 12 random views, 47 pixels differed in 5 of them, the largest by 46 of 255, where the frame against itself gave 0. Not in.
- **Keeping the cull's answer while the camera is still**: it never is (the idle sway).
- **A shorter scene walk**: three walks 256 top entries, draws 234 meshes and drops 121 with its own frustum test. Skipping that test for meshes the cull already passed would be about 1 %.
- **Joining part runs across small gaps**: 352 GL draws towards 255 and the same picture, but it trades triangles for calls, and which is dearer is the phone's to say. Not written.
- **One draw for the same material across tiles**: needs the builders or `WEBGL_multi_draw`, which lost meshes on an older iPhone.

### Switches for measuring

`?draw=off` leaves all three parts out (the path as it was), `?draw=tree,quick` keeps only the parts named. While the game runs, `game.lean.draw.tree`, `.quick` and `.uni` set to `false` turn a part off and `true` back on (the object `createLeanEngine` returns has them, so `src/bench.js` can flip them through the `lean` it is given; a part left out in the address stays out). In `gpucost.mjs`: `--v draw0` is the old path, `tree0`, `quick0` and `uni0` one part off. `drawcpu.mjs --ab all,tree,quick,uni` times them in one page.

### Smells met on the way (not touched)

- `quick` and `uni` wrap functions of the GL context and of the renderer and rest on how three.js r187 draws (`renderBufferDirect`, `setProgram`, the uniform cache, `WebGLShadowMap`). Check both at the next three.js update: `gpucost.mjs diff --v same,draw0` must stay at 0.
- 73 programs are linked for one scene, and a view has 86 materials on 40 of them, sorted by material id, so the program changes 62 times a frame.
- Texture units: of the 94 `bindTexture` of a frame at Quattro Canti (40 textures), 43 put a texture on another unit than the one it was on last. Two textures that nearly every material uses (by the look of it the shadow maps) land on units 2 to 8 depending on how many textures of its own the material has before them, since three hands out units per material in the order of its uniforms. A fixed unit for them would take those binds and their `activeTexture` away; it means reaching into three's unit allocation, so it was not tried.
- The props' distance cull, the slice of time for their tile jobs (`pump`), `phys.flush` and `lamps.update` run inside `renderer.render` (the `scene.onBeforeRender` of `src/props.js`), so the benchmark books them under `draw`.
- `src/engine-lean.js` keeps typed arrays and per-frame records in `userData`, which three copies as JSON on `clone()` and `toJSON()`.
- The chase camera's idle sway redraws a parked scene from a slightly different place every frame: nothing a frame works out can be reused in the next.

## Everything but the draw, on a slow phone's CPU (11 November)

The first `?bench` reading from an old Android phone (Android 10, Chrome 131, Mali-G72) put the game's code at Quattro Canti, parked, at 31.2 ms a frame by day and 39.2 by night. Three.js issuing the draws is 21 to 26 of that. This section is about the rest, about 12 ms by day and 19 by night in that reading: world 4.6 / 3.9, crowd 2.0 / 2.8, traffic 1.6 / 3.1, physics with the camera and the HUD's text 2.3 / 1.2, road wear 0.05 / 3.5, sea 0.1 / 2.7, and the others under half a millisecond each.

**How it was measured.** `tools/perf/cpuprofile.mjs` on unminified production builds in headless Chrome with the CPU slowed 16 times (`--cpu 16`: the phone's game code is about 16 times this Mac's 1.9 ms). Three scenes: parked at Quattro Canti, Viale Regione at speed, and a new one, `vturn`, which drives Via Vittorio Emanuele and turns into Via Roma by the Vucciria. Day is 12:00 and night 22:30. The old build and the new one were run in turn, twice each, and the tables give the mean of the two. Three cautions. None of this is a phone figure: at 16 times the page makes about 17 frames a second parked and 10 on the drives, where the phone made about 30 parked by day, so whatever runs on a fixed step (physics at 120 Hz, traffic at 30) runs more steps in each frame here than there, and its cost a frame is overstated. The machine was busy with other work (the draw alone went from 33 to 49 ms between runs of one build). And how much traffic is about differs from run to run (the traffic step parked at Quattro Canti took 0.77 to 1.49 ms on one build). So each change is judged by the profile's own time per function, and the totals only say where the sum went.

**What the phone's figures were.** Three of them are not what a parked frame costs.
- `world` at 4.6 ms: the run was marked `settled: false`. The streamer was still building the tiles around, and it spends its budget (2 ms a frame, 12 when hurrying) in steps that cannot be interrupted, so on a slow CPU every frame holds a whole step. `benchrun.mjs --cpu 16` on the old build gives the same picture: 4.36 by day and 3.90 by night while it builds, against 0.6 to 0.9 in the profiler's runs, which wait for the tiles.
- Road wear (3.5) and the sea (2.7) at night are building too, and it follows the load, not the hour: night was measured first, 25 s after the page opened. With the same slowdown here they fall on whichever hour is measured first.
- The night's crowd and traffic on the phone hold people and vehicles still arriving, for the same reason.

The builders' budgets were left as they are: changing them changes when things appear.

**What the profile showed, and what was done.** Each line is work that produced nothing. Times are ms a frame at 16 times, at Quattro Canti by day unless a place is named.

| what was happening | what happens now | before | after |
| --- | --- | --- | --- |
| The trams run in the physics step, and every tram's instance matrices were written at each of the 120 steps a second (`src/trams.js`) | They are written once a frame, from `world.update` (`drawTrams`); the collision works out where the modules are itself, from the same state | physics 2.03 (`writeInstances` 0.55, `stepTrams` 0.31, `at` 0.27) | physics 0.79 (`stepTrams` 0.13, `collideTrams` 0.12), and 0.12 in `world` |
| The lapa was tested against the whole crowd at every physics step (`collidePlayer`, `src/pedestrians.js`) | Against a list of who is within 7 m, taken once a frame and again if the lapa has gone 4 m, in the crowd's own order | 0.95; Vucciria drive 1.99 | 0.09; 0.27 |
| Each person keeping their distance walked the nine hash cells around them | Only the cells near enough to hold someone within 0.7 m, four or five of the nine; all nine when two of them share a bucket | `apart` 1.31 and the loop round it 1.13 | 0.59 and 1.53 |
| The test for who walks in the sun collected every wall near the ray and tested them all | It stops at the first wall in the way (`Grid.some`, `SegGrid.some`) | 0.74 | 0.55 |
| `src/danger.js` asked the document for `.pd-tr.on` every frame to know whether a transition covers the screen | `src/transition.js` says so (`covering`) | 0.14 | 0.02 |
| The traffic asks for the parked cars near each vehicle at each step, and the answer was sifted out of every prop in those cells (`parked.near`, `src/props.js`) | The parked cars have a grid of their own with a count per cell, so an empty cell costs one array read | Vucciria 2.4 to 2.6, Viale Regione 2.0 to 2.6 | 0.6 to 0.8, 0.04 to 0.9 |
| Each driver read every other vehicle's object to find the few near it (`control`, `src/traffic.js`) | Positions are copied into two flat arrays once a step and the far ones are passed over there | those lines about 1.2 on the Vucciria drive | 0.6 to 0.7; the traffic's total does not show it, the runs differ by more |

The traffic step on its own, with nobody about and no slowdown (`tools/perf/gridlock.mjs`, mean ms a step): 0.55 and 0.57 before against 0.42 after at the junction it calls `zw18`, 0.28 and 0.27 against 0.22 at the Stazione, 0.21 and 0.22 against 0.15 at `zw45`, 0.18 against 0.15 at the Politeama.

**The sum.** Everything but the draw, ms a frame at 16 times, old against new:

| scene | sum | traffic | crowd | physics | lapa against the crowd | world |
| --- | --- | --- | --- | --- | --- | --- |
| Quattro Canti, day (about 1000 people) | 17.6 / 15.1 | 3.1 / 3.1 | 6.4 / 5.5 | 2.0 / 0.8 | 0.95 / 0.09 | 0.7 / 1.1 |
| Quattro Canti, night (about 250) | 17.3 / 11.4 | 5.2 / 3.2 | 3.0 / 2.3 | 2.6 / 0.8 | 0.48 / 0.11 | 1.1 / 1.0 |
| Viale Regione, day | 29.4 / 26.2 | 11.5 / 9.6 | 2.9 / 2.6 | 3.5 / 1.3 | 0.2 / 0.1 | 5.8 / 6.5 |
| Vucciria turn, day | 37.8 / 31.0 | 13.9 / 11.3 | 5.8 / 4.6 | 3.3 / 1.4 | 1.99 / 0.27 | 4.5 / 6.1 |
| Vucciria turn, night | 31.0 / 24.7 | 11.9 / 9.7 | 3.2 / 2.6 | 3.2 / 1.3 | 0.70 / 0.13 | 5.6 / 4.8 |

That is a seventh less parked by day and 11 to 20 % less on the drives. The night figure at Quattro Canti flatters the change: the machine was quieter for the new build's runs (20 and 17 frames a second against 16 and 14), and how much traffic is about differs between runs. `world` went up parked by day because the trams are placed there now (0.12) and the rest is the run (the old build gave 0.62 to 0.91 from one run to another); on the drives it is tile building, which varies. In the `?bench` split the trams' matrices now count under `world`, where they were under `rest`. Frames over 33 ms and the worst frame did not move: parked by day 257 and 260 frames over 33 ms before, 252 and 252 after, worst 100 and 79 ms against 80 and 79; on the drives nearly every frame is over 50 ms at this slowdown and the worst are 127 to 175 before and 142 to 172 after, made of tile steps and the draw.

**What is left, and why a third of the old figure was not reached.** The target was a third of the old sum with the game behaving the same, and this got nowhere near it. What remains in the crowd and the traffic is the simulation of each person and each vehicle, spread thin. Crowd at Quattro Canti: the loop itself 1.5, `apart` 0.6, the sun test 0.55, `run` 0.34, `tileGround` 0.31, `steer` 0.28, `raisedMask` 0.27. Traffic on the drives: `stepAll` 2.0 to 3.4, `control` about 2.7, `integrate` 0.5 to 0.7, `buildOcc` about 0.6, several steps to a frame at this frame rate. Going further means simulating less (people out of sight on a slower clock, traffic far from the camera on a longer step), and that changes who stands where: a decision for the owner, not a clean-up. The others (missions, sea, day and night, clouds, minimap, camera) are 0.2 to 0.7 ms each at 16 times and no one function stands out in them.

**Long frames on the drives** (not changed here; the longest tasks and their cause, at 16 times). Tile steps: fences up to 118 to 127 ms, full buildings 39 to 53, paint 34 to 38, the detailed streets 23 to 39, the surface masks 20 to 31 (twenty of them on one drive, with a `getImageData` in `buildRaised` that averages 1.2 ms a frame on the Vucciria drive), full terrain 24, terrain 12. The traffic running three of its fixed steps in one slow frame. A new speech balloon forcing a layout (`s.h = s.el.offsetHeight` in `src/shouts.js`, about 1.3 ms a frame averaged over the Vucciria drive). The three builders each spending their own budget in the same frame (world 2 ms, road wear 1.5 and up to 3 to stream, sea 2.5), in steps that overrun on a slow CPU. The boats of the sea (`animateBoats`). Minor garbage collections of up to 12 ms. In the five worst frames of each drive the draw and the browser's own time come first.

**The same game.** The crowd draws on `Math.random` and the check tools do not repeat themselves, so the proof is a build that checks itself (made for the test and thrown away): the new source with the old computation run beside each new one and a count of the times they disagree. It went through `crowdcheck.mjs`, the six checks of `gamecheck.mjs`, the three scenes by day and two by night, and four junctions of `gridlock.mjs`. `parked.near` returned the same cars in the same order as the sift of every prop in over 1.7 million calls. The copied positions were the vehicles' own in over 36 million reads. Nobody within the lapa's reach was missing from its list in over 49,000 physics steps. Of over 14 million hash cells left unwalked, none held anyone within 0.7 m. Zero disagreements in each. One difference remains on paper: a person hashed to a far cell whose bucket happens to coincide with a skipped one, and who came within 0.7 m by moving more than 0.8 m in one frame, was pushed before by that accident and is not now.

The tools agree as far as they can tell. `crowdcheck.mjs`: nobody on screen without an instance in 354,356 checks. `gamecheck.mjs`: the fare, the pub hunt and the dump go through the same phases in both builds, and people, cars and props are knocked about in both. `tools/release/smoke.mjs` passes. `gridlock.mjs` gives no run through a red light in either build and jams of 0 to 15 s before against 0 to 8 after, but two runs of one build with one seed give different counts, so it says only that nothing broke. `tilehash.mjs` finds 22 parts different between the builds and 17 between two runs of the old one (16 and 18 the other way round), the same kinds in each: props, terrain, full buildings. `shotdiff.mjs` finds 0 pixels different at `capo_stalls` and `lapa_qc`; at the other four the difference is what moves by itself (a vehicle in view, a marker's rings and its beam, a patch of light), and the old build against itself differs too: 34,064 pixels at `ballaro_stalls` against 55,090 between the builds, 65,530 against 177,683 at `lapa_mondello`, 185,825 against 188,604 at `lapa_night`, and 11,591 at `lapa_qc`, where the two builds had none. `gpucost.mjs diff` compares a variant inside one page and cannot compare two builds.

## Measuring

```
tools/release/withbrowser.sh node tools/perf/drawcpu.mjs --root <dist built with --minify=false> [--spots qc,regione] [--times 12,22.5] [--ab all,tree,quick,uni] [--profile 1]   # renderer.render in ms a call at 6x, GL calls a frame by kind, the draw path's switches off and on in one page
node tools/build/build.mjs                                    # dist/
node tools/build/measure.mjs --root dist --profile phone --net slow4g --cpu 4 --out /tmp/x.json
node tools/build/measure.mjs --url https://ebonura.github.io/palermo-drive/ --profile desktop      # the live site
node tools/build/shots.mjs --roots <ref dir>,dist --out /tmp/shots                                  # screenshot diff
node tools/build/scenestats.mjs --root dist --spot "38.115684,13.361460"                            # heaviest meshes
node tools/build/spotbench.mjs --url http://localhost:8792/ --runs 3                                  # main ms per frame at the five spots, phone profile (see the phone budget pass)
node tools/build/profile.mjs --root <dist built with --minify=false> --profile phone                # CPU + allocation profile
tools/release/withbrowser.sh node tools/perf/memory.mjs --root <dist> [--phone] [--starts 20] [--snap drive|starts|none] [--lose --shots dir] [--alloc]   # memory after load, a drive and a cycle of starts; heap snapshot by category (--minify=false keeps the names)
node tools/perf/benchrun.mjs --webkit --root <dist> --out <dir> [--q 'bs=qc&bv=sh0,flat']            # ?bench as the phone runs it, in real WebKit: the two result pages as pictures, text and JSON (headless Chrome without --webkit, under withbrowser.sh)
```
`measure.mjs --root <source tree> --cdn <dir with three@r160>` measures the old layout (how the baseline was taken: `git archive bd6bf5f`).
