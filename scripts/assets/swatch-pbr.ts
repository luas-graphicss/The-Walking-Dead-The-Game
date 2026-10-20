import sharp from 'sharp'
import {
  type Img, cavity, blur, createImage, delight, encodeImage, flatten, luminance, makeTileable, makeTileableVertical,
  normalFromHeight, normalize, readImage, resizeImage, sampleWrap, smoothstep,
} from './image'
import { BRICK_LAYOUT, WOOD_COLUMNS } from '../../lib/game/blockout/relief-geometry'
import { random, type MaterialKey } from '../../lib/game/blockout/types'
import type { Finish } from './swatch-catalog'

export type SwatchMaps = { albedo: Img; height: Img; ao: Img; roughness: Img; metal: Img }

const ROUGH: Record<MaterialKey, [number, number]> = { concrete: [0.97, 0.82], plaster: [0.96, 0.82], brick: [0.97, 0.8], wood: [0.88, 0.62], steel: [0.6, 0.32], tile: [0.42, 0.16], fabric: [0.98, 0.84], paint: [0.78, 0.44], charcoal: [1, 0.9], rubber: [0.92, 0.66], leather: [0.8, 0.46], straw: [1, 0.88], paper: [0.95, 0.79], glass: [0.32, 0.12] }
const PAINTED: [number, number] = [0.8, 0.42]
export const RELIEF: Record<MaterialKey, number> = { concrete: 1.6, plaster: 1.3, brick: 2.4, wood: 1.7, steel: 0.8, tile: 0.5, fabric: 1.6, paint: 1, charcoal: 2, rubber: 0.8, leather: 1.1, straw: 2.1, paper: 0.55, glass: 0.35 }
const AO: Record<MaterialKey, number> = { concrete: 2.4, plaster: 2.1, brick: 3.2, wood: 2.5, steel: 1.2, tile: 1.1, fabric: 1.8, paint: 1.4, charcoal: 2.8, rubber: 1.5, leather: 1.7, straw: 2.8, paper: 1.1, glass: 0.6 }

function crop(img: Img, x0: number, y0: number, x1: number, y1: number) {
  const w = x1 - x0, h = y1 - y0, out = createImage(w, h, img.c)
  for (let y = 0; y < h; y++) out.data.set(img.data.subarray(((y0 + y) * img.w + x0) * img.c, ((y0 + y) * img.w + x1) * img.c), y * w * img.c)
  return out
}

function gutter(lum: Img, vertical: boolean): [number, number] {
  const n = vertical ? lum.w : lum.h, m = vertical ? lum.h : lum.w, flat: number[] = []
  for (let k = Math.round(n * 0.44); k <= Math.round(n * 0.56); k++) {
    let sum = 0, sq = 0, count = 0
    for (let j = 0; j < m; j += 3) { const v = vertical ? lum.data[j * lum.w + k] : lum.data[k * lum.w + j]; sum += v; sq += v * v; count++ }
    const mean = sum / count
    if (mean > 0.82 && Math.sqrt(Math.max(0, sq / count - mean * mean)) < 0.06) flat.push(k)
  }
  const mid = Math.round(n / 2)
  if (!flat.length || flat[flat.length - 1] - flat[0] > n * 0.05) return [mid - 10, mid + 10]
  return [Math.min(mid - 4, flat[0] - 4), Math.max(mid + 4, flat[flat.length - 1] + 5)]
}

function backdrop(sheet: Img) {
  const ring = 5, channels: number[][] = [[], [], []]
  for (let y = 0; y < sheet.h; y += 2) for (let x = 0; x < sheet.w; x += 2) {
    if (x >= ring && x < sheet.w - ring && y >= ring && y < sheet.h - ring) continue
    for (let ch = 0; ch < 3; ch++) channels[ch].push(sheet.data[(y * sheet.w + x) * sheet.c + ch])
  }
  const median = channels.map((values) => values.sort((a, b) => a - b)[values.length >> 1])
  const near = channels[0].filter((_, i) => channels.every((values, ch) => Math.abs(values[i] - median[ch]) < 0.06)).length
  return near > channels[0].length * 0.8 ? median : null
}

