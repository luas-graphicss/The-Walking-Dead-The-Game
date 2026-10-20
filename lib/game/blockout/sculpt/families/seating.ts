import { roundRect, type Family, type Kit, type Mat, type V2, type V3 } from '../kit'

export function piping(k: Kit, m: Mat, at: V3, w: number, d: number, o: { r?: number; yaw?: number; pitch?: number; roll?: number } = {}) {
  k.frame({ at, yaw: o.yaw, pitch: o.pitch, roll: o.roll }, () => k.tube(m, roundRect(w, d, Math.min(w, d) * 0.18, 0, 4), o.r ?? 0.0055, { closed: true, seg: 7 }))
}

export function bunFoot(k: Kit, m: Mat, x: number, z: number, h: number, r: number) {
  k.lathe(m, [[0, 0], [r * 0.7, 0], [r * 0.95, h * 0.25], [r, h * 0.5], [r * 0.8, h * 0.8], [r * 0.85, h], [0, h]], [x, 0, z], { seg: 18 })
}

function rolledArm(k: Kit, m: Mat, x: number, side: number, bottom: number, top: number, armW: number, depth: number, zc = 0) {
  k.cushion(m, [armW, top - bottom, depth], [x, (bottom + top) / 2 - 0.03, zc], { puff: 0.014, wrinkle: 0.25 })
  const r = armW * 0.55
  k.cyl(m, r, depth - 0.02, [x + side * 0.01, top - r * 0.75, zc + 0.005], { axis: 'z', bevel: r * 0.4, seg: 26 })
  k.cyl(m, r * 0.42, 0.02, [x + side * 0.01, top - r * 0.75, zc + depth / 2 - 0.004], { axis: 'z', bevel: 0.006, seg: 18 })
}

