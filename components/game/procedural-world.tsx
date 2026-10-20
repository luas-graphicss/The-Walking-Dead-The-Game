'use client'

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { setWorldOrigin } from '@/lib/game/assets/terrain-material'
import { requestTravel, runtime } from '@/lib/game/runtime'
import { CHUNK_SIZE, REBASE_DISTANCE, VIEW_RADIUS, originFor } from '@/lib/game/world/settings'
import type { WorldSession } from '@/lib/game/world/session'
import { FATE_LABELS, KIND_LABELS, settlementProfile } from '@/lib/game/world/settlements'
import { ScatterContext, ScatterLayer } from './scatter-layer'
import { ScatterPools } from './scatter-pools'
import { Settlements } from './settlements'
import { TerrainChunk } from './terrain-chunk'

declare global {
  interface Window {
    __TWD_DEBUG__?: () => Record<string, unknown>
    __TWD_TRAVEL__?: (x: number, z: number) => void
    __TWD_PERF__?: () => Record<string, { objects: number; draws: number; instances: number; triangles: number }>
  }
}

type DrawStats = { objects: number; draws: number; instances: number; triangles: number }

function perfBreakdown(scene: THREE.Scene) {
  const groups: Record<string, DrawStats> = {}
  scene.traverseVisible((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    const name = (object.name || material?.name || object.type).replace(/-\d+$/, '')
    const entry = (groups[name] ??= { objects: 0, draws: 0, instances: 0, triangles: 0 })
    const batched = object as THREE.BatchedMesh & { _multiDrawCount?: number; _multiDrawCounts?: Int32Array }
    const instanced = object as THREE.InstancedMesh
    const indices = mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position')?.count ?? 0
    entry.objects++
    if (batched.isBatchedMesh) {
      const count = batched._multiDrawCount ?? 0
      entry.draws += count
      entry.instances += count
      for (let i = 0; i < count; i++) entry.triangles += (batched._multiDrawCounts?.[i] ?? 0) / 3
    } else if (instanced.isInstancedMesh) {
      entry.draws++
      entry.instances += instanced.count
      entry.triangles += (indices / 3) * instanced.count
    } else {
      const drawRange = Math.min(indices, mesh.geometry.drawRange.count)
      entry.draws++
      entry.instances++
      entry.triangles += drawRange / 3
    }
  })
  return groups
}

