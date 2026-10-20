import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { ASSETS } from '../lib/game/blockout/catalog'
import { BLOCK_MATERIALS, hash, type MaterialKey } from '../lib/game/blockout/types'
import { BRICK_TILE, WOOD_TILE } from '../lib/game/blockout/relief-geometry'
import { SHEETS, type Finish } from './assets/swatch-catalog'
import { deriveMaps, describeSwatch, encodeModuleSet, prepareSwatch, sliceSheet, sourceSize } from './assets/swatch-pbr'

const root = process.cwd(), sheetDir = path.join(root, 'assets-src/textures/workshop/ai')
const tile: Partial<Record<MaterialKey, number>> = { concrete: 1.2, plaster: 1.2, brick: BRICK_TILE.u, wood: WOOD_TILE, steel: 0.6, tile: 0.5, fabric: 0.35, paint: 0.6, charcoal: 0.7, rubber: 0.35, leather: 0.45, straw: 0.7, paper: 0.35, glass: 0.6 }
const depth: Partial<Record<MaterialKey, number>> = { concrete: 0.0014, plaster: 0.001, brick: 0.002, wood: 0.001, steel: 0.00025, tile: 0.00015, fabric: 0.0007, paint: 0.00035, charcoal: 0.0012, rubber: 0.0004, leather: 0.00055, straw: 0.0014, paper: 0.00015, glass: 0.00005 }

const PICKS: Record<string, [string, number][]> = {
  'plank-wall': [['wood-23', 0], ['wood-23', 1]],
  'log-wall': [['wood-23', 2], ['wood-23', 3]],
  'boarded-window': [['wood-24', 0], ['wood-24', 1]],
  'shutter-window': [['plaster-02', 0], ['plaster-02', 3]],
  'half-timber-wall': [['plaster-02', 2], ['plaster-02', 1]],
  'arched-window': [['brick-07', 0], ['brick-07', 1]],
  'arched-doorway': [['brick-08', 0], ['brick-08', 1]],
  'corrugated-wall': [['steel-48', 0], ['steel-48', 2]],
  'cobogo-wall': [['concrete-09', 0], ['concrete-07', 0]],
  'stone-wall': [['concrete-08', 3], ['concrete-09', 2]],
  'tv-stand': [['wood-03', 0], ['wood-11', 1]],
  'coffee-table': [['wood-11', 2], ['wood-11', 3]],
  'kitchen-counter': [['wood-15', 2], ['wood-20', 0]],
  'wall-cabinet': [['wood-24', 2], ['wood-24', 3]],
  'display-table': [['wood-25', 0], ['wood-25', 1]],
  'coat-rack': [['wood-25', 2], ['wood-25', 3]],
  'wall-art': [['paper-03', 0], ['paper-03', 2]],
  rug: [['fabric-04', 0], ['fabric-05', 0]],
  mattress: [['fabric-04', 1], ['fabric-05', 1]],
  'sleeping-bag': [['fabric-04', 2], ['fabric-05', 2]],
  'privacy-screen': [['fabric-04', 3], ['fabric-05', 3]],
  'floor-lamp': [['steel-41', 3], ['steel-49', 1]],
  'bar-stool': [['steel-24', 0], ['steel-49', 2]],
  'shopping-cart': [['steel-48', 1], ['steel-49', 0]],
  'step-ladder': [['steel-48', 3], ['steel-49', 3]],
  'cardboard-boxes': [['paper-01', 0], ['paper-03', 3]],
  'trash-bags': [['rubber-02', 0], ['rubber-02', 1]],
  'potted-plant': [['tile-05', 2], ['tile-08', 3]],
}
const SPLIT: Record<string, number[][]> = { 'corrugated-wall': [[0], [1, 2]] }

type Definition = { id: string; base: MaterialKey; family: string; owners: string[]; label: string; texture: string; tile: number; normalStrength: number; depth: number; source: string; seed: number }

async function main() {
  const surfacesPath = path.join(root, 'lib/game/blockout/surfaces.generated.json'), manifestPath = path.join(root, 'public/textures/workshop/manifest.json')
  const surfaces: Definition[] = JSON.parse(await readFile(surfacesPath, 'utf8'))
  const owned = new Set(surfaces.flatMap((s) => s.owners)), used = new Set(surfaces.map((s) => s.source))
  const missing = ASSETS.filter((a) => !owned.has(a.id))
  const families = [...new Set(missing.map((a) => a.family))]
  const added: Definition[] = [], reports: Record<string, unknown>[] = []
  const sheets = new Map<string, Awaited<ReturnType<typeof sliceSheet>>>()
  for (const family of families) {
    const members = missing.filter((a) => a.family === family).sort((a, b) => a.variant - b.variant), picks = PICKS[family]
    if (!picks) throw new Error(`Sem amostras definidas para ${family}.`)
    const split = SPLIT[family] ?? [[0, 1], [2]]
    for (const [set, variants] of split.entries()) {
      const owners = members.filter((a) => variants.includes(a.variant)).map((a) => a.id)
      if (!owners.length) continue
      const [file, quadrant] = picks[set], sheet = SHEETS.find((s) => s.file === file)!
      const source = `assets-src/textures/workshop/ai/${file}.png#${quadrant}`
      if (used.has(source)) throw new Error(`Amostra já usada: ${source}`)
      used.add(source)
      if (!sheets.has(file)) sheets.set(file, await sliceSheet(path.join(sheetDir, `${file}.png`), sourceSize(512)))
      const base = (Array.isArray(sheet.base) ? sheet.base[quadrant] : sheet.base) as MaterialKey, img = sheets.get(file)![quadrant]
      const spec = members.find((a) => a.id === owners[0])!
      if (spec.material !== base) throw new Error(`${spec.id} é ${spec.material}, amostra é ${base}.`)
      const id = `${base}-${owners[0]}`, seed = hash(id), name = sheet.names?.[quadrant] ?? describeSwatch(img, base)
      const prepared = prepareSwatch(img, base, seed, 512)
      const encoded = await encodeModuleSet(deriveMaps(prepared.albedo, base, sheet.finish?.[quadrant] as Finish | undefined, prepared.height), base)
      const directory = path.join(root, 'public/textures/workshop/modules', id)
      await mkdir(directory, { recursive: true })
      await Promise.all(Object.entries(encoded).map(([channel, data]) => writeFile(path.join(directory, `${channel}.webp`), data)))
      const digest = createHash('sha256').update(encoded.albedo).update(encoded.normal).update(encoded.orm).digest('hex')
      added.push({ id, base, family, owners, label: `${spec.label.split(' · ')[0]} · ${name}`, texture: `/textures/workshop/modules/${id}`, tile: tile[base]!, normalStrength: BLOCK_MATERIALS[base].normalStrength, depth: depth[base]!, source, seed })
      reports.push({ id, swatch: `${file}#${quadrant}`, name, sha256: digest, bytes: encoded.albedo.length + encoded.normal.length + encoded.orm.length })
      console.info(`${id}: ${name} (${owners.join(', ')})`)
    }
  }
  if (!added.length) { console.info('Nenhum módulo sem acabamento.'); return }
  const all = [...surfaces, ...added]
  await writeFile(surfacesPath, JSON.stringify(all))
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.moduleSets = all.length
  manifest.totalSets = all.length + Object.keys(BLOCK_MATERIALS).length
  manifest.moduleMaterials = [...manifest.moduleMaterials, ...added]
  manifest.moduleReport = [...manifest.moduleReport, ...reports]
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  console.info(`${added.length} conjuntos novos; ${all.length} no total para ${ASSETS.length} módulos.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
