import { smoothstep } from './noise'
import { WATER_NONE } from './settings'
import type { Surface, Terrain } from './terrain'

export function riverSpeed(slope: number, foam: number) {
  return Math.min(2.6, 0.45 + 1.9 * (1 - Math.exp(-Math.abs(slope) * 60)) + foam * 0.7) * (slope > 0 ? -1 : 1)
}

export function channelSpeed(slope: number, foam: number, downstream: number) {
  const speed = riverSpeed(slope, foam)
  return speed + (Math.abs(speed) - speed) * downstream
}

const PROBE = 2

export function poolLevel(here: Surface) {
  if (here.water !== 'river' || here.foot <= 0) return here.waterLevel
  return here.waterLevel - here.foot * smoothstep(0.25, 0.6, here.lip)
}

export function riverCurrent(terrain: Terrain, x: number, z: number, here: Surface, out: { x: number; y: number }) {
  out.x = 0
  out.y = 0
  if (here.water !== 'river' || (!here.flowX && !here.flowZ)) return out
  const base = poolLevel(here)
  const level = (px: number, pz: number) => {
    const other = terrain.surface(px, pz)
    return other.waterLevel > WATER_NONE ? poolLevel(other) : base
  }
  const ahead = level(x + here.flowX * PROBE, z + here.flowZ * PROBE)
  const behind = level(x - here.flowX * PROBE, z - here.flowZ * PROBE)
  const gradient = Math.max(Math.abs(ahead - base), Math.abs(behind - base)) / PROBE
  const speed = channelSpeed((ahead - behind) / (2 * PROBE), smoothstep(0.1, 0.45, gradient), here.downstream)
  out.x = here.flowX * speed
  out.y = here.flowZ * speed
  return out
}

export type FallExposure = {

  pool: number

  pour: number

  dirX: number; dirZ: number
}

export function fallExposure(here: Surface, out: FallExposure) {
  out.pool = poolLevel(here)
  out.pour = here.water === 'river' && here.foot > 0 ? smoothstep(0.25, 0.6, here.lip) * smoothstep(0.3, 1.4, here.foot) : 0
  out.dirX = here.fallX
  out.dirZ = here.fallZ
  return out
}
