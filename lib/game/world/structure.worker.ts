import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three'
import { buildStructure } from '../blockout/assemble'
import { ASSET_BY_ID } from '../blockout/catalog'
import { damageColliders } from '../blockout/damage'
import { compileGeometry } from '../blockout/geometry'
import { hasSculpt, sculptGroups, sculptLeaves } from '../blockout/sculpt'
import type { SculptBucket } from '../blockout/sculpt/kit'
import { simplifiedSculpt, simplifierReady } from '../blockout/sculpt/simplify'
import { partQuaternion } from '../blockout/solid'
import { hash, random, type BlockPart, type Condition, type Instance, type LootSocket, type MaterialKey, type StructureModel, type Vec3 } from '../blockout/types'
import { buildResourceModel } from '../resources/models'
import { resourceAssetId } from '../resources/sculpts'
import { generateStructureLoot } from '../resources/spawn'
import { CATEGORY_LABELS, type Rarity, type Resource, type ResourceStack } from '../resources/types'
import { STRUCTURE_SCALE, type Quality } from './settings'
import { scaleStructure } from './structure-scale'

export type Tier = 'full' | 'shell' | 'proxy'
export type StructureRequest = { id: number; blueprint: string; seed: number; condition: Condition; tier: Tier; quality?: Quality }
export type StructureGroup = { material: MaterialKey; positions: Float32Array; normals: Float32Array; uvs: Float32Array; colors: Float32Array; indices: Uint32Array }

export type StructureCaster = { positions: Float32Array; indices: Uint32Array }

export type StructurePiece = { material: MaterialKey; positions: Float32Array; normals: Float32Array; uvs: Float32Array; colors: Float32Array; indices: Uint32Array }
export type LeafData = { kind: 'door' | 'drawer' | 'lid'; pivot: Vec3; axis: Vec3; travel: number; initial: number; handle: Vec3; normal: Vec3; up: Vec3; center: Vec3; width: number; height: number; depth: number; floor: Vec3; sheer?: boolean; pieces: number[] }
export type InteractableData = { asset: string; label: string; center: Vec3; leaves: LeafData[] }
export type PickupData = { key: string; resource: string; label: string; quantity: number; rarity: Rarity; category: string; position: Vec3; yaw: number; scale: number; size: Vec3; interactable: number; leaf: number; attached: boolean; pieces: number[] }
export type StructureInteraction = { pieces: StructurePiece[]; interactables: InteractableData[]; pickups: PickupData[] }
export type StructureResult = { id: number; groups: StructureGroup[]; boxes: Float32Array; triangles: number; ms: number; caster: StructureCaster | null; interaction: StructureInteraction | null }
export type StructureReply = { kind: 'done'; result: StructureResult } | { kind: 'error'; id: number; message: string }

const scope = self as unknown as {
  onmessage: (event: MessageEvent<StructureRequest>) => void
  postMessage: (message: StructureReply, transfer?: Transferable[]) => void
}

function solid(part: BlockPart) {
  if (part.detail || part.role === 'resource' || part.role === 'debris') return false
  if (part.role === 'roof') return part.primitive !== 'cylinder' && part.primitive !== 'cone'
  if (part.role === 'fixture') return Math.max(...part.size) > 0.45 && part.size[1] > 0.3
  return true
}

function covered(point: Vec3, covers: BlockPart[]) {
  for (const cover of covers) {
    if (cover.position[1] <= point[1] + 0.3) continue
    const dx = point[0] - cover.position[0], dz = point[2] - cover.position[2]
    const c = Math.cos(cover.yaw), s = Math.sin(cover.yaw)
    if (Math.abs(dx * c - dz * s) <= cover.size[0] / 2 && Math.abs(dx * s + dz * c) <= cover.size[2] / 2) return true
  }
  return false
}

const SCULPT_ERROR: Record<Tier, number> = { full: 0.005, shell: 0.015, proxy: 0.04 }

