import { arc, roundRect, type Family, type Kit, type V2, type V3 } from '../kit'
import { carcass, door, drawer } from './common'
import { gauge, legFrame } from './shop'
import { bottle, cup, lighten, tin } from './props'

const DARK: V3 = [0.2, 0.2, 0.22]
const STAINLESS: V3 = [0.8, 0.81, 0.82]
const CHROME: V3 = [0.9, 0.9, 0.92]
const IRON: V3 = [0.12, 0.12, 0.13]
const ENAMEL: V3 = [0.07, 0.07, 0.08]
const BRASS: V3 = [0.85, 0.68, 0.35]

function loaf(k: Kit, at: V3, len: number, o: { yaw?: number; burnt?: boolean } = {}) {
  k.sphere('paper', len / 2, [at[0], at[1] + len * 0.17, at[2]], { rows: 6, seg: 12, scale: [1, 0.36, 0.55], yaw: o.yaw, tint: o.burnt ? [0.25, 0.17, 0.12] : [0.78, 0.52, 0.28], tone: 0.9 + k.rnd() * 0.15 })
}

function sheetPan(k: Kit, w: number, d: number, at: V3, o: { yaw?: number } = {}) {
  const tint: V3 = [0.62, 0.6, 0.58]
  k.frame({ at, yaw: o.yaw }, () => {
    k.box('steel', [w, 0.006, d], [0, 0.003, 0], { r: 0.001, tint })
    for (const s of [-1, 1]) {
      k.box('steel', [w, 0.02, 0.006], [0, 0.01, s * (d / 2 - 0.003)], { r: 0.002, tint })
      k.box('steel', [0.006, 0.02, d - 0.012], [s * (w / 2 - 0.003), 0.01, 0], { r: 0.002, tint })
    }
  })
}

export function ovenCavity(k: Kit, x: number, y: number, width: number, height: number, back: number, front: number, rack: boolean) {
  const depth = front - back, z = (front + back) / 2
  for (const level of [y + 0.003, y + height - 0.003]) k.box('paint', [width, 0.006, depth], [x, level, z], { r: 0, tint: ENAMEL })
  k.box('paint', [width, height, 0.006], [x, y + height / 2, back + 0.003], { r: 0, tint: ENAMEL })
  for (const s of [-1, 1]) k.box('paint', [0.006, height, depth], [x + s * (width / 2 - 0.003), y + height / 2, z], { r: 0, tint: ENAMEL })
  if (!rack) return
  const level = y + height * 0.38
  for (const s of [-1, 1]) {
    k.box('steel', [0.012, 0.008, depth - 0.02], [x + s * (width / 2 - 0.012), level - 0.008, z], { r: 0.002, tint: DARK })
    k.cyl('steel', 0.0035, width - 0.03, [x, level, z + s * (depth / 2 - 0.04)], { axis: 'x', seg: 6, tint: CHROME })
  }
  const rods = Math.max(4, Math.round(width / 0.07))
  for (let i = 0; i < rods; i++) k.cyl('steel', 0.0025, depth - 0.07, [x - (width - 0.06) / 2 + i * (width - 0.06) / (rods - 1), level, z], { axis: 'z', seg: 5, bevel: 0, tint: CHROME })
}

function pot(k: Kit, at: V3, r: number, hh: number, o: { lid?: boolean; tint?: V3; roll?: number; yaw?: number } = {}) {
  const tint = o.tint ?? [0.72, 0.72, 0.74]
  k.frame({ at, roll: o.roll, yaw: o.yaw }, () => {
    k.lathe('steel', [[0, 0], [r, 0], [r, hh], [r + 0.008, hh + 0.004], [r - 0.006, hh + 0.004], [r - 0.006, 0.008], [0, 0.008]], [0, 0, 0], { seg: 22, tint, crease: 60 })
    for (const s of [-1, 1]) k.box('steel', [0.04, 0.015, 0.06], [s * (r + 0.018), hh - 0.04, 0], { r: 0.005, tint })
    if (o.lid) {
      k.lathe('steel', [[0, 0], [r + 0.004, 0], [r, 0.01], [r * 0.6, 0.035], [0, 0.04]], [0, hh + 0.004, 0], { seg: 22, tint, crease: 50 })
      k.cyl('rubber', 0.018, 0.025, [0, hh + 0.004 + 0.05, 0], { seg: 12 })
    }
  })
}

