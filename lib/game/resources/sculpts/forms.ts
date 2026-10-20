import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { clamp, extrudeRaw, latheRaw, noise3, Raw, smooth, type ExtrudeOpts, type Kit, type Mat, type Tone, type V2, type V3, type Xf } from '../../blockout/sculpt/kit'
import type { Resource } from '../types'

export type ResourceSculptor = (k: Kit, resource: Resource) => void
export type ResourceFamily = Record<string, ResourceSculptor>
export type Put = Xf & Tone

const TAU = Math.PI * 2

export function merge(...raws: Raw[]): Raw {
  const out = new Raw()
  for (const raw of raws) {
    const base = out.count
    for (let i = 0; i < raw.p.length; i++) { out.p.push(raw.p[i]); out.n.push(raw.n[i]) }
    for (let i = 0; i < raw.uv.length; i++) out.uv.push(raw.uv[i])
    for (let i = 0; i < raw.c.length; i++) out.c.push(raw.c[i])
    for (let i = 0; i < raw.i.length; i++) out.i.push(raw.i[i] + base)
  }
  return out
}

export function shade(raw: Raw, factor: number): Raw {
  for (let i = 0; i < raw.c.length; i++) raw.c[i] *= factor
  return raw
}

export function place(raw: Raw, x: Xf): Raw {
  const q = new Quaternion().setFromEuler(new Euler(x.pitch ?? 0, x.yaw ?? 0, x.roll ?? 0, 'YXZ'))
  const s = typeof x.scale === 'number' ? new Vector3(x.scale, x.scale, x.scale) : x.scale ? new Vector3(...x.scale) : new Vector3(1, 1, 1)
  return raw.apply(new Matrix4().compose(new Vector3(...(x.at ?? [0, 0, 0])), q, s))
}

export const latheMesh = (profile: V2[], seg = 8, crease = 50) => latheRaw(profile, { seg, crease })

export function sphereMesh(r: number, rows = 6, seg = 10): Raw {
  const prof: V2[] = Array.from({ length: rows + 1 }, (_, i) => { const a = -Math.PI / 2 + i / rows * Math.PI; return [i === 0 || i === rows ? 0 : Math.cos(a) * r, Math.sin(a) * r] as V2 })
  return latheRaw(prof, { seg, crease: 90 })
}

export const plateMesh = (outline: V2[], depth: number, holes: V2[][] = [], bevel = depth * 0.2) => extrudeRaw(outline, depth, { holes, bevel })

export const hexNutMesh = (r: number, bore: number, h: number) => place(extrudeRaw(circle(r, 6, 0, 0, Math.PI / 6), h, { holes: [circle(bore, 12)], bevel: h * 0.12 }), { at: [0, h / 2, 0], pitch: -Math.PI / 2 })

export function fillet2(points: V2[], radius: number, steps = 3, closed = false): V2[] {
  const n = points.length
  if (n < 3 || radius <= 0) return points
  const out: V2[] = []
  for (let i = 0; i < n; i++) {
    const B = points[i]
    if (!closed && (i === 0 || i === n - 1)) { out.push(B); continue }
    const A = points[(i - 1 + n) % n], C = points[(i + 1) % n]
    const ax = A[0] - B[0], ay = A[1] - B[1], cx = C[0] - B[0], cy = C[1] - B[1], la = Math.hypot(ax, ay), lc = Math.hypot(cx, cy)
    if (la < 1e-7 || lc < 1e-7) { out.push(B); continue }
    const angle = Math.acos(clamp((ax * cx + ay * cy) / (la * lc), -1, 1))
    if (angle > Math.PI - 0.03) { out.push(B); continue }
    const off = Math.min(radius / Math.tan(angle / 2), la * 0.45, lc * 0.45)
    const P0: V2 = [B[0] + ax / la * off, B[1] + ay / la * off], P1: V2 = [B[0] + cx / lc * off, B[1] + cy / lc * off]
    for (let k = 0; k <= steps; k++) { const t = k / steps, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; out.push([a * P0[0] + b * B[0] + c * P1[0], a * P0[1] + b * B[1] + c * P1[1]]) }
  }
  return out.filter((p, i) => i === 0 || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 1e-7)
}

