import { Box3, BufferGeometry, Euler, Float32BufferAttribute, IcosahedronGeometry, Matrix4, Quaternion, Uint32BufferAttribute, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg'
import { fbm3, hashString, noise3, rand } from './sculpt/kit'
import { surfaceFor } from './surfaces'
import type { MaterialKey } from './types'

export type FractureGroup = { material: MaterialKey; surface?: string; geometry: BufferGeometry }
type Cut = { center: Vector3; radius: Vector3; rotation: Euler; seed: number; detail: number }

const HARD = new Set<MaterialKey>(['concrete', 'plaster', 'brick', 'wood', 'steel', 'tile', 'paint', 'charcoal', 'glass'])

const BRITTLE = new Set<MaterialKey>(['concrete', 'plaster', 'brick', 'wood', 'tile', 'charcoal', 'glass'])

function fractureVolume(cut: Cut, tileU: number, tileV: number, tone: number) {
  const geometry = new IcosahedronGeometry(1, cut.detail)
  const position = geometry.getAttribute('position')
  const s = cut.seed % 9973
  const facets = Array.from({ length: 5 }, (_, i) => {
    const a = rand(s, i, 1) * Math.PI * 2, b = (rand(s, i, 2) - 0.5) * 2.4
    return [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b), 0.6 + rand(s, i, 3) * 0.3] as const
  })
  const v = new Vector3()
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize()
    const r = 1 + (fbm3(v.x * 1.6 + s, v.y * 1.6, v.z * 1.6, s) - 0.5) * 0.75 + (noise3(v.x * 5.2, v.y * 5.2 + s, v.z * 5.2, s + 3) - 0.5) * 0.3 + (noise3(v.x * 12.5, v.y * 12.5, v.z * 12.5 + s, s + 5) - 0.5) * 0.12 + (noise3(v.x * 29, v.y * 29 + s, v.z * 29, s + 7) - 0.5) * (cut.detail >= 4 ? 0.06 : 0.03)
    v.multiplyScalar(Math.max(0.35, r))
    for (const [nx, ny, nz, c] of facets) {
      const e = v.x * nx + v.y * ny + v.z * nz - c
      if (e > 0) { v.x -= nx * e * 0.9; v.y -= ny * e * 0.9; v.z -= nz * e * 0.9 }
    }
    position.setXYZ(i, v.x, v.y, v.z)
  }
  geometry.applyMatrix4(new Matrix4().compose(cut.center, new Quaternion().setFromEuler(cut.rotation), cut.radius))
  geometry.deleteAttribute('uv')
  geometry.computeVertexNormals()
  dressBreakFaces(geometry, tileU, tileV, tone, s)
  return geometry
}

function dressBreakFaces(geometry: BufferGeometry, tileU: number, tileV: number, tone: number, seed: number) {
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal')
  const uv = new Float32Array(position.count * 2), color = new Float32Array(position.count * 3)
  for (let t = 0; t < position.count; t += 3) {
    const nx = Math.abs(normal.getX(t)), ny = Math.abs(normal.getY(t)), nz = Math.abs(normal.getZ(t))
    for (let k = t; k < t + 3; k++) {
      const x = position.getX(k), y = position.getY(k), z = position.getZ(k)
      const [u, w] = nx >= ny && nx >= nz ? [z, y] : ny >= nz ? [x, z] : [x, y]
      uv[k * 2] = u / tileU; uv[k * 2 + 1] = w / tileV
      const shade = tone * (0.86 + noise3(x * 14, y * 14, z * 14, seed + 11) * 0.22)
      color[k * 3] = shade; color[k * 3 + 1] = shade * 0.97; color[k * 3 + 2] = shade * 0.92
    }
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(color, 3))
}

