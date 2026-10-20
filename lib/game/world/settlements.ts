import footprintData from './footprints.generated.json'
import { hash, random, type Condition } from '../blockout/types'
import { RoadNetwork, ROAD_SPEC, SIDEWALK, distanceToSegment } from './roads'
import { Terrain } from './terrain'
import { hash2, hashString, randomSource, smoothstep, LruCache } from './noise'
import { REGION_SIZE, SEA_LEVEL, STRUCTURE_SCALE, WATER_NONE } from './settings'
import type { Biome, Bounds, Road, RoadSegment, Town } from './types'

type Entry = {
  nx: number; nz: number; cells: [number, number][]; bay: [number, number]; bayMin: [number, number]
  ext: [number, number, number, number]; eave: number; ridge: number; floors: number; pitched: boolean
  fixed?: [number, number, number, number]
}
const TABLE = footprintData as unknown as Record<string, Entry>
export const STRUCTURE_BLUEPRINTS = Object.keys(TABLE)
const BLUEPRINT_INDEX = new Map(STRUCTURE_BLUEPRINTS.map((id, index) => [id, index]))
export const STRUCTURE_CONDITIONS: Condition[] = ['weathered', 'damaged', 'burned', 'ruined', 'leveled']
export type Zone = 'civic' | 'core' | 'main' | 'residential' | 'edge' | 'ribbon' | 'farm' | 'wild' | 'roadside' | 'utility' | 'rare'
export const STRUCTURE_ZONES: Zone[] = ['civic', 'core', 'main', 'residential', 'edge', 'ribbon', 'farm', 'wild', 'roadside', 'utility', 'rare']

export const STRUCTURE_STRIDE = 16

export type Footprint = {
  minX: number; maxX: number; minZ: number; maxZ: number; eave: number; ridge: number; pitched: boolean

  rects: [number, number, number, number][]
}

const footprints = new Map<string, Footprint>()

export function footprintOf(blueprint: string, seed: number): Footprint {
  const key = `${blueprint}:${seed}`
  const cached = footprints.get(key)
  if (cached) return cached
  const e = TABLE[blueprint]
  if (!e) throw new Error(`Estrutura sem medida: ${blueprint}`)

  const k = STRUCTURE_SCALE
  let result: Footprint
  if (e.fixed) {
    const [x0, x1, z0, z1] = e.fixed.map((v) => v * k)
    result = { minX: x0, maxX: x1, minZ: z0, maxZ: z1, eave: e.eave * k, ridge: e.ridge * k, pitched: false, rects: [[x0 + 9 * k, x1 - 9 * k, z0 + 9 * k, z1 - 9 * k]] }
  } else {
    const variation = 1 + (random(hash(`${blueprint}:${seed}`))() - 0.5) * 0.08
    const bx = Math.max(e.bay[0] * variation, e.bayMin[0]) * k, bz = Math.max(e.bay[1] * variation, e.bayMin[1]) * k
    const hx = e.nx * bx / 2, hz = e.nz * bz / 2
    const rects: Footprint['rects'] = []
    for (let z = 0; z < e.nz; z++) {
      const row = e.cells.filter((cell) => cell[1] === z).map((cell) => cell[0]).sort((a, b) => a - b)
      for (let i = 0; i < row.length;) {
        let j = i
        while (j + 1 < row.length && row[j + 1] === row[j] + 1) j++
        rects.push([-hx + row[i] * bx, -hx + (row[j] + 1) * bx, -hz + z * bz, -hz + (z + 1) * bz])
        i = j + 1
      }
    }
    result = { minX: -hx - e.ext[0] * k, maxX: hx + e.ext[1] * k, minZ: -hz - e.ext[2] * k, maxZ: hz + e.ext[3] * k, eave: e.eave * k, ridge: e.ridge * k, pitched: e.ridge - e.eave > 1.4, rects }
  }
  if (footprints.size > 4096) footprints.clear()
  footprints.set(key, result)
  return result
}

export type Fate = 'abandoned' | 'overgrown' | 'looted' | 'burned' | 'bombed'
export const FATE_LABELS: Record<Fate, string> = { abandoned: 'abandonada', overgrown: 'tomada pelo mato', looted: 'saqueada', burned: 'incendiada', bombed: 'bombardeada' }
export const KIND_LABELS: Record<Town['kind'], string> = { hamlet: 'Povoado', village: 'Cidade do interior', town: 'Cidade média', city: 'Cidade grande' }
type Impact = { x: number; z: number; r: number }
export type SettlementProfile = { fate: Fate; reclaim: number; impacts: Impact[]; fireSeed: number }

const FATE_WEIGHTS: Record<Town['kind'], [Fate, number][]> = {
  hamlet: [['abandoned', 0.42], ['overgrown', 0.32], ['looted', 0.15], ['burned', 0.08], ['bombed', 0.03]],
  village: [['abandoned', 0.36], ['overgrown', 0.2], ['looted', 0.23], ['burned', 0.13], ['bombed', 0.08]],
  town: [['abandoned', 0.25], ['overgrown', 0.1], ['looted', 0.27], ['burned', 0.18], ['bombed', 0.2]],
  city: [['abandoned', 0.14], ['overgrown', 0.06], ['looted', 0.27], ['burned', 0.2], ['bombed', 0.33]],
}

export function settlementProfile(terrain: Terrain, town: Town): SettlementProfile {
  const rng = randomSource(hash2(town.cx, town.cz, terrain.seed ^ 0x6f1a3))
  let roll = rng(), fate: Fate = 'abandoned'
  for (const [option, weight] of FATE_WEIGHTS[town.kind]) { if ((roll -= weight) <= 0) { fate = option; break } }
  const impacts: Impact[] = []
  if (fate === 'bombed') {
    const count = town.kind === 'city' ? 3 + Math.floor(rng() * 3) : town.kind === 'town' ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2)
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2, distance = Math.sqrt(rng()) * town.radius * 0.55
      impacts.push({ x: town.x + Math.cos(angle) * distance, z: town.z + Math.sin(angle) * distance, r: town.radius * (0.18 + rng() * 0.22) })
    }
  }
  const reclaim = fate === 'overgrown' ? 0.75 + rng() * 0.25 : fate === 'abandoned' ? 0.3 + rng() * 0.3 : fate === 'bombed' ? 0.1 : 0.2 + rng() * 0.2
  return { fate, reclaim, impacts, fireSeed: Math.floor(rng() * 1e6) }
}

