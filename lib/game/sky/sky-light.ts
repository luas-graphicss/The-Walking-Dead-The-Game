import * as THREE from 'three'
import { ATMOSPHERE, FOG, SKY_LIGHT, SUN_DIRECTION } from '../atmosphere'

export const skyLightUniforms = {
  twdSkyMap: { value: null as THREE.Texture | null },

  twdSkyFrame: { value: new THREE.Vector4(0, 0, 1, 0) },

  twdSkyParams: { value: new THREE.Vector4(1, 0, 0, 0) },
  twdSkyCanopy: { value: new THREE.Color().setRGB(...SKY_LIGHT.canopy) },
  twdSkyCeiling: { value: new THREE.Color().setRGB(...SKY_LIGHT.ceiling) },
  twdSkyFacade: { value: new THREE.Color().setRGB(...SKY_LIGHT.facade) },
}

const glslFloat = (value: number) => {
  const text = value.toPrecision(6)
  return /[.e]/.test(text) ? text : `${text}.0`
}

export const FOLIAGE_SKY_DEFINES = { TWD_SKY_FALLBACK: glslFloat(SKY_LIGHT.foliage) }

const SKY_LIGHT_PARS =            `
uniform sampler2D twdSkyMap;
uniform vec4 twdSkyFrame;
uniform vec4 twdSkyParams;
uniform vec3 twdSkyCanopy;
uniform vec3 twdSkyCeiling;
uniform vec3 twdSkyFacade;

#ifndef TWD_SKY_FALLBACK
	#define TWD_SKY_FALLBACK 1.0
#endif

float twdSkyRise( const in vec4 tap, const in float height ) {
	return tap.g > 0.02 ? tap.r / tap.g - height : 0.0;
}

vec4 twdSkyFallback() {
	return vec4( PI * twdSkyCanopy * ( 1.0 - TWD_SKY_FALLBACK ), TWD_SKY_FALLBACK );
}

vec4 twdSkyLight( const in vec3 viewPosition, const in vec3 viewNormal ) {
	if ( twdSkyParams.y < 0.5 ) return twdSkyFallback();
	vec3 skyPosition = cameraPosition + ( vec4( viewPosition, 0.0 ) * viewMatrix ).xyz;
	vec3 skyNormal = ( vec4( viewNormal, 0.0 ) * viewMatrix ).xyz;
	vec2 skyUv = vec2( skyPosition.x - twdSkyFrame.x, twdSkyFrame.y - skyPosition.z ) * twdSkyFrame.z + 0.5;
	float skyInside = 1.0 - smoothstep( 0.78, 0.96, max( abs( skyUv.x - 0.5 ), abs( skyUv.y - 0.5 ) ) * 2.0 );
	if ( skyInside <= 0.0 ) return twdSkyFallback();
	float skyHeight = skyPosition.y - twdSkyFrame.w;

	vec2 skyAway = vec2( skyNormal.x, - skyNormal.z ) * twdSkyFrame.z;
	vec2 skyAbove = skyUv + skyAway * 0.6;

	float rise = twdSkyRise( textureLod( twdSkyMap, skyAbove, 0.0 ), skyHeight );
	vec4 cone = textureLod( twdSkyMap, skyAbove, log2( clamp( rise, 0.75, 24.0 ) / twdSkyParams.x ) );
	float coneRise = twdSkyRise( cone, skyHeight );

	vec4 ring = textureLod( twdSkyMap, skyUv + skyAway * 7.0, twdSkyParams.z );
	float ringRise = twdSkyRise( ring, skyHeight );
	float overhead = cone.g * smoothstep( 0.3, 1.8, coneRise ) * ${glslFloat(SKY_LIGHT.overhead)};
	float around = ring.g * smoothstep( 0.6, 7.0, ringRise ) * ${glslFloat(SKY_LIGHT.side)} * ( 1.0 - overhead );

	float enclosed = cone.g * smoothstep( -0.25, 0.35, coneRise ) * ring.g * smoothstep( -0.25, 0.6, ringRise ) * ${glslFloat(SKY_LIGHT.enclosed)};
	float canopyAbove = cone.g > 0.02 ? cone.b / cone.g : 0.0;
	float canopyAround = ring.g > 0.02 ? ring.b / ring.g : 0.0;
	vec3 skyBounce = overhead * mix( twdSkyCeiling, twdSkyCanopy, canopyAbove ) + around * mix( twdSkyFacade, twdSkyCanopy * 1.6, canopyAround );
	vec3 groundBounce = enclosed * mix( twdSkyCeiling, twdSkyCanopy, canopyAbove );
	float up = clamp( skyNormal.y * 0.5 + 0.5, 0.0, 1.0 );
	vec4 mapped = vec4( PI * mix( groundBounce, skyBounce, up ), 1.0 - mix( enclosed, overhead + around, up ) );
	return mix( twdSkyFallback(), mapped, skyInside );
}
`

