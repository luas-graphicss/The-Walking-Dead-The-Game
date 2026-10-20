import { IMPOSTOR, IMPOSTOR_ATLAS, TREES, impostorLayout, KIT_MATERIALS } from '../../lib/game/assets/catalog'
import { type Model, type Vec3, normalize } from './mesh'
import { createImage, dilateColor, type Img } from './image'
import type { Pbr } from './textures'

const wrap = (value: number) => value - Math.floor(value)
function sample(image: Img, u: number, v: number, channel: number) {
  const x = Math.min(image.w - 1, Math.floor(wrap(u) * image.w)), y = Math.min(image.h - 1, Math.floor(wrap(1 - v) * image.h))
  return image.data[(y * image.w + x) * image.c + channel]
}

export function bakeImpostors(models: Model[], sets: Record<string, Pbr>) {
  const { width, height } = IMPOSTOR_ATLAS
  const albedo = createImage(width, height, 4), normal = createImage(width, height, 3), orm = createImage(width, height, 3)
  const depth = new Float32Array(width * height).fill(-Infinity)
  for (let i = 0; i < width * height; i++) { normal.data.set([0.5, 0.5, 1], i * 3); orm.data.set([1, 0.85, 0], i * 3) }
  models.forEach((model, index) => {
    const layout = impostorLayout(index)
    for (const top of [false, true]) {
      const ppm = top ? layout.top.pixelsPerMetre : layout.side.pixelsPerMetre
      const xOffset = index * IMPOSTOR.column, yOffset = top ? IMPOSTOR.side : 0
      const maxHeight = top ? IMPOSTOR.top : IMPOSTOR.side
      const project = (p: Vec3) => [xOffset + IMPOSTOR.column / 2 + p[0] * ppm, yOffset + (top ? IMPOSTOR.top / 2 + p[2] * ppm : IMPOSTOR.side - 1 - p[1] * ppm), top ? p[1] : p[2]]
      for (const [material, part] of model.parts) {
        const texture = sets[KIT_MATERIALS[material as keyof typeof KIT_MATERIALS]]
        if (!texture) throw new Error(`Textura ausente no bake: ${material}`)
        for (let offset = 0; offset < part.indices.length; offset += 3) {
          const ids = part.indices.slice(offset, offset + 3), p = ids.map((id) => project(part.position(id)))
          const [a, b, c] = p
          const area = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
          if (Math.abs(area) < 1e-7) continue
          const minX = Math.max(xOffset + 1, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(xOffset + IMPOSTOR.column - 2, Math.ceil(Math.max(a[0], b[0], c[0])))
          const minY = Math.max(yOffset, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(yOffset + maxHeight - 1, Math.ceil(Math.max(a[1], b[1], c[1])))
          for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
            const s = ((b[1] - c[1]) * (x + 0.5 - c[0]) + (c[0] - b[0]) * (y + 0.5 - c[1])) / area
            const t = ((c[1] - a[1]) * (x + 0.5 - c[0]) + (a[0] - c[0]) * (y + 0.5 - c[1])) / area, r = 1 - s - t
            if (s < 0 || t < 0 || r < 0) continue
            const pixel = y * width + x, z = s * a[2] + t * b[2] + r * c[2]
            if (z <= depth[pixel]) continue
            const weights = [s, t, r]
            const u = ids.reduce((sum, id, k) => sum + part.uvs[id * 2] * weights[k], 0), v = ids.reduce((sum, id, k) => sum + part.uvs[id * 2 + 1] * weights[k], 0)
            if (texture.albedo.c === 4 && sample(texture.albedo, u, v, 3) < 0.5) continue
            depth[pixel] = z
            for (let ch = 0; ch < 3; ch++) { albedo.data[pixel * 4 + ch] = sample(texture.albedo, u, v, ch); orm.data[pixel * 3 + ch] = sample(texture.orm, u, v, ch) }
            albedo.data[pixel * 4 + 3] = 1
            const n = normalize([0, 1, 2].map((ch) => ids.reduce((sum, id, k) => sum + part.normals[id * 3 + ch] * weights[k], 0)) as Vec3)
            const local = top ? [n[0], -n[2], Math.abs(n[1])] : [n[0], n[1], Math.abs(n[2])]
            normal.data.set(local.map((value) => value * 0.5 + 0.5), pixel * 3)
            if (material.startsWith('foliage')) {
              const interior = Math.max(0, 1 - Math.abs((x - xOffset - IMPOSTOR.column / 2) / ppm) / TREES[index].crown)
              orm.data[pixel * 3] *= 1 - interior * 0.22
            }
          }
        }
      }
    }
  })
  return { albedo: dilateColor(albedo, 12), normal, orm }
}
