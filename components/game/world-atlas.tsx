'use client'

import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'
import { Check, Copy, LocateFixed, Navigation, MapPinned } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { runtime, type TravelMode } from '@/lib/game/runtime'
import { WORLD_HALF, insideWorld } from '@/lib/game/world/settings'
import type { WorldSession } from '@/lib/game/world/session'
import type { Point2 } from '@/lib/game/world/types'

const AtlasMap = dynamic(() => import('./atlas-map'), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Abrindo atlas…</div> })
const MODES = [{ value: 'walk', label: 'A pé · pouso seguro' }, { value: 'fly', label: 'Voo de inspeção' }]
type Props = { open: boolean; onOpenChange: (open: boolean) => void; session: WorldSession; onTravel: (x: number, z: number, mode: TravelMode) => void }

export function WorldAtlas({ open, onOpenChange, session, onTravel }: Props) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="block max-h-[94dvh] w-[calc(100%-1rem)] max-w-none overflow-y-auto rounded-md p-0 sm:max-w-6xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
      <div className="border-b border-border px-5 py-4 pr-14">
        <DialogHeader>
          <DialogTitle className="font-heading text-3xl font-extrabold uppercase tracking-wide">Atlas do mundo</DialogTitle>
          <DialogDescription>4.096 × 4.096 km · Seed {session.seed} · Clique no mapa ou informe coordenadas.</DialogDescription>
        </DialogHeader>
      </div>
      {open && <AtlasContents session={session} onTravel={onTravel} />}
    </DialogContent>
  </Dialog>
}

function AtlasContents({ session, onTravel }: Pick<Props, 'session' | 'onTravel'>) {
  const center = useMemo(() => ({ x: runtime.worldPosition.x, z: runtime.worldPosition.z }), [])
  const [selected, setSelected] = useState<Point2>(center)
  const [x, setX] = useState((center.x / 1000).toFixed(3))
  const [z, setZ] = useState((center.z / 1000).toFixed(3))
  const [mode, setMode] = useState<TravelMode>('walk')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [preset, setPreset] = useState<string | null>(null)

  const destinations = useMemo(() => {
    const home = session.terrain.town(0, 0)
    const distant = session.terrain.town(29, -22)
    const far = session.terrain.town(-104, 83)
    let mountain = { x: 398_000, z: -512_000 }, highest = -Infinity
    for (let i = 0; i < 36; i++) {
      const point = { x: 390_000 + (i % 6) * 2_200, z: -520_000 + Math.floor(i / 6) * 2_200 }
      const y = session.terrain.height(point.x, point.z)
      if (y > highest) { highest = y; mountain = point }
    }
    const places = [
      { value: 'home', label: 'Vale do Cedro · início', x: home.x, z: home.z },
      { value: 'distant', label: `${distant.name} · ~300 km`, x: distant.x, z: distant.z },
      { value: 'mountain', label: 'Terras altas · ~650 km', ...mountain },
      { value: 'far', label: `${far.name} · ~1.000 km`, x: far.x, z: far.z },
      { value: 'coast', label: 'Costa leste · ~2.000 km', x: WORLD_HALF - 3_800, z: 180_000 },
    ]
    return places
  }, [session])

  const selectPoint = useCallback((point: Point2) => {
    setSelected(point); setX((point.x / 1000).toFixed(3)); setZ((point.z / 1000).toFixed(3)); setError(''); setCopied(false)
  }, [])

  const validate = () => {
    const px = Number(x) * 1000, pz = Number(z) * 1000
    if (!x.trim() || !z.trim() || !insideWorld(px, pz, 20)) {
      setError('Informe coordenadas válidas entre −2.047,98 e 2.047,98 km.'); return null
    }
    setError('')
    return { x: px, z: pz }
  }

  const copyLocation = async () => {
    const point = validate()
    if (!point) return
    const url = new URL(window.location.href)
    url.searchParams.set('seed', session.seed); url.searchParams.set('x', String(Math.round(point.x))); url.searchParams.set('z', String(Math.round(point.z))); url.searchParams.set('mode', mode)
    try { await navigator.clipboard.writeText(url.toString()); setCopied(true) }
    catch { setError('O navegador bloqueou a cópia. As coordenadas e a seed estão disponíveis neste painel.') }
  }

  return <div className="atlas-layout">
    <div className="atlas-map-panel"><AtlasMap session={session} center={center} selected={selected} onSelect={selectPoint} /></div>
    <aside className="atlas-sidebar">
      <form onSubmit={(event) => { event.preventDefault(); const point = validate(); if (point) onTravel(point.x, point.z, mode) }} onKeyDown={(event) => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="atlas-destination">Destinos para explorar</FieldLabel>
            <Select items={destinations} value={preset} onValueChange={(value) => {
              if (!value) return
              const place = destinations.find((item) => item.value === value)
              if (place) { setPreset(value); selectPoint(place); if (value === 'coast' || value === 'mountain') setMode('fly') }
            }}>
              <SelectTrigger id="atlas-destination" className="h-10 w-full"><SelectValue placeholder="Escolher uma região" /></SelectTrigger>
              <SelectContent><SelectGroup>{destinations.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>
          <FieldGroup className="grid grid-cols-2 gap-3">
            <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="atlas-x">X (km)</FieldLabel><Input id="atlas-x" type="number" step="0.001" min="-2047.98" max="2047.98" value={x} onChange={(event) => { setX(event.target.value); setCopied(false) }} aria-invalid={Boolean(error)} className="h-10" required /></Field>
            <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="atlas-z">Z (km)</FieldLabel><Input id="atlas-z" type="number" step="0.001" min="-2047.98" max="2047.98" value={z} onChange={(event) => { setZ(event.target.value); setCopied(false) }} aria-invalid={Boolean(error)} className="h-10" required /></Field>
          </FieldGroup>
          <Button type="button" variant="outline" className="h-10" onClick={() => { const point = validate(); if (point) selectPoint(point) }}><MapPinned data-icon="inline-start" /> Ver no atlas</Button>
          <Field>
            <FieldLabel htmlFor="atlas-mode">Chegar ao destino</FieldLabel>
            <Select items={MODES} value={mode} onValueChange={(value) => { if (value) setMode(value as TravelMode) }}>
              <SelectTrigger id="atlas-mode" className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>{MODES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <FieldDescription>Água profunda e encostas sem apoio seguro ativam o voo automaticamente.</FieldDescription>
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" className="h-11"><Navigation data-icon="inline-start" /> Explorar destino</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-10 flex-1" onClick={() => selectPoint(center)}><LocateFixed data-icon="inline-start" /> Minha posição</Button>
            <Button type="button" variant="outline" size="icon" className="size-10" onClick={copyLocation} aria-label={copied ? 'Link copiado' : 'Copiar link deste destino'}>{copied ? <Check /> : <Copy />}</Button>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">O atlas é calculado a partir do terreno real. Aproxime para ver estradas e bairros. Viagens e voo são ferramentas deste protótipo.</p>
        </FieldGroup>
      </form>
    </aside>
  </div>
}
