import * as THREE from 'three'
import { FERN_LOD, TREE_LOD } from '@/lib/game/assets/pbr'
import { runtime } from '@/lib/game/runtime'
import { MID_SHADOW_LAYER, SHADOW_BASIS, SHADOW_LAYER, ringReach } from '@/lib/game/shadow'
import { CHUNK_SIZE, type Quality } from '@/lib/game/world/settings'
import type { ModelPart } from './prop-kits'

export const SCATTER = { tree: 0, fern: 1, small: 2, large: 3 } as const
export type ScatterKind = (typeof SCATTER)[keyof typeof SCATTER]

export type ScatterModel = { levels: ModelPart[][]; shadow: ModelPart[]; sphere: THREE.Sphere }

export type ScatterItem = { kind: ScatterKind; model: ScatterModel; matrix: THREE.Matrix4; color: THREE.Color; base: THREE.Vector3 }

const BANDS: Record<Quality, { tree: number[]; fern: number[]; small: number }> = {
  low: { tree: [30, 6, 140, 12], fern: [20, 3, 55, 6], small: 80 },
  balanced: { tree: [74, 10, 235, 14], fern: [28, 4, 85, 8], small: 150 },
  high: { tree: [98, 12, 310, 16], fern: [36, 4, 120, 10], small: 150 },
}

const MARGIN = 3
const CELL = 32
const CELLS = CHUNK_SIZE / CELL

const CASTERS = (1 << SCATTER.tree) | (1 << SCATTER.large)
const NEAR_CASTERS = CASTERS | (1 << SCATTER.small) | (1 << SCATTER.fern)
const INITIAL_CAPACITY = 64

const POOL_PREFIX: Record<number, string> = { 0: 'scatter', [SHADOW_LAYER]: 'scatter-shadow', [MID_SHADOW_LAYER]: 'scatter-farshadow' }

class Pool {
  mesh: THREE.InstancedMesh
  count = 0

  constructor(private readonly part: ModelPart, private readonly layer: number, private readonly parent: THREE.Group) {
    this.mesh = this.create(INITIAL_CAPACITY)
  }

  push(matrices: Float32Array, colors: Float32Array, item: number, dx: number, dz: number) {
    if (this.count >= this.capacity) this.grow()
    const target = this.mesh.instanceMatrix.array as Float32Array, m = item * 16, k = this.count * 16
    for (let i = 0; i < 16; i++) target[k + i] = matrices[m + i]
    target[k + 12] += dx
    target[k + 14] += dz
    const tint = this.mesh.instanceColor!.array as Float32Array, c = item * 3, j = this.count * 3
    tint[j] = colors[c]
    tint[j + 1] = colors[c + 1]
    tint[j + 2] = colors[c + 2]
    this.count++
  }

  finish() {
    const mesh = this.mesh, count = this.count
    mesh.count = count
    mesh.visible = count > 0
    if (!count) return
    for (const attribute of [mesh.instanceMatrix, mesh.instanceColor!]) {
      attribute.clearUpdateRanges()
      attribute.addUpdateRange(0, count * attribute.itemSize)
      attribute.needsUpdate = true
    }
  }

  dispose() {
    this.parent.remove(this.mesh)
    this.mesh.dispose()
  }

  private get capacity() { return this.mesh.instanceMatrix.count }

  private create(capacity: number) {
    const mesh = new THREE.InstancedMesh(this.part.geometry, this.part.material, capacity)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage)
    mesh.count = 0
    mesh.visible = false

    mesh.frustumCulled = false
    mesh.matrixAutoUpdate = false
    mesh.matrixWorldNeedsUpdate = true
    const caster = this.layer !== 0
    mesh.castShadow = caster
    mesh.receiveShadow = !caster
    if (caster) mesh.layers.set(this.layer)
    mesh.name = `${POOL_PREFIX[this.layer]}-${this.part.material.name || 'part'}`
    this.parent.add(mesh)
    return mesh
  }

  private grow() {
    const previous = this.mesh
    this.mesh = this.create(this.capacity * 2)
    ;(this.mesh.instanceMatrix.array as Float32Array).set(previous.instanceMatrix.array as Float32Array)
    ;(this.mesh.instanceColor!.array as Float32Array).set(previous.instanceColor!.array as Float32Array)
    this.parent.remove(previous)
    previous.dispose()
  }
}

type Cell = { box: THREE.Box3; start: number; end: number; kinds: number }
type Entry = {
  cx: number; cz: number
  kinds: Uint8Array; models: ScatterModel[]

  matrices: Float32Array; colors: Float32Array; bases: Float32Array; spheres: Float32Array
  cells: Cell[]
}
type Resolved = { levels: Pool[][]; shadow: Pool[] | null; midShadow: Pool[] | null }
type Registry = Map<THREE.Material, Map<THREE.BufferGeometry, Pool>>

