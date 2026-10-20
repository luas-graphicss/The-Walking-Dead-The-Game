import type { Architecture } from '../architecture'
import type { ModelBuilder } from '../model'
import { FLOOR_HEIGHT, FOUNDATION_HEIGHT, hash, random, type Blueprint, type Condition, type StructureModel } from '../types'
import { Circulation } from './circulation'
import { Placer } from './placer'
import { programFor, type PlanCell } from './programs'
import { RECIPES } from './recipes'
import { Room, type Side, type Wall, type WallOpening } from './room'

export { programFor } from './programs'
export type EdgeRecord = { axis: 'x' | 'z'; line: number; kind: Wall['kind']; openings: WallOpening[]; inside?: 1 | -1 }
export type InteriorContext = {
  blueprint: Blueprint; profile: Architecture; cells: PlanCell[]; bay: [number, number]; minX: number; minZ: number; nx: number; nz: number
  floors: number; condition: Condition; seed: number; edges: Map<string, EdgeRecord>; entrance: PlanCell; entranceX: number
  stair?: { x: number; z: number }
}

const key = (x: number, z: number) => `${x},${z}`

export function edgeKey(level: number, a: [number, number], c: [number, number]) { return `${level}#${[key(...a), key(...c)].sort().join('|')}` }
function cellEdge(level: number, cell: PlanCell, side: Side) {
  const { x, z } = cell
  if (side === 'n') return edgeKey(level, [x, z], [x + 1, z])
  if (side === 's') return edgeKey(level, [x, z + 1], [x + 1, z + 1])
  if (side === 'w') return edgeKey(level, [x, z], [x, z + 1])
  return edgeKey(level, [x + 1, z], [x + 1, z + 1])
}

const CHAOS: Record<Condition, number> = { weathered: 0.16, damaged: 0.52, burned: 0.48, ruined: 0.82, leveled: 1 }

