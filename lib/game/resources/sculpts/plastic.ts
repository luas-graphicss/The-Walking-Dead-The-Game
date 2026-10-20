import { latheRaw, noise3, Raw, rboxRaw, type V2, type V3 } from '../../blockout/sculpt/kit'
import { atEnd, coil, jerrycan, tapeRoll } from './archetypes'
import { easeStations, fillet2, loftRaw, merge, patchRaw, place, ringPath, sweepRaw, type ResourceFamily, type Station } from './forms'

const TAU = Math.PI * 2
const YELLOW: V3 = [0.98, 0.82, 0.16]

function gloveRaw(side: 1 | -1, seed: number): Raw {
  const palm = loftRaw(easeStations([{ y: 0, rx: 0.046, rz: 0.0042 }, { y: 0.012, rx: 0.044, rz: 0.0046 }, { y: 0.06, rx: 0.039, rz: 0.005 }, { y: 0.1, rx: 0.044, rz: 0.0056 }, { y: 0.128, rx: 0.042, rz: 0.0052 }, { y: 0.136, rx: 0.036, rz: 0.0045 }], 3), { seg: 28, wear: (x, y, z) => (noise3(x * 60, y * 60, z * 60, seed) - 0.5) * 0.0012 })
  const finger = (x0: number, len: number, spread: number) => {
    const pts: V3[] = Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [x0 + spread * t, 0.126 + len * t, 0.0012] })
    return sweepRaw(pts, 0.0088, { seg: 10, flat: 0.5, radius: (_s, _a, t) => (t < 0.8 ? 1 - 0.1 * t : 0.92 * Math.sqrt(Math.max(0.04, 1 - ((t - 0.8) / 0.2) ** 2))) })
  }
  const thumbPts: V3[] = Array.from({ length: 8 }, (_, i) => { const t = i / 7; return [side * (0.036 + 0.03 * t), 0.06 + 0.042 * t, 0.0012] })
  const thumb = sweepRaw(thumbPts, 0.0095, { seg: 10, flat: 0.5, radius: (_s, _a, t) => (t < 0.78 ? 1 : 0.95 * Math.sqrt(Math.max(0.04, 1 - ((t - 0.78) / 0.22) ** 2))) })
  const cuff = place(sweepRaw(ringPath(0.046, 0.0052, 0, 28), 0.0018, { closed: true, seg: 6 }), { at: [0, 0.002, 0] })
  const fingers = [[-side * 0.03, 0.052, -side * 0.006], [-side * 0.01, 0.064, -side * 0.002], [side * 0.01, 0.062, side * 0.002], [side * 0.029, 0.05, side * 0.007]].map(([x, l, s]) => finger(x, l, s))

  return place(merge(palm, thumb, cuff, ...fingers), { pitch: Math.PI / 2, at: [0, 0.0056, -0.1] })
}

