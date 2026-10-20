import { TREE_BURIED, type GrassSpec, type TreeSpec } from '../../lib/game/assets/catalog'
import { Model, Part, type Vec3, add, sub, scale, dot, cross, length, normalize, lerp3, segmentCrossesTriangle, coplanarOverlap } from './mesh'
import { capEnd, random, stations } from './models'
import { profileReach, type CardRect } from './textures'

const TAU = Math.PI * 2
const Y: Vec3 = [0, 1, 0]
type Ring = { center: Vec3; e1: Vec3; e2: Vec3; radius: number; v: number; profile?: (angle: number) => number }

type Segment = { v: number; distance: number; perimeter: number }
type Skin = { grid: number[][]; rings: Ring[]; part: Part; sides: number; segments: Segment[]; group: number }
type Attachment = { point: Vec3; direction: Vec3; outward: Vec3; size: number }
const key = (p: Vec3) => p.map((v) => Math.round(v * 1e5)).join(',')

function patchMask(patches: [number, number][]) {
  const omitted = new Set<string>()
  for (const [k, j] of patches) for (const dk of [-1, 0]) for (const dj of [-1, 0]) omitted.add(`${k + dk}:${j + dj}`)
  return omitted
}

function skin(part: Part, rings: Ring[], sides: number, tile: number, patches: [number, number][], group: number, outline?: Vec3[]): Skin {
  const omitted = patchMask(patches)
  const points = rings.map((ring, k) => k === 0 && outline ? outline : Array.from({ length: sides }, (_, j) => {
    const angle = TAU * j / sides + (outline ? -Math.PI * 0.75 : 0)
    const r = ring.radius * (ring.profile?.(angle) ?? 1)
    return add(ring.center, add(scale(ring.e1, Math.cos(angle) * r), scale(ring.e2, Math.sin(angle) * r)))
  }))
  if (outline) points[1] = outline.map((p, j) => lerp3(p, points[2][j], 0.5))
  const rows = points.map((row, k) => Array.from({ length: sides + 1 }, (_, j) => part.vertex(row[j % sides], [j / sides, rings[k].v / tile], group)))
  const segments: Segment[] = []
  let v = rings[0].v / tile
  for (let k = 0; k < rows.length - 1; k++) {
    const distance = points[k].reduce((sum, p, j) => sum + length(sub(points[k + 1][j], p)), 0) / sides / tile
    const perimeter = [k, k + 1].reduce((sum, row) => sum + points[row].reduce((s, p, j) => s + length(sub(points[row][(j + 1) % sides], p)), 0), 0) / 2 / tile
    segments.push({ v, distance, perimeter })
    const first = Array.from({ length: sides + 1 }, (_, j) => part.vertex(points[k][j % sides], [(j / sides - 0.5) * perimeter + 0.5, v], group))
    const next = Array.from({ length: sides + 1 }, (_, j) => part.vertex(points[k + 1][j % sides], [(j / sides - 0.5) * perimeter + 0.5, v + distance], group))
    for (let j = 0; j < sides; j++) {
      if (omitted.has(`${k}:${j}`)) continue
      const a = first[j], b = first[j + 1], c = next[j], d = next[j + 1]
      part.triangle(a, b, c); part.triangle(b, d, c)
    }
    v += distance
  }
  return { grid: rows, rings, part, sides, segments, group }
}

function plug(surface: Skin, k: number, j: number) {
  const part = new Part(), { grid, sides, segments, group } = surface
  const at = (row: number, column: number) => surface.part.position(grid[row][column])
  for (const kk of [k - 1, k]) {
    const { v, distance, perimeter } = segments[kk]
    const u = (column: number) => (column / sides - 0.5) * perimeter + 0.5
    for (const jj of [j - 1, j]) {
      const a = part.vertex(at(kk, jj), [u(jj), v], group), b = part.vertex(at(kk, jj + 1), [u(jj + 1), v], group)
      const c = part.vertex(at(kk + 1, jj), [u(jj), v + distance], group), d = part.vertex(at(kk + 1, jj + 1), [u(jj + 1), v + distance], group)
      part.triangle(a, b, c); part.triangle(b, d, c)
    }
  }
  return part
}

function capInto(target: Part, surface: Skin, at: number, forward: boolean, group: number) {
  const ring = surface.rings[at]
  const points = surface.grid[at].slice(0, surface.sides).map((id) => surface.part.position(id))
  capEnd(target, points, ring.center, { right: ring.e1, up: ring.e2 }, Math.max(...points.map((p) => length(sub(p, ring.center)))), forward, group)
}

