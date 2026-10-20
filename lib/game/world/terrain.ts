import { hashString, hash2, randomAt, NoiseField, LruCache, lerp, smoothstep, clamp01 } from './noise'
import { REGION_SIZE, SEA_LEVEL, WORLD_HALF, WATER_NONE } from './settings'
import type { Biome, TerrainPoint, Town, WaterKind } from './types'

type Basin = { x: number; z: number; rx: number; rz: number; cos: number; sin: number; level: number; depth: number }
type Shape = {
  height: number; riverBase: number; ranges: number; ocean: number; coast: number; fall: number; wx: number; wz: number; continental: number

  shore: number

  beach: number

  fallX: number; fallZ: number

  fallReach: number

  lip: number; foot: number
}
export type Surface = {
  height: number; waterLevel: number; water: WaterKind; fall: number; coast: number; shore: number

  sand: number

  flowX: number; flowZ: number
  downstream: number

  fallX: number; fallZ: number; lip: number; foot: number
}

const FAULT_PROBE = 6

const NAME_START = ['Vale', 'Santa', 'Morro', 'Ponte', 'Vila', 'Lago', 'Serra', 'Campo', 'Porto', 'Colina', 'Pedra', 'Bosque']
const NAME_END = ['das Cinzas', 'Esperança', 'do Cedro', 'do Norte', 'dos Pinheiros', 'do Silêncio', 'Verde', 'da Névoa', 'das Águas', 'do Carvalho', 'do Oeste', 'da Estação']
const POND_CELL = 1_600
const RIVER_SCALE = 6_800

const SHORELINE = -0.23
const COAST_SEA = -0.42
const COAST_INLAND = -0.07

const SEA_REACH = 150

function smoothMax(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.max(a, b) + h * h * k * 0.25
}

export class Terrain {
  readonly seed: number
  readonly noise: NoiseField
  readonly detail: NoiseField
  readonly climate: NoiseField
  private lakes = new LruCache<string, Basin | null>(128)
  private ponds = new LruCache<string, Basin | null>(1_024)
  private towns = new LruCache<string, Town>(256)

  constructor(readonly seedText: string) {
    this.seed = hashString(seedText)
    this.noise = new NoiseField(this.seed)
    this.detail = new NoiseField(this.seed ^ 0x93a82d1f)
    this.climate = new NoiseField(this.seed ^ 0x17e3b169)
  }

  private continentalAt(x: number, z: number) {
    const wx = x + this.noise.at(x / 17_000, z / 17_000) * 3_100
    const wz = z + this.noise.at(x / 19_000 + 71, z / 19_000 - 53) * 3_100
    const raw = this.noise.fbm(wx / 24_000, wz / 24_000, 3) + this.detail.at(x / 2_600, z / 2_600) * 0.022

    let continental = lerp(Math.max(raw, 0.1), raw, smoothstep(5_000, 15_000, Math.hypot(x, z)))

    const edge = WORLD_HALF - Math.max(Math.abs(x), Math.abs(z))
    if (edge < 20_000) {
      const shore = edge - 2_500 + this.noise.at(x / 2_700, z / 2_700) * 1_300 + this.detail.at(x / 370, z / 370) * 110
      continental = Math.min(continental, COAST_SEA + shore / 9_000)
    }
    return { wx, wz, continental }
  }

  private faultField(wx: number, wz: number) {
    return this.climate.at(wx / 14_000 - 61, wz / 14_000 + 44)
  }

  private faultAt(x: number, z: number) {
    const { wx, wz } = this.continentalAt(x, z)
    return this.faultField(wx, wz)
  }

  private dunes(x: number, z: number, back: number) {
    const ramp = smoothstep(0, 24, back) * (1 - smoothstep(110, 190, back))
    if (ramp <= 0) return 0
    const presence = smoothstep(-0.3, 0.3, this.climate.at(x / 1_800 + 41, z / 1_800 - 13))
    if (presence <= 0) return 0
    const ridges = 0.55 + 0.45 * Math.sin(back * 0.24 + this.detail.at(x / 70, z / 70) * 2.6)
    const hummocks = 0.65 + 0.35 * this.detail.at(x / 26 + 9, z / 26 - 4)
    return presence * ramp * ridges * hummocks * 3.4
  }

