import * as THREE from 'three'
import { FAR_SHADOW_LAYER } from '../shadow'
import { FOLIAGE_SKY_DEFINES } from '../sky/sky-light'
import { IMPOSTOR, IMPOSTOR_ATLAS, TREES, impostorLayout } from './catalog'
import { TREE_LOD, keepFoliageCoverage, lazy, lodCrossFade, pbrMaterial } from './pbr'

export type ImpostorTree = { variant: number; x: number; y: number; z: number; sxz: number; sy: number; tint: number }

const LAYOUTS = TREES.map((_, index) => impostorLayout(index))
const TOP_SPLIT = IMPOSTOR.top / IMPOSTOR_ATLAS.height

const IMPOSTOR_VERTEX =            `
  vec3 forestOrigin = (modelMatrix * vec4(position, 1.0)).xyz;
  float forestDistance = distance(cameraPosition, forestOrigin);
  vVegetationLod = vec2(2.0, forestDistance);
  #ifdef FOREST_FADE
    if (forestDistance < vegetationLod.z - vegetationLod.w - 1.0) {
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      return;
    }
  #endif
  vec3 forestRight = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
  vec3 forestFacing = normalize(cross(forestRight, vec3(0.0, 1.0, 0.0)));
  vec3 forestDelta = cameraPosition - forestOrigin;
  vec3 forestPoint;
  if (forestDelta.y > length(forestDelta.xz) * 0.9) {
    forestPoint = forestOrigin + vec3(forestCorner.x * forestFrame.z, forestFrame.w, -(forestCorner.y - 0.5) * forestFrame.z);
    forestFacing = vec3(0.0, 1.0, 0.0);
    #ifdef USE_MAP
      vMapUv.y = (vMapUv.y - ${TOP_SPLIT}) / (1.0 - ${TOP_SPLIT}) * ${TOP_SPLIT};
    #endif
    #ifdef USE_NORMALMAP
      vNormalMapUv.y = (vNormalMapUv.y - ${TOP_SPLIT}) / (1.0 - ${TOP_SPLIT}) * ${TOP_SPLIT};
    #endif
    #ifdef USE_AOMAP
      vAoMapUv.y = (vAoMapUv.y - ${TOP_SPLIT}) / (1.0 - ${TOP_SPLIT}) * ${TOP_SPLIT};
    #endif
    #ifdef USE_ROUGHNESSMAP
      vRoughnessMapUv.y = (vRoughnessMapUv.y - ${TOP_SPLIT}) / (1.0 - ${TOP_SPLIT}) * ${TOP_SPLIT};
    #endif
    #ifdef USE_METALNESSMAP
      vMetalnessMapUv.y = (vMetalnessMapUv.y - ${TOP_SPLIT}) / (1.0 - ${TOP_SPLIT}) * ${TOP_SPLIT};
    #endif
  } else {
    forestPoint = forestOrigin + forestRight * (forestCorner.x * forestFrame.x) + vec3(0.0, forestCorner.y * forestFrame.y, 0.0);
  }
  #ifndef FLAT_SHADED
    vNormal = normalize(mat3(viewMatrix) * forestFacing);
  #endif
  vec4 mvPosition = viewMatrix * vec4(forestPoint, 1.0);
  gl_Position = projectionMatrix * mvPosition;
`

function impostorMaterial(fade: boolean) {
  const result = pbrMaterial('tree-impostors', { alphaTest: 0.48, side: THREE.DoubleSide, alphaToCoverage: true, normalScale: new THREE.Vector2(0.8, 0.8), vertexColors: true })
  result.name = fade ? 'tree_impostors' : 'tree_impostors_far'
  result.forceSinglePass = true
  result.defines = { ...result.defines, ...FOLIAGE_SKY_DEFINES, ...(fade ? { FOREST_FADE: '' } : {}) }
  result.customProgramCacheKey = () => `forest-impostor-field-v1${fade ? '-fade' : ''}`
  result.onBeforeCompile = (shader) => {
    shader.fragmentShader = keepFoliageCoverage(shader.fragmentShader)
    if (fade) lodCrossFade(shader, TREE_LOD)
    const head = `attribute vec2 forestCorner;\nattribute vec4 forestFrame;\nvarying vec2 vVegetationLod;\n${fade ? 'uniform vec4 vegetationLod;\n' : ''}`
    shader.vertexShader = head + shader.vertexShader.replace('#include <project_vertex>', IMPOSTOR_VERTEX)
  }
  return result
}
const materials = [lazy(() => impostorMaterial(false)), lazy(() => impostorMaterial(true))]
export const treeImpostorMaterial = (fade: boolean) => materials[fade ? 1 : 0]()

