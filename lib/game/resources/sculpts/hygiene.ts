import { clamp, latheRaw, noise3, type Kit, type V3 } from '../../blockout/sculpt/kit'
import { aerosol, carton, flask, jug, sachet, squeezeTube } from './archetypes'
import { easeStations, fillet2, loftRaw, merge, place, rrect, sphereMesh, type ResourceFamily, type Station } from './forms'

const FRONT = Math.PI / 2
const WHITE: V3 = [0.95, 0.95, 0.94], KRAFT: V3 = [0.75, 0.6, 0.42], RED: V3 = [0.85, 0.15, 0.12], BLUE: V3 = [0.16, 0.38, 0.78]
const front = (y0: number, y1: number, tint: V3, half = 1) => ({ y0, y1, a0: FRONT - half, a1: FRONT + half, tint })

function softPack(k: Kit, w: number, h: number, d: number, tint: V3, bulge: number, prints: { w: number; h: number; y: number; tint: V3 }[]) {
  k.box('paint', [w, h, d], [0, h / 2, 0], { r: Math.min(0.02, h * 0.2), seg: [Math.ceil(w / 0.03), Math.ceil(h / 0.03), Math.ceil(d / 0.03)], tint, disp: (f, s, t, hs, ht) => (f === 3 ? 0 : bulge * Math.sqrt(clamp(1 - (s / hs) ** 2) * clamp(1 - (t / ht) ** 2)) + (noise3(s * 20, t * 20, f, 2) - 0.5) * bulge * 0.3) })
  for (const [i, p] of prints.entries()) for (const s of [-1, 1]) k.box('paper', [p.w, p.h, 0.0012], [0, p.y, s * (d / 2 + bulge * 1.15 + 0.0006 + i * 0.0013)], { r: 0, tint: p.tint })
}

function razor(k: Kit, at: V3, yaw: number, tint: V3) {
  k.frame({ at, yaw }, () => {
    k.put(loftRaw(easeStations([{ y: 0, rx: 0.0042, rz: 0.006 }, { y: 0.06, rx: 0.0038, rz: 0.0055 }, { y: 0.09, rx: 0.0028, rz: 0.004 }, { y: 0.1, rx: 0.003, rz: 0.005 }], 2), { seg: 18 }), 'paint', { at: [-0.06, 0.0042, 0], roll: -Math.PI / 2, tint })
    k.box('paint', [0.012, 0.008, 0.038], [0.045, 0.006, 0], { r: 0.003, tint })
    for (const x of [0.042, 0.046]) k.box('steel', [0.0016, 0.0008, 0.034], [x, 0.0104, 0], { r: 0, tint: [0.85, 0.86, 0.9] })
    k.box('paint', [0.003, 0.0008, 0.034], [0.0495, 0.0104, 0], { r: 0.0003, tint: [0.3, 0.75, 0.55] })
  })
}