function swatchBounds(img: Img, color: number[] | null): [number, number, number, number] {
  if (!color) return [0, 0, img.w, img.h]
  const { w, h, c } = img, columns = new Float32Array(w), rows = new Float32Array(h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c
    if (Math.abs(img.data[i] - color[0]) + Math.abs(img.data[i + 1] - color[1]) + Math.abs(img.data[i + 2] - color[2]) < 0.12) { columns[x]++; rows[y]++ }
  }
  const limitX = Math.round(w * 0.16), limitY = Math.round(h * 0.16)
  let left = 0, right = w, top = 0, bottom = h
  while (left < limitX && columns[left] > h * 0.4) left++
  while (w - right < limitX && columns[right - 1] > h * 0.4) right--
  while (top < limitY && rows[top] > w * 0.4) top++
  while (h - bottom < limitY && rows[bottom - 1] > w * 0.4) bottom--
  const insetX = Math.round(w * 0.012), insetY = Math.round(h * 0.012)
  return [left ? left + insetX : 0, top ? top + insetY : 0, right < w ? right - insetX : w, bottom < h ? bottom - insetY : h]
}

export async function sliceSheet(file: string, size: number) {
  const sheet = await readImage(file), lum = luminance(sheet), edge = 6, color = backdrop(sheet)
  const [x0, x1] = gutter(lum, true), [y0, y1] = gutter(lum, false)
  const boxes = [[edge, edge, x0, y0], [x1, edge, sheet.w - edge, y0], [edge, y1, x0, sheet.h - edge], [x1, y1, sheet.w - edge, sheet.h - edge]]
  return Promise.all(boxes.map(([a, b, c, d]) => {
    const quadrant = crop(sheet, a, b, c, d), [l, t, r, q] = swatchBounds(quadrant, color)
    return resizeImage(crop(quadrant, l, t, r, q), size, size)
  }))
}

function periodicNoise(x: number, y: number, period: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi
  const at = (a: number, b: number) => {
    let n = Math.imul(((a % period) + period) % period, 374761393) + Math.imul(((b % period) + period) % period, 668265263) + Math.imul(seed, 1442695041)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty), a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function plankEdges(img: Img) {
  const { w, h } = img, lum = luminance(img), profile = new Float32Array(w), contrast = new Float32Array(w)
  for (let x = 0; x < w; x++) { let sum = 0; for (let y = 0; y < h; y++) sum += lum.data[y * w + x]; profile[x] = sum / h }
  for (let x = 0; x < w; x++) {
    let sum = 0, count = 0
    for (let k = -20; k <= 20; k++) if (x + k >= 0 && x + k < w) { sum += profile[x + k]; count++ }
    contrast[x] = sum / count - profile[x]
  }

  const peaks = [...contrast.keys()].filter((x) => x > w * 0.12 && x < w * 0.88 && contrast[x] > 0.03 && contrast[x] >= contrast[x - 1] && contrast[x] >= contrast[x + 1]).sort((a, b) => contrast[b] - contrast[a])
  const seams: number[] = [], spacing = w / (WOOD_COLUMNS + 2)
  for (const x of peaks) if (seams.length < WOOD_COLUMNS - 1 && seams.every((s) => Math.abs(s - x) > spacing)) seams.push(x)
  const found = seams.length === WOOD_COLUMNS - 1
  return { found, edges: found ? [0, ...seams.sort((a, b) => a - b), w] : Array.from({ length: WOOD_COLUMNS + 1 }, (_, i) => Math.round(i * w / WOOD_COLUMNS)) }
}

export function columnizeWood(source: Img, seed: number, size: number) {
  const { w, h, c } = source, { edges, found } = plankEdges(source), lane = size / WOOD_COLUMNS
  const strips = createImage(size, h, c)
  for (let j = 0; j < WOOD_COLUMNS; j++) {
    const a = edges[j] + (found && j > 0 ? 5 : 0), b = edges[j + 1] - (found && j < WOOD_COLUMNS - 1 ? 5 : 0)
    for (let x = Math.round(j * lane); x < Math.round((j + 1) * lane); x++) {
      const sx = a + (x - j * lane + 0.5) / lane * (b - a - 1), x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(w - 1, x0 + 1), t = sx - x0
      for (let y = 0; y < h; y++) for (let ch = 0; ch < c; ch++) strips.data[(y * size + x) * c + ch] = source.data[(y * w + x0) * c + ch] * (1 - t) + source.data[(y * w + x1) * c + ch] * t
    }
  }
  const tiled = makeTileableVertical(strips, size), out = createImage(size, size, c), rng = random(seed)
  for (let j = 0; j < WOOD_COLUMNS; j++) {
    const roll = Math.floor(rng() * size)
    for (let x = Math.round(j * lane); x < Math.round((j + 1) * lane); x++) {
      const d = Math.min((x + 0.5) % lane, lane - ((x + 0.5) % lane)), groove = 0.42 + 0.58 * smoothstep(0, 2.6 * size / 512, d)
      for (let y = 0; y < size; y++) for (let ch = 0; ch < c; ch++) out.data[(y * size + x) * c + ch] = tiled.data[(((y + roll) % size) * size + x) * c + ch] * groove
    }
  }
  return out
}

export function composeBrick(face: Img, size: number, seed: number) {
  const { length: L, course: H, joint: J, perTileU: NU, perTileV: NV } = BRICK_LAYOUT
  const TU = L * NU, TV = H * NV, rng = random(seed), cells = 96, window = face.w * 0.62
  const lum = normalize(luminance(face)), rgb = [0, 0, 0], one = [0]
  const bricks = Array.from({ length: NU * NV }, () => ({ ox: rng() * face.w, oy: rng() * face.h, tone: 0.84 + rng() * 0.28, warm: (rng() - 0.5) * 0.09, burnt: rng() < 0.16 }))
  const mortar = 0.46 + rng() * 0.2, warmth = 0.02 + rng() * 0.05
  const albedo = createImage(size, size, 3), height = createImage(size, size, 1)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const U = (x + 0.5) / size * TU, V = (1 - (y + 0.5) / size) * TV
    const k = Math.min(NV - 1, Math.floor(V / H)), shift = (k & 1) * L / 2
    const uu = (((U - shift) % TU) + TU) % TU, i = Math.min(NU - 1, Math.floor(uu / L)), du = uu - i * L, dv = V - k * H
    const nx = x / size * cells, ny = y / size * cells
    const edge = Math.min(du - J / 2, L - J / 2 - du, dv - J / 2, H - J / 2 - dv) + (periodicNoise(nx, ny, cells, seed) - 0.5) * 0.0016
    const inside = smoothstep(-0.0004, 0.0004, edge), brick = bricks[k * NU + i]
    const su = brick.ox + du / L * window, sv = brick.oy + (H - dv) / L * window
    sampleWrap(face, su, sv, rgb); sampleWrap(lum, su, sv, one)
    const tone = brick.tone * (0.86 + 0.14 * smoothstep(0, 0.007, edge)) * (brick.burnt ? 0.8 : 1)
    const grit = 0.9 + 0.2 * periodicNoise(nx * 2, ny * 2, cells * 2, seed + 7), p = y * size + x
    albedo.data[p * 3] = mortar * (1 + warmth) * grit * (1 - inside) + rgb[0] * tone * (1 + brick.warm) * inside
    albedo.data[p * 3 + 1] = mortar * grit * (1 - inside) + rgb[1] * tone * inside
    albedo.data[p * 3 + 2] = mortar * (1 - warmth) * grit * (1 - inside) + rgb[2] * tone * (1 - brick.warm) * inside
    height.data[p] = (0.08 + 0.08 * grit) * (1 - inside) + (0.58 + 0.32 * one[0]) * (0.72 + 0.28 * smoothstep(0, 0.003, edge)) * inside
  }
  return { albedo, height }
}

