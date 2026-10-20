import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { WorldGenerator, sampleChunkHeight } from '../lib/game/world/generator'
import { Terrain } from '../lib/game/world/terrain'
import { parentCell } from '../lib/game/world/roads'
import { coarseReach } from '../lib/game/world/settlements'
import { hashString, randomAt } from '../lib/game/world/noise'
import { planChunks } from '../lib/game/world/stream-plan'
import { CHUNK_SIZE, FLOOR_KIND, FLOOR_STRIDE, LOD_SEGMENTS, WORLD_HALF, WORLD_SIZE, DEFAULT_SEED, VIEW_RADIUS, clampWorld, insideWorld, originFor, worldToLocal } from '../lib/game/world/settings'
import type { ChunkData, MeshData } from '../lib/game/world/types'
import { BOULDERS, GUARDRAIL, LOGS, ROAD_LAYERS, STRUCTURE_LAYERS, pickVariant } from '../lib/game/assets/catalog'

const generator = new WorldGenerator(DEFAULT_SEED)
let home: ChunkData
const bytes = (array: Float32Array | Uint32Array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength)
function assertMesh(mesh: MeshData) {
  assert.equal(mesh.positions.length % 3, 0)
  assert.equal(mesh.positions.length, mesh.normals.length)
  assert.equal(mesh.positions.length, mesh.colors.length)
  assert.equal(mesh.indices.length % 3, 0)
  assert.ok(mesh.positions.every(Number.isFinite))
  assert.ok(mesh.normals.every(Number.isFinite))
  assert.ok(mesh.colors.every(Number.isFinite))
  for (const index of mesh.indices) assert.ok(index < mesh.positions.length / 3)
  if (mesh.uvs) {
    assert.equal(mesh.uvs.length, (mesh.positions.length / 3) * 2)
    assert.ok(mesh.uvs.every(Number.isFinite))
  }
  if (mesh.alphas) assert.equal(mesh.alphas.length, mesh.positions.length / 3)
  if (mesh.groups) {

    let next = 0
    for (let i = 0; i < mesh.groups.length; i += 3) { assert.equal(mesh.groups[i], next); next += mesh.groups[i + 1] }
    assert.equal(next, mesh.indices.length)
  }
}

