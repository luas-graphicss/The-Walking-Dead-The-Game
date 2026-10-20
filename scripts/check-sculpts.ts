import { ASSETS } from '../lib/game/blockout/catalog'
import { MODULE_TRIANGLE_BUDGET } from '../lib/game/blockout/types'
import { SCULPTORS, sculptData } from '../lib/game/blockout/sculpt'
import { RESOURCE_ASSETS } from '../lib/game/resources/sculpts'

const verbose = process.argv.includes('--verbose')
const filter = process.argv.find((arg) => arg.startsWith('--family='))?.slice(9)
let failures = 0, modelled = 0, triangles = 0
const missing = new Set<string>()
const started = performance.now()
for (const spec of process.argv.includes('--resources') ? RESOURCE_ASSETS : [...ASSETS, ...RESOURCE_ASSETS]) {
  if (filter && spec.family !== filter) continue
  if (!SCULPTORS[spec.family]) { missing.add(spec.family); continue }
  const t0 = performance.now()
  const data = sculptData(spec.id)!
  const ms = performance.now() - t0
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  let tris = 0
  const issues: string[] = []
  for (const bucket of data) {
    tris += bucket.index.length / 3
    for (let i = 0; i < bucket.position.length; i++) if (!Number.isFinite(bucket.position[i]) || !Number.isFinite(bucket.normal[i])) { issues.push(`${bucket.material}: valor não finito`); break }
    for (let i = 0; i < bucket.position.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], bucket.position[i + a]); max[a] = Math.max(max[a], bucket.position[i + a]) }
    for (let i = 0; i < bucket.normal.length; i += 3) if (Math.abs(Math.hypot(bucket.normal[i], bucket.normal[i + 1], bucket.normal[i + 2]) - 1) > 0.01) { issues.push(`${bucket.material}: normal não unitária`); break }
    const vertices = bucket.position.length / 3
    for (const index of bucket.index) if (index >= vertices) { issues.push(`${bucket.material}: índice fora da malha`); break }
  }
  if (tris > MODULE_TRIANGLE_BUDGET) issues.push(`${tris} triângulos > orçamento`)
  if (min[1] < -0.012) issues.push(`abaixo do piso ${min[1].toFixed(3)}`)
  const [w, h, d] = spec.size
  const over = [max[0] - w / 2, -min[0] - w / 2, max[2] - d / 2, -min[2] - d / 2].map((v) => Math.max(0, v))

  if (Math.max(...over) > 0.08) issues.push(`excede a planta em ${(Math.max(...over) * 100).toFixed(1)} cm`)

  if (max[1] - h > (spec.family === 'stairs' ? 1 : 0.3)) issues.push(`excede a altura em ${((max[1] - h) * 100).toFixed(1)} cm`)
  modelled++; triangles += tris
  if (issues.length) {
    failures++; console.log(`✗ ${spec.id}: ${issues.join('; ')}`)
    if (process.argv.includes('--bounds')) for (const bucket of data) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < bucket.position.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], bucket.position[i + a]); hi[a] = Math.max(hi[a], bucket.position[i + a]) }
      console.log(`    ${bucket.material.padEnd(9)} x ${lo[0].toFixed(3)}..${hi[0].toFixed(3)}  y ${lo[1].toFixed(3)}..${hi[1].toFixed(3)}  z ${lo[2].toFixed(3)}..${hi[2].toFixed(3)}  (spec ${w}×${h}×${d})`)
    }
  }
  else if (verbose) console.log(`✓ ${spec.id}: ${tris} tris, ${data.length} materiais, ${ms.toFixed(1)} ms`)
}
console.log(`\n${modelled} módulos esculpidos · ${triangles.toLocaleString('pt-BR')} triângulos · ${failures} com problemas · ${((performance.now() - started) / 1000).toFixed(1)} s`)
if (missing.size) console.log(`Famílias ainda sem escultura (${missing.size}): ${[...missing].join(', ')}`)
if (failures) process.exitCode = 1
