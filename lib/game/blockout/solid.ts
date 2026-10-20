import { Euler, Quaternion, Vector3 } from 'three'
import type { BlockPart, Vec3 } from './types'

export type SolidFace = { vertices: Vector3[]; normal: Vector3; plane: number }
export type Solid = { vertices: Vector3[]; faces: SolidFace[]; axes: Vector3[]; edges: Vector3[] }
const EPS = 0.00015
const unitAxes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]

export function partQuaternion(part: BlockPart) {
  return new Quaternion().setFromEuler(new Euler(part.pitch ?? 0, part.yaw, part.roll ?? 0, 'YXZ'))
}

export function localSolid(part: BlockPart): { vertices: Vec3[]; faces: number[][] } {
  const [w, h, d] = part.size
  if (part.primitive === 'hull' && part.hull) return { vertices: part.hull.vertices.map(([x, y, z]) => [x * w, y * h, z * d] as Vec3), faces: part.hull.faces }
  if (part.primitive === 'cylinder' || part.primitive === 'cone') {
    const count = part.radialSegments === 6 ? 6 : 12
    const vertices: Vec3[] = Array.from({ length: count }, (_, i) => [Math.cos(i * Math.PI * 2 / count) * w / 2, -h / 2, Math.sin(i * Math.PI * 2 / count) * d / 2])
    const faces: number[][] = [Array.from({ length: count }, (_, i) => i)]
    if (part.primitive === 'cone') {
      vertices.push([0, h / 2, 0])
      for (let i = 0; i < count; i++) faces.push([i, (i + 1) % count, count])
    } else {
      for (let i = 0; i < count; i++) vertices.push([vertices[i][0], h / 2, vertices[i][2]])
      faces.push(Array.from({ length: count }, (_, i) => count + i))
      for (let i = 0; i < count; i++) faces.push([i, (i + 1) % count, (i + 1) % count + count, i + count])
    }
    return { vertices, faces }
  }
  const profile: [number, number][] = part.profile ?? [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]
  const n = profile.length
  const vertices: Vec3[] = [-1, 1].flatMap((side) => profile.map(([x, y]) => [x * w, y * h, side * d / 2] as Vec3))
  const faces: number[][] = [profile.map((_, i) => i), profile.map((_, i) => i + n)]
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, (i + 1) % n + n, i + n])
  return { vertices, faces }
}

function uniqueDirection(list: Vector3[], direction: Vector3) {
  if (direction.lengthSq() < 1e-12) return
  direction.normalize()
  if (!list.some((axis) => Math.abs(axis.dot(direction)) > 1 - 1e-7)) list.push(direction)
}

export function solidOf(part: BlockPart): Solid {
  const source = localSolid(part), q = partQuaternion(part), origin = new Vector3(...part.position)
  const vertices = source.vertices.map((p) => new Vector3(...p).applyQuaternion(q).add(origin))
  const center = vertices.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(vertices.length)
  const axes: Vector3[] = [], edges: Vector3[] = []
  const faces = source.faces.map((indices) => {
    let polygon = indices.map((i) => vertices[i])
    let normal = polygon[1].clone().sub(polygon[0]).cross(polygon[2].clone().sub(polygon[0])).normalize()
    if (normal.dot(polygon[0].clone().sub(center)) < 0) { polygon = [...polygon].reverse(); normal = normal.negate() }
    uniqueDirection(axes, normal.clone())
    for (let i = 0; i < polygon.length; i++) uniqueDirection(edges, polygon[(i + 1) % polygon.length].clone().sub(polygon[i]))
    return { vertices: polygon, normal, plane: normal.dot(polygon[0]) }
  })
  return { vertices, faces, axes, edges }
}

function interval(vertices: Vector3[], axis: Vector3): [number, number] {
  let min = Infinity, max = -Infinity
  for (const vertex of vertices) { const p = vertex.dot(axis); min = Math.min(min, p); max = Math.max(max, p) }
  return [min, max]
}

export function solidSeparation(a: Solid, b: Solid) {
  let gap = -Infinity
  const check = (axis: Vector3) => {
    const [amin, amax] = interval(a.vertices, axis), [bmin, bmax] = interval(b.vertices, axis)
    gap = Math.max(gap, bmin - amax, amin - bmax)
  }
  for (const axis of [...a.axes, ...b.axes]) { check(axis); if (gap > 0.001) return gap }
  for (const ea of a.edges) for (const eb of b.edges) {
    const axis = ea.clone().cross(eb)
    if (axis.lengthSq() < 1e-10) continue
    check(axis.normalize())
    if (gap > 0.001) return gap
  }
  return gap
}

export function coincidentSolidFaces(a: Solid, b: Solid) {
  for (const fa of a.faces) for (const fb of b.faces) {
    if (fa.normal.dot(fb.normal) < 1 - 1e-7 || Math.abs(fa.plane - fb.plane) > EPS) continue
    let overlaps = true
    for (const face of [fa, fb]) for (let i = 0; i < face.vertices.length; i++) {
      const axis = face.vertices[(i + 1) % face.vertices.length].clone().sub(face.vertices[i]).cross(fa.normal).normalize()
      const [amin, amax] = interval(fa.vertices, axis), [bmin, bmax] = interval(fb.vertices, axis)
      if (Math.min(amax, bmax) - Math.max(amin, bmin) <= EPS) { overlaps = false; break }
    }
    if (overlaps) return true
  }
  return false
}

export function isPlainBox(part: BlockPart) {
  return (!part.primitive || part.primitive === 'box') && !part.profile && !part.pitch && !part.roll
}

export function solidContainsXZ(solid: Solid, x: number, z: number, margin = 0) {
  for (const edge of solid.edges) {
    const axis = new Vector3(-edge.z, 0, edge.x)
    if (axis.lengthSq() < 1e-10) continue
    axis.normalize()
    const [min, max] = interval(solid.vertices, axis), p = x * axis.x + z * axis.z
    if (p < min - margin || p > max + margin) return false
  }
  return true
}

export function solidTopAt(solid: Solid, x: number, z: number) {
  let min = -Infinity, max = Infinity
  for (const { normal: n, plane } of solid.faces) {
    const offset = plane - n.x * x - n.z * z
    if (Math.abs(n.y) < 1e-8) { if (offset < -0.001) return -Infinity; continue }
    if (n.y > 0) max = Math.min(max, offset / n.y)
    else min = Math.max(min, offset / n.y)
  }
  return min <= max + 0.001 ? max : -Infinity
}

export function solidTouchesCapsule(solid: Solid, point: Vec3, radius: number) {
  const lower = new Vector3(point[0], point[1] + 0.245 + radius, point[2])
  const upper = new Vector3(point[0], point[1] + 1.8 - radius, point[2])
  for (const axis of [...solid.axes, ...unitAxes]) {
    const [min, max] = interval(solid.vertices, axis)
    const a = lower.dot(axis), b = upper.dot(axis)
    if (Math.min(a, b) - radius >= max - EPS || Math.max(a, b) + radius <= min + EPS) return false
  }
  return true
}
