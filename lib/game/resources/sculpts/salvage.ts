import { type V2, type V3 } from '../../blockout/sculpt/kit'
import { bottle } from './archetypes'
import { circle, coilLoops, dents, fillet2, gearOutline, helix, ribbon, rrect, seeded, sweepRaw, type ResourceFamily } from './forms'
import { fractureRaw } from './surfaces'

const COPPER: V3 = [0.9, 0.5, 0.27]
const WORN: V3 = [0.62, 0.61, 0.54]

export const SALVAGE: ResourceFamily = {
  'concrete-chunks': (k) => {
    for (let i = 0; i < 6; i++) k.put(fractureRaw(0.126, 0.056 + (i % 3) * 0.033, 0.129, 84 + i, 9), 'concrete', { at: [(i % 3 - 1) * 0.122, 0, (Math.floor(i / 3) - 0.5) * 0.13], yaw: i * 0.33 })
    k.put(sweepRaw([[-0.134, 0.043, 0.065], [-0.107, 0.048, 0.07], [-0.074, 0.045, 0.068], [-0.059, 0.029, 0.072]], 0.0035, { seg: 10, radius: (s, a) => 1 + 0.13 * Math.cos(s * 1400 + a * 2) }), 'steel', { tint: [0.59, 0.38, 0.22] })
  },
  'broken-bricks': (k) => {
    const positions: V3[] = [[-0.079, 0.025, -0.044], [0.065, 0.029, -0.04], [-0.008, 0.022, 0.052]]
    for (let i = 0; i < positions.length; i++) {
      const outline: V2[] = [[-0.059, -0.036], [0.056, -0.036], [0.061, -0.024], [0.042, -0.009], [0.052, 0.013], [0.034, 0.037], [-0.054, 0.034], [-0.064, 0.017]]
      k.extrude('brick', outline, positions[i][1] * 2, positions[i], { axis: 'y', bevel: 0.0013, yaw: i * 0.13, holes: [rrect(0.018, 0.041, 0.002, 2, -0.031, 0), rrect(0.018, 0.041, 0.002, 2, 0.002, 0)], tint: [0.94, 0.72 + i * 0.05, 0.52] })
    }
    k.put(fractureRaw(0.04, 0.016, 0.032, 36, 6), 'brick', { at: [0.103, 0, 0.052] })
  },
  'glass-shards': (k) => {
    const rng = seeded(364)
    for (let i = 0; i < 9; i++) {
      const outline: V2[] = Array.from({ length: 5 }, (_, j) => { const a = j / 5 * Math.PI * 2, r = 0.72 + rng() * 0.28; return [Math.cos(a) * 0.034 * r, Math.sin(a) * 0.028 * r] as V2 })
      k.extrude('glass', outline, 0.0018, [(i % 3 - 1) * 0.071, 0.0011, (Math.floor(i / 3) - 1) * 0.062], { axis: 'y', bevel: 0.00012, yaw: i * 0.8, tint: [0.72, 0.87, 0.8], warp: (x, y) => [0, 0, 0.0015 * Math.sin(x * 38) ** 2] })
    }
  },
  'salvaged-wiring': (k) => {
    const colors: V3[] = [[0.66, 0.18, 0.12], [0.23, 0.36, 0.49], [0.25, 0.25, 0.23]]
    for (let i = 0; i < 3; i++) {
      const points = coilLoops(0.056 + i * 0.007, 0.002, 2.5 + i * 0.4, { steps: 48, seed: i + 8, drift: 0.08, jitter: 0.07, tails: 0.012 })
      k.put(sweepRaw(points, 0.002, { seg: 10 }), 'rubber', { tint: colors[i] })
      const a = points[points.length - 2], b = points[points.length - 1], l = Math.hypot(b[0] - a[0], b[2] - a[2])
      k.put(sweepRaw([b, [b[0] + (b[0] - a[0]) / l * 0.009, b[1], b[2] + (b[2] - a[2]) / l * 0.009]], 0.0012, { seg: 7 }), 'steel', { tint: COPPER })
    }
  },
  'copper-pipe': (k) => k.lathe('steel', [[0.0086, -0.299], [0.0107, -0.299], [0.0109, -0.29], [0.0108, 0.281], [0.011, 0.291], [0.0109, 0.3], [0.0087, 0.3], [0.0087, -0.299], [0.0086, -0.299]], [0, 0.011, 0], { axis: 'x', seg: 48, tint: COPPER, wear: dents(0.00025, 80, 4) }),
  'appliance-scrap': (k) => {
    k.extrude('paint', ribbon([[-0.181, 0.075], [-0.179, 0.004], [-0.153, 0.003], [0.126, 0.007], [0.171, 0.028], [0.178, 0.138], [0.155, 0.178]], 0.003), 0.244, [0, 0, 0], { bevel: 0.0005, tint: [0.77, 0.76, 0.67] })
    k.extrude('paint', fillet2([[-0.166, 0.005], [0.12, 0.009], [0.163, 0.03], [0.153, 0.139], [0.127, 0.155], [-0.123, 0.095], [-0.165, 0.072]], 0.003, 2, true), 0.002, [0, 0, -0.121], { bevel: 0.0003, holes: Array.from({ length: 9 }, (_, i) => rrect(0.014, 0.052, 0.003, 3, -0.115 + i * 0.028, 0.06)), tint: [0.68, 0.68, 0.61] })
    k.lathe('steel', [[0, -0.051], [0.027, -0.051], [0.034, -0.044], [0.035, -0.026], [0.029, -0.023], [0.029, 0.023], [0.035, 0.026], [0.034, 0.044], [0.027, 0.051], [0, 0.051]], [-0.059, 0.042, 0.018], { axis: 'x', seg: 32, tint: WORN })
    k.put(sweepRaw(helix(0.031, 0.0028, 14, { y0: -0.02, steps: 24 }), 0.0017, { seg: 6 }).orient('x'), 'steel', { at: [-0.059, 0.042, 0.018], tint: COPPER })
    k.put(sweepRaw([[0.151, 0.051, 0.05], [0.095, 0.08, 0.07], [0.043, 0.069, 0.036], [-0.036, 0.063, 0.036]], 0.003, { seg: 8 }), 'rubber')
  },
  'fridge-compressor': (k) => {
    k.extrude('steel', fillet2([[-0.096, -0.067], [-0.074, -0.076], [-0.046, -0.054], [0.046, -0.054], [0.074, -0.076], [0.096, -0.065], [0.083, -0.027], [0.083, 0.032], [0.096, 0.065], [0.073, 0.077], [0.043, 0.055], [-0.043, 0.055], [-0.073, 0.077], [-0.096, 0.065], [-0.083, 0.032], [-0.083, -0.027]], 0.005, 3, true), 0.006, [0, 0.003, 0], { axis: 'y', bevel: 0.001, holes: [[-0.078, -0.06], [0.078, -0.06], [-0.078, 0.06], [0.078, 0.06]].map(([x, z]) => circle(0.005, 16, x, z)), tint: WORN })
    k.lathe('charcoal', fillet2([[0, 0.005], [0.046, 0.005], [0.067, 0.021], [0.086, 0.051], [0.09, 0.094], [0.092, 0.098], [0.092, 0.103], [0.089, 0.106], [0.086, 0.151], [0.07, 0.176], [0.038, 0.191], [0, 0.195]], 0.003, 3), [0, 0, 0], { seg: 48 })
    k.put(sweepRaw([[0.082, 0.11, 0], [0.106, 0.119, 0], [0.113, 0.153, 0.008], [0.106, 0.17, 0.025]], 0.005, { seg: 16, caps: false }), 'steel', { tint: COPPER })
    k.put(sweepRaw([[-0.073, 0.063, 0.029], [-0.1, 0.065, 0.031], [-0.111, 0.085, 0.025]], 0.004, { seg: 16, caps: false }), 'steel', { tint: COPPER })
    k.extrude('paint', fillet2([[-0.024, -0.019], [0.024, -0.019], [0.028, 0.016], [0, 0.033], [-0.028, 0.016]], 0.007, 4, true), 0.018, [0, 0.076, 0.081], { bevel: 0.004, tint: [0.25, 0.26, 0.23] })
  },
  'car-parts': (k) => {
    const arm: V2[] = [[-0.161, -0.069], [-0.144, -0.091], [-0.103, -0.071], [-0.025, 0.059], [-0.034, 0.091], [-0.071, 0.088], [-0.094, 0.02], [-0.134, 0.07], [-0.158, 0.059], [-0.159, 0.036], [-0.123, -0.003]]
    k.extrude('steel', fillet2(arm, 0.008, 4, true), 0.016, [0, 0.009, 0], { axis: 'y', bevel: 0.002, holes: [circle(0.009, 20, -0.143, -0.061), circle(0.008, 20, -0.142, 0.046), circle(0.011, 20, -0.05, 0.068)], tint: WORN })
    k.put(sweepRaw(helix(0.033, 0.011, 6, { y0: 0.004, steps: 32 }), 0.004, { seg: 12 }), 'steel', { at: [0.093, 0, 0.062], tint: [0.45, 0.41, 0.33] })
    const holes = [circle(0.019, 28), ...Array.from({ length: 6 }, (_, i) => circle(0.0035, 12, Math.cos(i / 6 * Math.PI * 2) * 0.03, Math.sin(i / 6 * Math.PI * 2) * 0.03))]
    k.extrude('steel', circle(0.056, 64), 0.006, [0.091, 0.003, -0.059], { axis: 'y', bevel: 0.0008, holes, tint: [0.66, 0.56, 0.4] })
  },
  gears: (k) => {
    for (const [x, z, r, teeth, height] of [[-0.023, 0, 0.034, 18, 0.014], [0.035, -0.023, 0.021, 13, 0.01], [0.028, 0.027, 0.016, 11, 0.018]]) {
      const bore: V2[] = circle(r * 0.28, 24).map(([x, y], i) => i === 0 || i === 23 ? [x + r * 0.14, y] : [x, y])
      k.extrude('steel', fillet2(gearOutline(teeth, r * 0.8, r), 0.0005, 2, true), height, [x, height / 2, z], { axis: 'y', bevel: 0.0007, holes: [bore], tint: WORN })
    }
  },
  'rubber-belt': (k) => k.lathe('rubber', [[0.127, 0.001], [0.136, 0.001], [0.14, 0.004], [0.14, 0.016], [0.136, 0.019], [0.127, 0.019], [0.125, 0.016], [0.125, 0.004], [0.127, 0.001]], [0, 0, 0], { seg: 240, crease: 40, scale: [1.04, 1, 0.93], wear: (x, _y, z) => Math.hypot(x, z) < 0.129 ? Math.max(0, Math.cos(Math.atan2(z, x) * 80)) * 0.0015 : 0 }),
  'piano-wire': (k) => k.put(sweepRaw(coilLoops(0.082, 0.00065, 8.2, { steps: 64, rise: 0.00145, jitter: 0.012, drift: 0.01, tails: 0.012 }), 0.00065, { seg: 6 }), 'steel', { tint: [0.7, 0.72, 0.73] }),
  'glass-bottle': (k) => bottle(k, 0.032, 0.246, { m: 'glass', tint: [0.59, 0.77, 0.53], wall: 0.0023, shoulder: 0.61, neck: 0.0107, neckH: 0.05, heel: 0.0035, punt: 0.006 }),
  cardboard: (k) => {
    for (let i = 0; i < 4; i++) {
      const base = i * 0.0072 + 0.0004, w = 0.481 - i * 0.007, d = 0.381 - i * 0.005
      const bend = (x: number, z: number) => 0.002 * (Math.abs(x) / (w / 2)) ** 5 + 0.0006 * Math.sin(z * 21 + i)
      k.sheet('paper', w, d, (x, z) => base + bend(x, z), [i * 0.002, 0, 0], { nx: 16, nz: 10, thickness: 0.00045, tint: [0.72, 0.57, 0.35] })
      k.sheet('paper', w - 0.002, d - 0.002, (x, z) => base + 0.0024 + bend(x, z) + 0.0017 * Math.sin(x * 190), [i * 0.002, 0, 0], { nx: 92, nz: 8, thickness: 0.00035, tint: [0.62, 0.46, 0.28] })
      k.sheet('paper', w, d, (x, z) => base + 0.0048 + bend(x, z), [i * 0.002, 0, 0], { nx: 16, nz: 10, thickness: 0.00045, tint: [0.78, 0.64, 0.4] })
    }
  },
  'access-card': (k) => {
    k.extrude('paint', rrect(0.085, 0.054, 0.0032, 6), 0.0012, [0, 0.0007, 0], { axis: 'y', bevel: 0.0002, holes: [rrect(0.013, 0.003, 0.001, 4, -0.025, 0.02)], tint: [0.86, 0.87, 0.78] })
    k.extrude('paint', rrect(0.084, 0.009, 0.001), 0.0003, [0, 0.00165, -0.011], { axis: 'y', bevel: 0, tint: [0.22, 0.38, 0.39] })
    k.extrude('steel', rrect(0.014, 0.012, 0.002), 0.0003, [-0.021, 0.0017, 0.005], { axis: 'y', bevel: 0.0001, holes: [rrect(0.0005, 0.011, 0.0001), rrect(0.013, 0.0005, 0.0001, 2, 0, -0.0025), rrect(0.013, 0.0005, 0.0001, 2, 0, 0.0025)], tint: [0.87, 0.7, 0.34] })
    for (let i = 0; i < 4; i++) k.extrude('paint', rrect(0.026 - i * 0.003, 0.001, 0.0003), 0.00015, [0.012, 0.0018, 0.001 + i * 0.003], { axis: 'y', bevel: 0, tint: [0.29, 0.34, 0.31] })
  },
  'cash-notes': (k) => {
    const surface = (x: number, z: number) => 0.0007 * Math.sin(x * 37) ** 2 + 0.0004 * Math.sin(z * 66) ** 2
    for (let i = 0; i < 10; i++) k.sheet('paper', 0.147 - (i % 3) * 0.0007, 0.068, (x, z) => 0.0025 + i * 0.0011 + surface(x, z), [(i % 2) * 0.0008, 0, 0], { nx: 14, nz: 8, thickness: 0.0009, tint: [0.64, 0.71, 0.52] })
    const printY = (x: number, z: number) => 0.0133 + surface(x, z)
    for (const cx of [-0.044, 0.044]) for (let j = 0; j < 5; j++) {
      const pts: V3[] = Array.from({ length: 65 }, (_, i) => { const a = i / 64 * Math.PI * 2, x = cx + Math.cos(a) * (0.016 - j * 0.0017), z = Math.sin(a) * (0.023 - j * 0.002); return [x, printY(x, z), z] as V3 })
      k.put(sweepRaw(pts.slice(0, -1), 0.0002, { seg: 4, closed: true, flat: 0.45 }), 'paint', { tint: [0.29, 0.44, 0.32] })
    }
    k.extrude('paper', rrect(0.073, 0.018, 0.0015, 4, 0, 0.009), 0.032, [0, 0, 0], { axis: 'x', bevel: 0.0002, holes: [rrect(0.0705, 0.015, 0.0009, 4, 0, 0.009)], tint: [0.85, 0.79, 0.61] })
  },
}
