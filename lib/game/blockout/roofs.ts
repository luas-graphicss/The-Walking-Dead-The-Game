import type { ModelBuilder } from './model'
import type { RoofKind } from './architecture'
import type { Style } from './style'
import { outlineRect, outlineStrip, type OutlineEdge } from './outline'
import { clipHalf, halfPlanes, heightAt, insidePolygon, plate, rectPolygon, solidPiece, subtractConvex, type HalfPlane, type P2, type Plane } from './polygon'
import { hash, random, type BlockPart, type Condition, type MaterialKey, type Vec3 } from './types'

export type RoofArea = { x0: number; x1: number; z0: number; z1: number }
export type PlanCell = { x: number; z: number; zone: string }
export type Obstacle = { x0: number; x1: number; z0: number; z1: number }

export function roofAreas(cells: PlanCell[], bay: [number, number], minX: number, minZ: number): RoofArea[] {
  const remaining = new Set(cells.map(({ x, z }) => `${x},${z}`)), result: RoofArea[] = []
  while (remaining.size) {
    let best = { x: 0, z: 0, width: 0, depth: 0, area: 0 }
    for (const cell of cells) {
      if (!remaining.has(`${cell.x},${cell.z}`)) continue
      let maxWidth = Infinity
      for (let depth = 1; remaining.has(`${cell.x},${cell.z + depth - 1}`); depth++) {
        let width = 0
        while (remaining.has(`${cell.x + width},${cell.z + depth - 1}`)) width++
        maxWidth = Math.min(maxWidth, width)
        if (maxWidth * depth > best.area) best = { x: cell.x, z: cell.z, width: maxWidth, depth, area: maxWidth * depth }
      }
    }
    for (let z = best.z; z < best.z + best.depth; z++) for (let x = best.x; x < best.x + best.width; x++) remaining.delete(`${x},${z}`)
    result.push({ x0: minX + best.x * bay[0], x1: minX + (best.x + best.width) * bay[0], z0: minZ + best.z * bay[1], z1: minZ + (best.z + best.depth) * bay[1] })
  }
  return result
}

type CellRect = { cx0: number; cx1: number; cz0: number; cz1: number }

function maximalRects(cells: PlanCell[], has: (x: number, z: number) => boolean): CellRect[] {
  const nx = Math.max(...cells.map((c) => c.x)) + 1, nz = Math.max(...cells.map((c) => c.z)) + 1
  const full = (r: CellRect) => { for (let x = r.cx0; x < r.cx1; x++) for (let z = r.cz0; z < r.cz1; z++) if (!has(x, z)) return false; return true }
  const all: CellRect[] = []
  for (let cx0 = 0; cx0 < nx; cx0++) for (let cx1 = cx0 + 1; cx1 <= nx; cx1++) for (let cz0 = 0; cz0 < nz; cz0++) for (let cz1 = cz0 + 1; cz1 <= nz; cz1++) {
    const r = { cx0, cx1, cz0, cz1 }
    if (full(r)) all.push(r)
  }
  return all.filter((r) => !all.some((o) => o !== r && o.cx0 <= r.cx0 && o.cx1 >= r.cx1 && o.cz0 <= r.cz0 && o.cz1 >= r.cz1 && (o.cx1 - o.cx0) * (o.cz1 - o.cz0) > (r.cx1 - r.cx0) * (r.cz1 - r.cz0)))
}

export type RoofContext = {
  cells: PlanCell[]; occupied: Set<string>; bay: [number, number]; minX: number; minZ: number
  eave: number; level: number; condition: Condition; seed: number; style: Style; legacy: RoofKind
  edges: OutlineEdge[]; obstacles: Obstacle[]; gable: { material: MaterialKey; tint?: Vec3 }; timber: boolean; vents: boolean
}
export type RoofResult = { heightAt: (x: number, z: number) => number; bottomAt: (x: number, z: number) => number; peak: number; thickness: number; flatTop?: number; steepest: number }

const THICK = 0.09, FASCIA = 0.2

type RoofPlane = { plane: Plane; domain: P2[]; ridge?: number }
type Roof = { outer: P2[]; planes: RoofPlane[]; peak: number; rect: { x0: number; x1: number; z0: number; z1: number }; ridgeAxis?: 'x' | 'z'; overhang: [number, number, number, number] }

