import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GROUND_SETS } from '../lib/game/assets/catalog'
import { encodeImage, flatten, makeSeamless, readImage, type Img } from './assets/image'

const root = process.cwd()
const rawDir = path.join(root, 'assets-src', 'raw')
const outDir = path.join(root, 'public', 'textures', 'ground')
const SIZE = 1024
const QUALITY = 84

function seamScore(img: Img) {
  const { w, h, c } = img
  let wrap = 0, inner = 0
  for (let y = 0; y < h; y++) for (let ch = 0; ch < 3; ch++) {
    const a = img.data[(y * w + w - 1) * c + ch], b = img.data[(y * w) * c + ch]
    const m = img.data[(y * w + w / 2) * c + ch], n = img.data[(y * w + w / 2 + 1) * c + ch]
    wrap += (a - b) ** 2; inner += (m - n) ** 2
  }
  return wrap / Math.max(1e-9, inner)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const available = new Set((await readdir(rawDir).catch(() => [] as string[])).map((file) => file.replace(/\.(png|jpe?g|webp)$/i, '')))
  for (const set of GROUND_SETS) {
    if (!available.has(set.name)) { console.log(`${set.name.padEnd(18)} sem foto em assets-src/raw, mantido`); continue }
    const file = (await readdir(rawDir)).find((entry) => entry.replace(/\.(png|jpe?g|webp)$/i, '') === set.name) as string
    let image = await readImage(path.join(rawDir, file), { width: SIZE })
    const before = seamScore(image)
    if (set.seamless) image = makeSeamless(image)
    if (set.flatten) image = flatten(image, set.flatten)
    const encoded = await encodeImage(image, 'webp', QUALITY)
    await writeFile(path.join(outDir, `${set.name}.webp`), encoded)
    console.log(`${set.name.padEnd(18)} emenda ${before.toFixed(2)} -> ${seamScore(image).toFixed(2)}  ${(encoded.length / 1024).toFixed(0)} KB`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