export const circle = (r: number, n = 24, cx = 0, cy = 0, a0 = 0): V2[] => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * TAU; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as V2 })
export const ellipse = (rx: number, ry: number, n = 24, cx = 0, cy = 0): V2[] => Array.from({ length: n }, (_, i) => { const a = i / n * TAU; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as V2 })

export function rrect(w: number, h: number, r: number, steps = 4, cx = 0, cy = 0): V2[] {
  const rr = Math.max(1e-5, Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5)), out: V2[] = []
  const corners: [number, number, number][] = [[w / 2 - rr, h / 2 - rr, 0], [-w / 2 + rr, h / 2 - rr, Math.PI / 2], [-w / 2 + rr, -h / 2 + rr, Math.PI], [w / 2 - rr, -h / 2 + rr, Math.PI * 1.5]]
  for (const [x, y, a0] of corners) for (let i = 0; i <= steps; i++) { const a = a0 + i / steps * Math.PI / 2; out.push([cx + x + Math.cos(a) * rr, cy + y + Math.sin(a) * rr]) }
  return out
}

export function gearOutline(teeth: number, root: number, tip: number, flank = 0.22): V2[] {
  const out: V2[] = []
  for (let i = 0; i < teeth; i++) {
    const a = i / teeth * TAU, s = TAU / teeth
    for (const [f, r] of [[0, root], [flank, tip], [0.5 - flank * 0.4, tip], [0.5 + flank * 0.6, root]] as const) out.push([Math.cos(a + f * s) * r, Math.sin(a + f * s) * r])
  }
  return out
}

export function sawOutline(teeth: number, root: number, tip: number): V2[] {
  const out: V2[] = []
  for (let i = 0; i < teeth; i++) {
    const a = i / teeth * TAU, s = TAU / teeth
    out.push([Math.cos(a) * tip, Math.sin(a) * tip], [Math.cos(a + s * 0.18) * (root + (tip - root) * 0.35), Math.sin(a + s * 0.18) * (root + (tip - root) * 0.35)], [Math.cos(a + s * 0.62) * root, Math.sin(a + s * 0.62) * root])
  }
  return out
}

export function serrated(len: number, wid: number, teeth: number, depth: number): V2[] {
  const out: V2[] = [[-len / 2, -wid / 2], [len / 2, -wid / 2]]
  for (let i = teeth; i >= 0; i--) { const x = -len / 2 + i / teeth * len; out.push([x, wid / 2 - (i % 2 ? depth : 0)]) }
  return out
}

type FrameAt = { P: Vector3; T: Vector3; N: Vector3; B: Vector3 }

