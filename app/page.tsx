import { GameLoader } from '@/components/game/game-loader'
import { clampWorld, DEFAULT_SEED, normalizeSeed } from '@/lib/game/world/settings'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const seed = normalizeSeed(typeof params.seed === 'string' ? params.seed : DEFAULT_SEED)
  const x = clampWorld(typeof params.x === 'string' ? Number(params.x) : 0)
  const z = clampWorld(typeof params.z === 'string' ? Number(params.z) : 0)
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      <h1 className="sr-only">The Walking Dead — The Game: mundo procedural em terceira pessoa</h1>
      <GameLoader initialSeed={seed} initialX={x} initialZ={z} initialMode={params.mode === 'fly' ? 'fly' : 'walk'} />
    </main>
  )
}
