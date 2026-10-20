import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { ASSETS } from '../lib/game/blockout/catalog'
import { SCULPTORS } from '../lib/game/blockout/sculpt'
import { Kit, type Piece, type V3 } from '../lib/game/blockout/sculpt/kit'
import { MODULE_TRIANGLE_BUDGET, type AssetSpec } from '../lib/game/blockout/types'
import { RESOURCE_ASSETS, resourceAssetId } from '../lib/game/resources/sculpts'

const TOUCH = 0.003, ZGAP = 0.0006, ZAREA = 0.0001, SINK = 0.008
const args = process.argv.slice(2)
const only = args.find((a) => a.startsWith('--family='))?.slice(9)
const list = args.find((a) => a.startsWith('--families='))?.slice(11).split(',')
const verbose = args.includes('--verbose')
const identity = new Matrix4()

export type Built = { piece: Piece; geometry: BufferGeometry; bvh?: MeshBVH; closed?: boolean; normals: Float32Array; tris: number }
export type Issue = { kind: 'flutuando' | 'abaixo do piso' | 'z-fight' | 'duplicado' | 'atravessa' | 'malha deformada' | 'fora do volume' | 'orçamento'; detail: string }

export type Findings = { floating: number[][]; grounded: Set<number>; zfight: { a: number; b: number; n: V3 }[]; duplicate: [number, number][]; pierce: { rod: number; slab: number; T: V3 }[]; sink: number[] }

const fmt = (v: V3 | number[]) => `[${v.map((n) => n.toFixed(3)).join(', ')}]`
const center = (p: Piece): V3 => [(p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2]
const size = (p: Piece): V3 => [p.max[0] - p.min[0], p.max[1] - p.min[1], p.max[2] - p.min[2]]
const overlap = (a: Piece, b: Piece, pad: number) => a.min[0] <= b.max[0] + pad && b.min[0] <= a.max[0] + pad && a.min[1] <= b.max[1] + pad && b.min[1] <= a.max[1] + pad && a.min[2] <= b.max[2] + pad && b.min[2] <= a.max[2] + pad
const describe = (b: Built) => `${b.piece.material} em ${fmt(center(b.piece))} (${fmt(size(b.piece))})`

function build(kit: Kit): Built[] {
  return kit.pieces.map((piece) => {
    const bucket = kit.buckets.get(piece.material)!
    const position = new Float32Array(bucket.p.slice(piece.start * 3, (piece.start + piece.count) * 3))
    const index = new Uint32Array(piece.icount)
    for (let i = 0; i < piece.icount; i++) index[i] = bucket.i[piece.istart + i] - piece.start
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(position, 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(bucket.uv.slice(piece.start * 2, (piece.start + piece.count) * 2)), 2))
    geometry.setIndex(new BufferAttribute(index, 1))
    return { piece, geometry, normals: new Float32Array(bucket.n.slice(piece.start * 3, (piece.start + piece.count) * 3)), tris: piece.icount / 3 }
  })
}
export function bvhOf(b: Built) {
  if (!b.bvh) {
    const bvh = new MeshBVH(b.geometry, { targetLeafSize: 8 } as ConstructorParameters<typeof MeshBVH>[1])
    b.bvh = bvh
    Object.assign(b.geometry, { boundsTree: bvh })
  }
  return b.bvh
}

