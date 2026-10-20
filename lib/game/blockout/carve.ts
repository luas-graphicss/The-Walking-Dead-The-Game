import { BufferGeometry, Float32BufferAttribute, Matrix4, Uint32BufferAttribute, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { crownBreaks, crownLocal, frameOf, holeOutline, planePoint, spallOutline, type DamageFrame } from './damage'
import { faceFinish, partGeometry, splitFinishes } from './geometry'
import { noise3 } from './sculpt/kit'
import { partQuaternion } from './solid'
import { surfaceFor, textureOrigin } from './surfaces'
import type { BlockPart, Crack, Crown, Hole, MaterialKey, Spall, Vec3 } from './types'

type P2 = [number, number]

type P3 = [number, number, number]
export type CarvedGroup = { material: MaterialKey; surface?: string; geometry: BufferGeometry }
type Finish = { material: MaterialKey; tint: Vec3; tone: number; mottle: number }
const ATTRIBUTES = ['position', 'normal', 'uv', 'color', 'gid']

class Cutter {
  readonly tris: number[] = []
  constructor(readonly plane: 'xy' | 'xz') {}
  private local(p: P3): Vec3 { return planePoint(this.plane, p[0], p[1], p[2]) }
  tri(a: P3, b: P3, c: P3, out: P3) {
    const A = this.local(a), B = this.local(b), C = this.local(c), O = this.local(out)
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    if (nx * nx + ny * ny + nz * nz < 1e-20) return
    if (nx * O[0] + ny * O[1] + nz * O[2] < 0) this.tris.push(...A, ...C, ...B)
    else this.tris.push(...A, ...B, ...C)
  }
  quad(a: P3, b: P3, c: P3, d: P3, out: P3) { this.tri(a, b, c, out); this.tri(a, c, d, out) }

  build(part: BlockPart, finish: Finish, gid: number, seed: number) {
    const count = this.tris.length / 3, spec = surfaceFor({ material: finish.material })
    const position = new Float32Array(count * 3), normal = new Float32Array(count * 3), uv = new Float32Array(count * 2), color = new Float32Array(count * 3)
    const q = partQuaternion(part), matrix = new Matrix4().compose(new Vector3(...part.position), q, new Vector3(1, 1, 1))
    const v = new Vector3(), n = new Vector3(), e1 = new Vector3(), e2 = new Vector3()
    for (let t = 0; t < count; t += 3) {
      const o = t * 3
      e1.set(this.tris[o + 3] - this.tris[o], this.tris[o + 4] - this.tris[o + 1], this.tris[o + 5] - this.tris[o + 2])
      e2.set(this.tris[o + 6] - this.tris[o], this.tris[o + 7] - this.tris[o + 1], this.tris[o + 8] - this.tris[o + 2])
      n.crossVectors(e1, e2).normalize()
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z)
      const world = n.clone().applyQuaternion(q)
      for (let k = 0; k < 3; k++) {
        const i = t + k, x = this.tris[i * 3], y = this.tris[i * 3 + 1], z = this.tris[i * 3 + 2]
        const [pu, pv] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y]
        uv[i * 2] = pu / spec.tile; uv[i * 2 + 1] = pv / spec.tileV
        v.set(x, y, z).applyMatrix4(matrix).toArray(position, i * 3)
        world.toArray(normal, i * 3)
        const shade = finish.tone * (1 - finish.mottle / 2 + finish.mottle * noise3(x * 13 + 1.3, y * 13, z * 13, seed))
        color[i * 3] = finish.tint[0] * shade; color[i * 3 + 1] = finish.tint[1] * shade * 0.985; color[i * 3 + 2] = finish.tint[2] * shade * 0.96
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    geometry.setAttribute('color', new Float32BufferAttribute(color, 3))
    geometry.setAttribute('gid', new Float32BufferAttribute(new Float32Array(count).fill(gid), 1))
    return geometry
  }
}

function loft(c: Cutter, rings: { pts: P2[]; n: number }[], caps: [P3, P3]) {
  const k = rings[0].pts.length
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r], B = rings[r + 1]
    const cx = A.pts.reduce((s, p) => s + p[0], 0) / k, cy = A.pts.reduce((s, p) => s + p[1], 0) / k
    for (let i = 0; i < k; i++) {
      const j = (i + 1) % k
      c.quad([A.pts[i][0], A.pts[i][1], A.n], [A.pts[j][0], A.pts[j][1], A.n], [B.pts[j][0], B.pts[j][1], B.n], [B.pts[i][0], B.pts[i][1], B.n], [(A.pts[i][0] + A.pts[j][0]) / 2 - cx, (A.pts[i][1] + A.pts[j][1]) / 2 - cy, 0])
    }
  }
  const first = rings[0], last = rings[rings.length - 1], s = Math.sign(first.n - last.n) || 1
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k
    c.tri(caps[0], [first.pts[i][0], first.pts[i][1], first.n], [first.pts[j][0], first.pts[j][1], first.n], [0, 0, s])
    c.tri(caps[1], [last.pts[i][0], last.pts[i][1], last.n], [last.pts[j][0], last.pts[j][1], last.n], [0, 0, -s])
  }
}

