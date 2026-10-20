import { createNoise2D } from 'simplex-noise'

export function hashString(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export function hash2(x: number, z: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seed
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

export function randomAt(x: number, z: number, seed: number) {
  return hash2(x, z, seed) / 4294967296
}

export function randomSource(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
export function smoothstep(a: number, b: number, value: number) {
  const t = clamp01((value - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export class NoiseField {
  private noise: ReturnType<typeof createNoise2D>
  constructor(seed: number) { this.noise = createNoise2D(randomSource(seed)) }
  at(x: number, z: number) { return this.noise(x, z) }
  fbm(x: number, z: number, octaves = 4) {
    let value = 0, amplitude = 0.5, total = 0
    for (let octave = 0; octave < octaves; octave++) {
      value += this.noise(x, z) * amplitude
      total += amplitude
      x = x * 2.03 + 19.7
      z = z * 2.03 - 31.4
      amplitude *= 0.48
    }
    return value / total
  }
}

export class LruCache<K, V> {
  private entries = new Map<K, V>()
  constructor(readonly limit: number) {}
  get size() { return this.entries.size }
  get(key: K) {
    const value = this.entries.get(key)
    if (value !== undefined) {
      this.entries.delete(key)
      this.entries.set(key, value)
    }
    return value
  }
  set(key: K, value: V) {
    this.entries.delete(key)
    this.entries.set(key, value)
    if (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!)
    return value
  }
}