function isClosed(b: Built) {
  if (b.closed !== undefined) return b.closed
  const pos = b.geometry.getAttribute('position'), idx = b.geometry.getIndex()!, weld = new Map<string, number>(), id: number[] = []
  for (let i = 0; i < pos.count; i++) { const key = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`; let w = weld.get(key); if (w === undefined) { w = weld.size; weld.set(key, w) } id.push(w) }
  const edges = new Map<string, number>()
  for (let t = 0; t < idx.count; t += 3) for (let e = 0; e < 3; e++) {
    const a = id[idx.getX(t + e)], c = id[idx.getX(t + (e + 1) % 3)]
    if (a === c) continue
    const key = a < c ? `${a}_${c}` : `${c}_${a}`
    edges.set(key, (edges.get(key) ?? 0) + 1)
  }
  b.closed = edges.size > 0 && [...edges.values()].every((n) => n === 2)
  return b.closed
}

type Tri = { n: V3; d: number; p: V3[]; lo: V3; hi: V3 }

function planarTris(b: Built): Map<string, Tri[]> {
  const pos = b.geometry.getAttribute('position'), idx = b.geometry.getIndex()!, out = new Map<string, Tri[]>()
  const A = new Vector3(), B = new Vector3(), C = new Vector3(), n = new Vector3()
  for (let t = 0; t < idx.count; t += 3) {
    A.fromBufferAttribute(pos, idx.getX(t)); B.fromBufferAttribute(pos, idx.getX(t + 1)); C.fromBufferAttribute(pos, idx.getX(t + 2))
    n.copy(B).sub(A).cross(C.clone().sub(A))
    const area = n.length() / 2
    if (area < 1e-6) continue
    n.normalize()

    if (n.y < -0.99 && A.y < 0.002 && B.y < 0.002 && C.y < 0.002) continue
    const d = n.dot(A), key = `${Math.round(n.x * 20)},${Math.round(n.y * 20)},${Math.round(n.z * 20)}|${Math.round(d / ZGAP)}`
    const list = out.get(key) ?? []
    list.push({ n: [n.x, n.y, n.z], d, p: [[A.x, A.y, A.z], [B.x, B.y, B.z], [C.x, C.y, C.z]], lo: [Math.min(A.x, B.x, C.x), Math.min(A.y, B.y, C.y), Math.min(A.z, B.z, C.z)], hi: [Math.max(A.x, B.x, C.x), Math.max(A.y, B.y, C.y), Math.max(A.z, B.z, C.z)] })
    out.set(key, list)
  }
  return out
}

const planeGap = (a: Tri, b: Tri) => Math.abs(a.n[0] * (b.p[0][0] + b.p[1][0] + b.p[2][0]) / 3 + a.n[1] * (b.p[0][1] + b.p[1][1] + b.p[2][1]) / 3 + a.n[2] * (b.p[0][2] + b.p[1][2] + b.p[2][2]) / 3 - a.d)
const boxesMeet = (s: Tri, t: Tri) => s.lo[0] <= t.hi[0] + ZGAP && t.lo[0] <= s.hi[0] + ZGAP && s.lo[1] <= t.hi[1] + ZGAP && t.lo[1] <= s.hi[1] + ZGAP && s.lo[2] <= t.hi[2] + ZGAP && t.lo[2] <= s.hi[2] + ZGAP
function clipArea(a: V3[], b: V3[], n: V3) {
  const ax = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : (Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2)
  const u = (ax + 1) % 3, v = (ax + 2) % 3
  let poly = a.map((p) => [p[u], p[v]])
  const clip = b.map((p) => [p[u], p[v]])
  const sign = Math.sign((clip[1][0] - clip[0][0]) * (clip[2][1] - clip[0][1]) - (clip[1][1] - clip[0][1]) * (clip[2][0] - clip[0][0])) || 1
  for (let i = 0; i < 3 && poly.length; i++) {
    const p0 = clip[i], p1 = clip[(i + 1) % 3], next: number[][] = []
    const side = (q: number[]) => sign * ((p1[0] - p0[0]) * (q[1] - p0[1]) - (p1[1] - p0[1]) * (q[0] - p0[0]))
    for (let j = 0; j < poly.length; j++) {
      const c = poly[j], dprev = poly[(j + poly.length - 1) % poly.length], sc = side(c), sp = side(dprev)
      if (sc >= 0) { if (sp < 0) { const t = sp / (sp - sc); next.push([dprev[0] + (c[0] - dprev[0]) * t, dprev[1] + (c[1] - dprev[1]) * t]) } next.push(c) }
      else if (sp >= 0) { const t = sp / (sp - sc); next.push([dprev[0] + (c[0] - dprev[0]) * t, dprev[1] + (c[1] - dprev[1]) * t]) }
    }
    poly = next
  }
  let area = 0
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p[0] * q[1] - q[0] * p[1] }
  const cosine = Math.abs(n[ax])
  return Math.abs(area) / 2 / (cosine || 1)
}
function zfightArea(a: Map<string, Tri[]>, b: Map<string, Tri[]>): { area: number; n: V3 } {
  let total = 0, n: V3 = [0, 1, 0]
  for (const [key, list] of a) {
    const bar = key.lastIndexOf('|'), normal = key.slice(0, bar), slot = Number(key.slice(bar + 1))
    for (const step of [-1, 0, 1]) {
      const other = b.get(`${normal}|${slot + step}`)
      if (!other) continue
      for (const s of list) for (const t of other) {

        if (s.n[0] * t.n[0] + s.n[1] * t.n[1] + s.n[2] * t.n[2] < 0.9995 || Math.abs(s.d - t.d) > ZGAP || !boxesMeet(s, t) || Math.max(planeGap(s, t), planeGap(t, s)) > ZGAP) continue
        const shared = clipArea(s.p, t.p, s.n)
        if (shared > 0) { total += shared; n = s.n }
        if (total > ZAREA) return { area: total, n }
      }
    }
  }
  return { area: total, n }
}

type Frame = { T: Vector3; U: Vector3; V: Vector3; plate: boolean; u: [number, number]; v: [number, number] }

export function thinAxis(b: Built & { frame?: Frame }): Frame {
  if (b.frame) return b.frame
  const pos = b.geometry.getAttribute('position'), mean = new Vector3()
  for (let i = 0; i < pos.count; i++) mean.add(new Vector3().fromBufferAttribute(pos, i))
  mean.divideScalar(pos.count)
  const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], p = new Vector3()
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i).sub(mean); const q = [p.x, p.y, p.z]; for (let a = 0; a < 3; a++) for (let e = 0; e < 3; e++) c[a][e] += q[a] * q[e] }
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  for (let sweep = 0; sweep < 12; sweep++) for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    if (Math.abs(c[i][j]) < 1e-14) continue
    const theta = (c[j][j] - c[i][i]) / (2 * c[i][j]), t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), cs = 1 / Math.sqrt(t * t + 1), sn = t * cs
    for (let k = 0; k < 3; k++) { const a = c[k][i], e = c[k][j]; c[k][i] = cs * a - sn * e; c[k][j] = sn * a + cs * e }
    for (let k = 0; k < 3; k++) { const a = c[i][k], e = c[j][k]; c[i][k] = cs * a - sn * e; c[j][k] = sn * a + cs * e }
    for (let k = 0; k < 3; k++) { const a = v[k][i], e = v[k][j]; v[k][i] = cs * a - sn * e; v[k][j] = sn * a + cs * e }
  }
  const order = [0, 1, 2].sort((i, j) => c[i][i] - c[j][j])
  const axis = (i: number) => new Vector3(v[0][i], v[1][i], v[2][i]).normalize()
  const T = axis(order[0]), U = axis(order[2]), V = axis(order[1])
  const u: [number, number] = [Infinity, -Infinity], w: [number, number] = [Infinity, -Infinity]
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); const pu = p.dot(U), pv = p.dot(V); u[0] = Math.min(u[0], pu); u[1] = Math.max(u[1], pu); w[0] = Math.min(w[0], pv); w[1] = Math.max(w[1], pv) }
  b.frame = { T, U, V, plate: c[order[0]][order[0]] < 0.25 * c[order[1]][order[1]], u, v: w }
  return b.frame
}

function pierces(rod: Built, slab: Built) {
  if (!isClosed(slab) || !isClosed(rod)) return false
  const F = thinAxis(slab)
  if (!F.plate) return false
  if (!bvhOf(slab).intersectsGeometry(rod.geometry, identity)) return false
  const pos = rod.geometry.getAttribute('position'), sp = slab.geometry.getAttribute('position'), si = slab.geometry.getIndex()!
  const hit = { point: new Vector3(), distance: 0, faceIndex: 0 }, v = new Vector3(), a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3()
  let up = 0, down = 0
  const step = Math.max(1, Math.floor(pos.count / 500)), m = 0.01, probe = { point: new Vector3(), distance: 0, faceIndex: 0 }, q = new Vector3()

  const surrounded = (p: Vector3) => [F.U, F.V].every((dir) => [1, -1].every((s) => {
    q.copy(p).addScaledVector(dir, s * m)
    return bvhOf(slab).closestPointToPoint(q, probe) !== null && probe.distance < 0.002
  }))
  for (let i = 0; i < pos.count; i += step) {
    v.fromBufferAttribute(pos, i)
    const pu = v.dot(F.U), pv = v.dot(F.V)
    if (pu < F.u[0] + m || pu > F.u[1] - m || pv < F.v[0] + m || pv > F.v[1] - m) continue
    if (!bvhOf(slab).closestPointToPoint(v, hit)) continue
    a.fromBufferAttribute(sp, si.getX(hit.faceIndex * 3)); b.fromBufferAttribute(sp, si.getX(hit.faceIndex * 3 + 1)); c.fromBufferAttribute(sp, si.getX(hit.faceIndex * 3 + 2))
    n.copy(b).sub(a).cross(c.clone().sub(a)).normalize()
    const off = v.clone().sub(hit.point)
    if (off.length() < 0.004 || off.dot(n) <= 0 || Math.abs(n.dot(F.T)) < 0.9) continue
    if (!surrounded(hit.point)) continue
    if (n.dot(F.T) > 0) up++; else down++
    if (up && down) return true
  }
  return false
}

function deformation(b: Built): string | null {
  const pos = b.geometry.getAttribute('position'), uv = b.geometry.getAttribute('uv'), idx = b.geometry.getIndex()!
  const A = new Vector3(), B = new Vector3(), C = new Vector3(), f = new Vector3(), nv = new Vector3()
  let stretched = 0, bad = 0, area = 0
  for (let t = 0; t < idx.count; t += 3) {
    const ia = idx.getX(t), ib = idx.getX(t + 1), ic = idx.getX(t + 2)
    A.fromBufferAttribute(pos, ia); B.fromBufferAttribute(pos, ib); C.fromBufferAttribute(pos, ic)
    f.copy(B).sub(A).cross(C.clone().sub(A))
    const world = f.length() / 2
    if (world < 1e-9) continue
    f.normalize(); area += world
    nv.set(b.normals[ia * 3] + b.normals[ib * 3] + b.normals[ic * 3], b.normals[ia * 3 + 1] + b.normals[ib * 3 + 1] + b.normals[ic * 3 + 1], b.normals[ia * 3 + 2] + b.normals[ib * 3 + 2] + b.normals[ic * 3 + 2]).normalize()
    if (nv.dot(f) < 0.2 && world > 2e-5) bad += world
    if (world > 4e-4) {
      const uvArea = Math.abs((uv.getX(ib) - uv.getX(ia)) * (uv.getY(ic) - uv.getY(ia)) - (uv.getY(ib) - uv.getY(ia)) * (uv.getX(ic) - uv.getX(ia))) / 2
      const ratio = Math.sqrt(uvArea / world)
      if (ratio < 0.25 || ratio > 4) stretched += world
    }
  }
  if (area > 0 && bad / area > 0.02) return `normais incompatíveis em ${(bad / area * 100).toFixed(0)}% da área`
  if (area > 0 && stretched / area > 0.05) return `UV esticado em ${(stretched / area * 100).toFixed(0)}% da área`
  return null
}

export function auditSpec(spec: AssetSpec, inspect?: (built: Built[], findings: Findings) => void): { issues: Issue[]; triangles: number; pieces: number } {
  const findings: Findings = { floating: [], grounded: new Set(), zfight: [], duplicate: [], pierce: [], sink: [] }
  Kit.record = true
  const kit = new Kit(spec.id, spec.size, spec.variant)
  SCULPTORS[spec.family](kit, spec)
  Kit.record = false
  const built = build(kit), issues: Issue[] = []
  const triangles = built.reduce((s, b) => s + b.tris, 0)
  if (triangles > MODULE_TRIANGLE_BUDGET) issues.push({ kind: 'orçamento', detail: `${triangles} triângulos` })

  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity]
  for (const b of built) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], b.piece.min[a]); max[a] = Math.max(max[a], b.piece.max[a]) }
  const [w, h, d] = spec.size
  const excess = (p: Piece) => Math.max(0, p.max[0] - w / 2, -p.min[0] - w / 2, p.max[2] - d / 2, -p.min[2] - d / 2)
  const over = Math.max(0, ...built.map((b) => excess(b.piece)))
  if (over > 0.08) issues.push({ kind: 'fora do volume', detail: `planta excedida em ${(over * 100).toFixed(1)} cm por ${describe(built.reduce((a, b) => (excess(b.piece) > excess(a.piece) ? b : a)))}` })
  if (max[1] - h > (spec.family === 'stairs' ? 1 : 0.3)) issues.push({ kind: 'fora do volume', detail: `altura excedida em ${((max[1] - h) * 100).toFixed(1)} cm` })

  built.forEach((b, i) => { if (b.piece.min[1] < -SINK) { issues.push({ kind: 'abaixo do piso', detail: describe(b) }); findings.sink.push(i) } })
  for (const b of built) { const problem = deformation(b); if (problem) issues.push({ kind: 'malha deformada', detail: `${describe(b)}: ${problem}` }) }

  const parent = built.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const join = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }
  const order = built.map((_, i) => i).sort((a, b) => built[a].piece.min[0] - built[b].piece.min[0])
  const planar = new Map<number, Map<string, Tri[]>>()
  const planesOf = (i: number) => { let p = planar.get(i); if (!p) { p = planarTris(built[i]); planar.set(i, p) } return p }
  const t1 = { point: new Vector3(), distance: 0, faceIndex: 0 }, t2 = { point: new Vector3(), distance: 0, faceIndex: 0 }
  let zfights = 0, duplicates = 0, piercings = 0
  for (let oi = 0; oi < order.length; oi++) {
    const i = order[oi], A = built[i]
    for (let oj = oi + 1; oj < order.length; oj++) {
      const j = order[oj], B = built[j]
      if (B.piece.min[0] > A.piece.max[0] + TOUCH) break
      if (!overlap(A.piece, B.piece, TOUCH)) continue
      const sameRoot = find(i) === find(j)
      const tight = overlap(A.piece, B.piece, 0)
      let touching = sameRoot
      if (!sameRoot) {
        const hit = bvhOf(A).closestPointToGeometry(B.geometry, identity, t1, t2, 0, TOUCH)
        touching = Boolean(hit && hit.distance <= TOUCH)
        if (touching) join(i, j)
      }
      if (!tight) continue
      const limit = inspect ? Infinity : 1
      if (zfights < 12 * limit) {
        const z = zfightArea(planesOf(i), planesOf(j))
        if (z.area > ZAREA) { zfights++; issues.push({ kind: 'z-fight', detail: `${describe(A)} × ${describe(B)}` }); findings.zfight.push({ a: i, b: j, n: z.n }) }
      }
      const sa = size(A.piece), sb = size(B.piece)
      const inter = [0, 1, 2].map((a) => Math.max(0, Math.min(A.piece.max[a], B.piece.max[a]) - Math.max(A.piece.min[a], B.piece.min[a])))
      const vi = inter[0] * inter[1] * inter[2], va = sa[0] * sa[1] * sa[2], vb = sb[0] * sb[1] * sb[2]
      if (duplicates < 8 * limit && A.piece.material === B.piece.material && va > 1e-7 && vi / (va + vb - vi) > 0.9) { duplicates++; issues.push({ kind: 'duplicado', detail: `${describe(A)} × ${describe(B)}` }); findings.duplicate.push([i, j]) }
      if (piercings < 8 * limit) for (const [rod, slab, ri, si] of [[A, B, i, j], [B, A, j, i]] as const) {
        const r = rod.piece, s = slab.piece
        if (![0, 1, 2].some((ax) => r.min[ax] < s.min[ax] - 0.004 && r.max[ax] > s.max[ax] + 0.004)) continue
        if (pierces(rod, slab)) {
          piercings++; issues.push({ kind: 'atravessa', detail: `${describe(rod)} atravessa ${describe(slab)}` })
          const T = thinAxis(slab).T
          findings.pierce.push({ rod: ri, slab: si, T: [T.x, T.y, T.z] })
          break
        }
      }
    }
  }
  const grounded = new Set<number>()
  built.forEach((b, i) => { if (b.piece.min[1] <= 0.004) grounded.add(find(i)) })
  const floating = new Map<number, Built[]>()
  built.forEach((b, i) => { const root = find(i); if (!grounded.has(root)) floating.set(root, [...(floating.get(root) ?? []), b]) })
  for (const group of floating.values()) {
    const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity]
    for (const b of group) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], b.piece.min[a]); hi[a] = Math.max(hi[a], b.piece.max[a]) }
    issues.push({ kind: 'flutuando', detail: `${group.length} peça(s) (${[...new Set(group.map((b) => b.piece.material))].join('/')}) em ${fmt(lo)}..${fmt(hi)}` })
  }
  if (inspect) {
    built.forEach((_, i) => { if (grounded.has(find(i))) findings.grounded.add(i) })
    findings.floating = [...floating.values()].map((group) => group.map((b) => built.indexOf(b)))
    inspect(built, findings)
  }
  for (const b of built) { b.geometry.dispose() }
  return { issues, triangles, pieces: built.length }
}

async function main() {
  const started = performance.now()
  let audited = 0, failing = 0
  const report: { id: string; triangles: number; pieces: number; issues: Issue[] }[] = []
  const counts = new Map<string, number>()

  const picked = args.find((a) => a.startsWith('--resource='))?.slice(11).split(',').map(resourceAssetId)
  const pool = picked || args.includes('--resources') ? RESOURCE_ASSETS : [...ASSETS, ...RESOURCE_ASSETS]
  for (const spec of pool) {
    if (!SCULPTORS[spec.family]) continue
    if (picked && !picked.includes(spec.id)) continue
    if (only && spec.family !== only) continue
    if (list && !list.includes(spec.family)) continue
    const result = auditSpec(spec)
    audited++
    report.push({ id: spec.id, ...result })
    if (result.issues.length) {
      failing++
      for (const issue of result.issues) counts.set(issue.kind, (counts.get(issue.kind) ?? 0) + 1)
      console.log(`✗ ${spec.id} (${result.pieces} peças, ${result.triangles} tris)`)
      for (const issue of result.issues.slice(0, verbose ? 50 : 6)) console.log(`    · ${issue.kind}: ${issue.detail}`)
    } else if (verbose) console.log(`✓ ${spec.id} (${result.pieces} peças, ${result.triangles} tris)`)
  }
  console.log(`\n${audited} módulos auditados · ${failing} com problemas · ${((performance.now() - started) / 1000).toFixed(1)} s`)
  for (const [kind, n] of counts) console.log(`  ${kind}: ${n}`)
  if (args.includes('--report')) await writeFile(path.join(process.cwd(), 'public/models/blockout/sculpt-audit.json'), JSON.stringify({ generatedAt: new Date().toISOString(), audited, failing, modules: report }, null, 1))
  if (failing) process.exitCode = 1
}

if (process.argv[1]?.includes('audit-sculpts')) main()