type Pool = [string, number][]
const HOMES: Record<Town['kind'], Pool> = {
  hamlet: [['cottage', 3], ['wood-house', 3], ['bungalow', 2], ['family-house', 1], ['unfinished-house', 1], ['caretaker-house', 0.5], ['workshop-house', 0.5]],
  village: [['cottage', 3], ['family-house', 2.2], ['bungalow', 2], ['wood-house', 1.5], ['rowhouse', 1], ['unfinished-house', 1], ['workshop-house', 0.8], ['courtyard-house', 0.5], ['rental-room', 0.5], ['shop-house', 0.6], ['boarding-house', 0.3]],
  town: [['family-house', 3], ['cottage', 2], ['duplex', 2], ['rowhouse', 1.5], ['bungalow', 1], ['courtyard-house', 1], ['large-house', 1], ['rental-room', 0.8], ['residential-court', 0.6], ['unfinished-house', 0.6], ['workshop-house', 0.6], ['shop-house', 0.8], ['boarding-house', 0.5]],
  city: [['family-house', 3], ['large-house', 2.5], ['duplex', 2.5], ['courtyard-house', 1.5], ['residential-court', 1.2], ['rowhouse', 1.2], ['rental-room', 0.6], ['shop-house', 1], ['boarding-house', 0.4], ['apartment-building', 0.5]],
}
const CORNER_HOMES: Pool = [['corner-house', 1]]
const CORNER_SHOPS: Pool = [['bar', 3], ['grocery', 2], ['bakery', 1.5], ['salon', 1], ['barbershop', 1], ['pharmacy', 0.6], ['laundry', 0.5], ['repair-shop', 0.5], ['produce', 0.4]]
const SHOPS_BASIC: Pool = [
  ['grocery', 3], ['pharmacy', 2], ['bakery', 2], ['bar', 2.5], ['butcher', 1.2], ['hardware', 1], ['salon', 1], ['barbershop', 1.2], ['diner', 1], ['restaurant', 0.8],
  ['clothing', 0.8], ['produce', 0.8], ['repair-shop', 0.6], ['stationery', 0.6], ['laundry', 0.5], ['shop-house', 0.9], ['thrift-store', 0.4], ['tailor', 0.4], ['cobbler', 0.3],
  ['flower-shop', 0.3], ['pet-store', 0.4], ['ice-cream', 0.4], ['cafe', 0.6], ['pizzeria', 0.6], ['paint-store', 0.3],
]
const SHOPS: Record<Town['kind'], Pool> = {
  hamlet: [['bar', 3], ['grocery', 2.5], ['agro-store', 1], ['shop-house', 1.5], ['butcher', 0.5], ['tire-shop', 0.5]],
  village: [...SHOPS_BASIC, ['agro-store', 1.4], ['inn', 0.3], ['tire-shop', 0.5], ['fishing-store', 0.2]],
  town: [
    ...SHOPS_BASIC, ['shoe-store', 0.8], ['electronics', 0.8], ['furniture-store', 0.6], ['bookshop', 0.5], ['optician', 0.5], ['jeweler', 0.4], ['pawnshop', 0.5], ['gun-store', 0.4],
    ['sports-store', 0.5], ['toy-store', 0.4], ['music-store', 0.3], ['photo-store', 0.3], ['internet-cafe', 0.5], ['arcade-hall', 0.3], ['print-shop', 0.3], ['camping-store', 0.3],
    ['tea-house', 0.2], ['inn', 0.4], ['apartment-building', 0.9], ['office-building', 0.25], ['agro-store', 0.4],
  ],
  city: [
    ...SHOPS_BASIC, ['shoe-store', 1], ['electronics', 1.2], ['furniture-store', 0.8], ['bookshop', 0.7], ['optician', 0.7], ['jeweler', 0.6], ['pawnshop', 0.6], ['gun-store', 0.5],
    ['sports-store', 0.8], ['toy-store', 0.6], ['music-store', 0.5], ['photo-store', 0.5], ['internet-cafe', 0.7], ['arcade-hall', 0.5], ['print-shop', 0.5], ['camping-store', 0.4],
    ['tea-house', 0.4], ['apartment-building', 7], ['office-building', 4.5], ['shop-house', 2],
  ],
}
const EDGE: Pool = [
  ['cottage', 2], ['unfinished-house', 2], ['wood-house', 1.5], ['workshop-house', 1.2], ['garage', 1], ['tire-shop', 0.8], ['construction-supply', 0.6], ['warehouse', 0.7],
  ['agro-store', 0.6], ['car-wash', 0.4], ['motorcycle-shop', 0.4], ['auto-parts', 0.4], ['rental-room', 0.6], ['caretaker-house', 0.4], ['grain-store', 0.3],
]
const RIBBON: Pool = [
  ['cottage', 2], ['wood-house', 1.5], ['unfinished-house', 1.5], ['family-house', 1], ['workshop-house', 0.6], ['bar', 0.8], ['tire-shop', 0.8], ['fuel-station', 0.7], ['diner', 0.5],
  ['garage', 0.6], ['agro-store', 0.4], ['construction-supply', 0.4], ['car-wash', 0.3], ['motel', 0.3], ['warehouse', 0.3],
]

const CIVIC: Record<Town['kind'], [string, number][]> = {
  hamlet: [['church', 0.75], ['school', 0.35], ['rural-clinic', 0.25], ['community-center', 0.15]],
  village: [['church', 1], ['town-hall', 0.75], ['school', 1], ['clinic', 0.9], ['police', 0.55], ['post-office', 0.55], ['bank', 0.3], ['community-center', 0.35], ['daycare', 0.3], ['funeral-home', 0.25], ['library', 0.15]],
  town: [
    ['town-hall', 1], ['church', 1], ['bank', 1], ['post-office', 1], ['police', 1], ['clinic', 1], ['school', 1], ['hospital-building', 0.15], ['fire-station', 0.75], ['bus-depot', 0.7],
    ['library', 0.7], ['school', 0.6], ['bank', 0.5], ['community-center', 0.6], ['daycare', 0.6], ['funeral-home', 0.5], ['dental-clinic', 0.6], ['veterinary', 0.4], ['train-station', 0.25], ['church', 0.3],
  ],
  city: [
    ['hospital-building', 1], ['town-hall', 1], ['church', 1], ['bank', 1], ['bank', 1], ['post-office', 1], ['police', 1], ['fire-station', 1], ['library', 1], ['bus-depot', 1],
    ['school', 1], ['school', 1], ['clinic', 1], ['train-station', 0.7], ['church', 0.8], ['school', 0.7], ['clinic', 0.7], ['police', 0.6], ['bank', 0.6], ['community-center', 0.8],
    ['daycare', 0.8], ['dental-clinic', 0.8], ['veterinary', 0.6], ['funeral-home', 0.7], ['shelter', 0.5],
  ],
}

const CIVIC_BAND: Record<string, [number, number]> = {
  'town-hall': [0, 0.3], church: [0, 0.35], bank: [0, 0.4], 'post-office': [0, 0.45], police: [0.1, 0.55], library: [0.1, 0.55], clinic: [0.15, 0.65], 'hospital-building': [0.2, 0.75],
  'fire-station': [0.2, 0.75], 'bus-depot': [0.35, 0.95], 'train-station': [0.45, 1], school: [0.25, 0.85], daycare: [0.3, 0.9], 'community-center': [0.2, 0.7], 'funeral-home': [0.35, 0.9],
  'dental-clinic': [0.15, 0.6], veterinary: [0.35, 0.9], shelter: [0.3, 0.9], 'rural-clinic': [0, 0.5],
}

