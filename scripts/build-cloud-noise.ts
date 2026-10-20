import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SIZE = 64
const OUT = 'public/textures/sky/cloud-noise.bin'

function hash(x: number, y: number, z: number, seed: number) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x1b873593) ^ Math.imul(seed, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const wrap = (value: number, period: number) => ((value % period) + period) % period

function worley(px: number, py: number, pz: number, cells: number, seed: number) {
  const x = px * cells, y = py * cells, z = pz * cells
  const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z)
  let nearest = Infinity
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ix = cx + dx, iy = cy + dy, iz = cz + dz
    const wx = wrap(ix, cells), wy = wrap(iy, cells), wz = wrap(iz, cells)
    const fx = ix + hash(wx, wy, wz, seed) - x
    const fy = iy + hash(wx, wy, wz, seed + 1) - y
    const fz = iz + hash(wx, wy, wz, seed + 2) - z
    nearest = Math.min(nearest, fx * fx + fy * fy + fz * fz)
  }
  return Math.min(1, Math.sqrt(nearest))
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

function perlin(px: number, py: number, pz: number, cells: number, seed: number) {
  const x = px * cells, y = py * cells, z = pz * cells
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z)
  const fx = x - x0, fy = y - y0, fz = z - z0
  const corner = (ix: number, iy: number, iz: number) => {
    const wx = wrap(ix, cells), wy = wrap(iy, cells), wz = wrap(iz, cells)

    const gz = hash(wx, wy, wz, seed) * 2 - 1
    const angle = hash(wx, wy, wz, seed + 7) * Math.PI * 2
    const r = Math.sqrt(1 - gz * gz)
    return r * Math.cos(angle) * (x - ix) + r * Math.sin(angle) * (y - iy) + gz * (z - iz)
  }
  const u = fade(fx), v = fade(fy), w = fade(fz)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const x00 = lerp(corner(x0, y0, z0), corner(x0 + 1, y0, z0), u)
  const x10 = lerp(corner(x0, y0 + 1, z0), corner(x0 + 1, y0 + 1, z0), u)
  const x01 = lerp(corner(x0, y0, z0 + 1), corner(x0 + 1, y0, z0 + 1), u)
  const x11 = lerp(corner(x0, y0 + 1, z0 + 1), corner(x0 + 1, y0 + 1, z0 + 1), u)
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 1.5
}

const remap = (value: number, low: number, high: number, toLow: number, toHigh: number) =>
  toLow + ((value - low) * (toHigh - toLow)) / (high - low)

const channels = [0, 1, 2, 3].map(() => new Float32Array(SIZE ** 3))
const started = performance.now()
for (let z = 0; z < SIZE; z++) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const px = (x + 0.5) / SIZE, py = (y + 0.5) / SIZE, pz = (z + 0.5) / SIZE

      const w4 = 1 - worley(px, py, pz, 4, 11)
      const w8 = 1 - worley(px, py, pz, 8, 23)
      const w16 = 1 - worley(px, py, pz, 16, 37)
      const w32 = 1 - worley(px, py, pz, 32, 41)
      const g = w4 * 0.625 + w8 * 0.25 + w16 * 0.125
      const b = w8 * 0.625 + w16 * 0.25 + w32 * 0.125
      const a = w16 * 0.75 + w32 * 0.25

      const fbm = perlin(px, py, pz, 4, 101) * 0.5 + perlin(px, py, pz, 8, 211) * 0.25 + perlin(px, py, pz, 16, 307) * 0.125
      const gradient = Math.min(1, Math.max(0, fbm / 0.875 * 0.5 + 0.5))
      const r = remap(gradient, 0, 1, g, 1)
      const index = (z * SIZE + y) * SIZE + x
      channels[0][index] = r
      channels[1][index] = g
      channels[2][index] = b
      channels[3][index] = a
    }
  }
}

const data = new Uint8Array(SIZE ** 3 * 4)
channels.forEach((values, channel) => {
  let min = Infinity, max = -Infinity
  for (const value of values) { min = Math.min(min, value); max = Math.max(max, value) }
  for (let i = 0; i < values.length; i++) data[i * 4 + channel] = Math.round(((values[i] - min) / (max - min)) * 255)
  console.log(`channel ${'RGBA'[channel]}: ${min.toFixed(3)}..${max.toFixed(3)}`)
})

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, data)
console.log(`${OUT}: ${SIZE}³ RGBA8, ${data.length} bytes in ${((performance.now() - started) / 1000).toFixed(1)} s`)
