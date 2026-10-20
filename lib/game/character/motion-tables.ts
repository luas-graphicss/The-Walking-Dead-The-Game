import { BONE_COUNT, FEATURE, MOTION_CHANNELS, MOTION_FEATURE_SCALE, MOTION_MAGIC, undelta } from './motion-format'

const FEATURE_GROUPS = [
  { start: FEATURE.leftFootPosition, size: 3, weight: 0.75 },
  { start: FEATURE.rightFootPosition, size: 3, weight: 0.75 },
  { start: FEATURE.leftFootVelocity, size: 3, weight: 1 },
  { start: FEATURE.rightFootVelocity, size: 3, weight: 1 },
  { start: FEATURE.hipVelocity, size: 3, weight: 1 },
  { start: FEATURE.trajectoryPosition, size: 6, weight: 1 },
  { start: FEATURE.trajectoryDirection, size: 6, weight: 1.5 },
]
const F = FEATURE.count

export const SMALL_BOX = 16
export const LARGE_BOX = 64
const FOOT_PAIRS = [
  [FEATURE.leftFootPosition, FEATURE.rightFootPosition],
  [FEATURE.leftFootVelocity, FEATURE.rightFootVelocity],
] as const

export type MotionTables = {
  frames: number

  ranges: [number, number][]
  speed: { p50: number; p90: number; p99: number }
  rotations: Int16Array
  hips: Float32Array
  root: Float32Array
  contacts: Uint8Array
  features: Float32Array
  mean: Float32Array
  scale: Float32Array
  stop: Int32Array
  smallMin: Float32Array
  smallMax: Float32Array
  largeMin: Float32Array
  largeMax: Float32Array
}

async function gunzip(bytes: Uint8Array) {
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  }
  const { gunzipSync } = await import('fflate')
  return gunzipSync(bytes)
}

export async function buildMotionTables(buffer: ArrayBuffer): Promise<MotionTables> {
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== MOTION_MAGIC) throw new Error('motion database: bad magic')
  const headerLength = view.getUint32(4, true), payloadLength = view.getUint32(8, true)
  const header: Pick<MotionTables, 'frames' | 'ranges' | 'speed'> = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 12, headerLength)))
  const raw = await gunzip(new Uint8Array(buffer, 12 + headerLength, payloadLength))
  const data = undelta(new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2), header.frames, MOTION_CHANNELS.total)
  const N = header.frames, count = N * 2
  const channel = (c: number, f: number) => data[c * N + f]

  const rotations = new Int16Array(N * BONE_COUNT * 4)
  for (let c = 0; c < BONE_COUNT * 4; c++) for (let f = 0; f < N; f++) rotations[f * BONE_COUNT * 4 + c] = channel(MOTION_CHANNELS.rotations + c, f)
  const hips = new Float32Array(N * 3), root = new Float32Array(N * 3)
  for (let k = 0; k < 3; k++) for (let f = 0; f < N; f++) {
    hips[f * 3 + k] = channel(MOTION_CHANNELS.hips + k, f) / MOTION_FEATURE_SCALE(MOTION_CHANNELS.hips + k)
    root[f * 3 + k] = channel(MOTION_CHANNELS.root + k, f) / MOTION_FEATURE_SCALE(MOTION_CHANNELS.root + k)
  }
  const contacts = new Uint8Array(N)
  for (let f = 0; f < N; f++) contacts[f] = channel(MOTION_CHANNELS.contacts, f)

  const stop = new Int32Array(N)
  const ranges: [number, number][] = []
  for (const [start, end] of header.ranges) {
    for (let f = start; f < end; f++) stop[f] = end
    ranges.push([start, end], [start + N, end + N])
  }

  const features = new Float32Array(count * F)
  for (let d = 0; d < F; d++) {
    const c = MOTION_CHANNELS.features + d, s = MOTION_FEATURE_SCALE(c)
    for (let f = 0; f < N; f++) features[f * F + d] = channel(c, f) / s
  }
  for (let f = 0; f < N; f++) mirrorFeatures(features, f * F, (f + N) * F)

  const mean = new Float32Array(F), scale = new Float32Array(F)
  for (let d = 0; d < F; d++) {
    let sum = 0
    for (let i = 0; i < count; i++) sum += features[i * F + d]
    mean[d] = sum / count
  }
  for (const group of FEATURE_GROUPS) {
    let spread = 0
    for (let d = group.start; d < group.start + group.size; d++) {
      let sum = 0
      for (let i = 0; i < count; i++) { const v = features[i * F + d] - mean[d]; sum += v * v }
      spread += Math.sqrt(sum / count)
    }
    spread /= group.size
    for (let d = group.start; d < group.start + group.size; d++) scale[d] = group.weight / Math.max(spread, 1e-6)
  }
  for (let i = 0; i < count; i++) for (let d = 0; d < F; d++) features[i * F + d] = (features[i * F + d] - mean[d]) * scale[d]

  const [smallMin, smallMax] = bounds(features, count, SMALL_BOX)
  const [largeMin, largeMax] = bounds(features, count, LARGE_BOX)
  return { frames: N, ranges, speed: header.speed, rotations, hips, root, contacts, features, mean, scale, stop, smallMin, smallMax, largeMin, largeMax }
}

export function motionTransferables(tables: MotionTables): ArrayBuffer[] {
  const { rotations, hips, root, contacts, features, mean, scale, stop, smallMin, smallMax, largeMin, largeMax } = tables
  return [rotations, hips, root, contacts, features, mean, scale, stop, smallMin, smallMax, largeMin, largeMax].map((array) => array.buffer as ArrayBuffer)
}

function bounds(features: Float32Array, count: number, size: number) {
  const n = Math.ceil(count / size), min = new Float32Array(n * F).fill(Infinity), max = new Float32Array(n * F).fill(-Infinity)
  for (let i = 0; i < count; i++) {
    const b = Math.floor(i / size) * F
    for (let d = 0; d < F; d++) {
      const v = features[i * F + d]
      if (v < min[b + d]) min[b + d] = v
      if (v > max[b + d]) max[b + d] = v
    }
  }
  return [min, max] as const
}

function mirrorFeatures(features: Float32Array, s: number, d: number) {
  for (const [a, b] of FOOT_PAIRS) {
    features[d + a] = -features[s + b]; features[d + a + 1] = features[s + b + 1]; features[d + a + 2] = features[s + b + 2]
    features[d + b] = -features[s + a]; features[d + b + 1] = features[s + a + 1]; features[d + b + 2] = features[s + a + 2]
  }
  const h = FEATURE.hipVelocity
  features[d + h] = -features[s + h]; features[d + h + 1] = features[s + h + 1]; features[d + h + 2] = features[s + h + 2]
  for (let k = FEATURE.trajectoryPosition; k < F; k += 2) { features[d + k] = -features[s + k]; features[d + k + 1] = features[s + k + 1] }
}
