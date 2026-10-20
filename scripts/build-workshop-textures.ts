import { mkdir, writeFile, stat, access } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { buildSet } from './assets/textures'
import { encodeImage, resizeImage, smoothstep } from './assets/image'
import { BLOCK_MATERIALS, BLOCKOUT_VERSION, type MaterialKey } from '../lib/game/blockout/types'

const root = process.cwd()
const recipes: Record<MaterialKey, { normal: number; rough: [number, number]; ao: number }> = {
  concrete: { normal: 1.6, rough: [0.98, 0.8], ao: 2.4 },
  plaster: { normal: 1.3, rough: [0.96, 0.84], ao: 2.1 },
  brick: { normal: 2.5, rough: [0.98, 0.8], ao: 3.2 },
  wood: { normal: 1.6, rough: [0.92, 0.72], ao: 2.5 },
  steel: { normal: 0.7, rough: [0.68, 0.36], ao: 1.2 },
  tile: { normal: 0.5, rough: [0.5, 0.22], ao: 1.1 },
  fabric: { normal: 1.6, rough: [0.99, 0.86], ao: 1.8 },
  paint: { normal: 1, rough: [0.84, 0.5], ao: 1.4 },
  charcoal: { normal: 2, rough: [1, 0.9], ao: 2.8 },
  rubber: { normal: 0.8, rough: [0.94, 0.69], ao: 1.5 },
  leather: { normal: 1.1, rough: [0.86, 0.49], ao: 1.7 },
  straw: { normal: 2.1, rough: [1, 0.87], ao: 2.8 },
  paper: { normal: 0.55, rough: [0.96, 0.78], ao: 1.1 },
  glass: { normal: 0.35, rough: [0.32, 0.13], ao: 0.6 },
}

export async function buildWorkshopTextures() {
  const reports = []
  for (const key of Object.keys(recipes) as MaterialKey[]) {
    const webp = path.join(root, 'assets-src/textures/workshop', `${key}.webp`)
    const source = await access(webp).then(() => webp).catch(() => webp.replace(/\.webp$/, '.png'))
    const metadata = await sharp(source).metadata()
    if (!metadata.width || !metadata.height) throw new Error(`Imagem fonte inválida: ${key}`)
    const spec = recipes[key]
    const maps = await buildSet(path.dirname(source), {
      source: path.basename(source), seamless: true, flatten: 0.4, ...spec,
      ...(key === 'steel' ? { metal: (r: number, _g: number, b: number) => 0.92 * (1 - smoothstep(0.025, 0.14, r - b)) } : {}),
      ...(key === 'paint' ? { metal: (r: number, g: number, b: number) => 0.9 * (1 - smoothstep(0.025, 0.12, Math.max(r, g, b) - Math.min(r, g, b))) } : {}),
    }, 1024)
    const directory = path.join(root, 'public', BLOCK_MATERIALS[key].texture)
    await mkdir(directory, { recursive: true })
    const bytes: Record<string, number> = {}
    for (const channel of ['albedo', 'normal', 'orm', 'height'] as const) {
      const image = channel === 'orm' ? await resizeImage(maps.orm, 512, 512) : maps[channel]
      const png = await encodeImage(image, 'png')
      const data = channel === 'height' ? png : channel === 'albedo' ? await sharp(png).webp({ quality: 91, effort: 5 }).toBuffer() : await sharp(png).webp({ lossless: true, effort: 5 }).toBuffer()
      await writeFile(path.join(directory, `${channel}.${channel === 'height' ? 'png' : 'webp'}`), data)
      bytes[channel] = data.byteLength
    }
    const orm = maps.orm.data
    let minRoughness = 1, maxRoughness = 0, minMetalness = 1, maxMetalness = 0
    for (let i = 0; i < orm.length; i += 3) {
      minRoughness = Math.min(minRoughness, orm[i + 1]); maxRoughness = Math.max(maxRoughness, orm[i + 1])
      minMetalness = Math.min(minMetalness, orm[i + 2]); maxMetalness = Math.max(maxMetalness, orm[i + 2])
    }
    if (BLOCK_MATERIALS[key].metalness === 0 && maxMetalness > 0) throw new Error(`Metalness indevido: ${key}`)
    reports.push({ material: key, source: path.relative(root, source), sourceBytes: (await stat(source)).size, resolution: { albedo: 1024, normal: 1024, orm: 512, height: 1024 }, bytes, roughness: [minRoughness, maxRoughness], metalness: [minMetalness, maxMetalness] })
    console.info(`PBR ${key}: 4 mapas; ${(Object.values(bytes).reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KiB`)
  }
  await writeFile(path.join(root, 'public/textures/workshop/manifest.json'), JSON.stringify({ version: BLOCKOUT_VERSION, source: 'Imagens fotográficas geradas por IA; não são escaneamentos medidos.', pipeline: 'Albedo sem iluminação direcional; normal, altura e oclusão aproximados da luminância; rugosidade calibrada por material; metalness seletivo para aço e pintura.', normalConvention: 'OpenGL +Y', colorSpace: { albedo: 'sRGB', normal: 'linear', orm: 'linear', height: 'linear' }, orm: { R: 'occlusion', G: 'roughness', B: 'metalness' }, generatedAt: new Date().toISOString(), materials: reports }, null, 2))
  return reports
}

if (process.argv[1]?.endsWith('build-workshop-textures.ts')) buildWorkshopTextures().catch((error) => { console.error(error); process.exitCode = 1 })