function fanCap(target: Part, surface: Skin, at: number, group: number) {
  const ring = surface.rings[at]
  const points = surface.grid[at].slice(0, surface.sides).map((id) => surface.part.position(id))
  const radius = Math.max(1e-4, ...points.map((p) => length(sub(p, ring.center))))
  const uv = (p: Vec3): [number, number] => { const d = sub(p, ring.center); return [0.5 + 0.47 * dot(d, ring.e1) / radius, 0.5 - 0.47 * dot(d, ring.e2) / radius] }
  const outer = points.map((p) => target.vertex(p, uv(p), group)), c = target.vertex(ring.center, uv(ring.center), group)
  for (let j = 0; j < points.length; j++) target.triangle(c, outer[j], outer[(j + 1) % points.length])
}

type GrowOptions = { lod: number; tile: number; group: number; forkAt: number[]; droop: number; lateral: boolean; twig: boolean }
type Branch = { surface: Skin; patches: [number, number][]; tip: Vec3; direction: Vec3; extent: number; wood: Part; end: Part }

function grow(parent: Skin, k: number, j: number, target: Vec3, extent: number, o: GrowOptions): Branch {
  const loop = [[k - 1, j - 1], [k - 1, j], [k - 1, j + 1], [k, j + 1], [k + 1, j + 1], [k + 1, j], [k + 1, j - 1], [k, j - 1]].map(([a, b]) => parent.part.position(parent.grid[a][b]))
  const base = parent.part.position(parent.grid[k][j])
  const around = sub(loop[3], loop[7]), along = sub(loop[5], loop[1])
  const normal = normalize(cross(around, along))
  const radius = Math.min(length(around), length(along)) * 0.36
  const turn = Math.max(radius * 3, extent * 0.12)
  const direction = (at: number) => {
    const t = Math.min(1, at / turn)
    return normalize(add(lerp3(normal, target, t * t * (3 - 2 * t)), scale(Y, -o.droop * at / extent)))
  }
  const features = o.forkAt.map((f) => extent * f)
  const half = Math.max(0.005, radius * 0.44)
  const first = Math.min(radius * 1.35, extent * 0.055)
  const tail = o.twig ? (o.lod ? [extent] : [extent * 0.55, extent])
    : stations(extent, extent / (features.length ? (o.lod ? 4 : 4 + features.length) : o.lod ? 2 : 3), features, half).filter((at) => at > first * 1.8)
  const positions = [0, first * 0.5, first, ...tail]
  let center = base, previous = 0
  let e1 = normalize(sub(around, scale(normal, dot(around, normal))))
  const rings: Ring[] = positions.map((at, index) => {
    for (let s = 0; s < 8; s++) center = add(center, scale(direction(previous + (at - previous) * (s + 0.5) / 8), (at - previous) / 8))
    previous = at
    const tangent = direction(at)
    e1 = normalize(sub(e1, scale(tangent, dot(e1, tangent))))
    return { center, e1, e2: cross(tangent, e1), radius: Math.max(0.0035, radius * (1 - at / extent) ** 0.82), v: at, ...(index === 0 ? { profile: () => 1 } : {}) }
  })

  const patches: [number, number][] = features.map((at, index) => {
    const row = positions.indexOf(at)
    const up = dot(rings[row].e2, Y) >= 0 ? 5 : 1
    return [row, o.lateral ? (index % 2 ? 7 : 3) : [3, 7, up][index % 3]]
  })
  const wood = new Part(), end = new Part()
  const surface = skin(wood, rings, 8, o.tile, patches, o.group, loop)
  if (o.twig) fanCap(end, surface, rings.length - 1, o.group + 10_000)
  else capInto(end, surface, rings.length - 1, true, o.group + 10_000)
  return { surface, patches, tip: rings[rings.length - 1].center, direction: direction(extent), extent, wood, end }
}

