import { noise3, roundRect, type Family, type Kit, type Mat, type V2, type V3 } from '../kit'
import { products } from './common'

const plan = (w: number, d: number, r: number) => roundRect(w, d, r).map(([x, , z]) => [x, z] as V2)
const DRUMS: V3[] = [[0.25, 0.4, 0.7], [0.75, 0.2, 0.15], [0.85, 0.7, 0.15], [0.3, 0.45, 0.3], [0.5, 0.5, 0.5]]

function drum(k: Kit, r: number, h: number, at: V3, tint: V3) {
  const p: V2[] = [[0, 0], [r - 0.012, 0], [r, 0.008], [r + 0.004, 0.016], [r, 0.024]]
  for (const f of [0.33, 0.66]) p.push([r, h * f - 0.02], [r + 0.012, h * f - 0.008], [r + 0.012, h * f + 0.008], [r, h * f + 0.02])
  p.push([r, h - 0.024], [r + 0.004, h - 0.016], [r, h - 0.008], [r - 0.012, h], [r - 0.02, h - 0.004], [0, h - 0.004])
  const seed = Math.floor(k.rnd() * 100), dents = Array.from({ length: 3 }, () => [k.rnd() * Math.PI * 2, 0.1 + k.rnd() * (h - 0.2), 0.05 + k.rnd() * 0.08] as const)
  k.frame({ at }, () => {
    k.lathe('steel', p, [0, 0, 0], {
      seg: 40, crease: 50, tint,
      wear: (x, y, z) => {
        if (Math.hypot(x, z) < r * 0.9) return 0
        const a = Math.atan2(z, x)
        let dent = 0
        for (const [da, dy, dr] of dents) { const q = Math.hypot(Math.atan2(Math.sin(a - da), Math.cos(a - da)) * r, y - dy) / dr; if (q < 1) dent -= 0.012 * (1 - q * q) ** 2 }
        return dent + (noise3(x * 30, y * 30, z * 30, seed) - 0.5) * 0.0015
      },
    })
    k.cyl('steel', 0.028, 0.012, [r * 0.55, h, 0], { seg: 12, tint })
    k.cyl('steel', 0.018, 0.012, [-r * 0.55, h, 0], { seg: 12, tint })
  })
}

function produce(k: Kit, x0: number, x1: number, z0: number, z1: number, y: number, n: number, tint: V3, r = 0.035) {
  for (let i = 0; i < n; i++) k.sphere('paper', r * (0.8 + k.rnd() * 0.4), [k.range(x0, x1), y + r * 0.7 + k.rnd() * r, k.range(z0, z1)], { rows: 6, seg: 10, scale: [1, 0.85, 1.1], tint, yaw: k.rnd() * 3 })
}

