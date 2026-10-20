import { BufferGeometry, Float32BufferAttribute } from 'three'
import { BLOCK_MATERIALS, hash, type BlockPart, type Vec3 } from './types'
import { partQuaternion } from './solid'

export const BRICK_LAYOUT = { length: 0.225, course: 0.075, joint: 0.01, perTileU: 4, perTileV: 8 } as const
export const BRICK_TILE = { u: BRICK_LAYOUT.length * BRICK_LAYOUT.perTileU, v: BRICK_LAYOUT.course * BRICK_LAYOUT.perTileV } as const
export const BRICK_RECESS = 0.01

export const WOOD_TILE = 0.8
export const WOOD_COLUMNS = 4
const LANE = WOOD_TILE / WOOD_COLUMNS
function laneU(pick: number, center: number, width: number) {
  const column = Math.min(WOOD_COLUMNS - 1, Math.floor(pick * WOOD_COLUMNS)), squeeze = Math.min(1, 0.84 * LANE / width)
  return (a: number) => (column + 0.5) * LANE + (a - center) * squeeze
}

type V3 = [number, number, number]
type RGB = [number, number, number]
type Face = { n: V3; u: V3; v: V3; na: number; ua: number; va: number }
type Ctx = { f: Face; index: number; half: number; s0: number; s1: number; t0: number; t1: number; offU: number; offV: number }

const FACES: Face[] = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], na: 0, ua: 2, va: 1 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], na: 0, ua: 2, va: 1 },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], na: 1, ua: 0, va: 2 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], na: 1, ua: 0, va: 2 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], na: 2, ua: 0, va: 1 },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], na: 2, ua: 0, va: 1 },
]
const faceIndex = (axis: number, sign: number) => axis * 2 + (sign > 0 ? 0 : 1)

function mix(h: number, value: number) {
  h = Math.imul(h ^ (value | 0), 0x5bd1e995)
  return h ^ (h >>> 13)
}
function rand(a: number, b = 0, c = 0, d = 0) {
  let h = mix(mix(mix(mix(0x9747b28c, a), b), c), d)
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const ease = (x: number) => x * x * (3 - 2 * x)
const smoothstep = (a: number, b: number, x: number) => ease(Math.max(0, Math.min(1, (x - a) / (b - a))))
function noise2(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), u = ease(x - xi), v = ease(y - yi)
  const a = rand(xi, yi, seed), b = rand(xi + 1, yi, seed), c = rand(xi, yi + 1, seed), d = rand(xi + 1, yi + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm2 = (x: number, y: number, seed: number) => noise2(x, y, seed) * 0.57 + noise2(x * 2.07, y * 2.07, seed + 31) * 0.29 + noise2(x * 4.3, y * 4.3, seed + 57) * 0.14
function noise3(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = ease(x - xi), v = ease(y - yi), w = ease(z - zi)
  const r = (i: number, j: number, k: number) => rand(xi + i, yi + j, zi + k, seed)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(l(l(r(0, 0, 0), r(1, 0, 0), u), l(r(0, 1, 0), r(1, 1, 0), u), v), l(l(r(0, 0, 1), r(1, 0, 1), u), l(r(0, 1, 1), r(1, 1, 1), u), v), w)
}
const linspace = (a: number, b: number, segments: number) => Array.from({ length: segments + 1 }, (_, i) => a + (b - a) * i / segments)
const tint = (k: number, warm = 0): RGB => [Math.min(1.1, k * (1 + warm)), Math.min(1.1, k), Math.min(1.1, k * (1 - warm))]
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]]

class MeshData {
  readonly p: number[] = []
  readonly uv: number[] = []
  readonly c: number[] = []
  readonly idx: number[] = []
  constructor(readonly authored: number) {}
  vert(x: number, y: number, z: number, u: number, v: number, col: RGB) {
    this.p.push(x, y, z); this.uv.push(u / this.authored, v / this.authored); this.c.push(col[0], col[1], col[2])
    return this.p.length / 3 - 1
  }
  tri(a: number, b: number, c: number, out: V3) {
    const p = this.p, ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2]
    const ux = p[b * 3] - ax, uy = p[b * 3 + 1] - ay, uz = p[b * 3 + 2] - az, vx = p[c * 3] - ax, vy = p[c * 3 + 1] - ay, vz = p[c * 3 + 2] - az
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    if (nx * nx + ny * ny + nz * nz < 1e-16) return
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) this.idx.push(a, c, b)
    else this.idx.push(a, b, c)
  }
  quad(a: number, b: number, c: number, d: number, out: V3) { this.tri(a, b, c, out); this.tri(a, c, d, out) }
  geometry() {
    const remap = new Int32Array(this.p.length / 3).fill(-1)
    let count = 0
    for (const i of this.idx) if (remap[i] < 0) remap[i] = count++
    const position = new Float32Array(count * 3), uv = new Float32Array(count * 2), color = new Float32Array(count * 3)
    for (let i = 0; i < remap.length; i++) {
      const j = remap[i]
      if (j < 0) continue
      for (let k = 0; k < 3; k++) { position[j * 3 + k] = this.p[i * 3 + k]; color[j * 3 + k] = this.c[i * 3 + k] }
      uv[j * 2] = this.uv[i * 2]; uv[j * 2 + 1] = this.uv[i * 2 + 1]
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    geometry.setAttribute('color', new Float32BufferAttribute(color, 3))
    geometry.setIndex(this.idx.map((i) => remap[i]))
    geometry.computeVertexNormals()
    return geometry
  }
}

