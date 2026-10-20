import { SIDEWALK_STYLES, TERRAIN_LAYERS, groundUrl } from './catalog'
import { deriveGroundMaps, packStandardSet, packTerrainLayer } from './ground-maps'

export type GroundRequest = { size: number }
export type GroundResponse = {
  size: number

  albedo: Uint8Array; material: Uint8Array
  styles: { albedo: Uint8Array; normal: Uint8Array; orm: Uint8Array }[]
  failed: string[]
}

const scope = self as unknown as {
  onmessage: (event: MessageEvent<GroundRequest>) => void
  postMessage: (message: GroundResponse, transfer?: Transferable[]) => void
}

async function decode(name: string, size: number, context: OffscreenCanvasRenderingContext2D) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(groundUrl(name, size <= 512))
      if (!response.ok) throw new Error(String(response.status))
      const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
      context.clearRect(0, 0, size, size)
      context.drawImage(bitmap, 0, 0, size, size)
      bitmap.close()
      return context.getImageData(0, 0, size, size).data
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
  }
  return null
}

scope.onmessage = async ({ data }) => {
  const size = data.size
  const canvas = new OffscreenCanvas(size, size)
  const context = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
  context.imageSmoothingQuality = 'high'
  const layerBytes = size * size * 4
  const albedo = new Uint8Array(layerBytes * TERRAIN_LAYERS.length), material = new Uint8Array(layerBytes * TERRAIN_LAYERS.length)
  const failed: string[] = []
  const neutral = () => new Uint8ClampedArray(layerBytes).fill(128)
  for (const [index, layer] of TERRAIN_LAYERS.entries()) {
    const rgba = (await decode(layer.name, size, context)) ?? (failed.push(layer.name), neutral())
    packTerrainLayer(rgba, deriveGroundMaps(rgba, size, layer), albedo, material, index * layerBytes)
  }
  const styles: GroundResponse['styles'] = []
  for (const style of SIDEWALK_STYLES) {
    const rgba = (await decode(style.name, size, context)) ?? (failed.push(style.name), neutral())
    styles.push(packStandardSet(rgba, deriveGroundMaps(rgba, size, style), size))
  }
  const transfer: Transferable[] = [albedo.buffer, material.buffer]
  for (const set of styles) transfer.push(set.albedo.buffer, set.normal.buffer, set.orm.buffer)
  scope.postMessage({ size, albedo, material, styles, failed }, transfer)
}
