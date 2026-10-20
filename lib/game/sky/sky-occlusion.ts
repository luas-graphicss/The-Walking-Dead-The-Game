import * as THREE from 'three'
import { IMPOSTOR, IMPOSTOR_ATLAS } from '../assets/catalog'
import { isMobileDevice } from '../device'
import { runtime } from '../runtime'
import { addShadowPass, shadowCasters } from '../shadow'
import { skyLightUniforms } from './sky-light'

export type SkyOccluderKind = 'solid' | 'foliage'
type Occluder = THREE.Mesh | THREE.BatchedMesh

const occluders = new Map<Occluder, SkyOccluderKind>()
let occluderVersion = 0

export function registerSkyOccluder(object: Occluder, kind: SkyOccluderKind) {
  occluders.set(object, kind)
  occluderVersion++
  return () => {
    if (occluders.delete(object)) occluderVersion++
  }
}

const HEIGHT_RANGE = 260

const SIDE_SPAN = 10

const CASTER_RING = 2
const TOP_SPLIT = IMPOSTOR.top / IMPOSTOR_ATLAS.height

const SOLID_VERTEX =            `
#include <common>
#include <batching_pars_vertex>
varying float vSkyHeight;
void main() {
	#include <batching_vertex>
	#include <begin_vertex>
	#include <project_vertex>
	vSkyHeight = mvPosition.z;
}
`

const FOLIAGE_VERTEX =            `
attribute vec2 forestCorner;
attribute vec4 forestFrame;
uniform mat3 mapTransform;
varying vec2 vSkyUv;
varying float vSkyHeight;
void main() {
	vec3 forestOrigin = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
	vec3 forestPoint = forestOrigin + vec3( forestCorner.x * forestFrame.z, forestFrame.w, - ( forestCorner.y - 0.5 ) * forestFrame.z );
	vec2 atlas = ( mapTransform * vec3( uv, 1.0 ) ).xy;
	vSkyUv = vec2( atlas.x, ( atlas.y - ${TOP_SPLIT.toFixed(6)} ) / ( 1.0 - ${TOP_SPLIT.toFixed(6)} ) * ${TOP_SPLIT.toFixed(6)} );
	vec4 mvPosition = viewMatrix * vec4( forestPoint, 1.0 );
	vSkyHeight = mvPosition.z;
	gl_Position = projectionMatrix * mvPosition;
}
`

const SOLID_FRAGMENT =            `
uniform float skyTop;
varying float vSkyHeight;
void main() {
	gl_FragColor = vec4( vSkyHeight + skyTop, 1.0, 0.0, 1.0 );
}
`

const FOLIAGE_FRAGMENT =            `
uniform sampler2D map;
uniform float skyTop;
varying vec2 vSkyUv;
varying float vSkyHeight;
void main() {
	if ( textureLod( map, vSkyUv, 0.0 ).a < 0.48 ) discard;
	gl_FragColor = vec4( vSkyHeight + skyTop, 1.0, 1.0, 1.0 );
}
`

function shownIn(object: THREE.Object3D, scene: THREE.Object3D) {
  let node: THREE.Object3D = object
  while (node.parent) {
    if (!node.visible) return false
    node = node.parent
  }
  return node === scene
}

type Plan = { x: number; z: number; base: number }

const WHOLE_GEOMETRY = null as unknown as THREE.GeometryGroup

type ShadowHooks = { onBeforeShadow: (...args: unknown[]) => void; onAfterShadow: (...args: unknown[]) => void }

export class SkyOcclusion {
  readonly target: THREE.WebGLRenderTarget
  private readonly size: number
  private readonly extent: number
  private readonly texel: number
  private readonly recenter: number
  private readonly camera: THREE.OrthographicCamera
  private readonly solid: THREE.ShaderMaterial
  private readonly foliage: THREE.ShaderMaterial

  private readonly bare = new THREE.Scene()
  private readonly frustum = new THREE.Frustum()
  private readonly projection = new THREE.Matrix4()
  private readonly clearColor = new THREE.Color()
  private readonly centre = { x: Number.NaN, z: Number.NaN, y: Number.NaN }
  private readonly removePass: () => void
  private scene: THREE.Object3D | null = null
  private pending: Plan | null = null
  private shifts = -1
  private version = -1
  private age = 0

  constructor() {
    const mobile = isMobileDevice()
    this.size = mobile ? 512 : 1024
    this.extent = mobile ? 88 : 112
    this.texel = (this.extent * 2) / this.size
    this.recenter = this.extent * 0.25
    this.target = new THREE.WebGLRenderTarget(this.size, this.size, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
      stencilBuffer: false,
    })
    this.target.texture.name = 'sky-occlusion'
    this.camera = new THREE.OrthographicCamera(-this.extent, this.extent, this.extent, -this.extent, 1, HEIGHT_RANGE * 2)

