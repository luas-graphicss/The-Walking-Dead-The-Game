import { Vector3 } from 'three'
import definitions from './surfaces.generated.json'
import resourceDefinitions from '../resources/surfaces.generated.json'
import { BLOCK_MATERIALS, type AssetSpec, type BlockModel, type BlockPart, type MaterialKey, type Vec3 } from './types'
import { partQuaternion } from './solid'
import { BRICK_TILE, WOOD_TILE } from './relief-geometry'

type Definition = { id: string; base: MaterialKey; family: string; owners: string[]; label: string; texture: string; tile: number; normalStrength: number; depth: number; source: string; seed: number }
export type WorkshopMaterial = (typeof BLOCK_MATERIALS)[MaterialKey] & { tileV: number; id?: string; base?: MaterialKey; owners?: string[]; depth?: number }

function metricTile(base: string, tile: number) {
  if (base === 'brick') return { tile: BRICK_TILE.u, tileV: BRICK_TILE.v }
  if (base === 'wood') return { tile: WOOD_TILE, tileV: WOOD_TILE }
  return { tile, tileV: tile }
}
export const WORKSHOP_SURFACES = (definitions as Definition[]).map((surface) => ({ ...BLOCK_MATERIALS[surface.base], ...surface, ...metricTile(surface.base, surface.tile), normalStrength: 1 }))
export const WORKSHOP_MATERIALS: Record<string, WorkshopMaterial> = Object.fromEntries([
  ...Object.entries(BLOCK_MATERIALS).map(([key, value]) => [key, { ...value, ...metricTile(key, value.tile) }] as const),
  ...WORKSHOP_SURFACES.map((surface) => [surface.id, surface] as const),
])
const byAsset = new Map(WORKSHOP_SURFACES.flatMap((surface) => surface.owners.map((id) => [id, surface] as const)))
const architectural = new Set(['foundation', 'floor', 'wall', 'roof', 'column', 'stairs'])

export const RESOURCE_SURFACES: WorkshopMaterial[] = (resourceDefinitions as Definition[]).map((surface) => ({ ...BLOCK_MATERIALS[surface.base], ...surface, tileV: surface.tile, normalStrength: 1 }))
const RESOURCE_MATERIALS: Record<string, WorkshopMaterial> = Object.fromEntries(RESOURCE_SURFACES.map((surface) => [surface.id!, surface]))
const byResource = new Map<string, Map<MaterialKey, WorkshopMaterial>>()
for (const surface of RESOURCE_SURFACES) for (const owner of surface.owners ?? []) {
  const sets = byResource.get(owner) ?? new Map<MaterialKey, WorkshopMaterial>()
  sets.set(surface.base!, surface)
  byResource.set(owner, sets)
}

export function assignSurfaces(model: BlockModel, asset: AssetSpec) {
  const surface = byAsset.get(asset.id)
  if (!surface) throw new Error(`Módulo sem acabamento próprio: ${asset.id}`)
  for (const part of model.parts) if (part.material === surface.base) part.surface = surface.id
}

export function isResourceSurface(id: string) {
  return id in RESOURCE_MATERIALS
}

export function assetSurface(id: string, material?: MaterialKey) {
  const own = material ? byResource.get(id)?.get(material) : undefined
  return own ?? byAsset.get(id)
}

export function surfaceFor(part: Pick<BlockPart, 'material' | 'surface'>) {
  const key = part.surface ?? part.material
  return WORKSHOP_MATERIALS[key] ?? RESOURCE_MATERIALS[key] ?? WORKSHOP_MATERIALS[part.material]
}

export function textureOrigin(part: BlockPart): Vec3 | undefined {
  if (part.uvOrigin) return part.uvOrigin
  if (!architectural.has(part.role)) return undefined
  return new Vector3(...part.position).applyQuaternion(partQuaternion(part).invert()).toArray()
}
