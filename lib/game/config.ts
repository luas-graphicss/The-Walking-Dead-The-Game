export const PHYSICS_STEP = 1 / 60

export const MAX_PHYSICS_STEPS = 4

export const WORLD = {
  halfWidth: 2_048_000,
  halfLength: 2_048_000,
  visualSize: 4_096_000,
} as const

export const SPAWN_POSITION = { x: 0, y: 220, z: 0 } as const

export const PLAYER = {
  radius: 0.35,
  standHalfHeight: 0.55,
  crouchHalfHeight: 0.2,

  walkSpeed: 3.5,
  runSpeed: 6.4,
  crouchSpeed: 1.5,
  swimSpeed: 1.4,
  groundAcceleration: 7.5,
  groundDeceleration: 10,

  airControl: 1.2,

  groundMaxAcceleration: 11,
  groundMaxDeceleration: 13,
  airMaxAcceleration: 1.5,

  jumpSpeed: 5.05,

  jumpWindup: 0.15,
  jumpWindupRunning: 0.07,
  gravity: 17,
  maxFallSpeed: 40,
  coyoteTime: 0.12,
  jumpBuffer: 0.15,
  turnSpeed: 12,
  stepHeight: 0.35,
  snapDistance: 0.35,
  maxClimbAngle: 50,
  minSlideAngle: 38,
  mass: 75,
  staminaMax: 100,
  staminaDrain: 16,
  staminaRegen: 22,
  staminaRegenDelay: 0.9,
  staminaJumpCost: 10,
  staminaRecoverThreshold: 30,
  respawnHeight: -20,
} as const

export const WATER = {

  wadeDrag: 0.5,

  wadePull: 0.55,
  swimPull: 1,

  swimResponse: 1.8,
  swimMaxAcceleration: 3.2,

  crawlBoost: 1.55,

  pourDrag: 0.3,
  pourPush: 1.1,

  pourDepth: 0.45,

  kickSpeed: 2.6,
} as const

export const CAMERA = {

  fov: 56,
  sprintFov: 62,
  near: 0.1,
  far: 3_600,
  distance: 4.6,
  minDistance: 1.8,
  maxDistance: 22,
  minBoom: 0.4,
  shoulderOffset: 0.62,
  standHeight: 1.58,
  crouchHeight: 1.05,

  restPitch: 0.15,
  minPitch: -0.5,
  maxPitch: 1.15,
  sensitivity: 0.0024,
  zoomStep: 0.0035,
  } as const
