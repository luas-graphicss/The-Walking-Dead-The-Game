import { Quaternion, Vector3 } from 'three'
import { fbm3, noise3, rand, smooth } from './sculpt/kit'
import { partQuaternion } from './solid'
import type { BlockPart, Crack, Crown, Damage, Hole, Spall, Vec3 } from './types'

type P2 = [number, number]
const TAU = Math.PI * 2
export const COURSE = 0.075
export const HALF_BRICK = 0.1125

export type DamageFrame = { plane: 'xy' | 'xz'; su: number; sv: number; sn: number }
export function frameOf(part: BlockPart): DamageFrame {
  const plane = part.damage?.plane ?? 'xy', [x, y, z] = part.size
  return plane === 'xy' ? { plane, su: x, sv: y, sn: z } : { plane, su: x, sv: z, sn: y }
}

export const planePoint = (plane: 'xy' | 'xz', u: number, v: number, n: number): Vec3 => (plane === 'xy' ? [u, v, n] : [u, n, v])

export function crownHeight(c: Crown, x: number, z: number) {
  const span = c.high - c.low
  const big = fbm3(x * 0.23 + 0.31, 0.37, z * 0.23 - 0.17, c.seed)
  const ridge = 1 - Math.abs(noise3(x * 0.85, 1.7, z * 0.85, c.seed + 11) * 2 - 1)
  const fine = noise3(x * 4.2, 2.3, z * 4.2, c.seed + 23) - 0.5
  let h = c.low + span * smooth(0.25, 0.8, big * 0.85 + ridge * 0.32) + fine * Math.min(0.09, span * 0.12)
  if (c.peaks?.length && c.peak) {
    let near = Infinity
    for (const [px, pz] of c.peaks) near = Math.min(near, (px - x) ** 2 + (pz - z) ** 2)
    h += c.peak * Math.exp(-near / 0.8)
  }
  return Math.max(0.06, h)
}

export function crownLocal(part: BlockPart, c: Crown) {
  const axis = new Vector3(1, 0, 0).applyQuaternion(partQuaternion(part))
  const flat = Math.hypot(axis.x, axis.z) || 1, ax = axis.x / flat, az = axis.z / flat
  const [px, py, pz] = part.position
  const world = (u: number) => crownHeight(c, px + axis.x * u, pz + axis.z * u)
  const along = (u: number) => (px + axis.x * u) * ax + (pz + axis.z * u) * az
  if (c.stepped) return (u: number) => {
    const s = along(u), column = (Math.floor(s / HALF_BRICK) + 0.5) * HALF_BRICK
    return Math.max(COURSE * 2, Math.floor(world(u + column - s) / COURSE) * COURSE) - py
  }
  if (c.grain) return (u: number) => {
    const s = along(u), lane = Math.floor(s / 0.2), t = s / 0.2 - lane
    const height = world(u + (lane + 0.5) * 0.2 - s) + (rand(lane, 3, c.seed) - 0.5) * 0.35
    const splinter = Math.abs(((t * (3 + Math.floor(rand(lane, 5, c.seed) * 3))) % 1) - 0.5) * 2
    return Math.max(0.08, height - splinter * (0.05 + rand(lane, 7, c.seed) * 0.09)) - py
  }
  return (u: number) => world(u) - py
}

export function crownBreaks(part: BlockPart, c: Crown, u0: number, u1: number): number[] {
  if (!c.stepped && !c.grain) return []
  const axis = new Vector3(1, 0, 0).applyQuaternion(partQuaternion(part))
  const flat = Math.hypot(axis.x, axis.z) || 1, ax = axis.x / flat, az = axis.z / flat
  const along = (u: number) => (part.position[0] + axis.x * u) * ax + (part.position[2] + axis.z * u) * az
  const pitch = c.stepped ? HALF_BRICK : 0.2, s0 = along(u0), s1 = along(u1)
  const out: number[] = []
  for (let k = Math.ceil(Math.min(s0, s1) / pitch); k * pitch < Math.max(s0, s1); k++) out.push(u0 + (k * pitch - s0) * Math.sign(s1 - s0 || 1))
  return out.sort((a, b) => a - b)
}

const ellipseR = (c: number, s: number, rx: number, ry: number) => 1 / Math.sqrt((c / rx) ** 2 + (s / ry) ** 2)

