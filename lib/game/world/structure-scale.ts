import { ASSET_BY_ID } from '../blockout/catalog'
import { partBounds, type BlockPart, type Damage, type Instance, type StructureModel, type Vec3 } from '../blockout/types'
import { STRUCTURE_SCALE } from './settings'

type Extent = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
type Carrier = { instance: Instance; extent: Extent }

const WALL_REACH = 0.3

const architectural = (asset: string) => ASSET_BY_ID.get(asset)?.category === 'Arquitetura'
const times = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s]
const plus = (v: Vec3, d: Vec3): Vec3 => [v[0] + d[0], v[1] + d[1], v[2] + d[2]]
const pointExtent = ([x, y, z]: Vec3): Extent => ({ x0: x, x1: x, y0: y, y1: y, z0: z, z1: z })
const union = (a: Extent, b: Extent): Extent => ({
  x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1),
})

function scaleDamage(d: Damage, s: number): Damage {
  const pair = ([u, v]: [number, number]): [number, number] => [u * s, v * s]
  return {
    ...d,
    crown: d.crown && { ...d.crown, low: d.crown.low * s, high: d.crown.high * s, peak: d.crown.peak && d.crown.peak * s, peaks: d.crown.peaks?.map(pair) },
    holes: d.holes?.map((h) => ({ ...h, x: h.x * s, y: h.y * s, rx: h.rx * s, ry: h.ry * s, sill: h.sill === undefined ? undefined : h.sill * s })),
    cracks: d.cracks?.map((c) => ({ ...c, points: c.points.map(pair), width: c.width * s, depth: c.depth * s, shift: c.shift && pair(c.shift) })),
    spalls: d.spalls?.map((p) => ({ ...p, x: p.x * s, y: p.y * s, rx: p.rx * s, ry: p.ry * s, depth: p.depth * s })),
  }
}

function moveDamage(d: Damage, [dx, dy, dz]: Vec3): Damage {
  if (!d.crown) return d
  return { ...d, crown: { ...d.crown, low: d.crown.low + dy, high: d.crown.high + dy, peaks: d.crown.peaks?.map(([x, z]) => [x + dx, z + dz] as [number, number]) } }
}

function scalePart(part: BlockPart, s: number): BlockPart {
  return { ...part, position: times(part.position, s), size: times(part.size, s), uvOrigin: part.uvOrigin && times(part.uvOrigin, s), damage: part.damage && scaleDamage(part.damage, s) }
}

function movePart(part: BlockPart, d: Vec3): BlockPart {
  return { ...part, position: plus(part.position, d), uvOrigin: part.uvOrigin && plus(part.uvOrigin, d), damage: part.damage && moveDamage(part.damage, d) }
}

export function scaleStructure(model: StructureModel, s = STRUCTURE_SCALE): StructureModel {
  if (s === 1) return model
  const owners = new Map<string, Instance>()
  for (const instance of model.instances) if (instance.prefix) owners.set(instance.prefix, instance)

  const ownerOf = (id: string) => {
    for (let i = id.indexOf('/'); i >= 0; i = id.indexOf('/', i + 1)) {
      const owner = owners.get(id.slice(0, i))
      if (owner) return owner
    }
    return undefined
  }
  const partOwners = model.parts.map((part) => {
    const owner = ownerOf(part.id)
    return owner && !architectural(owner.asset) ? owner : undefined
  })

  const held = new Map<Instance, Extent>()
  const decks: Extent[] = [], walls: Extent[] = []
  model.parts.forEach((part, i) => {
    const b = partBounds(part)
    const extent: Extent = { x0: b.min[0], x1: b.max[0], y0: b.min[1], y1: b.max[1], z0: b.min[2], z1: b.max[2] }
    const owner = partOwners[i]
    if (owner) {
      const current = held.get(owner)
      held.set(owner, current ? union(current, extent) : extent)
      return
    }
    if (part.pitch || part.roll || Math.abs(Math.sin(2 * part.yaw)) > 1e-3) return
    const [w, h, d] = b.size
    if ((part.role === 'floor' || part.role === 'foundation' || part.role === 'roof') && h < 0.8 && w > 0.4 && d > 0.4) decks.push(extent)
    else if (part.role === 'wall' && h > 1 && Math.min(w, d) < 0.6) walls.push(extent)
  })

  const deckUnder = (x: number, y: number, z: number) => {
    let top = 0
    for (const e of decks) if (e.y1 > top && e.y1 <= y + 0.05 && x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1) top = e.y1
    return top
  }

  const anchor = (e: Extent, axis: 0 | 2) => {
    const lo = axis === 0 ? e.x0 : e.z0, hi = axis === 0 ? e.x1 : e.z1
    const o0 = axis === 0 ? e.z0 : e.x0, o1 = axis === 0 ? e.z1 : e.x1
    let best = WALL_REACH, at = (lo + hi) / 2
    for (const w of walls) {
      const wl = axis === 0 ? w.x0 : w.z0, wh = axis === 0 ? w.x1 : w.z1
      const ol = axis === 0 ? w.z0 : w.x0, oh = axis === 0 ? w.z1 : w.x1

      if (wh - wl > oh - ol || oh <= o0 + 0.05 || ol >= o1 - 0.05 || w.y1 < e.y0 + 0.3 || w.y0 > e.y0 + 0.5) continue
      const behind = lo - wh, ahead = wl - hi
      if (behind > -0.05 && behind < best) { best = behind; at = wh }
      if (ahead > -0.05 && ahead < best) { best = ahead; at = wl }
    }
    return at
  }

  const moved = new Map<Instance, Vec3>()
  const carriers: Carrier[] = []
  const offsetOf = (position: Vec3, extent: Extent): Vec3 => {
    const [x, y, z] = position
    const deck = deckUnder(x, y, z)
    if (y - deck > 0.1) {

      let carrier: Carrier | undefined
      for (const c of carriers) {
        const e = c.extent
        if (x < e.x0 || x > e.x1 || z < e.z0 || z > e.z1 || y < e.y0 + 0.1 || y > e.y1 + 0.05) continue
        if (!carrier || e.y0 > carrier.extent.y0) carrier = c
      }
      if (carrier) return moved.get(carrier.instance)!
    }
    return [(s - 1) * anchor(extent, 0), (s - 1) * deck, (s - 1) * anchor(extent, 2)]
  }

  const props = model.instances.filter((instance) => !architectural(instance.asset)).sort((a, b) => a.position[1] - b.position[1])
  for (const prop of props) {
    const extent = held.get(prop) ?? pointExtent(prop.position)
    moved.set(prop, offsetOf(prop.position, extent))
    if (extent.y1 - extent.y0 > 0.15) carriers.push({ instance: prop, extent })
  }

  return {
    ...model,
    parts: model.parts.map((part, i) => {
      const owner = partOwners[i]
      return owner ? movePart(part, moved.get(owner)!) : scalePart(part, s)
    }),
    instances: model.instances.map((instance) => {
      const offset = moved.get(instance)
      return offset ? { ...instance, position: plus(instance.position, offset) } : { ...instance, position: times(instance.position, s), scale: s }
    }),
    decor: model.decor?.map((item) => ({ ...item, position: plus(item.position, offsetOf(item.position, pointExtent(item.position))) })),
    entrance: times(model.entrance, s),
  }
}
