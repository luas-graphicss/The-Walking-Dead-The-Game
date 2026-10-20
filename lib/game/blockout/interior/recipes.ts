import type { Condition, LootKind } from '../types'
import type { Placed } from './placer'
import { extent, OPPOSITE, SIDES, WALL_YAW, type Program, type Room, type Side } from './room'
import { shopFor } from './programs'

type Recipe = (r: Room, p: Program) => void
const DENSITY: Record<Condition, number> = { weathered: 1, damaged: 0.88, burned: 0.72, ruined: 0.45, leveled: 0.15 }
const ok = (r: Room, p = 1) => r.chance(p * DENSITY[r.mess.condition])

const facing = (side: Side) => WALL_YAW[OPPOSITE[side]]
const ns = (side: Side) => side === 'n' || side === 's'
const along = (side: Side, p: Placed): [number, number] => (ns(side) ? [p.box.x0, p.box.x1] : [p.box.z0, p.box.z1])
const mid = (p: Placed): [number, number] => [(p.box.x0 + p.box.x1) / 2, (p.box.z0 + p.box.z1) / 2]

const deckTop = (host: Placed) => host.parts.reduce((top, part) => (!part.detail && part.size[0] * part.size[2] >= 0.01 && !part.pitch && !part.roll ? Math.max(top, part.position[1] + part.size[1] / 2) : top), -Infinity)
function stackOn(r: Room, host: Placed | null, family: string, o: { yaw?: number; variant?: number } = {}): Placed | null {
  if (!host || host.tipped) return null
  const top = deckTop(host)
  if (!Number.isFinite(top)) return null
  const [x, z] = mid(host), own = new Set(host.parts.map((part) => part.id))
  for (const [dx, dz] of [[0, 0], [0.06, 0.04], [-0.06, -0.04], [0.05, -0.06], [-0.05, 0.06]]) {
    const placed = r.put(family, (o.yaw ?? host.yaw) + r.jitter(0.25), { center: [x + dx, z + dz] }, { base: top, floor: false, contact: (part) => own.has(part.id), variant: o.variant ?? Math.floor(r.rng() * 3), keepOut: false })
    if (placed) return placed
  }
  return null
}
const inward = (side: Side): [number, number] => (side === 'n' ? [0, 1] : side === 's' ? [0, -1] : side === 'w' ? [1, 0] : [-1, 0])
const frac = (r: Room, side: Side, t: number) => { const [a, b] = r.range(side); return Math.min(1, Math.max(0, (t - a) / (b - a))) }
const theme = (p: Program, fallback: LootKind = 'salvage') => (p.theme as LootKind | undefined) ?? fallback

function anyWall(r: Room, family: string, sides: Side[], o: Parameters<Room['wall']>[2] = {}) {
  for (const side of sides) { const placed = r.wall(family, side, o); if (placed) return { placed, side } }
  return null
}

function lineWalls(r: Room, family: string, sides: Side[], max = 8, o: Parameters<Room['wall']>[2] = {}) {
  const out: Placed[] = []
  for (const side of sides) for (let i = 0; i < max && out.length < max; i++) { const placed = r.wall(family, side, { at: 'start', ...o }); if (!placed) break; out.push(placed) }
  return out
}
function wallArt(r: Room, count: number, height = 1.45) {
  for (const side of r.rank('solid')) {
    if (count <= 0) return
    if (ok(r, 0.75) && r.wall('wall-art', side, { mountAt: height + r.jitter(0.1), variant: Math.floor(r.rng() * 3), at: 'any', tries: 6, connect: false })) count--
  }
}
function plant(r: Room) { if (ok(r, 0.55)) anyWall(r, 'potted-plant', r.rank('solid'), { at: r.pick(['start', 'end']) as 'start' | 'end', variant: Math.floor(r.rng() * 3) }) }
function lamp(r: Room, near?: Placed) {
  if (!ok(r, 0.6)) return
  if (near) { const [x, z] = mid(near); r.near('floor-lamp', x + (near.box.x1 - near.box.x0) / 2 + 0.3, z, 0, { radius: 0.8, variant: Math.floor(r.rng() * 3) }) }
  else anyWall(r, 'floor-lamp', r.rank('solid'), { at: 'start', variant: Math.floor(r.rng() * 3) })
}

function litter(r: Room, kinds: string[], count: number) {
  const n = Math.round(count * (0.4 + r.mess.chaos))
  for (let i = 0; i < n; i++) r.scatter(r.pick(kinds), { variant: Math.floor(r.rng() * 3), connect: false, wallward: r.chance(0.6), margin: 0.3, tries: 4, burned: false })
}

function aftermath(r: Room, o: { loot?: LootKind; nest?: number; trash?: number; barricade?: number; litter?: string[] } = {}) {
  const chaos = r.mess.chaos
  if (r.mess.condition === 'leveled') return
  const windowWalls = SIDES.filter((side) => r.walls[side].kind === 'exterior' && r.windows(side).length)
  if (windowWalls.length && r.chance((o.barricade ?? 0.12) + chaos * 0.3)) {
    const side = r.pick(windowWalls), win = r.pick(r.windows(side))
    r.wall('barricade', side, { at: frac(r, side, (win.a + win.b) / 2), inset: 0.08, jitter: r.jitter(0.06), tries: 4, pad: 0.05, overWindows: true })
  }
  if (r.chance((o.nest ?? 0.06) + chaos * 0.08)) {
    const bed = anyWall(r, r.chance(0.5) ? 'mattress' : 'sleeping-bag', r.rank('solid'), { at: r.pick(['start', 'end']) as 'start' | 'end', jitter: r.jitter(0.25), variant: Math.floor(r.rng() * 3) })
    if (bed) {
      const [x, z] = mid(bed.placed)
      for (const family of ['cans', 'bottles', 'cardboard-boxes']) r.near(family, x + r.jitter(0.9), z + r.jitter(0.9), r.rng() * 6, { radius: 0.9, variant: Math.floor(r.rng() * 3), connect: family === 'cardboard-boxes' })
    }
  }
  for (let i = 0; i < Math.round((o.trash ?? 0.4) * (0.5 + chaos * 2)); i++) anyWall(r, r.chance(0.6) ? 'trash-bags' : 'cardboard-boxes', r.rank('solid'), { at: r.pick(['start', 'end']) as 'start' | 'end', jitter: r.jitter(0.5), variant: Math.floor(r.rng() * 3), tries: 4 })
  litter(r, o.litter ?? ['papers', 'plastic', 'cloth'], 2 + chaos * 4)
}

function bedSet(r: Room, bed: string, nightstands: number, exclude: Side[] = []) {
  for (const side of r.rank('solid', exclude)) {
    const placed = r.wall(bed, side, { at: r.pick(['center', 0.35, 0.65]) as 'center' | number, jitter: r.jitter(0.02 + r.mess.chaos * 0.06) })
    if (!placed) continue
    const [a, b] = along(side, placed)
    if (nightstands > 0) r.wall('nightstand', side, { within: [a - 0.75, a - 0.03], at: 'end', variant: 1 })
    if (nightstands > 1) r.wall('nightstand', side, { within: [b + 0.03, b + 0.75], at: 'start', variant: 1 })
    if (ok(r, 0.55)) r.wall('wall-art', side, { mountAt: 1.3, within: [a, b], at: 'center', variant: Math.floor(r.rng() * 3), connect: false })
    return { placed, side }
  }
  return null
}

function deskSet(r: Room, desk: string, chair: string, prefer: 'window' | 'solid' = 'window', exclude: Side[] = []) {
  for (const side of r.rank(prefer, exclude)) {
    const placed = r.wall(desk, side, { at: 'any' })
    if (!placed) continue
    const [x, z] = mid(placed), [nx, nz] = inward(side), depth = ns(side) ? placed.box.z1 - placed.box.z0 : placed.box.x1 - placed.box.x0
    const tipped = r.chance(0.04 + r.mess.chaos * 0.3)
    const cx = x + nx * (depth / 2 + 0.22 + (tipped ? 0.5 : r.rng() * 0.25)), cz = z + nz * (depth / 2 + 0.22 + (tipped ? 0.5 : r.rng() * 0.25))
    r.near(chair, cx, cz, WALL_YAW[side] + Math.PI + r.jitter(0.25 + r.mess.chaos * 0.6), { radius: 0.4, pitch: tipped ? -Math.PI / 2 : undefined }) ?? r.near(chair, cx, cz, WALL_YAW[side] + Math.PI, { radius: 0.4 })
    return { placed, side }
  }
  return null
}

function diningSet(r: Room, table = 'dining-table', chair = 'dining-chair', seats = 4, at?: [number, number]) {
  const yaw = (r.w >= r.d ? 0 : Math.PI / 2) + r.jitter(0.04 + r.mess.chaos * 0.25)
  const [x, z] = at ?? [r.cx + r.jitter(0.3), r.cz + r.jitter(0.3)]
  if (r.chance(r.mess.chaos * 0.28)) {
    const flipped = r.near(table, x, z, yaw + r.jitter(0.6), { radius: 0.8, roll: Math.PI / 2 })
    if (flipped) { for (let i = 0; i < seats - 1; i++) r.near(chair, x + r.jitter(1.4), z + r.jitter(1.4), r.rng() * 6, { radius: 0.6, pitch: r.chance(0.6) ? -Math.PI / 2 : undefined }); return flipped }
  }
  const placed = r.near(table, x, z, yaw, { radius: 0.9 })
  if (placed) r.chairsAround(placed, chair, seats)
  return placed
}