  private coastHeight(x: number, z: number, continental: number, shore: number, beach: number, land: number, seabed: number) {
    if (shore < 0) return lerp(Math.max(seabed, 0.12 + shore * 0.045), seabed, smoothstep(-0.34, -0.4, continental))
    const berm = 2.1 + this.detail.at(x / 520 + 3, z / 520) * 0.4
    const swell = this.detail.at(x / 45, z / 45) * 0.15
    if (shore <= beach) {
      const t = shore / beach
      return 0.12 + (berm - 0.12) * (1 - (1 - t) * (1 - t)) + swell * t
    }
    const back = shore - beach

    const floor = berm + Math.min(5, back * 0.012) + this.dunes(x, z, back) + swell
    const coastal = lerp(floor, smoothMax(land, floor, 3), smoothstep(20, 420, back))
    return lerp(land, coastal, 1 - smoothstep(-0.12, -0.075, continental))
  }

  private shape(x: number, z: number): Shape {
    const { wx, wz, continental } = this.continentalAt(x, z)
    const ocean = smoothstep(-0.2, -0.32, continental)
    const coast = smoothstep(-0.1, -0.2, continental)
    const inland = smoothstep(-0.24, 0.04, continental)
    const ranges = smoothstep(-0.08, 0.62, this.noise.at(wx / 9_500 + 130, wz / 9_500)) * inland
    const ridge = Math.pow(1 - Math.abs(this.detail.fbm(wx / 2_900, wz / 2_900, 3)), 2.8)
    const rollingLow = this.detail.at(wx / 930, wz / 930)
    const rolling = this.detail.fbm(wx / 930, wz / 930, 3)
    const lowland = 2 + smoothstep(-0.24, 0.5, continental) * 215
    const hillAmp = (24 + ranges * 75) * (0.3 + inland * 0.7)
    const mountains = ranges * (130 + ridge * 850)
    const micro = this.detail.fbm(x / 110, z / 110, 3) * (1.5 + ranges * 7)
    const outcrops = this.noise.at(x / 32, z / 32) * 0.3

    const hummocks = this.detail.fbm(x / 27 + 3.7, z / 27 - 1.9, 2) * (0.55 + ranges * 1.6) + this.noise.at(x / 8.5 - 5.3, z / 8.5 + 2.1) * 0.13

    let crags = 0
    if (ranges > 0.015) {
      const r1 = 1 - Math.abs(this.detail.at(wx / 760 + 41, wz / 760 - 17))
      const r2 = 1 - Math.abs(this.noise.at(x / 280 - 9, z / 280 + 23))
      const r3 = 1 - Math.abs(this.detail.at(x / 105 + 77, z / 105 + 5))
      const r4 = 1 - Math.abs(this.noise.at(x / 38 + 13, z / 38 - 31))
      const rugged = ranges * (0.35 + 0.65 * smoothstep(0.05, 0.55, ridge))
      crags = rugged * (r1 * r1 * 95 + r2 * r2 * 34 * (0.5 + r1 * 0.5) + r3 * r3 * 11 * (0.4 + r2 * 0.6) + r4 * r4 * 3.2 * (0.3 + r3 * 0.7) - 62)
    }

    const faultMask = smoothstep(0.38, 0.6, this.climate.at(x / 46_000 + 17, z / 46_000 - 29)) * inland * (1 - ranges * 0.6)
    let fault = 0, fall = 0, fallX = 0, fallZ = 0, fallReach = 0, lip = 0, foot = 0
    if (faultMask > 0) {
      const f = this.faultField(wx, wz)
      const rise = faultMask * (15 + 13 * (this.detail.at(x / 9_000, z / 9_000) * 0.5 + 0.5))
      fault = rise * smoothstep(-0.0012, 0.0012, f)
      fall = faultMask * (1 - smoothstep(0.0008, 0.005, Math.abs(f)))
      lip = rise - fault
      foot = fault

      fallReach = smoothstep(1.5, 5, rise) * (1 - smoothstep(0.005, 0.013, Math.abs(f)))
      if (fallReach > 0) {
        const gx = this.faultAt(x + FAULT_PROBE, z) - f, gz = this.faultAt(x, z + FAULT_PROBE) - f
        const length = Math.hypot(gx, gz)
        if (length > 0) { fallX = -gx / length; fallZ = -gz / length } else fallReach = 0
      }
    }
    const land = lowland + rolling * hillAmp + mountains + micro + outcrops + fault + hummocks + crags
    const seabed = -6 - 55 * smoothstep(-0.2, -0.45, continental) + rolling * 5
    let height = land, shore = Infinity, beach = 0
    if (continental < COAST_SEA) {
      height = seabed; shore = -Infinity
    } else if (continental < COAST_INLAND) {

      const step = 30
      const gx = (this.continentalAt(x + step, z).continental - continental) / step
      const gz = (this.continentalAt(x, z + step).continental - continental) / step
      const gradient = Math.min(3e-4, Math.max(1.5e-5, Math.hypot(gx, gz)))

      shore = (continental - SHORELINE) / gradient + this.detail.at(x / 85, z / 85) * 5 + this.noise.at(x / 23, z / 23) * 1.6
      beach = 40 + 48 * smoothstep(-0.45, 0.55, this.climate.at(x / 900 - 7, z / 900 + 3)) + this.detail.at(x / 140, z / 140) * 7
      height = this.coastHeight(x, z, continental, shore, beach, land, seabed)
    }
    const riverBase = lowland + ranges * 130 + fault + rollingLow * 0.42 * hillAmp
    return { height, riverBase, ranges, ocean, coast, fall, wx, wz, continental, shore, beach, fallX, fallZ, fallReach, lip, foot }
  }