export const FOOD: Family = {
  'bread-oven': (k, s) => {
    const { w, h, d } = k, v = s.variant, standH = 0.62, bodyH = 0.96, bd = d - 0.12, bz = -0.06, front = bz + bd / 2, top = standH + bodyH

    legFrame(k, 'steel', w - 0.04, bd - 0.04, standH, { leg: 0.05, shelf: 0.16, tint: DARK, z: bz })
    const shelfY = 0.16 + 0.05 * 0.3 + 0.018
    for (const x of [-1, 1]) {
      sheetPan(k, 0.6, 0.4, [x * 0.33, shelfY, bz])
      if (v === 2 && x > 0) continue
      for (let i = 0; i < 3; i++) loaf(k, [x * 0.33 - 0.18 + i * 0.18, shelfY + 0.006, bz + k.jitter(0.03)], 0.17, { yaw: Math.PI / 2 + k.jitter(0.2), burnt: v === 2 })
    }

    k.blk('steel', [w + 0.02, 0.1, bd + 0.02], 0, top, bz, { r: 0.012, tint: [0.7, 0.7, 0.72] })
    const dw = w * 0.66, dx = -w * 0.15, deckH = 0.34, left = dx - dw / 2, right = dx + dw / 2, back = bz - bd / 2 + 0.03
    k.blk('steel', [w / 2 - right, bodyH, bd], (right + w / 2) / 2, standH, bz, { r: 0.012, tint: STAINLESS })
    k.blk('steel', [left + w / 2, bodyH, bd], (left - w / 2) / 2, standH, bz, { r: 0.006, tint: STAINLESS })
    k.blk('steel', [dw, bodyH, 0.03], dx, standH, back - 0.015, { r: 0.004, tint: STAINLESS })
    for (const [y, rise] of [[standH, 0.1], [standH + 0.1 + deckH, 0.12], [standH + 0.22 + 2 * deckH, bodyH - 0.22 - 2 * deckH]]) k.blk('steel', [dw, rise, bd], dx, y, bz, { r: 0.004, tint: STAINLESS })
    for (let i = 0; i < 2; i++) {
      const y0 = standH + 0.1 + i * (deckH + 0.12), broken = v === 2 && i === 0
      k.cyl('steel', 0.01, dw, [dx, y0, front + 0.006], { axis: 'x', seg: 10, tint: DARK })
      ovenCavity(k, dx, y0, dw, deckH, back, front, false)
      k.box('concrete', [dw - 0.02, 0.014, front - back - 0.04], [dx, y0 + 0.013, (front + back) / 2 + 0.01], { r: 0.003, tint: [0.55, 0.45, 0.38] })
      k.frame({ at: [dx, y0, front + 0.002] }, () => k.leaf({
        kind: 'lid', pivot: k.point([0, 0, 0]), axis: k.direction([1, 0, 0]), travel: 1.45, initial: broken ? 0.35 : 0,
        handle: k.point([0, deckH - 0.07, 0.08]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
        center: k.point([0, deckH / 2, 0.015]), width: dw, height: deckH, depth: 0.03, floor: k.point([0, 0.03, -0.3]),
      }, () => k.frame({ pitch: broken ? 0.35 : 0 }, () => {
        k.box('steel', [dw, deckH, 0.03], [0, deckH / 2, 0.015], { r: 0.006, tint: [0.72, 0.73, 0.75] })
        if (!broken) k.box('glass', [dw * 0.55, deckH * 0.4, 0.006], [0, deckH * 0.52, 0.031], { r: 0.003, tint: [0.35, 0.28, 0.2] })
        k.handle([0, deckH - 0.07, 0.03], dw * 0.7, { r: 0.012, standoff: 0.05 })
      })))
    }
    if (v === 2) k.box('charcoal', [dw * 0.8, 0.1, 0.004], [dx, standH + 0.1 + deckH + 0.06, front + 0.0015], { r: 0.001 })

    const px = (dx + dw / 2 + w / 2) / 2, pw = w / 2 - (dx + dw / 2) - 0.06
    k.box('steel', [pw, bodyH - 0.16, 0.02], [px, standH + bodyH / 2, front + 0.01], { r: 0.006, tint: DARK })
    for (let i = 0; i < 2; i++) {
      const y = standH + 0.1 + i * (deckH + 0.12) + deckH / 2
      gauge(k, [px - pw * 0.25, y + 0.06, front + 0.02], 0.038)
      for (const j of [0, 1]) k.knob([px + pw * 0.08 + j * pw * 0.22, y - 0.06, front + 0.02], 0.02, { m: 'rubber' })
      k.box('paint', [0.03, 0.015, 0.01], [px + pw * 0.19, y + 0.07, front + 0.024], { r: 0.003, tint: v === 2 ? [0.3, 0.1, 0.08] : [0.85, 0.15, 0.1] })
    }
    k.label([px, standH + 0.14, front + 0.0208], pw * 0.7, 0.05, { m: 'steel' })

    const cx = w * 0.28, cz = bz - bd / 2 + 0.22, y0 = top + 0.1, pipeTop = h - 0.14
    k.cyl('steel', 0.13, 0.06, [cx, y0 + 0.03, cz], { seg: 20, tint: DARK })
    k.cyl('steel', 0.09, pipeTop - y0 - 0.06, [cx, y0 + 0.06 + (pipeTop - y0 - 0.06) / 2, cz], { seg: 18, tint: [0.5, 0.5, 0.52] })
    for (let i = 1; i < 3; i++) k.torus('steel', 0.092, 0.006, [cx, y0 + 0.06 + i * (pipeTop - y0 - 0.06) / 3, cz], { segR: 24, seg: 5, tint: DARK })
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box('steel', [0.012, 0.1, 0.012], [cx + Math.cos(a) * 0.075, pipeTop + 0.03, cz + Math.sin(a) * 0.075], { r: 0.002, tint: DARK }) }
    k.lathe('steel', [[0, 0], [0.17, 0], [0.16, 0.014], [0, 0.09]], [cx, pipeTop + 0.07, cz], { seg: 20, tint: DARK })
    if (v === 1) {

      k.lathe('straw', [[0, 0], [0.16, 0], [0.2, 0.12], [0.19, 0.12], [0.15, 0.012], [0, 0.012]], [-0.3, y0, 0], { seg: 20, tint: [0.75, 0.6, 0.4] })
      for (const z of [-0.05, 0.05]) loaf(k, [-0.3, y0 + 0.012, z], 0.2)
    }
  },

  'diner-booth': (k, s) => {
    const { w, h, d } = k, v = s.variant, vinyl: V3 = v === 1 ? [0.2, 0.42, 0.45] : [0.62, 0.12, 0.1], shell: V3 = [0.92, 0.9, 0.85]
    const baseH = 0.36, bench = 0.48, frameT = 0.1, seatT = 0.09
    for (const sd of [-1, 1]) {
      const back = sd * (d / 2 - frameT / 2), inner = sd * (d / 2 - bench)
      k.blk('paint', [w, baseH, bench], 0, 0, sd * (d / 2 - bench / 2), { r: 0.008, tint: shell })
      k.blk('steel', [w, 0.05, 0.012], 0, 0.02, inner - sd * 0.005, { r: 0.004, tint: CHROME })
      k.blk('paint', [w, h - baseH, frameT], 0, baseH, back, { r: 0.01, tint: shell })
      k.box('steel', [w + 0.004, 0.02, frameT + 0.012], [0, h - 0.004, back], { r: 0.006, tint: CHROME })

      const seatD = bench - frameT + 0.004, seatZ = sd * (d / 2 - frameT - seatD / 2 + 0.004)
      if (v === 2 && sd > 0) {
        for (const x of [-1, 1]) k.blk('leather', [w / 2 - 0.05, seatT, seatD], x * (w / 4 + 0.005), baseH - 0.005, seatZ, { r: 0.03, tint: vinyl, roll: x * 0.04 })
        k.blk('fabric', [0.07, seatT * 0.8, seatD - 0.04], 0, baseH - 0.004, seatZ, { r: 0.02, tint: [0.9, 0.82, 0.5] })
      } else k.blk('leather', [w - 0.04, seatT, seatD], 0, baseH - 0.005, seatZ, { r: 0.03, tint: vinyl })

      const backH = h - baseH - seatT - 0.1, by = baseH - 0.005 + seatT - 0.01 + backH / 2
      k.frame({ at: [0, by, sd * (d / 2 - frameT - 0.045 + 0.004)], pitch: sd * 0.08 }, () => {
        k.box('leather', [w - 0.06, backH, 0.09], [0, 0, 0], { r: 0.03, tint: vinyl })
        for (let i = 1; i < 4; i++) k.box('leather', [0.012, backH - 0.08, 0.004], [-w / 2 + 0.03 + i * (w - 0.06) / 4, 0, -sd * 0.046], { r: 0.002, tint: lighten(vinyl) })
      })
    }

    const tw = w - 0.24, td = d - 2 * bench - 0.08, ty = 0.72, tt = 0.035, topY = ty + tt
    k.cyl('steel', 0.24, 0.02, [0, 0.01, 0], { seg: 28, tint: CHROME })
    k.cyl('steel', 0.045, ty - 0.05, [0, 0.02 + (ty - 0.05) / 2, 0], { seg: 16, tint: CHROME })
    k.box('steel', [0.5, 0.03, 0.06], [0, ty - 0.015, 0], { r: 0.004, tint: DARK })
    k.box('steel', [0.06, 0.03, td - 0.1], [0, ty - 0.015, 0], { r: 0.004, tint: DARK })
    k.blk('paint', [tw, tt, td], 0, ty, 0, { r: 0.004, tint: v === 1 ? [0.95, 0.85, 0.75] : [0.55, 0.78, 0.76] })
    for (const sd of [-1, 1]) {
      k.box('steel', [tw + 0.012, tt, 0.006], [0, ty + tt / 2, sd * (td / 2 + 0.002)], { r: 0.002, tint: CHROME })
      k.box('steel', [0.006, tt, td], [sd * (tw / 2 + 0.002), ty + tt / 2, 0], { r: 0.002, tint: CHROME })
    }
    if (v !== 2) {

      k.blk('steel', [0.11, 0.13, 0.07], -tw * 0.32, topY, 0, { r: 0.008, tint: CHROME })
      for (const sd of [-1, 1]) k.box('paper', [0.09, 0.08, 0.004], [-tw * 0.32, topY + 0.07, sd * 0.0365], { r: 0.001, tint: [0.97, 0.96, 0.92] })
      bottle(k, 0.026, 0.19, [-tw * 0.32 + 0.1, topY, -0.03], { m: 'paint', tint: [0.75, 0.1, 0.08] })
      bottle(k, 0.026, 0.19, [-tw * 0.32 + 0.1, topY, 0.04], { m: 'paint', tint: [0.9, 0.75, 0.15] })
      for (const sd of [-1, 1]) {
        k.cyl('tile', 0.12, 0.014, [tw * 0.1, topY + 0.007, sd * 0.13], { seg: 24, tint: [0.97, 0.96, 0.93] })
        cup(k, 0.04, 0.09, [tw * 0.32, topY, sd * 0.12], { m: 'tile', tint: [0.95, 0.94, 0.9], handle: true, yaw: sd * 1.2 })
      }
      k.box('paper', [0.22, 0.006, 0.3], [tw * 0.1 + 0.02, topY + 0.017, -0.13], { yaw: 0.25, r: 0.001, tint: [0.75, 0.15, 0.12] })
    } else {
      k.box('paper', [0.22, 0.006, 0.3], [0.45, 0.003, 0.1], { yaw: 0.9, r: 0.001, tint: [0.75, 0.15, 0.12] })
      k.frame({ at: [-0.2, topY + 0.025, 0.05], roll: Math.PI / 2, yaw: 0.5 }, () => bottle(k, 0.026, 0.19, [0, 0, 0], { m: 'paint', tint: [0.75, 0.1, 0.08] }))
    }
  },

  'range-hood': (k, s) => {
    const { w, h, d } = k, v = s.variant, foot = 0.12, top = 0.9, bd = d - 0.1, bz = -0.05, front = bz + bd / 2
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.cyl('steel', 0.025, foot, [x * (w / 2 - 0.06), foot / 2, bz + z * (bd / 2 - 0.06)], { seg: 12, tint: DARK })

    const railY = top - 0.03 - 0.1
    k.box('steel', [w, 0.1, 0.05], [0, railY + 0.05, front + 0.025], { r: 0.008, tint: [0.7, 0.71, 0.73] })
    for (let i = 0; i < 6; i++) if (!(v === 2 && i === 4)) k.knob([-w / 2 + 0.12 + i * (w - 0.24) / 5, railY + 0.05, front + 0.05], 0.022, { m: 'rubber' })

    const ow = w / 2 - 0.04, oh = railY - foot - 0.08, sill = foot + 0.04, back = bz - bd / 2 + 0.03
    k.blk('steel', [w, sill - foot, bd], 0, foot, bz, { r: 0.008, tint: STAINLESS })
    k.blk('steel', [w, top - 0.03 - sill - oh, bd], 0, sill + oh, bz, { r: 0.008, tint: STAINLESS })
    k.blk('steel', [w, oh, 0.03], 0, sill, back - 0.015, { r: 0.004, tint: STAINLESS })
    for (const x of [-1, 0, 1]) k.blk('steel', [x ? 0.02 : 0.04, oh, bd], x * (w / 2 - 0.01), sill, bz, { r: 0.004, tint: STAINLESS })
    for (const x of [-1, 1]) {
      const ox = x * (w / 4), y0 = sill
      k.cyl('steel', 0.01, ow, [ox, y0, front + 0.006], { axis: 'x', seg: 10, tint: DARK })
      ovenCavity(k, ox, y0, ow, oh, back, front, true)
      k.frame({ at: [ox, y0, front + 0.002] }, () => k.leaf({
        kind: 'lid', pivot: k.point([0, 0, 0]), axis: k.direction([1, 0, 0]), travel: 1.45, initial: 0,
        handle: k.point([0, oh - 0.06, 0.085]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
        center: k.point([0, oh / 2, 0.0175]), width: ow, height: oh, depth: 0.035, floor: k.point([0, 0.04, -0.3]),
      }, () => {
        k.box('steel', [ow, oh, 0.035], [0, oh / 2, 0.0175], { r: 0.006, tint: STAINLESS })
        k.box('glass', [ow * 0.6, oh * 0.38, 0.006], [0, oh * 0.55, 0.036], { r: 0.003, tint: [0.25, 0.22, 0.2] })
        k.handle([0, oh - 0.06, 0.035], ow * 0.75, { r: 0.012, standoff: 0.05 })
      }))
    }

    k.blk('steel', [w, 0.03, bd], 0, top - 0.03, bz, { r: 0.006, tint: [0.35, 0.35, 0.37] })
    const burners: V3[] = []
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) burners.push([-w / 3 + i * w / 3, top, bz - bd / 4 + j * bd / 2])
    for (const [x, y, z] of burners) {
      k.cyl('steel', 0.06, 0.02, [x, y + 0.01, z], { seg: 18, tint: DARK })
      k.cyl('steel', 0.035, 0.012, [x, y + 0.026, z], { seg: 14, tint: IRON })
      for (const o of [-0.14, 0.14]) {
        k.box('steel', [0.3, 0.02, 0.02], [x, y + 0.045, z + o], { r: 0.004, tint: IRON })
        k.box('steel', [0.02, 0.02, 0.26], [x + o, y + 0.045, z], { r: 0.004, tint: IRON })
      }
      k.box('steel', [0.26, 0.016, 0.016], [x, y + 0.045, z], { r: 0.003, tint: IRON })
      k.box('steel', [0.016, 0.016, 0.26], [x, y + 0.045, z], { r: 0.003, tint: IRON })
      for (const [fx, fz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) k.blk('steel', [0.02, 0.035, 0.02], x + fx, y, z + fz, { r: 0.004, tint: IRON })
    }
    const grate = top + 0.055, [b0, , , b3] = burners
    if (v === 2) pot(k, [b0[0], grate + 0.15 - 0.003, b0[2]], 0.15, 0.28, { roll: Math.PI / 2, yaw: 0.3 })
    else pot(k, [b0[0], grate, b0[2]], 0.15, 0.28, { lid: true })
    pot(k, [b3[0], grate, b3[2]], 0.1, 0.12, { tint: [0.3, 0.3, 0.32] })
    k.box('rubber', [0.2, 0.02, 0.03], [b3[0] + 0.19, grate + 0.1, b3[2]], { r: 0.008 })

    const hoodY = 1.72, wallZ = -d / 2 + 0.01
    k.blk('steel', [w, hoodY + 0.32 - top, 0.02], 0, top, wallZ, { r: 0.004, tint: [0.72, 0.73, 0.75] })
    if (v === 2) k.box('charcoal', [0.8, 0.4, 0.004], [-0.1, top + 0.4, wallZ + 0.0115], { r: 0.001 })
    const hood: V2[] = [[-d / 2 + 0.02, 0], [d / 2 - 0.02, 0], [d / 2 - 0.02, 0.08], [-d / 2 + 0.45, 0.32], [-d / 2 + 0.02, 0.32]]
    k.extrude('steel', hood.map(([z, y]) => [-z, y] as V2), w, [0, hoodY, 0], { axis: 'x', bevel: 0.006, tint: STAINLESS })
    for (let i = 0; i < 3; i++) {
      if (v === 2 && i === 2) continue
      const fx = (i - 1) * w / 3
      k.box('steel', [w / 3 - 0.04, 0.012, d - 0.22], [fx, hoodY - 0.005, 0], { r: 0.003, tint: [0.62, 0.62, 0.64] })
      k.vent([fx, hoodY - 0.0105, 0], w / 3 - 0.06, d - 0.26, { pitch: Math.PI / 2, slats: 10 })
    }
    k.box('steel', [w - 0.04, 0.03, 0.03], [0, hoodY - 0.014, d / 2 - 0.05], { r: 0.006, tint: [0.62, 0.62, 0.64] })
    k.blk('steel', [0.36, h - hoodY - 0.31, 0.3], 0, hoodY + 0.31, -d / 2 + 0.2, { r: 0.006, tint: [0.62, 0.63, 0.65] })
    if (v === 2) k.box('steel', [w / 3 - 0.04, 0.012, d - 0.22], [w / 3, grate + 0.005, bz], { yaw: 0.2, r: 0.003, tint: [0.62, 0.62, 0.64] })
  },

  'coffee-machine': (k, s) => {
    const { w, d } = k, v = s.variant, ch = 0.9, t = 0.018, top = ch
    carcass(k, 'wood', w, ch, d - 0.02, { plinth: 0.08, top: 0.035, topM: 'tile', overhang: 0.02, z: -0.01 })

    const front = d / 2 - 0.02, dh = ch - 0.035 - 0.083 + 0.001, dw = w / 2 - 0.003
    for (const sd of [-1, 1]) door(k, 'wood', dw, dh, [sd * (dw / 2 + 0.002), 0.083 + dh / 2, front], { style: 'shaker', hinge: sd as -1 | 1, handle: 'bar' })

    const mx = -w * 0.14, mz = -0.09, mw = 0.7, mh = 0.4, md = 0.48, my = top + 0.03, mfront = mz + md / 2
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.cyl('rubber', 0.02, 0.03, [mx + x * (mw / 2 - 0.05), top + 0.015, mz + z * (md / 2 - 0.05)], { seg: 10 })
    k.blk('steel', [mw, mh, md], mx, my, mz, { r: 0.02, tint: v === 1 ? [0.75, 0.15, 0.12] : STAINLESS })
    k.box('steel', [mw - 0.04, mh * 0.5, 0.012], [mx, my + mh * 0.62, mfront + 0.005], { r: 0.006, tint: CHROME })
    k.blk('steel', [mw - 0.08, 0.035, 0.2], mx, top, mfront + 0.098, { r: 0.006, tint: CHROME })
    for (let i = 0; i < 9; i++) k.box('steel', [0.008, 0.006, 0.18], [mx - (mw - 0.12) / 2 + i * (mw - 0.12) / 8, top + 0.038, mfront + 0.098], { r: 0.001, tint: DARK })
    for (const [i, gx] of [-0.17, 0.17].entries()) {
      const x = mx + gx, gy = my + mh * 0.42
      k.box('steel', [0.1, 0.08, 0.06], [x, gy + 0.02, mfront + 0.029], { r: 0.01, tint: CHROME })
      k.cyl('steel', 0.042, 0.05, [x, gy - 0.045, mfront + 0.045], { seg: 18, tint: CHROME })
      const loose = v === 2 && i === 0
      if (!loose) k.frame({ at: [x, gy - 0.085, mfront + 0.045] }, () => {
        k.cyl('steel', 0.038, 0.035, [0, 0.0175, 0], { seg: 18, tint: [0.7, 0.7, 0.72] })
        k.tube('rubber', [[0, 0.02, 0.03], [0, 0.03, 0.17]], 0.014, { seg: 10 })
      })
      if (v !== 2) cup(k, 0.032, 0.06, [x, top + 0.041, mfront + 0.045], { m: 'tile', tint: [0.95, 0.94, 0.9], handle: true, yaw: 1.4 })
    }
    gauge(k, [mx, my + mh * 0.72, mfront + 0.011], 0.035)
    k.knob([mx + mw / 2 - 0.06, my + mh * 0.62, mfront + 0.011], 0.02, { m: 'rubber' })
    k.tube('steel', [[mx + mw / 2 - 0.06, my + mh * 0.45, mfront - 0.005], [mx + mw / 2 - 0.04, my + mh * 0.45, mfront + 0.06], [mx + mw / 2 - 0.02, top + 0.09, mfront + 0.09]], 0.006, { seg: 8, fillet: 0.04, tint: CHROME })

    const ty = my + mh
    k.tube('steel', roundRect(mw - 0.08, md - 0.1, 0.04, ty + 0.035, 3).map(([x, y, z]) => [x + mx, y, z + mz] as V3), 0.006, { closed: true, seg: 8, tint: CHROME })
    for (const [x, z] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) k.cyl('steel', 0.006, 0.04, [mx + x * (mw - 0.08) / 2, ty + 0.02, mz + z * (md - 0.1) / 2], { seg: 8, tint: CHROME })
    for (let i = 0; i < (v === 1 ? 6 : 3); i++) cup(k, 0.03, 0.055, [mx - 0.24 + i * 0.095, ty, mz + (i % 2 ? 0.06 : -0.05)], { m: 'tile', tint: [0.95, 0.94, 0.9] })

    const gx = w / 2 - 0.2, gz = -0.06, hz = gz - 0.03
    k.blk('paint', [0.22, 0.12, 0.26], gx, top, gz, { r: 0.015, tint: DARK })
    k.blk('paint', [0.16, 0.28, 0.18], gx, top + 0.12, hz, { r: 0.02, tint: DARK })
    k.cyl('steel', 0.05, 0.03, [gx, top + 0.415, hz], { seg: 18, tint: CHROME })
    k.lathe('paint', [[0, 0], [0.043, 0], [0.068, 0.12], [0, 0.12]], [gx, top + 0.425, hz], { seg: 16, tint: [0.3, 0.18, 0.1] })
    k.lathe('glass', [[0, 0], [0.045, 0], [0.09, 0.2], [0, 0.2]], [gx, top + 0.43, hz], { seg: 18, tint: [0.6, 0.55, 0.5] })
    k.cyl('paint', 0.092, 0.03, [gx, top + 0.645, hz], { seg: 18, tint: DARK })
    k.box('steel', [0.05, 0.03, 0.06], [gx, top + 0.2, hz + 0.118], { r: 0.008, tint: CHROME })
    k.blk('rubber', [0.12, 0.1, 0.14], 0.26, top, 0.15, { r: 0.012 })
    k.cyl('steel', 0.008, 0.12, [0.26, top + 0.085, 0.15], { axis: 'x', seg: 8 })
    k.lathe('steel', [[0, 0], [0.04, 0], [0.042, 0.09], [0.036, 0.12], [0, 0.12]], [0.26, top, -0.12], { seg: 18, tint: CHROME })
    k.box('steel', [0.012, 0.07, 0.02], [0.26 + 0.046, top + 0.065, -0.12], { r: 0.004, tint: CHROME })
    if (v === 2) {

      k.frame({ at: [0.05, top, 0.22], yaw: 0.7 }, () => { k.cyl('steel', 0.038, 0.035, [0, 0.0175, 0], { seg: 18, tint: [0.7, 0.7, 0.72] }); k.tube('rubber', [[0, 0.016, 0.03], [0, 0.016, 0.17]], 0.014, { seg: 10 }) })
      for (const [x, z, yaw] of [[-0.45, 0.22, 0.4], [-0.4, 0.26, 1.9]] as const) k.box('tile', [0.04, 0.006, 0.03], [x, top + 0.006, z], { yaw, roll: 0.2, r: 0.001, tint: [0.95, 0.94, 0.9] })
      for (let i = 0; i < 16; i++) k.sphere('paint', 0.006, [gx - 0.05 + k.jitter(0.12), top + 0.004, 0.2 + k.jitter(0.08)], { rows: 4, seg: 6, scale: [1, 0.7, 0.8], tint: [0.3, 0.18, 0.1] })
    }
  },

  'bar-tap': (k, s) => {
    const { w, d } = k, v = s.variant, bodyH = 1.02, bd = d - 0.1, bz = -0.05, front = bz + bd / 2, top = bodyH + 0.05
    const wood: V3 = v === 1 ? [0.32, 0.2, 0.13] : [0.5, 0.33, 0.2], inset: V3 = [wood[0] * 0.85, wood[1] * 0.85, wood[2] * 0.85]
    k.blk('wood', [w, bodyH, bd], 0, 0, bz, { r: 0.006, tint: wood })

    const panels = Math.max(2, Math.round(w / 0.42)), pw = (w - 0.08) / panels, py = 0.23 + (bodyH - 0.3) / 2
    for (let i = 0; i < panels; i++) {
      const x = -w / 2 + 0.04 + (i + 0.5) * pw
      k.frameRect('wood', pw - 0.03, bodyH - 0.3, 0.035, 0.016, [x, py, front + 0.008], { tint: wood })
      k.box('wood', [pw - 0.09, bodyH - 0.36, 0.008], [x, py, front + 0.004], { tint: inset })
    }
    k.blk('rubber', [w - 0.02, 0.1, 0.01], 0, 0, front + 0.005, { r: 0.003 })
    const railZ = front + 0.12, railY = 0.22
    k.cyl('steel', 0.025, w - 0.1, [0, railY, railZ], { axis: 'x', seg: 16, tint: BRASS })
    for (let i = 1; i < panels; i++) {
      const x = -w / 2 + 0.04 + i * pw
      k.tube('steel', [[x, railY + 0.09, front + 0.008], [x, railY + 0.09, railZ - 0.03], [x, railY + 0.01, railZ]], 0.012, { seg: 8, fillet: 0.03, tint: BRASS })
      k.cyl('steel', 0.03, 0.01, [x, railY + 0.09, front + 0.005], { axis: 'z', seg: 14, tint: BRASS })
    }

    k.blk('wood', [w + 0.04, 0.05, d], 0, bodyH, 0, { r: 0.008, tint: wood })
    k.cyl('wood', 0.03, w + 0.04, [0, bodyH + 0.025, d / 2], { axis: 'x', seg: 14, tint: wood })
    const tz = -0.12, TB = top + 0.36, TZ = tz + 0.06
    k.blk('steel', [0.7, 0.02, 0.16], 0, top, tz - 0.06, { r: 0.004, tint: STAINLESS })
    for (let i = 0; i < 12; i++) k.box('steel', [0.006, 0.004, 0.14], [-0.33 + i * 0.06, top + 0.022, tz - 0.06], { r: 0.001, tint: DARK })
    k.cyl('steel', 0.06, 0.012, [0, top + 0.006, TZ], { seg: 18, tint: CHROME })
    k.cyl('steel', 0.04, 0.32, [0, top + 0.16, TZ], { seg: 16, tint: CHROME })
    k.cyl('steel', 0.045, 0.62, [0, TB, TZ], { axis: 'x', seg: 18, tint: CHROME })
    const taps = v === 1 ? 5 : 4, brands: V3[] = [[0.8, 0.15, 0.1], [0.15, 0.3, 0.6], [0.9, 0.7, 0.2], [0.15, 0.15, 0.15], [0.2, 0.5, 0.25]]
    for (let i = 0; i < taps; i++) {
      const x = -0.24 + i * 0.48 / (taps - 1)
      k.cyl('steel', 0.018, 0.07, [x, TB, TZ - 0.07], { axis: 'z', seg: 12, tint: CHROME })
      k.cyl('steel', 0.01, 0.07, [x, TB - 0.05, TZ - 0.095], { seg: 10, tint: CHROME })
      if (v === 2 && i === 1) { k.cyl('rubber', 0.012, 0.03, [x, TB + 0.03, TZ - 0.08], { seg: 10 }); continue }
      k.lathe('paint', [[0, 0], [0.012, 0], [0.012, 0.02], [0.02, 0.06], [0.024, 0.16], [0.016, 0.18], [0, 0.18]], [x, TB + 0.015, TZ - 0.08], { seg: 12, tint: brands[i] })
    }

    const pint = (at: V3, full: boolean) => {
      k.lathe('glass', [[0, 0], [0.032, 0], [0.042, 0.15], [0.039, 0.15], [0.029, 0.006], [0, 0.006]], at, { seg: 18 })
      if (!full) return
      k.lathe('paint', [[0, 0.006], [0.029, 0.006], [0.0374, 0.13], [0, 0.13]], at, { seg: 18, tint: [0.85, 0.55, 0.15] })
      k.lathe('paint', [[0, 0.13], [0.0374, 0.13], [0.0385, 0.148], [0, 0.152]], at, { seg: 18, tint: [0.98, 0.95, 0.88] })
    }
    k.blk('rubber', [0.42, 0.008, 0.14], -w * 0.3, top, -0.2, { r: 0.003, tint: [0.15, 0.15, 0.15] })
    for (let i = 0; i < (v === 2 ? 1 : 3); i++) pint([-w * 0.3 - 0.12 + i * 0.12, top + 0.008, -0.2], false)
    if (v !== 2) pint([w * 0.3, top, 0.2], true)
    else {
      for (const [x, z, yaw] of [[w * 0.3, 0.2, 0.3], [w * 0.3 + 0.06, 0.24, 1.7], [w * 0.3 - 0.04, 0.16, 2.6]] as const) k.box('glass', [0.04, 0.004, 0.025], [x, top + 0.002, z], { yaw, r: 0 })
      k.cyl('paint', 0.14, 0.002, [w * 0.2, top + 0.001, 0.15], { seg: 20, tint: [0.7, 0.45, 0.12], scale: [1.4, 1, 1] })
    }

    const doorW = (w - 0.1) / 4, doorH = 0.42, doorY = 0.12 + doorH / 2, rear = bz - bd / 2
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + 0.05 + (i + 0.5) * doorW
      k.box('rubber', [doorW - 0.03, doorH - 0.03, 0.002], [x, doorY, rear - 0.001], { r: 0, tone: 0.2 })
      door(k, 'wood', doorW - 0.008, doorH, [x, doorY, rear], { yaw: Math.PI, style: 'shaker', handle: 'knob', hinge: i % 2 ? -1 : 1, tint: wood })
    }
    k.blk('steel', [0.9, 0.012, 0.07], 0, 0.6, -d / 2 - 0.033, { r: 0.003, tint: STAINLESS })
    k.blk('steel', [0.9, 0.06, 0.006], 0, 0.6, -d / 2 - 0.065, { r: 0.002, tint: STAINLESS })
    for (let i = 0; i < 6; i++) if (!(v === 2 && i % 2)) bottle(k, 0.028, 0.3, [-0.36 + i * 0.144, 0.612, -d / 2 - 0.034], { tint: [[0.2, 0.35, 0.15], [0.45, 0.25, 0.1], [0.85, 0.85, 0.8]][i % 3] as V3 })
  },

  'pizza-oven': (k, s) => {
    const { w, h, d } = k, v = s.variant, baseH = 0.95, ow = w * 0.55, oh = 0.62, wallT = (w - ow) / 2
    const brick: V3 = v === 1 ? [0.75, 0.55, 0.45] : [0.7, 0.4, 0.3]

    for (const sd of [-1, 1]) k.blk('brick', [wallT, baseH, d], sd * (w / 2 - wallT / 2), 0, 0, { r: 0.01, tint: brick })
    k.blk('brick', [ow, baseH, 0.16], 0, 0, -d / 2 + 0.08, { r: 0.01, tint: brick })
    k.blk('brick', [ow, baseH - oh, d - 0.16], 0, oh, 0.08, { r: 0.01, tint: brick })
    k.blk('concrete', [w + 0.04, 0.1, d + 0.02], 0, baseH, 0, { r: 0.01, tint: [0.75, 0.73, 0.7] })
    const lr = 0.055, logs = Math.floor((ow - 0.04) / (lr * 1.75))
    for (let row = 0; row < 3; row++) for (let i = 0; i < logs - row; i++) {
      if (v === 2 && row === 2) continue
      const x = -(logs - 1 - row) * lr * 0.875 + i * lr * 1.75
      k.cyl('wood', lr * (0.97 + k.rnd() * 0.06), 0.5, [x, lr * 0.95 + row * lr * 1.55, 0.15 + k.jitter(0.03)], { axis: 'z', seg: 10, tint: [0.55, 0.4, 0.28] })
    }

    const hy = baseH + 0.1, dz = -0.15, dr = Math.min(w, d) / 2 - 0.12, dh = dr * 0.95
    k.lathe(v === 1 ? 'plaster' : 'brick', [[0, 0], [dr, 0], [dr * 0.99, dh * 0.22], [dr * 0.92, dh * 0.48], [dr * 0.76, dh * 0.72], [dr * 0.48, dh * 0.92], [0, dh]], [0, hy, dz], { seg: 28, tint: v === 1 ? [0.9, 0.87, 0.82] : brick, crease: 70 })
    const tz = dz + dr - 0.08, th2 = 0.5, td2 = 0.24, mouth = tz + td2 - 0.04

    k.blk('brick', [0.72, th2 + 0.005, td2], 0, hy - 0.005, tz + td2 / 2 - 0.04, { r: 0.01, tint: brick })
    k.extrude('charcoal', [[-0.22, 0], [0.22, 0], ...arc(0, 0.2, 0.22, 0, Math.PI, 12)], 0.02, [0, hy, mouth - 0.005], { bevel: 0.002 })
    for (let i = 0; i <= 8; i++) {
      const a = i / 8 * Math.PI
      k.box('brick', [0.07, 0.045, 0.03], [Math.cos(a) * 0.26, hy + 0.2 + Math.sin(a) * 0.26, mouth + 0.008], { roll: a - Math.PI / 2, r: 0.004, tint: [brick[0] * 0.9, brick[1] * 0.85, brick[2] * 0.85] })
    }
    const chimH = h - 0.06 - (hy + th2) - (v === 2 ? 0.25 : 0), chimZ = mouth - 0.15
    k.blk('brick', [0.3, chimH, 0.3], 0, hy + th2, chimZ, { r: 0.008, tint: brick })
    if (v !== 2) k.blk('concrete', [0.36, 0.06, 0.36], 0, hy + th2 + chimH, chimZ, { r: 0.008, tint: [0.7, 0.68, 0.65] })
    else k.box('charcoal', [0.2, 0.2, 0.004], [0, hy + th2 + chimH * 0.5, mouth + 0.0015], { r: 0.001 })

    k.frame({ at: [0.5, hy, 0.64] }, () => {
      k.box('steel', [0.26, 0.004, 0.13], [0, 0.002, 0], { r: 0.001, tint: [0.7, 0.7, 0.72] })
      k.cyl('wood', 0.014, 1.0, [-0.62, 0.0128, 0], { axis: 'x', seg: 10, tint: [0.62, 0.46, 0.3] })
      if (v === 0) { k.cyl('paper', 0.075, 0.012, [0, 0.01, 0], { seg: 20, tint: [0.92, 0.82, 0.6] }); k.cyl('paint', 0.064, 0.004, [0, 0.018, 0], { seg: 20, tint: [0.75, 0.18, 0.1] }) }
    })
    if (v === 2) for (const [x, z, yaw] of [[0.66, -0.5, 0.3], [0.6, -0.36, 1.2], [-0.66, -0.55, 2.1]] as const) k.blk('brick', [0.2, 0.06, 0.1], x, hy, z, { yaw, r: 0.006, tint: brick })
  },

  'ice-cream-case': (k, s) => {
    const { w, d } = k, v = s.variant, baseH = 0.85, shell: V3 = v === 1 ? [0.92, 0.75, 0.78] : [0.9, 0.9, 0.88]
    k.blk('paint', [w, baseH, d], 0, 0, 0, { r: 0.01, tint: shell })
    k.blk('rubber', [w - 0.02, 0.08, 0.012], 0, 0, d / 2 + 0.005, { r: 0.003 })
    k.vent([0, 0.2, d / 2], w * 0.5, 0.12, { slats: 6 })

    const wellD = d - 0.24, wz = -0.02, cols = 5, tw = (w - 0.12) / cols, tdp = wellD / 2 - 0.02, y = baseH + 0.02
    k.blk('steel', [w - 0.06, 0.02, wellD], 0, baseH, wz, { r: 0.004, tint: STAINLESS })
    const flavours: V3[] = [[0.98, 0.93, 0.8], [0.45, 0.28, 0.18], [0.95, 0.55, 0.6], [0.6, 0.85, 0.55], [0.98, 0.85, 0.35], [0.7, 0.45, 0.75], [0.92, 0.92, 0.9], [0.95, 0.5, 0.25], [0.55, 0.75, 0.9], [0.35, 0.2, 0.12]]
    for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, x = -(w - 0.12) / 2 + (c + 0.5) * tw, z = wz + (r - 0.5) * (tdp + 0.02)
      if (v === 2 && (i === 3 || i === 7)) continue
      k.blk('steel', [tw - 0.012, 0.1, tdp], x, y, z, { r: 0.004, tint: [0.75, 0.76, 0.78] })
      k.sphere('paper', tw * 0.42, [x, y + 0.1, z], { rows: 6, seg: 12, scale: [1, v === 2 ? 0.22 : 0.55, tdp / tw * 0.95], tint: flavours[i], tone: 0.95 + k.rnd() * 0.1 })
    }

    const gc: V2 = [d / 2 - 0.38, baseH + 0.01], gr = 0.35, shelfY = gc[1] + gr - 0.002
    k.blk('steel', [w - 0.06, 0.03, 0.04], 0, baseH, d / 2 - 0.034, { r: 0.006, tint: CHROME })
    for (let c = 0; c < cols; c++) k.label([-(w - 0.12) / 2 + (c + 0.5) * tw, baseH + 0.015, d / 2 - 0.0132], 0.08, 0.018)
    if (v !== 2) k.extrude('glass', [...arc(gc[0], gc[1], gr, 0, Math.PI / 2, 12), ...arc(gc[0], gc[1], gr - 0.008, Math.PI / 2, 0, 12)].map(([z, yy]) => [-z, yy] as V2), w - 0.04, [0, 0, 0], { axis: 'x', tint: [0.85, 0.9, 0.92] })
    else for (let i = 0; i < 5; i++) k.box('glass', [0.05, 0.004, 0.035], [-0.5 + i * 0.25, baseH + 0.002, 0.3 + k.jitter(0.01)], { yaw: k.rnd() * 3, r: 0 })
    for (const sd of [-1, 1]) k.extrude('glass', [gc, ...arc(gc[0], gc[1], gr, 0, Math.PI / 2, 12)].map(([z, yy]) => [-z, yy] as V2), 0.01, [sd * (w / 2 - 0.015), 0, 0], { axis: 'x', tint: [0.85, 0.9, 0.92] })
    for (const sd of [-1, 1]) k.blk('steel', [0.03, shelfY - baseH, 0.03], sd * (w / 2 - 0.015), baseH, -d / 2 + 0.015, { r: 0.004, tint: CHROME })
    k.blk('steel', [w, 0.03, d / 2 + gc[0] + 0.005], 0, shelfY, (gc[0] + 0.005 - d / 2) / 2, { r: 0.006, tint: STAINLESS })

    for (const [i, sd] of [-1, 1].entries()) {
      k.box('glass', [w / 2 - 0.05, shelfY - baseH, 0.006], [sd * (w / 4 - 0.01), baseH + (shelfY - baseH) / 2, -d / 2 + 0.008 + i * 0.008], { r: 0.001 })
      k.box('steel', [0.012, 0.08, 0.012], [sd * 0.1, baseH + 0.2, -d / 2 + i * 0.008], { r: 0.003, tint: CHROME })
    }

    const top = shelfY + 0.03
    for (let i = 0; i < 3; i++) {
      const x = -w * 0.3 + i * 0.12
      k.cyl('steel', 0.045, 0.06, [x, top + 0.03, -0.2], { seg: 16, tint: CHROME })
      k.lathe('paper', [[0, 0], [0.01, 0], [0.026, 0.1], [0.03, 0.1], [0.03, 0.115], [0.034, 0.115], [0.034, 0.13], [0.038, 0.13], [0.038, 0.145], [0, 0.145]], [x, top + 0.02, -0.2], { seg: 14, tint: [0.85, 0.65, 0.38] })
    }
    k.cyl('steel', 0.07, 0.09, [w * 0.25, top + 0.045, -0.2], { seg: 18, tint: CHROME })
    k.frame({ at: [w * 0.25, top + 0.09, -0.2], roll: 0.5 }, () => { k.sphere('steel', 0.025, [0, 0, 0], { rows: 5, seg: 10, tint: CHROME }); k.tube('steel', [[0, 0.02, 0], [0, 0.17, 0]], 0.008, { seg: 8, tint: DARK }) })
    if (v === 2) k.box('paint', [0.3, 0.003, 0.06], [-0.2, baseH + 0.0015, d / 2 - 0.09], { r: 0.001, tint: flavours[2] })
  },

  'tea-counter': (k, s) => {
    const { w, d } = k, v = s.variant, ch = 0.86, t = 0.018, top = ch
    carcass(k, 'wood', w, ch, d - 0.02, { plinth: 0.08, top: 0.035, overhang: 0.02, z: -0.01 })

    const front = d / 2 - 0.02, iw = w - 2 * t, cols = 4, rows = 3, dwid = iw / cols, dht = (ch - 0.035 - 0.08 - t) / rows

    k.blk('wood', [iw, ch - 0.035 - 0.08 - t, 0.012], 0, 0.08 + t, front - 0.006, { tint: [0.3, 0.22, 0.16] })
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (v === 2 && r * cols + c === 6) continue
      drawer(k, 'wood', dwid - 0.006, dht - 0.006, [-iw / 2 + (c + 0.5) * dwid, 0.08 + t + (r + 0.5) * dht, front], { handle: 'cup', label: true })
    }

    const sz = -d / 2 + 0.12, tints: V3[] = [[0.6, 0.15, 0.12], [0.15, 0.35, 0.25], [0.75, 0.6, 0.25], [0.2, 0.25, 0.45], [0.5, 0.3, 0.2], [0.85, 0.82, 0.75]]
    k.blk('wood', [w - 0.06, 0.12, 0.2], 0, top, sz, { r: 0.006 })
    k.blk('wood', [w - 0.06, 0.12, 0.1], 0, top + 0.12, sz - 0.05, { r: 0.006 })
    for (const [row, y, z, r, hh] of [[0, top + 0.12, sz + 0.05, 0.042, 0.12], [1, top + 0.24, sz - 0.05, 0.038, 0.14]] as const) {
      const n = Math.floor((w - 0.12) / (2 * r + 0.025))
      for (let i = 0; i < n; i++) {
        const x = -(n - 1) / 2 * (2 * r + 0.025) + i * (2 * r + 0.025)
        if (v === 2 && (i + row) % 3 === 1) continue
        tin(k, r, hh, [x, y, z], { tint: tints[(i + row * 2) % tints.length] })
      }
    }

    const ux = -w / 2 + 0.22, uz = 0.08
    k.lathe('steel', [[0, 0], [0.09, 0], [0.07, 0.04], [0.06, 0.06], [0.12, 0.1], [0.14, 0.2], [0.13, 0.34], [0.09, 0.4], [0.05, 0.42], [0.05, 0.46], [0, 0.46]], [ux, top, uz], { seg: 24, tint: BRASS, crease: 50 })
    k.lathe('steel', [[0, 0], [0.05, 0], [0.03, 0.03], [0.012, 0.05], [0.015, 0.07], [0, 0.07]], [ux, top + 0.46, uz], { seg: 16, tint: BRASS })
    k.tube('steel', [[ux, top + 0.12, uz + 0.11], [ux, top + 0.12, uz + 0.18], [ux, top + 0.09, uz + 0.2]], 0.008, { seg: 8, fillet: 0.02, tint: BRASS })
    for (const sd of [-1, 1]) k.torus('steel', 0.035, 0.006, [ux + sd * 0.128, top + 0.3, uz], { axis: 'z', arc: Math.PI, roll: sd > 0 ? 0 : Math.PI, segR: 10, seg: 5, tint: DARK })

    const glaze: V3 = v === 1 ? [0.85, 0.82, 0.75] : [0.25, 0.45, 0.55], px = 0.05, pz = 0.12
    if (v !== 2) {
      k.lathe('tile', [[0, 0], [0.06, 0], [0.085, 0.04], [0.09, 0.08], [0.07, 0.12], [0.04, 0.13], [0, 0.13]], [px, top, pz], { seg: 20, tint: glaze })
      k.cyl('tile', 0.015, 0.03, [px, top + 0.14, pz], { seg: 10, tint: glaze })
      k.tube('tile', [[px + 0.06, top + 0.05, pz], [px + 0.11, top + 0.09, pz], [px + 0.13, top + 0.13, pz]], 0.012, { seg: 8, taper: 0.6, fillet: 0.02, tint: glaze })
      k.torus('tile', 0.04, 0.008, [px - 0.07, top + 0.07, pz], { axis: 'z', arc: Math.PI, roll: Math.PI, segR: 10, seg: 5, tint: glaze })
    } else for (const [x, z, yaw] of [[px, pz, 0.4], [px + 0.07, pz + 0.04, 1.6], [px - 0.05, pz + 0.06, 2.8]] as const) k.box('tile', [0.05, 0.006, 0.035], [x, top + 0.003, z], { yaw, r: 0.001, tint: glaze })
    for (let i = 0; i < 3; i++) {
      const x = 0.25 + i * 0.13, z = 0.16
      k.cyl('tile', 0.06, 0.008, [x, top + 0.004, z], { seg: 20, tint: [0.95, 0.94, 0.9] })
      if (!(v === 2 && i === 1)) cup(k, 0.035, 0.05, [x, top + 0.008, z], { m: 'tile', tint: [0.95, 0.94, 0.9], handle: true, yaw: 0.6 })
    }
    if (v !== 2) {
      const sx = w / 2 - 0.16, szc = -0.02
      k.blk('paint', [0.18, 0.05, 0.14], sx, top, szc, { r: 0.01, tint: [0.85, 0.83, 0.78] })
      k.cyl('steel', 0.01, 0.03, [sx, top + 0.065, szc], { seg: 8 })
      k.cyl('steel', 0.09, 0.012, [sx, top + 0.086, szc], { seg: 22, tint: CHROME })
      gauge(k, [sx, top + 0.025, szc + 0.07], 0.018)
    } else for (let i = 0; i < 20; i++) k.box('straw', [0.008, 0.002, 0.004], [-0.1 + k.jitter(0.25), top + 0.001, 0.05 + k.jitter(0.1)], { yaw: k.rnd() * 3, r: 0, tint: [0.25, 0.2, 0.12] })
  },
}
