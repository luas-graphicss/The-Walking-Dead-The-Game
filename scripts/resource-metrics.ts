import { writeFile } from 'node:fs/promises'
import { Kit } from '../lib/game/blockout/sculpt/kit'
import { RESOURCES } from '../lib/game/resources/catalog'
import { RESOURCE_SCULPTORS, resourceAssetId } from '../lib/game/resources/sculpts'

const args = process.argv.slice(2)
const jsonOut = args.find((a) => a.startsWith('--json='))?.slice(7)
const rows: { index: number; id: string; label: string; category: string; tris: number; pieces: number; materials: string[]; size: number[] }[] = []
RESOURCES.forEach((resource, index) => {
  const sculptor = RESOURCE_SCULPTORS[resource.id]
  if (!sculptor || resource.model.status === 'pronto') return
  Kit.record = true
  const kit = new Kit(resourceAssetId(resource.id), resource.model.size, 0)
  sculptor(kit, resource)
  Kit.record = false
  const tris = kit.pieces.reduce((sum, piece) => sum + piece.icount / 3, 0)
  rows.push({ index, id: resource.id, label: resource.label, category: resource.category, tris, pieces: kit.pieces.length, materials: [...kit.buckets.keys()], size: resource.model.size })
})
for (const r of rows) console.log([r.index, r.category, r.id, r.tris, r.pieces, r.materials.join('+')].join('\t'))
console.log(`total ${RESOURCES.length} recursos, ${rows.length} esculpidos`)
if (jsonOut) writeFile(jsonOut, JSON.stringify(rows)).catch((error) => { console.error(error); process.exitCode = 1 })
