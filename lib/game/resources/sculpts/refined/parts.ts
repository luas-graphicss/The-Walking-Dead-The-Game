import { Raw, type V2, type V3 } from '../../../blockout/sculpt/kit'
import { stationAt } from '../archetypes'
import type { Station } from '../forms'

const TAU = Math.PI * 2
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
export const unit = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }

export function sectionAt(st: Station, a: number) {
  const p = st.p ?? 2, c = Math.cos(a), s = Math.sin(a)
  const x = st.rx * Math.sign(c) * Math.abs(c) ** (2 / p), z = st.rz * Math.sign(s) * Math.abs(s) ** (2 / p)
  const gx = Math.sign(c) * Math.abs(x / st.rx) ** (p - 1) / st.rx, gz = Math.sign(s) * Math.abs(z / st.rz) ** (p - 1) / st.rz
  const l = Math.hypot(gx, gz) || 1
  return { x: x + (st.cx ?? 0), z: z + (st.cz ?? 0), nx: gx / l, nz: gz / l }
}

export function padRaw(stations: Station[], y0: number, y1: number, a0: number, a1: number, t: number, seg = 24): Raw {
  const m = new Raw(), rows = Math.max(2, Math.ceil((y1 - y0) / 0.004)), full = a1 - a0 >= TAU - 1e-6
  const inner: number[][] = [], outer: number[][] = [], pin: V3[][] = [], pout: V3[][] = [], nrm: V3[][] = []
  for (let i = 0; i <= rows; i++) {
    const y = y0 + (y1 - y0) * i / rows, st = stationAt(stations, y)
    const ri: V3[] = [], ro: V3[] = [], rn: V3[] = []
    for (let j = 0; j <= seg; j++) {
      const q = sectionAt(st, a0 + (a1 - a0) * j / seg)
      ri.push([q.x + q.nx * 0.0004, y, q.z + q.nz * 0.0004]); ro.push([q.x + q.nx * t, y, q.z + q.nz * t]); rn.push([q.nx, 0, q.nz])
    }
    pin.push(ri); pout.push(ro); nrm.push(rn)
  }
  for (let i = 0; i <= rows; i++) {
    const io: number[] = [], ii: number[] = []
    let u = 0
    for (let j = 0; j <= seg; j++) {
      if (j > 0) u += dist(pout[i][j], pout[i][j - 1])
      const n = nrm[i][j]
      io.push(m.v(...pout[i][j], n[0], 0, n[2], u, pout[i][j][1]))
      ii.push(m.v(...pin[i][j], -n[0], 0, -n[2], u, pin[i][j][1], 0.7))
    }
    outer.push(io); inner.push(ii)
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) {
    m.quad(outer[i][j], outer[i][j + 1], outer[i + 1][j + 1], outer[i + 1][j])
    m.quad(inner[i][j], inner[i + 1][j], inner[i + 1][j + 1], inner[i][j + 1])
  }
  for (const [i, ny] of [[0, -1], [rows, 1]] as const) {
    const ids = pout[i].map((p, j) => [m.v(...p, 0, ny, 0, p[0], p[2]), m.v(...pin[i][j], 0, ny, 0, pin[i][j][0], pin[i][j][2])])
    for (let j = 0; j < seg; j++) m.quad(ids[j][0], ids[j + 1][0], ids[j + 1][1], ids[j][1])
  }
  if (!full) for (const [j, sign] of [[0, -1], [seg, 1]] as const) {
    const ids = pout.map((row, i) => {
      const n = nrm[i][j], tangent: V3 = [-n[2] * sign, 0, n[0] * sign]
      return [m.v(...row[j], ...tangent, row[j][1], 0), m.v(...pin[i][j], ...tangent, pin[i][j][1], t)]
    })
    for (let i = 0; i < rows; i++) m.quad(ids[i][0], ids[i + 1][0], ids[i + 1][1], ids[i][1])
  }
  return m
}

export type SurfaceOpts = { closedU?: boolean; outward?: { uv: V2; dir: V3 }; shade?: number }