export const PLASTICS: ResourceFamily = {
  'plastic-jerrycan': (k) => jerrycan(k, k.w - 0.01, k.h - 0.01, k.d - 0.01, { tint: [0.95, 0.94, 0.9], capTint: [0.18, 0.38, 0.78] }),
  'plastic-bucket': (k) => {
    const r0 = 0.116, r1 = 0.142, H = 0.27, wall = 0.0022, blue: V3 = [0.2, 0.5, 0.85]
    const outer: V2[] = [[0, 0.0015], [r0 - 0.004, 0.0015], [r0 - 0.002, 0], [r0, 0.003], [r1 - 0.002, H - 0.03], [r1 + 0.004, H - 0.026], [r1 + 0.004, H - 0.016], [r1 + 0.002, H - 0.014], [r1 + 0.0035, H - 0.004], [r1 + 0.002, H], [r1 - 0.002, H]]
    const inner: V2[] = [[r1 - wall - 0.001, H - 0.004], [r0 - wall, 0.003 + wall], [0, 0.003 + wall]]
    k.lathe('paint', fillet2([...outer, ...inner], 0.0012, 2), [0, 0, 0], { seg: 48, crease: 55, tint: blue })
    for (const s of [-1, 1]) k.cyl('paint', 0.012, 0.008, [s * (r1 + 0.002), H - 0.03, 0], { axis: 'x', seg: 14, tint: blue })
    const bailPts: V3[] = Array.from({ length: 21 }, (_, i) => { const a = Math.PI * i / 20, up = Math.sin(a) * 0.1; return [-Math.cos(a) * (r1 + 0.007), H - 0.03 + up * 0.35, up * 0.94] })
    k.tube('steel', bailPts, 0.0022, { seg: 6, fillet: 0, tint: [0.7, 0.7, 0.72] })
    k.put(sweepRaw(bailPts.slice(7, 15), 0.0072, { seg: 10 }), 'paint', { tint: [0.15, 0.15, 0.16] })
  },
  'duct-tape': (k) => tapeRoll(k, 0.054, 0.037, 0.048, { tint: [0.72, 0.73, 0.75], tail: 0.05 }),
  'electrical-tape': (k) => tapeRoll(k, 0.029, 0.018, 0.019, { m: 'rubber', tint: [0.08, 0.08, 0.09], core: [0.85, 0.85, 0.82], tail: 0.022 }),
  'zip-ties': (k) => {

    const L = 0.135, n = 11, parts: Raw[] = []
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * 0.0039, flip = i % 2 ? 1 : -1, x = k.jitter(0.003)
      parts.push(place(rboxRaw(L, 0.0012, 0.0036, { r: 0.0004 }), { at: [x, 0.0006, z] }))
      parts.push(place(rboxRaw(0.0075, 0.0048, 0.0058, { r: 0.0008 }), { at: [x + flip * (L / 2 - 0.0035), 0.0024, z] }))
    }
    parts.push(place(sweepRaw(ringPath(0.021, 0.018, 0, 28), 0.0018, { closed: true, seg: 4, flat: 0.33 }), { at: [-0.025, 0.0012 + 0.0019, 0] }))
    parts.push(place(rboxRaw(0.008, 0.0048, 0.0058, { r: 0.0008 }), { at: [-0.025 + 0.021, 0.0012 + 0.0024 + 0.0006, 0] }))
    k.put(merge(...parts), 'paint', { tint: [0.95, 0.94, 0.9] })
    k.box('paper', [0.03, 0.0008, 0.05], [0.035, 0.0016, 0], { r: 0, tint: [0.92, 0.2, 0.16] })
  },
  'inner-tube': (k) => {

    const R = 0.19, rx = 0.032, ry = 0.0135, prof: V2[] = []
    for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + i / 24 * TAU; prof.push([R + Math.cos(a) * rx, ry + Math.sin(a) * ry]) }
    const wear = (x: number, y: number, z: number) => (noise3(x * 14, y * 14, z * 14, 4) - 0.5) * 0.006
    k.lathe('rubber', prof, [0, 0, 0], { seg: 64, crease: 80, tint: [0.16, 0.16, 0.17], wear })
    k.cyl('rubber', 0.0058, 0.022, [R - rx - 0.007, ry, 0], { axis: 'x', seg: 12, tint: [0.16, 0.16, 0.17] })
    k.cyl('steel', 0.0034, 0.012, [R - rx - 0.023, ry, 0], { axis: 'x', seg: 10, tint: [0.92, 0.76, 0.42] })
    const skin = (u: number, v: number): V3 => {
      const c = Math.cos(v), s = Math.sin(v), nr = c / rx, ny = s / ry, l = Math.hypot(nr, ny), p: V3 = [(R + rx * c) * Math.cos(u), ry + ry * s, (R + rx * c) * Math.sin(u)]
      const dd = wear(p[0], p[1], p[2])
      return [p[0] + Math.cos(u) * nr / l * dd, p[1] + ny / l * dd, p[2] + Math.sin(u) * nr / l * dd]
    }
    k.put(patchRaw(skin, 0.9, 1.08, Math.PI / 2 - 0.9, Math.PI / 2 + 0.9, 0.0014, 8, 8), 'rubber', { tint: [0.95, 0.45, 0.12] })
  },
  'old-tire': (k) => {

    const rc = 0.253, axIn = 0.063, axOut = 0.04, ay = k.h / 2 - 0.003, yc = ay, t0 = 0.82 * Math.PI, wall = 0.011, p = 3.2
    const point = (a: number, inset: number): V2 => {
      const c = Math.cos(a), s = Math.sin(a), ax = (c < 0 ? axIn : axOut) - inset
      return [rc + ax * Math.sign(c) * Math.abs(c) ** (2 / p), yc + (ay - inset) * Math.sign(s) * Math.abs(s) ** (2 / p)]
    }

    const outer = Array.from({ length: 73 }, (_, i) => { const u = -1 + 2 * i / 72; return point(t0 * Math.sign(u) * Math.abs(u) ** 1.8, 0) })
    const inner = Array.from({ length: 25 }, (_, i) => point(t0 - 2 * t0 * i / 24, wall))
    const tread = (x: number, y: number, z: number) => {
      const r = Math.hypot(x, z)
      if (r < rc + axOut - 0.008) return (noise3(x * 70, y * 70, z * 70, 9) - 0.5) * 0.0012
      const a = Math.atan2(z, x), groove = [-0.034, 0, 0.034].reduce((m, g) => Math.max(m, Math.exp(-(((y - yc - g) / 0.004) ** 2))), 0)
      return -0.0055 * groove - 0.004 * (Math.cos(a * 36 + (y > yc ? 0.8 : 0)) > 0.55 ? 1 : 0) * (Math.abs(y - yc) < ay * 0.62 ? 1 : 0)
    }
    k.lathe('rubber', [...outer, ...inner, outer[0]], [0, 0, 0], { seg: 144, crease: 70, tint: [0.15, 0.15, 0.16], wear: tread })
  },
  'rubber-bands': (k) => {
    const bands: Raw[] = []
    for (let i = 0; i < 14; i++) {
      const rx = 0.012 + k.rnd() * 0.006, rz = rx * (0.5 + k.rnd() * 0.5)
      bands.push(place(sweepRaw(ringPath(rx, rz, 0, 24, (a) => 1 + 0.06 * Math.sin(a * 3 + i)), 0.0011, { closed: true, seg: 5, flat: 0.5 }), { at: [k.jitter(0.016), 0.0013 + k.rnd() * 0.007, k.jitter(0.01)], yaw: k.rnd() * TAU, pitch: k.jitter(0.3), roll: k.jitter(0.3) }))
    }
    k.put(merge(...bands), 'rubber', { tint: [0.85, 0.62, 0.32] })
  },
  'rubber-gloves': (k) => {
    k.put(gloveRaw(1, 3), 'rubber', { at: [-0.004, 0, 0.002], yaw: 0.04, tint: YELLOW })
    k.put(gloveRaw(-1, 7), 'rubber', { at: [0.008, 0.0092, -0.004], yaw: -0.42, tint: [0.96, 0.78, 0.14] })
  },
  'food-container': (k) => {
    const body: Station[] = [{ y: 0, rx: 0.064, rz: 0.064, p: 6 }, { y: 0.004, rx: 0.067, rz: 0.067, p: 6 }, { y: 0.07, rx: 0.071, rz: 0.071, p: 6 }, { y: 0.074, rx: 0.0735, rz: 0.0735, p: 6 }]
    k.put(loftRaw(body, { seg: 48 }), 'glass', { tint: [0.95, 0.97, 0.98] })
    k.put(loftRaw([{ y: 0.002, rx: 0.061, rz: 0.061, p: 6 }, { y: 0.046, rx: 0.066, rz: 0.066, p: 6 }], { seg: 40, wear: (x, y, z) => (y > 0.044 ? (noise3(x * 80, 0, z * 80, 2) - 0.5) * 0.004 : 0) }), 'straw', { tint: [0.98, 0.94, 0.82] })
    const blue: V3 = [0.16, 0.42, 0.82]
    k.put(loftRaw([{ y: 0.0745, rx: 0.0745, rz: 0.0745, p: 6 }, { y: 0.084, rx: 0.0752, rz: 0.0752, p: 6 }, { y: 0.088, rx: 0.072, rz: 0.072, p: 6 }], { seg: 48 }), 'paint', { tint: blue })
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) k.frame({ yaw: a }, () => k.box('paint', [0.05, 0.022, 0.0028], [0, 0.0755, 0.0768], { r: 0.001, pitch: 0.08, tint: blue }))
  },
  'stretch-film': (k) => {
    const H = k.h, rc = 0.039, rf = 0.0575
    k.lathe('paper', [[rc - 0.0045, 0], [rc, 0], [rc, H], [rc - 0.0045, H], [rc - 0.0045, 0]], [0, 0, 0], { seg: 36, tint: [0.72, 0.58, 0.4] })

    k.put(merge(
      latheRaw(fillet2([[rc + 0.0003, 0.012], [rf, 0.014], [rf + 0.0012, H / 2], [rf, H - 0.014], [rc + 0.0003, H - 0.012], [rc + 0.0003, 0.012]], 0.002, 2), { seg: 48 }),
      latheRaw([[rf + 0.0026, 0.05], [rf + 0.0026, H - 0.06]], { seg: 48, arc: 0.7 }),
    ), 'glass', { tint: [0.88, 0.94, 0.95] })
  },
  'siphon-hose': (k) => {
    const pts = coil(k, 'glass', 0.075, 0.0055, 2.4, { tint: [0.88, 0.95, 0.9], tails: 0.035, seed: 7 })

    atEnd(k, pts, () => {
      k.tube('glass', [[0, -0.004, 0], [0, 0.006, -0.007], [0, 0.016, -0.014]], 0.0055, { seg: 8, tint: [0.88, 0.95, 0.9] })
      k.lathe('rubber', fillet2([[0, 0.012], [0.0068, 0.012], [0.0075, 0.018], [0.016, 0.03], [0.0188, 0.045], [0.0155, 0.06], [0.0075, 0.07], [0.0068, 0.076], [0, 0.076]], 0.002, 2), [0, 0, -0.014], { seg: 20, tint: [0.75, 0.14, 0.1] })
      k.cyl('glass', 0.0055, 0.016, [0, 0.082, -0.014], { seg: 10, tint: [0.88, 0.95, 0.9] })
    })
  },
}
