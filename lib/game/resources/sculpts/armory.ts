import { latheRaw, rboxRaw, type Kit, type Raw, type V2, type V3 } from '../../blockout/sculpt/kit'
import { bottle, coil, flask, radiusAt, sack, tin } from './archetypes'
import { circle, easeStations, fillet2, helix, inset, knurl, loftRaw, merge, place, ribs, rrect, rrectPath, seeded, sphereMesh, sweepRaw, type ResourceFamily } from './forms'
import { BLACK, BLUED, WALNUT, barrel, bore, onSide, ringMount } from './weapons'

const STEEL: V3 = [0.8, 0.81, 0.84], BRASS: V3 = [0.88, 0.7, 0.38], COPPER: V3 = [0.82, 0.5, 0.33], LEAD: V3 = [0.45, 0.46, 0.49]
const POLY: V3 = [0.13, 0.13, 0.14], WHITE: V3 = [0.93, 0.92, 0.88], RED: V3 = [0.78, 0.16, 0.1], NYLON: V3 = [0.2, 0.22, 0.18], SPRING: V3 = [0.6, 0.61, 0.65]

type Round = { len: number; r: number; neck: number; bullet: number; shoulder?: number; rim?: number }
const R9: Round = { len: 0.0192, r: 0.00495, neck: 0.0048, bullet: 0.0103 }
const R38: Round = { len: 0.0292, r: 0.0048, rim: 0.0055, neck: 0.0048, bullet: 0.008 }
const R556: Round = { len: 0.0447, r: 0.0048, neck: 0.0031, shoulder: 0.0362, bullet: 0.0125 }
const R762: Round = { len: 0.0388, r: 0.0056, neck: 0.0043, shoulder: 0.0305, bullet: 0.0172 }

function caseProfile(c: Round, hollow = false): V2[] {
  const head: V2[] = c.rim ? [[c.rim, 0], [c.rim, 0.0012], [c.r, 0.0014]] : [[c.r, 0], [c.r, 0.0011], [c.r * 0.8, 0.0015], [c.r * 0.8, 0.0025], [c.r, 0.0032]]
  const body: V2[] = c.shoulder ? [[c.r * 0.97, c.shoulder], [c.neck, c.shoulder + (c.r * 0.97 - c.neck) * 1.15], [c.neck, c.len]] : [[c.neck, c.len]]
  const mouth: V2[] = hollow ? [[c.neck - 0.0004, c.len], [c.neck - 0.0004, c.len * 0.35], [0, c.len * 0.35]] : [[0, c.len]]
  return [[0, 0], ...head, ...body, ...mouth]
}

function bulletProfile(c: Round): V2[] {
  const r = c.neck - 0.0003, out: V2[] = [[0, c.len - 0.0025], [r - 0.0009, c.len - 0.0025], [r - 0.0009, c.len + 0.0003], [r, c.len + 0.0009]]
  for (let i = 0; i <= 6; i++) { const t = i / 6; out.push([i === 6 ? 0 : r * Math.cos(t * Math.PI / 2) ** 0.85, c.len + 0.0009 + (c.bullet - 0.0009) * (0.25 + 0.75 * Math.sin(t * Math.PI / 2))]) }
  return out
}

function roundRaws(c: Round, at: V3, yaw = 0, seg = 14): [Raw, Raw] {
  return [place(latheRaw(caseProfile(c), { seg }).orient('x'), { at, yaw }), place(latheRaw(bulletProfile(c), { seg }).orient('x'), { at, yaw })]
}

function springX(k: Kit, R: number, wire: number, len: number, turns: number, at: V3, tint = SPRING) {
  k.put(place(sweepRaw(helix(R, len / turns, turns, { steps: 12 }), wire, { seg: 6 }), { at, roll: -Math.PI / 2 }), 'steel', { tint })
}

function scatter(rnd: () => number, n: number, area: [number, number], make: (i: number) => { len: number; r: number }, tries = 400) {
  const out: { x: number; z: number; yaw: number; len: number; r: number; i: number }[] = []
  const segDist = (a: [V2, V2], b: [V2, V2]) => {
    const pd = (p: V2, [s, e]: [V2, V2]) => { const dx = e[0] - s[0], dz = e[1] - s[1], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dz) / l)) : 0; return Math.hypot(p[0] - s[0] - t * dx, p[1] - s[1] - t * dz) }
    return Math.min(pd(a[0], b), pd(a[1], b), pd(b[0], a), pd(b[1], a))
  }
  const seg = (o: { x: number; z: number; yaw: number; len: number }): [V2, V2] => { const c = Math.cos(o.yaw) * o.len / 2, s = -Math.sin(o.yaw) * o.len / 2; return [[o.x - c, o.z - s], [o.x + c, o.z + s]] }
  for (let t = 0; t < tries && out.length < n; t++) {
    const { len, r } = make(out.length), o = { x: (rnd() - 0.5) * area[0], z: (rnd() - 0.5) * area[1], yaw: rnd() * Math.PI * 2, len, r, i: out.length }
    if (out.every((p) => segDist(seg(o), seg(p)) > o.r + p.r + 0.0012)) out.push(o)
  }
  return out
}

