import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BOULDERS, DEBRIS, KIT_MATERIALS, LEAVES, LOGS, PEBBLES, RUNTIME_SETS, STUMPS, TILE, TWIGS, UPROOTED_LOG } from '../lib/game/assets/catalog'
import { type BakeItem, bakeStones } from './assets/bake'
import { type GlbMaterial, type GlbNode, writeGlb } from './assets/glb'
import { type Model, type Report, computeNormals, validate } from './assets/mesh'
import { type StoneChart, type StoneShape, fallenLog, guardrailPost, leaf, stone, stump, twig, uprootedLog } from './assets/models'
import { type EncodedPbr, type Pbr, SPECS, buildLeafAtlas, buildSet, encodeSet, writeSet } from './assets/textures'

const root = process.cwd()
const sources = path.join(root, 'assets-src', 'textures')
const publicDir = path.join(root, 'public')

const BOULDER_SHAPES: (StoneShape & { moss: number })[] = [
  { cuts: 3, cutDepth: [0.82, 0.95], roundness: 0.18, lumpy: 0.07, detail: 0.02, moss: 0.85 },
  { cuts: 4, cutDepth: [0.78, 0.9], roundness: 0.1, lumpy: 0.05, detail: 0.02, moss: 0.6 },
  { cuts: 6, cutDepth: [0.74, 0.88], roundness: 0.08, lumpy: 0.04, detail: 0.02, moss: 0.5 },
  { cuts: 5, cutDepth: [0.7, 0.9], roundness: 0.1, lumpy: 0.06, detail: 0.025, moss: 0.9 },
]
const PEBBLE_SHAPES: StoneShape[] = [
  { cuts: 0, cutDepth: [1, 1], roundness: 0.2, lumpy: 0.05, detail: 0.01 },
  { cuts: 5, cutDepth: [0.72, 0.88], roundness: 0.07, lumpy: 0.04, detail: 0.01 },
  { cuts: 2, cutDepth: [0.85, 0.95], roundness: 0.15, lumpy: 0.04, detail: 0.01 },
]
const DEBRIS_SHAPES: StoneShape[] = [
  { cuts: 5, cutDepth: [0.7, 0.86], roundness: 0.04, lumpy: 0.03, detail: 0.01, top: 0.78 },
  { cuts: 6, cutDepth: [0.68, 0.84], roundness: 0.04, lumpy: 0.03, detail: 0.01, top: 0.8 },
]

function cells(row: number, size: number, offsetX = 0, offsetY = 0) {
  return Array.from({ length: 6 }, (_, f) => ({ x: offsetX + f * size, y: offsetY + row * size, size }))
}

