'use client'

import dynamic from 'next/dynamic'

const Lab = dynamic(() => import('./survivor-lab').then((module) => module.SurvivorLab), {
  ssr: false,
  loading: () => (
    <main className="flex h-dvh items-center justify-center bg-background text-foreground" role="status">
      <p className="text-sm text-muted-foreground">Carregando o sobrevivente e o banco de movimentos…</p>
    </main>
  ),
})

export function SurvivorLabLoader() {
  return <Lab />
}
