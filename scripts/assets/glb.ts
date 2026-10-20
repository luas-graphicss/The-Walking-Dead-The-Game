import { createHash } from 'node:crypto'
import type { Model, Vec3 } from './mesh'

export type GlbImage = { name: string; mime: 'image/png' | 'image/jpeg' | 'image/webp' } & ({ data: Buffer; uri?: never } | { uri: string; data?: never })

export type GlbMaterial = {
  name: string
  albedo?: number
  normal?: number
  orm?: number
  metallic?: number
  normalScale?: number
  alphaCutoff?: number
  doubleSided?: boolean
}
export type GlbNode = { model: Model; translation: Vec3; rotation?: [number, number, number, number]; group?: string; name?: string }

const FLOAT = 5126, UINT8 = 5121, UINT16 = 5123, UINT32 = 5125
const ARRAY_BUFFER = 34962, ELEMENT_ARRAY_BUFFER = 34963

function packColors(rgb: Float32Array) {
  const out = new Uint8Array((rgb.length / 3) * 4)
  for (let i = 0, k = 0; i < rgb.length; i += 3, k += 4) {
    for (let c = 0; c < 3; c++) out[k + c] = Math.round(Math.min(1, Math.max(0, rgb[i + c])) * 255)
    out[k + 3] = 255
  }
  return out
}

export function writeGlb(nodes: GlbNode[], materials: GlbMaterial[], images: GlbImage[], materialIndex: Map<string, number>) {
  const chunks: Buffer[] = []
  let offset = 0
  const bufferViews: Record<string, unknown>[] = []
  const accessors: Record<string, unknown>[] = []
  const viewCache = new Map<string, number>()
  const pushView = (data: Buffer, target?: number) => {
    const key = `${target ?? 0}:${createHash('sha256').update(data).digest('hex')}`
    const existing = viewCache.get(key)
    if (existing !== undefined) return existing
    const pad = (4 - (offset % 4)) % 4
    if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad }
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length, ...(target ? { target } : {}) })
    chunks.push(data)
    offset += data.length
    viewCache.set(key, bufferViews.length - 1)
    return bufferViews.length - 1
  }
  const pushAccessor = (array: Float32Array | Uint8Array | Uint16Array | Uint32Array, type: 'VEC2' | 'VEC3' | 'VEC4' | 'SCALAR', target: number, bounds = false) => {
    const view = pushView(Buffer.from(array.buffer, array.byteOffset, array.byteLength), target)
    const size = type === 'VEC4' ? 4 : type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1
    const accessor: Record<string, unknown> = {
      bufferView: view,
      componentType: array instanceof Float32Array ? FLOAT : array instanceof Uint8Array ? UINT8 : array instanceof Uint16Array ? UINT16 : UINT32,
      count: array.length / size, type,

      ...(array instanceof Uint8Array ? { normalized: true } : {}),
    }
    if (bounds) {
      const min = [Infinity, Infinity, Infinity].slice(0, size), max = [-Infinity, -Infinity, -Infinity].slice(0, size)
      for (let i = 0; i < array.length; i++) { const k = i % size; min[k] = Math.min(min[k], array[i]); max[k] = Math.max(max[k], array[i]) }
      accessor.min = min; accessor.max = max
    }
    accessors.push(accessor)
    return accessors.length - 1
  }

  const uniqueModels = [...new Set(nodes.map((node) => node.model))]
  const meshIndex = new Map(uniqueModels.map((model, i) => [model, i]))
  const meshes = uniqueModels.map((model) => ({
    name: model.name,
    primitives: [...model.parts.entries()].map(([material, part]) => {
      const vertexCount = part.groups.length
      const indices = vertexCount < 65_536 ? Uint16Array.from(part.indices) : Uint32Array.from(part.indices)
      const index = materialIndex.get(material)
      if (index === undefined) throw new Error(`Material ${material} sem definição no kit.`)
      return {
        attributes: {
          POSITION: pushAccessor(Float32Array.from(part.positions), 'VEC3', ARRAY_BUFFER, true),
          NORMAL: pushAccessor(part.normals, 'VEC3', ARRAY_BUFFER),

          TEXCOORD_0: pushAccessor(Float32Array.from(part.uvs, (value, i) => (i % 2 ? 1 - value : value)), 'VEC2', ARRAY_BUFFER),
          ...(part.colors ? { COLOR_0: pushAccessor(packColors(part.colors), 'VEC4', ARRAY_BUFFER) } : {}),
        },
        indices: pushAccessor(indices, 'SCALAR', ELEMENT_ARRAY_BUFFER),
        material: index,
      }
    }),
  }))
  const imageDefs = images.map((image) => ({ name: image.name, mimeType: image.mime, ...(image.uri ? { uri: image.uri } : { bufferView: pushView(image.data!) }) }))
  const sceneNodes: Record<string, unknown>[] = nodes.map(({ model, translation, rotation, name }) => ({ name: name ?? model.name, mesh: meshIndex.get(model), translation, ...(rotation ? { rotation } : {}) }))
  const groups = new Map<string, number[]>()
  const roots: number[] = []
  nodes.forEach((node, i) => {
    if (!node.group) { roots.push(i); return }
    const children = groups.get(node.group) ?? []
    children.push(i); groups.set(node.group, children)
  })
  for (const [name, children] of groups) { roots.push(sceneNodes.length); sceneNodes.push({ name, children }) }
  const webp = images.some((image) => image.mime === 'image/webp')

  const json = {
    asset: { version: '2.0', generator: 'The Walking Dead asset pipeline (scripts/build-assets.ts)' },
    scene: 0,
    scenes: [{ name: 'kit', nodes: roots }],
    nodes: sceneNodes,
    ...(webp ? { extensionsUsed: ['EXT_texture_webp'], extensionsRequired: ['EXT_texture_webp'] } : {}),
    meshes,
    materials: materials.map((m) => ({
      name: m.name,
      pbrMetallicRoughness: {
        ...(m.albedo !== undefined ? { baseColorTexture: { index: m.albedo } } : {}),
        ...(m.orm !== undefined ? { metallicRoughnessTexture: { index: m.orm } } : {}),
        metallicFactor: m.metallic ?? (m.orm !== undefined ? 1 : 0),
        roughnessFactor: 1,
      },
      ...(m.normal !== undefined ? { normalTexture: { index: m.normal, scale: m.normalScale ?? 1 } } : {}),
      ...(m.orm !== undefined ? { occlusionTexture: { index: m.orm, strength: 1 } } : {}),
      ...(m.alphaCutoff !== undefined ? { alphaMode: 'MASK', alphaCutoff: m.alphaCutoff } : {}),
      ...(m.doubleSided ? { doubleSided: true } : {}),
    })),
    ...(images.length ? {
      textures: images.map((image, i) => image.mime === 'image/webp' ? { sampler: 0, extensions: { EXT_texture_webp: { source: i } } } : { sampler: 0, source: i }),
      images: imageDefs,
      samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    } : {}),
    buffers: [{ byteLength: offset }],
    bufferViews,
    accessors,
  }
  const bin = Buffer.concat(chunks)
  const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)])
  const jsonText = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonPadded = Buffer.concat([jsonText, Buffer.alloc((4 - (jsonText.length % 4)) % 4, 0x20)])
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8)
  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonPadded.length, 0)
  jsonHeader.writeUInt32LE(0x4e4f534a, 4)
  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(binPadded.length, 0)
  binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded])
}
