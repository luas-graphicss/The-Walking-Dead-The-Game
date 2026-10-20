'use client'

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { lazy, pbrMaterial } from '@/lib/game/assets/pbr'
import { HIDDEN, LOD_FADE_GLSL } from '@/lib/game/lod-fade'
import { runtime } from '@/lib/game/runtime'
import { InteractionWorld, setInteractionWorld } from '@/lib/game/interaction/world'
import { invalidateChunkShadows, invalidateStillShadows } from '@/lib/game/shadow'
import { LodFader } from '@/lib/game/world/lod-fader'
import { CHUNK_SIZE } from '@/lib/game/world/settings'
import type { WorldSession } from '@/lib/game/world/session'
import { StructureStreamer, footprintGap, structuresOf, tierOf, type StructureRecord } from '@/lib/game/world/structure-streamer'
import type { ChunkData } from '@/lib/game/world/types'
import { useChunkOrigin } from './chunk-origin'
import { StructureBatcher } from './structure-batches'
import { structureMaterialsReady, structureTextures, warmStructureShader } from './structure-materials'

declare global {
  interface Window { __TWD_STRUCTURES__?: () => Record<string, unknown> }
}

const massingMaterials = lazy(() => {
  const fade = pbrMaterial('concrete', { vertexColors: true })
  fade.customProgramCacheKey = () => 'massing-lod-fade-v1'
  fade.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float lodFade;\nvarying float vLodFade;\n${shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLodFade = lodFade;')}`
    shader.fragmentShader = `varying float vLodFade;\n${LOD_FADE_GLSL}\n${shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (lodFadeDiscard(vLodFade)) discard;')}`
  }
  return { fade, solid: pbrMaterial('concrete', { vertexColors: true }) }
})

function warmMassingShader(gl: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene) {
  const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01)
  const count = geometry.getAttribute('position').count
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3))
  geometry.setAttribute('lodFade', new THREE.BufferAttribute(new Float32Array(count).fill(1), 1))
  const probe = new THREE.Group()
  for (const material of Object.values(massingMaterials())) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = mesh.receiveShadow = true
    probe.add(mesh)
  }
  return gl.compileAsync(probe, camera, scene).catch(() => undefined).finally(() => geometry.dispose())
}

const COLLIDER_RADIUS = 70

export function Settlements({ session }: { session: WorldSession }) {

  const [streamer, setStreamer] = useState<StructureStreamer | null>(null)
  useEffect(() => {
    const next = new StructureStreamer()
    setStreamer(next)
    return () => next.dispose()
  }, [session])
  return streamer ? <SettlementLayer session={session} streamer={streamer} /> : null
}

function SettlementLayer({ session, streamer }: { session: WorldSession; streamer: StructureStreamer }) {
  const [ready, setReady] = useState(false)
  const uploads = useRef<THREE.Texture[] | null>(null)
  const fader = useMemo(() => new LodFader(), [streamer])
  const massing = useMemo(() => new MassingFader(), [streamer])
  const world = useMemo(() => new InteractionWorld(streamer), [streamer])
  useEffect(() => {
    setInteractionWorld(world)
    return () => setInteractionWorld(null)
  }, [world])
  useEffect(() => {
    let alive = true
    structureMaterialsReady().then(() => { if (alive) uploads.current = [...structureTextures] })
    return () => { alive = false; uploads.current = null }
  }, [])
  useEffect(() => {
    window.__TWD_STRUCTURES__ = () => ({
      shown: streamer.shown.size, cached: streamer.built.size, drawnModels: fader.models.size, ...streamer.stats, pools: streamer.pools?.(),
      inChunks: [...session.chunks.values()].reduce((sum, data) => sum + structuresOf(data).length, 0),
      nearest: nearestStructures(session, 6),
    })
    return () => { delete window.__TWD_STRUCTURES__ }
  }, [streamer, session, fader])

  useFrame((_, delta) => {
    streamer.drain()
    if (!fader.update(streamer.shown, Math.min(delta, 0.1))) return
    streamer.protect = new Set(fader.keys())
    massing.apply(fader.massing)
  }, -90)

  const elapsed = useRef(1)
  useFrame(({ gl, camera, scene }, delta) => {
    const queue = uploads.current
    if (queue) {

      for (let i = 0; i < 2 && queue.length; i++) gl.initTexture(queue.shift()!)
      if (!queue.length) {
        uploads.current = null
        Promise.all([warmStructureShader(gl, camera, scene), warmMassingShader(gl, camera, scene)]).then(() => setReady(true))
      }
    }
    elapsed.current += delta
    if (elapsed.current < 0.25) return
    elapsed.current = 0
    const all: StructureRecord[] = []
    for (const data of session.chunks.values()) for (const record of structuresOf(data)) all.push(record)
    streamer.update(all, runtime.worldPosition.x, runtime.worldPosition.z, session.quality, ready)
  })

  const chunks = [...session.chunks.values()].filter((data) => data.structures.length > 0)
  return (
    <>
      {chunks.map((data) => <ChunkMassing key={data.key} data={data} fader={massing} />)}
      <DetailedStructures streamer={streamer} fader={fader} world={world} />
      <StructureColliders streamer={streamer} session={session} />
    </>
  )
}

