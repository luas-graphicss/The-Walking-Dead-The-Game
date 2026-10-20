import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { Terrain } from '../lib/game/world/terrain'
import { RoadNetwork, SIDEWALK, distanceToSegment } from '../lib/game/world/roads'
import { SettlementPlanner, footprintDistance, footprintOf, settlementProfile, type Site } from '../lib/game/world/settlements'
import type { RoadSegment } from '../lib/game/world/types'

const SEED = 'TWD-2049'
const REGIONS: [number, number][] = [[0, 0], [1, 0], [0, 1], [-1, 0]]

function setup() {
  const terrain = new Terrain(SEED)
  const network = new RoadNetwork(terrain)
  return { terrain, network, planner: new SettlementPlanner(terrain, network) }
}

const corners = (site: Site) => [[site.fp.minX, site.fp.minZ], [site.fp.maxX, site.fp.minZ], [site.fp.maxX, site.fp.maxZ], [site.fp.minX, site.fp.maxZ]]
  .map(([lx, lz]) => [site.x + site.c * lx + site.s * lz, site.z - site.s * lx + site.c * lz] as const)

describe('assentamentos', () => {
  const { terrain, network, planner } = setup()
  const plans = REGIONS.map(([cx, cz]) => ({ cx, cz, plan: planner.plan(cx, cz), town: terrain.town(cx, cz) }))

  test('o plano é determinístico', () => {
    const again = setup().planner.plan(0, 0)
    const first = plans[0].plan
    assert.equal(again.sites.length, first.sites.length)
    for (let i = 0; i < first.sites.length; i++) {
      assert.equal(again.sites[i].blueprint, first.sites[i].blueprint)
      assert.equal(again.sites[i].id, first.sites[i].id)
      assert.ok(Math.abs(again.sites[i].x - first.sites[i].x) < 1e-6)
    }
  })

  test('a cidade inicial é uma cidade de verdade, com centro, bairros e serviços', () => {
    const sites = plans[0].plan.sites
    assert.ok(sites.length > 150, `${sites.length} construções`)
    for (const zone of ['civic', 'core', 'residential']) assert.ok(sites.some((site) => site.zone === zone), zone)
    for (const blueprint of ['church', 'school', 'town-hall']) assert.ok(sites.some((site) => site.blueprint === blueprint), blueprint)
  })

  test('nenhuma construção se sobrepõe a outra', () => {
    for (const { plan } of plans) {
      for (let i = 0; i < plan.sites.length; i++) for (let j = i + 1; j < plan.sites.length; j++) {
        const a = plan.sites[i], b = plan.sites[j]
        if (a.maxX < b.minX || b.maxX < a.minX || a.maxZ < b.minZ || b.maxZ < a.minZ) continue
        const inside = corners(a).some(([x, z]) => footprintDistance(b, x, z, -0.05) === 0) || corners(b).some(([x, z]) => footprintDistance(a, x, z, -0.05) === 0)
        assert.ok(!inside, `${a.blueprint} sobre ${b.blueprint}`)
      }
    }
  })

  test('construções ficam fora das ruas, calçadas e acostamentos, e de frente para uma via', () => {
    for (const { plan } of plans) for (const site of plan.sites) {
      const segments = network.segmentsIn({ minX: site.minX - 30, maxX: site.maxX + 30, minZ: site.minZ - 30, maxZ: site.maxZ + 30 })
      for (const [x, z] of corners(site)) for (const s of segments) {
        const clearance = distanceToSegment(x, z, s as RoadSegment).distance - s.half
        assert.ok(clearance > (s.kind === 'street' ? SIDEWALK : 0.5), `${site.blueprint} invade ${s.kind}`)
      }

      if (site.zone === 'farm' && ['barn', 'stable', 'grain-store', 'greenhouse'].includes(site.blueprint)) continue
      const fx = site.x + site.s * site.fp.maxZ, fz = site.z + site.c * site.fp.maxZ
      const nearest = Math.min(...segments.map((s) => distanceToSegment(fx, fz, s as RoadSegment).distance - s.half))
      assert.ok(nearest < 60, `${site.blueprint} sem acesso (${nearest.toFixed(1)} m)`)
    }
  })

  test('cada porte tem o que lhe cabe: hospital só em cidade, prédios só em centro urbano', () => {
    for (const { plan, town } of plans) for (const site of plan.sites) {
      if (site.blueprint === 'hospital-building') assert.ok(town.kind === 'city' || town.kind === 'town')
      if (site.blueprint === 'office-building' || site.blueprint === 'apartment-building') assert.ok(town.kind !== 'hamlet')
      if (site.zone === 'civic' || site.zone === 'core') assert.ok(Math.hypot(site.x - town.x, site.z - town.z) < town.radius * 1.6, `${site.blueprint} longe da cidade`)
    }
  })

  test('serviços públicos ficam isolados, fora da área urbana', () => {
    for (const { plan, town } of plans) for (const site of plan.sites) {
      if (site.zone !== 'utility') continue
      assert.ok(Math.hypot(site.x - town.x, site.z - town.z) > town.radius * 1.3, `${site.blueprint} dentro da cidade`)
    }
  })

  test('o campo continua dominado pela natureza', () => {
    for (const { plan } of plans) {
      const built = plan.sites.reduce((sum, site) => sum + (site.fp.maxX - site.fp.minX) * (site.fp.maxZ - site.fp.minZ), 0)
      const share = built / (8192 * 8192)
      assert.ok(share > 0 && share < 0.02, `${(share * 100).toFixed(2)} % construído`)
    }
  })

  test('destinos variam e as condições seguem o destino', () => {
    const fates = new Set<string>()
    for (let cx = -4; cx <= 4; cx++) for (let cz = -4; cz <= 4; cz++) fates.add(settlementProfile(terrain, terrain.town(cx, cz)).fate)
    assert.ok(fates.size >= 4, [...fates].join(', '))
    for (const { plan } of plans) assert.ok(plan.sites.every((site) => ['weathered', 'damaged', 'burned', 'ruined', 'leveled'].includes(site.condition)))
  })

  test('a pegada medida bate com a variação do bay por semente', () => {
    const a = footprintOf('family-house', 11), b = footprintOf('family-house', 2049)
    assert.ok(a.maxX - a.minX > 10 && a.maxX - a.minX < 22)
    assert.ok(Math.abs((a.maxX - a.minX) - (b.maxX - b.minX)) < 2)
  })
})
