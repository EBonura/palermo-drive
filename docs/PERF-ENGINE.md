# A leaner renderer: what the frame costs and what to do about it

The question: would a more refined graphics engine let Palermo Drive run on any phone, with the same look?

Short answer: a rewrite is not what's needed. Most of the frame is work that never reaches the screen. A 350-line module on top of three.js (`src/engine-lean.js`, on by default, `?engine=off` for comparing) removes 20 to 60 % of the triangles and about 30 to 60 % of the draw calls with the same picture, and takes 9 to 24 % off the main thread at the 4x slowdown. **No real phone was measured.** Everything here comes from an M3 Max with CDP CPU throttling, so the CPU numbers are a stand-in for a phone and the GPU side is counted (triangles, overdraw, memory), not timed.

## Result

Concurrent pairs: two browsers, same spot, same moment, median of three, phone profile (844x390, DPR 3, 4x CPU, `?fixres`). `node tools/build/enginebench.mjs pair`. The machine was busy, so read differences under about 0.5 ms as noise. All 15 pairs were ahead on the main thread, here and in the run before this one.

| spot | main ms | in `renderer.render` ms | GPU process CPU ms | draw calls | triangles |
| --- | --- | --- | --- | --- | --- |
| Quattro Canti | 14.23 to 10.80 (-24 %) | 7.28 to 4.83 | 3.35 to 2.65 | 566 to 269 | 1.49 M to 0.80 M (-46 %) |
| Ballaro market | 14.86 to 13.07 (-12 %) | 7.27 to 5.84 | 3.59 to 2.91 | 591 to 323 | 1.58 M to 0.96 M (-39 %) |
| Piazza Zisa | 14.29 to 11.42 (-20 %) | 6.95 to 5.14 | 3.42 to 2.65 | 464 to 185 | 1.03 M to 0.41 M (-60 %) |
| the port | 11.47 to 10.34 (-10 %) | 5.52 to 4.56 | 2.86 to 2.65 | 504 to 339 | 1.19 M to 0.80 M (-33 %) |
| Mondello piazza | 10.94 to 9.97 (-9 %) | 4.91 to 4.31 | 3.02 to 2.73 | 490 to 348 | 0.85 M to 0.68 M (-20 %) |

On the tree merged with the bigger crowds and the destructible walls, the same test gives Quattro Canti 14.33 to 11.60, Ballaro 16.38 to 13.99, Zisa 17.04 to 12.48, the port 17.25 to 14.46, Mondello 16.93 to 14.67 ms, with all 15 pairs ahead; the busy spots that had dipped to 57 or 58 fps hold 60.

At 8x, a harder stand-in, the difference shows in frame rate (two runs each; the frame budget is gone, so this is where it counts):

| spot | fps | main ms | triangles |
| --- | --- | --- | --- |
| Quattro Canti | 28 to 38 | 40.9 to 32.2 | 1.51 M to 0.81 M |
| Ballaro market | 28 to 35 | 37.4 to 29.6 | 1.58 M to 0.96 M |
| Piazza Zisa | 35 to 48 | 29.2 to 21.8 | 1.04 M to 0.42 M |

Driving 14 m/s along Via Maqueda and Via Ruggero Settimo for 60 s at 4x (`enginebench.mjs drive`, two concurrent runs):

| | run 1 before / after | run 2 before / after |
| --- | --- | --- |
| triangles, average | 1.26 M / 0.63 M | 1.26 M / 0.63 M |
| draw calls, average | 467 / 231 | 468 / 233 |
| main ms per frame | 14.3 / 11.7 | 15.4 / 13.2 |
| `renderer.render` p50 / p95 ms | 8.6, 12.2 / 6.1, 8.3 | 9.4, 12.9 / 7.4, 9.8 |
| `renderer.render` worst ms | 89 / 65 | 79 / 69 |
| frames over 33 ms / over 50 ms | 11, 1 / 9, 1 | 10, 1 / 12, 1 |

Hitches are about the same; the ones left are streaming and parsing, not this module. Over the 60 s it rebuilt its lists about 245 times, refreshed the shadow map 65 times and spent 15 to 18 ms in total rasterising occluders.