  foundation(x: number, z: number) { return this.shape(x, z).height }

  private rimLevel(b: Omit<Basin, 'level' | 'depth'>, samples: number) {
    let lowest = Infinity
    for (let k = 0; k < samples; k++) {
      const angle = (k / samples) * Math.PI * 2
      const u = Math.cos(angle) * b.rx * 1.45, v = Math.sin(angle) * b.rz * 1.45
      lowest = Math.min(lowest, this.shape(b.x + u * b.cos - v * b.sin, b.z + u * b.sin + v * b.cos).height)
    }
    return lowest
  }

  private lakeFor(cx: number, cz: number): Basin | null {
    const key = `${cx},${cz}`
    const cached = this.lakes.get(key)
    if (cached !== undefined) return cached
    if (randomAt(cx, cz, this.seed ^ 8412) > 0.42) return this.lakes.set(key, null)
    let x = cx * REGION_SIZE, z = cz * REGION_SIZE, best = Infinity
    for (let i = 0; i < 7; i++) {
      const px = cx * REGION_SIZE + (randomAt(cx + i * 61, cz, this.seed ^ 7239) - 0.5) * REGION_SIZE * 0.5
      const pz = cz * REGION_SIZE + (randomAt(cx, cz - i * 39, this.seed ^ 1987) - 0.5) * REGION_SIZE * 0.5
      const y = this.shape(px, pz).height
      if (y < best) { best = y; x = px; z = pz }
    }
    if (best < 14 || best > 600 || Math.hypot(x, z) < 900 || this.shape(x, z).continental < COAST_INLAND + 0.02) return this.lakes.set(key, null)
    const angle = randomAt(cx, cz, this.seed ^ 6614) * Math.PI
    const base = { x, z, cos: Math.cos(angle), sin: Math.sin(angle), rx: 180 + randomAt(cx, cz, this.seed ^ 8764) * 620, rz: 150 + randomAt(cx, cz, this.seed ^ 2955) * 450 }

    const level = this.rimLevel(base, 12) - 1.2
    if (best - level > 45 || level < SEA_LEVEL + 4) return this.lakes.set(key, null)
    return this.lakes.set(key, { ...base, level, depth: 7 + randomAt(cx, cz, this.seed ^ 4411) * 12 })
  }

