import { clamp, extrudeRaw, latheRaw, noise3, Raw, rboxRaw, type Kit, type V2, type V3 } from '../../blockout/sculpt/kit'
import { aerosol, atEnd, blister, coil, sack, tin } from './archetypes'
import { circle, dents, fillet2, merge, place, rrect, shade, sphereMesh, sweepRaw, type ResourceFamily } from './forms'

const TAU = Math.PI * 2
const KRAFT: V3 = [0.86, 0.78, 0.62], PINE: V3 = [1, 0.93, 0.82], OLD: V3 = [0.72, 0.66, 0.6]

export function boardRaw(len: number, wid: number, th: number, o: { bow?: number; cup?: number; seed?: number; rough?: number; split?: number; outline?: V2[] } = {}): Raw {
  const seed = o.seed ?? 1
  const raw = extrudeRaw(o.outline ?? rrect(wid, th, Math.min(0.003, th * 0.18), 2), len, { bevel: Math.min(0.0012, th * 0.08), steps: o.split ? 14 : 1 })
  raw.warp((x, y, z) => [0, th / 2 + (o.bow ?? 0) * (1 - (2 * z / len) ** 2) + (o.cup ?? 0) * (2 * x / wid) ** 2, o.split ? -o.split * noise3(x * 90, y * 90, seed, seed) * clamp((z - len / 2 + 0.06) / 0.06) : 0])
  if (o.rough) raw.displace(dents(o.rough, 60, seed))
  return place(raw.smooth(35), { yaw: Math.PI / 2 })
}

function bentNail(k: Kit, at: V3, yaw: number) {
  k.frame({ at, yaw }, () => k.tube('steel', [[0, -0.006, 0], [0, 0.012, 0], [0.004, 0.022, 0], [0.016, 0.026, 0]], 0.0016, { seg: 6, tint: [0.62, 0.42, 0.3] }))
}

