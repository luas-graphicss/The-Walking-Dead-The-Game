import { type Kit, type Mat, type V2, type V3 } from '../kit'

export const PACK_TINTS: V3[] = [[0.85, 0.3, 0.25], [0.3, 0.5, 0.8], [0.9, 0.75, 0.3], [0.35, 0.65, 0.35], [0.92, 0.9, 0.84], [0.55, 0.35, 0.6], [0.95, 0.55, 0.2]]
export const BOOK_TINTS: V3[] = [[0.55, 0.18, 0.15], [0.2, 0.28, 0.5], [0.28, 0.4, 0.25], [0.62, 0.5, 0.3], [0.18, 0.18, 0.2], [0.7, 0.62, 0.45], [0.42, 0.22, 0.38]]
export const CLOTH_TINTS: V3[] = [[0.25, 0.32, 0.5], [0.6, 0.2, 0.18], [0.82, 0.8, 0.74], [0.3, 0.42, 0.3], [0.5, 0.45, 0.38], [0.2, 0.2, 0.22], [0.78, 0.62, 0.35]]
export const CARDBOARD: V3 = [0.72, 0.58, 0.4]
const LABEL_GAP = 0.0009

type Pose = { yaw?: number; pitch?: number; roll?: number; tint?: V3; tone?: number }
export const lighten = (t: V3): V3 => [Math.min(1.1, t[0] * 0.5 + 0.55), Math.min(1.1, t[1] * 0.5 + 0.55), Math.min(1.1, t[2] * 0.5 + 0.55)]
const sidePillow = (amount: number) => (face: number, s: number, t: number, hs: number, ht: number) => (face === 0 || face === 1 ? amount * (1 - (s / hs) ** 2) * (1 - (t / ht) ** 2) : 0)

const arcXY = (cx: number, cy: number, r: number, a0: number, a1: number, n = 10): V3[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0] as V3 })

export function packet(k: Kit, w: number, h: number, d: number, at: V3, o: Pose = {}) {
  const tint = o.tint ?? k.pick(PACK_TINTS), flap = Math.min(0.012, h * 0.08), tone = o.tone ?? 0.8 + k.rnd() * 0.3
  k.frame({ at, yaw: o.yaw, pitch: o.pitch, roll: o.roll }, () => {
    k.box('paper', [w, h - 2 * flap, d], [0, h / 2, 0], { r: 0.0012, tint, tone, disp: sidePillow(Math.min(w, d) * 0.04), seg: [1, 3, 3] })
    for (const y of [flap / 2, h - flap / 2]) k.box('paper', [w + 0.0012, flap, d + 0.0012], [0, y, 0], { r: 0.0008, tint, tone: tone * 0.9 })
    k.box('paper', [w * 0.72, (h - 2 * flap) * 0.46, 0.0015], [0, h * 0.56, d / 2 + 0.00075], { r: 0, tint: lighten(tint), tone })
  })
}

export function carton(k: Kit, w: number, h: number, d: number, at: V3, o: Pose & { label?: boolean } = {}) {
  const tint = o.tint ?? CARDBOARD, tone = o.tone ?? 0.85 + k.rnd() * 0.25, tw = Math.min(0.05, w * 0.3), th = Math.min(0.08, h * 0.3)
  k.frame({ at, yaw: o.yaw, pitch: o.pitch, roll: o.roll }, () => {
    k.box('paper', [w, h, d], [0, h / 2, 0], { r: 0.003, tint, tone, disp: sidePillow(Math.min(w, d) * 0.025), seg: [1, 3, 4] })
    k.box('paper', [tw, 0.0012, d + 0.0024], [0, h + 0.0006, 0], { r: 0, tint: [0.86, 0.78, 0.6], tone })
    for (const z of [-1, 1]) k.box('paper', [tw, th, 0.0012], [0, h - th / 2, z * (d / 2 + 0.0006)], { r: 0, tint: [0.86, 0.78, 0.6], tone })
    if (o.label !== false && w > 0.12) k.box('paper', [Math.min(0.1, w * 0.3), Math.min(0.07, h * 0.3), 0.0012], [-w * 0.22 - 0.01, h * 0.42, d / 2 + 0.0006], { r: 0, tint: [0.97, 0.96, 0.92] })
  })
}

