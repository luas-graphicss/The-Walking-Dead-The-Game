'use client'

import dynamic from 'next/dynamic'
import type { Condition } from '@/lib/game/blockout/types'

const Lab = dynamic(() => import('./blockout-lab').then((module) => module.BlockoutLab), {
  ssr: false,
  loading: () => <main className="flex h-dvh items-center justify-center bg-background text-foreground" role="status"><div className="flex flex-col items-center gap-4"><span className="font-heading text-3xl uppercase tracking-widest">Oficina de blocagem</span><p className="text-sm text-muted-foreground">Preparando a bancada 3D…</p></div></main>,
})

export function BlockoutLoader(props: { initialId: string; initialKind: 'asset' | 'structure' | 'resource'; initialSeed: number; initialCondition?: Condition; initialBroken?: boolean }) {
  return <Lab {...props} />
}
