import * as THREE from 'three'
import { ATMOSPHERE, SUN_DIRECTION } from '../atmosphere'
import { isMobileDevice } from '../device'
import { ATMOSPHERE_GLSL } from '../sky/atmosphere-glsl'
import { CLOUD_SAMPLE_GLSL, cloudUniforms } from '../sky/clouds'
import { atmosphereUniforms } from '../sky/fog'
import { rippleUniforms } from '../water/ripples'
import { noiseTexture } from './noise-texture'
import { worldUniforms } from './terrain-material'

const RIPPLE_SIZE = 256

function rippleTexture() {
  const waves: { kx: number; kz: number; amp: number; phase: number }[] = []
  let seed = 0x2f6b
  const random = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296)
  for (let i = 0; i < 44; i++) {
    const frequency = 1 + Math.floor(random() ** 1.6 * 15)
    const angle = random() * Math.PI * 2
    const kx = Math.round(Math.cos(angle) * frequency), kz = Math.round(Math.sin(angle) * frequency)
    if (!kx && !kz) continue
    waves.push({ kx, kz, amp: 1 / Math.hypot(kx, kz) ** 1.15, phase: random() * Math.PI * 2 })
  }
  const slopes = new Float32Array(RIPPLE_SIZE * RIPPLE_SIZE * 2)
  let peak = 0
  for (let y = 0; y < RIPPLE_SIZE; y++) for (let x = 0; x < RIPPLE_SIZE; x++) {
    let sx = 0, sz = 0
    for (const wave of waves) {
      const theta = ((wave.kx * x + wave.kz * y) / RIPPLE_SIZE) * Math.PI * 2 + wave.phase
      const derivative = Math.cos(theta) * wave.amp
      sx += derivative * wave.kx; sz += derivative * wave.kz
    }
    const i = (y * RIPPLE_SIZE + x) * 2
    slopes[i] = sx; slopes[i + 1] = sz
    peak = Math.max(peak, Math.abs(sx), Math.abs(sz))
  }
  const data = new Uint8Array(RIPPLE_SIZE * RIPPLE_SIZE * 4)
  for (let i = 0; i < RIPPLE_SIZE * RIPPLE_SIZE; i++) {
    data[i * 4] = Math.round((slopes[i * 2] / peak * 0.5 + 0.5) * 255)
    data[i * 4 + 1] = Math.round((slopes[i * 2 + 1] / peak * 0.5 + 0.5) * 255)
    data[i * 4 + 2] = 128
    data[i * 4 + 3] = 255
  }
  const texture = new THREE.DataTexture(data, RIPPLE_SIZE, RIPPLE_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

const CAUSTIC_SIZE = 256

function causticTexture() {
  const TAU = Math.PI * 2, time = 0.73, intensity = 0.005
  const data = new Uint8Array(CAUSTIC_SIZE * CAUSTIC_SIZE)
  for (let y = 0; y < CAUSTIC_SIZE; y++) for (let x = 0; x < CAUSTIC_SIZE; x++) {
    const px = (x / CAUSTIC_SIZE) * TAU - 250, py = (y / CAUSTIC_SIZE) * TAU - 250
    let ix = px, iy = py, c = 1
    for (let n = 0; n < 5; n++) {
      const t = time * (1 - 3.5 / (n + 1))
      const nx = px + Math.cos(t - ix) + Math.sin(t + iy)
      const ny = py + Math.sin(t - iy) + Math.cos(t + ix)
      ix = nx; iy = ny
      c += 1 / Math.hypot(px / (Math.sin(ix + t) / intensity), py / (Math.cos(iy + t) / intensity))
    }
    c = 1.17 - Math.pow(c / 5, 1.4)
    data[y * CAUSTIC_SIZE + x] = Math.round(Math.min(1, Math.pow(Math.abs(c), 8)) * 255)
  }
  const texture = new THREE.DataTexture(data, CAUSTIC_SIZE, CAUSTIC_SIZE, THREE.RedFormat, THREE.UnsignedByteType)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

const SUN_PATH = 1 / Math.sqrt(1 - (1 - SUN_DIRECTION.y ** 2) / 1.777)

const vertexShader =            `
#include <common>
#include <fog_pars_vertex>
#ifdef WATER_SURFACE
  #include <shadowmap_pars_vertex>
#endif
uniform vec2 terrainOrigin;
varying vec3 vWorld;
varying vec2 vLocal;
varying vec3 vView;
varying vec3 vData;
varying vec2 vCurrent;
void main() {
  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  vWorld = vec3( worldPosition.x + terrainOrigin.x, worldPosition.y, worldPosition.z + terrainOrigin.y );
  vLocal = worldPosition.xz;
  vView = cameraPosition - worldPosition.xyz;
  vData = color;
  vCurrent = normal.xz;
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  #ifdef WATER_SURFACE
    vec3 transformedNormal = normalize( mat3( viewMatrix ) * vec3( 0.0, 1.0, 0.0 ) );
    #include <shadowmap_vertex>
  #endif
  #include <fog_vertex>
}
`

const WATER_PARS =            `
uniform sampler2D ripples;
uniform sampler2D noiseMap;
uniform sampler2D rippleMap;
uniform vec4 rippleArea;
uniform vec2 rippleTexel;
uniform float time;
varying vec3 vWorld;
varying vec2 vLocal;
varying vec3 vView;
varying vec3 vData;
varying vec2 vCurrent;

vec2 slopeAt( vec2 uv ) { return texture2D( ripples, uv ).rg * 2.0 - 1.0; }

float seaWeight() { return 1.0 - smoothstep( 0.1, 0.35, vData.z ); }
float riverWeight() { return smoothstep( 0.65, 0.9, vData.z ); }

vec3 waterExtinction( float sea, float river ) {
  return mix( mix( vec3( 0.50, 0.30, 0.36 ), vec3( 0.62, 0.47, 0.58 ), river ), vec3( 0.40, 0.12, 0.085 ), sea );
}

float waterPath( float depth, float cosView ) {
  float viewCos = sqrt( max( 1.0 - ( 1.0 - cosView * cosView ) / 1.777, 0.04 ) );
  return depth * ( 1.0 / viewCos + SUN_PATH );
}

vec4 wakeAt( vec2 local ) {
  if ( rippleArea.w <= 0.0 ) return vec4( 0.0 );
  vec2 uv = ( local - rippleArea.xy ) / rippleArea.z + 0.5;
  vec2 edge = abs( uv - 0.5 ) * 2.0;
  float weight = ( 1.0 - smoothstep( 0.78, 0.96, max( edge.x, edge.y ) ) ) * rippleArea.w;
  if ( weight <= 0.0 ) return vec4( 0.0 );
  vec4 here = texture2D( rippleMap, uv );
  float east = texture2D( rippleMap, uv + vec2( rippleTexel.x, 0.0 ) ).r;
  float north = texture2D( rippleMap, uv + vec2( 0.0, rippleTexel.y ) ).r;
  float metres = rippleArea.z * rippleTexel.x;
  vec2 slope = vec2( east - here.r, north - here.r ) / metres * weight;

  slope /= 1.0 + length( slope ) * 2.5;
  return vec4( slope, here.b * weight, weight );
}

float waterFoam( vec2 p, vec2 flow, float depth, float edgeFoam, float sea, float river, float wakeFoam ) {
  float lace = texture2D( noiseMap, p / 8.0 + vec2( time * 0.012, - time * 0.008 ) - flow * time * 0.02 ).b * 0.55
    + texture2D( noiseMap, p / 2.56 - flow * time * 0.06 + vec2( 0.0, time * 0.015 ) ).a * 0.45;
  float lap = sin( depth * 7.0 - time * ( 1.2 + sea * 0.6 ) + lace * 5.0 ) * 0.5 + 0.5;
  float shore = ( 1.0 - smoothstep( 0.0, 0.45, depth ) ) * ( 0.35 + 0.5 * ( 1.0 - river ) * smoothstep( 0.55, 0.95, lap ) );
  float surf = sea * ( 1.0 - smoothstep( 0.0, 0.9, depth ) ) * ( 0.75 + 0.25 * sin( time * 1.3 + p.x * 0.11 + p.y * 0.07 ) );
  float foam = clamp( max( max( edgeFoam, surf ), shore ) * 1.5 - ( 1.0 - lace ) * 1.05, 0.0, 1.0 );
  if ( wakeFoam <= 0.002 ) return foam;

  float bubbles = texture2D( noiseMap, p / 1.1 - flow * time * 0.05 ).a * 0.65 + lace * 0.35;
  float threshold = 1.0 - min( wakeFoam, 1.0 ) * 0.9;
  return max( foam, smoothstep( threshold - 0.18, threshold + 0.05, bubbles ) * min( 0.25 + wakeFoam, 0.85 ) );
}

float waterFog() {
  #ifdef USE_FOG
    return atmosphereFog().a;
  #else
    return 0.0;
  #endif
}
`

const absorbFragment =            `
#include <common>
#include <fog_pars_fragment>
${WATER_PARS}
void main() {
  float depth = vData.x;
  float sea = seaWeight(), river = riverWeight();
  vec3 V = normalize( vView );
  float cosView = clamp( abs( V.y ), 0.0, 1.0 );
  float fresnel = 0.02 + 0.98 * pow( 1.0 - cosView, 5.0 );
  vec3 transmit = exp( - waterExtinction( sea, river ) * waterPath( depth, cosView ) );
  float foam = waterFoam( vWorld.xz, vCurrent, depth, vData.y, sea, river, wakeAt( vLocal ).z );
  vec3 keep = mix( vec3( 1.0 ), transmit * ( 1.0 - fresnel ) * ( 1.0 - foam ), smoothstep( 0.0, 0.06, depth ) );
  keep = pow( keep, vec3( 1.0 / 2.2 ) );
  gl_FragColor = vec4( mix( keep, vec3( 1.0 ), waterFog() ), 1.0 );
}
`

const surfaceFragment =            `
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <shadowmap_pars_fragment>
${WATER_PARS}
uniform sampler2D causticMap;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform float sunIntensity;
uniform float fogFloor;
uniform vec3 ambientColor;
uniform vec3 bankColor;
uniform vec3 lakeDeep;
uniform vec3 riverDeep;
uniform vec3 seaDeep;
uniform vec3 foamColor;

${ATMOSPHERE_GLSL}
${CLOUD_SAMPLE_GLSL}

vec3 mirroredSky( vec3 dir, float inland ) {
  float h = max( dir.y, 0.0 );
  vec3 sky = atmoSky( dir, atmoHaze( dir ), cameraPosition.y, fogFloor );
  vec4 clouds = cloudSample( dir );
  sky = sky * ( 1.0 - clouds.a ) + clouds.rgb;
  float treeline = 0.12 + 0.1 * texture2D( noiseMap, vWorld.xz / 96.0 ).g;
  float bank = inland * ( 1.0 - smoothstep( 0.01, treeline, h ) );
  return mix( sky, bankColor * ( 0.7 + 0.6 * texture2D( noiseMap, vWorld.xz / 21.0 ).a ), bank * 0.85 );
}

vec2 waveSlope( vec2 p, vec2 flow, float sea, float flowing ) {
  vec2 slope = vec2( 0.0 );
  if ( flowing < 0.99 ) {
    vec2 wind = slopeAt( p / 12.8 + vec2( time * 0.011, time * 0.006 ) ) * 0.55
      + slopeAt( p / 4.0 + vec2( - time * 0.019, time * 0.023 ) ) * 0.35
      + slopeAt( p / 1.6 + vec2( time * 0.031, - time * 0.017 ) ) * 0.18;
    #ifndef WATER_LITE
      wind += slopeAt( p / 0.62 + vec2( - time * 0.052, time * 0.041 ) ) * 0.09;
    #endif
    slope += wind * ( 1.0 - flowing );
  }
  if ( flowing > 0.01 ) {
    float phaseA = fract( time * 0.22 ), phaseB = fract( time * 0.22 + 0.5 );
    float handover = abs( phaseA - 0.5 ) * 2.0;
    vec2 carried = mix(
      slopeAt( p / 3.2 - flow * phaseA * 1.6 ) + slopeAt( p / 1.28 - flow * phaseA * 1.6 ) * 0.4,
      slopeAt( p / 3.2 - flow * phaseB * 1.6 + 0.37 ) + slopeAt( p / 1.28 - flow * phaseB * 1.6 + 0.61 ) * 0.4,
      handover
    );
    slope += carried * 0.85 * flowing;
  }
  slope += slopeAt( p / 51.2 + vec2( time * 0.006, time * 0.0035 ) ) * 0.9 * sea;
  return slope * ( mix( 0.32, 0.55, sea ) + flowing * 0.25 );
}

void main() {
  float depth = vData.x;
  float sea = seaWeight(), river = riverWeight(), inland = 1.0 - sea;
  vec2 p = vWorld.xz;
  vec2 flow = vCurrent;
  float flowing = smoothstep( 0.05, 0.4, length( flow ) ) * river;
  vec4 wake = wakeAt( vLocal );
  vec2 slope = waveSlope( p, flow, sea, flowing ) + wake.xy;
  vec3 N = normalize( vec3( - slope.x, 1.0, - slope.y ) );
  vec3 V = normalize( vView );
  float NdV = max( dot( N, V ), 1e-3 );
  float cosView = clamp( abs( V.y ), 0.0, 1.0 );
  float fresnel = 0.02 + 0.98 * pow( 1.0 - NdV, 5.0 );

  #ifdef SUN_RING_SHADOWS
    float sun = getSunRingShadow();
  #else
    float sun = 1.0;
  #endif
  vec3 sunLight = sunColor * sunIntensity;

  vec3 R = reflect( - V, N );
  R.y = abs( R.y );
  vec3 reflection = mirroredSky( R, inland );

  float path = waterPath( depth, cosView );
  vec3 transmit = exp( - waterExtinction( sea, river ) * path );
  float turbidity = mix( mix( 0.32, 0.62, river ), 0.16, sea );
  vec3 deep = mix( mix( lakeDeep, riverDeep, river ), seaDeep, sea );
  vec3 body = deep * ( 1.0 - exp( - turbidity * path ) ) * ( 0.5 + 0.5 * sun ) * ( 0.85 + 0.3 * max( dot( N, sunDirection ), 0.0 ) );

  float through = pow( clamp( dot( V, - sunDirection ) * 0.5 + 0.5, 0.0, 1.0 ), 4.0 ) * smoothstep( 0.0, 0.15, length( slope ) );
  body += deep * sunLight * through * sun * 0.22;

  #ifndef WATER_LITE

    vec3 refracted = refract( - V, vec3( 0.0, 1.0, 0.0 ), 0.752 );
    vec2 bed = p + refracted.xz * ( depth / max( - refracted.y, 0.25 ) ) + sunDirection.xz * depth * 0.6;
    vec2 cuv = bed / 2.6 + slope * 0.08;
    float caustic = min(
      texture2D( causticMap, cuv + vec2( time * 0.023, time * 0.011 ) ).r,
      texture2D( causticMap, cuv * 1.27 + vec2( - time * 0.015, time * 0.026 ) + 0.5 ).r
    );
    float reach = smoothstep( 0.02, 0.25, depth ) * exp( - depth * 0.28 );
    body += sunLight * transmit * caustic * caustic * reach * sun * ( 1.0 - sea * 0.3 );
  #endif

  float footprint = length( fwidth( p ) );
  float roughness = clamp( mix( 0.06, 0.12, max( sea, flowing ) ) + footprint * 0.06, 0.05, 0.38 );
  vec3 H = normalize( sunDirection + V );
  float NdH = max( dot( N, H ), 0.0 ), NdL = max( dot( N, sunDirection ), 0.0 ), LdH = max( dot( sunDirection, H ), 0.05 );
  float a2 = pow( roughness, 4.0 );
  float lobe = NdH * NdH * ( a2 - 1.0 ) + 1.0;
  float glintFresnel = 0.02 + 0.98 * pow( 1.0 - LdH, 5.0 );
  vec3 glint = sunLight * min( a2 / ( PI * lobe * lobe ) * glintFresnel * 0.25 / ( LdH * LdH ) * NdL, 48.0 ) * sun;

  float foam = waterFoam( p, flow, depth, vData.y, sea, river, wake.z );
  vec3 foamLit = foamColor * ( ambientColor + sunLight * ( 0.2 + 0.8 * sun ) * max( sunDirection.y, 0.0 ) );

  vec3 color = reflection * fresnel + body * ( 1.0 - fresnel ) + glint;
  color = mix( color, foamLit, foam ) * smoothstep( 0.0, 0.06, depth );
  gl_FragColor = vec4( color, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb *= 1.0 - waterFog();
}
`

let textures: { ripples: THREE.Texture; caustics: THREE.Texture } | null = null

function shareUniforms(material: THREE.ShaderMaterial) {
  textures ??= { ripples: rippleTexture(), caustics: causticTexture() }
  Object.assign(material.uniforms, {
    ripples: { value: textures.ripples },
    causticMap: { value: textures.caustics },
    noiseMap: { value: noiseTexture() },
    terrainOrigin: worldUniforms.terrainOrigin,
    time: worldUniforms.time,
    rippleMap: rippleUniforms.rippleMap,
    rippleArea: rippleUniforms.rippleArea,
    rippleTexel: rippleUniforms.rippleTexel,
  })
  return material
}

function waterDefines(): Record<string, string> {
  return { SUN_PATH: SUN_PATH.toFixed(4), ...(isMobileDevice() ? { WATER_LITE: '' } : {}) }
}

let absorb: THREE.ShaderMaterial | null = null
let surface: THREE.ShaderMaterial | null = null

export function waterAbsorbMaterial() {
  absorb ??= shareUniforms(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader, fragmentShader: absorbFragment, defines: waterDefines(),
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  }))
  return absorb
}

