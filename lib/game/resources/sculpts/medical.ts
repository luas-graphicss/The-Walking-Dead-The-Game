import { latheRaw, noise3, rboxRaw, sheetRaw, type Kit, type V2, type V3 } from '../../blockout/sculpt/kit'
import { ampoule, blister, bottle, carton, flask, sachet, squeezeTube } from './archetypes'
import { bladeRaw, easeStations, fillet2, loftRaw, merge, place, ringPath, rrect, shade, sphereMesh, sweepRaw, type ResourceFamily, type Station } from './forms'

const TAU = Math.PI * 2, FRONT = Math.PI / 2
const WHITE: V3 = [0.95, 0.95, 0.93], AMBER: V3 = [0.72, 0.42, 0.18], CLEAR: V3 = [0.93, 0.96, 0.97], INK: V3 = [0.13, 0.13, 0.15]
const RED: V3 = [0.84, 0.15, 0.12], BLUE: V3 = [0.18, 0.4, 0.78], GREEN: V3 = [0.2, 0.55, 0.3], ORANGE: V3 = [0.95, 0.55, 0.12], STEEL: V3 = [0.86, 0.87, 0.9]
const front = (y0: number, y1: number, tint: V3, half = 1) => ({ y0, y1, a0: FRONT - half, a1: FRONT + half, tint })

function vial(k: Kit, r: number, h: number, o: { at?: V3; glass?: V3; flip: V3; fill: V3; level?: number; label?: V3 }) {
  bottle(k, r, h, { at: o.at, wall: Math.min(0.0014, r * 0.1), tint: o.glass ?? CLEAR, shoulder: 0.7, neck: r * 0.62, neckH: h * 0.17, lip: r * 0.16, punt: 0.0015, fill: { level: o.level ?? 0.35, tint: o.fill }, cap: { kind: 'crimp', tint: o.flip }, labels: o.label ? [{ y0: 0.15, y1: 0.58, tint: o.label }] : [] })
}

function syringe(k: Kit, len: number, r: number, at: V3, yaw: number, cap: V3) {
  const barrel = len * 0.55, y = at[1] + r + 0.0002
  k.frame({ at: [at[0], y, at[2]], yaw }, () => {
    k.lathe('glass', fillet2([[r - 0.0008, 0], [r, 0], [r, barrel], [r * 0.4, barrel + 0.004], [r * 0.25, barrel + 0.012], [r * 0.18, barrel + 0.012], [r * 0.18, barrel + 0.004], [r - 0.0008, barrel - 0.001], [r - 0.0008, 0]], 0.0004, 1), [0, 0, 0], { axis: 'z', seg: 18, tint: CLEAR })
    k.box('paint', [r * 4.2, 0.0016, 0.0016], [0, 0, 0.0008], { r: 0.0005, tint: WHITE })
    k.lathe('paint', [[r + 0.0009, barrel * 0.2], [r + 0.0009, barrel * 0.85]], [0, 0, 0], { axis: 'z', seg: 18, arc: 0.5, phase: Math.PI / 2 - 0.25, tint: INK })
    k.box('paint', [r * 1.2, r * 1.2, len * 0.42], [0, 0, -len * 0.2], { r: 0.0004, tint: WHITE })
    k.cyl('paint', r * 1.5, 0.0016, [0, 0, -len * 0.41], { axis: 'z', seg: 16, tint: WHITE })
    k.cyl('rubber', r - 0.0009, 0.004, [0, 0, barrel * 0.62], { axis: 'z', seg: 16, tint: INK })
    k.lathe('paint', fillet2([[0, barrel + 0.01], [r * 0.32, barrel + 0.01], [r * 0.28, barrel + len * 0.3], [0, barrel + len * 0.3]], 0.0005, 1), [0, 0, 0], { axis: 'z', seg: 12, tint: cap })
  })
}

