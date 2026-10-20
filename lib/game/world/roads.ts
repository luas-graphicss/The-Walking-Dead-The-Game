import { Terrain } from './terrain'
import { hash2, hashString, randomAt, randomSource, lerp, smoothstep, LruCache } from './noise'
import { CHUNK_SIZE, REGION_SIZE, WATER_NONE, WORLD_HALF } from './settings'
import type { Bounds, JunctionArm, Point2, Point3, Road, RoadCondition, RoadInfluence, RoadKind, RoadSegment, Town } from './types'

type Region = { town: Town; roads: Road[]; segments: RoadSegment[]; buckets: Set<string> }

type TownLayout = {
  nodes: Map<string, Point3>; halfX: number; halfZ: number; x0: number; x1: number; columns: boolean[]

  perimeter: Point3[]; exits: Point2[]; gx: number; gz: number
}
type Entry = { node: Point3; out: Point2 }

const MAX_REGION = Math.floor(WORLD_HALF / REGION_SIZE) - 1
const MAX_CACHED_REGIONS = 36
const ROAD_BUCKET_SIZE = CHUNK_SIZE / 4

const BYPASS_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]] as const

const TOWN_EXIT = 55

const JOIN_OVERLAP = 0.6
export const MAX_GRADE = 0.13
export const ROAD_SINK = 0.22
export const SIDEWALK = 2.4

const CUT_SLOPE = 0.8
const FILL_SLOPE = 0.6
const EARTH_RELAX = 10_000

const EARTH_STRIDE = 6

export const ROAD_SPEC: Record<RoadKind, { width: number; verge: number; priority: number }> = {
  highway: { width: 15, verge: 3, priority: 4 },
  country: { width: 9, verge: 2.6, priority: 3 },
  street: { width: 10, verge: 3.4, priority: 2 },
  track: { width: 4.6, verge: 2.2, priority: 1 },
}

export function parentCell(cx: number, cz: number, seed: number): Point2 | null {
  if (cx === 0 && cz === 0) return null
  if (cx === 0) return { x: 0, z: cz - Math.sign(cz) }
  if (cz === 0) return { x: cx - Math.sign(cx), z: 0 }
  const choice = randomAt(cx, cz, seed ^ 61329)
  if (choice < 0.28) return { x: cx - Math.sign(cx), z: cz - Math.sign(cz) }
  return choice < 0.65 ? { x: cx - Math.sign(cx), z: cz } : { x: cx, z: cz - Math.sign(cz) }
}

export function distanceToSegment(x: number, z: number, segment: RoadSegment) {
  const dx = segment.b.x - segment.a.x, dz = segment.b.z - segment.a.z
  const t = Math.max(0, Math.min(1, ((x - segment.a.x) * dx + (z - segment.a.z) * dz) / (dx * dx + dz * dz || 1)))
  return { distance: Math.hypot(x - segment.a.x - dx * t, z - segment.a.z - dz * t), y: lerp(segment.a.y, segment.b.y, t), t }
}

function spline(points: Point3[], spacing: number) {
  const result: Point3[] = []
  const mirror = (p: Point3, q: Point3) => ({ x: 2 * p.x - q.x, y: 2 * p.y - q.y, z: 2 * p.z - q.z })
  const knot = (p: Point3, q: Point3) => Math.max(1e-3, Math.sqrt(Math.hypot(q.x - p.x, q.z - p.z)))
  const mix = (p: Point3, q: Point3, wp: number, wq: number) => ({ x: p.x * wp + q.x * wq, y: p.y * wp + q.y * wq, z: p.z * wp + q.z * wq })
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i], p2 = points[i + 1]
    const p0 = i > 0 ? points[i - 1] : mirror(p1, p2), p3 = i + 2 < points.length ? points[i + 2] : mirror(p2, p1)
    const t1 = knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3)
    const steps = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / spacing))
    result.push({ ...p1 })
    for (let j = 1; j < steps; j++) {
      const t = t1 + (t2 - t1) * (j / steps)
      const a1 = mix(p0, p1, (t1 - t) / t1, t / t1)
      const a2 = mix(p1, p2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1))
      const a3 = mix(p2, p3, (t3 - t) / (t3 - t2), (t - t2) / (t3 - t2))
      const b1 = mix(a1, a2, (t2 - t) / t2, t / t2)
      const b2 = mix(a2, a3, (t3 - t) / (t3 - t1), (t - t1) / (t3 - t1))
      result.push(mix(b1, b2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1)))
    }
  }
  result.push({ ...points[points.length - 1] })
  return result
}

function conditionFor(kind: RoadKind, roll: number): RoadCondition {
  if (kind === 'track') return roll < 0.6 ? 'worn' : 'broken'
  const [fresh, worn] = kind === 'highway' ? [0.5, 0.86] : kind === 'country' ? [0.3, 0.74] : [0.34, 0.8]
  return roll < fresh ? 'new' : roll < worn ? 'worn' : 'broken'
}

export class RoadNetwork {
  private regions = new Map<string, Region>()
  private buckets = new Map<string, RoadSegment[]>()
  private layouts = new LruCache<string, TownLayout>(128)
  private parents = new LruCache<string, Point2 | null>(1_024)
  private links = new LruCache<string, Point2[]>(512)
  private entries = new LruCache<string, Map<string, Entry>>(256)
  constructor(readonly terrain: Terrain) {}

  private valid(cx: number, cz: number) { return Math.abs(cx) <= MAX_REGION && Math.abs(cz) <= MAX_REGION }