function context(size: Vec3, index: number, insets: number[], origin: Vec3): Ctx {
  const f = FACES[index], hu = size[f.ua] / 2, hv = size[f.va] / 2, us = f.u[f.ua], vs = f.v[f.va]
  return {
    f, index, half: size[f.na] / 2,
    s0: -hu + insets[faceIndex(f.ua, -us)], s1: hu - insets[faceIndex(f.ua, us)],
    t0: -hv + insets[faceIndex(f.va, -vs)], t1: hv - insets[faceIndex(f.va, vs)],
    offU: origin[0] * f.u[0] + origin[1] * f.u[1] + origin[2] * f.u[2],
    offV: origin[0] * f.v[0] + origin[1] * f.v[1] + origin[2] * f.v[2],
  }
}
function point(c: Ctx, s: number, t: number, depth: number): V3 {
  const k = c.half - depth, { n, u, v } = c.f
  return [n[0] * k + u[0] * s + v[0] * t, n[1] * k + u[1] * s + v[1] * t, n[2] * k + u[2] * s + v[2] * t]
}
function planarVert(m: MeshData, c: Ctx, s: number, t: number, depth: number, col: RGB) {
  const [x, y, z] = point(c, s, t, depth)
  return m.vert(x, y, z, s + c.offU, t + c.offV, col)
}

function hexCap(m: MeshData, c: Ctx, s: number, t: number, depth: number, radius: number, col: RGB) {
  const center = planarVert(m, c, s, t, depth, shade(col, 1.08))
  const ring = Array.from({ length: 6 }, (_, k) => planarVert(m, c, s + Math.cos(k * Math.PI / 3) * radius, t + Math.sin(k * Math.PI / 3) * radius, depth + 0.0004, col))
  for (let k = 0; k < 6; k++) m.tri(center, ring[k], ring[(k + 1) % 6], c.f.n)
}

type Hole = { s: number; t: number; half: number; r: number }
type RaisedSpec = {
  ss: number[]; ts: number[]
  s0: number; s1: number; t0: number; t1: number
  c: number; back: number
  depth: (s: number, t: number) => number
  uv: (s: number, t: number) => [number, number]
  color: (s: number, t: number) => RGB
  holes?: Hole[]
}

function raised(m: MeshData, c: Ctx, r: RaisedSpec) {
  const { ss, ts } = r, ns = ss.length, nt = ts.length, { n, u, v } = c.f
  const vert = (s: number, t: number, depth: number, us = s, vt = t, dim = 1) => {
    const [x, y, z] = point(c, s, t, depth), [tu, tv] = r.uv(us, vt), col = r.color(s, t)
    return m.vert(x, y, z, tu, tv, dim === 1 ? col : shade(col, dim))
  }
  const front: number[] = []
  for (const t of ts) for (const s of ss) front.push(vert(s, t, r.depth(s, t)))
  const at = (i: number, j: number) => front[j * ns + i]
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-7
  for (let j = 0; j < nt - 1; j++) for (let i = 0; i < ns - 1; i++) {
    const hole = r.holes?.find((h) => near(ss[i], h.s - h.half) && near(ss[i + 1], h.s + h.half) && near(ts[j], h.t - h.half) && near(ts[j + 1], h.t + h.half))
    if (!hole) { m.quad(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1), n); continue }
    const corners = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], rim: number[] = [], cone: number[] = []
    for (let k = 0; k < 8; k++) {
      const angle = -0.75 * Math.PI + k * Math.PI / 4, s = hole.s + Math.cos(angle) * hole.r, t = hole.t + Math.sin(angle) * hole.r, depth = r.depth(s, t) + 0.0005
      rim.push(vert(s, t, depth, s, t, 0.9)); cone.push(vert(s, t, depth, s, t, 0.62))
    }
    const apex = vert(hole.s, hole.t, r.depth(hole.s, hole.t) + 0.008, hole.s, hole.t, 0.32)
    for (let k = 0; k < 4; k++) {
      const a = corners[k], b = corners[(k + 1) % 4], p0 = rim[2 * k], p1 = rim[2 * k + 1], p2 = rim[(2 * k + 2) % 8]
      m.tri(a, b, p1, n); m.tri(a, p1, p0, n); m.tri(b, p2, p1, n)
    }
    for (let k = 0; k < 8; k++) m.tri(cone[k], cone[(k + 1) % 8], apex, n)
  }
  const spanS = ss[ns - 1] - ss[0], spanT = ts[nt - 1] - ts[0]
  const mapS = (s: number) => spanS > 1e-9 ? r.s0 + (s - ss[0]) / spanS * (r.s1 - r.s0) : (r.s0 + r.s1) / 2
  const mapT = (t: number) => spanT > 1e-9 ? r.t0 + (t - ts[0]) / spanT * (r.t1 - r.t0) : (r.t0 + r.t1) / 2
  const edges: { line: [number, number][]; outer: (s: number, t: number) => [number, number]; out: V3; side: V3; unfold: [number, number] }[] = [
    { line: ss.map((s) => [s, ts[0]]), outer: (s) => [mapS(s), r.t0], out: add(n, v, -1), side: neg(v), unfold: [0, -1] },
    { line: ss.map((s) => [s, ts[nt - 1]]), outer: (s) => [mapS(s), r.t1], out: add(n, v), side: v, unfold: [0, 1] },
    { line: ts.map((t) => [ss[0], t]), outer: (_s, t) => [r.s0, mapT(t)], out: add(n, u, -1), side: neg(u), unfold: [-1, 0] },
    { line: ts.map((t) => [ss[ns - 1], t]), outer: (_s, t) => [r.s1, mapT(t)], out: add(n, u), side: u, unfold: [1, 0] },
  ]
  for (const edge of edges) for (let k = 0; k < edge.line.length - 1; k++) {
    const [sa, ta] = edge.line[k], [sb, tb] = edge.line[k + 1], da = r.depth(sa, ta), db = r.depth(sb, tb)
    const [oas, oat] = edge.outer(sa, ta), [obs, obt] = edge.outer(sb, tb)
    if (r.c > 0) m.quad(vert(sa, ta, da), vert(sb, tb, db), vert(obs, obt, db + r.c), vert(oas, oat, da + r.c), edge.out)
    const ga = r.back - da - r.c, gb = r.back - db - r.c
    if (ga <= 0.0002 && gb <= 0.0002) continue
    m.quad(
      vert(oas, oat, da + r.c), vert(obs, obt, db + r.c),
      vert(obs, obt, r.back, obs + edge.unfold[0] * gb, obt + edge.unfold[1] * gb, 0.7),
      vert(oas, oat, r.back, oas + edge.unfold[0] * ga, oat + edge.unfold[1] * ga, 0.7),
      edge.side,
    )
  }
}