function holeCutter(c: Cutter, h: Hole, f: DamageFrame) {
  const m = 0.03, front = f.sn / 2 + m
  loft(c, [{ pts: holeOutline(h, 1), n: front }, { pts: holeOutline(h, 0), n: 0 }, { pts: holeOutline(h, -1), n: -front }], [[h.x, h.y, front], [h.x, h.y, -front]])
}

function spallCutter(c: Cutter, sp: Spall, f: DamageFrame) {
  const s = sp.side, face = f.sn / 2
  const bump = (noise3(sp.x * 3, sp.y * 3, 0.5, sp.seed) - 0.5) * Math.min(sp.rx, sp.ry) * 0.3
  loft(c, [
    { pts: spallOutline(sp, 0), n: s * (face + 0.02) },
    { pts: spallOutline(sp, 1), n: s * (face - sp.depth * 0.45) },
    { pts: spallOutline(sp, 2), n: s * (face - sp.depth) },
  ], [[sp.x, sp.y, s * (face + 0.02)], [sp.x + bump, sp.y - bump, s * (face - sp.depth * 1.18)]])
}

function crackCutter(c: Cutter, k: Crack, f: DamageFrame) {
  const pts = k.points, count = pts.length, half = f.sn / 2, m = 0.02
  const lengths = [0]
  for (let i = 1; i < count; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = lengths[count - 1] || 1, [t0, t1] = k.taper ?? [0, 1], [sx, sy] = k.shift ?? [0, 0]
  const segNormal = (i: number): P2 => { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l] }
  const rows: { l: P3; r: P3; a: P3; b: P3; nrm: P2 }[] = []
  for (let i = 0; i < count; i++) {
    const n1 = segNormal(Math.max(0, i - 1)), n2 = segNormal(Math.min(count - 2, i))
    let nx = n1[0] + n2[0], ny = n1[1] + n2[1]
    const l = Math.hypot(nx, ny)
    if (l < 1e-6) { nx = n2[0]; ny = n2[1] } else { nx /= l; ny /= l }
    const miter = 1 / Math.max(0.4, nx * n1[0] + ny * n1[1])
    const t = t0 + (t1 - t0) * lengths[i] / total, w = Math.max(0.0012, k.width * (1 - 0.82 * t ** 1.15)) * miter
    const wobble = (noise3((pts[i][0] + sx) * 9, (pts[i][1] + sy) * 9, 0.5, k.seed) - 0.5) * k.width * 0.9
    const [x, y] = pts[i]
    if (k.side === 0) {
      const wb = w * 0.6
      rows.push({ l: [x - nx * w / 2, y - ny * w / 2, half + m], r: [x + nx * w / 2, y + ny * w / 2, half + m], a: [x + nx * (wobble + wb / 2), y + ny * (wobble + wb / 2), -half - m], b: [x + nx * (wobble - wb / 2), y + ny * (wobble - wb / 2), -half - m], nrm: [nx, ny] })
    } else {
      const s = k.side, depth = Math.min(f.sn * 0.9, Math.max(0.004, k.depth * (1 - 0.7 * t)))
      const apex: P3 = [x + nx * wobble * 0.3, y + ny * wobble * 0.3, s * (half - depth)]
      rows.push({ l: [x - nx * w / 2, y - ny * w / 2, s * (half + m)], r: [x + nx * w / 2, y + ny * w / 2, s * (half + m)], a: apex, b: apex, nrm: [nx, ny] })
    }
  }
  const s = k.side || 1
  for (let i = 0; i < count - 1; i++) {
    const p = rows[i], q = rows[i + 1], [nx, ny] = p.nrm
    c.quad(p.l, p.r, q.r, q.l, [0, 0, s])
    c.quad(p.l, q.l, q.b, p.b, [-nx, -ny, 0])
    c.quad(p.r, q.r, q.a, p.a, [nx, ny, 0])
    if (k.side === 0) c.quad(p.b, p.a, q.a, q.b, [0, 0, -1])
  }
  const head: P3 = [pts[0][0] - pts[1][0], pts[0][1] - pts[1][1], 0], tail: P3 = [pts[count - 1][0] - pts[count - 2][0], pts[count - 1][1] - pts[count - 2][1], 0]
  for (const [row, out] of [[rows[0], head], [rows[count - 1], tail]] as const) {
    if (k.side === 0) c.quad(row.l, row.r, row.a, row.b, out)
    else c.tri(row.l, row.r, row.a, out)
  }
}

