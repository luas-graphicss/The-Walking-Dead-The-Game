export function dampAngle(current: number, target: number, lambda: number, dt: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + delta * (1 - Math.exp(-lambda * dt))
}

export function approachVelocity(velocity: { x: number; z: number }, targetX: number, targetZ: number, rate: number, maxAcceleration: number, dt: number) {
  const gapX = targetX - velocity.x, gapZ = targetZ - velocity.z
  const gap = Math.hypot(gapX, gapZ)
  if (gap < 1e-6) return
  const change = Math.min(gap * (1 - Math.exp(-rate * dt)), maxAcceleration * dt) / gap
  velocity.x += gapX * change
  velocity.z += gapZ * change
}

export function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
