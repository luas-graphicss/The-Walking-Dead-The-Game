import { arc, type Family, type Kit, type V2, type V3 } from '../kit'
import { door, drawer } from './common'
import { gauge, legFrame, motor } from './shop'
import { carton } from './props'

const DARK: V3 = [0.2, 0.2, 0.22]
const IRON: V3 = [0.16, 0.16, 0.17]
const BRASS: V3 = [0.85, 0.68, 0.35]
const CHROME: V3 = [0.88, 0.88, 0.9]

function kettle(k: Kit, at: V3, r: number, hh: number, tint: V3, o: { lid?: number; pitch?: number } = {}) {
  k.frame({ at, pitch: o.pitch }, () => {
    k.lathe('steel', [[0, 0], [r, 0], [r, hh], [r + 0.008, hh + 0.006], [r - 0.006, hh + 0.006], [r - 0.006, 0.01], [0, 0.01]], [0, 0, 0], { seg: 26, tint, crease: 60 })
    for (const s of [-1, 1]) k.box('steel', [0.05, 0.02, 0.08], [s * (r + 0.022), hh - 0.05, 0], { r: 0.006, tint })
    if (o.lid === undefined) return
    const rim = hh + 0.006
    if (o.lid < 0) k.box('steel', [0.06, 0.03, 0.03], [0, rim + 0.01, -r - 0.004], { r: 0.004, tint: DARK })
    k.frame({ at: [0, rim, -r], pitch: o.lid }, () => {
      k.lathe('steel', [[0, 0], [r + 0.01, 0], [r + 0.006, 0.014], [r * 0.6, 0.05], [0, 0.06]], [0, 0, r], { seg: 26, tint, crease: 50 })
      k.box('steel', [0.12, 0.025, 0.03], [0, 0.07, r], { r: 0.008, tint: DARK })
    })
  })
}