function livingSet(r: Room, hearth: boolean) {
  const ranked = r.rank('solid')
  const chaos = r.mess.chaos
  let sofa: Placed | null = null, sofaSide: Side | null = null
  for (const side of ranked) {
    if (r.chance(chaos * 0.3)) {
      sofa = r.near('sofa', r.cx + r.jitter(0.6), r.cz + r.jitter(0.6), r.rng() * Math.PI * 2, { radius: 0.9, pitch: -Math.PI / 2 })
      if (sofa) break
    }
    sofa = r.wall('sofa', side, { at: 'center', jitter: r.jitter(0.03 + chaos * 0.08), variant: Math.floor(r.rng() * 3) })
    if (sofa) { sofaSide = side; break }
  }
  const focalWalls = sofaSide ? [OPPOSITE[sofaSide], ...ranked.filter((s) => s !== sofaSide && s !== OPPOSITE[sofaSide!])] : ranked
  const focalFamily = hearth ? 'hearth' : 'tv-stand'
  const target = sofa && sofaSide ? frac(r, OPPOSITE[sofaSide], ns(sofaSide) ? mid(sofa)[0] : mid(sofa)[1]) : 'center'
  const focal = anyWall(r, focalFamily, focalWalls, { at: target })
  if (sofa && sofaSide) {
    const [sx, sz] = mid(sofa), [nx, nz] = inward(sofaSide), half = ns(sofaSide) ? (sofa.box.z1 - sofa.box.z0) / 2 : (sofa.box.x1 - sofa.box.x0) / 2
    const yaw = WALL_YAW[sofaSide], cx = sx + nx * (half + 0.72), cz = sz + nz * (half + 0.72)
    const rug = ok(r, 0.8) ? r.put('rug', yaw + r.jitter(0.05 + chaos * 0.2), { center: [cx, cz] }, { variant: Math.floor(r.rng() * 2), connect: false }) ?? r.put('rug', yaw, { center: [cx, cz] }, { variant: 0, connect: false }) : null
    const rugIds = new Set(rug?.parts.map((part) => part.id))
    const flip = r.chance(chaos * 0.3)
    const coffee = r.put('coffee-table', yaw + r.jitter(0.04 + chaos * 0.4), { center: [cx + r.jitter(0.08), cz + r.jitter(0.08)] }, { base: rug && !flip ? r.floorY + 0.012 : r.floorY, contact: (part) => rugIds.has(part.id), floor: !(rug && !flip), roll: flip ? Math.PI / 2 : undefined })
    r.dress(coffee, 'documents', 0.7, 2)
    const side = r.chance(0.5) ? 1 : -1, tx = ns(sofaSide) ? 1 : 0, tz = ns(sofaSide) ? 0 : 1
    for (const s of ok(r, 0.5) ? [side, -side] : [side]) {
      const ax = cx + tx * s * 1.25, az = cz + tz * s * 1.25
      const face = Math.atan2(cx - ax, cz - az)
      r.near('armchair', ax, az, face + r.jitter(0.35 + chaos * 0.4), { radius: 0.5, pitch: r.chance(chaos * 0.25) ? -Math.PI / 2 : undefined, variant: Math.floor(r.rng() * 3) })
    }
    lamp(r, sofa)
    if (ok(r, 0.6)) r.wall('wall-art', sofaSide, { mountAt: 1.4, within: along(sofaSide, sofa), at: 'center', variant: Math.floor(r.rng() * 3), connect: false })
  } else if (!sofa) r.scatter('armchair', { tries: 6 })
  if (focal && !hearth && ok(r, 0.5)) r.wall('bookcase', focal.side, { at: 'start' })
  return { sofa, sofaSide, focal }
}

function kitchenRun(r: Room, withTable: boolean) {
  const ranked = r.rank('window')
  let main: Side | null = null, sink: Placed | null = null
  for (const side of ranked) {
    const win = r.windows(side)[0]
    sink = r.wall('sink', side, { at: win ? frac(r, side, (win.a + win.b) / 2) : r.pick([0.3, 0.7]) })
    if (sink) { main = side; break }
  }
  const placed: Placed[] = []
  if (main && sink) {
    const [wa, wb] = r.range(main), [a, b] = along(main, sink)
    placed.push(...r.run(['kitchen-counter', 'oven', 'kitchen-counter', 'fridge'], main, { from: 'end', range: [wa, a - 0.015], variant: 1 }))
    placed.push(...r.run(['kitchen-counter', 'kitchen-counter', 'fridge'], main, { from: 'start', range: [b + 0.015, wb], variant: 1 }))
    for (const c of placed) if (c.spec.family === 'kitchen-counter' && ok(r, 0.85)) r.wall('wall-cabinet', main, { mountAt: 1.45, within: along(main, c), at: 'center', variant: c.spec.variant, connect: false })
    for (const c of placed) if (c.spec.family === 'kitchen-counter') r.dress(c, 'food', 0.6, 2)
    r.dress(sink, 'food', 0.4, 1)
  }
  if (!placed.some((p) => p.spec.family === 'fridge')) anyWall(r, 'fridge', r.rank('solid', main ? [main] : []), { at: 'start' })
  if (!placed.some((p) => p.spec.family === 'oven')) anyWall(r, 'oven', r.rank('solid', main ? [main] : []), { at: 'any' })
  if (main && ok(r, 0.7)) {
    const corner = r.rank('solid', [main, OPPOSITE[main]])[0]
    if (corner) r.run(['kitchen-counter', 'shelf'], corner, { from: r.chance(0.5) ? 'start' : 'end', variant: 1 })
  }
  if (withTable) diningSet(r, 'dining-table', 'dining-chair', 4)
  if (ok(r, 0.6)) anyWall(r, 'trash-bags', r.rank('solid'), { at: 'end', variant: 0 })
}

const bedroom: Recipe = (r, p) => {
  const bed = (p.bed as string) ?? 'single-bed', kids = Boolean(p.kids)
  const main = bedSet(r, bed, bed === 'double-bed' ? 2 : 1)
  const used = main ? [main.side] : []
  if (kids && bed === 'single-bed' && ok(r, 0.85)) { const second = bedSet(r, 'single-bed', 1, used); if (second) used.push(second.side) }
  anyWall(r, p.rental ? 'locker' : 'wardrobe', r.rank('solid', used), { at: r.pick(['start', 'end']) as 'start' | 'end' })
  if (ok(r, 0.75)) anyWall(r, 'dresser', r.rank('solid', used), { at: 'any' })
  if ((kids || p.rental || bed === 'single-bed' || p.guest) && ok(r, 0.7)) deskSet(r, 'desk', 'dining-chair', 'window', used)
  if (kids && ok(r, 0.7)) { anyWall(r, 'crate', r.rank('solid'), { at: 'any', variant: 0 }); r.scatter('play-table', { tries: 4, variant: 0 }) }
  if (ok(r, 0.55)) r.scatter('rug', { variant: 0, connect: false, tries: 4, yaw: r.chance(0.5) ? 0 : Math.PI / 2 })
  if (p.rustic) { anyWall(r, 'crate', r.rank('solid'), { at: 'any' }); anyWall(r, 'barrel', r.rank('solid'), { at: 'end' }) } else lamp(r)
  aftermath(r, { loot: 'textiles', nest: 0.02, litter: ['cloth', 'cloth', 'papers', 'plastic'] })
}

const bathroom: Recipe = (r, p) => {
  const ranked = r.rank('solid')
  const tub = anyWall(r, 'bathtub', ranked, { at: 'start', jitter: Math.PI / 2 })
  anyWall(r, 'toilet', ranked, { at: 'end' })
  const sink = anyWall(r, 'sink', r.rank('window'), { at: 'any', variant: 0 })
  if (sink) r.dress(sink.placed, 'medical', 0.6, 1)
  anyWall(r, 'medicine-cabinet', ranked, { at: 'any' })
  if (p.laundry !== false) {
    const wm = anyWall(r, 'washing-machine', ranked, { at: tub ? 'end' : 'start' })
    if (wm) r.wall('shelf', wm.side, { at: 'any', variant: 0 })
    if (ok(r, 0.6)) r.scatter('clothes-rack', { tries: 4, variant: 0 })
  }
  aftermath(r, { litter: ['cloth', 'bottles', 'medicine'], trash: 0.2, nest: 0 })
}

const kitchen: Recipe = (r, p) => {
  kitchenRun(r, Boolean(p.table))
  aftermath(r, { loot: 'food', litter: ['cans', 'bottles', 'food-box', 'plastic'], trash: 0.7, nest: 0.03 })
}

const living: Recipe = (r, p) => {
  const set = livingSet(r, Boolean(p.hearth))
  if (p.coat) anyWall(r, 'coat-rack', r.rank('door'), { at: 'start' })
  if (ok(r, 0.5)) anyWall(r, 'bookcase', r.rank('solid', set.sofaSide ? [set.sofaSide] : []), { at: 'any' })
  plant(r)
  wallArt(r, 1)
  aftermath(r, { litter: ['papers', 'cloth', 'bottles', 'plastic'], nest: 0.18, barricade: 0.15 })
}

const dining: Recipe = (r, p) => {
  diningSet(r, 'dining-table', 'dining-chair', ok(r, 0.5) ? 6 : 4)
  anyWall(r, 'dresser', r.rank('solid'), { at: 'center' })
  if (ok(r, 0.5)) anyWall(r, 'bookcase', r.rank('solid'), { at: 'start' })
  if (p.coat) { anyWall(r, 'coat-rack', r.rank('door'), { at: 'start' }); if (ok(r, 0.6)) anyWall(r, 'shoe-shelf', r.rank('door'), { at: 'end', variant: 0 }) }
  plant(r); wallArt(r, 2)
  aftermath(r, { litter: ['papers', 'plastic', 'cans'], nest: 0.08 })
}

const study: Recipe = (r) => {
  const desk = deskSet(r, 'desk', 'office-chair', 'window')
  lineWalls(r, 'bookcase', r.rank('solid', desk ? [desk.side] : []), 2)
  if (ok(r, 0.6)) anyWall(r, 'filing-cabinet', r.rank('solid'), { at: 'end' })
  if (ok(r, 0.6)) { const chair = r.scatter('armchair', { tries: 5 }); lamp(r, chair ?? undefined) }
  wallArt(r, 1)
  aftermath(r, { litter: ['papers', 'papers', 'plastic'], nest: 0.06 })
}

const hall: Recipe = (r) => {
  if (ok(r, 0.6)) anyWall(r, 'shoe-shelf', r.rank('solid'), { at: 'start', variant: 0 })
  if (ok(r, 0.5)) anyWall(r, 'coat-rack', r.rank('door'), { at: 'end' })
  plant(r); wallArt(r, 1)
  aftermath(r, { litter: ['papers', 'plastic'], trash: 0.3, nest: 0.03 })
}

