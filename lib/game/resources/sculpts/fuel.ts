import { clamp, extrudeRaw, latheRaw, noise3, type Kit, type V3 } from '../../blockout/sculpt/kit'
import { bandRaw, flask, jerrycan, jug, sack, tin } from './archetypes'
import { circle, dents, fillet2, loftRaw, merge, place, rrect, sphereMesh, sweepRaw, type ResourceFamily, type Station } from './forms'

const FRONT = Math.PI / 2
const WHITE: V3 = [0.95, 0.95, 0.93], INK: V3 = [0.12, 0.12, 0.14], YELLOW: V3 = [0.97, 0.8, 0.12], RED: V3 = [0.82, 0.14, 0.1]
const BARK: V3 = [0.45, 0.34, 0.26], WOOD: V3 = [0.92, 0.8, 0.62]
const front = (y0: number, y1: number, tint: V3, half = 0.9) => ({ y0, y1, a0: FRONT - half, a1: FRONT + half, tint })
const side = (y0: number, y1: number, tint: V3, half = 0.55) => ({ y0, y1, a0: -half, a1: half, tint })

function steelJerrycan(k: Kit, tint: V3) {
  const hx = 0.118, hz = 0.083, top = 0.312, keys: Station[] = []
  for (let y = 0; y <= top + 1e-6; y += top / 26) {
    const e = Math.min(1, y / 0.006, (top - y) / 0.012)
    keys.push({ y, rx: hx * (0.95 + 0.05 * e), rz: hz * (0.94 + 0.06 * e), p: 8 })
  }
  const emboss = (x: number, y: number, z: number) => {
    if (Math.abs(z) < hz * 0.85) return 0
    const u = Math.abs(x) / (hx * 0.8), v = Math.abs(y - top / 2) / (top * 0.4)
    return u < 1 && v < 1 ? 0.0032 * clamp(1 - Math.abs(u - v) * 7) : 0
  }
  k.put(loftRaw(keys, { seg: 72, wear: emboss, crease: 40 }), 'paint', { tint })
  k.put(sweepRaw([[hx + 0.0012, 0.01, 0], [hx + 0.0012, top - 0.012, 0]], 0.0028, { seg: 6 }), 'paint', { tint })
  k.put(sweepRaw([[-hx - 0.0012, 0.01, 0], [-hx - 0.0012, top - 0.012, 0]], 0.0028, { seg: 6 }), 'paint', { tint })
  for (const z of [-0.036, 0, 0.036]) k.tube('paint', [[-0.075, top - 0.004, z], [-0.068, top + 0.024, z], [0.01, top + 0.024, z], [0.018, top - 0.004, z]], 0.0065, { seg: 10, fillet: 0.008, tint })
  k.lathe('paint', [[0, top - 0.004], [0.026, top - 0.004], [0.026, top + 0.008], [0.024, top + 0.012], [0, top + 0.012]], [0.072, 0, 0], { seg: 24, tint })
  k.lathe('steel', fillet2([[0, top + 0.011], [0.024, top + 0.011], [0.024, top + 0.026], [0, top + 0.026]], 0.003, 2), [0.072, 0, 0], { seg: 24, tint: [0.55, 0.55, 0.52] })
  k.tube('steel', [[0.072, top + 0.028, 0.012], [0.05, top + 0.03, 0.014], [0.03, top + 0.026, 0.016]], 0.003, { seg: 6, tint: [0.55, 0.55, 0.52] })
}

