import { latheRaw, rboxRaw, type Raw, type V2, type V3 } from '../../blockout/sculpt/kit'
import { bottle } from './archetypes'
import { circle, dents, easeStations, fillet2, knurl, loftRaw, merge, place, ribbon, ribs, ringPath, rrect, rrectPath, sphereMesh, sweepRaw, type ResourceFamily, type Station } from './forms'
import { BLACK, bore } from './weapons'

const STEEL: V3 = [0.8, 0.81, 0.84], BRASS: V3 = [0.86, 0.68, 0.36], GOLD: V3 = [0.96, 0.76, 0.32], POLY: V3 = [0.13, 0.13, 0.14]
const WHITE: V3 = [0.94, 0.93, 0.9], RED: V3 = [0.8, 0.14, 0.1]

function keyOutline(len: number, cuts: number[]): V2[] {
  const pts: V2[] = []
  for (let i = 0; i <= 18; i++) { const a = 0.45 + (Math.PI * 2 - 0.9) * i / 18; pts.push([Math.cos(a) * 0.011, Math.sin(a) * 0.011]) }
  pts.push([0.012, -0.0036])
  const step = (len - 0.022) / cuts.length
  cuts.forEach((c, i) => { const x = 0.016 + i * step; pts.push([x, -0.0036 + c], [x + step * 0.5, -0.0036 + c * 0.3]) })
  pts.push([len - 0.004, -0.0026], [len, 0.0005], [len - 0.002, 0.0036], [0.012, 0.0036])
  return pts
}

function pickOutline(len: number, tip: V2[]): V2[] {
  return [[0, -0.0006], [len, -0.0006], ...tip.map(([x, y]): V2 => [len + x, y]), [len, 0.0006], [0, 0.0006]]
}

