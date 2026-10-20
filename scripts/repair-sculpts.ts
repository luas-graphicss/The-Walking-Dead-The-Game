import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Matrix4, Vector3 } from 'three'
import { ASSETS } from '../lib/game/blockout/catalog'
import { SCULPTORS } from '../lib/game/blockout/sculpt'
import { REPAIRS, type Repair, type V3 } from '../lib/game/blockout/sculpt/kit'
import { auditSpec, bvhOf, type Built, type Findings } from './audit-sculpts'

type Fix = { sig: V3; offset: V3; drop: boolean }
const args = process.argv.slice(2)
const list = args.find((a) => a.startsWith('--families='))?.slice(11).split(',')
const shard = args.find((a) => a.startsWith('--shard='))?.slice(8).split('/').map(Number)
const target = path.join(process.cwd(), 'lib/game/blockout/sculpt/repairs.generated.json')
const out = args.find((a) => a.startsWith('--out='))?.slice(6) ?? target
const identity = new Matrix4()
const round4 = (x: number) => Math.round(x * 1e4) / 1e4

function serialize(fixes: Map<number, Fix>): Repair[] {
  return [...fixes.entries()].filter(([, f]) => f.drop || f.offset.some((x) => Math.abs(x) > 1e-5)).sort((a, b) => a[0] - b[0])
    .map(([index, f]) => (f.drop ? [index, ...f.sig.map(round4)] : [index, ...f.sig.map(round4), ...f.offset.map(round4)]))
}

function extent(b: Built, axis: Vector3, near?: Built): [number, number] {
  const pos = b.geometry.getAttribute('position'), v = new Vector3()
  const u = (Math.abs(axis.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)).cross(axis).normalize(), w = axis.clone().cross(u)
  let box: [number, number, number, number] | null = null
  if (near) {
    const np = near.geometry.getAttribute('position')
    box = [Infinity, -Infinity, Infinity, -Infinity]
    for (let i = 0; i < np.count; i++) { v.fromBufferAttribute(np, i); const a = v.dot(u), c = v.dot(w); box[0] = Math.min(box[0], a); box[1] = Math.max(box[1], a); box[2] = Math.min(box[2], c); box[3] = Math.max(box[3], c) }
  }
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    if (box) { const a = v.dot(u), c = v.dot(w); if (a < box[0] - 0.01 || a > box[1] + 0.01 || c < box[2] - 0.01 || c > box[3] + 0.01) continue }
    const t = v.dot(axis); lo = Math.min(lo, t); hi = Math.max(hi, t)
  }
  return Number.isFinite(lo) ? [lo, hi] : extent(b, axis)
}

