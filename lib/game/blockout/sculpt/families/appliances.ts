import { arc, roundRect, type Family, type Kit, type Mat, type V2, type V3 } from '../kit'
import { carcass, door, drawer, hollow, products, shelfBoard } from './common'
import { ovenCavity } from './food'

export const rrect = (w: number, d: number, r: number, steps = 5): V2[] => roundRect(w, d, r, 0, steps).map(([x, , z]) => [x, z] as V2)

export function basin(k: Kit, m: Mat, w: number, d: number, h: number, wall: number, r: number, at: V3, o: { tint?: V3 } = {}) {
  k.extrude(m, rrect(w, d, r), h, [at[0], at[1] + h / 2, at[2]], { axis: 'y', holes: [rrect(w - 2 * wall, d - 2 * wall, Math.max(0.01, r - wall)).reverse()], bevel: Math.min(0.01, wall * 0.4), curveSeg: 6, tint: o.tint })
  k.extrude(m, rrect(w - wall, d - wall, Math.max(0.01, r - wall * 0.5)), wall, [at[0], at[1] + wall / 2, at[2]], { axis: 'y', bevel: 0.004, curveSeg: 6, tint: o.tint })
}
export function faucet(k: Kit, at: V3, reach: number, o: { yaw?: number; handles?: boolean } = {}) {
  k.frame({ at, yaw: o.yaw }, () => {
    k.cyl('steel', 0.022, 0.02, [0, 0.01, 0], { seg: 16 })
    k.tube('steel', [[0, 0.01, 0], [0, 0.2, 0], [0, 0.24, reach * 0.5], [0, 0.17, reach]], 0.011, { fillet: 0.05 })
    if (o.handles !== false) for (const x of [-1, 1]) { k.cyl('steel', 0.016, 0.05, [x * 0.09, 0.025, 0], { seg: 12 }); k.lathe('tile', [[0, 0], [0.018, 0], [0.022, 0.012], [0.01, 0.03], [0, 0.03]], [x * 0.09, 0.05, 0], { seg: 8 }) }
  })
}
export function crt(k: Kit, at: V3, w: number, h: number, o: { pitch?: number; m?: Mat } = {}) {
  k.frame({ at, pitch: o.pitch }, () => {
    k.box(o.m ?? 'paint', [w, h, 0.03], [0, 0, 0.015], { r: 0.01, tint: [0.2, 0.2, 0.22] })
    k.lathe('glass', [[0, 0], [0.5, 0], [0.49, 0.02], [0.45, 0.035], [0, 0.04]], [0, 0, 0.03], { axis: 'z', seg: 24, scale: [w * 0.85, h * 0.85, 1], crease: 20 })
  })
}

