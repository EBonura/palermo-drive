// A detail texture for the trees (src/treegeo.js geometry is vertex coloured and has no uvs): one small tiling canvas of leaf-sized dabs, sampled in world space from two sides, multiplied into the
// vertex colour. It breaks the flat facets of a crown into clusters of leaves and the bark into mottled patches, at the price of two texture reads per pixel of a tree and no geometry.
// It fades out with distance (where a texel is smaller than a pixel it is only noise). Used by the tree materials of src/props.js and src/world.js (the woods and the street trees of the tiles).
import * as THREE from 'three';

let tex = null;
function detailTexture() {
  if (tex || typeof document === 'undefined') return tex;
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  let s = 12345; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
  const dab = (x, y, rx, ry, a, v) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill(); g.restore(); };
  for (let layer = 0; layer < 3; layer++) {   // big soft patches first, then leaf dabs, then fine specks: three scales so it reads at every distance
    const n = [40, 150, 330][layer], sz = [44, 20, 8][layer], spread = [46, 64, 80][layer];
    for (let i = 0; i < n; i++) {
      const x = rnd() * N, y = rnd() * N, rx = sz * (0.6 + 0.8 * rnd()), ry = rx * (0.35 + 0.3 * rnd()), a = rnd() * 3.1416, v = 128 + (rnd() - 0.5) * 2 * spread + (rnd() < 0.18 ? -45 : 0);
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) if (x + ox > -sz * 2 && x + ox < N + sz * 2 && y + oy > -sz * 2 && y + oy < N + sz * 2) dab(x + ox, y + oy, rx, ry, a, Math.max(30, Math.min(230, v)));
    }
  }
  tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 2; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// strength: how far the dabs pull the colour (0 none, 1 full); the mean is kept at 1 so the trees do not get darker or lighter overall
export function treeDetail(mat, strength = 0.85) {
  const t = detailTexture(); if (!t) return mat;
  mat.onBeforeCompile = sh => {
    sh.uniforms.tDetail = { value: t }; sh.uniforms.uDetail = { value: strength };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 tw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        tw = instanceMatrix * tw;
      #endif
      vTP = (modelMatrix * tw).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTP; uniform sampler2D tDetail; uniform float uDetail;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float d1 = texture2D(tDetail, vTP.xz * 0.2 + vTP.y * 0.09).r;
        float d2 = texture2D(tDetail, (vTP.xy + vTP.zy) * 0.32 + 0.37).r;
        float dt = (d1 + d2) * 0.5;
        float fade = 1.0 - smoothstep(70.0, 190.0, distance(vTP, cameraPosition));
        diffuseColor.rgb *= mix(1.0, clamp(dt * 2.0, 0.25, 1.9), uDetail * fade);
      }`);
  };
  mat.customProgramCacheKey = () => 'treedetail';
  return mat;
}
