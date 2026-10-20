'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier, type RapierCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { cylinderSpan, fitFov, settleSpring, turnBetween, wander, type Spring } from '@/lib/game/camera/cinematic'
import { CAMERA } from '@/lib/game/config'
import { isMobileDevice } from '@/lib/game/device'
import { input } from '@/lib/game/input'
import { runtime, type GamePhase } from '@/lib/game/runtime'

const { clamp, damp, degToRad, lerp, smoothstep } = THREE.MathUtils

const MENU_DRIFT_SPEED = 0.04
const LOOK_AHEAD = 3

const INDOOR_PROBE = 4.2

const INDOOR_DISTANCE = 3.2
const UP = { x: 0, y: 1, z: 0 }
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 }

const MENU_SHOT = { distance: 9.5, pitch: 0.07, fov: 48, side: 0.36, landscapeDrop: 0.12, portraitLift: 0.42 }
const MENU_TAN = Math.tan(degToRad(MENU_SHOT.fov / 2))

const CAMERA_RADIUS = 0.2

const SKIN = 0.04

const THIN_RADIUS = 0.75

const THIN_CUT = 1

const BOOM_HOLD = 0.3

const LOOK_RESPONSE = { mouse: 40, touch: 18 }
const FOLLOW = {

  ground: 11,

  vertical: 9,
  rise: 5,
  drop: 11,
  flight: 16,

  jumpShare: 0.45,

  maxLag: 1.1,
  maxDrop: 2.4,
}
const AUTO_FOLLOW = {

  touchDelay: 0.6,
  mouseDelay: 2.5,

  gain: 1.2,
  maxTurn: 0.6,

  touchPitchRate: 0.8,
  mousePitchRate: 0.45,

  slopeTilt: 0.3,

  fullAngle: 1.7,
  noAngle: 2.45,
}
const FRAMING = {

  idle: 0.9,
  sprint: 1.06,
  crouch: 0.82,
  swim: 1.1,
  fall: 1.15,
  fly: 1.35,

  low: 0.6,
  high: 1.18,

  leadTime: 0.16,
  maxLead: 0.7,
  interact: 0.84,
}

const LANDING = { kick: 0.1, stiffness: 110, damping: 9, maxDip: 0.55 }

type CameraRig = {

  yaw: number
  pitch: number
  aimYaw: number
  aimPitch: number

  lookIdle: number
  touch: boolean

  zoom: number
  distance: number

  boom: number
  boomHold: number

  reach: number
  shoulder: number
  shoulderBlend: number

  chase: THREE.Vector3
  pivotHeight: number

  last: THREE.Vector3
  velocity: THREE.Vector3
  climb: number
  heading: number
  turnRate: number
  airborne: boolean
  takeoff: number
  lead: number
  dip: Spring
  trauma: number
  stride: number
  strideAmount: number
  breath: number
  roll: number

  idle: number
  moving: number
  sprint: number
  swim: number
  fall: number
  fly: number
  heave: number
  indoor: number

  menu: number

  recenter: boolean
  recenterYaw: number
  time: number
  phase: GamePhase
  travel: number
  shifts: number
  originX: number
  originZ: number
}

function createRig(): CameraRig {
  return {
    yaw: 0, pitch: CAMERA.restPitch, aimYaw: 0, aimPitch: CAMERA.restPitch, lookIdle: 0, touch: isMobileDevice(),
    zoom: CAMERA.distance, distance: CAMERA.distance, boom: CAMERA.distance, boomHold: 0, reach: 1,
    shoulder: 1, shoulderBlend: 1,
    chase: new THREE.Vector3(), pivotHeight: 0, last: new THREE.Vector3(), velocity: new THREE.Vector3(), climb: 0,
    heading: Math.PI, turnRate: 0, airborne: false, takeoff: 0, lead: 0,
    dip: { value: 0, velocity: 0 }, trauma: 0, stride: 0, strideAmount: 0, breath: 0, roll: 0,
    idle: 0, moving: 0, sprint: 0, swim: 0, fall: 0, fly: 0, heave: 0, indoor: 0, menu: 1,
    recenter: false, recenterYaw: 0, time: 0, phase: 'menu', travel: -1,
    shifts: runtime.originShifts, originX: runtime.origin.x, originZ: runtime.origin.z,
  }
}

const steering = () =>
  input.held.forward || input.held.backward || input.held.left || input.held.right || input.moveX !== 0 || input.moveY !== 0

