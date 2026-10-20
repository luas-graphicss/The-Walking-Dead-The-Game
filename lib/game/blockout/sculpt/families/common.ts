import { arc, clamp, type Kit, type Mat, type V2, type V3 } from '../kit'
import { piping } from './seating'

export function mattress(k: Kit, m: Mat, size: V3, at: V3, o: { quilt?: [number, number]; yaw?: number; pitch?: number } = {}) {
  const [w, h, d] = size
  k.cushion(m, size, at, { puff: Math.min(0.024, h * 0.16), sides: 0.5, tufts: o.quilt, wrinkle: 0.3, yaw: o.yaw, pitch: o.pitch })
  if (!o.pitch) for (const s of [1, -1]) piping(k, m, [at[0], at[1] + s * (h / 2 - 0.022), at[2]], w - 0.014, d - 0.014, { r: 0.0048, yaw: o.yaw })
}

export function pillow(k: Kit, m: Mat, w: number, d: number, at: V3, o: { yaw?: number; pitch?: number; roll?: number; tone?: number; tint?: V3 } = {}) {
  k.cushion(m, [w, 0.13, d], at, { puff: 0.048, sides: 0.95, wrinkle: 0.7, r: 0.05, ...o })
}

export function blanket(k: Kit, m: Mat, width: number, top: number, hang: number, length: number, zc: number, o: { tone?: number; x?: number; tint?: V3 } = {}) {
  const t = 0.012, W = width / 2, r = 0.045, seed = k.rnd() * 10
  const outer: V2[] = [[-W - t, top - hang], ...arc(-W + r, top - r, r + t, Math.PI, Math.PI / 2, 5), ...arc(W - r, top - r, r + t, Math.PI / 2, 0, 5), [W + t, top - hang]]
  const inner: V2[] = [[W, top - hang + 0.012], ...arc(W - r, top - r, r, 0, Math.PI / 2, 5), ...arc(-W + r, top - r, r, Math.PI / 2, Math.PI, 5), [-W, top - hang + 0.012]]
  k.extrude(m, [...outer, ...inner], length, [o.x ?? 0, 0, zc], {
    steps: Math.ceil(length / 0.05), curveSeg: 2, crease: 55, tone: o.tone, tint: o.tint,
    warp: (x, y, z) => {
      const depth = clamp((top - 0.03 - y) / hang)
      const fold = (Math.sin(z * 15 + seed) * 0.014 + Math.sin(z * 6.1 + seed * 2.3) * 0.008) * depth
      return [Math.sign(x) * fold, y > top - 0.02 ? Math.sin(z * 9 + x * 11 + seed) * 0.004 : 0, 0]
    },
  })
}

export type HandleKind = 'bar' | 'knob' | 'cup' | 'none' | 'lever' | 'ring'
const DOOR_TRAVEL = 1.62
const reachOf = (kind: HandleKind) => (kind === 'none' || kind === 'cup' ? 0.012 : kind === 'knob' ? 0.03 : kind === 'lever' ? 0.035 : 0.024)
function handleOn(k: Kit, kind: HandleKind, at: V3, len: number, m: Mat, vertical = false) {
  if (kind === 'none') return
  if (kind === 'knob') k.knob(at, 0.014, { m })
  else if (kind === 'cup') k.frame({ at }, () => {
    k.box(m, [len, 0.028, 0.004], [0, 0.01, 0.002], { r: 0.0015 })
    k.cyl(m, 0.02, len * 0.9, [0, 0.0, 0.004], { axis: 'x', arc: Math.PI, seg: 12, caps: false, pitch: Math.PI })
  })
  else if (kind === 'ring') k.frame({ at }, () => { k.cyl(m, 0.012, 0.006, [0, 0.012, 0.003], { axis: 'z', seg: 12 }); k.torus(m, 0.018, 0.0028, [0, -0.008, 0.007], { axis: 'z', segR: 18, seg: 6 }) })
  else if (kind === 'lever') k.frame({ at }, () => { k.cyl(m, 0.022, 0.008, [0, 0, 0.004], { axis: 'z', seg: 16 }); k.tube(m, [[0, 0, 0.008], [0, 0, 0.035], [-0.1, 0, 0.04]], 0.0075, { fillet: 0.015 }) })
  else k.handle(at, len, { m, r: 0.0055, standoff: 0.024, vertical })
}

