import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { Kit } from '../lib/game/blockout/sculpt/kit'
import { hash, random, type MaterialKey } from '../lib/game/blockout/types'
import { RESOURCE_BY_ID } from '../lib/game/resources/catalog'
import { RESOURCE_SCULPTORS, isSculptedResource, resourceAssetId } from '../lib/game/resources/sculpts'
import { FINISHES, RESOURCE_TEXTURES, SWATCHES } from './assets/resource-texture-plan'
import { blur, cavity, createImage, delight, encodeImage, flatten, luminance, makeTileable, normalFromHeight, normalize, resizeImage, type Img } from './assets/image'
import { sliceSheet } from './assets/swatch-pbr'

const root = process.cwd(), sheetDir = path.join(root, 'assets-src/textures/resources'), outDir = path.join(root, 'public/textures/workshop/resources')
const SIZE = 512, MAP = 256, SOURCE = Math.round(SIZE * 1.22)

function crop(img: Img, x0: number, y0: number, w: number, h: number) {
  const out = createImage(w, h, img.c)
  for (let y = 0; y < h; y++) out.data.set(img.data.subarray(((y0 + y) * img.w + x0) * img.c, ((y0 + y) * img.w + x0 + w) * img.c), y * w * img.c)
  return out
}

function calm(img: Img, amount: number) {
  if (!amount) return img
  const soft = blur(img, SIZE / 24), out = { ...img, data: img.data.slice() }
  for (let i = 0; i < out.data.length; i++) out.data[i] += (soft.data[i] - out.data[i]) * amount
  return out
}

async function lossless(img: Img) {
  return sharp(await encodeImage(img, 'png')).webp({ lossless: true, effort: 5 }).toBuffer()
}

type Definition = { id: string; base: MaterialKey; family: string; owners: string[]; label: string; texture: string; tile: number; normalStrength: number; depth: number; source: string; seed: number }

const only = process.argv.find((a) => a.startsWith('--ids='))?.slice(6).split(',')
const checkOnly = process.argv.includes('--check')
const resume = process.argv.includes('--resume')

function checkPlan() {
  const problems: string[] = []
  for (const [id, materials] of Object.entries(RESOURCE_TEXTURES)) {
    const resource = RESOURCE_BY_ID.get(id)
    if (!resource) { problems.push(`${id}: recurso desconhecido`); continue }
    if (!isSculptedResource(id) || resource.model.status === 'pronto') { problems.push(`${id}: sem escultura própria`); continue }
    const kit = new Kit(resourceAssetId(id), resource.model.size, 0)
    RESOURCE_SCULPTORS[id](kit, resource)
    const unused = Object.keys(materials).filter((m) => !kit.buckets.has(m as MaterialKey))
    if (unused.length) problems.push(`${id}: ${unused.join(', ')} fora dos baldes (${[...kit.buckets.keys()].join(', ')})`)
  }
  return problems
}

async function main() {
  const problems = checkPlan()
  if (problems.length) throw new Error(`Plano de texturas divergente:\n  ${problems.join('\n  ')}`)
  if (checkOnly) { console.info(`Plano conferido: ${Object.keys(RESOURCE_TEXTURES).length} recursos.`); return }
  const sheets = new Map<string, Img[]>(), definitions: Definition[] = []
  let bytes = 0
  for (const [id, materials] of Object.entries(RESOURCE_TEXTURES)) {
    if (only && !only.includes(id)) continue
    const resource = RESOURCE_BY_ID.get(id)!
    for (const [material, key] of Object.entries(materials) as [MaterialKey, keyof typeof SWATCHES][]) {
      const [sheet, quadrant, finishKey, name] = SWATCHES[key]
      if (!sheets.has(sheet)) sheets.set(sheet, await sliceSheet(path.join(sheetDir, `${sheet}.png`), 900))
      const quad = sheets.get(sheet)![quadrant], finish = FINISHES[finishKey]
      const surfaceId = `res-${id}-${material}`, seed = hash(surfaceId), rng = random(seed)
      const definition: Definition = { id: surfaceId, base: material, family: `resource-${id}`, owners: [`resource-${id}`], label: `${resource.label} · ${name}`, texture: `/textures/workshop/resources/${surfaceId}`, tile: finish.tile, normalStrength: 1, depth: finish.depth, source: `assets-src/textures/resources/${sheet}.png#${quadrant}`, seed }
      if (resume && ['albedo', 'normal', 'orm'].every((channel) => existsSync(path.join(outDir, surfaceId, `${channel}.webp`)))) { definitions.push(definition); continue }

      const side = Math.round(quad.w * (0.5 + rng() * 0.1)), x0 = Math.round((quad.w - side) * (0.25 + 0.5 * rng())), y0 = Math.round((quad.h - side) * (0.25 + 0.5 * rng()))
      const source = await resizeImage(crop(quad, x0, y0, side, side), SOURCE, SOURCE)
      const calmed = 'calm' in finish ? finish.calm : 0
      const albedo = calm(flatten(makeTileable(delight(source), SIZE), finish.flatten), calmed)

      const lum = normalize(luminance(albedo))
      if (calmed) for (let i = 0; i < lum.data.length; i++) lum.data[i] = 0.5 + (lum.data[i] - 0.5) * (1 - calmed)
      const height = blur(lum, finish.blur), ao = cavity(height, 3, finish.ao)
      const rough = createImage(SIZE, SIZE, 1), metal = createImage(SIZE, SIZE, 1)
      for (let i = 0; i < SIZE * SIZE; i++) {
        rough.data[i] = Math.max(0.08, Math.min(1, finish.rough[0] + (finish.rough[1] - finish.rough[0]) * lum.data[i]))
        metal.data[i] = finish.metal ? finish.metal * (0.86 + 0.14 * lum.data[i]) : 0
      }
      const [h, a, r, m] = await Promise.all([height, ao, rough, metal].map((img) => resizeImage(img, MAP, MAP)))
      const orm = createImage(MAP, MAP, 4)
      for (let p = 0; p < MAP * MAP; p++) orm.data.set([a.data[p], Math.max(0.08, r.data[p]), m.data[p], Math.min(0.98, Math.max(0.02, h.data[p]))], p * 4)
      const encoded = { albedo: await encodeImage(albedo, 'webp', 86), normal: await lossless(normalFromHeight(h, finish.relief)), orm: await lossless(orm) }
      const directory = path.join(outDir, surfaceId)
      await mkdir(directory, { recursive: true })
      await Promise.all(Object.entries(encoded).map(([channel, data]) => writeFile(path.join(directory, `${channel}.webp`), data)))
      bytes += encoded.albedo.length + encoded.normal.length + encoded.orm.length
      definitions.push(definition)
    }
    console.info(`${id}: ${Object.keys(materials).join(', ')}`)
  }
  if (only) { console.info(`${definitions.length} conjuntos de teste gerados; catálogo não alterado.`); return }
  await writeFile(path.join(root, 'lib/game/resources/surfaces.generated.json'), JSON.stringify(definitions))
  console.info(`${definitions.length} conjuntos PBR próprios para ${Object.keys(RESOURCE_TEXTURES).length} recursos; ${(bytes / 1048576).toFixed(1)} MiB.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