function readInput(r: CameraRig, dt: number, playing: boolean) {
  const lookX = input.lookX, lookY = input.lookY
  input.lookX = 0
  input.lookY = 0
  if (lookX !== 0 || lookY !== 0) {
    r.lookIdle = 0
    r.touch = input.lookTouch
    r.recenter = false
  } else r.lookIdle += dt
  r.aimYaw -= lookX * CAMERA.sensitivity
  r.aimPitch = clamp(r.aimPitch + lookY * CAMERA.sensitivity, CAMERA.minPitch, CAMERA.maxPitch)
  if (input.zoom !== 0) {
    r.zoom = clamp(r.zoom + input.zoom * CAMERA.zoomStep, CAMERA.minDistance, CAMERA.maxDistance)
    input.zoom = 0
  }
  if (input.shoulderQueued) {
    r.shoulder = -r.shoulder
    input.shoulderQueued = false
  }

  if (input.recenterQueued || (r.phase === 'menu' && playing)) {
    r.recenter = true
    r.recenterYaw = runtime.bodyFacing + Math.PI
    input.recenterQueued = false
  }
  r.phase = runtime.phase
  if (runtime.phase === 'menu') {
    r.aimYaw += dt * MENU_DRIFT_SPEED
    r.yaw += dt * MENU_DRIFT_SPEED
  }
}

function track(r: CameraRig, dt: number, flying: boolean, standHeight: number) {
  const body = runtime.bodyPosition, feet = runtime.playerPosition
  if (r.shifts !== runtime.originShifts) {
    const dx = runtime.origin.x - r.originX, dz = runtime.origin.z - r.originZ
    r.chase.x -= dx; r.chase.z -= dz
    r.last.x -= dx; r.last.z -= dz
    r.shifts = runtime.originShifts; r.originX = runtime.origin.x; r.originZ = runtime.origin.z
  }
  const head = feet.y + standHeight
  if (r.travel !== runtime.teleportVersion) {
    r.travel = runtime.teleportVersion
    r.chase.copy(body); r.last.set(body.x, feet.y, body.z); r.velocity.set(0, 0, 0); r.climb = 0
    r.pivotHeight = head; r.takeoff = feet.y; r.airborne = false; r.lead = 0
    r.dip.value = 0; r.dip.velocity = 0; r.boomHold = 0; r.reach = 1

    r.boom = Number.POSITIVE_INFINITY
  }

  let vx = (body.x - r.last.x) / dt, vz = (body.z - r.last.z) / dt
  const planar = Math.hypot(vx, vz), cap = flying ? 400 : 12
  if (planar > cap) { vx *= cap / planar; vz *= cap / planar }
  const climb = (feet.y - r.last.y) / dt
  r.last.set(body.x, feet.y, body.z)
  r.velocity.x = damp(r.velocity.x, vx, 9, dt)
  r.velocity.z = damp(r.velocity.z, vz, 9, dt)
  r.climb = damp(r.climb, runtime.grounded ? clamp(climb, -8, 8) : 0, 3, dt)

  if (flying) r.chase.copy(body)
  else {
    r.chase.x = damp(r.chase.x, body.x, FOLLOW.ground, dt)
    r.chase.z = damp(r.chase.z, body.z, FOLLOW.ground, dt)
    const gapX = body.x - r.chase.x, gapZ = body.z - r.chase.z, gap = Math.hypot(gapX, gapZ)
    if (gap > FOLLOW.maxLag) {
      const pull = 1 - FOLLOW.maxLag / gap
      r.chase.x += gapX * pull
      r.chase.z += gapZ * pull
    }
  }

  if (runtime.grounded || runtime.water.swimming || flying) {
    r.airborne = false
    r.takeoff = feet.y
  } else r.airborne = true
  const rise = feet.y - r.takeoff
  let goal = head, rate = FOLLOW.vertical
  if (flying) {
    goal += runtime.playerVelocity.y / FOLLOW.flight
    rate = FOLLOW.flight
  } else if (r.airborne && rise > 0) {
    goal = r.takeoff + rise * FOLLOW.jumpShare + standHeight
    rate = FOLLOW.rise
  } else if (r.airborne) rate = FOLLOW.drop
  r.pivotHeight = clamp(damp(r.pivotHeight, goal, rate, dt), head - 0.9, head + FOLLOW.maxDrop)
}

function absorbImpacts(r: CameraRig, dt: number, flying: boolean) {
  const impact = Math.max(runtime.cameraImpact, runtime.water.splash * 0.6)
  runtime.cameraImpact = 0
  if (impact > 3 && !flying) {
    r.dip.velocity -= Math.min(impact, 26) * LANDING.kick
    r.trauma = Math.min(1, r.trauma + smoothstep(impact, 9, 24) * 0.75)
  }
  settleSpring(r.dip, LANDING.stiffness, LANDING.damping, dt)
  r.dip.value = Math.max(r.dip.value, -LANDING.maxDip)
  r.trauma = Math.max(0, r.trauma - dt * 1.4)
}

