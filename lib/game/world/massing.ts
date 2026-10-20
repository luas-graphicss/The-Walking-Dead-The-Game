import { architectureFor } from '../blockout/architecture'
import { BLUEPRINT_BY_ID } from '../blockout/blueprints'
import { styleFor } from '../blockout/style'
import { BLOCK_MATERIALS, type Vec3 } from '../blockout/types'
import { TILE } from '../assets/catalog'
import { randomSource } from './noise'
import { WORLD_COLORS } from './settings'
import { STRUCTURE_CONDITIONS, STRUCTURE_ZONES, type Site } from './settlements'
import type { MeshData } from './types'

type Color = [number, number, number]
const linear = (hex: string): Color => [1, 3, 5].map((offset) => {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}) as Color

const BASE = linear(WORLD_COLORS.concrete)
const tintOf = (color: Color): Color => color.map((v, i) => Math.min(1.8, Math.max(0.12, v / BASE[i]))) as Color
const finish = (material: keyof typeof BLOCK_MATERIALS, tint: Vec3 | undefined, shade = 1): Color => {
  const base = linear(BLOCK_MATERIALS[material].color)
  return tintOf([base[0] * (tint?.[0] ?? 1) * shade, base[1] * (tint?.[1] ?? 1) * shade, base[2] * (tint?.[2] ?? 1) * shade])
}
const SOOT = tintOf(linear('#2c2a27'))
const RUBBLE = tintOf(linear('#7d7366'))
const COMPOUNDS = new Set(['abandoned-base', 'research-outpost', 'survivor-camp'])

class Builder {
  positions: number[] = []; normals: number[] = []; colors: number[] = []; uvs: number[] = []; indices: number[] = []
  constructor(private readonly ox: number, private readonly oz: number) {}

  face(points: Vec3[], normal: Vec3, color: Color, uv: (p: Vec3) => [number, number]) {
    const base = this.positions.length / 3
    for (const p of points) {
      this.positions.push(p[0] - this.ox, p[1], p[2] - this.oz)
      this.normals.push(...normal); this.colors.push(...color); this.uvs.push(...uv(p))
    }
    const a = points[0], b = points[1], c = points[2]
    const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1])
    const cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])
    const cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    const flip = cx * normal[0] + cy * normal[1] + cz * normal[2] < 0
    for (let i = 1; i < points.length - 1; i++) {
      if (flip) this.indices.push(base, base + i + 1, base + i)
      else this.indices.push(base, base + i, base + i + 1)
    }
  }
  finish(): MeshData {
    const count = this.indices.length
    return {
      positions: new Float32Array(this.positions), normals: new Float32Array(this.normals), colors: new Float32Array(this.colors),
      uvs: new Float32Array(this.uvs), indices: new Uint32Array(this.indices), groups: new Uint32Array(count ? [0, count, 0] : []),
    }
  }
}

const normalOf = (a: Vec3, b: Vec3, c: Vec3): Vec3 => {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
  const n: Vec3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
  const length = Math.hypot(...n) || 1
  return [n[0] / length, n[1] / length, n[2] / length]
}

