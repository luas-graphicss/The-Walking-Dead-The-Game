import { ASSET_BY_ID } from './catalog'
import { buildSpecialty } from './specialty'
import { buildInterior } from './interior-assets'
import { finishAsset } from './finishing'
import { assignSurfaces } from './surfaces'
import { hash, modelBounds, random, transformPoint, type AssetSpec, type BlockModel, type BlockPart, type LootKind, type MaterialKey, type PartRole, type Vec3 } from './types'

export class ModelBuilder {
  model: BlockModel
  constructor(id: string, label: string) { this.model = { id, label, parts: [], sockets: [], snaps: [] } }
  box(size: Vec3, position: Vec3, material: MaterialKey, role: PartRole = 'fixture', yaw = 0, level = 0, name = 'part') {
    const part: BlockPart = { id: `${this.model.id}/${name}-${this.model.parts.length}`, size, position, material, role, yaw, level }
    this.model.parts.push(part)
    return part
  }
  grounded(w: number, h: number, d: number, x: number, bottom: number, z: number, material: MaterialKey, role: PartRole = 'fixture', yaw = 0) {
    return this.box([w, h, d], [x, bottom + h / 2, z], material, role, yaw)
  }
  solid(primitive: NonNullable<BlockPart['primitive']>, size: Vec3, position: Vec3, material: MaterialKey, role: PartRole = 'fixture', name: string = primitive, level = 0) {
    const part = this.box(size, position, material, role, 0, level, name)
    part.primitive = primitive
    return part
  }
  prism(points: [number, number][], depth: number, z: number, material: MaterialKey, role: PartRole = 'roof', name = 'profile', level = 0) {
    const x0 = Math.min(...points.map((p) => p[0])), x1 = Math.max(...points.map((p) => p[0]))
    const y0 = Math.min(...points.map((p) => p[1])), y1 = Math.max(...points.map((p) => p[1]))
    const part = this.solid('prism', [x1 - x0, y1 - y0, depth], [(x0 + x1) / 2, (y0 + y1) / 2, z], material, role, name, level)
    part.profile = points.map(([x, y]) => [(x - x0) / (x1 - x0) - 0.5, (y - y0) / (y1 - y0) - 0.5])
    return part
  }
  ring(width: number, depth: number, height: number, bottom: number, thickness: number, material: MaterialKey, x = 0, z = 0, count = 32) {
    const parts: BlockPart[] = []
    for (let i = 0; i < count; i++) {
      const a = i * Math.PI * 2 / count, c = (i + 1) * Math.PI * 2 / count
      const points: [number, number][] = [[Math.cos(a) * width / 2, Math.sin(a) * depth / 2], [Math.cos(c) * width / 2, Math.sin(c) * depth / 2], [Math.cos(c) * (width / 2 - thickness), Math.sin(c) * (depth / 2 - thickness)], [Math.cos(a) * (width / 2 - thickness), Math.sin(a) * (depth / 2 - thickness)]]
      const part = this.prism(points, height, 0, material, 'fixture', 'radial-shell')
      part.position = [part.position[0] + x, bottom + height / 2, part.position[1] + z]
      part.pitch = Math.PI / 2
      part.bevel = 0
      parts.push(part)
    }
    return parts
  }
  socket(part: BlockPart, kind: LootKind, concealed = false, label = 'Recipiente', x = 0, z = 0, origin: { container?: string; prop?: string } = {}) {
    const container = origin.container ?? ASSET_BY_ID.get(this.model.id)?.family
    this.model.sockets.push({ id: `${this.model.id}/socket-${this.model.sockets.length}`, support: part.id, position: transformPoint([x, part.size[1] / 2, z], part.position, part.yaw), kind, concealed, label, ...(container ? { container } : {}), ...(origin.prop ? { prop: origin.prop } : {}) })
  }
  append(model: BlockModel, position: Vec3, yaw = 0, level = 0, prefix = `${this.model.id}/instance-${this.model.parts.length}`) {
    for (const part of model.parts) this.model.parts.push({ ...part, id: `${prefix}/${part.id}`, support: part.support ? `${prefix}/${part.support}` : undefined, position: transformPoint(part.position, position, yaw), yaw: part.yaw + yaw, level })
    for (const socket of model.sockets) this.model.sockets.push({ ...socket, id: `${prefix}/${socket.id}`, support: `${prefix}/${socket.support}`, position: transformPoint(socket.position, position, yaw) })
    return prefix
  }
}

