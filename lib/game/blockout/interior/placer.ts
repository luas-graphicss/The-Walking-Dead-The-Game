import { Euler, Quaternion, Vector3 } from 'three'
import { assetFor } from '../catalog'
import { buildAsset, type ModelBuilder } from '../model'
import { partQuaternion } from '../solid'
import { boxSeparation, pointInPartXZ } from '../validation'
import { partBounds, transformPoint, type AssetSpec, type BlockPart, type LootSocket, type StructureModel, type Vec3 } from '../types'
import type { Circulation } from './circulation'

export type Box2 = { x0: number; x1: number; z0: number; z1: number }
export type Box3 = Box2 & { y0: number; y1: number }
export type Placed = { spec: AssetSpec; parts: BlockPart[]; box: Box3; origin: Vec3; yaw: number; level: number; tipped: boolean; sockets: LootSocket[] }
export type PlaceRequest = {
  family: string
  variant?: number
  level: number

  base: number
  yaw: number

  origin?: [number, number]
  center?: [number, number]
  pitch?: number
  roll?: number

  gap?: number
  contact?: (part: BlockPart) => boolean

  floor?: boolean

  mount?: boolean
  keepOut?: boolean
  connect?: boolean
  burned?: boolean
  sockets?: boolean
}

const BURNABLE = new Set(['wood', 'fabric', 'paint', 'leather', 'straw', 'paper'])
const PASSIVE = new Set(['floor', 'foundation'])
const TOUCH = 0.0001

export function boundsOf(parts: BlockPart[]): Box3 {
  const box: Box3 = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity }
  for (const part of parts) {
    const b = partBounds(part)
    box.x0 = Math.min(box.x0, b.min[0]); box.x1 = Math.max(box.x1, b.max[0])
    box.y0 = Math.min(box.y0, b.min[1]); box.y1 = Math.max(box.y1, b.max[1])
    box.z0 = Math.min(box.z0, b.min[2]); box.z1 = Math.max(box.z1, b.max[2])
  }
  return box
}

export const overlaps2 = (a: Box2, b: Box2, pad = 0) => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad
const overlaps3 = (a: Box3, b: Box3, pad = 0) => overlaps2(a, b, pad) && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad

class PartIndex {
  private cells = new Map<number, number[]>()
  private parts: BlockPart[] = []
  private boxes: Box3[] = []
  private marks: number[] = []
  private stamp = 0
  private key(ix: number, iz: number) { return (ix + 4096) * 8192 + iz + 4096 }
  add(part: BlockPart) {
    const b = partBounds(part), box: Box3 = { x0: b.min[0], x1: b.max[0], y0: b.min[1], y1: b.max[1], z0: b.min[2], z1: b.max[2] }
    const id = this.parts.length
    this.parts.push(part); this.boxes.push(box); this.marks.push(0)
    for (let ix = Math.floor(box.x0); ix <= Math.floor(box.x1); ix++) for (let iz = Math.floor(box.z0); iz <= Math.floor(box.z1); iz++) {
      const k = this.key(ix, iz), list = this.cells.get(k)
      if (list) list.push(id); else this.cells.set(k, [id])
    }
  }
  query(box: Box3, pad = 0): { part: BlockPart; box: Box3 }[] {
    const out: { part: BlockPart; box: Box3 }[] = []
    this.stamp++
    for (let ix = Math.floor(box.x0 - pad); ix <= Math.floor(box.x1 + pad); ix++) for (let iz = Math.floor(box.z0 - pad); iz <= Math.floor(box.z1 + pad); iz++) {
      const list = this.cells.get(this.key(ix, iz))
      if (!list) continue
      for (const id of list) {
        if (this.marks[id] === this.stamp) continue
        this.marks[id] = this.stamp
        if (overlaps3(this.boxes[id], box, pad)) out.push({ part: this.parts[id], box: this.boxes[id] })
      }
    }
    return out
  }
}

export class Placer {
  readonly index = new PartIndex()
  readonly keepOut = new Map<number, Box3[]>()
  readonly circulation = new Map<number, Circulation>()
  readonly placed: Placed[] = []

  constructor(readonly b: ModelBuilder, readonly model: StructureModel) {
    for (const part of model.parts) this.index.add(part)
  }

  reserve(level: number, box: Box3) {
    const list = this.keepOut.get(level) ?? []
    list.push(box)
    this.keepOut.set(level, list)
  }

  floorAt(x: number, z: number, top: number) {
    return this.index.query({ x0: x, x1: x, z0: z, z1: z, y0: top - 0.02, y1: top + 0.02 }).some(({ part, box }) => PASSIVE.has(part.role) && Math.abs(box.y1 - top) < 0.006 && pointInPartXZ(part, x, z, -0.01))
  }

