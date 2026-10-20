import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { ASSETS } from '../lib/game/blockout/catalog'
import { buildAsset } from '../lib/game/blockout/model'
import { BLOCK_MATERIALS, BLOCKOUT_VERSION, hash, type MaterialKey } from '../lib/game/blockout/types'
import { BRICK_TILE, WOOD_TILE } from '../lib/game/blockout/relief-geometry'
import { FAMILY_TAGS, SHEETS, type Finish } from './assets/swatch-catalog'
import { deriveMaps, describeSwatch, encodeBaseSet, encodeModuleSet, prepareSwatch, readSource, sliceSheet, sourceSize } from './assets/swatch-pbr'

const root = process.cwd(), sheetDir = path.join(root, 'assets-src/textures/workshop/ai')

const tile: Record<MaterialKey, number> = { concrete: 1.2, plaster: 1.2, brick: BRICK_TILE.u, wood: WOOD_TILE, steel: 0.6, tile: 0.5, fabric: 0.35, paint: 0.6, charcoal: 0.7, rubber: 0.35, leather: 0.45, straw: 0.7, paper: 0.35, glass: 0.6 }
const depth: Record<MaterialKey, number> = { concrete: 0.0014, plaster: 0.001, brick: 0.002, wood: 0.001, steel: 0.00025, tile: 0.00015, fabric: 0.0007, paint: 0.00035, charcoal: 0.0012, rubber: 0.0004, leather: 0.00055, straw: 0.0014, paper: 0.00015, glass: 0.00005 }

type Group = { base: MaterialKey; owners: string[]; family: string }
type Swatch = { id: string; sheet: number; quadrant: number; base: MaterialKey; name?: string; finish?: Finish; tags: string[] }

function allocations(): Group[] {
  const groups = new Map<string, Group>()
  for (const spec of ASSETS) {
    const area = new Map<MaterialKey, number>()
    for (const part of buildAsset(spec).parts.filter((p) => !p.detail)) {
      const [w, h, d] = part.size
      area.set(part.material, (area.get(part.material) ?? 0) + 2 * (w * h + w * d + h * d))
    }
    const base = [...area.entries()].sort((a, b) => b[1] - a[1])[0][0], key = `${spec.family}:${base}`
    const group = groups.get(key) ?? { base, owners: [], family: spec.family }
    group.owners.push(spec.id); groups.set(key, group)
  }
  const result = [...groups.values()]
  while (result.length < 384) {
    const split = [...result].filter((entry) => entry.owners.length > 1).sort((a, b) => b.owners.length - a.owners.length || a.owners[0].localeCompare(b.owners[0]))[0]
    if (!split) throw new Error('Não há módulos suficientes para 384 materiais usados.')
    result.push({ ...split, owners: split.owners.splice(Math.ceil(split.owners.length / 2)) })
  }
  return result.sort((a, b) => a.owners[0].localeCompare(b.owners[0]))
}

function assign(groups: Group[]) {
  const pool: Swatch[] = SHEETS.flatMap((sheet, index) => [0, 1, 2, 3].map((quadrant) => ({
    id: `${sheet.file}#${quadrant}`, sheet: index, quadrant, base: Array.isArray(sheet.base) ? sheet.base[quadrant] : sheet.base,
    name: sheet.names?.[quadrant], finish: sheet.finish?.[quadrant] as Finish | undefined, tags: sheet.tags ?? [],
  })))
  const taken = new Set<string>()
  const picks = groups.map((group) => {
    const free = pool.filter((swatch) => swatch.base === group.base && !taken.has(swatch.id))
    if (!free.length) throw new Error(`Amostras de ${group.base} esgotadas em ${group.owners[0]}.`)
    const tag = FAMILY_TAGS.find(([pattern]) => pattern.test(group.family))?.[1]
    const matching = tag ? free.filter((swatch) => swatch.tags.includes(tag)) : []
    const score = (swatch: Swatch) => hash(`${group.owners[0]}:${swatch.id}`)
    const pick = (matching.length ? matching : free).reduce((best, swatch) => (score(swatch) < score(best) ? swatch : best))
    taken.add(pick.id)
    return pick
  })
  return { picks, spare: (base: MaterialKey) => pool.find((swatch) => swatch.base === base && !taken.has(swatch.id)) }
}

