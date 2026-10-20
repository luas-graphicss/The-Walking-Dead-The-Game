import { CHUNK_SIZE, WORLD_HALF, VIEW_RADIUS, chunkKey, type ChunkLod, type Quality } from './settings'

export type ChunkRequest = { cx: number; cz: number; lod: ChunkLod; key: string; priority: number }
export function planChunks(x: number, z: number, quality: Quality): ChunkRequest[] {
  const centerX = Math.floor(x / CHUNK_SIZE), centerZ = Math.floor(z / CHUNK_SIZE)
  const radius = VIEW_RADIUS[quality], limit = WORLD_HALF / CHUNK_SIZE
  const result: ChunkRequest[] = []
  for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
    const cx = centerX + dx, cz = centerZ + dz
    if (cx < -limit || cx >= limit || cz < -limit || cz >= limit) continue
    const distance = Math.max(Math.abs(dx), Math.abs(dz))
    const lod: ChunkLod = distance <= 1 ? 0 : distance <= 3 ? 1 : 2
    result.push({ cx, cz, lod, key: chunkKey(cx, cz, lod), priority: lod * 100 + dx * dx + dz * dz })
  }
  return result.sort((a, b) => a.priority - b.priority || a.cx - b.cx || a.cz - b.cz)
}