const cache = new Map<string, BlockModel>()
export function buildAsset(spec: AssetSpec | string): BlockModel {
  const definition = typeof spec === 'string' ? ASSET_BY_ID.get(spec) : spec
  if (!definition) throw new Error(`Asset não encontrado: ${spec}`)
  const cached = cache.get(definition.id)
  if (cached) return cached
  const { id, label, recipe, size: [w, h, d], material: m, variant: v, loot, concealed } = definition
  const b = new ModelBuilder(id, label)
  const t = 0.05
  const box = (width: number, height: number, depth: number, x = 0, bottom = 0, z = 0, mat = m, role: PartRole = 'fixture', yaw = 0) => b.grounded(width, height, depth, x, bottom, z, mat, role, yaw)
  const stock = (part: BlockPart, hidden = Boolean(concealed), text = label.split(' · ')[0]) => {
    if (loot && part.size[0] >= 0.24 && part.size[2] >= 0.18) b.socket(part, loot, hidden, text)
  }
  const legs = (height: number, thickness = 0.07) => {
    for (const x of [-1, 1]) for (const z of [-1, 1]) box(thickness, height, thickness, x * (w - thickness) / 2, 0, z * (d - thickness) / 2)
  }
  const openBox = (height: number, bottom = 0, mat = m) => {
    const floor = box(w, t, d, 0, bottom, 0, mat)
    box(t, height - t, d, -(w - t) / 2, bottom + t, 0, mat)
    box(t, height - t, d, (w - t) / 2, bottom + t, 0, mat)
    for (const z of [-1, 1]) box(w - 2 * t, height - t, t, 0, bottom + t, z * (d - t) / 2, mat)
    return floor
  }

  switch (recipe) {
    case 'specialty': buildSpecialty(b, definition); break
    case 'interior': buildInterior(b, definition); break
    case 'shelf':
    case 'cabinet': {
      box(t, h, d, -(w - t) / 2)
      box(t, h, d, (w - t) / 2)
      box(w - 2 * t, h, t, 0, 0, -(d - t) / 2)
      const levels = recipe === 'cabinet' ? 3 : 3 + v
      for (let i = 0; i < levels; i++) {
        const y = i * (h - t) / (levels - 1)
        const depth = d - (recipe === 'cabinet' ? 2 : 1) * t
        const shelf = box(w - 2 * t, t, depth, 0, y, recipe === 'cabinet' ? 0 : t / 2)
        if (i < levels - 1) stock(shelf, recipe === 'cabinet' || Boolean(concealed))
      }
      if (recipe === 'cabinet') {
        const step = (h - t) / 2
        for (let i = 0; i < 2; i++) {
          b.box([w - 2 * t, step - t - 0.012, t], [0, i * step + t + (step - t - 0.012) / 2, (d - t) / 2], m, 'fixture', 0, 0, 'drawer')
          box(Math.min(0.2, w * 0.2), 0.035, 0.035, 0, i * step + step * 0.62, d / 2 + 0.0175, 'steel')
        }
      }
      break
    }
    case 'counter': {
      box(t, h - 0.08, d, -(w - t) / 2)
      box(t, h - 0.08, d, (w - t) / 2)
      box(w - 2 * t, h - 0.08, t, 0, 0, -(d - t) / 2)
      stock(box(w, 0.08, d, 0, h - 0.08))
      stock(box(w - 2 * t, t, d - t, 0, 0.15, t / 2))
      break
    }
    case 'table': {
      if (definition.family === 'stool') {
        for (const x of [-1, 1]) for (const z of [-1, 1]) box(0.045, h - 0.07, 0.045, x * w * 0.24, 0, z * d * 0.24)
        b.solid('cylinder', [w, 0.07, d], [0, h - 0.035, 0], m, 'fixture', 'round-seat')
      } else {
        legs(h - 0.08)
        for (const z of [-1, 1]) box(w - 0.14, 0.13, 0.035, 0, h - 0.21, z * (d - 0.07) / 2)
        for (const x of [-1, 1]) box(0.035, 0.13, d - 0.14, x * (w - 0.07) / 2, h - 0.21)
        stock(box(w, 0.08, d, 0, h - 0.08, 0, definition.family === 'workbench' ? 'wood' : m))
      }
      break
    }
    case 'chair': {
      legs(0.42)
      box(w, 0.1, d, 0, 0.42, 0, definition.family === 'office-chair' ? 'leather' : m)
      for (const x of [-1, 1]) box(0.055, h - 0.52, 0.06, x * (w - 0.055) / 2, 0.52, -(d - 0.06) / 2)
      for (let i = 0; i < 3; i++) box(w - 0.11, 0.065, 0.045, 0, 0.57 + i * (h - 0.64) / 3, -(d - 0.06) / 2, definition.family === 'office-chair' ? 'leather' : m)
      break
    }
    case 'bench': {
      for (const x of [-1, 1]) box(0.1, 0.42, d * 0.8, x * (w - 0.1) / 2)
      for (let i = 0; i < 4; i++) {
        const seat = box(w, 0.1, (d - 0.024) / 4, 0, 0.42, -d / 2 + (d - 0.024) / 8 + i * ((d - 0.024) / 4 + 0.008))
        if (i === 2 && loot) b.socket(seat, loot)
      }
      for (const x of [-1, 1]) box(0.06, h - 0.52, 0.06, x * (w - 0.06) / 2, 0.52, -(d - 0.06) / 2)
      for (let i = 0; i < 3; i++) box(w - 0.12, 0.085, 0.055, 0, 0.56 + i * (h - 0.645) / 2, -(d - 0.06) / 2)
      break
    }
    case 'sofa': {
      box(w, 0.15, d)
      for (const x of [-1, 1]) box(0.12, h - 0.15, d, x * (w - 0.12) / 2, 0.15)
      box(w - 0.24, h - 0.15, 0.12, 0, 0.15, -(d - 0.12) / 2)
      const count = w > 1.2 ? 2 + (v === 2 ? 1 : 0) : 1
      for (let i = 0; i < count; i++) {
        const width = (w - 0.24) / count
        const seat = box(width - 0.012, 0.3, d - 0.12, -w / 2 + 0.12 + width * (i + 0.5), 0.15, 0.06)
        if (i === 0) stock(seat)
      }
      break
    }
    case 'bed': {
      legs(0.22)
      box(w, 0.08, d, 0, 0.22)
      const mattress = box(w - 0.08, 0.2, d - 0.12, 0, 0.3, 0, 'fabric')
      box(w, h - 0.3, 0.06, 0, 0.3, -(d - 0.06) / 2)
      box(w * 0.65, 0.08, 0.32, 0, 0.5, -d / 2 + 0.28, 'fabric')
      if (loot) b.socket(mattress, loot, false, 'Roupa de cama', 0, d * 0.23)
      break
    }
    case 'bunk': {
      legs(h, 0.06)
      for (const y of [0.28, 1.28]) {
        box(w - 0.12, 0.07, d, 0, y)
        stock(box(w - 0.16, 0.15, d - 0.12, 0, y + 0.07, 0, 'fabric'))
      }
      for (const x of [-0.23, 0.23]) box(0.06, 1.5, 0.06, x, 0, d / 2 + 0.03)
      for (let i = 1; i < 6; i++) box(0.4, 0.045, 0.06, 0, i * 0.24, d / 2 + 0.03)
      break
    }
    case 'appliance': {
      box(w, h * 0.12, d)
      box(w, h * 0.76, d - 0.05, 0, h * 0.12, -0.025)
      box(w * 0.76, h * 0.58, 0.05, 0, h * 0.2, (d - 0.05) / 2, 'charcoal')
      stock(box(w, h * 0.12, d, 0, h * 0.88))
      break
    }
    case 'sink': {
      for (const x of [-1, 1]) box(t, h - 0.18, d, x * (w - t) / 2)
      stock(openBox(0.18, h - 0.18, 'tile'))
      box(0.04, 0.2, 0.04, 0, h, -(d - 0.04) / 2, 'steel')
      box(0.04, 0.04, 0.16, 0, h + 0.2, -d / 2 + 0.08, 'steel')
      break
    }
    case 'toilet': {
      b.solid('cylinder', [w * 0.5, h * 0.4, d * 0.5], [0, h * 0.2, d * 0.2], 'tile', 'fixture', 'pedestal')
      b.solid('cylinder', [w, 0.045, d * 0.7], [0, h * 0.4 + 0.0225, d * 0.15], 'tile', 'fixture', 'bowl-base')
      b.ring(w, d * 0.7, h * 0.25 - 0.045, h * 0.4 + 0.045, 0.045, 'tile', 0, d * 0.15)
      b.ring(w + 0.016, d * 0.7 + 0.016, 0.022, h * 0.65, 0.055, 'tile', 0, d * 0.15)
      box(w * 0.86, h, d * 0.25, 0, 0, -d * 0.375)
      box(w * 0.3, h * 0.08, d * 0.05, 0, h * 0.45, -d * 0.225)
      box(w * 0.9, 0.035, d * 0.27, 0, h, -d * 0.375)
      b.solid('cylinder', [0.04, 0.012, 0.04], [w * 0.22, h + 0.041, -d * 0.375], 'steel', 'fixture', 'flush-button')
      break
    }
    case 'tub':
    case 'crate': stock(openBox(h)); break
    case 'rack': {
      for (const x of [-1, 1]) {
        box(0.08, 0.08, d, x * (w - 0.08) / 2)
        box(0.08, h - 0.08, 0.08, x * (w - 0.08) / 2, 0.08)
      }
      box(w - 0.16, 0.06, 0.08, 0, h - 0.06)
      stock(box(w - 0.16, 0.05, d, 0, 0.16))
      break
    }
    case 'machine': {
      box(w, h * 0.45, d)
      box(w * 0.84, h * 0.45, d * 0.8, 0, h * 0.45)
      box(w * 0.65, h * 0.2, 0.04, 0, h * 0.61, d * 0.4 + 0.02, 'charcoal')
      stock(box(w * 0.72, h * 0.1, d * 0.64, 0, h * 0.9, 0, 'steel'))
      break
    }
    case 'pallet': {
      for (const x of [-1, 0, 1]) box(w * 0.13, 0.1, d, x * w * 0.4)
      for (let i = 0; i < 5; i++) {
        const top = box(w, h - 0.1, d / 6, 0, 0.1, -d / 2 + d / 12 + i * (d - d / 6) / 4)
        if (i === 2) stock(top)
      }
      break
    }
    case 'tank': {
      const body = box(w, h - 0.08, d)
      box(w * 0.3, 0.08, d * 0.3, w * 0.25, h - 0.08)
      if (loot) b.socket(body, loot, false, label.split(' · ')[0], -w * 0.25, 0)
      break
    }
    case 'fence': {
      for (const x of [-1, 1]) box(0.12, h, d, x * (w - 0.12) / 2)
      for (const y of [0.22, h * 0.5, h - 0.12]) box(w - 0.24, 0.08, d * 0.6, 0, y)
      break
    }
    case 'board': {
      for (const x of [-1, 1]) {
        box(0.12, 0.06, d, x * (w - 0.12) / 2)
        box(0.08, h - 0.06, 0.08, x * (w - 0.12) / 2, 0.06, 0, 'steel')
      }
      box(w - 0.2, h * 0.48, 0.05, 0, h * 0.5)
      break
    }
    case 'wall': box(w, h, d, 0, 0, 0, m, 'wall'); break
    case 'doorway': {
      const opening = Math.min(1.4, w - 0.5), side = (w - opening) / 2
      for (const x of [-1, 1]) box(side, h, d, x * (opening + side) / 2, 0, 0, m, 'wall')
      box(opening, h - 2.3, d, 0, 2.3, 0, m, 'wall')
      break
    }
    case 'window': {
      box(w, 0.85, d, 0, 0, 0, m, 'wall')
      for (const x of [-1, 1]) box(0.45, h - 0.85, d, x * (w - 0.45) / 2, 0.85, 0, m, 'wall')
      box(w - 0.9, h - 2.2, d, 0, 2.2, 0, m, 'wall')
      break
    }
    case 'broken-wall': {
      const rng = random(hash(id))
      const heights = Array.from({ length: 8 }, () => 0.5 + rng() * (h - 0.7))
      for (let i = 0; i < 7; i++) b.prism([[-w / 2 + i * w / 7, 0], [-w / 2 + (i + 1) * w / 7, 0], [-w / 2 + (i + 1) * w / 7, heights[i + 1]], [-w / 2 + i * w / 7, heights[i]]], d, 0, m, 'wall', 'fractured-wall')
      break
    }
    case 'slab': {
      if (definition.family === 'tile-floor') {
        box(w, h - 0.025, d, 0, 0, 0, 'concrete', 'floor')
        const nx = Math.ceil(w / 0.5), nz = Math.ceil(d / 0.5)
        for (let x = 0; x < nx; x++) for (let z = 0; z < nz; z++) box(w / nx - 0.004, 0.025, d / nz - 0.004, -w / 2 + (x + 0.5) * w / nx, h - 0.025, -d / 2 + (z + 0.5) * d / nz, 'tile', 'floor')
      } else box(w, h, d, 0, 0, 0, m, definition.family.includes('roof') ? 'roof' : definition.family === 'foundation' ? 'foundation' : 'floor')
      break
    }
    case 'pillar': box(w, h, d, 0, 0, 0, m, 'column'); break
    case 'stairs': {
      for (let i = 0; i < 16; i++) {
        const rise = (i + 1) * h / 16
        const thickness = Math.min(rise, 0.42)
        box(w, thickness, d / 16, 0, rise - thickness, d / 2 - (i + 0.5) * d / 16, m, 'stairs')
      }
      break
    }
    case 'debris': {
      const rng = random(hash(id))
      const cols = 3 + (v > 1 ? 1 : 0)
      for (let x = 0; x < cols; x++) for (let z = 0; z < 2; z++) {
        const width = w / cols * 0.62, depth = d / 2 * 0.57
        const height = h * (0.2 + rng() * 0.45), yaw = (rng() - 0.5) * 0.55
        const px = -w / 2 + (x + 0.5) * w / cols, pz = -d / 2 + (z + 0.5) * d / 2
        const fragment = box(width, height, depth, px, 0, pz, m, 'debris', yaw)
        if (!['planks', 'metal-scrap', 'collapsed-beam'].includes(definition.family)) {
          fragment.primitive = 'prism'
          fragment.profile = [[-0.5, -0.5], [0.5, -0.5], [0.47, 0.22], [0.3, 0.5], [-0.34, 0.5], [-0.5, 0.28]]
        }
        if (x === 1 && z === 0) {
          box(width * 0.7, height * 0.6, depth * 0.8, px, height, pz, m, 'debris', yaw)
        } else if (x === 0 && z === 0) stock(fragment)
      }
      break
    }
    case 'resource': {
      if (definition.family === 'handgun') {
        box(w * 0.22, h * 0.55, d * 0.4, -w * 0.28, 0, 0, m, 'resource')
        box(w, h * 0.45, d * 0.4, 0, h * 0.55, 0, m, 'resource')
      } else if (['medicine', 'bottles', 'battery', 'cans'].includes(definition.family)) {
        for (let i = 0; i < 2 + v; i++) {
          const width = w / (2 + v) * 0.8, x = -w / 2 + (i + 0.5) * w / (2 + v)
          b.solid('cylinder', [width, h * 0.85, d * 0.6], [x, h * 0.425, 0], m, 'resource', 'container')
          b.solid('cylinder', [width * 0.65, h * 0.15, d * 0.42], [x, h * 0.925, 0], 'steel', 'resource', 'container-cap')
        }
      } else {
        for (let i = 0; i < v + 1; i++) box(w, h / (v + 1), d, 0, i * h / (v + 1), 0, i % 2 ? 'plaster' : m, 'resource')
      }
      break
    }
  }

  finishAsset(b, definition)
  assignSurfaces(b.model, definition)
  const bounds = modelBounds(b.model)
  b.model.snaps = [
    { id: 'base', position: [0, 0, 0], normal: [0, -1, 0], type: 'base' },
    { id: 'top', position: [0, bounds.max[1], 0], normal: [0, 1, 0], type: 'top' },
    { id: 'left', position: [bounds.min[0], 0, 0], normal: [-1, 0, 0], type: 'edge' },
    { id: 'right', position: [bounds.max[0], 0, 0], normal: [1, 0, 0], type: 'edge' },
  ]
  cache.set(id, b.model)
  return b.model
}