function gridLines(a: number, b: number, spacing: number, keep: number[] = [], blocked: [number, number][] = []) {
  const base = linspace(a, b, Math.max(1, Math.ceil((b - a) / spacing)))
  const free = base.filter((value, i) => i === 0 || i === base.length - 1 || (keep.every((k) => Math.abs(value - k) > 0.006) && blocked.every(([lo, hi]) => value < lo - 0.006 || value > hi + 0.006)))
  return [...free, ...keep.filter((k) => k > a && k < b)].sort((x, y) => x - y)
}

function brickFace(m: MeshData, c: Ctx, seed: number, back: number) {
  const { length: L, course: H, joint: J } = BRICK_LAYOUT
  for (let k = Math.floor((c.t0 + c.offV) / H); k < Math.ceil((c.t1 + c.offV) / H); k++) {
    const t0 = Math.max(c.t0, k * H + J / 2 - c.offV), t1 = Math.min(c.t1, (k + 1) * H - J / 2 - c.offV)
    if (t1 - t0 < 0.012) continue
    const shift = (k & 1) * L / 2
    for (let i = Math.floor((c.s0 + c.offU - shift) / L); i < Math.ceil((c.s1 + c.offU - shift) / L); i++) {
      const s0 = Math.max(c.s0, i * L + shift + J / 2 - c.offU), s1 = Math.min(c.s1, (i + 1) * L + shift - J / 2 - c.offU)
      if (s1 - s0 < 0.02) continue
      const r = (n: number) => rand(i, k, seed, n)
      if (r(1) < 0.012) continue
      const spall = r(2) < 0.06, e = 0.0006 + r(3) * 0.0018 + (spall ? 0.0026 : 0)
      const ts = (r(4) - 0.5) * 0.0013, tt = (r(5) - 0.5) * 0.0009, sc = (s0 + s1) / 2, tc = (t0 + t1) / 2, sw = s1 - s0, th = t1 - t0
      const depth = (s: number, t: number) => e + ts * (s - sc) / sw + tt * (t - tc) / th + (spall ? 0.0016 * noise2((s + c.offU) * 60, (t + c.offV) * 60, seed) : 0)
      const ch = Math.min(0.003, sw * 0.18, th * 0.18), col = tint(0.84 + r(6) * 0.24, (r(7) - 0.5) * 0.08)
      raised(m, c, {
        ss: linspace(s0 + ch, s1 - ch, spall ? 3 : 1), ts: linspace(t0 + ch, t1 - ch, spall ? 2 : 1), s0, s1, t0, t1, c: ch, back, depth,
        uv: (s, t) => [s + c.offU, t + c.offV], color: () => col,
      })
    }
  }
}

