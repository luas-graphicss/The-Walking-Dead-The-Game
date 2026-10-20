import { roundRect, type Family, type Kit, type Mat, type V2, type V3 } from '../kit'
import { carcass, drawer, hollow } from './common'
import { GALV, legFrame, pail } from './shop'
import { PACK_TINTS, ball, book, carton, folded, lighten, packet, rifle, shoe, teddy, toyBlock, toyTruck } from './props'

const LAMINATE: V3 = [0.86, 0.84, 0.8]
const ALU: V3 = [0.82, 0.83, 0.84]
const DARK: V3 = [0.2, 0.2, 0.22]
const OAK: V3 = [0.62, 0.46, 0.3]
const WALNUT: V3 = [0.36, 0.24, 0.16]

function riser(k: Kit, m: Mat, w: number, d: number, bottom: number, steps: number, rise: number, at: [number, number], tint: V3) {
  const run = d / steps, out: { y: number; z: number; run: number }[] = []
  for (let i = 0; i < steps; i++) {
    const hgt = rise * (i + 1), z = at[1] + d / 2 - run * (i + 0.5)
    k.blk(m, [w, hgt, run], at[0], bottom, z, { r: 0.006, tint })
    k.box('steel', [w, 0.012, 0.014], [at[0], bottom + hgt - 0.006, z + run / 2 + 0.007], { r: 0.004, tint: ALU })
    out.push({ y: bottom + hgt, z, run })
  }
  return out
}

function priceCard(k: Kit, at: V3, o: { yaw?: number; tint?: V3 } = {}) {
  k.frame({ at, yaw: o.yaw }, () => {
    k.box('steel', [0.05, 0.006, 0.03], [0, 0.003, 0], { r: 0.002, tint: ALU })
    k.box('steel', [0.004, 0.05, 0.004], [0, 0.031, 0], { r: 0.001, tint: ALU })
    k.box('paper', [0.08, 0.05, 0.0015], [0, 0.081, 0.00275], { r: 0, tint: o.tint ?? [0.98, 0.96, 0.9] })
  })
}

function produceItem(k: Kit, kind: number, at: V3, r: number) {
  const tints: V3[] = [[0.75, 0.15, 0.12], [0.95, 0.55, 0.12], [0.62, 0.48, 0.3], [0.85, 0.7, 0.45], [0.45, 0.62, 0.3]]
  const scale: V3 = kind === 2 ? [1.25, 0.8, 1] : kind === 4 ? [1, 0.92, 1] : [1, 0.95, 1]
  k.sphere('paper', r, [at[0], at[1] + r * scale[1], at[2]], { rows: 7, seg: 11, scale, yaw: k.rnd() * 3, tint: tints[kind], tone: 0.8 + k.rnd() * 0.3 })
  if (kind === 0 || kind === 1) k.cyl('wood', 0.0025, 0.012, [at[0], at[1] + r * 1.9 + 0.004, at[2]], { seg: 5, tint: [0.35, 0.25, 0.15] })
}

function produceCrate(k: Kit, cw: number, cd: number, ch: number, at: V3, kind: number, fill: number) {
  k.frame({ at }, () => {
    for (const x of [-1, 1]) k.blk('wood', [0.014, ch, cd], x * (cw / 2 - 0.007), 0, 0, { r: 0.003, tint: OAK })
    for (const z of [-1, 1]) for (const y of [0.012, ch - 0.032]) k.blk('wood', [cw - 0.028, 0.02, 0.01], 0, y, z * (cd / 2 - 0.005), { r: 0.002, tint: OAK })
    k.blk('wood', [cw - 0.028, 0.01, cd - 0.02], 0, 0, 0, { r: 0.002, tint: OAK })
    const r = kind === 4 ? 0.06 : kind === 2 ? 0.032 : 0.036, nx = Math.max(1, Math.floor((cw - 0.03) / (2 * r))), nz = Math.max(1, Math.floor((cd - 0.03) / (2 * r)))
    const sx = (cw - 0.03 - 2 * r) / Math.max(1, nx - 1), sz = (cd - 0.03 - 2 * r) / Math.max(1, nz - 1)

    const lift = Math.sqrt(Math.max(0, (1.7 * r) ** 2 - (sx / 2) ** 2 - (sz / 2) ** 2)), layers = Math.hypot(sx / 2, sz / 2) < 1.75 * r ? 2 : 1
    const placed = new Set<string>()
    for (let layer = 0; layer < layers; layer++) for (let i = 0; i < nx - layer; i++) for (let j = 0; j < nz - layer; j++) {
      if (layer && [[0, 0], [1, 0], [0, 1], [1, 1]].filter(([a, b]) => placed.has(`${i + a},${j + b}`)).length < 3) continue
      if (!k.chance(layer ? fill * 0.7 : fill)) continue
      if (!layer) placed.add(`${i},${j}`)
      const x = -cw / 2 + 0.015 + r + (i + layer * 0.5) * sx, z = -cd / 2 + 0.015 + r + (j + layer * 0.5) * sz
      produceItem(k, kind, [x + k.jitter(0.004), 0.01 + layer * lift, z + k.jitter(0.004)], r * (0.92 + k.rnd() * 0.12))
    }
  })
}

