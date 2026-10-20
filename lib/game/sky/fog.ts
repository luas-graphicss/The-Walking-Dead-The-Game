import * as THREE from 'three'
import { ATMOSPHERE_GLSL } from './atmosphere-glsl'

const FOG_PARS_VERTEX =            `
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogRay;
#endif
`

const FOG_VERTEX =            `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogRay = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;
#endif
`

const FOG_PARS_FRAGMENT =            `
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogRay;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
${ATMOSPHERE_GLSL}

	vec4 atmosphereFog() {
		float dist = length( vFogRay );
		vec3 dir = vFogRay / max( dist, 1e-4 );
		#ifdef FOG_EXP2
			float floorY = cameraPosition.y - 20.0;
			float edgeEnd = 2.5 / max( fogDensity, 1e-6 );
		#else
			float floorY = fogNear;
			float edgeEnd = fogFar;
		#endif
		float haze = 1.0 - exp( - atmoDepth( cameraPosition.y, dir, dist, floorY ) );
		float edge = smoothstep( edgeEnd * ATMO_EDGE_START, edgeEnd, dist );
		float amount = 1.0 - ( 1.0 - haze ) * ( 1.0 - edge );
		vec3 lit = atmoHaze( dir );
		vec3 sky = atmoSky( dir, lit, cameraPosition.y, floorY );
		vec3 color = ( lit * haze * ( 1.0 - edge ) + sky * edge ) / max( amount, 1e-5 );
		return vec4( linearToOutputTexel( vec4( color, 1.0 ) ).rgb, amount );
	}
#endif
`

const FOG_FRAGMENT =            `
#ifdef USE_FOG
	vec4 atmosphereFogResult = atmosphereFog();
	gl_FragColor.rgb = mix( gl_FragColor.rgb, atmosphereFogResult.rgb, atmosphereFogResult.a );
#endif
`

export const atmosphereUniforms = {
  fogFloor: { value: 0 },
}

type FogChunks = { parsVertex: string; vertex: string; parsFragment: string; fragment: string }
const ORIGINALS_KEY = '__twdFogChunks'

export function installAtmosphereFog() {
  const store = globalThis as unknown as Record<string, FogChunks | undefined>
  store[ORIGINALS_KEY] ??= {
    parsVertex: THREE.ShaderChunk.fog_pars_vertex,
    vertex: THREE.ShaderChunk.fog_vertex,
    parsFragment: THREE.ShaderChunk.fog_pars_fragment,
    fragment: THREE.ShaderChunk.fog_fragment,
  }
  THREE.ShaderChunk.fog_pars_vertex = FOG_PARS_VERTEX
  THREE.ShaderChunk.fog_vertex = FOG_VERTEX
  THREE.ShaderChunk.fog_pars_fragment = FOG_PARS_FRAGMENT
  THREE.ShaderChunk.fog_fragment = FOG_FRAGMENT
}