Desktop (1280x720, no slowdown, two runs): Quattro Canti 3.74 to 2.87 ms, Ballaro 4.26 to 3.59 ms.

Each part alone at 4x (three pairs, measured just before the last cost cut, so the culling row is a little pessimistic):

| | Quattro Canti | Ballaro | Zisa |
| --- | --- | --- | --- |
| `lean=shadow`, main ms | -0.7 | -0.4 | -1.0 |
| `lean=shadow`, triangles | -403k | -363k | -218k |
| `lean=occ,walk`, main ms | -1.2 | -0.7 | -1.4 |
| `lean=occ,walk`, triangles | -273k | -267k | -396k |

## The look

The owner's rule is no downgrade and real shadows that follow the time of day, so that's the test. `enginebench.mjs look` draws the same instant twice in one page, through the path used today and through the lean one, so traffic and crowds can't move in between. Examples are in `docs/perf/engine/`.

| case | pixels differing by more than 8 of 255 | by more than 32 |
| --- | --- | --- |
| parked, worst of 17 spot and hour combinations | 7.25 % (Ballaro at 8 h, shadow edges, not visible by eye) | 0.08 % |
| parked, the other 16 | 0 to 3.1 % | 0 to 0.01 % |
| parked at Ballaro, 8 h, texel snap off | 0.30 % | 0.01 % |
| moving, clock at the default 24 min per day, Quattro Canti, 8, 12, 17, 18.5 h | 0.00 to 1.62 % | 0.00 % |
| moving, clock at 2 min per day (12 times faster than default), 8 and 17 h | 3.66 %, 0.00 % | 0.09 %, 0.00 % |

Where it differs, it differs along shadow edges by about a texel. That comes from one deliberate choice: the cached map's centre lands on whole shadow texels (at most half a texel away, 0.15 m), so edges stop crawling as the car moves, which they do today. Turning it off (`?lean=occ,shadow,walk,nosnap`) takes Quattro Canti to 0.00 % and Ballaro to 0.30 %, which is what shows the shadows themselves are the same. The other visible item in the diffs, at Mondello at night, is the animated mission ring, which moves between the two draws.

Shadows still come from the real sun and moon through a real shadow map. A new static map is drawn when the sun has turned 0.3 degrees, the car has gone 16 m or the world has changed (at most once a second for that last one). At the default clock that's about every 1.2 s, if the sun goes round evenly (360 degrees in 24 minutes).

False culls (`enginebench.mjs check`): anything the culler hid that a full ID render shows. With the per-part boxes added, 75 more positions at Quattro Canti, Ballaro and Zisa: 0 pixels. On the final code, 200 random road positions over the five spots, an average of 262 to 356 objects hidden or outside the view at each: **0 pixels**. An earlier run of 300 positions with a denser march found 1 pixel in 154 million. A first run caught a real bug (market stalls placed after their box was computed), so this check earns its keep; run it after any change to the module.

## Where the frame goes

CDP profile at 4x, ms per frame, today's code (`enginebench.mjs attrib`). The GL call tally adds about 1.4 ms to the render column, so read the parts, not the absolute total.

| spot | `render` | per-draw setup (`setProgram`) | shadow pass | `projectObject` | `updateMatrixWorld` | pedestrians | traffic |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Quattro Canti | 9.85 | 2.74 | 1.83 | 1.82 | 0.99 | 0.63 | 0.45 |
| Ballaro | 10.45 | 3.07 | 1.81 | 1.77 | 1.01 | 0.67 | 0.82 |
| Zisa | 8.34 | 2.05 | 1.55 | 1.81 | 0.96 | 0.29 | 0.60 |
| the port | 8.60 | 2.22 | 1.23 | 1.62 | 0.92 | 0.34 | 0.77 |
| Mondello | 7.59 | 1.87 | 1.33 | 1.59 | 0.78 | 0.56 | 0.67 |

What a frame draws, and what a perfect occlusion culler at today's draw granularity would have to keep (every opaque draw gets a flat ID colour; a draw "reaches the screen" if it has at least one pixel):

