'use client'

import { useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { ArrowBigDown, ArrowBigUp, PlaneLanding, PlaneTakeoff, Zap } from 'lucide-react'
import { input, type HeldAction } from '@/lib/game/input'
import { VirtualJoystick } from './virtual-joystick'

type Slot = 'main' | 'left' | 'diagonal' | 'top'
const ARC: Record<Exclude<Slot, 'main'>, CSSProperties> = {
  left: { '--dx': -1, '--dy': 0 } as CSSProperties,
  diagonal: { '--dx': -0.71, '--dy': -0.71 } as CSSProperties,
  top: { '--dx': 0, '--dy': -1 } as CSSProperties,
}

const slotProps = (slot: Slot) =>
  slot === 'main' ? { className: 'action-btn action-main' } : { className: 'action-btn action-sat', style: ARC[slot] }
const pressDown = (event: PointerEvent<HTMLButtonElement>) => { event.currentTarget.dataset.down = 'true' }
const pressUp = (event: PointerEvent<HTMLButtonElement>) => { delete event.currentTarget.dataset.down }

type ButtonProps = { slot: Slot; label: string; children: ReactNode }

function TapButton({ slot, label, pressed, onPress, children }: ButtonProps & { pressed?: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      {...slotProps(slot)}
      onPointerDown={(event) => { event.preventDefault(); pressDown(event); if (input.enabled) onPress() }}
      onPointerUp={pressUp}
      onPointerCancel={pressUp}
      onPointerLeave={pressUp}
      onClick={(event) => { if (event.detail === 0 && input.enabled) onPress() }}
    >
      {children}
    </button>
  )
}

function HoldButton({ slot, label, action, children }: ButtonProps & { action: HeldAction }) {
  const release = (event: PointerEvent<HTMLButtonElement>) => { pressUp(event); input.held[action] = false }
  return (
    <button
      type="button"
      aria-label={label}
      {...slotProps(slot)}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        pressDown(event)
        if (input.enabled) input.held[action] = true
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && input.enabled) { event.preventDefault(); input.held[action] = true } }}
      onKeyUp={() => { input.held[action] = false }}
      onBlur={() => { input.held[action] = false }}
    >
      {children}
    </button>
  )
}

export function TouchControls({ flying, crouched }: { flying: boolean; crouched: boolean }) {

  const [boost, setBoost] = useState(false)
  const latchBoost = (on: boolean) => { setBoost(on); input.held.sprint = on && input.enabled }

  return (
    <div className="touch-layer hidden touch:block">
      <VirtualJoystick boost={boost} onRelease={() => { if (!flying) latchBoost(false) }} />
      <div className="action-cluster" role="group" aria-label="Ações">
        {flying
          ? <HoldButton slot="main" label="Subir" action="ascend"><ArrowBigUp aria-hidden="true" /></HoldButton>
          : <TapButton slot="main" label="Pular" onPress={() => { input.jumpQueued = true }}><ArrowBigUp aria-hidden="true" /></TapButton>}
        {flying
          ? <HoldButton slot="left" label="Descer" action="descend"><ArrowBigDown aria-hidden="true" /></HoldButton>
          : <TapButton slot="left" label="Agachar" pressed={crouched} onPress={() => { input.crouchQueued = true }}><ArrowBigDown aria-hidden="true" /></TapButton>}
        <TapButton slot="diagonal" label={flying ? 'Acelerar voo' : 'Correr'} pressed={boost} onPress={() => latchBoost(!boost)}>
          <Zap aria-hidden="true" />
        </TapButton>
        <TapButton slot="top" label={flying ? 'Pousar' : 'Voar'} onPress={() => { input.flyQueued = true; latchBoost(false) }}>
          {flying ? <PlaneLanding aria-hidden="true" /> : <PlaneTakeoff aria-hidden="true" />}
        </TapButton>
      </div>
    </div>
  )
}
