import * as THREE from 'three'
import type { WebGLProgramParametersWithUniforms } from 'three'
import { BLOCK_MATERIALS, type MaterialKey } from '@/lib/game/blockout/types'
import { applyWeather, weatherShader } from '@/components/blockout/weathering'
import { anisotropy, isMobileDevice } from '@/lib/game/device'
import { LOD_FADE_GLSL } from '@/lib/game/lod-fade'

const loader = new THREE.ImageLoader()
const materials = new Map<MaterialKey, THREE.MeshStandardMaterial>()
let ready: Promise<void> | null = null

export const structureTextures: THREE.Texture[] = []

function texture(url: string, color: boolean) {
  const result = new THREE.Texture()
  result.wrapS = result.wrapT = THREE.RepeatWrapping
  result.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  result.minFilter = THREE.LinearMipmapLinearFilter
  result.anisotropy = anisotropy()
  const done = loader.loadAsync(url).then((image) => { result.image = image; result.needsUpdate = true }).catch(() => console.error(`[structures] Não foi possível carregar ${url}`))
  return { result, done }
}

function worldWeather(shader: WebGLProgramParametersWithUniforms, fades: boolean) {
  weatherShader(shader)

  shader.vertexShader = shader.vertexShader
    .replace('vWeatherPos = (modelMatrix * vec4(transformed, 1.0)).xyz;', 'vWeatherPos = transformed;')
    .replace(
      'vWeatherNormal = normalize(mat3(modelMatrix) * objectNormal);',
      '#ifdef USE_BATCHING\nvWeatherNormal = normalize(mat3(modelMatrix) * (mat3(batchingMatrix) * objectNormal));\n#else\nvWeatherNormal = normalize(mat3(modelMatrix) * objectNormal);\n#endif',
    )
  if (!fades) return

  shader.fragmentShader = `${LOD_FADE_GLSL}\n${shader.fragmentShader.replace(
    '#include <clipping_planes_fragment>',
    '#include <clipping_planes_fragment>\n#ifdef USE_BATCHING_COLOR\n  if (lodFadeDiscard(vColor.a)) discard;\n#endif',
  )}`
}
const WEATHER_KEY = 'world-structure-weather-v3'

const solidMaterials = new Map<MaterialKey, THREE.MeshStandardMaterial>()

export function structureMaterialsReady() {
  if (ready) return ready

  applyWeather({ kind: 'structure', condition: 'damaged' })
  const loads: Promise<void>[] = []
  for (const key of Object.keys(BLOCK_MATERIALS) as MaterialKey[]) {
    const spec = BLOCK_MATERIALS[key]

    const suffix = isMobileDevice() ? '.mobile' : ''
    const albedo = texture(`${spec.texture}/albedo${suffix}.webp`, true), normal = texture(`${spec.texture}/normal${suffix}.webp`, false), orm = texture(`${spec.texture}/orm${suffix}.webp`, false)
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, map: albedo.result, normalMap: normal.result, roughnessMap: orm.result, metalnessMap: orm.result, aoMap: orm.result, aoMapIntensity: 0.8,
      normalScale: new THREE.Vector2(spec.normalStrength, spec.normalStrength), roughness: 1, metalness: spec.metalness, envMapIntensity: 0.5,
    })
    material.onBeforeCompile = (shader) => worldWeather(shader, true)
    material.customProgramCacheKey = () => WEATHER_KEY
    materials.set(key, material)
    const solid = material.clone()
    solid.onBeforeCompile = (shader) => worldWeather(shader, false)
    solid.customProgramCacheKey = () => `${WEATHER_KEY}-solid`
    solidMaterials.set(key, solid)
    structureTextures.push(albedo.result, normal.result, orm.result)
    loads.push(albedo.done, normal.done, orm.done)
  }
  ready = Promise.all(loads).then(() => undefined)
  return ready
}

export function structureMaterial(key: MaterialKey, solid = false) {
  const set = solid ? solidMaterials : materials
  return set.get(key) ?? set.get('concrete')!
}

let warmed: Promise<void> | null = null

export function warmStructureShader(gl: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene) {
  if (warmed) return warmed
  const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01)
  const count = geometry.getAttribute('position').count
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3))
  const probe = new THREE.Group()
  const pools: THREE.BatchedMesh[] = []
  for (const material of [...materials.values(), ...solidMaterials.values()]) {
    const mesh = new THREE.BatchedMesh(1, count, geometry.getIndex()!.count, material)

    mesh.setColorAt(mesh.addInstance(mesh.addGeometry(geometry)), new THREE.Color(1, 1, 1))
    mesh.castShadow = mesh.receiveShadow = true
    probe.add(mesh)
    pools.push(mesh)
  }
  warmed = gl.compileAsync(probe, camera, scene).then(() => undefined).catch(() => undefined).finally(() => {
    geometry.dispose()
    for (const mesh of pools) { mesh.geometry.dispose(); mesh.dispose() }
  })
  return warmed
}
