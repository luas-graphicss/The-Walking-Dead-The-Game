import { assetFor } from './catalog'
import { BLUEPRINT_BY_ID, chooseCondition } from './blueprints'
import { buildAsset, ModelBuilder } from './model'
import { FLOOR_HEIGHT, FOUNDATION_HEIGHT, hash, modelBounds, random, transformPoint, type Blueprint, type Condition, type LootKind, type MaterialKey, type StructureModel, type Vec3 } from './types'
import { architectureFor, planCells, type Architecture } from './architecture'
import { buildRoofs, type Obstacle } from './roofs'
import { edgeKey, furnishInterior, programFor, type EdgeRecord } from './interior'
import type { WallOpening } from './interior/room'
import { buildSiteFeatures, planChimney, planPorch, plinthHeight, type FacadeRecord } from './site-features'
import { scatterDebris, type WallEdge } from './debris-placement'
import { styleFor } from './style'
import { floorFinish, interiorFor, weatherFor } from './identity'
import { cornerTrims, outlineEdges, outlineStrip, type OutlineEdge } from './outline'
import { dressDoor, dressRoll, dressStorefront, dressWindow, groundCuts, planOpenings, wallPanels, type EdgeRole, type Opening, type Run } from './facade'
import { crownHeight, crownLocal, distributeScars, holeExtent, planScars, type ScarOptions, type ScarOpening } from './damage'
import type { BlockPart, Crown, FaceFinish } from './types'

type Cell = { x: number; z: number; zone: string }
type Rect = { x0: number; x1: number; z0: number; z1: number }
const key = (x: number, z: number) => `${x},${z}`
const OPEN_PLAN = new Set(['warehouse', 'grain-store', 'barn', 'stable', 'greenhouse', 'sawmill', 'power-substation', 'car-wash', 'water-works', 'bus-depot', 'church'])
const BACK_OF_HOUSE_T = new Set(['restaurant', 'pizzeria', 'bakery', 'butcher'])
const PRIVATE = new Set(['B', 'A', 'D'])
const contentFamily: Record<LootKind, string> = { salvage: 'plastic', food: 'cans', medical: 'medicine', weapons: 'ammo', tools: 'toolbox', textiles: 'cloth', electronics: 'battery', agriculture: 'seeds', documents: 'papers' }

