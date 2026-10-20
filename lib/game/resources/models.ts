import { buildAsset, ModelBuilder } from '../blockout/model'
import type { BlockModel, BlockPart, MaterialKey, Vec3 } from '../blockout/types'
import { RESOURCE_BY_ID } from './catalog'
import type { BlockoutShape, Resource } from './types'

const MIN = 0.01
const at = (n: number) => Math.max(MIN, n)

class Kit {
  constructor(readonly b: ModelBuilder) {}
  box([w, h, d]: Vec3, x: number, bottom: number, z: number, material: MaterialKey, name: string): BlockPart {
    const size: Vec3 = [at(w), at(h), at(d)]
    return this.b.box(size, [x, bottom + size[1] / 2, z], material, 'resource', 0, 0, name)
  }
  cylinder([w, h, d]: Vec3, x: number, bottom: number, z: number, material: MaterialKey, name: string): BlockPart {
    const size: Vec3 = [at(w), at(h), at(d)]
    return this.b.solid('cylinder', size, [x, bottom + size[1] / 2, z], material, 'resource', name)
  }

  lying(length: number, diameter: number, x: number, z: number, material: MaterialKey, name: string): BlockPart {
    const part = this.b.solid('cylinder', [at(diameter), at(length), at(diameter)], [x, at(diameter) / 2, z], material, 'resource', name)
    part.roll = Math.PI / 2
    return part
  }

  column(layers: [scale: number, height: number, material: MaterialKey, name: string][], [w, , d]: Vec3) {
    let bottom = 0
    for (const [scale, height, material, name] of layers) bottom += this.cylinder([w * scale, height, d * scale], 0, bottom, 0, material, name).size[1]
  }
}

const top = (part: BlockPart) => part.position[1] + part.size[1] / 2
const steelOr = (m: MaterialKey) => (m === 'wood' ? 'steel' : m)

