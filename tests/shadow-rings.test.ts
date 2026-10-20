import assert from 'node:assert/strict'
import test from 'node:test'
import { runtime } from '../lib/game/runtime'
import { SHADOW_BASIS, invalidateChunkShadows, invalidateStillShadows, ringReach, shadowCasters, shadowRings } from '../lib/game/shadow'
import { CHUNK_SIZE } from '../lib/game/world/settings'

function setup() {
  runtime.origin.x = 5_120
  runtime.origin.z = -2_816
  runtime.playerPosition.set(100, 0, 100)
  return { x: runtime.origin.x + 100, z: runtime.origin.z + 100 }
}

function staleAfter(change: () => void) {
  const count = shadowRings().length
  const before = Array.from({ length: count }, (_, index) => shadowCasters.versions[index] ?? 0)
  change()
  return before.slice(1).map((version, offset) => (shadowCasters.versions[offset + 1] ?? 0) !== version)
}

function across(distance: number) {
  const survivor = setup()
  return { x: survivor.x + SHADOW_BASIS.right.x * distance, z: survivor.z + SHADOW_BASIS.right.z * distance }
}

test('the rings grow outwards and the near one is sharper than a single map over the old 26 m square', () => {
  const rings = shadowRings()
  assert.equal(rings.length, 4)
  for (let index = 1; index < rings.length; index++) {
    assert.ok(rings[index].extent > rings[index - 1].extent)
    assert.ok(rings[index].recenter > 0, 'outer rings are still')
  }
  assert.equal(rings[0].recenter, 0, 'the near ring follows the survivor every frame')
  assert.ok(rings[0].texel < (26 * 2) / 2048)
})

test('a caster beside the survivor marks every still ring stale', () => {
  const survivor = setup()
  assert.deepEqual(staleAfter(() => invalidateStillShadows(survivor.x, survivor.z, 4)), [true, true, true])
})

test('a caster only the widest ring reaches marks only that ring stale', () => {
  const point = across((ringReach(2) + ringReach(3)) / 2)
  assert.deepEqual(staleAfter(() => invalidateStillShadows(point.x, point.z, 0)), [false, false, true])
})

test('a caster past the widest ring marks none, unless its footprint reaches in', () => {
  const point = across(ringReach(3) + 30)
  assert.deepEqual(staleAfter(() => invalidateStillShadows(point.x, point.z, 10)), [false, false, false])
  assert.deepEqual(staleAfter(() => invalidateStillShadows(point.x, point.z, 40)), [false, false, true])
})

test('a footprint straddling the second ring reach marks it stale', () => {
  const point = across(ringReach(1) + 5)
  assert.deepEqual(staleAfter(() => invalidateStillShadows(point.x, point.z, 0)), [false, true, true])
  assert.deepEqual(staleAfter(() => invalidateStillShadows(point.x, point.z, 10)), [true, true, true])
})

test('a chunk marks the rings it may reach: its own chunk all, a distant one none', () => {
  const survivor = setup()
  const cx = Math.floor(survivor.x / CHUNK_SIZE), cz = Math.floor(survivor.z / CHUNK_SIZE)
  assert.deepEqual(staleAfter(() => invalidateChunkShadows(cx, cz)), [true, true, true])
  assert.deepEqual(staleAfter(() => invalidateChunkShadows(cx + 9, cz - 9)), [false, false, false])
})