export function furnishInterior(b: ModelBuilder, model: StructureModel, ctx: InteriorContext) {
  const { bay, minX, minZ, floors, condition, seed } = ctx
  const placer = new Placer(b, model)
  const maxZ = minZ + ctx.nz * bay[1]
  const area = { x0: minX, x1: minX + ctx.nx * bay[0], z0: minZ, z1: maxZ }
  const floorOf = (level: number) => FOUNDATION_HEIGHT + level * FLOOR_HEIGHT

  for (const [id, edge] of ctx.edges) {
    const level = Number(id.split('#')[0]), floorY = floorOf(level)
    for (const o of edge.openings) {
      if (!(o.kind === 'door' || o.y0 < 0.05)) continue
      const depth = edge.kind === 'partition' ? 0.95 : 1.2
      for (const dir of edge.kind === 'partition' ? [-1, 1] : [edge.inside ?? 1]) {
        const n0 = dir > 0 ? edge.line + 0.1 : edge.line - 0.1 - depth, n1 = dir > 0 ? edge.line + 0.1 + depth : edge.line - 0.1
        const a0 = o.a - 0.15, a1 = o.b + 0.15
        placer.reserve(level, edge.axis === 'x' ? { x0: a0, x1: a1, z0: n0, z1: n1, y0: floorY + 0.1, y1: floorY + 2.4 } : { x0: n0, x1: n1, z0: a0, z1: a1, y0: floorY + 0.1, y1: floorY + 2.4 })
      }
    }
  }
  if (ctx.stair) {
    const { x, z } = ctx.stair
    for (let level = 0; level < floors; level++) {
      const floorY = floorOf(level)
      if (level < floors - 1) {
        placer.reserve(level, { x0: x - 0.9, x1: x + 0.9, z0: z - 2.55, z1: z + 2.4 + 1.3, y0: floorY + 0.05, y1: floorY + FLOOR_HEIGHT + 0.5 })
      }
      if (level > 0) {
        placer.reserve(level, { x0: x - 1.0, x1: x + 1.0, z0: z - 2.4 - 1.3, z1: z + 2.5, y0: floorY - 0.3, y1: floorY + 2.6 })
      }
    }
  }

  for (let level = 0; level < floors; level++) {
    const floorY = floorOf(level)
    const circulation = new Circulation(area, floorY)
    for (const part of model.parts) if (part.role === 'floor' || part.role === 'foundation') circulation.addFloor(part)
    circulation.commit(model.parts)
    if (level === 0) circulation.setRoot(ctx.entranceX, maxZ - 0.75)
    else if (ctx.stair) circulation.setRoot(ctx.stair.x, ctx.stair.z - 2.4 - 0.55)
    for (const [id, edge] of ctx.edges) {
      if (Number(id.split('#')[0]) !== level) continue
      for (const o of edge.openings) {
        if (!(o.kind === 'door' || o.y0 < 0.05)) continue
        const c = (o.a + o.b) / 2
        for (const dir of edge.kind === 'partition' ? [-1, 1] : [edge.inside ?? 1]) {
          const n = edge.line + dir * 0.55
          if (edge.axis === 'x') circulation.require(c, n); else circulation.require(n, c)
        }
      }
    }
    if (ctx.stair && level < floors - 1) circulation.require(ctx.stair.x, ctx.stair.z + 2.4 + 0.45)
    for (const cell of ctx.cells) {
      const x0 = minX + cell.x * bay[0], z0 = minZ + cell.z * bay[1]
      circulation.zone({ x0: x0 + 0.12, x1: x0 + bay[0] - 0.12, z0: z0 + 0.12, z1: z0 + bay[1] - 0.12 })
    }
    circulation.baseline()
    placer.circulation.set(level, circulation)
  }

  if (ctx.profile.specialty === 'well' && condition !== 'leveled') {
    const occupied = new Set(ctx.cells.map((c) => key(c.x, c.z)))
    for (let z = 0; z < ctx.nz; z++) for (let x = 0; x < ctx.nx; x++) {
      if (occupied.has(key(x, z))) continue
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => occupied.has(key(x + dx, z + dz))).length
      if (around >= 3) placer.place({ family: 'well', level: 0, base: 0, yaw: 0, center: [minX + (x + 0.5) * bay[0], minZ + (z + 0.5) * bay[1]], floor: false, keepOut: false, connect: false })
    }
  }

  const rooms: Room[] = []
  for (let level = 0; level < floors; level++) for (const cell of ctx.cells) {
    const walls = {} as Record<Side, Wall>
    for (const side of ['n', 's', 'w', 'e'] as Side[]) {
      const edge = ctx.edges.get(cellEdge(level, cell, side))
      walls[side] = edge ? { kind: edge.kind, openings: edge.openings } : { kind: 'open', openings: [] }
    }
    const rng = random(hash(`${model.id}:room:${level}:${cell.x}:${cell.z}`))
    const chaos = Math.min(1, Math.max(0, CHAOS[condition] + (rng() - 0.5) * 0.3))
    const program = condition === 'leveled' ? { kind: 'remains', label: 'Escombros' } : programFor(ctx.blueprint, ctx.profile, cell, level, { cells: ctx.cells, floors, entrance: ctx.entrance })
    const x0 = minX + cell.x * bay[0], z0 = minZ + cell.z * bay[1]
    rooms.push(new Room(placer, `${level}:${cell.x}:${cell.z}`, cell.zone, level, floorOf(level), { x0, x1: x0 + bay[0], z0, z1: z0 + bay[1] }, walls, rng, { condition, chaos, burnedShare: condition === 'burned' ? 0.7 : 0 }, program))
  }
  const order = random(hash(`${model.id}:order:${seed}`))
  for (const room of rooms.map((r) => [r, order()] as const).sort((a, c) => a[1] - c[1]).map(([r]) => r)) (RECIPES[room.program.kind] ?? RECIPES.stockroom)(room, room.program)

  model.routes.push({ id: 'entrance', from: [ctx.entranceX, FOUNDATION_HEIGHT, maxZ], to: [ctx.entranceX, FOUNDATION_HEIGHT, maxZ - 0.75] })
  for (const [level, circulation] of placer.circulation) {
    const floorY = floorOf(level)
    circulation.routes().forEach(([x0, z0, x1, z1], i) => model.routes.push({ id: `walk-${level}-${i}`, from: [x0, floorY, z0], to: [x1, floorY, z1] }))
  }
  return rooms
}
