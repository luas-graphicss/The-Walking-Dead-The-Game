import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Texture, type Mesh, type MeshStandardMaterial } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'meshoptimizer'
import { ASSETS, ASSET_BY_ID } from '../lib/game/blockout/catalog'
import { BLUEPRINTS, chooseCondition } from '../lib/game/blockout/blueprints'
import { buildAsset, ModelBuilder } from '../lib/game/blockout/model'
import { buildStructure } from '../lib/game/blockout/assemble'
import { auditGeometry, compileGeometry, partGeometry } from '../lib/game/blockout/geometry'
import { inspectSocket } from '../lib/game/blockout/loot'
import { validateModel } from '../lib/game/blockout/validation'
import { CONDITIONS, type BlockModel } from '../lib/game/blockout/types'

const summary = (issues: ReturnType<typeof validateModel>['issues']) => issues.slice(0, 12).map((i) => `${i.code}: ${i.part} / ${i.other ?? ''} — ${i.message}`).join('\n')

test('catálogo contém centenas de assets e mais de 70 estruturas locais reais', () => {
  assert.ok(ASSETS.length >= 300)
  assert.ok(BLUEPRINTS.filter((b) => b.context === 'bairro' || b.context === 'cidade-pequena').length > 70)
  assert.equal(ASSET_BY_ID.size, ASSETS.length)
  assert.equal(new Set(BLUEPRINTS.map((b) => b.id)).size, BLUEPRINTS.length)
  for (const blueprint of BLUEPRINTS) for (const family of blueprint.equipment) assert.ok(ASSET_BY_ID.has(`${family}-1`), `${blueprint.id}: ${family}`)
})

test('cada asset passa por suporte, OBB, z-fighting, sockets e malha realmente compilada', () => {
  const failures: string[] = []
  for (const spec of ASSETS) {
    const model = buildAsset(spec), report = validateModel(model)
    if (!report.passed) failures.push(`${spec.id}\n${summary(report.issues)}`)
    for (const { geometry } of compileGeometry(model.parts)) {
      const errors = auditGeometry(geometry)
      if (errors.length) failures.push(`${spec.id}: ${errors.join(', ')}`)
      geometry.dispose()
    }
  }
  assert.equal(failures.length, 0, failures.slice(0, 20).join('\n\n'))
})

test('todos os arquétipos: cinco estados, três seeds, interiores e circulação', () => {
  const failures: string[] = []
  for (const blueprint of BLUEPRINTS) for (const condition of CONDITIONS) for (const seed of [1, 2049, 8675309]) {
    const model = buildStructure(blueprint, seed, { condition: condition.value })
    const report = validateModel(model)
    if (!report.passed) failures.push(`${model.id}\n${summary(report.issues)}`)
    assert.ok(model.sockets.length > 0)
    assert.ok(model.rooms.length > 0)
    assert.ok(model.routes.length > 0)
  }
  assert.equal(failures.length, 0, `${failures.length} montagens com problemas.\n${failures.slice(0, 14).join('\n\n')}`)
})

test('seed recria exatamente a montagem e outras seeds alteram geometria e mobiliário', () => {
  const a = buildStructure('pharmacy', 42, { condition: 'damaged' })
  assert.deepEqual(a, buildStructure('pharmacy', 42, { condition: 'damaged' }))
  assert.notDeepEqual(a.parts.map((p) => [p.size, p.position]), buildStructure('pharmacy', 314, { condition: 'damaged' }).parts.map((p) => [p.size, p.position]))
})

test('destruição do distrito impede edifício preservado isolado entre ruínas', () => {
  for (const blueprint of BLUEPRINTS) {
    assert.notEqual(chooseCondition(blueprint, 1, 'ruined'), 'weathered')
    assert.notEqual(chooseCondition(blueprint, 1, 'ruined'), 'damaged')
    assert.equal(buildStructure(blueprint, 1, { condition: 'weathered', districtCondition: 'leveled' }).condition, 'leveled')
  }
})

test('recursos contextuais são determinísticos e sempre incluem recuperação', () => {
  const pharmacy = buildStructure('pharmacy', 2049, { condition: 'weathered' })
  assert.ok(pharmacy.sockets.some((s) => s.kind === 'medical'))
  const gunStore = buildStructure('gun-store', 2049, { condition: 'weathered' })
  assert.ok(gunStore.sockets.some((s) => s.kind === 'weapons' && s.concealed))
  for (const socket of pharmacy.sockets) assert.deepEqual(inspectSocket(socket, 2049, pharmacy), inspectSocket(socket, 2049, pharmacy))
  assert.ok(pharmacy.sockets.some((socket) => socket.container === 'foundation'))
  assert.ok(pharmacy.sockets.flatMap((socket) => inspectSocket(socket, 2049, pharmacy)).some((item) => item.category === 'Medicamentos e socorro'))
})

