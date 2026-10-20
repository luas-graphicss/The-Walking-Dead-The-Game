import * as THREE from 'three'
import { isMobileDevice } from '../device'

const STEP = 1 / 60
const MAX_IMPULSES = 8

const WAVE_SPEED = 0.8

const DAMPING = 0.988
const FOAM_DECAY = 0.978

const SETTLE = 12

export const rippleUniforms = {
  rippleMap: { value: null as THREE.Texture | null },
  rippleArea: { value: new THREE.Vector4(0, 0, 1, 0) },
  rippleTexel: { value: new THREE.Vector2(1, 1) },
}

const vertexShader =            `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`

const fragmentShader =            `
uniform sampler2D state;
uniform vec2 texel;
uniform vec2 offset;
uniform float waveK;
uniform float damping;
uniform float foamDecay;
uniform vec4 impulses[ ${MAX_IMPULSES} ];
uniform float impulseFoam[ ${MAX_IMPULSES} ];
uniform int impulseCount;
varying vec2 vUv;

vec4 previous( vec2 uv ) {
  vec2 q = uv + offset;
  return all( greaterThanEqual( q, vec2( 0.0 ) ) ) && all( lessThanEqual( q, vec2( 1.0 ) ) ) ? texture2D( state, q ) : vec4( 0.0 );
}

void main() {
  vec4 here = previous( vUv );
  float around = previous( vUv - vec2( texel.x, 0.0 ) ).r + previous( vUv + vec2( texel.x, 0.0 ) ).r
    + previous( vUv - vec2( 0.0, texel.y ) ).r + previous( vUv + vec2( 0.0, texel.y ) ).r;
  float height = here.r + ( here.r - here.g ) * damping + waveK * ( around - 4.0 * here.r );
  float foam = here.b * foamDecay;
  for ( int i = 0; i < ${MAX_IMPULSES}; i ++ ) {
    if ( i >= impulseCount ) break;
    vec2 d = ( vUv - impulses[ i ].xy ) / impulses[ i ].z;
    float bump = exp( - dot( d, d ) * 3.0 );
    height += impulses[ i ].w * bump;
    foam += impulseFoam[ i ] * bump;
  }

  foam += max( abs( height - here.r ) - 0.006, 0.0 ) * 3.0;

  vec2 edge = abs( vUv - 0.5 ) * 2.0;
  float keep = 1.0 - smoothstep( 0.86, 1.0, max( edge.x, edge.y ) );
  gl_FragColor = vec4( height * keep, here.r * keep, clamp( foam, 0.0, 1.0 ) * keep, 1.0 );
}
`

export class RippleField {
  readonly resolution: number
  readonly size: number
  private readonly supported: boolean
  private readonly targets: THREE.WebGLRenderTarget[]
  private readonly material: THREE.ShaderMaterial
  private readonly geometry = new THREE.BufferGeometry()
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.Camera()

  private readonly queue: number[] = []
  private read = 0
  private placed = false
  private centerX = 0
  private centerZ = 0
  private shiftU = 0
  private shiftV = 0
  private accumulator = 0
  private quiet = SETTLE