function planCuts(box: Box3, seed: number): Cut[] {
  const size = box.getSize(new Vector3()), mid = box.getCenter(new Vector3())
  const r = (i: number) => rand(seed, i, 77)
  const rot = (i: number) => new Euler(r(i) * 6.28, r(i + 1) * 6.28, r(i + 2) * 6.28)
  const minR = 0.035
  const clampR = (v: Vector3) => v.set(Math.max(minR, v.x), Math.max(minR, v.y), Math.max(minR, v.z))
  const thinX = size.x < size.z, thin = Math.min(size.x, size.z), wide = Math.max(size.x, size.z)
  const panel = thin < wide * 0.3 && size.y > thin * 2.2
  const side = r(1) < 0.5 ? -1 : 1, depthSide = r(2) < 0.5 ? -1 : 1
  const cuts: Cut[] = []
  const detail = Math.max(size.x, size.y, size.z) > 1.2 ? 5 : 4
  if (panel) {
    const at = (alongWide: number, y: number, rWide: number, rY: number) => {
      const center = thinX ? new Vector3(mid.x, y, mid.z + alongWide) : new Vector3(mid.x + alongWide, y, mid.z)
      const radius = thinX ? new Vector3(thin * 2.2 + 0.08, rY, rWide) : new Vector3(rWide, rY, thin * 2.2 + 0.08)
      return { center, radius: clampR(radius) }
    }

    cuts.push({ ...at(side * wide * 0.5, box.max.y - size.y * 0.08, wide * (0.26 + r(3) * 0.14), size.y * (0.3 + r(4) * 0.2)), rotation: new Euler(0, 0, (r(5) - 0.5) * 0.8), seed: seed + 1, detail })
    if (wide > 0.5 && size.y > 0.5) cuts.push({ ...at(-side * wide * (0.1 + r(6) * 0.16), box.min.y + size.y * (0.42 + r(7) * 0.22), wide * (0.08 + r(8) * 0.06), size.y * (0.09 + r(9) * 0.07)), rotation: rot(10), seed: seed + 2, detail: 3 })
    cuts.push({ ...at(-side * wide * 0.5, box.min.y + size.y * 0.06, wide * (0.08 + r(13) * 0.06), size.y * (0.07 + r(14) * 0.05)), rotation: rot(15), seed: seed + 3, detail: 3 })
  } else {
    const corner = new Vector3(mid.x + side * size.x / 2, box.max.y, mid.z + depthSide * size.z / 2)
    cuts.push({ center: corner.clone().add(new Vector3(-side * size.x * 0.04, -size.y * 0.04, -depthSide * size.z * 0.04)), radius: clampR(new Vector3(size.x * (0.3 + r(3) * 0.14), size.y * (0.32 + r(4) * 0.18), size.z * (0.3 + r(5) * 0.14))), rotation: rot(6), seed: seed + 1, detail })
    cuts.push({ center: new Vector3(mid.x - side * size.x / 2, box.min.y + size.y * (0.3 + r(9) * 0.35), mid.z + depthSide * size.z / 2), radius: clampR(new Vector3(size.x * (0.13 + r(10) * 0.08), size.y * (0.12 + r(11) * 0.08), size.z * (0.13 + r(12) * 0.08))), rotation: rot(13), seed: seed + 2, detail: 3 })
    if (Math.max(size.x, size.z) > 0.7) cuts.push({ center: new Vector3(mid.x + side * size.x * (r(16) - 0.5) * 0.6, box.max.y, mid.z - depthSide * size.z / 2), radius: clampR(new Vector3(size.x * 0.1, size.y * 0.1, size.z * 0.12)), rotation: rot(17), seed: seed + 3, detail: 3 })
  }
  return cuts
}

function ensureIndexed(geometry: BufferGeometry) {
  if (!geometry.getIndex()) geometry.setIndex(new Uint32BufferAttribute(Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i), 1))
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

function plainCopy(geometry: BufferGeometry) {
  const copy = new BufferGeometry()
  for (const name of ['position', 'normal', 'uv', 'color']) copy.setAttribute(name, geometry.getAttribute(name).clone())
  if (geometry.getIndex()) copy.setIndex(geometry.getIndex()!.clone())
  return copy
}

const cache = new Map<string, FractureGroup[]>()

