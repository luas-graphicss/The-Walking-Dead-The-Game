import * as THREE from 'three'
import type { MaterialKey } from '@/lib/game/blockout/types'
import { ALL_SHADOW_LAYERS, invalidateStillShadows } from '@/lib/game/shadow'
import { registerSkyOccluder } from '@/lib/game/sky/sky-occlusion'
import { seedOf, type BuiltInteraction, type BuiltStructure, type StructureRecord } from '@/lib/game/world/structure-streamer'
import { structureMaterial } from './structure-materials'

type Slot = { id: number; vertices: number; indices: number }
type Placement = { material: MaterialKey; geometryId: number; instanceId: number }
type CasterPlacement = { geometryId: number; instanceId: number }
type Placed = { parts: Placement[]; caster: CasterPlacement | null; fade: number; record: StructureRecord; pieces: Placement[]; interaction: BuiltInteraction | null }
export type PieceState = {
  pieceMatrix(seed: number, interaction: BuiltInteraction, piece: number, target: THREE.Matrix4): boolean
  pieceHidden(seed: number, interaction: BuiltInteraction, piece: number): boolean
}

const INITIAL_VERTICES = 32_768
const INITIAL_INSTANCES = 64

const MAX_SLACK = 4_096
const UP = new THREE.Vector3(0, 1, 0)
const WHITE = new THREE.Color(1, 1, 1)
type WithColors = { _colorsTexture: THREE.DataTexture | null }

const opaque = (fade: number) => fade > 0.999 && fade < 1.001

export type StructureMaterialFor = (key: MaterialKey, solid: boolean) => THREE.Material

class MaterialBatch {
  readonly mesh: THREE.BatchedMesh
  private readonly free: Slot[] = []
  private readonly used = new Map<number, Slot>()
  private vertexCapacity = INITIAL_VERTICES
  private indexCapacity = INITIAL_VERTICES * 2
  private instanceCapacity = INITIAL_INSTANCES
  private activeInstances = 0
  private nextVertex = 0
  private nextIndex = 0

  private readonly codes = new Map<number, number>()
  private fadingInstances = 0

  constructor(private readonly material: THREE.Material, private readonly caster = false, private readonly solidMaterial = material) {
    this.mesh = new THREE.BatchedMesh(INITIAL_INSTANCES, INITIAL_VERTICES, INITIAL_VERTICES * 2, solidMaterial)

    this.mesh.frustumCulled = false
    this.mesh.matrixAutoUpdate = false
    if (caster) {
      this.mesh.layers.mask = ALL_SHADOW_LAYERS
      this.mesh.castShadow = true
      this.mesh.receiveShadow = false

      this.mesh.sortObjects = false
      this.mesh.name = 'structures-shadow'
    } else {
      this.mesh.castShadow = false
      this.mesh.receiveShadow = true
      this.mesh.name = `structures-${material?.name || 'pool'}`
    }
  }

  place(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, fade: number) {
    const vertices = geometry.getAttribute('position').count, indices = geometry.getIndex()!.count
    let slot = this.takeFree(vertices, indices)
    if (slot) {
      this.mesh.setGeometryAt(slot.id, geometry)
    } else {
      if (this.nextVertex + vertices > this.vertexCapacity || this.nextIndex + indices > this.indexCapacity) this.makeRoom(vertices, indices)
      slot = { id: this.mesh.addGeometry(geometry), vertices, indices }
      this.nextVertex += vertices
      this.nextIndex += indices
    }
    this.used.set(slot.id, slot)
    if (this.activeInstances >= this.instanceCapacity) {
      this.instanceCapacity *= 2
      this.mesh.setInstanceCount(this.instanceCapacity)
    }
    const instanceId = this.mesh.addInstance(slot.id)
    this.mesh.setMatrixAt(instanceId, matrix)
    if (!this.caster) {

      this.mesh.setColorAt(instanceId, WHITE)
      this.setFade(instanceId, fade)
    }
    this.activeInstances++
    return { geometryId: slot.id, instanceId }
  }

  setFade(instanceId: number, fade: number) {
    this.track(instanceId, fade)
    const texture = (this.mesh as unknown as WithColors)._colorsTexture
    if (!texture) return
    const data = texture.image.data as Float32Array
    if (data[instanceId * 4 + 3] === Math.fround(fade)) return
    data[instanceId * 4 + 3] = fade
    texture.needsUpdate = true
  }

