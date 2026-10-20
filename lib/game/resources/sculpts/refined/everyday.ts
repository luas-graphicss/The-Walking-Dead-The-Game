import { noise3, type V3 } from '../../../blockout/sculpt/kit'
import { bladeRaw, fillet2, knurl, loftRaw, rrect, seeded, sweepRaw, type ResourceFamily, type Station } from '../forms'
import { bore } from '../weapons'

const RED: V3 = [0.82, 0.12, 0.1], CHROME: V3 = [0.86, 0.87, 0.9], BLACK: V3 = [0.12, 0.12, 0.13], ORANGE: V3 = [0.95, 0.45, 0.1]
const ALU: V3 = [0.7, 0.71, 0.74], WALNUT: V3 = [0.5, 0.33, 0.2], HAY: V3 = [0.86, 0.72, 0.42]
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export const EVERYDAY_REFINED: ResourceFamily = {
  lighter: (k) => {

    const body: Station[] = [{ y: 0, rx: 0.0108, rz: 0.0052, p: 2.4 }, { y: 0.002, rx: 0.0118, rz: 0.0059, p: 2.4 }, { y: 0.062, rx: 0.0118, rz: 0.0059, p: 2.4 }, { y: 0.0645, rx: 0.0112, rz: 0.0056, p: 2.4 }]
    k.put(loftRaw(body, { seg: 40 }), 'paint', { tint: RED })
    k.extrude('steel', rrect(0.0215, 0.0102, 0.004), 0.012, [0.0005, 0.07, 0], { axis: 'y', holes: [rrect(0.0195, 0.0084, 0.003)], bevel: 0.0004, tint: CHROME })
    k.lathe('steel', [[0, 0], [0.0042, 0], [0.0042, 0.0062], [0, 0.0062]], [-0.0045, 0.0752, -0.0031], { axis: 'z', seg: 24, tint: CHROME, wear: knurl(26, 0.00035, 0.004) })
    k.box('charcoal', [0.009, 0.006, 0.0066], [0.0048, 0.0675, 0], { r: 0.0012, tint: BLACK })
  },

  flashlight: (k) => {

    const y = 0.0198
    bore(k, 'steel', [[0, 0], [0.0135, 0], [0.0135, 0.012], [0.0195, 0.03], [0.0198, 0.044], [0.0185, 0.048], [0.0172, 0.05], [0, 0.05]], 0.06, y, { tint: BLACK, seg: 40, wear: (x, yy, z) => (yy < 0.011 ? -0.0006 * Math.max(0, Math.cos(yy * 1500)) : yy > 0.045 ? -0.0012 * Math.max(0, Math.cos(Math.atan2(z, x) * 6)) ** 8 : 0) })
    k.cyl('glass', 0.0168, 0.002, [0.1094, y, 0], { axis: 'x', seg: 36, tint: [0.75, 0.8, 0.82] })
    bore(k, 'steel', [[0, 0], [0.0132, 0], [0.0132, 0.117], [0, 0.117]], -0.057, y, { tint: BLACK, seg: 36, wear: (x, yy, z) => (yy > 0.02 && yy < 0.095 ? knurl(28, 0.0004, 0.012)(x, yy, z) : 0) })
    k.torus('rubber', 0.0135, 0.0009, [0.06, y, 0], { axis: 'x', seg: 6, segR: 32, tint: BLACK })
    bore(k, 'steel', [[0, 0], [0.0145, 0], [0.0145, 0.02], [0, 0.02]], -0.077, y, { tint: BLACK, seg: 36 })
    k.frame({ at: [-0.077, y, 0], yaw: Math.PI }, () => k.lathe('rubber', fillet2([[0, 0], [0.009, 0], [0.0085, 0.003], [0.005, 0.0045], [0, 0.005]], 0.001, 2), [0, 0, 0], { axis: 'x', seg: 24, tint: BLACK }))
    k.put(sweepRaw([[-0.045, y + 0.0134, 0], [0.012, y + 0.0152, 0], [0.018, y + 0.0138, 0]], 0.0008, { seg: 6, flat: 6 }), 'steel', { tint: BLACK })
    k.torus('steel', 0.004, 0.001, [-0.081, y - 0.012, 0], { axis: 'z', seg: 6, segR: 14, tint: BLACK })
  },

  whistle: (k) => {

    const body: Station[] = [{ y: 0, rx: 0.0045, rz: 0.008, p: 3 }, { y: 0.004, rx: 0.0052, rz: 0.009, p: 3 }, { y: 0.016, rx: 0.0058, rz: 0.0095, p: 3 }, { y: 0.022, rx: 0.009, rz: 0.0105, p: 2.6 }, { y: 0.04, rx: 0.0095, rz: 0.011, p: 2.4 }, { y: 0.045, rx: 0.0085, rz: 0.01, p: 2.4 }, { y: 0.047, rx: 0.006, rz: 0.008, p: 2.2 }]
    k.put(loftRaw(body, { seg: 32 }).orient('x'), 'paint', { at: [-0.0235, 0.0095, 0], tint: ORANGE })
    k.box('charcoal', [0.0012, 0.0022, 0.009], [-0.0236, 0.0095, 0], { r: 0.0004, tint: BLACK })
    for (const z of [-0.0045, 0.0045]) k.box('charcoal', [0.007, 0.0014, 0.003], [0.008, 0.0187, z], { r: 0.0005, tint: BLACK })
    k.torus('steel', 0.0075, 0.0009, [0.0295, 0.0009, 0], { seg: 6, segR: 20, tint: CHROME })
  },

  mirror: (k) => {

    k.extrude('wood', rrect(0.3, 0.4, 0.004), 0.012, [0, 0.006, 0], { axis: 'y', holes: [rrect(0.25, 0.35, 0.002)], bevel: 0.003, bevelSeg: 3, tint: WALNUT })
    k.extrude('wood', rrect(0.256, 0.356, 0.002), 0.008, [0, 0.004, 0], { axis: 'y', holes: [rrect(0.246, 0.346, 0.0015)], bevel: 0.0015, tint: WALNUT })
    k.box('glass', [0.248, 0.004, 0.348], [0, 0.002, 0], { r: 0.0005, tint: [0.75, 0.8, 0.82] })
    for (const [x, z] of [[-0.1375, -0.1875], [0.1375, -0.1875], [-0.1375, 0.1875], [0.1375, 0.1875]]) k.lathe('steel', [[0, 0], [0.0045, 0], [0.004, 0.0015], [0.002, 0.0025], [0, 0.0028]], [x, 0.0118, z], { seg: 16, tint: [0.86, 0.68, 0.36] })
  },

  smartphone: (k) => {

    k.extrude('steel', rrect(0.0715, 0.147, 0.009), 0.0074, [0, 0.0041, 0], { axis: 'y', bevel: 0.0012, bevelSeg: 3, tint: ALU })
    k.extrude('paint', rrect(0.0705, 0.146, 0.0085), 0.0008, [0, 0.0004, 0], { axis: 'y', bevel: 0.0002, tint: [0.3, 0.31, 0.33] })
    k.extrude('glass', rrect(0.0705, 0.146, 0.0085), 0.0008, [0, 0.0082, 0], { axis: 'y', bevel: 0.0002, tint: [0.08, 0.09, 0.1] })
    k.cyl('charcoal', 0.0017, 0.0003, [0, 0.0087, -0.067], { seg: 16, tint: [0.02, 0.02, 0.02] })
    for (const [z, len] of [[-0.03, 0.012], [-0.012, 0.009], [0.002, 0.009]]) k.box('steel', [0.0016, 0.0028, len], [0.0361, 0.0045, z], { r: 0.0007, tint: ALU })
    k.box('charcoal', [0.0085, 0.0028, 0.0016], [0, 0.0045, 0.0733], { r: 0.0012, tint: [0.05, 0.05, 0.05] })
    for (let i = 0; i < 6; i++) k.cyl('charcoal', 0.0006, 0.0016, [0.012 + i * 0.0028, 0.0045, 0.0733], { axis: 'z', seg: 8, tint: [0.05, 0.05, 0.05] })
  },

  scalpel: (k) => {

    k.extrude('steel', fillet2([[-0.07, -0.0048], [0.03, -0.0045], [0.04, -0.003], [0.052, -0.0022], [0.052, 0.0022], [0.04, 0.003], [0.03, 0.0045], [-0.07, 0.0048], [-0.074, 0.002], [-0.074, -0.002]], 0.0008, 2, true), 0.0026, [0, 0.0013, 0], { axis: 'y', bevel: 0.0005, tint: CHROME })
    k.box('steel', [0.04, 0.0006, 0.0072], [-0.035, 0.0029, 0], { r: 0.0001, seg: [80, 1, 14], tint: CHROME, disp: (face, s, t) => (face === 2 ? 0.0002 * Math.max(0, Math.cos((s + t) * 1400)) * Math.max(0, Math.cos((s - t) * 1400)) : 0) })
    k.box('steel', [0.018, 0.0012, 0.003], [0.044, 0.0032, 0], { r: 0.0003, tint: CHROME })
    k.put(bladeRaw([[0.035, -0.0035], [0.065, -0.0042], [0.078, -0.0025], [0.084, 0.0004], [0.07, 0.0035], [0.035, 0.0032]], 0.0004, (_x, y) => clamp01((y + 0.0042) / 0.005)), 'steel', { at: [0, 0.0040, 0], pitch: -Math.PI / 2, tint: CHROME })
  },

  'hay-bale': (k) => {

    const W = 0.78, H = 0.38, D = 0.44
    k.box('straw', [W, H, D], [0, H / 2, 0], {
      r: 0.03, seg: [44, 20, 24], tint: HAY,
      disp: (face, s, t) => {
        const fluff = (noise3(s * 26 + face * 5, t * 26, 3) - 0.5) * 0.012 + (noise3(s * 70, t * 70 + face, 9) - 0.5) * 0.004
        if (face === 0 || face === 1) return fluff * 1.6
        const x = face === 5 ? -s : s
        return fluff - 0.007 * Math.max(0, Math.cos(x * Math.PI * 2 / 0.065)) ** 14
      },
    })
    for (const x of [-0.2, 0.2]) {
      const loop: V3[] = rrect(D - 0.004, H - 0.004, 0.04, 4).map(([z, yy]): V3 => [x, H / 2 + yy, z])
      k.put(sweepRaw(loop, 0.0025, { closed: true, seg: 6 }), 'fabric', { tint: [0.75, 0.62, 0.38] })
    }
    const rng = seeded(41)
    for (let i = 0; i < 14; i++) {
      const s = i % 2 ? 1 : -1, y = 0.04 + rng() * (H - 0.08), z = (rng() - 0.5) * (D - 0.08), len = 0.03 + rng() * 0.05
      k.put(sweepRaw([[s * (W / 2 - 0.01), y, z], [s * (W / 2 + len * 0.6), y + (rng() - 0.5) * 0.02, z + (rng() - 0.5) * 0.03], [s * (W / 2 + len), y - 0.01 - rng() * 0.02, z + (rng() - 0.5) * 0.05]], 0.0012, { seg: 4 }), 'straw', { tint: HAY })
    }
  },
}