const LIMIT: Record<string, number> = {
  grocery: 4, bar: 6, pharmacy: 3, bakery: 3, butcher: 2, salon: 3, barbershop: 3, diner: 2, restaurant: 2, cafe: 2, clothing: 2, hardware: 2, produce: 2,
  laundry: 2, 'repair-shop': 2, 'shop-house': 18, 'fuel-station': 2, motel: 1, inn: 1, 'agro-store': 2, 'tire-shop': 2, garage: 2, 'apartment-building': 60, 'office-building': 40,
}
const HOME_IDS = new Set(Object.values(HOMES).flat().map(([id]) => id).concat(['corner-house', 'farmhouse']))
function limitOf(id: string, kind: Town['kind']) {
  if (HOME_IDS.has(id) && id !== 'shop-house' && id !== 'apartment-building') return Infinity
  const base = LIMIT[id] ?? 1
  return kind === 'city' ? Math.max(base * 2, 3) : kind === 'hamlet' ? Math.min(base, 1) : base
}
type KindRule = {
  core: number; main: number; residential: number; ribbon: number; vacancy: number
  setback: [number, number]; gap: [number, number]; streetTrees: number; backyard: number
}
const KIND: Record<Town['kind'], KindRule> = {
  hamlet: { core: 0.28, main: 0.5, residential: 0.86, ribbon: 1.3, vacancy: 0.42, setback: [2.5, 8], gap: [3, 10], streetTrees: 0.1, backyard: 0.34 },
  village: { core: 0.3, main: 0.55, residential: 0.95, ribbon: 1.45, vacancy: 0.2, setback: [1, 4.5], gap: [1, 4.5], streetTrees: 0.3, backyard: 0.26 },
  town: { core: 0.34, main: 0.6, residential: 1, ribbon: 1.55, vacancy: 0.13, setback: [0.7, 4], gap: [0.6, 3.4], streetTrees: 0.42, backyard: 0.2 },
  city: { core: 0.44, main: 0.66, residential: 1.03, ribbon: 1.5, vacancy: 0.07, setback: [0.6, 5], gap: [0.4, 3], streetTrees: 0.52, backyard: 0.14 },
}

export type Site = {
  id: number; blueprint: string; index: number; condition: Condition; zone: Zone
  x: number; y: number; z: number; yaw: number; c: number; s: number; fp: Footprint

  minX: number; maxX: number; minZ: number; maxZ: number
}
export type StreetTree = { x: number; z: number; height: number; species: number; dead: boolean }
type RegionPlan = { sites: Site[]; buckets: Map<number, Site[]>; trees: StreetTree[]; towns: TownArea[] }
type TownArea = { town: Town; profile: SettlementProfile; rule: KindRule; cos: number; sin: number; ex: number; ez: number }
type Frame = { x: number; z: number; y: number; tx: number; tz: number; bridge: boolean }
type Corners = [number, number][]

const BUCKET = 32
const EMPTY: Site[] = []

const bucketKey = (bx: number, bz: number) => (bx + 131072) * 262144 + (bz + 131072)

const PAD_MARGIN = 1.4
const PAD_BLEND_MIN = 8
const PAD_BLEND = 20
const PAD_RUN = 2.6

export const coarseReach = (step: number) => PAD_MARGIN + step * 1.5
const NEAR_BORDER = 90
const OAK = 0, BIRCH = 4, MAPLE = 5, SNAG = 2

const pick = (pool: Pool, roll: number, skip?: (id: string) => boolean) => {
  const options = skip ? pool.filter(([id]) => !skip(id)) : pool
  const total = options.reduce((sum, [, weight]) => sum + weight, 0)
  let value = roll * total
  for (const [id, weight] of options) if ((value -= weight) <= 0) return id
  return options[options.length - 1]?.[0] ?? null
}

function cornersOf(site: Pick<Site, 'x' | 'z' | 'c' | 's' | 'fp'>, margin: number): Corners {
  const { fp, c, s } = site
  const x0 = fp.minX - margin, x1 = fp.maxX + margin, z0 = fp.minZ - margin, z1 = fp.maxZ + margin
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([lx, lz]) => [site.x + c * lx + s * lz, site.z - s * lx + c * lz]) as Corners
}

function overlaps(a: Corners, b: Corners) {
  for (const poly of [a, b]) for (let i = 0; i < 4; i++) {
    const p = poly[i], q = poly[(i + 1) % 4], ax = q[1] - p[1], az = p[0] - q[0]
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity
    for (const v of a) { const d = v[0] * ax + v[1] * az; minA = Math.min(minA, d); maxA = Math.max(maxA, d) }
    for (const v of b) { const d = v[0] * ax + v[1] * az; minB = Math.min(minB, d); maxB = Math.max(maxB, d) }
    if (maxA < minB || maxB < minA) return false
  }
  return true
}

export function footprintDistance(site: Pick<Site, 'x' | 'z' | 'c' | 's' | 'fp'>, x: number, z: number, margin = 0) {
  const dx = x - site.x, dz = z - site.z
  const lx = site.c * dx - site.s * dz, lz = site.s * dx + site.c * dz
  const ex = Math.max(site.fp.minX - margin - lx, 0, lx - site.fp.maxX - margin)
  const ez = Math.max(site.fp.minZ - margin - lz, 0, lz - site.fp.maxZ - margin)
  return Math.hypot(ex, ez)
}

class Polyline {
  readonly lengths: Float64Array
  constructor(readonly road: Road) {
    const points = road.points
    this.lengths = new Float64Array(points.length)
    for (let i = 1; i < points.length; i++) this.lengths[i] = this.lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
  }
  get length() { return this.lengths[this.lengths.length - 1] }
  at(s: number): Frame {
    const L = this.lengths, points = this.road.points
    let lo = 0, hi = L.length - 1
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] <= s) lo = mid; else hi = mid }
    const a = points[lo], b = points[hi], span = L[hi] - L[lo] || 1, t = Math.max(0, Math.min(1, (s - L[lo]) / span))
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz) || 1
    return { x: a.x + dx * t, z: a.z + dz * t, y: a.y + (b.y - a.y) * t, tx: dx / length, tz: dz / length, bridge: this.road.bridge[lo] === 1 || this.road.bridge[hi] === 1 }
  }
}

export class SettlementPlanner {
  private plans = new LruCache<string, RegionPlan>(10)
  private lines = new WeakMap<Road, Polyline>()
  private lastKey = NaN
  private lastPlan: RegionPlan | null = null
  constructor(readonly terrain: Terrain, readonly network: RoadNetwork) {}

  private line(road: Road) {
    let line = this.lines.get(road)
    if (!line) { line = new Polyline(road); this.lines.set(road, line) }
    return line
  }

  plan(cx: number, cz: number): RegionPlan {
    const key = `${cx},${cz}`
    const cached = this.plans.get(key)
    if (cached) return cached
    const half = REGION_SIZE / 2 - 1
    this.network.prepare({ minX: cx * REGION_SIZE - half, minZ: cz * REGION_SIZE - half, maxX: cx * REGION_SIZE + half, maxZ: cz * REGION_SIZE + half })
    return this.plans.set(key, new RegionBuilder(this, cx, cz).build())
  }