type Triangle = { p: Vec3[]; keys: string[]; min: Vec3; max: Vec3; normal: Vec3 }
class SurfaceIndex {
  private cells = new Map<string, Triangle[]>()
  constructor(private cell: number) {}
  private triangles(part: Part) {
    const out: Triangle[] = []
    for (let i = 0; i < part.indices.length; i += 3) {
      const p = part.indices.slice(i, i + 3).map((id) => part.position(id))
      out.push({ p, keys: p.map(key), min: [0, 1, 2].map((a) => Math.min(...p.map((v) => v[a]))) as Vec3, max: [0, 1, 2].map((a) => Math.max(...p.map((v) => v[a]))) as Vec3, normal: normalize(cross(sub(p[1], p[0]), sub(p[2], p[0]))) })
    }
    return out
  }
  private *bins(t: Triangle) {
    for (let x = Math.floor(t.min[0] / this.cell); x <= Math.floor(t.max[0] / this.cell); x++)
      for (let y = Math.floor(t.min[1] / this.cell); y <= Math.floor(t.max[1] / this.cell); y++)
        for (let z = Math.floor(t.min[2] / this.cell); z <= Math.floor(t.max[2] / this.cell); z++) yield `${x}:${y}:${z}`
  }
  add(part: Part) {
    for (const t of this.triangles(part)) for (const cell of this.bins(t)) { const list = this.cells.get(cell) ?? []; list.push(t); this.cells.set(cell, list) }
  }

  intersects(part: Part) {
    for (const a of this.triangles(part)) {
      const checked = new Set<Triangle>()
      for (const cell of this.bins(a)) for (const b of this.cells.get(cell) ?? []) {
        if (checked.has(b)) continue
        checked.add(b)
        if ([0, 1, 2].some((k) => a.max[k] < b.min[k] || b.max[k] < a.min[k])) continue
        if (a.keys.some((k) => b.keys.includes(k))) continue
        const [p, q, r] = a.p, [s, t, u] = b.p
        if ([[p, q], [q, r], [r, p]].some(([v, w]) => segmentCrossesTriangle(v, w, s, t, u)) || [[s, t], [t, u], [u, s]].some(([v, w]) => segmentCrossesTriangle(v, w, p, q, r))) return true
        if (Math.abs(dot(a.normal, b.normal)) > 0.9995 && b.p.every((v) => Math.abs(dot(a.normal, sub(v, p))) < 1e-5) && coplanarOverlap(a.p, b.p, a.normal)) return true
      }
    }
    return false
  }
}

function append(target: Part, source: Part, group: number) {
  const offset = target.groups.length
  target.positions.push(...source.positions); target.uvs.push(...source.uvs)
  target.groups.push(...source.groups.map(() => group))
  target.indices.push(...source.indices.map((i) => i + offset))
}

const lowest = (part: Part) => { let y = Infinity; for (let i = 1; i < part.positions.length; i += 3) y = Math.min(y, part.positions[i]); return y }

function leafCard(root: Vec3, dir: Vec3, right: Vec3, size: number, rect: CardRect, droop: number) {
  const part = new Part()
  const fold = normalize(cross(right, dir))
  const span = rect.u1 - rect.u0, height = rect.v1 - rect.v0
  const rootId = part.vertex(root, [rect.stem, 1 - rect.v1])
  const rows = [0.12, 0.5, 1].map((t) => {
    const k = t <= 0.5 ? 0 : 1, a = (t - k * 0.5) * 2
    const left = rect.rows[k].left * (1 - a) + rect.rows[k + 1].left * a
    const rightExtent = rect.rows[k].right * (1 - a) + rect.rows[k + 1].right * a
    return [-left, 0, rightExtent].map((u, column) => {
      const center = add(root, add(scale(dir, t * size), scale(fold, Math.sin(t * Math.PI) * size * (column === 1 ? 0.045 : -0.016))))
      const sag = scale(Y, -droop * t * t * size)
      return part.vertex(add(add(center, sag), scale(right, u * size * rect.aspect)), [rect.stem + u * span, 1 - rect.v1 + t * height])
    })
  })
  part.triangle(rootId, rows[0][1], rows[0][0]); part.triangle(rootId, rows[0][2], rows[0][1])
  for (let k = 0; k < rows.length - 1; k++) for (let j = 0; j < 2; j++) {
    const a = rows[k][j], b = rows[k][j + 1], c = rows[k + 1][j], d = rows[k + 1][j + 1]
    part.triangle(a, b, c); part.triangle(b, d, c)
  }
  return part
}

type Mode = 'shingle' | 'fan' | 'flat' | 'hang'
type Profile = {
  bark: string; foliage: string | null; trunkTop: number; taper: (t: number) => number
  limbs: [number, number]; start: number; end: number
  reach: (h: number) => number; rise: (h: number) => number; droop: number
  forks: [number[], number[]]; child: number; childRise: number; childDroop: number
  card: number; reference: number; modes: Mode[]; center: number; vertical: number; cardDroop: number
}

const broadleafTaper = (t: number) => (1 - 0.9 * t ** 1.25) ** 0.85
const coniferTaper = (t: number) => (1 - t * 0.96) ** 0.8
const BROADLEAF_FORKS: [number[], number[]] = [[0.3, 0.46, 0.62, 0.77, 0.9], [0.45, 0.78]]

