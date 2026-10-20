import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.join(process.cwd(), 'public/textures')
const MAPS = ['albedo', 'normal', 'orm'] as const
const QUALITY: Record<(typeof MAPS)[number], number> = { albedo: 86, normal: 92, orm: 88 }

const MODELS = ['public/models/survivor/survivor.glb']

type GltfView = { byteOffset?: number; byteLength: number }
type GltfImage = { bufferView?: number; mimeType?: string }

async function shrinkModel(source: string) {
  const file = await readFile(source)
  const jsonLength = file.readUInt32LE(12)
  const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8')) as { bufferViews: GltfView[]; images?: GltfImage[]; buffers: { byteLength: number }[] }
  const binStart = 28 + jsonLength
  const bin = file.subarray(binStart, binStart + file.readUInt32LE(20 + jsonLength))
  const bytesOf = (view: GltfView) => bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)

  const images = new Map<number, Buffer>()
  for (const image of gltf.images ?? []) {
    if (image.bufferView === undefined) continue
    const picture = sharp(bytesOf(gltf.bufferViews[image.bufferView]))
    const { width = 0, height = 0 } = await picture.metadata()
    const half = picture.resize(Math.max(64, Math.round(width / 2)), Math.max(64, Math.round(height / 2)), { kernel: 'lanczos3' })
    const encoded = image.mimeType === 'image/png' ? half.png() : image.mimeType === 'image/jpeg' ? half.jpeg({ quality: 88 }) : half.webp({ quality: 88, alphaQuality: 90, effort: 6 })
    images.set(image.bufferView, await encoded.toBuffer())
    console.info(`  image ${image.bufferView}: ${width}×${height} → ${Math.round(width / 2)}×${Math.round(height / 2)}`)
  }

  const parts: Buffer[] = []
  let offset = 0
  gltf.bufferViews.forEach((view, index) => {
    const bytes = images.get(index) ?? bytesOf(view)
    const padding = (4 - (offset % 4)) % 4
    parts.push(Buffer.alloc(padding), bytes)
    view.byteOffset = offset + padding
    view.byteLength = bytes.length
    offset += padding + bytes.length
  })
  parts.push(Buffer.alloc((4 - (offset % 4)) % 4))
  const binChunk = Buffer.concat(parts)
  gltf.buffers[0].byteLength = binChunk.length

  const json = Buffer.from(JSON.stringify(gltf))
  const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)])
  const glb = Buffer.alloc(28 + jsonChunk.length + binChunk.length)
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8)
  glb.writeUInt32LE(jsonChunk.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(glb, 20)
  glb.writeUInt32LE(binChunk.length, 20 + jsonChunk.length); glb.writeUInt32LE(0x004e4942, 24 + jsonChunk.length); binChunk.copy(glb, 28 + jsonChunk.length)
  const target = source.replace(/\.glb$/, '.mobile.glb')
  await writeFile(target, glb)
  console.info(`${target}: ${(file.length / 1e6).toFixed(2)} MB → ${(glb.length / 1e6).toFixed(2)} MB`)
}

async function folders(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(directory, entry.name))
}

async function shrink(folder: string) {
  for (const map of MAPS) {
    const source = path.join(folder, `${map}.webp`)
    if (!(await stat(source).catch(() => null))) continue
    const image = sharp(source)
    const { width = 0, height = 0 } = await image.metadata()
    const size = { width: Math.max(64, Math.round(width / 2)), height: Math.max(64, Math.round(height / 2)) }
    const target = path.join(folder, `${map}.mobile.webp`)
    await image.resize(size.width, size.height, { kernel: 'lanczos3' }).webp({ quality: QUALITY[map], alphaQuality: 100, effort: 5 }).toFile(target)
    console.info(`${path.relative(process.cwd(), target)}: ${width}×${height} → ${size.width}×${size.height}`)
  }
}

async function shrinkPhotos(folder: string) {
  for (const name of await readdir(folder)) {
    if (!name.endsWith('.webp') || name.endsWith('.mobile.webp')) continue
    const source = path.join(folder, name), target = source.replace(/\.webp$/, '.mobile.webp')
    const image = sharp(source)
    const { width = 0, height = 0 } = await image.metadata()
    await image.resize(Math.max(64, Math.round(width / 2)), Math.max(64, Math.round(height / 2)), { kernel: 'lanczos3' }).webp({ quality: 90, effort: 5 }).toFile(target)
    console.info(`${path.relative(process.cwd(), target)}: ${width}×${height} → ${Math.round(width / 2)}×${Math.round(height / 2)}`)
  }
}

async function main() {
  await shrinkPhotos(path.join(ROOT, 'ground'))
  for (const folder of await folders(ROOT)) {

    if (path.basename(folder) === 'workshop') {
      for (const base of await folders(folder)) if (path.basename(base) !== 'modules') await shrink(base)
      continue
    }
    await shrink(folder)
  }
  for (const model of MODELS) await shrinkModel(path.join(process.cwd(), model))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