const studio: Recipe = (r) => {
  const bed = bedSet(r, r.chance(0.5) ? 'double-bed' : 'single-bed', 1)
  const used = bed ? [bed.side] : []
  const kitchenWall = r.rank('window', used)[0]
  if (kitchenWall) r.run(['fridge', 'kitchen-counter', 'oven', 'sink'], kitchenWall, { from: r.chance(0.5) ? 'start' : 'end', variant: 0 })
  diningSet(r, 'dining-table', 'dining-chair', 2)
  anyWall(r, 'wardrobe', r.rank('solid', [...used, ...(kitchenWall ? [kitchenWall] : [])]), { at: 'any', variant: 0 })
  if (ok(r, 0.6)) anyWall(r, 'tv-stand', r.rank('solid'), { at: 'any', variant: 0 })
  aftermath(r, { litter: ['cans', 'cloth', 'bottles'], nest: 0.1, trash: 0.6 })
}

const apartment: Recipe = (r) => {
  const bed = bedSet(r, 'double-bed', 2)
  const used = bed ? [bed.side] : []
  const kitchenWall = r.rank('window', used)[0]
  if (kitchenWall) { const run = r.run(['fridge', 'kitchen-counter', 'oven', 'kitchen-counter', 'sink'], kitchenWall, { from: 'start', variant: 1 }); for (const c of run) if (c.spec.family === 'kitchen-counter') r.dress(c, 'food', 0.5, 1) }
  const sofa = anyWall(r, 'sofa', r.rank('solid', [...used, ...(kitchenWall ? [kitchenWall] : [])]), { at: 'center', variant: 0 })
  if (sofa) {
    const [x, z] = mid(sofa.placed), [nx, nz] = inward(sofa.side)
    r.near('coffee-table', x + nx * 1.05, z + nz * 1.05, WALL_YAW[sofa.side], { radius: 0.3, variant: 0 })
  } else diningSet(r, 'dining-table', 'dining-chair', 2)
  anyWall(r, 'wardrobe', r.rank('solid'), { at: 'any', variant: 0 })
  anyWall(r, 'tv-stand', r.rank('solid'), { at: 'any', variant: 0 })
  wallArt(r, 1)
  aftermath(r, { litter: ['cans', 'cloth', 'papers', 'bottles'], nest: 0.12, trash: 0.7, barricade: 0.2 })
}

const lobby: Recipe = (r, p) => {
  if (p.mailboxes) lineWalls(r, 'mailboxes', r.rank('solid'), 2)
  else { const desk = anyWall(r, 'reception', r.rank('solid'), { at: 'center', jitter: Math.PI }); if (desk) r.dress(desk.placed, 'documents', 0.6, 2) }
  lineWalls(r, 'bench', r.rank('solid').slice(1), 2)
  plant(r); plant(r); wallArt(r, 1, 1.6)
  aftermath(r, { litter: ['papers', 'plastic'], trash: 0.6, barricade: 0.25 })
}

const motelRoom: Recipe = (r) => {
  const bed = bedSet(r, 'motel-bed', 2)
  const used = bed ? [bed.side] : []
  if (bed) r.wall('tv-stand', OPPOSITE[bed.side], { at: 'center', variant: 0 }) ?? anyWall(r, 'tv-stand', r.rank('solid', used))
  anyWall(r, 'toilet', r.rank('solid', used), { at: 'start' })
  anyWall(r, 'sink', r.rank('solid', used), { at: 'end', variant: 0 })
  if (ok(r, 0.7)) deskSet(r, 'desk', 'dining-chair', 'window', used)
  aftermath(r, { litter: ['bottles', 'cloth', 'papers'], trash: 0.6, nest: 0.06 })
}

const workshop: Recipe = (r, p) => {
  const main = anyWall(r, (p.main as string) ?? 'workbench', r.rank('window'), { at: 'center' })
  if (main) r.dress(main.placed, 'tools', 0.7, 2)
  const ranked = r.rank('solid', main ? [main.side] : [])
  lineWalls(r, 'tool-rack', ranked.slice(0, 1), 2)
  const bench = anyWall(r, 'workbench', ranked, { at: 'any' })
  if (bench) r.dress(bench.placed, 'tools', 0.7, 2)
  anyWall(r, 'shelf', r.rank('solid'), { at: 'start' })
  for (const family of ['barrel', 'crate', 'generator', 'step-ladder']) if (ok(r, 0.5)) anyWall(r, family, r.rank('solid'), { at: 'any', jitter: r.jitter(0.2) })
  aftermath(r, { litter: ['toolbox', 'plastic', 'battery'], trash: 0.4 })
}

const utility: Recipe = (r) => {
  anyWall(r, 'transformer', r.rank('solid'), { at: 'center' })
  lineWalls(r, 'electrical-panel', r.rank('solid'), 2)
  anyWall(r, 'generator', r.rank('solid'), { at: 'any' })
  const bench = anyWall(r, 'workbench', r.rank('window'), { at: 'any' })
  if (bench) r.dress(bench.placed, 'electronics', 0.7, 2)
  anyWall(r, 'tool-rack', r.rank('solid'), { at: 'any' })
  for (let i = 0; i < 2; i++) anyWall(r, 'barrel', r.rank('solid'), { at: 'end', jitter: r.jitter(0.3) })
  aftermath(r, { litter: ['battery', 'toolbox', 'plastic'], trash: 0.3 })
}

const construction: Recipe = (r) => {
  r.near('cement-mixer', r.cx + r.jitter(0.6), r.cz + r.jitter(0.6), r.rng() * 6, { radius: 1 })
  for (let i = 0; i < 2; i++) anyWall(r, 'pallet', r.rank('solid'), { at: 'any', jitter: r.jitter(0.2) })
  for (const family of ['planks', 'planks', 'cardboard-boxes', 'barrel', 'step-ladder', 'water-tank', 'crate']) if (ok(r, 0.55)) anyWall(r, family, r.rank('solid'), { at: 'any', jitter: r.jitter(0.4), variant: Math.floor(r.rng() * 3) })
  aftermath(r, { litter: ['plastic', 'toolbox'], trash: 0.6 })
}

function counterFront(r: Room, counter: string, back: string[], o: { prefer?: Side[]; inset?: number } = {}) {
  const sides = o.prefer ?? r.rank('solid')
  for (const side of sides) {
    const behind = r.run(back, side, { from: r.chance(0.5) ? 'start' : 'end', variant: 1 })
    const yaw = WALL_YAW[OPPOSITE[side]]
    const box = extent(counter, 1, yaw), depth = ns(side) ? box.z1 - box.z0 : box.x1 - box.x0
    const off = (o.inset ?? 1.4) + depth / 2
    const [a, b] = r.range(side)
    for (const t of [0.5, 0.3, 0.7, 0.2, 0.8]) {
      const along = a + (b - a) * t
      const center: [number, number] = side === 'n' ? [along, r.z0 + off] : side === 's' ? [along, r.z1 - off] : side === 'w' ? [r.x0 + off, along] : [r.x1 - off, along]
      const placed = r.put(counter, yaw, { center })
      if (placed) {
        const [x, z] = mid(placed), [nx, nz] = inward(side)
        if (ok(r, 0.6)) r.near('office-chair', x - nx * (depth / 2 + 0.4), z - nz * (depth / 2 + 0.4), WALL_YAW[side] + Math.PI + r.jitter(0.6), { radius: 0.25 })
        for (const shelf of behind) r.dress(shelf, 'salvage', 0.3, 1)
        return { placed, side }
      }
    }
  }
  return null
}

function aisles(r: Room, family: string, o: { aisle?: number; axis?: 'x' | 'z'; endMargin?: number; single?: boolean } = {}) {
  const axis = o.axis ?? (r.d >= r.w ? 'z' : 'x')
  const unit = extent(family, 1, 0), L = unit.x1 - unit.x0, D = unit.z1 - unit.z0
  const rowDepth = o.single ? D : 2 * D + 0.03, aisle = o.aisle ?? 1.15
  const across = axis === 'z' ? [r.x0, r.x1] : [r.z0, r.z1], lengthwise = axis === 'z' ? [r.z0, r.z1] : [r.x0, r.x1]
  const wallSides: [Side, Side] = axis === 'z' ? ['w', 'e'] : ['n', 's']
  const lo = across[0] + (r.solid(wallSides[0]) ? D + aisle : 0.55), hi = across[1] - (r.solid(wallSides[1]) ? D + aisle : 0.55)
  const rows = Math.max(0, Math.floor((hi - lo + aisle) / (rowDepth + aisle)))
  const used = rows * rowDepth + Math.max(0, rows - 1) * aisle, start = (lo + hi) / 2 - used / 2
  const endMargin = o.endMargin ?? 1.0
  const span = lengthwise[1] - lengthwise[0] - 2 * endMargin, count = Math.max(0, Math.floor(span / (L + 0.02)))
  const out: Placed[] = []
  for (let row = 0; row < rows; row++) {
    const c = start + row * (rowDepth + aisle) + rowDepth / 2
    const runLength = count * (L + 0.02) - 0.02
    for (let i = 0; i < count; i++) {
      const t = (lengthwise[0] + lengthwise[1]) / 2 - runLength / 2 + L / 2 + i * (L + 0.02)
      const faces: number[] = o.single ? [r.chance(0.5) ? 1 : -1] : [1, -1]
      for (const f of faces) {
        const offset = o.single ? 0 : f * (D / 2 + 0.015)
        const yaw = axis === 'z' ? (f > 0 ? Math.PI / 2 : -Math.PI / 2) : (f > 0 ? 0 : Math.PI)
        const center: [number, number] = axis === 'z' ? [c + offset, t] : [t, c + offset]
        const placed = r.chance(r.mess.chaos * 0.06) ? r.put(family, yaw + r.jitter(0.3), { center }, { pitch: Math.PI / 2 }) : r.put(family, yaw, { center })
        if (placed) out.push(placed)
      }
    }
  }
  return out
}