describe('Determinismo e continuidade do terreno', () => {
  it('gera geometrias, índices e vegetação válidos', () => {
    home = generator.buildChunk(0, 0, 0)
    assert.equal(home.segments, LOD_SEGMENTS[0])
    assert.equal(home.key, '0,0:0')
    for (const mesh of [home.terrain, home.roads, home.markings, home.props, home.water, home.litter]) assertMesh(mesh)
    assert.ok(home.roads.positions.length > 0)
    assert.ok(home.markings.positions.length > 0)
    assert.equal(home.trees.length % 8, 0)
    assert.equal(home.grass.length % 6, 0)
    assert.equal(home.posts.length % 4, 0)
    assert.ok(home.posts.every(Number.isFinite))
    assert.equal(home.solids.length % 10, 0)
    assert.ok(home.solids.every(Number.isFinite))
  })

  it('recria o mesmo chunk bit a bit em um gerador independente', () => {
    const fresh = new WorldGenerator(DEFAULT_SEED).buildChunk(0, 0, 0)
    for (const name of ['terrain', 'roads', 'markings', 'props', 'water'] as const) {
      assert.ok(bytes(home[name].positions).equals(bytes(fresh[name].positions)), name)
      assert.ok(bytes(home[name].colors).equals(bytes(fresh[name].colors)), name)
      assert.ok(bytes(home[name].indices).equals(bytes(fresh[name].indices)), name)
    }
    assert.ok(bytes(home.trees).equals(bytes(fresh.trees)))
    assert.ok(bytes(home.grass).equals(bytes(fresh.grass)))
  })

  it('preserva a borda e suas normais em chunks adjacentes', () => {
    const east = generator.buildChunk(1, 0, 0)
    const south = generator.buildChunk(0, 1, 0)
    const stride = home.segments + 1
    for (let i = 0; i < stride; i++) {
      const h = (i * stride + home.segments) * 3, e = i * stride * 3
      assert.equal(home.terrain.positions[h + 1], east.terrain.positions[e + 1])
      for (let n = 0; n < 3; n++) assert.equal(home.terrain.normals[h + n], east.terrain.normals[e + n])
      const a = (home.segments * stride + i) * 3, b = i * 3
      assert.equal(home.terrain.positions[a + 1], south.terrain.positions[b + 1])
    }
  })

  it('mantém continuidade através do zero e com LOD diferente', () => {
    const west = generator.buildChunk(-1, 0, 1)
    const step = home.segments / west.segments
    for (let i = 0; i <= west.segments; i++) {
      const a = (i * (west.segments + 1) + west.segments) * 3 + 1
      const b = (i * step * (home.segments + 1)) * 3 + 1
      const road = generator.network.influence(0, i * (CHUNK_SIZE / west.segments))
      const pad = generator.settlements.blocked(0, i * (CHUNK_SIZE / west.segments), coarseReach(CHUNK_SIZE / west.segments))

      if (road.pavement < (CHUNK_SIZE / west.segments) * 1.45 || pad) assert.ok(west.terrain.positions[a] <= home.terrain.positions[b] + 1e-4)
      else assert.equal(west.terrain.positions[a], home.terrain.positions[b])
    }
  })

  it('nunca deixa o terreno atravessar o asfalto, nem em cruzamentos', () => {
    const bounds = { minX: -700, minZ: -700, maxX: 700, maxZ: 700 }
    generator.prepare(bounds)
    let checked = 0
    for (const segment of generator.network.segmentsIn(bounds)) {
      if (segment.bridge) continue
      for (const f of [0.25, 0.5, 0.75]) for (const lateral of [-0.95, -0.5, 0, 0.5, 0.95]) {
        const i = segment.index, road = segment.road
        const nx = road.normals[2 * i], nz = road.normals[2 * i + 1]
        const x = segment.a.x + (segment.b.x - segment.a.x) * f + nx * lateral * segment.half
        const z = segment.a.z + (segment.b.z - segment.a.z) * f + nz * lateral * segment.half
        const surface = generator.roadSurface(x, z)
        if (surface === null) continue
        assert.ok(generator.height(x, z) < surface + 0.04, `${segment.roadId} em ${x.toFixed(1)},${z.toFixed(1)}`)
        checked++
      }
    }
    assert.ok(checked > 500)
  })

  it('suprime pinturas de faixa sobre outras estradas', () => {
    const markings = home.markings.positions
    assert.ok(markings.length > 0)
    let overlapping = 0
    for (let i = 0; i < markings.length; i += 3) {
      const x = markings[i], z = markings[i + 2]
      const road = generator.network.influence(x, z)
      if (road.dominant && generator.network.clearance(x, z, road.dominant.roadId) < -0.5) overlapping++
    }
    assert.ok(overlapping / (markings.length / 3) < 0.02, `${overlapping} vértices de pintura dentro de outra pista`)
  })

  it('não depende da ordem de exploração nem mantém terreno antigo na seed nova', () => {
    generator.buildChunk(1_550, -2_040, 2)
    const returned = generator.buildChunk(0, 0, 0)
    assert.ok(bytes(home.terrain.positions).equals(bytes(returned.terrain.positions)))
    assert.ok(bytes(home.trees).equals(bytes(returned.trees)))
    const other = new Terrain('OUTRA-SEED-TESTE')
    assert.notEqual(generator.terrain.height(12_345, -98_765), other.height(12_345, -98_765))
  })

  it('interpola a superfície do collider com a mesma triangulação renderizada', () => {
    const points = [[0, 0], [4, 4], [128, 128], [13.3, 44.7], [255.9, 9.2]]
    for (const [x, z] of points) {
      const y = sampleChunkHeight(home, x, z)
      assert.ok(Number.isFinite(y))
      assert.ok(Math.abs(y - generator.height(x, z)) < 3, `interpolação em ${x},${z}`)
    }
  })

  it('separa árvores de estradas, água e bordas de posse dos chunks', () => {
    let chunk = generator.buildChunk(5, 6, 0)
    for (let attempt = 1; !chunk.trees.length && attempt < 5; attempt++) chunk = generator.buildChunk(5 + attempt * 2, 6 + attempt * 3, 0)
    const seen = new Set<string>()
    for (let i = 0; i < chunk.trees.length; i += 8) {
      const x = chunk.trees[i], z = chunk.trees[i + 2]
      assert.ok(x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE)
      const key = `${x},${z}`; assert.ok(!seen.has(key)); seen.add(key)
      const gx = x + chunk.cx * CHUNK_SIZE, gz = z + chunk.cz * CHUNK_SIZE
      const road = generator.network.influence(gx, gz)
      assert.ok(road.distance >= road.width / 2 + 4.99)
      const surface = generator.terrain.surface(gx, gz)
      assert.ok(surface.height > surface.waterLevel)
    }
    assert.ok(chunk.trees.length > 0, 'a região de floresta deve conter árvores')
  })
})

