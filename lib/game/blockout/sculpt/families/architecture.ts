import type { Family, Kit, Mat, V2, V3 } from '../kit'
import { hash, random } from '../../types'

export type WallMat = 'concrete' | 'brick' | 'wood'
const STUD = 0.09
const BOARD = 0.02
export const PLINTH: V3 = [0.62, 0.6, 0.58]
export const COPING: V3 = [0.72, 0.7, 0.66]
const FRAMING: V3 = [0.55, 0.42, 0.3]
export const wallMat = (m: string): WallMat => (m === 'brick' || m === 'wood' ? m : 'concrete')
export const trimFor = (m: WallMat): { m: Mat; tint: V3 } => m === 'concrete' ? { m: 'steel', tint: [0.3, 0.31, 0.33] } : m === 'brick' ? { m: 'wood', tint: [0.92, 0.9, 0.86] } : { m: 'wood', tint: [0.42, 0.28, 0.18] }

export function masonry(k: Kit, m: 'concrete' | 'brick', x0: number, x1: number, y0: number, y1: number, o: { lintel?: boolean } = {}) {
  const { h, d } = k, len = x1 - x0, cx = (x0 + x1) / 2, base = y0 < 1e-6, cap = y1 > h - 1e-6

  const c0 = base ? 0.2 : y0, c1 = cap ? y1 - 0.05 : y1
  if (c1 - c0 > 0.01) k.box(m, [len, c1 - c0, d], [cx, (c0 + c1) / 2, 0], { r: 0.004 })
  if (base) k.box('concrete', [len, 0.2, d + 0.024], [cx, 0.1, 0], { r: 0.006, tint: PLINTH })
  if (cap) k.box('concrete', [len, 0.05, d + 0.04], [cx, y1 - 0.025, 0], { r: 0.008, tint: COPING })
  const bottom = y0 + (base ? 0.2 : 0) + (o.lintel ? 0.16 : 0), top = y1 - (cap ? 0.05 : 0)
  if (top - bottom < 0.15 || len < 0.25) return
  for (const sd of [-1, 1]) {
    const face = sd * d / 2
    if (m === 'concrete') {

      for (let y = bottom + 0.3; y < top - 0.05; y += 0.3) k.box('concrete', [len - 0.01, 0.008, 0.003], [cx, y, face + sd * 0.0005], { r: 0.001, tone: 0.9 })
      for (let x = x0 + 0.3; x < x1 - 0.15; x += 0.6) for (let y = bottom + 0.45; y < top - 0.15; y += 0.6) k.cyl('charcoal', 0.012, 0.006, [x, y, face + sd * 0.002], { axis: 'z', seg: 10 })
    } else {

      const course = 0.075, unit = 0.225, rows = Math.floor((top - bottom) / course)
      for (let n = 0; n < Math.round(len * 3); n++) {
        const i = Math.floor(k.rnd() * rows), off = (i % 2) * unit / 2, x = x0 + off + (Math.floor(k.rnd() * Math.floor(len / unit)) + 0.5) * unit
        if (x - 0.11 < x0 || x + 0.11 > x1) continue
        k.box('brick', [0.215, 0.065, 0.012], [x, bottom + (i + 0.5) * course, face + sd * 0.004], { r: 0.003, tone: 0.75 + k.rnd() * 0.35 })
      }
      for (let n = 0; n < 2; n++) {
        const pw = 0.3 + k.rnd() * 0.5, ph = 0.2 + k.rnd() * 0.4
        if (len < pw + 0.12 || top - bottom < ph + 0.12) continue
        const px = x0 + 0.06 + pw / 2 + k.rnd() * (len - pw - 0.12), py = bottom + 0.06 + ph / 2 + k.rnd() * (top - bottom - ph - 0.12)
        const pts: V2[] = Array.from({ length: 8 }, (_, q) => { const a = q / 8 * Math.PI * 2; return [px + Math.cos(a) * pw / 2 * (0.65 + k.rnd() * 0.35), py + Math.sin(a) * ph / 2 * (0.65 + k.rnd() * 0.35)] as V2 })
        k.extrude('plaster', pts, 0.006, [0, 0, face + sd * 0.003], { bevel: 0.002, tint: [0.86, 0.83, 0.77] })
      }
    }
  }
}