function grid(r: Room, family: string, face: Side, o: { gapAcross?: number; gapAlong?: number; margin?: number; front?: number; aisle?: number; max?: number; yawOffset?: number } = {}) {
  const yaw = facing(face) + (o.yawOffset ?? 0)
  const box = extent(family, 1, yaw), W = box.x1 - box.x0, D = box.z1 - box.z0
  const acrossX = ns(face)
  const span = acrossX ? [r.x0, r.x1] : [r.z0, r.z1], depthSpan = acrossX ? [r.z0, r.z1] : [r.x0, r.x1]
  const size = acrossX ? W : D, depth = acrossX ? D : W
  const margin = o.margin ?? 0.5, gapAcross = o.gapAcross ?? 0.6, gapAlong = o.gapAlong ?? 0.9, aisle = o.aisle ?? 0
  const width = span[1] - span[0] - 2 * margin - aisle
  const cols = Math.max(0, Math.floor((width + gapAcross) / (size + gapAcross)))
  const frontGap = o.front ?? 1.1, backGap = 0.7
  const rowsSpace = depthSpan[1] - depthSpan[0] - frontGap - backGap
  const rows = Math.max(0, Math.floor((rowsSpace + gapAlong) / (depth + gapAlong)))
  const out: Placed[] = []
  const usedW = cols * size + Math.max(0, cols - 1) * gapAcross + aisle
  const startA = (span[0] + span[1]) / 2 - usedW / 2
  const toFront = face === 'n' || face === 'w'
  for (let row = 0; row < rows && out.length < (o.max ?? 99); row++) for (let col = 0; col < cols && out.length < (o.max ?? 99); col++) {
    const a = startA + col * (size + gapAcross) + size / 2 + (aisle && col >= cols / 2 ? aisle : 0)
    const d = toFront ? depthSpan[0] + frontGap + depth / 2 + row * (depth + gapAlong) : depthSpan[1] - frontGap - depth / 2 - row * (depth + gapAlong)
    const center: [number, number] = acrossX ? [a, d] : [d, a]
    const placed = r.put(family, yaw + r.jitter(0.02 + r.mess.chaos * 0.12), { center })
    if (placed) out.push(placed)
  }
  return out
}

const stockroom: Recipe = (r, p) => {
  const kind = theme(p)
  const shelves = lineWalls(r, 'shelf', r.rank('solid'), 5)
  for (const s of shelves) r.dress(s, kind, 0.45, 2)
  for (let i = 0; i < 2; i++) {
    const pallet = r.scatter('pallet', { tries: 5, margin: 1, yaw: r.chance(0.5) ? 0 : Math.PI / 2 })
    if (pallet && ok(r, 0.8)) stackOn(r, pallet, 'cardboard-boxes')
  }
  if (p.safe) anyWall(r, 'safe', r.rank('solid'), { at: 'end' })
  if (ok(r, 0.5)) { const desk = deskSet(r, 'desk', 'office-chair', 'solid'); if (desk) anyWall(r, 'filing-cabinet', [desk.side], { at: 'any' }) }
  for (const family of ['step-ladder', 'cardboard-boxes', 'crate']) if (ok(r, 0.6)) anyWall(r, family, r.rank('solid'), { at: 'any', jitter: r.jitter(0.3), variant: Math.floor(r.rng() * 3) })
  if (p.relief) { for (let i = 0; i < 2; i++) anyWall(r, 'water-tank', r.rank('solid'), { at: 'any' }); anyWall(r, 'medical-crate', r.rank('solid'), { at: 'any' }) }
  aftermath(r, { litter: ['plastic', 'papers', 'cans'], trash: 0.8 })
}

const sales: Recipe = (r, p) => {
  const shop = shopFor(p.shop as string)
  const solid = r.rank('solid')
  switch (shop.floor) {
    case 'aisles': {
      for (const s of lineWalls(r, shop.wall ?? shop.shelf, solid, 4)) r.dress(s, shop.theme, 0.35, 2)
      for (const s of aisles(r, shop.shelf)) r.dress(s, shop.theme, 0.25, 1)
      if (p.shop === 'grocery' && ok(r, 0.6)) r.scatter('shopping-cart', { tries: 5, yaw: r.rng() * 6 })
      break
    }
    case 'racks': {
      for (const s of lineWalls(r, shop.wall ?? 'shelf', solid, 3)) r.dress(s, shop.theme, 0.4, 2)
      grid(r, shop.shelf, solid[0] ?? 'n', { gapAcross: 0.9, gapAlong: 1.0, front: 1.0, max: 4 })
      if (shop.display && ok(r, 0.7)) r.near(shop.display, r.cx, r.cz, r.rng() < 0.5 ? 0 : Math.PI / 2, { radius: 1.2 })
      break
    }
    case 'tables': {
      for (const s of lineWalls(r, shop.shelf, solid, 3)) r.dress(s, shop.theme, 0.4, 2)
      for (const t of grid(r, shop.display ?? 'display-table', solid[0] ?? 'n', { gapAcross: 1.1, gapAlong: 1.1, front: 1.1, max: 3 })) r.dress(t, shop.theme, 0.5, 2)
      break
    }
    case 'showroom': {
      const vignette = r.pick(['living', 'bed', 'dining'])
      if (vignette === 'living') livingSet(r, false)
      else if (vignette === 'bed') bedSet(r, 'double-bed', 2)
      else diningSet(r, 'dining-table', 'dining-chair', 4)
      anyWall(r, shop.shelf, solid, { at: 'any' })
      break
    }
    case 'garden': {
      lineWalls(r, shop.wall ?? 'shelf', solid.slice(0, 1), 2)
      for (const t of grid(r, 'planter', solid[0] ?? 'n', { gapAcross: 0.9, gapAlong: 0.95, front: 1.0, max: 4 })) r.dress(t, 'agriculture', 0.4, 1)
      for (let i = 0; i < 3; i++) r.scatter('potted-plant', { tries: 4, wallward: true, variant: Math.floor(r.rng() * 3) })
      break
    }
    case 'laundry': {
      lineWalls(r, 'washing-machine', solid, 6)
      const table = r.near('dining-table', r.cx, r.cz, r.w > r.d ? 0 : Math.PI / 2, { radius: 0.8 })
      r.dress(table, 'textiles', 0.8, 3)
      if (ok(r, 0.7)) r.scatter('clothes-rack', { tries: 5 })
      break
    }
    case 'salon': {
      const front = solid[0]
      if (front) for (const station of lineWalls(r, shop.shelf, [front], 3)) r.dress(station, 'medical', 0.3, 1)
      lineWalls(r, 'sink', solid.slice(1, 2), 2)
      if (shop.seats) lineWalls(r, shop.seats, solid.slice(2), 1)
      break
    }
    case 'arcade': {
      lineWalls(r, 'arcade', solid, 7)
      grid(r, shop.display ?? 'pinball', solid[0] ?? 'n', { gapAcross: 0.5, gapAlong: 1.0, front: 1.0, max: 4 })
      break
    }
    case 'lan': {
      for (const desk of lineWalls(r, 'computer-station', solid, 6)) {
        const side = SIDES.find((s) => r.solid(s) && Math.abs((ns(s) ? (s === 'n' ? desk.box.z0 : desk.box.z1) : (s === 'w' ? desk.box.x0 : desk.box.x1)) - (s === 'n' ? r.z0 : s === 's' ? r.z1 : s === 'w' ? r.x0 : r.x1)) < 0.06)
        if (!side) continue
        const [x, z] = mid(desk), [nx, nz] = inward(side)
        r.near('office-chair', x + nx * 0.75, z + nz * 0.75, WALL_YAW[side] + Math.PI + r.jitter(0.5 + r.mess.chaos), { radius: 0.25, pitch: r.chance(r.mess.chaos * 0.3) ? -Math.PI / 2 : undefined })
      }
      break
    }
    case 'ceremony': {
      const front = solid[0] ?? 'n'
      grid(r, 'pew', front, { gapAcross: 0.5, gapAlong: 0.55, front: 1.6, aisle: 1.2, max: 6 })
      plant(r); plant(r)
      break
    }
    default: {
      for (const s of lineWalls(r, shop.shelf, solid, 4)) r.dress(s, shop.theme, 0.45, 2)
      if (shop.display && ok(r, 0.8)) { const d = r.near(shop.display, r.cx + r.jitter(0.4), r.cz + r.jitter(0.4), r.chance(0.5) ? 0 : Math.PI / 2, { radius: 1 }); r.dress(d, shop.theme, 0.5, 2) }
      if (shop.wall && ok(r, 0.7)) lineWalls(r, shop.wall, solid, 2)
    }
  }
  if (ok(r, 0.4)) plant(r)
  aftermath(r, { litter: ['plastic', 'papers', 'cans', 'cloth'], trash: 0.5, barricade: 0.18 })
}

const front: Recipe = (r, p) => {
  const id = p.shop as string, shop = shopFor(id)
  const counter = (p.counter as string) ?? (id === 'library' ? 'reception' : id === 'post-office' ? 'counter' : shop.counter)
  const back = id === 'library' ? ['bookcase', 'bookcase'] : id === 'post-office' ? ['sorting-rack', 'shelf'] : [shop.shelf === 'freezer' ? 'shelf' : shop.shelf]
  const desk = counterFront(r, counter, back, { prefer: r.rank('solid').filter((s) => !r.doors(s).length).concat(r.rank('solid')) })
  if (desk) r.dress(desk.placed, shop.theme, 0.7, 2)
  if (id === 'grocery' || id === 'fuel-station' || id === 'shop-house') {
    for (let i = 0; i < 2; i++) r.scatter('shopping-cart', { tries: 4, yaw: r.rng() * 6 })
    if (ok(r, 0.7)) anyWall(r, 'vending-machine', r.rank('solid'), { at: 'end' })
    if (shop.wall) lineWalls(r, shop.wall, r.rank('solid'), 2)
  }
  if (shop.floor === 'aisles' && id !== 'library') for (const s of aisles(r, shop.shelf, { endMargin: 1.3 })) r.dress(s, shop.theme, 0.25, 1)
  if (shop.seats && ok(r, 0.7)) lineWalls(r, shop.seats, r.rank('solid').slice(1), 1)
  if (id === 'library') for (const t of grid(r, 'reading-table', r.rank('solid')[0] ?? 'n', { gapAcross: 1, gapAlong: 1.3, front: 1.2, max: 2 })) r.chairsAround(t, 'dining-chair', 2, { ends: false })
  if (shop.floor === 'bays' || shop.floor === 'warehouse') { anyWall(r, 'vending-machine', r.rank('solid'), { at: 'any' }); lineWalls(r, 'shelf', r.rank('solid'), 2); anyWall(r, 'bench', r.rank('solid'), { at: 'any' }) }
  plant(r)
  aftermath(r, { litter: ['papers', 'plastic', 'cans'], trash: 0.5, barricade: 0.2 })
}