  release(placement: CasterPlacement) {
    this.mesh.deleteInstance(placement.instanceId)
    this.activeInstances--
    this.untrack(placement.instanceId)
    const slot = this.used.get(placement.geometryId)
    if (!slot) return
    this.used.delete(slot.id)
    this.free.push(slot)
  }

  get drawn() { return this.activeInstances }

  get fading() { return this.fadingInstances }

  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.dispose()
  }

  private track(instanceId: number, fade: number) {
    const previous = this.codes.get(instanceId)
    this.codes.set(instanceId, fade)
    this.fadingInstances += Number(!opaque(fade)) - Number(previous !== undefined && !opaque(previous))
    this.pickMaterial()
  }

  private untrack(instanceId: number) {
    const previous = this.codes.get(instanceId)
    if (previous === undefined) return
    this.codes.delete(instanceId)
    if (!opaque(previous)) this.fadingInstances--
    this.pickMaterial()
  }

  private pickMaterial() {
    const material = this.fadingInstances > 0 ? this.material : this.solidMaterial
    if (this.mesh.material !== material) this.mesh.material = material
  }

  private takeFree(vertices: number, indices: number) {
    let best = -1, bestWaste = Infinity
    for (let i = 0; i < this.free.length; i++) {
      const slot = this.free[i]
      if (slot.vertices < vertices || slot.indices < indices) continue
      const waste = slot.vertices - vertices
      if (waste > MAX_SLACK || waste >= bestWaste) continue
      bestWaste = waste
      best = i
    }
    return best < 0 ? null : this.free.splice(best, 1)[0]
  }

  private makeRoom(vertices: number, indices: number) {
    for (const slot of this.free) this.mesh.deleteGeometry(slot.id)
    this.free.length = 0
    this.mesh.optimize()
    let usedVertices = 0, usedIndices = 0
    for (const slot of this.used.values()) { usedVertices += slot.vertices; usedIndices += slot.indices }
    this.nextVertex = usedVertices
    this.nextIndex = usedIndices
    if (usedVertices + vertices <= this.vertexCapacity && usedIndices + indices <= this.indexCapacity) return
    while (usedVertices + vertices > this.vertexCapacity) this.vertexCapacity *= 2
    while (usedIndices + indices > this.indexCapacity) this.indexCapacity *= 2
    this.mesh.setGeometrySize(this.vertexCapacity, this.indexCapacity)
  }
}

const casterMaterial = new THREE.MeshBasicMaterial()

export class StructureBatcher {

  readonly group = new THREE.Group()
  private readonly batches = new Map<MaterialKey, MaterialBatch>()
  private casters: MaterialBatch | null = null
  private unregisterCasters: (() => void) | null = null

  private readonly placed = new Map<number, Placed>()
  private readonly matrix = new THREE.Matrix4()
  private readonly local = new THREE.Matrix4()
  private readonly composed = new THREE.Matrix4()
  pieceState: PieceState | null = null
  private readonly position = new THREE.Vector3()
  private readonly rotation = new THREE.Quaternion()
  private readonly unit = new THREE.Vector3(1, 1, 1)

  constructor(private readonly materialFor: StructureMaterialFor = structureMaterial) {
    this.group.matrixAutoUpdate = false
    this.group.name = 'detailed-structures'
  }