export type BuildOptions = { condition?: Condition; districtCondition?: Condition; contents?: boolean; architecture?: Architecture }
export function buildStructure(definition: Blueprint | string, seed = 2049, options: BuildOptions = {}): StructureModel {
  const blueprint = typeof definition === 'string' ? BLUEPRINT_BY_ID.get(definition) : definition
  if (!blueprint) throw new Error(`Estrutura desconhecida: ${definition}`)
  const conditions: Condition[] = ['weathered', 'damaged', 'burned', 'ruined', 'leveled']
  const requested = options.condition ?? chooseCondition(blueprint, seed, options.districtCondition)
  const condition = conditions[Math.max(conditions.indexOf(requested), conditions.indexOf(options.districtCondition ?? 'weathered'))]
  if (blueprint.layout === 'compound') return buildCompound(blueprint, seed, { ...options, condition })
  const rng = random(hash(`${blueprint.id}:${seed}`))
  const profile = options.architecture ?? architectureFor(blueprint)
  const style = styleFor(blueprint, profile, seed)
  const interior = interiorFor(blueprint, style, seed, condition), residential = blueprint.category === 'Residências'
  const floorFinishes = (zone: string, ceiling: boolean): FaceFinish[] => [
    { axis: [0, 1, 0], ...floorFinish(interior, zone, residential) },
    ...(ceiling && interior.ceiling ? [{ axis: [0, -1, 0] as Vec3, material: 'plaster' as MaterialKey, tint: interior.ceiling }] : []),
  ]
  const signatureBounds = modelBounds(buildAsset(assetFor(profile.specialty, 1)))
  const variation = 1 + (rng() - 0.5) * 0.08
  const bay: [number, number] = [Math.max(profile.bay[0] * variation, 2 * (signatureBounds.size[0] + 0.74)), Math.max(profile.bay[1] * variation, 2 * (signatureBounds.size[2] + 0.74))]
  const cells: Cell[] = planCells(profile)
  const nx = Math.max(...profile.plan.map((row) => row.length)), nz = profile.plan.length
  const occupied = new Set(cells.map((cell) => key(cell.x, cell.z)))
  const floors = condition === 'ruined' || condition === 'leveled' ? 1 : blueprint.floors
  const wallHeight = floors > 1 ? FLOOR_HEIGHT - 0.2 : profile.wallHeight
  const minX = -nx * bay[0] / 2, minZ = -nz * bay[1] / 2, maxZ = -minZ
  const center = (cell: Cell): [number, number] => [minX + (cell.x + 0.5) * bay[0], minZ + (cell.z + 0.5) * bay[1]]
  const frontCell = cells.filter((cell) => cell.z === nz - 1).sort((a, c) => Math.abs(center(a)[0]) - Math.abs(center(c)[0]))[0]
  const entranceX = center(frontCell)[0]
  const stairCell = cells.filter((cell) => cell.z === nz - 1).sort((a, c) => a.x - c.x)[0]
  const b = new ModelBuilder(`${blueprint.id}-${seed}-${condition}`, blueprint.label)
  for (const cell of cells) {
    const [x, z] = center(cell)
    b.box([bay[0], FOUNDATION_HEIGHT, bay[1]], [x, FOUNDATION_HEIGHT / 2, z], 'concrete', 'foundation', 0, 0, 'footprint-foundation').finishes = floorFinishes(cell.zone, false)
  }
  const foundation = b.model.parts[0]
  const model: StructureModel = { ...b.model, blueprint: blueprint.id, seed, condition, context: blueprint.context, floors, rooms: [], routes: [], instances: [], entrance: [entranceX, 0, maxZ + 1.5], weather: weatherFor(blueprint, style, seed) }
  b.model = model
  const burnedAll = condition === 'burned'
  const timber = style.wall.material === 'wood'
  const wallMaterial: MaterialKey = style.wall.material
  const stairX = center(stairCell)[0] - bay[0] / 2 + 1, stairZ = maxZ - 3.4
  const damageSide = Math.floor(rng() * 4)
  const edges: WallEdge[] = []
  const zoneAt = new Map(cells.map((cell) => [key(cell.x, cell.z), cell.zone]))
  const edgeRecords = new Map<string, EdgeRecord>()
  const back = new Set(['R', 'K', 'O', ...(BACK_OF_HOUSE_T.has(blueprint.id) ? ['T'] : [])])

  const separates = (zone: string, other?: string) => Boolean(other) && !OPEN_PLAN.has(blueprint.id) && (back.has(zone) !== back.has(other!) || PRIVATE.has(zone) || PRIVATE.has(other!))
  const stairHole: Rect = { x0: stairX - 0.76, x1: stairX + 0.76, z0: stairZ - 2.4, z1: stairZ + 2.28 }
  const intersect = (a: Rect, c: Rect) => a.x0 < c.x1 && a.x1 > c.x0 && a.z0 < c.z1 && a.z1 > c.z0
  const rectOf = (cell: Cell): Rect => { const [x, z] = center(cell); return { x0: x - bay[0] / 2, x1: x + bay[0] / 2, z0: z - bay[1] / 2, z1: z + bay[1] / 2 } }
  const addFloor = (r: Rect, top: number, level: number, zone: string) => {
    if (r.x1 - r.x0 < 0.015 || r.z1 - r.z0 < 0.015) return
    b.box([r.x1 - r.x0, 0.2, r.z1 - r.z0], [(r.x0 + r.x1) / 2, top - 0.1, (r.z0 + r.z1) / 2], 'concrete', 'floor', 0, level).finishes = floorFinishes(zone, true)
  }
  const cutFloor = (r: Rect, top: number, level: number, zone: string) => {
    if (!intersect(r, stairHole)) { addFloor(r, top, level, zone); return }
    const a = { x0: Math.max(r.x0, stairHole.x0), x1: Math.min(r.x1, stairHole.x1), z0: Math.max(r.z0, stairHole.z0), z1: Math.min(r.z1, stairHole.z1) }
    addFloor({ ...r, x1: a.x0 }, top, level, zone)
    addFloor({ ...r, x0: a.x1 }, top, level, zone)
    addFloor({ x0: a.x0, x1: a.x1, z0: r.z0, z1: a.z0 }, top, level, zone)
    addFloor({ x0: a.x0, x1: a.x1, z0: a.z1, z1: r.z1 }, top, level, zone)
  }
  const place = (family: string, position: Vec3, yaw: number, level: number, variant = 1) => {
    const asset = assetFor(family, variant)
    const prefix = b.append(buildAsset(asset), position, yaw, level)
    model.instances.push({ asset: asset.id, position, yaw, level, prefix })
  }

  const outline = outlineEdges(cells, { bay, minX, minZ, occupied })
  const outlineOf = (cell: Cell, dx: number, dz: number) => outline.find((e) => e.x === cell.x && e.z === cell.z && e.dx === dx && e.dz === dz)!
  const severe = condition === 'ruined' || condition === 'leveled'
  const topFloorY = FOUNDATION_HEIGHT + (floors - 1) * FLOOR_HEIGHT, eave = topFloorY + wallHeight
  const frontCells = cells.filter((cell) => cell.z === nz - 1)
  const frontX0 = minX + Math.min(...frontCells.map((cell) => cell.x)) * bay[0], frontX1 = minX + (Math.max(...frontCells.map((cell) => cell.x)) + 1) * bay[0]
  const chimney = planChimney(blueprint, profile, style, outline, maxZ, condition)
  const obstacles: Obstacle[] = chimney ? [chimney] : []
  const roof = buildRoofs(b, {
    cells, occupied, bay, minX, minZ, eave, level: floors - 1, condition, seed, style, legacy: profile.roof, edges: outline, obstacles, timber, vents: blueprint.id !== 'church',
    gable: timber ? { material: 'wood', tint: style.wall.tint } : style.wall.relief || style.wall.material === 'steel' ? { material: style.trim.material === 'steel' ? 'steel' : 'plaster', tint: style.trim.tint } : { material: style.wall.material, tint: style.wall.tint },
  })
  const frontRun = { x0: frontX0, x1: frontX1, line: maxZ }
  const porch = severe ? null : planPorch(blueprint, profile, style, roof, frontRun, floors, condition)

  const rendered = wallMaterial === 'plaster'
  const wallCore: MaterialKey = timber ? 'wood' : wallMaterial === 'steel' ? 'steel' : wallMaterial === 'concrete' ? 'concrete' : 'brick'
  const scarMasonry: ScarOptions['masonry'] = timber ? 'wood' : wallMaterial === 'steel' ? 'steel' : wallMaterial === 'brick' ? 'brick' : 'concrete'
  const skin = rendered ? { material: 'plaster' as MaterialKey, tint: [0.8, 0.78, 0.73] as Vec3 } : undefined
  const cornerPeaks: [number, number][] = []
  for (let vx = 0; vx <= nx; vx++) for (let vz = 0; vz <= nz; vz++) {
    const around = [[vx - 1, vz - 1], [vx, vz - 1], [vx - 1, vz], [vx, vz]].filter(([cx, cz]) => occupied.has(key(cx, cz))).length
    if (around === 1 || around === 3) cornerPeaks.push([minX + vx * bay[0], minZ + vz * bay[1]])
  }
  const crown: Crown | undefined = severe ? {
    seed: hash(`${seed}:crown`), low: FOUNDATION_HEIGHT + (condition === 'leveled' ? 0.1 : 0.55), high: FOUNDATION_HEIGHT + (condition === 'leveled' ? 0.36 : Math.min(wallHeight - 0.12, 2.7)),
    stepped: wallCore === 'brick', grain: timber, peaks: cornerPeaks, peak: condition === 'leveled' ? 0.12 : 0.55,
  } : undefined

  const dropped = new Set<BlockPart>()
  const clampToCrown = (parts: BlockPart[]) => parts.filter((part) => {
    const top = crownLocal(part, crown!)
    let highest = -Infinity
    for (let u = -part.size[0] / 2; u < part.size[0] / 2; u += 0.04) highest = Math.max(highest, top(u))
    highest = Math.max(highest, top(part.size[0] / 2))
    const bottom = part.position[1] - part.size[1] / 2
    if (highest < -part.size[1] / 2 + 0.08) { dropped.add(part); part.size = [part.size[0], 0.01, part.size[2]]; part.position = [part.position[0], bottom + 0.005, part.position[2]]; return false }
    if (highest + 0.04 < part.size[1] / 2) { const keep = highest + 0.04 + part.size[1] / 2; part.size = [part.size[0], keep, part.size[2]]; part.position = [part.position[0], bottom + keep / 2, part.position[2]] }
    return true
  })

  const dropFloating = (parts: BlockPart[], origin: Vec3, yaw: number) => {
    const span = (p: BlockPart) => { const x = (p.position[0] - origin[0]) * Math.cos(yaw) - (p.position[2] - origin[2]) * Math.sin(yaw); return [x - p.size[0] / 2, x + p.size[0] / 2] }
    let kept = parts
    for (let changed = true; changed;) {
      changed = false
      kept = kept.filter((p) => {
        const bottom = p.position[1] - p.size[1] / 2, [a0, a1] = span(p)
        if (bottom < origin[1] + 0.02) return true
        const held = kept.some((q) => {
          if (q === p || q.position[1] + q.size[1] / 2 < bottom - 0.01 || q.position[1] - q.size[1] / 2 > bottom - 0.005) return false
          const [b0, b1] = span(q)
          return b0 < a1 + 0.01 && b1 > a0 - 0.01
        })
        if (!held) { dropped.add(p); changed = true }
        return held
      })
    }
    return kept
  }

  const scar = (parts: BlockPart[], run: { origin: Vec3; yaw: number; length: number; height: number; out: 1 | -1 }, openings: ScarOpening[], severity: ScarOptions['severity'], id: string, o: { burned?: boolean; partition?: boolean } = {}) => {
    const masonry: ScarOptions['masonry'] = o.burned ? 'wood' : o.partition ? (timber ? 'wood' : 'concrete') : scarMasonry
    const plaster = !o.burned && (o.partition ? !timber : rendered)
    const crownAt = crown ? (x: number) => { const p = transformPoint([x, 0, 0], run.origin, run.yaw); return crownHeight(crown, p[0], p[2]) - run.origin[1] } : undefined
    const plan = planScars({ length: run.length, height: run.height, openings, out: run.out }, { severity, masonry, rendered: plaster, seed: hash(`${seed}:scar:${id}`), crownAt })
    const core: MaterialKey = o.burned ? 'charcoal' : o.partition ? (timber ? 'wood' : 'brick') : wallCore
    distributeScars(parts, run.origin, run.yaw, plan, { core, skin: plaster ? skin ?? { material: 'plaster', tint: [0.8, 0.78, 0.73] } : undefined, crown })
    return plan
  }
  const porchLimit = porch ? porch.top - 0.08 - FOUNDATION_HEIGHT - 0.14 : Infinity
  const facades: FacadeRecord[] = []
  const shop = profile.facade === 'storefront' || (blueprint.id === 'shop-house')
  const facadeArea = outline.reduce((sum, e) => sum + e.s1 - e.s0, 0) * wallHeight * floors
  const heavy = facadeArea > 170, heavyBrick = style.wall.material === 'brick' && heavy

  const roleFor = (cell: Cell, dx: number, dz: number, level: number, isEntrance: boolean, loadingBay: boolean): EdgeRole => {
    const front = dz === 1 && cell.z === nz - 1
    if (chimney && chimney.edge === outlineOf(cell, dx, dz)) return 'solid'
    if (isEntrance) return shop && level === 0 ? 'storefront-entrance' : 'entrance'
    if (loadingBay && level === 0) return 'loading'
    if (blueprint.id === 'fire-station' && front && level === 0) return 'loading'
    if (shop && front && level === 0) return 'storefront'
    if (profile.feature === 'balconies' && front && level > 0) return 'balcony'
    if (profile.facade === 'industrial' || ['barn', 'stable', 'grain-store', 'sawmill'].includes(blueprint.id)) return (cell.x + cell.z + level) % 2 === 0 ? 'high' : 'solid'
    if (shop && level === 0) return (cell.x + cell.z) % 2 === 0 ? 'high' : 'solid'
    if (cell.zone === 'A' || cell.zone === 'S') return 'high'
    if (blueprint.category === 'Residências' && random(hash(`${seed}:${cell.x}:${cell.z}:${dx}:${dz}:${level}`))() < 0.14) return 'solid'
    return 'windows'
  }

  for (let level = 0; level < floors; level++) {
    const floorY = FOUNDATION_HEIGHT + level * FLOOR_HEIGHT
    const damagedLevel = level === floors - 1
    const vertices = new Map<string, { x: number; z: number; height: number }>()
    for (const cell of cells) for (const dx of [0, 1]) for (const dz of [0, 1]) {
      const vx = cell.x + dx, vz = cell.z + dz, id = key(vx, vz)
      if (vertices.has(id)) continue
      let height = wallHeight
      const noise = random(hash(`${seed}:${id}`))()
      const x = minX + vx * bay[0], z = minZ + vz * bay[1]

      if (crown) height = Math.min(wallHeight, crownHeight(crown, x, z) - floorY + 0.12 + noise * 0.42)
      vertices.set(id, { x, z, height })
      const boundary = [[vx - 1, vz - 1], [vx, vz - 1], [vx - 1, vz], [vx, vz]].some(([cx, cz]) => !occupied.has(key(cx, cz)))
      if (boundary || profile.partitions) {
        const postMaterial: MaterialKey = burnedAll && timber ? 'charcoal' : boundary ? wallMaterial : timber ? 'wood' : 'concrete'
        const post = b.box([0.2, height, 0.2], [x, floorY + height / 2, z], postMaterial, 'column', 0, level, 'structural-post')
        if (boundary && !burnedAll) post.tint = style.wall.tint
        if (crown) post.damage = { core: postMaterial === 'plaster' || postMaterial === 'brick' ? 'concrete' : postMaterial, crown: { seed: hash(`${seed}:post:${id}`), low: floorY + height - 0.32, high: floorY + height } }
      }
    }
    if (level > 0) for (const cell of cells) cutFloor(rectOf(cell), floorY, level, cell.zone)
    const builtEdges = new Set<string>()
    for (const cell of cells) {
      const [x, z] = center(cell)
      const program = programFor(blueprint, profile, cell, level, { cells, floors, entrance: frontCell })
      model.rooms.push({ id: `room-${level}-${cell.x}-${cell.z}`, label: `${program.label}${level ? ` · pavimento ${level + 1}` : ''}`, center: [x, floorY, z], level, kind: program.kind })
      for (const [dx, dz, a, c] of [
        [0, -1, [cell.x, cell.z], [cell.x + 1, cell.z]], [0, 1, [cell.x, cell.z + 1], [cell.x + 1, cell.z + 1]],
        [-1, 0, [cell.x, cell.z], [cell.x, cell.z + 1]], [1, 0, [cell.x + 1, cell.z], [cell.x + 1, cell.z + 1]],
      ] as [number, number, [number, number], [number, number]][]) {
        const edgeId = [key(...a), key(...c)].sort().join('|')
        if (builtEdges.has(edgeId)) continue
        builtEdges.add(edgeId)
        const outside = !occupied.has(key(cell.x + dx, cell.z + dz))
        const partition = profile.partitions || cell.zone === 'R' && dz !== 0 || separates(cell.zone, zoneAt.get(key(cell.x + dx, cell.z + dz)))
        const line = dx ? minX + a[0] * bay[0] : minZ + a[1] * bay[1]
        const record = (kind: EdgeRecord['kind'], openings: WallOpening[] = []) => edgeRecords.set(edgeKey(level, a, c), { axis: dx ? 'z' : 'x', line, kind, openings, inside: outside ? (-(dx || dz) as 1 | -1) : undefined })
        if (!outside && (!partition || (floors > 1 && cell.x === stairCell.x && dx === 0))) { record('open'); continue }
        const va = vertices.get(key(...a))!, vc = vertices.get(key(...c))!
        const height = severe ? wallHeight : Math.min(va.height, vc.height)
        const scarId = `${level}:${edgeId}`, pickScar = random(hash(`${seed}:scar-pick:${scarId}`))
        const yaw = dx ? Math.PI / 2 : 0
        const origin: Vec3 = [(va.x + vc.x) / 2, floorY, (va.z + vc.z) / 2]
        const world = (o: { x0: number; x1: number; y0: number; y1: number }, kind: WallOpening['kind']): WallOpening => dx ? { a: origin[2] - o.x1, b: origin[2] - o.x0, y0: o.y0, y1: o.y1, kind } : { a: origin[0] + o.x0, b: origin[0] + o.x1, y0: o.y0, y1: o.y1, kind }
        const length = (dx ? bay[1] : bay[0]) - 0.2
        const isEntrance = outside && dz === 1 && cell.x === frontCell.x && cell.z === frontCell.z && level === 0
        const loadingBay = outside && dz === 1 && cell.z === nz - 1 && (profile.facade === 'industrial' || ['barn', 'stable'].includes(blueprint.id))
        const edgeSide = dx === -1 ? 0 : dx === 1 ? 1 : dz === -1 ? 2 : 3
        const burnedEdge = condition === 'burned' && edgeSide === damageSide
        const material: MaterialKey = burnedEdge ? 'charcoal' : wallMaterial
        const breach = outside && !isEntrance && damagedLevel && (condition === 'damaged' || condition === 'burned') && edgeSide === damageSide && (cell.x + cell.z) % 2 === 0
        const openFrame = profile.facade === 'open' || ['car-wash', 'power-substation'].includes(blueprint.id)
        const panel = (width: number, tall: number, localX: number, bottom: number) => {
          if (width <= 0.005 || tall <= 0.005) return
          const part = b.box([width, tall, 0.2], transformPoint([localX, bottom + tall / 2, 0], origin, yaw), material, 'wall', yaw, level, outside ? 'exterior-wall' : 'room-partition')
          if (outside && !burnedEdge) part.tint = style.wall.tint
        }
        const out = (dx || dz) as 1 | -1
        if (!outside) {
          edges.push({ origin, yaw, outward: out, length, level, height, opening: 'door', outside, material })
          const door = 1.6, side = (length - door) / 2, first = model.parts.length
          const plain = (width: number, tall: number, localX: number, bottom: number) => {
            if (width <= 0.005 || tall <= 0.005) return
            const finish: MaterialKey = material === 'charcoal' ? 'charcoal' : timber ? 'wood' : 'plaster'
            const wall = b.box([width, tall, 0.2], transformPoint([localX, bottom + tall / 2, 0], origin, yaw), finish, 'wall', yaw, level, 'room-partition')
            if (finish === 'plaster') wall.tint = interior.wall
          }
          plain(side, height, -(door + side) / 2, 0); plain(side, height, (door + side) / 2, 0)
          plain(door, height - 2.3, 0, 2.3)
          const roll = pickScar()
          const severity: ScarOptions['severity'] | null = severe ? 'ruin' : condition === 'damaged' && damagedLevel ? (roll < 0.25 ? 'cracked' : roll < 0.7 ? 'aged' : null) : roll < (condition === 'weathered' ? 0.3 : 0.45) ? 'aged' : null
          const parts = severe ? dropFloating(clampToCrown(model.parts.slice(first)), origin, yaw) : model.parts.slice(first)
          if (severity) scar(parts, { origin, yaw, length, height, out: 1 }, [{ x0: -door / 2, x1: door / 2, y0: 0, y1: 2.3, kind: 'door' }], severity, scarId, { partition: true })
          record('partition', [world({ x0: -door / 2, x1: door / 2, y0: 0, y1: 2.3 }, 'door')])
          continue
        }
        const outlineEdge = outlineOf(cell, dx, dz)
        if (openFrame && !isEntrance && !loadingBay) {
          edges.push({ origin, yaw, outward: out, length, level, height, opening: 'frame', outside, material })
          panel(length, Math.min(0.35, height), 0, 0)
          record('exterior', [world({ x0: -length / 2, x1: length / 2, y0: Math.min(0.35, height), y1: height }, 'gap')])
          facades.push({ edge: outlineEdge, level, openings: [], role: 'solid', length, height, floorY })
          continue
        }
        const baseRun: Run = { origin, yaw, out, length, height, level, material, tint: burnedEdge ? undefined : style.wall.tint, relief: burnedEdge ? undefined : heavyBrick ? 'flat' : style.wall.relief, lower: style.lower && level === 0 && !burnedEdge ? style.lower : undefined,
          stripes: burnedEdge ? undefined : style.bands, lining: burnedEdge || timber || !interior.lining ? undefined : { material: 'plaster', tint: interior.wall } }
        if (severe) {

          const door = isEntrance || loadingBay ? Math.min(profile.entryWidth, length - 0.6) : 0
          const openings: Opening[] = door ? [{ x0: -door / 2, x1: door / 2, y0: 0, y1: Math.min(2.3, height - 0.3), kind: 'door', leaves: 0 }]
            : condition === 'ruined' ? planOpenings(roleFor(cell, dx, dz, level, false, false), length, height, style, random(hash(`${seed}:openings:${cell.x}:${cell.z}:${dx}:${dz}:${level}`)), profile.entryWidth) : []
          const first = model.parts.length
          wallPanels(b, baseRun, openings)
          const panels = dropFloating(clampToCrown(model.parts.slice(first)), origin, yaw)
          scar(panels, baseRun, openings, 'ruin', scarId)
          const standing = crownHeight(crown!, origin[0], origin[2]) - floorY
          edges.push({ origin, yaw, outward: out, length, level, height: standing, opening: door ? 'door' : 'solid', outside, material })
          record('exterior', openings.filter((o) => o.y0 < standing - 0.2).map((o) => world({ ...o, y1: Math.min(o.y1, standing) }, o.y0 < 0.05 ? 'door' : 'window')))
          facades.push({ edge: outlineEdge, level, openings: door ? openings : [], role: door ? 'entrance' : 'solid', length, height: standing, floorY })
          continue
        }
        if (breach) {

          const first = model.parts.length
          wallPanels(b, baseRun, [])
          const plan = scar(model.parts.slice(first), baseRun, [], 'breach', scarId, { burned: burnedEdge })
          const gap = plan.holes[0] ? holeExtent(plan.holes[0]) : null
          edges.push({ origin, yaw, outward: out, length, level, height, opening: 'breach', outside, material })
          record('exterior', gap ? [world({ x0: Math.max(-length / 2, gap.x0), x1: Math.min(length / 2, gap.x1), y0: Math.max(0.06, gap.y0), y1: Math.min(height, gap.y1) }, 'gap')] : [])
          facades.push({ edge: outlineEdge, level, openings: [], role: 'solid', length, height, floorY })
          continue
        }
        let role = roleFor(cell, dx, dz, level, isEntrance, loadingBay)
        const fractured = (role === 'solid' || role === 'windows') && condition === 'damaged' && damagedLevel && (cell.x + cell.z + edgeSide) % 3 === 0
        const covered = porch && level === 0 && dz === 1 && cell.z === nz - 1
        let openings: Opening[] = planOpenings(role, length, height, style, random(hash(`${seed}:openings:${cell.x}:${cell.z}:${dx}:${dz}:${level}`)), profile.entryWidth)
        if (covered) openings = openings.flatMap((o) => {
          if (o.kind === 'window') { const y1 = Math.min(o.y1, porchLimit); return y1 - o.y0 < 0.6 ? [] : [{ ...o, y1 }] }
          if (o.kind === 'door') return [{ ...o, y1: Math.min(o.y1, porchLimit) }]
          return [o]
        })
        if (!openings.length && role !== 'solid') role = 'solid'
        const run = baseRun, first = model.parts.length
        wallPanels(b, run, openings)
        const roll = pickScar()
        const severity: ScarOptions['severity'] | null = fractured ? 'cracked' : burnedEdge ? 'scorched'
          : condition === 'damaged' && damagedLevel ? (roll < 0.25 ? 'cracked' : roll < 0.85 ? 'aged' : null)
          : roll < (condition === 'weathered' ? 0.55 : 0.6) ? 'aged' : null
        if (severity) scar(model.parts.slice(first), run, openings, severity, scarId, { burned: burnedEdge })
        const dress = { style: covered ? { ...style, window: { ...style.window, pediment: false } } : style, condition, burned: burnedEdge, rng: random(hash(`${seed}:dress:${cell.x}:${cell.z}:${dx}:${dz}:${level}`)) }
        for (const o of openings) {
          if (o.kind === 'window') dressWindow(b, run, o, dress)
          else if (o.kind === 'door') dressDoor(b, run, o, { ...dress, hood: !covered && level === 0 && blueprint.category === 'Residências' })
          else if (o.kind === 'roll') dressRoll(b, run, o, dress)
          else dressStorefront(b, run, o, dress)
        }
        const opening = fractured ? 'fracture' : openings.some((o) => o.y0 < 0.05) ? 'door' : openings.length ? 'window' : 'solid'
        record('exterior', openings.map((o) => world(o, o.y0 < 0.05 ? 'door' : 'window')))
        edges.push({ origin, yaw, outward: out, length, level, height, opening, outside, material })
        facades.push({ edge: outlineEdge, level, openings, role, length, height, floorY })
      }
      if ((condition === 'ruined' || condition === 'leveled') && (cell.x + cell.z) % 3 === 0) {
        place(timber ? 'planks' : 'concrete-rubble', [x + bay[0] / 2 - 1.15, floorY, z + bay[1] / 2 - 1], 0, level, 0)
      }
    }
    if (level < floors - 1) {
      place('stairs', [stairX, floorY, stairZ], 0, level)
      const step = 4.8 / 16
      const frontZ = stairZ + 2.4
      model.routes.push({ id: `stair-entry-${level}`, from: [stairX, floorY, frontZ + 0.4], to: [stairX, floorY + 0.2, frontZ - step / 2] })
      for (let i = 0; i < 15; i++) model.routes.push({ id: `stair-${level}-${i}`, from: [stairX, floorY + (i + 1) * 0.2, frontZ - (i + 0.5) * step], to: [stairX, floorY + (i + 2) * 0.2, frontZ - (i + 1.5) * step] })
      model.routes.push({ id: `stair-exit-${level}`, from: [stairX, floorY + FLOOR_HEIGHT, stairZ - 2.4 + step / 2], to: [stairX, floorY + FLOOR_HEIGHT, stairZ - 2.4 - 0.4] })
    }
  }

  const plinthTop = FOUNDATION_HEIGHT + (condition === 'leveled' ? 0 : plinthHeight(style, facades))
  const plinthM: MaterialKey = burnedAll ? 'charcoal' : style.plinth.material, plinthT = burnedAll ? undefined : style.plinth.tint
  const cutsFor = (edge: OutlineEdge) => facades.filter((f) => f.edge === edge && f.level === 0).flatMap((f) => {
    const mid = (edge.s0 + edge.s1) / 2
    return groundCuts(f.openings).map(([a, c]) => [mid + Math.min(a, -c), mid + Math.max(c, -a)] as [number, number])
  })
  for (const edge of outline) {
    outlineStrip(b, edge, 0, 0.16, 0, FOUNDATION_HEIGHT, plinthM === 'charcoal' ? 'concrete' : plinthM, 'foundation', 'plinth-skirt', 0, plinthT)
    if (plinthTop > FOUNDATION_HEIGHT + 0.05) outlineStrip(b, edge, 0.1, 0.16, FOUNDATION_HEIGHT, plinthTop, plinthM, 'fixture', 'plinth-band', 0, plinthT, cutsFor(edge))
  }
  if (!severe) {
    const trimM: MaterialKey = burnedAll ? 'charcoal' : style.trim.material, trimT = burnedAll ? undefined : style.trim.tint
    const clearance = roof.steepest ? 0.05 * roof.steepest + 0.02 : 0
    for (let level = 0; level < floors; level++) {
      const floorY = FOUNDATION_HEIGHT + level * FLOOR_HEIGHT
      const y0 = level === 0 ? plinthTop : floorY, y1 = floorY + wallHeight - (level === floors - 1 ? clearance : 0)
      if (level > 0) for (const edge of outline) outlineStrip(b, edge, 0, 0.16, floorY - 0.2, floorY, trimM === 'steel' ? 'concrete' : trimM, 'floor', 'belt-course', level, trimT)
      if (style.corners !== 'none') cornerTrims(b, outline, style.corners, y0, y1, trimM, trimT ?? [1, 1, 1], level)
      for (const edge of outline) for (const end of ['end'] as const) {
        if (edge[end] !== 'straight' || (porch && level === 0 && edge.running === 'x' && edge.out > 0 && edge.line === maxZ)) continue
        const v = edge.s1, pw = 0.36, pd = style.wall.relief || style.wall.material === 'brick' ? 0.04 : 0.03
        const brick = style.wall.material === 'brick' && !burnedAll, mat: MaterialKey = burnedAll ? 'charcoal' : style.wall.relief || style.wall.material === 'steel' ? trimM : style.wall.material
        const tint = burnedAll ? undefined : style.wall.relief || style.wall.material === 'steel' ? trimT : style.wall.tint && [style.wall.tint[0] * 0.94, style.wall.tint[1] * 0.94, style.wall.tint[2] * 0.94] as Vec3
        const across = edge.line + edge.out * (0.1 + pd / 2)
        const part = edge.running === 'x' ? b.box([pw, y1 - y0, pd], [v, (y0 + y1) / 2, across], mat, brick ? 'wall' : 'fixture', 0, level, 'pilaster') : b.box([pd, y1 - y0, pw], [across, (y0 + y1) / 2, v], mat, brick ? 'wall' : 'fixture', 0, level, 'pilaster')
        if (tint) part.tint = tint
        if (brick && heavyBrick) part.relief = { kind: 'flat', side: 1 }
      }
    }
  }
  b.socket(foundation, 'salvage', true, 'Materiais recuperáveis na fundação', bay[0] * 0.3, bay[1] * 0.3, { container: 'foundation' })
  buildSiteFeatures(b, model, blueprint, profile, {
    x0: minX, x1: -minX, z0: minZ, z1: maxZ, bay, wallHeight, cells, frontX0, frontX1, style, edges: outline, roof, eave, plinthTop, facades, porch, chimney, floors,
  })

  for (const part of model.parts) {
    if (heavy && (part.role === 'wall' || part.role === 'column') && ['plaster', 'brick', 'concrete'].includes(part.material) && !part.relief && !part.primitive && !part.id.includes('/instance-') && !part.id.includes('/site-')) {
      part.relief = { kind: 'flat', side: 1 }
      part.coarse = true
    }
    if (part.relief?.kind === 'flat') part.coarse = true
    if ((part.primitive && part.primitive !== 'box') || part.relief || part.bevel !== undefined || part.id.includes('/instance-') || part.id.includes('/site-')) continue
    if (part.role !== 'wall' && part.role !== 'floor' && Math.min(...part.size) <= 0.075) part.bevel = 0
  }
  furnishInterior(b, model, { blueprint, profile, cells, bay, minX, minZ, nx, nz, floors, condition, seed, edges: edgeRecords, entrance: frontCell, entranceX, stair: floors > 1 ? { x: stairX, z: stairZ } : undefined })
  if (options.contents === true) addContents(b, seed)
  scatterDebris(model, { edges, bay, condition, wallMaterial, timber })
  if (dropped.size) model.parts = model.parts.filter((part) => !dropped.has(part))
  return model
}

