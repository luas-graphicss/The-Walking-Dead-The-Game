export type Vec3 = [number, number, number]
export type Vec2 = [number, number]

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / (length(a) || 1))
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export class Part {
  positions: number[] = []
  uvs: number[] = []
  groups: number[] = []
  indices: number[] = []
  normals: Float32Array = new Float32Array(0)

  colors: Float32Array | null = null

  customNormals = false
  vertex(p: Vec3, uv: Vec2, group = 0) {
    this.positions.push(p[0], p[1], p[2])
    this.uvs.push(uv[0], uv[1])
    this.groups.push(group)
    return this.groups.length - 1
  }
  triangle(a: number, b: number, c: number) {
    this.indices.push(a, b, c)
  }
  position(i: number): Vec3 {
    return [this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]]
  }
}

export type ModelOptions = {

  open?: string[]

  audit?: boolean
}

export class Model {
  readonly parts = new Map<string, Part>()
  readonly open: Set<string>
  readonly audit: boolean

  constructor(readonly name: string, readonly closed = true, options: ModelOptions = {}) {
    this.open = new Set(options.open ?? [])
    this.audit = options.audit ?? false
  }
  part(material: string) {
    let part = this.parts.get(material)
    if (!part) { part = new Part(); this.parts.set(material, part) }
    return part
  }
  get triangleCount() {
    let n = 0
    for (const part of this.parts.values()) n += part.indices.length / 3
    return n
  }
  get vertexCount() {
    let n = 0
    for (const part of this.parts.values()) n += part.groups.length
    return n
  }
  bounds() {
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const part of this.parts.values()) for (let i = 0; i < part.positions.length; i += 3) for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], part.positions[i + k]); max[k] = Math.max(max[k], part.positions[i + k])
    }
    return { min, max }
  }
}

