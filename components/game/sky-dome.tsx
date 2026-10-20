'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldUniforms } from '@/lib/game/assets/terrain-material'
import { runtime } from '@/lib/game/runtime'
import { CloudSky } from '@/lib/game/sky/clouds'
import { skyDomeMaterial } from '@/lib/game/sky/sky-dome-material'

export function SkyDome() {
  const meshRef = useRef<THREE.Mesh>(null)
  const clouds = useMemo(() => new CloudSky(), [])
  useEffect(() => () => clouds.dispose(), [clouds])
  const material = useMemo(() => skyDomeMaterial(), [])
  useEffect(() => () => material.dispose(), [material])
  const eye = useMemo(() => ({ x: 0, y: 0, z: 0 }), [])

  useFrame(({ gl, camera, clock }) => {
    meshRef.current?.position.copy(camera.position)
    worldUniforms.time.value = clock.elapsedTime
    eye.x = camera.position.x + runtime.origin.x
    eye.y = camera.position.y
    eye.z = camera.position.z + runtime.origin.z
    clouds.update(gl, eye, clock.elapsedTime)
  }, -15)

  return (
    <mesh ref={meshRef} material={material} renderOrder={1000} frustumCulled={false}>
      <sphereGeometry args={[3_200, 48, 24]} />
    </mesh>
  )
}
