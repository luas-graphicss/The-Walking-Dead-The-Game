import { assetFor } from '../catalog'
import { buildAsset } from '../model'
import { transformPoint, type BlockPart, type Condition, type LootKind } from '../types'
import { boundsOf, type Box2, type Box3, type Placed, type Placer } from './placer'

export type Side = 'n' | 's' | 'w' | 'e'
export const SIDES: Side[] = ['n', 'e', 's', 'w']

export const WALL_YAW: Record<Side, number> = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 }
export const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', w: 'e', e: 'w' }
export type WallOpening = { a: number; b: number; y0: number; y1: number; kind: 'door' | 'window' | 'gap' }
export type Wall = { kind: 'exterior' | 'partition' | 'open'; openings: WallOpening[] }
export type Mess = { condition: Condition; chaos: number; burnedShare: number }
export type Program = { kind: string; label: string; [key: string]: unknown }

export type PutOptions = { variant?: number; base?: number; pitch?: number; roll?: number; contact?: (part: BlockPart) => boolean; floor?: boolean; mount?: boolean; gap?: number; connect?: boolean; keepOut?: boolean; burned?: boolean; sockets?: boolean }
export type WallOptions = PutOptions & { at?: 'start' | 'end' | 'center' | 'any' | number; jitter?: number; inset?: number; pad?: number; mountAt?: number; tries?: number; within?: [number, number]; overWindows?: boolean }

const extents = new Map<string, Box3>()

export function extent(family: string, variant: number, yaw: number, pitch = 0, roll = 0): Box3 {
  const key = `${family}-${variant}:${yaw.toFixed(4)}:${pitch.toFixed(3)}:${roll.toFixed(3)}`
  let box = extents.get(key)
  if (!box) {
    const parts = buildAsset(assetFor(family, variant)).parts
    if (!pitch && !roll) {
      const xs: number[] = [], zs: number[] = []
      const local = boundsOf(parts)
      for (const [x, z] of [[local.x0, local.z0], [local.x1, local.z0], [local.x0, local.z1], [local.x1, local.z1]]) { const p = transformPoint([x, 0, z], [0, 0, 0], yaw); xs.push(p[0]); zs.push(p[2]) }
      box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: local.y0, y1: local.y1 }
    } else {
      const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll)
      const xs: number[] = [], ys: number[] = [], zs: number[] = []
      const local = boundsOf(parts)
      for (const x of [local.x0, local.x1]) for (const y of [local.y0, local.y1]) for (const z of [local.z0, local.z1]) {
        const x1 = x * cr - y * sr, y1 = x * sr + y * cr
        const y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp
        xs.push(c * x1 + s * z2); ys.push(y2); zs.push(-s * x1 + c * z2)
      }
      box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: Math.min(...zs), z1: Math.max(...zs) }
    }
    extents.set(key, box)
  }
  return box
}

const PROP_BY_KIND: Record<LootKind, string[]> = {
  food: ['cans', 'bottles', 'food-box'], medical: ['medicine', 'bandages', 'bottles'], documents: ['papers', 'papers'], tools: ['toolbox'], textiles: ['cloth'],
  electronics: ['battery'], weapons: ['ammo'], agriculture: ['seeds'], salvage: ['plastic', 'bottles'],
}

export class Room {
  readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number
  readonly placed: Placed[] = []

  constructor(
    readonly placer: Placer, readonly id: string, readonly zone: string, readonly level: number, readonly floorY: number,
    readonly cell: Box2, readonly walls: Record<Side, Wall>, readonly rng: () => number, readonly mess: Mess, readonly program: Program,
  ) {
    const inset = (side: Side) => (walls[side].kind === 'open' ? 0 : 0.1)
    this.x0 = cell.x0 + inset('w'); this.x1 = cell.x1 - inset('e'); this.z0 = cell.z0 + inset('n'); this.z1 = cell.z1 - inset('s')
  }

