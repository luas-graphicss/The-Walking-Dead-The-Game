export type GroundParams = { relief: number; rough: [number, number]; ao: number }
export type GroundMaps = { height: Float32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array; rough: Float32Array; ao: Float32Array }

function blur(input: Float32Array, size: number, radius: number) {
  let src = input.slice()
  let dst = new Float32Array(src.length)
  const r = Math.max(1, Math.round(radius)), span = 2 * r + 1, mask = size - 1
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < size; y++) {
      const row = y * size
      let sum = 0
      for (let k = -r; k <= r; k++) sum += src[row + (k & mask)]
      for (let x = 0; x < size; x++) {
        dst[row + x] = sum / span
        sum += src[row + ((x + r + 1) & mask)] - src[row + ((x - r) & mask)]
      }
    }
    ;[src, dst] = [dst, src]
    for (let x = 0; x < size; x++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += src[(k & mask) * size + x]
      for (let y = 0; y < size; y++) {
        dst[y * size + x] = sum / span
        sum += src[((y + r + 1) & mask) * size + x] - src[((y - r) & mask) * size + x]
      }
    }
    ;[src, dst] = [dst, src]
  }
  return src
}

function stretch(data: Float32Array) {
  const bins = new Uint32Array(1024)
  for (let i = 0; i < data.length; i++) bins[Math.min(1023, Math.max(0, Math.floor(data[i] * 1024)))]++
  const cut = data.length * 0.02
  let lo = 0, hi = 1, acc = 0
  for (let i = 0; i < 1024; i++) { acc += bins[i]; if (acc >= cut) { lo = i / 1024; break } }
  acc = 0
  for (let i = 1023; i >= 0; i--) { acc += bins[i]; if (acc >= cut) { hi = (i + 1) / 1024; break } }
  const scale = 1 / Math.max(1e-4, hi - lo)
  for (let i = 0; i < data.length; i++) data[i] = Math.min(1, Math.max(0, (data[i] - lo) * scale))
  return data
}

export function deriveGroundMaps(rgba: ArrayLike<number>, size: number, params: GroundParams): GroundMaps {
  const count = size * size, mask = size - 1
  const lum = new Float32Array(count)
  for (let i = 0; i < count; i++) lum[i] = (rgba[i * 4] * 0.2126 + rgba[i * 4 + 1] * 0.7152 + rgba[i * 4 + 2] * 0.0722) / 255
  stretch(lum)
  const height = blur(lum, size, 1)
  const broad = blur(height, size, 3)
  const cavity = blur(height, size, 6)
  const nx = new Float32Array(count), ny = new Float32Array(count), nz = new Float32Array(count)
  const rough = new Float32Array(count), ao = new Float32Array(count)
  const scale = params.relief * (size / 256)
  const at = (map: Float32Array, x: number, y: number) => map[(y & mask) * size + (x & mask)]
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x

    const fx = (at(height, x + 1, y - 1) + 2 * at(height, x + 1, y) + at(height, x + 1, y + 1)) - (at(height, x - 1, y - 1) + 2 * at(height, x - 1, y) + at(height, x - 1, y + 1))
    const fy = (at(height, x - 1, y + 1) + 2 * at(height, x, y + 1) + at(height, x + 1, y + 1)) - (at(height, x - 1, y - 1) + 2 * at(height, x, y - 1) + at(height, x + 1, y - 1))
    const bx = (at(broad, x + 1, y - 1) + 2 * at(broad, x + 1, y) + at(broad, x + 1, y + 1)) - (at(broad, x - 1, y - 1) + 2 * at(broad, x - 1, y) + at(broad, x - 1, y + 1))
    const by = (at(broad, x - 1, y + 1) + 2 * at(broad, x, y + 1) + at(broad, x + 1, y + 1)) - (at(broad, x - 1, y - 1) + 2 * at(broad, x, y - 1) + at(broad, x + 1, y - 1))
    const sx = -((fx * 0.6 + bx * 1.4) / 8) * scale, sy = ((fy * 0.6 + by * 1.4) / 8) * scale
    const length = Math.hypot(sx, sy, 1)
    nx[i] = sx / length; ny[i] = sy / length; nz[i] = 1 / length
    rough[i] = params.rough[0] + (params.rough[1] - params.rough[0]) * lum[i]
    ao[i] = Math.min(1, Math.max(0, 1 - Math.max(0, cavity[i] - height[i]) * params.ao))
  }
  return { height, nx, ny, nz, rough, ao }
}

const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255)

export function packTerrainLayer(rgba: ArrayLike<number>, maps: GroundMaps, albedo: Uint8Array, material: Uint8Array, offset: number) {
  const count = maps.height.length
  for (let i = 0; i < count; i++) {
    const o = offset + i * 4
    albedo[o] = rgba[i * 4]; albedo[o + 1] = rgba[i * 4 + 1]; albedo[o + 2] = rgba[i * 4 + 2]; albedo[o + 3] = byte(maps.height[i])
    material[o] = byte(maps.nx[i] * 0.5 + 0.5); material[o + 1] = byte(maps.ny[i] * 0.5 + 0.5); material[o + 2] = byte(maps.rough[i]); material[o + 3] = byte(maps.ao[i])
  }
}

export function packStandardSet(rgba: ArrayLike<number>, maps: GroundMaps, size: number) {
  const count = size * size
  const albedo = new Uint8Array(count * 4), normal = new Uint8Array(count * 4), orm = new Uint8Array(count * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, o = ((size - 1 - y) * size + x) * 4
    albedo[o] = rgba[i * 4]; albedo[o + 1] = rgba[i * 4 + 1]; albedo[o + 2] = rgba[i * 4 + 2]; albedo[o + 3] = 255
    normal[o] = byte(maps.nx[i] * 0.5 + 0.5); normal[o + 1] = byte(maps.ny[i] * 0.5 + 0.5); normal[o + 2] = byte(maps.nz[i] * 0.5 + 0.5); normal[o + 3] = 255
    orm[o] = byte(maps.ao[i]); orm[o + 1] = byte(maps.rough[i]); orm[o + 2] = 0; orm[o + 3] = 255
  }
  return { albedo, normal, orm }
}
