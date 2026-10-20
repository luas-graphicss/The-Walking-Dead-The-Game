import * as THREE from 'three'
import { SUN_ANGULAR_DIAMETER, SUN_OFFSET } from './atmosphere'
import { isMobileDevice } from './device'
import { runtime } from './runtime'
import { CHUNK_SIZE } from './world/settings'

export const SHADOW_LAYER = 1
export const MID_SHADOW_LAYER = 2
export const FAR_SHADOW_LAYER = 3
export const ALL_SHADOW_LAYERS = (1 << SHADOW_LAYER) | (1 << MID_SHADOW_LAYER) | (1 << FAR_SHADOW_LAYER)
export const NEAR_SHADOW_LAYERS = (1 << SHADOW_LAYER) | (1 << MID_SHADOW_LAYER)
const RING_LAYERS = [SHADOW_LAYER, MID_SHADOW_LAYER, FAR_SHADOW_LAYER, FAR_SHADOW_LAYER]

export type ShadowRing = {

  extent: number
  size: number

  texel: number

  recenter: number

  refresh: number

  distance: number
  near: number
  far: number

  bias: number
  normalBias: number

  solidBias: number
  slopeCap: number

  filter: 3 | 5

  blend: number

  soft: boolean
}

type RingOptions = { recenter?: number; refresh?: number; filter?: 3 | 5; blend?: number; soft?: boolean }

function ring(extent: number, size: number, { recenter = 0, refresh = 0, filter = 3, blend = 0.15, soft = false }: RingOptions = {}): ShadowRing {
  const texel = (extent * 2) / size

  const distance = extent * 1.6 + 120
  const near = 1, far = distance * 2, depth = far - near
  return {
    extent, size, texel, recenter, refresh, distance, near, far, filter, blend, soft,
    bias: -texel / depth,

    normalBias: texel * (filter / 2 + 1.5),
    solidBias: (-0.05 * texel) / depth,
    slopeCap: (4 * 2 * extent) / depth,
  }
}

let rings: ShadowRing[] | null = null

export function shadowRings() {
  if (rings) return rings
  rings = isMobileDevice()
    ? [
      ring(10, 1024, { blend: 0.2, soft: true }),
      ring(22, 1024, { recenter: 5, refresh: 0.35 }),
      ring(80, 1024, { recenter: 16, refresh: 0.6 }),
      ring(300, 1024, { recenter: 60, refresh: 1.5, blend: 0.25 }),
    ]
    : [
      ring(12, 2048, { blend: 0.2, soft: true }),
      ring(26, 2048, { recenter: 6, refresh: 0.25, soft: true }),
      ring(100, 2048, { recenter: 20, refresh: 0.4 }),
      ring(460, 2048, { recenter: 80, refresh: 1.2, blend: 0.25 }),
    ]
  installSunRings(rings)
  return rings
}

export function ringReach(index: number) {
  const entry = shadowRings()[index]
  return entry.extent + entry.recenter
}

export const SHADOW_BASIS = (() => {
  const basis = new THREE.Matrix4().lookAt(SUN_OFFSET, new THREE.Vector3(), THREE.Object3D.DEFAULT_UP)
  const right = new THREE.Vector3(), up = new THREE.Vector3(), back = new THREE.Vector3()
  basis.extractBasis(right, up, back)
  return { right, up, back }
})()

const CASTER_RELIEF = 80

export const shadowCasters: { versions: number[] } = { versions: [] }

export function invalidateStillShadows(x: number, z: number, radius: number) {
  const { right, up } = SHADOW_BASIS, player = runtime.playerPosition
  const dx = x - runtime.origin.x - player.x, dz = z - runtime.origin.z - player.z
  const across = Math.abs(dx * right.x + dz * right.z) - radius
  const along = Math.abs(dx * up.x + dz * up.z) - radius * Math.hypot(up.x, up.z) - CASTER_RELIEF * Math.abs(up.y)
  const { versions } = shadowCasters
  for (let index = 1; index < shadowRings().length; index++) {
    const reach = ringReach(index)
    if (across <= reach && along <= reach) versions[index] = (versions[index] ?? 0) + 1
  }
}

