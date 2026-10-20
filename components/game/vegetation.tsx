'use client'

import { memo, useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GRASS, GRASSES, GRASS_STRIDE, LOD_SUFFIX, TREES, grassFit, treeFit, treeVariantPick } from '@/lib/game/assets/catalog'
import { impostorCaster, impostorGeometry, treeImpostorMaterial, type ImpostorTree } from '@/lib/game/assets/tree-impostors'
import { invalidateChunkShadows } from '@/lib/game/shadow'
import { registerSkyOccluder } from '@/lib/game/sky/sky-occlusion'
import { chunkSurface } from '@/lib/game/world/surface'
import type { ChunkData } from '@/lib/game/world/types'
import { scatterModel, useVegetationKit } from './prop-kits'
import { useScatter } from './scatter-layer'
import { SCATTER, type ScatterItem } from './scatter-pools'

const UP = new THREE.Vector3(0, 1, 0)

export const Vegetation = memo(function Vegetation({ data }: { data: ChunkData }) {
  const kit = useVegetationKit()
  const scatter = useScatter()
  const near = data.lod === 0
  const { impostors, items } = useMemo(() => {
    const trees: ImpostorTree[] = [], items: ScatterItem[] = []
    const rotation = new THREE.Quaternion(), yawRotation = new THREE.Quaternion(), scale = new THREE.Vector3(), normal = new THREE.Vector3()
    for (let i = 0; i < data.trees.length; i += 8) {
      const [x, , z, yaw, height, width, species, shade] = data.trees.subarray(i, i + 8)
      const fit = treeFit(species, height, width, treeVariantPick(yaw, shade))
      const y = chunkSurface(data, x, z).height, tint = 0.85 + shade * 0.16
      trees.push({ variant: fit.variant, x, y, z, sxz: fit.sxz, sy: fit.sy, tint })
      if (!near) continue
      const name = TREES[fit.variant].name, base = new THREE.Vector3(x, y, z)
      items.push({
        kind: SCATTER.tree, model: scatterModel(kit, name, name + LOD_SUFFIX), base,
        matrix: new THREE.Matrix4().compose(base, rotation.setFromAxisAngle(UP, yaw), scale.set(fit.sxz, fit.sy, fit.sxz)),
        color: new THREE.Color(tint, tint, tint * 0.98),
      })
    }

    if (near) for (let i = 0; i < data.grass.length; i += GRASS_STRIDE) {
      const [x, , z, height, yaw, variant] = data.grass.subarray(i, i + GRASS_STRIDE)
      if (Math.round(variant) !== GRASS.fern) continue
      const fit = grassFit(height, variant), name = GRASSES[fit.variant].name
      const ground = chunkSurface(data, x, z), base = new THREE.Vector3(x, ground.height, z)
      rotation.setFromUnitVectors(UP, normal.set(...ground.normal)).multiply(yawRotation.setFromAxisAngle(UP, yaw))
      items.push({
        kind: SCATTER.fern, model: scatterModel(kit, name, name + LOD_SUFFIX), base,
        matrix: new THREE.Matrix4().compose(base, rotation, scale.setScalar(fit.scale)),
        color: new THREE.Color(0.96, 1, 0.94),
      })
    }
    return { impostors: trees.length ? impostorGeometry(trees) : null, items }
  }, [data, kit, near])
  const caster = useMemo(() => (impostors ? impostorCaster(impostors) : null), [impostors])
  useEffect(() => () => impostors?.dispose(), [impostors])
  useLayoutEffect(() => (items.length ? scatter.add(data.cx, data.cz, items) : undefined), [scatter, data, items])

  useLayoutEffect(() => {
    if (!caster) return
    invalidateChunkShadows(data.cx, data.cz)
    const unregister = registerSkyOccluder(caster, 'foliage')
    return () => {
      unregister()
      invalidateChunkShadows(data.cx, data.cz)
    }
  }, [caster, data])
  if (!impostors || !caster) return null
  return (
    <>
      <mesh geometry={impostors} material={treeImpostorMaterial(near)} matrixAutoUpdate={false} matrixWorldNeedsUpdate />
      <primitive object={caster} />
    </>
  )
})
