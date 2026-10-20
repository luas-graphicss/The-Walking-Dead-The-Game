import type { ModelBuilder } from './model'
import type { BlockPart, MaterialKey, PartRole, Vec3 } from './types'

export type Corner = 'convex' | 'concave' | 'straight'
type Cell = { x: number; z: number }

export type OutlineEdge = { x: number; z: number; dx: number; dz: number; running: 'x' | 'z'; line: number; s0: number; s1: number; out: 1 | -1; start: Corner; end: Corner }
export type Grid = { bay: [number, number]; minX: number; minZ: number; occupied: Set<string> }

const key = (x: number, z: number) => `${x},${z}`

export function outlineEdges(cells: Cell[], grid: Grid): OutlineEdge[] {
  const { bay, minX, minZ, occupied } = grid, has = (x: number, z: number) => occupied.has(key(x, z))
  const edges: OutlineEdge[] = []
  for (const cell of cells) for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (has(cell.x + dx, cell.z + dz)) continue
    const running = dz ? 'x' : 'z', ax = running === 'x' ? 1 : 0, az = running === 'z' ? 1 : 0
    const corner = (sign: number): Corner => {
      const nx = cell.x + ax * sign, nz = cell.z + az * sign
      if (has(nx + dx, nz + dz)) return 'concave'
      return has(nx, nz) ? 'straight' : 'convex'
    }
    edges.push(running === 'x'
      ? { x: cell.x, z: cell.z, dx, dz, running, line: minZ + (cell.z + (dz > 0 ? 1 : 0)) * bay[1], s0: minX + cell.x * bay[0], s1: minX + (cell.x + 1) * bay[0], out: dz as 1 | -1, start: corner(-1), end: corner(1) }
      : { x: cell.x, z: cell.z, dx, dz, running, line: minX + (cell.x + (dx > 0 ? 1 : 0)) * bay[0], s0: minZ + cell.z * bay[1], s1: minZ + (cell.z + 1) * bay[1], out: dx as 1 | -1, start: corner(-1), end: corner(1) })
  }
  return edges
}

export function outlineRect(edge: OutlineEdge, inner: number, outer: number) {
  const reach = edge.running === 'x' ? outer : inner
  const adjust = (corner: Corner) => corner === 'convex' ? reach : corner === 'concave' ? -reach : 0
  const a0 = edge.s0 - adjust(edge.start), a1 = edge.s1 + adjust(edge.end)
  const p0 = Math.min(edge.line + edge.out * inner, edge.line + edge.out * outer), p1 = Math.max(edge.line + edge.out * inner, edge.line + edge.out * outer)
  return edge.running === 'x' ? { x0: a0, x1: a1, z0: p0, z1: p1 } : { x0: p0, x1: p1, z0: a0, z1: a1 }
}

export function outlineStrip(b: ModelBuilder, edge: OutlineEdge, inner: number, outer: number, y0: number, y1: number, material: MaterialKey, role: PartRole, name: string, level = 0, tint?: Vec3, cuts: [number, number][] = []) {
  const reach = edge.running === 'x' ? outer : inner
  const adjust = (corner: Corner) => corner === 'convex' ? reach : corner === 'concave' ? -reach : 0
  const a0 = edge.s0 - adjust(edge.start), a1 = edge.s1 + adjust(edge.end)
  let spans: [number, number][] = [[a0, a1]]
  for (const [c0, c1] of cuts) spans = spans.flatMap(([u0, u1]) => c1 <= u0 || c0 >= u1 ? [[u0, u1] as [number, number]] : [[u0, Math.min(u1, c0)], [Math.max(u0, c1), u1]].filter(([p, q]) => q - p > 0.012) as [number, number][])
  const p0 = edge.line + edge.out * inner, p1 = edge.line + edge.out * outer, across = (p0 + p1) / 2, depth = Math.abs(p1 - p0)
  const parts: BlockPart[] = []
  for (const [u0, u1] of spans) {
    if (u1 - u0 < 0.012 || depth < 0.009 || y1 - y0 < 0.009) continue
    const along = (u0 + u1) / 2
    const part = edge.running === 'x'
      ? b.box([u1 - u0, y1 - y0, depth], [along, (y0 + y1) / 2, across], material, role, 0, level, name)
      : b.box([depth, y1 - y0, u1 - u0], [across, (y0 + y1) / 2, along], material, role, 0, level, name)
    if (tint) part.tint = tint
    parts.push(part)
  }
  return parts
}

export function cornerTrims(b: ModelBuilder, edges: OutlineEdge[], kind: 'boards' | 'quoins', y0: number, y1: number, material: MaterialKey, tint: Vec3, level: number) {
  if (y1 - y0 < 0.3) return
  for (const edge of edges) {
    if (edge.running !== 'x') continue
    for (const end of ['start', 'end'] as const) {
      if (edge[end] !== 'convex') continue
      const vx = end === 'start' ? edge.s0 : edge.s1, vz = edge.line, ox = end === 'start' ? -1 : 1, oz = edge.out
      const depth = kind === 'boards' ? 0.03 : 0.035
      const blocks: [number, number, number, number][] = kind === 'boards' ? [[y0, y1, 0.24, 0.24]] : []
      if (kind === 'quoins') for (let y = y0, i = 0; y + 0.2 <= y1; y += 0.3, i++) blocks.push([y, Math.min(y + 0.26, y1), i % 2 ? 0.26 : 0.42, i % 2 ? 0.42 : 0.26])
      for (const [bottom, top, longX, longZ] of blocks) {
        const xa = vx + ox * (0.1 + depth - longX), xb = vx + ox * (0.1 + depth)
        const faceX = b.box([Math.abs(xb - xa), top - bottom, depth], [(xa + xb) / 2, (bottom + top) / 2, vz + oz * (0.1 + depth / 2)], material, 'fixture', 0, level, 'corner-trim')
        faceX.tint = tint
        const za = vz + oz * (0.1 + depth - longZ), zb = vz + oz * 0.1
        const faceZ = b.box([depth, top - bottom, Math.abs(zb - za)], [vx + ox * (0.1 + depth / 2), (bottom + top) / 2, (za + zb) / 2], material, 'fixture', 0, level, 'corner-trim')
        faceZ.tint = tint
      }
    }
  }
}
