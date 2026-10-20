import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'

export async function compressGlb(bytes: Buffer) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
  const jsonLength = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
  if (json.extensionsRequired?.includes('EXT_meshopt_compression')) return bytes
  const binaryStart = 20 + jsonLength + 8, uncompressedLength = json.buffers[0].byteLength
  const chunks: Buffer[] = []
  let offset = 0
  const components: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
  const bytesPerComponent: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }
  const accessorByView = new Map<number, { bufferView: number; byteOffset?: number; type: string; componentType: number; count: number }>()
  for (const accessor of json.accessors) if (!accessorByView.has(accessor.bufferView)) accessorByView.set(accessor.bufferView, accessor)
  for (const [i, view] of json.bufferViews.entries()) {
    const raw = bytes.subarray(binaryStart + (view.byteOffset ?? 0), binaryStart + (view.byteOffset ?? 0) + view.byteLength)
    let data: Buffer = raw
    const padding = (4 - offset % 4) % 4
    if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding }
    if (view.target) {
      const accessor = accessorByView.get(i)
      if (!accessor || accessor.byteOffset) throw new Error('O compactador requer os streams separados do exportador da oficina.')
      const stride = components[accessor.type] * bytesPerComponent[accessor.componentType]
      if (stride * accessor.count !== raw.byteLength) throw new Error('Stride divergente durante compactação.')
      const mode = view.target === 34963 ? 'INDICES' : 'ATTRIBUTES'
      data = Buffer.from(MeshoptEncoder.encodeGltfBuffer(raw, accessor.count, stride, mode, 0))
      const decoded = Buffer.alloc(raw.byteLength)
      MeshoptDecoder.decodeGltfBuffer(decoded, accessor.count, stride, data, mode, 'NONE')
      if (!raw.equals(decoded)) throw new Error('Compactação alterou bytes da geometria; exportação bloqueada.')
      view.extensions = { EXT_meshopt_compression: { buffer: 0, byteOffset: offset, byteLength: data.byteLength, byteStride: stride, count: accessor.count, mode, filter: 'NONE' } }
      view.buffer = 1
    } else {
      view.buffer = 0
      view.byteOffset = offset
    }
    chunks.push(data); offset += data.byteLength
  }
  json.extensionsUsed = [...(json.extensionsUsed ?? []), 'EXT_meshopt_compression']
  json.extensionsRequired = [...(json.extensionsRequired ?? []), 'EXT_meshopt_compression']
  json.buffers = [{ byteLength: offset }, { byteLength: uncompressedLength, extensions: { EXT_meshopt_compression: { fallback: true } } }]
  json.asset.extras = { ...json.asset.extras, compression: 'Meshopt sem quantização; atributos e índices verificados byte a byte.' }
  const text = Buffer.from(JSON.stringify(json)), paddedJson = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)])
  const binary = Buffer.concat([...chunks, Buffer.alloc((4 - offset % 4) % 4)])
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + paddedJson.length + binary.length, 8)
  header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, paddedJson, binHeader, binary])
}
