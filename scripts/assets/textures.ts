import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  type Img, blur, cavity, createImage, dilateColor, encodeImage, flatten, luminance, makeSeamless, normalFromHeight,
  normalize, packOrm, readImage, resizeImage, smoothstep, withAlpha,
} from './image'

export type Pbr = { albedo: Img; normal: Img; orm: Img; height: Img }
export type EncodedPbr = { albedo: Buffer; normal: Buffer; orm: Buffer }

export const QUALITY = { albedo: 85, normal: 86, orm: 85 } as const

type Spec = {
  source: string
  crop?: { left: number; top: number; width: number; height: number }
  seamless: boolean
  flatten: number
  normal: number

  rough: [number, number]
  ao: number
  metal?: (r: number, g: number, b: number) => number

  alpha?: (r: number, g: number, b: number, lum: number) => number

  finish?: (set: Pbr) => void
}

const SIZE = 1024

function calibrateMetal(set: Pbr) {
  const { albedo, orm } = set, texels = albedo.w * albedo.h
  let sum = 0, count = 0
  for (let i = 0; i < texels; i++) {
    if (orm.data[i * 3 + 2] < 0.5) continue
    sum += (albedo.data[i * albedo.c] + albedo.data[i * albedo.c + 1] + albedo.data[i * albedo.c + 2]) / 3
    count++
  }
  const gain = count ? 0.8 / (sum / count) : 1
  for (let i = 0; i < texels; i++) {
    const lift = 1 + (gain - 1) * orm.data[i * 3 + 2]
    for (let c = 0; c < 3; c++) albedo.data[i * albedo.c + c] = Math.min(1, albedo.data[i * albedo.c + c] * lift)
  }
}

const litterAlpha = (_r: number, _g: number, _b: number, lum: number) => 0.55 + 0.45 * smoothstep(0.18, 0.42, lum)

export const SPECS: Record<string, Spec> = {
  asphalt: { source: 'asphalt-new.webp', seamless: true, flatten: 0.8, normal: 2.2, rough: [0.78, 0.96], ao: 5 },
  'asphalt-cracked': { source: 'asphalt-cracked.webp', seamless: true, flatten: 0.7, normal: 2.8, rough: [0.88, 0.95], ao: 6 },
  dirt: { source: 'dirt-track.webp', seamless: true, flatten: 0.75, normal: 2.6, rough: [0.97, 0.88], ao: 5 },
  paint: {
    source: 'road-paint.webp', crop: { left: 0, top: 175, width: 640, height: 640 }, seamless: true, flatten: 0.5, normal: 1.6, rough: [0.86, 0.6], ao: 3,
    alpha: (_r, _g, _b, lum) => smoothstep(0.34, 0.5, lum),
  },
  sidewalk: { source: 'sidewalk-slab.webp', crop: { left: 66, top: 60, width: 896, height: 896 }, seamless: true, flatten: 0.8, normal: 1.4, rough: [0.94, 0.84], ao: 4, finish: cutJoints },
  concrete: { source: 'concrete-plain.webp', seamless: true, flatten: 0.8, normal: 1.3, rough: [0.95, 0.85], ao: 4 },
  steel: {
    source: 'galvanized-steel.webp', seamless: true, flatten: 0.6, normal: 0.8, rough: [0.62, 0.42], ao: 2,
    metal: (r, _g, b) => 0.92 * (1 - smoothstep(0.03, 0.12, r - b)), finish: calibrateMetal,
  },
  'leaf-litter': { source: 'leaf-litter.webp', seamless: true, flatten: 0.6, normal: 2.4, rough: [0.92, 0.7], ao: 5, alpha: litterAlpha },
  'pine-needles': { source: 'pine-needles.webp', seamless: true, flatten: 0.6, normal: 2.2, rough: [0.92, 0.72], ao: 5, alpha: litterAlpha },
  rock: { source: 'rock.webp', seamless: true, flatten: 0.85, normal: 2.6, rough: [0.9, 0.72], ao: 4 },
  moss: { source: 'moss.webp', seamless: true, flatten: 0.7, normal: 1.8, rough: [1, 0.86], ao: 3 },
  bark: { source: 'oak-bark-photoreal.webp', seamless: true, flatten: 0.55, normal: 2.4, rough: [0.98, 0.8], ao: 4 },
  'pine-bark': { source: 'pine-bark-photoreal.webp', seamless: true, flatten: 0.55, normal: 2.6, rough: [0.98, 0.78], ao: 4.5 },
  'birch-bark': { source: 'birch-bark-photoreal.webp', seamless: true, flatten: 0.45, normal: 2.0, rough: [0.92, 0.7], ao: 3.5 },
  deadwood: { source: 'deadwood-photoreal.webp', seamless: true, flatten: 0.5, normal: 1.8, rough: [0.95, 0.76], ao: 3.5 },
  soil: { source: 'soil-roots.webp', seamless: true, flatten: 0.7, normal: 2.4, rough: [0.97, 0.8], ao: 5 },
  endgrain: { source: 'endgrain.webp', seamless: false, flatten: 0, normal: 2.2, rough: [0.92, 0.74], ao: 4 },
}

