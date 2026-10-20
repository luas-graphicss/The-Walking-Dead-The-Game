import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { BLOCK_MATERIALS, BLOCKOUT_VERSION, MODULE_TRIANGLE_BUDGET, partBounds, type MaterialKey } from '../lib/game/blockout/types'
import { buildAsset } from '../lib/game/blockout/model'
import { partGeometry, compileGeometry, auditGeometry } from '../lib/game/blockout/geometry'
import { ASSETS } from '../lib/game/blockout/catalog'
import { BLUEPRINTS } from '../lib/game/blockout/blueprints'
import { validateModel } from '../lib/game/blockout/validation'
import { WORKSHOP_MATERIALS } from '../lib/game/blockout/surfaces'

const root = process.cwd()

test('todos os materiais têm imagem fonte e quatro mapas PBR decodificáveis', async () => {
  assert.equal(Object.keys(BLOCK_MATERIALS).length, 14)
  for (const [name, material] of Object.entries(BLOCK_MATERIALS)) {
    const webp = path.join(root, 'assets-src/textures/workshop', `${name}.webp`)
    const source = await sharp(existsSync(webp) ? webp : webp.replace(/\.webp$/, '.png')).metadata()
    assert.ok(source.width! >= 1024 && source.height! >= 1024, name)
    for (const channel of ['albedo', 'normal', 'orm', 'height']) {
      const file = path.join(root, 'public', material.texture, `${channel}.${channel === 'height' ? 'png' : 'webp'}`)
      const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      assert.equal(info.width, channel === 'orm' ? 512 : 1024, `${name}/${channel}`)
      assert.equal(info.width, info.height)
      for (let p = 0; p < info.width * info.height; p += 997) {
        const i = p * info.channels
        if (channel === 'normal') {
          const length = Math.hypot(...[0, 1, 2].map((c) => data[i + c] / 127.5 - 1))
          assert.ok(Math.abs(length - 1) < 0.025, `${name}: normal não normalizado`)
          assert.ok(data[i + 2] >= 127, `${name}: normal aponta para dentro`)
        }
        if (channel === 'orm') {
          assert.ok(data[i + 1] >= 25, `${name}: superfície espelhada indevida`)
          if (material.metalness === 0) assert.equal(data[i + 2], 0, `${name}: dielétrico metalizado`)
        }
      }
    }
  }
})

test('catálogo inteiro usa materiais PBR e ferragens com suporte explícito', () => {
  for (const spec of ASSETS) {
    const model = buildAsset(spec), byId = new Map(model.parts.map((part) => [part.id, part]))
    for (const part of model.parts) {
      assert.ok(BLOCK_MATERIALS[part.material].texture.startsWith('/textures/workshop/'), part.id)
      if (part.detail) assert.ok(part.support && byId.has(part.support), part.id)
    }
  }
})

test('malhas curvas permanecem contidas nos volumes auditados e têm orçamento intermediário', () => {
  for (const id of ['tractor-1', 'ct-scanner-1', 'toilet-1', 'sofa-1', 'tile-floor-1', 'barrel-1', 'vice-bench-1', 'broken-wall-concrete-1']) {
    const model = buildAsset(id)
    for (const part of model.parts) {
      const geometry = partGeometry(part), bounds = partBounds(part), p = geometry.getAttribute('position')
      for (let i = 0; i < p.count; i++) for (let axis = 0; axis < 3; axis++) {
        const value = axis === 0 ? p.getX(i) : axis === 1 ? p.getY(i) : p.getZ(i)
        assert.ok(value >= bounds.min[axis] - 0.0001 && value <= bounds.max[axis] + 0.0001, `${part.id}: vértice fora do volume`)
      }
      geometry.dispose()
    }
    let triangles = 0
    const detailed = compileGeometry(model.parts), collision = compileGeometry(model.parts, 'collision')
    for (const { geometry } of detailed) {
      assert.deepEqual(auditGeometry(geometry), [], id)
      triangles += geometry.getIndex()!.count / 3
      geometry.dispose()
    }
    assert.ok(triangles <= MODULE_TRIANGLE_BUDGET, `${id}: ${triangles} triângulos`)
    const collisionTriangles = collision.reduce((sum, group) => sum + group.geometry.getIndex()!.count / 3, 0)
    assert.ok(triangles >= collisionTriangles, id)
    if (model.parts.some((part) => (part.bevel ?? 0) > 0)) assert.ok(triangles > collisionTriangles, id)
    collision.forEach(({ geometry }) => geometry.dispose())
  }
})

test('GLBs compartilham malhas e referenciam mapas PBR locais incluídos no ZIP', async () => {
  for (const name of ['assets', 'structures']) {
    const bytes = readFileSync(path.join(root, 'public/models/blockout', `${name}.glb`))
    const jsonLength = bytes.readUInt32LE(12)
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
    assert.equal(gltf.images.length, Object.keys(WORKSHOP_MATERIALS).length * 3)
    assert.equal(gltf.materials.length, 398)
    assert.ok(gltf.extensionsRequired.includes('EXT_meshopt_compression'))
    assert.ok(gltf.extensionsRequired.includes('EXT_texture_webp'))
    assert.equal(gltf.scenes[0].nodes.length, name === 'assets' ? ASSETS.length : BLUEPRINTS.length)
    assert.ok(gltf.meshes.length < gltf.nodes.length)
    for (const image of gltf.images) {
      assert.ok(image.uri.startsWith('../../textures/workshop/'))
      const decoded = await sharp(path.resolve(root, 'public/models/blockout', image.uri)).metadata()
      assert.ok(decoded.width! >= 256)
    }
    for (const material of gltf.materials) {
      const spec = WORKSHOP_MATERIALS[material.name]
      assert.equal(material.pbrMetallicRoughness.metallicFactor, spec.metalness)
      assert.equal(material.normalTexture.scale, spec.normalStrength)
      assert.ok(material.occlusionTexture)
    }
  }
  const manifest = JSON.parse(readFileSync(path.join(root, 'public/models/blockout/manifest.json'), 'utf8'))
  assert.equal(manifest.version, BLOCKOUT_VERSION)
  assert.equal(manifest.modules.length, ASSETS.length)
  for (const module of manifest.modules) assert.ok(module.render.triangles <= MODULE_TRIANGLE_BUDGET)
})

test('auditoria rejeita acabamento impossível e ferragem desligada do suporte', () => {
  const source = buildAsset('tractor-1')
  const model = structuredClone(source)
  model.parts[0].bevel = 10
  const detail = model.parts.find((part) => part.detail)!
  detail.support = 'suporte-inexistente'
  const issues = validateModel(model).issues
  assert.ok(issues.some((issue) => issue.code === 'dimension'))
  assert.ok(issues.some((issue) => issue.code === 'unsupported' && issue.part === detail.id))
})