| spot | main pass draws, triangles | shadow pass draws, triangles | opaque draws that reach the screen | their triangles | fragments passing the depth test per pixel / raw depth complexity |
| --- | --- | --- | --- | --- | --- |
| Quattro Canti | 397, 1.06 M | 196, 387k | 57 of 370 | 274k of 1.05 M | 3.63 / 14.2 |
| Ballaro | 435, 1.19 M | 175, 372k | 47 of 405 | 246k of 1.18 M | 3.36 / 13.9 |
| Zisa | 359, 793k | 133, 234k | 30 of 334 | 98k of 783k | 3.25 / 11.9 |
| the port | 387, 905k | 144, 282k | 107 of 360 | 334k of 902k | 2.75 / 9.8 |
| Mondello | 375, 693k | 141, 162k | 87 of 347 | 182k of 681k | 3.16 / 7.7 |

That table is the finding. In a street canyon, 70 to 90 % of what the main pass draws is behind the walls, and the shadow pass redraws about 370k static triangles every frame for a sun that barely moved.

Other facts that shaped the options:
- Programs: 61 to 66 linked, 35 to 46 used per frame, program changes on only 52 to 78 draws. `useProgram` runs 79 times a frame at Quattro Canti while `bindVertexArray` runs 396, `uniform3f` 252 and `uniformMatrix4fv` 246. So the cost is per draw, not per program, about 7 microseconds per draw at 4x inside `setProgram`.
- 13 to 17 instanced pools with `count` 0 go through a full program setup every frame.
- Fragment shader: the standard material compiles to about 2,100 lines of GLSL. The soft shadow alone is 5 hardware-filtered samples, which three's source counts as 20 filtered taps.
- GPU timers on this Mac are not useful. The main pass reads 1.5 to 2.6 ms, the shadow pass 0.2 to 0.6 ms, and swapping every material for a flat colour barely moves it (2.1 to 2.8 ms real, 1.9 ms flat). An M3 Max tells us nothing about shading cost on a phone GPU, so I did not estimate it.
- Memory at Quattro Canti: 105.6 MB of textures (the 84-layer facade array is 28 MB, the crowd atlas 13.8 MB) and 93.2 MB of vertex data in 2,112 buffers. JavaScript keeps another copy of the geometry, 124 to 136 MB across about 3 M vertices at 43 bytes each. The V8 heap itself is 52 MB after a collection (`enginebench.mjs heap`); before one it can read 340 MB of garbage.
- Upload hitches, from load to 7 s after it, parked: one 32 ms `texSubImage3D`, and six `texSubImage2D` calls peaking at 1.5 ms. Nothing else over 0.5 ms.

## Options