describe('Rede viária com destinos', () => {
  it('todos os vínculos principais convergem para um grafo conectado sem ciclos de parentesco', () => {
    const seed = hashString(DEFAULT_SEED)
    for (let i = 0; i < 250; i++) {
      let x = Math.floor(randomAt(i, 9, seed) * 499) - 249
      let z = Math.floor(randomAt(i, 17, seed) * 499) - 249
      let steps = 0
      while (x !== 0 || z !== 0) {
        const previousDistance = Math.abs(x) + Math.abs(z)
        const parent = parentCell(x, z, seed)
        assert.ok(parent)
        x = parent.x; z = parent.z
        assert.ok(Math.abs(x) + Math.abs(z) < previousDistance)
        assert.ok(++steps <= 498)
      }
    }
  })

  it('liga estradas regionais a destinos reais e controla sua inclinação', () => {
    const bounds = { minX: -3_000, minZ: -3_000, maxX: 3_000, maxZ: 3_000 }
    generator.prepare(bounds)
    const roads = generator.network.atlasFeatures(bounds).roads.filter((road) => road.kind === 'highway' || road.kind === 'country')
    assert.ok(roads.length >= 2)
    const entries = new Set<string>()
    for (const road of roads) {
      const [ax, az] = road.from.split(',').map(Number), [bx, bz] = road.to.split(',').map(Number)
      const a = generator.terrain.town(ax, az), b = generator.terrain.town(bx, bz)

      const start = generator.network.entryNode(a, b), end = generator.network.entryNode(b, a)
      assert.equal(road.points[0].x, start.x); assert.equal(road.points[0].z, start.z); assert.equal(road.points[0].y, start.y)
      assert.equal(road.points.at(-1)!.x, end.x); assert.equal(road.points.at(-1)!.z, end.z); assert.equal(road.points.at(-1)!.y, end.y)
      assert.ok(Math.hypot(start.x - a.x, start.z - a.z) < a.radius * 1.5)
      if (a.id === '0,0') entries.add(`${start.x},${start.z}`)
      if (b.id === '0,0') entries.add(`${end.x},${end.z}`)
      for (let i = 1; i < road.points.length; i++) {
        const p = road.points[i - 1], q = road.points[i]
        const grade = Math.abs(q.y - p.y) / Math.hypot(q.x - p.x, q.z - p.z)
        assert.ok(grade <= 0.131, `${road.id}: inclinação ${grade}`)
      }
    }
    assert.ok(entries.size >= 1)
  })

  it('não deixa ruas, trilhas ou rodovias terminando soltas', () => {
    const bounds = { minX: -9_000, minZ: -9_000, maxX: 9_000, maxZ: 9_000 }
    generator.prepare(bounds)
    let checked = 0
    for (const road of generator.network.atlasFeatures(bounds).roads) for (const end of [road.points[0], road.points.at(-1)!]) {
      if (Math.max(Math.abs(end.x), Math.abs(end.z)) > 8_000) continue
      assert.ok(generator.network.clearance(end.x, end.z, road.id) < 0, `${road.id} termina solta em ${end.x.toFixed(0)},${end.z.toFixed(0)}`)
      checked++
    }
    assert.ok(checked > 60, `apenas ${checked} pontas verificadas`)
  })

  it('cada estrada regional deixa a cidade por um nó próprio do perímetro', () => {
    const bounds = { minX: -9_000, minZ: -9_000, maxX: 9_000, maxZ: 9_000 }
    generator.prepare(bounds)
    const owners = new Map<string, string>()
    for (const road of generator.network.atlasFeatures(bounds).roads) {
      if (road.kind !== 'highway' && road.kind !== 'country') continue
      for (const [town, point] of [[road.from, road.points[0]], [road.to, road.points.at(-1)!]] as const) {
        const key = `${town}@${point.x},${point.z}`
        assert.ok(!owners.has(key) || owners.get(key) === road.id, `${road.id} e ${owners.get(key)} saem do mesmo nó`)
        owners.set(key, road.id)
      }
    }
    assert.ok(owners.size >= 8)
  })

  it('usa larguras reais e varia o estado e o tipo das estradas', () => {
    const bounds = { minX: -40_000, minZ: -40_000, maxX: 40_000, maxZ: 40_000 }
    const kinds = new Set<string>(), conditions = new Set<string>()
    let bridges = 0, rails = 0
    generator.prepare({ minX: -8_192, minZ: -8_192, maxX: 8_192, maxZ: 8_192 })
    for (const road of generator.network.atlasFeatures(bounds).roads) {
      kinds.add(road.kind); conditions.add(road.condition)
      bridges += road.bridge.reduce((sum, value) => sum + value, 0)
      rails += road.rails.reduce((sum, value) => sum + (value ? 1 : 0), 0)
      if (road.kind === 'highway') assert.ok(road.width >= 14)
      if (road.kind === 'street') assert.ok(road.width >= 9)
    }
    for (const kind of ['highway', 'country', 'street', 'track']) assert.ok(kinds.has(kind), kind)
    for (const condition of ['new', 'worn', 'broken']) assert.ok(conditions.has(condition), condition)
    assert.ok(bridges > 0, 'pontes sobre rios e lagos')
    assert.ok(rails > 0, 'guard-rails em aterros')
  })
})