const SKY_LIGHT_APPLY =            `
#if defined( RE_IndirectDiffuse ) || defined( RE_IndirectSpecular )
	{
		vec4 twdSky = twdSkyLight( geometryPosition, geometryNormal );
		#if defined( RE_IndirectDiffuse )
			irradiance *= twdSky.a;
			iblIrradiance = iblIrradiance * twdSky.a + twdSky.rgb;
		#endif
		#if defined( RE_IndirectSpecular )
			radiance = radiance * twdSky.a + twdSky.rgb * RECIPROCAL_PI;
		#endif
	}
#endif
`

function applySkyLight(shader: THREE.WebGLProgramParametersWithUniforms) {
  const source = shader.fragmentShader
  if (!source.includes('#include <lights_fragment_end>') || !source.includes('#include <lights_pars_begin>') || source.includes('twdSkyLight(')) return
  Object.assign(shader.uniforms, skyLightUniforms)
  shader.fragmentShader = source
    .replace('#include <lights_pars_begin>', `#include <lights_pars_begin>\n${SKY_LIGHT_PARS}`)
    .replace('#include <lights_fragment_end>', `${SKY_LIGHT_APPLY}\n#include <lights_fragment_end>`)
}

type Compile = THREE.Material['onBeforeCompile']
const HOOK_KEY = '__twdSkyLightHook'
const APPLY_KEY = '__twdSkyLightApply'

export function installSkyLight() {
  const store = globalThis as unknown as Record<string, unknown>
  store[APPLY_KEY] = applySkyLight
  if (store[HOOK_KEY]) return
  store[HOOK_KEY] = true
  const prototype = THREE.Material.prototype
  const fallback = prototype.onBeforeCompile
  const own = new WeakMap<THREE.Material, Compile>()
  const wrapped = new WeakMap<THREE.Material, { inner: Compile; wrapper: Compile }>()
  Object.defineProperty(prototype, 'onBeforeCompile', {
    configurable: true,
    get(this: THREE.Material) {
      const inner = own.get(this) ?? fallback
      const cached = wrapped.get(this)
      if (cached && cached.inner === inner) return cached.wrapper
      const wrapper: Compile = function (this: THREE.Material, shader, renderer) {
        inner.call(this, shader, renderer)
        ;(store[APPLY_KEY] as typeof applySkyLight)(shader)
      }
      wrapper.toString = () => `${inner.toString()}\n[twd-sky-light]`
      wrapped.set(this, { inner, wrapper })
      return wrapper
    },
    set(this: THREE.Material, value: Compile) {
      own.set(this, value)
    },
  })
}

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

