import sharp from 'sharp'

export type Img = { w: number; h: number; c: number; data: Float32Array }

export const createImage = (w: number, h: number, c: number): Img => ({ w, h, c, data: new Float32Array(w * h * c) })
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export async function readImage(file: string, options: { width?: number; height?: number; crop?: { left: number; top: number; width: number; height: number } } = {}) {
  let pipeline = sharp(file).removeAlpha().toColourspace('srgb')
  if (options.crop) pipeline = pipeline.extract(options.crop)
  if (options.width) pipeline = pipeline.resize(options.width, options.height ?? options.width, { fit: 'fill', kernel: 'lanczos3' })
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
  const img = createImage(info.width, info.height, info.channels)
  for (let i = 0; i < img.data.length; i++) img.data[i] = data[i] / 255
  return img
}

export async function resizeImage(img: Img, w: number, h: number) {
  const { data, info } = await sharp(toBytes(img), { raw: { width: img.w, height: img.h, channels: img.c as 1 | 2 | 3 | 4 } })
    .resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true })
  const out = createImage(info.width, info.height, info.channels)
  for (let i = 0; i < out.data.length; i++) out.data[i] = data[i] / 255
  return out
}

function toBytes(img: Img) {
  const bytes = Buffer.alloc(img.data.length)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(clamp01(img.data[i]) * 255)
  return bytes
}

export async function encodeImage(img: Img, format: 'jpg' | 'png' | 'webp', quality = 90) {
  const raw = sharp(toBytes(img), { raw: { width: img.w, height: img.h, channels: img.c as 1 | 2 | 3 | 4 } })
  if (format === 'webp') return raw.webp({ quality, alphaQuality: 90, smartSubsample: true, effort: 5 }).toBuffer()
  return format === 'png' ? raw.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer() : raw.jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer()
}

export function channel(img: Img, index: number) {
  const out = createImage(img.w, img.h, 1)
  for (let i = 0; i < img.w * img.h; i++) out.data[i] = img.data[i * img.c + index]
  return out
}

export function luminance(img: Img) {
  const out = createImage(img.w, img.h, 1)
  for (let i = 0; i < img.w * img.h; i++) {
    const p = i * img.c
    out.data[i] = img.c >= 3 ? img.data[p] * 0.2126 + img.data[p + 1] * 0.7152 + img.data[p + 2] * 0.0722 : img.data[p]
  }
  return out
}

export function blur(img: Img, radius: number, wrap = true) {
  if (radius < 1) return { ...img, data: img.data.slice() }
  let src = img.data.slice()
  let dst = new Float32Array(src.length)
  const { w, h, c } = img
  const r = Math.round(radius)
  const sample = (i: number, n: number) => (wrap ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)))
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) for (let ch = 0; ch < c; ch++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += src[(y * w + sample(k, w)) * c + ch]
      for (let x = 0; x < w; x++) {
        dst[(y * w + x) * c + ch] = sum / (2 * r + 1)
        sum += src[(y * w + sample(x + r + 1, w)) * c + ch] - src[(y * w + sample(x - r, w)) * c + ch]
      }
    }
    ;[src, dst] = [dst, src]
    for (let x = 0; x < w; x++) for (let ch = 0; ch < c; ch++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += src[(sample(k, h) * w + x) * c + ch]
      for (let y = 0; y < h; y++) {
        dst[(y * w + x) * c + ch] = sum / (2 * r + 1)
        sum += src[(sample(y + r + 1, h) * w + x) * c + ch] - src[(sample(y - r, h) * w + x) * c + ch]
      }
    }
    ;[src, dst] = [dst, src]
  }
  return { ...img, data: src }
}

