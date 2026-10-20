import type { V3 } from '../../../blockout/sculpt/kit'
import { stationAt } from '../archetypes'
import { circle, easeStations, fillet2, knurl, loftRaw, sweepRaw, type ResourceFamily, type Station } from '../forms'
import { bore } from '../weapons'
import { padRaw } from './parts'

const TEAL: V3 = [0.12, 0.55, 0.55], BLUE: V3 = [0.16, 0.32, 0.62], BLACK: V3 = [0.13, 0.13, 0.14], STEEL: V3 = [0.82, 0.83, 0.86], ALU: V3 = [0.7, 0.71, 0.73]
const TAU = Math.PI * 2

export const POWER_TOOLS_REFINED: ResourceFamily = {
  'power-drill': (k) => k.frame({ at: [-0.03, 0, 0] }, () => {

    k.box('charcoal', [0.118, 0.062, 0.08], [-0.02, 0.031, 0], { r: 0.008, tint: BLACK })
    for (const s of [-1, 1]) for (const y of [0.018, 0.028, 0.038]) k.box('rubber', [0.074, 0.0035, 0.003], [-0.024, y, s * 0.0405], { r: 0.0012, tint: BLACK })
    k.box('rubber', [0.006, 0.014, 0.034], [0.0405, 0.046, 0], { r: 0.002, tint: [0.32, 0.32, 0.33] })
    for (let i = 0; i < 3; i++) k.box('glass', [0.002, 0.004, 0.006], [-0.0795, 0.046, -0.01 + i * 0.01], { r: 0.0006, tint: [0.35, 0.85, 0.35] })
    k.box('paint', [0.114, 0.014, 0.074], [-0.02, 0.069, 0], { r: 0.006, tint: TEAL })
    k.box('glass', [0.004, 0.006, 0.016], [0.0375, 0.07, 0], { r: 0.001, tint: [0.92, 0.92, 0.84] })
    const grip: Station[] = easeStations([
      { y: 0.074, rx: 0.031, rz: 0.027, cx: -0.036, p: 3.2 }, { y: 0.086, rx: 0.025, rz: 0.021, cx: -0.035, p: 3 },
      { y: 0.112, rx: 0.0215, rz: 0.0185, cx: -0.031, p: 2.7 }, { y: 0.138, rx: 0.0225, rz: 0.019, cx: -0.027, p: 2.7 },
      { y: 0.16, rx: 0.026, rz: 0.021, cx: -0.023, p: 3 }, { y: 0.176, rx: 0.03, rz: 0.024, cx: -0.02, p: 3 },
    ], 3)
    k.put(loftRaw(grip, { seg: 40 }), 'paint', { tint: TEAL })
    k.put(padRaw(grip, 0.088, 0.158, Math.PI * 0.62, Math.PI * 1.38, 0.0022, 20), 'rubber', { tint: BLACK })
    const housing: Station[] = easeStations([
      { y: 0, rx: 0.016, rz: 0.015, p: 2.2 }, { y: 0.007, rx: 0.026, rz: 0.025, p: 2.6 }, { y: 0.02, rx: 0.031, rz: 0.03, p: 2.9 },
      { y: 0.075, rx: 0.033, rz: 0.031, p: 3 }, { y: 0.112, rx: 0.031, rz: 0.03, p: 3 }, { y: 0.132, rx: 0.027, rz: 0.027, p: 2.5 }, { y: 0.144, rx: 0.025, rz: 0.025, p: 2 },
    ], 3)
    const hx = -0.098, hy = 0.184
    k.put(loftRaw(housing, { seg: 48 }).orient('x'), 'paint', { at: [hx, hy, 0], tint: TEAL })
    for (let i = 0; i < 4; i++) {
      const x = -0.086 + i * 0.0075, st = stationAt(housing, x - hx)
      for (const s of [-1, 1]) k.box('charcoal', [0.0035, 0.022, 0.004], [x, hy + 0.002, s * st.rz], { r: 0.0012, tint: BLACK })
    }
    k.box('charcoal', [0.018, 0.006, 0.012], [-0.01, hy + stationAt(housing, -0.01 - hx).rx - 0.0005, 0], { r: 0.002, tint: BLACK })
    k.extrude('charcoal', fillet2([[-0.006, 0.153], [0.009, 0.153], [0.0145, 0.147], [0.0145, 0.136], [0.009, 0.127], [-0.006, 0.129]], 0.0025, 3, true), 0.017, [0, 0, 0], { bevel: 0.002, tint: BLACK })
    k.box('charcoal', [0.009, 0.008, 0.054], [-0.004, 0.156, 0], { r: 0.0025, tint: BLACK })
    bore(k, 'charcoal', [[0.017, 0], [0.0265, 0], [0.0275, 0.003], [0.0275, 0.013], [0.025, 0.016], [0.017, 0.016], [0.017, 0]], 0.04, hy, { tint: BLACK, seg: 48, wear: knurl(24, 0.0009, 0.026) })
    k.cyl('charcoal', 0.017, 0.012, [0.062, hy, 0], { axis: 'x', seg: 32, tint: BLACK })
    bore(k, 'charcoal', [[0, 0], [0.0195, 0], [0.0205, 0.004], [0.0198, 0.026], [0.0165, 0.036], [0.012, 0.042], [0, 0.042]], 0.058, hy, { tint: BLACK, seg: 40, wear: (x, y, z) => (y > 0.005 && y < 0.028 ? knurl(16, 0.0012, 0.017)(x, y, z) : 0) })
    bore(k, 'steel', [[0, 0], [0.011, 0], [0.0098, 0.006], [0.0058, 0.0095], [0, 0.0095]], 0.1, hy, { tint: STEEL, seg: 24 })
    bore(k, 'steel', [[0, 0], [0.0034, 0], [0.0034, 0.046], [0.0022, 0.053], [0, 0.056]], 0.104, hy, { tint: STEEL, seg: 16, wear: (x, y, z) => (y > 0.012 && y < 0.05 ? -0.0011 * Math.max(0, Math.cos(Math.atan2(z, x) * 2 - y * 350)) : 0) })
  }),

  'angle-grinder': (k) => k.frame({ at: [-0.017, 0, 0] }, () => {

    const cx = -0.09
    k.extrude('charcoal', circle(0.0575, 72), 0.003, [cx, 0.0015, 0], { axis: 'y', holes: [circle(0.011, 24)], bevel: 0.0005, tint: [0.22, 0.22, 0.23] })
    k.lathe('charcoal', [[0.011, 0], [0.022, 0], [0.024, 0.004], [0.022, 0.007], [0.011, 0.007], [0.011, 0]], [cx, 0.0025, 0], { seg: 40, tint: [0.3, 0.3, 0.3] })
    k.lathe('steel', [[0.0072, 0], [0.0145, 0], [0.0145, 0.004], [0.0095, 0.0058], [0.0072, 0.0058], [0.0072, 0]], [cx, 0.0095, 0], { seg: 32, tint: STEEL })
    k.cyl('steel', 0.0074, 0.012, [cx, 0.016, 0], { seg: 20, tint: STEEL })
    k.lathe('steel', [[0.016, 0.016], [0.016, 0.0135], [0.0565, 0.0135], [0.0615, 0.0105], [0.0615, 0.0045], [0.0645, 0.0045], [0.0645, 0.011], [0.058, 0.016], [0.016, 0.016]], [cx, 0, 0], { seg: 48, arc: Math.PI * 1.1, phase: -Math.PI * 0.55, tint: ALU })
    k.lathe('steel', [[0.0158, 0], [0.0215, 0], [0.0215, 0.008], [0.0158, 0.008], [0.0158, 0]], [cx, 0.0158, 0], { seg: 32, tint: ALU })
    k.box('steel', [0.012, 0.007, 0.01], [cx + 0.026, 0.0195, 0], { r: 0.0015, tint: ALU })
    const head: Station[] = easeStations([{ y: 0.022, rx: 0.022, rz: 0.022, p: 2.5 }, { y: 0.03, rx: 0.029, rz: 0.027, p: 3 }, { y: 0.07, rx: 0.031, rz: 0.028, p: 3.2 }, { y: 0.078, rx: 0.026, rz: 0.024, p: 3 }], 3)
    k.put(loftRaw(head, { seg: 40, wear: (x, y, z) => (y > 0.034 && y < 0.066 ? -0.0006 * Math.max(0, Math.cos(y * 520)) * (Math.abs(z) > 0.02 ? 1 : 0) : 0) }), 'steel', { at: [cx, 0, 0], tint: ALU })
    k.cyl('rubber', 0.006, 0.006, [cx, 0.08, 0], { seg: 16, tint: BLACK })
    k.cyl('steel', 0.009, 0.008, [cx, 0.05, 0.031], { axis: 'z', seg: 20, tint: ALU })
    k.lathe('charcoal', fillet2([[0, 0], [0.0095, 0], [0.012, 0.008], [0.0125, 0.05], [0.0135, 0.062], [0.011, 0.068], [0, 0.069]], 0.002, 2), [cx, 0.05, 0.034], { axis: 'z', seg: 28, tint: BLACK, wear: (x, y, z) => (y > 0.01 && y < 0.058 ? knurl(10, 0.0008, 0.011)(x, y, z) : 0) })
    const body: Station[] = easeStations([
      { y: 0, rx: 0.027, rz: 0.027, p: 2.2 }, { y: 0.02, rx: 0.029, rz: 0.029, p: 2.3 }, { y: 0.11, rx: 0.0285, rz: 0.0285, p: 2.2 },
      { y: 0.165, rx: 0.024, rz: 0.024, p: 2 }, { y: 0.19, rx: 0.019, rz: 0.019, p: 2 }, { y: 0.198, rx: 0.012, rz: 0.012, p: 2 },
    ], 3)
    const bx = -0.072, by = 0.056
    k.put(loftRaw(body, { seg: 48 }).orient('x'), 'paint', { at: [bx, by, 0], tint: BLUE })
    k.put(padRaw(body, 0.1, 0.168, 0, TAU, 0.0018, 48).orient('x'), 'rubber', { at: [bx, by, 0], tint: BLACK })
    for (let i = 0; i < 5; i++) {
      const x = -0.058 + i * 0.006, st = stationAt(body, x - bx)
      for (const s of [-1, 1]) k.box('charcoal', [0.0035, 0.018, 0.004], [x, by, s * st.rz], { r: 0.0012, tint: BLACK })
    }
    k.box('charcoal', [0.036, 0.006, 0.012], [-0.012, by + stationAt(body, -0.012 - bx).rx + 0.0015, 0], { r: 0.0025, tint: BLACK })
    bore(k, 'rubber', [[0, 0], [0.011, 0], [0.009, 0.02], [0.0065, 0.04], [0, 0.041]], 0.124, by, { tint: BLACK, seg: 24, wear: (x, y, z) => (y > 0.012 ? -0.0006 * Math.max(0, Math.cos(y * 900)) : 0) })
    k.put(sweepRaw([[0.163, by, 0], [0.176, 0.05, 0.004], [0.183, 0.03, 0.012], [0.178, 0.006, 0.03], [0.15, 0.0045, 0.05], [0.11, 0.0045, 0.056]], 0.0042, { seg: 10 }), 'rubber', { tint: BLACK })
  }),

  'soldering-iron': (k) => {

    const y = 0.0125
    bore(k, 'rubber', [[0, 0], [0.004, 0], [0.0055, 0.012], [0.0066, 0.022], [0, 0.022]], -0.112, y, { tint: BLACK, seg: 20, wear: (x, yy, z) => (yy < 0.016 ? -0.0004 * Math.max(0, Math.cos(yy * 1100)) : 0) })
    bore(k, 'rubber', fillet2([[0, 0], [0.0085, 0], [0.0105, 0.01], [0.0098, 0.05], [0.0108, 0.062], [0.0122, 0.07], [0.0122, 0.075], [0, 0.075]], 0.0015, 2), -0.09, y, { tint: [0.2, 0.32, 0.55], seg: 32, wear: (x, yy, z) => (yy > 0.012 && yy < 0.06 ? knurl(20, 0.0004, 0.009)(x, yy, z) : 0) })
    bore(k, 'charcoal', [[0, 0], [0.0125, 0], [0.0125, 0.003], [0.006, 0.006], [0, 0.006]], -0.016, y, { tint: BLACK, seg: 32 })
    bore(k, 'steel', [[0, 0], [0.0068, 0], [0.0068, 0.012], [0.0055, 0.014], [0, 0.014]], -0.01, y, { tint: STEEL, seg: 24, wear: knurl(18, 0.0004, 0.006) })
    bore(k, 'steel', [[0, 0], [0.0042, 0], [0.0042, 0.07], [0.0036, 0.074], [0, 0.074]], 0.004, y, { tint: STEEL, seg: 20 })
    bore(k, 'steel', [[0, 0], [0.0022, 0], [0.002, 0.015], [0.0009, 0.026], [0, 0.028]], 0.078, y, { tint: [0.6, 0.45, 0.3], seg: 16 })
    k.put(sweepRaw([[-0.11, y, 0], [-0.12, 0.011, 0.002], [-0.126, 0.005, 0.01], [-0.12, 0.003, 0.03], [-0.09, 0.003, 0.042]], 0.0026, { seg: 8 }), 'rubber', { tint: BLACK })
  },
}