describe('Água e relevo natural', () => {
  it('gera rios, lagos, lagoas e mar com níveis consistentes', () => {
    const found = new Set<string>()
    for (let i = 0; i < 80_000 && found.size < 4; i++) {
      const x = (randomAt(i, 3, 99) - 0.5) * 400_000, z = (randomAt(i, 7, 99) - 0.5) * 400_000
      const s = generator.terrain.surface(x, z)
      if (s.water !== 'none' && s.height < s.waterLevel) found.add(s.water)
    }
    for (const kind of ['ocean', 'lake', 'pond', 'river']) assert.ok(found.has(kind), kind)
  })

  it('forma praias contínuas, sem poças de mar ou lagoas atrás da areia', () => {
    let center: { x: number; z: number } | null = null
    for (let r = 4_000; r < 200_000 && !center; r += 1_000) for (let a = 0; a < 48 && !center; a++) {
      const x = Math.cos(a / 48 * Math.PI * 2) * r, z = Math.sin(a / 48 * Math.PI * 2) * r
      if (Math.abs(generator.terrain.surface(x, z).shore) < 60) center = { x, z }
    }
    assert.ok(center, 'deve existir litoral no mundo')
    let beach = 0
    for (let i = 0; i < 30_000; i++) {
      const x = center.x + (randomAt(i, 1, 4_242) - 0.5) * 3_000, z = center.z + (randomAt(i, 2, 4_242) - 0.5) * 3_000
      const s = generator.terrain.sample(x, z)
      if (s.biome === 'beach') beach++
      if (s.water === 'ocean') assert.ok(s.shore < 150, `mar a ${s.shore.toFixed(0)} m da linha d'água em ${x.toFixed(0)},${z.toFixed(0)}`)
      if (s.shore > 0 && s.shore < 2_000 && s.height < s.waterLevel) assert.ok(s.water === 'river' || s.shore < 150, `água parada (${s.water}) atrás da praia em ${x.toFixed(0)},${z.toFixed(0)}`)

      if (s.shore > 8 && s.sand > 0.9 && s.water !== 'river') assert.ok(s.height > 0, `areia abaixo do mar em ${x.toFixed(0)},${z.toFixed(0)}`)
    }
    assert.ok(beach > 200, `apenas ${beach} amostras de praia`)
  })

  it('mantém o vale inicial em terra firme', () => {
    const s = generator.terrain.surface(0, 0)
    assert.ok(s.height > s.waterLevel + 1)
    assert.equal(generator.terrain.town(0, 0).wet, false)
  })

  it('suaviza aterros e cortes em vez de criar paredes retas', () => {
    const bounds = { minX: -9_000, minZ: -9_000, maxX: 9_000, maxZ: 9_000 }
    generator.prepare(bounds)
    let worst = -Infinity
    for (const road of generator.network.atlasFeatures(bounds).roads) {
      if (road.kind === 'street') continue
      for (let i = 0; i < road.points.length; i += 7) {
        if (road.bridge[i]) continue
        const p = road.points[i]
        const nx = road.normals[2 * i], nz = road.normals[2 * i + 1], length = Math.hypot(nx, nz)
        for (const side of [-1, 1]) {
          let previous = generator.height(p.x, p.z), previousNatural = generator.terrain.height(p.x, p.z)
          let steepest = 0, steepestNatural = 0
          for (let d = 4; d <= 160; d += 4) {
            const x = p.x + nx / length * side * d, z = p.z + nz / length * side * d

            if (generator.network.influence(x, z).distance < d - 4) break
            const h = generator.height(x, z), natural = generator.terrain.height(x, z)
            steepest = Math.max(steepest, Math.abs(h - previous) / 4)
            steepestNatural = Math.max(steepestNatural, Math.abs(natural - previousNatural) / 4)
            previous = h; previousNatural = natural
          }

          worst = Math.max(worst, steepest - Math.max(1.2, steepestNatural * 1.8 + 0.2))
        }
      }
    }
    assert.ok(worst < 0, `talude criado pela estrada excede o relevo em ${worst.toFixed(2)}`)
  })
})