export const COMMERCE: Family = {
  'cash-register': (k, s) => {
    const { w, d } = k, v = s.variant, top = 0.92, cd = d - 0.06, t = 0.018

    k.frame({ yaw: Math.PI }, () => carcass(k, 'wood', w, top, cd, { plinth: 0.09, top: 0.035, topM: 'tile', overhang: 0.025 }))
    k.blk('rubber', [w - 2 * t, 0.108, 0.012], 0, 0, cd / 2 - 0.006 - 0.008, { r: 0.003 })
    const boards = Math.round(w / 0.11), bw = w / boards
    for (let i = 0; i < boards; i++) k.blk('wood', [bw - 0.003, top - 0.035 - 0.108, 0.014], -w / 2 + (i + 0.5) * bw, 0.108, cd / 2 + 0.007, { r: 0.002, tint: v === 2 ? [0.42, 0.33, 0.25] : [0.58, 0.45, 0.32] })
    k.blk('steel', [w, 0.03, 0.016], 0, 0.62, cd / 2 + 0.014 + 0.008, { r: 0.006, tint: ALU })

    k.blk('wood', [w - 2 * t, t, cd - 0.03], 0, 0.48, 0.006)
    for (let i = 0; i < 3 + v; i++) k.cyl('paper', 0.04, 0.08, [-w / 2 + 0.1 + i * 0.09, 0.48 + t + 0.04, -cd / 2 + 0.12], { axis: 'z', seg: 16, tint: [0.97, 0.96, 0.92] })
    carton(k, 0.32, 0.18, 0.26, [w * 0.2, 0.108, -0.02], { label: true })
    folded(k, 0.3, 0.07, 0.24, [w * 0.22, 0.48 + t, -0.04], { tint: [0.92, 0.9, 0.86] })

    const px = -w * 0.12, pz = -0.04, hy = top + 0.11
    k.blk('steel', [0.44, 0.11, 0.44], px, top, pz, { r: 0.008, tint: DARK })
    const open = v === 2 ? 0.1 : 0
    k.frame({ at: [px, top + 0.02, pz - 0.22 - open] }, () => {
      if (open) {
        k.blk('steel', [0.4, 0.006, open + 0.02], 0, 0, open / 2 + 0.01, { r: 0.001, tint: DARK })
        for (let i = 0; i < 5; i++) k.blk('steel', [0.004, 0.05, open], -0.16 + i * 0.08, 0.006, open / 2, { r: 0.001, tint: DARK })
        for (let i = 0; i < 9; i++) k.cyl('steel', 0.011, 0.002, [-0.18 + (i % 4) * 0.08 + 0.04 + k.jitter(0.01), 0.007 + Math.floor(i / 4) * 0.0021, open * 0.5 + k.jitter(0.04)], { seg: 10, tint: [0.8, 0.7, 0.4] })
      }
      drawer(k, 'steel', 0.42, 0.07, [0, 0.035, 0], { yaw: Math.PI, handle: 'none', flat: true })
      k.box('steel', [0.03, 0.03, 0.01], [0.14, 0.035, -0.023], { r: 0.004, tint: [0.7, 0.7, 0.72] })
    })
    k.blk('steel', [0.36, 0.05, 0.32], px, hy, pz + 0.04, { r: 0.01, tint: [0.28, 0.28, 0.3] })
    k.frame({ at: [px, hy + 0.05, pz - 0.05], pitch: 0.22 }, () => {
      k.blk('steel', [0.32, 0.018, 0.17], 0, 0, 0, { r: 0.006, tint: [0.24, 0.24, 0.26] })
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) k.blk('rubber', [0.034, 0.008, 0.026], -0.125 + i * 0.05, 0.018, -0.054 + j * 0.036, { r: 0.003, tint: j === 0 && i > 3 ? [0.75, 0.25, 0.2] : [0.82, 0.8, 0.75] })
    })
    const poleY = hy + 0.05
    k.cyl('steel', 0.018, 0.24, [px, poleY + 0.12, pz + 0.14], { seg: 14, tint: DARK })
    k.box('steel', [0.26, 0.17, 0.05], [px, poleY + 0.24 + 0.085, pz + 0.14], { r: 0.01, tint: DARK })
    k.screen([px, poleY + 0.24 + 0.085, pz + 0.14 - 0.025], 0.22, 0.13, { yaw: Math.PI, bezel: 0.012 })
    k.screen([px, poleY + 0.24 + 0.085, pz + 0.14 + 0.025], 0.2, 0.06, { bezel: 0.01 })
    const rx = px + 0.33
    k.blk('steel', [0.15, 0.13, 0.2], rx, top, -0.08, { r: 0.012, tint: [0.88, 0.87, 0.84] })
    k.box('rubber', [0.1, 0.004, 0.012], [rx, top + 0.132, -0.12], { r: 0.001 })
    k.frame({ at: [rx, top + 0.134, -0.13], pitch: -0.9 }, () => k.box('paper', [0.075, 0.0012, 0.11], [0, 0, -0.055], { r: 0, tint: [0.98, 0.97, 0.94] }))

    k.cyl('steel', 0.035, 0.012, [w * 0.15, top + 0.006, cd / 2 - 0.14], { seg: 16, tint: DARK })
    k.cyl('steel', 0.01, 0.07, [w * 0.15, top + 0.047, cd / 2 - 0.14], { seg: 10, tint: DARK })
    k.frame({ at: [w * 0.15, top + 0.082, cd / 2 - 0.14], pitch: -0.5 }, () => {
      k.box('steel', [0.085, 0.16, 0.04], [0, 0.08, 0], { r: 0.008, tint: DARK })
      k.screen([0, 0.12, 0.02], 0.06, 0.045, { bezel: 0.006 })
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) k.box('rubber', [0.014, 0.01, 0.004], [-0.02 + j * 0.02, 0.03 + i * 0.016, 0.022], { r: 0.002, tint: [0.75, 0.75, 0.72] })
    })
    if (v > 0) {

      const ix = w * 0.36
      k.blk('paint', [0.26, 0.05, 0.16], ix, top, 0.1, { r: 0.004, tint: [0.75, 0.15, 0.12] })
      k.blk('paint', [0.26, 0.05, 0.08], ix, top + 0.05, 0.06, { r: 0.004, tint: [0.75, 0.15, 0.12] })
      for (let i = 0; i < 4; i++) packet(k, 0.05, 0.08, 0.02, [ix - 0.09 + i * 0.06, top + 0.05, 0.155], { tint: k.pick(PACK_TINTS) })
      for (let i = 0; i < 4; i++) if (k.chance(0.75)) packet(k, 0.05, 0.08, 0.02, [ix - 0.09 + i * 0.06, top + 0.1, 0.075], { tint: k.pick(PACK_TINTS) })
    }
    if (v === 2) for (let i = 0; i < 6; i++) k.cyl('steel', 0.011, 0.002, [px + 0.25 + k.jitter(0.12), top + 0.001, -0.25 + k.jitter(0.05)], { seg: 10, tint: [0.8, 0.7, 0.4] })
  },

  'weapon-display': (k, s) => {
    const { w, h, d } = k, v = s.variant, base = 0.14, post = 0.07, backZ = -d / 2 + post / 2

    k.blk('wood', [w, base - 0.012, d], 0, 0, 0, { r: 0.006, tint: WALNUT })
    k.blk('fabric', [w - 0.03, 0.012, d - 0.03], 0, base - 0.012, 0, { r: 0.004, tint: [0.22, 0.3, 0.22] })
    for (const x of [-1, 1]) k.blk('wood', [post, h - base, post], x * (w / 2 - post / 2), base, backZ, { r: 0.006, tint: WALNUT })
    k.blk('wood', [w, 0.1, post + 0.02], 0, h - 0.1, backZ + 0.01, { r: 0.008, tint: WALNUT })
    k.box('paint', [w * 0.6, 0.06, 0.004], [0, h - 0.05, backZ + 0.01 + (post + 0.02) / 2 + 0.002], { r: 0, tint: [0.75, 0.62, 0.3] })

    const slats = Math.floor((h - 0.1 - base) / 0.076), sh = (h - 0.1 - base) / slats
    for (let i = 0; i < slats; i++) k.blk('wood', [w - 2 * post, sh - 0.012, 0.02], 0, base + i * sh + 0.006, backZ - post / 2 + 0.01, { r: 0.003, tint: [0.68, 0.6, 0.48] })
    for (let i = 1; i < slats; i++) k.blk('steel', [w - 2 * post, 0.012, 0.012], 0, base + i * sh - 0.006, backZ - post / 2 + 0.006, { r: 0.001, tint: ALU })

    const n = v === 0 ? 3 : v === 1 ? 4 : 5, span = w - 2 * post - 0.2, rz = backZ + 0.13, combY = h * 0.6, len = combY - base + 0.32
    const xs = Array.from({ length: n }, (_, i) => -span / 2 + (i + 0.5) * span / n)
    k.blk('wood', [w - 2 * post, 0.04, 0.05], 0, combY - 0.02, backZ - post / 2 + 0.02 + 0.025, { r: 0.004, tint: WALNUT })
    const teeth = [-span / 2 - 0.06, ...xs.slice(1).map((x, i) => (x + xs[i]) / 2), span / 2 + 0.06]
    for (const x of teeth) k.blk('wood', [0.05, 0.04, rz - (backZ - post / 2 + 0.045) + 0.03], x - 0.06 + 0.0195 + 0.06, combY - 0.02, (backZ - post / 2 + 0.045 + rz + 0.03) / 2, { r: 0.006, tint: WALNUT })
    xs.forEach((x, i) => {
      const empty = v === 2 && i === 2
      k.blk('rubber', [0.15, 0.02, 0.07], x + 0.06, base, rz, { r: 0.006 })
      if (empty) { priceCard(k, [x + 0.06, base + 0.02, rz + 0.02]); return }
      rifle(k, len, [x, base + 0.02, rz], { scope: i % 2 === 0, pump: i === 1, stock: i % 3 === 2 ? [0.32, 0.22, 0.15] : [0.55, 0.38, 0.24] })
      priceCard(k, [x + 0.06, base, rz + 0.1])
    })

    const barY = base + 0.2, barZ = rz + 0.036 / 2 + 0.006
    k.blk('steel', [w - 2 * post, 0.03, 0.008], 0, barY, barZ, { r: 0.002, tint: DARK })
    for (const x of [-1, 1]) k.blk('steel', [0.03, 0.03, barZ - backZ - post / 2 + 0.004], x * (w / 2 - post - 0.015), barY, (barZ + backZ + post / 2) / 2, { r: 0.002, tint: DARK })

    k.frame({ at: [w / 2 - post - 0.06, barY + 0.012, barZ + 0.004] }, () => {
      k.box('steel', [0.04, 0.035, 0.016], [0, -0.0175, 0.008], { r: 0.006, tint: [0.75, 0.62, 0.3] })
      k.torus('steel', 0.012, 0.003, [0, -0.0015, 0.008], { axis: 'z', segR: 12, seg: 5, arc: Math.PI, roll: Math.PI / 2 })
    })
  },

  'produce-display': (k, s) => {
    const { w, h, d } = k, v = s.variant, t = 0.04

    const tiers = [{ y: 0.42, z: d / 3 }, { y: 0.62, z: 0 }, { y: 0.82, z: -d / 3 }], run = d / 3
    for (const x of [-1, 1]) {
      const outline: V2[] = [[-d / 2, 0], [d / 2, 0], [d / 2, 0.42], [d / 6, 0.42], [d / 6, 0.62], [-d / 6, 0.62], [-d / 6, 0.82], [-d / 2, 0.82]]
      k.extrude('wood', outline.map(([z, y]) => [-z, y] as V2), t, [x * (w / 2 - t / 2), 0, 0], { axis: 'x', bevel: 0.006, tint: [0.5, 0.36, 0.24] })
    }
    k.blk('wood', [w - 2 * t, 0.06, 0.03], 0, 0.06, d / 2 - 0.05, { r: 0.004, tint: [0.5, 0.36, 0.24] })
    k.blk('wood', [w - 2 * t, 0.06, 0.03], 0, 0.06, -d / 2 + 0.05, { r: 0.004, tint: [0.5, 0.36, 0.24] })
    const kinds = [[0, 1], [2, 3], [4, 1]][v]
    tiers.forEach((tier, i) => {
      const slats = 4
      for (let j = 0; j < slats; j++) k.blk('wood', [w - 2 * t, 0.02, run / slats - 0.01], 0, tier.y - 0.02, tier.z - run / 2 + (j + 0.5) * run / slats, { r: 0.003, tint: [0.62, 0.48, 0.32] })
      const crates = 2, cw = (w - 2 * t - 0.03) / crates
      for (let c = 0; c < crates; c++) {
        if (v === 2 && i === 1 && c === 0) { carton(k, cw * 0.8, 0.16, run * 0.7, [-w / 4, tier.y, tier.z], { yaw: 0.15 }); continue }
        produceCrate(k, cw - 0.01, run - 0.03, 0.14, [-(w - 2 * t) / 2 + 0.015 + (c + 0.5) * cw, tier.y, tier.z], kinds[(i + c) % 2] === 4 && i === 0 ? 1 : (i === 2 ? kinds[c % 2] : kinds[(i + c) % 2]), v === 2 ? 0.45 : 0.85)
        priceCard(k, [-(w - 2 * t) / 2 + 0.015 + (c + 0.5) * cw + cw * 0.32, tier.y + 0.012, tier.z + run / 2 - 0.035])
      }
    })

    for (const x of [-1, 1]) k.blk('wood', [0.04, h - 0.82, 0.04], x * (w / 2 - 0.08), 0.82, -d / 2 + 0.02, { r: 0.004, tint: [0.5, 0.36, 0.24] })
    k.blk('wood', [w - 0.12, 0.2, 0.02], 0, h - 0.24, -d / 2 + 0.05, { r: 0.004, tint: [0.25, 0.27, 0.24] })
    for (let i = 0; i < 5; i++) k.box('paint', [0.07 + k.rnd() * 0.04, 0.012, 0.0012], [-w * 0.3 + i * w * 0.13, h - 0.14 + k.jitter(0.03), -d / 2 + 0.0606], { r: 0, tint: [0.92, 0.92, 0.88] })
  },

  'butcher-rail': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.88, bd = d * 0.62, bz = d / 2 - bd / 2, bw = w * 0.62

    legFrame(k, 'wood', bw, bd, top - 0.2, { leg: 0.09, shelf: 0.2, tint: [0.55, 0.42, 0.3], x: -w / 2 + bw / 2 + 0.04, z: bz })
    const bx0 = -w / 2 + 0.04, nx = 8, nz = 5, cw = bw / nx, czz = bd / nz
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const u = (i + 0.5) / nx - 0.5, q = (j + 0.5) / nz - 0.5, dish = 0.012 * Math.max(0, 1 - (u * u + q * q) * 6)
      k.blk('wood', [cw - 0.0015, 0.2 - dish + k.jitter(0.0015), czz - 0.0015], bx0 + (i + 0.5) * cw, top - 0.2, bz - bd / 2 + (j + 0.5) * czz, { r: 0.0035, tint: [0.68 + k.jitter(0.06), 0.52 + k.jitter(0.05), 0.36], grain: 1 })
    }
    for (const z of [-1, 1]) k.blk('steel', [bw + 0.01, 0.03, 0.008], bx0 + bw / 2, top - 0.12, bz + z * (bd / 2 + 0.003), { r: 0.002, tint: DARK })
    k.frame({ at: [bx0 + bw * 0.62, top - 0.004, bz + 0.03], yaw: 0.4 }, () => {
      k.box('steel', [0.2, 0.09, 0.005], [0.03, 0.04, 0], { r: 0.002, roll: 0.1, tint: [0.7, 0.7, 0.72] })
      k.box('wood', [0.13, 0.03, 0.025], [-0.13, 0.075, 0], { r: 0.008, roll: 0.1, tint: [0.25, 0.18, 0.12] })
    })

    const railY = h - 0.1, postZ = -d / 2 + 0.03
    for (const x of [-1, 1]) {
      k.blk('steel', [0.06, railY + 0.03, 0.06], x * (w / 2 - 0.03), 0, postZ, { r: 0.006, tint: GALV })
      k.blk('steel', [0.16, 0.01, 0.16], x * (w / 2 - 0.03), 0, postZ + 0.05, { r: 0.002, tint: GALV })
    }
    k.cyl('steel', 0.022, w - 0.12, [0, railY, postZ], { axis: 'x', seg: 16, tint: GALV })
    const hooks = 5 + v
    for (let i = 0; i < hooks; i++) {
      const x = -w / 2 + 0.2 + i * (w - 0.4) / (hooks - 1)
      k.frame({ at: [x, railY, postZ] }, () => {
        k.tube('steel', [[0, 0.03, -0.012], [0, 0.026, 0.02], [0, -0.01, 0.026], [0, -0.03, 0.0], [0, -0.1, 0.0], [0, -0.16, 0.0], [0, -0.19, 0.03], [0, -0.16, 0.05]], 0.0045, { fillet: 0.015, seg: 6, tint: [0.75, 0.75, 0.76] })
      })
    }
    const sawX = -w / 2 + 0.2 + (w - 0.4) / (hooks - 1)
    k.frame({ at: [sawX, railY - 0.19, postZ + 0.03] }, () => {
      k.tube('steel', [[0, 0, 0], [0, -0.05, 0], [0, -0.05, 0.36], [0, -0.0, 0.36]], 0.006, { fillet: 0.02, seg: 6, tint: [0.55, 0.55, 0.56] })
      k.box('steel', [0.002, 0.03, 0.36], [0, -0.035, 0.18], { r: 0, tint: [0.8, 0.8, 0.82] })
    })
    if (v !== 0) {

      const ax = -w / 2 + 0.2 + 2.5 * (w - 0.4) / (hooks - 1), z0 = postZ + 0.05, hem = railY - 0.24, tint: V3 = v === 2 ? [0.62, 0.5, 0.42] : [0.9, 0.88, 0.84]
      k.tube('fabric', [[ax - 0.1, hem - 0.004, z0], [ax - 0.03, railY - 0.008, postZ + 0.0225], [ax + 0.03, railY - 0.008, postZ + 0.0225], [ax + 0.1, hem - 0.004, z0]], 0.004, { seg: 5, fillet: 0.02, tint })
      k.sheet('fabric', 0.42, 0.62, (x, z) => (Math.sin(x * 22) * 0.012 + Math.sin(z * 7 + x * 3) * 0.008) * Math.min(1, (z + 0.31) / 0.12), [ax, hem - 0.31, z0], { pitch: Math.PI / 2, thickness: 0.003, tint })
    }

    const sx = bx0 - 0.005
    k.blk('steel', [0.012, 0.04, 0.36], sx, 0.82, bz, { r: 0.004, tint: DARK })
    for (let i = 0; i < 3; i++) k.frame({ at: [sx - 0.0065, 0.8, bz - 0.12 + i * 0.12] }, () => { k.box('steel', [0.002, 0.2, 0.03], [0, -0.04, 0], { r: 0, tint: [0.82, 0.82, 0.84] }); k.box('wood', [0.016, 0.11, 0.022], [-0.007, 0.11, 0], { r: 0.005, tint: [0.2, 0.15, 0.1] }) })
  },

  'fitting-booth': (k, s) => {
    const { w, h, d } = k, v = s.variant, t = 0.04, floor = 0.05, ph = h - 0.06
    k.blk('wood', [w, floor, d], 0, 0, 0, { r: 0.006, tint: [0.35, 0.26, 0.2] })
    k.blk('fabric', [w - 2 * t - 0.01, 0.008, d - t - 0.04], 0, floor, t / 2 - 0.01, { r: 0.003, tint: [0.42, 0.18, 0.16] })
    for (const x of [-1, 1]) {
      k.blk('wood', [t, ph - floor, d], x * (w / 2 - t / 2), floor, 0, { r: 0.004, tint: LAMINATE })
      k.blk('steel', [t + 0.006, ph - floor, 0.02], x * (w / 2 - t / 2), floor, d / 2 - 0.01, { r: 0.004, tint: ALU })
      k.blk('steel', [t + 0.006, 0.02, d], x * (w / 2 - t / 2), ph, 0, { r: 0.004, tint: ALU })
    }
    k.blk('wood', [w - 2 * t, ph - floor, t], 0, floor, -d / 2 + t / 2, { r: 0.004, tint: LAMINATE })

    k.frameRect('steel', 0.5, 1.4, 0.03, 0.02, [0, floor + 0.2 + 0.7, -d / 2 + t + 0.01], { tone: 1 })
    if (v === 2) { for (const [x, y, ww, hh, r] of [[-0.11, 0.35, 0.21, 0.6, 0.04], [0.11, 0.2, 0.2, 0.9, -0.03], [-0.1, -0.35, 0.22, 0.6, 0.02]] as const) k.box('glass', [ww, hh, 0.005], [x, floor + 0.9 + y * 0.9, -d / 2 + t + 0.004], { roll: r, r: 0.001, tint: [0.8, 0.85, 0.88] }) }
    else k.box('glass', [0.44, 1.34, 0.005], [0, floor + 0.9, -d / 2 + t + 0.004], { r: 0.001, tint: [0.8, 0.85, 0.88] })

    const benchY = 0.45, bx = -w / 2 + t, bl = d - t - 0.16, bc = -d / 2 + t + 0.03 + bl / 2
    k.blk('wood', [0.32, 0.035, bl], bx + 0.16, benchY, bc, { r: 0.006, tint: OAK })
    for (const z of [-0.25, 0.25]) k.extrude('steel', [[0, 0], [0.26, 0], [0.26, 0.02], [0.02, 0.24], [0, 0.24]], 0.03, [bx, benchY - 0.24, bc + z * bl], { bevel: 0.002, tint: DARK })

    const hx = w / 2 - t
    for (const z of [-0.18, 0.12]) {
      k.cyl('steel', 0.012, 0.004, [hx - 0.002, 1.75, z], { axis: 'x', seg: 12, tint: ALU })
      k.tube('steel', [[hx - 0.004, 1.75, z], [hx - 0.05, 1.75, z], [hx - 0.06, 1.78, z]], 0.004, { fillet: 0.01, seg: 6, tint: ALU })
    }
    k.frame({ at: [hx - 0.05, 1.746, 0.12] }, () => {
      k.tube('wood', [[0, 0, -0.2], [0, 0.07, 0], [0, 0, 0.2], [0, 0, -0.2]], 0.006, { fillet: 0.02, seg: 6, tint: OAK })
      k.sheet('fabric', 0.42, 0.7, (x, z) => Math.sin(z * 18 + x * 4) * 0.008 + Math.abs(x) * 0.02, [0, -0.35, 0], { pitch: Math.PI / 2, yaw: Math.PI / 2, thickness: 0.004, nx: 20, nz: 24, tint: k.pick([[0.3, 0.4, 0.62], [0.65, 0.2, 0.18], [0.85, 0.83, 0.78]] as V3[]) })
    })

    const railY = ph - 0.04, railZ = d / 2 - 0.05, cw = w - 2 * t - 0.02, red: V3 = [0.42, 0.16, 0.14]
    k.cyl('steel', 0.012, cw + 0.02, [0, railY, railZ], { axis: 'x', seg: 12, tint: ALU })

    const ring = (x: number) => k.torus('steel', 0.018, 0.0025, [x, railY - 0.004, railZ], { axis: 'x', segR: 12, seg: 4, tint: ALU })
    const hem = railY - 0.022
    if (v === 2) {
      const drop = 0.9, cwid = cw * 0.45, x0 = -cw * 0.25, folds = 4
      k.sheet('fabric', cwid, drop, (x, z) => Math.sin((x + cwid / 2) / cwid * Math.PI * 2 * folds) * 0.02 + ((z + drop / 2) / drop) ** 2 * 0.08 * Math.sin(x * 8 + 1), [x0, hem - drop / 2, railZ], { pitch: Math.PI / 2, thickness: 0.004, nx: folds * 10, nz: 18, tint: red })
      for (let i = 0; i <= folds; i++) ring(x0 - cwid / 2 + i * cwid / folds)
      for (const x of [cw * 0.2, cw * 0.36]) ring(x)
      k.sheet('fabric', 0.7, 0.5, (x, z) => 0.012 + Math.sin(x * 12) * 0.01 + Math.cos(z * 10) * 0.008, [cw * 0.12, floor + 0.008, d / 2 - 0.34], { thickness: 0.004, nx: 20, nz: 14, tint: red })
    } else {
      const frac = v === 0 ? 0.85 : 0.4, cwid = cw * frac, x0 = -cw / 2 + cwid / 2, drop = hem - floor - 0.03
      const folds = Math.max(3, Math.round(cwid / (v === 0 ? 0.11 : 0.08))), amp = v === 0 ? 0.022 : 0.032
      k.sheet('fabric', cwid, drop, (x) => Math.sin((x + cwid / 2) / cwid * Math.PI * 2 * folds) * amp, [x0, floor + 0.03 + drop / 2, railZ], { pitch: Math.PI / 2, thickness: 0.004, nx: folds * 10, nz: 16, tint: red })
      for (let i = 0; i <= folds; i++) ring(x0 - cwid / 2 + i * cwid / folds)
    }
  },

  'shoe-display': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.62
    legFrame(k, 'steel', w, d, top - 0.03, { leg: 0.04, shelf: 0.12, tint: DARK })
    k.blk('wood', [w, 0.03, d], 0, top - 0.03, 0, { r: 0.006, tint: LAMINATE })

    const treads = riser(k, 'wood', w - 0.04, d - 0.06, top, 2, 0.22, [0, -0.01], [0.9, 0.88, 0.84])
    const pairs = 4 - (v === 0 ? 1 : 0), slot = (p: number) => -(w - 0.04) / 2 + (p + 0.5) * (w - 0.04) / pairs
    treads.forEach((tr, i) => {
      for (let p = 0; p < pairs; p++) {
        const x = slot(p)
        if (v !== 0 && i === treads.length - 1 && p === 0) continue
        k.label([x, tr.y - 0.006, tr.z + tr.run / 2 + 0.0148], 0.07, 0.009)
        if (v === 2 && (p + i) % 3 === 1) continue
        const boot = (p + i) % 4 === 3, len = boot ? 0.27 : 0.26, tint = k.pick([[0.85, 0.85, 0.82], [0.2, 0.2, 0.22], [0.55, 0.3, 0.18], [0.3, 0.42, 0.62], [0.75, 0.2, 0.18]] as V3[])
        for (const side of [-1, 1]) shoe(k, len, [x + side * 0.055, tr.y, tr.z - 0.005], { tint, boot, yaw: side * 0.08 })
      }
    })

    const shelfTop = 0.12 + 0.012 + 0.018
    for (let i = 0; i < 3 + v; i++) carton(k, 0.33, 0.12, 0.2, [-w / 2 + 0.22 + (i % 2) * 0.36, shelfTop + Math.floor(i / 2) * 0.12, 0], { tint: k.pick([[0.85, 0.82, 0.75], [0.25, 0.25, 0.28], [0.75, 0.3, 0.2]] as V3[]), label: false })
    k.frame({ at: [w * 0.3, shelfTop, 0.08] }, () => { k.box('steel', [0.12, 0.012, 0.3], [0, 0.006, 0], { r: 0.003, tint: DARK }); k.box('steel', [0.1, 0.004, 0.26], [0, 0.014, 0], { r: 0.001, tint: ALU }); k.box('steel', [0.012, 0.03, 0.08], [-0.05, 0.027, -0.1], { r: 0.003, tint: DARK }) })
    if (v !== 0) {
      const tr = treads[treads.length - 1]
      k.frame({ at: [slot(0), tr.y, tr.z] }, () => {
        k.blk('steel', [0.26, 0.02, 0.1], 0, 0, 0, { r: 0.004, tint: DARK })
        k.frame({ at: [0, 0.02, -0.03], pitch: -0.2 }, () => { k.frameRect('steel', 0.26, 0.34, 0.02, 0.02, [0, 0.17, 0]); k.box('glass', [0.23, 0.31, 0.004], [0, 0.17, 0.002], { r: 0.001, tint: [0.85, 0.88, 0.9] }) })
      })
    }
  },

  'display-platform': (k, s) => {
    const { w, h, d } = k, v = s.variant, step = h * 0.5, main = d * 0.75, mz = -d * 0.125

    k.blk('wood', [w, h - 0.012, main], 0, 0, mz, { r: 0.006, tint: [0.3, 0.3, 0.32] })
    k.blk('fabric', [w - 0.01, 0.012, main - 0.01], 0, h - 0.012, mz, { r: 0.003, tint: v === 1 ? [0.5, 0.16, 0.14] : [0.28, 0.3, 0.36] })
    k.blk('steel', [w, 0.03, 0.014], 0, h - 0.03, mz + main / 2 + 0.007, { r: 0.004, tint: ALU })
    k.blk('wood', [w * 0.5, step - 0.01, d * 0.25], 0, 0, d * 0.375, { r: 0.005, tint: [0.3, 0.3, 0.32] })
    k.blk('fabric', [w * 0.5 - 0.01, 0.01, d * 0.25 - 0.01], 0, step - 0.01, d * 0.375, { r: 0.003, tint: v === 1 ? [0.5, 0.16, 0.14] : [0.28, 0.3, 0.36] })
    k.blk('steel', [w * 0.5, 0.025, 0.012], 0, step - 0.025, d / 2 + 0.006, { r: 0.004, tint: ALU })

    k.cyl('steel', 0.16, 0.012, [-w * 0.25, h + 0.006, mz], { seg: 28, tint: ALU })
    k.cyl('steel', 0.012, 0.26, [-w * 0.25, h + 0.012 + 0.13, mz], { seg: 10, tint: ALU })
    if (v !== 2) k.cyl('steel', 0.03, 0.03, [-w * 0.25, h + 0.012 + 0.26 + 0.015 - 0.005, mz], { seg: 12, tint: ALU })
    for (const [i, x] of [w * 0.1, w * 0.33].entries()) {
      const ch = i ? 0.1 : 0.18
      k.blk('wood', [0.32, ch, 0.32], x, h, mz + 0.05, { r: 0.006, tint: [0.92, 0.9, 0.86] })
      if (i === 0) folded(k, 0.26, 0.08, 0.22, [x, h + ch, mz + 0.05], { tint: [0.3, 0.32, 0.4] })
      else for (const sd of [-1, 1]) shoe(k, 0.27, [x + sd * 0.055, h + ch, mz + 0.05], { boot: true, tint: [0.4, 0.26, 0.16] })
      priceCard(k, [x + 0.11, h + ch, mz + 0.05 + 0.13])
    }
    if (v === 2) carton(k, 0.4, 0.2, 0.3, [w * 0.05, h, mz - main / 2 + 0.2], { yaw: 0.6 })
  },

  'security-counter': (k, s) => {
    const { w, h, d } = k, v = s.variant, base = 0.6, top = 0.98, t = 0.02

    k.blk('wood', [w, base, d], 0, 0, 0, { r: 0.006, tint: WALNUT })
    const panels = Math.max(2, Math.round(w / 0.45)), pw = (w - 0.08) / panels
    for (let i = 0; i < panels; i++) { k.frameRect('wood', pw - 0.03, base - 0.16, 0.03, 0.014, [-w / 2 + 0.04 + (i + 0.5) * pw, base / 2 + 0.03, d / 2 + 0.007], { tone: 0.95 }); k.box('wood', [pw - 0.08, base - 0.21, 0.008], [-w / 2 + 0.04 + (i + 0.5) * pw, base / 2 + 0.03, d / 2 + 0.004], { tint: [0.42, 0.28, 0.18] }) }
    k.blk('rubber', [w - 0.02, 0.06, 0.01], 0, 0, d / 2 + 0.005, { r: 0.002 })
    const till = (w - 0.12) / 3
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + 0.06 + (i + 0.5) * till
      k.box('rubber', [till - 0.03, 0.13, 0.002], [x, base - 0.11, -d / 2 - 0.001], { r: 0, tone: 0.2 })
      drawer(k, 'wood', till - 0.012, 0.15, [x, base - 0.11, -d / 2], { yaw: Math.PI, handle: 'bar', tint: WALNUT })
    }

    k.blk('wood', [w, 0.02, d], 0, base, 0, { r: 0.004, tint: WALNUT })
    const cy0 = base + 0.02, ch = top - cy0 - 0.02
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('steel', [0.02, ch, 0.02], x * (w / 2 - 0.01), cy0, z * (d / 2 - 0.01), { r: 0.003, tint: ALU })
    k.box('glass', [w - 0.04, ch, 0.006], [0, cy0 + ch / 2, d / 2 - 0.01], { r: 0.001 })
    for (const x of [-1, 1]) k.box('glass', [0.006, ch, d - 0.04], [x * (w / 2 - 0.01), cy0 + ch / 2, 0], { r: 0.001 })
    k.blk('steel', [w, 0.02, d], 0, top - 0.02, 0, { r: 0.004, tint: ALU })
    k.box('glass', [w - 0.06, 0.008, d - 0.06], [0, top + 0.004, 0], { r: 0.002 })
    k.blk('fabric', [w - 0.06, 0.012, d - 0.08], 0, cy0, 0, { r: 0.003, tint: [0.15, 0.12, 0.25] })
    const items = 6 + v * 2
    for (let i = 0; i < items; i++) {
      const x = -w / 2 + 0.12 + (i % (items / 2)) * (w - 0.24) / (items / 2 - 1), z = i < items / 2 ? 0.12 : -0.08, y = cy0 + 0.012
      if (i % 3 === 0) { k.cyl('steel', 0.018, 0.008, [x, y + 0.004, z], { seg: 16, tint: [0.85, 0.75, 0.4] }); k.box('leather', [0.02, 0.003, 0.12], [x, y + 0.0015, z], { r: 0.001, tint: [0.25, 0.15, 0.1] }) }
      else if (i % 3 === 1) k.torus('steel', 0.012, 0.0025, [x, y + 0.0025, z], { segR: 14, seg: 5, tint: [0.88, 0.78, 0.35] })
      else { k.blk('steel', [0.09, 0.012, 0.03], x, y, z, { r: 0.004, yaw: 0.4, tint: [0.3, 0.3, 0.32] }); k.blk('steel', [0.08, 0.004, 0.02], x + 0.08 * Math.cos(0.4) * 0.9, y, z - 0.08 * Math.sin(0.4) * 0.9, { r: 0.001, yaw: 0.4, tint: [0.85, 0.85, 0.87] }) }
    }

    const gz = -d / 2 + 0.03, gy = top
    for (const x of [-1, 1]) k.blk('steel', [0.05, h - gy, 0.05], x * (w / 2 - 0.025), gy, gz, { r: 0.004, tint: DARK })
    k.blk('steel', [w - 0.1, 0.05, 0.05], 0, h - 0.05, gz, { r: 0.004, tint: DARK })
    k.blk('steel', [w - 0.1, 0.04, 0.04], 0, gy + 0.22, gz, { r: 0.003, tint: DARK })
    const bars = Math.round((w - 0.1) / 0.09)
    for (let i = 0; i < bars; i++) {
      const x = -w / 2 + 0.05 + (i + 0.5) * (w - 0.1) / bars
      if (Math.abs(x) < 0.2) continue
      k.cyl('steel', 0.009, h - 0.05 - gy - 0.26, [x, gy + 0.26 + (h - 0.05 - gy - 0.26) / 2, gz], { seg: 8, tint: DARK })
    }

    const run = w / 2 - 0.05 - 0.2
    for (const y of [gy + 0.6, gy + 0.9]) for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('steel', [run, 0.03, 0.006], x * (0.2 + run / 2), y, gz + z * 0.0115, { r: 0.002, tint: DARK })

    k.frameRect('steel', 0.4, h - 0.05 - gy - 0.26, 0.03, 0.03, [0, gy + 0.26 + (h - 0.05 - gy - 0.26) / 2, gz])
    k.bars('steel', 0.34, h - 0.05 - gy - 0.32, 4, 0.008, [0, gy + 0.26 + (h - 0.05 - gy - 0.26) / 2, gz])
    k.frame({ at: [0.17, gy + 0.6, gz + 0.015] }, () => { k.box('steel', [0.05, 0.045, 0.02], [0, -0.03, 0.01], { r: 0.006, tint: [0.75, 0.62, 0.3] }); k.torus('steel', 0.016, 0.004, [0, -0.009, 0.01], { axis: 'z', segR: 12, seg: 5, arc: Math.PI, roll: Math.PI / 2 }) })

    k.blk('steel', [0.36, 0.012, 0.22], 0, top + 0.008, gz + 0.08, { r: 0.003, tint: ALU })
    k.frame({ at: [w * 0.3, top + 0.008, 0.1] }, () => { k.cyl('steel', 0.04, 0.012, [0, 0.006, 0], { seg: 18, tint: DARK }); k.lathe('steel', [[0, 0], [0.038, 0], [0.036, 0.012], [0.026, 0.035], [0.008, 0.045], [0, 0.046]], [0, 0.012, 0], { seg: 20, tint: [0.85, 0.75, 0.4] }); k.cyl('steel', 0.004, 0.012, [0, 0.064, 0], { seg: 8 }) })
    book(k, 0.04, 0.3, 0.22, [-w * 0.3, top + 0.008, 0.08], { yaw: Math.PI / 2, roll: Math.PI / 2 * 0, tint: [0.25, 0.2, 0.15] })
  },

  'fishing-rack': (k, s) => {
    const { w, h, d } = k, v = s.variant, base = 0.12, post = 0.06, backZ = -d / 2 + post / 2
    k.blk('wood', [w, base, d], 0, 0, 0, { r: 0.008, tint: [0.42, 0.3, 0.2] })
    for (const x of [-1, 1]) k.blk('wood', [post, h - base, post], x * (w / 2 - post / 2), base, backZ, { r: 0.006, tint: [0.42, 0.3, 0.2] })
    k.blk('wood', [w, 0.08, post], 0, h - 0.08, backZ, { r: 0.006, tint: [0.42, 0.3, 0.2] })

    const n = 6 + v, span = w - 2 * post - 0.12, rz = backZ + 0.11, combY = h - 0.32
    const xs = Array.from({ length: n }, (_, i) => -span / 2 + (i + 0.5) * span / n)
    k.blk('wood', [w - 2 * post, 0.035, 0.04], 0, combY, backZ + post / 2 + 0.02 - 0.03, { r: 0.004, tint: [0.42, 0.3, 0.2] })
    const toothZ0 = backZ + post / 2 + 0.01, toothZ1 = rz + 0.03
    for (const x of [-span / 2 - 0.03, ...xs.slice(1).map((x, i) => (x + xs[i]) / 2), span / 2 + 0.03]) k.blk('wood', [0.03, 0.035, toothZ1 - toothZ0], x, combY, (toothZ0 + toothZ1) / 2, { r: 0.005, tint: [0.42, 0.3, 0.2] })
    xs.forEach((x, i) => {
      k.lathe('rubber', [[0, 0], [0.024, 0], [0.024, 0.03], [0.018, 0.03], [0.018, 0.008], [0, 0.008]], [x, base, rz], { seg: 14 })
      if (v === 2 && i % 3 === 1) return
      const top = h - 0.12 - (i % 3) * 0.08, grip = 0.32
      k.cyl('rubber', 0.012, 0.03, [x, base + 0.008 + 0.015, rz], { seg: 12 })
      k.cyl('wood', 0.0135, grip, [x, base + 0.038 + grip / 2, rz], { seg: 14, tint: [0.78, 0.62, 0.42] })
      k.cyl('steel', 0.0105, 0.07, [x, base + 0.038 + grip + 0.035, rz], { seg: 12, tint: [0.25, 0.25, 0.28] })
      const r0 = base + 0.038 + grip + 0.07
      k.tube('steel', [[x, r0 - 0.002, rz], [x, top, rz]], 0.0075, { seg: 8, taper: 0.75, tint: k.pick([[0.15, 0.2, 0.3], [0.4, 0.12, 0.1], [0.2, 0.22, 0.2]] as V3[]) })
      for (let g = 0; g < 5; g++) {
        const gy = r0 + 0.12 + g * (top - r0 - 0.2) / 4, rr = 0.007 * (1 - 0.75 * (gy - r0) / (top - r0)) + 0.0015
        k.box('steel', [0.003, 0.012, 0.012], [x, gy, rz + rr + 0.004], { r: 0.0008, tint: [0.7, 0.7, 0.72] })
        k.torus('steel', 0.006 + 0.004 * (1 - g / 4), 0.0011, [x, gy, rz + rr + 0.012 + 0.004 * (1 - g / 4)], { segR: 10, seg: 4, tint: [0.7, 0.7, 0.72] })
      }

      k.frame({ at: [x, base + 0.038 + grip + 0.035, rz + 0.0105] }, () => {
        k.box('steel', [0.008, 0.012, 0.05], [0, 0, 0.025], { r: 0.002, tint: [0.3, 0.3, 0.32] })
        k.lathe('steel', [[0, -0.022], [0.026, -0.022], [0.028, -0.01], [0.02, 0.0], [0.02, 0.02], [0, 0.02]], [0, 0, 0.065], { seg: 16, tint: [0.3, 0.3, 0.32] })
        k.cyl('steel', 0.0155, 0.024, [0, 0, 0.065], { seg: 16, tint: [0.75, 0.75, 0.77] })
        k.tube('steel', [[0.02, 0.0, 0.05], [0.045, 0, 0.05], [0.045, 0, 0.075]], 0.002, { seg: 5, tint: [0.3, 0.3, 0.32] })
      })
    })

    pail(k, 'steel', 0.11, 0.24, [w / 2 - 0.17, base, 0.11], { tint: GALV, bail: 0.3 })
    for (let i = 0; i < 2 + (v === 2 ? 0 : 1); i++) {
      const bx = -w / 2 + 0.2 + i * 0.36, bz = d / 2 - 0.14
      k.blk('paint', [0.3, 0.12, 0.17], bx, base, bz, { r: 0.012, tint: k.pick([[0.25, 0.42, 0.3], [0.7, 0.25, 0.15], [0.3, 0.35, 0.5]] as V3[]) })
      k.handle([bx, base + 0.12, bz], 0.12, { pitch: -Math.PI / 2, m: 'rubber', standoff: 0.025, r: 0.007 })
      for (const x of [-1, 1]) k.box('steel', [0.03, 0.03, 0.01], [bx + x * 0.1, base + 0.1, bz + 0.09], { r: 0.003, tint: ALU })
    }
  },

  'sports-rack': (k, s) => {
    const { w, h, d } = k, v = s.variant, cw = w * 0.66, cx = -w / 2 + cw / 2, tube = 0.016

    const mount = 0.0784, y0 = mount, y1 = 0.92, cd = d - 0.04
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      k.caster([cx + x * (cw / 2 - 0.05), 0, z * (cd / 2 - 0.05)], 0.034)
      k.tube('steel', [[cx + x * (cw / 2 - 0.05), y0, z * (cd / 2 - 0.05)], [cx + x * (cw / 2 - 0.05), y1, z * (cd / 2 - 0.05)]], tube, { seg: 10, tint: DARK })
    }
    for (const y of [y0 + 0.02, y1]) k.tube('steel', roundRect(cw - 0.1, cd - 0.1, 0.04, y, 3).map(([x, yy, z]) => [x + cx, yy, z] as V3), tube, { closed: true, seg: 8, tint: DARK })
    k.blk('steel', [cw - 0.13, 0.008, cd - 0.13], cx, y0 + 0.02 + tube, 0, { r: 0.002, tint: [0.35, 0.35, 0.37] })
    for (const z of [-1, 1]) k.bars('steel', cw - 0.14, y1 - y0 - 0.06, Math.round(cw / 0.05), 0.003, [cx, (y0 + y1) / 2 + 0.01, z * (cd / 2 - 0.05)])
    for (const x of [-1, 1]) k.bars('steel', cd - 0.14, y1 - y0 - 0.06, Math.round(cd / 0.05), 0.003, [cx + x * (cw / 2 - 0.05), (y0 + y1) / 2 + 0.01, 0], { yaw: Math.PI / 2 })
    for (const y of [0.4, 0.65]) k.tube('steel', roundRect(cw - 0.1, cd - 0.1, 0.04, y, 3).map(([x, yy, z]) => [x + cx, yy, z] as V3), 0.0035, { closed: true, seg: 5, tint: DARK })
    const floorY = y0 + 0.02 + tube + 0.008, r = 0.115, kinds = ['basket', 'soccer', 'volley'] as const
    const nx = Math.floor((cw - 0.14) / (2 * r)), nz = Math.floor((cd - 0.14) / (2 * r))
    for (let layer = 0; layer < 2 + (v === 2 ? -1 : 0); layer++) for (let i = 0; i < nx - layer; i++) for (let j = 0; j < nz - layer; j++) {
      const x = cx - (nx - 1) * r + (i + layer * 0.5) * 2 * r, z = -(nz - 1) * r + (j + layer * 0.5) * 2 * r
      ball(k, r * (layer ? 0.95 : 1), [x, floorY + layer * r * 1.35, z], kinds[(i + j + layer + v) % 3])
    }

    const bx = w / 2 - (w - cw) / 2 + 0.01, bw = w - cw - 0.04
    k.lathe('paint', [[0, 0], [bw / 2, 0], [bw / 2, 0.45], [bw / 2 - 0.006, 0.45], [bw / 2 - 0.006, 0.01], [0, 0.01]], [bx, 0, 0], { seg: 24, tint: [0.2, 0.3, 0.55] })
    for (let i = 0; i < 4 + v; i++) {
      const a = i / (4 + v) * Math.PI * 2, rr = bw * 0.25, lean = 0.12, x = bx + Math.cos(a) * rr, z = Math.sin(a) * rr
      const top: V3 = [x + Math.cos(a) * lean * 0.8, h - 0.06 - (i % 2) * 0.1, z + Math.sin(a) * lean * 0.8]
      if (i % 3 === 2) { k.tube('wood', [[x, 0.01, z], top], 0.012, { seg: 8, tint: [0.75, 0.6, 0.4] }); k.box('rubber', [0.06, 0.12, 0.012], [x, 0.07, z], { yaw: -a, r: 0.004, tint: [0.15, 0.15, 0.15] }) }
      else k.lathe('wood', [[0, 0], [0.033, 0], [0.034, 0.05], [0.03, 0.38], [0.014, 0.62], [0.012, 0.8], [0.018, 0.82], [0.016, 0.84], [0, 0.84]], [x, 0.01, z], { seg: 12, pitch: Math.cos(a) * 0 + (z > 0 ? 1 : -1) * 0.1, roll: -Math.cos(a) * 0.1, tint: i % 2 ? [0.8, 0.65, 0.42] : [0.25, 0.25, 0.27] })
    }
  },

  'toy-display': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.55
    legFrame(k, 'wood', w, d, top - 0.03, { leg: 0.06, shelf: 0.12, tint: [0.85, 0.75, 0.55] })
    k.blk('wood', [w + 0.02, 0.03, d + 0.02], 0, top - 0.03, 0, { r: 0.012, tint: [0.92, 0.88, 0.8] })
    const treads = riser(k, 'wood', w - 0.04, d - 0.06, top, 3, 0.13, [0, -0.01], [0.55, 0.75, 0.85])
    treads.forEach((tr, i) => {
      let x = -(w - 0.04) / 2 + 0.08
      let j = 0
      while (x < (w - 0.04) / 2 - 0.1) {
        const kind = (i * 3 + j + v) % 5
        if (v === 2 && (j + i) % 4 === 3) { x += 0.14; j++; continue }
        if (kind === 0) { teddy(k, 0.85, [x + 0.04, tr.y, tr.z], { tint: k.pick([[0.62, 0.45, 0.3], [0.85, 0.82, 0.75], [0.5, 0.35, 0.5]] as V3[]) }); x += 0.17 }
        else if (kind === 1) { toyTruck(k, 0.22, [x + 0.1, tr.y, tr.z], { yaw: 0.2 }); x += 0.25 }
        else if (kind === 2) { for (let b = 0; b < 3; b++) toyBlock(k, 0.05, [x + 0.03 + b * 0.055, tr.y, tr.z + k.jitter(0.02)], { yaw: k.jitter(0.3) }); toyBlock(k, 0.05, [x + 0.055, tr.y + 0.05, tr.z], { yaw: 0.2 }); x += 0.19 }
        else if (kind === 3) { ball(k, 0.06, [x + 0.06, tr.y, tr.z], 'volley'); x += 0.14 }
        else { packet(k, 0.16, 0.22, 0.07, [x + 0.08, tr.y, tr.z], { tint: k.pick(PACK_TINTS) }); x += 0.19 }
        j++
      }
    })

    const shelfY = 0.12 + 0.06 * 0.3 + 0.018
    for (let i = 0; i < 2; i++) {
      const bx = -w / 4 + i * w / 2
      k.lathe('paint', [[0, 0], [0.17, 0], [0.19, 0.2], [0.184, 0.2], [0.164, 0.008], [0, 0.008]], [bx, shelfY, 0], { seg: 20, tint: i ? [0.85, 0.3, 0.25] : [0.3, 0.5, 0.8] })
      for (let j = 0; j < 3; j++) teddy(k, 0.6, [bx + (j - 1) * 0.07, shelfY + 0.008 + j * 0.02, (j - 1) * 0.03], { yaw: j * 1.2, tint: k.pick([[0.85, 0.82, 0.75], [0.62, 0.45, 0.3], [0.9, 0.7, 0.75]] as V3[]) })
    }
  },

  piano: (k, s) => {
    const { w, h, d } = k, v = s.variant, cheek = 0.07, caseD = d * 0.42, caseZ = -d / 2 + caseD / 2, kbY = 0.7, kbW = w - 2 * cheek
    const finish: V3 = v === 1 ? [0.16, 0.12, 0.1] : v === 2 ? [0.42, 0.28, 0.18] : [0.28, 0.18, 0.12]

    k.blk('wood', [w, 0.07, caseD], 0, 0, caseZ, { r: 0.004, tint: finish })
    k.blk('wood', [w, h - 0.07 - 0.04, caseD], 0, 0.07, caseZ, { r: 0.006, tint: finish })
    k.blk('wood', [w + 0.02, 0.04, caseD + 0.03], 0, h - 0.04, caseZ + 0.005, { r: 0.012, tint: finish })
    if (v === 2) k.frame({ at: [0, h, caseZ - caseD / 2 + 0.02], pitch: -0.5 }, () => k.blk('wood', [w - 0.04, 0.02, caseD * 0.6], 0, 0, caseD * 0.3, { r: 0.006, tint: finish }))
    k.frameRect('wood', kbW - 0.06, h - kbY - 0.2, 0.05, 0.02, [0, kbY + 0.12 + (h - kbY - 0.2) / 2, caseZ + caseD / 2 + 0.01], { tone: 1.05 })
    for (const x of [-1, 1]) {
      k.extrude('wood', [[-d / 2 + caseD, 0], [d / 2, 0], [d / 2, 0.06], [d / 2 - 0.05, 0.08], [d / 2 - 0.08, kbY - 0.05], [d / 2 - 0.02, kbY + 0.02], [d / 2 - 0.04, kbY + 0.08], [-d / 2 + caseD, kbY + 0.12]].map(([z, y]) => [-z, y] as V2), cheek, [x * (w / 2 - cheek / 2), 0, 0], { axis: 'x', bevel: 0.008, tint: finish })
      k.turnedLeg('wood', x * (w / 2 - cheek / 2), 0.08, d / 2 - 0.07, kbY - 0.13, 0.035, {})
    }

    const kz = caseZ + caseD / 2, keyD = 0.15
    k.blk('wood', [kbW, 0.05, d / 2 - kz - 0.01], 0, kbY - 0.05, (kz + d / 2 - 0.01) / 2, { r: 0.004, tint: finish })
    k.blk('wood', [kbW, 0.04, 0.02], 0, kbY - 0.01, d / 2 - 0.02, { r: 0.004, tint: finish })
    const white = 52, kw = kbW / white
    for (let i = 0; i < white; i++) {
      if (v === 2 && (i === 17 || i === 30 || i === 31)) continue
      k.blk('tile', [kw - 0.0012, 0.022, keyD], -kbW / 2 + (i + 0.5) * kw, kbY, kz + keyD / 2 + 0.004, { r: 0.0015, tint: v === 2 ? [0.88, 0.84, 0.7] : [0.96, 0.95, 0.9] })
      const n = i % 7
      if (n !== 2 && n !== 6 && i < white - 1) k.blk('rubber', [kw * 0.55, 0.012, keyD * 0.6], -kbW / 2 + (i + 1) * kw, kbY + 0.022, kz + keyD * 0.3 + 0.004, { r: 0.002, tint: [0.08, 0.08, 0.08] })
    }
    if (v !== 2) {
      k.frame({ at: [0, kbY + 0.035, kz - 0.01], pitch: -0.2 }, () => k.blk('wood', [kbW - 0.02, 0.012, 0.18], 0, 0, -0.08, { r: 0.004, tint: finish }))
      k.frame({ at: [0, kbY + 0.24, kz + 0.01], pitch: -0.18 }, () => { k.blk('wood', [kbW * 0.6, 0.18, 0.016], 0, 0, 0.02, { r: 0.004, tint: finish }); k.blk('wood', [kbW * 0.6, 0.02, 0.04], 0, -0.005, 0.04, { r: 0.004, tint: finish }); book(k, 0.006, 0.22, 0.3, [0, 0.015, 0.036], { yaw: Math.PI / 2, roll: 0.0, tint: [0.92, 0.9, 0.82] }) })
    }

    k.blk('wood', [0.4, 0.06, 0.05], 0, 0, caseZ + caseD / 2 + 0.025, { r: 0.004, tint: finish })
    for (const x of [-0.08, 0, 0.08]) k.frame({ at: [x, 0.045, caseZ + caseD / 2 + 0.05] }, () => k.extrude('steel', [[0, -0.008], [0.11, -0.012], [0.12, 0], [0.11, 0.012], [0, 0.008]], 0.018, [0, 0, 0], { yaw: -Math.PI / 2, bevel: 0.003, tint: [0.85, 0.7, 0.35] }))
  },

  'studio-camera': (k, s) => {
    const { w, h, d } = k, v = s.variant, colTop = h * 0.6

    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + Math.PI / 2, rr = Math.min(w, d) / 2 - 0.06

      const mount = k.caster([Math.cos(a) * rr, 0, Math.sin(a) * rr], 0.035)
      k.tube('steel', [[0, 0.13, 0], [Math.cos(a) * rr, mount + 0.021, Math.sin(a) * rr]], 0.022, { seg: 10, tint: DARK })
    }
    k.cyl('steel', 0.075, 0.08, [0, 0.12, 0], { seg: 20, tint: DARK })
    k.cyl('steel', 0.055, 0.4, [0, 0.16 + 0.2, 0], { seg: 20, tint: [0.6, 0.6, 0.62] })
    k.cyl('steel', 0.042, colTop - 0.56 - 0.06, [0, 0.56 + (colTop - 0.56 - 0.06) / 2, 0], { seg: 18, tint: [0.75, 0.75, 0.77] })
    k.torus('steel', 0.22, 0.012, [0, 0.62, 0], { segR: 36, seg: 8, tint: DARK })
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.tube('steel', [[Math.cos(a) * 0.035, 0.62, Math.sin(a) * 0.035], [Math.cos(a) * 0.21, 0.62, Math.sin(a) * 0.21]], 0.008, { seg: 6, tint: DARK }) }

    k.cyl('steel', 0.09, 0.06, [0, colTop - 0.03, 0], { seg: 20, tint: DARK })

    const by = colTop, bl = d * 0.5, bz = -0.11
    k.blk('steel', [0.18, 0.05, 0.22], 0, by, 0, { r: 0.008, tint: [0.25, 0.25, 0.27] })
    k.blk('steel', [w * 0.42, h * 0.16, bl], 0, by + 0.05, bz, { r: 0.02, tint: [0.32, 0.33, 0.35] })
    k.vent([w * 0.21 + 0.001, by + 0.05 + h * 0.08, bz - bl * 0.1], bl * 0.4, h * 0.08, { yaw: Math.PI / 2 })
    const ly = by + 0.05 + h * 0.08, lz = bz + bl / 2
    k.lathe('steel', [[0, 0], [0.07, 0], [0.072, 0.03], [0.065, 0.06], [0.065, 0.16], [0.075, 0.18], [0.075, 0.24], [0, 0.24]], [0, ly, lz], { axis: 'z', seg: 24, tint: DARK })
    for (const y of [0.07, 0.12]) k.torus('rubber', 0.067, 0.004, [0, ly, lz + y], { axis: 'z', segR: 24, seg: 4 })
    k.lathe('rubber', [[0.074, 0], [0.1, 0.07], [0.096, 0.07], [0.07, 0.004], [0.074, 0]], [0, ly, lz + 0.24], { axis: 'z', seg: 24 })
    k.box('glass', [0.11, 0.11, 0.004], [0, ly, lz + 0.241], { r: 0.05 })
    k.frame({ at: [0, by + 0.05 + h * 0.16, bz - bl * 0.1] }, () => {
      k.blk('steel', [0.16, 0.12, 0.2], 0, 0, 0, { r: 0.012, tint: [0.25, 0.25, 0.27] })
      k.screen([0, 0.06, -0.1], 0.13, 0.09, { yaw: Math.PI, bezel: 0.008 })
    })
    for (const x of [-1, 1]) k.tube('steel', [[x * 0.08, by + 0.025, -0.08], [x * 0.18, by + 0.0, -0.3], [x * 0.24, by - 0.06, -d / 2 + 0.02]], 0.014, { seg: 10, fillet: 0.04, tint: DARK })
    for (const x of [-1, 1]) k.cyl('rubber', 0.019, 0.12, [x * 0.235, by - 0.055, -d / 2 + 0.06], { axis: 'z', seg: 12, pitch: -0.3 })

    k.tube('rubber', [[-w * 0.21, by + 0.1, bz - bl * 0.3], [-w * 0.26, by - 0.1, bz - bl * 0.32], [-0.15, 0.4, -0.2], [-0.12, 0.14, -0.15], [-0.1, 0.1, -0.12]], 0.009, { fillet: 0.1, seg: 8 })
    if (v === 2) k.box('glass', [0.06, 0.003, 0.04], [0.15, 0.0015, 0.25], { yaw: 0.6, r: 0 })
  },

  pinball: (k, s) => {
    const { w, h, d } = k, v = s.variant, legH = 0.62, cabD = d * 0.82, cabZ = d / 2 - cabD / 2 - 0.06, front = 0.24, back = 0.36
    const art: V3 = [[0.75, 0.2, 0.15], [0.2, 0.35, 0.65], [0.15, 0.5, 0.3]][v] as V3

    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const lz = cabZ + z * (cabD / 2 - 0.05)
      k.cyl('steel', 0.022, 0.03, [x * (w / 2 - 0.05), 0.015, lz], { seg: 12, tint: DARK })
      k.blk('steel', [0.05, legH - 0.03, 0.05], x * (w / 2 - 0.05), 0.03, lz, { r: 0.006, tint: ALU })
      k.blk('steel', [0.008, 0.1, 0.08], x * (w / 2 + 0.004), legH - 0.02, lz, { r: 0.002, tint: ALU })
      for (const y of [-0.025, 0.025]) k.bolt([x * (w / 2 + 0.008), legH + 0.03 + y, lz], { yaw: x * Math.PI / 2, r: 0.005 })
    }

    const slope: V2[] = [[cabD / 2, 0], [-cabD / 2, 0], [-cabD / 2, back], [cabD / 2, front]]
    for (const x of [-1, 1]) k.extrude('wood', slope.map(([z, y]) => [-z, y] as V2), 0.02, [x * (w / 2 - 0.01), legH, cabZ], { axis: 'x', bevel: 0.004, tint: art })
    k.blk('wood', [w - 0.04, 0.02, cabD], 0, legH, cabZ, { r: 0.004, tint: art })
    k.blk('wood', [w - 0.04, front - 0.02, 0.02], 0, legH + 0.02, cabZ + cabD / 2 - 0.01, { r: 0.004, tint: art })
    k.blk('wood', [w - 0.04, back - 0.02, 0.02], 0, legH + 0.02, cabZ - cabD / 2 + 0.01, { r: 0.004, tint: art })
    const tilt = Math.atan2(back - front, cabD), pfY = legH + (front + back) / 2 - 0.04
    k.frame({ at: [0, pfY, cabZ], pitch: tilt }, () => {
      k.box('wood', [w - 0.04, 0.012, cabD - 0.04], [0, 0, 0], { r: 0.002, tint: [0.85, 0.8, 0.7] })
      for (let i = 0; i < 3; i++) k.cyl('paint', 0.03, 0.04, [-0.12 + i * 0.12, 0.026, -cabD * 0.2 + (i % 2) * 0.06], { seg: 16, tint: [0.9, 0.85, 0.2] })
      for (const x of [-1, 1]) k.box('paint', [0.07, 0.016, 0.018], [x * 0.06, 0.014, cabD / 2 - 0.16], { yaw: x * 0.4, r: 0.006, tint: [0.92, 0.92, 0.9] })
      k.sphere('steel', 0.0135, [0.2, 0.0195, cabD / 2 - 0.25], { rows: 6, seg: 10 })
      k.box('glass', [w - 0.05, 0.005, cabD - 0.05], [0, 0.034 + 0.0025, 0], { r: 0.001 })
    })
    k.blk('steel', [w, 0.03, 0.06], 0, legH + front, cabZ + cabD / 2 - 0.03, { r: 0.008, tint: ALU })
    for (const x of [-1, 1]) k.cyl('paint', 0.014, 0.012, [x * (w / 2 + 0.006), legH + front - 0.06, cabZ + cabD / 2 - 0.12], { axis: 'x', seg: 12, tint: [0.9, 0.9, 0.88] })
    k.cyl('steel', 0.006, 0.06, [w * 0.35, legH + front - 0.06, cabZ + cabD / 2 + 0.03], { axis: 'z', seg: 8 })
    k.cyl('paint', 0.018, 0.035, [w * 0.35, legH + front - 0.06, cabZ + cabD / 2 + 0.0725], { axis: 'z', seg: 12, tint: [0.85, 0.15, 0.12] })
    k.frame({ at: [0, legH + 0.04, cabZ + cabD / 2] }, () => {
      k.box('steel', [0.3, 0.16, 0.008], [0, 0.08, 0.004], { r: 0.004, tint: [0.25, 0.25, 0.27] })
      for (const x of [-0.06, 0.06]) { k.box('steel', [0.035, 0.05, 0.012], [x, 0.11, 0.014], { r: 0.004, tint: ALU }); k.box('rubber', [0.004, 0.025, 0.002], [x, 0.11, 0.0205], { r: 0 }) }
    })

    const bbZ = cabZ - cabD / 2 + 0.11, bbY = legH + back
    k.blk('wood', [w, h - bbY, 0.2], 0, bbY, bbZ, { r: 0.008, tint: art })
    k.frameRect('steel', w - 0.04, (h - bbY) * 0.62, 0.025, 0.012, [0, bbY + (h - bbY) * 0.62, bbZ + 0.1 + 0.006])
    k.box('paint', [w - 0.09, (h - bbY) * 0.62 - 0.05, 0.004], [0, bbY + (h - bbY) * 0.62, bbZ + 0.102], { r: 0, tint: lighten(art) })
    if (v !== 2) k.box('glass', [w - 0.09, (h - bbY) * 0.62 - 0.05, 0.004], [0, bbY + (h - bbY) * 0.62, bbZ + 0.1 + 0.009], { r: 0.001 })
    k.box('steel', [w * 0.6, 0.12, 0.006], [0, bbY + 0.1, bbZ + 0.103], { r: 0.003, tint: DARK })
    for (let i = 0; i < 4; i++) k.box('steel', [w * 0.56, 0.006, 0.004], [0, bbY + 0.06 + i * 0.025, bbZ + 0.1075], { r: 0, tint: [0.4, 0.4, 0.42] })
  },

  'laundry-drum': (k, s) => {
    const { w, h, d } = k, v = s.variant, plinth = 0.12, body = h - plinth - 0.02, cz = 0

    k.blk('steel', [w, plinth, d], 0, 0, 0, { r: 0.008, tint: [0.35, 0.35, 0.37] })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.bolt([x * (w / 2 - 0.05), plinth, z * (d / 2 - 0.05)], { pitch: -Math.PI / 2, r: 0.008 })
    hollow(k, 'steel', [w - 0.02, body - 0.18, d - 0.06], [0, plinth, cz - 0.01], 0.02, { r: 0.01, tint: GALV })
    k.extrude('steel', ([[-(d - 0.04) / 2, 0], [(d - 0.04) / 2, 0], [(d - 0.04) / 2 - 0.12, 0.18], [-(d - 0.04) / 2, 0.2]] as V2[]).map(([z, y]) => [-z, y] as V2), w - 0.02, [0, plinth + body - 0.18, cz], { axis: 'x', bevel: 0.008, tint: GALV })
    k.frame({ at: [0, plinth + body - 0.09, (d - 0.04) / 2 - 0.06], pitch: -Math.atan2(0.12, 0.18) }, () => {
      k.box('steel', [w - 0.12, 0.14, 0.004], [0, 0, 0.002 + 0.0005], { r: 0.002, tint: DARK })
      k.screen([-w * 0.25, 0.01, 0.0045], 0.14, 0.06, { bezel: 0.008 })
      for (let i = 0; i < 4; i++) k.cyl('paint', 0.011, 0.01, [w * 0.02 + i * 0.05, 0.02, 0.009], { axis: 'z', seg: 12, tint: i === 3 ? [0.8, 0.15, 0.1] : [0.85, 0.85, 0.82] })
      k.box('steel', [0.05, 0.08, 0.012], [w * 0.32, 0.0, 0.01], { r: 0.004, tint: ALU })
      k.box('rubber', [0.004, 0.03, 0.002], [w * 0.32, 0.015, 0.0166], { r: 0 })
    })

    const R = Math.min(w * 0.33, body * 0.3), dy = plinth + (body - 0.18) * 0.52, fz = cz + (d - 0.04) / 2
    const plate = plinth + (body - 0.18) / 2, hw = (w - 0.02) / 2, hh = (body - 0.18) / 2, deep = (d - 0.04) * 0.7, Ri = R * 0.95, Ro = R * 0.95 + 0.012
    const ring = (r: number, y: number): V2[] => Array.from({ length: 40 }, (_, i) => [Math.cos(i / 40 * Math.PI * 2) * r, y + Math.sin(i / 40 * Math.PI * 2) * r] as V2)
    k.extrude('steel', [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], 0.02, [0, plate, fz - 0.01], { holes: [ring(R * 0.8, dy - plate).reverse()], bevel: 0.003, tint: GALV })
    k.lathe('steel', [[0, -deep - 0.012], [Ro, -deep - 0.012], [Ro, -0.02], [Ri, -0.02], [Ri, -deep], [0, -deep], [0, -deep - 0.012]], [0, dy, fz], { axis: 'z', seg: 32, tint: DARK })
    k.torus('rubber', R * 0.9, 0.012, [0, dy, fz], { axis: 'z', segR: 40, seg: 8 })

    k.frame({ at: [0, dy, fz + 0.012] }, () => k.leaf({
      kind: 'door', pivot: k.point([-R - 0.05, 0, 0]), axis: k.direction([0, -1, 0]), travel: 1.9, initial: 0,
      handle: k.point([R + 0.03, 0, 0.07]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
      center: k.point([0, 0, 0.02]), width: 2 * R + 0.08, height: 2 * R + 0.08, depth: 0.04, floor: k.point([0, -R * 0.6, -0.3]),
    }, () => {
      k.lathe('steel', [[R * 0.78, -0.012], [R + 0.03, -0.012], [R + 0.04, 0.0], [R + 0.03, 0.03], [R * 0.82, 0.04], [R * 0.78, 0.03], [R * 0.78, -0.012]], [0, 0, 0], { axis: 'z', seg: 40, crease: 50, tint: ALU })
      if (v !== 2) k.lathe('glass', [[0, 0], [R * 0.8, 0], [R * 0.8, 0.012], [R * 0.66, 0.04], [R * 0.4, 0.062], [0, 0.07]], [0, 0, 0], { axis: 'z', seg: 32, tint: [0.75, 0.8, 0.82] })
      k.box('steel', [0.04, 0.14, 0.04], [R + 0.03, 0, 0.03], { r: 0.012, tint: DARK })
    }))
    k.cyl('steel', 0.018, 0.12, [-R - 0.05, dy, fz + 0.012], { seg: 12, tint: ALU })
    if (v === 2) {
      const span = d - 0.04 - 0.12, lid = (z: number) => plinth + body + 0.02 * ((d - 0.04) / 2 - 0.12 - z) / span
      folded(k, 0.34, 0.09, 0.26, [-w * 0.2, lid(-0.1) - 0.003, -0.1], { tint: [0.75, 0.72, 0.65] })
      for (const [x, yaw] of [[-0.12, 0.4], [0.18, -0.9]] as const) k.box('glass', [0.06, 0.003, 0.04], [x, 0.0015, d / 2 + 0.03], { yaw, r: 0 })
    }

    k.box('steel', [0.26, 0.07, 0.012], [-w * 0.25, plinth + body - 0.24, fz + 0.006], { r: 0.004, tint: ALU })
    k.box('steel', [0.1, 0.012, 0.012], [-w * 0.25, plinth + body - 0.24, fz + 0.018], { r: 0.004, tint: DARK })
    k.box('steel', [0.12, 0.16, 0.03], [w / 2 - 0.12, plinth + 0.2, fz + 0.015], { r: 0.008, tint: DARK })
    k.box('rubber', [0.004, 0.04, 0.002], [w / 2 - 0.12, plinth + 0.24, fz + 0.031], { r: 0 })

    k.tube('rubber', [[w / 2 - 0.08, plinth + 0.25, cz - (d - 0.04) / 2 + 0.01], [w / 2 - 0.08, plinth + 0.25, -d / 2 - 0.035], [w / 2 - 0.08, 0.025, -d / 2 - 0.035], [w / 2 - 0.25, 0.025, -d / 2 - 0.035]], 0.025, { seg: 10, fillet: 0.05 })
  },
}
