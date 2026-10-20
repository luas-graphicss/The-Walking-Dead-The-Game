import * as THREE from 'three'
import type { Vec3 } from '../blockout/types'
import { runtime } from '../runtime'
import { tierOf, type BuiltInteraction, type StructureRecord, type StructureStreamer } from '../world/structure-streamer'
import type { InteractableData, LeafData, PickupData } from '../world/structure.worker'

type PieceSink = { refreshPiece(seed: number, index: number, origin: { x: number; z: number }): void }
type Holder = { leaf: LeafData; key: string; opaque: boolean }
type Owner = { kind: 'leaf'; leaf: LeafData; key: string } | { kind: 'pickup'; pickup: PickupData; key: string; holder: Holder | null } | null

export type Building = { seed: number; record: StructureRecord; interaction: BuiltInteraction }
export type LeafRef = { building: Building; host: InteractableData; data: LeafData; interactable: number; index: number; key: string }
export type PickupRef = { building: Building; data: PickupData; index: number; key: string }
export type LeafMotion = { value: number; velocity: number; driven: boolean; settled: boolean; data: LeafData; seed: number; key: string }
export type StoredItem = { label: string; quantity: number; category: string }

const axis = new THREE.Vector3()
const pivot = new THREE.Vector3()
const moved = new THREE.Vector3()
const ahead = new THREE.Vector3()
const behind = new THREE.Vector3()
const SHUT = { door: 0.03, drawer: 0.012, lid: 0.03 }
const LATCH = 0.06
const GRAVITY = 9.81

export const leafKey = (seed: number, interactable: number, leaf: number) => `${seed}:${interactable}:${leaf}`
export const pickupKey = (seed: number, key: string) => `${seed}:${key}`

export function leafMatrix(data: LeafData, value: number, target: THREE.Matrix4) {
  const delta = value - data.initial
  if (Math.abs(delta) < 1e-5) return false
  if (data.kind === 'drawer') {
    target.makeTranslation(data.axis[0] * delta, data.axis[1] * delta, data.axis[2] * delta)
    return true
  }
  target.makeRotationAxis(axis.set(data.axis[0], data.axis[1], data.axis[2]), delta)
  pivot.set(data.pivot[0], data.pivot[1], data.pivot[2])
  moved.copy(pivot).applyMatrix4(target)
  target.setPosition(pivot.x - moved.x, pivot.y - moved.y, pivot.z - moved.z)
  return true
}

export function leafPoint(data: LeafData, value: number, point: Vec3, out: THREE.Vector3) {
  out.set(point[0], point[1], point[2])
  if (data.kind === 'drawer') return out.set(out.x + data.axis[0] * value, out.y + data.axis[1] * value, out.z + data.axis[2] * value)
  pivot.set(data.pivot[0], data.pivot[1], data.pivot[2])
  return out.sub(pivot).applyAxisAngle(axis.set(data.axis[0], data.axis[1], data.axis[2]), value).add(pivot)
}

export function leafDirection(data: LeafData, value: number, direction: Vec3, out: THREE.Vector3) {
  out.set(direction[0], direction[1], direction[2])
  return data.kind === 'drawer' ? out : out.applyAxisAngle(axis.set(data.axis[0], data.axis[1], data.axis[2]), value)
}

export function leafFront(data: LeafData, out: THREE.Vector3) {
  out.set(data.normal[0], 0, data.normal[2])
  if (data.kind === 'lid' && out.lengthSq() < 0.09) out.set(data.handle[0] - data.pivot[0], 0, data.handle[2] - data.pivot[2])
  return out.lengthSq() > 1e-8 ? out.normalize() : out.set(0, 0, 1)
}

export function lidAcceleration(data: LeafData, value: number) {
  const rise = (leafPoint(data, value + 0.01, data.center, ahead).y - leafPoint(data, value - 0.01, data.center, behind).y) / 0.02
  axis.set(data.axis[0], data.axis[1], data.axis[2]).normalize()
  moved.set(data.center[0] - data.pivot[0], data.center[1] - data.pivot[1], data.center[2] - data.pivot[2])
  const arm = Math.max(0.08, moved.addScaledVector(axis, -moved.dot(axis)).length())
  const pull = -0.75 * GRAVITY * rise / (arm * arm)
  return value < LATCH ? Math.min(pull, -40 * (LATCH - value) - 2) : pull
}

export function lidBalance(data: LeafData) {
  for (let value = LATCH; value < data.travel; value += 0.02) if (lidAcceleration(data, value) >= 0) return value
  return data.travel
}

export function toScene(record: StructureRecord, local: THREE.Vector3, out: THREE.Vector3) {
  const x = local.x, y = local.y, z = local.z
  return out.set(record.cos * x + record.sin * z + record.x - runtime.origin.x, y + record.y, -record.sin * x + record.cos * z + record.z - runtime.origin.z)
}