export function buildRoofs(b: ModelBuilder, ctx: RoofContext): RoofResult {
  const { condition, style } = ctx
  const flat = (): RoofResult => ({ heightAt: () => ctx.eave, bottomAt: () => ctx.eave, peak: ctx.eave, thickness: 0, steepest: 0 })
  if (condition === 'leveled' || condition === 'ruined') return flat()
  if (style.roof.form === 'sawtooth' || style.roof.form === 'frame') {
    for (const area of roofAreas(ctx.cells, ctx.bay, ctx.minX, ctx.minZ)) legacyRoof(b, area, ctx.eave, style.roof.form, condition, ctx.seed, ctx.level, ctx.timber, style)
    return { ...flat(), peak: ctx.eave + 2 }
  }
  if (style.roof.form === 'flat') return flatRoof(b, ctx)
  return pitchedRoof(b, ctx)
}

function flatRoof(b: ModelBuilder, ctx: RoofContext): RoofResult {
  const { bay, minX, minZ, eave, level, condition, style, seed } = ctx
  const rng = random(hash(`${seed}:flat-roof`)), burned = condition === 'burned'
  const deckTop = eave + 0.15, parapetTop = deckTop + style.parapet.height
  const deckM: MaterialKey = burned ? 'charcoal' : style.roof.material === 'plaster' ? 'concrete' : style.roof.material
  const lost = new Set<number>()
  if (condition === 'damaged' || burned) {
    const candidates = ctx.cells.map((_, i) => i).filter((i) => ctx.cells[i].z < Math.max(...ctx.cells.map((c) => c.z)))
    for (let n = 0; n < (burned ? 2 : 1) && candidates.length; n++) lost.add(candidates.splice(Math.floor(rng() * candidates.length), 1)[0])
  }
  const decks: { x0: number; x1: number; z0: number; z1: number }[] = []
  ctx.cells.forEach((cell, i) => {
    const x0 = minX + cell.x * bay[0], z0 = minZ + cell.z * bay[1], x1 = x0 + bay[0], z1 = z0 + bay[1]
    if (lost.has(i)) {

      const deck = b.box([bay[0], 0.15, bay[1]], [(x0 + x1) / 2, eave + 0.075, (z0 + z1) / 2], deckM, 'roof', 0, level, 'roof-deck-broken')
      deck.tint = burned ? undefined : style.roof.tint
      const span = Math.min(bay[0], bay[1]), hx = (rng() - 0.5) * bay[0] * 0.3, hz = (rng() - 0.5) * bay[1] * 0.3
      const rx = span * (burned ? 0.34 : 0.24) * (0.85 + rng() * 0.3), rz = span * (burned ? 0.3 : 0.2) * (0.85 + rng() * 0.3)
      const cracks = Array.from({ length: 3 }, (_, k) => {
        const angle = (k / 3 + rng() * 0.25) * Math.PI * 2, ux = Math.cos(angle), uz = Math.sin(angle), reach = span * (0.22 + rng() * 0.16)
        const points: [number, number][] = []
        for (let s = 0; s <= 4; s++) {
          const t = s / 4, wobble = s === 0 ? 0 : (rng() - 0.5) * 0.22
          points.push([hx + ux * (rx * 0.92 + reach * t) - uz * wobble, hz + uz * (rz * 0.92 + reach * t) + ux * wobble])
        }
        return { points, width: 0.03 + rng() * 0.02, depth: 0.08, side: 1 as const, seed: hash(`${seed}:deck-crack:${i}:${k}`), taper: [1, 0.25] as [number, number] }
      })
      deck.damage = { plane: 'xz', core: 'concrete', holes: [{ x: hx, y: hz, rx, ry: rz, seed: hash(`${seed}:deck-hole:${i}`) }], cracks }
      return
    }
    const deck = b.box([bay[0], 0.15, bay[1]], [(x0 + x1) / 2, eave + 0.075, (z0 + z1) / 2], deckM, 'roof', 0, level, 'roof-deck')
    deck.tint = burned ? undefined : style.roof.tint
    decks.push({ x0, x1, z0, z1 })
  })
  const pm: MaterialKey = burned ? 'charcoal' : style.parapet.material, pt = burned ? undefined : style.parapet.tint
  for (const edge of ctx.edges) {
    outlineStrip(b, edge, 0, 0.2, eave, deckTop, pm, 'roof', 'roof-cornice', level, pt)
    outlineStrip(b, edge, -0.1, 0.1, deckTop, parapetTop, pm, 'roof', 'parapet', level, pt)
    outlineStrip(b, edge, -0.14, 0.14, parapetTop, parapetTop + 0.06, 'concrete', 'roof', 'parapet-coping', level, burned ? undefined : [1.02, 1, 0.96])
  }
  if (condition !== 'burned') rooftopKit(b, decks, ctx, deckTop, rng)
  return { heightAt: () => parapetTop + 0.06, bottomAt: () => eave, peak: parapetTop + 0.06, thickness: 0.15, flatTop: deckTop, steepest: 0 }
}

