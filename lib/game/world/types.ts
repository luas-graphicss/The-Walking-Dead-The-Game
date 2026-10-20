import type { ChunkLod } from './settings'

export type Biome = 'forest' | 'denseForest' | 'pine' | 'meadow' | 'scrub' | 'highlands' | 'wetland' | 'shore' | 'beach' | 'river' | 'lake' | 'ocean' | 'waterfall'
export const BIOME_LABELS: Record<Biome, string> = {
  forest: 'Floresta temperada', denseForest: 'Floresta densa', pine: 'Bosque de coníferas', meadow: 'Campos abertos',
  scrub: 'Mata seca', highlands: 'Serra rochosa', wetland: 'Margem de lago', shore: 'Dunas e restinga',
  beach: 'Praia', river: 'Margem de rio', lake: 'Lago', ocean: 'Mar aberto', waterfall: 'Cachoeira',
}
export type WaterKind = 'none' | 'ocean' | 'lake' | 'pond' | 'river'
export type Point2 = { x: number; z: number }
export type Point3 = Point2 & { y: number }
export type Bounds = { minX: number; minZ: number; maxX: number; maxZ: number }
export type TerrainPoint = {
  height: number; waterLevel: number; moisture: number; biome: Biome; forest: number
  water: WaterKind; fall: number; coast: number

  shore: number

  sand: number

  dense: number

  flowX: number; flowZ: number
  downstream: number

  fallX: number; fallZ: number; lip: number; foot: number
}
export type Town = Point3 & { id: string; cx: number; cz: number; name: string; radius: number; kind: 'hamlet' | 'village' | 'town' | 'city'; angle: number; wet: boolean }
export type RoadKind = 'highway' | 'country' | 'street' | 'track'
export type RoadCondition = 'new' | 'worn' | 'broken'
export type Road = {
  id: string; from: string; to: string; kind: RoadKind; condition: RoadCondition; width: number
  points: Point3[]; length: number

  bridge: Uint8Array

  reach: Float32Array

  earth: Float32Array

  rails: Uint8Array

  normals: Float32Array
}
export type RoadSegment = {
  a: Point3; b: Point3; road: Road; index: number; roadId: string
  kind: RoadKind; condition: RoadCondition; width: number; half: number; core: number; priority: number
  distance: number; length: number; bridge: boolean; reachA: number; reachB: number

  cut: boolean; fill: boolean; cutSlopeL: number; cutSlopeR: number; fillSlopeL: number; fillSlopeR: number
}
export type RoadInfluence = {

  surface: number

  height: number
  weight: number

  core: number

  sink: number
  distance: number; width: number; kind: RoadKind | null

  pavement: number
  nearY: number
  dominant: RoadSegment | null

  nearest: RoadSegment | null
}

export type JunctionArm = {
  angle: number; half: number; roadId: string; road: Road; kind: RoadKind; end: boolean; along: number; dir: 1 | -1
}
export type MeshData = {
  positions: Float32Array; normals: Float32Array; colors: Float32Array; indices: Uint32Array

  uvs?: Float32Array; groups?: Uint32Array

  alphas?: Float32Array

  splat?: Uint8Array
}
export type ChunkData = {
  key: string; cx: number; cz: number; lod: ChunkLod; segments: number

  terrain: MeshData; roads: MeshData; markings: MeshData; props: MeshData; water: MeshData

  waterfall: MeshData

  spray: Float32Array
  trees: Float32Array; grass: Float32Array

  posts: Float32Array

  litter: MeshData

  floor: Float32Array

  solids: Float32Array

  structures: Float32Array

  buildings: MeshData
  biome: Biome; town: string | null; generationMs: number
}
export type AtlasData = {
  bounds: Bounds; size: number; pixels: Uint8ClampedArray
  towns: Town[]; roads: { id: string; kind: RoadKind; points: Point2[] }[]
}
export type WorldRequest =
  | { id: number; kind: 'chunk'; cx: number; cz: number; lod: ChunkLod }
  | { id: number; kind: 'atlas'; bounds: Bounds; size: number }
export type WorkerMessage = { kind: 'init'; seed: string } | WorldRequest
export type WorkerResponse =
  | { id: number; kind: 'chunk'; data: ChunkData }
  | { id: number; kind: 'atlas'; data: AtlasData }
  | { id: number; kind: 'error'; message: string }
