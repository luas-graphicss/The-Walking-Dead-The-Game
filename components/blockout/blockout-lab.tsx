'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Boxes, Check, ChevronLeft, Crosshair, Layers3, Maximize, MousePointer2, RotateCcw, Settings2, ShieldCheck, SquareArrowOutUpRight, View, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ASSET_BY_ID, ASSETS } from '@/lib/game/blockout/catalog'
import { BLUEPRINT_BY_ID, BLUEPRINTS } from '@/lib/game/blockout/blueprints'
import { buildAsset } from '@/lib/game/blockout/model'
import { hasSculpt } from '@/lib/game/blockout/sculpt'
import { buildStructure } from '@/lib/game/blockout/assemble'
import { CONDITIONS, type Condition, type LootSocket, type Vec3 } from '@/lib/game/blockout/types'
import { validateModel } from '@/lib/game/blockout/validation'
import type { GeometryStats } from '@/lib/game/blockout/geometry'
import { describeSocket } from '@/lib/game/blockout/loot'
import { RESOURCE_BY_ID, RESOURCES } from '@/lib/game/resources/catalog'
import { buildResourceModel } from '@/lib/game/resources/models'
import { cn } from '@/lib/utils'
import { BlockoutCatalog, type CatalogKind } from './blockout-catalog'
import { BlockoutInspector } from './blockout-inspector'
import { BlockoutScene, type CameraView, type DisplayOptions } from './blockout-scene'
import { emptyExploreInput, type ExploreInput } from './blockout-explorer'

type Props = { initialId: string; initialKind: CatalogKind; initialSeed: number; initialCondition?: Condition; initialBroken?: boolean }
const CATALOGS: Record<CatalogKind, { has: (id: string) => boolean; first: string; list: { id: string }[] }> = {
  structure: { has: (id) => BLUEPRINT_BY_ID.has(id), first: 'pharmacy', list: BLUEPRINTS },
  asset: { has: (id) => ASSET_BY_ID.has(id), first: ASSETS[0].id, list: ASSETS },
  resource: { has: (id) => RESOURCE_BY_ID.has(id), first: RESOURCES[0].id, list: RESOURCES },
}