export function frames(points: V3[], closed = false): FrameAt[] {
  const n = points.length, P = points.map((p) => new Vector3(...p))
  const T = P.map((_, i) => {
    const a = closed ? P[(i - 1 + n) % n] : P[Math.max(0, i - 1)], b = closed ? P[(i + 1) % n] : P[Math.min(n - 1, i + 1)]
    return b.clone().sub(a).normalize()
  })
  const ref = Math.abs(T[0].y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
  const N = ref.clone().sub(T[0].clone().multiplyScalar(ref.dot(T[0]))).normalize(), q = new Quaternion(), out: FrameAt[] = []
  for (let i = 0; i < n; i++) {
    if (i > 0) { q.setFromUnitVectors(T[i - 1], T[i]); N.applyQuaternion(q); N.sub(T[i].clone().multiplyScalar(N.dot(T[i]))).normalize() }
    out.push({ P: P[i], T: T[i], N: N.clone(), B: T[i].clone().cross(N) })
  }
  if (closed && n > 2) {
    const carried = out[n - 1].N.clone().applyQuaternion(new Quaternion().setFromUnitVectors(T[n - 1], T[0]))
    let twist = Math.atan2(carried.clone().cross(out[0].N).dot(T[0]), carried.dot(out[0].N))
    if (!Number.isFinite(twist)) twist = 0
    out.forEach((f, i) => { f.N.applyQuaternion(new Quaternion().setFromAxisAngle(T[i], twist * i / n)); f.B = T[i].clone().cross(f.N) })
  }
  return out
}

export type SweepOpts = { seg?: number; caps?: boolean; closed?: boolean; phase?: number; crease?: number; radius?: (s: number, a: number, t: number) => number; flat?: number }

export function sweepRaw(points: V3[], r: number, o: SweepOpts = {}): Raw {
  const m = new Raw(), seg = o.seg ?? 8, closed = Boolean(o.closed), F = frames(points, closed), n = F.length
  if (n < 2) return m
  const rings: number[][] = []
  let s = 0
  for (let i = 0; i < n; i++) {
    if (i > 0) s += F[i].P.distanceTo(F[i - 1].P)
    const f = F[i], row: number[] = [], t = n > 1 ? i / (n - 1) : 0
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * TAU + (o.phase ?? 0), ca = Math.cos(a), sa = Math.sin(a) * (o.flat ?? 1)
      const dx = f.N.x * ca + f.B.x * sa, dy = f.N.y * ca + f.B.y * sa, dz = f.N.z * ca + f.B.z * sa
      const rr = r * (o.radius ? o.radius(s, a, t) : 1)
      row.push(m.v(f.P.x + dx * rr, f.P.y + dy * rr, f.P.z + dz * rr, f.N.x * ca + f.B.x * Math.sin(a) / (o.flat ?? 1), f.N.y * ca + f.B.y * Math.sin(a) / (o.flat ?? 1), f.N.z * ca + f.B.z * Math.sin(a) / (o.flat ?? 1), a * r, s))
    }
    rings.push(row)
  }
  for (let i = 0; i < (closed ? n : n - 1); i++) { const A = rings[i], C = rings[(i + 1) % n]; for (let j = 0; j < seg; j++) m.quad(A[j], A[j + 1], C[j + 1], C[j]) }
  if (!closed && o.caps !== false) for (const [i, sign] of [[0, -1], [n - 1, 1]] as const) {
    const f = F[i], t = f.T.clone().multiplyScalar(sign), center = m.v(f.P.x, f.P.y, f.P.z, t.x, t.y, t.z, 0, 0)
    const ring = rings[i].map((id) => m.v(m.p[id * 3], m.p[id * 3 + 1], m.p[id * 3 + 2], t.x, t.y, t.z, m.p[id * 3] - f.P.x, m.p[id * 3 + 2] - f.P.z))
    for (let j = 0; j < seg; j++) m.tri(center, ring[j], ring[j + 1])
  }
  if (o.radius || o.flat) m.smooth(o.crease ?? 60)
  return m
}

export function sweep(k: Kit, m: Mat, points: V3[], r: number, o: SweepOpts & Put = {}) { k.put(sweepRaw(points, r, o), m, o) }

export function helix(R: number, pitch: number, turns: number, o: { y0?: number; steps?: number; phase?: number; dir?: 1 | -1; rFn?: (t: number) => number } = {}): V3[] {
  const steps = Math.max(8, Math.round(turns * (o.steps ?? 20))), out: V3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = (o.phase ?? 0) + (o.dir ?? 1) * t * turns * TAU, r = R * (o.rFn ? o.rFn(t) : 1)
    out.push([Math.cos(a) * r, (o.y0 ?? 0) + t * turns * pitch, Math.sin(a) * r])
  }
  return out
}

export const ringPath = (rx: number, rz: number, y = 0, n = 32, wobble?: (a: number) => number): V3[] =>
  Array.from({ length: n }, (_, i) => { const a = i / n * TAU, w = wobble ? wobble(a) : 1; return [Math.cos(a) * rx * w, y, Math.sin(a) * rz * w] as V3 })