export function invalidateChunkShadows(cx: number, cz: number) {
  invalidateStillShadows((cx + 0.5) * CHUNK_SIZE, (cz + 0.5) * CHUNK_SIZE, CHUNK_SIZE * Math.SQRT1_2)
}

const movers = new Set<THREE.Object3D>()
export function trackShadowMover(object: THREE.Object3D) {
  movers.add(object)
  return () => { movers.delete(object) }
}

export type ShadowPass = (renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera) => void
const passes = new Set<ShadowPass>()
export function addShadowPass(pass: ShadowPass) {
  passes.add(pass)
  return () => { passes.delete(pass) }
}

const ringOfLight = new WeakMap<THREE.Light, number>()
export function assignShadowRing(light: THREE.Light, index: number) {
  ringOfLight.set(light, index)
  return () => { ringOfLight.delete(light) }
}

export function routeShadowRings(renderer: THREE.WebGLRenderer) {
  const shadowMap = renderer.shadowMap
  const render = shadowMap.render
  const single: THREE.Light[] = []
  const hidden: THREE.Object3D[] = []
  shadowMap.render = (lights, scene, camera) => {
    const mask = camera.layers.mask
    try {
      for (const light of lights) {
        const index = ringOfLight.get(light)
        const shadow = (light as THREE.Light & { shadow?: THREE.LightShadow }).shadow
        if (index !== undefined && shadow && !shadow.autoUpdate && !shadow.needsUpdate) continue
        single[0] = light
        camera.layers.mask = index === undefined ? mask : mask | (1 << RING_LAYERS[index])
        const still = index !== undefined && index > 0
        if (still) for (const mover of movers) if (mover.visible) { mover.visible = false; hidden.push(mover) }
        try {
          render.call(shadowMap, single, scene, camera)
        } finally {
          for (const mover of hidden) mover.visible = true
          hidden.length = 0
        }
      }
    } finally {
      camera.layers.mask = mask
      single.length = 0
    }
    for (const pass of passes) pass(renderer, scene, camera)
  }
  return () => { shadowMap.render = render }
}

const SUN_RING_LIGHTS = `
	DirectionalLight directionalLight = directionalLights[ 0 ];
	getDirectionalLightInfo( directionalLight, directLight );
	directLight.color *= ( directLight.visible && receiveShadow ) ? getSunRingShadow() : 1.0;
	#if defined( USE_AOMAP ) && ! defined( SUN_RING_THIN )
		directLight.color *= sunRingMicroShadow( dot( geometryNormal, directLight.direction ), ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0 );
	#endif
	RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
`

const ringsActive = (count: number) => `( NUM_DIR_LIGHT_SHADOWS == ${count} ) && ( NUM_DIR_LIGHTS == ${count} )`

const glslFloat = (value: number) => {
  const text = value.toPrecision(7)
  return /[.e]/.test(text) ? text : `${text}.0`
}

