import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { SCATTER, ScatterPools, type ScatterItem, type ScatterKind, type ScatterModel } from '../components/game/scatter-pools'
import { FERN_LOD, TREE_LOD } from '../lib/game/assets/pbr'
import { impostorGeometry } from '../lib/game/assets/tree-impostors'
import { runtime } from '../lib/game/runtime'
import { MID_SHADOW_LAYER, SHADOW_BASIS, SHADOW_LAYER, ringReach } from '../lib/game/shadow'

const part = (name: string) => {
  const material = new THREE.MeshBasicMaterial()
  material.name = name
  return { geometry: new THREE.BoxGeometry(1, 1, 1), material }
}
const parts = { fullBark: part('full_bark'), fullLeaf: part('full_leaf'), midBark: part('mid_bark'), fern: part('fern'), pebble: part('pebble'), boulder: part('boulder') }
const sphereOf = (geometry: THREE.BufferGeometry) => { geometry.computeBoundingSphere(); return geometry.boundingSphere!.clone() }
const tree: ScatterModel = { levels: [[parts.fullBark, parts.fullLeaf], [parts.midBark]], shadow: [parts.midBark], sphere: sphereOf(parts.fullBark.geometry) }
const fern: ScatterModel = { levels: [[parts.fern], []], shadow: [parts.fern], sphere: sphereOf(parts.fern.geometry) }
const pebble: ScatterModel = { levels: [[parts.pebble]], shadow: [parts.pebble], sphere: sphereOf(parts.pebble.geometry) }
const boulder: ScatterModel = { levels: [[parts.boulder]], shadow: [parts.boulder], sphere: sphereOf(parts.boulder.geometry) }

const item = (kind: ScatterKind, model: ScatterModel, x: number, z: number): ScatterItem => {
  const base = new THREE.Vector3(x, 0, z)
  return { kind, model, base, matrix: new THREE.Matrix4().makeTranslation(base), color: new THREE.Color(1, 1, 1) }
}

function setup() {
  runtime.origin.x = 0
  runtime.origin.z = 0
  runtime.originShifts = 0
  runtime.playerPosition.set(128, 0, 128)
  const camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.1, 3600)
  camera.position.set(128, 2, 128)
  camera.lookAt(128, 2, 0)
  camera.updateMatrixWorld()
  return { pools: new ScatterPools(), camera }
}

function drawn(pools: ScatterPools) {
  const counts: Record<string, number> = {}
  pools.group.traverse((object) => {
    const mesh = object as THREE.InstancedMesh
    if (mesh.isInstancedMesh && mesh.visible) counts[mesh.name] = (counts[mesh.name] ?? 0) + mesh.count
  })
  return counts
}