  sync(display: Map<number, number>, built: Map<number, BuiltStructure>, records: Map<number, StructureRecord>, origin: { x: number; z: number }) {
    for (const [key, entry] of this.placed) {
      if (display.has(key)) continue
      for (const part of entry.parts) this.batches.get(part.material)!.release(part)
      for (const piece of entry.pieces) this.batches.get(piece.material)!.release(piece)
      if (entry.caster) {
        this.casters!.release(entry.caster)
        invalidateStillShadows(entry.record.x, entry.record.z, entry.record.radius)
      }
      this.placed.delete(key)
    }
    for (const [key, fade] of display) {
      const entry = this.placed.get(key)
      if (entry) {
        if (entry.fade === fade) continue
        for (const part of entry.parts) this.batches.get(part.material)!.setFade(part.instanceId, fade)
        for (const piece of entry.pieces) this.batches.get(piece.material)!.setFade(piece.instanceId, fade)
        entry.fade = fade
        continue
      }
      const model = built.get(key), record = records.get(seedOf(key))
      if (!model || !record) continue
      this.compose(record, origin)
      const parts: Placement[] = []
      for (const part of model.groups) {
        const batch = this.batch(part.material)
        parts.push({ material: part.material, ...batch.place(part.geometry, this.matrix, fade) })
      }
      const interaction = model.interaction ?? null
      const pieces: Placement[] = []
      if (interaction) interaction.pieces.forEach((piece, index) => {
        const batch = this.batch(piece.material)
        const placement: Placement = { material: piece.material, ...batch.place(piece.geometry, this.pieceMatrix(record.seed, interaction, index), fade) }
        if (this.pieceState?.pieceHidden(record.seed, interaction, index)) batch.mesh.setVisibleAt(placement.instanceId, false)
        pieces.push(placement)
      })
      const caster = model.caster ? this.casterBatch().place(model.caster, this.matrix, 1) : null
      if (caster) invalidateStillShadows(record.x, record.z, record.radius)
      this.placed.set(key, { parts, caster, fade, record, pieces, interaction })
    }
  }

  refreshPiece(seed: number, index: number, origin: { x: number; z: number }) {
    for (const [key, entry] of this.placed) {
      const placement = entry.pieces[index]
      if (!placement || !entry.interaction || seedOf(key) !== seed) continue
      this.compose(entry.record, origin)
      const batch = this.batches.get(placement.material)!
      batch.mesh.setMatrixAt(placement.instanceId, this.pieceMatrix(seed, entry.interaction, index))
      batch.mesh.setVisibleAt(placement.instanceId, !this.pieceState?.pieceHidden(seed, entry.interaction, index))
    }
  }

  buildingMatrix(record: StructureRecord, origin: { x: number; z: number }, target: THREE.Matrix4) {
    this.compose(record, origin)
    return target.copy(this.matrix)
  }

  private pieceMatrix(seed: number, interaction: BuiltInteraction, index: number) {
    if (!this.pieceState?.pieceMatrix(seed, interaction, index, this.local)) return this.matrix
    return this.composed.multiplyMatrices(this.matrix, this.local)
  }

  rebase(records: Map<number, StructureRecord>, origin: { x: number; z: number }) {
    for (const [key, entry] of this.placed) {
      const record = records.get(seedOf(key))
      if (!record) continue
      this.compose(record, origin)
      for (const part of entry.parts) this.batches.get(part.material)!.mesh.setMatrixAt(part.instanceId, this.matrix)
      if (entry.interaction) for (const [index, piece] of entry.pieces.entries()) this.batches.get(piece.material)!.mesh.setMatrixAt(piece.instanceId, this.pieceMatrix(record.seed, entry.interaction, index))
      if (entry.caster) this.casters!.mesh.setMatrixAt(entry.caster.instanceId, this.matrix)
    }
  }

  get stats() {
    let instances = 0, fading = 0
    for (const batch of this.batches.values()) { instances += batch.drawn; fading += batch.fading }
    return { models: this.placed.size, pools: this.batches.size, instances, fading, casters: this.casters?.drawn ?? 0 }
  }

  dispose() {
    this.unregisterCasters?.()
    this.unregisterCasters = null
    for (const batch of [...this.batches.values(), ...(this.casters ? [this.casters] : [])]) { this.group.remove(batch.mesh); batch.dispose() }
    this.batches.clear()
    this.casters = null
    this.placed.clear()
  }

  private batch(material: MaterialKey) {
    let batch = this.batches.get(material)
    if (batch) return batch
    batch = new MaterialBatch(this.materialFor(material, false), false, this.materialFor(material, true))
    this.batches.set(material, batch)
    this.group.add(batch.mesh)
    return batch
  }

  private casterBatch() {
    if (!this.casters) {
      this.casters = new MaterialBatch(casterMaterial, true)
      this.group.add(this.casters.mesh)
      this.unregisterCasters = registerSkyOccluder(this.casters.mesh, 'solid')
    }
    return this.casters
  }

  private compose(record: StructureRecord, origin: { x: number; z: number }) {
    this.position.set(record.x - origin.x, record.y, record.z - origin.z)
    this.rotation.setFromAxisAngle(UP, record.yaw)
    this.matrix.compose(this.position, this.rotation, this.unit)
  }
}
