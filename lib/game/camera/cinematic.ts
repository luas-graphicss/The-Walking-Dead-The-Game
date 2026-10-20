import { MathUtils } from 'three'

const DESIGN_ASPECT = 16 / 9

const MAX_HORIZONTAL_FOV = 100

const MAX_VERTICAL_FOV = 78

type Vec = { x: number; y: number; z: number }

export function fitFov(lens: number, aspect: number, base = lens) {
  const tanBase = Math.tan(MathUtils.degToRad(base) / 2)
  const fitted = aspect >= DESIGN_ASPECT
    ? Math.min(tanBase, Math.tan(MathUtils.degToRad(MAX_HORIZONTAL_FOV) / 2) / aspect)
    : Math.min(tanBase * Math.sqrt(DESIGN_ASPECT / aspect), Math.tan(MathUtils.degToRad(MAX_VERTICAL_FOV) / 2))
  const kick = Math.tan(MathUtils.degToRad(lens) / 2) / tanBase
  return MathUtils.radToDeg(2 * Math.atan(fitted * kick))
}

export function wander(t: number, seed: number) {
  return Math.sin(t + seed) * 0.5 + Math.sin(t * 2.137 + seed * 1.71) * 0.3 + Math.sin(t * 4.391 + seed * 2.93) * 0.2
}

export function turnBetween(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

export type Spring = { value: number; velocity: number }

export function settleSpring(spring: Spring, stiffness: number, damping: number, dt: number) {
  for (let left = dt; left > 1e-6; left -= 1 / 120) {
    const h = Math.min(left, 1 / 120)
    spring.velocity -= (stiffness * spring.value + damping * spring.velocity) * h
    spring.value += spring.velocity * h
  }
}

export type Span = { enter: number; exit: number }

export function cylinderSpan(origin: Vec, dir: Vec, axisX: number, axisZ: number, reach: number, out: Span) {
  const ox = origin.x - axisX, oz = origin.z - axisZ
  const a = dir.x * dir.x + dir.z * dir.z
  if (a < 1e-6) return false
  const b = ox * dir.x + oz * dir.z
  const disc = b * b - a * (ox * ox + oz * oz - reach * reach)
  if (disc < 0) return false
  const root = Math.sqrt(disc)
  out.enter = (-b - root) / a
  out.exit = (-b + root) / a
  return true
}
