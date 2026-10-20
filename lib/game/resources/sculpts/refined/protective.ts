import { smooth, type V2, type V3 } from '../../../blockout/sculpt/kit'
import { circle, dents, easeStations, fillet2, knurl, loftRaw, merge, ringPath, rrect, sweepRaw, type ResourceFamily, type Station } from '../forms'
import { facing, minY, normalOf, ruledRaw, slabRaws, surfaceRaw, unit } from './parts'

const TAU = Math.PI * 2
const BLACK: V3 = [0.12, 0.12, 0.13], OLIVE: V3 = [0.42, 0.45, 0.3], TAN: V3 = [0.7, 0.58, 0.4], SUEDE: V3 = [0.78, 0.6, 0.4], GREEN: V3 = [0.24, 0.42, 0.3]

const MOTO = { rx: 0.124, ry: 0.158, rz: 0.142, cy: 0.1, cz: -0.006, chin: 0.03 }
const MOTO_CENTER: V3 = [0, MOTO.cy, MOTO.cz]

function moto(th: number, ph: number, off = 0): V3 {
  const s = Math.sin(th), f = Math.cos(ph), jut = MOTO.chin * smooth(1.45, 2.25, th) * Math.max(0, f) ** 2
  return [(MOTO.rx + off) * s * Math.sin(ph), MOTO.cy + (MOTO.ry + off) * Math.cos(th), MOTO.cz + (MOTO.rz + off) * s * f + jut]
}

const motoEdge = (ph: number) => { const f = Math.cos(ph); return 1.926 + 0.33 * Math.max(0, f) ** 1.5 + 0.19 * Math.max(0, -f) ** 1.5 }

const HH = { rx: 0.1, ry: 0.112, rz: 0.118, y0: 0.022 }
const brimWidth = (ph: number) => 0.012 + 0.046 * Math.max(0, Math.cos(ph)) ** 3 + 0.01 * Math.max(0, -Math.cos(ph)) ** 2

function hardHat(u: number, v: number, off: number): V3 {
  const { rx, ry, rz, y0 } = HH, ph = Math.PI + u * TAU, sp = Math.sin(ph), cp = Math.cos(ph), vd = 0.78
  if (v <= vd) {
    const th = (v / vd) * Math.PI / 2, s = Math.sin(th), c = Math.cos(th), n = unit([s * sp / rx, c / ry, s * cp / rz]), x = rx * s * sp
    const fade = smooth(0.18, 0.4, th) * (1 - smooth(1.32, 1.52, th))
    const d = (0.0038 * Math.exp(-((x / 0.009) ** 2)) + 0.0022 * Math.exp(-(((Math.abs(x) - 0.047) / 0.006) ** 2))) * fade + off
    return [x + n[0] * d, y0 + ry * c + n[1] * d, rz * s * cp + n[2] * d]
  }
  const s = (v - vd) / (1 - vd), e = unit([sp / rx, 0, cp / rz]), w = brimWidth(ph) * s, blend = smooth(0, 0.35, s)
  const dir = unit([e[0] * (1 - blend), blend, e[2] * (1 - blend)])
  return [rx * sp + e[0] * w + dir[0] * off, y0 - 0.004 * s + 0.0045 * smooth(0.72, 1, s) + dir[1] * off, rz * cp + e[2] * w + dir[2] * off]
}

const BH = { rx: 0.118, ry: 0.15, rzf: 0.134, rzb: 0.13, cy: 0.03 }
const BH_CENTER: V3 = [0, BH.cy, 0]
function bh(th: number, ph: number, off = 0): V3 {
  const s = Math.sin(th), f = Math.cos(ph), rz = (f > 0 ? BH.rzf : BH.rzb) + off
  return [(BH.rx + off) * s * Math.sin(ph), BH.cy + (BH.ry + off) * Math.cos(th), rz * s * f]
}

const bhEdge = (ph: number) => {
  const a = Math.atan2(Math.sin(ph), Math.cos(ph)), f = Math.cos(ph)
  const y = 0.03 * Math.max(0, f) ** 2 + 0.014 * Math.exp(-(((Math.abs(a) - Math.PI / 2) / 0.28) ** 2)) + 0.002 * Math.max(0, -f)
  return Math.acos(Math.max(-1, Math.min(1, (y - BH.cy) / BH.ry)))
}