export function drawer(k: Kit, m: Mat, w: number, h: number, at: V3, o: { handle?: HandleKind; hm?: Mat; flat?: boolean; t?: number; yaw?: number; label?: boolean; tint?: V3 } = {}) {
  const t = o.t ?? 0.018, hm = o.hm ?? 'steel', raised = !o.flat && w > 0.16 && h > 0.1, tint = o.tint

  const face = raised ? t * 0.5 : t
  const handle = o.handle ?? 'bar', grip = o.label ? -h * 0.1 : h > 0.3 ? h * 0.28 : 0
  k.frame({ at, yaw: o.yaw }, () => {
    const depth = clamp(k.d - 0.1, 0.12, 0.46), box: Mat = m === 'tile' || m === 'glass' ? 'wood' : m
    const wall = Math.max(0.02, (h - 0.03) * 0.8), inner = Math.max(0.04, w - 0.06)
    k.leaf({
      kind: 'drawer', pivot: k.point([0, 0, 0]), axis: k.direction([0, 0, 1]), travel: Math.max(0.1, depth * 0.78), initial: 0,
      handle: k.point([0, handle === 'none' ? h / 2 - 0.012 : grip, face + reachOf(handle)]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
      center: k.point([0, 0, t / 2]), width: w, height: h, depth, floor: k.point([0, -h / 2 + 0.03, -depth / 2]),
    }, () => {
      if (raised) {
        const b = Math.min(0.045, w * 0.12, h * 0.22)
        k.box(m, [w - 0.004, h - 0.004, t * 0.5], [0, 0, t * 0.25], { tint })
        k.frameRect(m, w, h, b, t, [0, 0, t / 2], { tint })
      } else k.box(m, [w, h, t], [0, 0, t / 2], { tint })
      if (o.label) k.frame({ at: [0, h * 0.22, face] }, () => { k.frameRect(hm, 0.075, 0.035, 0.005, 0.004, [0, 0, 0.002]); k.label([0, 0, 0.001], 0.066, 0.026) })
      handleOn(k, handle, [0, grip, face], Math.min(0.13, w * 0.38), hm)
      if (w > 0.1 && h > 0.05) k.quiet(() => {
        for (const s of [-1, 1]) k.box(box, [0.012, wall, depth], [s * (inner / 2 + 0.006), -h / 2 + 0.02 + wall / 2, -depth / 2], { r: 0 })
        k.box(box, [inner, 0.01, depth], [0, -h / 2 + 0.025, -depth / 2], { r: 0 })
        k.box(box, [inner, wall, 0.012], [0, -h / 2 + 0.02 + wall / 2, -depth + 0.006], { r: 0 })
      })
    })
  })
}

export type DoorStyle = 'shaker' | 'flat' | 'glass' | 'louver' | 'mesh' | 'panel2'

export function door(k: Kit, m: Mat, w: number, h: number, at: V3, o: { style?: DoorStyle; hinge?: -1 | 1; handle?: HandleKind; hm?: Mat; t?: number; open?: number; hinges?: boolean; yaw?: number; tint?: V3 } = {}) {
  const t = o.t ?? 0.02, hinge = o.hinge ?? -1, hm = o.hm ?? 'steel', style = o.style ?? 'shaker', open = o.open ?? 0, handle = o.handle ?? 'bar', tint = o.tint
  const b = Math.min(0.06, w * 0.16, h * 0.12), stile = style === 'flat' ? Math.min(0.045, w * 0.18) : b / 2
  let index = 0
  k.frame({ at, yaw: o.yaw }, () => { index = k.leaf({
    kind: 'door', pivot: k.point([hinge * w / 2, 0, 0]), axis: k.direction([0, hinge, 0]), travel: DOOR_TRAVEL, initial: open,
    handle: k.point([-hinge * (w / 2 - (handle === 'none' ? 0.025 : stile)), 0, t + reachOf(handle)]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
    center: k.point([0, 0, t / 2]), width: w, height: h, depth: t, floor: k.point([0, -h / 2 + 0.02, -0.2]),
  }, () => k.frame({ at: [hinge * w / 2, 0, 0], yaw: open * hinge }, () => k.frame({ at: [-hinge * w / 2, 0, 0] }, () => {
    if (style === 'flat') k.box(m, [w, h, t], [0, 0, t / 2], { tint })
    else {
      k.frameRect(m, w, h, b, t, [0, 0, t / 2], { tint })
      if (style === 'shaker' || style === 'panel2') {
        k.box(m, [w - 2 * b + 0.01, h - 2 * b + 0.01, t * 0.45], [0, 0, t * 0.3], { tint })
        if (style === 'panel2') k.box(m, [w - 2 * b, b * 0.8, t], [0, h * 0.08, t / 2], { tint })
      } else if (style === 'glass') {
        k.box('glass', [w - 2 * b + 0.01, h - 2 * b + 0.01, 0.005], [0, 0, t * 0.5])
        if (h > 0.6) k.box(m, [w - 2 * b, 0.016, t * 0.7], [0, 0, t * 0.5])
      } else if (style === 'louver') {
        const n = Math.max(4, Math.floor((h - 2 * b) / 0.045))
        for (let i = 0; i < n; i++) k.box(m, [w - 2 * b + 0.004, 0.004, t * 0.85], [0, -h / 2 + b + (i + 0.5) * (h - 2 * b) / n, t * 0.5], { pitch: 0.55, r: 0.001 })
        k.box(m, [w - 2 * b + 0.01, h - 2 * b + 0.01, 0.003], [0, 0, 0.004])
      } else {
        k.bars(hm, w - 2 * b, h - 2 * b + 0.01, Math.max(4, Math.round(w / 0.06)), 0.0035, [0, 0, t * 0.5])
        for (const y of [-0.25, 0.25]) k.box(hm, [w - 2 * b, 0.006, 0.008], [0, y * (h - 2 * b), t * 0.5])
      }
    }
    if (o.hinges) for (const y of [-1, 1]) k.hinge([hinge * (w / 2 + 0.002), y * h * 0.36, t * 0.3], Math.min(0.08, h * 0.12), { yaw: hinge > 0 ? 0 : Math.PI, m: hm })

    handleOn(k, handle, [-hinge * (w / 2 - stile), 0, t], Math.min(0.12, h * 0.3), hm, true)
  }))) })
  return index
}

export function hollow(k: Kit, m: Mat, size: V3, at: V3, wall: number, o: { tint?: V3; r?: number } = {}) {
  const [w, h, d] = size, [x, y, z] = at, r = o.r ?? 0.004, tint = o.tint
  for (const level of [y, y + h - wall]) k.blk(m, [w, wall, d], x, level, z, { r, tint })
  for (const s of [-1, 1]) k.blk(m, [wall, h - 2 * wall, d], x + s * (w - wall) / 2, y + wall, z, { r, tint })
  k.blk(m, [w - 2 * wall, h - 2 * wall, wall], x, y + wall, z - (d - wall) / 2, { r, tint })
}

export function carcass(k: Kit, m: Mat, w: number, h: number, d: number, o: { t?: number; plinth?: number; top?: number; topM?: Mat; overhang?: number; back?: boolean; x?: number; z?: number; bottom?: number } = {}) {
  const t = o.t ?? 0.018, base = o.bottom ?? 0, plinth = o.plinth ?? 0, topT = o.top ?? t, x = o.x ?? 0, z = o.z ?? 0, over = o.overhang ?? 0
  for (const s of [-1, 1]) k.blk(m, [t, h - topT, d], x + s * (w - t) / 2, base, z)
  k.blk(m, [w - 2 * t, t, d - 0.012], x, base + plinth, z - 0.006)
  k.blk(o.topM ?? m, [w + 2 * over, topT, d + over], x, base + h - topT, z + over / 2, { r: Math.min(0.008, topT * 0.3) })
  if (o.back !== false) k.blk(m, [w - 2 * t + 0.004, h - topT - plinth - t, 0.008], x, base + plinth + t, z - d / 2 + 0.004)
  if (plinth > 0) k.blk(m, [w - 2 * t, plinth, t], x, base, z + d / 2 - 0.045, { tone: 0.75 })
  return w - 2 * t
}

export function shelfBoard(k: Kit, m: Mat, w: number, d: number, at: V3, o: { lip?: number; t?: number; wire?: boolean } = {}) {
  const t = o.t ?? 0.02
  if (o.wire) {
    for (let i = 0; i <= Math.round(w / 0.05); i++) k.cyl(m, 0.0028, d, [at[0] - w / 2 + i * w / Math.round(w / 0.05), at[1], at[2]], { axis: 'z', seg: 6, bevel: 0 })
    for (const z of [-1, 0, 1]) k.cyl(m, 0.004, w, [at[0], at[1] - 0.004, at[2] + z * (d / 2 - 0.01)], { axis: 'x', seg: 6, bevel: 0 })
    return
  }
  k.box(m, [w, t, d], at)
  if (o.lip) k.box(m, [w, o.lip, 0.012], [at[0], at[1] + o.lip / 2 - t / 2, at[2] + d / 2 + 0.006], { r: 0.004 })
}

const LABELS: V3[] = [[0.85, 0.3, 0.25], [0.3, 0.5, 0.8], [0.9, 0.75, 0.3], [0.35, 0.65, 0.35], [0.9, 0.9, 0.85], [0.55, 0.35, 0.6], [0.95, 0.55, 0.2]]
const PANELS: V3[] = [[1, 0.98, 0.92], [0.95, 0.9, 0.75], [0.25, 0.25, 0.28], [1, 0.85, 0.3]]
const BINDINGS: V3[] = [[0.45, 0.12, 0.1], [0.12, 0.2, 0.38], [0.15, 0.3, 0.18], [0.5, 0.38, 0.2], [0.2, 0.18, 0.16], [0.6, 0.5, 0.35], [0.7, 0.2, 0.25]]
const PAGES: V3 = [0.96, 0.93, 0.84]

export function carton(k: Kit, w: number, h: number, d: number, at: V3, tint: V3, o: { yaw?: number; roll?: number } = {}) {
  k.frame({ at, yaw: o.yaw, roll: o.roll }, () => {
    k.box('paper', [w, h, d], [0, h / 2, 0], { r: Math.min(0.0025, w * 0.04, d * 0.04), tint, tone: 0.8 + k.rnd() * 0.3 })
    if (w > 0.03 && h > 0.04) k.box('paper', [w * 0.78, h * 0.5, 0.001], [0, h * (0.42 + k.rnd() * 0.1), d / 2 + 0.0005], { r: 0, tint: k.pick(PANELS), tone: 0.95 })
    k.box('paper', [w - 0.004, 0.0012, Math.min(0.014, d * 0.2)], [0, h + 0.0006, d / 2 - Math.min(0.007, d * 0.1)], { r: 0, tint, tone: 0.82 })
    if (w > 0.05 && k.chance(0.3)) k.box('paper', [0.022, 0.014, 0.001], [w / 2 - 0.018, 0.022, d / 2 + 0.0015], { r: 0, tint: [1, 0.95, 0.8] })
  })
}

export function bag(k: Kit, w: number, h: number, d: number, at: V3, tint: V3, o: { yaw?: number; pitch?: number } = {}) {
  k.frame({ at, yaw: o.yaw, pitch: o.pitch }, () => {
    const seal = Math.min(0.018, h * 0.1)
    k.cushion('paint', [w, h - 2 * seal, d], [0, h / 2, 0], { puff: Math.min(0.012, d * 0.22), r: Math.min(0.02, d * 0.4), sides: 0.6, wrinkle: 0.6, tint, tone: 0.85 + k.rnd() * 0.25 })
    for (const y of [seal / 2, h - seal / 2]) k.box('paint', [w * 0.98, seal, 0.004], [0, y, 0], { r: 0.001, tint, tone: 0.8 })
  })
}

export function book(k: Kit, t: number, h: number, d: number, at: V3, tint: V3, o: { yaw?: number; roll?: number; leather?: boolean } = {}) {
  const board = Math.min(0.0028, t * 0.12), over = Math.min(0.003, h * 0.02), r = t / 2, m: Mat = o.leather ? 'leather' : 'paper', zs = d / 2 - r
  k.frame({ at, yaw: o.yaw, roll: o.roll }, () => {
    for (const sx of [-1, 1]) k.box(m, [board, h, zs + d / 2], [sx * (t / 2 - board / 2), h / 2, (zs - d / 2) / 2], { r: 0, tint })
    k.box('paper', [t - 2 * board, h - 2 * over, zs + d / 2 - over], [0, h / 2, (zs - d / 2 + over) / 2], { r: 0, tint: PAGES, tone: 0.95 + k.rnd() * 0.08 })
    k.cyl(m, r, h, [0, h / 2, zs], { arc: Math.PI, seg: 6, yaw: -Math.PI / 2, tint })

    if (h > 0.12) k.cyl('paper', r + 0.0006, h * 0.12, [0, h * 0.72, zs], { arc: Math.PI, seg: 6, yaw: -Math.PI / 2, caps: false, tint: k.pick(PANELS) })
  })
}

export function paperback(k: Kit, t: number, h: number, d: number, at: V3, tint: V3, o: { yaw?: number; roll?: number } = {}) {
  const c = 0.0008
  k.frame({ at, yaw: o.yaw, roll: o.roll }, () => {
    k.box('paper', [t - 2 * c, h, d - c], [0, h / 2, -c / 2], { r: 0, tint: PAGES, tone: 0.95 + k.rnd() * 0.08 })
    for (const sx of [-1, 1]) k.box('paper', [c, h, d], [sx * (t / 2 - c / 2), h / 2, 0], { r: 0, tint })
    k.box('paper', [t - 2 * c, h, c], [0, h / 2, d / 2 - c / 2], { r: 0, tint, tone: 0.9 })
  })
}

export function binder(k: Kit, t: number, h: number, d: number, at: V3, tint: V3, o: { yaw?: number; roll?: number } = {}) {
  const c = 0.0025
  k.frame({ at, yaw: o.yaw, roll: o.roll }, () => {
    for (const sx of [-1, 1]) k.box('paper', [c, h, d], [sx * (t / 2 - c / 2), h / 2, 0], { r: 0, tint })
    k.box('paper', [t - 2 * c, h, c], [0, h / 2, d / 2 - c / 2], { r: 0, tint })
    k.box('paper', [t - 2 * c - 0.012, h * 0.8, d * 0.85], [0, h * 0.42, -d * 0.06], { r: 0, tint: PAGES })
    k.box('paper', [t * 0.62, h * 0.32, 0.001], [0, h * 0.68, d / 2 + 0.0005], { r: 0, tint: [1, 0.98, 0.92] })
    k.torus('steel', Math.min(0.012, t * 0.22), 0.0022, [0, h * 0.2, d / 2 + 0.0022], { axis: 'z', seg: 6, segR: 14 })
  })
}

export type ProductKind = 'box' | 'can' | 'bottle' | 'med' | 'book' | 'jar' | 'jug'

export function products(k: Kit, kind: ProductKind, x0: number, x1: number, bottom: number, z: number, depth: number, o: { maxH?: number; fill?: number; rows?: number } = {}) {
  const fill = o.fill ?? 0.78, rows = o.rows ?? (depth > 0.3 ? 2 : 1), maxH = o.maxH ?? 0.3
  for (let r = 0; r < rows; r++) {
    const zr = z + (rows > 1 ? (r / (rows - 1) - 0.5) * (depth - 0.08) : 0)
    let x = x0
    while (x < x1 - 0.02) {
      const tint = k.pick(LABELS)
      if (kind === 'book') {
        const soft = k.chance(0.3), bw = soft ? k.range(0.012, 0.026) : k.range(0.022, 0.05), bh = Math.min(maxH, k.range(0.18, 0.27)), bd = Math.min(depth - 0.02, k.range(0.13, 0.2))
        if (x + bw > x1) break
        if (k.chance(fill)) {
          const binding = k.pick(BINDINGS), toppled = k.chance(0.06) && x + bh < x1

          const at: V3 = toppled ? [x + bh, bottom + bw / 2, zr] : [x + bw / 2, bottom, zr]
          const pose = toppled ? { roll: Math.PI / 2, yaw: k.jitter(0.08) } : { yaw: k.jitter(0.04), roll: k.chance(0.1) ? k.jitter(0.06) : 0 }
          if (soft) paperback(k, bw, bh, bd, at, k.pick(LABELS), pose)
          else book(k, bw, bh, bd, at, binding, { ...pose, leather: k.chance(0.15) })
          if (toppled) x += bh - bw
        }
        x += bw + 0.001
      } else if (kind === 'box') {
        const pack = k.rnd(), bw = k.range(0.07, 0.19), bh = Math.min(maxH, pack < 0.25 ? k.range(0.14, 0.26) : k.range(0.07, 0.24)), bd = Math.min(depth - 0.02, k.range(0.06, 0.18))
        if (x + bw > x1) break
        if (k.chance(fill)) {
          const at: V3 = [x + bw / 2, bottom, zr], yaw = k.jitter(0.05)
          if (pack < 0.25 && bh > 0.08) bag(k, bw - 0.006, bh, Math.min(bd, 0.07), at, tint, { yaw, pitch: k.chance(0.3) ? -0.06 : 0 })
          else if (pack < 0.4 && bh > 0.1) {

            const n = bh > 0.18 ? 3 : 2, sh = bh / n - 0.002
            for (let i = 0; i < n; i++) carton(k, bw - 0.01, sh, bd * 0.85, [at[0] + k.jitter(0.004), bottom + i * (sh + 0.0015), zr], tint, { yaw: yaw + k.jitter(0.04) })
          } else if (k.chance(0.06) && x + bh < x1) {
            carton(k, bh, bw - 0.004, bd, [x + bh / 2, bottom, zr], tint, { yaw: k.jitter(0.3) })
            x += bh - bw
          } else carton(k, bw - 0.004, bh, bd, at, tint, { yaw })
        }
        x += bw + 0.012
      } else {
        const radius = kind === 'can' ? k.range(0.032, 0.042) : kind === 'med' ? k.range(0.018, 0.026) : kind === 'jug' ? 0.06 : k.range(0.028, 0.038)
        const tall = Math.min(maxH, kind === 'can' ? k.range(0.09, 0.13) : kind === 'med' ? k.range(0.06, 0.1) : kind === 'jar' ? k.range(0.1, 0.14) : kind === 'jug' ? 0.26 : k.range(0.2, 0.3))
        if (x + radius * 2 > x1) break
        if (k.chance(fill)) {
          const cx = x + radius, cz = zr + k.jitter(0.01)
          if (kind === 'can') {
            k.cyl('steel', radius, tall, [cx, bottom + tall / 2, cz], { seg: 16, bevel: 0.004 })
            k.cyl('paper', radius + 0.0008, tall * 0.7, [cx, bottom + tall / 2, cz], { seg: 16, bevel: 0, caps: false, tint })
          } else {
            const neck = kind === 'jar' ? radius * 0.85 : radius * 0.38, m: Mat = kind === 'med' || kind === 'jug' ? 'tile' : 'glass'
            k.lathe(m, [[0, 0], [radius, 0], [radius, tall * 0.62], [neck, tall * 0.82], [neck, tall * 0.94], [0, tall * 0.94]], [cx, bottom, cz], { seg: 14, tint: m === 'tile' ? [0.95, 0.95, 0.92] : tint })
            k.cyl(kind === 'med' ? 'tile' : 'paint', neck * 1.08, tall * 0.08, [cx, bottom + tall * 0.97, cz], { seg: 12, tint })
            k.cyl('paper', radius + 0.0008, tall * 0.3, [cx, bottom + tall * 0.32, cz], { seg: 14, bevel: 0, caps: false, tint })
          }
        }
        x += radius * 2 + 0.006
      }
    }
  }
}

export function goods(k: Kit, m: Mat, x0: number, x1: number, bottom: number, z: number, depth: number, o: { minH?: number; maxH?: number; gap?: number; lean?: boolean; minW?: number; maxW?: number } = {}) {
  let x = x0
  while (x < x1 - 0.03) {
    const w = Math.min(x1 - x, k.range(o.minW ?? 0.03, o.maxW ?? 0.07)), h = k.range(o.minH ?? 0.12, o.maxH ?? 0.24), d = depth * k.range(0.75, 1)
    if (k.chance(0.88) && w > 0.015) {
      const at: V3 = [x + w / 2, bottom, z], pose = { roll: o.lean && k.chance(0.15) ? k.jitter(0.06) : 0 }
      if (m !== 'paper') carton(k, w - 0.003, h, d, at, k.pick(LABELS), pose)
      else if (w > 0.045) binder(k, w - 0.003, h, d, at, k.pick(BINDINGS), pose)
      else book(k, w - 0.003, h, d, at, k.pick(BINDINGS), pose)
    }
    x += w + (o.gap ?? 0.003)
  }
}
