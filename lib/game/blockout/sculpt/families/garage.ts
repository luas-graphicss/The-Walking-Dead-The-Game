import { type Family, type Kit, type V2, type V3 } from '../kit'
import { drawer } from './common'
import { RUST, chain, channelOutline, column, gauge, ibeamOutline, legFrame, lugLift, motor, rail } from './shop'

const TOOL_RED: V3 = [0.72, 0.14, 0.1]
const MACHINE: V3 = [0.32, 0.45, 0.42]

function vice(k: Kit, at: V3, s = 1) {
  k.frame({ at, scale: s }, () => {
    k.cyl('steel', 0.09, 0.03, [0, 0.015, 0], { seg: 24, tint: MACHINE })
    k.box('steel', [0.13, 0.07, 0.24], [0, 0.065, 0], { r: 0.01, tint: MACHINE })
    k.box('steel', [0.17, 0.11, 0.05], [0, 0.155, -0.08], { r: 0.008, tint: MACHINE })
    k.box('steel', [0.17, 0.11, 0.05], [0, 0.155, 0.02], { r: 0.008, tint: MACHINE })
    for (const z of [-0.0535, -0.0065]) k.box('steel', [0.16, 0.05, 0.006], [0, 0.18, z], { r: 0.001, tint: [0.4, 0.4, 0.42] })
    k.cyl('steel', 0.014, 0.22, [0, 0.12, 0.13], { axis: 'z', seg: 12 })
    k.cyl('steel', 0.022, 0.03, [0, 0.12, 0.245], { axis: 'z', seg: 14 })
    k.cyl('steel', 0.007, 0.22, [0, 0.12, 0.26], { axis: 'x', seg: 10 })
    for (const x of [-1, 1]) k.sphere('steel', 0.012, [x * 0.11, 0.12, 0.26], { seg: 10, rows: 6 })
  })
}

function pegboard(k: Kit, w: number, h: number, at: V3, tint: V3 = [0.72, 0.6, 0.45]) {
  k.frame({ at }, () => {
    k.box('wood', [w, h, 0.008], [0, 0, 0], { r: 0.002, tint })
    for (let i = 0; i < Math.floor(w / 0.05); i++) for (let j = 0; j < Math.floor(h / 0.05); j++) if ((i + j) % 3 === 0) k.cyl('charcoal', 0.0035, 0.002, [-w / 2 + 0.025 + i * 0.05, -h / 2 + 0.025 + j * 0.05, 0.004], { axis: 'z', seg: 6, tone: 0.3 })

    const tools = Math.floor(w / 0.14), py = h * 0.3, top = py - 0.003
    for (let i = 0; i < tools; i++) {
      const x = -w / 2 + 0.07 + i * (w - 0.14) / Math.max(1, tools - 1), kind = i % 4
      k.cyl('steel', 0.003, 0.04, [x, py, 0.02], { axis: 'z', seg: 6 })
      if (kind === 0) { k.box('rubber', [0.03, 0.09, 0.022], [x, top - 0.045, 0.015], { r: 0.008, tint: TOOL_RED }); k.box('steel', [0.008, 0.12, 0.008], [x, top - 0.15, 0.015], { r: 0.002 }) }
      else if (kind === 1) { k.cyl('rubber', 0.012, 0.09, [x, top - 0.045, 0.016], { seg: 10, tint: [0.85, 0.7, 0.1] }); k.cyl('steel', 0.004, 0.16, [x, top - 0.17, 0.016], { seg: 8 }) }
      else if (kind === 2) { k.box('steel', [0.1, 0.035, 0.03], [x, top - 0.0175, 0.019], { r: 0.006, tint: [0.3, 0.3, 0.32] }); k.box('wood', [0.025, 0.25, 0.022], [x, top - 0.16, 0.015], { r: 0.008, tint: [0.6, 0.42, 0.25] }) }
      else for (const s of [-1, 1]) k.box('steel', [0.02, 0.18, 0.008], [x + s * 0.012, top - 0.09, 0.008 + (s + 1) * 0.00375], { roll: -s * 0.08, r: 0.002 })
    }
  })
}

function lensRing(k: Kit, at: V3, R: number, r: number, o: { pitch?: number; tint?: V3 } = {}) {
  k.frame({ at, pitch: o.pitch }, () => {
    k.torus('steel', R, r, [0, 0, 0], { segR: 24, seg: 8, tint: o.tint })
    const lr = R - r + 0.001
    k.lathe('glass', [[lr, 0.003], [0, 0.003]], [0, 0, 0], { seg: 24, tint: [0.9, 0.95, 1] })
    k.lathe('glass', [[0, -0.003], [lr, -0.003]], [0, 0, 0], { seg: 24, tint: [0.9, 0.95, 1] })
  })
}

function instrument(k: Kit, w: number, h: number, d: number, at: V3, kind: 'scope' | 'meter' | 'supply', tint: V3 = [0.75, 0.74, 0.7]) {
  k.frame({ at }, () => {
    k.blk('steel', [w, h, d], 0, 0, 0, { r: 0.01, tint })
    for (const x of [-1, 1]) k.blk('rubber', [0.02, 0.012, d - 0.04], x * (w / 2 - 0.03), -0.006, 0, { r: 0.004 })
    if (kind === 'scope') k.screen([-w * 0.18, h * 0.55, d / 2], w * 0.5, h * 0.62, { bezel: 0.014 })
    else k.screen([-w * 0.2, h * 0.62, d / 2], w * 0.42, h * 0.3, { bezel: 0.01 })
    for (let i = 0; i < 6; i++) k.knob([w * 0.12 + (i % 3) * w * 0.12, h * 0.3 + Math.floor(i / 3) * h * 0.32, d / 2], 0.011, { m: 'rubber' })
    for (let i = 0; i < 3; i++) k.cyl(i % 2 ? 'paint' : 'rubber', 0.007, 0.012, [-w * 0.35 + i * 0.035, h * 0.14, d / 2 + 0.006], { axis: 'z', seg: 10, tint: i === 1 ? [0.8, 0.12, 0.1] : undefined })
    k.vent([0, h * 0.5, -d / 2 - 0.002], w * 0.6, h * 0.5, { yaw: Math.PI })
  })
}

