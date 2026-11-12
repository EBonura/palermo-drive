// Shader programs made before anything needs them (docs/PERF.md, "Shader programs compiled during play").
// three.js links a program the first time a material is drawn with a new combination of things (the material, instancing, what the geometry carries, the lights, fog, the shadow receive), and the frame
// waits for it: 70 ms on a laptop in a recording, far more on a phone. The loading screen's renderer.compile(scene) covers what exists then; this covers what arrives later:
//   prepare(obj)   called when a group of meshes is about to join the world (a tile's part, src/world.js setPart) or the scene (the scene's add, at once and again a microtask later for the children the builder adds right after):
//                  every material not yet seen on this kind of object gets renderer.compile(mesh, camera, scene) now, which issues the link (in the background with KHR_parallel_shader_compile) instead of at the first draw,
//                  and the same for the shadow pass's depth program of a caster (three makes a MeshDepthMaterial of its own for each combination of side, map, alpha test and instancing)
//   warmDepth()    the depth programs the street always needs, once, while the loading screen is up
// Nothing here changes what is drawn: the programs are the ones the first draw would have made (same material, same object, same scene for the lights and fog; the depth ones with a render target set, as the shadow pass has).
// A material is looked at once per kind of object (a WeakMap of sets), so a tile whose materials are all known costs one walk over its meshes.
import * as THREE from 'three';

export function createWarm({ renderer, scene, camera, prewash }) {   // prewash(mesh): src/daynight.js, what a material gets at its first draw before its program is chosen
  const seen = new WeakMap(), depthMats = new Map(), keep = [];   // material > the kinds of object already compiled with it; depth variant key > its MeshDepthMaterial (kept, so the programs stay cached)
  const stats = { main: 0, depth: 0, ms: 0, busy: 0 };   // busy: inside a compile of ours (tools/perf/shaders.mjs reads it to tell a program linked ahead from one linked at its first draw)
  globalThis.__pdWarm = stats;
  let rt = null, on = true;
  const SHADOW_SIDE = [THREE.BackSide, THREE.FrontSide, THREE.DoubleSide];   // three: shadowSide[FrontSide] = BackSide, and so on
  const kind = o => {
    const g = o.geometry, a = g && g.attributes;
    return (o.isInstancedMesh ? 1 : 0) | (o.instanceColor ? 2 : 0) | (o.receiveShadow ? 4 : 0) | (o.isSkinnedMesh ? 8 : 0) | (a && a.normal ? 16 : 0) | (a && a.color ? 32 : 0) | (a && a.uv ? 64 : 0) | (a && a.uv1 ? 128 : 0) | (a && a.tangent ? 256 : 0)
      | (g && g.morphAttributes && g.morphAttributes.position ? 512 : 0) | (o.isPoints ? 1024 : 0) | (o.isLine ? 2048 : 0) | (o.isSprite ? 4096 : 0) | (o.isBatchedMesh ? 8192 : 0);
  };
  const ok = o => o.isMesh || o.isPoints || o.isLine || o.isSprite;

  // the shadow pass renders to a target and without the scene (so without its fog), and both are part of a program's key (colour space, tone mapping, fogExp2, fog bit): the depth ones are compiled the same way
  function inShadowPass(fn) {
    const prev = renderer.getRenderTarget(), fog = scene.fog;
    if (!rt) rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    renderer.setRenderTarget(rt); scene.fog = null;
    try { fn(); } finally { scene.fog = fog; renderer.setRenderTarget(prev); }
  }
  function compile(o) { stats.busy++; try { renderer.compile(o, camera, scene); } finally { stats.busy--; } }
  function depthKey(o, m) {
    if (m.displacementMap || m.alphaMap || m.alphaToCoverage || (m.clippingPlanes && m.clippingPlanes.length) || o.customDepthMaterial || o.isSkinnedMesh || o.isBatchedMesh || o.isPoints || o.isLine || o.isSprite) return -1;
    const side = m.shadowSide !== null && m.shadowSide !== undefined ? m.shadowSide : SHADOW_SIDE[m.side];
    return side | (m.map ? 4 : 0) | (m.map && m.alphaTest > 0 ? 8 : 0) | (o.isInstancedMesh ? 16 : 0) | (o.instanceColor ? 32 : 0);
  }
  function depth(o, m) {
    if (!renderer.shadowMap.enabled || !o.castShadow || !m.visible) return;
    const k = depthKey(o, m); if (k < 0 || depthMats.has(k)) return;
    const d = new THREE.MeshDepthMaterial(); depthMats.set(k, d);
    d.side = k & 3; d.map = m.map; d.alphaTest = m.alphaTest;
    const mat = o.material; o.material = d;
    try { inShadowPass(() => compile(o)); stats.depth++; } catch (e) { /* the first draw will do it */ } finally { o.material = mat; }
  }

  function prepare(root) {
    if (!on || !root) return;
    const t0 = performance.now();
    root.traverse(o => {
      if (!ok(o) || !o.material) return;
      const k = kind(o), list = Array.isArray(o.material) ? o.material : [o.material];
      let fresh = false;
      for (const m of list) { let set = seen.get(m); if (!set) seen.set(m, set = new Set()); if (!set.has(k)) { set.add(k); fresh = true; } }
      if (!fresh) return;   // every material of this mesh has been through here as this kind of object
      if (prewash) prewash(o);
      try { compile(o); stats.main++; } catch (e) { /* the first draw will do it */ }
      for (const m of list) depth(o, m);
    });
    stats.ms += performance.now() - t0;
  }

  // the depth programs every street needs: a caster with a map and with a cut-out map, one-sided and two-sided
  function warmDepth() {
    const geo = new THREE.PlaneGeometry(1, 1), tex = new THREE.Texture(), mats = [];
    for (const side of [THREE.FrontSide, THREE.DoubleSide]) for (const inst of [false]) for (const mode of ['map', 'cutout']) {   // the ones the recordings showed first; instanced and map-less casters are warmed as they arrive (prepare)
      const m = new THREE.MeshStandardMaterial({ side, map: mode === 'plain' ? null : tex, alphaTest: mode === 'cutout' ? 0.5 : 0 });
      const o = inst ? new THREE.InstancedMesh(geo, m, 1) : new THREE.Mesh(geo, m);
      o.castShadow = true; depth(o, m); mats.push(m);
    }
    keep.push(geo, tex, ...mats);
  }

  // the scene's add: what is added is looked at at once (a mission that adds its meshes inside the frame is drawn in that very frame) and again in a microtask, for the children a builder adds to a group right after adding the group
  const add = scene.add;
  scene.add = function (...objs) {
    const r = add.apply(this, objs);
    for (const o of objs) prepare(o);
    queueMicrotask(() => { for (const o of objs) prepare(o); });
    return r;
  };
  return { prepare, warmDepth, stats, seen, kind, off() { on = false; } };
}
