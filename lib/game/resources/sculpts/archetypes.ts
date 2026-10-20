import { clamp, Raw, type Kit, type Mat, type V2, type V3 } from '../../blockout/sculpt/kit'
import { coilLoops, easeStations, fillet2, knurl, loftRaw, patchRaw, pillow, ribs, ropeLay, rrect, screwCap, serrated, sweepRaw, type Station } from './forms'

const TAU = Math.PI * 2
export type Place = { at?: V3; yaw?: number; pitch?: number; roll?: number }
export type Print = { tint: V3; m?: Mat }

function section(st: Station, a: number) {
  const p = st.p ?? 2, c = Math.cos(a), s = Math.sin(a)
  const x = st.rx * Math.sign(c) * Math.abs(c) ** (2 / p), z = st.rz * Math.sign(s) * Math.abs(s) ** (2 / p)
  const gx = Math.sign(c) * Math.abs(x / st.rx) ** (p - 1) / st.rx, gz = Math.sign(s) * Math.abs(z / st.rz) ** (p - 1) / st.rz
  const l = Math.hypot(gx, gz) || 1
  return { x: x + (st.cx ?? 0), z: z + (st.cz ?? 0), nx: gx / l, nz: gz / l }
}

export function stationAt(stations: Station[], y: number): Station {
  if (y <= stations[0].y) return { ...stations[0], y }
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1], b = stations[i]
    if (y > b.y) continue
    const t = (y - a.y) / Math.max(1e-9, b.y - a.y), mix = (u = 0, v = 0) => u + (v - u) * t
    return { y, rx: mix(a.rx, b.rx), rz: mix(a.rz, b.rz), p: mix(a.p ?? 2, b.p ?? 2), cx: mix(a.cx, b.cx), cz: mix(a.cz, b.cz) }
  }
  return { ...stations[stations.length - 1], y }
}

export function bandRaw(stations: Station[], y0: number, y1: number, a0 = 0, a1 = TAU, off = 0.0012, seg = 28): Raw {
  const m = new Raw(), rows = Math.max(2, Math.ceil((y1 - y0) / 0.008)), grid: number[][] = []
  for (let i = 0; i <= rows; i++) {
    const y = y0 + (y1 - y0) * i / rows, st = stationAt(stations, y), row: number[] = []
    let u = 0, px = 0, pz = 0
    for (let j = 0; j <= seg; j++) {
      const q = section(st, a0 + (a1 - a0) * j / seg), x = q.x + q.nx * off, z = q.z + q.nz * off
      if (j > 0) u += Math.hypot(x - px, z - pz)
      px = x; pz = z
      row.push(m.v(x, y, z, q.nx, 0, q.nz, u, y))
    }
    grid.push(row)
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) m.quad(grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j])
  return m
}

export function radiusAt(sil: V2[], y: number) {
  for (let i = 1; i < sil.length; i++) {
    const [r0, y0] = sil[i - 1], [r1, y1] = sil[i]
    if (y >= Math.min(y0, y1) && y <= Math.max(y0, y1) && y1 !== y0) return r0 + (r1 - r0) * (y - y0) / (y1 - y0)
  }
  return sil[sil.length - 1][0]
}

export type Closure = 'screw' | 'cork' | 'crimp' | 'flip' | 'dropper' | 'sport' | 'none'

export function closure(k: Kit, kind: Closure, neck: number, lip: number, top: number, tint: V3, o: { h?: number; m?: Mat; bore?: number } = {}) {
  const m = o.m ?? 'paint', R = neck + lip + 0.0012
  if (kind === 'screw') { const h = o.h ?? Math.max(0.011, neck * 1.1); screwCap(k, m, R, h, [0, top - h + Math.max(0.0016, h * 0.12), 0], { tint }) }
  if (kind === 'flip') {
    const h = o.h ?? Math.max(0.014, neck * 1.4)

    k.lathe(m, fillet2([[0, top - h * 0.55], [R + 0.002, top - h * 0.55], [R + 0.002, top + h * 0.3 - 0.002], [R, top + h * 0.3], [0, top + h * 0.3]], 0.0015, 2), [0, 0, 0], { seg: 28, tint })
    k.box(m, [R * 0.7, 0.002, 0.004], [0, top + h * 0.3 - 0.0035, R + 0.0026], { r: 0.0008, tint })
  }
  if (kind === 'sport') {
    const h = o.h ?? 0.014
    screwCap(k, m, R + 0.001, h, [0, top - h + 0.0035, 0], { tint })
    k.lathe(m, [[0, top + 0.001], [R * 0.6, top + 0.001], [R * 0.55, top + 0.009], [R * 0.32, top + 0.012], [R * 0.3, top + 0.016], [0, top + 0.016]], [0, 0, 0], { seg: 20, tint: tint.map((c) => c * 0.8) as V3 })
  }
  if (kind === 'dropper') {
    const h = o.h ?? neck * 4.5
    k.lathe(m, fillet2([[0, top - 0.004], [R, top - 0.004], [R, top + h * 0.45], [neck * 0.55, top + h], [0, top + h]], 0.001, 2), [0, 0, 0], { seg: 20, tint, wear: knurl(18, 0.0003, R * 0.9) })
  }
  if (kind === 'cork') {
    const bore = o.bore ?? neck * 0.62
    k.lathe('wood', fillet2([[0, top - 0.014], [bore, top - 0.014], [bore + 0.0004, top], [neck + 0.0016, top + 0.003], [neck + 0.0016, top + 0.009], [0, top + 0.0095]], 0.001, 2), [0, 0, 0], { seg: 20, tint })
  }
  if (kind === 'crimp') {

    k.lathe('steel', [[0, top - lip * 3], [R - 0.0009, top - lip * 3], [R, top - lip * 2.6], [R, top + 0.0005], [R - 0.0015, top + 0.0012], [0, top + 0.0012]], [0, 0, 0], { seg: 24, tint: [0.8, 0.81, 0.84] })
    k.lathe(m, fillet2([[0, top + 0.001], [R * 0.92, top + 0.001], [R * 0.92, top + 0.0035], [0, top + 0.0035]], 0.0006, 2), [0, 0, 0], { seg: 24, tint })
  }
}

