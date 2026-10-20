import { isMobileDevice } from '../device'

export const FOREST_FLOOR_KIT_URL = '/models/forest-floor.glb'
export const ROAD_KIT_URL = '/models/road-kit.glb'
export const VEGETATION_KIT_URL = '/models/vegetation.glb?v=dense-canopy-2'

export const TEXTURE_SETS = [
  'asphalt', 'asphalt-cracked', 'dirt', 'paint', 'sidewalk', 'concrete', 'steel', 'leaf-litter', 'pine-needles', 'rock', 'moss',
  'bark', 'endgrain', 'deadwood', 'soil', 'leaves', 'rock-atlas', 'asphalt-debris',
  'pine-bark', 'birch-bark', 'foliage-broadleaf', 'foliage-pine', 'grass', 'tree-impostors',
] as const
export type TextureSet = (typeof TEXTURE_SETS)[number]

export const RUNTIME_SETS = TEXTURE_SETS.filter((set) => set !== 'rock' && set !== 'moss')
export const TEXTURE_MAPS = ['albedo', 'normal', 'orm'] as const
export type TextureMap = (typeof TEXTURE_MAPS)[number]

export function textureUrl(set: TextureSet, map: TextureMap) {
  return `/textures/${set}/${map}${isMobileDevice() ? '.mobile' : ''}.webp?v=forest-pbr-2`
}

export const KIT_MATERIALS = {
  rock: 'rock-atlas', bark: 'bark', endgrain: 'endgrain', deadwood: 'deadwood', soil: 'soil', leaves: 'leaves', steel: 'steel', asphalt_debris: 'asphalt-debris',
  pine_bark: 'pine-bark', birch_bark: 'birch-bark', foliage_broadleaf: 'foliage-broadleaf', foliage_pine: 'foliage-pine', grass: 'grass',
} as const satisfies Record<string, TextureSet>

export const FOLIAGE_MATERIALS: readonly string[] = ['foliage_broadleaf', 'foliage_pine', 'grass']

export const ROAD_LAYERS = ['asphalt', 'asphalt-cracked', 'dirt', 'sidewalk', 'concrete'] as const satisfies readonly TextureSet[]
export const ROAD_LAYER = { asphalt: 0, cracked: 1, dirt: 2, sidewalk: 3, concrete: 4 } as const
export const STRUCTURE_LAYERS = ['concrete', 'steel'] as const satisfies readonly TextureSet[]
export const STRUCTURE_LAYER = { concrete: 0, steel: 1 } as const
export const LITTER_LAYERS = ['leaf-litter', 'pine-needles'] as const satisfies readonly TextureSet[]
export const LITTER_LAYER = { leaves: 0, needles: 1 } as const

export type GroundSet = { name: string; seamless: boolean; flatten: number; relief: number; rough: [number, number]; ao: number }

export type TerrainLayerSpec = GroundSet & {

  tile: number

  depth: number

  triplanar: boolean
}

export const TERRAIN_LAYERS: TerrainLayerSpec[] = [
  { name: 'verge', tile: 256 / 200, depth: 0.012, triplanar: false, seamless: true, flatten: 0.75, relief: 1.5, rough: [0.94, 0.78], ao: 3.5 },
  { name: 'meadow', tile: 256 / 160, depth: 0.02, triplanar: false, seamless: true, flatten: 0.7, relief: 1.8, rough: [0.96, 0.8], ao: 4.5 },
  { name: 'dry-grass', tile: 256 / 160, depth: 0.018, triplanar: false, seamless: true, flatten: 0.7, relief: 1.8, rough: [0.97, 0.86], ao: 4 },
  { name: 'forest-floor', tile: 256 / 200, depth: 0.035, triplanar: false, seamless: true, flatten: 0.6, relief: 2.6, rough: [0.96, 0.74], ao: 6 },
  { name: 'forest-moss', tile: 256 / 200, depth: 0.024, triplanar: false, seamless: true, flatten: 0.6, relief: 2.1, rough: [1, 0.86], ao: 5 },
  { name: 'pine-floor', tile: 256 / 200, depth: 0.024, triplanar: false, seamless: true, flatten: 0.65, relief: 2.3, rough: [0.95, 0.76], ao: 5 },
  { name: 'soil', tile: 256 / 160, depth: 0.026, triplanar: false, seamless: true, flatten: 0.7, relief: 2.4, rough: [0.98, 0.86], ao: 5 },
  { name: 'rock', tile: 256 / 80, depth: 0.06, triplanar: true, seamless: true, flatten: 0.55, relief: 2.8, rough: [0.92, 0.72], ao: 5 },
  { name: 'granite-lichen', tile: 256 / 100, depth: 0.045, triplanar: true, seamless: true, flatten: 0.55, relief: 2.5, rough: [0.9, 0.72], ao: 5 },
  { name: 'scree', tile: 256 / 160, depth: 0.045, triplanar: false, seamless: true, flatten: 0.6, relief: 2.9, rough: [0.95, 0.74], ao: 6.5 },
  { name: 'sand', tile: 256 / 100, depth: 0.012, triplanar: false, seamless: true, flatten: 0.75, relief: 1.3, rough: [0.98, 0.9], ao: 2 },
]
export const TERRAIN_LAYER = { verge: 0, meadow: 1, dry: 2, litter: 3, moss: 4, needles: 5, soil: 6, rock: 7, summit: 8, scree: 9, sand: 10 } as const

