import { BLUEPRINTS } from '../lib/game/blockout/blueprints'
import { buildStructure } from '../lib/game/blockout/assemble'
import { validateModel } from '../lib/game/blockout/validation'
import { CONDITIONS } from '../lib/game/blockout/types'

const only = process.argv[2]?.split(',').filter((id) => id && id !== 'all')
const conditions = process.argv[3]?.split(',').filter((id) => id && id !== 'all')
const seeds = (process.argv[4] ?? '1,2049,8675309').split(',').map(Number)
let failures = 0, total = 0, triangles = 0
const counts = new Map<string, number>()
for (const blueprint of BLUEPRINTS) {
  if (only?.length && !only.includes(blueprint.id)) continue
  for (const condition of CONDITIONS) {
    if (conditions?.length && !conditions.includes(condition.value)) continue
    for (const seed of seeds) {
      total++
      let model
      try { model = buildStructure(blueprint, seed, { condition: condition.value }) } catch (error) { failures++; console.log(`THROW ${blueprint.id}/${condition.value}/${seed}: ${(error as Error).stack?.split('\n').slice(0, 4).join(' | ')}`); continue }
      const report = validateModel(model)
      triangles = Math.max(triangles, report.triangles)
      if (!report.passed) {
        failures++
        for (const issue of report.issues) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1)
        console.log(`${model.id} parts=${report.parts} tris=${report.triangles}`)
        for (const issue of report.issues.slice(0, 6)) console.log(`   ${issue.code}: ${issue.part.split('/').slice(-2).join('/')} / ${(issue.other ?? '').split('/').slice(-2).join('/')} ${issue.message}`)
      }
    }
  }
}
console.log(`\n${failures}/${total} falharam · pico ${triangles} triângulos`, Object.fromEntries(counts))
