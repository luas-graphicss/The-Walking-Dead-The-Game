import { latheRaw, rboxRaw, type Kit, type Mat, type V2, type V3 } from '../../blockout/sculpt/kit'
import { atEnd, carton, coil } from './archetypes'
import { circle, fillet2, knurl, loftRaw, merge, place, ringPath, rrect, shade, sweepRaw, type ResourceFamily, type Station } from './forms'

const TAU = Math.PI * 2
const BLACK: V3 = [0.14, 0.14, 0.15], DARK: V3 = [0.22, 0.22, 0.24], WHITE: V3 = [0.94, 0.94, 0.92], ALU: V3 = [0.86, 0.87, 0.89]
const RED: V3 = [0.82, 0.14, 0.1], COPPER: V3 = [1, 0.62, 0.42], LEAD: V3 = [0.6, 0.6, 0.63], GREEN_PCB: V3 = [0.12, 0.42, 0.2]

function boxes(k: Kit, m: Mat, list: { size: V3; at: V3; r?: number; yaw?: number }[], o: { tint?: V3 } = {}) {
  k.put(merge(...list.map((b) => place(rboxRaw(b.size[0], b.size[1], b.size[2], { r: b.r ?? Math.min(...b.size) * 0.2 }), { at: b.at, yaw: b.yaw }))), m, { tint: o.tint })
}

function knob(k: Kit, r: number, h: number, at: V3, o: { tint?: V3; axis?: 'x' | 'y' | 'z' } = {}) {
  k.lathe('paint', fillet2([[0, 0], [r, 0], [r, h * 0.8], [r * 0.85, h], [0, h]], Math.min(0.001, r * 0.2), 2), at, { seg: 20, axis: o.axis, tint: o.tint ?? BLACK, wear: knurl(18, Math.min(0.0005, r * 0.06), r * 0.9) })
}

function post(k: Kit, at: V3, h: number) {
  k.cyl('charcoal', 0.016, 0.006, [at[0], at[1] + 0.003, at[2]], { seg: 20, tint: DARK })
  k.lathe('steel', [[0, 0], [0.0098, 0], [0.0082, h], [0, h]], [at[0], at[1] + 0.005, at[2]], { seg: 18, tint: LEAD })
}

