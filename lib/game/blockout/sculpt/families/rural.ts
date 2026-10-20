import { arc, fbm3, noise3, type Family, type Kit, type Mat, type V2, type V3 } from '../kit'
import { RUST, boardTop, chain, column, angleOutline, legFrame, litter, lugLift, motor, pail, rope } from './shop'

const PAINTS: V3[] = [[0.62, 0.17, 0.12], [0.27, 0.42, 0.22], [0.8, 0.56, 0.14]]
const STRAW: V3 = [0.92, 0.8, 0.52]
const SOIL: V3 = [0.42, 0.32, 0.24]
const LEAF: V3 = [0.36, 0.55, 0.25]

function log(k: Kit, r: number, len: number, at: V3, o: { yaw?: number; seed?: number; tint?: V3 } = {}) {
  const seed = o.seed ?? Math.floor(k.rnd() * 100), bark = Math.min(1, r / 0.1)
  const prof: V2[] = [[0, -len / 2], [r * 0.9, -len / 2], [r * 0.98, -len / 2 + 0.012]]
  for (let i = 1; i < 10; i++) prof.push([r * (1 + (noise3(i, seed, 0) - 0.5) * 0.08), -len / 2 + len * i / 10])
  prof.push([r * 0.98, len / 2 - 0.012], [r * 0.9, len / 2], [0, len / 2])

  k.lathe('wood', prof, at, {
    axis: 'x', seg: 26, yaw: o.yaw, tint: o.tint ?? [0.55, 0.45, 0.36], crease: 55,
    wear: (x, y, z) => { const rad = Math.hypot(x, z); if (rad < r * 0.8) return 0; const a = Math.atan2(z, x); return (-Math.abs(Math.sin(a * 9 + noise3(y * 4, 0, 0, seed) * 4)) * 0.007 - noise3(x * 12, y * 12, z * 12, seed) * 0.004) * bark },
  })
  k.frame({ at, yaw: o.yaw }, () => {
    for (const s of [-1, 1]) {
      k.cyl('wood', r * 0.88, 0.006, [s * (len / 2 + 0.001), 0, 0], { axis: 'x', seg: 26, tint: [0.92, 0.78, 0.6] })
      for (let c = 0; c < 3; c++) k.box('charcoal', [0.002, r * (0.3 + 0.2 * c), 0.004], [s * (len / 2 + 0.0045), 0, 0], { roll: 0, pitch: c * 1.1 + seed, r: 0, tone: 0.5 })
    }
  })
}

function bale(k: Kit, w: number, h: number, d: number) {
  const r = Math.min(w, h) / 2, seed = 7
  const prof: V2[] = [[0, -d / 2], [r * 0.85, -d / 2], [r * 0.97, -d / 2 + 0.03], [r, -d / 2 + 0.07]]
  for (let i = 1; i < 12; i++) prof.push([r * (1 + Math.sin(i * 1.7) * 0.006), -d / 2 + 0.07 + (d - 0.14) * i / 12])
  prof.push([r, d / 2 - 0.07], [r * 0.97, d / 2 - 0.03], [r * 0.85, d / 2], [0, d / 2])

  const cy = r * 0.94 + 0.001
  k.lathe('straw', prof, [0, cy, 0], {
    axis: 'z', seg: 64, tint: STRAW, crease: 70,

    wear: (x, y, z) => {
      const rad = Math.hypot(x, z), a = Math.atan2(-z, x)
      const spiral = Math.sin(rad * 70 - a * 2) * 0.004 * (Math.abs(y) > d / 2 - 0.02 ? 1 : 0.3)
      const fiber = (noise3(x * 40, z * 40, y * 6, seed) - 0.5) * 0.01
      const flat = z > r * 0.9 ? (z - r * 0.9) * 0.6 : 0
      return spiral + fiber - flat
    },
  })
  for (const z of [-0.33, 0, 0.33]) k.torus('fabric', r + 0.003, 0.0032, [0, cy, z * d], { axis: 'z', segR: 64, seg: 5, arc: Math.PI * 1.4, tint: [0.88, 0.9, 0.86], roll: Math.PI * 0.7 })
  for (let i = 0; i < 22; i++) {

    const a = i / 11 * Math.PI * 2 + k.jitter(0.1), side = i % 2 ? 1 : -1, rr = r * (0.2 + k.rnd() * 0.6)
    k.tube('straw', [[Math.cos(a) * rr, cy + Math.sin(a) * rr, side * (d / 2 - 0.016)], [Math.cos(a + 0.2) * rr * 1.05, cy + Math.sin(a + 0.2) * rr, side * (d / 2 + 0.02)], [Math.cos(a + 0.35) * rr * 1.1, cy - 0.02 + Math.sin(a + 0.4) * rr, side * (d / 2 + 0.03)]], 0.0016, { seg: 4, tint: STRAW })
  }
}

function seedTray(k: Kit, at: V3, nx: number, nz: number, cell = 0.05, grown = 0.5) {
  const tw = nx * cell + 0.02, td = nz * cell + 0.02
  k.frame({ at }, () => {
    k.box('rubber', [tw, 0.045, td], [0, 0.0225, 0], { r: 0.006, tint: [0.18, 0.18, 0.19] })
    k.box('rubber', [tw + 0.012, 0.006, td + 0.012], [0, 0.045, 0], { r: 0.003, tint: [0.16, 0.16, 0.17] })
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = -tw / 2 + 0.01 + (i + 0.5) * cell, z = -td / 2 + 0.01 + (j + 0.5) * cell
      k.cyl('straw', cell * 0.4, 0.004, [x, 0.047, z], { seg: 6, tint: SOIL })
      if (k.chance(0.85)) {
        const stem = 0.02 + grown * 0.05 * (0.6 + k.rnd() * 0.8)
        k.cyl('paper', 0.0018, stem, [x, 0.049 + stem / 2, z], { seg: 4, tint: LEAF })
        const leaf = 0.012 + grown * 0.008
        for (const s of [-1, 1]) k.sphere('paper', leaf, [x + s * leaf * 0.6, 0.049 + stem, z], { rows: 3, seg: 6, scale: [1, 0.25, 0.6], yaw: k.rnd() * 3, roll: s * 0.4, tint: LEAF })
      }
    }
  })
}

function pot(k: Kit, r: number, h: number, at: V3, plant = true) {

  const inside: V2[] = plant ? [[r * 0.95, h * 0.88], [r * 0.935, h * 0.85], [0, h * 0.85]] : [[r * 0.95, h * 0.88], [r * 0.7, 0.015], [0, 0.015]]
  k.lathe('tile', [[0, 0], [r * 0.7, 0], [r * 0.72, 0.008], [r * 0.95, h * 0.82], [r * 1.08, h * 0.84], [r * 1.1, h], [r * 0.98, h], ...inside], at, { seg: 22, tint: [0.78, 0.45, 0.3], crease: 60 })
  if (plant) k.lathe('straw', [[r * 0.93, 0], [r * 0.5, 0.004], [0, 0.006]], [at[0], at[1] + h * 0.85 + 0.001, at[2]], { seg: 18, tint: SOIL })
  if (plant) for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + k.rnd(), len = h * (0.5 + k.rnd() * 0.6)
    k.tube('paper', [[at[0], at[1] + h * 0.86, at[2]], [at[0] + Math.cos(a) * r * 0.4, at[1] + h * 0.86 + len * 0.6, at[2] + Math.sin(a) * r * 0.4], [at[0] + Math.cos(a) * r * 0.9, at[1] + h * 0.86 + len, at[2] + Math.sin(a) * r * 0.9]], 0.003, { seg: 5, tint: LEAF })
    k.sphere('paper', 0.025, [at[0] + Math.cos(a) * r * 0.9, at[1] + h * 0.86 + len, at[2] + Math.sin(a) * r * 0.9], { rows: 4, seg: 8, scale: [1, 0.3, 0.55], yaw: -a, tint: LEAF })
  }
}

