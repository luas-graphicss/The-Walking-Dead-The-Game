import { Euler, ExtrudeGeometry, Matrix3, Matrix4, Path, Quaternion, Shape, Vector2, Vector3 } from 'three'
import type { AssetSpec, MaterialKey } from '../types'
import repairData from './repairs.generated.json'

export type Repair = number[]
export const REPAIRS: Record<string, Repair[]> = repairData as Record<string, Repair[]>

export type V2 = [number, number]
export type V3 = [number, number, number]
export type Mat = MaterialKey
export type Axis = 'x' | 'y' | 'z'
export type Sculptor = (k: Kit, spec: AssetSpec) => void
export type Family = Record<string, Sculptor>

export function roundRect(w: number, d: number, r: number, y = 0, steps = 4): V3[] {
  const out: V3[] = [], rr = Math.min(r, w / 2 - 1e-4, d / 2 - 1e-4)
  const corners: [number, number, number][] = [[w / 2 - rr, d / 2 - rr, 0], [-w / 2 + rr, d / 2 - rr, Math.PI / 2], [-w / 2 + rr, -d / 2 + rr, Math.PI], [w / 2 - rr, -d / 2 + rr, Math.PI * 1.5]]
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= steps; i++) { const a = a0 + i / steps * Math.PI / 2; out.push([cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr]) }
  return out
}

export function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps = 8): V2[] {
  return Array.from({ length: steps + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / steps; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as V2 })
}

const mixh = (h: number, v: number) => { h = Math.imul(h ^ (v | 0), 0x5bd1e995); return h ^ (h >>> 13) }
export function rand(a: number, b = 0, c = 0, d = 0) {
  let h = mixh(mixh(mixh(mixh(0x9747b28c, a), b), c), d)
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const ease = (x: number) => x * x * (3 - 2 * x)
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const smooth = (a: number, b: number, x: number) => ease(clamp((x - a) / (b - a)))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export function noise3(x: number, y: number, z: number, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = ease(x - xi), v = ease(y - yi), w = ease(z - zi)
  const r = (i: number, j: number, k: number) => rand(xi + i, yi + j, zi + k, seed)
  return lerp(lerp(lerp(r(0, 0, 0), r(1, 0, 0), u), lerp(r(0, 1, 0), r(1, 1, 0), u), v), lerp(lerp(r(0, 0, 1), r(1, 0, 1), u), lerp(r(0, 1, 1), r(1, 1, 1), u), v), w)
}
export const fbm3 = (x: number, y: number, z: number, seed = 0) => noise3(x, y, z, seed) * 0.6 + noise3(x * 2.1, y * 2.1, z * 2.1, seed + 7) * 0.28 + noise3(x * 4.3, y * 4.3, z * 4.3, seed + 13) * 0.12
export function hashString(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export class Raw {
  readonly p: number[] = []
  readonly n: number[] = []
  readonly uv: number[] = []
  readonly c: number[] = []
  readonly i: number[] = []
  get count() { return this.p.length / 3 }
  v(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, w: number, shade = 1) {
    const l = Math.hypot(nx, ny, nz) || 1
    this.p.push(x, y, z); this.n.push(nx / l, ny / l, nz / l); this.uv.push(u, w); this.c.push(shade)
    return this.p.length / 3 - 1
  }

  tri(a: number, b: number, c: number) {
    const P = this.p, N = this.n
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2]
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az
    const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx
    if (cx * cx + cy * cy + cz * cz < 1e-20) return
    const sx = N[a * 3] + N[b * 3] + N[c * 3], sy = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], sz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]
    if (cx * sx + cy * sy + cz * sz < 0) this.i.push(a, c, b)
    else this.i.push(a, b, c)
  }
  quad(a: number, b: number, c: number, d: number) { this.tri(a, b, c); this.tri(a, c, d) }
  apply(matrix: Matrix4) {
    const nm = new Matrix3().getNormalMatrix(matrix), v = new Vector3()
    for (let k = 0; k < this.p.length; k += 3) {
      v.set(this.p[k], this.p[k + 1], this.p[k + 2]).applyMatrix4(matrix); this.p[k] = v.x; this.p[k + 1] = v.y; this.p[k + 2] = v.z
      v.set(this.n[k], this.n[k + 1], this.n[k + 2]).applyMatrix3(nm).normalize(); this.n[k] = v.x; this.n[k + 1] = v.y; this.n[k + 2] = v.z
    }
    return this
  }

  orient(axis: Axis = 'y') {
    if (axis === 'y') return this
    for (const arr of [this.p, this.n]) for (let k = 0; k < arr.length; k += 3) {
      const x = arr[k], y = arr[k + 1], z = arr[k + 2]
      if (axis === 'x') { arr[k] = y; arr[k + 1] = -x } else { arr[k + 1] = -z; arr[k + 2] = y }
    }
    return this
  }

  displace(fn: (x: number, y: number, z: number) => number) {
    for (let k = 0; k < this.p.length; k += 3) {
      const d = fn(this.p[k], this.p[k + 1], this.p[k + 2])
      this.p[k] += this.n[k] * d; this.p[k + 1] += this.n[k + 1] * d; this.p[k + 2] += this.n[k + 2] * d
    }
    return this
  }

  warp(fn: (x: number, y: number, z: number) => V3) {
    for (let k = 0; k < this.p.length; k += 3) {
      const [dx, dy, dz] = fn(this.p[k], this.p[k + 1], this.p[k + 2])
      this.p[k] += dx; this.p[k + 1] += dy; this.p[k + 2] += dz
    }
    return this
  }

  smooth(creaseDeg = 40) {
    const cos = Math.cos(creaseDeg * Math.PI / 180), P = this.p, I = this.i, faces: number[] = []
    const vertexFaces: number[][] = Array.from({ length: this.count }, () => [])
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [I[t], I[t + 1], I[t + 2]]
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2]
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2]
      faces.push(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
      vertexFaces[a].push(t / 3); vertexFaces[b].push(t / 3); vertexFaces[c].push(t / 3)
    }
    const key = (v: number) => `${Math.round(P[v * 3] * 2e4)},${Math.round(P[v * 3 + 1] * 2e4)},${Math.round(P[v * 3 + 2] * 2e4)}`
    const shared = new Map<string, number[]>()
    for (let v = 0; v < this.count; v++) { const k = key(v), list = shared.get(k); if (list) list.push(...vertexFaces[v]); else shared.set(k, [...vertexFaces[v]]) }
    const unit = (f: number) => { const x = faces[f * 3], y = faces[f * 3 + 1], z = faces[f * 3 + 2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l] }
    for (let v = 0; v < this.count; v++) {
      if (!vertexFaces[v].length) continue
      const ref = [0, 0, 0]
      for (const f of vertexFaces[v]) { const u = unit(f); ref[0] += u[0]; ref[1] += u[1]; ref[2] += u[2] }
      const rl = Math.hypot(...ref) || 1
      let sx = 0, sy = 0, sz = 0
      for (const f of shared.get(key(v))!) {
        const u = unit(f)
        if ((u[0] * ref[0] + u[1] * ref[1] + u[2] * ref[2]) / rl < cos) continue
        sx += faces[f * 3]; sy += faces[f * 3 + 1]; sz += faces[f * 3 + 2]
      }
      const l = Math.hypot(sx, sy, sz)
      if (l > 1e-12) { this.n[v * 3] = sx / l; this.n[v * 3 + 1] = sy / l; this.n[v * 3 + 2] = sz / l }
    }
    return this
  }
}

