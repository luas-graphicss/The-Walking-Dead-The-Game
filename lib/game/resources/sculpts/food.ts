import { noise3, Raw, rboxRaw, type Kit, type V3 } from '../../blockout/sculpt/kit'
import { bottle, carton, sachet, sack, tin } from './archetypes'
import { easeStations, loftRaw, merge, place, sphereMesh, type ResourceFamily, type Station } from './forms'

const WHITE: V3 = [0.95, 0.95, 0.93], RED: V3 = [0.85, 0.15, 0.12], BLUE: V3 = [0.16, 0.38, 0.78], YELLOW: V3 = [0.97, 0.8, 0.15]
const GREEN: V3 = [0.2, 0.55, 0.28], BROWN: V3 = [0.42, 0.24, 0.14], KHAKI: V3 = [0.62, 0.56, 0.4], INK: V3 = [0.12, 0.12, 0.14]

function brick(k: Kit, w: number, h: number, d: number, tint: V3, prints: Parameters<typeof carton>[4]['prints'], cap?: V3) {
  carton(k, w, h, d, { tint, prints, tuck: false, r: 0.002, bulge: 0.0008 })
  k.box('paper', [w * 0.98, 0.0016, 0.007], [0, h + 0.0016, 0], { r: 0.0004, tint })
  for (const s of [-1, 1]) k.extrude('paper', [[0, 0], [d * 0.48, 0], [0, -0.02]], 0.0012, [s * (w / 2 + 0.0016), h - 0.001, d * 0.24], { yaw: Math.PI / 2, tint })

  if (cap) k.lathe('paint', [[0, h - 0.001], [0.012, h - 0.001], [0.012, h + 0.012], [0.0105, h + 0.0135], [0, h + 0.0135]], [w * 0.22, 0, d * 0.27], { seg: 20, tint: cap })
}

function mould(r: number, seed: number): Raw {
  return sphereMesh(r, 4, 10).displace((x, y, z) => (noise3(x * 300, y * 300, z * 300, seed) - 0.5) * r * 0.5)
}