export function book(k: Kit, th: number, h: number, d: number, at: V3, o: Pose = {}) {
  const tint = o.tint ?? k.pick(BOOK_TINTS), b = Math.min(0.0028, th * 0.14), tone = o.tone ?? 0.75 + k.rnd() * 0.35
  k.frame({ at, yaw: o.yaw, pitch: o.pitch, roll: o.roll }, () => {
    for (const s of [-1, 1]) k.box('paper', [b, h, d - 0.002], [s * (th / 2 - b / 2), h / 2, -0.001], { r: 0.0009, tint, tone })
    k.box('paper', [th - 2 * b, h - 0.007, d - 0.005], [0, h / 2, -0.0005], { r: 0, tint: [0.93, 0.9, 0.8] })
    k.box('paper', [th, h, 0.003], [0, h / 2, d / 2 - 0.0015], { r: 0.0009, tint, tone, disp: (f, s, _t, hs) => (f === 4 ? th * 0.12 * (1 - (s / hs) ** 2) : 0), seg: [4, 1, 1] })
  })
}

export function flatBook(k: Kit, w: number, th: number, d: number, at: V3, o: Pose = {}) {
  k.frame({ at, yaw: o.yaw }, () => k.frame({ at: [w / 2, th / 2, 0], roll: Math.PI / 2 }, () => book(k, th, w, d, [0, 0, 0], { tint: o.tint, tone: o.tone })))
}

export function binder(k: Kit, th: number, h: number, d: number, at: V3, o: Pose = {}) {
  const tint = o.tint ?? k.pick(BOOK_TINTS)
  k.frame({ at, yaw: o.yaw, roll: o.roll }, () => {
    for (const s of [-1, 1]) k.box('paint', [0.003, h, d - 0.003], [s * (th / 2 - 0.0015), h / 2, -0.0015], { r: 0.001, tint })
    k.box('paint', [th, h, 0.003], [0, h / 2, d / 2 - 0.0015], { r: 0.0012, tint })
    k.box('paper', [th - 0.006, h * 0.92, d * 0.9], [0, h / 2, -d * 0.045], { r: 0, tint: [0.95, 0.94, 0.9] })
    k.box('paper', [th * 0.7, h * 0.3, 0.0012], [0, h * 0.68, d / 2 + 0.0006], { r: 0, tint: [0.96, 0.95, 0.9] })
    k.torus('steel', 0.011, 0.002, [0, h * 0.18, d / 2 + 0.0005], { axis: 'z', segR: 14, seg: 5 })
  })
}

export function folded(k: Kit, w: number, h: number, d: number, at: V3, o: Pose = {}) {
  const n = Math.max(1, Math.round(h / 0.035)), lh = h / n
  k.frame({ at, yaw: o.yaw }, () => {
    for (let i = 0; i < n; i++) k.box('fabric', [w - k.rnd() * 0.012, lh, d - k.rnd() * 0.01], [k.jitter(0.005), lh * (i + 0.5), k.jitter(0.004)], { r: lh * 0.45, yaw: k.jitter(0.035), tint: o.tint ?? k.pick(CLOTH_TINTS), tone: 0.8 + k.rnd() * 0.3 })
  })
}

export function can(k: Kit, r: number, h: number, at: V3, o: { tint?: V3 } = {}) {
  const p: V2[] = [[0, 0.002], [r * 0.86, 0.002], [r * 0.9, 0], [r, 0.003], [r * 0.98, 0.008]]
  for (let i = 1; i < 4; i++) { const y = h * i / 4; p.push([r * 0.98, y - 0.004], [r * 0.955, y], [r * 0.98, y + 0.004]) }
  p.push([r * 0.98, h - 0.008], [r, h - 0.003], [r * 0.9, h], [r * 0.86, h - 0.003], [0, h - 0.003])
  k.lathe('steel', p, at, { seg: 18, crease: 50 })
  k.cyl('paper', r + LABEL_GAP, h * 0.62, [at[0], at[1] + h / 2, at[2]], { seg: 18, caps: false, tint: o.tint ?? k.pick(PACK_TINTS) })
}