export function coilLoops(R: number, r: number, turns: number, o: { seed?: number; jitter?: number; drift?: number; rise?: number; steps?: number; squash?: number; tails?: number } = {}): V3[] {
  const steps = o.steps ?? 28, seed = o.seed ?? 3, jitter = o.jitter ?? 0.06, drift = o.drift ?? 0.08, rise = o.rise ?? r * 2.1, squash = o.squash ?? 1
  const out: V3[] = [], total = Math.round(turns * steps)
  for (let i = 0; i <= total; i++) {
    const t = i / steps, a = t * TAU
    const rad = R * (1 + jitter * (noise3(t * 1.7, 0.3, 0.7, seed) - 0.5) * 2)
    const cx = R * drift * (noise3(t * 0.6, 4.1, 1.3, seed) - 0.5) * 2, cz = R * drift * (noise3(t * 0.6, 8.7, 2.9, seed) - 0.5) * 2
    out.push([cx + Math.cos(a) * rad, r + t * rise, cz + Math.sin(a) * rad * squash])
  }
  if (o.tails) {
    const [x0, y0, z0] = out[0], [x1, y1, z1] = out[out.length - 1], tail = o.tails
    out.unshift([x0 + tail * 0.2, y0, z0 - tail], [x0 + tail * 0.05, y0, z0 - tail * 0.5])
    out.push([x1 + tail * 0.3, Math.max(r, y1 - rise), z1 + tail * 0.6], [x1 + tail * 0.4, r, z1 + tail])
  }
  return out
}

export const ropeLay = (r: number, strands = 3, depth = 0.16, lay = 6.5) => (s: number, a: number) => 1 + depth * Math.cos(strands * a - s * TAU / (lay * r * 2))

export const ribs = (pitch: number, depth = 0.12) => (s: number) => 1 + depth * Math.cos(s * TAU / pitch)

export type Station = { y: number; rx: number; rz: number; p?: number; cx?: number; cz?: number }
export type LoftOpts = { seg?: number; caps?: boolean | 'bottom' | 'top'; crease?: number; wear?: (x: number, y: number, z: number) => number }

export function loftRaw(stations: Station[], o: LoftOpts = {}): Raw {
  const m = new Raw(), seg = o.seg ?? 32, rings: number[][] = []
  let v = 0
  for (let i = 0; i < stations.length; i++) {
    const st = stations[i], p = st.p ?? 2, row: number[] = []
    if (i > 0) { const pr = stations[i - 1]; v += Math.hypot(st.y - pr.y, (st.rx + st.rz - pr.rx - pr.rz) / 2) }
    const ru = (st.rx + st.rz) / 2
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * TAU, c = Math.cos(a), s = Math.sin(a)
      const x = (st.cx ?? 0) + st.rx * Math.sign(c) * Math.abs(c) ** (2 / p), z = (st.cz ?? 0) + st.rz * Math.sign(s) * Math.abs(s) ** (2 / p)
      row.push(m.v(x, st.y, z, x - (st.cx ?? 0), 0, z - (st.cz ?? 0), a * ru, v))
    }
    rings.push(row)
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) m.quad(rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j])
  const caps = o.caps ?? true
  for (const [i, sign] of [[0, -1], [stations.length - 1, 1]] as const) {
    if (caps === false || (caps === 'bottom' && sign > 0) || (caps === 'top' && sign < 0)) continue
    const st = stations[i], center = m.v(st.cx ?? 0, st.y, st.cz ?? 0, 0, sign, 0, 0, 0)
    const ring = rings[i].map((id) => m.v(m.p[id * 3], m.p[id * 3 + 1], m.p[id * 3 + 2], 0, sign, 0, m.p[id * 3], m.p[id * 3 + 2]))
    for (let j = 0; j < seg; j++) m.tri(center, ring[j], ring[j + 1])
  }
  if (o.wear) m.displace(o.wear)
  return m.smooth(o.crease ?? 42)
}
export function loft(k: Kit, m: Mat, stations: Station[], at: V3, o: LoftOpts & Put = {}) { k.put(loftRaw(stations, o), m, { ...o, at }) }