function addContents(builder: ModelBuilder, seed: number) {
  for (const socket of [...builder.model.sockets]) {
    if (socket.concealed) continue
    const spec = assetFor(contentFamily[socket.kind], 0)
    const support = builder.model.parts.find((part) => part.id === socket.support)
    const prefix = builder.append(buildAsset(spec), socket.position, support?.yaw ?? 0, support?.level ?? 0, `${socket.id}/content-${seed}`)
    ;(builder.model as StructureModel).instances?.push({ asset: spec.id, position: socket.position, yaw: support?.yaw ?? 0, level: support?.level ?? 0, prefix })
  }
}

function buildCompound(blueprint: Blueprint, seed: number, options: BuildOptions): StructureModel {
  const condition = options.condition ?? 'damaged'
  const b = new ModelBuilder(`${blueprint.id}-${seed}-${condition}`, blueprint.label)
  b.box([36, FOUNDATION_HEIGHT, 36], [0, FOUNDATION_HEIGHT / 2, 0], 'concrete', 'foundation')
  const model: StructureModel = { ...b.model, blueprint: blueprint.id, seed, condition, context: blueprint.context, floors: 1, rooms: [], routes: [], instances: [], entrance: [-7, 0, 19.5], weather: weatherFor(blueprint, styleFor(blueprint, architectureFor(blueprint), seed), seed) }
  b.model = model
  const wallHeight = condition === 'leveled' ? 0.28 : condition === 'ruined' ? 1.1 : blueprint.id === 'survivor-camp' ? 1.7 : blueprint.id === 'research-outpost' ? 2.2 : 2.8
  const baseY = FOUNDATION_HEIGHT
  const perimeter: MaterialKey = blueprint.id === 'survivor-camp' ? 'wood' : 'concrete'
  b.box([35.2, wallHeight, 0.2], [0, baseY + wallHeight / 2, -17.5], perimeter, 'wall')
  for (const x of [-17.5, 17.5]) b.box([0.2, wallHeight, 34.8], [x, baseY + wallHeight / 2, 0], perimeter, 'wall')
  b.box([9, wallHeight, 0.2], [-13.1, baseY + wallHeight / 2, 17.5], perimeter, 'wall')
  b.box([23.2, wallHeight, 0.2], [6, baseY + wallHeight / 2, 17.5], perimeter, 'wall')
  if (condition !== 'leveled' && condition !== 'ruined' && blueprint.id !== 'survivor-camp') {
    const coil = (len: number, x: number, z: number, yaw: number) => b.box([len, 0.06, 0.06], [x, baseY + wallHeight + 0.03, z], 'steel', 'fixture', yaw, 0, 'wall-coping-wire')
    coil(35.2, 0, -17.5, 0); coil(9, -13.1, 17.5, 0); coil(23.2, 6, 17.5, 0)
    for (const x of [-17.5, 17.5]) coil(34.8, x, 0, Math.PI / 2)
  }
  for (const [i, position] of ([[ -8.5, baseY, -8 ], [8.5, baseY, -8], [8.5, baseY, 8]] as Vec3[]).entries()) {
    const research = blueprint.id === 'research-outpost', camp = blueprint.id === 'survivor-camp'
    const template = BLUEPRINT_BY_ID.get(camp ? 'wood-house' : 'caretaker-house')!
    const specialty = research ? ['radio-console', 'lab-equipment', 'medicine-fridge'][i] : camp ? ['hearth', 'camp-tent', 'field-kitchen'][i] : ['radio-console', 'bunk-bed', 'weapon-display'][i]
    const cabin: Blueprint = { ...template, id: `${blueprint.id}-annex-${i}`, category: 'Serviços públicos', context: 'base', equipment: research ? ['lab-bench', 'server-rack', 'medicine-cabinet', 'desk'] : camp ? ['bunk-bed', 'grocery-shelf', 'workbench', 'water-tank'] : ['bunk-bed', 'locker', 'gun-cabinet', 'radio-desk'], label: i === 0 ? 'Comunicações e comando' : i === 1 ? research ? 'Laboratório de pesquisa' : 'Alojamento' : 'Apoio e suprimentos' }
    const architecture: Architecture = { ...architectureFor(template), plan: i === 1 ? ['TR', 'EE'] : ['RT', 'EE'], roof: camp ? 'gable' : research ? 'shed' : 'flat', facade: camp ? 'timber' : 'industrial', specialty, feature: i === 0 ? 'utility' : 'none', bay: [4.8, 5.4], partitions: research }
    const child = buildStructure(cabin, seed + i, { ...options, architecture })
    b.append(child, position, 0, 0, `${model.id}/cabin-${i}`)
    model.rooms.push(...child.rooms.map((room) => ({ ...room, id: `cabin-${i}/${room.id}`, center: transformPoint(room.center, position) })))
    model.routes.push(...child.routes.map((route) => ({ ...route, id: `cabin-${i}/${route.id}`, from: transformPoint(route.from, position), to: transformPoint(route.to, position) })))
    model.instances.push(...child.instances.map((instance) => ({ ...instance, position: transformPoint(instance.position, position), prefix: instance.prefix && `${model.id}/cabin-${i}/${instance.prefix}` })))
    model.decor = [...(model.decor ?? []), ...(child.decor ?? []).map((item) => ({ ...item, position: transformPoint(item.position, position) }))]
  }
  const supply = buildAsset(assetFor('crate', 1))
  const supplyPrefix = b.append(supply, [-11, baseY, 9], 0)
  model.instances.push({ asset: 'crate-1', position: [-11, baseY, 9], yaw: 0, level: 0, prefix: supplyPrefix })
  if (blueprint.id === 'survivor-camp' && condition !== 'leveled') {
    const tentPrefix = b.append(buildAsset('camp-tent-1'), [-12, baseY, 6], 0, 0, `${model.id}/courtyard-tent`)
    model.instances.push({ asset: 'camp-tent-1', position: [-12, baseY, 6], yaw: 0, level: 0, prefix: tentPrefix })
  }
  if (blueprint.id === 'research-outpost' && condition !== 'leveled') {
    const tall = condition === 'ruined' ? 1.3 : 4.8
    b.box([0.8, 0.18, 0.8], [-3, baseY + 0.09, 8], 'concrete', 'fixture', 0, 0, 'antenna-footing')
    b.box([0.1, tall, 0.1], [-3, baseY + 0.18 + tall / 2, 8], 'steel', 'fixture', 0, 0, 'research-antenna')
    b.box([1.8, 0.06, 0.08], [-3, baseY + 0.18 + tall + 0.03, 8], 'steel', 'fixture', 0, 0, 'antenna-crossbar')
  }
  return model
}
