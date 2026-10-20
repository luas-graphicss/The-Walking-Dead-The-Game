'use client'

import { useMemo, useState } from 'react'
import { Armchair, Boxes, BrickWall, Building2, ChevronRight, PackageOpen, Sprout, Warehouse } from 'lucide-react'
import { ASSETS } from '@/lib/game/blockout/catalog'
import { BLUEPRINTS } from '@/lib/game/blockout/blueprints'
import { hasSculpt } from '@/lib/game/blockout/sculpt'
import { RESOURCES } from '@/lib/game/resources/catalog'
import { CATEGORY_LABELS } from '@/lib/game/resources/types'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type CatalogKind = 'structure' | 'asset' | 'resource'
type Props = { kind: CatalogKind; selected: string; onKind: (kind: CatalogKind) => void; onSelect: (id: string) => void }
type Entry = { id: string; label: string; category: string; pending?: boolean }
const RESOURCE_ENTRIES: Entry[] = RESOURCES.map((resource) => ({ id: resource.id, label: resource.label, category: CATEGORY_LABELS[resource.category], pending: resource.model.status === 'pendente' }))
const NOUNS: Record<CatalogKind, [string, string]> = { structure: ['estruturas', 'Estruturas disponíveis'], asset: ['módulos', 'Módulos disponíveis'], resource: ['recursos', 'Recursos disponíveis'] }
const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const categoryIcon = (category: string) => category === 'Residências' ? Building2 : category === 'Arquitetura' ? BrickWall : category === 'Mobiliário' ? Armchair : category === 'Fazendas' || category === 'Rural' ? Sprout : category === 'Recursos' ? PackageOpen : category === 'Comércios' || category === 'Comércio' ? Warehouse : Boxes

export function BlockoutCatalog({ kind, selected, onKind, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const entries: Entry[] = kind === 'structure' ? BLUEPRINTS : kind === 'resource' ? RESOURCE_ENTRIES : ASSETS
  const categories = [{ value: 'all', label: 'Todas as categorias' }, ...[...new Set(entries.map((entry) => entry.category))].map((value) => ({ value, label: value }))]
  const results = useMemo(() => entries.filter((entry) => (category === 'all' || category === entry.category) && normalized(`${entry.label} ${entry.id} ${entry.category}`).includes(normalized(query))), [entries, category, query])
  const list = (
    <div className="lab-catalog-body">
      <div className="lab-catalog-filters">
        <Field><FieldLabel className="sr-only" htmlFor="asset-search">Buscar no catálogo</FieldLabel><Input id="asset-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no catálogo…" autoComplete="off" /></Field>
        <Field><FieldLabel className="sr-only" htmlFor="asset-category">Categoria</FieldLabel><Select items={categories} value={category} onValueChange={(value) => setCategory(value ?? 'all')}><SelectTrigger id="asset-category" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{categories.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
      </div>
      <div className="lab-list-caption"><span>{results.length} {NOUNS[kind][0]}</span><span>METROS / 1:1</span></div>
      <ul className="lab-catalog-list" aria-label={NOUNS[kind][1]}>
        {results.map((entry) => {
          const Icon = kind === 'resource' ? PackageOpen : categoryIcon(entry.category)
          const status = kind === 'resource' ? (entry.pending ? <span> · Blocagem pendente</span> : <span className="text-primary"> · Modelo 3D</span>) : kind === 'asset' && hasSculpt(entry.id) && <span className="text-primary"> · Modelo 3D</span>
          return <li key={entry.id}><button type="button" className={cn('lab-catalog-item', entry.id === selected && 'is-selected')} aria-pressed={entry.id === selected} onClick={() => onSelect(entry.id)}><span className="lab-catalog-icon"><Icon size={20} aria-hidden="true" /></span><span className="lab-catalog-item-copy"><span>{entry.label}</span><span>{entry.category}{status}</span></span>{entry.id === selected && <ChevronRight size={16} aria-hidden="true" />}</button></li>
        })}
      </ul>
      {!results.length && <p className="lab-no-results" role="status">Nenhum modelo encontrado. Tente outra busca ou categoria.</p>}
    </div>
  )
  return <aside className="lab-catalog" aria-label="Biblioteca de blocagem"><div className="lab-panel-heading"><h2 className="font-heading text-xl uppercase tracking-wider">Biblioteca</h2><span className="text-sm text-muted-foreground">v4.0 PBR</span></div><Tabs value={kind} onValueChange={(value) => { setQuery(''); setCategory('all'); onKind(value as CatalogKind) }} className="lab-catalog-tabs"><div className="lab-tabs-wrap"><TabsList className="h-auto w-full">{([['structure', 'Estruturas', BLUEPRINTS.length], ['asset', 'Módulos', ASSETS.length], ['resource', 'Recursos', RESOURCES.length]] as const).map(([value, label, count]) => <TabsTrigger key={value} value={value} className="min-w-0 flex-col gap-0 py-1 leading-tight">{label} <span className="text-xs">{count}</span></TabsTrigger>)}</TabsList></div><TabsContent value="structure" className="min-h-0">{kind === 'structure' && list}</TabsContent><TabsContent value="asset" className="min-h-0">{kind === 'asset' && list}</TabsContent><TabsContent value="resource" className="min-h-0">{kind === 'resource' && list}</TabsContent></Tabs></aside>
}
