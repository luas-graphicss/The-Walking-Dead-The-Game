import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BLOCK_MATERIALS, type BlockPart, type FaceFinish, type MaterialKey } from './types'
import { partQuaternion, solidOf } from './solid'
import { edgeRadius, roundedBox, roundedCylinder } from './surface-geometry'
import { chamferedProfile, detailedCone } from './profile-geometry'
import { surfaceFor, textureOrigin } from './surfaces'
import { reliefGeometry } from './relief-geometry'

export type GeometryQuality = 'render' | 'collision' | 'lite'
export type GeometryStats = { triangles: number; vertices: number; drawCalls: number }

function hullGeometry(part: BlockPart) {
  const solid = solidOf(part), tile = BLOCK_MATERIALS[part.material].tile
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = []
  const up = new THREE.Vector3(0, 1, 0)
  for (const face of solid.faces) {
    const n = face.normal, offset = positions.length / 3
    const u = Math.abs(n.y) > 0.985 ? new THREE.Vector3(1, 0, 0) : up.clone().cross(n).normalize(), v = n.clone().cross(u)
    for (const point of face.vertices) {
      positions.push(point.x, point.y, point.z); normals.push(n.x, n.y, n.z)
      uvs.push(point.dot(u) / tile, point.dot(v) / tile)
    }
    for (let i = 1; i < face.vertices.length - 1; i++) indices.push(offset, offset + i, offset + i + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

function rawPartGeometry(part: BlockPart, quality: GeometryQuality) {
  if (part.primitive === 'hull') return hullGeometry(part)
  if (quality === 'render') {
    const relief = reliefGeometry(part, textureOrigin(part))

    if (relief) { relief.userData.open = true; return relief }
  }
  if (quality === 'render' && (part.primitive === 'cylinder' || ((!part.primitive || part.primitive === 'box') && edgeRadius(part) > 0))) {
    const geometry = part.primitive === 'cylinder' ? roundedCylinder(part) : roundedBox(part)
    geometry.applyQuaternion(partQuaternion(part))
    geometry.translate(...part.position)
    return geometry
  }
  if (quality === 'render' && part.primitive === 'cone') return detailedCone(part)
  if (quality === 'render' && part.primitive === 'prism' && !part.id.includes('radial-shell')) return chamferedProfile(part)
  if (part.primitive && part.primitive !== 'box') {
    const solid = solidOf(part), tile = BLOCK_MATERIALS[part.material].tile
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = []
    for (const face of solid.faces) {
      const offset = positions.length / 3
      const origin = face.vertices[0], u = face.vertices[1].clone().sub(origin).normalize(), v = face.normal.clone().cross(u)
      for (const point of face.vertices) {
        positions.push(point.x, point.y, point.z)
        normals.push(face.normal.x, face.normal.y, face.normal.z)
        const relative = point.clone().sub(origin)
        uvs.push(relative.dot(u) / tile, relative.dot(v) / tile)
      }
      for (let i = 1; i < face.vertices.length - 1; i++) indices.push(offset, offset + i, offset + i + 1)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    return geometry
  }
  const [w, h, d] = part.size
  const geometry = new THREE.BoxGeometry(w, h, d)
  const uv = geometry.getAttribute('uv')
  const tile = BLOCK_MATERIALS[part.material].tile
  const faceSize = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let face = 0; face < 6; face++) for (let vertex = 0; vertex < 4; vertex++) {
    const index = face * 4 + vertex
    uv.setXY(index, uv.getX(index) * faceSize[face][0] / tile, uv.getY(index) * faceSize[face][1] / tile)
  }
  geometry.applyQuaternion(partQuaternion(part))
  geometry.translate(...part.position)
  return geometry
}

export function partGeometry(part: BlockPart, quality: GeometryQuality = 'render') {
  const geometry = rawPartGeometry(part, quality)
  if (quality === 'collision') return geometry
  const spec = surfaceFor(part), authored = BLOCK_MATERIALS[part.material].tile, uv = geometry.getAttribute('uv')
  const origin = textureOrigin(part)
  const charts = geometry.userData.uvCharts as { start: number; count: number; u: number[]; v: number[] }[] | undefined
  if (origin && charts) for (const chart of charts) {
    const u = chart.u.reduce((sum, n, i) => sum + n * origin[i], 0) / authored
    const v = chart.v.reduce((sum, n, i) => sum + n * origin[i], 0) / authored
    for (let i = chart.start; i < chart.start + chart.count; i++) uv.setXY(i, uv.getX(i) + u, uv.getY(i) + v)
  }
  const axes = finishAxes(part), normal = geometry.getAttribute('normal')
  const owners = Array.from({ length: uv.count }, (_, i) => axes.length ? claim(axes, normal.getX(i), normal.getY(i), normal.getZ(i)) : -1)
  for (let i = 0; i < uv.count; i++) {
    const s = owners[i] < 0 ? spec : axes[owners[i]].spec
    uv.setXY(i, uv.getX(i) * authored / s.tile, uv.getY(i) * authored / s.tileV)
  }
  geometry.userData.uvMeters = [spec.tile, spec.tileV]

  if (!geometry.getAttribute('color')) geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(uv.count * 3).fill(1), 3))
  if (part.tint || axes.length) {
    const color = geometry.getAttribute('color')
    for (let i = 0; i < color.count; i++) {
      const tint = owners[i] < 0 ? part.tint : axes[owners[i]].finish.tint
      if (tint) color.setXYZ(i, color.getX(i) * tint[0], color.getY(i) * tint[1], color.getZ(i) * tint[2])
    }
  }
  return geometry
}

const FACE_DOT = 0.6
type FinishAxis = { finish: FaceFinish; axis: THREE.Vector3; key: { material: MaterialKey; surface?: string }; spec: ReturnType<typeof surfaceFor> }
function finishAxes(part: BlockPart): FinishAxis[] {
  if (!part.finishes?.length) return []
  const q = partQuaternion(part)
  return part.finishes.map((finish) => {
    const key = finish.material || finish.surface ? { material: finish.material ?? part.material, surface: finish.surface } : { material: part.material, surface: part.surface }
    return { finish, axis: new THREE.Vector3(...finish.axis).applyQuaternion(q), key, spec: surfaceFor(key) }
  })
}
function claim(axes: FinishAxis[], x: number, y: number, z: number) {
  for (let i = 0; i < axes.length; i++) if (axes[i].axis.x * x + axes[i].axis.y * y + axes[i].axis.z * z > FACE_DOT) return i
  return -1
}

export function faceFinish(part: BlockPart, normal: THREE.Vector3) {
  const axes = finishAxes(part), owner = axes.length ? claim(axes, normal.x, normal.y, normal.z) : -1
  return owner < 0 ? { tint: part.tint, spec: surfaceFor(part) } : { tint: axes[owner].finish.tint, spec: axes[owner].spec }
}

function subset(geometry: THREE.BufferGeometry, tris: number[]) {
  if (geometry.getIndex()) { const copy = geometry.clone(); copy.setIndex(tris); return copy }
  const copy = new THREE.BufferGeometry()
  for (const name of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(name), size = attribute.itemSize, array = new Float32Array(tris.length * size)
    tris.forEach((v, i) => { for (let c = 0; c < size; c++) array[i * size + c] = attribute.array[v * size + c] })
    copy.setAttribute(name, new THREE.Float32BufferAttribute(array, size))
  }
  copy.userData = { ...geometry.userData }
  return copy
}

export function splitFinishes(part: BlockPart, geometry: THREE.BufferGeometry): { material: MaterialKey; surface?: string; geometry: THREE.BufferGeometry }[] {
  const axes = finishAxes(part), own = { material: part.material, surface: part.surface }
  if (!axes.some((a) => a.finish.material || a.finish.surface)) return [{ ...own, geometry }]
  const normal = geometry.getAttribute('normal'), index = geometry.getIndex(), count = index ? index.count : normal.count
  const lists = new Map<string, { material: MaterialKey; surface?: string; tris: number[] }>()
  for (let t = 0; t < count; t += 3) {
    const a = index ? index.getX(t) : t, b = index ? index.getX(t + 1) : t + 1, c = index ? index.getX(t + 2) : t + 2
    const nx = normal.getX(a) + normal.getX(b) + normal.getX(c), ny = normal.getY(a) + normal.getY(b) + normal.getY(c), nz = normal.getZ(a) + normal.getZ(b) + normal.getZ(c)
    const length = Math.hypot(nx, ny, nz) || 1, owner = claim(axes, nx / length, ny / length, nz / length)
    const key = owner < 0 ? own : axes[owner].key, id = key.surface ?? key.material
    const entry = lists.get(id) ?? { ...key, tris: [] }
    entry.tris.push(a, b, c); lists.set(id, entry)
  }
  if (lists.size === 1) { const [only] = lists.values(); return [{ material: only.material, surface: only.surface, geometry }] }
  const pieces = [...lists.values()].map(({ material, surface, tris }) => {
    const piece = subset(geometry, tris), spec = surfaceFor({ material, surface })
    piece.userData.uvMeters = [spec.tile, spec.tileV]
    return { material, surface, geometry: piece }
  })
  geometry.dispose()
  return pieces
}

export function compileGeometry(parts: BlockPart[], quality: GeometryQuality = 'render') {
  const buckets = new Map<string, { material: MaterialKey; surface?: string; geometries: THREE.BufferGeometry[] }>()
  for (const part of parts) {
    if (quality === 'collision' && part.detail) continue
    const geometry = partGeometry(part, quality)
    const pieces = quality !== 'collision' ? splitFinishes(part, geometry) : [{ material: part.material, surface: undefined, geometry }]
    for (const piece of pieces) {
      const surface = quality !== 'collision' ? piece.surface : undefined, key = surface ?? piece.material
      const bucket = buckets.get(key) ?? { material: piece.material, surface, geometries: [] }
      bucket.geometries.push(piece.geometry); buckets.set(key, bucket)
    }
  }
  const result: { material: MaterialKey; surface?: string; geometry: THREE.BufferGeometry }[] = []
  for (const { material, surface, geometries } of buckets.values()) {
    const merged = mergeGeometries(geometries, false)
    if (merged) merged.userData.uvMeters = geometries[0].userData.uvMeters
    for (const geometry of geometries) geometry.dispose()
    if (!merged) throw new Error(`Não foi possível compilar ${surface ?? material}.`)
    merged.computeBoundingBox(); merged.computeBoundingSphere()
    result.push({ material, surface, geometry: merged })
  }
  return result
}

export function auditGeometry(geometry: THREE.BufferGeometry) {
  const issues: string[] = []
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv'), index = geometry.getIndex()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cross = new THREE.Vector3(), faceNormal = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    if (![position.getX(i), position.getY(i), position.getZ(i), normal.getX(i), normal.getY(i), normal.getZ(i), uv.getX(i), uv.getY(i)].every(Number.isFinite)) { issues.push('Vértice, normal ou UV não finito.'); break }
    const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))
    if (Math.abs(length - 1) > 0.001) { issues.push('Normal não unitária.'); break }
  }
  const count = index?.count ?? position.count
  const scales: number[] = []
  for (let i = 0; i < count; i += 3) {
    const ia = index?.getX(i) ?? i, ib = index?.getX(i + 1) ?? i + 1, ic = index?.getX(i + 2) ?? i + 2
    if ([ia, ib, ic].some((n) => !Number.isInteger(n) || n < 0 || n >= position.count)) { issues.push('Índice fora da malha.'); break }
    a.fromBufferAttribute(position, ia); b.fromBufferAttribute(position, ib); c.fromBufferAttribute(position, ic)
    cross.copy(b).sub(a).cross(c.clone().sub(a))
    if (cross.lengthSq() < 1e-19) { issues.push('Triângulo degenerado.'); break }
    faceNormal.set(normal.getX(ia) + normal.getX(ib) + normal.getX(ic), normal.getY(ia) + normal.getY(ib) + normal.getY(ic), normal.getZ(ia) + normal.getZ(ib) + normal.getZ(ic)).normalize()
    if (cross.normalize().dot(faceNormal) < 0.82) { issues.push('Face invertida, deformada ou normal incompatível.'); break }
    for (const [start, end] of [[ia, ib], [ib, ic], [ic, ia]]) {
      const metres = geometry.userData.uvMeters ?? [1, 1]
      const uvLength = Math.hypot((uv.getX(end) - uv.getX(start)) * metres[0], (uv.getY(end) - uv.getY(start)) * metres[1])
      const worldLength = Math.hypot(position.getX(end) - position.getX(start), position.getY(end) - position.getY(start), position.getZ(end) - position.getZ(start))
      const scale = worldLength / uvLength
      if (!Number.isFinite(scale) || scale <= 0) { issues.push('Malha puxada ou densidade UV inconsistente.'); break }
      scales.push(scale)
    }
    if (issues.length) break
    const uvArea = (uv.getX(ib) - uv.getX(ia)) * (uv.getY(ic) - uv.getY(ia)) - (uv.getY(ib) - uv.getY(ia)) * (uv.getX(ic) - uv.getX(ia))
    if (Math.abs(uvArea) < 1e-14) { issues.push('UV colapsado.'); break }
  }
  if (!issues.length && scales.length) {
    scales.sort((a, b) => a - b)
    const median = scales[Math.floor(scales.length / 2)]

    if (scales[0] < median / 3 || scales[scales.length - 1] > median * 3) issues.push('Malha puxada ou densidade UV inconsistente.')
  }
  return issues
}
