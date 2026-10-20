import type { Metadata } from 'next'
import { SurvivorLabLoader } from '@/components/survivor-lab/survivor-lab-loader'

export const metadata: Metadata = {
  title: 'Laboratório do sobrevivente | The Walking Dead',
  description: 'Personagem Rocketbox animado por motion matching sobre 15 minutos de captura profissional (Bandai Namco Research e 100STYLE), com travamento de pés e IK de pernas.',
}

export default function SurvivorPage() {
  return <SurvivorLabLoader />
}