export const MEDICAL: ResourceFamily = {
  'dipyrone-drops': (k) => bottle(k, 0.016, 0.062, { wall: 0.0015, tint: AMBER, fill: { level: 0.6, tint: [0.98, 0.92, 0.7] }, neck: 0.0075, shoulder: 0.7, neckH: 0.014, cap: { kind: 'dropper', tint: WHITE, h: 0.03 }, labels: [{ y0: 0.12, y1: 0.6, tint: WHITE }, { y0: 0.3, y1: 0.42, tint: [0.2, 0.35, 0.75], arc: 1.6 }] }),
  ceftriaxone: (k) => vial(k, 0.0125, 0.052, { flip: [0.3, 0.55, 0.85], fill: [0.98, 0.96, 0.85], level: 0.3, label: WHITE }),
  'vet-antibiotic': (k) => vial(k, 0.023, 0.092, { glass: AMBER, flip: RED, fill: [0.95, 0.9, 0.75], level: 0.6, label: [0.95, 0.95, 0.9] }),
  'oral-rehydration': (k) => sachet(k, 0.078, 0.008, 0.118, { tint: WHITE, sealX: 0.07, sealZ: 0.06, teeth: true, seed: 3, prints: [{ tint: ORANGE, u0: 0.14, u1: 0.86, v0: 0.12, v1: 0.5 }, { tint: GREEN, u0: 0.2, u1: 0.8, v0: 0.58, v1: 0.74 }] }),
  'povidone-iodine': (k) => bottle(k, 0.024, 0.1, { wall: 0.0018, tint: AMBER, fill: { level: 0.7, tint: [0.45, 0.18, 0.08] }, neck: 0.009, shoulder: 0.7, neckH: 0.02, cap: { kind: 'screw', tint: WHITE, h: 0.014 }, labels: [{ y0: 0.12, y1: 0.6, tint: WHITE }, { y0: 0.25, y1: 0.4, tint: [0.55, 0.2, 0.1], arc: 1.8 }] }),
  'alcohol-70': (k) => bottle(k, 0.038, 0.185, { m: 'paint', tint: [0.96, 0.96, 0.96], neck: 0.014, shoulder: 0.8, neckH: 0.022, cap: { kind: 'flip', tint: BLUE }, labels: [{ y0: 0.1, y1: 0.7, tint: BLUE }, { y0: 0.3, y1: 0.5, tint: WHITE, arc: 2 }] }),
  'hydrogen-peroxide': (k) => bottle(k, 0.028, 0.124, { m: 'paint', tint: [0.36, 0.26, 0.2], neck: 0.0105, shoulder: 0.74, neckH: 0.02, cap: { kind: 'screw', tint: WHITE, h: 0.014 }, labels: [{ y0: 0.12, y1: 0.62, tint: WHITE }, { y0: 0.3, y1: 0.42, tint: BLUE, arc: 1.6 }] }),
  'saline-solution': (k) => flask(k, [{ y: 0, rx: 0.031, rz: 0.021, p: 2.6 }, { y: 0.005, rx: 0.033, rz: 0.023, p: 2.6 }, { y: 0.11, rx: 0.033, rz: 0.023, p: 2.6 }, { y: 0.135, rx: 0.016, rz: 0.013, p: 2.2 }, { y: 0.14, rx: 0.011, rz: 0.011, p: 2 }], {
    tint: [0.96, 0.97, 0.97], labels: [front(0.02, 0.1, WHITE, 1.1), front(0.04, 0.06, BLUE, 0.7)],
    neck: { r: 0.0085, h: 0.012, cap: 'dropper', tint: [0.9, 0.92, 0.95], capH: 0.016 },
  }),
  'cough-syrup': (k) => {
    bottle(k, 0.028, 0.105, { wall: 0.002, tint: AMBER, fill: { level: 0.65, tint: [0.55, 0.12, 0.1] }, neck: 0.012, shoulder: 0.72, neckH: 0.02, cap: { kind: 'screw', tint: WHITE, h: 0.016 }, labels: [{ y0: 0.12, y1: 0.62, tint: WHITE }, { y0: 0.25, y1: 0.42, tint: [0.75, 0.2, 0.3], arc: 1.8 }] })

    k.lathe('glass', fillet2([[0.0145, 0.096], [0.0168, 0.096], [0.0158, 0.124], [0, 0.125], [0, 0.1232], [0.0144, 0.1222], [0.0145, 0.096]], 0.0006, 1), [0, 0, 0], { seg: 28, tint: [0.95, 0.95, 0.98] })
  },
  'child-fever-syrup': (k) => {
    bottle(k, 0.022, 0.095, { at: [-0.006, 0, 0], wall: 0.0018, tint: AMBER, fill: { level: 0.6, tint: [0.95, 0.5, 0.3] }, neck: 0.0095, shoulder: 0.72, neckH: 0.02, cap: { kind: 'screw', tint: [0.95, 0.85, 0.2], h: 0.013 }, labels: [{ y0: 0.12, y1: 0.62, tint: WHITE }] })

    k.frame({ at: [0.026, 0.006, 0], yaw: 0.25 }, () => {
      k.lathe('glass', [[0.0045, -0.04], [0.0054, -0.04], [0.0054, 0.03], [0.0016, 0.036], [0.0016, 0.042], [0, 0.042], [0, 0.04], [0.0045, 0.03], [0.0045, -0.04]], [0, 0, 0], { axis: 'z', seg: 14, tint: CLEAR })
      k.box('paint', [0.0064, 0.0064, 0.03], [0, 0, -0.054], { r: 0.0006, tint: WHITE })
    })
  },
  'iv-bag': (k) => {
    sachet(k, 0.14, 0.026, 0.19, { m: 'glass', at: [0, 0, 0.012], tint: [0.9, 0.95, 0.98], sealX: 0.07, sealZ: 0.09, seed: 6, wrinkle: 0.2, prints: [{ tint: WHITE, u0: 0.18, u1: 0.82, v0: 0.3, v1: 0.72, m: 'paper' }] })

    const hs = 0.026 * 0.45
    for (const [x, tint] of [[-0.016, [0.2, 0.45, 0.85]], [0.016, WHITE]] as const) k.cyl('paint', 0.0042, 0.03, [x, hs, -0.083 - 0.013], { axis: 'z', seg: 12, tint: tint as V3 })
    k.extrude('glass', rrect(0.05, 0.022, 0.006, 3), 0.0012, [0, hs + 0.0009, 0.107 + 0.01], { axis: 'y', holes: [rrect(0.022, 0.007, 0.0035, 3)], bevel: 0.0002, tint: [0.9, 0.95, 0.98] })
  },
  'first-aid-kit': (k) => {
    const { w, h, d } = k
    k.cushion('fabric', [w - 0.01, h - 0.012, d - 0.01], [0, (h - 0.012) / 2, 0], { puff: 0.016, r: 0.03, wrinkle: 0.12, tint: [0.8, 0.14, 0.12] })

    const zip: V3[] = rrect(w + 0.005, d + 0.007, 0.036, 6).map(([x, z]) => [x, (h - 0.012) * 0.45, z])
    k.put(sweepRaw(zip, 0.0032, { closed: true, seg: 6, flat: 0.45 }), 'fabric', { tint: [0.15, 0.15, 0.16] })
    k.box('steel', [0.016, 0.004, 0.008], [w / 2 - 0.003 + 0.008, (h - 0.012) * 0.45, 0.03], { r: 0.0015, tint: [0.75, 0.75, 0.78] })
    k.put(sweepRaw([[-0.05, h - 0.016, -0.02], [-0.04, h + 0.006, -0.02], [0.04, h + 0.006, -0.02], [0.05, h - 0.016, -0.02]], 0.007, { seg: 8, flat: 0.35 }), 'fabric', { tint: [0.15, 0.15, 0.16] })
    k.put(merge(rboxRaw(0.075, 0.0016, 0.024, { r: 0.0006 }), rboxRaw(0.024, 0.0016, 0.075, { r: 0.0006 })), 'fabric', { at: [0, h - 0.012 + 0.0012, 0.02], tint: WHITE })
  },
  'suture-kit': (k) => blister(k, 0.118, 0.078, { card: [0.95, 0.96, 0.98], bubble: { w: 0.096, d: 0.054, h: 0.009, p: 8 }, prints: [{ x: 0, z: 0.0345, w: 0.08, d: 0.006, tint: [0.35, 0.2, 0.55] }] }, () => {
    const needle: V3[] = Array.from({ length: 12 }, (_, i) => { const a = Math.PI * (0.1 + 0.8 * i / 11); return [-0.02 + Math.cos(a) * 0.012, 0.0024, Math.sin(a) * 0.012 - 0.006] })
    k.put(sweepRaw(needle, 0.0006, { seg: 6, radius: (_s, _a, t) => 1 - 0.7 * t }), 'steel', { tint: STEEL })
    const thread: V3[] = Array.from({ length: 64 }, (_, i) => { const a = i / 63 * TAU * 3; return [0.014 + Math.cos(a) * (0.016 + i * 0.0001), 0.0019, Math.sin(a) * (0.012 + i * 0.0001)] })
    k.put(sweepRaw([[-0.008, 0.0019, -0.006], ...thread], 0.0004, { seg: 4 }), 'fabric', { tint: [0.45, 0.25, 0.65] })
  }),
  tourniquet: (k) => {

    const loop: V3[] = rrect(0.1, 0.03, 0.013, 6).map(([x, z]) => [x, 0.019, z])
    k.put(sweepRaw(loop, 0.019, { closed: true, seg: 10, flat: 0.1 }), 'fabric', { tint: [0.15, 0.15, 0.16] })
    k.cyl('paint', 0.0045, 0.12, [0.005, 0.038 + 0.0025, 0], { axis: 'x', seg: 12, tint: INK })
    k.box('paint', [0.03, 0.022, 0.009], [-0.035, 0.019, 0.0195], { r: 0.003, tint: INK })
    k.box('fabric', [0.022, 0.03, 0.0035], [0.051, 0.019, -0.012], { r: 0.0012, tint: RED })
    k.box('steel', [0.016, 0.02, 0.006], [-0.054, 0.019, 0], { r: 0.0015, tint: [0.3, 0.3, 0.32] })
  },
  syringes: (k) => {
    syringe(k, 0.14, 0.0055, [-0.032, 0, 0.004], 0.02, ORANGE)
    syringe(k, 0.13, 0.0048, [0, 0, -0.004], -0.04, [0.2, 0.55, 0.85])
    syringe(k, 0.12, 0.0042, [0.03, 0, 0.006], 0.05, [0.95, 0.85, 0.2])
  },
  insulin: (k) => vial(k, 0.011, 0.055, { flip: ORANGE, fill: [0.92, 0.94, 0.95], level: 0.7, label: [0.95, 0.95, 0.95] }),
  epinephrine: (k) => {
    ampoule(k, 0.0058, 0.048, { at: [-0.006, 0, 0], ring: RED, fill: [0.97, 0.97, 0.9] })
    ampoule(k, 0.0058, 0.048, { at: [0.0065, 0, 0.003], ring: RED, fill: [0.97, 0.97, 0.9] })
  },
  morphine: (k) => {
    for (const [x, z] of [[-0.0118, 0], [0, 0.002], [0.0118, 0]] as const) ampoule(k, 0.0056, 0.047, { at: [x, 0, z], ring: BLUE, fill: [0.97, 0.97, 0.97] })
  },
  lidocaine: (k) => vial(k, 0.011, 0.048, { flip: [0.2, 0.6, 0.35], fill: [0.96, 0.97, 0.98], level: 0.65, label: [0.9, 0.95, 0.92] }),
  'antibiotic-ointment': (k) => squeezeTube(k, 0.115, 0.0115, { tint: WHITE, capTint: GREEN, band: GREEN }),
  'burn-ointment': (k) => squeezeTube(k, 0.115, 0.0115, { tint: [0.97, 0.96, 0.92], capTint: ORANGE, band: [0.95, 0.42, 0.15], flip: true }),
  thermometer: (k) => {

    const keys: Station[] = [{ y: 0, rx: 0.0028, rz: 0.0098, p: 3 }, { y: 0.004, rx: 0.003, rz: 0.0105, p: 3 }, { y: 0.05, rx: 0.003, rz: 0.0095, p: 3 }, { y: 0.085, rx: 0.0024, rz: 0.0045, p: 2.4 }, { y: 0.115, rx: 0.0022, rz: 0.0026, p: 2 }]
    k.frame({ at: [-0.062, 0.003, 0], roll: -Math.PI / 2 }, () => {
      k.put(loftRaw(easeStations(keys, 3), { seg: 24 }), 'paint', { tint: WHITE })
      k.lathe('steel', fillet2([[0, 0.112], [0.0022, 0.112], [0.0022, 0.123], [0, 0.126]], 0.0008, 2), [0, 0, 0], { seg: 12, tint: STEEL })
    })
    k.box('glass', [0.026, 0.0012, 0.009], [-0.03, 0.0066, 0], { r: 0.0004, tint: [0.55, 0.6, 0.52] })
    k.cyl('rubber', 0.0032, 0.0016, [-0.052, 0.0068, 0], { seg: 12, tint: [0.25, 0.45, 0.8] })
  },
  stethoscope: (k) => {
    const chest: V3 = [-0.06, 0, 0.04]
    k.lathe('steel', fillet2([[0, 0], [0.022, 0], [0.022, 0.006], [0.012, 0.012], [0.005, 0.014], [0, 0.014]], 0.002, 2), chest, { seg: 32, tint: STEEL })
    const tube: V3[] = [[-0.06 + 0.004, 0.012, 0.04], [-0.04, 0.0055, 0.03], [0, 0.0055, 0.045], [0.05, 0.0055, 0.03], [0.07, 0.0055, -0.01], [0.04, 0.0055, -0.04], [0.0, 0.0055, -0.045]]
    k.put(sweepRaw(tube, 0.0052, { seg: 10 }), 'rubber', { tint: [0.15, 0.2, 0.35] })
    for (const s of [-1, 1]) {
      const arm: V3[] = [[0, 0.0055, -0.045], [-0.02, 0.0055, -0.05 + s * 0.01], [-0.045, 0.0045, -0.05 + s * 0.035], [-0.07, 0.0045, -0.045 + s * 0.045]]
      k.put(sweepRaw(arm, 0.0022, { seg: 8 }), 'steel', { tint: STEEL })
      k.sphere('rubber', 0.0058, [-0.072, 0.0058, -0.045 + s * 0.047], { rows: 6, seg: 12, tint: INK })
    }
  },
  'exam-gloves': (k) => {
    carton(k, 0.12, 0.066, 0.235, { tint: WHITE, prints: [{ face: 'front', w: 0.1, h: 0.04, tint: BLUE }, { face: 'right', w: 0.2, h: 0.04, tint: BLUE }, { face: 'top', w: 0.07, h: 0.12, tint: [0.12, 0.12, 0.14] }] })

    const tuft = sphereMesh(0.03, 5, 12).displace((x, y, z) => (noise3(x * 70, y * 70, z * 70, 5) - 0.5) * 0.014)
    k.put(tuft.smooth(50), 'rubber', { at: [0, 0.066 + 0.0045, 0.005], scale: [1, 0.35, 1.5], tint: [0.45, 0.65, 0.92] })
  },
  'surgical-masks': (k) => {
    carton(k, 0.176, 0.05, 0.096, { tint: WHITE, prints: [{ face: 'front', w: 0.15, h: 0.03, tint: [0.35, 0.6, 0.85] }, { face: 'top', w: 0.12, h: 0.05, tint: [0.35, 0.6, 0.85] }] })

    const top = 0.0531, pleat = (x: number, z: number) => top + 0.002 + Math.abs(((z / 0.011) % 2 + 2) % 2 - 1) * 0.0024 + (1 - (x / 0.088) ** 2) * 0.003
    k.sheet('paper', 0.17, 0.088, pleat, [0, 0, 0], { nx: 18, nz: 48, thickness: 0.0008, tint: [0.62, 0.82, 0.93] })
    for (const s of [-1, 1]) k.put(sweepRaw(ringPath(0.022, 0.028, top + 0.0026, 20).map(([x, y, z]) => [s * (0.085 + 0.018) + x * 0.9, y, z] as V3), 0.0009, { closed: true, seg: 4 }), 'fabric', { tint: WHITE })
    k.box('steel', [0.08, 0.0008, 0.003], [0, top + 0.0062, -0.04], { r: 0.0003, tint: WHITE })
  },
  'n95-mask': (k) => {

    const shell: Station[] = [{ y: 0, rx: 0.058, rz: 0.054, p: 2.2 }, { y: 0.004, rx: 0.058, rz: 0.054, p: 2.2 }, { y: 0.02, rx: 0.05, rz: 0.046, p: 2.2 }, { y: 0.032, rx: 0.033, rz: 0.03, p: 2 }, { y: 0.038, rx: 0.012, rz: 0.011, p: 2 }]
    k.put(loftRaw(easeStations(shell, 3), { seg: 40, wear: (x, y, z) => (noise3(x * 60, y * 60, z * 60, 3) - 0.5) * 0.0008 }), 'paper', { tint: [0.95, 0.95, 0.93] })
    k.put(sweepRaw(ringPath(0.0588, 0.0548, 0.0022, 48), 0.0022, { closed: true, seg: 6 }), 'paper', { tint: [0.9, 0.9, 0.88] })
    for (const [y, sc] of [[0.012, 1.0], [0.024, 0.83]] as const) k.put(sweepRaw(ringPath(0.055 * sc, 0.051 * sc, y, 40, (a) => 1 + 0.015 * Math.sin(a * 2)), 0.0018, { closed: true, seg: 5, flat: 0.5 }), 'fabric', { tint: [0.95, 0.85, 0.25] })
    k.box('steel', [0.034, 0.0008, 0.005], [0, 0.03, -0.033], { r: 0.0003, pitch: -0.45, tint: STEEL })
  },
  splint: (k) => {

    const fy = (x: number, z: number) => 0.004 + 0.004 * (z / 0.05) ** 2 + Math.max(0, Math.abs(x) - 0.15) ** 2 * 8
    k.put(sheetRaw(0.38, 0.098, 40, 14, fy, 0.004), 'rubber', { tint: [0.95, 0.5, 0.12] })
    k.put(shade(sheetRaw(0.37, 0.09, 40, 14, (x, z) => fy(x, z) + 0.0016, 0.0008), 1), 'rubber', { tint: [0.2, 0.42, 0.8] })
  },
  crutches: (k) => {

    const crutch = (z: number, flip: number) => k.frame({ at: [0, 0, z], yaw: flip ? Math.PI : 0 }, () => {
      const r = 0.0105, y = 0.0115, rails: V3[][] = [-1, 1].map((s) => [[-0.56, y, s * 0.04], [-0.45, y, s * 0.045], [-0.1, y, s * 0.035], [0.08, y, s * 0.012], [0.12, y, 0]])
      for (const rail of rails) k.tube('steel', rail, r, { seg: 10, fillet: 0.02, tint: [0.8, 0.82, 0.85] })
      k.tube('steel', [[0.11, y, 0], [0.56, y, 0]], 0.0115, { seg: 10, tint: [0.8, 0.82, 0.85] })
      k.box('rubber', [0.05, 0.03, 0.1], [-0.585, 0.015, 0], { r: 0.012, tint: [0.15, 0.15, 0.16] })
      k.cyl('rubber', 0.0135, 0.11, [-0.25, y, 0], { axis: 'z', seg: 14, tint: [0.15, 0.15, 0.16] })
      k.lathe('rubber', fillet2([[0, 0], [0.018, 0], [0.018, 0.012], [0.0125, 0.04], [0, 0.04]], 0.003, 2), [0.555, y, 0], { axis: 'x', seg: 16, tint: [0.12, 0.12, 0.13] })
    })
    crutch(-0.05, 0)
    crutch(0.05, 1)
  },
  'water-tablets': (k) => blister(k, 0.046, 0.076, { card: [0.82, 0.83, 0.86], bubble: { w: 0.034, d: 0.06, h: 0.006, p: 6 }, prints: [{ x: 0, z: 0.0335, w: 0.04, d: 0.006, tint: BLUE }] }, () => {
    k.put(merge(...[-1, 1].flatMap((s) => [-0.02, -0.007, 0.007, 0.02].map((z) => place(latheRaw([[0, 0], [0.0055, 0], [0.0058, 0.0015], [0.0055, 0.003], [0, 0.003]], { seg: 16 }), { at: [s * 0.0085, 0.0011, z] })))), 'plaster', { tint: WHITE })
  }),
  'eye-drops': (k) => bottle(k, 0.0115, 0.044, { m: 'paint', tint: WHITE, neck: 0.0058, shoulder: 0.62, neckH: 0.009, cap: { kind: 'dropper', tint: [0.2, 0.5, 0.85], h: 0.024 }, labels: [{ y0: 0.12, y1: 0.58, tint: [0.75, 0.9, 0.97] }] }),
  'lens-solution': (k) => flask(k, [{ y: 0, rx: 0.026, rz: 0.017, p: 2.8 }, { y: 0.005, rx: 0.028, rz: 0.019, p: 2.8 }, { y: 0.11, rx: 0.028, rz: 0.019, p: 2.8 }, { y: 0.128, rx: 0.016, rz: 0.012, p: 2.2 }, { y: 0.132, rx: 0.012, rz: 0.012, p: 2 }], {
    tint: [0.96, 0.97, 0.98], labels: [front(0.02, 0.1, [0.2, 0.55, 0.85], 1.1), front(0.04, 0.07, WHITE, 0.6)],
    neck: { r: 0.0085, h: 0.01, cap: 'flip', tint: [0.2, 0.55, 0.85] },
  }),
  condoms: (k) => {
    carton(k, 0.058, 0.012, 0.058, { tint: [0.15, 0.15, 0.18], prints: [{ face: 'top', w: 0.05, h: 0.03, tint: [0.85, 0.15, 0.25] }] })

    for (const [y, yaw, tint] of [[0.0141, 0.3, [0.85, 0.15, 0.25]], [0.0173, -0.15, [0.75, 0.75, 0.8]]] as const) {
      sachet(k, 0.045, 0.0026, 0.045, { m: 'paint', at: [0.004, y + 0.0012, 0.002], yaw, tint: tint as V3, sealX: 0.12, sealZ: 0.12, teeth: true, px: 0.2, pz: 0.2, wrinkle: 0.1 })
      k.torus('paint', 0.012, 0.0012, [0.004, y + 0.0038, 0.002], { seg: 6, segR: 24, tint: tint as V3 })
    }
  },
  scalpel: (k) => {

    const handle: Station[] = [{ y: 0, rx: 0.0034, rz: 0.0058, p: 3 }, { y: 0.004, rx: 0.0036, rz: 0.0062, p: 3 }, { y: 0.075, rx: 0.0034, rz: 0.0055, p: 3 }, { y: 0.095, rx: 0.0026, rz: 0.004, p: 3 }, { y: 0.1, rx: 0.002, rz: 0.003, p: 3 }]
    k.put(loftRaw(easeStations(handle, 2), { seg: 20, wear: (x, y) => (y > 0.06 && y < 0.09 ? Math.max(0, Math.cos(y * 2400)) * 0.0004 : 0) }), 'paint', { at: [-0.075, 0.0036, 0], roll: -Math.PI / 2, tint: [0.2, 0.42, 0.8] })
    const outline: V2[] = [[0, -0.0035], [0.012, -0.0036], [0.026, -0.0028], [0.036, 0], [0.04, 0.0035], [0.038, 0.006], [0.03, 0.0055], [0.015, 0.0042], [0, 0.0035]]
    k.put(bladeRaw(outline, 0.0004, (x, y) => 0.2 + (y + 0.0036) / 0.01 * (1 - x / 0.06)), 'steel', { at: [0.022, 0.0014, 0], pitch: -Math.PI / 2, tint: STEEL })
  },
}
