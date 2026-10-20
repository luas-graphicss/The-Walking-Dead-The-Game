import { noise3, type Kit, type Mat, type V2, type V3 } from '../kit'

export const lugLift = (r: number, width: number) => { const lug = Math.min(0.05, r * 0.07); return lug * 0.97 + width * 0.21 * Math.sin(0.35) - 0.006 }

export const RUST: V3 = [0.62, 0.42, 0.3]
export const GALV: V3 = [0.86, 0.88, 0.9]
export const OIL: V3 = [0.32, 0.3, 0.28]

export const angleOutline = (a: number, t: number): V2[] => [[0, 0], [a, 0], [a, t], [t, t], [t, a], [0, a]]
export const channelOutline = (h: number, w: number, t: number): V2[] => [[0, -h / 2], [w, -h / 2], [w, -h / 2 + t], [t, -h / 2 + t], [t, h / 2 - t], [w, h / 2 - t], [w, h / 2], [0, h / 2]]
export const ibeamOutline = (h: number, w: number, tw: number, tf: number): V2[] => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, -h / 2 + tf], [tw / 2, -h / 2 + tf], [tw / 2, h / 2 - tf], [w / 2, h / 2 - tf], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, h / 2 - tf], [-tw / 2, h / 2 - tf], [-tw / 2, -h / 2 + tf], [-w / 2, -h / 2 + tf]]

export function column(k: Kit, m: Mat, outline: V2[], len: number, bottom: number, x: number, z: number, o: { yaw?: number; tint?: V3; tone?: number } = {}) {
  k.extrude(m, outline.map(([a, b]) => [a, -b] as V2), len, [x, bottom + len / 2, z], { axis: 'y', bevel: 0.0012, bevelSeg: 1, yaw: o.yaw, tint: o.tint, tone: o.tone })
}

export function rail(k: Kit, m: Mat, outline: V2[], len: number, at: V3, o: { yaw?: number; pitch?: number; roll?: number; tint?: V3; tone?: number } = {}) {
  k.extrude(m, outline.map(([a, b]) => [-a, b] as V2), len, at, { axis: 'x', bevel: 0.0012, bevelSeg: 1, yaw: o.yaw, pitch: o.pitch, roll: o.roll, tint: o.tint, tone: o.tone })
}

export function legFrame(k: Kit, m: Mat, w: number, d: number, top: number, o: { leg?: number; inset?: number; apron?: number; shelf?: number; stretcher?: number; tint?: V3; x?: number; z?: number } = {}) {
  const leg = o.leg ?? 0.06, inset = o.inset ?? 0.02, apron = o.apron ?? 0.09, x0 = o.x ?? 0, z0 = o.z ?? 0
  const lx = w / 2 - inset - leg / 2, lz = d / 2 - inset - leg / 2
  for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk(m, [leg, top, leg], x0 + x * lx, 0, z0 + z * lz, { tint: o.tint, r: Math.min(0.006, leg * 0.12) })
  for (const z of [-1, 1]) k.blk(m, [2 * lx - leg, apron, leg * 0.45], x0, top - apron, z0 + z * lz, { tint: o.tint })
  for (const x of [-1, 1]) k.blk(m, [leg * 0.45, apron, 2 * lz - leg], x0 + x * lx, top - apron, z0, { tint: o.tint })
  const low = o.stretcher ?? (o.shelf ?? 0)
  if (low > 0) {
    for (const z of [-1, 1]) k.blk(m, [2 * lx - leg, leg * 0.6, leg * 0.6], x0, low - leg * 0.3, z0 + z * lz, { tint: o.tint })
    for (const x of [-1, 1]) k.blk(m, [leg * 0.6, leg * 0.6, 2 * lz - leg], x0 + x * lx, low - leg * 0.3, z0, { tint: o.tint })
  }
  if (o.shelf) {

    const span = 2 * lz - leg - 0.004, n = Math.max(3, Math.round(span / 0.1)), sw = span / n
    for (let i = 0; i < n; i++) k.plank(m, 2 * lx + leg * 0.6 - 0.004, sw - 0.012, 0.018, [x0, o.shelf + leg * 0.3 + 0.009, z0 - span / 2 + (i + 0.5) * sw], { tint: o.tint, wear: 0.3 })
  }
  return top - apron
}

