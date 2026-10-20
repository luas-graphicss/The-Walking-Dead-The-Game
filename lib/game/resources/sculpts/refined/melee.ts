import type { V2, V3 } from '../../../blockout/sculpt/kit'
import { gripRaw } from '../archetypes'
import { bladeRaw, circle, fillet2, knurl, loftRaw, place, sweepRaw, type ResourceFamily, type Station } from '../forms'
import { bore, onSide } from '../weapons'

const STEEL: V3 = [0.84, 0.85, 0.88], DARK: V3 = [0.32, 0.32, 0.34], BLACK: V3 = [0.13, 0.13, 0.14], RED: V3 = [0.78, 0.13, 0.1]
const WALNUT: V3 = [0.55, 0.36, 0.22], HICKORY: V3 = [0.8, 0.6, 0.38], ASH: V3 = [0.88, 0.74, 0.54], LEATHER: V3 = [0.55, 0.36, 0.22]
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

function tangHandle(k: Parameters<typeof onSide>[0], outline: V2[], tang: number, scale: number, rivets: number[], tint: V3, hole?: V2[]) {
  const shape = fillet2(outline, 0.005, 3, true)
  k.extrude('steel', shape, tang, [0, 0, 0], { bevel: 0.0003, tint: STEEL, holes: hole ? [hole] : undefined })
  for (const s of [-1, 1]) k.extrude('wood', shape, scale, [0, 0, s * (tang + scale) / 2], { bevel: Math.min(0.0018, scale * 0.38), bevelSeg: 2, tint, holes: hole ? [hole] : undefined })
  const cy = (Math.max(...outline.map((p) => p[1])) + Math.min(...outline.map((p) => p[1]))) / 2
  for (const x of rivets) k.cyl('steel', 0.0028, tang + 2 * scale + 0.0005, [x, cy, 0], { axis: 'z', seg: 14, tint: STEEL })
}

