'use client'

import { createContext, useContext } from 'react'
import { useFrame } from '@react-three/fiber'
import { runtime } from '@/lib/game/runtime'
import type { WorldSession } from '@/lib/game/world/session'
import type { ScatterPools } from './scatter-pools'

export const ScatterContext = createContext<ScatterPools | null>(null)

export function useScatter() {
  const scatter = useContext(ScatterContext)
  if (!scatter) throw new Error('useScatter precisa de um ScatterContext.')
  return scatter
}

export function ScatterLayer({ scatter, session }: { scatter: ScatterPools; session: WorldSession }) {
  useFrame(({ camera }) => scatter.update(camera, session.quality, runtime.viewDistance), -10)
  return <primitive object={scatter.group} />
}
