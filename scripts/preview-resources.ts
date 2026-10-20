import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { sculptData } from '../lib/game/blockout/sculpt'
import type { MaterialKey } from '../lib/game/blockout/types'
import { RESOURCES } from '../lib/game/resources/catalog'
import { RESOURCE_SCULPTORS, resourceAssetId } from '../lib/game/resources/sculpts'

const args = process.argv.slice(2)
const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const cell = Number(value('cell') ?? 220), cols = Number(value('cols') ?? 6)
const out = value('out') ?? '/tmp/previews/resources.png'
const ids = value('ids')?.split(',') ?? RESOURCES.filter((r) => RESOURCE_SCULPTORS[r.id] && (!value('category') || r.category === value('category'))).map((r) => r.id)

const ALBEDO: Record<MaterialKey, [number, number, number]> = {
  steel: [0.56, 0.57, 0.6], paint: [0.72, 0.7, 0.66], tile: [0.9, 0.89, 0.86], glass: [0.5, 0.58, 0.6], rubber: [0.2, 0.2, 0.2], fabric: [0.7, 0.67, 0.6], leather: [0.38, 0.27, 0.19],
  wood: [0.55, 0.41, 0.27], charcoal: [0.16, 0.15, 0.14], straw: [0.78, 0.66, 0.42], paper: [0.85, 0.81, 0.73], concrete: [0.64, 0.62, 0.58], plaster: [0.85, 0.82, 0.76], brick: [0.6, 0.35, 0.25],
}

function render(id: string) {
  const data = sculptData(resourceAssetId(id))
  const img = new Float32Array(cell * cell * 3).fill(0.16), depth = new Float32Array(cell * cell).fill(Infinity)
  if (!data) return { img, tris: 0 }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const b of data) for (let i = 0; i < b.position.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], b.position[i + a]); max[a] = Math.max(max[a], b.position[i + a]) }
  const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 0.1

  const f = norm([-0.62, -0.52, -0.78]), r = norm(cross(f, [0, 1, 0])), u = cross(r, f)
  const scale = cell * 0.46 / radius, light = norm([0.45, 0.85, 0.35]), fill = norm([-0.6, 0.3, -0.4])
  let tris = 0
  for (const b of data) {
    const albedo = ALBEDO[b.material], P = b.position, N = b.normal, C = b.color, I = b.index
    tris += I.length / 3
    const sx = new Float32Array(P.length / 3), sy = new Float32Array(P.length / 3), sz = new Float32Array(P.length / 3), shade = new Float32Array(P.length)
    for (let v = 0; v < P.length / 3; v++) {
      const p = [P[v * 3] - c[0], P[v * 3 + 1] - c[1], P[v * 3 + 2] - c[2]]
      sx[v] = cell / 2 + dot(p, r) * scale; sy[v] = cell / 2 - dot(p, u) * scale; sz[v] = dot(p, f)
      const n = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]]
      const lambert = Math.max(0, dot(n, light)) * 0.85 + Math.max(0, dot(n, fill)) * 0.25 + 0.22 + 0.12 * n[1]
      for (let k = 0; k < 3; k++) shade[v * 3 + k] = albedo[k] * C[v * 3 + k] * lambert
    }
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], bb = I[t + 1], cc = I[t + 2]
      const area = (sx[bb] - sx[a]) * (sy[cc] - sy[a]) - (sx[cc] - sx[a]) * (sy[bb] - sy[a])
      if (Math.abs(area) < 1e-9) continue
      const x0 = Math.max(0, Math.floor(Math.min(sx[a], sx[bb], sx[cc]))), x1 = Math.min(cell - 1, Math.ceil(Math.max(sx[a], sx[bb], sx[cc])))
      const y0 = Math.max(0, Math.floor(Math.min(sy[a], sy[bb], sy[cc]))), y1 = Math.min(cell - 1, Math.ceil(Math.max(sy[a], sy[bb], sy[cc])))
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5
        const w0 = ((sx[bb] - px) * (sy[cc] - py) - (sx[cc] - px) * (sy[bb] - py)) / area
        const w1 = ((sx[cc] - px) * (sy[a] - py) - (sx[a] - px) * (sy[cc] - py)) / area
        const w2 = 1 - w0 - w1
        if (w0 < 0 || w1 < 0 || w2 < 0) continue
        const z = w0 * sz[a] + w1 * sz[bb] + w2 * sz[cc], o = y * cell + x
        if (z >= depth[o]) continue
        depth[o] = z
        for (let k = 0; k < 3; k++) img[o * 3 + k] = w0 * shade[a * 3 + k] + w1 * shade[bb * 3 + k] + w2 * shade[cc * 3 + k]
      }
    }
  }
  return { img, tris }
}

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: number[]) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l] }

async function main() {
  const rows = Math.ceil(ids.length / cols), W = cols * cell, H = rows * (cell + 18)
  const sheet = Buffer.alloc(W * H * 3, 30)
  const labels: string[] = []
  ids.forEach((id, i) => {
    const { img, tris } = render(id), ox = (i % cols) * cell, oy = Math.floor(i / cols) * (cell + 18)
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) for (let k = 0; k < 3; k++) sheet[((oy + y) * W + ox + x) * 3 + k] = Math.round(255 * Math.min(1, Math.max(0, img[(y * cell + x) * 3 + k])) ** (1 / 2.2))
    labels.push(`<text x="${ox + 4}" y="${oy + cell + 13}" font-family="sans-serif" font-size="12" fill="#ddd">${id} · ${tris}</text>`)
  })
  await mkdir(path.dirname(out), { recursive: true })
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${labels.join('')}</svg>`)
  await sharp(sheet, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: svg }]).png().toFile(out)
  console.log(`${ids.length} recursos → ${out}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