export function timber(k: Kit, x0: number, x1: number, y0: number, y1: number, o: { header?: boolean; profile?: (x: number) => number } = {}) {
  const { h, d } = k, fd = d - 2 * (BOARD + 0.002), len = x1 - x0, cx = (x0 + x1) / 2
  const top = (x: number) => (o.profile ? Math.min(y1, o.profile(x)) : y1)
  const lowT = y0 < 1e-6 ? 0.09 : o.header ? 0.14 : 0, capT = !o.profile && y1 > h - 1e-6 ? 0.09 : 0, sillT = !o.profile && !capT ? 0.06 : 0
  if (lowT) k.box('wood', [len, lowT, fd], [cx, y0 + lowT / 2, 0], { r: 0.004, tint: FRAMING })
  if (capT) k.box('wood', [len, capT, fd], [cx, y1 - capT / 2, 0], { r: 0.004, tint: FRAMING })
  if (sillT) k.box('wood', [len, sillT, fd], [cx, y1 - sillT / 2, 0], { r: 0.004, tint: FRAMING })
  const n = Math.max(1, Math.round((len - STUD) / 0.6))
  for (let i = 0; i <= n; i++) {
    const x = x0 + STUD / 2 + i * (len - STUD) / n, s0 = y0 + lowT, s1 = o.profile ? top(x) - 0.04 - k.rnd() * 0.15 : y1 - capT - sillT
    if (s1 - s0 > 0.1) k.box('wood', [STUD, s1 - s0, fd], [x, (s0 + s1) / 2, 0], { r: 0.004, tint: [0.6, 0.46, 0.32] })
  }
  const tint: V3 = [0.62, 0.5, 0.38], zf = fd / 2 + 0.009
  const board = (a: number, b: number, by: number, bh: number) => k.box('wood', [b - a, bh, BOARD], [(a + b) / 2, by + bh / 2, zf], { pitch: -0.05, r: 0.003, tint, tone: 0.82 + k.rnd() * 0.3 })
  for (let by = y0; by < y1 - 0.03; by += 0.18) {
    const bh = Math.min(0.2, y1 - by)
    if (!o.profile) { board(x0, x1, by, bh); continue }
    let a: number | null = null
    for (let x = x0; x <= x1 + 1e-6; x += 0.05) {
      const clear = x < x1 - 1e-6 && top(x) > by + bh && top(Math.min(x1, x + 0.05)) > by + bh
      if (clear && a === null) a = x
      if (!clear && a !== null) { if (Math.min(x, x1) - a > 0.12) board(a, Math.min(x, x1), by, bh); a = null }
    }
  }
  const zb = -(fd / 2 + 0.009)
  for (let bx = x0; bx < x1 - 0.03; bx += 0.2) {
    const bw = Math.min(0.19, x1 - bx), xc = bx + bw / 2, bTop = o.profile ? top(xc) - k.rnd() * 0.12 : y1
    if (bTop - y0 < 0.1) continue
    k.box('wood', [bw, bTop - y0, BOARD], [xc, (y0 + bTop) / 2, zb], { r: 0.003, tint, tone: 0.82 + k.rnd() * 0.3 })
    if (bx + 0.2 < x1 - 0.02) k.box('wood', [0.04, bTop - y0 - 0.02, 0.012], [bx + 0.195, (y0 + bTop) / 2, zb - 0.015], { r: 0.003, tint, tone: 0.75 })
  }
}

export function block(k: Kit, m: WallMat, x0: number, x1: number, y0: number, y1: number, o: { header?: boolean; lintel?: boolean } = {}) {
  if (m === 'wood') timber(k, x0, x1, y0, y1, o)
  else masonry(k, m, x0, x1, y0, y1, o)
}

export function casing(k: Kit, m: WallMat, x0: number, x1: number, y0: number, y1: number, withSill: boolean) {
  const { d } = k, t = trimFor(m), cw = 0.07

  const foot = m !== 'wood' && y0 < 0.2 ? 0.2 : y0
  for (const sd of [-1, 1]) {
    const z = sd * (d / 2 + 0.004)
    for (const x of [x0 - cw / 2, x1 + cw / 2]) k.box(t.m, [cw, y1 - foot + cw, 0.016], [x, (foot + y1 + cw) / 2, z], { r: 0.004, tint: t.tint })
    k.box(t.m, [x1 - x0 + 2 * cw, cw, 0.016], [(x0 + x1) / 2, y1 + cw / 2, z], { r: 0.004, tint: t.tint })
    if (withSill) k.box(t.m, [x1 - x0, cw, 0.016], [(x0 + x1) / 2, y0 - cw / 2, z], { r: 0.004, tint: t.tint })
  }
}