const SUN_RING_FILTERS =            `
	float sunRingTap( sampler2DShadow map, vec2 base, vec2 offset, vec2 texel, vec3 coord, vec2 slope ) {
		vec2 uv = base + offset * texel;
		return texture( map, vec3( uv, coord.z + dot( slope, uv - coord.xy ) ) );
	}

	float sunRingTent3( sampler2DShadow map, vec2 size, vec3 coord, vec2 slope ) {
		vec2 texel = 1.0 / size;
		vec2 uv = coord.xy * size;
		vec2 base = floor( uv + 0.5 );
		vec2 st = uv + 0.5 - base;
		base = ( base - 0.5 ) * texel;
		vec2 w0 = 3.0 - 2.0 * st;
		vec2 w1 = 1.0 + 2.0 * st;
		vec2 o0 = ( 2.0 - st ) / w0 - 1.0;
		vec2 o1 = st / w1 + 1.0;
		float sum = w0.x * w0.y * sunRingTap( map, base, vec2( o0.x, o0.y ), texel, coord, slope );
		sum += w1.x * w0.y * sunRingTap( map, base, vec2( o1.x, o0.y ), texel, coord, slope );
		sum += w0.x * w1.y * sunRingTap( map, base, vec2( o0.x, o1.y ), texel, coord, slope );
		sum += w1.x * w1.y * sunRingTap( map, base, vec2( o1.x, o1.y ), texel, coord, slope );
		return sum / 16.0;
	}

	float sunRingTent5( sampler2DShadow map, vec2 size, vec3 coord, vec2 slope ) {
		vec2 texel = 1.0 / size;
		vec2 uv = coord.xy * size;
		vec2 base = floor( uv + 0.5 );
		vec2 st = uv + 0.5 - base;
		base = ( base - 0.5 ) * texel;
		vec2 w0 = 4.0 - 3.0 * st;
		vec2 w1 = vec2( 7.0 );
		vec2 w2 = 1.0 + 3.0 * st;
		vec2 o0 = ( 3.0 - 2.0 * st ) / w0 - 2.0;
		vec2 o1 = ( 3.0 + st ) / w1;
		vec2 o2 = st / w2 + 2.0;
		float sum = w0.x * w0.y * sunRingTap( map, base, vec2( o0.x, o0.y ), texel, coord, slope );
		sum += w1.x * w0.y * sunRingTap( map, base, vec2( o1.x, o0.y ), texel, coord, slope );
		sum += w2.x * w0.y * sunRingTap( map, base, vec2( o2.x, o0.y ), texel, coord, slope );
		sum += w0.x * w1.y * sunRingTap( map, base, vec2( o0.x, o1.y ), texel, coord, slope );
		sum += w1.x * w1.y * sunRingTap( map, base, vec2( o1.x, o1.y ), texel, coord, slope );
		sum += w2.x * w1.y * sunRingTap( map, base, vec2( o2.x, o1.y ), texel, coord, slope );
		sum += w0.x * w2.y * sunRingTap( map, base, vec2( o0.x, o2.y ), texel, coord, slope );
		sum += w1.x * w2.y * sunRingTap( map, base, vec2( o1.x, o2.y ), texel, coord, slope );
		sum += w2.x * w2.y * sunRingTap( map, base, vec2( o2.x, o2.y ), texel, coord, slope );
		return sum / 144.0;
	}
`

const SOFT_MAX_GAP = 24

const SOFT_GAPS = [0.35, 2.5, 9]
const SOFT_TYPICAL = [1.3, 5.5, 15]

const SUN_TAN = Math.tan(SUN_ANGULAR_DIAMETER / 2)

const softReach = (entry: ShadowRing) => (SOFT_MAX_GAP * SUN_TAN) / entry.texel