function shardOutline(h: Hole): P2[] {
  const n = 9 + Math.floor(rand(h.seed, 1) * 7) * 2, out: P2[] = []
  for (let i = 0; i < n; i++) {
    const a = ((i + (rand(h.seed, i, 2) - 0.5) * 0.55) / n) * TAU, c = Math.cos(a), s = Math.sin(a)
    const r = ellipseR(c, s, h.rx, h.ry) * (i % 2 ? 0.92 + rand(h.seed, i, 3) * 0.6 : 0.22 + rand(h.seed, i, 4) * 0.42)
    out.push([h.x + c * r, h.y + s * r])
  }
  return out
}

export function holeOutline(h: Hole, layer: -1 | 0 | 1, count = 64): P2[] {
  if (h.shards) return shardOutline(h)
  const flare = layer === 0 ? 0 : layer > 0 ? h.flare?.[0] ?? 0.08 : h.flare?.[1] ?? 0.08
  const out: P2[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU, c = Math.cos(a), s = Math.sin(a)

    const lump = fbm3(c * 1.25 + 3.1, s * 1.25, 0.5, h.seed) - 0.5
    const bite = noise3(c * 3.4, s * 3.4 + 7, 0.5, h.seed + 5) - 0.5
    const teeth = noise3(c * 10.5, s * 10.5, layer * 1.6 + 4, h.seed + 9) - 0.5
    let r = ellipseR(c, s, h.rx, h.ry) * (1 + flare) * Math.max(0.35, 1 + lump * 0.8 + bite * 0.34) * (1 + teeth * 0.14)

    if (h.sill !== undefined && s < -1e-3 && h.y + s * r < h.sill) r = (h.sill - h.y) / s * (1 + (noise3(c * 14, 0.5, layer, h.seed + 13) - 0.5) * 0.06)
    out.push([h.x + c * r, h.y + s * r])
  }
  return out
}

export function spallOutline(sp: Spall, layer: 0 | 1 | 2, count = 32): P2[] {
  const scale = [1.04, 0.86, 0.58][layer], out: P2[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU, c = Math.cos(a), s = Math.sin(a)
    const lump = fbm3(c * 1.4 + 1.7, s * 1.4, 0.5, sp.seed) - 0.5
    const teeth = noise3(c * 8.5, s * 8.5, layer * 1.3 + 2, sp.seed + 3) - 0.5
    const r = ellipseR(c, s, sp.rx, sp.ry) * scale * Math.max(0.4, 1 + lump * 0.85) * (1 + teeth * 0.12)
    out.push([sp.x + c * r, sp.y + s * r])
  }
  return out
}

export function insidePolygon2(poly: P2[], x: number, y: number) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

type Bounds2 = { x0: number; x1: number; y0: number; y1: number }
export type CrackSeed = { start: P2; angle: number; length: number; width: number; depth: number; side: 1 | -1 | 0; stepped?: boolean; wander?: number; branch?: number; seed: number }

