import { ASSETS } from '../lib/game/blockout/catalog'
import { BLUEPRINTS } from '../lib/game/blockout/blueprints'
import { buildAsset } from '../lib/game/blockout/model'
import { buildStructure } from '../lib/game/blockout/assemble'
import { compileGeometry, auditGeometry, partGeometry } from '../lib/game/blockout/geometry'
import { reliefGeometry } from '../lib/game/blockout/relief-geometry'
import { textureOrigin } from '../lib/game/blockout/surfaces'
import { MODULE_TRIANGLE_BUDGET, partBounds, type BlockModel } from '../lib/game/blockout/types'

const failures: string[] = [], heavy: [string, number][] = []
let relieved = 0
function audit(model: BlockModel, budget: number) {
  for (const part of model.parts) {
    if (!reliefGeometry(part, textureOrigin(part))) continue
    relieved++
    const geometry = partGeometry(part), bounds = partBounds(part), p = geometry.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      const v = [p.getX(i), p.getY(i), p.getZ(i)]
      if (v.some((x, k) => x < bounds.min[k] - 1e-4 || x > bounds.max[k] + 1e-4)) { failures.push(`${part.id}: fora do volume`); break }
    }
    const issues = auditGeometry(geometry)
    if (issues.length) failures.push(`${part.id} (${part.material}/${part.role}): ${issues.join(' ')}`)
    geometry.dispose()
  }
  let triangles = 0
  for (const { geometry } of compileGeometry(model.parts)) { triangles += geometry.getIndex()!.count / 3; geometry.dispose() }
  heavy.push([model.id, triangles])
  if (triangles > budget) failures.push(`${model.id}: ${triangles} triângulos`)
}

const started = Date.now()
for (const spec of ASSETS) audit(buildAsset(spec), MODULE_TRIANGLE_BUDGET)
const moduleTime = Date.now() - started
const structures = process.argv.includes('--all') ? BLUEPRINTS : BLUEPRINTS.slice(0, 12)
for (const blueprint of structures) audit(buildStructure(blueprint, 2049, { condition: 'weathered' }), Infinity)
heavy.sort((a, b) => b[1] - a[1])
console.info(`partes com relevo: ${relieved} | falhas: ${failures.length} | módulos em ${moduleTime} ms`)
console.info([...new Set(failures)].slice(0, 30).join('\n'))
console.info(`mais pesados: ${heavy.slice(0, 10).map(([id, t]) => `${id}:${t}`).join(' | ')}`)
if (failures.length) process.exitCode = 1