export const UTILITY: ResourceFamily = {
  fireworks: (k) => {

    const rocket = fillet2([[0, 0], [0.0118, 0], [0.012, 0.004], [0.012, 0.09], [0.0116, 0.092], [0.0045, 0.11], [0, 0.114]], 0.0012, 2), x0 = 0.04, y = 0.012
    for (const [i, z] of [-0.048, -0.02, 0.008].entries()) {
      k.lathe('paper', rocket, [x0, y, z], { axis: 'x', seg: 20, tint: i === 1 ? [0.18, 0.35, 0.75] : [0.85, 0.15, 0.12] })
      k.lathe('paper', [[0.0132, 0.03], [0.0132, 0.06]], [x0, y, z], { axis: 'x', seg: 20, tint: [0.95, 0.82, 0.25] })
      k.box('wood', [0.24, 0.005, 0.005], [x0 - 0.09, 0.0025, z + 0.0085], { r: 0.0008, tint: [0.82, 0.68, 0.45] })
      k.put(sweepRaw([[x0 + 0.002, y, z], [x0 - 0.012, y - 0.003, z - 0.002], [x0 - 0.022, 0.006, z - 0.006], [x0 - 0.03, 0.0016, z - 0.008]], 0.0013, { seg: 6 }), 'fabric', { tint: [0.25, 0.5, 0.25] })
    }
    const body = () => latheRaw(fillet2([[0, 0], [0.0036, 0], [0.0036, 0.026], [0, 0.026]], 0.0008, 2), { seg: 10 }).orient('x'), crackers: Raw[] = []
    for (let i = 0; i < 10; i++) crackers.push(place(body(), { at: [-0.09 + i * 0.019, 0.0036, 0.045], yaw: (i % 2 ? 1 : -1) * 0.75 }))
    k.put(merge(...crackers), 'paper', { tint: [0.82, 0.12, 0.1] })
    k.put(sweepRaw([[-0.1, 0.0022, 0.045], [0.1, 0.0022, 0.045], [0.12, 0.002, 0.051]], 0.0015, { seg: 6, radius: ribs(0.004, 0.25) }), 'fabric', { tint: [0.3, 0.45, 0.25] })
  },
  lighter: (k) => {

    const st = easeStations([{ y: 0, rx: 0.0116, rz: 0.0054, p: 2.6 }, { y: 0.004, rx: 0.0124, rz: 0.006, p: 2.6 }, { y: 0.06, rx: 0.0124, rz: 0.006, p: 2.6 }, { y: 0.0655, rx: 0.0119, rz: 0.0057, p: 2.6 }], 3)
    k.put(loftRaw(st, { seg: 32 }), 'paint', { tint: [0.85, 0.15, 0.12] })
    k.box('rubber', [0.0236, 0.0035, 0.0112], [0, 0.066, 0], { r: 0.0012, tint: POLY })
    k.extrude('steel', [[0.0118, 0], [-0.0005, 0], [-0.0005, 0.006], [0.003, 0.0148], [0.0118, 0.0148]], 0.0108, [0, 0.0672, 0], { bevel: 0.0006, tint: STEEL })
    k.box('rubber', [0.006, 0.0012, 0.004], [0.0065, 0.0819, 0], { r: 0.0003, tint: POLY })
    k.frame({ at: [-0.0045, 0.0735, -0.0045] }, () => k.lathe('steel', [[0, 0], [0.0042, 0], [0.0042, 0.002], [0.0042, 0.0045], [0.0042, 0.007], [0.0042, 0.009], [0, 0.009]], [0, 0, 0], { axis: 'z', seg: 24, tint: [0.55, 0.56, 0.6], wear: knurl(24, 0.0005) }))
    for (const s of [-1, 1]) k.extrude('steel', [[-0.009, 0.0675], [-0.0005, 0.0675], [-0.0005, 0.078], [-0.006, 0.079]], 0.0008, [0, 0, s * 0.0052], { bevel: 0.0002, tint: STEEL })
    k.box('paint', [0.0065, 0.0028, 0.0085], [-0.0085, 0.0689, 0], { r: 0.001, tint: POLY })
  },
  matches: (k) => {

    k.extrude('paper', rrect(0.035, 0.015, 0.0008), 0.05, [0, 0.0075, 0], { axis: 'x', holes: [rrect(0.0334, 0.0134, 0.0004)], bevel: 0.0002, tint: [0.95, 0.85, 0.25] })

    for (const s of [-1, 1]) k.box('paper', [0.046, 0.011, 0.0012], [0, 0.0075, s * 0.0181], { r: 0.0003, tint: [0.38, 0.24, 0.16] })
    k.box('paper', [0.04, 0.001, 0.027], [0, 0.0154, 0], { r: 0.0003, tint: [0.8, 0.14, 0.1] })
    const tx = 0.018
    k.box('paper', [0.047, 0.0008, 0.033], [tx, 0.0012, 0], { r: 0.0002, tint: [0.85, 0.8, 0.7] })
    k.extrude('paper', rrect(0.047, 0.033, 0.0006), 0.011, [tx, 0.0016 + 0.0055, 0], { axis: 'y', holes: [rrect(0.0454, 0.0314, 0.0003)], bevel: 0.0002, tint: [0.85, 0.8, 0.7] })
    const sticks: Raw[] = [], heads: Raw[] = []
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < (layer ? 9 : 10); i++) {
      const z = -0.0135 + i * 0.003 + layer * 0.0015, y = 0.0026 + layer * 0.002
      sticks.push(place(rboxRaw(0.042, 0.002, 0.002, { r: 0.0003 }), { at: [tx - 0.0005, y, z] }))
      heads.push(place(sphereMesh(0.0017, 4, 8), { at: [tx + 0.0212, y, z], scale: [1.3, 1, 1] }))
    }
    k.put(merge(...sticks), 'wood', { tint: [0.92, 0.82, 0.6] })
    k.put(merge(...heads), 'paint', { tint: [0.75, 0.1, 0.08] })
  },
  candles: (k) => {

    const prof = fillet2([[0, 0], [0.0093, 0], [0.0099, 0.004], [0.0099, 0.185], [0.0094, 0.19], [0.0028, 0.1912], [0, 0.1915]], 0.0012, 2)
    for (const [i, z] of [-0.025, -0.002, 0.021].entries()) k.frame({ at: [0, 0, z], yaw: (i - 1) * 0.015 }, () => {
      k.lathe('plaster', prof, [-0.096, 0.0099, 0], { axis: 'x', seg: 20, tint: i === 1 ? [0.95, 0.92, 0.8] : [0.97, 0.96, 0.92] })
      k.put(sweepRaw([[0.094, 0.0099, 0], [0.1, 0.0102, 0.0005], [0.104, 0.0098, 0.0018]], 0.0007, { seg: 5 }), 'fabric', { tint: i === 2 ? [0.12, 0.1, 0.08] : [0.85, 0.82, 0.75] })
    })
  },
  flashlight: (k) => {
    const y = 0.02, x0 = -0.09

    bore(k, 'paint', fillet2([[0, 0], [0.0148, 0], [0.0155, 0.004], [0.0155, 0.02], [0.0145, 0.022], [0.0145, 0.04], [0.0145, 0.06], [0.0145, 0.08], [0.0145, 0.1], [0.0145, 0.118], [0.0175, 0.135], [0.0195, 0.146], [0.0195, 0.16], [0, 0.16]], 0.0012, 2), x0, y, { tint: [0.95, 0.74, 0.1], seg: 32, wear: (x, yy, z) => (yy > 0.03 && yy < 0.11 ? knurl(16, 0.0006)(x, yy, z) : 0) })
    k.cyl('steel', 0.0175, 0.0012, [x0 + 0.1606, y, 0], { axis: 'x', seg: 28, tint: [0.92, 0.93, 0.95] })
    bore(k, 'rubber', [[0.018, 0], [0.0205, 0], [0.0205, 0.014], [0.018, 0.014], [0.018, 0]], x0 + 0.157, y, { tint: POLY, seg: 32 })
    k.cyl('glass', 0.0176, 0.002, [x0 + 0.166, y, 0], { axis: 'x', seg: 28, tint: [0.85, 0.9, 0.92] })
    k.sphere('rubber', 0.006, [x0 + 0.105, y + 0.0138, 0], { rows: 6, seg: 12, scale: [1.5, 0.55, 1.1], tint: POLY })
    k.put(sweepRaw([[x0 + 0.001, y, 0], [x0 - 0.01, y - 0.006, 0], [x0 - 0.02, 0.0025, 0.006], [x0 - 0.045, 0.0025, 0.018], [x0 - 0.055, 0.0025, -0.002], [x0 - 0.03, 0.0025, -0.014], [x0 - 0.012, 0.004, -0.004], [x0 - 0.003, y - 0.008, -0.001]], 0.0018, { seg: 6 }), 'fabric', { tint: BLACK })
  },
  'kerosene-lantern': (k) => {

    const red: V3 = [0.72, 0.14, 0.1]
    k.lathe('paint', fillet2([[0, 0], [0.062, 0], [0.066, 0.004], [0.069, 0.02], [0.066, 0.046], [0.052, 0.058], [0.03, 0.063], [0, 0.064]], 0.004, 3), [0, 0, 0], { seg: 40, tint: red })
    k.cyl('paint', 0.0085, 0.008, [0.042, 0.06, 0.018], { seg: 16, tint: red })
    k.lathe('steel', fillet2([[0, 0.06], [0.03, 0.06], [0.032, 0.064], [0.03, 0.072], [0.024, 0.078], [0.032, 0.08], [0.033, 0.086], [0.03, 0.087], [0, 0.087]], 0.001, 2), [0, 0, 0], { seg: 32, tint: BRASS })
    k.cyl('steel', 0.0015, 0.02, [0, 0.071, 0.03], { axis: 'z', seg: 8, tint: BRASS })
    k.frame({ at: [0, 0.071, 0.039] }, () => k.lathe('steel', [[0, 0], [0.0075, 0], [0.0075, 0.0015], [0.0075, 0.003], [0.007, 0.004], [0, 0.004]], [0, 0, 0], { axis: 'z', seg: 18, tint: BRASS, wear: knurl(16, 0.0006) }))
    const outer: V2[] = [[0.03, 0.085], [0.034, 0.1], [0.05, 0.13], [0.056, 0.155], [0.052, 0.18], [0.04, 0.2], [0.031, 0.214]]
    k.lathe('glass', [[outer[0][0] - 0.0025, 0.085], ...outer, ...outer.slice().reverse().map(([r, yy]): V2 => [r - 0.0025, yy])], [0, 0, 0], { seg: 40, tint: [0.88, 0.92, 0.9] })
    const wires = [0.785, 2.356, 3.927, 5.498].map((a) => sweepRaw(([[0.032, 0.084], [0.05, 0.11], [0.062, 0.15], [0.055, 0.19], [0.042, 0.212]] as V2[]).map(([r, yy]): V3 => [Math.cos(a) * r, yy, Math.sin(a) * r]), 0.0016, { seg: 6 }))
    k.put(merge(...wires), 'steel', { tint: [0.35, 0.35, 0.37] })
    k.torus('steel', 0.0622, 0.0016, [0, 0.15, 0], { seg: 6, segR: 40, tint: [0.35, 0.35, 0.37] })
    k.put(merge(...[-1, 1].map((s) => sweepRaw([[s * 0.06, 0.04, 0], [s * 0.07, 0.07, 0], [s * 0.07, 0.225, 0], [s * 0.05, 0.24, 0], [s * 0.03, 0.242, 0]], 0.005, { seg: 10 }))), 'paint', { tint: red })
    k.lathe('paint', fillet2([[0, 0.21], [0.042, 0.21], [0.047, 0.218], [0.04, 0.235], [0.026, 0.248], [0.014, 0.252], [0, 0.253]], 0.003, 2), [0, 0, 0], { seg: 32, tint: red })
    k.put(sweepRaw(Array.from({ length: 17 }, (_, i): V3 => { const a = Math.PI * i / 16; return [-Math.cos(a) * 0.07, 0.2 + Math.sin(a) * 0.09, 0] }), 0.0022, { seg: 6 }), 'steel', { tint: [0.35, 0.35, 0.37] })
  },
  'glow-sticks': (k) => {

    for (const [i, z] of [-0.016, 0, 0.016].entries()) {
      const tint = ([[0.35, 0.95, 0.3], [0.98, 0.85, 0.2], [0.98, 0.45, 0.15]] as V3[])[i], y = 0.0058
      k.lathe('glass', fillet2([[0, 0], [0.0055, 0], [0.0058, 0.006], [0.0058, 0.14], [0.0052, 0.146], [0, 0.147]], 0.001, 2), [-0.075, y, z], { axis: 'x', seg: 16, tint })
      k.lathe('paint', [[0, 0], [0.0062, 0], [0.0062, 0.012], [0.0045, 0.014], [0, 0.014]], [0.064, y, z], { axis: 'x', seg: 16, tint })
      k.torus('paint', 0.004, 0.0012, [0.081, 0.0012, z], { seg: 6, segR: 14, tint })
    }
  },
  thermos: (k) => {

    const green: V3 = [0.26, 0.42, 0.3]
    k.lathe('paint', fillet2([[0, 0.004], [0.04, 0.004], [0.044, 0.008], [0.045, 0.02], [0.045, 0.2], [0.043, 0.218], [0.037, 0.228], [0.033, 0.232], [0, 0.232]], 0.003, 3), [0, 0, 0], { seg: 40, tint: green, wear: dents(0.0006, 400, 4) })
    k.lathe('steel', [[0, 0], [0.042, 0], [0.0458, 0.003], [0.0458, 0.016], [0.044, 0.018], [0, 0.018]], [0, 0, 0], { seg: 40, tint: STEEL })
    k.lathe('steel', [[0.04, 0.198], [0.0458, 0.199], [0.0458, 0.212], [0.042, 0.216]], [0, 0, 0], { seg: 40, tint: STEEL })
    k.lathe('paint', fillet2([[0, 0.226], [0.0465, 0.226], [0.0468, 0.232], [0.0468, 0.24], [0.0468, 0.248], [0.0468, 0.256], [0.0468, 0.29], [0.044, 0.298], [0, 0.299]], 0.002, 2), [0, 0, 0], { seg: 40, tint: green, wear: (x, yy, z) => (yy > 0.234 && yy < 0.258 ? knurl(40, 0.0008)(x, yy, z) : 0) })
    k.put(sweepRaw([[0.043, 0.07, 0], [0.06, 0.08, 0], [0.065, 0.13, 0], [0.06, 0.18, 0], [0.042, 0.19, 0]], 0.0055, { seg: 10 }), 'rubber', { tint: POLY })
    k.lathe('steel', [[0.0462, 0.11], [0.0462, 0.15]], [0, 0, 0], { seg: 40, arc: 0.8, phase: Math.PI / 2 - 0.4, tint: STEEL })
  },
  canteen: (k) => {

    const al: V3 = [0.72, 0.73, 0.75], olive: V3 = [0.36, 0.38, 0.24]
    k.put(loftRaw(easeStations([{ y: 0.003, rx: 0.05, rz: 0.024 }, { y: 0.01, rx: 0.058, rz: 0.028 }, { y: 0.15, rx: 0.058, rz: 0.028 }, { y: 0.172, rx: 0.042, rz: 0.022 }, { y: 0.185, rx: 0.017, rz: 0.016 }], 3), { seg: 36 }), 'steel', { tint: al })
    k.put(loftRaw(easeStations([{ y: 0, rx: 0.054, rz: 0.027 }, { y: 0.008, rx: 0.0605, rz: 0.0305 }, { y: 0.142, rx: 0.0605, rz: 0.0305 }], 2), { seg: 36, caps: 'bottom' }), 'fabric', { tint: olive })
    k.put(sweepRaw(ringPath(0.0605, 0.0305, 0.142, 36), 0.0018, { closed: true, seg: 6 }), 'fabric', { tint: [0.28, 0.3, 0.18] })
    k.lathe('steel', [[0, 0.18], [0.016, 0.18], [0.0135, 0.186], [0.0135, 0.196], [0, 0.196]], [0, 0, 0], { seg: 24, tint: al })
    k.lathe('paint', fillet2([[0, 0.19], [0.0168, 0.19], [0.0168, 0.194], [0.0168, 0.199], [0.0168, 0.205], [0.0152, 0.207], [0, 0.207]], 0.001, 2), [0, 0, 0], { seg: 28, tint: POLY, wear: (x, yy, z) => (yy > 0.192 && yy < 0.205 ? knurl(30, 0.0006)(x, yy, z) : 0) })
    k.put(sweepRaw([[0.0165, 0.199, 0], [0.022, 0.192, 0.004], [0.024, 0.182, 0.008], [0.02, 0.174, 0.012]], 0.0011, { seg: 6, radius: ribs(0.0024, 0.35) }), 'steel', { tint: al })
  },
  'clay-water-filter': (k) => {

    const clay: V3 = [0.78, 0.45, 0.3]
    k.lathe('brick', fillet2([[0, 0], [0.1, 0], [0.104, 0.006], [0.128, 0.05], [0.14, 0.11], [0.136, 0.17], [0.124, 0.205], [0.12, 0.214], [0.122, 0.222], [0, 0.222]], 0.004, 3), [0, 0, 0], { seg: 48, tint: clay })
    k.lathe('brick', fillet2([[0, 0.214], [0.112, 0.214], [0.118, 0.225], [0.124, 0.3], [0.121, 0.375], [0.127, 0.384], [0.127, 0.398], [0, 0.398]], 0.003, 3), [0, 0, 0], { seg: 48, tint: clay })
    k.lathe('brick', fillet2([[0, 0.396], [0.124, 0.396], [0.122, 0.405], [0.1, 0.418], [0.04, 0.428], [0.022, 0.432], [0.026, 0.44], [0.022, 0.448], [0, 0.45]], 0.003, 3), [0, 0, 0], { seg: 48, tint: clay })
    k.torus('brick', 0.1225, 0.0035, [0, 0.214, 0], { seg: 8, segR: 48, tint: [0.68, 0.37, 0.24] })
    k.torus('brick', 0.1395, 0.003, [0, 0.11, 0], { seg: 8, segR: 48, tint: [0.68, 0.37, 0.24] })
    k.cyl('steel', 0.008, 0.028, [0.134, 0.045, 0], { axis: 'x', seg: 16, tint: STEEL })
    k.cyl('steel', 0.0052, 0.016, [0.144, 0.033, 0], { seg: 14, tint: STEEL })
    k.box('steel', [0.022, 0.004, 0.008], [0.14, 0.0545, 0], { r: 0.0015, tint: STEEL })
  },
  'portable-water-filter': (k) => {
    const y = 0.0152, x0 = -0.1

    k.lathe('paint', [[0, 0], [0.0145, 0], [0.0145, 0.17], [0, 0.17]], [x0 + 0.015, y, 0], { axis: 'x', seg: 28, tint: [0.15, 0.45, 0.85] })
    k.lathe('paint', fillet2([[0, 0], [0.014, 0], [0.0152, 0.003], [0.0152, 0.018], [0, 0.018]], 0.001, 2), [x0, y, 0], { axis: 'x', seg: 28, tint: [0.1, 0.25, 0.55] })
    k.lathe('paint', fillet2([[0, 0], [0.0152, 0], [0.0152, 0.016], [0.012, 0.02], [0.007, 0.022], [0, 0.022]], 0.001, 2), [x0 + 0.182, y, 0], { axis: 'x', seg: 28, tint: [0.1, 0.25, 0.55] })
    k.lathe('paper', [[0.0157, 0.06], [0.0157, 0.13]], [x0, y, 0], { axis: 'x', seg: 28, tint: WHITE })
    k.put(sweepRaw([[x0 + 0.2, y, 0], [x0 + 0.21, y - 0.008, 0.003], [x0 + 0.222, 0.0016, 0.012], [x0 + 0.238, 0.0016, 0.014], [x0 + 0.245, 0.0016, 0], [x0 + 0.238, 0.0016, -0.014], [x0 + 0.222, 0.0016, -0.012], [x0 + 0.209, y - 0.009, -0.003], [x0 + 0.2, y - 0.002, -0.001]], 0.0015, { seg: 6 }), 'fabric', { tint: BLACK })
  },
  'camp-stove': (k) => {

    k.lathe('paint', fillet2([[0, 0.003], [0.05, 0.003], [0.054, 0], [0.0565, 0.004], [0.0565, 0.058], [0.05, 0.07], [0.03, 0.078], [0.013, 0.081], [0, 0.081]], 0.003, 3), [0, 0, 0], { seg: 40, tint: [0.2, 0.36, 0.72] })
    k.lathe('paper', [[0.0577, 0.012], [0.0577, 0.05]], [0, 0, 0], { seg: 40, tint: [0.95, 0.85, 0.3] })
    k.lathe('steel', fillet2([[0, 0.078], [0.0135, 0.078], [0.0135, 0.095], [0.011, 0.098], [0.008, 0.098], [0.008, 0.103], [0, 0.103]], 0.0008, 2), [0, 0, 0], { seg: 24, tint: BRASS })
    k.lathe('steel', fillet2([[0, 0.101], [0.012, 0.101], [0.026, 0.106], [0.027, 0.112], [0.022, 0.113], [0, 0.112]], 0.001, 2), [0, 0, 0], { seg: 32, tint: [0.5, 0.5, 0.52] })
    for (let i = 0; i < 3; i++) k.frame({ yaw: i * Math.PI * 2 / 3 + 0.3 }, () => k.extrude('steel', [[0.012, 0.099], [0.02, 0.097], [0.09, 0.112], [0.09, 0.118], [0.08, 0.115], [0.075, 0.119], [0.065, 0.116], [0.06, 0.12], [0.05, 0.117], [0.045, 0.121], [0.035, 0.118], [0.03, 0.115], [0.012, 0.106]], 0.0025, [0, 0, 0], { bevel: 0.0004, tint: [0.5, 0.5, 0.52] }))
    k.cyl('steel', 0.0022, 0.02, [0.0225, 0.088, 0], { axis: 'x', seg: 10, tint: BRASS })
    k.put(sweepRaw([[0.032, 0.088, 0], [0.04, 0.094, 0.01], [0.05, 0.092, 0.012], [0.054, 0.086, 0], [0.05, 0.08, -0.012], [0.04, 0.082, -0.01], [0.032, 0.088, 0]], 0.0016, { seg: 6 }), 'steel', { tint: STEEL })
  },
  compass: (k) => {

    k.lathe('steel', fillet2([[0, 0], [0.028, 0], [0.03, 0.002], [0.03, 0.005], [0.03, 0.008], [0.03, 0.012], [0.0285, 0.013], [0.026, 0.013], [0.026, 0.011], [0, 0.011]], 0.0006, 2), [0, 0, 0], { seg: 48, tint: BRASS, wear: (x, y, z) => (y > 0.003 && y < 0.011 ? knurl(60, 0.0005)(x, y, z) : 0) })
    k.cyl('paper', 0.0255, 0.0012, [0, 0.0114, 0], { seg: 40, tint: WHITE })
    k.put(merge(...[0, 1, 2, 3].map((i) => place(rboxRaw(0.0016, 0.0016, i === 0 ? 0.005 : 0.0035, { r: 0.0003 }), { at: [Math.sin(i * Math.PI / 2) * 0.021, 0.012, -Math.cos(i * Math.PI / 2) * 0.021], yaw: i * Math.PI / 2 }))), 'paint', { tint: BLACK })
    k.extrude('paint', [[0, -0.0018], [0.019, 0], [0, 0.0018]], 0.0008, [0, 0.0125, 0], { axis: 'y', yaw: Math.PI / 2, tint: RED })
    k.extrude('paint', [[0, -0.0018], [0, 0.0018], [-0.019, 0]], 0.0008, [0, 0.0125, 0], { axis: 'y', yaw: Math.PI / 2, tint: WHITE })
    k.cyl('steel', 0.0018, 0.0012, [0, 0.0126, 0], { seg: 12, tint: BRASS })
    k.cyl('glass', 0.0257, 0.0014, [0, 0.0137, 0], { seg: 40, tint: [0.85, 0.9, 0.92] })
    k.box('steel', [0.004, 0.003, 0.006], [0, 0.0065, -0.032], { r: 0.001, tint: BRASS })
    k.torus('steel', 0.0065, 0.0012, [0, 0.0012, -0.0405], { seg: 6, segR: 18, tint: BRASS })
  },
  binoculars: (k) => {

    const y = 0.0235, x0 = -0.075, armour: V3 = [0.15, 0.17, 0.15]
    const barrelP = fillet2([[0, 0.004], [0.0168, 0.004], [0.0168, 0], [0.019, 0], [0.019, 0.025], [0.0172, 0.03], [0.02, 0.036], [0.022, 0.046], [0.022, 0.124], [0.0235, 0.13], [0.0235, 0.15], [0.0208, 0.15], [0.0208, 0.1455], [0, 0.1455]], 0.001, 2)
    for (const s of [-1, 1]) {
      k.lathe('rubber', barrelP, [x0, y, s * 0.032], { axis: 'x', seg: 32, tint: armour })
      k.cyl('glass', 0.0161, 0.002, [x0 + 0.004, y, s * 0.032], { axis: 'x', seg: 24, tint: [0.35, 0.4, 0.55] })
      k.cyl('glass', 0.0201, 0.002, [x0 + 0.1455, y, s * 0.032], { axis: 'x', seg: 28, tint: [0.45, 0.35, 0.55] })
      k.torus('steel', 0.004, 0.0011, [x0 + 0.04, y, s * 0.0545], { axis: 'x', seg: 6, segR: 12, tint: BLACK })
    }
    for (const x of [x0 + 0.06, x0 + 0.12]) k.box('rubber', [0.022, 0.012, 0.05], [x, y + 0.004, 0], { r: 0.004, tint: armour })
    k.cyl('steel', 0.0075, 0.084, [x0 + 0.09, y + 0.006, 0], { axis: 'x', seg: 16, tint: BLACK })
    k.lathe('rubber', [[0, 0], [0.0104, 0], [0.0104, 0.004], [0.0104, 0.008], [0.0104, 0.012], [0.0104, 0.016], [0, 0.016]], [x0 + 0.032, y + 0.006, 0], { axis: 'x', seg: 28, tint: BLACK, wear: (x, yy, z) => (yy > 0.002 && yy < 0.014 ? knurl(28, 0.0006)(x, yy, z) : 0) })
  },
  whistle: (k) => {

    k.cyl('steel', 0.0095, 0.016, [0.01, 0.0095, 0], { axis: 'z', seg: 28, tint: STEEL })
    k.extrude('steel', rrect(0.015, 0.0075, 0.0025), 0.03, [-0.012, 0.0095, 0], { axis: 'x', holes: [rrect(0.011, 0.0028, 0.001)], bevel: 0.0006, tint: STEEL })
    k.box('steel', [0.006, 0.003, 0.004], [0.0195, 0.0035, 0], { r: 0.001, tint: STEEL })
    k.torus('steel', 0.006, 0.001, [0.0285, 0.001, 0], { seg: 6, segR: 16, tint: STEEL })
  },
  wristwatch: (k) => {

    const leather: V3 = [0.36, 0.22, 0.13], side = (pts: V2[]) => ribbon(pts.map(([z, yy]): V2 => [-z, yy]), 0.0025)
    k.extrude('leather', side([[0.019, 0.0085], [0.026, 0.0083], [0.0315, 0.006], [0.0325, 0.0035], [0.029, 0.00135], [0.015, 0.00125], [-0.03, 0.00125]]), 0.018, [0, 0, 0], { axis: 'x', bevel: 0.0005, tint: leather })
    k.extrude('leather', side([[-0.019, 0.0085], [-0.026, 0.0083], [-0.0315, 0.0062], [-0.0322, 0.0042], [-0.028, 0.0038], [-0.012, 0.00375], [0.014, 0.00375]]), 0.018, [0, 0, 0], { axis: 'x', bevel: 0.0005, tint: leather })
    k.lathe('steel', fillet2([[0, 0], [0.0175, 0], [0.019, 0.0015], [0.019, 0.0055], [0.0182, 0.0072], [0.0165, 0.0076], [0.0165, 0.0058], [0, 0.0058]], 0.0005, 2), [0, 0.005, 0], { seg: 40, tint: STEEL })
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('steel', [0.004, 0.004, 0.009], [sx * 0.0075, 0.0085, sz * 0.0195], { r: 0.0012, tint: STEEL })
    k.cyl('paint', 0.0158, 0.001, [0, 0.0113, 0], { seg: 40, tint: [0.1, 0.1, 0.11] })
    k.put(merge(...Array.from({ length: 12 }, (_, i) => place(rboxRaw(0.0012, 0.0012, i % 3 ? 0.002 : 0.0032, { r: 0.0002 }), { at: [Math.sin(i * Math.PI / 6) * 0.0128, 0.0119, Math.cos(i * Math.PI / 6) * 0.0128], yaw: i * Math.PI / 6 }))), 'paint', { tint: WHITE })
    for (const [len, wid, a] of [[0.009, 0.0016, 2.4], [0.013, 0.0012, -0.6]]) k.box('paint', [wid, 0.0006, len], [Math.sin(a) * len / 2, 0.0128, Math.cos(a) * len / 2], { yaw: a, r: 0.0002, tint: WHITE })
    k.cyl('glass', 0.0162, 0.0022, [0, 0.0135, 0], { seg: 40, tint: [0.88, 0.92, 0.94] })
    k.frame({ at: [0.0186, 0.0085, 0] }, () => k.lathe('steel', [[0, 0], [0.0024, 0], [0.0024, 0.0012], [0.0024, 0.0024], [0.0018, 0.0035], [0, 0.0036]], [0, 0, 0], { axis: 'x', seg: 16, tint: STEEL, wear: knurl(14, 0.0003) }))
  },
  'gold-jewelry': (k) => {

    const chain: V3[] = []
    for (let i = 0; i <= 90; i++) { const t = i / 90, a = t * Math.PI * 4.2, r = 0.022 - 0.012 * t; chain.push([-0.008 + Math.cos(a) * r, 0.0011, Math.sin(a) * r * 0.85]) }
    k.put(sweepRaw(chain, 0.0011, { seg: 6, radius: ribs(0.0024, 0.35) }), 'steel', { tint: GOLD })
    k.torus('steel', 0.0022, 0.0007, [0.0162, 0.0007, -0.0012], { seg: 6, segR: 12, tint: GOLD })
    k.lathe('steel', [[0, 0], [0.0068, 0], [0.007, 0.0008], [0.0066, 0.0018], [0, 0.0019]], [-0.008, 0, 0], { seg: 28, tint: GOLD })
    k.torus('steel', 0.0048, 0.0004, [-0.008, 0.0018, 0], { seg: 5, segR: 24, tint: GOLD })
    k.torus('steel', 0.0016, 0.0005, [-0.0025, 0.0006, 0.0055], { seg: 5, segR: 10, tint: GOLD })
    k.torus('steel', 0.0095, 0.0018, [0.021, 0.0018, 0.012], { seg: 8, segR: 28, tint: GOLD })
    k.box('steel', [0.008, 0.0036, 0.004], [0.021, 0.0018, 0.0228], { r: 0.0012, tint: GOLD })
    k.torus('steel', 0.0085, 0.0013, [0.022, 0.0013, -0.013], { seg: 8, segR: 28, tint: GOLD })
    k.sphere('glass', 0.0028, [0.0337, 0.0028, -0.013], { rows: 6, seg: 12, tint: [0.75, 0.05, 0.12] })
  },
  cigarettes: (k) => {

    const w = 0.055, d = 0.022, hb = 0.07, hl = 0.018, red: V3 = [0.8, 0.12, 0.1]
    k.box('paper', [w, hb, d], [0, hb / 2, 0], { r: 0.0008, tint: WHITE })
    k.box('paper', [0.042, 0.03, 0.0012], [0, 0.044, d / 2 + 0.0004], { r: 0.0003, tint: red })
    k.box('paper', [0.046, 0.034, 0.0012], [0, 0.03, -d / 2 - 0.0004], { r: 0.0003, tint: [0.12, 0.12, 0.12] })
    k.box('steel', [w - 0.003, 0.0078, 0.0012], [0, hb + 0.0041, d / 2 - 0.0012], { r: 0.0003, tint: [0.85, 0.85, 0.82] })
    const filters: Raw[] = [], tip = () => latheRaw([[0, 0], [0.0034, 0], [0.0034, 0.0135], [0.0031, 0.014], [0, 0.014]], { seg: 12 })
    for (const [row, z] of [-0.0058, 0, 0.0058].entries()) for (let i = 0; i < (row === 1 ? 6 : 7); i++) filters.push(place(tip(), { at: [(row === 1 ? -0.019 : -0.0228) + i * 0.0076, hb - 0.005, z] }))
    k.put(merge(...filters), 'paper', { tint: [0.86, 0.6, 0.32] })
    k.frame({ at: [0, hb, -d / 2], pitch: -1.75 }, () => {
      k.box('paper', [w, 0.0012, d], [0, hl - 0.0006, d / 2], { r: 0.0004, tint: red })
      k.extrude('paper', rrect(w, d, 0.0008), hl - 0.0012, [0, (hl - 0.0012) / 2, d / 2], { axis: 'y', holes: [rrect(w - 0.0016, d - 0.0016, 0.0004)], bevel: 0.0002, tint: red })
    })
  },
  'loose-keys': (k) => {

    const C: V2 = [-0.022, 0], R = 0.009
    const keys: { len: number; cuts: number[]; a: number; y: number; tilt: number; tint: V3 }[] = [
      { len: 0.05, cuts: [0.0012, 0.0004, 0.0016, 0.0008, 0.0014], a: 0.25, y: 0.001, tilt: 0, tint: BRASS },
      { len: 0.045, cuts: [0.0006, 0.0015, 0.001, 0.0018], a: -0.42, y: 0.003, tilt: 0.042, tint: [0.78, 0.79, 0.82] },
    ]
    for (const key of keys) k.frame({ at: [C[0] + (R + 0.006) * Math.cos(key.a), key.y, C[1] - (R + 0.006) * Math.sin(key.a)], yaw: key.a }, () => k.frame({ roll: -key.tilt }, () => k.extrude('steel', keyOutline(key.len, key.cuts), 0.002, [0, 0, 0], { axis: 'y', bevel: 0.0003, holes: [circle(0.0026, 14, -0.006, 0)], tint: key.tint })))
    k.frame({ at: [C[0] - (R + 0.012), 0.001, C[1]], yaw: Math.PI }, () => k.extrude('paint', rrect(0.034, 0.015, 0.004, 3, 0.001, 0), 0.002, [0, 0, 0], { axis: 'y', bevel: 0.0004, holes: [circle(0.0022, 12, -0.012, 0)], tint: [0.95, 0.75, 0.1] }))
    k.torus('steel', R, 0.0009, [C[0], 0.0049, C[1]], { seg: 6, segR: 28, tint: STEEL })
  },
  mirror: (k) => {

    k.extrude('wood', rrect(0.3, 0.4, 0.004), 0.014, [0, 0.007, 0], { axis: 'y', holes: [rrect(0.24, 0.34, 0.002)], bevel: 0.0035, bevelSeg: 3, tint: [0.42, 0.26, 0.15] })
    k.extrude('steel', rrect(0.254, 0.354, 0.003), 0.003, [0, 0.0155, 0], { axis: 'y', holes: [rrect(0.24, 0.34, 0.002)], bevel: 0.001, tint: GOLD })
    k.box('steel', [0.244, 0.002, 0.344], [0, 0.0045, 0], { r: 0.0005, tint: [0.92, 0.93, 0.95] })
    k.box('glass', [0.246, 0.003, 0.346], [0, 0.006, 0], { r: 0.0005, tint: [0.78, 0.84, 0.86] })
  },
  'duffel-bag': (k) => {

    const navy: V3 = [0.16, 0.22, 0.36], dark: V3 = [0.1, 0.13, 0.22], rx = 0.128, rz = 0.138, yc = rx, L = 0.27
    const st: Station[] = [{ y: -L - 0.008, rx: rx * 0.72, rz: rz * 0.72 }, { y: -L, rx: rx * 0.95, rz: rz * 0.95 }, { y: -L + 0.012, rx, rz }, { y: L - 0.012, rx, rz }, { y: L, rx: rx * 0.95, rz: rz * 0.95 }, { y: L + 0.008, rx: rx * 0.72, rz: rz * 0.72 }]

    const sag = dents(0.003, 25, 3), wear = (x: number, y: number, z: number) => sag(x, y, z) * Math.min(1, Math.max(0, (x + 0.9 * rx) / (0.3 * rx)))
    k.put(place(loftRaw(easeStations(st, 3), { seg: 40, wear }), { at: [0, yc, 0], roll: -Math.PI / 2 }), 'fabric', { tint: navy })
    for (const s of [-1, 1]) k.put(sweepRaw(Array.from({ length: 36 }, (_, i): V3 => { const a = i / 36 * Math.PI * 2; return [s * L, yc + Math.sin(a) * rx * 0.95, Math.cos(a) * rz * 0.95] }), 0.004, { closed: true, seg: 6 }), 'fabric', { tint: dark })
    k.box('fabric', [0.42, 0.002, 0.016], [0, yc + rx + 0.0004, 0], { r: 0.0005, tint: dark })
    k.put(sweepRaw([[-0.2, yc + rx + 0.0016, 0], [0.2, yc + rx + 0.0016, 0]], 0.0022, { seg: 6, radius: ribs(0.003, 0.3) }), 'rubber', { tint: POLY })
    k.box('steel', [0.016, 0.003, 0.008], [0.15, yc + rx + 0.004, 0], { r: 0.001, tint: STEEL })
    for (const s of [-1, 1]) k.put(sweepRaw(Array.from({ length: 15 }, (_, i): V3 => {
      const a = Math.PI * i / 14, z = -Math.cos(a) * 0.095, base = yc + rx * Math.sqrt(Math.max(0, 1 - (z / rz) ** 2)) - 0.004
      return [s * (0.07 - 0.055 * Math.sin(a)), base + Math.sin(a) * 0.065, z]
    }), 0.0065, { seg: 8 }), 'fabric', { tint: dark })
    k.lathe('fabric', fillet2([[0, 0], [0.013, 0], [0.014, 0.01], [0.014, 0.06], [0.013, 0.07], [0, 0.07]], 0.004, 2), [-0.035, yc + rx - 0.004 + 0.065, 0], { axis: 'x', seg: 18, tint: navy })
  },
  'lockpick-set': (k) => {

    const brown: V3 = [0.36, 0.22, 0.13], top = 0.004
    for (const s of [-1, 1]) {
      k.box('leather', [0.12, top, 0.0285], [0, top / 2, s * 0.01475], { r: 0.0015, tint: brown })
      k.put(sweepRaw(rrectPath(0.11, 0.021, 0.003, top).map(([x, yy, z]): V3 => [x, yy, z + s * 0.01475]), 0.0005, { closed: true, seg: 4, radius: ribs(0.003, 0.4) }), 'fabric', { tint: [0.85, 0.78, 0.6] })
    }
    k.cyl('leather', 0.0022, 0.12, [0, 0.0022, 0], { axis: 'x', seg: 10, tint: brown })
    const tips: V2[][] = [
      [[0.004, -0.0006], [0.006, 0.0022], [0.0048, 0.0026], [0.0035, 0.0006]],
      [[0.002, 0.0018], [0.004, 0.0006], [0.006, 0.0018], [0.008, 0.0006], [0.01, 0.0018], [0.011, 0.0006]],
      [[0.002, -0.0006], [0.004, 0.0022], [0.006, 0.0006]],
      [[0.0015, 0.0012], [0.0035, 0.0026], [0.0055, 0.0012], [0.006, 0.0006]],
    ]
    for (const [i, tip] of tips.entries()) {
      const z = 0.006 + i * 0.0068
      k.extrude('steel', pickOutline(0.0605, tip), 0.0008, [-0.0135, top + 0.0003, z], { axis: 'y', bevel: 0.0001, tint: STEEL })
      k.extrude('rubber', rrect(0.045, 0.0062, 0.002), 0.0026, [-0.0335, top + 0.0012, z], { axis: 'y', bevel: 0.0006, tint: i % 2 ? [0.15, 0.3, 0.6] : POLY })
    }
    k.box('fabric', [0.008, 0.0016, 0.027], [-0.03, top + 0.0032, 0.0162], { r: 0.0004, tint: [0.1, 0.1, 0.1] })
    for (const [i, z] of [-0.01, -0.02].entries()) k.extrude('steel', ribbon([[-0.045, 0], [0.03 - i * 0.01, 0], [0.034 - i * 0.01, 0.006]], 0.0022), 0.001, [0, top + 0.0004, z], { axis: 'y', bevel: 0.0002, tint: [0.3, 0.3, 0.32] })
  },
}