export type BottleShape = { shoulder?: number; neck?: number; neckH?: number; heel?: number; bulge?: number; lip?: number; punt?: number }

export function bottleSilhouette(r: number, h: number, o: BottleShape = {}): V2[] {
  const neck = o.neck ?? r * 0.32, lip = o.lip ?? Math.min(0.003, neck * 0.25), neckH = o.neckH ?? h * 0.16
  const sh = (o.shoulder ?? 0.62) * h, top = h - neckH, heel = o.heel ?? Math.min(0.006, r * 0.15)
  const out: V2[] = [[r - heel, 0], [r - heel * 0.25, heel * 0.3], [r, heel]]
  for (let i = 1; i <= 5; i++) out.push([r * (1 + (o.bulge ?? 0) * Math.sin(Math.PI * i / 5)), heel + (sh - heel) * i / 5])
  for (let i = 1; i <= 6; i++) { const a = i / 6 * Math.PI / 2; out.push([neck + (r - neck) * Math.cos(a), sh + (top - sh) * Math.sin(a)]) }
  out.push([neck, h - lip * 2.4], [neck + lip, h - lip * 2], [neck + lip, h - lip * 0.6], [neck + lip * 0.4, h])
  return out
}

export type BottleOpts = Place & BottleShape & {
  m?: Mat; tint?: V3; wall?: number; ribs?: number[]
  fill?: { level: number; tint: V3; m?: Mat }
  cap?: { kind: Closure; tint: V3; h?: number; m?: Mat }
  labels?: { y0: number; y1: number; tint: V3; arc?: number; phase?: number; m?: Mat }[]
}

export function bottle(k: Kit, r: number, h: number, o: BottleOpts = {}) {
  const sil = bottleSilhouette(r, h, o), wall = o.wall ?? 0, neck = o.neck ?? r * 0.32, lip = o.lip ?? Math.min(0.003, neck * 0.25)
  const punt = o.punt ?? (wall ? Math.min(0.004, h * 0.025) : 0)
  let prof: V2[]
  if (wall > 0) {
    const inner = sil.filter(([, y]) => y > punt + wall + 0.001 && y < h - lip * 2.6).map(([x, y]) => [Math.max(0.0007, x - wall), y] as V2).reverse()
    prof = [[0, punt], ...sil, [Math.max(0.0007, neck - wall), h], [Math.max(0.0007, neck - wall), h - lip * 2.6], ...inner, [0, punt + wall]]
  } else prof = [[0, 0], ...sil, [0, h]]
  const rings = o.ribs ?? []
  const wear = rings.length ? (x: number, y: number, z: number) => (Math.hypot(x, z) > r * 0.9 ? rings.reduce((s, f) => s + 0.0016 * Math.exp(-(((y - f * h) / 0.0025) ** 2)), 0) : 0) : undefined
  k.frame(o, () => {
    k.lathe(o.m ?? 'glass', fillet2(prof, Math.min(0.003, r * 0.08), 2), [0, 0, 0], { seg: Math.max(24, Math.min(48, Math.round(r * 900))), crease: 55, tint: o.tint, wear })
    if (o.fill && wall > 0) {
      const y0 = punt + wall + 0.0009, y1 = Math.max(y0 + 0.002, o.fill.level * h), steps = 8, liquid: V2[] = [[0, y0]]
      for (let i = 0; i <= steps; i++) { const y = y0 + (y1 - y0) * i / steps, x = radiusAt(sil, y) - wall - 0.0009; if (x > 0.0005) liquid.push([x, y]) }
      liquid.push([0, y1])
      k.lathe(o.fill.m ?? 'glass', liquid, [0, 0, 0], { seg: 28, tint: o.fill.tint })
    }
    for (const [i, label] of (o.labels ?? []).entries()) {
      const rr = r * (1 + (o.bulge ?? 0)) + 0.0012 * (1 + i)
      k.lathe(label.m ?? 'paper', [[rr, label.y0 * h], [rr, label.y1 * h]], [0, 0, 0], { seg: 32, arc: label.arc, phase: label.phase ?? (label.arc ? Math.PI / 2 - label.arc / 2 : undefined), tint: label.tint })
    }
    if (o.cap && o.cap.kind !== 'none') closure(k, o.cap.kind, neck, lip, h, o.cap.tint, { h: o.cap.h, m: o.cap.m, bore: Math.max(0.0007, neck - wall) })
  })
}

