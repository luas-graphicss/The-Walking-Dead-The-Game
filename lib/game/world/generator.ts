import { Terrain } from './terrain'
import { RoadNetwork, SIDEWALK, distanceToSegment } from './roads'
import { SidewalkPlanner, type CornerPiece, type SidewalkJunction, type SidewalkPlan, type SidewalkRun } from './sidewalks'
import { SettlementPlanner } from './settlements'
import { buildMassing } from './massing'
import { randomAt, randomSource, hash2, hashString, lerp, smoothstep, clamp01 } from './noise'
import { CHUNK_SIZE, FALL_TILE, FLOOR_KIND, LOD_SEGMENTS, TREE_CELL, WATER_NONE, WORLD_COLORS, chunkKey, type ChunkLod } from './settings'
import { channelSpeed } from './water-flow'
import type { AtlasData, Biome, Bounds, ChunkData, MeshData, Point2, Point3, Road, RoadInfluence, RoadSegment, TerrainPoint, Town } from './types'
import {
  BOULDERS, DEBRIS, GRASS, GUARDRAIL, LEAVES, LITTER_LAYER, LOGS, PEBBLES, POST_BEHIND_RAIL, ROAD_LAYER, ROAD_LAYERS, SIDEWALK_STYLES, SPECIES, STRUCTURE_LAYER, STUMPS, STUMP_FLARE,
  TERRAIN_LAYER, TERRAIN_SPLAT, TERRAIN_WET, TILE, TWIGS, UPROOTED_LOG, crownOf, dropsNeedles, pickVariant, railDepthAt,
} from '../assets/catalog'

const STANDS: Partial<Record<Biome, [number, number, number, number, number]>> = {
  forest: [0.34, 0.26, 0.14, 0.09, 0.11],
  denseForest: [0.22, 0.36, 0.06, 0.06, 0.24],
  pine: [0.03, 0.02, 0.03, 0.56, 0.3],
  meadow: [0.6, 0.16, 0.14, 0.05, 0.02],
  scrub: [0.42, 0.08, 0.08, 0.2, 0],
  highlands: [0.02, 0, 0.03, 0.3, 0.55],
  wetland: [0.16, 0.2, 0.46, 0.02, 0.06],
  river: [0.2, 0.22, 0.4, 0.02, 0.06],
  shore: [0.14, 0.04, 0.02, 0.72, 0],
}
const STAND_ORDER = [SPECIES.oak, SPECIES.maple, SPECIES.birch, SPECIES.pine, SPECIES.spruce]
function standSpecies(biome: Biome, roll: number) {
  const shares = STANDS[biome] ?? STANDS.forest!
  let sum = 0
  for (let i = 0; i < STAND_ORDER.length; i++) if (roll < (sum += shares[i])) return STAND_ORDER[i]
  return SPECIES.snag
}

const TREE_HEIGHT: [number, number][] = [[8, 21], [9, 26], [7, 16], [6, 27], [8, 19], [9, 25]]
const TREE_SPREAD = [0.36, 0.2, 0.18, 0.19, 0.2, 0.29]

const STATURE: Partial<Record<Biome, number>> = { highlands: 0.72, scrub: 0.7, shore: 0.82, denseForest: 1.1 }

const GRASS_DENSITY: Partial<Record<Biome, number>> = {
  meadow: 0.9, forest: 0.62, denseForest: 0.66, pine: 0.5, scrub: 0.55, highlands: 0.3, wetland: 0.75, river: 0.72, shore: 0.35, beach: 0.05,
}

type Color = [number, number, number]
type Vec = [number, number, number]
type Vert = { x: number; y: number; z: number; r: number; g: number; b: number; u: number; v: number }
type Line = { offset: number; width: number; color: Color; dash: number; gap: number }

function colorFromHex(hex: string): Color {
  return [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as Color
}
const GREEN = colorFromHex(WORLD_COLORS.vegetation)
const EARTH = colorFromHex(WORLD_COLORS.earth)
const STONE = colorFromHex(WORLD_COLORS.stone)
const WATER = colorFromHex(WORLD_COLORS.water)
const DEEP_WATER = colorFromHex(WORLD_COLORS.deepWater)
const FOAM = colorFromHex(WORLD_COLORS.foam)
const MARKING = colorFromHex(WORLD_COLORS.marking)
const PAINT = colorFromHex(WORLD_COLORS.paint)
const ASPHALT = colorFromHex(WORLD_COLORS.asphalt)
const SAND = colorFromHex(WORLD_COLORS.sand)
const METAL = colorFromHex(WORLD_COLORS.metal)
const CONCRETE = colorFromHex(WORLD_COLORS.concrete)
const LITTER = colorFromHex(WORLD_COLORS.litter)
const NEEDLES = colorFromHex(WORLD_COLORS.needles)
const mixColor = (a: Color, b: Color, t: number): Color => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const scaleColor = (a: Color, s: number): Color => [a[0] * s, a[1] * s, a[2] * s]

const relativeTo = (color: Color, base: Color): Color => [color[0] / base[0], color[1] / base[1], color[2] / base[2]]
const NEUTRAL: Color = [1, 1, 1]
const CURB_TINT: Color = [0.86, 0.86, 0.86]
const SKIRT_TINT: Color = [0.6, 0.6, 0.6]
const RUST_TINT = relativeTo(mixColor(METAL, EARTH, 0.35), METAL)

const SURFACE_BASE = {
  new: ASPHALT, worn: mixColor(ASPHALT, STONE, 0.32), broken: mixColor(mixColor(ASPHALT, STONE, 0.42), EARTH, 0.3), track: mixColor(EARTH, STONE, 0.18),
} as const
const UP: Vec = [0, 1, 0]
const WATER_NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

const FALL_SLOPE = 0.5

const FALL_AXES = 32
const FALL_AXIS_STEP = (Math.PI * 2) / FALL_AXES

const POST_SPACING = 1.905

const RAIL_SAMPLES = 12

const LEAF_TINTS: Color[] = [LITTER, scaleColor(LITTER, 0.8), mixColor(LITTER, EARTH, 0.35), mixColor(LITTER, GREEN, 0.25), mixColor(LITTER, PAINT, 0.12)].map((c) => relativeTo(c, LITTER))
const NEEDLE_TINTS: Color[] = [NEEDLES, scaleColor(NEEDLES, 0.85), mixColor(NEEDLES, LITTER, 0.5), mixColor(NEEDLES, EARTH, 0.25)].map((c) => relativeTo(c, NEEDLES))

const MARK_GAP = 0.75

const PAVEMENT_LIFT = 0.05

const JUNCTION_BLEND = 2.5

const JUNCTION_FADE = 4

const SIDEWALK_LIFT = 0.2
const KERB_FOOT = -0.03

const TIP = 0.9

const FRAGMENT_TINT: Color = [0.84, 0.82, 0.78]

type Ground = (x: number, z: number) => number

const PAVED_CLEARANCE = 0.03

const CLEARANCE_SAMPLES = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [1 / 3, 1 / 3, 1 / 3]] as const

function clearGround(mesh: MeshData, slots: (slot: number) => boolean, groundAt: Ground, x0: number, z0: number, clearance: number) {
  const { positions, indices, groups } = mesh
  if (!groups) return
  const raise = new Float32Array(positions.length / 3)
  let raised = false
  for (let g = 0; g < groups.length; g += 3) {
    if (!slots(groups[g + 2])) continue
    for (let t = groups[g]; t < groups[g] + groups[g + 1]; t += 3) {
      const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2]
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2]
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      const length = Math.hypot(nx, ny, nz)
      if (length < 1e-9 || Math.abs(ny) < 0.7 * length) continue
      let needed = 0
      for (const [wa, wb, wc] of CLEARANCE_SAMPLES) {
        const x = positions[a] * wa + positions[b] * wb + positions[c] * wc
        const y = positions[a + 1] * wa + positions[b + 1] * wb + positions[c + 1] * wc
        const z = positions[a + 2] * wa + positions[b + 2] * wb + positions[c + 2] * wc
        needed = Math.max(needed, groundAt(x + x0, z + z0) + clearance - y)
      }
      if (needed <= 0) continue
      raised = true
      for (const v of [a / 3, b / 3, c / 3]) raise[v] = Math.max(raise[v], needed)
    }
  }
  if (!raised) return
  const spot = (v: number) => `${Math.round(positions[v * 3] * 500)},${Math.round(positions[v * 3 + 1] * 500)},${Math.round(positions[v * 3 + 2] * 500)}`
  const lifts = new Map<string, number>()
  for (let v = 0; v < raise.length; v++) {
    if (raise[v] <= 0) continue
    const key = spot(v)
    lifts.set(key, Math.max(lifts.get(key) ?? 0, raise[v]))
  }
  for (let v = 0; v < raise.length; v++) {
    const lift = lifts.get(spot(v))
    if (lift) positions[v * 3 + 1] += lift
  }
}

const SPLAT_SCRATCH = new Float32Array(TERRAIN_SPLAT)

const STYLE_SHARES = SIDEWALK_STYLES.reduce<number[]>((shares, style) => [...shares, (shares[shares.length - 1] ?? 0) + style.weight], [])

const scaleVec = (v: Vec, s: number): Vec => [v[0] * s, v[1] * s, v[2] * s]
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

class MeshBuilder {
  positions: number[] = []
  normals: number[] = []
  colors: number[] = []
  indices: number[] = []
  uvs: number[] = []
  alphas: number[] = []
  layers: number[] = []
  constructor(readonly textured = false, readonly translucent = false) {}
  vertex(x: number, y: number, z: number, normal: Vec, color: Color, u = 0, v = 0, alpha = 1) {
    this.positions.push(x, y, z)
    this.normals.push(normal[0], normal[1], normal[2])
    this.colors.push(color[0], color[1], color[2])
    if (this.textured) this.uvs.push(u, v)
    if (this.translucent) this.alphas.push(alpha)
    return this.positions.length / 3 - 1
  }
  triangle(a: number, b: number, c: number, layer = 0) {
    this.indices.push(a, b, c)
    if (this.textured) this.layers.push(layer)
  }

  facing(a: number, b: number, c: number, normal: Vec, layer = 0) {
    const p = (id: number): Vec => [this.positions[id * 3], this.positions[id * 3 + 1], this.positions[id * 3 + 2]]
    const face = cross(sub(p(b), p(a)), sub(p(c), p(a)))
    if (dot(face, normal) >= 0) this.triangle(a, b, c, layer)
    else this.triangle(a, c, b, layer)
  }
  quad(corners: Vec[], uvs: [number, number][], normals: Vec[], color: Color, layer: number) {
    const ids = corners.map((p, k) => this.vertex(p[0], p[1], p[2], normals[k], color, uvs[k][0], uvs[k][1]))
    const normal = normals.reduce<Vec>((sum, n) => [sum[0] + n[0], sum[1] + n[1], sum[2] + n[2]], [0, 0, 0])
    this.facing(ids[0], ids[1], ids[2], normal, layer)
    this.facing(ids[0], ids[2], ids[3], normal, layer)
  }
  polygon(points: Point3[], color: Color) {
    if (points.length < 3) return
    const ids = points.map((p) => this.vertex(p.x, p.y, p.z, UP, color))
    for (let i = 1; i < ids.length - 1; i++) this.triangle(ids[0], ids[i], ids[i + 1])
  }
  verts(points: Vert[], ox: number, oz: number, normal: Vec = UP, layer = 0) {
    if (points.length < 3) return
    const ids = points.map((p) => this.vertex(p.x - ox, p.y, p.z - oz, normal, [p.r, p.g, p.b], p.u, p.v))
    for (let i = 1; i < ids.length - 1; i++) this.triangle(ids[0], ids[i], ids[i + 1], layer)
  }
  finish(): MeshData {
    const data: MeshData = { positions: new Float32Array(this.positions), normals: new Float32Array(this.normals), colors: new Float32Array(this.colors), indices: new Uint32Array(this.indices) }
    if (this.translucent) data.alphas = new Float32Array(this.alphas)
    if (!this.textured) return data
    data.uvs = new Float32Array(this.uvs)

    const counts: number[] = []
    for (const layer of this.layers) counts[layer] = (counts[layer] ?? 0) + 1
    const cursor: number[] = [], groups: number[] = []
    let start = 0
    for (let slot = 0; slot < counts.length; slot++) {
      cursor[slot] = start
      if (counts[slot]) { groups.push(start * 3, counts[slot] * 3, slot); start += counts[slot] }
    }
    for (let t = 0; t < this.layers.length; t++) {
      const k = cursor[this.layers[t]]++ * 3
      data.indices[k] = this.indices[t * 3]; data.indices[k + 1] = this.indices[t * 3 + 1]; data.indices[k + 2] = this.indices[t * 3 + 2]
    }
    data.groups = new Uint32Array(groups)
    return data
  }
}

function triangulate(points: [number, number][]) {
  const area = points.reduce((sum, [x0, y0], k) => { const [x1, y1] = points[(k + 1) % points.length]; return sum + x0 * y1 - x1 * y0 }, 0)
  const sign = area > 0 ? 1 : -1
  const turn = (o: [number, number], a: [number, number], b: [number, number]) => ((a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])) * sign
  const remaining = points.map((_, k) => k)
  const result: [number, number, number][] = []
  while (remaining.length > 3) {
    let clipped = false
    for (let k = 0; k < remaining.length && !clipped; k++) {
      const ia = remaining[(k + remaining.length - 1) % remaining.length], ib = remaining[k], ic = remaining[(k + 1) % remaining.length]
      const a = points[ia], b = points[ib], c = points[ic]
      if (turn(a, b, c) <= 1e-12) continue
      if (remaining.some((j) => j !== ia && j !== ib && j !== ic && turn(a, b, points[j]) > 0 && turn(b, c, points[j]) > 0 && turn(c, a, points[j]) > 0)) continue
      result.push([ia, ib, ic])
      remaining.splice(k, 1)
      clipped = true
    }
    if (!clipped) break
  }
  if (remaining.length === 3) result.push([remaining[0], remaining[1], remaining[2]])
  return result
}

function clipToBounds(input: Vert[], bounds: Bounds) {
  let polygon = input
  const clips: ['x' | 'z', number, number][] = [['x', bounds.minX, 1], ['x', bounds.maxX, -1], ['z', bounds.minZ, 1], ['z', bounds.maxZ, -1]]
  for (const [axis, limit, side] of clips) {
    const output: Vert[] = []
    if (!polygon.length) break
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length]
      const dp = (p[axis] - limit) * side, dq = (q[axis] - limit) * side
      if (dp >= 0) output.push(p)
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq)
        output.push({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t), z: lerp(p.z, q.z, t), r: lerp(p.r, q.r, t), g: lerp(p.g, q.g, t), b: lerp(p.b, q.b, t), u: lerp(p.u, q.u, t), v: lerp(p.v, q.v, t) })
      }
    }
    polygon = output
  }
  return polygon
}

const vert = (x: number, y: number, z: number, c: Color, u = 0, v = 0): Vert => ({ x, y, z, r: c[0], g: c[1], b: c[2], u, v })

function wind(points: Vert[], normal: Vec) {
  let nx = 0, ny = 0, nz = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length]
    nx += (p.y - q.y) * (p.z + q.z)
    ny += (p.z - q.z) * (p.x + q.x)
    nz += (p.x - q.x) * (p.y + q.y)
  }
  return nx * normal[0] + ny * normal[1] + nz * normal[2] >= 0 ? points : points.slice().reverse()
}

function emit(mesh: MeshBuilder, points: Vert[], normal: Vec, layer: number, bounds: Bounds) {
  mesh.verts(clipToBounds(wind(points, normal), bounds), bounds.minX, bounds.minZ, normal, layer)
}

function emitFlat(mesh: MeshBuilder, points: Vert[], layer: number, bounds: Bounds) {
  for (const [a, b, c] of triangulate(points.map((p) => [p.x, p.z] as [number, number]))) emit(mesh, [points[a], points[b], points[c]], UP, layer, bounds)
}

type XZ = [number, number]

function clipXZ(poly: XZ[], a: number, b: number, c: number): XZ[] {
  const out: XZ[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = a * p[0] + b * p[1] + c, sq = a * q[0] + b * q[1] + c
    if (sp >= 0) out.push(p)
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]) }
  }
  return out
}
const areaXZ = (poly: XZ[]) => Math.abs(poly.reduce((sum, p, i) => { const q = poly[(i + 1) % poly.length]; return sum + p[0] * q[1] - q[0] * p[1] }, 0)) / 2