  get cx() { return (this.x0 + this.x1) / 2 }
  get cz() { return (this.z0 + this.z1) / 2 }
  get w() { return this.x1 - this.x0 }
  get d() { return this.z1 - this.z0 }
  range(side: Side): [number, number] { return side === 'n' || side === 's' ? [this.x0, this.x1] : [this.z0, this.z1] }
  length(side: Side) { const [a, b] = this.range(side); return b - a }
  solid(side: Side) { return this.walls[side].kind !== 'open' }
  doors(side: Side) { return this.walls[side].kind === 'open' ? [{ a: this.range(side)[0], b: this.range(side)[1], y0: 0, y1: 3, kind: 'door' as const }] : this.walls[side].openings.filter((o) => o.kind === 'door' || o.y0 < 0.05) }
  windows(side: Side) { return this.walls[side].openings.filter((o) => o.kind !== 'door' && o.y0 >= 0.05) }
  pick<T>(list: T[]): T { return list[Math.floor(this.rng() * list.length)] }
  chance(p: number) { return this.rng() < p }
  jitter(amount: number) { return (this.rng() - 0.5) * 2 * amount }

  rank(prefer: 'solid' | 'window' | 'door' = 'solid', exclude: Side[] = []): Side[] {
    const score = (side: Side) => {
      if (!this.solid(side)) return -100
      const doors = this.doors(side).reduce((sum, o) => sum + o.b - o.a, 0), windows = this.windows(side).reduce((sum, o) => sum + o.b - o.a, 0)
      const free = this.length(side) - doors - (prefer === 'solid' ? windows * 0.8 : 0)
      return free + (prefer === 'window' ? windows * 2 : 0) + (prefer === 'door' ? doors * 2 : -doors * 1.5) + this.rng() * 0.4
    }
    return SIDES.filter((side) => !exclude.includes(side)).sort((a, b) => score(b) - score(a)).filter((side) => score(side) > -50)
  }

  spans(side: Side, height: number, pad = 0.14): [number, number][] {
    if (!this.solid(side)) return []
    const [a, b] = this.range(side)
    let spans: [number, number][] = [[a + 0.02, b - 0.02]]
    for (const o of this.walls[side].openings) {
      const isDoor = o.kind === 'door' || o.y0 < 0.05
      if (!isDoor && height < o.y0 - 0.03) continue
      const p = isDoor ? pad : 0.05, cutA = o.a - p, cutB = o.b + p
      spans = spans.flatMap(([s, e]) => {
        const pieces: [number, number][] = cutB <= s || cutA >= e ? [[s, e]] : [[s, cutA], [cutB, e]]
        return pieces.filter(([x, y]) => y - x > 0.05)
      })
    }
    return spans
  }

  put(family: string, yaw: number, at: { center?: [number, number]; origin?: [number, number] }, o: PutOptions = {}): Placed | null {
    const burned = o.burned ?? this.rng() < this.mess.burnedShare
    const placed = this.placer.place({ family, variant: o.variant, level: this.level, base: o.base ?? this.floorY, yaw, center: at.center, origin: at.origin, pitch: o.pitch, roll: o.roll, contact: o.contact, floor: o.floor, mount: o.mount, gap: o.gap, connect: o.connect, keepOut: o.keepOut, burned, sockets: o.sockets })
    if (placed) this.placed.push(placed)
    return placed
  }