export function growCrack(c: CrackSeed, bounds?: Bounds2, depthLeft = 1): Crack[] {
  const r = (i: number, k: number) => rand(c.seed, i, k)
  const out: Crack[] = []
  const points: P2[] = [c.start]
  let [x, y] = c.start, heading = c.angle, travelled = 0, branches = 0
  const inside = (px: number, py: number) => !bounds || (px > bounds.x0 && px < bounds.x1 && py > bounds.y0 && py < bounds.y1)
  if (c.stepped) {
    const sx = Math.cos(c.angle) >= 0 ? 1 : -1, sy = Math.sin(c.angle) >= 0 ? 1 : -1
    const slope = Math.abs(Math.tan(c.angle))
    for (let i = 0; travelled < c.length && i < 400; i++) {
      const across = slope > 2.2 ? 0 : slope > 0.9 ? HALF_BRICK : HALF_BRICK * 2
      const ny = y + sy * COURSE
      if (!inside(x, ny)) break
      points.push([x + (r(i, 1) - 0.5) * 0.004, ny]); y = ny; travelled += COURSE
      const nx = x + sx * (across + (r(i, 2) < 0.2 ? HALF_BRICK : 0))
      if (across && inside(nx, y)) { points.push([nx, y + (r(i, 3) - 0.5) * 0.004]); travelled += Math.abs(nx - x); x = nx }
      if (depthLeft > 0 && c.branch && branches < 2 && r(i, 4) < c.branch * 0.3 && travelled > 0.3 && ++branches) out.push(...growCrack({ ...c, start: [x, y], angle: c.angle + (r(i, 5) < 0.5 ? 1 : -1) * 0.9, length: (c.length - travelled) * (0.3 + r(i, 6) * 0.3), width: c.width * 0.55, depth: c.depth * 0.6, side: c.side === 0 ? (r(i, 7) < 0.5 ? 1 : -1) : c.side, branch: 0, seed: c.seed + 101 + i }, bounds, depthLeft - 1))
    }
  } else {
    const wander = c.wander ?? 0.85
    for (let i = 0; travelled < c.length && i < 300; i++) {
      const step = 0.045 + r(i, 1) * 0.065
      heading += (r(i, 2) - 0.5) * wander
      heading += (c.angle - heading) * 0.22
      const nx = x + Math.cos(heading) * step, ny = y + Math.sin(heading) * step
      if (!inside(nx, ny)) break
      x = nx; y = ny; travelled += step
      points.push([x, y])
      if (depthLeft > 0 && c.branch && branches < 2 && r(i, 3) < c.branch * 0.1 && travelled > 0.15 && travelled < c.length * 0.8 && ++branches) {
        const local = c.width * (1 - 0.8 * travelled / c.length)
        out.push(...growCrack({ ...c, start: [x, y], angle: heading + (r(i, 4) < 0.5 ? 1 : -1) * (0.45 + r(i, 5) * 0.5), length: (c.length - travelled) * (0.25 + r(i, 6) * 0.45), width: local * 0.6, depth: c.depth * 0.6, side: c.side === 0 ? (r(i, 7) < 0.5 ? 1 : -1) : c.side, branch: c.branch * 0.5, seed: c.seed + 211 + i }, bounds, depthLeft - 1))
      }
    }
  }
  if (points.length >= 2) out.unshift({ points, width: c.width, depth: c.depth, side: c.side, seed: c.seed })
  return out
}

export type ScarOpening = { x0: number; x1: number; y0: number; y1: number; kind: string }
export type ScarRun = { length: number; height: number; openings: ScarOpening[]; out: 1 | -1 }
export type Scars = { cracks: Crack[]; holes: Hole[]; spalls: Spall[] }
export type ScarOptions = {
  severity: 'aged' | 'cracked' | 'breach' | 'ruin' | 'scorched'
  masonry: 'brick' | 'concrete' | 'wood' | 'steel'

  rendered: boolean
  seed: number
  crownAt?: (x: number) => number
}