function subtractStrip(pieces: XZ[][], s: RoadSegment): XZ[][] {
  const normals = s.road.normals, i = 2 * s.index, h = s.half
  const quad: XZ[] = [
    [s.a.x - normals[i] * h, s.a.z - normals[i + 1] * h], [s.b.x - normals[i + 2] * h, s.b.z - normals[i + 3] * h],
    [s.b.x + normals[i + 2] * h, s.b.z + normals[i + 3] * h], [s.a.x + normals[i] * h, s.a.z + normals[i + 1] * h],
  ]
  if (quad.reduce((sum, p, k) => { const q = quad[(k + 1) % 4]; return sum + p[0] * q[1] - q[0] * p[1] }, 0) < 0) quad.reverse()
  const out: XZ[][] = []
  for (const poly of pieces) {
    let rest = poly
    for (let k = 0; k < 4 && rest.length >= 3; k++) {
      const p = quad[k], q = quad[(k + 1) % 4], a = p[1] - q[1], b = q[0] - p[0], c = -(a * p[0] + b * p[1])
      out.push(clipXZ(rest, -a, -b, -c))
      rest = clipXZ(rest, a, b, c)
    }
  }
  return out.filter((p) => p.length >= 3 && areaXZ(p) > 1e-4)
}

const precedes = (a: RoadSegment, b: RoadSegment) => a.priority > b.priority || (a.priority === b.priority && a.roadId < b.roadId)

function outward(p: Point2, q: Point2, inside: Point2): Vec {
  const dx = q.x - p.x, dz = q.z - p.z, length = Math.hypot(dx, dz) || 1
  const nx = dz / length, nz = -dx / length
  return nx * ((p.x + q.x) / 2 - inside.x) + nz * ((p.z + q.z) / 2 - inside.z) < 0 ? [-nx, 0, -nz] : [nx, 0, nz]
}

function upright(mesh: MeshBuilder, p: Point2, q: Point2, feet: [number, number], tops: [number, number], out: Vec, color: Color, layer: number, bounds: Bounds, u = 0) {
  const length = Math.hypot(q.x - p.x, q.z - p.z), t = TILE.concrete
  if (length < 1e-3) return
  emit(mesh, [
    vert(p.x, feet[0], p.z, color, u, (tops[0] - feet[0]) / t), vert(q.x, feet[1], q.z, color, u + length / t, (tops[1] - feet[1]) / t),
    vert(q.x, tops[1], q.z, color, u + length / t, 0), vert(p.x, tops[0], p.z, color, u, 0),
  ], out, layer, bounds)
}

function arcBetween(p: Point2, q: Point2, center: Point2, step: number, steps?: number) {
  const start = Math.atan2(p.z - center.z, p.x - center.x)
  let sweep = Math.atan2(q.z - center.z, q.x - center.x) - start
  sweep -= Math.round(sweep / (Math.PI * 2)) * Math.PI * 2
  const r0 = Math.hypot(p.x - center.x, p.z - center.z), r1 = Math.hypot(q.x - center.x, q.z - center.z)
  const count = steps ?? Math.max(1, Math.ceil(Math.abs(sweep) / step))
  return Array.from({ length: count + 1 }, (_, j): Point2 => {
    if (j === 0) return p
    if (j === count) return q
    const angle = start + (sweep * j) / count, r = lerp(r0, r1, j / count)
    return { x: center.x + Math.cos(angle) * r, z: center.z + Math.sin(angle) * r }
  })
}

function pathLengths(points: Point2[]) {
  const lengths = [0]
  for (let j = 1; j < points.length; j++) lengths.push(lengths[j - 1] + Math.hypot(points[j].x - points[j - 1].x, points[j].z - points[j - 1].z))
  return lengths
}

function bandV(run: SidewalkRun, along: number) {
  const length = run.to - run.from
  if (run.start === 'joint' && run.end === 'joint') return ((along - run.from) / length) * Math.max(1, Math.round(length / TILE.sidewalk))
  return run.end === 'joint' ? (along - run.to) / TILE.sidewalk : (along - run.from) / TILE.sidewalk
}

function basisAlong(a: Point3, b: Point3, keepVertical = false) {
  const dx = b.x - a.x, dy = keepVertical ? 0 : b.y - a.y, dz = b.z - a.z
  const h = Math.hypot(dx, dz) || 1, length = Math.hypot(dx, dy, dz) || 1
  const ax: Vec = [dx / length, dy / length, dz / length]
  const az: Vec = [-dz / h, 0, dx / h]
  const ay: Vec = [-dx * dy / (h * length), (h * h) / (h * length), -dz * dy / (h * length)]
  return { ax, ay, az, length }
}

function quaternionFromBasis(ax: Vec, ay: Vec, az: Vec): [number, number, number, number] {
  const m00 = ax[0], m01 = ay[0], m02 = az[0], m10 = ax[1], m11 = ay[1], m12 = az[1], m20 = ax[2], m21 = ay[2], m22 = az[2]
  const trace = m00 + m11 + m22
  if (trace > 0) { const s = 0.5 / Math.sqrt(trace + 1); return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s] }
  if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s] }
  if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s] }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
}

const normalize = (v: Vec): Vec => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

function orient(yaw: number, normal: Vec) {
  const dx = Math.cos(yaw), dz = Math.sin(yaw), along = dx * normal[0] + dz * normal[2]
  const ax = normalize([dx - normal[0] * along, -normal[1] * along, dz - normal[2] * along])
  return quaternionFromBasis(ax, normal, cross(ax, normal))
}

function treeCover(trees: number[], radius: number, closed: number) {
  const n = Math.ceil(CHUNK_SIZE / radius), r2 = radius * radius
  const bucket = (v: number) => Math.max(0, Math.min(n - 1, Math.floor(v / radius)))
  const buckets: number[][] = Array.from({ length: n * n }, () => [])
  for (let i = 0; i < trees.length; i += 8) buckets[bucket(trees[i + 2]) * n + bucket(trees[i])].push(i)
  const inside = (d: number) => d >= radius ? 1 : 1 - (r2 * Math.acos(Math.max(0, d) / radius) - Math.max(0, d) * Math.sqrt(r2 - d * d)) / (Math.PI * r2)
  return (lx: number, lz: number) => {
    let weight = 0
    const bx = bucket(lx), bz = bucket(lz)
    for (let z = Math.max(0, bz - 1); z <= Math.min(n - 1, bz + 1); z++) for (let x = Math.max(0, bx - 1); x <= Math.min(n - 1, bx + 1); x++) {
      for (const i of buckets[z * n + x]) {
        const d = Math.hypot(trees[i] - lx, trees[i + 2] - lz)
        if (d < radius) weight += 1 - d / radius
      }
    }
    const share = inside(lx) * inside(CHUNK_SIZE - lx) * inside(lz) * inside(CHUNK_SIZE - lz)
    return Math.min(1, weight / (Math.PI * r2 / 3) / Math.max(0.3, share) / closed)
  }
}

export class WorldGenerator {
  readonly terrain: Terrain
  readonly network: RoadNetwork
  readonly sidewalks: SidewalkPlanner
  readonly settlements: SettlementPlanner
  constructor(readonly seed: string) {
    this.terrain = new Terrain(seed)
    this.network = new RoadNetwork(this.terrain)
    this.sidewalks = new SidewalkPlanner(this.network, this.terrain)
    this.settlements = new SettlementPlanner(this.terrain, this.network)
  }

  prepare(bounds: Bounds) {
    this.network.prepare({ minX: bounds.minX - 32, minZ: bounds.minZ - 32, maxX: bounds.maxX + 32, maxZ: bounds.maxZ + 32 })
  }

  private compose(road: RoadInfluence) {
    return road.height - road.sink
  }

  height(x: number, z: number) {
    const road = this.network.influence(x, z, this.terrain.surface(x, z))
    return this.settlements.shape(x, z, this.compose(road), road.core, 0)
  }

  roadSurface(x: number, z: number) {
    const road = this.network.influence(x, z)
    return road.dominant ? road.surface : null
  }

  private canopy(sample: TerrainPoint) {
    const cover = sample.biome === 'denseForest' ? 1 : sample.biome === 'forest' ? 0.72 : sample.biome === 'pine' ? 0.62 + sample.dense * 0.3
      : sample.biome === 'river' || sample.biome === 'wetland' ? 0.4 : sample.biome === 'meadow' ? 0.12 : sample.biome === 'scrub' ? 0.1 : 0
    return cover * (0.4 + 0.6 * smoothstep(0.15, 0.85, sample.forest)) * (1 - sample.sand)
  }

  private groundSplat(x: number, z: number, sample: TerrainPoint, slope: number, road: RoadInfluence, height: number, town: Town, out: Uint8Array, offset: number) {
    const w = SPLAT_SCRATCH
    w.fill(0)
    const L = TERRAIN_LAYER, layers = TERRAIN_SPLAT - 1
    const { detail, climate } = this.terrain
    const patch = detail.at(x / 23 + 7.1, z / 23 - 3.3)
    const fine = detail.at(x / 8.5 - 4.2, z / 8.5 + 1.7)
    const drift = climate.at(x / 260 + 13, z / 260 - 9)
    const biome = sample.biome
    const scale = (factor: number) => { for (let i = 0; i < layers; i++) w[i] *= factor }

    const dryness = clamp01(0.22 - sample.moisture * 0.65 + detail.at(x / 85, z / 85) * 0.19 + drift * 0.08
      + (biome === 'scrub' ? 0.38 : biome === 'shore' ? 0.28 : biome === 'highlands' ? 0.22 : 0))
    w[L.meadow] = 1 - dryness
    w[L.dry] = dryness
    w[L.soil] = smoothstep(0.4, 0.85, dryness) * smoothstep(0.15, 0.65, fine) * 0.8

    const canopy = this.canopy(sample)
    if (canopy > 0.02) {
      const cover = Math.min(1, canopy * (1.05 + 0.35 * patch))
      w[L.meadow] *= 1 - cover; w[L.dry] *= 1 - cover; w[L.soil] *= 1 - cover
      const moss = clamp01(0.22 + sample.moisture * 0.55 - patch * 0.45 + fine * 0.15) * (biome === 'denseForest' ? 0.75 : 1)
      if (biome === 'pine') {
        w[L.needles] += cover * (1 - moss * 0.35)
        w[L.moss] += cover * moss * 0.35
      } else {
        w[L.litter] += cover * (1 - moss)
        w[L.moss] += cover * moss
      }

      w[L.soil] += cover * smoothstep(0.5, 0.85, fine) * 0.55
    }

    const cliff = smoothstep(0.62, 1.05, slope)
    const talus = smoothstep(0.34, 0.66, slope) * (1 - cliff)
    const alpine = smoothstep(540, 760, height + drift * 70 + patch * 25)
    const relief = Math.max(cliff, talus * 0.85, alpine * 0.9)
    if (relief > 0) scale(1 - relief)
    w[L.soil] += talus * 0.55 * (1 - alpine)
    w[L.scree] += talus * (0.35 + alpine * 0.8) + (biome === 'highlands' ? 0.3 * smoothstep(-0.25, 0.45, patch) : 0)
    w[L.rock] += cliff * 2.4
    w[L.summit] += alpine * (1 - cliff) * (0.55 + 0.45 * smoothstep(-0.4, 0.4, patch + drift * 0.5)) * 1.3
    w[L.dry] += alpine * (1 - cliff) * 0.35 * smoothstep(0.1, 0.6, fine)

    if (sample.sand > 0) {
      scale(1 - sample.sand)
      w[L.sand] += sample.sand * 1.2
    }

    let wet = biome === 'wetland' ? 0.3 : 0
    if (sample.waterLevel > WATER_NONE) {
      const above = height - sample.waterLevel
      if (above < 0) {
        scale(0)
        if (sample.water === 'ocean') w[L.sand] = 1
        else { w[L.soil] = 0.65; w[L.scree] = 0.35 + 0.3 * smoothstep(0, 0.6, fine) }
        wet = 1
      } else if (sample.water !== 'ocean') {
        const bank = 1 - smoothstep(0.15, 2.4, above)
        scale(1 - bank * 0.7)
        w[L.soil] += bank * 0.75
        w[L.moss] += bank * 0.25 * smoothstep(-0.2, 0.4, patch)
        wet = Math.max(wet, bank)
      } else {
        wet = Math.max(wet, 1 - smoothstep(0.1, 1.4, above))
      }
    }

    if (road.kind !== null && road.pavement < 14) {
      const p = road.pavement, track = road.kind === 'track'
      const shoulder = 1 - smoothstep(track ? 0.6 : 0.15, track ? 1.8 : 0.95, p)
      const reach = (road.kind === 'street' ? SIDEWALK + 5.5 : track ? 2.5 : 5) + patch * 1.4
      const verge = (1 - shoulder) * (1 - smoothstep(reach, reach + 3.5, p)) * (track ? 0.55 : 1) * (1 - cliff)
      scale(1 - Math.max(shoulder, verge))
      w[L.soil] += shoulder * (track ? 1 : 0.75)
      w[L.scree] += shoulder * (track ? 0.15 : 0.35)
      w[L.verge] += verge * 1.25
    }

    if (!town.wet) {
      const lawn = (1 - smoothstep(town.radius * 0.55, town.radius * 1.05, Math.hypot(x - town.x, z - town.z))) * (1 - canopy) * (1 - relief) * (1 - sample.sand)
      if (lawn > 0) { w[L.verge] += lawn * 0.8; w[L.meadow] *= 1 - lawn * 0.5; w[L.dry] *= 1 - lawn * 0.6 }
    }
    let sum = 0
    for (let i = 0; i < layers; i++) sum += w[i]
    if (sum <= 1e-6) { w[L.soil] = 1; sum = 1 }
    for (let i = 0; i < layers; i++) out[offset + i] = Math.round((w[i] / sum) * 255)
    out[offset + TERRAIN_WET] = Math.round(clamp01(wet) * 255)
  }

  private groundTint(x: number, z: number, sample: TerrainPoint, road: RoadInfluence): Color {
    const { detail, climate } = this.terrain
    const tone = 0.95 + detail.at(x / 18, z / 18) * 0.045 + climate.at(x / 140 + 3, z / 140 - 5) * 0.05
    const dryness = clamp01(0.22 - sample.moisture * 0.65)
    const shade = 1 - this.canopy(sample) * 0.2
    const sink = road.sink > 0 ? 1 - Math.min(0.32, road.sink * 2.2) : 1
    const v = tone * shade * sink
    return [v * (1 + dryness * 0.05), v, v * (1 - dryness * 0.06)]
  }

  private sidewalkLayer(road: Road) {
    const anchor = road.points[Math.floor(road.points.length / 2)]
    const town = this.terrain.nearestTown(anchor.x, anchor.z)
    const roll = randomAt(town.cx, town.cz, this.terrain.seed ^ 0x51d3)
    const style = STYLE_SHARES.findIndex((share) => roll < share)
    return style < 0 ? ROAD_LAYER.sidewalk : ROAD_LAYERS.length + style
  }

  private roadColor(s: RoadSegment, x: number, z: number): Color {
    const patch = this.terrain.detail.at(x / 7.5 + 41, z / 7.5 - 17)
    const grain = 0.94 + this.terrain.detail.at(x / 2.2, z / 2.2) * 0.06
    let color: Color
    if (s.kind === 'track') color = mixColor(EARTH, STONE, 0.14 + patch * 0.08)
    else if (s.condition === 'new') color = patch > 0.55 ? mixColor(ASPHALT, STONE, 0.15) : ASPHALT
    else if (s.condition === 'worn') color = mixColor(mixColor(ASPHALT, STONE, 0.32), scaleColor(ASPHALT, 0.82), patch > 0.35 ? 0.7 : 0)
    else color = mixColor(mixColor(ASPHALT, STONE, 0.42), EARTH, clamp01(patch * 0.6 + 0.15))
    return scaleColor(color, grain)
  }

  private surfaceLayer(s: RoadSegment) {
    return s.kind === 'track' ? ROAD_LAYER.dirt : s.condition === 'new' ? ROAD_LAYER.asphalt : ROAD_LAYER.cracked
  }

  private roadTint(s: RoadSegment, x: number, z: number): Color {
    const tint = relativeTo(this.roadColor(s, x, z), SURFACE_BASE[s.kind === 'track' ? 'track' : s.condition])
    return [Math.min(1.5, Math.max(0.55, tint[0])), Math.min(1.5, Math.max(0.55, tint[1])), Math.min(1.5, Math.max(0.55, tint[2]))]
  }

