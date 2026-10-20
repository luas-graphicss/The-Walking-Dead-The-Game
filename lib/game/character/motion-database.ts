import * as THREE from 'three'
import { BONE, BONE_COUNT, FEATURE, MOTION_FEATURE_SCALE, MOTION_FPS } from './motion-format'
import MOTION_MASK from './motion-mask.generated.json'
import { LARGE_BOX, SMALL_BOX, buildMotionTables, type MotionTables } from './motion-tables'
import type { MotionReply, MotionRequest } from './motion.worker'

export type FootLevel = { left: number[]; right: number[] }

export type TwistChain = { slots: number[]; bind: THREE.Quaternion[]; axis: THREE.Vector3[] }

type MotionMask = {
  frames: number
  segments: number[][]
  feet?: FootLevel

  lift?: number[]
}

const F = FEATURE.count

export const RANGE_END_MARGIN = 10

const IGNORE_BEHIND = 48
const IGNORE_AHEAD = 12
const ROTATION_SCALE = 1 / MOTION_FEATURE_SCALE(0)

export type SearchResult = { index: number; cost: number }

function decodeInWorker(url: string) {
  return new Promise<MotionTables>((resolve, reject) => {
    const worker = new Worker(new URL('./motion.worker.ts', import.meta.url), { type: 'module', name: 'twd-motion-database' })
    worker.onmessage = ({ data }: MessageEvent<MotionReply>) => {
      worker.terminate()
      if ('error' in data) reject(new Error(data.error))
      else resolve(data.tables)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'motion database worker failed to start'))
    }
    worker.postMessage({ url } satisfies MotionRequest)
  })
}

export class MotionDatabase {
  readonly fps = MOTION_FPS
  readonly frames: number
  readonly count: number

  readonly rotations: Int16Array

  readonly hips: Float32Array

  readonly root: Float32Array
  readonly contacts: Uint8Array

  readonly features: Float32Array
  readonly mean: Float32Array
  readonly scale: Float32Array

  readonly stop: Int32Array
  readonly ranges: [number, number][]
  readonly speed: { p50: number; p90: number; p99: number }
  private smallMin: Float32Array
  private smallMax: Float32Array
  private largeMin: Float32Array
  private largeMax: Float32Array

  static async load(url: string) {
    const absolute = new URL(url, window.location.href).href
    try {
      return new MotionDatabase(await decodeInWorker(absolute))
    } catch (error) {
      console.warn('[motion] worker decoding failed, decoding on the main thread', error)
    }
    const response = await fetch(absolute)
    if (!response.ok) throw new Error(`motion database: HTTP ${response.status}`)
    return MotionDatabase.fromBuffer(await response.arrayBuffer())
  }

  static async fromBuffer(buffer: ArrayBuffer, options: { unmasked?: boolean } = {}) {
    return new MotionDatabase(await buildMotionTables(buffer), options.unmasked ? null : MOTION_MASK)
  }

  constructor(tables: MotionTables, mask: MotionMask | null = MOTION_MASK) {
    this.frames = tables.frames
    this.count = tables.frames * 2
    this.ranges = tables.ranges
    this.speed = tables.speed
    this.rotations = tables.rotations
    this.hips = tables.hips
    this.root = tables.root
    this.contacts = tables.contacts
    this.features = tables.features
    this.mean = tables.mean
    this.scale = tables.scale
    this.stop = tables.stop
    this.smallMin = tables.smallMin
    this.smallMax = tables.smallMax
    this.largeMin = tables.largeMin
    this.largeMax = tables.largeMax
    if (mask && mask.frames !== tables.frames) console.warn('[motion] mask was built for another database; playing every frame')
    else if (mask) {
      if (mask.feet && mask.lift) this.levelFeet(mask.feet, mask.lift)

      const N = tables.frames
      this.ranges = []
      for (const [start, end] of mask.segments) {
        for (let f = start; f < end; f++) this.stop[f] = end
        this.ranges.push([start, end], [start + N, end + N])
      }
    }
  }

  levelFeet(feet: FootLevel, lift: number[]) {
    const r = this.rotations
    for (const [bone, [cx, cy, cz, cw]] of [[BONE.leftFoot, feet.left], [BONE.rightFoot, feet.right]] as const) {
      for (let f = 0; f < this.frames; f++) {
        const i = (f * BONE_COUNT + bone) * 4
        const x = r[i] * ROTATION_SCALE, y = r[i + 1] * ROTATION_SCALE, z = r[i + 2] * ROTATION_SCALE, w = r[i + 3] * ROTATION_SCALE
        r[i] = Math.round((w * cx + x * cw + y * cz - z * cy) / ROTATION_SCALE)
        r[i + 1] = Math.round((w * cy - x * cz + y * cw + z * cx) / ROTATION_SCALE)
        r[i + 2] = Math.round((w * cz + x * cy - y * cx + z * cw) / ROTATION_SCALE)
        r[i + 3] = Math.round((w * cw - x * cx - y * cy - z * cz) / ROTATION_SCALE)
      }
    }
    lift.forEach((dy, take) => {
      const [start, stop] = this.ranges[take * 2]
      for (let f = start; f < stop; f++) this.hips[f * 3 + 1] += dy
    })
  }