const BOX_FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], na: 0, ua: 2, va: 1 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], na: 0, ua: 2, va: 1 },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], na: 1, ua: 0, va: 2 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], na: 1, ua: 0, va: 2 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], na: 2, ua: 0, va: 1 },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], na: 2, ua: 0, va: 1 },
] as const

export const FACE = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 } as const

export type BoxOpts = {
  r?: number; seg?: number | V3; bevelSeg?: number; skip?: number[]; grain?: number; taper?: number
  disp?: (face: number, s: number, t: number, hs: number, ht: number) => number
  shade?: (face: number, s: number, t: number) => number
}

function axisCoords(half: number, r: number, segs: number, bevelSeg: number) {
  const core = Math.max(0, half - r), out: number[] = []
  if (r > 0) for (let i = bevelSeg; i >= 1; i--) out.push(-(core + r * Math.tan(i / bevelSeg * Math.PI / 4)))
  for (let i = 0; i <= segs; i++) out.push(-core + 2 * core * i / segs)
  if (r > 0) for (let i = 1; i <= bevelSeg; i++) out.push(core + r * Math.tan(i / bevelSeg * Math.PI / 4))
  return out.filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-7)
}

export function rboxRaw(w: number, h: number, d: number, o: BoxOpts = {}): Raw {
  const half = [w / 2, h / 2, d / 2]
  const r = clamp(o.r ?? 0, 0, Math.max(0, Math.min(...half) - 1e-5))
  const core = half.map((x) => Math.max(0, x - r))
  const bevelSeg = r > 0 ? o.bevelSeg ?? (r > 0.015 ? 3 : r > 0.0035 ? 2 : 1) : 0
  const segOf = (axis: number) => Array.isArray(o.seg) ? o.seg[axis] : o.seg ?? (o.disp ? Math.max(1, Math.ceil(2 * core[axis] / 0.06)) : 1)
  const grids = half.map((x, axis) => axisCoords(x, r, Math.max(1, segOf(axis)), bevelSeg))
  const m = new Raw(), q = [0, 0, 0]
  const evaluate = (fi: number, s: number, t: number, out: number[]) => {
    const f = BOX_FACES[fi]
    for (let a = 0; a < 3; a++) q[a] = f.n[a] * half[f.na] + f.u[a] * s + f.v[a] * t
    const ax = clamp(q[0], -core[0], core[0]), ay = clamp(q[1], -core[1], core[1]), az = clamp(q[2], -core[2], core[2])
    const dx = q[0] - ax, dy = q[1] - ay, dz = q[2] - az, l = Math.hypot(dx, dy, dz)
    const nx = l < 1e-9 ? f.n[0] : dx / l, ny = l < 1e-9 ? f.n[1] : dy / l, nz = l < 1e-9 ? f.n[2] : dz / l
    const k = r + (o.disp ? o.disp(fi, s, t, half[f.ua], half[f.va]) : 0)
    let x = ax + nx * k, y = ay + ny * k, z = az + nz * k
    if (o.taper) { const scale = 1 - o.taper * (half[1] - y) / (2 * half[1]); x *= scale; z *= scale }
    out[0] = x; out[1] = y; out[2] = z; out[3] = nx; out[4] = ny; out[5] = nz
  }
  const base = [0, 0, 0, 0, 0, 0], A = [0, 0, 0, 0, 0, 0], B = [0, 0, 0, 0, 0, 0], C = [0, 0, 0, 0, 0, 0], D = [0, 0, 0, 0, 0, 0], e = 1e-4
  for (let fi = 0; fi < 6; fi++) {
    if (o.skip?.includes(fi)) continue
    const f = BOX_FACES[fi], us = grids[f.ua], vs = grids[f.va], start = m.count
    const swap = o.grain !== undefined && f.ua === o.grain
    for (const t of vs) for (const s of us) {
      evaluate(fi, s, t, base)
      let nx = base[3], ny = base[4], nz = base[5]
      if (o.disp || o.taper) {
        evaluate(fi, s + e, t, A); evaluate(fi, s - e, t, B); evaluate(fi, s, t + e, C); evaluate(fi, s, t - e, D)
        const su = [A[0] - B[0], A[1] - B[1], A[2] - B[2]], tv = [C[0] - D[0], C[1] - D[1], C[2] - D[2]]
        let cx = su[1] * tv[2] - su[2] * tv[1], cy = su[2] * tv[0] - su[0] * tv[2], cz = su[0] * tv[1] - su[1] * tv[0]
        if (cx * nx + cy * ny + cz * nz < 0) { cx = -cx; cy = -cy; cz = -cz }
        if (Math.hypot(cx, cy, cz) > 1e-14) { nx = cx; ny = cy; nz = cz }
      }
      m.v(base[0], base[1], base[2], nx, ny, nz, swap ? t : s, swap ? s : t, o.shade ? o.shade(fi, s, t) : 1)
    }
    for (let y = 0; y < vs.length - 1; y++) for (let x = 0; x < us.length - 1; x++) {
      const a = start + y * us.length + x
      m.quad(a, a + 1, a + 1 + us.length, a + us.length)
    }
  }
  return m
}

export type LatheOpts = { seg?: number; arc?: number; phase?: number; crease?: number; shade?: number[] }

export function latheRaw(profile: V2[], o: LatheOpts = {}): Raw {
  const seg = o.seg ?? 24, arc = o.arc ?? Math.PI * 2, phase = o.phase ?? -Math.PI / 2
  const crease = Math.cos((o.crease ?? 40) * Math.PI / 180), m = new Raw()
  const rRef = Math.max(1e-3, ...profile.map((p) => p[0]))
  const edges: (V2 | null)[] = []
  for (let i = 0; i < profile.length - 1; i++) {
    const dr = profile[i + 1][0] - profile[i][0], dy = profile[i + 1][1] - profile[i][1], l = Math.hypot(dr, dy)
    edges.push(l < 1e-9 ? null : [dy / l, -dr / l])
  }
  const normalAt = (i: number, end: boolean): V2 => {
    const e = edges[i]!, other = end ? edges[i + 1] : edges[i - 1]
    if (!other || e[0] * other[0] + e[1] * other[1] < crease) return e
    const x = e[0] + other[0], y = e[1] + other[1], l = Math.hypot(x, y) || 1
    return [x / l, y / l]
  }
  let v0 = 0
  for (let i = 0; i < profile.length - 1; i++) {
    const len = Math.hypot(profile[i + 1][0] - profile[i][0], profile[i + 1][1] - profile[i][1])
    if (!edges[i]) continue
    const rows: number[][] = []
    for (const k of [0, 1]) {
      const [r, y] = profile[i + k], [nr, ny] = normalAt(i, k === 1), shade = o.shade?.[i + k] ?? 1, row: number[] = []
      for (let j = 0; j <= seg; j++) {
        const a = phase + arc * j / seg, ca = Math.cos(a), sa = Math.sin(a)
        row.push(m.v(r * ca, y, r * sa, nr * ca, ny, nr * sa, (a - phase) * Math.max(r, rRef * 0.3), v0 + k * len, shade))
      }
      rows.push(row)
    }
    for (let j = 0; j < seg; j++) m.quad(rows[0][j], rows[0][j + 1], rows[1][j + 1], rows[1][j])
    v0 += len
  }
  return m
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2])
function filletPath(points: V3[], radius: number, steps: number): V3[] {
  if (points.length < 3 || radius <= 0) return points
  const out: V3[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const A = points[i - 1], B = points[i], C = points[i + 1], ab = sub(A, B), cb = sub(C, B), la = len3(ab), lc = len3(cb)
    if (la < 1e-6 || lc < 1e-6) { out.push(B); continue }
    const da = ab.map((x) => x / la) as V3, dc = cb.map((x) => x / lc) as V3
    const angle = Math.acos(clamp(da[0] * dc[0] + da[1] * dc[1] + da[2] * dc[2], -1, 1))
    if (angle > Math.PI - 0.02) { out.push(B); continue }
    const off = Math.min(radius / Math.tan(angle / 2), la * 0.48, lc * 0.48)
    const P0 = B.map((x, k) => x + da[k] * off) as V3, P1 = B.map((x, k) => x + dc[k] * off) as V3
    for (let k = 0; k <= steps; k++) { const t = k / steps, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; out.push([a * P0[0] + b * B[0] + c * P1[0], a * P0[1] + b * B[1] + c * P1[1], a * P0[2] + b * B[2] + c * P1[2]]) }
  }
  out.push(points[points.length - 1])
  return out.filter((p, i) => i === 0 || len3(sub(p, out[i - 1])) > 1e-6)
}