describe('Florestas e chão da mata', () => {
  let forest: ChunkData
  const props = (chunk: ChunkData, kind: number) => {
    const items: Float32Array[] = []
    for (let i = 0; i < chunk.floor.length; i += FLOOR_STRIDE) if (chunk.floor[i + 10] === kind) items.push(chunk.floor.subarray(i, i + FLOOR_STRIDE))
    return items
  }

  const logEnds = (item: Float32Array) => {
    const [x, , z, qx, qy, qz, qw, scale] = item
    const length = LOGS[pickVariant(item[11], LOGS.length)].length * scale
    const ax = 1 - 2 * (qy * qy + qz * qz), az = 2 * (qx * qz - qw * qy)
    return [[x - ax * length / 2, z - az * length / 2], [x + ax * length / 2, z + az * length / 2]]
  }
  const segmentDistance = (px: number, pz: number, [[ax, az], [bx, bz]]: number[][]) => {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)))
    return Math.hypot(px - ax - dx * t, pz - az - dz * t)
  }

  it('forma matas fechadas cobertas de serapilheira, galhos, pedras e troncos caídos', () => {
    search: for (let cz = -40; cz <= 40; cz += 2) for (let cx = -40; cx <= 40; cx += 2) {
      if (generator.terrain.sample(cx * CHUNK_SIZE + 128, cz * CHUNK_SIZE + 128).biome !== 'denseForest') continue
      const chunk = generator.buildChunk(cx, cz, 0)
      if (chunk.trees.length > 400) { forest = chunk; break search }
    }
    assert.ok(forest, 'deve existir mata fechada perto do início')
    assertMesh(forest.litter)
    assert.ok(forest.litter.indices.length > 0)
    assert.equal(forest.floor.length % FLOOR_STRIDE, 0)
    assert.ok(forest.floor.every(Number.isFinite))
    for (const kind of [FLOOR_KIND.log, FLOOR_KIND.twig, FLOOR_KIND.pebble]) assert.ok(props(forest, kind).length > 0, `tipo ${kind} presente`)
    const { positions, indices } = forest.litter
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3]
      const facing = (positions[b + 2] - positions[a + 2]) * (positions[c] - positions[a]) - (positions[b] - positions[a]) * (positions[c + 2] - positions[a + 2])
      assert.ok(facing >= -1e-9, 'a serapilheira fica voltada para cima')
    }
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], z = positions[i + 2]
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) continue
      const lift = positions[i + 1] - sampleChunkHeight(forest, x + forest.cx * CHUNK_SIZE, z + forest.cz * CHUNK_SIZE)
      assert.ok(lift > -0.02 && lift < 0.07, `serapilheira rente ao chão (${lift.toFixed(3)} m)`)
    }
  })

  it('assenta troncos, tocos e pedras no relevo, longe das estradas e dos troncos em pé', () => {
    const ground = (x: number, z: number) => sampleChunkHeight(forest, x + forest.cx * CHUNK_SIZE, z + forest.cz * CHUNK_SIZE)
    let large = 0
    for (const kind of Object.values(FLOOR_KIND)) for (const item of props(forest, kind)) {
      const [x, y, z, , , , , scale, sy, sz] = item

      const margin = kind === FLOOR_KIND.leaf ? CHUNK_SIZE / forest.segments : 1
      assert.ok(x > -margin && x < CHUNK_SIZE + margin && z > -margin && z < CHUNK_SIZE + margin)
      assert.ok(scale > 0 && scale === sy && scale === sz, 'modelos usam escala uniforme')
      const road = generator.network.influence(x + forest.cx * CHUNK_SIZE, z + forest.cz * CHUNK_SIZE)
      if (kind === FLOOR_KIND.debris) continue
      assert.ok(road.distance > road.width / 2, 'nada fica sobre o asfalto')
      const height = y - ground(x, z)
      if (kind === FLOOR_KIND.boulder) {
        const spec = BOULDERS[pickVariant(item[11], BOULDERS.length)]
        assert.ok(height < 0.05 && height > -spec.tall * scale * 0.6, `rocha enterrada só pela base (${height.toFixed(2)} m)`)
      } else if (kind === FLOOR_KIND.log) {
        const radius = LOGS[pickVariant(item[11], LOGS.length)].radius * scale
        assert.ok(height > radius * 0.5 && height < radius + 2.6, `tronco sobre o chão (${height.toFixed(2)} m)`)
      } else if (kind === FLOOR_KIND.stump) {
        assert.ok(height <= 0 && height > -1.2, `toco apoiado no ponto mais baixo das raízes (${height.toFixed(2)} m)`)
      } else if (kind === FLOOR_KIND.leaf) {

        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) assert.ok(height > 0 && height < 0.035, `folha sobre a serapilheira (${height.toFixed(3)} m)`)
      } else assert.ok(Math.abs(height) < 0.4, `peça ${kind} rente ao chão (${height.toFixed(2)} m)`)
      if (kind === FLOOR_KIND.log || kind === FLOOR_KIND.stump || kind === FLOOR_KIND.boulder) large++
    }
    assert.ok(props(forest, FLOOR_KIND.leaf).length > 0, 'folhas soltas modeladas sobre a serapilheira')
    for (const kind of Object.values(FLOOR_KIND)) for (const item of props(forest, kind)) {
      const [, , , qx, qy, qz, qw] = item
      assert.ok(Math.abs(Math.hypot(qx, qy, qz, qw) - 1) < 1e-4, 'rotações normalizadas')
    }
    for (const log of props(forest, FLOOR_KIND.log)) {
      const ends = logEnds(log)
      for (let i = 0; i < forest.trees.length; i += 8) {
        assert.ok(segmentDistance(forest.trees[i], forest.trees[i + 2], ends) > forest.trees[i + 5] * 0.22 + 0.45, 'tronco caído não atravessa árvores')
      }
    }
    assert.ok(forest.solids.length / 10 >= large, 'troncos, tocos e rochas têm colisão')
  })

  it('repete o mesmo chão em outro gerador e os mesmos troncos em qualquer LOD', () => {
    const again = new WorldGenerator(DEFAULT_SEED).buildChunk(forest.cx, forest.cz, 0)
    assert.ok(bytes(again.floor).equals(bytes(forest.floor)))
    assert.ok(bytes(again.litter.positions).equals(bytes(forest.litter.positions)))
    const far = generator.buildChunk(forest.cx, forest.cz, 1)
    assert.equal(far.litter.indices.length, 0)
    assert.equal(props(far, FLOOR_KIND.twig).length + props(far, FLOOR_KIND.pebble).length, 0)
    const near = props(forest, FLOOR_KIND.log), distant = props(far, FLOOR_KIND.log)
    assert.equal(distant.length, near.length)
    near.forEach((log, i) => assert.ok(Math.hypot(log[0] - distant[i][0], log[2] - distant[i][2]) < 1e-4))
  })
})

