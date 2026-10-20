import assert from 'node:assert/strict'
import test from 'node:test'
import { TEXTURE_SETS, TERRAIN_LAYERS } from '../lib/game/assets/catalog'
import { ATLAS_TEXTURES, WORLD_TEXTURE_SCALE, textureRepeat } from '../lib/game/assets/texture-scale'

const nearInteger = (value: number) => Math.abs(value - Math.round(value)) < 1e-9

test('todos os materiais do mundo têm densidade física ou identificação explícita de atlas', () => {
  for (const set of TEXTURE_SETS) {
    assert.ok(ATLAS_TEXTURES.has(set) || WORLD_TEXTURE_SCALE[set], set)
    const repeat = textureRepeat(set)
    assert.ok(Number.isFinite(repeat) && repeat > 0 && repeat <= 4, set)
    if (ATLAS_TEXTURES.has(set)) assert.equal(repeat, 1, `${set}: atlas não pode ser repetido como textura de superfície`)
  }
})

test('camadas do terreno preservam fase nos chunks e na origem flutuante', () => {
  for (const layer of TERRAIN_LAYERS) {
    assert.ok(nearInteger(256 / layer.tile), layer.name)
    assert.ok(nearInteger(4096 / layer.tile), layer.name)
    assert.ok(layer.depth > 0 && layer.depth < layer.tile / 20, layer.name)
  }
  for (const set of ['asphalt', 'asphalt-cracked', 'dirt', 'paint', 'concrete'] as const) {
    const scale = WORLD_TEXTURE_SCALE[set]!
    assert.ok(nearInteger(256 / scale.authoredMeters * textureRepeat(set)), set)
    assert.equal(scale.authoredMeters / textureRepeat(set), scale.meters)
  }
})
