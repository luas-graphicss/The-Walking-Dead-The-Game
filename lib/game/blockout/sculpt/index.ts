import { BufferGeometry, Euler, Float32BufferAttribute, Matrix3, Matrix4, Quaternion, Uint32BufferAttribute, Vector3 } from 'three'
import { ASSET_BY_ID } from '../catalog'
import { assetSurface, isResourceSurface, surfaceFor } from '../surfaces'
import type { MaterialKey, Vec3 } from '../types'
import { Kit, type SculptBucket, type SculptLeaf, type Sculptor } from './kit'
import { SEATING } from './families/seating'
import { BEDS_TABLES } from './families/beds-tables'
import { STORAGE } from './families/storage'
import { APPLIANCES } from './families/appliances'
import { RESOURCES, STAIRS_FLOORS, UTILITY } from './families/utility'
import { SERVICES } from './families/special-services'
import { DEBRIS } from './families/debris'
import { RURAL } from './families/rural'
import { GARAGE } from './families/garage'
import { COMMERCE } from './families/commerce'
import { FOOD } from './families/food'
import { INFRA } from './families/infra'
import { ARCHITECTURE } from './families/architecture'
import { STRUCTURE } from './families/structure'
import { WALL_VARIANTS } from './families/wall-variants'
import { INTERIOR } from './families/interior'
import { RESOURCE_ASSET_BY_ID, RESOURCE_FAMILIES } from '../../resources/sculpts'

export type { Sculptor, SculptLeaf }

export const SCULPTORS: Record<string, Sculptor> = { ...SEATING, ...BEDS_TABLES, ...STORAGE, ...APPLIANCES, ...UTILITY, ...RESOURCES, ...STAIRS_FLOORS, ...SERVICES, ...DEBRIS, ...RURAL, ...GARAGE, ...COMMERCE, ...FOOD, ...INFRA, ...ARCHITECTURE, ...STRUCTURE, ...WALL_VARIANTS, ...INTERIOR, ...RESOURCE_FAMILIES }

const specOf = (id: string) => ASSET_BY_ID.get(id) ?? RESOURCE_ASSET_BY_ID.get(id)

export function hasSculpt(id: string) {
  const spec = specOf(id)
  return Boolean(spec && SCULPTORS[spec.family])
}

const cache = new Map<string, SculptBucket[]>()
const leafCache = new Map<string, SculptLeaf[]>()
export function sculptData(id: string): SculptBucket[] | null {
  const spec = specOf(id)
  const sculptor = spec && SCULPTORS[spec.family]
  if (!spec || !sculptor) return null
  let data = cache.get(id)
  if (!data) {
    const kit = new Kit(id, spec.size, spec.variant)
    sculptor(kit, spec)
    data = kit.finish()
    cache.set(id, data)
    leafCache.set(id, kit.leaves)
  }
  return data
}

export function sculptLeaves(id: string): SculptLeaf[] {
  if (!leafCache.has(id)) sculptData(id)
  return leafCache.get(id) ?? []
}

export type SculptPlacement = { asset: string; position?: Vec3; yaw?: number; pitch?: number; roll?: number; burned?: boolean; scale?: number }
export type SculptGroup = { material: MaterialKey; surface?: string; geometry: BufferGeometry }
const BURNABLE = new Set<MaterialKey>(['wood', 'fabric', 'paint', 'leather', 'straw', 'paper'])

function neutralColors(color: Float32Array) {
  const count = color.length / 3, lum = new Float32Array(count)
  for (let i = 0; i < count; i++) lum[i] = color[i * 3] * 0.3 + color[i * 3 + 1] * 0.59 + color[i * 3 + 2] * 0.11
  const sorted = Float32Array.from(lum).sort(), reference = Math.max(1e-3, sorted[Math.min(count - 1, Math.floor(count * 0.95))])
  const out = new Float32Array(color.length)
  for (let i = 0; i < count; i++) { const g = Math.min(1.05, 0.12 + 0.88 * lum[i] / reference); out[i * 3] = g; out[i * 3 + 1] = g; out[i * 3 + 2] = g }
  return out
}

export function sculptGroups(placements: SculptPlacement[], source: (id: string) => SculptBucket[] | null = sculptData): SculptGroup[] {
  const groups = new Map<string, { material: MaterialKey; surface?: string; chunks: { bucket: SculptBucket; matrix: Matrix4 | null; neutral: boolean }[] }>()
  for (const placement of placements) {
    const data = source(placement.asset)
    if (!data) continue
    const scale = placement.scale ?? 1
    const matrix = placement.position || placement.yaw || placement.pitch || placement.roll || scale !== 1 ? new Matrix4().compose(new Vector3(...(placement.position ?? [0, 0, 0])), new Quaternion().setFromEuler(new Euler(placement.pitch ?? 0, placement.yaw ?? 0, placement.roll ?? 0, 'YXZ')), new Vector3(scale, scale, scale)) : null
    for (const bucket of data) {
      const burned = Boolean(placement.burned && BURNABLE.has(bucket.material))
      const material: MaterialKey = burned ? 'charcoal' : bucket.material
      const owned = burned ? undefined : assetSurface(placement.asset, bucket.material)
      const surface = owned && owned.base === bucket.material ? owned.id : undefined
      const key = surface ?? material
      const group = groups.get(key) ?? { material, surface, chunks: [] }
      group.chunks.push({ bucket, matrix, neutral: Boolean(surface && isResourceSurface(surface)) })
      groups.set(key, group)
    }
  }
  const result: SculptGroup[] = []
  for (const { material, surface, chunks } of groups.values()) {
    const vertexCount = chunks.reduce((sum, c) => sum + c.bucket.position.length / 3, 0)
    const indexCount = chunks.reduce((sum, c) => sum + c.bucket.index.length, 0)
    const position = new Float32Array(vertexCount * 3), normal = new Float32Array(vertexCount * 3), uv = new Float32Array(vertexCount * 2), color = new Float32Array(vertexCount * 3), index = new Uint32Array(indexCount)
    const spec = surfaceFor({ material, surface }), tu = 1 / spec.tile, tv = 1 / spec.tileV
    const v = new Vector3(), nm = new Matrix3()
    let vo = 0, io = 0
    for (const { bucket, matrix, neutral } of chunks) {
      const count = bucket.position.length / 3
      if (matrix) nm.getNormalMatrix(matrix)
      for (let i = 0; i < count; i++) {
        v.fromArray(bucket.position, i * 3); if (matrix) v.applyMatrix4(matrix); v.toArray(position, (vo + i) * 3)
        v.fromArray(bucket.normal, i * 3); if (matrix) v.applyMatrix3(nm).normalize(); v.toArray(normal, (vo + i) * 3)
        uv[(vo + i) * 2] = bucket.uv[i * 2] * tu; uv[(vo + i) * 2 + 1] = bucket.uv[i * 2 + 1] * tv
      }
      color.set(neutral ? neutralColors(bucket.color) : bucket.color, vo * 3)
      for (let i = 0; i < bucket.index.length; i++) index[io + i] = bucket.index[i] + vo
      vo += count; io += bucket.index.length
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    geometry.setAttribute('color', new Float32BufferAttribute(color, 3))
    geometry.setIndex(new Uint32BufferAttribute(index, 1))
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    result.push({ material, surface, geometry })
  }
  return result
}