export function bottle(k: Kit, r: number, h: number, at: V3, o: { m?: Mat; tint?: V3; cap?: V3 } = {}) {
  const m = o.m ?? 'glass', neck = r * 0.36
  k.lathe(m, [[0, 0], [r * 0.92, 0], [r, 0.006], [r, h * 0.6], [r * 0.82, h * 0.7], [neck, h * 0.82], [neck, h * 0.93], [0, h * 0.93]], at, { seg: 16, crease: 35, tint: o.tint })
  k.cyl('paint', neck * 1.18, h * 0.07, [at[0], at[1] + h * 0.965, at[2]], { seg: 14, tint: o.cap ?? k.pick(PACK_TINTS) })
  k.cyl('paper', r + LABEL_GAP, h * 0.26, [at[0], at[1] + h * 0.33, at[2]], { seg: 16, caps: false, tint: lighten(o.tint ?? [0.6, 0.6, 0.6]) })
}

export function jar(k: Kit, r: number, h: number, at: V3, o: { tint?: V3; fill?: V3 } = {}) {
  k.lathe('glass', [[0, 0], [r * 0.9, 0], [r, 0.008], [r, h * 0.82], [r * 0.86, h * 0.88], [r * 0.86, h * 0.92], [0, h * 0.92]], at, { seg: 18, crease: 40, tint: o.fill })
  k.lathe('steel', [[0, h * 0.9], [r * 0.9, h * 0.9], [r * 0.92, h * 0.94], [r * 0.9, h], [0, h]], at, { seg: 18, crease: 50, tint: o.tint })
}

export function tin(k: Kit, r: number, h: number, at: V3, o: { tint?: V3 } = {}) {
  const tint = o.tint ?? k.pick(PACK_TINTS)
  k.cyl('paint', r, h * 0.84, [at[0], at[1] + h * 0.42, at[2]], { seg: 20, tint })
  k.lathe('paint', [[0, h * 0.84], [r * 1.03, h * 0.84], [r * 1.03, h * 0.98], [r * 0.98, h], [0, h]], at, { seg: 20, crease: 50, tint: lighten(tint) })
  k.cyl('paper', r + LABEL_GAP, h * 0.3, [at[0], at[1] + h * 0.4, at[2]], { seg: 20, caps: false, tint: [0.95, 0.92, 0.82] })
}

export function cup(k: Kit, r: number, h: number, at: V3, o: { m?: Mat; tint?: V3; handle?: boolean; yaw?: number } = {}) {
  const m = o.m ?? 'tile', t = Math.max(0.003, r * 0.09)
  k.frame({ at, yaw: o.yaw }, () => {
    k.lathe(m, [[0, 0], [r * 0.62, 0], [r * 0.66, 0.006], [r * 0.82, 0.01], [r, h], [r - t, h], [r * 0.8 - t, 0.014], [0, 0.014]], [0, 0, 0], { seg: 20, crease: 60, tint: o.tint })
    if (o.handle !== false) {

      const R = h * 0.26, wall = r * 0.82 + (r - r * 0.82) * 0.55, cx = wall - R * Math.cos(Math.PI * 0.62) - 0.002
      k.tube(m, arcXY(cx, h * 0.55, R, -Math.PI * 0.62, Math.PI * 0.62, 12), t * 0.9, { seg: 8, tint: o.tint })
    }
  })
}

export function glass(k: Kit, r: number, h: number, at: V3) {
  k.lathe('glass', [[0, 0], [r * 0.82, 0], [r * 0.86, 0.006], [r, h], [r - 0.003, h], [r * 0.84 - 0.003, 0.012], [0, 0.012]], at, { seg: 18, crease: 60 })
}

