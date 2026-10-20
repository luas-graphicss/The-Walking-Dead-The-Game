import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BLOCK_MATERIALS } from '../lib/game/blockout/types'
import { PENDING_RESOURCES, RESOURCES } from '../lib/game/resources/catalog'
import { CATEGORY_LABELS, CONTAINER_LABELS, RARITY_LABELS, SHAPE_LABELS, SITE_LABELS, type Resource, type ResourceCategory, type SiteTag } from '../lib/game/resources/types'

const decimal = (n: number) => n.toLocaleString('pt-BR')
const mainSites = (resource: Resource) => (Object.entries(resource.sites) as [SiteTag | '*', number][]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag]) => (tag === '*' ? 'qualquer estrutura' : SITE_LABELS[tag])).join(', ')
const categories = Object.keys(CATEGORY_LABELS) as ResourceCategory[]

const lines = [
  '# Recursos: blocagens pendentes de modelagem e textura',
  '',
  'Gerado por `pnpm resources:list` a partir de `lib/game/resources/catalog.ts`. Não edite à mão: altere o catálogo e gere de novo.',
  '',
  `- **${RESOURCES.length}** recursos no catálogo`,
  `- **${RESOURCES.length - PENDING_RESOURCES.length}** já usam um módulo esculpido e texturizado do kit`,
  `- **${PENDING_RESOURCES.length}** têm só a blocagem primitiva e aguardam modelagem e textura`,
  '',
  'As dimensões são largura × altura × profundidade, em metros, com o item apoiado no chão. Cada blocagem pode ser inspecionada em `/blockout?kind=resource&asset=<id>`.',
  '',
  '## Pendentes por categoria',
]
for (const category of categories) {
  const pending = PENDING_RESOURCES.filter((resource) => resource.category === category)
  if (!pending.length) continue
  lines.push('', `### ${CATEGORY_LABELS[category]} (${pending.length})`, '', '| ID | Recurso | Forma | Dimensões (m) | Material base | Raridade | Recipientes | Origem principal |', '| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const resource of pending) {
    if (resource.model.status !== 'pendente') continue
    const { shape, size, material } = resource.model
    lines.push(`| \`${resource.id}\` | ${resource.label} | ${SHAPE_LABELS[shape]} | ${size.map(decimal).join(' × ')} | ${BLOCK_MATERIALS[material].label} | ${RARITY_LABELS[resource.rarity]} | ${resource.containers.map((c) => CONTAINER_LABELS[c]).join(', ')} | ${mainSites(resource)} |`)
  }
}
lines.push('', '## Já cobertos por módulos prontos do kit', '', '| Módulo | Recursos |', '| --- | --- |')
const ready = new Map<string, string[]>()
for (const resource of RESOURCES) if (resource.model.status === 'pronto') ready.set(resource.model.family, [...(ready.get(resource.model.family) ?? []), resource.label])
for (const [family, labels] of ready) lines.push(`| \`${family}\` | ${labels.join(', ')} |`)
lines.push('')

async function main() {
  const file = path.join(process.cwd(), 'docs/recursos-pendentes.md')
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, lines.join('\n'))
  console.info(`${PENDING_RESOURCES.length} blocagens pendentes de ${RESOURCES.length} recursos → docs/recursos-pendentes.md`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