  private twistCanonical = false

  canonicaliseTwist(chains: TwistChain[]) {
    if (this.twistCanonical) return
    this.twistCanonical = true
    const r = this.rotations
    const local = new THREE.Quaternion(), swung = new THREE.Quaternion(), carry = new THREE.Quaternion()
    const direction = new THREE.Vector3(), bindDirection = new THREE.Vector3(), relative = new THREE.Quaternion()
    const inverseBinds = chains.map((chain) => chain.bind.map((q) => q.clone().invert()))
    for (let f = 0; f < this.frames; f++) {
      chains.forEach((chain, c) => {
        carry.identity()
        chain.slots.forEach((slot, k) => {
          this.rotation(f, slot, relative)
          local.copy(chain.bind[k]).multiply(relative).premultiply(carry)
          bindDirection.copy(chain.axis[k]).applyQuaternion(chain.bind[k])
          direction.copy(chain.axis[k]).applyQuaternion(local)
          swung.setFromUnitVectors(bindDirection, direction).multiply(chain.bind[k])
          carry.copy(swung).invert().multiply(local)
          relative.copy(inverseBinds[c][k]).multiply(swung)
          if (relative.w < 0) relative.set(-relative.x, -relative.y, -relative.z, -relative.w)
          const i = (f * BONE_COUNT + slot) * 4
          r[i] = Math.round(relative.x / ROTATION_SCALE); r[i + 1] = Math.round(relative.y / ROTATION_SCALE)
          r[i + 2] = Math.round(relative.z / ROTATION_SCALE); r[i + 3] = Math.round(relative.w / ROTATION_SCALE)
        })
      })
    }
  }

  stored(index: number) {
    return index >= this.frames ? index - this.frames : index
  }

  rangeStop(index: number) {
    const mirrored = index >= this.frames
    return this.stop[mirrored ? index - this.frames : index] + (mirrored ? this.frames : 0)
  }

  rotation(frame: number, bone: number, out: { set(x: number, y: number, z: number, w: number): unknown }) {
    const i = (frame * BONE_COUNT + bone) * 4, r = this.rotations
    const x = r[i] * ROTATION_SCALE, y = r[i + 1] * ROTATION_SCALE, z = r[i + 2] * ROTATION_SCALE, w = r[i + 3] * ROTATION_SCALE
    const n = 1 / Math.sqrt(x * x + y * y + z * z + w * w)
    out.set(x * n, y * n, z * n, w * n)
  }

  normaliseInto(raw: ArrayLike<number>, query: Float32Array, from: number, to: number) {
    for (let d = from; d < to; d++) query[d] = (raw[d] - this.mean[d]) * this.scale[d]
  }

  cost(query: Float32Array, index: number) {
    let cost = 0
    for (let d = 0, base = index * F; d < F; d++) { const diff = query[d] - this.features[base + d]; cost += diff * diff }
    return cost
  }

  search(query: Float32Array, current: number, best: SearchResult, accept?: (index: number) => boolean) {
    const features = this.features
    for (const [start, stop] of this.ranges) {
      const end = stop - RANGE_END_MARGIN
      let i = start
      while (i < end) {
        const large = Math.floor(i / LARGE_BOX), largeEnd = Math.min((large + 1) * LARGE_BOX, end)
        if (boxCost(query, this.largeMin, this.largeMax, large, best.cost) >= best.cost) { i = largeEnd; continue }
        while (i < largeEnd) {
          const small = Math.floor(i / SMALL_BOX), smallEnd = Math.min((small + 1) * SMALL_BOX, largeEnd)
          if (boxCost(query, this.smallMin, this.smallMax, small, best.cost) >= best.cost) { i = smallEnd; continue }
          for (; i < smallEnd; i++) {
            if (i > current - IGNORE_BEHIND && i < current + IGNORE_AHEAD) continue
            let cost = 0
            const base = i * F
            for (let d = 0; d < F; d++) {
              const diff = query[d] - features[base + d]
              cost += diff * diff
              if (cost >= best.cost) break
            }
            if (cost >= best.cost) continue
            if (accept && !accept(i)) continue
            best.cost = cost; best.index = i
          }
        }
      }
    }
    return best
  }
}

function boxCost(query: Float32Array, min: Float32Array, max: Float32Array, box: number, limit: number) {
  let cost = 0
  for (let d = 0, base = box * F; d < F; d++) {
    const q = query[d], lo = min[base + d], hi = max[base + d]
    const gap = q < lo ? lo - q : q > hi ? q - hi : 0
    cost += gap * gap
    if (cost >= limit) break
  }
  return cost
}
