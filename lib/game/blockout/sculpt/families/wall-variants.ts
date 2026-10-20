import { fbm3, type Family, type Kit, type V2, type V3 } from '../kit'
import { COPING, PLINTH, casing, glazing, masonry, rubble, timber } from './architecture'

const SILL = 0.85, HEAD = 2.2

function clip(poly: V2[], a: number, b: number, c: number): V2[] {
  const out: V2[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = a * p[0] + b * p[1] + c, sq = a * q[0] + b * q[1] + c
    if (sp >= 0) out.push(p)
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]) }
  }
  return out
}
const area = (poly: V2[]) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1] }, 0)) / 2
const rect = (x0: number, y0: number, x1: number, y1: number): V2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const blob = (k: Kit, cx: number, cy: number, rx: number, ry: number, n = 9): V2[] => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + Math.cos(a) * rx * (0.7 + k.rnd() * 0.3), cy + Math.sin(a) * ry * (0.7 + k.rnd() * 0.3)] as V2 })

function rendered(k: Kit, x0: number, x1: number, y0: number, y1: number, tint: V3, spalls = 0.5) {
  const { h, d } = k, len = x1 - x0, cx = (x0 + x1) / 2, skin = 0.014, base = y0 < 1e-6, cap = y1 > h - 1e-6
  const c0 = base ? 0.25 : y0, c1 = cap ? y1 - 0.08 : y1
  k.box('brick', [len, c1 - c0, d - 2 * skin], [cx, (c0 + c1) / 2, 0], { r: 0.002 })
  if (base) k.box('concrete', [len, 0.25, d + 0.024], [cx, 0.125, 0], { r: 0.006, tint: PLINTH })
  if (cap) k.box('plaster', [len, 0.08, d + 0.05], [cx, h - 0.04, 0], { r: 0.01, tint })
  for (const sd of [-1, 1]) {
    const holes: V2[][] = []
    if (len > 0.7 && c1 - c0 > 0.7 && k.chance(spalls)) {
      const rx = Math.min(0.4, len * 0.3), ry = Math.min(0.3, (c1 - c0) * 0.3)
      const hx = x0 + rx + 0.08 + k.rnd() * (len - 2 * rx - 0.16), hy = c0 + ry + 0.08 + k.rnd() * (c1 - c0 - 2 * ry - 0.16)
      holes.push(blob(k, hx, hy, rx, ry, 10).reverse())

      for (let i = 0; i < 4; i++) {
        const bx = hx + k.jitter(rx * 0.4), by = Math.round((hy + k.jitter(ry * 0.4)) / 0.075) * 0.075
        k.box('brick', [0.2, 0.06, 0.008], [bx, by, sd * (d / 2 - skin + 0.004)], { r: 0.002, tone: 0.75 + k.rnd() * 0.3 })
      }
    }
    k.extrude('plaster', rect(x0, c0, x1, c1), skin, [0, 0, sd * (d / 2 - skin / 2)], { holes, bevel: 0.002, bevelSeg: 1, tint })
  }
}

function arch(k: Kit, op: number, rise: number, spring: number, o: { keystone?: boolean; skip?: number; drop?: number } = {}) {
  const { w, h, d } = k, depth = 0.215
  const R = (op * op / 4 + rise * rise) / (2 * rise), cy = spring + rise - R, phi = Math.asin(op / 2 / R)
  const at = (r: number, a: number): V2 => [r * Math.sin(a), cy + r * Math.cos(a)]
  const n = Math.max(7, Math.round(2 * phi * R / 0.078) | 1), step = 2 * phi / n, gap = 0.009 / R

  for (let i = 1; i < n; i++) {
    const a = -phi + i * step
    k.extrude('plaster', [at(R, a - gap / 2), at(R, a + gap / 2), at(R + depth, a + gap / 2), at(R + depth, a - gap / 2)], d - 0.02, [0, 0, 0], { tint: [0.74, 0.7, 0.62] })
  }
  for (let i = 0; i < n; i++) {
    if (i === o.skip) continue
    const a0 = -phi + i * step + gap / 2, a1 = -phi + (i + 1) * step - gap / 2
    if (o.keystone && i === (n - 1) / 2) {
      const drop = o.drop ?? 0
      const pts = [at(R - 0.03, a0 - gap / 2), at(R - 0.03, a1 + gap / 2), at(R + depth, a1 + gap / 2), at(R + depth, a0 - gap / 2)].map(([x, y]) => [x, y - drop] as V2)
      k.extrude('concrete', pts, d + 0.03, [0, 0, 0], { bevel: 0.006, bevelSeg: 2, tint: COPING })
      continue
    }
    k.extrude('brick', [at(R, a0), at(R, a1), at(R + depth, a1), at(R + depth, a0)], d + 0.006, [0, 0, 0], { bevel: 0.003, bevelSeg: 1, tone: 0.85 + k.rnd() * 0.25 })
  }
  const header: V2[] = [[-w / 2, spring], [-op / 2, spring]]
  for (let i = 0; i <= 24; i++) header.push(at(R + depth, -phi + 2 * phi * i / 24))
  header.push([op / 2, spring], [w / 2, spring], [w / 2, h - 0.05], [-w / 2, h - 0.05])
  k.extrude('brick', header, d, [0, 0, 0], { bevel: 0.003, bevelSeg: 1 })
  k.box('concrete', [w, 0.05, d + 0.04], [0, h - 0.025, 0], { r: 0.008, tint: COPING })
  return { R, cy, phi, at }
}