describe('Escala finita, streaming e precisão', () => {
  it('define 4.096 km por lado e espaço para mais de 200 setores separados', () => {
    assert.equal(WORLD_SIZE / 1000, 4096)
    const spacing = WORLD_SIZE / 16
    assert.ok(spacing >= 200_000)
    assert.ok(16 * 16 > 200)
  })

  it('preserva centímetros a milhares de quilômetros ao recentralizar', () => {
    for (const [x, z] of [[1_923_456.12345, -1_888_999.87654], [-1_900_000.07, 987_000.003], [-0.1, -0.2]]) {
      const origin = originFor(x, z), local = worldToLocal(x, z, origin)
      assert.ok(Math.abs(local.x) < CHUNK_SIZE && Math.abs(local.z) < CHUNK_SIZE)
      assert.ok(Math.abs(local.x + origin.x - x) < 1e-8)
      assert.ok(Math.abs(Math.fround(local.x) + origin.x - x) < 0.0001)
    }
  })

  it('carrega somente uma janela limitada e prioriza os nove colliders próximos', () => {
    for (const quality of ['low', 'balanced', 'high'] as const) {
      for (const [x, z] of [[0, 0], [1_200_000, -950_000], [WORLD_HALF - 21, 0]]) {
        const plan = planChunks(x, z, quality)
        assert.ok(plan.length <= (VIEW_RADIUS[quality] * 2 + 1) ** 2)
        assert.equal(new Set(plan.map((chunk) => chunk.key)).size, plan.length)
        assert.equal(plan[0].lod, 0)
        assert.ok(plan.filter((chunk) => chunk.lod === 0).length <= 9)
        assert.ok(plan.every((chunk) => insideWorld(chunk.cx * CHUNK_SIZE + 128, chunk.cz * CHUNK_SIZE + 128)))
      }
    }
  })

  it('limita memória dos caches ao explorar regiões muito distantes', () => {
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 230_000, z = (i - 2) * -170_000
      generator.prepare({ minX: x, minZ: z, maxX: x + 256, maxZ: z + 256 })
      assert.ok(generator.network.cacheSizes.regions <= 36)
    }
    assert.ok(generator.terrain.cacheSizes.lakes <= 128)
    assert.ok(generator.terrain.cacheSizes.towns <= 256)
  })

  it('encerra o continente em litoral e rejeita valores inválidos', () => {
    assert.ok(generator.terrain.height(WORLD_HALF - 100, 0) < 0)
    assert.ok(generator.terrain.height(-WORLD_HALF + 100, 0) < 0)
    assert.equal(clampWorld(Infinity), 0)
    assert.equal(clampWorld(NaN), 0)
    assert.equal(clampWorld(WORLD_SIZE), WORLD_HALF - 20)
    assert.equal(insideWorld(WORLD_SIZE, 0), false)
    assert.equal(insideWorld(NaN, 0), false)
  })

  it('produz um atlas a partir do mesmo gerador sem buscar mapas externos', () => {
    const atlas = generator.buildAtlas({ minX: -1_000, minZ: -1_000, maxX: 1_000, maxZ: 1_000 }, 64)
    assert.equal(atlas.pixels.length, 64 * 64 * 4)
    assert.ok(atlas.towns.some((town) => town.id === '0,0'))
    assert.ok(atlas.roads.length > 0)
    for (let i = 3; i < atlas.pixels.length; i += 4) assert.equal(atlas.pixels[i], 255)
  })
})

