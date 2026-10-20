import type { AssetSpec } from '../../types'
import { type Family, type Kit, type Mat, type V2, type V3 } from '../kit'
import { carcass, door, drawer, hollow, goods, products, shelfBoard, type ProductKind } from './common'

function upright(k: Kit, m: Mat, x: number, z: number, h: number, sx: number, sz: number) {
  const a = 0.04, t = 0.004
  k.blk(m, [a, h, t], x, 0, z + sz * (a / 2 - t / 2), { r: 0.001 })
  k.blk(m, [t, h, a], x + sx * (a / 2 - t / 2), 0, z, { r: 0.001 })
  for (let y = 0.08; y < h - 0.05; y += 0.05) k.box('rubber', [0.012, 0.022, 0.0012], [x - sx * 0.006, y, z + sz * (a / 2 + 0.0002)], { r: 0, tone: 0.25 })
  k.blk(m, [0.07, 0.006, 0.07], x + sx * 0.012, 0, z - sz * 0.012, { r: 0.002 })
}

function rackShelving(k: Kit, s: AssetSpec, kinds: ProductKind[], m: Mat) {
  const { w, h, d } = k, levels = 3 + s.variant, t = 0.05
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) upright(k, m, sx * (w / 2 - 0.02), sz * (d / 2 - 0.02), h, sx, sz)
  for (let i = 0; i < levels; i++) {
    const y = i * (h - t) / (levels - 1)
    k.box(m, [w - 0.01, 0.012, d - 0.012], [0, y + t - 0.006, 0], { r: 0.002 })
    for (const z of [-1, 1]) k.box(m, [w - 0.01, t, 0.006], [0, y + t / 2, z * (d / 2 - 0.006)], { r: 0.0015 })
    for (const x of [-1, 1]) k.box(m, [0.006, t, d - 0.02], [x * (w / 2 - 0.006), y + t / 2, 0], { r: 0.0015 })
    if (i < levels - 1) {
      const room = (h - t) / (levels - 1) - t - 0.03
      products(k, kinds[i % kinds.length], -w / 2 + 0.04, w / 2 - 0.04, y + t, 0, d - 0.06, { maxH: room, fill: 0.55 + k.rnd() * 0.3 })
    }
  }
  for (const sx of [-1, 1]) k.frame({ at: [sx * (w / 2 - 0.002), h / 2, 0] }, () => {
    for (const sgn of [-1, 1]) k.box(m, [0.003, Math.hypot(h * 0.42, d) * 0.98, 0.022], [0, sgn * h * 0.22, 0], { pitch: sgn * Math.atan2(d - 0.06, h * 0.42), r: 0.001 })
  })
  k.frame({ at: [0, h * 0.62, -d / 2 + 0.003] }, () => { for (const sgn of [-1, 1]) k.box(m, [Math.hypot(w, h * 0.5) * 0.96, 0.022, 0.003], [0, 0, 0], { roll: sgn * Math.atan2(h * 0.5, w), r: 0.001 }) })
}

function shoe(k: Kit, x: number, y: number, z: number, yaw: number, tint: V3, pitch = 0) {
  const side: V2[] = [[-0.13, 0], [0.13, 0], [0.135, 0.03], [0.1, 0.05], [0.02, 0.06], [-0.04, 0.1], [-0.12, 0.11], [-0.135, 0.06]]
  k.frame({ at: [x, y, z], yaw, pitch }, () => {
    k.extrude('leather', side, 0.085, [0, 0.012, 0], { axis: 'x', bevel: 0.012, bevelSeg: 2, curveSeg: 3, tint })
    k.box('rubber', [0.09, 0.014, 0.275], [0, 0.007, 0], { r: 0.006 })
    k.box('rubber', [0.05, 0.03, 0.055], [0, 0.072, -0.065], { pitch: -0.3, r: 0.01, tone: 0.3 })
  })
}

