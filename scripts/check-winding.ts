import { Kit } from '../lib/game/blockout/sculpt/kit'
import { RESOURCE_ASSETS, RESOURCE_FAMILIES } from '../lib/game/resources/sculpts'

const ids = process.argv.find((a) => a.startsWith('--ids='))?.slice(6).split(',')
let bad = 0
for (const spec of RESOURCE_ASSETS) {
  if (ids && !ids.includes(spec.id.slice('resource-'.length))) continue
  Kit.record = true
  const kit = new Kit(spec.id, spec.size, spec.variant)
  RESOURCE_FAMILIES[spec.family](kit, spec as never)
  Kit.record = false
  kit.pieces.forEach((p, n) => {
    const b = kit.buckets.get(p.material)!
    let vol = 0, area = 0
    for (let i = p.istart; i < p.istart + p.icount; i += 3) {
      const [a, c, d] = [0, 1, 2].map((k) => b.i[i + k] * 3)
      const ax = b.p[a], ay = b.p[a + 1], az = b.p[a + 2], bx = b.p[c], by = b.p[c + 1], bz = b.p[c + 2], cx = b.p[d], cy = b.p[d + 1], cz = b.p[d + 2]
      vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
      area += Math.hypot((by - ay) * (cz - az) - (bz - az) * (cy - ay), (bz - az) * (cx - ax) - (bx - ax) * (cz - az), (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2
    }

    const scale = Math.max(...[0, 1, 2].map((a) => p.max[a] - p.min[a]))
    if (vol < -1e-9 && -vol > area * scale * 0.002) { bad++; console.log(`✗ ${spec.id.slice(9)} peça ${n} (${p.material}) volume ${(vol * 1e6).toFixed(2)} cm³`) }
  })
}
console.log(bad ? `${bad} peças do avesso` : 'nenhuma peça do avesso')
if (bad) process.exitCode = 1