export const INFRA: Family = {
  'animal-cages': (k, s) => {
    const { w, h, d } = k, v = s.variant, steel: V3 = v === 2 ? [0.68, 0.55, 0.45] : [0.85, 0.86, 0.87]

    for (const x of [-1, 1]) for (const z of [-1, 1]) k.caster([x * (w / 2 - 0.08), 0, z * (d / 2 - 0.08)], 0.034)
    const mount = 0.034 * 2.05 + 0.01
    k.blk('steel', [w, 0.05, d], 0, mount, 0, { r: 0.006, tint: DARK })
    const y0 = mount + 0.05, cw = w / 2, chh = (h - y0) / 2, t = 0.012, cd = d - 0.02, cz = -0.01, front = cz + cd / 2
    const blanket: V3[] = [[0.55, 0.3, 0.25], [0.3, 0.4, 0.6], [0.75, 0.65, 0.4], [0.4, 0.5, 0.35]]
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      const x0 = -w / 2 + (c + 0.5) * cw, yb = y0 + r * chh, i = r * 2 + c
      k.blk('steel', [cw - 0.004, t, cd], x0, yb, cz, { r: 0.003, tint: steel })
      k.blk('steel', [cw - 0.004, t, cd], x0, yb + chh - t, cz, { r: 0.003, tint: steel })
      for (const sd of [-1, 1]) k.blk('steel', [t, chh - 2 * t, cd], x0 + sd * (cw / 2 - 0.002 - t / 2), yb + t, cz, { r: 0.003, tint: steel })
      k.blk('steel', [cw - 0.004 - 2 * t, chh - 2 * t, t], x0, yb + t, -d / 2 + t / 2, { r: 0.002, tint: steel })

      const fx = x0 - (cw - 0.004) / 2, dw = cw - 0.004, open = v === 1 && i === 1 ? 0.04 : 0
      k.cyl('steel', 0.008, chh - 0.02, [fx + 0.004, yb + chh / 2, front + 0.004], { seg: 8, tint: DARK })
      k.frame({ at: [fx, yb + chh / 2, front] }, () => k.leaf({
        kind: 'door', pivot: k.point([0, 0, 0]), axis: k.direction([0, -1, 0]), travel: 1.7, initial: open,
        handle: k.point([dw - 0.03, 0, 0.05]), normal: k.direction([0, 0, 1]), up: k.direction([0, 1, 0]),
        center: k.point([dw / 2, 0, 0.01]), width: dw, height: chh, depth: 0.02, floor: k.point([dw / 2, -chh / 2 + t, -cd / 2]), sheer: true,
      }, () => k.frame({ yaw: -open }, () => {
        k.frameRect('steel', dw, chh, 0.03, 0.02, [dw / 2, 0, 0.01], { tint: steel })
        const bars = Math.round((dw - 0.064) / 0.04)
        for (let b = 0; b < bars; b++) {
          if (v === 2 && i === 2 && b % 4 === 1) continue
          k.cyl('steel', 0.004, chh - 0.06, [dw / 2 - (dw - 0.064) / 2 + (b + 0.5) * (dw - 0.064) / bars, 0, 0.01], { seg: 8, bevel: 0, tint: steel })
        }
        k.box('steel', [0.04, 0.06, 0.015], [dw - 0.015, 0, 0.0275], { r: 0.004, tint: DARK })
        k.cyl('steel', 0.006, 0.06, [dw - 0.05, 0, 0.026], { axis: 'x', seg: 8, tint: DARK })
        k.label([dw / 2 + 0.12, chh / 2 - 0.015, 0.0208], 0.07, 0.02)
      })))

      k.lathe('steel', [[0, 0], [0.06, 0], [0.08, 0.05], [0.072, 0.05], [0.055, 0.008], [0, 0.008]], [x0 + cw * 0.25, yb + t, front - 0.16], { seg: 18, tint: CHROME })
      if (v === 2 && i === 3) continue
      k.sheet('fabric', cw * 0.55, cd * 0.55, (x, z) => 0.004 + Math.abs(Math.sin(x * 14 + z * 6)) * 0.012, [x0 - cw * 0.12, yb + t, cz - 0.05], { thickness: 0.006, nx: 18, nz: 16, tint: blanket[i] })
    }
  },

  'signal-lever': (k, s) => {
    const { w, d } = k, v = s.variant, n = 8, px = (w - 0.3) / n, pivotY = 0.3, L = 0.98

    for (const z of [-1, 1]) k.blk('steel', [w, 0.12, 0.08], 0, 0, z * 0.18, { r: 0.004, tint: IRON })
    const a0 = Math.atan2(Math.sqrt(0.42 ** 2 - 0.23 ** 2), 0.23)
    const quadrant: V2[] = [[-0.23, 0], [0.23, 0], ...arc(0, -0.05, 0.42, a0, Math.PI - a0, 10)]
    const colours: V3[] = [[0.75, 0.12, 0.1], [0.12, 0.12, 0.12], [0.15, 0.3, 0.6], [0.85, 0.7, 0.15], [0.75, 0.12, 0.1], [0.12, 0.12, 0.12], [0.9, 0.9, 0.88], [0.75, 0.12, 0.1]]
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.15 + (i + 0.5) * px, reversed = i % 3 === 1, lean = reversed ? 0.22 : -0.22
      k.extrude('steel', quadrant.map(([z, y]) => [-z, y] as V2), 0.014, [x + 0.03, 0.12, 0], { axis: 'x', bevel: 0.003, tint: IRON })
      k.cyl('steel', 0.025, 0.03, [x + 0.012, pivotY, 0], { axis: 'x', seg: 12, tint: IRON })
      const broken = v === 2 && i === 2, missing = v === 2 && i === 5
      const len = broken ? 0.5 : missing ? 0.16 : L
      k.frame({ at: [x, pivotY, 0], pitch: lean }, () => {
        k.box('steel', [0.035, len, 0.03], [0, len / 2 - 0.08, 0], { r: 0.004, tint: IRON })
        if (missing) return
        k.box('paint', [0.037, 0.3, 0.032], [0, len - 0.08 - 0.2, 0], { r: 0.004, tint: colours[i] })
        k.box('paint', [0.04, 0.06, 0.004], [0, Math.min(0.45, len - 0.4), 0.017], { r: 0.001, tint: [0.95, 0.93, 0.85] })
        if (broken) return
        k.cyl('steel', 0.018, 0.14, [0, len - 0.08 + 0.06, 0], { seg: 12, tint: CHROME })
        k.box('steel', [0.03, 0.12, 0.012], [0, len - 0.08 - 0.02, -0.02], { r: 0.003, tint: CHROME })
      })
    }

    const bz = d / 2 - 0.035
    for (const sd of [-1, 1]) k.blk('steel', [0.04, 0.96, 0.04], sd * (w / 2 - 0.04), 0, bz, { r: 0.004, tint: IRON })
    k.blk('wood', [w - 0.1, 0.12, 0.03], 0, 0.84, bz, { r: 0.004, tint: [0.5, 0.36, 0.24] })
    for (let i = 0; i < n; i++) k.label([-w / 2 + 0.15 + (i + 0.5) * px, 0.9, bz + 0.0158], 0.07, 0.05, { m: v === 2 && i % 4 === 3 ? 'steel' : 'paper' })
    const ix = -(w / 2 - 0.11)
    const iz = bz - 0.04
    k.blk('wood', [0.2, 0.26, 0.16], ix, 0.96, iz, { r: 0.008, tint: [0.42, 0.28, 0.18] })
    gauge(k, [ix, 1.11, iz + 0.08], 0.05)
    k.cyl('steel', 0.012, 0.04, [ix + 0.06, 1.0, iz + 0.1], { axis: 'z', seg: 10, tint: CHROME })
    k.lathe('steel', [[0, 0], [0.045, 0], [0.04, 0.02], [0.025, 0.04], [0, 0.045]], [ix, 1.22, iz], { seg: 16, tint: BRASS })
  },

  'field-kitchen': (k, s) => {
    const { w, h, d } = k, v = s.variant, olive: V3 = v === 2 ? [0.42, 0.38, 0.28] : [0.35, 0.4, 0.25]

    for (const z of [-1, 1]) k.blk('steel', [w, 0.08, 0.1], 0, 0, z * (d / 2 - 0.12), { r: 0.006, tint: DARK })
    const bw = w - 0.1, bd = d - 0.12, by = 0.08, bh = 0.7, top = by + bh + 0.03, front = bd / 2
    k.blk('paint', [bw, bh, bd], 0, by, 0, { r: 0.012, tint: olive })
    k.blk('steel', [bw + 0.04, 0.03, bd + 0.04], 0, by + bh, 0, { r: 0.006, tint: [0.3, 0.3, 0.3] })

    door(k, 'steel', 0.4, 0.3, [-bw / 4, by + 0.4, front], { style: 'flat', hinge: -1, handle: 'lever', hinges: true })
    drawer(k, 'steel', 0.4, 0.1, [-bw / 4, by + 0.14, front], { handle: 'bar', flat: true })
    k.vent([bw / 4, by + 0.5, front], 0.35, 0.15)

    const kr = 0.26, kh = 0.34
    kettle(k, [-bw / 4, top, 0], kr, kh, olive, { lid: v === 1 ? -1.25 : 0 })

    if (v === 2) kettle(k, [bw / 4, top + kr + 0.008 - 0.003, 0.17], kr, kh, olive, { pitch: -Math.PI / 2 })
    else {
      kettle(k, [bw / 4, top, 0], kr, kh, olive, { lid: 0 })
      carton(k, 0.2, 0.12, 0.3, [0, top, 0.05], { label: true })
    }

    const cx = bw / 2 - 0.1, cz = -bd / 2 + 0.1, pipeTop = h - 0.12
    k.cyl('steel', 0.09, 0.04, [cx, top + 0.02, cz], { seg: 18, tint: DARK })
    k.cyl('steel', 0.07, pipeTop - top - 0.04, [cx, top + 0.04 + (pipeTop - top - 0.04) / 2, cz], { seg: 16, tint: [0.3, 0.3, 0.3] })
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box('steel', [0.01, 0.08, 0.01], [cx + Math.cos(a) * 0.058, pipeTop + 0.02, cz + Math.sin(a) * 0.058], { r: 0.002, tint: DARK }) }
    k.lathe('steel', [[0, 0], [0.13, 0], [0.12, 0.012], [0, 0.07]], [cx, pipeTop + 0.055, cz], { seg: 18, tint: DARK })

    const ry = by + bh - 0.08, rz = front + 0.035
    k.cyl('steel', 0.01, 0.8, [bw / 4, ry, rz], { axis: 'x', seg: 10, tint: CHROME })
    for (const x of [bw / 4 - 0.35, bw / 4 + 0.35]) k.tube('steel', [[x, ry, front - 0.005], [x, ry, rz]], 0.008, { seg: 8, tint: CHROME })
    const lx = bw / 4 + 0.1
    k.tube('steel', [[lx, ry + 0.012, rz - 0.012], [lx, ry + 0.02, rz + 0.008], [lx, ry - 0.02, rz + 0.016]], 0.004, { seg: 6, fillet: 0.01, tint: CHROME })
    k.tube('steel', [[lx, ry - 0.02, rz + 0.016], [lx, ry - 0.3, rz + 0.025]], 0.006, { seg: 8, tint: CHROME })
    k.sphere('steel', 0.045, [lx, ry - 0.33, rz + 0.025], { rows: 6, seg: 12, scale: [1, 0.6, 1], tint: CHROME })
  },

  transformer: (k, s) => {
    const { w, d } = k, v = s.variant, grey: V3 = v === 1 ? [0.5, 0.56, 0.46] : [0.6, 0.62, 0.63], porcelain: V3 = v === 1 ? [0.88, 0.86, 0.82] : [0.5, 0.3, 0.2]
    k.blk('concrete', [w, 0.2, d], 0, 0, 0, { r: 0.012, tint: [0.72, 0.7, 0.68] })
    const tw = w * 0.6, td = d * 0.5, ty = 0.2, th = 1.2, top = ty + th + 0.05
    k.blk('paint', [tw, th, td], 0, ty, 0, { r: 0.02, tint: grey })
    k.blk('paint', [tw + 0.06, 0.05, td + 0.06], 0, ty + th, 0, { r: 0.012, tint: grey })

    const fins = Math.round((tw - 0.16) / 0.055), fy = ty + 0.15, fh = th - 0.3, fd = 0.2
    for (const sd of [-1, 1]) {
      for (let i = 0; i < fins; i++) k.blk('paint', [0.012, fh, fd], -(tw - 0.16) / 2 + (i + 0.5) * (tw - 0.16) / fins, fy, sd * (td / 2 + fd / 2), { r: 0.003, tint: grey })
      for (const y of [fy + 0.04, fy + fh - 0.04]) k.cyl('paint', 0.03, tw - 0.12, [0, y, sd * (td / 2 + fd + 0.029)], { axis: 'x', seg: 14, tint: grey })
    }

    const shed: V2[] = [[0, 0], [0.07, 0], [0.07, 0.05], [0.05, 0.06], [0.12, 0.09], [0.05, 0.13], [0.11, 0.16], [0.05, 0.2], [0.1, 0.23], [0.045, 0.27], [0.09, 0.3], [0.04, 0.34], [0.08, 0.37], [0.035, 0.41], [0.035, 0.5], [0, 0.5]]
    for (const [i, x] of [-0.3, 0, 0.3].entries()) {
      const broken = v === 2 && i === 2
      k.lathe('tile', broken ? [...shed.filter(([, y]) => y <= 0.2), [0, 0.2] as V2] : shed, [x, top, 0.1], { seg: 18, tint: porcelain, crease: 60 })
      if (broken) continue
      k.cyl('steel', 0.03, 0.08, [x, top + 0.54, 0.1], { seg: 12, tint: [0.6, 0.6, 0.62] })
      k.cyl('steel', 0.008, 0.12, [x, top + 0.62, 0.1], { seg: 8, tint: [0.75, 0.55, 0.35] })
    }
    if (v === 2) for (let i = 0; i < 3; i++) k.box('tile', [0.04, 0.006, 0.03], [0.22 + i * 0.07, top + 0.003, 0.28], { yaw: i * 1.1, r: 0.001, tint: porcelain })

    const cz = -td / 2 + 0.12, cy = 2.15
    for (const x of [-0.25, 0.25]) k.blk('paint', [0.06, cy - 0.15 - top + 0.01, 0.06], x, top, cz, { r: 0.004, tint: grey })
    k.cyl('paint', 0.15, 0.8, [0, cy, cz], { axis: 'x', seg: 22, tint: grey })
    k.cyl('paint', 0.02, cy - 0.15 - top + 0.02, [0.34, top + (cy - 0.15 - top) / 2, cz], { seg: 10, tint: grey })
    gauge(k, [0.4, cy, cz], 0.05, { yaw: Math.PI / 2 })

    for (let i = 0; i < 4; i++) k.lathe('tile', [[0, 0], [0.04, 0], [0.04, 0.02], [0.055, 0.035], [0.03, 0.05], [0.045, 0.065], [0.025, 0.08], [0.025, 0.12], [0, 0.12]], [tw / 2, top - 0.3, -0.18 + i * 0.12], { axis: 'x', seg: 14, tint: porcelain })
    k.box('steel', [0.004, 0.12, 0.2], [-tw / 2 - 0.0015, ty + 0.85, 0.08], { r: 0.001, tint: [0.75, 0.75, 0.72] })
    k.extrude('paint', ([[-0.09, 0], [0.09, 0], [0, 0.16]] as V2[]).map(([z, y]) => [-z, y] as V2), 0.004, [-tw / 2 - 0.0015, ty + 0.55, -0.12], { axis: 'x', tint: [0.95, 0.8, 0.15] })
    k.cyl('steel', 0.03, 0.08, [-tw / 2 - 0.035, ty + 0.12, 0.1], { axis: 'x', seg: 12, tint: DARK })
    k.cyl('steel', 0.01, 0.07, [-tw / 2 - 0.1, ty + 0.12, 0.1], { axis: 'x', seg: 8, tint: CHROME })
    k.torus('steel', 0.055, 0.007, [-tw / 2 - 0.12, ty + 0.12, 0.1], { axis: 'x', segR: 16, seg: 5, tint: [0.7, 0.15, 0.1] })
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box('steel', [0.008, 0.05, 0.008], [-tw / 2 - 0.12, ty + 0.12 + Math.sin(a) * 0.028, 0.1 + Math.cos(a) * 0.028], { pitch: Math.PI / 2 - a, r: 0.002, tint: [0.7, 0.15, 0.1] }) }
    k.cable('rubber', [-tw / 2 + 0.005, ty + 0.3, -0.2], [-tw / 2 - 0.2, ty + 0.006, -0.45], 0.05, 0.008)
    k.blk('steel', [0.05, 0.03, 0.05], -tw / 2 - 0.2, ty, -0.45, { r: 0.004, tint: CHROME })
    if (v === 2) k.box('charcoal', [0.5, 0.004, 0.4], [-tw / 2 - 0.1, ty + 0.0015, 0.2], { r: 0.001 })
  },

  'water-pump': (k, s) => {
    const { w, d } = k, v = s.variant, blue: V3 = v === 1 ? [0.25, 0.45, 0.3] : [0.2, 0.35, 0.6], rust: V3 = v === 2 ? [0.55, 0.38, 0.28] : DARK

    const sl = w - 0.35, sx = -w / 2 + sl / 2, sy = 0.1
    for (const z of [-1, 1]) k.blk('steel', [sl, 0.08, 0.1], sx, 0, z * 0.25, { r: 0.004, tint: rust })
    k.blk('steel', [sl, 0.02, 0.62], sx, 0.08, 0, { r: 0.004, tint: [0.4, 0.4, 0.42] })

    const mx = -w / 2 + 0.4, mr = 0.15, mlen = 0.55, shaftY = sy + mr + 0.02, gx = mx + mlen / 2 + 0.1, vx = gx + 0.3
    motor(k, [mx, sy, 0], mr, mlen, { tint: blue })
    k.blk('paint', [0.16, 0.22, 0.22], gx, sy, 0, { r: 0.01, tint: [0.9, 0.7, 0.15] })
    k.cyl('steel', 0.07, vx - gx - 0.14, [(gx + vx) / 2, shaftY, 0], { axis: 'x', seg: 16, tint: blue })
    k.blk('steel', [0.1, shaftY - sy - 0.05, 0.16], (gx + vx) / 2, sy, 0, { r: 0.004, tint: blue })
    k.cyl('steel', 0.16, 0.14, [vx, shaftY, 0], { axis: 'x', seg: 26, tint: blue })
    k.blk('steel', [0.12, shaftY - 0.16 - sy + 0.01, 0.2], vx, sy, 0, { r: 0.004, tint: blue })

    const sxn = vx + 0.07, flange = sxn + 0.13, dropX = w / 2 - 0.15
    k.cyl('steel', 0.07, 0.14, [sxn + 0.065, shaftY, 0], { axis: 'x', seg: 16, tint: blue })
    k.cyl('steel', 0.11, 0.025, [flange, shaftY, 0], { axis: 'x', seg: 18, tint: blue })
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.bolt([flange + 0.0125, shaftY + Math.sin(a) * 0.09, Math.cos(a) * 0.09], { yaw: Math.PI / 2, r: 0.006 }) }

    k.tube('steel', [[flange + 0.0115, shaftY, 0], [dropX, shaftY, 0], [dropX, 0.019, 0]], 0.065, { seg: 14, fillet: 0.06, tint: rust })
    k.cyl('steel', 0.12, 0.02, [dropX, 0.01, 0], { seg: 18, tint: rust })

    const dz = 0.08, ry = 0.78, vz = -0.26
    k.cyl('steel', 0.075, 0.04, [vx, 0.42, dz], { seg: 18, tint: blue })
    k.tube('steel', [[vx, 0.439, dz], [vx, ry, dz], [vx, ry, -0.21]], 0.055, { seg: 14, fillet: 0.1, tint: rust })
    k.cyl('steel', 0.012, 0.05, [vx, 0.6, dz + 0.075], { axis: 'z', seg: 8, tint: CHROME })
    gauge(k, [vx, 0.6, dz + 0.1], 0.045)
    k.blk('steel', [0.16, 0.16, 0.12], vx, ry - 0.08, vz, { r: 0.01, tint: blue })
    k.cyl('steel', 0.05, 0.22, [vx, ry + 0.08 + 0.105, vz], { seg: 14, tint: blue })
    k.cyl('steel', 0.012, 0.2, [vx, ry + 0.08 + 0.305, vz], { seg: 8, tint: CHROME })
    const wheel = (at: V3) => {
      k.torus('steel', 0.12, 0.012, at, { segR: 24, seg: 6, tint: [0.7, 0.15, 0.1] })
      k.cyl('steel', 0.025, 0.03, at, { seg: 12, tint: [0.7, 0.15, 0.1] })
      for (const yaw of [0, Math.PI / 2]) k.box('steel', [0.23, 0.012, 0.012], at, { yaw, r: 0.003, tint: [0.7, 0.15, 0.1] })
    }
    if (v === 2) wheel([sx - 0.3, sy + 0.011, 0.24])
    else wheel([vx, ry + 0.08 + 0.36, vz])
    k.tube('steel', [[vx, ry, vz - 0.05], [vx, ry, -d / 2 + 0.08], [vx, 0.019, -d / 2 + 0.08]], 0.055, { seg: 14, fillet: 0.08, tint: rust })
    k.cyl('steel', 0.12, 0.02, [vx, 0.01, -d / 2 + 0.08], { seg: 18, tint: rust })

    const bx = -w / 2 + 0.2, bzb = -d / 2 + 0.12
    k.blk('steel', [0.06, 1.2, 0.06], bx - 0.1, 0, bzb, { r: 0.004, tint: rust })
    k.blk('paint', [0.3, 0.4, 0.15], bx, 0.8, bzb + 0.105, { r: 0.01, tint: [0.75, 0.75, 0.72] })
    const bf = bzb + 0.18
    k.box('paint', [0.26, 0.36, 0.01], [bx, 1.0, bf + 0.004], { r: 0.004, tint: [0.7, 0.7, 0.67] })
    k.knob([bx - 0.06, 1.06, bf + 0.009], 0.02, { m: 'rubber' })
    k.cyl('paint', 0.018, 0.02, [bx + 0.06, 1.06, bf + 0.018], { axis: 'z', seg: 12, tint: v === 2 ? [0.3, 0.1, 0.08] : [0.2, 0.75, 0.25] })
    k.cyl('paint', 0.022, 0.02, [bx + 0.06, 0.94, bf + 0.018], { axis: 'z', seg: 12, tint: [0.8, 0.12, 0.1] })
    k.cable('rubber', [bx, 0.81, bzb + 0.1], [mx - mlen * 0.1, sy + mr + 0.02 + mr * 1.04 + 0.035, 0], 0.1, 0.01)
    if (v === 2) k.cyl('glass', 0.18, 0.002, [dropX - 0.02, 0.001, 0.3], { seg: 20, tint: [0.45, 0.5, 0.55], scale: [1.3, 1, 1] })
  },

  'radio-console': (k, s) => {
    const { w, d } = k, v = s.variant, top = 0.75, broken = v === 2
    legFrame(k, 'steel', w, d, top - 0.03, { leg: 0.045, stretcher: 0.15, tint: [0.35, 0.37, 0.35] })
    k.blk('wood', [w, 0.03, d], 0, top - 0.03, 0, { r: 0.006, tint: [0.45, 0.42, 0.36] })

    const rw = w * 0.82, rd = 0.34, rz = -d / 2 + rd / 2, rf = rz + rd / 2, rh = 0.62, face = rf + 0.011
    k.blk('paint', [rw, rh, rd], 0, top, rz, { r: 0.008, tint: [0.32, 0.34, 0.3] })
    const units = [0.2, 0.22, 0.18], tints: V3[] = [[0.22, 0.24, 0.22], [0.5, 0.48, 0.42], [0.25, 0.27, 0.3]]
    let uy = top + 0.01
    units.forEach((uh, u) => {
      const yc = uy + uh / 2
      k.box('paint', [rw - 0.04, uh - 0.012, 0.012], [0, yc, rf + 0.005], { r: 0.004, tint: tints[u] })
      for (const sd of [-1, 1]) k.cyl('steel', 0.008, 0.006, [sd * (rw / 2 - 0.04), yc + uh * 0.3, face + 0.003], { axis: 'z', seg: 8, tint: CHROME })
      if (u === 0) {
        gauge(k, [-0.32, yc, face], 0.045)
        if (broken) k.box('rubber', [0.16, 0.07, 0.01], [0, yc + 0.02, face + 0.005], { r: 0.003 })
        else k.screen([0, yc + 0.02, face], 0.16, 0.07, { bezel: 0.01 })
        for (let i = 0; i < 4; i++) if (!(broken && i % 2)) k.knob([0.2 + (i % 2) * 0.1, yc + (i < 2 ? 0.04 : -0.04), face], 0.018, { m: 'rubber' })
      } else if (u === 1) {
        gauge(k, [0, yc, face], 0.07)
        for (const x of [-0.3, 0.3]) k.knob([x, yc, face], 0.024, { m: 'rubber' })
        for (let i = 0; i < 5; i++) k.box('steel', [0.012, 0.03, 0.012], [-0.42 + i * 0.03 + 0.2 * 0, yc - 0.07, face + 0.006], { r: 0.003, tint: CHROME })
      } else {
        k.vent([-0.25, yc, face], 0.3, uh * 0.6, { slats: 6 })
        for (const x of [0.12, 0.28]) gauge(k, [x, yc + 0.02, face], 0.035)
        k.box('steel', [0.03, 0.05, 0.02], [0.42, yc, face + 0.01], { r: 0.004, tint: DARK })
        k.cyl('paint', 0.012, 0.012, [0.42, yc + 0.06, face + 0.006], { axis: 'z', seg: 10, tint: broken ? [0.3, 0.1, 0.08] : [0.85, 0.15, 0.1] })
      }
      uy += uh
    })

    k.blk('paint', [0.3, 0.16, 0.2], -rw / 2 + 0.2, top + rh, rz + 0.02, { r: 0.012, tint: [0.25, 0.25, 0.27] })
    k.vent([-rw / 2 + 0.2, top + rh + 0.08, rz + 0.12], 0.22, 0.1, { slats: 5 })
    k.cyl('steel', 0.06, 0.02, [0.25, top + 0.01, 0.15], { seg: 16, tint: DARK })
    k.tube('steel', [[0.25, top + 0.015, 0.15], [0.25, top + 0.24, 0.1]], 0.008, { seg: 8, tint: CHROME })
    k.cyl('steel', 0.028, 0.08, [0.25, top + 0.26, 0.09], { axis: 'z', pitch: -0.3, seg: 14, tint: DARK })
    k.cable('rubber', [0.25, top + 0.01, 0.12], [0.25, top + 0.05, face - 0.002], 0.02, 0.004)
    for (const sd of broken ? [-1] : [-1, 1]) k.cyl('leather', 0.045, 0.03, [-0.25 + sd * 0.09, top + 0.015, 0.17], { seg: 16, tint: [0.15, 0.15, 0.16] })
    if (!broken) k.torus('steel', 0.09, 0.008, [-0.25, top + 0.026, 0.17], { axis: 'z', arc: Math.PI, roll: Math.PI / 2, segR: 16, seg: 6, tint: DARK })
    k.blk('paper', [0.22, 0.02, 0.3], 0.0, top, 0.17, { r: 0.002, tint: [0.85, 0.82, 0.7] })
    k.cyl('wood', 0.004, 0.15, [0.0, top + 0.0235, 0.1], { axis: 'x', seg: 6, tint: [0.9, 0.75, 0.2] })
    k.blk('wood', [0.08, 0.015, 0.14], 0.48, top, 0.18, { r: 0.004, tint: [0.3, 0.2, 0.12] })
    k.blk('steel', [0.02, 0.022, 0.02], 0.48, top + 0.015, 0.16, { r: 0.003, tint: BRASS })
    k.box('steel', [0.012, 0.012, 0.12], [0.48, top + 0.041, 0.18], { r: 0.003, tint: BRASS })
    k.cyl('rubber', 0.015, 0.012, [0.48, top + 0.053, 0.235], { seg: 12 })
    if (broken) for (let i = 0; i < 3; i++) k.box('paper', [0.21, 0.002, 0.29], [-0.45 + i * 0.45, 0.001, 0.05], { yaw: k.jitter(0.3), r: 0, tint: [0.95, 0.94, 0.9] })

    const ax = w / 2 - 0.05, az = -d / 2 + 0.04, mast = 2.02
    k.blk('steel', [0.06, 0.05, 0.06], ax, top, az, { r: 0.006, tint: DARK })
    k.cyl('steel', 0.02, mast - top, [ax, top + (mast - top) / 2, az], { seg: 12, tint: [0.7, 0.7, 0.72] })
    k.cyl('steel', 0.008, 0.24, [ax - 0.06, 1.95, az], { axis: 'x', seg: 8, tint: CHROME })
    k.tube('steel', [[ax, mast - 0.02, az], [ax + (broken ? 0.05 : 0), mast + 0.05, az]], 0.004, { seg: 6, tint: CHROME })
    k.cable('rubber', [rw / 2 - 0.05, top + rh - 0.05, rz - rd / 2 + 0.01], [ax, 1.5, az], 0.08, 0.006)
  },
}