export type FlaskOpts = Place & {
  m?: Mat; tint?: V3; seg?: number; wear?: (x: number, y: number, z: number) => number
  neck?: { x?: number; z?: number; r: number; h: number; lip?: number; cap: Closure; tint: V3; capH?: number; tilt?: number }
  labels?: { y0: number; y1: number; a0: number; a1: number; tint: V3; m?: Mat }[]
  handle?: { pts: V3[]; r: number; flat?: number }
}

export function flask(k: Kit, keys: Station[], o: FlaskOpts = {}) {
  const st = easeStations(keys, 3), top = keys[keys.length - 1].y
  k.frame(o, () => {
    k.put(loftRaw(st, { seg: o.seg ?? 40, wear: o.wear, crease: 50 }), o.m ?? 'paint', { tint: o.tint })
    if (o.handle) k.put(sweepRaw(o.handle.pts, o.handle.r, { seg: 12, flat: o.handle.flat }), o.m ?? 'paint', { tint: o.tint })
    for (const [i, l] of (o.labels ?? []).entries()) k.put(bandRaw(st, l.y0, l.y1, l.a0, l.a1, 0.0012 * (1 + i)), l.m ?? 'paper', { tint: l.tint })
    const n = o.neck
    if (n) k.frame({ at: [n.x ?? 0, top - 0.003, n.z ?? 0], roll: n.tilt ?? 0 }, () => {
      const lip = n.lip ?? Math.min(0.003, n.r * 0.2)
      k.lathe(o.m ?? 'paint', [[0, 0], [n.r * 1.25, 0], [n.r, 0.004], [n.r, n.h - lip * 2.4], [n.r + lip, n.h - lip * 2], [n.r + lip, n.h - lip * 0.6], [n.r + lip * 0.4, n.h], [0, n.h]], [0, 0, 0], { seg: 24, tint: o.tint })
      closure(k, n.cap, n.r, lip, n.h, n.tint, { h: n.capH })
    })
  })
}

export function jerrycan(k: Kit, w: number, h: number, d: number, o: Place & { tint: V3; capTint: V3; neckR?: number; labels?: FlaskOpts['labels']; p?: number; handle?: boolean } = { tint: [1, 1, 1], capTint: [1, 1, 1] }) {
  const hb = h * (o.handle === false ? 0.9 : 0.8), p = o.p ?? 5, hx = w / 2, hz = d / 2
  const keys: Station[] = [
    { y: 0, rx: hx * 0.94, rz: hz * 0.93, p }, { y: 0.008, rx: hx * 0.985, rz: hz * 0.98, p }, { y: hb * 0.5, rx: hx, rz: hz, p },
    { y: hb * 0.9, rx: hx * 0.985, rz: hz * 0.98, p }, { y: hb, rx: hx * 0.9, rz: hz * 0.86, p: p - 1 },
  ]
  const panel = (x: number, y: number, z: number) => (Math.abs(z) > hz * 0.8 ? -0.0025 * clamp((hx * 0.72 - Math.abs(x)) / 0.01) * clamp((y - h * 0.1) / 0.01) * clamp((hb * 0.8 - y) / 0.01) : 0)
  const hh = h - hb - 0.012, hr = Math.min(0.012, hh * 0.45)
  flask(k, keys, {
    ...o, tint: o.tint, wear: panel, labels: o.labels,
    neck: { x: hx * 0.55, r: o.neckR ?? Math.min(0.02, w * 0.08), h: 0.022, cap: 'screw', tint: o.capTint },
    handle: o.handle === false ? undefined : { r: hr, pts: [[-hx * 0.62, hb - 0.006, 0], [-hx * 0.6, hb + hh * 0.7, 0], [-hx * 0.45, hb + hh, 0], [hx * 0.05, hb + hh, 0], [hx * 0.2, hb + hh * 0.7, 0], [hx * 0.24, hb - 0.006, 0]] },
  })
}

export function jug(k: Kit, w: number, h: number, d: number, o: Place & { tint: V3; capTint: V3; neck?: number; p?: number; labels?: FlaskOpts['labels']; handle?: boolean; capH?: number }) {
  const hx = w / 2, hz = d / 2, p = o.p ?? 3.6, neck = o.neck ?? Math.min(0.016, w * 0.11), top = h * 0.86
  const keys: Station[] = [
    { y: 0, rx: hx * 0.93, rz: hz * 0.92, p }, { y: 0.006, rx: hx, rz: hz, p }, { y: h * 0.6, rx: hx, rz: hz, p },
    { y: h * 0.78, rx: hx * 0.62, rz: hz * 0.72, p: 3, cx: w * 0.12 }, { y: top, rx: neck * 1.35, rz: neck * 1.35, p: 2, cx: w * 0.2 },
  ]
  const hr = Math.min(0.009, d * 0.12)
  flask(k, keys, {
    ...o, tint: o.tint, labels: o.labels,
    neck: { x: w * 0.2, r: neck, h: h - top - (o.capH ?? 0.016) * 0.4, cap: 'screw', tint: o.capTint, capH: o.capH },
    handle: o.handle === false ? undefined : { r: hr, pts: [[-w * 0.1, h * 0.76, 0], [-w * 0.3, h * 0.84, 0], [-w * 0.5, h * 0.8, 0], [-hx - hr * 1.6, h * 0.64, 0], [-hx - hr * 0.6, h * 0.5, 0], [-hx + hr, h * 0.44, 0]] },
  })
}