  private pondFor(px: number, pz: number): Basin | null {
    const key = `${px},${pz}`
    const cached = this.ponds.get(key)
    if (cached !== undefined) return cached
    const moisture = this.climate.at((px + 0.5) * POND_CELL / 3_400, (pz + 0.5) * POND_CELL / 3_400)
    if (randomAt(px, pz, this.seed ^ 5521) > 0.17 + moisture * 0.12) return this.ponds.set(key, null)
    const x = (px + 0.5 + (randomAt(px, pz, this.seed ^ 1133) - 0.5) * 0.5) * POND_CELL
    const z = (pz + 0.5 + (randomAt(px, pz, this.seed ^ 7717) - 0.5) * 0.5) * POND_CELL
    if (Math.hypot(x, z) < 650) return this.ponds.set(key, null)
    const rx = 22 + randomAt(px, pz, this.seed ^ 3391) * 75
    const angle = randomAt(px, pz, this.seed ^ 2207) * Math.PI
    const base = { x, z, cos: Math.cos(angle), sin: Math.sin(angle), rx, rz: rx * (0.55 + randomAt(px, pz, this.seed ^ 9182) * 0.4) }
    const level = this.rimLevel(base, 8) - 0.7
    const center = this.shape(x, z)
    if (center.height - level > 9 || level < SEA_LEVEL + 3 || center.continental < COAST_INLAND + 0.02) return this.ponds.set(key, null)
    return this.ponds.set(key, { ...base, level, depth: 1.8 + randomAt(px, pz, this.seed ^ 6021) * 2.6 })
  }

  private basinAt(x: number, z: number, b: Basin, height: number) {
    const lx = x - b.x, lz = z - b.z
    const u = (lx * b.cos + lz * b.sin) / b.rx, v = (lz * b.cos - lx * b.sin) / b.rz
    if (Math.abs(u) > 1.7 || Math.abs(v) > 1.7) return null
    const shape = Math.hypot(u, v) + this.noise.at(x / (b.rx * 0.8) + 3, z / (b.rx * 0.8)) * 0.1 + this.detail.at(x / 70, z / 70) * 0.025
    if (shape >= 1.45) return null
    const target = b.level - b.depth * (1 - smoothstep(0, 1, shape)) + 1.6 * smoothstep(0.9, 1.3, shape)
    const blend = 1 - smoothstep(1, 1.45, shape)
    let carved = lerp(height, target, blend)

    if (shape > 1) carved = Math.max(carved, lerp(height, b.level + 0.4, 1 - smoothstep(1.3, 1.45, shape)))
    return { height: carved, blend, wet: shape < 1.3 }
  }

  private river(x: number, z: number, shape: Shape, height: number, suppress: number) {
    const mask = smoothstep(-0.1, 0.2, this.climate.at(x / 26_000 - 50, z / 26_000 + 90))
      * (1 - smoothstep(0.12, 0.38, shape.ranges)) * (1 - smoothstep(0.25, 0.45, shape.ocean))

      * smoothstep(-30, 80, shape.shore)
      * smoothstep(400, 1_200, Math.hypot(x, z)) * (1 - suppress)
      * smoothstep(9_000, 14_000, WORLD_HALF - Math.max(Math.abs(x), Math.abs(z)))
    const strength = smoothstep(0.04, 0.3, mask)
    if (strength <= 0) return null
    const rx = shape.wx + this.climate.at(x / 2_300 + 11, z / 2_300) * 380
    const rz = shape.wz + this.climate.at(x / 2_300, z / 2_300 - 7) * 380
    const n = this.climate.at(rx / RIVER_SCALE + 300, rz / RIVER_SCALE - 300)
    if (Math.abs(n) > 0.2) return null
    const step = 24
    const gx = this.climate.at((rx + step) / RIVER_SCALE + 300, rz / RIVER_SCALE - 300) - n
    const gz = this.climate.at(rx / RIVER_SCALE + 300, (rz + step) / RIVER_SCALE - 300) - n
    const distance = Math.abs(n) * step / Math.max(Math.hypot(gx, gz), 1e-9)
    const width = (9 + 30 * clamp01(this.detail.at(x / 11_000 + 5, z / 11_000) * 0.6 + 0.5)) * (0.4 + 0.6 * strength)
    const halfW = width / 2

    const level = lerp(Math.max(SEA_LEVEL + 0.05, shape.riverBase - 2.4), SEA_LEVEL + 0.02, shape.coast)
    const bankTop = level + 1.1
    const reach = halfW + 4 + Math.min(380, Math.max(25, Math.abs(height - bankTop) * 3))
    if (distance >= reach) return null
    const depth = 1.4 + width * 0.08 + shape.fall * 3
    const target = distance < halfW + 4
      ? level - depth + (depth + 1.1) * smoothstep(halfW * 0.45, halfW + 4, distance)
      : bankTop + (distance - halfW - 4) * 0.018
    const t = (1 - smoothstep(halfW + 4, reach, distance)) * strength

    const along = Math.hypot(gx, gz) || 1
    let dirX = -gz / along, dirZ = gx / along, downstream = 0

    if (shape.fallReach > 0) {
      const across = dirX * shape.fallX + dirZ * shape.fallZ
      if (across < 0) { dirX = -dirX; dirZ = -dirZ }
      downstream = shape.fallReach * smoothstep(0.15, 0.4, Math.abs(across))
    }
    return {
      height: lerp(height, target, t), level,
      wet: strength > 0.5 && distance < halfW + 6,
      fall: shape.fall * (1 - smoothstep(halfW, halfW + 45, distance)) * strength,
      dirX, dirZ, downstream,
    }
  }

