import type { AssetSpec } from '../../types'
import { arc, type Family, type Kit, type Mat, type V2, type V3 } from '../kit'
import { blanket, carcass, door, drawer, mattress, pillow } from './common'
import { piping } from './seating'

const BLANKETS: V3[] = [[0.78, 0.38, 0.32], [0.42, 0.52, 0.7], [0.56, 0.6, 0.42], [0.7, 0.62, 0.5], [0.5, 0.36, 0.5]]
const finial = (k: Kit, m: Mat, x: number, y: number, z: number, r: number) => k.lathe(m, [[0, 0], [r * 0.7, 0], [r * 0.5, r * 0.4], [r, r * 1.1], [r * 0.85, r * 1.7], [r * 0.3, r * 2.1], [0, r * 2.2]], [x, y, z], { seg: 16 })

function woodBed(k: Kit, s: AssetSpec, double: boolean) {
  const { w, h, d } = k, v = s.variant, post = double ? 0.075 : 0.06, rail = 0.34, matH = double ? 0.24 : 0.19, footH = double ? 0.55 : 0.5
  const px = w / 2 - post / 2, hz = -d / 2 + post / 2, fz = d / 2 - post / 2
  for (const x of [-1, 1]) {
    k.blk('wood', [post, h - 0.05, post], x * px, 0, hz, { r: 0.008 })
    k.blk('wood', [post, footH - 0.04, post], x * px, 0, fz, { r: 0.008 })
    finial(k, 'wood', x * px, h - 0.05, hz, post * 0.4)
    finial(k, 'wood', x * px, footH - 0.04, fz, post * 0.4)
    k.box('wood', [0.032, 0.15, d - 2 * post], [x * (w / 2 - 0.03), 0.25, 0], { r: 0.006 })
    for (const z of [hz, fz]) k.box('wood', [post + 0.01, 0.02, post + 0.01], [x * px, 0.05, z], { r: 0.004 })
  }
  for (let i = 0; i < 9; i++) k.box('wood', [w - 0.1, 0.016, 0.07], [0, rail - 0.03, -d / 2 + 0.2 + i * (d - 0.4) / 8], { tone: 0.7 })
  const inner = w - 2 * post
  k.box('wood', [inner, 0.08, 0.028], [0, rail + 0.05, hz], { r: 0.006 })
  if (v !== 1) k.box('wood', [inner + 0.02, 0.07, 0.034], [0, h - 0.12, hz], { r: 0.012 })
  if (v === 0) for (let i = 0; i < Math.round(inner / 0.11); i++) {
    const n = Math.round(inner / 0.11), x = -inner / 2 + (i + 0.5) * inner / n, hh = h - 0.155 - rail - 0.09
    k.lathe('wood', [[0, 0], [0.013, 0], [0.016, hh * 0.2], [0.012, hh * 0.45], [0.017, hh * 0.6], [0.012, hh * 0.85], [0.014, hh], [0, hh]], [x, rail + 0.09, hz], { seg: 10 })
  } else if (v === 1) {
    const c = inner / 2, H0 = h - rail - 0.24, bump = 0.12, R = (c * c + bump * bump) / (2 * bump), cy = H0 + bump - R, a0 = Math.atan2(H0 - cy, c)
    k.extrude('wood', [[-c, 0], [c, 0], ...arc(0, cy, R, a0, Math.PI - a0, 12)], 0.025, [0, rail + 0.09, hz], { bevel: 0.006, curveSeg: 4 })
  } else {
    k.box('wood', [inner, h - rail - 0.24, 0.02], [0, rail + 0.09 + (h - rail - 0.24) / 2, hz - 0.004])
    k.cushion('fabric', [inner - 0.06, h - rail - 0.3, 0.07], [0, rail + 0.12 + (h - rail - 0.3) / 2, hz + 0.04], { puff: 0.02, tufts: [Math.max(3, Math.round(inner / 0.22)), 3], tint: [0.62, 0.66, 0.72] })
  }
  k.box('wood', [inner, footH - rail - 0.06, 0.026], [0, rail + (footH - rail - 0.06) / 2 + 0.03, fz], { r: 0.006 })
  k.box('wood', [inner + 0.02, 0.05, 0.034], [0, footH - 0.04, fz], { r: 0.01 })
  const mw = w - 2 * post + 0.02, md = d - 2 * post - 0.02, mTop = rail + matH - 0.02
  mattress(k, 'fabric', [mw, matH, md], [0, rail + matH / 2 - 0.02, 0.0], { quilt: [Math.round(mw / 0.25), Math.round(md / 0.3)] })
  const pillows = double ? 2 : 1
  for (let i = 0; i < pillows; i++) pillow(k, 'fabric', double ? mw / 2 - 0.06 : mw - 0.14, 0.42, [double ? (i - 0.5) * mw / 2 : 0, mTop + 0.06, -d / 2 + post + 0.3], { pitch: -0.25, yaw: k.jitter(0.08), tint: [1, 0.98, 0.94] })
  const tint = BLANKETS[Math.floor(k.rnd() * BLANKETS.length)]
  blanket(k, 'fabric', mw + 0.02, mTop + 0.012, Math.min(0.2, matH + 0.02), md * (v === 2 ? 0.55 : 0.66), d / 2 - post - md * (v === 2 ? 0.55 : 0.66) / 2 - 0.02, { tone: 0.85, tint })
  k.box('fabric', [mw + 0.03, 0.03, 0.05], [0, mTop + 0.02, d / 2 - post - md * 0.66 - 0.01 + (v === 2 ? md * 0.11 : 0)], { tint: [1, 0.98, 0.94], r: 0.014 })
}

