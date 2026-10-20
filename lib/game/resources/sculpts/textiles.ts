import type { V2, V3 } from '../../blockout/sculpt/kit'
import { bandRaw, sack, stationAt } from './archetypes'
import { coilLoops, dents, fillet2, helix, loftRaw, patchRaw, pillow, ribbon, ropeLay, sweepRaw, type ResourceFamily, type Station } from './forms'
import { helmetShell } from './surfaces'

const OLIVE: V3 = [0.53, 0.58, 0.38]
const DARK: V3 = [0.29, 0.3, 0.27]
const TAN: V3 = [0.83, 0.71, 0.47]

export const TEXTILES: ResourceFamily = {
  'leather-boots': (k) => {
    const sole: Station[] = [{ y: 0, rx: 0.14, rz: 0.052, p: 3.3 }, { y: 0.005, rx: 0.146, rz: 0.055, p: 3.3 }, { y: 0.019, rx: 0.144, rz: 0.052, p: 3.3 }, { y: 0.023, rx: 0.137, rz: 0.05, p: 3.3 }]
    k.put(loftRaw(sole, { seg: 48, wear: (x, y, z) => y > 0.002 && y < 0.017 && Math.abs(z) > 0.04 ? -0.0018 * Math.max(0, Math.cos(x * 330)) : 0 }), 'rubber')
    const upper: Station[] = [{ y: 0.021, rx: 0.136, rz: 0.049, p: 3.2 }, { y: 0.041, rx: 0.135, rz: 0.05, cx: 0.001, p: 3 }, { y: 0.065, rx: 0.12, rz: 0.049, cx: -0.012, p: 2.8 }, { y: 0.092, rx: 0.083, rz: 0.044, cx: -0.047, p: 2.8 }, { y: 0.119, rx: 0.054, rz: 0.043, cx: -0.073, p: 2.6 }, { y: 0.178, rx: 0.05, rz: 0.041, cx: -0.077, p: 2.6 }, { y: 0.24, rx: 0.049, rz: 0.041, cx: -0.078, p: 2.6 }]
    k.put(loftRaw(upper, { seg: 48, caps: 'bottom', wear: dents(0.0015, 70, 24) }), 'leather', { tint: [0.56, 0.4, 0.28] })
    k.put(bandRaw(upper, 0.229, 0.24, 0, Math.PI * 2, 0.001, 48), 'leather', { tint: DARK })
    const lace: V3[] = []
    for (let i = 0; i < 8; i++) {
      const y = 0.109 + i * 0.017, s = stationAt(upper, y), z = (i % 2 ? 1 : -1) * 0.025
      lace.push([(s.cx ?? 0) + s.rx * (1 - Math.abs(z / s.rz) ** 2.6) ** (1 / 2.6) + 0.001, y, z])
    }
    k.put(sweepRaw(lace, 0.0016, { seg: 8 }), 'fabric', { tint: TAN })
    k.put(bandRaw(upper, 0.029, 0.033, 0, Math.PI * 2, 0.0011, 48), 'fabric', { tint: TAN })
  },
  'work-gloves': (k) => {
    const outline: V2[] = [[-0.042, -0.118], [0.04, -0.118], [0.043, -0.049], [0.07, -0.008], [0.064, 0.019], [0.052, 0.022], [0.035, -0.006], [0.036, 0.07], [0.03, 0.086], [0.018, 0.084], [0.016, 0.027], [0.011, 0.108], [0.003, 0.117], [-0.007, 0.112], [-0.011, 0.032], [-0.021, 0.107], [-0.032, 0.113], [-0.041, 0.105], [-0.035, 0.024], [-0.05, 0.081], [-0.061, 0.084], [-0.067, 0.074], [-0.051, -0.007], [-0.045, -0.042]]
    k.extrude('leather', fillet2(outline, 0.005, 3, true), 0.015, [0, 0.01, 0], { axis: 'y', bevel: 0.002, tint: TAN, warp: (x, y, z) => [0, 0, Math.max(0, z) * 0.12 * Math.sin(y * 60)] })
    k.extrude('leather', fillet2([[-0.043, -0.113], [0.039, -0.113], [0.038, -0.065], [-0.044, -0.065]], 0.004, 3, true), 0.002, [0, 0.019, 0], { axis: 'y', bevel: 0.0005, tint: [0.64, 0.5, 0.33] })
    k.put(sweepRaw([[-0.042, 0.0204, 0.066], [-0.014, 0.0204, 0.065], [0.014, 0.0204, 0.065], [0.037, 0.0204, 0.066]], 0.0007, { seg: 6 }), 'fabric', { tint: [0.86, 0.81, 0.66] })
  },
  'tanned-leather': (k) => {
    const edge: V2[] = [[-0.28, -0.1], [-0.2, -0.12], [-0.16, -0.188], [-0.09, -0.15], [0.045, -0.157], [0.135, -0.2], [0.19, -0.141], [0.294, -0.087], [0.262, -0.014], [0.211, 0.038], [0.278, 0.101], [0.187, 0.12], [0.138, 0.193], [0.067, 0.153], [-0.093, 0.159], [-0.179, 0.191], [-0.205, 0.112], [-0.291, 0.08], [-0.244, 0.02]]
    k.extrude('leather', fillet2(edge, 0.012, 4, true), 0.0028, [0, 0.003, 0], { axis: 'y', bevel: 0.0004, tint: [0.72, 0.49, 0.3], warp: (x, y) => [0, 0, 0.0015 + 0.0015 * Math.sin(x * 19 + y * 27)] })
  },
  'rain-poncho': (k) => {
    const cloth = pillow(0.176, 0.027, 0.116, { seam: 0.36, wrinkle: 0.75, pinch: 0.03, nx: 18, nz: 16, seed: 83, sealZ: 0.045 })
    k.put(cloth.raw, 'rubber', { tint: OLIVE })
    k.put(patchRaw(cloth.top, 0.06, 0.94, 0.47, 0.5, 0.0007, 20, 2), 'rubber', { tint: [0.31, 0.37, 0.23] })
    k.put(patchRaw(cloth.top, 0.34, 0.66, 0.65, 0.91, 0.001, 8, 8), 'fabric', { tint: [0.66, 0.67, 0.48] })
  },
  'nylon-rope': (k) => k.put(sweepRaw(coilLoops(0.116, 0.009, 4.6, { steps: 48, seed: 72, drift: 0.08, tails: 0.019 }), 0.009, { seg: 12, radius: ropeLay(0.009, 3, 0.12, 5.8) }), 'fabric', { tint: [0.7, 0.74, 0.65] }),
  'sisal-rope': (k) => k.put(sweepRaw(coilLoops(0.129, 0.008, 5.1, { steps: 48, seed: 45, drift: 0.07, tails: 0.018 }), 0.008, { seg: 12, radius: ropeLay(0.008, 3, 0.18, 4.7) }), 'straw', { tint: TAN }),
  paracord: (k) => k.put(sweepRaw(coilLoops(0.047, 0.0028, 5.2, { steps: 40, drift: 0.04, tails: 0.009 }), 0.0028, { seg: 10, radius: ropeLay(0.0028, 6, 0.06, 7) }), 'fabric', { tint: OLIVE }),
  'fishing-line': (k) => {
    k.lathe('paint', [[0.006, 0], [0.027, 0], [0.029, 0.002], [0.028, 0.004], [0.016, 0.005], [0.016, 0.025], [0.028, 0.026], [0.029, 0.028], [0.027, 0.03], [0.006, 0.03], [0.006, 0]], [0, 0, 0], { seg: 48, tint: [0.23, 0.43, 0.44] })
    k.put(sweepRaw(helix(0.0168, 0.00105, 18, { y0: 0.0054, steps: 36 }), 0.00055, { seg: 6 }), 'glass', { tint: [0.78, 0.86, 0.78] })
  },
  twine: (k) => {
    const profile: V2[] = [[0.011, 0.002], [0.025, 0.002]]
    for (let i = 0; i <= 110; i++) { const t = i / 110; profile.push([0.028 + 0.009 * Math.sin(t * Math.PI) - 0.0011 * Math.cos(t * 44 * Math.PI), 0.003 + t * 0.069]) }
    profile.push([0.011, 0.075], [0.011, 0.002])
    k.lathe('straw', profile, [0, 0, 0], { seg: 48, crease: 65, tint: TAN })
    k.lathe('paper', [[0.009, 0], [0.011, 0], [0.011, 0.078], [0.009, 0.078], [0.009, 0]], [0, 0, 0], { seg: 32, tint: TAN })
  },
  'burlap-sack': (k) => sack(k, 0.39, 0.024, 0.58, { m: 'straw', tint: TAN, ends: 'sewn', wrinkle: 0.9, seed: 22 }),
  backpack: (k) => {
    const stations: Station[] = [{ y: 0, rx: 0.109, rz: 0.043, p: 4 }, { y: 0.021, rx: 0.134, rz: 0.058, p: 4 }, { y: 0.16, rx: 0.143, rz: 0.059, p: 4 }, { y: 0.3, rx: 0.131, rz: 0.055, p: 4 }, { y: 0.364, rx: 0.113, rz: 0.047, p: 3 }, { y: 0.397, rx: 0.058, rz: 0.023, p: 2.5 }]
    k.put(loftRaw(stations, { seg: 48, wear: (x, y, z) => y > 0.008 ? dents(0.0025, 35, 29)(x, y, z) : 0 }), 'fabric', { tint: OLIVE })
    const pocket = pillow(0.213, 0.028, 0.166, { nx: 20, nz: 18, wrinkle: 0.5, seam: 0.35 })
    k.put(pocket.raw, 'fabric', { at: [0, 0.145, 0.058], pitch: Math.PI / 2, tint: [0.4, 0.45, 0.3] })
    k.put(patchRaw(pocket.top, 0.08, 0.92, 0.08, 0.1, 0.001, 24, 2), 'charcoal', { at: [0, 0.145, 0.058], pitch: Math.PI / 2 })
    for (const s of [-1, 1]) k.put(sweepRaw([[s * 0.07, 0.329, -0.054], [s * 0.086, 0.308, -0.076], [s * 0.099, 0.199, -0.081], [s * 0.097, 0.11, -0.075], [s * 0.08, 0.057, -0.055]], 0.013, { seg: 12, flat: 0.18 }), 'fabric', { tint: DARK })
    k.put(sweepRaw([[-0.047, 0.381, 0], [-0.044, 0.424, 0], [-0.023, 0.434, 0], [0.023, 0.434, 0], [0.044, 0.424, 0], [0.047, 0.381, 0]], 0.007, { seg: 10, flat: 0.4 }), 'fabric', { tint: DARK })
  },
  'mattress-foam': (k) => k.sheet('fabric', 0.59, 0.39, (x, z) => 0.089 + 0.0025 * Math.sin(x * 51) * Math.cos(z * 62) + 0.001 * Math.sin(x * 144 + z * 159), [0, 0, 0], { nx: 40, nz: 28, thickness: 0.085, tint: [0.89, 0.81, 0.5] }),
  'camping-tent': (k) => {
    const stations: Station[] = [{ y: -0.287, rx: 0.021, rz: 0.024 }, { y: -0.267, rx: 0.069, rz: 0.066 }, { y: -0.222, rx: 0.085, rz: 0.081 }, { y: 0.21, rx: 0.085, rz: 0.081 }, { y: 0.263, rx: 0.066, rz: 0.064 }, { y: 0.283, rx: 0.022, rz: 0.024 }]
    k.put(loftRaw(stations, { seg: 48, wear: dents(0.002, 50, 66) }).orient('x'), 'fabric', { at: [0, 0.085, 0], tint: [0.28, 0.44, 0.39] })
    for (const x of [-0.163, 0.164]) k.lathe('fabric', [[0.086, -0.012], [0.086, 0.012]], [x, 0.085, 0], { axis: 'x', seg: 48, scale: [1, 1, 0.96], tint: DARK })
    k.put(sweepRaw([[-0.1, 0.163, 0], [-0.075, 0.196, 0], [0.069, 0.196, 0], [0.096, 0.163, 0]], 0.006, { seg: 10, flat: 0.4 }), 'fabric', { tint: DARK })
  },
  'sleeping-bag': (k) => {
    const spiral: V2[] = Array.from({ length: 169 }, (_, i) => { const t = i / 168, a = t * Math.PI * 6.2; return [Math.cos(a) * (0.02 + t * 0.078), Math.sin(a) * (0.02 + t * 0.078)] as V2 })
    k.extrude('fabric', ribbon(spiral, 0.021), 0.357, [0, 0.108, 0], { axis: 'x', bevel: 0.002, tint: [0.3, 0.43, 0.5], warp: (x, y, z) => [0.0006 * Math.sin(z * 80 + y * 90), 0.0006 * Math.sin(z * 66), 0] })
    for (const x of [-0.113, 0.113]) k.lathe('fabric', [[0.109, -0.011], [0.109, 0.011]], [x, 0.108, 0], { axis: 'x', seg: 64, tint: DARK })
  },
  'hard-hat': (k) => {
    const shell = helmetShell(0.098, 0.131, 0.114, 0.0032)
    shell.raw.warp((x, y, z) => { const f = Math.max(0, 1 - y / 0.021) ** 2; return [x * f * 0.22, 0, z * f * 0.22] }).smooth(55)
    k.put(shell.raw, 'paint', { at: [0, -0.001, 0], tint: [0.96, 0.75, 0.18] })
  },
  'motorcycle-helmet': (k) => {
    const shell = helmetShell(0.123, 0.246, 0.14, 0.007, 1.66, true)
    k.put(shell.raw, 'paint', { tint: [0.3, 0.35, 0.39] })
    k.put(sweepRaw([[-0.116, 0.074, 0.041], [-0.101, 0.061, 0.091], [-0.068, 0.055, 0.133], [0, 0.057, 0.149], [0.068, 0.055, 0.133], [0.101, 0.061, 0.091], [0.116, 0.074, 0.041]], 0.017, { seg: 20, flat: 0.65 }), 'paint', { tint: [0.3, 0.35, 0.39] })
    const visor: V2[] = Array.from({ length: 15 }, (_, i) => { const a = 0.94 + i / 14 * 0.89; return [0.125 * Math.sin(a), 0.11962 + 0.13038 * Math.cos(a)] as V2 })
    k.lathe('glass', visor, [0, 0, 0], { seg: 48, arc: Math.PI * 0.91, phase: Math.PI * 0.045, scale: [1, 1, 1.15], tint: [0.45, 0.52, 0.55], crease: 80 })
    k.put(sweepRaw(shell.rim, 0.003, { seg: 8, closed: true }), 'rubber')
  },
  'ballistic-helmet': (k) => {
    const shell = helmetShell(0.115, 0.168, 0.133, 0.008, 0.27)
    k.put(shell.raw, 'fabric', { tint: OLIVE })
    k.put(sweepRaw(shell.rim, 0.0025, { seg: 8, closed: true }), 'rubber', { tint: DARK })
    k.put(sweepRaw([[-0.115, 0.006, 0], [-0.1, 0.002, 0.049], [-0.049, 0.002, 0.082], [0.037, 0.002, 0.072], [0.094, 0.002, 0.042], [0.115, 0.006, 0]], 0.006, { seg: 8, flat: 0.22 }), 'fabric', { tint: DARK })
  },
  'bulletproof-vest': (k) => {
    const outline: V2[] = [[-0.191, -0.166], [0.191, -0.166], [0.213, -0.104], [0.183, 0.039], [0.14, 0.072], [0.126, 0.172], [0.065, 0.174], [0.049, 0.127], [-0.049, 0.127], [-0.065, 0.174], [-0.126, 0.172], [-0.14, 0.072], [-0.183, 0.039], [-0.213, -0.104]]
    k.extrude('fabric', fillet2(outline, 0.012, 4, true), 0.041, [0, 0.024, 0], { axis: 'y', bevel: 0.005, tint: OLIVE })
    k.extrude('fabric', fillet2([[-0.118, -0.132], [0.118, -0.132], [0.132, -0.031], [0.077, 0.1], [-0.077, 0.1], [-0.132, -0.031]], 0.013, 4, true), 0.012, [0, 0.049, 0], { axis: 'y', bevel: 0.003, tint: [0.41, 0.46, 0.31] })
    for (const z of [-0.063, -0.02, 0.023, 0.066]) k.extrude('fabric', ribbon([[-0.104, 0.055], [-0.1, 0.058], [0.1, 0.058], [0.104, 0.055]], 0.002), 0.015, [0, 0, z], { bevel: 0.0004, tint: DARK })
  },
  'firefighter-gear': (k) => {
    const coat = pillow(0.48, 0.175, 0.338, { nx: 26, nz: 24, px: 0.38, pz: 0.42, wrinkle: 0.7, seam: 0.29, seed: 120, pinch: 0.09 })
    k.put(coat.raw, 'fabric', { tint: [0.66, 0.51, 0.3] })
    for (const v of [0.19, 0.68]) {
      k.put(patchRaw(coat.top, 0.04, 0.96, v, v + 0.1, 0.0009, 28, 5), 'fabric', { tint: [0.89, 0.83, 0.26] })
      k.put(patchRaw(coat.top, 0.04, 0.96, v + 0.03, v + 0.07, 0.0017, 28, 3), 'steel', { tint: [0.73, 0.75, 0.68] })
    }
    k.put(patchRaw(coat.top, 0.486, 0.51, 0.05, 0.95, 0.0011, 2, 28), 'charcoal')
    k.put(patchRaw(coat.top, 0.14, 0.34, 0.34, 0.59, 0.0012, 10, 10), 'fabric', { tint: [0.53, 0.42, 0.25] })
  },
}