test('scatter pools pick each level by distance, cull what is off screen and keep casters for the near and middle shadow rings', () => {
  const { pools, camera } = setup()
  pools.add(0, 0, [
    item(SCATTER.tree, tree, 128, 118),
    item(SCATTER.tree, tree, 128, 100),
    item(SCATTER.tree, tree, 128, 48),
    item(SCATTER.tree, tree, 128, 143),
    item(SCATTER.fern, fern, 130, 120),
    item(SCATTER.small, pebble, 128, 110),
    item(SCATTER.small, pebble, 128, 20),
    item(SCATTER.large, boulder, 128, 30),
  ])
  pools.add(0, -1, [item(SCATTER.tree, tree, 128, 56)])
  pools.update(camera, 'low', 600)
  const counts = drawn(pools)
  assert.equal(counts['scatter-full_bark'], 2)
  assert.equal(counts['scatter-full_leaf'], 2)
  assert.equal(counts['scatter-mid_bark'], 2)
  assert.equal(counts['scatter-fern'], 1)
  assert.equal(counts['scatter-pebble'], 1)
  assert.equal(counts['scatter-boulder'], 1)

  const { right, up } = SHADOW_BASIS
  const reaches = (x: number, z: number, ring: number) => {
    const limit = ringReach(ring) + tree.sphere.radius, offset = new THREE.Vector3(x - 128, 0, z - 128)
    return Math.abs(offset.dot(right)) <= limit && Math.abs(offset.dot(up)) <= limit
  }
  const trees = [[128, 118], [128, 100], [128, 48], [128, 143], [128, 56 - 256]]
  const casters = (ring: number) => trees.filter(([x, z]) => reaches(x, z, ring)).length || undefined
  assert.equal(counts['scatter-shadow-mid_bark'], casters(0))
  assert.equal(counts['scatter-farshadow-mid_bark'], casters(1))
  assert.ok((casters(0) ?? 0) >= 1 && (casters(1) ?? 0) > (casters(0) ?? 0), 'the second ring holds more trees than the first')
  assert.ok(!reaches(128, 56 - 256, 1), 'the tree ~330 m away is left to the impostor rings')
  assert.equal(counts['scatter-shadow-boulder'], reaches(128, 30, 0) ? 1 : undefined)
  assert.equal(counts['scatter-farshadow-boulder'], reaches(128, 30, 1) ? 1 : undefined)
  for (const prefix of ['scatter-shadow-', 'scatter-farshadow-']) {
    assert.equal(counts[`${prefix}fern`], undefined, 'ferns cast no shadow')
    assert.equal(counts[`${prefix}pebble`], undefined, 'pebbles cast no shadow')
  }
  pools.group.traverse((object) => {
    const mesh = object as THREE.InstancedMesh
    if (!mesh.isInstancedMesh) return
    const layer = mesh.name.startsWith('scatter-shadow-') ? SHADOW_LAYER : mesh.name.startsWith('scatter-farshadow-') ? MID_SHADOW_LAYER : 0
    assert.equal(mesh.castShadow, layer !== 0)
    assert.equal(mesh.layers.mask, 1 << layer)
  })
  assert.deepEqual(TREE_LOD.value.toArray(), [30, 6, 140, 12])
  assert.deepEqual(FERN_LOD.value.toArray(), [20, 3, 55, 6])
  pools.dispose()
})

test('scatter pools grow past their initial capacity and follow removals and origin shifts', () => {
  const { pools, camera } = setup()
  const many = Array.from({ length: 300 }, (_, i) => item(SCATTER.small, pebble, 120 + (i % 16), 110 + Math.floor(i / 16) * 0.3))
  const remove = pools.add(0, 0, many)
  pools.update(camera, 'balanced', 900)
  assert.equal(drawn(pools)['scatter-pebble'], 300)
  const mesh = pools.group.children.find((child) => child.name === 'scatter-pebble') as THREE.InstancedMesh
  const position = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, 0))
  assert.ok(Math.abs(position.z - 110) < 1e-4)

  runtime.origin.z = 256
  runtime.originShifts++
  camera.position.z -= 256
  camera.updateMatrixWorld()
  runtime.playerPosition.z -= 256
  pools.update(camera, 'balanced', 900)
  const shifted = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, 0))
  assert.ok(Math.abs(shifted.z - (110 - 256)) < 1e-4)

  remove()
  pools.update(camera, 'balanced', 900)
  assert.equal(drawn(pools)['scatter-pebble'], undefined)
  pools.dispose()
})

test('a chunk impostor mesh holds four vertices and two triangles per tree with bounds over the cards', () => {
  const trees = [
    { variant: 0, x: 10, y: 5, z: 20, sxz: 1, sy: 1, tint: 0.9 },
    { variant: 3, x: 200, y: 12, z: 180, sxz: 1.2, sy: 1.4, tint: 1 },
  ]
  const geometry = impostorGeometry(trees)
  assert.equal(geometry.getAttribute('position').count, 8)
  assert.equal(geometry.getAttribute('forestCorner').count, 8)
  assert.equal(geometry.getIndex()!.count, 12)
  const sphere = geometry.boundingSphere!
  for (const tree of trees) assert.ok(sphere.distanceToPoint(new THREE.Vector3(tree.x, tree.y + 20, tree.z)) <= 0)
  geometry.dispose()
})