function profileOf(spec: TreeSpec): Profile {
  const wide = spec.crown / spec.height > 0.45
  switch (spec.foliage) {
    case 'oak': return {
      bark: 'bark', foliage: 'foliage_broadleaf', trunkTop: 0.88, taper: broadleafTaper, limbs: [17, 11], start: wide ? 0.24 : 0.3, end: 0.92,
      reach: (h) => (wide ? 0.6 : 0.5) + 0.26 * Math.sin(Math.PI * (0.15 + 0.75 * h)), rise: (h) => (wide ? 0.12 : 0.3) + (wide ? 0.75 : 0.95) * h, droop: 0.05,
      forks: BROADLEAF_FORKS, child: 0.4, childRise: 0.45, childDroop: 0.12,
      card: 2.1, reference: 5.4, modes: ['shingle', 'fan', 'shingle', 'fan', 'shingle', 'fan'], center: wide ? 0.55 : 0.6, vertical: wide ? 0.36 : 0.4, cardDroop: 0,
    }
    case 'maple': return {
      bark: 'bark', foliage: 'foliage_broadleaf', trunkTop: 0.88, taper: broadleafTaper, limbs: [18, 11], start: 0.32, end: 0.93,
      reach: (h) => 0.46 + 0.26 * Math.sin(Math.PI * (0.1 + 0.8 * h)), rise: (h) => 0.55 + 1.05 * h, droop: 0.04,
      forks: BROADLEAF_FORKS, child: 0.38, childRise: 0.6, childDroop: 0.1,
      card: 1.8, reference: 4.6, modes: ['shingle', 'fan', 'shingle', 'fan', 'shingle', 'fan'], center: 0.63, vertical: 0.39, cardDroop: 0,
    }
    case 'birch': return {
      bark: 'birch_bark', foliage: 'foliage_broadleaf', trunkTop: 0.92, taper: broadleafTaper, limbs: [18, 11], start: 0.35, end: 0.95,
      reach: (h) => 0.55 + 0.22 * Math.sin(Math.PI * h), rise: (h) => 1.0 + 0.9 * h, droop: 0.08,
      forks: [[0.32, 0.48, 0.62, 0.76, 0.9], [0.5, 0.8]], child: 0.42, childRise: -0.35, childDroop: 0.6,
      card: 1.35, reference: 3.6, modes: ['hang', 'shingle', 'fan', 'hang', 'shingle', 'fan'], center: 0.66, vertical: 0.36, cardDroop: 0.05,
    }
    case 'pine': return {
      bark: 'pine_bark', foliage: 'foliage_pine', trunkTop: 0.96, taper: coniferTaper, limbs: [24, 14], start: spec.height < 12 ? 0.24 : 0.48, end: 0.97,
      reach: (h) => 0.22 + 0.62 * (1 - h) ** 0.55, rise: (h) => 0.1 + 0.42 * h, droop: 0.12,
      forks: [[0.34, 0.5, 0.64, 0.78, 0.9], [0.5, 0.8]], child: 0.34, childRise: 0.35, childDroop: 0.1,
      card: 1.8, reference: 3.8, modes: ['fan', 'shingle', 'fan', 'shingle', 'fan', 'shingle'], center: spec.height < 12 ? 0.6 : 0.74, vertical: spec.height < 12 ? 0.36 : 0.26, cardDroop: 0.03,
    }
    case 'spruce': return {
      bark: 'pine_bark', foliage: 'foliage_pine', trunkTop: 0.97, taper: coniferTaper, limbs: [30, 17], start: 0.07, end: 0.97,
      reach: (h) => 0.1 + 0.86 * (1 - h) ** 1.05, rise: (h) => -0.12 + 0.36 * h, droop: 0.18,
      forks: [[0.26, 0.42, 0.58, 0.74, 0.88], [0.45, 0.78]], child: 0.4, childRise: -0.05, childDroop: 0.25,
      card: 1.9, reference: 3.5, modes: ['shingle', 'fan', 'shingle', 'flat', 'fan', 'shingle'], center: 0.46, vertical: 0.54, cardDroop: 0.08,
    }
    default: return {
      bark: 'deadwood', foliage: null, trunkTop: 1, taper: coniferTaper, limbs: [7, 7], start: 0.28, end: 0.91,
      reach: () => 0.55, rise: () => 0.8, droop: 0, forks: [[], []], child: 0, childRise: 0, childDroop: 0,
      card: 0, reference: 1, modes: [], center: 0.62, vertical: 0.3, cardDroop: 0,
    }
  }
}