const key = (p: Vec3) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`

export function computeNormals(model: Model) {
  const sums = new Map<string, Vec3>()
  const vertexKey = (part: Part, i: number) => `${part.groups[i]}|${key(part.position(i))}`
  for (const part of model.parts.values()) {
    if (part.customNormals) continue
    for (let t = 0; t < part.indices.length; t += 3) {
      const [a, b, c] = [part.indices[t], part.indices[t + 1], part.indices[t + 2]]
      const pa = part.position(a), face = cross(sub(part.position(b), pa), sub(part.position(c), pa))
      for (const i of [a, b, c]) {
        const k = vertexKey(part, i)
        const sum = sums.get(k) ?? [0, 0, 0]
        sums.set(k, add(sum, face))
      }
    }
  }
  for (const part of model.parts.values()) {
    if (part.customNormals) continue
    part.normals = new Float32Array(part.groups.length * 3)
    for (let i = 0; i < part.groups.length; i++) {
      const n = normalize(sums.get(vertexKey(part, i)) ?? [0, 1, 0])
      part.normals.set(n, i * 3)
    }
  }
}

export function segmentCrossesTriangle(p: Vec3, q: Vec3, a: Vec3, b: Vec3, c: Vec3) {
  const eps = 1e-7
  const dir = sub(q, p), e1 = sub(b, a), e2 = sub(c, a)
  const h = cross(dir, e2), det = dot(e1, h)
  if (Math.abs(det) < 1e-12) return false
  const inv = 1 / det, s = sub(p, a)
  const u = dot(s, h) * inv
  if (u <= eps || u >= 1 - eps) return false
  const qv = cross(s, e1), v = dot(dir, qv) * inv
  if (v <= eps || u + v >= 1 - eps) return false
  const t = dot(e2, qv) * inv
  return t > eps && t < 1 - eps
}

export type Report = { name: string; vertices: number; triangles: number; size: Vec3; minY: number; issues: string[] }

export function coplanarOverlap(A: Vec3[], B: Vec3[], n: Vec3) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2])
  const [i, j] = ax >= ay && ax >= az ? [1, 2] : ay >= az ? [0, 2] : [0, 1]
  const a = A.map((p) => [p[i], p[j]]), b = B.map((p) => [p[i], p[j]])
  let size = 1e-6
  for (const p of [...a, ...b]) size = Math.max(size, Math.abs(p[0]), Math.abs(p[1]))
  const eps = size * 1e-6
  for (const poly of [a, b]) for (let e = 0; e < 3; e++) {
    const p = poly[e], q = poly[(e + 1) % 3]
    const nx = q[1] - p[1], ny = p[0] - q[0]
    const pa = a.map((r) => r[0] * nx + r[1] * ny), pb = b.map((r) => r[0] * nx + r[1] * ny)
    const span = Math.hypot(nx, ny) || 1
    if ((Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb))) / span <= eps) return false
  }
  return true
}

export function validate(model: Model): Report {
  const issues: string[] = []
  const welded = new Map<string, number>()
  const points: Vec3[] = []
  const tris: [number, number, number][] = []
  const openTri: boolean[] = []
  let degenerateUv = 0, flippedNormals = 0, badUv = 0, stretched = 0, buried = 0
  for (const [material, part] of model.parts) {
    const open = !model.closed || model.open.has(material)
    const map = new Int32Array(part.groups.length)
    for (let i = 0; i < part.groups.length; i++) {
      const p = part.position(i), k = key(p)
      let id = welded.get(k)
      if (id === undefined) { id = points.length; welded.set(k, id); points.push(p) }
      map[i] = id
      if (!Number.isFinite(part.uvs[i * 2]) || !Number.isFinite(part.uvs[i * 2 + 1])) badUv++
      if (model.audit && open && p[1] < -0.1) buried++
    }
    for (let t = 0; t < part.indices.length; t += 3) {
      const [a, b, c] = [part.indices[t], part.indices[t + 1], part.indices[t + 2]]
      tris.push([map[a], map[b], map[c]])
      openTri.push(open)
      const pa = part.position(a), pb = part.position(b), pc = part.position(c)
      const e1 = sub(pb, pa), e2 = sub(pc, pa), face = normalize(cross(e1, e2))
      for (const i of [a, b, c]) {
        const n: Vec3 = [part.normals[i * 3], part.normals[i * 3 + 1], part.normals[i * 3 + 2]]
        if (dot(n, face) <= 0) flippedNormals++
      }
      const du1 = part.uvs[b * 2] - part.uvs[a * 2], dv1 = part.uvs[b * 2 + 1] - part.uvs[a * 2 + 1]
      const du2 = part.uvs[c * 2] - part.uvs[a * 2], dv2 = part.uvs[c * 2 + 1] - part.uvs[a * 2 + 1]
      const det = du1 * dv2 - du2 * dv1
      if (Math.abs(det) < 1e-12) { degenerateUv++; continue }
      if (!model.audit || Math.max(pa[1], pb[1], pc[1]) <= 0) continue

      const ju = add(scale(e1, dv2 / det), scale(e2, -dv1 / det)), jv = add(scale(e1, -du2 / det), scale(e2, du1 / det))
      const g11 = dot(ju, ju), g22 = dot(jv, jv), g12 = dot(ju, jv)
      const half = (g11 + g22) / 2, root = Math.sqrt(Math.max(0, half * half - (g11 * g22 - g12 * g12)))
      if (half - root <= 1e-18 || Math.sqrt((half + root) / (half - root)) > 6) stretched++
    }
  }
  let degenerate = 0
  const edges = new Map<string, number[]>()
  const edgeOpen = new Map<string, boolean>()
  let volume = 0, closedFaces = 0
  for (let t = 0; t < tris.length; t++) {
    const [a, b, c] = tris[t]
    const area = length(cross(sub(points[b], points[a]), sub(points[c], points[a]))) / 2
    if (area < 1e-9 || a === b || b === c || a === c) degenerate++
    if (!openTri[t]) { volume += dot(points[a], cross(points[b], points[c])) / 6; closedFaces++ }
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = u < v ? `${u}-${v}` : `${v}-${u}`
      const list = edges.get(k) ?? []
      list.push(u < v ? 1 : -1)
      edges.set(k, list)
      edgeOpen.set(k, (edgeOpen.get(k) ?? true) && openTri[t])
    }
  }
  let boundary = 0, nonManifold = 0, inconsistent = 0
  for (const [k, list] of edges) {
    if (list.length === 1) { if (!edgeOpen.get(k)) boundary++ }
    else if (list.length > 2) nonManifold++
    else if (list[0] === list[1]) inconsistent++
  }
  if (degenerate) issues.push(`${degenerate} faces degeneradas`)
  if (boundary) issues.push(`${boundary} arestas abertas (malha furada)`)
  if (nonManifold) issues.push(`${nonManifold} arestas não-manifold`)
  if (inconsistent) issues.push(`${inconsistent} arestas com orientação invertida`)
  if (closedFaces && volume <= 0) issues.push('volume negativo (normais para dentro)')
  if (flippedNormals) issues.push(`${flippedNormals} normais de vértice contra a face`)
  if (badUv) issues.push(`${badUv} UVs inválidas`)
  if (degenerateUv) issues.push(`${degenerateUv} triângulos com UV colapsada`)
  if (stretched) issues.push(`${stretched} triângulos com textura esticada`)
  if (buried) issues.push(`${buried} vértices de folhagem enterrados`)

  if (model.audit) {

    const parent = Int32Array.from(points.keys())
    const find = (x: number) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
    for (const [a, b, c] of tris) { parent[find(b)] = find(a); parent[find(c)] = find(a) }
    const lowest = new Map<number, number>()
    for (const tri of tris) for (const v of tri) { const r = find(v); lowest.set(r, Math.min(lowest.get(r) ?? Infinity, points[v][1])) }
    let floating = 0
    for (const y of lowest.values()) if (y > 0) floating++
    if (floating) issues.push(`${floating} peças flutuando sem ligação com a malha ou com o solo`)
  }

  const { min, max } = model.bounds()
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2])
  const cell = Math.max(extent / 40, 1e-4)
  const grid = new Map<string, { cell: [number, number, number]; list: number[] }>()
  const boxes = tris.map(([a, b, c]) => {
    const lo: Vec3 = [0, 1, 2].map((k) => Math.min(points[a][k], points[b][k], points[c][k])) as Vec3
    const hi: Vec3 = [0, 1, 2].map((k) => Math.max(points[a][k], points[b][k], points[c][k])) as Vec3
    return { lo, hi }
  })
  boxes.forEach(({ lo, hi }, t) => {
    for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++)
      for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++)
        for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) {
          const k = `${x},${y},${z}`
          let entry = grid.get(k)
          if (!entry) grid.set(k, (entry = { cell: [x, y, z], list: [] }))
          entry.list.push(t)
        }
  })
  const faceNormals = tris.map(([a, b, c]) => normalize(cross(sub(points[b], points[a]), sub(points[c], points[a]))))
  const planeTolerance = Math.max(extent * 1e-5, 1e-6)
  let crossings = 0, stacked = 0

  for (const { cell: owner, list } of grid.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const s = list[i], t = list[j]
    const A = tris[s], B = tris[t]
    const a = boxes[s], b = boxes[t]
    if (a.hi[0] < b.lo[0] || b.hi[0] < a.lo[0] || a.hi[1] < b.lo[1] || b.hi[1] < a.lo[1] || a.hi[2] < b.lo[2] || b.hi[2] < a.lo[2]) continue
    if (Math.floor(Math.max(a.lo[0], b.lo[0]) / cell) !== owner[0] || Math.floor(Math.max(a.lo[1], b.lo[1]) / cell) !== owner[1] || Math.floor(Math.max(a.lo[2], b.lo[2]) / cell) !== owner[2]) continue
    const [pa, pb, pc] = A.map((v) => points[v]), [qa, qb, qc] = B.map((v) => points[v])
    const n = faceNormals[s]
    if (dot(n, faceNormals[t]) > 0.9995 && [qa, qb, qc].every((q) => Math.abs(dot(n, sub(q, pa))) < planeTolerance) && coplanarOverlap([pa, pb, pc], [qa, qb, qc], n)) stacked++
    if (A.some((v) => B.includes(v))) continue
    const hit = [[pa, pb], [pb, pc], [pc, pa]].some(([p, q]) => segmentCrossesTriangle(p, q, qa, qb, qc))
      || [[qa, qb], [qb, qc], [qc, qa]].some(([p, q]) => segmentCrossesTriangle(p, q, pa, pb, pc))
    if (hit) crossings++
  }
  if (crossings) issues.push(`${crossings} pares de faces se atravessando`)
  if (stacked) issues.push(`${stacked} pares de faces coplanares sobrepostas (z-fight)`)
  return {
    name: model.name, vertices: model.vertexCount, triangles: model.triangleCount,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], minY: min[1], issues,
  }
}

export function triangulatePolygon(points: Vec2[]) {
  const index = points.map((_, i) => i)
  const out: [number, number, number][] = []
  const area2 = (a: Vec2, b: Vec2, c: Vec2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

  const inside = (p: Vec2, a: Vec2, b: Vec2, c: Vec2) => area2(a, b, p) >= -1e-14 && area2(b, c, p) >= -1e-14 && area2(c, a, p) >= -1e-14
  let guard = 0
  while (index.length > 3 && guard++ < 10_000) {
    let clipped = false
    for (let i = 0; i < index.length; i++) {
      const ia = index[(i + index.length - 1) % index.length], ib = index[i], ic = index[(i + 1) % index.length]
      const [a, b, c] = [points[ia], points[ib], points[ic]]
      if (area2(a, b, c) <= 1e-12) continue
      if (index.some((j) => j !== ia && j !== ib && j !== ic && inside(points[j], a, b, c))) continue
      out.push([ia, ib, ic])
      index.splice(i, 1)
      clipped = true
      break
    }
    if (!clipped) throw new Error('Polígono não triangulável (auto-interseção ou orientação horária).')
  }
  if (index.length === 3) out.push([index[0], index[1], index[2]])
  return out
}