export function toSceneDirection(record: StructureRecord, local: THREE.Vector3, out: THREE.Vector3) {
  const x = local.x, y = local.y, z = local.z
  return out.set(record.cos * x + record.sin * z, y, -record.sin * x + record.cos * z)
}

export function toModel(record: StructureRecord, scene: THREE.Vector3, out: THREE.Vector3) {
  const dx = scene.x - (record.x - runtime.origin.x), dy = scene.y - record.y, dz = scene.z - (record.z - runtime.origin.z)
  return out.set(record.cos * dx - record.sin * dz, dy, record.sin * dx + record.cos * dz)
}

export function buildingMatrix(record: StructureRecord, target: THREE.Matrix4) {
  return target.set(
    record.cos, 0, record.sin, record.x - runtime.origin.x,
    0, 1, 0, record.y,
    -record.sin, 0, record.cos, record.z - runtime.origin.z,
    0, 0, 0, 1,
  )
}

export class InteractionWorld {
  batcher: PieceSink | null = null
  held: string | null = null
  readonly motions = new Map<string, LeafMotion>()
  readonly collected = new Set<string>()
  readonly distant = new Set<string>()
  readonly inventory = new Map<string, StoredItem>()
  private readonly owners = new WeakMap<BuiltInteraction, Owner[]>()
  private readonly contents = new Map<string, number[]>()
  private cache: Building[] = []
  private cacheVersion = -1

  constructor(readonly streamer: StructureStreamer) {}

  buildings() {
    if (this.cacheVersion === this.streamer.version) return this.cache
    const list: Building[] = []
    for (const [seed, key] of this.streamer.shown) {
      if (tierOf(key) !== 'full') continue
      const interaction = this.streamer.built.get(key)?.interaction, record = this.streamer.records.get(seed)
      if (interaction && record) list.push({ seed, record, interaction })
    }
    this.cache = list
    this.cacheVersion = this.streamer.version
    return list
  }

  pieceMatrix(seed: number, interaction: BuiltInteraction, piece: number, target: THREE.Matrix4) {
    const owner = this.ownersOf(seed, interaction)[piece]
    if (!owner) return false
    const leaf = owner.kind === 'leaf' ? owner : owner.pickup.attached ? owner.holder : null
    if (!leaf) return false
    const motion = this.motions.get(leaf.key)
    return motion ? leafMatrix(leaf.leaf, motion.value, target) : false
  }

  pieceHidden(seed: number, interaction: BuiltInteraction, piece: number) {
    const owner = this.ownersOf(seed, interaction)[piece]
    if (!owner || owner.kind !== 'pickup') return false
    if (this.collected.has(owner.key) || this.held === owner.key || this.distant.has(owner.key)) return true
    const holder = owner.holder
    return Boolean(holder && holder.opaque && this.leafValue(holder.key, holder.leaf) < SHUT[holder.leaf.kind])
  }

  leafValue(key: string, data: LeafData) {
    return this.motions.get(key)?.value ?? data.initial
  }

  motion(ref: LeafRef) {
    let motion = this.motions.get(ref.key)
    if (!motion) {
      motion = { value: ref.data.initial, velocity: 0, driven: false, settled: true, data: ref.data, seed: ref.building.seed, key: ref.key }
      this.motions.set(ref.key, motion)
    }
    return motion
  }

  drive(ref: LeafRef, value: number, velocity: number) {
    const motion = this.motion(ref)
    motion.value = THREE.MathUtils.clamp(value, 0, ref.data.travel)
    motion.velocity = velocity
    motion.driven = true
    motion.settled = false
    this.push(motion)
  }

  release(ref: LeafRef, velocity: number) {
    const motion = this.motion(ref)
    motion.driven = false
    motion.velocity = velocity
    motion.settled = false
  }

  step(dt: number) {
    for (const motion of this.motions.values()) {
      if (motion.driven || motion.settled) continue
      if (motion.data.kind === 'lid') {
        this.swing(motion, dt)
        continue
      }
      const door = motion.data.kind === 'door'
      motion.velocity *= Math.exp(-(door ? 2.3 : 7.5) * dt)
      motion.value += motion.velocity * dt
      if (motion.value > motion.data.travel) {
        motion.value = motion.data.travel
        motion.velocity = -Math.abs(motion.velocity) * (door ? 0.2 : 0.1)
      } else if (motion.value < 0) {
        motion.value = 0
        motion.velocity = Math.abs(motion.velocity) * (door ? 0.12 : 0.06)
      }
      if (Math.abs(motion.velocity) < (door ? 0.015 : 0.003)) {
        motion.velocity = 0
        motion.settled = true
      }
      this.push(motion)
    }
  }