function rooftopKit(b: ModelBuilder, decks: { x0: number; x1: number; z0: number; z1: number }[], ctx: RoofContext, top: number, rng: () => number) {
  const level = ctx.level, inset = 0.75
  decks.slice(0, 4).forEach((deck, i) => {
    const kind = (i + Math.floor(rng() * 3)) % 4, cx = (deck.x0 + deck.x1) / 2 + (rng() - 0.5) * (deck.x1 - deck.x0 - 2 * inset - 1.4) * 0.5, cz = (deck.z0 + deck.z1) / 2 + (rng() - 0.5) * (deck.z1 - deck.z0 - 2 * inset - 1.4) * 0.5
    if (kind === 0) {
      b.box([1.1, 0.12, 0.8], [cx, top + 0.06, cz], 'steel', 'roof', 0, level, 'ac-skid').tint = [0.5, 0.5, 0.52]
      b.box([1.0, 0.72, 0.72], [cx, top + 0.12 + 0.36, cz], 'steel', 'roof', 0, level, 'ac-condenser').tint = [0.92, 0.92, 0.9]
      b.solid('cylinder', [0.6, 0.06, 0.6], [cx, top + 0.84 + 0.03, cz], 'steel', 'roof', 'ac-fan-grille', level).tint = [0.3, 0.3, 0.32]
    } else if (kind === 1) {
      b.box([1.3, 0.2, 1.3], [cx, top + 0.1, cz], 'concrete', 'roof', 0, level, 'tank-base')
      b.solid('cylinder', [1.16, 0.95, 1.16], [cx, top + 0.2 + 0.475, cz], 'plaster', 'roof', 'water-tank', level).tint = [0.32, 0.52, 0.82]
      b.solid('cylinder', [1.22, 0.08, 1.22], [cx, top + 1.15 + 0.04, cz], 'plaster', 'roof', 'water-tank-lid', level).tint = [0.28, 0.46, 0.74]
    } else if (kind === 2) {
      for (const [dx, dz, h] of [[-0.3, 0, 0.9], [0.25, 0.2, 0.6], [0.2, -0.3, 1.2]]) b.solid('cylinder', [0.16, h, 0.16], [cx + dx, top + h / 2, cz + dz], 'steel', 'roof', 'vent-stack', level).tint = [0.6, 0.6, 0.6]
    } else {
      b.box([0.9, 0.32, 0.9], [cx, top + 0.16, cz], 'concrete', 'roof', 0, level, 'roof-hatch-curb')
      b.box([0.98, 0.06, 0.98], [cx, top + 0.32 + 0.03, cz], 'steel', 'roof', 0, level, 'roof-hatch-lid').tint = [0.55, 0.55, 0.5]
    }
  })
}