type BoardOptions = { vertical: boolean; battens: boolean; burned: boolean; seed: number; back: number; batten: number; grime: (t: number) => number }
function boardFace(m: MeshData, c: Ctx, o: BoardOptions) {
  const pitch = o.vertical ? 0.2 : 0.18, seed = o.seed
  const a0 = o.vertical ? c.s0 : c.t0, a1 = o.vertical ? c.s1 : c.t1, l0 = o.vertical ? c.t0 : c.s0, l1 = o.vertical ? c.t1 : c.s1
  const offA = o.vertical ? c.offU : c.offV, offL = o.vertical ? c.offV : c.offU
  const edge = (i: number) => i * pitch + (rand(i, 11, seed) - 0.5) * 0.05
  const gap = (i: number) => 0.006 + rand(i, 12, seed) * 0.008 + (rand(i, 13, seed) < (o.burned ? 0.16 : 0.07) ? 0.018 : 0)
  const st = (a: number, l: number): [number, number] => o.vertical ? [a, l] : [l, a]
  const al = (s: number, t: number): [number, number] => o.vertical ? [s, t] : [t, s]
  const first = Math.floor((a0 + offA) / pitch) - 1, last = Math.ceil((a1 + offA) / pitch) + 1
  const nails = (b0: number, b1: number, e0: number, e1: number, depth: (s: number, t: number) => number, spots: number[]) => {
    const spacing = o.vertical ? 1.05 : 0.6
    for (let g = Math.ceil((e0 + 0.05 + offL - 0.32) / spacing); g * spacing + 0.32 - offL < e1 - 0.05; g++) {
      const l = g * spacing + 0.32 - offL
      for (const k of spots) { const [s, t] = st(b0 + (b1 - b0) * k, l); hexCap(m, c, s, t, Math.max(0, depth(s, t) - 0.0012), 0.0055, [0.44, 0.33, 0.27]) }
    }
  }
  for (let i = first; i <= last; i++) {
    const b0 = Math.max(a0, edge(i) + gap(i) / 2 - offA), b1 = Math.min(a1, edge(i + 1) - gap(i + 1) / 2 - offA)
    if (b1 - b0 < 0.035) continue
    let e0 = l0, e1 = l1
    if (rand(i, 14, seed) < (o.burned ? 0.5 : 0.22)) e0 += 0.01 + rand(i, 15, seed) * (o.burned ? 0.12 : 0.05)
    if (rand(i, 16, seed) < (o.burned ? 0.24 : 0.06)) { const cut = 0.08 + rand(i, 17, seed) * 0.42; if (e1 - e0 - cut > 0.45) e1 -= cut }
    if (e1 - e0 < 0.12) continue
    const e = o.batten + 0.0004 + rand(i, 18, seed) * 0.0035, bow = rand(i, 19, seed) * 0.0022, cup = o.burned ? 0.003 : 0.0014
    const lane = laneU(rand(i, 23, seed), (b0 + b1) / 2, b1 - b0), slide = rand(i, 20, seed) * WOOD_TILE * 3
    const col = tint((0.8 + rand(i, 21, seed) * 0.28) * (o.burned ? 0.62 : 1), (rand(i, 22, seed) - 0.5) * 0.07)
    const depth = (s: number, t: number) => {
      const [a, l] = al(s, t), ar = (a - b0) / (b1 - b0), lr = Math.min(1, Math.max(0, (l - e0) / (e1 - e0)))
      return e + cup * (1 - (2 * ar - 1) ** 2) + bow * Math.sin(Math.PI * lr)
    }
    const ch = Math.min(0.0028, (b1 - b0) * 0.12)
    const across = [b0 + ch, (b0 + b1) / 2, b1 - ch], along = linspace(e0 + ch, e1 - ch, Math.max(1, Math.round((e1 - e0) / 0.35)))
    const [s0, t0] = st(b0, e0), [s1, t1] = st(b1, e1)
    raised(m, c, {
      ss: o.vertical ? across : along, ts: o.vertical ? along : across, s0, s1, t0, t1, c: ch, back: o.back, depth,
      uv: (s, t) => { const [a, l] = al(s, t); return [lane(a), l + offL + slide] },
      color: (_s, t) => shade(col, o.grime(t)),
    })
    nails(b0, b1, e0, e1, depth, b1 - b0 > 0.12 ? [0.27, 0.73] : [0.5])
  }
  if (!o.battens) return
  for (let i = first; i <= last; i++) {
    if (rand(i, 30, seed) < 0.09) continue
    const center = edge(i) - offA, b0 = Math.max(a0, center - 0.028), b1 = Math.min(a1, center + 0.028)
    if (b1 - b0 < 0.02) continue
    const e0 = l0 + (rand(i, 31, seed) < 0.3 ? rand(i, 32, seed) * 0.08 : 0), e1 = l1
    const e = 0.0003 + rand(i, 33, seed) * 0.0014, lane = laneU(rand(i, 36, seed), center, b1 - b0), slide = rand(i, 34, seed) * WOOD_TILE * 3
    const col = tint((0.78 + rand(i, 35, seed) * 0.26) * (o.burned ? 0.62 : 1))
    const ch = 0.0024, depth = () => e
    const across = [b0 + ch, b1 - ch], along = linspace(e0 + ch, e1 - ch, Math.max(1, Math.round((e1 - e0) / 0.5)))
    const [s0, t0] = st(b0, e0), [s1, t1] = st(b1, e1)
    raised(m, c, {
      ss: o.vertical ? across : along, ts: o.vertical ? along : across, s0, s1, t0, t1, c: ch, back: o.batten + 0.003, depth,
      uv: (s, t) => { const [a, l] = al(s, t); return [lane(a), l + offL + slide] },
      color: (_s, t) => shade(col, o.grime(t)),
    })
    nails(b0, b1, e0, e1, depth, [0.5])
  }
}

type ConcreteOptions = { pu: number; pv: number; groove: number; back: number; lip: number; amp: number; holes: boolean; seed: number; grime: (t: number) => number }
function concreteFace(m: MeshData, c: Ctx, o: ConcreteOptions) {
  for (let i = Math.floor((c.s0 + c.offU) / o.pu); i <= Math.floor((c.s1 + c.offU - 1e-6) / o.pu); i++) {
    for (let j = Math.floor((c.t0 + c.offV) / o.pv); j <= Math.floor((c.t1 + c.offV - 1e-6) / o.pv); j++) {
      const ps0 = i * o.pu - c.offU, pt0 = j * o.pv - c.offV
      const s0 = Math.max(c.s0, ps0 + o.groove), s1 = Math.min(c.s1, ps0 + o.pu - o.groove), t0 = Math.max(c.t0, pt0 + o.groove), t1 = Math.min(c.t1, pt0 + o.pv - o.groove)
      if (s1 - s0 < 0.03 || t1 - t0 < 0.03) continue
      const lip = rand(i, j, o.seed, 1) * o.lip, tone = 0.88 + rand(i, j, o.seed, 2) * 0.16
      const depth = (s: number, t: number) => 0.0006 + lip + o.amp * fbm2((s + c.offU) * 2.3, (t + c.offV) * 2.3, o.seed)
      const ch = Math.min(0.0016, (s1 - s0) * 0.1, (t1 - t0) * 0.1), holes: Hole[] = []
      if (o.holes) for (const hx of [0.25, 0.75]) for (const hy of [0.25, 0.75]) {
        const hs = ps0 + hx * o.pu, ht = pt0 + hy * o.pv, half = 0.022
        if (hs - half > s0 + ch + 0.01 && hs + half < s1 - ch - 0.01 && ht - half > t0 + ch + 0.01 && ht + half < t1 - ch - 0.01) holes.push({ s: hs, t: ht, half, r: 0.0105 })
      }
      raised(m, c, {
        ss: gridLines(s0 + ch, s1 - ch, 0.25, holes.flatMap((h) => [h.s - h.half, h.s + h.half]), holes.map((h) => [h.s - h.half, h.s + h.half])),
        ts: gridLines(t0 + ch, t1 - ch, 0.25, holes.flatMap((h) => [h.t - h.half, h.t + h.half]), holes.map((h) => [h.t - h.half, h.t + h.half])),
        s0, s1, t0, t1, c: ch, back: o.back, depth, holes,
        uv: (s, t) => [s + c.offU, t + c.offV], color: (_s, t) => shade([tone, tone, tone * 0.985], o.grime(t)),
      })
    }
  }
}

