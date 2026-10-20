import { rboxRaw, type V3 } from '../../blockout/sculpt/kit'
import { aerosol, bottle, carton, jug, sachet, sack, tin, tub } from './archetypes'
import { merge, place, type ResourceFamily } from './forms'

const TAU = Math.PI * 2, FRONT = Math.PI / 2
const WHITE: V3 = [0.95, 0.95, 0.93], HDPE: V3 = [0.95, 0.95, 0.92], AMBER: V3 = [0.72, 0.42, 0.18], INK: V3 = [0.13, 0.13, 0.15]
const RED: V3 = [0.86, 0.15, 0.11], BLUE: V3 = [0.16, 0.36, 0.74], GREEN: V3 = [0.16, 0.55, 0.26], YELLOW: V3 = [0.97, 0.8, 0.12]
const front = (y0: number, y1: number, tint: V3, half = 0.95) => ({ y0, y1, a0: FRONT - half, a1: FRONT + half, tint })

export const CHEMICALS: ResourceFamily = {
  saltpeter: (k) => sack(k, k.w, k.h, k.d, { m: 'paint', ends: 'sewn', tint: WHITE, seed: 3, thread: [0.3, 0.3, 0.32], prints: [{ tint: BLUE, u0: 0.15, u1: 0.85, v0: 0.2, v1: 0.48 }, { tint: INK, u0: 0.25, u1: 0.75, v0: 0.56, v1: 0.64 }] }),
  'sulfur-powder': (k) => sack(k, k.w, k.h, k.d, { ends: 'sewn', tint: [0.9, 0.82, 0.58], seed: 5, prints: [{ tint: YELLOW, u0: 0.14, u1: 0.86, v0: 0.18, v1: 0.52 }, { tint: INK, u0: 0.3, u1: 0.7, v0: 0.6, v1: 0.68 }] }),
  'ammonium-nitrate': (k) => sack(k, k.w, k.h, k.d, { m: 'fabric', ends: 'sewn', tint: [0.94, 0.93, 0.9], seed: 7, prints: [{ tint: RED, u0: 0.12, u1: 0.88, v0: 0.18, v1: 0.42 }, { tint: INK, u0: 0.2, u1: 0.8, v0: 0.5, v1: 0.6 }, { tint: [0.95, 0.6, 0.12], u0: 0.38, u1: 0.62, v0: 0.68, v1: 0.82 }] }),
  'urea-fertilizer': (k) => sack(k, k.w, k.h, k.d, { m: 'fabric', ends: 'sewn', tint: [0.94, 0.93, 0.9], seed: 9, prints: [{ tint: GREEN, u0: 0.1, u1: 0.9, v0: 0.16, v1: 0.46 }, { tint: [0.2, 0.3, 0.6], u0: 0.25, u1: 0.75, v0: 0.54, v1: 0.64 }] }),
  'npk-fertilizer': (k) => sachet(k, k.w, k.h, k.d, { m: 'paint', tint: [0.24, 0.55, 0.22], sealZ: 0.05, px: 0.45, pz: 0.55, seed: 4, prints: [{ tint: WHITE, u0: 0.18, u1: 0.82, v0: 0.24, v1: 0.52 }, { tint: [0.95, 0.75, 0.15], u0: 0.3, u1: 0.7, v0: 0.6, v1: 0.72 }] }),
  'pool-chlorine': (k) => tub(k, 0.085, 0.21, { tint: WHITE, lidTint: [0.15, 0.45, 0.85], labels: [{ y0: 0.12, y1: 0.78, tint: [0.22, 0.58, 0.88] }, { y0: 0.3, y1: 0.55, tint: WHITE, arc: 2.2 }] }),
  'caustic-soda': (k) => bottle(k, 0.055, 0.124, { m: 'paint', tint: HDPE, neck: 0.036, shoulder: 0.8, neckH: 0.016, lip: 0.0025, cap: { kind: 'screw', tint: RED, h: 0.022 }, labels: [{ y0: 0.14, y1: 0.7, tint: YELLOW }, { y0: 0.3, y1: 0.55, tint: INK, arc: 1.6 }] }),
  'muriatic-acid': (k) => jug(k, 0.145, 0.27, 0.115, { tint: HDPE, capTint: BLUE, labels: [front(0.04, 0.15, YELLOW), front(0.16, 0.19, RED, 0.6)] }),
  acetone: (k) => bottle(k, 0.032, 0.13, { m: 'paint', tint: [0.97, 0.97, 0.97], neck: 0.011, shoulder: 0.72, neckH: 0.024, cap: { kind: 'flip', tint: RED }, labels: [{ y0: 0.12, y1: 0.66, tint: RED }, { y0: 0.3, y1: 0.48, tint: WHITE, arc: 1.8 }] }),
  'paint-thinner': (k) => tin(k, 0.056, 0.165, { lid: 'cone', tint: [0.85, 0.86, 0.88], capTint: INK, labels: [{ y0: 0.1, y1: 0.9, tint: BLUE }, { y0: 0.35, y1: 0.6, tint: WHITE, arc: 2.4 }] }),
  glycerin: (k) => bottle(k, 0.03, 0.12, { wall: 0.0022, tint: AMBER, fill: { level: 0.6, tint: [0.98, 0.97, 0.9] }, neck: 0.011, shoulder: 0.66, neckH: 0.03, cap: { kind: 'screw', tint: INK, h: 0.014 }, labels: [{ y0: 0.14, y1: 0.55, tint: WHITE }] }),
  'potassium-permanganate': (k) => {
    carton(k, 0.056, 0.018, 0.036, { tint: WHITE, prints: [{ face: 'top', w: 0.05, h: 0.012, tint: [0.5, 0.15, 0.55] }, { face: 'front', w: 0.045, h: 0.008, tint: [0.5, 0.15, 0.55] }] })
    for (const [x, z] of [[0.012, 0.012], [-0.006, 0.0125]] as const) k.cyl('plaster', 0.0045, 0.003, [x, 0.0186 + 0.0015, z], { seg: 14, tint: [0.42, 0.12, 0.45] })
  },
  'insecticide-spray': (k) => aerosol(k, 0.033, 0.215, { tint: YELLOW, capTint: [0.2, 0.55, 0.2], labels: [{ y0: 0.1, y1: 0.75, tint: GREEN }, { y0: 0.3, y1: 0.45, tint: RED, arc: 1.8 }] }),
  'rat-poison': (k) => {
    carton(k, 0.095, 0.028, 0.115, { tint: YELLOW, prints: [{ face: 'top', w: 0.08, h: 0.06, tint: RED }, { face: 'top', w: 0.05, h: 0.016, y: 0.014 - 0.02, tint: INK }, { face: 'front', w: 0.08, h: 0.012, tint: INK }] })

    k.put(merge(...[[0.03, 0.035, 0.4], [0.018, 0.042, -0.6], [0.034, 0.048, 1.2]].map(([x, z, yaw]) => place(rboxRaw(0.014, 0.008, 0.01, { r: 0.0025 }), { at: [x, 0, z], yaw }))), 'paint', { at: [0, 0.028 + 0.0045, 0], tint: [0.25, 0.62, 0.68] })
  },
  herbicide: (k) => jug(k, 0.195, 0.31, 0.145, { tint: HDPE, capTint: GREEN, labels: [{ y0: 0.012, y1: 0.04, a0: 0, a1: TAU, tint: GREEN }, front(0.06, 0.17, WHITE)] }),
  'baking-soda': (k) => carton(k, 0.075, 0.115, 0.045, { tint: [0.95, 0.52, 0.14], prints: [{ face: 'front', w: 0.062, h: 0.05, tint: WHITE }, { face: 'front', w: 0.05, h: 0.012, y: 0.092, tint: BLUE }, { face: 'right', w: 0.036, h: 0.07, tint: WHITE }] }),
  'battery-acid': (k) => jug(k, 0.115, 0.195, 0.095, { tint: HDPE, capTint: RED, labels: [front(0.03, 0.11, [0.95, 0.95, 0.95]), front(0.06, 0.09, RED, 0.5)] }),
  'lab-reagents': (k) => bottle(k, 0.037, 0.165, { wall: 0.0025, tint: AMBER, fill: { level: 0.5, tint: [0.85, 0.85, 0.8] }, neck: 0.013, shoulder: 0.7, neckH: 0.03, cap: { kind: 'screw', tint: BLUE, h: 0.018 }, labels: [{ y0: 0.18, y1: 0.55, tint: WHITE }, { y0: 0.3, y1: 0.42, tint: [0.95, 0.42, 0.1], arc: 0.6 }] }),
}