export function boardTop(k: Kit, m: Mat, w: number, d: number, y: number, o: { th?: number; boards?: number; gap?: number; x?: number; z?: number; nails?: boolean; tint?: V3 } = {}) {
  const th = o.th ?? 0.03, n = o.boards ?? Math.max(3, Math.round(d / 0.14)), gap = o.gap ?? 0.006, bw = (d - gap * (n - 1)) / n
  for (let i = 0; i < n; i++) k.plank(m, w, bw, th, [o.x ?? 0, y + th / 2, (o.z ?? 0) - d / 2 + bw / 2 + i * (bw + gap)], { nails: o.nails !== false, tint: o.tint, wear: 0.5 })
  return y + th
}

export function steelBench(k: Kit, w: number, d: number, top: number, o: { m?: Mat; tint?: V3; shelf?: number; topM?: Mat; topTint?: V3 } = {}) {
  const m = o.m ?? 'steel', a = 0.04, t = 0.004
  for (const x of [-1, 1]) for (const z of [-1, 1]) column(k, m, angleOutline(a, t), top - 0.04, 0, x * (w / 2 - 0.03), z * (d / 2 - 0.03), { yaw: x > 0 ? (z > 0 ? Math.PI : Math.PI / 2) : (z > 0 ? -Math.PI / 2 : 0), tint: o.tint })
  for (const x of [-1, 1]) for (const z of [-1, 1]) k.cyl('rubber', 0.022, 0.012, [x * (w / 2 - 0.03), 0.006, z * (d / 2 - 0.03)], { seg: 12 })
  for (const z of [-1, 1]) k.box(m, [w - 0.06, 0.04, 0.03], [0, top - 0.06, z * (d / 2 - 0.03)], { tint: o.tint, r: 0.003 })
  for (const x of [-1, 1]) k.box(m, [0.03, 0.04, d - 0.09], [x * (w / 2 - 0.03), top - 0.06, 0], { tint: o.tint, r: 0.003 })
  if (o.shelf) {
    for (const z of [-1, 1]) k.box(m, [w - 0.06, 0.03, 0.03], [0, o.shelf, z * (d / 2 - 0.03)], { tint: o.tint, r: 0.003 })
    k.box(m, [w - 0.1, 0.012, d - 0.1], [0, o.shelf + 0.021, 0], { tint: o.tint, r: 0.003 })
  }
  k.box(o.topM ?? m, [w, 0.04, d], [0, top - 0.02, 0], { r: 0.006, tint: o.topTint ?? o.tint })
  k.box(o.topM ?? m, [w, 0.05, 0.012], [0, top - 0.03, d / 2 + 0.004], { r: 0.004, tint: o.topTint ?? o.tint })
  return top
}

export function motor(k: Kit, at: V3, r: number, len: number, o: { yaw?: number; tint?: V3 } = {}) {
  const tint = o.tint ?? [0.3, 0.42, 0.55]
  k.frame({ at, yaw: o.yaw }, () => {
    const cy = r + 0.02, prof: V2[] = [[0, -len / 2], [r * 0.82, -len / 2], [r * 0.95, -len / 2 + 0.02]]
    const fins = Math.max(4, Math.round((len - 0.08) / 0.022))
    for (let i = 0; i < fins; i++) { const y = -len / 2 + 0.04 + i * (len - 0.08) / fins; prof.push([r * 0.95, y], [r * 1.08, y + 0.003], [r * 1.08, y + 0.008], [r * 0.95, y + 0.011]) }
    prof.push([r * 0.95, len / 2 - 0.02], [r * 0.82, len / 2], [0, len / 2])
    k.lathe('paint', prof, [0, cy, 0], { axis: 'x', seg: 28, tint, crease: 60 })
    k.cyl('steel', r * 0.16, 0.06, [len / 2 + 0.03, cy, 0], { axis: 'x', seg: 14 })
    k.box('steel', [0.012, 0.012, 0.03], [len / 2 + 0.045, cy + r * 0.16, 0], { r: 0.002 })
    for (const s of [-1, 1]) k.blk('paint', [len * 0.7, 0.025, 0.05], 0, 0, s * r * 0.62, { tint, r: 0.006 })
    k.blk('paint', [len * 0.55, cy - r * 0.55, r * 1.1], 0, 0.02, 0, { tint, r: 0.01 })
    k.blk('paint', [0.1, 0.07, 0.09], -len * 0.1, cy + r * 1.04, 0, { tint, r: 0.008 })
    k.cyl('rubber', 0.012, 0.05, [-len * 0.1, cy + r * 1.04 + 0.035, 0.045 + 0.025], { axis: 'z', seg: 10 })
    k.label([0, cy + r * 0.35, r * 1.02], 0.06, 0.035, { yaw: 0, pitch: -0.35, m: 'steel' })
  })
}

