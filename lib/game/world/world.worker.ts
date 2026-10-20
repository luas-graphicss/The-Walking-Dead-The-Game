import { WorldGenerator } from './generator'
import { CHUNK_SIZE, WORLD_HALF, normalizeSeed } from './settings'
import type { ChunkData, WorkerMessage, WorkerResponse } from './types'

const scope = self as unknown as {
  onmessage: (event: MessageEvent<WorkerMessage>) => void
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void
}
let generator: WorldGenerator | null = null

function transfers(data: ChunkData): Transferable[] {
  const result: Transferable[] = []
  for (const mesh of [data.terrain, data.roads, data.markings, data.props, data.water, data.waterfall, data.litter, data.buildings]) {
    for (const array of [mesh.positions, mesh.normals, mesh.colors, mesh.indices, mesh.uvs, mesh.groups, mesh.alphas, mesh.splat]) if (array) result.push(array.buffer as ArrayBuffer)
  }
  result.push(
    data.trees.buffer as ArrayBuffer, data.grass.buffer as ArrayBuffer, data.posts.buffer as ArrayBuffer, data.floor.buffer as ArrayBuffer,
    data.solids.buffer as ArrayBuffer, data.structures.buffer as ArrayBuffer, data.spray.buffer as ArrayBuffer,
  )
  return result
}

scope.onmessage = ({ data }) => {
  if (data.kind === 'init') { generator = new WorldGenerator(normalizeSeed(data.seed)); return }
  try {
    if (!generator) throw new Error('O gerador ainda não foi inicializado.')
    if (data.kind === 'chunk') {
      const limit = WORLD_HALF / CHUNK_SIZE
      if (!Number.isInteger(data.cx) || !Number.isInteger(data.cz) || data.cx < -limit || data.cx >= limit || data.cz < -limit || data.cz >= limit || ![0, 1, 2].includes(data.lod)) throw new Error('Região fora dos limites do mundo.')
      const chunk = generator.buildChunk(data.cx, data.cz, data.lod)
      scope.postMessage({ id: data.id, kind: 'chunk', data: chunk }, transfers(chunk))
    } else {
      const { minX, minZ, maxX, maxZ } = data.bounds
      if (![minX, minZ, maxX, maxZ].every(Number.isFinite) || minX >= maxX || minZ >= maxZ) throw new Error('Área inválida no atlas.')
      const atlas = generator.buildAtlas(data.bounds, Math.max(64, Math.min(256, Math.floor(data.size))))
      scope.postMessage({ id: data.id, kind: 'atlas', data: atlas }, [atlas.pixels.buffer as ArrayBuffer])
    }
  } catch (error) {
    scope.postMessage({ id: data.id, kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível gerar esta região.' })
  }
}