  effectiveParent(cx: number, cz: number): Point2 | null {
    const key = `${cx},${cz}`
    const cached = this.parents.get(key)
    if (cached !== undefined) return cached
    const primary = parentCell(cx, cz, this.terrain.seed)
    if (!primary) return this.parents.set(key, null)
    const options = [primary]
    if (cx !== 0 && cz !== 0) {
      const sx = Math.sign(cx), sz = Math.sign(cz)
      for (const option of [{ x: cx - sx, z: cz - sz }, { x: cx - sx, z: cz }, { x: cx, z: cz - sz }]) {
        if (option.x !== primary.x || option.z !== primary.z) options.push(option)
      }
    }
    return this.parents.set(key, options.find((option) => !this.terrain.town(option.x, option.z).wet) ?? primary)
  }

  layout(town: Town): TownLayout {
    const cached = this.layouts.get(town.id)
    if (cached) return cached
    const rng = randomSource(hash2(town.cx, town.cz, this.terrain.seed ^ 718391))
    const city = town.kind === 'city'
    const halfX = town.kind === 'hamlet' ? 1 : town.kind === 'village' ? 2 : town.kind === 'town' ? 3 : 5
    const halfZ = city ? 3 : town.kind === 'town' ? 2 : 1
    const cos = Math.cos(town.angle), sin = Math.sin(town.angle)
    const clampGrade = (value: number) => Math.max(-0.065, Math.min(0.065, value))
    const gx = clampGrade((this.terrain.height(town.x + 130, town.z) - this.terrain.height(town.x - 130, town.z)) / 260)
    const gz = clampGrade((this.terrain.height(town.x, town.z + 130) - this.terrain.height(town.x, town.z - 130)) / 260)
    const nodes = new Map<string, Point3>()

    const spacingX = city ? 84 + rng() * 16 : 88 + rng() * 44, spacingZ = city ? 86 + rng() * 14 : 92 + rng() * 40
    const jitter = city ? 0.4 : 1
    for (let iz = -halfZ; iz <= halfZ; iz++) for (let ix = -halfX; ix <= halfX; ix++) {
      const center = ix === 0 && iz === 0
      const u = ix * spacingX + (center ? 0 : ((rng() - 0.5) * 30 + iz * iz * 8) * jitter)
      const v = iz * spacingZ + (center ? 0 : ((rng() - 0.5) * 26 + Math.sin(ix * 1.2) * 18) * jitter)
      const x = town.x + u * cos - v * sin, z = town.z + u * sin + v * cos
      nodes.set(`${ix},${iz}`, { x, z, y: town.y + (x - town.x) * gx + (z - town.z) * gz })
    }
    const columns: boolean[] = []
    const skip = city ? 0.1 : town.kind === 'town' ? 0.32 : 0.42
    for (let ix = -halfX; ix <= halfX; ix++) columns.push(ix === 0 || rng() >= skip)

    let x0 = -halfX, x1 = halfX
    while (x0 < -1 && !columns[x0 + halfX]) x0++
    while (x1 > 1 && !columns[x1 + halfX]) x1--
    columns[x0 + halfX] = true; columns[x1 + halfX] = true
    const perimeter: Point3[] = [], exits: Point2[] = []
    for (let iz = -halfZ; iz <= halfZ; iz++) for (let ix = x0; ix <= x1; ix++) {
      const ou = ix === x0 ? -1 : ix === x1 ? 1 : 0, ov = Math.abs(iz) === halfZ ? Math.sign(iz) : 0
      if (!ou && !ov) continue
      const length = Math.hypot(ou, ov)
      perimeter.push(nodes.get(`${ix},${iz}`)!)
      exits.push({ x: (ou * cos - ov * sin) / length, z: (ou * sin + ov * cos) / length })
    }
    return this.layouts.set(town.id, { nodes, halfX, halfZ, x0, x1, columns, perimeter, exits, gx, gz })
  }

  private planeHeight(town: Town, x: number, z: number) {
    const { gx, gz } = this.layout(town)
    return town.y + (x - town.x) * gx + (z - town.z) * gz
  }