function softRingFunction(entry: ShadowRing, index: number) {
  const offset = (metres: number) => glslFloat(metres / (entry.far - entry.near))
  return            `
	float sunRingSoft${index}( sampler2DShadow map, vec2 size, vec3 coord, vec2 slope ) {
		float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
		float searchUv = ${glslFloat((SOFT_MAX_GAP * SUN_TAN) / (2 * entry.extent))};
		float blocked = 0.0;
		for ( int i = 0; i < SUN_SOFT_SEARCH; i ++ ) {
			vec2 uv = coord.xy + sunRingDisk( i, SUN_SOFT_SEARCH, phi ) * searchUv;
			blocked += 1.0 - texture( map, vec3( uv, coord.z + dot( slope, uv - coord.xy ) - ${offset(SOFT_GAPS[0])} ) );
		}
		if ( blocked < 0.05 ) return sunRingTent3( map, size, coord, slope );
		float past1 = 0.0, past2 = 0.0;
		for ( int i = 0; i < SUN_SOFT_SEARCH; i ++ ) {
			vec2 uv = coord.xy + sunRingDisk( i, SUN_SOFT_SEARCH, phi ) * searchUv;
			float z = coord.z + dot( slope, uv - coord.xy );
			past1 += 1.0 - texture( map, vec3( uv, z - ${offset(SOFT_GAPS[1])} ) );
			past2 += 1.0 - texture( map, vec3( uv, z - ${offset(SOFT_GAPS[2])} ) );
		}
		past1 = min( past1, blocked );
		past2 = min( past2, past1 );
		float gap = ( ( blocked - past1 ) * ${glslFloat(SOFT_TYPICAL[0])} + ( past1 - past2 ) * ${glslFloat(SOFT_TYPICAL[1])} + past2 * ${glslFloat(SOFT_TYPICAL[2])} ) / blocked;
		float radius = gap * ${glslFloat(SUN_TAN / entry.texel)};
		float spread = smoothstep( 1.4, 2.6, radius );
		if ( spread <= 0.0 ) return sunRingTent3( map, size, coord, slope );
		float reach = radius / size.x;
		float lit = 0.0;
		for ( int i = 0; i < SUN_SOFT_FILTER; i ++ ) {
			vec2 uv = coord.xy + sunRingDisk( i, SUN_SOFT_FILTER, phi + 2.1 ) * reach;
			lit += texture( map, vec3( uv, coord.z + dot( slope, uv - coord.xy ) ) );
		}
		lit /= float( SUN_SOFT_FILTER );
		return spread >= 1.0 ? lit : mix( sunRingTent3( map, size, coord, slope ), lit, spread );
	}
`
}

export const LOCAL_SHADOW_NEAR = 0.5

