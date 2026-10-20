'use client'

import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { HeightfieldCollider, type HeightfieldArgs, RigidBody, TrimeshCollider, useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { GUARDRAIL, ROAD_LAYERS, STRUCTURE_LAYERS, treeFit, treeVariantPick } from '@/lib/game/assets/catalog'
import { chunkSurface } from '@/lib/game/world/surface'
import { groundTextures } from '@/lib/game/assets/ground-textures'
import { lazy, pbrMaterial } from '@/lib/game/assets/pbr'
import { terrainMaterial } from '@/lib/game/assets/terrain-material'
import { waterAbsorbMaterial, waterSurfaceMaterial } from '@/lib/game/assets/water-material'
import { waterfallMaterial } from '@/lib/game/assets/waterfall-material'
import { runtime } from '@/lib/game/runtime'
import { ALL_SHADOW_LAYERS, NEAR_SHADOW_LAYERS, invalidateChunkShadows } from '@/lib/game/shadow'
import { registerSkyOccluder } from '@/lib/game/sky/sky-occlusion'
import { CHUNK_SIZE, chunkKey } from '@/lib/game/world/settings'
import type { WorldSession } from '@/lib/game/world/session'
import type { ChunkData } from '@/lib/game/world/types'
import { useChunkOrigin } from './chunk-origin'
import { ForestFloor } from './forest-floor'
import { geometryFrom } from './geometry'
import { GrassField } from './grass-field'
import { Batch } from './instanced-batch'
import { useKits } from './prop-kits'
import { Vegetation } from './vegetation'

const ROAD_SURFACE = { vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 } as const

function solidReceiver(material: THREE.MeshStandardMaterial) {
  material.defines = { ...material.defines, SUN_RING_SOLID: '' }
  return material
}

const roadMaterials = lazy(() => [
  ...ROAD_LAYERS.map((set) => solidReceiver(pbrMaterial(set, ROAD_SURFACE))),
  ...groundTextures().styles.map(({ map, normalMap, orm }) => solidReceiver(new THREE.MeshStandardMaterial({
    ...ROAD_SURFACE, map, normalMap, aoMap: orm, roughnessMap: orm, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.9, 0.9),
  }))),
])

const casterMaterial = lazy(() => new THREE.MeshBasicMaterial({ name: 'ground-caster' }))

function terrainCaster(terrain: THREE.BufferGeometry, segments: number) {
  const caster = new THREE.BufferGeometry()
  caster.setAttribute('position', terrain.getAttribute('position'))
  caster.setIndex(terrain.getIndex())
  caster.setDrawRange(0, segments * segments * 6)
  caster.boundingSphere = terrain.boundingSphere
  return caster
}
const markingMaterial = lazy(() => pbrMaterial('paint', { vertexColors: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }))
const structureMaterials = lazy(() => STRUCTURE_LAYERS.map((set) => pbrMaterial(set, { vertexColors: true, ...(set === 'steel' ? { metalness: 0, envMap: null } : {}) })))

const STATIC = { matrixAutoUpdate: false, matrixWorldNeedsUpdate: true } as const

export const TerrainChunk = memo(function TerrainChunk({ data, session }: { data: ChunkData; session: WorldSession }) {
  const group = useRef<THREE.Group>(null)
  const props = useRef<THREE.Mesh>(null)
  const geometries = useMemo(() => {
    const terrain = geometryFrom(data.terrain)
    return {
      terrain, terrainCaster: terrainCaster(terrain, data.segments), roads: geometryFrom(data.roads), markings: geometryFrom(data.markings),
      props: geometryFrom(data.props), water: geometryFrom(data.water), waterfall: geometryFrom(data.waterfall),
    }
  }, [data])
  useEffect(() => () => { for (const geometry of Object.values(geometries)) geometry.dispose() }, [geometries])

  useLayoutEffect(() => {
    invalidateChunkShadows(data.cx, data.cz)
    return () => invalidateChunkShadows(data.cx, data.cz)
  }, [data])

  useLayoutEffect(() => (props.current ? registerSkyOccluder(props.current, 'solid') : undefined), [geometries])
  useChunkOrigin(group, data.cx, data.cz)
  return (
    <>
      <group ref={group} position={[data.cx * CHUNK_SIZE - runtime.origin.x, 0, data.cz * CHUNK_SIZE - runtime.origin.z]} dispose={null} {...STATIC}>
        <mesh geometry={geometries.terrain} material={terrainMaterial(session.quality)} receiveShadow {...STATIC} />
        <mesh geometry={geometries.terrainCaster} material={casterMaterial()} castShadow layers-mask={ALL_SHADOW_LAYERS} {...STATIC} />
        {data.roads.indices.length > 0 && <mesh geometry={geometries.roads} material={roadMaterials()} receiveShadow {...STATIC} />}
        {                                                                                                                             }
        {data.lod === 0 && data.roads.indices.length > 0 && (
          <mesh geometry={geometries.roads} material={casterMaterial()} castShadow layers-mask={NEAR_SHADOW_LAYERS} {...STATIC} />
        )}
        {data.markings.indices.length > 0 && <mesh geometry={geometries.markings} material={markingMaterial()} receiveShadow {...STATIC} />}
        {data.props.indices.length > 0 && <mesh ref={props} geometry={geometries.props} material={structureMaterials()} castShadow receiveShadow {...STATIC} />}
        {                                                                                                    }
        {data.water.indices.length > 0 && <mesh geometry={geometries.water} material={waterAbsorbMaterial()} renderOrder={1} {...STATIC} />}
        {data.water.indices.length > 0 && <mesh geometry={geometries.water} material={waterSurfaceMaterial()} renderOrder={2} receiveShadow {...STATIC} />}
        {                                                                                                 }
        {data.waterfall.indices.length > 0 && <mesh geometry={geometries.waterfall} material={waterfallMaterial()} renderOrder={2} {...STATIC} />}
        {data.posts.length > 0 && <Suspense fallback={null}><GuardrailPosts data={data} /></Suspense>}
        <Suspense fallback={null}><Vegetation data={data} /></Suspense>
        {data.grass.length > 0 && <GrassField data={data} quality={session.quality} />}
        <ForestFloor data={data} />
      </group>
      {data.lod === 0 && <ChunkColliders data={data} session={session} />}
    </>
  )
})

