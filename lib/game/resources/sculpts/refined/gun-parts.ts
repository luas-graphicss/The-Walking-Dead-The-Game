import type { V2, V3 } from '../../../blockout/sculpt/kit'
import { circle, fillet2, knurl, loftRaw, pillow, rrect, sweepRaw, type ResourceFamily, type Station } from '../forms'
import { bore, onSide, slab } from '../weapons'

const BLUED: V3 = [0.3, 0.31, 0.34], BLACK: V3 = [0.13, 0.13, 0.14], BRASS: V3 = [0.86, 0.68, 0.36], FDE: V3 = [0.72, 0.6, 0.44], WALNUT: V3 = [0.55, 0.36, 0.22]

function round(k: Parameters<typeof onSide>[0], m: 'paint' | 'steel', x0: number, y: number, r: number, len: number, bl: number, neck = 0.92) {
  bore(k, m, fillet2([[0, 0], [r * 1.02, 0], [r * 1.02, 0.0012], [r, 0.0016], [r, len * 0.8], [r * neck, len * 0.9], [r * neck, len], [r * neck * 0.98, len + bl * 0.3], [r * neck * 0.6, len + bl * 0.8], [0, len + bl]], 0.0004, 2), x0, y, { tint: BRASS, seg: 20 })
}

export const GUN_PARTS_REFINED: ResourceFamily = {
  'pistol-magazine': (k) => {

    k.box('rubber', [0.0365, 0.011, 0.0265], [0.001, 0.0055, 0], { r: 0.003, tint: BLACK })
    k.box('rubber', [0.006, 0.006, 0.02], [0.0195, 0.004, 0], { r: 0.002, tint: BLACK })
    const tube: Station[] = [{ y: 0.009, rx: 0.0158, rz: 0.0112, p: 5 }, { y: 0.11, rx: 0.0155, rz: 0.011, cx: 0.0035, p: 5 }, { y: 0.117, rx: 0.0146, rz: 0.0102, cx: 0.0037, p: 4 }]
    k.put(loftRaw(tube, { seg: 32 }), 'steel', { tint: BLUED })
    for (const s of [-1, 1]) k.put(sweepRaw([[-0.0105, 0.1165, s * 0.0084], [0.0, 0.1185, s * 0.0078], [0.0105, 0.1178, s * 0.0072]], 0.0016, { seg: 8 }), 'steel', { tint: BLUED })
    round(k, 'paint', -0.0115, 0.1218, 0.0049, 0.019, 0.0115, 0.94)
  },

  'rifle-magazine': (k) => {

    const off = (y: number) => 0.02 * ((0.165 - y) / 0.153) ** 2
    const front: V2[] = [], back: V2[] = []
    for (let i = 0; i <= 12; i++) { const y = 0.012 + i / 12 * 0.153; front.push([0.0005 + off(y), y]); back.push([-0.032 + off(y) - 0.001 * (1 - i / 12), y]) }
    slab(k, 'paint', [...front, ...back.reverse()], 0.026, { tint: FDE, round: 0.003 })
    for (let i = 0; i < 7; i++) {
      const y = 0.03 + i * 0.008, cx = -0.0158 + off(y)
      for (const s of [-1, 1]) k.box('paint', [0.022, 0.0028, 0.0016], [cx, y, s * 0.0136], { r: 0.0006, tint: FDE })
    }
    k.box('paint', [0.042, 0.012, 0.031], [-0.0155 + off(0.006), 0.006, 0], { r: 0.003, tint: FDE })
    round(k, 'steel', -0.031, 0.1695, 0.0048, 0.036, 0.019, 0.6)
  },

  suppressor: (k) => {

    const y = 0.0195
    bore(k, 'paint', [[0, 0], [0.018, 0], [0.019, 0.003], [0.019, 0.155], [0.018, 0.158], [0, 0.158]], -0.078, y, { tint: BLACK, seg: 40, wear: (x, yy, z) => (yy > 0.03 && yy < 0.13 ? -0.0007 * Math.max(0, Math.cos(Math.atan2(z, x) * 8)) ** 4 : 0) })
    bore(k, 'paint', [[0.0052, 0], [0.019, 0], [0.0195, 0.002], [0.0195, 0.01], [0.017, 0.013], [0.0052, 0.013], [0.0052, 0]], 0.079, y, { tint: BLACK, seg: 40 })
    bore(k, 'steel', [[0.006, 0], [0.0178, 0], [0.0178, 0.013], [0.006, 0.013], [0.006, 0]], -0.0915, y, { tint: BLUED, seg: 40, wear: knurl(28, 0.0005, 0.017) })
    bore(k, 'charcoal', [[0, 0], [0.0052, 0], [0.0052, 0.004], [0, 0.004]], 0.088, y, { tint: [0.1, 0.1, 0.1], seg: 16 })
  },

  'pistol-barrel': (k) => onSide(k, 0.00725, () => {

    k.box('steel', [0.026, 0.0165, 0.0145], [-0.044, 0.0018, 0], { r: 0.0015, tint: BLUED })
    bore(k, 'steel', [[0.0026, 0], [0.0068, 0], [0.0068, 0.006], [0.006, 0.012], [0.0058, 0.086], [0.0053, 0.09], [0.0026, 0.09], [0.0026, 0]], -0.031, 0, { tint: BLUED, seg: 28 })
    k.extrude('steel', fillet2([[-0.056, -0.004], [-0.034, -0.004], [-0.03, -0.0105], [-0.038, -0.016], [-0.05, -0.016], [-0.056, -0.012]], 0.0012, 2, true), 0.0095, [0, 0, 0], { bevel: 0.001, holes: [circle(0.0022, 12, -0.045, -0.0115)], tint: BLUED })
    bore(k, 'steel', [[0, 0], [0.0045, 0], [0.0045, 0.0008], [0, 0.0008]], -0.0578, 0, { tint: [0.1, 0.1, 0.1], seg: 16 })
  }, [-0.0015, 0]),

  'wooden-stock': (k) => onSide(k, 0.018, () => {

    slab(k, 'wood', [[0.17, 0.022], [0.12, 0.024], [0.05, 0.03], [-0.06, 0.036], [-0.165, 0.038], [-0.17, 0.03], [-0.17, -0.08], [-0.162, -0.086], [-0.05, -0.05], [0.04, -0.03], [0.07, -0.032], [0.085, -0.07], [0.115, -0.076], [0.125, -0.06], [0.12, -0.02], [0.17, -0.012]], 0.036, { tint: WALNUT, round: 0.006 })
    slab(k, 'wood', [[0.04, 0.028], [-0.1, 0.033], [-0.12, 0.0], [-0.08, -0.02], [0.02, -0.01]], 0.008, { tint: WALNUT, round: 0.004, z: 0.019 })
    slab(k, 'rubber', [[-0.17, 0.036], [-0.188, 0.037], [-0.19, 0.03], [-0.19, -0.082], [-0.186, -0.087], [-0.17, -0.083]], 0.037, { tint: BLACK, round: 0.004 })
    slab(k, 'rubber', [[0.084, -0.068], [0.116, -0.074], [0.118, -0.08], [0.086, -0.076]], 0.026, { tint: BLACK, round: 0.002 })
    k.box('charcoal', [0.004, 0.022, 0.02], [0.1705, 0.005, 0], { r: 0.001, tint: [0.15, 0.1, 0.08] })
    k.cyl('steel', 0.004, 0.008, [-0.1, -0.067, 0], { roll: 0.33, seg: 12, tint: BLUED })
    k.torus('steel', 0.009, 0.0016, [-0.103, -0.077, 0], { axis: 'z', seg: 6, segR: 16, tint: BLUED })
  }, [0.0, 0.025]),

  holster: (k) => {

    const outline: V2[] = [[-0.055, -0.098], [0.035, -0.098], [0.042, -0.02], [0.06, -0.01], [0.06, 0.06], [0.04, 0.098], [-0.045, 0.098], [-0.06, 0.06], [-0.06, -0.01], [-0.048, -0.04]]
    k.extrude('leather', fillet2(outline, 0.008, 3, true), 0.004, [0, 0.002, 0], { axis: 'y', bevel: 0.001, holes: [rrect(0.008, 0.04, 0.003, 3, -0.052, 0.03), rrect(0.008, 0.04, 0.003, 3, 0.052, 0.03)], tint: [0.18, 0.15, 0.13] })
    const pocket = pillow(0.07, 0.024, 0.17, { seam: 0.15, wrinkle: 0.12, px: 0.32, pz: 0.22, nx: 18, nz: 26, seed: 31 })
    k.put(pocket.raw, 'leather', { at: [-0.004, 0.003, -0.006], tint: [0.18, 0.15, 0.13] })
    const ring = fillet2(outline, 0.008, 3, true).map(([x, z]): V3 => [x * 0.9, 0.0042, -z * 0.92])
    k.put(sweepRaw([...ring, ring[0]], 0.0007, { seg: 5 }), 'fabric', { tint: [0.1, 0.1, 0.1] })
    k.put(sweepRaw([[-0.03, 0.0255, -0.06], [-0.012, 0.0285, -0.068], [0.014, 0.0285, -0.068], [0.032, 0.0255, -0.06]], 0.0012, { seg: 6, flat: 9 }), 'leather', { tint: [0.18, 0.15, 0.13] })
    k.cyl('steel', 0.0055, 0.003, [0.016, 0.0305, -0.067], { seg: 16, bevel: 0.0008, tint: BLUED })
    for (const x of [-0.04, 0.036]) k.cyl('steel', 0.0028, 0.0012, [x, 0.0046, -0.085], { seg: 12, tint: BLUED })
  },
}
