import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { extrudeRaw, fbm3, latheRaw, noise3, rand, rboxRaw, Raw, sheetRaw, smooth, tubeRaw, type Family, type Kit, type Mat, type V2, type V3 } from '../kit'

export function cells(x: number, y: number, z: number, seed = 0): [number, number] {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  let f1 = 9, f2 = 9
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const cx = xi + i, cy = yi + j, cz = zi + k
    const dx = cx + rand(cx, cy, cz, seed) - x, dy = cy + rand(cx, cy, cz, seed + 1) - y, dz = cz + rand(cx, cy, cz, seed + 2) - z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (dist < f1) { f2 = f1; f1 = dist } else if (dist < f2) f2 = dist
  }
  return [f1, f2]
}

export function alligator(x: number, y: number, z: number, scale: number, seed = 0, width = 0.09) {
  const [f1, f2] = cells(x * scale, y * scale, z * scale, seed)
  return 1 - smooth(0, width, f2 - f1)
}

export function rotated(raw: Raw, pitch: number, yaw: number, roll: number, at: V3 = [0, 0, 0]) {
  return raw.apply(new Matrix4().makeRotationFromEuler(new Euler(pitch, yaw, roll, 'YXZ')).setPosition(at[0], at[1], at[2]))
}

export function rockRaw(w: number, h: number, d: number, seed: number, o: { rough?: number; facets?: number; r?: number; pit?: number } = {}) {
  const min = Math.min(w, h, d), seg = (n: number) => Math.max(2, Math.ceil(n / 0.03))
  const raw = rboxRaw(w, h, d, { r: o.r ?? min * 0.14, seg: [seg(w), seg(h), seg(d)], bevelSeg: 2 })
  const amp = (o.rough ?? 0.12) * min, pit = (o.pit ?? 0.25) * amp
  raw.displace((x, y, z) => (fbm3(x * 6 + seed, y * 6, z * 6, seed | 0) - 0.5) * amp * 2 + (noise3(x * 31, y * 31 + seed, z * 31, 7) - 0.5) * pit)
  const planes: [number, number, number, number][] = []
  for (let i = 0; i < (o.facets ?? 3); i++) {
    const a = rand(seed | 0, i, 1) * Math.PI * 2, b = (rand(seed | 0, i, 2) - 0.5) * 2.4, nx = Math.cos(a) * Math.cos(b), ny = Math.sin(b), nz = Math.sin(a) * Math.cos(b)
    const reach = Math.abs(nx) * w / 2 + Math.abs(ny) * h / 2 + Math.abs(nz) * d / 2
    planes.push([nx, ny, nz, reach * (0.55 + rand(seed | 0, i, 3) * 0.3)])
  }
  raw.warp((x, y, z) => {
    let px = x, py = y, pz = z
    for (const [nx, ny, nz, c] of planes) { const e = px * nx + py * ny + pz * nz - c; if (e > 0) { px -= nx * e; py -= ny * e; pz -= nz * e } }
    return [px - x, py - y, pz - z]
  })
  return raw.smooth(32)
}

export function brokenBoardRaw(len: number, wid: number, th: number, seed: number, both = false) {
  const teeth = 5, out: V2[] = []
  const jag = (end: number, sign: number) => {
    const pts: V2[] = []
    for (let i = 0; i <= teeth; i++) {
      const x = -wid / 2 + wid * i / teeth
      pts.push([x, end + sign * (i % 2 ? 0.02 + rand(seed, i, end > 0 ? 1 : 2) * 0.07 : rand(seed, i, 3) * 0.015)])
    }
    return pts
  }
  out.push(...(both ? jag(-len / 2, -1) : [[-wid / 2, -len / 2], [wid / 2, -len / 2]] as V2[]))
  out.push(...jag(len / 2, 1).reverse())
  const raw = extrudeRaw(out, th, { bevel: Math.min(0.002, th * 0.2), bevelSeg: 1, curveSeg: 1 })

  return raw.apply(new Matrix4().makeRotationX(-Math.PI / 2)).apply(new Matrix4().makeRotationY(Math.PI / 2))
}

export type Part = [Raw, Mat, { tone?: number; tint?: V3 }?]

export class Pile {
  private readonly cell = 0.01
  private readonly top: Float32Array
  private readonly nx: number
  private readonly nz: number
  private readonly x0: number
  private readonly z0: number
  constructor(readonly k: Kit, readonly w: number, readonly d: number, readonly limit = Infinity) {
    this.x0 = -w / 2 - 0.3; this.z0 = -d / 2 - 0.3
    this.nx = Math.ceil((w + 0.6) / this.cell); this.nz = Math.ceil((d + 0.6) / this.cell)
    this.top = new Float32Array(this.nx * this.nz).fill(-Infinity)
  }
  private id(i: number, j: number) { return i < 0 || j < 0 || i >= this.nx || j >= this.nz ? -1 : j * this.nx + i }