  surface(x: number, z: number): Surface {
    const shape = this.shape(x, z)
    let height = shape.height, waterLevel = WATER_NONE, water: WaterKind = 'none', fall = 0, suppress = 0, flowX = 0, flowZ = 0
    let downstream = 0, fallX = 0, fallZ = 0, lip = 0, foot = 0
    const lake = this.lakeFor(Math.floor(x / REGION_SIZE + 0.5), Math.floor(z / REGION_SIZE + 0.5))
    if (lake) {
      const result = this.basinAt(x, z, lake, height)
      if (result) { height = result.height; suppress = result.blend; if (result.wet) { waterLevel = lake.level; water = 'lake' } }
    }
    const pond = this.pondFor(Math.floor(x / POND_CELL), Math.floor(z / POND_CELL))
    if (pond) {
      const result = this.basinAt(x, z, pond, height)
      if (result) {
        height = result.height; suppress = Math.max(suppress, result.blend)
        if (result.wet && pond.level > waterLevel) { waterLevel = pond.level; water = 'pond' }
      }
    }
    const river = this.river(x, z, shape, height, suppress)
    if (river) {
      height = river.height; fall = river.fall
      if (river.wet && waterLevel === WATER_NONE) {
        waterLevel = river.level; water = 'river'; flowX = river.dirX; flowZ = river.dirZ; downstream = river.downstream
        if (shape.fallReach > 0) { fallX = shape.fallX; fallZ = shape.fallZ; lip = shape.lip; foot = shape.foot }
      }
    }
    if (height < SEA_LEVEL + 2 && waterLevel < SEA_LEVEL && shape.shore < SEA_REACH) {
      waterLevel = SEA_LEVEL; water = 'ocean'; flowX = 0; flowZ = 0; downstream = 0; fallX = 0; fallZ = 0; lip = 0; foot = 0
    }
    const sand = shape.shore === Infinity ? 0 : 1 - smoothstep(shape.beach - 6, shape.beach + 70, shape.shore)
    return { height, waterLevel, water, fall, coast: shape.coast, shore: shape.shore, sand, flowX, flowZ, downstream, fallX, fallZ, lip, foot }
  }

  height(x: number, z: number) { return this.surface(x, z).height }

