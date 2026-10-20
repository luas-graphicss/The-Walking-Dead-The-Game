import * as THREE from 'three'
import { anisotropy, isMobileDevice } from '../device'
import { SIDEWALK_STYLES, TERRAIN_LAYERS, TILE } from './catalog'
import type { GroundResponse } from './ground.worker'

export type StyleTextures = { map: THREE.DataTexture; normalMap: THREE.DataTexture; orm: THREE.DataTexture }
export type GroundTextures = {

  albedo: THREE.DataArrayTexture

  material: THREE.DataArrayTexture
  styles: StyleTextures[]
}

let pending: Promise<GroundTextures> | null = null
let loaded: GroundTextures | null = null

function filtered<T extends THREE.Texture>(texture: T, colorSpace: THREE.ColorSpace) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = anisotropy()
  texture.colorSpace = colorSpace
  texture.needsUpdate = true
  return texture
}

function build({ size, albedo, material, styles }: Pick<GroundResponse, 'size' | 'albedo' | 'material' | 'styles'>): GroundTextures {
  const array = (data: Uint8Array, colorSpace: THREE.ColorSpace) => filtered(new THREE.DataArrayTexture(data, size, size, TERRAIN_LAYERS.length), colorSpace)
  return {
    albedo: array(albedo, THREE.SRGBColorSpace),
    material: array(material, THREE.NoColorSpace),
    styles: styles.map((set, index) => {

      const repeat = TILE.sidewalk / SIDEWALK_STYLES[index].tile
      const texture = (data: Uint8Array, colorSpace: THREE.ColorSpace) => {
        const result = filtered(new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType), colorSpace)
        result.repeat.set(repeat, repeat)
        return result
      }
      return { map: texture(set.albedo, THREE.SRGBColorSpace), normalMap: texture(set.normal, THREE.NoColorSpace), orm: texture(set.orm, THREE.NoColorSpace) }
    }),
  }
}

function fallback(): GroundTextures {
  const size = 4, bytes = size * size * 4
  const solid = (value: [number, number, number, number], layers: number) => {
    const data = new Uint8Array(bytes * layers)
    for (let i = 0; i < data.length; i += 4) data.set(value, i)
    return data
  }
  return build({
    size,
    albedo: solid([118, 112, 96, 128], TERRAIN_LAYERS.length), material: solid([128, 128, 235, 255], TERRAIN_LAYERS.length),
    styles: SIDEWALK_STYLES.map(() => ({ albedo: solid([150, 150, 145, 255], 1), normal: solid([128, 128, 255, 255], 1), orm: solid([255, 230, 0, 255], 1) })),
  })
}

export function groundTexturesReady() {
  if (pending) return pending
  pending = new Promise<GroundTextures>((resolve) => {
    const size = isMobileDevice() || (typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches) ? 512 : 1024
    const finish = (textures: GroundTextures) => { loaded = textures; resolve(textures) }
    let worker: Worker
    try {
      worker = new Worker(new URL('./ground.worker.ts', import.meta.url), { type: 'module', name: 'twd-ground-maps' })
    } catch (error) {
      console.error('[ground] Worker de texturas indisponível:', error)
      finish(fallback())
      return
    }
    worker.onmessage = ({ data }: MessageEvent<GroundResponse>) => {
      worker.terminate()
      if (data.failed.length) console.error(`[ground] Texturas não carregadas: ${data.failed.join(', ')}`)
      finish(build(data))
    }
    worker.onerror = (event) => {
      worker.terminate()
      console.error('[ground] Falha ao derivar as texturas do solo:', event.message)
      finish(fallback())
    }
    worker.postMessage({ size })
  })
  return pending
}

export function groundTextures() {
  if (!loaded) throw new Error('As texturas do solo ainda não foram carregadas.')
  return loaded
}
