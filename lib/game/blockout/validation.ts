import { BLOCK_MATERIALS, modelBounds, partBounds, type BlockModel, type BlockPart, type Bounds, type StructureModel, type Vec3 } from './types'
import { coincidentSolidFaces, isPlainBox, localSolid, solidContainsXZ, solidOf, solidSeparation, solidTopAt, solidTouchesCapsule, type Solid } from './solid'

export type IssueCode = 'non-finite' | 'dimension' | 'duplicate-id' | 'overlap' | 'z-fighting' | 'unsupported' | 'below-ground' | 'socket' | 'blocked-route' | 'unsupported-route' | 'missing-resources'
export type ValidationIssue = { code: IssueCode; part: string; other?: string; message: string }
export type ValidationReport = { id: string; passed: boolean; parts: number; triangles: number; connected: number; sockets: number; routes: number; bounds: Bounds; issues: ValidationIssue[] }
const EPS = 0.00015
const CONTACT = 0.001
const axes = (part: BlockPart) => { const c = Math.cos(part.yaw), s = Math.sin(part.yaw); return [[c, -s], [s, c]] }
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1]
const radius = (part: BlockPart, axis: number[]) => { const a = axes(part); return Math.abs(dot(a[0], axis)) * part.size[0] / 2 + Math.abs(dot(a[1], axis)) * part.size[2] / 2 }

export function boxSeparation(a: BlockPart, b: BlockPart) {
  if (!isPlainBox(a) || !isPlainBox(b)) return solidSeparation(solidOf(a), solidOf(b))
  const delta = [b.position[0] - a.position[0], b.position[2] - a.position[2]]
  let gap = Math.abs(a.position[1] - b.position[1]) - (a.size[1] + b.size[1]) / 2
  for (const axis of [...axes(a), ...axes(b)]) gap = Math.max(gap, Math.abs(dot(delta, axis)) - radius(a, axis) - radius(b, axis))
  return gap
}

function overlappingFootprints(a: BlockPart, b: BlockPart) {
  const delta = [b.position[0] - a.position[0], b.position[2] - a.position[2]]
  return [...axes(a), ...axes(b)].every((axis) => Math.abs(dot(delta, axis)) - radius(a, axis) - radius(b, axis) < -EPS)
}

function coincidentFaces(a: BlockPart, b: BlockPart) {
  if (overlappingFootprints(a, b)) {
    for (const sign of [-1, 1]) if (Math.abs(a.position[1] + sign * a.size[1] / 2 - b.position[1] - sign * b.size[1] / 2) < EPS) return true
  }
  const verticalOverlap = Math.min(a.position[1] + a.size[1] / 2, b.position[1] + b.size[1] / 2) - Math.max(a.position[1] - a.size[1] / 2, b.position[1] - b.size[1] / 2)
  if (verticalOverlap <= EPS) return false
  for (const normal of axes(a)) {
    if (!axes(b).some((axis) => Math.abs(dot(normal, axis)) > 1 - EPS)) continue
    const tangent = [-normal[1], normal[0]]
    const aCenter = [a.position[0], a.position[2]], bCenter = [b.position[0], b.position[2]]
    const tangentGap = Math.abs(dot([bCenter[0] - aCenter[0], bCenter[1] - aCenter[1]], tangent)) - radius(a, tangent) - radius(b, tangent)
    if (tangentGap >= -EPS) continue
    for (const sign of [-1, 1]) if (Math.abs(dot(aCenter, normal) + sign * radius(a, normal) - dot(bCenter, normal) - sign * radius(b, normal)) < EPS) return true
  }
  return false
}

export function pointInPartXZ(part: BlockPart, x: number, z: number, margin = 0) {
  if (!isPlainBox(part)) return solidContainsXZ(solidOf(part), x, z, margin)
  const dx = x - part.position[0], dz = z - part.position[2], c = Math.cos(part.yaw), s = Math.sin(part.yaw)
  return Math.abs(c * dx - s * dz) <= part.size[0] / 2 + margin && Math.abs(s * dx + c * dz) <= part.size[2] / 2 + margin
}