export const FOOD: ResourceFamily = {
  'rice-bag': (k) => sachet(k, 0.25, 0.098, 0.38, { m: 'paint', tint: WHITE, sealZ: 0.04, px: 0.32, pz: 0.45, seed: 4, prints: [{ tint: RED, u0: 0.1, u1: 0.9, v0: 0.12, v1: 0.36 }, { tint: [0.96, 0.94, 0.84], m: 'straw', u0: 0.25, u1: 0.75, v0: 0.42, v1: 0.7 }, { tint: BLUE, u0: 0.2, u1: 0.8, v0: 0.76, v1: 0.86 }] }),
  'wheat-flour': (k) => sack(k, k.w, k.h, k.d, { ends: 'block', tint: WHITE, seed: 9, prints: [{ tint: [0.9, 0.55, 0.12], u0: 0.12, u1: 0.88, v0: 0.18, v1: 0.5 }, { tint: BLUE, u0: 0.25, u1: 0.75, v0: 0.58, v1: 0.68 }] }),
  'cereal-bar': (k) => sachet(k, 0.118, 0.013, 0.034, { m: 'paint', tint: [0.95, 0.75, 0.2], sealX: 0.1, teeth: true, px: 0.25, pz: 0.3, seed: 2, prints: [{ tint: [0.5, 0.25, 0.12], u0: 0.25, u1: 0.75, v0: 0.2, v1: 0.8 }] }),
  'chocolate-bar': (k) => {

    const segs: Raw[] = []
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) segs.push(place(rboxRaw(0.017, 0.006, 0.02, { r: 0.0022 }), { at: [0.03 + i * 0.0185, 0.0036, -0.0215 + j * 0.0215] }))
    k.put(merge(place(rboxRaw(0.14, 0.004, 0.066, { r: 0.001 }), { at: [0.005, 0.0024, 0] }), ...segs), 'paint', { tint: [0.36, 0.2, 0.12] })
    k.sheet('steel', 0.092, 0.07, (x, z) => 0.0054 + (noise3(x * 90, z * 90, 3) - 0.5) * 0.0006, [-0.028, 0, 0], { nx: 20, nz: 12, thickness: 0.0004, tint: [0.85, 0.86, 0.9] })
    carton(k, 0.07, 0.009, 0.072, { at: [-0.04, 0, 0], tint: [0.5, 0.2, 0.55], tuck: false, bulge: 0.0004, prints: [{ face: 'top', w: 0.06, h: 0.04, tint: [0.95, 0.85, 0.3] }] })
  },
  peanuts: (k) => {
    sachet(k, 0.115, 0.036, 0.17, { m: 'paint', tint: [0.9, 0.2, 0.15], sealZ: 0.05, px: 0.35, pz: 0.4, seed: 6, prints: [{ tint: [0.85, 0.6, 0.35], m: 'straw', u0: 0.25, u1: 0.75, v0: 0.3, v1: 0.62 }, { tint: YELLOW, u0: 0.2, u1: 0.8, v0: 0.68, v1: 0.8 }] })
    const kernel = (at: V3, yaw: number) => place(merge(place(sphereMesh(0.0062, 5, 10), { scale: [1.2, 0.85, 1] }), place(sphereMesh(0.0058, 5, 10), { at: [0.0085, 0, 0], scale: [1.15, 0.85, 1] })), { at, yaw })
    k.put(merge(kernel([0.01, 0.036 + 0.004, 0.02], 0.4), kernel([-0.012, 0.036 + 0.004, 0.035], -0.8)), 'paint', { tint: [0.82, 0.58, 0.32] })
  },
  'chocolate-powder': (k) => tin(k, 0.052, 0.14, { m: 'paint', lid: 'press', tint: [0.95, 0.85, 0.2], lidTint: GREEN, labels: [{ y0: 0.1, y1: 0.88, tint: [0.95, 0.85, 0.2] }, { y0: 0.3, y1: 0.6, tint: BROWN, arc: 2.6 }, { y0: 0.38, y1: 0.52, tint: RED, arc: 1.4 }] }),
  honey: (k) => bottle(k, 0.04, 0.11, { wall: 0.003, tint: [0.97, 0.95, 0.9], neck: 0.031, shoulder: 0.84, neckH: 0.012, lip: 0.002, fill: { level: 0.83, tint: [0.9, 0.55, 0.12] }, cap: { kind: 'screw', tint: [0.85, 0.7, 0.3], h: 0.016, m: 'steel' }, labels: [{ y0: 0.25, y1: 0.62, tint: [0.97, 0.92, 0.75], arc: 3 }] }),
  'soybean-oil': (k) => bottle(k, 0.037, 0.228, { wall: 0.0009, tint: [0.98, 0.95, 0.85], neck: 0.012, shoulder: 0.78, neckH: 0.03, ribs: [0.22, 0.6], fill: { level: 0.8, tint: [0.98, 0.82, 0.25] }, cap: { kind: 'flip', tint: YELLOW }, labels: [{ y0: 0.28, y1: 0.55, tint: YELLOW }, { y0: 0.34, y1: 0.48, tint: GREEN, arc: 1.8 }] }),
  vinegar: (k) => bottle(k, 0.032, 0.225, { wall: 0.0022, tint: [0.92, 0.95, 0.9], neck: 0.0115, shoulder: 0.64, neckH: 0.06, fill: { level: 0.72, tint: [0.98, 0.88, 0.62] }, cap: { kind: 'screw', tint: RED, h: 0.016 }, labels: [{ y0: 0.15, y1: 0.48, tint: WHITE }, { y0: 0.22, y1: 0.36, tint: RED, arc: 2 }] }),
  'dry-yeast': (k) => sachet(k, 0.078, 0.008, 0.098, { m: 'paint', tint: [0.82, 0.83, 0.86], sealX: 0.07, sealZ: 0.08, teeth: true, seed: 3, prints: [{ tint: RED, u0: 0.15, u1: 0.85, v0: 0.18, v1: 0.55 }, { tint: YELLOW, u0: 0.25, u1: 0.75, v0: 0.62, v1: 0.76 }] }),
  'dried-meat': (k) => {

    const meat = rboxRaw(0.15, 0.026, 0.1, { r: 0.008, seg: [10, 2, 7], disp: (f, s, t) => (noise3(s * 30, t * 30, f, 4) - 0.5) * 0.006 + (noise3(s * 120, t * 120, f, 9) - 0.5) * 0.0016 })
    k.put(meat, 'leather', { at: [0, 0.0142, 0], tint: [0.55, 0.22, 0.16] })
    sachet(k, 0.195, 0.038, 0.138, { m: 'glass', tint: [0.94, 0.96, 0.97], sealX: 0.06, sealZ: 0.07, px: 0.3, pz: 0.3, wrinkle: 0.15, seed: 7, prints: [{ tint: WHITE, m: 'paper', u0: 0.3, u1: 0.7, v0: 0.62, v1: 0.85 }] })
  },
  'mre-ration': (k) => sachet(k, 0.115, 0.035, 0.245, { m: 'paint', tint: KHAKI, sealZ: 0.06, px: 0.3, pz: 0.4, seed: 5, wrinkle: 0.3, prints: [{ tint: INK, u0: 0.18, u1: 0.82, v0: 0.4, v1: 0.48 }, { tint: INK, u0: 0.3, u1: 0.7, v0: 0.54, v1: 0.58 }] }),
  'freeze-dried-meal': (k) => {
    sachet(k, 0.155, 0.034, 0.215, { m: 'paint', tint: [0.95, 0.55, 0.15], sealZ: 0.09, px: 0.32, pz: 0.4, seed: 8, prints: [{ tint: WHITE, u0: 0.18, u1: 0.82, v0: 0.24, v1: 0.6 }, { tint: [0.2, 0.2, 0.22], u0: 0.3, u1: 0.7, v0: 0.66, v1: 0.74 }] })
    k.box('paint', [0.14, 0.0016, 0.0035], [0, 0.034 * 0.45 + 0.0014, 0.215 / 2 - 0.022], { r: 0.0006, tint: [0.85, 0.45, 0.12] })
  },
  'dog-food': (k) => sack(k, k.w, k.h, k.d, { m: 'paint', ends: 'block', tint: [0.85, 0.15, 0.12], seed: 11, prints: [{ tint: YELLOW, u0: 0.12, u1: 0.88, v0: 0.14, v1: 0.42 }, { tint: WHITE, u0: 0.25, u1: 0.75, v0: 0.5, v1: 0.78 }, { tint: [0.2, 0.2, 0.22], u0: 0.3, u1: 0.7, v0: 0.84, v1: 0.9 }] }),
  'animal-feed': (k) => sack(k, k.w, k.h, k.d, { m: 'fabric', ends: 'sewn', tint: [0.93, 0.92, 0.88], seed: 13, prints: [{ tint: GREEN, u0: 0.12, u1: 0.88, v0: 0.18, v1: 0.44 }, { tint: YELLOW, u0: 0.3, u1: 0.7, v0: 0.52, v1: 0.64 }] }),
  'rotten-food': (k) => {

    const loaf: Station[] = [{ y: 0, rx: 0.055, rz: 0.04, p: 3 }, { y: 0.03, rx: 0.058, rz: 0.042, p: 3 }, { y: 0.05, rx: 0.05, rz: 0.035, p: 2.6 }, { y: 0.06, rx: 0.03, rz: 0.022, p: 2.2 }]
    k.put(loftRaw(easeStations(loaf, 3), { seg: 32, wear: (x, y, z) => (noise3(x * 40, y * 40, z * 40, 3) - 0.5) * 0.004 }), 'paint', { at: [-0.04, 0, -0.03], yaw: 0.3, tint: [0.72, 0.5, 0.28] })
    k.put(sphereMesh(0.03, 8, 16).displace((x, y, z) => (noise3(x * 60, y * 60, z * 60, 5) - 0.5) * 0.006 - Math.max(0, y) * 0.15), 'paint', { at: [0.06, 0.027, 0.05], scale: [1, 0.9, 1], tint: [0.5, 0.32, 0.16] })
    carton(k, 0.08, 0.035, 0.07, { at: [0.062, 0, -0.05], yaw: -0.4, tint: [0.92, 0.9, 0.86], tuck: false, bulge: 0.002, prints: [{ face: 'top', w: 0.05, h: 0.035, tint: [0.75, 0.62, 0.35] }] })
    k.put(merge(place(mould(0.016, 2), { at: [-0.05, 0.055, -0.025], scale: [1.5, 0.35, 1.2] }), place(mould(0.012, 4), { at: [-0.015, 0.047, -0.04], scale: [1.2, 0.35, 1.3] })), 'fabric', { tint: [0.55, 0.62, 0.5] })
    k.put(place(mould(0.01, 6), { scale: [1.3, 0.5, 1.2] }), 'fabric', { at: [0.065, 0.053, 0.05], tint: [0.45, 0.55, 0.45] })
  },
  'water-jug': (k) => bottle(k, 0.13, 0.465, { wall: 0.0025, tint: [0.72, 0.86, 0.98], shoulder: 0.82, neck: 0.028, neckH: 0.06, lip: 0.004, ribs: [0.22, 0.32, 0.68, 0.76], fill: { level: 0.7, tint: [0.86, 0.94, 1] }, cap: { kind: 'screw', tint: BLUE, h: 0.032 }, labels: [{ y0: 0.42, y1: 0.58, tint: WHITE, arc: 2.5 }] }),
  'juice-box': (k) => {
    brick(k, 0.063, 0.105, 0.04, [0.95, 0.6, 0.15], [{ face: 'front', w: 0.05, h: 0.06, tint: YELLOW }, { face: 'front', w: 0.035, h: 0.035, y: 0.05, tint: [0.4, 0.7, 0.25] }, { face: 'right', w: 0.03, h: 0.07, tint: YELLOW }])

    k.cyl('paint', 0.0032, 0.09, [0.012, 0.055, -0.02 - 0.0015 - 0.0036], { seg: 10, roll: 0.15, tint: [0.95, 0.95, 0.96] })
  },
  'sports-drink': (k) => bottle(k, 0.032, 0.198, { wall: 0.0009, tint: [0.9, 0.95, 0.98], neck: 0.017, shoulder: 0.8, neckH: 0.022, ribs: [0.42, 0.47, 0.52], fill: { level: 0.82, tint: [0.35, 0.72, 0.95] }, cap: { kind: 'screw', tint: [0.95, 0.55, 0.12], h: 0.02 }, labels: [{ y0: 0.12, y1: 0.36, tint: [0.95, 0.55, 0.12] }, { y0: 0.18, y1: 0.3, tint: INK, arc: 1.6 }] }),
  cachaca: (k) => bottle(k, 0.037, 0.29, { wall: 0.003, tint: [0.9, 0.95, 0.9], shoulder: 0.58, neck: 0.012, neckH: 0.085, fill: { level: 0.62, tint: [0.98, 0.9, 0.62] }, cap: { kind: 'screw', tint: [0.78, 0.62, 0.3], h: 0.024, m: 'steel' }, labels: [{ y0: 0.14, y1: 0.42, tint: [0.96, 0.92, 0.78] }, { y0: 0.22, y1: 0.34, tint: [0.12, 0.35, 0.2], arc: 1.8 }] }),
  vodka: (k) => bottle(k, 0.036, 0.29, { wall: 0.0035, tint: [0.94, 0.97, 0.99], shoulder: 0.74, neck: 0.0135, neckH: 0.07, fill: { level: 0.7, tint: [0.97, 0.99, 1] }, cap: { kind: 'screw', tint: [0.8, 0.82, 0.85], h: 0.026, m: 'steel' }, labels: [{ y0: 0.18, y1: 0.5, tint: WHITE, arc: 2.6 }, { y0: 0.26, y1: 0.4, tint: [0.15, 0.25, 0.6], arc: 1.6 }] }),
  'uht-milk': (k) => brick(k, 0.093, 0.188, 0.06, WHITE, [{ face: 'front', w: 0.08, h: 0.1, tint: [0.3, 0.55, 0.9] }, { face: 'front', w: 0.06, h: 0.03, y: 0.14, tint: BLUE }, { face: 'right', w: 0.05, h: 0.12, tint: [0.3, 0.55, 0.9] }], BLUE),
}