export function tub(k: Kit, r: number, h: number, o: Place & { tint: V3; lidTint: V3; m?: Mat; labels?: TinOpts['labels'] }) {
  const lid = Math.min(0.02, h * 0.16)
  k.frame(o, () => {
    k.lathe(o.m ?? 'paint', fillet2([[0, 0], [r * 0.94, 0], [r * 0.95, 0.004], [r, h - lid - 0.004], [r + 0.002, h - lid], [r - 0.004, h - lid + 0.002], [0, h - lid + 0.002]], 0.0015, 2), [0, 0, 0], { seg: 48, crease: 55, tint: o.tint })
    for (const [i, l] of (o.labels ?? []).entries()) k.lathe(l.m ?? 'paper', [[r * (0.95 + 0.05 * l.y0) + 0.0012 * (1 + i), Math.max(0.006, l.y0 * h)], [r * (0.95 + 0.05 * l.y1) + 0.0012 * (1 + i), Math.min(h - lid - 0.008, l.y1 * h)]], [0, 0, 0], { seg: 48, arc: l.arc, phase: l.phase ?? (l.arc ? Math.PI / 2 - l.arc / 2 : undefined), tint: l.tint })
    k.lathe('paint', fillet2([[0, h - lid + 0.001], [r + 0.0045, h - lid + 0.001], [r + 0.0045, h - 0.003], [r + 0.002, h], [0, h]], 0.0015, 2), [0, 0, 0], { seg: 48, crease: 55, tint: o.lidTint })
    k.box('paint', [0.024, 0.003, 0.014], [0, h - lid + 0.003, r + 0.011], { r: 0.0012, tint: o.lidTint })
  })
}

export type TinOpts = Place & {
  tint?: V3; m?: Mat; lid?: 'press' | 'cone' | 'none'; lidTint?: V3; capTint?: V3; beads?: number; bail?: boolean
  labels?: { y0: number; y1: number; tint: V3; arc?: number; phase?: number; m?: Mat }[]; wear?: (x: number, y: number, z: number) => number
}

export function tin(k: Kit, r: number, h: number, o: TinOpts = {}) {
  const s = 0.0012, prof: V2[] = [[0, 0.0025], [r - 0.004, 0.0025], [r - 0.0025, 0.0008], [r + s * 0.4, 0], [r + s, 0.0015], [r + s, 0.0045], [r, 0.0065]]
  const beads = o.beads ?? 0
  for (let i = 1; i <= beads; i++) { const y = h * (0.2 + 0.6 * i / (beads + 1)); prof.push([r, y - 0.004], [r - 0.0012, y - 0.0014], [r - 0.0012, y + 0.0014], [r, y + 0.004]) }
  const cone = o.lid === 'cone'
  prof.push([r, h - 0.0065], [r + s, h - 0.0045], [r + s, h - 0.0005], [r + s * 0.3, h], [r - 0.0025, h], [r - 0.003, h - 0.004], [0, h - 0.004])
  k.frame(o, () => {
    k.lathe(o.m ?? 'steel', prof, [0, 0, 0], { seg: Math.max(32, Math.min(56, Math.round(r * 700))), crease: 55, tint: o.tint, wear: o.wear })
    for (const [i, l] of (o.labels ?? []).entries()) k.lathe(l.m ?? 'paper', [[r + 0.0012 * (1 + i), Math.max(0.008, l.y0 * h)], [r + 0.0012 * (1 + i), Math.min(h - 0.008, l.y1 * h)]], [0, 0, 0], { seg: 40, arc: l.arc, phase: l.phase ?? (l.arc ? Math.PI / 2 - l.arc / 2 : undefined), tint: l.tint })
    if (o.lid === 'press') k.lathe(o.m ?? 'steel', [[0, h - 0.0015], [r - 0.004, h - 0.0015], [r - 0.004, h + 0.0012], [r - 0.0006, h + 0.0012], [r - 0.0006, h + 0.0028], [r - 0.0045, h + 0.0028], [r - 0.0055, h + 0.0014], [0, h + 0.0014]], [0, 0, 0], { seg: 48, tint: o.lidTint ?? o.tint })
    if (cone) {
      const nr = Math.min(0.011, r * 0.32), ch = r * 0.32
      k.lathe(o.m ?? 'steel', [[0, h - 0.0018], [r - 0.0035, h - 0.0018], [r - 0.0035, h + 0.001], [nr + 0.003, h + ch], [nr, h + ch + 0.002], [nr, h + ch + 0.012], [nr + 0.0015, h + ch + 0.0125], [nr + 0.0015, h + ch + 0.015], [0, h + ch + 0.015]], [0, 0, 0], { seg: 40, tint: o.lidTint ?? o.tint })
      screwCap(k, 'paint', nr + 0.0027, 0.012, [0, h + ch + 0.0045, 0], { tint: o.capTint ?? [0.8, 0.15, 0.12] })
    }
    if (o.bail) {
      for (const sx of [-1, 1]) k.cyl('steel', 0.008, 0.004, [sx * (r + 0.0018), h - 0.022, 0], { axis: 'x', seg: 12, tint: o.tint })
      const pts: V3[] = Array.from({ length: 17 }, (_, i) => { const a = Math.PI * i / 16, up = Math.sin(a) * r * 0.8; return [-Math.cos(a) * (r + 0.004), h - 0.022 + up * 0.62, up * 0.78] as V3 })
      k.tube('steel', pts, 0.0022, { seg: 6, fillet: 0 })
    }
  })
}