const IMPOSTOR_SHADOW_VERTEX =            `
  vec3 forestOrigin = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 forestRight = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
  vec3 forestPoint = forestOrigin + forestRight * (forestCorner.x * forestFrame.x) + vec3(0.0, forestCorner.y * forestFrame.y, 0.0);
  vec4 mvPosition = viewMatrix * vec4(forestPoint, 1.0);
  gl_Position = projectionMatrix * mvPosition;
`

const impostorDepthMaterial = lazy(() => {
  const material = new THREE.MeshDepthMaterial()
  material.name = 'tree_impostors_shadow'
  material.customProgramCacheKey = () => 'forest-impostor-shadow-v1'
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = keepFoliageCoverage(shader.fragmentShader)
    shader.vertexShader = `attribute vec2 forestCorner;\nattribute vec4 forestFrame;\n${shader.vertexShader.replace('#include <project_vertex>', IMPOSTOR_SHADOW_VERTEX)}`
  }
  return material
})

export function impostorCaster(geometry: THREE.BufferGeometry) {
  const mesh = new THREE.Mesh(geometry, treeImpostorMaterial(false))
  mesh.customDepthMaterial = impostorDepthMaterial()
  mesh.castShadow = true
  mesh.receiveShadow = false
  mesh.layers.set(FAR_SHADOW_LAYER)
  mesh.matrixAutoUpdate = false
  mesh.matrixWorldNeedsUpdate = true
  mesh.name = 'tree-impostor-shadow'
  return mesh
}

export function impostorGeometry(trees: ImpostorTree[]) {
  const count = trees.length, vertices = count * 4
  const position = new Float32Array(vertices * 3), corner = new Float32Array(vertices * 2), uv = new Float32Array(vertices * 2)
  const frame = new Float32Array(vertices * 4), color = new Float32Array(vertices * 3)
  const index = vertices > 65_535 ? new Uint32Array(count * 6) : new Uint16Array(count * 6)
  const low = new THREE.Vector3(Infinity, Infinity, Infinity), high = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  let tallest = 0
  for (let i = 0; i < count; i++) {
    const tree = trees[i], { side, top } = LAYOUTS[tree.variant]
    const width = side.width * tree.sxz, height = side.height * tree.sy
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k, right = k & 1, upper = k >> 1
      position[v * 3] = tree.x; position[v * 3 + 1] = tree.y; position[v * 3 + 2] = tree.z
      corner[v * 2] = right - 0.5; corner[v * 2 + 1] = upper
      uv[v * 2] = right ? side.u1 : side.u0; uv[v * 2 + 1] = upper ? side.v1 : side.v0
      frame[v * 4] = width; frame[v * 4 + 1] = height; frame[v * 4 + 2] = top.size * tree.sxz; frame[v * 4 + 3] = top.y * tree.sy
      color[v * 3] = tree.tint; color[v * 3 + 1] = tree.tint; color[v * 3 + 2] = tree.tint * 0.98
    }
    const v = i * 4
    index.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6)
    low.min(new THREE.Vector3(tree.x, tree.y, tree.z))
    high.max(new THREE.Vector3(tree.x, tree.y, tree.z))
    tallest = Math.max(tallest, height, width)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('forestCorner', new THREE.BufferAttribute(corner, 2))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setAttribute('forestFrame', new THREE.BufferAttribute(frame, 4))
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3))
  geometry.setIndex(new THREE.BufferAttribute(index, 1))

  geometry.boundingSphere = new THREE.Sphere(low.clone().add(high).multiplyScalar(0.5), low.distanceTo(high) / 2 + tallest)
  return geometry
}