export function sash(k: Kit, fm: Mat, tint: V3, cx: number, cy: number, sw: number, sh: number, o: { broken?: boolean } = {}) {
  const bar = 0.04, dep = 0.045, mun = 0.022, iw = sw - 2 * bar, ih = sh - 2 * bar
  k.frameRect(fm, sw, sh, bar, dep, [cx, cy, 0], { tint })
  k.box(fm, [mun, ih, dep * 0.6], [cx, cy, 0], { r: 0.002, tint })
  for (const sx of [-1, 1]) k.box(fm, [(iw - mun) / 2, mun, dep * 0.6], [cx + sx * (iw + mun) / 4, cy, 0], { r: 0.002, tint })
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    if (o.broken && sx + sy === 0) continue
    k.box('glass', [(iw - mun) / 2, (ih - mun) / 2, 0.006], [cx + sx * (iw + mun) / 4, cy + sy * (ih + mun) / 4, 0], { r: 0.001 })
  }
}

export function glazing(k: Kit, m: WallMat, x0: number, x1: number, sill: number, head: number, o: { sillStone?: boolean; broken?: number } = {}) {
  const { d } = k, t = trimFor(m), op = x1 - x0, cx = (x0 + x1) / 2, ft = 0.06, fdp = 0.09, oh = head - sill

  if (o.sillStone ?? m !== 'wood') k.box('concrete', [op + 0.12, 0.05, 0.07], [cx, sill - 0.025, d / 2 + 0.035], { r: 0.008, tint: COPING })
  for (const sd of [-1, 1]) k.box(t.m, [ft, oh, fdp], [cx + sd * (op / 2 - ft / 2), sill + oh / 2, 0], { r: 0.004, tint: t.tint })
  for (const y of [sill + ft / 2, head - ft / 2]) k.box(t.m, [op - 2 * ft, ft, fdp], [cx, y, 0], { r: 0.004, tint: t.tint })
  const n = op < 1.3 ? 1 : op < 2.4 ? 2 : 3, iw = op - 2 * ft, ih = oh - 2 * ft, mull = 0.05, sw = (iw - (n - 1) * mull) / n
  for (let i = 1; i < n; i++) k.box(t.m, [mull, ih, fdp - 0.01], [cx - iw / 2 + i * (sw + mull) - mull / 2, sill + oh / 2, 0], { r: 0.003, tint: t.tint })
  for (let i = 0; i < n; i++) sash(k, t.m, t.tint, cx - iw / 2 + sw / 2 + i * (sw + mull), sill + oh / 2, sw, ih, { broken: o.broken === i })
}

export function rubble(k: Kit, m: WallMat, w: number, count: number) {
  for (let i = 0; i < count; i++) {
    const sd = i % 2 ? 1 : -1, x = -w / 2 + 0.2 + k.rnd() * (w - 0.4)
    if (m === 'wood') { k.box('wood', [0.3 + k.rnd() * 0.3, 0.02, 0.08], [x, 0.01, sd * 0.12], { yaw: k.jitter(0.05), r: 0.003, tint: [0.55, 0.42, 0.3] }); continue }
    const sx = m === 'brick' ? (k.chance(0.5) ? 0.215 : 0.11) : 0.1 + k.rnd() * 0.1, sy = m === 'brick' ? 0.065 : 0.05 + k.rnd() * 0.04
    k.box(m, [sx, sy, 0.07], [x, sy / 2, sd * 0.12], { yaw: k.jitter(0.2), roll: k.jitter(0.04), r: m === 'brick' ? 0.004 : 0.012, tone: 0.8 + k.rnd() * 0.2 })
  }
}

