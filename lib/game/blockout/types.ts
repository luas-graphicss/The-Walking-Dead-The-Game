export type Vec3 = [number, number, number]
export type MaterialKey = 'concrete' | 'plaster' | 'brick' | 'wood' | 'steel' | 'tile' | 'fabric' | 'paint' | 'charcoal' | 'rubber' | 'leather' | 'straw' | 'paper' | 'glass'
export type PartRole = 'foundation' | 'floor' | 'wall' | 'column' | 'roof' | 'stairs' | 'fixture' | 'debris' | 'resource'
export type Category = 'Arquitetura' | 'Mobiliário' | 'Comércio' | 'Serviços' | 'Infraestrutura' | 'Rural' | 'Destroços' | 'Recursos'
export type Condition = 'weathered' | 'damaged' | 'burned' | 'ruined' | 'leveled'
export type LootKind = 'salvage' | 'food' | 'medical' | 'weapons' | 'tools' | 'textiles' | 'electronics' | 'agriculture' | 'documents'
export type Context = 'bairro' | 'cidade-pequena' | 'rural' | 'urbano' | 'base'

export type BlockPart = {
  id: string
  position: Vec3
  size: Vec3
  yaw: number
  pitch?: number
  roll?: number
  primitive?: 'box' | 'cylinder' | 'cone' | 'prism' | 'hull'

  hull?: { vertices: Vec3[]; faces: number[][] }

  tint?: Vec3

  relief?: { kind: 'siding' | 'battens' | 'flat'; side: 1 | -1 }

  coarse?: boolean
  bevel?: number
  radialSegments?: number
  detail?: boolean
  support?: string
  profile?: [number, number][]
  material: MaterialKey
  surface?: string
  uvOrigin?: Vec3
  role: PartRole
  level: number

  damage?: Damage

  finishes?: FaceFinish[]
}

export type FaceFinish = { axis: Vec3; material?: MaterialKey; surface?: string; tint?: Vec3 }

export type WeatherProfile = { grime: number; dust: number; soot: number; moss: number; rust: number; splash: number; streak: number; damp: number; fade: number; salt: number; oil: number; tint: Vec3; scale: number; seed: Vec3 }

export type Crown = { seed: number; low: number; high: number; stepped?: boolean; grain?: boolean; peaks?: [number, number][]; peak?: number }

export type Hole = { x: number; y: number; rx: number; ry: number; seed: number; sill?: number; shards?: boolean; flare?: [number, number] }

export type Crack = { points: [number, number][]; width: number; depth: number; side: 1 | -1 | 0; seed: number; taper?: [number, number]; shift?: [number, number] }

export type Spall = { x: number; y: number; rx: number; ry: number; depth: number; side: 1 | -1; seed: number; skin?: boolean }

export type Damage = {
  plane?: 'xy' | 'xz'
  core: MaterialKey
  coreTint?: Vec3
  skin?: { material: MaterialKey; tint?: Vec3 }
  crown?: Crown
  holes?: Hole[]
  cracks?: Crack[]
  spalls?: Spall[]
}

export type LootSocket = {
  id: string
  position: Vec3
  support: string
  kind: LootKind
  concealed: boolean
  label: string

  container?: string

  prop?: string
}

export type SnapSocket = { id: string; position: Vec3; normal: Vec3; type: 'edge' | 'top' | 'base' }
export type Bounds = { min: Vec3; max: Vec3; size: Vec3 }
export type BlockModel = {
  id: string
  label: string
  parts: BlockPart[]
  sockets: LootSocket[]
  snaps: SnapSocket[]
}

export type Recipe = 'specialty' | 'interior' | 'shelf' | 'cabinet' | 'counter' | 'table' | 'chair' | 'bench' | 'sofa' | 'bed' | 'bunk' | 'appliance' | 'sink' | 'toilet' | 'tub' | 'rack' | 'machine' | 'crate' | 'pallet' | 'tank' | 'fence' | 'board' | 'wall' | 'doorway' | 'window' | 'broken-wall' | 'slab' | 'pillar' | 'stairs' | 'debris' | 'resource'
export type AssetSpec = {
  id: string
  family: string
  label: string
  category: Category
  recipe: Recipe
  size: Vec3
  material: MaterialKey
  variant: number
  loot?: LootKind
  concealed?: boolean
}

export type Layout = 'compact' | 'long' | 'l-shaped' | 'courtyard' | 'hall' | 't-shaped' | 'tower' | 'compound'
export type Blueprint = {
  id: string
  label: string
  category: 'Residências' | 'Comércios' | 'Serviços públicos' | 'Fazendas' | 'Estruturas raras'
  layout: Layout
  context: Context
  equipment: string[]
  loot: LootKind
  floors: number
  rarity: 'comum' | 'incomum' | 'rara'
}

export type WalkRoute = { id: string; from: Vec3; to: Vec3 }
export type Room = { id: string; label: string; center: Vec3; level: number; kind?: string }

