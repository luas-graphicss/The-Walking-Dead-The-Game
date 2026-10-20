import type { Terrain } from './terrain'
import { type RoadNetwork, SIDEWALK, distanceToSegment } from './roads'
import type { JunctionArm, Point2, Road, RoadSegment } from './types'

export type RunEnd = 'joint' | 'cap' | 'broken'

export type SidewalkRun = { from: number; to: number; start: RunEnd; end: RunEnd }

export type Attach = { road: Road; along: number; side: -1 | 1; half: number }
export type CornerPiece =

  | { kind: 'round'; a: Attach; b: Attach; pivot: Point2; corner: Point2 }

  | { kind: 'wedge'; a: Attach; b: Attach; node: Point2 }

  | { kind: 'butt'; a: Attach; kerb: Point2; back: Point2; facing: Point2 }

type Claim = { roadId: string; along: number; dir: 1 | -1; side: -1 | 1; trim: number; present: boolean; end: RunEnd }
export type SidewalkJunction = { x: number; z: number; pieces: CornerPiece[]; claims: Claim[]; reach: number }

export type SidewalkPlan = { distances: Float64Array; runs: [SidewalkRun[], SidewalkRun[]]; junctions: SidewalkJunction[] }

const CORNER_RUN = 6

const TRACE_STEP = 2

const SHORTEST_GAP = 4
const SHORTEST_SCRAP = 10
const SHORTEST_RUN = 3

const SHARPEST_CORNER = 0.6
const EPS = 1e-6

export function roadPoint(road: Road, distances: Float64Array, along: number, offset: number): Point2 {
  let lo = 0, hi = distances.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (distances[mid] <= along) lo = mid
    else hi = mid
  }
  const a = road.points[lo], b = road.points[lo + 1], n = road.normals, span = distances[lo + 1] - distances[lo]
  const f = span > 1e-9 ? Math.max(0, Math.min(1, (along - distances[lo]) / span)) : 0
  return {
    x: a.x + (b.x - a.x) * f + (n[2 * lo] + (n[2 * lo + 2] - n[2 * lo]) * f) * offset,
    z: a.z + (b.z - a.z) * f + (n[2 * lo + 1] + (n[2 * lo + 3] - n[2 * lo + 1]) * f) * offset,
  }
}

function cut(runs: SidewalkRun[], lo: number, hi: number, end: RunEnd) {
  const out: SidewalkRun[] = []
  for (const run of runs) {
    if (run.to < lo - EPS || run.from > hi + EPS) { out.push(run); continue }
    if (run.from < lo - EPS) out.push({ ...run, to: lo, end })
    if (run.to > hi + EPS) out.push({ ...run, from: hi, start: end })
  }
  return out
}

function fill(runs: SidewalkRun[], lo: number, hi: number) {
  const merged: SidewalkRun = { from: lo, to: hi, start: 'broken', end: 'broken' }
  const out: SidewalkRun[] = []
  for (const run of runs) {
    if (run.to < lo - EPS || run.from > hi + EPS) { out.push(run); continue }
    if (run.from < merged.from) { merged.from = run.from; merged.start = run.start }
    if (run.to > merged.to) { merged.to = run.to; merged.end = run.end }
  }
  out.push(merged)
  return out.sort((p, q) => p.from - q.from)
}