export class ScatterPools {
  readonly group = new THREE.Group()
  private readonly entries = new Set<Entry>()
  private readonly pools: Pool[] = []
  private main: Registry = new Map()
  private casters: Registry = new Map()
  private midCasters: Registry = new Map()
  private resolved = new WeakMap<ScatterModel, Resolved>()
  private readonly frustum = new THREE.Frustum()
  private readonly viewProjection = new THREE.Matrix4()
  private readonly box = new THREE.Box3()
  private readonly sphere = new THREE.Sphere()
  private readonly center = new THREE.Vector3()
  private readonly lastCamera = new THREE.Vector3(Infinity, Infinity, Infinity)
  private readonly lastTurn = new THREE.Quaternion()
  private readonly lastPlayer = new THREE.Vector3(Infinity, Infinity, Infinity)
  private readonly nearReach = ringReach(0)
  private readonly midReach = ringReach(1)
  private quality: Quality | null = null
  private shifts = -1
  private dirty = true

  constructor() {
    this.group.name = 'scatter'
    this.group.matrixAutoUpdate = false
  }

  add(cx: number, cz: number, items: ScatterItem[]) {
    const cellOf = (item: ScatterItem) => {
      const x = Math.min(CELLS - 1, Math.max(0, Math.floor(item.base.x / CELL)))
      const z = Math.min(CELLS - 1, Math.max(0, Math.floor(item.base.z / CELL)))
      return z * CELLS + x
    }
    const sorted = items.map((item) => ({ item, cell: cellOf(item) })).sort((a, b) => a.cell - b.cell)
    const count = sorted.length
    const entry: Entry = {
      cx, cz, kinds: new Uint8Array(count), models: new Array(count),
      matrices: new Float32Array(count * 16), colors: new Float32Array(count * 3), bases: new Float32Array(count * 3), spheres: new Float32Array(count * 4),
      cells: [],
    }
    const sphere = new THREE.Sphere()
    let cell: Cell | null = null, cellIndex = -1
    sorted.forEach(({ item, cell: index }, i) => {
      entry.kinds[i] = item.kind
      entry.models[i] = item.model
      item.matrix.toArray(entry.matrices, i * 16)
      entry.colors[i * 3] = item.color.r; entry.colors[i * 3 + 1] = item.color.g; entry.colors[i * 3 + 2] = item.color.b
      item.base.toArray(entry.bases, i * 3)
      sphere.copy(item.model.sphere).applyMatrix4(item.matrix)
      entry.spheres[i * 4] = sphere.center.x; entry.spheres[i * 4 + 1] = sphere.center.y; entry.spheres[i * 4 + 2] = sphere.center.z; entry.spheres[i * 4 + 3] = sphere.radius
      if (index !== cellIndex) {
        cellIndex = index
        cell = { box: new THREE.Box3(), start: i, end: i, kinds: 0 }
        entry.cells.push(cell)
      }
      cell!.end = i + 1
      cell!.kinds |= 1 << item.kind
      cell!.box.expandByPoint(this.center.copy(sphere.center).subScalar(sphere.radius))
      cell!.box.expandByPoint(this.center.copy(sphere.center).addScalar(sphere.radius))
    })
    this.entries.add(entry)
    this.dirty = true
    return () => {
      this.entries.delete(entry)
      this.dirty = true
    }
  }

