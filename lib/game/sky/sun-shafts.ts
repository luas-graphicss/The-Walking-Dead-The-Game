import * as THREE from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { ATMOSPHERE, SUN_DIRECTION } from '../atmosphere'
import { isMobileDevice } from '../device'
import { shadowRings } from '../shadow'
import { CLOUD_SAMPLE_GLSL, cloudUniforms } from './clouds'

const CONE = THREE.MathUtils.degToRad(42)
const TAN_CONE = Math.tan(CONE)

const MARCH_START = 0.6
const MARCH_END = 420

const SHAFT_STRENGTH = 0.42

type Profile = { size: number; steps: number }
const PROFILES: Record<'phone' | 'desktop', Profile> = {
  phone: { size: 64, steps: 18 },
  desktop: { size: 128, steps: 28 },
}

const SUN_RIGHT = new THREE.Vector3().crossVectors(SUN_DIRECTION, new THREE.Vector3(0, 1, 0)).normalize()
const SUN_UP = new THREE.Vector3().crossVectors(SUN_RIGHT, SUN_DIRECTION).normalize()

const float = (value: number) => {
  const text = value.toPrecision(7)
  return /[.e]/.test(text) ? text : `${text}.0`
}
const vec3 = (v: THREE.Vector3) => `vec3( ${float(v.x)}, ${float(v.y)}, ${float(v.z)} )`

const SUN_SPACE_GLSL =            `
const vec3 SHAFT_SUN = ${vec3(SUN_DIRECTION)};
const vec3 SHAFT_RIGHT = ${vec3(SUN_RIGHT)};
const vec3 SHAFT_UP = ${vec3(SUN_UP)};
const float SHAFT_TAN = ${float(TAN_CONE)};
`

const QUAD_VERTEX =            `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`

function maskShader(profile: Profile) {
  return            `
precision highp float;
precision highp sampler2DShadow;
uniform sampler2DShadow ringNear;
uniform sampler2DShadow ringFar;
uniform mat4 ringNearMatrix;
uniform mat4 ringFarMatrix;
uniform vec2 ringDepthScale;
uniform float ringsReady;
uniform vec3 eye;
varying vec2 vUv;
${SUN_SPACE_GLSL}
${CLOUD_SAMPLE_GLSL}
#define STEPS ${profile.steps}
const float GROWTH = ${float((MARCH_END / MARCH_START) ** (1 / profile.steps))};

float crossing( sampler2DShadow map, mat4 matrix, float scale, vec3 p, float rise, out float inside ) {
	vec3 c = ( matrix * vec4( p, 1.0 ) ).xyz;
	vec3 offset = abs( c - 0.5 );
	inside = step( max( offset.x, max( offset.y, offset.z ) ), 0.495 );
	if ( inside == 0.0 ) return 0.0;
	float behind = 1.0 - textureLod( map, c, 0.0 );
	float ahead = textureLod( map, vec3( c.xy, c.z - rise * scale ), 0.0 );
	return behind * ahead;
}

void main() {
	vec2 q = ( vUv * 2.0 - 1.0 ) * SHAFT_TAN;
	vec3 dir = normalize( SHAFT_SUN + q.x * SHAFT_RIGHT + q.y * SHAFT_UP );
	float rise = dot( dir, SHAFT_SUN );
	float open = 1.0;
	if ( ringsReady > 0.5 ) {
		float t = ${float(MARCH_START)};
		for ( int i = 0; i < STEPS; i++ ) {
			float next = t * GROWTH;
			vec3 p = eye + dir * t;
			float inside;
			float hit = crossing( ringNear, ringNearMatrix, ringDepthScale.x, p, ( next - t ) * rise, inside );
			if ( inside == 0.0 ) hit = crossing( ringFar, ringFarMatrix, ringDepthScale.y, p, ( next - t ) * rise, inside );
			open *= 1.0 - hit;
			t = next;
		}
	}
	float clouds = cloudSampleFrom( dir, eye.y ).a;

	float angle2 = 2.0 * ( 1.0 - rise );
	float source = exp( - angle2 * 2500.0 ) * 0.5 + exp( - angle2 * 160.0 ) * 0.32 + exp( - angle2 * 14.0 ) * 0.18;
	gl_FragColor = vec4( open * ( 1.0 - clouds ) * source, 0.0, 0.0, 1.0 );
}
`
}

function blurShader(profile: Profile) {
  const samples = profile.size / 2
  return            `
precision highp float;
uniform sampler2D mask;
varying vec2 vUv;
#define SAMPLES ${samples}

void main() {
	vec2 stride = ( vec2( 0.5 ) - vUv ) / float( SAMPLES );
	vec2 uv = vUv;
	float weight = 1.0;
	float sum = 0.0;
	for ( int i = 0; i < SAMPLES; i++ ) {
		sum += texture2D( mask, uv ).r * weight;
		weight *= 0.965;
		uv += stride;
	}
	gl_FragColor = vec4( sum * ${float(3.2 / samples)}, 0.0, 0.0, 1.0 );
}
`
}

