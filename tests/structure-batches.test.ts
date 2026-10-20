import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { StructureBatcher } from '../components/game/structure-batches'
import type { MaterialKey } from '../lib/game/blockout/types'
import { modelKey, seedOf, type BuiltStructure, type StructureRecord } from '../lib/game/world/structure-streamer'

function rng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const MATERIALS: MaterialKey[] = ['concrete', 'brick', 'wood', 'steel'] as MaterialKey[]

function fakeGeometry(random: () => number, vertices: number) {
  const positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3), uvs = new Float32Array(vertices * 2), colors = new Float32Array(vertices * 3)
  for (let i = 0; i < positions.length; i++) { positions[i] = random() * 20; normals[i] = 1; colors[i] = random() }
  for (let i = 0; i < uvs.length; i++) uvs[i] = random()
  const triangles = Math.max(1, Math.floor(vertices * 0.6))
  const indices = new Uint32Array(triangles * 3)
  for (let i = 0; i < indices.length; i++) indices[i] = Math.floor(random() * vertices)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(vertices <= 65535 ? Uint16Array.from(indices) : indices, 1))
  geometry.computeBoundingSphere()
  return geometry
}

function fakeCaster(random: () => number, vertices: number) {
  const source = fakeGeometry(random, vertices)
  const caster = new THREE.BufferGeometry()
  caster.setAttribute('position', source.getAttribute('position'))
  caster.setIndex(source.getIndex())
  caster.computeBoundingSphere()
  return caster
}

function fakeModel(random: () => number, big: boolean): BuiltStructure {
  const count = 1 + Math.floor(random() * MATERIALS.length)
  const groups = MATERIALS.slice(0, count).map((material) => ({ material, geometry: fakeGeometry(random, big ? 40_000 + Math.floor(random() * 50_000) : 300 + Math.floor(random() * 6_000)) }))

  const caster = random() < 0.85 ? fakeCaster(random, 200 + Math.floor(random() * 4_000)) : null
  return { groups, caster, boxes: new Float32Array(0), triangles: groups.reduce((sum, group) => sum + group.geometry.getIndex()!.count / 3, 0) }
}

function fakeRecord(random: () => number, seed: number): StructureRecord {
  const yaw = random() * Math.PI * 2
  return {
    seed, blueprint: 'test', condition: 'weathered', zone: 'core' as StructureRecord['zone'],
    x: (random() - 0.5) * 4000, y: random() * 50, z: (random() - 0.5) * 4000, yaw, cos: Math.cos(yaw), sin: Math.sin(yaw),
    minX: -5, maxX: 5, minZ: -5, maxZ: 5, radius: 7, eave: 4, start: 0, count: 0, lod: 0,
  }
}

type Pool = { mesh: THREE.BatchedMesh; free: unknown[]; used: Map<number, unknown>; vertexCapacity: number; fading: number }

const variants = new Map<string, THREE.Material>()
function materialFor(key: MaterialKey, solid: boolean) {
  const name = `${key}-${solid ? 'solid' : 'fade'}`
  let material = variants.get(name)
  if (!material) { material = new THREE.MeshBasicMaterial({ name }); variants.set(name, material) }
  return material
}
type Pools = Map<MaterialKey, Pool>
type Placed = Map<number, { fade: number; parts: { material: MaterialKey; geometryId: number; instanceId: number }[]; caster: { geometryId: number; instanceId: number } | null }>