const SCULPT_BUDGET: Record<Tier, number> = { full: 12_000, shell: 3_000, proxy: 800 }

const LIGHT_SCULPT_ERROR: Record<Tier, number> = { full: 0.01, shell: 0.02, proxy: 0.04 }
const LIGHT_SCULPT_BUDGET: Record<Tier, number> = { full: 4_000, shell: 2_000, proxy: 800 }

const LIGHT_SCULPT_CAP: Record<Tier, number> = { full: 110_000, shell: 40_000, proxy: Infinity }

function sculptTriangles(placements: { asset: string }[], error: number, budget: number) {
  let total = 0
  for (const { asset } of placements) for (const bucket of simplifiedSculpt(asset, error, budget) ?? []) total += bucket.index.length / 3
  return total
}

function fitSculpts(placements: { asset: string }[], error: number, budget: number, cap: number) {
  for (let step = 0; step < 5 && sculptTriangles(placements, error, budget) > cap; step++) {
    error *= 1.6
    budget = Math.max(400, Math.round(budget * 0.6))
  }
  return { error, budget }
}

function casterParts(parts: BlockPart[], tier: Tier, indoorOwner: (part: BlockPart) => boolean) {
  const result: BlockPart[] = []
  for (const part of parts) {
    if (part.role === 'resource') continue
    if (part.role === 'debris' && Math.max(...part.size) < 0.3) continue
    if (tier !== 'full' && indoorOwner(part)) continue
    if (!part.detail) { result.push(part); continue }
    const sorted = [...part.size].sort((a, b) => b - a)

    if (sorted[0] >= 0.25 && sorted[1] >= 0.06) result.push({ ...part, detail: false })
  }
  return result
}

const DECOR_CASTER_ERROR = SCULPT_ERROR.shell
const DECOR_CASTER_BUDGET = SCULPT_BUDGET.shell
const decorCasterSource = (id: string) => simplifiedSculpt(id, DECOR_CASTER_ERROR, DECOR_CASTER_BUDGET)

function mergeCaster(geometries: BufferGeometry[]): StructureCaster | null {
  let vertices = 0, indexCount = 0
  for (const geometry of geometries) {
    vertices += geometry.getAttribute('position').count
    indexCount += geometry.getIndex()?.count ?? geometry.getAttribute('position').count
  }
  if (!vertices) return null
  const positions = new Float32Array(vertices * 3), indices = new Uint32Array(indexCount)
  let vo = 0, io = 0
  for (const geometry of geometries) {
    const position = geometry.getAttribute('position'), index = geometry.getIndex()
    positions.set(position.array as Float32Array, vo * 3)
    if (index) for (let i = 0; i < index.count; i++) indices[io + i] = index.getX(i) + vo
    else for (let i = 0; i < position.count; i++) indices[io + i] = i + vo
    io += index?.count ?? position.count
    vo += position.count
  }
  return { positions, indices }
}

function envelope(part: BlockPart) {
  if (part.detail || part.role === 'resource' || part.role === 'debris' || part.role === 'stairs') return false
  if (part.role === 'floor' && part.level > 0) return false
  if (part.id.includes('room-partition')) return false
  const sorted = [...part.size].sort((a, b) => b - a)
  return sorted[0] >= 0.3 && sorted[1] >= 0.09
}

type Spot = { center: Vec3; across: Vec3; deep: Vec3; width: number; depth: number; height: number }
type Placed = { position: Vec3; yaw: number; scale: number; size: Vec3 }
type InteractionInput = {
  raw: StructureModel; model: StructureModel; interactive: Instance[]; props: Map<Instance, LootSocket>
  source: (id: string) => SculptBucket[] | null; itemSource: (id: string) => SculptBucket[] | null; ownerOf: (id: string) => Instance | undefined; seed: number
}