async function buildBaseSets(spareBrick: Swatch | undefined) {
  const sources: Record<string, string> = {}
  const loaders: [MaterialKey, string, () => Promise<Awaited<ReturnType<typeof readSource>>>][] = [
    ['wood', 'base-wood.png', () => readSource(path.join(sheetDir, 'base-wood.png'), sourceSize(1024))],
    ['concrete', 'base-concrete.png', () => readSource(path.join(sheetDir, 'base-concrete.png'), sourceSize(1024))],
    ['plaster', 'base-plaster.png', () => readSource(path.join(sheetDir, 'base-plaster.png'), sourceSize(1024))],
    ['steel', 'base-steel.png', () => readSource(path.join(sheetDir, 'base-steel.png'), sourceSize(1024))],
  ]
  if (spareBrick) {
    const file = SHEETS[spareBrick.sheet].file
    loaders.push(['brick', `${file}.png#${spareBrick.quadrant}`, async () => (await sliceSheet(path.join(sheetDir, `${file}.png`), sourceSize(1024)))[spareBrick.quadrant]])
  }
  for (const [key, source, load] of loaders) {
    const prepared = prepareSwatch(await load(), key, hash(`base-${key}`), 1024)
    const encoded = await encodeBaseSet(deriveMaps(prepared.albedo, key, key === 'steel' ? 'r' : undefined, prepared.height), key)
    const directory = path.join(root, 'public', BLOCK_MATERIALS[key].texture)
    await mkdir(directory, { recursive: true })
    await Promise.all([
      writeFile(path.join(directory, 'albedo.webp'), encoded.albedo), writeFile(path.join(directory, 'normal.webp'), encoded.normal),
      writeFile(path.join(directory, 'orm.webp'), encoded.orm), writeFile(path.join(directory, 'height.png'), encoded.height),
    ])
    sources[key] = `assets-src/textures/workshop/ai/${source}`
    console.info(`Base ${key}: 4 mapas a partir de ${source}.`)
  }
  return sources
}

async function main() {
  const groups = allocations(), { picks, spare } = assign(groups)
  const catalog: Record<string, unknown>[] = new Array(groups.length), reports: Record<string, unknown>[] = [], seen = new Set<string>()
  const jobs = new Map<number, number[]>()
  picks.forEach((pick, index) => jobs.set(pick.sheet, [...(jobs.get(pick.sheet) ?? []), index]))
  let done = 0, bytes = 0
  for (const [sheetIndex, indices] of [...jobs.entries()].sort((a, b) => a[0] - b[0])) {
    const sheet = SHEETS[sheetIndex], quadrants = await sliceSheet(path.join(sheetDir, `${sheet.file}.png`), sourceSize(512))
    for (const index of indices) {
      const group = groups[index], pick = picks[index], base = group.base, id = `${base}-${group.owners[0]}`, seed = hash(id)
      const source = quadrants[pick.quadrant], name = pick.name ?? describeSwatch(source, base)
      const prepared = prepareSwatch(source, base, seed, 512)
      const encoded = await encodeModuleSet(deriveMaps(prepared.albedo, base, pick.finish, prepared.height), base)
      const digest = createHash('sha256').update(encoded.albedo).update(encoded.normal).update(encoded.orm).digest('hex')
      if (seen.has(digest)) throw new Error(`Mapas duplicados: ${id}`)
      seen.add(digest)
      const directory = path.join(root, 'public/textures/workshop/modules', id)
      await mkdir(directory, { recursive: true })
      await Promise.all(Object.entries(encoded).map(([channel, data]) => writeFile(path.join(directory, `${channel}.webp`), data)))
      const label = ASSETS.find((asset) => asset.id === group.owners[0])!.label.split(' · ')[0]
      catalog[index] = { id, base, family: group.family, owners: group.owners, label: `${label} · ${name}`, texture: `/textures/workshop/modules/${id}`, tile: tile[base], normalStrength: BLOCK_MATERIALS[base].normalStrength, depth: depth[base], source: `assets-src/textures/workshop/ai/${sheet.file}.png#${pick.quadrant}`, seed }
      const size = encoded.albedo.length + encoded.normal.length + encoded.orm.length
      bytes += size
      reports.push({ id, swatch: pick.id, name, sha256: digest, bytes: size })
      if (++done % 32 === 0) console.info(`${done}/${groups.length} conjuntos PBR; ${(bytes / 1048576).toFixed(1)} MiB.`)
    }
  }
  const bases = await buildBaseSets(spare('brick'))
  await writeFile(path.join(root, 'lib/game/blockout/surfaces.generated.json'), JSON.stringify(catalog))
  const manifestPath = path.join(root, 'public/textures/workshop/manifest.json')
  const previous = JSON.parse(await readFile(manifestPath, 'utf8'))
  for (const material of previous.materials ?? []) if (bases[material.material]) material.source = bases[material.material]
  await writeFile(manifestPath, JSON.stringify({
    ...previous, version: BLOCKOUT_VERSION, moduleSets: groups.length, totalSets: groups.length + Object.keys(BLOCK_MATERIALS).length,
    moduleResolution: { albedo: 512, normal: 256, ormHeight: 256 }, moduleChannels: { R: 'ambient occlusion', G: 'roughness', B: 'metalness', A: 'height' },
    moduleSource: `${SHEETS.length} folhas 2×2 geradas por IA, recortadas em ${SHEETS.length * 4} amostras; cada conjunto usa uma amostra exclusiva. Madeira recortada em 4 tábuas por repetição de 0,8 m, alinhadas às tábuas modeladas; tijolo composto em amarração de 0,9 × 0,6 m idêntica às juntas modeladas. Normal, ORM e altura derivados da imagem, não escaneados.`,
    moduleMaterials: catalog, moduleReport: reports,
  }, null, 2))
  console.info(`${groups.length} conjuntos exclusivos de ${SHEETS.length * 4} amostras; ${ASSETS.length} módulos associados; ${(bytes / 1048576).toFixed(1)} MiB.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