  private transform(parts: BlockPart[], origin: Vec3, yaw: number, pitch: number, roll: number, prefix: string): BlockPart[] {
    const id = (part: BlockPart) => ({ id: `${prefix}/${part.id}`, support: part.support ? `${prefix}/${part.support}` : undefined })
    if (!pitch && !roll) return parts.map((part) => ({ ...part, ...id(part), position: transformPoint(part.position, origin, yaw), yaw: part.yaw + yaw }))
    const q = new Quaternion().setFromEuler(new Euler(pitch, yaw, roll, 'YXZ')), o = new Vector3(...origin), euler = new Euler()
    return parts.map((part) => {
      const p = new Vector3(...part.position).applyQuaternion(q).add(o)
      euler.setFromQuaternion(q.clone().multiply(partQuaternion(part)), 'YXZ')
      return { ...part, ...id(part), position: p.toArray() as Vec3, yaw: euler.y, pitch: euler.x, roll: euler.z }
    })
  }

  place(r: PlaceRequest): Placed | null {
    const spec = assetFor(r.family, r.variant ?? 1), source = buildAsset(spec)
    const pitch = r.pitch ?? 0, roll = r.roll ?? 0, tipped = Boolean(pitch || roll)
    const prefix = `${this.model.id}/instance-${this.b.model.parts.length}`
    let parts = this.transform(source.parts, [0, 0, 0], r.yaw, pitch, roll, prefix)
    const local = boundsOf(parts)
    const origin: Vec3 = r.origin ? [r.origin[0], r.base - (tipped ? local.y0 : 0), r.origin[1]] : [r.center![0] - (local.x0 + local.x1) / 2, r.base - local.y0, r.center![1] - (local.z0 + local.z1) / 2]
    parts = parts.map((part) => ({ ...part, position: [part.position[0] + origin[0], part.position[1] + origin[1], part.position[2] + origin[2]] as Vec3 }))
    const box: Box3 = { x0: local.x0 + origin[0], x1: local.x1 + origin[0], y0: local.y0 + origin[1], y1: local.y1 + origin[1], z0: local.z0 + origin[2], z1: local.z1 + origin[2] }
    if (![box.x0, box.x1, box.y0, box.z0].every(Number.isFinite)) return null
    if (r.keepOut !== false) for (const zone of this.keepOut.get(r.level) ?? []) if (overlaps3(box, zone)) return null
    if (r.floor !== false) {
      const inset = 0.06, xs = [box.x0 + inset, (box.x0 + box.x1) / 2, box.x1 - inset], zs = [box.z0 + inset, (box.z0 + box.z1) / 2, box.z1 - inset]
      for (const x of xs) for (const z of zs) if (!this.floorAt(x, z, r.base)) return null
    }
    const gap = r.gap ?? 0.012
    let mounted = false
    for (const part of parts) {
      const pb = partBounds(part), pbox: Box3 = { x0: pb.min[0], x1: pb.max[0], y0: pb.min[1], y1: pb.max[1], z0: pb.min[2], z1: pb.max[2] }
      for (const { part: other, box: ob } of this.index.query(pbox, gap)) {
        const allowed = PASSIVE.has(other.role) || r.contact?.(other) || (r.mount && (other.role === 'wall' || other.role === 'column')) ? -TOUCH : gap
        const aabbGap = Math.max(ob.x0 - pbox.x1, pbox.x0 - ob.x1, ob.y0 - pbox.y1, pbox.y0 - ob.y1, ob.z0 - pbox.z1, pbox.z0 - ob.z1)
        if (aabbGap >= allowed && !(r.mount && aabbGap <= 0.001)) continue
        const separation = boxSeparation(part, other)
        if (separation < allowed) return null
        if (r.mount && (other.role === 'wall' || other.role === 'column') && separation <= 0.0008) mounted = true
      }
    }
    if (r.mount && !mounted) return null
    const circulation = this.circulation.get(r.level)
    if (r.connect !== false && circulation && !circulation.allows(parts)) return null

    if (r.burned) for (const part of parts) if (BURNABLE.has(part.material)) { part.material = 'charcoal'; part.surface = undefined }
    for (const part of parts) { this.b.model.parts.push(part); this.index.add(part) }
    const sockets: LootSocket[] = []
    if (!tipped && r.sockets !== false) for (const socket of source.sockets) {
      const placed = { ...socket, id: `${prefix}/${socket.id}`, support: `${prefix}/${socket.support}`, position: transformPoint(socket.position, origin, r.yaw) }
      this.b.model.sockets.push(placed); sockets.push(placed)
    }
    this.model.instances.push({ asset: spec.id, position: origin, yaw: r.yaw, level: r.level, prefix, burned: r.burned || undefined, ...(tipped ? { pitch, roll } : {}) })
    circulation?.commit(parts)
    const result: Placed = { spec, parts, box, origin, yaw: r.yaw, level: r.level, tipped, sockets }
    this.placed.push(result)
    return result
  }
}
