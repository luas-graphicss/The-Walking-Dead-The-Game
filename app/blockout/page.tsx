import type { Metadata } from 'next'
import { BlockoutLoader } from '@/components/blockout/blockout-loader'
import { CONDITIONS } from '@/lib/game/blockout/types'

export const metadata: Metadata = {
  title: 'Oficina 3D PBR | The Walking Dead',
  description: '578 módulos 3D refinados, 398 materiais PBR, texturas em escala física, interiores exploráveis e download completo otimizado com código e recursos.',
}

export default async function BlockoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const seed = typeof params.seed === 'string' && Number.isFinite(Number(params.seed)) ? Math.min(2147483647, Math.max(1, Math.trunc(Number(params.seed)))) : 2049
  const condition = CONDITIONS.find((item) => item.value === params.condition)?.value ?? 'damaged'
  return <BlockoutLoader initialId={typeof params.asset === 'string' ? params.asset : 'barn'} initialKind={params.kind === 'asset' || params.kind === 'resource' ? params.kind : 'structure'} initialSeed={seed} initialCondition={condition} initialBroken={params.broken === '1'} />
}