const signature: Recipe = (r, p) => {
  const id = p.shop as string, shop = shopFor(id), main = p.main as string
  const count = ['fitting-booth', 'barber-chair', 'salon-station', 'laundry-drum', 'computer-station', 'pinball', 'animal-cages', 'medicine-fridge', 'weapon-display', 'fishing-rack', 'shoe-display'].includes(main) ? 3 : 1
  const special = ['reading-table', 'camp-tent', 'piano'].includes(main)
  const placed = special ? [] : lineWalls(r, main, r.rank(main === 'computer-station' ? 'window' : 'solid'), count)
  if (!placed.length && !special) r.near(main, r.cx, r.cz, r.rng() < 0.5 ? 0 : Math.PI, { radius: 1.2 })
  for (const item of placed) r.dress(item, shop.theme, 0.5, 2)
  for (const family of shop.signature ?? []) if (ok(r, 0.8)) { const s = anyWall(r, family, r.rank('solid'), { at: 'any' }); if (s) r.dress(s.placed, shop.theme, 0.5, 1) }
  if (main === 'fitting-booth' || main === 'shoe-display') lineWalls(r, 'bench', r.rank('solid'), 1)
  if (main === 'barber-chair' || main === 'salon-station') { lineWalls(r, 'sink', r.rank('solid'), 1); lineWalls(r, 'bench', r.rank('solid'), 1) }
  if (main === 'reading-table') { const t = r.near('reading-table', r.cx, r.cz, 0, { radius: 1 }); if (t) r.chairsAround(t, 'dining-chair', 3, { ends: false }); lineWalls(r, 'bookcase', r.rank('solid'), 2) }
  if (main === 'camp-tent') { r.near('camp-tent', r.cx, r.cz, r.rng() * 6, { radius: 1 }); r.scatter('sleeping-bag', { tries: 4 }) }
  if (main === 'piano') { const pi = anyWall(r, 'piano', r.rank('solid'), { at: 'center' }); if (pi) { const [x, z] = mid(pi.placed), [nx, nz] = inward(pi.side); r.near('stool', x + nx * 0.75, z + nz * 0.75, 0, { radius: 0.2 }) } }
  aftermath(r, { litter: ['plastic', 'papers', 'cloth'], trash: 0.4 })
}

const proKitchen: Recipe = (r, p) => {
  const main = p.main as string | undefined
  const placedMain = main ? anyWall(r, main, r.rank('solid'), { at: 'center' }) : null
  const ranked = r.rank('window', placedMain ? [placedMain.side] : [])
  const sinkWall = ranked[0]
  if (sinkWall) { const run = r.run(['sink', 'workbench', 'oven', 'lab-bench'], sinkWall, { from: 'start', variant: 1 }); for (const c of run) r.dress(c, 'food', 0.5, 2) }
  lineWalls(r, 'shelf', r.rank('solid'), 2).forEach((s) => r.dress(s, 'food', 0.5, 2))
  anyWall(r, 'fridge', r.rank('solid'), { at: 'end' })
  if (ok(r, 0.8)) anyWall(r, 'freezer', r.rank('solid'), { at: 'any' })
  if (ok(r, 0.7)) { const island = r.near('workbench', r.cx, r.cz, r.w > r.d ? 0 : Math.PI / 2, { radius: 0.6 }); r.dress(island, 'food', 0.6, 2) }
  aftermath(r, { litter: ['cans', 'food-box', 'bottles', 'plastic'], trash: 1, nest: 0.02 })
}

const office: Recipe = (r, p) => {
  const ranked = r.rank('window')
  if (p.manager) {
    const desk = deskSet(r, 'desk', 'office-chair', 'window')
    if (desk) { r.dress(desk.placed, 'documents', 0.7, 2); const [x, z] = mid(desk.placed), [nx, nz] = inward(desk.side); for (const s of [-0.45, 0.45]) r.near('dining-chair', x + nx * 1.5 + (ns(desk.side) ? s : 0), z + nz * 1.5 + (ns(desk.side) ? 0 : s), WALL_YAW[desk.side] + r.jitter(0.3), { radius: 0.3 }) }
    lineWalls(r, 'bookcase', r.rank('solid', desk ? [desk.side] : []), 2)
    anyWall(r, 'safe', r.rank('solid'), { at: 'end' })
  } else {
    for (let i = 0; i < (p.open ? 3 : 2); i++) { const d = deskSet(r, p.open ? 'computer-station' : 'desk', 'office-chair', i === 0 ? 'window' : 'solid'); if (d) r.dress(d.placed, 'documents', 0.6, 2) }
    if (p.open && ok(r, 0.8)) {
      const yaw = r.w > r.d ? 0 : Math.PI / 2
      for (const s of [-1, 1]) {
        const dx = yaw ? s * 0.4 : 0, dz = yaw ? 0 : s * 0.4
        const desk = r.near('desk', r.cx + dx, r.cz + dz, yaw + (s > 0 ? Math.PI : 0), { radius: 0.3 })
        if (desk) { r.dress(desk, 'documents', 0.6, 2); r.near('office-chair', r.cx + dx * 2.6, r.cz + dz * 2.6, yaw + (s > 0 ? 0 : Math.PI) + r.jitter(0.6), { radius: 0.3, pitch: r.chance(r.mess.chaos * 0.3) ? -Math.PI / 2 : undefined }) }
      }
    }
  }
  lineWalls(r, 'filing-cabinet', r.rank('solid'), 3)
  if (p.police) { anyWall(r, 'gun-cabinet', r.rank('solid'), { at: 'end' }); anyWall(r, 'noticeboard', r.rank('solid'), { at: 'center' }) }
  if (ok(r, 0.5)) anyWall(r, 'shelf', ranked, { at: 'any' })
  plant(r); wallArt(r, 1)
  aftermath(r, { litter: ['papers', 'papers', 'papers', 'plastic'], trash: 0.5, barricade: 0.15 })
}

const warehouse: Recipe = (r, p) => {
  for (const s of lineWalls(r, 'shelf', r.rank('solid'), 5)) r.dress(s, 'salvage', 0.4, 2)
  if (p.forklift || p.main === 'forklift') r.near('forklift', r.cx + r.jitter(0.5), r.cz + r.jitter(0.5), r.rng() * 6, { radius: 1.2 })
  if (p.main && p.main !== 'forklift') r.near(p.main as string, r.cx, r.cz, r.rng() * 6, { radius: 1.2 })
  for (let i = 0; i < 3; i++) {
    const pallet = r.scatter('pallet', { tries: 6, margin: 0.9, yaw: r.chance(0.5) ? 0 : Math.PI / 2 })
    if (pallet && ok(r, 0.85)) stackOn(r, pallet, r.chance(0.7) ? 'cardboard-boxes' : 'crate')
  }
  for (const family of ['barrel', 'barrel', 'step-ladder', 'planks']) if (ok(r, 0.5)) anyWall(r, family, r.rank('solid'), { at: 'any', jitter: r.jitter(0.3) })
  aftermath(r, { litter: ['plastic', 'papers'], trash: 0.8 })
}

const diningRoom: Recipe = (r, p) => {
  const id = p.shop as string, shop = shopFor(id)
  const solid = r.rank('solid')
  if (p.register) { const c = counterFront(r, id === 'bar' ? 'bar-tap' : 'counter', ['shelf'], { inset: 1.0 }); if (c) { r.dress(c.placed, 'food', 0.6, 2); if (id === 'bar' || id === 'diner') { const [x, z] = mid(c.placed), [nx, nz] = inward(c.side); for (const s of [-0.6, 0, 0.6]) r.near('bar-stool', x + nx * 0.7 + (ns(c.side) ? s : 0), z + nz * 0.7 + (ns(c.side) ? 0 : s), r.rng() * 6, { radius: 0.15 }) } } }
  if (p.booths || shop.display === 'diner-booth') lineWalls(r, 'diner-booth', solid, 3)
  else if (shop.seats === 'booth') lineWalls(r, 'booth', solid, 2)
  const table = id === 'tea-house' ? 'coffee-table' : 'dining-table'
  const chair = id === 'tea-house' || id === 'cafe' ? 'armchair' : 'dining-chair'
  for (const t of grid(r, table, solid[0] ?? 'n', { gapAcross: 1.4, gapAlong: 1.5, front: 1.2, margin: 0.9, max: 2 })) {
    if (t.tipped) continue
    if (id === 'tea-house' || id === 'cafe') r.chairsAround(t, chair, 2, { ends: false, tuck: -0.25 })
    else r.chairsAround(t, chair, 4)
    r.dress(t, 'food', 0.5, 2)
  }
  plant(r)
  wallArt(r, 1)
  aftermath(r, { litter: ['bottles', 'cans', 'plastic', 'papers'], trash: 0.5, barricade: 0.22, nest: 0.06 })
}

const serviceBar: Recipe = (r, p) => {
  const main = (p.main as string) ?? 'counter'
  const c = counterFront(r, main, ['shelf', 'fridge'], { inset: 1.0 })
  if (c) {
    r.dress(c.placed, 'food', 0.7, 2)
    if (main === 'bar-tap' || main === 'coffee-machine') { const [x, z] = mid(c.placed), [nx, nz] = inward(c.side); for (const s of [-0.55, 0.55]) r.near('bar-stool', x + nx * 0.75 + (ns(c.side) ? s : 0), z + nz * 0.75 + (ns(c.side) ? 0 : s), 0, { radius: 0.15, pitch: r.chance(r.mess.chaos * 0.4) ? -Math.PI / 2 : undefined }) }
  }
  if (main === 'ice-cream-case') lineWalls(r, 'freezer', r.rank('solid'), 2)
  for (let i = 0; i < 2; i++) anyWall(r, i ? 'crate' : 'barrel', r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['bottles', 'cans', 'plastic'], trash: 0.8 })
}

const bay: Recipe = (r, p) => {
  const main = (p.main as string) ?? 'workbench'
  const yaw = r.w >= r.d ? Math.PI / 2 : 0
  r.near(main, r.cx + r.jitter(0.2), r.cz + r.jitter(0.2), yaw + r.jitter(0.05), { radius: 0.9 })
  const benches = lineWalls(r, 'workbench', r.rank('window').slice(0, 1), 2)
  for (const b of benches) r.dress(b, 'tools', 0.7, 2)
  lineWalls(r, 'tool-rack', r.rank('solid').slice(0, 2), 2)
  for (const family of ['barrel', 'barrel', 'generator', 'step-ladder', 'shelf']) if (ok(r, 0.55)) anyWall(r, family, r.rank('solid'), { at: 'any', jitter: family === 'barrel' ? r.jitter(0.5) : 0 })
  if (p.shop === 'print-shop') { anyWall(r, 'paper-cutter', r.rank('solid'), { at: 'any' }); for (let i = 0; i < 2; i++) anyWall(r, 'cardboard-boxes', r.rank('solid'), { at: 'any' }) }
  aftermath(r, { litter: ['toolbox', 'plastic', 'battery'], trash: 0.5 })
}