function cutPath(cost: Float32Array, rows: number, cols: number, periodic: boolean) {
  const solve = (start: number | null) => {
    const dp = new Float64Array(rows * cols).fill(Infinity)
    const from = new Int32Array(rows * cols)
    for (let c = 0; c < cols; c++) if (start === null || c === start) dp[c] = cost[c]
    for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) {
      let best = Infinity, arg = c
      for (let d = -1; d <= 1; d++) {
        const p = c + d
        if (p < 0 || p >= cols) continue
        const v = dp[(r - 1) * cols + p]
        if (v < best) { best = v; arg = p }
      }
      dp[r * cols + c] = best + cost[r * cols + c]
      from[r * cols + c] = arg
    }
    let end = -1, total = Infinity
    for (let c = 0; c < cols; c++) {
      if (start !== null && Math.abs(c - start) > 1) continue
      if (dp[(rows - 1) * cols + c] < total) { total = dp[(rows - 1) * cols + c]; end = c }
    }
    const path = new Int32Array(rows)
    for (let r = rows - 1, c = end; r >= 0; r--) { path[r] = c; c = from[r * cols + c] }
    return { path, total }
  }
  if (!periodic) return solve(null).path
  let best = solve(0)
  for (let start = 2; start < cols; start += 3) {
    const candidate = solve(start)
    if (candidate.total < best.total) best = candidate
  }
  return best.path
}

function transpose(img: Img): Img {
  const out = createImage(img.h, img.w, img.c)
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) for (let ch = 0; ch < img.c; ch++) out.data[(x * img.h + y) * img.c + ch] = img.data[(y * img.w + x) * img.c + ch]
  return out
}

function seamlessHorizontal(img: Img, periodic: boolean) {
  const { w, h, c } = img
  const shifted = (x: number, y: number, ch: number) => img.data[(y * w + ((x + w / 2) % w)) * c + ch]
  const band = Math.round(w * 0.16), feather = 3
  const out = createImage(w, h, c)
  out.data.set(img.data)
  const paths: Int32Array[] = []
  for (const center of [Math.round(w / 4), Math.round((3 * w) / 4)]) {
    const x0 = center - band / 2
    const cost = new Float32Array(h * band)
    for (let y = 0; y < h; y++) for (let k = 0; k < band; k++) {
      let e = 0
      for (let ch = 0; ch < Math.min(3, c); ch++) {
        const d = img.data[(y * w + x0 + k) * c + ch] - shifted(x0 + k, y, ch)
        e += d * d
      }
      cost[y * band + k] = e
    }
    paths.push(cutPath(cost, h, band, periodic).map((k) => x0 + k))
  }
  for (let y = 0; y < h; y++) {
    const left = paths[0][y], right = paths[1][y]
    for (let x = 0; x < w; x++) {

      const t = Math.min(smoothstep(left - feather, left + feather, x), 1 - smoothstep(right - feather, right + feather, x))
      for (let ch = 0; ch < c; ch++) {
        const i = (y * w + x) * c + ch
        out.data[i] = img.data[i] * t + shifted(x, y, ch) * (1 - t)
      }
    }
  }
  return out
}

export function makeSeamless(img: Img) {
  const horizontal = seamlessHorizontal(img, false)
  return transpose(seamlessHorizontal(transpose(horizontal), true))
}

export function makeSeamlessVertical(img: Img) {
  return transpose(seamlessHorizontal(transpose(img), false))
}

function tileHorizontal(img: Img, width: number, periodic: boolean) {
  const { w, h, c } = img, overlap = w - width
  if (overlap < 16) throw new Error(`Sobreposição insuficiente para costurar: ${w} → ${width}`)
  const feather = Math.min(4, Math.floor(overlap / 6)), out = createImage(width, h, c), cost = new Float32Array(h * overlap)
  for (let y = 0; y < h; y++) for (let k = 0; k < overlap; k++) {
    let e = 0
    for (let ch = 0; ch < Math.min(3, c); ch++) { const d = img.data[(y * w + k) * c + ch] - img.data[(y * w + k + width) * c + ch]; e += d * d }

    cost[y * overlap + k] = e + (k <= feather || k >= overlap - feather - 1 ? 1e3 : 0)
  }
  const path = cutPath(cost, h, overlap, periodic)
  for (let y = 0; y < h; y++) for (let x = 0; x < width; x++) {
    const t = x >= overlap ? 1 : smoothstep(path[y] - feather, path[y] + feather, x)
    for (let ch = 0; ch < c; ch++) {
      const near = img.data[(y * w + x) * c + ch], far = x < overlap ? img.data[(y * w + x + width) * c + ch] : near
      out.data[(y * width + x) * c + ch] = near * t + far * (1 - t)
    }
  }
  return out
}

