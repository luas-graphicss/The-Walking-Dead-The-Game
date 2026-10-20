export const WORLD_VERSION = 4
export const DEFAULT_SEED = 'TWD-2049'
export const WORLD_SIZE = 4_096_000
export const WORLD_HALF = WORLD_SIZE / 2
export const CHUNK_SIZE = 256

export const STRUCTURE_SCALE = 1.25
export const REGION_SIZE = 8_192
export const REBASE_DISTANCE = 768
export const TREE_CELL = 13
export const WATER_NONE = -10_000
export const SEA_LEVEL = 0

export const LOD_SEGMENTS = [128, 32, 16] as const
export type ChunkLod = 0 | 1 | 2
export type Quality = 'low' | 'balanced' | 'high'
export const VIEW_RADIUS: Record<Quality, number> = { low: 3, balanced: 4, high: 6 }

export const FLOOR_STRIDE = 12

export const FLOOR_KIND = { pebble: 0, twig: 1, boulder: 2, log: 3, stump: 4, leaf: 5, debris: 6 } as const
export type FloorKind = (typeof FLOOR_KIND)[keyof typeof FLOOR_KIND]

export const FALL_STRIDE = 6

export const FALL_TILE = 64

export const WORLD_COLORS = {
  vegetation: '#6c7855',
  earth: '#968a70',
  stone: '#4d544e',
  water: '#788b8a',
  marking: '#d8d2b8',
  asphalt: '#3e4240',
  paint: '#c7a443',
  sand: '#b9aa86',
  deepWater: '#3e5a5d',
  foam: '#e3e9e6',
  metal: '#9ba2a3',
  concrete: '#8c8f88',
  litter: '#6b5838',
  needles: '#7a5a3a',
} as const

export function insideWorld(x: number, z: number, margin = 0) {
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < WORLD_HALF - margin && Math.abs(z) < WORLD_HALF - margin
}

export function clampWorld(value: number) {
  return Math.max(-WORLD_HALF + 20, Math.min(WORLD_HALF - 20, Number.isFinite(value) ? value : 0))
}

export function chunkKey(cx: number, cz: number, lod?: number) {
  return lod === undefined ? `${cx},${cz}` : `${cx},${cz}:${lod}`
}

export function originFor(x: number, z: number) {
  return { x: Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE, z: Math.floor(z / CHUNK_SIZE) * CHUNK_SIZE }
}

export function worldToLocal(x: number, z: number, origin: { x: number; z: number }) {
  return { x: x - origin.x, z: z - origin.z }
}

export function normalizeSeed(value: string) {
  return value.trim().slice(0, 64) || DEFAULT_SEED
}