const perpendicular = (v: Vec3) => normalize(cross(Math.abs(v[1]) > 0.9 ? [1, 0, 0] : Y, v))

function orient(mode: Mode, a: Attachment, out: Vec3, roll: number) {
  let dir: Vec3, right: Vec3, facing = out
  if (mode === 'shingle') {
    let up = sub(Y, scale(out, dot(Y, out)))
    if (length(up) < 0.25) up = sub(a.direction, scale(out, dot(a.direction, out)))
    up = normalize(up)
    const side = cross(out, up)
    dir = normalize(add(add(scale(up, Math.cos(roll)), scale(side, Math.sin(roll))), scale(out, 0.3)))
    right = cross(dir, out)
  } else if (mode === 'flat') {
    let h: Vec3 = [a.direction[0] + a.outward[0] * 0.7, 0, a.direction[2] + a.outward[2] * 0.7]
    if (length(h) < 1e-3) h = [out[0], 0, out[2]]
    if (length(h) < 1e-3) h = [1, 0, 0]
    h = normalize(h)
    const c = Math.cos(roll * 0.5), s = Math.sin(roll * 0.5)
    dir = normalize([h[0] * c - h[2] * s, 0.1, h[0] * s + h[2] * c])
    right = cross(Y, dir)
    facing = Y
  } else {
    const lean = mode === 'hang' ? add(add(scale(a.outward, 0.7), scale(out, 0.5)), scale(Y, -0.9)) : add(add(scale(a.direction, 0.65), scale(a.outward, 0.55)), scale(out, 0.4))
    dir = normalize(lean)
    const base = perpendicular(dir)
    right = add(scale(base, Math.cos(roll)), scale(cross(dir, base), Math.sin(roll)))
  }

  if (dot(dir, a.outward) < 0.1) dir = normalize(add(dir, scale(a.outward, 0.8)))
  right = normalize(sub(right, scale(dir, dot(right, dir))))
  if (dot(cross(right, dir), facing) < 0) right = scale(right, -1)
  return { dir, right }
}

export const CROWNS = new WeakMap<Model, { center: Vec3; radii: Vec3 }>()

function shuffle<T>(items: T[], rng: () => number) {
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]] }
  return items
}