export function easeStations(keys: Station[], per = 3): Station[] {
  const out: Station[] = []
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1]
    for (let k = 0; k < per; k++) {
      const t = k / per, e = smooth(0, 1, t)
      out.push({ y: a.y + (b.y - a.y) * t, rx: a.rx + (b.rx - a.rx) * e, rz: a.rz + (b.rz - a.rz) * e, p: (a.p ?? 2) + ((b.p ?? 2) - (a.p ?? 2)) * e, cx: (a.cx ?? 0) + ((b.cx ?? 0) - (a.cx ?? 0)) * e, cz: (a.cz ?? 0) + ((b.cz ?? 0) - (a.cz ?? 0)) * e })
    }
  }
  out.push(keys[keys.length - 1])
  return out
}

export type PillowOpts = { seam?: number; px?: number; pz?: number; pinch?: number; wrinkle?: number; seed?: number; nx?: number; nz?: number; sealX?: number; sealZ?: number; sealT?: number; teeth?: number; sag?: number }
export type Pillow = { raw: Raw; top: (u: number, v: number) => V3 }

export function pillow(w: number, h: number, d: number, o: PillowOpts = {}): Pillow {
  const seam = o.seam ?? 0.35, hs = h * seam, px = o.px ?? 0.55, pz = o.pz ?? 0.55, pinch = o.pinch ?? 0.06, seed = o.seed ?? 1, wr = o.wrinkle ?? 0.25
  const sx = o.sealX ?? 0, sz = o.sealZ ?? 0, st = o.sealT ?? 0.0012, teeth = o.teeth ?? 0, sag = o.sag ?? 0
  const grid = (n: number, size: number, seal: number) => {
    const e = Math.min(0.2, 0.0025 / size), list = new Set<number>([0, e, 1 - e, 1])
    if (seal > 0) { list.add(seal); list.add(1 - seal) }
    for (let i = 1; i < n; i++) list.add(e + (1 - 2 * e) * i / n)
    return [...list].sort((a, b) => a - b)
  }
  const us = grid(o.nx ?? Math.max(10, Math.ceil(w / 0.02)), w, sx), vs = grid(o.nz ?? Math.max(10, Math.ceil(d / 0.02)), d, sz)
  const remap = (t: number, s: number) => (s > 0 ? clamp((t - s) / (1 - 2 * s)) : t)
  const bump = (u: number, v: number) => Math.max(0, Math.sin(Math.PI * remap(u, sx))) ** px * Math.max(0, Math.sin(Math.PI * remap(v, sz))) ** pz
  const tooth = (t: number, size: number) => (teeth ? (Math.abs(((t * size / 0.003) % 2) - 1) - 0.5) * 0.0012 : 0)
  const xz = (u: number, v: number): [number, number] => {
    const edgeU = u <= 0 || u >= 1, edgeV = v <= 0 || v >= 1
    return [(u - 0.5) * w * (1 - pinch * Math.sin(Math.PI * v)) + (edgeU ? Math.sign(u - 0.5) * tooth(v, d) : 0), (v - 0.5) * d * (1 - pinch * Math.sin(Math.PI * u)) + (edgeV ? Math.sign(v - 0.5) * tooth(u, w) : 0)]
  }
  const rim = (u: number, v: number) => (u <= 0 || u >= 1 || v <= 0 || v >= 1 ? 0 : 1)
  const top = (u: number, v: number): V3 => {
    const [x, z] = xz(u, v), b = bump(u, v), lift = Math.sqrt(b)
    const wrinkle = (noise3(x * 28, z * 28, seed) - 0.5) * wr * (h - hs) * 0.35 * lift + (noise3(x * 70, z * 70, seed + 9) - 0.5) * wr * 0.002 * lift
    const droop = sag * (h - hs) * lift * (Math.abs(u - 0.5) * 2) ** 2
    return [x, hs + (h - hs) * lift + wrinkle - droop + (b > 0 ? 0 : st / 2) * rim(u, v), z]
  }
  const bottom = (u: number, v: number): V3 => { const [x, z] = xz(u, v), b = bump(u, v); return [x, hs * (1 - b ** 0.2) - (b > 0 ? 0 : st / 2) * rim(u, v), z] }
  const m = new Raw(), dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  for (const [fn, ny] of [[top, 1], [bottom, -1]] as const) {

    const start = m.count, nu = us.length, nv = vs.length, P = vs.map((v) => us.map((u) => fn(u, v))), cu = nu >> 1, cv = nv >> 1
    const U = P.map((row) => { const out = new Array<number>(nu).fill(0); for (let i = cu + 1; i < nu; i++) out[i] = out[i - 1] + dist(row[i], row[i - 1]); for (let i = cu - 1; i >= 0; i--) out[i] = out[i + 1] - dist(row[i], row[i + 1]); return out })
    const V = P.map(() => new Array<number>(nu).fill(0))
    for (let i = 0; i < nu; i++) { for (let j = cv + 1; j < nv; j++) V[j][i] = V[j - 1][i] + dist(P[j][i], P[j - 1][i]); for (let j = cv - 1; j >= 0; j--) V[j][i] = V[j + 1][i] - dist(P[j][i], P[j + 1][i]) }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const p = P[j][i]; m.v(p[0], p[1], p[2], 0, ny, 0, U[j][i], ny > 0 ? V[j][i] : -V[j][i]) }
    for (let j = 0; j < vs.length - 1; j++) for (let i = 0; i < us.length - 1; i++) { const a = start + j * us.length + i; m.quad(a, a + 1, a + 1 + us.length, a + us.length) }
  }
  return { raw: m.smooth(62), top }
}

