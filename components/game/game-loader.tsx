'use client'

import dynamic from 'next/dynamic'
import { LoadingScreen } from './loading-screen'

const Game = dynamic(() => import('./game').then((module) => module.Game), {
  ssr: false,
  loading: () => <LoadingScreen />,
})

export function GameLoader(props: { initialSeed: string; initialX: number; initialZ: number; initialMode: 'walk' | 'fly' }) {
  return <Game {...props} />
}
