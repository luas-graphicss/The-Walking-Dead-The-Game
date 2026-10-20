import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GRASSES, TREES, type TreeSpec } from '../lib/game/assets/catalog'
import { tree, grass, bendCrown, bendNormals } from './assets/vegetation'
import { finishVegetation } from './assets/finish-vegetation'
import { validate, type Model } from './assets/mesh'
import { buildCardAtlas, buildSet, combineAtlases, encodeSet, SPECS, writeSet, type CardRect, type Pbr } from './assets/textures'
import { writeGlb, type GlbMaterial } from './assets/glb'
import { bakeImpostors } from './assets/impostors'

async function main() {
  const started = performance.now(), source = path.join(process.cwd(), 'assets-src', 'textures')
  const output = path.join(process.cwd(), 'public'), geometryOnly = process.argv.includes('--geometry-only')
  const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7)

  const [oak, maple, birch, pine, spruce, tufts, ferns] = await Promise.all([
    buildCardAtlas(source, 'foliage-oak-dense.webp', 4, false),
    buildCardAtlas(source, 'foliage-maple-dense.webp', 4, false),
    buildCardAtlas(source, 'foliage-birch.webp', 4, false),
    buildCardAtlas(source, 'foliage-pine-dense.webp', 4, true),
    buildCardAtlas(source, 'foliage-spruce.webp', 4, true),
    buildCardAtlas(source, 'grass-tufts.webp', 4, true),
    buildCardAtlas(source, 'fern-fronds.webp', 4, false),
  ])
  const broadleaf = combineAtlases([oak, maple, birch]), conifer = combineAtlases([pine, spruce]), ground = combineAtlases([tufts, ferns])
  const cardsOf = (spec: TreeSpec): CardRect[] => {
    switch (spec.foliage) {
      case 'oak': return broadleaf.cards.slice(0, 4)
      case 'maple': return broadleaf.cards.slice(4, 8)
      case 'birch': return broadleaf.cards.slice(8, 12)
      case 'pine': return conifer.cards.slice(0, 4)
      case 'spruce': return conifer.cards.slice(4, 8)
      default: return []
    }
  }
  const models: Model[] = []
  for (const lod of [0, 1]) {
    for (const spec of TREES) {
      if (only && !spec.name.startsWith(only)) continue
      const model = finishVegetation(tree(spec, cardsOf(spec), lod))
      bendCrown(model)
      models.push(model)
    }
    for (const spec of GRASSES) {
      if (only && !spec.name.startsWith(only)) continue
      const model = finishVegetation(grass(spec, ground.cards, lod))
      bendNormals(model, 'grass', () => [0, 1, 0], 1.4)
      models.push(model)
    }
  }
  const reports = models.map(validate)
  for (const r of reports) console.log(`${r.name.padEnd(23)} ${String(r.triangles).padStart(6)} tri · ${String(r.vertices).padStart(6)} vértices · ${r.size.map((v) => v.toFixed(1)).join(' × ')} m · ${r.issues.length ? r.issues.join('; ') : 'OK'}`)
  if (reports.some((r) => r.issues.length)) throw new Error('Exportação interrompida: corrija as malhas reprovadas antes de publicar.')
  if (geometryOnly || only) return
  const sets: Record<string, Pbr> = { 'foliage-broadleaf': broadleaf.set, 'foliage-pine': conifer.set, grass: ground.set }
  for (const name of ['bark', 'pine-bark', 'birch-bark', 'deadwood', 'endgrain']) {
    sets[name] = await buildSet(source, SPECS[name])
    console.log(`PBR ${name}: albedo + normal OpenGL + AO/roughness/metalness`)
  }
  for (const [name, set] of Object.entries(sets)) await writeSet(path.join(output, 'textures', name), await encodeSet(set))
  const impostors = bakeImpostors(models.slice(0, TREES.length), sets)
  await writeSet(path.join(output, 'textures', 'tree-impostors'), await encodeSet(impostors))
  const materials: GlbMaterial[] = [
    { name: 'bark' }, { name: 'pine_bark' }, { name: 'birch_bark' }, { name: 'deadwood' }, { name: 'endgrain' },
    { name: 'foliage_broadleaf', alphaCutoff: 0.5, doubleSided: true },
    { name: 'foliage_pine', alphaCutoff: 0.5, doubleSided: true },
    { name: 'grass', alphaCutoff: 0.5, doubleSided: true },
  ]
  const index = new Map(materials.map((m, i) => [m.name, i]))
  const glb = writeGlb(models.map((model, i) => ({ model, translation: [(i % 12) * 16, 0, Math.floor(i / 12) * 28] })), materials, [], index)
  await mkdir(path.join(output, 'models'), { recursive: true })
  await writeFile(path.join(output, 'models', 'vegetation.glb'), glb)
  await writeFile(path.join(output, 'models', 'vegetation-report.json'), JSON.stringify({ version: 2, units: 'meters', generatedAt: new Date().toISOString(), checks: ['watertight-wood', 'consistent-winding', 'finite-uvs', 'uv-stretch', 'vertex-normals', 'grounded-components', 'self-intersections', 'coplanar-overlap'], models: reports }, null, 2))
  console.log(`vegetation.glb: ${(glb.length / 1048576).toFixed(2)} MB · ${reports.length} modelos validados · ${((performance.now() - started) / 1000).toFixed(1)} s`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
