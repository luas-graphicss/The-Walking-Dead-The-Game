import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildStructure } from '../lib/game/blockout/assemble'
import { architectureFor, planCells } from '../lib/game/blockout/architecture'
import { BLUEPRINTS } from '../lib/game/blockout/blueprints'
import { assetFor } from '../lib/game/blockout/catalog'
import { buildAsset } from '../lib/game/blockout/model'
import { modelBounds, partBounds, type Condition } from '../lib/game/blockout/types'

type Entry = {
  nx: number; nz: number; cells: [number, number][]; bay: [number, number]; bayMin: [number, number]

  ext: [number, number, number, number]
  eave: number; ridge: number; floors: number; pitched: boolean

  fixed?: [number, number, number, number]
}

const SAMPLES: [number, Condition][] = [[11, 'weathered'], [2049, 'weathered'], [7717, 'weathered'], [431, 'damaged']]
const round = (value: number) => Math.round(value * 100) / 100
const table: Record<string, Entry> = {}
const started = performance.now()

for (const blueprint of BLUEPRINTS) {
  const t0 = performance.now()
  let ext: [number, number, number, number] = [0, 0, 0, 0]
  let eave = 0, ridge = 0
  let fixed: Entry['fixed']
  const profile = architectureFor(blueprint)
  const cells = planCells(profile)
  const nx = Math.max(...profile.plan.map((row) => row.length)), nz = profile.plan.length
  const signature = modelBounds(buildAsset(assetFor(profile.specialty, 1)))
  const bayMin: [number, number] = [2 * (signature.size[0] + 0.74), 2 * (signature.size[2] + 0.74)]
  for (const [seed, condition] of SAMPLES) {
    const model = buildStructure(blueprint, seed, { condition })
    const bounds = modelBounds(model)
    if (blueprint.layout === 'compound') {
      fixed = fixed
        ? [Math.min(fixed[0], bounds.min[0]), Math.max(fixed[1], bounds.max[0]), Math.min(fixed[2], bounds.min[2]), Math.max(fixed[3], bounds.max[2])]
        : [bounds.min[0], bounds.max[0], bounds.min[2], bounds.max[2]]
    } else {
      const foundations = model.parts.filter((part) => part.id.includes('footprint-foundation'))
      const cellMinX = Math.min(...foundations.map((part) => partBounds(part).min[0])), cellMaxX = Math.max(...foundations.map((part) => partBounds(part).max[0]))
      const cellMinZ = Math.min(...foundations.map((part) => partBounds(part).min[2])), cellMaxZ = Math.max(...foundations.map((part) => partBounds(part).max[2]))
      ext = [
        Math.max(ext[0], cellMinX - bounds.min[0]), Math.max(ext[1], bounds.max[0] - cellMaxX),
        Math.max(ext[2], cellMinZ - bounds.min[2]), Math.max(ext[3], bounds.max[2] - cellMaxZ),
      ]
    }
    if (condition === 'weathered') {
      for (const part of model.parts) {
        const top = partBounds(part).max[1]
        if (part.role === 'wall' && part.id.includes('exterior-wall')) eave = Math.max(eave, top)
        if (part.role === 'roof') ridge = Math.max(ridge, top)
      }
    }
  }
  if (!eave) eave = 3.2 * blueprint.floors
  if (!ridge) ridge = eave + 0.3
  table[blueprint.id] = {
    nx, nz, cells: cells.map((cell) => [cell.x, cell.z]), bay: [round(profile.bay[0]), round(profile.bay[1])], bayMin: [round(bayMin[0]), round(bayMin[1])],
    ext: ext.map((value) => round(Math.min(value, 14))) as Entry['ext'], eave: round(eave), ridge: round(ridge), floors: blueprint.floors, pitched: ridge - eave > 0.6,
    ...(fixed ? { fixed: fixed.map(round) as Entry['fixed'] } : {}),
  }
  console.log(`${blueprint.id.padEnd(22)} ${(performance.now() - t0).toFixed(0).padStart(5)} ms  ext ${table[blueprint.id].ext.join(' ')}  eave ${table[blueprint.id].eave} ridge ${table[blueprint.id].ridge}`)
}

writeFileSync(join(process.cwd(), 'lib/game/world/footprints.generated.json'), `${JSON.stringify(table)}\n`)
console.log(`${Object.keys(table).length} blueprints in ${((performance.now() - started) / 1000).toFixed(1)} s`)