const reception: Recipe = (r, p) => {
  const desk = counterFront(r, (p.desk as string) ?? 'reception', p.office ? ['filing-cabinet', 'filing-cabinet'] : ['shelf'], { inset: 1.0 })
  if (desk) r.dress(desk.placed, 'documents', 0.7, 2)
  const seat = (p.seat as string) ?? 'bench'
  lineWalls(r, seat, r.rank('solid', desk ? [desk.side] : []), 3)
  if (ok(r, 0.5)) anyWall(r, 'noticeboard', r.rank('solid'), { at: 'any' })
  if (p.toys) { r.scatter('play-table', { tries: 4, variant: 0 }); anyWall(r, 'toy-display', r.rank('solid'), { at: 'any' }) }
  if (ok(r, 0.4)) anyWall(r, 'vending-machine', r.rank('solid'), { at: 'end' })
  if (ok(r, 0.4)) r.scatter('wheelchair', { tries: 3 })
  plant(r); plant(r); wallArt(r, 1, 1.6)
  aftermath(r, { litter: ['papers', 'papers', 'plastic'], trash: 0.5, barricade: 0.25 })
}

const exam: Recipe = (r, p) => {
  const main = (p.main as string) ?? 'exam-table'
  const center = ['ct-scanner', 'dental-chair', 'optical-chair', 'hospital-bed'].includes(main)
  const placed = center ? r.near(main, r.cx + r.jitter(0.2), r.cz + r.jitter(0.2), r.w >= r.d ? Math.PI / 2 : 0, { radius: 0.8 }) : anyWall(r, main, r.rank('solid'), { at: 'center' })?.placed ?? null
  if (!placed) r.near(main, r.cx, r.cz, 0, { radius: 1 })
  anyWall(r, 'medicine-cabinet', r.rank('solid'), { at: 'start' })
  const sink = anyWall(r, 'sink', r.rank('solid'), { at: 'end', variant: 0 })
  if (sink) r.dress(sink.placed, 'medical', 0.6, 1)
  const desk = deskSet(r, 'desk', 'office-chair', 'window')
  if (desk) r.dress(desk.placed, 'documents', 0.6, 2)
  for (const family of p.vet ? ['animal-cages', 'kennel'] : ['iv-stand', 'patient-monitor', 'privacy-screen', 'medical-crate']) if (ok(r, 0.7)) anyWall(r, family, r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['bandages', 'medicine', 'papers'], trash: 0.4 })
}

const ward: Recipe = (r, p) => {
  const bed = (p.bed as string) ?? 'hospital-bed'
  const sides = r.rank('solid').filter((s) => r.length(s) > 2.4)
  for (const side of sides.slice(0, 2)) for (let i = 0; i < 3; i++) {
    const placed = r.wall(bed, side, { at: 'start', jitter: r.jitter(0.03 + r.mess.chaos * 0.15) })
    if (!placed) break
    const [a, b] = along(side, placed)
    if (ok(r, 0.75)) r.wall(r.chance(0.5) ? 'iv-stand' : 'patient-monitor', side, { within: [b + 0.03, b + 0.8], at: 'start' })
    if (ok(r, 0.35)) r.wall('privacy-screen', side, { within: [a - 2, a - 0.03], at: 'end', jitter: Math.PI / 2 })
  }
  if (ok(r, 0.6)) anyWall(r, 'medicine-cabinet', r.rank('solid'), { at: 'any' })
  if (ok(r, 0.5)) r.scatter('wheelchair', { tries: 3 })
  aftermath(r, { litter: ['bandages', 'medicine', 'cloth'], trash: 0.5, nest: 0.05 })
}

const corridor: Recipe = (r, p) => {
  if (p.lockers) lineWalls(r, 'locker', r.rank('solid'), 6)
  else lineWalls(r, 'bench', r.rank('solid'), 2)
  if (p.medical && ok(r, 0.6)) r.scatter('wheelchair', { tries: 3, wallward: true })
  if (ok(r, 0.5)) anyWall(r, 'noticeboard', r.rank('solid'), { at: 'any' })
  if (ok(r, 0.4)) anyWall(r, 'vending-machine', r.rank('solid'), { at: 'end' })
  plant(r)
  aftermath(r, { litter: ['papers', 'plastic'], trash: 0.4, barricade: 0.15 })
}

const kennels: Recipe = (r) => {
  lineWalls(r, 'animal-cages', r.rank('solid'), 3)
  lineWalls(r, 'kennel', r.rank('solid'), 2)
  anyWall(r, 'sink', r.rank('solid'), { at: 'any' })
  for (let i = 0; i < 2; i++) anyWall(r, 'cardboard-boxes', r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['plastic', 'food-box'], trash: 0.6 })
}

const classroom: Recipe = (r) => {
  const boardWall = r.rank('solid').find((s) => !r.doors(s).length) ?? r.rank('solid')[0] ?? 'n'
  r.wall('teacher-desk', boardWall, { at: 'center' }) ?? r.wall('blackboard', boardWall, { at: 'center' })
  for (const desk of grid(r, 'school-desk', boardWall, { gapAcross: 0.45, gapAlong: 0.75, front: 2.0, margin: 0.55, max: 9 })) {
    const [x, z] = mid(desk), [nx, nz] = inward(boardWall)
    const tipped = r.chance(0.05 + r.mess.chaos * 0.3)
    r.near('dining-chair', x + nx * (0.45 + (tipped ? 0.3 : 0)), z + nz * (0.45 + (tipped ? 0.3 : 0)), facing(boardWall) + r.jitter(0.1 + r.mess.chaos * 0.6), { radius: 0.12, variant: 0, pitch: tipped ? -Math.PI / 2 : undefined })
    r.dress(desk, 'documents', 0.25, 1)
  }
  anyWall(r, 'bookcase', r.rank('solid', [boardWall]), { at: 'any' })
  if (ok(r, 0.6)) lineWalls(r, 'locker', [OPPOSITE[boardWall]], 3)
  wallArt(r, 2, 1.5)
  aftermath(r, { litter: ['papers', 'papers', 'plastic'], trash: 0.3, barricade: 0.2 })
}

const napRoom: Recipe = (r) => {
  const face = r.rank('solid')[0] ?? 'n'
  grid(r, 'single-bed', face, { gapAcross: 0.6, gapAlong: 0.6, front: 0.5, margin: 0.4, max: 4, yawOffset: Math.PI })
  anyWall(r, 'toy-display', r.rank('solid'), { at: 'any' })
  if (ok(r, 0.6)) anyWall(r, 'crate', r.rank('solid'), { at: 'any', variant: 0 })
  aftermath(r, { litter: ['cloth', 'plastic'], trash: 0.3 })
}

const playroom: Recipe = (r) => {
  for (const t of grid(r, 'play-table', r.rank('solid')[0] ?? 'n', { gapAcross: 1.2, gapAlong: 1.2, front: 1.0, max: 3 })) r.chairsAround(t, 'stool', 2, { ends: false })
  lineWalls(r, 'shelf', r.rank('solid'), 2)
  anyWall(r, 'toy-display', r.rank('solid'), { at: 'any' })
  r.scatter('rug', { variant: 1, connect: false })
  wallArt(r, 2, 1.2)
  aftermath(r, { litter: ['plastic', 'papers', 'cloth'], trash: 0.3 })
}

const archive: Recipe = (r) => {
  lineWalls(r, 'filing-cabinet', r.rank('solid'), 8)
  aisles(r, 'shelf', { aisle: 1.1 })
  for (let i = 0; i < 2; i++) anyWall(r, 'cardboard-boxes', r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['papers', 'papers', 'papers'], trash: 0.4 })
}

const reading: Recipe = (r) => {
  for (const t of grid(r, 'reading-table', r.rank('solid')[0] ?? 'n', { gapAcross: 1.2, gapAlong: 1.4, front: 1.2, max: 2 })) { r.chairsAround(t, 'dining-chair', 3, { ends: false }); r.dress(t, 'documents', 0.6, 2) }
  lineWalls(r, 'bookcase', r.rank('solid'), 4)
  if (ok(r, 0.6)) { const chair = r.scatter('armchair', { tries: 4, wallward: true }); lamp(r, chair ?? undefined) }
  aftermath(r, { litter: ['papers', 'papers'], trash: 0.3 })
}

const stacks: Recipe = (r) => {
  lineWalls(r, 'bookcase', r.rank('solid'), 6)
  for (const s of aisles(r, 'bookcase', { aisle: 1.1, endMargin: 0.9 })) r.dress(s, 'documents', 0.15, 1)
  aftermath(r, { litter: ['papers', 'papers'], trash: 0.2 })
}

const cells: Recipe = (r) => {
  lineWalls(r, 'holding-cell', r.rank('solid'), 2)
  const desk = deskSet(r, 'desk', 'office-chair', 'window')
  if (desk) r.dress(desk.placed, 'documents', 0.6, 1)
  anyWall(r, 'locker', r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['papers', 'cloth'], trash: 0.4 })
}

const armory: Recipe = (r) => {
  lineWalls(r, 'gun-cabinet', r.rank('solid'), 2)
  lineWalls(r, 'gun-rack', r.rank('solid'), 2)
  for (let i = 0; i < 3; i++) anyWall(r, 'ammo-crate', r.rank('solid'), { at: 'any', jitter: r.jitter(0.3) })
  const bench = anyWall(r, 'workbench', r.rank('solid'), { at: 'any' })
  if (bench) r.dress(bench.placed, 'weapons', 0.7, 2)
  if (ok(r, 0.5)) anyWall(r, 'weapon-display', r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['ammo', 'plastic'], trash: 0.3 })
}

