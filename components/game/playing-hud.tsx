'use client'

import { ArrowBigDown, LoaderCircle, Map as MapIcon, Pause, Plane, SwitchCamera, Waves } from 'lucide-react'
import { input } from '@/lib/game/input'
import { BIOME_LABELS } from '@/lib/game/world/types'
import type { GameHudProps, RegionBannerData, TelemetryData } from './game-hud'
import { HudCompass } from './hud-compass'
import { InteractionHud } from './interaction-hud'
import { TouchControls } from './touch-controls'

const WALK_PROMPTS = [['E', 'Interagir'], ['Shift', 'Correr'], ['Espaço', 'Pular'], ['C', 'Agachar'], ['F', 'Voar']] as const
const FLY_PROMPTS = [['Shift', 'Acelerar'], ['Espaço', 'Subir'], ['C', 'Descer'], ['F', 'Pousar']] as const
const kilometers = (meters: number) => (meters / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type PlayingHudProps = GameHudProps & { telemetry: TelemetryData; banner: RegionBannerData | null }

export function PlayingHud({ dragLook, session, onAtlas, onPause, telemetry, banner }: PlayingHudProps) {
  const flying = telemetry.mode === 'fly'
  const state = flying
    ? { Icon: Plane, label: 'Voo de inspeção' }
    : telemetry.movement === 'swim'
      ? { Icon: Waves, label: 'Nadando' }
      : telemetry.crouched
        ? { Icon: ArrowBigDown, label: 'Agachado' }
        : null
  const staminaVisible = !flying && (telemetry.running || telemetry.stamina < 0.995)

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-status">
          {state && <p className="hud-state"><state.Icon aria-hidden="true" />{state.label}</p>}
          {session.error
            ? <p role="alert" className="hud-streaming">{session.error}</p>
            : !telemetry.ready && <p role="status" className="hud-streaming"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Carregando terreno</p>}
        </div>
        <HudCompass />
        <div className="hud-buttons">
          <button type="button" className="hud-btn" onClick={() => { input.shoulderQueued = true }} aria-label="Trocar o ombro da câmera (V)">
            <SwitchCamera aria-hidden="true" /><kbd className="key touch:hidden">V</kbd>
          </button>
          <button type="button" className="hud-btn" onClick={onAtlas} aria-label="Abrir atlas (M)">
            <MapIcon aria-hidden="true" /><kbd className="key touch:hidden">M</kbd>
          </button>
          <button type="button" className="hud-btn" onClick={onPause} aria-label="Pausar (Esc)">
            <Pause aria-hidden="true" /><kbd className="key touch:hidden">Esc</kbd>
          </button>
        </div>
      </div>

      {!flying && <InteractionHud />}
      {banner && <RegionBanner key={banner.id} name={banner.name} biome={BIOME_LABELS[banner.biome]} />}
      {telemetry.notice && <p className="hud-notice" role="status">{telemetry.notice}</p>}
      {dragLook && !telemetry.notice && <p className="hud-hint touch:hidden">Segure e arraste o mouse para olhar · Esc para pausar</p>}

      <div
        className="hud-stamina"
        data-visible={staminaVisible}
        data-exhausted={telemetry.exhausted}
        role="progressbar"
        aria-label="Fôlego"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(telemetry.stamina * 100)}
      >
        <span className="hud-stamina-label touch:hidden">Fôlego</span>
        <div className="hud-stamina-track"><div className="hud-stamina-fill" style={{ transform: `scaleX(${telemetry.stamina})` }} /></div>
      </div>

      <section className="hud-telemetry touch:hidden" aria-label="Localização atual">
        <p className="hud-place">{telemetry.location}</p>
        <p className="hud-meta">{BIOME_LABELS[telemetry.biome]} · {Math.round(telemetry.y)} m · {telemetry.speed.toFixed(1)} m/s</p>
        <p className="hud-coords">X {kilometers(telemetry.x)} · Z {kilometers(telemetry.z)} km · {session.loadedCount} regiões · {telemetry.fps} FPS</p>
      </section>
      <div aria-hidden="true" className="hud-prompts touch:hidden">
        {(flying ? FLY_PROMPTS : WALK_PROMPTS).map(([key, action]) => <span key={key}><kbd className="key">{key}</kbd>{action}</span>)}
      </div>

      <TouchControls flying={flying} crouched={telemetry.crouched} />
    </div>
  )
}

function RegionBanner({ name, biome }: { name: string; biome: string }) {
  return (
    <div className="region-banner" role="status">
      <div aria-hidden="true" className="region-banner-rule" />
      <p className="region-banner-name">{name}</p>
      <p className="region-banner-sub">{biome}</p>
    </div>
  )
}