export function buildMassing(sites: Site[], x0: number, z0: number) {
  const mesh = new Builder(x0, z0)
  const records: number[] = []
  const tile = TILE.concrete
  for (const site of sites) {
    const start = mesh.indices.length
    const rng = randomSource(site.id ^ 0x3a71)
    const blueprint = BLUEPRINT_BY_ID.get(site.blueprint)
    const style = blueprint && !COMPOUNDS.has(site.blueprint) ? styleFor(blueprint, architectureFor(blueprint), site.id) : null
    const { condition, fp } = site
    const burned = condition === 'burned', ruined = condition === 'ruined', leveled = condition === 'leveled'
    const decay = condition === 'damaged' ? 0.9 : burned ? 0.55 : ruined || leveled ? 0.8 : 1
    let wall = style ? finish(style.wall.material, style.wall.tint, decay) : finish('concrete', [0.86, 0.85, 0.8], decay)
    let roof = style ? finish(style.roof.material, style.roof.tint, decay * 0.92) : finish('steel', [0.7, 0.68, 0.64], decay)
    if (burned) { wall = wall.map((v, i) => v * 0.45 + SOOT[i] * 0.55) as Color; roof = SOOT }
    if (ruined || leveled) wall = wall.map((v, i) => v * 0.55 + RUBBLE[i] * 0.45) as Color
    const form = style?.roof.form ?? 'flat'
    const pitch = style?.roof.pitch ?? 0
    const wallTop = leveled ? 0.42 : ruined ? 1.3 + rng() * 1.3 : fp.eave
    const roofless = leveled || ruined || (burned && rng() < 0.6)
    const { x, y, z, c, s } = site
    const at = (lx: number, ly: number, lz: number): Vec3 => [x + c * lx + s * lz, y + ly, z - s * lx + c * lz]
    const wallFace = (a: Vec3, b: Vec3, top: number, color: Color) => {
      const length = Math.hypot(b[0] - a[0], b[2] - a[2])
      const quad: Vec3[] = [a, b, [b[0], top, b[2]], [a[0], top, a[2]]]
      const n = normalOf(a, b, [a[0], top, a[2]])
      mesh.face(quad, [n[0], 0, n[2]], color, (p) => [(p === a || p === quad[3] ? 0 : length) / tile, (p[1] - y) / tile])
    }

    const box = (x0: number, x1: number, z0: number, z1: number, top: number, color: Color, cap: Color | null) => {
      const corners = [at(x0, -0.6, z0), at(x1, -0.6, z0), at(x1, -0.6, z1), at(x0, -0.6, z1)]
      const center = at((x0 + x1) / 2, 0, (z0 + z1) / 2)
      for (let i = 0; i < 4; i++) {
        const a = corners[i], b = corners[(i + 1) % 4]
        const out: Vec3 = [(a[0] + b[0]) / 2 - center[0], 0, (a[2] + b[2]) / 2 - center[2]]
        const n = normalOf(a, b, [a[0], a[1] + 1, a[2]])
        wallFace(n[0] * out[0] + n[2] * out[2] >= 0 ? a : b, n[0] * out[0] + n[2] * out[2] >= 0 ? b : a, y + top, color)
      }
      if (cap) mesh.face(corners.map((p) => [p[0], y + top, p[2]] as Vec3), [0, 1, 0], cap, (p) => [p[0] / tile, -p[2] / tile])
    }
    if (COMPOUNDS.has(site.blueprint)) {

      const [cx0, cx1, cz0, cz1] = [fp.minX + 0.4, fp.maxX - 0.4, fp.minZ + 0.4, fp.maxZ - 0.4]
      const height = leveled ? 0.3 : ruined ? 1.1 : 2.8
      box(cx0, cx1, cz0, cz0 + 0.3, height, wall, wall); box(cx0, cx1, cz1 - 0.3, cz1, height, wall, wall)
      box(cx0, cx0 + 0.3, cz0, cz1, height, wall, wall); box(cx1 - 0.3, cx1, cz0, cz1, height, wall, wall)
      for (const [px, pz] of [[-8.5, -8], [8.5, -8], [8.5, 8]]) box(px - 5, px + 5, pz - 5.4, pz + 5.4, leveled ? 0.4 : ruined ? 1.6 : 3.3, wall, roof)
    } else {
      for (const [rx0, rx1, rz0, rz1] of fp.rects) {
        const pitched = !roofless && form !== 'flat' && pitch > 0.05
        box(rx0, rx1, rz0, rz1, wallTop, wall, pitched ? null : roofless ? wall : roof)
        if (!pitched) continue

        const o = 0.35, alongX = rx1 - rx0 >= rz1 - rz0
        const span = (alongX ? rz1 - rz0 : rx1 - rx0) / 2 + o, rise = Math.min(6, pitch * span)
        const e = wallTop, r = wallTop + rise
        const hip = form === 'hip' ? Math.min(span, ((alongX ? rx1 - rx0 : rz1 - rz0) / 2 + o) * 0.98) : 0
        const X0 = rx0 - o, X1 = rx1 + o, Z0 = rz0 - o, Z1 = rz1 + o
        const planar = (p: Vec3): [number, number] => [p[0] / tile, (p[1] + p[2]) / tile]
        const middle = at((rx0 + rx1) / 2, (e + r) / 2, (rz0 + rz1) / 2)

        const outward = (points: Vec3[], color: Color) => {
          const n = normalOf(points[0], points[1], points[2])
          const m = points.reduce<Vec3>((sum, p) => [sum[0] + p[0] / points.length, sum[1] + p[1] / points.length, sum[2] + p[2] / points.length], [0, 0, 0])
          const away = n[0] * (m[0] - middle[0]) + n[1] * (m[1] - middle[1]) + n[2] * (m[2] - middle[2]) >= 0
          mesh.face(points, away ? n : [-n[0], -n[1], -n[2]], color, planar)
        }
        if (alongX) {
          const zm = (Z0 + Z1) / 2, a0 = X0 + hip, a1 = X1 - hip
          for (const zEdge of [Z0, Z1]) outward([at(X0, e, zEdge), at(X1, e, zEdge), at(a1, r, zm), at(a0, r, zm)], roof)
          for (const [xEdge, apex] of [[X0, a0], [X1, a1]] as const) outward([at(xEdge, e, Z0), at(xEdge, e, Z1), at(apex, r, zm)], hip ? roof : wall)
        } else {
          const xm = (X0 + X1) / 2, a0 = Z0 + hip, a1 = Z1 - hip
          for (const xEdge of [X0, X1]) outward([at(xEdge, e, Z0), at(xEdge, e, Z1), at(xm, r, a1), at(xm, r, a0)], roof)
          for (const [zEdge, apex] of [[Z0, a0], [Z1, a1]] as const) outward([at(X0, e, zEdge), at(X1, e, zEdge), at(xm, r, apex)], hip ? roof : wall)
        }
      }
    }
    records.push(
      x - x0, y, z - z0, site.yaw, site.index, site.id, STRUCTURE_CONDITIONS.indexOf(condition),
      fp.minX, fp.maxX, fp.minZ, fp.maxZ, fp.eave, fp.ridge, start, mesh.indices.length - start, STRUCTURE_ZONES.indexOf(site.zone),
    )
  }
  return { structures: new Float32Array(records), buildings: mesh.finish() }
}