function nearestStructures(session: WorldSession, count: number) {
  const { x, z } = runtime.worldPosition
  const all: StructureRecord[] = []
  for (const data of session.chunks.values()) all.push(...structuresOf(data))
  return all.map((record) => ({ blueprint: record.blueprint, condition: record.condition, zone: record.zone, distance: Math.round(footprintGap(record, x, z)) }))
    .sort((a, b) => a.distance - b.distance).slice(0, count)
}

type MassingChunk = {
  records: StructureRecord[]; geometry: THREE.BufferGeometry; fade: THREE.BufferAttribute; mesh: THREE.Mesh

  ranges: Uint32Array; codes: Float32Array; hidden: string; source: Uint32Array
}

class MassingFader {
  private readonly chunks = new Map<ChunkData, MassingChunk>()
  private last = new Map<number, number>()

  register(data: ChunkData, geometry: THREE.BufferGeometry, fade: THREE.BufferAttribute, mesh: THREE.Mesh) {
    const records = structuresOf(data), source = data.buildings.indices
    const ranges = new Uint32Array(records.length * 2)
    records.forEach((record, i) => {
      let low = Infinity, high = -Infinity
      for (let k = record.start; k < record.start + record.count; k++) { const v = source[k]; if (v < low) low = v; if (v > high) high = v }

      ranges[i * 2] = record.count ? low : 1; ranges[i * 2 + 1] = record.count ? high : 0
    })
    const chunk: MassingChunk = { records, geometry, fade, mesh, ranges, codes: new Float32Array(records.length).fill(1), hidden: '-', source }
    this.chunks.set(data, chunk)
    this.write(chunk, this.last)
    invalidateChunkShadows(data.cx, data.cz)
  }

  unregister(data: ChunkData) {
    this.chunks.delete(data)
    invalidateChunkShadows(data.cx, data.cz)
  }

  apply(codes: Map<number, number>) {
    this.last = new Map(codes)
    for (const chunk of this.chunks.values()) this.write(chunk, codes)
  }

