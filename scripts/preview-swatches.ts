import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { createImage, encodeImage, normalFromHeight, type Img } from './assets/image'
import { deriveMaps, describeSwatch, prepareSwatch, sliceSheet, RELIEF } from './assets/swatch-pbr'
import type { MaterialKey } from '../lib/game/blockout/types'

const picks: [string, number, MaterialKey][] = (process.argv[2] ?? 'wood-06:1:wood,brick-01:0:brick,steel-03:2:steel,tile-04:0:tile').split(',').map((entry) => {
  const [file, quadrant, base] = entry.split(':')
  return [file, Number(quadrant), base as MaterialKey]
})

async function main() {
  const tiles: Img[] = [], names: string[] = []
  for (const [file, quadrant, base] of picks) {
    const source = (await sliceSheet(path.join(process.cwd(), 'assets-src/textures/workshop/ai', `${file}.png`), 512))[quadrant]
    const prepared = prepareSwatch(source, base, 7, 512)
    const maps = deriveMaps(prepared.albedo, base, base === 'steel' ? 'r' : undefined, prepared.height)
    tiles.push(maps.albedo, normalFromHeight(maps.height, RELIEF[base]))
    names.push(describeSwatch(source, base))
  }
  const columns = picks.length, sheet = createImage(512 * columns, 1024, 3)
  tiles.forEach((tile, i) => {
    const ox = Math.floor(i / 2) * 512, oy = (i % 2) * 512
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) for (let c = 0; c < 3; c++) sheet.data[((oy + y) * sheet.w + ox + x) * 3 + c] = tile.data[(y * 512 + x) * 3 + c]
  })
  await mkdir('/tmp/agent-browser', { recursive: true })
  await writeFile('/tmp/agent-browser/swatch-preview.png', await sharp(await encodeImage(sheet, 'png')).resize(256 * columns, 512).png().toBuffer())
  console.info(names.join(' | '))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
