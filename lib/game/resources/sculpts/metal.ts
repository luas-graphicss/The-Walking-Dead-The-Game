import { noise3, Raw, rboxRaw, sheetRaw, type Kit, type V2, type V3 } from '../../blockout/sculpt/kit'
import { circle, decal, dents, fillet2, frames, helix, hexNutMesh, latheMesh, loftRaw, merge, patchRaw, place, plateMesh, ringPath, rrect, sawOutline, shade, sphereMesh, sweepRaw, type ResourceFamily, type Station } from './forms'

const TAU = Math.PI * 2
const RUST: V3 = [0.68, 0.48, 0.36], GALV: V3 = [0.9, 0.92, 0.94], BRASS: V3 = [1, 0.8, 0.45], COPPER: V3 = [1, 0.62, 0.45], ALU: V3 = [0.96, 0.97, 0.99], BLACK: V3 = [0.24, 0.24, 0.26], BAKELITE: V3 = [0.17, 0.15, 0.14]

export function threaded(r: number, len: number, pitch: number, depth: number, start = 0): V2[] {
  const out: V2[] = [[0, 0], [r, 0]]
  if (start > 0) out.push([r, start])
  let i = 0
  for (let y = start + pitch / 2; y < len - pitch * 0.6; y += pitch / 2, i++) out.push([i % 2 ? r : r - depth, y])
  out.push([r - depth * 1.2, len - pitch * 0.2], [r * 0.55, len], [0, len])
  return out
}

export function bolt(k: Kit, at: V3, yaw: number, len: number, r: number, tint: V3, nutAt?: number) {
  const head = r * 1.75, hh = r * 0.7
  k.frame({ at: [at[0], head * 0.866, at[2]], yaw }, () => {
    k.cyl('steel', head, hh, [-hh / 2, 0, 0], { axis: 'x', seg: 6, bevel: hh * 0.18, tint })
    k.lathe('steel', threaded(r, len, r * 0.36, r * 0.13, len * 0.3), [0, 0, 0], { axis: 'x', seg: 12, crease: 70, tint })
    if (nutAt !== undefined) k.cyl('steel', head, hh * 0.85, [nutAt * len, 0, 0], { axis: 'x', seg: 6, bevel: hh * 0.18, tint })
  })
}

export function stadium(len: number, wid: number, n = 7): V3[] {
  const out: V3[] = [], r = wid / 2, c = Math.max(0, len / 2 - r)
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI; out.push([c + Math.cos(a) * r, Math.sin(a) * r, 0]) }
  for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + i / n * Math.PI; out.push([-c + Math.cos(a) * r, Math.sin(a) * r, 0]) }
  return out
}

function wireHank(k: Kit, R: number, sw: number, sh: number, wire: number, tint: V3, o: { loose?: number; ties?: number; tieTint?: V3; tieMat?: 'paint' | 'steel' | 'rubber'; seed?: number; seg?: number } = {}) {
  const outline = rrect(sw, sh, Math.min(sw, sh) * 0.42, 6, R, sh / 2), section: V2[] = []

  const per: number[] = [0]
  for (let i = 1; i <= outline.length; i++) { const a = outline[i - 1], b = outline[i % outline.length]; per.push(per[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])) }
  const total = per[per.length - 1], steps = Math.max(24, Math.round(total / wire))
  for (let s = 0; s <= steps; s++) {
    const d = s / steps * total
    let i = 1
    while (i < per.length - 1 && per[i] < d) i++
    const a = outline[(i - 1) % outline.length], b = outline[i % outline.length], t = (d - per[i - 1]) / Math.max(1e-9, per[i] - per[i - 1])
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, nx = b[1] - a[1], ny = -(b[0] - a[0]), l = Math.hypot(nx, ny) || 1
    const bump = (s % 2 ? 0.35 : 0) * wire
    section.push([x + nx / l * bump, Math.max(0, y + ny / l * bump)])
  }
  section[section.length - 1] = section[0]
  k.lathe('steel', section, [0, 0, 0], { seg: o.seg ?? 40, crease: 75, tint })

  const seed = o.seed ?? 3, loose = o.loose ?? 3, turns: Raw[] = []
  for (let i = 0; i < loose; i++) {
    const rr = R - sw * 0.3 + i * (sw * 0.6 / Math.max(1, loose - 1)) * 0.98
    turns.push(sweepRaw(ringPath(rr, rr * (0.97 + 0.02 * Math.sin(i + seed)), sh + wire * (0.85 + i * 0.25), 40, (a) => 1 + 0.025 * Math.sin(a * 3 + i * 1.7 + seed)), wire, { seg: 5, closed: true }))
  }
  if (turns.length) k.put(merge(...turns), 'steel', { tint })
  const ties = o.ties ?? 3
  for (let i = 0; i < ties; i++) {
    const a = i / ties * TAU + 0.4, loop = rrect(sw + 0.004, sh + 0.004, Math.min(sw, sh) * 0.45, 4, R, sh / 2)
    const pts = loop.map(([r, y]) => [Math.cos(a) * r, y, Math.sin(a) * r] as V3)
    k.put(sweepRaw(pts, 0.0016, { seg: 5, closed: true, flat: 0.6 }), o.tieMat ?? 'paint', { tint: o.tieTint ?? [0.85, 0.75, 0.3] })
  }

  const a0 = 1.9, ro = R + sw / 2
  k.put(sweepRaw([[Math.cos(a0) * ro, sh * 0.5, Math.sin(a0) * ro], [Math.cos(a0 + 0.25) * (ro + 0.01), sh * 0.4, Math.sin(a0 + 0.25) * (ro + 0.01)], [Math.cos(a0 + 0.5) * (ro + 0.03), wire, Math.sin(a0 + 0.5) * (ro + 0.03)]], wire, { seg: 5 }), 'steel', { tint })
}

function diamondLattice(R: number, h: number, cell: number, rw: number, phase = 0): Raw {
  const n = Math.max(6, Math.round(TAU * R / cell)), raws: Raw[] = [], steps = Math.ceil(h / 0.022)
  for (const dir of [1, -1]) for (let i = 0; i < n; i++) {
    const pts: V3[] = []
    for (let s = 0; s <= steps; s++) { const y = rw + s / steps * (h - 2 * rw), a = phase + i / n * TAU + dir * y / R; pts.push([Math.cos(a) * R, y, Math.sin(a) * R]) }
    raws.push(sweepRaw(pts, rw, { seg: 4, caps: false }))
  }
  return merge(...raws)
}

function hexLattice(R: number, h: number, cell: number, rw: number): Raw {
  const n = Math.max(6, Math.round(TAU * R / cell / 2) * 2), step = TAU / n, period = cell * 1.15, g = rw * 1.25 / R, raws: Raw[] = []
  for (let i = 0; i < n; i++) {
    const pts: V3[] = []
    for (let y = rw, q = 0; y <= h - rw; q++) {
      const phase = (q / 4 + (i % 2) * 0.5) % 1
      const off = phase < 0.25 ? step / 2 - g : phase < 0.5 ? step / 2 - g : phase < 0.75 ? -step / 2 + g : -step / 2 + g
      const a = i * step + (q % 2 ? off : off * 0.92)
      pts.push([Math.cos(a) * R, y, Math.sin(a) * R])
      y += period / 4
    }
    raws.push(sweepRaw(pts, rw, { seg: 3, caps: false }))
  }
  return merge(...raws)
}

