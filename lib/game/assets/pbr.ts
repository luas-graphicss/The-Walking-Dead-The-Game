import * as THREE from 'three'
import { anisotropy } from '../device'
import { FOLIAGE_SKY_DEFINES } from '../sky/sky-light'
import { RUNTIME_SETS, TEXTURE_MAPS, type TextureMap, type TextureSet, textureUrl } from './catalog'
import { groundTexturesReady } from './ground-textures'
import { ATLAS_TEXTURES, BARK_INSTANCE_UV, textureRepeat } from './texture-scale'

const images = new THREE.ImageLoader()
const cache = new Map<string, { texture: THREE.Texture; ready: Promise<void> }>()

function loadImage(url: string, attempts = 3): Promise<HTMLImageElement | null> {
  return images.loadAsync(url).catch(() => {
    if (attempts <= 1) return null
    return new Promise<void>((resolve) => setTimeout(resolve, 700)).then(() => loadImage(url, attempts - 1))
  })
}

function entry(set: TextureSet, map: TextureMap) {
  const url = textureUrl(set, map)
  let result = cache.get(url)
  if (!result) {
    const texture = new THREE.Texture()
    texture.wrapS = texture.wrapT = ATLAS_TEXTURES.has(set) ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping
    texture.repeat.setScalar(textureRepeat(set))
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.colorSpace = map === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace
    texture.anisotropy = anisotropy()
    const ready = loadImage(url).then((image) => {
      if (!image) { console.error(`[textures] Não foi possível carregar ${url}`); return }
      texture.image = image
      texture.needsUpdate = true
    })
    result = { texture, ready }
    cache.set(url, result)
  }
  return result
}

let allReady: Promise<void> | null = null

export function texturesReady() {
  return (allReady ??= Promise.all([
    ...RUNTIME_SETS.flatMap((set) => TEXTURE_MAPS.map((map) => entry(set, map).ready)),
    groundTexturesReady(),
  ]).then(() => undefined))
}

export function lazy<T>(create: () => T) {
  let value: T | undefined
  return () => (value ??= create())
}

const FOLIAGE_ALPHA =            `#include <map_fragment>
#ifdef USE_MAP
  {
    vec2 foliageTexel = vMapUv * vec2(textureSize(map, 0));
    vec2 foliageDx = dFdx(foliageTexel), foliageDy = dFdy(foliageTexel);
    float foliageMip = max(0.0, 0.5 * log2(max(dot(foliageDx, foliageDx), dot(foliageDy, foliageDy))));
    diffuseColor.a *= 1.0 + foliageMip * 0.3;
  }
#endif`

export function keepFoliageCoverage(fragmentShader: string) {
  return fragmentShader.replace('#include <map_fragment>', FOLIAGE_ALPHA)
}

type LodUniform = { value: THREE.Vector4 }

export const TREE_LOD: LodUniform = { value: new THREE.Vector4(74, 10, 235, 14) }
export const FERN_LOD: LodUniform = { value: new THREE.Vector4(28, 4, 85, 8) }

const LOD_FRAGMENT =            `#include <clipping_planes_fragment>
  {
    const float lodBayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    ivec2 lodCell = ivec2(mod(gl_FragCoord.xy, 4.0));
    float lodDither = (lodBayer[lodCell.x + lodCell.y * 4] + 0.5) / 16.0;
    float lodNear = smoothstep(vegetationLod.x - vegetationLod.y, vegetationLod.x + vegetationLod.y, vVegetationLod.y);
    float lodFar = smoothstep(vegetationLod.z - vegetationLod.w, vegetationLod.z + vegetationLod.w, vVegetationLod.y);
    if (vVegetationLod.x < 0.5) { if (lodDither < lodNear) discard; }
    else if (vVegetationLod.x < 1.5) { if (lodDither >= lodNear || lodDither < lodFar) discard; }
    else if (lodDither >= lodFar) discard;
  }`

export function lodCrossFade(shader: { uniforms: Record<string, THREE.IUniform>; fragmentShader: string }, lod: LodUniform) {
  shader.uniforms.vegetationLod = lod
  shader.fragmentShader = `uniform vec4 vegetationLod;\nvarying vec2 vVegetationLod;\n${shader.fragmentShader.replace('#include <clipping_planes_fragment>', LOD_FRAGMENT)}`
}

const LOD_VERTEX =            `
  #ifdef USE_BATCHING
    vVegetationLod = vec2(lodLevel, distance(cameraPosition, (modelMatrix * batchingMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz));
  #elif defined( USE_INSTANCING )
    vVegetationLod = vec2(lodLevel, distance(cameraPosition, (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz));
  #else
    vVegetationLod = vec2(lodLevel, distance(cameraPosition, (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz));
  #endif
  #include <project_vertex>`

export function vegetationMaterial<T extends THREE.Material>(material: T, { foliage, lod }: { foliage: boolean; lod: LodUniform }) {
  material.customProgramCacheKey = () => `vegetation-v4-${foliage ? 'foliage' : 'solid'}`
  if (foliage) material.defines = { ...material.defines, ...FOLIAGE_SKY_DEFINES }
  material.onBeforeCompile = (shader) => {
    const density = !foliage && material.name !== 'endgrain' ? BARK_INSTANCE_UV : ''
    shader.vertexShader = `attribute float lodLevel;\nvarying vec2 vVegetationLod;\n${shader.vertexShader.replace('#include <project_vertex>', density + LOD_VERTEX)}`
    if (foliage) {
      shader.fragmentShader = keepFoliageCoverage(shader.fragmentShader).replace(
        '#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'),
      )
    }
    lodCrossFade(shader, lod)
  }
  return material
}

export function pbrMaterial(set: TextureSet, options: THREE.MeshStandardMaterialParameters = {}) {
  const orm = entry(set, 'orm').texture
  return new THREE.MeshStandardMaterial({
    map: entry(set, 'albedo').texture, normalMap: entry(set, 'normal').texture, aoMap: orm, roughnessMap: orm, metalnessMap: orm,
    roughness: 1, metalness: 1, ...options,
  })
}
