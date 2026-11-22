# The mission director

Since 22 Nov 2026 the jobs reach the lapa as calls while it drives (`src/mission-director.js`, `src/call-card.js`). The encounters (pen sellers, races, rave, landfill, horns, pubs) stay at their places and never ring.

## How a call goes

1. After 40 s of free driving (15 s for the first call, 25 s after a job) the director draws a type from a shuffled deck, one card per type.
2. The type's `find(far)` returns an offer for where the lapa is now, or null. Null gives the turn to the next card.
3. The call card shows who, the line, where, and the pay. Q, a tap, or X on a pad answers. Ignoring it costs nothing.
4. An offer with a caller: the route leads to the slot, the caller stands on the kerb, stopping next to them starts the event. An `instant` offer starts at once.

## Adding a job type

One file, `src/job-<name>.js`, with a default export `setup(X)`, listed in `src/jobs.js`. Keep everything of the job in that file, its words too (Italian or Palermitan first, English second, as `[it, en]` pairs or `X.T(it, en)`); Palermitan written by us is a DRAFT for the owner and is marked so in a comment.

```js
export default function setup(X) {
  X.director.add('hit', far => {            // far: metres the search may reach (900, or 1800 on a second round)
    return { slot: { id: 'hit:1', kind: 'hit', x: X.car.x, z: X.car.z }, instant: true,
      who: 'Tanino', line: X.T('...', '...'), pay: 30, note: X.T('se ce la fai', 'if you make it'), ped: 'tuta', col: '#ff5a4a' };
  });
  X.kinds.hit = { start(slot) {}, update(dt) {}, stop() {}, tick(dt, idle) {} };
}
```

- `X.kinds[kind]`: `start(slot)` when the event begins, `update(dt)` every frame while any event runs (return at once unless yours is the one), `stop()` when any event ends (clean up; called for every kind), `tick(dt, idle)` every frame always (for things that live in the world).
- End your event with `X.endEvent(ok)`. Pay with `X.addFare(euro)` (multiply your base numbers by `PAY_X` from `src/economy.js`). Show progress with `X.hud.set({ label, title, sub, time, frac, target })` every frame, results with `X.hud.result(html, secs)`, short lines with `X.hud.toast(text, sub)`.
- The leash: an event is failed when the lapa strays 520 m from `slot.x, slot.z`. A job that moves gives its slot `leash: () => ({ a: [x, z], b: [x, z], r })`.
- A job with a caller pushes a slot into `X.slots` shaped like the ones `mkSlot` makes in `src/missions.js` (`id, kind, sub, name, x, z, dx, dz, w, callers: [], coolUntil: 0, shoutT: 0, holdT: 0, kerb: null, marker: null`, plus `ped` for the look and `callLine` for what they shout), adds its kind to `JOBS` and a colour to `KIND_COLOR` (both from `src/event-calls.js`), and uses `X.director.place(kind, far)` and `X.director.face(slot)` in its `find`.
- Useful on `X`: `car, vehicle, pedestrians, traffic, scene, camera, game, params, groundAt, now, isNight, speed, say, driverPos, seatPos, seatFn, guide, aim, makeBeacon, addMarker, dropMarker, destBeacon, snapRoad, sideSpot, findSpot, walls2d, proj(lat, lon), T, lang, eur, hud, toast`.
- Test link: `?debug&call=<type>` rings that type three seconds into the drive; `window.__missions` holds the director and `X`.

## Rules

- Phones first: the hardest target is an old Mali-G72 Android. Build things when the lapa is near and remove them when it is far, one InstancedMesh for many alike, no allocation per frame, nothing that changes the picture when the job is not running.
- Text in the owner's Palermitan is never corrected. New Palermitan is a draft.
- Tests run muted through `tools/release/withbrowser.sh`.
