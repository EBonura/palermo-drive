// Injected at document start by tools/perf/gpucost.mjs into the WKWebView of tools/perf/wk.swift (window.__PROBE, the run's plan, is prepended).
// It owns the frame loop: the game's animation callbacks run from here, and after each one a 1-pixel readPixels waits until the GPU has finished
// the frame, so `tot` is the whole frame (game code, WebKit's GPU process, the GPU itself). At a raised pixel ratio the GPU is what is left to wait for.
// Each variant is measured against the base in alternating blocks (A B A B ...) in the same page and at the same instant of the clock, so drift
// and the load of the machine cancel out as far as they can.
(() => {
  const P = window.__PROBE || {}, post = o => window.webkit.messageHandlers.probe.postMessage(typeof o === 'string' ? o : JSON.stringify(o));
  window.__probePost = post;
  // ---------- silence: no audio context ever runs, no media element ever plays
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const A = window[k]; if (!A) continue;
    window[k] = class extends A { constructor(...a) { super(...a); super.suspend(); } resume() { return Promise.resolve(); } };
  }
  HTMLMediaElement.prototype.play = function () { this.muted = true; return Promise.resolve(); };
  // ---------- the context: attribute overrides, GL call counting
  let gl = null;
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attr) {
    if (type === 'webgl2' && this.id === 'view') { attr = { ...(attr || {}), ...(P.attr || {}) }; const c = gc.call(this, type, attr); gl = c; window.__gl = c; return c; }
    return gc.call(this, type, attr);
  };
  const counts = {}; let counting = false, beforeDraw = null;
  const GLP = WebGL2RenderingContext.prototype;
  for (const k of Object.getOwnPropertyNames(GLP)) {
    const d = Object.getOwnPropertyDescriptor(GLP, k); if (typeof d.value !== 'function') continue;
    const f = d.value, dr = k.startsWith('draw');
    GLP[k] = function (...a) { if (counting) counts[k] = (counts[k] || 0) + 1; if (dr && beforeDraw) beforeDraw(this); return f.apply(this, a); };
  }
  // ---------- the frame loop
  const raf = window.requestAnimationFrame.bind(window);
  let cbs = [], id = 0, sync = false, last = null, waiters = [], rep = 1;   // rep: the frame drawn this many times over, so the GPU's share outgrows the CPU's (they overlap)
  window.requestAnimationFrame = cb => { cbs.push([++id, cb]); return id; };
  const caf = window.cancelAnimationFrame.bind(window);
  window.cancelAnimationFrame = h => { cbs = cbs.filter(c => c[0] !== h); };
  const px = new Uint8Array(4);
  function tick(t) {
    raf(tick);
    const run = cbs; cbs = [];
    const t0 = performance.now();
    for (const [, cb] of run) { try { cb(t0); } catch (e) { post({ error: String(e && e.stack || e).slice(0, 400) }); } }
    if (rep > 1 && G && G.renderer) for (let i = 1; i < rep; i++) G.renderer.render(G.scene, G.camera);
    const t1 = performance.now();
    if (sync && gl) {
      const fb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
    }
    const t2 = performance.now();
    last = { js: t1 - t0, wait: t2 - t1, tot: (t2 - t0) / rep, at: t0 };
    const w = waiters; waiters = []; for (const r of w) r(last);
  }
  raf(tick);
  const ce = console.error.bind(console); console.error = (...a) => { post({ error: 'console ' + a.map(String).join(' ').slice(0, 600) }); ce(...a); };
  addEventListener('webglcontextlost', e => post({ error: 'webgl context lost' }), true);
  addEventListener('error', e => post({ error: String(e.message).slice(0, 300) }));
  addEventListener('unhandledrejection', e => post({ error: 'rejection ' + String(e.reason && e.reason.stack || e.reason).slice(0, 300) }));
  const frame = () => new Promise(r => waiters.push(r));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const q25 = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 2]; };
  // WebKit rounds performance.now() to whole milliseconds: a mean over many frames (the top and bottom 15 % dropped) resolves what a median cannot
  const tmean = a => { const s = [...a].sort((x, y) => x - y), c = Math.floor(s.length * 0.15), t = s.slice(c, s.length - c); return t.reduce((x, y) => x + y, 0) / t.length; };
  async function sample(n) { const a = []; for (let i = 0; i < n; i++) a.push(await frame()); return { tot: tmean(a.map(f => f.tot)), lo: q25(a.map(f => f.tot)), js: tmean(a.map(f => f.js)), wait: tmean(a.map(f => f.wait)) }; }

  // ---------- what can be switched off, one at a time (only for measuring: several of these change the picture)
  let G, THREE, R, S;
  const mats = () => { const m = new Set(); S.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => m.add(x)); }); return [...m]; };
  const recompile = () => mats().forEach(m => { m.needsUpdate = true; });
  // a shader variant for every material at once: the cache key gets a suffix and the shader text a patch, so switching back reuses the base programs
  function patchAll(tag, fn, only) {
    const undo = [];
    for (const m of mats()) {
      if (only && !only(m)) continue;
      const ob = m.onBeforeCompile, ck = m.customProgramCacheKey, own = Object.prototype.hasOwnProperty;
      const hadOb = own.call(m, 'onBeforeCompile'), hadCk = own.call(m, 'customProgramCacheKey');
      m.onBeforeCompile = function (sh, r) { ob.call(this, sh, r); fn(sh, m); };
      m.customProgramCacheKey = function () { return ck.call(this) + '|' + tag; };
      m.needsUpdate = true;
      undo.push(() => { if (hadOb) m.onBeforeCompile = ob; else delete m.onBeforeCompile; if (hadCk) m.customProgramCacheKey = ck; else delete m.customProgramCacheKey; m.needsUpdate = true; });
    }
    return () => undo.forEach(f => f());
  }
  const setMat = (pred, key, val) => { const undo = []; for (const m of mats()) if (pred(m)) { const v = m[key]; m[key] = val; m.needsUpdate = true; undo.push(() => { m[key] = v; m.needsUpdate = true; }); } return () => undo.forEach(f => f()); };
  const hide = pred => { const hid = []; S.traverse(o => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible && pred(o)) { o.visible = false; hid.push(o); } }); return () => hid.forEach(o => { o.visible = true; }); };
  const matOf = o => Array.isArray(o.material) ? o.material[0] : o.material;
  const VARIANTS = {
    sh0: () => { R.shadowMap.enabled = false; recompile(); return () => { R.shadowMap.enabled = true; recompile(); }; },
    shpass0: () => { R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false; return () => { R.shadowMap.autoUpdate = true; }; },
    blit0: () => { const b = gl.blitFramebuffer; gl.blitFramebuffer = function (...a) { if (a[8] & gl.DEPTH_BUFFER_BIT) return; return b.apply(this, a); }; return () => { gl.blitFramebuffer = b; }; },   // the cached shadow map's copy into the live one (src/engine-lean.js), skipped
    shtap1: () => patchAll('tap1', sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <shadowmap_pars_fragment>', THREE.ShaderChunk.shadowmap_pars_fragment.replace(/float getShadow\(([^)]*)\) \{/, 'float getShadow($1) { return texture( shadowMap, vec3( (shadowCoord.xyz / shadowCoord.w).xy, (shadowCoord.z / shadowCoord.w) + shadowBias ) ); }\nfloat getShadowFull($1) {')); }),
    gate: () => patchAll('gate', sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', window.__gateChunk(THREE.ShaderChunk.lights_fragment_begin, true)); }),
    gatevis: () => patchAll('gatevis', sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', window.__gateChunk(THREE.ShaderChunk.lights_fragment_begin, false)); }),
    vogel: () => patchAll('vogel', sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <shadowmap_pars_fragment>', window.__vogelChunk(THREE.ShaderChunk.shadowmap_pars_fragment)); }),
    srgb: () => patchAll('srgb', sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <colorspace_pars_fragment>', window.__srgbChunk(THREE.ShaderChunk.colorspace_pars_fragment)); }),
    out0: () => patchAll('out0', sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <colorspace_fragment>', ''); }),
    sprite1: () => patchAll('sprite1', sh => { sh.fragmentShader = sh.fragmentShader.replace('vec4 cf = texture2D(mapFar, vUvF), cn = texture2D(mapNear, vUvN);\n        vec4 c = vNear > 0.5 ? cn : cf;', 'vec4 c = vNear > 0.5 ? texture2D(mapNear, vUvN) : texture2D(mapFar, vUvF);'); }, m => m.uniforms && m.uniforms.mapNear),
    lamps0: () => { const L = []; S.traverse(o => { if ((o.isPointLight || o.isSpotLight) && o.visible) { o.visible = false; L.push(o); } }); return () => L.forEach(o => { o.visible = true; }); },
    fog0: () => setMat(m => m.fog, 'fog', false),
    tone0: () => { const t = R.toneMapping; R.toneMapping = THREE.NoToneMapping; recompile(); return () => { R.toneMapping = t; recompile(); }; },
    env0: () => { const e = S.environment; S.environment = null; recompile(); return () => { S.environment = e; recompile(); }; },
    mediump: () => { const u = setMat(() => true, 'precision', 'mediump'), v = patchAll('mp', sh => { sh.vertexShader = 'precision highp float;\nprecision highp int;\n' + sh.vertexShader; }); return () => { v(); u(); }; },   // fragments only: the vertex stage keeps highp for world positions
    nospec: () => patchAll('nospec', sh => {   // no direct or image-based specular (a different look: only for the size of it)
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(/reflectedLight\.directSpecular \+= [^;]*;/g, '').replace(/reflectedLight\.indirectSpecular \+= [^;]*;/g, ''))
        .replace('#include <lights_fragment_maps>', THREE.ShaderChunk.lights_fragment_maps.replace(/\tradiance \+= iblRadiance;/, ''));
    }),
    flat: () => patchAll('flat', sh => { sh.fragmentShader = sh.fragmentShader.replace(/void main\(\) \{/, 'void main() { gl_FragColor = vec4(0.5); return;\n'); }),
    alpha0: () => setMat(m => m.alphaTest > 0, 'alphaTest', 0),
    transp0: () => hide(o => matOf(o)?.transparent),
    cutout0: () => hide(o => matOf(o)?.alphaTest > 0),
  };
  // the light loops of three's lights_fragment_begin with the shadow lookup and the BRDF inside a branch: skipped where the light adds nothing
  window.__gateChunk = (src, nl) => (nl ? '#if defined( TOON ) || defined( USE_SHEEN ) || defined( USE_CLEARCOAT ) || defined( USE_IRIDESCENCE )\n#define LIGHT_FACES( d ) true\n#else\n#define LIGHT_FACES( d ) ( dot( geometryNormal, d ) > 0.0 )\n#endif\n' : '#define LIGHT_FACES( d ) true\n') + src
    .replace(/(get(?:Point|Spot|Sun|Directional)LightInfo\( [^;]*directLight \);)/g, '$1\n\t\tlightOn_ = directLight.visible && LIGHT_FACES( directLight.direction );')
    .replace('IncidentLight directLight;', 'IncidentLight directLight;\nbool lightOn_;')
    .replace(/\( directLight\.visible && receiveShadow \)/g, '( lightOn_ && receiveShadow )')
    .replace(/RE_Direct\( directLight,/g, 'if ( lightOn_ ) RE_Direct( directLight,');
  // the Vogel disk of three's PCF lookup without the 5 sqrt and the 5 sin and cos pairs: the sample positions are constants turned by one sin and cos of the noise angle
  const GOLD = 2.399963229728653;
  window.__vogelChunk = src => src.replace(/vec2 radius = shadowRadius \* texelSize;[\s\S]*?\) \* 0\.2;/, () => {
    const off = i => { const r = Math.sqrt((i + 0.5) / 5), a = i * GOLD; return `vec2( ${(r * Math.cos(a)).toFixed(9)}, ${(r * Math.sin(a)).toFixed(9)} )`; };
    return `vec2 radius = shadowRadius * texelSize;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				vec2 vd = vec2( cos( phi ), sin( phi ) );
				mat2 vr = mat2( vd.x, vd.y, - vd.y, vd.x );
				shadow = (
					${[0, 1, 2, 3, 4].map(i => `texture( shadowMap, vec3( shadowCoord.xy + vr * ${off(i)} * radius, shadowCoord.z ) )`).join(' +\n\t\t\t\t\t')}
				) * 0.2;`;
  });
  window.__srgbChunk = src => src.replace(/vec4 sRGBTransferOETF\( in vec4 value \) \{[\s\S]*?\n\}/, `vec4 sRGBTransferOETF( in vec4 value ) {
	vec3 a = sqrt( max( value.rgb, vec3( 0.0 ) ) ), b = sqrt( a );
	return vec4( mix( 0.585122381 * a + 0.783140355 * b - 0.368262736 * sqrt( b ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`);
  // categories by what draws them: material type and the program key are the most stable handle there is
  const catOf = o => { const m = matOf(o); if (!m) return '?'; const k = (m.customProgramCacheKey && m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey() : '') || ''; return m.type.replace('Material', '') + (k ? ':' + String(k).replace(/\s+/g, ' ').slice(0, 24) : '') + (m.transparent ? ':T' : '') + (m.alphaTest > 0 ? ':A' : ''); };

  async function census() {
    const out = {}, tot = { draws: 0, tris: 0, shadowDraws: 0, shadowTris: 0 };
    const rbd = R.renderBufferDirect;
    R.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) {
      const shadow = !!(mat.isMeshDepthMaterial || mat.isMeshDistanceMaterial);
      const n = geo.index ? geo.index.count : (geo.attributes.position ? geo.attributes.position.count : 0);
      let c = geo.drawRange ? Math.min(n, geo.drawRange.count) : n; if (grp) c = Math.min(c, grp.count);
      const inst = obj.isInstancedMesh ? obj.count : (geo.isInstancedBufferGeometry ? geo.instanceCount : 1);
      const tris = (obj.isMesh ? c / 3 : c) * (inst === Infinity ? 1 : inst);
      const k = shadow ? 'shadow' : catOf(obj);
      const e = out[k] || (out[k] = { draws: 0, tris: 0, names: new Set() }); e.draws++; e.tris += tris; if (e.names.size < 4) e.names.add((obj.name || obj.parent?.name || obj.type).slice(0, 24));
      if (shadow) { tot.shadowDraws++; tot.shadowTris += tris; } else { tot.draws++; tot.tris += tris; }
      return rbd.apply(this, arguments);
    };
    for (const k in counts) delete counts[k];
    counting = true; await frame(); counting = false;
    R.renderBufferDirect = rbd;
    const gls = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 24);
    const rows = Object.entries(out).map(([k, e]) => [k, e.draws, Math.round(e.tris), [...e.names].join('/')]).sort((a, b) => b[2] - a[2]);
    return { tot, gl: Object.fromEntries(gls), rows };
  }

  // Every object drawn once in its own flat colour, opaque, no multisampling: which draws reach the screen, and how many pixels each kind of material covers.
  // The vertex stage, discards and depth state stay the object's own. Objects under the same name and material are one row.
  async function idpass() {
    await frame();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, rt = new THREE.WebGLRenderTarget(w, h, { samples: 0, depthBuffer: true });
    const uId = { value: new THREE.Color() }, undo = [], cats = new Map();
    S.traverse(o => { if (o.material) cats.set(o, catOf(o)); });   // before the materials' keys change
    const lin = THREE.ColorManagement.enabled; THREE.ColorManagement.enabled = false;
    for (const m of mats()) {
      if (m.isMeshDepthMaterial || m.isMeshDistanceMaterial) continue;
      const ob = m.onBeforeCompile, ck = m.customProgramCacheKey, own = Object.prototype.hasOwnProperty, hadOb = own.call(m, 'onBeforeCompile'), hadCk = own.call(m, 'customProgramCacheKey'), bl = m.blending, tr = m.transparent;
      m.onBeforeCompile = function (sh, r) { ob.call(this, sh, r); sh.uniforms.uProbeId = uId; const f = sh.fragmentShader, i = f.lastIndexOf('}'); sh.fragmentShader = 'uniform vec3 uProbeId;\n' + f.slice(0, i) + ' gl_FragColor = vec4(uProbeId, 1.0); }'; };
      m.customProgramCacheKey = function () { return ck.call(this) + '|id'; };
      m.blending = THREE.NoBlending; m.transparent = false; m.needsUpdate = true;
      undo.push(() => { if (hadOb) m.onBeforeCompile = ob; else delete m.onBeforeCompile; if (hadCk) m.customProgramCacheKey = ck; else delete m.customProgramCacheKey; m.blending = bl; m.transparent = tr; m.needsUpdate = true; });
    }
    const rows = new Map(), byId = [];
    const rbd = R.renderBufferDirect;
    R.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) {
      if (!(mat.isMeshDepthMaterial || mat.isMeshDistanceMaterial)) {
        const n = geo.index ? geo.index.count : (geo.attributes.position ? geo.attributes.position.count : 0);
        let c = geo.drawRange ? Math.min(n, geo.drawRange.count) : n; if (grp) c = Math.min(c, grp.count);
        const inst = obj.isInstancedMesh ? obj.count : (geo.isInstancedBufferGeometry ? geo.instanceCount : 1);
        const verts = c * (inst === Infinity ? 1 : inst), tris = obj.isMesh ? verts / 3 : 0;
        const pn = obj.parent && obj.parent !== S ? (obj.parent.name || '') : '';
        const key = (obj.name || pn || obj.geometry?.type || obj.type).slice(0, 26).replace(/_-?\d+_-?\d+$/, '') + ' | ' + (cats.get(obj) || catOf(obj));
        let row = rows.get(key); if (!row) { row = { key, draws: 0, tris: 0, shaded: 0, indexed: !!geo.index, px: 0, drawsHit: 0 }; rows.set(key, row); }
        row.draws++; row.tris += tris; row.shaded += geo.index ? Math.min(c, geo.attributes.position.count) * (inst === Infinity ? 1 : inst) : verts;
        byId.push(row); curId = byId.length;
      } else curId = 0;
      return rbd.apply(this, arguments);
    };
    // three only uploads a material's uniforms when the material changes, so the id goes straight to GL at each draw
    let curId = 0; const locs = new Map();
    beforeDraw = c => { if (!curId) return; const pr = c.getParameter(c.CURRENT_PROGRAM); if (!pr) return; let l = locs.get(pr); if (l === undefined) { l = c.getUniformLocation(pr, 'uProbeId'); locs.set(pr, l); } if (l) c.uniform3f(l, (curId & 255) / 255, ((curId >> 8) & 255) / 255, ((curId >> 16) & 255) / 255); };
    R.setRenderTarget(rt); R.clear(); R.render(S, G.camera);
    const px = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, px);
    beforeDraw = null; R.renderBufferDirect = rbd; R.setRenderTarget(null); rt.dispose();
    undo.forEach(f => f()); THREE.ColorManagement.enabled = lin;
    const hit = new Uint32Array(byId.length + 2);
    for (let i = 0; i < px.length; i += 4) { const id = px[i] | (px[i + 1] << 8) | (px[i + 2] << 16); if (id > 0 && id <= byId.length) hit[id]++; else hit[byId.length + 1]++; }
    for (let i = 1; i <= byId.length; i++) { const r = byId[i - 1]; r.px += hit[i]; if (hit[i]) r.drawsHit++; }
    const T = w * h, list = [...rows.values()].map(r => ({ ...r, tris: Math.round(r.tris), shaded: Math.round(r.shaded), pxPct: +(r.px / T * 100).toFixed(2) })).sort((a, b) => b.tris - a.tris);
    return { idpass: list, w, h, drawn: byId.length, trisAll: list.reduce((a, r) => a + r.tris, 0), trisHit: 0, background: +(hit[byId.length + 1] / T * 100).toFixed(2) };
  }

  async function ab(name, on, rounds, n, warm) {
    const A = [], B = [];
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < warm; i++) await frame();
      A.push(await sample(n));
      const off = on();
      for (let i = 0; i < warm; i++) await frame();
      B.push(await sample(n));
      off();
    }
    for (let i = 0; i < warm; i++) await frame();
    const a = med(A.map(x => x.tot)), b = med(B.map(x => x.tot));
    return { name, base: +a.toFixed(2), with: +b.toFixed(2), d: +(b - a).toFixed(2), pct: +((b - a) / a * 100).toFixed(1), js: +med(B.map(x => x.js)).toFixed(2), baseRounds: A.map(x => +x.tot.toFixed(1)), withRounds: B.map(x => +x.tot.toFixed(1)) };
  }

  // The same instant drawn both ways inside one task (nothing moves in between): how many pixels differ, and by how much. At the iPhone's pixel ratio.
  function grab(w, h) { const a = new Uint8Array(w * h * 4), fb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb); return a; }
  async function diff(v, shots) {
    const on = VARIANTS[v]; if (!on) return { error: 'no variant ' + v };
    await frame();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const off = on(); R.render(S, G.camera); off();                 // compiles the variant's programs first, so that the pair below sits in one task with no hitch in between
    await frame();
    R.render(S, G.camera); const a = grab(w, h), ja = shots ? R.domElement.toDataURL('image/jpeg', 0.8) : '';
    const off2 = on(); R.render(S, G.camera); const b = grab(w, h), jb = shots ? R.domElement.toDataURL('image/jpeg', 0.8) : ''; off2();
    let n1 = 0, n4 = 0, n8 = 0, n32 = 0, mx = 0;
    for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > 1) n1++; if (d > 4) n4++; if (d > 8) n8++; if (d > 32) n32++; if (d > mx) mx = d; }
    const T = w * h, pc = n => +(n / T * 100).toFixed(4);
    return { diff: v, w, h, over1: pc(n1), over4: pc(n4), over8: pc(n8), over32: pc(n32), max: mx, ja, jb };
  }

  async function main() {
    while (!(window.game && window.game.renderer && !document.getElementById('loading'))) await sleep(250);
    G = window.game; R = G.renderer; S = G.scene; THREE = await import('three');
    post({ phase: 'loaded', t: Math.round(performance.now()), dpr: devicePixelRatio, size: [innerWidth, innerHeight], renderer: (() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })(), attr: gl.getContextAttributes(), timer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2') });
    // the world around the car first: the tile under it at full detail and nothing in view still on its way (a minute at most on a busy machine)
    for (const t0 = performance.now(); performance.now() - t0 < 60000; await sleep(250)) {
      const w = G.world, c = G.car, t = w && c ? [...w.tiles.values()].find(q => q.i === Math.floor(c.x / 500) && q.j === Math.floor(c.z / 500)) : null;
      if (!w || (t && t.lod === 2 && w.visiblePending() === 0)) break;
    }
    await sleep(P.settle || 8000);
    const pr0 = R.getPixelRatio();
    sync = true;
    for (const step of P.plan || []) {
      if (step.pr) { R.setPixelRatio(step.pr); for (let i = 0; i < 20; i++) await frame(); }
      if (step.rep) rep = step.rep;
      if (step.do === 'census') post({ census: await census(), pr: R.getPixelRatio(), buf: [gl.drawingBufferWidth, gl.drawingBufferHeight] });
      if (step.do === 'fps') { sync = !!step.sync; const t0 = performance.now(); let n = 0; while (performance.now() - t0 < (step.ms || 4000)) { await frame(); n++; } sync = true; post({ fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), pr: R.getPixelRatio() }); }
      if (step.do === 'time') post({ time: await sample(step.n || 40), pr: R.getPixelRatio(), buf: [gl.drawingBufferWidth, gl.drawingBufferHeight], tag: step.tag || '' });
      if (step.do === 'ab') {
        let on = VARIANTS[step.v];
        if (!on && step.v.startsWith('flat=')) { const pat = step.v.slice(5), re = pat[0] === '=' ? { test: c => c === pat.slice(1) } : new RegExp(pat), C = new Set(); S.traverse(o => { const m = matOf(o); if (m && re.test(catOf(o))) C.add(m); }); on = () => patchAll('flatc', sh => { sh.fragmentShader = sh.fragmentShader.replace(/void main\(\) \{/, 'void main() { gl_FragColor = vec4(0.5); return;\n'); }, m => C.has(m)); }   // flat==Name: that category exactly
        if (!on && step.v.startsWith('cat=')) { const re = new RegExp(step.v.slice(4)); on = () => hide(o => re.test(catOf(o))); }
        if (!on) { post({ error: 'no variant ' + step.v }); continue; }
        post({ ab: await ab(step.v, on, step.rounds || 3, step.n || 16, step.warm || 10), pr: R.getPixelRatio() });
      }
      if (step.do === 'idpass') post(await idpass());
      if (step.do === 'eval') { await frame(); post({ eval: await (new Function('G', 'R', 'S', 'THREE', 'gl', 'return (async () => {' + step.js + '})()'))(G, R, S, THREE, gl) }); }
      if (step.do === 'diff') post(await diff(step.v, step.shots));
      if (step.do === 'shot') { R.setPixelRatio(step.spr || pr0); for (let i = 0; i < 6; i++) await frame(); post({ shot: R.domElement.toDataURL('image/jpeg', 0.85) }); }
    }
    post('done');
  }
  main().catch(e => { post({ error: String(e && e.stack || e).slice(0, 500) }); post('done'); });
})();