export const TERRAIN_SPLAT = 12
export const TERRAIN_WET = 11

export type SidewalkStyle = GroundSet & {

  tile: number

  weight: number
}

export const SIDEWALK_STYLES: SidewalkStyle[] = [
  { name: 'sidewalk-worn', tile: 1.8, weight: 0.15, seamless: false, flatten: 0.35, relief: 1.4, rough: [0.95, 0.84], ao: 3 },
  { name: 'sidewalk-pavers', tile: 1.6, weight: 0.15, seamless: false, flatten: 0.4, relief: 1.6, rough: [0.94, 0.82], ao: 4 },
  { name: 'sidewalk-brick', tile: 1.4, weight: 0.15, seamless: false, flatten: 0.4, relief: 1.9, rough: [0.93, 0.78], ao: 4.5 },
  { name: 'sidewalk-hex', tile: 1.6, weight: 0.12, seamless: false, flatten: 0.4, relief: 1.8, rough: [0.94, 0.8], ao: 4.5 },
  { name: 'sidewalk-cobble', tile: 1.4, weight: 0.13, seamless: true, flatten: 0.4, relief: 2.2, rough: [0.92, 0.76], ao: 5 },
]
export const GROUND_SETS: GroundSet[] = [...TERRAIN_LAYERS, ...SIDEWALK_STYLES]

export const groundUrl = (name: string, small = false) => `/textures/ground/${name}${small ? '.mobile' : ''}.webp?v=1`

export const TILE = {
  asphalt: 4, dirt: 4, paint: 2, sidewalk: 1.2, concrete: 2, steel: 1, litter: 2, needles: 2, rock: 2, moss: 2, bark: 0.5,
  pineBark: 0.8, deadwood: 0.6,
} as const

export const SPECIES = { broadleaf: 0, oak: 0, pine: 1, snag: 2, spruce: 3, birch: 4, maple: 5 } as const
export const SPECIES_COUNT = 6
export const dropsNeedles = (species: number) => species === SPECIES.pine || species === SPECIES.spruce

export type TreeFoliage = 'oak' | 'maple' | 'birch' | 'pine' | 'spruce'
export type TreeSpec = { name: string; species: 0 | 1 | 2 | 3 | 4 | 5; height: number; crown: number; trunk: number; seed: number; foliage: TreeFoliage | null }
export const TREES: TreeSpec[] = [
  { name: 'oak_young', species: 0, height: 9, crown: 3.4, trunk: 0.2, seed: 0x7101, foliage: 'oak' },
  { name: 'oak_mature', species: 0, height: 15, crown: 5.4, trunk: 0.38, seed: 0x7202, foliage: 'oak' },
  { name: 'oak_old', species: 0, height: 20, crown: 7, trunk: 0.56, seed: 0x7303, foliage: 'oak' },
  { name: 'oak_spreading', species: 0, height: 13, crown: 6.6, trunk: 0.5, seed: 0x7314, foliage: 'oak' },
  { name: 'maple_young', species: 5, height: 10, crown: 3, trunk: 0.19, seed: 0x7121, foliage: 'maple' },
  { name: 'maple_mature', species: 5, height: 16, crown: 4.6, trunk: 0.34, seed: 0x7232, foliage: 'maple' },
  { name: 'beech_tall', species: 5, height: 24, crown: 5.8, trunk: 0.5, seed: 0x7343, foliage: 'maple' },
  { name: 'birch_young', species: 4, height: 10, crown: 2.4, trunk: 0.15, seed: 0x7151, foliage: 'birch' },
  { name: 'birch_mature', species: 4, height: 18, crown: 3.6, trunk: 0.26, seed: 0x7262, foliage: 'birch' },
  { name: 'pine_young', species: 1, height: 10, crown: 2.6, trunk: 0.2, seed: 0x7404, foliage: 'pine' },
  { name: 'pine_mature', species: 1, height: 17, crown: 3.8, trunk: 0.34, seed: 0x7505, foliage: 'pine' },
  { name: 'pine_tall', species: 1, height: 25, crown: 4.6, trunk: 0.48, seed: 0x7606, foliage: 'pine' },
  { name: 'spruce_young', species: 3, height: 8, crown: 2.3, trunk: 0.17, seed: 0x7171, foliage: 'spruce' },
  { name: 'spruce_mature', species: 3, height: 16, crown: 3.5, trunk: 0.32, seed: 0x7282, foliage: 'spruce' },
  { name: 'spruce_tall', species: 3, height: 26, crown: 4.6, trunk: 0.5, seed: 0x7393, foliage: 'spruce' },
  { name: 'snag_short', species: 2, height: 8.5, crown: 1.9, trunk: 0.28, seed: 0x7707, foliage: null },
  { name: 'snag_tall', species: 2, height: 15, crown: 2.8, trunk: 0.38, seed: 0x7808, foliage: null },
]
export const TREE_BURIED = 0.65

