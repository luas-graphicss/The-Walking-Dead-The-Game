import { noise3, type Family, type Kit, type V2, type V3 } from '../kit'
import { carton, door, drawer, mattress, pillow } from './common'

const KRAFT: V3 = [0.8, 0.62, 0.42]
const TAPE: V3 = [0.94, 0.86, 0.66]
const LABELS: V3[] = [[0.85, 0.3, 0.25], [0.3, 0.5, 0.8], [0.9, 0.75, 0.3], [0.35, 0.65, 0.35], [0.95, 0.95, 0.9], [0.55, 0.35, 0.6]]
const CLOTH: V3[] = [[0.42, 0.48, 0.62], [0.7, 0.32, 0.28], [0.55, 0.58, 0.42], [0.82, 0.78, 0.7], [0.3, 0.3, 0.34], [0.62, 0.5, 0.36]]
const DRY_LEAF: V3 = [0.58, 0.44, 0.24]

function cardboard(k: Kit, w: number, h: number, d: number, at: V3, o: { yaw?: number; open?: boolean } = {}) {
  const tint = KRAFT.map((c) => c * (0.88 + k.rnd() * 0.2)) as V3, wall = 0.005
  k.frame({ at, yaw: o.yaw ?? 0 }, () => {
    if (!o.open) {
      k.box('paper', [w, h, d], [0, h / 2, 0], { r: 0.004, tint, tone: 0.95 })
      k.box('paper', [0.05, 0.0015, d + 0.002], [0, h + 0.0008, 0], { r: 0, tint: TAPE })
      for (const s of [-1, 1]) k.box('paper', [0.05, 0.08, 0.0015], [0, h - 0.04, s * (d / 2 + 0.0008)], { r: 0, tint: TAPE })
      if (k.chance(0.7)) k.box('paper', [Math.min(0.14, w * 0.4), Math.min(0.09, h * 0.35), 0.0012], [w * 0.18, h * 0.56, d / 2 + 0.0007], { r: 0, tint: [0.97, 0.96, 0.92] })
      return
    }

    k.box('paper', [w, wall, d], [0, wall / 2, 0], { r: 0, tint })
    for (const s of [-1, 1]) {
      k.box('paper', [w, h - wall, wall], [0, wall + (h - wall) / 2, s * (d / 2 - wall / 2)], { r: 0.001, tint })
      k.box('paper', [wall, h - wall, d - 2 * wall], [s * (w / 2 - wall / 2), wall + (h - wall) / 2, 0], { r: 0.001, tint })
    }
    for (const s of [-1, 1]) {
      k.frame({ at: [0, h, s * d / 2], pitch: s * (2.15 + k.jitter(0.3)) }, () => k.box('paper', [w - 0.006, 0.003, d / 2 - 0.006], [0, 0.0015, -s * (d / 4)], { r: 0, tint }))
      k.frame({ at: [s * w / 2, h, 0], roll: -s * (2.0 + k.jitter(0.35)) }, () => k.box('paper', [w / 2 - 0.006, 0.003, d - 0.012], [-s * (w / 4), 0.0015, 0], { r: 0, tint }))
    }
    for (let i = 0; i < 3; i++) carton(k, k.range(0.08, 0.16), k.range(0.06, Math.min(0.16, h * 0.6)), k.range(0.06, 0.12), [k.jitter(w * 0.22), wall, k.jitter(d * 0.2)], k.pick(LABELS), { yaw: k.jitter(0.6) })
  })
}

function trashBag(k: Kit, w: number, h: number, d: number, at: V3, tint: V3) {
  const r = 0.5, seed = k.rnd() * 50
  const profile: V2[] = [[0, 0], [r * 0.72, 0], [r * 0.95, 0.1], [r, 0.38], [r * 0.92, 0.66], [r * 0.6, 0.84], [r * 0.2, 0.92], [r * 0.13, 1], [0, 1]]
  k.lathe('rubber', profile, at, {
    seg: 18, crease: 70, tint, tone: 0.9 + k.rnd() * 0.15, scale: [w, h, d],
    wear: (x, y, z) => (noise3(x * 5 + seed, y * 4, z * 5, 3) - 0.5) * 0.14 * Math.min(1, y * 3) * (1 - y * 0.5),
  })
  for (const s of [-1, 1]) k.sphere('rubber', 0.035, [at[0] + s * 0.03, at[1] + h + 0.006, at[2]], { rows: 6, seg: 10, scale: [1.6, 0.7, 0.8], roll: s * 0.6, tint })
}

function dryStem(k: Kit, base: V3, height: number, lean: number, heading: number) {
  const dx = Math.cos(heading) * lean, dz = Math.sin(heading) * lean
  const points: V3[] = [base, [base[0] + dx * 0.25, base[1] + height * 0.45, base[2] + dz * 0.25], [base[0] + dx * 0.7, base[1] + height * 0.85, base[2] + dz * 0.7], [base[0] + dx * 1.25, base[1] + height * 0.92, base[2] + dz * 1.25]]
  k.tube('wood', points, 0.006, { seg: 6, fillet: 0.08, tint: [0.7, 0.6, 0.42] })
  for (let i = 1; i < 4; i++) {
    const t = i / 4, p = points[Math.min(3, Math.round(t * 3))]
    k.sphere('paper', 0.04, [p[0] + k.jitter(0.02), p[1] - 0.02, p[2] + k.jitter(0.02)], { rows: 4, seg: 8, scale: [1, 0.18, 0.5], yaw: heading + k.jitter(1), roll: 0.5 + k.jitter(0.4), tint: DRY_LEAF })
  }
}