function plan(built: Built[], f: Findings, fixes: Map<number, Fix>): number {
  const touched = new Set<number>()
  const volume = (i: number) => { const p = built[i].piece; return Math.max(1e-9, (p.max[0] - p.min[0]) * (p.max[1] - p.min[1]) * (p.max[2] - p.min[2])) }
  const fixOf = (i: number) => {
    const p = built[i].piece
    let fix = fixes.get(p.index)
    if (!fix) { fix = { sig: [0, 1, 2].map((a) => (p.min[a] + p.max[a]) / 2) as V3, offset: [0, 0, 0], drop: false }; fixes.set(p.index, fix) }
    return fix
  }
  const move = (i: number, d: V3) => { const fix = fixOf(i); for (let a = 0; a < 3; a++) fix.offset[a] += d[a]; touched.add(i) }
  const drop = (i: number) => { fixOf(i).drop = true; touched.add(i) }

  for (const [, b] of f.duplicate) if (!touched.has(b)) drop(b)
  for (const i of f.sink) if (!touched.has(i)) move(i, [0, -built[i].piece.min[1], 0])
  for (const { a, b, n } of f.zfight) {
    if (touched.has(a) || touched.has(b)) continue
    move(volume(a) <= volume(b) ? a : b, [n[0] * 0.0015, n[1] * 0.0015, n[2] * 0.0015])
  }
  for (const { rod, slab, T } of f.pierce) {
    if (touched.has(rod) || touched.has(slab)) continue
    const t = new Vector3(...T), [r0, r1] = extent(built[rod], t), [s0, s1] = extent(built[slab], t, built[rod]), vr = volume(rod), vs = volume(slab)
    const options = [{ i: rod, s: s1 - r0 + 0.0005 }, { i: rod, s: s0 - r1 - 0.0005 }, { i: slab, s: r1 - s0 + 0.0005 }, { i: slab, s: r0 - s1 - 0.0005 }]
      .filter((o) => volume(o.i) <= 4 * (o.i === rod ? vs : vr) || Math.abs(o.s) < 0.003)
      .sort((x, y) => Math.abs(x.s) - Math.abs(y.s))
    const best = options[0]
    if (best && Math.abs(best.s) <= 0.08) move(best.i, [t.x * best.s, t.y * best.s, t.z * best.s])
    else if (Math.min(vr, vs) < 0.05 * Math.max(vr, vs)) drop(vr < vs ? rod : slab)
  }
  const t1 = { point: new Vector3(), distance: 0, faceIndex: 0 }, t2 = { point: new Vector3(), distance: 0, faceIndex: 0 }
  for (const group of f.floating) {
    if (group.some((i) => touched.has(i))) continue
    let best = { d: Infinity, delta: [0, 0, 0] as V3 }
    for (const gi of group) {
      const g = built[gi].piece
      for (const ci of f.grounded) {
        const c = built[ci].piece
        const gap = Math.max(0, ...[0, 1, 2].map((a) => Math.max(c.min[a] - g.max[a], g.min[a] - c.max[a])))
        if (gap > 0.25 || gap >= best.d) continue
        const hit = bvhOf(built[ci]).closestPointToGeometry(built[gi].geometry, identity, t1, t2, 0, 0.25)
        if (hit && t1.distance < best.d) best = { d: t1.distance, delta: [t1.point.x - t2.point.x, t1.point.y - t2.point.y, t1.point.z - t2.point.z] }
      }
    }
    const floor = Math.min(...group.map((i) => built[i].piece.min[1]))
    if (floor <= 0.25 && floor < best.d) best = { d: floor, delta: [0, -floor, 0] }
    if (!Number.isFinite(best.d)) continue
    const scale = best.d > 1e-6 ? Math.max(0, best.d - 0.0005) / best.d : 0
    for (const i of group) move(i, [best.delta[0] * scale, best.delta[1] * scale, best.delta[2] * scale])
  }
  return touched.size
}

const problems = (f: Findings) => f.floating.length + f.zfight.length + f.duplicate.length + f.pierce.length + f.sink.length

async function main() {
  const started = performance.now()
  const result: Record<string, Repair[]> = JSON.parse(await readFile(target, 'utf8'))
  const specs = ASSETS.filter((spec) => SCULPTORS[spec.family] && (!list || list.includes(spec.family))).filter((_, i) => !shard || i % shard[1] === shard[0])
  let repaired = 0, clean = 0, stubborn = 0
  for (const spec of specs) {
    delete REPAIRS[spec.id]
    const fixes = new Map<number, Fix>()
    let left = 0
    for (let round = 0; round < 8; round++) {
      REPAIRS[spec.id] = serialize(fixes)
      let changes = 0
      left = 0
      auditSpec(spec, (built, findings) => { left = problems(findings); if (left) changes = plan(built, findings, fixes) })
      if (!left || !changes) break
    }
    const fixesOut = serialize(fixes)
    if (fixesOut.length) { result[spec.id] = fixesOut; REPAIRS[spec.id] = fixesOut; repaired++ } else { delete result[spec.id]; delete REPAIRS[spec.id] }
    if (left) {

      auditSpec(spec, (_, findings) => { left = problems(findings) })
    }
    if (left) { stubborn++; console.log(`… ${spec.id}: ${left} problema(s) restante(s) após ${fixesOut.length} correção(ões)`) } else clean++
  }
  await writeFile(out, JSON.stringify(result))
  console.log(`\n${specs.length} módulos · ${repaired} com correções · ${clean} limpos · ${stubborn} pendentes · ${((performance.now() - started) / 1000).toFixed(0)} s`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