function readState(r: CameraRig, dt: number, playing: boolean, flying: boolean, speed: number) {
  r.moving = damp(r.moving, smoothstep(speed, 0.4, 2.5), 4, dt)
  r.sprint = damp(r.sprint, runtime.running && !flying ? 1 : 0, runtime.running ? 2.2 : 1.5, dt)
  const still = playing && !flying && speed < 0.3
  r.idle = damp(r.idle, still ? 1 : 0, still ? 0.45 : 3.5, dt)
  r.swim = damp(r.swim, runtime.water.swimming ? 1 : 0, 2, dt)
  r.fall = damp(r.fall, r.airborne && runtime.playerVelocity.y < -9 ? 1 : 0, 2.5, dt)
  r.fly = damp(r.fly, flying ? 1 : 0, 2.5, dt)
  const winded = runtime.exhausted ? 1 : clamp((1 - runtime.stamina) * 1.3 - 0.15, 0, 1)
  r.heave = damp(r.heave, winded, 1.2, dt)
  if (speed > 0.8) {
    const heading = Math.atan2(r.velocity.x, r.velocity.z)
    r.turnRate = damp(r.turnRate, clamp(turnBetween(r.heading, heading) / dt, -6, 6), 6, dt)
    r.heading = heading
  } else r.turnRate = damp(r.turnRate, 0, 6, dt)
}

function steer(r: CameraRig, dt: number, playing: boolean, flying: boolean, speed: number) {
  if (r.recenter) {

    const rate = lerp(6, 2.4, r.menu), maxTurn = lerp(4.5, 2, r.menu)
    const turn = clamp(turnBetween(r.aimYaw, r.recenterYaw) * rate, -maxTurn, maxTurn) * dt
    const tilt = clamp((CAMERA.restPitch - r.aimPitch) * rate, -1.5, 1.5) * dt
    r.aimYaw += turn; r.yaw += turn
    r.aimPitch += tilt; r.pitch += tilt
    if (Math.abs(turnBetween(r.aimYaw, r.recenterYaw)) < 0.003 && Math.abs(CAMERA.restPitch - r.aimPitch) < 0.003) r.recenter = false
  } else if (playing && input.enabled && !flying && steering()) {
    const delay = r.touch ? AUTO_FOLLOW.touchDelay : AUTO_FOLLOW.mouseDelay
    const engage = smoothstep(r.lookIdle, delay, delay + 0.9) * smoothstep(speed, 1, 3.2)
    if (engage > 0) {
      if (r.touch) {
        const swing = turnBetween(r.aimYaw, r.heading + Math.PI)
        const across = 1 - smoothstep(Math.abs(swing), AUTO_FOLLOW.fullAngle, AUTO_FOLLOW.noAngle)
        const turn = clamp(swing * AUTO_FOLLOW.gain, -AUTO_FOLLOW.maxTurn, AUTO_FOLLOW.maxTurn) * engage * across * dt
        r.aimYaw += turn; r.yaw += turn
      }

      const slope = clamp(-r.climb / Math.max(speed, 1), -0.6, 0.6)
      const pitchRate = r.touch ? AUTO_FOLLOW.touchPitchRate : AUTO_FOLLOW.mousePitchRate
      const tilt = (CAMERA.restPitch + slope * AUTO_FOLLOW.slopeTilt - r.aimPitch) * (1 - Math.exp(-pitchRate * engage * dt))
      r.aimPitch += tilt; r.pitch += tilt
    }
  }
  const response = r.touch ? LOOK_RESPONSE.touch : LOOK_RESPONSE.mouse
  r.yaw = damp(r.yaw, r.aimYaw, response, dt)
  r.pitch = damp(r.pitch, r.aimPitch, response, dt)
}

function operate(camera: THREE.Camera, r: CameraRig, dt: number, speed: number, live: number) {
  const t = r.time
  const drift = (0.0022 + 0.0016 * r.moving + 0.002 * r.sprint + 0.0045 * r.heave) * live

  r.breath += dt * lerp(1.4, 3.8, r.heave)
  const breath = Math.sin(r.breath) * (0.0016 + 0.006 * r.heave) * live
  const shake = r.trauma * r.trauma * 0.035 * live
  const step = r.strideAmount * live
  r.roll = damp(r.roll, clamp(r.turnRate * 0.016 * smoothstep(speed, 1.5, 5), -0.032, 0.032) * live, 4, dt)
  camera.rotateY(wander(t * 0.55, 1.3) * drift + wander(t * 19, 7.1) * shake)
  camera.rotateX(
    wander(t * 0.47, 4.2) * drift * 0.8 + breath + r.dip.value * 0.22 * live
    + Math.sin(r.stride) * 0.0035 * step + wander(t * 23, 2.6) * shake,
  )
  camera.rotateZ(
    r.roll + wander(t * 0.39, 9.4) * drift * 0.7 + Math.sin(r.stride * 0.5) * 0.004 * step
    + Math.sin(t * 1.1 + 0.6) * 0.012 * r.swim * live + wander(t * 17, 5.5) * shake * 0.6,
  )
}