function placementOf(instance: Instance) {
  const rotation = new Quaternion().setFromEuler(new Euler(instance.pitch ?? 0, instance.yaw, instance.roll ?? 0, 'YXZ'))
  const scale = instance.scale ?? 1
  return { rotation, scale, matrix: new Matrix4().compose(new Vector3(...instance.position), rotation, new Vector3(scale, scale, scale)) }
}

const applyPoint = (matrix: Matrix4, v: Vec3): Vec3 => {
  const p = new Vector3(v[0], v[1], v[2]).applyMatrix4(matrix)
  return [p.x, p.y, p.z]
}

const applyTurn = (rotation: Quaternion, v: Vec3): Vec3 => {
  const p = new Vector3(v[0], v[1], v[2]).applyQuaternion(rotation).normalize()
  return [p.x, p.y, p.z]
}

const crossOf = (a: Vec3, b: Vec3): Vec3 => {
  const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0], length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

function toPiece(group: { material: MaterialKey; geometry: BufferGeometry }): StructurePiece {
  const geometry = group.geometry, index = geometry.getIndex(), count = geometry.getAttribute('position').count
  const piece: StructurePiece = {
    material: group.material,
    positions: new Float32Array(geometry.getAttribute('position').array),
    normals: new Float32Array(geometry.getAttribute('normal').array),
    uvs: new Float32Array(geometry.getAttribute('uv').array),
    colors: new Float32Array(geometry.getAttribute('color').array),
    indices: index ? new Uint32Array(index.array) : Uint32Array.from({ length: count }, (_, i) => i),
  }
  geometry.dispose()
  return piece
}

function sizeOf(resource: Resource): Vec3 {
  if (resource.model.status === 'pronto') return ASSET_BY_ID.get(`${resource.model.family}-1`)?.size ?? [0.16, 0.12, 0.16]
  return resource.model.size
}

const ITEM_AXIS = new Vector3(0, 1, 0)

function itemGroups(resource: Resource, position: Vec3, yaw: number, scale: number, source: (id: string) => SculptBucket[] | null) {
  const asset = resource.model.status === 'pronto' ? `${resource.model.family}-1` : resourceAssetId(resource.id)
  if (hasSculpt(asset)) return sculptGroups([{ asset, position, yaw, scale }], source)
  const groups = compileGeometry(buildResourceModel(resource).parts, 'lite')
  const matrix = new Matrix4().compose(new Vector3(position[0], position[1], position[2]), new Quaternion().setFromAxisAngle(ITEM_AXIS, yaw), new Vector3(scale, scale, scale))
  for (const group of groups) group.geometry.applyMatrix4(matrix)
  return groups
}

function surfaceBelow(buckets: SculptBucket[], x: number, top: number, z: number, reach: number) {
  let best = -Infinity
  for (const bucket of buckets) {
    const p = bucket.position, index = bucket.index
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3
      const ax = p[a], az = p[a + 2], bx = p[b], bz = p[b + 2], cx = p[c], cz = p[c + 2]
      if (x < Math.min(ax, bx, cx) || x > Math.max(ax, bx, cx) || z < Math.min(az, bz, cz) || z > Math.max(az, bz, cz)) continue
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
      if (Math.abs(det) < 1e-12) continue
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det, w = 1 - u - v
      if (u < 0 || v < 0 || w < 0) continue
      const y = u * p[a + 1] + v * p[b + 1] + w * p[c + 1]
      if (y > top || y < top - reach || y <= best) continue
      const e1x = bx - ax, e1y = p[b + 1] - p[a + 1], e1z = bz - az, e2x = cx - ax, e2y = p[c + 1] - p[a + 1], e2z = cz - az
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x
      if (ny <= 0.4 * Math.hypot(nx, ny, nz)) continue
      best = y
    }
  }
  return best
}

const OPENINGS: Vec3[] = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0.7071, 0.7071, 0], [-0.7071, 0.7071, 0], [0, 0.7071, 0.7071], [0, 0.7071, -0.7071]]

