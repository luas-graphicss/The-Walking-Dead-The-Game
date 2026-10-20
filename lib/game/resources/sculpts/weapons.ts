import { noise3, rboxRaw, type Kit, type Mat, type V2, type V3 } from '../../blockout/sculpt/kit'
import { aerosol, gripRaw } from './archetypes'
import { bladeRaw, circle, fillet2, knurl, merge, place, sweepRaw, type ResourceFamily } from './forms'

export const BLUED: V3 = [0.3, 0.31, 0.34], WALNUT: V3 = [0.62, 0.4, 0.24], BEECH: V3 = [0.86, 0.66, 0.44], BLACK: V3 = [0.16, 0.16, 0.17]
const STEEL: V3 = [0.84, 0.85, 0.88], RED: V3 = [0.8, 0.15, 0.1], OLIVE: V3 = [0.36, 0.4, 0.26]

export function onSide(k: Kit, half: number, fn: () => void, shift: [number, number] = [0, 0]) { k.frame({ at: [shift[0], half, -shift[1]], pitch: -Math.PI / 2 }, fn) }

export function slab(k: Kit, m: Mat, outline: V2[], width: number, o: { tint?: V3; round?: number; z?: number; wear?: (x: number, y: number, z: number) => number } = {}) {
  k.extrude(m, fillet2(outline, o.round ?? 0.004, 3, true), width, [0, 0, o.z ?? 0], { bevel: Math.min(width * 0.32, 0.012), bevelSeg: 3, tint: o.tint, wear: o.wear })
}

export function bore(k: Kit, m: Mat, profile: V2[], x0: number, y: number, o: { tint?: V3; seg?: number; z?: number; wear?: (x: number, y: number, z: number) => number } = {}) {
  k.lathe(m, profile, [x0, y, o.z ?? 0], { axis: 'x', seg: o.seg ?? 20, tint: o.tint, wear: o.wear })
}

export const barrel = (len: number, r0: number, r1: number, rb: number): V2[] => [[rb, 0], [r0, 0], [r0, len * 0.06], [r1, len - 0.004], [r1 - 0.0008, len], [rb, len], [rb, 0]]

export function triggerGroup(k: Kit, x: number, y: number, len: number, tint: V3) {
  k.put(sweepRaw([[x - len / 2, y, 0], [x - len / 2 + 0.004, y - 0.03, 0], [x + len / 2 - 0.01, y - 0.03, 0], [x + len / 2, y - 0.012, 0], [x + len / 2, y, 0]], 0.0025, { seg: 8, flat: 2.2 }), 'steel', { tint })
  k.extrude('steel', fillet2([[x - 0.004, y], [x + 0.003, y], [x + 0.002, y - 0.012], [x - 0.004, y - 0.02], [x - 0.006, y - 0.018], [x - 0.002, y - 0.01]], 0.0012, 2, true), 0.006, [0, 0, 0], { bevel: 0.0012, tint })
}

function knife(k: Kit, blade: V2[], spineY: number, edgeY: number, t: number, handleLen: number, handleTint: V3, o: { bladeTint?: V3; guard?: boolean; rivets?: number } = {}) {
  const hw = 0.0095, tip = Math.max(...blade.map(([x]) => x))
  onSide(k, hw, () => {
    k.put(bladeRaw(blade, t, (_x, y) => (y - edgeY) / (spineY - edgeY)), 'steel', { tint: o.bladeTint ?? STEEL })
    if (o.guard) k.box('steel', [0.006, 0.05, 0.016], [-0.003, (spineY + edgeY) / 2, 0], { r: 0.0015, tint: BLUED })
    else k.box('steel', [0.012, spineY - edgeY + 0.004, 0.014], [-0.006, (spineY + edgeY) / 2, 0], { r: 0.002, tint: STEEL })
    slab(k, 'wood', [[-0.012, spineY - 0.002], [-handleLen + 0.01, spineY - 0.004], [-handleLen, spineY - 0.01], [-handleLen, edgeY + 0.006], [-handleLen + 0.012, edgeY + 0.002], [-0.02, edgeY + 0.004], [-0.012, edgeY + 0.002]], hw * 2, { tint: handleTint, round: 0.006 })
    for (let i = 0; i < (o.rivets ?? 3); i++) k.cyl('steel', 0.0028, 0.0014, [-0.03 - i * (handleLen - 0.05) / Math.max(1, (o.rivets ?? 3) - 1), (spineY + edgeY) / 2, hw + 0.0003], { axis: 'z', seg: 12, tint: STEEL })
  }, [(handleLen - tip) / 2, 0])
}