  private write(chunk: MassingChunk, codes: Map<number, number>) {
    const { records, ranges, fade } = chunk, values = fade.array as Float32Array
    let dirty = false, hidden = '', fading = false
    for (let i = 0; i < records.length; i++) {
      const code = codes.get(records[i].seed) ?? 1
      const hides = code <= 0 || code >= HIDDEN
      if (hides) hidden += `${i},`
      else if (code < 0.999 || code > 1.001) fading = true
      if (chunk.codes[i] === code) continue

      if (hides !== (chunk.codes[i] <= 0 || chunk.codes[i] >= HIDDEN)) invalidateStillShadows(records[i].x, records[i].z, records[i].radius)
      chunk.codes[i] = code
      const v0 = ranges[i * 2], v1 = ranges[i * 2 + 1]
      if (v1 >= v0) { values.fill(code, v0, v1 + 1); dirty = true }
    }
    if (dirty) fade.needsUpdate = true
    const material = fading ? massingMaterials().fade : massingMaterials().solid
    if (chunk.mesh.material !== material) chunk.mesh.material = material
    if (hidden === chunk.hidden) return
    chunk.hidden = hidden
    let total = 0
    for (let i = 0; i < records.length; i++) if (!(chunk.codes[i] <= 0 || chunk.codes[i] >= HIDDEN)) total += records[i].count
    const index = new Uint32Array(total)
    let offset = 0
    for (let i = 0; i < records.length; i++) {
      if (chunk.codes[i] <= 0 || chunk.codes[i] >= HIDDEN) continue
      index.set(chunk.source.subarray(records[i].start, records[i].start + records[i].count), offset)
      offset += records[i].count
    }
    chunk.geometry.setIndex(new THREE.BufferAttribute(index, 1))
  }
}

const ChunkMassing = memo(function ChunkMassing({ data, fader }: { data: ChunkData; fader: MassingFader }) {
  const group = useRef<THREE.Group>(null)
  const { geometry, fade } = useMemo(() => {
    const result = new THREE.BufferGeometry()
    const mesh = data.buildings
    result.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    result.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))
    result.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3))
    if (mesh.uvs) result.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2))
    const fadeAttribute = new THREE.BufferAttribute(new Float32Array(mesh.positions.length / 3).fill(1), 1)
    result.setAttribute('lodFade', fadeAttribute)
    result.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    result.computeBoundingSphere()
    return { geometry: result, fade: fadeAttribute }
  }, [data])
  const mesh = useRef<THREE.Mesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    fader.register(data, geometry, fade, mesh.current)
    return () => fader.unregister(data)
  }, [fader, data, geometry, fade])
  useEffect(() => () => geometry.dispose(), [geometry])
  useChunkOrigin(group, data.cx, data.cz)
  return (
    <group ref={group} position={[data.cx * CHUNK_SIZE - runtime.origin.x, 0, data.cz * CHUNK_SIZE - runtime.origin.z]} matrixAutoUpdate={false} matrixWorldNeedsUpdate>
      <mesh ref={mesh} geometry={geometry} material={massingMaterials().solid} castShadow receiveShadow matrixAutoUpdate={false} matrixWorldNeedsUpdate />
    </group>
  )
})

function DetailedStructures({ streamer, fader, world }: { streamer: StructureStreamer; fader: LodFader; world: InteractionWorld }) {
  const batcher = useMemo(() => new StructureBatcher(), [streamer])
  const seen = useRef({ version: -1, shifts: -1 })
  useEffect(() => {
    streamer.pools = () => batcher.stats
    seen.current = { version: -1, shifts: -1 }
    batcher.pieceState = world
    world.batcher = batcher
    return () => {
      if (world.batcher === batcher) world.batcher = null
      batcher.dispose()
    }
  }, [streamer, batcher, world])
  useFrame(() => {
    const state = seen.current
    if (state.shifts !== runtime.originShifts) {
      state.shifts = runtime.originShifts
      batcher.rebase(streamer.records, runtime.origin)
    }
    if (state.version !== fader.version) {
      state.version = fader.version
      batcher.sync(fader.models, streamer.built, streamer.records, runtime.origin)
    }
  }, -89)
  return <primitive object={batcher.group} />
}

type Body = ReturnType<ReturnType<typeof useRapier>['world']['createRigidBody']>

type Held = { body: Body; key: number }

type Job = Held & { boxes: Float32Array; next: number }
const BLOCK = -1

const COLLIDERS_PER_FRAME = 320