export type Instance = { asset: string; position: Vec3; yaw: number; level: number; prefix?: string; burned?: boolean; pitch?: number; roll?: number; scale?: number }
export type StructureModel = BlockModel & {
  blueprint: string
  seed: number
  condition: Condition
  floors: number
  context: Context
  rooms: Room[]
  routes: WalkRoute[]
  instances: Instance[]

  decor?: Instance[]
  entrance: Vec3
  weather?: WeatherProfile
}

export const BLOCKOUT_VERSION = '4.1.0'
export const MODULE_TRIANGLE_BUDGET = 96000
export const GRID = 6
export const FLOOR_HEIGHT = 3.2
export const FOUNDATION_HEIGHT = 0.24
export const CONDITIONS: { value: Condition; label: string; description: string }[] = [
  { value: 'weathered', label: 'Abandonada', description: 'Volume preservado, telhado completo e equipamentos desativados, com materiais desgastados e ferragens expostas.' },
  { value: 'damaged', label: 'Parcialmente destruída', description: 'Dano localizado, brechas nas paredes e painéis de cobertura ausentes, com estrutura de apoio exposta.' },
  { value: 'burned', label: 'Incendiada', description: 'Perda de cobertura em uma zona de incêndio, estrutura carbonizada e equipamentos sobreviventes.' },
  { value: 'ruined', label: 'Em ruínas', description: 'Colapso extenso, empenas incompletas, paredes fraturadas e destroços junto à área destruída.' },
  { value: 'leveled', label: 'Arrasada', description: 'Fundação, fragmentos e recursos recuperáveis entre escombros.' },
]

const stone = '#b3ae9c', light = '#ebe6d6', dark = '#484c42', timber = '#8a7960', accent = '#d6b04c'
type PbrMaterial = { label: string; color: string; texture: string; roughness: number; metalness: number; tile: number; normalStrength: number }
const pbr = (key: string, label: string, color: string, tile: number, normalStrength: number, metalness = 0): PbrMaterial => ({ label, color, texture: `/textures/workshop/${key}`, roughness: 1, metalness, tile, normalStrength })
export const BLOCK_MATERIALS: Record<MaterialKey, PbrMaterial> = {
  concrete: pbr('concrete', 'Concreto poroso', stone, 1.5, 0.75),
  plaster: pbr('plaster', 'Reboco descascado', light, 1.5, 0.55),
  brick: pbr('brick', 'Alvenaria envelhecida', timber, 0.96, 0.9),
  wood: pbr('wood', 'Madeira de demolição', timber, 0.64, 0.6),
  steel: pbr('steel', 'Aço escovado e oxidado', stone, 0.5, 0.35, 1),
  tile: pbr('tile', 'Porcelana craquelada', light, 0.6, 0.25),
  fabric: pbr('fabric', 'Linho de estofamento', stone, 0.3, 0.55),
  paint: pbr('paint', 'Aço com pintura desgastada', accent, 0.7, 0.4, 1),
  charcoal: pbr('charcoal', 'Madeira carbonizada', dark, 0.65, 0.8),
  rubber: pbr('rubber', 'Borracha vulcanizada', dark, 0.35, 0.4),
  leather: pbr('leather', 'Couro sintético envelhecido', dark, 0.4, 0.45),
  straw: pbr('straw', 'Palha prensada', timber, 0.65, 0.85),
  paper: pbr('paper', 'Papel e embalagens', light, 0.3, 0.25),
  glass: pbr('glass', 'Vidro fumê empoeirado', dark, 0.6, 0.15),
}

export function random(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hash(text: string) {
  let result = 2166136261
  for (let i = 0; i < text.length; i++) result = Math.imul(result ^ text.charCodeAt(i), 16777619)
  return result >>> 0
}

export function partBounds(part: BlockPart): Bounds {
  const cy = Math.cos(part.yaw), sy = Math.sin(part.yaw), cp = Math.cos(part.pitch ?? 0), sp = Math.sin(part.pitch ?? 0), cr = Math.cos(part.roll ?? 0), sr = Math.sin(part.roll ?? 0)
  const [w, h, d] = part.size
  const size: Vec3 = [
    Math.abs(cy * cr + sy * sp * sr) * w + Math.abs(-cy * sr + sy * sp * cr) * h + Math.abs(sy * cp) * d,
    Math.abs(cp * sr) * w + Math.abs(cp * cr) * h + Math.abs(sp) * d,
    Math.abs(-sy * cr + cy * sp * sr) * w + Math.abs(sy * sr + cy * sp * cr) * h + Math.abs(cy * cp) * d,
  ]
  return { min: part.position.map((v, i) => v - size[i] / 2) as Vec3, max: part.position.map((v, i) => v + size[i] / 2) as Vec3, size }
}

export function modelBounds(model: BlockModel): Bounds {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const part of model.parts) {
    const bounds = partBounds(part)
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], bounds.min[i]); max[i] = Math.max(max[i], bounds.max[i]) }
  }
  return { min, max, size: max.map((v, i) => v - min[i]) as Vec3 }
}

export function transformPoint(point: Vec3, position: Vec3, yaw = 0): Vec3 {
  const c = Math.cos(yaw), s = Math.sin(yaw)
  return [position[0] + c * point[0] + s * point[2], position[1] + point[1], position[2] - s * point[0] + c * point[2]]
}