export function waterSurfaceMaterial() {
  if (surface) return surface
  const color = (hex: string) => new THREE.Color(hex)
  surface = shareUniforms(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, THREE.UniformsLib.lights, {
      sunDirection: { value: SUN_DIRECTION.clone() },
      sunColor: { value: color(ATMOSPHERE.sun) },
      sunIntensity: { value: ATMOSPHERE.sunIntensity },
      ambientColor: { value: color(ATMOSPHERE.hemisphereSky).multiplyScalar(ATMOSPHERE.hemisphereIntensity) },
      bankColor: { value: color(ATMOSPHERE.waterBank) },
      lakeDeep: { value: color(ATMOSPHERE.lakeDeep) },
      riverDeep: { value: color(ATMOSPHERE.riverDeep) },
      seaDeep: { value: color(ATMOSPHERE.seaDeep) },
      foamColor: { value: color(ATMOSPHERE.foam) },
    }]),
    vertexShader, fragmentShader: surfaceFragment,

    defines: { ...waterDefines(), WATER_SURFACE: '', SUN_RING_SOLID: '', SUN_RING_FAST: '' },
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true, lights: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  }))
  Object.assign(surface.uniforms, { ...cloudUniforms, fogFloor: atmosphereUniforms.fogFloor })
  return surface
}
