import * as THREE from 'three'
import type { Condition, MaterialKey } from '../blockout/types'
import { CHUNK_SIZE, type Quality } from './settings'
import { STRUCTURE_BLUEPRINTS, STRUCTURE_CONDITIONS, STRUCTURE_STRIDE, STRUCTURE_ZONES, type Zone } from './settlements'
import type { InteractableData, PickupData, StructureReply, StructureRequest, Tier } from './structure.worker'
import type { ChunkData } from './types'

export type StructureRecord = {
  seed: number; blueprint: string; condition: Condition; zone: Zone
  x: number; y: number; z: number; yaw: number; cos: number; sin: number

  minX: number; maxX: number; minZ: number; maxZ: number; radius: number; eave: number

  start: number; count: number; lod: number
}
export type BuiltInteraction = { pieces: { material: MaterialKey; geometry: THREE.BufferGeometry }[]; interactables: InteractableData[]; pickups: PickupData[] }

export type BuiltStructure = { groups: { material: MaterialKey; geometry: THREE.BufferGeometry }[]; caster?: THREE.BufferGeometry | null; boxes: Float32Array; triangles: number; interaction?: BuiltInteraction | null }

function disposeBuilt(built: BuiltStructure) {
  for (const group of built.groups) group.geometry.dispose()
  built.caster?.dispose()
  for (const piece of built.interaction?.pieces ?? []) piece.geometry.dispose()
}

function indexAttribute(indices: Uint32Array, vertices: number) {
  return new THREE.BufferAttribute(vertices <= 65535 ? Uint16Array.from(indices) : indices, 1)
}