function plasterFace(m: MeshData, c: Ctx, seed: number, grime: (t: number) => number) {
  const ss = linspace(c.s0, c.s1, Math.max(2, Math.ceil((c.s1 - c.s0) / 0.09))), ts = linspace(c.t0, c.t1, Math.max(2, Math.ceil((c.t1 - c.t0) / 0.09)))
  const cell = 1.6, patches: { x: number; y: number; r: number; id: number }[] = []
  for (let cu = Math.floor((c.s0 + c.offU) / cell) - 1; cu <= Math.ceil((c.s1 + c.offU) / cell); cu++) {
    for (let cv = Math.floor((c.t0 + c.offV) / cell) - 1; cv <= Math.ceil((c.t1 + c.offV) / cell); cv++) {
      if (rand(cu, cv, seed, 1) < 0.5) patches.push({ x: (cu + 0.15 + rand(cu, cv, seed, 2) * 0.7) * cell, y: (cv + 0.15 + rand(cu, cv, seed, 3) * 0.7) * cell, r: 0.16 + rand(cu, cv, seed, 4) * 0.4, id: cu * 31 + cv * 7 })
    }
  }
  const patchAt = (x: number, y: number) => {
    let best = 0
    for (const p of patches) {
      const dx = x - p.x, dy = y - p.y, distance = Math.hypot(dx, dy)
      if (distance > p.r * 1.3) continue
      const angle = Math.atan2(dy, dx), edge = p.r * (0.72 + 0.5 * noise2(Math.cos(angle) * 1.8 + p.id, Math.sin(angle) * 1.8, seed))
      best = Math.max(best, smoothstep(0, 0.05, edge - distance))
    }
    return best
  }
  const grid: number[] = []
  for (const t of ts) for (const s of ss) {
    const x = s + c.offU, y = t + c.offV, fade = smoothstep(0, 0.05, Math.min(s - c.s0, c.s1 - s, t - c.t0, c.t1 - t)), patch = patchAt(x, y)
    const k = (1 - patch * 0.26) * grime(t)
    grid.push(planarVert(m, c, s, t, fade * (0.0005 + 0.0011 * fbm2(x * 1.4, y * 1.4, seed) + 0.0075 * patch), [k, k * (1 - patch * 0.05), k * (1 - patch * 0.11)]))
  }
  for (let j = 0; j < ts.length - 1; j++) for (let i = 0; i < ss.length - 1; i++) {
    const a = j * ss.length + i
    m.quad(grid[a], grid[a + 1], grid[a + 1 + ss.length], grid[a + ss.length], c.f.n)
  }
}

