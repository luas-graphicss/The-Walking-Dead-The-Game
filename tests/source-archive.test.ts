import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { ARCHIVE_FOLDER, sourceArchive, sourceInventory } from '../lib/source-archive'

test('ZIP padrão preserva código, fontes e recursos; exclui segredos, caches e arquivos aninhados', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'game-zip-'))
  try {
    const contents = { 'public/payload.bin': randomBytes(2 * 1024 * 1024).toString('base64'), 'app/page.tsx': 'export default function Game() {}', 'public/models/mesh.glb': 'glTF-complete', 'public/textures/pbr.webp': 'RIFF-image', 'assets-src/source.png': 'original', 'pnpm-lock.yaml': 'lockfile', 'tests/check.test.ts': 'test', '.env': 'secret', '.env.production': 'secret', '.npmrc': 'token', 'private.pem': 'private key', 'artifacts/backup.zip': 'nested zip', 'public/old.zip': 'nested zip', '.next/cache/data': 'cache', 'node_modules/package/index.js': 'dependency', '.gitignore': '.next/\nnode_modules\nartifacts/\n' }
    for (const [file, text] of Object.entries(contents)) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), text) }
    await symlink(tmpdir(), path.join(root, 'outside'))
    const files = await sourceInventory(root)
    const bytes = new Uint8Array(await new Response(sourceArchive(root, files)).arrayBuffer())
    const zip = unzipSync(bytes)
    const manifest = JSON.parse(strFromU8(zip[`${ARCHIVE_FOLDER}/source-manifest.json`]))
    assert.equal(manifest.complete, true)
    assert.equal(manifest.files.length, files.length)
    for (const entry of manifest.files) {
      const content = zip[`${ARCHIVE_FOLDER}/${entry.path}`]
      assert.equal(createHash('sha256').update(content).digest('hex'), entry.sha256)
      assert.equal(content.byteLength, entry.bytes)
      assert.equal(strFromU8(content), contents[entry.path as keyof typeof contents])
    }
    for (const required of ['app/page.tsx', 'public/models/mesh.glb', 'public/textures/pbr.webp', 'assets-src/source.png', 'tests/check.test.ts', 'pnpm-lock.yaml']) assert.ok(zip[`${ARCHIVE_FOLDER}/${required}`], required)
    for (const forbidden of ['.env', '.env.production', '.npmrc', 'private.pem', 'artifacts/backup.zip', 'public/old.zip', '.next/cache/data', 'node_modules/package/index.js']) assert.equal(zip[`${ARCHIVE_FOLDER}/${forbidden}`], undefined, forbidden)
  } finally { await rm(root, { recursive: true, force: true }) }
})