export const MELEE_REFINED: ResourceFamily = {
  'kitchen-knife': (k) => onSide(k, 0.006, () => {

    const blade: V2[] = [[0.0, -0.024], [0.11, -0.022], [0.15, -0.016], [0.172, -0.006], [0.184, 0.004], [0.13, 0.011], [0.06, 0.014], [0.0, 0.015]]
    k.put(bladeRaw(fillet2(blade, 0.0015, 2, true), 0.0022, (_x, y) => clamp01((y + 0.024) / 0.039)), 'steel', { tint: STEEL })
    k.extrude('steel', fillet2([[-0.012, -0.0245], [0.004, -0.0242], [0.004, 0.0155], [-0.012, 0.0142]], 0.002, 2, true), 0.011, [0, 0, 0], { bevel: 0.002, tint: STEEL })
    tangHandle(k, [[-0.011, 0.0138], [-0.05, 0.0125], [-0.09, 0.0135], [-0.115, 0.012], [-0.122, 0.006], [-0.122, -0.012], [-0.112, -0.018], [-0.075, -0.016], [-0.035, -0.019], [-0.011, -0.0232]], 0.0026, 0.0045, [-0.035, -0.065, -0.095], WALNUT)
  }, [-0.031, 0]),

  'combat-knife': (k) => onSide(k, 0.017, () => {

    const blade: V2[] = [[0, -0.016], [0.12, -0.015], [0.155, -0.008], [0.172, 0.004], [0.15, 0.008], [0.125, 0.0135], [0.0, 0.0155]]
    k.put(bladeRaw(fillet2(blade, 0.0012, 2, true), 0.0055, (_x, y) => clamp01((y + 0.016) / 0.016)), 'steel', { tint: DARK })
    k.box('steel', [0.006, 0.055, 0.018], [-0.003, 0, 0], { r: 0.002, tint: DARK })
    const washers: V2[] = [[0, 0]]
    for (let i = 0; i <= 22; i++) { const y = i * 0.0052, swell = 0.0145 + 0.0012 * Math.sin(i / 22 * Math.PI); washers.push([swell + (i % 2 ? 0 : 0.0011), y]) }
    washers.push([0, 0.1144])
    k.lathe('leather', washers, [-0.1204, 0, 0], { axis: 'x', seg: 24, crease: 30, scale: [1, 1, 0.82], tint: LEATHER })
    bore(k, 'steel', fillet2([[0, 0], [0.016, 0], [0.017, 0.008], [0.012, 0.016], [0, 0.017]], 0.003, 2), -0.137, 0, { tint: DARK, seg: 24 })
  }, [-0.017, 0]),

  machete: (k) => onSide(k, 0.0075, () => {

    const blade: V2[] = [[0, -0.022], [0.3, -0.026], [0.4, -0.022], [0.44, -0.012], [0.455, 0.002], [0.44, 0.012], [0.3, 0.016], [0, 0.017]]
    k.put(bladeRaw(fillet2(blade, 0.0015, 2, true), 0.0026, (_x, y) => clamp01((y + 0.026) / 0.043)), 'steel', { tint: [0.6, 0.6, 0.62] })
    tangHandle(k, [[0.004, 0.017], [-0.05, 0.015], [-0.1, 0.0155], [-0.128, 0.013], [-0.135, 0.006], [-0.135, -0.014], [-0.12, -0.02], [-0.1, -0.016], [-0.08, -0.02], [-0.06, -0.016], [-0.04, -0.02], [-0.02, -0.017], [0.004, -0.022]], 0.0026, 0.0047, [-0.02, -0.065, -0.11], [0.82, 0.64, 0.44], circle(0.0035, 16, -0.124, 0))
  }, [-0.16, 0]),

  axe: (k) => onSide(k, 0.018, () => {

    const grind = (_x: number, y: number) => clamp01((y + 0.107) / 0.075)
    const upper: V2[] = [[0.29, 0.036], [0.334, 0.036], [0.338, 0.02], [0.336, -0.01], [0.346, -0.04], [0.355, -0.06], [0.284, -0.06], [0.286, -0.04], [0.288, -0.01], [0.286, 0.02]]
    const bit: V2[] = [[0.284, -0.06], [0.355, -0.06], [0.362, -0.075], [0.37, -0.1], [0.345, -0.106], [0.315, -0.107], [0.288, -0.102], [0.282, -0.075]]
    k.put(bladeRaw(fillet2(upper, 0.003, 2, true), 0.036, grind), 'paint', { tint: RED })
    k.put(bladeRaw(fillet2(bit, 0.002, 2, true), 0.036, grind), 'steel', { tint: STEEL })
    const handle: V3[] = [[-0.335, -0.012, 0], [-0.3, -0.006, 0], [-0.15, 0.0, 0], [0.05, 0.003, 0], [0.2, 0.002, 0], [0.3, 0.0, 0], [0.339, 0.0, 0]]
    k.put(sweepRaw(handle, 0.0145, { seg: 18, flat: 0.7, radius: (_s, _a, t) => 1 + 0.32 * Math.exp(-(((t - 0.02) / 0.04) ** 2)) - 0.15 * clamp01((t - 0.55) / 0.3) + 0.05 * clamp01((t - 0.9) / 0.1) }), 'wood', { tint: HICKORY })
    k.box('steel', [0.0016, 0.016, 0.0024], [0.3392, 0, 0], { r: 0.0004, tint: DARK })
  }, [-0.0175, 0.0355]),

  crowbar: (k) => k.frame({ at: [0.06, 0, -0.017] }, () => {

    const y = 0.0105, path: V3[] = [[-0.34, y, -0.03], [0.21, y, -0.03]]
    for (let i = 1; i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI * 0.88; path.push([0.21 + Math.cos(a) * 0.052, y, 0.022 + Math.sin(a) * 0.052]) }
    k.put(sweepRaw(path, 0.0105, { seg: 6, radius: (_s, _a, t) => (t > 0.9 ? 1 - (t - 0.9) * 4 : 1) }), 'paint', { tint: RED })
    const end = path[path.length - 1], prev = path[path.length - 2], dx = end[0] - prev[0], dz = end[2] - prev[2], l = Math.hypot(dx, dz)
    for (const s of [-1, 1]) k.put(sweepRaw([[end[0] - dx / l * 0.004, y + s * 0.0034, end[2] - dz / l * 0.004], [end[0] + dx / l * 0.026, y + s * 0.0028, end[2] + dz / l * 0.026]], 0.0046, { seg: 8, flat: 0.55, radius: (_s, _a, t) => 1 - 0.6 * t }), 'steel', { tint: STEEL })
    k.put(bladeRaw([[0.004, -0.0095], [-0.035, -0.012], [-0.045, -0.002], [-0.045, 0.002], [-0.035, 0.012], [0.004, 0.0095]], 0.017, (x) => clamp01(1 + x / 0.05)), 'steel', { at: [-0.338, y, -0.03], pitch: -Math.PI / 2, tint: STEEL })
  }),

  'baseball-bat': (k) => {

    const prof = fillet2([[0, 0], [0.019, 0], [0.0225, 0.007], [0.0215, 0.012], [0.013, 0.022], [0.0125, 0.3], [0.0195, 0.48], [0.0305, 0.67], [0.0333, 0.77], [0.0335, 0.835], [0.031, 0.845], [0.022, 0.846], [0.018, 0.84], [0.0, 0.838]], 0.003, 3)
    k.lathe('wood', prof, [-0.42, 0.0335, 0], { axis: 'x', seg: 36, tint: ASH })
    k.lathe('rubber', [[0.0124, 0.028], [0.0137, 0.03], [0.0137, 0.238], [0.0124, 0.24]], [-0.42, 0.0335, 0], { axis: 'x', seg: 32, tint: BLACK, wear: (x, y, z) => -0.00045 * Math.max(0, Math.cos(Math.atan2(z, x) - y * Math.PI * 2 / 0.024)) ** 24 })
  },

  sledgehammer: (k) => k.frame({ at: [0.035, 0, 0] }, () => {

    const head: Station[] = [{ y: -0.07, rx: 0.025, rz: 0.024, p: 3 }, { y: -0.066, rx: 0.029, rz: 0.028, p: 3.5 }, { y: -0.02, rx: 0.03, rz: 0.029, p: 4 }, { y: 0.02, rx: 0.03, rz: 0.029, p: 4 }, { y: 0.066, rx: 0.029, rz: 0.028, p: 3.5 }, { y: 0.07, rx: 0.025, rz: 0.024, p: 3 }]
    k.put(place(loftRaw(head, { seg: 32 }), { at: [0.33, 0.029, 0], pitch: Math.PI / 2 }), 'steel', { tint: DARK })
    k.frame({ at: [0.33, 0.029, 0], roll: 0.0137 }, () => {

      k.put(place(gripRaw(0.7615, 0.016, { knob: 0.2, swell: 0.1, neck: 1.05, ratio: 0.78 }), { at: [-0.73, 0, 0], roll: -Math.PI / 2 }), 'wood', { tint: HICKORY })
      k.box('steel', [0.0016, 0.02, 0.003], [0.0316, 0, 0], { r: 0.0004, tint: DARK })
      bore(k, 'rubber', fillet2([[0.0155, 0], [0.0195, 0], [0.021, 0.012], [0.0195, 0.055], [0.0165, 0.06], [0.0155, 0.06], [0.0155, 0]], 0.002, 2), -0.1, 0, { tint: BLACK, seg: 28 })
      bore(k, 'rubber', [[0.0162, 0], [0.0185, 0], [0.0185, 0.17], [0.0162, 0.17], [0.0162, 0]], -0.71, 0, { tint: BLACK, seg: 28, wear: (x, y, z) => (y > 0.01 && y < 0.16 ? -0.0006 * Math.max(0, Math.cos(y * 380)) * (Math.hypot(x, z) > 0.017 ? 1 : 0) : 0) })
    })
  }),

  baton: (k) => k.frame({ at: [0, 0.013, 0], roll: -0.00877 }, () => {

    bore(k, 'charcoal', fillet2([[0, 0], [0.0145, 0], [0.0155, 0.004], [0.0155, 0.016], [0.014, 0.02], [0, 0.02]], 0.0015, 2), -0.3, 0, { tint: BLACK, seg: 28 })
    bore(k, 'rubber', fillet2([[0, 0], [0.0145, 0], [0.0148, 0.005], [0.0148, 0.17], [0.0135, 0.18], [0, 0.18]], 0.002, 2), -0.28, 0, { tint: BLACK, seg: 28, wear: (x, y, z) => (y > 0.008 && y < 0.168 ? knurl(18, 0.0004, 0.014)(x, y, z) : 0) })
    bore(k, 'steel', [[0, 0], [0.0098, 0], [0.0098, 0.18], [0.0108, 0.182], [0.0108, 0.188], [0, 0.188]], -0.1, 0, { tint: DARK, seg: 24 })
    bore(k, 'steel', [[0, 0], [0.0078, 0], [0.0078, 0.162], [0.0086, 0.164], [0.0086, 0.17], [0, 0.17]], 0.085, 0, { tint: DARK, seg: 22 })
    bore(k, 'steel', fillet2([[0, 0], [0.0085, 0], [0.0105, 0.008], [0.0105, 0.014], [0.008, 0.02], [0, 0.022]], 0.0015, 2), 0.25, 0, { tint: DARK, seg: 22 })
  }),

  slingshot: (k) => {

    const y = 0.0105
    k.put(sweepRaw([[-0.09, y, 0], [-0.04, y, 0], [-0.008, y, 0]], 0.0105, { seg: 14, flat: 0.85, radius: (_s, _a, t) => 1 + 0.12 * Math.sin(t * Math.PI) }), 'wood', { tint: WALNUT })
    for (const s of [-1, 1]) {
      k.put(sweepRaw([[-0.012, y, 0], [0.012, y, s * 0.012], [0.04, y, s * 0.028], [0.066, y, s * 0.036], [0.075, y, s * 0.037]], 0.0085, { seg: 12, flat: 0.85, radius: (_s, _a, t) => 1 - 0.15 * t }), 'wood', { tint: WALNUT })
      k.cyl('fabric', 0.0078, 0.009, [0.069, y, s * 0.0362], { axis: 'x', seg: 14, tint: [0.2, 0.2, 0.2] })
      k.put(sweepRaw([[0.074, y, s * 0.037], [0.092, 0.006, s * 0.03], [0.115, 0.0036, s * 0.016]], 0.0035, { seg: 8 }), 'rubber', { tint: [0.85, 0.55, 0.2] })
    }
    k.box('leather', [0.014, 0.004, 0.034], [0.122, 0.002, 0], { r: 0.0015, tint: LEATHER })
  },
}
