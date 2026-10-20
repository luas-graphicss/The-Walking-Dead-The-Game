'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { BIOME_LABELS } from '@/lib/game/world/types'
import { cn } from '@/lib/utils'
import type { GameHudProps, TelemetryData } from './game-hud'
import { GameLogo } from './game-logo'
import { ControlsPanel, SettingsPanel } from './menu-panels'
import { SourceDownload } from './source-download'

type MenuProps = GameHudProps & { telemetry: TelemetryData; leaving: boolean }
type View = 'main' | 'settings' | 'controls'
type MenuEntry = { id: string; label: string; hint: string; href?: string; disabled?: boolean; onSelect?: () => void; meta?: ReactNode }

const TAGLINE = 'O mundo continua. A civilização, não.'
const IGNORED_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])
const kilometers = (meters: number) => (meters / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function GameMenu(props: MenuProps) {
  const { phase, introDone, onIntroDone, leaving, telemetry, session } = props
  const paused = phase === 'paused'
  const title = !paused && !introDone
  const progress = Math.round(session.progress * 100)
  return (
    <div className={cn('cine', title && 'is-title', paused && 'is-paused', leaving && 'is-leaving')} inert={leaving}>
      <div aria-hidden="true" className="cine-scrim" />
      <div aria-hidden="true" className="cine-grain" />
      <div aria-hidden="true" className="cine-bar cine-bar-top" />
      <div aria-hidden="true" className="cine-bar cine-bar-bottom" />
      <div className="cine-content">
        {title
          ? <TitleScreen ready={telemetry.ready} progress={progress} error={session.error} onContinue={onIntroDone} />
          : <MenuScreen {...props} progress={progress} />}
      </div>
    </div>
  )
}

function TitleScreen({ ready, progress, error, onContinue }: { ready: boolean; progress: number; error: string | null; onContinue: () => void }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || IGNORED_KEYS.has(event.key)) return

      event.preventDefault()
      event.stopPropagation()
      onContinue()
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onContinue])

  return (
    <div className="title-screen" onClick={onContinue}>
      <GameLogo variant="hero" />
      <p className="title-tagline">{TAGLINE}</p>
      <button type="button" className="title-prompt" onClick={(event) => { event.stopPropagation(); onContinue() }}>
        <span className="touch:hidden">Pressione qualquer tecla</span>
        <span className="hidden touch:inline">Toque para começar</span>
      </button>
      {error ? (
        <p role="alert" className="title-error">{error}</p>
      ) : !ready && (
        <div className="title-progress" role="status">
          <div className="progress-track"><div className="progress-fill" style={{ transform: `scaleX(${progress / 100})` }} /></div>
          <span>Gerando terreno · {progress}%</span>
        </div>
      )}
    </div>
  )
}

function MenuScreen({ phase, session, quality, telemetry, progress, onStart, onAtlas, onSeed, onQuality }: MenuProps & { progress: number }) {
  const paused = phase === 'paused'
  const [view, setView] = useState<View>('main')
  const back = useCallback(() => setView('main'), [])

  useEffect(() => {
    if (view === 'main') return
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') back() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [view, back])

  const ready = telemetry.ready && !session.error
  const entries: MenuEntry[] = [
    {
      id: 'start',
      label: paused ? 'Continuar' : 'Explorar',
      hint: paused ? 'Volte para a estrada de onde parou.' : `Comece a jornada em ${telemetry.location}.`,
      disabled: !ready,
      onSelect: onStart,
      meta: !telemetry.ready && !session.error && (
        <span className="menu-item-meta">
          <span className="menu-meter"><span style={{ transform: `scaleX(${progress / 100})` }} /></span>
          Gerando terreno · {progress}%
        </span>
      ),
    },
    { id: 'atlas', label: 'Atlas do mundo', hint: 'O mapa de 4.096 × 4.096 km. Escolha um destino e viaje até ele.', disabled: !ready, onSelect: onAtlas },
    { id: 'settings', label: 'Configurações', hint: 'Seed do mundo e distância de visão.', onSelect: () => setView('settings') },
    { id: 'controls', label: 'Controles', hint: 'Teclado, mouse e toque.', onSelect: () => setView('controls') },
    { id: 'workshop', label: 'Oficina 3D', hint: 'Teste estruturas, interiores e materiais PBR.', href: '/blockout' },
  ]

  return (
    <>
      <header className="menu-head">
        {paused ? (
          <>
            <p className="pause-eyebrow">Jogo pausado</p>
            <h2 className="pause-place">{telemetry.location}</h2>
            <p className="pause-meta">
              {BIOME_LABELS[telemetry.biome]} · {Math.round(telemetry.y)} m de altitude · {kilometers(telemetry.distance)} km percorridos
            </p>
          </>
        ) : (
          <>
            <GameLogo variant="menu" />
            <div aria-hidden="true" className="menu-rule" />
            <p className="menu-tagline">{TAGLINE}</p>
          </>
        )}
      </header>
      <div className="menu-main">
        {view === 'main' && <MenuList label={paused ? 'Menu de pausa' : 'Menu principal'} entries={entries} />}
        {view === 'settings' && <SettingsPanel session={session} quality={quality} onSeed={onSeed} onQuality={onQuality} onBack={back} />}
        {view === 'controls' && <ControlsPanel onBack={back} />}
        {session.error && <p role="alert" className="menu-error">{session.error}</p>}
      </div>
      <footer className="menu-foot">
        <div className="menu-foot-meta">
          <span>Seed <span className="text-foreground">{session.seed}</span></span>
          {paused
            ? <span className="tabular-nums">X {kilometers(telemetry.x)} · Z {kilometers(telemetry.z)} km</span>
            : <span className="touch:hidden">Protótipo 0.4</span>}
          <SourceDownload variant="link" />
        </div>
        <div aria-hidden="true" className="menu-keys touch:hidden">
          <span><kbd className="key">↑</kbd><kbd className="key">↓</kbd>Navegar</span>
          <span><kbd className="key">Enter</kbd>Selecionar</span>
          {view !== 'main' && <span><kbd className="key">Esc</kbd>Voltar</span>}
        </div>
      </footer>
    </>
  )
}

function MenuList({ label, entries }: { label: string; entries: MenuEntry[] }) {
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-menu-item]')?.focus({ preventScroll: true })
  }, [])

  const moveFocus = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-menu-item]') ?? [])
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLElement))
    items[(current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  return (
    <nav aria-label={label}>
      <ul ref={listRef} className="menu-list" onKeyDown={moveFocus}>
        {entries.map((entry, index) => {
          const shared = {
            className: 'menu-item',
            'data-menu-item': '',
            'data-active': active === index,
            style: { '--i': index } as CSSProperties,
            onFocus: () => setActive(index),

            onMouseMove: (event: ReactMouseEvent<HTMLElement>) => {
              if ((event.movementX || event.movementY) && document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true })
            },
          }
          return (
            <li key={entry.id}>
              {entry.href ? (
                <Link href={entry.href} {...shared}>{entry.label}</Link>
              ) : (
                <button type="button" {...shared} aria-disabled={entry.disabled || undefined} onClick={() => { if (!entry.disabled) entry.onSelect?.() }}>
                  {entry.label}
                  {entry.meta}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="menu-hint">{entries[active]?.hint}</p>
    </nav>
  )
}
