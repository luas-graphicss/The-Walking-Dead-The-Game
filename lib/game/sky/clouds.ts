import * as THREE from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { ATMOSPHERE, CLOUDS, SUN_DIRECTION } from '../atmosphere'
import { noiseTexture } from '../assets/noise-texture'
import { isMobileDevice } from '../device'

const DETAIL_SIZE = 1_024
const SHAPE_SIZE = 8_192
const WEATHER_SIZE = 65_536
const ELEVATION_MIN = THREE.MathUtils.degToRad(-3)
const EARTH_RADIUS = 6_360_000
const MID_HEIGHT = (CLOUDS.base + CLOUDS.top) / 2

const BOIL = 1.4
const NOISE_URL = '/textures/sky/cloud-noise.bin'
const NOISE_SIZE = 64

type Profile = {
  width: number
  height: number
  steps: number
  lightSteps: number

  lightStep: number

  rows: number
}

const PROFILES: Record<'phone' | 'desktop', Profile> = {
  phone: { width: 1024, height: 384, steps: 44, lightSteps: 4, lightStep: 70, rows: 3 },
  desktop: { width: 2048, height: 768, steps: 88, lightSteps: 6, lightStep: 40, rows: 4 },
}

const float = (value: number) => {
  const text = value.toPrecision(7)
  return /[.e]/.test(text) ? text : `${text}.0`
}
const vec3 = (x: number, y: number, z: number) => `vec3( ${float(x)}, ${float(y)}, ${float(z)} )`
const linear = (hex: string, scale = 1) => {
  const color = new THREE.Color(hex)
  return vec3(color.r * scale, color.g * scale, color.b * scale)
}
const fold = (value: number, period: number) => ((value % period) + period) % period

const PANORAMA_GLSL =            `
const float CLOUD_EARTH = ${float(EARTH_RADIUS)};
const float CLOUD_ELEVATION_MIN = ${float(ELEVATION_MIN)};

float cloudShell( float y, float dy, float h ) {
	float r = CLOUD_EARTH + y;
	float b = r * dy;
	float c = ( y - h ) * ( 2.0 * CLOUD_EARTH + y + h );
	float s = sqrt( max( b * b - c, 0.0 ) );
	return b > 0.0 ? - c / ( b + s ) : s - b;
}
`

export const CLOUD_SAMPLE_GLSL =            `
#ifndef TWD_CLOUDS
#define TWD_CLOUDS
uniform sampler2D cloudMapA;
uniform sampler2D cloudMapB;
uniform vec3 cloudShiftA;
uniform vec3 cloudShiftB;
uniform float cloudBlend;
uniform float cloudOpacity;
const float CLOUD_MID = ${float(MID_HEIGHT)};
${PANORAMA_GLSL}
vec2 cloudUv( vec3 dir ) {
	float elevation = asin( clamp( dir.y, -1.0, 1.0 ) );
	float v = sqrt( clamp( ( elevation - CLOUD_ELEVATION_MIN ) / ( 1.5707963 - CLOUD_ELEVATION_MIN ), 0.0, 1.0 ) );
	return vec2( atan( dir.z, dir.x ) * 0.15915494, v );
}

vec3 cloudReproject( vec3 dir, float y, vec3 shift ) {
	return normalize( dir * cloudShell( y, dir.y, CLOUD_MID ) + shift );
}

vec4 cloudSampleFrom( vec3 dir, float y ) {
	vec4 a = texture2D( cloudMapA, cloudUv( cloudReproject( dir, y, cloudShiftA ) ) );
	vec4 b = texture2D( cloudMapB, cloudUv( cloudReproject( dir, y, cloudShiftB ) ) );
	return mix( a, b, cloudBlend ) * cloudOpacity;
}

vec4 cloudSample( vec3 dir ) {
	return cloudSampleFrom( dir, cameraPosition.y );
}

float cloudDistance( vec3 dir ) {
	return cloudShell( cameraPosition.y, dir.y, CLOUD_MID );
}
#endif
`