  private bypass(cx: number, cz: number, dx: number, dz: number) {
    const x = cx + dx, z = cz + dz
    if (!this.valid(cx, cz) || !this.valid(x, z) || randomAt(cx * 7 + dx, cz * 11 + dz, this.terrain.seed ^ 12987) > 0.17) return false
    const town = this.terrain.town(cx, cz), other = this.terrain.town(x, z)
    if (town.wet || other.wet) return false
    const parent = this.effectiveParent(cx, cz), otherParent = this.effectiveParent(x, z)
    if ((parent?.x === x && parent.z === z) || (otherParent?.x === cx && otherParent.z === cz)) return false
    const mx = (town.x + other.x) / 2, mz = (town.z + other.z) / 2
    const radiusSquared = ((town.x - other.x) ** 2 + (town.z - other.z) ** 2) / 4
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      if ((!ox && !oz) || (ox === dx && oz === dz)) continue
      const near = this.terrain.town(cx + ox, cz + oz)
      if ((near.x - mx) ** 2 + (near.z - mz) ** 2 < radiusSquared * 0.9) return false
    }
    return true
  }

  private linksOf(cx: number, cz: number): Point2[] {
    const key = `${cx},${cz}`
    const cached = this.links.get(key)
    if (cached) return cached
    const result: Point2[] = []
    const add = (x: number, z: number) => {
      if (!this.valid(x, z) || this.terrain.town(x, z).wet || result.some((p) => p.x === x && p.z === z)) return
      result.push({ x, z })
    }
    if (!this.terrain.town(cx, cz).wet) {
      const parent = this.effectiveParent(cx, cz)
      if (parent) add(parent.x, parent.z)
      for (const [dx, dz] of BYPASS_DIRS) {
        if (this.bypass(cx, cz, dx, dz)) add(cx + dx, cz + dz)
        if (this.bypass(cx - dx, cz - dz, dx, dz)) add(cx - dx, cz - dz)
      }
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dz) || !this.valid(cx + dx, cz + dz)) continue
        const childParent = this.effectiveParent(cx + dx, cz + dz)
        if (childParent?.x === cx && childParent.z === cz) add(cx + dx, cz + dz)
      }
    }
    return this.links.set(key, result)
  }

  private entryScore(town: Town, target: Point2, node: Point3, out: Point2) {
    const dx = target.x - town.x, dz = target.z - town.z, length = Math.hypot(dx, dz) || 1
    return (out.x * dx + out.z * dz) / length + ((node.x - town.x) * dx + (node.z - town.z) * dz) / length / 4_000
  }

  private entryMap(town: Town): Map<string, Entry> {
    const cached = this.entries.get(town.id)
    if (cached) return cached
    const { perimeter, exits } = this.layout(town)
    const options: { link: string; node: number; score: number }[] = []
    for (const link of this.linksOf(town.cx, town.cz)) {
      const target = this.terrain.town(link.x, link.z)
      perimeter.forEach((node, index) => options.push({ link: target.id, node: index, score: this.entryScore(town, target, node, exits[index]) }))
    }
    options.sort((a, b) => b.score - a.score || (a.link < b.link ? -1 : a.link > b.link ? 1 : 0) || a.node - b.node)
    const map = new Map<string, Entry>(), used = new Set<number>()
    for (const { link, node } of options) {
      if (map.has(link) || used.has(node)) continue
      map.set(link, { node: perimeter[node], out: exits[node] }); used.add(node)
    }

    for (const { link, node } of options) if (!map.has(link)) map.set(link, { node: perimeter[node], out: exits[node] })
    return this.entries.set(town.id, map)
  }

  entry(town: Town, target: Town): Entry {
    const assigned = this.entryMap(town).get(target.id)
    if (assigned) return assigned
    const { perimeter, exits } = this.layout(town)
    let best = 0
    for (let i = 1; i < perimeter.length; i++) if (this.entryScore(town, target, perimeter[i], exits[i]) > this.entryScore(town, target, perimeter[best], exits[best])) best = i
    return { node: perimeter[best], out: exits[best] }
  }

  entryNode(town: Town, target: Town): Point3 { return this.entry(town, target).node }

  private route(from: Entry, to: Entry, key: number): Point3[] {
    const origin = from.node, destination = to.node
    const start = { x: origin.x + from.out.x * TOWN_EXIT, z: origin.z + from.out.z * TOWN_EXIT, y: origin.y }
    const end = { x: destination.x + to.out.x * TOWN_EXIT, z: destination.z + to.out.z * TOWN_EXIT, y: destination.y }
    const dx = end.x - start.x, dz = end.z - start.z, length = Math.hypot(dx, dz)
    if (length < 30) return spline([origin, destination], 12)
    const nx = -dz / length, nz = dx / length
    const sections = Math.max(5, Math.ceil(length / 330))
    const options = 11, middle = 5
    const spread = Math.min(2_000, length * 0.24)
    const rng = randomSource(key)
    const groundAt = (x: number, z: number) => {
      const s = this.terrain.surface(x, z)
      return { y: Math.max(s.height, s.waterLevel + 1), wet: Math.max(0, s.waterLevel + 2 - s.height) }
    }
    const nodes: Point3[][] = [], wet: number[][] = [], costs: number[][] = [], previous: number[][] = []
    for (let i = 0; i <= sections; i++) {
      const t = i / sections, envelope = Math.sin(t * Math.PI)
      const meander = (rng() - 0.5) * 360 * envelope
      const row: Point3[] = [], water: number[] = []
      for (let j = 0; j < options; j++) {
        const lateral = ((j - middle) / middle * spread + meander) * envelope
        const x = lerp(start.x, end.x, t) + nx * lateral, z = lerp(start.z, end.z, t) + nz * lateral
        const ground = groundAt(x, z)
        row.push({ x, z, y: ground.y }); water.push(ground.wet)
      }
      nodes.push(row); wet.push(water)
      costs.push(new Array(options).fill(Infinity)); previous.push(new Array(options).fill(middle))
    }
    nodes[0][middle] = { ...start }
    nodes[sections][middle] = { ...end }
    costs[0][middle] = 0
    for (let i = 1; i <= sections; i++) {
      for (let j = 0; j < options; j++) {
        if (i === sections && j !== middle) continue
        for (let k = 0; k < options; k++) {
          if (!Number.isFinite(costs[i - 1][k]) || Math.abs(k - j) > 2) continue
          const p = nodes[i - 1][k], q = nodes[i][j]
          const d = Math.hypot(q.x - p.x, q.z - p.z)
          const grade = Math.abs(q.y - p.y) / d
          const excess = Math.max(0, grade - MAX_GRADE)

          let deviation = 0, wetMid = 0
          for (const f of [1 / 3, 2 / 3]) {
            const ground = groundAt(lerp(p.x, q.x, f), lerp(p.z, q.z, f))
            deviation += Math.abs(ground.y - lerp(p.y, q.y, f))
            wetMid += ground.wet
          }
          const score = costs[i - 1][k] + d * (1 + grade * grade * 120 + excess * excess * 2_500) + deviation * d * 0.15 + (wet[i][j] + wetMid) * 700 + Math.abs(j - k) * 120
          if (score < costs[i][j]) { costs[i][j] = score; previous[i][j] = k }
        }
      }
    }
    const controls: Point3[] = []
    let cursor = middle
    for (let i = sections; i >= 0; i--) { controls.push(nodes[i][cursor]); cursor = previous[i][cursor] }
    controls.reverse()
    controls[0] = { ...start }
    controls[controls.length - 1] = { ...end }
    return spline([{ ...origin }, ...controls, { ...destination }], 12)
  }

  private finishRoad(id: string, from: string, to: string, kind: RoadKind, condition: RoadCondition, points: Point3[], followTerrain: boolean, towns: Town[] = []): Road {
    const n = points.length
    const spec = ROAD_SPEC[kind], half = spec.width / 2, core = half + spec.verge + 2
    const arc = new Float64Array(n)
    for (let i = 1; i < n; i++) arc[i] = arc[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
    const total = arc[n - 1] || 1
    const dirX = new Float64Array(n), dirZ = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      const p = points[Math.max(0, i - 1)], q = points[Math.min(n - 1, i + 1)]
      const length = Math.hypot(q.x - p.x, q.z - p.z) || 1
      dirX[i] = (q.x - p.x) / length; dirZ[i] = (q.z - p.z) / length
    }
    const natural = new Float64Array(n), sideLeft = new Float64Array(n), sideRight = new Float64Array(n)
    const farLeft = new Float64Array(n), farRight = new Float64Array(n)
    const waterTop = new Float64Array(n).fill(WATER_NONE), wet = new Uint8Array(n)
    const at = (i: number, offset: number) => this.terrain.surface(points[i].x - dirZ[i] * offset, points[i].z + dirX[i] * offset)
    for (let i = 0; i < n; i++) {
      const center = at(i, 0), left = at(i, -(half + 1)), right = at(i, half + 1)
      natural[i] = center.height
      const flooded = (s: typeof center) => s.waterLevel > WATER_NONE && s.height < s.waterLevel + 0.4

      if (flooded(center) || (flooded(left) && flooded(right))) {
        wet[i] = 1
        waterTop[i] = Math.max(center.waterLevel, left.waterLevel, right.waterLevel)
      }
      sideLeft[i] = at(i, -(core + 10)).height
      sideRight[i] = at(i, core + 10).height
      farLeft[i] = at(i, -(core + 60)).height
      farRight[i] = at(i, core + 60).height
    }
    const ys = new Float64Array(n)
    if (followTerrain) {
      const base = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        base[i] = wet[i] ? Math.max(natural[i], waterTop[i] + 1) : natural[i]

        for (const town of towns) {
          const w = 1 - smoothstep(town.radius * 0.75, town.radius * 1.35, Math.hypot(points[i].x - town.x, points[i].z - town.z))
          if (w > 0) base[i] = lerp(base[i], this.planeHeight(town, points[i].x, points[i].z), w)
        }
      }
      for (let i = 0; i < n; i++) {
        let sum = 0, weight = 0
        for (let k = -6; k <= 6; k++) { const w = 7 - Math.abs(k); sum += base[Math.max(0, Math.min(n - 1, i + k))] * w; weight += w }
        ys[i] = sum / weight
      }
    } else for (let i = 0; i < n; i++) ys[i] = points[i].y
    ys[0] = points[0].y; ys[n - 1] = points[n - 1].y
    const maxGrade = Math.max(MAX_GRADE, Math.abs(ys[n - 1] - ys[0]) / total + 0.001)
    const limit = () => {
      for (let i = 0; i < n; i++) {
        const lo = Math.max(ys[0] - arc[i] * maxGrade, ys[n - 1] - (total - arc[i]) * maxGrade)
        const hi = Math.min(ys[0] + arc[i] * maxGrade, ys[n - 1] + (total - arc[i]) * maxGrade)
        ys[i] = Math.max(lo, Math.min(hi, ys[i]))
      }
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 1; i < n - 1; i++) { const l = (arc[i] - arc[i - 1]) * maxGrade; ys[i] = Math.max(ys[i - 1] - l, Math.min(ys[i - 1] + l, ys[i])) }
        for (let i = n - 2; i > 0; i--) { const l = (arc[i + 1] - arc[i]) * maxGrade; ys[i] = Math.max(ys[i + 1] - l, Math.min(ys[i + 1] + l, ys[i])) }
      }
    }
    limit()
    const bridge = new Uint8Array(n)
    let bridged = false
    for (let i = 0; i < n; i++) if (wet[i]) for (let k = -2; k <= 2; k++) {
      const j = i + k
      if (j > 0 && j < n - 1) { bridge[j] = 1; bridged = true }
    }
    if (bridged) {
      const deck = new Float64Array(n).fill(-Infinity)
      for (let i = 0; i < n; i++) if (wet[i]) for (let k = -2; k <= 2; k++) {
        const j = i + k
        if (j >= 0 && j < n) deck[j] = Math.max(deck[j], waterTop[i] + 4.5)
      }
      for (let i = 1; i < n - 1; i++) if (bridge[i]) ys[i] = Math.max(ys[i], deck[i])

      for (let i = 1; i < n - 1; i++) ys[i] = Math.max(ys[i], ys[i - 1] - (arc[i] - arc[i - 1]) * maxGrade)
      for (let i = n - 2; i > 0; i--) ys[i] = Math.max(ys[i], ys[i + 1] - (arc[i + 1] - arc[i]) * maxGrade)
      limit()
    }

    for (let i = 1; i < n - 1; i++) if (ys[i] - natural[i] > 22) for (let k = -1; k <= 1; k++) {
      const j = i + k
      if (j > 0 && j < n - 1) bridge[j] = 1
    }

    const reachRaw = new Float64Array(n), earth = new Float32Array(n * EARTH_STRIDE)
    for (let i = 0; i < n; i++) {
      if (bridge[i]) { reachRaw[i] = 14; earth.set([0, 0, FILL_SLOPE, FILL_SLOPE, CUT_SLOPE, CUT_SLOPE], EARTH_STRIDE * i); continue }
      const sides = [sideLeft[i], sideRight[i], farLeft[i], farRight[i]]
      const fill = Math.max(0, ys[i] - natural[i], ...sides.map((h) => ys[i] - h))
      const cut = Math.max(0, natural[i] - ys[i], ...sides.map((h) => h - ys[i]))

      const face = (near: number, far: number) => ({
        fill: Math.max(FILL_SLOPE, Math.max(0, near - far) / 50 * 1.35),
        cut: Math.max(CUT_SLOPE, Math.max(0, far - near) / 50 * 1.35),
      })
      const left = face(sideLeft[i], farLeft[i]), right = face(sideRight[i], farRight[i])
      earth.set([fill, cut, left.fill, right.fill, left.cut, right.cut], EARTH_STRIDE * i)
      reachRaw[i] = Math.min(500, Math.max(14, Math.max(fill / Math.max(left.fill, right.fill), cut / Math.max(left.cut, right.cut)) * 1.8))
    }
    const clampIndex = (i: number) => Math.max(0, Math.min(n - 1, i))
    const widened = new Float64Array(n), reach = new Float32Array(n)
    for (let i = 0; i < n; i++) { let m = 0; for (let k = -4; k <= 4; k++) m = Math.max(m, reachRaw[clampIndex(i + k)]); widened[i] = m }
    for (let i = 0; i < n; i++) { let s = 0; for (let k = -4; k <= 4; k++) s += widened[clampIndex(i + k)]; reach[i] = s / 9 }
    const rails = new Uint8Array(n)
    if (kind === 'highway' || kind === 'country') {
      for (let i = 0; i < n; i++) {
        if (bridge[i]) continue
        if (ys[i] - sideLeft[i] > 3.2) rails[i] |= 1
        if (ys[i] - sideRight[i] > 3.2) rails[i] |= 2
      }
      for (const bit of [1, 2]) {
        for (let i = 1; i < n - 1; i++) if (!(rails[i] & bit) && (rails[i - 1] & bit) && ((rails[i + 1] & bit) || (i + 2 < n && rails[i + 2] & bit))) rails[i] |= bit
        let start = -1
        for (let i = 0; i <= n; i++) {
          const on = i < n && (rails[i] & bit) !== 0
          if (on && start < 0) start = i
          if (!on && start >= 0) { if (i - start < 3) for (let k = start; k < i; k++) rails[k] &= ~bit; start = -1 }
        }
      }
    }
    const normals = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      let ax = 0, az = 0, bx = 0, bz = 0
      if (i > 0) { const l = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z) || 1; ax = (points[i].x - points[i - 1].x) / l; az = (points[i].z - points[i - 1].z) / l }
      if (i < n - 1) { const l = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z) || 1; bx = (points[i + 1].x - points[i].x) / l; bz = (points[i + 1].z - points[i].z) / l }
      if (i === 0) { ax = bx; az = bz }
      if (i === n - 1) { bx = ax; bz = az }
      let mx = ax + bx, mz = az + bz
      const ml = Math.hypot(mx, mz)
      if (ml < 1e-6) { mx = bx; mz = bz } else { mx /= ml; mz /= ml }
      const cos = Math.max(0.55, mx * bx + mz * bz)
      normals[2 * i] = -mz / cos; normals[2 * i + 1] = mx / cos
    }
    return {
      id, from, to, kind, condition, width: spec.width, length: total,
      points: points.map((p, i) => ({ x: p.x, z: p.z, y: ys[i] })),
      bridge, reach, earth, rails, normals,
    }
  }

  private streets(town: Town) {
    const layout = this.layout(town)
    const roads: Road[] = []
    const add = (points: Point3[], suffix: string) => {
      const id = `${town.id}/street/${suffix}`
      const condition = conditionFor('street', randomAt(hashString(id), town.cx, this.terrain.seed ^ 33017))
      roads.push(this.finishRoad(id, town.id, `${town.id}/bairro/${suffix}`, 'street', condition, spline(points, 8), false))
    }
    for (let iz = -layout.halfZ; iz <= layout.halfZ; iz++) {
      const row: Point3[] = []
      for (let ix = layout.x0; ix <= layout.x1; ix++) row.push(layout.nodes.get(`${ix},${iz}`)!)
      add(row, `rua-${iz}`)
    }
    for (let ix = layout.x0; ix <= layout.x1; ix++) {
      if (!layout.columns[ix + layout.halfX]) continue
      const column: Point3[] = []
      for (let iz = -layout.halfZ; iz <= layout.halfZ; iz++) column.push(layout.nodes.get(`${ix},${iz}`)!)
      add(column, `travessa-${ix}`)
    }
    return roads
  }

  private joint(road: Road, i: number, side: number) {
    const n = road.points.length
    if (i < 2 || i > n - 3 || road.bridge[i - 2] || road.bridge[i] || road.bridge[i + 2]) return null
    const p = road.points[i], half = road.width / 2
    const length = Math.hypot(road.normals[2 * i], road.normals[2 * i + 1]) || 1
    const nx = road.normals[2 * i] / length * side, nz = road.normals[2 * i + 1] / length * side
    return {
      inner: { x: p.x + nx * (half - JOIN_OVERLAP), z: p.z + nz * (half - JOIN_OVERLAP), y: p.y },
      outer: { x: p.x + nx * (half + 16), z: p.z + nz * (half + 16), y: p.y },
      nx, nz,
    }
  }

  private keepsClear(points: Point3[], obstacles: Road[], half: number) {
    const first = points[0], last = points[points.length - 1]
    for (const p of points) {
      if (Math.hypot(p.x - first.x, p.z - first.z) < 30 || Math.hypot(p.x - last.x, p.z - last.z) < 30) continue
      for (const road of obstacles) {
        const reach = road.width / 2 + half + 6
        for (let i = 0; i < road.points.length - 1; i++) {
          const a = road.points[i], b = road.points[i + 1]
          if (p.x < Math.min(a.x, b.x) - reach || p.x > Math.max(a.x, b.x) + reach || p.z < Math.min(a.z, b.z) - reach || p.z > Math.max(a.z, b.z) + reach) continue
          if (distanceToSegment(p.x, p.z, { a, b } as RoadSegment).distance < reach) return false
        }
      }
    }
    return true
  }

  private dryPoint(x: number, z: number): Point3 | null {
    const s = this.terrain.surface(x, z)
    return s.waterLevel > WATER_NONE && s.height < s.waterLevel + 1 ? null : { x, z, y: s.height }
  }

  private spurs(regional: Road[], streets: Road[]) {
    const result: Road[] = [], obstacles = [...regional, ...streets]
    for (const road of regional) {
      const rng = randomSource(hashString(road.id) ^ this.terrain.seed)
      const count = Math.floor(rng() * 3.2)
      for (let k = 0; k < count; k++) {
        const i = Math.floor((0.12 + rng() * 0.76) * (road.points.length - 1))
        const side = rng() < 0.5 ? -1 : 1
        const depth = 130 + rng() * 260, loop = 240 + rng() * 360, bend = (rng() - 0.5) * 0.35
        const condition = conditionFor('track', rng())
        const start = this.joint(road, i, side)
        if (!start) continue
        let end: ReturnType<RoadNetwork['joint']> = null, to = road.id, best = Infinity
        for (const other of regional) {
          if (other === road) continue
          for (let j = 3; j < other.points.length - 3; j += 3) {
            const q = other.points[j]
            const vx = q.x - start.outer.x, vz = q.z - start.outer.z, distance = Math.hypot(vx, vz)
            if (distance < 160 || distance > 900 || distance >= best || (vx * start.nx + vz * start.nz) / distance < 0.72) continue

            const facing = -vx * other.normals[2 * j] - vz * other.normals[2 * j + 1] >= 0 ? 1 : -1
            const joint = this.joint(other, j, facing)
            if (joint) { best = distance; end = joint; to = other.id }
          }
        }
        let middle: (Point3 | null)[]
        if (end) {
          const dx = end.outer.x - start.outer.x, dz = end.outer.z - start.outer.z
          middle = [this.dryPoint((start.outer.x + end.outer.x) / 2 - dz * bend, (start.outer.z + end.outer.z) / 2 + dx * bend)]
        } else {
          let j = i, travelled = 0
          const step = i < road.points.length / 2 ? 1 : -1
          while (travelled < loop && j + step > 2 && j + step < road.points.length - 3) {
            j += step
            travelled += Math.hypot(road.points[j].x - road.points[j - step].x, road.points[j].z - road.points[j - step].z)
          }
          end = travelled >= loop * 0.75 ? this.joint(road, j, side) : null
          if (!end) continue
          const ox = start.nx + end.nx, oz = start.nz + end.nz, length = Math.hypot(ox, oz) || 1
          const ux = (end.outer.x - start.outer.x) * 0.14, uz = (end.outer.z - start.outer.z) * 0.14
          middle = [
            this.dryPoint(start.outer.x + ox / length * depth + ux, start.outer.z + oz / length * depth + uz),
            this.dryPoint(end.outer.x + ox / length * depth - ux, end.outer.z + oz / length * depth - uz),
          ]
        }
        if (middle.some((point) => !point)) continue
        const points = spline([start.inner, start.outer, ...(middle as Point3[]), end.outer, end.inner], 12)
        if (!this.keepsClear(points, obstacles, ROAD_SPEC.track.width / 2)) continue
        const track = this.finishRoad(`${road.id}/trilha-${k}`, road.id, to, 'track', condition, points, true)
        result.push(track); obstacles.push(track)
      }
    }
    return result
  }

  private buildRegion(cx: number, cz: number): Region {
    const town = this.terrain.town(cx, cz)
    const roads: Road[] = []
    const seed = this.terrain.seed
    if (!town.wet) {
      const parent = this.effectiveParent(cx, cz)
      const connect = (x: number, z: number, suffix: string) => {
        if (!this.valid(x, z)) return
        const target = this.terrain.town(x, z)
        if (target.wet) return
        const id = `${town.id}/${suffix}/${target.id}`
        const kind: RoadKind = randomAt(cx + x * 5, cz + z * 7, seed ^ 84821) < 0.42 ? 'highway' : 'country'
        const points = this.route(this.entry(town, target), this.entry(target, town), hash2(cx * 31 + x, cz * 17 + z, seed ^ 91371))
        roads.push(this.finishRoad(id, town.id, target.id, kind, conditionFor(kind, randomAt(cx * 3 + x, cz * 5 + z, seed ^ 55117)), points, true, [town, target]))
      }
      if (parent) connect(parent.x, parent.z, 'connection')
      for (const [dx, dz] of BYPASS_DIRS) if (this.bypass(cx, cz, dx, dz)) connect(cx + dx, cz + dz, 'bypass')
      const regional = [...roads], streets = this.streets(town)
      roads.push(...streets, ...this.spurs(regional, streets))
    }
    const segments: RoadSegment[] = [], keys = new Set<string>()
    for (const road of roads) {
      const spec = ROAD_SPEC[road.kind], half = spec.width / 2, core = half + spec.verge + 2
      const earthAt = (point: number, field: number) => road.earth[point * EARTH_STRIDE + field]
      let distance = 0
      for (let i = 0; i < road.points.length - 1; i++) {
        const a = road.points[i], b = road.points[i + 1]
        const length = Math.hypot(b.x - a.x, b.z - a.z)
        if (length < 0.01) continue
        const bridge = road.bridge[i] === 1 && road.bridge[i + 1] === 1
        const segment: RoadSegment = {
          a, b, road, index: i, roadId: road.id, kind: road.kind, condition: road.condition,
          width: spec.width, half, core, priority: spec.priority, distance, length, bridge,
          reachA: road.reach[i], reachB: road.reach[i + 1],
          fill: Math.max(earthAt(i, 0), earthAt(i + 1, 0)) > 0.5,
          cut: Math.max(earthAt(i, 1), earthAt(i + 1, 1)) > 0.5,
          fillSlopeL: Math.max(earthAt(i, 2), earthAt(i + 1, 2)), fillSlopeR: Math.max(earthAt(i, 3), earthAt(i + 1, 3)),
          cutSlopeL: Math.max(earthAt(i, 4), earthAt(i + 1, 4)), cutSlopeR: Math.max(earthAt(i, 5), earthAt(i + 1, 5)),
        }
        segments.push(segment); distance += length
        const pad = core + (bridge ? 2 : 2 * Math.max(segment.reachA, segment.reachB) + 2)
        for (let z = Math.floor((Math.min(a.z, b.z) - pad) / ROAD_BUCKET_SIZE); z <= Math.floor((Math.max(a.z, b.z) + pad) / ROAD_BUCKET_SIZE); z++) {
          for (let x = Math.floor((Math.min(a.x, b.x) - pad) / ROAD_BUCKET_SIZE); x <= Math.floor((Math.max(a.x, b.x) + pad) / ROAD_BUCKET_SIZE); x++) {
            const key = `${x},${z}`
            keys.add(key)
            const bucket = this.buckets.get(key)
            if (bucket) bucket.push(segment)
            else this.buckets.set(key, [segment])
          }
        }
      }
    }
    for (const key of keys) this.buckets.get(key)!.sort((a, b) => (a.roadId < b.roadId ? -1 : a.roadId > b.roadId ? 1 : 0) || a.distance - b.distance)
    return { town, roads, segments, buckets: keys }
  }

  prepare(bounds: Bounds) {
    const needed = new Set<string>()
    for (let cz = Math.floor(bounds.minZ / REGION_SIZE + 0.5) - 1; cz <= Math.floor(bounds.maxZ / REGION_SIZE + 0.5) + 1; cz++) {
      for (let cx = Math.floor(bounds.minX / REGION_SIZE + 0.5) - 1; cx <= Math.floor(bounds.maxX / REGION_SIZE + 0.5) + 1; cx++) {
        if (!this.valid(cx, cz)) continue
        const key = `${cx},${cz}`
        needed.add(key)
        const region = this.regions.get(key) ?? this.buildRegion(cx, cz)
        this.regions.delete(key); this.regions.set(key, region)
      }
    }
    for (const [key, region] of this.regions) {
      if (this.regions.size <= MAX_CACHED_REGIONS) break
      if (needed.has(key)) continue
      const stale = new Set(region.segments)
      for (const bucketKey of region.buckets) {
        const remaining = this.buckets.get(bucketKey)!.filter((segment) => !stale.has(segment))
        if (remaining.length) this.buckets.set(bucketKey, remaining)
        else this.buckets.delete(bucketKey)
      }
      this.regions.delete(key)
    }
  }

  regionRoads(cx: number, cz: number): Road[] {
    return this.regions.get(`${cx},${cz}`)?.roads ?? []
  }

  private bucketAt(x: number, z: number) {
    return this.buckets.get(`${Math.floor(x / ROAD_BUCKET_SIZE)},${Math.floor(z / ROAD_BUCKET_SIZE)}`)
  }

  segmentsAt(x: number, z: number): readonly RoadSegment[] {
    return this.bucketAt(x, z) ?? []
  }

  influence(x: number, z: number, ground?: { height: number }): RoadInfluence {
    const segments = this.bucketAt(x, z)
    let surfaceSum = 0, surfaceWeight = 0, weight = 0, core = 0, sink = 0
    let lower = -Infinity, upper = Infinity
    let distance = Infinity, width = 0, pavement = Infinity, nearY = 0
    let kind: RoadKind | null = null, dominant: RoadSegment | null = null, dominantScore = -Infinity, nearest: RoadSegment | null = null
    if (segments) for (const s of segments) {
      const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z
      const t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (z - s.a.z) * dz) / (s.length * s.length)))
      const d = Math.hypot(x - s.a.x - dx * t, z - s.a.z - dz * t)
      const y = s.a.y + (s.b.y - s.a.y) * t
      if (d < distance) { distance = d; width = s.width; kind = s.kind; nearest = s }
      const surfaceBlend = 1 - smoothstep(s.half + 0.5, s.core + 1, d)
      if (surfaceBlend > 0) {
        const w = surfaceBlend / (0.6 + d)
        surfaceSum += y * w; surfaceWeight += w
        if (d <= s.half + 0.3) {
          const score = s.priority * 1_000 - d
          if (score > dominantScore) { dominantScore = score; dominant = s }
        }
      }

      if (s.bridge) continue
      if (d - s.half < pavement) { pavement = d - s.half; nearY = y }
      const c = 1 - smoothstep(s.half + 1, s.core, d)
      if (c > core) core = c
      const k = 1 - smoothstep(s.half + 0.1, s.half + 1.4, d)
      if (k > sink) sink = k
      if (!ground) continue
      const reach = s.reachA + (s.reachB - s.reachA) * t
      const e = Math.max(0, d - s.core)
      if (e > reach * 2) continue
      weight = Math.max(weight, 1 - smoothstep(0, reach, e))

      const bend = Math.max(0, e - reach * 0.5)
      const run = e + bend * bend / reach
      const loose = EARTH_RELAX * (1 - c)

      const right = smoothstep(-2, 2, (dx * (z - s.a.z) - dz * (x - s.a.x)) / s.length)
      if (s.cut || c > 0) upper = Math.min(upper, y + lerp(s.cutSlopeL, s.cutSlopeR, right) * run + (s.cut ? 0 : loose))
      if (s.fill || c > 0) lower = Math.max(lower, y - lerp(s.fillSlopeL, s.fillSlopeR, right) * run - (s.fill ? 0 : loose))
    }
    const surface = surfaceWeight > 0 ? surfaceSum / surfaceWeight : nearY
    let height = ground?.height ?? surface
    if (ground) {
      const earthworks = lower > upper ? (lower + upper) / 2 : Math.max(lower, Math.min(upper, ground.height))

      height = lerp(earthworks, surface, core)
    }
    return { surface, height, weight, core, sink: sink * ROAD_SINK, distance, width, kind, pavement, nearY, dominant, nearest }
  }

  clearance(x: number, z: number, roadId: string) {
    const segments = this.bucketAt(x, z)
    let best = Infinity
    if (segments) for (const s of segments) {
      if (s.roadId === roadId) continue
      const value = distanceToSegment(x, z, s).distance - s.half
      if (value < best) best = value
    }
    return best
  }

  armsAt(x: number, z: number) {
    const arms: JunctionArm[] = []
    const passing = new Set<string>()
    const push = (dx: number, dz: number, s: RoadSegment, end: boolean, along: number, dir: 1 | -1) => {
      const angle = Math.atan2(dz, dx)
      arms.push({ angle: angle < 0 ? angle + Math.PI * 2 : angle, half: s.half, roadId: s.roadId, road: s.road, kind: s.kind, end, along, dir })
    }
    for (const s of this.bucketAt(x, z) ?? []) {
      const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z
      if (s.index === 0 && Math.hypot(s.a.x - x, s.a.z - z) < 0.75) { push(dx, dz, s, true, s.distance, 1); continue }
      if (s.index === s.road.points.length - 2 && Math.hypot(s.b.x - x, s.b.z - z) < 0.75) { push(-dx, -dz, s, true, s.distance + s.length, -1); continue }
      if (passing.has(s.roadId)) continue
      const { distance, t } = distanceToSegment(x, z, s)
      if (distance > s.half || t < 0 || t > 1) continue
      passing.add(s.roadId)
      push(dx, dz, s, false, s.distance + t * s.length, 1); push(-dx, -dz, s, false, s.distance + t * s.length, -1)
    }
    return arms.sort((a, b) => a.angle - b.angle)
  }

  segmentsIn(bounds: Bounds) {
    const result = new Set<RoadSegment>()
    for (let z = Math.floor(bounds.minZ / ROAD_BUCKET_SIZE); z <= Math.floor(bounds.maxZ / ROAD_BUCKET_SIZE); z++) {
      for (let x = Math.floor(bounds.minX / ROAD_BUCKET_SIZE); x <= Math.floor(bounds.maxX / ROAD_BUCKET_SIZE); x++) {
        for (const segment of this.buckets.get(`${x},${z}`) ?? []) {
          const margin = segment.half + 3.5
          if (Math.max(segment.a.x, segment.b.x) + margin < bounds.minX || Math.min(segment.a.x, segment.b.x) - margin > bounds.maxX) continue
          if (Math.max(segment.a.z, segment.b.z) + margin < bounds.minZ || Math.min(segment.a.z, segment.b.z) - margin > bounds.maxZ) continue
          result.add(segment)
        }
      }
    }
    return [...result]
  }

  atlasFeatures(bounds: Bounds) {
    const towns: Town[] = [], roads: Road[] = []
    for (const region of this.regions.values()) {
      const town = region.town
      if (!town.wet && town.x >= bounds.minX && town.x <= bounds.maxX && town.z >= bounds.minZ && town.z <= bounds.maxZ) towns.push(town)
      for (const road of region.roads) if (road.points.some((p) => p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ)) roads.push(road)
    }
    return { towns, roads }
  }

  get cacheSizes() { return { regions: this.regions.size, buckets: this.buckets.size } }
}