export const ARMORY: ResourceFamily = {
  'pistol-barrel': (k) => {
    const y = 0.0125

    k.extrude('steel', rrect(0.0145, 0.0155, 0.0016), 0.032, [-0.044, y, 0], { axis: 'x', bevel: 0.0008, holes: [circle(0.0048, 20)], tint: BLUED })
    k.extrude('steel', fillet2([[-0.058, 0.006], [-0.031, 0.006], [-0.035, 0], [-0.052, 0], [-0.058, 0.003]], 0.0012, 2, true), 0.0075, [0, 0, 0], { bevel: 0.0008, holes: [circle(0.0016, 12, -0.045, 0.0028)], tint: BLUED })
    bore(k, 'steel', barrel(0.0895, 0.0068, 0.0062, 0.0045), -0.0295, y, { tint: BLUED, seg: 24 })
  },
  'shotgun-barrel': (k) => {

    const y = 0.0148, x0 = -0.35
    const outer: V2[] = [[0.0148, 0], [0.0148, 0.035], [0.0128, 0.04], [0.0128, 0.075], [0.0118, 0.095], [0.0106, 0.62], [0.0104, 0.69], [0.0098, 0.7]]
    bore(k, 'steel', fillet2([[0.0093, 0], ...outer, [0.0093, 0.7], [0.0093, 0]], 0.0008, 2), x0, y, { tint: BLUED, seg: 28 })
    const rib = 0.0318, posts: Raw[] = []
    for (let x = -0.255; x < 0.335; x += 0.0345) { const top = y + radiusAt(outer, x - x0) - 0.001; posts.push(place(rboxRaw(0.006, rib - top + 0.0005, 0.005, { r: 0.0008 }), { at: [x, (rib + top) / 2, 0] })) }
    k.put(merge(...posts), 'steel', { tint: BLUED })
    k.box('steel', [0.62, 0.0022, 0.0075], [0.035, rib + 0.0011, 0], { r: 0.0005, tint: BLUED })
    k.sphere('steel', 0.0021, [0.34, rib + 0.0038, 0], { rows: 5, seg: 10, tint: [0.92, 0.88, 0.78] })
    k.box('steel', [0.022, 0.0055, 0.009], [-0.335, y + 0.0136 + 0.00275, 0], { r: 0.001, tint: BLUED })
  },
  'rifle-bolt': (k) => {
    const y = 0.0088

    bore(k, 'steel', fillet2([[0, 0], [0.0088, 0], [0.0088, 0.088], [0.0084, 0.09], [0.0064, 0.09], [0.0064, 0.087], [0, 0.087]], 0.0007, 2), -0.05, y, { tint: STEEL, seg: 28 })
    bore(k, 'steel', fillet2([[0, 0], [0.0076, 0], [0.0083, 0.004], [0.0083, 0.024], [0, 0.024]], 0.0008, 2), -0.072, y, { tint: BLUED, seg: 24 })
    k.box('steel', [0.016, 0.012, 0.0072], [-0.066, y + 0.006, 0], { r: 0.0015, tint: BLUED })
    for (const s of [-1, 1]) k.box('steel', [0.011, 0.0068, 0.0042], [0.0335, y, s * 0.0099], { r: 0.0008, tint: STEEL })
    k.box('steel', [0.034, 0.0018, 0.0036], [0.022, y + 0.0086, 0], { r: 0.0005, tint: STEEL })
    k.put(sweepRaw([[-0.034, y + 0.002, 0.005], [-0.035, y + 0.001, 0.016], [-0.037, y - 0.0015, 0.026], [-0.039, 0.0075, 0.032]], 0.0032, { seg: 10 }), 'steel', { tint: STEEL })
    k.sphere('steel', 0.0072, [-0.0395, 0.0072, 0.0365], { rows: 8, seg: 14, tint: STEEL })
  },
  'trigger-group': (k) => onSide(k, 0.0062, () => {

    k.extrude('steel', fillet2([[-0.012, -0.002], [-0.002, -0.006], [-0.001, -0.016], [0.004, -0.022], [0.0062, -0.02], [0.0032, -0.012], [0.004, -0.004], [0.008, 0.0], [0.006, 0.004], [-0.012, 0.004]], 0.001, 2, true), 0.0062, [0, 0, 0], { bevel: 0.0006, tint: BLUED })
    k.extrude('steel', [[-0.01, 0.0032], [0.0035, 0.0032], [0.0035, 0.0062], [-0.0095, 0.0072]], 0.003, [0, 0, 0], { bevel: 0.0004, tint: STEEL })
    k.extrude('steel', fillet2([[-0.027, -0.004], [-0.014, -0.004], [-0.013, 0.004], [-0.0135, 0.016], [-0.017, 0.021], [-0.022, 0.02], [-0.027, 0.012], [-0.028, 0.002]], 0.0012, 2, true), 0.008, [0, 0, 0], { bevel: 0.0007, tint: BLUED })
    k.cyl('steel', 0.0016, 0.0116, [0, 0, 0], { axis: 'z', seg: 12, tint: STEEL })
    k.cyl('steel', 0.0016, 0.0122, [-0.0205, 0.0015, 0], { axis: 'z', seg: 12, tint: STEEL })
    const spring = (cx: number, cy: number, z0: number, dir: 1 | -1, leg: V3) => {
      const pts = helix(0.0026, 0.0009, 2.5, { steps: 14 }).map(([hx, hy, hz]): V3 => [cx + hx, cy + hz, z0 + dir * hy])
      k.put(sweepRaw([...pts, leg], 0.00045, { seg: 5 }), 'steel', { tint: SPRING })
    }
    spring(0, 0, 0.0033, 1, [-0.011, -0.0045, 0.0036])
    spring(-0.0205, 0.0015, -0.0042, -1, [-0.006, -0.0025, -0.0036])
  }, [0.01, 0]),
  'recoil-spring': (k) => {
    const y = 0.006

    bore(k, 'steel', fillet2([[0, 0], [0.0058, 0], [0.0058, 0.0035], [0.0028, 0.005], [0.0019, 0.0065], [0.0019, 0.098], [0.0015, 0.1], [0, 0.1]], 0.0005, 2), -0.05, y, { tint: BLACK, seg: 18 })
    springX(k, 0.0042, 0.00065, 0.085, 30, [-0.0445, y, 0])
    bore(k, 'steel', [[0.0026, 0], [0.0036, 0], [0.0036, 0.0012], [0.0026, 0.0012], [0.0026, 0]], 0.0406, y, { tint: BLACK, seg: 16 })
  },
  'firing-pin': (k) => {
    const y = 0.0036

    bore(k, 'steel', fillet2([[0, 0], [0.0024, 0], [0.0024, 0.012], [0.0036, 0.0125], [0.0036, 0.016], [0.0016, 0.0168], [0.0016, 0.05], [0.0011, 0.055], [0.0007, 0.058], [0, 0.0585]], 0.0003, 2), -0.03, y, { tint: STEEL, seg: 16 })
    springX(k, 0.0024, 0.0004, 0.0264, 12, [-0.0135, y, 0])
  },
  'pistol-magazine': (k) => {

    const st = easeStations([{ y: 0.0075, rx: 0.0152, rz: 0.0112, p: 5 }, { y: 0.1, rx: 0.0152, rz: 0.0112, p: 5 }, { y: 0.116, rx: 0.0149, rz: 0.0086, p: 4.5 }, { y: 0.122, rx: 0.0146, rz: 0.0072, p: 4 }], 3)
    k.put(loftRaw(st, { seg: 36 }), 'steel', { tint: BLACK })
    k.box('rubber', [0.0356, 0.009, 0.0256], [0.0006, 0.0045, 0], { r: 0.003, tint: POLY })
    const [c, b] = roundRaws(R9, [-0.0146, 0.1222 + 0.0049 - 0.0022, 0])
    k.put(c, 'steel', { tint: BRASS })
    k.put(b, 'steel', { tint: COPPER })
    k.put(merge(...[0.032, 0.05, 0.068, 0.086].map((yy) => place(latheRaw([[0, 0], [0.0016, 0], [0.0016, 0.002], [0, 0.002]], { seg: 10 }).orient('x'), { at: [-0.0161, yy, 0] }))), 'steel', { tint: BRASS })
  },
  'rifle-magazine': (k) => {

    const front: V2[] = [], back: V2[] = [], spine: V2[] = [], tint: V3 = [0.5, 0.22, 0.1]
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, sx = 0.02 - 0.04 * t * t, half = 0.031 - 0.002 * t, y = 0.008 + 0.165 * t
      front.push([sx + half, y]); back.push([sx - half, y]); spine.push([sx, y])
    }
    k.extrude('paint', fillet2([...front, ...back.reverse()], 0.004, 3, true), 0.024, [0, 0, 0], { bevel: 0.006, bevelSeg: 3, tint })
    for (const s of [-1, 1]) for (const off of [-0.012, 0.012]) k.put(sweepRaw(spine.slice(1, 12).map(([x, y]): V3 => [x + off, y, s * 0.012]), 0.0011, { seg: 6 }), 'paint', { tint })
    k.box('steel', [0.066, 0.009, 0.028], [0.02, 0.0045, 0], { r: 0.0015, tint: [0.25, 0.25, 0.27] })
    k.box('steel', [0.058, 0.006, 0.02], [-0.02, 0.1755, 0], { r: 0.001, tint: [0.25, 0.25, 0.27] })
    const [c, b] = roundRaws(R762, [-0.048, 0.1785 + 0.0056 - 0.002, 0])
    k.put(c, 'steel', { tint: BRASS })
    k.put(b, 'steel', { tint: COPPER })
  },
  'rifle-scope': (k) => {
    const y = 0.0222, x0 = -0.15

    const prof: V2[] = [[0, 0.004], [0.0165, 0.004], [0.0165, 0], [0.0192, 0], [0.0192, 0.042], [0.0146, 0.062], [0.0146, 0.066], [0.0146, 0.071], [0.0146, 0.076], [0.0146, 0.08], [0.0128, 0.083], [0.0128, 0.115], [0.0158, 0.12], [0.0158, 0.16], [0.0128, 0.165], [0.0128, 0.2], [0.0205, 0.24], [0.0222, 0.244], [0.0222, 0.3], [0.0198, 0.3], [0.0198, 0.2955], [0, 0.2955]]
    bore(k, 'steel', fillet2(prof, 0.0008, 2), x0, y, { tint: BLACK, seg: 32, wear: (x, yy, z) => (yy > 0.064 && yy < 0.078 ? knurl(36, 0.0005)(x, yy, z) : 0) })
    k.cyl('glass', 0.0158, 0.002, [x0 + 0.004, y, 0], { axis: 'x', seg: 24, tint: [0.3, 0.45, 0.42] })
    k.cyl('glass', 0.0191, 0.002, [x0 + 0.2955, y, 0], { axis: 'x', seg: 28, tint: [0.3, 0.45, 0.42] })
    const turret = fillet2([[0, 0], [0.0105, 0], [0.0105, 0.004], [0.0094, 0.0046], [0.0094, 0.0075], [0.0094, 0.0115], [0.0094, 0.0145], [0.0084, 0.0152], [0, 0.0152]], 0.0005, 2)
    const knurled = (x: number, yy: number, z: number) => (yy > 0.0055 && yy < 0.0135 ? knurl(24, 0.0005)(x, yy, z) : 0)
    k.lathe('steel', turret, [x0 + 0.14, y + 0.0148, 0], { seg: 28, tint: BLACK, wear: knurled })
    k.lathe('steel', turret, [x0 + 0.14, y, 0.0148], { axis: 'z', seg: 28, tint: BLACK, wear: knurled })
    k.frame({ at: [x0 + 0.14, y, -0.0148], yaw: Math.PI }, () => k.lathe('steel', turret, [0, 0, 0], { axis: 'z', seg: 28, tint: BLACK, wear: knurled }))
  },
  'red-dot-sight': (k) => {
    const y = 0.0302, x0 = -0.045

    k.extrude('steel', [[-0.011, 0], [0.011, 0], [0.011, 0.002], [0.0085, 0.0045], [0.0085, 0.0075], [0.0125, 0.0105], [0.0125, 0.016], [-0.0125, 0.016], [-0.0125, 0.0105], [-0.0085, 0.0075], [-0.0085, 0.0045], [-0.011, 0.002]], 0.04, [0, 0, 0], { axis: 'x', bevel: 0.0008, tint: BLACK })
    bore(k, 'steel', fillet2([[0, 0.004], [0.0135, 0.004], [0.0135, 0], [0.0165, 0], [0.0165, 0.064], [0.0176, 0.069], [0.0176, 0.09], [0.0152, 0.09], [0.0152, 0.0855], [0, 0.0855]], 0.0007, 2), x0, y, { tint: BLACK, seg: 32 })
    k.cyl('glass', 0.0128, 0.002, [x0 + 0.004, y, 0], { axis: 'x', seg: 24, tint: [0.35, 0.45, 0.5] })
    k.cyl('glass', 0.0145, 0.002, [x0 + 0.0855, y, 0], { axis: 'x', seg: 24, tint: [0.8, 0.4, 0.18] })
    const knob = fillet2([[0, 0], [0.0078, 0], [0.0078, 0.003], [0.0078, 0.006], [0.0078, 0.0095], [0.0068, 0.0102], [0, 0.0102]], 0.0005, 2)
    const knurled = (x: number, yy: number, z: number) => (yy > 0.002 && yy < 0.009 ? knurl(20, 0.0004)(x, yy, z) : 0)
    k.lathe('steel', knob, [0.002, y + 0.0155, 0], { seg: 24, tint: BLACK, wear: knurled })
    k.lathe('steel', knob, [0.002, y, 0.0155], { axis: 'z', seg: 24, tint: BLACK, wear: knurled })
    k.frame({ at: [-0.016, y, -0.0155], yaw: Math.PI }, () => k.lathe('steel', fillet2([[0, 0], [0.0092, 0], [0.0092, 0.0035], [0.0092, 0.007], [0.0092, 0.0105], [0.008, 0.0112], [0, 0.0112]], 0.0006, 2), [0, 0, 0], { axis: 'z', seg: 28, tint: BLACK, wear: (x, yy, z) => (yy > 0.002 && yy < 0.01 ? knurl(28, 0.0005)(x, yy, z) : 0) }))
    k.cyl('steel', 0.0075, 0.006, [0, 0.0095, 0.0125 + 0.0026], { axis: 'z', seg: 20, tint: [0.25, 0.25, 0.27] })
  },
  'wooden-stock': (k) => onSide(k, 0.02, () => {

    k.extrude('wood', fillet2([[-0.165, -0.06], [0.045, -0.035], [0.06, -0.055], [0.085, -0.05], [0.11, -0.022], [0.175, -0.02], [0.175, -0.004], [0.15, -0.004], [0.15, 0.012], [0.175, 0.012], [0.175, 0.03], [0.1, 0.03], [0.04, 0.036], [-0.05, 0.05], [-0.165, 0.055]], 0.004, 3, true), 0.038, [0, 0, 0], { bevel: 0.005, bevelSeg: 3, tint: WALNUT })
    k.extrude('paint', [[-0.1672, -0.0608], [-0.1645, -0.0605], [-0.1645, 0.0555], [-0.1672, 0.0558]], 0.0386, [0, 0, 0], { bevel: 0.0005, tint: WHITE })
    k.extrude('rubber', fillet2([[-0.182, -0.062], [-0.1668, -0.0612], [-0.1668, 0.0562], [-0.182, 0.057]], 0.003, 2, true), 0.0396, [0, 0, 0], { bevel: 0.003, bevelSeg: 2, tint: POLY })
    k.extrude('paint', [[0.058, -0.0535], [0.087, -0.0485], [0.0895, -0.0525], [0.06, -0.0585]], 0.032, [0, 0, 0], { bevel: 0.001, tint: POLY })
    k.cyl('steel', 0.0034, 0.008, [-0.12, -0.057, 0], { seg: 14, tint: STEEL })
  }),
  'gun-cleaning-kit': (k) => {

    k.box('fabric', [0.25, 0.02, 0.12], [0, 0.01, 0], { r: 0.006, tint: NYLON })
    k.put(sweepRaw(rrectPath(0.251, 0.121, 0.0065, 0.011), 0.0016, { closed: true, seg: 6, radius: ribs(0.0028, 0.3) }), 'rubber', { tint: [0.1, 0.1, 0.1] })
    k.box('fabric', [0.234, 0.0026, 0.104], [0, 0.0206, 0], { r: 0.001, tint: [0.55, 0.12, 0.1] })
    const top = 0.0219, rods: Raw[] = [], brushes: Raw[] = []
    for (const z of [-0.042, -0.035, -0.028]) rods.push(place(latheRaw(fillet2([[0, 0], [0.0016, 0], [0.0016, 0.006], [0.0024, 0.0065], [0.0024, 0.094], [0.0018, 0.095], [0, 0.095]], 0.0003, 2), { seg: 10 }).orient('x'), { at: [-0.112, top + 0.0019, z] }))
    k.put(merge(...rods), 'steel', { tint: BRASS })
    k.lathe('rubber', fillet2([[0, 0], [0.0085, 0], [0.0095, 0.02], [0.009, 0.045], [0.0075, 0.055], [0.004, 0.058], [0, 0.058]], 0.002, 2), [0.002, top + 0.0088, -0.035], { axis: 'x', seg: 18, tint: POLY })
    const brush: V2[] = [[0, 0], [0.0015, 0], [0.0015, 0.022]]
    for (let i = 0; i <= 12; i++) brush.push([0.0047 + (i % 2) * 0.0007, 0.024 + i * 0.0024])
    brush.push([0.0012, 0.0545], [0, 0.0545])
    for (const [i, z] of [-0.005, 0.01, 0.025].entries()) brushes.push(place(latheRaw(brush, { seg: 14 }).orient('x'), { at: [-0.11, top + 0.0049 - (i === 0 ? 0.0002 : 0), z] }))
    k.put(merge(...brushes), 'steel', { tint: [0.74, 0.5, 0.3] })
    k.lathe('steel', [[0, 0], [0.0015, 0], [0.0015, 0.012], [0.0034, 0.0125], [0.0034, 0.015], [0.0028, 0.016], [0.0034, 0.017], [0.0028, 0.018], [0.0034, 0.019], [0.0028, 0.02], [0.0034, 0.021], [0.0026, 0.024], [0, 0.0245]], [0.072, top + 0.0031, 0.038], { axis: 'x', seg: 12, tint: BRASS })
    bottle(k, 0.0115, 0.055, { at: [0.002, top + 0.0112, 0.02], roll: -Math.PI / 2, m: 'paint', tint: [0.14, 0.3, 0.62], shoulder: 0.75, cap: { kind: 'screw', tint: POLY, m: 'paint' }, labels: [{ y0: 0.18, y1: 0.68, tint: [0.95, 0.85, 0.3] }] })
    k.box('fabric', [0.036, 0.009, 0.036], [0.09, top + 0.004, -0.025], { r: 0.001, tint: WHITE })
    for (const x of [-0.09, -0.04]) k.box('fabric', [0.012, 0.0016, 0.032], [x, top + 0.0019 + 0.0024 + 0.0006, -0.035], { r: 0.0004, tint: [0.1, 0.1, 0.1] })
  },
  'gun-oil': (k) => bottle(k, 0.0185, 0.08, { m: 'paint', tint: [0.92, 0.9, 0.84], shoulder: 0.72, neck: 0.0062, neckH: 0.012, cap: { kind: 'dropper', tint: RED, h: 0.02 }, labels: [{ y0: 0.12, y1: 0.66, tint: [0.12, 0.32, 0.2] }, { y0: 0.3, y1: 0.48, tint: [0.95, 0.8, 0.3], arc: 2.2 }] }),
  suppressor: (k) => {
    const y = 0.0195, x0 = -0.085

    bore(k, 'paint', fillet2([[0, 0], [0.0178, 0], [0.0178, 0.006], [0.0178, 0.012], [0.0178, 0.018], [0.0178, 0.024], [0.0178, 0.028], [0.0195, 0.03], [0.0195, 0.164], [0.0183, 0.168], [0.011, 0.1705], [0.0056, 0.171], [0.0056, 0.1665], [0, 0.1665]], 0.001, 2), x0, y, { tint: BLACK, seg: 32, wear: (x, yy, z) => (yy > 0.004 && yy < 0.026 ? knurl(36, 0.0006)(x, yy, z) : 0) })
    k.extrude('steel', circle(0.0165, 6, 0, 0, Math.PI / 6), 0.014, [x0 - 0.006, y, 0], { axis: 'x', bevel: 0.001, holes: [circle(0.0072, 18)], tint: [0.27, 0.27, 0.29] })
  },
  'gun-sling': (k) => {

    const t = 0.0032, uOut: V2[] = [], uIn: V2[] = [], hw: V3 = [0.3, 0.3, 0.32]
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + Math.PI * i / 10; uOut.push([0.115 + Math.cos(a) * 0.027, Math.sin(a) * 0.027]); uIn.push([0.115 + Math.cos(a) * 0.002, Math.sin(a) * 0.002]) }
    k.extrude('fabric', [[-0.15, -0.027], ...uOut, [-0.15, 0.027], [-0.15, 0.002], ...uIn.reverse(), [-0.15, -0.002]], t, [0, t / 2, 0], { axis: 'y', bevel: 0.0008, tint: NYLON })
    k.extrude('steel', rrect(0.017, 0.031, 0.002), 0.0024, [-0.06, t + 0.0004, -0.0145], { axis: 'y', bevel: 0.0004, holes: [rrect(0.0035, 0.026, 0.001, 2, -0.004, 0), rrect(0.0035, 0.026, 0.001, 2, 0.004, 0)], tint: hw })
    for (const z of [-0.0145, 0.0145]) {
      k.torus('steel', 0.0115, 0.0017, [-0.1595, 0.0017, z], { seg: 6, segR: 20, tint: hw })
      k.cyl('steel', 0.0045, 0.012, [-0.1765, 0.0045, z], { axis: 'x', seg: 14, tint: hw })
      k.cyl('steel', 0.0022, 0.003, [-0.18, 0.0095, z], { seg: 10, tint: [0.6, 0.6, 0.63] })
    }
  },
  holster: (k) => {
    const t = 0.032, outline = fillet2([[-0.052, 0.098], [0.032, 0.098], [0.052, 0.07], [0.048, -0.098], [0.002, -0.1], [-0.008, -0.03], [-0.05, 0.01], [-0.06, 0.065]], 0.008, 3, true)

    k.extrude('leather', outline, t, [0, t / 2, 0], { axis: 'y', bevel: 0.007, bevelSeg: 3, tint: [0.42, 0.24, 0.13] })
    k.put(sweepRaw(inset(outline, 0.0105).map(([x, oy]): V3 => [x, t + 0.0001, -oy]), 0.0007, { closed: true, seg: 5, radius: ribs(0.004, 0.35) }), 'fabric', { tint: [0.85, 0.8, 0.65] })
    k.box('leather', [0.07, 0.003, 0.017], [0.002, t + 0.0007, -0.08], { r: 0.001, tint: [0.32, 0.18, 0.1] })
    k.cyl('steel', 0.0055, 0.0026, [0.022, t + 0.0028, -0.08], { seg: 16, tint: [0.75, 0.72, 0.65] })
  },
  'weapon-light': (k) => {
    const y = 0.0155, x0 = -0.07

    const knurled = (x: number, yy: number, z: number) => ((yy > 0.02 && yy < 0.04) || (yy > 0.062 && yy < 0.085) ? knurl(30, 0.0006)(x, yy, z) : 0)
    bore(k, 'paint', fillet2([[0, 0], [0.0108, 0], [0.0112, 0.004], [0.0112, 0.012], [0.0125, 0.013], [0.0125, 0.022], [0.0125, 0.03], [0.0125, 0.038], [0.0125, 0.064], [0.0125, 0.072], [0.0125, 0.08], [0.0125, 0.09], [0.0155, 0.1], [0.0155, 0.14], [0.0128, 0.14], [0.0128, 0.1365], [0, 0.1365]], 0.0008, 2), x0, y, { tint: BLACK, seg: 32, wear: knurled })
    k.cyl('glass', 0.0121, 0.002, [x0 + 0.1365, y, 0], { axis: 'x', seg: 28, tint: [0.75, 0.78, 0.8] })
    k.put(merge(...Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2; return place(rboxRaw(0.004, 0.0028, 0.004, { r: 0.0006 }), { at: [x0 + 0.1415, y + Math.cos(a) * 0.0142, Math.sin(a) * 0.0142], pitch: a }) })), 'paint', { tint: BLACK })
    k.frame({ at: [x0 + 0.001, y, 0], yaw: Math.PI }, () => k.lathe('rubber', [[0, 0], [0.0085, 0], [0.0082, 0.002], [0.0055, 0.0042], [0, 0.0048]], [0, 0, 0], { axis: 'x', seg: 20, tint: POLY }))
    k.extrude('steel', ringMount(y, 0.0158, 0.0075, y - 0.024).map(([x, yy]): V2 => [x, 2 * y - yy]), 0.012, [x0 + 0.051, 0, 0], { axis: 'x', bevel: 0.0008, holes: [circle(0.0133, 28, 0, y)], tint: [0.25, 0.25, 0.27] })
    k.cyl('steel', 0.0038, 0.006, [x0 + 0.051, y + 0.019, 0.0101], { axis: 'z', seg: 14, tint: [0.25, 0.25, 0.27] })
  },

  'smokeless-powder': (k) => flask(k, [{ y: 0, rx: 0.045, rz: 0.045, p: 3.2 }, { y: 0.004, rx: 0.048, rz: 0.048, p: 3.2 }, { y: 0.098, rx: 0.048, rz: 0.048, p: 3.2 }, { y: 0.11, rx: 0.041, rz: 0.041, p: 2.6 }, { y: 0.117, rx: 0.03, rz: 0.03, p: 2.2 }], { m: 'paint', tint: [0.14, 0.14, 0.15], neck: { r: 0.021, h: 0.011, cap: 'screw', tint: RED, capH: 0.016 }, labels: [{ y0: 0.016, y1: 0.092, a0: -0.75, a1: 0.75, tint: [0.92, 0.74, 0.18] }, { y0: 0.016, y1: 0.092, a0: Math.PI - 0.75, a1: Math.PI + 0.75, tint: [0.92, 0.74, 0.18] }] }),
  'black-powder': (k) => tin(k, 0.044, 0.094, { lid: 'cone', tint: [0.18, 0.18, 0.2], capTint: [0.78, 0.62, 0.3], labels: [{ y0: 0.12, y1: 0.86, tint: [0.88, 0.82, 0.7] }, { y0: 0.38, y1: 0.62, tint: [0.72, 0.12, 0.08], arc: 2.4 }] }),
  primers: (k) => {

    k.box('paper', [0.08, 0.012, 0.06], [0, 0.006, 0], { r: 0.0008, tint: [0.9, 0.86, 0.75] })
    const cups: Raw[] = []
    for (let i = 0; i < 5; i++) for (let j = 0; j < 10; j++) cups.push(place(latheRaw([[0, 0], [0.0022, 0], [0.0022, 0.0028], [0.0017, 0.0029], [0, 0.0029]], { seg: 10 }), { at: [0.0135 + i * 0.0058, 0.0105, -0.0261 + j * 0.0058] }))
    k.put(merge(...cups), 'steel', { tint: [0.82, 0.55, 0.38] })
    k.box('paper', [0.05, 0.0018, 0.0636], [-0.015, 0.0159, 0], { r: 0.0005, tint: RED })
    for (const s of [-1, 1]) k.box('paper', [0.05, 0.0168, 0.0016], [-0.015, 0.0084, s * 0.0316], { r: 0.0004, tint: RED })
    k.box('paper', [0.03, 0.0012, 0.04], [-0.017, 0.0172, 0], { r: 0.0003, tint: WHITE })
  },
  'brass-casings': (k) => {

    const rnd = seeded(41), kinds = [R9, R38, R556, R762, R9], raws: Raw[] = []
    const picks = scatter(rnd, 22, [0.11, 0.09], (i) => { const c = kinds[i % kinds.length]; return i >= 18 ? { len: 0, r: c.rim ?? c.r } : { len: c.len, r: c.rim ?? c.r } })
    for (const p of picks) {
      const c = kinds[p.i % kinds.length]
      if (p.len === 0) raws.push(place(latheRaw(caseProfile(c, true), { seg: 12 }), { at: [p.x, 0, p.z] }))
      else raws.push(place(latheRaw(caseProfile(c, true), { seg: 12 }).orient('x'), { at: [p.x - Math.cos(p.yaw) * c.len / 2, c.rim ?? c.r, p.z + Math.sin(p.yaw) * c.len / 2], yaw: p.yaw }))
    }
    k.put(merge(...raws), 'steel', { tint: BRASS })
  },
  'lead-shot': (k) => {

    sack(k, 0.075, 0.048, 0.1, { m: 'fabric', ends: 'tied', tint: [0.86, 0.8, 0.66], seed: 7, wrinkle: 0.5, tie: [0.55, 0.4, 0.25], prints: [{ tint: [0.2, 0.25, 0.45], u0: 0.2, u1: 0.8, v0: 0.3, v1: 0.6 }] })
    const rnd = seeded(9), shot: Raw[] = []
    for (let i = 0; i < 16; i++) { const a = (rnd() - 0.5) * 2.2, d = 0.056 + rnd() * 0.03; shot.push(place(sphereMesh(0.0019, 4, 8), { at: [Math.sin(a) * d * 0.6, 0.0019, Math.cos(a) * d] })) }
    k.put(merge(...shot), 'steel', { tint: LEAD })
  },
  'bullet-heads': (k) => {

    const w = 0.072, d = 0.054, h = 0.02, blue: V3 = [0.16, 0.3, 0.58]
    k.box('paper', [w, 0.0016, d], [0, 0.0008, 0], { r: 0.0004, tint: blue })
    k.extrude('paper', rrect(w, d, 0.0015), h, [0, 0.0016 + h / 2, 0], { axis: 'y', holes: [rrect(w - 0.0028, d - 0.0028, 0.0008)], bevel: 0.0003, tint: blue })
    const stand: V2[] = [[0, 0], [0.0045, 0], [0.0045, 0.006]]
    for (let i = 1; i <= 6; i++) { const t = i / 6; stand.push([i === 6 ? 0 : 0.0045 * Math.cos(t * Math.PI / 2) ** 0.85, 0.006 + 0.0095 * Math.sin(t * Math.PI / 2)]) }
    const heads: Raw[] = []
    for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) heads.push(place(latheRaw(stand, { seg: 12 }), { at: [-0.0291 + i * 0.0097, 0.0012, -0.0194 + j * 0.0097] }))
    k.put(merge(...heads), 'steel', { tint: COPPER })
  },
  arrows: (k) => {

    const vane = fillet2([[-0.355, 0.0035], [-0.35, 0.0125], [-0.335, 0.0128], [-0.29, 0.0035]], 0.002, 2, true), y = 0.0055
    for (const [i, z] of [-0.036, -0.012, 0.012, 0.036].entries()) k.frame({ at: [0, 0, z], yaw: (i - 1.5) * 0.01 }, () => {
      k.lathe('wood', [[0, 0], [0.0038, 0], [0.004, 0.02], [0.004, 0.7], [0.0038, 0.705], [0, 0.705]], [-0.37, y, 0], { axis: 'x', seg: 12, tint: [0.8, 0.6, 0.4] })
      k.lathe('steel', fillet2([[0, 0], [0.0039, 0], [0.0041, 0.018], [0.0016, 0.026], [0, 0.0275]], 0.0005, 2), [0.333, y, 0], { axis: 'x', seg: 12, tint: STEEL })
      k.lathe('paint', [[0, 0], [0.0042, 0], [0.0042, 0.006], [0.0028, 0.009], [0.0028, 0.014], [0, 0.014]], [-0.374, y, 0], { axis: 'x', seg: 12, tint: [0.95, 0.45, 0.1] })
      for (const [j, a] of [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3].entries()) k.frame({ at: [0, y, 0], pitch: a }, () => k.extrude('paint', vane, 0.0008, [0, 0, 0], { bevel: 0.0002, tint: j === 0 ? [0.95, 0.45, 0.1] : WHITE }))
    })
  },
  'crossbow-bolts': (k) => {

    const vane = fillet2([[-0.19, 0.004], [-0.186, 0.0125], [-0.175, 0.0128], [-0.14, 0.004]], 0.002, 2, true), y = 0.0062
    for (const [i, z] of [-0.0345, -0.0115, 0.0115, 0.0345].entries()) k.frame({ at: [0, 0, z], yaw: (i - 1.5) * 0.012 }, () => {
      k.lathe('steel', [[0, 0], [0.0042, 0], [0.0045, 0.004], [0.0045, 0.37], [0, 0.37]], [-0.2, y, 0], { axis: 'x', seg: 14, tint: i % 2 ? [0.22, 0.22, 0.24] : [0.4, 0.45, 0.28] })
      k.lathe('paint', [[0, 0], [0.0046, 0], [0.0046, 0.008], [0.003, 0.012], [0, 0.012]], [-0.206, y, 0], { axis: 'x', seg: 12, tint: [0.9, 0.85, 0.2] })
      for (const [j, a] of [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3].entries()) k.frame({ at: [0, y, 0], pitch: a }, () => k.extrude('paint', vane, 0.0009, [0, 0, 0], { bevel: 0.0002, tint: j === 0 ? [0.9, 0.85, 0.2] : BLACK }))
      if (i % 2 === 0) k.lathe('steel', fillet2([[0, 0], [0.0044, 0], [0.0046, 0.02], [0.0018, 0.03], [0, 0.031]], 0.0005, 2), [0.168, y, 0], { axis: 'x', seg: 14, tint: STEEL })
      else {
        k.lathe('steel', [[0, 0], [0.0044, 0], [0.0036, 0.022], [0.0012, 0.034], [0, 0.035]], [0.168, y, 0], { axis: 'x', seg: 14, tint: [0.3, 0.3, 0.32] })
        for (const a of [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3]) k.frame({ at: [0, y, 0], pitch: a }, () => k.extrude('steel', [[0.172, 0.0025], [0.178, 0.0115], [0.184, 0.012], [0.203, 0.0012], [0.2, 0.0025]], 0.0009, [0, 0, 0], { bevel: 0.0002, tint: STEEL }))
      }
    })
  },
  'fuse-cord': (k) => coil(k, 'fabric', 0.045, 0.0028, 7, { tint: [0.24, 0.19, 0.14], lay: 'rope', seed: 5, tails: 0.05, ties: { tint: [0.85, 0.72, 0.3], count: 2, m: 'paper' } }),
  dynamite: (k) => {

    const r = 0.0142, L = 0.2, pitch = 0.0288
    const stick = fillet2([[0, 0], [r * 0.55, 0], [r * 0.9, 0.003], [r, 0.008], [r, L - 0.008], [r * 0.9, L - 0.003], [r * 0.55, L], [0, L]], 0.002, 2)
    for (const z of [-pitch, 0, pitch]) {
      k.lathe('paper', stick, [-L / 2, r, z], { axis: 'x', seg: 24, tint: [0.78, 0.2, 0.12] })
      k.lathe('paper', [[r + 0.0012, 0.07], [r + 0.0012, 0.13]], [-L / 2, r, z], { axis: 'x', seg: 24, tint: [0.92, 0.86, 0.68] })
    }
    const stadium = (R: number): V2[] => {
      const pts: V2[] = []
      for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + Math.PI * i / 12; pts.push([pitch + Math.cos(a) * R, r + Math.sin(a) * R]) }
      for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + Math.PI * i / 12; pts.push([-pitch + Math.cos(a) * R, r + Math.sin(a) * R]) }
      return pts
    }
    for (const x of [-0.06, 0.04]) k.extrude('rubber', stadium(r + 0.0013), 0.014, [x, 0, 0], { axis: 'x', holes: [stadium(r + 0.0003)], bevel: 0.0003, tint: BLACK })
    k.cyl('steel', 0.0034, 0.012, [L / 2, r, 0], { axis: 'x', seg: 14, tint: [0.75, 0.76, 0.78] })
    k.put(sweepRaw([[L / 2 + 0.004, r, 0], [0.115, r + 0.002, 0.002], [0.13, r - 0.004, 0.01], [0.145, 0.0032, 0.022], [0.165, 0.0026, 0.03]], 0.0026, { seg: 8 }), 'fabric', { tint: [0.24, 0.19, 0.14] })
  },
}
