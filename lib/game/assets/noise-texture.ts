import * as THREE from 'three'

const SIZE = 256

const CELLS = [4, 8, 16, 32]

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function gradient(u: number, v: number, cells: number, seed: number) {
  const x = u * cells, y = v * cells
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0
  const dot = (ix: number, iy: number, dx: number, dy: number) => {
    const angle = hash(((ix % cells) + cells) % cells, ((iy % cells) + cells) % cells, seed) * Math.PI * 2
    return Math.cos(angle) * dx + Math.sin(angle) * dy
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const sx = fade(fx), sy = fade(fy)
  const a = dot(x0, y0, fx, fy), b = dot(x0 + 1, y0, fx - 1, fy)
  const c = dot(x0, y0 + 1, fx, fy - 1), d = dot(x0 + 1, y0 + 1, fx - 1, fy - 1)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

let texture: THREE.DataTexture | null = null

export function noiseTexture() {
  if (texture) return texture
  const values = CELLS.map(() => new Float32Array(SIZE * SIZE))
  CELLS.forEach((cells, channel) => {
    const out = values[channel]
    let min = Infinity, max = -Infinity
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE, v = y / SIZE
      let sum = 0, amplitude = 1
      for (let octave = 0; octave < 4; octave++) {
        sum += gradient(u, v, cells << octave, 0x51ed + channel * 97 + octave * 13) * amplitude
        amplitude *= 0.5
      }
      out[y * SIZE + x] = sum
      min = Math.min(min, sum); max = Math.max(max, sum)
    }
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / (max - min)
  })
  const data = new Uint8Array(SIZE * SIZE * 4)
  for (let i = 0; i < SIZE * SIZE; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.round(values[c][i] * 255)
  texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.UnsignedByteType)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
