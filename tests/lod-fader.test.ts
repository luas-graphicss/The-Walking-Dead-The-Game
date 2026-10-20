import assert from 'node:assert/strict'
import test from 'node:test'
import { HIDDEN } from '../lib/game/lod-fade'
import { LodFader } from '../lib/game/world/lod-fader'

function assertComplementary(fader: LodFader, from: number | 'massing', to: number, seed: number) {
  const incoming = fader.models.get(to)!
  const outgoing = from === 'massing' ? fader.massing.get(seed)! : fader.models.get(from)!
  assert.ok(incoming >= 0 && incoming <= 1, `incoming code ${incoming}`)
  assert.ok(outgoing >= 1 && outgoing <= 2, `outgoing code ${outgoing}`)
  assert.ok(Math.abs(outgoing - 1 - incoming) < 1e-9 || incoming === 1, `codes ${outgoing} / ${incoming} must be complementary`)
}

test('a building dissolves from massing to a model, then between models, without a hard cut', () => {
  const fader = new LodFader(1)
  const seed = 7, proxy = seed * 4 + 2, shell = seed * 4
  assert.equal(fader.update(new Map(), 0.016), false)
  fader.update(new Map([[seed, proxy]]), 0)
  assert.equal(fader.models.get(proxy), 0)
  assert.equal(fader.massing.get(seed), 1)
  for (let i = 0; i < 9; i++) { fader.update(new Map([[seed, proxy]]), 0.1); assertComplementary(fader, 'massing', proxy, seed) }
  fader.update(new Map([[seed, proxy]]), 0.2)
  assert.equal(fader.models.get(proxy), 1)
  assert.equal(fader.massing.get(seed), HIDDEN)

  fader.update(new Map([[seed, shell]]), 0)
  fader.update(new Map([[seed, shell]]), 0.4)
  assertComplementary(fader, proxy, shell, seed)
  assert.equal(fader.massing.get(seed), HIDDEN)

  const before = fader.models.get(shell)!
  fader.update(new Map([[seed, proxy]]), 0)
  assert.ok(Math.abs((2 - fader.models.get(shell)!) - before) < 1e-9)
  fader.update(new Map([[seed, proxy]]), 2)
  assert.deepEqual([...fader.models], [[proxy, 1]])

  fader.update(new Map(), 0)
  fader.update(new Map(), 0.5)
  assert.ok(Math.abs(fader.models.get(proxy)! - 1 - fader.massing.get(seed)!) < 1e-9)
  fader.update(new Map(), 1)
  assert.equal(fader.models.size, 0)
  assert.equal(fader.massing.size, 0)
})