function escapes(buckets: SculptBucket[], o: Vec3, d: Vec3) {
  for (const bucket of buckets) {
    const p = bucket.position, index = bucket.index
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3
      const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2], e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2]
      const hx = d[1] * e2z - d[2] * e2y, hy = d[2] * e2x - d[0] * e2z, hz = d[0] * e2y - d[1] * e2x
      const det = e1x * hx + e1y * hy + e1z * hz
      if (Math.abs(det) < 1e-12) continue
      const f = 1 / det, sx = o[0] - p[a], sy = o[1] - p[a + 1], sz = o[2] - p[a + 2]
      const u = f * (sx * hx + sy * hy + sz * hz)
      if (u < 0 || u > 1) continue
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x
      const v = f * (d[0] * qx + d[1] * qy + d[2] * qz)
      if (v < 0 || u + v > 1) continue
      if (f * (e2x * qx + e2y * qy + e2z * qz) > 1e-4) return false
    }
  }
  return true
}

function concealing(interactable: InteractableData, at: Vec3, concealed: boolean, swinging = false) {
  let best = -1, score = Infinity
  interactable.leaves.forEach((leaf, index) => {
    if (swinging && leaf.kind === 'drawer') return
    const across = crossOf(leaf.up, leaf.normal)
    const dx = at[0] - leaf.center[0], dy = at[1] - leaf.center[1], dz = at[2] - leaf.center[2]
    if (dx * leaf.normal[0] + dy * leaf.normal[1] + dz * leaf.normal[2] > (leaf.kind === 'lid' ? 0.005 - leaf.depth / 2 : 0.04)) return
    const along = dx * across[0] + dy * across[1] + dz * across[2], lift = dx * leaf.up[0] + dy * leaf.up[1] + dz * leaf.up[2]
    const miss = Math.max(0, Math.abs(along) - leaf.width / 2) + Math.max(0, Math.abs(lift) - leaf.height / 2)
    if (miss < score) { score = miss; best = index }
  })
  return best >= 0 && score < (concealed ? 0.45 : 0.01) ? best : -1
}

