import { readdir, readFile, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { compressGlb } from './assets/compress-glb'

const root = process.cwd()
async function optimizeImages(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) { await optimizeImages(file); continue }
    if (!entry.name.endsWith('.png')) continue
    const original = await readFile(file), encoded = await sharp(original).webp({ lossless: true, effort: 6 }).toBuffer()
    if (encoded.length >= original.length) continue
    const before = await sharp(original).ensureAlpha().raw().toBuffer(), after = await sharp(encoded).ensureAlpha().raw().toBuffer()
    if (!before.equals(after)) throw new Error(`Conversão não idêntica em pixels: ${file}`)
    await writeFile(file.replace(/\.png$/, '.webp'), encoded)
    await unlink(file)
    console.info(`${path.relative(root, file)}: ${original.length} → ${encoded.length} bytes; pixels SHA-256 ${createHash('sha256').update(after).digest('hex')}`)
  }
}
async function main() {
  await optimizeImages(path.join(root, 'assets-src/textures/workshop'))
  for (const name of ['vegetation', 'forest-floor', 'road-kit']) {
    const file = path.join(root, 'public/models', `${name}.glb`), original = await readFile(file)
    const compressed = await compressGlb(original)
    if (compressed.length < original.length) await writeFile(file, compressed)
    console.info(`${name}.glb: ${(original.length / 1048576).toFixed(2)} → ${(Math.min(compressed.length, original.length) / 1048576).toFixed(2)} MiB.`)
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