export const STORAGE: Family = {
  shelf: (k, s) => rackShelving(k, s, ['box', 'can', 'box', 'jug', 'box'], 'steel'),
  'grocery-shelf': (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.blk('steel', [w, 0.1, d], 0, 0, 0, { r: 0.006, tone: 0.7 })
    k.blk('steel', [w - 0.04, h - 0.1, 0.04], 0, 0.1, 0, { r: 0.004 })
    for (let y = 0.2; y < h - 0.2; y += 0.075) for (let x = -w / 2 + 0.06; x < w / 2 - 0.04; x += 0.075) for (const zs of [-1, 1]) k.box('rubber', [0.008, 0.008, 0.001], [x, y, zs * 0.0205], { r: 0, tone: 0.3, skip: [zs > 0 ? 5 : 4] })
    for (const x of [-1, 1]) k.blk('steel', [0.03, h, 0.06], x * (w / 2 - 0.015), 0, 0, { r: 0.004 })
    k.blk('paint', [w, 0.16, 0.08], 0, h - 0.16, 0, { r: 0.01, tint: [0.85, 0.25, 0.2] })
    const tiers = 4
    for (const zs of [-1, 1]) for (let i = 0; i < tiers; i++) {
      const y = 0.1 + i * (h - 0.36) / (tiers - 1) + (i === 0 ? 0 : 0.02), depth = d / 2 - 0.04 - i * 0.03
      k.box('steel', [w - 0.06, 0.015, depth], [0, y + 0.0075, zs * (0.02 + depth / 2)], { r: 0.002 })
      k.box('paper', [w - 0.06, 0.03, 0.004], [0, y + 0.0, zs * (0.022 + depth)], { r: 0.001, tint: [0.95, 0.95, 0.85] })
      for (const x of [-1, 1]) k.box('steel', [0.01, 0.06, depth * 0.8], [x * (w / 2 - 0.04), y - 0.03, zs * (0.02 + depth * 0.45)], { r: 0.002 })
      products(k, (['can', 'box', 'bottle', 'jar'] as ProductKind[])[(i + (zs > 0 ? 0 : 1) + v) % 4], -w / 2 + 0.05, w / 2 - 0.05, y + 0.015, zs * (0.02 + depth / 2), depth - 0.02, { maxH: (h - 0.36) / (tiers - 1) - 0.04, fill: 0.4 + k.rnd() * 0.4 })
    }
  },
  'pharmacy-shelf': (k, s) => {
    const { w, h, d } = k, v = s.variant
    const inner = carcass(k, 'tile', w, h - 0.18, d, { plinth: 0.08, t: 0.022 })
    k.blk('tile', [w, 0.18, 0.05], 0, h - 0.18, d / 2 - 0.05, { r: 0.008 })
    k.box('paint', [0.1, 0.03, 0.01], [-w / 2 + 0.14, h - 0.09, d / 2 + 0.005], { r: 0.003, tint: [0.2, 0.7, 0.3] })
    k.box('paint', [0.03, 0.1, 0.01], [-w / 2 + 0.14, h - 0.09, d / 2 + 0.006], { r: 0.003, tint: [0.2, 0.7, 0.3] })
    const levels = 4 + (v === 2 ? 1 : 0), span = h - 0.18 - 0.1
    for (let i = 0; i < levels; i++) {
      const y = 0.1 + i * span / levels
      shelfBoard(k, 'tile', inner, d - 0.03, [0, y, 0.0], { t: 0.018 })
      k.box('paper', [inner, 0.026, 0.003], [0, y - 0.004, d / 2 - 0.013], { r: 0.0008, tint: [0.95, 0.97, 1] })
      products(k, (['med', 'box', 'med', 'bottle', 'box'] as ProductKind[])[(i + v) % 5], -inner / 2 + 0.02, inner / 2 - 0.02, y + 0.009, 0, d - 0.08, { maxH: span / levels - 0.04, fill: 0.45 + k.rnd() * 0.35, rows: 1 })
    }
  },
  bookcase: (k, s) => {
    const { w, h, d } = k, v = s.variant, levels = 3 + v
    const inner = carcass(k, 'wood', w, h - 0.05, d, { plinth: 0.09, t: 0.024 })
    k.extrude('wood', [[-d / 2 - 0.03, 0], [d / 2 + 0.03, 0], [d / 2 + 0.03, 0.02], [d / 2, 0.05], [-d / 2, 0.05], [-d / 2 - 0.03, 0.02]], w + 0.06, [0, h - 0.05, 0], { axis: 'x', bevel: 0.004 })
    for (let i = 0; i < levels; i++) {
      const y = 0.09 + 0.024 + i * (h - 0.2) / levels
      if (i > 0) shelfBoard(k, 'wood', inner, d - 0.03, [0, y - 0.011, 0.005], { t: 0.022 })
      const room = (h - 0.2) / levels - 0.04
      if (i === 0 && v !== 0) {
        const dh = 0.024 + (h - 0.2) / levels, dw = (inner + 0.03) / 2
        for (const side of [-1, 1] as const) door(k, 'wood', dw - 0.006, dh, [side * dw / 2, 0.09 + dh / 2, d / 2], { style: v === 2 ? 'panel2' : 'shaker', handle: 'knob', hinge: side })
        continue
      }
      if (k.chance(0.85)) products(k, 'book', -inner / 2 + 0.01, inner / 2 - (k.chance(0.5) ? 0.2 : 0.01), y, 0.01, d - 0.06, { maxH: room, fill: 0.85, rows: 1 })
      if (k.chance(0.35)) for (let j = 0; j < 4; j++) k.blk('paper', [0.2, 0.03, 0.15], inner / 2 - 0.12, y + j * 0.031, 0, { yaw: k.jitter(0.1), r: 0.003, tint: k.pick([[0.6, 0.2, 0.2], [0.2, 0.3, 0.5], [0.3, 0.4, 0.25]] as V3[]) })
    }
  },
  'shoe-shelf': (k, s) => {
    const { w, h, d } = k, v = s.variant, tiers = 3 + (v === 2 ? 1 : 0)
    for (const x of [-1, 1]) k.extrude('wood', [[-d / 2, 0], [d / 2, 0], [d / 2, 0.25], [-d / 2 + 0.06, h], [-d / 2, h]], 0.025, [x * (w / 2 - 0.0125), 0, 0], { axis: 'x', bevel: 0.004 })
    k.blk('wood', [w - 0.05, h - 0.02, 0.012], 0, 0, -d / 2 + 0.006)
    for (let i = 0; i < tiers; i++) {
      const y = 0.12 + i * (h - 0.2) / tiers, z = d / 2 - 0.12 - i * (d - 0.2) / tiers / 1.4, tilt = 0.22
      k.frame({ at: [0, y, z], pitch: tilt }, () => {
        k.box('wood', [w - 0.05, 0.018, 0.24], [0, 0, 0], { r: 0.004 })
        k.box('wood', [w - 0.05, 0.035, 0.012], [0, 0.012, 0.12], { r: 0.004 })
        const pairs = Math.floor((w - 0.1) / 0.24)
        for (let p = 0; p < pairs; p++) if (k.chance(0.75)) {
          const tint = k.pick([[0.35, 0.22, 0.15], [0.15, 0.15, 0.15], [0.6, 0.45, 0.3], [0.7, 0.2, 0.2], [0.85, 0.85, 0.8]] as V3[])
          const px = -w / 2 + 0.1 + p * 0.24
          shoe(k, px, 0.009, 0, Math.PI / 2 + k.jitter(0.1), tint); shoe(k, px + 0.1, 0.009, 0, Math.PI / 2 + k.jitter(0.15), tint)
        }
      })
    }
  },
  'gun-cabinet': (k, s) => {
    const { w, h, d } = k, v = s.variant
    carcass(k, 'steel', w, h, d, { t: 0.03, top: 0.03, plinth: 0.05 })
    const dh = h - 0.38, glassW = v === 0 ? w - 0.06 : (w - 0.06) / 2
    for (let i = 0; i < Math.round((w - 0.1) / 0.13); i++) k.frame({ at: [-w / 2 + 0.1 + i * 0.13, 0.35, -0.02] }, () => {
      k.extrude('wood', [[-0.03, 0], [0.03, 0], [0.04, 0.3], [0.02, 0.36], [0.02, 1.0], [0.015, 1.15], [-0.015, 1.15], [-0.02, 1.0], [-0.02, 0.36], [-0.04, 0.3]], 0.04, [0, 0, 0], { bevel: 0.006, tint: [0.7, 0.55, 0.4] })
      k.cyl('steel', 0.009, 0.6, [0, 1.15 + 0.0, 0], { seg: 10 })
      k.box('steel', [0.03, 0.12, 0.05], [0, 0.42, 0.015], { r: 0.005 })
    })
    k.blk('steel', [w - 0.08, 0.03, 0.12], 0, 0.33, -d / 2 + 0.08, { r: 0.004 })
    for (let i = 0; i < (v === 0 ? 1 : 2); i++) door(k, 'steel', glassW, dh, [-w / 2 + 0.03 + (i + 0.5) * glassW, 0.36 + dh / 2, d / 2], { style: 'glass', hinge: i ? 1 : -1, handle: 'knob', hinges: true, open: v === 2 && i === 1 ? 0.5 : 0 })
    drawer(k, 'steel', w - 0.06, 0.24, [0, 0.07 + 0.13, d / 2], { handle: 'bar', label: true })
    k.frame({ at: [w / 2 - 0.08, 0.32, d / 2 + 0.012] }, () => { k.cyl('steel', 0.022, 0.012, [0, 0, 0.006], { axis: 'z', seg: 18 }); k.cyl('rubber', 0.016, 0.01, [0, 0, 0.016], { axis: 'z', seg: 18 }) })
  },
  'medicine-cabinet': (k, s) => {
    const { w, h, d } = k, v = s.variant
    const inner = carcass(k, 'tile', w, h, d, { t: 0.025, top: 0.03, plinth: 0.06 })
    const split = h * 0.55
    for (let i = 0; i < 3; i++) {
      const y = split + 0.04 + i * (h - split - 0.08) / 3
      shelfBoard(k, 'glass', inner - 0.01, d - 0.06, [0, y, 0], { t: 0.008 })
      products(k, i === 1 ? 'box' : 'med', -inner / 2 + 0.02, inner / 2 - 0.02, y + 0.004, 0, d - 0.1, { maxH: (h - split - 0.08) / 3 - 0.03, fill: 0.6, rows: 1 })
    }
    const doors = v === 0 ? 1 : 2, dw = (w - 0.04) / doors
    for (let i = 0; i < doors; i++) {
      door(k, 'tile', dw, h - split - 0.03, [-w / 2 + 0.02 + (i + 0.5) * dw, split + (h - split - 0.03) / 2, d / 2], { style: 'glass', hinge: i ? 1 : -1, handle: 'bar', open: v === 2 && i === 0 ? 0.4 : 0 })
      door(k, 'tile', dw, split - 0.1, [-w / 2 + 0.02 + (i + 0.5) * dw, 0.07 + (split - 0.1) / 2, d / 2], { style: 'flat', hinge: i ? 1 : -1, handle: 'bar' })
    }
    k.box('paint', [0.1, 0.032, 0.002], [0, split - 0.09, d / 2 + 0.021], { r: 0.0006, tint: [0.85, 0.15, 0.15] })
    k.box('paint', [0.032, 0.1, 0.002], [0, split - 0.09, d / 2 + 0.0215], { r: 0.0006, tint: [0.85, 0.15, 0.15] })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.cyl('steel', 0.018, 0.05, [x * (w / 2 - 0.05), 0.025, z * (d / 2 - 0.05)], { seg: 12 })
  },
  locker: (k, s) => {
    const { w, h, d } = k, v = s.variant, n = v === 2 ? 3 : 2, dw = (w - 0.02) / n
    k.blk('steel', [w, 0.1, d - 0.04], 0, 0, -0.02, { r: 0.004, tone: 0.75 })
    carcass(k, 'steel', w, h - 0.1, d, { t: 0.012, top: 0.012, bottom: 0.1 })
    for (let i = 0; i < n - 1; i++) k.blk('steel', [0.012, h - 0.12, d - 0.02], -w / 2 + 0.01 + (i + 1) * dw, 0.1, -0.01)
    k.extrude('steel', [[-d / 2, 0], [d / 2, 0], [-d / 2, 0.12]], w, [0, h, 0], { axis: 'x', bevel: 0.002 })
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.01 + (i + 0.5) * dw, open = v === 1 && i === n - 1 ? 1.1 : 0
      const lh = h - 0.14
      k.frame({ at: [x, 0.1 + (h - 0.12) / 2, d / 2] }, () => k.leaf({
        kind: 'door', pivot: k.point([-dw / 2 + 0.005, 0, 0]), axis: k.direction([0, -1, 0]), travel: 1.75, initial: open,
        handle: k.point([dw / 2 - 0.04, -0.03, 0.05]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
        center: k.point([0, 0, 0.007]), width: dw - 0.01, height: lh, depth: 0.014, floor: k.point([0, -lh / 2, -0.2]),
      }, () => k.frame({ at: [-dw / 2 + 0.005, 0, 0], yaw: -open }, () => k.frame({ at: [dw / 2 - 0.005, 0, 0] }, () => {
        k.box('steel', [dw - 0.01, h - 0.14, 0.014], [0, 0, 0.007], { r: 0.003 })
        k.box('steel', [dw - 0.05, h - 0.2, 0.004], [0, 0, 0.016], { r: 0.002, tone: 0.95 })
        for (const y of [0.32, -0.42]) for (let j = 0; j < 5; j++) k.box('rubber', [dw * 0.5, 0.008, 0.004], [0, (h - 0.14) * y + j * 0.018, 0.018], { r: 0.002, tone: 0.3 })
        k.box('steel', [0.03, 0.14, 0.012], [dw / 2 - 0.04, 0, 0.022], { r: 0.003 })
        k.box('steel', [0.016, 0.06, 0.02], [dw / 2 - 0.04, -0.03, 0.032], { r: 0.004 })
        k.label([0, (h - 0.14) * 0.42, 0.019], 0.05, 0.025, { m: 'paper' })
        if (k.chance(0.4)) { k.box('steel', [0.03, 0.035, 0.014], [dw / 2 - 0.04, -0.075, 0.04], { r: 0.004 }); k.torus('steel', 0.011, 0.0025, [dw / 2 - 0.04, -0.05, 0.04], { axis: 'z', arc: Math.PI, segR: 12, seg: 6 }) }
      }))))
    }
  },
  wardrobe: (k, s) => {
    const { w, h, d } = k, v = s.variant
    const inner = carcass(k, 'wood', w, h - 0.06, d, { plinth: 0.1, t: 0.024 })
    k.extrude('wood', [[-d / 2 - 0.04, 0], [d / 2 + 0.04, 0], [d / 2 + 0.04, 0.025], [d / 2 + 0.01, 0.06], [-d / 2, 0.06], [-d / 2 - 0.04, 0.025]], w + 0.08, [0, h - 0.06, 0], { axis: 'x', bevel: 0.004 })
    const doors = v === 2 ? 3 : 2, drawerH = 0.22, dw = (inner + 0.03) / doors
    for (let i = 0; i < doors; i++) {
      const x = -inner / 2 - 0.015 + (i + 0.5) * dw
      if (v === 2 && i === 1) {
        door(k, 'wood', dw - 0.006, h - 0.1 - drawerH - 0.07, [x, 0.1 + drawerH + 0.02 + (h - 0.1 - drawerH - 0.07) / 2, d / 2], { style: 'flat', handle: 'knob', hinge: -1 })
        k.box('glass', [dw - 0.1, h - drawerH - 0.4, 0.004], [x, 0.1 + drawerH + 0.02 + (h - 0.1 - drawerH - 0.07) / 2, d / 2 + 0.022], { r: 0.002, tone: 1.15 })
      } else door(k, 'wood', dw - 0.006, h - 0.1 - drawerH - 0.07, [x, 0.1 + drawerH + 0.02 + (h - 0.1 - drawerH - 0.07) / 2, d / 2], { style: v === 1 ? 'panel2' : 'shaker', handle: 'knob', hinge: i % 2 ? 1 : -1, open: v === 0 && i === 1 ? 0.35 : 0 })
    }
    for (let i = 0; i < 2; i++) drawer(k, 'wood', (inner + 0.03) / 2 - 0.006, drawerH - 0.01, [(i - 0.5) * (inner + 0.03) / 2, 0.11 + drawerH / 2, d / 2], { handle: 'cup' })
    if (v === 0) {
      k.cyl('steel', 0.009, inner - 0.02, [0, h - 0.25, 0], { axis: 'x', seg: 10 })
      for (let i = 0; i < 5; i++) k.frame({ at: [inner * 0.05 + i * 0.07, h - 0.25, 0] }, () => {
        k.tube('steel', [[0, 0.02, 0], [0, -0.03, 0], [-0.17, -0.11, 0], [0.17, -0.11, 0], [0, -0.03, 0]], 0.0025, { fillet: 0.01, seg: 5 })
        k.box('fabric', [0.36, 0.6, 0.03], [0, -0.42, 0], { r: 0.012, tint: k.pick([[0.6, 0.6, 0.65], [0.3, 0.35, 0.5], [0.6, 0.3, 0.25]] as V3[]) })
      })
    }
  },
  'filing-cabinet': (k, s) => {
    const { w, h, d } = k, v = s.variant, n = v === 0 ? 3 : 4
    carcass(k, 'steel', w, h, d, { t: 0.015, top: 0.02, plinth: 0.04 })
    const dh = (h - 0.07) / n
    for (let i = 0; i < n; i++) {
      const open = i === n - 2 && v !== 1 ? 0.035 : 0, y = 0.045 + (i + 0.5) * dh
      if (open) {
        for (const x of [-1, 1]) k.box('steel', [0.012, dh - 0.04, open + 0.02], [x * (w / 2 - 0.04), y - 0.01, d / 2 + open / 2 - 0.02], { r: 0.002 })
        k.box('steel', [w - 0.08, 0.01, open], [0, y - dh / 2 + 0.03, d / 2 + open / 2 - 0.02], { r: 0.002 })
        for (let f = 0; f < Math.floor(open / 0.012); f++) k.box('paper', [w - 0.11, dh - 0.08 + k.jitter(0.02), 0.004], [0, y - 0.02, d / 2 + 0.01 + f * 0.012], { pitch: k.jitter(0.08), r: 0.001, tint: [0.95, 0.85, 0.55] })
      }
      drawer(k, 'steel', w - 0.03, dh - 0.008, [0, y, d / 2 + open], { handle: 'cup', label: true, flat: true })
    }
    if (v === 2) for (let i = 0; i < 3; i++) k.blk('paper', [0.24, 0.025, 0.32], k.jitter(0.02), h + i * 0.026, 0, { yaw: k.jitter(0.1), r: 0.003, tint: [0.92, 0.8, 0.5] })
  },
  safe: (k, s) => {
    const { w, h, d } = k, v = s.variant
    hollow(k, 'steel', [w, h - 0.05, d], [0, 0.05, 0], 0.06, { r: 0.012, tint: [0.45, 0.48, 0.5] })
    k.blk('steel', [w - 0.12, 0.012, d - 0.1], 0, 0.05 + (h - 0.05) * 0.52, -0.02, { r: 0.003, tint: [0.32, 0.34, 0.36] })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('steel', [0.08, 0.05, 0.08], x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06), { r: 0.01 })
    const dw = w - 0.08, dh = h - 0.16
    const vault = k.leaf({
      kind: 'door', pivot: k.point([-w / 2 + 0.03, 0, d / 2 + 0.01]), axis: k.direction([0, -1, 0]), travel: 1.75, initial: 0,
      handle: k.point([0, 0.105 + dh * 0.62 - 0.17, d / 2 + 0.07]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
      center: k.point([0, 0.105 + dh / 2, d / 2 + 0.005]), width: dw, height: dh, depth: 0.03, floor: k.point([0, 0.12, 0]),
    }, () => {
      k.box('steel', [dw, dh, 0.03], [0, 0.05 + 0.055 + dh / 2, d / 2 + 0.005], { r: 0.012, tint: [0.42, 0.45, 0.48] })
      k.box('steel', [dw - 0.08, dh - 0.08, 0.008], [0, 0.105 + dh / 2, d / 2 + 0.024], { r: 0.006, tint: [0.4, 0.42, 0.45] })
    })
    for (const y of [0.3, 0.75]) k.cyl('steel', 0.022, 0.14, [-w / 2 + 0.03, 0.105 + dh * y, d / 2 + 0.01], { seg: 14 })
    k.within(vault, () => {
      const cx = 0, cy = 0.105 + dh * 0.62
      k.lathe('steel', [[0, 0], [0.06, 0], [0.062, 0.008], [0.055, 0.02], [0.04, 0.024], [0, 0.026]], [cx, cy, d / 2 + 0.028], { axis: 'z', seg: 40, crease: 30 })
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; k.box('rubber', [0.0015, i % 5 ? 0.006 : 0.012, 0.002], [cx + Math.cos(a) * 0.054, cy + Math.sin(a) * 0.054, d / 2 + 0.044], { roll: a - Math.PI / 2, r: 0, tone: 0.3 }) }
      k.cyl('steel', 0.012, 0.03, [cx + 0.0, cy - 0.17, d / 2 + 0.04], { axis: 'z', seg: 14 })
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.3; k.tube('steel', [[cx, cy - 0.17, d / 2 + 0.05], [cx + Math.cos(a) * 0.09, cy - 0.17 + Math.sin(a) * 0.09, d / 2 + 0.052]], 0.007); k.sphere('steel', 0.012, [cx + Math.cos(a) * 0.09, cy - 0.17 + Math.sin(a) * 0.09, d / 2 + 0.052], { rows: 6, seg: 10 }) }
      k.label([0, 0.105 + dh * 0.9, d / 2 + 0.029], 0.12, 0.03, { m: 'paint' })
    })
    if (v === 2) for (const x of [-1, 1]) k.box('steel', [0.004, h * 0.6, d * 0.8], [x * (w / 2 + 0.001), h * 0.45, 0], { r: 0.002, tone: 0.8 })
  },
  nightstand: (k, s) => {
    const { w, h, d } = k, v = s.variant, legH = 0.12
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('wood', [0.035, legH + 0.02, 0.035], x * (w / 2 - 0.03), 0, z * (d / 2 - 0.03), { taper: 0.35 })
    const inner = carcass(k, 'wood', w, h - legH, d, { bottom: legH, top: 0.022, overhang: 0.01 })
    drawer(k, 'wood', inner + 0.03, 0.13, [0, h - 0.022 - 0.075, d / 2], { handle: v === 1 ? 'bar' : 'knob' })
    if (v === 2) door(k, 'wood', inner + 0.03, h - legH - 0.2, [0, legH + 0.015 + (h - legH - 0.2) / 2, d / 2], { style: 'shaker', handle: 'knob', hinge: -1 })
    else shelfBoard(k, 'wood', inner, d - 0.03, [0, legH + (h - legH) * 0.35, 0], { t: 0.016 })
    k.frame({ at: [-w * 0.18, h, -d * 0.1] }, () => {
      k.lathe('tile', [[0, 0], [0.05, 0], [0.055, 0.01], [0.034, 0.025], [0.042, 0.08], [0.034, 0.11], [0.01, 0.12], [0, 0.12]], [0, 0, 0], { seg: 20, tint: [0.8, 0.75, 0.6] })
      k.cyl('steel', 0.005, 0.06, [0, 0.15, 0], { seg: 8 })
      k.lathe('fabric', [[0.05, 0], [0.09, 0], [0.055, 0.11], [0.05, 0.11]], [0, 0.15, 0], { seg: 24, tint: [0.95, 0.9, 0.75] })
    })
    k.blk('paper', [0.13, 0.025, 0.19], w * 0.2, h, d * 0.08, { yaw: 0.3, r: 0.003, tint: [0.5, 0.25, 0.2] })
  },
  dresser: (k, s) => {
    const { w, h, d } = k, v = s.variant, foot = 0.1
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.extrude('wood', [[0, 0], [0.06, 0], [0.06, foot], [0, foot], [0.01, foot * 0.5]], 0.05, [x * (w / 2 - 0.035), 0, z * (d / 2 - 0.03)], { axis: 'x', yaw: x > 0 ? Math.PI : 0, bevel: 0.006 })
    const inner = carcass(k, 'wood', w, h - foot, d, { bottom: foot, top: 0.028, overhang: 0.012 })
    const rows = v === 0 ? [1, 1, 1] : v === 1 ? [2, 1, 1, 1] : [2, 2, 2, 2]
    const rh = (h - foot - 0.05) / rows.length
    rows.forEach((cols, r) => { for (let c = 0; c < cols; c++) drawer(k, 'wood', (inner + 0.03) / cols - 0.006, rh - 0.008, [-(inner + 0.03) / 2 + (c + 0.5) * (inner + 0.03) / cols, foot + 0.015 + (rows.length - r - 0.5) * rh, d / 2], { handle: cols === 1 ? 'bar' : 'knob', hm: 'steel' }) })
    k.frame({ at: [w * 0.25, h, -0.04] }, () => { k.box('wood', [0.18, 0.08, 0.12], [0, 0.04, 0], { r: 0.008, tint: [0.7, 0.45, 0.35] }); k.box('steel', [0.03, 0.02, 0.005], [0, 0.05, 0.062], { r: 0.002 }) })
    k.frame({ at: [-w * 0.25, h, -0.06], yaw: 0.2 }, () => { k.frameRect('wood', 0.14, 0.19, 0.016, 0.012, [0, 0.1, 0], { pitch: -0.15 }); k.box('paper', [0.11, 0.16, 0.002], [0, 0.1, 0.002], { pitch: -0.15, r: 0.0005 }) })
  },
  counter: (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.blk('wood', [w - 0.06, 0.1, d - 0.12], 0, 0, -0.02, { tone: 0.6 })
    k.blk('wood', [w, 0.04, d], 0, h - 0.04, 0, { r: 0.012 })
    k.blk('wood', [w - 0.02, h - 0.14, 0.03], 0, 0.1, d / 2 - 0.07, { r: 0.004 })
    for (const x of [-1, 1]) k.blk('wood', [0.03, h - 0.14, d - 0.1], x * (w / 2 - 0.025), 0.1, -0.02)
    const panels = Math.max(2, Math.round(w / 0.5)), pw = (w - 0.06) / panels
    for (let i = 0; i < panels; i++) {
      const x = -w / 2 + 0.03 + (i + 0.5) * pw
      if (v === 2 && i === panels - 1) { k.frameRect('wood', pw - 0.01, h - 0.24, 0.04, 0.03, [x, 0.12 + (h - 0.24) / 2, d / 2 - 0.04]); k.box('glass', [pw - 0.08, h - 0.32, 0.006], [x, 0.12 + (h - 0.24) / 2, d / 2 - 0.045]); continue }
      k.frameRect('wood', pw - 0.01, h - 0.24, 0.05, 0.022, [x, 0.12 + (h - 0.24) / 2, d / 2 - 0.044])
      k.box('wood', [pw - 0.11, h - 0.34, 0.012], [x, 0.12 + (h - 0.24) / 2, d / 2 - 0.05], { r: 0.008, tone: 0.9 })
    }
    k.box('wood', [w + 0.01, 0.035, 0.03], [0, h - 0.06, d / 2 - 0.035], { r: 0.012 })
    for (const y of [0.35, 0.65]) shelfBoard(k, 'wood', w - 0.08, d - 0.18, [0, y, -0.05], { t: 0.02 })
    const tillW = Math.min(0.5, (w - 0.16) / 2 - 0.01)
    k.blk('wood', [w - 0.08, 0.018, d - 0.16], 0, h - 0.195, -0.05, { r: 0.003 })
    k.blk('wood', [0.018, 0.14, d - 0.16], 0, h - 0.18, -0.05, { r: 0.003 })
    for (const side of [-1, 1]) drawer(k, 'wood', tillW, 0.12, [side * (tillW / 2 + 0.012), h - 0.115, -d / 2 + 0.03], { yaw: Math.PI, handle: 'bar' })
    goods(k, 'paper', -w / 2 + 0.06, w * 0.1, 0.36, -0.05, 0.3, { maxH: 0.22 })
    if (v !== 1) { k.box('rubber', [0.3, 0.004, 0.22], [w * 0.2, h + 0.002, 0.05], { r: 0.002, tone: 0.5 }); k.blk('paper', [0.15, 0.02, 0.21], -w * 0.25, h, 0.02, { yaw: 0.2, r: 0.002 }) }
  },
  checkout: (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.blk('steel', [w, 0.08, d - 0.04], 0, 0, 0, { tone: 0.6, r: 0.005 })
    k.blk('steel', [w, h - 0.12, d - 0.02], 0, 0.08, 0, { r: 0.01 })
    k.box('steel', [w, 0.04, d], [0, h - 0.02, 0], { r: 0.012 })
    const till = w / 2 - 0.21
    k.box('rubber', [0.38, 0.09, 0.002], [till, h - 0.115, -d / 2 + 0.009], { r: 0, tone: 0.2 })
    drawer(k, 'steel', 0.4, 0.11, [till, h - 0.115, -d / 2 + 0.01], { yaw: Math.PI, handle: 'none', flat: true })
    k.box('rubber', [w * 0.62, 0.012, d * 0.62], [-w * 0.17, h + 0.006, 0.04], { r: 0.005 })
    for (const x of [-1, 1]) k.cyl('steel', 0.02, d * 0.62, [-w * 0.17 + x * w * 0.31, h + 0.0, 0.04], { axis: 'z', seg: 14 })
    k.box('steel', [w * 0.64, 0.02, 0.02], [-w * 0.17, h + 0.03, d / 2 - 0.02], { r: 0.008 })
    k.box('glass', [0.22, 0.004, 0.22], [w * 0.22, h + 0.002, 0.05], { r: 0.002 })
    k.frame({ at: [w * 0.22, h, -d / 2 + 0.06] }, () => { k.box('steel', [0.18, 0.18, 0.06], [0, 0.09, 0], { r: 0.008 }); k.box('glass', [0.15, 0.13, 0.004], [0, 0.1, 0.031], { pitch: -0.1 }) })
    k.frame({ at: [w / 2 - 0.15, h, -d / 2 + 0.12] }, () => {
      k.cyl('steel', 0.02, 0.06, [0, 0.03, 0], { seg: 12 })
      k.box('steel', [0.34, 0.06, 0.26], [0, 0.09, 0], { r: 0.01 })
      k.screen([0, 0.2, -0.06], 0.24, 0.14, { pitch: -0.25 })
      k.box('rubber', [0.3, 0.02, 0.1], [0, 0.13, 0.08], { pitch: 0.2, r: 0.004 })
      for (let i = 0; i < 12; i++) k.box('tile', [0.035, 0.008, 0.025], [-0.11 + (i % 6) * 0.044, 0.146 + Math.floor(i / 6) * 0.01, 0.06 + Math.floor(i / 6) * 0.035], { pitch: 0.2, r: 0.002 })
    })
    k.frame({ at: [-w / 2 + 0.08, h, -d / 2 + 0.08] }, () => { k.box('paint', [0.07, 0.12, 0.05], [0, 0.06, 0], { r: 0.008, tint: [0.25, 0.25, 0.25] }); k.screen([0, 0.09, 0.026], 0.05, 0.035, { bezel: 0.004 }) })
    k.frame({ at: [-w / 2 + 0.11, h, d / 2 - 0.06] }, () => { k.cyl('steel', 0.015, 0.2, [0, 0.1, 0], { seg: 12 }); k.box('paint', [0.18, 0.08, 0.05], [0, 0.24, 0], { r: 0.01, tint: [0.9, 0.85, 0.3] }) })
    for (let i = 0; i < 3; i++) k.blk('paint', [0.03, 0.15, 0.06], -w * 0.4 + i * 0.12, 0.25, d / 2 + 0.0, { r: 0.006, tint: k.pick([[0.9, 0.3, 0.2], [0.3, 0.6, 0.9], [0.9, 0.8, 0.2]] as V3[]), yaw: k.jitter(0.1) })
    if (v === 2) products(k, 'can', -w * 0.4, -w * 0.05, h + 0.012, 0.04, 0.2, { fill: 0.6, rows: 1 })
  },
  'bakery-case': (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.blk('tile', [w, 0.75, d], 0, 0, 0, { r: 0.01 })
    k.blk('steel', [w - 0.04, 0.08, 0.02], 0, 0, d / 2 - 0.02, { tone: 0.6 })
    for (const x of [-1, 1]) k.blk('steel', [0.03, h - 0.75, d], x * (w / 2 - 0.015), 0.75, 0, { r: 0.004 })
    k.box('steel', [w, 0.03, d], [0, h - 0.015, 0], { r: 0.006 })
    k.box('steel', [w - 0.06, 0.012, d - 0.06], [0, 0.75 + 0.006, 0], { r: 0.002 })
    k.box('steel', [w - 0.06, 0.012, d * 0.55], [0, 0.98, -d * 0.18], { r: 0.002 })
    for (let i = 0; i < 2; i++) k.box('steel', [0.02, 0.012, d - 0.04], [(i - 0.5) * w * 0.5, h - 0.04, 0], { r: 0.003 })
    k.frame({ at: [0, 0.75, d / 2 - 0.02] }, () => {
      for (let i = 0; i < Math.round(w / 0.6); i++) {
        const shards = k.chance(0.5)
        const x = -w / 2 + 0.03 + (i + 0.5) * (w - 0.06) / Math.round(w / 0.6), pw = (w - 0.06) / Math.round(w / 0.6) - 0.01
        if (shards || v === 1) for (let j = 0; j < 3; j++) k.extrude('glass', [[-pw / 2, 0], [pw / 2, 0], [pw / 2 - k.range(0, 0.1), k.range(0.05, 0.18)], [k.range(-0.1, 0.1), k.range(0.06, 0.22)], [-pw / 2, k.range(0.04, 0.15)]], 0.005, [x, 0.01, 0], { pitch: -0.15 })
      }
    })
    for (let i = 0; i < 6 + s.variant * 2; i++) if (k.chance(0.6)) {
      const x = -w / 2 + 0.15 + k.rnd() * (w - 0.3), z = k.jitter(d * 0.25), shelf = k.chance(0.5)
      k.sphere('paper', 0.05, [x, (shelf ? 0.986 : 0.762) + 0.03, shelf ? -d * 0.18 + k.jitter(0.08) : z], { yaw: k.rnd() * 3, scale: [1.8, 0.65, 0.9], tint: [0.85, 0.6, 0.35], rows: 8, seg: 14 })
    }
  },
  reception: (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.blk('wood', [w, h - 0.03, 0.04], 0, 0, d / 2 - 0.12, { r: 0.006 })
    k.box('wood', [w + 0.04, 0.03, 0.22], [0, h - 0.015, d / 2 - 0.11], { r: 0.01 })
    for (const x of [-1, 1]) k.blk('wood', [0.04, 0.74, d - 0.12], x * (w / 2 - 0.02), 0, -0.06)
    k.box('wood', [w - 0.08, 0.03, d - 0.2], [0, 0.74, -0.07], { r: 0.008 })
    for (let i = 0; i < 3; i++) k.box('wood', [0.012, h - 0.25, 0.012], [-w / 2 + (i + 1) * w / 4, 0.1 + (h - 0.25) / 2, d / 2 - 0.095], { r: 0.003 })
    k.blk('steel', [w - 0.06, 0.05, 0.02], 0, 0, d / 2 - 0.1, { tone: 0.5 })
    const inner = carcass(k, 'wood', 0.45, 0.72, d - 0.3, { x: -w / 2 + 0.27, z: -0.13, plinth: 0.05 })
    for (let j = 0; j < 3; j++) drawer(k, 'wood', inner + 0.03, 0.2, [-w / 2 + 0.27, 0.07 + (j + 0.5) * 0.215, -0.13 + (d - 0.3) / 2], { handle: 'bar' })
    k.frame({ at: [w * 0.12, 0.755, -d * 0.18] }, () => {
      k.box('steel', [0.18, 0.012, 0.14], [0, 0.006, 0], { r: 0.004 })
      k.box('steel', [0.04, 0.2, 0.03], [0, 0.1, -0.03], { r: 0.006 })
      k.screen([0, 0.34, -0.02], 0.48, 0.3, { pitch: -0.05 })
      k.box('rubber', [0.42, 0.018, 0.14], [0, 0.009, 0.16], { r: 0.004 })
    })
    k.frame({ at: [w * 0.3, h, d / 2 - 0.1] }, () => {
      k.cyl('steel', 0.04, 0.012, [0, 0.006, 0], { seg: 18 })
      k.lathe('steel', [[0, 0], [0.035, 0], [0.032, 0.02], [0.022, 0.04], [0, 0.045]], [0, 0.012, 0], { seg: 18 })
      k.sphere('steel', 0.007, [0, 0.062, 0], { rows: 4, seg: 8 })
    })
    if (v !== 0) k.frame({ at: [-w * 0.25, h, d / 2 - 0.1] }, () => { k.extrude('wood', [[-0.1, 0], [0.1, 0], [0.1, 0.01], [0.08, 0.05], [-0.08, 0.05], [-0.1, 0.01]], 0.03, [0, 0, 0], { bevel: 0.003 }); k.box('steel', [0.15, 0.03, 0.002], [0, 0.03, 0.012], { pitch: -0.4, r: 0.0005 }) })
    for (let i = 0; i < 5; i++) k.box('paper', [0.21, 0.004, 0.29], [-w * 0.05 + k.jitter(0.05), 0.757 + i * 0.004, -0.02], { yaw: k.jitter(0.3), r: 0.001 })
  },
}