export const UTILITY: Family = {
  crate: (k, s) => {
    const { w, h, d } = k, v = s.variant, post = 0.045
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('wood', [post, h, post], x * (w / 2 - post / 2), 0, z * (d / 2 - post / 2), { r: 0.004 })
    const slats = 4, sh = (h - 0.02) / slats
    for (let i = 0; i < slats; i++) {
      const y = 0.01 + (i + 0.5) * sh
      for (const z of [-1, 1]) if (!(v === 2 && i === slats - 1 && z > 0)) k.plank('wood', w - 0.005, sh - 0.03, 0.016, [0, y, z * (d / 2 - 0.008)], { face: true, yaw: z < 0 ? Math.PI : 0, nails: true })
      for (const x of [-1, 1]) k.plank('wood', d - 2 * post, sh - 0.03, 0.016, [x * (w / 2 - 0.008), y, 0], { face: true, yaw: x * Math.PI / 2, nails: true })
    }
    for (let i = 0; i < 3; i++) k.plank('wood', w - 0.02, (d - 0.04) / 3 - 0.01, 0.016, [0, 0.02, -d / 2 + 0.02 + (i + 0.5) * (d - 0.04) / 3], {})
    k.sheet('straw', w - 0.06, d - 0.06, (x, z) => noise3(x * 6, z * 6, 3) * 0.04, [0, h * 0.55, 0], { nx: 14, nz: 12 })
    produce(k, -w / 2 + 0.08, w / 2 - 0.08, -d / 2 + 0.08, d / 2 - 0.08, h * 0.55 + 0.01, 10 + v * 6, k.pick([[0.8, 0.2, 0.15], [0.75, 0.6, 0.35], [0.9, 0.6, 0.15]] as V3[]))
    k.label([0, h * 0.5, d / 2 + 0.001], 0.2, 0.1, { m: 'paper' })
  },
  'medical-crate': (k, s) => {
    const { w, h, d } = k, v = s.variant
    const shell = h * 0.62, wall = 0.018
    k.box('tile', [w, wall, d], [0, wall / 2, 0], { r: 0.012, tint: [0.92, 0.92, 0.9] })
    k.extrude('tile', plan(w, d, 0.035), shell - wall, [0, wall + (shell - wall) / 2, 0], { axis: 'y', holes: [plan(w - 2 * wall, d - 2 * wall, 0.02).reverse()], bevel: 0.006, curveSeg: 4, tint: [0.92, 0.92, 0.9] })
    k.frame({ at: [0, h * 0.62, -d / 2 + 0.02] }, () => k.leaf({
      kind: 'lid', pivot: k.point([0, 0, 0]), axis: k.direction([-1, 0, 0]), travel: 1.9, initial: v === 2 ? 0.55 : 0,
      handle: k.point([0, h * 0.19, d - 0.005]), normal: k.direction([0, 1, 0]), up: k.direction([0, 0, -1]),
      center: k.point([0, h * 0.19, d / 2 - 0.02]), width: w, height: d, depth: h * 0.38, floor: k.point([0, -h * 0.5, d / 2 - 0.02]),
    }, () => k.frame({ pitch: v === 2 ? -0.55 : 0 }, () => {
      k.box('tile', [w, h * 0.38, d], [0, h * 0.19, d / 2 - 0.02], { r: 0.035, tint: [0.92, 0.92, 0.9] })
      k.handle([0, h * 0.38 - 0.01, d / 2 - 0.02], w * 0.35, { pitch: -Math.PI / 2, r: 0.009, standoff: 0.03, m: 'rubber' })
    })))
    k.extrude('rubber', plan(w + 0.004, d + 0.004, 0.036), 0.012, [0, h * 0.62, 0], { axis: 'y', holes: [plan(w - 2 * wall, d - 2 * wall, 0.02).reverse()], bevel: 0.002, curveSeg: 4 })
    for (const x of [-1, 1]) k.frame({ at: [x * w * 0.3, h * 0.62, d / 2 + 0.004] }, () => { k.box('steel', [0.05, 0.06, 0.012], [0, 0, 0.006], { r: 0.006 }); k.box('steel', [0.03, 0.03, 0.01], [0, 0.02, 0.014], { r: 0.004 }) })
    for (const z of [1]) { k.box('paint', [0.12, 0.035, 0.003], [0, h * 0.4, z * (d / 2 + 0.001)], { r: 0, tint: [0.85, 0.12, 0.12] }); k.box('paint', [0.035, 0.12, 0.003], [0, h * 0.4, z * (d / 2 + 0.0015)], { r: 0, tint: [0.85, 0.12, 0.12] }) }
    if (v === 2) products(k, 'med', -w / 2 + 0.06, w / 2 - 0.06, wall, 0, d - 0.08, { fill: 0.7, maxH: 0.1 })
  },
  'ammo-crate': (k, s) => {
    const { w, h, d } = k, v = s.variant, olive: V3 = [0.42, 0.45, 0.3]
    if (v === 0) {
      const wall = 0.014, body = h - 0.04
      k.box('steel', [w, wall, d], [0, wall / 2, 0], { r: 0.006, tint: olive })
      for (const x of [-1, 1]) k.box('steel', [wall, body - wall, d], [x * (w - wall) / 2, wall + (body - wall) / 2, 0], { r: 0.005, tint: olive })
      for (const z of [-1, 1]) k.box('steel', [w - 2 * wall, body - wall, wall], [0, wall + (body - wall) / 2, z * (d - wall) / 2], { r: 0.004, tint: olive })
      for (const x of [-1, 1]) k.box('steel', [0.02, h - 0.06, d - 0.04], [x * (w / 2 + 0.006), (h - 0.06) / 2 + 0.01, 0], { r: 0.006, tint: olive })
      k.leaf({
        kind: 'lid', pivot: k.point([0, h - 0.05, -d / 2 - 0.005]), axis: k.direction([-1, 0, 0]), travel: 1.85, initial: 0,
        handle: k.point([0, h - 0.035, d / 2 + 0.03]), normal: k.direction([0, 1, 0]), up: k.direction([0, 0, -1]),
        center: k.point([0, h - 0.025, 0]), width: w + 0.01, height: d + 0.01, depth: 0.05, floor: k.point([0, 0.02, 0]),
      }, () => {
        k.box('steel', [w + 0.01, 0.05, d + 0.01], [0, h - 0.025, 0], { r: 0.012, tint: olive })
        k.frame({ at: [0, h - 0.01, d / 2 + 0.01] }, () => { k.box('steel', [0.08, 0.06, 0.012], [0, -0.03, 0], { r: 0.004, tint: olive }); k.cyl('steel', 0.006, 0.08, [0, -0.005, 0.006], { axis: 'x', seg: 8 }) })
        k.handle([0, h + 0.002, 0], w * 0.4, { pitch: -Math.PI / 2, r: 0.007, standoff: 0.02 })
      })
    } else {
      const t = 0.022
      const wall = 0.018, body = h - t
      k.box('wood', [w, wall, d], [0, wall / 2, 0], { r: 0.003, tint: olive })
      for (const x of [-1, 1]) k.box('wood', [wall, body - wall, d], [x * (w - wall) / 2, wall + (body - wall) / 2, 0], { r: 0.003, tint: olive })
      for (const z of [-1, 1]) k.box('wood', [w - 2 * wall, body - wall, wall], [0, wall + (body - wall) / 2, z * (d - wall) / 2], { r: 0.003, tint: olive })
      for (const x of [-1, 1]) for (const y of [0.25, 0.75]) k.box('wood', [0.025, 0.04, d + 0.02], [x * (w / 2 + 0.01), h * y, 0], { r: 0.004, tint: olive })
      for (const x of [-1, 1]) k.torus('fabric', 0.034, 0.007, [x * (w / 2 + 0.012), h * 0.5, 0], { axis: 'x', arc: Math.PI, segR: 14, seg: 6, roll: x > 0 ? Math.PI / 2 : -Math.PI / 2, tint: [0.75, 0.68, 0.5] })
      const lid = () => k.box('wood', [w + 0.01, t, d + 0.01], [0, t / 2, 0], { r: 0.004, tint: olive })
      if (v === 2) k.frame({ at: [-0.03, h - t + 0.004, -0.02], yaw: 0.15 }, lid)
      else k.frame({ at: [0, h - t, 0] }, () => k.leaf({
        kind: 'lid', pivot: k.point([0, 0, -d / 2 - 0.005]), axis: k.direction([-1, 0, 0]), travel: 1.85, initial: 0,
        handle: k.point([0, t / 2, d / 2 + 0.02]), normal: k.direction([0, 1, 0]), up: k.direction([0, 0, -1]),
        center: k.point([0, t / 2, 0]), width: w + 0.01, height: d + 0.01, depth: t, floor: k.point([0, t - h + 0.02, 0]),
      }, lid))
      k.label([0, h * 0.45, d / 2 + 0.001], w * 0.6, 0.05, { m: 'paint' })
      if (v === 2) for (let i = 0; i < 6; i++) k.blk('paper', [0.1, 0.06, 0.14], -w / 2 + 0.08 + (i % 3) * 0.12, wall + Math.floor(i / 3) * 0.062, (Math.floor(i / 3) - 0.5) * 0.15, { r: 0.004, tint: [0.75, 0.62, 0.4] })
    }
  },
  pallet: (k, s) => {
    const { w, h, d } = k, v = s.variant, t = 0.022, block = h - 2 * t
    for (let i = 0; i < 5; i++) if (!(v === 2 && i === 3)) k.plank('wood', d, i % 2 ? 0.1 : 0.145, t, [-w / 2 + (i + 0.5) * w / 5 + (i - 2) * 0.01, h - t / 2, 0], { yaw: Math.PI / 2, nails: true, wear: 1.5 })
    for (const x of [-1, 0, 1]) {
      for (const z of [-1, 0, 1]) k.blk('wood', [0.1, block, z === 0 ? 0.1 : 0.145], x * (w / 2 - 0.05 - (x === 0 ? 0 : 0)) * 0.98, t, z * (d / 2 - 0.0725), { r: 0.004, tone: 0.7 + k.rnd() * 0.3 })
      k.plank('wood', d, 0.1, t, [x * (w / 2 - 0.05) * 0.98, t / 2, 0], { yaw: Math.PI / 2 })
      k.plank('wood', w, 0.1, t, [0, h - t - 0.005 - 0.0, 0], { wear: 0 })
    }
    for (const z of [-1, 1]) k.plank('wood', w, 0.145, t, [0, t + block - t / 2 + 0.0, z * (d / 2 - 0.0725)], {})
    k.label([0, h / 2, d / 2 + 0.001], 0.06, 0.04, { m: 'paint', roll: 0 })
  },
  'water-tank': (k, s) => {
    const { w, h, d } = k, v = s.variant, base = 0.15, tankH = h - base - 0.06
    k.blk('steel', [w, 0.03, d], 0, base - 0.03, 0, { r: 0.004, tint: [0.4, 0.4, 0.42] })
    for (const x of [-1, 0, 1]) for (const z of [-1, 1]) k.blk('steel', [0.1, base - 0.03, 0.1], x * (w / 2 - 0.05), 0, z * (d / 2 - 0.05), { r: 0.006, tint: [0.4, 0.4, 0.42] })
    k.box('tile', [w - 0.06, tankH, d - 0.06], [0, base + tankH / 2, 0], { r: 0.08, tint: v === 1 ? [0.85, 0.85, 0.75] : [0.95, 0.95, 0.92] })
    const level = tankH * (0.3 + 0.4 * k.rnd())
    k.box('glass', [w - 0.05, level, d - 0.05], [0, base + 0.03 + level / 2, 0], { r: 0.06, tint: [0.6, 0.75, 0.8] })
    const cage = 0.012
    for (const y of [base + 0.02, base + tankH * 0.5, h - 0.04]) k.tube('steel', roundRect(w - 0.01, d - 0.01, 0.05, y, 3), cage, { closed: true, seg: 6 })
    for (let i = 0; i <= 6; i++) for (const z of [-1, 1]) { const x = -w / 2 + 0.01 + i * (w - 0.02) / 6; k.tube('steel', [[x, base, z * (d / 2 - 0.005)], [x, h - 0.04, z * (d / 2 - 0.005)]], cage, { seg: 6 }) }
    for (let i = 0; i <= 5; i++) for (const x of [-1, 1]) { const z = -d / 2 + 0.01 + i * (d - 0.02) / 5; k.tube('steel', [[x * (w / 2 - 0.005), base, z], [x * (w / 2 - 0.005), h - 0.04, z]], cage, { seg: 6 }) }
    k.frame({ at: [0, h - 0.06, 0] }, () => { k.cyl('tile', 0.15, 0.04, [0, 0.02, 0], { seg: 24, tint: [0.3, 0.3, 0.32] }); for (let i = 0; i < 8; i++) k.box('tile', [0.02, 0.03, 0.03], [Math.cos(i * 0.785) * 0.15, 0.025, Math.sin(i * 0.785) * 0.15], { yaw: -i * 0.785, tint: [0.3, 0.3, 0.32] }) })
    k.frame({ at: [0, base + 0.08, d / 2 - 0.02] }, () => { k.cyl('tile', 0.05, 0.08, [0, 0, 0.04], { axis: 'z', seg: 16, tint: [0.3, 0.3, 0.32] }); k.box('tile', [0.12, 0.03, 0.03], [0, 0.05, 0.06], { r: 0.008, tint: [0.3, 0.3, 0.32] }) })
    k.label([w * 0.2, base + tankH * 0.7, d / 2 - 0.028], 0.2, 0.14)
  },
  barrel: (k, s) => {
    const { w, h } = k, v = s.variant
    drum(k, w / 2 - 0.012, h, [0, 0, 0], DRUMS[(v + Math.floor(k.rnd() * 2)) % DRUMS.length])
    if (v === 2) k.extrude('paint', [[-0.06, -0.06], [0.06, -0.06], [0, 0.07]], 0.002, [0, h * 0.5, w / 2 - 0.004], { tint: [0.95, 0.85, 0.1] })
    k.label([0, h * 0.5, w / 2 + 0.004 - 0.012], 0.12, 0.08, { m: 'paper' })
  },
  dumpster: (k, s) => {
    const { w, h, d } = k, v = s.variant, top = h - 0.08
    const side: V2[] = [[-d / 2 + 0.12, 0.08], [d / 2 - 0.05, 0.08], [d / 2, top], [-d / 2, top]]
    for (const x of [-1, 1]) k.extrude('steel', side, 0.025, [x * (w / 2 - 0.0125), 0, 0], { axis: 'x', bevel: 0.006 })
    k.extrude('steel', [[-w / 2, 0], [w / 2, 0], [w / 2, top - 0.08], [-w / 2, top - 0.08]], 0.025, [0, 0.08, d / 2 - 0.035], { pitch: -Math.atan2(0.05, top - 0.08), bevel: 0.006 })
    k.extrude('steel', [[-w / 2, 0], [w / 2, 0], [w / 2, top - 0.08], [-w / 2, top - 0.08]], 0.025, [0, 0.08, -d / 2 + 0.1], { pitch: Math.atan2(0.12, top - 0.08), bevel: 0.006 })
    k.box('steel', [w - 0.05, 0.025, d - 0.18], [0, 0.09, 0.0], { r: 0.004 })
    for (let i = 0; i < 4; i++) k.box('steel', [0.04, top - 0.12, 0.03], [-w / 2 + (i + 0.5) * w / 4, 0.08 + (top - 0.12) / 2, d / 2 - 0.015], { pitch: -Math.atan2(0.05, top - 0.08), r: 0.006 })
    for (const x of [-1, 1]) k.box('steel', [0.06, 0.08, 0.2], [x * (w / 2 + 0.02), top * 0.6, 0], { r: 0.01 })
    k.box('steel', [w + 0.02, 0.05, 0.05], [0, top, d / 2], { r: 0.008 })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.caster([x * (w / 2 - 0.12), 0, z * (d / 2 - 0.18)], 0.04)
    for (let i = 0; i < 2; i++) {
      const open = i === 0 ? (v === 0 ? 0 : -4.62) : (v === 2 ? -0.24 : 0)
      k.frame({ at: [-w / 4 + i * w / 2, top + 0.02, -d / 2 + 0.02], pitch: open }, () => {
        k.box('rubber', [w / 2 - 0.02, 0.025, d - 0.02], [0, 0.0, d / 2 - 0.01], { r: 0.01, tint: [0.22, 0.3, 0.22] })
        for (let j = 0; j < 3; j++) k.box('rubber', [w / 2 - 0.06, 0.012, 0.025], [0, 0.015, 0.15 + j * (d - 0.3) / 2], { r: 0.004, tint: [0.22, 0.3, 0.22] })
        k.handle([0, 0.01, d - 0.04], 0.2, { pitch: -Math.PI / 2, m: 'rubber', standoff: 0.025, r: 0.008 })
      })
    }
    for (let i = 0; i < 3 + v; i++) k.cushion('rubber', [0.4, 0.35, 0.4], [k.jitter(w * 0.3), top - 0.25 + k.rnd() * 0.15, k.jitter(d * 0.2)], { puff: 0.08, wrinkle: 1.2, r: 0.15, yaw: k.rnd() * 3, tint: [0.25, 0.25, 0.27] })
  },
  planter: (k, s) => {
    const { w, h, d } = k, v = s.variant, t = 0.035
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('wood', [0.07, h, 0.07], x * (w / 2 - 0.035), 0, z * (d / 2 - 0.035), { r: 0.006 })
    const boards = 3, bh = h / boards
    for (let i = 0; i < boards; i++) {
      for (const z of [-1, 1]) k.plank('wood', w - 0.01, bh - 0.008, t, [0, (i + 0.5) * bh, z * (d / 2 - t / 2)], { face: true, yaw: z < 0 ? Math.PI : 0, nails: true })
      for (const x of [-1, 1]) k.plank('wood', d - 0.14, bh - 0.008, t, [x * (w / 2 - t / 2), (i + 0.5) * bh, 0], { face: true, yaw: x * Math.PI / 2, nails: true })
    }
    k.sheet('charcoal', w - 2 * t, d - 2 * t, (x, z) => (noise3(x * 5, z * 5, 1) - 0.5) * 0.04, [0, h - 0.06, 0], { nx: 24, nz: 12, tint: [0.55, 0.4, 0.3] })
    const plants = Math.floor((w - 0.2) / 0.22)
    for (let i = 0; i < plants; i++) for (const z of [-0.12, 0.12]) {
      if (k.chance(v === 2 ? 0.4 : 0.15)) continue
      const x = -w / 2 + 0.15 + i * (w - 0.3) / Math.max(1, plants - 1), y = h - 0.05
      const dead = k.chance(0.3), tint: V3 = dead ? [0.55, 0.45, 0.25] : [0.35, 0.55, 0.25]
      for (let l = 0; l < 6; l++) { const a = l / 6 * Math.PI * 2 + k.rnd(); k.box('straw', [0.12, 0.004, 0.04], [x + Math.cos(a) * 0.05, y + 0.04 + l * 0.008, z * d + Math.sin(a) * 0.05], { yaw: -a, roll: dead ? -0.6 : 0.5, r: 0.002, tint }) }
      k.cyl('straw', 0.004, 0.08, [x, y + 0.04, z * d], { seg: 5, tint })
    }
  },
  trough: (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('wood', [0.07, h - 0.1, 0.07], x * (w / 2 - 0.12), 0, z * (d / 2 - 0.1), { r: 0.006 })
    const prof: V2[] = [[-d / 2, h], [-d / 2 + 0.06, 0.12], [d / 2 - 0.06, 0.12], [d / 2, h], [d / 2 - 0.035, h], [d / 2 - 0.09, 0.155], [-d / 2 + 0.09, 0.155], [-d / 2 + 0.035, h]]
    k.extrude('wood', prof, w - 0.06, [0, 0, 0], { axis: 'x', bevel: 0.006 })
    for (const x of [-1, 1]) k.extrude('wood', [[-d / 2, h], [-d / 2 + 0.06, 0.12], [d / 2 - 0.06, 0.12], [d / 2, h]], 0.03, [x * (w / 2 - 0.015), 0, 0], { axis: 'x', bevel: 0.004 })
    for (const x of [-0.35, 0.35]) k.extrude('steel', [[-d / 2 - 0.004, h], [-d / 2 + 0.056, 0.115], [d / 2 - 0.056, 0.115], [d / 2 + 0.004, h], [d / 2 - 0.004, h], [d / 2 - 0.064, 0.123], [-d / 2 + 0.064, 0.123], [-d / 2 + 0.004, h]], 0.04, [x * w, 0, 0], { axis: 'x' })
    if (v !== 2) k.sheet(v === 0 ? 'glass' : 'straw', w - 0.1, d * 0.62, (x, z) => (noise3(x * 4, z * 4, 2) - 0.5) * (v === 0 ? 0.004 : 0.03), [0, h * 0.62, 0], { nx: 20, nz: 8, tint: v === 0 ? [0.5, 0.55, 0.45] : [0.85, 0.75, 0.45] })
  },
  fence: (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) {
      const pts: V3[] = Array.from({ length: 8 }, (_, i) => [x * (w / 2 - 0.07) + k.jitter(0.006), i * h / 7, k.jitter(0.006)] as V3)
      k.tube('wood', pts, 0.06, { seg: 12, fillet: 0, taper: 0.1 })
      k.lathe('wood', [[0, 0], [0.058, 0], [0.04, 0.03], [0, 0.04]], [x * (w / 2 - 0.07), h, 0], { seg: 12 })
    }
    for (const [i, y] of [0.25, h * 0.55, h - 0.15].entries()) {
      if (v === 2 && i === 1) {
        k.plank('wood', w * 0.55, 0.09, 0.03, [-w * 0.2, y, d * 0.1], { face: true, roll: -0.08, nails: true })
        k.plank('wood', w * 0.4, 0.09, 0.03, [w * 0.24, y - 0.14, d * 0.15], { face: true, roll: -0.5 })
        continue
      }
      k.plank('wood', w - 0.02, 0.1, 0.03, [0, y, d * 0.15], { face: true, nails: true, wear: 1.5 })
    }
    if (v === 1) k.tube('steel', [[-w / 2 + 0.07, h - 0.05, -0.065], [w / 2 - 0.07, h - 0.06, -0.065]], 0.0018, { seg: 4 })
  },
  barricade: (k, s) => {
    const { w, h, d } = k, v = s.variant
    const front = d / 2 - 0.03, postZ = front - 0.065
    for (const x of [-1, 1]) {
      k.blk('wood', [0.09, h, 0.09], x * (w / 2 - 0.1), 0, postZ, { r: 0.008, roll: x * 0.02 })
      const top: V3 = [x * (w / 2 - 0.1), h * 0.72, postZ - 0.05], foot: V3 = [x * (w / 2 - 0.1), 0.02, -d / 2 + 0.035]
      k.box('wood', [0.06, Math.hypot(top[1] - foot[1], top[2] - foot[2]), 0.06], [top[0], (top[1] + foot[1]) / 2, (top[2] + foot[2]) / 2], { pitch: Math.atan2(top[2] - foot[2], top[1] - foot[1]), r: 0.006 })
    }
    let y = 0.2
    while (y < h - 0.12) {
      const tilt = k.jitter(0.08), len = w * (0.86 + k.rnd() * 0.12)
      k.plank('wood', len, 0.12 + k.rnd() * 0.06, 0.025, [k.jitter(0.04), y, front - 0.0125], { face: true, roll: tilt, nails: true, wear: 2 })
      y += 0.14 + k.rnd() * 0.12
    }
    for (const sgn of [-1, 1]) k.plank('wood', Math.hypot(w * 0.7, h * 0.7), 0.13, 0.025, [0, h * 0.5, front + 0.0125], { face: true, roll: sgn * Math.atan2(h * 0.7, w * 0.7), nails: true })
    if (v !== 0) k.frame({ at: [w * 0.15, h * 0.45, front - 0.04], roll: 0.05 }, () => {
      const cw = w * 0.45, ch = h * 0.55
      k.extrude('steel', Array.from({ length: 30 }, (_, i) => [-cw / 2 + i / 29 * cw, Math.sin(i / 29 * cw / 0.076 * Math.PI * 2) * 0.008] as V2).concat(Array.from({ length: 30 }, (_, i) => [cw / 2 - i / 29 * cw, Math.sin((29 - i) / 29 * cw / 0.076 * Math.PI * 2) * 0.008 - 0.002] as V2)), ch, [0, 0, 0], { axis: 'y', pitch: 0, tint: [0.7, 0.6, 0.5] })
    })
    if (v === 2) for (let i = 0; i < 6; i++) k.cyl('wood', 0.028, 0.32, [-w / 2 + 0.15 + i * (w - 0.3) / 5, h + 0.1, postZ], { r2: 0.002, pitch: k.jitter(0.15), roll: k.jitter(0.15), seg: 8 })
  },
  blackboard: (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) {
      k.tube('steel', [[x * (w / 2 - 0.05), 0.08, -d / 2 + 0.05], [x * (w / 2 - 0.05), h - 0.02, 0], [x * (w / 2 - 0.05), 0.08, d / 2 - 0.05]], 0.016, { fillet: 0.04 })
      for (const z of [-1, 1]) k.caster([x * (w / 2 - 0.05), 0, z * (d / 2 - 0.05)], 0.03)
    }
    const bw = w - 0.16, bh = h * 0.5, by = h * 0.62
    k.frameRect('wood', bw, bh, 0.04, 0.03, [0, by, 0])
    k.box('rubber', [bw - 0.06, bh - 0.06, 0.012], [0, by, 0], { r: 0.002 })
    k.box('wood', [bw, 0.025, 0.06], [0, by - bh / 2 - 0.005, 0.03], { r: 0.006 })
    for (let i = 0; i < 4; i++) k.cyl('tile', 0.005, 0.06, [-bw * 0.3 + i * 0.08 + k.jitter(0.02), by - bh / 2 + 0.013, 0.04], { axis: 'x', yaw: k.jitter(0.4), seg: 8, tint: k.pick([[1, 1, 1], [1, 0.95, 0.6], [0.8, 0.9, 1]] as V3[]) })
    k.frame({ at: [bw * 0.3, by - bh / 2 + 0.035, 0.035] }, () => { k.box('wood', [0.13, 0.025, 0.045], [0, 0, 0], { r: 0.006 }); k.box('fabric', [0.13, 0.015, 0.045], [0, -0.02, 0], { r: 0.004, tint: [0.4, 0.4, 0.42] }) })
    const lines = 4 + v * 2
    for (let i = 0; i < lines; i++) { const len = bw * (0.3 + k.rnd() * 0.5); k.box('tile', [len, 0.008, 0.001], [-bw / 2 + 0.06 + len / 2 + k.rnd() * 0.05, by + bh / 2 - 0.08 - i * (bh - 0.15) / lines, 0.0065], { roll: k.jitter(0.02), r: 0, tint: [0.9, 0.9, 0.88], tone: 0.7 }) }
    k.cyl('steel', 0.012, bw + 0.08, [0, by, 0], { axis: 'x', seg: 10 })
  },
  noticeboard: (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) k.blk('wood', [0.08, h, 0.08], x * (w / 2 - 0.06), 0, 0, { r: 0.008 })
    const bw = w - 0.2, bh = h * 0.45, by = h * 0.62
    k.frameRect('wood', bw + 0.06, bh + 0.06, 0.04, 0.04, [0, by, 0.02])
    k.box('fabric', [bw, bh, 0.02], [0, by, 0.012], { r: 0.002, tint: [0.65, 0.48, 0.32] })
    if (v !== 0) {
      for (const x of [-1, 1]) k.box('wood', [Math.hypot(w / 2, 0.18) + 0.06, 0.02, d], [x * w * 0.25, h - 0.02, 0], { roll: -x * 0.34, r: 0.004 })
      k.box('wood', [0.05, 0.05, d], [0, h + 0.07, 0], { r: 0.006 })
    }
    const notes = 6 + v * 4
    for (let i = 0; i < notes; i++) {
      const x = k.range(-bw / 2 + 0.08, bw / 2 - 0.08), y = by + k.range(-bh / 2 + 0.09, bh / 2 - 0.09), photo = k.chance(0.3)
      k.box('paper', photo ? [0.09, 0.12, 0.002] : [0.15, 0.2, 0.002], [x, y, 0.024 + i * 0.0003], { roll: k.jitter(0.25), r: 0, tint: photo ? [0.75, 0.7, 0.65] : k.pick([[1, 1, 0.92], [1, 0.95, 0.7], [0.95, 0.95, 1]] as V3[]) })
      k.sphere('paint', 0.006, [x, y + (photo ? 0.05 : 0.085), 0.03], { rows: 4, seg: 8, tint: k.pick([[0.9, 0.2, 0.2], [0.2, 0.5, 0.9], [0.95, 0.85, 0.2]] as V3[]) })
    }
  },
  sign: (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) { k.cyl('steel', 0.03, h - 0.02, [x * (w / 2 - 0.1), (h - 0.02) / 2, 0], { seg: 14 }); k.cyl('concrete', 0.09, 0.1, [x * (w / 2 - 0.1), 0.05, 0], { seg: 18 }) }
    const sw = w - 0.06, sh = h * 0.42, sy = h - sh / 2 - 0.05
    k.box('paint', [sw, sh, 0.04], [0, sy, 0.05], { r: 0.012 })
    k.frameRect('steel', sw + 0.02, sh + 0.02, 0.025, 0.05, [0, sy, 0.05])
    const letters = 5 + v
    for (let i = 0; i < letters; i++) if (k.chance(0.85)) {
      const lx = -sw / 2 + 0.12 + i * (sw - 0.24) / Math.max(1, letters - 1)
      k.box('tile', [0.035, sh * 0.42, 0.012], [lx - 0.03, sy, 0.076], { r: 0.004, tint: [0.95, 0.95, 0.9] })
      k.box('tile', [0.08, 0.035, 0.012], [lx, sy + sh * 0.19, 0.076], { r: 0.004, tint: [0.95, 0.95, 0.9] })
      if (i % 2) k.box('tile', [0.07, 0.03, 0.012], [lx - 0.005, sy, 0.076], { r: 0.004, tint: [0.95, 0.95, 0.9] })
    }
    for (let i = 0; i < 6; i++) k.cyl('glass', 0.02, 0.02, [-sw / 2 + 0.06 + i * (sw - 0.12) / 5, sy + sh / 2 + 0.01, 0.07], { seg: 10 })
    if (v === 2) k.cable('rubber', [w / 2 - 0.1, sy - sh / 2, 0.02], [w / 2 - 0.1, 0.02, 0.06], 0.02, 0.006)
  },
  kennel: (k, s) => {
    const { w, h, d } = k, v = s.variant, wallH = h * 0.6, t = 0.02
    k.blk('wood', [w, 0.05, d], 0, 0, 0, { r: 0.006, tone: 0.7 })
    const front: V2[] = [[-w / 2, 0], [w / 2, 0], [w / 2, wallH], [0, h - 0.06], [-w / 2, wallH]]
    const hole: V2[] = [[-0.16, 0.06], [0.16, 0.06], [0.16, 0.3], ...Array.from({ length: 9 }, (_, i) => [Math.cos(i / 8 * Math.PI) * 0.16, 0.3 + Math.sin(i / 8 * Math.PI) * 0.16] as V2).slice(1, 8), [-0.16, 0.3]]
    k.extrude('wood', front, t, [0, 0.05, d / 2 - t / 2 - 0.03], { holes: [hole.map(([x, y]) => [x * Math.min(1, w / 0.8), y] as V2).reverse()], bevel: 0.004 })
    k.extrude('wood', front, t, [0, 0.05, -d / 2 + t / 2 + 0.03], { bevel: 0.004 })
    for (const x of [-1, 1]) k.blk('wood', [t, wallH, d - 0.1], x * (w / 2 - t / 2), 0.05, 0)
    for (let i = 0; i < 6; i++) for (const z of [-1, 1]) k.box('wood', [w + 0.02, 0.014, 0.02], [0, 0.1 + i * wallH / 6, z * (d / 2 - 0.04 + 0.015)], { r: 0.003, tone: 0.8 })
    const roofLen = Math.hypot(w / 2, h - 0.06 - wallH) + 0.08, ang = Math.atan2(h - 0.06 - wallH, w / 2)
    for (const x of [-1, 1]) k.frame({ at: [x * w / 4, (wallH + h - 0.06) / 2 + 0.04, 0], roll: -x * ang }, () => {
      k.box('wood', [roofLen, 0.02, d + 0.04], [0, 0, 0], { r: 0.004 })
      const cols = Math.floor((d + 0.02) / 0.12), sw = (d + 0.02) / cols
      for (let r = 0; r < 5; r++) for (let c = 0; c < cols - (r % 2); c++) k.box('charcoal', [roofLen / 5 + 0.02, 0.008, sw - 0.005], [-roofLen / 2 + (r + 0.5) * roofLen / 5, 0.014, -(d + 0.02) / 2 + (c + 0.5 + (r % 2) * 0.5) * sw], { pitch: k.jitter(0.03), r: 0.002, tint: [0.45, 0.3, 0.25] })
    })
    k.lathe('steel', [[0, 0], [0.08, 0], [0.1, 0.05], [0.095, 0.05], [0.075, 0.008], [0, 0.008]], [w * 0.3, 0.05, d / 2 - 0.1], { seg: 20, tint: [0.75, 0.2, 0.15] })
    if (v !== 1) k.cushion('fabric', [w * 0.6, 0.06, d * 0.5], [0, 0.08, 0], { puff: 0.02, tint: [0.6, 0.5, 0.35] })
  },
}

