'use client'

import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOULDERS, DEBRIS, LEAVES, LITTER_LAYERS, LOGS, PEBBLES, STUMPS, TWIGS, pickVariant } from '@/lib/game/assets/catalog'
import { lazy, pbrMaterial } from '@/lib/game/assets/pbr'
import { runtime } from '@/lib/game/runtime'
import { CHUNK_SIZE, FLOOR_KIND, FLOOR_STRIDE } from '@/lib/game/world/settings'
import type { ChunkData } from '@/lib/game/world/types'
import { geometryFrom } from './geometry'
import { scatterModel, useKits } from './prop-kits'
import { useScatter } from './scatter-layer'
import { SCATTER, type ScatterItem } from './scatter-pools'

const litterMaterials = lazy(() => LITTER_LAYERS.map((set) => pbrMaterial(set, { vertexColors: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })))

const DETAIL_DISTANCE = 150

const MODELS: Record<number, readonly { name: string }[]> = {
  [FLOOR_KIND.pebble]: PEBBLES, [FLOOR_KIND.twig]: TWIGS, [FLOOR_KIND.boulder]: BOULDERS, [FLOOR_KIND.log]: LOGS,
  [FLOOR_KIND.stump]: STUMPS, [FLOOR_KIND.leaf]: LEAVES, [FLOOR_KIND.debris]: DEBRIS,
}
const SMALL = new Set<number>([FLOOR_KIND.pebble, FLOOR_KIND.twig, FLOOR_KIND.leaf, FLOOR_KIND.debris])

function shadeOf(kind: number, shade: number): [number, number, number] {
  if (kind === FLOOR_KIND.leaf) { const l = 0.72 + shade * 0.5; return [l, l * (0.9 + shade * 0.1), l * (0.82 + shade * 0.12)] }
  if (kind === FLOOR_KIND.pebble || kind === FLOOR_KIND.boulder) { const l = 0.86 + shade * 0.26; return [l * (0.97 + shade * 0.06), l, l * (1.03 - shade * 0.06)] }
  if (kind === FLOOR_KIND.debris) { const l = 0.9 + shade * 0.2; return [l, l, l] }
  const l = 0.8 + shade * 0.34
  return [l, l * 0.98, l * (0.93 + shade * 0.07)]
}

export const ForestFloor = memo(function ForestFloor({ data }: { data: ChunkData }) {
  const near = useRef<THREE.Group>(null)
  const litter = useMemo(() => (data.lod === 0 && data.litter.indices.length ? geometryFrom(data.litter) : null), [data])
  useEffect(() => () => litter?.dispose(), [litter])
  useFrame(({ camera }) => {
    const group = near.current
    if (!group) return

    const x = camera.position.x + runtime.origin.x - data.cx * CHUNK_SIZE, z = camera.position.z + runtime.origin.z - data.cz * CHUNK_SIZE
    const dx = Math.max(-x, 0, x - CHUNK_SIZE), dz = Math.max(-z, 0, z - CHUNK_SIZE)
    group.visible = dx * dx + dz * dz < DETAIL_DISTANCE * DETAIL_DISTANCE
  })
  return (
    <>
      {litter && (
        <group ref={near}>
          <mesh geometry={litter} material={litterMaterials()} receiveShadow />
        </group>
      )}
      {data.floor.length > 0 && <Suspense fallback={null}><FloorProps data={data} /></Suspense>}
    </>
  )
})

function FloorProps({ data }: { data: ChunkData }) {
  const kits = useKits()
  const scatter = useScatter()
  const items = useMemo(() => {
    const items: ScatterItem[] = [], floor = data.floor
    for (let i = 0; i < floor.length; i += FLOOR_STRIDE) {
      const kind = floor[i + 10], tint = floor[i + 11], small = SMALL.has(kind)
      if (small && data.lod !== 0) continue
      const models = MODELS[kind], variant = pickVariant(tint, models.length)
      const kit = kind === FLOOR_KIND.debris ? kits.road : kits.forest, name = models[variant].name
      if (!kit.has(name)) continue
      const base = new THREE.Vector3(floor[i], floor[i + 1], floor[i + 2])
      items.push({
        kind: small ? SCATTER.small : SCATTER.large, model: scatterModel(kit, name), base,
        matrix: new THREE.Matrix4().compose(base, new THREE.Quaternion(floor[i + 3], floor[i + 4], floor[i + 5], floor[i + 6]), new THREE.Vector3(floor[i + 7], floor[i + 8], floor[i + 9])),
        color: new THREE.Color(...shadeOf(kind, tint * models.length - variant)),
      })
    }
    return items
  }, [data, kits])
  useLayoutEffect(() => (items.length ? scatter.add(data.cx, data.cz, items) : undefined), [scatter, data, items])
  return null
}
