import { BufferGeometry, Float32BufferAttribute } from 'three'
import { BLOCK_MATERIALS, hash, type BlockPart } from './types'

const TAU = Math.PI * 2
const softMaterials = new Set(['fabric', 'leather', 'rubber'])
const axes = [
  { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], normalAxis: 0, uAxis: 2, vAxis: 1 },
  { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], normalAxis: 0, uAxis: 2, vAxis: 1 },
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], normalAxis: 1, uAxis: 0, vAxis: 2 },
  { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], normalAxis: 1, uAxis: 0, vAxis: 2 },
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], normalAxis: 2, uAxis: 0, vAxis: 1 },
  { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], normalAxis: 2, uAxis: 0, vAxis: 1 },
]

function coordinates(length: number, radius: number, detailed: boolean, soft: boolean, panel: boolean) {
  const half = length / 2, core = Math.max(0, half - radius)
  const segments = detailed ? 1 : Math.min(20, Math.max(1, Math.ceil((length - 2 * radius) / (soft ? 0.1 : 0.24))))
  const values = new Set<number>()
  for (let i = 0; i <= segments; i++) values.add(-core + 2 * core * i / segments)
  const bevelSegments = detailed ? 2 : soft ? 4 : 3
  for (const sign of [-1, 1]) for (let i = 1; i <= bevelSegments; i++) values.add(sign * (core + radius * Math.tan(i / bevelSegments * Math.PI / 4)))
  if (panel && length > 0.18) for (const sign of [-1, 1]) for (const margin of [0.028, 0.032, 0.037]) if (margin > radius) values.add(sign * (half - margin))
  return [...values].sort((a, b) => a - b).filter((value, i, array) => i === 0 || value - array[i - 1] > 1e-7)
}

export function detailedBox(part: BlockPart, radius: number, tile = BLOCK_MATERIALS[part.material].tile) {
  const soft = softMaterials.has(part.material), metal = part.material === 'steel' || part.material === 'paint'
  const detail = Boolean(part.detail) || Boolean(part.coarse) || Math.max(...part.size) < 0.1
  const panel = !detail && metal && Math.min(part.size[0], part.size[1]) > 0.24
  const grids = part.size.map((length) => coordinates(length, radius, detail, soft, panel))
  const half = part.size.map((length) => length / 2), core = half.map((length) => Math.max(0, length - radius))
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = []
  const charts: { start: number; count: number; u: number[]; v: number[] }[] = []
  const phase = hash(part.id.replace(/.*\/instance-\d+\//, '')) / 4294967296 * TAU
  for (const [faceIndex, face] of axes.entries()) {
    const us = grids[face.uAxis], vs = grids[face.vAxis], width = half[face.uAxis], height = half[face.vAxis]
    const base = positions.length / 3
    const rotate = ['wood', 'charcoal', 'straw'].includes(part.material) && width > height
    charts.push({ start: base, count: us.length * vs.length, u: rotate ? face.v : face.u, v: rotate ? face.u : face.v })
    const insetAt = (u: number, v: number) => {
      if (detail || faceIndex === 3) return 0
      const edge = Math.min(width - Math.abs(u), height - Math.abs(v))
      const fade = Math.max(0, Math.min(1, (edge - radius * 1.5) / 0.025))
      const grain = 0.5 + 0.25 * Math.sin(u * 28 + phase) + 0.25 * Math.cos(v * 23 - phase)
      const groove = panel ? Math.max(0, 1 - Math.abs(edge - 0.032) / 0.005) * 0.0018 : 0
      const weave = soft ? 0.0018 * (0.5 + 0.5 * Math.sin(u * 15 + phase) * Math.sin(v * 17)) : 0
      const amount = part.material === 'glass' || part.material === 'tile' ? 0.00008 : metal ? 0.00018 : 0.0006
      return fade * (grain * amount + weave + groove)
    }
    for (const v of vs) for (const u of us) {
      const p = face.normal.map((n, axis) => n * half[face.normalAxis] + face.u[axis] * u + face.v[axis] * v)
      const anchor = p.map((value, axis) => Math.max(-core[axis], Math.min(core[axis], value)))
      const delta = p.map((value, axis) => value - anchor[axis]), length = Math.hypot(...delta)
      const normal = delta.map((value) => value / length)
      const inset = insetAt(u, v)
      positions.push(...anchor.map((value, axis) => value + normal[axis] * Math.max(0, radius - inset)))
      const du = (insetAt(u + 0.0005, v) - insetAt(u - 0.0005, v)) / 0.001
      const dv = (insetAt(u, v + 0.0005) - insetAt(u, v - 0.0005)) / 0.001
      const adjusted = normal.map((value, axis) => value + face.u[axis] * du + face.v[axis] * dv), normLength = Math.hypot(...adjusted)
      normals.push(...adjusted.map((value) => value / normLength))
      const alongWidth = ['wood', 'charcoal', 'straw'].includes(part.material) && width > height
      uvs.push((alongWidth ? v : u) / tile, (alongWidth ? u : v) / tile)
    }
    for (let y = 0; y < vs.length - 1; y++) for (let x = 0; x < us.length - 1; x++) {
      const a = base + y * us.length + x, b = a + 1, c = a + us.length, d = c + 1
      indices.push(a, b, d, a, d, c)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.userData.uvCharts = charts
  return geometry
}