function corrugatedFace(m: MeshData, c: Ctx, seed: number, back: number, grime: (t: number) => number) {
  const amplitude = 0.0075, period = 0.076, step = period / 6, { n, u, v } = c.f
  const ss = [c.s0]
  for (let j = Math.ceil((c.s0 + c.offU) / step); j * step - c.offU < c.s1; j++) { const s = j * step - c.offU; if (s - ss[ss.length - 1] > 0.002) ss.push(s) }
  if (c.s1 - ss[ss.length - 1] > 0.002) ss.push(c.s1); else ss[ss.length - 1] = c.s1
  const ts = linspace(c.t0, c.t1, Math.max(1, Math.ceil((c.t1 - c.t0) / 0.6)))
  const dents: { x: number; y: number; r: number }[] = []
  for (let cu = Math.floor((c.s0 + c.offU) / 1.3) - 1; cu <= Math.ceil((c.s1 + c.offU) / 1.3); cu++) {
    for (let cv = Math.floor((c.t0 + c.offV) / 1.3) - 1; cv <= Math.ceil((c.t1 + c.offV) / 1.3); cv++) {
      if (rand(cu, cv, seed, 5) < 0.4) dents.push({ x: (cu + rand(cu, cv, seed, 6)) * 1.3, y: (cv + rand(cu, cv, seed, 7)) * 1.3, r: 0.18 + rand(cu, cv, seed, 8) * 0.25 })
    }
  }
  const depth = (s: number, t: number) => {
    const x = s + c.offU, y = t + c.offV
    let dent = 0
    for (const d of dents) { const q = Math.hypot(x - d.x, y - d.y) / d.r; if (q < 1) dent = Math.max(dent, 0.0055 * (1 - q * q) ** 2) }
    return 0.0004 + amplitude * (1 + Math.cos(2 * Math.PI * x / period)) + dent
  }
  const color = (s: number, t: number): RGB => {
    const rust = smoothstep(0.55, 0.8, fbm2((s + c.offU) * 4, (t + c.offV) * 0.7, seed + 9)), g = grime(t)
    return [g * (1 - rust * 0.05), g * (1 - rust * 0.2), g * (1 - rust * 0.32)]
  }
  const vert = (s: number, t: number, d: number, us = s, vt = t, dim = 1) => {
    const [x, y, z] = point(c, s, t, d)
    return m.vert(x, y, z, us + c.offU, vt + c.offV, shade(color(s, t), dim))
  }
  const grid: number[] = []
  for (const t of ts) for (const s of ss) grid.push(vert(s, t, depth(s, t)))
  for (let j = 0; j < ts.length - 1; j++) for (let i = 0; i < ss.length - 1; i++) {
    const a = j * ss.length + i
    m.quad(grid[a], grid[a + 1], grid[a + 1 + ss.length], grid[a + ss.length], n)
  }
  for (const [s, side, sign] of [[c.s0, neg(u), -1], [c.s1, u, 1]] as [number, V3, number][]) for (let j = 0; j < ts.length - 1; j++) {
    const da = depth(s, ts[j]), db = depth(s, ts[j + 1])
    m.quad(vert(s, ts[j], da), vert(s, ts[j + 1], db), vert(s, ts[j + 1], back, s + sign * (back - db), ts[j + 1], 0.7), vert(s, ts[j], back, s + sign * (back - da), ts[j], 0.7), side)
  }
  for (const [t, side, sign] of [[c.t0, neg(v), -1], [c.t1, v, 1]] as [number, V3, number][]) for (let i = 0; i < ss.length - 1; i++) {
    const da = depth(ss[i], t), db = depth(ss[i + 1], t)
    m.quad(vert(ss[i], t, da), vert(ss[i + 1], t, db), vert(ss[i + 1], t, back, ss[i + 1], t + sign * (back - db), 0.7), vert(ss[i], t, back, ss[i], t + sign * (back - da), 0.7), side)
  }
  for (let row = Math.ceil((c.t0 + c.offV - 0.4) / 1.1); row * 1.1 + 0.4 - c.offV < c.t1 - 0.05; row++) {
    const t = row * 1.1 + 0.4 - c.offV
    if (t < c.t0 + 0.05) continue
    for (let col = Math.ceil((c.s0 + c.offU + 0.02) / (period * 2)); col * period * 2 - c.offU < c.s1 - 0.02; col++) {
      const s = col * period * 2 - c.offU
      hexCap(m, c, s, t, depth(s, t) - 0.0018, 0.0062, [0.72, 0.72, 0.74])
    }
  }
}

function post(m: MeshData, part: BlockPart, seed: number, wood: boolean, grounded: boolean) {
  const size = part.size, L = size.indexOf(Math.max(...size)), A = (L + 1) % 3, B = (L + 2) % 3
  const hl = size[L] / 2, ha = size[A] / 2, hb = size[B] / 2, cc = Math.min(wood ? 0.012 : 0.016, Math.min(ha, hb) * 0.28)
  const at = (l: number, a: number, b: number): V3 => { const p: V3 = [0, 0, 0]; p[L] = l; p[A] = a; p[B] = b; return p }
  const poly: [number, number][] = [[ha, -hb + cc], [ha, hb - cc], [ha - cc, hb], [-ha + cc, hb], [-ha, hb - cc], [-ha, -hb + cc], [-ha + cc, -hb], [ha - cc, -hb]]
  const ls = linspace(-hl, hl, Math.max(1, Math.ceil(2 * hl / 0.16)))
  const tone = wood ? 0.84 + rand(seed, 40) * 0.24 : 0.9 + rand(seed, 40) * 0.12, base = tint(tone, wood ? (rand(seed, 41) - 0.5) * 0.06 : 0)
  const colorAt = (l: number): RGB => shade(base, grounded && L === 1 ? 0.8 + 0.2 * smoothstep(0, 0.55, l + hl) : 1)
  for (let k = 0; k < 8; k++) {
    const [pa, pb] = poly[k], [qa, qb] = poly[(k + 1) % 8], len = Math.hypot(qa - pa, qb - pb)
    if (len < 1e-5) continue
    const na = (qb - pb) / len, nb = -(qa - pa) / len, out = at(0, na, nb), big = k % 2 === 0
    const check = big && wood && rand(seed, k, 1) < 0.65 ? { w: 0.3 + rand(seed, k, 2) * 0.4, l0: -hl + rand(seed, k, 3) * hl * 0.8, l1: hl - rand(seed, k, 4) * hl * 0.8 } : null
    const half = check ? 0.007 / len : 0
    const ws = big ? [...new Set([0, 0.2, 0.5, 0.8, 1, ...(check ? [check.w - half, check.w, check.w + half] : [])])].filter((w) => w >= 0 && w <= 1).sort((a, b) => a - b) : [0, 1]
    const shift = rand(seed, k, 9) * 2.3, lane = laneU(rand(seed, k, 10), len / 2, len)
    const depth = (w: number, l: number) => {
      if (!big) return 0
      let d = (wood ? 0.0006 : 0.0007) * fbm2(w * len * 9, l * 3, seed + k) * smoothstep(0, 0.12, Math.min(w, 1 - w))
      if (check && check.l1 - check.l0 > 0.2) d += 0.0028 * Math.max(0, 1 - Math.abs(w - check.w) * len / 0.007) * smoothstep(check.l0, check.l0 + 0.08, l) * (1 - smoothstep(check.l1 - 0.08, check.l1, l))
      return d
    }
    const grid: number[] = []
    for (const l of ls) for (const w of ws) {
      const d = depth(w, l), [x, y, z] = at(l, pa + (qa - pa) * w - na * d, pb + (qb - pb) * w - nb * d)
      grid.push(m.vert(x, y, z, wood ? lane(w * len) : w * len + shift, wood ? l + shift : l, colorAt(l)))
    }
    for (let j = 0; j < ls.length - 1; j++) for (let i = 0; i < ws.length - 1; i++) {
      const a = j * ws.length + i
      m.quad(grid[a], grid[a + 1], grid[a + 1 + ws.length], grid[a + ws.length], out)
    }
  }
  for (const sign of [-1, 1]) {
    const l = sign * hl, out = at(sign, 0, 0), col = shade(colorAt(l), 0.92)
    const center = m.vert(...at(l, 0, 0), 0, 0, col)
    const ring = poly.map(([a, b]) => m.vert(...at(l, a, b), a, b, col))
    for (let k = 0; k < 8; k++) m.tri(center, ring[k], ring[(k + 1) % 8], out)
  }
}