export const sourceSize = (size: number) => Math.round(size * 1.22)

export function prepareSwatch(img: Img, base: MaterialKey, seed: number, size: number): { albedo: Img; height?: Img } {
  const lit = delight(img)
  if (base === 'wood') return { albedo: columnizeWood(flatten(lit, 0.3), seed, size) }
  if (base === 'brick') return composeBrick(makeTileable(lit, size), size, seed)

  if (base === 'steel' || base === 'paint') return { albedo: flatten(makeTileable(flatten(lit, 0.85, false, img.w / 14), size), 0.25) }
  return { albedo: flatten(makeTileable(lit, size), 0.4) }
}

export function deriveMaps(albedo: Img, base: MaterialKey, finish: Finish | undefined, height?: Img): SwatchMaps {
  const texels = albedo.w * albedo.h, lum = normalize(luminance(albedo)), relief = height ?? blur(lum, 1)
  const ao = cavity(relief, Math.max(3, Math.round(albedo.w / 128)), AO[base])
  const roughness = createImage(albedo.w, albedo.h, 1), metal = createImage(albedo.w, albedo.h, 1)
  const metallic = base === 'steel' || base === 'paint', kind = metallic ? finish ?? 'r' : 'p', range = metallic && kind === 'p' ? PAINTED : ROUGH[base]
  let sum = 0, weight = 0
  for (let i = 0; i < texels; i++) {
    const r = albedo.data[i * 3], g = albedo.data[i * 3 + 1], b = albedo.data[i * 3 + 2]
    const m = !metallic || kind === 'p' ? 0 : kind === 'm' ? 0.95 * smoothstep(0.05, 0.2, (r + g + b) / 3) * (1 - smoothstep(0.02, 0.09, g - r)) : 0.92 * (1 - smoothstep(0.03, 0.12, r - b))
    const rough = range[0] + (range[1] - range[0]) * lum.data[i]
    metal.data[i] = m
    roughness.data[i] = Math.max(0.12, Math.min(1, kind === 'r' && metallic ? rough * m / 0.92 + 0.88 * (1 - m / 0.92) : rough))
    sum += (r + g + b) / 3 * m; weight += m
  }

  const gain = weight > texels * 0.02 ? Math.min(1.5, Math.max(1, 0.7 / (sum / weight))) : 1
  if (gain > 1) for (let i = 0; i < texels; i++) for (let c = 0; c < 3; c++) albedo.data[i * 3 + c] = Math.min(1, albedo.data[i * 3 + c] * (1 + (gain - 1) * metal.data[i]))
  return { albedo, height: relief, ao, roughness, metal }
}