export const RURAL: Family = {
  tractor: (k, s) => {
    const { w, h, d } = k, v = s.variant, paint = PAINTS[v], bodyW = w - 0.52
    const rr = 0.53, fr = 0.3, rz = d * 0.24, fz = -d * 0.31, track = (bodyW + 0.26) / 2, ry = rr + lugLift(rr, 0.27), fy = fr - 0.002

    for (const x of [-1, 1]) {
      k.wheel([x * track, ry, rz], rr, 0.27, { tread: 'lug', ratio: 0.6, rim: 'paint', bolts: 8 })
      k.wheel([x * (track - 0.05), fy, fz], fr, 0.15, { tread: 'car', ratio: 0.58, rim: 'paint', bolts: 5 })
      k.cyl('paint', 0.085, track - 0.135 - bodyW * 0.22, [x * (bodyW * 0.22 + (track - 0.135 - bodyW * 0.22) / 2), ry, rz], { axis: 'x', seg: 20, tint: paint })
      k.cyl('steel', 0.03, 0.2, [x * (track - 0.17), fy + 0.06, fz], { seg: 12, tint: [0.35, 0.33, 0.3] })
      k.box('steel', [0.05, 0.05, 0.05], [x * (track - 0.15), fy, fz], { r: 0.008, tint: [0.35, 0.33, 0.3] })
    }
    k.box('paint', [2 * (track - 0.17) + 0.06, 0.1, 0.12], [0, fy + 0.11, fz], { r: 0.015, tint: paint })
    k.box('paint', [0.34, 0.16, 0.3], [0, 0.46, fz + 0.12], { r: 0.03, tint: paint })

    k.box('paint', [bodyW * 0.44, 0.5, 0.75], [0, ry, rz - 0.12], { r: 0.05, tint: paint })
    k.box('paint', [0.42, 0.42, 1.05], [0, 0.66, fz + 0.62], { r: 0.04, tint: paint })
    k.box('steel', [0.36, 0.12, 0.8], [0, 0.42, fz + 0.62], { r: 0.02, tint: [0.3, 0.28, 0.26] })
    k.cyl('paint', 0.24, 0.22, [0, 0.66, rz - 0.6], { axis: 'z', seg: 26, tint: paint })

    k.box('steel', [0.36, 0.06, 0.05], [0, 0.32, fz + 0.24], { r: 0.008, tint: [0.3, 0.3, 0.3] })
    for (const x of [-1, 1]) k.box('paint', [0.06, 0.2, 0.08], [x * 0.15, 0.31, fz + 0.24], { r: 0.01, tint: paint })

    const hoodW = Math.min(0.58, bodyW * 0.42), hoodH = 0.46, hz0 = fz - 0.18, hz1 = rz - 0.5, hoodY = 0.87
    const hood: V2[] = [[-hoodW / 2, 0], [hoodW / 2, 0], ...arc(hoodW / 2 - 0.12, hoodH - 0.12, 0.12, 0, Math.PI / 2, 5), ...arc(-hoodW / 2 + 0.12, hoodH - 0.12, 0.12, Math.PI / 2, Math.PI, 5)]
    k.extrude('paint', hood, hz1 - hz0, [0, hoodY, (hz0 + hz1) / 2], { bevel: 0.01, bevelSeg: 2, curveSeg: 4, tint: paint })
    for (const x of [-1, 1]) for (let i = 0; i < 5; i++) k.box('paint', [0.006, 0.012, 0.16], [x * (hoodW / 2 + 0.003), hoodY + 0.12 + i * 0.045, hz0 + 0.35], { roll: x * 0.5, r: 0.002, tint: paint })
    k.frameRect('steel', hoodW - 0.04, hoodH - 0.06, 0.03, 0.03, [0, hoodY + (hoodH - 0.06) / 2 + 0.01, hz0 - 0.012], { tone: 0.6 })
    for (let i = 0; i < 9; i++) k.box('steel', [0.012, hoodH - 0.12, 0.02], [-hoodW / 2 + 0.05 + i * (hoodW - 0.1) / 8, hoodY + (hoodH - 0.06) / 2 + 0.01, hz0 - 0.008], { r: 0.003, tone: 0.5 })
    k.cyl('steel', 0.035, 0.03, [0, hoodY + hoodH + 0.012, hz0 + 0.12], { seg: 16 })
    const ex = hoodW / 2 - 0.08
    k.cyl('steel', 0.045, 0.1, [ex, hoodY + hoodH + 0.045, hz0 + 0.38], { seg: 16, tint: [0.3, 0.27, 0.25] })
    k.cyl('steel', 0.032, 0.65, [ex, hoodY + hoodH + 0.42, hz0 + 0.38], { seg: 16, tint: [0.25, 0.22, 0.2] })
    k.cyl('steel', 0.055, 0.22, [ex, hoodY + hoodH + 0.32, hz0 + 0.38], { seg: 18, tint: [0.25, 0.22, 0.2] })
    k.frame({ at: [ex + 0.032, hoodY + hoodH + 0.745, hz0 + 0.38], roll: -0.35 }, () => k.cyl('steel', 0.036, 0.004, [-0.032, 0.002, 0], { seg: 16, tint: [0.3, 0.27, 0.25] }))
    k.cyl('paint', 0.05, 0.32, [-ex, hoodY + hoodH + 0.14, hz0 + 0.5], { seg: 16, tint: paint })
    k.cyl('steel', 0.065, 0.08, [-ex, hoodY + hoodH + 0.34, hz0 + 0.5], { seg: 18, tint: [0.2, 0.2, 0.2] })
    for (const x of [-1, 1]) {
      k.lathe('steel', [[0, 0], [0.07, 0], [0.075, 0.04], [0.06, 0.08], [0, 0.08]], [x * (hoodW / 2 + 0.02), hoodY + hoodH - 0.08, hz0 + 0.05], { axis: 'z', seg: 18, pitch: Math.PI, tint: [0.3, 0.3, 0.3] })
      k.cyl('glass', 0.06, 0.004, [x * (hoodW / 2 + 0.02), hoodY + hoodH - 0.08, hz0 - 0.03], { axis: 'z', seg: 18, tint: [0.95, 0.92, 0.8] })
      k.box('steel', [0.06, 0.03, 0.04], [x * (hoodW / 2 + 0.01), hoodY + hoodH - 0.08, hz0 + 0.07], { r: 0.006 })
    }

    k.box('steel', [hoodW * 0.9, 0.08, 0.12], [0, hoodY - 0.025, hz0 - 0.06], { r: 0.01, tint: [0.25, 0.25, 0.25] })
    for (let i = 0; i < 4; i++) k.box('steel', [hoodW * 0.85, 0.07, 0.05], [0, hoodY - 0.098 - i * 0.068, hz0 - 0.07], { r: 0.012, tint: [0.22, 0.22, 0.22] })

    k.box('paint', [hoodW + 0.06, 0.24, 0.32], [0, hoodY + hoodH - 0.1, hz1 + 0.15], { r: 0.06, tint: paint })
    k.cyl('steel', 0.04, 0.03, [0.1, hoodY + hoodH + 0.035, hz1 + 0.12], { seg: 16 })
    k.box('paint', [hoodW + 0.12, 0.42, 0.08], [0, hoodY + 0.22, hz1 + 0.35], { r: 0.02, tint: paint })
    for (let i = 0; i < 3; i++) k.lathe('steel', [[0, 0], [0.028, 0], [0.03, 0.01], [0.026, 0.015], [0, 0.015]], [-0.12 + i * 0.12, hoodY + 0.3, hz1 + 0.39], { axis: 'z', seg: 14 })
    const colTop: V3 = [0, 1.48, hz1 + 0.62]
    k.tube('steel', [[0, hoodY + 0.38, hz1 + 0.4], colTop], 0.022, { seg: 10 })
    k.frame({ at: colTop, pitch: -0.65 }, () => {
      k.torus('rubber', 0.19, 0.014, [0, 0, 0], { segR: 40, seg: 8 })
      k.cyl('steel', 0.035, 0.05, [0, 0, 0], { seg: 14 })
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box('steel', [0.17, 0.012, 0.022], [Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1], { yaw: -a, r: 0.004 }) }
    })

    const platY = ry + 0.256, plateW = bodyW * 0.28 + 0.02, plateX = bodyW * 0.22 - 0.08 + plateW / 2
    for (const x of [-1, 1]) k.box('steel', [plateW, 0.012, 0.65], [x * plateX, platY, rz - 0.42], { r: 0.003, tint: [0.4, 0.38, 0.36] })
    for (const x of [-1, 1]) for (let i = 0; i < 6; i++) k.rivet([x * plateX + (i % 2 ? 0.08 : -0.08), platY + 0.006, rz - 0.68 + i * 0.1], { pitch: -Math.PI / 2, r: 0.006 })
    for (const x of [-1, 1]) k.box('rubber', [0.1, 0.02, 0.16], [x * (bodyW * 0.22 + 0.06), platY + 0.038, rz - 0.62], { pitch: -0.4, r: 0.005 })
    for (const [x, len] of [[0.12, 0.42], [-0.1, 0.35]] as const) k.tube('steel', [[x, ry + 0.25, rz - 0.38], [x + 0.02, ry + 0.25 + len, rz - 0.42]], 0.009, { seg: 8 })
    k.sphere('rubber', 0.028, [0.14, ry + 0.25 + 0.42, rz - 0.42], { seg: 10, rows: 6 })
    k.tube('steel', [[0, ry + 0.25, rz - 0.05], [0, 1.08, rz + 0.02]], 0.03, { seg: 10 })
    k.lathe('steel', [[0, 0], [0.24, 0.0], [0.25, 0.03], [0.23, 0.1], [0.2, 0.1], [0.21, 0.035], [0, 0.035]], [0, 1.08, rz + 0.04], { seg: 28, scale: [1, 1, 0.9], tint: [0.32, 0.3, 0.28] })
    k.cushion('leather', [0.4, 0.06, 0.34], [0, 1.15, rz + 0.04], { puff: 0.015, tint: [0.25, 0.22, 0.2] })

    for (const x of [-1, 1]) {
      const R = rr + 0.07, band: V2[] = [...arc(0, 0, R + 0.012, 0.25, Math.PI - 0.15, 14), ...arc(0, 0, R, Math.PI - 0.15, 0.25, 14)]
      k.extrude('paint', band.map(([a, b]) => [-a, b] as V2), 0.34, [x * track, ry, rz], { axis: 'x', bevel: 0.004, curveSeg: 1, tint: paint })

      const braceTop = ry + Math.sqrt(R * R - 0.07 * 0.07) + 0.005
      k.box('paint', [0.04, braceTop - ry - 0.06, 0.08], [x * (track - 0.16), (braceTop + ry + 0.06) / 2, rz - 0.07], { r: 0.008, tint: paint })
    }

    const postZ = rz + 0.2, top = h - 0.065, postX = Math.min((bodyW - 0.07) / 2, track - 0.135 - 0.1)
    for (const x of [-1, 1]) {
      k.box('steel', [0.07, top - ry, 0.07], [x * postX, ry + (top - ry) / 2, postZ], { r: 0.006, tint: [0.2, 0.2, 0.2] })
      k.box('steel', [postX - bodyW * 0.22 + 0.04, 0.08, 0.08], [x * (postX + bodyW * 0.22 - 0.04) / 2, ry, postZ], { r: 0.008, tint: [0.2, 0.2, 0.2] })
    }
    k.box('steel', [2 * postX, 0.06, 0.06], [0, top - 0.04, postZ], { r: 0.006, tint: [0.2, 0.2, 0.2] })
    k.box('paint', [bodyW + 0.18, 0.04, d * 0.36], [0, top + 0.012, postZ - d * 0.08], { r: 0.012, tint: paint })
    for (const x of [-1, 1]) k.box('paint', [0.02, 0.06, d * 0.36], [x * (bodyW / 2 + 0.08), top - 0.01, postZ - d * 0.08], { r: 0.006, tint: paint })

    for (const x of [-1, 1]) k.box('steel', [0.05, 0.05, 0.55], [x * 0.2, ry - 0.2, rz + 0.45], { pitch: 0.35, r: 0.01, tint: [0.25, 0.25, 0.25] })
    k.box('steel', [0.12, 0.04, 0.42], [0, ry - 0.24, rz + 0.38], { r: 0.008, tint: [0.25, 0.25, 0.25] })
    k.cyl('steel', 0.022, 0.08, [0, ry - 0.183, rz + 0.55], { seg: 12 })
    k.cyl('steel', 0.032, 0.012, [0, ry - 0.137, rz + 0.55], { seg: 14 })
    if (v !== 1) k.box('steel', [0.32, 0.2, 0.18], [bodyW * 0.22 + 0.155, ry + 0.05, rz - 0.4], { r: 0.012, tint: [0.75, 0.15, 0.1] })
    for (let i = 0; i < 4; i++) k.cable('rubber', [-0.15 + i * 0.05, hoodY + 0.12, hz1 + 0.318], [-0.12 + i * 0.07, 0.62, rz - 0.4], 0.12, 0.006)
  },
  'hay-bale': (k, s) => {
    const { w, h, d } = k
    bale(k, w, h, d)

    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1, x = side * Math.min(w, h) / 2 * k.range(0.72, 0.9), z = -d / 2 + 0.08 + Math.floor(i / 2) * (d - 0.16) / 6, a = k.range(-0.3, 0.3), l = k.range(0.04, 0.09)
      k.tube('straw', [[x, 0.0016, z], [x + Math.cos(a) * l * 0.5, 0.004, z + Math.sin(a) * l * 0.5], [x + Math.cos(a) * l, 0.0016, z + Math.sin(a) * l]], 0.0016, { seg: 4, tint: STRAW })
    }
  },
  'horse-stall': (k, s) => {
    const { w, h, d } = k, v = s.variant, t = 0.07, post = 0.12, wallH = 1.15
    k.blk('concrete', [w, t, d], 0, 0, 0, { r: 0.01 })
    for (const x of [-1, 1]) for (const z of [-1, 0, 1]) k.blk('wood', [post, h - t, post], x * (w / 2 - post / 2), t, z * (d / 2 - post / 2), { tint: [0.7, 0.58, 0.45] })

    const bt = 0.04, floor = t + 0.012, xi = w / 2 - post, zb = -d / 2 + post, zf = d / 2 - post / 2, steel: V3 = [0.25, 0.25, 0.27]

    const mw = 2 * (xi - bt) - 0.004, mz0 = zb + bt + 0.002, mz1 = zf - bt / 2 - 0.002
    k.blk('rubber', [mw, 0.012, mz1 - mz0], 0, t, (mz0 + mz1) / 2, { r: 0.004, tint: [0.2, 0.2, 0.2] })
    litter(k, 'straw', mw - 0.04, mz1 - mz0 - 0.04, 0.05, [0, floor, (mz0 + mz1) / 2], { tint: STRAW, seed: v })
    const backN = Math.floor((h - 0.09 - t) / 0.14), boardsTop = t + 0.135 + (backN - 1) * 0.14
    for (let i = 0; i < backN; i++) k.plank('wood', 2 * xi, 0.13, bt, [0, t + 0.07 + i * 0.14, zb + bt / 2], { face: true, tint: [0.72, 0.6, 0.47], wear: 0 })
    k.box('wood', [2 * xi, h - boardsTop + 0.002, 0.06], [0, (h + boardsTop - 0.002) / 2, zb + bt / 2], { tint: [0.7, 0.58, 0.45] })
    const sideN = Math.round(wallH / 0.14), sz0 = zb + bt, rz1 = zf - 0.027
    for (const x of [-1, 1]) {
      const bz1 = x > 0 ? zf - bt / 2 : rz1, rx = x * (xi - 0.0245)
      for (let i = 0; i < sideN; i++) k.plank('wood', bz1 - sz0, 0.13, bt, [x * (xi - bt / 2), t + 0.07 + i * 0.14, (sz0 + bz1) / 2], { face: true, yaw: Math.PI / 2, tint: [0.75, 0.62, 0.48], wear: 0 })

      for (const y of [t + wallH + 0.03, h - 0.06]) k.box('steel', [0.05, 0.05, rz1 - sz0], [rx, y, (sz0 + rz1) / 2], { r: 0.008, tint: steel })
      const bars = Math.round((rz1 - sz0) / 0.09), y0 = t + wallH + 0.055, y1 = h - 0.085
      for (let i = 0; i < bars; i++) k.cyl('steel', 0.011, y1 - y0 + 0.004, [rx, (y0 + y1) / 2, sz0 + (i + 0.5) * (rz1 - sz0) / bars], { seg: 10, tint: steel })
    }

    const gate = 2 * xi * 0.42, gh = h * 0.5, gy = floor + 0.03 + gh / 2, ajar = v === 2 ? 0.7 : 0
    k.leaf({
      kind: 'door', pivot: k.point([-xi + 0.01, gy, zf]), axis: k.direction([0, -1, 0]), travel: 1.5, initial: ajar,
      handle: k.point([-xi + gate - 0.02, gy + 0.05, zf + 0.06]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
      center: k.point([-xi + gate / 2, gy, zf]), width: gate, height: gh, depth: 0.05, floor: k.point([-xi + gate / 2, floor, zf - 0.4]),
    }, () => k.frame({ at: [-xi + 0.01, gy, zf], yaw: -ajar }, () => k.frame({ at: [gate / 2 - 0.01, 0, 0] }, () => {
      k.frameRect('steel', gate, gh, 0.045, 0.05, [0, 0, 0], { tone: 0.8 })
      for (let i = 0; i < 6; i++) k.plank('wood', gate - 0.09, (gh - 0.09) / 6 - 0.008, 0.03, [0, -gh / 2 + 0.045 + (i + 0.5) * (gh - 0.09) / 6, 0], { face: true, tint: [0.78, 0.64, 0.5], wear: 0 })
      k.box('steel', [Math.hypot(gate - 0.09, gh - 0.09), 0.04, 0.008], [0, 0, 0.028], { roll: Math.atan2(gh - 0.09, gate - 0.09), r: 0.002 })
      for (const y of [-1, 1]) k.box('steel', [0.28, 0.04, 0.008], [-gate / 2 + 0.14, y * gh * 0.32, 0.028], { r: 0.002 })
      k.cyl('steel', 0.012, 0.12, [gate / 2 - 0.02, 0.05, 0.036], { axis: 'x', seg: 10 })
    })))
    for (const y of [0.18, 0.82]) k.cyl('steel', 0.014, 0.08, [-xi + 0.01, gy - gh / 2 + y * gh, zf], { seg: 10 })
    const rest = 2 * xi - gate, rcx = -xi + gate + rest / 2
    for (let i = 0; i < sideN; i++) k.plank('wood', rest, 0.13, bt, [rcx, t + 0.07 + i * 0.14, zf], { face: true, tint: [0.74, 0.61, 0.48], wear: 0 })
    k.box('steel', [rest, 0.05, 0.05], [rcx, t + wallH + 0.03, zf], { r: 0.008, tint: steel })

    const hx = xi - bt - 0.25, hz = zb + bt + 0.16, troughTint: V3 = [0.65, 0.55, 0.42]
    k.box('wood', [0.06, 0.262, 0.06], [hx, floor + 0.131, hz], { tint: troughTint })
    k.box('wood', [0.44, 0.03, 0.26], [hx, floor + 0.275, hz], { tint: troughTint })
    for (const z of [-1, 1]) k.box('wood', [0.5, 0.23, 0.03], [hx, floor + 0.375, hz + z * 0.145], { tint: troughTint })
    for (const x of [-1, 1]) k.box('wood', [0.03, 0.23, 0.26], [hx + x * 0.235, floor + 0.375, hz], { tint: troughTint })
    k.box('straw', [0.42, 0.06, 0.24], [hx, floor + 0.32, hz], { r: 0.02, tint: [0.62, 0.52, 0.32] })

    k.frame({ at: [-hx, floor + 1.03, zb + bt - 0.004] }, () => {
      for (let i = 0; i < 7; i++) k.tube('steel', [[-0.25 + i * 0.083, 0.2, 0], [-0.25 + i * 0.083, -0.1, 0.24], [-0.25 + i * 0.083, -0.2, 0]], 0.008, { seg: 6, fillet: 0.04, tint: [0.3, 0.3, 0.32] })
      k.extrude('straw', [[-0.004, 0.17], [-0.2, -0.09], [-0.004, -0.18]], 0.48, [0, 0, 0], { axis: 'x', bevel: 0.01, tint: STRAW, wear: (x, y, z) => (noise3(x * 30, y * 30, z * 30, v) - 0.5) * 0.012 })
    })
    pail(k, 'steel', 0.15, 0.28, [xi - bt - 0.2, floor, zf - 0.32], { tint: [0.8, 0.82, 0.84], fill: 'glass', fillTint: [0.4, 0.45, 0.4] })
  },
  'feed-hopper': (k, s) => {
    const { w, h, d } = k, v = s.variant, deck = h * 0.5, R = Math.min(w, d) * 0.44, galv: V3 = [0.84, 0.86, 0.88]
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      column(k, 'steel', angleOutline(0.06, 0.006), deck - 0.076, 0, x * (w / 2 - 0.04), z * (d / 2 - 0.04), { yaw: Math.atan2(-x, -z) + Math.PI * 0.75, tint: galv })
      k.blk('concrete', [0.18, 0.06, 0.18], x * (w / 2 - 0.04), 0, z * (d / 2 - 0.04), { r: 0.015, tint: [0.75, 0.74, 0.7] })
    }
    for (const z of [-1, 1]) { k.box('steel', [w - 0.08, 0.05, 0.012], [0, deck * 0.45, z * (d / 2 - 0.04)], { roll: 0.0, r: 0.002, tint: galv }); k.box('steel', [Math.hypot(w - 0.1, deck * 0.6), 0.04, 0.01], [0, deck * 0.5, z * (d / 2 - 0.03)], { roll: Math.atan2(deck * 0.6, w - 0.1), r: 0.002, tint: galv }) }
    for (const x of [-1, 1]) k.box('steel', [0.012, 0.05, d - 0.08], [x * (w / 2 - 0.04), deck * 0.45, 0], { r: 0.002, tint: galv })
    k.blk('steel', [w, 0.08, d], 0, deck - 0.08, 0, { r: 0.01, tint: [0.5, 0.52, 0.5] })

    const binH = h - deck - 0.45, ripple: V2[] = [[0, 0], [R, 0]]
    for (let i = 0; i <= Math.round(binH / 0.07); i++) { const y = i * binH / Math.round(binH / 0.07); ripple.push([R + (i % 2 ? 0.008 : 0), y]) }
    ripple.push([0, binH])
    k.lathe('steel', ripple, [0, deck + 0.0, 0], { seg: 40, crease: 70, tint: galv })
    for (const f of [0.02, 0.5, 0.98]) k.torus('steel', R + 0.012, 0.008, [0, deck + binH * f, 0], { segR: 48, seg: 6, tint: galv })
    k.lathe('steel', [[0, 0], [R + 0.02, 0], [R + 0.03, 0.02], [0.12, 0.38], [0, 0.38]], [0, deck + binH, 0], { seg: 40, tint: galv })
    k.frame({ at: [0, deck + binH + 0.393, 0] }, () => { k.cyl('steel', 0.13, 0.03, [0, 0.0, 0], { seg: 24, tint: galv }); k.handle([0, 0.015, 0], 0.08, { pitch: -Math.PI / 2, r: 0.005, standoff: 0.025 }) })
    k.lathe('steel', [[0.08, 0], [R * 0.95, deck * 0.0 + 0.0], [R * 0.95, 0.01], [0.09, -deck * 0.42 + 0.01], [0.08, -deck * 0.42]], [0, deck - 0.075, 0], { seg: 32, crease: 50, tint: galv })
    k.box('steel', [0.22, 0.2, 0.22], [0, deck - 0.08 - deck * 0.42 - 0.08, 0], { r: 0.01, tint: galv })
    k.box('steel', [0.26, 0.012, 0.3], [0, deck - 0.08 - deck * 0.42 - 0.17, 0.04], { r: 0.003, tint: [0.6, 0.6, 0.6] })
    k.box('steel', [0.1, 0.03, 0.03], [0, deck - 0.08 - deck * 0.42 - 0.15, 0.2], { r: 0.006 })
    for (const x of [-1, 1]) k.cyl('steel', 0.014, binH + 0.35, [x * 0.16, deck + (binH + 0.35) / 2, R + 0.08], { seg: 10, tint: galv })
    for (let i = 0; i < Math.round((binH + 0.3) / 0.3); i++) {
      k.cyl('steel', 0.011, 0.32, [0, deck + 0.15 + i * 0.3, R + 0.08], { axis: 'x', seg: 10, tint: galv })
    }
    for (const y of [0.25, binH - 0.15]) for (const x of [-1, 1]) k.box('steel', [0.03, 0.03, 0.1], [x * 0.16, deck + y, R + 0.035], { r: 0.004, tint: galv })

    litter(k, 'straw', 0.7, 0.5, 0.05 + v * 0.01, [0, 0, 0.05], { tint: [0.85, 0.72, 0.4], seed: v + 4 })
    pail(k, 'steel', 0.14, 0.25, [0, 0, d / 2 - 0.17], { tint: RUST })
  },
  'seedling-bench': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.8, leg = 0.06, shelf = 0.18, shelfTop = shelf + leg * 0.3 + 0.018
    legFrame(k, 'wood', w, d, top - 0.03, { leg, shelf, tint: [0.78, 0.66, 0.52] })
    boardTop(k, 'wood', w, d, top - 0.03, { th: 0.03, boards: 6, gap: 0.012, tint: [0.8, 0.68, 0.55] })
    const trays = Math.max(2, Math.floor((w - 0.1) / 0.38))
    for (let i = 0; i < trays; i++) seedTray(k, [-w / 2 + 0.06 + 0.17 + i * (w - 0.12) / trays, top, k.jitter(0.03)], 6, Math.max(4, Math.floor((d - 0.2) / 0.05)), 0.05, (i + v) % 3 * 0.4 + 0.2)
    for (let i = 0; i < 2; i++) seedTray(k, [-w / 2 + 0.3 + i * 0.4, shelfTop, 0], 4, 6, 0.05, 0.05)
    k.frame({ at: [w / 2 - 0.36, shelfTop, -d / 4] }, () => {
      k.lathe('steel', [[0, 0], [0.09, 0], [0.095, 0.22], [0.06, 0.25], [0, 0.25]], [0, 0, 0], { seg: 22, tint: [0.35, 0.55, 0.4], scale: [1, 1, 0.75] })
      k.tube('steel', [[0.08, 0.18, 0], [0.24, 0.32, 0], [0.295, 0.326, 0]], 0.012, { seg: 10, tint: [0.35, 0.55, 0.4] })
      k.lathe('steel', [[0, 0], [0.02, 0], [0.03, 0.03], [0, 0.03]], [0.29, 0.325, 0], { axis: 'x', seg: 14, tint: [0.35, 0.55, 0.4] })
      k.tube('steel', [[-0.06, 0.252, 0], [-0.07, 0.36, 0], [0.05, 0.36, 0], [0.06, 0.252, 0]], 0.008, { seg: 8, fillet: 0.04, tint: [0.35, 0.55, 0.4] })
    })

    for (let i = 0; i < 4; i++) k.label([-w / 2 + 0.2 + i * 0.3, top - 0.075, d / 2 - 0.0355], 0.08, 0.035, { m: 'paper' })
  },
  'potting-bench': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.85, leg = 0.065, shelf = 0.2, shelfTop = shelf + leg * 0.3 + 0.018
    legFrame(k, 'wood', w, d, top - 0.03, { leg, shelf, tint: [0.68, 0.56, 0.44] })
    boardTop(k, 'wood', w, d, top - 0.03, { th: 0.03, boards: 5, gap: 0.008, tint: [0.7, 0.58, 0.46] })

    const bz = -d / 2 + 0.02
    for (const x of [-1, 1]) k.blk('wood', [0.05, h - top, 0.04], x * (w / 2 - 0.05), top, bz, { tint: [0.68, 0.56, 0.44] })
    for (let i = 0; i < 3; i++) k.plank('wood', w - 0.06, 0.1, 0.02, [0, top + 0.06 + i * 0.11, bz - 0.03], { face: true, tint: [0.72, 0.6, 0.48], wear: 0 })
    k.blk('wood', [w - 0.15, 0.025, 0.14], 0, h - 0.06, bz + 0.05, { tint: [0.72, 0.6, 0.48] })
    for (const x of [-1, 1]) k.box('wood', [0.025, 0.08, 0.1], [x * (w / 2 - 0.1), h - 0.1, bz + 0.03], { tint: [0.68, 0.56, 0.44] })
    for (let i = 0; i < 3 + v; i++) pot(k, 0.045, 0.08, [-w / 2 + 0.15 + i * (w - 0.3) / (2 + v), h - 0.035, bz + 0.06], false)
    for (const [x, kind] of [[-0.3, 0], [-0.1, 1], [0.15, 0]] as const) {
      k.cyl('steel', 0.004, 0.03, [x * w, top + 0.28, bz - 0.005], { axis: 'z', seg: 8 })
      k.frame({ at: [x * w, top + 0.2, bz + 0.012] }, () => {
        k.cyl('wood', 0.014, 0.11, [0, 0.03, 0], { seg: 12, tint: [0.6, 0.4, 0.25] })
        if (kind === 0) k.extrude('steel', [[-0.035, 0], [0.035, 0], [0.02, -0.12], [0, -0.14], [-0.02, -0.12]], 0.003, [0, -0.025, 0], { bevel: 0.0008, tint: [0.6, 0.6, 0.62] })
        else { k.box('steel', [0.05, 0.008, 0.006], [0, -0.025, 0], { r: 0.001 }); for (let t = 0; t < 3; t++) k.box('steel', [0.006, 0.1, 0.004], [-0.02 + t * 0.02, -0.07, 0], { r: 0.001 }) }
      })
    }

    pot(k, 0.11, 0.2, [-w * 0.22, top, 0.05])

    for (let i = 0; i < 3; i++) pot(k, 0.09, 0.16, [w * 0.05, top + i * 0.012, 0.08], false)
    k.cushion('fabric', [0.4, 0.22, 0.28], [w * 0.3, top + 0.11, 0.04], { puff: 0.04, wrinkle: 1.2, r: 0.06, tint: [0.6, 0.55, 0.4] })
    k.sheet('straw', 0.3, 0.2, (x, z) => Math.max(0, 0.02 - (x * x + z * z) * 0.25) + 0.002, [-w * 0.05, top, -0.08], { thickness: 0.003, tint: SOIL })
    for (let i = 0; i < 4; i++) pot(k, 0.12, 0.22, [-w / 2 + 0.2 + i * (w - 0.4) / 3, shelfTop, 0], i % 2 === 0)
  },
  'saw-table': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.82, leg = 0.1, tw = w * 0.6, td = d * 0.72, slot = 0.006, deckY = top + 0.05

    const fw = w * 0.55, fd = d * 0.7, lx = fw / 2 - 0.02 - leg / 2, lz = fd / 2 - 0.02 - leg / 2
    legFrame(k, 'wood', fw, fd, top, { leg, stretcher: 0.18, tint: [0.62, 0.5, 0.38] })
    for (const x of [-1, 1]) k.blk('steel', [tw / 2 - slot / 2, 0.05, td], x * (tw / 4 + slot / 4), top, 0, { r: 0.008, tint: [0.45, 0.46, 0.47] })
    k.blk('steel', [tw, 0.1, 0.012], 0, top - 0.06, td / 2 + 0.006, { r: 0.003, tint: [0.45, 0.46, 0.47] })

    const bladeR = 0.3, by = top - 0.06, teeth = 36, outline: V2[] = []
    for (let i = 0; i < teeth; i++) { const a = i / teeth * Math.PI * 2; outline.push([Math.cos(a) * bladeR * 0.94, Math.sin(a) * bladeR * 0.94], [Math.cos(a + 0.06) * bladeR, Math.sin(a + 0.06) * bladeR], [Math.cos(a + 0.14) * bladeR * 0.95, Math.sin(a + 0.14) * bladeR * 0.95]) }
    k.extrude('steel', outline, 0.004, [0, by, 0], { yaw: Math.PI / 2, bevel: 0.0008, curveSeg: 1, tint: [0.8, 0.82, 0.84] })
    for (const x of [-1, 1]) {
      k.cyl('steel', 0.06, 0.013, [x * 0.0085, by, 0], { axis: 'x', seg: 20 })
      k.cyl('steel', 0.02, 0.08, [x * 0.055, by, 0], { axis: 'x', seg: 14 })
      k.box('steel', [0.05, top - by + 0.04, 0.12], [x * 0.12, (top + by - 0.04) / 2, 0], { r: 0.008, tint: [0.3, 0.3, 0.32] })
    }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; k.bolt([0.015, by + Math.cos(a) * 0.04, Math.sin(a) * 0.04], { yaw: Math.PI / 2, r: 0.005 }) }

    const a0 = 0.6, hood: V2[] = [...arc(0, 0, bladeR + 0.06, a0, Math.PI - a0, 12), ...arc(0, 0, bladeR + 0.04, Math.PI - a0, a0, 12)]
    k.extrude('paint', hood.map(([a, b]) => [-a, b] as V2), 0.08, [0, by, 0], { axis: 'x', bevel: 0.003, tint: [0.85, 0.65, 0.12] })
    const postZ = -(bladeR + 0.1), armY = by + bladeR + 0.07
    k.box('steel', [0.03, 0.03, -postZ + 0.035], [-0.045, armY, (postZ + 0.02) / 2], { r: 0.004 })
    k.box('steel', [0.03, armY + 0.015 - deckY, 0.03], [-0.045, (deckY + armY + 0.015) / 2, postZ], { r: 0.004 })

    k.box('wood', [2 * (lx - leg / 2) - 0.004, 0.03, 2 * lz + 0.06], [0, 0.225, 0], { tint: [0.62, 0.5, 0.38] })
    motor(k, [-0.03, 0.24, 0], 0.09, 0.3, { tint: [0.25, 0.35, 0.45] })
    k.box('paint', [0.06, top - 0.24, 0.26], [0.18, (top + 0.24) / 2, 0], { r: 0.02, tint: [0.85, 0.65, 0.12] })

    for (const side of [-1, 1]) {
      const cx = side * w * 0.41, len = w * 0.15, cz = d * 0.32
      for (const z of [-1, 1]) {
        k.blk('steel', [0.05, top - 0.06, 0.05], cx, 0, z * cz, { r: 0.006, tint: [0.4, 0.4, 0.4] })
        k.blk('steel', [len + 0.06, 0.06, 0.03], cx, top - 0.06, z * cz, { r: 0.004, tint: [0.4, 0.4, 0.4] })
      }
      for (let i = 0; i < 3; i++) k.cyl('steel', 0.03, 2 * (cz - 0.015) + 0.002, [cx - len / 2 + 0.03 + i * (len - 0.06) / 2, top, 0], { axis: 'z', seg: 16, tint: [0.7, 0.72, 0.74] })
    }

    k.plank('wood', w * 0.7, 0.2, 0.05, [w * 0.12, deckY + 0.025, Math.min(0.37, td / 2 - 0.11)], { tint: [0.85, 0.72, 0.55], wear: 0 })
    litter(k, 'straw', w * 0.35, d * 0.4, 0.025 + v * 0.008, [0, 0, 0], { tint: [0.92, 0.82, 0.62], seed: 11 + v })
  },
  'log-stack': (k, s) => {
    const { w, h, d } = k, v = s.variant

    for (const z of [-1, 1]) {
      k.blk('wood', [w, 0.15, 0.18], 0, 0, z * (d - 0.18) / 2, { tint: [0.5, 0.42, 0.34] })
      for (const x of [-1, 1]) k.blk('wood', [0.08, 0.55, 0.08], x * (w / 2 - 0.04), 0, z * ((d - 0.18) / 2 + 0.13), { tint: [0.5, 0.42, 0.34] })
    }

    const r1 = 0.25, base = 0.15, spacing = w / 1.8 * 0.6, c1 = base + 0.96 * r1 - 0.01
    for (const x of [-1, 0, 1]) { const r = r1 * (0.94 + k.rnd() * 0.08); log(k, r, d - 0.04, [x * spacing, base + 0.96 * r - 0.01, 0], { yaw: Math.PI / 2, seed: x + 3 + v * 7 }) }

    const r2 = 0.17, gap = spacing / 2, y2 = c1 + Math.sqrt(Math.max(0.01, (r1 + r2 - 0.045) ** 2 - gap * gap))
    for (const x of [-1, 1]) log(k, r2, d - 0.3 + v * 0.05, [x * gap, y2, 0.08 * x], { yaw: Math.PI / 2, seed: x + 20 + v })

    for (let i = 0; i < 6 + v * 2; i++) {
      const col = i % 4, row = Math.floor(i / 4), x = -w / 2 + 0.3 + col * (w - 0.6) / 3, z = -d / 2 + 0.45 + row * 0.5
      k.extrude('wood', [[0, 0], [0.09, 0], [0.045, 0.08]], 0.32, [x, 0, z], { axis: 'x', yaw: k.jitter(0.25), bevel: 0.004, tint: [0.85, 0.7, 0.52] })
    }
  },
  well: (k, s) => {
    const { w, h, d } = k, v = s.variant

    const ch = 0.65, wall = 0.16
    for (let c = 0; c < Math.round(ch / 0.075); c++) {
      const y = c * 0.075
      for (const z of [-1, 1]) { const n = Math.round(w / 0.23); for (let i = 0; i < n; i++) k.blk('brick', [w / n - 0.01, 0.065, wall], -w / 2 + (i + 0.5 + (c % 2 ? 0.25 : -0.25)) * w / n * 0.98 + (c % 2 ? -0.03 : 0.03) * 0, y, z * (d - wall) / 2, { r: 0.006, tone: 0.8 + k.rnd() * 0.3 }) }
      for (const x of [-1, 1]) { const n = Math.round((d - 2 * wall) / 0.23); for (let i = 0; i < n; i++) k.blk('brick', [wall, 0.065, (d - 2 * wall) / n - 0.01], x * (w - wall) / 2, y, -(d - 2 * wall) / 2 + (i + 0.5) * (d - 2 * wall) / n, { r: 0.006, tone: 0.8 + k.rnd() * 0.3 }) }
      k.extrude('concrete', [[-w / 2 + 0.01, -d / 2 + 0.01], [w / 2 - 0.01, -d / 2 + 0.01], [w / 2 - 0.01, d / 2 - 0.01], [-w / 2 + 0.01, d / 2 - 0.01]], 0.012, [0, y + 0.07, 0], { axis: 'y', holes: [[[-w / 2 + wall - 0.01, -d / 2 + wall - 0.01], [-w / 2 + wall - 0.01, d / 2 - wall + 0.01], [w / 2 - wall + 0.01, d / 2 - wall + 0.01], [w / 2 - wall + 0.01, -d / 2 + wall - 0.01]]], tint: [0.85, 0.82, 0.75] })
    }
    k.extrude('concrete', [[-w / 2 - 0.02, -d / 2 - 0.02], [w / 2 + 0.02, -d / 2 - 0.02], [w / 2 + 0.02, d / 2 + 0.02], [-w / 2 - 0.02, d / 2 + 0.02]], 0.06, [0, ch + 0.03, 0], { axis: 'y', holes: [[[-w / 2 + wall, -d / 2 + wall], [-w / 2 + wall, d / 2 - wall], [w / 2 - wall, d / 2 - wall], [w / 2 - wall, -d / 2 + wall]]], bevel: 0.01, tint: [0.75, 0.73, 0.68] })
    k.blk('glass', [w - 2 * wall, 0.01, d - 2 * wall], 0, 0.02, 0, { r: 0, tint: [0.12, 0.15, 0.13] })

    const ridge = h - 0.02, eave = h - 0.45, postH = ridge - 0.1 - ch - 0.06
    for (const x of [-1, 1]) k.blk('wood', [0.1, postH, 0.1], x * (w - 0.1) / 2, ch + 0.06, 0, { tint: [0.6, 0.48, 0.36] })
    k.box('wood', [w + 0.04, 0.08, 0.08], [0, ridge - 0.06, 0], { tint: [0.55, 0.44, 0.33] })
    for (const z of [-1, 1]) {
      const run = d / 2 + 0.02, slope = Math.atan2(ridge - eave, run), len = Math.hypot(run, ridge - eave)
      k.frame({ at: [0, (ridge + eave) / 2 - 0.02, z * run / 2], pitch: z * slope }, () => {
        k.box('wood', [w + 0.08, 0.025, len], [0, 0, 0], { tint: [0.5, 0.4, 0.3] })

        const rows = Math.floor((len - 0.165) / 0.11) + 1
        for (let r = 0; r < rows; r++) for (let i = 0; i < Math.round((w + 0.08) / 0.15); i++) {
          const n = Math.round((w + 0.08) / 0.15)
          k.box('wood', [(w + 0.08) / n - 0.008, 0.012, 0.16], [-(w + 0.08) / 2 + (i + 0.5 + (r % 2) * 0.5) * (w + 0.08) / n - (r % 2 && i === n - 1 ? (w + 0.08) / n * 0.5 : 0), 0.0185 + r * 0.0005, z * (len / 2 - 0.08 - r * 0.11)], { pitch: z * -0.06, r: 0.0008, tone: 0.65 + k.rnd() * 0.35, tint: [0.55, 0.48, 0.4] })
        }
      })
    }
    k.box('wood', [w + 0.1, 0.04, 0.16], [0, ridge + 0.005, 0], { r: 0.008, tint: [0.45, 0.36, 0.28] })
    const wy = ch + 0.06 + postH * 0.55
    k.cyl('wood', 0.07, w - 0.2, [0, wy, 0], { axis: 'x', seg: 18, tint: [0.62, 0.5, 0.38] })
    for (const x of [-1, 1]) k.cyl('steel', 0.015, 0.06, [x * (w / 2 - 0.1 + 0.0), wy, 0], { axis: 'x', seg: 10 })
    k.tube('steel', [[w / 2 - 0.05, wy, 0], [w / 2 + 0.014, wy, 0], [w / 2 + 0.014, wy - 0.2, 0], [w / 2 + 0.03, wy - 0.2, 0]], 0.012, { fillet: 0.03, seg: 8 })
    k.cyl('wood', 0.016, 0.045, [w / 2 + 0.0485, wy - 0.2, 0], { axis: 'x', seg: 10, tint: [0.5, 0.35, 0.25] })
    for (let i = 0; i < 9; i++) k.torus('fabric', 0.078, 0.007, [-w / 2 + 0.2 + i * 0.018, wy, 0], { axis: 'x', segR: 20, seg: 6, tint: [0.75, 0.62, 0.45] })

    rope(k, [[-w / 2 + 0.36, wy - 0.07, 0], [-w / 2 + 0.36, ch * 0.5 + 0.394, 0]], 0.007)
    pail(k, 'wood', 0.13, 0.24, [-w / 2 + 0.36, ch * 0.5 + 0.06, 0], { tint: [0.6, 0.5, 0.38], bail: 0 })
    if (v === 2) pail(k, 'steel', 0.14, 0.26, [w / 2 - 0.22, ch + 0.06, d / 2 - 0.1], { tint: RUST })
  },
  hearth: (k, s) => {
    const { w, h, d } = k, v = s.variant, course = 0.075, rows = Math.round(h / course), base = Math.round(h * 0.32 / course) * course

    const recess = 0.14, opening = w * 0.56, openTop = base + h * 0.3, mantel = base + h * 0.42
    for (let r = 0; r < rows; r++) {
      const y = r * course, inFire = y >= base && y < openTop, inChimney = y >= mantel
      const depth = inChimney ? d * 0.45 : y >= base ? d - recess : d, cz = inChimney ? -d * 0.275 : y >= base ? -recess / 2 : 0
      const cw = inChimney ? w * 0.5 : w, n = Math.max(2, Math.round(cw / 0.23))
      for (let i = 0; i <= n; i++) {
        let x0 = -cw / 2 + (i - (r % 2) * 0.5) * cw / n, x1 = x0 + cw / n - 0.01
        x0 = Math.max(x0, -cw / 2); x1 = Math.min(x1, cw / 2)
        if (x1 - x0 < 0.04) continue
        if (inFire && x1 > -opening / 2 && x0 < opening / 2) {
          if (x0 < -opening / 2) x1 = -opening / 2 - 0.005
          else if (x1 > opening / 2) x0 = opening / 2 + 0.005
          else continue
          if (x1 - x0 < 0.04) continue
        }
        k.blk('brick', [x1 - x0, course - 0.01, depth], (x0 + x1) / 2, y, cz, { r: 0.006, tone: 0.75 + k.rnd() * 0.35 })
      }

      if (inFire) for (const s of [-1, 1]) { const x0 = opening / 2 + 0.005, x1 = cw / 2 - 0.01; k.blk('concrete', [x1 - x0, 0.012, depth - 0.02], s * (x0 + x1) / 2, y + course - 0.011, cz, { r: 0.002, tint: [0.82, 0.8, 0.74] }) }
      else k.blk('concrete', [cw - 0.02, 0.012, depth - 0.02], 0, y + course - 0.011, cz, { r: 0.002, tint: [0.82, 0.8, 0.74] })
    }
    k.blk('charcoal', [opening, openTop - base, 0.06], 0, base, -d / 2 + 0.05, { tone: 0.35 })

    const ledgeTop = base + 0.02, mz = d / 2 - 0.04
    k.blk('concrete', [w + 0.06, 0.05, recess + 0.06], 0, ledgeTop - 0.05, d / 2 - recess / 2 + 0.01, { r: 0.012, tint: [0.62, 0.6, 0.56] })
    k.blk('wood', [w + 0.06, 0.07, 0.2], 0, mantel - 0.07, d / 2 - 0.06, { r: 0.01, tint: [0.45, 0.32, 0.22] })

    const sw = opening * 0.72, sh = (openTop - base) * 0.62, sz = 0.02
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.blk('steel', [0.04, 0.08, 0.04], x * (sw / 2 - 0.03), base, sz + z * 0.12, { r: 0.008, tint: [0.18, 0.18, 0.18] })
    const fw = sw * 0.6, fh = sh * 0.6, sy = base + 0.08, iron: V3 = [0.18, 0.17, 0.17]
    k.blk('steel', [sw, sh, 0.12], 0, sy, sz - 0.11, { r: 0.015, tint: iron })
    for (const y of [sy, sy + (sh + fh) / 2]) k.blk('steel', [sw, (sh - fh) / 2, 0.22], 0, y, sz + 0.06, { r: 0.01, tint: iron })
    for (const x of [-1, 1]) k.blk('steel', [(sw - fw) / 2, fh, 0.22], x * (sw + fw) / 4, sy + (sh - fh) / 2, sz + 0.06, { r: 0.006, tint: iron })
    k.box('concrete', [fw - 0.01, 0.012, 0.21], [0, sy + (sh - fh) / 2 + 0.006, sz + 0.06], { r: 0.002, tint: [0.3, 0.29, 0.28] })
    if (v !== 2) for (const [x, z, yaw] of [[-0.03, sz + 0.02, 0.2], [0.04, sz + 0.11, -0.25]]) k.cyl('wood', 0.026, fw * 0.66, [x, sy + (sh - fh) / 2 + 0.038, z], { axis: 'x', yaw, seg: 10, tint: [0.11, 0.08, 0.06] })
    k.frame({ at: [0, base + 0.08 + sh / 2, sz + 0.17] }, () => k.leaf({
      kind: 'door', pivot: k.point([-sw * 0.35, 0, 0]), axis: k.direction([0, -1, 0]), travel: 1.75, initial: 0,
      handle: k.point([sw * 0.3, 0, 0.05]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
      center: k.point([0, 0, 0.01]), width: sw * 0.7, height: sh * 0.7, depth: 0.02, floor: k.point([0, -sh * 0.45, -0.17]),
    }, () => {
      k.frameRect('steel', sw * 0.7, sh * 0.7, 0.03, 0.02, [0, 0, 0.01], { tone: 0.5 })
      k.box('glass', [sw * 0.7 - 0.05, sh * 0.7 - 0.05, 0.004], [0, 0, 0.008], { r: 0, tint: [0.3, 0.2, 0.15] })
      k.handle([sw * 0.3, 0, 0.02], 0.08, { vertical: true, r: 0.006, standoff: 0.03 })
    }))

    const flue0 = base + 0.08 + sh - 0.01, flue1 = openTop - 0.005
    k.cyl('steel', 0.07, flue1 - flue0, [0, (flue0 + flue1) / 2, sz - 0.05], { seg: 18, tint: [0.15, 0.15, 0.15] })

    k.cyl('tile', 0.03, 0.16, [-w * 0.3, mantel + 0.08, mz], { seg: 14, tint: [0.92, 0.9, 0.82] })
    k.cyl('tile', 0.03, 0.12, [-w * 0.2, mantel + 0.06, mz], { seg: 14, tint: [0.92, 0.9, 0.82] })
    k.lathe('glass', [[0, 0], [0.05, 0], [0.055, 0.12], [0.03, 0.16], [0, 0.16]], [w * 0.3, mantel, mz], { seg: 16, tint: [0.5, 0.65, 0.5] })

    for (const z of [-0.1, -0.03]) log(k, 0.035, 0.3, [w * 0.25, ledgeTop + 0.032, d / 2 + z], { yaw: k.jitter(0.02), seed: Math.round(z * 100) + v })
    log(k, 0.035, 0.28, [w * 0.25 + 0.01, ledgeTop + 0.032 + 0.055, d / 2 - 0.065], { yaw: 0.015, seed: 9 + v })
    const fx = -w / 2 + 0.12, fz = d / 2 - 0.065
    k.cyl('steel', 0.055, 0.012, [fx, ledgeTop + 0.006, fz], { seg: 16, tint: [0.18, 0.18, 0.18] })
    k.cyl('steel', 0.008, 0.55, [fx, ledgeTop + 0.28, fz], { seg: 8, tint: [0.18, 0.18, 0.18] })
    k.box('steel', [0.1, 0.02, 0.02], [fx, ledgeTop + 0.5, fz], { r: 0.004, tint: [0.2, 0.2, 0.2] })
    for (const x of [-0.045, 0.045]) k.tube('steel', [[fx + x, ledgeTop + 0.13, fz + 0.012], [fx + x, ledgeTop + 0.51, fz + 0.012]], 0.005, { seg: 6, tint: [0.2, 0.2, 0.2] })
    litter(k, 'plaster', opening * 0.6, 0.16, 0.01, [0, base, -d / 2 + 0.2], { tint: [0.45, 0.43, 0.42] })
  },
  'camp-tent': (k, s) => {
    const { w, h, d } = k, v = s.variant, canvas: V3 = [[0.42, 0.45, 0.32], [0.55, 0.48, 0.36], [0.35, 0.4, 0.45]][v] as V3
    const ridgeY = h - 0.06, len = d - 0.3

    k.blk('rubber', [w - 0.3, 0.004, len - 0.05], 0, 0, 0, { r: 0.001, tint: [0.25, 0.28, 0.22] })
    k.cushion('fabric', [0.62, 0.1, 1.8], [-w * 0.15, 0.0685, -0.05], { puff: 0.03, wrinkle: 1.2, r: 0.05, tint: [0.55, 0.25, 0.18] })
    k.cyl('fabric', 0.09, 0.62, [-w * 0.15, 0.19, 0.7], { axis: 'x', seg: 18, tint: [0.55, 0.25, 0.18] })

    for (const z of [-1, 1]) k.cyl('wood', 0.02, ridgeY - 0.004, [0, ridgeY / 2, z * len / 2], { seg: 12, tint: [0.65, 0.52, 0.38] })
    k.cyl('wood', 0.022, len + 0.16, [0, ridgeY + 0.0, 0], { axis: 'z', seg: 12, tint: [0.65, 0.52, 0.38] })
    for (const side of [-1, 1]) {
      const run = w / 2 - 0.12, slope = Math.atan2(ridgeY - 0.02, run), panel = Math.hypot(run, ridgeY - 0.02)
      k.frame({ at: [side * run / 2, (ridgeY + 0.02) / 2 + 0.0, 0], roll: -side * slope }, () => {
        k.sheet('fabric', panel, len + 0.1, (x, z) => {
          const t = (x / panel + 0.5), sag = -Math.sin(t * Math.PI) * 0.03 * (1 - Math.abs(z) / (len / 2 + 0.05)) ** 0.5
          return sag + Math.sin(z * 14 + x * 3) * 0.003 * (1 - t)
        }, [0, 0.022, 0], { thickness: 0.003, tint: canvas, nx: 24, nz: 30, yaw: 0, roll: 0 })
      })
      for (const z of [-1, 1]) {
        const pegX = side * (w / 2 - 0.04), pegZ = z * (len / 2 + 0.1)
        k.cyl('steel', 0.006, 0.12, [pegX, 0.055, pegZ], { seg: 8, roll: side * 0.25, tint: [0.4, 0.38, 0.35] })
        rope(k, [[0, ridgeY - 0.02, z * (len / 2 + 0.07)], [pegX - side * 0.01, 0.1, pegZ]], 0.003)
      }
    }

    k.cyl('fabric', 0.05, ridgeY * 0.8, [w * 0.18, ridgeY * 0.42, len / 2 + 0.03], { seg: 14, roll: -0.42, tint: canvas })
    for (const y of [0.4, 0.75]) k.torus('fabric', 0.052, 0.004, [w * 0.18 + (y - 0.42) * ridgeY * Math.tan(0.42), y * ridgeY, len / 2 + 0.03], { segR: 16, seg: 4, roll: -0.42, tint: [0.75, 0.65, 0.45] })

    const lanternY = ridgeY - 0.33, rodTop = ridgeY - 0.02, rodBottom = lanternY + 0.178
    k.cyl('steel', 0.003, rodTop - rodBottom, [0, (rodTop + rodBottom) / 2, 0.3], { seg: 6 })
    k.frame({ at: [0, lanternY, 0.3] }, () => {
      k.cyl('steel', 0.05, 0.02, [0, 0.0, 0], { seg: 16, tint: [0.65, 0.18, 0.12] })
      k.lathe('glass', [[0, 0], [0.04, 0], [0.05, 0.06], [0.04, 0.12], [0, 0.12]], [0, 0.01, 0], { seg: 16, tint: [0.95, 0.85, 0.6] })
      k.lathe('steel', [[0, 0], [0.05, 0], [0.03, 0.04], [0.01, 0.05], [0, 0.05]], [0, 0.13, 0], { seg: 16, tint: [0.65, 0.18, 0.12] })
    })
    k.blk('steel', [0.16, 0.34, 0.1], w / 2 - 0.36, 0.004, len / 2 - 0.2, { r: 0.012, tint: [0.3, 0.4, 0.25] })
    k.box('steel', [0.1, 0.02, 0.03], [w / 2 - 0.36, 0.004 + 0.35, len / 2 - 0.2], { r: 0.005, tint: [0.3, 0.4, 0.25] })
    k.cyl('steel', 0.07, 0.05, [w * 0.12, 0.029, -len / 2 + 0.3], { seg: 18, tint: [0.7, 0.72, 0.74] })
  },
}