const CROWN_GID = 99

function crownedSolid(part: BlockPart, crown: Crown, core: Finish) {
  const [w, h, d] = part.size, top = crownLocal(part, crown), coreSpec = surfaceFor({ material: core.material })
  const origin = textureOrigin(part) ?? [0, 0, 0]
  const us: number[] = []
  for (let u = -w / 2; u < w / 2; u += 0.03) us.push(u)
  us.push(w / 2)
  for (const b of crownBreaks(part, crown, -w / 2, w / 2)) if (b - 0.0015 > -w / 2 && b + 0.0015 < w / 2) us.push(b - 0.0012, b + 0.0012)
  us.sort((a, b) => a - b)
  const xs = us.filter((u, i) => i === 0 || u - us[i - 1] > 0.0004), ns = [-d / 2, -d / 6, d / 6, d / 2]
  const rough = crown.stepped ? 0.012 : crown.grain ? 0.02 : 0.045
  const H = xs.map((u) => ns.map((n) => Math.max(-h / 2 + 0.003, Math.min(h / 2, top(u) + (noise3(u * 7, n * 9, 0.5, crown.seed + 31) - 0.5) * rough))))
  const position: number[] = [], normal: number[] = [], uv: number[] = [], color: number[] = [], gid: number[] = []
  const q = partQuaternion(part), matrix = new Matrix4().compose(new Vector3(...part.position), q, new Vector3(1, 1, 1))
  const v = new Vector3(), nrm = new Vector3(), e1 = new Vector3(), e2 = new Vector3()
  const tri = (a: Vec3, b: Vec3, c: Vec3, out: Vec3, broken: boolean) => {
    e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); nrm.crossVectors(e1, e2)
    if (nrm.lengthSq() < 1e-20) return
    if (nrm.x * out[0] + nrm.y * out[1] + nrm.z * out[2] < 0) [b, c] = [c, b]
    nrm.crossVectors(e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2])).normalize()
    const world = nrm.clone().applyQuaternion(q), face = broken ? null : faceFinish(part, world)
    const ax = Math.abs(nrm.x), ay = Math.abs(nrm.y), az = Math.abs(nrm.z), s = face ? face.spec : coreSpec, tint = face?.tint ?? [1, 1, 1]
    for (const p of [a, b, c]) {
      const [pu, pv] = ax >= ay && ax >= az ? [p[2] + origin[2], p[1] + origin[1]] : ay >= az ? [p[0] + origin[0], p[2] + origin[2]] : [p[0] + origin[0], p[1] + origin[1]]
      uv.push(pu / s.tile, pv / s.tileV)
      v.set(p[0], p[1], p[2]).applyMatrix4(matrix); position.push(v.x, v.y, v.z); normal.push(world.x, world.y, world.z)
      if (broken) {
        const shade = core.tone * (1 - core.mottle / 2 + core.mottle * noise3(p[0] * 13 + 1.3, p[1] * 13, p[2] * 13, crown.seed))
        color.push(core.tint[0] * shade, core.tint[1] * shade * 0.985, core.tint[2] * shade * 0.96)
      } else color.push(tint[0], tint[1], tint[2])
      gid.push(broken ? CROWN_GID : 0)
    }
  }
  const quad = (a: Vec3, b: Vec3, c: Vec3, e: Vec3, out: Vec3, broken = false) => { tri(a, b, c, out, broken); tri(a, c, e, out, broken) }
  const last = ns.length - 1, end = xs.length - 1, intact = (i: number, j: number) => H[i][j] >= h / 2 - 1e-4
  for (let i = 0; i < end; i++) {
    quad([xs[i], -h / 2, d / 2], [xs[i + 1], -h / 2, d / 2], [xs[i + 1], H[i + 1][last], d / 2], [xs[i], H[i][last], d / 2], [0, 0, 1])
    quad([xs[i], -h / 2, -d / 2], [xs[i + 1], -h / 2, -d / 2], [xs[i + 1], H[i + 1][0], -d / 2], [xs[i], H[i][0], -d / 2], [0, 0, -1])
    for (let j = 0; j < last; j++) quad([xs[i], H[i][j], ns[j]], [xs[i + 1], H[i + 1][j], ns[j]], [xs[i + 1], H[i + 1][j + 1], ns[j + 1]], [xs[i], H[i][j + 1], ns[j + 1]], [0, 1, 0], !(intact(i, j) && intact(i + 1, j) && intact(i, j + 1) && intact(i + 1, j + 1)))
  }
  for (let j = 0; j < last; j++) {
    quad([-w / 2, -h / 2, ns[j]], [-w / 2, -h / 2, ns[j + 1]], [-w / 2, H[0][j + 1], ns[j + 1]], [-w / 2, H[0][j], ns[j]], [-1, 0, 0])
    quad([w / 2, -h / 2, ns[j]], [w / 2, -h / 2, ns[j + 1]], [w / 2, H[end][j + 1], ns[j + 1]], [w / 2, H[end][j], ns[j]], [1, 0, 0])
  }
  quad([-w / 2, -h / 2, -d / 2], [w / 2, -h / 2, -d / 2], [w / 2, -h / 2, d / 2], [-w / 2, -h / 2, d / 2], [0, -1, 0])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(color, 3))
  geometry.setAttribute('gid', new Float32BufferAttribute(gid, 1))
  return geometry
}