function localSoftShadows() {
  const mobile = isMobileDevice()
  const near = glslFloat(LOCAL_SHADOW_NEAR), inverseNear = glslFloat(1 / LOCAL_SHADOW_NEAR)
  return            `
#ifdef USE_SHADOWMAP

	#if defined( SHADOWMAP_TYPE_PCF ) && ! defined( USE_REVERSED_DEPTH_BUFFER ) && ( NUM_SPOT_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 )

		#define LOCAL_SOFT_SEARCH ${mobile ? 4 : 6}
		#define LOCAL_SOFT_FILTER ${mobile ? 8 : 12}

		vec2 localSoftDisk( int index, int count, float phi ) {
			float r = sqrt( ( float( index ) + 0.5 ) / float( count ) );
			float theta = float( index ) * 2.39996323 + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}

		float localSoftRatio( float blocked, float past1, float past2 ) {
			past1 = min( past1, blocked );
			past2 = min( past2, past1 );
			return ( ( blocked - past1 ) * 0.316 + ( past1 - past2 ) * 1.22 + past2 * 4.0 ) / blocked;
		}

	#endif

	#if NUM_SPOT_LIGHT_SHADOWS > 0

		#if defined( SHADOWMAP_TYPE_PCF ) && ! defined( USE_REVERSED_DEPTH_BUFFER )

			float getSpotShadowSoft( float coneCos, sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float lightRadius, vec4 shadowCoord ) {
				vec3 coord = shadowCoord.xyz / shadowCoord.w;
				float receiver = shadowCoord.w;
				if ( receiver <= ${near} || coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0 || coord.z > 1.0 ) return 1.0;

				float scale = coord.z / ( 1.0 / receiver - ${inverseNear} );
				float depth0 = scale * ( 1.0 / ( 0.92 * receiver ) - ${inverseNear} ) + shadowBias;
				float depth1 = scale * ( 1.0 / ( 0.6 * receiver ) - ${inverseNear} ) + shadowBias;
				float depth2 = scale * ( 1.0 / max( 0.3 * receiver, ${near} ) - ${inverseNear} ) + shadowBias;
				coord.z += shadowBias;
				float tanHalf = sqrt( max( 1.0 - coneCos * coneCos, 1e-6 ) ) / max( coneCos, 1e-3 );
				float uvPerMetre = 0.5 / ( receiver * tanHalf );
				float texel = 1.0 / shadowMapSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				float searchUv = clamp( lightRadius * 2.33 * uvPerMetre, 1.5 * texel, 28.0 * texel );
				float blocked = 0.0;
				for ( int i = 0; i < LOCAL_SOFT_SEARCH; i ++ ) {
					blocked += 1.0 - texture( shadowMap, vec3( coord.xy + localSoftDisk( i, LOCAL_SOFT_SEARCH, phi ) * searchUv, depth0 ) );
				}
				float filterUv = 1.2 * texel;
				if ( blocked > 0.05 ) {
					float past1 = 0.0, past2 = 0.0;
					for ( int i = 0; i < LOCAL_SOFT_SEARCH; i ++ ) {
						vec2 uv = coord.xy + localSoftDisk( i, LOCAL_SOFT_SEARCH, phi ) * searchUv;
						past1 += 1.0 - texture( shadowMap, vec3( uv, depth1 ) );
						past2 += 1.0 - texture( shadowMap, vec3( uv, depth2 ) );
					}
					filterUv = clamp( lightRadius * localSoftRatio( blocked, past1, past2 ) * uvPerMetre, 1.2 * texel, 32.0 * texel );
				}
				float lit = 0.0;
				for ( int i = 0; i < LOCAL_SOFT_FILTER; i ++ ) {
					lit += texture( shadowMap, vec3( coord.xy + localSoftDisk( i, LOCAL_SOFT_FILTER, phi + 2.1 ) * filterUv, coord.z ) );
				}
				return mix( 1.0, lit / float( LOCAL_SOFT_FILTER ), shadowIntensity );
			}

		#elif defined( SHADOWMAP_TYPE_PCF )

			float getSpotShadowSoft( float coneCos, sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
				return getShadow( shadowMap, shadowMapSize, shadowIntensity, shadowBias, shadowRadius, shadowCoord );
			}

		#else

			float getSpotShadowSoft( float coneCos, sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
				return getShadow( shadowMap, shadowMapSize, shadowIntensity, shadowBias, shadowRadius, shadowCoord );
			}

		#endif

	#endif

	#if NUM_POINT_LIGHT_SHADOWS > 0

		#if defined( SHADOWMAP_TYPE_PCF ) && ! defined( USE_REVERSED_DEPTH_BUFFER )

			float getPointShadowSoft( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float lightRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
				vec3 toFragment = shadowCoord.xyz;
				vec3 axes = abs( toFragment );
				float axis = max( max( axes.x, axes.y ), axes.z );
				if ( axis > shadowCameraFar || axis < shadowCameraNear ) return 1.0;
				float range = length( toFragment );
				vec3 direction = toFragment / range;
				vec3 tangent = normalize( cross( direction, abs( direction.x ) > abs( direction.z ) ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 ) ) );
				vec3 bitangent = cross( direction, tangent );

				#define POINT_SOFT_DEPTH( z ) ( shadowCameraFar * ( ( z ) - shadowCameraNear ) / ( ( z ) * ( shadowCameraFar - shadowCameraNear ) ) + shadowBias )
				float receiverDepth = POINT_SOFT_DEPTH( axis );
				float depth0 = POINT_SOFT_DEPTH( max( axis * 0.92, shadowCameraNear ) );
				float depth1 = POINT_SOFT_DEPTH( max( axis * 0.6, shadowCameraNear ) );
				float depth2 = POINT_SOFT_DEPTH( max( axis * 0.3, shadowCameraNear ) );
				#undef POINT_SOFT_DEPTH
				float texelAngle = 2.0 / shadowMapSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				float searchAngle = clamp( lightRadius * 2.33 / range, 1.5 * texelAngle, 28.0 * texelAngle );
				float blocked = 0.0;
				for ( int i = 0; i < LOCAL_SOFT_SEARCH; i ++ ) {
					vec2 o = localSoftDisk( i, LOCAL_SOFT_SEARCH, phi ) * searchAngle;
					blocked += 1.0 - texture( shadowMap, vec4( direction + tangent * o.x + bitangent * o.y, depth0 ) );
				}
				float filterAngle = 1.2 * texelAngle;
				if ( blocked > 0.05 ) {
					float past1 = 0.0, past2 = 0.0;
					for ( int i = 0; i < LOCAL_SOFT_SEARCH; i ++ ) {
						vec2 o = localSoftDisk( i, LOCAL_SOFT_SEARCH, phi ) * searchAngle;
						vec3 tap = direction + tangent * o.x + bitangent * o.y;
						past1 += 1.0 - texture( shadowMap, vec4( tap, depth1 ) );
						past2 += 1.0 - texture( shadowMap, vec4( tap, depth2 ) );
					}
					filterAngle = clamp( lightRadius * localSoftRatio( blocked, past1, past2 ) / range, 1.2 * texelAngle, 32.0 * texelAngle );
				}
				float lit = 0.0;
				for ( int i = 0; i < LOCAL_SOFT_FILTER; i ++ ) {
					vec2 o = localSoftDisk( i, LOCAL_SOFT_FILTER, phi + 2.1 ) * filterAngle;
					lit += texture( shadowMap, vec4( direction + tangent * o.x + bitangent * o.y, receiverDepth ) );
				}
				return mix( 1.0, lit / float( LOCAL_SOFT_FILTER ), shadowIntensity );
			}

		#elif defined( SHADOWMAP_TYPE_PCF )

			float getPointShadowSoft( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
				return getPointShadow( shadowMap, shadowMapSize, shadowIntensity, shadowBias, shadowRadius, shadowCoord, shadowCameraNear, shadowCameraFar );
			}

		#elif defined( SHADOWMAP_TYPE_BASIC )

			float getPointShadowSoft( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
				return getPointShadow( shadowMap, shadowMapSize, shadowIntensity, shadowBias, shadowRadius, shadowCoord, shadowCameraNear, shadowCameraFar );
			}

		#endif

	#endif

#endif
`
}

