import * as THREE from 'three'

let gridTexture: THREE.CanvasTexture | null = null

function getGridTexture() {
  if (gridTexture) return gridTexture

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (context) {
    context.fillStyle = '#f0f0f0'
    context.fillRect(0, 0, size, size)

    context.strokeStyle = 'rgba(0, 0, 0, 0.08)'
    context.lineWidth = 2
    context.beginPath()
    for (let step = 1; step < 4; step++) {
      const offset = (step * size) / 4
      context.moveTo(offset, 0)
      context.lineTo(offset, size)
      context.moveTo(0, offset)
      context.lineTo(size, offset)
    }
    context.stroke()

    context.strokeStyle = 'rgba(0, 0, 0, 0.28)'
    context.lineWidth = 6
    context.strokeRect(0, 0, size, size)
  }

  gridTexture = new THREE.CanvasTexture(canvas)
  gridTexture.wrapS = THREE.RepeatWrapping
  gridTexture.wrapT = THREE.RepeatWrapping
  gridTexture.colorSpace = THREE.SRGBColorSpace
  gridTexture.anisotropy = 8
  return gridTexture
}

const materials = new Map<string, THREE.MeshStandardMaterial>()

export function getBlockoutMaterial(color: string, grid = true) {
  const key = `${color}:${grid}`
  let material = materials.get(key)
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0,
      map: grid ? getGridTexture() : null,
    })
    materials.set(key, material)
  }
  return material
}