export function aerosol(k: Kit, r: number, h: number, o: Place & { tint: V3; capTint: V3; cap?: 'over' | 'button'; labels?: TinOpts['labels']; m?: Mat }) {
  const over = (o.cap ?? 'over') === 'over', hb = over ? h * 0.8 : h * 0.9, cup = Math.min(0.0128, r * 0.62), sh = hb - Math.min(r * 0.55, hb * 0.18)
  const prof: V2[] = [[0, 0.007], [r - 0.006, 0.0045], [r - 0.002, 0.001], [r - 0.0006, 0], [r, 0.0014], [r, sh]]
  for (let i = 1; i <= 6; i++) { const a = i / 6 * Math.PI / 2; prof.push([cup + (r - cup) * Math.cos(a), sh + (hb - 0.004 - sh) * Math.sin(a)]) }
  prof.push([cup, hb - 0.002], [cup + 0.0008, hb], [cup - 0.0012, hb + 0.0028], [cup * 0.55, hb + 0.0028], [cup * 0.5, hb + 0.0015], [0, hb + 0.0015])
  k.frame(o, () => {
    k.lathe(o.m ?? 'paint', fillet2(prof, 0.0012, 2), [0, 0, 0], { seg: 40, crease: 55, tint: o.tint })
    for (const [i, l] of (o.labels ?? []).entries()) k.lathe(l.m ?? 'paper', [[r + 0.0012 * (1 + i), l.y0 * hb], [r + 0.0012 * (1 + i), Math.min(sh - 0.002, l.y1 * hb)]], [0, 0, 0], { seg: 40, arc: l.arc, phase: l.phase ?? (l.arc ? Math.PI / 2 - l.arc / 2 : undefined), tint: l.tint })
    k.cyl('steel', 0.0018, 0.006, [0, hb + 0.0055, 0], { seg: 8, tint: [0.8, 0.8, 0.82] })
    if (over) k.lathe('paint', fillet2([[0, h - 0.003], [r - 0.002, h - 0.003], [r - 0.002, sh + 0.0006], [r - 0.0008, sh + 0.0006], [r - 0.0008, h - 0.0025], [r - 0.002, h], [0, h]], 0.0012, 2), [0, 0, 0], { seg: 40, crease: 60, tint: o.capTint })
    else {
      k.lathe('paint', fillet2([[0, hb + 0.0075], [0.0085, hb + 0.0075], [0.0085, hb + 0.018], [0.0062, hb + 0.0205], [0, hb + 0.0205]], 0.0015, 2), [0, 0, 0], { seg: 24, tint: o.capTint })
      k.cyl('paint', 0.0016, 0.004, [0.0085, hb + 0.0155, 0], { axis: 'x', seg: 10, tint: [0.15, 0.15, 0.16] })
    }
  })
}

export type PatchPrint = { tint: V3; u0: number; u1: number; v0: number; v1: number; m?: Mat }

