import { fbm3, type Family, type Kit, type Mat, type V2, type V3 } from '../kit'
import { PLINTH } from './architecture'

type Cell = { x0: number; x1: number; z0: number; z1: number }

function bays(k: Kit, m: Mat, y0: number, y1: number, size: number, o: { skip?: (i: number, j: number) => boolean; tint?: V3 } = {}): Cell[][] {
  const { w, d } = k, nx = Math.max(1, Math.round(w / size)), nz = Math.max(1, Math.round(d / size)), gap = 0.008
  const cells: Cell[][] = []
  for (let i = 0; i < nx; i++) {
    cells.push([])
    for (let j = 0; j < nz; j++) {
      const x0 = -w / 2 + i * w / nx + (i ? gap / 2 : 0), x1 = -w / 2 + (i + 1) * w / nx - (i < nx - 1 ? gap / 2 : 0)
      const z0 = -d / 2 + j * d / nz + (j ? gap / 2 : 0), z1 = -d / 2 + (j + 1) * d / nz - (j < nz - 1 ? gap / 2 : 0)
      cells[i].push({ x0, x1, z0, z1 })
      if (o.skip?.(i, j)) continue
      k.box(m, [x1 - x0, y1 - y0, z1 - z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], { r: 0.008, tint: o.tint, tone: 0.9 + k.rnd() * 0.12 })
    }
  }

  for (let i = 1; i < nx; i++) k.box('rubber', [gap, 0.016, d], [-w / 2 + i * w / nx, y1 - 0.012, 0], { r: 0.001, tone: 0.42 })
  for (let j = 1; j < nz; j++) for (let i = 0; i < nx; i++) {
    const c = cells[i][j]
    k.box('rubber', [c.x1 - c.x0, 0.016, gap], [(c.x0 + c.x1) / 2, y1 - 0.012, c.z0 - gap / 2], { r: 0.001, tone: 0.42 })
  }
  return cells
}

function ring(k: Kit, m: Mat, rIn: number, rOut: number, t: number, at: V3, seg = 12) {
  k.lathe(m, [[rIn, -t / 2], [rOut, -t / 2], [rOut, t / 2], [rIn, t / 2], [rIn, -t / 2]], at, { seg, crease: 60 })
}

function anchor(k: Kit, x: number, top: number, z: number) {
  k.cyl('steel', 0.008, 0.09, [x, top + 0.025, z], { seg: 8, tint: [0.55, 0.42, 0.32] })
  ring(k, 'steel', 0.0085, 0.022, 0.004, [x, top + 0.002, z])
  ring(k, 'steel', 0.0085, 0.014, 0.012, [x, top + 0.01, z], 6)
}

function patches(k: Kit, count: number, y: number, spread: V2, size: V2, tint: V3, keep: V2[] = [], t0 = 0.002) {
  for (let i = 0, tries = 0; i < count && tries < count * 6; tries++) {
    const x = k.jitter(spread[0]), z = k.jitter(spread[1]), rx = size[0] * (0.5 + k.rnd() * 0.5), rz = size[1] * (0.5 + k.rnd() * 0.5)
    if (keep.some(([kx, kz]) => Math.abs(kx - x) < rx + 0.16 && Math.abs(kz - z) < rz + 0.16)) continue

    const sink = i * 0.0008, t = t0 + i * 0.002, pts: V2[] = Array.from({ length: 9 }, (_, j) => { const a = j / 9 * Math.PI * 2; return [Math.cos(a) * rx * (0.7 + k.rnd() * 0.3), Math.sin(a) * rz * (0.7 + k.rnd() * 0.3)] as V2 })
    k.extrude('concrete', pts, t, [x, y - sink + t / 2, z], { axis: 'y', bevel: Math.min(0.001, t * 0.3), bevelSeg: 1, tint })
    i++
  }
}

function chunks(k: Kit, m: Mat, cx: number, y: number, cz: number, spread: number, count: number, scale = 1) {
  for (let i = 0; i < count; i++) {
    const s = (0.04 + k.rnd() * 0.09) * scale, hh = s * (0.45 + k.rnd() * 0.3)
    k.box(m, [s, hh, s * (0.6 + k.rnd() * 0.5)], [cx + k.jitter(spread), y + hh / 2, cz + k.jitter(spread)], { yaw: k.rnd() * 3, r: Math.min(0.012, hh * 0.3), tone: 0.75 + k.rnd() * 0.2 })
  }
}