export const GARAGE: Family = {
  'vice-bench': (k, s) => {
    const { w, d } = k, v = s.variant, top = 0.84, leg = 0.07, shelfTop = 0.16 + leg * 0.3 + 0.018
    legFrame(k, 'steel', w, d, top - 0.06, { leg, shelf: 0.16, tint: [0.32, 0.36, 0.4] })
    k.blk('wood', [w, 0.06, d], 0, top - 0.06, 0, { r: 0.006, tint: [0.62, 0.48, 0.34] })
    k.blk('steel', [w, 0.065, 0.012], 0, top - 0.065, d / 2 + 0.006, { r: 0.003, tint: [0.32, 0.36, 0.4] })
    vice(k, [0, top, 0.05], 1.15)
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.bolt([x * 0.07 * 1.15, top + 0.0345, 0.05 + z * 0.1], { pitch: -Math.PI / 2, r: 0.007 })

    k.box('steel', [0.3, 0.025, 0.049], [0, top + 0.2 * 1.15, 0.05 - 0.03 * 1.15], { r: 0.003, tint: RUST })
    k.frame({ at: [-w * 0.3, top, 0.1], yaw: 0.4 }, () => { k.box('wood', [0.28, 0.026, 0.026], [0, 0.013, 0], { r: 0.008, tint: [0.62, 0.45, 0.28] }); k.box('steel', [0.035, 0.035, 0.1], [0.15, 0.0175, 0], { r: 0.006 }) })
    for (let i = 0; i < 3; i++) k.box('steel', [0.22, 0.006, 0.018], [w * 0.28, top + 0.003 + i * 0.006, -0.1 + i * 0.03], { yaw: 0.1 * i, r: 0.001, tint: [0.45, 0.45, 0.47] })
    k.cushion('fabric', [0.2, 0.025, 0.16], [w * 0.36, top + 0.0125, 0.15], { puff: 0.008, wrinkle: 1.6, r: 0.02, tint: [0.55, 0.3, 0.25] })
    if (v !== 0) {

      const x0 = 0.06, x1 = w / 2 - 0.094, y0 = shelfTop, y1 = top - 0.06 - 0.09 - 0.002, z0 = -(d / 2 - 0.09), z1 = d / 2 - 0.075
      k.blk('steel', [x1 - x0, y1 - y0, z1 - z0], (x0 + x1) / 2, y0, (z0 + z1) / 2, { r: 0.004, tint: [0.32, 0.36, 0.4] })
      for (let i = 0; i < 2; i++) drawer(k, 'steel', x1 - x0 - 0.03, (y1 - y0 - 0.03) / 2, [(x0 + x1) / 2, y0 + 0.01 + (i + 0.5) * (y1 - y0 - 0.02) / 2, z1], { handle: 'bar', label: true })
    }
    if (v === 2) {
      for (const x of [-1, 1]) k.blk('steel', [0.04, 0.36, 0.04], x * (w / 2 - 0.05), top, -d / 2 + 0.03, { r: 0.004, tint: [0.32, 0.36, 0.4] })
      pegboard(k, w - 0.14, 0.34, [0, top + 0.19, -d / 2 + 0.03])
    }
  },
  'cobbler-bench': (k, s) => {
    const { w, d } = k, v = s.variant, top = 0.84
    legFrame(k, 'wood', w, d, top - 0.05, { leg: 0.07, shelf: 0.18, tint: [0.5, 0.38, 0.28] })
    k.blk('wood', [w, 0.05, d], 0, top - 0.05, 0, { r: 0.006, tint: [0.55, 0.42, 0.3] })
    const x0 = -(w / 2 - 0.094), x1 = -0.08, y0 = 0.18 + 0.07 * 0.3 + 0.018, y1 = top - 0.05 - 0.09 - 0.002, z0 = -(d / 2 - 0.09), z1 = d / 2 - 0.075
    k.blk('wood', [x1 - x0, y1 - y0, z1 - z0], (x0 + x1) / 2, y0, (z0 + z1) / 2, { r: 0.004, tint: [0.5, 0.38, 0.28] })
    for (let i = 0; i < 2; i++) {
      const y = y0 + 0.01 + (i + 0.5) * (y1 - y0 - 0.02) / 2
      k.box('rubber', [x1 - x0 - 0.06, (y1 - y0 - 0.03) / 2 - 0.03, 0.002], [(x0 + x1) / 2, y, z1 + 0.001], { r: 0, tone: 0.2 })
      drawer(k, 'wood', x1 - x0 - 0.03, (y1 - y0 - 0.03) / 2, [(x0 + x1) / 2, y, z1], { handle: 'knob', tint: [0.5, 0.38, 0.28] })
    }

    const lx = -w * 0.12
    k.lathe('steel', [[0, 0], [0.09, 0], [0.09, 0.02], [0.03, 0.04], [0.025, 0.25], [0, 0.25]], [lx, top, 0], { seg: 20, tint: [0.2, 0.2, 0.2] })
    k.frame({ at: [lx, top + 0.25, 0] }, () => {
      k.box('steel', [0.05, 0.05, 0.05], [0, 0.02, 0], { r: 0.01, tint: [0.2, 0.2, 0.2] })
      k.extrude('steel', [[-0.13, 0], [0.11, 0], [0.12, 0.025], [0.06, 0.05], [-0.12, 0.04]], 0.07, [0, 0.045, 0], { bevel: 0.01, tint: [0.2, 0.2, 0.2] })
      k.extrude('leather', [[-0.135, 0], [0.115, 0], [0.12, 0.05], [0.04, 0.08], [-0.05, 0.08], [-0.1, 0.22], [-0.15, 0.22], [-0.14, 0.04]], 0.09, [0, 0.07, 0], { bevel: 0.015, bevelSeg: 3, tint: [0.35, 0.22, 0.14] })
    })

    k.blk('wood', [w * 0.35, 0.05, d * 0.5], w * 0.27, top, -d * 0.1, { r: 0.006, tint: [0.5, 0.38, 0.28] })
    for (let i = 0; i < 5; i++) k.frame({ at: [w * 0.15 + i * w * 0.05, top + 0.05, -d * 0.1], yaw: Math.PI / 2 }, () => { k.cyl('wood', 0.011, 0.11, [0, 0.011, 0], { axis: 'x', seg: 10, tint: [0.6, 0.45, 0.3] }); k.cyl('steel', 0.002, 0.06, [0.085, 0.011, 0], { axis: 'x', seg: 6 }) })
    k.cyl('fabric', 0.022, 0.04, [w * 0.4, top + 0.07, d * 0.08], { seg: 14, tint: [0.9, 0.85, 0.7] })
    k.sheet('leather', 0.4, 0.3, (x, z) => Math.sin(x * 9) * 0.01 + Math.cos(z * 11) * 0.006 + 0.008, [-w * 0.36, top, d * 0.12], { thickness: 0.004, tint: [0.5, 0.32, 0.2] })
    for (const x of [-1, 1]) k.frame({ at: [w * 0.05 + x * 0.06, 0.18 + 0.07 * 0.3 + 0.018, 0] }, () => {
      k.extrude('rubber', [[-0.13, 0], [0.12, 0], [0.13, 0.015], [-0.13, 0.015]], 0.09, [0, 0, 0], { yaw: Math.PI / 2, bevel: 0.004 })
      k.extrude('leather', [[-0.12, 0.015], [0.11, 0.015], [0.12, 0.04], [0.04, 0.07], [-0.04, 0.08], [-0.09, 0.14], [-0.13, 0.13]], 0.085, [0, 0, 0], { yaw: Math.PI / 2, bevel: 0.012, bevelSeg: 2, tint: v === 1 ? [0.15, 0.12, 0.1] : [0.45, 0.28, 0.18] })
    })
  },
  'cement-mixer': (k, s) => {
    const { w, h, d } = k, v = s.variant, orange: V3 = [0.85, 0.42, 0.1]

    const axleY = 0.22
    for (const x of [-1, 1]) {

      k.wheel([x * (w / 2 - 0.08), 0.2 + lugLift(0.2, 0.09), d * 0.15], 0.2, 0.09, { tread: 'lug', ratio: 0.55, rim: 'paint', yaw: x < 0 ? Math.PI : 0 })
      k.tube('steel', [[x * (w / 2 - 0.12), axleY + 0.04, d * 0.15], [x * 0.18, h * 0.55, 0.0], [x * (w / 2 - 0.2), 0.018, -d * 0.35]], 0.022, { fillet: 0.05, seg: 10, tint: orange })
      k.blk('steel', [0.1, 0.012, 0.12], x * (w / 2 - 0.2), 0, -d * 0.35, { r: 0.003, tint: [0.3, 0.3, 0.3] })
    }
    k.cyl('steel', 0.025, w - 0.228, [0, axleY + 0.02, d * 0.15], { axis: 'x', seg: 12, tint: [0.3, 0.3, 0.3] })
    k.tube('steel', [[0, axleY + 0.03, d * 0.15], [0, 0.32, -d * 0.45], [0, 0.3, -d / 2 + 0.02]], 0.025, { seg: 10, tint: orange })
    k.torus('steel', 0.04, 0.01, [0, 0.3, -d / 2 + 0.05], { segR: 16, seg: 6, tint: [0.3, 0.3, 0.3] })

    const py = h * 0.55, R = Math.min(0.45, w * 0.3), ax = R + 0.04
    k.box('steel', [2 * (ax + 0.025), 0.08, 0.08], [0, py, 0], { r: 0.01, tint: orange })
    for (const x of [-1, 1]) {
      k.box('steel', [0.05, 0.32, 0.07], [x * ax, py + 0.14, 0.02], { r: 0.008, tint: orange })
      k.cyl('steel', 0.025, 0.05, [x * (R + 0.0175), py + 0.3, 0.02], { axis: 'x', seg: 14, tint: [0.3, 0.3, 0.3] })
    }
    k.frame({ at: [0, py + 0.3, 0.02], pitch: 0.55 }, () => {
      k.lathe('steel', [[0, -0.3], [R * 0.55, -0.3], [R * 0.95, -0.12], [R, 0.0], [R * 0.95, 0.12], [R * 0.48, 0.38], [R * 0.42, 0.42], [R * 0.38, 0.41], [R * 0.44, 0.36], [R * 0.9, 0.11], [R * 0.95, 0.0], [R * 0.9, -0.11], [R * 0.5, -0.27], [0, -0.27]], [0, 0, 0], { seg: 40, crease: 50, tint: orange })

      const gr = R * 0.967
      k.torus('steel', gr + 0.012, 0.014, [0, -0.08, 0], { segR: 48, seg: 6, tint: [0.3, 0.3, 0.3] })
      for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; k.box('steel', [0.012, 0.024, 0.012], [Math.cos(a) * (gr + 0.028), -0.08, Math.sin(a) * (gr + 0.028)], { yaw: -a, r: 0.002, tint: [0.3, 0.3, 0.3] }) }

      k.lathe('concrete', [[R * 0.555, 0], [R * 0.3, 0.012], [0, 0.018]], [0, 0.3, 0], { seg: 24, tint: [0.7, 0.68, 0.62] })
      k.cyl('steel', 0.05, 0.06, [0, -0.32, 0], { seg: 16, tint: [0.3, 0.3, 0.3] })
    })

    const hw = ax + 0.09, hy = py + 0.12
    k.cyl('steel', 0.012, hw - ax - 0.012, [(ax + 0.022 + hw - 0.015) / 2, hy, 0.02], { axis: 'x', seg: 10 })
    k.cyl('steel', 0.02, 0.03, [hw, hy, 0.02], { axis: 'x', seg: 14, tint: [0.3, 0.3, 0.3] })
    k.torus('steel', 0.14, 0.012, [hw, hy, 0.02], { axis: 'x', segR: 28, seg: 6, tint: [0.3, 0.3, 0.3] })
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; k.box('steel', [0.01, 0.13, 0.012], [hw, hy + Math.cos(a) * 0.065, 0.02 + Math.sin(a) * 0.065], { pitch: a, r: 0.002, tint: [0.3, 0.3, 0.3] }) }

    k.blk('paint', [0.32, 0.26, 0.28], -0.3, py - 0.26 - 0.04, -0.05, { r: 0.02, tint: [0.25, 0.25, 0.26] })
    k.box('steel', [0.5, 0.04, 0.06], [-0.2, py - 0.32, -0.05], { r: 0.006, tint: orange })
    k.cyl('steel', 0.025, 0.02, [-0.32, py - 0.04 + 0.01, -0.1], { seg: 14, tint: [0.15, 0.15, 0.15] })
    k.cyl('rubber', 0.012, 0.06, [-0.46 - 0.0, py - 0.17, -0.05], { axis: 'x', seg: 10 })
    k.sheet('concrete', 0.6, 0.45, (x, z) => Math.max(0, 0.03 - (x * x * 0.3 + z * z * 0.5)) + 0.002, [0.05, 0, d * 0.32], { thickness: 0.003, tint: [0.72, 0.7, 0.65] })
    if (v === 2) k.blk('fabric', [0.4, 0.15, 0.3], -w * 0.25, 0, d * 0.32, { r: 0.04, tint: [0.75, 0.7, 0.6] })
  },
  'paper-cutter': (k, s) => {
    const { w, d } = k, v = s.variant, top = 0.82
    legFrame(k, 'steel', w, d, top - 0.05, { leg: 0.06, shelf: 0.2, tint: [0.3, 0.32, 0.34] })
    k.blk('steel', [w, 0.05, d], 0, top - 0.05, 0, { r: 0.008, tint: [0.3, 0.32, 0.34] })

    const bw = w * 0.55, bd = d * 0.7
    k.blk('steel', [bw, 0.06, bd], 0, top, 0, { r: 0.008, tint: [0.25, 0.3, 0.28] })
    k.blk('steel', [bw - 0.12, 0.004, bd - 0.1], 0, top + 0.06, 0.03, { r: 0.001, tint: [0.75, 0.75, 0.72] })
    const fz = -bd * 0.25, base = top + 0.06
    for (const x of [-1, 1]) k.extrude('steel', [[-0.12, 0], [0.12, 0], [0.08, 0.36], [0.05, 0.4], [-0.05, 0.4], [-0.08, 0.36]], 0.05, [x * (bw / 2 - 0.025), base, fz], { axis: 'x', bevel: 0.006, tint: [0.25, 0.3, 0.28] })
    k.box('steel', [bw - 0.096, 0.06, 0.05], [0, base + 0.3, fz], { r: 0.008, tint: [0.25, 0.3, 0.28] })
    k.box('steel', [bw - 0.1, 0.08, 0.012], [0, base + 0.12, fz + 0.03], { r: 0.002, tint: [0.8, 0.82, 0.84] })

    const piv: V3 = [bw / 2 + 0.03, base + 0.25, fz], lev = 0.45, la = 0.5, dir: V3 = [0, Math.sin(la), Math.cos(la)]
    k.cyl('steel', 0.04, 0.06, piv, { axis: 'x', seg: 18, tint: [0.25, 0.3, 0.28] })
    k.cyl('steel', 0.025, lev, [piv[0], piv[1] + dir[1] * lev / 2, piv[2] + dir[2] * lev / 2], { axis: 'z', pitch: -la, seg: 12, tint: [0.25, 0.3, 0.28] })
    k.cyl('rubber', 0.03, 0.14, [piv[0] + 0.07, piv[1] + dir[1] * lev, piv[2] + dir[2] * lev], { axis: 'x', seg: 14 })

    const cy = base + 0.33, wy = cy + 0.082
    k.cyl('steel', 0.012, wy - 0.008 - cy + 0.002, [0, (cy - 0.002 + wy - 0.008) / 2, fz], { seg: 10 })
    k.torus('steel', 0.08, 0.008, [0, wy, fz], { segR: 24, seg: 6, tint: [0.2, 0.2, 0.2] })
    k.cyl('steel', 0.02, 0.016, [0, wy, fz], { seg: 14, tint: [0.2, 0.2, 0.2] })
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box('steel', [0.06, 0.01, 0.01], [Math.cos(a) * 0.045, wy, fz + Math.sin(a) * 0.045], { yaw: -a, r: 0.002, tint: [0.2, 0.2, 0.2] }) }

    for (let i = 0; i < 6; i++) k.blk('paper', [0.3, 0.012, 0.22], k.jitter(0.003), top + 0.064 + i * 0.012, 0.02, { r: 0.001, tint: i % 3 ? [0.96, 0.95, 0.92] : [0.95, 0.9, 0.75] })
    for (const x of [-1, 1]) for (let i = 0; i < 2 + v; i++) k.blk('paper', [0.22, 0.05, 0.3], x * (w / 2 - 0.125), top + i * 0.05, d * 0.15, { r: 0.004, yaw: k.jitter(0.04), tint: [0.85, 0.82, 0.75] })
  },
  'electronics-bench': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.82
    legFrame(k, 'steel', w, d, top - 0.04, { leg: 0.05, shelf: 0.15, tint: [0.65, 0.66, 0.66] })
    k.blk('rubber', [w, 0.04, d], 0, top - 0.04, 0, { r: 0.006, tint: [0.28, 0.42, 0.52] })

    const rz = -d / 2 + 0.13, rh = h - top
    for (const x of [-1, 1]) k.blk('steel', [0.03, rh, 0.24], x * (w / 2 - 0.02), top, rz, { r: 0.004, tint: [0.65, 0.66, 0.66] })
    k.blk('steel', [w - 0.06, 0.02, 0.24], 0, top + rh * 0.5, rz, { r: 0.003, tint: [0.65, 0.66, 0.66] })
    instrument(k, 0.36, 0.22, 0.22, [-w * 0.25, top + rh * 0.5 + 0.02, rz], 'scope')
    instrument(k, 0.24, 0.12, 0.2, [w * 0.12, top + rh * 0.5 + 0.02, rz], 'supply', [0.25, 0.25, 0.27])
    instrument(k, 0.24, 0.1, 0.2, [w * 0.12, top + rh * 0.5 + 0.12 + 0.02, rz], 'meter', [0.85, 0.75, 0.2])

    k.blk('steel', [0.14, 0.08, 0.12], w * 0.32, top, 0.05, { r: 0.008, tint: [0.2, 0.2, 0.22] })
    k.screen([w * 0.32, top + 0.05, 0.111], 0.07, 0.03, { bezel: 0.004 })
    k.tube('steel', [[w * 0.32 + 0.1, top, 0.05], [w * 0.32 + 0.1, top + 0.08, 0.05], [w * 0.32 + 0.13, top + 0.12, 0.07]], 0.005, { seg: 6 })
    k.cable('rubber', [w * 0.32, top + 0.04, -0.01], [w * 0.2, top + 0.006, 0.12], 0.02, 0.003)
    k.frame({ at: [w * 0.2, top, 0.14], yaw: 0.4 }, () => { k.cyl('rubber', 0.007, 0.15, [0, 0.007, 0], { axis: 'x', seg: 10, tint: [0.85, 0.75, 0.2] }); k.cyl('steel', 0.002, 0.04, [0.095, 0.007, 0], { axis: 'x', seg: 6 }) })
    k.frame({ at: [-w * 0.05, top, 0.12], yaw: -0.2 }, () => { k.blk('rubber', [0.09, 0.03, 0.17], 0, 0, 0, { r: 0.01, tint: [0.85, 0.65, 0.1] }); k.screen([0, 0.03, -0.035], 0.06, 0.04, { pitch: -Math.PI / 2, bezel: 0.004 }); k.knob([0, 0.03, 0.03], 0.012, { m: 'rubber', pitch: -Math.PI / 2 }) })
    k.blk('paint', [0.16, 0.003, 0.1], -w * 0.25, top, 0.12, { r: 0.0005, tint: [0.2, 0.5, 0.25] })
    for (let i = 0; i < 6; i++) k.blk(i % 2 ? 'rubber' : 'steel', [0.012, 0.008, 0.02], -w * 0.25 - 0.06 + i * 0.024, top + 0.003, 0.12, { r: 0.002, tint: i % 2 ? [0.15, 0.15, 0.15] : undefined })
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) k.blk('paint', [0.1, 0.05, 0.08], -w / 2 + 0.08 + i * 0.105, top + j * 0.05, -0.02, { r: 0.004, tint: [[0.85, 0.2, 0.15], [0.2, 0.4, 0.8], [0.9, 0.75, 0.2], [0.3, 0.6, 0.3]][i] as V3 })
    k.frame({ at: [w / 2 - 0.1, top, -0.02] }, () => {
      k.cyl('steel', 0.06, 0.02, [0, 0.01, 0], { seg: 18, tint: [0.2, 0.2, 0.22] })
      k.tube('steel', [[0, 0.02, 0], [0, 0.3, 0], [-0.164, 0.42, 0.1]], 0.008, { fillet: 0.06, seg: 8, tint: [0.2, 0.2, 0.22] })
      lensRing(k, [-0.24, 0.42, 0.1], 0.07, 0.012, { tint: [0.2, 0.2, 0.22] })
    })

    for (let i = 0; i < 3 + v; i++) k.cable('rubber', [-w * 0.25 + i * 0.03, top + rh * 0.5 + 0.03, rz + 0.11], [-w * 0.3 + i * 0.08, top + 0.004, rz + 0.2], 0.06, 0.0035)

    const px0 = -(w / 2 - 0.075), px1 = px0 + w * 0.32, py0 = 0.15 + 0.05 * 0.3 + 0.018, py1 = top - 0.04 - 0.09 - 0.002, pz0 = -d / 2 + 0.03, pz1 = d / 2 - 0.06
    k.blk('steel', [px1 - px0, py1 - py0, pz1 - pz0], (px0 + px1) / 2, py0, (pz0 + pz1) / 2, { r: 0.004, tint: [0.65, 0.66, 0.66] })
    const dh = (py1 - py0 - 0.04) / 3
    for (let i = 0; i < 3; i++) drawer(k, 'steel', px1 - px0 - 0.03, dh - 0.01, [(px0 + px1) / 2, py0 + 0.02 + (i + 0.5) * dh, pz1], { handle: 'cup', label: true })
  },
  'watch-bench': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.95

    for (const x of [-1, 1]) {
      const pw = w * 0.32, px = x * (w / 2 - pw / 2)
      k.blk('wood', [pw, top - 0.04, d], px, 0, 0, { r: 0.006, tint: [0.45, 0.3, 0.2] })
      for (let i = 0; i < 6; i++) drawer(k, 'wood', pw - 0.04, (top - 0.1) / 6 - 0.01, [px, 0.06 + (i + 0.5) * (top - 0.1) / 6, d / 2], { handle: 'knob', hm: 'steel', t: 0.012 })
    }
    k.blk('wood', [w, 0.04, d], 0, top - 0.04, 0, { r: 0.006, tint: [0.5, 0.34, 0.22] })
    k.blk('leather', [w * 0.32, 0.006, d * 0.7], 0, top, 0, { r: 0.002, tint: [0.2, 0.35, 0.25] })
    for (const x of [-1, 1]) k.cushion('leather', [0.16, 0.05, 0.3], [x * w * 0.28, top + 0.025, d * 0.1], { puff: 0.012, tint: [0.2, 0.35, 0.25] })

    const gz = -d / 2 + 0.09
    k.blk('wood', [w, h - top, 0.18], 0, top, gz, { r: 0.006, tint: [0.45, 0.3, 0.2] })
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) drawer(k, 'wood', w / 8 - 0.015, 0.07, [-w / 2 + (i + 0.5) * w / 8, top + 0.06 + j * 0.085, gz + 0.09], { handle: 'knob', t: 0.01, flat: true })

    const cr = Math.min(0.09, (h - top - 0.2) / 2)
    k.frame({ at: [0, top + 0.19 + cr, gz + 0.09] }, () => {
      k.cyl('wood', cr, 0.03, [0, 0, 0.015], { axis: 'z', seg: 28, tint: [0.35, 0.22, 0.15] })
      k.cyl('paper', cr * 0.83, 0.003, [0, 0, 0.031], { axis: 'z', seg: 28, tint: [0.95, 0.93, 0.85] })
      k.box('steel', [0.004, cr * 0.66, 0.002], [0, cr * 0.28, 0.034], { r: 0, tint: [0.1, 0.1, 0.1] })
      k.box('steel', [cr * 0.44, 0.003, 0.002], [cr * 0.2, 0, 0.035], { r: 0, tint: [0.1, 0.1, 0.1] })
    })
    k.frame({ at: [w * 0.25, top, -d * 0.1] }, () => {
      k.cyl('steel', 0.05, 0.02, [0, 0.01, 0], { seg: 18, tint: [0.85, 0.85, 0.82] })
      k.tube('steel', [[0, 0.02, 0], [0, 0.22, 0], [-0.11, 0.3, 0.14]], 0.007, { fillet: 0.05, seg: 8, tint: [0.85, 0.85, 0.82] })
      lensRing(k, [-0.17, 0.3, 0.14], 0.055, 0.01, { pitch: 0.4, tint: [0.85, 0.85, 0.82] })
    })

    for (let i = 0; i < 3; i++) k.cyl('steel', 0.016, 0.006, [-0.06 + i * 0.05, top + 0.009, 0.05], { seg: 16, tint: [0.85, 0.75, 0.45] })
    k.lathe('rubber', [[0.008, 0], [0.014, 0], [0.012, 0.025], [0.009, 0.025]], [0.1, top + 0.006, 0.08], { seg: 12 })
    k.box('steel', [0.1, 0.003, 0.005], [-0.12, top + 0.0075, 0.1], { yaw: 0.3, r: 0.0008 })
    k.blk('tile', [0.12, 0.012, 0.08], 0.02, top + 0.006, -0.05, { r: 0.004, tint: [0.95, 0.95, 0.95] })
    if (v === 2) k.blk('glass', [0.16, 0.07, 0.08], -w * 0.25, top, -d / 2 + 0.18 + 0.045, { r: 0.004, tint: [0.9, 0.95, 1] })
  },
  'engine-stand': (k, s) => {
    const { w, h, d } = k, v = s.variant, red: V3 = [0.65, 0.12, 0.1]

    const cx = -w * 0.32
    k.box('steel', [0.08, 0.08, d * 0.9], [cx, 0.11, 0], { r: 0.008, tint: red })
    k.box('steel', [w * 0.62, 0.08, 0.08], [cx + w * 0.31, 0.11, 0], { r: 0.008, tint: red })
    for (const z of [-1, 1]) k.caster([cx, 0, z * d * 0.42], 0.035)
    k.caster([cx + w * 0.6, 0, 0], 0.035)
    k.box('steel', [0.08, 0.6, 0.08], [cx, 0.15 + 0.3, 0], { r: 0.008, tint: red })
    k.box('steel', [0.3, 0.06, 0.06], [cx + 0.15, 0.78, 0], { r: 0.008, tint: red })
    k.cyl('steel', 0.08, 0.04, [cx + 0.32, 0.78, 0], { axis: 'x', seg: 20, tint: [0.3, 0.3, 0.3] })
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; k.box('steel', [0.03, 0.03, 0.18], [cx + 0.35, 0.78 + Math.cos(a) * 0.09, Math.sin(a) * 0.09], { pitch: a, r: 0.004, tint: [0.3, 0.3, 0.3] }) }

    const ex = cx + 0.37 + w * 0.22, ey = 0.78, len = w * 0.44
    k.box('steel', [len, 0.32, 0.3], [ex, ey, 0], { r: 0.02, tint: [0.25, 0.32, 0.4] })
    k.box('steel', [len - 0.04, 0.12, 0.26], [ex, ey + 0.22, 0], { r: 0.015, tint: [0.3, 0.35, 0.42] })
    k.box('paint', [len - 0.08, 0.08, 0.2], [ex, ey + 0.32, 0], { r: 0.03, tint: red })
    for (let i = 0; i < 6; i++) k.cyl('rubber', 0.012, 0.04, [ex - len / 2 + 0.06 + i * (len - 0.12) / 5, ey + 0.29, 0.115], { axis: 'z', pitch: 0.6, seg: 8 })
    k.box('steel', [len - 0.02, 0.12, 0.26], [ex, ey - 0.22, 0], { r: 0.02, tint: [0.22, 0.22, 0.24] })
    for (let i = 0; i < 6; i++) k.tube('steel', [[ex - len / 2 + 0.06 + i * (len - 0.12) / 5, ey + 0.15, -0.15], [ex - len / 2 + 0.06 + i * (len - 0.12) / 5, ey + 0.08, -0.24], [ex, ey - 0.02, -0.25]], 0.018, { seg: 8, fillet: 0.04, tint: RUST })
    k.cyl('steel', 0.08, 0.03, [ex + len / 2 + 0.015, ey - 0.05, 0], { axis: 'x', seg: 24, tint: [0.3, 0.3, 0.3] })
    k.cyl('steel', 0.05, 0.03, [ex + len / 2 + 0.015, ey + 0.16, 0.0], { axis: 'x', seg: 20, tint: [0.3, 0.3, 0.3] })
    k.cyl('steel', 0.06, 0.1, [ex + len / 2 - 0.04, ey + 0.05, 0.2], { axis: 'x', seg: 20, tint: [0.7, 0.7, 0.72] })
    k.box('rubber', [0.012, 0.32, 0.03], [ex + len / 2 + 0.032, ey + 0.05, 0.05], { roll: 0.0, pitch: 0.3, r: 0.004 })
    k.cyl('steel', 0.13, 0.03, [ex - len / 2 - 0.015, ey - 0.02, 0], { axis: 'x', seg: 28, tint: [0.3, 0.3, 0.3] })

    const tx0 = ex - len / 2 - 0.1, tx1 = Math.min(ex + len / 2 + 0.1, cx + w * 0.6 - 0.08)
    k.blk('steel', [tx1 - tx0, 0.03, 0.5], (tx0 + tx1) / 2, 0, 0, { r: 0.006, tint: [0.3, 0.3, 0.3] })
    k.blk('glass', [(tx1 - tx0) * 0.6, 0.004, 0.3], (tx0 + tx1) / 2, 0.03, 0.03, { r: 0, tint: [0.15, 0.13, 0.1] })
    if (v > 0) k.blk('steel', [0.3, 0.004, 0.2], cx + 0.2, 0.15, 0, { r: 0.002, tint: RUST })
  },
  'bike-lift': (k, s) => {
    const { w, h, d } = k, v = s.variant, deck = 0.62

    const lift: V3 = [0.2, 0.32, 0.55]
    k.blk('steel', [w * 0.9, 0.06, d * 0.95], 0, 0, 0, { r: 0.008, tint: lift })

    for (const x of [-1, 1]) for (const sgn of [-1, 1]) k.box('steel', [0.05, 0.04, Math.hypot(d * 0.6, deck - 0.12)], [x * w * 0.3 + sgn * 0.026, (deck + 0.06) / 2, 0], { pitch: sgn * Math.atan2(deck - 0.12, d * 0.6), r: 0.006, tint: lift })
    for (const x of [-1, 1]) k.cyl('steel', 0.02, 0.12, [x * w * 0.3, (deck + 0.06) / 2, 0], { axis: 'x', seg: 12 })

    const r0: V3 = [0, 0.06, -d * 0.3], r1: V3 = [0, deck - 0.06, d * 0.1], rl = Math.hypot(r1[1] - r0[1], r1[2] - r0[2])
    k.cyl('steel', 0.03, rl - 0.004, [0, (r0[1] + r1[1]) / 2, (r0[2] + r1[2]) / 2], { axis: 'z', pitch: -Math.atan2(r1[1] - r0[1], r1[2] - r0[2]), seg: 14, tint: [0.75, 0.75, 0.75] })
    k.blk('steel', [w * 0.9, 0.06, d * 0.95], 0, deck - 0.06, 0, { r: 0.008, tint: lift })

    k.box('steel', [w * 0.5, deck - 0.005, 0.02], [0, (deck - 0.005) / 2, d * 0.475 + 0.01], { r: 0.004, tint: [0.4, 0.4, 0.42] })

    const R = 0.3, wz = d / 2 - R + 0.06, my = deck + R, black: V3 = [0.12, 0.12, 0.12]
    k.wheel([0, my, wz], R, 0.11, { axis: 'x', tread: 'car', ratio: 0.62, spokes: 32 })
    k.wheel([0, my, -wz + 0.03], R, 0.14, { axis: 'x', tread: 'car', ratio: 0.62, spokes: 32 })

    for (const x of [-1, 1]) k.blk('steel', [0.012, 0.2, 0.3], x * 0.068, deck, wz + 0.05, { r: 0.003, tint: [0.2, 0.2, 0.2] })
    k.box('steel', [0.148, 0.04, 0.04], [0, deck + 0.02, wz + Math.sqrt(R * R - (R - 0.02) ** 2) + 0.021], { r: 0.006, tint: [0.2, 0.2, 0.2] })
    for (const x of [-1, 1]) k.tube('steel', [[x * 0.07, my, -wz + 0.03], [x * 0.09, my + 0.12, -0.125]], 0.016, { seg: 10, tint: [0.15, 0.15, 0.15] })
    for (const x of [-1, 1]) k.tube('steel', [[x * 0.065, my, wz], [x * 0.065, my + 0.5, wz - 0.22]], 0.02, { seg: 10, tint: [0.75, 0.75, 0.78] })
    for (const x of [-1, 1]) k.tube('steel', [[x * 0.13, my + 0.5, wz - 0.22], [x * 0.13, my + 0.34, -0.05], [x * 0.13, my + 0.28, -0.25], [x * 0.13, my + 0.05, -0.05], [x * 0.13, my + 0.1, wz - 0.25], [x * 0.13, my + 0.5, wz - 0.22]], 0.022, { seg: 10, fillet: 0.05, tint: black })
    k.cyl('steel', 0.03, 0.3, [0, my + 0.5, wz - 0.22], { axis: 'x', seg: 14, tint: black })
    k.cushion('paint', [0.26, 0.2, 0.42], [0, my + 0.44, wz - 0.48], { puff: 0.03, r: 0.08, tint: [[0.7, 0.1, 0.1], [0.12, 0.2, 0.5], [0.15, 0.15, 0.15]][v] as V3 })
    k.cushion('leather', [0.24, 0.07, 0.5], [0, my + 0.37, -0.2], { puff: 0.02, tint: [0.12, 0.1, 0.1] })

    k.box('steel', [0.24, 0.24, 0.3], [0, my + 0.1, 0.02], { r: 0.03, tint: [0.55, 0.56, 0.58] })
    for (let i = 0; i < 5; i++) {
      const y = my + 0.22 + i * 0.025
      k.box('steel', [0.22, 0.008, 0.2], [0, y + 0.004, 0], { r: 0.003, tint: [0.4, 0.4, 0.42] })
      if (i < 4) k.box('steel', [0.12, 0.017, 0.12], [0, y + 0.0165, 0], { r: 0.002, tint: [0.4, 0.4, 0.42] })
    }
    k.tube('steel', [[0.08, my + 0.05, 0.12], [0.12, my - 0.12, 0.0], [0.13, my - 0.1, -0.35], [0.14, my, -0.5]], 0.025, { fillet: 0.06, seg: 12, tint: [0.75, 0.72, 0.68] })
    k.cyl('steel', 0.015, 0.05, [0, my + 0.55, wz - 0.205], { seg: 10 })
    k.tube('steel', [[-0.3, my + 0.62, wz - 0.18], [0, my + 0.56, wz - 0.2], [0.3, my + 0.62, wz - 0.18]], 0.012, { fillet: 0.08, seg: 8 })
    for (const x of [-1, 1]) k.cyl('rubber', 0.016, 0.1, [x * 0.33, my + 0.63, wz - 0.18], { axis: 'x', seg: 10 })
    k.lathe('steel', [[0, 0], [0.08, 0], [0.085, 0.05], [0.07, 0.08], [0, 0.08]], [0, my + 0.48, wz - 0.2], { axis: 'z', seg: 18, tint: [0.75, 0.75, 0.78] })
    k.cyl('glass', 0.07, 0.004, [0, my + 0.48, wz - 0.118], { axis: 'z', seg: 18, tint: [0.95, 0.92, 0.8] })
  },
  'bicycle-stand': (k, s) => {
    const { w, h, d } = k, v = s.variant, dark: V3 = [0.15, 0.15, 0.16]

    const R = 0.3, wb = Math.min(0.52, (w + 0.14) / 2 - R - 0.01), sc = wb / 0.52, by = 0.72, bx = 0, bz = Math.max(0.06, Math.min(0.2, d / 2 - 0.225))
    const bb: V3 = [bx - 0.05 * sc, by - 0.02, 0], seat: V3 = [bx - 0.18 * sc, by + 0.5 * sc, 0], head: V3 = [bx + 0.38 * sc, by + 0.46 * sc, 0]
    const sx = seat[0] - 0.02, armY = seat[1] + 0.06

    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.3; k.tube('steel', [[sx + Math.cos(a) * 0.32, 0.015, Math.sin(a) * 0.25], [sx, 0.32, 0]], 0.014, { seg: 8, tint: dark }); k.sphere('rubber', 0.02, [sx + Math.cos(a) * 0.32, 0.018, Math.sin(a) * 0.25], { rows: 4, seg: 8, scale: [1, 0.8, 1] }) }
    k.cyl('steel', 0.022, armY + 0.02 - 0.32, [sx, (0.32 + armY + 0.02) / 2, 0], { seg: 14, tint: dark })
    k.box('steel', [0.04, 0.04, bz - 0.018], [sx, armY, (bz - 0.042) / 2], { r: 0.008, tint: dark })
    k.box('steel', [0.06, 0.08, 0.07], [sx, armY, bz], { r: 0.01, tint: [0.8, 0.15, 0.1] })
    k.frame({ at: [sx, 0.6, -0.125] }, () => { k.blk('steel', [0.3, 0.012, 0.206], 0, 0, 0, { r: 0.004, tint: dark }); k.blk('steel', [0.3, 0.03, 0.006], 0, 0, -0.1, { r: 0.002, tint: dark }) })
    for (let i = 0; i < 3; i++) k.box('steel', [0.12, 0.012, 0.02], [sx - 0.08 + i * 0.07, 0.618, -0.16 + i * 0.03], { yaw: 0.3 * i, r: 0.003, tint: [0.8, 0.15, 0.1] })
    const tint: V3 = [[0.2, 0.45, 0.6], [0.65, 0.12, 0.12], [0.85, 0.85, 0.82]][v] as V3
    k.frame({ at: [0, 0, bz] }, () => {
      k.wheel([bx - wb, by, 0], R, 0.035, { axis: 'z', tread: 'bike', ratio: 0.9, spokes: 28 })
      k.wheel([bx + wb, by, 0], R, 0.035, { axis: 'z', tread: 'bike', ratio: 0.9, spokes: 28 })
      k.tube('steel', [bb, seat], 0.016, { seg: 10, tint }); k.tube('steel', [seat, head], 0.015, { seg: 10, tint }); k.tube('steel', [bb, [head[0] + 0.02, head[1] - 0.12 * sc, 0]], 0.018, { seg: 10, tint })
      for (const z of [-0.035, 0.035]) { k.tube('steel', [[bx - wb, by, z], bb], 0.009, { seg: 8, tint }); k.tube('steel', [[bx - wb, by, z], [seat[0] + 0.01, seat[1] - 0.03, 0]], 0.008, { seg: 8, tint }) }
      for (const z of [-0.03, 0.03]) k.tube('steel', [[bx + wb, by, z], [head[0] + 0.01, head[1] - 0.14 * sc, 0]], 0.01, { seg: 8 })
      const stemTop: V3 = [head[0] - 0.01, head[1] + 0.08 * sc, 0]
      k.tube('steel', [[head[0], head[1] - 0.14 * sc, 0], stemTop], 0.016, { seg: 10 })

      k.tube('steel', [[stemTop[0] + 0.03, stemTop[1] + 0.02, -0.22], stemTop, [stemTop[0] + 0.03, stemTop[1] + 0.02, 0.22]], 0.011, { fillet: 0.08, seg: 8 })
      for (const z of [-1, 1]) k.cyl('rubber', 0.014, 0.09, [stemTop[0] + 0.03, stemTop[1] + 0.02, z * 0.26], { axis: 'z', seg: 10 })
      k.tube('steel', [seat, [seat[0] - 0.04, seat[1] + 0.12, 0]], 0.012, { seg: 8 })
      k.cushion('leather', [0.25, 0.05, 0.13], [seat[0] - 0.06, seat[1] + 0.14, 0], { puff: 0.012, r: 0.03, tint: [0.12, 0.1, 0.1] })

      k.cyl('steel', 0.02, 0.097, [bb[0], bb[1], -0.0065], { axis: 'z', seg: 12 })
      k.cyl('steel', 0.09, 0.006, [bb[0], bb[1], 0.045], { axis: 'z', seg: 32, tint: [0.7, 0.7, 0.72] })
      for (const z of [-1, 1]) k.tube('steel', [[bb[0], bb[1], z * 0.05], [bb[0] + 0.12 * z, bb[1] - 0.12 * z, z * 0.06]], 0.008, { seg: 8 })
      k.torus('steel', 0.24 * sc, 0.004, [(bb[0] + bx - wb) / 2, by - 0.01, 0.045], { axis: 'z', segR: 40, seg: 4, scale: [1.18, 0.4, 1], tint: [0.3, 0.3, 0.3] })
    })
  },
  'tire-changer': (k, s) => {
    const { w, h, d } = k, v = s.variant, red: V3 = [0.75, 0.12, 0.1]

    const bh = h * 0.45
    k.blk('steel', [w * 0.7, bh, d * 0.7], 0, 0, 0, { r: 0.02, tint: red })
    k.blk('steel', [w * 0.72, 0.03, d * 0.72], 0, 0, 0, { r: 0.006, tint: [0.2, 0.2, 0.2] })
    for (let i = 0; i < 3; i++) k.box('steel', [0.06, 0.02, 0.18], [-0.1 + i * 0.1, 0.06, d * 0.35 + 0.06], { pitch: 0.25, r: 0.004, tint: [0.25, 0.25, 0.25] })
    k.cyl('steel', w * 0.3, 0.05, [0, bh + 0.025, 0], { seg: 32, tint: [0.3, 0.3, 0.3] })
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; k.box('steel', [0.1, 0.05, 0.04], [Math.cos(a) * w * 0.22, bh + 0.075, Math.sin(a) * w * 0.22], { yaw: -a, r: 0.006, tint: [0.75, 0.75, 0.75] }) }

    k.wheel([0, bh + 0.05 + 0.1, 0], 0.32, 0.2, { axis: 'x', tread: 'car', ratio: 0.62, roll: Math.PI / 2 })

    const cz = -d * 0.35 - 0.05
    k.box('steel', [0.1, h, 0.1], [-w * 0.3, h / 2, cz], { r: 0.012, tint: red })
    k.box('steel', [w * 0.35, 0.08, 0.08], [-w * 0.3 + w * 0.175, h - 0.06, cz], { r: 0.01, tint: red })
    k.box('steel', [0.05, 0.34, 0.05], [0.02, h - 0.1 - 0.17, cz], { r: 0.008, tint: [0.75, 0.75, 0.75] })
    k.box('steel', [0.04, 0.08, 0.2], [0.02, h - 0.48, cz + 0.1], { r: 0.008, tint: [0.25, 0.25, 0.25] })

    k.frame({ at: [w * 0.36, 0.3, 0], roll: -0.3 }, () => {
      k.box('steel', [0.06, 0.5, 0.06], [0, 0, 0], { r: 0.008, tint: red })
      k.box('steel', [0.16, 0.04, 0.12], [0.06, -0.25, 0], { r: 0.008, tint: [0.25, 0.25, 0.25] })
    })
    gauge(k, [w * 0.35 + 0.0, bh * 0.8, d * 0.35], 0.04)
    k.cable('rubber', [w * 0.2, bh * 0.75, d * 0.35], [w * 0.4, 0.02, d * 0.4], 0.2, 0.008)
    if (v === 2) k.wheel([-w * 0.35 - 0.102, 0.32 - 0.002, 0.1], 0.32, 0.2, { axis: 'x', tread: 'car', ratio: 0.62 })
  },
  'vehicle-lift': (k, s) => {
    const { w, h, d } = k, v = s.variant, blue: V3 = [0.2, 0.35, 0.6]

    for (const x of [-1, 1]) {
      const cx = x * (w - 0.3) / 2
      k.blk('steel', [0.42, 0.02, 0.5], cx, 0, 0, { r: 0.004, tint: [0.3, 0.3, 0.3] })
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) k.bolt([cx + ox * 0.17, 0.02, oz * 0.2], { pitch: -Math.PI / 2, r: 0.01 })
      column(k, 'steel', channelOutline(0.3, 0.26, 0.012), h - 0.02, 0.02, cx + x * 0.13, 0, { yaw: x > 0 ? Math.PI : 0, tint: blue })
      k.box('steel', [0.18, 0.4, 0.22], [cx - x * 0.05, 0.62, 0], { r: 0.012, tint: [0.3, 0.3, 0.32] })
      for (const z of [-1, 1]) {
        const ang = z * 0.65 + (x > 0 ? Math.PI : 0)
        k.frame({ at: [cx - x * 0.12, 0.5, z * 0.07], yaw: ang }, () => {
          k.box('steel', [0.1, 0.08, 0.1], [0, 0, 0], { r: 0.01, tint: [0.3, 0.3, 0.32] })
          k.box('steel', [0.7, 0.07, 0.09], [0.38, 0, 0], { r: 0.008, tint: blue })
          k.box('steel', [0.5, 0.055, 0.07], [0.62, 0.0, 0], { r: 0.006, tint: [0.75, 0.75, 0.75] })
          k.cyl('rubber', 0.07, 0.04, [0.82, 0.055, 0], { seg: 20, tint: [0.15, 0.15, 0.15] })
          k.cyl('steel', 0.03, 0.03, [0.82, 0.02, 0], { seg: 12 })
        })
      }

      for (let i = 0; i < 12; i++) k.box('steel', [0.03, 0.012, 0.18], [cx + x * 0.103, 0.4 + i * 0.15, 0], { r: 0.002, tint: [0.2, 0.2, 0.2] })
    }

    rail(k, 'steel', ibeamOutline(0.2, 0.14, 0.012, 0.016), w - 0.062, [0, h - 0.1, 0], { tint: blue })
    k.box('steel', [w - 0.7, 0.03, 0.05], [0, h - 0.24, 0.05], { r: 0.006, tint: [0.85, 0.75, 0.15] })
    for (const x of [-1, 1]) k.box('steel', [0.03, 0.06, 0.03], [x * (w - 0.7) / 2, h - 0.205, 0.05], { r: 0.004, tint: [0.85, 0.75, 0.15] })
    for (const x of [-1, 1]) k.cyl('steel', 0.08, 0.04, [x * (w / 2 - 0.35), h - 0.25, 0], { axis: 'z', seg: 20, tint: [0.3, 0.3, 0.32] })
    k.cable('steel', [-(w / 2 - 0.35), h - 0.25, 0.022], [w / 2 - 0.35, h - 0.25, 0.022], 0.01, 0.005)
    const px = (w - 0.3) / 2 - 0.25
    k.blk('steel', [0.25, 0.3, 0.2], px, 0.9, 0.22, { r: 0.015, tint: [0.2, 0.2, 0.22] })
    k.box('steel', [0.05, 0.6, 0.05], [px + 0.15, 1.2, 0.22], { r: 0.008, tint: [0.25, 0.25, 0.25] })
    motor(k, [px, 1.2, 0.22], 0.08, 0.22, { tint: [0.2, 0.2, 0.22] })
    k.cable('rubber', [px - 0.1, 0.9, 0.22], [px - 0.12, 0.62, 0.0], 0.04, 0.008)
    k.blk('steel', [w - 0.75, 0.012, 0.3], 0, 0, 0, { r: 0.003, tint: [0.35, 0.35, 0.37] })
    if (v > 0) k.blk('steel', [0.5, 0.35, 0.4], 0, 0, d / 2 - 0.25, { r: 0.02, tint: [0.75, 0.15, 0.1] })
  },
  'wash-gantry': (k, s) => {
    const { w, h, d } = k, v = s.variant, frame: V3 = [0.85, 0.86, 0.88]

    for (const x of [-1, 1]) {
      const cx = x * (w - 0.3) / 2
      k.blk('steel', [0.12, 0.06, d + 0.0], cx, 0, 0, { r: 0.006, tint: [0.4, 0.4, 0.42] })
      k.blk('steel', [0.26, 0.16, 0.5], cx, 0.06, 0, { r: 0.02, tint: [0.25, 0.25, 0.27] })
      for (const z of [-1, 1]) k.cyl('rubber', 0.05, 0.06, [cx, 0.11, z * 0.18], { axis: 'x', seg: 16 })
      column(k, 'steel', [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]], h - 0.32 - 0.22, 0.22, cx, 0, { tint: frame })
      k.blk('paint', [0.3, 0.5, 0.25], cx, 0.9, -0.223, { r: 0.03, tint: [0.15, 0.35, 0.65] })
      k.box('glass', [0.18, 0.12, 0.004], [cx, 1.2, -0.35], { r: 0.003, tint: [0.3, 0.6, 0.9] })
    }
    k.blk('steel', [w - 0.1, 0.2, 0.3], 0, h - 0.32, 0, { r: 0.02, tint: frame })
    k.blk('paint', [w * 0.5, 0.12, 0.35], 0, h - 0.12, 0, { r: 0.03, tint: [0.15, 0.35, 0.65] })

    const brush = (at: V3, r: number, len: number, axis: 'x' | 'y', tint: V3) => {
      const n = Math.round(len / 0.05), prof: V2[] = [[0, -len / 2], [r * 0.9, -len / 2]]
      for (let i = 0; i < n; i++) { const y = -len / 2 + (i + 0.5) * len / n, rr = r * (0.95 + Math.sin(i * 1.7) * 0.05); prof.push([rr, y - len / n * 0.3], [rr, y + len / n * 0.3]) }
      prof.push([r * 0.9, len / 2], [0, len / 2])
      k.lathe('fabric', prof, at, { axis, seg: 24, tint, crease: 40 })
      for (const sgn of [-1, 1]) { const o = sgn * (len / 2 + 0.025), p: V3 = axis === 'y' ? [at[0], at[1] + o, at[2]] : [at[0] + o, at[1], at[2]]; k.cyl('steel', 0.03, 0.054, p, { axis, seg: 12, tint: [0.4, 0.4, 0.42] }) }
    }
    for (const x of [-1, 1]) {
      const bx = x * ((w - 0.3) / 2 - 0.42), len = h - 0.65
      brush([bx, 0.15 + len / 2 + 0.05, 0.05], 0.22, len, 'y', [0.2, 0.45, 0.85])
      k.box('steel', [Math.abs(bx - x * (w - 0.3) / 2), 0.08, 0.08], [(bx + x * (w - 0.3) / 2) / 2, h - 0.4, 0.05], { r: 0.008, tint: frame })
    }

    const tz = 0.05 - 0.22 - 0.2 - 0.01
    brush([0, h - 0.62, tz], 0.2, w - 1.0, 'x', [0.85, 0.2, 0.25])
    for (const x of [-1, 1]) {
      const hx = x * (w / 2 - 0.418)
      k.box('steel', [0.06, 0.06, -0.1 - tz + 0.015], [hx, h - 0.33, (tz - 0.015 - 0.1) / 2], { r: 0.008, tint: frame })
      k.box('steel', [0.06, 0.29, 0.06], [hx, h - 0.485, tz], { r: 0.008, tint: frame })
    }

    k.tube('steel', [[-(w - 0.3) / 2 + 0.1, 0.4, d / 2 - 0.1], [-(w - 0.3) / 2 + 0.1, h - 0.4, d / 2 - 0.1], [(w - 0.3) / 2 - 0.1, h - 0.4, d / 2 - 0.1], [(w - 0.3) / 2 - 0.1, 0.4, d / 2 - 0.1]], 0.022, { fillet: 0.12, seg: 10, tint: frame })
    for (let i = 0; i < 9; i++) k.cyl('steel', 0.012, 0.04, [-(w - 0.6) / 2 + i * (w - 0.6) / 8, h - 0.44, d / 2 - 0.1], { seg: 10, tint: [0.3, 0.3, 0.3] })
    for (const x of [-1, 1]) k.box('steel', [0.1, 0.06, d / 2 - 0.1 + 0.02], [x * ((w - 0.3) / 2 - 0.1 + 0.0), h - 0.4, (d / 2 - 0.1) / 2], { r: 0.006, tint: frame })
    k.sheet('glass', w - 0.44, d * 0.8, (x, z) => 0.002 + Math.sin(x * 6) * 0.001, [0, 0, 0], { thickness: 0.002, tint: [0.4, 0.45, 0.5] })
    void v
  },
  'paint-mixer': (k, s) => {
    const { w, h, d } = k, v = s.variant, body: V3 = [0.92, 0.92, 0.9]

    const ch = h * 0.62, cd = d * 0.8, t = 0.03

    k.blk('steel', [w + 0.01, 0.06, cd + 0.01], 0, 0, 0, { r: 0.008, tint: [0.3, 0.3, 0.32] })
    for (const x of [-1, 1]) k.blk('steel', [t, ch - 0.06, cd], x * (w / 2 - t / 2), 0.06, 0, { r: 0.006, tint: body })
    k.blk('steel', [w - 2 * t, ch - 0.06, t], 0, 0.06, -cd / 2 + t / 2, { r: 0.004, tint: body })
    k.blk('steel', [w, t, cd], 0, ch - t, 0, { r: 0.01, tint: body })
    const door = w * 0.62, dh = ch * 0.62, dy0 = ch * 0.55 - dh / 2, dy1 = ch * 0.55 + dh / 2, fz = cd / 2 - t / 2, iw = w - 2 * t
    k.blk('steel', [iw, dy0 - 0.06, t], 0, 0.06, fz, { r: 0.004, tint: body })
    k.blk('steel', [iw, ch - t - dy1, t], 0, dy1, fz, { r: 0.004, tint: body })
    for (const x of [-1, 1]) k.blk('steel', [(iw - door) / 2, dh, t], x * (door / 2 + (iw - door) / 4), dy0, fz, { r: 0.004, tint: body })
    k.frame({ at: [0, ch * 0.55, cd / 2] }, () => {
      k.frameRect('steel', door, dh, 0.04, 0.02, [0, 0, 0.01], { tone: 0.9 })
      k.box('glass', [door - 0.07, dh - 0.07, 0.004], [0, 0, 0.008], { r: 0, tint: [0.75, 0.85, 0.9] })
      k.handle([door / 2 - 0.02, 0, 0.02], 0.12, { vertical: true, r: 0.007, standoff: 0.03 })
    })

    k.blk('steel', [0.16, ch * 0.5 - 0.11 - 0.06, 0.16], 0, 0.06, d * 0.1, { r: 0.006, tint: [0.3, 0.3, 0.32] })
    k.cyl('steel', 0.1, 0.18, [0, ch * 0.5, d * 0.1], { seg: 24, tint: [0.3, 0.55, 0.75] })
    k.blk('steel', [0.28, 0.02, 0.28], 0, ch * 0.5 + 0.09, d * 0.1, { r: 0.004 })
    k.blk('steel', [0.28, 0.02, 0.28], 0, ch * 0.5 - 0.11, d * 0.1, { r: 0.004 })
    k.cyl('steel', 0.012, ch - t + 0.002 - (ch * 0.5 + 0.11), [0, (ch * 0.5 + 0.11 + ch - t + 0.002) / 2, d * 0.1], { seg: 10 })
    k.frame({ at: [w * 0.38, ch * 0.75, d * 0.4] }, () => { k.box('steel', [0.14, 0.2, 0.02], [0, 0, 0.01], { r: 0.008, tint: [0.25, 0.25, 0.27] }); k.screen([0, 0.04, 0.02], 0.1, 0.06, { bezel: 0.006 }); for (let i = 0; i < 4; i++) k.cyl('rubber', 0.008, 0.008, [-0.03 + (i % 2) * 0.06, -0.04 - Math.floor(i / 2) * 0.03, 0.022], { axis: 'z', seg: 10, tint: [0.3, 0.7, 0.35] }) })
    const carousel = Math.min(w, d * 0.8) * 0.42, ty = ch
    k.cyl('steel', carousel, 0.03, [0, ty + 0.015, 0], { seg: 32, tint: [0.3, 0.3, 0.32] })
    const cans = 12
    for (let i = 0; i < cans; i++) {
      const a = i / cans * Math.PI * 2, x = Math.cos(a) * carousel * 0.78, z = Math.sin(a) * carousel * 0.78, tint: V3 = [[0.85, 0.15, 0.12], [0.95, 0.75, 0.1], [0.15, 0.35, 0.75], [0.15, 0.55, 0.25], [0.1, 0.1, 0.1], [0.95, 0.95, 0.92]][i % 6] as V3
      k.cyl('steel', 0.045, h - ch - 0.15, [x, ty + 0.03 + (h - ch - 0.15) / 2, z], { seg: 16, tint: [0.85, 0.85, 0.85] })
      k.cyl('paint', 0.046, 0.06, [x, ty + 0.03 + (h - ch - 0.15) * 0.7, z], { seg: 16, tint, caps: false })
      k.cyl('steel', 0.012, 0.05, [x, ty + 0.03 + 0.0, z + 0.0], { seg: 10, tint: [0.2, 0.2, 0.2] })
      k.cyl('steel', 0.02, 0.03, [x, ty + 0.03 + (h - ch - 0.15) + 0.015, z], { seg: 12, tint })
    }
    k.cyl('steel', 0.05, h - ch - 0.1, [0, ty + 0.03 + (h - ch - 0.1) / 2, 0], { seg: 16, tint: [0.3, 0.3, 0.32] })

    for (let i = 0; i < 2 + v; i++) k.frame({ at: [-w / 2 + 0.1, ch + i * 0.0212, cd / 2 - 0.11], yaw: 0.2 + i * 0.4 }, () => { for (let j = 0; j < 5; j++) k.box('paper', [0.05, 0.004, 0.18], [0, 0.002 + j * 0.0042, 0], { yaw: j * 0.15, r: 0.0008, tint: [[0.9, 0.3, 0.2], [0.3, 0.5, 0.85], [0.95, 0.8, 0.2], [0.4, 0.7, 0.4], [0.75, 0.5, 0.8]][j] as V3 }) })
  },
  'printing-press': (k, s) => {
    const { w, h, d } = k, v = s.variant, iron: V3 = [0.22, 0.24, 0.24]

    const fw = w * 0.42
    for (const x of [-1, 1]) {

      const side: V2[] = [[-d * 0.42, 0], [d * 0.42, 0], [d * 0.35, 0.12], [d * 0.18, 0.15], [d * 0.12, h * 0.75], [-d * 0.05, h * 0.85], [-d * 0.2, h * 0.75], [-d * 0.25, 0.15], [-d * 0.35, 0.12]]
      const hole: V2[] = [[-d * 0.12, 0.2], [-d * 0.12, h * 0.38], [d * 0.08, h * 0.38], [d * 0.08, 0.2]]
      k.extrude('steel', side.map(([a, b]) => [-a, b] as V2), 0.06, [x * fw / 2, 0, 0], { axis: 'x', bevel: 0.008, holes: [hole.map(([a, b]) => [-a, b] as V2)], tint: iron })
    }
    const inner = fw - 0.06
    for (const y of [0.1, h * 0.45]) k.cyl('steel', 0.03, fw + 0.02, [0, y, 0], { axis: 'x', seg: 14, tint: iron })
    k.box('steel', [inner, 0.4, 0.08], [0, h * 0.5, -d * 0.15], { pitch: -0.15, r: 0.01, tint: iron })
    k.frame({ at: [0, h * 0.5, d * 0.05], pitch: 0.2 }, () => {
      k.box('steel', [fw - 0.1, 0.36, 0.06], [0, 0, 0], { r: 0.01, tint: iron })
      k.box('steel', [fw - 0.14, 0.3, 0.012], [0, 0, 0.035], { r: 0.002, tint: [0.7, 0.7, 0.68] })
    })

    k.frame({ at: [0, h * 0.82, -d * 0.12], pitch: 0.5 }, () => {
      k.cyl('steel', 0.2, 0.02, [0, 0, 0], { seg: 32, tint: [0.3, 0.3, 0.3] })
      k.cyl('paint', 0.18, 0.004, [0, 0.012, 0], { seg: 32, tint: [0.1, 0.1, 0.12] })
      k.cyl('steel', 0.025, 0.12, [0, -0.07, 0], { seg: 12, tint: iron })
    })
    k.box('steel', [inner + 0.004, 0.05, 0.05], [0, h * 0.82 - 0.13 * Math.cos(0.5) - 0.02, -d * 0.12 - 0.13 * Math.sin(0.5)], { r: 0.006, tint: iron })
    for (let i = 0; i < 3; i++) k.cyl('rubber', 0.035, fw - 0.08, [0, h * 0.72 - i * 0.08, -d * 0.02 + i * 0.03], { axis: 'x', seg: 18, tint: [0.12, 0.12, 0.12] })

    for (const x of [-1, 1]) k.box('steel', [0.02, 0.3, 0.03], [x * (fw / 2 - 0.04), h * 0.72 - 0.08, -d * 0.02 + 0.03], { pitch: -0.359, r: 0.004, tint: iron })
    const fx = fw / 2 + 0.06, R = Math.min(0.45, h * 0.3)
    k.cyl('steel', 0.04, 0.12, [fx, h * 0.45, 0], { axis: 'x', seg: 16, tint: iron })
    k.torus('steel', R, 0.03, [fx + 0.03, h * 0.45, 0], { axis: 'x', segR: 48, seg: 8, tint: iron })
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.box('steel', [0.025, R, 0.03], [fx + 0.03, h * 0.45 + Math.cos(a) * R / 2, Math.sin(a) * R / 2], { pitch: a, r: 0.006, tint: iron }) }
    k.cyl('steel', 0.06, 0.06, [fx + 0.03, h * 0.45, 0], { axis: 'x', seg: 18, tint: iron })
    k.box('steel', [0.04, 0.04, d * 0.7], [-fw / 2 + 0.05, 0.12, d * 0.0], { pitch: 0.12, r: 0.006, tint: iron })
    k.box('wood', [fw * 0.6, 0.03, 0.18], [-fw / 2 + 0.03 + fw * 0.3, 0.07, d * 0.36], { pitch: 0.12, r: 0.004, tint: [0.6, 0.45, 0.3] })

    const fbY = h * 0.42, bxs = fw / 2 - 0.043
    k.blk('wood', [2 * (fw / 2 - 0.028), 0.03, 0.28], 0, fbY, d * 0.32, { r: 0.004, tint: [0.6, 0.45, 0.3] })
    for (let i = 0; i < 8; i++) k.blk('paper', [0.22, 0.004, 0.16], k.jitter(0.004), fbY + 0.03 + i * 0.0042, d * 0.32, { r: 0.0008, tint: [0.95, 0.93, 0.88] })
    for (const x of [-1, 1]) {
      const p0: V3 = [x * bxs, fbY - 0.12, d * 0.12], p1: V3 = [x * bxs, fbY - 0.002, d * 0.3], bl = Math.hypot(p1[1] - p0[1], p1[2] - p0[2])
      k.box('steel', [0.03, 0.03, bl], [x * bxs, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2], { pitch: -Math.atan2(p1[1] - p0[1], p1[2] - p0[2]), r: 0.004, tint: iron })
    }
    if (v > 0) {
      const tx = -fw / 2 - 0.22
      legFrame(k, 'wood', 0.36, d * 0.6, 0.9, { leg: 0.04, x: tx, z: 0, tint: [0.55, 0.4, 0.28] })
      k.blk('wood', [0.36, 0.05, d * 0.6], tx, 0.9, 0, { pitch: 0, r: 0.004, tint: [0.55, 0.4, 0.28] })
      for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) k.blk('steel', [0.05, 0.02, 0.06], tx - 0.13 + i * 0.085, 0.95, -d * 0.24 + j * 0.095, { r: 0.002, tint: [0.35, 0.35, 0.33] })
    }
  },
  'sewing-machine': (k, s) => {
    const { w, d } = k, v = s.variant, iron: V3 = [0.12, 0.12, 0.12], top = 0.76

    for (const x of [-1, 1]) {
      const sx = x * (w / 2 - 0.12)
      k.extrude('steel', [[-d * 0.42, 0], [-d * 0.32, 0], [-d * 0.18, top * 0.45], [d * 0.18, top * 0.45], [d * 0.32, 0], [d * 0.42, 0], [d * 0.25, top * 0.5], [d * 0.35, top - 0.02], [-d * 0.35, top - 0.02], [-d * 0.25, top * 0.5]], 0.025, [sx, 0, 0], { axis: 'x', bevel: 0.004, holes: [[[-d * 0.15, top * 0.55], [-d * 0.15, top * 0.85], [d * 0.15, top * 0.85], [d * 0.15, top * 0.55]]], tint: iron })
    }

    const fin = w / 2 - 0.12 - 0.0125
    for (const x of [-1, 1]) k.box('steel', [0.02, 0.04, d * 0.6], [x * (fin - 0.01), 0.12, 0], { r: 0.004, tint: iron })
    k.cyl('steel', 0.015, 2 * (fin - 0.02) + 0.004, [0, 0.12, 0], { axis: 'x', seg: 10, tint: iron })
    k.frame({ at: [0, 0.143, 0], pitch: 0.1 }, () => {
      k.box('steel', [w * 0.45, 0.02, d * 0.45], [0, 0, 0], { r: 0.004, tint: iron })
      for (let i = 0; i < 6; i++) k.box('steel', [0.02, 0.022, d * 0.4], [-w * 0.18 + i * w * 0.072, 0.019, 0], { r: 0.002, tint: [0.2, 0.2, 0.2] })
    })

    const fx = w / 2 - 0.12 - 0.05
    k.torus('steel', 0.2, 0.014, [fx, 0.42, 0], { axis: 'x', segR: 40, seg: 6, tint: iron })
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; k.box('steel', [0.012, 0.19, 0.015], [fx, 0.42 + Math.cos(a) * 0.1, Math.sin(a) * 0.1], { pitch: a, r: 0.003, tint: iron }) }
    k.cyl('steel', 0.025, 0.06, [fx + 0.02, 0.42, 0], { axis: 'x', seg: 12, tint: iron })
    const pin: V3 = [fx - 0.016, 0.42 + Math.cos(Math.PI * 0.4) * 0.12, Math.sin(Math.PI * 0.4) * 0.12]
    k.cyl('steel', 0.008, 0.02, pin, { axis: 'x', seg: 10, tint: iron })
    k.tube('steel', [[pin[0] - 0.004, pin[1], pin[2]], [w * 0.2, 0.162, 0.08]], 0.008, { seg: 8, tint: iron })

    k.blk('wood', [w, 0.035, d], 0, top - 0.02, 0, { r: 0.006, tint: [0.45, 0.3, 0.2] })
    const cx0 = -fin + 0.002, cx1 = cx0 + w * 0.26, cz1 = d / 2 - 0.05
    k.blk('wood', [cx1 - cx0, 0.13, d - 0.06], (cx0 + cx1) / 2, top - 0.15, -0.02, { r: 0.004, tint: [0.45, 0.3, 0.2] })
    drawer(k, 'wood', cx1 - cx0 - 0.03, 0.11, [(cx0 + cx1) / 2, top - 0.085, cz1], { handle: 'knob', t: 0.015 })
    const hx = w * 0.05, hy = top + 0.015
    k.blk('steel', [0.42, 0.05, 0.18], hx, hy, 0, { r: 0.012, tint: iron })
    k.extrude('steel', [[-0.2, 0], [-0.1, 0], [-0.09, 0.18], [0.08, 0.2], [0.12, 0.15], [0.14, 0.04], [0.2, 0.04], [0.2, 0.22], [0.12, 0.27], [-0.1, 0.27], [-0.2, 0.22]], 0.09, [hx, hy + 0.05, 0], { bevel: 0.02, bevelSeg: 3, curveSeg: 4, tint: iron })
    k.cyl('steel', 0.06, 0.03, [hx + 0.215, hy + 0.2, 0], { axis: 'x', seg: 22, tint: [0.75, 0.72, 0.65] })
    k.cyl('steel', 0.008, 0.055, [hx + 0.17, hy + 0.0875, 0], { seg: 8, tint: [0.8, 0.8, 0.8] })
    k.box('steel', [0.025, 0.01, 0.03], [hx + 0.17, hy + 0.055, 0.01], { r: 0.003 })
    k.cyl('steel', 0.004, 0.05, [hx - 0.05, hy + 0.05 + 0.27 + 0.025, 0], { seg: 6 })
    k.cyl('fabric', 0.018, 0.035, [hx - 0.05, hy + 0.05 + 0.27 + 0.02, 0], { seg: 14, tint: [[0.8, 0.15, 0.15], [0.15, 0.3, 0.7], [0.9, 0.85, 0.75]][v] as V3 })
    k.sheet('fabric', 0.36, 0.26, (x, z) => Math.sin(x * 14) * 0.008 + Math.cos(z * 10) * 0.005 + 0.009, [hx + 0.05, top + 0.015, 0.05], { thickness: 0.003, tint: [[0.75, 0.6, 0.45], [0.35, 0.45, 0.6], [0.65, 0.3, 0.3]][v] as V3 })
    k.frame({ at: [-w * 0.32, top + 0.015, 0.12], yaw: 0.6 }, () => { for (const s2 of [-1, 1]) k.box('steel', [0.12, 0.004, 0.012], [0.03, 0.002, s2 * 0.006], { yaw: s2 * 0.15, r: 0.001 }); k.torus('rubber', 0.016, 0.004, [-0.05, 0.004, 0], { segR: 14, seg: 5, axis: 'y', tint: [0.1, 0.1, 0.1] }) })
  },
  forklift: (k, s) => {
    const { w, h, d } = k, v = s.variant, yellow: V3 = [0.92, 0.68, 0.1], dark: V3 = [0.17, 0.17, 0.18], bodyW = w - 0.52

    const forkTip = -d / 2 + 0.03, mz = -d / 2 + 0.72, fz = mz + 0.32, rz = d / 2 - 0.4, fr = 0.3, rr = 0.25, track = (bodyW + 0.24) / 2
    for (const x of [-1, 1]) {
      k.wheel([x * track, fr - 0.002, fz], fr, 0.24, { tread: 'smooth', ratio: 0.58, rim: 'steel' })
      k.wheel([x * (track - 0.04), rr - 0.002, rz], rr, 0.2, { tread: 'smooth', ratio: 0.58, rim: 'steel' })
    }
    const z0 = fz - 0.18, z1 = d / 2 - 0.04
    k.box('paint', [bodyW, 0.34, z1 - z0], [0, 0.47, (z0 + z1) / 2], { r: 0.03, tint: yellow })

    k.cyl('steel', 0.07, 2 * track, [0, fr, fz], { axis: 'x', seg: 18, tint: dark })
    k.cyl('steel', 0.06, 2 * (track - 0.04), [0, rr, rz], { axis: 'x', seg: 18, tint: dark })
    k.box('steel', [bodyW + 0.08, 0.5, 0.42], [0, 0.6, z1 - 0.21], { r: 0.08, tint: dark })
    k.box('paint', [bodyW * 0.86, 0.3, 0.6], [0, 0.79, rz - 0.18], { r: 0.06, tint: yellow })
    const tankZ = z1 - 0.25
    k.cyl('steel', 0.14, 0.62, [0, 0.85 + 0.14 + 0.01, tankZ], { axis: 'x', seg: 22, tint: [0.85, 0.85, 0.85] })
    for (const x of [-1, 1]) k.box('steel', [0.04, 0.16, 0.05], [x * 0.24, 0.92, tankZ], { r: 0.006, tint: dark })
    k.cyl('steel', 0.03, 0.06, [0.33, 1.0, tankZ], { axis: 'x', seg: 12, tint: [0.7, 0.6, 0.2] })
    const seatZ = rz - 0.32
    k.lathe('steel', [[0, 0], [0.22, 0.0], [0.23, 0.03], [0.21, 0.1], [0.18, 0.1], [0.19, 0.035], [0, 0.035]], [0, 0.94, seatZ], { seg: 26, tint: dark })
    k.cushion('leather', [0.42, 0.07, 0.4], [0, 1.0, seatZ], { puff: 0.015, tint: [0.15, 0.15, 0.15] })
    k.cushion('leather', [0.42, 0.34, 0.08], [0, 1.2, seatZ + 0.2], { puff: 0.015, pitch: -0.15, tint: [0.15, 0.15, 0.15] })
    k.box('paint', [bodyW * 0.62, 0.42, 0.22], [0, 0.85, fz + 0.04], { r: 0.04, tint: yellow })
    const colTop: V3 = [0, 1.36, fz + 0.24]
    k.tube('steel', [[0, 1.02, fz + 0.14], colTop], 0.025, { seg: 10, tint: dark })
    k.frame({ at: colTop, pitch: -0.9 }, () => { k.torus('rubber', 0.16, 0.014, [0, 0, 0], { segR: 36, seg: 8 }); k.cyl('steel', 0.03, 0.04, [0, 0, 0], { seg: 12 }); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; k.box('steel', [0.14, 0.012, 0.02], [Math.cos(a) * 0.085, 0, Math.sin(a) * 0.085], { yaw: -a, r: 0.004 }) } })
    for (let i = 0; i < 3; i++) { k.tube('steel', [[0.16 + i * 0.05, 1.04, fz + 0.1], [0.17 + i * 0.05, 1.22, fz + 0.16]], 0.007, { seg: 6 }); k.sphere('rubber', 0.018, [0.17 + i * 0.05, 1.23, fz + 0.16], { rows: 5, seg: 8, tint: [0.85, 0.15, 0.1] }) }

    const guardTop = h - 0.06, gz0 = fz + 0.06, gz1 = rz + 0.05
    for (const x of [-1, 1]) for (const z of [gz0, gz1]) k.box('steel', [0.06, guardTop - 0.64, 0.06], [x * (bodyW / 2 - 0.05), 0.64 + (guardTop - 0.64) / 2, z], { r: 0.008, tint: dark })
    for (const z of [gz0, gz1]) k.box('steel', [bodyW, 0.06, 0.06], [0, guardTop, z], { r: 0.008, tint: dark })
    for (let i = 0; i < 6; i++) k.box('steel', [0.04, 0.04, gz1 - gz0 + 0.04], [-bodyW / 2 + 0.05 + i * (bodyW - 0.1) / 5, guardTop + 0.05, (gz0 + gz1) / 2], { r: 0.006, tint: dark })

    for (const x of [-1, 1]) {
      column(k, 'steel', channelOutline(0.12, 0.06, 0.01), h - 0.12, 0.04, x * bodyW * 0.42, mz, { yaw: x > 0 ? Math.PI : 0, tint: dark })
      k.box('steel', [0.1, 0.06, fz - mz - 0.05], [x * bodyW * 0.42, fr, (mz + 0.06 + fz + 0.01) / 2], { r: 0.008, tint: dark })
      k.cyl('steel', 0.045, 0.04, [x * bodyW * 0.28, h - 0.2, mz + 0.03], { axis: 'x', seg: 16, tint: [0.3, 0.3, 0.3] })

      chain(k, [x * bodyW * 0.28, h - 0.2, mz - 0.012], [x * bodyW * 0.28, 0.53, mz - 0.012], { r: 0.0045, tint: [0.3, 0.3, 0.3] })
      k.box('steel', [0.04, 0.06, 0.055], [x * bodyW * 0.28, 0.53, mz - 0.0325], { r: 0.004, tint: dark })
    }

    for (const y of [h - 0.14, 0.34]) k.box('steel', [2 * (bodyW * 0.42 - 0.01) + 0.002, 0.08, 0.1], [0, y, mz], { r: 0.01, tint: dark })

    const cz = mz - 0.09
    k.box('steel', [bodyW * 0.8, 0.28, 0.06], [0, 0.42, cz], { r: 0.008, tint: dark })
    for (let i = 0; i < 5; i++) k.box('steel', [0.03, 0.55, 0.03], [-bodyW * 0.35 + i * bodyW * 0.175, 0.83, cz], { r: 0.004, tint: dark })
    k.box('steel', [bodyW * 0.8, 0.04, 0.04], [0, 1.1, cz], { r: 0.004, tint: dark })
    const loaded = v !== 1, forkY = loaded ? 0.16 : 0.06, forkLen = cz - 0.075 - forkTip, forkTop = forkY + 0.0225
    for (const x of [-1, 1]) {
      k.box('steel', [0.1, 0.36, 0.045], [x * 0.25, forkY + 0.16, cz - 0.0525], { r: 0.006, tint: [0.25, 0.25, 0.25] })

      k.extrude('steel', [[0, 0], [forkLen, 0], [forkLen, 0.02], [0.06, 0.045], [0, 0.045]], 0.1, [x * 0.25, forkY - 0.0225, cz - 0.075], { axis: 'x', bevel: 0.003, tint: [0.25, 0.25, 0.25] })
    }
    if (loaded) {

      const L = Math.min(0.8, forkLen - 0.02), pz = cz - 0.08 - L / 2, deck = forkTop
      const boards = Math.max(3, Math.floor((L + 0.03) / 0.15))
      for (let i = 0; i < boards; i++) k.plank('wood', 0.9, 0.12, 0.022, [0, deck + 0.011, cz - 0.14 - i * (L - 0.12) / (boards - 1)], { tint: [0.78, 0.65, 0.48], wear: 0 })
      for (const x of [-1, 0, 1]) k.blk('wood', [0.1, 0.1, L], x * 0.38, deck - 0.1 + 0.002, pz, { r: 0.004, tint: [0.75, 0.62, 0.45] })
      k.blk('paper', [0.5, 0.35, 0.4], -0.1, deck + 0.022, pz, { r: 0.01, tint: [0.62, 0.5, 0.36] })
    }
  },
}
