import assert from 'node:assert/strict'
import test from 'node:test'
import { ASSETS, ASSET_BY_ID } from '../lib/game/blockout/catalog'
import { BLUEPRINTS } from '../lib/game/blockout/blueprints'
import { buildAsset } from '../lib/game/blockout/model'
import { buildStructure } from '../lib/game/blockout/assemble'
import { validateModel } from '../lib/game/blockout/validation'
import { CONDITIONS, type Condition } from '../lib/game/blockout/types'
import { PENDING_RESOURCES, RESOURCES } from '../lib/game/resources/catalog'
import { CONTAINER_BY_FAMILY, SITE_PROFILES } from '../lib/game/resources/contexts'
import { buildResourceModel } from '../lib/game/resources/models'
import { isSculptedResource } from '../lib/game/resources/sculpts'
import { generateStructureLoot } from '../lib/game/resources/spawn'
import type { ResourceCategory } from '../lib/game/resources/types'

const lootOf = (blueprint: string, conditions: Condition[] = ['weathered', 'damaged'], seeds = [1, 2049]) =>
  conditions.flatMap((condition) => seeds.flatMap((seed) => generateStructureLoot(buildStructure(blueprint, seed, { condition }), seed + 7)))
const categoriesOf = (loot: ReturnType<typeof lootOf>) => new Set(loot.flatMap((entry) => entry.items.map((item) => item.resource.category)))

test('catálogo tem mais de 200 recursos únicos, com recipiente, origem, uso e modelo', () => {
  assert.ok(RESOURCES.length >= 200, `${RESOURCES.length} recursos`)
  assert.equal(new Set(RESOURCES.map((r) => r.id)).size, RESOURCES.length)
  for (const resource of RESOURCES) {
    assert.ok(resource.containers.length && resource.uses.length && Object.keys(resource.sites).length, resource.id)
    assert.ok(resource.quantity[0] >= 1 && resource.quantity[0] <= resource.quantity[1] && resource.quantity[1] <= resource.stack, resource.id)
    if (resource.model.status === 'pronto') assert.ok(ASSET_BY_ID.has(`${resource.model.family}-1`), resource.id)
  }
  assert.ok(new Set(RESOURCES.map((r) => r.category)).size >= 19)
})

test('toda família com recurso mapeia para um recipiente real e toda estrutura tem perfil de origem', () => {
  const families = new Set(ASSETS.map((asset) => asset.family))
  for (const family of CONTAINER_BY_FAMILY.keys()) assert.ok(family === 'foundation' || families.has(family), `família inexistente: ${family}`)
  for (const asset of ASSETS) if (buildAsset(asset).sockets.length) assert.ok(CONTAINER_BY_FAMILY.has(asset.family), `sem recipiente: ${asset.family}`)
  for (const blueprint of BLUEPRINTS) assert.ok(SITE_PROFILES.has(blueprint.id), `sem perfil: ${blueprint.id}`)
})

test('todos os recursos têm escultura própria ou módulo pronto, sem fallback visual de blocagem', () => {
  const missing = RESOURCES.filter((resource) => resource.model.status !== 'pronto' && !isSculptedResource(resource.id))
  assert.deepEqual(missing.map((resource) => resource.id), [])
})

test('colisores dos recursos passam pela auditoria de apoio, sobreposição e z-fighting', () => {
  assert.equal(PENDING_RESOURCES.length, 0, 'Nenhum recurso deve continuar em blocagem')
  const failures = RESOURCES.map((resource) => [resource.id, validateModel(buildResourceModel(resource))] as const).filter(([, report]) => !report.passed)
  assert.equal(failures.length, 0, failures.slice(0, 8).map(([id, report]) => `${id}: ${report.issues[0]?.message}`).join('\n'))
})

test('regra 1: cada recurso só nasce num recipiente compatível', () => {
  for (const blueprint of ['family-house', 'pharmacy', 'grocery', 'gun-store', 'hardware', 'clinic']) {
    for (const entry of lootOf(blueprint)) for (const { resource } of entry.items) assert.ok(resource.containers.includes(entry.container), `${blueprint}: ${resource.id} em ${entry.container}`)
  }
})

test('regra 2: farmácia sem comida, mercado sem armas ou antibióticos, loja de armas sem alimentos', () => {
  const forbidden = (blueprint: string, categories: ResourceCategory[], ids: string[] = []) => {
    const loot = lootOf(blueprint, CONDITIONS.map((c) => c.value))
    for (const entry of loot) for (const { resource } of entry.items) assert.ok(!categories.includes(resource.category) && !ids.includes(resource.id), `${blueprint}: ${resource.id}`)
  }
  forbidden('pharmacy', ['alimento', 'bebida', 'arma', 'municao'])
  forbidden('grocery', ['arma', 'municao', 'peca-arma'], ['amoxicillin', 'tramadol', 'diazepam', 'morphine'])
  forbidden('gun-store', ['alimento', 'bebida', 'medico'])
  assert.ok(categoriesOf(lootOf('pharmacy')).has('medico'))
  assert.ok(categoriesOf(lootOf('grocery')).has('alimento'))
  assert.ok(categoriesOf(lootOf('gun-store')).has('municao'))
})

test('remédios em casas e mercados são exceção rara, não a regra', () => {
  const share = (blueprint: string) => {
    const items = lootOf(blueprint, ['weathered'], [1, 2049, 8675309, 42]).flatMap((entry) => entry.items)
    return items.filter((item) => item.resource.category === 'medico').length / Math.max(1, items.length)
  }
  assert.ok(share('family-house') < 0.15, `casa: ${share('family-house')}`)
  assert.ok(share('grocery') < 0.05, `mercado: ${share('grocery')}`)
  assert.ok(share('pharmacy') > 0.5, `farmácia: ${share('pharmacy')}`)
})

test('geração é determinística por seed e muda com outra seed', () => {
  const structure = buildStructure('grocery', 2049, { condition: 'weathered' })
  const summary = (seed: number) => generateStructureLoot(structure, seed).map((entry) => entry.items.map((item) => `${item.resource.id}:${item.quantity}`).join(','))
  assert.deepEqual(summary(5), summary(5))
  assert.notDeepEqual(summary(5), summary(6))
})