export const LOD_SUFFIX = '_lod1'
export const treeVariantPick = (yaw: number, shade: number) => ((yaw / (Math.PI * 2)) * 0.754877666 + shade * 0.569840296) % 1

const CROWN_FACTOR = [1.5, 1.2, 0.8, 1.1, 1.15, 1.4]

export const crownOf = (species: number, width: number) => width * (CROWN_FACTOR[species] ?? 1.5)
const CROWN_HEIGHT = [0.6, 0.72, 0.62, 0.46, 0.66, 0.63]

export const crownHeight = (species: number) => CROWN_HEIGHT[species] ?? 0.62

const variantsOf = Array.from({ length: SPECIES_COUNT }, (_, species) => TREES.flatMap((tree, index) => (tree.species === species ? [index] : [])))

export function treeFit(species: number, height: number, width: number, pick: number) {
  const crown = crownOf(species, width)
  const options = (variantsOf[species]?.length ? variantsOf[species] : variantsOf[0]).map((index) => {
    const spec = TREES[index]
    const off = Math.abs(Math.log(height / spec.height))
    return { index, off, score: off + 0.9 * Math.abs(Math.log(crown / height / (spec.crown / spec.height))) }
  })
  const eligible = options.filter((option) => option.off < Math.log(1.4)).sort((a, b) => a.score - b.score)
  const chosen = eligible.length ? (eligible.length > 1 && pick > 0.68 ? eligible[1] : eligible[0]) : options.sort((a, b) => a.off - b.off)[0]
  const spec = TREES[chosen.index]
  const sy = height / spec.height
  const sxz = sy * Math.min(1.15, Math.max(0.87, crown / (spec.crown * sy)))
  return { variant: chosen.index, sy, sxz, trunk: spec.trunk * sxz }
}

export const IMPOSTOR = { column: Math.min(256, Math.floor(4096 / TREES.length / 8) * 8), side: 512, top: 256 } as const
export const IMPOSTOR_ATLAS = { width: TREES.length * IMPOSTOR.column, height: IMPOSTOR.side + IMPOSTOR.top } as const

export function impostorLayout(index: number) {
  const spec = TREES[index]
  const reach = spec.crown * 1.32 + 0.6, tall = spec.height * 1.06 + 0.6
  const pixelsPerMetre = Math.min(IMPOSTOR.column / (2 * reach), IMPOSTOR.side / tall)
  const u0 = (index * IMPOSTOR.column) / IMPOSTOR_ATLAS.width, u1 = ((index + 1) * IMPOSTOR.column) / IMPOSTOR_ATLAS.width
  const split = IMPOSTOR.top / IMPOSTOR_ATLAS.height
  return {
    side: { width: IMPOSTOR.column / pixelsPerMetre, height: IMPOSTOR.side / pixelsPerMetre, pixelsPerMetre, u0, u1, v0: split, v1: 1 },
    top: { size: 2 * reach, y: spec.height * crownHeight(spec.species), pixelsPerMetre: IMPOSTOR.top / (2 * reach), u0, u1, v0: 0, v1: split },
  }
}

