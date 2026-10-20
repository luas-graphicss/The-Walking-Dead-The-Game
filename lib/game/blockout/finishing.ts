import { Euler, Quaternion, Vector3 } from 'three'
import type { ModelBuilder } from './model'
import { partQuaternion } from './solid'
import { boxSeparation } from './validation'
import { edgeRadius } from './surface-geometry'
import { partBounds, type AssetSpec, type BlockPart, type MaterialKey, type Vec3 } from './types'

const mechanical = new Set(['washing-machine', 'laundry-drum', 'fuel-pump', 'generator', 'fridge', 'medicine-fridge', 'oven', 'vending-machine', 'arcade', 'server-rack', 'electrical-panel', 'tractor', 'forklift', 'paint-mixer', 'engine-stand', 'tire-changer', 'vehicle-lift', 'range-hood', 'coffee-machine', 'field-kitchen', 'water-pump', 'radio-desk', 'radio-console', 'electronics-bench', 'lab-equipment', 'printing-press', 'cash-register', 'checkout', 'ct-scanner', 'patient-monitor', 'pinball', 'computer-station'])
const screens = new Set(['arcade', 'pinball', 'computer-station', 'electronics-bench', 'patient-monitor', 'lab-equipment', 'radio-console', 'radio-desk', 'fuel-pump', 'cash-register', 'checkout', 'ct-scanner', 'vending-machine'])
const vinyl = new Set(['office-chair', 'booth', 'diner-booth', 'barber-chair', 'dental-chair', 'optical-chair', 'wheelchair', 'tractor', 'forklift', 'exam-table'])
const wheels = new Set(['tractor', 'forklift', 'wheelchair', 'hospital-bed', 'bicycle-stand', 'tire-changer'])