export type TubeOpts = { seg?: number; caps?: boolean; closed?: boolean; fillet?: number; steps?: number; taper?: number }

export function tubeRaw(points: V3[], radius: number, o: TubeOpts = {}): Raw {
  const seg = o.seg ?? 10, m = new Raw()
  const pts = o.closed ? points : filletPath(points, o.fillet ?? radius * 3, o.steps ?? 4)
  const n = pts.length
  if (n < 2) return m
  const P = pts.map((p) => new Vector3(...p))
  const T = P.map((_, i) => {
    const a = o.closed ? P[(i - 1 + n) % n] : P[Math.max(0, i - 1)], b = o.closed ? P[(i + 1) % n] : P[Math.min(n - 1, i + 1)]
    return b.clone().sub(a).normalize()
  })
  const ref = Math.abs(T[0].y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
  const N = ref.clone().sub(T[0].clone().multiplyScalar(ref.dot(T[0]))).normalize(), q = new Quaternion()
  const frames: { N: Vector3; B: Vector3 }[] = []
  for (let i = 0; i < n; i++) {
    if (i > 0) { q.setFromUnitVectors(T[i - 1], T[i]); N.applyQuaternion(q); N.sub(T[i].clone().multiplyScalar(N.dot(T[i]))).normalize() }
    frames.push({ N: N.clone(), B: T[i].clone().cross(N) })
  }
  if (o.closed) {
    const carried = frames[n - 1].N.clone().applyQuaternion(new Quaternion().setFromUnitVectors(T[n - 1], T[0]))
    let twist = Math.atan2(carried.clone().cross(frames[0].N).dot(T[0]), carried.dot(frames[0].N))
    if (!Number.isFinite(twist)) twist = 0
    frames.forEach((f, i) => { const rot = new Quaternion().setFromAxisAngle(T[i], twist * i / n); f.N.applyQuaternion(rot); f.B = T[i].clone().cross(f.N) })
  }
  const rings: number[][] = []
  let s = 0
  for (let i = 0; i < n; i++) {
    if (i > 0) s += P[i].distanceTo(P[i - 1])
    const r = radius * (o.taper ? 1 - o.taper * i / (n - 1) : 1), { N: Ni, B: Bi } = frames[i], row: number[] = []
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a)
      const dx = Ni.x * ca + Bi.x * sa, dy = Ni.y * ca + Bi.y * sa, dz = Ni.z * ca + Bi.z * sa
      row.push(m.v(P[i].x + dx * r, P[i].y + dy * r, P[i].z + dz * r, dx, dy, dz, a * radius, s))
    }
    rings.push(row)
  }
  for (let i = 0; i < (o.closed ? n : n - 1); i++) { const A = rings[i], C = rings[(i + 1) % n]; for (let j = 0; j < seg; j++) m.quad(A[j], A[j + 1], C[j + 1], C[j]) }
  if (!o.closed && o.caps !== false) for (const [i, sign] of [[0, -1], [n - 1, 1]] as const) {
    const t = T[i].clone().multiplyScalar(sign), { N: Ni, B: Bi } = frames[i]
    const center = m.v(P[i].x, P[i].y, P[i].z, t.x, t.y, t.z, 0, 0)
    const ring = rings[i].map((id) => {
      const x = m.p[id * 3], y = m.p[id * 3 + 1], z = m.p[id * 3 + 2], d = new Vector3(x, y, z).sub(P[i])
      return m.v(x, y, z, t.x, t.y, t.z, d.dot(Ni), d.dot(Bi))
    })
    for (let j = 0; j < seg; j++) m.tri(center, ring[j], ring[j + 1])
  }
  return m
}

export type ExtrudeOpts = { holes?: V2[][]; bevel?: number; bevelSeg?: number; curveSeg?: number; crease?: number; steps?: number }

export function extrudeRaw(outline: V2[], depth: number, o: ExtrudeOpts = {}): Raw {
  const shape = new Shape(outline.map(([x, y]) => new Vector2(x, y)))
  for (const hole of o.holes ?? []) shape.holes.push(new Path(hole.map(([x, y]) => new Vector2(x, y))))
  const b = Math.min(o.bevel ?? 0, depth * 0.4)
  const geometry = new ExtrudeGeometry(shape, { depth: Math.max(1e-4, depth - 2 * b), steps: o.steps ?? 1, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: o.bevelSeg ?? 2, curveSegments: o.curveSeg ?? 8 })
  geometry.translate(0, 0, -(depth - 2 * b) / 2)
  const m = new Raw(), pos = geometry.getAttribute('position'), nor = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) m.v(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i), uv.getX(i), uv.getY(i))
  const index = geometry.getIndex()
  if (index) for (let i = 0; i < index.count; i += 3) m.tri(index.getX(i), index.getX(i + 1), index.getX(i + 2))
  else for (let i = 0; i < pos.count; i += 3) m.tri(i, i + 1, i + 2)
  geometry.dispose()
  return m.smooth(o.crease ?? 35)
}