async function lossless(img: Img) {
  return sharp(await encodeImage(img, 'png')).webp({ lossless: true, effort: 5 }).toBuffer()
}

export async function encodeModuleSet(maps: SwatchMaps, base: MaterialKey) {
  const [height, ao, rough, metal] = await Promise.all([maps.height, maps.ao, maps.roughness, maps.metal].map((img) => resizeImage(img, 256, 256)))
  const ormh = createImage(256, 256, 4)
  for (let p = 0; p < 256 * 256; p++) ormh.data.set([ao.data[p], Math.max(0.12, rough.data[p]), base === 'steel' || base === 'paint' ? metal.data[p] : 0, Math.min(0.98, Math.max(0.02, height.data[p]))], p * 4)
  return { albedo: await encodeImage(maps.albedo, 'webp', 84), normal: await lossless(normalFromHeight(height, RELIEF[base])), orm: await lossless(ormh) }
}

export async function encodeBaseSet(maps: SwatchMaps, base: MaterialKey) {
  const [ao, rough, metal] = await Promise.all([maps.ao, maps.roughness, maps.metal].map((img) => resizeImage(img, 512, 512)))
  const orm = createImage(512, 512, 3)
  for (let p = 0; p < 512 * 512; p++) orm.data.set([ao.data[p], Math.max(0.12, rough.data[p]), base === 'steel' || base === 'paint' ? metal.data[p] : 0], p * 3)
  return {
    albedo: await sharp(await encodeImage(maps.albedo, 'png')).webp({ quality: 91, effort: 5 }).toBuffer(),
    normal: await lossless(normalFromHeight(maps.height, RELIEF[base])), orm: await lossless(orm), height: await encodeImage(maps.height, 'png'),
  }
}

export async function readSource(file: string, size: number) {
  return readImage(file, { width: size })
}

export function describeSwatch(img: Img, base: MaterialKey) {
  let r = 0, g = 0, b = 0
  const n = img.w * img.h
  for (let i = 0; i < n; i++) { r += img.data[i * 3]; g += img.data[i * 3 + 1]; b += img.data[i * 3 + 2] }
  r /= n; g /= n; b /= n
  const max = Math.max(r, g, b), min = Math.min(r, g, b), light = (max + min) / 2, sat = max - min
  const hue = sat < 1e-4 ? 0 : max === r ? 60 * ((((g - b) / sat) % 6) + 6) % 360 : max === g ? 60 * ((b - r) / sat + 2) : 60 * ((r - g) / sat + 4)
  if (base === 'brick') {
    if (sat < 0.08) return light > 0.5 ? 'Tijolo cinza-claro' : 'Tijolo cinza-escuro'
    if (light < 0.3) return 'Tijolo queimado'
    return hue >= 35 && hue < 70 ? 'Tijolo amarelo' : hue < 18 || hue > 340 ? 'Tijolo vermelho' : 'Tijolo alaranjado'
  }
  if (sat < 0.07) return light > 0.6 ? 'Tábua caiada' : 'Tábua acinzentada'
  if (sat > 0.16 && !(hue >= 18 && hue < 48)) {
    const paint = hue < 15 || hue > 345 ? 'vermelho' : hue < 70 ? 'amarelo' : hue < 165 ? 'verde' : hue < 200 ? 'turquesa' : hue < 260 ? 'azul' : 'lilás'
    return `Tábua pintada de ${paint}`
  }
  return light > 0.62 ? 'Tábua clara' : light > 0.42 ? 'Tábua de tom médio' : light > 0.26 ? 'Tábua escura' : 'Tábua tostada'
}
