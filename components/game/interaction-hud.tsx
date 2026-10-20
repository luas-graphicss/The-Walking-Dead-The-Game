'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Hand } from 'lucide-react'
import { input } from '@/lib/game/input'
import { hudStore, promptAnchor } from '@/lib/game/interaction/hud'

const RARITY_TIER: Record<string, number> = { Comum: 0, Incomum: 1, Raro: 2, 'Muito raro': 3 }

export function InteractionHud() {
  const prompt = useSyncExternalStore(hudStore.subscribe, hudStore.prompt, hudStore.prompt)
  const toasts = useSyncExternalStore(hudStore.subscribe, hudStore.toasts, hudStore.toasts)
  const anchor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    const follow = () => {
      const element = anchor.current
      if (element) {
        element.style.transform = `translate3d(${promptAnchor.x.toFixed(1)}px, ${promptAnchor.y.toFixed(1)}px, 0)`
        element.dataset.visible = String(promptAnchor.visible && !promptAnchor.busy)
      }
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <>
      <div ref={anchor} className="interact-anchor" data-visible="false" data-tone={prompt.tone}>
        <span aria-hidden="true" className="interact-mark" />
        {prompt.visible && (
          <button
            key={`${prompt.verb}-${prompt.label}`}
            type="button"
            tabIndex={-1}
            className="interact-prompt"
            aria-label={`${prompt.verb}: ${prompt.label}`}
            onPointerDown={(event) => {
              event.preventDefault()
              if (input.enabled) input.interactQueued = true
            }}
          >
            <kbd className="key touch:hidden">E</kbd>
            <span aria-hidden="true" className="interact-tap hidden touch:grid"><Hand /></span>
            <span className="interact-copy">
              <span className="interact-verb">{prompt.verb}</span>
              <span className="interact-label">{prompt.label}</span>
              {prompt.detail && (
                <span className="interact-detail">
                  {prompt.detail}
                  {prompt.rarity && <> · <span data-tier={RARITY_TIER[prompt.rarity] ?? 0}>{prompt.rarity}</span></>}
                </span>
              )}
            </span>
          </button>
        )}
      </div>
      <ol className="loot-feed" aria-live="polite" aria-label="Itens coletados">
        {toasts.map((toast) => (
          <li key={toast.id} className="loot-toast">
            <span className="loot-copy">
              <span className="loot-label">{toast.label}</span>
              <span className="loot-meta">{toast.category} · na mochila</span>
            </span>
            <span className="loot-quantity">+{toast.quantity}</span>
          </li>
        ))}
      </ol>
    </>
  )
}