export const FUELS: ResourceFamily = {
  'gasoline-can': (k) => jerrycan(k, 0.24, 0.34, 0.175, { tint: RED, capTint: INK, labels: [side(0.09, 0.2, YELLOW), side(0.13, 0.16, INK, 0.35)] }),
  'diesel-can': (k) => steelJerrycan(k, [0.92, 0.74, 0.12]),
  'ethanol-fuel': (k) => jerrycan(k, 0.24, 0.34, 0.175, { tint: [0.2, 0.55, 0.3], capTint: YELLOW, labels: [side(0.09, 0.2, WHITE), side(0.13, 0.16, [0.2, 0.55, 0.3], 0.35)] }),
  kerosene: (k) => jug(k, 0.115, 0.245, 0.095, { tint: [0.93, 0.93, 0.9], capTint: [0.15, 0.4, 0.8], labels: [front(0.03, 0.13, [0.15, 0.4, 0.8]), front(0.06, 0.1, WHITE, 0.5)] }),
  'cooking-alcohol': (k) => flask(k, [{ y: 0, rx: 0.035, rz: 0.035, p: 3.2 }, { y: 0.006, rx: 0.038, rz: 0.038, p: 3.2 }, { y: 0.17, rx: 0.038, rz: 0.038, p: 3.2 }, { y: 0.2, rx: 0.024, rz: 0.024, p: 2.4 }, { y: 0.212, rx: 0.016, rz: 0.016, p: 2 }], {
    tint: [0.94, 0.94, 0.92], labels: [front(0.03, 0.15, [0.12, 0.38, 0.75], 1.1), front(0.07, 0.11, YELLOW, 0.7)],
    neck: { r: 0.012, h: 0.016, cap: 'flip', tint: [0.85, 0.15, 0.12] },
  }),
  'lpg-cylinder': (k) => {

    const paint: V3 = [0.8, 0.3, 0.13], R = 0.176
    k.lathe('paint', fillet2([[0.146, 0.002], [0.152, 0], [0.156, 0.004], [0.156, 0.052], [0.142, 0.074], [0.136, 0.072], [0.15, 0.052], [0.15, 0.006], [0.146, 0.002]], 0.0015, 2), [0, 0, 0], { seg: 56, crease: 55, tint: [0.3, 0.3, 0.32] })
    k.lathe('paint', fillet2([[0, 0.045], [0.08, 0.05], [0.14, 0.07], [0.168, 0.096], [R, 0.13], [R, 0.33], [0.168, 0.364], [0.14, 0.39], [0.08, 0.405], [0.03, 0.41], [0, 0.41]], 0.01, 3), [0, 0, 0], { seg: 64, crease: 60, tint: paint, wear: dents(0.0012, 18, 3) })
    k.torus('paint', R + 0.0006, 0.0028, [0, 0.23, 0], { seg: 8, segR: 64, tint: paint })
    for (const phase of [0.37, 0.37 + Math.PI]) k.lathe('paint', fillet2([[0.096, 0.396], [0.101, 0.396], [0.101, 0.462], [0.098, 0.468], [0.094, 0.462], [0.096, 0.396]], 0.0012, 2), [0, 0, 0], { seg: 24, arc: Math.PI - 0.74, phase, crease: 60, tint: paint })
    k.cyl('steel', 0.018, 0.016, [0, 0.413, 0], { seg: 6, bevel: 0.002, tint: [0.92, 0.75, 0.4] })
    k.lathe('steel', [[0, 0.42], [0.012, 0.42], [0.012, 0.436], [0.0105, 0.44], [0, 0.44]], [0, 0, 0], { seg: 18, tint: [0.92, 0.75, 0.4] })
    k.lathe('paint', fillet2([[0, 0.432], [0.0145, 0.432], [0.0145, 0.452], [0, 0.452]], 0.002, 2), [0, 0, 0], { seg: 18, tint: [0.85, 0.12, 0.1] })
    k.lathe('paper', [[R + 0.0012, 0.245], [R + 0.0012, 0.32]], [0, 0, 0], { seg: 32, arc: 1.3, phase: FRONT - 0.65, tint: WHITE })
  },
  'camping-gas': (k) => {
    const blue: V3 = [0.16, 0.36, 0.72]
    k.lathe('paint', fillet2([[0, 0.004], [0.044, 0.003], [0.048, 0], [0.05, 0.003], [0.0505, 0.008], [0.05, 0.01], [0.05, 0.072], [0.047, 0.086], [0.035, 0.098], [0.02, 0.104], [0.016, 0.105], [0.016, 0.108], [0.0145, 0.11], [0, 0.11]], 0.0012, 2), [0, 0, 0], { seg: 48, crease: 55, tint: blue })
    k.lathe('steel', [[0, 0.109], [0.0068, 0.109], [0.0068, 0.121], [0, 0.121]], [0, 0, 0], { seg: 14, tint: [0.92, 0.75, 0.4], wear: (x, y, z) => Math.max(0, Math.sin(y * 2800)) * 0.0004 })
    k.lathe('paper', [[0.0512, 0.014], [0.0512, 0.066]], [0, 0, 0], { seg: 40, tint: [0.95, 0.8, 0.15] })
    k.lathe('paper', [[0.0524, 0.028], [0.0524, 0.052]], [0, 0, 0], { seg: 40, arc: 2, tint: blue })
  },
  'motor-oil': (k) => flask(k, [{ y: 0, rx: 0.046, rz: 0.031, p: 4 }, { y: 0.006, rx: 0.048, rz: 0.033, p: 4 }, { y: 0.18, rx: 0.048, rz: 0.033, p: 4 }, { y: 0.205, rx: 0.03, rz: 0.024, p: 3, cx: 0.014 }, { y: 0.214, rx: 0.016, rz: 0.016, p: 2, cx: 0.022 }], {
    tint: [0.15, 0.15, 0.17], labels: [front(0.03, 0.16, [0.95, 0.75, 0.12], 1.1), front(0.07, 0.1, RED, 0.6)],
    wear: (x, y, z) => (x < -0.03 && y > 0.12 && y < 0.18 && Math.abs(z) > 0.022 ? -0.004 * clamp((y - 0.12) / 0.01) * clamp((0.18 - y) / 0.01) : 0),
    neck: { x: 0.022, r: 0.0135, h: 0.022, cap: 'screw', tint: YELLOW },
  }),
  grease: (k) => {
    tin(k, 0.055, 0.082, { lid: 'press', tint: [0.2, 0.2, 0.22], labels: [{ y0: 0.15, y1: 0.85, tint: YELLOW }, { y0: 0.38, y1: 0.62, tint: INK, arc: 2 }] })
    const smear: V3[] = Array.from({ length: 9 }, (_, i) => { const a = 0.4 + i * 0.12; return [Math.cos(a) * 0.0525, 0.0838, Math.sin(a) * 0.0525] })
    k.put(sweepRaw(smear, 0.0022, { seg: 6, flat: 0.5, radius: (_s, _a, t) => 0.5 + Math.sin(Math.PI * t) }), 'paint', { tint: [0.45, 0.3, 0.12] })
  },
  'lighter-fluid': (k) => {
    flask(k, [{ y: 0, rx: 0.021, rz: 0.014, p: 3.2 }, { y: 0.004, rx: 0.023, rz: 0.016, p: 3.2 }, { y: 0.1, rx: 0.023, rz: 0.016, p: 3.2 }, { y: 0.11, rx: 0.016, rz: 0.012, p: 2.6 }, { y: 0.114, rx: 0.006, rz: 0.006, p: 2 }], { m: 'steel', tint: [0.85, 0.86, 0.88], labels: [front(0.012, 0.09, [0.18, 0.36, 0.72], 1.2), front(0.04, 0.06, YELLOW, 0.8)] })
    k.lathe('paint', fillet2([[0, 0.111], [0.0055, 0.111], [0.0045, 0.122], [0.0016, 0.13], [0, 0.13]], 0.0006, 2), [0, 0, 0], { seg: 14, tint: RED })
  },
  'brake-fluid': (k) => flask(k, [{ y: 0, rx: 0.036, rz: 0.025, p: 3.5 }, { y: 0.005, rx: 0.038, rz: 0.027, p: 3.5 }, { y: 0.11, rx: 0.038, rz: 0.027, p: 3.5 }, { y: 0.124, rx: 0.02, rz: 0.018, p: 2.5 }, { y: 0.128, rx: 0.016, rz: 0.016, p: 2 }], {
    tint: [0.95, 0.95, 0.93], labels: [front(0.02, 0.1, [0.15, 0.25, 0.6], 1.1), front(0.04, 0.07, WHITE, 0.6)],
    neck: { r: 0.0125, h: 0.014, cap: 'screw', tint: [0.15, 0.25, 0.6], capH: 0.014 },
  }),
  charcoal: (k) => {
    sack(k, 0.34, 0.12, 0.48, { ends: 'block', tint: [0.86, 0.78, 0.62], seed: 12, prints: [{ tint: INK, u0: 0.1, u1: 0.9, v0: 0.18, v1: 0.5 }, { tint: [0.85, 0.3, 0.1], u0: 0.25, u1: 0.75, v0: 0.58, v1: 0.68 }] })
    const lump = (r: number, seed: number) => sphereMesh(r, 3, 6).displace((x, y, z) => (noise3(x * 70, y * 70, z * 70, seed) - 0.5) * r * 0.9).smooth(20)
    k.put(merge(place(lump(0.026, 1), { at: [0.06, 0, 0.17], yaw: 0.4, scale: [1.3, 0.8, 1] }), place(lump(0.02, 2), { at: [0.1, 0.004, 0.15], yaw: 1.2 }), place(lump(0.018, 3), { at: [0.075, 0.016, 0.2], scale: [1.2, 0.7, 1] })), 'charcoal', { at: [0, 0.112, 0], tint: [0.32, 0.32, 0.34] })
  },
  firewood: (k) => {

    const L = 0.46, barky = (x: number, y: number, z: number) => (Math.hypot(y, z) > 0.03 ? (noise3(x * 30, y * 90, z * 90, 3) - 0.5) * 0.004 : 0)
    const half = (r: number) => extrudeRaw(fillet2([[-r, 0], [r, 0], ...circle(r, 20).filter(([, y]) => y > 0.001).sort((a, b) => b[0] - a[0])], 0.003, 2, true), L, { bevel: 0.003 })
    const round = (r: number) => latheRaw([[0, -L / 2], [r * 0.96, -L / 2], [r, -L / 2 + 0.006], [r, L / 2 - 0.006], [r * 0.96, L / 2], [0, L / 2]], { seg: 20, crease: 50 })

    const halves = [place(half(0.05).displace(dents(0.002, 40, 1)), { yaw: Math.PI / 2, at: [0, 0, -0.11] }), place(half(0.048).displace(dents(0.002, 40, 2)), { yaw: Math.PI / 2, at: [-0.012, 0, 0.108] })]
    const billets: [number, V3][] = [[0.045, [0.01, 0.045, 0]], [0.042, [0.005, 0.085, -0.075]], [0.04, [-0.008, 0.084, 0.074]]]
    k.put(merge(...halves), 'wood', { tint: WOOD })
    k.put(merge(...billets.map(([r, at]) => place(round(r).displace(barky), { roll: -Math.PI / 2, at }))), 'wood', { tint: BARK })

    for (const s of [-1, 1]) k.put(merge(...billets.map(([r, at]) => place(latheRaw([[0, 0], [r * 0.93, 0], [r * 0.93, 0.0016], [0, 0.0016]], { seg: 20 }), { roll: -s * Math.PI / 2, at: [at[0] + s * L / 2, at[1], at[2]] }))), 'wood', { tint: WOOD })
    for (const x of [-0.13, 0.13]) {
      const loop: V3[] = rrect(0.33, 0.13, 0.05, 4, 0, 0.064).map(([z, y]) => [x, y, z])
      k.put(sweepRaw(loop, 0.0012, { closed: true, seg: 5 }), 'steel', { tint: [0.5, 0.5, 0.52] })
    }
  },
  'paraffin-wax': (k) => {

    const keys: Station[] = [{ y: 0, rx: 0.092, rz: 0.054, p: 8 }, { y: 0.044, rx: 0.098, rz: 0.058, p: 8 }, { y: 0.047, rx: 0.096, rz: 0.056, p: 7 }]
    k.put(loftRaw(keys, { seg: 48, wear: (x, y, z) => (x > 0.07 && z > 0.035 ? -0.006 * noise3(x * 60, y * 60, z * 60, 4) : (noise3(x * 40, y * 40, z * 40, 2) - 0.5) * 0.0012) }), 'plaster', { tint: [0.97, 0.96, 0.92] })
    k.put(bandRaw(keys, 0.012, 0.034, 0, Math.PI * 2, 0.002, 48), 'paper', { tint: [0.85, 0.2, 0.15] })
  },
}