function pitchedRoof(b: ModelBuilder, ctx: RoofContext): RoofResult {
  const { bay, minX, minZ, eave, level, condition, style, seed } = ctx
  const has = (x: number, z: number) => ctx.occupied.has(`${x},${z}`)
  const rng = random(hash(`${seed}:pitched-roof`)), burned = condition === 'burned'
  const s = style.roof.pitch, T = eave + THICK
  const roofs: Roof[] = []
  for (const r of maximalRects(ctx.cells, has)) {
    const x0 = minX + r.cx0 * bay[0], x1 = minX + r.cx1 * bay[0], z0 = minZ + r.cz0 * bay[1], z1 = minZ + r.cz1 * bay[1]
    const exterior = (side: 'xn' | 'xp' | 'zn' | 'zp') => {
      const list: boolean[] = []
      if (side === 'xn' || side === 'xp') for (let z = r.cz0; z < r.cz1; z++) list.push(!has(side === 'xn' ? r.cx0 - 1 : r.cx1, z))
      else for (let x = r.cx0; x < r.cx1; x++) list.push(!has(x, side === 'zn' ? r.cz0 - 1 : r.cz1))
      return list
    }
    const oh = style.roof.overhang, sides = (['xn', 'xp', 'zn', 'zp'] as const).map((side) => exterior(side))
    const overhang = sides.map((list) => list.some(Boolean) ? oh : 0) as [number, number, number, number]
    const fullyExterior = (index: number) => sides[index].every(Boolean)
    const fx0 = x0 - 0.1, fx1 = x1 + 0.1, fz0 = z0 - 0.1, fz1 = z1 + 0.1
    const outer = rectPolygon(x0 - overhang[0], x1 + overhang[1], z0 - overhang[2], z1 + overhang[3])
    const xn: Plane = [s, 0, T - s * fx0], xp: Plane = [-s, 0, T + s * fx1], zn: Plane = [0, s, T - s * fz0], zp: Plane = [0, -s, T + s * fz1]
    let axis: 'x' | 'z' | undefined
    if (style.roof.form !== 'hip') {
      const along = x1 - x0 >= z1 - z0 ? 'x' : 'z'
      for (const candidate of [along, along === 'x' ? 'z' : 'x'] as const) {
        const ok = candidate === 'x' ? fullyExterior(0) && fullyExterior(1) : fullyExterior(2) && fullyExterior(3)
        if (ok) { axis = candidate; break }
      }
    }
    let planes: Plane[]
    if (!axis) planes = [xn, xp, zn, zp]
    else if (style.roof.form === 'gambrel') {
      const steep = s * 1.9, gentle = s * 0.45
      const half = axis === 'z' ? (fx1 - fx0) / 2 : (fz1 - fz0) / 2, brk = half * 0.42
      const up = T + steep * brk
      planes = axis === 'z'
        ? [[steep, 0, T - steep * fx0], [gentle, 0, up - gentle * (fx0 + brk)], [-steep, 0, T + steep * fx1], [-gentle, 0, up + gentle * (fx1 - brk)]]
        : [[0, steep, T - steep * fz0], [0, gentle, up - gentle * (fz0 + brk)], [0, -steep, T + steep * fz1], [0, -gentle, up + gentle * (fz1 - brk)]]
    } else planes = axis === 'z' ? [xn, xp] : [zn, zp]
    const domains = planes.map((plane, j) => {
      let domain = outer
      planes.forEach((other, i) => { if (i !== j) domain = clipHalf(domain, [plane[0] - other[0], plane[1] - other[1], plane[2] - other[2]]) })
      return { plane, domain }
    })
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
    const peak = Math.min(...planes.map((p) => heightAt(p, cx, cz)))
    roofs.push({ outer, planes: domains.filter((d) => solidPiece(d.domain)), peak, rect: { x0, x1, z0, z1 }, ridgeAxis: axis, overhang })
  }

  const same = (a: Plane, c: Plane) => Math.abs(a[0] - c[0]) < 1e-9 && Math.abs(a[1] - c[1]) < 1e-9 && Math.abs(a[2] - c[2]) < 1e-7
  const box = (poly: P2[]) => ({ x0: Math.min(...poly.map((p) => p[0])), x1: Math.max(...poly.map((p) => p[0])), z0: Math.min(...poly.map((p) => p[1])), z1: Math.max(...poly.map((p) => p[1])) })
  const meets = (a: ReturnType<typeof box>, c: ReturnType<typeof box>) => a.x0 < c.x1 - 1e-9 && a.x1 > c.x0 + 1e-9 && a.z0 < c.z1 - 1e-9 && a.z1 > c.z0 + 1e-9
  const clipAll = (poly: P2[], halves: HalfPlane[]) => halves.reduce((acc, half) => clipHalf(acc, half), poly)
  type Piece = { poly: P2[]; plane: Plane; roof: number }
  const pieces: Piece[] = []
  roofs.forEach((roof, k) => {
    for (const { plane, domain } of roof.planes) {
      let list = [domain]
      roofs.forEach((other, m) => {
        if (m === k) return
        const ob = box(other.outer)
        list = list.flatMap((poly) => {
          if (!meets(box(poly), ob)) return [poly]
          const kept = subtractConvex(poly, other.outer)
          for (const theirs of other.planes) {
            const shared = clipAll(poly, halfPlanes(theirs.domain))
            if (!solidPiece(shared)) continue
            if (same(plane, theirs.plane)) { if (k < m) kept.push(shared); continue }
            const above = clipHalf(shared, [theirs.plane[0] - plane[0], theirs.plane[1] - plane[1], theirs.plane[2] - plane[2]])
            if (solidPiece(above)) kept.push(above)
          }
          return kept
        })
      })
      for (const obstacle of ctx.obstacles) list = list.flatMap((poly) => meets(box(poly), obstacle) ? subtractConvex(poly, rectPolygon(obstacle.x0, obstacle.x1, obstacle.z0, obstacle.z1)) : [poly])
      for (const poly of list) if (solidPiece(poly)) pieces.push({ poly, plane, roof: k })
    }
  })

  const roofAt = (x: number, z: number) => {
    let best = -Infinity
    for (const roof of roofs) if (insidePolygon(roof.outer, x, z, 1e-9)) best = Math.max(best, Math.min(...roof.planes.map((p) => heightAt(p.plane, x, z))))
    return best
  }
  const material: MaterialKey = burned ? 'charcoal' : style.roof.material, tint = burned ? undefined : style.roof.tint

  const holes: { x: number; z: number; rx: number; rz: number; seed: number }[] = []
  if (condition === 'damaged' || burned) {
    const xs = ctx.cells.map((c) => minX + (c.x + 0.5) * bay[0]), zs = ctx.cells.map((c) => minZ + (c.z + 0.5) * bay[1])
    for (let n = 0; n < (burned ? 2 : 1 + Math.floor(rng() * 2)); n++) {
      const i = Math.floor(rng() * xs.length), hx = xs[i] + (rng() - 0.5) * bay[0] * 0.3, hz = zs[i] + (rng() - 0.5) * bay[1] * 0.3
      const w = burned ? 2.6 + rng() : 1.2 + rng() * 0.8, d = burned ? 2.2 + rng() : 1 + rng() * 0.7
      holes.push({ x: hx, z: hz, rx: w / 2, rz: d / 2, seed: hash(`${seed}:roof-hole:${n}`) })
    }
  }
  const core: MaterialKey = burned ? 'charcoal' : style.roof.material === 'rubber' ? 'wood' : style.roof.material
  const pierce = (part: BlockPart | null) => {
    if (!part || !holes.length) return part
    const [cx, , cz] = part.position, [sx, , sz] = part.size
    const hits = holes.filter((h) => Math.abs(h.x - cx) < sx / 2 + h.rx && Math.abs(h.z - cz) < sz / 2 + h.rz)
    if (hits.length) part.damage = { plane: 'xz', core, holes: hits.map((h) => ({ x: h.x - cx, y: h.z - cz, rx: h.rx, ry: h.rz, seed: h.seed })) }
    return part
  }
  const punch = (polys: P2[][]) => polys
  const sin = s / Math.hypot(1, s), course = style.roof.courses, step = course === 'tile' ? 0.05 : 0.035
  const coursed = course === 'shingle' || course === 'tile'
  for (const piece of pieces) {
    const [a, c0, c] = piece.plane, roof = roofs[piece.roof], bottom: Plane = [a, c0, c - THICK]
    const slope = Math.hypot(a, c0), dh = (course === 'tile' ? 0.36 : 0.3) * (slope / Math.hypot(1, slope))
    if (!coursed) {
      for (const poly of punch([piece.poly])) pierce(plate(b, poly, piece.plane, bottom, material, 'roof', 'roof-panel', level, tint))
      if (course === 'seam' && !burned) {
        const n = Math.hypot(a, c0), ux = -c0 / n, uz = a / n
        const us = piece.poly.map(([x, z]) => x * ux + z * uz), u0 = Math.min(...us), u1 = Math.max(...us)
        for (let u = Math.ceil(u0 / 0.48) * 0.48; u < u1; u += 0.48) {
          const rib = clipAll(piece.poly, [[ux, uz, -(u + 0.022)], [-ux, -uz, u - 0.022]])
          for (const poly of punch([rib])) pierce(plate(b, poly, [a, c0, c + 0.04], piece.plane, 'steel', 'roof', 'roof-seam', level, tint))
        }
      }
      continue
    }
    for (let i = 0; ; i++) {
      const hi = roof.peak - i * dh, lo = hi - dh
      if (hi < eave - 2) break
      const band = clipAll(piece.poly, [[a, c0, c - hi], [-a, -c0, lo - c]])
      if (!solidPiece(band)) { if (lo < eave - roof.overhang.reduce((m, v) => Math.max(m, v), 0) * slope - 0.5) break; continue }
      const k = 1 - step / dh, top: Plane = [a * k, c0 * k, c * k + step * (1 + lo / dh)]
      for (const poly of punch([band])) pierce(plate(b, poly, top, bottom, material, 'roof', course === 'tile' ? 'roof-tile-course' : 'roof-shingle-course', level, tint))
    }
  }

  if (style.roof.ridge && !burned) {
    for (const piece of pieces) {
      const roof = roofs[piece.roof]
      if (!roof.ridgeAxis) continue
      const [a, c0, c] = piece.plane
      const ridgeHere = roof.planes.some((p) => p.plane !== piece.plane && Math.abs(heightAt(p.plane, (roof.rect.x0 + roof.rect.x1) / 2, (roof.rect.z0 + roof.rect.z1) / 2) - heightAt(piece.plane, (roof.rect.x0 + roof.rect.x1) / 2, (roof.rect.z0 + roof.rect.z1) / 2)) < 1e-6)
      if (!ridgeHere || Math.abs(heightAt(piece.plane, (roof.rect.x0 + roof.rect.x1) / 2, (roof.rect.z0 + roof.rect.z1) / 2) - roof.peak) > 1e-6) continue
      const slope = Math.hypot(a, c0), dh = (course === 'tile' ? 0.36 : 0.3) * (slope / Math.hypot(1, slope))
      const strip = clipHalf(piece.poly, [-a, -c0, roof.peak - 0.16 * slope - c])
      const k = coursed ? 1 - step / dh : 1, lo = roof.peak - dh
      const base: Plane = coursed ? [a * k, c0 * k, c * k + step * (1 + lo / dh)] : [a, c0, c + (course === 'seam' ? 0.04 : 0)]
      for (const poly of punch([strip])) pierce(plate(b, poly, [base[0], base[1], base[2] + 0.075], base, material, 'roof', 'ridge-cap', level, tint && [tint[0] * 0.82, tint[1] * 0.82, tint[2] * 0.82]))
    }
  }

  const trimM: MaterialKey = burned ? 'charcoal' : style.trim.material === 'steel' ? 'steel' : 'plaster', trimT = burned ? undefined : style.trim.tint
  for (const piece of pieces) {
    const roof = roofs[piece.roof], [ox0, ox1, oz0, oz1] = [roof.rect.x0 - roof.overhang[0], roof.rect.x1 + roof.overhang[1], roof.rect.z0 - roof.overhang[2], roof.rect.z1 + roof.overhang[3]]
    const [a, c0, c] = piece.plane, under: Plane = [a, c0, c - THICK], below: Plane = [a, c0, c - THICK - FASCIA]
    const lines: [HalfPlane, number, boolean][] = []
    if (roof.overhang[0] > 0) lines.push([[1, 0, -(ox0 + 0.035)], ox0, Math.abs(c0) > 1e-9])
    if (roof.overhang[1] > 0) lines.push([[-1, 0, ox1 - 0.035], ox1, Math.abs(c0) > 1e-9])
    if (roof.overhang[2] > 0) lines.push([[0, 1, -(oz0 + 0.035)], oz0, Math.abs(a) > 1e-9])
    if (roof.overhang[3] > 0) lines.push([[0, -1, oz1 - 0.035], oz1, Math.abs(a) > 1e-9])
    const placed: P2[][] = []
    for (const [half, , rake] of lines.sort((p, q) => Number(q[2]) - Number(p[2]))) {
      const touches = piece.poly.some(([x, z]) => half[0] * x + half[1] * z + half[2] < -0.0349)
      if (!touches) continue
      let strips = punch([clipHalf(piece.poly, half)])
      for (const prior of placed) strips = strips.flatMap((poly) => subtractConvex(poly, prior))
      for (const poly of strips) if (plate(b, poly, under, below, trimM, 'roof', rake ? 'rake-board' : 'fascia', level, trimT)) placed.push(poly)
    }
  }

  const gableM: MaterialKey = burned ? 'charcoal' : ctx.gable.material
  for (const edge of ctx.edges) {
    const r = outlineRect(edge, -0.1, 0.1), wall = rectPolygon(r.x0, r.x1, r.z0, r.z1)
    for (const piece of pieces) {
      const pb = box(piece.poly)
      if (!meets(pb, r)) continue
      const [a, c0, c] = piece.plane, under: Plane = [a, c0, c - THICK]
      const region = clipAll(clipAll(piece.poly, halfPlanes(wall)), [[-a, -c0, eave + 0.012 - (c - THICK)]])
      if (solidPiece(region)) plate(b, region, under, [0, 0, eave], gableM, 'wall', 'gable-infill', level, burned ? undefined : ctx.gable.tint)
    }
  }
  for (const roof of roofs) {
    if (!roof.ridgeAxis || burned || !ctx.vents) continue
    const ridgeX = (roof.rect.x0 + roof.rect.x1) / 2, ridgeZ = (roof.rect.z0 + roof.rect.z1) / 2
    for (const edge of ctx.edges) {
      if (edge.running !== (roof.ridgeAxis === 'z' ? 'x' : 'z')) continue
      const onRect = roof.ridgeAxis === 'z' ? Math.abs(edge.line - (edge.out < 0 ? roof.rect.z0 : roof.rect.z1)) < 1e-6 && ridgeX > edge.s0 + 0.5 && ridgeX < edge.s1 - 0.5 : Math.abs(edge.line - (edge.out < 0 ? roof.rect.x0 : roof.rect.x1)) < 1e-6 && ridgeZ > edge.s0 + 0.5 && ridgeZ < edge.s1 - 0.5
      if (!onRect) continue
      const along = roof.ridgeAxis === 'z' ? ridgeX : ridgeZ, face = edge.line + edge.out * 0.1
      const vx = roof.ridgeAxis === 'z' ? along : face + edge.out * 0.0125, vz = roof.ridgeAxis === 'z' ? face + edge.out * 0.0125 : along
      const clear = roofAt(roof.ridgeAxis === 'z' ? along : face, roof.ridgeAxis === 'z' ? face : along) - THICK - eave
      if (clear < 1.35 || Math.abs(roofAt(vx, vz) - roof.peak) > 0.02) continue
      if (ctx.obstacles.some((o) => vx > o.x0 - 0.9 && vx < o.x1 + 0.9 && vz > o.z0 - 0.9 && vz < o.z1 + 0.9) || holes.length) continue
      const vy = eave + clear * 0.42, size: Vec3 = roof.ridgeAxis === 'z' ? [0.62, 0.5, 0.025] : [0.025, 0.5, 0.62]
      b.box(size, [vx, vy, vz], 'plaster', 'roof', 0, level, 'gable-vent').tint = trimT ?? [0.3, 0.3, 0.3]
      for (const dy of [-0.14, 0, 0.14]) b.box(roof.ridgeAxis === 'z' ? [0.5, 0.05, 0.02] : [0.02, 0.05, 0.5], [vx + (roof.ridgeAxis === 'z' ? 0 : edge.out * 0.0225), vy + dy, vz + (roof.ridgeAxis === 'z' ? edge.out * 0.0225 : 0)], 'plaster', 'roof', 0, level, 'gable-vent-louver').tint = [0.34, 0.34, 0.36]
    }
  }
  const peak = Math.max(...roofs.map((r) => r.peak))
  const steepest = style.roof.form === 'gambrel' ? s * 1.9 : s
  return { heightAt: roofAt, bottomAt: (x, z) => roofAt(x, z) - THICK, peak, thickness: THICK, steepest }
}