export function tree(spec: TreeSpec, cards: CardRect[], lod = 0) {
  const rng = random(spec.seed)
  const P = profileOf(spec)
  const conifer = spec.foliage === 'pine' || spec.foliage === 'spruce'
  const model = new Model(spec.name + (lod ? '_lod1' : ''), true, { open: P.foliage ? [P.foliage] : [], audit: true })
  const wood = model.part(P.bark), endgrain = model.part('endgrain')
  const tile = conifer ? 0.8 : 0.6
  const H = spec.height * P.trunkTop, R = spec.trunk
  const sides = lod ? 12 : R > 0.3 ? 16 : 14
  const count = P.limbs[lod ? 1 : 0]
  const features = Array.from({ length: count }, (_, i) => H * (P.start + (P.end - P.start) * (i + 0.2) / count))
  const gap = features.length > 1 ? features[1] - features[0] : H * 0.2
  const half = Math.min(R * 0.42, gap * 0.28)
  const heights = [-TREE_BURIED, -0.16, 0, 0.18, ...stations(H, H / (lod ? 17 : 30), features, half).filter((v) => v > 0.3)]
  const phase = rng() * TAU, bend = R * 1.1
  const rings: Ring[] = heights.map((y) => {
    const t = Math.max(0, y / H)
    const basal = 1 + 0.48 * Math.exp(-Math.max(0, y) * 3.8)
    const r = Math.max(0.006, R * P.taper(t)) * basal
    return {
      center: [bend * Math.sin(t * 2.1) * t, y, bend * Math.sin(t * 3.4 + phase) * t],
      e1: [1, 0, 0], e2: [0, 0, -1], radius: r, v: y,
      profile: (angle) => 1 + (0.045 + 0.19 * Math.exp(-Math.max(0, y) * 2.8)) * Math.cos(angle * 5 + phase) + 0.018 * Math.sin(angle * 9 + t * 4),
    }
  })
  const patches: [number, number][] = features.map((h, i) => [heights.indexOf(h), 1 + Math.floor(((i * 0.381966 + phase / TAU) % 1) * (sides - 2))])
  const trunk = skin(wood, rings, sides, tile, patches, 0)
  capInto(endgrain, trunk, 0, false, 1000)
  capInto(endgrain, trunk, rings.length - 1, true, 1001)
  const index = new SurfaceIndex(0.6)
  index.add(wood); index.add(endgrain)

  const fits = (branch: Branch) => !index.intersects(branch.wood) && !index.intersects(branch.end)
  const commit = (branch: Branch) => {
    append(wood, branch.wood, branch.surface.group); append(endgrain, branch.end, branch.surface.group + 10_000)
    index.add(branch.wood); index.add(branch.end)
  }
  const close = (surface: Skin, k: number, j: number) => { const part = plug(surface, k, j); append(wood, part, surface.group); index.add(part) }

  const anchors = (branch: Branch, from: number, sidesUsed: number[]) => {
    const rowsCount = branch.surface.rings.length, centres = new Set(branch.patches.map(([k, j]) => `${k}:${j}`))
    const out: Attachment[] = []
    let s = 0
    for (let r = Math.max(3, Math.floor(rowsCount * from)); r < rowsCount - 1; r += lod ? 2 : 1) {
      const used = branch.surface.rings.length <= 5 ? sidesUsed : [sidesUsed[s++ % sidesUsed.length]]
      for (const side of used) {
        if (centres.has(`${r}:${side}`)) continue
        const ring = branch.surface.rings[r], point = branch.wood.position(branch.surface.grid[r][side])
        const outward = normalize(sub(point, ring.center))
        out.push({ point, outward, direction: normalize(add(scale(branch.direction, 0.6), scale(outward, 0.8))), size: 0.85 })
      }
    }
    return out
  }

  const attachments: Attachment[] = []
  let group = 1010
  patches.forEach(([k, j], i) => {
    const h = count > 1 ? i / (count - 1) : 0.5
    const point = wood.position(trunk.grid[k][j])
    const outward = normalize(sub(point, rings[k].center))
    const snag = !P.foliage
    const reach = spec.crown * (snag ? 0.3 + 0.5 * rng() : P.reach(h) * (0.86 + rng() * 0.2))
    let rise = snag ? 0.32 + rng() * 0.9 : P.rise(h) + (rng() - 0.5) * 0.2

    while (point[1] + reach * rise / Math.hypot(1, rise) - P.droop * reach * 0.6 < 0.7 && rise < 1.5) rise += 0.08
    const heading = normalize(add(outward, scale(Y, rise)))
    const forkAt = snag || reach < 0.45 ? [] : P.forks[lod ? 1 : 0]
    const limb = grow(trunk, k, j, heading, reach, { lod, tile, group: group++, forkAt, droop: P.droop, lateral: conifer, twig: false })
    if (!fits(limb)) { close(trunk, k, j); return }
    commit(limb)
    if (snag) return
    limb.patches.forEach(([fk, fj], f) => {
      const frame = limb.surface.rings[fk]
      const radial = normalize(sub(limb.wood.position(limb.surface.grid[fk][fj]), frame.center))
      const target = normalize(add(add(scale(radial, 0.65), scale(limb.direction, 0.78)), scale(Y, P.childRise)))
      const extent = Math.max(0.3, reach * P.child * (1 - forkAt[f] * 0.35) * (0.85 + rng() * 0.3))
      const child = grow(limb.surface, fk, fj, target, extent, { lod, tile, group: group++, forkAt: [], droop: P.childDroop, lateral: conifer, twig: true })
      if (!fits(child)) { close(limb.surface, fk, fj); return }
      commit(child)
      attachments.push({ point: child.tip, direction: child.direction, outward: child.direction, size: 1 })
      attachments.push(...anchors(child, 0.5, lod ? [conifer ? 3 : 5] : [3, 7]))
    })
    attachments.push({ point: limb.tip, direction: limb.direction, outward: limb.direction, size: 1.05 })
    attachments.push(...anchors(limb, 0.45, conifer ? [3, 7] : [3, 7, 5]))
  })
  if (!P.foliage) return model

  attachments.push({ point: rings[rings.length - 1].center, direction: Y, outward: Y, size: 1.2 })
  shuffle(attachments, rng)
  const foliage = model.part(P.foliage)
  const center: Vec3 = [0, spec.height * P.center, 0], radii: Vec3 = [spec.crown, spec.height * P.vertical, spec.crown]
  const outOf = (p: Vec3) => normalize([(p[0] - center[0]) / radii[0] ** 2, (p[1] - center[1]) / radii[1] ** 2, (p[2] - center[2]) / radii[2] ** 2])
  const base = P.card * Math.sqrt(spec.crown / P.reference) * (lod ? 1.3 : 1)
  let accepted = 0
  attachments.forEach((a, i) => {
    const out = outOf(a.point)
    const rect = cards[Math.floor(rng() * cards.length)]
    const size = base * a.size * (0.85 + rng() * 0.3)
    const roll = (rng() - 0.5) * 2.4
    for (let attempt = 0; attempt < 6; attempt++) {
      const { dir, right } = orient(P.modes[(attempt + i) % P.modes.length], a, out, roll + attempt * 0.9)
      const candidate = leafCard(a.point, dir, right, size * (1 - attempt * 0.08), rect, P.cardDroop)
      if (lowest(candidate) < 0.2 || index.intersects(candidate)) continue
      append(foliage, candidate, 20_000 + i); index.add(candidate); accepted++
      break
    }
  })

  if (accepted < Math.min(attachments.length * 0.3, lod ? 50 : 110)) throw new Error(`${model.name}: cobertura de folhas insuficiente (${accepted}/${attachments.length})`)
  CROWNS.set(model, { center, radii })
  return model
}