export function ringMount(cy: number, R: number, hw: number, yb: number): V2[] {
  const yi = cy - Math.sqrt(R * R - hw * hw), a0 = Math.atan2(yi - cy, hw), a1 = Math.PI - a0, out: V2[] = [[-hw, yb], [hw, yb]]
  for (let i = 0; i <= 20; i++) { const a = a0 + (a1 - a0) * i / 20; out.push([Math.cos(a) * R, cy + Math.sin(a) * R]) }
  return out
}

export const WEAPONS: ResourceFamily = {
  'kitchen-knife': (k) => knife(k, [[0, -0.022], [0.15, -0.021], [0.185, -0.01], [0.198, 0.004], [0.12, 0.012], [0, 0.014]], 0.014, -0.022, 0.0022, 0.115, BLACK),
  'combat-knife': (k) => {
    const blade: V2[] = [[0, -0.015], [0.12, -0.014], [0.165, -0.003], [0.175, 0.006], [0.14, 0.006], [0.12, 0.014], [0, 0.015]]
    onSide(k, 0.016, () => {
      k.put(bladeRaw(blade, 0.005, (_x, y) => (y + 0.015) / 0.03), 'steel', { tint: BLACK })
      k.box('steel', [0.006, 0.055, 0.018], [-0.003, 0, 0], { r: 0.002, tint: BLUED })

      bore(k, 'leather', Array.from({ length: 23 }, (_, i): V2 => [i % 2 ? 0.0145 : 0.0158, i * 0.0052]).concat([[0, 0.114]]).reduce<V2[]>((a, p, i) => (i === 0 ? [[0, 0], p] : [...a, p]), []), -0.12, 0, { tint: [0.55, 0.36, 0.22], seg: 18 })
      bore(k, 'steel', fillet2([[0, 0], [0.016, 0], [0.017, 0.008], [0.012, 0.016], [0, 0.017]], 0.003, 2), -0.137, 0, { tint: BLUED })
    })
  },
  machete: (k) => knife(k, [[0, -0.022], [0.3, -0.026], [0.42, -0.02], [0.455, -0.004], [0.44, 0.01], [0.3, 0.014], [0, 0.016]], 0.016, -0.026, 0.0025, 0.125, [0.18, 0.18, 0.2], { rivets: 3 }),
  axe: (k) => onSide(k, 0.0175, () => {
    const head: V2[] = [[0.285, 0.035], [0.335, 0.035], [0.338, -0.02], [0.36, -0.06], [0.368, -0.096], [0.33, -0.103], [0.292, -0.099], [0.28, -0.06], [0.284, -0.02]]
    k.put(bladeRaw(fillet2(head, 0.003, 2, true), 0.035, (_x, y) => (y + 0.1) / 0.08), 'steel', { tint: [0.45, 0.46, 0.5] })
    k.put(gripRaw(0.66, 0.0135, { knob: 0.32, swell: 0.12, neck: 0.9, ratio: 0.82 }), 'wood', { at: [-0.33, 0, 0], roll: -Math.PI / 2, tint: BEECH })
  }),
  crowbar: (k) => {

    const path: V3[] = [[-0.36, 0, 0], [0.22, 0, 0]]
    for (let i = 1; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI * 0.85; path.push([0.22 + Math.cos(a) * 0.055, 0, 0.055 + Math.sin(a) * 0.055]) }
    k.put(sweepRaw(path, 0.011, { seg: 6, radius: (_s, _a, t) => (t > 0.94 ? 1 - (t - 0.94) * 9 : 1) }), 'steel', { at: [0, 0.0095, -0.03], tint: RED })
    k.put(bladeRaw([[0, -0.009], [0.035, -0.012], [0.04, 0], [0.035, 0.012], [0, 0.009]], 0.012, (x) => 1 - x / 0.045), 'steel', { at: [-0.4, 0.0095, -0.03], pitch: -Math.PI / 2, tint: [0.55, 0.56, 0.6] })
  },
  'baseball-bat': (k) => {
    const prof: V2[] = [[0, 0], [0.02, 0], [0.023, 0.008], [0.013, 0.02], [0.0125, 0.3], [0.02, 0.48], [0.031, 0.68], [0.0335, 0.78], [0.031, 0.83], [0.02, 0.845], [0, 0.848]]
    k.lathe('wood', fillet2(prof, 0.004, 3), [-0.42, 0.0335, 0], { axis: 'x', seg: 28, tint: [0.88, 0.7, 0.48], wear: (x, y, z) => (noise3(x * 30, y * 30, z * 30, 3) - 0.5) * 0.0006 })
    k.lathe('rubber', [[0.0137, 0.03], [0.0137, 0.22]], [-0.42, 0.0335, 0], { axis: 'x', seg: 20, tint: BLACK })
  },
  sledgehammer: (k) => {
    k.box('steel', [0.062, 0.058, 0.14], [0.35, 0.029, 0], { r: 0.008, tint: [0.32, 0.33, 0.36] })
    k.put(gripRaw(0.74, 0.016, { knob: 0.2, swell: 0.1, neck: 1.05, ratio: 0.8 }), 'wood', { at: [-0.4, 0.029, 0], roll: -Math.PI / 2, tint: BEECH })
  },
  baton: (k) => {
    k.lathe('rubber', fillet2([[0, 0], [0.017, 0], [0.018, 0.012], [0.015, 0.02], [0.015, 0.56], [0.016, 0.58], [0, 0.585]], 0.003, 3), [-0.29, 0.018, 0], { axis: 'x', seg: 24, tint: BLACK, wear: (x, y, z) => (x > -0.27 && x < -0.12 ? knurl(14, 0.0006, 0.012)(y, 0, z) : 0) })
    k.put(sweepRaw([[-0.29, 0.018, 0], [-0.31, 0.012, 0.03], [-0.34, 0.006, 0.05], [-0.36, 0.004, 0.02], [-0.33, 0.006, -0.005], [-0.3, 0.012, -0.004]], 0.003, { seg: 6, flat: 0.4 }), 'leather', { tint: [0.3, 0.2, 0.14] })
  },
  slingshot: (k) => {

    const y = 0.0085, bark = (s: number, a: number) => 1 + (noise3(s * 60, a, 0, 4) - 0.5) * 0.12
    const fork = merge(sweepRaw([[-0.085, y, 0], [-0.02, y, 0], [0.0, y, 0.002]], 0.0085, { seg: 10, radius: bark }), ...[-1, 1].map((s) => sweepRaw([[-0.004, y, 0], [0.03, y, s * 0.02], [0.06, y, s * 0.032], [0.072, y, s * 0.034]], 0.0072, { seg: 10, radius: bark })))
    k.put(fork, 'wood', { tint: [0.72, 0.52, 0.32] })
    for (const s of [-1, 1]) k.put(sweepRaw([[0.072, y, s * 0.034], [0.095, y, s * 0.022], [0.112, y, s * 0.012]], 0.0035, { seg: 6, flat: 0.35 }), 'rubber', { tint: [0.85, 0.55, 0.2] })
    k.box('leather', [0.012, 0.004, 0.03], [0.117, 0.004, 0], { r: 0.0015, tint: [0.45, 0.3, 0.2] })
  },
  'recurve-bow': (k) => {

    const y = 0.015
    k.extrude('wood', fillet2([[-0.16, 0], [-0.05, 0.005], [-0.03, 0.03], [0, 0.034], [0.03, 0.014], [0.16, 0], [0.15, -0.012], [0, -0.017], [-0.15, -0.012]], 0.005, 3, true), 0.03, [0, y, 0], { axis: 'y', bevel: 0.006, bevelSeg: 3, tint: WALNUT })
    for (const s of [-1, 1]) k.put(sweepRaw([[s * 0.14, y, 0.002], [s * 0.3, y, 0.018], [s * 0.48, y, 0.032], [s * 0.62, y, 0.028], [s * 0.675, y, 0.012], [s * 0.695, y, -0.004]], 0.0128, { seg: 10, flat: 0.32, radius: (_s, _a, t) => 1 - 0.45 * t }), 'wood', { tint: [0.25, 0.22, 0.2] })
    k.put(sweepRaw([[-0.675, y, 0.014], [0, y, 0.026], [0.675, y, 0.014]], 0.0012, { seg: 5 }), 'fabric', { tint: [0.9, 0.88, 0.8] })
  },
  crossbow: (k) => {

    k.extrude('wood', fillet2([[-0.4, 0.012], [-0.4, 0.075], [-0.22, 0.068], [-0.13, 0.055], [0.33, 0.055], [0.36, 0.048], [0.36, 0.032], [0.1, 0.03], [-0.06, 0.032], [-0.08, 0.0], [-0.12, 0.0], [-0.13, 0.03], [-0.2, 0.03]], 0.008, 3, true), 0.042, [0, 0, 0], { bevel: 0.01, bevelSeg: 3, tint: WALNUT })
    k.box('steel', [0.46, 0.004, 0.012], [0.11, 0.057, 0], { r: 0.001, tint: BLACK })
    k.box('paint', [0.07, 0.045, 0.05], [0.33, 0.05, 0], { r: 0.006, tint: BLACK })
    const limbs = [-1, 1].map((s) => sweepRaw([[0.34, 0.05, s * 0.02], [0.33, 0.05, s * 0.09], [0.3, 0.05, s * 0.17], [0.26, 0.05, s * 0.225], [0.255, 0.05, s * 0.245]], 0.013, { seg: 10, flat: 0.45, radius: (_s, _a, t) => 1 - 0.4 * t }))
    k.put(merge(...limbs), 'paint', { tint: BLACK })
    k.put(sweepRaw([[0.255, 0.05, -0.243], [-0.04, 0.058, 0], [0.255, 0.05, 0.243]], 0.0016, { seg: 5 }), 'fabric', { tint: [0.85, 0.82, 0.7] })
    k.put(sweepRaw([[0.36, 0.04, -0.03], [0.4, 0.035, -0.04], [0.43, 0.03, 0], [0.4, 0.035, 0.04], [0.36, 0.04, 0.03]], 0.004, { seg: 8 }), 'steel', { tint: BLACK })
    k.box('steel', [0.05, 0.024, 0.03], [-0.06, 0.051, 0], { r: 0.003, tint: BLACK })
  },
  'shotgun-12': (k) => onSide(k, 0.022, () => {
    slab(k, 'wood', [[-0.54, 0.038], [-0.36, 0.034], [-0.24, 0.03], [-0.2, 0.026], [-0.185, 0.0], [-0.205, -0.035], [-0.23, -0.04], [-0.3, -0.035], [-0.54, -0.075]], 0.036, { tint: WALNUT, round: 0.006 })
    k.box('rubber', [0.016, 0.118, 0.038], [-0.547, -0.018, 0], { r: 0.004, tint: BLACK })
    k.box('steel', [0.2, 0.055, 0.03], [-0.09, 0.02, 0], { r: 0.006, tint: BLUED })
    bore(k, 'steel', barrel(0.53, 0.0115, 0.0102, 0.0088), 0.008, 0.033, { tint: BLUED, seg: 22 })
    bore(k, 'steel', fillet2([[0, 0], [0.0095, 0], [0.0095, 0.4], [0.0085, 0.412], [0, 0.414]], 0.002, 2), 0.008, 0.0125, { tint: BLUED })
    slab(k, 'wood', [[0.06, 0.03], [0.28, 0.03], [0.285, 0.0], [0.28, -0.004], [0.06, -0.004]], 0.044, { tint: WALNUT, wear: (x, y) => (Math.cos(x * 280) > 0.6 && y < 0.02 ? -0.0012 : 0) })
    k.sphere('steel', 0.0022, [0.535, 0.046, 0], { rows: 4, seg: 8, tint: STEEL })
    triggerGroup(k, -0.13, -0.007, 0.08, BLUED)
  }),
  'hunting-rifle': (k) => onSide(k, 0.023, () => {
    slab(k, 'wood', [[-0.55, 0.036], [-0.38, 0.032], [-0.25, 0.028], [-0.21, 0.022], [0.15, 0.022], [0.17, 0.012], [0.16, 0.0], [-0.08, -0.012], [-0.15, -0.016], [-0.18, -0.02], [-0.205, -0.048], [-0.235, -0.05], [-0.25, -0.035], [-0.3, -0.032], [-0.55, -0.07]], 0.038, { tint: WALNUT, round: 0.006 })
    k.box('rubber', [0.016, 0.112, 0.04], [-0.557, -0.017, 0], { r: 0.004, tint: BLACK })
    bore(k, 'steel', fillet2([[0, 0], [0.0135, 0], [0.0135, 0.19], [0.011, 0.2], [0, 0.2]], 0.002, 2), -0.2, 0.033, { tint: BLUED })
    bore(k, 'steel', barrel(0.55, 0.0108, 0.0082, 0.0042), 0.0, 0.033, { tint: BLUED })

    k.put(sweepRaw([[-0.07, 0.036, 0.008], [-0.068, 0.03, 0.024], [-0.075, 0.018, 0.034]], 0.0035, { seg: 8 }), 'steel', { tint: BLUED })
    k.sphere('steel', 0.0075, [-0.076, 0.016, 0.036], { rows: 6, seg: 12, tint: BLUED })

    bore(k, 'steel', fillet2([[0, 0], [0.019, 0], [0.019, 0.04], [0.0128, 0.06], [0.0128, 0.2], [0.021, 0.23], [0.022, 0.29], [0, 0.29]], 0.003, 2), -0.23, 0.076, { tint: BLACK, seg: 24 })
    for (const x of [-0.155, -0.045]) k.extrude('steel', ringMount(0.076, 0.0168, 0.009, 0.044), 0.014, [x, 0, 0], { axis: 'x', bevel: 0.001, holes: [circle(0.0137, 28, 0, 0.076)], tint: BLACK })
    k.cyl('steel', 0.009, 0.014, [-0.1, 0.076 + 0.0128 + 0.006, 0], { seg: 14, tint: BLACK })
    k.cyl('steel', 0.009, 0.014, [-0.1, 0.076, 0.0128 + 0.006], { axis: 'z', seg: 14, tint: BLACK })
    triggerGroup(k, -0.15, -0.017, 0.07, BLUED)
    for (const x of [-0.45, 0.1]) k.torus('steel', 0.008, 0.0016, [x, x < 0 ? -0.055 : -0.006, 0], { axis: 'z', seg: 6, segR: 14, tint: STEEL })
  }),
  'rifle-22': (k) => onSide(k, 0.019, () => {
    slab(k, 'wood', [[-0.5, 0.03], [-0.34, 0.028], [-0.22, 0.024], [-0.19, 0.018], [0.12, 0.018], [0.14, 0.01], [0.13, 0.0], [-0.06, -0.008], [-0.14, -0.012], [-0.17, -0.016], [-0.19, -0.042], [-0.215, -0.044], [-0.23, -0.03], [-0.28, -0.028], [-0.5, -0.06]], 0.032, { tint: BEECH, round: 0.005 })
    k.box('rubber', [0.012, 0.09, 0.034], [-0.506, -0.015, 0], { r: 0.003, tint: BLACK })
    bore(k, 'steel', fillet2([[0, 0], [0.011, 0], [0.011, 0.17], [0.009, 0.18], [0, 0.18]], 0.002, 2), -0.18, 0.028, { tint: BLUED })
    bore(k, 'steel', barrel(0.48, 0.0085, 0.0075, 0.0028), 0.0, 0.028, { tint: BLUED })
    k.extrude('steel', [[-0.1, -0.008], [-0.06, -0.008], [-0.062, -0.06], [-0.098, -0.06]], 0.016, [0, 0, 0], { bevel: 0.002, tint: BLACK })
    k.box('steel', [0.006, 0.01, 0.004], [0.46, 0.04, 0], { r: 0.001, tint: BLUED })
    k.box('steel', [0.012, 0.008, 0.012], [0.08, 0.04, 0], { r: 0.001, tint: BLUED })
    k.put(sweepRaw([[-0.07, 0.03, 0.008], [-0.07, 0.03, 0.026]], 0.003, { seg: 8 }), 'steel', { tint: BLUED })
    k.sphere('steel', 0.0055, [-0.07, 0.03, 0.03], { rows: 5, seg: 10, tint: BLUED })
    triggerGroup(k, -0.13, -0.013, 0.065, BLUED)
  }),
  'assault-rifle': (k) => onSide(k, 0.022, () => {

    const tint: V3 = [0.2, 0.2, 0.21]
    k.box('steel', [0.2, 0.034, 0.026], [-0.02, 0.035, 0], { r: 0.003, tint })
    k.put(merge(...Array.from({ length: 19 }, (_, i) => place(rboxRaw(0.0055, 0.004, 0.021, { r: 0.0006 }), { at: [-0.11 + i * 0.01, 0.054, 0] }))), 'steel', { tint })
    k.extrude('steel', fillet2([[-0.12, 0.018], [0.07, 0.018], [0.07, -0.005], [0.058, -0.03], [0.02, -0.03], [0.012, -0.012], [-0.1, -0.012], [-0.12, 0.0]], 0.003, 2, true), 0.024, [0, 0, 0], { bevel: 0.003, tint })
    slab(k, 'paint', [[-0.075, -0.008], [-0.045, -0.008], [-0.06, -0.1], [-0.088, -0.1], [-0.082, -0.06]], 0.028, { tint: BLACK, round: 0.006 })
    const mag: V2[] = []
    for (let i = 0; i <= 8; i++) { const t = i / 8; mag.push([0.058 + 0.03 * t * t, -0.012 - 0.175 * t]) }
    for (let i = 8; i >= 0; i--) { const t = i / 8; mag.push([0.022 + 0.034 * t * t, -0.012 - 0.18 * t]) }
    slab(k, 'steel', mag, 0.022, { tint: [0.28, 0.28, 0.3], round: 0.003 })
    bore(k, 'steel', fillet2([[0, 0], [0.015, 0], [0.015, 0.2], [0, 0.2]], 0.002, 2), -0.32, 0.032, { tint })
    slab(k, 'paint', [[-0.34, 0.05], [-0.22, 0.045], [-0.2, 0.025], [-0.22, 0.012], [-0.34, -0.06]], 0.03, { tint: BLACK, round: 0.008 })
    bore(k, 'steel', fillet2([[0, 0], [0.021, 0], [0.021, 0.23], [0, 0.23]], 0.003, 2), 0.08, 0.035, { tint: BLACK, seg: 24, wear: (x, y, z) => (Math.cos(x * 200) > 0.7 && Math.abs(Math.atan2(z, y)) < 1.2 ? -0.0015 : 0) })
    bore(k, 'steel', barrel(0.21, 0.0085, 0.0078, 0.0028), 0.31, 0.035, { tint: BLACK })
    bore(k, 'steel', fillet2([[0, 0], [0.011, 0], [0.011, 0.04], [0, 0.04]], 0.0015, 2), 0.5, 0.035, { tint: BLACK, wear: knurl(6, 0.002, 0.009) })
    k.box('steel', [0.014, 0.048, 0.014], [0.36, 0.06, 0], { r: 0.002, tint })
    k.box('steel', [0.03, 0.018, 0.02], [-0.095, 0.065, 0], { r: 0.002, tint })
    triggerGroup(k, -0.035, -0.012, 0.06, tint)
  }, [0, 0.05]),
  'flare-gun': (k) => onSide(k, 0.021, () => {
    const orange: V3 = [0.95, 0.42, 0.1]
    bore(k, 'paint', [[0.0135, 0], [0.02, 0], [0.02, 0.13], [0.0185, 0.134], [0.0135, 0.134], [0.0135, 0]], -0.02, 0.04, { tint: orange, seg: 24 })
    slab(k, 'paint', [[-0.085, 0.062], [-0.018, 0.062], [-0.018, 0.02], [-0.03, 0.012], [-0.045, -0.07], [-0.078, -0.076], [-0.09, -0.06], [-0.082, 0.0], [-0.095, 0.05]], 0.03, { tint: orange, round: 0.006 })
    k.cyl('paint', 0.006, 0.034, [-0.012, 0.022, 0], { axis: 'z', seg: 14, tint: orange })
    k.extrude('paint', [[-0.09, 0.05], [-0.1, 0.07], [-0.094, 0.074], [-0.082, 0.06]], 0.008, [0, 0, 0], { bevel: 0.001, tint: BLACK })
    triggerGroup(k, -0.025, 0.012, 0.05, orange)
  }),
  taser: (k) => onSide(k, 0.02, () => {
    slab(k, 'paint', [[-0.08, 0.05], [0.06, 0.05], [0.06, 0.01], [-0.02, 0.008], [-0.035, -0.065], [-0.07, -0.068], [-0.08, -0.05], [-0.075, 0.0]], 0.032, { tint: [0.95, 0.8, 0.15], round: 0.006 })
    k.box('paint', [0.04, 0.04, 0.036], [0.08, 0.03, 0], { r: 0.004, tint: BLACK })
    k.box('glass', [0.0016, 0.012, 0.012], [0.1008, 0.042, 0], { r: 0.001, tint: [0.3, 0.1, 0.1] })
    triggerGroup(k, -0.005, 0.008, 0.05, BLACK)
  }),
  'pepper-spray': (k) => {
    aerosol(k, 0.0185, 0.112, { cap: 'button', tint: BLACK, capTint: RED, labels: [{ y0: 0.12, y1: 0.75, tint: [0.95, 0.85, 0.2] }, { y0: 0.3, y1: 0.5, tint: RED, arc: 1.6 }] })
    k.torus('steel', 0.012, 0.0012, [0.026, 0.0012, 0], { seg: 6, segR: 20, tint: STEEL })
  },
  'smoke-grenade': (k) => {
    k.lathe('paint', fillet2([[0, 0], [0.029, 0], [0.03, 0.004], [0.03, 0.108], [0.026, 0.112], [0, 0.112]], 0.0015, 2), [0, 0, 0], { seg: 32, tint: OLIVE })
    k.lathe('paper', [[0.0312, 0.03], [0.0312, 0.06]], [0, 0, 0], { seg: 32, tint: [0.95, 0.85, 0.2] })
    k.lathe('steel', fillet2([[0, 0.111], [0.013, 0.111], [0.012, 0.13], [0.0085, 0.136], [0, 0.136]], 0.0015, 2), [0, 0, 0], { seg: 18, tint: [0.42, 0.44, 0.38] })
    k.put(sweepRaw([[0.012, 0.132, 0], [0.025, 0.128, 0], [0.032, 0.112, 0], [0.033, 0.06, 0]], 0.004, { seg: 6, flat: 0.25 }), 'steel', { tint: [0.42, 0.44, 0.38] })
    k.torus('steel', 0.012, 0.0015, [-0.012, 0.13, 0], { axis: 'z', seg: 6, segR: 18, tint: STEEL })
  },
  'frag-grenade': (k) => {
    k.lathe('paint', fillet2([[0, 0], [0.012, 0.001], [0.026, 0.012], [0.03, 0.042], [0.026, 0.07], [0.016, 0.082], [0, 0.084]], 0.004, 3), [0, 0, 0], { seg: 32, tint: OLIVE })
    k.lathe('steel', fillet2([[0, 0.082], [0.011, 0.082], [0.011, 0.098], [0.0085, 0.104], [0, 0.104]], 0.0015, 2), [0, 0, 0], { seg: 18, tint: [0.42, 0.44, 0.38] })
    k.put(sweepRaw([[0.01, 0.1, 0], [0.022, 0.096, 0], [0.028, 0.078, 0], [0.031, 0.045, 0]], 0.0042, { seg: 6, flat: 0.25 }), 'steel', { tint: [0.42, 0.44, 0.38] })
    k.torus('steel', 0.013, 0.0016, [-0.013, 0.097, 0], { axis: 'z', seg: 6, segR: 18, tint: STEEL })
  },
}