function louvred(k: Kit, c: V3, lw: number, lh: number, tint: V3, roll = 0) {
  k.frame({ at: c, roll }, () => {
    const st = 0.05, rl = 0.06, dep = 0.028
    for (const sx of [-1, 1]) k.box('wood', [st, lh, dep], [sx * (lw - st) / 2, 0, 0], { r: 0.004, tint })
    for (const y of [-1, 0, 1]) k.box('wood', [lw - 2 * st, rl, dep], [0, y * (lh - rl) / 2, 0], { r: 0.004, tint })
    for (const [p0, p1] of [[-lh / 2 + rl, -rl / 2], [rl / 2, lh / 2 - rl]]) {
      const count = Math.floor((p1 - p0) / 0.04), pitch = (p1 - p0) / count
      for (let i = 0; i < count; i++) k.box('wood', [lw - 2 * st, 0.042, 0.007], [0, p0 + (i + 0.5) * pitch, 0], { pitch: 0.75, r: 0.002, tint, tone: 0.85 + k.rnd() * 0.2 })
    }
  })
}

export const WALL_VARIANTS: Family = {
  'plank-wall': (k, s) => {
    const { w, h, d } = k, v = s.variant, bt = 0.022, sd = 0.14, front = d / 2, zs = front - bt - sd / 2, zb = front - bt / 2
    const frame: V3 = [0.58, 0.45, 0.32], s0 = 0.165, s1 = h - 0.09, by0 = 0.125
    k.box('concrete', [w, 0.12, d], [0, 0.06, 0], { r: 0.008, tint: PLINTH })
    k.box('wood', [w, 0.045, sd], [0, 0.1425, zs], { r: 0.004, tint: frame })
    k.box('wood', [w, 0.09, sd], [0, h - 0.045, zs], { r: 0.004, tint: frame })
    const n = Math.max(2, Math.round(w / 0.6)), studs = Array.from({ length: n }, (_, i) => -w / 2 + (i + 0.5) * w / n)
    for (const x of studs) k.box('wood', [0.045, s1 - s0, sd], [x, (s0 + s1) / 2, zs], { r: 0.004, tint: frame })

    const bx = w / 2 - 0.2, ya = s0 + 0.08, yb = s1 - 0.08, ang = Math.atan2(yb - ya, 2 * bx) * (v === 1 ? -1 : 1)
    k.box('wood', [Math.hypot(2 * bx, yb - ya) - 0.1, 0.09, bt], [0, (ya + yb) / 2, zs - sd / 2 - bt / 2], { roll: ang, r: 0.003, tint: frame })

    if (v !== 1) {
      const edges = [-w / 2, ...studs.flatMap((x) => [x - 0.0225, x + 0.0225]), w / 2]
      for (const y of [1.05, 2.05]) for (let i = 0; i < edges.length; i += 2) if (edges[i + 1] - edges[i] > 0.05) k.box('wood', [edges[i + 1] - edges[i], 0.09, 0.045], [(edges[i] + edges[i + 1]) / 2, y, front - bt - 0.0225], { r: 0.004, tint: frame })
    }
    if (v === 0) {

      const nb = Math.round(w / 0.2), bw = w / nb
      for (let i = 0; i < nb; i++) {
        const top = h - k.rnd() * 0.012, bot = by0 + k.rnd() * 0.01
        k.box('wood', [bw - 0.008, top - bot, bt], [-w / 2 + (i + 0.5) * bw, (top + bot) / 2, zb], { r: 0.003, grain: 1, tone: 0.8 + k.rnd() * 0.3 })
      }
      for (let i = 1; i < nb; i++) {
        const x = -w / 2 + i * bw
        k.box('wood', [0.05, h - by0 - 0.03, 0.016], [x, (h + by0) / 2 - 0.01, front + 0.008], { r: 0.003, grain: 1, tone: 0.72 + k.rnd() * 0.3 })
        for (const y of [0.5, 1.05, 2.05, 2.75]) k.rivet([x, y, front + 0.016], { r: 0.0035 })
      }
    } else if (v === 1) {

      for (let y = by0; y < h - 0.05; y += 0.168) {
        const bh = Math.min(0.16, h - y)
        k.box('wood', [w, bh, bt], [0, y + bh / 2, zb], { r: 0.004, grain: 0, tone: 0.8 + k.rnd() * 0.3 })
        for (const x of studs) k.rivet([x, y + bh / 2, front], { r: 0.0035 })
      }
    } else {

      let x = -w / 2, i = 0, missing = 0
      const gone = 2 + Math.floor(k.rnd() * Math.max(1, Math.round(w / 0.24) - 4)), snapped = gone + 2
      while (x < w / 2 - 0.05) {
        const bw = Math.min(w / 2 - x, 0.18 + k.rnd() * 0.12), gap = Math.min(bw * 0.2, 0.008 + k.rnd() * 0.012), cx = x + (bw - gap) / 2
        if (i === gone) missing = cx
        else {
          const top = i === snapped ? 1.2 + k.rnd() * 0.6 : h - k.rnd() * 0.02
          k.box('wood', [bw - gap, top - by0, bt], [cx, (top + by0) / 2, zb], { r: 0.004, grain: 1, tone: 0.62 + k.rnd() * 0.35, tint: [0.78, 0.7, 0.62] })
          for (const y of [1.05, 2.05]) if (y < top - 0.05) k.rivet([cx, y, front], { r: 0.0035 })
        }
        x += bw; i++
      }
      if (missing) {
        k.box('wood', [0.46, 0.62, 0.012], [missing, 1.65, front + 0.006], { r: 0.002, roll: 0.03, tint: [0.9, 0.78, 0.6] })
        for (const [px, py] of [[-0.2, -0.27], [0.2, -0.27], [-0.2, 0.27], [0.2, 0.27]]) k.rivet([missing + px, 1.65 + py, front + 0.012], { r: 0.0035 })
      }
    }
  },

  'log-wall': (k, s) => {
    const { w, h, d } = k, v = s.variant, sill = 0.18
    k.box('concrete', [w, sill, d + 0.02], [0, sill / 2, 0], { r: 0.012, tint: PLINTH })
    if (v === 1) {

      const n = Math.round((h - sill) / 0.19), p = (h - sill) / n
      for (let i = 0; i < n; i++) {
        const lh = i === n - 1 ? p : p - 0.03, y = sill + i * p + lh / 2
        k.box('wood', [w, lh, d - 0.01], [0, y, 0], { r: 0.022, tint: [0.8, 0.63, 0.46], tone: 0.85 + k.rnd() * 0.25, seg: [Math.ceil(w / 0.06), 2, 1], disp: (f, s0) => (f === 4 || f === 5 ? Math.sin(s0 * 13 + i * 2) * 0.0018 + Math.sin(s0 * 41 + i) * 0.0008 : 0) })
        if (i < n - 1) k.box('plaster', [w, 0.04, d - 0.05], [0, sill + (i + 1) * p - 0.015, 0], { r: 0.004, tint: [0.88, 0.85, 0.78] })
      }
      return
    }
    const r = d / 2 - 0.004, n = Math.round((h - sill - 1.75 * r) / 0.17) + 1, c0 = sill + r * 0.8, c1 = h - r * 0.95, pitch = (c1 - c0) / (n - 1)
    for (let i = 0; i < n; i++) {
      const y = c0 + i * pitch, mossy = v === 2 && i < 2
      const tint: V3 = mossy ? [0.55, 0.58, 0.4] : v === 2 ? [0.6, 0.53, 0.46] : [0.8, 0.63, 0.46]
      const rot = v === 2 && i === 3

      const end = w / 2 - (i % 2) * 0.0012, prof: V2[] = [[0, -end]]
      for (let j = 0; j <= 18; j++) {
        const t = j / 18, dip = rot ? 1 - 0.22 * Math.exp(-(((t - 0.4) / 0.12) ** 2)) : 1
        prof.push([r * dip * (1 + 0.03 * Math.sin(t * 9 + i) + 0.015 * Math.sin(t * 23 + i * 3)), -end + 2 * end * t])
      }
      prof.push([0, end])
      k.lathe('wood', prof, [0, y, 0], { axis: 'x', seg: 18, crease: 40, tint: rot ? [0.42, 0.36, 0.3] : tint, tone: 0.85 + k.rnd() * 0.25, wear: (x, yy, z) => (fbm3(x * 20, yy * 5, z * 20, i) - 0.5) * 0.01 })
      if (i === n - 1) continue

      for (const sd of [-1, 1]) {
        let x = -w / 2
        while (x < w / 2 - 0.01) {
          const len = Math.min(w / 2 - x, 0.4 + k.rnd() * 0.8)
          if (!(v === 2 && k.chance(0.2))) k.box('plaster', [len, 0.05, 0.03], [x + len / 2, y + pitch / 2, sd * r * 0.72], { r: 0.008, tint: v === 2 ? [0.72, 0.68, 0.6] : [0.9, 0.87, 0.8], tone: 0.9 + k.rnd() * 0.15 })
          x += len
        }
      }
    }
  },

  'boarded-window': (k, s) => {
    const { w, d } = k, v = s.variant, op = w - 0.9, oh = HEAD - SILL
    timber(k, -w / 2, w / 2, 0, SILL)
    timber(k, -w / 2, -op / 2, SILL, k.h)
    timber(k, op / 2, w / 2, SILL, k.h)
    timber(k, -op / 2, op / 2, HEAD, k.h, { header: true })
    glazing(k, 'wood', -op / 2, op / 2, SILL, HEAD, { broken: v })
    casing(k, 'wood', -op / 2, op / 2, SILL, HEAD, true)

    const th = 0.018, z = d / 2 + 0.004 + 0.008 + th / 2, wid = 0.15
    const layout: [number, number, number][] = v === 0 ? [[0.16, 0, 0], [0.39, 0.02, 0], [0.62, -0.015, 0], [0.85, 0.01, 0]]
      : v === 1 ? [[0.14, 0, 0], [0.86, 0, 0], [0.5, 1, 1], [0.5, -1, 2]]
      : [[0.18, 0.07, 0], [0.42, -0.06, 0], [0.68, 0.09, 0], [0.62, 0.55, 1]]
    for (const [f, tilt, layer] of layout) {
      const diag = Math.abs(tilt) === 1, roll = diag ? tilt * Math.atan2(oh - 0.1, op) : tilt
      const len = diag ? Math.hypot(op, oh - 0.1) : Math.abs(roll) > 0.3 ? 0.8 : op + 0.2
      k.plank('wood', len, wid, th, [0, SILL + f * oh, z + layer * th], { face: true, roll, nails: true, tint: [0.75, 0.64, 0.52] })
    }
  },

  'shutter-window': (k, s) => {
    const { w, h, d } = k, v = s.variant, op = w - 0.9, lime: V3 = [0.95, 0.9, 0.8]
    rendered(k, -w / 2, w / 2, 0, SILL, lime)
    rendered(k, -w / 2, -op / 2, SILL, h, lime)
    rendered(k, op / 2, w / 2, SILL, h, lime)
    rendered(k, -op / 2, op / 2, HEAD, h, lime, 0)
    glazing(k, 'brick', -op / 2, op / 2, SILL, HEAD, { broken: v === 1 ? 1 : undefined })

    for (const sx of [-1, 1]) k.box('plaster', [0.12, HEAD - SILL, 0.02], [sx * (op / 2 + 0.06), (SILL + HEAD) / 2, d / 2 + 0.01], { r: 0.006, tint: [1, 0.97, 0.9] })
    k.box('plaster', [op + 0.24, 0.12, 0.02], [0, HEAD + 0.06, d / 2 + 0.01], { r: 0.006, tint: [1, 0.97, 0.9] })

    const tint: V3 = v === 0 ? [0.42, 0.56, 0.5] : v === 1 ? [0.38, 0.45, 0.62] : [0.6, 0.55, 0.47]
    const lw = (op - 0.008) / 2, lh = HEAD - SILL - 0.02, zc = 0.07
    for (const sx of [-1, 1]) {
      if (v === 1 && sx > 0) continue
      const hanging = v === 2 && sx > 0
      const leafH = hanging ? lh - 0.06 : lh, cx = sx * (lw / 2 + 0.002), cy = HEAD - 0.01 - leafH / 2
      if (hanging) {

        const px = sx * (op / 2 - 0.004), py = HEAD - 0.2, a = sx * 0.07, dx = cx - px, dy = cy - py
        louvred(k, [px + dx * Math.cos(a) - dy * Math.sin(a), py + dx * Math.sin(a) + dy * Math.cos(a), zc], lw, leafH, tint, a)
      } else louvred(k, [cx, cy, zc], lw, leafH, tint)
      for (const y of [SILL + 0.2, HEAD - 0.2]) k.cyl('steel', 0.008, 0.08, [sx * (op / 2 - 0.004), y, zc + 0.006], { seg: 10, tint: [0.25, 0.24, 0.23] })
    }
  },

  'arched-window': (k, s) => {
    const { w, d } = k, v = s.variant, op = w - 0.9, rise = Math.min(0.32, op * 0.18)
    masonry(k, 'brick', -w / 2, w / 2, 0, SILL)
    masonry(k, 'brick', -w / 2, -op / 2, SILL, HEAD)
    masonry(k, 'brick', op / 2, w / 2, SILL, HEAD)
    const { R, cy, phi, at } = arch(k, op, rise, HEAD, { keystone: true, skip: v === 2 ? 1 : undefined })
    glazing(k, 'brick', -op / 2, op / 2, SILL, HEAD, { broken: v === 2 ? 0 : undefined })

    const inner = R - 0.05, phiIn = Math.acos((HEAD - cy) / inner), band: V2[] = [], glass: V2[] = []
    for (let i = 0; i <= 20; i++) band.push(at(R, -phi + 2 * phi * i / 20))
    for (let i = 20; i >= 0; i--) { const p = at(inner, -phiIn + 2 * phiIn * i / 20); band.push(p); glass.push(p) }
    k.extrude('wood', band, 0.09, [0, 0, 0], { bevel: 0.004, bevelSeg: 1, tint: [0.92, 0.9, 0.86] })
    k.extrude('glass', glass, 0.006, [0, 0, 0])
    if (v === 1) for (const sx of [-1, 1]) k.box('steel', [0.012, 0.3, 0.012], [sx * 0.02, HEAD + 0.15, d / 2 + 0.03], { r: 0.003 })
  },

  'corrugated-wall': (k, s) => {
    const { w, h } = k, v = s.variant, tim: V3 = [0.6, 0.47, 0.34]
    k.box('concrete', [w, 0.2, 0.17], [0, 0.1, -0.015], { r: 0.008, tint: PLINTH })
    const posts = w > 3.2 ? [-w / 3, 0, w / 3] : w > 2.5 ? [-w / 4, w / 4] : [0], pz = -0.005
    for (const x of posts) k.box('wood', [0.1, h - 0.29, 0.1], [x, 0.2 + (h - 0.29) / 2, pz], { r: 0.005, tint: tim })
    k.box('wood', [w, 0.09, 0.1], [0, h - 0.045, pz], { r: 0.005, tint: tim })
    const girtT = 0.03, gz = pz + 0.05 + girtT / 2, girts = [0.45, 1.5, 2.55]
    for (const y of girts) k.box('wood', [w, 0.09, girtT], [0, y, gz], { r: 0.004, tint: tim })

    const rib = 0.076, amp = 0.009, zv = pz + 0.05 + girtT, cover = rib * 9, sh = h - 0.07, cy = 0.06 + sh / 2
    const paint: V3 = v === 1 ? [0.66, 0.26, 0.2] : v === 2 ? [0.62, 0.44, 0.32] : [1, 1, 1]
    const count = Math.ceil((w - 0.02) / cover)
    let i = 0
    for (let x0 = -w / 2; x0 < w / 2 - 0.02; x0 += cover, i++) {

      const loose = v === 2 && i === count - 1, x1 = Math.min(w / 2, x0 + cover + rib), sw = x1 - x0, cx = (x0 + x1) / 2, lap = loose ? 0.005 : i % 2 ? 0.0025 : 0
      if (v === 2 && i === 1 && count > 2) continue

      const dents: [number, number, number][] = v === 2 ? [[k.jitter(Math.max(0, sw / 2 - 0.25)), k.jitter(sh * 0.3), 0.012 + k.rnd() * 0.01]] : []
      const fy = (lx: number, lz: number) => {
        let y = amp * -Math.cos(2 * Math.PI * (cx + lx + w / 2) / rib) + amp
        for (const [dx, dz, a] of dents) y -= a * Math.exp(-((lx - dx) ** 2 + (lz - dz) ** 2) / 0.02)
        if (loose) y += 0.07 * Math.max(0, (lz - sh / 2 + 0.6) / 0.6) ** 2
        return y
      }
      k.sheet('steel', sw, sh, fy, [cx, cy, zv + lap + 0.0012], { pitch: Math.PI / 2, nx: Math.ceil(sw / (rib / 8)), nz: v === 2 ? 30 : 4, thickness: 0.0012, tint: paint, tone: 0.85 + k.rnd() * 0.2 })

      for (let xv = Math.ceil((x0 + w / 2) / rib) * rib - w / 2; xv < x1 - 0.02; xv += 2 * rib) for (const y of girts) {
        if (xv < x0 + 0.02 || (loose && y < 1)) continue
        k.rivet([xv, y, zv + lap + 0.0012], { r: 0.005, m: 'steel' })
      }
    }

    k.box('steel', [w, 0.003, 0.178], [0, h + 0.0015, 0.012], { r: 0.001, tint: paint })
    k.box('steel', [w, 0.07, 0.003], [0, h - 0.035, zv + 2 * amp + 0.0075], { r: 0.001, tint: paint })
  },

  'half-timber-wall': (k, s) => {
    const { w, h, d } = k, v = s.variant, T = 0.14, beam = 0.16, base = 0.3, oak: V3 = [0.42, 0.3, 0.2], lime: V3 = [0.96, 0.93, 0.85]
    k.box('concrete', [w, base, d + 0.03], [0, base / 2, 0], { r: 0.01, tint: PLINTH })
    k.box('wood', [w, beam, d], [0, base + beam / 2, 0], { r: 0.006, tint: oak })
    k.box('wood', [w, beam, d], [0, h - beam / 2, 0], { r: 0.006, tint: oak })
    const y0 = base + beam, y1 = h - beam, rail = y0 + (y1 - y0) * 0.45, railH = 0.12
    const bays = Math.max(2, Math.round(w / 1.15)), bw = w / bays, posts: [number, number][] = []

    for (let i = 0; i <= bays; i++) {
      const x = -w / 2 + i * bw, x0 = i === 0 ? x : x - T / 2, x1 = i === bays ? x : x + T / 2
      posts.push([x0, x1])
      k.box('wood', [x1 - x0, y1 - y0, d], [(x0 + x1) / 2, (y0 + y1) / 2, 0], { r: 0.006, tint: oak, tone: 0.85 + k.rnd() * 0.2 })
    }
    const peg = (x: number, y: number) => { for (const sd of [-1, 1]) k.cyl('wood', 0.011, 0.008, [x, y, sd * (d / 2 + 0.002)], { axis: 'z', seg: 10, tint: [0.3, 0.21, 0.14] }) }
    const timberPoly = (poly: V2[]) => { if (area(poly) > 0.002) k.extrude('wood', poly, d, [0, 0, 0], { bevel: 0.004, bevelSeg: 1, tint: oak, tone: 0.85 + k.rnd() * 0.2 }) }
    const infill = (poly: V2[]) => { if (area(poly) > 0.004) k.extrude('plaster', poly, d - 0.012, [0, 0, 0], { bevel: 0.004, bevelSeg: 1, tint: lime, tone: 0.92 + k.rnd() * 0.1 }) }
    const hb = 0.065
    const band = (p: V2, q: V2) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = -(q[1] - p[1]) / l, ny = (q[0] - p[0]) / l; return { nx, ny, c: -(nx * p[0] + ny * p[1]) } }
    for (let i = 0; i < bays; i++) {
      const xa = posts[i][1], xb = posts[i + 1][0]
      k.box('wood', [xb - xa, railH, d], [(xa + xb) / 2, rail, 0], { r: 0.006, tint: oak })
      peg(xa + 0.03, rail); peg(xb - 0.03, rail)
      for (const [ya, yb, lower] of [[y0, rail - railH / 2, true], [rail + railH / 2, y1, false]] as const) {
        const panel = rect(xa, ya, xb, yb)
        const wattle = v === 2 && !lower && i === Math.min(1, bays - 1)
        if (wattle) {

          const staves: number[] = []
          for (let x = xa + 0.08; x < xb - 0.05; x += 0.12) { staves.push(x); k.cyl('wood', 0.009, yb - ya + 0.02, [x, (ya + yb) / 2, 0], { seg: 8, tint: [0.55, 0.45, 0.32] }) }
          for (let y = ya + 0.05, row = 0; y < yb - 0.03; y += 0.07, row++) {
            const pts: V3[] = [[xa, y, 0]]
            staves.forEach((x, j) => pts.push([x, y, ((j + row) % 2 ? 1 : -1) * 0.015]))
            pts.push([xb, y, 0])
            k.tube('wood', pts, 0.007, { seg: 6, fillet: 0.03, tint: [0.6, 0.5, 0.36] })
          }
          for (const [cx, cy] of [[xa + 0.1, ya + 0.08], [xb - 0.12, yb - 0.1], [xa + 0.08, yb - 0.15]]) k.extrude('plaster', blob(k, cx, cy, 0.09, 0.07), 0.07, [0, 0, 0], { bevel: 0.01, bevelSeg: 2, tint: [0.85, 0.8, 0.7] })
          continue
        }
        const kind = lower ? (v === 1 ? 'x' : 'diag') : v === 1 && i % 2 ? 'diag' : 'none'
        if (kind === 'none') { infill(panel); continue }
        const lean = (i < bays / 2) === lower ? 1 : -1
        const p: V2 = lean > 0 ? [xa, ya] : [xb, ya], q: V2 = lean > 0 ? [xb, yb] : [xa, yb], b1 = band(p, q)
        const inBand = (poly: V2[], b: { nx: number; ny: number; c: number }) => clip(clip(poly, b.nx, b.ny, b.c + hb), -b.nx, -b.ny, -b.c + hb)
        timberPoly(inBand(panel, b1))
        if (kind === 'diag') {
          infill(clip(panel, b1.nx, b1.ny, b1.c - hb))
          infill(clip(panel, -b1.nx, -b1.ny, -b1.c - hb))
          continue
        }

        const b2 = band(lean > 0 ? [xb, ya] : [xa, ya], lean > 0 ? [xa, yb] : [xb, yb]), cross = inBand(panel, b2)
        timberPoly(clip(cross, b1.nx, b1.ny, b1.c - hb))
        timberPoly(clip(cross, -b1.nx, -b1.ny, -b1.c - hb))
        for (const s1 of [1, -1]) for (const s2 of [1, -1]) infill(clip(clip(panel, s1 * b1.nx, s1 * b1.ny, s1 * b1.c - hb), s2 * b2.nx, s2 * b2.ny, s2 * b2.c - hb))
      }
    }
    if (v === 2) for (let i = 0; i < 5; i++) k.extrude('plaster', blob(k, 0, 0, 0.05 + k.rnd() * 0.04, 0.04), 0.03, [k.jitter(w * 0.35), 0.015, d / 2 + 0.04], { axis: 'y', bevel: 0.008, bevelSeg: 1, yaw: k.rnd() * 3, tint: [0.88, 0.84, 0.75] })
  },

  'cobogo-wall': (k, s) => {
    const { w, h, d } = k, v = s.variant, low = 0.8, beam = 0.15, cell = 0.2
    const tint: V3 = v === 1 ? [0.98, 0.97, 0.94] : v === 2 ? [0.72, 0.7, 0.66] : [0.86, 0.85, 0.82]

    k.box('concrete', [w, low, d - 0.008], [0, low / 2, 0], { r: 0.003, tint })
    for (const sd of [-1, 1]) for (let row = 0; row < 4; row++) for (let x = -w / 2 - (row % 2 ? 0.2 : 0); x < w / 2 - 0.01; x += 0.4) {
      const a = Math.max(-w / 2, x) + 0.005, b = Math.min(w / 2, x + 0.4) - 0.005
      if (b - a > 0.05) k.box('concrete', [b - a, 0.19, 0.008], [(a + b) / 2, row * 0.2 + 0.1, sd * (d / 2 - 0.004)], { r: 0.003, tint, tone: 0.88 + k.rnd() * 0.15 })
    }
    k.box('concrete', [w, beam, d], [0, low + beam / 2, 0], { r: 0.006, tint })

    const y0 = low + beam, rows = Math.floor((h - y0 - 0.2) / cell), cols = Math.round(w / cell), cw = w / cols, top = y0 + rows * cell
    const holesAt = (cx: number, cy: number): V2[][] => {
      if (v === 0) return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => Array.from({ length: 10 }, (_, i) => { const a = -i / 10 * Math.PI * 2; return [cx + sx * 0.048 + Math.cos(a) * 0.036, cy + sy * 0.048 + Math.sin(a) * 0.036] as V2 }))
      if (v === 1) {
        const tri = (sx: number, sy: number): V2[] => { const ox = cx + sx * 0.078, oy = cy + sy * 0.078, list: V2[] = [[ox, oy], [ox - sx * 0.04, oy], [ox, oy - sy * 0.04]]; return sx * sy > 0 ? list : list.reverse() }
        return [[[cx, cy - 0.062], [cx - 0.062, cy], [cx, cy + 0.062], [cx + 0.062, cy]], tri(-1, -1), tri(1, -1), tri(1, 1), tri(-1, 1)]
      }
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => { const ox = cx + sx * 0.047, oy = cy + sy * 0.047, q = 0.032, c = 0.01; return ([[ox - q + c, oy - q], [ox - q, oy - q + c], [ox - q, oy + q - c], [ox - q + c, oy + q], [ox + q - c, oy + q], [ox + q, oy + q - c], [ox + q, oy - q + c], [ox + q - c, oy - q]] as V2[]) })
    }
    const broken = new Set<number>()
    if (v === 2) for (let i = 0; i < 6; i++) broken.add((1 + Math.floor(k.rnd() * (rows - 1))) * cols + Math.floor(k.rnd() * cols))
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (broken.has(r * cols + c)) continue
      const cx = -w / 2 + (c + 0.5) * cw, cy = y0 + (r + 0.5) * cell
      k.extrude('concrete', rect(cx - cw / 2, cy - cell / 2, cx + cw / 2, cy + cell / 2), 0.12, [0, 0, 0], { holes: holesAt(cx, cy), bevel: 0.003, bevelSeg: 1, curveSeg: 4, tint, tone: 0.9 + k.rnd() * 0.12 })
    }
    k.box('concrete', [w, h - top, d], [0, (h + top) / 2, 0], { r: 0.006, tint })
    if (v === 2) for (let i = 0; i < 6; i++) k.box('concrete', [0.05 + k.rnd() * 0.07, 0.02 + k.rnd() * 0.02, 0.04 + k.rnd() * 0.05], [k.jitter(w * 0.4), 0.015, (k.chance(0.5) ? 1 : -1) * (d / 2 + 0.04)], { yaw: k.rnd() * 3, r: 0.006, tint })
  },

  'stone-wall': (k, s) => {
    const { w, h, d } = k, v = s.variant, cope = 0.08
    const tint: V3 = v === 1 ? [0.95, 0.82, 0.64] : v === 2 ? [0.72, 0.74, 0.7] : [0.84, 0.84, 0.82]
    k.box('plaster', [w, h - cope, d - 0.05], [0, (h - cope) / 2, 0], { r: 0.003, tint: [0.7, 0.67, 0.6] })

    const top = h - cope - 0.003, j = () => k.jitter(0.006), cx = (x: number) => Math.max(-w / 2 + 0.003, Math.min(w / 2 - 0.003, x))
    const stone = (x0: number, x1: number, y0: number, y1: number, sd: number) => {
      const g = 0.007, a = x0 + g, b = x1 - g, c = y0 + g, e = y1 - g, cut = Math.min(0.03, (b - a) * 0.2, (e - c) * 0.25)
      const pts: V2[] = [[a + cut, c], [b - cut, c], [b, c + cut], [b, e - cut], [b - cut, e], [a + cut, e], [a, e - cut], [a, c + cut]].map(([x, y]) => [cx(x + j()), Math.min(top, Math.max(0.002, y + j()))] as V2)
      const moss = v === 2 && y0 < 0.6 && k.chance(0.5)
      k.extrude('concrete', pts, 0.05, [0, 0, sd * (d / 2 - 0.02)], { bevel: 0.008, bevelSeg: 2, tint: moss ? [0.6, 0.66, 0.48] : tint, tone: 0.78 + k.rnd() * 0.3 })
    }
    for (const sd of [-1, 1]) {
      for (let y = 0; y < h - cope - 0.06;) {
        const ch = Math.min(h - cope - y, 0.15 + k.rnd() * 0.14)
        for (let x = -w / 2; x < w / 2 - 0.02;) {
          const len = Math.min(w / 2 - x, 0.2 + k.rnd() * 0.32)
          if (!(v === 2 && k.chance(0.05))) stone(x, x + len, y, y + ch, sd)
          x += len
        }
        y += ch
      }
    }
    for (let x = -w / 2; x < w / 2 - 0.02;) {
      const len = Math.min(w / 2 - x, 0.45 + k.rnd() * 0.25)
      if (!(v === 2 && k.chance(0.25))) k.box('concrete', [len - 0.01, cope, d + 0.04], [x + len / 2, h - cope / 2, 0], { r: 0.012, yaw: k.jitter(0.01), tint, tone: 0.8 + k.rnd() * 0.25 })
      x += len
    }
  },

  'arched-doorway': (k, s) => {
    const { w, d } = k, v = s.variant, op = Math.min(1.4, w - 0.5), spring = 2.3, imp = 0.1, iw = 0.18

    for (const sx of [-1, 1]) {
      const a = sx * op / 2, b = sx * w / 2, c = sx * (op / 2 + iw)
      masonry(k, 'brick', Math.min(a, b), Math.max(a, b), 0, spring - imp)
      masonry(k, 'brick', Math.min(c, b), Math.max(c, b), spring - imp, spring)
      k.box('concrete', [iw, imp, d + 0.03], [sx * (op / 2 + iw / 2), spring - imp / 2, 0], { r: 0.006, tint: COPING })
    }
    arch(k, op, 0.3, spring, { keystone: true, drop: v === 2 ? 0.025 : 0 })
    k.box('concrete', [op, 0.03, d + 0.05], [0, 0.015, 0], { r: 0.006, tint: PLINTH })
    if (v >= 1) for (const sx of [-1, 1]) for (const y of [0.35, 1.85]) {

      k.cyl('steel', 0.01, 0.07, [sx * (op / 2 - 0.015), y, d / 2 - 0.05], { axis: 'x', seg: 8, tint: [0.3, 0.26, 0.24] })
      k.cyl('steel', 0.009, 0.06, [sx * (op / 2 - 0.045), y + 0.035, d / 2 - 0.05], { seg: 8, tint: [0.3, 0.26, 0.24] })
    }
    if (v === 2) {
      k.box('charcoal', [0.006, 0.45, 0.002], [0.04, 2.62, d / 2 + 0.0035], { roll: 0.25, r: 0 })
      rubble(k, 'brick', w, 7)
    }
  },
}