async function main() {
  const started = performance.now()
  const sets: Record<string, Pbr> = {}
  const encoded: Record<string, EncodedPbr> = {}
  for (const [name, spec] of Object.entries(SPECS)) {
    const t0 = performance.now()
    sets[name] = await buildSet(sources, spec)

    if ((RUNTIME_SETS as readonly string[]).includes(name)) {
      encoded[name] = await encodeSet(sets[name])
      await writeSet(path.join(publicDir, 'textures', name), encoded[name])
    }
    console.log(`textura ${name.padEnd(16)} ${((performance.now() - t0) / 1000).toFixed(1)} s`)
  }
  const leaves = await buildLeafAtlas(sources)
  encoded.leaves = await encodeSet(leaves.set)
  await writeSet(path.join(publicDir, 'textures', 'leaves'), encoded.leaves)

  const forestStones: { model: Model; charts: StoneChart[]; bake: Omit<BakeItem, 'model' | 'charts'> }[] = []
  const FOREST_ATLAS = { width: 1536, height: 1088 }
  BOULDERS.forEach((spec, i) => {
    const shape = BOULDER_SHAPES[i]
    const { model, charts } = stone(spec.name, spec, 0x1000 + i * 977, 10, shape, 'rock', { ...FOREST_ATLAS, cells: cells(i, 256), gutter: 4 })
    forestStones.push({ model, charts, bake: { material: 'rock', tall: spec.tall, size: 1.3, moss: shape.moss, rock: { set: sets.rock, tile: TILE.rock }, mossSource: { set: sets.moss, tile: TILE.moss } } })
  })
  PEBBLES.forEach((spec, i) => {
    const { model, charts } = stone(spec.name, spec, 0x2000 + i * 613, 3, PEBBLE_SHAPES[i], 'rock', { ...FOREST_ATLAS, cells: cells(0, 64, i * 6 * 64, 1024), gutter: 2 })
    forestStones.push({ model, charts, bake: { material: 'rock', tall: spec.tall, size: 0.16, moss: 0, rock: { set: sets.rock, tile: TILE.rock / 4 } } })
  })
  const wood: Model[] = [
    ...LOGS.map((spec, i) => (i === UPROOTED_LOG ? uprootedLog(spec, 0x3000 + i) : fallenLog(spec, 0x3000 + i * 131))),
    ...STUMPS.map((spec, i) => stump(spec, 0x4000 + i * 71, i === 1)),
    ...TWIGS.map((spec, i) => twig(spec, 0x5000 + i * 37, (['straight', 'bent', 'forked'] as const)[i])),
  ]
  const leafModels = LEAVES.map((spec, i) => {
    const rect = leaves.rects[i]
    const aspect = ((rect.u1 - rect.u0) * leaves.set.albedo.w) / ((rect.v1 - rect.v0) * leaves.set.albedo.h)
    return leaf(spec, rect, 0x6000 + i * 29, aspect)
  })
  const roadDebris: { model: Model; charts: StoneChart[]; bake: Omit<BakeItem, 'model' | 'charts'> }[] = []
  const ROAD_ATLAS = { width: 768, height: 256 }
  DEBRIS.forEach((spec, i) => {
    const { model, charts } = stone(spec.name, spec, 0x7000 + i * 401, 4, DEBRIS_SHAPES[i], 'asphalt_debris', { ...ROAD_ATLAS, cells: cells(i, 128), gutter: 3 })
    roadDebris.push({ model, charts, bake: { material: 'asphalt_debris', tall: spec.tall, size: 0.3, moss: 0, rock: { set: sets['asphalt-cracked'], tile: TILE.asphalt / 4 } } })
  })
  const post = guardrailPost()
  const all = [...forestStones.map((s) => s.model), ...wood, ...leafModels, ...roadDebris.map((s) => s.model), post]
  for (const model of all) computeNormals(model)

  const reports: Report[] = all.map(validate)
  let failed = 0
  console.log('\nmodelo                 vértices  triângulos  tamanho (m)              problemas')
  for (const r of reports) {
    if (r.issues.length) failed++
    console.log(`${r.name.padEnd(22)} ${String(r.vertices).padStart(8)}  ${String(r.triangles).padStart(10)}  ${r.size.map((v) => v.toFixed(2)).join(' × ').padEnd(24)} ${r.issues.length ? r.issues.join('; ') : 'ok'}`)
  }

  const forestAtlas = bakeStones(forestStones.map((s) => ({ model: s.model, charts: s.charts, ...s.bake })), FOREST_ATLAS.width, FOREST_ATLAS.height, 4)
  const roadAtlas = bakeStones(roadDebris.map((s) => ({ model: s.model, charts: s.charts, ...s.bake })), ROAD_ATLAS.width, ROAD_ATLAS.height, 3)
  const encodeAtlas = (atlas: { albedo: typeof forestAtlas.albedo; normal: typeof forestAtlas.normal; orm: typeof forestAtlas.orm }): Promise<EncodedPbr> => encodeSet(atlas)

  await writeSet(path.join(publicDir, 'textures', KIT_MATERIALS.rock), await encodeAtlas(forestAtlas))
  await writeSet(path.join(publicDir, 'textures', KIT_MATERIALS.asphalt_debris), await encodeAtlas(roadAtlas))
  const kit = (entries: [string, Partial<GlbMaterial>][]) => {
    const materials: GlbMaterial[] = [], index = new Map<string, number>()
    for (const [name, extra] of entries) {
      index.set(name, materials.length)
      materials.push({ name, ...extra })
    }
    return { materials, index }
  }
  const layout = (models: Model[], z: number, spacing: number): GlbNode[] => models.map((model, i) => ({ model, translation: [i * spacing, 0, z] }))
  await mkdir(path.join(publicDir, 'models'), { recursive: true })
  const forest = kit([['rock', {}], ['bark', {}], ['endgrain', {}], ['deadwood', {}], ['soil', {}], ['leaves', { alphaCutoff: 0.5, doubleSided: true }]])
  const forestNodes = [
    ...layout(forestStones.slice(0, BOULDERS.length).map((s) => s.model), 0, 3),
    ...layout(forestStones.slice(BOULDERS.length).map((s) => s.model), 3, 0.6),
    ...wood.map((model, i) => ({ model, translation: [0, 0, 6 + i * 1.6] as [number, number, number] })),
    ...layout(leafModels, 26, 0.3),
  ]
  const forestGlb = writeGlb(forestNodes, forest.materials, [], forest.index)
  await writeFile(path.join(publicDir, 'models', 'forest-floor.glb'), forestGlb)
  const road = kit([['steel', { metallic: 1 }], ['asphalt_debris', {}]])
  const roadGlb = writeGlb([{ model: post, translation: [0, 0, 0] }, ...layout(roadDebris.map((s) => s.model), 2, 0.8)], road.materials, [], road.index)
  await writeFile(path.join(publicDir, 'models', 'road-kit.glb'), roadGlb)
  console.log(`\nforest-floor.glb ${(forestGlb.length / 1048576).toFixed(2)} MB · road-kit.glb ${(roadGlb.length / 1048576).toFixed(2)} MB · ${((performance.now() - started) / 1000).toFixed(1)} s`)
  if (failed) {
    console.error(`\n${failed} modelo(s) reprovado(s) na validação.`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
