import * as THREE from 'three'
import { ATMOSPHERE } from '../atmosphere'
import { isMobileDevice } from '../device'

export const DROPLET = 0
export const MIST = 1

export const SHEET = 2

const vertexShader =            `
#include <common>
#include <fog_pars_vertex>
attribute vec4 placement;
attribute vec4 motion;
attribute vec2 kind;
uniform float pixelScale;
varying vec2 vUv;
varying float vLife;
varying float vKind;
varying float vSeed;
varying float vFade;
void main() {
  vUv = uv * 2.0 - 1.0;
  vLife = motion.w;
  vKind = kind.x;
  vSeed = kind.y;
  vec4 mvPosition = viewMatrix * vec4( placement.xyz, 1.0 );
  vec3 viewVelocity = mat3( viewMatrix ) * motion.xyz;
  float speed = length( viewVelocity.xy );
  vec2 along = speed > 1e-3 ? viewVelocity.xy / speed : vec2( 0.0, 1.0 );
  vec2 across = vec2( - along.y, along.x );
  float distance = max( - mvPosition.z, 0.05 );
  float size = placement.w;
  float stretch = 1.0;
  vFade = 1.0;
  if ( kind.x < 0.5 ) {

    float shown = max( size, distance * pixelScale * 2.0 );
    vFade = size / shown;
    size = shown;
    stretch = 1.0 + speed * 0.035 / size;
  } else if ( kind.x < 1.5 ) {

    size *= 0.55 + vLife * 1.6;
    vFade = smoothstep( 0.4, 2.5, distance );
  } else {
    float shown = max( size, distance * pixelScale * 3.0 );
    vFade = size / shown;
    size = shown;
    stretch = 1.5 + speed * 0.05 / size;
  }
  stretch = min( stretch, 12.0 );
  mvPosition.xy += ( across * position.x + along * position.y * stretch ) * size;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const fragmentShader =            `
