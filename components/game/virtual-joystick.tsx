'use client'

import { useRef, type PointerEvent } from 'react'
import { input } from '@/lib/game/input'

const DEAD_ZONE = 0.14

const TRAVEL = 0.62

const MIN_DRIVE = 0.3

type Grip = { id: number; x: number; y: number; travel: number }

export function VirtualJoystick({ boost, onRelease }: { boost: boolean; onRelease: () => void }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const grip = useRef<Grip | null>(null)

  const steer = (clientX: number, clientY: number) => {
    const current = grip.current
    if (!current) return
    const dx = clientX - current.x
    const dy = clientY - current.y
    const length = Math.hypot(dx, dy)
    const reach = Math.min(length, current.travel)
    const ux = length > 0 ? dx / length : 0
    const uy = length > 0 ? dy / length : 0
    if (knobRef.current) knobRef.current.style.transform = `translate3d(${ux * reach}px, ${uy * reach}px, 0)`
    const amount = reach / current.travel
    const drive = amount < DEAD_ZONE ? 0 : MIN_DRIVE + ((1 - MIN_DRIVE) * (amount - DEAD_ZONE)) / (1 - DEAD_ZONE)
    input.moveX = input.enabled ? ux * drive : 0
    input.moveY = input.enabled ? -uy * drive : 0
  }

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (grip.current?.id !== event.pointerId) return
    grip.current = null
    input.moveX = 0
    input.moveY = 0
    if (knobRef.current) knobRef.current.style.transform = ''
    if (baseRef.current) delete baseRef.current.dataset.active
    onRelease()
  }

  return (
    <div
      className="joystick"
      aria-hidden="true"
      onPointerDown={(event) => {
        const base = baseRef.current
        if (grip.current || !base) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        const rect = base.getBoundingClientRect()
        grip.current = { id: event.pointerId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, travel: (rect.width / 2) * TRAVEL }
        base.dataset.active = 'true'
        steer(event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (grip.current?.id === event.pointerId) steer(event.clientX, event.clientY)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div ref={baseRef} className="joystick-base" data-boost={boost || undefined}>
        <div ref={knobRef} className="joystick-knob" />
      </div>
    </div>
  )
}