export const PROTECTIVE_REFINED: ResourceFamily = {
  'motorcycle-helmet': (k) => {

    const ring = (off: number) => Array.from({ length: 96 }, (_, i): V3 => { const ph = Math.PI + i / 96 * TAU; return moto(motoEdge(ph), ph, off) })
    const outer = surfaceRaw((u, v) => { const ph = Math.PI + u * TAU; return moto(v * motoEdge(ph), ph) }, 96, 44, { closedU: true, outward: { uv: [0.5, 0.4], dir: [0, 0.4, 1] } })
    const liner = surfaceRaw((u, v) => { const ph = Math.PI + u * TAU; return moto(v * motoEdge(ph), ph, -0.022) }, 64, 30, { closedU: true, outward: { uv: [0.5, 0.4], dir: [0, -0.4, -1] } })
    const edgeOut = ring(0), edgeIn = ring(-0.022)
    const rim = ruledRaw(edgeOut, edgeIn, () => [0, -1, 0], true)
    const bead = sweepRaw(edgeOut, 0.004, { closed: true, seg: 8 })
    const roll = sweepRaw(edgeIn.map(([x, y, z]): V3 => [x * 0.96, y + 0.012, MOTO.cz + (z - MOTO.cz) * 0.96]), 0.011, { closed: true, seg: 10 })
    const low = minY(outer, rim, bead, roll)
    k.frame({ at: [0, -low, 0] }, () => {
      k.put(outer, 'paint', { tint: [0.32, 0.34, 0.37] })
      k.put(liner, 'fabric', { tint: BLACK })
      k.put(rim, 'rubber', { tint: BLACK })
      k.put(bead, 'rubber', { tint: BLACK })
      k.put(roll, 'fabric', { tint: [0.15, 0.15, 0.16] })
      const visor = (u: number, v: number, off: number) => { const ph = -1.38 + u * 2.76, q = (ph / 1.38) ** 2, top = 1.02 + 0.32 * q, bot = 1.74 - 0.26 * q; return moto(top + (bot - top) * v, ph, off) }
      k.put(merge(...slabRaws(visor, 0.003, 0.0058, 40, 14, [0, 0.2, 1])), 'glass', { tint: [0.28, 0.31, 0.34] })
      const seat = (th: number, ph: number, lift: number, fn: () => void) => k.frame({ at: moto(th, ph, lift), ...facing(normalOf(moto, th, ph, MOTO_CENTER)) }, fn)
      for (const s of [-1, 1]) seat(1.41, s * 1.43, 0.0075, () => { k.cyl('charcoal', 0.02, 0.005, [0, 0, 0], { seg: 32, bevel: 0.0015, tint: BLACK }); k.cyl('charcoal', 0.0065, 0.002, [0, 0.0032, 0], { seg: 16, tint: BLACK }) })
      seat(2.02, 0, 0.002, () => { k.box('charcoal', [0.052, 0.008, 0.024], [0, 0, 0], { r: 0.003, tint: BLACK }); for (const z of [-0.006, 0, 0.006]) k.box('rubber', [0.04, 0.003, 0.0025], [0, 0.0045, z], { r: 0.001, tint: BLACK }) })
      for (const s of [-1, 1]) seat(0.45, s * 0.32, 0.002, () => { k.box('charcoal', [0.024, 0.008, 0.042], [0, 0, 0], { r: 0.003, tint: BLACK }); k.box('rubber', [0.012, 0.003, 0.022], [0, 0.0045, 0.004], { r: 0.001, tint: BLACK }) })
      seat(1.18, Math.PI, 0.003, () => k.box('charcoal', [0.11, 0.012, 0.032], [0, 0, 0], { r: 0.006, tint: BLACK }))
      seat(1.68, -0.78, 0.006, () => k.box('charcoal', [0.02, 0.005, 0.014], [0, 0, 0], { r: 0.002, tint: BLACK }))
    })
  },

  'hard-hat': (k) => {

    const outer = surfaceRaw((u, v) => hardHat(u, v, 0), 96, 40, { closedU: true, outward: { uv: [0.5, 0.3], dir: [0, 1, 0.3] } })
    const inner = surfaceRaw((u, v) => hardHat(u, v, -0.003), 72, 30, { closedU: true, outward: { uv: [0.5, 0.3], dir: [0, -1, -0.3] } })
    const us = Array.from({ length: 96 }, (_, i) => i / 96)
    const lip = ruledRaw(us.map((u) => hardHat(u, 1, 0)), us.map((u) => hardHat(u, 1, -0.003)), ([x, , z]) => [x, 0, z], true)
    const low = minY(outer, inner, lip)
    k.frame({ at: [0, -low, 0] }, () => {
      const yellow: V3 = [0.96, 0.78, 0.16]
      k.put(merge(outer, inner, lip), 'paint', { tint: yellow })
      const y = HH.y0 + 0.012

      const strap = (a: number) => sweepRaw(Array.from({ length: 13 }, (_, i): V3 => { const s = i / 6 - 1; return [Math.sin(a) * s * HH.rx * 0.8, y + 0.068 * (1 - s * s), Math.cos(a) * s * HH.rz * 0.82] }), 0.009, { seg: 8, flat: 0.25 })
      k.put(merge(sweepRaw(ringPath(HH.rx * 0.8, HH.rz * 0.82, y, 48), 0.011, { closed: true, seg: 8, flat: 0.2 }), strap(Math.PI * 0.28), strap(Math.PI * 0.72)), 'rubber', { tint: BLACK })
      for (const a of [0.9, -0.9, Math.PI - 0.9, 0.9 - Math.PI]) {
        const sa = Math.sin(a), ca = Math.cos(a)
        k.put(sweepRaw([[sa * HH.rx * 0.8, y, ca * HH.rz * 0.82], [sa * (HH.rx - 0.0035), y, ca * (HH.rz - 0.0035)]], 0.0055, { seg: 6, flat: 0.5 }), 'rubber', { tint: BLACK })
      }
      k.frame({ at: [0, y, -HH.rz * 0.82 - 0.003], yaw: Math.PI }, () => k.lathe('rubber', [[0, 0], [0.016, 0], [0.017, 0.004], [0.016, 0.011], [0, 0.012]], [0, 0, 0], { axis: 'z', seg: 32, tint: BLACK, wear: knurl(16, 0.0008, 0.014) }))
      k.put(sweepRaw(Array.from({ length: 11 }, (_, i): V3 => { const a = -1 + i / 5; return [Math.sin(a) * HH.rx * 0.78, y, Math.cos(a) * HH.rz * 0.8] }), 0.0095, { seg: 8, flat: 0.28 }), 'fabric', { tint: [0.62, 0.56, 0.45] })
    })
  },

  'ballistic-helmet': (k) => {

    const shell = (off: number) => surfaceRaw((u, v) => { const ph = Math.PI + u * TAU; return bh(v * bhEdge(ph), ph, off) }, 96, 40, { closedU: true, outward: { uv: [0.5, 0.3], dir: off < 0 ? [0, -1, -0.4] : [0, 1, 0.4] } })
    const outer = shell(0), inner = shell(-0.009)
    const mid = Array.from({ length: 96 }, (_, i): V3 => { const ph = Math.PI + i / 96 * TAU, th = bhEdge(ph), a = bh(th, ph), b = bh(th, ph, -0.009); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] })
    const trim = sweepRaw(mid, 0.0055, { closed: true, seg: 8 })
    const low = minY(outer, inner, trim)
    k.frame({ at: [0, -low, 0] }, () => {
      k.put(outer, 'paint', { tint: OLIVE }); k.put(inner, 'paint', { tint: OLIVE }); k.put(trim, 'rubber', { tint: BLACK })
      const seat = (th: number, ph: number, lift: number, fn: () => void) => k.frame({ at: bh(th, ph, lift), ...facing(normalOf(bh, th, ph, BH_CENTER)) }, fn)
      seat(0.66, 0, 0.0025, () => {
        k.extrude('charcoal', rrect(0.056, 0.04, 0.008), 0.005, [0, 0, 0], { axis: 'y', bevel: 0.0012, holes: [circle(0.0045, 16, -0.016, 0.006), circle(0.0045, 16, 0.016, 0.006)], tint: BLACK })
        k.cyl('charcoal', 0.006, 0.004, [0, 0.0045, 0.008], { seg: 16, tint: BLACK })
      })
      for (const s of [-1, 1]) {
        const pts = Array.from({ length: 17 }, (_, i): V3 => { const ph = s * (0.8 + i / 16 * 1.45); return bh(bhEdge(ph) - 0.24, ph, 0.0035) })
        k.put(sweepRaw(pts, 0.0075, { seg: 8, flat: 0.45 }), 'charcoal', { tint: BLACK })
        for (const t of [0.25, 0.75]) { const ph = s * (0.8 + t * 1.45); seat(bhEdge(ph) - 0.24, ph, 0.007, () => k.cyl('charcoal', 0.004, 0.002, [0, 0, 0], { seg: 12, tint: BLACK })) }
        seat(1.25, s * Math.PI / 2, -0.017, () => k.box('rubber', [0.06, 0.016, 0.045], [0, 0, 0], { r: 0.007, tint: BLACK }))
      }
      k.lathe('rubber', [[0, 0], [0.038, 0], [0.04, 0.006], [0.036, 0.016], [0, 0.018]], [0, BH.cy + BH.ry - 0.009 - 0.018, 0], { seg: 32, tint: BLACK })
      const side = (s: number): V3 => { const ph = s * 1.25; return bh(bhEdge(ph) - 0.08, ph, -0.011) }
      const L = side(-1), R = side(1), f = low + 0.004
      k.put(sweepRaw([L, [L[0] * 0.9, f + 0.016, L[2] * 0.8], [L[0] * 0.55, f, L[2] * 0.45 + 0.02], [0, f, 0.04], [R[0] * 0.55, f, R[2] * 0.45 + 0.02], [R[0] * 0.9, f + 0.016, R[2] * 0.8], R], 0.0095, { seg: 8, flat: 0.18 }), 'fabric', { tint: TAN })
      k.box('charcoal', [0.03, 0.007, 0.024], [0.03, f + 0.002, 0.038], { r: 0.002, tint: BLACK })
    })
  },

  'bulletproof-vest': (k) => {

    const outline: V2[] = [[-0.135, -0.16], [0.135, -0.16], [0.14, -0.05], [0.13, 0.06], [0.105, 0.1], [0.095, 0.17], [0.055, 0.17], [0.05, 0.11], [-0.05, 0.11], [-0.055, 0.17], [-0.095, 0.17], [-0.105, 0.1], [-0.13, 0.06], [-0.14, -0.05]]
    k.extrude('fabric', fillet2(outline, 0.012, 4, true), 0.03, [0, 0.015, 0], { axis: 'y', bevel: 0.008, bevelSeg: 3, tint: OLIVE })
    for (const z of [0.13, 0.092, 0.054, 0.016]) {
      k.box('fabric', [0.25, 0.0024, 0.025], [0, 0.0312, z], { r: 0.0008, tint: OLIVE })
      for (let i = 0; i < 7; i++) k.box('fabric', [0.0032, 0.0016, 0.026], [-0.114 + i * 0.038, 0.0332, z], { r: 0.0004, tone: 0.7, tint: OLIVE })
    }
    for (const x of [-0.082, 0, 0.082]) {
      k.box('fabric', [0.074, 0.032, 0.1], [x, 0.0484, 0.08], { r: 0.008, tint: OLIVE })
      k.box('fabric', [0.077, 0.008, 0.05], [x, 0.0674, 0.052], { r: 0.004, tone: 0.92, tint: OLIVE })
      k.box('charcoal', [0.016, 0.004, 0.012], [x, 0.0718, 0.074], { r: 0.0015, tint: BLACK })
    }
    k.box('fabric', [0.16, 0.004, 0.07], [0, 0.032, -0.035], { r: 0.003, tone: 0.95, tint: OLIVE })
    for (const s of [-1, 1]) {
      k.box('fabric', [0.042, 0.012, 0.05], [s * 0.075, 0.036, -0.14], { r: 0.005, tint: OLIVE })
      k.box('rubber', [0.08, 0.006, 0.11], [s * 0.172, 0.003, 0.06], { r: 0.002, tint: TAN })
      k.box('charcoal', [0.022, 0.008, 0.04], [s * 0.212, 0.004, 0.06], { r: 0.002, tint: BLACK })
    }
    k.put(sweepRaw([[-0.03, 0.03, -0.098], [-0.03, 0.042, -0.112], [0.03, 0.042, -0.112], [0.03, 0.03, -0.098]], 0.0016, { seg: 6, flat: 9 }), 'rubber', { tint: TAN })
  },

  'work-gloves': (k) => {

    k.cushion('leather', [0.088, 0.024, 0.098], [0, 0.012, -0.012], { puff: 0.006, r: 0.01, wrinkle: 0.5, tint: SUEDE })
    const fingers: [number, number, number][] = [[-0.031, 0.062, 0.0095], [-0.0105, 0.074, 0.0102], [0.0105, 0.07, 0.01], [0.031, 0.056, 0.0091]]
    for (const [x, L, r] of fingers) {
      const tip: V3 = [x * 1.1, r + 0.0002, 0.022 + L]
      k.put(sweepRaw([[x * 0.98, 0.0118, 0.022], [x * 1.04, 0.0112, 0.022 + L * 0.5], [x * 1.08, 0.0102, 0.022 + L * 0.86], tip], r, { seg: 14, radius: (_s, _a, t) => 1 - 0.12 * t }), 'leather', { tint: SUEDE })
      k.sphere('leather', r * 0.88, tip, { rows: 6, seg: 12, tint: SUEDE })
    }
    const thumbTip: V3 = [0.068, 0.0102, 0.026]
    k.put(sweepRaw([[0.038, 0.012, -0.012], [0.056, 0.0112, 0.006], thumbTip], 0.0108, { seg: 14, radius: (_s, _a, t) => 1 - 0.1 * t }), 'leather', { tint: SUEDE })
    k.sphere('leather', 0.0095, thumbTip, { rows: 6, seg: 12, tint: SUEDE })
    k.box('leather', [0.088, 0.004, 0.02], [0, 0.0262, 0.018], { r: 0.0015, tint: [0.62, 0.45, 0.3] })
    k.lathe('fabric', [[0.04, 0], [0.0435, 0], [0.0435, 0.062], [0.04, 0.062], [0.04, 0]], [0, 0.0216, -0.122], { axis: 'z', seg: 40, scale: [1.05, 0.5, 1], tint: [0.55, 0.5, 0.42] })
    k.lathe('rubber', [[0.0436, 0], [0.0448, 0], [0.0448, 0.007], [0.0436, 0.007], [0.0436, 0]], [0, 0.0216, -0.123], { axis: 'z', seg: 40, scale: [1.05, 0.5, 1], tint: TAN })
  },

  'camping-tent': (k) => k.frame({ at: [0, 0, -0.0128] }, () => {

    const bag: Station[] = easeStations([{ y: 0, rx: 0.03, rz: 0.03 }, { y: 0.012, rx: 0.064, rz: 0.064 }, { y: 0.036, rx: 0.081, rz: 0.08 }, { y: 0.52, rx: 0.083, rz: 0.081 }, { y: 0.545, rx: 0.07, rz: 0.068 }, { y: 0.56, rx: 0.036, rz: 0.036 }], 3)
    k.put(loftRaw(bag, { seg: 48, wear: dents(0.004, 18, 7) }).orient('x'), 'fabric', { at: [-0.28, 0.083, 0], tint: GREEN })
    k.lathe('fabric', [[0.012, 0], [0.034, 0], [0.036, 0.008], [0.03, 0.016], [0.012, 0.016], [0.012, 0]], [0.27, 0.083, 0], { axis: 'x', seg: 32, wear: knurl(14, 0.002, 0.02), tint: GREEN })
    k.put(sweepRaw([[0.284, 0.083, 0], [0.298, 0.075, 0.006], [0.305, 0.05, 0.012], [0.3, 0.03, 0.02]], 0.0022, { seg: 6 }), 'fabric', { tint: BLACK })
    k.cyl('charcoal', 0.006, 0.014, [0.3, 0.024, 0.021], { seg: 14, tint: BLACK })
    for (const x of [-0.13, 0.13]) {
      const R = 0.0845
      k.put(sweepRaw(Array.from({ length: 48 }, (_, i): V3 => { const a = i / 48 * TAU; return [x, 0.083 + Math.cos(a) * R, Math.sin(a) * R] }), 0.0015, { closed: true, seg: 6, flat: 11 }), 'rubber', { tint: TAN })
      k.box('charcoal', [0.022, 0.006, 0.03], [x, 0.083 + R + 0.002, 0], { r: 0.002, tint: BLACK })
    }
    k.put(sweepRaw([[-0.07, 0.165, 0], [-0.058, 0.18, 0], [0.058, 0.18, 0], [0.07, 0.165, 0]], 0.0015, { seg: 6, flat: 10 }), 'rubber', { tint: TAN })
    const pole: Station[] = [{ y: 0, rx: 0.012, rz: 0.012 }, { y: 0.008, rx: 0.021, rz: 0.021 }, { y: 0.45, rx: 0.022, rz: 0.022 }, { y: 0.46, rx: 0.014, rz: 0.014 }]
    k.put(loftRaw(pole, { seg: 24, wear: dents(0.0015, 30, 3) }).orient('x'), 'fabric', { at: [-0.24, 0.022, 0.0845], tint: GREEN })
    for (const [dy, dz] of [[0.006, 0], [-0.004, 0.006], [-0.004, -0.006]]) k.cyl('steel', 0.0045, 0.03, [0.232, 0.022 + dy, 0.0845 + dz], { axis: 'x', seg: 12, tint: [0.7, 0.72, 0.75] })
  }),
}