#include <common>
#include <fog_pars_fragment>
uniform vec3 sunColor;
uniform vec3 ambientColor;
uniform vec3 foamColor;
varying vec2 vUv;
varying float vLife;
varying float vKind;
varying float vSeed;
varying float vFade;
void main() {
  float r = length( vUv );
  if ( r > 1.0 ) discard;
  vec3 color;
  float alpha;
  if ( vKind < 0.5 ) {

    alpha = smoothstep( 1.0, 0.55, r ) * ( 1.0 - vLife * vLife ) * 0.9 * vFade;
    color = ambientColor * ( 0.85 + 0.3 * smoothstep( 0.35, 0.9, r ) ) + sunColor * ( 0.25 + pow( 1.0 - r, 4.0 ) * 0.9 );
  } else if ( vKind < 1.5 ) {
    alpha = ( 1.0 - smoothstep( 0.1, 1.0, r ) ) * pow( 1.0 - vLife, 1.4 ) * 0.32 * vFade;
    color = ambientColor * 1.05 + sunColor * 0.32;
  } else {

    float angle = atan( vUv.y, vUv.x );
    float edge = 0.78 + 0.22 * sin( angle * 3.0 + vSeed * 6.283 ) * sin( angle * 5.0 - vSeed * 11.0 );
    if ( r > edge ) discard;
    alpha = smoothstep( edge, edge * 0.5, r ) * ( 1.0 - vLife * vLife ) * 0.85 * vFade;
    color = foamColor * ( ambientColor * 0.75 + sunColor * 0.5 );
  }
  gl_FragColor = vec4( color, alpha );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

export class Splashes {
  readonly mesh: THREE.Mesh
  private readonly capacity: number
  private readonly geometry = new THREE.InstancedBufferGeometry()
  private readonly material: THREE.ShaderMaterial

  private readonly placement: THREE.InstancedBufferAttribute

  private readonly motion: THREE.InstancedBufferAttribute

  private readonly kinds: THREE.InstancedBufferAttribute
  private readonly spans: Float32Array

  private readonly floors: Float32Array
  private readonly rings: Uint8Array
  private count = 0

  constructor() {
    this.capacity = isMobileDevice() ? 520 : 1600
    const quad = new THREE.PlaneGeometry(1, 1)
    this.geometry.index = quad.index
    this.geometry.setAttribute('position', quad.getAttribute('position'))
    this.geometry.setAttribute('uv', quad.getAttribute('uv'))
    this.placement = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4).setUsage(THREE.DynamicDrawUsage)
    this.motion = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4).setUsage(THREE.DynamicDrawUsage)
    this.kinds = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 2), 2).setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('placement', this.placement)
    this.geometry.setAttribute('motion', this.motion)
    this.geometry.setAttribute('kind', this.kinds)
    this.geometry.instanceCount = 0
    this.spans = new Float32Array(this.capacity)
    this.floors = new Float32Array(this.capacity)
    this.rings = new Uint8Array(this.capacity)
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        sunColor: { value: new THREE.Color(ATMOSPHERE.sun).multiplyScalar(ATMOSPHERE.sunIntensity) },
        ambientColor: { value: new THREE.Color(ATMOSPHERE.hemisphereSky).multiplyScalar(ATMOSPHERE.hemisphereIntensity) },
        foamColor: { value: new THREE.Color(ATMOSPHERE.foam) },
        pixelScale: { value: 0.001 },
      }]),
      vertexShader, fragmentShader, transparent: true, depthWrite: false, fog: true,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3
    this.mesh.visible = false
  }

  get room() { return this.capacity - this.count }

  setPixelScale(fov: number, heightPixels: number) {
    this.material.uniforms.pixelScale.value = (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2)) / Math.max(heightPixels, 1)
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, span: number, kind: number, floor: number, ring = false) {
    if (this.count >= this.capacity) return
    const i = this.count++, o = i * 4
    const placement = this.placement.array as Float32Array, motion = this.motion.array as Float32Array, kinds = this.kinds.array as Float32Array
    placement[o] = x; placement[o + 1] = y; placement[o + 2] = z; placement[o + 3] = size
    motion[o] = vx; motion[o + 1] = vy; motion[o + 2] = vz; motion[o + 3] = 0
    kinds[i * 2] = kind; kinds[i * 2 + 1] = Math.random()
    this.spans[i] = span
    this.floors[i] = floor
    this.rings[i] = ring ? 1 : 0
  }

  update(dt: number, onDrop: (x: number, z: number) => void) {
    const placement = this.placement.array as Float32Array, motion = this.motion.array as Float32Array
    const kinds = this.kinds.array as Float32Array
    const dropDrag = Math.exp(-0.5 * dt), sheetDrag = Math.exp(-1.6 * dt), sprayDrag = Math.exp(-2.4 * dt)
    let alive = 0
    for (let i = 0; i < this.count; i++) {
      const o = i * 4
      const life = motion[o + 3] + dt / this.spans[i]
      if (life >= 1) continue
      const kind = kinds[i * 2]
      let vx = motion[o], vy = motion[o + 1], vz = motion[o + 2]
      if (kind === MIST) {
        vx *= sprayDrag; vz *= sprayDrag; vy = vy * sprayDrag + 0.15 * dt
      } else {
        const drag = kind === SHEET ? sheetDrag : dropDrag
        vx *= drag; vz *= drag; vy = vy * drag - 9.81 * dt
      }
      const x = placement[o] + vx * dt, y = placement[o + 1] + vy * dt, z = placement[o + 2] + vz * dt
      if (kind !== MIST && vy < 0 && y < this.floors[i]) {
        if (this.rings[i]) onDrop(x, z)
        continue
      }
      const a = alive * 4
      placement[a] = x; placement[a + 1] = y; placement[a + 2] = z; placement[a + 3] = placement[o + 3]
      motion[a] = vx; motion[a + 1] = vy; motion[a + 2] = vz; motion[a + 3] = life
      kinds[alive * 2] = kind; kinds[alive * 2 + 1] = kinds[i * 2 + 1]
      this.spans[alive] = this.spans[i]
      this.floors[alive] = this.floors[i]
      this.rings[alive] = this.rings[i]
      alive++
    }
    this.count = alive
    this.geometry.instanceCount = alive
    this.mesh.visible = alive > 0
    if (alive === 0) return
    for (const attribute of [this.placement, this.motion, this.kinds]) {
      attribute.clearUpdateRanges()
      attribute.addUpdateRange(0, alive * attribute.itemSize)
      attribute.needsUpdate = true
    }
  }

  clear() {
    this.count = 0
    this.geometry.instanceCount = 0
    this.mesh.visible = false
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
