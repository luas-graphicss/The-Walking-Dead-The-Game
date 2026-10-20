import type { ModelBuilder } from './model'
import type { BlockPart, MaterialKey, PartRole, Vec3 } from './types'

export type P2 = [number, number]

export type Plane = [number, number, number]
export type HalfPlane = [number, number, number]
export const heightAt = (plane: Plane, x: number, z: number) => plane[0] * x + plane[1] * z + plane[2]
export const offsetPlane = (plane: Plane, dy: number): Plane => [plane[0], plane[1], plane[2] + dy]

export function polygonArea(poly: P2[]) {
  let sum = 0
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; sum += a[0] * b[1] - b[0] * a[1] }
  return sum / 2
}

export function cleanPolygon(poly: P2[]): P2[] {
  let out = [...poly]
  for (let guard = 0; guard < 64 && out.length >= 3; guard++) {
    const index = out.findIndex((b, i) => {
      const a = out[(i + out.length - 1) % out.length], c = out[(i + 1) % out.length]
      const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), ac = Math.hypot(c[0] - a[0], c[1] - a[1])
      if (ab < 1e-5 || ac < 1e-5) return true
      return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / (ab * ac) < 2e-6
    })
    if (index < 0) break
    out.splice(index, 1)
  }
  return out.length >= 3 ? out : []
}

export function clipHalf(poly: P2[], [nx, nz, d]: HalfPlane): P2[] {
  if (!poly.length) return poly
  const out: P2[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const da = nx * a[0] + nz * a[1] + d, db = nx * b[0] + nz * b[1] + d
    if (da <= 0) out.push(a)
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]) }
  }
  return cleanPolygon(out)
}

export const rectPolygon = (x0: number, x1: number, z0: number, z1: number): P2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
export const solidPiece = (poly: P2[]) => poly.length >= 3 && Math.abs(polygonArea(poly)) > 1e-5

export function halfPlanes(poly: P2[]): HalfPlane[] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length]
    let nx = b[1] - a[1], nz = a[0] - b[0]
    const length = Math.hypot(nx, nz); nx /= length; nz /= length
    let d = -(nx * a[0] + nz * a[1])
    if (nx * cx + nz * cz + d > 0) { nx = -nx; nz = -nz; d = -d }
    return [nx, nz, d] as HalfPlane
  })
}

export function subtractConvex(poly: P2[], hole: P2[]): P2[][] {
  const pieces: P2[][] = []
  let rest = poly
  for (const [nx, nz, d] of halfPlanes(hole)) {
    const outside = clipHalf(rest, [-nx, -nz, -d])
    if (solidPiece(outside)) pieces.push(outside)
    rest = clipHalf(rest, [nx, nz, d])
    if (!solidPiece(rest)) return pieces
  }
  return pieces
}

export function insidePolygon(poly: P2[], x: number, z: number, margin = 0) {
  return halfPlanes(poly).every(([nx, nz, d]) => nx * x + nz * z + d <= margin)
}

function minimumWidth(poly: P2[]) {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], length = Math.hypot(b[0] - a[0], b[1] - a[1])
    let far = 0
    for (const p of poly) far = Math.max(far, Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / length)
    best = Math.min(best, far)
  }
  return best
}

export function plate(b: ModelBuilder, poly: P2[], top: Plane, bottom: Plane, material: MaterialKey, role: PartRole, name: string, level = 0, tint?: Vec3): BlockPart | null {
  const ring = cleanPolygon(poly)
  if (ring.length < 3 || Math.abs(polygonArea(ring)) < 4e-4 || minimumWidth(ring) < 0.014) return null
  if (ring.some(([x, z]) => heightAt(top, x, z) - heightAt(bottom, x, z) < 0.006)) return null
  const points: Vec3[] = [...ring.map(([x, z]) => [x, heightAt(top, x, z), z] as Vec3), ...ring.map(([x, z]) => [x, heightAt(bottom, x, z), z] as Vec3)]
  const min = [0, 1, 2].map((axis) => Math.min(...points.map((p) => p[axis]))), max = [0, 1, 2].map((axis) => Math.max(...points.map((p) => p[axis])))
  const size = [0, 1, 2].map((axis) => max[axis] - min[axis]) as Vec3, center = [0, 1, 2].map((axis) => (min[axis] + max[axis]) / 2) as Vec3
  if (size.some((value) => value < 0.0095)) return null
  const n = ring.length
  const part = b.box(size, center, material, role, 0, level, name)
  part.primitive = 'hull'
  part.hull = {
    vertices: points.map((p) => [(p[0] - center[0]) / size[0], (p[1] - center[1]) / size[1], (p[2] - center[2]) / size[2]] as Vec3),
    faces: [ring.map((_, i) => i), ring.map((_, i) => n + i), ...ring.map((_, i) => [i, (i + 1) % n, n + (i + 1) % n, n + i])],
  }
  if (tint) part.tint = tint
  return part
}