function marchShader(profile: Profile) {
  const sunLight = new THREE.Color(ATMOSPHERE.sun).lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(0.62)
  return            `
precision highp float;
precision highp sampler3D;
uniform sampler3D cloudNoise;
uniform sampler2D weatherMap;
uniform vec3 eye;
uniform vec2 shapeOffset;
uniform vec2 weatherOffset;
uniform vec3 detailOffset;
varying vec2 vUv;

#define STEPS ${profile.steps}
#define LIGHT_STEPS ${profile.lightSteps}
const float LIGHT_STEP = ${float(profile.lightStep)};
const float PIXEL_ANGLE = ${float((Math.PI * 2) / profile.width)};
const float BASE = ${float(CLOUDS.base)};
const float TOP = ${float(CLOUDS.top)};
const float THICKNESS = TOP - BASE;
const float SHAPE_SIZE = ${float(SHAPE_SIZE)};
const float DETAIL_SIZE = ${float(DETAIL_SIZE)};
const float WEATHER_SIZE = ${float(WEATHER_SIZE)};
const float COVERAGE = ${float(CLOUDS.coverage)};
const float EXTINCTION = 0.05;
const float MAX_DISTANCE = 42000.0;
const vec3 SUN_DIR = ${vec3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z)};
const vec3 SUN_LIGHT = ${vec3(sunLight.r, sunLight.g, sunLight.b)};
const vec3 AMBIENT_TOP = ${linear(ATMOSPHERE.skyTop, 0.55)} + vec3( 0.36, 0.37, 0.38 );
const vec3 AMBIENT_BOTTOM = ${linear(ATMOSPHERE.cloudShade, 0.62)} + ${linear(ATMOSPHERE.hemisphereGround, 0.25)};
${PANORAMA_GLSL}

float remap( float value, float low, float high, float toLow, float toHigh ) {
	return toLow + ( value - low ) * ( toHigh - toLow ) / ( high - low );
}

vec3 panoramaDir( vec2 uv ) {
	float azimuth = uv.x * 6.28318531;
	float elevation = CLOUD_ELEVATION_MIN + uv.y * uv.y * ( 1.57079633 - CLOUD_ELEVATION_MIN );
	float c = cos( elevation );
	return vec3( c * cos( azimuth ), sin( elevation ), c * sin( azimuth ) );
}

float coverageAt( vec2 p, float lod ) {
	vec4 w = textureLod( weatherMap, ( p + weatherOffset ) / WEATHER_SIZE, lod );
	float field = w.r * 0.5 + w.g * 0.32 + w.b * 0.18;
	return smoothstep( 0.62 - COVERAGE * 0.28, 0.86 - COVERAGE * 0.2, field );
}

float cloudDensity( vec2 p, float h, float cover, float shapeLod, float detailLod, bool detailed ) {

	float top = mix( 0.4, 1.0, cover );
	float profile = clamp( h / 0.07, 0.0, 1.0 ) * clamp( remap( h, top * 0.5, top, 1.0, 0.0 ), 0.0, 1.0 );
	vec4 n = textureLod( cloudNoise, vec3( p + shapeOffset, h * THICKNESS * 1.8 ).xzy / SHAPE_SIZE, shapeLod );
	float worley = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
	float shape = remap( n.r, worley - 1.0, 1.0, 0.0, 1.0 );
	shape = clamp( remap( shape * profile, 1.0 - cover, 1.0, 0.0, 1.0 ), 0.0, 1.0 );
	if ( shape <= 0.0 || ! detailed ) return shape;
	vec4 m = textureLod( cloudNoise, ( vec3( p.x, h * THICKNESS, p.y ) + detailOffset ) / DETAIL_SIZE, detailLod );
	float wisps = m.g * 0.625 + m.b * 0.25 + m.a * 0.125;

	float erode = mix( wisps, 1.0 - wisps, clamp( h * 5.0, 0.0, 1.0 ) );
	return clamp( remap( shape, erode * 0.4, 1.0, 0.0, 1.0 ), 0.0, 1.0 );
}

float henyeyGreenstein( float mu, float g ) {
	float g2 = g * g;
	return ( 1.0 - g2 ) / pow( 1.0 + g2 - 2.0 * g * mu, 1.5 );
}

void main() {
	vec3 dir = panoramaDir( vUv );
	float y = eye.y;

	if ( dir.y < - sqrt( 2.0 * max( y, 1.0 ) / CLOUD_EARTH ) ) { gl_FragColor = vec4( 0.0 ); return; }
	float start = max( cloudShell( y, dir.y, BASE ), 0.0 );
	float end = min( cloudShell( y, dir.y, TOP ), MAX_DISTANCE );
	if ( end <= start ) { gl_FragColor = vec4( 0.0 ); return; }
	float span = end - start;
	float ds = span / float( STEPS );

	float jitter = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
	float t = start + ds * jitter;
	float mu = dot( dir, SUN_DIR );

	float phase0 = mix( henyeyGreenstein( mu, 0.62 ), henyeyGreenstein( mu, -0.22 ), 0.25 );
	float phase1 = mix( henyeyGreenstein( mu, 0.31 ), henyeyGreenstein( mu, -0.11 ), 0.25 );
	float phase2 = mix( henyeyGreenstein( mu, 0.15 ), henyeyGreenstein( mu, -0.05 ), 0.25 );
	float backlit = smoothstep( -0.2, 0.7, mu );
	float r0 = CLOUD_EARTH + y;
	vec3 light = vec3( 0.0 );
	float transmittance = 1.0;
	for ( int i = 0; i < STEPS; i++ ) {
		vec2 p = eye.xz + dir.xz * t;

		float q = t * ( 2.0 * r0 * dir.y + t );
		float h = ( y + q / ( r0 + sqrt( r0 * r0 + q ) ) - BASE ) / THICKNESS;
		float footprint = t * PIXEL_ANGLE;
		float detailLod = log2( max( footprint / ( DETAIL_SIZE / 64.0 ), 1.0 ) );
		float shapeLod = max( detailLod - 3.0, 0.0 );
		float cover = coverageAt( p, log2( max( footprint / ( WEATHER_SIZE / 256.0 ), 1.0 ) ) );
		if ( cover > 0.0 && h > 0.0 && h < 1.0 ) {
			float density = cloudDensity( p, h, cover, shapeLod, detailLod, true );
			if ( density > 0.002 ) {

				float depth = 0.0;
				float stride = LIGHT_STEP;
				vec2 lp = p;
				float lh = h;
				for ( int j = 0; j < LIGHT_STEPS; j++ ) {
					lp += SUN_DIR.xz * stride;
					lh += SUN_DIR.y * stride / THICKNESS;
					if ( lh >= 1.0 ) break;
					depth += cloudDensity( lp, lh, coverageAt( lp, 2.0 ), shapeLod + float( j ) * 0.5, 0.0, false ) * stride;
					stride *= 1.8;
				}
				float od = depth * EXTINCTION;
				vec3 sun = SUN_LIGHT * ( exp( - od ) * phase0 + 0.55 * exp( - od * 0.4 ) * phase1 + 0.3 * exp( - od * 0.16 ) * phase2 );

				float powder = 1.0 - exp( - density * 3.0 );
				sun *= mix( 0.35 + 0.65 * powder, 1.0, backlit );
				vec3 ambient = mix( AMBIENT_BOTTOM, AMBIENT_TOP, clamp( h * 1.25, 0.0, 1.0 ) );
				float sigma = density * EXTINCTION;
				float stepTransmittance = exp( - sigma * ds );
				light += transmittance * ( sun + ambient ) * ( 1.0 - stepTransmittance );
				transmittance *= stepTransmittance;
				if ( transmittance < 0.01 ) break;
			}
		}
		t += ds;
	}
	gl_FragColor = vec4( light, 1.0 - transmittance );
}
`
}