function trace(length: number, open: (along: number) => boolean) {
  const runs: SidewalkRun[] = []
  let inside = open(0), from = 0, previous = 0
  const edge = (lo: number, hi: number) => {
    for (let k = 0; k < 7; k++) {
      const mid = (lo + hi) / 2
      if (open(mid) === inside) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  for (let at = TRACE_STEP; ; at += TRACE_STEP) {
    const d = Math.min(at, length), now = open(d)
    if (now !== inside) {
      const x = edge(previous, d)
      if (inside) runs.push({ from, to: x, start: from === 0 ? 'cap' : 'broken', end: 'broken' })
      else from = x
      inside = now
    }
    previous = d
    if (d >= length) break
  }
  if (inside) runs.push({ from, to: length, start: from === 0 ? 'cap' : 'broken', end: 'cap' })
  return runs
}

function tidy(runs: SidewalkRun[]) {
  const out: SidewalkRun[] = []
  for (const run of runs) {
    if (run.to - run.from < EPS) continue
    const last = out[out.length - 1]
    if (last && last.end === 'broken' && run.start === 'broken' && run.from - last.to < SHORTEST_GAP) { last.to = run.to; last.end = run.end; continue }
    out.push({ ...run })
  }
  return out.filter((run) => {
    if (run.start === 'joint' || run.end === 'joint') return true
    return run.to - run.from >= (run.start === 'broken' && run.end === 'broken' ? SHORTEST_SCRAP : SHORTEST_RUN)
  })
}

const heading = (angle: number): Point2 => ({ x: Math.cos(angle), z: Math.sin(angle) })

export class SidewalkPlanner {
  private plans = new WeakMap<Road, SidewalkPlan>()
  private stations = new WeakMap<Road, Float64Array>()
  constructor(private readonly network: RoadNetwork, private readonly terrain: Terrain) {}

  urban(x: number, z: number) {
    const town = this.terrain.nearestTown(x, z)
    if (town.wet || town.kind === 'hamlet') return false
    const core = town.radius * (town.kind === 'city' ? 0.62 : town.kind === 'town' ? 0.42 : 0.34)
    return Math.hypot(x - town.x, z - town.z) < core * (1 + 0.32 * this.terrain.detail.at(x / 95 + 17.3, z / 95 - 9.1))
  }

  distances(road: Road) {
    let distances = this.stations.get(road)
    if (!distances) {
      distances = new Float64Array(road.points.length)
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1], b = road.points[i], length = Math.hypot(b.x - a.x, b.z - a.z)
        distances[i] = distances[i - 1] + (length < 0.01 ? 0 : length)
      }
      this.stations.set(road, distances)
    }
    return distances
  }

  point(road: Road, along: number, offset: number) {
    return roadPoint(road, this.distances(road), along, offset)
  }

  bridged(road: Road, along: number) {
    const distances = this.distances(road)
    let lo = 0, hi = distances.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (distances[mid] <= along) lo = mid
      else hi = mid
    }
    return road.bridge[lo] === 1 && road.bridge[lo + 1] === 1
  }

  attach(at: Attach) {
    return { kerb: this.point(at.road, at.along, at.side * at.half), back: this.point(at.road, at.along, at.side * (at.half + SIDEWALK)) }
  }

  plan(road: Road): SidewalkPlan {
    const cached = this.plans.get(road)
    if (cached) return cached
    const distances = this.distances(road)
    const plan: SidewalkPlan = { distances, runs: [[], []], junctions: [] }
    this.plans.set(road, plan)
    if (road.kind !== 'street') return plan
    const last = road.points.length - 1, length = distances[last], half = road.width / 2
    for (let i = 0; i <= last; i++) {
      const p = road.points[i], arms = this.network.armsAt(p.x, p.z)
      if (i > 0 && i < last && arms.every((arm) => arm.roadId === road.id)) continue
      plan.junctions.push(this.junction(p.x, p.z, arms))
    }

    const spans: [number, number][] = []
    for (let i = 0; i < last; i++) {
      if (!road.bridge[i] || !road.bridge[i + 1]) continue
      const open = spans[spans.length - 1]
      if (open && open[1] === distances[i]) open[1] = distances[i + 1]
      else spans.push([distances[i], distances[i + 1]])
    }
    const ashore = (along: number) => spans.find(([lo, hi]) => along >= lo && along <= hi)?.[0] ?? along
    for (const side of [-1, 1] as const) {
      const offset = side * (half + SIDEWALK / 2)
      let runs = trace(length, (along) => {
        const p = roadPoint(road, distances, ashore(along), offset)
        return this.urban(p.x, p.z) && this.network.clearance(p.x, p.z, road.id) > SIDEWALK / 2 + 0.3
      })
      const claims = plan.junctions.flatMap((junction) => junction.claims.filter((claim) => claim.roadId === road.id && claim.side === side))

      for (const claim of claims) {
        const [lo, hi] = claim.dir > 0 ? [claim.along, claim.along + claim.trim + CORNER_RUN] : [claim.along - claim.trim - CORNER_RUN, claim.along]
        runs = claim.present ? fill(runs, Math.max(0, lo), Math.min(length, hi)) : cut(runs, lo, hi, 'broken')
      }
      for (const claim of claims) {
        if (!claim.present) continue
        const [lo, hi] = claim.dir > 0 ? [claim.along, claim.along + claim.trim] : [claim.along - claim.trim, claim.along]
        runs = cut(runs, lo, hi, claim.end)
      }
      plan.runs[side > 0 ? 1 : 0] = tidy(runs)
    }
    return plan
  }

  private junction(x: number, z: number, arms: JunctionArm[]): SidewalkJunction {
    const pieces: CornerPiece[] = [], claims: Claim[] = []
    let reach = 0
    const count = arms.length
    for (let k = 0; k < count; k++) {
      const a = arms[k], b = arms[(k + 1) % count]

      const theta = count === 1 ? Math.PI * 2 : b.angle - a.angle + (k === count - 1 ? Math.PI * 2 : 0)
      if (count > 1 && a.roadId === b.roadId && !a.end && !b.end) continue
      const streetA = a.kind === 'street', streetB = b.kind === 'street'
      if (!streetA && !streetB) continue

      const sideA = a.dir, sideB = -b.dir as -1 | 1
      const middle = heading(a.angle + theta / 2), out = Math.max(a.half, b.half) + SIDEWALK
      const present = theta > SHARPEST_CORNER && this.urban(x + middle.x * out, z + middle.z * out)
      const claim = (arm: JunctionArm, side: -1 | 1, trim: number, end: RunEnd) =>
        claims.push({ roadId: arm.roadId, along: arm.along, dir: arm.dir, side, trim, present, end })
      const attach = (arm: JunctionArm, side: -1 | 1, trim: number): Attach => ({ road: arm.road, along: arm.along + arm.dir * trim, side, half: arm.half })
      if (count === 1) {
        claim(a, sideA, 0, 'cap')
        claim(a, sideB, 0, 'cap')
        continue
      }
      if (theta >= Math.PI - 0.05) {

        if (streetA && streetB) {
          claim(a, sideA, 0, 'joint')
          claim(b, sideB, 0, 'joint')
          if (present && theta > Math.PI + 0.03) {
            pieces.push({ kind: 'wedge', a: attach(a, sideA, 0), b: attach(b, sideB, 0), node: { x, z } })
            reach = Math.max(reach, Math.max(a.half, b.half) + SIDEWALK)
          }
        } else if (streetA) claim(a, sideA, 0, 'cap')
        else claim(b, sideB, 0, 'cap')
        continue
      }

      const sin = Math.sin(theta), cos = Math.cos(theta)
      const ua = heading(a.angle), na = heading(a.angle + Math.PI / 2), ub = heading(b.angle), nb = heading(b.angle - Math.PI / 2)
      const at = (u: Point2, n: Point2, along: number, across: number): Point2 => ({ x: x + u.x * along + n.x * across, z: z + u.z * along + n.z * across })
      if (streetA && streetB) {
        const dA = a.half + SIDEWALK, dB = b.half + SIDEWALK
        const trimA = (dB + dA * cos) / sin, trimB = (dA + dB * cos) / sin
        claim(a, sideA, trimA, 'joint')
        claim(b, sideB, trimB, 'joint')
        if (!present) continue
        const pivot = at(ua, na, trimA, dA)
        pieces.push({ kind: 'round', a: attach(a, sideA, trimA), b: attach(b, sideB, trimB), pivot, corner: at(ua, na, (b.half + a.half * cos) / sin, a.half) })
        reach = Math.max(reach, Math.hypot(pivot.x - x, pivot.z - z) + SIDEWALK)
        continue
      }

      const street = streetA ? a : b, other = streetA ? b : a, side = streetA ? sideA : sideB
      const along = streetA ? ua : ub, across = streetA ? na : nb, into = streetA ? nb : na
      const kerb = (other.half + street.half * cos) / sin, back = (other.half + (street.half + SIDEWALK) * cos) / sin
      const trim = Math.max(0, kerb, back)
      claim(street, side, trim, 'joint')
      if (!present) continue
      pieces.push({
        kind: 'butt', a: attach(street, side, trim), facing: { x: -into.x, z: -into.z },
        kerb: at(along, across, kerb, street.half), back: at(along, across, back, street.half + SIDEWALK),
      })
      reach = Math.max(reach, trim + street.half + SIDEWALK)
    }
    return { x, z, pieces, claims, reach }
  }

  covers(s: RoadSegment, x: number, z: number, margin: number) {
    const plan = this.plan(s.road)
    for (const junction of plan.junctions) {
      if (junction.pieces.length && Math.hypot(x - junction.x, z - junction.z) < junction.reach + margin) return true
    }
    const along = s.distance + distanceToSegment(x, z, s).t * s.length
    const side = (s.b.x - s.a.x) * (z - s.a.z) - (s.b.z - s.a.z) * (x - s.a.x) >= 0 ? 1 : 0
    return plan.runs[side].some((run) => along > run.from - margin - 1 && along < run.to + margin + 1)
  }
}