const barracks: Recipe = (r, p) => {
  const bed = (p.bed as string) ?? 'bunk-bed'
  for (const side of r.rank('solid').slice(0, 2)) for (let i = 0; i < 3; i++) if (!r.wall(bed, side, { at: 'start', jitter: r.jitter(0.03 + r.mess.chaos * 0.12), variant: Math.floor(r.rng() * 3) })) break
  lineWalls(r, 'locker', r.rank('solid'), 3)
  if (ok(r, 0.6)) diningSet(r, 'dining-table', 'dining-chair', 2)
  for (let i = 0; i < 2; i++) r.scatter(r.chance(0.5) ? 'ammo-crate' : 'crate', { tries: 3, wallward: true })
  aftermath(r, { litter: ['cloth', 'cans', 'bottles'], trash: 0.6, nest: 0 })
}

const gearRoom: Recipe = (r) => {
  lineWalls(r, 'fire-gear', r.rank('solid'), 3)
  lineWalls(r, 'locker', r.rank('solid'), 4)
  r.near('bench', r.cx, r.cz, r.w > r.d ? 0 : Math.PI / 2, { radius: 0.6 })
  aftermath(r, { litter: ['cloth', 'toolbox'], trash: 0.3 })
}

const apparatus: Recipe = (r) => {
  lineWalls(r, 'fire-gear', r.rank('solid'), 2)
  lineWalls(r, 'tool-rack', r.rank('solid'), 1)
  for (const family of ['barrel', 'generator', 'step-ladder', 'locker']) if (ok(r, 0.5)) anyWall(r, family, r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['toolbox', 'plastic'], trash: 0.4 })
}

const sorting: Recipe = (r) => {
  lineWalls(r, 'sorting-rack', r.rank('solid'), 4)
  const table = r.near('workbench', r.cx, r.cz, r.w > r.d ? 0 : Math.PI / 2, { radius: 0.6 })
  r.dress(table, 'documents', 0.8, 3)
  for (let i = 0; i < 2; i++) r.scatter(i ? 'shopping-cart' : 'cardboard-boxes', { tries: 4 })
  lineWalls(r, 'crate', r.rank('solid'), 2)
  aftermath(r, { litter: ['papers', 'papers', 'plastic'], trash: 0.5 })
}

const waiting: Recipe = (r, p) => {
  const seat = (p.seat as string) ?? 'bench'
  if (p.mailboxes) lineWalls(r, 'mailboxes', r.rank('solid'), 2)
  const face = r.rank('solid')[0] ?? 'n'
  grid(r, seat, face, { gapAcross: 0.5, gapAlong: 0.9, front: 1.3, margin: 0.6, max: 4, yawOffset: 0 })
  if (p.vending || ok(r, 0.4)) anyWall(r, 'vending-machine', r.rank('solid'), { at: 'end' })
  if (ok(r, 0.5)) anyWall(r, 'noticeboard', r.rank('solid'), { at: 'any' })
  plant(r)
  aftermath(r, { litter: ['papers', 'plastic', 'bottles'], trash: 0.6, nest: 0.06, barricade: 0.2 })
}

const vault: Recipe = (r) => {
  anyWall(r, 'vault-door', r.rank('solid'), { at: 'center' })
  lineWalls(r, 'safe', r.rank('solid'), 3)
  lineWalls(r, 'shelf', r.rank('solid'), 2).forEach((s) => r.dress(s, 'documents', 0.5, 2))
  for (let i = 0; i < 2; i++) anyWall(r, 'cardboard-boxes', r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['papers', 'papers'], trash: 0.2 })
}

const tellers: Recipe = (r) => {
  const side = r.rank('solid')[0]
  if (side) for (let i = 0; i < 3; i++) {
    const c = counterFront(r, 'security-counter', i === 0 ? ['filing-cabinet'] : [], { prefer: [side], inset: 1.0 })
    if (!c) break
    r.dress(c.placed, 'documents', 0.6, 1)
  }
  lineWalls(r, 'bench', r.rank('solid').slice(1), 1)
  aftermath(r, { litter: ['papers', 'papers'], trash: 0.3 })
}

const altar: Recipe = (r) => {
  const back = r.rank('solid').find((s) => !r.doors(s).length) ?? 'n'
  r.wall('altar', back, { at: 'center', inset: 0.8 })
  lineWalls(r, 'bookcase', r.rank('solid', [back]), 2)
  for (let i = 0; i < 2; i++) plant(r)
  if (ok(r, 0.6)) r.scatter('pew', { tries: 3, yaw: facing(back) })
  aftermath(r, { litter: ['papers'], trash: 0.2 })
}

const narthex: Recipe = (r) => {
  lineWalls(r, 'noticeboard', r.rank('solid'), 1)
  lineWalls(r, 'bench', r.rank('solid'), 2)
  if (ok(r, 0.5)) anyWall(r, 'coat-rack', r.rank('solid'), { at: 'any' })
  plant(r); plant(r)
  aftermath(r, { litter: ['papers', 'plastic'], trash: 0.3, barricade: 0.3, nest: 0.1 })
}

const nave: Recipe = (r) => {
  grid(r, 'pew', 'n', { gapAcross: 0.4, gapAlong: 0.45, front: 0.6, margin: 0.4, aisle: r.w > 4.6 ? 1.2 : 0 })
  aftermath(r, { litter: ['papers'], trash: 0.2, nest: 0.12 })
}

const stageRoom: Recipe = (r) => {
  const back = r.rank('solid').find((s) => !r.doors(s).length) ?? 'n'
  r.wall('stage', back, { at: 'center' })
  if (ok(r, 0.5)) anyWall(r, 'piano', r.rank('solid', [back]), { at: 'any' })
  for (const family of ['step-ladder', 'cardboard-boxes']) if (ok(r, 0.5)) anyWall(r, family, r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['papers', 'plastic'], trash: 0.3 })
}

const assembly: Recipe = (r) => {
  grid(r, 'dining-chair', 'n', { gapAcross: 0.25, gapAlong: 0.55, front: 1.0, margin: 0.5, max: 16 })
  aftermath(r, { litter: ['papers', 'plastic'], trash: 0.3, nest: 0.1 })
}

const canteen: Recipe = (r) => {
  counterFront(r, 'counter', ['fridge', 'shelf'])
  for (const t of grid(r, 'dining-table', r.rank('solid')[0] ?? 'n', { gapAcross: 1.3, gapAlong: 1.4, front: 1.2, max: 2 })) r.chairsAround(t, 'dining-chair', 4)
  aftermath(r, { litter: ['cans', 'bottles', 'plastic'], trash: 0.7, barricade: 0.2 })
}

const council: Recipe = (r) => {
  const back = r.rank('solid').find((s) => !r.doors(s).length) ?? 'n'
  r.wall('council-desk', back, { at: 'center' })
  grid(r, 'dining-chair', back, { gapAcross: 0.3, gapAlong: 0.6, front: 1.8, margin: 0.6, max: 10 })
  lineWalls(r, 'bookcase', r.rank('solid', [back]), 1)
  aftermath(r, { litter: ['papers', 'papers'], trash: 0.3 })
}

const ticketing: Recipe = (r) => {
  const gate = counterFront(r, 'ticket-gate', ['shelf'])
  if (gate) r.dress(gate.placed, 'documents', 0.6, 1)
  lineWalls(r, 'locker', r.rank('solid'), 3)
  lineWalls(r, 'bench', r.rank('solid'), 1)
  aftermath(r, { litter: ['papers', 'plastic'], trash: 0.5 })
}

const signalRoom: Recipe = (r) => {
  anyWall(r, 'signal-lever', r.rank('window'), { at: 'center' })
  const desk = deskSet(r, 'radio-desk', 'office-chair', 'solid')
  if (desk) r.dress(desk.placed, 'electronics', 0.5, 1)
  anyWall(r, 'filing-cabinet', r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['papers'], trash: 0.3 })
}

const reliefKitchen: Recipe = (r) => {
  anyWall(r, 'field-kitchen', r.rank('solid'), { at: 'center' })
  lineWalls(r, 'water-tank', r.rank('solid'), 2)
  lineWalls(r, 'grocery-shelf', r.rank('solid'), 2).forEach((s) => r.dress(s, 'food', 0.5, 2))
  const t = r.near('dining-table', r.cx, r.cz, r.w > r.d ? 0 : Math.PI / 2, { radius: 0.8 })
  r.dress(t, 'food', 0.7, 3)
  for (let i = 0; i < 2; i++) r.scatter('crate', { tries: 3, wallward: true })
  aftermath(r, { litter: ['cans', 'food-box', 'bottles'], trash: 0.8 })
}

const triage: Recipe = (r) => {
  const desk = counterFront(r, 'reception', ['medicine-cabinet'], { inset: 1.0 })
  if (desk) r.dress(desk.placed, 'medical', 0.6, 2)
  for (const side of r.rank('solid').slice(0, 1)) for (let i = 0; i < 2; i++) r.wall(r.chance(0.5) ? 'hospital-bed' : 'mattress', side, { at: 'start' })
  for (let i = 0; i < 3; i++) r.scatter('medical-crate', { tries: 3, wallward: true })
  if (ok(r, 0.6)) r.scatter('privacy-screen', { tries: 3 })
  aftermath(r, { litter: ['bandages', 'medicine', 'cloth'], trash: 0.6 })
}

const plantRoom: Recipe = (r, p) => {
  const main = (p.main as string) ?? 'transformer'
  r.near(main, r.cx, r.cz, r.w > r.d ? Math.PI / 2 : 0, { radius: 1 })
  lineWalls(r, 'electrical-panel', r.rank('solid'), 3)
  for (const family of ['barrel', 'generator', 'tool-rack']) if (ok(r, 0.5)) anyWall(r, family, r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['battery', 'toolbox'], trash: 0.3 })
}

const maintenance: Recipe = (r) => {
  const bench = anyWall(r, 'workbench', r.rank('window'), { at: 'center' })
  if (bench) r.dress(bench.placed, 'tools', 0.7, 2)
  lineWalls(r, 'tool-rack', r.rank('solid'), 2)
  lineWalls(r, 'shelf', r.rank('solid'), 2)
  anyWall(r, 'electrical-panel', r.rank('solid'), { at: 'any' })
  const desk = deskSet(r, 'desk', 'office-chair', 'solid')
  if (desk) r.dress(desk.placed, 'documents', 0.6, 1)
  for (let i = 0; i < 2; i++) anyWall(r, 'barrel', r.rank('solid'), { at: 'any', jitter: r.jitter(0.4) })
  aftermath(r, { litter: ['toolbox', 'battery', 'papers'], trash: 0.5 })
}

