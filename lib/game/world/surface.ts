import { CHUNK_SIZE } from './settings'
import type { ChunkData } from './types'

export function chunkSurface(data: ChunkData, x: number, z: number) {
  const step = CHUNK_SIZE / data.segments, stride = data.segments + 1
  const fx = Math.max(0, Math.min(data.segments - 0.000001, x / step)), fz = Math.max(0, Math.min(data.segments - 0.000001, z / step))
  const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz
  const positions = data.terrain.positions
  const a = positions[(iz * stride + ix) * 3 + 1], b = positions[(iz * stride + ix + 1) * 3 + 1]
  const c = positions[((iz + 1) * stride + ix) * 3 + 1], d = positions[((iz + 1) * stride + ix + 1) * 3 + 1]
  const first = u + v <= 1
  const height = first ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v)
  const nx = (first ? a - b : c - d) / step, nz = (first ? a - c : b - d) / step, length = Math.hypot(nx, 1, nz)
  return { height, normal: [nx / length, 1 / length, nz / length] as [number, number, number] }
}
