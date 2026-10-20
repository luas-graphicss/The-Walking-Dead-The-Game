let mobile: boolean | null = null

export function isMobileDevice() {
  if (mobile !== null) return mobile
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const forced = new URLSearchParams(window.location.search).get('perf')
  if (forced === 'mobile' || forced === 'desktop') return (mobile = forced === 'mobile')
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const touchScreen = window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) <= 1024
  mobile = /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent) || iPadOS || touchScreen
  return mobile
}

export const anisotropy = () => (isMobileDevice() ? 4 : 8)
