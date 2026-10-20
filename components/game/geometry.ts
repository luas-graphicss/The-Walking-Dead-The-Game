import * as THREE from 'three'
import type { MeshData } from '@/lib/game/world/types'

export function geometryFrom(data: MeshData) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
  if (data.alphas) {

    const colors = new Float32Array((data.colors.length / 3) * 4)
    for (let i = 0; i < data.alphas.length; i++) colors.set([data.colors[i * 3], data.colors[i * 3 + 1], data.colors[i * 3 + 2], data.alphas[i]], i * 4)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
  } else {
    geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
  }
  if (data.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2))
  if (data.splat) {

    const splat = new THREE.InterleavedBuffer(data.splat, 12)
    geometry.setAttribute('splatA', new THREE.InterleavedBufferAttribute(splat, 4, 0, true))
    geometry.setAttribute('splatB', new THREE.InterleavedBufferAttribute(splat, 4, 4, true))
    geometry.setAttribute('splatC', new THREE.InterleavedBufferAttribute(splat, 4, 8, true))
  }
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))
  if (data.groups) for (let i = 0; i < data.groups.length; i += 3) geometry.addGroup(data.groups[i], data.groups[i + 1], data.groups[i + 2])
  geometry.computeBoundingSphere()
  return geometry
}
