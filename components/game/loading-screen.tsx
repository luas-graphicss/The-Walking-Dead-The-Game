import { GameLogo } from './game-logo'

export function LoadingScreen({ label = 'Carregando' }: { label?: string }) {
  return (
    <div role="status" className="loading-screen">
      <GameLogo variant="hero" as="p" />
      <div className="loading-status">
        <span>{label}</span>
        <div aria-hidden="true" className="progress-track">
          <div className="loading-sweep" />
        </div>
      </div>
    </div>
  )
}