export const ARCHITECTURE: Family = {
  wall: (k, s) => {
    const { w, h } = k
    block(k, wallMat(s.material), -w / 2, w / 2, 0, h)
  },

  doorway: (k, s) => {
    const { w, h, d } = k, m = wallMat(s.material), op = Math.min(1.4, w - 0.5), head = 2.3, t = trimFor(m)
    block(k, m, -w / 2, -op / 2, 0, h)
    block(k, m, op / 2, w / 2, 0, h)

    block(k, m, -op / 2, op / 2, m === 'brick' ? head + 0.16 : head, h, { header: true })
    if (m === 'brick') k.box('concrete', [op + 0.3, 0.16, d - 0.002], [0, head + 0.08, 0], { r: 0.006, tint: COPING })

    k.box('concrete', [op + 0.02, 0.03, d + 0.05], [0, 0.015, 0], { r: 0.006, tint: PLINTH })
    for (const sd of [-1, 1]) k.box(t.m, [0.05, head - 0.03, d + 0.01], [sd * (op / 2 - 0.025), 0.03 + (head - 0.03) / 2, 0], { r: 0.004, tint: t.tint })
    k.box(t.m, [op - 0.1, 0.05, d + 0.01], [0, head - 0.025, 0], { r: 0.004, tint: t.tint })
    casing(k, m, -op / 2, op / 2, 0, head, false)
  },

  window: (k, s) => {
    const { w, h, d } = k, m = wallMat(s.material), sill = 0.85, head = 2.2, op = w - 0.9
    block(k, m, -w / 2, w / 2, 0, sill)
    block(k, m, -w / 2, -op / 2, sill, h)
    block(k, m, op / 2, w / 2, sill, h)
    block(k, m, -op / 2, op / 2, m === 'brick' ? head + 0.16 : head, h, { header: true })
    if (m === 'brick') k.box('concrete', [op + 0.3, 0.16, d - 0.002], [0, head + 0.08, 0], { r: 0.006, tint: COPING })
    glazing(k, m, -op / 2, op / 2, sill, head, { broken: m === 'concrete' && s.variant === 2 ? 1 : undefined })
    if (m === 'wood') casing(k, m, -op / 2, op / 2, sill, head, true)
  },

  'broken-wall': (k, s) => {
    const { w, h, d } = k, m = wallMat(s.material)

    const rng = random(hash(s.id)), heights = Array.from({ length: 8 }, () => 0.5 + rng() * (h - 0.7))
    const f = (x: number) => { const t = Math.max(0, Math.min(6.9999, (x + w / 2) / (w / 7))), i = Math.floor(t), u = t - i; return heights[i] * (1 - u) + heights[i + 1] * u }
    if (m === 'wood') {
      timber(k, -w / 2, w / 2, 0, h, { profile: f })
      rubble(k, m, w, 4)
      return
    }
    const top: V2[] = []
    if (m === 'brick') {
      for (let x = w / 2; x > -w / 2 + 1e-6; x -= 0.1125) { const y = Math.max(0.3, Math.floor(f(x - 0.056) / 0.075) * 0.075); top.push([x, y], [Math.max(-w / 2, x - 0.1125), y]) }
    } else {
      const n = Math.ceil(w / 0.06)
      for (let i = 0; i <= n; i++) { const x = w / 2 - i * w / n; top.push([x, Math.max(0.3, f(x) + k.jitter(0.035))]) }
    }
    k.extrude(m, [[-w / 2, 0], [w / 2, 0], ...top], d, [0, 0, 0], { bevel: 0.003, bevelSeg: 1 })

    k.box('concrete', [w - 0.004, 0.2, d + 0.024], [0, 0.1, 0], { r: 0.006, tint: PLINTH })
    if (m === 'concrete') {

      for (let x = -w / 2 + 0.12; x < w / 2 - 0.1; x += 0.2) for (const z of [-1, 1]) {
        if (k.chance(0.3)) continue
        const y = f(x), lean = k.jitter(0.12)
        k.tube('steel', [[x, y - 0.12, z * (d / 2 - 0.035)], [x, y + 0.04, z * (d / 2 - 0.035)], [x + lean, y + 0.1 + k.rnd() * 0.18, z * (d / 2 - 0.035) + k.jitter(0.02)]], 0.006, { seg: 6, fillet: 0.04, tint: [0.45, 0.32, 0.25] })
      }
    }
    rubble(k, m, w, 6)
  },
}
