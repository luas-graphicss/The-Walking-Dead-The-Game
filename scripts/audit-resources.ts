import { auditSpec } from './audit-sculpts'
import { RESOURCE_BY_ID } from '../lib/game/resources/catalog'
import { RESOURCE_ASSETS } from '../lib/game/resources/sculpts'

const args = process.argv.slice(2)
const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const ids = value('ids')?.split(',')
const category = value('category')
let failing = 0, audited = 0, triangles = 0
const started = performance.now()
for (const spec of RESOURCE_ASSETS) {
  const id = spec.id.slice('resource-'.length), resource = RESOURCE_BY_ID.get(id)!
  if (ids && !ids.includes(id)) continue
  if (category && resource.category !== category) continue
  const t0 = performance.now(), result = auditSpec(spec), ms = performance.now() - t0
  audited++; triangles += result.triangles
  if (result.issues.length) {
    failing++
    console.log(`✗ ${id} (${result.pieces} peças, ${result.triangles} tris, ${ms.toFixed(0)} ms)`)
    for (const issue of result.issues.slice(0, 6)) console.log(`    · ${issue.kind}: ${issue.detail}`)
  } else if (!args.includes('--quiet')) console.log(`✓ ${id} (${result.pieces} peças, ${result.triangles} tris, ${ms.toFixed(0)} ms)`)
}
console.log(`\n${audited} recursos auditados · ${failing} com problemas · ${triangles.toLocaleString('pt-BR')} triângulos · ${((performance.now() - started) / 1000).toFixed(1)} s`)
if (failing) process.exitCode = 1