function ringStep(entry: ShadowRing, index: number, first: ShadowRing) {
  const shadow = `directionalLightShadows[ ${index} ]`

  const reach = entry.soft ? softReach(entry) + 2 : entry.filter / 2 + 1
  const margin = glslFloat((reach * 2) / entry.size)

  const rescale = glslFloat((entry.extent / (entry.far - entry.near)) / (first.extent / (first.far - first.near)))
  const cap = glslFloat(entry.slopeCap)

  const residual = glslFloat(0.5 / entry.size)
  const tent = `sunRingTent${entry.filter}( directionalShadowMap[ ${index} ], ${shadow}.shadowMapSize, sunRingCoord, sunRingSlope )`

  const solid = entry.soft
    ? `
						#ifdef SUN_RING_FAST
							sunRingFiltered = ${tent};
						#else
							sunRingFiltered = sunRingSoft${index}( directionalShadowMap[ ${index} ], ${shadow}.shadowMapSize, sunRingCoord, sunRingSlope );
						#endif`
    : `
						sunRingFiltered = ${tent};`
  return `
		if ( sunShadowLeft > 0.0 ) {
			sunRingCoord = vDirectionalShadowCoord[ ${index} ].xyz / vDirectionalShadowCoord[ ${index} ].w;
			sunRingWeight = sunRingCover( sunRingCoord, ${margin}, ${glslFloat(entry.blend)} );
			if ( sunRingWeight > 0.0 ) {
				#if defined( SHADOWMAP_TYPE_PCF )
					#ifdef SUN_RING_THIN
						sunRingSlope = vec2( 0.0 );
						sunRingCoord.z += ${shadow}.shadowBias;
						sunRingFiltered = ${tent};
					#else
						sunRingSlope = clamp( sunRingPlane * ${rescale}, - ${cap}, ${cap} );
						sunRingCoord.z += ${glslFloat(entry.solidBias)} - ${residual} * ( abs( sunRingSlope.x ) + abs( sunRingSlope.y ) );${solid}
					#endif
					sunRingSample = mix( 1.0, sunRingFiltered, ${shadow}.shadowIntensity );
				#else
					sunRingSample = getShadow( directionalShadowMap[ ${index} ], ${shadow}.shadowMapSize, ${shadow}.shadowIntensity, ${shadow}.shadowBias, ${shadow}.shadowRadius, vDirectionalShadowCoord[ ${index} ] );
				#endif
				sunShadow += sunShadowLeft * sunRingWeight * sunRingSample;
				sunShadowLeft *= 1.0 - sunRingWeight;
			}
		}
`
}

