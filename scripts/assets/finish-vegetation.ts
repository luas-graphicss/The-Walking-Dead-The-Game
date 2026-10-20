import { type Model, Part, type Vec3, add, sub, scale, dot, cross, normalize } from './mesh'

export function finishVegetation(model: Model) {
  for (const [material, original] of model.parts) {
    const faces: { ids: number[]; normal: Vec3 }[] = []
    const adjacency = new Map<string, number[]>()
    const vertexKey = (id: number) => `${original.groups[id]}:${original.position(id).map((v) => Math.round(v * 1e5)).join(',')}`
    for (let offset = 0; offset < original.indices.length; offset += 3) {
      const ids = original.indices.slice(offset, offset + 3)
      const [a, b, c] = ids.map((id) => original.position(id))
      const index = faces.length
      faces.push({ ids, normal: normalize(cross(sub(b, a), sub(c, a))) })
      for (const id of ids) { const key = vertexKey(id), list = adjacency.get(key) ?? []; list.push(index); adjacency.set(key, list) }
    }
    const result = new Part(), normals: number[] = [], unique = new Map<string, number>()
    const tile = material === 'pine_bark' ? 0.8 : 0.6
    for (const { ids, normal } of faces) {
      const [a, b, c] = ids.map((id) => original.position(id)), e1 = sub(b, a), e2 = sub(c, a)
      const uv = ids.map((id) => [original.uvs[id * 2], original.uvs[id * 2 + 1]])
      const du1 = uv[1][0] - uv[0][0], dv1 = uv[1][1] - uv[0][1], du2 = uv[2][0] - uv[0][0], dv2 = uv[2][1] - uv[0][1]
      const det = du1 * dv2 - du2 * dv1
      const ju = add(scale(e1, dv2 / det), scale(e2, -dv1 / det)), jv = add(scale(e1, -du2 / det), scale(e2, du1 / det))
      const g11 = dot(ju, ju), g22 = dot(jv, jv), g12 = dot(ju, jv)
      const half = (g11 + g22) / 2, root = Math.sqrt(Math.max(0, half * half - (g11 * g22 - g12 * g12)))
      if (!model.open.has(material) && (half - root <= 1e-18 || Math.sqrt((half + root) / (half - root)) > 5.8)) {
        const up = normalize(jv), right = normalize(cross(up, normal))
        const center = scale(add(add(a, b), c), 1 / 3)
        const u = (uv[0][0] + uv[1][0] + uv[2][0]) / 3, v = (uv[0][1] + uv[1][1] + uv[2][1]) / 3
        for (let i = 0; i < 3; i++) { const d = sub(original.position(ids[i]), center); uv[i] = [u + dot(d, right) / tile, v + dot(d, up) / tile] }
      }
      const triangle = ids.map((id, corner) => {
        const neighbors = adjacency.get(vertexKey(id)) ?? []
        let sum: Vec3 = [0, 0, 0]
        for (const index of neighbors) if (dot(normal, faces[index].normal) > 0.45) sum = add(sum, faces[index].normal)
        const n = normalize(sum), p = original.position(id)
        const k = [...p, ...uv[corner], ...n].map((v) => Math.round(v * 1e6)).join(',')
        let mapped = unique.get(k)
        if (mapped === undefined) {
          mapped = result.vertex(p, [uv[corner][0], uv[corner][1]], original.groups[id])
          normals.push(...n); unique.set(k, mapped)
        }
        return mapped
      })
      result.triangle(triangle[0], triangle[1], triangle[2])
    }
    result.normals = Float32Array.from(normals)
    result.customNormals = true
    model.parts.set(material, result)
  }
  return model
}