export const INTERIOR: Family = {
  'tv-stand': (k) => {
    const { w, d } = k, base = 0.5, t = 0.02

    for (const s of [-1, 1]) k.blk('wood', [t, base - 0.06, d], s * (w - t) / 2, 0.06, 0)
    k.blk('wood', [w - 2 * t, 0.06, t], 0, 0, d / 2 - 0.04, { tone: 0.7 })
    k.blk('wood', [w - 2 * t, t, d - 0.01], 0, 0.06, -0.005)
    k.blk('wood', [w + 0.02, 0.025, d + 0.01], 0, base - 0.025, 0.005, { r: 0.006 })
    k.blk('wood', [w - 2 * t, base - 0.105, 0.008], 0, 0.08, -d / 2 + 0.004)
    k.blk('wood', [t, base - 0.105, d - 0.03], -w * 0.05, 0.08, -0.005)
    door(k, 'wood', w / 2 - 0.045, base - 0.12, [-w / 4 - 0.01, 0.06 + t + (base - 0.12) / 2, d / 2 - 0.02], { style: 'shaker', hinge: -1, handle: 'knob', t: 0.018 })
    k.blk('wood', [w / 2 - 0.03, t, d - 0.04], w / 4 - 0.01, 0.25, -0.01)
    k.frame({ at: [w / 4 - 0.01, 0.27, 0] }, () => {
      k.blk('charcoal', [0.36, 0.08, 0.28], 0, 0, 0, { r: 0.006 })
      k.box('glass', [0.1, 0.018, 0.002], [0.09, 0.05, 0.141], { r: 0 })
      k.box('rubber', [0.2, 0.012, 0.004], [-0.06, 0.04, 0.141], { r: 0.001 })
    })

    k.frame({ at: [-w * 0.04, base, -d / 2 + 0.22] }, () => {
      const tw = 0.64, th = 0.46
      k.blk('charcoal', [tw, th, 0.24], 0, 0, 0.06, { r: 0.03 })
      k.blk('charcoal', [tw * 0.7, th * 0.72, 0.16], 0, 0.04, -0.13, { r: 0.04 })
      k.frameRect('rubber', tw * 0.76, th * 0.82, 0.03, 0.012, [-tw * 0.08, th * 0.5, 0.185])
      k.box('glass', [tw * 0.7, th * 0.74, 0.012], [-tw * 0.08, th * 0.5, 0.184], { r: 0.02 })
      for (let i = 0; i < 2; i++) k.knob([tw * 0.38, th * (0.62 - i * 0.18), 0.18], 0.014, { m: 'rubber' })
      k.vent([tw * 0.38, th * 0.2, 0.18], 0.08, 0.1, { m: 'charcoal', slats: 5 })
      k.sphere('steel', 0.03, [0, th, -0.02], { rows: 5, seg: 10, scale: [1.4, 0.6, 1] })
      for (const s of [-1, 1]) k.tube('steel', [[s * 0.02, th + 0.01, -0.02], [s * 0.2, th + 0.42, -0.06]], 0.0035, { seg: 6 })
    })
  },

  'coffee-table': (k) => {
    const { w, h, d } = k, top = 0.04, leg = 0.05
    k.blk('wood', [w, top, d], 0, h - top, 0, { r: 0.012 })
    const dw = Math.min(0.5, w * 0.42), rail = (w - 0.16 - dw) / 2 - 0.004
    k.box('wood', [w - 0.16, 0.07, 0.022], [0, h - top - 0.035, -(d / 2 - 0.06)], { r: 0.004 })
    for (const s of [-1, 1]) {
      k.box('wood', [rail, 0.07, 0.022], [s * (dw / 2 + 0.004 + rail / 2), h - top - 0.035, d / 2 - 0.06], { r: 0.004 })
      k.box('wood', [0.022, 0.07, d - 0.16], [s * (w / 2 - 0.06), h - top - 0.035, 0], { r: 0.004 })
    }
    drawer(k, 'wood', dw, 0.062, [0, h - top - 0.035, d / 2 - 0.049], { handle: 'knob', flat: true })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.lathe('wood', [[0, 0], [leg * 0.32, 0], [leg * 0.42, (h - top) * 0.7], [leg * 0.5, h - top], [0, h - top]], [x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06)], { seg: 12 })
    k.blk('wood', [w - 0.18, 0.022, d - 0.1], 0, 0.08, 0, { r: 0.004 })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.box('wood', [0.05, 0.03, 0.05], [x * (w / 2 - 0.06), 0.08 + 0.011, z * (d / 2 - 0.06)], { r: 0.004, tone: 0.9 })

    for (let i = 0; i < 4; i++) k.box('paper', [0.21, 0.006, 0.28], [-w * 0.18 + k.jitter(0.02), 0.102 + 0.003 + i * 0.0065, k.jitter(0.03)], { yaw: k.jitter(0.35), r: 0.001, tint: k.pick(LABELS) })
    k.box('rubber', [0.05, 0.022, 0.17], [w * 0.2, h + 0.011, -d * 0.12], { yaw: 0.4, r: 0.008, tint: [0.25, 0.25, 0.27] })
    k.lathe('tile', [[0, 0], [0.038, 0], [0.042, 0.09], [0.038, 0.09], [0.034, 0.008], [0, 0.008]], [-w * 0.22, h, d * 0.15], { seg: 16, tint: [0.9, 0.88, 0.82] })
    k.torus('tile', 0.026, 0.006, [-w * 0.22 + 0.052, h + 0.048, d * 0.15], { axis: 'z', seg: 6, segR: 14, tint: [0.9, 0.88, 0.82] })
  },

  'kitchen-counter': (k, s) => {
    const { w, d } = k, t = 0.018, front = d / 2 - 0.04, plinth = 0.1
    for (const sx of [-1, 1]) k.blk('wood', [t, 0.76, d - 0.04], sx * (w - t) / 2, plinth, -0.02)
    k.blk('wood', [w - 2 * t, t, d - 0.06], 0, plinth, -0.03)
    k.blk('wood', [w - 2 * t, 0.76 - t, 0.008], 0, plinth + t, -d / 2 + 0.004)
    k.blk('charcoal', [w - 0.04, plinth, 0.02], 0, 0, front - 0.06, { tone: 0.8 })
    const leaves = w > 0.8 ? 2 : 1, leafW = (w - 0.03) / leaves - (leaves > 1 ? 0.005 : 0), drawerH = 0.13
    for (let i = 0; i < leaves; i++) {
      const x = -w / 2 + 0.015 + leafW / 2 + i * (leafW + 0.01)
      drawer(k, 'wood', leafW, drawerH, [x, plinth + 0.76 - drawerH / 2 - 0.02, front], { handle: 'bar' })
      door(k, 'wood', leafW, 0.76 - drawerH - 0.07, [x, plinth + 0.03 + (0.76 - drawerH - 0.07) / 2, front], { style: s.variant === 2 ? 'panel2' : 'shaker', hinge: i === 0 ? -1 : 1, handle: 'bar', t: 0.018 })
    }

    k.blk('tile', [w, 0.04, d], 0, 0.86, 0, { r: 0.008, tint: [0.92, 0.9, 0.86] })
    k.blk('tile', [w, 0.1, 0.012], 0, 0.9, -d / 2 + 0.006, { r: 0.002, tint: [0.86, 0.88, 0.86] })
    k.blk('wood', [Math.min(0.32, w * 0.4), 0.018, 0.22], -w * 0.18, 0.9, 0.04, { yaw: 0.15, r: 0.006, tone: 1.05 })
    k.lathe('glass', [[0, 0], [0.045, 0], [0.047, 0.12], [0.036, 0.14], [0, 0.14]], [w * 0.28, 0.9, -0.12], { seg: 14, tint: [0.8, 0.85, 0.8] })
    k.cyl('steel', 0.04, 0.02, [w * 0.28, 0.9 + 0.15, -0.12], { seg: 14 })
  },

  'wall-cabinet': (k) => {
    const { w, h, d } = k, t = 0.018
    for (const s of [-1, 1]) k.blk('wood', [t, h, d - 0.02], s * (w - t) / 2, 0, -0.01)
    for (const y of [0, h - t]) k.blk('wood', [w - 2 * t, t, d - 0.03], 0, y, -0.015)
    k.blk('wood', [w - 2 * t, h - 2 * t, 0.008], 0, t, -d / 2 + 0.004)
    k.blk('wood', [w + 0.03, 0.03, d + 0.01], 0, h - 0.002, -0.005, { r: 0.006 })
    k.box('wood', [w + 0.05, 0.025, 0.03], [0, h + 0.028 + 0.0125, d / 2 - 0.005], { r: 0.01 })
    const leaves = w > 0.7 ? 2 : 1, leafW = (w - 0.02) / leaves - (leaves > 1 ? 0.005 : 0)
    for (let i = 0; i < leaves; i++) {
      const x = -w / 2 + 0.01 + leafW / 2 + i * (leafW + 0.01)
      door(k, 'wood', leafW, h - 0.04, [x, h / 2, d / 2 - 0.02], { style: 'shaker', hinge: i === 0 ? -1 : 1, handle: 'bar', t: 0.018 })
    }
  },

  'display-table': (k) => {
    const { w, h, d } = k, top = 0.06, leg = 0.06
    k.blk('wood', [w, top, d], 0, h - top, 0, { r: 0.01 })
    const dw = Math.min(0.6, w * 0.38), rail = (w - 0.12 - dw) / 2 - 0.004
    k.box('wood', [w - 0.12, 0.1, 0.025], [0, h - top - 0.05, -(d / 2 - 0.045)], { r: 0.004 })
    for (const s of [-1, 1]) {
      k.box('wood', [rail, 0.1, 0.025], [s * (dw / 2 + 0.004 + rail / 2), h - top - 0.05, d / 2 - 0.045], { r: 0.004 })
      k.box('wood', [0.025, 0.1, d - 0.12], [s * (w / 2 - 0.045), h - top - 0.05, 0], { r: 0.004 })
    }
    drawer(k, 'wood', dw, 0.088, [0, h - top - 0.05, d / 2 - 0.0325], { handle: 'bar', flat: true })
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      k.blk('wood', [leg, h - top, leg], x * (w / 2 - 0.03 - leg / 2), 0, z * (d / 2 - 0.03 - leg / 2), { r: 0.008 })
      k.cyl('rubber', leg * 0.4, 0.012, [x * (w / 2 - 0.03 - leg / 2), 0.006, z * (d / 2 - 0.03 - leg / 2)], { seg: 10 })
    }
    k.blk('wood', [w - 0.18, 0.03, d - 0.06], 0, 0.14, 0, { r: 0.004 })

    const surface = h
    for (let stack = 0; stack < 3; stack++) {
      const x = -w * 0.32 + stack * 0.2, tint = k.pick(CLOTH)
      let y = surface
      for (let i = 0; i < 3 + Math.floor(k.rnd() * 3); i++) {
        k.cushion('fabric', [0.17, 0.04, 0.24], [x + k.jitter(0.008), y + 0.02, -0.12 + k.jitter(0.008)], { puff: 0.008, r: 0.012, wrinkle: 0.6, yaw: k.jitter(0.06), tint: tint.map((c) => c * (0.9 + k.rnd() * 0.2)) as V3 })
        y += 0.038
      }
    }
    for (let i = 0; i < 3; i++) carton(k, 0.11 + k.rnd() * 0.05, 0.08 + k.rnd() * 0.06, 0.13, [w * 0.18 + i * 0.13, surface, 0.16 + k.jitter(0.02)], k.pick(LABELS), { yaw: k.jitter(0.12) })
    k.box('steel', [0.05, 0.004, 0.04], [w * 0.38, surface + 0.002, -0.2], { r: 0.001 })
    k.cyl('steel', 0.002, 0.1, [w * 0.38, surface + 0.054, -0.2], { seg: 6 })
    k.box('paper', [0.1, 0.07, 0.002], [w * 0.38, surface + 0.125, -0.2], { r: 0, pitch: -0.15, tint: [0.98, 0.95, 0.85] })
    for (let i = 0; i < 2; i++) cardboard(k, 0.3, 0.2, 0.26, [-w * 0.22 + i * 0.42, 0.17, k.jitter(0.06)], { yaw: k.jitter(0.2) })
  },

  'coat-rack': (k) => {
    const { w, h } = k, top = h - 0.06
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, reach = w / 2 - 0.04
      k.tube('wood', [[0, 0.07, 0], [Math.cos(a) * reach * 0.55, 0.05, Math.sin(a) * reach * 0.55], [Math.cos(a) * reach, 0.016, Math.sin(a) * reach]], 0.016, { seg: 8, fillet: 0.06 })
      k.sphere('rubber', 0.018, [Math.cos(a) * reach, 0.012, Math.sin(a) * reach], { rows: 5, seg: 10, scale: [1, 0.6, 1] })
    }
    k.lathe('wood', [[0, 0.02], [0.04, 0.02], [0.045, 0.06], [0.03, 0.12], [0.024, 0.2], [0.02, top - 0.12], [0.026, top - 0.08], [0.02, top - 0.05], [0.024, top], [0, top]], [0, 0, 0], { seg: 14 })
    k.lathe('wood', [[0, 0], [0.026, 0], [0.034, 0.03], [0.02, 0.06], [0, 0.065]], [0, top, 0], { seg: 14 })
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, y = top - 0.06 - (i % 2) * 0.1
      k.tube('wood', [[Math.cos(a) * 0.02, y, Math.sin(a) * 0.02], [Math.cos(a) * 0.09, y + 0.02, Math.sin(a) * 0.09], [Math.cos(a) * 0.13, y + 0.07, Math.sin(a) * 0.13]], 0.007, { seg: 6, fillet: 0.03 })
      k.sphere('wood', 0.011, [Math.cos(a) * 0.13, y + 0.075, Math.sin(a) * 0.13], { rows: 5, seg: 8 })
    }

    k.frame({ at: [0.1, top - 0.1, 0.02], yaw: 0.3 }, () => {
      k.cushion('fabric', [0.34, 0.66, 0.1], [0.04, -0.36, 0.05], { puff: 0.02, r: 0.04, wrinkle: 0.9, roll: -0.05, tint: [0.36, 0.3, 0.26] })
      for (const s of [-1, 1]) k.cushion('fabric', [0.09, 0.56, 0.09], [0.04 + s * 0.2, -0.38, 0.05], { puff: 0.015, r: 0.035, roll: s * 0.06, tint: [0.33, 0.28, 0.24] })
      k.cushion('fabric', [0.2, 0.08, 0.12], [0.04, 0.0, 0.05], { puff: 0.02, r: 0.03, tint: [0.33, 0.28, 0.24] })
    })
    k.frame({ at: [-0.12, top - 0.02, -0.06], roll: 0.35, yaw: 1.2 }, () => {
      k.lathe('fabric', [[0, 0], [0.15, 0], [0.155, 0.008], [0.09, 0.012], [0.085, 0.09], [0.06, 0.11], [0, 0.112]], [0, 0, 0], { seg: 20, tint: [0.24, 0.22, 0.2] })
      k.cyl('fabric', 0.087, 0.022, [0, 0.025, 0], { seg: 20, caps: false, tint: [0.12, 0.1, 0.1] })
    })
  },

  'wall-art': (k) => {
    const { w, h, d } = k, bar = 0.045, palette = k.pick([[[0.55, 0.68, 0.8], [0.42, 0.55, 0.36], [0.3, 0.4, 0.25]], [[0.85, 0.7, 0.45], [0.7, 0.45, 0.3], [0.4, 0.28, 0.2]], [[0.6, 0.62, 0.7], [0.75, 0.72, 0.62], [0.35, 0.36, 0.42]]] as V3[][])

    for (const y of [-1, 1]) k.box('wood', [w, bar, d], [0, h / 2 + y * (h / 2 - bar / 2), 0], { r: 0.008, tint: [0.62, 0.46, 0.3] })
    for (const x of [-1, 1]) k.box('wood', [bar, h - 2 * bar, d], [x * (w / 2 - bar / 2), h / 2, 0], { r: 0.008, tint: [0.62, 0.46, 0.3] })
    k.frameRect('wood', w - 2 * bar + 0.01, h - 2 * bar + 0.01, 0.012, 0.012, [0, h / 2, d / 2 - 0.012], { tone: 0.75 })
    const iw = w - 2 * bar, ih = h - 2 * bar, z = -d / 2 + 0.012
    k.box('paper', [iw, ih, 0.004], [0, h / 2, z], { r: 0, tint: [0.95, 0.93, 0.86] })

    const pw = iw * 0.82, ph = ih * 0.78
    k.box('paper', [pw, ph * 0.5, 0.002], [0, h / 2 + ph * 0.25, z + 0.003], { r: 0, tint: palette[0] })
    k.extrude('paper', [[-pw / 2, 0], [pw / 2, 0], [pw / 2, ph * 0.22], [pw * 0.2, ph * 0.34], [-pw * 0.1, ph * 0.26], [-pw * 0.32, ph * 0.4], [-pw / 2, ph * 0.3]], 0.002, [0, h / 2 - ph * 0.12, z + 0.0045], { tint: palette[1] })
    k.box('paper', [pw, ph * 0.38, 0.002], [0, h / 2 - ph * 0.31, z + 0.006], { r: 0, tint: palette[2] })
    k.sphere('paper', 0.035, [pw * 0.28, h / 2 + ph * 0.34, z + 0.0055], { rows: 4, seg: 12, scale: [1, 1, 0.05], tint: [0.98, 0.9, 0.7] })
  },

  rug: (k) => {
    const { w, d } = k, seed = k.rnd() * 20, base = k.pick([[0.6, 0.22, 0.18], [0.24, 0.3, 0.45], [0.5, 0.42, 0.3]] as V3[])
    const ripple = (x: number, z: number) => (noise3(x * 1.7 + seed, z * 1.7, seed, 5) - 0.5) * 0.006
    k.sheet('fabric', w - 0.06, d, (x, z) => 0.008 + ripple(x, z), [0, 0, 0], { nx: Math.ceil(w / 0.1), nz: Math.ceil(d / 0.1), thickness: 0.006, tint: base })

    k.sheet('fabric', w - 0.26, d - 0.2, (x, z) => 0.0092 + ripple(x, z), [0, 0, 0], { nx: Math.ceil(w / 0.1), nz: Math.ceil(d / 0.1), tint: [0.86, 0.78, 0.6] })
    k.sheet('fabric', w - 0.36, d - 0.3, (x, z) => 0.0102 + ripple(x, z), [0, 0, 0], { nx: Math.ceil(w / 0.1), nz: Math.ceil(d / 0.1), tint: base.map((c) => c * 0.75) as V3 })
    k.frame({ at: [0, 0.0112, 0] }, () => k.sheet('fabric', Math.min(0.7, w * 0.35), Math.min(0.5, d * 0.35), (x, z) => ripple(x, z), [0, 0, 0], { nx: 8, nz: 6, tint: [0.88, 0.74, 0.45] }))
    for (const s of [-1, 1]) for (let i = 0; i < Math.round(d / 0.03); i++) {
      const z = -d / 2 + (i + 0.5) * d / Math.round(d / 0.03)
      k.box('fabric', [0.05, 0.003, 0.008], [s * (w / 2 - 0.03 + 0.024), 0.004, z], { r: 0, yaw: k.jitter(0.25), tint: [0.9, 0.86, 0.76] })
    }
  },

  mattress: (k) => {
    const { w, d } = k
    mattress(k, 'fabric', [w, 0.19, d], [0, 0.095, 0], { quilt: [Math.round(w / 0.24), Math.round(d / 0.3)] })

    pillow(k, 'fabric', w * 0.6, 0.36, [0, 0.235, -d / 2 + 0.27], { pitch: -0.1, tint: [0.92, 0.9, 0.84] })
    const seed = k.rnd() * 10, tint = k.pick(CLOTH)
    k.sheet('fabric', w + 0.1, d * 0.55, (x, z) => 0.21 + Math.max(0, Math.sin(x * 9 + seed) * 0.025 + Math.sin(z * 7 + seed * 2) * 0.02) - Math.max(0, x - w / 2 + 0.05) * 1.6, [0.05, 0, d * 0.18], { nx: 22, nz: 14, thickness: 0.01, tint })
  },

  'sleeping-bag': (k) => {
    const { w, d } = k, body = d - 0.26, tint = k.pick([[0.32, 0.4, 0.28], [0.25, 0.32, 0.5], [0.55, 0.28, 0.2]] as V3[])
    k.cushion('fabric', [w, 0.1, body], [0, 0.05, 0.13], { puff: 0.022, r: 0.04, tufts: [1, Math.round(body / 0.22)], wrinkle: 0.9, tint })
    k.cushion('fabric', [w * 0.82, 0.12, 0.26], [0, 0.06, -d / 2 + 0.13], { puff: 0.03, r: 0.05, wrinkle: 0.8, tint: tint.map((c) => c * 0.85) as V3 })

    k.frame({ at: [w * 0.2, 0.1, -body / 2 + 0.36], yaw: -0.4 }, () => k.cushion('fabric', [w * 0.42, 0.025, 0.36], [0, 0.012, 0], { puff: 0.008, r: 0.01, tint: [0.82, 0.78, 0.66] }))
    k.box('steel', [0.008, 0.008, body - 0.1], [w / 2 - 0.004, 0.06, 0.13], { r: 0.002, tint: [0.4, 0.4, 0.42] })
    k.box('steel', [0.02, 0.006, 0.035], [w / 2 + 0.002, 0.065, -body / 2 + 0.28], { r: 0.002 })
    k.cyl('fabric', 0.012, w * 0.4, [w * 0.05, 0.13, -d / 2 + 0.13], { axis: 'x', seg: 8, tint: [0.2, 0.2, 0.2] })
  },

  'privacy-screen': (k) => {
    const { w, h, d } = k, panels = 3, post = 0.035, panel = (w - (panels + 1) * post) / panels
    const curtain: V3 = k.pick([[0.62, 0.78, 0.76], [0.85, 0.85, 0.8], [0.55, 0.66, 0.8]] as V3[])
    for (let i = 0; i < panels; i++) {
      const cx = -w / 2 + post + i * (panel + post) + panel / 2, yaw = (i - 1) * 0.22, x0 = -panel / 2 - post / 2, x1 = panel / 2 + post / 2
      k.frame({ at: [cx, 0, (i % 2 ? -1 : 1) * Math.min(0.06, d * 0.15)], yaw }, () => {

        for (const x of [x0, x1]) {
          const top = k.caster([x, 0, 0], 0.025)
          k.box('steel', [0.05, 0.02, Math.min(0.42, d)], [x, top + 0.01, 0], { r: 0.006 })
          k.cyl('steel', post / 2, h - top - 0.06, [x, top + 0.02 + (h - top - 0.06) / 2, 0], { seg: 12 })
          k.sphere('rubber', post * 0.6, [x, h - 0.03, 0], { rows: 5, seg: 10 })
        }
        for (const y of [0.32, h - 0.05]) k.cyl('steel', 0.011, x1 - x0 - post, [0, y, 0], { axis: 'x', seg: 10 })
        const pleats = Math.round(panel / 0.05), y0 = 0.36, y1 = h - 0.062
        k.frame({ at: [0, (y0 + y1) / 2, 0], pitch: -Math.PI / 2 }, () => k.sheet('fabric', panel - 0.01, y1 - y0, (x) => Math.sin(x / panel * pleats * Math.PI * 2) * 0.012, [0, 0, 0], { nx: pleats * 4, nz: 4, thickness: 0.003, tint: curtain }))
        for (let r = 0; r < pleats; r += 2) k.torus('steel', 0.012, 0.0022, [-panel / 2 + (r + 0.5) * panel / pleats, h - 0.05, 0], { axis: 'x', seg: 5, segR: 10 })
      })
    }
  },

  'floor-lamp': (k) => {
    const { w, h } = k, shadeH = 0.3, pole = h - shadeH - 0.04
    k.lathe('steel', [[0, 0], [w * 0.36, 0], [w * 0.37, 0.012], [w * 0.3, 0.03], [w * 0.08, 0.045], [0, 0.048]], [0, 0, 0], { seg: 28, tint: [0.3, 0.28, 0.26] })
    k.cyl('steel', 0.012, pole - 0.04, [0, 0.045 + (pole - 0.04) / 2, 0], { seg: 12, tint: [0.75, 0.62, 0.38] })
    for (const y of [0.5, pole - 0.02]) k.cyl('steel', 0.018, 0.03, [0, y, 0], { seg: 14, tint: [0.75, 0.62, 0.38] })
    k.cyl('steel', 0.02, 0.05, [0, pole + 0.03, 0], { seg: 12, tint: [0.3, 0.28, 0.26] })
    k.lathe('glass', [[0, 0], [0.018, 0], [0.032, 0.04], [0.028, 0.07], [0, 0.08]], [0, pole + 0.05, 0], { seg: 12, tint: [0.95, 0.92, 0.8] })

    const rb = w / 2, rt = w * 0.32, y0 = h - shadeH
    k.lathe('fabric', [[rb, y0], [rt, h], [rt - 0.006, h], [rb - 0.006, y0], [rb, y0]], [0, 0, 0], { seg: 32, crease: 30, tint: [0.88, 0.8, 0.62], wear: (x, y, z) => Math.sin(Math.atan2(z, x) * 32) * 0.002 })
    k.cyl('steel', 0.003, h - 0.04 - (pole + 0.055), [0.034, (pole + 0.055 + h - 0.04) / 2, 0], { seg: 6 })
    k.tube('steel', [[0.034, pole + 0.055, 0], [0, pole + 0.055, 0]], 0.003, { seg: 6 })
    for (const s of [-1, 1]) k.tube('steel', [[0.034, h - 0.04, 0], [s * (rt - 0.008), h - 0.004, 0]], 0.0025, { seg: 5 })
    k.cable('steel', [0.015, pole + 0.02, 0], [0.02, pole - 0.2, 0.01], 0.01, 0.0015)
  },

  'bar-stool': (k) => {
    const { w, h } = k, seat = 0.075
    k.lathe('steel', [[0, 0], [w * 0.44, 0], [w * 0.45, 0.012], [w * 0.38, 0.03], [0.04, 0.05], [0, 0.052]], [0, 0, 0], { seg: 28 })
    k.cyl('steel', 0.025, h - seat - 0.08, [0, 0.05 + (h - seat - 0.08) / 2, 0], { seg: 14 })
    k.cyl('steel', 0.034, 0.12, [0, h - seat - 0.09, 0], { seg: 14, tint: [0.4, 0.4, 0.42] })
    k.torus('steel', w * 0.3, 0.009, [0, h * 0.36, 0], { seg: 8, segR: 32 })
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; k.tube('steel', [[Math.cos(a) * 0.025, h * 0.36, Math.sin(a) * 0.025], [Math.cos(a) * w * 0.3, h * 0.36, Math.sin(a) * w * 0.3]], 0.006, { seg: 6 }) }
    k.cyl('steel', w * 0.32, 0.012, [0, h - seat - 0.006, 0], { seg: 24 })
    k.lathe('leather', [[0, 0], [w * 0.4, 0], [w * 0.43, 0.02], [w * 0.43, seat * 0.6], [w * 0.38, seat], [0, seat + 0.006]], [0, h - seat, 0], { seg: 32, tint: [0.55, 0.12, 0.1], wear: (x, y, z) => (noise3(x * 30, y * 30, z * 30, 2) - 0.5) * 0.004 })
  },

  'shopping-cart': (k) => {
    const { w, d } = k, floor = 0.46, top = 0.87, inner = d - 0.1
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.caster([x * (w / 2 - 0.08), 0, z * (d / 2 - 0.08)], 0.04)
    for (const x of [-1, 1]) k.tube('steel', [[x * (w / 2 - 0.08), 0.1, d / 2 - 0.08], [x * (w / 2 - 0.08), 0.1, -d / 2 + 0.08], [x * (w / 2 - 0.1), floor - 0.01, -inner / 2 + 0.02]], 0.012, { seg: 8, fillet: 0.05 })
    k.cyl('steel', 0.01, w - 0.16, [0, 0.1, d / 2 - 0.08], { axis: 'x', seg: 8 })
    k.cyl('steel', 0.01, w - 0.16, [0, 0.1, -d / 2 + 0.08], { axis: 'x', seg: 8 })

    for (let i = 0; i <= 8; i++) k.cyl('steel', 0.003, d - 0.2, [-w / 2 + 0.1 + i * (w - 0.2) / 8, 0.12, 0], { axis: 'z', seg: 5, bevel: 0 })
    for (const y of [floor, top]) {
      for (const z of [-1, 1]) k.cyl('steel', 0.006, w - 0.02, [0, y, z * (inner / 2 - 0.006)], { axis: 'x', seg: 8 })
      for (const x of [-1, 1]) k.cyl('steel', 0.006, inner - 0.02, [x * (w / 2 - 0.006), y, 0], { axis: 'z', seg: 8 })
    }
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.cyl('steel', 0.007, top - floor, [x * (w / 2 - 0.006), (floor + top) / 2, z * (inner / 2 - 0.006)], { seg: 8 })
    const wires = (n: number, len: number, place: (i: number) => V3, axis: 'x' | 'z' | 'y') => { for (let i = 1; i < n; i++) k.cyl('steel', 0.0028, len, place(i), { axis, seg: 5, bevel: 0 }) }
    const nx = Math.round(w / 0.05), nz = Math.round(inner / 0.05), ny = 4
    for (const z of [-1, 1]) wires(nx, top - floor, (i) => [-w / 2 + i * w / nx, (floor + top) / 2, z * (inner / 2 - 0.006)], 'y')
    for (const x of [-1, 1]) wires(nz, top - floor, (i) => [x * (w / 2 - 0.006), (floor + top) / 2, -inner / 2 + i * inner / nz], 'y')
    for (let j = 1; j < ny; j++) {
      const y = floor + j * (top - floor) / ny
      for (const z of [-1, 1]) k.cyl('steel', 0.0028, w - 0.012, [0, y, z * (inner / 2 - 0.006)], { axis: 'x', seg: 5, bevel: 0 })
      for (const x of [-1, 1]) k.cyl('steel', 0.0028, inner - 0.012, [x * (w / 2 - 0.006), y, 0], { axis: 'z', seg: 5, bevel: 0 })
    }
    wires(nx, inner - 0.012, (i) => [-w / 2 + i * w / nx, floor, 0], 'z')

    k.tube('steel', [[-w / 2 + 0.006, top, -inner / 2 + 0.006], [-w / 2 + 0.006, top + 0.03, -inner / 2 - 0.03], [w / 2 - 0.006, top + 0.03, -inner / 2 - 0.03], [w / 2 - 0.006, top, -inner / 2 + 0.006]], 0.008, { seg: 8, fillet: 0.02, caps: false })
    k.cyl('paint', 0.016, w - 0.08, [0, top + 0.03, -inner / 2 - 0.03], { axis: 'x', seg: 14, tint: [0.8, 0.2, 0.15] })
    k.box('paint', [w - 0.1, 0.16, 0.012], [0, top - 0.1, -inner / 2 + 0.03], { r: 0.004, tint: [0.8, 0.2, 0.15] })
    carton(k, 0.18, 0.12, 0.14, [-0.1, floor + 0.004, 0.08], k.pick(LABELS), { yaw: 0.3 })
  },

  'cardboard-boxes': (k) => {
    cardboard(k, 0.5, 0.36, 0.42, [-0.24, 0, -0.15], { yaw: k.jitter(0.05) })
    cardboard(k, 0.44, 0.3, 0.38, [-0.22, 0.3615, -0.14], { yaw: 0.06 + k.jitter(0.04) })
    cardboard(k, 0.3, 0.12, 0.25, [-0.2, 0.6635, -0.12], { yaw: -0.12 })
    cardboard(k, 0.46, 0.32, 0.4, [0.26, 0, 0.12], { yaw: -0.1, open: true })
  },

  'trash-bags': (k) => {
    const tints: V3[] = [[0.16, 0.16, 0.17], [0.12, 0.2, 0.14], [0.2, 0.24, 0.34]]
    trashBag(k, 0.45, 0.48, 0.42, [-0.25, 0, -0.15], k.pick(tints))
    trashBag(k, 0.42, 0.42, 0.4, [0.25, 0, -0.12], k.pick(tints))
    trashBag(k, 0.4, 0.36, 0.36, [0, 0, 0.27], k.pick(tints))
    for (let i = 0; i < 3; i++) k.box('paper', [k.range(0.05, 0.1), 0.003, k.range(0.05, 0.12)], [k.range(-0.45, 0.45), 0.0015, k.range(0.05, 0.38)], { yaw: k.rnd() * 3, r: 0, tint: k.pick(LABELS) })
  },

  'potted-plant': (k) => {
    const { w } = k, r = w * 0.4, ph = 0.42

    k.lathe('tile', [[0, 0.03], [r * 0.7, 0.03], [r * 0.95, ph - 0.06], [r * 1.06, ph - 0.05], [r * 1.08, ph], [r * 0.94, ph], [r * 0.9, ph - 0.04], [0, ph - 0.04]], [0, 0, 0], { seg: 28, crease: 60, tint: [0.78, 0.45, 0.3] })
    k.lathe('tile', [[0, 0], [r * 0.95, 0], [r * 0.98, 0.03], [r * 0.9, 0.03], [0, 0.028]], [0, 0, 0], { seg: 28, tint: [0.72, 0.42, 0.28] })
    k.cyl('charcoal', r * 0.9, 0.012, [0, ph - 0.035, 0], { seg: 24, tint: [0.5, 0.42, 0.34] })
    for (let i = 0; i < 4; i++) k.sphere('charcoal', 0.012, [k.jitter(r * 0.6), ph - 0.028, k.jitter(r * 0.6)], { rows: 4, seg: 6, tint: [0.5, 0.42, 0.34] })
    for (let i = 0; i < 7; i++) dryStem(k, [k.jitter(r * 0.35), ph - 0.03, k.jitter(r * 0.35)], k.range(0.35, 0.62), k.range(0.05, 0.16), k.rnd() * Math.PI * 2)
    for (let i = 0; i < 3; i++) k.sphere('paper', 0.04, [k.range(-w / 2, w / 2), 0.004, k.range(-w / 2, w / 2)], { rows: 4, seg: 8, scale: [1, 0.15, 0.55], yaw: k.rnd() * 3, tint: DRY_LEAF })
  },

  'step-ladder': (k) => {
    const { w, h, d } = k, top = h - 0.05, rail: V3 = [0.025, 0, 0.06]

    const front = (y: number) => d / 2 - 0.04 - (d / 2 - 0.1) * (y / top)
    const rear = (y: number) => -d / 2 + 0.04 + (d / 2 - 0.1) * (y / top)
    const lean = Math.atan2(d / 2 - 0.1, top)
    for (const x of [-1, 1]) {
      const xs = x * (w / 2 - rail[0] / 2)
      k.box('steel', [rail[0], Math.hypot(top, d / 2 - 0.1), rail[2]], [xs, top / 2, (front(0) + front(top)) / 2], { pitch: -lean, r: 0.004 })
      k.box('steel', [rail[0], Math.hypot(top, d / 2 - 0.1), 0.04], [x * (w / 2 - 0.0125 - 0.02), top / 2, (rear(0) + rear(top)) / 2], { pitch: lean, r: 0.004 })
      for (const z of [front(0), rear(0)]) k.box('rubber', [0.04, 0.03, 0.07], [xs, 0.015, z], { r: 0.008 })

      k.box('steel', [0.006, 0.02, d * 0.62], [x * (w / 2 + 0.003), top * 0.42, 0], { r: 0.002 })
    }
    for (let i = 1; i <= 3; i++) {
      const y = i * top / 4
      k.box('steel', [w - 2 * rail[0], 0.03, 0.1], [0, y, front(y) - 0.01], { r: 0.004 })
      for (let g = 0; g < 4; g++) k.box('rubber', [w - 2 * rail[0] - 0.02, 0.004, 0.012], [0, y + 0.017, front(y) - 0.045 + g * 0.024], { r: 0.001 })
    }
    for (let i = 1; i <= 2; i++) k.cyl('steel', 0.008, w - 0.06, [0, i * top / 3, rear(i * top / 3)], { axis: 'x', seg: 8 })
    k.blk('paint', [w, 0.05, 0.22], 0, top, 0, { r: 0.012, tint: [0.85, 0.65, 0.18] })
    k.box('paint', [w * 0.6, 0.012, 0.08], [0, top + 0.056, 0.02], { r: 0.004, tint: [0.25, 0.25, 0.25] })
    k.label([w * 0.25, top + 0.025, 0.1108], 0.1, 0.03)
  },
}
