import { type V2, type V3 } from '../../blockout/sculpt/kit'
import { bandRaw, bottle, sack } from './archetypes'
import { circle, coilLoops, dents, fillet2, helix, loftRaw, pillow, ribbon, rrect, screwCap, sweepRaw, type ResourceFamily, type Station } from './forms'
import { leafRaw } from './surfaces'

const GREEN: V3 = [0.35, 0.5, 0.3]
const TAN: V3 = [0.76, 0.65, 0.4]
const DARK: V3 = [0.26, 0.27, 0.24]

export const FARMING: ResourceFamily = {
  'seed-potatoes': (k) => {
    k.lathe('fabric', [[0, 0], [0.089, 0], [0.131, 0.015], [0.139, 0.06], [0.126, 0.099], [0.123, 0.108], [0.12, 0.106], [0.123, 0.099], [0.136, 0.06], [0.128, 0.017], [0.088, 0.003], [0, 0.003]], [0, 0, 0], { seg: 48, scale: [1, 1, 1.34], tint: TAN, wear: (x, y, z) => y > 0.02 ? Math.sin(Math.atan2(z, x) * 15 + y * 14) * 0.0015 : 0 })
    for (const [i, p] of [[-0.067, -0.071], [0.02, -0.09], [0.077, -0.012], [-0.043, 0.016], [0.01, 0.08], [-0.071, 0.102]].entries()) {
      const stations: Station[] = [{ y: 0, rx: 0.021, rz: 0.027 }, { y: 0.012, rx: 0.033, rz: 0.044 }, { y: 0.044, rx: 0.037, rz: 0.051 }, { y: 0.073, rx: 0.026, rz: 0.034 }, { y: 0.081, rx: 0.01, rz: 0.012 }]
      k.put(loftRaw(stations, { seg: 24, wear: dents(0.005, 55, 41 + i) }), 'paint', { at: [p[0], 0.005, p[1]], yaw: i * 0.61, tint: [0.64 + i * 0.014, 0.49 + i * 0.01, 0.3] })
    }
  },
  seedlings: (k) => {
    for (let i = 0; i < 3; i++) k.frame({ at: [(i - 1) * 0.086, 0, i % 2 ? -0.035 : 0.023] }, () => {
      k.lathe('charcoal', [[0, 0], [0.023, 0], [0.031, 0.009], [0.034, 0.058], [0.031, 0.068], [0.029, 0.068], [0.032, 0.058], [0.029, 0.011], [0, 0.003]], [0, 0, 0], { seg: 32, wear: (x, y, z) => y > 0.007 ? Math.sin(Math.atan2(z, x) * 13 + y * 30) * 0.0014 : 0 })
      k.lathe('straw', [[0, 0], [0.03, 0], [0.029, 0.004], [0, 0.005]], [0, 0.058, 0], { seg: 24, tint: [0.3, 0.23, 0.15] })
      k.put(sweepRaw([[0, 0.059, 0], [0.004, 0.09, 0], [0.001, 0.119, 0.003], [0.005, 0.143, 0.004]], 0.0016, { seg: 8, radius: (_s, _a, t) => 1 - t * 0.55 }), 'paint', { tint: GREEN })
      for (let j = 0; j < 4; j++) k.put(leafRaw(0.033 + (j % 2) * 0.009, 0.012, 0.017), 'paint', { at: [0.002, 0.079 + j * 0.013, 0.001], yaw: j * 2.35 + i, pitch: 0.72, tint: GREEN })
    })
  },
  manure: (k) => sack(k, 0.387, 0.128, 0.572, { m: 'fabric', tint: [0.71, 0.67, 0.49], ends: 'tied', wrinkle: 0.65, seed: 97, tie: DARK, prints: [{ u0: 0.21, u1: 0.76, v0: 0.29, v1: 0.34, tint: GREEN }, { u0: 0.24, u1: 0.73, v0: 0.39, v1: 0.61, tint: [0.77, 0.77, 0.6] }] }),
  'hay-bale': (k) => {
    k.put(loftRaw([{ y: 0, rx: 0.354, rz: 0.193, p: 5 }, { y: 0.025, rx: 0.388, rz: 0.216, p: 5 }, { y: 0.177, rx: 0.39, rz: 0.219, p: 5 }, { y: 0.365, rx: 0.381, rz: 0.21, p: 5 }, { y: 0.396, rx: 0.345, rz: 0.186, p: 5 }], { seg: 64, crease: 30, wear: (x, y, z) => y > 0.01 ? dents(0.012, 110, 71)(x, y, z) : 0 }), 'straw', { tint: [0.87, 0.76, 0.44] })
    for (const x of [-0.216, 0.215]) {
      const pts: V3[] = [[x, 0.003, -0.181], [x, 0.024, -0.202], [x, 0.18, -0.217], [x, 0.363, -0.202], [x, 0.399, -0.167], [x, 0.399, 0.167], [x, 0.363, 0.202], [x, 0.18, 0.217], [x, 0.024, 0.202], [x, 0.003, 0.181]]
      k.put(sweepRaw(pts, 0.002, { seg: 8, closed: true }), 'fabric', { tint: DARK })
    }
  },
  'watering-can': (k) => {
    k.lathe('paint', fillet2([[0, 0], [0.058, 0], [0.066, 0.008], [0.073, 0.146], [0.068, 0.173], [0.061, 0.176], [0.058, 0.173], [0.065, 0.17], [0.07, 0.145], [0.063, 0.011], [0.057, 0.003], [0, 0.003]], 0.001, 2), [-0.052, 0, 0], { seg: 48, scale: [1.12, 1, 1], tint: GREEN })
    k.extrude('paint', ribbon([[-0.103, 0.051], [-0.143, 0.076], [-0.158, 0.14], [-0.141, 0.2], [-0.092, 0.212], [-0.062, 0.179]], 0.009), 0.022, [0, 0, 0], { bevel: 0.002, tint: GREEN })
    k.lathe('paint', [[0.014, 0], [0.019, 0], [0.013, 0.06], [0.009, 0.181], [0.0067, 0.181], [0.01, 0.06], [0.014, 0]], [-0.014, 0.052, 0], { seg: 28, roll: -0.72, tint: GREEN })
    k.frame({ at: [0.1053, 0.188, 0], roll: -0.72 }, () => {
      k.lathe('paint', [[0.007, 0], [0.01, 0], [0.029, 0.018], [0.031, 0.024], [0.028, 0.026], [0.026, 0.021], [0.007, 0.005], [0.007, 0]], [0, 0, 0], { seg: 36, tint: GREEN })
      k.extrude('steel', circle(0.028, 40), 0.0015, [0, 0.025, 0], { axis: 'y', bevel: 0.0003, holes: [circle(0.002, 8), ...Array.from({ length: 12 }, (_, i) => circle(0.002, 8, Math.cos(i / 12 * Math.PI * 2) * 0.019, Math.sin(i / 12 * Math.PI * 2) * 0.019))] })
    })
  },
  'backpack-sprayer': (k) => {
    const stations: Station[] = [{ y: 0, rx: 0.132, rz: 0.071, p: 4 }, { y: 0.018, rx: 0.145, rz: 0.084, p: 4 }, { y: 0.327, rx: 0.14, rz: 0.082, p: 4 }, { y: 0.393, rx: 0.119, rz: 0.071, p: 3.5 }, { y: 0.425, rx: 0.064, rz: 0.055, p: 3, cx: 0.043 }]
    k.put(loftRaw(stations, { seg: 48, wear: (x, y, z) => Math.abs(z) > 0.066 && Math.abs(x) < 0.085 && y > 0.05 && y < 0.32 ? -0.002 * Math.sin(y * 28) ** 2 : 0 }), 'paint', { tint: [0.82, 0.8, 0.54] })
    screwCap(k, 'paint', 0.037, 0.026, [0.043, 0.424, 0], { tint: GREEN })
    k.put(bandRaw(stations, 0.127, 0.255, 0.65, 2.5, 0.0013, 24), 'paper', { tint: GREEN })
    for (const s of [-1, 1]) k.put(sweepRaw([[s * 0.084, 0.355, -0.067], [s * 0.097, 0.31, -0.1], [s * 0.1, 0.115, -0.106], [s * 0.08, 0.053, -0.074]], 0.012, { seg: 10, flat: 0.22 }), 'fabric', { tint: DARK })
    k.put(sweepRaw([[-0.066, 0.412, 0], [-0.063, 0.474, 0], [-0.043, 0.485, 0], [0.002, 0.485, 0], [0.009, 0.444, 0]], 0.007, { seg: 12 }), 'paint', { tint: GREEN })
    k.put(sweepRaw([[0.131, 0.034, 0.02], [0.17, 0.015, 0.024], [0.172, 0.004, -0.047], [0.083, 0.004, -0.112], [-0.034, 0.004, -0.11], [-0.06, 0.004, -0.069], [0.006, 0.004, -0.023], [0.151, 0.02, -0.047], [0.169, 0.13, -0.033]], 0.004, { seg: 8 }), 'rubber')
    k.lathe('steel', [[0, 0], [0.003, 0], [0.003, 0.305], [0.006, 0.306], [0.006, 0.316], [0.002, 0.317], [0, 0.317]], [0.169, 0.128, -0.033], { seg: 16, roll: -0.014 })
  },
  'horse-tack': (k) => {
    for (const [x, z, rx, rz, y] of [[-0.053, 0.01, 0.077, 0.076, 0.0025], [0.062, -0.022, 0.067, 0.053, 0.006]]) {
      const pts: V3[] = Array.from({ length: 64 }, (_, i) => { const a = i / 64 * Math.PI * 2; return [x + rx * Math.cos(a), y + 0.012 * Math.sin(a) ** 2, z + rz * Math.sin(a)] as V3 })
      k.put(sweepRaw(pts, 0.0018, { seg: 12, closed: true, flat: 4.8 }), 'leather', { tint: [0.5, 0.35, 0.24] })
    }
    k.extrude('steel', rrect(0.029, 0.024, 0.004), 0.003, [0.124, 0.007, -0.022], { axis: 'y', bevel: 0.0006, holes: [rrect(0.021, 0.016, 0.002)] })
    k.put(sweepRaw([[-0.127, 0.004, 0.012], [-0.097, 0.004, -0.065], [-0.031, 0.004, -0.091], [0.016, 0.004, -0.071], [0.026, 0.006, -0.036]], 0.0017, { seg: 10, flat: 3.8 }), 'leather', { tint: DARK })
  },
  'vet-dewormer': (k) => bottle(k, 0.026, 0.105, { m: 'paint', tint: [0.86, 0.85, 0.74], shoulder: 0.71, neck: 0.011, neckH: 0.019, labels: [{ y0: 0.22, y1: 0.6, tint: GREEN }], cap: { kind: 'screw', tint: [0.23, 0.4, 0.48], h: 0.016 } }),
  'dog-leash': (k) => {
    k.put(sweepRaw(coilLoops(0.054, 0.0015, 3.3, { steps: 52, rise: 0.004, tails: 0.01, jitter: 0.04, drift: 0.03 }), 0.0015, { seg: 12, flat: 4 }), 'leather', { tint: [0.54, 0.34, 0.23] })
    k.extrude('steel', rrect(0.024, 0.016, 0.006), 0.004, [0.054, 0.003, -0.012], { axis: 'y', bevel: 0.0008, holes: [rrect(0.017, 0.009, 0.004)] })
  },
  mousetrap: (k) => {
    k.extrude('wood', rrect(0.176, 0.084, 0.005), 0.007, [0, 0.0035, 0], { axis: 'y', bevel: 0.001, tint: TAN })
    k.put(sweepRaw(helix(0.007, 0.0025, 8, { y0: -0.01, steps: 20 }), 0.0011, { seg: 6 }).orient('x'), 'steel', { at: [0, 0.014, 0] })
    k.put(sweepRaw([[-0.008, 0.018, 0], [-0.011, 0.018, -0.029], [0.067, 0.011, -0.029], [0.074, 0.011, -0.02], [0.074, 0.011, 0.02], [0.067, 0.011, 0.029], [0.013, 0.018, 0.029], [0.01, 0.018, 0]], 0.0019, { seg: 8 }), 'steel')
    k.extrude('steel', fillet2([[-0.048, -0.019], [-0.022, -0.019], [-0.016, 0.006], [-0.027, 0.019], [-0.048, 0.019]], 0.003, 2, true), 0.001, [0, 0.009, 0], { axis: 'y', bevel: 0.0002, holes: [circle(0.004, 12, -0.035, 0)], tint: [0.67, 0.55, 0.28] })
    k.put(sweepRaw([[-0.072, 0.009, 0], [-0.068, 0.012, 0], [-0.026, 0.01, 0]], 0.001, { seg: 6 }), 'steel')
  },
  'animal-snare': (k) => {
    k.put(sweepRaw(coilLoops(0.048, 0.0008, 2.8, { rise: 0.002, steps: 56, tails: 0.01, jitter: 0.02, drift: 0.015 }), 0.0008, { seg: 8 }), 'steel', { tint: [0.52, 0.53, 0.51] })
    k.extrude('steel', rrect(0.009, 0.014, 0.002), 0.002, [0.048, 0.002, -0.007], { axis: 'y', bevel: 0.0004, holes: [circle(0.0017, 10, 0, -0.003), circle(0.0017, 10, 0, 0.003)] })
  },
  'bear-trap': (k) => {
    k.extrude('steel', fillet2([[-0.165, -0.025], [0.166, -0.025], [0.174, -0.008], [0.163, 0.029], [-0.16, 0.028], [-0.175, 0.008]], 0.007, 3, true), 0.006, [0, 0.003, 0], { axis: 'y', bevel: 0.001, holes: [circle(0.008, 16, -0.146, 0), circle(0.008, 16, 0.147, 0)], tint: DARK })
    for (const s of [-1, 1]) {
      const jaw: V2[] = []
      for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; jaw.push([Math.cos(a) * 0.148, Math.sin(a) * 0.137 * s]) }
      for (let i = 36; i >= 0; i--) { const a = i / 36 * Math.PI, r = i % 3 === 1 ? 0.083 : 0.111; jaw.push([Math.cos(a) * r, Math.sin(a) * r * s]) }
      k.extrude('steel', jaw, 0.006, [0, 0.009, 0], { axis: 'y', bevel: 0.0008, tint: [0.6, 0.59, 0.52] })
      k.put(sweepRaw(helix(0.019, 0.006, 4, { y0: -0.012, steps: 24 }), 0.0025, { seg: 8 }).orient('x'), 'steel', { at: [s * 0.132, 0.022, 0] })
    }
    k.lathe('steel', [[0, 0], [0.017, 0], [0.018, 0.01], [0.036, 0.012], [0.038, 0.015], [0.032, 0.019], [0, 0.019]], [0, 0.005, 0], { seg: 32, tint: [0.6, 0.59, 0.52] })
  },
  'fishing-hooks': (k) => {
    k.extrude('paper', rrect(0.078, 0.115, 0.003), 0.0018, [0, 0.0009, 0], { axis: 'y', bevel: 0.0002, tint: [0.76, 0.71, 0.49] })
    for (let i = -1; i <= 1; i++) {
      const x = i * 0.024, pts: V3[] = [[x - 0.005, 0.0036, -0.023], [x - 0.005, 0.0036, 0.012]]
      for (let j = 0; j <= 16; j++) { const a = Math.PI - j / 16 * Math.PI; pts.push([x + Math.cos(a) * 0.006, 0.0036, 0.012 + Math.sin(a) * 0.009]) }
      pts.push([x + 0.006, 0.0036, 0.003])
      k.put(sweepRaw(pts, 0.0009, { seg: 8, radius: (_s, _a, t) => t > 0.88 ? Math.max(0.15, (1 - t) / 0.12) : 1 }), 'steel')
    }
    const cover = pillow(0.073, 0.012, 0.074, { wrinkle: 0, seam: 0.05, sealX: 0.055, sealZ: 0.055, nx: 16, nz: 14 })
    k.put(cover.raw, 'glass', { at: [0, 0.0028, 0.009], tint: [0.85, 0.87, 0.79] })
  },
  'fishing-net': (k) => {
    const pos = (u: number, v: number, off: number): V3 => [(u - 0.5) * 0.342 + (v - 0.5) * 0.039, 0.0015 + 0.073 * (Math.sin(Math.PI * u) * Math.sin(Math.PI * v)) ** 2 + off, (v - 0.5) * 0.261 + (u - 0.5) * 0.03]
    for (let axis = 0; axis < 2; axis++) for (let i = 0; i <= 10; i++) {
      const points: V3[] = Array.from({ length: 41 }, (_, j) => { const t = j / 40, fixed = i / 10, off = 0.00065 * Math.cos(t * 10 * Math.PI + i * Math.PI) * (axis ? -1 : 1); return axis ? pos(t, fixed, off) : pos(fixed, t, off) })
      k.put(sweepRaw(points, 0.001, { seg: 6 }), 'fabric', { tint: [0.65, 0.66, 0.49] })
    }
  },
}