export function sack(k: Kit, w: number, h: number, d: number, o: Place & { m?: Mat; tint: V3; ends?: 'sewn' | 'block' | 'tied'; prints?: PatchPrint[]; seed?: number; wrinkle?: number; thread?: V3; tie?: V3 }) {
  const ends = o.ends ?? 'sewn', m = o.m ?? 'paper', block = ends === 'block', tied = ends === 'tied'
  const body = pillow(w, h, tied ? d - 0.05 : d, { seam: block ? 0.45 : 0.38, px: block ? 0.26 : 0.45, pz: block ? 0.22 : 0.6, pinch: block ? 0.02 : 0.06, wrinkle: o.wrinkle ?? 0.3, seed: o.seed ?? 1, sealZ: ends === 'sewn' ? 0.04 : 0, sealT: 0.003 })
  k.frame({ ...o, at: [(o.at ?? [0, 0, 0])[0], (o.at ?? [0, 0, 0])[1], (o.at ?? [0, 0, 0])[2] - (tied ? 0.025 : 0)] }, () => {
    k.put(body.raw, m, { tint: o.tint })

    for (const p of o.prints ?? []) k.put(patchRaw(body.top, p.u0, p.u1, p.v0, p.v1, 0.002, 20, 20), p.m ?? m, { tint: p.tint })
    if (ends === 'sewn') for (const v of [0.018, 0.982]) {
      const pts: V3[] = Array.from({ length: 13 }, (_, i) => { const q = body.top(0.04 + 0.92 * i / 12, v); return [q[0], q[1] + 0.0013, q[2]] })
      k.put(sweepRaw(pts, 0.0011, { seg: 4 }), 'fabric', { tint: o.thread ?? [0.86, 0.83, 0.72] })
    }
    if (tied) {
      const zd = (d - 0.05) / 2 - 0.035, yc = h * 0.42
      const neck: Station[] = [{ y: 0, rx: w * 0.3, rz: h * 0.3 }, { y: 0.03, rx: 0.026, rz: 0.019 }, { y: 0.045, rx: 0.019, rz: 0.015 }, { y: 0.075, rx: 0.042, rz: 0.012 }]
      k.put(loftRaw(easeStations(neck, 3), { seg: 28, wear: knurl(12, 0.003) }), m, { at: [0, yc, zd], pitch: Math.PI / 2, tint: o.tint })
      k.torus(o.tie ? 'fabric' : m, 0.0215, 0.003, [0, yc, zd + 0.042], { axis: 'z', seg: 8, segR: 20, tint: o.tie ?? o.tint })
    }
  })
}

export function sachet(k: Kit, w: number, h: number, d: number, o: Place & { m?: Mat; tint: V3; sealX?: number; sealZ?: number; teeth?: boolean; prints?: PatchPrint[]; seed?: number; wrinkle?: number; px?: number; pz?: number }) {
  const body = pillow(w, h, d, { seam: 0.45, px: o.px ?? 0.35, pz: o.pz ?? 0.35, pinch: 0.03, wrinkle: o.wrinkle ?? 0.4, seed: o.seed ?? 2, sealX: o.sealX ?? 0, sealZ: o.sealZ ?? 0, sealT: 0.0012, teeth: o.teeth ? 1 : 0 })
  k.frame(o, () => {
    k.put(body.raw, o.m ?? 'paper', { tint: o.tint })
    for (const p of o.prints ?? []) k.put(patchRaw(body.top, p.u0, p.u1, p.v0, p.v1, 0.0018, 16, 16), p.m ?? o.m ?? 'paper', { tint: p.tint })
  })
  return body
}

export function carton(k: Kit, w: number, h: number, d: number, o: Place & { m?: Mat; tint: V3; prints?: { face: 'front' | 'back' | 'left' | 'right' | 'top'; w: number; h: number; x?: number; y?: number; tint: V3 }[]; bulge?: number; r?: number; tuck?: boolean }) {
  const m = o.m ?? 'paper', bulge = o.bulge ?? Math.min(0.0015, Math.min(w, h, d) * 0.03)
  k.frame(o, () => {
    k.box(m, [w, h, d], [0, h / 2, 0], { r: o.r ?? 0.0012, tint: o.tint, seg: [Math.max(2, Math.ceil(w / 0.03)), Math.max(2, Math.ceil(h / 0.03)), Math.max(2, Math.ceil(d / 0.03))], disp: (face, s, t, hs, ht) => (face === 3 ? 0 : bulge * Math.sqrt(clamp(1 - (s / hs) ** 2) * clamp(1 - (t / ht) ** 2))) })
    const lift = bulge + 0.0004
    k.box(m, [Math.min(0.012, w * 0.15), h * 0.96, 0.0007], [-w / 2 + Math.min(0.006, w * 0.075) + 0.001, h / 2, -d / 2 - lift], { r: 0, tint: o.tint })
    if (o.tuck !== false) k.box(m, [w * 0.9, 0.0007, 0.0012], [0, h + lift, d / 2 - Math.min(0.01, d * 0.2)], { r: 0, tint: o.tint.map((c) => c * 0.55) as V3 })

    const layer: Record<string, number> = {}
    for (const p of o.prints ?? []) {
      const x = p.x ?? 0, y = p.y ?? h / 2, n = layer[p.face] = (layer[p.face] ?? -1) + 1, off = lift + 0.0006 + n * 0.0013
      if (p.face === 'front') k.box('paper', [p.w, p.h, 0.0012], [x, y, d / 2 + off], { r: 0, tint: p.tint })
      if (p.face === 'back') k.box('paper', [p.w, p.h, 0.0012], [x, y, -d / 2 - off], { r: 0, tint: p.tint })
      if (p.face === 'right') k.box('paper', [0.0012, p.h, p.w], [w / 2 + off, y, x], { r: 0, tint: p.tint })
      if (p.face === 'left') k.box('paper', [0.0012, p.h, p.w], [-w / 2 - off, y, x], { r: 0, tint: p.tint })
      if (p.face === 'top') k.box('paper', [p.w, 0.0012, p.h], [x, h + off, y - h / 2], { r: 0, tint: p.tint })
    }
  })
}