export function makeTileable(img: Img, size: number) {
  return transpose(tileHorizontal(transpose(tileHorizontal(img, size, false)), size, true))
}

export function makeTileableVertical(img: Img, size: number) {
  return transpose(tileHorizontal(transpose(img), size, false))
}

function solveLinear(matrix: Float64Array, rhs: Float64Array) {
  const n = rhs.length, a = matrix.slice(), b = rhs.slice()
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row * n + col]) > Math.abs(a[pivot * n + col])) pivot = row
    for (let k = 0; k < n; k++) [a[col * n + k], a[pivot * n + k]] = [a[pivot * n + k], a[col * n + k]]
    ;[b[col], b[pivot]] = [b[pivot], b[col]]
    const diagonal = a[col * n + col] || 1e-12
    for (let row = col + 1; row < n; row++) {
      const factor = a[row * n + col] / diagonal
      for (let k = col; k < n; k++) a[row * n + k] -= factor * a[col * n + k]
      b[row] -= factor * b[col]
    }
  }
  const x = new Float64Array(n)
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row]
    for (let k = row + 1; k < n; k++) sum -= a[row * n + k] * x[k]
    x[row] = sum / (a[row * n + row] || 1e-12)
  }
  return x
}

export function delight(img: Img) {
  const { w, h, c } = img, out = { ...img, data: img.data.slice() }
  const step = Math.max(1, Math.round(Math.min(w, h) / 128)), basis = new Float64Array(6)
  const fill = (x: number, y: number) => { const u = ((x + 0.5) / w) * 2 - 1, v = ((y + 0.5) / h) * 2 - 1; basis.set([1, u, v, u * u, u * v, v * v]) }
  for (let ch = 0; ch < Math.min(3, c); ch++) {
    const normal = new Float64Array(36), rhs = new Float64Array(6)
    let mean = 0, count = 0
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const value = img.data[(y * w + x) * c + ch]
      fill(x, y)
      for (let i = 0; i < 6; i++) { rhs[i] += basis[i] * value; for (let j = 0; j < 6; j++) normal[i * 6 + j] += basis[i] * basis[j] }
      mean += value; count++
    }
    const coef = solveLinear(normal, rhs)
    mean /= count
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      fill(x, y)
      let field = 0
      for (let i = 0; i < 6; i++) field += coef[i] * basis[i]
      const index = (y * w + x) * c + ch
      out.data[index] = clamp01(img.data[index] * Math.max(0.5, Math.min(2, mean / Math.max(0.02, field))))
    }
  }
  return out
}

export function flatten(img: Img, strength: number, wrap = true, radius = img.w / 10) {
  const lum = luminance(img)
  const broad = blur(lum, Math.max(8, radius), wrap)
  let mean = 0
  for (const v of lum.data) mean += v
  mean /= lum.data.length
  const out = { ...img, data: img.data.slice() }
  for (let i = 0; i < img.w * img.h; i++) {
    const gain = Math.max(0.6, Math.min(1.6, (mean / Math.max(1e-4, broad.data[i])) ** strength))
    for (let ch = 0; ch < Math.min(3, img.c); ch++) out.data[i * img.c + ch] *= gain
  }
  return out
}

export function normalize(img: Img) {
  const sorted = Float32Array.from(img.data).sort()
  const lo = sorted[Math.floor(sorted.length * 0.02)], hi = sorted[Math.floor(sorted.length * 0.98)]
  const out = createImage(img.w, img.h, 1)
  for (let i = 0; i < out.data.length; i++) out.data[i] = clamp01((img.data[i] - lo) / Math.max(1e-5, hi - lo))
  return out
}

