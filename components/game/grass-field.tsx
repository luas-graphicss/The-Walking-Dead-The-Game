'use client'

import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GRASS, GRASS_STRIDE } from '@/lib/game/assets/catalog'
import { GRASS_LEVELS, GRASS_UNIFORMS, PATCH_RADIUS, grassDepthMaterial, grassMaterial, grassTiers } from '@/lib/game/assets/grass-blades'
import { runtime } from '@/lib/game/runtime'
import { shadowRings, trackShadowMover } from '@/lib/game/shadow'
import { CHUNK_SIZE, type Quality } from '@/lib/game/world/settings'
import { chunkSurface } from '@/lib/game/world/surface'
import type { ChunkData } from '@/lib/game/world/types'

const CELL = 8, SIDE = CHUNK_SIZE / CELL
const UP = new THREE.Vector3(0, 1, 0)

const CASTING_TIERS = 2

const STYLES: Partial<Record<number, [number, number, number]>> = {
  [GRASS.green]: [0.86, 0.08, 0], [GRASS.tall]: [0.97, 0.2, 0], [GRASS.mixed]: [0.83, 0.42, 0], [GRASS.dry]: [0.76, 0.8, 0], [GRASS.reeds]: [1, 0.14, 1],
}

type Patches = { count: number; matrices: Float32Array; patches: Float32Array; cells: Uint32Array[]; occupied: Uint16Array }

function readPatches(data: ChunkData): Patches {
  const capacity = Math.floor(data.grass.length / GRASS_STRIDE)
  const matrices = new Float32Array(capacity * 16), patches = new Float32Array(capacity * 4)
  const cells: number[][] = Array.from({ length: SIDE * SIDE }, () => [])
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), yawRotation = new THREE.Quaternion()
  const position = new THREE.Vector3(), normal = new THREE.Vector3(), unit = new THREE.Vector3(1, 1, 1)
  let count = 0
  for (let i = 0; i < data.grass.length; i += GRASS_STRIDE) {
    const x = data.grass[i], z = data.grass[i + 2], size = data.grass[i + 3], yaw = data.grass[i + 4]
    const style = STYLES[Math.round(data.grass[i + 5])]
    if (!style) continue

    const ground = chunkSurface(data, x, z)
    rotation.setFromUnitVectors(UP, normal.set(...ground.normal)).multiply(yawRotation.setFromAxisAngle(UP, yaw))
    matrix.compose(position.set(x, ground.height, z), rotation, unit)
    cells[Math.min(SIDE - 1, Math.max(0, Math.floor(z / CELL))) * SIDE + Math.min(SIDE - 1, Math.max(0, Math.floor(x / CELL)))].push(count)
    matrix.toArray(matrices, count * 16)
    const p = count * 4
    patches[p] = size * style[0]; patches[p + 1] = style[1]; patches[p + 2] = style[2]; patches[p + 3] = (yaw * 7.77) % 1
    count++
  }
  const occupied: number[] = []
  for (let cell = 0; cell < cells.length; cell++) if (cells[cell].length) occupied.push(cell)
  return { count, matrices: matrices.subarray(0, count * 16), patches: patches.subarray(0, count * 4), cells: cells.map((cell) => Uint32Array.from(cell)), occupied: Uint16Array.from(occupied) }
}