export function sheetRaw(w: number, d: number, nx: number, nz: number, fy: (x: number, z: number) => number, thickness = 0): Raw {
  const m = new Raw(), e = 1e-3
  const layer = (offset: number, sign: number) => {
    const start = m.count
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + w * i / nx, z = -d / 2 + d * j / nz, y = fy(x, z) + offset
      const gx = (fy(x + e, z) - fy(x - e, z)) / (2 * e), gz = (fy(x, z + e) - fy(x, z - e)) / (2 * e)
      m.v(x, y, z, -gx * sign, sign, -gz * sign, x, z)
    }

    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = start + j * (nx + 1) + i
      if (sign > 0) m.quad(a, a + 1, a + nx + 2, a + nx + 1)
      else m.quad(a, a + nx + 1, a + nx + 2, a + 1)
    }
    return start
  }
  const top = layer(0, 1)
  if (thickness > 0) {
    const bottom = layer(-thickness, -1)
    const edge = (ids: number[], normal: V3) => {
      for (let k = 0; k < ids.length - 1; k++) {
        const quad = [ids[k], ids[k + 1]].flatMap((id) => [top + id, bottom + id]).map((id) => m.v(m.p[id * 3], m.p[id * 3 + 1], m.p[id * 3 + 2], ...normal, m.p[id * 3] + m.p[id * 3 + 2], m.p[id * 3 + 1], 0.85))

        const p = (i: number) => [m.p[quad[i] * 3], m.p[quad[i] * 3 + 1], m.p[quad[i] * 3 + 2]]
        const [a, b, c] = [p(0), p(2), p(3)], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
        const facing = (u[1] * v[2] - u[2] * v[1]) * normal[0] + (u[2] * v[0] - u[0] * v[2]) * normal[1] + (u[0] * v[1] - u[1] * v[0]) * normal[2]
        if (facing >= 0) m.quad(quad[0], quad[2], quad[3], quad[1])
        else m.quad(quad[0], quad[1], quad[3], quad[2])
      }
    }
    edge(Array.from({ length: nx + 1 }, (_, i) => i), [0, 0, -1])
    edge(Array.from({ length: nx + 1 }, (_, i) => nz * (nx + 1) + i), [0, 0, 1])
    edge(Array.from({ length: nz + 1 }, (_, j) => j * (nx + 1)), [-1, 0, 0])
    edge(Array.from({ length: nz + 1 }, (_, j) => j * (nx + 1) + nx), [1, 0, 0])
  }
  return m
}

type Bucket = { p: number[]; n: number[]; uv: number[]; c: number[]; i: number[] }
export type Xf = { at?: V3; yaw?: number; pitch?: number; roll?: number; scale?: number | V3 }
export type Tone = { tone?: number; tint?: V3 }
export type SculptBucket = { material: Mat; position: Float32Array; normal: Float32Array; uv: Float32Array; color: Float32Array; index: Uint32Array; leaf?: number }
export type LeafKind = 'door' | 'drawer' | 'lid'
export type SculptLeaf = { kind: LeafKind; pivot: V3; axis: V3; travel: number; initial: number; handle: V3; normal: V3; up: V3; center: V3; width: number; height: number; depth: number; floor: V3; sheer?: boolean }
type LeafRange = { leaf: number; material: Mat; v0: number; v1: number; i0: number; i1: number }

const SOFT = new Set<Mat>(['fabric', 'leather', 'rubber'])
const GRAINED = new Set<Mat>(['wood', 'charcoal', 'straw'])
export function bevelFor(m: Mat, size: V3) {
  const min = Math.min(...size)
  if (SOFT.has(m)) return Math.min(min * 0.22, 0.035)
  if (m === 'tile' || m === 'glass') return Math.min(min * 0.18, 0.01)
  return Math.min(min * 0.15, GRAINED.has(m) ? 0.005 : 0.006)
}

export type Piece = { index: number; material: Mat; start: number; count: number; istart: number; icount: number; min: V3; max: V3 }

type PlaneFace = { n: V3; d: number; poly: V3[] }
type LocalFace = { axis: number; sign: number; poly: V3[] }
const COPLANAR = 0.0007, CONTACT_AREA = 0.00005, FACE_STEP = 0.001

function sharedArea(a: V3[], b: V3[], n: V3) {
  const ax = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : (Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2)
  const u = (ax + 1) % 3, v = (ax + 2) % 3
  let poly = a.map((p) => [p[u], p[v]])
  const clip = b.map((p) => [p[u], p[v]])
  let orient = 0
  for (let i = 0; i < clip.length; i++) { const p = clip[i], q = clip[(i + 1) % clip.length]; orient += p[0] * q[1] - q[0] * p[1] }
  const sign = orient < 0 ? -1 : 1
  for (let i = 0; i < clip.length && poly.length; i++) {
    const p0 = clip[i], p1 = clip[(i + 1) % clip.length], next: number[][] = []
    const side = (q: number[]) => sign * ((p1[0] - p0[0]) * (q[1] - p0[1]) - (p1[1] - p0[1]) * (q[0] - p0[0]))
    for (let j = 0; j < poly.length; j++) {
      const c = poly[j], prev = poly[(j + poly.length - 1) % poly.length], sc = side(c), sp = side(prev)
      if (sc >= 0) { if (sp < 0) { const t = sp / (sp - sc); next.push([prev[0] + (c[0] - prev[0]) * t, prev[1] + (c[1] - prev[1]) * t]) } next.push(c) }
      else if (sp >= 0) { const t = sp / (sp - sc); next.push([prev[0] + (c[0] - prev[0]) * t, prev[1] + (c[1] - prev[1]) * t]) }
    }
    poly = next
  }
  let area = 0
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p[0] * q[1] - q[0] * p[1] }
  return Math.abs(area) / 2 / (Math.abs(n[ax]) || 1)
}

