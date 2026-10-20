'use client'

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { CAMERA, SPAWN_POSITION } from '@/lib/game/config'
import { isMobileDevice } from '@/lib/game/device'
import { attachInput, input, setInputEnabled } from '@/lib/game/input'
import { requestTravel, runtime, type GamePhase, type TravelMode } from '@/lib/game/runtime'
import { WorldSession } from '@/lib/game/world/session'
import { normalizeSeed, type Quality } from '@/lib/game/world/settings'
import { Button } from '@/components/ui/button'
import { AdaptiveResolution } from './adaptive-resolution'
import { GameHud } from './game-hud'
import { LoadingScreen } from './loading-screen'
import { WorldAtlas } from './world-atlas'
import { Scene } from './scene'

const CANVAS_CAMERA = { fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: [0, SPAWN_POSITION.y + 3, 5] as [number, number, number] }
const CANVAS_GL = { antialias: true, powerPreference: 'high-performance' as const }

type GameProps = { initialSeed: string; initialX: number; initialZ: number; initialMode: TravelMode }

export function Game({ initialSeed, initialX, initialZ, initialMode }: GameProps) {
  const [seed, setSeed] = useState(initialSeed)
  const [session, setSession] = useState<WorldSession | null>(null)
  const [phase, setPhase] = useState<GamePhase>('menu')
  const [atlasOpen, setAtlasOpen] = useState(false)
  const [quality, setQuality] = useState<Quality>('balanced')
  const [dragLook, setDragLook] = useState(false)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [dpr, setDpr] = useState(1)
  const [introDone, setIntroDone] = useState(false)
  const finishIntro = useCallback(() => setIntroDone(true), [])
  const mobile = isMobileDevice()
  const wasLockedRef = useRef(false)

  useEffect(() => {
    const next = new WorldSession(seed)

    next.quality = isMobileDevice() || matchMedia('(max-width: 640px)').matches ? 'low' : 'balanced'
    setQuality(next.quality)
    runtime.playerBody = null; runtime.playerCollider = null
    runtime.playerPosition.set(0, SPAWN_POSITION.y, 0)
    runtime.worldPosition.set(0, SPAWN_POSITION.y, 0)
    runtime.origin.x = 0; runtime.origin.z = 0; runtime.originShifts = 0; runtime.teleportVersion = 0
    runtime.cameraYaw = 0; runtime.cameraImpact = 0; runtime.crouched = false; runtime.crouchAmount = 0
    runtime.bodyPosition.set(0, SPAWN_POSITION.y, 0); runtime.bodyFacing = Math.PI
    runtime.speed = 0; runtime.stamina = 1; runtime.exhausted = false; runtime.running = false
    runtime.playerVelocity.set(0, 0, 0); runtime.landingImpact = 0; runtime.distanceTraveled = 0
    runtime.terrainReady = false; runtime.phase = 'menu'; runtime.notice = ''; runtime.movementState = 'idle'
    runtime.arrival = null
    const original = seed === initialSeed
    requestTravel(original ? initialX : 0, original ? initialZ : 0, original ? initialMode : 'walk')
    next.start()
    next.setFocus(original ? initialX : 0, original ? initialZ : 0, true)
    setSession(next); setPhase('menu'); setAtlasOpen(false); wasLockedRef.current = false
    return () => { next.dispose(); setInputEnabled(false); runtime.playerBody = null; runtime.playerCollider = null }
  }, [seed, initialSeed, initialX, initialZ, initialMode])

  useEffect(() => { runtime.phase = phase; setInputEnabled(phase === 'playing' && !atlasOpen) }, [phase, atlasOpen])

  const pause = useCallback(() => {
    setPhase((current) => current === 'playing' ? 'paused' : current)
    if (document.pointerLockElement) document.exitPointerLock()
  }, [])

  const openAtlas = useCallback(() => { pause(); setAtlasOpen((current) => !current) }, [pause])

  const lockPointer = useCallback(() => {

    if (!canvas || matchMedia('(pointer: coarse), (max-width: 767px)').matches) return
    try {
      const request = canvas.requestPointerLock() as Promise<void> | undefined
      request?.catch(() => setDragLook(true))
    } catch { setDragLook(true) }
  }, [canvas])

  const start = useCallback(() => {
    if (!runtime.terrainReady) return
    setAtlasOpen(false); setPhase('playing'); lockPointer()
  }, [lockPointer])

  const travel = useCallback((x: number, z: number, mode: TravelMode) => {
    requestTravel(x, z, mode)
    setAtlasOpen(false); setPhase('playing'); lockPointer()
  }, [lockPointer])

  const changeSeed = useCallback((value: string) => {
    const next = normalizeSeed(value)
    if (next === seed) { requestTravel(0, 0, 'walk'); return }
    const url = new URL(window.location.href)
    url.searchParams.set('seed', next); url.searchParams.delete('x'); url.searchParams.delete('z'); url.searchParams.delete('mode')
    history.replaceState(null, '', url)
    setSeed(next)
  }, [seed])

  const changeQuality = useCallback((value: Quality) => {
    if (!session) return
    session.quality = value; setQuality(value)
    session.setFocus(runtime.worldPosition.x, runtime.worldPosition.z, true)
  }, [session])

  useEffect(() => {
    if (!canvas) return
    const detachInput = attachInput({ canvas, onEscape: pause, onMap: openAtlas })
    const handleLockChange = () => {
      const locked = document.pointerLockElement === canvas
      input.pointerLocked = locked
      if (locked) { wasLockedRef.current = true; setDragLook(false) }
      else if (wasLockedRef.current) { wasLockedRef.current = false; pause() }
    }
    const handleLockError = () => setDragLook(true)
    const handleCanvasClick = () => { if (runtime.phase === 'playing' && !input.pointerLocked) lockPointer() }
    const handleVisibility = () => { if (document.hidden) pause() }
    document.addEventListener('pointerlockchange', handleLockChange)
    document.addEventListener('pointerlockerror', handleLockError)
    document.addEventListener('visibilitychange', handleVisibility)
    canvas.addEventListener('click', handleCanvasClick)
    return () => {
      detachInput()
      document.removeEventListener('pointerlockchange', handleLockChange)
      document.removeEventListener('pointerlockerror', handleLockError)
      document.removeEventListener('visibilitychange', handleVisibility)
      canvas.removeEventListener('click', handleCanvasClick)
    }
  }, [canvas, lockPointer, pause, openAtlas])

  if (!session) return <LoadingScreen label="Preparando o mundo" />
  return (
    <div className="relative h-full w-full">
      <GameBoundary key={`scene-${session.seed}`}>
        <Canvas
          key={session.seed}
          shadows="percentage"
          dpr={dpr}
          camera={CANVAS_CAMERA}
          gl={CANVAS_GL}
          onCreated={({ gl }) => setCanvas(gl.domElement)}
          aria-label="Mundo procedural 3D, explorável com teclado, mouse ou controles por toque"
          style={{ touchAction: 'none' }}
        >
          {mobile
            ? <AdaptiveResolution min={0.85} max={1.5} start={1} onChange={setDpr} />
            : <AdaptiveResolution min={1} max={quality === 'low' ? 1 : 1.5} onChange={setDpr} />}
          <Scene session={session} />
        </Canvas>
      </GameBoundary>
      <GameHud key={`hud-${session.seed}`} phase={phase} dragLook={dragLook} session={session} quality={quality} introDone={introDone} onIntroDone={finishIntro} onStart={start} onPause={pause} onAtlas={openAtlas} onSeed={changeSeed} onQuality={changeQuality} />
      <WorldAtlas open={atlasOpen} onOpenChange={setAtlasOpen} session={session} onTravel={travel} />
    </div>
  )
}

class GameBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-background p-6 text-foreground" role="alert">
        <div className="flex max-w-md flex-col gap-5">
          <h2 className="font-heading text-3xl">Não foi possível iniciar a cena 3D</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">O jogo precisa de WebGL 2 e aceleração gráfica. Feche outras cenas 3D e tente recarregar.</p>
          <Button size="lg" onClick={() => window.location.reload()}>Recarregar jogo</Button>
        </div>
      </div>
    )
    return this.props.children
  }
}
