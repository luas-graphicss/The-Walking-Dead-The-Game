'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { isMobileDevice } from '@/lib/game/device'
import { runtime } from '@/lib/game/runtime'
import { LOCAL_SHADOW_NEAR } from '@/lib/game/shadow'

type LocalLightProps = {
  kind?: 'point' | 'spot'

  position: [number, number, number]

  target?: [number, number, number]
  color?: THREE.ColorRepresentation

  intensity?: number

  range?: number

  radius?: number

  angle?: number
  penumbra?: number

  shadows?: 'dynamic' | 'static' | 'off'

  shadowDistance?: number
}

const lightPosition = new THREE.Vector3()

export function LocalLight({
  kind = 'point', position, target, color = '#ffb46b', intensity = 40, range = 18, radius = 0.05,
  angle = Math.PI / 4, penumbra = 0.35, shadows = 'dynamic', shadowDistance = 35,
}: LocalLightProps) {
  const light = useRef<THREE.PointLight | THREE.SpotLight | null>(null)
  const scene = useThree((state) => state.scene)
  const frame = useRef(0)
  const [tx, ty, tz] = target ?? [position[0], position[1] - 1, position[2]]

  useEffect(() => {
    const current = light.current
    if (!current) return
    const shadow = current.shadow
    const size = isMobileDevice() ? 512 : 1024
    shadow.mapSize.set(size, size)
    shadow.radius = radius
    shadow.bias = kind === 'spot' ? -0.0002 : -0.001
    shadow.normalBias = 0.02

    shadow.camera.near = kind === 'spot' ? LOCAL_SHADOW_NEAR : 0.1
    shadow.camera.far = range
    shadow.camera.updateProjectionMatrix()
    shadow.autoUpdate = shadows === 'dynamic'
    shadow.needsUpdate = true
    if (!(current instanceof THREE.SpotLight)) return
    current.target.position.set(tx, ty, tz)
    scene.add(current.target)
    return () => { scene.remove(current.target) }
  }, [kind, radius, range, shadows, scene, tx, ty, tz])

  useFrame(() => {
    const current = light.current
    if (!current || shadows === 'off') return
    current.getWorldPosition(lightPosition)
    const fade = 1 - THREE.MathUtils.smoothstep(lightPosition.distanceTo(runtime.playerPosition), shadowDistance * 0.75, shadowDistance)
    current.shadow.intensity = fade

    if (shadows === 'dynamic') current.shadow.autoUpdate = fade > 0 && (!isMobileDevice() || frame.current++ % 3 === 0)
  })

  const common = { color, intensity, distance: range, decay: 2, castShadow: shadows !== 'off' }
  return kind === 'spot'
    ? <spotLight ref={(value) => { light.current = value }} position={position} angle={angle} penumbra={penumbra} {...common} />
    : <pointLight ref={(value) => { light.current = value }} position={position} {...common} />
}