function cutJoints(set: Pbr) {
  const { w, h } = set.albedo
  const half = 5, bevel = 4
  const groove = (x: number, y: number) => {
    const d = Math.min(x, w - 1 - x, y, h - 1 - y)
    return 1 - smoothstep(half, half + bevel, d)
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const g = groove(x, y), i = y * w + x
    for (let c = 0; c < 3; c++) set.albedo.data[i * 3 + c] *= 1 - 0.55 * g
    set.height.data[i] = set.height.data[i] * (1 - g) + (set.height.data[i] * 0.3 - 0.35) * g
    set.orm.data[i * 3] *= 1 - 0.5 * g
    set.orm.data[i * 3 + 1] = Math.min(1, set.orm.data[i * 3 + 1] + 0.08 * g)
  }
  set.normal = normalFromHeight(set.height, 1.4)
}

export async function buildSet(sourceDir: string, spec: Spec, size = SIZE): Promise<Pbr> {
  let albedo = await readImage(path.join(sourceDir, spec.source), { crop: spec.crop, width: size })
  if (spec.seamless) albedo = makeSeamless(albedo)
  if (spec.flatten) albedo = flatten(albedo, spec.flatten)
  const lum = normalize(luminance(albedo))
  const height = blur(lum, 1, spec.seamless)
  const normal = normalFromHeight(height, spec.normal, spec.seamless)
  const ao = cavity(height, 6, spec.ao, spec.seamless)
  const roughness = createImage(albedo.w, albedo.h, 1)
  const metal = spec.metal ? createImage(albedo.w, albedo.h, 1) : undefined
  for (let i = 0; i < albedo.w * albedo.h; i++) {
    roughness.data[i] = spec.rough[0] + (spec.rough[1] - spec.rough[0]) * lum.data[i]
    if (metal && spec.metal) metal.data[i] = spec.metal(albedo.data[i * 3], albedo.data[i * 3 + 1], albedo.data[i * 3 + 2])
  }
  if (metal) for (let i = 0; i < roughness.data.length; i++) roughness.data[i] = roughness.data[i] * metal.data[i] / 0.92 + 0.86 * (1 - metal.data[i] / 0.92)
  const set: Pbr = { albedo, normal, orm: packOrm(ao, roughness, metal), height }
  spec.finish?.(set)
  if (spec.alpha) {
    const mask = createImage(albedo.w, albedo.h, 1)
    for (let i = 0; i < mask.data.length; i++) mask.data[i] = spec.alpha(set.albedo.data[i * 3], set.albedo.data[i * 3 + 1], set.albedo.data[i * 3 + 2], lum.data[i])
    set.albedo = withAlpha(set.albedo, mask)
  }
  return set
}

export async function encodeSet(set: { albedo: Img; normal: Img; orm: Img }): Promise<EncodedPbr> {
  const orm = await resizeImage(set.orm, Math.round(set.orm.w / 2), Math.round(set.orm.h / 2))
  return {
    albedo: await encodeImage(set.albedo, 'webp', QUALITY.albedo),
    normal: await encodeImage(set.normal, 'webp', QUALITY.normal),
    orm: await encodeImage(orm, 'webp', QUALITY.orm),
  }
}

export async function writeSet(outDir: string, encoded: EncodedPbr) {
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, 'albedo.webp'), encoded.albedo)
  await writeFile(path.join(outDir, 'normal.webp'), encoded.normal)
  await writeFile(path.join(outDir, 'orm.webp'), encoded.orm)
}

