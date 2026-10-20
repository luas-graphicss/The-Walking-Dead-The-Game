import { roundRect, type Family, type Kit, type Mat, type V2, type V3 } from '../kit'
import { carcass, door, drawer, mattress, pillow, products, shelfBoard } from './common'
import { piping } from './seating'
import { basin, crt, rrect } from './appliances'

function starBase(k: Kit, R: number, at: V3, m: Mat = 'steel') {
  k.frame({ at }, () => {
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + Math.PI / 2
      k.box(m, [R, 0.025, 0.035], [Math.cos(a) * R / 2, 0.07, Math.sin(a) * R / 2], { yaw: -a, roll: -0.05, r: 0.008 })
      k.caster([Math.cos(a) * (R - 0.005), 0, Math.sin(a) * (R - 0.005)], 0.025, { yaw: -a })
    }
    k.lathe(m, [[0, 0], [0.04, 0], [0.045, 0.025], [0.025, 0.05], [0, 0.05]], [0, 0.055, 0], { seg: 18 })
  })
}
function chairShell(k: Kit, at: V3, w: number, seatD: number, backH: number, o: { recline?: number; m?: Mat; legrest?: number; headrest?: boolean } = {}) {
  const m = o.m ?? 'leather'
  k.frame({ at }, () => {
    k.cushion(m, [w, 0.11, seatD], [0, 0, 0], { puff: 0.025 })
    piping(k, m, [0, 0.03, 0], w - 0.03, seatD - 0.03, { r: 0.0045 })
    k.frame({ at: [0, 0.03, -seatD / 2 + 0.02], pitch: -(o.recline ?? 0.25) }, () => {
      k.cushion(m, [w, backH, 0.11], [0, backH / 2, -0.03], { puff: 0.025 })
      if (o.headrest) k.cushion(m, [w * 0.5, 0.16, 0.1], [0, backH + 0.11, -0.03], { puff: 0.03 })
    })
    if (o.legrest) k.frame({ at: [0, 0.0, seatD / 2 - 0.02], pitch: 0.55 }, () => k.cushion(m, [w * 0.92, 0.09, o.legrest!], [0, 0, o.legrest! / 2], { puff: 0.02 }))
  })
}

