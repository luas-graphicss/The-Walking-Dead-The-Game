'use client'

import { useEffect, useRef } from 'react'
import { runtime } from '@/lib/game/runtime'

const STEP = 15
const LABELS: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'L', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' }

const CELLS = Array.from({ length: (360 * 3) / STEP }, (_, index) => index * STEP - 360)

export function HudCompass() {
  const stripRef = useRef<HTMLDivElement>(null)
  const bearingRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let frame = 0
    let shown = Number.NaN
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const bearing = ((((-runtime.cameraYaw * 180) / Math.PI) % 360) + 360) % 360
      if (Math.abs(bearing - shown) < 0.05) return
      shown = bearing
      if (stripRef.current) stripRef.current.style.transform = `translateX(calc(${(-(bearing + 360)).toFixed(2)} * var(--deg)))`
      if (bearingRef.current) bearingRef.current.textContent = `${Math.round(bearing) % 360}°`
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="compass" aria-hidden="true">
      <div className="compass-window">
        <div ref={stripRef} className="compass-strip">
          {CELLS.map((degree) => {
            const heading = ((degree % 360) + 360) % 360
            const label = LABELS[heading]
            return (
              <div key={degree} className="compass-cell" data-major={heading % 45 === 0 || undefined}>
                {label && <span className="compass-label" data-north={heading === 0 || undefined}>{label}</span>}
              </div>
            )
          })}
        </div>
        <div className="compass-marker" />
      </div>
      <span ref={bearingRef} className="compass-bearing" />
    </div>
  )
}