export function patchRaw(fn: (u: number, v: number) => V3, u0: number, u1: number, v0: number, v1: number, off = 0.0014, nu = 10, nv = 10): Raw {
  const m = new Raw(), e = 1e-3
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = u0 + (u1 - u0) * i / nu, v = v0 + (v1 - v0) * j / nv, p = fn(u, v)
    const a = fn(u + e, v), b = fn(u - e, v), c = fn(u, v + e), d = fn(u, v - e)
    const du = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dv = [c[0] - d[0], c[1] - d[1], c[2] - d[2]]
    let nx = du[1] * dv[2] - du[2] * dv[1], ny = du[2] * dv[0] - du[0] * dv[2], nz = du[0] * dv[1] - du[1] * dv[0]
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz }
    const l = Math.hypot(nx, ny, nz) || 1
    m.v(p[0] + nx / l * off, p[1] + ny / l * off, p[2] + nz / l * off, nx, ny, nz, p[0], p[2])
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i; m.quad(a, a + 1, a + nu + 2, a + nu + 1) }
  return m
}

export function bladeRaw(outline: V2[], t: number, grind: (x: number, y: number) => number, o: ExtrudeOpts = {}): Raw {
  const raw = extrudeRaw(outline, t, { bevel: Math.min(t * 0.2, 0.0006), ...o })
  raw.warp((x, y, z) => [0, 0, z * (Math.max(0.12, Math.min(1, grind(x, y))) - 1)])
  return raw.smooth(o.crease ?? 30)
}

export const knurl = (count: number, depth: number, rMin = 0) => (x: number, _y: number, z: number) => (Math.hypot(x, z) < rMin ? 0 : Math.max(0, Math.cos(Math.atan2(z, x) * count)) * depth)

export const dents = (amount: number, scale = 30, seed = 1) => (x: number, y: number, z: number) => (noise3(x * scale, y * scale, z * scale, seed) - 0.5) * amount