  private blendTint(texture: RoadSegment, from: RoadSegment, to: RoadSegment, w: number, x: number, z: number): Color {
    const tint = relativeTo(mixColor(this.roadColor(from, x, z), this.roadColor(to, x, z), w), SURFACE_BASE[texture.kind === 'track' ? 'track' : texture.condition])
    return [Math.min(1.5, Math.max(0.55, tint[0])), Math.min(1.5, Math.max(0.55, tint[1])), Math.min(1.5, Math.max(0.55, tint[2]))]
  }

  private railFace(road: Road) {
    return road.width / 2 + (road.kind === 'street' ? SIDEWALK : 0) + GUARDRAIL.railOffset
  }

  private railAt(road: Road, k: number, side: -1 | 1, roadSeed: number) {
    if (k < 0 || k >= road.points.length - 1) return false
    const bit = side < 0 ? 1 : 2
    if (!(road.rails[k] & bit) || !(road.rails[k + 1] & bit)) return false
    if (road.bridge[k] === 1 && road.bridge[k + 1] === 1) return false
    if (road.condition === 'broken' && randomAt(k, side, roadSeed) < 0.35) return false
    const a = road.points[k], b = road.points[k + 1], reach = side * (this.railFace(road) + POST_BEHIND_RAIL)
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const x = a.x + (b.x - a.x) * f + (road.normals[2 * k] + (road.normals[2 * k + 2] - road.normals[2 * k]) * f) * reach
      const z = a.z + (b.z - a.z) * f + (road.normals[2 * k + 1] + (road.normals[2 * k + 3] - road.normals[2 * k + 1]) * f) * reach
      if (this.network.clearance(x, z, road.id) < SIDEWALK + 1) return false
    }
    return true
  }

  private junctionFill(mesh: MeshBuilder, s: RoadSegment, node: Point3, bounds: Bounds, lod: ChunkLod) {
    const arms = this.network.armsAt(node.x, node.z)
    const drawer = arms.filter((arm) => arm.end).sort((a, b) => b.half - a.half || (a.roadId < b.roadId ? -1 : 1))[0]
    if (arms.length < 2 || drawer?.roadId !== s.roadId) return
    const step = lod === 0 ? 0.18 : 0.4
    const at = (angle: number, radius: number) => ({ x: node.x + Math.cos(angle) * radius, z: node.z + Math.sin(angle) * radius })

    const reach = Math.max(...arms.map((arm) => arm.half)) + 1
    const roads = this.network.segmentsIn({ minX: node.x - reach, maxX: node.x + reach, minZ: node.z - reach, maxZ: node.z + reach })
      .filter((o) => Math.abs(o.a.y + (o.b.y - o.a.y) * clamp01(distanceToSegment(node.x, node.z, o).t) - node.y) < 0.6)
    for (let k = 0; k < arms.length; k++) {
      const a = arms[k], b = arms[(k + 1) % arms.length]
      const gap = b.angle - a.angle + (k === arms.length - 1 ? Math.PI * 2 : 0)
      const sweep = gap - Math.PI
      if (sweep < 0.03) continue
      const steps = Math.ceil(sweep / step)
      let previous = at(a.angle + Math.PI / 2, a.half)
      for (let j = 1; j <= steps; j++) {
        const t = j / steps
        const next = at(a.angle + Math.PI / 2 + sweep * t, lerp(a.half, b.half, t))
        let pieces: XZ[][] = [[[node.x, node.z], [previous.x, previous.z], [next.x, next.z]]]
        for (const o of roads) pieces = subtractStrip(pieces, o)
        for (const piece of pieces) {
          const points = piece.map(([x, z]) => {
            const influence = this.network.influence(x, z)
            return vert(x, influence.surface + PAVEMENT_LIFT, z, this.roadTint(influence.dominant ?? s, x, z), (x - bounds.minX) / TILE.asphalt, -(z - bounds.minZ) / TILE.asphalt)
          })
          mesh.verts(clipToBounds(points, bounds), bounds.minX, bounds.minZ, UP, this.surfaceLayer(s))
        }
        previous = next
      }
    }
  }

  private crumbling(x: number, z: number) {
    return this.terrain.detail.at(x / 5 + 7.3, z / 5 - 3.1) <= 0.15
  }

  private markingLines(s: RoadSegment, curved: boolean): Line[] {
    const half = s.half
    if (s.kind === 'highway') return [
      { offset: -0.2, width: 0.14, color: PAINT, dash: 0, gap: 0 },
      { offset: 0.2, width: 0.14, color: PAINT, dash: 0, gap: 0 },
      { offset: -half / 2, width: 0.14, color: MARKING, dash: 4, gap: 8 },
      { offset: half / 2, width: 0.14, color: MARKING, dash: 4, gap: 8 },
      { offset: -(half - 0.55), width: 0.18, color: MARKING, dash: 0, gap: 0 },
      { offset: half - 0.55, width: 0.18, color: MARKING, dash: 0, gap: 0 },
    ]
    if (s.kind === 'country') return [
      { offset: 0, width: 0.14, color: PAINT, dash: curved ? 0 : 4, gap: 8 },
      { offset: -(half - 0.45), width: 0.15, color: MARKING, dash: 0, gap: 0 },
      { offset: half - 0.45, width: 0.15, color: MARKING, dash: 0, gap: 0 },
    ]
    if (s.kind === 'street') return [{ offset: 0, width: 0.13, color: PAINT, dash: 3, gap: 5 }]
    return []
  }

  private buildRoads(bounds: Bounds, lod: ChunkLod, groundAt: Ground) {
    const asphalt = new MeshBuilder(true), paint = new MeshBuilder(true), props = new MeshBuilder(true)
    const solids: number[] = [], debris: number[] = [], posts: number[] = []
    const ox = bounds.minX, oz = bounds.minZ
    const pieceLength = lod === 0 ? 3 : lod === 1 ? 6 : 12
    const seed = this.terrain.seed
    const owns = (x: number, z: number) => x >= bounds.minX && x < bounds.maxX && z >= bounds.minZ && z < bounds.maxZ
    const near = (x: number, z: number, margin: number) => x >= bounds.minX - margin && x <= bounds.maxX + margin && z >= bounds.minZ - margin && z <= bounds.maxZ + margin
    const addSolid = (center: Point3, ax: Vec, ay: Vec, az: Vec, hx: number, hy: number, hz: number) => {
      if (lod !== 0) return
      solids.push(center.x - ox, center.y, center.z - oz, ...quaternionFromBasis(ax, ay, az), hx, hy, hz)
    }

    const planar = (x: number, z: number, tile: number): [number, number] => [(x - ox) / tile, -(z - oz) / tile]
    const streets = new Set<Road>()

    for (const s of this.network.segmentsIn(bounds)) {
      const road = s.road, i = s.index, half = s.half
      const street = s.kind === 'street'
      const stations = lod === 2 ? [-half, half] : lod === 1 ? [-half, 0, half] : [-half, -half / 2, 0, half / 2, half]
      const lanes = stations
      const cols = lanes.length
      const pieces = Math.max(1, Math.ceil(s.length / pieceLength))
      const rows = pieces + 1
      const n0x = road.normals[2 * i], n0z = road.normals[2 * i + 1]
      const n1x = road.normals[2 * i + 2], n1z = road.normals[2 * i + 3]
      const posAt = (f: number, offset: number) => ({
        x: s.a.x + (s.b.x - s.a.x) * f + (n0x + (n1x - n0x) * f) * offset,
        z: s.a.z + (s.b.z - s.a.z) * f + (n0z + (n1z - n0z) * f) * offset,
      })
      const px = new Float64Array(rows * cols), pz = new Float64Array(rows * cols), py = new Float64Array(rows * cols), lift = new Float64Array(rows * cols)
      const colors: Color[] = new Array(rows * cols)
      const computed = new Uint8Array(rows)
      const reachOut = half + SIDEWALK + pieceLength + 1
      for (let u = 0; u < rows; u++) {
        const f = u / pieces, last = u === pieces
        const cx = last ? s.b.x : s.a.x + (s.b.x - s.a.x) * f
        const cz = last ? s.b.z : s.a.z + (s.b.z - s.a.z) * f
        if (!near(cx, cz, reachOut)) continue
        computed[u] = 1
        const lx = last ? n1x : n0x + (n1x - n0x) * f
        const lz = last ? n1z : n0z + (n1z - n0z) * f
        for (let c = 0; c < cols; c++) {
          const x = cx + lx * lanes[c], z = cz + lz * lanes[c]
          const influence = this.network.influence(x, z)
          const id = u * cols + c
          px[id] = x; pz[id] = z; py[id] = influence.surface
          lift[id] = PAVEMENT_LIFT
          colors[id] = this.roadTint(influence.dominant ?? s, x, z)
        }
      }
      const heightAt = (f: number, offset: number) => {
        const uf = Math.min(pieces - 1e-9, Math.max(0, f * pieces)), u = Math.floor(uf), tu = uf - u
        let c = 0
        while (c < cols - 2 && lanes[c + 1] < offset) c++
        const tc = clamp01((offset - lanes[c]) / (lanes[c + 1] - lanes[c]))
        const id = u * cols + c
        return lerp(lerp(py[id], py[id + 1], tc), lerp(py[id + cols], py[id + cols + 1], tc), tu)
      }
      const lateralAt = (f: number): Vec => normalize([n0x + (n1x - n0x) * f, 0, n0z + (n1z - n0z) * f])

      const alongAt = (f: number, tile: number) => ((s.distance % tile) + f * s.length) / tile
      const surface = this.surfaceLayer(s)

      const pad = half + 12
      const rivals = this.network.segmentsIn({ minX: Math.min(s.a.x, s.b.x) - pad, maxX: Math.max(s.a.x, s.b.x) + pad, minZ: Math.min(s.a.z, s.b.z) - pad, maxZ: Math.max(s.a.z, s.b.z) + pad })
        .filter((o) => o.roadId !== s.roadId && precedes(o, s))

      for (let u = 0; u < pieces; u++) {
        if (!computed[u] || !computed[u + 1]) continue
        for (let c = 0; c < cols - 1; c++) {
          const ids = [u * cols + c, u * cols + c + 1, (u + 1) * cols + c + 1, (u + 1) * cols + c]
          const mx = ids.reduce((sum, id) => sum + px[id], 0) / 4, mz = ids.reduce((sum, id) => sum + pz[id], 0) / 4, my = ids.reduce((sum, id) => sum + py[id], 0) / 4
          const radius = Math.max(...ids.map((id) => Math.hypot(px[id] - mx, pz[id] - mz)))
          const relevant = rivals.filter((o) => {
            const { distance, t } = distanceToSegment(mx, mz, o)
            return distance - o.half < radius + JUNCTION_FADE && Math.abs(o.a.y + (o.b.y - o.a.y) * clamp01(t) - my) < 0.6
          })
          if (!relevant.length) {
            asphalt.verts(clipToBounds(ids.map((id) => vert(px[id], py[id] + lift[id], pz[id], colors[id], ...planar(px[id], pz[id], TILE.asphalt))), bounds), ox, oz, UP, surface)
            continue
          }

          let parts: XZ[][] = [ids.map((id) => [px[id], pz[id]] as XZ)]
          for (const o of relevant) parts = subtractStrip(parts, o)
          for (const part of parts) {
            const cx = part.reduce((sum, p) => sum + p[0], 0) / part.length, cz = part.reduce((sum, p) => sum + p[1], 0) / part.length
            let host: RoadSegment = s, best = Infinity
            for (const o of relevant) { const gap = distanceToSegment(cx, cz, o).distance - o.half; if (gap < best) { best = gap; host = o } }

            const texture = best < JUNCTION_BLEND * (0.6 + 0.8 * this.terrain.detail.at(cx / 1.3 + 11, cz / 1.3 - 5)) ? host : s

            const points = part.map(([x, z]) => {
              let near: RoadSegment = host, gap = Infinity
              for (const o of relevant) { const g = distanceToSegment(x, z, o).distance - o.half; if (g < gap) { gap = g; near = o } }
              return vert(x, this.network.influence(x, z).surface + PAVEMENT_LIFT, z, this.blendTint(texture, near, s, smoothstep(0, JUNCTION_FADE, gap), x, z), ...planar(x, z, TILE.asphalt))
            })
            asphalt.verts(clipToBounds(points, bounds), ox, oz, UP, this.surfaceLayer(texture))
          }
        }

        if (lod > 0) for (const c of [0, cols - 1]) {
          const a = u * cols + c, b = (u + 1) * cols + c
          const ua = alongAt(u / pieces, TILE.dirt), ub = alongAt((u + 1) / pieces, TILE.dirt), depth = -6.05 / TILE.dirt
          const outward = scaleVec(lateralAt((u + 0.5) / pieces), c === 0 ? -1 : 1)
          asphalt.verts(clipToBounds([vert(px[a], py[a] + lift[a], pz[a], SKIRT_TINT, ua, 0), vert(px[b], py[b] + lift[b], pz[b], SKIRT_TINT, ub, 0), vert(px[b], py[b] - 6, pz[b], SKIRT_TINT, ub, depth), vert(px[a], py[a] - 6, pz[a], SKIRT_TINT, ua, depth)], bounds), ox, oz, outward, ROAD_LAYER.dirt)
        }
      }
      for (const [isEnd, end] of [[i === 0, s.a], [i === road.points.length - 2, s.b]] as const) {
        if (isEnd && near(end.x, end.z, half + 1)) this.junctionFill(asphalt, s, end, bounds, lod)
      }
      if (street) {
        streets.add(road)
        this.sidewalkStrip(asphalt, s, this.sidewalks.plan(road), pieces, bounds, lod, groundAt)
      }

      if (lod < 2) {
        const length0 = Math.hypot(n0x, n0z) || 1, length1 = Math.hypot(n1x, n1z) || 1
        const curved = Math.abs((n0x / length0) * (n1z / length1) - (n0z / length0) * (n1x / length1)) > 0.06
        const lines = this.markingLines(s, curved)
        if (lines.length) {
          const fade = s.condition === 'new' ? 0 : s.condition === 'worn' ? 0.4 : 0.6
          const loss = s.condition === 'new' ? 0 : s.condition === 'worn' ? 0.2 : 0.65
          const roadSeed = hashString(s.roadId) ^ seed
          const count = Math.max(1, Math.round(s.length / 1.5))
          for (let k = 0; k < count; k++) {
            const fa = k / count, fb = (k + 1) / count, fm = (fa + fb) / 2
            const ua = Math.floor(fa * pieces), ub = Math.min(pieces, Math.ceil(fb * pieces))
            if (!computed[ua] || !computed[ub]) continue
            const center = posAt(fm, 0)
            if (!near(center.x, center.z, half)) continue
            const clear = this.network.clearance(center.x, center.z, s.roadId)
            if (clear < -half - MARK_GAP) continue

            const open = clear > half + MARK_GAP + 1
            const free = (lo: number, hi: number) => open || [fa, fb].every((f) => [lo, hi].every((o) => {
              const p = posAt(f, o)
              return this.network.clearance(p.x, p.z, s.roadId) >= MARK_GAP
            }))
            const along = s.distance + fm * s.length
            const quad = (lo: number, hi: number, color: Color) => {

              const tint = relativeTo(color, MARKING)
              const points = [[fa, lo], [fa, hi], [fb, hi], [fb, lo]].map(([f, o]) => {
                const p = posAt(f, o)
                return vert(p.x, heightAt(f, o) + 0.06, p.z, tint, ...planar(p.x, p.z, TILE.paint))
              })
              paint.verts(clipToBounds(points, bounds), ox, oz)
            }
            if (street && clear >= 1 && clear < 4.6) {
              if (s.condition === 'broken' && randomAt(k, i, roadSeed) < 0.5) continue
              const zebra = mixColor(MARKING, ASPHALT, fade)
              for (let o = -half + 0.7; o + 0.5 <= half - 0.6; o += 1) if (free(o, o + 0.5)) quad(o, o + 0.5, zebra)
              continue
            }
            for (let l = 0; l < lines.length; l++) {
              const line = lines[l]
              if (line.dash && (along % (line.dash + line.gap)) > line.dash) continue
              if (loss && randomAt(Math.floor(along / 1.5), l, roadSeed) < loss) continue
              const lo = line.offset - line.width / 2, hi = line.offset + line.width / 2
              if (free(lo, hi)) quad(lo, hi, mixColor(line.color, ASPHALT, fade))
            }
          }
        }
      }

      const midX = (s.a.x + s.b.x) / 2, midZ = (s.a.z + s.b.z) / 2
      if (!owns(midX, midZ) || !computed[0] || !computed[pieces]) continue
      const roadSeed = hashString(s.roadId) ^ seed
      const at = (f: number, o: number, y: number): Vec => { const p = posAt(f, o); return [p.x - ox, y, p.z - oz] }
      const forward = normalize([s.b.x - s.a.x, 0, s.b.z - s.a.z])

      const sweep = (mesh: MeshBuilder, slot: number, tile: number, profile: [number, number][], base: (f: number, o: number) => number, color: Color, caps: [boolean, boolean]) => {
        let arc = 0
        for (let k = 0; k < profile.length; k++) {
          const [o0, y0] = profile[k], [o1, y1] = profile[(k + 1) % profile.length]
          const length = Math.hypot(o1 - o0, y1 - y0)
          if (length < 1e-6) continue

          const no = (y1 - y0) / length, ny = -(o1 - o0) / length
          for (let u = 0; u < pieces; u++) {
            const fa = u / pieces, fb = (u + 1) / pieces, la = lateralAt(fa), lb = lateralAt(fb)
            const na: Vec = [la[0] * no, ny, la[2] * no], nb: Vec = [lb[0] * no, ny, lb[2] * no]
            const ua = alongAt(fa, tile), ub = alongAt(fb, tile), va = arc / tile, vb = (arc + length) / tile
            mesh.quad(
              [at(fa, o0, base(fa, o0) + y0), at(fb, o0, base(fb, o0) + y0), at(fb, o1, base(fb, o1) + y1), at(fa, o1, base(fa, o1) + y1)],
              [[ua, va], [ub, va], [ub, vb], [ua, vb]], [na, nb, nb, na], color, slot,
            )
          }
          arc += length
        }
        caps.forEach((cap, end) => {
          if (!cap) return
          const normal = scaleVec(forward, end ? 1 : -1)
          const ids = profile.map(([o, dy]) => {
            const p = at(end, o, base(end, o) + dy)
            return mesh.vertex(p[0], p[1], p[2], normal, color, o / tile, dy / tile)
          })
          for (const [a, b, c] of triangulate(profile)) mesh.facing(ids[a], ids[b], ids[c], normal, slot)
        })
      }

      if (s.bridge) {
        const kerb = street ? half + SIDEWALK : half, edge = kerb + 0.9, girder = half * 0.6

        const deck: [number, number][] = [
          [-girder, -1.15], [girder, -1.15], [girder, -0.55], [edge, -0.4], [edge, 1], [edge - 0.35, 1], [edge - 0.35, 0.22], [kerb, 0.22], [kerb, -0.02],
          [-kerb, -0.02], [-kerb, 0.22], [-(edge - 0.35), 0.22], [-(edge - 0.35), 1], [-edge, 1], [-edge, -0.4], [-girder, -0.55],
        ]
        const bridged = (k: number) => k >= 0 && k < road.points.length - 1 && road.bridge[k] === 1 && road.bridge[k + 1] === 1
        const deckBase = (f: number, o: number) => heightAt(f, Math.max(-half, Math.min(half, o)))
        sweep(props, STRUCTURE_LAYER.concrete, TILE.concrete, deck, deckBase, NEUTRAL, [!bridged(i - 1), !bridged(i + 1)])
        const ya = heightAt(0, 0), yb = heightAt(1, 0)
        const span = basisAlong({ x: s.a.x, y: ya, z: s.a.z }, { x: s.b.x, y: yb, z: s.b.z })
        addSolid({ x: midX, y: (ya + yb) / 2 - 0.58, z: midZ }, span.ax, span.ay, span.az, span.length / 2, 0.56, edge)
        for (const side of [-1, 1]) for (const [o, dy, hy, hz] of [[edge - 0.175, 0.61, 0.39, 0.175], [(kerb + edge - 0.35) / 2, 0.1, 0.12, (edge - 0.35 - kerb) / 2]]) {
          const a = posAt(0, side * o), b = posAt(1, side * o)
          addSolid({ x: (a.x + b.x) / 2, y: (ya + yb) / 2 + dy, z: (a.z + b.z) / 2 }, span.ax, span.ay, span.az, span.length / 2, hy, hz)
        }

        if (i % 3 === 0) {
          const f = 0.5 / pieces, df = Math.min(0.6, (s.length / pieces) * 0.45) / s.length, w = girder * 0.85
          const corners: [number, number][] = [[f - df, -w], [f + df, -w], [f + df, w], [f - df, w]]
          const ring = corners.map(([cf, o]) => posAt(cf, o))
          const tops = corners.map(([cf, o]) => deckBase(cf, o) - 1.15)
          const bed = Math.min(...ring.map((p) => this.height(p.x, p.z))) - 1
          if (Math.min(...tops) - bed > 2) {
            const cx = ring.reduce((sum, p) => sum + p.x, 0) / 4, cz = ring.reduce((sum, p) => sum + p.z, 0) / 4
            let arc = 0
            for (let k = 0; k < 4; k++) {
              const p = ring[k], q = ring[(k + 1) % 4], width = Math.hypot(q.x - p.x, q.z - p.z)
              let out: Vec = normalize([q.z - p.z, 0, p.x - q.x])
              if (out[0] * ((p.x + q.x) / 2 - cx) + out[2] * ((p.z + q.z) / 2 - cz) < 0) out = scaleVec(out, -1)
              const t = TILE.concrete, hp = tops[k], hq = tops[(k + 1) % 4]
              props.quad(
                [[p.x - ox, bed, p.z - oz], [q.x - ox, bed, q.z - oz], [q.x - ox, hq, q.z - oz], [p.x - ox, hp, p.z - oz]],
                [[arc / t, 0], [(arc + width) / t, 0], [(arc + width) / t, (hq - bed) / t], [arc / t, (hp - bed) / t]], [out, out, out, out], NEUTRAL, STRUCTURE_LAYER.concrete,
              )
              arc += width
            }
            const low = Math.min(...tops), flat = basisAlong({ x: s.a.x, y: 0, z: s.a.z }, { x: s.b.x, y: 0, z: s.b.z }, true)
            addSolid({ x: cx, y: (low + bed) / 2, z: cz }, flat.ax, flat.ay, flat.az, df * s.length, (low - bed) / 2, w)
          }
        }
      } else if (lod < 2) {
        for (const side of [-1, 1] as const) {
          if (!this.railAt(road, i, side, roadSeed)) continue

          const edge = street ? half + SIDEWALK : half
          const face = side * this.railFace(road), top = GUARDRAIL.railHeight / 2, thick = GUARDRAIL.railThickness
          const base = (f: number) => heightAt(f, side * edge) + GUARDRAIL.railCenter
          const slope = (h: number) => -GUARDRAIL.railDepth * Math.PI / top * Math.sin((2 * Math.PI * h) / top)
          const heights = Array.from({ length: RAIL_SAMPLES + 1 }, (_, j) => -top + (2 * top * j) / RAIL_SAMPLES)
          const tint = s.condition === 'new' ? NEUTRAL : RUST_TINT
          const point = (f: number, h: number, back: boolean) => at(f, face + side * (railDepthAt(h) + (back ? thick : 0)), base(f) + h)
          const normalAt = (f: number, h: number, back: boolean): Vec => {
            const lateral = lateralAt(f), d = slope(h), length = Math.hypot(1, d), sign = back ? 1 : -1
            return [lateral[0] * side * sign / length, -sign * d / length, lateral[2] * side * sign / length]
          }
          const t = TILE.steel
          for (let u = 0; u < pieces; u++) {
            const fa = u / pieces, fb = (u + 1) / pieces, ua = alongAt(fa, t), ub = alongAt(fb, t)
            for (const back of [false, true]) {
              let arc = 0
              for (let j = 0; j < RAIL_SAMPLES; j++) {
                const h0 = heights[j], h1 = heights[j + 1]
                const step = Math.hypot(h1 - h0, railDepthAt(h1) - railDepthAt(h0))
                props.quad(
                  [point(fa, h0, back), point(fb, h0, back), point(fb, h1, back), point(fa, h1, back)],
                  [[ua, arc / t], [ub, arc / t], [ub, (arc + step) / t], [ua, (arc + step) / t]],
                  [normalAt(fa, h0, back), normalAt(fb, h0, back), normalAt(fb, h1, back), normalAt(fa, h1, back)], tint, STRUCTURE_LAYER.steel,
                )
                arc += step
              }
            }
            for (const h of [-top, top]) {
              const n: Vec = [0, Math.sign(h), 0]
              props.quad([point(fa, h, false), point(fb, h, false), point(fb, h, true), point(fa, h, true)], [[ua, 0], [ub, 0], [ub, thick / t], [ua, thick / t]], [n, n, n, n], tint, STRUCTURE_LAYER.steel)
            }
          }
          for (const [end, neighbour] of [[0, i - 1], [1, i + 1]] as const) {
            if (this.railAt(road, neighbour, side, roadSeed)) continue
            const n = scaleVec(forward, end ? 1 : -1)
            for (let j = 0; j < RAIL_SAMPLES; j++) {
              const h0 = heights[j], h1 = heights[j + 1]
              props.quad([point(end, h0, false), point(end, h1, false), point(end, h1, true), point(end, h0, true)], [[0, h0 / t], [0, h1 / t], [thick / t, h1 / t], [thick / t, h0 / t]], [n, n, n, n], tint, STRUCTURE_LAYER.steel)
            }
          }

          for (let k = Math.ceil(s.distance / POST_SPACING); k * POST_SPACING < s.distance + s.length; k++) {
            const f = (k * POST_SPACING - s.distance) / s.length
            const p = posAt(f, face + side * POST_BEHIND_RAIL), lateral = lateralAt(f)
            posts.push(p.x - ox, heightAt(f, side * edge), p.z - oz, Math.atan2(-lateral[0] * side, -lateral[2] * side))
          }
          const ya = heightAt(0, side * edge), yb = heightAt(1, side * edge)
          const reach = (POST_BEHIND_RAIL + GUARDRAIL.postDepth / 2) / 2
          const a = posAt(0, face + side * reach), b = posAt(1, face + side * reach)
          const solid = basisAlong({ x: a.x, y: ya, z: a.z }, { x: b.x, y: yb, z: b.z })
          addSolid({ x: (a.x + b.x) / 2, y: (ya + yb) / 2 + GUARDRAIL.postTop / 2, z: (a.z + b.z) / 2 }, solid.ax, solid.ay, solid.az, solid.length / 2, GUARDRAIL.postTop / 2, reach)
        }
      }
      if (s.condition === 'broken' && lod === 0 && s.kind !== 'track') {
        for (let k = 0; k < Math.floor(s.length / 6); k++) {
          if (randomAt(i * 7 + k, 31, roadSeed) > 0.22) continue
          const f = randomAt(i, k, roadSeed ^ 77), offset = (randomAt(k, i, roadSeed ^ 91) - 0.5) * 2 * (half - 0.6)
          const p = posAt(f, offset), size = 0.12 + randomAt(i + k, 5, roadSeed) * 0.2
          if (!this.crumbling(p.x, p.z)) continue
          const tint = randomAt(k, i, roadSeed ^ 29), spec = DEBRIS[pickVariant(tint, DEBRIS.length)]
          const q = orient(randomAt(k, i, roadSeed ^ 13) * Math.PI * 2, UP)
          debris.push(p.x - ox, heightAt(f, offset) + 0.05 - spec.tall * size * 0.2, p.z - oz, ...q, size, size, size, FLOOR_KIND.debris, tint)
        }
      }
    }

    const corners = new Map<string, SidewalkJunction>()
    for (const road of streets) {
      const plan = this.sidewalks.plan(road)
      this.sidewalkEnds(asphalt, props, debris, road, plan, bounds, lod, groundAt)
      for (const junction of plan.junctions) {
        if (junction.pieces.length && near(junction.x, junction.z, junction.reach)) corners.set(`${junction.x.toFixed(2)},${junction.z.toFixed(2)}`, junction)
      }
    }
    for (const junction of corners.values()) for (const piece of junction.pieces) this.sidewalkCorner(asphalt, piece, bounds, lod, groundAt)
    return { roads: asphalt.finish(), markings: paint.finish(), props: props.finish(), solids, debris, posts }
  }

  private sidewalkStrip(mesh: MeshBuilder, s: RoadSegment, plan: SidewalkPlan, pieces: number, bounds: Bounds, lod: ChunkLod, groundAt: Ground) {
    const n = s.road.normals, i = s.index, half = s.half, across = SIDEWALK / TILE.sidewalk, top = SIDEWALK_LIFT
    const slab = this.sidewalkLayer(s.road)
    const lateral = (f: number) => normalize([n[2 * i] + (n[2 * i + 2] - n[2 * i]) * f, 0, n[2 * i + 1] + (n[2 * i + 3] - n[2 * i + 1]) * f])
    const at = (f: number, offset: number): Point2 => ({
      x: s.a.x + (s.b.x - s.a.x) * f + (n[2 * i] + (n[2 * i + 2] - n[2 * i]) * f) * offset,
      z: s.a.z + (s.b.z - s.a.z) * f + (n[2 * i + 1] + (n[2 * i + 3] - n[2 * i + 1]) * f) * offset,
    })
    const near = (p: Point2) => p.x > bounds.minX - 1 && p.x < bounds.maxX + 1 && p.z > bounds.minZ - 1 && p.z < bounds.maxZ + 1
    for (const side of [-1, 1] as const) for (const run of plan.runs[side > 0 ? 1 : 0]) {
      const lo = Math.max(run.start === 'broken' ? run.from + TIP : run.from, s.distance)
      const hi = Math.min(run.end === 'broken' ? run.to - TIP : run.to, s.distance + s.length)
      if (hi - lo < 1e-3) continue
      const f0 = (lo - s.distance) / s.length, f1 = (hi - s.distance) / s.length

      const stops = [f0]
      for (let u = Math.floor(f0 * pieces) + 1; u < f1 * pieces - 1e-6; u++) stops.push(u / pieces)
      stops.push(f1)
      const rows = stops.map((f) => ({ f, kerb: at(f, side * half), back: at(f, side * (half + SIDEWALK)), v: bandV(run, s.distance + f * s.length), yk: NaN, yb: NaN }))
      for (let r = 0; r < rows.length - 1; r++) {
        const p = rows[r], q = rows[r + 1]
        if (!near(p.kerb) && !near(q.kerb) && !near(p.back) && !near(q.back)) continue
        for (const row of [p, q]) {
          if (!Number.isNaN(row.yk)) continue
          row.yk = this.network.influence(row.kerb.x, row.kerb.z).surface
          row.yb = this.network.influence(row.back.x, row.back.z).surface
        }
        emit(mesh, [
          vert(p.kerb.x, p.yk + top, p.kerb.z, this.slabTint(p.kerb), 0, p.v), vert(q.kerb.x, q.yk + top, q.kerb.z, this.slabTint(q.kerb), 0, q.v),
          vert(q.back.x, q.yb + top, q.back.z, this.slabTint(q.back), across, q.v), vert(p.back.x, p.yb + top, p.back.z, this.slabTint(p.back), across, p.v),
        ], UP, slab, bounds)
        const away = scaleVec(lateral((p.f + q.f) / 2), side), u = (p.v * TILE.sidewalk) / TILE.concrete
        if (lod < 2) upright(mesh, p.kerb, q.kerb, [p.yk + KERB_FOOT, q.yk + KERB_FOOT], [p.yk + top, q.yk + top], scaleVec(away, -1), CURB_TINT, ROAD_LAYER.concrete, bounds, u)

        const feet: [number, number] = s.bridge ? [p.yb - 0.25, q.yb - 0.25] : lod === 0
          ? [Math.min(p.yb + top - 0.12, groundAt(p.back.x, p.back.z) - 0.06), Math.min(q.yb + top - 0.12, groundAt(q.back.x, q.back.z) - 0.06)]
          : [p.yb - 6, q.yb - 6]
        upright(mesh, p.back, q.back, feet, [p.yb + top, q.yb + top], away, CURB_TINT, ROAD_LAYER.concrete, bounds, u)
      }
    }
  }

  private sidewalkEnds(mesh: MeshBuilder, props: MeshBuilder, debris: number[], road: Road, plan: SidewalkPlan, bounds: Bounds, lod: ChunkLod, groundAt: Ground) {
    const half = road.width / 2
    for (const side of [-1, 1] as const) for (const run of plan.runs[side > 0 ? 1 : 0]) {
      for (const [along, end, dir] of [[run.from, run.start, -1], [run.to, run.end, 1]] as const) {
        if (end === 'joint') continue
        const middle = this.sidewalks.point(road, along, side * (half + SIDEWALK / 2))
        if (middle.x < bounds.minX - 6 || middle.x > bounds.maxX + 6 || middle.z < bounds.minZ - 6 || middle.z > bounds.maxZ + 6) continue
        if (end === 'cap') this.sidewalkCap(mesh, road, along, side, dir, bounds, lod)
        else this.sidewalkBreak(mesh, props, debris, road, run, along, side, dir, bounds, lod, groundAt)
      }
    }
  }

  private sidewalkCap(mesh: MeshBuilder, road: Road, along: number, side: -1 | 1, dir: -1 | 1, bounds: Bounds, lod: ChunkLod) {
    if (lod === 2) return
    const half = road.width / 2
    const kerb = this.sidewalks.point(road, along, side * half), back = this.sidewalks.point(road, along, side * (half + SIDEWALK))
    const behind = this.sidewalks.point(road, along - dir * 0.5, side * (half + SIDEWALK / 2))
    const yk = this.network.influence(kerb.x, kerb.z).surface, yb = this.network.influence(back.x, back.z).surface
    upright(mesh, kerb, back, [yk + KERB_FOOT, yb + KERB_FOOT], [yk + SIDEWALK_LIFT, yb + SIDEWALK_LIFT], outward(kerb, back, behind), CURB_TINT, ROAD_LAYER.concrete, bounds)
  }

  private sidewalkBreak(mesh: MeshBuilder, props: MeshBuilder, debris: number[], road: Road, run: SidewalkRun, along: number, side: -1 | 1, dir: -1 | 1, bounds: Bounds, lod: ChunkLod, groundAt: Ground) {
    const half = road.width / 2, tile = TILE.sidewalk, top = SIDEWALK_LIFT, slab = this.sidewalkLayer(road)
    const random = randomSource(hash2(Math.round(along * 16), side * 3 + dir, hashString(road.id) ^ this.terrain.seed))

    const at = (e: number, c: number) => this.sidewalks.point(road, along + dir * e, side * (half + c))
    const surface = (p: Point2) => this.network.influence(p.x, p.z).surface

    const deck = this.sidewalks.bridged(road, along) || this.sidewalks.bridged(road, along + dir * 1.5)
    const foot = (p: Point2, ceiling: number) => Math.min(ceiling - 0.08, deck ? surface(p) - 0.25 : groundAt(p.x, p.z) - 0.06)
    const teeth = 7
    const edge = Array.from({ length: teeth }, (_, k) => ({
      e: (random() - 0.45) * 0.62 + Math.sin(k * 2.3 + random() * 3) * 0.12,
      c: k === 0 ? 0 : k === teeth - 1 ? SIDEWALK : (SIDEWALK * k) / (teeth - 1) + (random() - 0.5) * 0.18,
      sag: 0.015 + random() * 0.07,
    }))
    const outline = [{ e: -TIP, c: 0, sag: 0 }, ...edge, { e: -TIP, c: SIDEWALK, sag: 0 }]
    const points = outline.map(({ e, c }) => at(e, c))
    const heights = points.map((p, k) => surface(p) + top - outline[k].sag)
    emitFlat(mesh, points.map((p, k) => vert(p.x, heights[k], p.z, scaleColor(this.slabTint(p), 0.95), outline[k].c / tile, bandV(run, along + dir * outline[k].e))), slab, bounds)
    if (lod === 2) return
    const inside = at(-TIP, SIDEWALK / 2), last = outline.length - 1
    for (let k = 1; k < last - 1; k++) {
      upright(mesh, points[k], points[k + 1], [foot(points[k], heights[k]), foot(points[k + 1], heights[k + 1])], [heights[k], heights[k + 1]], outward(points[k], points[k + 1], inside), CURB_TINT, ROAD_LAYER.concrete, bounds)
    }
    upright(mesh, points[0], points[1], [surface(points[0]) + KERB_FOOT, surface(points[1]) + KERB_FOOT], [heights[0], heights[1]], outward(points[0], points[1], inside), CURB_TINT, ROAD_LAYER.concrete, bounds)
    upright(mesh, points[last - 1], points[last], [foot(points[last - 1], heights[last - 1]), foot(points[last], heights[last])], [heights[last - 1], heights[last]], outward(points[last - 1], points[last], inside), CURB_TINT, ROAD_LAYER.concrete, bounds)

    const edgeAt = (c: number) => {
      let k = 0
      while (k < teeth - 2 && edge[k + 1].c < c) k++
      return lerp(edge[k].e, edge[k + 1].e, clamp01((c - edge[k].c) / (edge[k + 1].c - edge[k].c)))
    }
    if (!deck && random() < 0.8) {

      const gap = 0.04 + random() * 0.05, c0 = random() * 0.45, c1 = SIDEWALK - random() * 0.55, depth = 0.45 + random() * 0.45, steps = 4
      const near = Array.from({ length: steps }, (_, k) => { const c = lerp(c0, c1, k / (steps - 1)); return { e: edgeAt(c) + gap, c } })
      const far = near.map(({ e, c }) => ({ e: e + depth * (0.7 + random() * 0.6), c: c + (random() - 0.5) * 0.1 })).reverse()
      const shape = [...near, ...far], ring = shape.map(({ e, c }) => at(e, c))
      const tops = ring.map((p, k) => (k < steps ? surface(p) + top - 0.05 - random() * 0.06 : groundAt(p.x, p.z) + 0.02))
      emitFlat(mesh, ring.map((p, k) => vert(p.x, tops[k], p.z, FRAGMENT_TINT, shape[k].c / tile, bandV(run, along + dir * shape[k].e))), slab, bounds)
      const middle = { x: ring.reduce((sum, p) => sum + p.x, 0) / ring.length, z: ring.reduce((sum, p) => sum + p.z, 0) / ring.length }
      for (let k = 0; k < ring.length; k++) {
        const j = (k + 1) % ring.length
        upright(mesh, ring[k], ring[j], [foot(ring[k], tops[k]), foot(ring[j], tops[j])], [tops[k], tops[j]], outward(ring[k], ring[j], middle), FRAGMENT_TINT, ROAD_LAYER.concrete, bounds)
      }
    }
    if (!deck && random() < 0.7) {

      const e = 1.1 + random() * 1.4, c = 0.3 + random() * (SIDEWALK - 0.6), radius = 0.17 + random() * 0.2, spin = random() * Math.PI * 2
      const thick = 0.05 + random() * 0.04, tiltX = (random() - 0.5) * 0.3, tiltZ = (random() - 0.5) * 0.3, center = at(e, c)
      const ring = Array.from({ length: 5 }, (_, k): Point2 => {
        const angle = spin + (k / 5) * Math.PI * 2 + (random() - 0.5) * 0.5, r = radius * (0.65 + random() * 0.5)
        return { x: center.x + Math.cos(angle) * r, z: center.z + Math.sin(angle) * r }
      })
      const tops = ring.map((p) => groundAt(p.x, p.z) + thick + (p.x - center.x) * tiltX + (p.z - center.z) * tiltZ)
      emitFlat(props, ring.map((p, k) => vert(p.x, tops[k], p.z, FRAGMENT_TINT, (p.x - center.x) / TILE.concrete, (p.z - center.z) / TILE.concrete)), STRUCTURE_LAYER.concrete, bounds)
      for (let k = 0; k < ring.length; k++) {
        const j = (k + 1) % ring.length
        upright(props, ring[k], ring[j], [groundAt(ring[k].x, ring[k].z) - 0.04, groundAt(ring[j].x, ring[j].z) - 0.04], [tops[k], tops[j]], outward(ring[k], ring[j], center), FRAGMENT_TINT, STRUCTURE_LAYER.concrete, bounds)
      }
    }
    if (lod !== 0) return

    const chips = deck ? 0 : 4 + Math.floor(random() * 5)
    for (let k = 0; k < chips + 2; k++) {
      const onSlab = k >= chips
      const e = onSlab ? -0.15 - random() * 0.55 : 0.1 + random() ** 1.6 * 2.9, c = onSlab ? 0.2 + random() * (SIDEWALK - 0.4) : -0.7 + random() * (SIDEWALK + 1.2)
      const size = onSlab ? 0.05 + random() * 0.05 : 0.07 + random() * 0.13, roll = random(), spin = random() * Math.PI * 2
      const tilt = normalize([(random() - 0.5) * 0.6, 1, (random() - 0.5) * 0.6])
      const p = at(e, c)
      if (p.x < bounds.minX || p.x >= bounds.maxX || p.z < bounds.minZ || p.z >= bounds.maxZ) continue
      const spec = DEBRIS[pickVariant(roll, DEBRIS.length)]
      const base = onSlab ? surface(p) + top : c < 0 ? surface(p) + PAVEMENT_LIFT : groundAt(p.x, p.z)
      debris.push(p.x - bounds.minX, base + 0.02 - spec.tall * size * 0.25, p.z - bounds.minZ, ...orient(spin, tilt), size, size, size, FLOOR_KIND.debris, roll)
    }
  }

  private sidewalkCorner(mesh: MeshBuilder, piece: CornerPiece, bounds: Bounds, lod: ChunkLod, groundAt: Ground) {
    const top = SIDEWALK_LIFT, across = SIDEWALK / TILE.sidewalk, step = lod === 0 ? 0.13 : 0.35
    const surface = (p: Point2) => this.network.influence(p.x, p.z).surface
    const slab = this.sidewalkLayer(piece.a.road)
    const a = this.sidewalks.attach(piece.a)
    if (piece.kind === 'butt') {
      const outline = [piece.kerb, a.kerb, a.back, piece.back], ys = outline.map(surface)
      const vs = [-Math.hypot(piece.kerb.x - a.kerb.x, piece.kerb.z - a.kerb.z) / TILE.sidewalk, 0, 0, -Math.hypot(piece.back.x - a.back.x, piece.back.z - a.back.z) / TILE.sidewalk]
      emit(mesh, outline.map((p, k) => vert(p.x, ys[k] + top, p.z, this.slabTint(p), k === 0 || k === 1 ? 0 : across, vs[k])), UP, slab, bounds)
      if (lod === 2) return
      const middle = { x: outline.reduce((sum, p) => sum + p.x, 0) / 4, z: outline.reduce((sum, p) => sum + p.z, 0) / 4 }
      upright(mesh, piece.kerb, piece.back, [ys[0] + KERB_FOOT, ys[3] + KERB_FOOT], [ys[0] + top, ys[3] + top], [piece.facing.x, 0, piece.facing.z], CURB_TINT, ROAD_LAYER.concrete, bounds)
      upright(mesh, piece.kerb, a.kerb, [ys[0] + KERB_FOOT, ys[1] + KERB_FOOT], [ys[0] + top, ys[1] + top], outward(piece.kerb, a.kerb, middle), CURB_TINT, ROAD_LAYER.concrete, bounds)
      upright(mesh, a.back, piece.back, [Math.min(ys[2] + top - 0.12, groundAt(a.back.x, a.back.z) - 0.06), Math.min(ys[3] + top - 0.12, groundAt(piece.back.x, piece.back.z) - 0.06)], [ys[2] + top, ys[3] + top], outward(a.back, piece.back, middle), CURB_TINT, ROAD_LAYER.concrete, bounds)
      return
    }
    const b = this.sidewalks.attach(piece.b)
    if (piece.kind === 'round') {

      const center = { x: (a.back.x + b.back.x) / 2, z: (a.back.z + b.back.z) / 2 }
      const arc = arcBetween(a.kerb, b.kerb, center, step), lengths = pathLengths(arc)
      const total = lengths[lengths.length - 1], tiles = Math.max(1, Math.round(total / TILE.sidewalk))
      const vs = lengths.map((length) => (total > 0 ? (length / total) * tiles : 0)), ys = arc.map(surface), yBack = surface(a.back)
      for (let j = 0; j < arc.length - 1; j++) {
        emit(mesh, [
          vert(a.back.x, yBack + top, a.back.z, this.slabTint(a.back), across, (vs[j] + vs[j + 1]) / 2),
          vert(arc[j].x, ys[j] + top, arc[j].z, this.slabTint(arc[j]), 0, vs[j]), vert(arc[j + 1].x, ys[j + 1] + top, arc[j + 1].z, this.slabTint(arc[j + 1]), 0, vs[j + 1]),
        ], UP, slab, bounds)
      }
      const end = arc[arc.length - 1], yEnd = ys[ys.length - 1]
      emit(mesh, [vert(a.back.x, yBack + top, a.back.z, this.slabTint(a.back), across, tiles), vert(end.x, yEnd + top, end.z, this.slabTint(end), 0, tiles), vert(b.back.x, surface(b.back) + top, b.back.z, this.slabTint(b.back), across, tiles)], UP, slab, bounds)
      if (lod < 2) for (let j = 0; j < arc.length - 1; j++) {
        upright(mesh, arc[j], arc[j + 1], [ys[j] + KERB_FOOT, ys[j + 1] + KERB_FOOT], [ys[j] + top, ys[j + 1] + top], outward(arc[j], arc[j + 1], center), CURB_TINT, ROAD_LAYER.concrete, bounds, lengths[j] / TILE.concrete)
      }
      const fill = this.network.influence(piece.corner.x, piece.corner.z), owner = fill.dominant ?? fill.nearest
      if (!owner) return

      const radius = Math.max(...arc.map((p) => Math.hypot(p.x - center.x, p.z - center.z)))
      const ux = a.kerb.x - center.x, uz = a.kerb.z - center.z, vx = b.kerb.x - center.x, vz = b.kerb.z - center.z
      const span = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz) || 1))))
      const sight = Math.min(3, 1.05 / Math.max(0.05, Math.cos(span / 2))) * radius
      const dx = piece.corner.x - center.x, dz = piece.corner.z - center.z, out = Math.max(1, sight / (Math.hypot(dx, dz) || 1))
      const c = { x: center.x + dx * out, z: center.z + dz * out }, reach = 12
      const roads = this.network.segmentsIn({ minX: c.x - reach, maxX: c.x + reach, minZ: c.z - reach, maxZ: c.z + reach })
        .filter((o) => Math.abs(o.a.y + (o.b.y - o.a.y) * clamp01(distanceToSegment(c.x, c.z, o).t) - fill.surface) < 0.6)
      for (let j = 0; j < arc.length - 1; j++) {
        let parts: XZ[][] = [[[c.x, c.z], [arc[j].x, arc[j].z], [arc[j + 1].x, arc[j + 1].z]]]
        for (const o of roads) parts = subtractStrip(parts, o)
        for (const part of parts) emit(mesh, part.map(([x, z]) => vert(x, this.network.influence(x, z).surface + PAVEMENT_LIFT, z, this.roadTint(owner, x, z), (x - bounds.minX) / TILE.asphalt, -(z - bounds.minZ) / TILE.asphalt)), UP, this.surfaceLayer(owner), bounds)
      }
      return
    }

    const kerbs = arcBetween(a.kerb, b.kerb, piece.node, step), backs = arcBetween(a.back, b.back, piece.node, step, kerbs.length - 1)
    const lengths = pathLengths(kerbs.map((p, j) => ({ x: (p.x + backs[j].x) / 2, z: (p.z + backs[j].z) / 2 })))
    const total = lengths[lengths.length - 1], tiles = Math.max(1, Math.round(total / TILE.sidewalk))
    const vs = lengths.map((length) => (total > 0 ? (length / total) * tiles : 0)), yk = kerbs.map(surface), yb = backs.map(surface)
    for (let j = 0; j < kerbs.length - 1; j++) {
      emit(mesh, [
        vert(kerbs[j].x, yk[j] + top, kerbs[j].z, this.slabTint(kerbs[j]), 0, vs[j]), vert(kerbs[j + 1].x, yk[j + 1] + top, kerbs[j + 1].z, this.slabTint(kerbs[j + 1]), 0, vs[j + 1]),
        vert(backs[j + 1].x, yb[j + 1] + top, backs[j + 1].z, this.slabTint(backs[j + 1]), across, vs[j + 1]), vert(backs[j].x, yb[j] + top, backs[j].z, this.slabTint(backs[j]), across, vs[j]),
      ], UP, slab, bounds)
      if (lod < 2) upright(mesh, kerbs[j], kerbs[j + 1], [yk[j] + KERB_FOOT, yk[j + 1] + KERB_FOOT], [yk[j] + top, yk[j + 1] + top], outward(kerbs[j], kerbs[j + 1], backs[j]), CURB_TINT, ROAD_LAYER.concrete, bounds)
      const feet: [number, number] = lod === 0
        ? [Math.min(yb[j] + top - 0.12, groundAt(backs[j].x, backs[j].z) - 0.06), Math.min(yb[j + 1] + top - 0.12, groundAt(backs[j + 1].x, backs[j + 1].z) - 0.06)]
        : [yb[j] - 6, yb[j + 1] - 6]
      upright(mesh, backs[j], backs[j + 1], feet, [yb[j] + top, yb[j + 1] + top], outward(backs[j], backs[j + 1], kerbs[j]), CURB_TINT, ROAD_LAYER.concrete, bounds)
    }
  }

  private slabTint(p: Point2): Color {
    const grime = 0.92 + 0.08 * this.terrain.detail.at(p.x / 6.5 + 3.7, p.z / 6.5 - 1.9)
    return [grime, grime, grime * 0.985]
  }

  private pavedTop(road: RoadInfluence, x: number, z: number) {
    if (!road.nearest) return null
    if (road.pavement <= 0 || road.dominant) return road.surface + PAVEMENT_LIFT
    return this.paved(road, x, z, 0) ? road.surface + SIDEWALK_LIFT : null
  }

  private paved(road: RoadInfluence, x: number, z: number, margin: number) {
    const s = road.nearest
    return !!s && s.kind === 'street' && road.distance < s.half + SIDEWALK + margin && this.sidewalks.covers(s, x, z, margin)
  }

  private clearOfRoads(x: number, z: number, streetVerge: number, roadVerge: number, kerbside: number) {
    for (const s of this.network.segmentsAt(x, z)) {
      const edge = distanceToSegment(x, z, s).distance - s.half
      const street = s.kind === 'street'
      if (edge < (street ? streetVerge : roadVerge)) return false
      if (street && edge < SIDEWALK + kerbside && this.sidewalks.covers(s, x, z, kerbside)) return false
    }
    return true
  }

  buildChunk(cx: number, cz: number, lod: ChunkLod): ChunkData {
    const started = performance.now()
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE
    const bounds = { minX: x0, minZ: z0, maxX: x0 + CHUNK_SIZE, maxZ: z0 + CHUNK_SIZE }
    this.prepare(bounds)

    const sites = this.settlements.sitesIn(bounds)
    const segments = LOD_SEGMENTS[lod], stride = segments + 1, step = CHUNK_SIZE / segments, ring = segments + 3
    const mesh = new MeshBuilder()
    const heights = new Float64Array(ring * ring)
    const levels = new Float64Array(ring * ring)
    const samples: TerrainPoint[] = new Array(stride * stride)
    const influences: RoadInfluence[] = new Array(stride * stride)

    for (let iz = -1; iz <= segments + 1; iz++) for (let ix = -1; ix <= segments + 1; ix++) {
      const x = x0 + ix * step, z = z0 + iz * step
      const inner = ix >= 0 && ix <= segments && iz >= 0 && iz <= segments
      const surface = inner ? this.terrain.sample(x, z) : this.terrain.surface(x, z)
      const road = this.network.influence(x, z, surface)
      let height = this.settlements.shape(x, z, this.compose(road), road.core, lod > 0 ? step : 0)

      if (lod > 0 && road.pavement < step * 1.45) height = Math.min(height, road.nearY - 0.3)

      else if (lod === 0) {
        const top = this.pavedTop(road, x, z)
        if (top !== null) height = Math.min(height, top - PAVED_CLEARANCE)
      }
      heights[(iz + 1) * ring + ix + 1] = height
      levels[(iz + 1) * ring + ix + 1] = surface.waterLevel
      if (inner) { samples[iz * stride + ix] = surface as TerrainPoint; influences[iz * stride + ix] = road }
    }
    const heightAt = (ix: number, iz: number) => heights[(iz + 1) * ring + ix + 1]

    const groundAt: Ground = (x, z) => {
      const fx = Math.max(-1, Math.min(segments + 0.999, (x - x0) / step)), fz = Math.max(-1, Math.min(segments + 0.999, (z - z0) / step))
      const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz
      const a = heightAt(ix, iz), b = heightAt(ix + 1, iz), c = heightAt(ix, iz + 1), d = heightAt(ix + 1, iz + 1)
      return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v)
    }
    const town = this.terrain.nearestTown(x0 + CHUNK_SIZE / 2, z0 + CHUNK_SIZE / 2)

    const splat = new Uint8Array((stride * stride + 16 * segments) * TERRAIN_SPLAT)
    for (let iz = 0; iz <= segments; iz++) for (let ix = 0; ix <= segments; ix++) {
      const id = iz * stride + ix
      const height = heightAt(ix, iz)
      const dx = (heightAt(ix + 1, iz) - heightAt(ix - 1, iz)) / (2 * step)
      const dz = (heightAt(ix, iz + 1) - heightAt(ix, iz - 1)) / (2 * step)
      const norm = Math.hypot(dx, 1, dz)
      const x = x0 + ix * step, z = z0 + iz * step
      mesh.positions.push(ix * step, height, iz * step)
      mesh.normals.push(-dx / norm, 1 / norm, -dz / norm)
      mesh.colors.push(...this.groundTint(x, z, samples[id], influences[id]))
      this.groundSplat(x, z, samples[id], Math.hypot(dx, dz), influences[id], height, town, splat, id * TERRAIN_SPLAT)
    }
    for (let iz = 0; iz < segments; iz++) for (let ix = 0; ix < segments; ix++) {
      const a = iz * stride + ix, b = a + 1, c = a + stride, d = c + 1
      mesh.indices.push(a, c, b, b, c, d)
    }
    const levelAt = (ix: number, iz: number) => levels[(iz + 1) * ring + ix + 1]
    const water = this.buildWater(samples, segments, step, heightAt, levelAt, x0, z0, lod === 0)

    const edges = [
      Array.from({ length: stride }, (_, i) => i),
      Array.from({ length: stride }, (_, i) => i * stride + segments),
      Array.from({ length: stride }, (_, i) => segments * stride + segments - i),
      Array.from({ length: stride }, (_, i) => (segments - i) * stride),
    ]
    for (const edge of edges) for (let i = 0; i < edge.length - 1; i++) {
      const a = edge[i], b = edge[i + 1]
      const p = (id: number, down: number) => ({ x: mesh.positions[id * 3], y: mesh.positions[id * 3 + 1] - down, z: mesh.positions[id * 3 + 2] })
      const first = mesh.positions.length / 3
      mesh.polygon([p(a, 0), p(b, 0), p(b, 35), p(a, 35)], [mesh.colors[a * 3], mesh.colors[a * 3 + 1], mesh.colors[a * 3 + 2]])
      ;[a, b, b, a].forEach((source, k) => splat.copyWithin((first + k) * TERRAIN_SPLAT, source * TERRAIN_SPLAT, (source + 1) * TERRAIN_SPLAT))
    }
    const roadData = this.buildRoads(bounds, lod, groundAt)
    if (lod === 0) clearGround(roadData.roads, (slot) => slot === ROAD_LAYER.sidewalk || slot >= ROAD_LAYERS.length, groundAt, x0, z0, PAVED_CLEARANCE)
    const trees: number[] = [], grass: number[] = [], scattered: number[] = []
    const seed = this.terrain.seed
    const townRadius = town.wet ? 0 : town.radius
    const inside = (x: number, z: number) => x >= x0 && x < x0 + CHUNK_SIZE && z >= z0 && z < z0 + CHUNK_SIZE
    const nearest = (x: number, z: number) => samples[Math.max(0, Math.min(segments, Math.round((z - z0) / step))) * stride + Math.max(0, Math.min(segments, Math.round((x - x0) / step)))]
    if (lod !== 2) {
      const wooded = (sample: TerrainPoint) => sample.biome === 'forest' || sample.biome === 'denseForest' || sample.biome === 'pine'
      const plant = (tx: number, tz: number, salt: number, x: number, z: number, sample: TerrainPoint, density: number) => {
        const road = this.network.influence(x, z)
        const roadClearance = road.width / 2 + (this.paved(road, x, z, 2) ? SIDEWALK + 2 : road.kind === 'street' ? 4 : 5)
        if (road.distance < roadClearance || sample.height < sample.waterLevel + 1 || sample.height < 3) return
        if (!this.clearOfRoads(x, z, 4, 5, 2)) return

        const townMask = this.settlements.vegetation(x, z)
        if (townMask <= 0 || randomAt(tx, tz, seed ^ 7271 ^ salt) > density * townMask) return
        if (this.terrain.slope(x, z) > 0.68) return

        const species = standSpecies(sample.biome, randomAt(tx, tz, seed ^ 7011 ^ salt))
        const [low, high] = TREE_HEIGHT[species]
        const height = (low + randomAt(tx, tz, seed ^ 8092 ^ salt) ** 0.8 * (high - low)) * (STATURE[sample.biome] ?? 1) + sample.dense * 3

        const spread = TREE_SPREAD[species] * (sample.biome === 'meadow' && species === SPECIES.oak ? 1.35 : 1)
        const width = height * spread * (0.85 + randomAt(tx, tz, seed ^ 9161 ^ salt) * 0.3) * (1 - sample.dense * 0.2) / crownOf(species, 1)
        if (townMask < 1 && this.settlements.blocked(x, z, 1.2 + width * 0.25)) return
        const shade = (0.78 + randomAt(tx, tz, seed ^ 3108 ^ salt) * 0.32) * (1 - sample.dense * 0.12)
        trees.push(x - x0, this.height(x, z), z - z0, randomAt(tx, tz, seed ^ 9148 ^ salt) * Math.PI * 2, height, width, species, shade)
      }
      for (let tz = Math.floor(z0 / TREE_CELL); tz <= Math.floor((z0 + CHUNK_SIZE) / TREE_CELL); tz++) {
        for (let tx = Math.floor(x0 / TREE_CELL); tx <= Math.floor((x0 + CHUNK_SIZE) / TREE_CELL); tx++) {
          const fx = 0.1 + randomAt(tx, tz, seed ^ 3781) * 0.8, fz = 0.1 + randomAt(tx, tz, seed ^ 8122) * 0.8
          const x = (tx + fx) * TREE_CELL, z = (tz + fz) * TREE_CELL
          const cellInside = (tx + 1) * TREE_CELL > x0 && tx * TREE_CELL < x0 + CHUNK_SIZE && (tz + 1) * TREE_CELL > z0 && tz * TREE_CELL < z0 + CHUNK_SIZE
          if (!inside(x, z) && !cellInside) continue
          const sample = this.terrain.sample(x, z)
          const biomeDensity = sample.biome === 'pine' ? 0.6 : sample.biome === 'highlands' ? 0.08 : sample.biome === 'beach' ? 0 : sample.biome === 'shore' ? (0.03 + sample.forest * 0.3) * (1 - sample.sand) : sample.biome === 'river' || sample.biome === 'wetland' ? 0.3 + sample.forest * 0.5 : 0.055 + sample.forest * 0.73
          if (inside(x, z)) plant(tx, tz, 0, x, z, sample, biomeDensity)

          if (sample.dense < 0.05 || !wooded(sample)) continue
          const taken = [[x, z]]
          const qx = fx < 0.5 ? 0 : 1, qz = fz < 0.5 ? 0 : 1
          for (const [k, ox, oz] of [[1, 1 - qx, qz], [2, qx, 1 - qz], [3, 1 - qx, 1 - qz]]) {
            const px = (tx + (ox + 0.15 + randomAt(tx, tz, seed ^ (4441 * k)) * 0.7) / 2) * TREE_CELL
            const pz = (tz + (oz + 0.15 + randomAt(tx, tz, seed ^ (6151 * k)) * 0.7) / 2) * TREE_CELL
            if (taken.some(([ax, az]) => Math.hypot(px - ax, pz - az) < 2.6)) continue
            taken.push([px, pz])
            if (!inside(px, pz)) continue
            const extra = this.terrain.sample(px, pz)
            if (wooded(extra)) plant(tx, tz, 0x2f1b * k, px, pz, extra, extra.dense * (k === 3 ? 0.62 : 0.88))
          }
        }
      }

      for (const tree of this.settlements.treesIn(bounds)) {
        if (this.settlements.blocked(tree.x, tree.z, 1.4)) continue

        if (!this.clearOfRoads(tree.x, tree.z, 0.9, 2.5, 0.6)) continue
        const ground = this.terrain.surface(tree.x, tree.z)
        if (ground.height < ground.waterLevel + 0.5) continue
        const roll = randomAt(Math.round(tree.x * 4), Math.round(tree.z * 4), seed ^ 0x7e3)
        const width = tree.height * TREE_SPREAD[tree.species] * (0.9 + roll * 0.25) / crownOf(tree.species, 1)
        trees.push(tree.x - x0, this.height(tree.x, tree.z), tree.z - z0, roll * Math.PI * 2, tree.height, width, tree.species, 0.82 + roll * 0.25)
      }

      const grassCell = 2.3
      if (lod === 0) for (let gz = Math.floor(z0 / grassCell); gz <= Math.floor((z0 + CHUNK_SIZE) / grassCell); gz++) {
        for (let gx = Math.floor(x0 / grassCell); gx <= Math.floor((x0 + CHUNK_SIZE) / grassCell); gx++) {
          const x = (gx + randomAt(gx, gz, seed ^ 3193)) * grassCell, z = (gz + randomAt(gx, gz, seed ^ 8311)) * grassCell
          if (x < x0 || x >= x0 + CHUNK_SIZE || z < z0 || z >= z0 + CHUNK_SIZE) continue
          const s = this.terrain.surface(x, z), road = this.network.influence(x, z)
          const reeds = s.waterLevel > WATER_NONE && s.water !== 'ocean' && s.height > s.waterLevel - 0.4 && s.height < s.waterLevel + 1.2

          const roadClearance = road.width / 2 + (this.paved(road, x, z, 1.6) ? SIDEWALK + 1.6 : 1.5)
          if ((!reeds && s.height < s.waterLevel + 0.25) || road.distance < roadClearance || s.height < 1.5 || this.settlements.blocked(x, z, 0.5)) continue
          const sample = nearest(x, z)
          const verge = road.kind !== null && !road.dominant?.bridge && road.distance < roadClearance + 6.5
          const canopy = this.canopy(sample)
          const wooded = sample.biome === 'forest' || sample.biome === 'denseForest' || sample.biome === 'pine'
          let density = GRASS_DENSITY[sample.biome] ?? 0.4
          if (verge) density = Math.max(density, 0.95)
          if (s.sand > 0.3) density *= 0.12 + (1 - s.sand) * 0.8

          if (!reeds && !verge && this.terrain.detail.at(x / 38, z / 38) < -0.38) density *= 0.3
          if (randomAt(gx, gz, seed ^ 6621) > density) continue
          const roll = randomAt(gx, gz, seed ^ 1982), pick = randomAt(gx, gz, seed ^ 4121)
          const dry = clamp01(0.2 - sample.moisture * 0.6 + this.terrain.detail.at(x / 85, z / 85) * 0.2
            + (sample.biome === 'scrub' ? 0.35 : sample.biome === 'shore' ? 0.3 : sample.biome === 'highlands' ? 0.25 : 0))
          let variant: number, size: number
          if (reeds) { variant = GRASS.reeds; size = 1.2 + roll * 1.0 }
          else if (wooded && canopy > 0.3 && pick < 0.2 + canopy * 0.6) { variant = GRASS.fern; size = 0.7 + roll * 0.55 }
          else if (verge) { variant = pick < dry ? GRASS.dry : pick < 0.6 ? GRASS.tall : GRASS.mixed; size = 0.75 + roll * 0.55 }
          else { variant = pick < dry * 0.9 ? GRASS.dry : pick < dry + 0.25 ? GRASS.mixed : canopy < 0.2 && pick > 0.82 ? GRASS.tall : GRASS.green; size = 0.5 + roll * 0.55 }
          grass.push(x - x0, this.height(x, z), z - z0, size, randomAt(gx, gz, seed ^ 8931) * Math.PI * 2, variant)
        }
      }
      for (let rz = Math.floor(z0 / 29); rz <= Math.floor((z0 + CHUNK_SIZE) / 29); rz++) for (let rx = Math.floor(x0 / 29); rx <= Math.floor((x0 + CHUNK_SIZE) / 29); rx++) {
        if (randomAt(rx, rz, seed ^ 72219) > 0.13) continue
        const x = (rx + randomAt(rx, rz, seed ^ 1961)) * 29, z = (rz + randomAt(rx, rz, seed ^ 1128)) * 29
        if (x < x0 || x >= x0 + CHUNK_SIZE || z < z0 || z >= z0 + CHUNK_SIZE) continue
        const s = this.terrain.surface(x, z), road = this.network.influence(x, z)
        if (s.height < s.waterLevel + 1 || road.distance < road.width / 2 + 4 || Math.hypot(x - town.x, z - town.z) < townRadius || this.settlements.blocked(x, z, 4)) continue
        if (s.sand > 0.5 && randomAt(rx, rz, seed ^ 5113) > 0.2) continue
        const size = 0.4 + randomAt(rx, rz, seed ^ 3321) * 2.2
        scattered.push(x, z, randomAt(rx, rz, seed ^ 9382) * 6.28, size, randomAt(rx, rz, seed ^ 0x51ed))
      }
    }
    const solids = roadData.solids
    const { floor, litter } = this.buildFloor(x0, z0, lod, trees, samples, influences, heightAt, solids, town.x, town.z, townRadius, scattered)
    for (const value of roadData.debris) floor.push(value)
    const center = this.terrain.sample(x0 + CHUNK_SIZE / 2, z0 + CHUNK_SIZE / 2)
    const { structures, buildings } = buildMassing(sites, x0, z0)
    return {
      key: chunkKey(cx, cz, lod), cx, cz, lod, segments, terrain: { ...mesh.finish(), splat },
      roads: roadData.roads, markings: roadData.markings, props: roadData.props, water: water.water, waterfall: water.waterfall, spray: water.spray,
      trees: new Float32Array(trees), grass: new Float32Array(grass), posts: new Float32Array(roadData.posts),
      litter, floor: new Float32Array(floor), solids: new Float32Array(solids), structures, buildings,
      biome: center.biome, town: !town.wet && Math.hypot(x0 + 128 - town.x, z0 + 128 - town.z) < town.radius * 1.8 ? town.name : null,
      generationMs: performance.now() - started,
    }
  }

  private buildFloor(x0: number, z0: number, lod: ChunkLod, trees: number[], samples: TerrainPoint[], influences: RoadInfluence[], heightAt: (ix: number, iz: number) => number, solids: number[], townX: number, townZ: number, townRadius: number, scattered: number[]) {
    const floor: number[] = []
    const litter = new MeshBuilder(true, true)
    if (lod === 2) return { floor, litter: litter.finish() }
    const detailed = lod === 0
    const segments = LOD_SEGMENTS[lod], stride = segments + 1, step = CHUNK_SIZE / segments
    const seed = this.terrain.seed
    const { pebble: PEBBLE, twig: TWIG, boulder: BOULDER, log: LOG, stump: STUMP, leaf: LEAF } = FLOOR_KIND
    const owned = (lx: number, lz: number) => lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE
    const nearest = (lx: number, lz: number) => Math.max(0, Math.min(segments, Math.round(lz / step))) * stride + Math.max(0, Math.min(segments, Math.round(lx / step)))
    const ground = (lx: number, lz: number) => {
      const fx = Math.max(-1, Math.min(segments + 0.999, lx / step)), fz = Math.max(-1, Math.min(segments + 0.999, lz / step))
      const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz
      const a = heightAt(ix, iz), b = heightAt(ix + 1, iz), c = heightAt(ix, iz + 1), d = heightAt(ix + 1, iz + 1)
      if (u + v <= 1) return { y: a + (b - a) * u + (c - a) * v, normal: normalize([(a - b) / step, 1, (a - c) / step]) }
      return { y: d + (c - d) * (1 - u) + (b - d) * (1 - v), normal: normalize([(c - d) / step, 1, (b - d) / step]) }
    }

    const usable = (lx: number, lz: number, margin: number, exact = !detailed): TerrainPoint | null => {
      const id = nearest(lx, lz)
      const sample = exact ? this.terrain.sample(x0 + lx, z0 + lz) : samples[id]
      const road = exact ? this.network.influence(x0 + lx, z0 + lz) : influences[id]
      if (sample.height < sample.waterLevel + 0.3 || sample.sand > 0.3) return null
      if (road.distance < road.width / 2 + (this.paved(road, x0 + lx, z0 + lz, margin) ? SIDEWALK : 0) + margin) return null
      if (Math.hypot(x0 + lx - townX, z0 + lz - townZ) < townRadius * 0.85) return null
      if (this.settlements.blocked(x0 + lx, z0 + lz, margin + 0.6)) return null
      return sample
    }
    const push = (kind: number, x: number, y: number, z: number, q: number[], sx: number, sy: number, sz: number, tint: number) => {
      floor.push(x, y, z, q[0], q[1], q[2], q[3], sx, sy, sz, kind, tint)
    }

    const lay = (kind: number, lx: number, lz: number, yaw: number, sx: number, sy: number, sz: number, lift: number, tint: number) => {
      const { y, normal } = ground(lx, lz)
      const q = orient(yaw, normal)
      const at = { x: lx + normal[0] * lift, y: y + normal[1] * lift, z: lz + normal[2] * lift }
      push(kind, at.x, at.y, at.z, q, sx, sy, sz, tint)
      return { ...at, q }
    }

    const variantTint = (variant: number, count: number, shade: number) => (variant + Math.min(0.999, Math.max(0, shade))) / count

    const rest = (ax: number, az: number, bx: number, bz: number, lift: number) => {
      const mid = ground((ax + bx) / 2, (az + bz) / 2)
      let ya = ground(ax, az).y + lift, yb = ground(bx, bz).y + lift
      const rise = Math.max(0, mid.y + lift - (ya + yb) / 2)
      ya += rise; yb += rise
      const axis = normalize([bx - ax, yb - ya, bz - az]), n = mid.normal, along = dot(n, axis)
      const up = normalize([n[0] - axis[0] * along, n[1] - axis[1] * along, n[2] - axis[2] * along])
      return { x: (ax + bx) / 2, y: (ya + yb) / 2, z: (az + bz) / 2, axis, q: quaternionFromBasis(axis, up, cross(axis, up)) }
    }

    const boulder = (lx: number, lz: number, yaw: number, size: number, tint: number, bed: number) => {
      const spec = BOULDERS[pickVariant(tint, BOULDERS.length)]
      const rock = lay(BOULDER, lx, lz, yaw, size, size, size, -size * spec.tall * bed, tint)
      if (detailed) solids.push(rock.x, rock.y + size * spec.tall * 0.2, rock.z, ...rock.q, size * 0.8, size * spec.tall * 0.8, size * spec.deep * 0.8)
    }
    const pebbles = (cx: number, cz: number, spread: number, count: number, rng: () => number) => {
      for (let k = 0; k < count; k++) {
        const angle = rng() * Math.PI * 2, distance = spread * Math.sqrt(rng()), size = 0.06 + rng() ** 2 * 0.2
        const yaw = rng() * Math.PI * 2, tint = rng(), spec = PEBBLES[pickVariant(tint, PEBBLES.length)]
        const lx = cx + Math.cos(angle) * distance, lz = cz + Math.sin(angle) * distance

        if (owned(lx, lz) && usable(lx, lz, 0.3)) lay(PEBBLE, lx, lz, yaw, size, size, size, -size * spec.tall * 0.15, tint)
      }
    }
    const twig = (cx: number, cz: number, spread: number, rng: () => number) => {
      const angle = rng() * Math.PI * 2, distance = spread * Math.sqrt(rng())
      const length = 0.5 + rng() ** 1.6 * 2.1, yaw = rng() * Math.PI * 2, shade = rng()
      const variant = length > 1.1 && rng() < 0.5 ? 2 : rng() < 0.55 ? 0 : 1, spec = TWIGS[variant], scale = length / spec.length
      const lx = cx + Math.cos(angle) * distance, lz = cz + Math.sin(angle) * distance
      if (!owned(lx, lz) || !usable(lx, lz, 0.4)) return
      const dx = (Math.cos(yaw) * length) / 2, dz = (Math.sin(yaw) * length) / 2
      const pose = rest(lx - dx, lz - dz, lx + dx, lz + dz, (spec.thick * scale) / 2)
      push(TWIG, pose.x, pose.y, pose.z, pose.q, scale, scale, scale, variantTint(variant, TWIGS.length, shade))
    }
    const clearOfTrunks = (ax: number, az: number, bx: number, bz: number, margin: number) => {
      for (let i = 0; i < trees.length; i += 8) {
        const a = { x: ax, y: 0, z: az }, b = { x: bx, y: 0, z: bz }
        if (distanceToSegment(trees[i], trees[i + 2], { a, b } as RoadSegment).distance < margin + trees[i + 5] * 0.22) return false
      }
      return true
    }
    const cover = treeCover(trees, 12, 0.013)

    const drape = (lx: number, lz: number, lift: number, tint: Color, alpha = 1) => {
      const { y, normal } = ground(lx, lz)
      return litter.vertex(lx + normal[0] * lift, y + normal[1] * lift, lz + normal[2] * lift, normal, tint, lx / TILE.litter, -lz / TILE.litter, alpha)
    }

    const face = (a: number, b: number, c: number, layer: number) => {
      const p = litter.positions
      const ux = p[b * 3] - p[a * 3], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vz = p[c * 3 + 2] - p[a * 3 + 2]
      if (uz * vx - ux * vz >= 0) litter.triangle(a, b, c, layer)
      else litter.triangle(a, c, b, layer)
    }

    const reach = (radius: number, stretch: number) => radius * Math.max(1, stretch)

    const mat = (cx: number, cz: number, radius: number, stretch: number, yaw: number, needles: boolean, rng: () => number) => {
      const extent = reach(radius, stretch), limit = step - 0.3
      if (cx - extent < -limit || cz - extent < -limit || cx + extent > CHUNK_SIZE + limit || cz + extent > CHUNK_SIZE + limit) return
      const palette = needles ? NEEDLE_TINTS : LEAF_TINTS, layer = needles ? LITTER_LAYER.needles : LITTER_LAYER.leaves
      const cos = Math.cos(yaw), sin = Math.sin(yaw), raise = rng() * 0.008
      const at = (angle: number, r: number) => {
        const u = Math.cos(angle) * r * radius * stretch, v = Math.sin(angle) * r * radius
        return [cx + u * cos - v * sin, cz + u * sin + v * cos]
      }

      const phaseA = rng() * Math.PI * 2, phaseB = rng() * Math.PI * 2
      const outline = (angle: number) => 0.8 + 0.12 * Math.sin(angle * 2 + phaseA) + 0.08 * Math.sin(angle * 3 + phaseB)
      const tone = (colors: Color[], spread: number) => scaleColor(colors[Math.floor(rng() * colors.length)], 1 - spread / 2 + rng() * spread)
      const center = drape(cx, cz, 0.024 + raise, tone(palette, 0.24))
      const inner = Array.from({ length: 5 }, (_, j) => {
        const angle = (j / 5) * Math.PI * 2, [x, z] = at(angle, outline(angle) * (0.5 + rng() * 0.12))
        return drape(x, z, 0.018 + raise, tone(palette, 0.24))
      })
      const rim = Array.from({ length: 10 }, (_, j) => {
        const angle = ((j + (rng() - 0.5) * 0.3) / 10) * Math.PI * 2, [x, z] = at(angle, outline(angle) * (0.94 + rng() * 0.12))

        return drape(x, z, 0.008 + raise, tone(palette, 0.24), 0.62)
      })
      for (let j = 0; j < 5; j++) {
        const a = inner[j], b = inner[(j + 1) % 5], r0 = rim[2 * j], r1 = rim[2 * j + 1], r2 = rim[(2 * j + 2) % 10]
        face(center, a, b, layer); face(a, r0, r1, layer); face(a, r1, b, layer); face(b, r1, r2, layer)
      }
      if (needles) return

      for (let k = 0; k < 5; k++) {
        const distance = 0.2 + rng() * 0.7, angle = rng() * Math.PI * 2, [x, z] = at(angle, distance), turn = rng() * Math.PI * 2
        const tint = rng(), spec = LEAVES[pickVariant(tint, LEAVES.length)], scale = (0.08 + rng() * 0.08) / spec.length

        const r = distance / outline(angle)
        const surface = r < 0.56 ? 0.024 - (0.006 * r) / 0.56 : 0.018 - (0.01 * (r - 0.56)) / 0.44
        lay(LEAF, x, z, turn, scale, scale, scale, r <= 1 ? surface + raise - 0.001 : 0.001, tint)
      }
    }

    if (detailed) {

      for (let i = 0; i < trees.length; i += 8) {
        const tx = trees[i], tz = trees[i + 2], width = trees[i + 5], species = trees[i + 6]
        const rng = randomSource(hash2(Math.round((x0 + tx) * 8), Math.round((z0 + tz) * 8), seed ^ 0x5eaf))
        const crown = crownOf(species, width)

        const count = species === SPECIES.snag ? 1 : Math.max(1, Math.round((3.4 - cover(tx, tz) * 2.6) * (0.6 + rng() * 0.8)))
        for (let k = 0; k < count; k++) {
          const angle = rng() * Math.PI * 2, distance = crown * (0.15 + Math.sqrt(rng()) * 0.95), radius = 0.55 + rng() * 0.8
          const yaw = rng() * Math.PI * 2, stretch = 0.75 + rng() * 0.5
          const lx = tx + Math.cos(angle) * distance, lz = tz + Math.sin(angle) * distance
          if (usable(lx, lz, reach(radius, stretch) + 0.2)) mat(lx, lz, radius, stretch, yaw, dropsNeedles(species), rng)
        }
        const twigs = species === SPECIES.snag ? 3 + Math.floor(rng() * 3) : Math.floor(rng() * 2.4)
        for (let k = 0; k < twigs; k++) twig(tx, tz, crown * 1.3, rng)
        if (rng() < 0.3) pebbles(tx, tz, crown, 1 + Math.floor(rng() * 3), rng)
      }

      const cell = 5
      for (let gz = Math.floor(z0 / cell); gz <= Math.floor((z0 + CHUNK_SIZE) / cell); gz++) for (let gx = Math.floor(x0 / cell); gx <= Math.floor((x0 + CHUNK_SIZE) / cell); gx++) {
        const lx = (gx + randomAt(gx, gz, seed ^ 0x61a1)) * cell - x0, lz = (gz + randomAt(gx, gz, seed ^ 0x18c3)) * cell - z0
        if (!owned(lx, lz)) continue
        const sample = usable(lx, lz, 0.6)
        if (!sample) continue
        const canopy = cover(lx, lz), roll = randomAt(gx, gz, seed ^ 0x3c57)
        const rng = randomSource(hash2(gx, gz, seed ^ 0x7a9d))
        if (roll < canopy * 0.36) {
          const radius = 0.5 + rng() * 0.75, stretch = 0.75 + rng() * 0.5
          if (usable(lx, lz, reach(radius, stretch) + 0.2)) mat(lx, lz, radius, stretch, rng() * Math.PI * 2, sample.biome === 'pine', rng)
        } else if (roll < canopy * 0.5) twig(lx, lz, 1.5, rng)
        if (randomAt(gx, gz, seed ^ 0x7d11) < 0.02 + canopy * 0.03) pebbles(lx, lz, 1.4, 2 + Math.floor(rng() * 4), rng)
      }
    }

    const logCell = 24
    for (let gz = Math.floor(z0 / logCell); gz <= Math.floor((z0 + CHUNK_SIZE) / logCell); gz++) for (let gx = Math.floor(x0 / logCell); gx <= Math.floor((x0 + CHUNK_SIZE) / logCell); gx++) {
      const lx = (gx + 0.15 + randomAt(gx, gz, seed ^ 0x2b77) * 0.7) * logCell - x0, lz = (gz + 0.15 + randomAt(gx, gz, seed ^ 0x6d05) * 0.7) * logCell - z0
      if (!owned(lx, lz)) continue
      const sample = usable(lx, lz, 3, true)
      if (!sample) continue
      const canopy = cover(lx, lz)
      if (canopy < 0.2) continue
      const roll = randomAt(gx, gz, seed ^ 0x10a7), rng = randomSource(hash2(gx, gz, seed ^ 0x4b1d))
      if (roll < canopy * (0.16 + sample.dense * 0.2)) {
        const wanted = 3.5 + rng() * 7.5, yaw = rng() * Math.PI * 2, shade = rng(), uprooted = rng() < 0.38
        const variant = uprooted ? UPROOTED_LOG : wanted < 5 ? 0 : wanted < 8 ? 1 : 2, spec = LOGS[variant]
        const scale = Math.min(1.2, Math.max(0.85, wanted / spec.length)), length = spec.length * scale, radius = spec.radius * scale
        const dirX = Math.cos(yaw), dirZ = Math.sin(yaw)
        const ax = lx - (dirX * length) / 2, az = lz - (dirZ * length) / 2, bx = lx + (dirX * length) / 2, bz = lz + (dirZ * length) / 2
        if (!owned(ax, az) || !owned(bx, bz) || !usable(ax, az, 2, true) || !usable(bx, bz, 2, true) || !clearOfTrunks(ax, az, bx, bz, 0.5)) continue

        const plate = (spec.plate ?? 0) * scale, plateDepth = (spec.plateDepth ?? 0) * scale, rx = ax - dirX * 1.45 * scale, rz = az - dirZ * 1.45 * scale
        if (uprooted && (!owned(rx, rz) || !usable(rx, rz, plate + 0.5, true) || !clearOfTrunks(ax, az, rx, rz, plate + 0.3))) continue

        if (Math.abs(this.height(x0 + ax, z0 + az) - this.height(x0 + bx, z0 + bz)) / length > 0.45) continue

        const pose = rest(ax, az, bx, bz, radius * 0.8)
        push(LOG, pose.x, pose.y, pose.z, pose.q, scale, scale, scale, variantTint(variant, LOGS.length, shade))
        if (detailed) solids.push(pose.x, pose.y, pose.z, ...pose.q, length / 2, radius * 0.85, radius * 0.85)
        if (uprooted && detailed) {
          const back = length / 2 + plateDepth / 2
          solids.push(pose.x - pose.axis[0] * back, pose.y - pose.axis[1] * back, pose.z - pose.axis[2] * back, ...pose.q, plateDepth / 2, plate * 0.8, plate * 0.8)
        }
      } else if (roll > 1 - canopy * 0.08) {
        const wanted = 0.22 + rng() * 0.3, yaw = rng() * Math.PI * 2, tint = rng()
        const spec = STUMPS[pickVariant(tint, STUMPS.length)], scale = wanted / spec.radius
        const radius = spec.radius * scale, height = spec.height * scale, flare = radius * STUMP_FLARE
        if (!clearOfTrunks(lx, lz, lx, lz, flare + 0.3)) continue

        let y = ground(lx, lz).y
        for (let k = 0; k < 8; k++) y = Math.min(y, ground(lx + Math.cos((k * Math.PI) / 4) * flare, lz + Math.sin((k * Math.PI) / 4) * flare).y)
        y -= 0.02
        const q = orient(yaw, UP)
        push(STUMP, lx, y, lz, q, scale, scale, scale, tint)
        if (detailed) solids.push(lx, y + height / 2, lz, ...q, radius * 0.85, height / 2, radius * 0.85)
      }
    }

    const clusterCell = 80
    for (let gz = Math.floor((z0 - 16) / clusterCell); gz <= Math.floor((z0 + CHUNK_SIZE + 16) / clusterCell); gz++) for (let gx = Math.floor((x0 - 16) / clusterCell); gx <= Math.floor((x0 + CHUNK_SIZE + 16) / clusterCell); gx++) {
      const cx = (gx + 0.2 + randomAt(gx, gz, seed ^ 0x6b0b) * 0.6) * clusterCell, cz = (gz + 0.2 + randomAt(gx, gz, seed ^ 0x1f3f) * 0.6) * clusterCell
      const rockiness = smoothstep(0.15, 0.55, this.terrain.detail.at(cx / 300 + 51, cz / 300 - 9))
      if (rockiness <= 0) continue
      const site = this.terrain.sample(cx, cz)
      const affinity = site.biome === 'forest' || site.biome === 'denseForest' || site.biome === 'pine' || site.biome === 'highlands' || site.biome === 'scrub' ? 1
        : site.biome === 'meadow' ? 0.55 : site.biome === 'river' || site.biome === 'wetland' ? 0.35 : 0
      if (randomAt(gx, gz, seed ^ 0x2e2e) > rockiness * affinity * 0.8) continue
      const rng = randomSource(hash2(gx, gz, seed ^ 0x0b01))
      const count = 3 + Math.floor(rng() * 7), spread = 5 + rng() * 9
      for (let k = 0; k < count; k++) {

        const angle = rng() * Math.PI * 2, distance = k === 0 ? 0 : spread * (0.25 + Math.sqrt(rng()) * 0.75)
        const size = k === 0 ? 1.3 + rng() * 1.3 : (0.45 + rng() * 1.2) * (1 - distance / (spread * 1.6))
        const yaw = rng() * Math.PI * 2, tint = rng()
        const lx = cx + Math.cos(angle) * distance - x0, lz = cz + Math.sin(angle) * distance - z0
        if (!owned(lx, lz) || !usable(lx, lz, size + 1.5, true)) continue
        boulder(lx, lz, yaw, size, tint, 0.08)
      }
      if (detailed) pebbles(cx - x0, cz - z0, spread * 1.3, 8 + Math.floor(rng() * 10), randomSource(hash2(gx, gz, seed ^ 0x0b99)))
    }

    for (let k = 0; k < scattered.length; k += 5) boulder(scattered[k] - x0, scattered[k + 1] - z0, scattered[k + 2], scattered[k + 3], scattered[k + 4], 0.1)
    return { floor, litter: litter.finish() }
  }

  private buildWater(
    samples: TerrainPoint[], segments: number, step: number, heightAt: (ix: number, iz: number) => number,
    levelAt: (ix: number, iz: number) => number, x0: number, z0: number, spray: boolean,
  ) {
    const water = new MeshBuilder()
    const falls = new MeshBuilder(true, true)
    const emitters: number[] = []
    const stride = segments + 1
    const level = (ix: number, iz: number) => samples[iz * stride + ix].waterLevel
    const foam = new Float64Array(stride * stride)
    const current = new Float32Array(stride * stride * 2)

    const slopes = new Float32Array(stride * stride * 2)
    const lips = new Float32Array(stride * stride), feet = new Float32Array(stride * stride)
    for (let iz = 0; iz <= segments; iz++) for (let ix = 0; ix <= segments; ix++) {
      const here = level(ix, iz)
      if (here <= WATER_NONE) continue
      const id = iz * stride + ix, sample = samples[id]
      const at = (x: number, z: number) => {
        const other = levelAt(x, z)
        return other > WATER_NONE ? other : here
      }
      let rise = 0, drop = 0
      for (const [nx, nz] of WATER_NEIGHBOURS) {
        const other = levelAt(ix + nx, iz + nz)
        if (other <= WATER_NONE) continue
        rise = Math.max(rise, (other - here) / step)
        drop = Math.max(drop, (here - other) / step)
      }
      const gx = (at(ix + 1, iz) - at(ix - 1, iz)) / (2 * step), gz = (at(ix, iz + 1) - at(ix, iz - 1)) / (2 * step)
      slopes[id * 2] = gx
      slopes[id * 2 + 1] = gz

      const measured = sample.lip + sample.foot > 0.3
      lips[id] = measured ? sample.lip : rise * step
      feet[id] = measured ? sample.foot : drop * step

      const rapids = smoothstep(0.1, 0.45, Math.max(rise, drop))
      const glassy = sample.fall > 0.15 ? smoothstep(FALL_SLOPE * 0.8, FALL_SLOPE * 1.6, drop) * (1 - smoothstep(0.15, 0.4, rise)) : 0
      const plunge = (1 - smoothstep(0.2, 0.8, sample.foot)) * smoothstep(0.35, 0.9, sample.fall) * smoothstep(2, 8, sample.lip + sample.foot)
      foam[id] = Math.max(rapids * (1 - 0.85 * glassy), plunge * 0.95)
      if (spray && ix < segments && iz < segments && rise >= FALL_SLOPE && drop < FALL_SLOPE * 0.5) {
        const known = sample.fallX !== 0 || sample.fallZ !== 0, length = Math.hypot(gx, gz) || 1
        emitters.push(
          ix * step, here, iz * step,
          known ? sample.fallX : -gx / length, known ? sample.fallZ : -gz / length,
          Math.max(lips[id] + feet[id], rise * step),
        )
      }
      if (sample.water !== 'river' || (!sample.flowX && !sample.flowZ)) continue

      const slope = ((at(ix + 1, iz) - at(ix - 1, iz)) * sample.flowX + (at(ix, iz + 1) - at(ix, iz - 1)) * sample.flowZ) / (2 * step)
      const speed = channelSpeed(slope, rapids, sample.downstream)
      current[id * 2] = sample.flowX * speed
      current[id * 2 + 1] = sample.flowZ * speed
    }
    type WaterPoint = {
      x: number; y: number; z: number; depth: number; foam: number; kind: number; fx: number; fz: number

      sx: number; sz: number; lip: number; foot: number; ax: number; az: number
    }
    const mix = (p: WaterPoint, q: WaterPoint, t: number): WaterPoint => ({
      x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t), z: lerp(p.z, q.z, t), depth: 0,
      foam: lerp(p.foam, q.foam, t), kind: lerp(p.kind, q.kind, t), fx: lerp(p.fx, q.fx, t), fz: lerp(p.fz, q.fz, t),
      sx: lerp(p.sx, q.sx, t), sz: lerp(p.sz, q.sz, t), lip: lerp(p.lip, q.lip, t), foot: lerp(p.foot, q.foot, t),
      ax: lerp(p.ax, q.ax, t), az: lerp(p.az, q.az, t),
    })
    const triangle = (ids: [number, number][]) => {
      const raw = ids.map(([ix, iz]) => level(ix, iz))
      const top = Math.max(...raw)
      if (top <= WATER_NONE) return
      const points = ids.map(([ix, iz], k): WaterPoint => {
        const id = iz * stride + ix, sample = samples[id], kind = sample.water
        const surface = raw[k] > WATER_NONE ? raw[k] : top
        const sx = slopes[id * 2], sz = slopes[id * 2 + 1], length = Math.hypot(sx, sz)
        const known = sample.fallX !== 0 || sample.fallZ !== 0
        return {
          x: ix * step, z: iz * step, y: surface, depth: surface - heightAt(ix, iz), foam: foam[id],
          kind: kind === 'ocean' ? 0 : kind === 'river' ? 1 : 0.5, fx: current[id * 2], fz: current[id * 2 + 1],
          sx, sz, lip: lips[id], foot: feet[id],
          ax: known ? sample.fallX : length > 0 ? -sx / length : 0, az: known ? sample.fallZ : length > 0 ? -sz / length : 0,
        }
      })
      if (points.every((p) => p.depth <= 0)) return

      const [p0, p1, p2] = points
      const ux = p1.x - p0.x, uy = p1.y - p0.y, uz = p1.z - p0.z, vx = p2.x - p0.x, vy = p2.y - p0.y, vz = p2.z - p0.z
      const steep = Math.hypot(uy * vz - uz * vy, ux * vy - uy * vx) / Math.abs(uz * vx - ux * vz)

      const wet = points.find((p) => p.ax !== 0 || p.az !== 0)
      if (wet) for (const p of points) if (p.ax === 0 && p.az === 0) { p.ax = wet.ax; p.az = wet.az }

      const polygon: WaterPoint[] = []
      for (let i = 0; i < 3; i++) {
        const p = points[i], q = points[(i + 1) % 3]
        if (p.depth > 0) polygon.push(p)
        if ((p.depth > 0) !== (q.depth > 0)) polygon.push(mix(p, q, p.depth / (p.depth - q.depth)))
      }
      if (polygon.length < 3) return
      if (steep < FALL_SLOPE || !wet) {
        const ids2 = polygon.map((p) => water.vertex(p.x, p.y + 0.02, p.z, [p.fx, 1, p.fz], [Math.max(0, p.depth), p.foam, p.kind]))
        for (let i = 1; i < ids2.length - 1; i++) water.triangle(ids2[0], ids2[i], ids2[i + 1])
        return
      }

      const angle = (p: WaterPoint) => Math.atan2(p.az, p.ax)
      const base = angle(wet)
      const axis = Math.floor(base / FALL_AXIS_STEP) * FALL_AXIS_STEP
      const c0x = -Math.sin(axis), c0z = Math.cos(axis)
      const c1x = -Math.sin(axis + FALL_AXIS_STEP), c1z = Math.cos(axis + FALL_AXIS_STEP)
      const across = polygon.map((p) => [(x0 + p.x) * c0x + (z0 + p.z) * c0z, (x0 + p.x) * c1x + (z0 + p.z) * c1z])
      const fold0 = Math.floor(across[0][0] / FALL_TILE) * FALL_TILE, fold1 = Math.floor(across[0][1] / FALL_TILE) * FALL_TILE
      const ids2 = polygon.map((p, k) => {
        let turn = angle(p) - base
        turn -= Math.round(turn / (Math.PI * 2)) * Math.PI * 2
        const length = Math.hypot(p.sx, 1, p.sz)
        return falls.vertex(
          p.x, p.y + 0.02, p.z, [-p.sx / length, 1 / length, -p.sz / length],
          [Math.max(0, p.depth), p.lip, p.foot], across[k][0] - fold0, across[k][1] - fold1, clamp01((base + turn - axis) / FALL_AXIS_STEP),
        )
      })
      for (let i = 1; i < ids2.length - 1; i++) falls.triangle(ids2[0], ids2[i], ids2[i + 1])
    }
    for (let iz = 0; iz < segments; iz++) for (let ix = 0; ix < segments; ix++) {
      triangle([[ix, iz], [ix, iz + 1], [ix + 1, iz]])
      triangle([[ix + 1, iz], [ix, iz + 1], [ix + 1, iz + 1]])
    }
    return { water: water.finish(), waterfall: falls.finish(), spray: new Float32Array(emitters) }
  }

  buildAtlas(bounds: Bounds, size = 192): AtlasData {
    const pixels = new Uint8ClampedArray(size * size * 4)
    const span = bounds.maxX - bounds.minX
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const x = lerp(bounds.minX, bounds.maxX, col / (size - 1)), z = lerp(bounds.minZ, bounds.maxZ, row / (size - 1))
      const sample = this.terrain.sample(x, z)
      const dry = clamp01(0.28 - sample.moisture * 0.55)
      const underwater = sample.height < sample.waterLevel
      let color = underwater ? mixColor(WATER, DEEP_WATER, smoothstep(1, 30, sample.waterLevel - sample.height)) : mixColor(GREEN, EARTH, dry)
      if (!underwater && sample.biome === 'beach') color = SAND
      const elevation = clamp01(sample.height / 1_000)
      if (!underwater) color = mixColor(color, MARKING, elevation * 0.63)
      const gradient = (sample.height - this.terrain.height(x + Math.max(24, span / size), z - Math.max(24, span / size))) / Math.max(24, span / size)
      const light = underwater ? 1 : Math.max(0.65, Math.min(1.2, 0.96 - gradient * 0.3))
      const index = (row * size + col) * 4
      for (let c = 0; c < 3; c++) pixels[index + c] = Math.round(Math.min(255, Math.pow(color[c] * light, 1 / 2.2) * 255))
      pixels[index + 3] = 255
    }
    const local = span <= 16_000 && bounds.maxZ - bounds.minZ <= 16_000
    if (local) this.prepare(bounds)
    const features = local ? this.network.atlasFeatures(bounds) : { towns: [], roads: [] }
    return {
      bounds, size, pixels, towns: features.towns,
      roads: features.roads.map((road) => ({ id: road.id, kind: road.kind, points: road.points.filter((_, i) => i % 5 === 0 || i === road.points.length - 1).map((p) => ({ x: p.x, z: p.z })) })),
    }
  }
}

export function sampleChunkHeight(data: ChunkData, x: number, z: number) {
  const step = CHUNK_SIZE / data.segments, stride = data.segments + 1
  const fx = Math.max(0, Math.min(data.segments - 0.000001, (x - data.cx * CHUNK_SIZE) / step))
  const fz = Math.max(0, Math.min(data.segments - 0.000001, (z - data.cz * CHUNK_SIZE) / step))
  const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz
  const positions = data.terrain.positions
  const a = positions[(iz * stride + ix) * 3 + 1], b = positions[(iz * stride + ix + 1) * 3 + 1]
  const c = positions[((iz + 1) * stride + ix) * 3 + 1], d = positions[((iz + 1) * stride + ix + 1) * 3 + 1]
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v)
}