export function skyPanorama(width: number, height: number) {
  const zenith = new THREE.Color(ATMOSPHERE.skyTop), horizon = new THREE.Color(ATMOSPHERE.skyHorizon)
  const haze = new THREE.Color(ATMOSPHERE.fog), glow = new THREE.Color(ATMOSPHERE.sunGlow)
  const cloudLit = new THREE.Color(ATMOSPHERE.cloudLit), cloudShade = new THREE.Color(ATMOSPHERE.cloudShade)
  const sun = SUN_DIRECTION

  const lift = FOG.floorDrop
  const column = FOG.hazeDensity * FOG.hazeHeight * Math.exp(-Math.max(lift / FOG.hazeHeight, -2))
    + FOG.groundDensity * FOG.groundHeight * Math.exp(-Math.max(lift / FOG.groundHeight, -2))
  const pixels = new Float32Array(width * height * 3)
  let sumR = 0, sumG = 0, sumB = 0, total = 0
  for (let row = 0; row < height; row++) {
    const elevation = ((row + 0.5) / height - 0.5) * Math.PI
    const y = Math.sin(elevation), across = Math.cos(elevation)
    for (let column_ = 0; column_ < width; column_++) {
      const azimuth = ((column_ + 0.5) / width - 0.5) * Math.PI * 2
      const mu = across * Math.cos(azimuth) * sun.x + y * sun.y + across * Math.sin(azimuth) * sun.z
      const toward = Math.max(mu, 0), t4 = toward ** 4, t16 = t4 ** 4
      const hazeScale = 1 - 0.12 * Math.max(-mu, 0), hazeGlow = t4 * 0.2 + t16 * 0.45
      const ar = haze.r * hazeScale + glow.r * hazeGlow
      const ag = haze.g * hazeScale + glow.g * hazeGlow
      const ab = haze.b * hazeScale + glow.b * hazeGlow
      const index = (row * width + column_) * 3
      if (y <= 0) {
        pixels[index] = ar; pixels[index + 1] = ag; pixels[index + 2] = ab
        continue
      }
      const k = y ** 0.42, polarised = 1 - 0.1 * (1 - mu * mu) * y
      const aureole = Math.exp((toward - 1) * 6) * 0.1 + Math.exp((toward - 1) * 60) * 0.32
      const cr = (horizon.r + (zenith.r - horizon.r) * k) * polarised + glow.r * aureole
      const cg = (horizon.g + (zenith.g - horizon.g) * k) * polarised + glow.g * aureole
      const cb = (horizon.b + (zenith.b - horizon.b) * k) * polarised + glow.b * aureole
      const veil = 1 - Math.exp(-column / Math.max(y, 1e-4))
      let r = cr + (ar - cr) * veil, g = cg + (ag - cg) * veil, b = cb + (ab - cb) * veil
      const cover = SKY_LIGHT.cloudCover * smoothstep(0.03, 0.3, y), lit = 0.5 + 0.5 * mu
      r += ((cloudShade.r + (cloudLit.r - cloudShade.r) * lit) * (1 - veil) + ar * veil - r) * cover
      g += ((cloudShade.g + (cloudLit.g - cloudShade.g) * lit) * (1 - veil) + ag * veil - g) * cover
      b += ((cloudShade.b + (cloudLit.b - cloudShade.b) * lit) * (1 - veil) + ab * veil - b) * cover
      pixels[index] = r; pixels[index + 1] = g; pixels[index + 2] = b

      const weight = y * across
      sumR += r * weight; sumG += g * weight; sumB += b * weight; total += weight
    }
  }
  const skyR = sumR / total, skyG = sumG / total, skyB = sumB / total

  const hemisphere = new THREE.Color(ATMOSPHERE.hemisphereSky).multiplyScalar(ATMOSPHERE.hemisphereIntensity / Math.PI)
  const scale = (luminance(hemisphere.r, hemisphere.g, hemisphere.b) * SKY_LIGHT.brightness) / luminance(skyR, skyG, skyB)
  const sunColor = new THREE.Color(ATMOSPHERE.sun), albedo = new THREE.Color(SKY_LIGHT.groundAlbedo)
  const direct = (ATMOSPHERE.sunIntensity * Math.max(sun.y, 0) * SKY_LIGHT.groundSunlit) / Math.PI
  const groundR = albedo.r * (sunColor.r * direct + skyR * scale)
  const groundG = albedo.g * (sunColor.g * direct + skyG * scale)
  const groundB = albedo.b * (sunColor.b * direct + skyB * scale)
  for (let row = 0; row < height; row++) {
    const y = Math.sin(((row + 0.5) / height - 0.5) * Math.PI)

    const far = y < 0 ? Math.exp(y * 10) * 0.85 : 1
    for (let column_ = 0; column_ < width; column_++) {
      const index = (row * width + column_) * 3
      if (y >= 0) {
        pixels[index] *= scale; pixels[index + 1] *= scale; pixels[index + 2] *= scale
        continue
      }
      pixels[index] = groundR + (pixels[index] * scale - groundR) * far
      pixels[index + 1] = groundG + (pixels[index + 1] * scale - groundG) * far
      pixels[index + 2] = groundB + (pixels[index + 2] * scale - groundB) * far
    }
  }
  return pixels
}

export function buildSkyEnvironment(renderer: THREE.WebGLRenderer) {
  const width = 256, height = 128
  const radiance = skyPanorama(width, height)
  const data = new Uint16Array(width * height * 4)
  const one = THREE.DataUtils.toHalfFloat(1)
  for (let pixel = 0; pixel < width * height; pixel++) {
    data[pixel * 4] = THREE.DataUtils.toHalfFloat(radiance[pixel * 3])
    data[pixel * 4 + 1] = THREE.DataUtils.toHalfFloat(radiance[pixel * 3 + 1])
    data[pixel * 4 + 2] = THREE.DataUtils.toHalfFloat(radiance[pixel * 3 + 2])
    data[pixel * 4 + 3] = one
  }
  const panorama = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType)
  panorama.mapping = THREE.EquirectangularReflectionMapping
  panorama.colorSpace = THREE.LinearSRGBColorSpace
  panorama.minFilter = panorama.magFilter = THREE.LinearFilter
  panorama.generateMipmaps = false
  panorama.needsUpdate = true
  const generator = new THREE.PMREMGenerator(renderer)
  const target = generator.fromEquirectangular(panorama)
  generator.dispose()
  panorama.dispose()
  target.texture.name = 'sky-light'
  return target
}