function legacyRoof(b: ModelBuilder, area: RoofArea, eave: number, roof: 'sawtooth' | 'frame', condition: Condition, seed: number, level: number, timber: boolean, style: Style) {
  const { x0, x1, z0, z1 } = area, width = x1 - x0, depth = z1 - z0, x = (x0 + x1) / 2, z = (z0 + z1) / 2
  const rng = random(hash(`${seed}:roof:${x0}:${z0}`)), burned = condition === 'burned'
  const structure: MaterialKey = burned ? 'charcoal' : timber ? 'wood' : 'steel'
  const skin: MaterialKey = burned ? 'charcoal' : style.roof.material === 'plaster' ? 'steel' : style.roof.material
  const skinThickness = 0.12, beamHeight = 0.18, top = eave + beamHeight
  const rail = (w: number, d: number, px: number, pz: number) => b.box([w, beamHeight, d], [px, eave + beamHeight / 2, pz], structure, 'roof', 0, level, 'roof-wall-plate')
  rail(width, 0.16, x, z0 + 0.08); rail(width, 0.16, x, z1 - 0.08)
  rail(0.16, depth - 0.32, x0 + 0.08, z); rail(0.16, depth - 0.32, x1 - 0.08, z)
  const strips = Math.max(2, Math.ceil(depth / 2.6)), stripDepth = (depth - 0.32) / strips
  const hole = Math.floor(rng() * Math.max(1, strips - 1)), side = rng() > 0.5 ? 1 : 0
  const panelPresent = (strip: number, slope: number) => condition === 'weathered' || (condition === 'damaged' ? !(strip === hole && slope === side) : !(strip >= hole - 1 && slope % 2 === side) && strip % 3 === 0)
  const segment = (ax: number, ay: number, bx: number, by: number, thickness: number, length: number, pz: number, material: MaterialKey, name: string) => {
    const part = b.prism([[ax, ay], [bx, by], [bx, by + thickness], [ax, ay + thickness]], length, pz, material, 'roof', name, level)
    if (material === skin && !burned) part.tint = style.roof.tint
  }
  if (roof === 'sawtooth') {
    const teeth = Math.max(2, Math.round(width / 4.5)), tooth = width / teeth
    for (let t = 0; t < teeth; t++) {
      const ax = x0 + t * tooth, bx = ax + tooth
      for (let i = 0; i < strips; i++) {
        const pz = z0 + 0.16 + stripDepth * (i + 0.5)
        const tieStart = ax + (t === 0 ? 0.16 : 0), tieEnd = bx - (t === teeth - 1 ? 0.16 : 0)
        b.box([tieEnd - tieStart, 0.14, 0.12], [(tieStart + tieEnd) / 2, top - 0.07, pz], structure, 'roof', 0, level, 'sawtooth-tie')
        if (panelPresent(i, t % 2)) segment(ax + 0.07, top, bx - 0.07, top + 1.05, skinThickness, stripDepth, pz, skin, 'sawtooth-roof-panel')
        if (i === 0 || i === strips - 1) b.box([0.1, 1.05, 0.1], [bx - 0.02, top + 0.525, pz], structure, 'roof', 0, level, 'clerestory-upright')
      }
    }
    return
  }
  const profile: [number, number][] = [[x0, top], [x, top + Math.min(4, width * 0.25)], [x1, top]]
  for (let j = 0; j < profile.length - 1; j++) {
    const [ax, ay] = profile[j], [bx, by] = profile[j + 1]
    for (let i = 0; i < strips; i++) {
      const pz = z0 + 0.16 + stripDepth * (i + 0.5)
      if (condition !== 'weathered' && !panelPresent(i, j)) continue
      const edge = j === 0 ? 0.16 : 0, end = j === profile.length - 2 ? 0.16 : 0
      const a = ax + edge, c = bx - end, slope = (by - ay) / (bx - ax)
      const ya = ay + edge * slope, yc = by - end * slope
      const rafterDepth = Math.max(0.14, Math.abs(slope) * 0.16 + 0.06)
      segment(a, ya - rafterDepth, c, yc - rafterDepth, rafterDepth, 0.1, pz, structure, 'exposed-rafter')
    }
  }
  for (const pz of [z0 + 0.08, z1 - 0.08]) for (let j = 0; j < profile.length - 1; j++) {
    const [ax, ay] = profile[j], [bx, by] = profile[j + 1]
    segment(ax, ay, bx, by, skinThickness, 0.16, pz, structure, 'gable-edge-frame')
  }
}