export function normalFromHeight(height: Img, strength: number, wrap = true) {
  const { w, h } = height
  const broad = blur(height, 3, wrap)
  const out = createImage(w, h, 3)
  const at = (map: Img, x: number, y: number) => {
    const xx = wrap ? ((x % w) + w) % w : Math.max(0, Math.min(w - 1, x))
    const yy = wrap ? ((y % h) + h) % h : Math.max(0, Math.min(h - 1, y))
    return map.data[yy * w + xx]
  }
  const sobel = (map: Img, x: number, y: number) => {
    const dx = (at(map, x + 1, y - 1) + 2 * at(map, x + 1, y) + at(map, x + 1, y + 1)) - (at(map, x - 1, y - 1) + 2 * at(map, x - 1, y) + at(map, x - 1, y + 1))
    const dy = (at(map, x - 1, y + 1) + 2 * at(map, x, y + 1) + at(map, x + 1, y + 1)) - (at(map, x - 1, y - 1) + 2 * at(map, x, y - 1) + at(map, x + 1, y - 1))
    return [dx / 8, dy / 8]
  }
  const scale = strength * (w / 256)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [fx, fy] = sobel(height, x, y)
    const [bx, by] = sobel(broad, x, y)
    const nx = -(fx * 0.6 + bx * 1.4) * scale, ny = (fy * 0.6 + by * 1.4) * scale
    const length = Math.hypot(nx, ny, 1)
    const i = (y * w + x) * 3
    out.data[i] = nx / length * 0.5 + 0.5
    out.data[i + 1] = ny / length * 0.5 + 0.5
    out.data[i + 2] = 1 / length * 0.5 + 0.5
  }
  return out
}

export function cavity(height: Img, radius: number, amount: number, wrap = true) {
  const broad = blur(height, radius, wrap)
  const out = createImage(height.w, height.h, 1)
  for (let i = 0; i < out.data.length; i++) out.data[i] = clamp01(1 - Math.max(0, broad.data[i] - height.data[i]) * amount)
  return out
}

export function packOrm(ao: Img, roughness: Img, metal?: Img) {
  const out = createImage(ao.w, ao.h, 3)
  for (let i = 0; i < ao.w * ao.h; i++) {
    out.data[i * 3] = ao.data[i]
    out.data[i * 3 + 1] = roughness.data[i]
    out.data[i * 3 + 2] = metal ? metal.data[i] : 0
  }
  return out
}

export function withAlpha(rgb: Img, alpha: Img) {
  const out = createImage(rgb.w, rgb.h, 4)
  for (let i = 0; i < rgb.w * rgb.h; i++) {
    for (let ch = 0; ch < 3; ch++) out.data[i * 4 + ch] = rgb.data[i * rgb.c + ch]
    out.data[i * 4 + 3] = alpha.data[i]
  }
  return out
}

export function dilateColor(img: Img, passes: number) {
  const { w, h } = img
  const out = { ...img, data: img.data.slice() }
  let known = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) known[i] = img.data[i * 4 + 3] > 0.5 ? 1 : 0
  for (let pass = 0; pass < passes; pass++) {
    const next = known.slice()
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (known[i]) continue
      let r = 0, g = 0, b = 0, n = 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || !known[yy * w + xx]) continue
        const j = (yy * w + xx) * 4
        r += out.data[j]; g += out.data[j + 1]; b += out.data[j + 2]; n++
      }
      if (!n) continue
      out.data[i * 4] = r / n; out.data[i * 4 + 1] = g / n; out.data[i * 4 + 2] = b / n
      next[i] = 1
    }
    known = next
  }
  return out
}

export function sampleWrap(img: Img, u: number, v: number, out: Float32Array | number[]) {
  const { w, h, c } = img
  const x = u - 0.5, y = v - 0.5
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0
  const xa = ((x0 % w) + w) % w, xb = (xa + 1) % w, ya = ((y0 % h) + h) % h, yb = (ya + 1) % h
  for (let ch = 0; ch < c; ch++) {
    const a = img.data[(ya * w + xa) * c + ch], b = img.data[(ya * w + xb) * c + ch]
    const d = img.data[(yb * w + xa) * c + ch], e = img.data[(yb * w + xb) * c + ch]
    out[ch] = (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty
  }
  return out
}
