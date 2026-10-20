'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { runtime } from '@/lib/game/runtime'
import { buildSkyEnvironment } from '@/lib/game/sky/sky-light'
import { SkyOcclusion } from '@/lib/game/sky/sky-occlusion'
import type { WorldSession } from '@/lib/game/world/session'

export function SkyLight({ session }: { session?: WorldSession }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const occlusion = useRef<SkyOcclusion | null>(null)
  useEffect(() => {
    const map = new SkyOcclusion()
    occlusion.current = map
    return () => {
      if (occlusion.current === map) occlusion.current = null
      map.dispose()
    }
  }, [])

  useLayoutEffect(() => {
    const environment = buildSkyEnvironment(gl)
    const previous = scene.environment, intensity = scene.environmentIntensity
    scene.environment = environment.texture
    scene.environmentIntensity = 1
    return () => {
      scene.environment = previous
      scene.environmentIntensity = intensity
      environment.dispose()
    }
  }, [gl, scene])

  useFrame((state, delta) => {
    const player = runtime.playerPosition, world = runtime.worldPosition
    const surface = session?.surfaceAt(world.x, world.z)
    const ground = typeof surface === 'number' && Number.isFinite(surface) ? surface : player.y
    occlusion.current?.schedule(state.scene, player.x, player.z, ground, Math.min(delta, 0.1))
  }, -16)

  return null
}