export function planScars(run: ScarRun, o: ScarOptions): Scars {
  const R = (i: number, k = 0) => rand(o.seed, i, k)
  const cracks: Crack[] = [], holes: Hole[] = [], spalls: Spall[] = []
  const L = run.length, H = run.height, half = L / 2
  const bounds: Bounds2 = { x0: -half - 0.05, x1: half + 0.05, y0: 0.02, y1: H - 0.01 }
  const stepped = o.masonry === 'brick', grain = o.masonry === 'wood'
  if (o.masonry === 'steel') {
    if (o.severity === 'breach') holes.push(breachHole(run, o, R))
    return { cracks, holes, spalls }
  }
  const heavy = o.severity === 'cracked' || o.severity === 'breach' || o.severity === 'scorched'
  const fine = { width: 0.0035, depth: 0.012 }, wide = { width: o.severity === 'aged' ? 0.005 : 0.011, depth: 0.05 }
  let n = 0
  const crack = (start: P2, angle: number, length: number, size: { width: number; depth: number }, side: 1 | -1 | 0, branch = 0.6) => {
    cracks.push(...growCrack({ start, angle, length, width: size.width * (0.8 + R(n, 1) * 0.5), depth: size.depth, side, stepped, wander: grain ? 0.25 : 0.85, branch: grain ? 0 : branch, seed: o.seed * 31 + n++ }, bounds))
  }
  const corner = { aged: 0.18, cracked: 0.38, breach: 0.22, ruin: 0.2, scorched: 0.3 }[o.severity]
  for (const opening of run.openings) {
    const door = opening.kind === 'door' || opening.y0 < 0.05
    const corners: [number, number, number][] = door ? [[opening.x0, opening.y1, -1], [opening.x1, opening.y1, 1]] : [[opening.x0, opening.y1, -1], [opening.x1, opening.y1, 1], [opening.x0, opening.y0, -1], [opening.x1, opening.y0, 1]]
    for (const [cx, cy, sx] of corners) {
      if (R(n, 9) > corner) { n++; continue }
      const up = cy >= opening.y1 - 1e-6, rise = (0.75 + R(n, 2) * 0.55) * (up ? 1 : -1)
      const angle = grain ? (up ? Math.PI / 2 : -Math.PI / 2) : Math.atan2(rise, sx * (0.55 + R(n, 3) * 0.5))
      const length = up ? Math.min(H - cy, 0.5 + R(n, 4) * 1.4) * 1.3 : Math.min(cy, 0.4 + R(n, 4) * 0.8) * 1.3
      const through = heavy && R(n, 5) < 0.45
      crack([cx - sx * 0.01, cy + (up ? -0.01 : 0.01)], angle, length, through ? wide : heavy ? { width: 0.007, depth: 0.03 } : fine, through ? 0 : run.out)
    }
  }
  if (o.severity === 'cracked') {

    const x = (R(2, 11) - 0.5) * L * 0.5, lean = (R(2, 12) - 0.5) * 0.9
    crack([x, 0.05 + R(2, 13) * 0.3], Math.PI / 2 + lean, H * 1.25, { width: 0.012 + R(2, 14) * 0.008, depth: 0.2 }, 0, 0.9)
    if (R(2, 15) < 0.6) crack([R(2, 16) < 0.5 ? -half + 0.02 : half - 0.02, H - 0.05], R(2, 16) < 0.5 ? -Math.PI / 4 : -Math.PI * 3 / 4, 1.2 + R(2, 17), wide, 0, 0.7)
  }
  if (o.severity === 'aged' && R(3, 1) < 0.3) crack([R(3, 2) < 0.5 ? -half + 0.02 : half - 0.02, H - 0.03], R(3, 2) < 0.5 ? -Math.PI / 3 : -Math.PI * 2 / 3, 0.5 + R(3, 3) * 0.9, fine, run.out)
  if (o.severity === 'breach') {
    const hole = breachHole(run, o, R)
    holes.push(hole)
    const rays = 3 + Math.floor(R(4, 1) * 3)
    for (let i = 0; i < rays; i++) {
      const a = (i + R(4, 10 + i) * 0.7) / rays * TAU, c = Math.cos(a), s = Math.sin(a)
      if (s < -0.4) continue
      const edge = ellipseR(c, s, hole.rx, hole.ry) * 0.85
      crack([hole.x + c * edge, hole.y + s * edge], a, 0.5 + R(4, 30 + i) * 1.1, { width: 0.009 + R(4, 40 + i) * 0.008, depth: 0.2 }, 0, 0.7)
    }
  }
  if (o.severity === 'ruin' && o.crownAt) {

    for (let i = 0; i < 1 + Math.floor(R(5, 1) * 3); i++) {
      const x = -half + 0.3 + R(5, 10 + i) * (L - 0.6), top = o.crownAt(x)
      if (top < 0.5) continue
      crack([x, top - 0.02], -Math.PI / 2 + (R(5, 20 + i) - 0.5) * 0.8, top * (0.4 + R(5, 30 + i) * 0.5), { width: 0.007 + R(5, 40 + i) * 0.008, depth: 0.2 }, 0, 0.5)
    }
  }

  if (!grain) {
    const count = { aged: R(6, 1) < 0.55 ? 1 + Math.floor(R(6, 2) * 2) : 0, cracked: 2 + Math.floor(R(6, 2) * 3), breach: 3 + Math.floor(R(6, 2) * 3), ruin: 2 + Math.floor(R(6, 2) * 3), scorched: 4 + Math.floor(R(6, 2) * 4) }[o.severity]
    for (let i = 0; i < count; i++) {
      const low = o.severity === 'aged' && R(7, i) < 0.6, side: 1 | -1 = R(8, i) < 0.7 ? run.out : (-run.out as 1 | -1)
      const rx = (o.severity === 'aged' ? 0.12 : 0.18) + R(9, i) * (o.severity === 'scorched' ? 0.45 : 0.32), ry = rx * (0.55 + R(10, i) * 0.6)
      const x = -half + rx + 0.05 + R(11, i) * Math.max(0, L - 2 * rx - 0.1)
      let y = low ? 0.08 + R(12, i) * 0.55 : ry + 0.1 + R(12, i) * Math.max(0, H - 2 * ry - 0.2)
      if (o.severity === 'ruin' && o.crownAt) {
        const top = o.crownAt(x)
        if (top < 0.7) continue
        y = Math.max(ry + 0.05, top - ry * (0.2 + R(13, i) * 0.6))
      }
      if (run.openings.some((p) => x + rx > p.x0 - 0.04 && x - rx < p.x1 + 0.04 && y + ry > p.y0 - 0.04 && y - ry < p.y1 + 0.04)) continue

      if (spalls.some((p) => p.side === side && Math.hypot(p.x - x, (p.y - y) * 1.2) < (Math.max(p.rx, p.ry) + Math.max(rx, ry)) * 1.6)) continue
      const seed = o.seed * 53 + i * 7
      if (o.rendered) {
        spalls.push({ x, y, rx, ry, depth: 0.014, side, seed, skin: true })
        if (R(14, i) < (o.severity === 'aged' ? 0.55 : 0.85)) spalls.push({ x: x + (R(15, i) - 0.5) * rx * 0.4, y: y + (R(16, i) - 0.5) * ry * 0.4, rx: rx * 0.62, ry: ry * 0.62, depth: 0.03 + R(17, i) * 0.03, side, seed: seed + 1 })
      } else spalls.push({ x, y, rx: rx * 0.7, ry: ry * 0.7, depth: o.masonry === 'brick' ? 0.025 + R(17, i) * 0.02 : 0.02 + R(17, i) * 0.03, side, seed })
    }
  }
  return { cracks, holes, spalls }
}