function sunRingFragment(list: ShadowRing[]) {
  const mobile = isMobileDevice()
  return `
#if defined( USE_SHADOWMAP ) && ${ringsActive(list.length)}

	#define SUN_RING_SHADOWS

	#if defined( DOUBLE_SIDED ) && ! defined( SUN_RING_SOLID )
		#define SUN_RING_THIN
	#endif

	#if defined( SHADOWMAP_TYPE_PCF )
${SUN_RING_FILTERS}
		#define SUN_SOFT_SEARCH ${mobile ? 4 : 6}
		#define SUN_SOFT_FILTER ${mobile ? 8 : 14}

		vec2 sunRingDisk( int index, int count, float phi ) {
			float r = sqrt( ( float( index ) + 0.5 ) / float( count ) );
			float theta = float( index ) * 2.39996323 + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
${list.map((entry, index) => (entry.soft ? softRingFunction(entry, index) : '')).join('')}
	#endif

	float sunRingCover( vec3 coord, float margin, float blend ) {
		float edge = max( abs( coord.x - 0.5 ), abs( coord.y - 0.5 ) ) * 2.0;
		return ( 1.0 - smoothstep( 1.0 - margin - blend, 1.0 - margin, edge ) ) * step( 0.0, coord.z ) * step( coord.z, 1.0 );
	}

	float sunRingMicroShadow( float facing, float occlusion ) {
		return clamp( abs( facing ) + 2.0 * occlusion * occlusion - 1.0, 0.0, 1.0 );
	}

	#ifndef SUN_RING_THIN

		vec2 sunRingReceiverPlane( vec3 coord ) {
			vec3 dx = dFdx( coord ), dy = dFdy( coord );
			float det = dx.x * dy.y - dx.y * dy.x;
			det = abs( det ) < 1e-24 ? 1e-24 : det;
			return vec2( dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z ) / det;
		}
	#endif

	float getSunRingShadow() {
		float sunShadow = 0.0;
		float sunShadowLeft = 1.0;
		vec3 sunRingCoord;
		vec2 sunRingSlope;
		float sunRingWeight;
		float sunRingSample;
		float sunRingFiltered;
		#ifndef SUN_RING_THIN

			vec2 sunRingPlane = sunRingReceiverPlane( vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w );
		#endif
${list.map((entry, index) => ringStep(entry, index, list[0])).join('')}
		return sunShadow + sunShadowLeft;
	}

#endif
`
}