export const BEDS_TABLES: Family = {
  'single-bed': (k, s) => woodBed(k, s, false),
  'double-bed': (k, s) => woodBed(k, s, true),

  'bunk-bed': (k, s) => {
    const { w, h, d } = k, v = s.variant, p = 0.04
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      k.blk('steel', [p, h, p], x * (w / 2 - p / 2), 0, z * (d / 2 - p / 2), { r: 0.005 })
      k.cyl('rubber', p * 0.55, 0.012, [x * (w / 2 - p / 2), 0.006, z * (d / 2 - p / 2)], { seg: 12 })
      k.box('rubber', [p + 0.004, 0.02, p + 0.004], [x * (w / 2 - p / 2), h - 0.01, z * (d / 2 - p / 2)], { r: 0.006 })
    }
    for (const deck of [0.3, 1.3]) {
      for (const x of [-1, 1]) k.box('steel', [0.03, 0.06, d - 2 * p], [x * (w / 2 - 0.015), deck, 0], { r: 0.004 })
      for (const z of [-1, 1]) k.box('steel', [w - 2 * p, 0.06, 0.03], [0, deck, z * (d / 2 - 0.015)], { r: 0.004 })
      for (let i = 0; i < 12; i++) k.box('steel', [w - 0.08, 0.004, 0.035], [0, deck + 0.02, -d / 2 + 0.12 + i * (d - 0.24) / 11], { r: 0.001, tone: 0.8 })
      for (let i = 0; i < 6; i++) k.tube('steel', [[-w / 2 + 0.04, deck + 0.022, -d / 2 + 0.1 + i * (d - 0.4) / 5], [w / 2 - 0.04, deck + 0.022, -d / 2 + 0.28 + i * (d - 0.4) / 5]], 0.0018, { seg: 4 })
      const mt = deck + 0.03
      mattress(k, 'fabric', [w - 0.07, 0.14, d - 0.1], [0, mt + 0.07, 0], { quilt: [3, 6] })
      pillow(k, 'fabric', w - 0.2, 0.38, [0, mt + 0.18, -d / 2 + 0.28], { pitch: -0.2, tint: [0.96, 0.95, 0.9] })
      blanket(k, 'fabric', w - 0.07, mt + 0.15, 0.1, d * 0.58, d / 2 - 0.05 - d * 0.29, { tone: 0.8, tint: [0.5, 0.55, 0.4] })
    }
    for (const z of [-1, 1]) for (const y of [0.1, 0.9, 1.6]) k.box('steel', [w - 2 * p, 0.03, 0.025], [0, y + 0.18, z * (d / 2 - 0.0125)], { r: 0.004 })
    const gx = v === 1 ? -1 : 1
    for (const y of [1.5, 1.68]) k.box('steel', [0.025, 0.025, d * 0.62], [gx * (w / 2 - 0.0125), y, -d * 0.12], { r: 0.004 })
    for (const z of [-d * 0.43, d * 0.19]) k.box('steel', [0.025, 0.22, 0.025], [gx * (w / 2 - 0.0125), 1.47, z], { r: 0.004 })
    const lz = d / 2 + 0.005
    for (const x of [-0.18, 0.18]) k.tube('steel', [[x, 0.014, lz + 0.015], [x, 1.2, lz], [x, 1.55, lz - 0.025]], 0.014, { fillet: 0.1 })
    for (let i = 0; i < 5; i++) k.cyl('steel', 0.011, 0.36, [0, 0.27 + i * 0.25, lz], { axis: 'x', seg: 10 })
    if (v === 2) k.box('fabric', [0.5, 0.012, 0.6], [w * 0.1, 1.48, 0.3], { roll: 0.05, yaw: 0.4, tint: [0.4, 0.45, 0.35], r: 0.005 })
  },

  'hospital-bed': (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const cx = x * (w / 2 - 0.09), cz = z * (d / 2 - 0.18)
      const top = k.caster([cx, 0, cz], 0.055, { yaw: z > 0 ? 0 : Math.PI })
      k.cyl('steel', 0.018, 0.2 - top, [cx, top + (0.2 - top) / 2, cz], { seg: 12 })
      if (z > 0) k.box('paint', [0.05, 0.012, 0.03], [cx, 0.13, cz + 0.06], { r: 0.003, tint: [0.9, 0.3, 0.2] })
    }
    for (const x of [-1, 1]) k.box('steel', [0.05, 0.06, d - 0.2], [x * (w / 2 - 0.09), 0.23, 0], { r: 0.008 })
    for (const z of [-1, 1]) k.box('steel', [w - 0.18, 0.05, 0.05], [0, 0.23, z * (d / 2 - 0.18)], { r: 0.008 })
    for (const x of [-1, 1]) for (const sgn of [-1, 1]) k.tube('steel', [[x * (w / 2 - 0.16), 0.27, sgn * 0.35], [x * (w / 2 - 0.16), 0.46, -sgn * 0.35]], 0.016, { seg: 10 })
    k.box('steel', [0.08, 0.08, 0.3], [0, 0.32, 0], { r: 0.01 })
    k.cyl('steel', 0.022, 0.14, [0, 0.4, 0], { seg: 14 })
    const deckY = 0.5, mw = w - 0.12
    for (const x of [-1, 1]) k.box('steel', [0.04, 0.04, d - 0.36], [x * (mw / 2), deckY, 0.1], { r: 0.006 })
    const back = v === 0 ? 0.12 : 0.42, backLen = d * 0.36
    k.frame({ at: [0, deckY + 0.03, -d / 2 + 0.06 + backLen], pitch: back }, () => {
      k.box('steel', [mw, 0.02, backLen], [0, 0, -backLen / 2], { r: 0.004 })
      mattress(k, 'fabric', [mw - 0.03, 0.13, backLen - 0.02], [0, 0.075, -backLen / 2], { pitch: 0.0001 })
      pillow(k, 'fabric', mw * 0.6, 0.36, [0, 0.2, -backLen + 0.22], { pitch: -0.1, tint: [0.92, 0.96, 1] })
    })
    k.box('steel', [mw, 0.02, d * 0.58], [0, deckY + 0.03, -d / 2 + 0.06 + backLen + d * 0.29], { r: 0.004 })
    mattress(k, 'fabric', [mw - 0.03, 0.13, d * 0.58 - 0.03], [0, deckY + 0.105, -d / 2 + 0.06 + backLen + d * 0.29], { quilt: [2, 4] })
    blanket(k, 'fabric', mw - 0.02, deckY + 0.175, 0.12, d * 0.48, d / 2 - 0.08 - d * 0.24, { tone: 0.95, tint: [0.78, 0.88, 0.96] })
    const board = (z: number, tall: number) => {
      k.box('tile', [w - 0.02, tall, 0.04], [0, deckY + tall / 2 - 0.02, z], { r: 0.016, tint: [0.92, 0.94, 0.96] })
      k.handle([0, deckY + tall - 0.08, z + (z > 0 ? 0.02 : -0.02)], w * 0.5, { yaw: z > 0 ? 0 : Math.PI, r: 0.01, standoff: 0.03 })
    }
    board(-d / 2 + 0.03, h - deckY + 0.02)
    board(d / 2 - 0.03, (h - deckY) * 0.6)
    for (const x of [-1, 1]) {
      if (v === 2 && x > 0) continue
      const rz = -d / 2 + 0.3
      k.frame({ at: [x * (w / 2 - 0.02), deckY + 0.26, rz + 0.35] }, () => {
        k.tube('steel', [[0, -0.12, -0.35], [0, 0.12, -0.35], [0, 0.12, 0.35], [0, -0.12, 0.35]], 0.011, { fillet: 0.05 })
        for (let i = 1; i < 6; i++) k.cyl('steel', 0.006, 0.22, [0, 0, -0.35 + i * 0.117], { seg: 8 })
        for (const z of [-0.25, 0.25]) k.box('steel', [0.02, 0.14, 0.02], [0, -0.19, z], { r: 0.004 })
      })
    }
    k.tube('steel', [[w / 2 - 0.06, deckY - 0.02, -d / 2 + 0.08], [w / 2 - 0.06, h + 0.25, -d / 2 + 0.08]], 0.011)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) k.tube('steel', [[w / 2 - 0.06, h + 0.24, -d / 2 + 0.08], [w / 2 - 0.06 + Math.cos(a) * 0.09, h + 0.27, -d / 2 + 0.08 + Math.sin(a) * 0.09], [w / 2 - 0.06 + Math.cos(a) * 0.1, h + 0.24, -d / 2 + 0.08 + Math.sin(a) * 0.1]], 0.004, { fillet: 0.01 })
    if (v !== 0) {
      k.box('tile', [0.03, 0.15, 0.07], [w / 2 - 0.015, deckY + 0.12, d * 0.05], { r: 0.008, tint: [0.85, 0.88, 0.9] })
      k.cable('rubber', [w / 2 - 0.015, deckY + 0.2, d * 0.05], [w / 2 - 0.08, deckY + 0.05, -d * 0.2], 0.12, 0.0035)
    }
  },

  'motel-bed': (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) {
      k.box('steel', [0.04, 0.04, d - 0.06], [x * (w / 2 - 0.05), 0.16, 0.02], { r: 0.003 })
      for (const z of [-1, 0, 1]) k.cyl('steel', 0.012, 0.15, [x * (w / 2 - 0.05), 0.075, z * (d / 2 - 0.12)], { seg: 10 })
      for (const z of [-1, 0, 1]) k.cyl('rubber', 0.02, 0.012, [x * (w / 2 - 0.05), 0.006, z * (d / 2 - 0.12)], { seg: 12 })
    }
    k.box('steel', [w - 0.08, 0.04, 0.04], [0, 0.16, d / 2 - 0.05], { r: 0.003 })
    const boxTop = 0.18 + 0.22
    k.cushion('fabric', [w - 0.06, 0.22, d - 0.14], [0, 0.18 + 0.11, 0.04], { puff: 0.008, sides: 0.4, tint: [0.75, 0.7, 0.62] })
    mattress(k, 'fabric', [w - 0.08, 0.2, d - 0.16], [0, boxTop + 0.1 - 0.01, 0.045], { quilt: [4, 6] })
    const top = boxTop + 0.19
    const tint: V3 = [[0.55, 0.33, 0.3], [0.36, 0.42, 0.36], [0.5, 0.44, 0.6]][v] as V3
    blanket(k, 'fabric', w - 0.06, top + 0.012, 0.3, d * 0.72, d / 2 - 0.08 - d * 0.36 + 0.05, { tone: 0.9, tint })
    k.box('fabric', [w - 0.03, 0.035, 0.07], [0, top + 0.022, d / 2 - 0.03 - d * 0.72 + 0.05], { r: 0.016, tint })
    for (const x of [-1, 1]) pillow(k, 'fabric', w / 2 - 0.12, 0.4, [x * (w / 4 - 0.01), top + 0.06, -d / 2 + 0.34], { pitch: -0.3, roll: x * 0.05, tint: [0.97, 0.96, 0.92] })
    const hz = -d / 2 + 0.035
    k.blk('steel', [w + 0.02, h - 0.02, 0.05], 0, 0.02, hz, { r: 0.01 })
    const panels = v === 1 ? 1 : 3
    for (let i = 0; i < panels; i++) {
      const pw = (w - 0.08) / panels
      k.cushion('leather', [pw - 0.02, h - 0.46, 0.06], [-w / 2 + 0.04 + (i + 0.5) * pw, 0.44 + (h - 0.46) / 2, hz + 0.05], { puff: 0.018, tufts: v === 2 ? [Math.max(2, Math.round(pw / 0.18)), 3] : undefined, tint: [0.62, 0.5, 0.42] })
    }
    k.box('steel', [w + 0.04, 0.03, 0.08], [0, h - 0.015, hz + 0.01], { r: 0.008 })
  },

  desk: (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.032, pw = Math.min(0.42, w * 0.32)
    k.box('wood', [w, top, d], [0, h - top / 2, 0], { r: 0.008 })
    k.box('wood', [w - 0.03, 0.022, d - 0.03], [0, h - top - 0.011, 0], { r: 0.006, tone: 0.8 })
    const pedestal = (x: number, drawers: number) => {
      const inner = carcass(k, 'wood', pw, h - top - 0.022, d - 0.04, { x, z: -0.01, plinth: 0.06 })
      const fh = (h - top - 0.022 - 0.08) / drawers
      for (let i = 0; i < drawers; i++) {
        const tall = drawers === 2 && i === 0
        drawer(k, 'wood', inner + 0.03, fh - 0.008, [x, 0.07 + (i + 0.5) * fh, d / 2 - 0.03], { handle: v === 2 ? 'ring' : 'bar', hm: 'steel', label: tall })
      }
    }
    pedestal(w / 2 - pw / 2 - 0.01, v === 1 ? 2 : 3)
    if (v === 0) {
      for (const z of [-1, 1]) k.blk('wood', [0.045, h - top - 0.022, 0.045], -w / 2 + 0.04, 0, z * (d / 2 - 0.05), { taper: 0.25 })
      k.blk('wood', [w - pw - 0.08, 0.32, 0.018], -pw / 2 + 0.01, h - top - 0.34, -d / 2 + 0.03)
    } else {
      pedestal(-w / 2 + pw / 2 + 0.01, 3)
      k.blk('wood', [w - 2 * pw - 0.04, 0.38, 0.018], 0, h - top - 0.4, -d / 2 + 0.03)
      drawer(k, 'wood', w - 2 * pw - 0.06, 0.07, [0, h - top - 0.06, d / 2 - 0.03], { flat: true, handle: 'knob' })
    }
    if (v === 2) k.box('leather', [w * 0.5, 0.004, d * 0.55], [-w * 0.05, h + 0.002, 0.02], { r: 0.002, tint: [0.4, 0.5, 0.4] })
    for (let i = 0; i < 6; i++) k.box('paper', [0.21, 0.004, 0.297], [w * 0.22 + k.jitter(0.01), h + 0.002 + i * 0.004, -0.03], { yaw: k.jitter(0.12), r: 0.0008, tone: 0.95 })
    k.lathe('tile', [[0, 0], [0.035, 0], [0.04, 0.09], [0.035, 0.09], [0.031, 0.008], [0, 0.008]], [-w * 0.3, h, -d * 0.2], { seg: 18, tint: [0.4, 0.5, 0.65] })
    for (let i = 0; i < 4; i++) k.cyl('paint', 0.0035, 0.15, [-w * 0.3 + k.jitter(0.012), h + 0.09, -d * 0.2 + k.jitter(0.012)], { seg: 6, pitch: k.jitter(0.25), roll: k.jitter(0.25), tint: [[0.2, 0.3, 0.8], [0.8, 0.2, 0.2], [0.2, 0.2, 0.2], [0.9, 0.8, 0.2]][i] as V3 })
  },

  'dining-table': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = v === 2 ? 0.045 : 0.035
    if (v === 2) {
      const n = Math.round((w - 0.12) / 0.14)
      for (let i = 0; i < n; i++) k.plank('wood', (d - 0.004), (w - 0.12) / n - 0.004, top, [-(w - 0.12) / 2 + (i + 0.5) * (w - 0.12) / n, h - top / 2, 0], { yaw: Math.PI / 2, wear: 0.5 })
      for (const x of [-1, 1]) k.box('wood', [0.06, top, d], [x * (w / 2 - 0.03), h - top / 2, 0], { r: 0.008 })
    } else k.extrude('wood', [[-w / 2 + 0.02, 0], [w / 2 - 0.02, 0], [w / 2, top * 0.4], [w / 2, top], [-w / 2, top], [-w / 2, top * 0.4]], d, [0, h - top, 0], { bevel: 0.006 })
    const lx = w / 2 - 0.08, lz = d / 2 - 0.08
    const apron = (ah: number, at: number, y: number) => {
      const dw = Math.min(0.45, lx * 0.8), rail = lx - dw / 2 - 0.004
      k.box('wood', [2 * lx, ah, at], [0, y, -lz], { r: 0.004 })
      for (const s of [-1, 1]) k.box('wood', [rail, ah, at], [s * (dw / 2 + 0.004 + rail / 2), y, lz], { r: 0.004 })
      drawer(k, 'wood', dw, ah - 0.012, [0, y, lz + at / 2], { handle: 'knob', flat: true })
    }
    if (v === 0) {
      for (const x of [-1, 1]) for (const z of [-1, 1]) k.turnedLeg('wood', x * lx, 0, z * lz, h - top, 0.035)
      apron(0.09, 0.022, h - top - 0.045)
      for (const x of [-1, 1]) k.box('wood', [0.022, 0.09, 2 * lz], [x * lx, h - top - 0.045, 0], { r: 0.004 })
    } else if (v === 1) {
      for (const x of [-1, 1]) k.frame({ at: [x * (w / 2 - 0.18), 0, 0] }, () => {
        k.box('wood', [0.08, 0.07, d - 0.08], [0, 0.035, 0], { r: 0.012 })
        for (const z of [-1, 1]) k.box('wood', [0.09, 0.02, 0.09], [0, 0.01, z * (d / 2 - 0.08)], { r: 0.004, tone: 0.7 })
        k.extrude('wood', [[-0.06, 0], [0.06, 0], [0.04, 0.12], [0.04, h - top - 0.19], [0.06, h - top - 0.07], [-0.06, h - top - 0.07], [-0.04, h - top - 0.19], [-0.04, 0.12]], 0.07, [0, 0.07, 0], { axis: 'x', bevel: 0.008 })
        k.box('wood', [0.07, 0.06, d - 0.12], [0, h - top - 0.03, 0], { r: 0.01 })
      })
      k.box('wood', [w - 0.4, 0.07, 0.045], [0, 0.32, 0], { r: 0.01 })
      for (const x of [-1, 1]) k.box('wood', [0.025, 0.11, 0.02], [x * (w / 2 - 0.13), 0.32, 0], { r: 0.003, tone: 0.65 })
      k.box('fabric', [w * 0.84, 0.004, 0.32], [0, h + 0.002, 0], { r: 0.002, tint: [0.75, 0.68, 0.55] })
    } else {
      for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('wood', [0.075, h - top, 0.075], x * lx, 0, z * lz, { taper: 0.3, r: 0.006 })
      apron(0.1, 0.028, h - top - 0.05)
      for (const x of [-1, 1]) k.box('wood', [0.028, 0.1, 2 * lz], [x * lx, h - top - 0.05, 0], { r: 0.005 })
    }
    for (let i = 0; i < (v === 1 ? 2 : 3); i++) k.lathe('tile', [[0, 0], [0.07, 0], [0.11, 0.012], [0.125, 0.022], [0.12, 0.024], [0.1, 0.016], [0, 0.01]], [(i - 1) * w * 0.28 + k.jitter(0.03), h, k.jitter(0.12)], { seg: 28, tint: [0.96, 0.95, 0.9] })
    k.lathe('glass', [[0, 0], [0.035, 0], [0.037, 0.16], [0.016, 0.21], [0.012, 0.27], [0, 0.27]], [w * 0.1, h, -d * 0.18], { seg: 16 })
  },

  'school-desk': (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) {
      k.tube('steel', [[x * (w / 2 - 0.04), 0.012, d / 2 - 0.05], [x * (w / 2 - 0.04), h - 0.04, d / 2 - 0.08], [x * (w / 2 - 0.04), h - 0.04, -d / 2 + 0.06], [x * (w / 2 - 0.04), 0.012, -d / 2 + 0.06]], 0.013, { fillet: 0.05 })
      k.box('steel', [0.03, 0.012, d - 0.06], [x * (w / 2 - 0.04), 0.012, 0], { r: 0.004 })
      for (const z of [-1, 1]) k.cyl('rubber', 0.016, 0.012, [x * (w / 2 - 0.04), 0.006, z * (d / 2 - 0.06)], { seg: 10 })
    }
    k.cyl('steel', 0.01, w - 0.08, [0, 0.18, -d / 2 + 0.06], { axis: 'x', seg: 10 })
    const lid = v === 2 ? -0.08 : 0
    if (v === 0) {
      for (let i = 0; i <= 8; i++) k.cyl('steel', 0.003, d - 0.16, [-w / 2 + 0.08 + i * (w - 0.16) / 8, h - 0.16, 0], { axis: 'z', seg: 6, bevel: 0 })
      for (const z of [-1, 1]) k.cyl('steel', 0.005, w - 0.1, [0, h - 0.16, z * (d / 2 - 0.08)], { axis: 'x', seg: 6 })
    } else {
      k.box('steel', [w - 0.1, 0.012, d - 0.12], [0, h - 0.17, -0.01], { r: 0.003 })
      for (const x of [-1, 1]) k.box('steel', [0.012, 0.11, d - 0.12], [x * (w / 2 - 0.05), h - 0.11, -0.01], { r: 0.003 })
      k.box('steel', [w - 0.1, 0.11, 0.012], [0, h - 0.11, -d / 2 + 0.05], { r: 0.003 })
      for (let i = 0; i < 3; i++) k.blk('paper', [0.22, 0.02 + k.rnd() * 0.02, 0.29], -w * 0.15 + i * 0.05, h - 0.164, k.jitter(0.03), { r: 0.003, yaw: k.jitter(0.1), tint: [[0.8, 0.3, 0.3], [0.3, 0.5, 0.7], [0.5, 0.65, 0.3]][i] as V3 })
    }
    k.frame({ at: [0, h - 0.012, -d / 2 + 0.03] }, () => k.leaf({
      kind: 'lid', pivot: k.point([0, 0, 0]), axis: k.direction([-1, 0, 0]), travel: 1.75, initial: -lid,
      handle: k.point([0, 0.006, d - 0.018]), normal: k.direction([0, 1, 0]), up: k.direction([0, 0, -1]),
      center: k.point([0, 0, d / 2 - 0.03]), width: w, height: d, depth: 0.024, floor: k.point([0, -0.15, d / 2 - 0.03]),
    }, () => k.frame({ pitch: lid }, () => {
      k.box('wood', [w, 0.024, d], [0, 0, d / 2 - 0.03], { r: 0.008 })
      k.box('rubber', [w * 0.5, 0.006, 0.012], [0, 0.011, 0.02], { r: 0.002, tone: 0.6 })
      k.cyl('steel', 0.016, 0.008, [w * 0.35, 0.009, 0.03], { seg: 14, tone: 0.5 })
    })))
    if (v === 2) for (const x of [-1, 1]) k.hinge([x * w * 0.3, h - 0.014, -d / 2 + 0.03], 0.06, { roll: Math.PI / 2, yaw: Math.PI })
  },

  workbench: (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.06, post = 0.085
    const strips = Math.round(d / 0.1)
    for (let i = 0; i < strips; i++) k.plank('wood', w, d / strips - 0.004, top, [0, h - top / 2 + k.jitter(0.002), -d / 2 + (i + 0.5) * d / strips], { wear: 0.4 })
    for (let i = 0; i < Math.floor(w / 0.2); i++) k.cyl('rubber', 0.01, 0.004, [-w / 2 + 0.15 + i * 0.2, h + 0.0005, d / 2 - 0.08], { seg: 10, tone: 0.3 })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('wood', [post, h - top, post], x * (w / 2 - post / 2 - 0.04), 0, z * (d / 2 - post / 2 - 0.02), { r: 0.006 })
    for (const x of [-1, 1]) for (const y of [0.15, h - top - 0.07]) k.box('wood', [0.05, 0.08, d - 0.04], [x * (w / 2 - post / 2 - 0.04), y, 0], { r: 0.006 })
    for (const z of [-1, 1]) k.box('wood', [w - 0.1, 0.1, 0.035], [0, h - top - 0.05, z * (d / 2 - 0.035)], { r: 0.006 })
    const shelfN = 5
    for (let i = 0; i < shelfN; i++) k.plank('wood', w - 0.2, (d - 0.08) / shelfN - 0.008, 0.022, [0, 0.2, -d / 2 + 0.04 + (i + 0.5) * (d - 0.08) / shelfN], { nails: true })
    for (const x of [-1, 1]) for (const z of [-1, 1]) for (const y of [0.15, h - top - 0.07]) k.bolt([x * (w / 2 - 0.04 - post), y, z * (d / 2 - post / 2 - 0.02)], { yaw: x * Math.PI / 2, r: 0.008 })
    const vx = v === 1 ? -w / 2 + 0.2 : w / 2 - 0.22
    k.frame({ at: [vx, h - 0.1, d / 2 - 0.02] }, () => {
      k.box('wood', [0.28, 0.16, 0.03], [0, 0, 0.015], { r: 0.008 })
      k.cyl('steel', 0.016, 0.02, [0, -0.02, 0.04], { axis: 'z', seg: 14 })
      k.cyl('steel', 0.008, 0.26, [0, -0.02, 0.052], { axis: 'x', seg: 10 })
      for (const x of [-1, 1]) k.sphere('steel', 0.013, [x * 0.13, -0.02, 0.052], { rows: 6, seg: 10 })
      for (const x of [-1, 1]) k.cyl('steel', 0.009, 0.03, [x * 0.1, -0.02, 0.032], { axis: 'z', seg: 8 })
    })
    if (v >= 1) {
      k.frame({ at: [w * 0.05, h, 0.05], yaw: 0.4 }, () => { k.box('steel', [0.24, 0.05, 0.06], [0, 0.03, 0], { r: 0.01 }); k.box('wood', [0.11, 0.07, 0.025], [0.04, 0.085, 0], { r: 0.008 }); k.box('steel', [0.05, 0.02, 0.045], [-0.05, 0.065, 0], { pitch: 0.4 }) })
      k.frame({ at: [-w * 0.2, h, -0.1], yaw: -0.7 }, () => { k.cyl('wood', 0.012, 0.3, [0.15, 0.012, 0], { axis: 'x', seg: 10 }); k.box('wood', [0.07, 0.07, 0.12], [0, 0.035, 0], { r: 0.008 }) })
    }
    drawer(k, 'wood', 0.42, 0.09, [0, h - top - 0.065, d / 2 - 0.02], { flat: true, handle: 'cup' })
  },

  'lab-bench': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.03
    const inner = carcass(k, 'paint', w - 0.02, h - top, d - 0.05, { plinth: 0.09, z: -0.02, top: 0.015, back: true, t: 0.02 })
    k.box('tile', [w, top, d], [0, h - top / 2, 0], { r: 0.006 })
    k.box('tile', [w, 0.008, 0.012], [0, h - top - 0.004, d / 2 - 0.006], { r: 0.003 })
    const bays = Math.max(2, Math.round(inner / 0.5)), bw = inner / bays
    for (let i = 0; i < bays; i++) {
      const x = -inner / 2 + (i + 0.5) * bw
      if (i === bays - 1 || (v === 0 && i === 0)) {
        for (let j = 0; j < 3; j++) drawer(k, 'paint', bw - 0.008, (h - 0.15 - top) / 3 - 0.008, [x, 0.095 + (j + 0.5) * (h - 0.15 - top) / 3, d / 2 - 0.045], { handle: 'bar', hm: 'steel', label: j === 2 })
      } else door(k, 'paint', bw - 0.008, h - 0.15 - top, [x, 0.095 + (h - 0.15 - top) / 2, d / 2 - 0.045], { style: 'flat', hinge: i % 2 ? 1 : -1, handle: 'bar' })
    }
    for (let i = 0; i < (v === 1 ? 2 : 3); i++) k.frame({ at: [-w * 0.35 + i * 0.12, h - 0.06, d / 2 - 0.002] }, () => { k.cyl('steel', 0.012, 0.03, [0, 0, 0.012], { axis: 'z', seg: 12 }); k.cyl('paint', 0.008, 0.035, [0, 0, 0.035], { axis: 'x', seg: 10, tint: [0.9, 0.7, 0.2] }) })
    if (v === 1) {
      k.box('steel', [0.4, 0.004, 0.3], [w * 0.3, h + 0.002, -0.02], { r: 0.003 })
      k.box('rubber', [0.34, 0.004, 0.24], [w * 0.3, h + 0.003, -0.02], { r: 0.003, tone: 0.3 })
      k.tube('steel', [[w * 0.3, h, -d / 2 + 0.08], [w * 0.3, h + 0.26, -d / 2 + 0.08], [w * 0.3, h + 0.26, -d / 2 + 0.2], [w * 0.3, h + 0.19, -d / 2 + 0.2]], 0.009, { fillet: 0.06 })
      for (const x of [-1, 1]) k.lathe('steel', [[0, 0], [0.008, 0], [0.008, 0.03], [0.02, 0.035], [0.02, 0.045], [0, 0.045]], [w * 0.3 + x * 0.06, h, -d / 2 + 0.08], { seg: 10 })
    }
    if (v === 2) {
      for (const x of [-1, 1]) k.blk('steel', [0.02, 0.18, 0.02], x * (w / 2 - 0.08), h, -d / 2 + 0.06, { r: 0.004 })
      k.box('tile', [w - 0.12, 0.02, 0.16], [0, h + 0.17, -d / 2 + 0.1], { r: 0.004 })
      for (let i = 0; i < 8; i++) k.lathe('glass', [[0, 0], [0.022, 0], [0.023, 0.06], [0.01, 0.08], [0.01, 0.095], [0, 0.095]], [-w / 2 + 0.15 + i * (w - 0.3) / 7, h + 0.18, -d / 2 + 0.1], { seg: 12, tint: [[0.7, 0.4, 0.3], [0.4, 0.6, 0.4], [0.5, 0.5, 0.8]][i % 3] as V3 })
    }
    for (let i = 0; i < 4; i++) k.lathe('glass', [[0, 0], [0.03, 0], [0.032, 0.1 + i * 0.01], [0.036, 0.11 + i * 0.01], [0, 0.11]], [-w * 0.1 + i * 0.09, h, d * 0.1 + k.jitter(0.05)], { seg: 16 })
    k.frame({ at: [w * 0.05, h, -0.05] }, () => {
      k.box('steel', [0.22, 0.04, 0.08], [0, 0.06, 0], { r: 0.004 })
      for (const x of [-1, 1]) k.box('steel', [0.01, 0.06, 0.08], [x * 0.1, 0.03, 0])
      for (let i = 0; i < 6; i++) k.cyl('glass', 0.008, 0.15, [-0.08 + i * 0.032, 0.075, 0], { seg: 8 })
    })
  },
}