  update(camera: THREE.Camera, quality: Quality, viewDistance: number) {
    if (quality !== this.quality) {
      this.quality = quality
      TREE_LOD.value.fromArray(BANDS[quality].tree)
      FERN_LOD.value.fromArray(BANDS[quality].fern)
      this.dirty = true
    }
    if (runtime.originShifts !== this.shifts) {
      this.shifts = runtime.originShifts
      this.dirty = true
    }
    camera.updateMatrixWorld()
    const player = runtime.playerPosition
    const moved = camera.position.distanceToSquared(this.lastCamera) > 0.0025
      || Math.abs(camera.quaternion.dot(this.lastTurn)) < 0.999995
      || player.distanceToSquared(this.lastPlayer) > 0.04
    if (!this.dirty && !moved) return
    this.dirty = false
    this.lastCamera.copy(camera.position)
    this.lastTurn.copy(camera.quaternion)
    this.lastPlayer.copy(player)
    this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))

    const bands = BANDS[quality], [tNear, tNearBand, tFar, tFarBand] = bands.tree, [fNear, fNearBand, fFar, fFarBand] = bands.fern
    const treeFull = tNear + tNearBand + MARGIN, treeMiddle = tNear - tNearBand - MARGIN, treeEnd = tFar + tFarBand + MARGIN
    const fernFull = fNear + fNearBand + MARGIN, fernMiddle = fNear - fNearBand - MARGIN, fernEnd = fFar + fFarBand + MARGIN
    const reach = [treeEnd, fernEnd, bands.small, viewDistance]
    const eye = camera.position, sphere = this.sphere, box = this.box
    for (const pool of this.pools) pool.count = 0

    for (const entry of this.entries) {
      const ox = entry.cx * CHUNK_SIZE - runtime.origin.x, oz = entry.cz * CHUNK_SIZE - runtime.origin.z
      const { kinds, models, matrices, colors, bases, spheres } = entry
      for (const cell of entry.cells) {
        const b = cell.box
        box.min.set(ox + b.min.x, b.min.y, oz + b.min.z)
        box.max.set(ox + b.max.x, b.max.y, oz + b.max.z)
        const dx = Math.max(box.min.x - eye.x, 0, eye.x - box.max.x), dz = Math.max(box.min.z - eye.z, 0, eye.z - box.max.z)
        const flat = Math.sqrt(dx * dx + dz * dz)
        let cellReach = 0
        for (let kind = 0; kind < 4; kind++) if (cell.kinds & (1 << kind) && reach[kind] > cellReach) cellReach = reach[kind]
        const seen = flat <= cellReach && this.frustum.intersectsBox(box)
        const cellRadius = box.max.distanceTo(box.min) / 2
        box.getCenter(this.center)
        const castMid = (cell.kinds & CASTERS) !== 0 && this.casts(this.center, cellRadius, this.midReach)
        const cast = (cell.kinds & NEAR_CASTERS) !== 0 && this.casts(this.center, cellRadius, this.nearReach)
        if (!seen && !castMid && !cast) continue
        for (let i = cell.start; i < cell.end; i++) {
          const kind = kinds[i], s = i * 4
          sphere.center.set(ox + spheres[s], spheres[s + 1], oz + spheres[s + 2])
          sphere.radius = spheres[s + 3]
          const pools = this.poolsOf(models[i])
          if (seen) {
            const p = i * 3, bx = ox + bases[p] - eye.x, by = bases[p + 1] - eye.y, bz = oz + bases[p + 2] - eye.z
            const distance = Math.sqrt(bx * bx + by * by + bz * bz)
            let mask: number
            if (kind === SCATTER.tree) mask = (distance < treeFull ? 1 : 0) | (distance > treeMiddle && distance < treeEnd ? 2 : 0)
            else if (kind === SCATTER.fern) mask = (distance < fernFull ? 1 : 0) | (distance > fernMiddle && distance < fernEnd ? 2 : 0)
            else mask = distance < reach[kind] ? 1 : 0

            if (mask && (kind === SCATTER.tree || kind === SCATTER.large) && !this.frustum.intersectsSphere(sphere)) mask = 0
            for (let level = 0; mask; level++, mask >>= 1) {
              if (!(mask & 1)) continue
              const parts = pools.levels[level]
              if (parts) for (const pool of parts) pool.push(matrices, colors, i, ox, oz)
            }
          }
          if (castMid && (CASTERS & (1 << kind)) && this.casts(sphere.center, sphere.radius, this.midReach)) {
            for (const pool of this.midCastersOf(models[i], pools)) pool.push(matrices, colors, i, ox, oz)
          }
          if (cast && (NEAR_CASTERS & (1 << kind)) && this.casts(sphere.center, sphere.radius, this.nearReach)) {
            for (const pool of this.castersOf(models[i], pools)) pool.push(matrices, colors, i, ox, oz)
          }
        }
      }
    }
    for (const pool of this.pools) pool.finish()
  }

  dispose() {
    for (const pool of this.pools) pool.dispose()
    this.pools.length = 0
    this.main = new Map()
    this.casters = new Map()
    this.midCasters = new Map()
    this.resolved = new WeakMap()
    this.dirty = true
  }

  private casts(center: THREE.Vector3, radius: number, reach: number) {
    const { right, up } = SHADOW_BASIS, player = runtime.playerPosition
    const x = center.x - player.x, y = center.y - player.y, z = center.z - player.z
    const limit = reach + radius
    return Math.abs(x * right.x + y * right.y + z * right.z) <= limit && Math.abs(x * up.x + y * up.y + z * up.z) <= limit
  }

  private poolsOf(model: ScatterModel) {
    let result = this.resolved.get(model)
    if (!result) {
      result = { levels: model.levels.map((parts) => parts.map((part) => this.pool(part, 0))), shadow: null, midShadow: null }
      this.resolved.set(model, result)
    }
    return result
  }

  private castersOf(model: ScatterModel, resolved: Resolved) {
    return (resolved.shadow ??= model.shadow.map((part) => this.pool(part, SHADOW_LAYER)))
  }

  private midCastersOf(model: ScatterModel, resolved: Resolved) {
    return (resolved.midShadow ??= model.shadow.map((part) => this.pool(part, MID_SHADOW_LAYER)))
  }

  private pool(part: ModelPart, layer: number) {
    const registry = layer === SHADOW_LAYER ? this.casters : layer === MID_SHADOW_LAYER ? this.midCasters : this.main
    let byGeometry = registry.get(part.material)
    if (!byGeometry) registry.set(part.material, (byGeometry = new Map()))
    let pool = byGeometry.get(part.geometry)
    if (!pool) {
      pool = new Pool(part, layer, this.group)
      byGeometry.set(part.geometry, pool)
      this.pools.push(pool)
    }
    return pool
  }
}