export const HYGIENE: ResourceFamily = {
  'soap-bar': (k) => {

    k.sheet('paper', 0.088, 0.058, (x, z) => 0.0006 + (noise3(x * 60, z * 60, 3) - 0.5) * 0.0006 + Math.max(0, Math.abs(x) - 0.03) * 0.2, [0, 0, 0], { nx: 18, nz: 12, thickness: 0.0004, tint: [0.92, 0.82, 0.95] })
    const keys: Station[] = [{ y: 0.0013, rx: 0.036, rz: 0.023, p: 3 }, { y: 0.004, rx: 0.039, rz: 0.026, p: 3 }, { y: 0.018, rx: 0.039, rz: 0.026, p: 3 }, { y: 0.024, rx: 0.034, rz: 0.021, p: 3 }, { y: 0.026, rx: 0.026, rz: 0.015, p: 2.6 }]
    k.put(loftRaw(easeStations(keys, 3), { seg: 40 }), 'plaster', { tint: [0.96, 0.76, 0.82] })
    k.torus('plaster', 0.012, 0.0011, [0, 0.026, 0], { seg: 6, segR: 32, scale: [1.4, 0.45, 1], tint: [0.94, 0.72, 0.78] })
  },
  toothpaste: (k) => squeezeTube(k, 0.172, 0.0168, { tint: WHITE, capTint: RED, band: RED, flip: true }),
  toothbrush: (k) => {
    const handle: Station[] = [{ y: 0, rx: 0.0042, rz: 0.006, p: 2.6 }, { y: 0.01, rx: 0.0055, rz: 0.0085, p: 2.6 }, { y: 0.08, rx: 0.0052, rz: 0.0078, p: 2.6 }, { y: 0.115, rx: 0.0032, rz: 0.0034, p: 2.4 }, { y: 0.13, rx: 0.0032, rz: 0.0048, p: 3 }, { y: 0.17, rx: 0.0032, rz: 0.0056, p: 3 }, { y: 0.175, rx: 0.0028, rz: 0.004, p: 3 }]
    k.put(loftRaw(easeStations(handle, 3), { seg: 24 }), 'paint', { at: [-0.088, 0.0055, 0], roll: -Math.PI / 2, tint: [0.2, 0.55, 0.85] })
    k.box('rubber', [0.04, 0.0012, 0.009], [-0.045, 0.0118, 0], { r: 0.0005, tint: [0.95, 0.95, 0.96] })
    const tufts = []
    for (let i = 0; i < 8; i++) for (const z of [-0.0028, 0, 0.0028]) tufts.push(place(latheRaw([[0, 0], [0.0011, 0], [0.0011, 0.011], [0, 0.0115]], { seg: 6 }), { at: [0.047 + i * 0.0045, 0.0085, z] }))
    k.put(merge(...tufts), 'paint', { tint: WHITE })
  },
  'toilet-paper': (k) => {

    for (const x of [-0.0495, 0.0495]) for (const z of [-0.0495, 0.0495]) {
      k.lathe('paper', fillet2([[0.021, 0], [0.0485, 0], [0.0485, 0.096], [0.021, 0.096], [0.021, 0]], 0.003, 2), [x, 0.0485, z - 0.048], { axis: 'z', seg: 32, tint: WHITE })
      k.lathe('paper', [[0.018, 0.0005], [0.0208, 0.0005], [0.0208, 0.0955], [0.018, 0.0955], [0.018, 0.0005]], [x, 0.0485, z - 0.048], { axis: 'z', seg: 24, tint: KRAFT })
    }
    k.box('glass', [0.204, 0.1, 0.204], [0, 0.05, 0], { r: 0.02, tint: [0.95, 0.97, 1] })
    k.box('paper', [0.0012, 0.05, 0.13], [0.1026, 0.05, 0], { r: 0, tint: BLUE })
  },
  shampoo: (k) => flask(k, [{ y: 0, rx: 0.032, rz: 0.021, p: 2.4 }, { y: 0.005, rx: 0.034, rz: 0.023, p: 2.4 }, { y: 0.13, rx: 0.033, rz: 0.022, p: 2.4 }, { y: 0.165, rx: 0.025, rz: 0.017, p: 2.2 }, { y: 0.175, rx: 0.016, rz: 0.012, p: 2 }], {
    tint: [0.2, 0.6, 0.62], labels: [front(0.03, 0.12, WHITE, 1.1), front(0.06, 0.09, [0.8, 0.3, 0.5], 0.6)],
    neck: { r: 0.0115, h: 0.012, cap: 'flip', tint: WHITE, capH: 0.018 },
  }),
  disinfectant: (k) => flask(k, [{ y: 0, rx: 0.036, rz: 0.026, p: 4 }, { y: 0.005, rx: 0.038, rz: 0.028, p: 4 }, { y: 0.18, rx: 0.038, rz: 0.028, p: 4 }, { y: 0.205, rx: 0.022, rz: 0.018, p: 3 }, { y: 0.212, rx: 0.016, rz: 0.016, p: 2 }], {
    tint: [0.94, 0.94, 0.9], labels: [front(0.04, 0.16, [0.2, 0.55, 0.28], 1.1), front(0.08, 0.12, [0.95, 0.85, 0.2], 0.7)],
    neck: { r: 0.013, h: 0.016, cap: 'screw', tint: [0.2, 0.55, 0.28], capH: 0.016 },
  }),
  bleach: (k) => jug(k, 0.115, 0.245, 0.078, { tint: WHITE, capTint: BLUE, labels: [front(0.03, 0.14, BLUE), front(0.06, 0.1, WHITE, 0.5)] }),
  'dish-soap': (k) => flask(k, [{ y: 0, rx: 0.027, rz: 0.017, p: 2.6 }, { y: 0.005, rx: 0.029, rz: 0.019, p: 2.6 }, { y: 0.06, rx: 0.029, rz: 0.019, p: 2.6 }, { y: 0.1, rx: 0.024, rz: 0.016, p: 2.6 }, { y: 0.14, rx: 0.028, rz: 0.018, p: 2.6 }, { y: 0.17, rx: 0.02, rz: 0.014, p: 2.4 }, { y: 0.178, rx: 0.012, rz: 0.012, p: 2 }], {
    tint: [0.55, 0.78, 0.25], labels: [front(0.025, 0.07, WHITE, 1.1)],
    neck: { r: 0.0095, h: 0.01, cap: 'sport', tint: [0.95, 0.95, 0.95], capH: 0.012 },
  }),
  'laundry-powder': (k) => carton(k, 0.19, 0.245, 0.075, { tint: BLUE, prints: [{ face: 'front', w: 0.15, h: 0.12, y: 0.13, tint: WHITE }, { face: 'front', w: 0.1, h: 0.04, y: 0.14, tint: RED }, { face: 'right', w: 0.06, h: 0.18, tint: WHITE }, { face: 'back', w: 0.15, h: 0.08, tint: WHITE }] }),
  'razor-blades': (k) => {
    razor(k, [0, 0, -0.022], 0.05, BLUE)
    razor(k, [0.005, 0, 0.022], -0.08, [0.95, 0.95, 0.95])
  },
  'deodorant-spray': (k) => aerosol(k, 0.0235, 0.165, { tint: [0.15, 0.15, 0.2], capTint: [0.62, 0.64, 0.7], labels: [{ y0: 0.1, y1: 0.75, tint: [0.15, 0.15, 0.2] }, { y0: 0.3, y1: 0.55, tint: [0.3, 0.6, 0.9], arc: 1.6 }] }),
  'steel-wool': (k) => {
    sachet(k, 0.095, 0.022, 0.075, { m: 'paper', tint: [0.9, 0.15, 0.12], sealX: 0.08, teeth: true, seed: 8, prints: [{ tint: WHITE, u0: 0.2, u1: 0.8, v0: 0.25, v1: 0.6 }] })

    const pad = sphereMesh(0.028, 8, 16).displace((x, y, z) => (noise3(x * 140, y * 140, z * 140, 3) - 0.5) * 0.005 + (noise3(x * 40, y * 40, z * 40, 7) - 0.5) * 0.008)
    k.put(pad.smooth(80), 'steel', { at: [0.006, 0.022 + 0.009, 0.004], scale: [1.3, 0.42, 1], tint: [0.78, 0.78, 0.8] })
  },
  hairspray: (k) => aerosol(k, 0.028, 0.235, { tint: [0.86, 0.62, 0.74], capTint: [0.92, 0.84, 0.58], labels: [{ y0: 0.12, y1: 0.75, tint: [0.92, 0.84, 0.58] }, { y0: 0.32, y1: 0.5, tint: [0.86, 0.62, 0.74], arc: 1.8 }] }),
  diapers: (k) => {
    softPack(k, 0.29, 0.185, 0.19, [0.92, 0.94, 0.98], 0.006, [{ w: 0.2, h: 0.12, y: 0.09, tint: [0.45, 0.7, 0.92] }, { w: 0.08, h: 0.03, y: 0.15, tint: [0.95, 0.75, 0.2] }])
    k.extrude('paint', rrect(0.2, 0.04, 0.01, 3), 0.0016, [0, 0.185 + 0.018, 0], { holes: [rrect(0.08, 0.016, 0.008, 3, 0, 0.004)], bevel: 0.0004, tint: [0.92, 0.94, 0.98] })
  },
  'sanitary-pads': (k) => {
    softPack(k, 0.118, 0.056, 0.078, [0.95, 0.85, 0.9], 0.004, [{ w: 0.09, h: 0.03, y: 0.028, tint: [0.75, 0.35, 0.6] }])
    k.box('paint', [0.1, 0.0012, 0.026], [0, 0.056 + 0.0046 + 0.0006, 0.024], { r: 0.0004, tint: [0.75, 0.35, 0.6] })
  },
  'trash-bags-heavy': (k) => {
    const at: V3 = [-0.065, 0.044, 0]
    k.lathe('rubber', fillet2([[0.0152, 0], [0.044, 0], [0.044, 0.13], [0.0152, 0.13], [0.0152, 0]], 0.002, 2), at, { axis: 'x', seg: 40, tint: [0.1, 0.1, 0.11] })
    k.lathe('paper', [[0.012, 0.0004], [0.0151, 0.0004], [0.0151, 0.1296], [0.012, 0.1296], [0.012, 0.0004]], at, { axis: 'x', seg: 24, tint: KRAFT })
    k.lathe('paper', [[0.0453, 0.035], [0.0453, 0.095]], at, { axis: 'x', seg: 40, tint: [0.95, 0.75, 0.15] })
  },
  'wet-wipes': (k) => {
    sachet(k, 0.2, 0.055, 0.11, { m: 'paint', tint: [0.86, 0.93, 0.98], sealX: 0.05, px: 0.3, pz: 0.25, wrinkle: 0.15, seed: 5, prints: [{ tint: [0.2, 0.55, 0.85], u0: 0.12, u1: 0.4, v0: 0.2, v1: 0.8 }] })

    k.extrude('paint', rrect(0.08, 0.05, 0.012, 4), 0.004, [0.03, 0.055 + 0.0022, 0], { axis: 'y', bevel: 0.0012, tint: [0.2, 0.55, 0.85] })
    k.box('paint', [0.004, 0.003, 0.03], [0.072, 0.0575, 0], { r: 0.001, tint: [0.2, 0.55, 0.85] })
  },
}