  private raster(raw: Raw, fn: (cell: number, y: number) => void) {
    const P = raw.p, c = this.cell, covered = new Set<number>()
    const hit = (cell: number, y: number) => { covered.add(cell); fn(cell, y) }
    this.rasterTriangles(raw, hit)
    for (let v = 0; v < raw.count; v++) { const cell = this.id(Math.floor((P[v * 3] - this.x0) / c), Math.floor((P[v * 3 + 2] - this.z0) / c)); if (cell >= 0 && !covered.has(cell)) fn(cell, P[v * 3 + 1]) }
  }
  private rasterTriangles(raw: Raw, fn: (cell: number, y: number) => void) {
    const P = raw.p, c = this.cell
    for (let t = 0; t < raw.i.length; t += 3) {
      const a = raw.i[t] * 3, b = raw.i[t + 1] * 3, e = raw.i[t + 2] * 3
      const ax = P[a], az = P[a + 2], bx = P[b], bz = P[b + 2], ex = P[e], ez = P[e + 2]
      const det = (bz - ez) * (ax - ex) + (ex - bx) * (az - ez)
      if (Math.abs(det) < 1e-12) continue
      const i0 = Math.ceil((Math.min(ax, bx, ex) - this.x0) / c - 0.5), i1 = Math.floor((Math.max(ax, bx, ex) - this.x0) / c - 0.5)
      const j0 = Math.ceil((Math.min(az, bz, ez) - this.z0) / c - 0.5), j1 = Math.floor((Math.max(az, bz, ez) - this.z0) / c - 0.5)
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = this.x0 + (i + 0.5) * c, z = this.z0 + (j + 0.5) * c
        const l1 = ((bz - ez) * (x - ex) + (ex - bx) * (z - ez)) / det, l2 = ((ez - az) * (x - ex) + (ax - ex) * (z - ez)) / det, l3 = 1 - l1 - l2
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue
        const cell = this.id(i, j)
        if (cell >= 0) fn(cell, l1 * P[a + 1] + l2 * P[b + 1] + l3 * P[e + 1])
      }
    }
  }

  heightNear(x: number, z: number, r: number) {
    let best = 0
    const c = this.cell, i0 = Math.floor((x - r - this.x0) / c), i1 = Math.floor((x + r - this.x0) / c), j0 = Math.floor((z - r - this.z0) / c), j1 = Math.floor((z + r - this.z0) / c)
    for (let i = i0; i <= i1; i += 2) for (let j = j0; j <= j1; j += 2) { const cell = this.id(i, j); if (cell >= 0 && this.top[cell] > best) best = this.top[cell] }
    return best
  }

  spot(margin = 0.08, tries = 5, r = 0.08): [number, number] {
    let best: [number, number] = [0, 0], low = Infinity
    for (let t = 0; t < tries; t++) {
      const x = this.k.jitter(Math.max(0.01, this.w / 2 - margin)), z = this.k.jitter(Math.max(0.01, this.d / 2 - margin)), y = this.heightNear(x, z, r)
      if (y < low) { low = y; best = [x, z] }
    }
    return best
  }

  surface(raw: Raw) { this.raster(raw, (cell, y) => { if (y > this.top[cell]) this.top[cell] = y }) }

  drop(parts: Part[], requested = 0.005): number | null {
    const embed = Math.min(requested, 0.005)
    const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity]
    for (const [raw] of parts) for (let v = 0; v < raw.count; v++) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], raw.p[v * 3 + a]); hi[a] = Math.max(hi[a], raw.p[v * 3 + a]) }
    const fit = (min: number, max: number, half: number) => max - min > 2 * half ? -(min + max) / 2 : min < -half ? -half - min : max > half ? half - max : 0
    const dx = fit(lo[0], hi[0], this.w / 2 + 0.04), dz = fit(lo[2], hi[2], this.d / 2 + 0.04)
    if (dx || dz) for (const [raw] of parts) raw.apply(new Matrix4().makeTranslation(dx, 0, dz))
    const bottom = new Map<number, number>()
    for (const [raw] of parts) this.raster(raw, (cell, y) => { const b = bottom.get(cell); if (b === undefined || y < b) bottom.set(cell, y) })
    let t = lo[1] + 0.002
    for (const [cell, y] of bottom) if (this.top[cell] > -Infinity) t = Math.min(t, y - this.top[cell] + embed)
    if (hi[1] - t > this.limit) return null
    const shift = new Matrix4().makeTranslation(0, -t, 0)
    for (const [raw, m, o] of parts) { raw.apply(shift); this.k.put(raw, m, o ?? {}); this.surface(raw) }
    return -t
  }

  height(x: number, z: number) { const cell = this.id(Math.floor((x - this.x0) / this.cell), Math.floor((z - this.z0) / this.cell)); return cell >= 0 && this.top[cell] > -Infinity ? this.top[cell] : 0 }
}