function sunRingVertex(list: ShadowRing[]) {
  const steps = list.map((_, index) => `
		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * ( directionalLightShadows[ ${index} ].shadowNormalBias * sunRingOffset ) + sunRingLift, 0.0 );
		vDirectionalShadowCoord[ ${index} ] = directionalShadowMatrix[ ${index} ] * shadowWorldPosition;`).join('')
  return `
	#if ${ringsActive(list.length)}

		vec3 sunRingToLight = - normalize( vec3( directionalShadowMatrix[ 0 ][ 0 ][ 2 ], directionalShadowMatrix[ 0 ][ 1 ][ 2 ], directionalShadowMatrix[ 0 ][ 2 ][ 2 ] ) );
		float sunRingFacing = dot( shadowWorldNormal, sunRingToLight );
		#if defined( DOUBLE_SIDED ) && ! defined( SUN_RING_SOLID )
			float sunRingOffset = sqrt( clamp( 1.0 - sunRingFacing * sunRingFacing, 0.0, 1.0 ) );
		#else
			float sunRingOffset = 1.0 - smoothstep( 0.05, 0.25, sunRingFacing );
		#endif
		#ifdef SUN_RING_LIFT
			vec3 sunRingLift = sunRingToLight * float( SUN_RING_LIFT );
		#else
			vec3 sunRingLift = vec3( 0.0 );
		#endif
${steps}

	#else
`
}

const LIGHTS_START = '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )'
const LIGHTS_END = '#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )'
const VERTEX_LOOP = 'for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {'
const LOOP_START = '#pragma unroll_loop_start'
const LOOP_END = '#pragma unroll_loop_end'
const SPOT_SHADOW_CALL = 'getShadow( spotShadowMap[ i ],'
const POINT_SHADOW_CALL = 'getPointShadow( pointShadowMap[ i ],'

type ChunkOriginals = { lights: string; shadows: string; vertex: string }
const ORIGINALS_KEY = '__twdSunRingChunks'

function installSunRings(list: ShadowRing[]) {
  const store = globalThis as unknown as Record<string, ChunkOriginals | undefined>
  const originals = (store[ORIGINALS_KEY] ??= {
    lights: THREE.ShaderChunk.lights_fragment_begin,
    shadows: THREE.ShaderChunk.shadowmap_pars_fragment,
    vertex: THREE.ShaderChunk.shadowmap_vertex,
  })
  const lightsStart = originals.lights.indexOf(LIGHTS_START), lightsEnd = originals.lights.indexOf(LIGHTS_END)
  const loop = originals.vertex.indexOf(VERTEX_LOOP)
  const loopStart = originals.vertex.lastIndexOf(LOOP_START, loop), loopEnd = originals.vertex.indexOf(LOOP_END, loop)
  if (lightsStart < 0 || lightsEnd < lightsStart || loop < 0 || loopStart < 0 || loopEnd < 0) {
    console.error('[shadow] three.js shadow chunks changed; long-range shadows are off.')
    return
  }
  const active = ringsActive(list.length)
  const lightsBlock = originals.lights.slice(lightsStart, lightsEnd)
  let lights = `${originals.lights.slice(0, lightsStart)}#if ${active} && defined( USE_SHADOWMAP ) && defined( RE_Direct )
${SUN_RING_LIGHTS}
#else

${lightsBlock}
#endif

${originals.lights.slice(lightsEnd)}`

  if (lights.includes(SPOT_SHADOW_CALL) && lights.includes(POINT_SHADOW_CALL)) {
    lights = lights
      .replace(SPOT_SHADOW_CALL, 'getSpotShadowSoft( spotLight.coneCos, spotShadowMap[ i ],')
      .replace(POINT_SHADOW_CALL, 'getPointShadowSoft( pointShadowMap[ i ],')
  } else {
    console.warn('[shadow] three.js light chunks changed; local lights keep their stock shadows.')
  }
  THREE.ShaderChunk.lights_fragment_begin = lights
  THREE.ShaderChunk.shadowmap_pars_fragment = originals.shadows + sunRingFragment(list) + localSoftShadows()
  const vertexEnd = loopEnd + LOOP_END.length
  THREE.ShaderChunk.shadowmap_vertex = `${originals.vertex.slice(0, loopStart)}${sunRingVertex(list)}
		${originals.vertex.slice(loopStart, vertexEnd)}

	#endif
${originals.vertex.slice(vertexEnd)}`
}