export function gauge(k: Kit, at: V3, r: number, o: { yaw?: number; pitch?: number; tint?: V3 } = {}) {
  k.frame({ at, yaw: o.yaw, pitch: o.pitch }, () => {
    k.lathe('steel', [[0, 0], [r, 0], [r * 1.08, r * 0.15], [r * 1.02, r * 0.32], [r * 0.9, r * 0.36], [0, r * 0.36]], [0, 0, 0], { axis: 'z', seg: 24, tint: o.tint })

    k.cyl('paper', r * 0.86, 0.002, [0, 0, r * 0.36 + 0.001], { axis: 'z', seg: 24, tint: [0.95, 0.94, 0.88] })
    k.box('paint', [r * 0.75, 0.0025, 0.0015], [r * 0.18, r * 0.12, r * 0.36 + 0.003], { roll: 0.5, r: 0, tint: [0.8, 0.1, 0.08] })
    k.cyl('glass', r * 0.88, 0.003, [0, 0, r * 0.36 + 0.0055], { axis: 'z', seg: 24 })
  })
}

export function pail(k: Kit, m: Mat, r: number, h: number, at: V3, o: { tint?: V3; bail?: number; fill?: Mat; fillTint?: V3 } = {}) {
  k.frame({ at }, () => {
    k.lathe(m, [[0, 0], [r * 0.82, 0], [r * 0.84, 0.01], [r * 0.92, h * 0.5], [r * 0.95, h * 0.52], [r * 0.93, h * 0.55], [r, h - 0.01], [r * 1.04, h], [r * 0.96, h], [r * 0.9, h * 0.56], [r * 0.78, 0.012], [0, 0.012]], [0, 0, 0], { seg: 24, tint: o.tint, crease: 60 })
    if (o.fill) k.cyl(o.fill, r * 0.9, 0.01, [0, h * 0.62, 0], { seg: 24, tint: o.fillTint })
    for (const s of [-1, 1]) k.cyl('steel', 0.009, 0.012, [s * r * 1.01, h - 0.025, 0], { axis: 'x', seg: 10 })
    const lift = o.bail ?? 0.6
    const pts: V3[] = Array.from({ length: 9 }, (_, i) => { const a = i / 8 * Math.PI; return [-Math.cos(a) * r * 1.02, h - 0.025 + Math.sin(a) * r * 0.9 * Math.cos(lift), Math.sin(a) * r * 0.9 * Math.sin(lift)] as V3 })
    k.tube('steel', pts, 0.0028, { seg: 6, fillet: 0.01 })
  })
}

export function chain(k: Kit, a: V3, b: V3, o: { r?: number; tint?: V3 } = {}) {
  const r = o.r ?? 0.004, len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), pitch = r * 6.4, n = Math.max(1, Math.floor(len / pitch))
  const dx = (b[0] - a[0]) / len, dy = (b[1] - a[1]) / len, dz = (b[2] - a[2]) / len
  const yaw = Math.atan2(dx, dz), tilt = Math.acos(Math.max(-1, Math.min(1, dy)))
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * pitch
    k.torus('steel', r * 2.2, r, [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t], { seg: 6, segR: 12, scale: [1, 1.7, 1], yaw: yaw + (i % 2 ? Math.PI / 2 : 0), pitch: tilt, axis: 'z', tint: o.tint })
  }
}

export function rope(k: Kit, pts: V3[], r = 0.008, tint: V3 = [0.78, 0.66, 0.46]) {
  k.tube('fabric', pts, r, { seg: 8, fillet: r * 4, tint })
}

export function litter(k: Kit, m: Mat, w: number, d: number, peak: number, at: V3, o: { tint?: V3; seed?: number } = {}) {
  const seed = o.seed ?? 3
  k.sheet(m, w, d, (x, z) => {
    const e = Math.min(1, Math.min(w / 2 - Math.abs(x), d / 2 - Math.abs(z)) / 0.08)
    return (peak * (0.55 + noise3(x * 7, 0, z * 7, seed) * 0.9)) * e + 0.002
  }, [at[0], at[1] + 0.0008, at[2]], { thickness: 0.003, tint: o.tint, tone: 1 })
}