function keyBlue(image: Img, fine: boolean) {
  const { w, h } = image
  const rgb = createImage(w, h, 3), raw = createImage(w, h, 1)

  const backdrop = [0, 0, 0]
  let samples = 0
  for (let i = 0; i < w * h; i++) {
    const r = image.data[i * 3], g = image.data[i * 3 + 1], b = image.data[i * 3 + 2]
    if (b - Math.max(r, g) > 0.3) { backdrop[0] += r; backdrop[1] += g; backdrop[2] += b; samples++ }
  }
  for (let c = 0; c < 3; c++) backdrop[c] = samples ? backdrop[c] / samples : [0.12, 0.24, 0.94][c]
  for (let i = 0; i < w * h; i++) {
    const r = image.data[i * 3], g = image.data[i * 3 + 1], b = image.data[i * 3 + 2]
    const a = 1 - smoothstep(0.06, 0.22, b - Math.max(r, g))
    raw.data[i] = a

    const coverage = Math.max(a, 0.2)
    const f = [r, g, b].map((v, c) => Math.min(1, Math.max(0, (v - (1 - a) * backdrop[c]) / coverage)))
    rgb.data[i * 3] = f[0]
    rgb.data[i * 3 + 1] = f[1]
    rgb.data[i * 3 + 2] = Math.min(f[2], f[1] * 0.75, f[0] + 0.1)
  }
  const soft = blur(raw, 1, false)
  const alpha = createImage(w, h, 1)
  for (let i = 0; i < w * h; i++) alpha.data[i] = fine ? smoothstep(0.3, 0.66, soft.data[i]) : smoothstep(0.5, 0.86, soft.data[i])
  return { rgb, alpha }
}

function blobs(mask: Uint8Array, w: number, h: number) {
  const label = new Int32Array(w * h).fill(-1)
  const found: { pixels: number[]; cx: number; cy: number }[] = []
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start] >= 0) continue
    const id = found.length, pixels: number[] = [], stack = [start]
    label[start] = id
    let sx = 0, sy = 0
    while (stack.length) {
      const p = stack.pop() as number, x = p % w, y = (p - x) / w
      pixels.push(p); sx += x; sy += y
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && mask[q] && label[q] < 0) { label[q] = id; stack.push(q) }
      }
    }
    found.push({ pixels, cx: sx / pixels.length, cy: sy / pixels.length })
  }
  return found.sort((a, b) => b.pixels.length - a.pixels.length)
}

function foliageSet(rgb: Img, alpha: Img, relief: number, rough: [number, number]): Pbr {
  const { w, h } = rgb
  const albedo = dilateColor(withAlpha(rgb, alpha), 32)
  const lum = normalize(luminance(rgb))
  const height = blur(lum, 1, false)
  for (let i = 0; i < height.data.length; i++) height.data[i] *= alpha.data[i]
  const normal = normalFromHeight(height, relief, false)
  const roughness = createImage(w, h, 1), ao = createImage(w, h, 1)
  for (let i = 0; i < w * h; i++) {
    roughness.data[i] = rough[0] + (rough[1] - rough[0]) * lum.data[i]
    ao.data[i] = 0.82 + 0.18 * lum.data[i]
  }
  return { albedo, normal, orm: packOrm(ao, roughness), height }
}

export type CardRect = {

  u0: number; v0: number; u1: number; v1: number

  stem: number

  aspect: number

  rows: { left: number; right: number }[]

  profile: { t: number; left: number; right: number }[]
}

export function profileReach(card: CardRect, t: number, ts: number[], side: 'left' | 'right') {
  const index = ts.indexOf(t)
  const lo = index > 0 ? ts[index - 1] : t, hi = index < ts.length - 1 ? ts[index + 1] : t
  let reach = 0
  for (const row of card.profile) if (row.t >= lo - 1e-6 && row.t <= hi + 1e-6) reach = Math.max(reach, row[side])
  return reach
}

export function combineAtlases(atlases: { set: Pbr; cards: CardRect[] }[]) {
  const join = (images: Img[]) => {
    const { h, c } = images[0], w = images.reduce((sum, image) => sum + image.w, 0)
    const out = createImage(w, h, c)
    let x0 = 0
    for (const image of images) {
      if (image.h !== h || image.c !== c) throw new Error('Atlas com dimensões diferentes não podem ser combinados.')
      for (let y = 0; y < h; y++) out.data.set(image.data.subarray(y * image.w * c, (y + 1) * image.w * c), (y * w + x0) * c)
      x0 += image.w
    }
    return out
  }
  const n = atlases.length
  const set: Pbr = {
    albedo: join(atlases.map((a) => a.set.albedo)), normal: join(atlases.map((a) => a.set.normal)),
    orm: join(atlases.map((a) => a.set.orm)), height: join(atlases.map((a) => a.set.height)),
  }
  const cards = atlases.flatMap((atlas, i) => atlas.cards.map((card) => ({ ...card, u0: (i + card.u0) / n, u1: (i + card.u1) / n, stem: (i + card.stem) / n })))
  return { set, cards }
}