const VERTEX =            `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`

type Snapshot = { x: number; y: number; z: number; time: number }

export const cloudUniforms = {
  cloudMapA: { value: null as THREE.Texture | null },
  cloudMapB: { value: null as THREE.Texture | null },
  cloudShiftA: { value: new THREE.Vector3() },
  cloudShiftB: { value: new THREE.Vector3() },
  cloudBlend: { value: 0 },
  cloudOpacity: { value: 0 },
}

let emptyMap: THREE.DataTexture | null = null
function empty() {
  if (emptyMap) return emptyMap
  emptyMap = new THREE.DataTexture(new Uint8Array(4), 1, 1)
  emptyMap.needsUpdate = true
  return emptyMap
}

let noiseLoad: Promise<THREE.Data3DTexture> | null = null
function loadNoise() {
  noiseLoad ??= fetch(NOISE_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`${NOISE_URL}: ${response.status}`)
      return response.arrayBuffer()
    })
    .then((buffer) => {
      const texture = new THREE.Data3DTexture(new Uint8Array(buffer), NOISE_SIZE, NOISE_SIZE, NOISE_SIZE)
      texture.format = THREE.RGBAFormat
      texture.type = THREE.UnsignedByteType
      texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = true
      texture.unpackAlignment = 1
      texture.needsUpdate = true
      return texture
    })
  return noiseLoad
}

export class CloudSky {
  readonly profile = isMobileDevice() ? PROFILES.phone : PROFILES.desktop
  private readonly targets: THREE.WebGLRenderTarget[]
  private readonly snapshots: Snapshot[] = [0, 1, 2].map(() => ({ x: 0, y: 0, z: 0, time: 0 }))
  private readonly material: THREE.ShaderMaterial
  private readonly quad: FullScreenQuad
  private noise: THREE.Data3DTexture | null = null
  private disposed = false
  private prev = -1
  private curr = -1
  private next = 0
  private row = 0
  private readonly drawing: Snapshot = { x: 0, y: 0, z: 0, time: 0 }
  private shownAt = -1