export function fractureGroups(id: string, groups: FractureGroup[], seed: number): FractureGroup[] {
  const key = `${id}:${seed}`
  const cached = cache.get(key)
  if (cached) return cached.map((group) => ({ ...group, geometry: group.geometry.clone() }))
  const box = new Box3()
  for (const group of groups) { group.geometry.computeBoundingBox(); box.union(group.geometry.boundingBox!) }
  const size = box.getSize(new Vector3())
  const base = hashString(`${id}:${seed}`)
  const cuts = planCuts(box, base)
  const evaluator = new Evaluator()
  evaluator.attributes = ['position', 'normal', 'uv', 'color', 'gid']
  evaluator.useGroups = false
  const hardest = groups.reduce((best, group, i) => {
    const score = group.geometry.getAttribute('position').count * (HARD.has(group.material) ? 4 : 1)
    return score > best.score ? { i, score } : best
  }, { i: 0, score: -1 }).i
  const hardSpec = surfaceFor(groups[hardest])

  const whole = mergeGeometries(groups.map((group, i) => tagged(group.geometry, i)), false)
  if (!whole) return groups
  const original = new Brush(whole)
  original.updateMatrixWorld()
  let current = original
  let chunk: BufferGeometry | null = null
  for (const [ci, cut] of cuts.entries()) {
    const volume = tagged(fractureVolume(cut, hardSpec.tile, hardSpec.tileV, 0.6), hardest)
    const brush = new Brush(volume)
    brush.updateMatrixWorld()
    if (ci === 0) {
      const piece = evaluator.evaluate(original, brush, INTERSECTION)
      if (piece.geometry.getAttribute('position').count) chunk = piece.geometry
    }
    const next = evaluator.evaluate(current, brush, SUBTRACTION)
    if (current !== original) current.geometry.dispose()
    current = next
    volume.dispose()
  }

  if (chunk) {
    chunk.computeBoundingBox()
    const center = chunk.boundingBox!.getCenter(new Vector3())
    const tip = new Euler((rand(base, 41) < 0.5 ? -1 : 1) * (0.9 + rand(base, 42) * 0.7), rand(base, 43) * 6.28, (rand(base, 44) - 0.5) * 0.6)
    const spin = new Matrix4().makeRotationFromEuler(tip).multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z))
    chunk.applyMatrix4(spin)
    chunk.computeBoundingBox()
    const turned = chunk.boundingBox!, half = turned.getSize(new Vector3()).multiplyScalar(0.5)
    const cut = cuts[0].center
    const out = new Vector3(cut.x - (box.min.x + box.max.x) / 2, 0, cut.z - (box.min.z + box.max.z) / 2)
    if (out.lengthSq() < 1e-6) out.set(1, 0, 0)
    out.normalize()
    const reach = Math.abs(out.x) * (size.x / 2 + half.x) + Math.abs(out.z) * (size.z / 2 + half.z) + 0.06
    chunk.applyMatrix4(new Matrix4().makeTranslation((box.min.x + box.max.x) / 2 + out.x * reach, box.min.y - turned.min.y - 0.004, (box.min.z + box.max.z) / 2 + out.z * reach))
  }

  const extent = Math.max(0.12, Math.min(size.x, size.z) * 0.5)
  const chips: BufferGeometry[] = []
  const chipCount = BRITTLE.has(groups[hardest].material) ? 6 + Math.floor(rand(base, 60) * 6) : 0
  for (let i = 0; i < chipCount; i++) {
    const rr = Math.max(0.012, Math.min(0.09, Math.max(size.x, size.y, size.z) * (0.025 + rand(base, i, 61) * 0.04)))
    const angle = rand(base, i, 62) * Math.PI * 2, dist = extent * (0.7 + rand(base, i, 63) * 0.9)
    const cut = cuts[0].center
    const cx = cut.x + Math.cos(angle) * dist * 0.6, cz = cut.z + Math.sin(angle) * dist * 0.6
    chips.push(tagged(fractureVolume({ center: new Vector3(cx, box.min.y + rr * 0.45, cz), radius: new Vector3(rr * (0.8 + rand(base, i, 64) * 0.6), rr * (0.45 + rand(base, i, 65) * 0.3), rr * (0.8 + rand(base, i, 66) * 0.6)), rotation: new Euler(0, rand(base, i, 67) * 6.28, 0), seed: base + 100 + i, detail: 1 }, hardSpec.tile, hardSpec.tileV, 0.62), hardest))
  }

  const split = splitByGroup([current.geometry, ...(chunk ? [chunk] : []), ...chips], groups.length)
  if (current !== original) current.geometry.dispose()
  original.geometry.dispose()
  chunk?.dispose(); chips.forEach((chip) => chip.dispose())
  const final = groups.map((group, i) => ({ ...group, geometry: ensureIndexed(split[i]) })).filter((group) => group.geometry.getAttribute('position').count > 0)
  cache.set(key, final.map((group) => ({ ...group, geometry: group.geometry.clone() })))
  if (cache.size > 12) cache.delete(cache.keys().next().value!)
  return final
}

function tagged(geometry: BufferGeometry, gid: number) {
  const copy = plainCopy(geometry)
  copy.setAttribute('gid', new Float32BufferAttribute(new Float32Array(copy.getAttribute('position').count).fill(gid), 1))
  return copy
}

function splitByGroup(sources: BufferGeometry[], count: number) {
  const buckets = Array.from({ length: count }, () => ({ position: [] as number[], normal: [] as number[], uv: [] as number[], color: [] as number[] }))
  for (const source of sources) {
    const position = source.getAttribute('position'), normal = source.getAttribute('normal'), uv = source.getAttribute('uv'), color = source.getAttribute('color'), gid = source.getAttribute('gid'), index = source.getIndex()
    const total = index ? index.count : position.count
    for (let t = 0; t < total; t += 3) {
      const first = index ? index.getX(t) : t
      const bucket = buckets[Math.max(0, Math.min(count - 1, Math.round(gid.getX(first))))]
      for (let k = 0; k < 3; k++) {
        const v = index ? index.getX(t + k) : t + k
        bucket.position.push(position.getX(v), position.getY(v), position.getZ(v))
        bucket.normal.push(normal.getX(v), normal.getY(v), normal.getZ(v))
        bucket.uv.push(uv.getX(v), uv.getY(v))
        bucket.color.push(color.getX(v), color.getY(v), color.getZ(v))
      }
    }
  }
  return buckets.map((bucket) => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(bucket.position, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(bucket.normal, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(bucket.uv, 2))
    geometry.setAttribute('color', new Float32BufferAttribute(bucket.color, 3))
    return geometry
  })
}
