export type HeldAction = 'forward' | 'backward' | 'left' | 'right' | 'sprint' | 'ascend' | 'descend'

const HELD_BINDINGS: Record<string, HeldAction> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  Space: 'ascend',
  ControlLeft: 'descend',
  ControlRight: 'descend',
  KeyC: 'descend',
}

const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

const MAX_MOUSE_DELTA = 250

const TOUCH_LOOK_GAIN = 1.7

const TAP = { ms: 240, slop: 14, doubleMs: 320, doubleSlop: 56 }

export const input = {
  enabled: false,
  pointerLocked: false,
  dragging: false,
  held: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    ascend: false,
    descend: false,
  } as Record<HeldAction, boolean>,
  flyQueued: false,
  jumpQueued: false,
  crouchQueued: false,
  shoulderQueued: false,
  interactQueued: false,

  recenterQueued: false,

  lookTouch: false,

  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  zoom: 0,
}

function clamp(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, value))
}

function releaseAll() {
  for (const action of Object.keys(input.held) as HeldAction[]) {
    input.held[action] = false
  }
  input.dragging = false
  input.moveX = 0
  input.moveY = 0
}

export function setInputEnabled(enabled: boolean) {
  input.enabled = enabled
  if (!enabled) {
    releaseAll()
    input.jumpQueued = false
    input.crouchQueued = false
    input.flyQueued = false
    input.shoulderQueued = false
    input.interactQueued = false
    input.recenterQueued = false
    input.lookX = 0
    input.lookY = 0
    input.zoom = 0
  }
}

type AttachInputOptions = {
  canvas: HTMLCanvasElement
  onEscape: () => void
  onMap: () => void
}

export function attachInput({ canvas, onEscape, onMap }: AttachInputOptions) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.isContentEditable)) return
    if (event.isComposing || event.keyCode === 229) return
    if (event.code === 'KeyM' && !event.repeat) { event.preventDefault(); onMap(); return }
    if (event.code === 'Escape') {
      onEscape()
      return
    }
    if (!input.enabled) return
    if (SCROLL_KEYS.has(event.code)) event.preventDefault()

    const action = HELD_BINDINGS[event.code]
    if (action) input.held[action] = true
    if (event.repeat) return

    if (event.code === 'KeyF') input.flyQueued = true
    else if (event.code === 'Space') input.jumpQueued = true
    else if (event.code === 'KeyC') input.crouchQueued = true
    else if (event.code === 'KeyV') input.shoulderQueued = true
    else if (event.code === 'KeyE') input.interactQueued = true
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    const action = HELD_BINDINGS[event.code]
    if (action) input.held[action] = false
  }

  const handleMouseDown = (event: MouseEvent) => {
    if (event.button === 0 || event.button === 2) input.dragging = true
  }

  const handleMouseUp = () => {
    input.dragging = false
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!input.enabled) return
    if (!input.pointerLocked && !input.dragging) return
    if (event.movementX === 0 && event.movementY === 0) return
    input.lookX += clamp(event.movementX, MAX_MOUSE_DELTA)
    input.lookY += clamp(event.movementY, MAX_MOUSE_DELTA)
    input.lookTouch = false
  }

  const handleWheel = (event: WheelEvent) => {
    if (!input.enabled) return
    input.zoom += clamp(event.deltaY, 120)
  }

  const handleContextMenu = (event: MouseEvent) => event.preventDefault()
  let touch: { id: number; x: number; y: number; startX: number; startY: number; start: number } | null = null
  let lastTap = { time: Number.NEGATIVE_INFINITY, x: 0, y: 0 }
  const handleTouchStart = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || !input.enabled) return
    canvas.setPointerCapture(event.pointerId)
    touch = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, start: event.timeStamp }
  }
  const handleTouchMove = (event: PointerEvent) => {
    if (!input.enabled || !touch || touch.id !== event.pointerId) return
    input.lookX += clamp((event.clientX - touch.x) * TOUCH_LOOK_GAIN, MAX_MOUSE_DELTA)
    input.lookY += clamp((event.clientY - touch.y) * TOUCH_LOOK_GAIN, MAX_MOUSE_DELTA)
    input.lookTouch = true
    touch.x = event.clientX; touch.y = event.clientY
  }
  const handleTouchEnd = (event: PointerEvent) => {
    if (!touch || touch.id !== event.pointerId) return
    const tapped = event.type === 'pointerup'
      && event.timeStamp - touch.start < TAP.ms
      && Math.hypot(event.clientX - touch.startX, event.clientY - touch.startY) < TAP.slop
    if (tapped) {
      const repeat = event.timeStamp - lastTap.time < TAP.doubleMs && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < TAP.doubleSlop
      if (repeat && input.enabled) input.recenterQueued = true
      lastTap = repeat ? { time: Number.NEGATIVE_INFINITY, x: 0, y: 0 } : { time: event.timeStamp, x: event.clientX, y: event.clientY }
    }
    touch = null
  }
  canvas.addEventListener('pointerdown', handleTouchStart)
  canvas.addEventListener('pointermove', handleTouchMove)
  canvas.addEventListener('pointerup', handleTouchEnd)
  canvas.addEventListener('pointercancel', handleTouchEnd)

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', releaseAll)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)
  canvas.addEventListener('mousedown', handleMouseDown)
  canvas.addEventListener('wheel', handleWheel, { passive: true })
  canvas.addEventListener('contextmenu', handleContextMenu)

  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', releaseAll)
    window.removeEventListener('mouseup', handleMouseUp)
    window.removeEventListener('mousemove', handleMouseMove)
    canvas.removeEventListener('mousedown', handleMouseDown)
    canvas.removeEventListener('wheel', handleWheel)
    canvas.removeEventListener('contextmenu', handleContextMenu)
    canvas.removeEventListener('pointerdown', handleTouchStart)
    canvas.removeEventListener('pointermove', handleTouchMove)
    canvas.removeEventListener('pointerup', handleTouchEnd)
    canvas.removeEventListener('pointercancel', handleTouchEnd)
  }
}