export function dustBed(k: Kit, m: Mat, w: number, d: number, peak: number, seed: number, o: { at?: V3; tint?: V3; tone?: number; pile?: Pile } = {}) {
  const at = o.at ?? [0, 0, 0]
  const fy = (x: number, z: number) => {
    const r = Math.hypot(x / (w / 2), z / (d / 2))
    return peak * Math.max(0, 1 - r * r) ** 1.4 * (0.75 + 0.5 * fbm3(x * 5, 0, z * 5, seed)) + 0.0025
  }
  const raw = sheetRaw(w, d, Math.ceil(w / 0.04), Math.ceil(d / 0.04), fy, 0.0035)
  raw.apply(new Matrix4().makeTranslation(at[0], at[1] + 0.0008, at[2]))
  k.put(raw, m, { tint: o.tint, tone: o.tone ?? 1 })
  o.pile?.surface(raw)
}

export function rebar(k: Kit, from: V3, dir: V3, len: number, bend: number, seed: number, bounds?: [number, number]) {
  let L = len
  if (bounds) {
    const [hw, hd] = bounds
    const room = (p: number, d: number, half: number) => (Math.abs(d) < 1e-6 ? Infinity : d > 0 ? (half - p) / d : (-half - p) / d)
    L = Math.max(0.04, Math.min(L, room(from[0], dir[0], hw), room(from[2], dir[2], hd)))
  }
  const endY = from[1] + dir[1] * L, sag = Math.max(0, Math.min(bend, endY - 0.012))
  const pts: V3[] = []
  for (let i = 0; i <= 6; i++) {
    const t = i / 6
    pts.push([from[0] + dir[0] * L * t + Math.sin(seed + t * 3) * 0.008 * t, from[1] + dir[1] * L * t - sag * t * t, from[2] + dir[2] * L * t])
  }
  k.put(tubeRaw(pts, 0.0062, { seg: 7, fillet: 0.02 }), 'steel', { tint: [0.62, 0.42, 0.3], tone: 0.8 })

  for (let i = 2; i < 6; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1], axis = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize()
    const m = new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis)).setPosition(p[0], p[1], p[2])
    k.put(latheRaw([[0, -0.0022], [0.0074, -0.0022], [0.0074, 0.0022], [0, 0.0022]], { seg: 8 }).apply(m), 'steel', { tint: [0.6, 0.4, 0.28], tone: 0.75 })
  }
}

function brickRaw(seed: number, half = false) {
  return rockRaw(half ? 0.1 : 0.215, 0.065, 0.1025, seed, { rough: 0.05, facets: half ? 2 : 1, r: 0.006, pit: 0.6 })
}
const turn = (parts: Part[], pitch: number, yaw: number, roll: number, at: V3) => { for (const [raw] of parts) rotated(raw, pitch, yaw, roll, at); return parts }

