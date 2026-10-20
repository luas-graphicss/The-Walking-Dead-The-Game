import { createNoise3D } from 'simplex-noise'
import {
  GUARDRAIL, type LeafSpec, type LogSpec, STUMP_BURIED, STUMP_FLARE, type StoneSpec, type StumpSpec, TILE, type TwigSpec,
} from '../../lib/game/assets/catalog'
import { Model, type Part, type Vec2, type Vec3, add, cross, dot, length, lerp3, normalize, scale, sub, triangulatePolygon } from './mesh'
import type { LeafRect } from './textures'

export function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fbm(noise: (x: number, y: number, z: number) => number, p: Vec3, octaves: number) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise(p[0] * freq, p[1] * freq, p[2] * freq) * amp
    norm += amp; amp *= 0.5; freq *= 2.03
  }
  return sum / norm
}

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
const TAU = Math.PI * 2

export type StoneChart = { face: number; n: number; ids: number[]; cell: { x: number; y: number; size: number } }

export type StoneShape = { cuts: number; cutDepth: [number, number]; roundness: number; lumpy: number; detail: number; top?: number }

const FACES: { f: Vec3; u: Vec3; v: Vec3 }[] = [
  { f: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { f: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { f: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { f: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { f: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { f: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
]

export function stone(name: string, spec: StoneSpec, seed: number, n: number, shape: StoneShape, material: string, layout: { width: number; height: number; cells: { x: number; y: number; size: number }[]; gutter: number }) {
  const rng = random(seed)
  const noise = createNoise3D(random(seed ^ 0x9e3779b9))
  const { tall, deep } = spec
  const support = (d: Vec3) => Math.hypot(d[0], tall * d[1], deep * d[2])
  const planes = Array.from({ length: shape.cuts }, () => {
    let d: Vec3
    do d = normalize([rng() * 2 - 1, rng() * 1.6 - 0.45, rng() * 2 - 1]); while (d[1] < -0.3)
    return { n: d, o: support(d) * (shape.cutDepth[0] + rng() * (shape.cutDepth[1] - shape.cutDepth[0])) }
  })
  if (shape.top) planes.push({ n: [0, 1, 0], o: shape.top * tall })
  const offset: Vec3 = [rng() * 100, rng() * 100, rng() * 100]
  const radius = (d: Vec3) => {
    let r = 1 / Math.sqrt(d[0] ** 2 + (d[1] / tall) ** 2 + (d[2] / deep) ** 2)
    for (const plane of planes) {
      const c = dot(d, plane.n)
      if (c > 1e-3) r = smin(r, plane.o / c, shape.roundness)
    }
    if (d[1] < -1e-3) r = smin(r, (0.6 * tall) / -d[1], shape.roundness * 0.6)
    const q = add(scale(d, 1.35), offset)
    return r * (1 + shape.lumpy * fbm(noise, q, 3) + shape.detail * fbm(noise, scale(q, 3.4), 3))
  }
  const model = new Model(name)
  const part = model.part(material)
  const charts: StoneChart[] = []
  FACES.forEach((face, f) => {
    const cell = layout.cells[f]
    const inner = cell.size - 2 * layout.gutter
    const ids: number[] = []
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const s = (2 * i) / n - 1, t = (2 * j) / n - 1
      const c: Vec3 = [face.f[0] + s * face.u[0] + t * face.v[0], face.f[1] + s * face.u[1] + t * face.v[1], face.f[2] + s * face.u[2] + t * face.v[2]]
      const [x, y, z] = c
      const d = normalize([
        x * Math.sqrt(Math.max(0, 1 - y * y / 2 - z * z / 2 + (y * y * z * z) / 3)),
        y * Math.sqrt(Math.max(0, 1 - z * z / 2 - x * x / 2 + (z * z * x * x) / 3)),
        z * Math.sqrt(Math.max(0, 1 - x * x / 2 - y * y / 2 + (x * x * y * y) / 3)),
      ])
      const a = i / n, b = 1 - j / n
      ids.push(part.vertex(scale(d, radius(d)), [(cell.x + layout.gutter + a * inner) / layout.width, (cell.y + layout.gutter + b * inner) / layout.height]))
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v00 = ids[j * (n + 1) + i], v10 = v00 + 1, v01 = v00 + n + 1, v11 = v01 + 1

      if (length(sub(part.position(v00), part.position(v11))) <= length(sub(part.position(v10), part.position(v01)))) {
        part.triangle(v00, v10, v11); part.triangle(v00, v11, v01)
      } else {
        part.triangle(v00, v10, v01); part.triangle(v10, v11, v01)
      }
    }
    charts.push({ face: f, n, ids, cell })
  })
  return { model, charts }
}

type Ring = { center: Vec3; e1: Vec3; e2: Vec3; radius: (theta: number) => number; v: number }

function loft(part: Part, rings: Ring[], m: number, uRepeat: number, group: number, skip?: (k: number, j: number) => boolean) {
  const grid: number[][] = rings.map((ring) => {
    const row: number[] = []
    for (let j = 0; j <= m; j++) {
      const theta = (TAU * (j % m)) / m
      const r = ring.radius(theta)
      const p = add(ring.center, add(scale(ring.e1, Math.cos(theta) * r), scale(ring.e2, Math.sin(theta) * r)))
      row.push(part.vertex(p, [(j / m) * uRepeat, ring.v], group))
    }
    return row
  })
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < m; j++) {
    if (skip?.(k, j)) continue
    const a = grid[k][j], b = grid[k][j + 1], c = grid[k + 1][j], d = grid[k + 1][j + 1]
    part.triangle(a, b, c); part.triangle(b, d, c)
  }
  return grid
}

export function capEnd(part: Part, ring: Vec3[], center: Vec3, frame: { right: Vec3; up: Vec3 }, radius: number, facingForward: boolean, group: number) {
  const uv = (p: Vec3): Vec2 => {
    const d = sub(p, center)
    return [0.5 + 0.47 * dot(d, frame.right) / radius, 0.5 - 0.47 * dot(d, frame.up) / radius]
  }
  const outer = ring.map((p) => part.vertex(p, uv(p), group))
  const inner = ring.map((p) => {
    const q = lerp3(center, p, 0.52)
    return part.vertex(q, uv(q), group)
  })
  const c = part.vertex(center, uv(center), group)
  const n = ring.length
  for (let j = 0; j < n; j++) {
    const o0 = outer[j], o1 = outer[(j + 1) % n], i0 = inner[j], i1 = inner[(j + 1) % n]
    if (facingForward) { part.triangle(i0, o0, o1); part.triangle(i0, o1, i1); part.triangle(c, i0, i1) }
    else { part.triangle(i0, o1, o0); part.triangle(i0, i1, o1); part.triangle(c, i1, i0) }
  }
}

type ExtrudeOptions = {

  dir: Vec3
  bend: number

  droop?: number
  rings: { at: number; radius: number }[]
  tip: number
  uRepeat: number
  vScale: number
  group: number
}

function extrude(part: Part, grid: number[][], k: number, j: number, opts: ExtrudeOptions) {
  const loop = [[k - 1, j - 1], [k - 1, j], [k - 1, j + 1], [k, j + 1], [k + 1, j + 1], [k + 1, j], [k + 1, j - 1], [k, j - 1]].map(([kk, jj]) => part.position(grid[kk][jj]))
  const base = part.position(grid[k][j])
  const around = sub(part.position(grid[k][j + 1]), part.position(grid[k][j - 1]))
  const along = sub(part.position(grid[k + 1][j]), part.position(grid[k - 1][j]))
  const normal = normalize(cross(around, along))
  const target = normalize(opts.dir)
  const heading = (at: number) => {
    const t = Math.min(1, Math.max(0, at / opts.bend))
    return normalize(lerp3(normal, target, t * t * (3 - 2 * t)))
  }
  const segments = 8
  const angles = Array.from({ length: segments }, (_, q) => ((-135 + 45 * q) * Math.PI) / 180)
  const uOf = (q: number) => (q / segments) * opts.uRepeat

  let e1 = normalize(sub(around, scale(normal, dot(around, normal))))
  let center = base, travelled = 0
  const advance = (to: number) => {
    const steps = 6
    for (let s = 0; s < steps; s++) {
      const a = travelled + ((to - travelled) * (s + 0.5)) / steps
      center = add(center, scale(heading(a), (to - travelled) / steps))
    }
    travelled = to
  }
  const sag = (at: number): Vec3 => [0, -(opts.droop ?? 0) * at * at, 0]
  const rows: { points: Vec3[]; v: number }[] = opts.rings.map((ring) => {
    advance(ring.at)

    const tangent = normalize(add(heading(ring.at), [0, -2 * (opts.droop ?? 0) * ring.at, 0]))
    e1 = normalize(sub(e1, scale(tangent, dot(e1, tangent))))
    const e2 = cross(tangent, e1)
    const c = add(center, sag(ring.at))
    return { points: angles.map((angle) => add(c, add(scale(e1, Math.cos(angle) * ring.radius), scale(e2, Math.sin(angle) * ring.radius)))), v: ring.at / opts.vScale }
  })

  const swell = opts.rings[0].at * 0.1
  rows.unshift({ points: loop.map((p, q) => add(lerp3(p, rows[0].points[q], 0.5), scale(normal, swell))), v: rows[0].v * 0.5 })
  let previous = [...loop.map((p, q) => part.vertex(p, [uOf(q), 0], opts.group)), part.vertex(loop[0], [uOf(segments), 0], opts.group)]
  for (const { points, v } of rows) {
    const row = points.map((p, q) => part.vertex(p, [uOf(q), v], opts.group))
    row.push(part.vertex(points[0], [uOf(segments), v], opts.group))
    for (let q = 0; q < segments; q++) {
      part.triangle(previous[q], previous[q + 1], row[q])
      part.triangle(previous[q + 1], row[q + 1], row[q])
    }
    previous = row
  }
  const end = travelled + opts.tip
  advance(end)
  const apex = part.vertex(add(center, sag(end)), [opts.uRepeat / 2, end / opts.vScale], opts.group)
  for (let q = 0; q < segments; q++) part.triangle(previous[q], previous[q + 1], apex)
}

export function stations(length: number, spacing: number, features: number[], half: number) {
  const count = Math.max(2, Math.round(length / spacing))
  const out: number[] = []
  for (let k = 0; k <= count; k++) {
    const x = (k / count) * length
    if (k === 0 || k === count || features.every((f) => Math.abs(x - f) > half * 1.9)) out.push(x)
  }
  for (const f of features) out.push(f - half, f, f + half)
  return out.sort((a, b) => a - b)
}

const patchKey = (k: number, j: number) => `${k},${j}`
function patchSkips(patches: [number, number][]) {
  const skip = new Set<string>()
  for (const [k, j] of patches) for (const dk of [-1, 0]) for (const dj of [-1, 0]) skip.add(patchKey(k + dk, j + dj))
  return (k: number, j: number) => skip.has(patchKey(k, j))
}

const X: Vec3 = [1, 0, 0], Y: Vec3 = [0, 1, 0], Z: Vec3 = [0, 0, 1]

function barkProfile(noise: (x: number, y: number, z: number) => number, base: number, along: number, amount: number) {
  return (theta: number) => base * (1 + amount * (0.6 * noise(Math.cos(theta) * 1.4, Math.sin(theta) * 1.4, along * 0.9) + 0.4 * noise(Math.cos(theta) * 3.1, Math.sin(theta) * 3.1, along * 2.3 + 9)))
}

export function fallenLog(spec: LogSpec, seed: number) {
  const rng = random(seed)
  const noise = createNoise3D(random(seed ^ 0x51ed))
  const model = new Model(spec.name)
  const bark = model.part('bark'), grain = model.part('endgrain')
  const { length: L, radius: R } = spec
  const m = 16
  const bow = (rng() - 0.5) * 0.05 * L, phase = rng() * TAU
  const tilt = [(rng() - 0.5) * 0.24, (rng() - 0.5) * 0.24, (rng() - 0.5) * 0.24, (rng() - 0.5) * 0.24]
  const uRepeat = Math.max(2, Math.round((TAU * R) / TILE.bark))
  const radiusAt = (t: number) => R * (1.08 - 0.2 * t) * (1 + 0.035 * Math.sin(t * 7 + phase))

  const endRing = (p: Vec3, end: 0 | 1) => tilt[end * 2] * p[1] + tilt[end * 2 + 1] * p[2]

  const half = Math.max(0.05, R * 0.39)
  const wanted = L < 5 ? 2 : L < 8 ? 3 : 4
  const features: number[] = []
  for (let s = 0; s < wanted; s++) {
    const f = L * (0.14 + (0.72 * (s + 0.2 + rng() * 0.6)) / wanted)
    if (features.every((g) => Math.abs(g - f) > 6 * half)) features.push(f)
  }
  const xs = stations(L, 0.24, features, half)
  const rings: Ring[] = xs.map((along) => {
    const t = along / L, x = -L / 2 + along, r = radiusAt(t)

    const center: Vec3 = [x, r - R, bow * (1 - (2 * t - 1) ** 2) + 0.0045 * L * Math.sin(t * 4.1 + phase)]
    return { center, e1: Y, e2: Z, radius: barkProfile(noise, r, x, 0.06), v: x / TILE.bark }
  })
  const count = rings.length - 1
  const allowed = [1, 2, 3, 4, 12, 13, 14, 15]
  const stubs: [number, number][] = features.map((f) => [xs.indexOf(f), allowed[Math.floor(rng() * allowed.length)]])
  const grid = loft(bark, rings, m, uRepeat, 0, patchSkips(stubs))

  for (const [k, end] of [[0, 0], [count, 1]] as const) for (const id of grid[k]) {
    const p = bark.position(id)
    bark.positions[id * 3] = p[0] + endRing(sub(p, rings[k].center), end)
  }
  for (const [k, j] of stubs) {
    const outward = normalize(sub(bark.position(grid[k][j]), rings[k].center))
    const lean = 0.35 + rng() * 0.25
    extrude(bark, grid, k, j, {
      dir: normalize(add(scale(outward, Math.cos(lean)), scale(X, Math.sin(lean)))), bend: 0.5 * R,
      rings: [{ at: 0.2 * R, radius: 0.33 * R }, { at: 0.55 * R, radius: 0.27 * R }, { at: 0.95 * R, radius: 0.2 * R }],
      tip: 0.45 * R, uRepeat: 1, vScale: TILE.bark, group: 0,
    })
  }
  for (const [k, forward] of [[0, false], [count, true]] as const) {
    const ring = grid[k].slice(0, m).map((id) => bark.position(id))
    const center = add(rings[k].center, [endRing([0, 0, 0], forward ? 1 : 0), 0, 0])
    const maxRadius = Math.max(...ring.map((p) => length(sub(p, center))))
    capEnd(grain, ring, center, forward ? { right: [0, 0, -1], up: Y } : { right: Z, up: Y }, maxRadius, forward, forward ? 2 : 1)
  }
  return model
}

export function uprootedLog(spec: LogSpec, seed: number) {
  const rng = random(seed)
  const noise = createNoise3D(random(seed ^ 0x77aa))
  const model = new Model(spec.name)
  const bark = model.part('bark'), soil = model.part('soil'), grain = model.part('endgrain')
  const { length: L, radius: R } = spec
  const P = spec.plate ?? R * 3.3, D = spec.plateDepth ?? 0.6
  const m = 24, x0 = -L / 2
  const lobes = [rng() * TAU, rng() * TAU, rng() * TAU]
  const lobe = (theta: number, amount: number) => 1 + amount * (0.16 * Math.sin(3 * theta + lobes[0]) + 0.1 * Math.sin(5 * theta + lobes[1]) + 0.05 * Math.sin(8 * theta + lobes[2]))
  const meanRadius = (x: number) => R * (1.06 - 0.18 * ((x - x0) / L))
  const trunkProfile = (x: number) => barkProfile(noise, meanRadius(x), x, 0.06)

  const axisY = (x: number) => meanRadius(x) - R

  const plate: [number, number, number][] = [
    [x0 - D - 0.06, 0.26, 0.4], [x0 - D - 0.02, 0.58, 0.8], [x0 - D + 0.04, 0.86, 1],
    [x0 - D * 0.62, 1, 1], [x0 - D * 0.3, 0.98, 1], [x0 - 0.1, 0.84, 0.9],
    [x0 - 0.05, 0.6, 0.7], [x0 - 0.01, 0.42, 0.5], [x0 + 0.06, 0.3, 0.3],
  ]
  const SOIL_TILE = 0.6
  let arc = 0
  const soilRings: Ring[] = plate.map(([x, share, amount], k) => {
    if (k > 0) arc += Math.hypot(x - plate[k - 1][0], P * (share - plate[k - 1][1]))
    return {
      center: [x, 0, 0], e1: Y, e2: Z, v: arc / SOIL_TILE,
      radius: (theta: number) => Math.max(P * share * lobe(theta, amount), R * 1.05),
    }
  })

  const flareStart = x0 + 0.06, flareEnd = x0 + 0.62
  for (let k = 1; k <= 3; k++) {
    const t = k / 3, x = flareStart + (flareEnd - flareStart) * t
    const from = soilRings[soilRings.length - 1].radius
    const to = trunkProfile(x)
    const blend = 1 - (1 - t) ** 2
    arc += Math.hypot((flareEnd - flareStart) / 3, P * 0.3 * (1 - blend))
    soilRings.push({ center: [x, axisY(x) * blend, 0], e1: Y, e2: Z, v: arc / SOIL_TILE, radius: (theta) => from(theta) * (1 - blend) + to(theta) * blend })
  }

  const rootPatches: [number, number][] = []
  for (const [k, js] of [[1, [2, 8, 14, 20]], [3, [5, 11, 17, 23]]] as const) for (const j of js) if (rng() < 0.85) rootPatches.push([k, j])
  const soilGrid = loft(soil, soilRings, m, 6, 0, patchSkips(rootPatches))

  const apex = soil.vertex([x0 - D - 0.1, 0, 0], [1.5, -0.1], 0)
  for (let j = 0; j < m; j++) soil.triangle(apex, soilGrid[0][j + 1], soilGrid[0][j])
  for (const [k, j] of rootPatches) {
    const point = soil.position(soilGrid[k][j])
    const radial = normalize([0, point[1], point[2]])
    const back = k <= 1 ? 0.7 : 0.2
    const reach = 0.55 + rng() * 0.4
    extrude(soil, soilGrid, k, j, {
      dir: normalize(add(scale(radial, 1 - back * 0.6), [-back, 0, 0])), bend: 0.25, droop: 0.3,

      rings: [{ at: k <= 1 ? 0.15 : 0.11, radius: k <= 1 ? 0.068 : 0.085 }, { at: 0.15 + reach * 0.3, radius: 0.048 }, { at: 0.15 + reach * 0.6, radius: 0.031 }, { at: 0.15 + reach * 0.88, radius: 0.018 }],
      tip: 0.045, uRepeat: 1, vScale: SOIL_TILE, group: 0,
    })
  }

  const trunkLength = L / 2 - flareEnd
  const half = Math.max(0.05, R * 0.26)
  const features = [trunkLength * 0.45, trunkLength * 0.75]
  const xs = stations(trunkLength, 0.24, features, half)
  const lastSoil = soilRings[soilRings.length - 1]
  const trunkRings: Ring[] = xs.map((along, k) => {
    if (k === 0) return { ...lastSoil, v: flareEnd / TILE.bark }
    const x = flareEnd + along
    return { center: [x, axisY(x), 0], e1: Y, e2: Z, radius: trunkProfile(x), v: x / TILE.bark }
  })
  const count = trunkRings.length - 1
  const uRepeat = Math.max(2, Math.round((TAU * R) / TILE.bark))
  const stubs: [number, number][] = [[xs.indexOf(features[0]), 4], [xs.indexOf(features[1]), 21]]
  const trunkGrid = loft(bark, trunkRings, m, uRepeat, 0, patchSkips(stubs))
  for (const [k, j] of stubs) {
    const outward = normalize(sub(bark.position(trunkGrid[k][j]), trunkRings[k].center))
    extrude(bark, trunkGrid, k, j, {
      dir: normalize(add(scale(outward, Math.cos(0.45)), scale(X, Math.sin(0.45)))), bend: 0.5 * R,
      rings: [{ at: 0.2 * R, radius: 0.24 * R }, { at: 0.55 * R, radius: 0.2 * R }, { at: 0.95 * R, radius: 0.15 * R }],
      tip: 0.4 * R, uRepeat: 1, vScale: TILE.bark, group: 0,
    })
  }
  const end = trunkGrid[count].slice(0, m).map((id) => bark.position(id))
  const center = trunkRings[count].center
  capEnd(grain, end, center, { right: [0, 0, -1], up: Y }, Math.max(...end.map((p) => length(sub(p, center)))), true, 2)
  return model
}

export function stump(spec: StumpSpec, seed: number, broken: boolean) {
  const rng = random(seed)
  const noise = createNoise3D(random(seed ^ 0x3c3c))
  const model = new Model(spec.name)
  const bark = model.part('bark')
  const { radius: R, height: H } = spec
  const m = 16
  const roots = rng() * TAU
  const buttress = (theta: number) => 0.3 + 0.7 * Math.max(0, Math.cos(5 * (theta + roots))) ** 1.6

  const shares = broken ? [0.06, 0.14, 0.25, 0.4, 0.55, 1] : [0.06, 0.14, 0.25, 0.4, 0.6, 0.8, 1]
  const heights = [-STUMP_BURIED, -0.26, -0.1, 0, ...shares.map((t) => t * H)]
  const uRepeat = Math.max(2, Math.round((TAU * R) / TILE.bark))
  const tiltA = (rng() - 0.5) * 0.3, tiltB = (rng() - 0.5) * 0.3
  const jag = (theta: number) => (broken ? 0.18 * H * (0.5 + 0.5 * Math.sin(theta * 3 + roots)) + 0.08 * H * (0.5 + 0.5 * noise(Math.cos(theta) * 4, Math.sin(theta) * 4, 3)) : 0)
  const rings: Ring[] = heights.map((y, k) => {
    const flare = (STUMP_FLARE - 1) * Math.min(1, Math.max(0, (0.55 * H - y) / (0.55 * H))) ** 2.2
    const top = k === heights.length - 1
    return {
      center: [0, y, 0], e1: Z, e2: X, v: y / TILE.bark,
      radius: (theta: number) => R * (1 + flare * buttress(theta)) * (1 + 0.05 * noise(Math.cos(theta) * 2, Math.sin(theta) * 2, y * 3)) * (top && broken ? 0.97 : 1),
    }
  })
  const grid = loft(bark, rings, m, uRepeat, 0)
  const topRow = grid[grid.length - 1]
  for (let j = 0; j <= m; j++) {
    const id = topRow[j], p = bark.position(id), theta = (TAU * (j % m)) / m
    bark.positions[id * 3 + 1] = broken ? H - jag(theta) : H + tiltA * p[0] + tiltB * p[2]
  }
  const ring = topRow.slice(0, m).map((id) => bark.position(id))
  if (broken) {

    const wood = model.part('deadwood')
    const uv = (p: Vec3): Vec2 => [0.5 + p[0] / (2 * R * 1.2), 0.5 - p[2] / (2 * R * 1.2)]
    const outer = ring.map((p) => wood.vertex(p, uv(p), 3))
    const inner = ring.map((p, j) => {
      const q: Vec3 = [p[0] * 0.55, H - 0.05 * H - 0.2 * H * (0.5 + 0.5 * Math.sin(j * 2.3 + roots)), p[2] * 0.55]
      return wood.vertex(q, uv(q), 3)
    })
    const core = wood.vertex([0, H - 0.22 * H, 0], [0.5, 0.5], 3)
    for (let j = 0; j < m; j++) {
      const o0 = outer[j], o1 = outer[(j + 1) % m], i0 = inner[j], i1 = inner[(j + 1) % m]
      wood.triangle(i0, o0, o1); wood.triangle(i0, o1, i1); wood.triangle(core, i0, i1)
    }
  } else {
    const grain = model.part('endgrain')
    const center: Vec3 = [0, H, 0]
    capEnd(grain, ring, center, { right: X, up: [0, 0, -1] }, Math.max(...ring.map((p) => Math.hypot(p[0], p[2]))), true, 3)
  }

  const bottom = grid[0].slice(0, m)
  const underside = bark.vertex([0, -STUMP_BURIED, 0], [0, -STUMP_BURIED / TILE.bark], 4)
  const below = bottom.map((id) => bark.vertex(bark.position(id), [bark.uvs[id * 2], bark.uvs[id * 2 + 1] + 0.3], 4))
  for (let j = 0; j < m; j++) bark.triangle(underside, below[(j + 1) % m], below[j])
  return model
}

export function twig(spec: TwigSpec, seed: number, kind: 'straight' | 'bent' | 'forked') {
  const rng = random(seed)
  const model = new Model(spec.name)
  const wood = model.part('deadwood')
  const L = spec.length, r0 = spec.thick / 2
  const m = kind === 'forked' ? 8 : 6
  const bend = kind === 'bent' ? 0.12 * L : 0.03 * L
  const kinks = [rng() * TAU, rng() * TAU]
  const radiusAt = (t: number) => r0 * (1 - 0.7 * t ** 1.15)
  const vScale = TAU * r0
  const fork = 0.42 * L
  const xs = stations(L, L / 12, kind === 'forked' ? [fork] : [], radiusAt(0.42) * 0.8)
  const rings: Ring[] = xs.map((along) => {
    const t = along / L, x = -L / 2 + along, r = radiusAt(t)
    const z = bend * (1 - (2 * t - 1) ** 2) * (kind === 'bent' ? 1 : Math.sin(kinks[0])) + 0.006 * L * Math.sin(t * 9 + kinks[1])
    return { center: [x, -r0 + r, z], e1: Y, e2: Z, radius: () => r, v: x / vScale }
  })
  const count = rings.length - 1
  const patch: [number, number] = [xs.indexOf(fork), 2]
  const grid = loft(wood, rings, m, 1, 0, kind === 'forked' ? patchSkips([patch]) : undefined)
  if (kind === 'forked') {
    const r = radiusAt(0.42), rb = r * 0.68
    const reach = 0.45 * L
    const steps = [0.012, 0.05, 0.38 * reach, 0.68 * reach, 0.96 * reach]
    const tip = 3 * rb * 0.36
    extrude(wood, grid, patch[0], 2, {
      dir: normalize([Math.cos(0.75), 0, Math.sin(0.75)]), bend: 3 * rb,
      rings: steps.map((at, i) => ({ at, radius: rb * [1, 0.92, 0.72, 0.52, 0.36][i] })),

      tip, uRepeat: 1, vScale, group: 0, droop: r / (steps[4] + tip) ** 2,
    })
  }

  const base = grid[0].slice(0, m).map((id) => wood.position(id))
  capEnd(wood, base, rings[0].center, { right: Z, up: Y }, r0 * 1.05, false, 1)
  const tipCenter = add(rings[count].center, [radiusAt(1) * 2.5, 0, 0])
  const apex = wood.vertex(tipCenter, [0.5, (L / 2 + radiusAt(1) * 2.5) / vScale], 0)
  for (let j = 0; j < m; j++) wood.triangle(grid[count][j], grid[count][j + 1], apex)
  return model
}

export function leaf(spec: LeafSpec, rect: LeafRect, seed: number, aspect: number) {
  const rng = random(seed)
  const model = new Model(spec.name, false)
  const part = model.part('leaves')
  const L = spec.length, W = L * aspect
  const fold = 0.12 + rng() * 0.1, curl = 0.1 + rng() * 0.12, twist = (rng() - 0.5) * 0.06
  const nx = 5, ny = 3
  const ids: number[] = []
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const a = i / (nx - 1), b = j / (ny - 1)
    const x = (a - 0.5) * L, z = (b - 0.5) * W
    const y = fold * Math.abs(2 * b - 1) * W * 0.5 + curl * (2 * a - 1) ** 2 * L * 0.3 + twist * (2 * a - 1) * (2 * b - 1) * L * 0.5
    ids.push(part.vertex([x, y, z], [rect.u0 + b * (rect.u1 - rect.u0), rect.v1 - a * (rect.v1 - rect.v0)]))
  }
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) {
    const v00 = ids[i * ny + j], v01 = ids[i * ny + j + 1], v10 = ids[(i + 1) * ny + j], v11 = ids[(i + 1) * ny + j + 1]
    part.triangle(v00, v01, v11); part.triangle(v00, v11, v10)
  }

  let low = Infinity
  for (let i = 1; i < part.positions.length; i += 3) low = Math.min(low, part.positions[i])
  for (let i = 1; i < part.positions.length; i += 3) part.positions[i] -= low
  return model
}

function prism(part: Part, profile: Vec2[], y0: number, y1: number, tile: number, groupBase: number, caps = { top: true, bottom: true }) {
  let perimeter = 0
  profile.forEach((p, i) => {
    const q = profile[(i + 1) % profile.length]
    const edge = Math.hypot(q[0] - p[0], q[1] - p[1])
    const a = part.vertex([p[0], y0, p[1]], [perimeter / tile, -y0 / tile], groupBase + i)
    const b = part.vertex([q[0], y0, q[1]], [(perimeter + edge) / tile, -y0 / tile], groupBase + i)
    const c = part.vertex([q[0], y1, q[1]], [(perimeter + edge) / tile, -y1 / tile], groupBase + i)
    const d = part.vertex([p[0], y1, p[1]], [perimeter / tile, -y1 / tile], groupBase + i)
    part.triangle(a, b, c); part.triangle(a, c, d)
    perimeter += edge
  })
  const flat = profile.map(([x, z]) => [z, x] as Vec2)
  const triangles = triangulatePolygon(flat)
  if (caps.top) {
    const top = profile.map(([x, z]) => part.vertex([x, y1, z], [x / tile, z / tile], groupBase + 100))
    for (const [a, b, c] of triangles) part.triangle(top[a], top[b], top[c])
  }
  if (caps.bottom) {
    const bottom = profile.map(([x, z]) => part.vertex([x, y0, z], [x / tile, -z / tile], groupBase + 101))
    for (const [a, b, c] of triangles) part.triangle(bottom[a], bottom[c], bottom[b])
  }
}

export function guardrailPost() {
  const model = new Model(GUARDRAIL.post)
  const steel = model.part('steel')
  const bf = GUARDRAIL.postFlange, d = GUARDRAIL.postDepth, tf = d * 0.06, tw = d * 0.047
  const h = d / 2
  const profile: Vec2[] = [
    [-bf / 2, h], [bf / 2, h], [bf / 2, h - tf], [tw / 2, h - tf], [tw / 2, -h + tf], [bf / 2, -h + tf],
    [bf / 2, -h], [-bf / 2, -h], [-bf / 2, -h + tf], [-tw / 2, -h + tf], [-tw / 2, h - tf], [-bf / 2, h - tf],
  ]
  prism(steel, profile, GUARDRAIL.postBottom, GUARDRAIL.postTop, TILE.steel, 0)
  const bw = bf * 0.42, front = h + GUARDRAIL.blockout, reach = GUARDRAIL.railHeight * 0.55
  const block: Vec2[] = [[-bw, front], [bw, front], [bw, h], [-bw, h]]
  prism(steel, block, GUARDRAIL.railCenter - reach, GUARDRAIL.railCenter + reach, TILE.steel, 200)
  return model
}
