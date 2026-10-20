import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { compressGlb } from './assets/compress-glb'
import path from 'node:path'
import { createWorkshopExporter } from './assets/workshop-export'
import { ASSETS } from '../lib/game/blockout/catalog'
import { BLUEPRINTS } from '../lib/game/blockout/blueprints'
import { buildAsset } from '../lib/game/blockout/model'
import { buildStructure } from '../lib/game/blockout/assemble'
import { validateModel } from '../lib/game/blockout/validation'
import { BLOCK_MATERIALS, BLOCKOUT_VERSION, MODULE_TRIANGLE_BUDGET, CONDITIONS, modelBounds, type BlockModel, type MaterialKey } from '../lib/game/blockout/types'
import { writeGlb, type GlbNode, type GlbImage, type GlbMaterial } from './assets/glb'
import { buildWorkshopTextures } from './build-workshop-textures'
import { WORKSHOP_MATERIALS, WORKSHOP_SURFACES } from '../lib/game/blockout/surfaces'
import { SHEETS } from './assets/swatch-catalog'

const root = process.cwd()
const output = path.join(root, 'public/models/blockout')
const materialKeys = Object.keys(WORKSHOP_MATERIALS)
const materialIndex = new Map(materialKeys.map((name, i) => [name, i]))

function externalMaterials() {
  const images: GlbImage[] = [], materials: GlbMaterial[] = []
  for (const name of materialKeys) {
    const spec = WORKSHOP_MATERIALS[name], first = images.length
    for (const channel of ['albedo', 'normal', 'orm']) images.push({ name: `${name}-${channel}`, mime: 'image/webp', uri: `../../${spec.texture.slice(1)}/${channel}.webp` })
    materials.push({ name, albedo: first, normal: first + 1, orm: first + 2, metallic: spec.metalness, normalScale: spec.normalStrength })
  }
  return { images, materials }
}

const renderReports: { id: string; triangles: number; vertices: number; materialGroups: number; details: number }[] = []

const exportModel = createWorkshopExporter()