const SHAPES: Record<BlockoutShape, (k: Kit, size: Vec3, m: MaterialKey) => void> = {
  box: (k, s, m) => { k.box(s, 0, 0, 0, m, 'body') },
  sheet: (k, s, m) => { k.box(s, 0, 0, 0, m, 'sheet') },
  pack: (k, [w, h, d], m) => {
    if (h < 0.03) { k.box([w, h, d], 0, 0, 0, m, 'pack'); return }
    const body = k.box([w, h * 0.85, d], 0, 0, 0, m, 'pack')
    k.box([w * 0.92, h * 0.15, d * 0.35], 0, top(body), -d * 0.3, m, 'seal')
  },
  can: (k, [w, h, d], m) => {
    if (h < 0.03) { k.cylinder([w, h, d], 0, 0, 0, m, 'disc'); return }
    k.column([[1, h * 0.92, m, 'can-body'], [0.86, h * 0.08, 'steel', 'can-rim']], [w, h, d])
  },
  bottle: (k, s, m) => k.column([[1, s[1] * 0.66, m, 'bottle-body'], [0.72, s[1] * 0.1, m, 'shoulder'], [0.4, s[1] * 0.14, m, 'neck'], [0.46, s[1] * 0.1, 'charcoal', 'cap']], s),
  jar: (k, s, m) => k.column([[1, s[1] * 0.82, m, 'jar-body'], [0.94, s[1] * 0.18, m === 'glass' ? 'steel' : m, 'lid']], s),
  tank: (k, s, m) => k.column([[1, s[1] * 0.8, m, 'cylinder'], [0.55, s[1] * 0.08, 'steel', 'collar'], [0.28, s[1] * 0.12, 'steel', 'valve']], s),
  spool: (k, s, m) => k.column([[1, s[1] * 0.15, m, 'flange'], [0.55, s[1] * 0.7, m, 'core'], [1, s[1] * 0.15, m, 'flange']], s),
  coil: (k, s, m) => k.column([[1, s[1], m, 'coil'], [0.36, Math.max(s[1] * 0.3, MIN), 'charcoal', 'hub']], s),
  roll: (k, s, m) => k.column([[1, s[1] * 0.96, m, 'roll'], [0.3, Math.max(s[1] * 0.04, MIN), 'paper', 'core']], s),
  jug: (k, [w, h, d], m) => {
    const body = k.box([w, h * 0.78, d], 0, 0, 0, m, 'jug-body')
    k.cylinder([w * 0.2, h * 0.22, Math.min(w * 0.2, d * 0.8)], w * 0.3, top(body), 0, 'charcoal', 'spout')
    k.box([w * 0.42, h * 0.16, d * 0.22], -w * 0.18, top(body), 0, m, 'handle')
  },
  sack: (k, [w, h, d], m) => {
    const body = k.box([w, h * 0.84, d], 0, 0, 0, m, 'sack')
    k.box([w * 0.32, h * 0.16, d * 0.28], 0, top(body), -d * 0.28, m, 'tie')
  },
  bag: (k, [w, h, d], m) => {
    const body = k.box([w, h * 0.82, d], 0, 0, 0, m, 'bag')
    k.box([w * 0.6, h * 0.18, d * 0.5], 0, top(body), 0, m, 'handle')
  },
  pouch: (k, [w, h, d], m) => {
    const body = k.box([w, h * 0.8, d], 0, 0, 0, m, 'pouch')
    k.box([w * 0.96, h * 0.2, d * 0.5], 0, top(body), -d * 0.22, m, 'flap')
  },
  device: (k, [w, h, d], m) => {
    if (h < 0.05) {
      const base = k.box([w, h / 2, d], 0, 0, 0, m, 'base')
      k.box([w * 0.98, h / 2, d * 0.98], 0, top(base), 0, m, 'lid')
      return
    }
    const body = k.box([w, h * 0.82, d], 0, 0, 0, m, 'housing')
    k.box([w * 0.5, h * 0.18, d * 0.5], -w * 0.15, top(body), 0, 'charcoal', 'controls')
  },
  bundle: (k, [w, h, d], m) => {
    const gap = 0.004, count = Math.min(8, Math.max(2, Math.round(d / (h + 0.006)))), rod = (d - (count - 1) * gap) / count
    for (let i = 0; i < count; i++) k.box([w, h, rod], 0, 0, -d / 2 + rod / 2 + i * (rod + gap), m, 'rod')
  },
  stack: (k, [w, h, d], m) => {
    const layers = Math.min(4, Math.max(2, Math.round(h / 0.05))), layer = h / layers
    for (let i = 0; i < layers; i++) k.box([w * (1 - 0.04 * i), layer, d * (1 - 0.05 * i)], (i % 2 ? 1 : -1) * w * 0.01 * Math.min(i, 1), i * layer, 0, m, 'layer')
  },
  pile: (k, [w, h, d], m) => {
    const base = k.box([w * 0.5, h * 0.55, d * 0.55], -w * 0.24, 0, -d * 0.2, m, 'piece')
    k.box([w * 0.44, h * 0.45, d * 0.5], w * 0.26, 0, d * 0.2, m, 'piece')
    k.box([w * 0.38, h * 0.45, d * 0.42], -w * 0.24, top(base), -d * 0.2, m, 'piece')
  },
  tube: (k, [w, h], m) => { k.lying(w, h, 0, 0, m, 'tube') },
  tool: (k, [w, h, d], m) => {
    k.box([w * 0.72, h * 0.55, d * 0.25], -w * 0.14, 0, 0, 'wood', 'handle')
    k.box([w * 0.28, h, d], w * 0.36, 0, 0, steelOr(m), 'head')
  },
  bar: (k, [w, h, d], m) => {
    k.box([w * 0.8, h * 0.8, d * 0.8], -w * 0.1, 0, 0, m, 'shaft')
    k.box([w * 0.2, h, d], w * 0.4, 0, 0, m === 'wood' ? 'wood' : 'rubber', 'grip')
  },
  blade: (k, [w, h, d], m) => {
    k.box([w * 0.3, h, d * 0.6], -w * 0.35, 0, 0, m === 'wood' ? 'wood' : 'charcoal', 'handle')
    k.box([w * 0.7, h * 0.5, d], w * 0.15, 0, 0, m, 'blade')
  },
  longgun: (k, [w, h, d], m) => {
    k.box([w * 0.3, h, d], -w * 0.35, 0, 0, m, 'stock')
    k.box([w * 0.25, h, d * 0.7], -w * 0.075, 0, 0, m === 'charcoal' ? 'charcoal' : 'steel', 'receiver')
    k.box([w * 0.45, h * 0.6, d * 0.2], w * 0.275, 0, d * 0.25, 'steel', 'barrel')
  },
  pistol: (k, [w, h, d], m) => {
    k.box([w * 0.3, h, d * 0.55], -w * 0.32, 0, d * 0.225, m, 'grip')
    k.box([w, h, d * 0.45], 0, 0, -d * 0.275, 'steel', 'slide')
  },
  mag: (k, [w, h, d], m) => {
    const plate = k.box([w, h * 0.08, d], 0, 0, 0, m, 'base-plate')
    k.box([w * 0.86, h * 0.92, d * 0.86], 0, top(plate), 0, m, 'magazine')
  },
}

const cache = new Map<string, BlockModel>()

export function buildResourceModel(resource: Resource | string): BlockModel {
  const spec = typeof resource === 'string' ? RESOURCE_BY_ID.get(resource) : resource
  if (!spec) throw new Error(`Recurso desconhecido: ${resource}`)
  const cached = cache.get(spec.id)
  if (cached) return cached
  let model: BlockModel
  if (spec.model.status === 'pronto') model = { ...buildAsset(`${spec.model.family}-1`), label: spec.label }
  else {
    const b = new ModelBuilder(`resource-${spec.id}`, spec.label)
    SHAPES[spec.model.shape](new Kit(b), spec.model.size, spec.model.material)
    model = b.model
  }
  cache.set(spec.id, model)
  return model
}
