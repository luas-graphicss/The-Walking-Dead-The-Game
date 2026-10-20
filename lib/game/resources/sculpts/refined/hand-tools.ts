import { sheetRaw, type V2, type V3 } from '../../../blockout/sculpt/kit'
import { gripRaw } from '../archetypes'
import { bladeRaw, circle, ellipse, fillet2, knurl, loftRaw, place, rrect, sweepRaw, type ResourceFamily, type Station } from '../forms'
import { bore, onSide } from '../weapons'

const STEEL: V3 = [0.8, 0.81, 0.84], FORGED: V3 = [0.42, 0.43, 0.47], DARK: V3 = [0.3, 0.3, 0.32], BLACK: V3 = [0.13, 0.13, 0.14]
const RED: V3 = [0.78, 0.13, 0.1], BLUE: V3 = [0.16, 0.32, 0.66], YELLOW: V3 = [0.95, 0.78, 0.12], HICKORY: V3 = [0.8, 0.6, 0.38], ASH: V3 = [0.86, 0.74, 0.55]
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

const star12 = (cx: number, r0: number, r1: number): V2[] => Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2, r = i % 2 ? r1 : r0; return [cx + Math.cos(a) * r, Math.sin(a) * r] as V2 })

function openEnd(cx: number, R: number, half: number, angle: number): V2[] {
  const pts: V2[] = [], a0 = Math.PI - Math.asin(half / R)
  for (let i = 0; i <= 20; i++) { const a = a0 - i / 20 * 2 * a0; pts.push([Math.cos(a) * R, Math.sin(a) * R]) }
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI; pts.push([0.004 + Math.cos(a) * half, Math.sin(a) * half]) }
  const c = Math.cos(angle), s = Math.sin(angle)
  return pts.map(([x, y]): V2 => [cx + x * c - y * s, x * s + y * c])
}

