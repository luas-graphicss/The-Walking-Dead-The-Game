import { cn } from '@/lib/utils'

type GameLogoProps = { variant?: 'hero' | 'menu'; as?: 'h2' | 'p'; className?: string }

export function GameLogo({ variant = 'menu', as: Tag = 'h2', className }: GameLogoProps) {
  return (
    <Tag className={cn('game-logo', variant === 'hero' ? 'game-logo-hero' : 'game-logo-menu', className)}>
      <span className="game-logo-the">The</span>
      <span className="game-logo-word">Walking</span>
      <span className="game-logo-word">Dead</span>
    </Tag>
  )
}