function geometryOf(source: { positions: Float32Array; normals: Float32Array; uvs: Float32Array; colors: Float32Array; indices: Uint32Array }) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(source.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(source.normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(source.uvs, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(source.colors, 3))
  geometry.setIndex(indexAttribute(source.indices, source.positions.length / 3))
  geometry.computeBoundingSphere()
  return geometry
}

export const DETAIL_RADIUS: Record<Quality, number> = { low: 60, balanced: 95, high: 150 }
const MAX_DETAILED: Record<Quality, number> = { low: 16, balanced: 34, high: 70 }

const FULL_RADIUS: Record<Quality, number> = { low: 16, balanced: 24, high: 36 }
const MAX_FULL: Record<Quality, number> = { low: 2, balanced: 4, high: 8 }

export const PROXY_RADIUS: Record<Quality, number> = { low: 200, balanced: 320, high: 460 }
const MAX_PROXY: Record<Quality, number> = { low: 45, balanced: 100, high: 180 }

const HYSTERESIS = { full: 6, detail: 25, proxy: 40 }

const TIER_INDEX: Record<Tier, number> = { shell: 0, full: 1, proxy: 2 }
const TIER_BY_INDEX: Tier[] = ['shell', 'full', 'proxy']

export const modelKey = (seed: number, tier: Tier) => seed * 4 + TIER_INDEX[tier]
export const seedOf = (key: number) => Math.floor(key / 4)
export const tierOf = (key: number): Tier => TIER_BY_INDEX[key - seedOf(key) * 4]

const FALLBACK: Record<Tier, Tier[]> = { full: ['full', 'shell', 'proxy'], shell: ['shell', 'full', 'proxy'], proxy: ['proxy', 'shell', 'full'] }

const decoded = new WeakMap<ChunkData, StructureRecord[]>()
export function structuresOf(data: ChunkData): StructureRecord[] {
  let list = decoded.get(data)
  if (list) return list
  list = []
  const s = data.structures, ox = data.cx * CHUNK_SIZE, oz = data.cz * CHUNK_SIZE
  for (let i = 0; i < s.length; i += STRUCTURE_STRIDE) {
    const minX = s[i + 7], maxX = s[i + 8], minZ = s[i + 9], maxZ = s[i + 10]
    list.push({
      seed: s[i + 5], blueprint: STRUCTURE_BLUEPRINTS[s[i + 4]], condition: STRUCTURE_CONDITIONS[s[i + 6]], zone: STRUCTURE_ZONES[s[i + 15]],
      x: ox + s[i], y: s[i + 1], z: oz + s[i + 2], yaw: s[i + 3], cos: Math.cos(s[i + 3]), sin: Math.sin(s[i + 3]),
      minX, maxX, minZ, maxZ, radius: Math.hypot(Math.max(-minX, maxX), Math.max(-minZ, maxZ)), eave: s[i + 11],
      start: s[i + 13], count: s[i + 14], lod: data.lod,
    })
  }
  decoded.set(data, list)
  return list
}

export function footprintGap(record: StructureRecord, x: number, z: number) {
  const dx = x - record.x, dz = z - record.z
  const lx = record.cos * dx - record.sin * dz, lz = record.sin * dx + record.cos * dz
  return Math.hypot(Math.max(record.minX - lx, 0, lx - record.maxX), Math.max(record.minZ - lz, 0, lz - record.maxZ))
}

export class StructureStreamer {

  readonly built = new Map<number, BuiltStructure>()
  readonly records = new Map<number, StructureRecord>()

  shown = new Map<number, number>()

  protect = new Set<number>()
  version = 0
  stats = { built: 0, triangles: 0, full: 0, proxies: 0, lastMs: 0, errors: 0 }

  pools?: () => Record<string, number>
  private wanted = new Map<number, Tier>()
  private queue: { record: StructureRecord; tier: Tier }[] = []
  private inflight = new Map<number, Worker>()

  private inbox: StructureReply[] = []
  private failed = new Set<number>()
  private used = new Map<number, number>()
  private listeners = new Set<() => void>()

  private workers: Worker[] = []
  private idle: Worker[] = []
  private ticks = 0

  private quality: Quality = 'balanced'

  constructor() {
    const count = Math.max(1, Math.min(3, (globalThis.navigator?.hardwareConcurrency ?? 4) - 3))
    for (let i = 0; i < count; i++) {
      try {
        const worker = new Worker(new URL('./structure.worker.ts', import.meta.url), { type: 'module', name: `twd-structures-${i}` })
        worker.onmessage = ({ data }: MessageEvent<StructureReply>) => { this.idle.push(worker); this.inbox.push(data); this.pump() }
        worker.onerror = () => {
          this.workers = this.workers.filter((other) => other !== worker); this.idle = this.idle.filter((other) => other !== worker)
          for (const [key, owner] of this.inflight) if (owner === worker) this.inflight.delete(key)
        }
        this.workers.push(worker); this.idle.push(worker)
      } catch {                                                        }
    }
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.version
  private notify() { this.version++; for (const listener of this.listeners) listener() }

  drain(budgetMs = 2.5) {
    if (!this.inbox.length) return
    const started = performance.now()
    do this.receive(this.inbox.shift()!)
    while (this.inbox.length && performance.now() - started < budgetMs)
    this.pump()
    this.refresh()
  }

  private receive(reply: StructureReply) {
    const key = reply.kind === 'done' ? reply.result.id : reply.id
    this.inflight.delete(key)
    if (reply.kind === 'error') {
      const seed = seedOf(key)
      console.error(`[structures] ${this.records.get(seed)?.blueprint ?? seed}: ${reply.message}`)
      this.failed.add(seed); this.stats.errors++
    } else {
      const { result } = reply
      const groups = result.groups.map((group) => ({ material: group.material, geometry: geometryOf(group) }))
      const interaction: BuiltInteraction | null = result.interaction && {
        pieces: result.interaction.pieces.map((piece) => ({ material: piece.material, geometry: geometryOf(piece) })),
        interactables: result.interaction.interactables,
        pickups: result.interaction.pickups,
      }
      let caster: THREE.BufferGeometry | null = null
      if (result.caster) {
        caster = new THREE.BufferGeometry()
        caster.setAttribute('position', new THREE.BufferAttribute(result.caster.positions, 3))
        caster.setIndex(indexAttribute(result.caster.indices, result.caster.positions.length / 3))
        caster.computeBoundingSphere()
      }
      this.built.set(key, { groups, caster, boxes: result.boxes, triangles: result.triangles, interaction })
      this.stats.built++; this.stats.lastMs = result.ms
    }
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const { record, tier } = this.queue.shift()!
      const key = modelKey(record.seed, tier)
      if (this.wanted.get(record.seed) !== tier || this.built.has(key) || this.inflight.has(key)) continue
      const worker = this.idle.pop()!
      this.inflight.set(key, worker)
      const request: StructureRequest = { id: key, blueprint: record.blueprint, seed: record.seed, condition: record.condition, tier, quality: this.quality }
      worker.postMessage(request)
    }
  }

  private refresh() {
    const next = new Map<number, number>()
    for (const [seed, tier] of this.wanted) {

      for (const option of FALLBACK[tier]) {
        const key = modelKey(seed, option)
        if (this.built.has(key)) { next.set(seed, key); break }
      }
    }
    let changed = next.size !== this.shown.size
    if (!changed) for (const [seed, key] of next) if (this.shown.get(seed) !== key) { changed = true; break }
    if (!changed) return
    this.shown = next
    let triangles = 0, full = 0, proxies = 0
    for (const key of next.values()) {
      triangles += this.built.get(key)?.triangles ?? 0
      const tier = tierOf(key)
      if (tier === 'full') full++
      else if (tier === 'proxy') proxies++
    }
    this.stats.triangles = triangles; this.stats.full = full; this.stats.proxies = proxies
    this.notify()
  }

  update(all: StructureRecord[], x: number, z: number, quality: Quality, enabled: boolean) {
    this.quality = quality
    const radius = DETAIL_RADIUS[quality], fullRadius = FULL_RADIUS[quality], proxyRadius = PROXY_RADIUS[quality]
    const candidates: { record: StructureRecord; distance: number }[] = []
    for (const record of all) {
      if (record.lod > 1 || this.failed.has(record.seed)) continue
      const reach = this.shown.has(record.seed) ? proxyRadius + HYSTERESIS.proxy : proxyRadius
      const near = Math.hypot(record.x - x, record.z - z) - record.radius
      if (near > reach) continue
      const distance = footprintGap(record, x, z)
      if (distance <= reach) candidates.push({ record, distance })
    }
    candidates.sort((a, b) => a.distance - b.distance)
    const wanted = new Map<number, Tier>()
    const chosen: StructureRecord[] = []
    let full = 0, detailed = 0, proxies = 0
    if (enabled) for (const { record, distance } of candidates) {
      const current = this.wanted.get(record.seed)
      const fullReach = current === 'full' ? fullRadius + HYSTERESIS.full : fullRadius
      const detailReach = current === 'full' || current === 'shell' ? radius + HYSTERESIS.detail : radius
      let tier: Tier | null = null
      if (distance <= detailReach && detailed < MAX_DETAILED[quality]) {
        tier = distance <= fullReach && full < MAX_FULL[quality] ? 'full' : 'shell'
        detailed++
        if (tier === 'full') full++
      } else if (proxies < MAX_PROXY[quality]) {
        tier = 'proxy'
        proxies++
      }
      if (!tier) continue
      wanted.set(record.seed, tier)
      this.records.set(record.seed, record)
      chosen.push(record)
    }
    this.wanted = wanted
    const tick = ++this.ticks
    for (const [seed, tier] of wanted) this.used.set(modelKey(seed, tier), tick)
    for (const key of this.shown.values()) this.used.set(key, tick)
    for (const key of this.protect) this.used.set(key, tick)

    this.queue = []
    const upgrades: { record: StructureRecord; tier: Tier }[] = []
    for (const record of chosen) {
      const tier = wanted.get(record.seed)!, key = modelKey(record.seed, tier)
      if (this.built.has(key) || this.inflight.has(key)) continue
      ;(this.shown.has(record.seed) ? upgrades : this.queue).push({ record, tier })
    }
    this.queue.push(...upgrades)
    this.pump()
    this.refresh()

    const limit = MAX_DETAILED[quality] + MAX_FULL[quality] + MAX_PROXY[quality] + 24
    if (this.built.size <= limit) return
    const inUse = new Set([...this.shown.values(), ...this.protect])
    for (const [seed, tier] of wanted) inUse.add(modelKey(seed, tier))
    const idle = [...this.built.keys()].filter((key) => !inUse.has(key)).sort((a, b) => (this.used.get(a) ?? 0) - (this.used.get(b) ?? 0))
    for (const key of idle.slice(0, this.built.size - limit)) {
      disposeBuilt(this.built.get(key)!)
      this.built.delete(key); this.used.delete(key)
      const seed = seedOf(key)
      if (!wanted.has(seed) && !TIER_BY_INDEX.some((tier) => this.built.has(modelKey(seed, tier)))) this.records.delete(seed)
    }
  }

  dispose() {
    for (const worker of this.workers) worker.terminate()
    this.workers = []; this.idle = []; this.inflight.clear(); this.queue = []; this.inbox = []
    for (const built of this.built.values()) disposeBuilt(built)
    this.built.clear(); this.records.clear(); this.listeners.clear(); this.shown = new Map(); this.protect.clear()
  }
}