export const DEBRIS: Family = {
  'brick-rubble': (k, s) => {
    const { w, h, d } = k, v = s.variant, pile = new Pile(k, w, d, h + 0.18), seed = v * 31 + 5
    dustBed(k, 'concrete', w * 0.95, d * 0.92, 0.035, seed, { tint: [0.92, 0.82, 0.72], pile })

    for (let c = 0; c < 2 + (v >> 1); c++) {
      const parts: Part[] = [], courses = 2 + (c % 2), across = 2 + (c + v) % 2
      for (let r = 0; r < courses; r++) for (let i = 0; i < across; i++) {
        if (r === courses - 1 && i === across - 1 && k.chance(0.6)) continue
        const x = -0.22 + i * 0.225 + (r % 2 ? 0.11 : 0)
        parts.push([brickRaw(seed + c * 17 + r * 5 + i).apply(new Matrix4().makeTranslation(x, 0.035 + r * 0.075, 0)), 'brick', { tone: 0.82 + k.rnd() * 0.3 }])
        if (r > 0) parts.push([rboxRaw(0.19, 0.012, 0.08, { r: 0.003 }).apply(new Matrix4().makeTranslation(x, r * 0.075 - 0.0025, 0)), 'concrete', { tint: [0.9, 0.88, 0.8] }])
      }
      const [x, z] = pile.spot(0.3)
      pile.drop(turn(parts, k.jitter(0.2), k.rnd() * Math.PI, k.jitter(0.25), [x, 0.6, z]), 0.01)
    }
    for (let i = 0; i < 26 + v * 8; i++) {
      const [x, z] = pile.spot(0.12)
      pile.drop([[rotated(brickRaw(seed + 100 + i, k.chance(0.45)), k.jitter(1.2), k.rnd() * Math.PI * 2, k.jitter(1.2), [x, 0.8, z]), 'brick', { tone: 0.75 + k.rnd() * 0.35, tint: k.chance(0.2) ? [0.85, 0.75, 0.7] : undefined }]], 0.012)
    }
    for (let i = 0; i < 18; i++) {
      const [x, z] = pile.spot(0.05, 3)
      pile.drop([[rotated(rockRaw(0.03 + k.rnd() * 0.04, 0.02 + k.rnd() * 0.02, 0.03 + k.rnd() * 0.03, seed + 300 + i, { rough: 0.2 }), k.rnd() * 2, k.rnd() * 3, k.rnd() * 2, [x, 0.8, z]), k.chance(0.5) ? 'brick' : 'concrete', { tone: 0.8 }]], 0.006)
    }
  },
  'concrete-rubble': (k, s) => {
    const { w, h, d } = k, v = s.variant, pile = new Pile(k, w, d, h + 0.2), seed = v * 43 + 11
    dustBed(k, 'concrete', w * 0.98, d * 0.95, 0.04, seed, { tone: 0.95, pile })
    const big = 2 + (v > 1 ? 1 : 0)
    for (let i = 0; i < big; i++) {
      const sw = w * (0.22 + k.rnd() * 0.08), sh = 0.1 + k.rnd() * 0.05, sd = d * (0.38 + k.rnd() * 0.15), x = -w / 2 + (i + 0.5) * w / big
      const raw = rotated(rockRaw(sw, sh, sd, seed + i, { rough: 0.08, facets: 4, r: 0.012 }), k.jitter(0.1), k.jitter(0.5), k.jitter(0.1), [x, 0.5, k.jitter(d * 0.08)])
      const lift = pile.drop([[raw, 'concrete', { tone: 0.88 + k.rnd() * 0.15 }]], 0.01) ?? 0

      const side = i % 2 ? 1 : -1, ex = x + side * sw * 0.3
      for (let r = 0; r < 2; r++) rebar(k, [ex, lift + 0.5 + sh * 0.05, -sd * 0.2 + r * sd * 0.35], [side * 0.92, 0.3, k.jitter(0.25)], 0.2 + k.rnd() * 0.15, 0.05 + k.rnd() * 0.06, seed + i * 3 + r, [w / 2 + 0.05, d / 2 + 0.05])
    }
    for (let i = 0; i < 20 + v * 6; i++) {
      const size = 0.06 + k.rnd() * 0.12, [x, z] = pile.spot(0.1)
      pile.drop([[rotated(rockRaw(size, size * (0.5 + k.rnd() * 0.4), size * (0.7 + k.rnd() * 0.5), seed + 50 + i, { rough: 0.14, facets: 3 }), k.jitter(1.4), k.rnd() * 6, k.jitter(1.4), [x, 0.9, z]), 'concrete', { tone: 0.8 + k.rnd() * 0.3 }]], 0.01)
    }
    for (let i = 0; i < 24; i++) {
      const [x, z] = pile.spot(0.04, 3)
      pile.drop([[rotated(rockRaw(0.025 + k.rnd() * 0.03, 0.02, 0.025 + k.rnd() * 0.03, seed + 200 + i, { rough: 0.2 }), k.rnd() * 2, k.rnd() * 3, k.rnd() * 2, [x, 0.9, z]), 'concrete', { tone: 0.75 }]], 0.005)
    }
  },
  planks: (k, s) => {
    const { w, h, d } = k, v = s.variant, pile = new Pile(k, w, d, h + 0.15), seed = v * 17 + 3
    for (let i = 0; i < 9 + v * 3; i++) {
      const wid = k.pick([0.09, 0.12, 0.145, 0.19]), th = k.pick([0.019, 0.022, 0.028])
      const yaw = k.jitter(0.5) + (i % 4 === 3 ? 0.9 : 0), c = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw))
      const fits = Math.min(c > 1e-3 ? (w + 0.06 - sn * wid) / c : Infinity, sn > 1e-3 ? (d + 0.06 - c * wid) / sn : Infinity)
      const len = Math.max(0.3, Math.min(fits, w * (0.55 + k.rnd() * 0.4)))
      const raw = k.chance(0.55) ? brokenBoardRaw(len, wid, th, seed + i, k.chance(0.3)) : rboxRaw(len, th, wid, { r: 0.003, grain: 0 })
      const [x, z] = pile.spot(0.15, 3, 0.15)
      pile.drop([[rotated(raw, 0, yaw, k.jitter(0.06), [x * 0.5, 0.8, z]), 'wood', { tone: 0.62 + k.rnd() * 0.4, tint: k.chance(0.25) ? [0.85, 0.9, 0.95] : undefined }]], 0.004)
    }

    for (let i = 0; i < 8 + v * 2; i++) {
      const [x, z] = pile.spot(0.08, 2)
      const raw = tubeRaw([[0, 0, 0], [0.045, 0.002, 0], [0.06, 0.012 + k.rnd() * 0.01, 0.004]], 0.0018, { seg: 5, fillet: 0.006 })
      pile.drop([[rotated(raw, 0, k.rnd() * 6, 0, [x, 0.8, z]), 'steel', { tint: [0.55, 0.42, 0.33], tone: 0.7 }]], 0.0015)
    }
  },
  'metal-scrap': (k, s) => {
    const { w, h, d } = k, v = s.variant, pile = new Pile(k, w, d, h + 0.15), seed = v * 13 + 29
    dustBed(k, 'concrete', w * 0.9, d * 0.85, 0.02, seed, { tint: [0.8, 0.7, 0.6], tone: 0.75, pile })
    const rust: V3 = [0.68, 0.45, 0.32]

    for (let i = 0; i < 2 + (v > 1 ? 1 : 0); i++) {
      const sw = w * (0.4 + k.rnd() * 0.2), sd = d * (0.45 + k.rnd() * 0.25), bend = 0.08 + k.rnd() * 0.12, ph = k.rnd() * 3
      const raw = sheetRaw(sw, sd, Math.ceil(sw / 0.012), Math.ceil(sd / 0.06), (x, z) => Math.sin(x * Math.PI * 2 / 0.076 + ph) * 0.009 + bend * (z / sd) ** 2 + (noise3(x * 4, 0, z * 4, seed + i) - 0.5) * 0.04, 0.0016)
      const [x, z] = pile.spot(0.2)
      pile.drop([[rotated(raw, k.jitter(0.12), k.jitter(0.5), k.jitter(0.1), [x, 0.8, z]), 'steel', { tint: i % 2 ? rust : [0.82, 0.84, 0.86], tone: 0.85 }]], 0.006)
    }

    for (let i = 0; i < 4 + v; i++) {
      const L = w * (0.35 + k.rnd() * 0.4), ro = 0.016 + k.rnd() * 0.03, ri = ro - 0.004
      const raw = latheRaw([[ri, -L / 2], [ro, -L / 2], [ro, L / 2], [ri, L / 2], [ri, -L / 2]], { seg: 18, crease: 60 }).apply(new Matrix4().makeRotationZ(Math.PI / 2))
      const [x, z] = pile.spot(0.1)
      pile.drop([[rotated(raw, 0, k.jitter(0.6), 0, [x, 0.8, z]), 'steel', { tint: k.chance(0.5) ? rust : undefined, tone: 0.8 }]], 0.005)
    }
    for (let i = 0; i < 2 + v; i++) {
      const L = w * (0.45 + k.rnd() * 0.3), a = 0.04, t = 0.005
      const raw = extrudeRaw([[0, 0], [a, 0], [a, t], [t, t], [t, a], [0, a]], L, { bevel: 0.001, bevelSeg: 1 }).apply(new Matrix4().makeRotationY(Math.PI / 2))
      const [x, z] = pile.spot(0.1)
      pile.drop([[rotated(raw, 0, k.jitter(0.7), k.jitter(0.4), [x, 0.8, z]), 'steel', { tint: rust, tone: 0.75 }]], 0.004)
    }
    {
      const L = w * 0.65, bundle: Part[] = []

      const sag = 0.02 + k.rnd() * 0.03
      for (const [y, z] of [[0, -0.0118], [0, 0], [0, 0.0118], [0.0102, -0.0059], [0.0102, 0.0059]]) {
        bundle.push([tubeRaw(Array.from({ length: 7 }, (_, j) => [-L / 2 + L * j / 6, sag * Math.sin(j / 6 * Math.PI) + y, z] as V3), 0.006, { seg: 6 }), 'steel', { tint: [0.55, 0.38, 0.3], tone: 0.7 }])
      }
      const [x, z] = pile.spot(0.2)
      pile.drop(turn(bundle, 0, k.jitter(0.5), 0, [x * 0.4, 0.8, z]), 0.004)
    }

    const cap = latheRaw([[0, 0.035], [0.08, 0.032], [0.15, 0.018], [0.17, 0.004], [0.175, 0], [0.16, 0.0], [0, 0.026]], { seg: 32, crease: 40 })
    pile.drop([[rotated(cap, k.jitter(0.25), 0, k.jitter(0.25), [w * 0.3, 0.8, d * 0.15]), 'steel', { tone: 0.95 }]], 0.004)
    const can = latheRaw([[0, 0], [0.033, 0], [0.033, 0.11], [0, 0.11]], { seg: 16 })
    can.warp((x, y, z) => [x * (0.3 + y * 6) - x, 0, z * (1.1 - y * 2) - z]).smooth(40)
    pile.drop([[rotated(can, Math.PI / 2, k.rnd() * 3, 0, [-w * 0.35, 0.8, -d * 0.2]), 'paint', { tint: [0.75, 0.15, 0.12] }]], 0.004)
  },
  'burned-debris': (k, s) => {
    const { w, h, d } = k, v = s.variant, pile = new Pile(k, w, d, h + 0.2), seed = v * 7 + 61
    dustBed(k, 'plaster', w * 1.0, d * 0.95, 0.05 + v * 0.01, seed, { tint: [0.42, 0.4, 0.38], tone: 0.9, pile })
    dustBed(k, 'charcoal', w * 0.6, d * 0.55, 0.03, seed + 1, { at: [w * 0.12, 0.012, 0], tone: 0.7, pile })

    for (let i = 0; i < 3 + v; i++) {
      const sec = 0.07 + k.rnd() * 0.05, yaw = k.jitter(0.5) + (i % 2 ? 0.35 : -0.35), c = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw))
      const L = Math.max(0.3, Math.min(w * (0.5 + k.rnd() * 0.35), (w + 0.04 - sn * sec) / Math.max(c, 0.2), (d + 0.04 - c * sec) / Math.max(sn, 0.05)))
      const raw = rboxRaw(L, sec, sec * (1 + k.rnd() * 0.4), { r: sec * 0.18, seg: [Math.ceil(L / 0.02), Math.ceil(sec / 0.015), Math.ceil(sec / 0.015)], bevelSeg: 2, grain: 0 })
      const sd = seed + i * 11
      raw.warp((x, y, z) => { const t = smooth(L * 0.2, L * 0.5, x); return [0, -y * t * 0.55, -z * t * 0.45] })
      raw.displace((x, y, z) => -alligator(x, y, z, 26, sd) * 0.006 - (fbm3(x * 9, y * 9, z * 9, sd) - 0.5) * 0.008)
      raw.smooth(50)
      const [x, z] = pile.spot(0.2, 3, 0.2)
      pile.drop([[rotated(raw, 0, yaw, k.jitter(0.1), [x * 0.5, 0.9, z]), 'charcoal', { tone: 0.7 + k.rnd() * 0.25 }]], 0.008)
    }

    for (let i = 0; i < 4 + v; i++) {
      const L = w * (0.32 + k.rnd() * 0.25), wid = 0.1 + k.rnd() * 0.05
      const char = brokenBoardRaw(L * 0.55, wid, 0.02, seed + 90 + i, true)
      const sound = rboxRaw(L * 0.45, 0.022, wid * 0.98, { r: 0.003, grain: 0 }).apply(new Matrix4().makeTranslation(L * 0.5 - 0.01, 0, 0))
      const [x, z] = pile.spot(0.2, 3, 0.15), yaw = k.rnd() * Math.PI
      pile.drop(turn([[char, 'charcoal', { tone: 0.75 }], [sound, 'wood', { tone: 0.55, tint: [0.75, 0.6, 0.5] }]], 0, yaw, k.jitter(0.08), [x, 0.9, z]), 0.006)
    }

    for (let i = 0; i < 14 + v * 4; i++) {
      const size = 0.03 + k.rnd() * 0.06, [x, z] = pile.spot(0.06, 3)
      const raw = rockRaw(size, size * 0.6, size * 0.8, seed + 140 + i, { rough: 0.2, facets: 2 })
      raw.displace((px, py, pz) => -alligator(px, py, pz, 60, seed + i) * 0.003)
      pile.drop([[rotated(raw, k.rnd() * 2, k.rnd() * 6, k.rnd() * 2, [x, 0.9, z]), 'charcoal', { tone: 0.6 + k.rnd() * 0.3 }]], 0.006)
    }
    const blob = latheRaw([[0, 0], [0.09, 0], [0.11, 0.01], [0.08, 0.025], [0.04, 0.04], [0, 0.045]], { seg: 20 })
    blob.displace((x, y, z) => (noise3(x * 25, y * 25, z * 25, seed) - 0.5) * 0.02 * (y + 0.01) * 20).smooth(60)
    pile.drop([[rotated(blob, 0, 0, 0, [-w * 0.3, 0.9, d * 0.2]), 'rubber', { tint: [0.35, 0.3, 0.28] }]], 0.01)
    for (let i = 0; i < 6; i++) {
      const [x, z] = pile.spot(0.08, 2)
      pile.drop([[rotated(tubeRaw([[0, 0, 0], [0.05, 0.003, 0], [0.065, 0.01, 0.006]], 0.002, { seg: 5, fillet: 0.006 }), 0, k.rnd() * 6, 0, [x, 0.9, z]), 'steel', { tint: [0.32, 0.28, 0.27], tone: 0.6 }]], 0.0015)
    }
  },
  'tile-rubble': (k, s) => {
    const { w, h, d } = k, v = s.variant, pile = new Pile(k, w, d, h + 0.1), seed = v * 19 + 7
    dustBed(k, 'concrete', w * 0.9, d * 0.85, 0.03, seed, { tint: [0.95, 0.94, 0.9], pile })
    const checker = v % 2 === 1

    for (let i = 0; i < 2 + (v >> 1); i++) {
      const bw = 0.3 + k.rnd() * 0.22, bd = 0.25 + k.rnd() * 0.18
      const parts: Part[] = [[rockRaw(bw, 0.035, bd, seed + i, { rough: 0.05, facets: 4, r: 0.006 }), 'concrete', { tone: 0.85 }]]
      const tile = 0.15
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const tx = a * tile, tz = b * tile
        if (Math.abs(tx) > bw / 2 - 0.05 || Math.abs(tz) > bd / 2 - 0.05 || k.chance(0.2)) continue
        parts.push([rboxRaw(tile - 0.006, 0.008, tile - 0.006, { r: 0.0015 }).apply(new Matrix4().makeTranslation(tx, 0.0205, tz)), 'tile', { tint: checker && (a + b) % 2 ? [0.25, 0.25, 0.27] : undefined, tone: 0.95 }])
      }
      const [x, z] = pile.spot(0.25)
      pile.drop(turn(parts, k.jitter(0.2), k.rnd() * 3, k.jitter(0.2), [x, 0.6, z]), 0.008)
    }

    for (let i = 0; i < 26 + v * 6; i++) {
      const r = 0.04 + k.rnd() * 0.07, n = 4 + Math.floor(k.rnd() * 3)
      const outline: V2[] = Array.from({ length: n }, (_, j) => { const a = j / n * Math.PI * 2 + k.jitter(0.4); const rr = r * (0.6 + k.rnd() * 0.5); return [Math.cos(a) * rr, Math.sin(a) * rr] as V2 })
      const raw = extrudeRaw(outline, 0.008, { bevel: 0.0012, bevelSeg: 1, curveSeg: 1 }).apply(new Matrix4().makeRotationX(-Math.PI / 2))
      const [x, z] = pile.spot(0.08)
      pile.drop([[rotated(raw, k.jitter(0.45), k.rnd() * 6, k.jitter(0.45), [x, 0.6, z]), 'tile', { tint: checker && k.chance(0.5) ? [0.25, 0.25, 0.27] : k.chance(0.15) ? [0.85, 0.9, 0.95] : undefined, tone: 0.9 + k.rnd() * 0.15 }]], 0.0035)
    }
  },
  'plaster-rubble': (k, s) => {
    const { w, h, d } = k, v = s.variant, pile = new Pile(k, w, d, h + 0.15), seed = v * 23 + 41
    dustBed(k, 'plaster', w * 1.0, d * 0.95, 0.06, seed, { tone: 1, pile })

    for (let i = 0; i < 4 + v; i++) {
      const r = 0.13 + k.rnd() * 0.12, n = 6
      const outline: V2[] = Array.from({ length: n }, (_, j) => { const a = j / n * Math.PI * 2 + k.jitter(0.35); const rr = r * (0.65 + k.rnd() * 0.45); return [Math.cos(a) * rr * 1.3, Math.sin(a) * rr] as V2 })
      const slab = extrudeRaw(outline, 0.022, { bevel: 0.004, bevelSeg: 2, curveSeg: 1 })
      slab.displace((x, y, z) => (noise3(x * 30, y * 30, z * 30, seed + i) - 0.5) * 0.003)
      slab.apply(new Matrix4().makeRotationX(-Math.PI / 2))
      const parts: Part[] = [[slab, 'plaster', { tone: 0.95 + k.rnd() * 0.1 }]]
      for (let l = -1; l <= 1; l++) parts.push([rboxRaw(r * 2.2, 0.007, 0.032, { r: 0.0015, grain: 0 }).apply(new Matrix4().makeTranslation(k.jitter(0.03), -0.0135, l * 0.07)), 'wood', { tone: 0.6 + k.rnd() * 0.2 }])
      const [x, z] = pile.spot(0.25)
      pile.drop(turn(parts, k.chance(0.35) ? Math.PI + k.jitter(0.2) : k.jitter(0.3), k.rnd() * 6, k.jitter(0.3), [x, 0.7, z]), 0.008)
    }
    for (let i = 0; i < 24 + v * 6; i++) {
      const size = 0.025 + k.rnd() * 0.06, [x, z] = pile.spot(0.06)
      pile.drop([[rotated(rockRaw(size, size * 0.45, size * 0.8, seed + 70 + i, { rough: 0.12, facets: 2 }), k.rnd() * 2, k.rnd() * 6, k.rnd() * 2, [x, 0.8, z]), 'plaster', { tone: 0.85 + k.rnd() * 0.2 }]], 0.005)
    }
  },
  'collapsed-beam': (k, s) => {
    const { w, h, d } = k, v = s.variant, pile = new Pile(k, w, d), seed = v * 29 + 13
    dustBed(k, 'concrete', w * 0.95, d * 0.95, 0.035, seed, { pile })

    const cx = w * 0.28
    for (let i = 0; i < 9; i++) {
      const size = 0.08 + k.rnd() * 0.07
      pile.drop([[rotated(rockRaw(size * 1.3, size * 0.8, size, seed + i, { rough: 0.12, facets: 3 }), k.jitter(0.4), k.rnd() * 6, k.jitter(0.4), [cx + k.jitter(0.12), 0.5, k.jitter(0.1)]), 'concrete', { tone: 0.85 }]], 0.012)
    }

    const L = w * 0.96, bh = Math.min(0.3, h * 0.62), bd = Math.min(0.24, d * 0.4)
    const beam = rboxRaw(L, bh, bd, { r: 0.012, seg: [Math.ceil(L / 0.03), Math.ceil(bh / 0.03), Math.ceil(bd / 0.03)], bevelSeg: 2 })
    beam.displace((x, y, z) => (fbm3(x * 5, y * 5, z * 5, seed) - 0.5) * 0.008 + (noise3(x * 28, y * 28, z * 28, seed + 1) - 0.5) * 0.003)

    beam.warp((x, y, z) => { const t = smooth(L * 0.38, L * 0.5, -x); return [t * (fbm3(y * 12, z * 12, 0, seed) - 0.5) * 0.12, 0, 0] })
    beam.smooth(35)
    const lift = pile.height(cx, 0)
    const tilt = Math.atan2(Math.max(0.02, Math.min(h - bh * 0.6, lift)), L * 0.7)
    const place = new Matrix4().makeRotationFromEuler(new Euler(0, k.jitter(0.1), tilt, 'YXZ')).setPosition(0, 0.8, 0)
    const y0 = pile.drop([[beam.apply(place), 'concrete', { tone: 0.92 }]], 0.015) ?? 0

    const rot = new Matrix4().extractRotation(place)
    for (const [oy, oz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const start = new Vector3(-L / 2 + 0.07, oy * (bh / 2 - 0.035), oz * (bd / 2 - 0.035)).applyMatrix4(place)
      const dir = new Vector3(-1, -0.12, oz * 0.12).applyMatrix4(rot).normalize()
      rebar(k, [start.x, start.y + y0, start.z], [dir.x, dir.y, dir.z], 0.16 + rand(seed, oy + 2, oz + 2) * 0.1 + v * 0.01, 0.03 + rand(seed, oz + 2, oy + 2) * 0.05, seed + oy * 3 + oz, [w / 2 + 0.06, d / 2 + 0.06])
    }
  },
}