export class Kit {
  static record = false
  readonly pieces: Piece[] = []
  readonly buckets = new Map<Mat, Bucket>()
  readonly leaves: SculptLeaf[] = []
  private leafIndex = 0
  private readonly leafRanges: LeafRange[] = []
  private readonly stack: Matrix4[] = [new Matrix4()]
  private state: number
  readonly grime: number
  readonly w: number
  readonly h: number
  readonly d: number
  private putCount = 0
  private readonly fixes?: Map<number, Repair>
  constructor(readonly id: string, readonly size: V3, readonly variant: number) {
    this.state = hashString(id) || 1
    this.grime = Math.max(0.04, Math.min(0.32, size[1] * 0.28))
    ;[this.w, this.h, this.d] = size
    const list = REPAIRS[id]
    if (list?.length) this.fixes = new Map(list.map((r) => [r[0], r]))
  }
  rnd = () => {
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(a: number, b: number) { return a + (b - a) * this.rnd() }
  jitter(amount: number) { return (this.rnd() - 0.5) * 2 * amount }
  chance(p: number) { return this.rnd() < p }
  pick<T>(list: readonly T[]) { return list[Math.floor(this.rnd() * list.length) % list.length] }
  tone() { return 0.88 + this.rnd() * 0.16 }

  private compose(x: Xf) {
    const q = new Quaternion().setFromEuler(new Euler(x.pitch ?? 0, x.yaw ?? 0, x.roll ?? 0, 'YXZ'))
    const s = typeof x.scale === 'number' ? new Vector3(x.scale, x.scale, x.scale) : x.scale ? new Vector3(...x.scale) : new Vector3(1, 1, 1)
    return this.stack[this.stack.length - 1].clone().multiply(new Matrix4().compose(new Vector3(...(x.at ?? [0, 0, 0])), q, s))
  }
  push(x: Xf) { this.stack.push(this.compose(x)) }
  pop() { if (this.stack.length > 1) this.stack.pop() }

  private readonly planes = new Map<string, PlaneFace[]>()
  private planeKey(n: V3, d: number, slot = 0) { return `${Math.round(n[0] * 30)},${Math.round(n[1] * 30)},${Math.round(n[2] * 30)}|${Math.round(d / 0.002) + slot}` }
  private worldFace(matrix: Matrix4, nm: Matrix3, f: LocalFace): PlaneFace {
    const local = new Vector3(f.axis === 0 ? f.sign : 0, f.axis === 1 ? f.sign : 0, f.axis === 2 ? f.sign : 0).applyMatrix3(nm).normalize()
    const poly = f.poly.map((p) => new Vector3(...p).applyMatrix4(matrix).toArray() as V3), n: V3 = [local.x, local.y, local.z]
    return { n, d: n[0] * poly[0][0] + n[1] * poly[0][1] + n[2] * poly[0][2], poly }
  }

  private separate(matrix: Matrix4, faces: LocalFace[], thickness: number[]): number[] {
    const nm = new Matrix3().getNormalMatrix(matrix)
    return faces.map((f) => {
      const face = this.worldFace(matrix, nm, f)

      const step = thickness[f.axis] > 0.006 ? -FACE_STEP : FACE_STEP * 1.2
      for (let k = 0; k < 5; k++) if (!this.occupied(face, k * step)) return k * step
      return 5 * step
    })
  }
  private occupied(face: PlaneFace, shift: number) {
    const d = face.d + shift
    for (const slot of [0, -1, 1]) for (const other of this.planes.get(this.planeKey(face.n, d, slot)) ?? []) {
      if (Math.abs(other.d - d) > COPLANAR) continue
      if (other.n[0] * face.n[0] + other.n[1] * face.n[1] + other.n[2] * face.n[2] < 0.9995) continue
      if (sharedArea(face.poly, other.poly, face.n) > CONTACT_AREA) return true
    }
    return false
  }
  private register(matrix: Matrix4, faces: LocalFace[]) {
    const nm = new Matrix3().getNormalMatrix(matrix)
    for (const f of faces) {
      const face = this.worldFace(matrix, nm, f), key = this.planeKey(face.n, face.d), list = this.planes.get(key)
      if (list) list.push(face); else this.planes.set(key, [face])
    }
  }

  frame(x: Xf, fn: () => void) { this.push(x); fn(); this.pop() }

  point(local: V3): V3 {
    const v = new Vector3(local[0], local[1], local[2]).applyMatrix4(this.stack[this.stack.length - 1])
    return [v.x, v.y, v.z]
  }
  direction(local: V3): V3 {
    const v = new Vector3(local[0], local[1], local[2]).transformDirection(this.stack[this.stack.length - 1])
    return [v.x, v.y, v.z]
  }
  leaf(spec: SculptLeaf, fn: () => void) {
    if (this.leafIndex) { fn(); return this.leafIndex }
    this.leaves.push(spec)
    const index = this.leaves.length
    this.within(index, fn)
    return index
  }
  within(leaf: number, fn: () => void) {
    const previous = this.leafIndex
    this.leafIndex = leaf
    try { fn() } finally { this.leafIndex = previous }
  }
  quiet(fn: () => void) {
    const state = this.state, count = this.putCount
    fn()
    this.state = state
    this.putCount = count
  }
  private markLeaf(material: Mat, v0: number, v1: number, i0: number, i1: number) {
    for (let k = this.leafRanges.length - 1; k >= 0 && this.leafRanges[k].leaf === this.leafIndex; k--) {
      const range = this.leafRanges[k]
      if (range.material !== material) continue
      if (range.v1 === v0 && range.i1 === i0) { range.v1 = v1; range.i1 = i1; return }
      break
    }
    this.leafRanges.push({ leaf: this.leafIndex, material, v0, v1, i0, i1 })
  }

  put(raw: Raw, m: Mat, x: Xf & Tone = {}) {
    if (!raw.i.length) return
    const index = this.putCount++, fix = this.fixes?.get(index)
    const matrix = this.compose(x), nm = new Matrix3().getNormalMatrix(matrix), flip = matrix.determinant() < 0

    const tone = x.tone ?? this.tone(), tint = x.tint ?? [1, 1, 1]
    const v = new Vector3(), nv = new Vector3(), warm = (this.rnd() - 0.5) * 0.05
    let ox = 0, oy = 0, oz = 0
    if (fix) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
      for (let k = 0; k < raw.count; k++) {
        v.set(raw.p[k * 3], raw.p[k * 3 + 1], raw.p[k * 3 + 2]).applyMatrix4(matrix)
        lo[0] = Math.min(lo[0], v.x); lo[1] = Math.min(lo[1], v.y); lo[2] = Math.min(lo[2], v.z)
        hi[0] = Math.max(hi[0], v.x); hi[1] = Math.max(hi[1], v.y); hi[2] = Math.max(hi[2], v.z)
      }
      if ([0, 1, 2].every((a) => Math.abs((lo[a] + hi[a]) / 2 - fix[a + 1]) < 0.002)) {
        if (fix.length < 7) return
        ox = fix[4]; oy = fix[5]; oz = fix[6]
      }
    }
    let b = this.buckets.get(m)
    if (!b) { b = { p: [], n: [], uv: [], c: [], i: [] }; this.buckets.set(m, b) }
    const base = b.p.length / 3
    for (let k = 0; k < raw.count; k++) {
      v.set(raw.p[k * 3], raw.p[k * 3 + 1], raw.p[k * 3 + 2]).applyMatrix4(matrix)
      v.x += ox; v.y += oy; v.z += oz
      nv.set(raw.n[k * 3], raw.n[k * 3 + 1], raw.n[k * 3 + 2]).applyMatrix3(nm).normalize()
      b.p.push(v.x, v.y, v.z); b.n.push(nv.x, nv.y, nv.z); b.uv.push(raw.uv[k * 2], raw.uv[k * 2 + 1])
      const g = (0.72 + 0.28 * smooth(0, this.grime, v.y)) * (1 - 0.2 * Math.max(0, -nv.y)) * raw.c[k] * tone
      b.c.push(clamp(g * (1 + warm) * tint[0], 0, 1.15), clamp(g * tint[1], 0, 1.15), clamp(g * (1 - warm) * tint[2], 0, 1.15))
    }
    const istart = b.i.length
    for (let k = 0; k < raw.i.length; k += 3) {
      const a = raw.i[k] + base, c1 = raw.i[k + 1] + base, c2 = raw.i[k + 2] + base
      if (flip) b.i.push(a, c2, c1); else b.i.push(a, c1, c2)
    }
    if (this.leafIndex) this.markLeaf(m, base, b.p.length / 3, istart, b.i.length)
    if (Kit.record) {
      const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity]
      for (let k = base * 3; k < b.p.length; k += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], b.p[k + a]); max[a] = Math.max(max[a], b.p[k + a]) }
      this.pieces.push({ index, material: m, start: base, count: raw.count, istart, icount: b.i.length - istart, min, max })
    }
  }

  box(m: Mat, size: V3, at: V3, o: BoxOpts & Xf & Tone = {}) {
    const bevel = o.r ?? bevelFor(m, size), r = bevel < 0.0009 ? 0 : bevel
    const grain = o.grain ?? (GRAINED.has(m) ? size.indexOf(Math.max(...size)) : undefined)
    const matrix = this.compose({ ...o, at })
    const faces = (s: V3, c: V3) => {
      const out: LocalFace[] = []
      for (let a = 0; a < 3; a++) for (const sign of [1, -1]) {
        if (o.skip?.includes(a * 2 + (sign > 0 ? 0 : 1))) continue
        const u = (a + 1) % 3, v = (a + 2) % 3, poly: V3[] = []
        for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p: V3 = [c[0], c[1], c[2]]; p[a] += sign * s[a] / 2; p[u] += su * s[u] / 2; p[v] += sv * s[v] / 2; poly.push(p) }
        out.push({ axis: a, sign, poly })
      }
      return out
    }
    const shift = this.separate(matrix, faces(size, [0, 0, 0]), size)
    const sized: V3 = [...size], offset: V3 = [0, 0, 0]
    faces(size, [0, 0, 0]).forEach((f, i) => { if (shift[i]) { sized[f.axis] += shift[i]; offset[f.axis] += f.sign * shift[i] / 2 } })
    const raw = rboxRaw(sized[0], sized[1], sized[2], { ...o, r: Math.min(r, Math.min(...sized) / 2 - 1e-5), grain })
    if (offset[0] || offset[1] || offset[2]) raw.apply(new Matrix4().makeTranslation(offset[0], offset[1], offset[2]))
    this.put(raw, m, { ...o, at })
    this.register(matrix, faces(sized, offset))
  }

  blk(m: Mat, size: V3, x: number, bottom: number, z: number, o: BoxOpts & Xf & Tone = {}) { this.box(m, size, [x, bottom + size[1] / 2, z], o) }

  span(m: Mat, a: V3, b: V3, o: BoxOpts & Xf & Tone = {}) {
    this.box(m, [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], o)
  }
  cyl(m: Mat, r: number, h: number, at: V3, o: { r2?: number; seg?: number; bevel?: number; axis?: Axis; caps?: boolean; arc?: number } & Xf & Tone = {}) {
    const r2 = o.r2 ?? r
    const capped = o.caps !== false && (o.arc === undefined || o.arc >= Math.PI * 2 - 1e-6)
    const axis = o.axis === 'x' ? 0 : o.axis === 'z' ? 2 : 1, matrix = this.compose({ ...o, at })
    const caps = (y0: number, y1: number) => [[-1, y0, r], [1, y1, r2]].map(([sign, y, radius]) => {
      const poly: V3[] = Array.from({ length: 8 }, (_, i) => {
        const a = i / 8 * Math.PI * 2, c = Math.cos(a) * radius * 0.92, s = Math.sin(a) * radius * 0.92
        return axis === 0 ? [y, -c, s] as V3 : axis === 2 ? [c, s, y] as V3 : [c, y, s] as V3
      })
      return { axis, sign, poly }
    })
    let y0 = -h / 2, y1 = h / 2
    if (capped) {
      const thick: V3 = [h, h, h], shift = this.separate(matrix, caps(y0, y1), thick)
      y0 -= shift[0]; y1 += shift[1]
    }
    const hh = y1 - y0, b = Math.min(o.bevel ?? Math.min(r, r2, hh) * 0.12, hh * 0.3, Math.min(r, r2) * 0.4), prof: V2[] = []
    if (o.caps === false) prof.push([r, y0], [r2, y1])
    else if (b > 1e-4) prof.push([0, y0], [r - b, y0], [r - b * 0.29, y0 + b * 0.29], [r, y0 + b], [r2, y1 - b], [r2 - b * 0.29, y1 - b * 0.29], [r2 - b, y1], [0, y1])
    else prof.push([0, y0], [r, y0], [r2, y1], [0, y1])
    const seg = o.seg ?? Math.max(10, Math.min(48, Math.round(Math.max(r, r2) * 170)))
    this.put(latheRaw(prof, { seg, crease: 50, arc: o.arc }).orient(o.axis), m, { ...o, at })
    if (capped) this.register(matrix, caps(y0, y1))
  }
  lathe(m: Mat, profile: V2[], at: V3, o: LatheOpts & Xf & Tone & { axis?: Axis; wear?: (x: number, y: number, z: number) => number } = {}) {
    const raw = latheRaw(profile, o)
    if (o.wear) raw.displace(o.wear).smooth(o.crease ?? 40)
    this.put(raw.orient(o.axis), m, { ...o, at })
  }
  tube(m: Mat, points: V3[], r: number, o: TubeOpts & Xf & Tone = {}) { this.put(tubeRaw(points, r, o), m, o) }
  torus(m: Mat, R: number, r: number, at: V3, o: { seg?: number; segR?: number; arc?: number; axis?: Axis } & Xf & Tone = {}) {
    const k = o.seg ?? 10, prof: V2[] = Array.from({ length: k + 1 }, (_, i) => { const a = -Math.PI / 2 + i / k * Math.PI * 2; return [R + Math.cos(a) * r, Math.sin(a) * r] as V2 })
    this.put(latheRaw(prof, { seg: o.segR ?? 32, arc: o.arc, crease: 80 }).orient(o.axis), m, { ...o, at })
  }
  sphere(m: Mat, r: number, at: V3, o: { seg?: number; rows?: number; axis?: Axis } & Xf & Tone = {}) {
    const rows = o.rows ?? 8, prof: V2[] = Array.from({ length: rows + 1 }, (_, i) => { const a = -Math.PI / 2 + i / rows * Math.PI; return [i === 0 || i === rows ? 0 : Math.cos(a) * r, Math.sin(a) * r] as V2 })
    this.put(latheRaw(prof, { seg: o.seg ?? 16, crease: 90 }).orient(o.axis), m, { ...o, at })
  }

  extrude(m: Mat, outline: V2[], depth: number, at: V3, o: ExtrudeOpts & Xf & Tone & { axis?: Axis; wear?: (x: number, y: number, z: number) => number; warp?: (x: number, y: number, z: number) => V3 } = {}) {
    const raw = extrudeRaw(outline, depth, o)
    if (o.wear) raw.displace(o.wear)
    if (o.warp) raw.warp(o.warp).smooth(o.crease ?? 50)
    if (o.axis === 'y') raw.apply(new Matrix4().makeRotationX(-Math.PI / 2))
    if (o.axis === 'x') raw.apply(new Matrix4().makeRotationY(Math.PI / 2))
    this.put(raw, m, { ...o, at })
  }

  cushion(m: Mat, size: V3, at: V3, o: { puff?: number; r?: number; tufts?: [number, number]; sides?: number; wrinkle?: number } & Xf & Tone = {}) {
    const [w, h, d] = size, puff = o.puff ?? Math.min(h * 0.22, 0.035), r = o.r ?? Math.min(h * 0.42, Math.min(w, d) * 0.2, 0.07)
    const seed = Math.floor(this.rnd() * 1000), wrinkle = o.wrinkle ?? 0.35
    const buttons: V2[] = []
    if (o.tufts) for (let i = 0; i < o.tufts[0]; i++) for (let j = 0; j < o.tufts[1]; j++) buttons.push([(i + 0.5) / o.tufts[0] - 0.5, (j + 0.5) / o.tufts[1] - 0.5])
    const disp = (face: number, s: number, t: number, hs: number, ht: number) => {
      const fs = clamp(1 - (s / hs) ** 2), ft = clamp(1 - (t / ht) ** 2)
      let value = (face === 2 ? puff : face === 3 ? puff * 0.25 : puff * (o.sides ?? 0.45)) * Math.sqrt(fs * ft)
      value += (noise3(s * 9 + face * 3, t * 9, seed, seed) - 0.5) * puff * wrinkle
      if (face === 2) for (const [bx, bz] of buttons) { const dx = s - bx * w, dz = -t - bz * d; value -= puff * 1.1 * Math.exp(-(dx * dx + dz * dz) / 0.0016) }
      return value
    }
    const core = h - puff * 1.25
    this.put(rboxRaw(w, core, d, { r: Math.min(r, core * 0.48), disp, seg: [Math.ceil(w / 0.045), Math.ceil(core / 0.045), Math.ceil(d / 0.045)], bevelSeg: 3 }), m, { ...o, at: [at[0], at[1] - puff * 0.375, at[2]] })
    for (const [bx, bz] of buttons) this.sphere(m, 0.011, [at[0] + bx * w, at[1] + core / 2 - puff * 0.15, at[2] + bz * d], { rows: 4, seg: 8, yaw: o.yaw, scale: [1, 0.55, 1] })
  }
  sheet(m: Mat, w: number, d: number, fy: (x: number, z: number) => number, at: V3, o: { nx?: number; nz?: number; thickness?: number } & Xf & Tone = {}) {
    this.put(sheetRaw(w, d, o.nx ?? Math.ceil(w / 0.05), o.nz ?? Math.ceil(d / 0.05), fy, o.thickness ?? 0), m, { ...o, at })
  }

  bolt(at: V3, o: Xf & { r?: number; m?: Mat } = {}) {
    const r = o.r ?? 0.0065, m = o.m ?? 'steel'
    this.frame({ ...o, at }, () => {
      this.cyl(m, r * 1.55, r * 0.28, [0, 0, r * 0.14], { axis: 'z', seg: 12, bevel: 0 })
      this.cyl(m, r, r * 0.8, [0, 0, r * 0.68], { axis: 'z', seg: 6, bevel: r * 0.15 })
    })
  }

  rivet(at: V3, o: Xf & { r?: number; m?: Mat } = {}) {
    const r = o.r ?? 0.006
    this.lathe(o.m ?? 'steel', [[0, 0], [r, 0], [r * 0.92, r * 0.3], [r * 0.6, r * 0.55], [0, r * 0.62]], at, { ...o, axis: 'z', seg: 10, crease: 70 })
  }

  handle(at: V3, len: number, o: Xf & { r?: number; standoff?: number; m?: Mat; vertical?: boolean } = {}) {
    const r = o.r ?? 0.0075, s = o.standoff ?? 0.034, m = o.m ?? 'steel'
    this.frame({ ...o, at, roll: (o.roll ?? 0) + (o.vertical ? Math.PI / 2 : 0) }, () => {
      this.tube(m, [[-len / 2, 0, 0], [-len / 2, 0, s], [len / 2, 0, s], [len / 2, 0, 0]], r, { seg: 10, fillet: s * 0.42, caps: false })
      for (const x of [-1, 1]) this.cyl(m, r * 1.9, 0.005, [x * len / 2, 0, 0.0025], { axis: 'z', seg: 12, bevel: 0.001 })
    })
  }

  knob(at: V3, r = 0.016, o: Xf & { m?: Mat } = {}) {
    this.lathe(o.m ?? 'steel', [[0, 0], [r * 0.5, 0], [r * 0.42, r * 0.45], [r * 0.85, r * 0.85], [r, r * 1.25], [r * 0.82, r * 1.6], [0, r * 1.68]], at, { ...o, axis: 'z', seg: 16 })
  }

  hinge(at: V3, h: number, o: Xf & { m?: Mat } = {}) {
    this.frame({ ...o, at }, () => {
      this.cyl(o.m ?? 'steel', 0.0055, h, [0, 0, 0.004], { seg: 10 })
      this.box(o.m ?? 'steel', [0.022, h * 0.92, 0.0024], [-0.012, 0, 0.0015], { r: 0.0008 })
      for (let i = 0; i < 3; i++) this.rivet([-0.012, (i - 1) * h * 0.32, 0.0028], { r: 0.0026 })
    })
  }

  caster(at: V3, r = 0.034, o: Xf = {}) {
    this.frame({ ...o, at }, () => {
      this.cyl('rubber', r, r * 0.75, [0, r, 0], { axis: 'x', seg: 20, bevel: r * 0.28 })
      this.cyl('steel', r * 0.42, r * 0.82, [0, r, 0], { axis: 'x', seg: 12 })
      for (const s of [-1, 1]) this.box('steel', [0.004, r * 1.25, r * 1.1], [s * r * 0.47, r * 1.25, -r * 0.18], { r: 0.0015 })
      this.cyl('steel', r * 0.72, 0.01, [0, r * 2.05, -r * 0.18], { seg: 16 })
      this.box('steel', [r * 1.7, 0.005, r * 1.7], [0, r * 2.05 + 0.0075, -r * 0.18], { r: 0.002 })
    })
    return r * 2.05 + 0.01
  }

  wheel(at: V3, r: number, width: number, o: Xf & { axis?: 'x' | 'z'; ratio?: number; tread?: 'car' | 'lug' | 'bike' | 'smooth'; rim?: Mat; tire?: Mat; spokes?: number; bolts?: number } = {}) {
    const ri = r * (o.ratio ?? 0.62), w = width, c = Math.min(w * 0.3, (r - ri) * 0.35), tread = o.tread ?? 'car'
    const tire: V2[] = [[ri, -w * 0.46], [r - c, -w / 2], [r - c * 0.3, -w / 2 + c * 0.3], [r, -w / 2 + c]]
    if (tread === 'car') for (const y of [-w * 0.18, w * 0.02, w * 0.2]) tire.push([r, y - 0.005], [r - 0.006, y - 0.003], [r - 0.006, y + 0.003], [r, y + 0.005])
    tire.push([r, w / 2 - c], [r - c * 0.3, w / 2 - c * 0.3], [r - c, w / 2], [ri, w * 0.46])
    this.frame({ ...o, at }, () => this.frame(o.axis === 'z' ? { pitch: Math.PI / 2 } : { roll: -Math.PI / 2 }, () => {
      this.lathe(o.tire ?? 'rubber', tire, [0, 0, 0], { seg: tread === 'bike' ? 40 : 48, crease: 55 })
      if (tread === 'lug') {
        const count = Math.round(r * 30)
        for (let i = 0; i < count; i++) for (const side of [-1, 1]) {
          const a = (i + (side > 0 ? 0.5 : 0)) / count * Math.PI * 2, lug = Math.min(0.05, r * 0.07)
          this.box(o.tire ?? 'rubber', [lug, w * 0.42, r * 0.11], [Math.cos(a) * (r + lug / 2 - 0.004), side * w * 0.24, Math.sin(a) * (r + lug / 2 - 0.004)], { yaw: -a, roll: side * 0.35, r: 0.006 })
        }
      }
      const rim = o.rim ?? 'steel'
      if (tread === 'bike' || o.spokes) {
        this.torus(rim, ri * 0.99, Math.max(0.006, (r - ri) * 0.18), [0, 0, 0], { seg: 8, segR: 40 })
        this.cyl(rim, Math.max(0.012, r * 0.06), w * 0.9, [0, 0, 0], { seg: 12 })
        const spokes = o.spokes ?? 24
        for (let i = 0; i < spokes; i++) {
          const a = i / spokes * Math.PI * 2, side = i % 2 ? 1 : -1
          this.tube(rim, [[Math.cos(a) * r * 0.06, side * w * 0.35, Math.sin(a) * r * 0.06], [Math.cos(a + 0.2) * ri * 0.97, 0, Math.sin(a + 0.2) * ri * 0.97]], 0.0014, { seg: 4, caps: false })
        }
      } else {
        this.cyl(rim, ri * 0.98, w * 0.8, [0, 0, 0], { seg: 40, bevel: 0.004 })

        this.lathe(rim, [[ri - 0.001, w * 0.46], [ri * 0.97, w * 0.44], [ri * 0.9, w * 0.43], [ri * 0.55, w * 0.38], [ri * 0.36, w * 0.45], [ri * 0.3, w * 0.47], [0, w * 0.47]], [0, 0, 0], { seg: 40, crease: 30 })
        const bolts = o.bolts ?? 5
        for (let i = 0; i < bolts; i++) { const a = i / bolts * Math.PI * 2; this.bolt([Math.cos(a) * ri * 0.43, w * 0.41, Math.sin(a) * ri * 0.43], { pitch: -Math.PI / 2, r: Math.max(0.005, ri * 0.045) }) }
        this.cyl(rim, ri * 0.2, w * 0.08, [0, w * 0.5, 0], { seg: 16 })
      }
    }))
  }

  label(at: V3, w: number, h: number, o: Xf & { m?: Mat } = {}) { this.box(o.m ?? 'paper', [w, h, 0.0016], at, { ...o, r: 0.0005, tone: 0.95 + this.rnd() * 0.1 }) }

  vent(at: V3, w: number, h: number, o: Xf & { slats?: number; m?: Mat } = {}) {
    const m = o.m ?? 'steel', slats = o.slats ?? Math.max(3, Math.round(h / 0.022))
    this.frame({ ...o, at }, () => {
      this.frameRect(m, w, h, 0.008, 0.006, [0, 0, 0.003])
      for (let i = 0; i < slats; i++) this.box(m, [w - 0.016, 0.004, 0.012], [0, -h / 2 + 0.008 + (i + 0.5) * (h - 0.016) / slats, 0.004], { pitch: 0.6, r: 0.001 })
    })
  }

  frameRect(m: Mat, w: number, h: number, bar: number, depth: number, at: V3, o: Xf & Tone = {}) {
    this.frame({ ...o, at }, () => {
      for (const y of [-1, 1]) this.box(m, [w, bar, depth], [0, y * (h - bar) / 2, 0], { tone: o.tone })
      for (const x of [-1, 1]) this.box(m, [bar, h - 2 * bar, depth], [x * (w - bar) / 2, 0, 0], { tone: o.tone })
    })
  }

  bars(m: Mat, w: number, h: number, count: number, r: number, at: V3, o: Xf = {}) {
    this.frame({ ...o, at }, () => { for (let i = 0; i < count; i++) this.cyl(m, r, h, [-w / 2 + (i + 0.5) * w / count, 0, 0], { seg: 8, bevel: 0 }) })
  }

  plank(m: Mat, len: number, wid: number, th: number, at: V3, o: Xf & Tone & { nails?: boolean; wear?: number; face?: boolean } = {}) {
    const wear = o.wear ?? 1, tone = o.tone ?? 0.78 + this.rnd() * 0.3
    const size: V3 = o.face ? [len, wid, th] : [len, th, wid]
    const yaw = (o.yaw ?? 0) + this.jitter(0.012 * wear), roll = (o.roll ?? 0) + this.jitter(0.01 * wear)
    this.box(m, size, at, { ...o, yaw, roll, r: Math.min(0.004, th * 0.25), tone })

    if (o.nails) this.frame({ ...o, at, yaw, roll }, () => {
      for (const x of [-1, 1]) for (const c of wid > 0.1 ? [-0.3, 0.3] : [0]) {
        if (o.face) this.rivet([x * (len / 2 - 0.035), c * wid, th / 2], { r: 0.0045 })
        else this.rivet([x * (len / 2 - 0.035), th / 2, c * wid], { pitch: -Math.PI / 2, r: 0.0045 })
      }
    })
  }

  turnedLeg(m: Mat, x: number, bottom: number, z: number, h: number, r: number, o: Xf = {}) {
    const p: V2[] = [[0, 0], [r * 0.62, 0], [r * 0.7, h * 0.02], [r * 0.6, h * 0.05], [r * 0.72, h * 0.32], [r * 0.95, h * 0.36], [r * 0.7, h * 0.4], [r * 0.82, h * 0.58], [r, h * 0.62], [r * 0.75, h * 0.66], [r * 0.95, h * 0.7], [r, h * 0.74], [r, h], [0, h]]
    this.lathe(m, p, [x, bottom, z], { ...o, seg: 18, crease: 50 })
  }

  cable(m: Mat, a: V3, b: V3, sag: number, r: number, o: Xf = {}) {
    const pts: V3[] = Array.from({ length: 13 }, (_, i) => { const t = i / 12; return [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t)] as V3 })
    this.tube(m, pts, r, { ...o, seg: 8, fillet: 0 })
  }

  screen(at: V3, w: number, h: number, o: Xf & { bezel?: number; m?: Mat } = {}) {
    const b = o.bezel ?? 0.018
    this.frame({ ...o, at }, () => {
      this.box(o.m ?? 'rubber', [w, h, 0.02], [0, 0, 0.01], { r: 0.004 })
      this.box('glass', [w - 2 * b, h - 2 * b, 0.004], [0, 0, 0.0205], { r: 0.001 })
    })
  }

  finish(): SculptBucket[] {
    const out: SculptBucket[] = []
    for (const [material, b] of this.buckets) {
      const ranges = this.leafRanges.filter((range) => range.material === material)
      if (!ranges.length) {
        out.push({ material, position: Float32Array.from(b.p), normal: Float32Array.from(b.n), uv: Float32Array.from(b.uv), color: Float32Array.from(b.c), index: Uint32Array.from(b.i) })
        continue
      }
      const count = b.p.length / 3, remap = new Int32Array(count), skip = new Uint8Array(b.i.length)
      for (const range of ranges) { remap.fill(-1, range.v0, range.v1); skip.fill(1, range.i0, range.i1) }
      let kept = 0
      for (let v = 0; v < count; v++) if (remap[v] !== -1) remap[v] = kept++
      const position = new Float32Array(kept * 3), normal = new Float32Array(kept * 3), uv = new Float32Array(kept * 2), color = new Float32Array(kept * 3)
      for (let v = 0; v < count; v++) {
        const n = remap[v]
        if (n < 0) continue
        for (let a = 0; a < 3; a++) { position[n * 3 + a] = b.p[v * 3 + a]; normal[n * 3 + a] = b.n[v * 3 + a]; color[n * 3 + a] = b.c[v * 3 + a] }
        uv[n * 2] = b.uv[v * 2]; uv[n * 2 + 1] = b.uv[v * 2 + 1]
      }
      const index: number[] = []
      for (let i = 0; i < b.i.length; i++) if (!skip[i]) index.push(remap[b.i[i]])
      if (index.length) out.push({ material, position, normal, uv, color, index: Uint32Array.from(index) })
      for (const range of ranges) {
        const offset = range.v0
        out.push({
          material, leaf: range.leaf,
          position: Float32Array.from(b.p.slice(range.v0 * 3, range.v1 * 3)), normal: Float32Array.from(b.n.slice(range.v0 * 3, range.v1 * 3)),
          uv: Float32Array.from(b.uv.slice(range.v0 * 2, range.v1 * 2)), color: Float32Array.from(b.c.slice(range.v0 * 3, range.v1 * 3)),
          index: Uint32Array.from(b.i.slice(range.i0, range.i1), (i) => i - offset),
        })
      }
    }
    return out
  }
}