| option | gain | cost and risk | verdict |
| --- | --- | --- | --- |
| Occlusion culling for street canyons | **Measured.** Up to -396k triangles and -1.4 ms alone; bound in the table above | About 200 lines plus a few hook lines in `buildings.js`, `main.js` and `world.js`. Relies on private behaviour (see below) | **Ship** |
| Cached static shadow map | **Measured.** Up to -403k triangles and -1.0 ms alone. Shadow pass at Quattro Canti 387k to about 12k triangles on most frames | +7 MB (3 x (4 + 1) MB against 8 MB today). A static slice of about 50 draws on 11 % of frames while driving | **Ship** |
| Scene walk prunes (flat list for `projectObject`, matrix walk only over what moves) | **Measured as part of the above** | Small; included | **Ship** |
| Blob or baked shadows | Would remove the shadow pass | Rejected by the owner; can't follow the time of day. The sun moves, so a per-tile bake or shadow atlas would have to be redone constantly anyway | No |
| Shadow map every other frame | About half of 1.3 to 2.3 ms | Moving things' shadows lag behind them. The cached map gets more, without the lag | No |
| Front-to-back opaque order (`lean=...,sort`) | **Measured.** Overdraw at Quattro Canti 3.57 to 2.12 fragments per pixel | **Measured.** +0.9 to +2.0 ms main at 4x (program changes double). Worth it only if a phone GPU is fill-limited and has no hidden surface removal of its own | Keep the flag; decide on a real phone |
| Boxes per part of a big object (`subBoxes` in `src/engine-lean.js`) | **Measured, on top of the above.** Against the previous commit, on a busy machine: 58k to 85k fewer triangles at Quattro Canti and Ballaro (-7 to -9 %), about 60k at Zisa (-15 %), 9 to 17 fewer draws. Main thread unchanged within noise | About 60 lines, computed a little per frame. The part tests cost about as much as the draws they remove, so the gain is on the GPU only | **Shipped** |
| Sub-chunk culling for building chunks (draw ranges per block, then multi-draw) | **Estimate.** Building chunks are the largest item left: 237k triangles drawn at Quattro Canti where 111k reach the screen | A real change to how chunks are built and drawn; shadow pass could use the same ranges | Next, once a phone says the vertex side is the limit |
| Per-instance culling for market and traffic pools | **Estimate.** 91k of 93k triangles in these draws are hidden at Quattro Canti | Touches `markets.js` and `traffic.js`, both moving fast | Next, when those settle |
| Index the flat geometry | **Measured count.** 793,780 vertices become 337,281 unique ones, 2.35 times fewer to fetch and shade, on geometries up to 60k vertices | Small. Load-time cost not measured | Worth doing, separate change |
| Smaller vertex format | **Arithmetic.** 44 to 28 bytes (normal and colour to 4 bytes each), about 35 % of vertex memory and bandwidth | Touches every shader that reads `color` as floats | Later |
| Drop the JavaScript copy of the geometry after upload | **Measured size.** 136 MB of arrays at Quattro Canti; the V8 heap after a real collection is only 52 MB | Three re-uploads from these arrays after a lost GL context, so tiles would have to be rebuilt on restore. `fences.js` also edits one position array in place | **Done**, see "Memory" in docs/PERF.md: tiles are rebuilt on restore |
| Merge tile meshes by material, shared atlas | **Estimate.** About 0.7 ms at 4x per 100 draws removed | Works against culling (bigger objects are hidden less often) and against the props' distance cull. Would change the look of far props | No |
| Fewer programs, one uber-shader | CPU: little, per-draw cost is not per-program. Link time at load would drop | Real effort; a cheaper lighting model risks the look. Could be gated with the image diff above | Only if a phone shows fragment cost is the limit |
| Custom thin render loop | **Estimate.** Up to about 2 ms of the 3.9 ms left in `renderBufferDirect` at 4x | Reimplements three's uniform and state handling for 40-odd programs, breaks on three upgrades | Not yet. Culling already took half the draws it would speed up |
| WebGL2 multi-draw and UBOs | Only pays inside a thin loop with merged buffers | `WEBGL_multi_draw` exists on this Mac; phones not surveyed. Three uses it only through `BatchedMesh` | Not yet |
| WebGPU render bundles with WebGL2 fallback | Lower CPU per draw where available | All custom shaders are GLSL, WebGPURenderer wants TSL. Low-end phones are where support is weakest, so the WebGL path stays and there are two backends to keep the same. Support on current low-end phones not surveyed | No |
| LOD for far buildings, impostors | **Unmeasured.** A full tile is about 175k triangles, a low one about 22k (`docs/PERF.md`) | Changes what far buildings look like. Would have to pass the image diff | Try only if needed |

## Does a rewrite beat targeted changes?

No. Game code is about 2 ms of a frame at 4x. Three's per-draw and per-object overhead is real, but the bigger problem was the number of things being drawn, not the price of each. A new engine would draw the same hidden buildings faster; culling them gets more and keeps every custom shader. A rewrite also costs what's most valuable here: dozens of `onBeforeCompile` shaders and every module that touches a `Mesh`.

Whether this reaches "any phone" can't be answered from a Mac. It removes a large share of vertex work and a useful share of CPU. It does little for fragment shading in open views (Mondello: -20 % triangles), and the shading cost on a low-end phone GPU is the biggest unknown left. Pedestrian counts going up also add game code this module can't help with.

## How the prototype works

`src/engine-lean.js`. Parts: `occ`, `shadow`, `walk`, `sort` through `?lean=occ,shadow`; the default is `occ,shadow,walk`. With `?engine=off` it's imported and never called, and `hooks.occ` stays undefined.