    this.camera.up.set(0, 0, -1)
    const skyTop = { value: HEIGHT_RANGE }
    this.solid = new THREE.ShaderMaterial({
      name: 'sky-occlusion-solid',
      uniforms: { skyTop },
      vertexShader: SOLID_VERTEX,
      fragmentShader: SOLID_FRAGMENT,
      side: THREE.DoubleSide,
    })
    this.foliage = new THREE.ShaderMaterial({
      name: 'sky-occlusion-foliage',
      uniforms: { skyTop, map: { value: null }, mapTransform: { value: new THREE.Matrix3() } },
      vertexShader: FOLIAGE_VERTEX,
      fragmentShader: FOLIAGE_FRAGMENT,
      side: THREE.DoubleSide,
    })
    this.removePass = addShadowPass(this.draw)
  }

  schedule(scene: THREE.Object3D, x: number, z: number, ground: number, delta: number) {
    this.scene = scene
    this.age += delta
    const version = occluderVersion + (shadowCasters.versions[CASTER_RING] ?? 0)
    const shifted = this.shifts !== runtime.originShifts
    const strayed = !(Math.abs(x - this.centre.x) <= this.recenter && Math.abs(z - this.centre.z) <= this.recenter && Math.abs(ground - this.centre.y) <= 30)
    const stale = version !== this.version && this.age >= 0.75
    if (!shifted && !strayed && !stale) return

    const step = this.texel * 32
    this.centre.x = Math.round(x / step) * step
    this.centre.z = Math.round(z / step) * step
    this.centre.y = ground
    this.pending = { x: this.centre.x, z: this.centre.z, base: Math.round(ground) }
    this.shifts = runtime.originShifts
    this.version = version
    this.age = 0
  }

  dispose() {
    this.removePass()
    if (skyLightUniforms.twdSkyMap.value === this.target.texture) {
      skyLightUniforms.twdSkyMap.value = null
      skyLightUniforms.twdSkyParams.value.y = 0
    }
    this.target.dispose()
    this.solid.dispose()
    this.foliage.dispose()
  }

  private readonly draw = (renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera) => {
    const plan = this.pending
    if (!plan || scene !== this.scene) return
    this.pending = null
    const view = this.camera
    view.position.set(plan.x, plan.base + HEIGHT_RANGE, plan.z)
    view.lookAt(plan.x, plan.base, plan.z)
    view.updateMatrixWorld()
    this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(view.projectionMatrix, view.matrixWorldInverse))

    const previous = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel()
    renderer.getClearColor(this.clearColor)
    const clearAlpha = renderer.getClearAlpha()
    renderer.setRenderTarget(this.target)
    renderer.setClearColor(0x000000, 0)
    renderer.clear(true, true, false)
    for (const [object, kind] of occluders) {
      if (!shownIn(object, scene)) continue
      if (object.frustumCulled && !this.frustum.intersectsObject(object)) continue
      const material = kind === 'foliage' ? this.foliageFor(object) : this.solid
      if (!material) continue
      object.modelViewMatrix.multiplyMatrices(view.matrixWorldInverse, object.matrixWorld)

      const hooks = object as unknown as ShadowHooks
      hooks.onBeforeShadow(renderer, object, camera, view, object.geometry, material, null)
      renderer.renderBufferDirect(view, this.bare, object.geometry, material, object, WHOLE_GEOMETRY)
      hooks.onAfterShadow(renderer, object, camera, view, object.geometry, material, null)
    }
    renderer.setRenderTarget(previous, face, level)
    renderer.setClearColor(this.clearColor, clearAlpha)
    this.generateMipmaps(renderer)

    skyLightUniforms.twdSkyMap.value = this.target.texture
    skyLightUniforms.twdSkyFrame.value.set(plan.x, plan.z, 1 / (this.extent * 2), plan.base)
    skyLightUniforms.twdSkyParams.value.set(this.texel, 1, Math.log2(SIDE_SPAN / this.texel), 0)
  }

  private foliageFor(object: Occluder) {
    const map = (object.material as THREE.MeshStandardMaterial).map
    if (!map) return null
    const uniforms = this.foliage.uniforms
    if (uniforms.map.value !== map) {
      map.updateMatrix()
      uniforms.map.value = map
      uniforms.mapTransform.value.copy(map.matrix)
    }
    return this.foliage
  }

  private generateMipmaps(renderer: THREE.WebGLRenderer) {
    const texture = (renderer.properties.get(this.target.texture) as { __webglTexture?: WebGLTexture }).__webglTexture
    if (!texture) return
    const gl = renderer.getContext()
    renderer.state.bindTexture(gl.TEXTURE_2D, texture)
    gl.generateMipmap(gl.TEXTURE_2D)
    renderer.state.unbindTexture()
  }
}