export function bendNormals(model: Model, material: string, toward: (p: Vec3) => Vec3, strength: number) {
  const part = model.parts.get(material)
  if (!part || !part.normals.length) return
  const faces: Vec3[] = [], incident: number[][] = Array.from({ length: part.groups.length }, () => [])
  for (let t = 0; t < part.indices.length; t += 3) {
    const [a, b, c] = [part.indices[t], part.indices[t + 1], part.indices[t + 2]]
    const pa = part.position(a)
    faces.push(normalize(cross(sub(part.position(b), pa), sub(part.position(c), pa))))
    for (const v of [a, b, c]) incident[v].push(faces.length - 1)
  }
  for (let v = 0; v < part.groups.length; v++) {
    const n: Vec3 = [part.normals[v * 3], part.normals[v * 3 + 1], part.normals[v * 3 + 2]]
    const target = toward(part.position(v))
    for (const k of [strength, strength * 0.6, strength * 0.3, 0]) {
      const bent = normalize(add(n, scale(target, k)))
      if (incident[v].every((f) => dot(bent, faces[f]) > 0.12)) { part.normals.set(bent, v * 3); break }
    }
  }
}

export function bendCrown(model: Model) {
  const crown = CROWNS.get(model)
  if (!crown) return
  const { center, radii } = crown
  const toward = (p: Vec3) => normalize(add(normalize([(p[0] - center[0]) / radii[0] ** 2, (p[1] - center[1]) / radii[1] ** 2, (p[2] - center[2]) / radii[2] ** 2]), scale(Y, 0.3)))
  for (const material of model.open) bendNormals(model, material, toward, 1.1)
}

function groundCard(rect: CardRect, theta: number, apothem: number, height: number, lean: [number, number], stretch: number, count: number) {
  const out: Vec3 = [Math.cos(theta), 0, Math.sin(theta)], right = normalize(cross(Y, out))
  const width = height * rect.aspect / stretch, span = rect.u1 - rect.u0, tall = rect.v1 - rect.v0
  const offsets = [{ y: 0, d: 0 }]
  let y = 0, d = 0
  for (const angle of lean) { y += 0.5 * height * Math.cos(angle); d += 0.5 * height * Math.sin(angle); offsets.push({ y, d }) }
  const wedge = Math.tan(Math.PI / count - 0.07)
  const needed = Math.max(...rect.rows.map((row, k) => Math.max(row.left, row.right) * width / wedge - offsets[k].d))
  const a = Math.max(apothem, needed * 1.04 + 0.01)
  const part = new Part()
  const rows = rect.rows.map((row, k) => {
    const c: Vec3 = [out[0] * (a + offsets[k].d), -0.06 + offsets[k].y, out[2] * (a + offsets[k].d)]
    return [-row.left, 0, row.right].map((u) => part.vertex(add(c, scale(right, u * width)), [rect.stem + u * span, 1 - rect.v1 + (k / 2) * tall]))
  })
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) {
    const p = rows[k][j], q = rows[k][j + 1], r = rows[k + 1][j], s = rows[k + 1][j + 1]
    part.triangle(p, q, r); part.triangle(q, s, r)
  }
  return part
}