function pistol(k: Kit, at: V3, yaw: number, scale: number) {
  k.frame({ at, yaw, scale }, () => {
    k.extrude('steel', [[-0.1, 0], [0.09, 0], [0.095, 0.03], [-0.1, 0.03]], 0.026, [0, 0.085, 0], { bevel: 0.003, tint: [0.25, 0.25, 0.27] })
    k.extrude('rubber', [[-0.085, 0.085], [-0.04, 0.085], [-0.055, 0], [-0.1, 0.005]], 0.028, [0, 0, 0], { bevel: 0.004 })
    k.extrude('steel', [[-0.045, 0.085], [0.02, 0.085], [0.02, 0.06], [-0.01, 0.045], [-0.04, 0.05]], 0.012, [0, 0, 0], { holes: [[[-0.035, 0.078], [-0.008, 0.052], [0.012, 0.062], [0.012, 0.078]]], tint: [0.25, 0.25, 0.27] })
    k.cyl('steel', 0.006, 0.02, [0.1, 0.1, 0], { axis: 'x', seg: 10, tone: 0.3 })
  })
}
export const RESOURCES: Family = {
  medicine: (k, s) => {
    const { w, h, d } = k
    products(k, 'med', -w / 2, w * 0.15, 0, -d * 0.15, d * 0.5, { maxH: h, fill: 1, rows: 1 })
    for (let i = 0; i < 2 + s.variant; i++) k.box('tile', [0.09, 0.006, 0.06], [w * 0.28, 0.003 + i * 0.007, d * 0.15], { yaw: k.jitter(0.4), r: 0.001, tint: [0.85, 0.85, 0.9] })
    k.blk('paper', [0.07, 0.035, 0.1], w * 0.25, 0, -d * 0.2, { r: 0.002, tint: [0.95, 0.95, 1] })
  },
  bandages: (k, s) => {
    const { w, d } = k
    for (let i = 0; i < 2 + s.variant; i++) {
      const x = -w / 2 + 0.04 + i * 0.065, r = 0.028 + k.rnd() * 0.008
      k.cyl('fabric', r, 0.055, [x, r, k.jitter(0.03)], { axis: 'z', seg: 18, bevel: 0.004, tint: [0.97, 0.95, 0.9] })
      k.torus('fabric', r * 0.5, r * 0.18, [x, r, k.jitter(0.002) + 0.028], { axis: 'z', segR: 12, seg: 6, tint: [0.9, 0.88, 0.84] })
    }
    k.blk('paper', [0.08, 0.02, 0.11], w * 0.3, 0, d * 0.1, { r: 0.003, tint: [0.95, 0.95, 0.95] })
    k.label([w * 0.3, 0.021, d * 0.1], 0.04, 0.04, { m: 'paint', pitch: -Math.PI / 2 })
  },
  cans: (k, s) => {
    const { w, h, d } = k
    products(k, 'can', -w / 2, w / 2, 0, 0, d, { maxH: h * 0.62, fill: 1, rows: 2 })
    if (s.variant > 0) products(k, 'can', -w / 2 + 0.04, w / 2 - 0.04, h * 0.55, 0, 0.05, { maxH: h * 0.45, fill: 0.8, rows: 1 })
  },
  'food-box': (k, s) => {
    const { w, h, d } = k
    for (let i = 0; i < 1 + s.variant; i++) k.blk('paper', [w * 0.45, h * 0.9, d * 0.35], -w / 4 + i * 0.05, 0, (i - 0.5) * d * 0.4, { yaw: k.jitter(0.2), r: 0.003, tint: k.pick([[0.9, 0.7, 0.2], [0.85, 0.3, 0.2], [0.35, 0.55, 0.3]] as V3[]) })
    k.blk('paper', [w * 0.4, h * 0.35, d * 0.8], w * 0.25, 0, 0, { r: 0.004, tint: [0.55, 0.5, 0.35] })
    k.label([w * 0.25, h * 0.18, d * 0.4 + 0.001], w * 0.25, h * 0.15)
  },
  bottles: (k, s) => {
    const { w, h, d } = k
    let x = -w / 2 + 0.035
    while (x < w / 2 - 0.03) {
      const r = 0.033, tall = h * (0.85 + k.rnd() * 0.15)
      const prof: [number, number][] = [[0, 0], [r * 0.9, 0], [r, 0.01]]
      for (let i = 1; i < 5; i++) prof.push([r, tall * (0.12 + i * 0.12)], [r * 0.94, tall * (0.12 + i * 0.12) + 0.008])
      prof.push([r, tall * 0.72], [r * 0.4, tall * 0.88], [r * 0.38, tall * 0.93], [0, tall * 0.93])
      k.lathe('glass', prof, [x, 0, k.jitter(d * 0.2)], { seg: 16, tint: [0.75, 0.88, 0.95] })
      k.cyl('paint', r * 0.42, tall * 0.07, [x, tall * 0.965, 0], { seg: 12, tint: [0.2, 0.4, 0.85] })
      x += r * 2 + 0.005
    }
    void s
  },
  ammo: (k, s) => {
    const { w, d } = k
    for (let i = 0; i < 1 + s.variant; i++) k.blk('paper', [0.1, 0.045, 0.065], -w / 2 + 0.06 + i * 0.1, 0, -d * 0.15, { r: 0.003, tint: [0.75, 0.6, 0.35] })
    for (let i = 0; i < 6 + s.variant * 3; i++) k.frame({ at: [k.jitter(w * 0.35), 0.006, d * 0.2 + k.jitter(0.04)], yaw: k.rnd() * 3, roll: Math.PI / 2 }, () => {
      k.lathe('steel', [[0, 0], [0.006, 0], [0.006, 0.03], [0.0045, 0.034], [0, 0.034]], [0, -0.017, 0], { seg: 8, tint: [0.85, 0.65, 0.3] })
      k.lathe('steel', [[0, 0], [0.0045, 0], [0.004, 0.006], [0, 0.012]], [0, 0.017, 0], { seg: 8, tint: [0.7, 0.45, 0.3] })
    })
  },
  handgun: (k, s) => {
    const { w } = k
    pistol(k, [0, 0.013, 0], 0, Math.max(0.8, w / 0.3))
    if (s.variant > 0) k.blk('steel', [0.02, 0.1, 0.03], w * 0.3, 0, 0.05, { r: 0.003, pitch: Math.PI / 2, tint: [0.25, 0.25, 0.27] })
    if (s.variant === 2) k.blk('paper', [0.1, 0.045, 0.065], -w * 0.25, 0, 0.06, { r: 0.003, tint: [0.75, 0.6, 0.35] })
  },
  toolbox: (k, s) => {
    const { w, h, d } = k, tint: V3 = [[0.8, 0.15, 0.12], [0.2, 0.3, 0.6], [0.25, 0.25, 0.25]][s.variant] as V3
    k.box('steel', [w, h * 0.65, d * 0.8], [0, h * 0.325, 0], { r: 0.006, tint })
    k.extrude('steel', [[-d * 0.4, 0], [d * 0.4, 0], [d * 0.3, h * 0.2], [-d * 0.3, h * 0.2]], w, [0, h * 0.65, 0], { axis: 'x', bevel: 0.003, tint })
    k.handle([0, h * 0.86, 0], w * 0.55, { pitch: -Math.PI / 2, r: 0.006, standoff: h * 0.12, m: 'rubber' })
    for (const x of [-1, 1]) k.box('steel', [0.02, 0.03, 0.008], [x * w * 0.36, h * 0.62, d * 0.4 + 0.004], { r: 0.003 })
  },
  cloth: (k, s) => {
    const { w, h, d } = k
    const layers = 2 + s.variant
    for (let i = 0; i < layers; i++) k.cushion('fabric', [w * (0.9 - i * 0.05), h / layers, d * 0.9], [k.jitter(0.01), (i + 0.5) * h / layers, k.jitter(0.01)], { puff: 0.01, wrinkle: 0.8, r: 0.012, yaw: k.jitter(0.1), tint: k.pick([[0.4, 0.45, 0.6], [0.7, 0.3, 0.25], [0.85, 0.82, 0.75], [0.35, 0.4, 0.3]] as V3[]) })
  },
  battery: (k, s) => {
    const { w, d } = k
    for (let i = 0; i < 3 + s.variant * 2; i++) k.frame({ at: [-w / 2 + 0.03 + (i % 4) * 0.045, 0.017, (Math.floor(i / 4) - 0.3) * 0.06], roll: Math.PI / 2, yaw: k.jitter(0.2) }, () => {
      k.cyl('paint', 0.017, 0.06, [0, 0, 0], { seg: 14, tint: k.pick([[0.85, 0.65, 0.1], [0.15, 0.15, 0.15], [0.2, 0.4, 0.8]] as V3[]) })
      k.cyl('steel', 0.005, 0.005, [0, 0.032, 0], { seg: 8 })
    })
    k.blk('paint', [0.1, 0.03, 0.06], w * 0.25, 0, d * 0.1, { r: 0.004, tint: [0.2, 0.25, 0.2] })
    for (let i = 0; i < 4; i++) k.cyl('steel', 0.002, 0.008, [w * 0.22 + i * 0.012, 0.034, d * 0.1], { seg: 6 })
  },
  seeds: (k, s) => {
    const { w, h, d } = k
    for (let i = 0; i < 3 + s.variant * 2; i++) k.box('paper', [0.08, 0.004, 0.12], [k.jitter(w * 0.3), 0.003 + i * 0.005, k.jitter(d * 0.15)], { yaw: k.jitter(0.5), r: 0.001, tint: k.pick([[0.95, 0.85, 0.5], [0.7, 0.85, 0.5], [0.95, 0.6, 0.5]] as V3[]) })
    k.lathe('glass', [[0, 0], [0.03, 0], [0.032, h * 0.7], [0.028, h * 0.75], [0.028, h * 0.8], [0, h * 0.8]], [w * 0.3, 0, -d * 0.2], { seg: 16 })
    k.cyl('steel', 0.03, 0.015, [w * 0.3, h * 0.8, -d * 0.2], { seg: 16 })
    k.cyl('straw', 0.025, h * 0.35, [w * 0.3, h * 0.2, -d * 0.2], { seg: 12, tint: [0.75, 0.6, 0.3] })
  },
  papers: (k, s) => {
    const { w, h, d } = k
    const sheets = Math.round(h / 0.012)
    for (let i = 0; i < sheets; i++) k.box('paper', [w * 0.75, 0.008, d * 0.9], [k.jitter(0.008), 0.004 + i * 0.0105, k.jitter(0.008)], { yaw: k.jitter(0.05), r: 0.001, tint: i % 5 === 0 ? [0.9, 0.8, 0.5] : [0.95, 0.94, 0.9] })
    k.box('paper', [w * 0.8, 0.012, d * 0.95], [0, sheets * 0.0105 + 0.006, 0], { yaw: 0.15, r: 0.002, tint: [0.35, 0.45, 0.6] })
    k.torus('rubber', 0.03, 0.002, [0, h * 0.5, 0], { segR: 16, seg: 4, scale: [w * 12, h * 8, d * 15] })
    void s
  },
  plastic: (k, s) => {
    const { w, h, d } = k
    for (let i = 0; i < 2 + s.variant; i++) k.frame({ at: [k.jitter(w * 0.3), 0.03, k.jitter(d * 0.25)], yaw: k.rnd() * 3, roll: Math.PI / 2 }, () => {
      k.lathe('glass', [[0, 0], [0.03, 0], [0.032, 0.1], [0.012, 0.14], [0.012, 0.16], [0, 0.16]], [0, -0.08, 0], { seg: 12, scale: [1, 1, 0.55], tint: k.pick([[0.6, 0.85, 0.6], [0.85, 0.9, 0.95], [0.9, 0.6, 0.5]] as V3[]) })
    })
    k.cushion('paint', [w * 0.6, h * 0.5, d * 0.7], [w * 0.15, h * 0.25, 0], { puff: 0.02, wrinkle: 1.5, r: 0.03, tint: [0.9, 0.9, 0.92] })
  },
}