function chunk(m: MeshData, part: BlockPart, seed: number, round: number, rough: number) {
  const [w, h, d] = part.size, steps = 4, col = tint(0.82 + rand(seed, 5) * 0.3, (rand(seed, 6) - 0.5) * 0.06)
  const shape = (q: V3): V3 => {
    const length = Math.hypot(...q)
    const p: V3 = [q[0] + (q[0] / length - q[0]) * round, q[1] + (q[1] / length - q[1]) * round, q[2] + (q[2] / length - q[2]) * round]
    const k = 1 - rough * (noise3(p[0] * 1.6 + 11, p[1] * 1.6, p[2] * 1.6, seed) * 0.7 + noise3(p[0] * 3.4, p[1] * 3.4 + 5, p[2] * 3.4, seed + 1) * 0.3)
    return [p[0] * k * w / 2, q[1] <= -0.999 ? -h / 2 : Math.max(-h / 2, p[1] * k * h / 2), p[2] * k * d / 2]
  }
  const emit = (a: V3, b: V3, c: V3, out: V3) => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const nx = Math.abs(e1[1] * e2[2] - e1[2] * e2[1]), ny = Math.abs(e1[2] * e2[0] - e1[0] * e2[2]), nz = Math.abs(e1[0] * e2[1] - e1[1] * e2[0])
    const project = (p: V3): [number, number] => ny >= nx && ny >= nz ? [p[0], p[2]] : nx >= nz ? [p[2], p[1]] : [p[0], p[1]]
    const ids = [a, b, c].map((p) => { const [s, t] = project(p); return m.vert(p[0], p[1], p[2], s, t, col) })
    m.tri(ids[0], ids[1], ids[2], out)
  }
  for (const f of FACES) {
    const grid: V3[] = []
    for (let j = 0; j <= steps; j++) for (let i = 0; i <= steps; i++) grid.push(shape(add(add(f.n, f.u, i / steps * 2 - 1), f.v, j / steps * 2 - 1)))
    for (let j = 0; j < steps; j++) for (let i = 0; i < steps; i++) {
      const a = grid[j * (steps + 1) + i], b = grid[j * (steps + 1) + i + 1], c = grid[(j + 1) * (steps + 1) + i + 1], e = grid[(j + 1) * (steps + 1) + i]
      emit(a, b, c, f.n); emit(a, c, e, f.n)
    }
  }
}

function core(m: MeshData, size: Vec3, insets: number[], origin: Vec3, skip: Set<number>, colors: (RGB | undefined)[]) {
  for (let index = 0; index < 6; index++) {
    if (skip.has(index)) continue
    const c = context(size, index, insets, origin), depth = insets[index], col = colors[index] ?? [1, 1, 1]
    const corners = ([[c.s0, c.t0], [c.s1, c.t0], [c.s1, c.t1], [c.s0, c.t1]] as const).map(([s, t]) => planarVert(m, c, s, t, depth, col))
    m.quad(corners[0], corners[1], corners[2], corners[3], c.f.n)
  }
}