function capsuleTouches(part: BlockPart, point: Vec3, radius = 0.28) {
  if (part.position[1] - part.size[1] / 2 >= point[1] + 1.8 - EPS || part.position[1] + part.size[1] / 2 <= point[1] + 0.245) return false
  const dx = point[0] - part.position[0], dz = point[2] - part.position[2], c = Math.cos(part.yaw), s = Math.sin(part.yaw)
  const x = Math.max(0, Math.abs(c * dx - s * dz) - part.size[0] / 2)
  const z = Math.max(0, Math.abs(s * dx + c * dz) - part.size[2] / 2)
  return Math.hypot(x, z) < radius - EPS
}

export function validateModel(model: BlockModel, checkRoutes = true): ValidationReport {
  const issues: ValidationIssue[] = []
  const solids = new Map<BlockPart, Solid>()
  const hull = (part: BlockPart) => { let value = solids.get(part); if (!value) { value = solidOf(part); solids.set(part, value) }; return value }
  const bounds = modelBounds(model)
  const indexed = model.parts.map((part, index) => ({ part, index, bounds: partBounds(part) }))
  const boxes = new Map(indexed.map((entry) => [entry.part, entry.bounds]))
  const neighbors = model.parts.map(() => [] as number[])
  const grounded: number[] = []
  const ids = new Set<string>()
  for (const { part, index, bounds: box } of indexed) {
    if (ids.has(part.id)) issues.push({ code: 'duplicate-id', part: part.id, message: 'Identificador repetido.' })
    ids.add(part.id)
    if (![...part.position, ...part.size, part.yaw, part.pitch ?? 0, part.roll ?? 0, ...(part.profile?.flat() ?? [])].every(Number.isFinite)) issues.push({ code: 'non-finite', part: part.id, message: 'Transformação contém NaN ou infinito.' })
    if (part.size.some((n) => n < (part.detail ? 0.004 : 0.009) || n > 100) || !BLOCK_MATERIALS[part.material]) issues.push({ code: 'dimension', part: part.id, message: 'Dimensão degenerada ou material inexistente.' })
    if (box.min[1] < -CONTACT) issues.push({ code: 'below-ground', part: part.id, message: 'Peça ultrapassa a base do asset.' })
    if (Math.abs(box.min[1]) <= CONTACT) grounded.push(index)
  }
  indexed.sort((a, b) => a.bounds.min[0] - b.bounds.min[0])
  for (let i = 0; i < indexed.length; i++) for (let j = i + 1; j < indexed.length; j++) {
    const a = indexed[i], b = indexed[j]
    if (b.bounds.min[0] > a.bounds.max[0] + CONTACT) break
    if (a.bounds.max[1] + CONTACT < b.bounds.min[1] || b.bounds.max[1] + CONTACT < a.bounds.min[1] || a.bounds.max[2] + CONTACT < b.bounds.min[2] || b.bounds.max[2] + CONTACT < a.bounds.min[2]) continue
    const plain = isPlainBox(a.part) && isPlainBox(b.part)
    const gap = plain ? boxSeparation(a.part, b.part) : solidSeparation(hull(a.part), hull(b.part))
    if (gap > CONTACT) continue
    neighbors[a.index].push(b.index); neighbors[b.index].push(a.index)
    if (gap < -EPS) issues.push({ code: 'overlap', part: a.part.id, other: b.part.id, message: `Interpenetração OBB (${(-gap * 1000).toFixed(2)} mm).` })
    if (plain ? coincidentFaces(a.part, b.part) : coincidentSolidFaces(hull(a.part), hull(b.part))) issues.push({ code: 'z-fighting', part: a.part.id, other: b.part.id, message: 'Faces coplanares com a mesma normal e área sobreposta.' })
  }
  const supported = new Set(grounded), queue = [...grounded]
  for (let head = 0; head < queue.length; head++) for (const next of neighbors[queue[head]]) if (!supported.has(next)) { supported.add(next); queue.push(next) }
  model.parts.forEach((part, index) => { if (!supported.has(index)) issues.push({ code: 'unsupported', part: part.id, message: 'Componente sem contato com a base ou com uma cadeia apoiada.' }) })
  const byId = new Map(model.parts.map((part) => [part.id, part]))
  for (const part of model.parts) {
    if (part.bevel !== undefined && (!Number.isFinite(part.bevel) || part.bevel < 0 || part.bevel > Math.min(...part.size) / 2)) issues.push({ code: 'dimension', part: part.id, message: 'Raio de acabamento fora do volume da peça.' })
    if (part.support) {
      const support = byId.get(part.support)
      if (!support || Math.abs(boxSeparation(part, support)) > CONTACT) issues.push({ code: 'unsupported', part: part.id, other: part.support, message: 'Ferragem sem contato com seu suporte declarado.' })
    }
  }
  for (const socket of model.sockets) {
    const support = byId.get(socket.support)
    if (!support || !socket.position.every(Number.isFinite) || Math.abs(support.position[1] + support.size[1] / 2 - socket.position[1]) > CONTACT || !pointInPartXZ(support, socket.position[0], socket.position[2], EPS)) issues.push({ code: 'socket', part: socket.id, message: 'Ponto de recurso sem superfície de apoio válida.' })
  }
  const structure = model as Partial<StructureModel>
  if (structure.blueprint && !model.sockets.length) issues.push({ code: 'missing-resources', part: model.id, message: 'Estrutura sem nenhum recurso recuperável.' })
  if (checkRoutes && structure.routes) for (const route of structure.routes) {
    const distance = Math.hypot(...route.from.map((v, i) => v - route.to[i]))
    const samples = Math.max(1, Math.ceil(distance / 0.18))
    let error: ValidationIssue | null = null
    for (let i = 0; i <= samples && !error; i++) {
      const point = route.from.map((v, axis) => v + (route.to[axis] - v) * i / samples) as Vec3
      let surface = -Infinity
      for (const part of model.parts) {
        const box = boxes.get(part)!
        if (box.min[0] > point[0] + CONTACT || box.max[0] < point[0] - CONTACT || box.min[2] > point[2] + CONTACT || box.max[2] < point[2] - CONTACT) continue
        const top = isPlainBox(part) ? part.position[1] + part.size[1] / 2 : solidTopAt(hull(part), point[0], point[2])
        if (top <= point[1] + 0.245 && top >= point[1] - 0.245 && (isPlainBox(part) ? pointInPartXZ(part, point[0], point[2], CONTACT) : true)) surface = Math.max(surface, top)
      }
      if (!Number.isFinite(surface)) { error = { code: 'unsupported-route', part: route.id, message: 'Rota de exploração passa por um vazio sem piso.' }; break }

      point[1] = surface
      const blocker = model.parts.find((part) => {
        if (isPlainBox(part)) return capsuleTouches(part, point)
        const box = boxes.get(part)!
        if (box.min[1] >= point[1] + 1.8 || box.max[1] <= point[1] + 0.245 || box.min[0] > point[0] + 0.28 || box.max[0] < point[0] - 0.28 || box.min[2] > point[2] + 0.28 || box.max[2] < point[2] - 0.28) return false
        return solidTouchesCapsule(hull(part), point, 0.28)
      })
      if (blocker) error = { code: 'blocked-route', part: route.id, other: blocker.id, message: 'Corredor sem largura ou altura para cápsula de 0,56 × 1,80 m.' }
    }
    if (error) issues.push(error)
  }
  return { id: model.id, passed: issues.length === 0, parts: model.parts.length, triangles: model.parts.reduce((sum, part) => sum + (part.detail ? 0 : isPlainBox(part) ? 12 : localSolid(part).faces.reduce((n, face) => n + (face.length - 2), 0)), 0), connected: supported.size, sockets: model.sockets.length, routes: structure.routes?.length ?? 0, bounds, issues }
}
