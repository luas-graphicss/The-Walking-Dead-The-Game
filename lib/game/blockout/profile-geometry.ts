import { BufferGeometry, ConeGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { solidOf, partQuaternion } from './solid'
import { BLOCK_MATERIALS, type BlockPart } from './types'

export function detailedCone(part: BlockPart, tile = BLOCK_MATERIALS[part.material].tile) {
  const [w, h, d] = part.size, radius = (w + d) / 4, slant = Math.hypot(radius, h)
  const geometry = new ConeGeometry(0.5, 1, part.radialSegments ?? 48, 4)
  geometry.scale(w, h, d)
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    if (normal.getY(i) < -0.99) uv.setXY(i, position.getX(i) / tile, position.getZ(i) / tile)
    else {
      const angle = uv.getX(i) * Math.PI * 2 * radius / slant, reach = (h / 2 - position.getY(i)) / h * slant
      uv.setXY(i, Math.sin(angle) * reach / tile, Math.cos(angle) * reach / tile)
    }
  }
  geometry.applyQuaternion(partQuaternion(part)); geometry.translate(...part.position)
  return geometry
}

export function chamferedProfile(part: BlockPart, tile = BLOCK_MATERIALS[part.material].tile) {
  const solid = solidOf(part), radius = Math.min(0.003, Math.min(...part.size) * 0.035)
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = []
  const edges = new Map<string, { original: string[]; points: Vector3[]; normal: Vector3 }[]>()
  const corners = new Map<string, { point: Vector3; normal: Vector3 }[]>()
  const pointKey = (point: Vector3) => point.toArray().map((v) => v.toFixed(7)).join(',')
  const emit = (polygon: Vector3[], outward: Vector3, dent = 0) => {
    const points = [...polygon]
    let normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize()
    if (normal.dot(outward) < 0) { points.reverse(); normal.negate() }
    const u = points[1].clone().sub(points[0]).normalize(), v = normal.clone().cross(u), origin = points[0]
    const center = points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(points.length).addScaledVector(normal, -dent)
    const all = [center, ...points], offset = positions.length / 3
    for (const point of all) {
      positions.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z)
      const relative = point.clone().sub(origin)
      uvs.push(relative.dot(u) / tile, relative.dot(v) / tile)
    }
    for (let i = 0; i < points.length; i++) indices.push(offset, offset + 1 + i, offset + 1 + (i + 1) % points.length)
  }
  for (const face of solid.faces) {
    const center = face.vertices.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(face.vertices.length)
    const distance = Math.min(...face.vertices.map((p, i) => p.clone().sub(center).cross(face.vertices[(i + 1) % face.vertices.length].clone().sub(p).normalize()).length()))
    const amount = Math.min(0.12, radius / Math.max(distance, radius))
    const points = face.vertices.map((p) => p.clone().lerp(center, amount))
    emit(points, face.normal, part.role === 'debris' && face.normal.y > 0.3 ? radius * 0.2 : 0)
    for (let i = 0; i < points.length; i++) {
      const key = pointKey(face.vertices[i]), next = (i + 1) % points.length, nextKey = pointKey(face.vertices[next])
      const corner = corners.get(key) ?? []; corner.push({ point: points[i], normal: face.normal }); corners.set(key, corner)
      const edgeKey = [key, nextKey].sort().join('|'), edge = edges.get(edgeKey) ?? []
      edge.push({ original: [key, nextKey], points: [points[i], points[next]], normal: face.normal }); edges.set(edgeKey, edge)
    }
  }
  for (const edge of edges.values()) if (edge.length === 2) {
    const [a, b] = edge, match = b.original[0] === a.original[1] ? b.points : [...b.points].reverse()
    emit([...a.points, ...match], a.normal.clone().add(b.normal).normalize())
  }
  for (const corner of corners.values()) if (corner.length >= 3) {
    const normal = corner.reduce((sum, p) => sum.add(p.normal), new Vector3()).normalize()
    const center = corner.reduce((sum, p) => sum.add(p.point), new Vector3()).divideScalar(corner.length)
    const u = corner[0].point.clone().sub(center).normalize(), v = normal.clone().cross(u)
    const points = corner.map((p) => p.point).sort((a, b) => Math.atan2(a.clone().sub(center).dot(v), a.clone().sub(center).dot(u)) - Math.atan2(b.clone().sub(center).dot(v), b.clone().sub(center).dot(u)))
    emit(points, normal)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices)
  return geometry
}
