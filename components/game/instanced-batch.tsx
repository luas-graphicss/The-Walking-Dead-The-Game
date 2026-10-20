'use client'

import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

export type Instances = { matrices: Float32Array; colors?: Float32Array }

export function Batch({ data, geometry, material, shadow = false }: { data: Instances; geometry: THREE.BufferGeometry; material: THREE.Material; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = data.matrices.length / 16
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.instanceMatrix.array.set(data.matrices)
    mesh.instanceMatrix.needsUpdate = true
    if (data.colors) mesh.instanceColor = new THREE.InstancedBufferAttribute(data.colors, 3)
    mesh.computeBoundingSphere()
    mesh.computeBoundingBox()
    return () => { mesh.dispose() }
  }, [data])
  if (!count) return null
  return <instancedMesh ref={ref} args={[geometry, material, count]} castShadow={shadow} receiveShadow dispose={null} matrixAutoUpdate={false} matrixWorldNeedsUpdate />
}
