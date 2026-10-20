'use client'

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SunShafts as Shafts } from '@/lib/game/sky/sun-shafts'

export function SunShafts({ lights }: { lights: RefObject<(THREE.DirectionalLight | null)[]> }) {
  const shafts = useMemo(() => new Shafts(), [])
  useEffect(() => () => shafts.dispose(), [shafts])
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ gl, camera }) => {
    const shown = shafts.update(gl, camera as THREE.PerspectiveCamera, lights.current ?? [])
    if (meshRef.current) meshRef.current.visible = shown
  }, -10)

  return <mesh ref={meshRef} geometry={shafts.geometry} material={shafts.overlay} frustumCulled={false} renderOrder={10_000_000} />
}
