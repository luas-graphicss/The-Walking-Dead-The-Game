import { Terrain } from './terrain'
import { sampleChunkHeight } from './generator'
import { planChunks, type ChunkRequest } from './stream-plan'
import { CHUNK_SIZE, chunkKey, type Quality } from './settings'
import { footprintGap, structuresOf } from './structure-streamer'
import type { AtlasData, Bounds, ChunkData, WorkerResponse, WorldRequest } from './types'

type Job = { request: WorldRequest; priority: number; resolve?: (data: AtlasData) => void; reject?: (error: Error) => void }

export class WorldSession {
  readonly terrain: Terrain
  readonly chunks = new Map<string, ChunkData>()
  readonly colliders = new Set<string>()
  quality: Quality = 'balanced'
  error: string | null = null
  lastGenerationMs = 0
  private worker: Worker | null = null
  private wanted = new Map<string, ChunkRequest>()
  private queue: Job[] = []
  private active: Job | null = null
  private id = 0
  private version = 0
  private listeners = new Set<() => void>()
  private focus = ''
  private disposed = false

  constructor(readonly seed: string) { this.terrain = new Terrain(seed) }

  start() {
    if (this.worker || this.disposed) return
    try {
      this.worker = new Worker(new URL('./world.worker.ts', import.meta.url), { type: 'module', name: 'twd-world-generator' })
      this.worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        const active = this.active
        if (!active || active.request.id !== data.id) return
        this.active = null
        if (data.kind === 'error') {
          if (active.request.kind === 'atlas') active.reject?.(new Error(data.message))
          else this.error = data.message
        } else if (data.kind === 'chunk') {
          const key = chunkKey(data.data.cx, data.data.cz)
          if (this.wanted.get(key)?.lod === data.data.lod) {
            this.chunks.set(key, data.data)
            this.lastGenerationMs = data.data.generationMs
          }
        } else active.resolve?.(data.data)
        this.notify()
        this.pump()
      }
      this.worker.onerror = () => {
        this.error = 'O worker de terreno não pôde iniciar. Recarregue o jogo em um navegador com WebGL 2 e Web Workers.'
        this.active?.reject?.(new Error(this.error))
        this.active = null
        this.notify()
      }
      this.worker.postMessage({ kind: 'init', seed: this.seed })
      this.pump()
    } catch {
      this.error = 'Este navegador não disponibilizou o worker de geração.'
      this.notify()
    }
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.version
  private notify() { this.version++; for (const listener of this.listeners) listener() }

  private pump() {
    if (!this.worker || this.active || this.disposed || this.error) return
    this.queue.sort((a, b) => a.priority - b.priority)
    this.active = this.queue.shift() ?? null
    if (this.active) this.worker.postMessage(this.active.request)
  }

  setFocus(x: number, z: number, force = false) {
    const signature = `${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}:${this.quality}`
    if (signature === this.focus && !force) return
    this.focus = signature
    const plan = planChunks(x, z, this.quality)
    this.wanted = new Map(plan.map((item) => [chunkKey(item.cx, item.cz), item]))
    this.queue = this.queue.filter((job) => {
      if (job.request.kind === 'atlas') return true
      const desired = this.wanted.get(chunkKey(job.request.cx, job.request.cz))
      return desired?.lod === job.request.lod
    })
    for (const key of this.chunks.keys()) if (!this.wanted.has(key)) this.chunks.delete(key)
    for (const item of plan) {
      if (this.chunks.get(chunkKey(item.cx, item.cz))?.lod === item.lod) continue
      const matches = (job: Job | null) => job?.request.kind === 'chunk' && job.request.cx === item.cx && job.request.cz === item.cz && job.request.lod === item.lod
      const queued = this.queue.find(matches)
      if (queued) { queued.priority = item.priority; continue }
      if (matches(this.active)) continue
      this.queue.push({ priority: item.priority, request: { kind: 'chunk', id: ++this.id, cx: item.cx, cz: item.cz, lod: item.lod } })
    }
    this.notify()
    this.pump()
  }