function arrange(items: ResourceStack[], spot: Spot, seed: number): Placed[] {
  const rng = random(seed)
  const base = Math.atan2(-spot.across[2], spot.across[0])
  const fits = items.map(({ resource }) => {
    const [w, h, d] = sizeOf(resource)
    const long = Math.max(w, d), short = Math.min(w, d), lengthwise = long <= spot.depth
    const across = lengthwise ? short : long, deep = lengthwise ? long : short
    const scale = Math.min(1, spot.height / Math.max(h, 1e-3), spot.depth / Math.max(deep, 1e-3), spot.width / Math.max(across, 1e-3))
    return { w, h, d, across, deep, turned: lengthwise ? w > d : d > w, scale: Math.max(0.35, scale) }
  })
  const gap = 0.035
  const occupied = () => fits.reduce((sum, fit) => sum + fit.across * fit.scale, 0) + gap * (fits.length - 1)
  if (occupied() > spot.width) {
    const squeeze = Math.max(0.6, spot.width / occupied())
    for (const fit of fits) fit.scale = Math.max(0.35, fit.scale * squeeze)
  }
  const solid = fits.reduce((sum, fit) => sum + fit.across * fit.scale, 0)
  const span = Math.min(occupied(), Math.max(spot.width, solid))
  const spacing = fits.length > 1 ? (span - solid) / (fits.length - 1) : 0
  let cursor = -span / 2
  return fits.map((fit) => {
    const width = fit.across * fit.scale, offset = cursor + width / 2
    cursor += width + spacing
    const shift = (rng() - 0.5) * Math.max(0, spot.depth - fit.deep * fit.scale) * 0.5
    return {
      position: [
        spot.center[0] + spot.across[0] * offset + spot.deep[0] * shift,
        spot.center[1] + spot.across[1] * offset + spot.deep[1] * shift,
        spot.center[2] + spot.across[2] * offset + spot.deep[2] * shift,
      ],
      yaw: base + (fit.turned ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.35,
      scale: fit.scale,
      size: [fit.w * fit.scale, fit.h * fit.scale, fit.d * fit.scale],
    }
  })
}

function interactionOf({ raw, model, interactive, props, source, itemSource, ownerOf, seed }: InteractionInput): StructureInteraction {
  const pieces: StructurePiece[] = []
  const interactables: InteractableData[] = []
  const pickups: PickupData[] = []
  const hosts = new Map<Instance, number>()
  const add = (groups: { material: MaterialKey; geometry: BufferGeometry }[]) => groups.map((group) => pieces.push(toPiece(group)) - 1)
  for (const instance of interactive) {
    const { matrix, rotation, scale } = placementOf(instance)
    const leaves: LeafData[] = []
    sculptLeaves(instance.asset).forEach((leaf, n) => {
      const ids = add(sculptGroups([instance], (id) => source(id)?.filter((bucket) => bucket.leaf === n + 1) ?? null))
      if (!ids.length) return
      const linear = leaf.kind === 'drawer' ? scale : 1
      leaves.push({
        kind: leaf.kind, pivot: applyPoint(matrix, leaf.pivot), axis: applyTurn(rotation, leaf.axis), travel: leaf.travel * linear, initial: leaf.initial * linear,
        handle: applyPoint(matrix, leaf.handle), normal: applyTurn(rotation, leaf.normal), up: applyTurn(rotation, leaf.up), center: applyPoint(matrix, leaf.center),
        width: leaf.width * scale, height: leaf.height * scale, depth: leaf.depth * scale, floor: applyPoint(matrix, leaf.floor), sheer: leaf.sheer, pieces: ids,
      })
    })
    if (!leaves.length) continue
    const spec = ASSET_BY_ID.get(instance.asset)
    hosts.set(instance, interactables.length)
    interactables.push({ asset: instance.asset, label: spec?.label.split(' · ')[0] ?? 'Móvel', center: applyPoint(matrix, [0, (spec?.size[1] ?? 1) / 2, 0]), leaves })
  }
  const propPieces = new Map<Instance, number[]>()
  for (const instance of props.keys()) {
    const groups = hasSculpt(instance.asset) ? sculptGroups([instance], source) : compileGeometry(model.parts.filter((part) => ownerOf(part.id) === instance), 'lite')
    propPieces.set(instance, add(groups))
  }
  const before = new Map(raw.parts.map((part) => [part.id, part])), after = new Map(model.parts.map((part) => [part.id, part]))
  const located = (socket: LootSocket): Vec3 => {
    const a = before.get(socket.support), b = after.get(socket.support), p = socket.position
    if (!a || !b) return [p[0] * STRUCTURE_SCALE, p[1] * STRUCTURE_SCALE, p[2] * STRUCTURE_SCALE]
    if (Math.abs(a.size[0] - b.size[0]) < 1e-6 && Math.abs(a.size[1] - b.size[1]) < 1e-6) return [p[0] + b.position[0] - a.position[0], p[1] + b.position[1] - a.position[1], p[2] + b.position[2] - a.position[2]]
    const k = b.size[0] / Math.max(a.size[0], 1e-6)
    return [p[0] * k, p[1] * k, p[2] * k]
  }
  const ground = (instance: Instance | undefined, x: number, y: number, z: number) => {
    if (!instance || instance.pitch || instance.roll || !hasSculpt(instance.asset)) return y
    const buckets = source(instance.asset)
    if (!buckets) return y
    const scale = instance.scale ?? 1, c = Math.cos(instance.yaw), s = Math.sin(instance.yaw)
    const dx = (x - instance.position[0]) / scale, dz = (z - instance.position[2]) / scale
    const hit = surfaceBelow(buckets, c * dx - s * dz, (y - instance.position[1]) / scale + 0.12, s * dx + c * dz, 0.9)
    return hit === -Infinity ? y : instance.position[1] + hit * scale
  }
  const trapped = (instance: Instance | undefined, x: number, y: number, z: number) => {
    if (!instance || instance.pitch || instance.roll || !hasSculpt(instance.asset)) return false
    const buckets = source(instance.asset)
    if (!buckets) return false
    const scale = instance.scale ?? 1, c = Math.cos(instance.yaw), s = Math.sin(instance.yaw)
    const dx = (x - instance.position[0]) / scale, dz = (z - instance.position[2]) / scale
    const at: Vec3 = [c * dx - s * dz, (y - instance.position[1]) / scale, s * dx + c * dz]
    return !OPENINGS.some((direction) => escapes(buckets, at, direction))
  }
  for (const { socket, items } of generateStructureLoot(model, seed)) {
    if (!items.length) continue
    const prop = socket.prop ? ownerOf(socket.support) : undefined
    if (prop && props.get(prop) === socket) {
      const [{ resource, quantity }] = items
      pickups.push({
        key: `${socket.id}#0`, resource: resource.id, label: resource.label, quantity, rarity: resource.rarity, category: CATEGORY_LABELS[resource.category],
        position: [prop.position[0], prop.position[1], prop.position[2]], yaw: prop.yaw, scale: 1, size: ASSET_BY_ID.get(prop.asset)?.size ?? sizeOf(resource),
        interactable: -1, leaf: -1, attached: false, pieces: propPieces.get(prop) ?? [],
      })
      continue
    }
    const at = located(socket), owner = ownerOf(socket.support), host = owner ? hosts.get(owner) : undefined
    const leaf = host === undefined ? -1 : concealing(interactables[host], at, socket.concealed)
    const holder = host !== undefined && leaf >= 0 ? interactables[host].leaves[leaf] : undefined
    const drawer = holder?.kind === 'drawer'
    const support = after.get(socket.support)
    let spot: Spot
    if (holder && drawer) {
      spot = {
        center: holder.floor, across: crossOf(holder.up, holder.normal), deep: [-holder.normal[0], -holder.normal[1], -holder.normal[2]],
        width: Math.max(0.06, holder.width - 0.08), depth: Math.max(0.06, holder.depth - 0.05), height: Math.max(0.03, holder.height - 0.035),
      }
    } else {
      const yaw = support?.yaw ?? owner?.yaw ?? 0
      spot = {
        center: at, across: [Math.cos(yaw), 0, -Math.sin(yaw)], deep: [Math.sin(yaw), 0, Math.cos(yaw)],
        width: Math.max(0.12, (support?.size[0] ?? 0.4) - 0.06), depth: Math.max(0.1, (support?.size[2] ?? 0.3) - 0.06), height: leaf >= 0 ? 0.45 : 1.2,
      }
    }
    const settle = (area: Spot) => arrange(items, area, hash(socket.id)).map((placed) => {
      let y = drawer ? placed.position[1] : ground(owner, placed.position[0], placed.position[1], placed.position[2])
      if (!holder && socket.concealed && owner && trapped(owner, placed.position[0], y + Math.min(placed.size[1] / 2, 0.05), placed.position[2])) y = ground(owner, placed.position[0], owner.position[1] + (ASSET_BY_ID.get(owner.asset)?.size[1] ?? 0) * (owner.scale ?? 1), placed.position[2])
      const position: Vec3 = [placed.position[0], y, placed.position[2]]
      return { placed, position, behind: drawer || host === undefined ? leaf : concealing(interactables[host], [position[0], y + Math.min(placed.size[1] / 2, 0.05), position[2]], false, true) }
    })
    let settled = settle(spot)
    if (holder && !drawer && socket.concealed && settled.some((item) => item.behind < 0)) {
      const lid = Math.abs(holder.normal[1]) > 0.7
      settled = settle({
        center: holder.floor, across: crossOf(holder.up, holder.normal), deep: lid ? holder.up : [-holder.normal[0], -holder.normal[1], -holder.normal[2]],
        width: Math.max(0.06, holder.width - 0.08), depth: lid ? Math.max(0.06, holder.height - 0.08) : Math.max(0.06, Math.min(0.32, (support?.size[2] ?? 0.4) - 0.12)),
        height: lid ? 0.3 : Math.max(0.05, Math.min(0.45, holder.height - 0.05)),
      }).map((item) => item.behind < 0 ? { ...item, behind: leaf } : item)
    }
    settled.forEach(({ placed, position, behind }, index) => {
      const { resource, quantity } = items[index]
      pickups.push({
        key: `${socket.id}#${index}`, resource: resource.id, label: resource.label, quantity, rarity: resource.rarity, category: CATEGORY_LABELS[resource.category],
        position, yaw: placed.yaw, scale: placed.scale, size: placed.size,
        interactable: host ?? -1, leaf: behind, attached: drawer, pieces: add(itemGroups(resource, position, placed.yaw, placed.scale, itemSource)),
      })
    })
  }
  return { pieces, interactables, pickups }
}

scope.onmessage = async ({ data }) => {
  const started = performance.now()
  try {
    await simplifierReady
    const raw = buildStructure(data.blueprint, data.seed, { condition: data.condition })
    const model = scaleStructure(raw)
    const covers = model.parts.filter((part) => part.role === 'roof' || part.role === 'floor')
    const owners = new Map<string, Instance>()
    for (const instance of model.instances) if (instance.prefix) owners.set(instance.prefix, instance)

    const ownerOfId = (id: string) => {
      for (let i = id.indexOf('/'); i >= 0; i = id.indexOf('/', i + 1)) {
        const owner = owners.get(id.slice(0, i))
        if (owner) return owner
      }
      return undefined
    }
    const ownerOf = (part: BlockPart) => ownerOfId(part.id)
    const full = data.tier === 'full'
    const props = new Map<Instance, LootSocket>()
    if (full) for (const socket of model.sockets) {
      const owner = socket.prop ? ownerOfId(socket.support) : undefined
      if (owner && !props.has(owner)) props.set(owner, socket)
    }
    const indoor = new Map<Instance, boolean>()
    const isIndoor = (instance: Instance) => {
      let value = indoor.get(instance)
      if (value === undefined) { value = covered(instance.position, covers); indoor.set(instance, value) }
      return value
    }

    const light = data.quality === 'low'
    const indoorFurniture = (part: BlockPart) => {
      const owner = ownerOf(part)
      return Boolean(owner && ASSET_BY_ID.get(owner.asset)?.category !== 'Arquitetura' && isIndoor(owner))
    }

    const unseenIndoors = (part: BlockPart) => light && data.tier === 'shell' && (part.detail || Math.max(...part.size) < 0.25) && indoorFurniture(part)

    const collidable: BlockPart[] = []
    const rendered: BlockPart[] = []
    let sculpted: Instance[] = []
    let decor: Instance[] = []

    const sculpts = (instance: Instance) => hasSculpt(instance.asset) && (data.tier === 'full' || !isIndoor(instance))
    if (data.tier === 'proxy') {
      for (const part of model.parts) if (envelope(part) && !ownerOf(part)) rendered.push(part)
    } else {
      for (const part of model.parts) {
        if (data.tier === 'shell' && part.role === 'resource') continue
        const owner = ownerOf(part)
        collidable.push(part)

        if ((!owner || (!sculpts(owner) && !props.has(owner))) && !unseenIndoors(part)) rendered.push(part)
      }
      sculpted = model.instances.filter((instance) => instance.prefix && sculpts(instance) && !props.has(instance))
      decor = (model.decor ?? []).filter((item) => data.tier === 'full' || !isIndoor(item))
    }

    const opened = (list: BlockPart[]) => list.flatMap((part) => (part.damage ? damageColliders(part, 0.3) : [part]))
    const parts = opened(rendered)
    const { error, budget } = light
      ? fitSculpts([...sculpted, ...props.keys(), ...decor], LIGHT_SCULPT_ERROR[data.tier], LIGHT_SCULPT_BUDGET[data.tier], LIGHT_SCULPT_CAP[data.tier])
      : { error: SCULPT_ERROR[data.tier], budget: SCULPT_BUDGET[data.tier] }
    const source = (id: string) => simplifiedSculpt(id, error, budget)
    const itemSource = (id: string) => simplifiedSculpt(id, light ? 0.005 : 0.0025, light ? 400 : 1200)
    const interactive = full ? sculpted.filter((instance) => !instance.pitch && !instance.roll && sculptLeaves(instance.asset).length > 0) : []
    const moving = new Set(interactive)
    const fixed = (id: string) => source(id)?.filter((bucket) => !bucket.leaf) ?? null
    const compiled: { material: MaterialKey; geometry: BufferGeometry }[] = [
      ...compileGeometry(parts, 'lite'),
      ...sculptGroups(sculpted.filter((instance) => !moving.has(instance)), source),
      ...sculptGroups(interactive, fixed),
      ...sculptGroups(decor, source),
    ]

    const casterGeometries = [
      ...compileGeometry(data.tier === 'proxy' ? parts : opened(casterParts(model.parts, data.tier, indoorFurniture)), 'collision'),
      ...sculptGroups(decor, decorCasterSource),
    ].map((group) => group.geometry)
    const caster = mergeCaster(casterGeometries)
    for (const geometry of casterGeometries) geometry.dispose()
    const byMaterial = new Map<MaterialKey, typeof compiled>()
    for (const group of compiled) byMaterial.set(group.material, [...(byMaterial.get(group.material) ?? []), group])
    const groups: StructureGroup[] = []
    const transfer: Transferable[] = []
    let triangles = 0
    for (const [material, list] of byMaterial) {
      const geometry = list.length === 1 ? list[0].geometry : mergeGeometries(list.map((group) => group.geometry), false)
      if (!geometry) continue
      const index = geometry.getIndex()
      const group: StructureGroup = {
        material,
        positions: new Float32Array(geometry.getAttribute('position').array),
        normals: new Float32Array(geometry.getAttribute('normal').array),
        uvs: new Float32Array(geometry.getAttribute('uv').array),
        colors: new Float32Array(geometry.getAttribute('color').array),
        indices: index ? new Uint32Array(index.array) : Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i),
      }
      triangles += group.indices.length / 3
      groups.push(group)
      transfer.push(group.positions.buffer, group.normals.buffer, group.uvs.buffer, group.colors.buffer, group.indices.buffer)
      geometry.dispose()
      for (const item of list) item.geometry.dispose()
    }
    const boxes: number[] = []
    for (const part of collidable) {
      if (!solid(part)) continue
      for (const piece of part.damage ? damageColliders(part, 0.35) : [part]) {
        const q = partQuaternion(piece)
        boxes.push(piece.position[0], piece.position[1], piece.position[2], q.x, q.y, q.z, q.w, piece.size[0] / 2, piece.size[1] / 2, piece.size[2] / 2)
      }
    }
    const packed = new Float32Array(boxes)
    transfer.push(packed.buffer)
    if (caster) transfer.push(caster.positions.buffer, caster.indices.buffer)
    const interaction = full ? interactionOf({ raw, model, interactive, props, source, itemSource, ownerOf: ownerOfId, seed: data.seed }) : null
    if (interaction) for (const piece of interaction.pieces) transfer.push(piece.positions.buffer, piece.normals.buffer, piece.uvs.buffer, piece.colors.buffer, piece.indices.buffer)
    scope.postMessage({ kind: 'done', result: { id: data.id, groups, boxes: packed, triangles, ms: performance.now() - started, caster, interaction } }, transfer)
  } catch (error) {
    scope.postMessage({ kind: 'error', id: data.id, message: error instanceof Error ? error.message : 'Falha ao montar estrutura.' })
  }
}