export const STAIRS_FLOORS: Family = {
  stairs: (k, s) => {
    const { w, h, d } = k, v = s.variant, steps = 16, rise = h / steps, run = d / steps
    for (let i = 0; i < steps; i++) {
      const top = (i + 1) * rise, z = d / 2 - (i + 0.5) * run, thick = Math.min(top, 0.42)
      k.box('concrete', [w, thick - 0.012, run], [0, top - 0.012 - (thick - 0.012) / 2, z], { r: 0.004 })
      k.box('concrete', [w + 0.002, 0.024, run + 0.018], [0, top - 0.012, z + 0.009], { r: 0.008, tone: 0.95 + k.rnd() * 0.1 })
      k.box('rubber', [w * 0.94, 0.004, 0.035], [0, top + 0.002, z + run / 2 - 0.01], { r: 0.0015, tone: 0.5 })
      if (k.chance(0.25)) k.box('concrete', [0.06 + k.rnd() * 0.1, 0.02, 0.03], [k.jitter(w * 0.35), top - 0.022, z + run / 2 + 0.008], { r: 0.008, tone: 0.75 })
    }
    k.extrude('concrete', [[d / 2, 0], [d / 2 - run, 0], [-d / 2, h - 0.42], [-d / 2, h - 0.2]], w - 0.02, [0, 0, 0], { axis: 'x' })
    const rails = v === 2 ? [-1, 1] : [v === 0 ? 1 : -1]
    for (const x of rails) {
      const rx = x * (w / 2 - 0.05)
      for (let i = 1; i < steps; i += 3) { const top = (i + 1) * rise, z = d / 2 - (i + 0.5) * run; k.cyl('steel', 0.014, 0.9, [rx, top + 0.45, z], { seg: 10 }); k.cyl('steel', 0.03, 0.01, [rx, top + 0.005, z], { seg: 12 }) }
      k.tube('steel', [[rx, 0.95, d / 2 - 0.05], [rx, rise * 2 + 0.92, d / 2 - 2 * run], [rx, h + 0.9 - rise * 2, -d / 2 + 2 * run], [rx, h + 0.92, -d / 2 + 0.05]], 0.022, { fillet: 0.2, seg: 12 })
      k.tube('steel', [[rx, 0.5, d / 2 - 0.05], [rx, h + 0.45, -d / 2 + 0.05]], 0.009, { seg: 8 })
    }
  },
  'tile-floor': (k, s) => {
    const { w, h, d } = k, v = s.variant, tile = [0.3, 0.4, 0.5][v], grout = 0.006, tt = 0.016
    k.box('concrete', [w, h - tt, d], [0, (h - tt) / 2, 0], { r: 0.003 })
    const nx = Math.round(w / tile), nz = Math.round(d / tile), tw = w / nx, td = d / nz
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (k.chance(0.025)) continue
      const x = -w / 2 + (i + 0.5) * tw, z = -d / 2 + (j + 0.5) * td, lift = k.chance(0.05) ? 0.006 : 0
      const cracked = k.chance(0.06), checker = v === 2 && (i + j) % 2 === 1
      const tint: V3 = checker ? [0.25, 0.25, 0.28] : [1, 1, 1]
      if (cracked) {
        const cx = k.jitter(tw * 0.2)
        k.box('tile', [tw / 2 + cx - grout, tt, td - grout], [x - tw / 4 + cx / 2, h - tt / 2 + lift, z], { r: 0.002, roll: k.jitter(0.02), tint })
        k.box('tile', [tw / 2 - cx - grout, tt, td - grout], [x + tw / 4 + cx / 2, h - tt / 2, z], { r: 0.002, pitch: k.jitter(0.03), tint })
      } else k.box('tile', [tw - grout, tt, td - grout], [x, h - tt / 2 + lift, z], { r: 0.0025, yaw: k.jitter(0.004), pitch: lift ? k.jitter(0.04) : 0, tint, tone: 0.92 + k.rnd() * 0.12 })
    }
    for (let i = 0; i < 6 + v * 3; i++) k.box('tile', [0.02 + k.rnd() * 0.05, 0.008, 0.02 + k.rnd() * 0.04], [k.jitter(w * 0.45), h + 0.004, k.jitter(d * 0.45)], { yaw: k.rnd() * 3, r: 0.002, tone: 0.8 })
  },
}