export const SERVICES: Family = {
  'ct-scanner': (k, s) => {
    const { w, h, d } = k, v = s.variant, gz = -d / 2 + 0.45, gw = w - 0.06, gh = h - 0.05, boreY = gh * 0.5, R = Math.min(0.36, gh * 0.2)
    const hole: V2[] = Array.from({ length: 40 }, (_, i) => [Math.cos(i / 40 * Math.PI * 2) * R, boreY + Math.sin(i / 40 * Math.PI * 2) * R] as V2)
    k.extrude('tile', rrect(gw, gh, 0.18).map(([x, y]) => [x, y + gh / 2] as V2), 0.8, [0, 0.03, gz], { holes: [hole.reverse()], bevel: 0.03, bevelSeg: 3, curveSeg: 10, tint: [0.95, 0.96, 0.97] })
    k.torus('tile', R + 0.04, 0.025, [0, 0.03 + boreY, gz + 0.4], { axis: 'z', segR: 48, seg: 10, tint: [0.6, 0.7, 0.85] })
    k.blk('tile', [gw - 0.04, 0.03, 0.9], 0, 0, gz, { r: 0.01, tint: [0.75, 0.76, 0.78] })
    for (const x of [-1, 1]) k.frame({ at: [x * (R + 0.18), 0.03 + boreY + 0.12, gz + 0.405] }, () => { k.box('tile', [0.16, 0.12, 0.02], [0, 0, 0], { r: 0.01, tint: [0.3, 0.32, 0.35] }); k.screen([0, 0, 0.01], 0.13, 0.09, { bezel: 0.008 }); for (let i = 0; i < 4; i++) k.cyl('paint', 0.008, 0.008, [-0.05 + i * 0.033, -0.08, 0.008], { axis: 'z', seg: 10, tint: k.pick([[0.9, 0.2, 0.2], [0.2, 0.7, 0.3], [0.9, 0.8, 0.2]] as V3[]) }) })
    k.box('tile', [0.5, 0.65, d - 1.0], [0, 0.325, d / 2 - (d - 1.0) / 2 - 0.05], { r: 0.04, tint: [0.92, 0.93, 0.94] })
    const ext = v === 0 ? 0 : v === 1 ? 0.35 : 0.7
    k.box('tile', [0.52, 0.06, d - 0.6], [0, 0.69, d / 2 - (d - 0.6) / 2 - ext * 0.5 - 0.02], { r: 0.02, tint: [0.85, 0.86, 0.88] })
    mattress(k, 'fabric', [0.46, 0.07, d - 0.75], [0, 0.755, d / 2 - (d - 0.75) / 2 - ext * 0.5 - 0.06], {})
    pillow(k, 'fabric', 0.3, 0.25, [0, 0.82, gz + 0.65 - ext * 0.5], { tint: [0.9, 0.95, 1] })
    for (const sgn of [-1, 1]) k.box('fabric', [0.06, 0.012, 0.5], [sgn * 0.2, 0.795, 0.2], { r: 0.003, tint: [0.2, 0.3, 0.6] })
    for (let i = 0; i < 4; i++) k.cable('rubber', [-gw / 2 + 0.3 + i * 0.1, 0.4, gz - 0.4], [-gw / 2 + 0.25 + i * 0.12, 0.01, gz - 0.42 - i * 0.003], 0.05, 0.012)
  },
  'iv-stand': (k, s) => {
    const { w, h } = k, v = s.variant
    starBase(k, Math.min(0.3, w / 2 - 0.02), [0, 0, 0])
    k.cyl('steel', 0.014, h * 0.55, [0, 0.1 + h * 0.275, 0], { seg: 14 })
    k.cyl('steel', 0.019, 0.05, [0, 0.1 + h * 0.55, 0], { seg: 14 })
    k.cyl('steel', 0.0095, h * 0.42, [0, 0.1 + h * 0.55 + h * 0.21, 0], { seg: 12 })
    const top = h - 0.02
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.tube('steel', [[0, top, 0], [Math.cos(a) * 0.14, top + 0.01, Math.sin(a) * 0.14], [Math.cos(a) * 0.16, top - 0.04, Math.sin(a) * 0.16], [Math.cos(a) * 0.155, top - 0.055, Math.sin(a) * 0.155]], 0.004, { fillet: 0.015, seg: 6 }) }
    for (let i = 0; i < 1 + v; i++) {
      const a = i * Math.PI / 2, x = Math.cos(a) * 0.155, z = Math.sin(a) * 0.155
      k.cushion('glass', [0.12, 0.2, 0.03], [x, top - 0.18, z], { yaw: -a + Math.PI / 2, puff: 0.012, tint: [0.85, 0.92, 0.95] })
      k.label([x + Math.cos(a) * 0.016, top - 0.17, z + Math.sin(a) * 0.016], 0.07, 0.06, { yaw: -a + Math.PI / 2 })
      k.cable('glass', [x, top - 0.29, z], [0.03, 0.6, 0.05], 0.05, 0.0018)
    }
    k.frame({ at: [0, h * 0.55, 0.035] }, () => { k.box('tile', [0.13, 0.16, 0.08], [0, 0, 0], { r: 0.012, tint: [0.9, 0.9, 0.88] }); k.screen([0, 0.03, 0.04], 0.09, 0.05, { bezel: 0.006 }); for (let i = 0; i < 3; i++) k.cyl('paint', 0.007, 0.006, [-0.03 + i * 0.03, -0.04, 0.041], { axis: 'z', seg: 10, tint: [0.3, 0.6, 0.9] }); k.box('steel', [0.03, 0.04, 0.05], [0, 0, -0.06], { r: 0.006 }) })
  },
  'patient-monitor': (k, s) => {
    const { w, h, d } = k, v = s.variant
    starBase(k, Math.min(0.27, Math.min(w, d) / 2 - 0.02), [0, 0, 0])
    k.cyl('steel', 0.018, h - 0.5, [0, 0.1 + (h - 0.5) / 2, 0], { seg: 14 })
    k.box('steel', [0.3, 0.02, 0.22], [0, 0.6, 0.02], { r: 0.006 })
    for (let i = 0; i < 6; i++) k.cyl('steel', 0.003, 0.08, [-0.13 + i * 0.052, 0.65, 0.12], { seg: 6 })
    k.tube('steel', roundRect(0.3, 0.22, 0.03, 0.69, 3).map(([x, y, z]) => [x, y, z + 0.02] as V3), 0.004, { closed: true, seg: 6 })
    const mw = Math.min(w * 0.75, 0.42), mh = mw * 0.75
    k.frame({ at: [0, h - mh / 2 - 0.02, 0.0], pitch: -0.08 }, () => {
      k.box('tile', [mw, mh, 0.09], [0, 0, 0], { r: 0.02, tint: [0.88, 0.88, 0.86] })
      k.screen([0, 0.02, 0.045], mw - 0.06, mh - 0.1, { bezel: 0.01 })
      const colors: V3[] = [[0.2, 0.95, 0.3], [0.95, 0.85, 0.2], [0.3, 0.8, 0.95]]
      for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) { const x = -mw / 2 + 0.06 + i * (mw - 0.16) / 12, y = 0.06 - r * 0.05 + (i % 4 === 2 ? 0.02 : 0); k.box('paint', [(mw - 0.16) / 12 + 0.002, 0.003, 0.002], [x, y, 0.071], { roll: (i % 4 === 1 ? 0.8 : i % 4 === 2 ? -0.8 : 0), r: 0, tint: colors[r] }) }
      for (let i = 0; i < 5; i++) k.cyl('rubber', 0.007, 0.008, [-mw / 2 + 0.05 + i * 0.04, -mh / 2 + 0.03, 0.046], { axis: 'z', seg: 10 })
      k.handle([0, mh / 2 + 0.005, 0], mw * 0.5, { pitch: -Math.PI / 2, r: 0.007, standoff: 0.025, m: 'tile' })
    })
    for (let i = 0; i < 3 + v; i++) k.cable('rubber', [-mw / 2 + 0.05 + i * 0.03, h - mh - 0.02, 0.03], [-0.1 + i * 0.05, 0.62, 0.12], 0.25, 0.0025)
  },
  'exam-table': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.72
    const inner = carcass(k, 'steel', w - 0.04, top - 0.08, d - 0.3, { plinth: 0.06, z: 0.05 })
    for (let i = 0; i < 3; i++) drawer(k, 'steel', inner * 0.5, 0.15, [-inner * 0.22, 0.08 + 0.09 + i * 0.17, 0.05 + (d - 0.3) / 2], { handle: 'bar', label: true })
    door(k, 'steel', inner * 0.46, top - 0.22, [inner * 0.26, 0.07 + (top - 0.22) / 2, 0.05 + (d - 0.3) / 2], { style: 'flat', hinge: 1, handle: 'bar' })
    k.blk('steel', [w - 0.08, 0.04, 0.35], 0, 0.22, d / 2 - 0.18, { r: 0.006 })
    k.blk('rubber', [w - 0.12, 0.008, 0.3], 0, 0.26, d / 2 - 0.18, { r: 0.003 })
    k.box('steel', [w, 0.05, d - 0.2], [0, top - 0.055, 0.05], { r: 0.01 })
    k.cushion('leather', [w - 0.04, 0.08, d * 0.62], [0, top + 0.01, d / 2 - d * 0.31 - 0.05], { puff: 0.018 })
    const back = [0.25, 0.6, 0.9][v]
    k.frame({ at: [0, top - 0.03, -d / 2 + d * 0.38], pitch: -back }, () => { k.box('steel', [w - 0.04, 0.03, d * 0.34], [0, 0, -d * 0.17], { r: 0.008 }); k.cushion('leather', [w - 0.04, 0.08, d * 0.34], [0, 0.05, -d * 0.17], { puff: 0.018 }) })
    k.cyl('paper', 0.05, w * 0.7, [0, top + 0.03, d / 2 - 0.03], { axis: 'x', seg: 18, tint: [0.98, 0.98, 0.96] })
    for (const x of [-1, 1]) k.box('steel', [0.015, 0.08, 0.05], [x * w * 0.37, top + 0.0, d / 2 - 0.03], { r: 0.004 })
    k.box('paper', [w * 0.6, 0.002, d * 0.55], [0, top + 0.052, d / 2 - d * 0.28 - 0.06], { r: 0, tint: [0.98, 0.98, 0.96] })
  },
  'dental-chair': (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.lathe('steel', [[0, 0], [0.32, 0], [0.33, 0.03], [0.2, 0.05], [0.09, 0.08], [0.08, 0.35], [0, 0.35]], [0, 0, 0.1], { seg: 32, scale: [1, 1, 1.3], tint: [0.9, 0.9, 0.9] })
    k.box('steel', [0.3, 0.08, 0.4], [0, 0.4, 0.1], { r: 0.02 })
    chairShell(k, [0, 0.5, 0.1], w * 0.55, 0.5, 0.62, { recline: [0.35, 0.7, 1.05][v], legrest: 0.45, headrest: true })
    for (const x of [-1, 1]) { k.tube('steel', [[x * w * 0.3, 0.45, 0.05], [x * w * 0.32, 0.62, 0.0], [x * w * 0.32, 0.62, 0.3]], 0.012, { fillet: 0.05 }); k.box('leather', [0.07, 0.04, 0.28], [x * w * 0.32, 0.645, 0.15], { r: 0.015 }) }
    const px = w / 2 - 0.12, pz = -d / 2 + 0.25
    k.cyl('steel', 0.035, h - 0.1, [px, (h - 0.1) / 2, pz], { seg: 16, tint: [0.92, 0.92, 0.92] })
    k.tube('steel', [[px, h - 0.12, pz], [px - 0.25, h - 0.05, pz + 0.2], [px - 0.45, h - 0.05, pz + 0.45]], 0.02, { fillet: 0.08 })
    k.frame({ at: [px - 0.45, h - 0.12, pz + 0.48], pitch: 0.6 }, () => { k.box('tile', [0.3, 0.1, 0.1], [0, 0, 0], { r: 0.04, tint: [0.92, 0.92, 0.9] }); k.box('glass', [0.24, 0.06, 0.01], [0, -0.04, 0.03], { pitch: -Math.PI / 2 + 0.3, r: 0.01, tint: [1, 1, 0.9] }) })
    k.lathe('tile', [[0, 0], [0.04, 0], [0.13, 0.08], [0.14, 0.1], [0.12, 0.1], [0.03, 0.03], [0, 0.03]], [px - 0.02, 0.62, pz + 0.1], { seg: 24, tint: [0.85, 0.9, 0.95] })
    k.tube('steel', [[px - 0.09, 0.62, pz + 0.1], [px - 0.09, 0.75, pz + 0.1], [px - 0.03, 0.78, pz + 0.1]], 0.006, { fillet: 0.02 })
    k.tube('steel', [[-px, 0.55, pz + 0.4], [-px + 0.1, 0.75, pz + 0.5], [-px + 0.25, 0.85, pz + 0.6]], 0.012, { fillet: 0.08 })
    k.frame({ at: [-px + 0.3, 0.87, pz + 0.62] }, () => {
      k.box('tile', [0.4, 0.025, 0.25], [0, 0, 0], { r: 0.012, tint: [0.9, 0.92, 0.93] })
      for (let i = 0; i < 5; i++) k.cyl('steel', 0.004, 0.14, [-0.15 + i * 0.07, 0.016, 0], { axis: 'z', seg: 6 })
      for (let i = 0; i < 3; i++) { k.cyl('tile', 0.012, 0.15, [-0.12 + i * 0.05, 0.05, -0.12], { pitch: 0.3, seg: 10 }); k.cable('rubber', [-0.12 + i * 0.05, 0.0, -0.13], [-0.05 + i * 0.05, -0.2, -0.1], 0.1, 0.003) }
    })
    k.box('steel', [0.18, 0.04, 0.12], [0.25, 0.02, d / 2 - 0.2], { r: 0.015 })
  },
  'medicine-fridge': (k, s) => {
    const { w, h, d } = k, v = s.variant
    const inner = carcass(k, 'tile', w, h - 0.08, d, { bottom: 0.08, t: 0.04, top: 0.08 })
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.caster([x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06)], 0.025)
    for (let i = 0; i < 4; i++) {
      const y = 0.2 + i * (h - 0.4) / 4
      shelfBoard(k, 'steel', inner - 0.01, d - 0.12, [0, y, -0.02], { wire: true })
      products(k, i % 2 ? 'med' : 'box', -inner / 2 + 0.02, inner / 2 - 0.02, y + 0.004, -0.02, d - 0.18, { maxH: (h - 0.4) / 4 - 0.04, fill: 0.5 + 0.15 * v })
    }
    door(k, 'tile', w - 0.01, h - 0.2, [0, 0.12 + (h - 0.2) / 2, d / 2], { style: 'glass', hinge: -1, handle: 'none', t: 0.045 })
    k.box('steel', [0.025, h * 0.5, 0.03], [w / 2 - 0.06, h * 0.5, d / 2 + 0.06], { r: 0.008 })
    k.frame({ at: [0, h - 0.045, d / 2 + 0.002] }, () => { k.box('tile', [w - 0.06, 0.07, 0.01], [0, 0, 0.005], { r: 0.004, tint: [0.3, 0.32, 0.35] }); k.screen([-w * 0.2, 0, 0.01], 0.1, 0.04, { bezel: 0.005 }); for (let i = 0; i < 3; i++) k.cyl('paint', 0.006, 0.006, [w * 0.1 + i * 0.03, 0, 0.012], { axis: 'z', seg: 10, tint: [0.3, 0.9, 0.4] }) })
    k.label([0, h * 0.25, d / 2 + 0.047], 0.16, 0.06, { m: 'paint' })
  },
  wheelchair: (k, s) => {
    const { w, h, d } = k, v = s.variant, R = 0.3, seatY = 0.5, fx = w / 2 - 0.08
    for (const x of [-1, 1]) {
      k.wheel([x * (w / 2 - 0.035), R, -0.08], R, 0.035, { tread: 'bike', ratio: 0.9, spokes: 28 })
      k.torus('steel', R * 0.85, 0.008, [x * (w / 2 - 0.0), R, -0.08], { axis: 'x', segR: 40, seg: 6 })
      k.caster([x * (fx - 0.02), 0, d / 2 - 0.12], 0.06)
      k.tube('steel', [[x * fx, 0.14, d / 2 - 0.12], [x * fx, seatY, d / 2 - 0.15], [x * fx, seatY, -0.18], [x * fx, h - 0.05, -0.25], [x * (fx - 0.01), h, -0.32]], 0.013, { fillet: 0.06 })
      k.tube('steel', [[x * fx, seatY, d / 2 - 0.2], [x * fx, 0.12, d / 2 - 0.02]], 0.011, { fillet: 0.04 })
      k.box('steel', [0.1, 0.01, 0.13], [x * (fx - 0.06), 0.13, d / 2 - 0.05], { pitch: 0.15, r: 0.004 })
      k.tube('steel', [[x * fx, seatY, 0.12], [x * fx, seatY + 0.2, 0.12], [x * fx, seatY + 0.22, -0.15], [x * fx, seatY, -0.18]], 0.01, { fillet: 0.04 })
      k.box(v === 1 ? 'leather' : 'rubber', [0.05, 0.025, 0.26], [x * fx, seatY + 0.225, -0.02], { r: 0.01 })
      k.cyl('rubber', 0.016, 0.12, [x * (fx - 0.01), h - 0.005, -0.38], { axis: 'z', seg: 12, pitch: 0.4 })
      k.tube('steel', [[x * fx, 0.25, -0.18], [x * fx, 0.25, d / 2 - 0.15]], 0.01)
    }
    for (const sgn of [-1, 1]) k.tube('steel', [[-fx, seatY - 0.12, 0.0 + sgn * 0.15], [fx, seatY - 0.12, -sgn * 0.15]], 0.01)
    k.sheet(v === 1 ? 'leather' : 'rubber', 2 * fx - 0.02, 0.42, (x) => -0.025 * (1 - (x / fx) ** 2), [0, seatY + 0.005, -0.02], { nx: 12, nz: 6, thickness: 0.006 })
    k.frame({ at: [0, seatY + 0.22, -0.24], pitch: -0.15 }, () => k.sheet(v === 1 ? 'leather' : 'rubber', 2 * fx - 0.02, 0.36, (x) => -0.03 * (1 - (x / fx) ** 2), [0, 0, 0], { nx: 12, nz: 6, thickness: 0.006, pitch: -Math.PI / 2 }))
  },
  'optical-chair': (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.lathe('steel', [[0, 0], [0.26, 0], [0.27, 0.025], [0.1, 0.06], [0.07, 0.38], [0, 0.38]], [0, 0, 0.1], { seg: 28 })
    chairShell(k, [0, 0.48, 0.12], w * 0.6, 0.48, 0.6, { recline: 0.2, headrest: true })
    for (const x of [-1, 1]) k.box('leather', [0.07, 0.04, 0.3], [x * w * 0.36, 0.66, 0.12], { r: 0.015 })
    const px = -w / 2 + 0.08
    k.cyl('steel', 0.03, h - 0.1, [px, (h - 0.1) / 2, -d / 2 + 0.12], { seg: 14 })
    k.tube('steel', [[px, h - 0.15, -d / 2 + 0.12], [px + 0.2, h - 0.12, -d / 2 + 0.25], [0, h - 0.35, 0.28]], 0.014, { fillet: 0.08 })
    k.frame({ at: [0, h - 0.47, 0.32] }, () => {
      k.box('paint', [0.36, 0.2, 0.08], [0, 0, 0], { r: 0.03, tint: [0.25, 0.3, 0.32] })
      for (const x of [-1, 1]) { k.cyl('glass', 0.025, 0.01, [x * 0.08, -0.01, 0.042], { axis: 'z', seg: 16 }); k.cyl('paint', 0.06, 0.02, [x * 0.08, -0.01, 0.0], { axis: 'z', seg: 24, tint: [0.85, 0.85, 0.85] }); for (let i = 0; i < 3; i++) k.knob([x * 0.16, 0.06 - i * 0.06, 0.0], 0.012, { yaw: x * Math.PI / 2, m: 'rubber' }) }
      k.knob([0, 0.09, 0.03], 0.01, { m: 'rubber' })
    })
    if (v !== 0) k.frame({ at: [w / 2 - 0.15, 0, -d / 2 + 0.15] }, () => { k.cyl('steel', 0.025, 0.85, [0, 0.425, 0], { seg: 12 }); k.box('tile', [0.3, 0.02, 0.3], [0, 0.86, 0], { r: 0.01 }); k.box('paint', [0.12, 0.2, 0.15], [0, 0.97, 0], { r: 0.02, tint: [0.3, 0.3, 0.32] }); k.cyl('glass', 0.025, 0.08, [0, 1.0, 0.1], { axis: 'z', seg: 14 }) })
  },
  'barber-chair': (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.lathe('steel', [[0, 0], [0.28, 0], [0.29, 0.02], [0.16, 0.05], [0.1, 0.12], [0.08, 0.3], [0, 0.3]], [0, 0, 0], { seg: 32 })
    k.box('steel', [0.2, 0.025, 0.04], [0.2, 0.08, 0.15], { yaw: -0.5, r: 0.008 })
    k.lathe('steel', [[0, 0], [0.12, 0], [0.13, 0.02], [0.1, 0.08], [0, 0.08]], [0, 0.3, 0], { seg: 24 })
    k.blk('steel', [w * 0.62, 0.05, 0.5], 0, 0.38, 0, { r: 0.01, tint: [0.75, 0.2, 0.2] })
    chairShell(k, [0, 0.48, 0.02], w * 0.58, 0.48, 0.55, { recline: [0.12, 0.3, 0.6][v], m: 'leather', headrest: true })
    for (const x of [-1, 1]) { k.tube('steel', [[x * w * 0.33, 0.43, -0.15], [x * w * 0.36, 0.66, -0.1], [x * w * 0.36, 0.66, 0.2], [x * w * 0.33, 0.45, 0.22]], 0.012, { fillet: 0.06 }); k.box('leather', [0.08, 0.04, 0.32], [x * w * 0.36, 0.685, 0.05], { r: 0.015, tint: [0.75, 0.25, 0.22] }) }
    k.frame({ at: [0, 0.32, 0.3], pitch: 0.5 }, () => { k.box('steel', [0.38, 0.015, 0.2], [0, 0, 0.1], { r: 0.006 }); for (let i = 0; i < 6; i++) k.box('rubber', [0.34, 0.004, 0.008], [0, 0.009, 0.03 + i * 0.028], { r: 0, tone: 0.5 }) })
  },
  'salon-station': (k, s) => {
    const { w, h, d } = k, v = s.variant, back = -d / 2 + 0.25
    const inner = carcass(k, 'steel', w, 0.78, 0.45, { z: back, plinth: 0.06, top: 0.03 })
    for (let i = 0; i < 3; i++) drawer(k, 'steel', inner / 2, 0.2, [-inner / 4, 0.1 + 0.1 + i * 0.22, back + 0.225], { handle: 'bar' })
    door(k, 'steel', inner / 2, 0.66, [inner / 4, 0.07 + 0.33, back + 0.225], { style: 'flat', hinge: 1, handle: 'bar' })
    k.blk('steel', [w, h - 0.78, 0.04], 0, 0.78, -d / 2 + 0.03, { r: 0.006 })
    k.frameRect('steel', w - 0.1, h - 1.0, 0.035, 0.03, [0, 0.8 + (h - 1.0) / 2 + 0.06, -d / 2 + 0.06])
    k.box('glass', [w - 0.17, h - 1.07, 0.006], [0, 0.8 + (h - 1.0) / 2 + 0.06, -d / 2 + 0.058], { r: 0.002, tone: 1.2, tint: [0.8, 0.85, 0.9] })
    for (let i = 0; i < 8; i++) k.cyl('glass', 0.008, 0.09, [-w * 0.42 + i * 0.03, 0.82, -d / 2 + 0.06], { seg: 8 })
    products(k, 'bottle', -w * 0.25, w * 0.4, 0.81, back + 0.1, 0.12, { maxH: 0.22, fill: 0.8, rows: 1 })
    k.frame({ at: [w * 0.38, 0.81, back + 0.12] }, () => { k.cyl('paint', 0.035, 0.16, [0, 0.03, 0], { axis: 'x', seg: 16, tint: [0.2, 0.2, 0.22] }); k.cyl('paint', 0.018, 0.12, [0.05, -0.0, 0], { seg: 12, tint: [0.2, 0.2, 0.22] }) })
    const cz = d / 2 - 0.3
    k.lathe('steel', [[0, 0], [0.26, 0], [0.27, 0.02], [0.12, 0.05], [0.07, 0.36], [0, 0.36]], [0, 0, cz], { seg: 28 })
    chairShell(k, [0, 0.46, cz], 0.5, 0.46, 0.55, { recline: 0.15 + v * 0.1, headrest: v === 2 })
    for (const x of [-1, 1]) k.box('leather', [0.07, 0.04, 0.3], [x * 0.3, 0.64, cz], { r: 0.015 })
  },
  'lab-equipment': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.9
    const inner = carcass(k, 'steel', w, top - 0.03, d, { plinth: 0.08, top: 0.0001 })
    for (let i = 0; i < 4; i++) drawer(k, 'steel', inner / 4 - 0.008, top - 0.16, [-inner / 2 + (i + 0.5) * inner / 4, 0.09 + (top - 0.16) / 2, d / 2], { handle: 'bar', flat: true })
    k.box('tile', [w, 0.03, d], [0, top - 0.015, 0], { r: 0.006, tint: [0.25, 0.27, 0.3] })
    for (const x of [-1, 1]) k.blk('steel', [0.025, h - top, 0.025], x * (w / 2 - 0.04), top, -d / 2 + 0.04, { r: 0.004 })
    k.box('steel', [w - 0.06, 0.02, 0.25], [0, h - 0.12, -d / 2 + 0.14], { r: 0.004 })
    products(k, 'bottle', -w / 2 + 0.06, w / 2 - 0.06, h - 0.11, -d / 2 + 0.14, 0.2, { maxH: 0.12, fill: 0.7, rows: 1 })
    k.frame({ at: [-w * 0.3, top, 0.0] }, () => {
      k.box('steel', [0.14, 0.03, 0.2], [0, 0.015, 0], { r: 0.008, tint: [0.92, 0.92, 0.9] })
      k.extrude('steel', [[-0.02, 0], [0.03, 0], [0.04, 0.12], [0.02, 0.28], [-0.03, 0.3], [-0.04, 0.25], [-0.01, 0.15]], 0.05, [0, 0.03, -0.07], { axis: 'x', bevel: 0.006, tint: [0.92, 0.92, 0.9] })
      k.box('steel', [0.12, 0.012, 0.1], [0, 0.13, 0.02], { r: 0.003 })
      k.cyl('steel', 0.03, 0.05, [0, 0.21, 0.02], { seg: 16 })
      for (let i = 0; i < 3; i++) k.cyl('steel', 0.008, 0.04, [Math.cos(i * 2.1) * 0.015, 0.17, 0.02 + Math.sin(i * 2.1) * 0.015], { seg: 8, roll: Math.cos(i * 2.1) * 0.2 })
      for (const x of [-1, 1]) k.cyl('rubber', 0.011, 0.1, [x * 0.02, 0.3, -0.02], { pitch: -0.6, roll: x * 0.1, seg: 10 })
    })
    k.frame({ at: [0, top, -0.05] }, () => { k.box('tile', [0.34, 0.24, 0.34], [0, 0.12, 0], { r: 0.04, tint: [0.92, 0.93, 0.95] }); k.cyl('tile', 0.14, 0.02, [0, 0.245, 0], { seg: 28, tint: [0.75, 0.8, 0.9] }); k.screen([0, 0.12, 0.17], 0.12, 0.05, { bezel: 0.006 }) })
    k.frame({ at: [w * 0.3, top, -0.05] }, () => { k.box('tile', [0.4, 0.32, 0.36], [0, 0.16, 0], { r: 0.02, tint: [0.88, 0.89, 0.9] }); k.screen([-0.08, 0.2, 0.18], 0.18, 0.12, { bezel: 0.01 }); k.box('rubber', [0.12, 0.06, 0.02], [0.12, 0.1, 0.18], { r: 0.006 }) })
    for (let i = 0; i < 3 + v; i++) k.lathe('glass', [[0, 0], [0.04, 0], [0.04, 0.02], [0.012, 0.12], [0.012, 0.16], [0, 0.16]], [-w * 0.1 + i * 0.07, top, d * 0.3], { seg: 16, tint: k.pick([[0.6, 0.8, 0.95], [0.9, 0.7, 0.6], [0.7, 0.9, 0.7]] as V3[]) })
  },
  casket: (k, s) => {
    const { w, h, d } = k, v = s.variant, standH = 0.5
    for (const z of [-1, 1]) k.frame({ at: [0, 0, z * (d / 2 - 0.2)] }, () => {
      for (const sgn of [-1, 1]) k.tube('steel', [[-w * 0.38, 0.05, sgn * 0.12], [w * 0.38, standH - 0.03, -sgn * 0.12]], 0.012, { seg: 8 })
      for (const x of [-1, 1]) k.caster([x * w * 0.38, 0, 0], 0.025)
      k.box('steel', [w * 0.8, 0.025, 0.06], [0, standH - 0.0125, 0], { r: 0.005 })
    })
    k.blk('steel', [0.03, 0.03, d - 0.4], -w * 0.38, standH - 0.03, 0, { r: 0.004 })
    const body = h - standH - 0.12
    k.extrude('wood', [[-w / 2 + 0.04, 0], [w / 2 - 0.04, 0], [w / 2, body * 0.3], [w / 2 - 0.01, body], [-w / 2 + 0.01, body], [-w / 2, body * 0.3]], d, [0, standH, 0], { bevel: 0.01, curveSeg: 4 })
    for (const x of [-1, 1]) for (const z of [-0.3, 0, 0.3]) { k.handle([x * (w / 2 + 0.002), standH + body * 0.45, z * d], 0.18, { yaw: x * Math.PI / 2, r: 0.008, standoff: 0.03 }) }
    k.box('wood', [w + 0.01, 0.02, d + 0.01], [0, standH + body + 0.01, 0], { r: 0.006 })
    k.cushion('fabric', [w - 0.08, 0.03, d - 0.08], [0, standH + body + 0.035, 0], { puff: 0.01, tufts: [2, 6], tint: [0.97, 0.95, 0.92] })
    const lid = (z0: number, len: number, open: number) => {
      let index = 0
      k.frame({ at: [-w / 2 + 0.01, standH + body + 0.02, z0] }, () => {
        index = k.leaf({
          kind: 'lid', pivot: k.point([0, 0, 0]), axis: k.direction([0, 0, 1]), travel: 1.95, initial: open,
          handle: k.point([w - 0.027, 0.042, 0]), normal: k.direction([0, 1, 0]), up: k.direction([-1, 0, 0]),
          center: k.point([w / 2 - 0.01, 0.035, 0]), width: len, height: w - 0.02, depth: 0.07, floor: k.point([w / 2 - 0.01, -body * 0.6, 0]),
        }, () => k.frame({ roll: open }, () => {
          k.extrude('wood', [[0, 0], [w - 0.02, 0], [w - 0.06, 0.07], [0.04, 0.07]], len, [0, 0, 0], { bevel: 0.008 })
          k.cushion('fabric', [w - 0.1, 0.03, len - 0.06], [w / 2 - 0.01, 0.0, 0], { puff: 0.012, tufts: [2, 3], tint: [0.97, 0.95, 0.92] })
        }))
      })
      return index
    }
    if (v === 2) { lid(-d * 0.25, d * 0.5 - 0.01, 0); lid(d * 0.25, d * 0.5 - 0.01, 0.95); k.cushion('fabric', [w * 0.55, 0.035, d * 0.16], [0, standH + body + 0.0675, d * 0.38], { puff: 0.014, tint: [0.97, 0.95, 0.92] }) }
    else {
      const cover = lid(0, d, 0)
      if (v === 1) k.within(cover, () => k.box('fabric', [w * 0.9, 0.006, d * 0.6], [0, standH + body + 0.095, 0], { r: 0.002, tint: [0.75, 0.2, 0.18] }))
    }
  },
  altar: (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 1.0, aw = w * 0.72
    k.blk('wood', [aw + 0.08, 0.06, d * 0.6], -w * 0.1, 0, 0.05, { r: 0.01 })
    k.blk('wood', [aw, top - 0.1, d * 0.5], -w * 0.1, 0.06, 0.05, { r: 0.008 })
    for (let i = 0; i < 3; i++) { k.frameRect('wood', aw / 3 - 0.04, top - 0.3, 0.035, 0.02, [-w * 0.1 - aw / 3 + i * aw / 3, 0.06 + (top - 0.1) / 2, 0.05 + d * 0.25 + 0.01]) }
    k.box('wood', [aw + 0.06, 0.05, d * 0.56], [-w * 0.1, top - 0.015, 0.05], { r: 0.012 })
    k.extrude('fabric', [[-aw / 2 - 0.03, 0], [aw / 2 + 0.03, 0], [aw / 2 + 0.03, -0.35], [aw / 2 + 0.035, -0.36], [aw / 2 + 0.035, 0.012], [-aw / 2 - 0.035, 0.012], [-aw / 2 - 0.035, -0.36], [-aw / 2 - 0.03, -0.35]], d * 0.58, [-w * 0.1, top + 0.012, 0.05], { axis: 'x', yaw: Math.PI / 2, tint: [0.97, 0.96, 0.92], steps: 8, warp: (x, y, z) => [0, 0, y < -0.02 ? Math.sin(x * 18) * 0.008 : 0] })
    for (const x of [-0.3, 0.3]) { k.lathe('steel', [[0, 0], [0.06, 0], [0.065, 0.015], [0.02, 0.04], [0.025, 0.12], [0.015, 0.2], [0.03, 0.22], [0.035, 0.24], [0, 0.24]], [-w * 0.1 + x * aw, top + 0.03, 0.05], { seg: 16, tint: [0.85, 0.7, 0.35] }); k.cyl('tile', 0.016, 0.18, [-w * 0.1 + x * aw, top + 0.36, 0.05], { seg: 12, tint: [0.98, 0.95, 0.85] }) }
    k.frame({ at: [-w * 0.1, top + 0.03, -0.05] }, () => { k.box('steel', [0.03, 0.4, 0.02], [0, 0.2, 0], { r: 0.004, tint: [0.85, 0.7, 0.35] }); k.box('steel', [0.2, 0.03, 0.02], [0, 0.3, 0], { r: 0.004, tint: [0.85, 0.7, 0.35] }) })
    const lx = w / 2 - 0.22
    k.frame({ at: [lx, 0, 0] }, () => {
      k.lathe('wood', [[0, 0], [0.18, 0], [0.18, 0.04], [0.05, 0.08], [0.04, 1.1], [0, 1.1]], [0, 0, 0], { seg: 18 })
      k.box('wood', [0.4, 0.03, 0.32], [0, h - 0.06, 0], { pitch: 0.35, r: 0.006 })
      k.box('wood', [0.4, 0.04, 0.02], [0, h - 0.11, 0.15], { r: 0.006 })
      if (v !== 0) k.box('paper', [0.3, 0.035, 0.22], [0, h - 0.035, 0.01], { pitch: 0.35, r: 0.004, tint: [0.4, 0.15, 0.12] })
    })
  },
  stage: (k, s) => {
    const { w, h, d } = k, v = s.variant, deckD = d * 0.75, z0 = -d / 2 + deckD / 2
    for (const x of [-1, 0, 1]) for (const z of [-1, 1]) k.blk('wood', [0.08, h - 0.04, 0.08], x * (w / 2 - 0.1), 0, z0 + z * (deckD / 2 - 0.1), { r: 0.006 })
    const n = Math.round(w / 0.14)
    for (let i = 0; i < n; i++) k.plank('wood', deckD, w / n - 0.004, 0.035, [-w / 2 + (i + 0.5) * w / n, h - 0.0175, z0], { yaw: Math.PI / 2, nails: true, wear: 0.6 })
    k.box('wood', [w, 0.04, 0.03], [0, h - 0.02, z0 + deckD / 2 - 0.015], { r: 0.008, tint: [0.4, 0.3, 0.25] })
    const pleats = Math.round(w / 0.06)
    for (let i = 0; i < pleats; i++) k.cyl('fabric', 0.03, h - 0.06, [-w / 2 + (i + 0.5) * w / pleats, (h - 0.06) / 2, z0 + deckD / 2 - 0.035], { seg: 8, bevel: 0, tint: [0.45, 0.08, 0.1] })
    k.blk('wood', [w * 0.5, h * 0.5, d - deckD - 0.02], 0, 0, d / 2 - (d - deckD - 0.02) / 2, { r: 0.008 })
    k.box('rubber', [w * 0.5, 0.004, 0.06], [0, h * 0.5 + 0.002, d / 2 - 0.05], { r: 0.002, tone: 0.5 })
    if (v !== 0) k.frame({ at: [w * 0.1, h, z0 + 0.1] }, () => { k.cyl('steel', 0.08, 0.015, [0, 0.008, 0], { seg: 18 }); k.cyl('steel', 0.008, 1.3, [0, 0.66, 0], { seg: 8 }); k.tube('steel', [[0, 1.3, 0], [0, 1.4, 0.1]], 0.005); k.sphere('steel', 0.025, [0, 1.42, 0.12], { scale: [1, 1.4, 1], tint: [0.3, 0.3, 0.32] }) })
    if (v === 2) for (const x of [-1, 1]) k.frame({ at: [x * (w / 2 - 0.25), h, z0 - deckD / 2 + 0.25] }, () => { k.box('rubber', [0.35, 0.55, 0.3], [0, 0.275, 0], { r: 0.012 }); k.cyl('fabric', 0.11, 0.01, [0, 0.33, 0.151], { axis: 'z', seg: 20, tint: [0.3, 0.3, 0.32] }); k.cyl('fabric', 0.05, 0.01, [0, 0.12, 0.151], { axis: 'z', seg: 16, tint: [0.3, 0.3, 0.32] }) })
  },
  'council-desk': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.76
    k.blk('steel', [w, h - 0.03, 0.04], 0, 0, d / 2 - 0.02, { r: 0.006 })
    k.box('steel', [w + 0.04, 0.03, 0.2], [0, h - 0.015, d / 2 - 0.08], { r: 0.008 })
    for (let i = 0; i < 4; i++) k.frameRect('wood', w / 4 - 0.06, h - 0.25, 0.04, 0.015, [-w / 2 + (i + 0.5) * w / 4, 0.12 + (h - 0.25) / 2, d / 2 + 0.006])
    k.box('steel', [w, 0.03, d - 0.08], [0, top, -0.02], { r: 0.008, tint: [0.5, 0.4, 0.3] })
    for (const x of [-1, 1]) k.blk('steel', [0.03, top, d - 0.08], x * (w / 2 - 0.015), 0, -0.02)
    const seats = v === 0 ? 2 : 3
    for (let i = 0; i < seats; i++) {
      const x = -w / 2 + (i + 0.5) * w / seats
      k.frame({ at: [x, top + 0.015, -0.05] }, () => { k.cyl('steel', 0.04, 0.012, [0, 0.006, 0], { seg: 16 }); k.tube('steel', [[0, 0.01, 0], [0, 0.2, 0.05], [0, 0.32, 0.14]], 0.004, { fillet: 0.08 }); k.cyl('rubber', 0.012, 0.05, [0, 0.33, 0.16], { pitch: 1.0, seg: 10 }) })
      k.frame({ at: [x, h, d / 2 - 0.08] }, () => { k.extrude('wood', [[-0.12, 0], [0.12, 0], [0.12, 0.012], [0.1, 0.06], [-0.1, 0.06], [-0.12, 0.012]], 0.03, [0, 0, 0], { bevel: 0.003 }); k.box('steel', [0.18, 0.035, 0.002], [0, 0.035, 0.012], { pitch: -0.38, r: 0 }) })
      k.box('paper', [0.21, 0.004, 0.29], [x + k.jitter(0.05), top + 0.017, -0.12], { yaw: k.jitter(0.2), r: 0 })
      k.box('wood', [0.46, 0.012, 0.5], [x, top - 0.115, -d / 2 + 0.28], { r: 0.003, tint: [0.45, 0.36, 0.27] })
      for (const side of [-1, 1]) k.box('wood', [0.012, 0.1, 0.5], [x + side * 0.226, top - 0.065, -d / 2 + 0.28], { r: 0.003, tint: [0.45, 0.36, 0.27] })
      drawer(k, 'wood', 0.42, 0.08, [x, top - 0.065, -d / 2 + 0.03], { yaw: Math.PI, handle: 'bar', flat: true, tint: [0.45, 0.36, 0.27] })
    }
  },
  'reading-table': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.76
    for (const x of [-1, 1]) k.frame({ at: [x * (w / 2 - 0.12), 0, 0] }, () => { k.blk('wood', [0.08, 0.06, d - 0.06], 0, 0, 0, { r: 0.012 }); k.lathe('wood', [[0, 0], [0.05, 0], [0.04, 0.1], [0.035, top - 0.15], [0.05, top - 0.08], [0, top - 0.08]], [0, 0.04, 0], { seg: 14, scale: [1.2, 1, 1] }) })
    k.box('wood', [w - 0.3, 0.06, 0.05], [0, 0.25, 0], { r: 0.01 })
    k.box('steel', [w, 0.04, d], [0, top - 0.02, 0], { r: 0.01, tint: [0.45, 0.32, 0.22] })
    k.box('leather', [w - 0.1, 0.004, d - 0.1], [0, top + 0.002, 0], { r: 0.002, tint: [0.25, 0.4, 0.3] })
    k.blk('wood', [w - 0.1, h - top, 0.03], 0, top, 0, { r: 0.006 })
    for (let i = 0; i < (v === 0 ? 2 : 3); i++) {
      const x = -w / 2 + (i + 0.5) * w / (v === 0 ? 2 : 3)
      k.blk('wood', [0.025, h - top - 0.05, d * 0.45], x - w / 6, top, 0, { r: 0.004 })
      for (const z of [-1, 1]) k.frame({ at: [x, top, z * d * 0.3] }, () => {
        k.lathe('steel', [[0, 0], [0.06, 0], [0.06, 0.02], [0.012, 0.03], [0.01, 0.25], [0, 0.25]], [0, 0, 0], { seg: 16, tint: [0.85, 0.7, 0.35] })
        k.frame({ at: [0, 0.28, 0], yaw: z > 0 ? Math.PI : 0 }, () => { k.cyl('glass', 0.065, 0.24, [0, 0, 0], { axis: 'x', arc: Math.PI, seg: 16, caps: false, tint: [0.3, 0.7, 0.4], roll: 0.0 }); k.cyl('steel', 0.004, 0.06, [0, -0.03, 0], { seg: 6 }) })
      })
    }
    for (let i = 0; i < 3; i++) k.blk('paper', [0.16, 0.035, 0.23], k.jitter(w * 0.35), top, d * 0.25 * (i % 2 ? 1 : -1), { yaw: k.jitter(0.4), r: 0.004, tint: k.pick([[0.5, 0.2, 0.15], [0.2, 0.25, 0.45], [0.3, 0.35, 0.2]] as V3[]) })
  },
  'teacher-desk': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.76, dz = d / 2 - 0.35
    const inner = carcass(k, 'steel', 0.42, top - 0.03, 0.62, { x: w / 2 - 0.25, z: dz, plinth: 0.05 })
    for (let i = 0; i < 3; i++) drawer(k, 'steel', inner + 0.03, 0.2, [w / 2 - 0.25, 0.07 + 0.1 + i * 0.22, dz + 0.31], { handle: 'bar', label: i === 2 })
    for (const z of [-1, 1]) k.blk('steel', [0.04, top - 0.03, 0.04], -w / 2 + 0.1, 0, dz + z * 0.27, { r: 0.004 })
    k.blk('steel', [w * 0.6, 0.35, 0.02], -w * 0.1, top - 0.38, dz - 0.3)
    k.box('steel', [w * 0.85, 0.03, 0.7], [w * 0.05, top - 0.015, dz], { r: 0.008, tint: [0.5, 0.4, 0.3] })
    const bz = -d / 2 + 0.04
    for (const x of [-1, 1]) k.blk('steel', [0.04, h, 0.04], x * (w / 2 - 0.05), 0, bz, { r: 0.004 })
    k.frameRect('wood', w - 0.06, h * 0.45, 0.04, 0.03, [0, h - h * 0.225 - 0.02, bz + 0.03])
    k.box('rubber', [w - 0.14, h * 0.45 - 0.08, 0.01], [0, h - h * 0.225 - 0.02, bz + 0.028], { r: 0.002, tint: [0.25, 0.32, 0.27] })
    for (let i = 0; i < 4 + v; i++) k.box('tile', [0.2 + k.rnd() * 0.5, 0.01, 0.001], [k.jitter(w * 0.25), h - 0.12 - i * 0.12, bz + 0.034], { r: 0, tint: [0.9, 0.9, 0.88], tone: 0.8 })
    k.box('wood', [w - 0.1, 0.02, 0.06], [0, h - h * 0.45 - 0.03, bz + 0.05], { r: 0.004 })
    k.lathe('tile', [[0, 0], [0.04, 0], [0.042, 0.1], [0, 0.1]], [-w * 0.2, top, dz + 0.1], { seg: 16, tint: [0.85, 0.3, 0.25] })
    k.sphere('paper', 0.04, [-w * 0.12, top + 0.04, dz + 0.15], { tint: [0.85, 0.15, 0.12], rows: 8, seg: 12 })
    for (let i = 0; i < 3; i++) k.blk('paper', [0.22, 0.03, 0.29], w * 0.1 + i * 0.02, top + i * 0.031, dz, { yaw: k.jitter(0.1), r: 0.004, tint: k.pick([[0.3, 0.4, 0.6], [0.7, 0.3, 0.25], [0.95, 0.95, 0.9]] as V3[]) })
  },
  'play-table': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = h - 0.25
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.cyl('paint', 0.025, top - 0.03, [x * (w / 2 - 0.1), (top - 0.03) / 2, z * (d / 2 - 0.1)], { seg: 14, tint: k.pick([[0.9, 0.3, 0.25], [0.25, 0.5, 0.9], [0.95, 0.8, 0.2], [0.3, 0.75, 0.35]] as V3[]) })
    k.extrude('paint', rrect(w, d, 0.15), 0.03, [0, top - 0.015, 0], { axis: 'y', bevel: 0.01, tint: [0.95, 0.85, 0.3] })
    const colors: V3[] = [[0.9, 0.25, 0.2], [0.2, 0.5, 0.9], [0.95, 0.8, 0.2], [0.3, 0.75, 0.35], [0.7, 0.35, 0.8]]
    for (let i = 0; i < 10 + v * 4; i++) k.box('paint', [0.05, 0.05, 0.05], [k.jitter(w * 0.35), top + 0.025 + (i % 3 === 2 ? 0.05 : 0), k.jitter(d * 0.3)], { yaw: k.rnd() * 3, r: 0.006, tint: colors[i % 5] })
    k.frame({ at: [w * 0.15, top, -d * 0.15] }, () => {
      k.box('wood', [0.3, 0.03, 0.2], [0, 0.015, 0], { r: 0.008 })
      for (let i = 0; i < 3; i++) {
        const pts: V3[] = Array.from({ length: 12 }, (_, j) => [-0.12 + j * 0.022, 0.03 + Math.sin(j * 0.6 + i) * 0.08 + 0.1 + i * 0.03, -0.06 + i * 0.06] as V3)
        pts[0][1] = 0.03; pts[11][1] = 0.03
        k.tube('steel', pts, 0.004, { seg: 6, tint: colors[i] })
        for (let b = 0; b < 4; b++) k.sphere('paint', 0.014, pts[2 + b * 2], { rows: 5, seg: 8, tint: colors[(b + i) % 5] })
      }
    })
    for (let i = 0; i < 6; i++) k.cyl('paint', 0.005, 0.09, [-w * 0.25 + i * 0.015, top + 0.005, d * 0.2], { axis: 'x', yaw: k.jitter(0.6), seg: 6, tint: colors[i % 5] })
    k.box('paper', [0.3, 0.002, 0.21], [-w * 0.2, top + 0.001, d * 0.15], { yaw: 0.2, r: 0 })
  },
  'holding-cell': (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.blk('concrete', [w, 0.05, d], 0, 0, 0, { r: 0.004 })
    for (const x of [-1, 1]) k.blk('concrete', [0.12, h - 0.05, d], x * (w / 2 - 0.06), 0.05, 0, { r: 0.006 })
    k.blk('concrete', [w - 0.24, h - 0.05, 0.12], 0, 0.05, -d / 2 + 0.06, { r: 0.006 })
    k.box('steel', [w, 0.08, 0.08], [0, h - 0.04, d / 2 - 0.04], { r: 0.008 })
    const fz = d / 2 - 0.04, doorW = 0.75, bars = Math.round((w - 0.24 - doorW) / 0.11)
    k.bars('steel', w - 0.24 - doorW, h - 0.13, bars, 0.012, [-(doorW) / 2, 0.05 + (h - 0.13) / 2, fz])
    for (const y of [0.12, h * 0.55]) k.box('steel', [w - 0.24 - doorW, 0.04, 0.03], [-doorW / 2, y, fz], { r: 0.006 })
    door(k, 'steel', doorW, h - 0.15, [w / 2 - 0.12 - doorW / 2, 0.06 + (h - 0.15) / 2, fz - 0.01], { style: 'mesh', hinge: 1, handle: 'none', t: 0.03, open: v === 2 ? 0.4 : 0 })
    k.frame({ at: [w / 2 - 0.12 - doorW + 0.06, 1.0, fz + 0.025] }, () => { k.box('steel', [0.12, 0.18, 0.05], [0, 0, 0], { r: 0.008 }); k.box('rubber', [0.012, 0.03, 0.002], [0, 0.03, 0.026], { r: 0 }) })
    for (const sgn of [-1]) k.frame({ at: [sgn * (w / 2 - 0.12 - 0.3), 0, -d / 2 + 0.12 + 0.95] }, () => {
      k.box('steel', [0.6, 0.04, 1.9], [0, 0.45, 0], { r: 0.008 })
      for (const z of [-0.8, 0.8]) k.box('steel', [0.04, 0.45, 0.04], [0.26, 0.225, z], { r: 0.004 })
      k.cushion('fabric', [0.56, 0.06, 1.8], [0, 0.5, 0], { puff: 0.012, tint: [0.45, 0.48, 0.4] })
    })
    k.frame({ at: [w / 2 - 0.12 - 0.25, 0, -d / 2 + 0.12 + 0.22] }, () => {
      k.box('steel', [0.45, 0.85, 0.36], [0, 0.425, 0], { r: 0.03 })
      basin(k, 'steel', 0.3, 0.22, 0.08, 0.01, 0.06, [0, 0.82, 0.02])
      k.lathe('steel', [[0, 0], [0.16, 0], [0.18, 0.1], [0.16, 0.11], [0.06, 0.04], [0, 0.04]], [0, 0.35, 0.3], { seg: 24, scale: [1, 1, 1.2] })
    })
    void crt
  },
  'fire-gear': (k, s) => {
    const { w, h, d } = k, v = s.variant
    for (const x of [-1, 1]) k.blk('steel', [0.04, h, 0.04], x * (w / 2 - 0.02), 0, -d / 2 + 0.05, { r: 0.004 })
    k.box('steel', [w, 0.03, d - 0.04], [0, h - 0.4, 0], { r: 0.004 })
    k.box('steel', [w, 0.03, 0.04], [0, h - 0.6, -d / 2 + 0.05], { r: 0.004 })
    shelfBoard(k, 'steel', w - 0.04, d - 0.06, [0, 0.12, 0], { wire: true })
    const sets = Math.floor((w - 0.1) / 0.45)
    for (let i = 0; i < sets; i++) {
      const x = -w / 2 + 0.25 + i * (w - 0.5) / Math.max(1, sets - 1)
      k.tube('steel', [[x, h - 0.6, -d / 2 + 0.07], [x, h - 0.6, -d / 2 + 0.14], [x, h - 0.57, -d / 2 + 0.16]], 0.006, { fillet: 0.02 })
      k.extrude('fabric', [[-0.22, 0], [0.22, 0], [0.24, -0.18], [0.2, -0.8], [-0.2, -0.8], [-0.24, -0.18]], 0.18, [x, h - 0.62, -d / 2 + 0.17], { bevel: 0.04, bevelSeg: 2, tint: [0.75, 0.65, 0.4], warp: (px, py) => [0, 0, Math.sin(py * 7 + px * 3) * 0.012] })
      for (const y of [-0.45, -0.68]) { k.box('paint', [0.46, 0.04, 0.005], [x, h - 0.62 + y, -d / 2 + 0.17 + 0.092], { r: 0.001, tint: [0.95, 0.9, 0.3] }); k.box('steel', [0.46, 0.015, 0.006], [x, h - 0.62 + y, -d / 2 + 0.17 + 0.094], { r: 0, tone: 1.2 }) }
      k.frame({ at: [x, h - 0.385, 0] }, () => { k.lathe('paint', [[0, 0], [0.17, 0], [0.18, 0.015], [0.14, 0.03], [0.13, 0.12], [0.08, 0.17], [0, 0.18]], [0, 0, 0], { seg: 24, scale: [1, 1, 1.25], tint: v === 1 ? [0.95, 0.9, 0.85] : [0.15, 0.15, 0.15] }); k.box('paint', [0.05, 0.08, 0.01], [0, 0.08, 0.16], { pitch: -0.5, r: 0.005, tint: [0.85, 0.75, 0.3] }) })
      for (const bx of [-0.07, 0.07]) k.frame({ at: [x + bx, 0.13, 0.0] }, () => { k.box('rubber', [0.11, 0.35, 0.13], [0, 0.175, -0.02], { r: 0.04 }); k.box('rubber', [0.11, 0.08, 0.28], [0, 0.04, 0.05], { r: 0.035 }); k.box('paint', [0.115, 0.03, 0.135], [0, 0.3, -0.02], { r: 0.01, tint: [0.95, 0.9, 0.3] }) })
    }
    for (let i = 0; i < 2 + v; i++) k.frame({ at: [w / 2 - 0.18, 0.16 + i * 0.11, d * 0.1] }, () => k.torus('fabric', 0.14, 0.035, [0, 0, 0], { segR: 32, seg: 10, tint: [0.85, 0.8, 0.7] }))
    if (v !== 0) k.cyl('steel', 0.08, 0.55, [-w / 2 + 0.12, h - 0.38 - 0.0, d * 0.1], { seg: 20, bevel: 0.03, tint: [0.85, 0.85, 0.82] })
  },
  'sorting-rack': (k, s) => {
    const { w, h, d } = k, v = s.variant
    const inner = carcass(k, 'steel', w, 0.8, d, { plinth: 0.06 })
    for (let i = 0; i < 3; i++) door(k, 'steel', inner / 3, 0.7, [-inner / 3 + i * inner / 3, 0.065 + 0.35, d / 2], { style: 'flat', hinge: i % 2 ? 1 : -1, handle: 'bar' })
    const cols = 6 + v, rows = 5, cw = (w - 0.04) / cols, rh = (h - 0.84) / rows, y0 = 0.82
    k.blk('steel', [w, h - 0.82, 0.01], 0, y0, -d / 2 + 0.06)
    for (let c = 0; c <= cols; c++) k.blk('wood', [0.012, h - 0.82, d * 0.5], -w / 2 + 0.02 + c * cw, y0, -d / 2 + 0.06 + d * 0.25, { r: 0.002 })
    for (let r = 0; r <= rows; r++) {
      k.blk('wood', [w - 0.04, 0.012, d * 0.5], 0, y0 + r * rh, -d / 2 + 0.06 + d * 0.25, { r: 0.002 })
      if (r < rows) for (let c = 0; c < cols; c++) {
        const x = -w / 2 + 0.02 + (c + 0.5) * cw
        k.label([x, y0 + r * rh + 0.012 + 0.008, -d / 2 + 0.06 + d * 0.5 + 0.001], cw * 0.6, 0.014)
        const letters = Math.floor(k.rnd() * 6)
        for (let l = 0; l < letters; l++) k.box('paper', [cw - 0.03, 0.002, d * 0.35], [x, y0 + r * rh + 0.016 + l * 0.003, -d / 2 + 0.06 + d * 0.22], { yaw: k.jitter(0.08), r: 0, tint: k.pick([[0.98, 0.97, 0.94], [0.9, 0.85, 0.7], [0.85, 0.9, 1]] as V3[]) })
      }
    }
    for (let i = 0; i < 3; i++) k.blk('paper', [0.3, 0.12, 0.25], -w / 2 + 0.25 + i * 0.35, 0.8, d / 2 - 0.15, { r: 0.006, tint: [0.75, 0.62, 0.42] })
  },
  'vault-door': (k, s) => {
    const { w, h, d } = k, v = s.variant, R = Math.min(w * 0.4, h * 0.38), cy = 0.18 + R + 0.06
    const hole: V2[] = Array.from({ length: 48 }, (_, i) => [Math.cos(i / 48 * Math.PI * 2) * (R + 0.02), cy + Math.sin(i / 48 * Math.PI * 2) * (R + 0.02)] as V2)
    k.extrude('steel', [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]], d * 0.6, [0, 0, -d * 0.2], { holes: [hole.reverse()], bevel: 0.02, tint: [0.55, 0.57, 0.6] })
    k.lathe('steel', [[0, 0], [R, 0], [R, d * 0.12], [R * 0.94, d * 0.16], [R * 0.94, d * 0.2], [R * 0.82, d * 0.24], [0, d * 0.25]], [0, cy, d * 0.08], { axis: 'z', seg: 64, crease: 30, tint: [0.62, 0.64, 0.66] })
    for (let i = 0; i < 3; i++) k.torus('steel', R * (0.35 + i * 0.18), 0.008, [0, cy, d * 0.08 + d * 0.25 - 0.01 - i * 0.012], { axis: 'z', segR: 48, seg: 6 })
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.cyl('steel', 0.03, 0.14, [Math.cos(a) * (R + 0.05), cy + Math.sin(a) * (R + 0.05), d * 0.11], { axis: 'x', yaw: 0, roll: a, seg: 14, tint: [0.75, 0.75, 0.72] }) }
    k.cyl('steel', 0.06, 0.06, [0, cy, d * 0.08 + d * 0.27], { axis: 'z', seg: 20 })
    const spokes = 3 + v
    for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2 + 0.3; k.tube('steel', [[0, cy, d * 0.4], [Math.cos(a) * R * 0.42, cy + Math.sin(a) * R * 0.42, d * 0.42]], 0.016); k.sphere('steel', 0.03, [Math.cos(a) * R * 0.44, cy + Math.sin(a) * R * 0.44, d * 0.42], { rows: 6, seg: 12 }) }
    k.torus('steel', R * 0.42, 0.014, [0, cy, d * 0.42], { axis: 'z', segR: 40, seg: 8 })
    k.frame({ at: [R * 0.55, cy + R * 0.45, d * 0.08 + d * 0.25] }, () => { k.lathe('steel', [[0, 0], [0.05, 0], [0.045, 0.015], [0, 0.02]], [0, 0, 0], { axis: 'z', seg: 24 }); for (let i = 0; i < 20; i++) k.box('rubber', [0.002, 0.01, 0.002], [Math.cos(i * 0.314) * 0.04, Math.sin(i * 0.314) * 0.04, 0.012], { roll: i * 0.314 - Math.PI / 2, r: 0, tone: 0.3 }) })
    k.frame({ at: [w / 2 - 0.1, cy, d * 0.1] }, () => { for (const y of [-R * 0.6, R * 0.6]) k.cyl('steel', 0.07, 0.3, [0, y, 0], { seg: 20, tint: [0.5, 0.52, 0.55] }); k.box('steel', [0.15, R * 1.4, 0.08], [-0.05, 0, 0], { r: 0.01, tint: [0.5, 0.52, 0.55] }) })
    k.blk('steel', [w - 0.1, 0.18, d * 0.6], 0, 0, -d * 0.2, { r: 0.01, tint: [0.45, 0.47, 0.5] })
  },
  'ticket-gate': (k, s) => {
    const { w, h, d } = k, v = s.variant
    const bw = w * 0.5, bx = -w / 2 + bw / 2
    k.blk('steel', [bw, 1.05, d], bx, 0, 0, { r: 0.01 })
    k.box('wood', [bw + 0.04, 0.04, d + 0.04], [bx, 1.07, 0], { r: 0.01 })
    k.frameRect('steel', bw, h - 1.09, 0.03, 0.03, [bx, 1.09 + (h - 1.09) / 2, d / 2 - 0.05])
    k.box('glass', [bw - 0.06, h - 1.15, 0.008], [bx, 1.09 + (h - 1.09) / 2, d / 2 - 0.05], { r: 0.002, tone: 1.1 })
    k.box('steel', [0.25, 0.04, 0.12], [bx, 1.11, d / 2 - 0.05], { r: 0.008, tone: 0.5 })
    k.cyl('glass', 0.05, 0.01, [bx + 0.1, 1.35, d / 2 - 0.04], { axis: 'z', seg: 20, tone: 0.7 })
    for (let i = 0; i < 4; i++) k.box('paper', [0.06, 0.12, 0.002], [bx - bw / 2 + 0.06 + i * 0.07, 1.4, d / 2 - 0.054], { roll: k.jitter(0.1), r: 0, tint: k.pick([[0.95, 0.85, 0.3], [0.9, 0.4, 0.3], [0.95, 0.95, 0.9]] as V3[]) })
    const tx = w / 2 - 0.25
    k.frame({ at: [tx, 0, 0] }, () => {
      k.box('steel', [0.3, 0.95, 0.45], [0, 0.475, 0], { r: 0.03 })
      k.box('steel', [0.34, 0.03, 0.5], [0, 0.965, 0], { r: 0.012 })
      k.screen([0, 0.97, 0.12], 0.1, 0.06, { pitch: -Math.PI / 2 + 0.4, bezel: 0.006 })
      k.frame({ at: [-0.16, 0.8, 0], roll: Math.PI / 2 - 0.62 }, () => {
        k.cyl('steel', 0.06, 0.06, [0, 0, 0], { seg: 18 })
        for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + (v * 0.4); k.tube('steel', [[0, 0.02, 0], [Math.cos(a) * 0.45, 0.03, Math.sin(a) * 0.45]], 0.016, { seg: 10 }) }
      })
    })
  },
  mailboxes: (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.blk('steel', [w * 0.4, 0.35, d * 0.5], 0, 0, 0, { r: 0.02, tint: [0.35, 0.4, 0.45] })
    k.blk('steel', [w, h - 0.35, d], 0, 0.35, 0, { r: 0.01, tint: [0.75, 0.75, 0.72] })
    k.extrude('steel', [[-d / 2, 0], [d / 2, 0], [d / 2, 0.03], [-d / 2, 0.08]], w + 0.02, [0, h, 0], { axis: 'x', bevel: 0.004, tint: [0.75, 0.75, 0.72] })
    const cols = 4 + v, rows = 5, cw = (w - 0.06) / cols, rh = (h - 0.55) / rows
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = -w / 2 + 0.03 + (c + 0.5) * cw, y = 0.45 + (r + 0.5) * rh
      if (r === 0 && c >= cols - 2) continue
      const open = k.chance(0.08) ? 1.1 : 0
      k.frame({ at: [x - cw / 2 + 0.005, y, d / 2] }, () => k.leaf({
        kind: 'door', pivot: k.point([0, 0, 0]), axis: k.direction([0, -1, 0]), travel: 1.75, initial: open,
        handle: k.point([cw - 0.03, rh * 0.2, 0.025]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
        center: k.point([cw / 2 - 0.005, 0, 0.006]), width: cw - 0.012, height: rh - 0.012, depth: 0.012, floor: k.point([cw / 2, -rh / 2 + 0.01, -0.15]),
      }, () => k.frame({ at: [0, 0, 0], yaw: -open }, () => {
        k.box('steel', [cw - 0.012, rh - 0.012, 0.012], [cw / 2 - 0.005, 0, 0.006], { r: 0.003, tint: [0.8, 0.8, 0.78] })
        k.cyl('steel', 0.008, 0.006, [cw - 0.03, rh * 0.2, 0.015], { axis: 'z', seg: 10, tone: 0.8 })
        k.label([cw / 2 - 0.005, rh * 0.3, 0.013], 0.04, 0.012, { m: 'paper' })
      })))
    }
    door(k, 'steel', cw * 2 - 0.01, rh - 0.01, [w / 2 - 0.03 - cw, 0.45 + rh / 2, d / 2], { style: 'flat', hinge: 1, handle: 'knob', t: 0.012 })
    k.box('rubber', [0.2, 0.02, 0.01], [0, 0.4, d / 2 + 0.005], { r: 0.004 })
  },
  'reception-bell': (k, s) => {
    const { w, h, d } = k, v = s.variant
    k.blk('wood', [w, h - 0.04, d - 0.1], 0, 0, 0.0, { r: 0.008 })
    for (let i = 0; i < 4; i++) k.frameRect('wood', w / 4 - 0.05, h - 0.3, 0.04, 0.02, [-w / 2 + (i + 0.5) * w / 4, 0.12 + (h - 0.3) / 2, (d - 0.1) / 2 + 0.008])
    k.box('steel', [w + 0.04, 0.04, d], [0, h - 0.02, 0], { r: 0.012, tint: [0.45, 0.3, 0.2] })
    const dw = w * 0.2 - 0.07, back = -(d - 0.1) / 2
    for (const side of [-1, 1]) for (const y of [h - 0.125, h - 0.275]) {
      const x = side * (w * 0.3 + 0.03 + dw / 2)
      k.box('rubber', [dw - 0.02, 0.11, 0.002], [x, y, back - 0.001], { r: 0, tone: 0.2 })
      drawer(k, 'wood', dw, 0.13, [x, y, back], { yaw: Math.PI, handle: 'bar' })
    }
    k.frame({ at: [w * 0.3, h, d * 0.15] }, () => { k.cyl('steel', 0.045, 0.012, [0, 0.006, 0], { seg: 18, tint: [0.3, 0.25, 0.2] }); k.lathe('steel', [[0, 0], [0.042, 0], [0.04, 0.02], [0.028, 0.045], [0, 0.05]], [0, 0.012, 0], { seg: 20, tint: [0.9, 0.75, 0.4] }); k.sphere('steel', 0.008, [0, 0.07, 0], { rows: 4, seg: 8 }) })
    k.frame({ at: [-w * 0.1, h, 0.0], yaw: 0.15 }, () => { k.box('leather', [0.42, 0.04, 0.3], [0, 0.02, 0], { r: 0.008, tint: [0.4, 0.2, 0.15] }); k.box('paper', [0.4, 0.008, 0.28], [0, 0.044, 0], { r: 0, tint: [0.97, 0.95, 0.88] }); k.cyl('paint', 0.004, 0.14, [0.12, 0.052, 0.05], { axis: 'x', yaw: 0.5, seg: 6, tint: [0.15, 0.15, 0.2] }) })
    k.frame({ at: [-w * 0.38, h, -d * 0.2] }, () => { k.lathe('steel', [[0, 0], [0.07, 0], [0.07, 0.015], [0.015, 0.03], [0.012, 0.28], [0, 0.28]], [0, 0, 0], { seg: 16, tint: [0.85, 0.7, 0.35] }); k.lathe('fabric', [[0.06, 0], [0.12, 0], [0.07, 0.14], [0.06, 0.14]], [0, 0.23, 0], { seg: 20, tint: [0.9, 0.85, 0.65] }) })
    if (v !== 0) k.frame({ at: [0, 0, -d / 2 - 0.0] }, () => { k.box('wood', [w * 0.6, 0.5, 0.03], [0, h + 0.0 - 0.25, 0.0], { r: 0.006 }); for (let i = 0; i < 12; i++) { const x = -w * 0.25 + (i % 6) * w * 0.1, y = h - 0.12 - Math.floor(i / 6) * 0.2; k.tube('steel', [[x, y, 0.015], [x, y, 0.04]], 0.003, { seg: 5 }); if (k.chance(0.6)) { k.cyl('steel', 0.01, 0.005, [x, y - 0.03, 0.04], { axis: 'z', seg: 8, tint: [0.9, 0.8, 0.4] }); k.box('wood', [0.03, 0.05, 0.006], [x, y - 0.07, 0.04], { r: 0.003, tint: [0.7, 0.3, 0.2] }) } } })
  },
  'computer-station': (k, s) => {
    const { w, h, d } = k, v = s.variant, top = 0.74
    for (const x of [-1, 1]) k.blk('steel', [0.03, top - 0.025, d - 0.06], x * (w / 2 - 0.03), 0, 0, { r: 0.004 })
    k.blk('steel', [w - 0.06, 0.3, 0.015], 0, top - 0.33, -d / 2 + 0.05)
    k.box('steel', [w, 0.025, d], [0, top - 0.0125, 0], { r: 0.006, tint: [0.6, 0.55, 0.45] })
    k.box('steel', [w * 0.6, 0.015, 0.3], [-w * 0.05, top - 0.07, d / 2 - 0.18], { r: 0.004 })
    for (const x of [-1, 1]) k.box('steel', [0.01, 0.03, 0.35], [-w * 0.05 + x * w * 0.3, top - 0.05, d / 2 - 0.2], { r: 0.003 })
    crt(k, [-w * 0.05, top + 0.2, -d * 0.1], 0.38, 0.32, {})
    k.extrude('tile', [[-0.19, 0], [0.19, 0], [0.16, 0.36], [-0.16, 0.36]], 0.32, [-w * 0.05, top + 0.04, -d * 0.1 - 0.16], { axis: 'y', pitch: 0, tint: [0.85, 0.82, 0.72] })
    k.box('tile', [0.38, 0.32, 0.36], [-w * 0.05, top + 0.2, -d * 0.1 - 0.17], { r: 0.03, tint: [0.85, 0.82, 0.72] })
    k.box('tile', [0.22, 0.03, 0.2], [-w * 0.05, top + 0.015, -d * 0.1 - 0.05], { r: 0.01, tint: [0.85, 0.82, 0.72] })
    k.frame({ at: [-w * 0.05, top - 0.055, d / 2 - 0.16] }, () => { k.box('tile', [0.44, 0.025, 0.15], [0, 0.0125, 0], { r: 0.006, tint: [0.85, 0.82, 0.72] }); for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) k.box('tile', [0.024, 0.01, 0.022], [-0.2 + c * 0.0285, 0.028 + r * 0.002, -0.055 + r * 0.026], { r: 0.002, tint: [0.92, 0.9, 0.82] }) })
    k.frame({ at: [w * 0.2, top, d * 0.2] }, () => { k.box('rubber', [0.2, 0.004, 0.18], [0, 0.002, 0], { r: 0.002, tint: [0.2, 0.25, 0.4] }); k.sphere('tile', 0.03, [0, 0.018, 0], { scale: [1, 0.55, 1.6], tint: [0.85, 0.82, 0.72] }) })
    k.frame({ at: [w / 2 - 0.15, 0.0, -0.05] }, () => { k.box('tile', [0.19, 0.42, 0.44], [0, 0.21, 0], { r: 0.008, tint: [0.85, 0.82, 0.72] }); for (let i = 0; i < 3; i++) k.box('tile', [0.15, 0.04, 0.01], [0, 0.35 - i * 0.05, 0.223], { r: 0.003, tint: [0.75, 0.72, 0.65] }); k.cyl('paint', 0.006, 0.005, [0.05, 0.12, 0.222], { axis: 'z', seg: 8, tint: [0.3, 0.9, 0.3] }) })
    for (const x of [-1, 1]) k.box('tile', [0.08, 0.16, 0.08], [-w * 0.05 + x * 0.32, top + 0.08, -d * 0.1], { r: 0.008, tint: [0.25, 0.25, 0.27] })
    for (let i = 0; i < 2 + v; i++) k.cable('rubber', [-w * 0.05 + (i - 1) * 0.05, top + 0.05, -d / 2 + 0.06], [w / 2 - 0.15, 0.3, -0.27], 0.15, 0.004)
  },
}
