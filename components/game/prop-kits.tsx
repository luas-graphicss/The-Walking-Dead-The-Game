'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { FOLIAGE_MATERIALS, FOREST_FLOOR_KIT_URL, KIT_MATERIALS, LOD_SUFFIX, ROAD_KIT_URL, VEGETATION_KIT_URL } from '@/lib/game/assets/catalog'
import { FERN_LOD, TREE_LOD, pbrMaterial, vegetationMaterial } from '@/lib/game/assets/pbr'
import type { ScatterModel } from './scatter-pools'

export type ModelPart = { geometry: THREE.BufferGeometry; material: THREE.Material }

export type Kit = Map<string, ModelPart[]>

const materials = new Map<string, THREE.Material>()

function kitMaterial(name: string, vegetation: boolean) {
  const key = vegetation ? `vegetation:${name}` : name
  let material = materials.get(key)
  if (!material) {
    const set = KIT_MATERIALS[name as keyof typeof KIT_MATERIALS]
    if (!set) throw new Error(`Material ${name} sem textura no catálogo.`)
    const foliage = name === 'leaves' || FOLIAGE_MATERIALS.includes(name)
    material = pbrMaterial(set, foliage ? { alphaTest: 0.48, side: THREE.DoubleSide, alphaToCoverage: true, normalScale: new THREE.Vector2(0.55, 0.55) } : { normalScale: new THREE.Vector2(0.8, 0.8) })
    material.name = name
    material.forceSinglePass = true
    if (vegetation) vegetationMaterial(material, { foliage: FOLIAGE_MATERIALS.includes(name), lod: name === 'grass' ? FERN_LOD : TREE_LOD })
    materials.set(key, material)
  }
  return material
}

const parsedKits = new WeakMap<THREE.Object3D, Kit>()
function readKit(scene: THREE.Object3D, vegetation = false): Kit {
  const cached = parsedKits.get(scene)
  if (cached) return cached
  const kit: Kit = new Map()
  for (const node of scene.children) {
    const parts: ModelPart[] = [], level = node.name.endsWith(LOD_SUFFIX) ? 1 : 0
    node.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const geometry = object.geometry as THREE.BufferGeometry
      if (!geometry.userData.textureSpace) {
        const uv = geometry.getAttribute('uv')
        for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
        uv.needsUpdate = true
        geometry.userData.textureSpace = 'flipped'
      }
      if (vegetation && !geometry.getAttribute('lodLevel')) {
        geometry.setAttribute('lodLevel', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(level), 1))
      }
      parts.push({ geometry, material: kitMaterial((object.material as THREE.Material).name, vegetation) })
    })
    kit.set(node.name, parts)
  }
  parsedKits.set(scene, kit)
  return kit
}

export function useVegetationKit() {
  const vegetation = useGLTF(VEGETATION_KIT_URL)
  return useMemo(() => readKit(vegetation.scene, true), [vegetation])
}
useGLTF.preload(VEGETATION_KIT_URL)

export function useKits() {
  const forest = useGLTF(FOREST_FLOOR_KIT_URL)
  const road = useGLTF(ROAD_KIT_URL)
  return useMemo(() => ({ forest: readKit(forest.scene), road: readKit(road.scene) }), [forest, road])
}
useGLTF.preload(FOREST_FLOOR_KIT_URL)
useGLTF.preload(ROAD_KIT_URL)

const scatterModels = new WeakMap<Kit, Map<string, ScatterModel>>()

export function scatterModel(kit: Kit, name: string, lighter?: string): ScatterModel {
  let models = scatterModels.get(kit)
  if (!models) scatterModels.set(kit, (models = new Map()))
  let model = models.get(name)
  if (model) return model
  const full = kit.get(name) ?? [], light = lighter ? kit.get(lighter) ?? [] : null
  const sphere = new THREE.Sphere()
  full.forEach(({ geometry }, index) => {
    if (!geometry.boundingSphere) geometry.computeBoundingSphere()
    if (index === 0) sphere.copy(geometry.boundingSphere!)
    else sphere.union(geometry.boundingSphere!)
  })
  model = { levels: light ? [full, light] : [full], shadow: light?.length ? light : full, sphere }
  models.set(name, model)
  return model
}