export const SEATING: Family = {
  'dining-chair': (k, s) => {
    const { w, h, d } = k, v = s.variant, legT = 0.038, top = 0.46, th = 0.03, rake = -0.09
    const lx = w / 2 - legT / 2 - 0.004, lz = d / 2 - legT / 2 - 0.004
    for (const x of [-1, 1]) k.turnedLeg('wood', x * lx, 0, lz, top - th, legT * 0.56)
    const post = h - top + th, yc = top - th + post / 2, zc = -lz - 0.012
    const zAt = (y: number) => zc + Math.tan(rake) * (y - yc)
    for (const x of [-1, 1]) {
      k.blk('wood', [legT, top - th, legT], x * lx, 0, -lz, { taper: 0.18 })
      k.box('wood', [legT * 0.92, post, legT * 0.86], [x * lx, yc, zc], { pitch: rake, r: 0.007 })
      k.cyl('wood', 0.0105, d - 2 * legT + 0.01, [x * lx, 0.16, 0], { axis: 'z', seg: 10 })
    }
    k.cyl('wood', 0.0105, w - 2 * legT + 0.01, [0, 0.21, 0.02], { axis: 'x', seg: 10 })
    k.box('wood', [w - 0.002, th, d - 0.004], [0, top - th / 2, 0.003], { r: 0.011 })
    for (const z of [-1, 1]) k.box('wood', [w - 2 * legT, 0.062, 0.018], [0, top - th - 0.031, z * (lz - 0.002)], { r: 0.003 })
    for (const x of [-1, 1]) k.box('wood', [0.018, 0.062, d - 2 * legT], [x * (lx - 0.002), top - th - 0.031, 0], { r: 0.003 })
    const inner = 2 * lx - legT * 0.8
    k.box('wood', [inner + 0.02, 0.075, 0.026], [0, h - 0.045, zAt(h - 0.045)], { pitch: rake, r: 0.01 })
    if (v === 0) for (const y of [top + 0.15, top + 0.29]) k.box('wood', [inner, 0.05, 0.017], [0, y, zAt(y)], { pitch: rake, r: 0.006 })
    if (v === 1) {
      const y0 = top + 0.06, y1 = h - 0.08, yc2 = (y0 + y1) / 2
      k.box('wood', [inner, 0.035, 0.022], [0, y0, zAt(y0)], { pitch: rake })
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * inner / 5.4, hh = y1 - y0
        k.lathe('wood', [[0, 0], [0.008, 0], [0.011, hh * 0.15], [0.009, hh * 0.3], [0.012, hh * 0.55], [0.0085, hh * 0.8], [0.0095, hh], [0, hh]], [x, y0, zAt(yc2)], { pitch: rake, seg: 10 })
      }
    }
    if (v === 2) {
      const splat: V2[] = [[-0.05, 0], [0.05, 0], [0.04, 0.06], [0.075, 0.16], [0.085, 0.26], [0.06, 0.34], [0.11, 0.38], [-0.11, 0.38], [-0.06, 0.34], [-0.085, 0.26], [-0.075, 0.16], [-0.04, 0.06]]
      const y0 = top + 0.02, scaleY = (h - 0.08 - y0) / 0.38
      k.extrude('wood', splat.map(([x, y]) => [x * Math.min(1.4, w / 0.45), y * scaleY] as V2), 0.018, [0, y0, zAt(y0 + 0.19 * scaleY)], { pitch: rake, bevel: 0.003, curveSeg: 4 })
      k.cushion('fabric', [w - 0.07, 0.05, d - 0.07], [0, top + 0.024, 0.012], { puff: 0.012, tufts: [2, 2] })
      piping(k, 'fabric', [0, top + 0.038, 0.012], w - 0.07, d - 0.07)
    }
  },

  'office-chair': (k, s) => {
    const { w, h, d } = k, v = s.variant, R = Math.min(w, d) / 2 - 0.04, hub = 0.1
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + Math.PI / 2, len = R
      k.box('steel', [len, 0.034, 0.042], [Math.cos(a) * len / 2, hub - 0.012, Math.sin(a) * len / 2], { yaw: -a, roll: -0.07, r: 0.012 })
      k.caster([Math.cos(a) * (R - 0.004), 0, Math.sin(a) * (R - 0.004)], 0.027, { yaw: -a + Math.PI / 2 })
    }
    k.lathe('steel', [[0, 0], [0.05, 0], [0.056, 0.03], [0.04, 0.06], [0.03, 0.065], [0, 0.065]], [0, hub - 0.04, 0], { seg: 24 })
    k.cyl('rubber', 0.026, 0.18, [0, hub + 0.11, 0], { seg: 20 })
    for (let i = 0; i < 4; i++) k.torus('rubber', 0.027, 0.004, [0, hub + 0.04 + i * 0.045, 0], { segR: 20, seg: 6 })
    k.cyl('steel', 0.013, 0.14, [0, hub + 0.26, 0], { seg: 16 })
    const seatY = 0.47
    k.box('steel', [0.2, 0.045, 0.24], [0, seatY - 0.075, 0], { r: 0.008 })
    k.tube('steel', [[0.09, seatY - 0.08, 0.06], [0.2, seatY - 0.085, 0.08], [0.24, seatY - 0.09, 0.12]], 0.0055)
    k.sphere('rubber', 0.014, [0.24, seatY - 0.09, 0.125], { rows: 6, seg: 10 })
    k.box('rubber', [w * 0.78, 0.03, d * 0.74], [0, seatY - 0.04, 0.02], { r: 0.012 })
    k.cushion('leather', [w * 0.8, 0.09, d * 0.76], [0, seatY + 0.015, 0.025], { puff: 0.022, wrinkle: 0.45 })
    piping(k, 'leather', [0, seatY + 0.035, 0.025], w * 0.76, d * 0.72, { r: 0.004 })
    const backZ = -d * 0.4
    k.tube('steel', [[0, seatY - 0.07, -0.08], [0, seatY - 0.07, backZ + 0.02], [0, seatY + 0.08, backZ - 0.01], [0, seatY + 0.2, backZ - 0.02]], 0.017, { fillet: 0.05 })
    const backH = h - seatY - 0.12 - (v === 2 ? 0.12 : 0), backY = seatY + 0.1 + backH / 2
    k.box('rubber', [w * 0.74, backH, 0.03], [0, backY, backZ - 0.005], { pitch: -0.12, r: 0.012 })
    k.cushion('leather', [w * 0.72, backH - 0.02, 0.075], [0, backY, backZ + 0.035], { pitch: -0.12, puff: 0.025, wrinkle: 0.4, tufts: v === 0 ? undefined : [1, 2] })
    if (v >= 1) for (const x of [-1, 1]) {
      k.tube('rubber', [[x * 0.09, seatY - 0.06, 0.0], [x * w * 0.4, seatY - 0.055, 0.0], [x * w * 0.42, seatY + 0.17, 0.02]], 0.012, { fillet: 0.04 })
      k.box('rubber', [0.065, 0.03, 0.25], [x * w * 0.42, seatY + 0.19, 0.04], { r: 0.012 })
    }
    if (v === 2) {
      for (const x of [-1, 1]) k.cyl('steel', 0.006, 0.12, [x * 0.07, h - 0.13, backZ - 0.06], { pitch: -0.12, seg: 10 })
      k.cushion('leather', [w * 0.42, 0.13, 0.07], [0, h - 0.065, backZ - 0.05], { pitch: -0.15, puff: 0.02 })
    }
  },

  stool: (k, s) => {
    const { w, h } = k, v = s.variant, R = w / 2, t = 0.036, legs = v === 0 ? 3 : 4
    k.lathe('wood', [[0, h - t], [R - 0.012, h - t], [R, h - t + 0.012], [R, h - 0.012], [R - 0.012, h], [R * 0.7, h - 0.004], [0, h - 0.007]], [0, 0, 0], { seg: 40, crease: 50 })
    const feet: V3[] = [], tops: V3[] = []
    for (let i = 0; i < legs; i++) {
      const a = i / legs * Math.PI * 2 + 0.4
      tops.push([Math.cos(a) * R * 0.52, h - t, Math.sin(a) * R * 0.52]); feet.push([Math.cos(a) * (R - 0.025), 0.012, Math.sin(a) * (R - 0.025)])
      k.tube('wood', [tops[i], feet[i]], 0.018, { taper: 0.3, seg: 12 })
    }
    const at = (i: number, f: number): V3 => [feet[i][0] + (tops[i][0] - feet[i][0]) * f, feet[i][1] + (tops[i][1] - feet[i][1]) * f, feet[i][2] + (tops[i][2] - feet[i][2]) * f]
    if (v === 2) k.torus('steel', R * 0.78, 0.008, [0, h * 0.34, 0], { segR: 36, seg: 8 })
    else for (let i = 0; i < legs; i++) k.tube('wood', [at(i, 0.36), at((i + 1) % legs, 0.36)], 0.009, { seg: 8 })
  },

  bench: (k, s) => {
    const { w, h, d } = k, v = s.variant, iron: Mat = 'steel'
    const frames = v === 2 ? [-1, 0, 1] : [-1, 1]
    for (const f of frames) {
      const x = f * (w / 2 - 0.12)
      k.frame({ at: [x, 0, 0] }, () => {
        const fz = d / 2 - 0.06, bz = -d / 2 + 0.07
        k.tube(iron, [[0, 0.02, fz], [0, 0.2, fz - 0.03], [0, 0.4, fz - 0.02]], 0.02, { fillet: 0.08 })
        k.tube(iron, [[0, 0.02, bz + 0.06], [0, 0.38, bz + 0.03], [0, 0.6, bz], [0, h - 0.03, bz - 0.04]], 0.02, { fillet: 0.12 })
        k.tube(iron, [[0, 0.41, fz + 0.02], [0, 0.39, bz + 0.03]], 0.018)
        if (f !== 0) {
          k.tube(iron, [[0, 0.4, fz - 0.02], [0, 0.6, fz - 0.03], [0, 0.65, fz - 0.12], [0, 0.66, bz + 0.12], [0, 0.64, bz + 0.02]], 0.017, { fillet: 0.06 })
          const curl: V3[] = Array.from({ length: 16 }, (_, i) => { const a = i / 15 * Math.PI * 1.6, r = 0.05 - i * 0.0022; return [0, 0.62 - Math.sin(a) * r, fz - 0.07 + Math.cos(a) * r] as V3 })
          k.tube(iron, curl, 0.008, { fillet: 0 })
        }
        for (const z of [fz, bz + 0.06]) k.cyl(iron, 0.03, 0.02, [0, 0.01, z], { seg: 16 })
      })
    }
    const slats = 5, seatD = d - 0.13
    for (let i = 0; i < slats; i++) {
      const z = d / 2 - 0.045 - i * seatD / (slats - 0.5), y = 0.43 - i * 0.006
      k.plank('wood', w - 0.02, 0.066, 0.03, [0, y, z], { nails: false })
      for (const f of frames) k.rivet([f * (w / 2 - 0.12), y + 0.015, z], { pitch: -Math.PI / 2, r: 0.007 })
    }
    for (let i = 0; i < 3; i++) {
      const y = 0.56 + i * 0.12, z = -d / 2 + 0.07 - (y - 0.38) * 0.17 + 0.03
      k.plank('wood', w - 0.02, 0.085, 0.028, [0, y, z], { pitch: Math.PI / 2 - 0.17 })
    }
  },

  pew: (k, s) => {
    const { w, h, d } = k, v = s.variant, t = 0.045
    const end: V2[] = [[d / 2, 0], [d / 2, 0.56], [d / 2 - 0.03, 0.62], [d / 2 - 0.1, 0.64], [d / 2 - 0.16, 0.6], [d / 2 - 0.22, 0.52], [-d / 2 + 0.22, 0.55], [-d / 2 + 0.12, h - 0.1], [-d / 2 + 0.08, h - 0.03], [-d / 2 + 0.03, h], [-d / 2, h - 0.04], [-d / 2, 0]]
    for (const x of [-1, 1]) {
      k.extrude('wood', end.map(([z, y]) => [-z, y] as V2), t, [x * (w / 2 - t / 2), 0, 0], { axis: 'x', bevel: 0.008, curveSeg: 4 })
      k.blk('wood', [t + 0.02, 0.06, d], x * (w / 2 - t / 2), 0, 0, { r: 0.008 })
    }
    const inner = w - 2 * t + 0.004
    k.box('wood', [inner, 0.038, d * 0.52], [0, 0.44, d * 0.13], { r: 0.012 })
    k.box('wood', [inner, 0.05, 0.03], [0, 0.4, d * 0.13 + d * 0.26 - 0.015], { r: 0.008 })
    const backH = h - 0.48, backZ = -d * 0.16
    k.box('wood', [inner, backH, 0.028], [0, 0.46 + backH / 2, backZ], { pitch: -0.16, r: 0.006 })
    const capZ = backZ - Math.tan(0.16) * backH / 2
    k.cyl('wood', 0.025, inner + 0.004, [0, h - 0.025, capZ], { axis: 'x', seg: 18 })
    for (let i = 1; i < 4; i++) k.box('wood', [0.02, backH * 0.82, 0.008], [-inner / 2 + i * inner / 4, 0.46 + backH / 2, backZ + 0.017], { pitch: -0.16, r: 0.002 })
    const rackY = 0.72, rackZ = backZ - 0.13
    k.box('wood', [inner, 0.018, 0.1], [0, rackY, rackZ + 0.03], { r: 0.004 })
    k.box('wood', [inner, 0.09, 0.016], [0, rackY + 0.045, rackZ - 0.02], { r: 0.004 })
    if (v >= 1) {
      const kz = -d / 2 + 0.07
      for (const x of [-1, 1]) k.box('wood', [0.03, 0.12, 0.03], [x * (inner / 2 - 0.04), 0.07, kz], { r: 0.004 })
      k.cushion('leather', [inner - 0.04, 0.06, 0.12], [0, 0.14, kz], { puff: 0.012 })
    }
    if (v === 2) for (let i = 0; i < 3; i++) k.box('paper', [0.13, 0.19, 0.03], [-inner * 0.3 + i * 0.16 + k.jitter(0.02), rackY + 0.105, rackZ + 0.03], { roll: k.jitter(0.1), r: 0.004, tone: 0.7 + k.rnd() * 0.3 })
  },

  sofa: (k, s) => {
    const { w, h, d } = k, v = s.variant, foot = 0.1, armW = 0.16, backD = 0.19
    for (const x of [-1, 1]) for (const z of [-1, 1]) bunFoot(k, 'wood', x * (w / 2 - 0.09), z * (d / 2 - 0.09), foot, 0.032)
    k.box('wood', [w - 0.04, 0.03, d - 0.06], [0, foot + 0.015, 0], { r: 0.006 })
    const baseH = 0.2, seatTop = foot + 0.03 + baseH
    k.cushion('fabric', [w - 0.03, baseH, d - 0.03], [0, foot + 0.03 + baseH / 2, 0], { puff: 0.01, sides: 0.7, wrinkle: 0.2 })
    for (const x of [-1, 1]) rolledArm(k, 'fabric', x * (w / 2 - armW / 2 - 0.012), x, seatTop - 0.06, 0.66, armW, d - 0.04, 0.0)
    k.cushion('fabric', [w - 2 * armW - 0.02, h - seatTop + 0.05, backD], [0, (seatTop - 0.05 + h) / 2, -d / 2 + backD / 2 + 0.01], { puff: 0.022 })
    const n = v === 2 ? 3 : 2, span = w - 2 * armW - 0.03, cw = span / n - 0.008, cd = d - backD - 0.05
    for (let i = 0; i < n; i++) {
      const x = -span / 2 + (i + 0.5) * span / n, slump = i === n - 1 && v !== 1 ? 0.015 : 0
      k.cushion('fabric', [cw, 0.15, cd], [x + k.jitter(0.006), seatTop + 0.074 - slump, d / 2 - 0.025 - cd / 2], { puff: 0.03, yaw: k.jitter(0.03), roll: slump * 2 })
      piping(k, 'fabric', [x, seatTop + 0.14 - slump, d / 2 - 0.025 - cd / 2], cw - 0.01, cd - 0.01)
      k.cushion('fabric', [cw, 0.44, 0.16], [x + k.jitter(0.008), seatTop + 0.15 + 0.23, -d / 2 + backD + 0.085], { pitch: -0.2 + k.jitter(0.04), puff: 0.04, wrinkle: 0.5 })
    }
    k.cushion('fabric', [0.4, 0.4, 0.12], [-span / 2 + 0.24, seatTop + 0.33, -d / 2 + backD + 0.22], { pitch: -0.34, roll: 0.16, yaw: 0.12, puff: 0.045, tone: 0.75 })
    if (v === 2) k.cushion('fabric', [0.36, 0.36, 0.11], [span / 2 - 0.22, seatTop + 0.3, -d / 2 + backD + 0.24], { pitch: -0.4, roll: -0.2, yaw: -0.2, puff: 0.04, tone: 1.1 })
  },

  armchair: (k, s) => {
    const { w, h, d } = k, v = s.variant, armW = 0.14, legH = 0.14
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.turnedLeg('wood', x * (w / 2 - 0.07), 0, z * (d / 2 - 0.07), legH, 0.026)
    const seatTop = legH + 0.2
    k.cushion('fabric', [w - 0.02, 0.2, d - 0.02], [0, legH + 0.1, 0], { puff: 0.008, sides: 0.6 })
    for (const x of [-1, 1]) rolledArm(k, 'fabric', x * (w / 2 - armW / 2 - 0.01), x, seatTop - 0.05, 0.64, armW, d - 0.12, 0.05)
    const backD = 0.18, inner = w - 2 * armW - 0.01
    k.cushion('fabric', [inner + 0.1, h - seatTop + 0.04, backD], [0, (seatTop - 0.04 + h) / 2, -d / 2 + backD / 2], { puff: 0.03, tufts: v === 1 ? undefined : [3, 3] })
    if (v !== 0) {
      const wing: V2[] = [[0, 0], [0.24, 0], [0.3, 0.08], [0.31, 0.22], [0.26, 0.34], [0.12, 0.38], [0, 0.36]]
      for (const x of [-1, 1]) k.extrude('fabric', wing.map(([z, y]) => [-z, y] as V2), 0.09, [x * (w / 2 - 0.06), 0.6, -d / 2 + 0.05], { axis: 'x', bevel: 0.03, bevelSeg: 3, curveSeg: 6 })
    }
    k.cushion('fabric', [inner, 0.14, d - backD - 0.06], [0, seatTop + 0.07, d / 2 - 0.03 - (d - backD - 0.06) / 2], { puff: 0.032 })
    piping(k, 'fabric', [0, seatTop + 0.135, d / 2 - 0.03 - (d - backD - 0.06) / 2], inner - 0.01, d - backD - 0.07)
    if (v === 2) k.box('fabric', [w - 0.03, 0.12, 0.012], [0, legH + 0.06, d / 2 - 0.006], { r: 0.004, tone: 0.82 })
  },

  booth: (k, s) => {
    const { w, h, d } = k, v = s.variant, side = 0.035
    k.blk('steel', [w - 0.08, 0.09, d - 0.16], 0, 0, 0.03, { r: 0.004 })
    k.blk('wood', [w - 2 * side, 0.3, d - 0.08], 0, 0.09, 0.02, { r: 0.006 })
    k.box('steel', [w - 2 * side, 0.025, 0.012], [0, 0.375, d / 2 - 0.026], { r: 0.004 })
    for (const x of [-1, 1]) {
      k.blk('wood', [side, h - 0.02, d], x * (w / 2 - side / 2), 0, 0, { r: 0.006 })
      k.box('steel', [side + 0.006, 0.02, d + 0.004], [x * (w / 2 - side / 2), h - 0.01, 0], { r: 0.006 })
    }
    const inner = w - 2 * side - 0.004
    k.cushion('leather', [inner, 0.1, d * 0.6], [0, 0.44, d / 2 - 0.02 - d * 0.3], { puff: 0.022, wrinkle: 0.5 })
    piping(k, 'leather', [0, 0.485, d / 2 - 0.02 - d * 0.3], inner - 0.01, d * 0.6 - 0.01, { r: 0.0045 })
    k.blk('wood', [inner, h - 0.1, 0.05], 0, 0.09, -d / 2 + 0.025, { r: 0.004 })
    const n = Math.max(5, Math.round(inner / 0.15)), cw = inner / n, backH = h - 0.56, backZ = -d / 2 + 0.105
    for (let i = 0; i < n; i++) k.cushion('leather', [cw - 0.004, backH, 0.1], [-inner / 2 + (i + 0.5) * cw, 0.5 + backH / 2, backZ], { pitch: -0.08, puff: 0.03, sides: 0.9, wrinkle: 0.45 })
    k.box('steel', [inner, 0.03, 0.1], [0, h - 0.035, backZ - 0.02], { r: 0.012 })
    if (v !== 1) {
      const i = Math.floor(k.rnd() * n)
      k.box('rubber', [cw * 0.7, 0.07, 0.004], [-inner / 2 + (i + 0.5) * cw, 0.5 + backH * 0.6, backZ + 0.08], { pitch: -0.08, roll: 0.5, r: 0.001, tone: 0.65 })
    }
  },
}
