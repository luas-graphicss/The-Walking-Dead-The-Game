import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { runtime } from '@/lib/game/runtime'
import { CHUNK_SIZE } from '@/lib/game/world/settings'

export function useChunkOrigin(group: RefObject<THREE.Group | null>, cx: number, cz: number) {
  const shifts = useRef(-1)
  useFrame(() => {
    const target = group.current
    if (!target || shifts.current === runtime.originShifts) return
    shifts.current = runtime.originShifts
    target.position.set(cx * CHUNK_SIZE - runtime.origin.x, 0, cz * CHUNK_SIZE - runtime.origin.z)
    target.updateMatrix()
  }, -90)
}

export function markStatic(objects: Iterable<THREE.Object3D>) {
  for (const object of objects) {
    object.matrixAutoUpdate = false
    object.matrixWorldNeedsUpdate = true
  }
}