export const APPLIANCES: Family = {
  fridge: (k, s) => {
    const { w, h, d } = k, v = s.variant, body = d - 0.05, split = h * 0.68, wall = 0.035, base = 0.13
    k.blk('tile', [w, base - 0.03, body], 0, 0.03, -0.025, { r: 0.02 })
    hollow(k, 'tile', [w, h - base, body], [0, base, -0.025], wall, { r: 0.012 })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.cyl('rubber', 0.02, 0.03, [x * (w / 2 - 0.06), 0.015, z * (body / 2 - 0.08) - 0.025], { seg: 10 })
    k.vent([0, 0.08, body / 2 - 0.025], w - 0.12, 0.08, { m: 'steel' })
    const inner = (y0: number, y1: number) => {
      k.box('tile', [w - 0.06, y1 - y0, 0.004], [0, (y0 + y1) / 2, -d / 2 + 0.06], { tint: [0.85, 0.87, 0.88] })
      for (let i = 1; i < 4; i++) shelfBoard(k, 'glass', w - 0.08, body - 0.1, [0, y0 + i * (y1 - y0) / 4, -0.04], { t: 0.006 })
      for (let i = 1; i < 4; i++) products(k, i % 2 ? 'jar' : 'can', -w / 2 + 0.06, w / 2 - 0.06, y0 + i * (y1 - y0) / 4 + 0.003, -0.05, body - 0.2, { maxH: (y1 - y0) / 4 - 0.03, fill: 0.35, rows: 1 })
    }
    inner(base + wall, split - 0.015)
    k.box('tile', [w - 0.04, 0.03, body - 0.04], [0, split, -0.025], { r: 0.008 })
    shelfBoard(k, 'glass', w - 0.08, body - 0.1, [0, split + (h - split) * 0.5, -0.04], { t: 0.006 })
    if (v === 0) {
      for (const y of [split * 0.3, split * 0.9, split + 0.2]) k.hinge([-w / 2 + 0.01, y, body / 2 - 0.02], 0.06)
    } else {
      const ajar = v === 2 ? 0.08 : 0, dw = w - 0.006, front = body / 2 - 0.025
      const lower = door(k, 'tile', dw, split - 0.05, [0, 0.04 + (split - 0.05) / 2, front], { style: 'flat', hinge: -1, handle: 'none', t: 0.05, open: ajar })
      const upper = door(k, 'tile', dw, h - split - 0.04, [0, split + (h - split - 0.04) / 2, front], { style: 'flat', hinge: -1, handle: 'none', t: 0.05 })
      const swing = (leaf: number, open: number, fn: () => void) => k.within(leaf, () => k.frame({ at: [-dw / 2, 0, front], yaw: -open }, () => k.frame({ at: [dw / 2, 0, -front] }, fn)))
      const grip = (y: number, l: number) => k.frame({ at: [w / 2 - 0.05, y, body / 2 + 0.025] }, () => { k.box('steel', [0.025, l, 0.03], [0, 0, 0.03], { r: 0.008 }); for (const sy of [-1, 1]) k.box('steel', [0.02, 0.025, 0.03], [0, sy * (l / 2 - 0.02), 0.012], { r: 0.004 }) })
      swing(upper, 0, () => grip(split + 0.12, 0.18))
      swing(lower, ajar, () => {
        grip(split - 0.25, 0.4)
        for (let i = 0; i < 5; i++) k.box('paper', [0.07 + k.rnd() * 0.05, 0.09 + k.rnd() * 0.05, 0.002], [k.jitter(w * 0.3), split - 0.2 - k.rnd() * 0.5, body / 2 + 0.026], { roll: k.jitter(0.2), r: 0.0005, tint: k.pick([[1, 1, 0.7], [0.9, 0.9, 0.95], [1, 0.8, 0.8]] as V3[]) })
        for (let i = 0; i < 3; i++) k.cyl('paint', 0.012, 0.008, [k.jitter(w * 0.3), split - 0.15 - i * 0.18, body / 2 + 0.03], { axis: 'z', seg: 10, tint: k.pick([[0.9, 0.2, 0.2], [0.2, 0.5, 0.9], [0.9, 0.8, 0.2]] as V3[]) })
      })
    }
  },
  freezer: (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.box('tile', [w, h - 0.04, d], [0, 0.04 + (h - 0.04) / 2, 0], { r: 0.025 })
    k.blk('steel', [w - 0.06, 0.04, d - 0.06], 0, 0, 0, { tone: 0.5 })
    k.vent([w * 0.3, 0.14, d / 2], 0.3, 0.1, { m: 'steel' })
    k.box('steel', [w - 0.02, 0.03, d - 0.02], [0, h - 0.015, 0], { r: 0.008 })
    const panes = 2, pw = (w - 0.08) / panes
    for (let i = 0; i < panes; i++) {
      const slide = i === 1 && v !== 1 ? -pw * 0.65 : 0
      k.frame({ at: [-w / 2 + 0.04 + (i + 0.5) * pw + slide, h + 0.004 + i * 0.012, 0] }, () => {
        k.frameRect('steel', pw, d - 0.06, 0.03, 0.012, [0, 0, 0], { pitch: -Math.PI / 2 })
        k.box('glass', [pw - 0.05, 0.004, d - 0.11], [0, 0, 0], { r: 0.001 })
        k.box('rubber', [0.14, 0.012, 0.025], [0, 0.01, d / 2 - 0.06], { r: 0.004 })
      })
    }
    for (let i = 0; i < 6; i++) k.blk('paper', [0.18 + k.rnd() * 0.08, 0.06 + k.rnd() * 0.05, 0.14], k.jitter(w * 0.35), h - 0.32 + k.rnd() * 0.1, k.jitter(d * 0.2), { yaw: k.jitter(0.5), r: 0.004, tint: k.pick([[0.85, 0.85, 0.9], [0.9, 0.4, 0.3], [0.4, 0.6, 0.85]] as V3[]) })
    k.label([-w * 0.3, h * 0.6, d / 2 + 0.001], 0.2, 0.06, { m: 'paint' })
  },
  oven: (k, s) => {
    const { w, h, d } = k, v = s.variant, top = h - 0.06
    for (const x of [-1, 1]) for (const z of [-1, 1]) { k.cyl('steel', 0.018, 0.1, [x * (w / 2 - 0.05), 0.05, z * (d / 2 - 0.06)], { seg: 12 }); k.cyl('rubber', 0.025, 0.015, [x * (w / 2 - 0.05), 0.0075, z * (d / 2 - 0.06)], { seg: 12 }) }
    const oh = top - 0.32, sill = 0.14
    k.blk('steel', [w, sill - 0.1, d], 0, 0.1, 0, { r: 0.008 })
    k.blk('steel', [w, top - sill - oh, d], 0, sill + oh, 0, { r: 0.008 })
    for (const x of [-1, 1]) k.blk('steel', [0.03, oh, d], x * (w / 2 - 0.015), sill, 0, { r: 0.004 })
    k.blk('steel', [w - 0.06, oh, 0.03], 0, sill, -d / 2 + 0.015, { r: 0.004 })
    ovenCavity(k, 0, sill, w - 0.06, oh, -d / 2 + 0.03, d / 2, true)
    k.box('steel', [w - 0.02, 0.03, d - 0.02], [0, top + 0.015, 0], { r: 0.006, tone: 0.75 })
    const burners = v === 2 ? 6 : 4, cols = burners / 2
    for (let i = 0; i < burners; i++) {
      const x = -w / 2 + (i % cols + 0.5) * w / cols, z = (Math.floor(i / cols) - 0.5) * d * 0.45
      k.lathe('steel', [[0, 0], [0.06, 0], [0.065, 0.012], [0.045, 0.018], [0.04, 0.025], [0, 0.025]], [x, top + 0.03, z], { seg: 20, tint: [0.35, 0.35, 0.35] })
      k.torus('steel', 0.045, 0.003, [x, top + 0.058, z], { segR: 24, seg: 6, tint: [0.5, 0.5, 0.5] })
      for (let j = 0; j < 4; j++) k.box('steel', [0.2, 0.012, 0.012], [x, top + 0.066, z], { yaw: j * Math.PI / 4, r: 0.003, tint: [0.25, 0.25, 0.25] })
    }
    const panelY = top - 0.07
    k.box('steel', [w - 0.02, 0.1, 0.03], [0, panelY, d / 2 + 0.01], { pitch: -0.25, r: 0.006 })
    for (let i = 0; i < burners; i++) k.knob([-w / 2 + 0.08 + i * (w - 0.16) / Math.max(1, burners - 1), panelY, d / 2 + 0.03], 0.02, { m: 'rubber', pitch: -0.25 })
    k.cyl('steel', 0.008, w - 0.06, [0, sill, d / 2 + 0.004], { axis: 'x', seg: 10 })
    k.frame({ at: [0, sill, d / 2 + 0.002] }, () => k.leaf({
      kind: 'lid', pivot: k.point([0, 0, 0]), axis: k.direction([1, 0, 0]), travel: 1.45, initial: 0,
      handle: k.point([0, oh - 0.02, 0.065]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
      center: k.point([0, oh / 2, 0.015]), width: w - 0.06, height: oh, depth: 0.03, floor: k.point([0, 0.04, -0.3]),
    }, () => {
      k.box('steel', [w - 0.06, oh, 0.03], [0, oh / 2, 0.015], { r: 0.006 })
      k.box('glass', [w * 0.5, oh * 0.4, 0.004], [0, oh * 0.55, 0.031], { r: 0.003 })
      k.handle([0, oh - 0.02, 0.03], w - 0.16, { r: 0.009, standoff: 0.035 })
    }))
    if (v !== 0) k.frame({ at: [0, top, -d / 2 + 0.03] }, () => { k.box('steel', [w, 0.25, 0.02], [0, 0.125, 0], { r: 0.004 }); k.box('steel', [w, 0.02, 0.18], [0, 0.25, 0.08], { r: 0.004 }) })
  },
  'washing-machine': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = v === 2
    k.box('tile', [w, h - 0.02, d], [0, 0.02 + (h - 0.02) / 2, 0], { r: 0.02 })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.cyl('rubber', 0.02, 0.025, [x * (w / 2 - 0.05), 0.0125, z * (d / 2 - 0.05)], { seg: 10 })
    k.box('tile', [w - 0.01, 0.12, 0.03], [0, h - 0.07, d / 2], { r: 0.01, tint: [0.92, 0.93, 0.95] })
    k.knob([w * 0.25, h - 0.07, d / 2 + 0.015], 0.028, { m: 'tile' })
    k.screen([-w * 0.05, h - 0.07, d / 2 + 0.015], 0.12, 0.05, { bezel: 0.006 })
    for (let i = 0; i < 4; i++) k.cyl('rubber', 0.008, 0.008, [-w * 0.3 + i * 0.035, h - 0.09, d / 2 + 0.017], { axis: 'z', seg: 10, tone: 0.5 })
    drawer(k, 'tile', w * 0.28, 0.07, [-w / 2 + 0.03 + w * 0.14, h - 0.07, d / 2 + 0.015], { flat: true, handle: 'none', t: 0.008 })
    if (top) {
      k.frame({ at: [0, h, -d / 2 + 0.06], pitch: -0.35 }, () => k.box('tile', [w * 0.8, 0.02, d * 0.62], [0, 0, d * 0.31], { r: 0.008 }))
      k.lathe('steel', [[0.2, -0.3], [0.21, -0.3], [0.21, 0], [0.2, 0]], [0, h - 0.02, 0.0], { seg: 32, scale: [w / 0.5, 1, 1] })
    } else {
      const R = Math.min(w, h) * 0.32, cy = h * 0.45
      k.torus('tile', R, 0.035, [0, cy, d / 2 + 0.02], { axis: 'z', segR: 40, seg: 12, tint: [0.85, 0.86, 0.88] })
      k.lathe('glass', [[0, 0], [R * 0.95, 0], [R * 0.8, 0.025], [0, 0.04]], [0, cy, d / 2 + 0.01], { axis: 'z', seg: 32 })
      k.lathe('steel', [[0, 0], [R * 0.95, 0], [R * 0.9, -0.12], [0, -0.14]], [0, cy, d / 2 + 0.005], { axis: 'z', seg: 32, tone: 0.6 })
      k.box('tile', [0.04, 0.1, 0.03], [R + 0.03, cy, d / 2 + 0.03], { r: 0.01 })
      k.box('rubber', [0.12, 0.08, 0.005], [0, 0.11, d / 2 + 0.002], { r: 0.003, tone: 0.5 })
    }
    k.cable('rubber', [w * 0.3, h * 0.7, -d / 2 - 0.005], [w * 0.4, 0.02, -d / 2 - 0.02], 0.12, 0.01)
  },
  'vending-machine': (k, s) => {
    const { w, h, d } = k, v = s.variant
    const tint = [[0.75, 0.2, 0.2], [0.25, 0.35, 0.6], [0.2, 0.5, 0.35]][v] as V3
    const gw = w * 0.68, gx = -w / 2 + 0.03 + gw / 2, gy0 = 0.42, gh = h - 0.62, wy = gy0 + gh / 2, side = w / 2 - gx - gw / 2
    hollow(k, 'steel', [w, h - 0.06, d], [0, 0.06, 0], 0.03, { r: 0.012, tint })
    k.blk('steel', [side, h - 0.06, 0.03], w / 2 - side / 2, 0.06, d / 2 - 0.015, { r: 0.006, tint })
    k.blk('steel', [gw + 0.03, gy0 - 0.06, 0.03], gx - 0.015, 0.06, d / 2 - 0.015, { r: 0.006, tint })
    k.blk('steel', [gw + 0.03, h - gy0 - gh, 0.03], gx - 0.015, gy0 + gh, d / 2 - 0.015, { r: 0.006, tint })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.cyl('steel', 0.02, 0.06, [x * (w / 2 - 0.06), 0.03, z * (d / 2 - 0.06)], { seg: 10 })
    k.box('steel', [gw - 0.04, gh - 0.04, 0.004], [gx, wy, -d / 2 + 0.06], { tone: 0.5 })
    const rows = 5, cols = 5
    for (let r = 0; r < rows; r++) {
      const y = gy0 + 0.04 + r * (gh - 0.06) / rows
      k.box('steel', [gw - 0.05, 0.01, d - 0.12], [gx, y, 0.0], { r: 0.002 })
      for (let c = 0; c < cols; c++) {
        const x = gx - gw / 2 + 0.05 + c * (gw - 0.1) / (cols - 1)
        const coil: V3[] = Array.from({ length: 40 }, (_, i) => { const a = i / 40 * Math.PI * 10; return [x + Math.cos(a) * 0.028, y + 0.035 + Math.sin(a) * 0.028, -d / 2 + 0.1 + i / 40 * (d - 0.25)] as V3 })
        k.tube('steel', coil, 0.0018, { seg: 4, fillet: 0 })
        if (k.chance(0.6)) k.blk('paper', [0.05, 0.08, 0.025], x, y + 0.012, d / 2 - 0.08, { r: 0.004, tint: k.pick([[0.9, 0.2, 0.2], [0.95, 0.75, 0.2], [0.2, 0.4, 0.8], [0.3, 0.7, 0.3]] as V3[]) })
      }
    }
    const crack = v !== 1, latch = gx + gw / 2 - 0.035
    k.leaf({
      kind: 'door', pivot: k.point([gx - gw / 2, wy, d / 2 + 0.01]), axis: k.direction([0, -1, 0]), travel: 1.75, initial: 0,
      handle: k.point([latch, wy - 0.05, d / 2 + 0.045]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
      center: k.point([gx, wy, d / 2 + 0.01]), width: gw, height: gh, depth: 0.02, floor: k.point([gx, gy0 + 0.05, 0]),
    }, () => {
      k.frameRect('steel', gw, gh, 0.03, 0.02, [gx, wy, d / 2 + 0.01])
      k.box('glass', [gw - 0.06, gh - 0.06, 0.006], [gx, wy, d / 2 + 0.012], { r: 0.002 })
      if (crack) for (let i = 0; i < 7; i++) k.box('rubber', [0.002, 0.08 + k.rnd() * 0.18, 0.001], [gx + 0.05, gy0 + gh * 0.6, d / 2 + 0.0155], { roll: i * 0.9 + k.jitter(0.3), r: 0, tone: 0.9 })
      k.frame({ at: [latch, wy - 0.05, d / 2 + 0.02] }, () => { k.box('steel', [0.03, 0.16, 0.012], [0, 0, 0.006], { r: 0.004, tone: 0.8 }); k.cyl('steel', 0.009, 0.012, [0, 0.05, 0.016], { axis: 'z', seg: 12 }) })
    })
    const px = w / 2 - 0.03 - (w - gw - 0.06) / 2
    k.screen([px, h - 0.45, d / 2], 0.12, 0.05, { bezel: 0.008 })
    for (let i = 0; i < 12; i++) k.box('steel', [0.025, 0.025, 0.012], [px - 0.035 + (i % 3) * 0.035, h - 0.53 - Math.floor(i / 3) * 0.035, d / 2 + 0.006], { r: 0.004 })
    k.box('rubber', [0.04, 0.01, 0.01], [px, h - 0.72, d / 2 + 0.005], { r: 0.003 })
    k.box('steel', [gw, 0.18, 0.03], [gx, 0.25, d / 2 + 0.005], { r: 0.008, tone: 0.6 })
    k.box('rubber', [gw - 0.1, 0.1, 0.012], [gx, 0.25, d / 2 + 0.02], { pitch: 0.3, r: 0.004 })
    k.box('paint', [w - 0.04, 0.16, 0.02], [0, h - 0.1, d / 2 + 0.005], { r: 0.01, tint: [0.95, 0.92, 0.85] })
  },
  arcade: (k, s) => {
    const { w, h, d } = k, v = s.variant
    const side: V2[] = [[-d / 2, 0], [d / 2, 0], [d / 2, 0.82], [d / 2 + 0.0, 0.86], [d / 2 - 0.12, 0.9], [d / 2 - 0.2, 1.3], [d / 2 - 0.12, h - 0.18], [d / 2 - 0.12, h], [-d / 2, h]]
    for (const x of [-1, 1]) {
      k.extrude('wood', side.map(([z, y]) => [-z, y] as V2), 0.02, [x * (w / 2 - 0.01), 0, 0], { axis: 'x', bevel: 0.003 })
      k.extrude('rubber', side.map(([z, y]) => [-z, y] as V2), 0.022, [x * (w / 2 - 0.01), 0, 0], { axis: 'x', holes: [side.map(([z, y]) => [-z * 0.96, y * 0.985 + 0.008] as V2).reverse()] })
    }
    const iw = w - 0.04
    k.box('wood', [iw, 0.82, 0.02], [0, 0.41, d / 2 - 0.02])
    door(k, 'steel', 0.24, 0.3, [0, 0.42, d / 2 - 0.01], { style: 'flat', handle: 'none', t: 0.012 })
    for (const x of [-1, 1]) { k.box('rubber', [0.012, 0.04, 0.01], [x * 0.05, 0.47, d / 2 + 0.008], { r: 0.003 }); k.box('paint', [0.04, 0.05, 0.004], [x * 0.05, 0.4, d / 2 + 0.005], { r: 0.002, tint: [0.9, 0.2, 0.15] }) }
    k.frame({ at: [0, 0.88, d / 2 - 0.06], pitch: 0.18 }, () => {
      k.box('wood', [iw, 0.04, 0.24], [0, 0, 0], { r: 0.006 })
      k.box('paint', [iw - 0.02, 0.004, 0.2], [0, 0.022, 0], { r: 0.001, tint: [0.15, 0.15, 0.3] })
      for (const pl of v === 0 ? [0] : [-1, 1]) {
        const cx = v === 0 ? -0.08 : pl * iw * 0.25 - 0.04
        k.cyl('steel', 0.006, 0.06, [cx, 0.05, 0], { seg: 8 })
        k.sphere('paint', 0.02, [cx, 0.085, 0], { rows: 6, seg: 12, tint: [0.9, 0.15, 0.15] })
        for (let b = 0; b < 3; b++) k.cyl('paint', 0.012, 0.012, [cx + 0.07 + b * 0.035, 0.026, k.jitter(0.002) + (b % 2) * 0.02], { seg: 12, tint: k.pick([[0.9, 0.85, 0.2], [0.2, 0.5, 0.9], [0.2, 0.8, 0.3]] as V3[]) })
      }
    })
    crt(k, [0, 1.12, d / 2 - 0.2], iw - 0.04, 0.34, { pitch: -0.32 })
    k.box('wood', [iw, 0.3, 0.02], [0, 0.98, d / 2 - 0.15], { pitch: -0.32 })
    k.box('glass', [iw, 0.16, 0.012], [0, h - 0.09, d / 2 - 0.12], { r: 0.003, tint: [1, 0.9, 0.6] })
    k.box('wood', [iw, h - 0.02, 0.02], [0, (h - 0.02) / 2, -d / 2 + 0.01])
    k.box('wood', [iw, 0.02, d - 0.12], [0, h - 0.01, -0.06])
    k.cable('rubber', [0, 0.1, -d / 2], [0.2, 0.01, -d / 2 - 0.05], 0.05, 0.005)
  },
  sink: (k, s) => {
    const { w, h, d } = k, v = s.variant, topT = 0.03
    if (v === 2) {
      k.lathe('tile', [[0, 0], [0.12, 0], [0.09, 0.05], [0.07, 0.4], [0.1, h - topT - 0.12], [0.16, h - topT - 0.04], [0, h - topT - 0.04]], [0, 0, -0.05], { seg: 28, scale: [1, 1, 0.8] })
    } else {
      const inner = carcass(k, 'tile', w, h - topT, d - 0.03, { plinth: 0.08, z: -0.015, top: 0.0001, back: true })
      for (let i = 0; i < 2; i++) door(k, 'tile', inner / 2 + 0.015, h - topT - 0.12, [(i - 0.5) * (inner / 2 + 0.015), 0.09 + (h - topT - 0.12) / 2, d / 2 - 0.03], { style: v === 1 ? 'shaker' : 'flat', hinge: i ? 1 : -1, handle: 'bar' })
    }
    const bw = Math.min(w * 0.55, 0.6), bd = d * 0.6
    k.extrude('tile', rrect(w, d, 0.02), topT, [0, h - topT / 2, 0], { axis: 'y', holes: [rrect(bw, bd, 0.06).reverse()], bevel: 0.006, curveSeg: 4 })
    basin(k, 'tile', bw + 0.02, bd + 0.02, 0.18, 0.012, 0.07, [0, h - 0.185, 0.0])
    k.cyl('steel', 0.022, 0.006, [0, h - 0.18, 0], { seg: 16, tone: 0.6 })
    k.box('tile', [w, 0.12, 0.02], [0, h + 0.06, -d / 2 + 0.01], { r: 0.006 })
    faucet(k, [0, h, -bd / 2 - 0.05], bd * 0.45)
    k.lathe('tile', [[0, 0], [0.04, 0], [0.05, 0.02], [0.04, 0.02], [0, 0.01]], [w * 0.32, h, -0.08], { seg: 14, tint: [0.7, 0.8, 0.95] })
  },
  toilet: (k, s) => {
    const { w, h, d } = k, v = s.variant, seatY = 0.4, bz = d * 0.12
    k.lathe('tile', [[0, 0], [0.13, 0], [0.12, 0.05], [0.1, 0.15], [0.13, 0.28], [0.19, 0.36], [0.2, seatY - 0.02], [0.17, seatY], [0.14, seatY - 0.02], [0.08, 0.22], [0, 0.2]], [0, 0, bz], { seg: 32, scale: [w / 0.42, 1, d * 0.62 / 0.4] })
    k.frame({ at: [0, seatY + 0.012, bz] }, () => {
      k.torus('tile', 0.15, 0.022, [0, 0, 0], { segR: 32, seg: 8, scale: [w / 0.4, 0.55, d * 0.62 / 0.42], tint: [0.96, 0.96, 0.94] })
      const reach = d * 0.62, raised = v === 2 ? 1.72 : 0
      if (v !== 1) k.frame({ at: [0, 0.01, -reach * 0.44] }, () => k.leaf({
        kind: 'lid', pivot: k.point([0, 0, 0]), axis: k.direction([-1, 0, 0]), travel: 1.72, initial: raised,
        handle: k.point([0, 0.014, reach * 0.86]), normal: k.direction([0, 1, 0]), up: k.direction([0, 0, -1]),
        center: k.point([0, 0, reach * 0.44]), width: w * 0.85, height: reach * 0.85, depth: 0.018, floor: k.point([0, -0.2, reach * 0.44]),
      }, () => k.frame({ pitch: -raised }, () => k.cyl('tile', 0.17, 0.018, [0, 0.0, reach * 0.44], { seg: 32, scale: [w / 0.4, 1, reach / 0.4], bevel: 0.008 }))))
    })
    const tw = w * 0.86, td = d * 0.24, tz = -d / 2 + td / 2 + 0.01
    k.box('tile', [tw, h - seatY + 0.05, td], [0, seatY - 0.05 + (h - seatY + 0.05) / 2, tz], { r: 0.025 })
    k.box('tile', [tw + 0.02, 0.03, td + 0.02], [0, h - 0.015, tz], { r: 0.012 })
    k.frame({ at: [-tw / 2 + 0.05, h - 0.08, tz + td / 2] }, () => { k.cyl('steel', 0.012, 0.012, [0, 0, 0.006], { axis: 'z', seg: 12 }); k.box('steel', [0.07, 0.012, 0.012], [0.035, 0, 0.018], { r: 0.004 }) })
    k.tube('steel', [[tw / 2 - 0.05, seatY + 0.02, tz - td / 2], [tw / 2 - 0.05, 0.15, tz - td / 2 - 0.02], [tw / 2 - 0.05, 0.15, -d / 2 + 0.005]], 0.006, { fillet: 0.03 })
    for (const x of [-1, 1]) k.lathe('tile', [[0, 0], [0.014, 0], [0.012, 0.012], [0, 0.016]], [x * 0.11, 0.0, bz + 0.03], { seg: 10 })
  },
  bathtub: (k, s) => {
    const { w, h, d } = k, v = s.variant, base = v === 2 ? 0.1 : 0.02, tubH = h - base
    if (v === 2) {
      for (const x of [-1, 1]) for (const z of [-1, 1]) k.frame({ at: [x * (w / 2 - 0.1), 0, z * (d / 2 - 0.18)] }, () => {
        k.lathe('steel', [[0, 0], [0.035, 0], [0.04, 0.02], [0.022, 0.05], [0.03, 0.09], [0.045, base + 0.04], [0, base + 0.04]], [0, 0, 0], { seg: 14 })
        for (let i = 0; i < 3; i++) k.sphere('steel', 0.016, [Math.cos(i * 2.1) * 0.03, 0.012, Math.sin(i * 2.1) * 0.03], { rows: 5, seg: 8 })
      })
    } else k.blk('tile', [w, base, d], 0, 0, 0, { r: 0.006, tone: 0.8 })
    basin(k, 'tile', w, d, tubH, 0.05, Math.min(w, d) * 0.4, [0, base, 0])
    k.tube('tile', roundRect(w - 0.03, d - 0.03, Math.min(w, d) * 0.38, h - 0.01, 6), 0.02, { closed: true, seg: 10 })
    const head = -d / 2 + 0.12
    k.cyl('steel', 0.025, 0.008, [0, base + 0.055, head + 0.1], { seg: 14, tone: 0.6 })
    k.cable('steel', [0.02, base + 0.06, head + 0.1], [0.05, base + 0.07, head + 0.3], 0.01, 0.0025)
    faucet(k, [0, h, head - 0.035], 0.12, { handles: true })
    k.cyl('steel', 0.03, 0.012, [0, h - 0.12, head - 0.05 + 0.006], { axis: 'z', seg: 14 })
    if (v === 1) for (let i = 0; i < 3; i++) k.box('tile', [0.15, 0.15, 0.008], [k.jitter(w * 0.3), base + 0.06 + i * 0.01, k.jitter(d * 0.3)], { yaw: k.rnd() * 3, roll: k.jitter(0.1), r: 0.002 })
  },
  'clothes-rack': (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) {
      k.box('steel', [0.04, 0.03, d - 0.06], [x * (w / 2 - 0.05), 0.075, 0], { r: 0.008 })
      for (const z of [-1, 1]) k.caster([x * (w / 2 - 0.05), 0, z * (d / 2 - 0.05)], 0.028)
      k.tube('steel', [[x * (w / 2 - 0.05), 0.09, 0], [x * (w / 2 - 0.05), h - 0.04, 0], [x * (w / 2 - 0.12), h - 0.01, 0]], 0.014, { fillet: 0.05 })
    }
    k.cyl('steel', 0.013, w - 0.24, [0, h - 0.01, 0], { axis: 'x', seg: 12 })
    if (v !== 0) k.cyl('steel', 0.012, w - 0.1, [0, 0.3, 0], { axis: 'x', seg: 12 })
    const n = Math.floor((w - 0.3) / 0.07)
    for (let i = 0; i < n; i++) if (k.chance(0.8)) k.frame({ at: [-w / 2 + 0.17 + i * 0.07, h - 0.01, 0], yaw: Math.PI / 2 + k.jitter(0.12) }, () => {
      k.tube('steel', [[0, 0.0, 0], [0, -0.03, 0.01], [-0.19, -0.1, 0], [0.19, -0.1, 0], [0, -0.03, 0.01]], 0.0025, { fillet: 0.01, seg: 5 })
      const long = k.chance(0.4), len = long ? 0.95 : 0.6
      const tint = k.pick([[0.65, 0.2, 0.2], [0.25, 0.3, 0.45], [0.75, 0.7, 0.6], [0.3, 0.45, 0.3], [0.15, 0.15, 0.17], [0.85, 0.85, 0.82]] as V3[])
      k.extrude('fabric', [[-0.2, 0], [0.2, 0], [0.22, -0.18], [0.18, -len], [-0.18, -len], [-0.22, -0.18]], 0.035, [0, -0.1, 0], { bevel: 0.012, bevelSeg: 2, steps: 1, tint, warp: (x, y) => [0, 0, Math.sin(y * 9 + x * 4) * 0.01] })
    })
  },
  'tool-rack': (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) { k.blk('steel', [0.04, h, 0.04], x * (w / 2 - 0.02), 0, 0, { r: 0.004 }); k.blk('steel', [0.05, 0.03, d - 0.04], x * (w / 2 - 0.025), 0, 0, { r: 0.006 }) }
    const pw = w - 0.06, ph = h - 0.6, py = 0.55 + ph / 2
    k.box('wood', [pw, ph, 0.012], [0, py, 0], { tint: [0.8, 0.7, 0.55] })
    for (let y = -ph / 2 + 0.04; y < ph / 2 - 0.02; y += 0.05) for (let x = -pw / 2 + 0.04; x < pw / 2 - 0.02; x += 0.05) k.cyl('rubber', 0.004, 0.013, [x, py + y, 0], { axis: 'z', seg: 6, bevel: 0, tone: 0.2 })
    shelfBoard(k, 'steel', w - 0.06, d - 0.06, [0, 0.2, 0], { t: 0.02, lip: 0.04 })
    const hook = (x: number, y: number) => k.tube('steel', [[x, y, 0.006], [x, y, 0.04], [x, y + 0.02, 0.05]], 0.0025, { fillet: 0.008, seg: 5 })
    const tools = Math.floor(pw / 0.17)
    for (let i = 0; i < tools; i++) {
      const x = -pw / 2 + 0.1 + i * (pw - 0.2) / Math.max(1, tools - 1), y = py + ph / 2 - 0.12 - (i % 2) * 0.32, type = (i + v) % 5
      hook(x, y)
      k.frame({ at: [x, y - 0.01, 0.04] }, () => {
        if (type === 0) { k.cyl('wood', 0.014, 0.3, [0, -0.16, 0], { seg: 10 }); k.box('steel', [0.11, 0.035, 0.03], [0, -0.005, 0], { r: 0.006 }) }
        else if (type === 1) { k.box('steel', [0.025, 0.26, 0.008], [0, -0.14, 0], { r: 0.003 }); k.torus('steel', 0.02, 0.008, [0, -0.28, 0], { axis: 'z', segR: 14, seg: 6 }); k.torus('steel', 0.018, 0.007, [0, 0.0, 0], { axis: 'z', segR: 14, seg: 6, arc: Math.PI * 1.5 }) }
        else if (type === 2) { k.extrude('steel', [[-0.05, 0], [0.05, 0], [0.04, -0.3], [-0.04, -0.33]], 0.002, [0, -0.06, 0], {}); k.box('wood', [0.1, 0.06, 0.03], [0, -0.03, 0], { r: 0.012 }) }
        else if (type === 3) { k.cyl('paint', 0.012, 0.11, [0, -0.06, 0], { seg: 10, tint: [0.9, 0.7, 0.15] }); k.cyl('steel', 0.003, 0.12, [0, -0.17, 0], { seg: 6 }) }
        else { for (const sgn of [-1, 1]) k.tube('paint', [[0, 0, 0], [sgn * 0.02, -0.1, 0], [sgn * 0.012, -0.2, 0]], 0.006, { seg: 6, tint: [0.85, 0.2, 0.15] }); k.box('steel', [0.02, 0.05, 0.012], [0, 0.01, 0], { r: 0.004 }) }
      })
    }
    for (let i = 0; i < 3; i++) k.blk('paint', [0.18, 0.1, 0.12], -w / 2 + 0.15 + i * 0.25, 0.21, 0, { r: 0.008, tint: k.pick([[0.8, 0.2, 0.15], [0.2, 0.3, 0.6], [0.3, 0.3, 0.3]] as V3[]) })
  },
  'gun-rack': (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) k.extrude('steel', [[-d / 2, 0], [d / 2, 0], [d / 2, 0.06], [-d / 2 + 0.1, h], [-d / 2, h]], 0.03, [x * (w / 2 - 0.015), 0, 0], { axis: 'x', bevel: 0.004 })
    k.box('steel', [w - 0.04, 0.06, d - 0.06], [0, 0.12, 0], { r: 0.006 })
    k.box('wood', [w - 0.06, 0.03, d - 0.1], [0, 0.16, 0], { r: 0.004, tint: [0.6, 0.45, 0.3] })
    k.box('steel', [w - 0.04, 0.05, 0.06], [0, h - 0.15, -d / 2 + 0.08], { r: 0.008 })
    const n = Math.floor((w - 0.12) / 0.11)
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.1 + i * (w - 0.2) / Math.max(1, n - 1)
      k.box('rubber', [0.03, 0.025, 0.04], [x, h - 0.125, -d / 2 + 0.11], { r: 0.008 })
      if (i % 3 === 2 && v !== 2) continue
      k.frame({ at: [x, 0.175, -d / 2 + 0.14], pitch: -0.1 }, () => {
        k.extrude('wood', [[-0.025, 0], [0.025, 0], [0.035, 0.25], [0.015, 0.33], [0.015, 0.85], [-0.015, 0.85], [-0.015, 0.33], [-0.035, 0.25]], 0.04, [0, 0, 0], { bevel: 0.006, tint: [0.55, 0.38, 0.25] })
        k.box('steel', [0.03, 0.18, 0.05], [0, 0.42, 0.01], { r: 0.006 })
        k.cyl('steel', 0.008, 0.55, [0, 0.85 + 0.27, 0], { seg: 10 })
        k.box('steel', [0.016, 0.1, 0.02], [0, 0.4, 0.04], { r: 0.004 })
      })
    }
    for (let i = 0; i < 2 + v; i++) k.blk('paint', [0.22, 0.1, 0.13], -w / 2 + 0.18 + i * 0.26, 0.04, d / 2 - 0.1, { r: 0.008, tint: [0.35, 0.4, 0.25] })
  },
  generator: (k, s) => {
    const { w, h, d } = k, v = s.variant, r = 0.016
    const fx = w / 2 - 0.03, fz = d / 2 - 0.03
    for (const z of [-1, 1]) k.tube('steel', [[-fx, 0.04, z * fz], [-fx, h - 0.05, z * fz], [fx, h - 0.05, z * fz], [fx, 0.04, z * fz]], r, { fillet: 0.08, tint: [0.85, 0.65, 0.15] })
    for (const x of [-1, 1]) k.tube('steel', [[x * fx, 0.04, -fz], [x * fx, 0.04, fz]], r, { tint: [0.85, 0.65, 0.15] })
    for (const x of [-0.5, 0.5]) k.tube('steel', [[x * w, h - 0.05, -fz], [x * w, h - 0.05, fz]], r * 0.8)
    k.box('steel', [w * 0.45, h * 0.45, d * 0.55], [-w * 0.15, 0.1 + h * 0.225, 0], { r: 0.02, tint: [0.3, 0.3, 0.32] })
    for (let i = 0; i < 8; i++) k.box('steel', [w * 0.47, 0.008, d * 0.5], [-w * 0.15, 0.15 + i * 0.035, 0], { r: 0.002, tint: [0.35, 0.35, 0.37] })
    k.cyl('steel', h * 0.2, w * 0.3, [w * 0.22, 0.1 + h * 0.2, 0], { axis: 'x', seg: 28, bevel: 0.015 })
    for (let i = 0; i < 10; i++) k.box('rubber', [w * 0.22, 0.006, 0.02], [w * 0.22, 0.1 + h * 0.2, 0], { roll: 0, pitch: i * Math.PI / 10, r: 0, tone: 0.3, scale: [1, 1, 1] })
    k.box('steel', [w * 0.72, h * 0.22, d * 0.75], [-w * 0.02, h - 0.05 - h * 0.13, 0], { r: 0.05, tint: [0.85, 0.2, 0.15] })
    k.frame({ at: [-w * 0.2, h - 0.04, 0.0] }, () => { k.cyl('steel', 0.045, 0.02, [0, 0.0, 0], { seg: 18 }); k.cyl('rubber', 0.04, 0.025, [0, 0.02, 0], { seg: 18 }) })
    k.frame({ at: [w * 0.3, 0.55, d / 2 - 0.06] }, () => {
      k.box('steel', [0.2, 0.18, 0.03], [0, 0, 0], { r: 0.006, tint: [0.25, 0.25, 0.27] })
      for (let i = 0; i < 2; i++) { k.cyl('paint', 0.022, 0.01, [-0.05 + i * 0.1, -0.03, 0.02], { axis: 'z', seg: 14, tint: [0.15, 0.15, 0.15] }); k.box('rubber', [0.006, 0.014, 0.004], [-0.055 + i * 0.1, -0.03, 0.026], { r: 0, tone: 0.1 }); k.box('rubber', [0.006, 0.014, 0.004], [-0.045 + i * 0.1, -0.03, 0.026], { r: 0, tone: 0.1 }) }
      k.knob([-0.06, 0.05, 0.015], 0.012, { m: 'rubber' }); k.box('paint', [0.025, 0.04, 0.015], [0.06, 0.05, 0.02], { r: 0.004, tint: [0.9, 0.15, 0.1] })
    })
    k.cyl('steel', 0.04, 0.22, [-w * 0.42, 0.45, -d * 0.22], { axis: 'x', seg: 18, tone: 0.5 })
    k.tube('steel', [[-w * 0.3, 0.42, -d * 0.12], [-w * 0.32, 0.45, -d * 0.22]], 0.012)
    k.frame({ at: [-w * 0.33, 0.35, d * 0.28] }, () => { k.cyl('rubber', 0.03, 0.04, [0, 0, 0], { axis: 'z', seg: 14 }); k.box('rubber', [0.02, 0.05, 0.015], [0, 0, 0.03], { r: 0.005 }) })
    if (v !== 0) { for (const z of [-1, 1]) k.wheel([w * 0.38, 0.11, z * (d / 2 - 0.02)], 0.11, 0.06, { axis: 'z', ratio: 0.55 }); k.tube('steel', [[-fx, h - 0.05, -fz + 0.1], [-fx - 0.0, h + 0.05, -fz + 0.1], [-fx, h + 0.05, fz - 0.1], [-fx, h - 0.05, fz - 0.1]], 0.012, { fillet: 0.04 }) }
    k.cable('rubber', [w * 0.32, 0.5, d / 2 - 0.04], [w * 0.45, 0.01, d / 2 + 0.03], 0.1, 0.007)
  },
  'radio-desk': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.76
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('steel', [0.04, top - 0.03, 0.04], x * (w / 2 - 0.04), 0, z * (d / 2 - 0.04), { r: 0.005 })
    k.box('steel', [w, 0.03, d], [0, top - 0.015, 0], { r: 0.006, tint: [0.45, 0.5, 0.45] })
    drawer(k, 'steel', w * 0.4, 0.1, [w * 0.25, top - 0.09, d / 2 - 0.04], { flat: true, handle: 'cup' })
    const unit = (x: number, y: number, ww: number, hh: number, dd: number, dials: number) => k.frame({ at: [x, y, -d / 2 + dd / 2 + 0.04] }, () => {
      k.box('steel', [ww, hh, dd], [0, hh / 2, 0], { r: 0.008, tint: [0.3, 0.32, 0.3] })
      k.box('steel', [ww - 0.01, hh - 0.01, 0.006], [0, hh / 2, dd / 2 + 0.003], { r: 0.003, tint: [0.75, 0.75, 0.7] })
      for (let i = 0; i < dials; i++) k.knob([-ww / 2 + 0.05 + i * (ww - 0.1) / Math.max(1, dials - 1), hh * 0.3, dd / 2 + 0.006], 0.016, { m: 'rubber' })
      k.frame({ at: [ww * 0.2, hh * 0.68, dd / 2 + 0.006] }, () => { k.box('rubber', [0.09, 0.05, 0.004], [0, 0, 0.002], { r: 0.003 }); k.box('paper', [0.08, 0.042, 0.002], [0, 0, 0.0045], { r: 0, tint: [1, 0.95, 0.75] }); k.box('rubber', [0.002, 0.035, 0.002], [0.01, 0, 0.006], { roll: 0.5, r: 0 }) })
      k.vent([-ww * 0.25, hh * 0.68, dd / 2 + 0.006], ww * 0.35, hh * 0.3, { m: 'steel' })
    })
    unit(-w * 0.15, top, w * 0.5, 0.18, d * 0.55, 4)
    unit(-w * 0.15, top + 0.18, w * 0.42, 0.14, d * 0.5, 3)
    if (v !== 0) unit(w * 0.3, top, w * 0.3, 0.12, d * 0.45, 2)
    k.frame({ at: [w * 0.25, top, d * 0.15] }, () => { k.cyl('steel', 0.05, 0.02, [0, 0.01, 0], { seg: 18 }); k.tube('steel', [[0, 0.02, 0], [0, 0.18, 0.0], [0, 0.22, 0.05]], 0.005, { fillet: 0.04 }); k.cyl('rubber', 0.02, 0.07, [0, 0.24, 0.07], { pitch: 0.9, seg: 14 }) })
    k.frame({ at: [-w * 0.35, top + 0.02, d * 0.2], yaw: 0.4 }, () => { k.torus('rubber', 0.08, 0.008, [0, 0.0, 0], { axis: 'z', arc: Math.PI, segR: 20, seg: 6, roll: Math.PI / 2 }); for (const x of [-1, 1]) k.cyl('fabric', 0.035, 0.03, [x * 0.08, 0.0, 0], { axis: 'x', seg: 16, tint: [0.2, 0.2, 0.2] }) })
    k.blk('paper', [0.15, 0.01, 0.21], w * 0.0, top, d * 0.25, { yaw: -0.2, r: 0.002, tint: [1, 0.97, 0.85] })
    k.cable('rubber', [-w * 0.15, top + 0.1, -d / 2 + 0.04], [-w * 0.4, 0.008, -d / 2 + 0.01], 0.06, 0.006)
    k.tube('steel', [[w / 2 - 0.05, top, -d / 2 + 0.05], [w / 2 - 0.05, top + 0.45, -d / 2 + 0.05]], 0.005)
  },
  'server-rack': (k, s) => {
    const { w, h, d } = k, v = s.variant
    carcass(k, 'steel', w, h - 0.08, d, { t: 0.02, top: 0.03, bottom: 0.08, back: true })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.caster([x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06)], 0.03)
    const units = Math.floor((h - 0.25) / 0.09)
    for (let i = 0; i < units; i++) if (k.chance(0.82)) {
      const y = 0.13 + i * 0.09, uh = k.chance(0.3) ? 0.085 : 0.042
      k.box('steel', [w - 0.06, uh, d - 0.12], [0, y + uh / 2, -0.02], { r: 0.003, tint: [0.2, 0.21, 0.23] })
      k.box('steel', [w - 0.05, uh, 0.006], [0, y + uh / 2, d / 2 - 0.08], { r: 0.002, tint: [0.28, 0.29, 0.31] })
      for (let j = 0; j < 6; j++) k.box('paint', [0.006, 0.006, 0.004], [-w / 2 + 0.06 + j * 0.018, y + uh * 0.6, d / 2 - 0.076], { r: 0, tint: k.pick([[0.2, 0.9, 0.3], [0.95, 0.6, 0.1], [0.2, 0.5, 0.95]] as V3[]) })
      k.vent([w * 0.15, y + uh / 2, d / 2 - 0.077], w * 0.4, uh * 0.7, { m: 'steel', slats: 3 })
    }
    door(k, 'steel', w - 0.01, h - 0.14, [0, 0.1 + (h - 0.14) / 2, d / 2], { style: v === 0 ? 'mesh' : 'glass', hinge: -1, handle: 'lever', open: v === 2 ? 0.06 : 0 })
    for (let i = 0; i < 12; i++) k.cable('rubber', [-w / 2 + 0.06 + i * 0.02, h - 0.4 - i * 0.05, -d / 2 + 0.06], [-w / 2 + 0.06 + i * 0.015, 0.2, -d / 2 + 0.05], 0.04, 0.004)
  },
  'electrical-panel': (k, s) => {
    const { w, h, d } = k, v = s.variant
    carcass(k, 'steel', w, h - 0.1, d, { t: 0.02, top: 0.03, bottom: 0.1, plinth: 0 })
    k.blk('steel', [w + 0.02, 0.1, d + 0.02], 0, 0, 0, { r: 0.006, tone: 0.55 })
    door(k, 'steel', w - 0.02, h - 0.14, [0, 0.12 + (h - 0.14) / 2, d / 2], { style: 'flat', hinge: -1, handle: 'lever', hinges: true, open: v === 1 ? 0.07 : 0 })
    k.frame({ at: [0, h * 0.68, d / 2 + 0.021] }, () => {
      k.extrude('paint', [[-0.09, -0.06], [0.09, -0.06], [0, 0.1]], 0.002, [0, 0, 0.001], { tint: [0.95, 0.8, 0.1] })
      k.extrude('rubber', [[-0.07, -0.048], [0.07, -0.048], [0, 0.075]], 0.001, [0, 0, 0.0025], { holes: [[[-0.055, -0.04], [0, 0.058], [0.055, -0.04]]], tone: 0.2 })
      k.box('rubber', [0.012, 0.05, 0.002], [0, 0.0, 0.003], { roll: 0.3, r: 0, tone: 0.2 })
    })
    k.label([0, h * 0.45, d / 2 + 0.021], 0.18, 0.06)
    k.vent([0, 0.3, d / 2 + 0.02], w * 0.5, 0.12, { m: 'steel' })
    for (let i = 0; i < 2 + v; i++) { const x = -w / 2 + 0.12 + i * 0.12; k.cyl('steel', 0.025, 0.26, [x, h + 0.13, -d / 4], { seg: 14 }); k.cyl('steel', 0.035, 0.04, [x, h + 0.02, -d / 4], { seg: 14 }) }
  },
  'fuel-pump': (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.blk('concrete', [w, 0.15, d], 0, 0, 0, { r: 0.03 })
    k.blk('paint', [w - 0.04, 0.012, d - 0.04], 0, 0.15, 0, { r: 0.003, tint: [0.95, 0.85, 0.1] })
    k.box('paint', [w - 0.12, 0.85, d - 0.18], [0, 0.15 + 0.425, 0], { r: 0.035 })
    k.box('paint', [w - 0.08, h - 1.0 - 0.15, d - 0.12], [0, 1.0 + (h - 1.15) / 2, 0], { r: 0.035, tint: [0.95, 0.95, 0.92] })
    k.box('paint', [w - 0.04, 0.14, d - 0.08], [0, h - 0.07, 0], { r: 0.04 })
    k.screen([0, 1.25, d / 2 - 0.06], w * 0.55, 0.22, { bezel: 0.02 })
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) k.box('paint', [0.02, 0.035, 0.002], [-w * 0.18 + c * 0.032, 1.31 - r * 0.055, d / 2 - 0.035], { r: 0, tint: [0.95, 0.4, 0.15], tone: 0.9 })
    for (let i = 0; i < 3; i++) k.box('rubber', [0.06, 0.03, 0.012], [-w * 0.2 + i * w * 0.2, 1.06, d / 2 - 0.06], { r: 0.006, tint: k.pick([[0.9, 0.85, 0.2], [0.2, 0.7, 0.3], [0.85, 0.2, 0.15]] as V3[]) })
    const holster = (x: number) => k.frame({ at: [x, 0.75, d / 2 - 0.09] }, () => {
      k.box('steel', [0.08, 0.14, 0.04], [0, 0, 0.02], { r: 0.008 })
      k.frame({ at: [0, 0.03, 0.05], pitch: -0.4 }, () => { k.box('rubber', [0.035, 0.12, 0.04], [0, 0, 0], { r: 0.01 }); k.cyl('steel', 0.009, 0.16, [0, -0.11, 0.03], { pitch: 0.6, seg: 10 }); k.tube('steel', [[0, -0.02, -0.02], [0, -0.07, -0.035], [0, -0.06, 0.0]], 0.003, { fillet: 0.01 }) })
      k.cable('rubber', [0, 0.06, 0.03], [x * 0.2, 0.25, 0.08], 0.18, 0.011)
    })
    holster(w * 0.28)
    if (v !== 0) holster(-w * 0.28)
    k.box('paint', [w * 0.6, 0.18, 0.01], [0, 1.6, d / 2 - 0.035], { r: 0.004, tint: [0.95, 0.95, 0.95] })
    for (const x of [-1, 1]) { k.cyl('paint', 0.03, 0.15, [x * (w / 2 - 0.04), 0.15 + 0.075, d / 2 - 0.04], { seg: 14, tint: [0.95, 0.85, 0.1] }) }
  },
}
void arc