function verify(batcher: StructureBatcher, shown: Map<number, number>, built: Map<number, BuiltStructure>, records: Map<number, StructureRecord>, origin: { x: number; z: number }) {
  const pools = (batcher as unknown as { batches: Pools }).batches, placed = (batcher as unknown as { placed: Placed }).placed
  assert.equal(placed.size, shown.size)
  const expected = new THREE.Matrix4(), actual = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), unit = new THREE.Vector3(1, 1, 1)
  const range: THREE.BatchedMeshGeometryRange = { vertexStart: 0, vertexCount: 0, reservedVertexCount: 0, indexStart: 0, indexCount: 0, reservedIndexCount: 0, start: 0, count: 0 }
  let instances = 0, casters = 0
  for (const [key, fade] of shown) {
    const entry = placed.get(key)!, model = built.get(key)!, record = records.get(seedOf(key))!
    assert.equal(entry.fade, fade)
    assert.equal(entry.parts.length, model.groups.length)
    expected.compose(position.set(record.x - origin.x, record.y, record.z - origin.z), rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), record.yaw), unit)
    model.groups.forEach((group, index) => {
      const part = entry.parts[index], mesh = pools.get(part.material)!.mesh
      assert.equal(part.material, group.material)
      mesh.getGeometryRangeAt(part.geometryId, range)
      assert.equal(range.vertexCount, group.geometry.getAttribute('position').count)
      assert.equal(range.indexCount, group.geometry.getIndex()!.count)
      assert.equal(mesh.getGeometryIdAt(part.instanceId), part.geometryId)
      assert.equal(mesh.getVisibleAt(part.instanceId), true)

      const colors = (mesh as unknown as { _colorsTexture: THREE.DataTexture })._colorsTexture.image.data as Float32Array
      assert.equal(colors[part.instanceId * 4 + 3], Math.fround(fade))
      mesh.getMatrixAt(part.instanceId, actual)
      for (let i = 0; i < 16; i++) assert.ok(Math.abs(actual.elements[i] - expected.elements[i]) < 1e-3, `matrix element ${i}`)

      const batchIndex = mesh.geometry.getIndex()!, batchPositions = mesh.geometry.getAttribute('position'), sourceIndex = group.geometry.getIndex()!, sourcePositions = group.geometry.getAttribute('position')
      for (const k of [0, Math.floor(range.indexCount / 2), range.indexCount - 1]) {
        assert.equal(batchIndex.getX(range.indexStart + k) - range.vertexStart, sourceIndex.getX(k))
      }
      for (const v of [0, Math.floor(range.vertexCount / 2), range.vertexCount - 1]) {
        assert.equal(batchPositions.getX(range.vertexStart + v), sourcePositions.getX(v))
        assert.equal(batchPositions.getZ(range.vertexStart + v), sourcePositions.getZ(v))
      }
      instances++
    })

    const casterPool = (batcher as unknown as { casters: Pool | null }).casters
    if (!model.caster) { assert.equal(entry.caster, null); continue }
    assert.ok(entry.caster && casterPool)
    casterPool.mesh.getGeometryRangeAt(entry.caster.geometryId, range)
    assert.equal(range.indexCount, model.caster.getIndex()!.count)
    assert.equal(casterPool.mesh.getGeometryIdAt(entry.caster.instanceId), entry.caster.geometryId)
    casterPool.mesh.getMatrixAt(entry.caster.instanceId, actual)
    for (let i = 0; i < 16; i++) assert.ok(Math.abs(actual.elements[i] - expected.elements[i]) < 1e-3, `caster matrix element ${i}`)
    casters++
  }
  const stats = batcher.stats
  assert.equal(stats.models, shown.size)
  assert.equal(stats.instances, instances)
  assert.equal(stats.casters, casters)
  const casterPool = (batcher as unknown as { casters: Pool | null }).casters
  for (const pool of [...pools.values(), ...(casterPool ? [casterPool] : [])]) {
    const info = (pool.mesh as unknown as { _instanceInfo: { active: boolean }[] })._instanceInfo
    assert.equal(info.filter((entry) => entry.active).length, pool.used.size)
  }

  const fadingParts = new Map<MaterialKey, number>()
  let fading = 0
  for (const [key, fade] of shown) {
    if (fade > 0.999 && fade < 1.001) continue
    for (const group of built.get(key)!.groups) { fadingParts.set(group.material, (fadingParts.get(group.material) ?? 0) + 1); fading++ }
  }
  assert.equal(stats.fading, fading)
  for (const [material, pool] of pools) {
    const expectedFading = fadingParts.get(material) ?? 0
    assert.equal(pool.fading, expectedFading)
    assert.equal((pool.mesh.material as THREE.Material).name, `${material}-${expectedFading ? 'fade' : 'solid'}`)
  }

  for (const pool of pools.values()) assert.equal(pool.mesh.castShadow, false)
  if (casterPool) {
    assert.equal(casterPool.mesh.castShadow, true)
    assert.equal(casterPool.mesh.layers.isEnabled(0), false)
  }
}

test('structure pools follow the draw list through churn, cross-fades, slot reuse, repacking and growth', () => {
  const random = rng(7)
  const built = new Map<number, BuiltStructure>(), records = new Map<number, StructureRecord>()
  for (let seed = 1; seed <= 40; seed++) {
    records.set(seed, fakeRecord(random, seed))
    built.set(modelKey(seed, 'shell'), fakeModel(random, seed % 9 === 0))
    built.set(modelKey(seed, 'full'), fakeModel(random, seed % 13 === 0))
    built.set(modelKey(seed, 'proxy'), fakeModel(random, false))
  }
  const tiers = ['shell', 'full', 'proxy'] as const
  const batcher = new StructureBatcher(materialFor)
  const origin = { x: 256, z: -512 }
  let shown = new Map<number, number>()
  let grew = false, repacked = false
  const pools = (batcher as unknown as { batches: Pools }).batches
  for (let round = 0; round < 120; round++) {
    const next = new Map<number, number>()
    const size = Math.floor(random() * 28)
    for (let i = 0; i < size; i++) {
      const seed = 1 + Math.floor(random() * 40)

      const kept = [...shown.keys()].filter((key) => seedOf(key) === seed)
      if (kept.length && random() < 0.8) for (const key of kept) next.set(key, random() < 0.5 ? shown.get(key)! : Math.round(random() * 200) / 100)
      else next.set(modelKey(seed, tiers[Math.floor(random() * 3)]), random() < 0.6 ? 1 : Math.round(random() * 200) / 100)
    }
    const before = new Map([...pools].map(([key, pool]) => [key, pool.vertexCapacity]))
    batcher.sync(next, built, records, origin)
    for (const [key, pool] of pools) if ((before.get(key) ?? 0) && pool.vertexCapacity > before.get(key)!) grew = true
    for (const pool of pools.values()) if (pool.free.length === 0 && pool.used.size > 0 && round > 30) repacked = true
    shown = next
    verify(batcher, shown, built, records, origin)
  }
  assert.ok(grew, 'a pool should have grown past its initial size')
  assert.ok(repacked, 'a pool should have been repacked at least once')

  const moved = { x: origin.x + 768, z: origin.z - 256 }
  batcher.rebase(records, moved)
  verify(batcher, shown, built, records, moved)
  batcher.sync(new Map(), built, records, moved)
  assert.equal(batcher.stats.models, 0)
  assert.equal(batcher.stats.instances, 0)
  assert.equal(batcher.stats.casters, 0)
  assert.equal(batcher.stats.fading, 0)
  for (const [material, pool] of pools) assert.equal((pool.mesh.material as THREE.Material).name, `${material}-solid`)
  batcher.dispose()
})