export const ELECTRIC: ResourceFamily = {
  'car-battery': (k) => {
    k.box('charcoal', [0.24, 0.165, 0.165], [0, 0.0825, 0], { r: 0.006, tint: BLACK })
    k.box('charcoal', [0.244, 0.018, 0.169], [0, 0.174, 0], { r: 0.004, tint: DARK })
    post(k, [-0.085, 0.183, 0.05], 0.02)
    post(k, [0.085, 0.183, 0.05], 0.02)

    k.lathe('paint', fillet2([[0, 0], [0.013, 0], [0.013, 0.018], [0.0115, 0.02], [0, 0.02]], 0.002, 2), [0.05, 0.183 + 0.013, -0.005], { axis: 'x', seg: 18, tint: RED })
    boxes(k, 'charcoal', Array.from({ length: 6 }, (_, i) => ({ size: [0.022, 0.003, 0.022] as V3, at: [-0.0675 + i * 0.027, 0.1845, -0.035] as V3, r: 0.004 })), { tint: [0.28, 0.28, 0.3] })
    k.put(sweepRaw([[-0.118, 0.174, 0], [-0.108, 0.187, -0.03], [-0.06, 0.1872, -0.06], [0.06, 0.1872, -0.06], [0.108, 0.187, -0.03], [0.118, 0.174, 0]], 0.0042, { seg: 8 }), 'charcoal', { tint: BLACK })
    k.cyl('glass', 0.007, 0.002, [0, 0.184, 0.045], { seg: 16, tint: [0.2, 0.75, 0.3] })
    k.box('paper', [0.19, 0.11, 0.0012], [0, 0.085, 0.0831], { r: 0, tint: [0.95, 0.75, 0.12] })
    k.box('paper', [0.17, 0.035, 0.0012], [0, 0.1, 0.0843], { r: 0, tint: BLACK })
  },
  'ups-battery': (k) => {
    k.box('charcoal', [0.151, 0.088, 0.065], [0, 0.044, 0], { r: 0.003, tint: BLACK })
    k.box('charcoal', [0.153, 0.007, 0.067], [0, 0.0915, 0], { r: 0.002, tint: DARK })
    for (const [x, tint] of [[-0.062, BLACK], [0.062, RED]] as const) {
      k.box('steel', [0.0064, 0.008, 0.0008], [x, 0.099, 0.018], { r: 0.0002, tint: ALU })
      k.box('paint', [0.012, 0.004, 0.008], [x, 0.097, 0.018], { r: 0.001, tint })
    }
    k.box('paper', [0.13, 0.07, 0.0012], [0, 0.046, 0.0331], { r: 0, tint: [0.92, 0.92, 0.9] })
    k.box('paper', [0.13, 0.016, 0.0012], [0, 0.068, 0.0343], { r: 0, tint: [0.15, 0.4, 0.75] })
  },
  'solar-panel': (k) => {

    const W = 0.576, D = 0.426, cols = 6, rows = 4, cw = W / cols, cd = D / rows
    k.extrude('steel', rrect(0.6, 0.45, 0.004, 2), 0.025, [0, 0.0125, 0], { axis: 'y', holes: [rrect(W, D, 0.002, 2)], bevel: 0.0008, tint: ALU })
    k.box('paint', [W, 0.004, D], [0, 0.014, 0], { r: 0, tint: WHITE })
    boxes(k, 'paint', Array.from({ length: cols * rows }, (_, i) => ({ size: [cw - 0.004, 0.0012, cd - 0.004] as V3, at: [-W / 2 + cw * ((i % cols) + 0.5), 0.0166, -D / 2 + cd * (Math.floor(i / cols) + 0.5)] as V3, r: 0.0003 })), { tint: [0.1, 0.16, 0.36] })
    boxes(k, 'steel', Array.from({ length: cols * 2 }, (_, i) => ({ size: [0.0016, 0.0008, D - 0.01] as V3, at: [-W / 2 + cw * (Math.floor(i / 2) + (i % 2 ? 0.68 : 0.32)), 0.0176, 0] as V3, r: 0 })), { tint: [0.85, 0.86, 0.88] })
    k.box('glass', [W - 0.001, 0.0032, D - 0.001], [0, 0.0198, 0], { r: 0, tint: [0.85, 0.92, 0.95] })
  },
  'led-bulbs': (k) => {
    carton(k, 0.064, 0.112, 0.064, { tint: WHITE, prints: [{ face: 'front', w: 0.054, h: 0.06, tint: [0.15, 0.4, 0.78] }, { face: 'front', w: 0.04, h: 0.012, y: 0.095, tint: [0.98, 0.78, 0.15] }, { face: 'right', w: 0.05, h: 0.05, tint: [0.15, 0.4, 0.78] }] })

    const at: V3 = [-0.045, 0.1135 + 0.024, 0]
    k.lathe('steel', [[0, 0], [0.004, 0], [0.004, 0.003], [0.0128, 0.004], [0.0128, 0.024], [0, 0.024]], at, { axis: 'x', seg: 20, tint: ALU, wear: (x) => (x > 0.004 && x < 0.023 ? Math.max(0, Math.sin(x * 1600)) * 0.0009 : 0) })
    k.lathe('paint', fillet2([[0, 0.023], [0.0135, 0.023], [0.0215, 0.042], [0.0235, 0.05], [0, 0.05]], 0.002, 2), at, { axis: 'x', seg: 28, tint: WHITE })
    k.lathe('glass', fillet2([[0, 0.049], [0.0236, 0.049], [0.024, 0.062], [0.018, 0.08], [0, 0.086]], 0.004, 3), at, { axis: 'x', seg: 28, tint: [0.97, 0.97, 0.95] })
  },
  'portable-radio': (k) => {
    k.box('paint', [0.19, 0.11, 0.055], [0, 0.055, 0], { r: 0.012, tint: [0.75, 0.75, 0.78] })
    boxes(k, 'steel', Array.from({ length: 13 }, (_, i) => ({ size: [0.078, 0.0026, 0.0016] as V3, at: [-0.043, 0.022 + i * 0.0055, 0.0283] as V3, r: 0.0006 })), { tint: [0.35, 0.35, 0.37] })
    k.box('glass', [0.07, 0.026, 0.0016], [0.046, 0.074, 0.0283], { r: 0.001, tint: [0.25, 0.22, 0.12] })
    k.box('paint', [0.0012, 0.022, 0.0012], [0.035, 0.074, 0.0297], { r: 0, tint: RED })
    knob(k, 0.011, 0.008, [0.03, 0.032, 0.0275], { axis: 'z' })
    knob(k, 0.011, 0.008, [0.065, 0.032, 0.0275], { axis: 'z' })

    k.sphere('steel', 0.0055, [0.083, 0.1125, -0.016], { rows: 6, seg: 10, tint: ALU })
    k.lathe('steel', [[0, 0], [0.0042, 0], [0.0042, 0.06], [0.0034, 0.062], [0.0034, 0.11], [0.0026, 0.112], [0.0026, 0.15], [0.0032, 0.152], [0.0032, 0.156], [0, 0.157]], [0.081, 0.1142, -0.016], { axis: 'x', roll: Math.PI, seg: 10, tint: ALU })
    k.put(sweepRaw([[-0.07, 0.106, 0], [-0.065, 0.13, 0], [-0.04, 0.136, 0], [0.04, 0.136, 0], [0.065, 0.13, 0], [0.07, 0.106, 0]], 0.0045, { seg: 8 }), 'paint', { tint: BLACK })
  },
  'walkie-talkie': (k) => {
    const keys: Station[] = [{ y: 0, rx: 0.027, rz: 0.017, p: 4 }, { y: 0.004, rx: 0.029, rz: 0.018, p: 4 }, { y: 0.11, rx: 0.029, rz: 0.018, p: 4 }, { y: 0.125, rx: 0.026, rz: 0.016, p: 4 }]
    k.put(loftRaw(keys, { seg: 36 }), 'charcoal', { tint: BLACK })
    k.lathe('rubber', fillet2([[0, 0.12], [0.0068, 0.12], [0.0068, 0.13], [0.005, 0.15], [0.0042, 0.172], [0, 0.176]], 0.0015, 2), [-0.014, 0, 0], { seg: 14, tint: BLACK })
    knob(k, 0.0065, 0.012, [0.012, 0.123, -0.003], { tint: DARK })
    boxes(k, 'charcoal', Array.from({ length: 7 }, (_, i) => ({ size: [0.032, 0.0018, 0.0014] as V3, at: [0, 0.03 + i * 0.0045, 0.0185] as V3, r: 0.0005 })), { tint: DARK })
    k.box('glass', [0.028, 0.014, 0.0014], [0, 0.085, 0.0184], { r: 0.001, tint: [0.35, 0.42, 0.32] })
    k.box('rubber', [0.0035, 0.03, 0.012], [-0.0302, 0.075, 0], { r: 0.0015, tint: DARK })
    k.extrude('steel', [[-0.012, 0], [0.012, 0], [0.012, 0.055], [0.008, 0.06], [-0.008, 0.06], [-0.012, 0.055]], 0.0015, [0, 0.05, -0.0195], { bevel: 0.0004, tint: BLACK })
  },
  'circuit-board': (k) => {
    const t = 0.0016, top = t + 0.0001
    k.extrude('paint', rrect(0.148, 0.098, 0.003, 2), t, [0, t / 2, 0], { axis: 'y', holes: [[-0.068, -0.043], [0.068, -0.043], [-0.068, 0.043], [0.068, 0.043]].map(([x, y]) => circle(0.0018, 10, x, y)), bevel: 0.0002, tint: GREEN_PCB })
    boxes(k, 'charcoal', [{ size: [0.02, 0.004, 0.0075], at: [-0.035, top + 0.002, -0.02] }, { size: [0.026, 0.004, 0.0075], at: [-0.03, top + 0.002, 0.012] }, { size: [0.014, 0.0018, 0.014], at: [0.01, top + 0.0009, 0.02], r: 0.0004 }], { tint: BLACK })
    boxes(k, 'steel', [-0.035, -0.03].flatMap((cx, j) => Array.from({ length: j ? 10 : 8 }, (_, i) => [-1, 1].map((s) => ({ size: [0.0006, 0.003, 0.0016] as V3, at: [cx - (j ? 0.0115 : 0.0085) + i * 0.0025, top + 0.0012, (j ? 0.012 : -0.02) + s * 0.0045] as V3, r: 0 }))).flat()), { tint: ALU })
    for (const [x, z] of [[0.045, -0.03], [0.055, -0.01], [0.04, 0.035], [-0.06, 0.03]] as const) {
      k.lathe('paint', fillet2([[0, top], [0.004, top], [0.004, top + 0.011], [0, top + 0.011]], 0.0006, 2), [x, 0, z], { seg: 16, tint: [0.15, 0.25, 0.6] })
      k.cyl('steel', 0.0034, 0.001, [x, top + 0.0113, z], { seg: 14, tint: ALU })
    }
    k.put(merge(...Array.from({ length: 6 }, (_, i) => place(latheRaw([[0, -0.003], [0.0012, -0.003], [0.0013, 0], [0.0012, 0.003], [0, 0.003]], { seg: 10 }), { at: [0.005 + i * 0.006, top + 0.0013, -0.03], roll: Math.PI / 2 }))), 'paint', { tint: [0.85, 0.75, 0.55] })
    const fins: V2[] = [[-0.01, 0]]
    for (let i = 0; i < 6; i++) fins.push([-0.01 + i * 0.004, 0.012], [-0.0085 + i * 0.004, 0.012], [-0.0085 + i * 0.004, 0.003], [-0.006 + i * 0.004, 0.003])
    fins.splice(fins.length - 2, 2, [0.0115, 0])
    k.extrude('steel', fins, 0.015, [-0.002, top, -0.005], { bevel: 0.0002, tint: BLACK })
    boxes(k, 'paint', [{ size: [0.016, 0.008, 0.0055], at: [0.06, top + 0.004, 0.02] }, { size: [0.022, 0.0085, 0.006], at: [-0.045, top + 0.00425, 0.04] }], { tint: WHITE })
    boxes(k, 'steel', Array.from({ length: 5 }, (_, i) => ({ size: [0.012 + i * 0.004, 0.0008, 0.0007] as V3, at: [0.02, top + 0.0004, -0.008 + i * 0.002] as V3, r: 0 })), { tint: COPPER })
  },
  'small-motor': (k) => {
    k.box('steel', [0.1, 0.004, 0.06], [0, 0.002, 0], { r: 0.0012, tint: [0.4, 0.4, 0.42] })
    k.lathe('steel', fillet2([[0, 0.004], [0.044, 0.004], [0.044, 0.016], [0.042, 0.018], [0, 0.018]], 0.002, 2), [0, 0, 0], { seg: 40, tint: [0.3, 0.32, 0.34] })
    k.lathe('steel', [[0, 0.017], [0.041, 0.017], [0.041, 0.088], [0, 0.088]], [0, 0, 0], { seg: 48, tint: [0.25, 0.27, 0.3], wear: knurl(24, 0.0018, 0.03) })
    k.lathe('steel', fillet2([[0, 0.087], [0.043, 0.087], [0.043, 0.096], [0.014, 0.1], [0.012, 0.106], [0, 0.106]], 0.002, 2), [0, 0, 0], { seg: 40, tint: [0.3, 0.32, 0.34] })
    k.cyl('steel', 0.004, 0.012, [0, 0.111, 0], { seg: 12, tint: ALU })
    k.lathe('steel', [[0, 0.108], [0.012, 0.108], [0.012, 0.11], [0.008, 0.113], [0.012, 0.116], [0.012, 0.118], [0, 0.118]], [0, 0, 0], { seg: 20, tint: [0.75, 0.62, 0.35] })
    k.box('paint', [0.022, 0.024, 0.018], [0.047, 0.05, 0], { r: 0.003, tint: BLACK })
    for (const [dz, tint] of [[-0.004, RED], [0.004, BLACK]] as const) k.put(sweepRaw([[0.058, 0.045, dz], [0.068, 0.03, dz * 2], [0.072, 0.0016, dz * 4], [0.07, 0.0016, 0.03 + dz], [0.05, 0.0016, 0.045]], 0.0016, { seg: 6 }), 'rubber', { tint })
  },
  'power-cable': (k) => {
    const pts = coil(k, 'rubber', 0.112, 0.0062, 5.6, { tint: BLACK, tails: 0.06, seed: 9, ties: { tint: WHITE, count: 2 } })

    atEnd(k, pts, () => {
      for (const [x, z, tint] of [[-0.0028, 0, [0.2, 0.35, 0.75]], [0.0028, 0, [0.5, 0.32, 0.18]], [0, 0.0026, [0.35, 0.65, 0.25]]] as const) {
        k.put(sweepRaw([[x, 0, z], [x * 1.6, 0.025, z], [x * 2.6, 0.04, z]], 0.0018, { seg: 6 }), 'rubber', { tint: tint as V3 })
        k.cyl('steel', 0.0011, 0.012, [x * 2.6, 0.046, z], { seg: 8, tint: COPPER })
      }
    })
  },
  'extension-cord': (k) => {
    const orange: V3 = [0.95, 0.5, 0.12], r = 0.0042, pts = coil(k, 'rubber', 0.07, r, 3.8, { tint: orange, tails: 0.045, seed: 5 })
    atEnd(k, pts, () => {
      k.lathe('paint', fillet2([[0, -0.004], [0.006, -0.004], [0.011, 0.012], [0.012, 0.03], [0, 0.03]], 0.002, 2), [0, 0, -0.006], { seg: 18, tint: BLACK })
      for (const x of [-0.0048, 0.0048]) k.cyl('steel', 0.002, 0.018, [x, 0.038, -0.006], { seg: 10, tint: ALU })
    })

    atEnd(k, [...pts].reverse(), () => {
      k.box('paint', [0.036, 0.08, 0.028], [0, 0.046, -(0.014 - r)], { r: 0.006, tint: WHITE })
      boxes(k, 'paint', [0.02, 0.046, 0.072].map((y) => ({ size: [0.024, 0.024, 0.0014] as V3, at: [0, y, -(0.028 - r + 0.0007)] as V3, r: 0.004 })), { tint: [0.85, 0.85, 0.83] })
    })
  },
  'fuses-breakers': (k) => {

    const prof: V2[] = [[-0.0425, 0.035], [0.0425, 0.035], [0.0425, -0.01], [0.03, -0.012], [0.022, -0.035], [-0.022, -0.035], [-0.03, -0.012], [-0.0425, -0.01]]

    for (const [i, yaw] of [[0, 0], [1, 0.08]] as const) k.frame({ at: [0, i * 0.0192, 0], yaw }, () => {
      k.extrude('paint', fillet2(prof, 0.0015, 2, true), 0.0178, [0, 0.0089, -0.004], { axis: 'y', bevel: 0.0006, tint: WHITE })
      k.box('paint', [0.008, 0.009, 0.012], [0, 0.0089, 0.0345], { r: 0.0015, tint: i ? [0.15, 0.35, 0.75] : BLACK })
      k.box('paper', [0.03, 0.0008, 0.022], [-0.015, 0.0182, -0.012], { r: 0, tint: i ? [0.9, 0.9, 0.88] : [0.95, 0.85, 0.2] })
    })
    for (let i = 0; i < 3; i++) k.frame({ at: [0.01 - i * 0.012, 0.0382 + 0.0026, 0.012 - i * 0.004], yaw: 0.3 * i }, () => {
      k.cyl('glass', 0.0024, 0.015, [0, 0, 0], { axis: 'x', seg: 10, tint: [0.92, 0.95, 0.95] })
      for (const s of [-1, 1]) k.cyl('steel', 0.0026, 0.0045, [s * 0.008, 0, 0], { axis: 'x', seg: 10, tint: ALU })
    })
  },
  'power-inverter': (k) => {

    const outline: V2[] = [[-0.06, 0], [0.06, 0], [0.06, 0.04]], fin = 0.0024, n = 11, pitch = 0.12 / n
    for (let i = n - 1; i >= 0; i--) { const z = -0.06 + i * pitch; outline.push([z + pitch / 2 + fin / 2, 0.04], [z + pitch / 2 + fin / 2, 0.062], [z + pitch / 2 - fin / 2, 0.062], [z + pitch / 2 - fin / 2, 0.04]) }
    outline.push([-0.06, 0.04])
    k.extrude('steel', outline, 0.16, [0, 0, 0], { axis: 'x', bevel: 0.0004, tint: [0.75, 0.76, 0.78] })
    for (const s of [-1, 1]) k.box('paint', [0.016, 0.062, 0.122], [s * 0.088, 0.031, 0], { r: 0.004, tint: BLACK })
    boxes(k, 'paint', [-0.03, 0.03].map((z) => ({ size: [0.0014, 0.03, 0.026] as V3, at: [0.0967, 0.03, z] as V3, r: 0.004 })), { tint: [0.9, 0.9, 0.88] })
    k.box('paint', [0.004, 0.012, 0.008], [0.0975, 0.052, 0], { r: 0.001, tint: RED })
    for (const [z, tint] of [[-0.03, RED], [0.03, BLACK]] as const) { k.cyl('paint', 0.008, 0.014, [-0.103, 0.03, z], { axis: 'x', seg: 14, tint }); k.cyl('steel', 0.003, 0.01, [-0.112, 0.03, z], { axis: 'x', seg: 10, tint: COPPER }) }
  },
  'usb-charger': (k) => {
    k.box('paint', [0.042, 0.024, 0.03], [-0.025, 0.012, 0], { r: 0.004, tint: WHITE })
    for (const z of [-0.0095, 0.0095]) k.cyl('steel', 0.002, 0.018, [-0.054, 0.012, z], { axis: 'x', seg: 10, tint: ALU })
    k.box('paint', [0.0012, 0.005, 0.012], [-0.0036, 0.012, 0], { r: 0.0006, tint: BLACK })
    const pts = coil(k, 'rubber', 0.022, 0.0018, 3, { at: [0.028, 0, 0], tint: WHITE, tails: 0.02, seed: 2 })
    k.frame({ at: [0.028, 0, 0] }, () => atEnd(k, pts, () => {
      k.box('paint', [0.011, 0.022, 0.0065], [0, 0.011, -(0.00325 - 0.0018)], { r: 0.0015, tint: WHITE })
      k.box('steel', [0.0084, 0.0065, 0.0026], [0, 0.0252, -(0.00325 - 0.0018)], { r: 0.001, tint: ALU })
    }))
  },
  smartphone: (k) => {
    k.extrude('paint', rrect(0.074, 0.15, 0.01, 4), 0.0085, [0, 0.00425, 0], { axis: 'y', bevel: 0.0016, bevelSeg: 3, tint: [0.25, 0.26, 0.28] })
    k.box('glass', [0.07, 0.0008, 0.146], [0, 0.0089, 0], { r: 0.0004, tint: [0.06, 0.06, 0.08] })
    const crack: V3[][] = [[[0.012, 0.0095, 0.02], [0.02, 0.0095, 0.035], [0.028, 0.0095, 0.04], [0.033, 0.0095, 0.06]], [[0.02, 0.0095, 0.035], [0.012, 0.0095, 0.05], [0.004, 0.0095, 0.072]], [[0.012, 0.0095, 0.02], [0.025, 0.0095, 0.012], [0.034, 0.0095, 0.004]]]
    k.put(merge(...crack.map((c) => sweepRaw(c, 0.00025, { seg: 4 }))), 'glass', { tint: [0.75, 0.78, 0.8] })
    k.box('paint', [0.0014, 0.0035, 0.024], [0.0372, 0.0045, 0.03], { r: 0.0005, tint: [0.3, 0.3, 0.32] })
    k.box('paint', [0.012, 0.0008, 0.0014], [0, 0.0097, -0.07], { r: 0, tint: [0.2, 0.2, 0.22] })
  },
  laptop: (k) => {
    for (const [x, z] of [[-0.14, -0.09], [0.14, -0.09], [-0.14, 0.09], [0.14, 0.09]] as const) k.cyl('rubber', 0.006, 0.002, [x, 0.001, z], { seg: 12, tint: BLACK })
    k.box('charcoal', [0.33, 0.012, 0.23], [0, 0.008, 0], { r: 0.004, tint: [0.3, 0.31, 0.33] })
    k.box('charcoal', [0.33, 0.007, 0.226], [0, 0.0179, 0.002], { r: 0.003, tint: [0.36, 0.37, 0.4] })
    k.cyl('charcoal', 0.0055, 0.25, [0, 0.0118, -0.1165], { axis: 'x', seg: 16, tint: [0.2, 0.2, 0.22] })
    k.box('paint', [0.04, 0.0008, 0.04], [0, 0.0218, 0.01], { r: 0.0005, tint: [0.8, 0.82, 0.85] })
    boxes(k, 'charcoal', [[-0.04, 0.012], [-0.02, 0.009], [0.03, 0.007]].map(([z, w]) => ({ size: [0.0012, 0.005, w] as V3, at: [0.1652, 0.008, z] as V3, r: 0.0004 })), { tint: BLACK })
  },
  'speaker-magnet': (k) => {

    k.lathe('steel', fillet2([[0, 0], [0.05, 0], [0.05, 0.006], [0, 0.006]], 0.0008, 2), [0, 0, 0], { seg: 40, tint: [0.45, 0.45, 0.48] })
    k.lathe('charcoal', fillet2([[0.022, 0.0062], [0.05, 0.0062], [0.05, 0.0242], [0.022, 0.0242], [0.022, 0.0062]], 0.001, 2), [0, 0, 0], { seg: 40, tint: [0.25, 0.25, 0.27] })
    k.lathe('steel', fillet2([[0.018, 0.0244], [0.05, 0.0244], [0.05, 0.0304], [0.018, 0.0304], [0.018, 0.0244]], 0.0008, 2), [0, 0, 0], { seg: 40, tint: [0.45, 0.45, 0.48] })
    k.cyl('steel', 0.0164, 0.026, [0, 0.0175, 0], { seg: 28, tint: [0.55, 0.55, 0.58] })
    const legs = [0.4, 0.4 + TAU / 4, 0.4 + TAU / 2, 0.4 + TAU * 0.75].map((a) => sweepRaw([[Math.cos(a) * 0.046, 0.031, Math.sin(a) * 0.046], [Math.cos(a) * 0.058, 0.05, Math.sin(a) * 0.058], [Math.cos(a) * 0.07, 0.068, Math.sin(a) * 0.07]], 0.006, { seg: 6, flat: 0.25 }))
    k.put(merge(...legs, latheRaw([[0.066, 0.067], [0.074, 0.067], [0.074, 0.071], [0.066, 0.071], [0.066, 0.067]], { seg: 48 })), 'steel', { tint: [0.4, 0.4, 0.42] })

    k.lathe('paper', [[0.066, 0.0665], [0.04, 0.046], [0.019, 0.031]], [0, 0, 0], { seg: 32, arc: 4.1, phase: 1.2, tint: [0.22, 0.2, 0.18] })
  },
  'transformer-coil': (k) => {

    const core: V3 = [0.35, 0.36, 0.38]
    k.box('paper', [0.034, 0.034, 0.046], [0, 0.03, 0], { r: 0.004, tint: [0.95, 0.82, 0.25] })
    for (const y of [0.0065, 0.0535]) k.box('steel', [0.066, 0.009, 0.025], [0, y, 0], { r: 0.0006, tint: core })
    for (const s of [-1, 1]) k.box('steel', [0.016, 0.038, 0.025], [s * 0.025, 0.03, 0], { r: 0.0006, tint: core })
    for (const s of [-1, 1]) k.box('steel', [0.012, 0.0016, 0.03], [s * 0.039, 0.0008, 0], { r: 0.0003, tint: [0.6, 0.6, 0.62] })
    for (const [x, tint] of [[-0.01, RED], [-0.004, BLACK], [0.004, [0.95, 0.8, 0.15]], [0.01, [0.95, 0.8, 0.15]]] as const) k.put(sweepRaw([[x, 0.035, 0.022], [x * 1.3, 0.03, 0.03], [x * 1.8, 0.012, 0.034], [x * 2.2, 0.0011, 0.03]], 0.0011, { seg: 5 }), 'rubber', { tint: tint as V3 })
  },
  'portable-generator': (k) => {

    const red: V3 = [0.8, 0.16, 0.12], frame: V3 = [0.15, 0.15, 0.16], tray = 0.0385
    for (const [x, z] of [[-0.22, -0.19], [0.22, -0.19], [-0.22, 0.19], [0.22, 0.19]] as const) k.cyl('rubber', 0.02, 0.014, [x, 0.007, z], { seg: 14, tint: BLACK })
    for (const z of [-0.19, 0.19]) k.put(sweepRaw(rrect(0.56, 0.4, 0.06, 5, 0, 0.22).map(([x, y]) => [x, y, z] as V3), 0.0125, { closed: true, seg: 10 }), 'steel', { tint: frame })
    for (const [x, y] of [[-0.28, 0.1], [0.28, 0.1], [-0.28, 0.34], [0.28, 0.34]] as const) k.cyl('steel', 0.0125, 0.38, [x, y, 0], { axis: 'z', seg: 12, tint: frame })
    k.box('steel', [0.5, 0.006, 0.36], [0, tray - 0.003, 0], { r: 0.002, tint: [0.3, 0.3, 0.32] })
    k.box('paint', [0.2, 0.17, 0.22], [0.1, tray + 0.085, 0], { r: 0.012, tint: [0.3, 0.3, 0.32] })
    k.cyl('steel', 0.04, 0.07, [0.12, tray + 0.205, 0], { seg: 20, tint: [0.4, 0.4, 0.42] })
    k.put(merge(...Array.from({ length: 7 }, (_, i) => place(rboxRaw(0.12, 0.004, 0.13, { r: 0.0015 }), { at: [0.12, tray + 0.174 + i * 0.009, 0] }))), 'steel', { tint: [0.45, 0.45, 0.47] })
    k.lathe('paint', fillet2([[0, 0], [0.08, 0], [0.08, 0.03], [0.06, 0.05], [0, 0.052]], 0.008, 3), [0.1, tray + 0.085, 0.111], { axis: 'z', seg: 32, tint: red })
    k.lathe('paint', fillet2([[0, -0.12], [0.095, -0.12], [0.098, 0.1], [0.08, 0.12], [0, 0.12]], 0.008, 3), [-0.12, tray + 0.098, 0], { axis: 'x', seg: 32, tint: red, wear: knurl(20, 0.0015, 0.09) })
    k.box('steel', [0.08, 0.08, 0.06], [0.215, tray + 0.05, -0.13], { r: 0.008, tint: [0.55, 0.55, 0.57] })
    k.put(loftRaw([{ y: tray + 0.2405, rx: 0.17, rz: 0.15, p: 4, cx: 0.02 }, { y: 0.33, rx: 0.19, rz: 0.17, p: 4, cx: 0.02 }, { y: 0.365, rx: 0.17, rz: 0.155, p: 3.5, cx: 0.02 }, { y: 0.375, rx: 0.14, rz: 0.125, p: 3, cx: 0.02 }], { seg: 40 }), 'paint', { tint: red })
    k.lathe('paint', fillet2([[0, 0], [0.025, 0], [0.025, 0.018], [0, 0.02]], 0.003, 2), [0.1, 0.373, 0.06], { seg: 20, tint: BLACK, wear: knurl(16, 0.001, 0.02) })
    k.box('paint', [0.006, 0.12, 0.16], [-0.243, tray + 0.09, 0], { r: 0.004, tint: BLACK })
    boxes(k, 'paint', [[0.11, -0.035], [0.11, 0.035], [0.16, 0]].map(([y, z]) => ({ size: [0.0014, 0.034, 0.034] as V3, at: [-0.2467, y, z] as V3, r: 0.005 })), { tint: [0.9, 0.9, 0.88] })
  },
  'alarm-sensors': (k) => {
    k.box('paint', [0.032, 0.02, 0.05], [-0.02, 0.01, 0], { r: 0.004, tint: WHITE })
    k.sphere('glass', 0.011, [-0.02, 0.0196, 0.006], { rows: 6, seg: 16, scale: [1, 0.5, 1], tint: [0.92, 0.92, 0.9] })
    k.cyl('glass', 0.0016, 0.0012, [-0.02, 0.0204, -0.019], { seg: 10, tint: RED })
    for (const x of [0.016, 0.031]) k.box('paint', [0.011, 0.01, 0.04], [x, 0.005, -0.01], { r: 0.0025, tint: WHITE })
    k.box('paint', [0.03, 0.0016, 0.022], [0.024, 0.0008, 0.024], { r: 0.0003, tint: [0.1, 0.3, 0.6] })
    k.box('paint', [0.019, 0.015, 0.015], [0.022, 0.0091, 0.024], { r: 0.001, tint: [0.15, 0.35, 0.75] })
    boxes(k, 'steel', [0.033, 0.036].map((x) => ({ size: [0.002, 0.004, 0.012] as V3, at: [x, 0.0036, 0.024] as V3, r: 0.0003 })), { tint: [0.2, 0.55, 0.3] })
  },
  'remote-control': (k) => {
    k.box('charcoal', [0.046, 0.016, 0.165], [0, 0.008, 0], { r: 0.006, tint: BLACK, seg: [3, 2, 8], disp: (f, s, _t, hs) => (f === 2 ? 0.002 * (1 - (s / hs) ** 2) : 0) })
    const pads: { size: V3; at: V3; r: number }[] = []
    for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) pads.push({ size: [0.009, 0.0026, 0.006], at: [(i - 1) * 0.013, 0.0175, 0.012 + j * 0.0095], r: 0.0012 })
    boxes(k, 'rubber', pads, { tint: [0.32, 0.32, 0.34] })
    k.put(merge(sweepRaw(ringPath(0.011, 0.011, 0.0178, 24), 0.0024, { closed: true, seg: 6, flat: 0.6 }), latheRaw([[0, 0.0163], [0.0045, 0.0163], [0.0045, 0.0189], [0, 0.0189]], { seg: 14 })), 'rubber', { at: [0, 0, -0.03], tint: [0.32, 0.32, 0.34] })
    k.cyl('rubber', 0.005, 0.0026, [0.014, 0.0172, -0.064], { seg: 14, tint: RED })
    k.box('glass', [0.022, 0.006, 0.0016], [0, 0.009, -0.0828], { r: 0.0008, tint: [0.25, 0.1, 0.12] })
  },
  'security-camera': (k) => {

    const axis: V3 = [0, 0.032, -0.048]
    k.lathe('paint', fillet2([[0, 0], [0.04, 0], [0.04, 0.008], [0, 0.009]], 0.002, 2), [0, 0.04, -0.09], { axis: 'z', roll: Math.PI, seg: 28, tint: WHITE })
    k.tube('paint', [[0, 0.04, -0.086], [0, 0.04, -0.07], [0, 0.034, -0.055]], 0.008, { seg: 10, tint: WHITE })
    k.sphere('paint', 0.012, [0, 0.032, -0.052], { rows: 6, seg: 12, tint: WHITE })
    k.lathe('paint', fillet2([[0, 0], [0.028, 0], [0.03, 0.01], [0.03, 0.135], [0, 0.135]], 0.004, 2), axis, { axis: 'z', seg: 32, tint: WHITE })
    k.lathe('paint', [[0.0325, 0.04], [0.0325, 0.15]], axis, { axis: 'z', seg: 24, arc: 3.4, phase: 0, tint: WHITE })
    k.cyl('glass', 0.025, 0.002, [0, 0.032, 0.0875], { axis: 'z', seg: 28, tint: [0.08, 0.08, 0.1] })
    k.put(merge(...Array.from({ length: 8 }, (_, i) => place(latheRaw([[0, 0], [0.0025, 0], [0.0025, 0.0012], [0, 0.0012]], { seg: 8 }), { at: [Math.cos(i / 8 * TAU) * 0.018, 0.032 + Math.sin(i / 8 * TAU) * 0.018, 0.0884], pitch: Math.PI / 2 }))), 'glass', { tint: [0.35, 0.1, 0.1] })
    k.put(sweepRaw([[0, 0.04, -0.098], [0.01, 0.025, -0.1], [0.03, 0.0025, -0.09], [0.05, 0.0025, -0.04]], 0.0025, { seg: 6 }), 'rubber', { tint: BLACK })
  },
  'neodymium-magnets': (k) => {
    const disc = (y: number, i: number) => shade(latheRaw(fillet2([[0, y], [0.0098, y], [0.01, y + 0.0004], [0.01, y + 0.0026], [0.0098, y + 0.003], [0, y + 0.003]], 0.0003, 1), { seg: 28 }), 0.92 + (i % 2) * 0.08)
    k.put(merge(...Array.from({ length: 5 }, (_, i) => disc(i * 0.0031, i))), 'steel', { at: [-0.01, 0, 0.004], tint: [0.9, 0.9, 0.92] })
    k.box('steel', [0.02, 0.005, 0.01], [0.012, 0.0025, -0.008], { r: 0.0004, yaw: 0.4, tint: [0.92, 0.92, 0.94] })
    k.lathe('steel', fillet2([[0.004, 0], [0.008, 0], [0.008, 0.004], [0.004, 0.004], [0.004, 0]], 0.0003, 1), [0.014, 0, 0.014], { seg: 24, tint: [0.9, 0.9, 0.92] })
  },
}
