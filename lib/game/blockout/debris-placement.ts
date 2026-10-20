import { ASSET_BY_ID } from './catalog'
import { hash, partBounds, random, transformPoint, type Condition, type Instance, type MaterialKey, type StructureModel, type Vec3 } from './types'

export type WallOpening = 'door' | 'frame' | 'breach' | 'fracture' | 'window' | 'solid'

export type WallEdge = { origin: Vec3; yaw: number; outward: number; length: number; level: number; height: number; opening: WallOpening; outside: boolean; material: MaterialKey }
export type DebrisContext = { edges: WallEdge[]; bay: [number, number]; condition: Condition; wallMaterial: MaterialKey; timber: boolean }

type Box = { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }
const PASSIVE_ROLES = new Set(['floor', 'foundation', 'roof'])

const EXTERIOR_CHANCE: Record<Condition, number> = { weathered: 0.1, damaged: 0.25, burned: 0.32, ruined: 0.6, leveled: 0.75 }
const PER_ROOM: Record<Condition, [number, number]> = { weathered: [0, 1], damaged: [1, 2], burned: [1, 3], ruined: [2, 3], leveled: [3, 4] }

const COST: Record<string, number[]> = { 'brick-rubble': [45, 50, 62, 69], 'concrete-rubble': [33, 38, 48, 52], planks: [1, 2, 2, 2], 'metal-scrap': [8, 9, 13, 12], 'burned-debris': [25, 35, 43, 51], 'tile-rubble': [8, 9, 10, 10], 'plaster-rubble': [15, 19, 22, 25], 'collapsed-beam': [16, 18, 19, 19] }
const BUDGET: Record<Condition, number> = { weathered: 90, damaged: 300, burned: 300, ruined: 340, leveled: 400 }

function rubbleFor(material: MaterialKey) {
  if (material === 'charcoal') return ['burned-debris', 'burned-debris', 'plaster-rubble']
  if (material === 'wood') return ['planks', 'planks', 'metal-scrap']
  if (material === 'steel') return ['metal-scrap', 'metal-scrap', 'concrete-rubble']
  if (material === 'concrete') return ['concrete-rubble', 'concrete-rubble', 'brick-rubble']
  return ['plaster-rubble', 'brick-rubble', 'brick-rubble']
}

function halfExtents(size: Vec3, yaw: number) {
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw))
  return { hx: (c * size[0] + s * size[2]) / 2, hz: (s * size[0] + c * size[2]) / 2 }
}

