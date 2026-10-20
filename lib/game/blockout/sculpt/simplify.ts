import { MeshoptSimplifier } from 'meshoptimizer'
import type { SculptBucket } from './kit'
import { sculptData } from '.'

export const simplifierReady = MeshoptSimplifier.ready

const cache = new Map<string, SculptBucket[] | null>()

export function simplifiedSculpt(id: string, error: number, budget = Infinity): SculptBucket[] | null {
  const key = `${id}@${error}/${budget}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const data = sculptData(id)
  let result: SculptBucket[] | null = null
  if (data) for (const scale of [1, 2.5, 6]) {
    result = data.map((bucket) => compact(bucket, MeshoptSimplifier.simplify(bucket.index, bucket.position, 3, 0, error * scale, ['ErrorAbsolute', 'Prune'])[0])).filter((bucket) => bucket.index.length > 0)
    if (result.reduce((sum, bucket) => sum + bucket.index.length / 3, 0) <= budget) break
  }
  cache.set(key, result)
  return result
}

function compact(bucket: SculptBucket, index: Uint32Array): SculptBucket {
  const remap = new Int32Array(bucket.position.length / 3).fill(-1)
  let count = 0
  for (let i = 0; i < index.length; i++) if (remap[index[i]] < 0) remap[index[i]] = count++
  const position = new Float32Array(count * 3), normal = new Float32Array(count * 3), uv = new Float32Array(count * 2), color = new Float32Array(count * 3)
  for (let v = 0; v < remap.length; v++) {
    const n = remap[v]
    if (n < 0) continue
    position.set(bucket.position.subarray(v * 3, v * 3 + 3), n * 3)
    normal.set(bucket.normal.subarray(v * 3, v * 3 + 3), n * 3)
    color.set(bucket.color.subarray(v * 3, v * 3 + 3), n * 3)
    uv.set(bucket.uv.subarray(v * 2, v * 2 + 2), n * 2)
  }
  const remapped = new Uint32Array(index.length)
  for (let i = 0; i < index.length; i++) remapped[i] = remap[index[i]]
  return { material: bucket.material, position, normal, uv, color, index: remapped, ...(bucket.leaf ? { leaf: bucket.leaf } : {}) }
}