function breachHole(run: ScarRun, o: ScarOptions, R: (i: number, k?: number) => number): Hole {
  const L = run.length, H = run.height
  const rx = Math.min(L * 0.3, 0.62 + R(20, 1) * 0.4), sill = 0.14 + R(20, 2) * 0.3
  const ry = Math.min((H - sill) * 0.48, 0.85 + R(20, 3) * 0.35)
  const x = (R(20, 4) - 0.5) * Math.max(0, L - 2 * rx - 1.2)
  const front = run.out > 0 ? 0.05 : 0.28, back = run.out > 0 ? 0.28 : 0.05
  return { x, y: sill + ry * 0.92, rx, ry, seed: o.seed * 17 + 3, sill, flare: [front, back] }
}

export function holeExtent(h: Hole) {
  const pts = [...holeOutline(h, -1, 32), ...holeOutline(h, 1, 32)]
  return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) }
}

export function distributeScars(parts: BlockPart[], origin: Vec3, yaw: number, scars: Scars, base: Omit<Damage, 'holes' | 'cracks' | 'spalls'>) {
  const c = Math.cos(yaw), s = Math.sin(yaw)
  for (const part of parts) {
    const dx = part.position[0] - origin[0], dz = part.position[2] - origin[2]
    const cx = c * dx - s * dz, cy = part.position[1] - origin[1], hw = part.size[0] / 2, hh = part.size[1] / 2
    const overlaps = (x0: number, x1: number, y0: number, y1: number) => x1 > cx - hw && x0 < cx + hw && y1 > cy - hh && y0 < cy + hh

    const cracks = scars.cracks.flatMap((k): Crack[] => {
      const near = k.points.map(([x, y]) => x > cx - hw - 0.06 && x < cx + hw + 0.06 && y > cy - hh - 0.06 && y < cy + hh + 0.06)
      const first = near.indexOf(true), last = near.lastIndexOf(true)
      if (first < 0) return []
      const a = Math.max(0, first - 1), b = Math.min(k.points.length - 1, last + 1)
      if (b - a < 1) return []
      const along = [0]
      for (let i = 1; i < k.points.length; i++) along.push(along[i - 1] + Math.hypot(k.points[i][0] - k.points[i - 1][0], k.points[i][1] - k.points[i - 1][1]))
      const total = along[along.length - 1] || 1
      return [{ ...k, points: k.points.slice(a, b + 1).map(([x, y]) => [x - cx, y - cy] as P2), taper: [along[a] / total, along[b] / total], shift: [cx, cy] }]
    }).sort((a, b) => b.width - a.width).slice(0, 6)
    const holes = scars.holes.filter((h) => { const e = holeExtent(h); return overlaps(e.x0, e.x1, e.y0, e.y1) }).map((h) => ({ ...h, x: h.x - cx, y: h.y - cy, sill: h.sill === undefined ? undefined : h.sill - cy }))
    const spalls = scars.spalls.filter((p) => overlaps(p.x - p.rx * 1.3, p.x + p.rx * 1.3, p.y - p.ry * 1.3, p.y + p.ry * 1.3)).map((p) => ({ ...p, x: p.x - cx, y: p.y - cy }))
    if (!base.crown && !cracks.length && !holes.length && !spalls.length) continue
    part.damage = { ...base, ...(cracks.length ? { cracks } : {}), ...(holes.length ? { holes } : {}), ...(spalls.length ? { spalls } : {}) }
  }
}