function createField(source: Patches, quality: Quality) {
  const level = GRASS_LEVELS[quality]
  const meshes = grassTiers(quality).map((base, tier) => {
    const geometry = new THREE.BufferGeometry()
    for (const [name, attribute] of Object.entries(base.attributes)) geometry.setAttribute(name, attribute)
    geometry.setIndex(base.index)
    geometry.boundingBox = base.boundingBox!.clone()
    geometry.boundingSphere = base.boundingSphere!.clone()
    geometry.setAttribute('aPatch', new THREE.InstancedBufferAttribute(new Float32Array(source.count * 4), 4).setUsage(THREE.DynamicDrawUsage))
    const mesh = new THREE.InstancedMesh(geometry, grassMaterial(), source.count)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.name = `grass-tier-${tier}`
    mesh.count = 0
    mesh.visible = false
    mesh.receiveShadow = true
    if (tier < CASTING_TIERS) {
      mesh.castShadow = true
      mesh.customDepthMaterial = grassDepthMaterial(quality, shadowRings()[0].extent)
    }
    mesh.matrixAutoUpdate = false
    mesh.matrixWorldNeedsUpdate = true
    return mesh
  })
  const untrack = meshes.filter((mesh) => mesh.castShadow).map((mesh) => trackShadowMover(mesh))
  const cellTiers = new Int8Array(SIDE * SIDE).fill(-1)
  const lastCamera = new THREE.Vector3(Infinity, Infinity, Infinity)
  return {
    meshes,
    update(camera: THREE.Vector3) {

      if (camera.distanceToSquared(lastCamera) < 1) return
      lastCamera.copy(camera)
      let changed = false
      const { occupied } = source
      for (let k = 0; k < occupied.length; k++) {
        const cell = occupied[k], cx = cell % SIDE, cz = (cell - cx) / SIDE
        const dx = Math.max(cx * CELL - PATCH_RADIUS - camera.x, 0, camera.x - (cx + 1) * CELL - PATCH_RADIUS)
        const dz = Math.max(cz * CELL - PATCH_RADIUS - camera.z, 0, camera.z - (cz + 1) * CELL - PATCH_RADIUS)
        const distance = Math.sqrt(dx * dx + dz * dz)
        let tier = 0
        while (tier < level.bounds.length && distance >= level.bounds[tier]) tier++
        if (tier !== cellTiers[cell]) { cellTiers[cell] = tier; changed = true }
      }
      if (!changed) return
      const counts = meshes.map(() => 0)
      for (let cell = 0; cell < cellTiers.length; cell++) {
        const tier = cellTiers[cell]
        if (tier < 0 || tier >= meshes.length) continue
        const mesh = meshes[tier], matrices = mesh.instanceMatrix.array as Float32Array
        const patches = (mesh.geometry.getAttribute('aPatch') as THREE.InstancedBufferAttribute).array as Float32Array
        for (const index of source.cells[cell]) {
          const slot = counts[tier]++
          matrices.set(source.matrices.subarray(index * 16, index * 16 + 16), slot * 16)
          patches.set(source.patches.subarray(index * 4, index * 4 + 4), slot * 4)
        }
      }
      meshes.forEach((mesh, tier) => {
        const count = counts[tier]
        mesh.count = count
        mesh.visible = count > 0
        for (const attribute of [mesh.instanceMatrix, mesh.geometry.getAttribute('aPatch') as THREE.InstancedBufferAttribute]) {
          attribute.clearUpdateRanges()
          attribute.addUpdateRange(0, Math.max(1, count) * attribute.itemSize)
          attribute.needsUpdate = true
        }
        if (count) mesh.computeBoundingSphere()
      })
    },
    dispose() {
      for (const stop of untrack) stop()
      for (const mesh of meshes) {

        for (const name of Object.keys(mesh.geometry.attributes)) if (name !== 'aPatch') mesh.geometry.deleteAttribute(name)
        mesh.geometry.setIndex(null)
        mesh.geometry.dispose()
        mesh.dispose()
      }
    },
  }
}

function chunkCamera(target: THREE.Vector3, camera: THREE.Camera, data: ChunkData) {
  return target.set(camera.position.x + runtime.origin.x - data.cx * CHUNK_SIZE, camera.position.y, camera.position.z + runtime.origin.z - data.cz * CHUNK_SIZE)
}

export const GrassField = memo(function GrassField({ data, quality }: { data: ChunkData; quality: Quality }) {
  const group = useRef<THREE.Group>(null)
  const field = useRef<ReturnType<typeof createField> | null>(null)
  const get = useThree((state) => state.get)
  const patches = useMemo(() => readPatches(data), [data])
  const cameraPoint = useMemo(() => new THREE.Vector3(), [])
  useLayoutEffect(() => {
    const parent = group.current
    if (!parent || !patches.count) return
    const next = createField(patches, quality)
    field.current = next
    parent.add(...next.meshes)
    next.update(chunkCamera(cameraPoint, get().camera, data))
    return () => { field.current = null; parent.remove(...next.meshes); next.dispose() }
  }, [patches, quality, get, data, cameraPoint])
  useFrame(({ camera, clock }) => {
    GRASS_UNIFORMS.grassTime.value = clock.elapsedTime
    GRASS_UNIFORMS.grassEye.value.copy(camera.position)
    GRASS_UNIFORMS.grassOrigin.value.set(runtime.origin.x, runtime.origin.z)
    GRASS_UNIFORMS.grassFade.value.y = GRASS_LEVELS[quality].bounds.at(-1)!
    field.current?.update(chunkCamera(cameraPoint, camera, data))
  })
  return <group ref={group} dispose={null} matrixAutoUpdate={false} matrixWorldNeedsUpdate />
})
