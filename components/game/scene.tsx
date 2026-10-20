'use client'

import { memo, Suspense, use, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Physics, useRapier } from '@react-three/rapier'
import { MAX_PHYSICS_STEPS, PHYSICS_STEP } from '@/lib/game/config'
import { texturesReady } from '@/lib/game/assets/pbr'
import { InteractionLayer } from './interaction-layer'
import { Lighting } from './lighting'
import { Player } from './player'
import { ProceduralWorld } from './procedural-world'
import { ThirdPersonCamera } from './third-person-camera'
import { WaterEffects } from './water-effects'
import type { WorldSession } from '@/lib/game/world/session'

function TexturesLoaded({ children }: { children: ReactNode }) {
  use(texturesReady())
  return children
}

function PhysicsStepper() {
  const { step } = useRapier()
  useFrame((_, delta) => step(Math.min(delta, PHYSICS_STEP * MAX_PHYSICS_STEPS)), -50)
  return null
}

export const Scene = memo(function Scene({ session }: { session: WorldSession }) {
  return (
    <>
      <Lighting session={session} />
      <Suspense fallback={null}>
        <TexturesLoaded>
          <Physics timeStep={PHYSICS_STEP} updatePriority={-50} interpolate={false} paused>
            <PhysicsStepper />
            <ProceduralWorld session={session} />
            <Player session={session} />
            <InteractionLayer session={session} />
            <ThirdPersonCamera />
          </Physics>
          <WaterEffects session={session} />
        </TexturesLoaded>
      </Suspense>
    </>
  )
})