export function finishAsset(builder: ModelBuilder, spec: AssetSpec) {
  const { family, recipe } = spec, model = builder.model, originals = [...model.parts]
  for (const part of originals) {
    if (family === 'hay-bale') part.material = 'straw'
    if (family === 'blackboard' && part.material === 'charcoal') part.material = 'rubber'
    if (part.material === 'fabric' && vinyl.has(family)) part.material = 'leather'
    if (part.material === 'charcoal' && wheels.has(family)) part.material = 'rubber'
    if (part.material === 'charcoal' && mechanical.has(family)) part.material = screens.has(family) && part.primitive !== 'cylinder' ? 'glass' : 'rubber'
    if (recipe === 'resource' && ['food-box', 'papers', 'seeds', 'bandages'].includes(family)) part.material = family === 'bandages' && part.material === 'fabric' ? 'fabric' : 'paper'
    if (recipe === 'resource' && family === 'battery') part.material = 'paint'
    if (part.material === 'charcoal' && family === 'salon-station') part.material = 'glass'
    part.bevel ??= edgeRadius(part)
  }

  const attach = (host: BlockPart, size: Vec3, local: Vec3, material: MaterialKey, name: string, primitive: BlockPart['primitive'] = 'box', rotation: Vec3 = [0, 0, 0], segments?: number) => {
    if (size.some((n) => n < 0.004)) return null
    const q = partQuaternion(host)
    const position = new Vector3(...local).applyQuaternion(q).add(new Vector3(...host.position))
    const orientation = new Euler().setFromQuaternion(q.multiply(new Quaternion().setFromEuler(new Euler(...rotation, 'YXZ'))), 'YXZ')
    const part: BlockPart = { id: `${host.id}/${name}-${model.parts.length}`, size, position: position.toArray() as Vec3, yaw: orientation.y, pitch: orientation.x, roll: orientation.z, material, role: host.role, level: host.level, primitive, radialSegments: segments, detail: true, support: host.id, bevel: Math.min(0.002, Math.min(...size) * 0.12) }
    const bounds = partBounds(part)
    if (bounds.min[1] < -0.0001 || Math.abs(boxSeparation(host, part)) > 0.001) return null
    for (const other of model.parts) {
      if (other === host) continue
      const box = partBounds(other)
      if (bounds.max.some((max, i) => max < box.min[i] - 0.0001) || bounds.min.some((min, i) => min > box.max[i] + 0.0001)) continue
      if (boxSeparation(part, other) < -0.00012) return null
    }
    model.parts.push(part)
    return part
  }
  const front = (host: BlockPart, x: number, y: number, width: number, height: number, depth: number, mat: MaterialKey, name: string, round = false) => attach(host, round ? [width, depth, height] : [width, height, depth], [x, y, host.size[2] / 2 + depth / 2], mat, name, round ? 'cylinder' : 'box', round ? [Math.PI / 2, 0, 0] : [0, 0, 0])
  const bolt = (host: BlockPart, x: number, y: number) => attach(host, [0.022, 0.01, 0.022], [x, y, host.size[2] / 2 + 0.005], 'steel', 'hex-fastener', 'cylinder', [Math.PI / 2, 0, 0], 6)

  for (const part of originals) {
    const [w, h, d] = part.size
    if (part.primitive === 'cylinder' && part.material === 'rubber' && wheels.has(family)) {
      for (const side of [-1, 1]) {
        const rim = attach(part, [w * 0.57, 0.015, d * 0.57], [0, side * (h / 2 + 0.0075), 0], 'steel', 'wheel-rim', 'cylinder')
        if (rim) attach(rim, [w * 0.2, 0.024, d * 0.2], [0, side * 0.0195, 0], 'steel', 'axle-hub', 'cylinder')
      }
    }
    if (part.primitive && part.primitive !== 'box') continue
    if (['fabric', 'leather'].includes(part.material) && w > 0.22 && d > 0.18 && h > 0.055) {
      const inset = Math.max(0.022, (part.bevel ?? 0) + 0.014)
      for (const z of [-1, 1]) attach(part, [w - inset * 2, 0.01, 0.012], [0, h / 2 + 0.005, z * (d / 2 - inset)], part.material, 'upholstery-piping')
      for (const x of [-1, 1]) attach(part, [0.012, 0.01, d - inset * 2 - 0.012], [x * (w / 2 - inset), h / 2 + 0.005, 0], part.material, 'upholstery-piping')
    }
    if (part.material === 'wood' && part.role === 'fixture' && h < 0.16 && w > 0.35 && d > 0.12) {
      for (const x of [-1, 1]) for (const z of [-1, 1]) attach(part, [0.012, 0.01, 0.012], [x * (w / 2 - 0.028), h / 2 + 0.005, z * (d / 2 - 0.028)], 'steel', 'joinery-pin', 'cylinder', [0, 0, 0], 6)
    }
    if (['steel', 'paint'].includes(part.material) && part.role === 'fixture' && w > 0.25 && h > 0.25 && d > 0.035) {
      for (const x of [-1, 1]) for (const y of [-1, 1]) bolt(part, x * (w / 2 - 0.035), y * (h / 2 - 0.035))
    }
    if (part.material === 'glass' && w > 0.22 && h > 0.18 && d < 0.2) {
      const t = 0.018
      for (const x of [-1, 1]) front(part, x * (w / 2 - t / 2), 0, t, h, 0.012, 'rubber', 'display-bezel')
      for (const y of [-1, 1]) front(part, 0, y * (h / 2 - t / 2), w - 2 * t, t, 0.012, 'rubber', 'display-bezel')
    }
  }

  for (const host of originals) {
    if (host.primitive && host.primitive !== 'box') continue
    const [w, h, d] = host.size
    if (['fabric', 'leather'].includes(host.material) && w > 0.45 && d > 0.35 && h > 0.08 && h < 0.4) {
      const columns = Math.min(4, Math.max(2, Math.floor(w / 0.3)))
      for (let i = 0; i < columns; i++) attach(host, [0.016, 0.005, 0.016], [(i / (columns - 1) - 0.5) * w * 0.55, h / 2 + 0.0025, 0], host.material, 'upholstery-tuft', 'cylinder')
    }
    if (host.material === 'wood' && w > 0.3 && d > 0.22 && h < 0.15 && host.role === 'fixture') {
      for (const z of [-1, 1]) attach(host, [w * 0.82, 0.007, 0.007], [0, -h * 0.15, z * (d / 2 + 0.0035)], 'wood', 'inlaid-edge-beading')
    }
    if (['steel', 'paint'].includes(host.material) && w > 0.32 && h > 0.32 && d > 0.08 && host.role === 'fixture') {
      for (const y of [-1, 1]) {
        const hinge = front(host, -w * 0.34, y * h * 0.3, 0.032, 0.066, 0.006, 'steel', 'service-hinge-plate')
        if (hinge) attach(hinge, [0.012, 0.042, 0.012], [0, 0, 0.009], 'steel', 'hinge-knuckle', 'cylinder')
      }
      if (mechanical.has(family) && w > 0.65 && h > 0.5) {
        const plate = front(host, w * 0.25, -h * 0.2, Math.min(0.16, w * 0.2), 0.055, 0.005, 'steel', 'recessed-handle-backing')
        if (plate) front(plate, 0, 0, plate.size[0] * 0.62, 0.018, 0.012, 'rubber', 'service-handle')
      }
    }
    if (host.role === 'wall' && w > 0.65 && h > 0.4 && host.material === 'wood') {
      for (const x of [-1, 1]) for (const y of [-1, 1]) front(host, x * (w / 2 - 0.045), y * (h / 2 - 0.045), 0.014, 0.014, 0.005, 'steel', 'cladding-fixing', true)
    }
    if (host.role === 'stairs' && w > 0.5 && d > 0.18) attach(host, [w * 0.94, 0.006, 0.027], [0, h / 2 + 0.003, d / 2 - 0.035], 'rubber', 'anti-slip-nosing')
    if (host.material === 'paper' && w > 0.08 && h > 0.07 && d > 0.06) front(host, 0, -h * 0.25, w * 0.84, 0.008, 0.004, 'paper', 'folded-package-seam')
  }

  if (mechanical.has(family)) {
    const bodies = originals.filter((p) => !p.primitive && p.size[0] > 0.3 && p.size[1] > 0.24 && p.size[2] > 0.12 && !['fabric', 'leather', 'glass'].includes(p.material))
    const body = [...bodies].sort((a, b) => b.size[0] * b.size[1] - a.size[0] * a.size[1])[0]
    if (body) {
      const [w, h] = body.size
      const slots = Math.max(3, Math.min(7, Math.floor(h / 0.065)))
      for (let i = 0; i < slots; i++) front(body, -w * 0.1, -h * 0.3 + i * 0.037, w * 0.48, 0.014, 0.012, 'rubber', 'vent-louver')
      for (let i = 0; i < 3; i++) front(body, -w * 0.18 + i * w * 0.18, h * 0.32, 0.035, 0.035, 0.022, 'rubber', 'control-dial', true)
      front(body, w * 0.32, 0, w * 0.18, Math.min(0.08, h * 0.12), 0.01, 'paper', 'service-label')
    }
  }
  if (['shelf', 'cabinet', 'counter', 'rack'].includes(recipe)) {
    for (const shelf of originals.filter((p) => p.size[1] <= 0.085 && p.size[0] > 0.35 && p.size[2] > 0.18)) {
      front(shelf, 0, 0, shelf.size[0] * 0.75, 0.015, 0.012, shelf.material === 'wood' ? 'wood' : 'steel', 'rolled-shelf-edge')
    }
  }
  if (['barrel', 'water-tank', 'feed-hopper'].includes(family)) {
    const lid = [...originals].filter((p) => p.primitive === 'cylinder').sort((a, b) => b.position[1] - a.position[1])[0]
    if (lid) {
      const fitting = attach(lid, [0.08, 0.024, 0.08], [0, lid.size[1] / 2 + 0.012, 0], 'steel', 'filler-neck', 'cylinder')
      if (fitting) attach(fitting, [0.07, 0.014, 0.07], [0, 0.019, 0], 'rubber', 'sealed-filler-cap', 'cylinder')
    }
  }
  if (recipe === 'resource' && ['cans', 'medicine', 'bottles', 'battery'].includes(family)) {
    for (const body of originals.filter((p) => p.primitive === 'cylinder' && p.size[1] > spec.size[1] * 0.4)) {
      const cap = attach(body, [body.size[0] * 0.35, 0.01, body.size[2] * 0.35], [0, -body.size[1] / 2 + 0.005, 0], 'steel', 'container-base', 'cylinder')
      if (cap) cap.detail = true
    }
  }
}