  constructor() {
    const { width, height } = this.profile
    this.targets = [0, 1, 2].map(() => {
      const target = new THREE.WebGLRenderTarget(width, height, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        colorSpace: THREE.SRGBColorSpace,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      })
      target.scissorTest = true
      return target
    })
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        cloudNoise: { value: null },
        weatherMap: { value: noiseTexture() },
        eye: { value: new THREE.Vector3() },
        shapeOffset: { value: new THREE.Vector2() },
        weatherOffset: { value: new THREE.Vector2() },
        detailOffset: { value: new THREE.Vector3() },
      },
      vertexShader: VERTEX,
      fragmentShader: marchShader(this.profile),
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    })
    this.quad = new FullScreenQuad(this.material)
    cloudUniforms.cloudMapA.value = empty()
    cloudUniforms.cloudMapB.value = empty()
    cloudUniforms.cloudOpacity.value = 0
    loadNoise().then((texture) => {
      if (this.disposed) return
      this.noise = texture
      this.material.uniforms.cloudNoise.value = texture
    }).catch((error) => console.error('[clouds]', error))
  }

  update(renderer: THREE.WebGLRenderer, eye: { x: number; y: number; z: number }, time: number) {
    if (this.noise) this.draw(renderer, eye, time)
    if (this.curr < 0) return
    const shift = (snapshot: Snapshot, target: THREE.Vector3) => {
      const elapsed = time - snapshot.time
      target.set(
        eye.x - snapshot.x - CLOUDS.wind[0] * elapsed,
        eye.y - snapshot.y,
        eye.z - snapshot.z - CLOUDS.wind[1] * elapsed,
      )
    }
    cloudUniforms.cloudMapA.value = this.targets[this.prev].texture
    cloudUniforms.cloudMapB.value = this.targets[this.curr].texture
    shift(this.snapshots[this.prev], cloudUniforms.cloudShiftA.value)
    shift(this.snapshots[this.curr], cloudUniforms.cloudShiftB.value)
    cloudUniforms.cloudBlend.value = this.row / this.profile.height
    if (this.shownAt < 0) this.shownAt = time
    cloudUniforms.cloudOpacity.value = THREE.MathUtils.smoothstep(time - this.shownAt, 0, 2.5)
  }

  private draw(renderer: THREE.WebGLRenderer, eye: { x: number; y: number; z: number }, time: number) {
    const { width, height, rows } = this.profile
    const uniforms = this.material.uniforms
    if (this.row === 0) {
      Object.assign(this.drawing, { x: eye.x, y: eye.y, z: eye.z, time })
      ;(uniforms.eye.value as THREE.Vector3).set(fold(eye.x, WEATHER_SIZE), eye.y, fold(eye.z, WEATHER_SIZE))
      const [wx, wz] = CLOUDS.wind
      ;(uniforms.shapeOffset.value as THREE.Vector2).set(fold(-wx * time, WEATHER_SIZE), fold(-wz * time, WEATHER_SIZE))
      ;(uniforms.weatherOffset.value as THREE.Vector2).set(fold(-wx * 0.6 * time, WEATHER_SIZE), fold(-wz * 0.6 * time, WEATHER_SIZE))
      ;(uniforms.detailOffset.value as THREE.Vector3).set(
        fold(-wx * 1.25 * time, DETAIL_SIZE),
        fold(-BOIL * time, DETAIL_SIZE),
        fold(-wz * 1.25 * time, DETAIL_SIZE),
      )
    }
    const count = Math.min(this.curr < 0 ? Math.ceil(height / 8) : rows, height - this.row)
    const target = this.targets[this.next]
    target.scissor.set(0, this.row, width, count)
    const previousTarget = renderer.getRenderTarget()
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setRenderTarget(target)
    this.quad.render(renderer)
    renderer.setRenderTarget(previousTarget)
    renderer.autoClear = autoClear
    this.row += count
    if (this.row < height) return

    Object.assign(this.snapshots[this.next], this.drawing)
    const prev = this.curr < 0 ? this.next : this.curr
    const curr = this.next
    this.prev = prev
    this.curr = curr
    this.next = [0, 1, 2].find((index) => index !== prev && index !== curr)!
    this.row = 0
  }

  dispose() {
    this.disposed = true
    for (const target of this.targets) target.dispose()
    this.material.dispose()
    this.quad.dispose()
    cloudUniforms.cloudMapA.value = empty()
    cloudUniforms.cloudMapB.value = empty()
    cloudUniforms.cloudOpacity.value = 0
  }
}
