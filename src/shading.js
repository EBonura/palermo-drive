// The same picture for less work per pixel: three's own shader chunks with the waste taken out, for every material at once (imported by main.js before anything compiles).
// tools/perf/gpucost.mjs measures each of them; ?shade=off leaves the chunks alone, for comparing. If a three upgrade changes a chunk, a replace that finds nothing leaves it as it was.
import * as THREE from 'three';

const C = THREE.ShaderChunk;
export const SHADE = new URLSearchParams(location.search).get('shade') !== 'off';
export const CHUNKS0 = { lights_fragment_begin: C.lights_fragment_begin, lights_fragment_maps: C.lights_fragment_maps, shadowmap_pars_fragment: C.shadowmap_pars_fragment };   // for tools/perf/probe.js: the picture as it was
// The sky's reflection map only varies with height (src/daynight.js bakes a gradient), so what a surface gets from it follows from the height of its normal. The two cube map lookups per pixel, the dearest thing left in a
// rough wall or street, become a little sum over these three: daynight.js writes the numbers into a LightProbe (three's one uniform that every lit material already has) each time it bakes. A rough surface's reflection is that same value.
// Weights on the gradient's three colours (horizon, zenith, below), measured from the bake: they sum to 1, and the fit is exact on floors, walls and ceilings, within 1 % of each weight anywhere else.
const W = { h: [0.3028, 0.09395, -0.16565], z: [0.2848, 0.3825, 0.0988], b: [0.4117, -0.4768, 0.0671] };
export function envProbe(probe, H, Z, B) { for (let i = 0; i < 3; i++) probe.sh.coefficients[i].set(H.r * W.h[i] + Z.r * W.z[i] + B.r * W.b[i], H.g * W.h[i] + Z.g * W.z[i] + B.g * W.b[i], H.b * W.h[i] + Z.b * W.z[i] + B.b * W.b[i]); }
if (SHADE) {
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
    .replace(/RE_Direct\( directLight,/g, 'if ( lightOn ) RE_Direct( directLight,')
    .replace('irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );', '')
    // A dark lamp or headlight (src/daynight.js keeps its three lights in the scene all day at intensity 0, so that dusk compiles nothing) is skipped whole, before its direction,
    // distance and falloff are worked out for the pixel: three only finds it dark after all of that. The branch is on a uniform, the same for every pixel of the frame.
    .replace(/((point|spot)Light = \2Lights\[ i \];)([\s\S]*?RE_Direct\( directLight,[^\n]*\n)/g, '$1\n\t\tif ( $2Light.color != vec3( 0.0 ) ) {$3\t\t}\n');
  C.lights_fragment_maps = C.lights_fragment_maps
    .replace('iblIrradiance += getIBLIrradiance( geometryNormal );', `#ifdef USE_LIGHT_PROBES
			float envY = dot( geometryNormal, viewMatrix[ 1 ].xyz );
			iblIrradiance += PI * ( lightProbe[ 0 ] + envY * ( lightProbe[ 1 ] + envY * lightProbe[ 2 ] ) ) * envMapIntensity;
			#else
			iblIrradiance += getIBLIrradiance( geometryNormal );
			#endif`)
    .replace('vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );', 'vec3 iblRadiance; if ( material.roughness >= 0.8 ) iblRadiance = iblIrradiance / PI; else iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );');

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
