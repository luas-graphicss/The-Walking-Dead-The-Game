'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const WINDOW = 1.2

const COOLDOWN = 24
const STEP_DOWN = 0.25
const STEP_UP = 0.125

type AdaptiveResolutionProps = { min: number; max: number; start?: number; onChange: (dpr: number) => void }

export function AdaptiveResolution({ min, max, start, onChange }: AdaptiveResolutionProps) {
  const state = useRef({ dpr: 0, top: 0, ceiling: 0, cooldown: 0, frames: 0, time: 0, calm: 0 })
  useEffect(() => {
    const top = Math.max(min, Math.min(max, window.devicePixelRatio || 1))
    const dpr = Math.max(min, Math.min(top, start ?? top))
    state.current = { dpr, top, ceiling: top, cooldown: 0, frames: 0, time: 0, calm: 0 }
    onChange(dpr)
  }, [min, max, start, onChange])
  useFrame((_, delta) => {
    const s = state.current

    if (!s.dpr || delta > 0.25) return
    s.frames++
    s.time += delta
    if (s.time < WINDOW) return
    const fps = s.frames / s.time
    if (s.cooldown > 0) {
      s.cooldown -= s.time
      if (s.cooldown <= 0) s.ceiling = s.top
    }
    s.frames = 0
    s.time = 0
    let next = s.dpr
    if (fps < 50) {
      next = Math.max(min, s.dpr - STEP_DOWN)
      s.ceiling = Math.max(min, s.dpr - STEP_UP)
      s.cooldown = COOLDOWN
      s.calm = 0
    } else if (fps > 58 && ++s.calm >= 3) {
      next = Math.min(s.ceiling, s.dpr + STEP_UP)
      s.calm = 0
    }
    if (next === s.dpr) return
    s.dpr = next
    onChange(next)
  })
  return null
}
