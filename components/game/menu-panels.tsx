'use client'

import { useState } from 'react'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import type { WorldSession } from '@/lib/game/world/session'
import type { Quality } from '@/lib/game/world/settings'

const QUALITIES: { value: Quality; label: string; range: string }[] = [
  { value: 'low', label: 'Leve', range: '650 m' },
  { value: 'balanced', label: 'Equilibrada', range: '900 m' },
  { value: 'high', label: 'Alta', range: '1,4 km' },
]

const KEYBOARD_CONTROLS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], 'Mover'],
  [['Shift'], 'Correr · acelerar o voo'],
  [['Espaço'], 'Pular · subir em voo'],
  [['C'], 'Agachar · descer em voo'],
  [['F'], 'Voar · pousar'],
  [['Mouse'], 'Olhar ao redor'],
  [['Scroll'], 'Aproximar a câmera'],
  [['V'], 'Trocar o ombro da câmera'],
  [['M'], 'Atlas do mundo'],
  [['Esc'], 'Pausar'],
]

const TOUCH_CONTROLS: [string, string][] = [
  ['Joystick', 'Mover; quanto mais inclinado, mais rápido'],
  ['Arrastar a tela', 'Olhar ao redor · a câmera segue sozinha ao correr'],
  ['Toque duplo', 'Centralizar a câmera atrás do sobrevivente'],
  ['Câmera', 'Trocar o ombro da câmera'],
  ['Seta para cima', 'Pular · subir em voo'],
  ['Seta para baixo', 'Agachar · descer em voo'],
  ['Raio', 'Correr · acelerar (liga e desliga)'],
  ['Avião', 'Voar · pousar'],
]

function PanelHeader({ id, title, onBack }: { id: string; title: string; onBack: () => void }) {
  return (
    <div className="panel-head">
      <button type="button" className="panel-back" onClick={onBack} aria-label="Voltar ao menu">
        <ChevronLeft aria-hidden="true" />
      </button>
      <h3 id={id} className="panel-title">{title}</h3>
    </div>
  )
}

type SettingsPanelProps = {
  session: WorldSession
  quality: Quality
  onSeed: (seed: string) => void
  onQuality: (quality: Quality) => void
  onBack: () => void
}

export function SettingsPanel({ session, quality, onSeed, onQuality, onBack }: SettingsPanelProps) {
  const [draft, setDraft] = useState(session.seed)
  return (
    <section className="menu-panel" aria-labelledby="settings-title">
      <PanelHeader id="settings-title" title="Configurações" onBack={onBack} />
      <form
        className="menu-field"
        onSubmit={(event) => { event.preventDefault(); onSeed(draft) }}
        onKeyDown={(event) => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }}
      >
        <label htmlFor="world-seed" className="menu-label">Seed do mundo</label>
        <div className="flex gap-2">
          <input id="world-seed" className="menu-input" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={64} autoComplete="off" spellCheck={false} />
          <button type="submit" className="menu-action"><RotateCcw aria-hidden="true" />Gerar</button>
        </div>
        <p className="menu-help">A mesma seed recria o mesmo mundo. Gerar novamente volta ao ponto de partida.</p>
      </form>
      <div className="menu-field">
        <p id="quality-label" className="menu-label">Distância de visão</p>
        <div role="radiogroup" aria-labelledby="quality-label" className="segmented">
          {QUALITIES.map((item) => (
            <div key={item.value}>
              <input
                type="radio"
                id={`quality-${item.value}`}
                name="quality"
                value={item.value}
                checked={quality === item.value}
                onChange={() => onQuality(item.value)}
                className="sr-only"
              />
              <label htmlFor={`quality-${item.value}`}>
                <span>{item.label}</span>
                <span>{item.range}</span>
              </label>
            </div>
          ))}
        </div>
        <p className="menu-help">Distâncias menores deixam o jogo mais leve em celulares e notebooks.</p>
      </div>
    </section>
  )
}

export function ControlsPanel({ onBack }: { onBack: () => void }) {
  return (
    <section className="menu-panel" aria-labelledby="controls-title">
      <PanelHeader id="controls-title" title="Controles" onBack={onBack} />
      <div className="controls-groups">
        <div className="controls-group">
          <h4 className="menu-label">Teclado e mouse</h4>
          <dl className="controls-list">
            {KEYBOARD_CONTROLS.map(([keys, action]) => (
              <div key={action}>
                <dt>{keys.map((key) => <kbd key={key} className="key">{key}</kbd>)}</dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="controls-group touch:order-first">
          <h4 className="menu-label">Toque</h4>
          <dl className="controls-list">
            {TOUCH_CONTROLS.map(([control, action]) => (
              <div key={control}>
                <dt className="font-heading font-bold uppercase tracking-wider">{control}</dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
