import type { Family, Kit } from '../../blockout/sculpt/kit'
import type { AssetSpec } from '../../blockout/types'
import { RESOURCES } from '../catalog'
import type { Resource } from '../types'
import { ARMORY } from './armory'
import { CHEMICALS } from './chemical'
import { CONSTRUCTION } from './construction'
import { ELECTRIC } from './electric'
import { FOOD } from './food'
import { FARMING } from './farming'
import { SALVAGE } from './salvage'
import type { ResourceFamily } from './forms'
import { FUELS } from './fuel'
import { HYGIENE } from './hygiene'
import { MEDICAL } from './medical'
import { METALS } from './metal'
import { PLASTICS } from './plastic'
import { POWER_TOOLS } from './power-tools'
import { REFINED } from './refined'
import { TOOLS } from './tools'
import { TEXTILES } from './textiles'
import { UTILITY } from './utility'
import { WEAPONS } from './weapons'

export type { ResourceFamily, ResourceSculptor } from './forms'

export const RESOURCE_SCULPTORS: ResourceFamily = { ...METALS, ...CONSTRUCTION, ...PLASTICS, ...CHEMICALS, ...FUELS, ...ELECTRIC, ...MEDICAL, ...HYGIENE, ...FOOD, ...WEAPONS, ...ARMORY, ...UTILITY, ...TOOLS, ...POWER_TOOLS, ...TEXTILES, ...FARMING, ...SALVAGE, ...REFINED }

export const RESOURCE_ASSET_PREFIX = 'resource-'
export const resourceAssetId = (id: string) => `${RESOURCE_ASSET_PREFIX}${id}`

export const RESOURCE_ASSETS: AssetSpec[] = RESOURCES.flatMap((resource) => resource.model.status === 'pronto' || !RESOURCE_SCULPTORS[resource.id] ? [] : [{
  id: resourceAssetId(resource.id), family: resourceAssetId(resource.id), label: resource.label, category: 'Recursos' as const, recipe: 'resource' as const,
  size: resource.model.size, material: resource.model.material, variant: 0,
}])
export const RESOURCE_ASSET_BY_ID = new Map(RESOURCE_ASSETS.map((asset) => [asset.id, asset]))

const byId = new Map<string, Resource>(RESOURCES.map((resource) => [resource.id, resource]))

export const RESOURCE_FAMILIES: Family = Object.fromEntries(RESOURCE_ASSETS.map((asset) => {
  const resource = byId.get(asset.id.slice(RESOURCE_ASSET_PREFIX.length))!
  return [asset.family, (k: Kit) => RESOURCE_SCULPTORS[resource.id](k, resource)]
}))

export function isSculptedResource(id: string) {
  return RESOURCE_ASSET_BY_ID.has(resourceAssetId(id))
}