function starters(k: Kit, x: number, top: number, z: number, spread: number) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const hgt = 0.06 + k.rnd() * 0.22, bx = x + sx * spread, bz = z + sz * spread
    k.tube('steel', [[bx, top - 0.03, bz], [bx, top + hgt * 0.6, bz], [bx + k.jitter(0.03), top + hgt, bz + k.jitter(0.03)]], 0.007, { seg: 6, fillet: 0.03, tint: [0.5, 0.33, 0.24] })
  }
}

function drain(k: Kit, x: number, top: number, z: number) {
  k.cyl('steel', 0.1, 0.01, [x, top + 0.001, z], { seg: 24, tint: [0.35, 0.34, 0.33] })
  for (let i = -2; i <= 2; i++) k.box('steel', [0.15 - Math.abs(i) * 0.025, 0.004, 0.012], [x, top + 0.008, z + i * 0.03], { r: 0.0015, tint: [0.42, 0.4, 0.38] })
}

export const STRUCTURE: Family = {
  foundation: (k, s) => {
    const { w, h, d } = k, v = s.variant
    bays(k, 'concrete', 0, h, 2)

    for (const sz of [-1, 1]) for (let x = -w / 2 + 0.45; x < w / 2 - 0.3; x += 1.2) anchor(k, x, h, sz * (d / 2 - 0.15))
    for (const sx of [-1, 1]) for (let z = -d / 2 + 1.05; z < d / 2 - 0.9; z += 1.2) anchor(k, sx * (w / 2 - 0.15), h, z)
    const keep: V2[] = []
    if (v >= 1) {

      for (const [x, z, r] of [[-w * 0.18, d * 0.12, 0.025], [-w * 0.1, d * 0.16, 0.05]]) {
        k.cyl('paint', r, 0.3, [x, h + 0.11, z], { seg: 16, tint: [0.92, 0.92, 0.9] })
        k.cyl('paint', r + 0.004, 0.035, [x, h + 0.26 - 0.0175 + 0.008, z], { seg: 16, tint: [0.85, 0.85, 0.82] })
        keep.push([x, z])
      }
      drain(k, w * 0.15, h, -d * 0.12)
      keep.push([w * 0.15, -d * 0.12])
    }
    if (v === 2) {
      starters(k, w * 0.22, h, d * 0.24, 0.08)
      chunks(k, 'concrete', w * 0.22, h, d * 0.24, 0.35, 7)
      keep.push([w * 0.22, d * 0.24])
    }

    for (const sz of [-1, 1]) keep.push([0, sz * (d / 2 - 0.15)])
    patches(k, 3 + v * 3, h, [w * 0.36, d * 0.36], [0.4, 0.35], v === 2 ? [0.62, 0.63, 0.57] : [0.78, 0.77, 0.74], keep)
  },

  floor: (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.05, ph = h - top

    const n = Math.max(2, Math.round(w / 1.2)), pw = w / n, pd = d - 0.012
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * pw
      k.box('concrete', [pw - 0.008, ph, pd], [x, ph / 2, 0], { r: 0.014, tint: [0.86, 0.85, 0.82] })
      const cores = Math.max(2, Math.round(pw / 0.24))
      for (let c = 0; c < cores; c++) for (const sd of [-1, 1]) k.cyl('plaster', 0.042, 0.006, [x - pw / 2 + (c + 0.5) * pw / cores, ph / 2, sd * (pd / 2 + 0.002)], { axis: 'z', seg: 14, tint: [0.8, 0.78, 0.72] })
    }
    const broken = (i: number, j: number) => v === 2 && i === 0 && j === 0
    const cells = bays(k, 'concrete', ph, h, 2, { skip: broken })
    const keep: V2[] = []
    if (v === 2) {

      const c = cells[0][0], pts: V2[] = [[c.x0, -c.z0], [c.x1, -c.z0]]
      let reach = 0
      for (let t = 0; t <= 1.0001; t += 0.1) {
        const z = c.z0 + (c.z1 - c.z0) * (0.35 + 0.25 * Math.sin(t * 7) * k.rnd() + k.rnd() * 0.1)
        reach = Math.max(reach, z); pts.push([c.x1 - (c.x1 - c.x0) * t, -z])
      }
      k.extrude('concrete', pts, top, [0, ph + top / 2, 0], { axis: 'y', bevel: 0.006, bevelSeg: 1 })

      const z0 = reach + 0.1, z1 = c.z1 - 0.1
      for (let i = 0; i < 8; i++) {
        const sz = 0.04 + k.rnd() * 0.08, hh = sz * (0.45 + k.rnd() * 0.3)
        k.box('concrete', [sz, hh, sz * 0.8], [c.x0 + 0.1 + k.rnd() * (c.x1 - c.x0 - 0.2), ph + hh / 2, z0 + k.rnd() * Math.max(0.01, z1 - z0)], { yaw: k.rnd() * 3, r: Math.min(0.012, hh * 0.3), tone: 0.75 + k.rnd() * 0.2 })
      }
      keep.push([(c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2])
    }
    if (v === 0) {

      k.box('steel', [0.12, 0.006, 0.12], [-w * 0.2, h + 0.003, d * 0.2], { r: 0.002, tint: [0.5, 0.5, 0.48] })
      k.tube('paint', [[w * 0.1, h - 0.02, -d * 0.15], [w * 0.1, h + 0.22, -d * 0.15]], 0.016, { seg: 12, tint: [0.3, 0.33, 0.36] })
      keep.push([-w * 0.2, d * 0.2], [w * 0.1, -d * 0.15])
    }
    if (v === 1) { drain(k, w * 0.2, h, d * 0.18); keep.push([w * 0.2, d * 0.18]) }
    patches(k, 2 + v * 2, h, [w * 0.36, d * 0.36], [0.5, 0.4], [0.7, 0.69, 0.66], keep)
  },

  roof: (k, s) => {
    const { w, h, d } = k, v = s.variant, deck = h - 0.035
    k.box('concrete', [w, deck, d], [0, deck / 2, 0], { r: 0.006, tint: [0.8, 0.79, 0.76] })

    const outlet: V2 = [w * 0.25, -d * 0.25]
    const blisters: [number, number, number][] = Array.from({ length: 4 + v * 3 }, () => [k.jitter(w * 0.42), k.jitter(d * 0.42), 0.003 + k.rnd() * 0.004])
    const sag = (x: number, z: number) => 0.007 * Math.exp(-((x - outlet[0]) ** 2 + (z - outlet[1]) ** 2) / 0.5)
    const fy = (x: number, z: number) => {
      const lap = (((x + w / 2) % 1) + 1) % 1
      let y = 0.004 + 0.0025 * Math.exp(-(((lap - 0.05) / 0.018) ** 2)) - sag(x, z)
      for (const [bx, bz, a] of blisters) y += a * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / 0.012)
      return y
    }
    k.sheet('rubber', w - 0.002, d - 0.002, fy, [0, deck, 0], { nx: Math.ceil(w / 0.02), nz: Math.ceil(d / 0.1), thickness: 0.004, tone: 0.55 })
    const surface = (x: number, z: number) => deck + fy(x, z)

    const oy = surface(outlet[0], outlet[1])
    ring(k, 'steel', 0.05, 0.15, 0.008, [outlet[0], oy + 0.006, outlet[1]], 24)
    k.lathe('steel', [[0.05, 0], [0.075, 0.02], [0.07, 0.06], [0.045, 0.085], [0, 0.092]], [outlet[0], oy + 0.01, outlet[1]], { seg: 16, crease: 50, tint: [0.35, 0.35, 0.34] })

    const vx = -w * 0.22, vz = d * 0.2, vy = surface(vx, vz)
    k.cyl('steel', 0.04, 0.2, [vx, vy + 0.1, vz], { seg: 16, tint: [0.62, 0.62, 0.6] })
    k.lathe('rubber', [[0.041, 0.09], [0.06, 0.06], [0.13, 0.008], [0.13, 0], [0.041, 0]], [vx, vy, vz], { seg: 20, crease: 50, tone: 0.5 })
    k.lathe('steel', [[0.035, 0], [0.042, 0], [0.09, 0.03], [0.09, 0.04], [0, 0.07]], [vx, vy + 0.215, vz], { seg: 16, crease: 50, tint: [0.55, 0.55, 0.53] })
    for (const a of [0, 2.09, 4.19]) k.box('steel', [0.004, 0.03, 0.012], [vx + Math.cos(a) * 0.046, vy + 0.205, vz + Math.sin(a) * 0.046], { yaw: -a, r: 0.001 })
    if (v >= 1) {

      for (let z = -d / 2 + 0.4; z < d / 2 - 0.3; z += 0.62) k.box('concrete', [0.5, 0.04, 0.5], [-w * 0.05, surface(-w * 0.05, z) + 0.02, z], { r: 0.008, tone: 0.85 + k.rnd() * 0.15 })
      for (let i = 0; i < 90; i++) {
        const a = k.rnd() * Math.PI * 2, r = 0.2 + k.rnd() * 0.7, x = outlet[0] + Math.cos(a) * r, z = outlet[1] + Math.sin(a) * r, sz = 0.012 + k.rnd() * 0.014
        if (Math.abs(x) > w / 2 - 0.05 || Math.abs(z) > d / 2 - 0.05) continue
        k.sphere('concrete', sz, [x, surface(x, z) + sz * 0.55, z], { seg: 6, rows: 4, scale: [1, 0.7, 1.2], yaw: k.rnd() * 3, tone: 0.7 + k.rnd() * 0.3 })
      }
    }
    if (v === 2) {

      k.cyl('glass', 0.55, 0.002, [outlet[0], deck + 0.001, outlet[1]], { seg: 28, scale: [1, 1, 0.75] })
      const fx = -w * 0.3, fz = -d * 0.3
      k.sheet('rubber', 0.7, 0.45, (x, z) => 0.18 * Math.max(0, (z + 0.1) / 0.32) ** 2 + 0.01 * Math.sin(x * 9), [fx, surface(fx, fz) + 0.001, fz], { nx: 14, nz: 10, thickness: 0.004, yaw: 0.4, tone: 0.5 })
    }
  },

  'wood-roof': (k, s) => {
    const { w, h, d } = k, v = s.variant, rafterH = 0.12, deckT = 0.022, felt = rafterH + deckT + 0.002
    const hole = (x: number, z: number) => v === 2 && ((x - w * 0.15) / 0.75) ** 2 + ((z - d * 0.1) / 0.55) ** 2 < 1
    const n = Math.max(3, Math.round(w / 0.6))
    for (let i = 0; i < n; i++) k.box('wood', [0.05, rafterH, d], [-w / 2 + (i + 0.5) * w / n, rafterH / 2, 0], { r: 0.004, tint: [0.62, 0.48, 0.34] })

    const rows = Math.floor(d / 0.15), bw = d / rows
    for (let j = 0; j < rows; j++) {
      const z = -d / 2 + (j + 0.5) * bw, runs: [number, number][] = []
      let a: number | null = -w / 2
      for (let x = -w / 2; x <= w / 2 + 1e-6; x += 0.05) {
        const open = x < w / 2 - 1e-6 && !hole(x + 0.025, z)
        if (open && a === null) a = x + k.rnd() * 0.04
        if (!open && a !== null) { runs.push([a, Math.min(w / 2, x - (x < w / 2 - 1e-6 ? k.rnd() * 0.06 : 0))]); a = null }
      }
      for (const [x0, x1] of runs) {
        if (x1 - x0 < 0.12) continue
        k.box('wood', [x1 - x0, deckT, bw - 0.003], [(x0 + x1) / 2, rafterH + deckT / 2, z], { r: 0.003, tone: 0.8 + k.rnd() * 0.3, tint: [0.7, 0.56, 0.4] })
        k.box('rubber', [x1 - x0, 0.002, bw - 0.003], [(x0 + x1) / 2, felt - 0.001, z], { r: 0.0005, tone: 0.35 })
      }
    }

    const t = 0.01, e = 0.18, L = 2 * e, pitch = Math.atan(2 * t / L)
    for (let j = 0, z0 = -d / 2; z0 < d / 2 - 0.05; j++, z0 += e) {
      const len = Math.min(L, d / 2 - z0), cy = felt + 2 * t - t * len / L + t / 2
      let x = -w / 2, first = true
      while (x < w / 2 - 0.02) {
        const sw = Math.min(w / 2 - x, first && j % 2 ? 0.09 : 0.12 + k.rnd() * 0.17)
        const cx = x + sw / 2, cz = z0 + len / 2
        x += sw + 0.005; first = false
        if (sw < 0.05 || hole(cx, cz) || hole(cx, z0) || (v >= 1 && k.chance(0.025))) continue
        const moss = v >= 1 && k.chance(0.18)
        k.box('wood', [sw - 0.004, t, len], [cx, cy, cz], { pitch, r: 0.0015, skip: [3], tone: 0.75 + k.rnd() * 0.35, tint: moss ? [0.55, 0.6, 0.38] : v >= 1 ? [0.68, 0.62, 0.55] : [0.86, 0.64, 0.46] })
      }
    }
    if (v === 2) for (let i = 0; i < 6; i++) {

      const x = w * 0.15 + k.jitter(0.9), z = d * 0.1 - 0.8 - k.rnd() * 0.5
      k.box('wood', [0.12 + k.rnd() * 0.12, t, 0.3], [x, felt + 2 * t + 0.006 + i * 0.0001, z], { yaw: k.rnd() * 3, pitch: 0.03, r: 0.0015, tint: [0.6, 0.5, 0.42] })
    }
  },

  pillar: (k, s) => {
    const { w, h, d } = k, v = s.variant, base = 0.1, capH = 0.16, shaftH = h - base - capH
    k.box('concrete', [w + 0.1, base, d + 0.1], [0, base / 2, 0], { r: 0.01, tint: PLINTH })
    const spall = v === 2 ? 0.45 : 0
    if (spall) {

      const hx = w / 2, hz = d / 2, notch: V2[] = [[-hx, -hz], [hx, -hz], [hx, hz * 0.1], [hx * 0.55, hz * 0.2], [hx * 0.2, hz * 0.6], [hx * 0.05, hz], [-hx, hz]]
      k.extrude('concrete', notch.map(([x, z]) => [x, -z] as V2), spall, [0, base + spall / 2, 0], { axis: 'y', bevel: 0.006, bevelSeg: 2 })
      for (const [x, z] of [[hx - 0.04, hz - 0.04], [hx - 0.04, -hz + 0.04], [-hx + 0.04, hz - 0.04]]) k.cyl('steel', 0.008, spall + 0.05, [x, base + spall / 2, z], { seg: 8, tint: [0.5, 0.33, 0.24] })
      k.tube('steel', [[hx - 0.04, base + 0.22, -hz + 0.04], [hx - 0.04, base + 0.22, hz - 0.04], [-hx + 0.04, base + 0.22, hz - 0.04]], 0.004, { seg: 6, fillet: 0.015, tint: [0.5, 0.33, 0.24] })
      chunks(k, 'concrete', w / 2 + 0.022, base, d / 2 + 0.022, 0.012, 4, 0.3)
    }
    k.box('concrete', [w, shaftH - spall, d], [0, base + spall + (shaftH - spall) / 2, 0], { r: 0.012 })
    k.box('concrete', [w + 0.08, capH, d + 0.08], [0, h - capH / 2, 0], { r: 0.008, taper: 1 - (w + 0.004) / (w + 0.08) })

    for (const sd of [-1, 1]) for (const y of [0.8, 1.7, 2.4]) if (y > base + spall + 0.1) k.cyl('charcoal', 0.011, 0.004, [sd * (w / 2 + 0.0015), y, 0], { axis: 'x', seg: 10 })
    if (v === 0) {

      for (let i = 0; i < 4; i++) {
        const y = 0.35 + i * 0.08, tint: V3 = i % 2 ? [0.12, 0.12, 0.12] : [0.95, 0.75, 0.1]
        for (const sx of [-1, 1]) k.box('paint', [0.0016, 0.08, d], [sx * (w / 2 + 0.0008), y, 0], { r: 0.0004, tint })
        for (const sz of [-1, 1]) k.box('paint', [w + 0.0032, 0.08, 0.0016], [0, y, sz * (d / 2 + 0.0008)], { r: 0.0004, tint })
      }
    }
    if (v === 1) {

      const z = d / 2 + 0.012
      k.tube('steel', [[0.03, base + 0.01, z], [0.03, 1.15, z]], 0.01, { seg: 10, tint: [0.62, 0.62, 0.6] })
      k.box('steel', [0.085, 0.12, 0.05], [0.03, 1.21, d / 2 + 0.025], { r: 0.004, tint: [0.55, 0.56, 0.55] })
      k.box('paint', [0.07, 0.1, 0.004], [0.03, 1.21, d / 2 + 0.052], { r: 0.002, tint: [0.92, 0.9, 0.85] })
      for (const y of [0.4, 0.85]) {
        k.box('steel', [0.05, 0.016, 0.003], [0.03, y, d / 2 + 0.0235], { r: 0.001 })
        for (const sx of [-1, 1]) k.rivet([0.03 + sx * 0.02, y, d / 2 + 0.025], { r: 0.0035 })
      }
    }
  },

  'wood-post': (k, s) => {
    const { w, h, d } = k, v = s.variant, pier = 0.22, plate = 0.008, pw = w - 0.02, pd = d - 0.02
    k.box('concrete', [w + 0.06, pier, d + 0.06], [0, pier / 2, 0], { r: 0.012, taper: -0.15, tint: PLINTH })
    k.box('steel', [w + 0.02, plate, d + 0.02], [0, pier + plate / 2, 0], { r: 0.002, tint: [0.36, 0.37, 0.38] })
    const y0 = pier + plate, capY = h - plate, ph = capY - y0
    if (v === 2) {

      const r = Math.min(pw, pd) / 2
      const prof: V2[] = [[0, 0]]
      for (let i = 0; i <= 12; i++) prof.push([r * (0.97 + 0.03 * Math.sin(i * 1.7)) * (1 - 0.05 * i / 12), ph * i / 12])
      prof.push([0, ph])
      k.lathe('wood', prof, [0, y0, 0], { seg: 18, crease: 40, tint: [0.66, 0.55, 0.42], wear: (x, y, z) => (fbm3(x * 14, y * 3, z * 14, 5) - 0.5) * 0.006 })
    } else {
      const hewn = v === 1
      k.box('wood', [pw, ph, pd], [0, y0 + ph / 2, 0], { r: 0.01, tint: hewn ? [0.6, 0.47, 0.34] : [0.78, 0.6, 0.42], disp: hewn ? (_f, s0, t0) => Math.sin(t0 * 9 + s0 * 3) * 0.0015 + Math.sin(t0 * 23) * 0.0008 : undefined, seg: hewn ? [3, 40, 3] : undefined })
      for (let i = 0; i < (hewn ? 0 : 3); i++) {
        const face = k.pick([0, 1, 2, 3]), len = 0.4 + k.rnd() * 0.8, cy = y0 + 0.2 + len / 2 + k.rnd() * (ph - len - 0.4)
        const along = k.jitter(0.035), dark: V3 = [0.25, 0.18, 0.12]
        if (face < 2) k.box('wood', [0.0012, len, 0.004], [(face ? 1 : -1) * (pw / 2 + 0.0004), cy, along], { r: 0, tint: dark })
        else k.box('wood', [0.004, len, 0.0012], [along, cy, (face === 3 ? 1 : -1) * (pd / 2 + 0.0004)], { r: 0, tint: dark })
      }
    }

    for (const sx of [-1, 1]) {
      const x = sx * (pw / 2 + 0.003)
      k.box('steel', [0.006, 0.18, pd * 0.8], [x, y0 + 0.09, 0], { r: 0.0015, tint: [0.36, 0.37, 0.38] })
      for (const z of [-pd * 0.22, pd * 0.22]) k.bolt([x + sx * 0.003, y0 + 0.11, z], { yaw: sx * Math.PI / 2 })
    }

    k.box('steel', [w + 0.02, plate, d + 0.02], [0, capY + plate / 2, 0], { r: 0.002, tint: [0.36, 0.37, 0.38] })
    for (const sz of [-1, 1]) {
      const z = sz * (pd / 2 + 0.0015)
      k.box('steel', [0.04, 0.22, 0.003], [0, capY - 0.11, z], { r: 0.001, tint: [0.5, 0.5, 0.48] })
      for (const y of [0.05, 0.11, 0.17]) k.rivet([0, capY - y, z + sz * 0.0015], { yaw: sz > 0 ? 0 : Math.PI, r: 0.0035 })
    }
    if (v === 1) {

      k.box('paper', [0.003, 0.28, 0.13], [pw / 2 + 0.0015, 1.55, 0], { r: 0.0005, tint: [0.92, 0.88, 0.76] })
      for (const y of [1.66, 1.44]) k.rivet([pw / 2 + 0.003, y, 0], { yaw: Math.PI / 2, r: 0.003 })

      k.torus('fabric', (Math.max(pw, pd) / 2 + 0.008) * Math.SQRT2, 0.009, [0, 1.05, 0], { seg: 8, segR: 4, yaw: Math.PI / 4, tint: [0.72, 0.62, 0.45] })
    }
  },
}