function frond(rect: CardRect, azimuth: number, root: number, size: number, rise: number, fall: number, roll: number, ts: number[]) {
  const out: Vec3 = [Math.cos(azimuth), 0, Math.sin(azimuth)]

  const width = size * rect.aspect * 0.8, span = rect.u1 - rect.u0, tall = rect.v1 - rect.v0
  const steps = 24, centre: Vec3[] = [], tangents: Vec3[] = []
  let p: Vec3 = [out[0] * root, -0.04, out[2] * root]
  for (let s = 0; s <= steps; s++) {
    const e = rise + (fall - rise) * (s / steps) ** 1.4
    const tangent = normalize(add(scale(out, Math.cos(e)), scale(Y, Math.sin(e))))
    centre.push(p); tangents.push(tangent)
    p = add(p, scale(tangent, size / steps))
  }
  const part = new Part(), across = normalize(cross(out, Y))
  const grid = ts.map((t) => {
    const i = Math.min(steps, Math.round(t * steps)), c = centre[i], tangent = tangents[i]
    const axis = normalize(sub(across, scale(tangent, dot(across, tangent))))
    const w = add(scale(axis, Math.cos(roll)), scale(normalize(cross(tangent, axis)), Math.sin(roll)))
    return [-profileReach(rect, t, ts, 'left'), 0, profileReach(rect, t, ts, 'right')].map((u) => part.vertex(add(c, scale(w, u * width)), [rect.stem + u * span, 1 - rect.v1 + t * tall]))
  })
  for (let k = 0; k < grid.length - 1; k++) for (let j = 0; j < 2; j++) {
    const a = grid[k][j], b = grid[k][j + 1], c = grid[k + 1][j], d = grid[k + 1][j + 1]
    part.triangle(a, b, c); part.triangle(b, d, c)
  }

  for (let i = 0; i < part.groups.length; i++) if (part.positions[i * 3 + 1] < 0.02 && i >= 3 * 2) return null
  return part
}

export function grass(spec: GrassSpec, cards: CardRect[], lod = 0) {
  const model = new Model(spec.name + (lod ? '_lod1' : ''), true, { open: ['grass'], audit: true })
  const part = model.part('grass'), rng = random(spec.seed), index = new SurfaceIndex(0.15)
  const pick = (i: number) => cards[spec.cards[i % spec.cards.length]]
  let group = 0
  const place = (build: (shrink: number) => Part | null, tries: number) => {
    for (let attempt = 0; attempt < tries; attempt++) {
      const candidate = build(1 - attempt * 0.1)
      if (!candidate || index.intersects(candidate)) continue
      append(part, candidate, group++); index.add(candidate)
      return true
    }
    return false
  }
  const phase = rng() * TAU
  if (spec.kind === 'fern') {

    const count = lod ? 5 : 6, ts = lod ? [0, 2 / 12, 5 / 12, 8 / 12, 1] : [0, 1 / 12, 2 / 12, 3 / 12, 5 / 12, 7 / 12, 9 / 12, 1]
    for (let i = 0; i < count; i++) {
      const steep = i % 2 === 0, rect = pick(i)
      place((shrink) => frond(rect, phase + i * TAU / count + (rng() - 0.5) * 0.3, spec.radius, spec.height * (steep ? 1.05 : 1.2) * shrink,
        steep ? 1.3 + rng() * 0.1 : 0.7 + rng() * 0.15, steep ? 0.2 : -0.2, (rng() - 0.5) * 0.3, ts), 8)
    }

    for (let i = 0; i < (lod ? 0 : count); i++) {
      const rect = pick(i + 2)
      place((shrink) => frond(rect, phase + (i + 0.5) * TAU / count + (rng() - 0.5) * 0.2, spec.radius * 0.6, spec.height * 0.85 * shrink,
        1.05 + rng() * 0.2, 0.05, (rng() - 0.5) * 0.3, ts), 4)
    }
    return model
  }
  const stretch = spec.kind === 'reeds' ? 1.9 : 1
  const outer = 4, inner = lod ? 0 : spec.kind === 'reeds' ? 2 : 3
  for (let i = 0; i < outer; i++) {
    const rect = pick(i), h = spec.height * (0.88 + rng() * 0.12)
    place((shrink) => groundCard(rect, phase + i * TAU / outer + (rng() - 0.5) * 0.12, spec.radius, h * shrink, [0.2, 0.44], stretch, outer), 3)
  }
  for (let i = 0; i < inner; i++) {
    const rect = pick(i + 1), h = spec.height * (1.02 + rng() * 0.1)
    place((shrink) => groundCard(rect, phase + Math.PI / outer + i * TAU / inner + (rng() - 0.5) * 0.12, spec.radius * 0.3, h * shrink, [0.07, 0.2], stretch, Math.max(3, inner)), 5)
  }
  return model
}