  wall(family: string, side: Side, o: WallOptions = {}): Placed | null {
    if (!this.solid(side)) return null
    const variants = o.variant !== undefined ? [o.variant, ...(o.variant > 0 ? [0] : [])] : [1, 0]
    for (const variant of [...new Set(variants)]) {
      const yaw = WALL_YAW[side] + (o.jitter ?? 0)
      const box = extent(family, variant, yaw)
      const ns = side === 'n' || side === 's'
      const len = ns ? box.x1 - box.x0 : box.z1 - box.z0
      const height = o.overWindows ? 0 : (o.mountAt ?? 0) + box.y1
      let spans = this.spans(side, height, o.pad)
      if (o.within) spans = spans.map(([s, e]): [number, number] => [Math.max(s, o.within![0]), Math.min(e, o.within![1])]).filter(([s, e]) => e > s)
      const [wa, wb] = this.range(side), mid = (wa + wb) / 2
      const candidates: number[] = []
      for (const [s, e] of spans) {
        const lo = s + len / 2, hi = e - len / 2
        if (hi < lo - 1e-6) continue
        candidates.push(lo, hi, (lo + hi) / 2)
        for (let t = lo + 0.25; t < hi - 0.1; t += 0.25) candidates.push(t)
      }
      if (!candidates.length) continue
      const at = o.at ?? 'any'
      const target = typeof at === 'number' ? wa + at * (wb - wa) : at === 'center' ? mid : at === 'start' ? -Infinity : at === 'end' ? Infinity : NaN
      const order = Number.isNaN(target) ? candidates.map((t) => [t, this.rng()] as const).sort((a, b) => a[1] - b[1]).map(([t]) => t) : [...candidates].sort((a, b) => Math.abs(a - target) - Math.abs(b - target))
      const gap = o.mountAt !== undefined ? 0 : 0.02 + (o.inset ?? 0)
      for (const t of order.slice(0, o.tries ?? 10)) {
        const origin: [number, number] = side === 'n' ? [t - (box.x0 + box.x1) / 2, this.z0 + gap - box.z0]
          : side === 's' ? [t - (box.x0 + box.x1) / 2, this.z1 - gap - box.z1]
            : side === 'w' ? [this.x0 + gap - box.x0, t - (box.z0 + box.z1) / 2]
              : [this.x1 - gap - box.x1, t - (box.z0 + box.z1) / 2]
        const placed = this.put(family, yaw, { origin }, { ...o, variant, base: o.mountAt !== undefined ? this.floorY + o.mountAt : o.base, mount: o.mountAt !== undefined || o.mount, floor: o.mountAt !== undefined ? false : o.floor })
        if (placed) return placed
      }
    }
    return null
  }

  run(families: string[], side: Side, o: WallOptions & { from?: 'start' | 'end'; spacing?: number; range?: [number, number] } = {}): Placed[] {
    const out: Placed[] = []
    const [wa, wb] = o.range ?? this.range(side)
    let cursor = o.from === 'end' ? wb : wa
    for (const family of families) {
      const within: [number, number] = o.from === 'end' ? [wa, cursor] : [cursor, wb]
      const placed = this.wall(family, side, { ...o, at: o.from === 'end' ? 'end' : 'start', within })
      if (!placed) continue
      out.push(placed)
      const ns = side === 'n' || side === 's'
      cursor = o.from === 'end' ? (ns ? placed.box.x0 : placed.box.z0) - (o.spacing ?? 0.015) : (ns ? placed.box.x1 : placed.box.z1) + (o.spacing ?? 0.015)
    }
    return out
  }

  near(family: string, x: number, z: number, yaw: number, o: PutOptions & { radius?: number; step?: number } = {}): Placed | null {
    const radius = o.radius ?? 0.6, step = o.step ?? 0.2
    const offsets: [number, number][] = [[0, 0]]
    for (let r = step; r <= radius + 1e-6; r += step) for (let k = 0; k < 8; k++) offsets.push([Math.cos(k * Math.PI / 4) * r, Math.sin(k * Math.PI / 4) * r])
    for (const [dx, dz] of offsets) {
      const placed = this.put(family, yaw, { center: [x + dx, z + dz] }, o)
      if (placed) return placed
    }
    return null
  }

  scatter(family: string, o: PutOptions & { tries?: number; margin?: number; area?: Box2; yaw?: number; wallward?: boolean } = {}): Placed | null {
    const area = o.area ?? this
    const m = o.margin ?? 0.35
    for (let i = 0; i < (o.tries ?? 10); i++) {
      let x = area.x0 + m + this.rng() * Math.max(0, area.x1 - area.x0 - 2 * m), z = area.z0 + m + this.rng() * Math.max(0, area.z1 - area.z0 - 2 * m)
      if (o.wallward) { if (this.rng() < 0.5) x = this.rng() < 0.5 ? area.x0 + m : area.x1 - m; else z = this.rng() < 0.5 ? area.z0 + m : area.z1 - m }
      const placed = this.put(family, o.yaw ?? this.rng() * Math.PI * 2, { center: [x, z] }, o)
      if (placed) return placed
    }
    return null
  }