function StructureColliders({ streamer, session }: { streamer: StructureStreamer; session: WorldSession }) {
  const { world, rapier } = useRapier()
  const held = useRef(new Map<number, Held>())

  const jobs = useRef(new Map<number, Job>())
  const elapsed = useRef(1)
  useEffect(() => {
    const current = held.current, pending = jobs.current
    return () => {
      for (const { body } of [...current.values(), ...pending.values()]) if (world.getRigidBody(body.handle)) world.removeRigidBody(body)
      current.clear(); pending.clear()
    }
  }, [world])
  useFrame((_, delta) => {
    const map = held.current, pending = jobs.current
    const remove = (body: Body) => { if (world.getRigidBody(body.handle)) world.removeRigidBody(body) }

    let budget = COLLIDERS_PER_FRAME
    for (const [seed, job] of pending) {
      if (budget <= 0) break
      const b = job.boxes
      while (job.next < b.length && budget > 0) {
        const i = job.next
        job.next += 10
        if (b[i + 7] < 0.005 || b[i + 8] < 0.005 || b[i + 9] < 0.005) continue
        world.createCollider(rapier.ColliderDesc.cuboid(b[i + 7], b[i + 8], b[i + 9]).setTranslation(b[i], b[i + 1], b[i + 2]).setRotation({ x: b[i + 3], y: b[i + 4], z: b[i + 5], w: b[i + 6] }), job.body)
        budget--
      }
      if (job.next < b.length) break
      const current = map.get(seed)
      if (current) remove(current.body)
      map.set(seed, { body: job.body, key: job.key })
      pending.delete(seed)
    }

    elapsed.current += delta
    if (elapsed.current < 0.3) return
    elapsed.current = 0
    const { x, z } = runtime.worldPosition
    const near: { record: StructureRecord; gap: number }[] = []
    for (const data of session.chunks.values()) {
      if (data.lod !== 0) continue
      for (const record of structuresOf(data)) if (Math.hypot(record.x - x, record.z - z) - record.radius < COLLIDER_RADIUS) near.push({ record, gap: footprintGap(record, x, z) })
    }
    near.sort((a, b) => a.gap - b.gap)
    const inRange = new Set(near.map(({ record }) => record.seed))
    for (const [seed, entry] of map) {
      if (inRange.has(seed)) continue
      remove(entry.body)
      map.delete(seed)
    }
    const queued = new Map<number, Job>()
    for (const { record, gap } of near) {
      const seed = record.seed
      const shown = streamer.shown.get(seed)
      const wanted = shown !== undefined && tierOf(shown) !== 'proxy' && streamer.built.has(shown) ? shown : BLOCK
      const current = map.get(seed), job = pending.get(seed)
      if (job) {
        pending.delete(seed)
        if (job.key === wanted || wanted === BLOCK) { queued.set(seed, job); continue }
        remove(job.body)
      }
      if (current && (current.key === wanted || wanted === BLOCK)) continue
      const built = wanted === BLOCK ? undefined : streamer.built.get(wanted)
      if (!built && (record.condition === 'leveled' || gap < 1.5)) continue
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), record.yaw)
      const body = world.createRigidBody(rapier.RigidBodyDesc.fixed()
        .setTranslation(record.x - runtime.origin.x, record.y, record.z - runtime.origin.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }))
      if (built) { queued.set(seed, { body, key: wanted, boxes: built.boxes, next: 0 }); continue }
      const hx = (record.maxX - record.minX) / 2 - 0.4, hz = (record.maxZ - record.minZ) / 2 - 0.4, hy = Math.max(0.6, record.eave / 2)
      if (hx > 0.3 && hz > 0.3) world.createCollider(rapier.ColliderDesc.cuboid(hx, hy, hz).setTranslation((record.minX + record.maxX) / 2, hy, (record.minZ + record.maxZ) / 2), body)
      if (current) remove(current.body)
      map.set(seed, { body, key: BLOCK })
    }

    for (const job of pending.values()) remove(job.body)
    pending.clear()
    for (const [seed, job] of queued) pending.set(seed, job)
  })
  return null
}