const coreFinish = (part: BlockPart): Finish => ({ material: part.damage!.core, tint: part.damage!.coreTint ?? [1, 1, 1], tone: 0.86, mottle: 0.28 })

function cuttersFor(part: BlockPart) {
  const d = part.damage!, f = frameOf(part), out: { geometry: BufferGeometry; finish: Finish }[] = []
  const core = coreFinish(part)
  const add = (build: (c: Cutter) => void, finish: Finish, seed: number) => {
    const c = new Cutter(f.plane)
    build(c)
    if (c.tris.length) out.push({ geometry: c.build(part, finish, out.length + 1, seed), finish })
  }

  const holes = d.holes ?? [], skins = (d.spalls ?? []).filter((s) => s.skin), cores = (d.spalls ?? []).filter((s) => !s.skin)
  if (holes.length) add((c) => { for (const h of holes) holeCutter(c, h, f) }, { ...core, tone: holes[0].shards ? 1 : 0.84 }, holes[0].seed)
  if (skins.length) add((c) => { for (const sp of skins) spallCutter(c, sp, f) }, { material: d.skin?.material ?? part.material, tint: d.skin?.tint ?? [0.8, 0.78, 0.74], tone: 0.95, mottle: 0.18 }, skins[0].seed)
  if (cores.length) add((c) => { for (const sp of cores) spallCutter(c, sp, f) }, { ...core, tone: 0.8 }, cores[0].seed)

  if (d.cracks?.length) add((c) => { for (const k of d.cracks!) if (k.points.length >= 2) crackCutter(c, k, f) }, { ...core, tone: 0.4, mottle: 0.2 }, d.cracks[0].seed)
  return out
}

function tagged(geometry: BufferGeometry, gid: number) {
  const source = geometry.getIndex() ? geometry.toNonIndexed() : geometry
  const copy = new BufferGeometry(), count = source.getAttribute('position').count
  for (const name of ['position', 'normal', 'uv']) copy.setAttribute(name, source.getAttribute(name).clone())
  copy.setAttribute('color', source.getAttribute('color')?.clone() ?? new Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3))
  copy.setAttribute('gid', new Float32BufferAttribute(new Float32Array(count).fill(gid), 1))
  if (source !== geometry) source.dispose()
  return copy
}

function solidGeometry(part: BlockPart) {
  const geometry = partGeometry(part, 'collision')
  if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2))
  return geometry
}

function subtractAll(base: BufferGeometry, cutters: BufferGeometry[], evaluator: Evaluator) {
  base.computeBoundingBox()
  let current = new Brush(base)
  current.updateMatrixWorld()
  for (const cutter of cutters) {
    cutter.computeBoundingBox()
    if (!current.geometry.boundingBox) current.geometry.computeBoundingBox()
    if (!current.geometry.boundingBox!.intersectsBox(cutter.boundingBox!)) continue
    const brush = new Brush(cutter)
    brush.updateMatrixWorld()
    const next = evaluator.evaluate(current, brush, SUBTRACTION)
    if (current.geometry !== base) current.geometry.dispose()
    current = next
    current.geometry.computeBoundingBox()
  }
  return current.geometry
}