  sample(x: number, z: number): TerrainPoint {
    const s = this.surface(x, z)
    const moisture = this.climate.fbm(x / 3_400, z / 3_400, 3)
    const forestPattern = this.climate.at(x / 710 + 29, z / 710) * 0.6 + this.detail.at(x / 160, z / 160) * 0.22
    const wet = s.waterLevel > WATER_NONE
    let biome: Biome = 'meadow'
    if (s.fall > 0.3 && s.water === 'river') biome = 'waterfall'
    else if (wet && s.height < s.waterLevel) biome = s.water === 'ocean' ? 'ocean' : s.water === 'river' ? 'river' : 'lake'
    else if (s.sand > 0.55) biome = 'beach'
    else if (s.water === 'river') biome = 'river'
    else if (wet && s.height < s.waterLevel + 5) biome = s.water === 'ocean' ? 'beach' : 'wetland'
    else if (s.sand > 0.04) biome = 'shore'
    else if (s.height > 700) biome = 'highlands'
    else if (s.height > 390) biome = 'pine'
    else if (moisture < -0.25) biome = 'scrub'
    else if (moisture + forestPattern > -0.02) biome = 'forest'
    const forest = clamp01((moisture + forestPattern + 0.28) * 1.25)

    const dense = biome === 'forest' || biome === 'pine'
      ? smoothstep(0.1, 0.4, this.climate.at(x / 1_400 + 211, z / 1_400 - 77) * 0.75 + this.detail.at(x / 380 + 5, z / 380 + 12) * 0.25) * smoothstep(0.3, 0.7, forest)
      : 0
    if (biome === 'forest' && dense > 0.5) biome = 'denseForest'
    return {
      height: s.height, waterLevel: s.waterLevel, moisture, biome, forest, water: s.water, fall: s.fall, coast: s.coast, shore: s.shore, sand: s.sand, dense,
      flowX: s.flowX, flowZ: s.flowZ, downstream: s.downstream, fallX: s.fallX, fallZ: s.fallZ, lip: s.lip, foot: s.foot,
    }
  }

  slope(x: number, z: number, step = 8) {
    return Math.hypot(this.height(x + step, z) - this.height(x - step, z), this.height(x, z + step) - this.height(x, z - step)) / (2 * step)
  }

  town(cx: number, cz: number): Town {
    const id = `${cx},${cz}`
    const cached = this.towns.get(id)
    if (cached) return cached
    const value = randomAt(cx, cz, this.seed ^ 16271)
    let kind: Town['kind'] = cx === 0 && cz === 0 ? 'town' : value < 0.3 ? 'hamlet' : value < 0.79 ? 'village' : value < 0.94 ? 'town' : 'city'
    let x = cx * REGION_SIZE, z = cz * REGION_SIZE, best = Infinity
    if (cx !== 0 || cz !== 0) {
      for (let i = 0; i < 10; i++) {
        const px = cx * REGION_SIZE + (randomAt(cx + i * 79, cz, this.seed ^ 8009) - 0.5) * REGION_SIZE * 0.48
        const pz = cz * REGION_SIZE + (randomAt(cx, cz + i * 31, this.seed ^ 9013) - 0.5) * REGION_SIZE * 0.48
        const sample = this.surface(px, pz)
        const flooded = sample.height < sample.waterLevel + 4 || sample.height < SEA_LEVEL + 4
        const score = this.slope(px, pz, 65) * 1300 + sample.height * 0.15 + (flooded ? 10_000 : 0) + (sample.waterLevel > WATER_NONE ? 2_500 : 0)
        if (score < best) { best = score; x = px; z = pz }
      }
    }
    const surface = this.surface(x, z)

    if (kind === 'city' && (this.slope(x, z, 160) > 0.075 || surface.height > 320)) kind = 'town'
    const a = hash2(cx, cz, this.seed ^ 3213) % NAME_START.length
    const b = hash2(cx, cz, this.seed ^ 4219) % NAME_END.length
    return this.towns.set(id, {
      id, cx, cz, x, z, y: surface.height, kind,
      name: cx === 0 && cz === 0 ? 'Vale do Cedro' : `${NAME_START[a]} ${NAME_END[b]}`,
      radius: kind === 'hamlet' ? 190 : kind === 'village' ? 350 : kind === 'town' ? 530 : 760,
      angle: randomAt(cx, cz, this.seed ^ 9361) * Math.PI * 2,
      wet: (cx !== 0 || cz !== 0) && (surface.height < surface.waterLevel + 1.5 || surface.height < SEA_LEVEL + 3),
    })
  }

  nearestTown(x: number, z: number) {
    const cx = Math.floor(x / REGION_SIZE + 0.5), cz = Math.floor(z / REGION_SIZE + 0.5)
    return this.town(cx, cz)
  }

  get cacheSizes() { return { lakes: this.lakes.size, towns: this.towns.size } }
}