export function shoe(k: Kit, len: number, at: V3, o: { yaw?: number; tint?: V3; boot?: boolean; sole?: V3 } = {}) {
  const w = len * 0.36, hi = o.boot ? len * 0.62 : len * 0.3, tint = o.tint ?? k.pick(CLOTH_TINTS)
  k.frame({ at, yaw: o.yaw }, () => k.frame({ yaw: -Math.PI / 2 }, () => {

    const sole: V2[] = [[-len / 2, 0], [len / 2 - 0.02, 0], [len / 2, 0.012], [len / 2 - 0.01, 0.024], [-len / 2 + 0.01, 0.024], [-len / 2 - 0.004, 0.012]]
    k.extrude('rubber', sole, w, [0, 0, 0], { bevel: 0.004, tint: o.sole ?? [0.9, 0.88, 0.84] })
    const A: V2 = [len / 2 - 0.02, len * 0.12], B: V2 = [len * 0.12, hi * 0.82]
    const upper: V2[] = [[-len / 2 + 0.008, 0.023], [len / 2 - 0.012, 0.023], A, B, [-len * 0.18, hi], [-len / 2 + 0.01, hi * 0.95], [-len / 2 + 0.004, len * 0.1]]
    k.extrude('leather', upper, w * 0.9, [0, 0, 0], { bevel: Math.min(0.016, w * 0.25), bevelSeg: 3, tint })

    const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy), nx = dy / l, ny = -dx / l
    for (let i = 0; i < 3; i++) { const t = 0.3 + i * 0.22; k.cyl('fabric', 0.003, w * 0.42, [A[0] + dx * t + nx * 0.001, A[1] + dy * t + Math.abs(ny) * 0.001, 0], { axis: 'z', seg: 6, tint: [0.92, 0.9, 0.85] }) }
  }))
}

export function ball(k: Kit, r: number, at: V3, kind: 'basket' | 'soccer' | 'volley' = 'basket') {
  const tint: V3 = kind === 'basket' ? [0.85, 0.42, 0.15] : kind === 'soccer' ? [0.92, 0.92, 0.9] : [0.95, 0.88, 0.5]
  const c: V3 = [at[0], at[1] + r, at[2]], seam: V3 = kind === 'basket' ? [0.12, 0.1, 0.1] : [0.2, 0.2, 0.22]
  k.sphere('rubber', r, c, { rows: 12, seg: 22, tint })
  k.torus('rubber', r, 0.0024, c, { axis: 'x', segR: 30, seg: 4, tint: seam })
  k.torus('rubber', r, 0.0024, c, { axis: 'z', segR: 30, seg: 4, tint: seam })
  if (kind !== 'soccer') k.torus('rubber', r, 0.0024, c, { segR: 30, seg: 4, tint: seam })
}

export function teddy(k: Kit, s: number, at: V3, o: { tint?: V3; yaw?: number } = {}) {
  const tint = o.tint ?? [0.62, 0.45, 0.3]
  k.frame({ at, yaw: o.yaw, scale: s }, () => {
    k.sphere('fabric', 0.07, [0, 0.0745, 0], { rows: 8, seg: 14, scale: [1, 1.05, 0.9], tint })
    k.sphere('fabric', 0.055, [0, 0.178, 0.01], { rows: 8, seg: 14, tint })
    for (const x of [-1, 1]) {
      k.sphere('fabric', 0.022, [x * 0.04, 0.225, 0.0], { rows: 6, seg: 10, scale: [1, 1, 0.6], tint })
      k.sphere('fabric', 0.028, [x * 0.07, 0.088, 0.03], { rows: 6, seg: 10, scale: [0.8, 1.4, 0.8], roll: x * 0.6, tint })
      k.sphere('fabric', 0.03, [x * 0.045, 0.0256, 0.06], { rows: 6, seg: 10, scale: [0.9, 0.85, 1.4], tint })
    }
    k.sphere('fabric', 0.022, [0, 0.168, 0.058], { rows: 6, seg: 10, scale: [1, 0.8, 0.8], tint: [0.85, 0.75, 0.6] })
    k.sphere('rubber', 0.008, [0, 0.175, 0.077], { rows: 4, seg: 8 })
    for (const x of [-1, 1]) k.sphere('rubber', 0.0065, [x * 0.022, 0.195, 0.051], { rows: 4, seg: 8 })
  })
}

export function toyTruck(k: Kit, len: number, at: V3, o: { tint?: V3; yaw?: number } = {}) {
  const w = len * 0.42, r = len * 0.1, tint = o.tint ?? k.pick(PACK_TINTS), top = 1.6 * r
  k.frame({ at, yaw: o.yaw }, () => {
    k.box('paint', [len, 0.6 * r, w * 0.8], [0, 1.3 * r, 0], { r: 0.003, tint: [0.25, 0.25, 0.27] })
    k.box('paint', [len * 0.32, len * 0.3, w], [len * 0.32, top + len * 0.15, 0], { r: 0.01, tint })
    k.box('glass', [0.003, len * 0.12, w * 0.8], [len * 0.48 + 0.0015, top + len * 0.2, 0], { r: 0.001 })
    k.box('paint', [len * 0.62, len * 0.14, w], [-len * 0.18, top + len * 0.07, 0], { r: 0.005, tint: lighten(tint) })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.cyl('rubber', r, w * 0.2, [x * len * 0.32, r, z * (w * 0.4 + w * 0.1)], { axis: 'z', seg: 14 })
  })
}

