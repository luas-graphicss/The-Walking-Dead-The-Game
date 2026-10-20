import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import * as THREE from 'three'

const [gltfPath, textureDir] = process.argv.slice(2)
if (!gltfPath || !textureDir) throw new Error('usage: build-survivor.ts <survivor.gltf> <Textures dir>')
const OUT = 'public/models/survivor'
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const Q = () => new THREE.Quaternion()
const FORWARD = V(0, 0, 1)

type GltfNode = { name: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; mesh?: number; skin?: number }
const gltf = JSON.parse(readFileSync(gltfPath, 'utf8'))
const nodes: GltfNode[] = gltf.nodes
const parentOf = new Map<number, number>()
nodes.forEach((node, i) => node.children?.forEach((child) => parentOf.set(child, i)))
const nodeIndex = (name: string) => {
  const index = nodes.findIndex((node) => node.name === name)
  if (index < 0) throw new Error(`missing node ${name}`)
  return index
}
const rootIndex = gltf.scenes[gltf.scene ?? 0].nodes[0] as number

function bindGlobals() {
  const rot: THREE.Quaternion[] = [], pos: THREE.Vector3[] = []
  const visit = (i: number) => {
    if (rot[i]) return
    const node = nodes[i], local = Q().fromArray(node.rotation ?? [0, 0, 0, 1]), offset = V().fromArray(node.translation ?? [0, 0, 0])
    const parent = parentOf.get(i)
    if (parent === undefined) { rot[i] = local; pos[i] = offset; return }
    visit(parent)
    rot[i] = rot[parent].clone().multiply(local)
    pos[i] = pos[parent].clone().add(offset.applyQuaternion(rot[parent]))
  }
  nodes.forEach((_, i) => visit(i))
  return { rot, pos }
}

{
  const { pos } = bindGlobals()
  const toes = pos[nodeIndex('Bip01 L Toe0')].clone().add(pos[nodeIndex('Bip01 R Toe0')])
  const feet = pos[nodeIndex('Bip01 L Foot')].clone().add(pos[nodeIndex('Bip01 R Foot')])
  const facing = toes.sub(feet).setY(0).normalize()
  const turn = Q().setFromUnitVectors(facing, FORWARD)
  const root = nodes[rootIndex]
  root.rotation = turn.multiply(Q().fromArray(root.rotation ?? [0, 0, 0, 1])).toArray() as number[]
  console.log('model facing', facing.toArray().map((v) => v.toFixed(3)).join(', '), '→ +Z')
}

function readTga(path: string) {
  const b = readFileSync(path)
  const idLength = b[0], type = b[2], width = b.readUInt16LE(12), height = b.readUInt16LE(14), channels = b[16] / 8, topDown = (b[17] & 0x20) !== 0
  if (type !== 2) throw new Error(`${path}: only uncompressed true-colour TGA is supported`)
  const out = Buffer.alloc(width * height * channels), start = 18 + idLength
  for (let y = 0; y < height; y++) {
    const row = topDown ? y : height - 1 - y
    for (let x = 0; x < width; x++) {
      const s = start + (row * width + x) * channels, d = (y * width + x) * channels
      out[d] = b[s + 2]; out[d + 1] = b[s + 1]; out[d + 2] = b[s]
      if (channels === 4) out[d + 3] = b[s + 3]
    }
  }
  return { width, height, channels: channels as 3 | 4, data: out }
}
const tex = (name: string) => readTga(join(textureDir, name))
const prefix = readFileSync(gltfPath, 'utf8').match(/m\d{3}_body/)?.[0].slice(0, 4) ?? 'm013'
async function webp(image: ReturnType<typeof readTga>, size: number, quality: number) {
  return sharp(image.data, { raw: { width: image.width, height: image.height, channels: image.channels } }).resize(size, size).webp({ quality, alphaQuality: 90, effort: 6 }).toBuffer()
}

function roughnessFrom(spec: ReturnType<typeof readTga>) {
  const out = Buffer.alloc(spec.width * spec.height * 3)
  for (let i = 0; i < spec.width * spec.height; i++) {
    const s = spec.data[i * spec.channels] / 255
    out[i * 3] = 255
    out[i * 3 + 1] = Math.round(255 * Math.min(0.95, Math.max(0.32, 0.92 - Math.sqrt(s) * 0.62)))
    out[i * 3 + 2] = 0
  }
  return { width: spec.width, height: spec.height, channels: 3 as const, data: out }
}
async function writeGlb() {
const images = await Promise.all([
  webp(tex(`${prefix}_body_color.tga`), 2048, 86),
  webp(tex(`${prefix}_body_normal.tga`), 2048, 90),
  webp(roughnessFrom(tex(`${prefix}_body_specular.tga`)), 1024, 80),
  webp(tex(`${prefix}_head_color.tga`), 1024, 88),
  webp(tex(`${prefix}_head_normal.tga`), 1024, 90),
  webp(roughnessFrom(tex(`${prefix}_head_specular.tga`)), 512, 80),
  webp(tex(`${prefix}_opacity_color.tga`), 1024, 88),
])
const bin = readFileSync(join(dirname(gltfPath), gltf.buffers[0].uri))
const pad = (n: number) => (4 - (n % 4)) % 4
const parts: Buffer[] = [bin, Buffer.alloc(pad(bin.length))]
let offset = bin.length + pad(bin.length)
gltf.images = images.map((data) => {
  gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length })
  parts.push(data, Buffer.alloc(pad(data.length)))
  offset += data.length + pad(data.length)
  return { bufferView: gltf.bufferViews.length - 1, mimeType: 'image/webp' }
})
gltf.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }]
gltf.textures = images.map((_, i) => ({ sampler: 0, extensions: { EXT_texture_webp: { source: i } } }))
const material = (name: string, color: number, normal: number, orm: number) => ({
  name, normalTexture: { index: normal }, pbrMetallicRoughness: { baseColorTexture: { index: color }, metallicRoughnessTexture: { index: orm }, metallicFactor: 0, roughnessFactor: 1 },
})
gltf.materials = [
  material('survivor_body', 0, 1, 2),
  material('survivor_head', 3, 4, 5),
  { name: 'survivor_hair', alphaMode: 'MASK', alphaCutoff: 0.42, doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 6 }, metallicFactor: 0, roughnessFactor: 0.62 } },
]
gltf.extensionsUsed = ['EXT_texture_webp']
gltf.extensionsRequired = ['EXT_texture_webp']
delete gltf.animations
gltf.buffers = [{ byteLength: offset }]
gltf.asset = { version: '2.0', generator: 'build-survivor.ts (Rocketbox Male_Adult_07, MIT)' }
const json = Buffer.from(JSON.stringify(gltf))
const jsonChunk = Buffer.concat([json, Buffer.alloc(pad(json.length), 0x20)])
const binChunk = Buffer.concat(parts)
const glb = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binChunk.length)
glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8)
glb.writeUInt32LE(jsonChunk.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(glb, 20)
glb.writeUInt32LE(binChunk.length, 20 + jsonChunk.length); glb.writeUInt32LE(0x004e4942, 24 + jsonChunk.length); binChunk.copy(glb, 28 + jsonChunk.length)
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'survivor.glb'), glb)
console.log(`survivor.glb: ${(glb.length / 1e6).toFixed(2)} MB`)
}
writeGlb().catch((error) => { console.error(error); process.exit(1) })
