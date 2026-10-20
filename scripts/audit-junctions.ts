import { ROAD_LAYER } from '../lib/game/assets/catalog'
import { WorldGenerator } from '../lib/game/world/generator'
import { CHUNK_SIZE, DEFAULT_SEED, type ChunkLod } from '../lib/game/world/settings'

type P = [number, number]
type Tri = { p: [number, number, number][]; minX: number; maxX: number; minZ: number; maxZ: number; slot: number }
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const radius = Number(positional[0] ?? 1)
const lod = Number(positional[1] ?? 0) as ChunkLod
const only = process.argv.find((a) => a.startsWith('--chunk='))?.slice(8).split(',').map(Number)
const verbose = process.argv.includes('--verbose')
const PAVEMENT = new Set<number>([ROAD_LAYER.asphalt, ROAD_LAYER.cracked, ROAD_LAYER.dirt])
const CELL = 2

const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
const area = (poly: P[]) => poly.reduce((sum, p, i) => { const q = poly[(i + 1) % poly.length]; return sum + p[0] * q[1] - q[0] * p[1] }, 0) / 2

function clip(poly: P[], a: P, b: P): P[] {
  const out: P[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = cross(a, b, p), sq = cross(a, b, q)
    if (sp >= 0) out.push(p)
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]) }
  }
  return out
}

const plan = (t: Tri): P[] => { const pts = t.p.map(([x, , z]) => [x, z] as P); return area(pts) < 0 ? pts.reverse() : pts }

function heightAt(t: Tri, x: number, z: number) {
  const [a, b, c] = t.p, d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
  if (Math.abs(d) < 1e-12) return (a[1] + b[1] + c[1]) / 3
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d
  return u * a[1] + v * b[1] + (1 - u - v) * c[1]
}

const generator = new WorldGenerator(DEFAULT_SEED)
let chunks = 0, triangles = 0, zfight = 0, stacked = 0
const examples: string[] = []
for (let cx = -radius; cx <= radius; cx++) for (let cz = -radius; cz <= radius; cz++) {
  if (only && (cx !== only[0] || cz !== only[1])) continue
  const chunk = generator.buildChunk(cx, cz, lod), mesh = chunk.roads
  if (!mesh.groups || !mesh.indices.length) continue
  chunks++
  const tris: Tri[] = []
  for (let g = 0; g < mesh.groups.length; g += 3) {
    const [start, count, slot] = [mesh.groups[g], mesh.groups[g + 1], mesh.groups[g + 2]]
    if (!PAVEMENT.has(slot)) continue
    for (let i = start; i < start + count; i += 3) {
      const p = [0, 1, 2].map((k) => { const v = mesh.indices[i + k] * 3; return [mesh.positions[v], mesh.positions[v + 1], mesh.positions[v + 2]] as [number, number, number] })
      if (Math.abs(area(p.map(([x, , z]) => [x, z] as P))) < 1e-7) continue
      tris.push({ p, slot, minX: Math.min(p[0][0], p[1][0], p[2][0]), maxX: Math.max(p[0][0], p[1][0], p[2][0]), minZ: Math.min(p[0][2], p[1][2], p[2][2]), maxZ: Math.max(p[0][2], p[1][2], p[2][2]) })
    }
  }
  triangles += tris.length
  const grid = new Map<string, number[]>()
  tris.forEach((t, i) => {
    for (let gx = Math.floor(t.minX / CELL); gx <= Math.floor(t.maxX / CELL); gx++) for (let gz = Math.floor(t.minZ / CELL); gz <= Math.floor(t.maxZ / CELL); gz++) {
      const key = `${gx},${gz}`, list = grid.get(key)
      if (list) list.push(i); else grid.set(key, [i])
    }
  })
  for (const [key, list] of grid) {
    const [gx, gz] = key.split(',').map(Number)
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const s = tris[list[i]], t = tris[list[j]]
      const x0 = Math.max(s.minX, t.minX), z0 = Math.max(s.minZ, t.minZ)
      if (x0 >= Math.min(s.maxX, t.maxX) || z0 >= Math.min(s.maxZ, t.maxZ)) continue

      if (Math.floor(x0 / CELL) !== gx || Math.floor(z0 / CELL) !== gz) continue
      let poly = plan(s)
      const other = plan(t)
      for (let k = 0; k < 3 && poly.length >= 3; k++) poly = clip(poly, other[k], other[(k + 1) % 3])
      if (poly.length < 3 || Math.abs(area(poly)) < 1e-4) continue
      const mx = poly.reduce((sum, p) => sum + p[0], 0) / poly.length, mz = poly.reduce((sum, p) => sum + p[1], 0) / poly.length
      const gap = Math.abs(heightAt(s, mx, mz) - heightAt(t, mx, mz))
      if (gap >= 0.5) continue
      if (gap < 0.03) zfight++; else stacked++
      if (examples.length < 12) examples.push(`chunk ${cx},${cz} em (${(cx * CHUNK_SIZE + mx).toFixed(1)}, ${(cz * CHUNK_SIZE + mz).toFixed(1)}): ${Math.abs(area(poly)).toFixed(4)} m², Δy ${(gap * 100).toFixed(1)} cm, camadas ${s.slot}/${t.slot}`)
      if (verbose && examples.length <= 3) for (const tri of [s, t]) console.log('    ', tri.p.map(([x, y, z]) => `(${(cx * CHUNK_SIZE + x).toFixed(3)}, ${y.toFixed(3)}, ${(cz * CHUNK_SIZE + z).toFixed(3)})`).join(' '))
    }
  }
}
for (const line of examples) console.log('  ·', line)
console.log(`${chunks} chunks · ${triangles} triângulos de pavimento · ${zfight} z-fight · ${stacked} sobrepostos/atravessando`)
if (zfight || stacked) process.exitCode = 1