  roadLine(road: Road) { return this.line(road) }

  private regionsAround(x: number, z: number, margin: number) {
    const keys: [number, number][] = []
    for (let cz = Math.floor((z - margin) / REGION_SIZE + 0.5); cz <= Math.floor((z + margin) / REGION_SIZE + 0.5); cz++) {
      for (let cx = Math.floor((x - margin) / REGION_SIZE + 0.5); cx <= Math.floor((x + margin) / REGION_SIZE + 0.5); cx++) keys.push([cx, cz])
    }
    return keys
  }

  sitesIn(bounds: Bounds): Site[] {
    const result: Site[] = []
    for (let cz = Math.floor(bounds.minZ / REGION_SIZE + 0.5); cz <= Math.floor(bounds.maxZ / REGION_SIZE + 0.5); cz++) {
      for (let cx = Math.floor(bounds.minX / REGION_SIZE + 0.5); cx <= Math.floor(bounds.maxX / REGION_SIZE + 0.5); cx++) {
        for (const site of this.plan(cx, cz).sites) if (site.x >= bounds.minX && site.x < bounds.maxX && site.z >= bounds.minZ && site.z < bounds.maxZ) result.push(site)
      }
    }
    return result
  }

  treesIn(bounds: Bounds): StreetTree[] {
    const result: StreetTree[] = []
    for (let cz = Math.floor(bounds.minZ / REGION_SIZE + 0.5); cz <= Math.floor(bounds.maxZ / REGION_SIZE + 0.5); cz++) {
      for (let cx = Math.floor(bounds.minX / REGION_SIZE + 0.5); cx <= Math.floor(bounds.maxX / REGION_SIZE + 0.5); cx++) {
        for (const tree of this.plan(cx, cz).trees) if (tree.x >= bounds.minX && tree.x < bounds.maxX && tree.z >= bounds.minZ && tree.z < bounds.maxZ) result.push(tree)
      }
    }
    return result
  }

  private planFast(cx: number, cz: number) {
    const key = cx * 65536 + cz
    if (key === this.lastKey && this.lastPlan) return this.lastPlan
    this.lastPlan = this.plan(cx, cz); this.lastKey = key
    return this.lastPlan
  }

  near(x: number, z: number): Site[] {
    const bucket = bucketKey(Math.floor(x / BUCKET), Math.floor(z / BUCKET))
    const cx = Math.floor(x / REGION_SIZE + 0.5), cz = Math.floor(z / REGION_SIZE + 0.5)
    const edge = REGION_SIZE / 2 - NEAR_BORDER
    if (Math.abs(x - cx * REGION_SIZE) < edge && Math.abs(z - cz * REGION_SIZE) < edge) return this.planFast(cx, cz).buckets.get(bucket) ?? EMPTY
    const result: Site[] = []
    for (const [rx, rz] of this.regionsAround(x, z, NEAR_BORDER)) for (const site of this.plan(rx, rz).buckets.get(bucket) ?? EMPTY) result.push(site)
    return result
  }

  townAt(x: number, z: number) {
    for (const area of this.planFast(Math.floor(x / REGION_SIZE + 0.5), Math.floor(z / REGION_SIZE + 0.5)).towns) {
      const r = townDistance(area, x, z)
      if (r < area.rule.ribbon) return { area, r }
    }
    return null
  }

  shape(x: number, z: number, height: number, core: number, coarse: number) {
    const sites = this.near(x, z)
    if (!sites.length) return height
    let best = 0, target = height, press = Infinity
    for (const site of sites) {
      if (x < site.minX - PAD_BLEND - PAD_MARGIN || x > site.maxX + PAD_BLEND + PAD_MARGIN || z < site.minZ - PAD_BLEND - PAD_MARGIN || z > site.maxZ + PAD_BLEND + PAD_MARGIN) continue
      const d = footprintDistance(site, x, z)
      const pad = site.y - 0.04
      const blend = Math.min(PAD_BLEND, Math.max(PAD_BLEND_MIN, Math.abs(pad - height) * PAD_RUN))
      const w = 1 - smoothstep(PAD_MARGIN, PAD_MARGIN + blend, d)
      if (w > best) { best = w; target = pad }
      if (coarse && d < coarseReach(coarse)) press = Math.min(press, pad - 0.45)
    }
    const w = best * (1 - core)
    const shaped = w > 0 ? height + (target - height) * w : height
    return core < 0.5 ? Math.min(shaped, press) : shaped
  }

  blocked(x: number, z: number, margin: number) {
    for (const site of this.near(x, z)) {
      if (x < site.minX - margin || x > site.maxX + margin || z < site.minZ - margin || z > site.maxZ + margin) continue
      if (footprintDistance(site, x, z, margin) === 0) return true
    }
    return false
  }

  vegetation(x: number, z: number) {
    if (this.blocked(x, z, 2.2)) return 0
    const town = this.townAt(x, z)
    if (!town) return 1
    const { area, r } = town
    const reclaim = area.profile.reclaim
    const inner = area.rule.backyard * (0.45 + reclaim * 0.9) * (area.profile.fate === 'burned' ? 0.6 : 1)
    return inner + (1 - inner) * smoothstep(area.rule.residential * 0.95, area.rule.ribbon, r)
  }
}

function townDistance(area: TownArea, x: number, z: number) {
  const dx = x - area.town.x, dz = z - area.town.z
  const u = (dx * area.cos + dz * area.sin) / area.ex, v = (-dx * area.sin + dz * area.cos) / area.ez
  return Math.pow(u ** 4 + v ** 4, 0.25)
}

type Placement = {
  blueprint: string; zone: Zone; setback: number; frame: Frame; side: 1 | -1; road: Road; anchor: number
  ground: 'road' | 'terrain'; condition: (site: Site) => Condition; maxDelta: number
}

class RegionBuilder {
  private readonly terrain: Terrain
  private readonly network: RoadNetwork
  private sites: Site[] = []
  private trees: StreetTree[] = []
  private towns: TownArea[] = []
  private buckets = new Map<number, Site[]>()
  private placedBuckets = new Map<number, Corners[]>()
  private counts = new Map<string, number>()
  private readonly cell: Bounds
  private readonly roads: Road[]
  private readonly seed: number