export const CONSTRUCTION: ResourceFamily = {
  'wood-plank': (k) => {
    const L = k.w - 0.02, T = 0.024
    k.put(boardRaw(L, 0.145, T, { bow: 0.002, cup: 0.0012, seed: 2, rough: 0.0005 }), 'wood', { at: [0, 0, -0.004], tint: PINE })
    k.put(boardRaw(L - 0.05, 0.135, T, { bow: 0.0015, cup: 0.001, seed: 5, rough: 0.0005 }), 'wood', { at: [0.014, T + 0.0002, 0.005], yaw: 0.012, tint: [0.96, 0.88, 0.76] })
  },
  'wood-beam': (k) => {

    const W = 0.074, T = 0.152, crack: V2[] = [[-W / 2, -T / 2], [W / 2, -T / 2], [W / 2, T * 0.08], [W / 2 - 0.007, T * 0.1], [W / 2, T * 0.12], [W / 2, T / 2], [-W / 2, T / 2]]
    k.put(boardRaw(k.w - 0.03, W, T, { seed: 7, rough: 0.0012, outline: fillet2(crack, 0.002, 2, true) }), 'wood', { tint: [0.82, 0.68, 0.52] })
    bentNail(k, [-0.42, T, 0.01], 0.6)
    bentNail(k, [0.31, T, -0.012], -2.2)
  },
  'wood-lath': (k) => {
    const L = k.w - 0.04, W = 0.038, T = 0.0105
    for (let row = 0; row < 2; row++) for (let c = 0; c < 3; c++) {
      k.put(boardRaw(L - k.rnd() * 0.03, W, T, { seed: row * 3 + c, rough: 0.0003, bow: 0.001 }), 'wood', { at: [k.jitter(0.02), row * (T + 0.0002), (c - 1) * (W + 0.001)], tint: PINE.map((v) => v * (0.9 + k.rnd() * 0.1)) as V3 })
    }
    for (const x of [-0.38, 0.38]) {
      const loop: V3[] = rrect(3 * W + 0.006, 2 * T + 0.0036, 0.003, 3, 0, T + 0.0006).map(([z, y]) => [x, y, z])
      k.put(sweepRaw(loop, 0.0009, { closed: true, seg: 5 }), 'steel', { tint: [0.55, 0.55, 0.57] })
    }
  },
  plywood: (k) => {
    const { w, d } = k, ply = 0.0036
    for (let i = 0; i < 4; i++) k.box('wood', [w, ply, d], [0, ply * (i + 0.5), 0], { r: 0, grain: i % 2 ? 2 : 0, tint: i % 2 ? [0.9, 0.78, 0.6] : [0.98, 0.88, 0.7] })

    const chip: V2[] = [[-w / 2, -d / 2], [w / 2 - 0.05, -d / 2], [w / 2 - 0.032, -d / 2 + 0.012], [w / 2 - 0.018, -d / 2 + 0.016], [w / 2, -d / 2 + 0.04], [w / 2, d / 2], [-w / 2, d / 2]]
    k.extrude('wood', chip, ply, [0, ply * 4.5, 0], { axis: 'y', bevel: 0.0003, tint: [1, 0.9, 0.72] })
  },
  'ceramic-bricks': (k) => {
    const holes = (r: number) => [-0.09, -0.06, -0.03, 0, 0.03, 0.06, 0.09].flatMap((x) => [-0.032, 0, 0.032].map((y) => circle(r, 10, x, y)))
    const brick = (y: number, yaw: number, x: number, seed: number, tint: V3) => k.extrude('brick', rrect(0.232, 0.112, 0.003, 2), 0.052, [x, y + 0.026, 0], { axis: 'y', yaw, holes: holes(0.0072), bevel: 0.0015, wear: dents(0.0014, 45, seed), tint })
    brick(0, 0, 0, 2, [1, 0.96, 0.92])
    brick(0.0522, 0.035, 0.006, 5, [0.94, 0.88, 0.84])

    k.put(sphereMesh(0.022, 5, 12).displace((x, y, z) => (noise3(x * 90, y * 90, z * 90, 3) - 0.5) * 0.012), 'concrete', { at: [0.07, 0.104, 0.02], scale: [1.4, 0.32, 1], tint: [0.78, 0.76, 0.72] })
  },
  'concrete-block': (k) => {
    const outline: V2[] = [[-0.195, -0.07], [0.195, -0.07], [0.195, 0.043], [0.186, 0.051], [0.181, 0.063], [0.172, 0.07], [-0.195, 0.07]]
    k.extrude('concrete', outline, 0.19, [0, 0.095, 0], { axis: 'y', holes: [rrect(0.13, 0.085, 0.014, 3, -0.0925, 0), rrect(0.13, 0.085, 0.014, 3, 0.0925, 0)], bevel: 0.003, wear: dents(0.0022, 28, 3), tint: [0.86, 0.85, 0.83] })
  },
  'cement-bag': (k) => sack(k, k.w, k.h, k.d - 0.02, { ends: 'block', tint: KRAFT, seed: 4, prints: [{ tint: [0.16, 0.3, 0.62], u0: 0.12, u1: 0.88, v0: 0.16, v1: 0.52 }, { tint: [0.86, 0.16, 0.12], u0: 0.22, u1: 0.78, v0: 0.6, v1: 0.7 }, { tint: [0.95, 0.94, 0.9], u0: 0.3, u1: 0.7, v0: 0.76, v1: 0.84 }] }),
  'sand-bag': (k) => sack(k, k.w, k.h, k.d, { m: 'fabric', ends: 'tied', tint: [0.9, 0.88, 0.8], seed: 6, tie: [0.2, 0.42, 0.18], prints: [{ tint: [0.28, 0.45, 0.22], u0: 0.3, u1: 0.7, v0: 0.32, v1: 0.58 }] }),
  'hydrated-lime': (k) => sack(k, k.w, k.h, k.d - 0.02, { ends: 'block', tint: [0.95, 0.94, 0.9], seed: 8, prints: [{ tint: [0.12, 0.5, 0.28], u0: 0.1, u1: 0.9, v0: 0.2, v1: 0.5 }, { tint: [0.2, 0.2, 0.22], u0: 0.25, u1: 0.75, v0: 0.58, v1: 0.66 }] }),
  'fiber-cement-tile': (k) => {

    const pitch = 0.177, amp = 0.0215, t = 0.006, n = 64, half = k.d / 2 - 0.005, top: V2[] = [], bottom: V2[] = []
    for (let i = 0; i <= n; i++) { const x = -half + 2 * half * i / n, y = t + amp * (1 - Math.cos((x + half) / pitch * TAU)); top.push([x, y]); bottom.push([x, y - t]) }
    k.extrude('concrete', [...bottom, ...top.reverse()], k.w - 0.02, [0, 0, 0], { axis: 'x', bevel: 0.0012, wear: dents(0.0016, 22, 5), tint: [0.8, 0.8, 0.78] })
  },
  'clay-roof-tiles': (k) => {

    const W = 0.22, t = 0.012, sec: V2[] = []
    for (let i = 0; i <= 40; i++) { const x = -W / 2 + W * i / 40, ch = Math.abs(x) < W * 0.42 ? 0.006 * (1 - Math.cos((x + W * 0.42) / (W * 0.42) * TAU)) / 2 : 0; sec.push([x, t + 0.002 - ch + (x > W * 0.44 ? 0.005 : 0)]) }
    const outline: V2[] = [[-W / 2, 0], [W / 2, 0], ...sec.slice().reverse()]
    const tile = (seed: number) => extrudeRaw(fillet2(outline, 0.0015, 2, true), k.w - 0.03, { bevel: 0.0015 }).displace(dents(0.0012, 40, seed)).smooth(40)
    k.put(merge(place(tile(1), { yaw: Math.PI / 2 }), shade(place(tile(2), { yaw: Math.PI / 2 + 0.02, at: [0.012, t + 0.0035, 0.004] }), 0.9)), 'brick', { tint: [0.96, 0.62, 0.42] })
  },
  'plastic-tarp': (k) => {

    const layers: Raw[] = []
    for (let i = 0; i < 4; i++) layers.push(place(rboxRaw(k.w - 0.02 - i * 0.006, 0.0175, k.d - 0.02 - i * 0.004, { r: 0.0085, seg: [12, 2, 9], disp: (f, s, t) => (noise3(s * 24, t * 24, f + i * 7, i) - 0.5) * 0.003 }), { at: [k.jitter(0.004), 0.009 + i * 0.0182, k.jitter(0.004)] }))
    k.put(merge(...layers), 'rubber', { tint: [0.18, 0.38, 0.72] })
    for (const [x, z] of [[0.13, 0.09], [0.13, -0.08]] as const) k.torus('steel', 0.0065, 0.0018, [x, 0.0745, z], { seg: 8, segR: 16, tint: [0.85, 0.78, 0.5] })
    k.box('paper', [0.09, 0.0012, 0.06], [-0.05, 0.0746, 0.01], { r: 0, tint: [0.95, 0.94, 0.9] })
  },
  'asphalt-membrane': (k) => {
    const R = 0.094, rIn = 0.024, H = k.h - 0.02

    const spiral: V3[] = []
    for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * 14 * TAU, r = rIn + 0.004 + (R - rIn - 0.008) * t; spiral.push([Math.cos(a) * r, H + 0.0004, Math.sin(a) * r]) }
    k.put(merge(
      latheRaw(fillet2([[rIn, 0], [R, 0], [R, H], [rIn, H], [rIn, 0]], 0.002, 2), { seg: 48, crease: 60 }),
      shade(sweepRaw(spiral, 0.0009, { seg: 4 }), 0.5),
      shade(latheRaw([[R + 0.0016, 0.004], [R + 0.0016, H - 0.004]], { seg: 48, arc: TAU * 0.86 }), 1.15),
    ), 'rubber', { tint: [0.2, 0.2, 0.21] })
    k.lathe('paper', [[R + 0.003, H * 0.38], [R + 0.003, H * 0.62]], [0, 0, 0], { seg: 48, tint: [0.92, 0.9, 0.84] })
  },
  'glass-pane': (k) => {
    const { w, d } = k, t = 0.004

    const outline: V2[] = [[-w / 2, -d / 2], [w / 2 - 0.02, -d / 2], [w / 2 - 0.012, -d / 2 + 0.018], [w / 2, -d / 2 + 0.03], [w / 2, d / 2], [-w / 2, d / 2]]
    k.extrude('glass', outline, t, [0, t / 2, 0], { axis: 'y', bevel: 0.0008, tint: [0.86, 0.95, 0.93] })

    for (const [x, z, yaw] of [[-w / 2, -d / 2, 0], [w / 2, -d / 2, -Math.PI / 2]] as const) k.frame({ at: [x, 0, z], yaw }, () => {
      k.box('paper', [0.05, 0.0012, 0.05], [0.025, t + 0.0006, 0.025], { r: 0, tint: KRAFT })
      k.box('paper', [0.0012, t + 0.0024, 0.05], [-0.0006, (t + 0.0024) / 2, 0.025], { r: 0, tint: KRAFT })
      k.box('paper', [0.05, t + 0.0024, 0.0012], [0.025, (t + 0.0024) / 2, -0.0006], { r: 0, tint: KRAFT })
    })
    k.box('paper', [0.06, 0.0008, 0.035], [0.12, t + 0.0004, 0.1], { r: 0, tint: [0.95, 0.85, 0.2] })
  },
  'pvc-pipe': (k) => {
    const r = 0.025, rin = 0.0232, L = k.w - 0.02, bell = 0.06, br = r + 0.0035
    k.lathe('plaster', fillet2([[rin, 0], [r, 0], [r, L - bell], [br, L - bell + 0.012], [br, L], [br - 0.0018, L], [br - 0.0018, L - bell + 0.013], [rin, L - bell + 0.002], [rin, 0]], 0.0006, 2), [-L / 2, br, 0], { axis: 'x', seg: 32, crease: 60, tint: [0.97, 0.97, 0.95] })
    k.lathe('paper', [[r + 0.0008, 0.06], [r + 0.0008, L - bell - 0.05]], [-L / 2, br, 0], { axis: 'x', seg: 32, arc: 0.3, phase: Math.PI / 2 - 0.15, tint: [0.12, 0.12, 0.14] })
  },
  'garden-hose': (k) => {
    const pts = coil(k, 'rubber', 0.148, 0.0088, 3.2, { tint: [0.32, 0.62, 0.26], lay: 'ribs', tails: 0.07, seed: 4, ties: { tint: [0.95, 0.75, 0.15], count: 2 } })
    atEnd(k, pts, () => {
      k.lathe('paint', fillet2([[0, -0.012], [0.0105, -0.012], [0.0115, 0.004], [0.0125, 0.008], [0.0125, 0.026], [0.009, 0.03], [0.009, 0.042], [0, 0.042]], 0.0012, 2), [0, 0, 0], { seg: 18, wear: (x, y, z) => (y > 0.008 && y < 0.026 ? Math.max(0, Math.cos(Math.atan2(z, x) * 8)) * 0.0008 : 0), tint: [0.95, 0.55, 0.1] })
    }, 0.01)
  },
  'epoxy-putty': (k) => blister(k, k.w, k.d, { card: [0.96, 0.74, 0.12], hang: true, bubble: { w: 0.076, d: 0.032, h: 0.024, z: 0.002 }, prints: [{ x: 0, z: 0.0255, w: 0.07, d: 0.008, tint: [0.15, 0.15, 0.4] }] }, () => {
    k.cyl('plaster', 0.0075, 0.066, [0, 0.0012 + 0.0075, 0.002 - 0.0078], { axis: 'x', seg: 18, tint: [0.62, 0.62, 0.64] })
    k.cyl('plaster', 0.0075, 0.066, [0, 0.0012 + 0.0075, 0.002 + 0.0078], { axis: 'x', seg: 18, tint: [0.96, 0.95, 0.9] })
  }),
  'contact-glue': (k) => tin(k, 0.038, 0.098, { lid: 'cone', tint: [0.95, 0.8, 0.12], capTint: [0.85, 0.14, 0.1], labels: [{ y0: 0.12, y1: 0.86, tint: [0.97, 0.84, 0.15] }, { y0: 0.38, y1: 0.62, tint: [0.12, 0.14, 0.42], arc: 2.2 }] }),
  'silicone-sealant': (k) => {
    const r = 0.0235, L = 0.165, at: V3 = [-k.w / 2 + 0.005, r, 0]
    k.lathe('paint', fillet2([[0, 0.005], [r - 0.003, 0.005], [r - 0.003, 0.0008], [r, 0], [r, L], [r - 0.0015, L + 0.006], [0.0088, L + 0.009], [0.0088, L + 0.018], [0, L + 0.018]], 0.0008, 2), at, { axis: 'x', seg: 32, crease: 60, tint: [0.96, 0.96, 0.95] })
    k.lathe('paper', [[r + 0.0012, 0.012], [r + 0.0012, L - 0.012]], at, { axis: 'x', seg: 32, tint: [0.15, 0.32, 0.65] })
    k.lathe('paper', [[r + 0.0024, 0.05], [r + 0.0024, 0.1]], at, { axis: 'x', seg: 32, arc: 2.4, tint: [0.96, 0.96, 0.95] })
    k.lathe('paint', fillet2([[0, L + 0.012], [0.0098, L + 0.012], [0.0098, L + 0.026], [0.0062, L + 0.034], [0.0022, L + 0.058], [0, L + 0.058]], 0.0008, 2), at, { axis: 'x', seg: 18, tint: [0.92, 0.92, 0.88], wear: (x, y, z) => (y < L + 0.026 ? Math.max(0, Math.cos(Math.atan2(z, x) * 10)) * 0.0005 : 0) })
  },
  'expanding-foam': (k) => {
    aerosol(k, 0.033, 0.21, { cap: 'button', tint: [0.94, 0.94, 0.95], capTint: [0.2, 0.2, 0.22], labels: [{ y0: 0.08, y1: 0.7, tint: [0.12, 0.42, 0.78] }, { y0: 0.3, y1: 0.48, tint: [0.98, 0.78, 0.1], arc: 2.4 }] })
    const top = 0.21 * 0.9 + 0.0155
    k.tube('paint', [[0.0105, top, 0], [0.03, top + 0.002, 0], [0.06, top - 0.004, 0], [0.085, top - 0.02, 0]], 0.0028, { seg: 8, tint: [0.92, 0.92, 0.9] })
  },
  'latex-paint': (k) => {
    const r = 0.118, h = 0.258
    tin(k, r, h, { lid: 'press', bail: true, beads: 2, tint: [0.9, 0.9, 0.92], labels: [{ y0: 0.22, y1: 0.86, tint: [0.97, 0.97, 0.98] }, { y0: 0.42, y1: 0.72, tint: [0.18, 0.42, 0.78], arc: 2.6 }] })

    for (const [a, len] of [[0.6, 0.07], [0.95, 0.045], [-2.4, 0.1]] as const) {
      const pts: V3[] = Array.from({ length: 7 }, (_, i) => { const y = h - 0.004 - len * i / 6, rr = r + 0.0034; return [Math.cos(a) * rr, y, Math.sin(a) * rr] })
      k.put(sweepRaw(pts, 0.0026, { seg: 6, radius: (_s, _a, t) => 1 - t * 0.35 }), 'paint', { tint: [0.78, 0.38, 0.26] })
    }
  },
  'spray-paint': (k) => aerosol(k, 0.033, 0.198, { tint: [0.14, 0.14, 0.16], capTint: [0.86, 0.16, 0.12], labels: [{ y0: 0.12, y1: 0.76, tint: [0.86, 0.16, 0.12] }, { y0: 0.36, y1: 0.52, tint: [0.95, 0.95, 0.95], arc: 2 }] }),
  'demolition-wood': (k) => {

    const T = 0.022
    k.put(boardRaw(0.58, 0.11, T, { seed: 11, rough: 0.0012, split: 0.025 }), 'wood', { at: [0, 0, -0.07], tint: OLD })
    k.put(boardRaw(0.52, 0.095, T, { seed: 12, rough: 0.0012, split: 0.03 }), 'wood', { at: [0.02, 0, 0.065], yaw: Math.PI, tint: [0.66, 0.6, 0.55] })
    k.put(boardRaw(0.5, 0.09, T, { seed: 13, rough: 0.0012, split: 0.02 }), 'wood', { at: [-0.02, T + 0.0002, 0], yaw: 0.32, tint: [0.78, 0.7, 0.62] })

    k.put(boardRaw(0.44, 0.07, 0.03, { seed: 14, rough: 0.0014, split: 0.03 }), 'wood', { at: [0.05, 2 * T + 0.0006, 0.01], yaw: -0.5, tint: [0.6, 0.55, 0.5] })
    k.box('paint', [0.16, 0.0009, 0.05], [-0.12, T + 0.0011, -0.08], { r: 0, tint: [0.36, 0.55, 0.62] })
    bentNail(k, [0.2, T, -0.07], 1)
    bentNail(k, [-0.18, 2 * T + 0.0002, 0.06], 2.6)
  },
  'wooden-door': (k) => {

    const W = k.w, L = k.d, T = 0.038, cols = [-0.18, 0.18], rows = [-0.62, 0, 0.62], pw = 0.27, pl = 0.5
    const holes = rows.flatMap((z) => cols.map((x) => rrect(pw, pl, 0.004, 2, x, z)))
    k.extrude('wood', rrect(W, L, 0.003, 2), T, [0, T / 2, 0], { axis: 'y', holes, bevel: 0.002, tint: [0.78, 0.6, 0.44] })
    for (const z of rows) for (const x of cols) k.extrude('wood', rrect(pw, pl, 0.004, 2), T * 0.55, [x, T / 2, -z], { axis: 'y', bevel: 0.007, bevelSeg: 3, tint: [0.74, 0.56, 0.4] })
    for (const z of [-0.8, 0, 0.8]) k.cyl('steel', 0.0065, 0.09, [-W / 2 - 0.002, T / 2, z], { axis: 'z', seg: 14, tint: [0.75, 0.68, 0.45] })
    k.frame({ at: [W / 2 - 0.065, T, 0.02] }, () => {
      k.box('steel', [0.05, 0.004, 0.18], [0, 0.002, 0], { r: 0.0015, tint: [0.72, 0.66, 0.45] })
      k.cyl('steel', 0.011, 0.02, [0, 0.014, -0.045], { seg: 18, tint: [0.72, 0.66, 0.45] })
      k.tube('steel', [[0, 0.022, -0.045], [0, 0.026, -0.055], [-0.01, 0.027, -0.12]], 0.0075, { seg: 10, tint: [0.72, 0.66, 0.45] })
      k.box('paint', [0.009, 0.0012, 0.018], [0, 0.0046, 0.05], { r: 0.0006, tint: [0.1, 0.1, 0.1] })
    })
  },
}