export type GrassSpec = { name: string; kind: 'tuft' | 'fern' | 'reeds'; height: number; radius: number; cards: number[]; seed: number }
export const GRASSES: GrassSpec[] = [
  { name: 'grass_green', kind: 'tuft', height: 0.8, radius: 0.2, cards: [0, 1], seed: 0x8101 },
  { name: 'grass_tall', kind: 'tuft', height: 1.1, radius: 0.24, cards: [1, 0, 2], seed: 0x8202 },
  { name: 'grass_mixed', kind: 'tuft', height: 0.75, radius: 0.2, cards: [2, 0, 1], seed: 0x8303 },
  { name: 'grass_dry', kind: 'tuft', height: 0.7, radius: 0.2, cards: [3, 2], seed: 0x8404 },
  { name: 'fern', kind: 'fern', height: 0.9, radius: 0.18, cards: [4, 5, 6, 7], seed: 0x8505 },
  { name: 'reeds', kind: 'reeds', height: 1.7, radius: 0.16, cards: [1, 0], seed: 0x8606 },
]

export const GRASS = { green: 0, tall: 1, mixed: 2, dry: 3, fern: 4, reeds: 5 } as const
export const GRASS_STRIDE = 6

export function grassFit(size: number, variant: number) {
  const index = Math.max(0, Math.min(GRASSES.length - 1, Math.round(variant)))
  return { variant: index, scale: size / GRASSES[index].height }
}

export type StoneSpec = { name: string; tall: number; deep: number }
export const BOULDERS: StoneSpec[] = [
  { name: 'boulder_rounded', tall: 0.62, deep: 0.86 },
  { name: 'boulder_slab', tall: 0.44, deep: 0.82 },
  { name: 'boulder_block', tall: 0.7, deep: 0.78 },
  { name: 'boulder_split', tall: 0.8, deep: 0.92 },
]
export const PEBBLES: StoneSpec[] = [
  { name: 'pebble_river', tall: 0.5, deep: 0.74 },
  { name: 'pebble_angular', tall: 0.62, deep: 0.82 },
  { name: 'pebble_flat', tall: 0.38, deep: 0.86 },
]

export const DEBRIS: StoneSpec[] = [
  { name: 'asphalt_chunk_a', tall: 0.42, deep: 0.8 },
  { name: 'asphalt_chunk_b', tall: 0.36, deep: 0.7 },
]

export type LogSpec = { name: string; length: number; radius: number; plate?: number; plateDepth?: number }
export const LOGS: LogSpec[] = [
  { name: 'log_short', length: 3.6, radius: 0.18 },
  { name: 'log_medium', length: 6.2, radius: 0.25 },
  { name: 'log_long', length: 9.4, radius: 0.32 },
  { name: 'log_uprooted', length: 7.2, radius: 0.28, plate: 0.95, plateDepth: 0.62 },
]
export const UPROOTED_LOG = 3

export type StumpSpec = { name: string; radius: number; height: number }
export const STUMPS: StumpSpec[] = [
  { name: 'stump_sawn', radius: 0.3, height: 0.46 },
  { name: 'stump_broken', radius: 0.36, height: 0.92 },
]
export const STUMP_BURIED = 0.45

export const STUMP_FLARE = 1.62

export type TwigSpec = { name: string; length: number; thick: number }
export const TWIGS: TwigSpec[] = [
  { name: 'twig_straight', length: 1.0, thick: 0.034 },
  { name: 'twig_bent', length: 1.5, thick: 0.044 },
  { name: 'twig_forked', length: 1.3, thick: 0.05 },
]

export type LeafSpec = { name: string; length: number }
export const LEAVES: LeafSpec[] = [
  { name: 'leaf_oak', length: 0.11 },
  { name: 'leaf_maple', length: 0.1 },
  { name: 'leaf_beech', length: 0.085 },
  { name: 'leaf_elm', length: 0.095 },
]

export const GUARDRAIL = {
  post: 'guardrail_post',

  railCenter: 0.92,

  railOffset: 0.5,

  railHeight: 0.46,
  railDepth: 0.12,
  railThickness: 0.006,

  blockout: 0.21,
  postDepth: 0.21,
  postFlange: 0.15,
  postTop: 1.2,
  postBottom: -1.6,
} as const

export const POST_BEHIND_RAIL = GUARDRAIL.railDepth + GUARDRAIL.railThickness + GUARDRAIL.blockout + GUARDRAIL.postDepth / 2

export function railDepthAt(h: number) {
  const half = GUARDRAIL.railHeight / 2
  return GUARDRAIL.railDepth * 0.5 * (1 + Math.cos((2 * Math.PI * h) / half))
}

export const pickVariant = (tint: number, count: number) => Math.min(count - 1, Math.max(0, Math.floor(tint * count)))