export function decal(k: Kit, w: number, h: number, at: V3, o: Put & { m?: Mat; t?: number } = {}) {
  k.box(o.m ?? 'paper', [w, h, o.t ?? 0.0012], at, { ...o, r: 0 })
}

export function sleeve(k: Kit, m: Mat, r: number, y0: number, y1: number, at: V3, o: Put & { arc?: number; seg?: number; phase?: number; off?: number } = {}) {
  const off = o.off ?? 0.0012
  k.lathe(m, [[r + off, y0], [r + off, y1]], at, { seg: o.seg ?? 28, arc: o.arc, phase: o.phase ?? (o.arc ? Math.PI / 2 - o.arc / 2 : undefined), ...o })
}

export function screwCap(k: Kit, m: Mat, r: number, h: number, at: V3, o: Put & { ridges?: number } = {}) {
  const ridges = o.ridges ?? Math.max(12, Math.round(r * 900)), b = Math.min(r * 0.18, h * 0.3)
  k.lathe(m, [[0, 0], [r, 0], [r, h - b], [r - b * 0.4, h - b * 0.2], [r - b, h], [0, h]], at, { seg: Math.max(24, ridges * 2), crease: 50, wear: knurl(ridges, Math.min(0.0007, r * 0.05), r * 0.9), ...o })
}

export function bail(k: Kit, m: Mat, r: number, top: number, at: V3, o: Put & { lift?: number; wire?: number; tilt?: number } = {}) {
  const wire = o.wire ?? 0.0022, lift = o.lift ?? r * 0.8, tilt = o.tilt ?? 0.9
  k.frame({ at }, () => {
    for (const s of [-1, 1]) k.cyl(m, 0.008, 0.004, [s * (r + 0.001), top - 0.025, 0], { axis: 'x', seg: 12 })
    const pts: V3[] = Array.from({ length: 17 }, (_, i) => {
      const t = i / 16, a = Math.PI * t, x = -Math.cos(a) * (r + 0.004), up = Math.sin(a) * lift
      return [x, top - 0.025 + up * Math.cos(tilt), up * Math.sin(tilt)] as V3
    })
    k.tube(m, pts, wire, { seg: 6, fillet: 0 })
  })
}

export function nut(k: Kit, m: Mat, r: number, h: number, at: V3, o: Put & { axis?: 'x' | 'y' | 'z' } = {}) {
  k.cyl(m, r, h, at, { seg: 6, bevel: Math.min(r * 0.15, h * 0.25), ...o })
}

export function seeded(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

export function inset(poly: V2[], d: number): V2[] {
  let area = 0
  for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; area += x0 * y1 - x1 * y0 }
  const s = area > 0 ? 1 : -1, unit = ([x, y]: V2): V2 => { const l = Math.hypot(x, y) || 1; return [x / l, y / l] }
  return poly.map((p, i) => {
    const a = poly[(i - 1 + poly.length) % poly.length], b = poly[(i + 1) % poly.length]
    const n1 = unit([-(p[1] - a[1]) * s, (p[0] - a[0]) * s]), n2 = unit([-(b[1] - p[1]) * s, (b[0] - p[0]) * s])
    const m = unit([n1[0] + n2[0], n1[1] + n2[1]]), c = Math.max(0.3, m[0] * n1[0] + m[1] * n1[1])
    return [p[0] + m[0] * d / c, p[1] + m[1] * d / c]
  })
}

export function ribbon(pts: V2[], t: number): V2[] {
  const left: V2[] = [], right: V2[] = []
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * t / 2, ny = (dx / l) * t / 2
    left.push([p[0] + nx, p[1] + ny]); right.push([p[0] - nx, p[1] - ny])
  })
  return [...left, ...right.reverse()]
}

export const rrectPath = (w: number, d: number, r: number, y: number): V3[] => rrect(w, d, r, 4).map(([x, z]): V3 => [x, y, z])