export function BlockoutLab({ initialId, initialKind, initialSeed, initialCondition = 'damaged', initialBroken = false }: Props) {
  const [kind, setKind] = useState<CatalogKind>(initialKind)
  const [id, setId] = useState(CATALOGS[initialKind].has(initialId) ? initialId : CATALOGS[initialKind].first)
  const [seed, setSeed] = useState(initialSeed), [seedDraft, setSeedDraft] = useState(String(initialSeed))
  const [condition, setCondition] = useState<Condition>(initialCondition)
  const [options, setOptions] = useState<DisplayOptions>({ textured: true, cutaway: false, wireframe: false, sockets: false, colliders: false, blockout: false, broken: initialBroken, floor: 'all' })
  const [cameraView, setCameraView] = useState<CameraView>('perspective'), [cameraRevision, setCameraRevision] = useState(0)
  const [exploring, setExploring] = useState(false), [ready, setReady] = useState(false)
  const [position, setPosition] = useState<Vec3>([0, 0, 0])
  const [nearby, setNearby] = useState<LootSocket | null>(null), [selectedSocket, setSelectedSocket] = useState<LootSocket | null>(null)
  const [mobilePanel, setMobilePanel] = useState<'catalog' | 'inspector' | null>(null)
  const touch = useRef<ExploreInput>(emptyExploreInput())
  const model = useMemo(() => kind === 'structure' ? buildStructure(id, seed, { condition }) : kind === 'resource' ? buildResourceModel(id) : buildAsset(id), [kind, id, seed, condition])
  const report = useMemo(() => validateModel(model), [model])
  const currentIndex = CATALOGS[kind].list.findIndex((entry) => entry.id === id)
  const lootReport = selectedSocket ? describeSocket(selectedSocket, seed, model) : null
  const currentCondition = CONDITIONS.find((item) => item.value === condition)!
  const [geometryStats, setGeometryStats] = useState<GeometryStats | null>(null)
  const onReady = useCallback((stats: GeometryStats) => { setGeometryStats(stats); setReady(true) }, [])
  const onExit = useCallback(() => { setExploring(false); setNearby(null); touch.current = emptyExploreInput() }, [])
  const onInspect = useCallback((socket: LootSocket) => setSelectedSocket(socket), [])
  const changeOptions = useCallback((patch: Partial<DisplayOptions>) => setOptions((current) => ({ ...current, ...patch })), [])
  const select = (value: string) => { if (value === id) return; onExit(); setReady(false); setId(value); setSelectedSocket(null); changeOptions({ floor: 'all' }); setMobilePanel(null) }
  const changeKind = (value: CatalogKind) => { onExit(); setReady(false); setKind(value); setId(CATALOGS[value].first); setSelectedSocket(null); changeOptions({ floor: 'all', broken: false }) }
  const applySeed = (value: number) => { if (!Number.isFinite(value)) { setSeedDraft(String(seed)); return }; const next = Math.max(1, Math.min(2147483647, Math.trunc(value))); setSeedDraft(String(next)); if (next !== seed) { onExit(); setReady(false); setSeed(next); setSelectedSocket(null) } }
  const explore = () => { setMobilePanel(null); setSelectedSocket(null); changeOptions({ cutaway: false, wireframe: false, floor: 'all' }); setExploring(true) }

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('asset', id); url.searchParams.set('kind', kind); url.searchParams.set('seed', String(seed)); url.searchParams.set('condition', condition)
    if (kind === 'asset' && options.broken) url.searchParams.set('broken', '1'); else url.searchParams.delete('broken')
    window.history.replaceState(null, '', url)
  }, [id, kind, seed, condition, options.broken])

  const direction = (key: keyof ExploreInput, active: boolean) => { touch.current[key] = active }
  return <main className={cn('blockout-lab font-sans', exploring && 'is-exploring', mobilePanel === 'catalog' && 'show-catalog', mobilePanel === 'inspector' && 'show-inspector')} data-ready={ready} data-triangles={ready ? geometryStats?.triangles : undefined}>
    <header className="lab-header"><div className="lab-brand"><Link href="/" className="lab-back" aria-label="Voltar ao jogo"><ChevronLeft size={20} /></Link><span className="lab-brand-mark"><Boxes size={24} aria-hidden="true" /></span><div><p className="font-heading uppercase tracking-wider">The Walking Dead</p><p className="lab-brand-subtitle">OFICINA 3D / MATERIAIS PBR</p></div><Badge variant="outline">4.0 / PBR</Badge></div><div className="lab-header-actions"><a href="/models/blockout/manifest.json" download aria-label="Baixar manifest do kit" className={buttonVariants({ variant: 'ghost' })}><SquareArrowOutUpRight data-icon="inline-start" /><span className="hidden xl:inline">Manifest do kit</span></a><Link href="/" className={buttonVariants({ variant: 'outline' })}>Voltar ao mundo <ArrowRight data-icon="inline-end" /></Link></div></header>
    <div className="lab-mobile-nav"><Button variant="outline" onClick={() => setMobilePanel(mobilePanel === 'catalog' ? null : 'catalog')} aria-expanded={mobilePanel === 'catalog'}><Boxes data-icon="inline-start" /> Biblioteca</Button><Button variant="outline" onClick={() => setMobilePanel(mobilePanel === 'inspector' ? null : 'inspector')} aria-expanded={mobilePanel === 'inspector'}><Settings2 data-icon="inline-start" /> Inspeção</Button></div>
    <div className="lab-workspace">
      <BlockoutCatalog kind={kind} selected={id} onKind={changeKind} onSelect={select} />
      <section className="lab-stage" aria-label="Bancada de inspeção 3D">
        <div className="lab-stage-heading"><div className="flex flex-col gap-1"><p className="lab-section-label">{kind === 'structure' ? 'ESTRUTURA MONTADA' : kind === 'resource' ? 'RECURSO' : 'PEÇA MODULAR'} / {String(currentIndex + 1).padStart(3, '0')}</p><h1 className="font-heading text-3xl text-balance">{model.label}</h1></div><div className="lab-stage-status"><Badge variant="outline">{kind === 'structure' ? currentCondition.label : options.broken ? 'Versão quebrada' : 'Escala real'}</Badge><span className="flex items-center gap-2 text-sm text-muted-foreground"><span className="lab-status-dot" />{ready ? 'Cena pronta' : 'Carregando 3D'}</span></div></div>
        <div className="lab-viewport" data-testid="blockout-viewport">
          <BlockoutScene model={model} seed={seed} options={options} exploring={exploring} cameraView={cameraView} cameraRevision={cameraRevision} touch={touch} onExit={onExit} onReady={onReady} onPosition={setPosition} onNearby={setNearby} onInspect={onInspect} />
          {!ready && <div className="lab-loading" role="status">Preparando geometria e materiais…</div>}
          {!exploring && <><div className="lab-view-controls"><Button size="icon" variant="secondary" aria-label="Vista em perspectiva" title="Perspectiva" onClick={() => { setCameraView('perspective'); setCameraRevision((v) => v + 1) }}><View /></Button><Button size="icon" variant="secondary" aria-label="Vista de cima" title="Planta" onClick={() => { setCameraView('top'); setCameraRevision((v) => v + 1) }}><Layers3 /></Button><Button size="icon" variant="secondary" aria-label="Vista frontal" title="Fachada" onClick={() => { setCameraView('front'); setCameraRevision((v) => v + 1) }}><Maximize /></Button><Button size="icon" variant="secondary" aria-label="Centralizar modelo" title="Centralizar" onClick={() => setCameraRevision((v) => v + 1)}><Crosshair /></Button></div><div className="lab-scale"><span aria-hidden="true" /><span className="text-muted-foreground">Grade: 1 × 1 m</span></div><div className="lab-viewport-label"><span className="font-heading text-lg tracking-wider">{kind === 'structure' ? 'ARQUIVO DE ESTRUTURAS' : 'BIBLIOTECA MODULAR'}</span><span>Y ↑ · Pivô na base · Escala 1:1</span></div></>}
          {exploring && <><div className="lab-crosshair" aria-hidden="true" /><div className="lab-walk-top"><Badge><EyeLabel />Exploração com colisões</Badge><Button variant="secondary" onClick={onExit}><X data-icon="inline-start" /> Sair · Esc</Button></div><output className="lab-player-position" data-player-position={position.join(',')}>X {position[0].toFixed(1)} · Y {position[1].toFixed(1)} · Z {position[2].toFixed(1)}</output>{nearby && <div className="lab-nearby"><Button onClick={() => onInspect(nearby)}>E · Revistar {nearby.concealed ? 'recipiente oculto' : 'recipiente'}</Button><span>{nearby.label}</span></div>}<div className="lab-touch-movement"><div className="lab-dpad">{([['forward', ArrowUp, 'Avançar'], ['left', ArrowLeft, 'Esquerda'], ['back', ArrowDown, 'Recuar'], ['right', ArrowRight, 'Direita']] as const).map(([key, Icon, label]) => <Button key={key} size="icon-lg" variant="secondary" aria-label={label} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); direction(key, true) }} onPointerUp={() => direction(key, false)} onPointerCancel={() => direction(key, false)} onLostPointerCapture={() => direction(key, false)}><Icon /></Button>)}</div><span>Arraste para olhar</span></div></>}
          {exploring && selectedSocket && lootReport && <div className="lab-loot-overlay" role="status"><div className="flex items-center justify-between gap-3"><h2 className="font-heading text-xl">{selectedSocket.label}</h2><Button variant="ghost" size="icon" aria-label="Fechar recursos" onClick={() => setSelectedSocket(null)}><X /></Button></div><p>{lootReport.container}{lootReport.room ? ` · ${lootReport.room}` : ''}</p>{lootReport.items.length ? <ul>{lootReport.items.map((item) => <li key={item.id}><span>{item.quantity}× {item.label}</span><span>{item.rarity}</span></li>)}</ul> : <p>Vazio · já revirado por outros sobreviventes</p>}<p>Prévia de recursos · sem coleta persistente</p></div>}
        </div>
        <div className="lab-stage-toolbar"><div className="lab-interaction-hint"><MousePointer2 size={16} aria-hidden="true" /><span>{exploring ? 'WASD mover · Shift correr · Espaço pular · E revistar' : 'Arraste para orbitar · Scroll para aproximar'}</span></div>{exploring ? <Button variant="outline" onClick={onExit}><RotateCcw data-icon="inline-start" /> Voltar à inspeção</Button> : <Button onClick={explore} disabled={!ready || !report.passed}><ArrowRight data-icon="inline-start" /> {kind === 'structure' ? 'Explorar interior' : 'Testar em escala real'}</Button>}</div>
        <div className="lab-stage-note"><ShieldCheck size={16} aria-hidden="true" /><p>{kind === 'structure' ? 'Montagem de teste isolada. Terreno, florestas e distribuição do mundo original não foram alterados.' : 'Malha detalhada com PBR. Colisores simplificados preservam a escala, os encaixes e a exploração.'}</p></div>
      </section>
      <BlockoutInspector model={model} resource={kind === 'resource' ? RESOURCE_BY_ID.get(id) : undefined} lootReport={lootReport} sculpted={kind === 'structure' || hasSculpt(model.id)} report={report} geometryStats={ready ? geometryStats : null} seed={seed} seedDraft={seedDraft} condition={condition} options={options} selectedSocket={selectedSocket} onSeedDraft={setSeedDraft} onSeed={() => applySeed(Number(seedDraft))} onNextSeed={() => applySeed(seed + 1)} onCondition={(value) => { if (value !== condition) { onExit(); setReady(false); setCondition(value); setSelectedSocket(null); changeOptions({ floor: 'all' }) } }} onOptions={changeOptions} onInspect={onInspect} onBroken={(value) => { if (value !== options.broken) { onExit(); setReady(false); changeOptions({ broken: value }) } }} />
    </div>
    <footer className="lab-footer"><span><Check size={14} /> {ASSETS.length} módulos <span className="text-muted-foreground">/</span> {BLUEPRINTS.length} arquétipos <span className="text-muted-foreground">/</span> {RESOURCES.length} recursos</span><span className="hidden md:inline">MALHA → PBR → VALIDAÇÃO → MUNDO</span><span>SEED {seed}</span></footer>
  </main>
}

function EyeLabel() { return <span className="lab-status-dot" aria-hidden="true" /> }
