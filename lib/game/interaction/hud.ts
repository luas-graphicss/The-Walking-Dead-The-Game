export type PromptState = { visible: boolean; verb: string; label: string; detail: string; tone: 'leaf' | 'pickup'; rarity: string }
export type Toast = { id: number; label: string; quantity: number; category: string; rarity: string }

const HIDDEN: PromptState = { visible: false, verb: '', label: '', detail: '', tone: 'leaf', rarity: '' }
const listeners = new Set<() => void>()
let prompt = HIDDEN
let toasts: Toast[] = []
let sequence = 0

export const promptAnchor = { x: 0, y: 0, visible: false, busy: false }

const emit = () => { for (const listener of listeners) listener() }

export const hudStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  prompt: () => prompt,
  toasts: () => toasts,
}

export function setPrompt(next: PromptState | null) {
  const value = next ?? HIDDEN
  if (value.visible === prompt.visible && value.verb === prompt.verb && value.label === prompt.label && value.detail === prompt.detail && value.tone === prompt.tone && value.rarity === prompt.rarity) return
  prompt = value
  emit()
}

export function pushToast(toast: Omit<Toast, 'id'>) {
  const id = ++sequence
  toasts = [...toasts.slice(-3), { ...toast, id }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((entry) => entry.id !== id)
    emit()
  }, 3200)
}