export const HAND_TOOLS_REFINED: ResourceFamily = {
  hammer: (k) => onSide(k, 0.0145, () => {

    const head: Station[] = [
      { y: -0.015, rx: 0.016, rz: 0.0125, p: 4 }, { y: 0.015, rx: 0.016, rz: 0.0125, p: 4 }, { y: 0.02, rx: 0.0105, rz: 0.0105, p: 1.7 },
      { y: 0.035, rx: 0.0105, rz: 0.0105, p: 1.7 }, { y: 0.039, rx: 0.0135, rz: 0.0135, p: 2 }, { y: 0.0465, rx: 0.0145, rz: 0.0145, p: 2 }, { y: 0.049, rx: 0.0128, rz: 0.0128, p: 2 },
    ]
    k.put(loftRaw(head, { seg: 32 }), 'steel', { tint: FORGED })
    const claw = fillet2([[0.012, -0.013], [0.01, -0.035], [0.0, -0.053], [-0.016, -0.069], [-0.034, -0.077], [-0.036, -0.073], [-0.022, -0.061], [-0.01, -0.047], [-0.004, -0.033], [-0.012, -0.013]], 0.002, 2, true)
    for (const z of [-0.0058, 0.0058]) k.extrude('steel', claw, 0.0095, [0, 0, z], { bevel: 0.0015, bevelSeg: 2, tint: FORGED, warp: (_x, y, zz) => [0, 0, -zz * 0.45 * clamp01((-0.03 - y) / 0.045)] })
    k.put(place(gripRaw(0.29, 0.0125, { knob: 0.18, swell: 0.12, neck: 0.78, ratio: 0.72 }), { at: [-0.273, 0, 0], roll: -Math.PI / 2 }), 'wood', { tint: HICKORY })
    k.box('steel', [0.0016, 0.014, 0.0022], [0.0173, 0, 0], { r: 0.0004, tint: DARK })
  }, [0.128, 0.014]),

  screwdriver: (k) => k.frame({ at: [0, 0.0077, 0], roll: -0.0644 }, () => {

    bore(k, 'paint', fillet2([[0, 0], [0.0095, 0], [0.0122, 0.005], [0.0135, 0.02], [0.0128, 0.045], [0.0122, 0.062], [0.0128, 0.074], [0.0118, 0.083], [0.0082, 0.09], [0.0062, 0.094], [0, 0.095]], 0.0015, 2), -0.11, 0, { tint: RED, seg: 30, wear: (x, y, z) => (y > 0.006 && y < 0.08 ? -knurl(3, 0.0011, 0.009)(x, y, z) - knurl(15, 0.00035, 0.009)(x, y, z) : 0) })
    bore(k, 'rubber', [[0.0118, 0], [0.0131, 0], [0.0131, 0.008], [0.0118, 0.008], [0.0118, 0]], -0.04, 0, { tint: BLACK, seg: 30 })
    bore(k, 'rubber', fillet2([[0, 0], [0.0088, 0], [0.0094, 0.004], [0.0092, 0.007], [0, 0.0075]], 0.001, 2), -0.1135, 0, { tint: BLACK, seg: 24 })
    k.cyl('steel', 0.0048, 0.008, [-0.0115, 0, 0], { axis: 'x', seg: 6, tint: STEEL })
    bore(k, 'steel', [[0, 0], [0.003, 0], [0.003, 0.108], [0, 0.108]], -0.0115, 0, { tint: STEEL, seg: 14 })
    k.extrude('steel', [[0.0955, -0.003], [0.1095, -0.0006], [0.1105, 0], [0.1095, 0.0006], [0.0955, 0.003]], 0.0062, [0, 0, 0], { bevel: 0.0002, tint: STEEL })
  }),

  pliers: (k) => {

    const jaw: V2[] = [[0.072, 0.0005], [0.066, 0.0045], [0.05, 0.0072], [0.03, 0.009], [0.012, 0.0125], [-0.004, 0.013], [-0.022, 0.0115], [-0.04, 0.009], [-0.04, 0.003], [-0.02, -0.004], [-0.004, -0.008], [0.012, -0.0105], [0.03, -0.0075], [0.05, -0.004], [0.066, -0.0015]]
    const half = (s: 1 | -1, y: number) => {
      k.extrude('steel', fillet2(jaw, 0.0012, 2, true).map(([x, z]): V2 => [x, s * z]), 0.0046, [0, y, 0], { axis: 'y', bevel: 0.0008, tint: STEEL })
      const path = ([[-0.036, 0.007], [-0.06, 0.0125], [-0.095, 0.017], [-0.128, 0.0188]] as V2[]).map(([x, z]): V3 => [x, 0.0072, -s * z])
      k.put(sweepRaw(path, 0.0046, { seg: 10 }), 'steel', { tint: STEEL })
      k.put(sweepRaw(path.slice(1), 0.0072, { seg: 14, radius: (_s, _a, t) => 1 + 0.06 * Math.sin(t * Math.PI) }), 'paint', { tint: RED })

      k.put(sweepRaw([[-0.07, 0.0072, -s * 0.0138], [-0.108, 0.0072, -s * 0.018]], 0.0088, { seg: 14 }), 'rubber', { tint: BLACK })
    }
    half(1, 0.0094)
    half(-1, 0.0048)
    k.lathe('steel', fillet2([[0, 0], [0.0058, 0], [0.0058, 0.0125], [0.0045, 0.0138], [0, 0.0141]], 0.0008, 2), [0, 0.0005, 0], { seg: 20, tint: STEEL })
  },

  wrench: (k) => {

    k.extrude('steel', [[-0.085, -0.0066], [0.087, -0.0077], [0.087, 0.0077], [-0.085, 0.0066]], 0.0036, [0, 0.0026, 0], { axis: 'y', bevel: 0.0006, tint: STEEL })
    for (const s of [-1, 1]) k.extrude('steel', fillet2([[-0.085, s * 0.0078], [0.087, s * 0.0089], [0.087, s * 0.0063], [-0.085, s * 0.0052]], 0.0006, 1, true), 0.0068, [0, 0.0034, 0], { axis: 'y', bevel: 0.0012, tint: STEEL })
    k.extrude('steel', circle(0.0158, 48, 0.1, 0), 0.0075, [0, 0.00375, 0], { axis: 'y', holes: [star12(0.1, 0.0108, 0.0119)], bevel: 0.0012, tint: STEEL })
    k.extrude('steel', fillet2(openEnd(-0.102, 0.0205, 0.0095, 0.26), 0.0008, 1, true), 0.0068, [0, 0.0034, 0], { axis: 'y', bevel: 0.0012, tint: STEEL })
  },

  hacksaw: (k) => {

    const y = 0.0055
    k.put(sweepRaw([[-0.15, y, 0.035], [-0.15, y, -0.045], [-0.13, y, -0.06], [0.14, y, -0.06], [0.165, y, -0.045], [0.165, y, 0.035]], 0.0055, { seg: 12 }), 'paint', { tint: BLUE })
    const grip = (pts: V2[]): V2[] => pts.map(([x, z]): V2 => [x, -z])
    k.extrude('rubber', fillet2(grip([[-0.143, 0.044], [-0.143, -0.02], [-0.16, -0.036], [-0.2, -0.041], [-0.217, -0.02], [-0.206, 0.031], [-0.19, 0.048]]), 0.006, 3, true), 0.024, [0, 0.012, 0], { axis: 'y', bevel: 0.005, bevelSeg: 3, holes: [fillet2(grip([[-0.16, 0.028], [-0.162, -0.016], [-0.193, -0.024], [-0.198, 0.022]]), 0.006, 3, true)], tint: BLACK })
    const blade: V2[] = [[-0.145, -0.029]]
    for (let x = -0.145; x < 0.16; x += 0.002) blade.push([x + 0.001, -0.0425], [x + 0.002, -0.041])
    blade.push([0.16, -0.029])
    k.extrude('steel', blade, 0.0007, [0, y, 0], { axis: 'y', bevel: 0.0001, tint: STEEL })
    for (const x of [-0.143, 0.158]) k.cyl('steel', 0.002, 0.006, [x, y, 0.035], { seg: 10, tint: STEEL })
    k.box('paint', [0.016, 0.012, 0.014], [0.165, y, 0.03], { r: 0.003, tint: BLUE })
    k.cyl('steel', 0.0035, 0.016, [0.18, y, 0.035], { axis: 'x', seg: 12, tint: STEEL })
    k.extrude('steel', fillet2([[-0.004, 0.0], [-0.016, 0.008], [-0.018, -0.002], [-0.004, -0.004], [0.004, -0.004], [0.018, -0.002], [0.016, 0.008], [0.004, 0.0]], 0.002, 2, true), 0.003, [0.189, y + 0.002, 0.035], { axis: 'x', bevel: 0.0004, tint: STEEL })
  },

  shovel: (k) => {

    const L = 0.29, W = 0.22, y = 0.019, bx = 0.38
    const lift = (x: number, z: number) => { const u = x / L + 0.5, half = (W / 2) * Math.sqrt(Math.max(0.02, 1 - Math.max(0, (u - 0.35) / 0.65) ** 2.2)), zz = (z / (W / 2)) * half; return { zz, y: 0.03 * (zz / (W / 2)) ** 2 + (0.012 * Math.max(0, 0.15 - u)) / 0.15 } }
    const blade = sheetRaw(L, W, 28, 16, () => 0, 0.002).warp((x, yy, z) => { const q = lift(x, z); return [0, q.y, q.zz - z] }).smooth(50)
    k.put(blade, 'steel', { at: [bx, 0.002, 0], tint: DARK })
    const spine = Array.from({ length: 9 }, (_, i): V3 => { const x = -L / 2 + 0.01 + i / 8 * L * 0.55; return [bx + x, 0.004 + lift(x, 0).y + 0.0008, 0] })
    k.put(sweepRaw(spine, 0.004, { seg: 10, flat: 0.35, radius: (_s, _a, t) => 1 - 0.6 * t }), 'steel', { tint: DARK })
    for (const s of [-1, 1]) {
      const tread = Array.from({ length: 7 }, (_, i): V3 => { const z = s * (0.024 + i / 6 * 0.074), q = lift(-L / 2, z); return [bx - L / 2 + 0.002, 0.004 + q.y, q.zz] })
      k.put(sweepRaw(tread, 0.0042, { seg: 10 }), 'steel', { tint: DARK })
    }
    bore(k, 'steel', fillet2([[0, 0], [0.019, 0], [0.021, 0.07], [0.021, 0.095], [0, 0.095]], 0.002, 2), 0.15, y, { tint: DARK, seg: 24 })
    for (const x of [0.17, 0.2]) k.rivet([x, y + 0.0205, 0], { pitch: -Math.PI / 2, r: 0.004 })
    bore(k, 'wood', fillet2([[0, 0], [0.016, 0], [0.017, 0.02], [0.017, 0.7], [0, 0.7]], 0.003, 2), -0.5, y, { tint: ASH, seg: 20 })
    bore(k, 'steel', [[0.0168, 0], [0.019, 0], [0.019, 0.03], [0.0168, 0.03], [0.0168, 0]], -0.495, y, { tint: DARK, seg: 24 })
    for (const s of [-1, 1]) k.put(sweepRaw([[-0.49, y, s * 0.008], [-0.53, y, s * 0.03], [-0.6, y, s * 0.052]], 0.011, { seg: 14 }), 'charcoal', { tint: BLACK })
    k.frame({ at: [-0.6, y, -0.06] }, () => k.lathe('charcoal', fillet2([[0, 0], [0.012, 0], [0.0145, 0.02], [0.0145, 0.1], [0.012, 0.12], [0, 0.12]], 0.004, 2), [0, 0, 0], { axis: 'z', seg: 20, tint: BLACK, wear: (x, yy, z) => (yy > 0.025 && yy < 0.095 ? knurl(12, 0.0005, 0.013)(x, yy, z) : 0) }))
  },

  hoe: (k) => {

    const y = 0.0245
    bore(k, 'wood', fillet2([[0, 0], [0.016, 0], [0.018, 0.02], [0.018, 1.03], [0.0172, 1.05], [0, 1.05]], 0.003, 2), -0.6, y, { tint: ASH, seg: 20 })
    bore(k, 'steel', fillet2([[0.0182, 0], [0.0235, 0], [0.0245, 0.006], [0.0245, 0.054], [0.0235, 0.06], [0.0182, 0.06], [0.0182, 0]], 0.0015, 2), 0.39, y, { tint: DARK, seg: 28 })
    k.extrude('steel', fillet2([[0.415, -0.022], [0.445, -0.03], [0.445, 0.03], [0.415, 0.022]], 0.004, 2, true), 0.006, [0, 0.004, 0], { axis: 'y', bevel: 0.0015, tint: DARK })
    k.put(bladeRaw(fillet2([[0.44, -0.09], [0.6, -0.085], [0.604, -0.04], [0.606, 0.0], [0.604, 0.04], [0.6, 0.085], [0.44, 0.09], [0.43, 0.02], [0.43, -0.02]], 0.006, 3, true), 0.0034, (x) => clamp01((0.606 - x) / 0.035)), 'steel', { at: [0, 0.0017, 0], pitch: -Math.PI / 2, tint: DARK })
    k.box('steel', [0.004, 0.016, 0.02], [0.45, y, 0], { r: 0.001, tint: DARK })
  },

  pickaxe: (k) => {

    const st: Station[] = [
      { y: -0.225, rx: 0.003, rz: 0.003, cx: -0.045, p: 3 }, { y: -0.15, rx: 0.011, rz: 0.011, cx: -0.02, p: 3.5 }, { y: -0.05, rx: 0.018, rz: 0.019, cx: -0.0022, p: 3 },
      { y: -0.03, rx: 0.028, rz: 0.025, cx: -0.0007, p: 2.6 }, { y: 0.03, rx: 0.028, rz: 0.025, cx: -0.0007, p: 2.6 }, { y: 0.05, rx: 0.019, rz: 0.02, cx: -0.0022, p: 3 },
      { y: 0.15, rx: 0.012, rz: 0.021, cx: -0.02, p: 3.5 }, { y: 0.218, rx: 0.004, rz: 0.024, cx: -0.042, p: 4 }, { y: 0.225, rx: 0.002, rz: 0.022, cx: -0.045, p: 3 },
    ]
    k.put(place(loftRaw(st, { seg: 28 }), { at: [0.43, 0.025, 0], pitch: Math.PI / 2 }), 'steel', { tint: [0.36, 0.36, 0.38] })
    k.put(place(gripRaw(0.929, 0.019, { knob: 0.12, swell: 0.06, neck: 1.05, ratio: 0.8 }), { at: [-0.47, 0.025, 0], roll: -Math.PI / 2 }), 'wood', { tint: HICKORY })
    k.box('steel', [0.002, 0.026, 0.004], [0.4598, 0.025, 0], { r: 0.0005, tint: DARK })
  },

  hatchet: (k) => onSide(k, 0.015, () => {

    const head: V2[] = [[0.116, 0.032], [0.156, 0.032], [0.16, 0.02], [0.158, 0.0], [0.162, -0.02], [0.172, -0.05], [0.18, -0.082], [0.158, -0.088], [0.128, -0.087], [0.104, -0.08], [0.1, -0.065], [0.112, -0.045], [0.116, -0.02], [0.114, 0.0]]
    k.put(bladeRaw(fillet2(head, 0.003, 2, true), 0.03, (_x, y) => clamp01((y + 0.087) / 0.06)), 'steel', { tint: FORGED })
    const handle: V3[] = [[-0.17, -0.004, 0], [-0.1, 0.0, 0], [0.0, 0.002, 0], [0.08, 0.001, 0], [0.135, 0.0, 0], [0.157, 0, 0]]
    k.put(sweepRaw(handle, 0.0135, { seg: 16, flat: 0.72, radius: (_s, _a, t) => 1 + 0.28 * Math.exp(-(((t - 0.02) / 0.05) ** 2)) - 0.14 * Math.max(0, Math.min(1, (t - 0.55) / 0.3)) }), 'wood', { tint: HICKORY })
    k.box('steel', [0.0016, 0.012, 0.0022], [0.1572, 0, 0], { r: 0.0004, tint: DARK })
  }, [0.0, 0.028]),

  'bolt-cutter': (k) => {

    const yc = 0.016
    for (const s of [-1, 1]) {
      k.extrude('steel', fillet2([[0.25, 0.0008], [0.33, 0.0018], [0.372, 0.0006], [0.366, 0.012], [0.33, 0.019], [0.29, 0.023], [0.255, 0.025], [0.232, 0.018], [0.236, 0.006]], 0.002, 2, true).map(([x, z]): V2 => [x, s * z]), 0.016, [0, yc, 0], { axis: 'y', bevel: 0.0015, tint: DARK })
      k.put(sweepRaw([[0.22, yc, -s * 0.016], [0.12, yc, -s * 0.03], [-0.15, yc, -s * 0.05], [-0.36, yc, -s * 0.062]], 0.0115, { seg: 16 }), 'paint', { tint: RED })
      k.put(sweepRaw([[-0.13, yc, -s * 0.0487], [-0.372, yc, -s * 0.0625]], 0.0158, { seg: 18, radius: (arc) => 1 + 0.06 * Math.max(0, Math.cos(arc * 220)) }), 'rubber', { tint: BLACK })
    }
    for (const yy of [0.006, 0.026]) k.extrude('steel', fillet2([[0.17, -0.03], [0.28, -0.026], [0.28, 0.026], [0.17, 0.03]], 0.006, 2, true), 0.004, [0, yy, 0], { axis: 'y', bevel: 0.0006, tint: DARK })
    for (const [x, z] of [[0.19, 0.018], [0.19, -0.018], [0.265, 0.012], [0.265, -0.012]]) {
      k.cyl('steel', 0.0055, 0.003, [x, 0.0295, z], { seg: 6, tint: STEEL })
      k.cyl('steel', 0.0055, 0.0025, [x, 0.0028, z], { seg: 16, tint: STEEL })
    }
  },

  'tape-measure': (k) => {

    k.box('paint', [0.066, 0.064, 0.036], [0, 0.0345, 0], { r: 0.013, tint: YELLOW })
    for (const s of [-1, 1]) k.frame({ at: [-0.003, 0.036, s * 0.0178], yaw: s > 0 ? 0 : Math.PI }, () => k.lathe('rubber', fillet2([[0, 0], [0.026, 0], [0.026, 0.003], [0.022, 0.0042], [0, 0.0042]], 0.001, 2), [0, 0, 0], { axis: 'z', seg: 40, tint: BLACK, wear: (x, y, z) => (Math.hypot(x, z) < 0.02 && y > 0.002 ? knurl(24, 0.0003)(x, y, z) : 0) }))
    k.box('rubber', [0.056, 0.006, 0.038], [0, 0.003, 0], { r: 0.0025, tint: BLACK })
    k.box('rubber', [0.012, 0.016, 0.03], [0.031, 0.013, 0], { r: 0.003, tint: BLACK })
    k.box('rubber', [0.016, 0.006, 0.012], [0.014, 0.0665, 0], { r: 0.002, tint: [0.75, 0.15, 0.1] })
    k.sheet('paper', 0.026, 0.025, (x, z) => 0.0025 * (z / 0.0125) ** 2, [0.049, 0.0008, 0], { nx: 6, nz: 8, thickness: 0.0006, tint: YELLOW })
    k.box('steel', [0.0012, 0.009, 0.027], [0.0626, 0.0047, 0], { r: 0.0003, tint: STEEL })
    for (const z of [-0.006, 0.006]) k.cyl('steel', 0.0012, 0.0012, [0.059, 0.004, z], { seg: 8, tint: STEEL })
    k.put(sweepRaw([[-0.0328, 0.058, 0], [-0.0372, 0.058, 0], [-0.0386, 0.02, 0], [-0.036, 0.012, 0]], 0.0016, { seg: 6, flat: 9 }), 'steel', { tint: STEEL })
  },

  whetstone: (k) => {

    k.extrude('rubber', rrect(0.212, 0.06, 0.008), 0.009, [0, 0.0045, 0], { axis: 'y', bevel: 0.0025, holes: [rrect(0.198, 0.046, 0.003)], tint: BLACK })
    k.box('rubber', [0.2, 0.003, 0.048], [0, 0.0015, 0], { r: 0.001, tint: BLACK })
    k.box('concrete', [0.196, 0.011, 0.044], [0, 0.0085, 0], { r: 0.0018, tint: [0.42, 0.42, 0.44] })
    k.box('concrete', [0.196, 0.011, 0.044], [0, 0.0195, 0], { r: 0.0018, seg: [24, 1, 8], tint: [0.8, 0.64, 0.44], disp: (face, s, t, hs, ht) => (face === 2 ? -0.0012 * Math.max(0, 1 - (s / hs) ** 2) * Math.max(0, 1 - (t / ht) ** 2) : 0) })
  },

  scissors: (k) => {

    const blade = fillet2([[-0.012, 0.004], [-0.004, -0.0065], [0.06, -0.003], [0.1, 0.0], [0.102, 0.0015], [0.06, 0.0045], [0.0, 0.006]], 0.001, 2, true)
    const half = (s: 1 | -1, y: number, loop: [number, number, number]) => k.frame({ yaw: s * 0.07 }, () => {

      const m = (pts: V2[]) => { const out = pts.map(([x, oy]): V2 => [x, s * oy]); return s < 0 ? out.reverse() : out }
      k.extrude('steel', m(blade), 0.0026, [0, y, 0], { axis: 'y', bevel: 0.0005, tint: STEEL })
      const [rx, rz, cz] = loop
      k.extrude('paint', m(ellipse(rx, rz, 32, -0.052, cz)), 0.0085, [0, 0.00425, 0], { axis: 'y', bevel: 0.0018, holes: [m(ellipse(rx - 0.0055, rz - 0.0048, 28, -0.052, cz))], tint: BLUE })

      k.extrude('rubber', m(ellipse(rx - 0.0052, rz - 0.0045, 28, -0.052, cz)), 0.0041, [0, 0.00425, 0], { axis: 'y', bevel: 0.0006, holes: [m(ellipse(rx - 0.0072, rz - 0.0062, 28, -0.052, cz))], tint: BLACK })
      k.extrude('paint', m([[-0.03, 0.006], [-0.008, 0.0015], [-0.008, 0.0075], [-0.027, 0.0125]]), 0.0065, [0, 0.0042, 0], { axis: 'y', bevel: 0.0012, tint: BLUE })
    })
    half(1, 0.00525, [0.017, 0.0115, 0.017])
    half(-1, 0.00265, [0.028, 0.0135, 0.019])
    k.cyl('steel', 0.0036, 0.0074, [0, 0.0042, 0], { seg: 16, tint: STEEL })
    k.cyl('steel', 0.0028, 0.0012, [0, 0.0085, 0], { seg: 6, tint: STEEL })
  },

  'can-opener': (k) => {

    for (const s of [-1, 1]) k.put(sweepRaw([[0.05, 0.0075, s * 0.0062], [-0.02, 0.0075, s * 0.011], [-0.075, 0.0075, s * 0.016]], 0.0075, { seg: 14, flat: 0.6 }), 'rubber', { tint: BLACK })
    k.extrude('steel', fillet2([[0.03, -0.017], [0.075, -0.016], [0.08, 0], [0.075, 0.016], [0.03, 0.017]], 0.006, 3, true), 0.0026, [0, 0.0158, 0], { axis: 'y', bevel: 0.0005, tint: STEEL })
    k.cyl('steel', 0.0105, 0.0016, [0.062, 0.0179, 0.006], { seg: 32, bevel: 0.0005, tint: STEEL })
    k.extrude('steel', circle(0.0075, 20, 0, 0).map(([x, z], i): V2 => [x * (i % 2 ? 0.86 : 1), z * (i % 2 ? 0.86 : 1)]), 0.002, [0.062, 0.0181, -0.007], { axis: 'y', bevel: 0.0003, tint: STEEL })
    k.cyl('charcoal', 0.004, 0.006, [0.048, 0.0201, 0], { seg: 14, tint: BLACK })
    k.extrude('charcoal', fillet2([[-0.003, 0], [-0.016, 0.008], [-0.019, 0.022], [-0.008, 0.026], [0.008, 0.026], [0.019, 0.022], [0.016, 0.008], [0.003, 0]], 0.003, 3, true), 0.005, [0.048, 0.0231, 0], { bevel: 0.001, tint: BLACK })
  },

  'multi-tool': (k) => {

    const L = 0.091, W = 0.026
    for (const y of [0.0025, 0.0155]) k.extrude('paint', rrect(L, W, 0.0125, 8), 0.0042, [0, y, 0], { axis: 'y', bevel: 0.0016, bevelSeg: 3, tint: RED })
    for (let i = 0; i < 4; i++) k.extrude('steel', rrect(L - 0.0012, W - 0.0014, 0.0119, 8), 0.0018, [0, 0.0055 + i * 0.0026, 0], { axis: 'y', bevel: 0.0002, tint: STEEL })
    k.extrude('steel', [[-0.0015, -0.0045], [0.0015, -0.0045], [0.0015, -0.0015], [0.0045, -0.0015], [0.0045, 0.0015], [0.0015, 0.0015], [0.0015, 0.0045], [-0.0015, 0.0045], [-0.0015, 0.0015], [-0.0045, 0.0015], [-0.0045, -0.0015], [-0.0015, -0.0015]], 0.0008, [0.012, 0.0179, 0], { axis: 'y', tint: [0.94, 0.94, 0.94] })
    k.frame({ at: [0.038, 0.0107, -0.006], yaw: -0.6 }, () => k.put(bladeRaw([[0, -0.0035], [0.036, -0.0028], [0.044, 0.0015], [0.04, 0.0042], [0.0, 0.0046]], 0.0016, (_x, yy) => clamp01((yy + 0.0035) / 0.008)), 'steel', { pitch: -Math.PI / 2, tint: STEEL }))
    k.box('steel', [0.016, 0.0014, 0.0035], [-0.034, 0.0095, 0.0085], { r: 0.0004, tint: STEEL })
    k.box('paper', [0.018, 0.0016, 0.003], [-0.033, 0.0095, -0.0085], { r: 0.0005, tint: [0.93, 0.92, 0.88] })
    k.torus('steel', 0.009, 0.0011, [-0.053, 0.0011, 0], { seg: 6, segR: 24, tint: STEEL })
  },
}