const OVERLAY_VERTEX =            `
uniform vec3 viewRight;
uniform vec3 viewUp;
uniform vec3 viewForward;
varying vec3 vDir;
void main() {
	vDir = viewForward + position.x * viewRight + position.y * viewUp;
	gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`

const OVERLAY_FRAGMENT =            `
uniform sampler2D shafts;
uniform vec3 shaftColor;
varying vec3 vDir;
${SUN_SPACE_GLSL}
void main() {
	vec3 dir = normalize( vDir );
	float rise = dot( dir, SHAFT_SUN );
	if ( rise < 0.7 ) discard;
	vec2 q = vec2( dot( dir, SHAFT_RIGHT ), dot( dir, SHAFT_UP ) ) / ( rise * SHAFT_TAN );
	float fade = 1.0 - smoothstep( 0.6, 0.98, max( abs( q.x ), abs( q.y ) ) );
	float light = texture2D( shafts, q * 0.5 + 0.5 ).r * fade;
	gl_FragColor = vec4( shaftColor * light, 0.0 );
}
`

function target(size: number) {
  return new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType,
    format: THREE.RedFormat,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  })
}

const scratch = { forward: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() }

export class SunShafts {
  readonly profile = isMobileDevice() ? PROFILES.phone : PROFILES.desktop

  readonly geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  readonly overlay: THREE.ShaderMaterial
  private readonly mask = target(this.profile.size)
  private readonly blurred = target(this.profile.size)
  private readonly maskMaterial: THREE.ShaderMaterial
  private readonly blurMaterial: THREE.ShaderMaterial
  private readonly quad = new FullScreenQuad()
  private readonly rings = shadowRings()

  constructor() {
    const near = this.rings[this.rings.length - 2], far = this.rings[this.rings.length - 1]
    this.maskMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...cloudUniforms,
        ringNear: { value: null },
        ringFar: { value: null },
        ringNearMatrix: { value: new THREE.Matrix4() },
        ringFarMatrix: { value: new THREE.Matrix4() },
        ringDepthScale: { value: new THREE.Vector2(1 / (near.far - near.near), 1 / (far.far - far.near)) },
        ringsReady: { value: 0 },
        eye: { value: new THREE.Vector3() },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: maskShader(this.profile),
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    })
    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: { mask: { value: this.mask.texture } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: blurShader(this.profile),
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    })

    const glow = new THREE.Color(ATMOSPHERE.sunGlow).convertLinearToSRGB()
    this.overlay = new THREE.ShaderMaterial({
      uniforms: {
        shafts: { value: this.blurred.texture },
        shaftColor: { value: new THREE.Vector3(glow.r, glow.g, glow.b).multiplyScalar(SHAFT_STRENGTH) },
        viewRight: { value: new THREE.Vector3() },
        viewUp: { value: new THREE.Vector3() },
        viewForward: { value: new THREE.Vector3() },
      },
      vertexShader: OVERLAY_VERTEX,
      fragmentShader: OVERLAY_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    })
  }

  update(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, lights: readonly (THREE.DirectionalLight | null)[]) {
    const { forward, right, up } = scratch
    camera.matrixWorld.extractBasis(right, up, forward)
    forward.negate()
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const halfDiagonal = Math.atan(halfHeight * Math.hypot(1, camera.aspect))
    if (forward.dot(SUN_DIRECTION) < Math.cos(Math.min(Math.PI, halfDiagonal + CONE))) return false

    const uniforms = this.overlay.uniforms
    ;(uniforms.viewForward.value as THREE.Vector3).copy(forward)
    ;(uniforms.viewRight.value as THREE.Vector3).copy(right).multiplyScalar(halfHeight * camera.aspect)
    ;(uniforms.viewUp.value as THREE.Vector3).copy(up).multiplyScalar(halfHeight)

    const near = lights[this.rings.length - 2], far = lights[this.rings.length - 1]
    const nearMap = near?.shadow.map?.depthTexture, farMap = far?.shadow.map?.depthTexture
    const mask = this.maskMaterial.uniforms
    mask.ringsReady.value = nearMap && farMap ? 1 : 0
    if (near && far && nearMap && farMap) {
      mask.ringNear.value = nearMap
      mask.ringFar.value = farMap
      ;(mask.ringNearMatrix.value as THREE.Matrix4).copy(near.shadow.matrix)
      ;(mask.ringFarMatrix.value as THREE.Matrix4).copy(far.shadow.matrix)
    }
    ;(mask.eye.value as THREE.Vector3).copy(camera.position)

    const previousTarget = renderer.getRenderTarget()
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    this.quad.material = this.maskMaterial
    renderer.setRenderTarget(this.mask)
    this.quad.render(renderer)
    this.quad.material = this.blurMaterial
    renderer.setRenderTarget(this.blurred)
    this.quad.render(renderer)
    renderer.setRenderTarget(previousTarget)
    renderer.autoClear = autoClear
    return true
  }

  dispose() {
    this.geometry.dispose()
    this.overlay.dispose()
    this.mask.dispose()
    this.blurred.dispose()
    this.maskMaterial.dispose()
    this.blurMaterial.dispose()
    this.quad.dispose()
  }
}
