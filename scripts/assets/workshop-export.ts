import { partGeometry, auditGeometry } from '../../lib/game/blockout/geometry'
import { partQuaternion } from '../../lib/game/blockout/solid'
import { textureOrigin } from '../../lib/game/blockout/surfaces'
import type { BlockModel, BlockPart, Vec3 } from '../../lib/game/blockout/types'
import { Model } from './mesh'
import type { GlbNode } from './glb'

export function createWorkshopExporter() {
  const cache = new Map<string, { model: Model; triangles: number; vertices: number }>()
  return (source: BlockModel, translation: Vec3) => {
    const nodes: GlbNode[] = []
    let triangles = 0, vertices = 0
    const materials = new Set<string>()
    for (const part of source.parts) {
      const local: BlockPart = { ...part, uvOrigin: textureOrigin(part), id: part.id.replace(/.*\/instance-\d+\//, ''), position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, support: undefined, level: 0 }
      const key = JSON.stringify(local)
      let entry = cache.get(key)
      if (!entry) {
        const geometry = partGeometry(local)
        const errors = auditGeometry(geometry)
        if (errors.length) throw new Error(`${part.id}: ${errors.join('; ')}`)
        const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv'), index = geometry.getIndex()!
        const model = new Model(local.id), mesh = model.part(local.surface ?? local.material)
        mesh.positions = Array.from(position.array)
        mesh.normals = Float32Array.from(normal.array)
        mesh.uvs = Array.from(uv.array)
        const color = geometry.getAttribute('color')
        if (color && Array.from(color.array).some((value) => value < 0.999)) mesh.colors = Float32Array.from(color.array)
        mesh.indices = Array.from(index.array)
        mesh.groups = Array.from({ length: position.count }, (_, i) => i)
        entry = { model, triangles: index.count / 3, vertices: position.count }
        cache.set(key, entry)
        geometry.dispose()
      }
      triangles += entry.triangles; vertices += entry.vertices; materials.add(part.surface ?? part.material)
      nodes.push({ model: entry.model, group: source.id, name: part.id, translation: part.position.map((n, i) => n + translation[i]) as Vec3, rotation: partQuaternion(part).toArray() })
    }
    return { nodes, stats: { id: source.id, triangles, vertices, materialGroups: materials.size, details: source.parts.filter((part) => part.detail).length } }
  }
}
