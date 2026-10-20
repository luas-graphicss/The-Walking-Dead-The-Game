import { BufferGeometry, Float32BufferAttribute } from 'three'
import { detailedBox } from './detail-geometry'
import { BLOCK_MATERIALS, type BlockPart } from './types'

export function edgeRadius(part: BlockPart) {
  if (part.bevel !== undefined) return part.bevel
  const shortest = Math.min(...part.size)
  if (part.primitive === 'prism' || part.primitive === 'cone') return 0
  const soft = ['fabric', 'leather', 'rubber'].includes(part.material)
  return Math.min(shortest * (soft ? 0.22 : 0.09), soft ? 0.045 : part.material === 'tile' ? 0.012 : 0.005)
}

export function roundedBox(part: BlockPart) {
  return detailedBox(part, edgeRadius(part))
}

export function roundedCylinder(part: BlockPart) {
  const [w, h, d] = part.size, rx = w / 2, rz = d / 2
  const sides = part.radialSegments ?? (part.detail ? 24 : Math.max(w, d) > 0.75 ? 64 : 48)
  const bevel = Math.min(edgeRadius(part), h * 0.2, Math.min(rx, rz) * 0.18)
  const k = bevel / Math.min(rx, rz), tile = BLOCK_MATERIALS[part.material].tile
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = []
  const rings: [number, number, number, number][] = []
  const steps = sides <= 8 || part.detail ? 1 : 4
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + i / steps * Math.PI / 2
    rings.push([1 - k + k * Math.cos(a), -h / 2 + bevel + bevel * Math.sin(a), Math.cos(a), Math.sin(a)])
  }
  for (let i = 0; i <= steps; i++) {
    const a = i / steps * Math.PI / 2
    rings.push([1 - k + k * Math.cos(a), h / 2 - bevel + bevel * Math.sin(a), Math.cos(a), Math.sin(a)])
  }
  const perimeter = [0]
  for (let i = 1; i <= sides; i++) {
    const a = i * Math.PI * 2 / sides, p = (i - 1) * Math.PI * 2 / sides
    perimeter.push(perimeter[i - 1] + Math.hypot((Math.cos(a) - Math.cos(p)) * rx, (Math.sin(a) - Math.sin(p)) * rz))
  }
  let vertical = 0
  rings.forEach(([r, y, nr, ny], j) => {
    if (j) vertical += Math.hypot((r - rings[j - 1][0]) * Math.min(rx, rz), y - rings[j - 1][1])
    for (let i = 0; i <= sides; i++) {
      const a = i * Math.PI * 2 / sides, x = Math.cos(a), z = Math.sin(a)
      positions.push(x * rx * r, y, z * rz * r)
      const nx = x * nr * Math.min(rx, rz) / rx, nz = z * nr * Math.min(rx, rz) / rz, length = Math.hypot(nx, ny, nz)
      normals.push(nx / length, ny / length, nz / length)
      uvs.push(perimeter[i] / tile, vertical / tile)
      if (j && i < sides) {
        const a0 = (j - 1) * (sides + 1) + i, b0 = j * (sides + 1) + i
        indices.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1)
      }
    }
  })
  for (const sign of [-1, 1]) {
    const center = positions.length / 3
    positions.push(0, sign * h / 2, 0); normals.push(0, sign, 0); uvs.push(0, 0)
    for (let i = 0; i < sides; i++) {
      const a = i * Math.PI * 2 / sides, x = Math.cos(a) * rx * (1 - k), z = Math.sin(a) * rz * (1 - k)
      positions.push(x, sign * h / 2, z); normals.push(0, sign, 0); uvs.push(x / tile, z / tile)
    }
    for (let i = 0; i < sides; i++) {
      const a = center + 1 + i, b = center + 1 + (i + 1) % sides
      if (sign < 0) indices.push(center, a, b)
      else indices.push(center, b, a)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}