export function surfaceRaw(f: (u: number, v: number) => V3, nu: number, nv: number, o: SurfaceOpts = {}): Raw {
  const m = new Raw(), P: V3[][] = [], e = 1e-4
  for (let j = 0; j <= nv; j++) { const row: V3[] = []; for (let i = 0; i <= nu; i++) row.push(f(i / nu, j / nv)); P.push(row) }
  const normalAt = (u: number, v: number): V3 => {
    for (const nudge of [0, 2e-3, -2e-3]) {
      const vv = Math.min(1, Math.max(0, v + nudge)), u0 = o.closedU ? u - e : Math.max(0, u - e), u1 = o.closedU ? u + e : Math.min(1, u + e)
      const du = sub(f(u1, vv), f(u0, vv)), dv = sub(f(u, Math.min(1, vv + e)), f(u, Math.max(0, vv - e))), n = cross(du, dv)
      if (Math.hypot(...n) > 1e-14) return unit(n)
    }
    return [0, 1, 0]
  }
  let sign = 1
  if (o.outward) sign = dot(normalAt(...o.outward.uv), o.outward.dir) < 0 ? -1 : 1
  const U = P.map((row) => { const out = [0]; for (let i = 1; i <= nu; i++) out.push(out[i - 1] + dist(row[i], row[i - 1])); return out })
  const V: number[][] = P.map(() => new Array<number>(nu + 1).fill(0))
  for (let i = 0; i <= nu; i++) for (let j = 1; j <= nv; j++) V[j][i] = V[j - 1][i] + dist(P[j][i], P[j - 1][i])
  const ids: number[][] = []
  for (let j = 0; j <= nv; j++) {
    const row: number[] = []
    for (let i = 0; i <= nu; i++) { const n = normalAt(i / nu, j / nv); row.push(m.v(...P[j][i], n[0] * sign, n[1] * sign, n[2] * sign, U[j][i], V[j][i], o.shade ?? 1)) }
    ids.push(row)
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) m.quad(ids[j][i], ids[j][i + 1], ids[j + 1][i + 1], ids[j + 1][i])
  return m
}

export function ruledRaw(a: V3[], b: V3[], hint: (p: V3) => V3, closed = false): Raw {
  const m = new Raw(), n = a.length, ia: number[] = [], ib: number[] = []
  let u = 0
  for (let i = 0; i < n; i++) {
    if (i > 0) u += dist(a[i], a[i - 1])
    const prev = a[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], next = a[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]
    let nn = unit(cross(sub(next, prev), sub(b[i], a[i])))
    if (dot(nn, hint(a[i])) < 0) nn = [-nn[0], -nn[1], -nn[2]]
    ia.push(m.v(...a[i], ...nn, u, 0)); ib.push(m.v(...b[i], ...nn, u, dist(a[i], b[i])))
  }
  for (let i = 0; i < (closed ? n : n - 1); i++) { const j = (i + 1) % n; m.quad(ia[i], ia[j], ib[j], ib[i]) }
  return m
}

export function minY(...raws: Raw[]) {
  let y = Infinity
  for (const raw of raws) for (let k = 1; k < raw.p.length; k += 3) y = Math.min(y, raw.p[k])
  return y
}

export function shift(raw: Raw, d: V3) {
  for (let k = 0; k < raw.p.length; k += 3) { raw.p[k] += d[0]; raw.p[k + 1] += d[1]; raw.p[k + 2] += d[2] }
  return raw
}

export function normalOf(fn: (th: number, ph: number) => V3, th: number, ph: number, center: V3): V3 {
  const e = 1e-3, n = unit(cross(sub(fn(th + e, ph), fn(th - e, ph)), sub(fn(th, ph + e), fn(th, ph - e))))
  return dot(n, sub(fn(th, ph), center)) < 0 ? [-n[0], -n[1], -n[2]] : n
}

export function slabRaws(g: (u: number, v: number, off: number) => V3, o0: number, o1: number, nu: number, nv: number, outward: V3): Raw[] {
  const mid = g(0.5, 0.5, o1), away = (p: V3) => sub(p, mid)
  const inward: V3 = [-outward[0], -outward[1], -outward[2]]
  const edge = (fn: (t: number) => [number, number], n: number) => {
    const ts = Array.from({ length: n + 1 }, (_, i) => fn(i / n))
    return ruledRaw(ts.map(([u, v]) => g(u, v, o1)), ts.map(([u, v]) => g(u, v, o0)), away)
  }
  return [
    surfaceRaw((u, v) => g(u, v, o1), nu, nv, { outward: { uv: [0.5, 0.5], dir: outward } }),
    surfaceRaw((u, v) => g(u, v, o0), nu, nv, { outward: { uv: [0.5, 0.5], dir: inward } }),
    edge((t) => [t, 0], nu), edge((t) => [t, 1], nu), edge((t) => [0, t], nv), edge((t) => [1, t], nv),
  ]
}

export function facing(n: V3) {
  const u = unit(n)
  return { yaw: Math.atan2(u[0], u[2]), pitch: Math.acos(Math.max(-1, Math.min(1, u[1]))) }
}
