import * as THREE from 'three'

const cache = new Map<string, THREE.BufferGeometry>()

function cached<T extends THREE.BufferGeometry>(key: string, create: () => T): T {
  const existing = cache.get(key)
  if (existing) return existing as T
  const geometry = create()
  cache.set(key, geometry)
  return geometry
}

export function getBoxGeometry(width: number, height: number, depth: number) {
  return cached(`box:${width}:${height}:${depth}`, () => {
    const geometry = new THREE.BoxGeometry(width, height, depth)
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute

    const faceSizes = [
      [depth, height],
      [depth, height],
      [width, depth],
      [width, depth],
      [width, height],
      [width, height],
    ]
    faceSizes.forEach(([u, v], face) => {
      for (let vertex = 0; vertex < 4; vertex++) {
        const index = face * 4 + vertex
        uv.setXY(index, uv.getX(index) * u, uv.getY(index) * v)
      }
    })
    return geometry
  })
}

export function getGroundGeometry(width: number, depth: number) {
  return cached(`ground:${width}:${depth}`, () => {
    const geometry = new THREE.PlaneGeometry(width, depth)
    geometry.rotateX(-Math.PI / 2)
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, uv.getX(index) * width, uv.getY(index) * depth)
    }
    return geometry
  })
}

export function getCylinderGeometry(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
) {
  return cached(
    `cylinder:${radiusTop}:${radiusBottom}:${height}:${segments}`,
    () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
  )
}

export function getConeGeometry(radius: number, height: number, segments: number) {
  return cached(
    `cone:${radius}:${height}:${segments}`,
    () => new THREE.ConeGeometry(radius, height, segments),
  )
}

export function getGableRoofGeometry(width: number, height: number, depth: number) {
  return cached(`gable:${width}:${height}:${depth}`, () => {
    const radius = width / Math.sqrt(3)
    const prism = new THREE.CylinderGeometry(radius, radius, depth, 3, 1)
    prism.rotateX(-Math.PI / 2)
    prism.scale(1, height / (1.5 * radius), 1)
    prism.translate(0, height / 3, 0)
    const faceted = prism.toNonIndexed()
    faceted.computeVertexNormals()
    prism.dispose()
    return faceted
  })
}