Occlusion. `buildings.js` hands each ground-standing solid to the tile's occluder job. Footprints are rasterised at 2 m into a 4 m height grid, about 1 ms a frame until done. A cell blocks only if all nine samples are inside a solid, so an alley stays open. Each frame, 321 rays even in screen x march over the grid and record the rising elevation of the roofs they cross. An object is hidden only if every ray across its box, plus one on each side, has already risen above the top of its box at a nearer distance. Terrain and walls are solid below the roofline, so a 2.5D horizon is enough. It runs in the same frame on the CPU, so there's no readback and no lag, and it costs 0.7 to 1.2 ms at 4x. Buildings that bridge a passage and stacked upper storeys don't occlude.

Objects over 96 m across and 1,500 triangles also get up to about 25 boxes, one per part of their area, each grown to hold whole triangles or instances so there's no gap between them. An object is hidden only when every part is. The part that was visible last frame is tested first. The far terrain and far city keep one box, because their index ranges change as tiles come and go.

Scene walk. Static leaves live in flat arrays with their boxes. During `projectObject`, `scene.children` is swapped for what survived, so three walks 250 objects instead of 1,500. It's restored before the shadow pass, because a hidden building can still cast a shadow into view. Any change in a group's children is noticed the same frame and the lists are rebuilt before anything stale is drawn.

Shadows. Static casters go into a cached depth map, a sixth per frame, while the old one stays in use; then the maps swap and the pose changes together. Every frame copies the static depth into the live map and draws what moves on top. The very first map is drawn whole.

Private behaviour it relies on, so pin three and retest on every upgrade: `sm.render` is replaced, `renderer.clear` is stubbed during the shadow calls, `properties.get(rt).__webglFramebuffer` is read for the blit, and `scene.children` is swapped.

## Not tested, and what to watch

- **A real phone.** Nothing here ran on one. CDP throttling slows JavaScript only, not the GPU process or the GPU.
- Geometry that is never drawn is not uploaded, so non-casting parts of a hidden tile can wait until they first come into view. Buffer memory at Quattro Canti read 80 MB against 93 MB, which is good, but it may move an upload to the moment you turn a corner. The drive test shows no worse worst case (74 to 77 ms against 92 to 97 ms), and it's something to watch on a phone.
- Multiplayer vehicles. Tiers (saved and switched while running), the garage and the title flyover pass `enginebench.mjs smoke` with no page errors; the flyover's cost was not measured.
- Two long bench runs ended with the browser disconnecting. Chrome processes were being killed externally during testing, at least for the later one, and there were no Chrome crash reports, so this is not treated as a game crash.
- A lost and restored GL context, which phones can do in the background, was tested with `look --lose 1` and the `WEBGL_lose_context` extension, not on a phone. Three makes a new shadow map object on restore, so the module hooks it again and starts its maps over. The environment map and the crowd atlas also needed a fix, with or without this module: they did not come back (Ballaro's average brightness fell from 72 to 23, and the people were gone).
- The crowd atlas frees its pixels after upload and has to fetch them again on restore. The tile geometry and the facade atlas now do the same (docs/PERF.md, "Memory"): a lost GL context rebuilds the tiles.
- Three spots got the look check at three hours and two at four; other places and other camera modes did not. The false-cull check used only the default chase camera.

## Recommendation

The owner chose to ship `occ,shadow,walk` as the default, for every device. To compare on a real phone, open the site with and without `?engine=off` in the same spots: that's the first real measurement this game gets. Then let the phone decide what's next: vertex-limited means sub-chunk culling and indexed geometry; fill-limited means the sort flag, then shading; tabs dying means dropping the JavaScript geometry copies.

## Commands

```
node tools/build/enginebench.mjs attrib --spots qc --q engine=off  # draws per pass and kind, GL calls, overdraw, occlusion bound, memory, CPU profile
node tools/build/enginebench.mjs pair --runs 3                     # concurrent before/after; --qa and --q set each side's flags, --cpu 8, --desktop
node tools/build/enginebench.mjs drive --runs 2                    # the route, frame times and hitches
node tools/build/enginebench.mjs look --times 8,16.5,23 --out <dir>   # same instant both ways; --drive 6 catches it moving
node tools/build/enginebench.mjs check --points 40                 # false culls
node tools/build/enginebench.mjs smoke                             # tiers, garage, title: no page errors
```