function pick(geometry: BufferGeometry, keep: (gid: number) => boolean) {
  const flat = geometry.getIndex() ? geometry.toNonIndexed() : geometry
  const gid = flat.getAttribute('gid'), names = ['position', 'normal', 'uv', 'color'] as const
  const source = names.map((name) => flat.getAttribute(name)), out: number[][] = names.map(() => [])
  for (let t = 0; t < gid.count; t += 3) {
    if (!keep(Math.round(gid.getX(t)))) continue
    for (let k = t; k < t + 3; k++) source.forEach((attribute, a) => { for (let c = 0; c < attribute.itemSize; c++) out[a].push(attribute.array[k * attribute.itemSize + c]) })
  }
  if (flat !== geometry) flat.dispose()
  const result = new BufferGeometry()
  names.forEach((name, a) => result.setAttribute(name, new Float32BufferAttribute(out[a], source[a].itemSize)))
  return result
}

const cache = new Map<string, CarvedGroup[]>()

export function carveDamaged(parts: BlockPart[], key: string): CarvedGroup[] {
  const cached = cache.get(key)
  if (cached) return cached.map((group) => ({ ...group, geometry: group.geometry.clone() }))
  const evaluator = new Evaluator()
  evaluator.attributes = ATTRIBUTES
  evaluator.useGroups = false
  const buckets = new Map<string, { material: MaterialKey; surface?: string; list: BufferGeometry[] }>()
  const put = (material: MaterialKey, surface: string | undefined, geometry: BufferGeometry) => {
    if (!geometry.getAttribute('position').count) { geometry.dispose(); return }
    const id = surface ?? material, bucket = buckets.get(id) ?? { material, surface, list: [] }
    bucket.list.push(geometry); buckets.set(id, bucket)
  }
  const putSkin = (part: BlockPart, geometry: BufferGeometry) => {
    if (!geometry.getAttribute('position').count) { geometry.dispose(); return }
    for (const piece of splitFinishes(part, geometry)) put(piece.material, piece.surface, piece.geometry)
  }
  for (const part of parts) {
    const cutters = part.damage ? cuttersFor(part) : []
    const crown = part.damage?.crown && frameOf(part).plane === 'xy' ? part.damage.crown : null
    if (crown) {

      const base = crownedSolid(part, crown, coreFinish(part))
      const result = cutters.length ? subtractAll(base, cutters.map((c) => c.geometry), evaluator) : base
      putSkin(part, pick(result, (gid) => gid === 0))
      put(part.damage!.core, undefined, pick(result, (gid) => gid === CROWN_GID))
      cutters.forEach((cutter, i) => put(cutter.finish.material, undefined, pick(result, (gid) => gid === i + 1)))
      for (const geometry of new Set([base, result, ...cutters.map((c) => c.geometry)])) geometry.dispose()
      continue
    }
    const source = partGeometry(part), open = Boolean(source.userData.open), render = tagged(source, 0)
    if (source !== render) source.dispose()
    if (!cutters.length) { putSkin(part, pick(render, () => true)); render.dispose(); continue }
    const skin = subtractAll(render, cutters.map((c) => c.geometry), evaluator)
    putSkin(part, pick(skin, (gid) => gid === 0))
    const solid = open ? tagged(solidGeometry(part), 0) : null
    const faces = solid ? subtractAll(solid, cutters.map((c) => c.geometry), evaluator) : skin
    cutters.forEach((cutter, i) => put(cutter.finish.material, undefined, pick(faces, (gid) => gid === i + 1)))
    for (const geometry of new Set([render, skin, faces, ...(solid ? [solid] : []), ...cutters.map((c) => c.geometry)])) geometry.dispose()
  }
  const result: CarvedGroup[] = []
  for (const { material, surface, list } of buckets.values()) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false)
    if (!merged) continue
    if (merged !== list[0]) list.forEach((geometry) => geometry.dispose())
    merged.setIndex(new Uint32BufferAttribute(Uint32Array.from({ length: merged.getAttribute('position').count }, (_, i) => i), 1))
    merged.computeBoundingBox(); merged.computeBoundingSphere()
    result.push({ material, surface, geometry: merged })
  }
  cache.set(key, result.map((group) => ({ ...group, geometry: group.geometry.clone() })))
  if (cache.size > 8) cache.delete(cache.keys().next().value!)
  return result
}