const meeting: Recipe = (r) => {
  const t = diningSet(r, 'dining-table', 'office-chair', 6)
  r.dress(t, 'documents', 0.6, 2)
  anyWall(r, 'blackboard', r.rank('solid'), { at: 'center' })
  plant(r); wallArt(r, 1)
  aftermath(r, { litter: ['papers', 'papers'], trash: 0.3 })
}

const barnBay: Recipe = (r) => {
  r.near('tractor', r.cx + r.jitter(0.4), r.cz + r.jitter(0.4), r.rng() < 0.5 ? 0 : Math.PI, { radius: 1.2 })
  lineWalls(r, 'tool-rack', r.rank('solid'), 2)
  const bench = anyWall(r, 'workbench', r.rank('solid'), { at: 'any' })
  if (bench) r.dress(bench.placed, 'tools', 0.6, 2)
  for (const family of ['barrel', 'barrel', 'crate', 'hay-bale']) if (ok(r, 0.6)) anyWall(r, family, r.rank('solid'), { at: 'any', jitter: r.jitter(0.5) })
  aftermath(r, { litter: ['toolbox', 'seeds'], trash: 0.3 })
}

const hayloft: Recipe = (r) => {
  for (const side of r.rank('solid').slice(0, 2)) for (let i = 0; i < 3; i++) if (!r.wall('hay-bale', side, { at: 'start', jitter: r.jitter(0.6), variant: Math.floor(r.rng() * 3) })) break
  if (ok(r, 0.7)) anyWall(r, 'feed-hopper', r.rank('solid'), { at: 'any' })
  if (ok(r, 0.6)) anyWall(r, 'trough', r.rank('solid'), { at: 'any' })
  r.scatter('pallet', { tries: 3 })
  aftermath(r, { litter: ['seeds'], trash: 0.2 })
}

const tackRoom: Recipe = (r) => {
  lineWalls(r, 'tool-rack', r.rank('solid'), 2)
  lineWalls(r, 'trough', r.rank('solid'), 1)
  for (const family of ['hay-bale', 'barrel', 'crate', 'bench']) if (ok(r, 0.6)) anyWall(r, family, r.rank('solid'), { at: 'any', jitter: r.jitter(0.3) })
  aftermath(r, { litter: ['seeds', 'toolbox'], trash: 0.2 })
}

const stalls: Recipe = (r) => {
  lineWalls(r, 'horse-stall', r.rank('solid'), 2)
  if (ok(r, 0.7)) anyWall(r, 'trough', r.rank('solid'), { at: 'any' })
  if (ok(r, 0.7)) r.scatter('hay-bale', { tries: 3, wallward: true, variant: 0 })
  aftermath(r, { litter: ['seeds'], trash: 0.1 })
}

const potting: Recipe = (r) => {
  const bench = anyWall(r, 'potting-bench', r.rank('solid'), { at: 'center' })
  if (bench) r.dress(bench.placed, 'agriculture', 0.6, 2)
  anyWall(r, 'water-tank', r.rank('solid'), { at: 'end' })
  lineWalls(r, 'planter', r.rank('solid'), 2)
  for (let i = 0; i < 2; i++) r.scatter('crate', { tries: 3, wallward: true })
  aftermath(r, { litter: ['seeds', 'plastic'], trash: 0.2 })
}

const beds: Recipe = (r) => {
  aisles(r, 'seedling-bench', { aisle: 0.95, single: true, endMargin: 0.6 })
  for (let i = 0; i < 2; i++) r.scatter('planter', { tries: 3, wallward: true })
  aftermath(r, { litter: ['seeds'], trash: 0.1 })
}

const sawmill: Recipe = (r) => {
  r.near('saw-table', r.cx, r.cz, r.w > r.d ? 0 : Math.PI / 2, { radius: 0.8 })
  lineWalls(r, 'log-stack', r.rank('solid'), 2)
  const bench = anyWall(r, 'workbench', r.rank('solid'), { at: 'any' })
  if (bench) r.dress(bench.placed, 'tools', 0.6, 1)
  for (const family of ['generator', 'planks', 'barrel']) if (ok(r, 0.6)) anyWall(r, family, r.rank('solid'), { at: 'any', jitter: r.jitter(0.3) })
  aftermath(r, { litter: ['toolbox'], trash: 0.2 })
}

const lumber: Recipe = (r, p) => {
  lineWalls(r, p.logs ? 'log-stack' : 'pallet', r.rank('solid'), 3)
  for (let i = 0; i < 3; i++) r.scatter('planks', { tries: 3, variant: Math.floor(r.rng() * 4) })
  aftermath(r, { litter: ['toolbox'], trash: 0.2 })
}

const grain: Recipe = (r) => {
  lineWalls(r, 'feed-hopper', r.rank('solid'), 2)
  for (let i = 0; i < 3; i++) stackOn(r, r.scatter('pallet', { tries: 4, margin: 0.9 }), 'cardboard-boxes')
  aftermath(r, { litter: ['seeds'], trash: 0.3 })
}

const cabinKitchen: Recipe = (r) => {
  anyWall(r, 'hearth', r.rank('solid'), { at: 'center' })
  diningSet(r, 'dining-table', 'dining-chair', 2)
  const shelf = anyWall(r, 'shelf', r.rank('solid'), { at: 'any', variant: 0 })
  if (shelf) r.dress(shelf.placed, 'food', 0.6, 2)
  for (const family of ['barrel', 'crate']) anyWall(r, family, r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['cans', 'bottles'], trash: 0.4, nest: 0.05 })
}

const trophy: Recipe = (r) => {
  anyWall(r, 'weapon-display', r.rank('solid'), { at: 'center' })
  anyWall(r, 'gun-cabinet', r.rank('solid'), { at: 'any' })
  const chair = r.scatter('armchair', { tries: 4 })
  if (chair) r.scatter('rug', { variant: 0, connect: false })
  const bench = anyWall(r, 'workbench', r.rank('window'), { at: 'any' })
  if (bench) r.dress(bench.placed, 'weapons', 0.6, 2)
  aftermath(r, { litter: ['ammo', 'bottles'], trash: 0.3 })
}

const mudroom: Recipe = (r, p) => {
  anyWall(r, 'coat-rack', r.rank('door'), { at: 'start' })
  anyWall(r, 'shoe-shelf', r.rank('solid'), { at: 'any', variant: 0 })
  if (p.office) { const desk = deskSet(r, 'desk', 'office-chair', 'window'); if (desk) r.dress(desk.placed, 'documents', 0.6, 1); anyWall(r, 'gun-cabinet', r.rank('solid'), { at: 'any' }) }
  else { anyWall(r, 'bench', r.rank('solid'), { at: 'any' }); anyWall(r, 'tool-rack', r.rank('solid'), { at: 'any' }) }
  for (let i = 0; i < 2; i++) anyWall(r, 'crate', r.rank('solid'), { at: 'any', jitter: r.jitter(0.3) })
  aftermath(r, { litter: ['cloth', 'toolbox'], trash: 0.3 })
}

const tackle: Recipe = (r) => {
  lineWalls(r, 'fishing-rack', r.rank('solid'), 2)
  const bench = anyWall(r, 'workbench', r.rank('window'), { at: 'any' })
  if (bench) r.dress(bench.placed, 'tools', 0.6, 2)
  for (const family of ['crate', 'barrel', 'tool-rack']) if (ok(r, 0.7)) anyWall(r, family, r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['toolbox', 'cans'], trash: 0.3 })
}

const radioRoom: Recipe = (r) => {
  anyWall(r, 'radio-console', r.rank('window'), { at: 'center' })
  const desk = deskSet(r, 'desk', 'office-chair', 'solid')
  if (desk) r.dress(desk.placed, 'documents', 0.6, 2)
  anyWall(r, 'noticeboard', r.rank('solid'), { at: 'any' })
  anyWall(r, 'filing-cabinet', r.rank('solid'), { at: 'any' })
  if (ok(r, 0.6)) anyWall(r, 'generator', r.rank('solid'), { at: 'any' })
  aftermath(r, { litter: ['papers', 'battery'], trash: 0.3 })
}

const lab: Recipe = (r, p) => {
  if (!p.light) anyWall(r, 'lab-equipment', r.rank('window'), { at: 'center' })
  for (const b of lineWalls(r, 'lab-bench', r.rank('solid'), 3)) r.dress(b, 'medical', 0.6, 2)
  anyWall(r, 'medicine-fridge', r.rank('solid'), { at: 'any' })
  if (ok(r, 0.6)) anyWall(r, 'server-rack', r.rank('solid'), { at: 'end' })
  deskSet(r, 'desk', 'office-chair', 'solid')
  aftermath(r, { litter: ['papers', 'medicine', 'battery'], trash: 0.4 })
}

const remains: Recipe = (r) => {
  for (const family of ['crate', 'barrel', 'mattress', 'cardboard-boxes', 'trash-bags', 'dining-chair']) {
    if (!r.chance(0.3)) continue
    const tip = family === 'barrel' ? { roll: Math.PI / 2 } : family === 'dining-chair' ? { pitch: -Math.PI / 2 } : {}
    r.scatter(family, { tries: 3, ...tip, burned: r.chance(0.4) })
  }
}

export const RECIPES: Record<string, Recipe> = {
  bedroom, bathroom, kitchen, living, dining, study, hall, studio, apartment, lobby, 'motel-room': motelRoom, workshop, utility, construction,
  stockroom, sales, front, signature, 'pro-kitchen': proKitchen, office, warehouse, 'dining-room': diningRoom, 'service-bar': serviceBar, bay, reception,
  exam, ward, corridor, kennels, classroom, 'nap-room': napRoom, playroom, archive, reading, stacks, cells, armory, barracks, 'gear-room': gearRoom, apparatus,
  sorting, waiting, vault, tellers, altar, narthex, nave, 'stage-room': stageRoom, assembly, canteen, council, ticketing, 'signal-room': signalRoom,
  'relief-kitchen': reliefKitchen, triage, plant: plantRoom, maintenance, meeting, 'barn-bay': barnBay, hayloft, 'tack-room': tackRoom, stalls, potting, beds,
  sawmill, lumber, grain, 'cabin-kitchen': cabinKitchen, trophy, mudroom, tackle, 'radio-room': radioRoom, lab, remains,
}