export function blister(k: Kit, w: number, d: number, o: Place & { card: V3; bubble: { x?: number; z?: number; w: number; d: number; h: number; p?: number }; hang?: boolean; prints?: { x: number; z: number; w: number; d: number; tint: V3 }[] }, inside?: () => void) {
  const t = 0.0011, b = o.bubble
  k.frame(o, () => {
    k.extrude('paper', rrect(w, d, 0.004), t, [0, t / 2, 0], { axis: 'y', holes: o.hang ? [rrect(0.016, 0.005, 0.0024, 3, 0, d / 2 - 0.007)] : [], bevel: 0.0002, tint: o.card })
    for (const p of o.prints ?? []) k.box('paper', [p.w, 0.0008, p.d], [p.x, t + 0.0004, p.z], { r: 0, tint: p.tint })
    const keys: Station[] = [{ y: t + 0.0001, rx: b.w / 2 + 0.003, rz: b.d / 2 + 0.003, p: b.p ?? 6 }, { y: t + 0.0007, rx: b.w / 2 + 0.003, rz: b.d / 2 + 0.003, p: b.p ?? 6 }, { y: t + 0.0012, rx: b.w / 2, rz: b.d / 2, p: b.p ?? 6 }, { y: b.h * 0.85, rx: b.w / 2 * 0.97, rz: b.d / 2 * 0.97, p: b.p ?? 6 }, { y: b.h, rx: b.w / 2 * 0.88, rz: b.d / 2 * 0.88, p: b.p ?? 6 }]
    k.put(loftRaw(keys, { seg: 32 }), 'glass', { at: [b.x ?? 0, 0, b.z ?? 0], tint: [0.95, 0.97, 1] })
    inside?.()
  })
}

export function squeezeTube(k: Kit, len: number, r: number, o: Place & { tint: V3; capTint: V3; band?: V3; flip?: boolean; m?: Mat }) {
  const capL = r * 1.15, crimp = Math.min(0.014, len * 0.1), body = len - capL - crimp - 0.004
  const keys: Station[] = [{ y: 0, rx: r * 0.42, rz: r * 0.42 }, { y: r * 0.32, rx: r * 0.97, rz: r * 0.97 }, { y: body * 0.4, rx: r * 0.98, rz: r * 1.02 }, { y: body * 0.78, rx: r * 0.6, rz: r * 1.24, p: 2.4 }, { y: body, rx: 0.0011, rz: r * 1.5, p: 3 }]
  const st = easeStations(keys, 3), m = o.m ?? 'paint'
  k.frame({ ...o, at: [(o.at ?? [0, 0, 0])[0] - len / 2 + capL + 0.004, (o.at ?? [0, 0, 0])[1] + r, (o.at ?? [0, 0, 0])[2]] }, () => k.frame({ roll: -Math.PI / 2 }, () => {
    k.put(loftRaw(st, { seg: 32 }), m, { tint: o.tint })
    k.extrude(m, serrated(r * 3, crimp + 0.002, 18, 0.0012), 0.0018, [0, body + crimp / 2 - 0.001, 0], { yaw: Math.PI / 2, bevel: 0.0003, tint: o.tint })
    if (o.band) k.put(bandRaw(st, body * 0.12, body * 0.62, Math.PI - 1.2, Math.PI + 1.2), 'paper', { tint: o.band })
    k.lathe(m, [[0, -0.0055], [r * 0.36, -0.0055], [r * 0.36, 0.001], [0, 0.001]], [0, 0, 0], { seg: 16, tint: o.tint })
    if (o.flip) k.lathe('paint', fillet2([[0, -capL - 0.003], [r * 0.85, -capL - 0.003], [r * 0.85, -0.003], [0, -0.003]], 0.0015, 2), [0, 0, 0], { seg: 24, tint: o.capTint })
    else k.lathe('paint', fillet2([[0, -capL - 0.003], [r * 0.6, -capL - 0.003], [r * 0.62, -0.003], [0, -0.003]], 0.0012, 2), [0, 0, 0], { seg: 24, tint: o.capTint, wear: knurl(16, 0.0004, r * 0.5) })
  }))
}

export function ampoule(k: Kit, r: number, h: number, o: Place & { ring: V3; fill: V3; tint?: V3 }) {
  const sil: V2[] = [[0, 0.0005], [r * 0.8, 0], [r, r * 0.4], [r, h * 0.55], [r * 0.42, h * 0.66], [r * 0.6, h * 0.76], [r * 0.5, h * 0.86], [r * 0.12, h * 0.98], [0, h]]
  k.frame(o, () => {
    k.lathe('glass', fillet2(sil, Math.min(0.0015, r * 0.2), 2), [0, 0, 0], { seg: 20, crease: 60, tint: o.tint ?? [0.98, 0.9, 0.75] })
    k.lathe('glass', [[0, 0.0012], [r - 0.0012, 0.0014], [r - 0.0012, h * 0.45], [0, h * 0.45]], [0, 0, 0], { seg: 18, tint: o.fill })
    k.torus('paint', r * 0.43, Math.min(0.0007, r * 0.1), [0, h * 0.66, 0], { seg: 6, segR: 18, tint: o.ring })
  })
}