  constructor(private readonly planner: SettlementPlanner, private readonly cx: number, private readonly cz: number) {
    this.terrain = planner.terrain; this.network = planner.network
    this.seed = this.terrain.seed ^ hash2(cx, cz, 0x2bd1)
    const half = REGION_SIZE / 2 - 60
    this.cell = { minX: cx * REGION_SIZE - half, minZ: cz * REGION_SIZE - half, maxX: cx * REGION_SIZE + half, maxZ: cz * REGION_SIZE + half }

    const seen = new Set<string>()
    this.roads = []
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const road of this.network.regionRoads(cx + dx, cz + dz)) {
      if (seen.has(road.id)) continue
      seen.add(road.id)
      if (road.points.some((p) => p.x > this.cell.minX - 50 && p.x < this.cell.maxX + 50 && p.z > this.cell.minZ - 50 && p.z < this.cell.maxZ + 50)) this.roads.push(road)
    }
  }

  build(): RegionPlan {
    const town = this.terrain.town(this.cx, this.cz)
    if (!town.wet) this.planTown(town)
    this.planCountryside()
    return { sites: this.sites, buckets: this.buckets, trees: this.trees, towns: this.towns }
  }

  private count(blueprint: string) { return this.counts.get(blueprint) ?? 0 }

  private area(town: Town): TownArea {
    const layout = this.network.layout(town)
    const cos = Math.cos(town.angle), sin = Math.sin(town.angle)
    let ex = 0, ez = 0
    for (const node of layout.nodes.values()) {
      const dx = node.x - town.x, dz = node.z - town.z
      ex = Math.max(ex, Math.abs(dx * cos + dz * sin)); ez = Math.max(ez, Math.abs(-dx * sin + dz * cos))
    }
    return { town, profile: settlementProfile(this.terrain, town), rule: KIND[town.kind], cos, sin, ex: ex + 38, ez: ez + 38 }
  }

  private roadsClear(corners: Corners, ownRoad: Road | null) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const [x, z] of corners) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z) }
    const segments = this.network.segmentsIn({ minX: minX - 24, maxX: maxX + 24, minZ: minZ - 24, maxZ: maxZ + 24 })
    if (!segments.length) return true
    const samples: [number, number][] = []
    for (let i = 0; i < 4; i++) {
      const p = corners[i], q = corners[(i + 1) % 4], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 3.5))
      for (let k = 0; k < n; k++) samples.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n])
    }
    samples.push([(corners[0][0] + corners[2][0]) / 2, (corners[0][1] + corners[2][1]) / 2])
    for (const s of segments) {
      const need = s.kind === 'street' ? SIDEWALK + 0.35 : s.kind === 'track' ? 2.2 : ROAD_SPEC[s.kind].verge + 2.5 + (s.road === ownRoad ? 0 : 1.5)
      for (const [x, z] of samples) if (distanceToSegment(x, z, s as RoadSegment).distance - s.half < need) return false
    }

    for (const s of segments) for (let i = 0; i < 4; i++) {
      const p = corners[i], q = corners[(i + 1) % 4]
      if (crosses(p[0], p[1], q[0], q[1], s.a.x, s.a.z, s.b.x, s.b.z)) return false
    }
    return true
  }

  private free(corners: Corners) {
    const keys = bucketKeys(corners)
    for (const key of keys) for (const other of this.placedBuckets.get(key) ?? []) if (overlaps(corners, other)) return false
    return true
  }

  private groundFor(corners: Corners, pad: number | null, maxDelta: number) {
    const heights: number[] = []
    const cx = (corners[0][0] + corners[2][0]) / 2, cz = (corners[0][1] + corners[2][1]) / 2
    for (const [x, z] of [...corners, [cx, cz] as [number, number]]) {
      const s = this.terrain.surface(x, z)
      if ((s.waterLevel > WATER_NONE && s.height < s.waterLevel + 0.9) || s.height < SEA_LEVEL + 1.6) return null
      heights.push(this.network.influence(x, z, s).height)
    }
    const y = pad ?? [...heights].sort((a, b) => a - b)[2]
    if (heights.some((h) => Math.abs(h - y) > maxDelta)) return null
    return y
  }

  private commit(site: Site, corners: Corners) {
    this.sites.push(site)
    this.counts.set(site.blueprint, this.count(site.blueprint) + 1)
    for (const key of bucketKeys(corners)) {
      const list = this.placedBuckets.get(key)
      if (list) list.push(corners); else this.placedBuckets.set(key, [corners])
    }
    for (let bz = Math.floor((site.minZ - PAD_BLEND - PAD_MARGIN) / BUCKET); bz <= Math.floor((site.maxZ + PAD_BLEND + PAD_MARGIN) / BUCKET); bz++) {
      for (let bx = Math.floor((site.minX - PAD_BLEND - PAD_MARGIN) / BUCKET); bx <= Math.floor((site.maxX + PAD_BLEND + PAD_MARGIN) / BUCKET); bx++) {
        const key = bucketKey(bx, bz)
        const list = this.buckets.get(key)
        if (list) list.push(site); else this.buckets.set(key, [site])
      }
    }
  }

  private tryPlace(p: Placement, gap: number) {
    const roadHalf = p.road.width / 2 + (p.road.kind === 'street' ? SIDEWALK : ROAD_SPEC[p.road.kind].verge)
    const nx = -p.frame.tz * p.side, nz = p.frame.tx * p.side
    const seed = hash2(Math.round(p.frame.x * 8), Math.round(p.frame.z * 8), this.seed ^ hashString(p.blueprint)) & 0xffffff
    const fp = footprintOf(p.blueprint, seed)
    const yaw = Math.atan2(-nx, -nz), c = Math.cos(yaw), s = Math.sin(yaw)

    const xx = c, xz = -s, mid = (fp.minX + fp.maxX) / 2
    const offset = roadHalf + p.setback + fp.maxZ
    const x = p.frame.x + nx * offset - xx * mid, z = p.frame.z + nz * offset - xz * mid
    if (x < this.cell.minX || x > this.cell.maxX || z < this.cell.minZ || z > this.cell.maxZ) return 0
    const probe = { x, z, c, s, fp }
    const corners = cornersOf(probe, 0)
    const spaced = cornersOf(probe, gap / 2)
    if (!this.free(spaced) || !this.roadsClear(corners, p.road)) return 0
    const y = this.groundFor(corners, p.ground === 'road' ? p.frame.y + 0.12 : null, p.maxDelta)
    if (y === null) return -1
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const [cx, cz] of corners) { minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minZ = Math.min(minZ, cz); maxZ = Math.max(maxZ, cz) }
    const site: Site = { id: seed, blueprint: p.blueprint, index: BLUEPRINT_INDEX.get(p.blueprint)!, condition: 'weathered', zone: p.zone, x, y, z, yaw, c, s, fp, minX, maxX, minZ, maxZ }
    site.condition = p.condition(site)
    this.commit(site, spaced)
    return fp.maxX - fp.minX
  }

  private placeAt(blueprint: string, x: number, z: number, yaw: number, zone: Zone, condition: (site: Site) => Condition, gap: number, maxDelta: number) {
    const seed = hash2(Math.round(x * 8), Math.round(z * 8), this.seed ^ hashString(blueprint)) & 0xffffff
    const fp = footprintOf(blueprint, seed), c = Math.cos(yaw), s = Math.sin(yaw)
    if (x < this.cell.minX || x > this.cell.maxX || z < this.cell.minZ || z > this.cell.maxZ) return null
    const probe = { x, z, c, s, fp }
    const corners = cornersOf(probe, 0), spaced = cornersOf(probe, gap / 2)
    if (!this.free(spaced) || !this.roadsClear(corners, null)) return null
    const y = this.groundFor(corners, null, maxDelta)
    if (y === null) return null
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const [cx, cz] of corners) { minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minZ = Math.min(minZ, cz); maxZ = Math.max(maxZ, cz) }
    const site: Site = { id: seed, blueprint, index: BLUEPRINT_INDEX.get(blueprint)!, condition: 'weathered', zone, x, y, z, yaw, c, s, fp, minX, maxX, minZ, maxZ }
    site.condition = condition(site)
    this.commit(site, spaced)
    return site
  }

  private conditionIn(area: TownArea) {
    const { profile } = area
    return (site: Site): Condition => {
      const roll = randomSource(site.id ^ 0x51a7)()
      let weights: number[]
      switch (profile.fate) {
        case 'abandoned': weights = [0.56, 0.34, 0.03, 0.06, 0.01]; break
        case 'overgrown': weights = [0.42, 0.38, 0.02, 0.15, 0.03]; break
        case 'looted': weights = [0.24, 0.5, 0.15, 0.1, 0.01]; break
        case 'burned': {
          const fire = this.terrain.climate.at(site.x / 170 + profile.fireSeed * 1e-3, site.z / 170 - 41)
          weights = fire > 0.1 ? [0.03, 0.12, 0.62, 0.2, 0.03] : fire > -0.25 ? [0.15, 0.4, 0.3, 0.13, 0.02] : [0.4, 0.42, 0.08, 0.09, 0.01]
          break
        }
        case 'bombed': {
          let blast = 0
          for (const impact of profile.impacts) blast = Math.max(blast, 1 - Math.hypot(site.x - impact.x, site.z - impact.z) / impact.r)
          weights = blast > 0.55 ? [0, 0.02, 0.08, 0.35, 0.55] : blast > 0.2 ? [0.02, 0.18, 0.2, 0.45, 0.15] : blast > 0 ? [0.1, 0.4, 0.18, 0.27, 0.05] : [0.2, 0.48, 0.12, 0.17, 0.03]
          break
        }
      }
      let value = roll
      for (let i = 0; i < 5; i++) if ((value -= weights[i]) <= 0) return STRUCTURE_CONDITIONS[i]
      return 'damaged'
    }
  }

  private planTown(town: Town) {
    const area = this.area(town)
    this.towns.push(area)
    const { rule } = area
    const rng = randomSource(hash2(town.cx, town.cz, this.terrain.seed ^ 0x7a11))
    const condition = this.conditionIn(area)
    const streets = this.roads.filter((road) => road.id.startsWith(`${town.id}/street/`))
    const layout = this.network.layout(town)
    const nodes = [...layout.nodes.values()]
    const nearNode = (x: number, z: number) => nodes.reduce((best, node) => Math.min(best, Math.hypot(node.x - x, node.z - z)), Infinity)
    const isMain = (road: Road) => road.id.endsWith('/street/rua-0') || road.id.endsWith('/street/travessa-0')
    const zoneNoise = (x: number, z: number) => 1 + 0.12 * this.terrain.detail.at(x / 130 + 3.3, z / 130 - 7.7)

    const civic = CIVIC[town.kind].filter(([, chance]) => rng() < chance).map(([blueprint]) => blueprint)
    const slots: { road: Road; side: 1 | -1; s: number; r: number; main: boolean }[] = []
    for (const road of streets) {
      const line = this.planner.roadLine(road)
      for (let s = 10; s < line.length - 10; s += 7) {
        const f = line.at(s)
        for (const side of [-1, 1] as const) slots.push({ road, side, s, r: townDistance(area, f.x, f.z), main: isMain(road) })
      }
    }
    for (const blueprint of civic) {
      const [lo, hi] = CIVIC_BAND[blueprint] ?? [0, 0.8]
      const large = TABLE[blueprint] && (TABLE[blueprint].nx * TABLE[blueprint].bay[0] > 18 || blueprint === 'hospital-building')
      const ordered = slots
        .filter((slot) => slot.r >= lo * rule.residential && slot.r <= hi * rule.residential)
        .map((slot) => ({ slot, score: Math.abs(slot.r - (lo + hi) / 2 * rule.residential) + rng() * 0.25 - (slot.main && large ? 0.15 : 0) }))
        .sort((a, b) => a.score - b.score)
      for (const { slot } of ordered.slice(0, 160)) {
        const frame = this.planner.roadLine(slot.road).at(slot.s)
        const placed = this.tryPlace({ blueprint, zone: 'civic', setback: 1.5 + rng() * 3, frame, side: slot.side, road: slot.road, anchor: slot.s, ground: 'road', condition, maxDelta: 4.5 }, 2.5)
        if (placed > 0) break
      }
    }

    for (const road of streets) {
      const line = this.planner.roadLine(road), main = isMain(road)
      for (const side of [-1, 1] as const) {
        const walk = randomSource(hashString(road.id) ^ (side > 0 ? 0x1f : 0x2e) ^ this.seed)
        let s = 4

        let pending: { blueprint: string; zone: Zone; setback: number; gap: number; misses: number } | null = null
        while (s < line.length - 4) {
          const frame = line.at(s)
          if (frame.bridge) { s += 6; pending = null; continue }
          const r = townDistance(area, frame.x, frame.z) * zoneNoise(frame.x, frame.z)
          if (r > rule.residential * 1.04) { s += 6; pending = null; continue }
          if (!pending) {
            const corner = nearNode(frame.x, frame.z) < 30
            let zone: Zone, pool: Pool, setback: [number, number], gap: [number, number], vacancy: number
            if (r < rule.core) {
              zone = 'core'; pool = SHOPS[town.kind]; setback = [0.5, 1.2]; gap = [0.3, 0.9]; vacancy = 0.03
            } else if (main && r < rule.main) {
              zone = 'main'; pool = walk() < 0.62 ? SHOPS[town.kind] : HOMES[town.kind]; setback = [0.6, 2.2]; gap = [0.4, 1.6]; vacancy = 0.06
            } else if (r < rule.residential * 0.84) {
              zone = 'residential'
              pool = corner && walk() < 0.32 ? (walk() < 0.55 ? CORNER_SHOPS : CORNER_HOMES) : HOMES[town.kind]
              setback = rule.setback; gap = rule.gap; vacancy = rule.vacancy
            } else {
              zone = 'edge'; pool = walk() < 0.55 ? HOMES[town.kind] : EDGE; setback = [3, 9]; gap = [3, 12]; vacancy = Math.min(0.6, rule.vacancy + 0.25)
            }
            if (walk() < vacancy) { s += 8 + walk() * 14; continue }
            const choice = pick(pool, walk(), (id) => this.count(id) >= limitOf(id, town.kind) || !TABLE[id])
            if (!choice) { s += 6; continue }
            pending = { blueprint: choice, zone, setback: setback[0] + walk() * (setback[1] - setback[0]), gap: gap[0] + walk() * (gap[1] - gap[0]), misses: 0 }
          }
          const fp = footprintOf(pending.blueprint, 1)
          const used = this.tryPlace({
            blueprint: pending.blueprint, zone: pending.zone, setback: pending.setback, frame: line.at(s + (fp.maxX - fp.minX) / 2), side, road, anchor: s,
            ground: 'road', condition, maxDelta: pending.zone === 'core' ? 4 : 5.5,
          }, pending.gap)
          if (used > 0) { s += used + pending.gap; pending = null; continue }
          s += used < 0 ? 6 : 2.5
          if (++pending.misses >= 5) pending = null
        }
      }
    }

    const exits = this.roads.filter((road) => road.kind !== 'street' && road.kind !== 'track' && (road.from === town.id || road.to === town.id))
    for (const road of exits) {
      const line = this.planner.roadLine(road)
      for (const side of [-1, 1] as const) {
        const walk = randomSource(hashString(road.id) ^ (side > 0 ? 0x3c : 0x4d) ^ this.seed)
        let s = 0
        while (s < line.length) {
          const frame = line.at(s)
          const r = townDistance(area, frame.x, frame.z)
          if (r > rule.ribbon) { if (s > line.length / 2) break; s += 25; continue }
          if (r < rule.residential * 0.8 || frame.bridge) { s += 10; continue }
          const density = 1 - smoothstep(rule.residential * 0.9, rule.ribbon, r)
          if (walk() > 0.22 + density * 0.55) { s += 14 + walk() * 30; continue }
          const choice = pick(RIBBON, walk(), (id) => this.count(id) >= limitOf(id, town.kind) || (town.kind === 'hamlet' && (id === 'motel' || id === 'warehouse')))
          if (!choice) { s += 20; continue }
          const fp = footprintOf(choice, 1)
          const used = this.tryPlace({ blueprint: choice, zone: 'ribbon', setback: 5 + walk() * 12, frame: line.at(s + (fp.maxX - fp.minX) / 2), side, road, anchor: s, ground: 'terrain', condition, maxDelta: 3.5 }, 6)
          s += used > 0 ? used + 8 + walk() * 28 : 6
        }
      }
    }

    if (town.kind !== 'hamlet') for (const road of streets) {
      const line = this.planner.roadLine(road)
      for (const side of [-1, 1] as const) {
        const walk = randomSource(hashString(road.id) ^ (side > 0 ? 0x5b : 0x6a) ^ this.seed ^ 0x77)
        for (let s = 6 + walk() * 6; s < line.length - 6; s += 9 + walk() * 7) {
          const f = line.at(s)
          const r = townDistance(area, f.x, f.z)
          if (r > rule.residential || f.bridge) continue
          const fate = area.profile.fate
          const chance = rule.streetTrees * (r < rule.core ? 0.55 : 1) + (fate === 'overgrown' ? 0.25 : 0) - (fate === 'bombed' ? 0.2 : 0)
          if (walk() > chance) continue
          const offset = road.width / 2 + SIDEWALK + 1.1
          const x = f.x - f.tz * side * offset, z = f.z + f.tx * side * offset
          if (this.sites.some((site) => x > site.minX - 3 && x < site.maxX + 3 && z > site.minZ - 3 && z < site.maxZ + 3 && footprintDistance(site, x, z) < 2.6)) continue
          const burned = fate === 'burned' && walk() < 0.55
          const species = burned ? SNAG : [OAK, MAPLE, MAPLE, BIRCH, OAK][Math.floor(walk() * 5)]
          this.trees.push({ x, z, height: 6.5 + walk() * 7 + area.profile.reclaim * 3, species, dead: burned })
        }
      }
    }
  }

  private nearestTownDistance(x: number, z: number) {
    let best = Infinity
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const town = this.terrain.town(this.cx + dx, this.cz + dz)
      if (town.wet) continue
      best = Math.min(best, Math.hypot(x - town.x, z - town.z) / (town.radius * 1.5 + 80))
    }
    return best
  }

  private planCountryside() {
    const rng = randomSource(this.seed ^ 0x3d55)
    const ruralCondition = (site: Site): Condition => {
      const roll = randomSource(site.id ^ 0x2c9)()
      return roll < 0.44 ? 'weathered' : roll < 0.78 ? 'damaged' : roll < 0.86 ? 'burned' : roll < 0.97 ? 'ruined' : 'leveled'
    }
    const harshCondition = (site: Site): Condition => {
      const roll = randomSource(site.id ^ 0x8e3)()
      return roll < 0.2 ? 'weathered' : roll < 0.62 ? 'damaged' : roll < 0.74 ? 'burned' : roll < 0.95 ? 'ruined' : 'leveled'
    }
    const town = this.terrain.town(this.cx, this.cz)
    const lastFarm: [number, number][] = [], lastFuel: [number, number][] = []
    const farFrom = (list: [number, number][], x: number, z: number, d: number) => list.every(([px, pz]) => Math.hypot(px - x, pz - z) > d)

    if (!town.wet && town.kind !== 'hamlet') {
      const exits = this.roads.filter((road) => road.kind !== 'street' && road.kind !== 'track' && (road.from === town.id || road.to === town.id))
      const wanted: [string, number][] = [['power-substation', town.kind === 'village' ? 0.55 : 1], ['water-works', town.kind === 'village' ? 0.3 : town.kind === 'town' ? 0.7 : 1]]
      if (town.kind === 'city') wanted.push(['power-substation', 0.6], ['shelter', 0.35])
      for (const [blueprint, chance] of wanted) {
        if (rng() > chance || !exits.length) continue
        const road = exits[Math.floor(rng() * exits.length)], line = this.planner.roadLine(road)
        const target = town.radius * (1.6 + rng() * 1.3)
        const fromStart = road.from === town.id
        for (let attempt = 0; attempt < 30; attempt++) {
          const along = fromStart ? target + attempt * 23 : line.length - target - attempt * 23
          if (along < 30 || along > line.length - 30) break
          const frame = line.at(along)
          const water = blueprint === 'water-works' ? this.waterNear(frame.x, frame.z, 260) : true
          if (!water && attempt < 20) continue
          if (this.tryPlace({ blueprint, zone: 'utility', setback: 14 + rng() * 20, frame, side: rng() < 0.5 ? 1 : -1, road, anchor: along, ground: 'terrain', condition: harshCondition, maxDelta: 2.8 }, 10) > 0) break
        }
      }
    }

    for (const road of this.roads) {
      if (road.kind === 'street') continue
      const line = this.planner.roadLine(road)
      const walk = randomSource(hashString(road.id) ^ this.seed ^ 0x9a1)
      const step = 45
      for (let s = 30 + walk() * step; s < line.length - 30; s += step) {
        const frame = line.at(s)
        if (frame.bridge || frame.x < this.cell.minX || frame.x > this.cell.maxX || frame.z < this.cell.minZ || frame.z > this.cell.maxZ) continue
        const townR = this.nearestTownDistance(frame.x, frame.z)
        if (townR < 1) continue
        const side: 1 | -1 = walk() < 0.5 ? 1 : -1
        const probeX = frame.x - frame.tz * side * 40, probeZ = frame.z + frame.tx * side * 40
        const sample = this.terrain.sample(probeX, probeZ)
        const biome: Biome = sample.biome
        if (biome === 'ocean' || biome === 'lake' || biome === 'river' || biome === 'beach' || biome === 'waterfall') continue
        const nearTown = smoothstep(4.5, 1, townR)
        const roll = walk()
        const perStep = step / 1000
        const track = road.kind === 'track', highway = road.kind === 'highway'
        const openLand = biome === 'meadow' || biome === 'scrub' || (biome === 'forest' && sample.forest < 0.5) || biome === 'shore'
        const woods = biome === 'forest' || biome === 'denseForest' || biome === 'pine'

        const farmRate = (track ? 1.1 : highway ? 0.25 : 0.55) * (openLand ? 1 : biome === 'pine' ? 0.15 : 0.05) * (0.5 + nearTown)
        if (roll < farmRate * perStep && farFrom(lastFarm, frame.x, frame.z, 650)) {
          if (this.planFarm(road, s, side, ruralCondition, walk)) lastFarm.push([frame.x, frame.z])
          continue
        }

        const fuelRate = (highway ? 0.32 : road.kind === 'country' ? 0.14 : 0) * (0.4 + nearTown)
        if (roll < (farmRate + fuelRate) * perStep && farFrom(lastFuel, frame.x, frame.z, 4500)) {
          const placed = this.tryPlace({ blueprint: 'fuel-station', zone: 'roadside', setback: 4 + walk() * 6, frame, side, road, anchor: s, ground: 'terrain', condition: harshCondition, maxDelta: 2 }, 6)
          if (placed > 0) {
            lastFuel.push([frame.x, frame.z])
            const extra = walk() < 0.5 ? 'diner' : walk() < 0.5 ? 'motel' : 'tire-shop'
            const ahead = this.planner.roadLine(road).at(s + placed / 2 + 22)
            this.tryPlace({ blueprint: extra, zone: 'roadside', setback: 5 + walk() * 6, frame: ahead, side, road, anchor: s + 22, ground: 'terrain', condition: harshCondition, maxDelta: 2.2 }, 6)
          }
          continue
        }

        const cabinRate = woods ? (track ? 0.5 : 0.14) : biome === 'highlands' ? 0.12 : 0
        const homeRate = (openLand || woods ? 0.5 : 0.15) * nearTown * (track ? 0.6 : 1)
        const total = farmRate + fuelRate
        if (roll < (total + cabinRate) * perStep) {
          const water = this.waterNear(probeX, probeZ, 120)
          const blueprint = water && walk() < 0.7 ? 'fishing-cabin' : biome === 'pine' && track && walk() < 0.18 ? 'sawmill' : walk() < 0.55 ? 'hunting-cabin' : 'ranger-cabin'
          this.tryPlace({ blueprint, zone: 'wild', setback: 6 + walk() * 18, frame, side, road, anchor: s, ground: 'terrain', condition: ruralCondition, maxDelta: 2.4 }, 12)
          continue
        }
        if (roll < (total + cabinRate + homeRate) * perStep) {
          const blueprint = pick([['cottage', 2], ['wood-house', 2], ['bungalow', 1], ['farmhouse', 0.6], ['unfinished-house', 0.8], ['caretaker-house', 0.4]], walk())!
          this.tryPlace({ blueprint, zone: 'farm', setback: 8 + walk() * 20, frame, side, road, anchor: s, ground: 'terrain', condition: ruralCondition, maxDelta: 2.4 }, 14)
        }
      }
    }

    const rare: [string, number][] = [['abandoned-base', 0.12], ['research-outpost', 0.07], ['survivor-camp', 0.1]]
    for (const [blueprint, chance] of rare) {
      if (rng() > chance) continue
      const candidates = this.roads.filter((road) => road.kind === 'track' || road.kind === 'country')
      if (!candidates.length) continue
      const road = candidates[Math.floor(rng() * candidates.length)], line = this.planner.roadLine(road)
      for (let attempt = 0; attempt < 24; attempt++) {
        const along = 40 + rng() * Math.max(1, line.length - 80)
        const frame = line.at(along)
        if (this.nearestTownDistance(frame.x, frame.z) < 3.2) continue
        const biome = this.terrain.sample(frame.x, frame.z).biome
        if (blueprint === 'research-outpost' && biome !== 'highlands' && biome !== 'pine' && biome !== 'denseForest' && attempt < 16) continue
        if (blueprint === 'survivor-camp' && !this.waterNear(frame.x, frame.z, 400) && attempt < 16) continue
        if (this.tryPlace({ blueprint, zone: 'rare', setback: 10 + rng() * 15, frame, side: rng() < 0.5 ? 1 : -1, road, anchor: along, ground: 'terrain', condition: harshCondition, maxDelta: 2.2 }, 20) > 0) break
      }
    }
  }

  private planFarm(road: Road, s: number, side: 1 | -1, condition: (site: Site) => Condition, walk: () => number) {
    const line = this.planner.roadLine(road)
    const fp = footprintOf('farmhouse', 1)
    const frame = line.at(s + (fp.maxX - fp.minX) / 2)
    const before = this.sites.length
    const used = this.tryPlace({ blueprint: 'farmhouse', zone: 'farm', setback: 12 + walk() * 22, frame, side, road, anchor: s, ground: 'terrain', condition, maxDelta: 2.6 }, 12)
    if (used <= 0) return false
    const house = this.sites[before]
    const back = (lz: number, lx: number) => [house.x + house.c * lx + house.s * lz, house.z - house.s * lx + house.c * lz] as const
    const outbuildings: string[] = ['barn', ...(walk() < 0.55 ? ['stable'] : []), ...(walk() < 0.4 ? ['grain-store'] : []), ...(walk() < 0.25 ? ['greenhouse'] : [])]
    const slots: [number, number, number][] = [[-38, 6, 0], [-30, 30, Math.PI / 2], [-30, -30, -Math.PI / 2], [-62, -4, 0], [4, 36, Math.PI / 2], [4, -36, -Math.PI / 2]]
    let k = 0
    for (const blueprint of outbuildings) {
      while (k < slots.length) {
        const [lz, lx, turn] = slots[k++]
        const [x, z] = back(lz, lx)
        if (this.placeAt(blueprint, x, z, house.yaw + turn + (walk() - 0.5) * 0.08, 'farm', condition, 6, 2.4)) break
      }
    }
    return true
  }

  private waterNear(x: number, z: number, radius: number) {
    for (let k = 0; k < 10; k++) {
      const angle = k * 2.399963, d = radius * Math.sqrt((k + 0.5) / 10)
      const s = this.terrain.surface(x + Math.cos(angle) * d, z + Math.sin(angle) * d)
      if (s.waterLevel > WATER_NONE && s.water !== 'ocean' && s.height < s.waterLevel) return true
    }
    return false
  }
}

function bucketKeys(corners: Corners) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of corners) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z) }
  const keys: number[] = []
  for (let bz = Math.floor(minZ / BUCKET); bz <= Math.floor(maxZ / BUCKET); bz++) for (let bx = Math.floor(minX / BUCKET); bx <= Math.floor(maxX / BUCKET); bx++) keys.push(bucketKey(bx, bz))
  return keys
}

function crosses(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number) {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx), d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx)
  const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax)
  return d1 * d2 < 0 && d3 * d4 < 0
}