export function casing(k: Kit, at: V3, yaw: number, len: number, r: number, tint: V3) {
  const prof: V2[] = [[0, 0], [r * 1.06, 0], [r * 1.06, len * 0.06], [r * 0.86, len * 0.08], [r * 0.86, len * 0.11], [r, len * 0.13], [r * 0.97, len * 0.8], [r * 0.78, len * 0.88], [r * 0.74, len], [r * 0.6, len], [r * 0.6, len * 0.9], [0, len * 0.9]]
  k.lathe('steel', prof, [at[0], r * 1.06, at[2]], { axis: 'x', seg: 12, yaw, tint, crease: 60 })
}

export const METALS: ResourceFamily = {
  'iron-scrap': (k) => {
    const { w, d } = k, a = 0.034, t = 0.004

    k.frame({ at: [-0.01, 0, -d * 0.2], yaw: 0.22 }, () => k.extrude('steel', [[0, 0], [a, 0], [a, t], [t, t], [t, a], [0, a]], w * 0.82, [0, 0, 0], { axis: 'x', bevel: 0.0008, steps: 10, tint: RUST, warp: (_x, y, z) => [0, (z / (w * 0.41)) ** 2 * 0.012 * (y < 0.01 ? 1 : 1), 0] }))

    k.frame({ at: [w * 0.06, 0, d * 0.12], yaw: -0.5, roll: 0.06 }, () => k.extrude('steel', rrect(0.21, 0.032, 0.004), 0.005, [0, 0.009, 0], { axis: 'y', holes: [circle(0.0065, 14, -0.075, 0), circle(0.0065, 14, 0.075, 0)], bevel: 0.0008, tint: [0.6, 0.42, 0.32] }))

    const ro = 0.021, ri = 0.0175, pl = 0.1
    k.lathe('steel', [[ri, -pl / 2], [ro, -pl / 2], [ro, pl / 2], [ri, pl / 2], [ri, -pl / 2]], [-w * 0.3, ro, d * 0.24], { axis: 'z', seg: 22, tint: [0.52, 0.4, 0.33], yaw: 0.3, wear: dents(0.0009, 80, 4) })

    k.frame({ at: [w * 0.3, 0, -d * 0.02], yaw: 1.1 }, () => k.extrude('steel', [[-0.05, -0.035], [0.05, -0.035], [-0.05, 0.04]], 0.006, [0, 0.003, 0], { axis: 'y', holes: [circle(0.007, 12, -0.028, -0.01)], bevel: 0.001, tint: RUST }))
    bolt(k, [w * 0.12, 0, -d * 0.42], 0.6, 0.055, 0.005, [0.55, 0.42, 0.34], 0.7)
    bolt(k, [-w * 0.12, 0, d * 0.43], 2.4, 0.04, 0.004, RUST)
  },
  'steel-sheet': (k) => {
    const { w, d } = k, t = 0.003
    const fy = (x: number, z: number) => t + 0.0012 + 0.0012 * Math.sin(x * 5.3 + 0.4) * Math.cos(z * 4.1) + Math.max(0, x - w * 0.32 + (z - d * 0.2) * 0.8) ** 2 * 0.22
    k.sheet('steel', w, d, fy, [0, 0, 0], { nx: 36, nz: 24, thickness: t, tint: [0.78, 0.76, 0.74] })

    const surf = (u: number, v: number): V3 => { const x = -w * 0.38 + u * w * 0.3, z = -d * 0.3 + v * 0.025; return [x, fy(x, z), z] }
    for (let i = 0; i < 3; i++) k.put(patchRaw((u, v) => { const p = surf(u, v); return [p[0], fy(p[0], p[2] + i * 0.04), p[2] + i * 0.04] }, 0, 1 - i * 0.25, 0, 1, 0.0013, 8, 2), 'paint', { tint: [0.95, 0.95, 0.9] })
  },
  'corrugated-sheet': (k) => {

    const { w, d } = k, pitch = 0.0762, amp = 0.0085, t = 0.0012, sheets = 4, stack: Raw[] = []
    for (let i = 0; i < sheets; i++) {
      const top = i === sheets - 1, y0 = i * (t + 0.0016), di = d - i * 0.006, wi = w - 0.012 - i * 0.004, x0 = (i - 1.5) * 0.009
      const fy = (x: number, z: number) => y0 + t + amp * (1 - Math.cos((z + d / 2) / pitch * TAU)) + (top ? Math.max(0, x + x0 - w * 0.28) ** 2 * 0.28 : 0)
      stack.push(shade(place(sheetRaw(wi, di, top ? 12 : 3, Math.round(di / (pitch / 8)), fy, t), { at: [x0, 0, 0] }), i % 2 ? 1 : 0.9))
    }
    k.put(merge(...stack), 'steel', { tint: GALV })
  },
  rebar: (k) => {
    const { w } = k, r = 0.005, L = w * 0.97
    const ribbed = (s: number, a: number) => 1 + 0.17 * Math.max(0, Math.cos(s * TAU / 0.0125 + Math.cos(a) * 0.9)) ** 2 + 0.13 * Math.abs(Math.cos(a)) ** 14

    const bar = (y: number, z: number, z1: number, bend = 0) => {
      const n = Math.ceil(L / 0.005), pts: V3[] = Array.from({ length: n + 1 }, (_, i) => { const t = i / n, x = -L / 2 + t * L; return [x, y + bend * Math.sin(t * Math.PI) ** 2, z + (z1 - z) * t] as V3 })
      return sweepRaw(pts, r, { seg: 6, radius: ribbed, crease: 70 })
    }
    k.put(merge(...[-0.015, -0.005, 0.005, 0.015].map((z) => bar(r, z, z)), ...[-0.01, 0.01].map((z) => bar(r + r * Math.sqrt(3) * 1.02, z, z))), 'steel', { tint: [0.6, 0.45, 0.36] })
    k.put(bar(r, 0.035, 0.05), 'steel', { tint: [0.55, 0.42, 0.34], tone: 0.9 })
    for (const x of [-L * 0.3, L * 0.26]) {
      const loop = rrect(0.044, 0.026, 0.009, 4, 0, 0.0115).map(([z, y]) => [x, y, z] as V3)
      k.put(sweepRaw(loop, 0.0009, { seg: 4, closed: true }), 'steel', { tint: BLACK })
    }
  },
  'steel-pipe': (k) => {
    const { w } = k, ro = 0.0167, ri = ro - 0.0032, L = w - 0.05, pitch = 0.0023, cr = 0.0205, cl = 0.042
    const prof: V2[] = [[ri, 0], [ro - 0.0012, 0], [ro - 0.0005, 0.001]]
    for (let y = 0.002, i = 0; y < 0.024; y += pitch / 2, i++) prof.push([i % 2 ? ro : ro - 0.0011, y])
    prof.push([ro, 0.026], [ro, L - 0.026])
    for (let y = L - 0.024, i = 0; y < L - 0.002; y += pitch / 2, i++) prof.push([i % 2 ? ro : ro - 0.0011, y])
    prof.push([ro - 0.0005, L - 0.001], [ro - 0.0012, L], [ri, L], [ri, 0])
    const tilt = (cr - ro) / L
    k.frame({ at: [-L / 2 + 0.02, ro, 0], roll: tilt }, () => {
      k.lathe('steel', prof, [0, 0, 0], { axis: 'x', seg: 24, crease: 60, tint: GALV })

      const c: V2[] = fillet2([[ro - 0.0006, 0], [cr - 0.001, 0], [cr, 0.0015], [cr, 0.008], [cr - 0.0008, 0.009], [cr - 0.0008, cl - 0.009], [cr, cl - 0.008], [cr, cl - 0.0015], [cr - 0.001, cl], [ro - 0.0006, cl], [ro - 0.0006, 0]], 0.0006, 2)
      k.lathe('steel', c, [L - 0.02, 0, 0], { axis: 'x', seg: 28, crease: 50, tint: [0.84, 0.86, 0.88] })
    })
  },
  'aluminum-scrap': (k) => {
    const { w, d } = k

    for (const [x, z, yaw, s] of [[-w * 0.28, -d * 0.2, 0.3, 0.42], [-w * 0.05, d * 0.28, 1.9, 0.5], [w * 0.3, -d * 0.25, -0.7, 0.36]] as const) {
      const r = 0.033, st: Station[] = []
      for (let i = 0; i <= 10; i++) { const t = i / 10; st.push({ y: t * 0.12, rx: r * (1 + 0.1 * Math.sin(t * Math.PI * 3 + x * 20)), rz: r * (1 + 0.08 * Math.cos(t * Math.PI * 2.5)) }) }
      k.frame({ at: [x, r * s, z], yaw, roll: Math.PI / 2 }, () => {
        k.put(place(loftRaw(st, { seg: 22, wear: dents(0.007, 55, Math.round(x * 100)) }), { at: [0, -0.06, 0], scale: [s, 1, 1] }), 'steel', { tint: ALU })
        k.put(place(sweepRaw(ringPath(r * 0.9, r * 0.9, 0, 22), 0.0016, { closed: true, seg: 5 }), { at: [0, 0.062, 0], scale: [s, 1, 1] }), 'steel', { tint: [0.9, 0.9, 0.92] })
      })
    }

    k.frame({ at: [w * 0.05, 0, -d * 0.02], yaw: 0.15 }, () => k.extrude('steel', [[-0.012, 0], [0.012, 0], [0.012, 0.022], [0.009, 0.022], [0.009, 0.0025], [-0.009, 0.0025], [-0.009, 0.022], [-0.012, 0.022]], w * 0.75, [0, 0, 0], { axis: 'x', steps: 10, bevel: 0.0005, tint: ALU, warp: (_x, _y, z) => [0, Math.max(0, z / (w * 0.375)) ** 2 * 0.03, Math.sin(z * 9) * 0.004] }))

    k.sheet('steel', 0.11, 0.09, (x, z) => 0.0035 + (noise3(x * 30, z * 30, 2) - 0.5) * 0.012 + Math.abs(noise3(x * 70, z * 70, 5) - 0.5) * 0.006, [w * 0.3, 0, d * 0.22], { nx: 18, nz: 16, thickness: 0.0009, tint: ALU, yaw: 0.6 })
  },
  'copper-wire': (k) => wireHank(k, 0.072, 0.052, 0.07, 0.0026, COPPER, { loose: 3, ties: 3, tieTint: [0.85, 0.2, 0.15], seed: 7 }),
  'steel-wire': (k) => wireHank(k, 0.082, 0.05, 0.062, 0.0024, [0.42, 0.42, 0.45], { loose: 5, ties: 2, tieMat: 'steel', tieTint: [0.45, 0.45, 0.47], seed: 11 }),
  'barbed-wire': (k) => {
    const { h } = k, Rin = 0.085, Rout = 0.2

    const core: V2[] = []
    for (let y = 0.004, i = 0; y < h - 0.02; y += 0.0045, i++) core.push([Rout - (i % 2 ? 0.0028 : 0), y])
    k.lathe('steel', fillet2([[Rin + 0.006, 0], [Rout - 0.006, 0], ...core, [Rout - 0.004, h - 0.02], [Rout - 0.012, h - 0.016], [Rin + 0.012, h - 0.016], [Rin, h - 0.026], [Rin, 0.008], [Rin + 0.006, 0]], 0.003, 2), [0, 0, 0], { seg: 48, crease: 70, tint: [0.62, 0.6, 0.58], wear: dents(0.002, 25, 3) })

    const R = Rout + 0.004, turns = 3.2, pitch = (h - 0.06) / turns
    const path = helix(R, pitch, turns, { y0: 0.02, steps: 160 }), F = frames(path), strands: V3[][] = [[], []]
    let s = 0
    for (let i = 0; i < F.length; i++) {
      if (i > 0) s += F[i].P.distanceTo(F[i - 1].P)
      for (const [j, phase] of [[0, 0], [1, Math.PI]] as const) {
        const a = s * TAU / 0.03 + phase, p = F[i].P.clone().addScaledVector(F[i].N, Math.cos(a) * 0.0017).addScaledVector(F[i].B, Math.sin(a) * 0.0017)
        strands[j].push([p.x, p.y, p.z])
      }
    }
    const barbs: Raw[] = []
    for (let i = 8; i < F.length - 8; i += 15) {
      const f = F[i]
      for (const [u, v] of [[1, 0.6], [-0.6, 1]] as const) {
        const dir = f.N.clone().multiplyScalar(u).addScaledVector(f.B, v).normalize().multiplyScalar(0.012)
        barbs.push(sweepRaw([[f.P.x - dir.x, f.P.y - dir.y, f.P.z - dir.z], [f.P.x, f.P.y, f.P.z], [f.P.x + dir.x, f.P.y + dir.y, f.P.z + dir.z]], 0.0011, { seg: 4, radius: (_s, _a, t) => 1 - 0.75 * Math.abs(t - 0.5) * 2 }))
      }
    }
    k.put(merge(sweepRaw(strands[0], 0.0014, { seg: 4 }), sweepRaw(strands[1], 0.0014, { seg: 4 }), ...barbs), 'steel', { tint: [0.7, 0.68, 0.66] })

    k.put(sweepRaw([[R, 0.02, 0], [R + 0.03, 0.01, 0.05], [R + 0.02, 0.002, 0.12]], 0.0015, { seg: 4 }), 'steel', { tint: [0.7, 0.68, 0.66] })
  },
  'chain-link': (k) => {

    const { h } = k, R = 0.135
    k.put(merge(
      shade(latheMesh([[0.05, 0], [R - 0.022, 0], [R - 0.022, h - 0.03], [0.05, h - 0.03], [0.05, 0]], 32), 0.5),
      shade(diamondLattice(R - 0.011, h - 0.02, 0.055, 0.0015, 0.3), 0.85),
      diamondLattice(R, h, 0.05, 0.0016),
      sweepRaw(ringPath(R, R, h - 0.004, 64, (a) => 1 + 0.02 * Math.cos(a * 16)), 0.0018, { closed: true, seg: 5 }),
      ...[h * 0.28, h * 0.72].map((y) => shade(sweepRaw(ringPath(R + 0.0032, R + 0.0032, y, 48), 0.0016, { closed: true, seg: 5 }), 0.6)),
    ), 'steel', { tint: GALV })
  },
  'chicken-wire': (k) => {
    const { h } = k, R = 0.11
    k.put(merge(
      shade(latheMesh([[0.045, 0], [R - 0.018, 0], [R - 0.018, h - 0.025], [0.045, h - 0.025], [0.045, 0]], 32), 0.5),
      hexLattice(R, h, 0.026, 0.0009),
      ...[0.0014, h - 0.0014].map((y) => sweepRaw(ringPath(R + 0.0005, R + 0.0005, y, 56), 0.0014, { closed: true, seg: 5 })),
      ...[h * 0.3, h * 0.7].map((y) => shade(sweepRaw(ringPath(R + 0.0025, R + 0.0025, y, 48), 0.0013, { closed: true, seg: 5 }), 0.6)),
    ), 'steel', { tint: GALV })
  },
  'steel-chain': (k) => {
    const rw = 0.0042, L = 0.034, W = 0.021, pitch = L - 4 * rw, links: Raw[] = []
    const lay = (pts: V3[], y0: number, startFlat: boolean) => {
      let s = 0, next = 0, i = 0
      for (let p = 1; p < pts.length; p++) {
        const a = pts[p - 1], b = pts[p], seg = Math.hypot(b[0] - a[0], b[2] - a[2])
        while (next <= s + seg) {
          const t = (next - s) / seg, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, yaw = -Math.atan2(b[2] - a[2], b[0] - a[0])
          const flat = (i % 2 === 0) === startFlat
          const link = stadium(L - 2 * rw, W - 2 * rw)
          links.push(place(sweepRaw(link, rw, { closed: true, seg: 6 }), flat ? { at: [x, y0 + rw, z], yaw, pitch: Math.PI / 2 } : { at: [x, y0 + W / 2, z], yaw }))
          next += pitch; i++
        }
        s += seg
      }
    }
    const spiral: V3[] = Array.from({ length: 60 }, (_, i) => { const t = i / 59, a = t * TAU * 1.45, r = 0.115 - t * 0.075; return [Math.cos(a) * r, 0, Math.sin(a) * r * 0.7] as V3 })
    lay(spiral, 0, true)
    lay([[0.02, 0, -0.01], [0.06, 0, 0.02], [0.1, 0, 0.0]], 0.0075, false)
    k.put(merge(...links), 'steel', { tint: [0.62, 0.62, 0.64] })
  },
  'lead-ingot': (k) => {
    const ingot = (at: V3, yaw: number, L: number, W: number, H: number, seed: number) => {
      const st: Station[] = [{ y: 0, rx: L / 2 * 0.9, rz: W / 2 * 0.86, p: 7 }, { y: H * 0.12, rx: L / 2 * 0.93, rz: W / 2 * 0.9, p: 7 }, { y: H * 0.92, rx: L / 2, rz: W / 2, p: 7 }, { y: H, rx: L / 2 * 0.985, rz: W / 2 * 0.975, p: 7 }]
      k.put(loftRaw(st, { seg: 36, wear: dents(0.0011, 45, seed), crease: 48 }), 'steel', { at, yaw, tint: [0.55, 0.56, 0.6] })

      k.frame({ at: [at[0], at[1] + H, at[2]], yaw }, () => {
        k.frameRect('steel', L * 0.55, W * 0.45, 0.003, 0.0016, [0, 0.0008, 0], { pitch: -Math.PI / 2, tone: 0.9 })
        for (let i = 0; i < 3; i++) k.box('steel', [0.006, 0.0014, W * 0.22], [-L * 0.12 + i * 0.012, 0.0007, 0], { r: 0.0004, tint: [0.6, 0.6, 0.64] })
      })
    }
    ingot([0, 0, 0], 0.05, 0.112, 0.052, 0.019, 3)

    ingot([0.005, 0.019 + 0.002, 0.002], -0.12, 0.105, 0.048, 0.018, 9)
  },
  'brass-scrap': (k) => {
    const { w, d } = k

    k.frame({ at: [-w * 0.18, 0.0145, -d * 0.12], yaw: 0.35 }, () => {
      k.lathe('steel', fillet2([[0, -0.034], [0.0125, -0.034], [0.0125, -0.022], [0.0115, -0.02], [0.013, -0.012], [0.0165, 0], [0.013, 0.012], [0.0115, 0.02], [0.0125, 0.022], [0.0125, 0.034], [0, 0.034]], 0.0015, 2), [0, 0, 0], { axis: 'x', seg: 6 * 3, tint: BRASS, crease: 50 })
      k.lathe('steel', [[0, 0], [0.011, 0], [0.011, 0.012], [0.008, 0.016], [0.0045, 0.018], [0.0045, 0.03], [0, 0.03]], [0, 0.008, 0], { seg: 16, tint: BRASS })
      k.torus('steel', 0.017, 0.0025, [0, 0.037, 0], { segR: 24, seg: 6, tint: [0.75, 0.2, 0.15] })
      for (let i = 0; i < 3; i++) k.box('steel', [0.017, 0.003, 0.004], [Math.cos(i * TAU / 3) * 0.0085, 0.037, Math.sin(i * TAU / 3) * 0.0085], { yaw: -i * TAU / 3, r: 0.001, tint: [0.75, 0.2, 0.15] })
      k.cyl('steel', 0.0055, 0.006, [0, 0.037, 0], { seg: 12, tint: [0.75, 0.2, 0.15] })
    })

    const elbow: V3[] = Array.from({ length: 9 }, (_, i) => { const a = i / 8 * Math.PI / 2; return [w * 0.18 + Math.cos(a) * 0.025, 0.012, d * 0.15 + Math.sin(a) * 0.025] as V3 })
    k.put(sweepRaw(elbow, 0.011, { seg: 14 }), 'steel', { tint: BRASS })
    for (const [p, dir] of [[elbow[0], 0], [elbow[8], Math.PI / 2]] as const) k.cyl('steel', 0.0128, 0.012, [p[0], 0.012, p[2]], { axis: 'z', yaw: dir, seg: 14, tint: [0.9, 0.72, 0.42] })

    for (let i = 0; i < 5; i++) casing(k, [k.range(-w * 0.35, w * 0.4), 0, k.range(d * 0.2, d * 0.45) * (i % 2 ? 1 : -1)], k.rnd() * TAU, 0.045 + k.rnd() * 0.012, 0.0048, [0.95, 0.76, 0.42])
  },
  'steel-strap': (k) => {
    const Rin = 0.075, Rout = 0.112, bw = 0.016
    const prof: V2[] = [[Rin, 0], [Rout - 0.0006, 0]]
    prof.push([Rout, 0.0008], [Rout, bw - 0.0008], [Rout - 0.0006, bw])
    for (let r = Rout - 0.0015, i = 0; r > Rin + 0.001; r -= 0.0012, i++) prof.push([r, bw - (i % 2 ? 0 : 0.0004)])
    prof.push([Rin, bw], [Rin, 0])
    k.lathe('steel', prof, [0, 0, 0], { seg: 56, crease: 70, tint: [0.22, 0.26, 0.36] })

    const tail: V3[] = []
    for (let i = 0; i <= 14; i++) { const a = -0.4 + i / 14 * 1.3; tail.push([Math.cos(a) * (Rout + 0.0006), bw / 2, Math.sin(a) * (Rout + 0.0006)]) }
    tail.push([Math.cos(0.95) * Rout + 0.03, bw / 2, Math.sin(0.95) * Rout + 0.03], [Math.cos(0.95) * Rout + 0.06, bw / 2, Math.sin(0.95) * Rout + 0.05])
    k.put(sweepRaw(tail, bw / 2, { seg: 8, flat: 0.045 }), 'steel', { tint: [0.24, 0.28, 0.38] })
    for (const [x, z] of [[-0.02, 0.13], [0.06, -0.13]]) k.box('steel', [0.025, 0.008, 0.017], [x, 0.004, z], { yaw: k.rnd() * 3, r: 0.0015, tint: GALV })
  },
  'leaf-spring': (k) => {
    const { w, d } = k, L = w - 0.11, c = 0.02, t = 0.0072, width = d * 0.82, eye = 0.0155
    const R = (L * L / 4 + c * c) / (2 * c), yTop = eye * 2 - 0.0005 + c, yc = yTop - R
    const leaf = (i: number) => {
      const Ri = R - i * t, len = L * (1 - 0.24 * i), half = Math.asin(len / 2 / Ri), out: V2[] = []
      for (let j = 0; j <= 24; j++) { const a = -half + j / 24 * 2 * half; out.push([Ri * Math.sin(a), yc + Ri * Math.cos(a)]) }
      for (let j = 24; j >= 0; j--) { const a = -half * (i ? 0.985 : 1) + j / 24 * 2 * half * (i ? 0.985 : 1); out.push([(Ri - t) * Math.sin(a), yc + (Ri - t) * Math.cos(a)]) }
      k.extrude('steel', out, width - i * 0.002, [0, 0, 0], { bevel: 0.0012, tint: BLACK, tone: 0.9 + i * 0.05 })
    }
    for (let i = 0; i < 4; i++) leaf(i)

    const half = Math.asin(L / 2 / R)
    for (const s of [-1, 1]) {
      const ex = s * R * Math.sin(half), ey = yc + R * Math.cos(half) - eye + 0.002
      k.lathe('steel', [[eye - t, -width / 2], [eye, -width / 2], [eye, width / 2], [eye - t, width / 2], [eye - t, -width / 2]], [ex + s * 0.004, ey, 0], { axis: 'z', seg: 24, tint: BLACK })
      k.lathe('rubber', [[0.005, -width / 2 + 0.002], [eye - t + 0.0005, -width / 2 + 0.002], [eye - t + 0.0005, width / 2 - 0.002], [0.005, width / 2 - 0.002], [0.005, -width / 2 + 0.002]], [ex + s * 0.004, ey, 0], { axis: 'z', seg: 20 })
    }

    k.cyl('steel', 0.009, 0.006, [0, yTop + 0.003, 0], { seg: 6, tint: [0.4, 0.4, 0.42] })
    for (const x of [-L * 0.22, L * 0.22]) {
      const yl = yc + Math.sqrt(R * R - x * x)
      const loop = rrect(width + 0.006, 4 * t + 0.006, 0.003, 3, 0, yl - 2 * t + 0.0005).map(([z, y]) => [x, y, z] as V3)
      k.put(sweepRaw(loop, 0.0035, { seg: 6, closed: true, flat: 0.45 }), 'steel', { tint: [0.35, 0.35, 0.37] })
    }
  },
  bearings: (k) => {
    const bearing = (at: V3, D: number, dIn: number, B: number, sealed: boolean, seal: V3) => {
      const ro = D / 2, ri = dIn / 2, pitchR = (ro + ri) / 2, ball = (ro - ri) * 0.2, raceO = pitchR + ball * 0.9, raceI = pitchR - ball * 0.9, ch = B * 0.08
      k.frame({ at }, () => {
        k.lathe('steel', [[raceO, 0], [ro - ch, 0], [ro, ch], [ro, B - ch], [ro - ch, B], [raceO, B], [raceO - 0.0006, B * 0.5], [raceO, 0]], [0, 0, 0], { seg: 48, crease: 50, tint: [0.86, 0.87, 0.9] })
        k.lathe('steel', [[ri + ch, 0], [raceI, 0], [raceI + 0.0006, B * 0.5], [raceI, B], [ri + ch, B], [ri, B - ch], [ri, ch], [ri + ch, 0]], [0, 0, 0], { seg: 40, crease: 50, tint: [0.88, 0.89, 0.92] })
        if (sealed) for (const y of [0.0008, B - 0.0008]) k.lathe('rubber', [[raceI - 0.0004, y - 0.0005], [raceO + 0.0004, y - 0.0005], [raceO + 0.0004, y + 0.0005], [raceI - 0.0004, y + 0.0005], [raceI - 0.0004, y - 0.0005]], [0, 0, 0], { seg: 40, tint: seal })
        else {
          const balls: Raw[] = [], n = Math.floor(TAU * pitchR / (ball * 2.6))
          for (let i = 0; i < n; i++) { const a = i / n * TAU; balls.push(place(sphereMesh((raceO - raceI) / 2 + 0.0002, 6, 10), { at: [Math.cos(a) * pitchR, B / 2, Math.sin(a) * pitchR] })) }
          k.put(merge(...balls), 'steel', { tint: [0.95, 0.95, 0.97] })
          k.lathe('steel', [[pitchR - ball * 0.5, B * 0.5 - 0.0006], [pitchR + ball * 0.5, B * 0.5 - 0.0006], [pitchR + ball * 0.5, B * 0.5 + 0.0006], [pitchR - ball * 0.5, B * 0.5 + 0.0006], [pitchR - ball * 0.5, B * 0.5 - 0.0006]], [0, 0, 0], { seg: 40, tint: [0.75, 0.6, 0.35] })
        }
      })
    }
    bearing([0, 0, 0], 0.062, 0.03, 0.016, true, [0.7, 0.15, 0.12])
    bearing([0.012, 0.016, -0.006], 0.035, 0.015, 0.011, false, [0.2, 0.2, 0.2])
  },
  'steel-springs': (k) => {
    const lay = (pts: V3[], rw: number, at: V3, yaw: number, tint: V3, lift: number) => k.put(place(sweepRaw(pts, rw, { seg: 6 }), { at: [at[0], lift, at[2]], yaw, roll: Math.PI / 2 }), 'steel', { tint })

    const comp = (R: number, rw: number, n: number, len: number) => {
      const out: V3[] = [], total = n + 1.6, steps = Math.round(total * 22)
      for (let i = 0; i <= steps; i++) {
        const u = i / steps * total, a = u * TAU
        const y = u < 0.8 ? u / 0.8 * rw * 2 : u > total - 0.8 ? len - (total - u) / 0.8 * rw * 2 : rw * 2 + (u - 0.8) / (total - 1.6) * (len - rw * 4)
        out.push([Math.cos(a) * R, y - len / 2, Math.sin(a) * R])
      }
      return out
    }
    lay(comp(0.011, 0.0016, 7, 0.07), 0.0016, [-0.02, 0, -0.025], 0.2, [0.75, 0.76, 0.8], 0.0126)
    lay(comp(0.007, 0.0011, 9, 0.05), 0.0011, [0.035, 0, 0.03], -0.5, [0.4, 0.42, 0.46], 0.0081)

    const ext = helix(0.0065, 0.0024, 12, { y0: -0.0145, steps: 18 })
    const hookA: V3[] = Array.from({ length: 9 }, (_, i) => { const a = Math.PI + i / 8 * Math.PI * 1.5; return [0.0065 + Math.cos(a) * 0.0065, -0.0145 - 0.0065 - Math.sin(a) * 0.0065, 0] as V3 })
    lay([...hookA.reverse(), ...ext, ...hookA.map(([x, y, z]) => [x, -y + 0.0024 * 12 - 0.029, z] as V3).reverse()], 0.0012, [0.0, 0, 0.0], 1.2, [0.85, 0.8, 0.55], 0.0077)
  },
  'saw-blade': (k) => {
    const tip = 0.117, root = 0.104, t = 0.0018, teeth = 40
    const slots = [0, 1, 2, 3].map((i) => { const a = i / 4 * TAU + 0.3; return rrect(0.022, 0.0022, 0.0011, 3).map(([x, y]) => { const px = x + 0.084; return [px * Math.cos(a) - y * Math.sin(a), px * Math.sin(a) + y * Math.cos(a)] as V2 }) })
    k.extrude('steel', sawOutline(teeth, root, tip), t, [0, t / 2, 0], { axis: 'y', holes: [circle(0.0127, 24), ...slots], bevel: 0.0003, curveSeg: 4, tint: [0.82, 0.83, 0.86] })
    const tips: Raw[] = []
    for (let i = 0; i < teeth; i++) { const a = i / teeth * TAU; tips.push(place(rboxRaw(0.005, 0.0026, 0.0028, { r: 0.0004 }), { at: [Math.cos(a) * (tip - 0.0022), 0.0013, -Math.sin(a) * (tip - 0.0022)], yaw: a })) }
    k.put(merge(...tips), 'steel', { tint: [0.5, 0.5, 0.52] })
    k.extrude('paper', circle(0.05, 32), 0.0012, [0, t + 0.0006, 0], { axis: 'y', holes: [circle(0.02, 24)], tint: [0.9, 0.2, 0.12] })
    for (let i = 0; i < 6; i++) k.box('paper', [0.012, 0.0012, 0.004], [Math.cos(i * 0.4 + 1) * 0.034, t + 0.0018, Math.sin(i * 0.4 + 1) * 0.034], { yaw: -(i * 0.4 + 1) - Math.PI / 2, r: 0, tint: [1, 0.95, 0.85] })
  },
  nails: (k) => {
    const bw = 0.068, bh = 0.044, bd = 0.05, t = 0.0018, x0 = -0.014
    const card: V3 = [0.78, 0.64, 0.45]
    k.box('paper', [bw, t, bd], [x0, t / 2, 0], { r: 0, tint: card })
    for (const s of [-1, 1]) {
      k.box('paper', [bw, bh, t], [x0, bh / 2, s * (bd / 2 - t / 2)], { r: 0, tint: card })
      k.box('paper', [t, bh, bd - 2 * t], [x0 + s * (bw / 2 - t / 2), bh / 2, 0], { r: 0, tint: card })
    }

    for (const s of [-1, 1]) {
      k.frame({ at: [x0, bh, s * bd / 2], pitch: s * 1.9 }, () => k.box('paper', [bw - 0.002, 0.022, t], [0, 0.011, 0], { r: 0, tint: card }))
      k.frame({ at: [x0 + s * bw / 2, bh, 0], roll: -s * 2.1 }, () => k.box('paper', [t, 0.02, bd - 0.004], [0, 0.01, 0], { r: 0, tint: card }))
    }
    decal(k, bw * 0.75, bh * 0.45, [x0, bh * 0.5, bd / 2 + 0.0006], { tint: [0.9, 0.82, 0.25] })
    decal(k, bw * 0.5, bh * 0.14, [x0, bh * 0.5, bd / 2 + 0.0018], { tint: [0.2, 0.2, 0.22] })
    const nail = (len: number, r: number) => latheMesh([[0, 0], [r * 2.6, 0], [r * 2.6, r * 0.7], [r, r * 1.1], [r, len - r * 3], [0.0002, len], [0, len]])
    k.sheet('steel', bw - 2 * t, bd - 2 * t, (x, z) => (noise3(x * 120, z * 120, 4) - 0.5) * 0.004, [x0, bh * 0.68, 0], { nx: 14, nz: 10, tint: [0.5, 0.5, 0.53] })
    const inside: Raw[] = []

    for (let i = 0; i < 16; i++) {
      const yaw = k.jitter(0.3)
      inside.push(place(nail(0.045, 0.0011), { at: [x0 - 0.0225 * Math.cos(yaw) + k.jitter(0.007), bh * 0.68 + 0.002 + k.rnd() * 0.004, k.jitter(0.012)], yaw, roll: -Math.PI / 2 }))
    }
    k.put(merge(...inside), 'steel', { tint: [0.62, 0.62, 0.65] })
    const spilled: Raw[] = []
    for (let i = 0; i < 4; i++) spilled.push(place(nail(0.045, 0.0011), { at: [0.025 + k.rnd() * 0.006, 0.0029, -0.02 + i * 0.012], yaw: k.jitter(0.5), roll: -Math.PI / 2 }))
    k.put(merge(...spilled), 'steel', { tint: [0.6, 0.6, 0.63] })
  },
  screws: (k) => {
    const { w, d } = k, bh = 0.024, t = 0.0016, tray: V3 = [0.25, 0.38, 0.62]
    k.box('paint', [w, t, d], [0, t / 2, 0], { r: 0.0012, tint: tray })
    for (const s of [-1, 1]) { k.box('paint', [w, bh, t], [0, bh / 2, s * (d / 2 - t / 2)], { r: 0.0008, tint: tray }); k.box('paint', [t, bh, d - 2 * t], [s * (w / 2 - t / 2), bh / 2, 0], { r: 0.0008, tint: tray }) }
    for (const x of [-w / 6, w / 6]) k.box('paint', [t, bh * 0.85, d - 2 * t], [x, bh * 0.425, 0], { r: 0.0006, tint: tray })
    const screw = (len: number, r: number) => merge(latheMesh([[0, 0], [r * 2, 0], [r * 2, r * 0.3], [r * 0.9, r * 1.6]]), place(latheMesh(threaded(r, len - r * 1.6, r * 0.7, r * 0.3, len * 0.15)), { at: [0, r * 1.6, 0] }))
    const comp = (x: number, make: () => Raw, n: number, lie: number) => {
      const parts: Raw[] = []
      for (let i = 0; i < n; i++) parts.push(place(make(), { at: [x + k.jitter(w / 6 - 0.006), t + lie, k.jitter(d / 2 - 0.008)], yaw: k.rnd() * TAU, pitch: Math.PI / 2, roll: k.jitter(0.3) }))
      return merge(...parts)
    }
    k.put(comp(-w / 3, () => screw(0.03, 0.0018), 9, 0.0036), 'steel', { tint: [0.85, 0.8, 0.55] })
    k.put(comp(0, () => screw(0.022, 0.0022), 7, 0.0044), 'steel', { tint: [0.75, 0.76, 0.8] })
    const nuts: Raw[] = []
    for (let i = 0; i < 9; i++) nuts.push(place(hexNutMesh(0.0048, 0.0022, 0.0042), { at: [w / 3 + k.jitter(w / 6 - 0.007), t + (i > 5 ? 0.0042 : 0), k.jitter(d / 2 - 0.008)], yaw: k.rnd() * TAU }))
    k.put(merge(...nuts), 'steel', { tint: [0.72, 0.73, 0.76] })
  },
  hinges: (k) => {
    const leafW = 0.032, leafL = 0.075, lt = 0.0018, kr = 0.0042
    const hingeAt = (at: V3, yaw: number, open: number, tint: V3) => k.frame({ at, yaw }, () => {

      for (const side of [0, 1]) k.frame({ at: [0, kr, 0], ...(side ? (open > Math.PI - 1e-3 ? { yaw: Math.PI } : { roll: -open }) : {}) }, () => {
        k.extrude('steel', rrect(leafW, leafL, 0.003, 3, -leafW / 2 - kr * 0.6, 0), lt, [0, -kr + lt / 2, 0], { axis: 'y', holes: [-0.025, 0, 0.025].map((z) => circle(0.0023, 10, -leafW / 2 - kr * 0.4, z)), bevel: 0.0003, tint })
        for (let i = side; i < 5; i += 2) k.cyl('steel', kr, leafL / 5 - 0.0006, [0, 0, -leafL / 2 + (i + 0.5) * leafL / 5], { axis: 'z', seg: 12, tint })
      })
      k.lathe('steel', [[0, 0], [kr * 0.62, 0], [kr * 0.62, 0.0012], [kr * 0.45, 0.0016], [kr * 0.45, leafL + 0.0024], [0, leafL + 0.003]], [0, kr, -leafL / 2 - 0.0016], { axis: 'z', seg: 10, tint: [0.7, 0.7, 0.72] })
    })
    hingeAt([-0.02, 0, -0.01], 0.3, Math.PI, [0.82, 0.78, 0.6])

    hingeAt([0.03, lt + 0.0002, 0.012], -0.2, Math.PI * 0.5, [0.7, 0.71, 0.74])
  },
  padlock: (k) => {
    const bw = 0.05, bh = 0.044, plates = 7, pt = 0.0034
    const outline = rrect(bw, bh, 0.006, 4)
    for (let i = 0; i < plates; i++) k.extrude('steel', outline, pt, [0, bh / 2, -plates * pt / 2 + (i + 0.5) * pt], { bevel: 0.0007, tint: i === 0 || i === plates - 1 ? [0.8, 0.8, 0.82] : [0.66, 0.67, 0.7] })
    for (const x of [-1, 1]) for (const y of [-1, 1]) k.rivet([x * (bw / 2 - 0.006), bh / 2 + y * (bh / 2 - 0.006), plates * pt / 2], { r: 0.0024, m: 'steel' })
    decal(k, 0.022, 0.009, [0, bh * 0.62, plates * pt / 2 + 0.0006], { m: 'steel', tint: BRASS })
    const sr = 0.0042, legs = 0.015, rise = 0.024
    const shackle: V3[] = [[-legs, bh - 0.002, 0], [-legs, bh + rise * 0.6, 0]]
    for (let i = 1; i < 12; i++) { const a = Math.PI - i / 12 * Math.PI; shackle.push([Math.cos(a) * legs, bh + rise * 0.6 + Math.sin(a) * legs, 0]) }
    shackle.push([legs, bh + rise * 0.6, 0], [legs, bh - 0.002, 0])
    k.put(sweepRaw(shackle, sr, { seg: 12 }), 'steel', { tint: [0.9, 0.9, 0.93] })
    k.lathe('steel', [[0, 0], [0.0062, 0], [0.0062, 0.0035], [0, 0.0035]], [0, -0.0001, 0], { seg: 16, tint: BRASS })
  },
  'door-lock': (k) => {
    const { h } = k, cw = 0.056, ch = h - 0.012, ct = 0.0145, fx = cw / 2
    k.box('steel', [cw, ch, ct], [0, ch / 2 + 0.006, 0.002], { r: 0.0015, tint: [0.72, 0.72, 0.75] })
    k.box('steel', [0.0024, h, 0.022], [fx + 0.0012, h / 2, 0.002], { r: 0.0008, tint: BRASS })
    for (const y of [0.012, h - 0.012]) k.cyl('steel', 0.0024, 0.0014, [fx + 0.0031, y, 0.002], { axis: 'x', seg: 10, tint: BRASS })
    k.extrude('steel', [[0, -0.007], [0.009, -0.007], [0.013, -0.002], [0.013, 0.007], [0, 0.007]], 0.011, [fx + 0.0024, h * 0.66, 0.002], { bevel: 0.0006, tint: BRASS })
    k.box('steel', [0.012, 0.009, 0.011], [fx + 0.008, h * 0.4, 0.002], { r: 0.0008, tint: [0.85, 0.82, 0.6] })
    for (const [y, r] of [[h * 0.52, 0.0065], [h * 0.3, 0.0085]] as const) k.cyl('rubber', r, 0.0012, [0, y, 0.002 + ct / 2 + 0.0005], { axis: 'z', seg: 18, tint: [0.15, 0.15, 0.15] })

    const key = merge(plateMesh([...circle(0.011, 20, -0.024, 0)], 0.0022, [circle(0.003, 10, -0.03, 0)]), plateMesh([[-0.014, -0.003], [0.026, -0.003], [0.03, 0], [0.026, 0.004], [0.02, 0.004], [0.018, 0.0065], [0.014, 0.004], [0.01, 0.0068], [0.006, 0.004], [0.002, 0.0062], [-0.014, 0.004]], 0.0018))
    k.put(place(key, { at: [-0.035, 0.0011, -0.008], yaw: 0.4, pitch: -Math.PI / 2 }), 'steel', { tint: BRASS })
    k.put(place(plateMesh([...circle(0.011, 20, -0.024, 0)], 0.0022, [circle(0.003, 10, -0.03, 0)]), { at: [-0.03, 0.0033, 0.012], yaw: -0.9, pitch: -Math.PI / 2 }), 'steel', { tint: [0.8, 0.8, 0.82] })
  },
  'iron-grate': (k) => {
    const { w, d } = k, fh = 0.03, ft = 0.006, bar = 0.012, paint: V3 = [0.26, 0.25, 0.25]
    for (const s of [-1, 1]) {
      k.box('steel', [w, fh, ft], [0, fh / 2, s * (d / 2 - ft / 2)], { r: 0.0012, tint: paint })
      k.box('steel', [ft, fh, d - 2 * ft], [s * (w / 2 - ft / 2), fh / 2, 0], { r: 0.0012, tint: paint })
    }
    const n = 9, inner = w - 2 * ft
    for (let i = 0; i < n; i++) k.box('steel', [bar, bar, d - 2 * ft + 0.002], [-inner / 2 + (i + 0.5) * inner / n, fh / 2, 0], { r: 0.0012, tint: paint })
    k.box('steel', [w - 2 * ft, ft, 0.03], [0, fh / 2 + bar / 2 + ft / 2, d * 0.12], { r: 0.001, tint: paint })

    for (let i = 0; i < n - 1; i++) {
      const x0 = -inner / 2 + (i + 0.5) * inner / n, x1 = x0 + inner / n, cx = (x0 + x1) / 2, rr = (x1 - x0) / 2 - bar / 2
      const pts: V3[] = []
      for (let j = 0; j <= 26; j++) { const t = j / 26, a = Math.PI + t * Math.PI * 2.2, r = rr * (1 - t * 0.55); pts.push([cx + Math.cos(a) * r * (j === 0 ? 1.02 : 1), fh / 2, -d / 2 + ft + rr + 0.004 + Math.sin(a) * r]) }
      k.put(sweepRaw(pts, bar * 0.45, { seg: 6, flat: 0.28 }), 'steel', { tint: paint })
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.extrude('steel', rrect(0.04, 0.03, 0.006, 3), 0.004, [sx * (w / 2 - 0.02), 0.002, sz * (d / 2 + 0.012)], { axis: 'y', holes: [circle(0.004, 10, 0, sz * 0.004)], tint: paint })
  },
  'aluminum-pot': (k) => {
    const R = 0.1, H = 0.105, t = 0.0022
    k.lathe('steel', fillet2([[0, 0], [R - 0.012, 0], [R, 0.014], [R, H - 0.006], [R + 0.0022, H - 0.0018], [R + 0.0034, H + 0.0008], [R + 0.0016, H + 0.0026], [R - t, H + 0.001], [R - t, 0.014], [R - 0.013, t], [0, t]], 0.003, 3), [0, 0, 0], { seg: 56, crease: 55, tint: ALU, wear: dents(0.0007, 30, 8) })

    k.lathe('steel', fillet2([[0, H + 0.03], [0.03, H + 0.028], [0.07, H + 0.019], [R + 0.004, H + 0.004], [R + 0.004, H + 0.0015], [R - 0.003, H + 0.0018], [R - 0.004, H + 0.0045], [0.07, H + 0.0175], [0.03, H + 0.0265], [0, H + 0.0285]].reverse() as V2[], 0.002, 2), [0, 0, 0], { seg: 56, crease: 60, tint: [0.92, 0.93, 0.95] })
    k.lathe('rubber', fillet2([[0, 0], [0.012, 0], [0.01, 0.006], [0.016, 0.012], [0.016, 0.017], [0.011, 0.02], [0, 0.02]], 0.0015, 2), [0, H + 0.0282, 0], { seg: 20, tint: BAKELITE })
    for (const s of [-1, 1]) {
      k.frame({ at: [s * (R + 0.002), H - 0.022, 0], yaw: s > 0 ? 0 : Math.PI }, () => {
        k.extrude('rubber', fillet2([[0, -0.006], [0.02, -0.01], [0.024, -0.004], [0.024, 0.006], [0.02, 0.011], [0, 0.007]], 0.003, 3, true), 0.034, [0, 0, 0], { axis: 'x', holes: [rrect(0.024, 0.008, 0.003, 3, 0, 0.0005).map(([z, y]) => [z, y] as V2)], bevel: 0.002, tint: BAKELITE })
      })
      for (const z of [-0.011, 0.011]) k.rivet([s * (R - 0.0002), H - 0.022, z], { r: 0.0026, yaw: s * Math.PI / 2, m: 'steel' })
    }
  },
  'pressure-cooker': (k) => {
    const R = 0.09, H = 0.15
    k.lathe('steel', fillet2([[0, 0], [R - 0.004, 0], [R + 0.002, 0.004], [R + 0.002, 0.014], [R - 0.001, 0.018], [R, H - 0.012], [R + 0.004, H - 0.006], [R + 0.004, H], [R - 0.0025, H], [R - 0.0025, 0.016], [0, 0.0025]], 0.0025, 3), [0, 0, 0], { seg: 56, crease: 55, tint: ALU, wear: dents(0.0006, 25, 4) })
    k.lathe('steel', fillet2([[0, H + 0.03], [0.05, H + 0.026], [R - 0.004, H + 0.012], [R + 0.006, H + 0.006], [R + 0.006, H + 0.002], [R - 0.006, H + 0.003], [R - 0.008, H - 0.006], [R - 0.012, H - 0.006], [0.05, H + 0.022], [0, H + 0.0265]].reverse() as V2[], 0.002, 2), [0, 0, 0], { seg: 56, crease: 60, tint: [0.88, 0.89, 0.91] })

    const handle = (y: number, x0: number, len: number, thick: number) => k.extrude('rubber', fillet2([[x0, -thick / 2], [x0 + len, -thick * 0.62], [x0 + len + 0.006, 0], [x0 + len, thick * 0.62], [x0, thick / 2]], 0.004, 3, true), 0.022, [0, y, 0], { axis: 'y', bevel: 0.003, tint: BAKELITE })
    handle(H - 0.018, R - 0.004, 0.04, 0.024)
    handle(H + 0.012, 0.03, R + 0.006, 0.02)
    k.box('steel', [0.03, 0.012, 0.03], [R + 0.0157, H - 0.018, 0], { r: 0.003, tint: ALU })
    for (const y of [H - 0.016, H + 0.012]) k.lathe('rubber', [[0, 0], [0.008, 0], [0.008, 0.012], [0.006, 0.016], [0, 0.016]], [-R - 0.006, y, 0], { axis: 'x', seg: 14, roll: Math.PI, tint: BAKELITE })
    k.cyl('steel', 0.0045, 0.014, [0, H + 0.033, 0], { seg: 14, tint: [0.8, 0.8, 0.82] })
    k.lathe('steel', fillet2([[0, 0], [0.012, 0], [0.012, 0.006], [0.008, 0.012], [0.005, 0.018], [0, 0.019]], 0.002, 2), [0, H + 0.038, 0], { seg: 20, tint: [0.7, 0.7, 0.72] })
    k.cyl('rubber', 0.0055, 0.008, [0.035, H + 0.026, 0.025], { seg: 14, tint: [0.75, 0.18, 0.12] })
  },
}