  constructor(renderer: THREE.WebGLRenderer) {
    const mobile = isMobileDevice()
    this.resolution = mobile ? 128 : 256
    this.size = mobile ? 24 : 32
    this.supported = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')
    const options: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    }
    this.targets = [0, 1].map(() => new THREE.WebGLRenderTarget(this.resolution, this.resolution, options))
    const texel = this.size / this.resolution
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        state: { value: null },
        texel: { value: new THREE.Vector2(1 / this.resolution, 1 / this.resolution) },
        offset: { value: new THREE.Vector2() },
        waveK: { value: ((WAVE_SPEED * STEP) / texel) ** 2 },
        damping: { value: DAMPING },
        foamDecay: { value: FOAM_DECAY },
        impulses: { value: Array.from({ length: MAX_IMPULSES }, () => new THREE.Vector4()) },
        impulseFoam: { value: new Array<number>(MAX_IMPULSES).fill(0) },
        impulseCount: { value: 0 },
      },
      vertexShader, fragmentShader, depthTest: false, depthWrite: false,
    })
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    const mesh = new THREE.Mesh(this.geometry, this.material)
    mesh.frustumCulled = false
    this.scene.add(mesh)
    rippleUniforms.rippleTexel.value.set(1 / this.resolution, 1 / this.resolution)
    rippleUniforms.rippleArea.value.set(0, 0, this.size, 0)
  }

  push(x: number, z: number, radius: number, height: number, foam: number) {
    if (!this.supported || this.queue.length >= MAX_IMPULSES * 5 * 3) return
    this.queue.push(x, z, radius, height, foam)
    this.quiet = 0
  }

  update(renderer: THREE.WebGLRenderer, delta: number, focusX: number, focusZ: number, originX: number, originZ: number, driftX: number, driftZ: number) {
    const area = rippleUniforms.rippleArea.value
    this.quiet += delta
    if (!this.supported || this.quiet > SETTLE) {
      area.w = 0
      return
    }
    const previous = renderer.getRenderTarget()
    const texel = this.size / this.resolution
    const reach = this.size * 0.2
    if (!this.placed || Math.abs(focusX - this.centerX) > reach || Math.abs(focusZ - this.centerZ) > reach) {
      const x = Math.round(focusX / texel) * texel, z = Math.round(focusZ / texel) * texel
      if (this.placed) {
        this.shiftU += (x - this.centerX) / this.size
        this.shiftV += (z - this.centerZ) / this.size
      } else this.clear(renderer)
      this.centerX = x
      this.centerZ = z
      this.placed = true
    }
    this.accumulator = Math.min(this.accumulator + delta, STEP * 3)
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP
      this.step(renderer, driftX, driftZ)
    }
    renderer.setRenderTarget(previous)
    rippleUniforms.rippleMap.value = this.targets[this.read].texture
    area.set(this.centerX - originX, this.centerZ - originZ, this.size, 1)
  }

  dispose() {
    for (const target of this.targets) target.dispose()
    this.material.dispose()
    this.geometry.dispose()
    rippleUniforms.rippleMap.value = null
    rippleUniforms.rippleArea.value.w = 0
  }

  private step(renderer: THREE.WebGLRenderer, driftX: number, driftZ: number) {
    const uniforms = this.material.uniforms
    uniforms.state.value = this.targets[this.read].texture
    uniforms.offset.value.set(this.shiftU - (driftX * STEP) / this.size, this.shiftV - (driftZ * STEP) / this.size)
    this.shiftU = 0
    this.shiftV = 0
    const count = Math.min(this.queue.length / 5, MAX_IMPULSES)
    const impulses = uniforms.impulses.value as THREE.Vector4[]
    const foam = uniforms.impulseFoam.value as number[]
    const smallest = 1.5 / this.resolution
    for (let i = 0; i < count; i++) {
      const j = i * 5
      impulses[i].set(
        (this.queue[j] - this.centerX) / this.size + 0.5,
        (this.queue[j + 1] - this.centerZ) / this.size + 0.5,
        Math.max(this.queue[j + 2] / this.size, smallest),
        this.queue[j + 3],
      )
      foam[i] = this.queue[j + 4]
    }
    uniforms.impulseCount.value = count
    this.queue.splice(0, count * 5)
    const write = 1 - this.read
    renderer.setRenderTarget(this.targets[write])
    renderer.render(this.scene, this.camera)
    this.read = write
  }

  private clear(renderer: THREE.WebGLRenderer) {
    const color = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha()
    renderer.setClearColor(0x000000, 0)
    for (const target of this.targets) {
      renderer.setRenderTarget(target)
      renderer.clear(true, false, false)
    }
    renderer.setClearColor(color, alpha)
  }
}