function GuardrailPosts({ data }: { data: ChunkData }) {
  const part = useKits().road.get(GUARDRAIL.post)?.[0]
  const instances = useMemo(() => {
    const matrices = new Float32Array((data.posts.length / 4) * 16)
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0)
    for (let i = 0, k = 0; i < data.posts.length; i += 4, k += 16) {
      matrix.compose(position.set(data.posts[i], data.posts[i + 1], data.posts[i + 2]), rotation.setFromAxisAngle(up, data.posts[i + 3]), scale)
      matrices.set(matrix.elements, k)
    }
    return { matrices }
  }, [data])
  if (!part) return null
  return <Batch data={instances} geometry={part.geometry} material={part.material} shadow={data.lod === 0} />
}

function ChunkColliders({ data, session }: { data: ChunkData; session: WorldSession }) {

  const heightfield = useMemo(() => {
    const segments = data.segments, stride = segments + 1, positions = data.terrain.positions
    const heights = new Float32Array(stride * stride)
    for (let iz = 0; iz < stride; iz++) for (let ix = 0; ix < stride; ix++) heights[ix * stride + iz] = positions[(iz * stride + ix) * 3 + 1]
    return [segments, segments, heights, { x: CHUNK_SIZE, y: 1, z: CHUNK_SIZE }] as unknown as HeightfieldArgs
  }, [data])

  const roadArgs = useMemo<[Float32Array, Uint32Array] | null>(() => data.roads.indices.length ? [data.roads.positions, data.roads.indices] : null, [data])
  useEffect(() => {
    const key = chunkKey(data.cx, data.cz)
    session.colliders.add(key)
    return () => { session.colliders.delete(key) }
  }, [data, session])

  const { world, rapier } = useRapier()
  useEffect(() => {
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(data.cx * CHUNK_SIZE - runtime.origin.x, 0, data.cz * CHUNK_SIZE - runtime.origin.z))
    for (let i = 0; i < data.trees.length; i += 8) {
      const [x, , z, yaw, height, width, species, shade] = data.trees.subarray(i, i + 8)
      const fit = treeFit(species, height, width, treeVariantPick(yaw, shade))
      const y = chunkSurface(data, x, z).height, halfHeight = height * 0.43
      world.createCollider(rapier.ColliderDesc.cylinder(halfHeight, fit.trunk * 1.08).setTranslation(x, y + halfHeight, z), body)
    }
    for (let i = 0; i < data.solids.length; i += 10) {
      const [x, y, z, qx, qy, qz, qw, hx, hy, hz] = data.solids.subarray(i, i + 10)
      world.createCollider(rapier.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation({ x: qx, y: qy, z: qz, w: qw }), body)
    }
    return () => { if (world.getRigidBody(body.handle)) world.removeRigidBody(body) }
  }, [data, world, rapier])
  return (
    <RigidBody type="fixed" colliders={false} position={[data.cx * CHUNK_SIZE - runtime.origin.x, 0, data.cz * CHUNK_SIZE - runtime.origin.z]}>
      <HeightfieldCollider args={heightfield} position={[CHUNK_SIZE / 2, 0, CHUNK_SIZE / 2]} friction={0.8} />
      {roadArgs && <TrimeshCollider args={roadArgs} friction={0.9} />}
    </RigidBody>
  )
}