function fitOutline(reach: number[]) {
  const n = reach.length, at = (i: number) => i / (n - 1)
  const peak = Math.max(...reach)
  let best = { w0: peak, w1: peak, w2: peak, area: Infinity }
  for (let k = 50; k <= 100; k += 2) {
    const w1 = Math.max(peak * k / 100, ...reach.filter((_, i) => Math.abs(at(i) - 0.5) < 0.04))
    let w0 = reach[0], w2 = reach[n - 1]
    for (let i = 0; i < n; i++) {
      const t = at(i)
      if (t < 0.5) w0 = Math.max(w0, (reach[i] - w1 * (t / 0.5)) / (1 - t / 0.5))
      else if (t > 0.5) w2 = Math.max(w2, (reach[i] - w1 * ((1 - t) / 0.5)) / (1 - (1 - t) / 0.5))
    }
    const area = w0 + 2 * w1 + w2
    if (area < best.area) best = { w0, w1, w2, area }
  }
  return [best.w0, best.w1, best.w2].map((v) => v * 1.04 + 0.01)
}

export async function buildCardAtlas(sourceDir: string, file: string, count: number, fine: boolean) {
  const image = await readImage(path.join(sourceDir, file), { width: SIZE })
  const { w, h } = image
  const { rgb, alpha } = keyBlue(image, fine)

  const grouped = blur(alpha, 5, false)
  const mask = Uint8Array.from(grouped.data, (v) => (v > 0.08 ? 1 : 0))
  const sprays = blobs(mask, w, h).slice(0, count)
  if (sprays.length < count) throw new Error(`${file}: esperava ${count} ramos, encontrei ${sprays.length}.`)
  sprays.sort((a, b) => (Math.abs(a.cy - b.cy) > h * 0.15 ? a.cy - b.cy : a.cx - b.cx))
  const cards: CardRect[] = sprays.map(({ pixels }) => {
    let minX = w, maxX = 0, minY = h, maxY = 0
    const own = pixels.filter((p) => alpha.data[p] > 0.5)
    for (const p of own) { const x = p % w, y = (p - x) / w; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
    const foot = own.filter((p) => Math.floor(p / w) >= maxY - 3)
    const stemX = foot.reduce((sum, p) => sum + (p % w), 0) / foot.length + 0.5
    const pad = 3
    const x0 = minX - pad, x1 = maxX + 1 + pad, y0 = minY - pad, y1 = maxY + 1 + pad
    const width = x1 - x0, rows = 48
    const left = new Array(rows).fill(0), right = new Array(rows).fill(0)
    for (const p of own) {
      const x = p % w + 0.5, y = Math.floor(p / w) + 0.5
      const i = Math.min(rows - 1, Math.max(0, Math.round(((y1 - y) / (y1 - y0)) * (rows - 1))))
      left[i] = Math.max(left[i], (stemX - x + 1) / width)
      right[i] = Math.max(right[i], (x + 1 - stemX) / width)
    }
    const l = fitOutline(left), r = fitOutline(right)
    const band = (reach: number[], t: number) => {
      let peak = 0
      for (let i = 0; i < rows; i++) if (Math.abs(i / (rows - 1) - t) <= 1 / 12 + 1e-6) peak = Math.max(peak, reach[i])
      return peak * 1.04 + 0.01
    }
    return {
      u0: x0 / w, v0: y0 / h, u1: x1 / w, v1: y1 / h, stem: stemX / w, aspect: width / (y1 - y0),
      rows: [0, 1, 2].map((k) => ({ left: Math.min(l[k], (stemX - x0) / width), right: Math.min(r[k], (x1 - stemX) / width) })),
      profile: Array.from({ length: 13 }, (_, k) => {
        const t = k / 12
        return { t, left: Math.min(band(left, t), (stemX - x0) / width), right: Math.min(band(right, t), (x1 - stemX) / width) }
      }),
    }
  })
  return { set: foliageSet(rgb, alpha, fine ? 0.9 : 1.2, fine ? [0.74, 0.62] : [0.72, 0.58]), cards }
}

export type BladeShape = {

  u0: number; u1: number; base: number; tip: number

  profile: { t: number; center: number; half: number }[]

  dry: boolean
}

export async function buildBladeAtlas(sourceDir: string, file: string, count: number) {
  const image = await readImage(path.join(sourceDir, file), { width: SIZE })
  const { w, h } = image
  const { rgb, alpha } = keyBlue(image, true)
  const mask = Uint8Array.from(blur(alpha, 2, false).data, (v) => (v > 0.12 ? 1 : 0))
  const found = blobs(mask, w, h).slice(0, count).sort((a, b) => a.cx - b.cx)
  if (found.length < count) throw new Error(`${file}: esperava ${count} lâminas, encontrei ${found.length}.`)
  const blades: BladeShape[] = found.map(({ pixels }) => {
    const own = pixels.filter((p) => alpha.data[p] > 0.5)
    let minX = w, maxX = 0, minY = h, maxY = 0, red = 0, green = 0
    const left = new Map<number, number>(), right = new Map<number, number>()
    for (const p of own) {
      const x = p % w, y = (p - x) / w
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      left.set(y, Math.min(left.get(y) ?? w, x)); right.set(y, Math.max(right.get(y) ?? 0, x + 1))
      red += rgb.data[p * 3]; green += rgb.data[p * 3 + 1]
    }
    const stations = 9
    const profile = Array.from({ length: stations }, (_, k) => {
      const t = k / (stations - 1)
      const yc = Math.round(maxY - t * (maxY - minY))
      let lo = w, hi = 0
      for (let y = yc - 4; y <= yc + 4; y++) if (left.has(y)) { lo = Math.min(lo, left.get(y) as number); hi = Math.max(hi, right.get(y) as number) }
      if (hi <= lo) { lo = (minX + maxX) / 2 - 1; hi = lo + 2 }
      return { t, center: (lo + hi) / 2 / w, half: ((hi - lo) / 2 + 1.5) / w }
    })
    return { u0: (minX - 2) / w, u1: (maxX + 3) / w, base: (maxY + 1) / h, tip: (minY - 1) / h, profile, dry: red > green * 0.93 }
  })
  return { set: foliageSet(rgb, alpha, 0.8, [0.66, 0.5]), blades }
}

export type LeafRect = { u0: number; v0: number; u1: number; v1: number }

export async function buildLeafAtlas(sourceDir: string) {
  const image = await readImage(path.join(sourceDir, 'leaves-atlas.webp'), { width: SIZE })
  const { w, h } = image
  const alpha = createImage(w, h, 1)
  const rgb = createImage(w, h, 3)
  for (let i = 0; i < w * h; i++) {
    const r = image.data[i * 3], g = image.data[i * 3 + 1], b = image.data[i * 3 + 2]
    const key = g - Math.max(r, b)
    alpha.data[i] = 1 - smoothstep(0.08, 0.24, key)
    rgb.data[i * 3] = r
    rgb.data[i * 3 + 1] = Math.min(g, Math.max(r, b) * 1.02)
    rgb.data[i * 3 + 2] = b
  }

  const soft = blur(alpha, 1, false)
  for (let i = 0; i < alpha.data.length; i++) alpha.data[i] = smoothstep(0.55, 0.9, soft.data[i])
  const rects: LeafRect[] = []
  for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    let minX = w, minY = h, maxX = 0, maxY = 0
    for (let y = qy * h / 2; y < (qy + 1) * h / 2; y++) for (let x = qx * w / 2; x < (qx + 1) * w / 2; x++) {
      if (alpha.data[y * w + x] < 0.5) continue
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    if (maxX <= minX || maxY <= minY) throw new Error(`Folha ${rects.length} não encontrada no atlas.`)
    const pad = 3
    rects.push({ u0: (minX - pad) / w, v0: (minY - pad) / h, u1: (maxX + 1 + pad) / w, v1: (maxY + 1 + pad) / h })
  }
  const albedo = dilateColor(withAlpha(rgb, alpha), 24)
  const lum = normalize(luminance(rgb))
  const height = blur(lum, 1, false)
  for (let i = 0; i < height.data.length; i++) height.data[i] *= alpha.data[i]
  const normal = normalFromHeight(height, 1.1, false)
  const roughness = createImage(w, h, 1), ao = createImage(w, h, 1)
  for (let i = 0; i < w * h; i++) { roughness.data[i] = 0.78 - 0.14 * lum.data[i]; ao.data[i] = 1 }
  const set: Pbr = { albedo, normal, orm: packOrm(ao, roughness), height }
  return { set, rects }
}