async function main() {
  if (process.argv.includes('--compress-existing')) {
    for (const name of ['assets', 'structures']) {
      const file = path.join(output, `${name}.glb`), raw = await readFile(file)
      const compressed = await compressGlb(raw)
      await writeFile(file, compressed)
      console.info(`${name}: ${(raw.length / 1048576).toFixed(1)} → ${(compressed.length / 1048576).toFixed(1)} MiB; todos os buffers idênticos após decodificação.`)
    }
    return
  }
  const textureOnly = process.argv.includes('--textures-only')
  if (textureOnly || process.argv.includes('--textures')) await buildWorkshopTextures()
  if (textureOnly) return
  await mkdir(output, { recursive: true })
  const modules = ASSETS.map((spec) => buildAsset(spec))
  const assetReports = modules.map((model) => validateModel(model))
  const structureReports = []
  const defaults: BlockModel[] = []
  for (const blueprint of BLUEPRINTS) {
    for (const condition of CONDITIONS) for (const seed of [1, 2049, 8675309]) {
      const model = buildStructure(blueprint, seed, { condition: condition.value })
      structureReports.push(validateModel(model))
      if (condition.value === 'weathered' && seed === 2049) defaults.push(model)
    }
  }
  const errors = [...assetReports, ...structureReports].flatMap((report) => report.issues.map((issue) => ({ model: report.id, ...issue })))
  const report = {
    version: BLOCKOUT_VERSION, generatedAt: new Date().toISOString(), passed: errors.length === 0,
    assets: modules.length, blueprints: BLUEPRINTS.length, structureCases: structureReports.length,
    seeds: [1, 2049, 8675309], conditions: CONDITIONS.map((c) => c.value),
    checks: ['Dimensões e transformações finitas', 'Interpenetração por OBB/SAT dos volumes de montagem', 'Faces coplanares com mesma normal', 'Grafo de contato com a base e suporte explícito de ferragens', 'Suporte de sockets', 'Cápsula de circulação 0,56 × 1,80 m', 'Piso e degraus nas rotas', 'Malha de render: índices, triângulos, normais suaves e densidade UV', `Orçamento máximo de ${MODULE_TRIANGLE_BUDGET} triângulos por módulo; colisões simplificadas preservadas`],
    scope: 'Malhas visuais chanfradas contidas nos volumes de montagem, com colisores simplificados. Auditoria determinística, não uma certificação artística ou engenharia estrutural. Não certifica seeds não amostradas.',
    materialSource: `${WORKSHOP_SURFACES.length} conjuntos exclusivos mais ${Object.keys(BLOCK_MATERIALS).length} bases; ${SHEETS.length} folhas geradas por IA recortadas em ${SHEETS.length * 4} amostras, sem amostra repetida entre conjuntos. Paredes, telhados e pisos com relevo modelado (tábuas com frestas, tijolos em amarração, painéis de concreto, chapas onduladas). Normal e ORM/altura derivados, não escaneados.`,
    materialSets: WORKSHOP_SURFACES.length + Object.keys(BLOCK_MATERIALS).length,
    renderReports, assetReports, structureReports, errors,
  }
  await writeFile(path.join(output, 'validation-report.json'), JSON.stringify(report, null, 2))
  if (errors.length) throw new Error(`${errors.length} falhas; consulte public/models/blockout/validation-report.json. Exportação GLB bloqueada.`)
  const check = process.argv.includes('--check')
  if (!check) {
    const textureManifestPath = path.join(root, 'public/textures/workshop/manifest.json')
    const textureManifest = JSON.parse(await readFile(textureManifestPath, 'utf8'))
    for (const material of textureManifest.materials) {
      const source = material.source.replace(/\.png$/, '.webp')
      try { const bytes = await readFile(path.join(root, source)); material.source = source; material.sourceBytes = bytes.length } catch {                                                              }
    }
    textureManifest.version = BLOCKOUT_VERSION
    textureManifest.moduleMaterials = WORKSHOP_SURFACES
    await writeFile(textureManifestPath, JSON.stringify(textureManifest, null, 2))
  }
  const pbr = check ? null : externalMaterials()
  for (const [name, sources, columns, spacing] of [['assets', modules, 20, 9], ['structures', defaults, 12, 48]] as const) {
    const nodes: GlbNode[] = []
    for (const [i, source] of sources.entries()) {
      const exported = exportModel(source, [i % columns * spacing, 0, Math.floor(i / columns) * spacing])
      if (!('blueprint' in source) && exported.stats.triangles > MODULE_TRIANGLE_BUDGET) throw new Error(`${source.id}: orçamento geométrico excedido.`)
      renderReports.push(exported.stats)
      if (!check) nodes.push(...exported.nodes)
    }
    if (pbr) {
      const bytes = await compressGlb(writeGlb(nodes, pbr.materials, pbr.images, materialIndex))
      await writeFile(path.join(output, `${name}.glb`), bytes)
      console.info(`${name}.glb: ${sources.length} modelos; ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MiB; malhas compartilhadas e PBR externo incluído no ZIP.`)
    }
  }
  await writeFile(path.join(output, 'validation-report.json'), JSON.stringify(report, null, 2))
  if (!check) await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ version: BLOCKOUT_VERSION, units: 'meters', up: '+Y', forward: '+Z', pivot: 'base-center', grid: 6, textureManifest: '/textures/workshop/manifest.json', assetKit: '/models/blockout/assets.glb', structureKit: '/models/blockout/structures.glb', materials: WORKSHOP_MATERIALS, textureStorage: 'Mapas WebP externos, compartilhados e incluídos no ZIP completo.', modules: ASSETS.map((spec, i) => ({ ...spec, bounds: modelBounds(modules[i]), render: renderReports[i], collision: modules[i].parts.filter((part) => !part.detail), sockets: modules[i].sockets, snaps: modules[i].snaps })), blueprints: BLUEPRINTS }, null, 2))
  console.info(`${modules.length} módulos; ${BLUEPRINTS.length} arquétipos; ${structureReports.length} montagens auditadas; ${errors.length} erros; ${renderReports.reduce((sum, item) => sum + item.triangles, 0).toLocaleString('pt-BR')} triângulos visuais auditados.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