  chairsAround(table: Placed, family: string, count: number, o: { ends?: boolean; tuck?: number } = {}): Placed[] {
    const out: Placed[] = []
    const t = table.yaw, local = extent(table.spec.family, table.spec.variant, 0)
    const W = local.x1 - local.x0, D = local.z1 - local.z0
    const cx = (table.box.x0 + table.box.x1) / 2, cz = (table.box.z0 + table.box.z1) / 2
    const seats: [number, number, number][] = []
    const perSide = W > 1.25 ? 2 : 1
    for (const sz of [1, -1]) for (let i = 0; i < perSide; i++) seats.push([perSide === 1 ? 0 : (i - 0.5) * W * 0.5, sz, sz > 0 ? Math.PI : 0])
    if (o.ends !== false) for (const sx of [1, -1]) seats.push([sx, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2])
    const chair = extent(family, 1, 0), cd = chair.z1 - chair.z0
    for (const [a, side, face] of seats) {
      if (out.length >= count) break
      const endSeat = face === Math.PI / 2 || face === -Math.PI / 2
      const knocked = this.chance(0.08 + this.mess.chaos * 0.4)
      const pulled = this.chance(0.3 + this.mess.chaos * 0.5)
      for (const tuck of knocked ? [-0.35, -0.2] : pulled ? [-0.25 - this.rng() * 0.2, -0.1, o.tuck ?? 0.12] : [o.tuck ?? 0.16, 0.06, -0.08]) {
        const reach = (endSeat ? W / 2 : D / 2) + cd / 2 - tuck
        const lx = endSeat ? a * reach : a, lz = endSeat ? 0 : side * reach
        const p = transformPoint([lx, 0, lz], [cx, 0, cz], t)
        const yaw = t + face + (knocked ? this.jitter(1.2) : this.jitter(0.08 + this.mess.chaos * 0.5 + (pulled ? 0.25 : 0)))
        const placed = knocked ? this.put(family, yaw, { center: [p[0], p[2]] }, { pitch: -Math.PI / 2 }) ?? this.put(family, yaw, { center: [p[0], p[2]] }) : this.put(family, yaw, { center: [p[0], p[2]] })
        if (placed) { out.push(placed); break }
      }
    }
    return out
  }

  fallen(family: string, side: Side, o: PutOptions = {}): Placed | null {
    const yaw = WALL_YAW[side] + this.jitter(0.15)
    const box = extent(family, o.variant ?? 1, yaw, Math.PI / 2, 0)
    const ns = side === 'n' || side === 's'
    const depth = ns ? box.z1 - box.z0 : box.x1 - box.x0
    const [a, b] = this.range(side)
    for (let i = 0; i < 6; i++) {
      const t = a + 0.6 + this.rng() * Math.max(0, b - a - 1.2)
      const off = 0.15 + depth / 2
      const center: [number, number] = side === 'n' ? [t, this.z0 + off] : side === 's' ? [t, this.z1 - off] : side === 'w' ? [this.x0 + off, t] : [this.x1 - off, t]
      const placed = this.put(family, yaw, { center }, { ...o, pitch: Math.PI / 2 })
      if (placed) return placed
    }
    return null
  }

  dress(host: Placed | null, kind: LootKind, chance = 0.6, max = 3) {
    if (!host || host.tipped) return
    const families = PROP_BY_KIND[kind]
    let count = 0
    for (const socket of host.sockets) {
      if (socket.concealed || count >= max || !this.chance(chance)) continue
      const support = host.parts.find((part) => part.id === socket.support)
      if (!support) continue
      const top = support.position[1] + support.size[1] / 2
      const family = this.pick(families)
      const spot = transformPoint([this.jitter(Math.max(0, support.size[0] / 2 - 0.2)), 0, this.jitter(Math.max(0, support.size[2] / 2 - 0.16))], [support.position[0], 0, support.position[2]], support.yaw)
      const placed = this.put(family, support.yaw + this.jitter(0.6), { center: [spot[0], spot[2]] }, { variant: Math.floor(this.rng() * 3), base: top, floor: false, connect: false, contact: (part) => part.id === support.id, gap: 0.008, keepOut: false, burned: false })
      if (placed) {
        count++
        const resource = placed.parts.reduce((best, part) => (part.position[1] + part.size[1] / 2 > best.position[1] + best.size[1] / 2 ? part : best))
        if (!resource.pitch && !resource.roll && resource.size[0] >= 0.1 && resource.size[2] >= 0.1) this.placer.b.socket(resource, kind, false, 'Itens largados', 0, 0, { container: host.spec.family, prop: family })
      }
    }
  }
}
