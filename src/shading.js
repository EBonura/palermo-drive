// The same picture for less work per pixel: three's own shader chunks with the waste taken out, for every material at once (imported by main.js before anything compiles).
// docs/PERF-GPU.md has the measurements; ?shade=off leaves the chunks alone, for comparing. If a three upgrade changes a chunk, a replace that finds nothing leaves it as it was.
import * as THREE from 'three';

const C = THREE.ShaderChunk;
if (new URLSearchParams(location.search).get('shade') !== 'off') {
  // Each light's shadow lookup and BRDF sit behind a branch: where the light adds nothing (out of a lamp's reach, outside the headlight's cone, a surface facing away from the sun)
  // both are skipped, and those are the two dearest things a pixel does. dotNL at or below 0 makes the direct term exactly 0 in the lit materials; toon and the extra lobes of the physical material keep their own rule.
  C.lights_fragment_begin = `#if defined( TOON ) || defined( USE_SHEEN ) || defined( USE_CLEARCOAT ) || defined( USE_IRIDESCENCE )
#define LIGHT_ON directLight.visible
#else
#define LIGHT_ON ( directLight.visible && dot( geometryNormal, directLight.direction ) > 0.0 )
#endif
` + C.lights_fragment_begin
    .replace('IncidentLight directLight;', 'IncidentLight directLight;\nbool lightOn;')
    .replace(/(get(?:Point|Spot|Sun|Directional)LightInfo\( [^;]*directLight \);)/g, '$1\n\t\tlightOn = LIGHT_ON;')
    .replace(/\( directLight\.visible && receiveShadow \)/g, '( lightOn && receiveShadow )')
    .replace(/RE_Direct\( directLight,/g, 'if ( lightOn ) RE_Direct( directLight,');

  // The soft shadow's 5 lookups stand on a Vogel disk turned by a noise angle per pixel, which three works out as 5 sqrt and 5 sin and cos pairs. The radii and base angles are constants,
  // so one sin and cos of the noise angle and a rotation give the same 5 positions.
  const off = i => { const r = Math.sqrt((i + 0.5) / 5), a = i * 2.399963229728653; return `vec2( ${(r * Math.cos(a)).toFixed(9)}, ${(r * Math.sin(a)).toFixed(9)} )`; };
  C.shadowmap_pars_fragment = C.shadowmap_pars_fragment.replace(/float phi = interleavedGradientNoise\( gl_FragCoord\.xy \) \* PI2;\s*shadow = \([\s\S]*?\) \* 0\.2;/, `float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				vec2 vd = vec2( cos( phi ), sin( phi ) );
				mat2 vr = mat2( vd.x, vd.y, - vd.y, vd.x );
				shadow = (
					${[0, 1, 2, 3, 4].map(i => `texture( shadowMap, vec3( shadowCoord.xy + vr * ${off(i)} * radius, shadowCoord.z ) )`).join(' +\n\t\t\t\t\t')}
				) * 0.2;`);
}