function architectural(m: MeshData, part: BlockPart, origin: Vec3, seed: number) {
  const { size, material, role } = part, thin = size.indexOf(Math.min(...size))
  const insets = [0, 0, 0, 0, 0, 0], skip = new Set<number>(), colors: (RGB | undefined)[] = []
  const relief: { index: number; build: (c: Ctx) => void }[] = []
  const bottom = part.position[1] - size[1] / 2
  const grimeFor = (c: Ctx) => (t: number) => bottom < 0.6 && c.f.v[1] === 1 ? 0.8 + 0.2 * smoothstep(0, 0.6, t - c.t0) : 1
  const sorted = [...size].sort((a, b) => b - a)
  if (role === 'wall') {
    const others = [0, 1, 2].filter((axis) => axis !== thin)
    if (size[others[0]] < 0.25 || size[others[1]] < 0.25) return false
    const wallSeed = Math.round(origin[thin] * 211) * 7919 + Math.round(part.yaw * 97) * 131 + material.length * 17
    const front = faceIndex(thin, 1), back = faceIndex(thin, -1)
    if (part.relief?.kind === 'flat') return false
    if (part.relief && material !== 'charcoal') {
      const outdoor = part.relief.side === 1 ? front : back, indoor = outdoor === front ? back : front, vertical = part.relief.kind === 'battens'
      insets[outdoor] = vertical ? 0.048 : 0.028; colors[outdoor] = [0.2, 0.18, 0.16]
      relief.push({ index: outdoor, build: (c) => boardFace(m, c, { vertical, battens: vertical, burned: false, seed: wallSeed + outdoor, back: insets[outdoor], batten: vertical ? 0.02 : 0, grime: grimeFor(c) }) })
      if (material === 'plaster') { skip.add(indoor); relief.push({ index: indoor, build: (c) => plasterFace(m, c, wallSeed + indoor, grimeFor(c)) }) }
    } else if (material === 'brick') {
      for (const index of [front, back]) { insets[index] = BRICK_RECESS; colors[index] = [0.96, 0.96, 0.96]; relief.push({ index, build: (c) => brickFace(m, c, wallSeed + index, BRICK_RECESS) }) }
    } else if (material === 'wood' || material === 'charcoal') {
      const burned = material === 'charcoal', battens = rand(wallSeed, 3) < 0.55
      insets[front] = battens ? 0.048 : 0.028; insets[back] = 0.028
      colors[front] = colors[back] = [0.2, 0.18, 0.16]
      relief.push({ index: front, build: (c) => boardFace(m, c, { vertical: true, battens, burned, seed: wallSeed, back: insets[front], batten: battens ? 0.02 : 0, grime: grimeFor(c) }) })
      relief.push({ index: back, build: (c) => boardFace(m, c, { vertical: false, battens: false, burned, seed: wallSeed + 1, back: insets[back], batten: 0, grime: grimeFor(c) }) })
    } else if (material === 'concrete') {
      for (const index of [front, back]) { insets[index] = 0.0045; colors[index] = [0.7, 0.7, 0.7]; relief.push({ index, build: (c) => concreteFace(m, c, { pu: 1.2, pv: 1.5, groove: 0.003, back: 0.0045, lip: 0.0012, amp: 0.0008, holes: true, seed: wallSeed + index, grime: grimeFor(c) }) }) }
    } else if (material === 'plaster') {
      for (const index of [front, back]) { skip.add(index); relief.push({ index, build: (c) => plasterFace(m, c, wallSeed + index, grimeFor(c)) }) }
    } else if (material === 'steel' || material === 'paint') {
      for (const index of [front, back]) { insets[index] = 0.026; colors[index] = [0.45, 0.45, 0.45]; relief.push({ index, build: (c) => corrugatedFace(m, c, wallSeed + index, 0.026, grimeFor(c)) }) }
    } else return false
  } else if ((role === 'floor' || role === 'foundation' || role === 'roof') && thin === 1 && size[0] >= 0.6 && size[2] >= 0.6) {
    const top = faceIndex(1, 1), floorSeed = seed ^ 0x5f3759df
    if (material === 'concrete') {
      insets[top] = 0.007; colors[top] = [0.66, 0.66, 0.66]
      relief.push({ index: top, build: (c) => concreteFace(m, c, { pu: 3, pv: 3, groove: 0.002, back: 0.007, lip: 0.0004, amp: 0.0006, holes: false, seed: floorSeed, grime: () => 1 }) })
    } else if (material === 'wood' || material === 'charcoal') {
      insets[top] = 0.028; colors[top] = [0.2, 0.18, 0.16]
      relief.push({ index: top, build: (c) => boardFace(m, c, { vertical: false, battens: false, burned: material === 'charcoal', seed: floorSeed, back: 0.028, batten: 0, grime: () => 1 }) })
    } else return false
  } else if (role === 'column' || (role === 'roof' && sorted[0] >= 2.5 * sorted[1])) {
    if (!['wood', 'charcoal', 'concrete'].includes(material)) return false
    post(m, part, seed, material !== 'concrete', bottom < 0.6)
    return true
  } else if (material === 'brick') {
    for (let index = 0; index < 6; index++) {
      const f = FACES[index]
      if (index === 3 || size[f.ua] < 0.3 || size[f.va] < 0.3) continue
      insets[index] = BRICK_RECESS; colors[index] = [0.96, 0.96, 0.96]
      relief.push({ index, build: (c) => brickFace(m, c, seed + index, BRICK_RECESS) })
    }
    if (!relief.length) return false
  } else return false
  core(m, size, insets, origin, skip, colors)
  for (const entry of relief) entry.build(context(size, entry.index, insets, origin))
  return true
}

export function reliefGeometry(part: BlockPart, origin?: Vec3): BufferGeometry | null {
  if (part.detail) return null
  const box = (!part.primitive || part.primitive === 'box') && !part.profile
  const m = new MeshData(BLOCK_MATERIALS[part.material].tile), seed = hash(part.id.replace(/.*\/instance-\d+\//, ''))
  let built = false
  if (part.role === 'debris') {
    if (box && part.id.includes('collapsed-beam')) { post(m, part, seed, false, false); built = true }
    else if (['brick', 'concrete', 'plaster', 'tile', 'charcoal'].includes(part.material) && (box || part.primitive === 'prism')) {
      const tile = part.material === 'tile', brick = part.material === 'brick'
      chunk(m, part, seed, tile ? 0.02 : brick ? 0.1 : 0.24, tile ? 0.12 : brick ? 0.16 : 0.3); built = true
    } else if (box && part.material === 'wood') { post(m, part, seed, true, false); built = true }
  } else if (box) built = architectural(m, part, origin ?? [0, 0, 0], seed)
  if (!built) return null
  const geometry = m.geometry()
  geometry.applyQuaternion(partQuaternion(part))
  geometry.translate(part.position[0], part.position[1], part.position[2])
  return geometry
}