test('kits GLB exportados reabrem com todos os modelos, normais e UVs válidos', async () => {
  for (const [name, count] of [['assets', ASSETS.length], ['structures', BLUEPRINTS.length]] as const) {
    const bytes = readFileSync(path.join(process.cwd(), 'public/models/blockout', `${name}.glb`))
    assert.equal(bytes.readUInt32LE(0), 0x46546c67)
    assert.equal(bytes.readUInt32LE(8), bytes.byteLength)
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

    loader.register(() => ({ name: 'NodeTextureLoader', loadTexture: async () => new Texture() }))
    const gltf = await loader.parseAsync(buffer, '')
    assert.equal(gltf.scene.children.length, count)
    let meshes = 0
    gltf.scene.traverse((object) => {
      if (!(object as Mesh).isMesh) return
      const mesh = object as Mesh
      assert.deepEqual(auditGeometry(mesh.geometry), [], `${name}/${object.name}`)
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as MeshStandardMaterial[]) {
        assert.ok(material.map && material.normalMap && material.roughnessMap && material.metalnessMap && material.aoMap, `${name}/${object.name}: PBR incompleto`)
        material.dispose()
      }
      mesh.geometry.dispose()
      meshes++
    })
    assert.ok(meshes >= count)
  }
})

function fixture(): BlockModel {
  const b = new ModelBuilder('test', 'Teste')
  b.box([1, 1, 1], [0, 0.5, 0], 'concrete')
  return b.model
}

test('auditor rejeita flutuação, soterramento e transformações inválidas', () => {
  const floating = fixture(); floating.parts[0].position[1] = 2
  assert.ok(validateModel(floating).issues.some((i) => i.code === 'unsupported'))
  const buried = fixture(); buried.parts[0].position[1] = -1
  assert.ok(validateModel(buried).issues.some((i) => i.code === 'below-ground'))
  const invalid = fixture(); invalid.parts[0].yaw = NaN
  assert.ok(validateModel(invalid).issues.some((i) => i.code === 'non-finite'))
  const collapsed = fixture(); collapsed.parts[0].size[2] = 0
  assert.ok(validateModel(collapsed).issues.some((i) => i.code === 'dimension'))
})

test('auditor rejeita interpenetração, faces duplicadas e orientação inconsistente', () => {
  const duplicate = fixture()
  duplicate.parts.push({ ...duplicate.parts[0], id: 'test/duplicate' })
  const report = validateModel(duplicate)
  assert.ok(report.issues.some((i) => i.code === 'overlap'))
  assert.ok(report.issues.some((i) => i.code === 'z-fighting'))
  const geometry = partGeometry(fixture().parts[0])
  const normal = geometry.getAttribute('normal')
  for (let i = 0; i < normal.count; i++) normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i))
  assert.ok(auditGeometry(geometry).some((issue) => issue.includes('invertida')))
  geometry.dispose()
})

test('auditor detecta bloqueio de porta, recurso flutuante e malha puxada', () => {
  const model = buildStructure('pharmacy', 2049, { condition: 'weathered' })
  const entrance = model.routes.find((r) => r.id === 'entrance')!
  model.parts.push({ id: 'test/blocker', size: [2, 3, 0.2], position: [entrance.from[0], 1.74, entrance.from[2] - 0.15], yaw: 0, material: 'concrete', role: 'wall', level: 0 })
  assert.ok(validateModel(model).issues.some((i) => i.code === 'blocked-route'))
  model.sockets[0].position[1] += 1
  assert.ok(validateModel(model).issues.some((i) => i.code === 'socket'))
  const geometry = partGeometry(fixture().parts[0])
  geometry.getAttribute('position').setXYZ(0, NaN, 1, 1)
  assert.ok(auditGeometry(geometry).some((i) => i.includes('finito')))
  geometry.dispose()
  const stretched = partGeometry(fixture().parts[0])
  stretched.getAttribute('position').setX(0, 12)
  assert.ok(auditGeometry(stretched).some((i) => i.includes('deformada') || i.includes('puxada')))
  stretched.dispose()
})