describe('Estradas modeladas e texturizadas', () => {

  const misWound = (mesh: MeshData) => {
    const { positions: p, normals: n, indices } = mesh
    let wrong = 0
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]
      const face = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
      const normal = [n[a] + n[b] + n[c], n[a + 1] + n[b + 1] + n[c + 1], n[a + 2] + n[b + 2] + n[c + 2]]
      if (face[0] * normal[0] + face[1] * normal[1] + face[2] * normal[2] < 0) wrong++
    }
    return wrong
  }
  const slotTriangles = (mesh: MeshData, slot: number) => {
    let count = 0
    for (let i = 0; i < (mesh.groups?.length ?? 0); i += 3) if (mesh.groups![i + 2] === slot) count += mesh.groups![i + 1] / 3
    return count
  }

  it('agrupa pavimento, calçadas, meio-fio e pintura por material, com coordenadas de textura', () => {
    assert.ok(home.roads.uvs && home.roads.groups && home.markings.uvs)
    for (let i = 0; i < home.roads.groups.length; i += 3) assert.ok(home.roads.groups[i + 2] < ROAD_LAYERS.length)
    assert.ok(slotTriangles(home.roads, 3) > 0, 'calçadas de placas')
    assert.ok(slotTriangles(home.roads, 4) > 0, 'meio-fio de concreto')
    assert.ok(slotTriangles(home.roads, 0) + slotTriangles(home.roads, 1) + slotTriangles(home.roads, 2) > 0, 'pavimento')
  })

  it('modela defensas em W com postes cravados no acostamento, longe de outras vias', () => {
    let railed: ChunkData | undefined
    search: for (let r = 0; r <= 12; r++) for (let cz = -r; cz <= r; cz++) for (let cx = -r; cx <= r; cx++) {
      if (Math.max(Math.abs(cx), Math.abs(cz)) !== r || generator.buildChunk(cx, cz, 1).posts.length < 16) continue
      railed = generator.buildChunk(cx, cz, 0)
      break search
    }
    assert.ok(railed, 'há defensas perto do início')
    assert.ok(slotTriangles(railed.props, 1) > 0, 'lâminas de aço')
    assert.equal(misWound(railed.props), 0, 'faces das defensas voltadas para fora')
    for (let i = 0; i < railed.posts.length; i += 4) {
      const [x, y, z] = railed.posts.subarray(i, i + 3)
      const wx = x + railed.cx * CHUNK_SIZE, wz = z + railed.cz * CHUNK_SIZE
      const ground = sampleChunkHeight(railed, wx, wz) - y
      assert.ok(ground > GUARDRAIL.postBottom + 0.1, `base do poste enterrada (${ground.toFixed(2)} m)`)
      assert.ok(ground < GUARDRAIL.railCenter - GUARDRAIL.railHeight / 2, `lâmina acima do chão (${ground.toFixed(2)} m)`)
      const road = generator.network.influence(wx, wz)
      assert.ok(road.distance > road.width / 2, 'poste fora do pavimento')
    }
  })

  it('constrói pontes de concreto sobre viga-caixão, com pilares e faces bem orientadas', () => {
    const bridge = generator.buildChunk(16, -23, 0)
    assertMesh(bridge.props)
    assert.ok(slotTriangles(bridge.props, 0) > 500, 'tabuleiro, guarda-corpos e pilares')
    for (let i = 0; i < bridge.props.groups!.length; i += 3) assert.ok(bridge.props.groups![i + 2] < STRUCTURE_LAYERS.length)
    assert.equal(misWound(bridge.props), 0, 'faces da ponte voltadas para fora')
  })
})
