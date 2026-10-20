import { createNoise3D } from 'simplex-noise'
import { type Img, createImage, sampleWrap, smoothstep } from './image'
import { type Model, type Vec3, add, dot, normalize, scale, sub } from './mesh'
import { type StoneChart, random } from './models'
import type { Pbr } from './textures'

type Source = { set: Pbr; tile: number }
export type BakeItem = { model: Model; charts: StoneChart[]; material: string; tall: number; size: number; moss: number; rock: Source; mossSource?: Source }

export function bakeStones(items: BakeItem[], width: number, height: number, gutter: number) {
  const albedo = createImage(width, height, 3), normal = createImage(width, height, 3), orm = createImage(width, height, 3)
  for (let i = 0; i < width * height; i++) { normal.data.set([0.5, 0.5, 1], i * 3); orm.data.set([1, 0.9, 0], i * 3) }
  const noise = createNoise3D(random(0xb0b0))
  const texel = new Float32Array(4), nrm = new Float32Array(4), occ = new Float32Array(4)
  const triplanar = (source: Source, p: Vec3, n: Vec3, out: { color: Vec3; perturb: Vec3; ao: number; rough: number }) => {
    const weights = n.map((v) => Math.abs(v) ** 4)
    const total = weights[0] + weights[1] + weights[2]
    const signs = n.map((v) => (v < 0 ? -1 : 1))
    const projections: { u: number; v: number; t: Vec3; b: Vec3 }[] = [
      { u: p[2] * signs[0], v: p[1], t: [0, 0, signs[0]], b: [0, 1, 0] },
      { u: p[0] * signs[1], v: p[2], t: [signs[1], 0, 0], b: [0, 0, 1] },
      { u: -p[0] * signs[2], v: p[1], t: [-signs[2], 0, 0], b: [0, 1, 0] },
    ]
    out.color = [0, 0, 0]; out.perturb = [0, 0, 0]; out.ao = 0; out.rough = 0
    projections.forEach((proj, k) => {
      const w = weights[k] / total
      if (w < 1e-3) return
      const { albedo: a, normal: nm, orm: o } = source.set
      const x = (proj.u / source.tile) * a.w, y = (1 - proj.v / source.tile) * a.h
      sampleWrap(a, x, y, texel)
      sampleWrap(nm, x, y, nrm)
      sampleWrap(o, x, y, occ)
      out.color = add(out.color, scale([texel[0], texel[1], texel[2]], w))
      out.perturb = add(out.perturb, scale(add(scale(proj.t, nrm[0] * 2 - 1), scale(proj.b, nrm[1] * 2 - 1)), w))
      out.ao += occ[0] * w
      out.rough += occ[1] * w
    })
  }
  const rock = { color: [0, 0, 0] as Vec3, perturb: [0, 0, 0] as Vec3, ao: 1, rough: 1 }
  const moss = { color: [0, 0, 0] as Vec3, perturb: [0, 0, 0] as Vec3, ao: 1, rough: 1 }
  for (const item of items) {
    const part = item.model.part(item.material)
    const position = (id: number): Vec3 => part.position(id)
    const vertexNormal = (id: number): Vec3 => [part.normals[id * 3], part.normals[id * 3 + 1], part.normals[id * 3 + 2]]
    for (const chart of item.charts) {
      const { cell, n, ids } = chart
      const inner = cell.size - 2 * gutter
      const at = (i: number, j: number) => ids[j * (n + 1) + i]
      for (let py = cell.y; py < cell.y + cell.size; py++) for (let px = cell.x; px < cell.x + cell.size; px++) {
        const a = Math.min(1, Math.max(0, (px + 0.5 - cell.x - gutter) / inner))
        const b = Math.min(1, Math.max(0, (py + 0.5 - cell.y - gutter) / inner))
        const fi = a * n, fj = (1 - b) * n
        const i0 = Math.min(n - 1, Math.floor(fi)), j0 = Math.min(n - 1, Math.floor(fj)), ti = fi - i0, tj = fj - j0
        const corners = [at(i0, j0), at(i0 + 1, j0), at(i0, j0 + 1), at(i0 + 1, j0 + 1)]
        const bilinear = (get: (id: number) => Vec3) => {
          const [p00, p10, p01, p11] = corners.map(get)
          return add(scale(add(scale(p00, 1 - ti), scale(p10, ti)), 1 - tj), scale(add(scale(p01, 1 - ti), scale(p11, ti)), tj))
        }
        const p = bilinear(position)
        const nrmV = normalize(bilinear(vertexNormal))
        const [p00, p10, p01, p11] = corners.map(position)
        const du = add(scale(sub(p10, p00), 1 - tj), scale(sub(p11, p01), tj))
        const dv = add(scale(sub(p01, p00), 1 - ti), scale(sub(p11, p10), ti))
        const tangent = normalize(sub(du, scale(nrmV, dot(du, nrmV))))
        const up = normalize(sub(sub(dv, scale(nrmV, dot(dv, nrmV))), scale(tangent, dot(dv, tangent))))
        const world = scale(p, item.size)
        triplanar(item.rock, world, nrmV, rock)
        let color = rock.color, perturb = rock.perturb, rough = rock.rough, ao = rock.ao
        if (item.moss > 0 && item.mossSource) {
          const mask = smoothstep(0.42, 0.82, nrmV[1] + 0.35 * noise(world[0] * 0.9, world[1] * 0.9, world[2] * 0.9)) * item.moss
          if (mask > 0.002) {
            triplanar(item.mossSource, world, nrmV, moss)
            color = add(scale(color, 1 - mask), scale(moss.color, mask))
            perturb = add(scale(perturb, 1 - mask), scale(moss.perturb, mask))
            rough = rough * (1 - mask) + moss.rough * mask
            ao = ao * (1 - mask) + moss.ao * mask
          }
        }

        const ground = 0.62 + 0.38 * smoothstep(-0.6 * item.tall, 0.25 * item.tall, p[1])
        const bent = normalize(add(nrmV, perturb))
        const local: Vec3 = [dot(bent, tangent), dot(bent, up), dot(bent, nrmV)]
        const index = (py * width + px) * 3
        albedo.data.set(color, index)
        normal.data.set([local[0] * 0.5 + 0.5, local[1] * 0.5 + 0.5, Math.max(0, local[2]) * 0.5 + 0.5], index)
        orm.data.set([ao * ground, rough, 0], index)
      }
    }
  }
  return { albedo, normal, orm } as { albedo: Img; normal: Img; orm: Img }
}
