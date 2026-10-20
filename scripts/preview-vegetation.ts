import path from 'node:path'
import { GRASSES, KIT_MATERIALS, TREES, type TreeSpec } from '../lib/game/assets/catalog'
import { tree, grass, bendCrown, bendNormals } from './assets/vegetation'
import { finishVegetation } from './assets/finish-vegetation'
import { type Model, type Vec3, normalize, dot } from './assets/mesh'
import { buildCardAtlas, buildSet, combineAtlases, SPECS, type CardRect, type Pbr } from './assets/textures'
import { createImage, encodeImage, type Img } from './assets/image'
import { writeFile } from 'node:fs/promises'

async function main() {
  const source = path.join(process.cwd(), 'assets-src', 'textures')
  const names = (process.argv.find((a) => a.startsWith('--names='))?.slice(8) ?? 'oak_mature').split(',')
  const lod = process.argv.includes('--lod1') ? 1 : 0
  const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? '/tmp/agent-browser/vegetation-preview.png'
  const [oak, maple, birch, pine, spruce, tufts, ferns] = await Promise.all([
    buildCardAtlas(source, 'foliage-oak-dense.webp', 4, false), buildCardAtlas(source, 'foliage-maple-dense.webp', 4, false),
    buildCardAtlas(source, 'foliage-birch.webp', 4, false), buildCardAtlas(source, 'foliage-pine-dense.webp', 4, true),
    buildCardAtlas(source, 'foliage-spruce.webp', 4, true), buildCardAtlas(source, 'grass-tufts.webp', 4, true), buildCardAtlas(source, 'fern-fronds.webp', 4, false),
  ])
  const broadleaf = combineAtlases([oak, maple, birch]), conifer = combineAtlases([pine, spruce]), ground = combineAtlases([tufts, ferns])
  const cardsOf = (spec: TreeSpec): CardRect[] => ({ oak: broadleaf.cards.slice(0, 4), maple: broadleaf.cards.slice(4, 8), birch: broadleaf.cards.slice(8, 12), pine: conifer.cards.slice(0, 4), spruce: conifer.cards.slice(4, 8) } as Record<string, CardRect[]>)[spec.foliage ?? ''] ?? []
  const sets: Record<string, Pbr> = { 'foliage-broadleaf': broadleaf.set, 'foliage-pine': conifer.set, grass: ground.set }
  for (const name of ['bark', 'pine-bark', 'birch-bark', 'deadwood', 'endgrain']) sets[name] = await buildSet(source, SPECS[name], 256)
  const models: Model[] = names.map((name) => {
    const t = TREES.find((s) => s.name === name)
    if (t) { const m = finishVegetation(tree(t, cardsOf(t), lod)); bendCrown(m); return m }
    const g = GRASSES.find((s) => s.name === name)!
    const m = finishVegetation(grass(g, ground.cards, lod)); bendNormals(m, 'grass', () => [0, 1, 0], 1.4); return m
  })
  const ppm = Number(process.argv.find((a) => a.startsWith('--ppm='))?.slice(6) ?? 24)
  const frames = models.map((m) => { const b = m.bounds(); return { b, w: Math.ceil((b.max[0] - b.min[0]) * ppm) + 20, h: Math.ceil((b.max[1] - Math.min(0, b.min[1])) * ppm) + 20 } })
  const W = frames.reduce((s, f) => s + f.w, 0), Hh = Math.max(...frames.map((f) => f.h))
  const img: Img = createImage(W, Hh, 3)
  for (let i = 0; i < W * Hh; i++) img.data.set([0.78, 0.84, 0.9], i * 3)
  const depth = new Float32Array(W * Hh).fill(-Infinity)
  const light = normalize([0.4, 0.8, 0.45])
  const wrap = (v: number) => v - Math.floor(v)
  const sample = (t: Img, u: number, v: number, c: number) => t.data[(Math.min(t.h - 1, Math.floor(wrap(1 - v) * t.h)) * t.w + Math.min(t.w - 1, Math.floor(wrap(u) * t.w))) * t.c + c]
  let x0 = 0
  models.forEach((model, mi) => {
    const { b, w } = frames[mi]
    const project = (p: Vec3) => [x0 + 10 + (p[0] - b.min[0]) * ppm, Hh - 10 - (p[1] - Math.min(0, b.min[1])) * ppm, p[2]]
    for (const [material, part] of model.parts) {
      const tex = sets[KIT_MATERIALS[material as keyof typeof KIT_MATERIALS]]
      for (let o = 0; o < part.indices.length; o += 3) {
        const ids = part.indices.slice(o, o + 3), [a, bb, c] = ids.map((id) => project(part.position(id)))
        const area = (bb[1] - c[1]) * (a[0] - c[0]) + (c[0] - bb[0]) * (a[1] - c[1])
        if (Math.abs(area) < 1e-9) continue
        for (let y = Math.max(0, Math.floor(Math.min(a[1], bb[1], c[1]))); y <= Math.min(Hh - 1, Math.ceil(Math.max(a[1], bb[1], c[1]))); y++)
          for (let x = Math.max(x0, Math.floor(Math.min(a[0], bb[0], c[0]))); x <= Math.min(x0 + w - 1, Math.ceil(Math.max(a[0], bb[0], c[0]))); x++) {
            const s = ((bb[1] - c[1]) * (x + 0.5 - c[0]) + (c[0] - bb[0]) * (y + 0.5 - c[1])) / area
            const t = ((c[1] - a[1]) * (x + 0.5 - c[0]) + (a[0] - c[0]) * (y + 0.5 - c[1])) / area, r = 1 - s - t
            if (s < 0 || t < 0 || r < 0) continue
            const z = s * a[2] + t * bb[2] + r * c[2], px = y * W + x
            if (z <= depth[px]) continue
            const wts = [s, t, r]
            const u = ids.reduce((sum, id, k) => sum + part.uvs[id * 2] * wts[k], 0), v = ids.reduce((sum, id, k) => sum + part.uvs[id * 2 + 1] * wts[k], 0)
            if (tex.albedo.c === 4 && sample(tex.albedo, u, v, 3) < 0.5) continue
            depth[px] = z
            const n = normalize([0, 1, 2].map((ch) => ids.reduce((sum, id, k) => sum + part.normals[id * 3 + ch] * wts[k], 0)) as Vec3)
            const shade = 0.35 + 0.75 * Math.max(0, dot(n, light))
            for (let ch = 0; ch < 3; ch++) img.data[px * 3 + ch] = Math.min(1, sample(tex.albedo, u, v, ch) * shade)
          }
      }
    }
    x0 += w
  })
  await writeFile(out, await encodeImage(img, 'png'))
  console.log(`preview ${W}×${Hh} → ${out}`)
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