export function toyBlock(k: Kit, s: number, at: V3, o: { tint?: V3; yaw?: number } = {}) {
  const tint = o.tint ?? k.pick(PACK_TINTS)
  k.frame({ at, yaw: o.yaw }, () => {
    k.box('wood', [s, s, s], [0, s / 2, 0], { r: s * 0.1, tint })
    k.box('paint', [s * 0.5, s * 0.5, 0.0015], [0, s / 2, s / 2 + 0.00075], { r: 0, tint: lighten(tint) })
  })
}

export function rifle(k: Kit, len: number, at: V3, o: { scope?: boolean; stock?: V3; metal?: V3; yaw?: number; pump?: boolean } = {}) {
  const stock = o.stock ?? [0.55, 0.38, 0.24], metal = o.metal ?? [0.28, 0.28, 0.3], t = 0.036, pad = 0.012
  k.frame({ at, yaw: o.yaw }, () => {
    k.box('rubber', [0.124, pad, t * 0.92], [0.0595, pad / 2, 0], { r: 0.003 })
    k.extrude('wood', [[0, 0], [0.122, 0], [0.11, 0.07], [0.062, 0.3], [0.058, 0.34], [0.03, 0.34], [0.01, 0.31], [-0.004, 0.12]].map(([x, y]) => [x, y + pad] as V2), t, [0, 0, 0], { bevel: 0.007, bevelSeg: 2, tint: stock })
    const rx = 0.03, r0 = 0.34 + pad, r1 = r0 + 0.2, face = rx + 0.023
    k.box('steel', [0.046, r1 - r0, 0.03], [rx, (r0 + r1) / 2, 0], { r: 0.004, tint: metal })
    k.tube('steel', arcXY(face, r0 + 0.045, 0.02, -Math.PI / 2, Math.PI / 2, 10), 0.003, { seg: 6, tint: metal })
    k.box('steel', [0.014, 0.005, 0.004], [face + 0.006, r0 + 0.045, 0], { r: 0.001, roll: -0.25, tint: metal })
    if (!o.pump) k.box('steel', [0.05, 0.075, 0.022], [face + 0.022, r0 + 0.115, 0], { r: 0.004, roll: -0.12, tint: metal })
    const fore = o.pump ? 0.18 : 0.3, foreY = r1 + (o.pump ? 0.06 : 0)
    k.box('wood', [0.034, fore, 0.034], [rx + 0.013, foreY + fore / 2, 0], { r: 0.008, tint: stock })
    const bx = rx - 0.0105
    k.cyl('steel', 0.0085, len - r1 + 0.004, [bx, r1 - 0.004 + (len - r1 + 0.004) / 2, 0], { seg: 12, tint: metal })
    if (o.pump) k.cyl('steel', 0.009, foreY - r1 + fore + 0.12, [rx + 0.013, r1 + (foreY - r1 + fore + 0.12) / 2, 0], { seg: 12, tint: metal })
    k.box('steel', [0.012, 0.012, 0.006], [bx - 0.0085 - 0.006 + 0.0005, len - 0.02, 0], { r: 0.002, tint: metal })
    if (o.scope) {

      const sy = r0 - 0.03, sl = 0.3, mx = rx - 0.023 - 0.015
      for (const y of [r0 + 0.04, r0 + 0.17]) k.box('steel', [0.03, 0.018, 0.018], [mx, y, 0], { r: 0.003, tint: metal })
      k.lathe('steel', [[0, 0], [0.02, 0], [0.02, 0.05], [0.014, 0.08], [0.014, sl - 0.08], [0.018, sl - 0.05], [0.018, sl], [0, sl]], [mx - 0.015 - 0.014 + 0.001, sy, 0], { seg: 18, tint: [0.12, 0.12, 0.13] })
    }
  })
}