export function damageSolid(part: BlockPart, u: number, v: number, top = part.damage?.crown && frameOf(part).plane === 'xy' ? crownLocal(part, part.damage.crown) : null) {
  const damage = part.damage
  if (!damage) return true
  if (top && v > top(u)) return false
  return !(damage.holes ?? []).some((h) => insidePolygon2(holeOutline(h, 0, 40), u, v))
}

export function toPlane(part: BlockPart, point: Vec3): P2 {
  const local = new Vector3(point[0] - part.position[0], point[1] - part.position[1], point[2] - part.position[2]).applyQuaternion(partQuaternion(part).invert())
  return frameOf(part).plane === 'xy' ? [local.x, local.y] : [local.x, local.z]
}

export function damageColliders(part: BlockPart, cell = 0.14): BlockPart[] {
  const damage = part.damage
  if (!damage || (!damage.crown && !damage.holes?.length) || (part.primitive && part.primitive !== 'box')) return [part]
  const f = frameOf(part), top = damage.crown && f.plane === 'xy' ? crownLocal(part, damage.crown) : null
  const outlines = (damage.holes ?? []).map((h) => holeOutline(h, 0, 40))
  const nu = Math.max(1, Math.ceil(f.su / cell)), nv = Math.max(1, Math.ceil(f.sv / cell)), cu = f.su / nu, cv = f.sv / nv
  const solid = (i: number, j: number) => {
    const u = -f.su / 2 + (i + 0.5) * cu, v = -f.sv / 2 + (j + 0.5) * cv
    if (top && v > top(u)) return false
    return !outlines.some((poly) => insidePolygon2(poly, u, v))
  }
  type Block = { i0: number; i1: number; j0: number; j1: number }
  const done: Block[] = []
  let open: Block[] = []
  for (let j = 0; j < nv; j++) {
    const runs: [number, number][] = []
    let start = -1
    for (let i = 0; i <= nu; i++) {
      const filled = i < nu && solid(i, j)
      if (filled && start < 0) start = i
      if (!filled && start >= 0) { runs.push([start, i]); start = -1 }
    }
    const next: Block[] = runs.map(([a, b]) => {
      const prior = open.find((block) => block.i0 === a && block.i1 === b)
      if (prior) { prior.j1 = j + 1; return prior }
      return { i0: a, i1: b, j0: j, j1: j + 1 }
    })
    for (const block of open) if (!next.includes(block)) done.push(block)
    open = next
  }
  done.push(...open)
  const q: Quaternion = partQuaternion(part), origin = new Vector3(...part.position)
  return done.map((block, k) => {
    const u0 = -f.su / 2 + block.i0 * cu, u1 = -f.su / 2 + block.i1 * cu, v0 = -f.sv / 2 + block.j0 * cv, v1 = -f.sv / 2 + block.j1 * cv
    const center = new Vector3(...planePoint(f.plane, (u0 + u1) / 2, (v0 + v1) / 2, 0)).applyQuaternion(q).add(origin)
    const size: Vec3 = f.plane === 'xy' ? [u1 - u0, v1 - v0, f.sn] : [u1 - u0, f.sn, v1 - v0]
    return { ...part, id: `${part.id}#solid-${k}`, position: center.toArray() as Vec3, size, damage: undefined, relief: undefined, primitive: undefined, hull: undefined, profile: undefined }
  })
}
