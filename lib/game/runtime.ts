import { Vector3 } from 'three'
import type { RapierCollider, RapierRigidBody } from '@react-three/rapier'

export type GamePhase = 'menu' | 'playing' | 'paused'
export type MovementState = 'idle' | 'walk' | 'run' | 'crouch' | 'air' | 'fly' | 'swim'
export type TravelMode = 'walk' | 'fly'
export type TravelTarget = { x: number; z: number; mode: TravelMode }

export const runtime = {
  phase: 'menu' as GamePhase,
  playerPosition: new Vector3(),
  playerVelocity: new Vector3(),
  playerBody: null as RapierRigidBody | null,
  playerCollider: null as RapierCollider | null,
  cameraYaw: 0,

  cameraBoom: 5.2,

  cameraImpact: 0,

  bodyPosition: new Vector3(),
  bodyFacing: Math.PI,
  crouched: false,
  crouchAmount: 0,

  survivorReady: false,
  grounded: true,
  running: false,
  speed: 0,
  stamina: 1,
  exhausted: false,
  landingImpact: 0,
  movementState: 'idle' as MovementState,
  worldPosition: new Vector3(),
  origin: { x: 0, z: 0 },
  originShifts: 0,
  teleportVersion: 0,
  terrainReady: false,
  mode: 'walk' as TravelMode,
  travelTarget: null as TravelTarget | null,
  arrival: { x: 0, z: 0, mode: 'walk' } as TravelTarget | null,
  distanceTraveled: 0,
  interaction: {
    moving: false,
    target: new Vector3(),
    speed: 1.4,
    faceYaw: Number.NaN,
    locked: false,
    active: false,
    focus: 0,
    focusPoint: new Vector3(),
  },
  biome: 'forest' as import('./world/types').Biome,
  location: 'Vale do Cedro',
  viewDistance: 920,
  fps: 0,
  notice: '',
  waterLevel: -10_000,

  water: {

    level: -10_000,

    immersion: 0,
    swimming: false,

    currentX: 0,
    currentZ: 0,

    splash: 0,

    leap: 0,

    kick: 0,

    pour: 0,
    pourX: 0,
    pourZ: 0,

    sheet: -10_000,
  },
}

export function requestTravel(x: number, z: number, mode: TravelMode = 'walk') {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return
  const limit = 2_048_000 - 20
  runtime.travelTarget = { x: Math.max(-limit, Math.min(limit, x)), z: Math.max(-limit, Math.min(limit, z)), mode }
  runtime.terrainReady = false
  runtime.notice = ''
}