export function scatterDebris(model: StructureModel, ctx: DebrisContext) {
  const { condition } = ctx
  const rng = random(hash(`${model.id}:debris`))
  const pick = <T,>(list: T[]) => list[Math.floor(rng() * list.length)]
  const decor: Instance[] = (model.decor ??= [])
  const blockers: Box[] = model.parts.filter((part) => !PASSIVE_ROLES.has(part.role)).map((part) => {
    const b = partBounds(part)
    return { x0: b.min[0], x1: b.max[0], z0: b.min[2], z1: b.max[2], y0: b.min[1], y1: b.max[1] }
  })
  const taken: Box[] = []
  let spent = 0
  const hits = (a: Box, b: Box, pad: number) => a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.z0 < b.z1 - pad && a.z1 > b.z0 + pad && a.y0 < b.y1 - 0.02 && a.y1 > b.y0 + 0.02
  const add = (family: string, variant: number, position: Vec3, yaw: number, level: number) => {
    const v = Math.max(0, Math.min(3, Math.floor(variant)))
    const id = `${family}-${v}`
    const spec = ASSET_BY_ID.get(id)
    const cost = COST[family]?.[v] ?? 20
    if (!spec || spent + cost > BUDGET[condition]) return false
    const { hx, hz } = halfExtents(spec.size, yaw)
    const box: Box = { x0: position[0] - hx, x1: position[0] + hx, z0: position[2] - hz, z1: position[2] + hz, y0: position[1], y1: position[1] + spec.size[1] }
    if (blockers.some((b) => hits(box, b, 0.015)) || taken.some((b) => hits(box, b, -0.04))) return false
    taken.push(box)
    spent += cost
    const charred = condition === 'burned' && family !== 'burned-debris' && rng() < 0.45
    decor.push({ asset: id, position, yaw, level, burned: charred || undefined })
    return true
  }
  const flip = () => (rng() < 0.5 ? Math.PI : 0)

  for (const edge of ctx.edges) {
    if (edge.opening !== 'breach' && edge.opening !== 'fracture') continue
    const families = rubbleFor(edge.material)
    const along = edge.opening === 'breach' ? -0.025 * edge.length : 0
    const heavy = edge.opening === 'breach' ? 2 : 0
    for (const side of [1, -1]) {
      const local: Vec3 = [along + (rng() - 0.5) * 0.35, 0, side * edge.outward * (0.5 + rng() * 0.1)]
      const at = transformPoint(local, edge.origin, edge.yaw)
      const outside = side === 1
      add(pick(families), heavy + rng() * 2 - (outside ? 0 : 1), [at[0], outside ? 0 : edge.origin[1], at[2]], edge.yaw + flip() + (rng() - 0.5) * 0.25, outside ? 0 : edge.level)
    }
    if (rng() < 0.75) {
      const scatter = transformPoint([along + (rng() - 0.5) * 1.6, 0, edge.outward * (1.25 + rng() * 0.35)], edge.origin, edge.yaw)
      add(pick(families), rng() * 2, [scatter[0], 0, scatter[2]], edge.yaw + flip() + (rng() - 0.5) * 0.9, 0)
    }
  }

  for (const edge of ctx.edges) {
    if (!edge.outside || edge.level !== 0 || edge.opening === 'door' || edge.opening === 'breach' || edge.opening === 'fracture' || edge.length < 2.4) continue
    if (rng() > EXTERIOR_CHANCE[condition]) continue
    const families = condition === 'weathered' ? ['plaster-rubble', 'planks', 'metal-scrap'] : rubbleFor(edge.material)
    const at = transformPoint([(rng() - 0.5) * (edge.length - 2.2), 0, edge.outward * (0.5 + rng() * 0.25)], edge.origin, edge.yaw)
    add(pick(families), condition === 'weathered' ? rng() * 1.5 : rng() * 4, [at[0], 0, at[2]], edge.yaw + flip() + (rng() - 0.5) * 0.3, 0)
  }

  const interior = condition === 'burned' ? ['burned-debris', 'burned-debris', 'plaster-rubble', 'collapsed-beam']
    : condition === 'weathered' ? (ctx.timber ? ['planks', 'plaster-rubble', 'metal-scrap'] : ['plaster-rubble', 'plaster-rubble', 'tile-rubble', 'planks', 'metal-scrap'])
    : [rubbleFor(ctx.wallMaterial)[0], 'collapsed-beam', 'planks', 'planks', 'plaster-rubble', 'tile-rubble', 'metal-scrap']
  const [low, high] = PER_ROOM[condition]
  for (const room of model.rooms) {
    const want = low + Math.floor(rng() * (high - low + 1))
    const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].sort(() => rng() - 0.5)
    let placed = 0
    for (const [sx, sz] of corners) {
      if (placed >= want) break
      for (let attempt = 0; attempt < 3; attempt++) {
        const family = pick(interior), variant = condition === 'weathered' ? rng() * 2 : rng() * 4
        const spec = ASSET_BY_ID.get(`${family}-${Math.floor(variant)}`)
        if (!spec) continue
        const yaw = (rng() < 0.5 ? 0 : Math.PI / 2) + flip() + (rng() - 0.5) * 0.18
        const { hx, hz } = halfExtents(spec.size, yaw)
        const x = room.center[0] + sx * (ctx.bay[0] / 2 - 0.16 - hx - rng() * 0.1)
        const z = room.center[2] + sz * (ctx.bay[1] / 2 - 0.16 - hz - rng() * 0.1)
        if (add(family, variant, [x, room.center[1], z], yaw, room.level)) { placed++; break }
      }
    }
    if (condition !== 'ruined' && condition !== 'leveled') continue
    for (let i = 0; i < 3; i++) {
      const family = pick(interior), variant = rng() * 4, yaw = rng() * Math.PI * 2
      const spec = ASSET_BY_ID.get(`${family}-${Math.floor(variant)}`)
      if (!spec) continue
      const { hx, hz } = halfExtents(spec.size, yaw)
      const roomX = Math.max(0, ctx.bay[0] / 2 - 1.05 - 2 * hx), roomZ = Math.max(0, ctx.bay[1] / 2 - 1.05 - 2 * hz)
      const x = room.center[0] + (rng() < 0.5 ? -1 : 1) * (0.85 + hx + rng() * roomX)
      const z = room.center[2] + (rng() < 0.5 ? -1 : 1) * (0.85 + hz + rng() * roomZ)
      add(family, variant, [x, room.center[1], z], yaw, room.level)
    }
  }
}
