import path from 'node:path'
import sharp from 'sharp'
import { createImage, type Img } from './assets/image'
import { prepareSwatch, sliceSheet } from './assets/swatch-pbr'

import generated from '../lib/game/blockout/surfaces.generated.json'

type Surface = { id: string; base: string; label: string; source: string; seed: number; texture: string }
const root = process.cwd()
const surfaces = generated as Surface[]

export function bandScore(img: Img, columns = false) {
  const n = columns ? img.w : img.h, m = columns ? img.h : img.w, profile = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    let sum = 0
    for (let j = 0; j < m; j++) { const i = ((columns ? j * img.w + k : k * img.w + j)) * img.c; sum += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2] }
    profile[k] = sum / m
  }
  let worst = 0
  for (let k = 0; k < n; k++) {
    let before = 0, after = 0
    for (let d = 1; d <= 12; d++) { before += profile[(k - d + n) % n]; after += profile[(k + d - 1) % n] }
    worst = Math.max(worst, Math.abs(before - after) / 12)
  }
  return worst
}

async function decode(file: string): Promise<Img> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const img = createImage(info.width, info.height, 3)
  for (let i = 0; i < data.length; i++) img.data[i] = data[i] / 255
  return img
}

async function audit() {
  const scores: { index: number; id: string; base: string; rows: number; columns: number }[] = []
  const T = 120, perSheet = 192, cols = 16
  for (let sheet = 0; sheet * perSheet < surfaces.length; sheet++) {
    const tiles: { input: Buffer; left: number; top: number }[] = []
    for (let k = 0; k < perSheet && sheet * perSheet + k < surfaces.length; k++) {
      const index = sheet * perSheet + k, surface = surfaces[index], file = path.join(root, 'public', surface.texture, 'albedo.webp')
      const img = await decode(file)
      scores.push({ index, id: surface.id, base: surface.base, rows: bandScore(img), columns: bandScore(img, true) })
      tiles.push({ input: await sharp(file).resize(T, T).png().toBuffer(), left: (k % cols) * T, top: Math.floor(k / cols) * T })
    }
    await sharp({ create: { width: cols * T, height: Math.ceil(tiles.length / cols) * T, channels: 3, background: '#111' } }).composite(tiles).png().toFile(`/tmp/agent-browser/albedo-all-${sheet + 1}.png`)
  }
  const bases = [...new Set(scores.map((s) => s.base))]
  for (const base of bases) {
    const list = scores.filter((s) => s.base === base), rows = list.map((s) => s.rows).sort((a, b) => a - b), columns = list.map((s) => s.columns).sort((a, b) => a - b)
    console.log(`${base.padEnd(9)} ${String(list.length).padStart(3)} · linhas p50 ${rows[list.length >> 1].toFixed(3)} máx ${rows[list.length - 1].toFixed(3)} · colunas p50 ${columns[list.length >> 1].toFixed(3)} máx ${columns[list.length - 1].toFixed(3)}`)
  }
  const smooth = scores.filter((s) => !['brick', 'wood'].includes(s.base)).sort((a, b) => Math.max(b.rows, b.columns) - Math.max(a.rows, a.columns)).slice(0, 12)
  console.log('piores (sem tijolo/madeira):', smooth.map((s) => `${s.index}:${s.id}:${Math.max(s.rows, s.columns).toFixed(3)}`).join(' | '))
}

async function main() {
if (process.argv.includes('--all')) return audit()
const picks = process.argv.slice(2).map(Number)
const tiles: { input: Buffer; left: number; top: number }[] = [], T = 200
for (const [row, index] of picks.entries()) {
  const surface = surfaces[index], [file, quadrant] = surface.source.split('#')
  const before = await decode(path.join(root, 'public', surface.texture, 'albedo.webp'))
  const source = (await sliceSheet(path.join(root, file), 512))[Number(quadrant)]
  const after = prepareSwatch(source, surface.base as never, surface.seed, before.w).albedo
  const bytes = (img: Img) => Buffer.from(Uint8Array.from(img.data, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255)))
  for (const [col, img] of [before, after].entries()) {

    const raw = await sharp(bytes(img), { raw: { width: img.w, height: img.h, channels: 3 } }).resize(T / 2, T / 2).png().toBuffer()
    for (const [dy, dx] of [[0, 0], [0, 1], [1, 0], [1, 1]]) tiles.push({ input: raw, left: col * (T + 12) + dx * (T / 2), top: row * T + dy * (T / 2) })
  }
  console.log(`${String(index).padStart(3)} ${surface.id.padEnd(36)} faixa linhas ${bandScore(before).toFixed(3)} → ${bandScore(after).toFixed(3)} · colunas ${bandScore(before, true).toFixed(3)} → ${bandScore(after, true).toFixed(3)} · ${surface.label}`)
}
await sharp({ create: { width: 2 * T + 12, height: picks.length * T, channels: 3, background: '#111' } }).composite(tiles).png().toFile('/tmp/agent-browser/band-probe.png')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