  accessible(ref: PickupRef) {
    if (ref.data.leaf < 0) return true
    const leaf = ref.building.interaction.interactables[ref.data.interactable]?.leaves[ref.data.leaf]
    if (!leaf) return true
    const value = this.leafValue(leafKey(ref.building.seed, ref.data.interactable, ref.data.leaf), leaf)
    return leaf.kind === 'drawer' ? value > leaf.travel * 0.45 : value > 0.8
  }

  pickupPosition(ref: PickupRef, out: THREE.Vector3) {
    const { data } = ref
    const leaf = data.attached ? ref.building.interaction.interactables[data.interactable]?.leaves[data.leaf] : undefined
    if (leaf) leafPoint(leaf, this.leafValue(leafKey(ref.building.seed, data.interactable, data.leaf), leaf), data.position, out)
    else out.set(data.position[0], data.position[1], data.position[2])
    return toScene(ref.building.record, out, out)
  }

  hold(ref: PickupRef) {
    this.held = ref.key
    this.refresh(ref)
  }

  drop(ref: PickupRef) {
    if (this.held !== ref.key) return
    this.held = null
    this.refresh(ref)
  }

  collect(ref: PickupRef) {
    this.collected.add(ref.key)
    if (this.held === ref.key) this.held = null
    const stored = this.inventory.get(ref.data.resource)
    if (stored) stored.quantity += ref.data.quantity
    else this.inventory.set(ref.data.resource, { label: ref.data.label, quantity: ref.data.quantity, category: ref.data.category })
    this.refresh(ref)
  }

  refresh(ref: PickupRef) {
    for (const piece of ref.data.pieces) this.batcher?.refreshPiece(ref.building.seed, piece, runtime.origin)
  }

  private swing(motion: LeafMotion, dt: number) {
    const data = motion.data, steps = Math.max(1, Math.ceil(dt / 0.008)), slice = dt / steps
    for (let i = 0; i < steps; i++) {
      motion.velocity = (motion.velocity + lidAcceleration(data, motion.value) * slice) * Math.exp(-1.4 * slice)
      motion.value += motion.velocity * slice
      if (motion.value > data.travel) {
        motion.value = data.travel
        motion.velocity = -Math.abs(motion.velocity) * 0.22
      } else if (motion.value < 0) {
        motion.value = 0
        motion.velocity = Math.abs(motion.velocity) * 0.16
      }
    }
    const pull = lidAcceleration(data, motion.value)
    const resting = (motion.value < 1e-3 && pull <= 0) || (motion.value > data.travel - 1e-3 && pull >= 0)
    if (resting && Math.abs(motion.velocity) < 0.06) {
      motion.velocity = 0
      motion.value = motion.value < 1e-3 ? 0 : data.travel
      motion.settled = true
    }
    this.push(motion)
  }

  private push(motion: LeafMotion) {
    for (const piece of motion.data.pieces) this.batcher?.refreshPiece(motion.seed, piece, runtime.origin)
    for (const piece of this.contents.get(motion.key) ?? []) this.batcher?.refreshPiece(motion.seed, piece, runtime.origin)
  }

  private ownersOf(seed: number, interaction: BuiltInteraction) {
    let owners = this.owners.get(interaction)
    if (!owners) {
      const list: Owner[] = new Array(interaction.pieces.length).fill(null)
      const contents = new Map<string, number[]>()
      interaction.interactables.forEach((host, h) => host.leaves.forEach((leaf, l) => { for (const piece of leaf.pieces) list[piece] = { kind: 'leaf', leaf, key: leafKey(seed, h, l) } }))
      for (const pickup of interaction.pickups) {
        const leaf = pickup.leaf >= 0 ? interaction.interactables[pickup.interactable]?.leaves[pickup.leaf] : undefined
        const holder: Holder | null = leaf ? { leaf, key: leafKey(seed, pickup.interactable, pickup.leaf), opaque: !leaf.sheer && !leaf.pieces.some((piece) => interaction.pieces[piece]?.material === 'glass') } : null
        if (holder) contents.set(holder.key, [...(contents.get(holder.key) ?? []), ...pickup.pieces])
        for (const piece of pickup.pieces) list[piece] = { kind: 'pickup', pickup, key: pickupKey(seed, pickup.key), holder }
      }
      for (const [key, pieces] of contents) this.contents.set(key, pieces)
      this.owners.set(interaction, list)
      owners = list
    }
    return owners
  }
}

let active: InteractionWorld | null = null
export const setInteractionWorld = (world: InteractionWorld | null) => { active = world }
export const interactionWorld = () => active