export function ProceduralWorld({ session }: { session: WorldSession }) {
  useSyncExternalStore(session.subscribe, session.getSnapshot, () => 0)
  const { world } = useRapier()
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const stats = useRef({ time: 0, frames: 0, lastInfo: 0 })
  const scatter = useMemo(() => new ScatterPools(), [session])
  useEffect(() => () => scatter.dispose(), [scatter])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' && !new URLSearchParams(location.search).has('debug')) return
    window.__TWD_TRAVEL__ = (x, z) => requestTravel(x, z)
    window.__TWD_DEBUG__ = () => ({
      seed: session.seed, ready: runtime.terrainReady, phase: runtime.phase, mode: runtime.mode,
      town: session.terrain.nearestTown(runtime.worldPosition.x, runtime.worldPosition.z),
      position: runtime.worldPosition.toArray(), localPosition: runtime.playerPosition.toArray(), origin: { ...runtime.origin },
      originShifts: runtime.originShifts, grounded: runtime.grounded, speed: runtime.speed, stamina: runtime.stamina,
      loadedChunks: session.loadedCount, collisionChunks: session.colliders.size, pendingChunks: session.pendingCount,
      biome: runtime.biome, location: runtime.location, fps: runtime.fps, error: session.error,
      travelPending: Boolean(runtime.travelTarget || runtime.arrival),
      render: { ...gl.info.render }, memory: { ...gl.info.memory }, programs: gl.info.programs?.length ?? 0,
    })
    window.__TWD_PERF__ = () => perfBreakdown(scene)
    return () => { delete window.__TWD_DEBUG__; delete window.__TWD_TRAVEL__; delete window.__TWD_PERF__ }
  }, [session, gl, scene])

  useFrame(({ camera }, delta) => {
    const shiftOrigin = (x: number, z: number) => {
      const dx = x - runtime.origin.x, dz = z - runtime.origin.z
      if (!dx && !dz) return
      world.forEachRigidBody((body) => {
        const position = body.translation()
        const shifted = { x: position.x - dx, y: position.y, z: position.z - dz }
        body.setTranslation(shifted, false)
        if (body.isKinematic()) body.setNextKinematicTranslation(shifted)
      })
      runtime.playerPosition.x -= dx; runtime.playerPosition.z -= dz
      camera.position.x -= dx; camera.position.z -= dz
      runtime.origin.x = x; runtime.origin.z = z; runtime.originShifts++
    }

    if (runtime.travelTarget) {
      const target = runtime.travelTarget
      if (!runtime.playerBody) { session.setFocus(target.x, target.z); return }
      const origin = originFor(target.x, target.z)
      shiftOrigin(origin.x, origin.z)
      const y = Math.max(session.terrain.height(target.x, target.z), session.terrain.surface(target.x, target.z).waterLevel) + 3
      const local = { x: target.x - origin.x, y, z: target.z - origin.z }
      runtime.playerBody?.setTranslation(local, true)
      runtime.playerBody?.setNextKinematicTranslation(local)
      runtime.playerPosition.set(local.x, local.y, local.z)
      runtime.worldPosition.set(target.x, y, target.z)
      runtime.playerVelocity.set(0, 0, 0)
      runtime.arrival = target; runtime.mode = target.mode
      runtime.travelTarget = null; runtime.terrainReady = false; runtime.teleportVersion++
      session.setFocus(target.x, target.z, true)
    } else {
      const position = runtime.playerBody?.translation() ?? runtime.playerPosition
      if (Math.abs(position.x) > REBASE_DISTANCE || Math.abs(position.z) > REBASE_DISTANCE) {
        const origin = originFor(position.x + runtime.origin.x, position.z + runtime.origin.z)
        shiftOrigin(origin.x, origin.z)
      }
      const local = runtime.playerBody?.translation() ?? runtime.playerPosition
      runtime.worldPosition.set(local.x + runtime.origin.x, local.y, local.z + runtime.origin.z)
      session.setFocus(runtime.worldPosition.x, runtime.worldPosition.z)
    }

    setWorldOrigin(runtime.origin.x, runtime.origin.z)
    runtime.viewDistance = CHUNK_SIZE * (VIEW_RADIUS[session.quality] - 0.45)
    const s = stats.current
    s.time += delta; s.lastInfo += delta; s.frames++
    if (s.time > 0.7) { runtime.fps = Math.round(s.frames / s.time); s.time = 0; s.frames = 0 }
    if (s.lastInfo > 0.45) {
      const sample = session.terrain.sample(runtime.worldPosition.x, runtime.worldPosition.z)
      const town = session.terrain.nearestTown(runtime.worldPosition.x, runtime.worldPosition.z)
      runtime.biome = sample.biome; runtime.waterLevel = sample.waterLevel
      const inTown = !town.wet && Math.hypot(runtime.worldPosition.x - town.x, runtime.worldPosition.z - town.z) < town.radius * 1.5
      runtime.location = inTown ? `${town.name} · ${KIND_LABELS[town.kind].toLowerCase()} ${FATE_LABELS[settlementProfile(session.terrain, town).fate]}` : 'Área selvagem'
      s.lastInfo = 0
    }
  }, -100)

  return (
    <ScatterContext.Provider value={scatter}>
      {[...session.chunks.values()].map((data) => <TerrainChunk key={data.key} data={data} session={session} />)}
      <Settlements session={session} />
      <ScatterLayer scatter={scatter} session={session} />
    </ScatterContext.Provider>
  )
}