export function aim(dir: V3): { yaw: number; pitch: number } {
  const l = Math.hypot(...dir) || 1
  return { yaw: Math.atan2(dir[0], dir[2]), pitch: Math.acos(clamp(dir[1] / l, -1, 1)) }
}

export function coil(k: Kit, m: Mat, R: number, r: number, turns: number, o: Place & { tint: V3; lay?: 'rope' | 'ribs' | 'smooth'; seed?: number; tails?: number; squash?: number; jitter?: number; drift?: number; ties?: { tint: V3; m?: Mat; count: number }; flat?: number }): V3[] {
  const rise = r * 2.05, pts = coilLoops(R, r, turns, { seed: o.seed ?? 3, tails: o.tails, squash: o.squash, jitter: o.jitter, drift: o.drift, rise })
  const radius = o.lay === 'rope' ? ropeLay(r) : o.lay === 'ribs' ? ribs(r * 1.2, 0.1) : undefined
  k.frame(o, () => {
    k.put(sweepRaw(pts, r, { seg: radius ? 10 : 8, radius, flat: o.flat }), m, { tint: o.tint })
    const count = o.ties?.count ?? 0, hgt = turns * rise + r
    for (let i = 0; i < count; i++) {
      const a = (i + 0.3) / count * TAU, c = Math.cos(a), s = Math.sin(a), wr = r * 1.6 + 0.002, hz = hgt / 2 + 0.0025
      const loop: V3[] = rrect(wr * 2, hz * 2, Math.min(wr, hz) * 0.9, 4).map(([u, v]) => [c * (R + u), hgt / 2 + v - 0.0004, s * (R + u)])
      k.put(sweepRaw(loop, 0.0026, { closed: true, seg: 6, flat: 0.35 }), o.ties!.m ?? 'paint', { tint: o.ties!.tint })
    }
  })
  return pts
}

export function atEnd(k: Kit, pts: V3[], fn: () => void, back = 0) {
  const a = pts[pts.length - 2], b = pts[pts.length - 1], dir: V3 = [b[0] - a[0], 0, b[2] - a[2]], l = Math.hypot(...dir) || 1
  k.frame({ at: [b[0] - dir[0] / l * back, b[1] - dir[1] / l * back, b[2] - dir[2] / l * back], ...aim(dir) }, fn)
}

export function tapeRoll(k: Kit, R: number, rIn: number, wid: number, o: Place & { tint: V3; m?: Mat; core?: V3; tail?: number }) {
  const rc = rIn + 0.003, m = o.m ?? 'paint'
  k.frame(o, () => {
    k.lathe(m, fillet2([[rc, 0], [R, 0], [R, wid], [rc, wid], [rc, 0]], 0.0006, 2), [0, 0, 0], { seg: 48, crease: 60, tint: o.tint })
    k.lathe('paper', [[rIn, 0.0002], [rc, 0.0002], [rc, wid - 0.0002], [rIn, wid - 0.0002], [rIn, 0.0002]], [0, 0, 0], { seg: 40, tint: o.core ?? [0.72, 0.58, 0.4] })
    if (o.tail) {
      const a0 = 0.4, pts: V3[] = []
      for (let i = 0; i <= 6; i++) { const a = a0 - i * 0.12; pts.push([Math.cos(a) * (R + 0.0004), wid / 2, Math.sin(a) * (R + 0.0004)]) }
      const end = pts[pts.length - 1], dir: V3 = [Math.sin(a0 - 0.72), 0, -Math.cos(a0 - 0.72)]
      for (let i = 1; i <= 4; i++) pts.push([end[0] + dir[0] * o.tail * i / 4, wid / 2, end[2] + dir[2] * o.tail * i / 4])
      k.put(sweepRaw(pts, wid / 2 - 0.0004, { seg: 8, flat: 0.0005 / (wid / 2) }), m, { tint: o.tint })
    }
  })
}

export function gripRaw(len: number, r: number, o: { knob?: number; swell?: number; neck?: number; ratio?: number; p?: number; ridges?: number } = {}): Raw {
  const q = o.ratio ?? 1, p = o.p ?? 2, k0 = 1 + (o.knob ?? 0.18)
  const keys: Station[] = [
    { y: 0, rx: r * k0 * 0.75, rz: r * k0 * 0.75 * q, p }, { y: len * 0.02, rx: r * k0, rz: r * k0 * q, p }, { y: len * 0.07, rx: r * 0.94, rz: r * 0.94 * q, p },
    { y: len * 0.45, rx: r * (1 + (o.swell ?? 0.08)), rz: r * (1 + (o.swell ?? 0.08)) * q, p }, { y: len * 0.9, rx: r * (o.neck ?? 0.86), rz: r * (o.neck ?? 0.86) * q, p }, { y: len, rx: r * (o.neck ?? 0.86) * 0.97, rz: r * (o.neck ?? 0.86) * 0.97 * q, p },
  ]
  return loftRaw(easeStations(keys, 3), { seg: 24, wear: o.ridges ? knurl(o.ridges, 0.0006, r * 0.8) : undefined })
}