export function ThirdPersonCamera() {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const { world, rapier } = useRapier()
  const rig = useRef<CameraRig | null>(null)

  const scratch = useMemo(() => {
    const isThin = (collider: RapierCollider) =>
      collider.shapeType() === rapier.ShapeType.Cylinder && collider.radius() < THIN_RADIUS
    return {
      head: new THREE.Vector3(),
      pivot: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      sweep: new THREE.Vector3(),
      boomDir: new THREE.Vector3(),
      probe: new THREE.Vector3(),
      lookTarget: new THREE.Vector3(),
      span: { enter: 0, exit: 0 },
      overhead: new rapier.Ray({ x: 0, y: 0, z: 0 }, UP),
      ball: new rapier.Ball(CAMERA_RADIUS),
      flags: rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_DYNAMIC,
      isThin,
      isSolid: (collider: RapierCollider) => !isThin(collider),
    }
  }, [rapier])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (dt <= 0) return
    const r = (rig.current ??= createRig())
    const s = scratch
    const playing = runtime.phase === 'playing'
    const flying = runtime.mode === 'fly'
    const collider = runtime.playerCollider ?? undefined
    const body = runtime.playerBody ?? undefined
    r.time += dt

    readInput(r, dt, playing)
    const standHeight = lerp(CAMERA.standHeight, CAMERA.crouchHeight, runtime.crouchAmount)
    track(r, dt, flying, standHeight)
    const speed = Math.hypot(r.velocity.x, r.velocity.z)
    absorbImpacts(r, dt, flying)
    readState(r, dt, playing, flying, speed)
    steer(r, dt, playing, flying, speed)
    runtime.cameraYaw = r.yaw

    r.menu = damp(r.menu, playing ? 0 : 1, playing ? 2.2 : 1.5, dt)
    const shot = r.menu * r.menu * (3 - 2 * r.menu)

    const live = (1 - shot) * (1 - r.fly)

    const wide = clamp((camera.aspect - 1) / 0.4, 0, 1)

    const feet = runtime.playerPosition
    s.head.set(feet.x, feet.y + standHeight, feet.z)
    s.overhead.origin = s.head
    const ceiling = world.castRay(s.overhead, INDOOR_PROBE, true, s.flags, undefined, collider, body)
    r.indoor = damp(r.indoor, ceiling ? 1 : 0, 4, dt)

    r.distance = damp(r.distance, r.zoom, 8, dt)
    const low = 1 - smoothstep(r.pitch, CAMERA.minPitch, 0.1)
    const high = smoothstep(r.pitch, CAMERA.restPitch, CAMERA.maxPitch)

    const portrait = 1 + clamp(1 - camera.aspect, 0, 0.6) * 0.4
    const framed = r.distance * portrait
      * lerp(1, FRAMING.idle, r.idle) * lerp(1, FRAMING.sprint, r.sprint) * lerp(1, FRAMING.crouch, runtime.crouchAmount)
      * lerp(1, FRAMING.swim, r.swim) * lerp(1, FRAMING.fall, r.fall) * lerp(1, FRAMING.fly, r.fly)
      * lerp(1, FRAMING.low, low) * lerp(1, FRAMING.high, high) * lerp(1, FRAMING.interact, runtime.interaction.focus)
    const followDistance = lerp(framed, Math.min(framed, INDOOR_DISTANCE), r.indoor)
    const distance = lerp(followDistance, lerp(MENU_SHOT.distance, INDOOR_DISTANCE, r.indoor), shot)

    const pitch = lerp(r.pitch, MENU_SHOT.pitch, shot)
    const sinYaw = Math.sin(r.yaw), cosYaw = Math.cos(r.yaw), cosPitch = Math.cos(pitch)
    s.boomDir.set(sinYaw * cosPitch, Math.sin(pitch), cosYaw * cosPitch)

    r.shoulderBlend = damp(r.shoulderBlend, r.shoulder, 6, dt)

    const across = r.velocity.x * cosYaw - r.velocity.z * sinYaw
    r.lead = damp(r.lead, flying ? 0 : clamp(across * FRAMING.leadTime, -FRAMING.maxLead, FRAMING.maxLead), 2.4, dt)
    const shoulder = CAMERA.shoulderOffset * r.shoulderBlend * lerp(1, 0.85, r.sprint) * lerp(1, 1.12, runtime.crouchAmount)
    const menuSide = -MENU_SHOT.distance * MENU_SHOT.side * wide * MENU_TAN * camera.aspect
    const side = lerp(shoulder + r.lead, menuSide, shot)

    const stepRate = lerp(1.7, 2.8, smoothstep(speed, 1.5, 6.4))
    if (runtime.grounded && speed > 0.5) r.stride += dt * stepRate * Math.PI * 2
    r.strideAmount = damp(r.strideAmount, runtime.grounded && !runtime.water.swimming ? smoothstep(speed, 2.2, 6.4) : 0, 6, dt)
    const sway = (Math.sin(r.stride) * 0.012 * r.strideAmount + Math.sin(r.time * 1.7) * 0.035 * r.swim) * live
    s.pivot.set(r.chase.x + cosYaw * side, r.pivotHeight + r.dip.value * (1 - shot) + sway, r.chase.z - sinYaw * side)

    s.offset.subVectors(s.pivot, s.head)
    const span = s.offset.length()
    let clear = 1
    if (span > 1e-3) {
      s.sweep.copy(s.offset).divideScalar(span)
      const hit = world.castShape(s.head, IDENTITY, s.sweep, s.ball, 0, span, true, s.flags, undefined, collider, body)
      if (hit) clear = Math.max(0, hit.time_of_impact - SKIN) / span
    }
    r.reach = clear < r.reach ? clear : damp(r.reach, clear, 5, dt)
    s.pivot.copy(s.head).addScaledVector(s.offset, r.reach)

    const solid = world.castShape(s.pivot, IDENTITY, s.boomDir, s.ball, 0, distance, true, s.flags, undefined, collider, body, s.isSolid)
    const allowed = Math.max((solid ? solid.time_of_impact : distance) - SKIN, CAMERA.minBoom)
    if (allowed < r.boom) {
      r.boom = allowed
      if (solid) r.boomHold = BOOM_HOLD
    } else if (r.boomHold > 0) r.boomHold -= dt
    else r.boom = damp(r.boom, allowed, solid ? 3 : 5, dt)

    s.probe.copy(s.pivot).addScaledVector(s.boomDir, r.boom)
    const trunk = world.intersectionWithShape(s.probe, IDENTITY, s.ball, s.flags, undefined, collider, body, s.isThin)
    if (trunk) {
      const axis = trunk.translation()
      if (cylinderSpan(s.pivot, s.boomDir, axis.x, axis.z, trunk.radius() + CAMERA_RADIUS, s.span)) {
        const behind = s.span.exit + SKIN
        r.boom = s.span.enter > THIN_CUT || behind > allowed ? Math.max(s.span.enter - SKIN, CAMERA.minBoom) : behind
      }
    }

    camera.position.copy(s.pivot).addScaledVector(s.boomDir, r.boom)

    if (runtime.water.immersion > 0) camera.position.y = Math.max(camera.position.y, runtime.water.level + 0.3)
    runtime.cameraBoom = camera.position.distanceTo(s.head)

    const frameShift = lerp(-MENU_SHOT.portraitLift, MENU_SHOT.landscapeDrop, wide)
    const aim = Math.tan(degToRad(camera.fov / 2)) * frameShift * (r.boom + LOOK_AHEAD) * shot
    s.lookTarget.set(
      s.pivot.x - s.boomDir.x * LOOK_AHEAD,
      s.pivot.y - s.boomDir.y * LOOK_AHEAD + aim,
      s.pivot.z - s.boomDir.z * LOOK_AHEAD,
    )
    if (runtime.interaction.focus > 0) s.lookTarget.lerp(runtime.interaction.focusPoint, runtime.interaction.focus * 0.24 * (1 - shot))
    camera.lookAt(s.lookTarget)
    operate(camera, r, dt, speed, live)

    const lens = lerp(CAMERA.fov, CAMERA.sprintFov, r.sprint) + 4 * r.fall - 3 * runtime.crouchAmount - 3 * runtime.interaction.focus
      + 10 * r.fly * smoothstep(speed, 40, 320)
    const fov = damp(camera.fov, lerp(fitFov(lens, camera.aspect, CAMERA.fov), MENU_SHOT.fov, shot), 4, dt)
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }, -30)

  return null
}
