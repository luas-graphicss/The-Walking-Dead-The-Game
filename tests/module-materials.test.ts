import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { ASSETS, ASSET_BY_ID } from '../lib/game/blockout/catalog'
import { WORKSHOP_SURFACES, WORKSHOP_MATERIALS, surfaceFor } from '../lib/game/blockout/surfaces'
import { buildAsset } from '../lib/game/blockout/model'
import { partGeometry, auditGeometry } from '../lib/game/blockout/geometry'
import { type BlockPart } from '../lib/game/blockout/types'

const root = process.cwd()
test('404 conjuntos exclusivos cobrem os 608 módulos sem compartilhar entre famílias diferentes', () => {
  assert.equal(WORKSHOP_SURFACES.length, 404)
  assert.equal(Object.keys(WORKSHOP_MATERIALS).length, 418)
  const owners = WORKSHOP_SURFACES.flatMap((surface) => surface.owners)
  assert.equal(owners.length, ASSETS.length)
  assert.equal(new Set(owners).size, ASSETS.length)
  for (const surface of WORKSHOP_SURFACES) {
    assert.equal(new Set(surface.owners.map((id) => ASSET_BY_ID.get(id)!.family)).size, 1)
    assert.ok(surface.owners.length <= 2)
    for (const id of surface.owners) assert.ok(buildAsset(id).parts.some((part) => part.surface === surface.id), id)
  }
})

test('1212 mapas são legíveis, distintos por conjunto, com normais unitárias e altura empacotada', async () => {
  const digests = new Set<string>()
  for (const surface of WORKSHOP_SURFACES) {
    const hash = createHash('sha256')
    for (const channel of ['albedo', 'normal', 'orm']) {
      const data = await readFile(path.join(root, 'public', surface.texture, `${channel}.webp`)); hash.update(data)
      const decoded = await sharp(data).raw().toBuffer({ resolveWithObject: true })
      assert.equal(decoded.info.width, channel === 'albedo' ? 512 : 256, surface.id)
      if (channel === 'orm') assert.equal(decoded.info.channels, 4, `${surface.id}: altura ausente`)
      if (channel === 'albedo') continue
      for (let p = 0; p < 256 * 256; p += 251) {
        const i = p * decoded.info.channels, bytes = decoded.data
        if (channel === 'normal') {
          const length = Math.hypot(...[0, 1, 2].map((c) => bytes[i + c] / 127.5 - 1))
          assert.ok(Math.abs(length - 1) < 0.025, `${surface.id}: normal não unitária`)
          assert.ok(bytes[i + 2] >= 127)
        } else {
          assert.ok(bytes[i + 1] >= 25)
          if (surface.metalness === 0) assert.equal(bytes[i + 2], 0)
          assert.ok(bytes[i + 3] > 0)
        }
      }
    }
    const digest = hash.digest('hex')
    assert.ok(!digests.has(digest), `PBR duplicado: ${surface.id}`); digests.add(digest)
  }
})

test('UVs de paredes e pisos são métricos, contínuos e equivalentes na exportação local', () => {
  const sample: BlockPart = { id: 'surface-check', material: 'concrete', role: 'wall', level: 0, position: [2, 1.5, 0], size: [2, 3, 0.2], yaw: 0 }
  const a = partGeometry(sample), b = partGeometry({ ...sample, position: [4, 1.5, 0] })
  assert.deepEqual(auditGeometry(a), [])

  const material = surfaceFor(sample), offsets: [number, number][] = []
  for (const geometry of [a, b]) {
    const uv = geometry.getAttribute('uv'), p = geometry.getAttribute('position'), n = geometry.getAttribute('normal')
    for (let i = 0; i < p.count; i++) if (n.getZ(i) > 0.999 && Math.abs(n.getX(i)) < 0.001) offsets.push([uv.getX(i) * material.tile - p.getX(i), uv.getY(i) * material.tileV - p.getY(i)])
  }
  assert.ok(offsets.length > 8)
  for (const [u, v] of offsets) {
    assert.ok(Math.abs(u - offsets[0][0]) < 1e-4)
    assert.ok(Math.abs(v - offsets[0][1]) < 1e-4)
  }
  a.dispose(); b.dispose()
})