  get progress() {
    const required = [...this.wanted.values()].filter((entry) => entry.lod === 0)
    return required.length ? required.filter((entry) => this.chunks.get(chunkKey(entry.cx, entry.cz))?.lod === 0).length / required.length : 0
  }
  get pendingCount() { return this.queue.length + Number(Boolean(this.active)) }
  get loadedCount() { return this.chunks.size }

  readyAt(x: number, z: number) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE)
    const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE
    const xs = [cx], zs = [cz]
    if (lx < 18) xs.push(cx - 1)
    if (lx > CHUNK_SIZE - 18) xs.push(cx + 1)
    if (lz < 18) zs.push(cz - 1)
    if (lz > CHUNK_SIZE - 18) zs.push(cz + 1)
    return xs.every((x) => zs.every((z) => this.colliders.has(chunkKey(x, z))))
  }

  surfaceAt(x: number, z: number) {
    const chunk = this.chunks.get(chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)))
    return chunk ? sampleChunkHeight(chunk, x, z) : null
  }

  safeLanding(x: number, z: number) {
    for (let i = 0; i < 40; i++) {
      const radius = i === 0 ? 0 : 1 + Math.sqrt(i) * 1.1
      const px = x + Math.cos(i * 2.399963) * radius, pz = z + Math.sin(i * 2.399963) * radius
      const chunk = this.chunks.get(chunkKey(Math.floor(px / CHUNK_SIZE), Math.floor(pz / CHUNK_SIZE)))
      if (!chunk || chunk.lod !== 0) continue
      const y = sampleChunkHeight(chunk, px, pz)
      const water = this.terrain.surface(px, pz).waterLevel
      if (y < water + 0.25) continue
      const slope = Math.hypot(sampleChunkHeight(chunk, px + 1, pz) - y, sampleChunkHeight(chunk, px, pz + 1) - y)
      if (slope > 0.75) continue
      let blocked = false
      for (let t = 0; t < chunk.trees.length; t += 8) {
        if (Math.hypot(chunk.cx * CHUNK_SIZE + chunk.trees[t] - px, chunk.cz * CHUNK_SIZE + chunk.trees[t + 2] - pz) < chunk.trees[t + 5] * 0.15 + 0.85) { blocked = true; break }
      }

      for (let dz = -1; dz <= 1 && !blocked; dz++) for (let dx = -1; dx <= 1 && !blocked; dx++) {
        const near = this.chunks.get(chunkKey(chunk.cx + dx, chunk.cz + dz))
        if (near && structuresOf(near).some((record) => footprintGap(record, px, pz) < 1.5)) blocked = true
      }

      if (!blocked) return { x: px, y: y + 0.45, z: pz, walkable: true }
    }
    return { x, z, y: Math.max(this.surfaceAt(x, z) ?? this.terrain.height(x, z), this.terrain.surface(x, z).waterLevel) + 35, walkable: false }
  }

  requestAtlas(bounds: Bounds, size = 192): Promise<AtlasData> {
    return new Promise((resolve, reject) => {
      if (this.disposed || this.error) { reject(new Error(this.error ?? 'Sessão encerrada.')); return }
      this.queue = this.queue.filter((job) => {
        if (job.request.kind !== 'atlas') return true
        job.reject?.(new Error('A visualização foi substituída.'))
        return false
      })
      this.queue.push({ request: { kind: 'atlas', id: ++this.id, bounds, size }, priority: -20, resolve, reject })
      this.pump()
    })
  }

  dispose() {
    this.disposed = true
    this.worker?.terminate(); this.worker = null
    for (const job of this.queue) job.reject?.(new Error('Sessão encerrada.'))
    this.active?.reject?.(new Error('Sessão encerrada.'))
    this.queue = []; this.active = null; this.chunks.clear(); this.colliders.clear(); this.listeners.clear()
  }
}
