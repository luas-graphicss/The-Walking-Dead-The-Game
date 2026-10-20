'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ATMOSPHERE, FOG, SUN_DIRECTION } from '@/lib/game/atmosphere'
import { SPAWN_POSITION } from '@/lib/game/config'
import { runtime } from '@/lib/game/runtime'
import { assignShadowRing, routeShadowRings, SHADOW_BASIS, shadowCasters, shadowRings } from '@/lib/game/shadow'
import { atmosphereUniforms, installAtmosphereFog } from '@/lib/game/sky/fog'
import { installSkyLight } from '@/lib/game/sky/sky-light'
import type { WorldSession } from '@/lib/game/world/session'
import { SkyDome } from './sky-dome'
import { SkyLight } from './sky-light'
import { SunShafts } from './sun-shafts'

installAtmosphereFog()
installSkyLight()

const SPAWN_FOG_FLOOR = SPAWN_POSITION.y - FOG.floorDrop

type Still = { x: number; y: number; version: number; age: number }

export function Lighting({ session }: { session?: WorldSession }) {
  const rings = useMemo(() => shadowRings(), [])
  const lights = useRef<(THREE.DirectionalLight | null)[]>([])
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  const floor = useRef({ height: Number.NaN, teleport: -1 })
  const schedule = useMemo(() => ({
    stills: rings.map((): Still => ({ x: Number.NaN, y: Number.NaN, version: -1, age: 0 })),
    shifts: -1,
    cursor: 1,
    anchor: new THREE.Vector3(),
  }), [rings])

  useEffect(() => {
    const undo: (() => void)[] = []
    lights.current.forEach((light, index) => {
      if (!light) return
      scene.add(light.target)
      undo.push(() => scene.remove(light.target), assignShadowRing(light, index))

      if (index > 0) light.shadow.autoUpdate = false
    })
    undo.push(routeShadowRings(gl))
    for (const still of schedule.stills) still.x = Number.NaN
    return () => { for (const step of undo) step() }
  }, [scene, gl, schedule])

  useFrame((_, delta) => {

    const f = floor.current
    const ground = session?.surfaceAt(runtime.worldPosition.x, runtime.worldPosition.z) ?? runtime.playerPosition.y
    const target = ground - FOG.floorDrop
    if (Number.isNaN(f.height) || f.teleport !== runtime.teleportVersion || Math.abs(target - f.height) > 400) {
      f.height = target
      f.teleport = runtime.teleportVersion
    } else {
      f.height = THREE.MathUtils.damp(f.height, target, 0.35, Math.min(delta, 0.1))
    }
    atmosphereUniforms.fogFloor.value = f.height
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = f.height
      scene.fog.far = runtime.viewDistance
    }
    const { right, up, back } = SHADOW_BASIS
    const player = runtime.playerPosition
    const px = player.dot(right), py = player.dot(up), pz = player.dot(back)

    const place = (index: number) => {
      const light = lights.current[index]
      if (!light) return false
      const texel = rings[index].texel
      const x = Math.round(px / texel) * texel, y = Math.round(py / texel) * texel
      schedule.anchor.copy(right).multiplyScalar(x).addScaledVector(up, y).addScaledVector(back, pz)
      light.target.position.copy(schedule.anchor)
      light.target.updateMatrixWorld()
      light.position.copy(schedule.anchor).addScaledVector(SUN_DIRECTION, rings[index].distance)
      const still = schedule.stills[index]
      still.x = x; still.y = y; still.version = shadowCasters.versions[index] ?? 0; still.age = 0
      return true
    }
    const redraw = (index: number) => {
      if (place(index)) lights.current[index]!.shadow.needsUpdate = true
    }

    place(0)

    const shifted = schedule.shifts !== runtime.originShifts
    schedule.shifts = runtime.originShifts
    let drawnThisFrame = 0
    for (let index = 1; index < rings.length; index++) {
      const still = schedule.stills[index]
      still.age += delta
      if (shifted || Number.isNaN(still.x)) { redraw(index); drawnThisFrame |= 1 << index }
    }

    const outer = rings.length - 1
    for (let step = 0; step < outer; step++) {
      const index = 1 + ((schedule.cursor - 1 + step) % outer)
      if (drawnThisFrame & (1 << index)) continue
      const still = schedule.stills[index], ring = rings[index]
      const strayed = Math.abs(px - still.x) > ring.recenter || Math.abs(py - still.y) > ring.recenter
      const stale = still.version !== (shadowCasters.versions[index] ?? 0) && still.age >= ring.refresh
      if (!strayed && !stale) continue
      redraw(index)
      schedule.cursor = index + 1
      break
    }
  }, -20)

  return (
    <>
      <color attach="background" args={[ATMOSPHERE.fog]} />
      {                                                                                       }
      <fog attach="fog" args={[ATMOSPHERE.fog, SPAWN_FOG_FLOOR, 920]} />
      <SkyDome />
      <SunShafts lights={lights} />
      {                                                                                                            }
      <SkyLight session={session} />
      {                                                                                                                }
      {rings.map((ring, index) => (
        <directionalLight
          key={index}
          ref={(light) => { lights.current[index] = light }}
          color={ATMOSPHERE.sun}
          intensity={index === 0 ? ATMOSPHERE.sunIntensity : 0}
          castShadow
          shadow-mapSize={[ring.size, ring.size]}
          shadow-camera-left={-ring.extent}
          shadow-camera-right={ring.extent}
          shadow-camera-top={ring.extent}
          shadow-camera-bottom={-ring.extent}
          shadow-camera-near={ring.near}
          shadow-camera-far={ring.far}
          shadow-bias={ring.bias}
          shadow-normalBias={ring.normalBias}
        />
      ))}
    </>
  )
}
