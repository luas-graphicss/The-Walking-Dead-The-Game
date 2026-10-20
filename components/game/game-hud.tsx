'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { runtime, type GamePhase } from '@/lib/game/runtime'
import type { Biome } from '@/lib/game/world/types'
import type { WorldSession } from '@/lib/game/world/session'
import type { Quality } from '@/lib/game/world/settings'
import { GameMenu } from './game-menu'
import { PlayingHud } from './playing-hud'

export type GameHudProps = {
  phase: GamePhase
  dragLook: boolean
  session: WorldSession
  quality: Quality

  introDone: boolean
  onIntroDone: () => void
  onStart: () => void
  onPause: () => void
  onAtlas: () => void
  onSeed: (seed: string) => void
  onQuality: (quality: Quality) => void
}

function captureTelemetry() {
  return {
    ready: runtime.terrainReady && !runtime.arrival && !runtime.travelTarget,
    x: runtime.worldPosition.x, y: runtime.worldPosition.y, z: runtime.worldPosition.z,
    stamina: runtime.stamina, speed: runtime.speed, mode: runtime.mode,
    running: runtime.running, exhausted: runtime.exhausted, crouched: runtime.crouched,
    movement: runtime.movementState, biome: runtime.biome, location: runtime.location,
    yaw: runtime.cameraYaw, fps: runtime.fps, distance: runtime.distanceTraveled, notice: runtime.notice,
  }
}
export type TelemetryData = ReturnType<typeof captureTelemetry>
export type RegionBannerData = { id: number; name: string; biome: Biome }

const MENU_EXIT_MS = 800
const BANNER_MS = 5200

export function GameHud(props: GameHudProps) {
  useSyncExternalStore(props.session.subscribe, props.session.getSnapshot, () => 0)
  const [telemetry, setTelemetry] = useState(captureTelemetry)

  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) setTelemetry(captureTelemetry()) }, 160)
    return () => clearInterval(timer)
  }, [])

  const playing = props.phase === 'playing'
  const [leaving, setLeaving] = useState(false)
  const previousPhase = useRef(props.phase)
  useEffect(() => {
    const was = previousPhase.current
    previousPhase.current = props.phase
    if (was === 'playing' || props.phase !== 'playing') return
    setLeaving(true)
    const timer = setTimeout(() => setLeaving(false), MENU_EXIT_MS)
    return () => { clearTimeout(timer); setLeaving(false) }
  }, [props.phase])

  const [banner, setBanner] = useState<RegionBannerData | null>(null)
  const announced = useRef('')
  useEffect(() => {
    if (!playing || !telemetry.ready || telemetry.location === announced.current) return
    announced.current = telemetry.location
    setBanner({ id: Date.now(), name: telemetry.location, biome: telemetry.biome })
  }, [playing, telemetry.ready, telemetry.location, telemetry.biome])
  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), BANNER_MS)
    return () => clearTimeout(timer)
  }, [banner])

  return (
    <>
      {playing && <PlayingHud {...props} telemetry={telemetry} banner={banner} />}
      {(!playing || leaving) && <GameMenu {...props} telemetry={telemetry} leaving={playing} />}
    </>
  )
}
