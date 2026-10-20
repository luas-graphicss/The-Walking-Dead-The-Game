import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS, CONTAINER_LABELS, RARITY_LABELS, SHAPE_LABELS, SITE_LABELS, USE_LABELS, type Resource, type SiteTag } from '@/lib/game/resources/types'

const tier = (value: number) => (value >= 0.8 ? 'Principal' : value >= 0.3 ? 'Secundária' : 'Exceção rara')

export function ResourceSheet({ resource }: { resource: Resource }) {
  const sites = (Object.entries(resource.sites) as [SiteTag | '*', number][]).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1])
  const { model } = resource
  return <>
    <section className="lab-inspector-section" aria-labelledby="resource-sheet">
      <h3 id="resource-sheet" className="lab-section-label">Ficha do recurso</h3>
      <dl className="lab-measurements">
        <div><dt>Categoria</dt><dd>{CATEGORY_LABELS[resource.category]}</dd></div>
        <div><dt>Raridade</dt><dd>{RARITY_LABELS[resource.rarity]}</dd></div>
        <div><dt>Peso unitário</dt><dd>{resource.weight.toLocaleString('pt-BR')} kg</dd></div>
        <div><dt>Por achado</dt><dd>{resource.quantity[0] === resource.quantity[1] ? resource.quantity[0] : `${resource.quantity[0]}–${resource.quantity[1]}`}</dd></div>
        <div><dt>Pilha máxima</dt><dd>{resource.stack}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2" aria-label="Usos na fabricação">{resource.uses.map((use) => <Badge key={use} variant="outline">{USE_LABELS[use]}</Badge>)}</div>
    </section>
    <section className="lab-inspector-section" aria-labelledby="resource-origin">
      <h3 id="resource-origin" className="lab-section-label">Onde nasce</h3>
      <div className="flex flex-wrap gap-2" aria-label="Recipientes">{resource.containers.map((container) => <Badge key={container}>{CONTAINER_LABELS[container]}</Badge>)}</div>
      <ul className="lab-audit-list" aria-label="Estruturas de origem">{sites.map(([tag, value]) => <li key={tag}><span>{tag === '*' ? 'Qualquer estrutura' : SITE_LABELS[tag]}</span><span>{tier(value)}</span></li>)}</ul>
      <p className="text-sm leading-relaxed text-muted-foreground">Só aparece nesses recipientes e nessas estruturas. Exceções raras seguem casos reais, como analgésicos no armário do banheiro de uma casa.</p>
    </section>
    <section className="lab-inspector-section" aria-labelledby="resource-model">
      <h3 id="resource-model" className="lab-section-label">Modelo 3D</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{model.status === 'pronto' ? `Usa o módulo esculpido e texturizado “${model.family}” do kit.` : `Blocagem de ${SHAPE_LABELS[model.shape]} com ${model.size.map((n) => n.toLocaleString('pt-BR')).join(' × ')} m. Pendente de modelagem e textura.`}</p>
    </section>
  </>
}
