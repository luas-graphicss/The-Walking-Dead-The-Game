'use client'

import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CapsuleCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type RapierCollider,
  type RapierContext,
  type RapierRigidBody,
} from '@react-three/rapier'
import * as THREE from 'three'
import { PHYSICS_STEP, PLAYER, SPAWN_POSITION, WATER } from '@/lib/game/config'
import { getBoxGeometry, getCylinderGeometry } from '@/lib/game/geometry'
import { input } from '@/lib/game/input'
import { interactPose } from '@/lib/game/interaction/pose'
import { getBlockoutMaterial } from '@/lib/game/materials'
import { approachVelocity, dampAngle } from '@/lib/game/math'
import { PALETTE } from '@/lib/game/palette'
import { runtime } from '@/lib/game/runtime'
import { trackShadowMover } from '@/lib/game/shadow'
import { clampWorld } from '@/lib/game/world/settings'
import { fallExposure, riverCurrent, type FallExposure } from '@/lib/game/world/water-flow'
import type { WorldSession } from '@/lib/game/world/session'
import type { GroundHit, SurvivorDrive } from '@/lib/game/character/survivor-rig'
import { Survivor } from './survivor'

type PhysicsWorld = RapierContext['world']
type CharacterController = ReturnType<PhysicsWorld['createCharacterController']>

const STAND_HEIGHT = 2 * (PLAYER.standHalfHeight + PLAYER.radius)
const CROUCH_HEIGHT = 2 * (PLAYER.crouchHalfHeight + PLAYER.radius)
const CROUCH_SCALE = CROUCH_HEIGHT / STAND_HEIGHT

const SPAWN: [number, number, number] = [SPAWN_POSITION.x, SPAWN_POSITION.y, SPAWN_POSITION.z]
const COLLIDER_ARGS: [number, number] = [PLAYER.standHalfHeight, PLAYER.radius]
const COLLIDER_OFFSET: [number, number, number] = [0, PLAYER.standHalfHeight + PLAYER.radius, 0]
const IDENTITY_ROTATION = { x: 0, y: 0, z: 0, w: 1 }

const MIN_SLIDE_COS = Math.cos(THREE.MathUtils.degToRad(PLAYER.minSlideAngle))

type Motion = {
  velocity: THREE.Vector3
  grounded: boolean
  coyote: number
  jumpBuffer: number

  windup: number
  windupTotal: number
  wantsCrouch: boolean
  crouched: boolean
  stamina: number
  exhausted: boolean
  regenDelay: number

  swimPhase: number
}

export const Player = memo(function Player({ session }: { session: WorldSession }) {
  const { world, rapier } = useRapier()
  const bodyRef = useRef<RapierRigidBody>(null)
  const colliderRef = useRef<RapierCollider>(null)
  const controllerRef = useRef<CharacterController | null>(null)
  const anchorRef = useRef<THREE.Group>(null)
  const rigRef = useRef<THREE.Group>(null)

  const motion = useRef<Motion>({
    velocity: new THREE.Vector3(),
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    windup: 0,
    windupTotal: 0,
    wantsCrouch: false,
    crouched: false,
    stamina: PLAYER.staminaMax,
    exhausted: false,
    regenDelay: 0,
    swimPhase: 0,
  })
  const pose = useRef({ facing: Math.PI, crouch: 0, bobPhase: 0, bob: 0, lean: 0, squash: 0 })

  const scratch = useMemo(
    () => ({
      desired: new THREE.Vector3(),
      next: new THREE.Vector3(),

      current: new THREE.Vector2(),
      fall: { pool: 0, pour: 0, dirX: 0, dirZ: 0 } as FallExposure,
      ground: { y: 0, normal: new THREE.Vector3() } as GroundHit,
      standingShape: new rapier.Capsule(PLAYER.standHalfHeight, PLAYER.radius * 0.92),
    }),
    [rapier],
  )

  const drive = useMemo<SurvivorDrive>(() => {
    const ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })
    const origin = { x: 0, y: 0, z: 0 }
    return {
      position: new THREE.Vector3(), velocity: new THREE.Vector3(), desired: new THREE.Vector3(), response: PLAYER.groundAcceleration,
      maxAcceleration: PLAYER.groundMaxAcceleration, windup: 0,
      grounded: true, swimming: false, waterLevel: 0, crouch: 0, flying: false, visible: true, teleport: 0, lookYaw: 0, faceYaw: Number.NaN, interact: interactPose,
      ground(x, top, z, out) {
        origin.x = x; origin.y = top; origin.z = z
        ray.origin = origin
        const hit = world.castRayAndGetNormal(
          ray, 2.4, true,
          rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_DYNAMIC,
          undefined, colliderRef.current ?? undefined, bodyRef.current ?? undefined,
        )
        if (!hit) return false
        out.y = top - hit.timeOfImpact
        out.normal.set(hit.normal.x, hit.normal.y, hit.normal.z)
        return true
      },
    }
  }, [world, rapier])

  useEffect(() => {
    const controller = world.createCharacterController(0.02)
    controller.setUp({ x: 0, y: 1, z: 0 })
    controller.enableAutostep(PLAYER.stepHeight, 0.2, false)
    controller.enableSnapToGround(PLAYER.snapDistance)
    controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(PLAYER.maxClimbAngle))
    controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(PLAYER.minSlideAngle))
    controller.setSlideEnabled(true)
    controller.setApplyImpulsesToDynamicBodies(true)
    controller.setCharacterMass(PLAYER.mass)
    controllerRef.current = controller

    return () => {
      controllerRef.current = null
      world.removeCharacterController(controller)
    }
  }, [world])

  useEffect(() => (anchorRef.current ? trackShadowMover(anchorRef.current) : undefined), [])

  const setCrouched = (collider: RapierCollider, crouched: boolean) => {
    const halfHeight = crouched ? PLAYER.crouchHalfHeight : PLAYER.standHalfHeight
    collider.setHalfHeight(halfHeight)
    collider.setTranslationWrtParent({ x: 0, y: halfHeight + PLAYER.radius, z: 0 })
    motion.current.crouched = crouched
  }

  const hasHeadroom = (physicsWorld: PhysicsWorld, body: RapierRigidBody, collider: RapierCollider) => {
    const feet = body.translation()
    const blocker = physicsWorld.intersectionWithShape(
      { x: feet.x, y: feet.y + PLAYER.standHalfHeight + PLAYER.radius + 0.06, z: feet.z },
      IDENTITY_ROTATION,
      scratch.standingShape,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_DYNAMIC,
      undefined,
      collider,
      body,
    )
    return blocker === null
  }

  useBeforePhysicsStep((physicsWorld) => {
    const body = bodyRef.current
    const collider = colliderRef.current
    const controller = controllerRef.current
    if (!body || !collider || !controller) return

    runtime.playerBody = body
    runtime.playerCollider = collider

    const m = motion.current
    const dt = PHYSICS_STEP
    const active = input.enabled
    drive.desired.set(0, 0, 0)
    drive.windup = 0
    drive.grounded = m.grounded
    const position = body.translation()
    const worldX = position.x + runtime.origin.x, worldZ = position.z + runtime.origin.z
    const ready = session.readyAt(worldX, worldZ)
    runtime.terrainReady = ready && !runtime.travelTarget

    if (!ready || runtime.travelTarget) {
      m.velocity.set(0, 0, 0)
      body.setNextKinematicTranslation(position)
      runtime.speed = 0
      return
    }
    if (runtime.arrival) {
      const target = runtime.arrival
      const landing = session.safeLanding(target.x, target.z)
      runtime.mode = target.mode === 'fly' || !landing.walkable ? 'fly' : 'walk'
      const y = runtime.mode === 'fly' ? Math.max(landing.y, session.terrain.surface(landing.x, landing.z).waterLevel) + (landing.walkable ? 42 : 0) : landing.y
      const local = { x: landing.x - runtime.origin.x, y, z: landing.z - runtime.origin.z }
      body.setTranslation(local, true); body.setNextKinematicTranslation(local)
      m.velocity.set(0, 0, 0); m.grounded = true; m.coyote = 0; m.jumpBuffer = 0; m.windup = 0
      m.wantsCrouch = false; setCrouched(collider, false)
      runtime.playerPosition.set(local.x, local.y, local.z)
      runtime.worldPosition.set(landing.x, y, landing.z)
      runtime.playerVelocity.set(0, 0, 0)
      runtime.arrival = null; runtime.teleportVersion++; runtime.terrainReady = true
      if (!landing.walkable && target.mode === 'walk') runtime.notice = 'Sem apoio seguro aqui. Voo ativado; procure terreno seco para pousar.'
      return
    }
    if (input.flyQueued && active) {
      input.flyQueued = false
      m.velocity.set(0, 0, 0); m.jumpBuffer = 0; m.windup = 0
      if (runtime.mode === 'walk') {
        runtime.mode = 'fly'; m.wantsCrouch = false; setCrouched(collider, false)
        const lifted = { x: position.x, y: position.y + 10, z: position.z }
        body.setTranslation(lifted, true); body.setNextKinematicTranslation(lifted)
      } else runtime.arrival = { x: worldX, z: worldZ, mode: 'walk' }
      return
    }
    if (!active) {
      m.velocity.set(0, 0, 0)
      body.setNextKinematicTranslation(position)
      runtime.speed = 0; runtime.running = false
      return
    }
    if (runtime.mode === 'fly') {
      runtime.water.immersion = 0; runtime.water.swimming = false; runtime.water.pour = 0
      drive.swimming = false
      input.jumpQueued = false; input.crouchQueued = false
      const forward = Number(input.held.forward) - Number(input.held.backward) + input.moveY
      const strafe = Number(input.held.right) - Number(input.held.left) + input.moveX
      const vertical = Number(input.held.ascend) - Number(input.held.descend)
      const speed = input.held.sprint ? 320 : 65
      const yaw = runtime.cameraYaw
      scratch.desired.set(-Math.sin(yaw) * forward + Math.cos(yaw) * strafe, vertical, -Math.cos(yaw) * forward - Math.sin(yaw) * strafe)
      if (scratch.desired.lengthSq() > 1) scratch.desired.normalize()
      scratch.desired.multiplyScalar(speed)
      m.velocity.lerp(scratch.desired, 1 - Math.exp(-6 * dt))
      const nextX = clampWorld(worldX + m.velocity.x * dt), nextZ = clampWorld(worldZ + m.velocity.z * dt)
      if (nextX !== worldX + m.velocity.x * dt || nextZ !== worldZ + m.velocity.z * dt) runtime.notice = 'Limite do mundo: 4.096 × 4.096 km. Retorne ao continente.'
      const floor = session.surfaceAt(nextX, nextZ) ?? position.y - 20
      const water = session.terrain.surface(nextX, nextZ).waterLevel
      scratch.next.set(nextX - runtime.origin.x, Math.min(2400, Math.max(floor + 2, water + 2, position.y + m.velocity.y * dt)), nextZ - runtime.origin.z)
      if (session.readyAt(nextX, nextZ)) body.setNextKinematicTranslation(scratch.next)
      else { m.velocity.set(0, 0, 0); body.setNextKinematicTranslation(position) }
      runtime.speed = m.velocity.length(); runtime.playerVelocity.copy(m.velocity)
      runtime.grounded = false; runtime.running = false; runtime.crouched = false; runtime.movementState = 'fly'
      runtime.distanceTraveled += Math.hypot(m.velocity.x, m.velocity.z) * dt
      return
    }

    const fallSpeed = -m.velocity.y
    const ground = session.terrain.surface(worldX, worldZ)
    const fall = fallExposure(ground, scratch.fall)
    const waterLevel = fall.pool
    const pour = fall.pour
    const immersion = Math.max(0, waterLevel - position.y)
    const swimming = immersion > 0.6
    if (immersion > 0) riverCurrent(session.terrain, worldX, worldZ, ground, scratch.current)
    else scratch.current.set(0, 0)

    const channel = THREE.MathUtils.smoothstep(waterLevel - ground.height, 0.15, 1.2)
    const wading = swimming ? 0 : THREE.MathUtils.smoothstep(immersion, 0.08, 0.75)
    const pull = (swimming ? WATER.swimPull : WATER.wadePull * wading) * channel
    const water = runtime.water
    if (water.immersion < 0.05 && immersion >= 0.05 && fallSpeed > 2) water.splash = Math.max(water.splash, fallSpeed)
    water.level = waterLevel
    water.immersion = immersion
    water.swimming = swimming
    water.currentX = scratch.current.x * channel
    water.currentZ = scratch.current.y * channel
    water.pour = pour
    water.pourX = fall.dirX
    water.pourZ = fall.dirZ
    water.sheet = ground.waterLevel
    m.swimPhase = swimming ? m.swimPhase + dt * 2.3 : 0
    drive.swimming = swimming
    drive.waterLevel = waterLevel

    const steer = runtime.interaction
    const free = active && !steer.locked
    const forward = free ? Number(input.held.forward) - Number(input.held.backward) + input.moveY : 0
    const strafe = free ? Number(input.held.right) - Number(input.held.left) + input.moveX : 0
    if (input.jumpQueued) {
      input.jumpQueued = false
      if (free) m.jumpBuffer = PLAYER.jumpBuffer
    }
    if (input.crouchQueued) {
      input.crouchQueued = false
      if (free) m.wantsCrouch = !m.wantsCrouch
    }

    const yaw = runtime.cameraYaw
    let directionX = -Math.sin(yaw) * forward + Math.cos(yaw) * strafe
    let directionZ = -Math.cos(yaw) * forward - Math.sin(yaw) * strafe
    let inputLength = Math.hypot(directionX, directionZ)
    let guided = 1
    if (steer.moving) {
      const gapX = steer.target.x - position.x, gapZ = steer.target.z - position.z, gap = Math.hypot(gapX, gapZ)
      directionX = gap > 1e-4 ? gapX / gap : 0
      directionZ = gap > 1e-4 ? gapZ / gap : 0
      inputLength = gap > 0.015 ? 1 : 0
      guided = Math.min(steer.speed, gap * 2.6) / PLAYER.walkSpeed
    }
    const moving = inputLength > 0.01

    const tilt = Math.min(1, inputLength) * guided
    if (moving && !steer.moving) {
      directionX /= inputLength
      directionZ /= inputLength
    }
    const sprintHeld = free && input.held.sprint

    if (m.crouched && ((sprintHeld && moving) || m.jumpBuffer > 0)) {
      m.wantsCrouch = false
      m.jumpBuffer = 0
    }
    if (m.wantsCrouch !== m.crouched && (m.wantsCrouch || hasHeadroom(physicsWorld, body, collider))) {
      setCrouched(collider, m.wantsCrouch)
    }

    if (m.exhausted && m.stamina >= PLAYER.staminaRecoverThreshold) m.exhausted = false
    const running = sprintHeld && moving && !m.crouched && !m.exhausted && !swimming && wading < 0.6

    const crawling = sprintHeld && moving && swimming && !m.exhausted

    const strideSpeed = !moving
      ? 0
      : swimming
        ? PLAYER.swimSpeed * (crawling ? WATER.crawlBoost : 1)
      : running
        ? PLAYER.runSpeed
        : m.crouched
          ? PLAYER.crouchSpeed
          : PLAYER.walkSpeed
    const targetSpeed = strideSpeed * tilt * (1 - WATER.wadeDrag * wading) * (1 - WATER.pourDrag * pour)
    const response = swimming
      ? WATER.swimResponse
      : m.grounded
        ? moving
          ? PLAYER.groundAcceleration
          : PLAYER.groundDeceleration
        : PLAYER.airControl
    const maxAcceleration = swimming
      ? WATER.swimMaxAcceleration
      : m.grounded
        ? moving
          ? PLAYER.groundMaxAcceleration
          : PLAYER.groundMaxDeceleration
        : PLAYER.airMaxAcceleration

    const targetX = directionX * targetSpeed + scratch.current.x * pull + fall.dirX * WATER.pourPush * pour
    const targetZ = directionZ * targetSpeed + scratch.current.y * pull + fall.dirZ * WATER.pourPush * pour
    approachVelocity(m.velocity, targetX, targetZ, response, maxAcceleration, dt)
    drive.desired.set(directionX * targetSpeed, 0, directionZ * targetSpeed)
    drive.response = response
    drive.maxAcceleration = maxAcceleration

    const launch = () => {
      m.velocity.y = PLAYER.jumpSpeed
      m.coyote = 0
      m.stamina = Math.max(0, m.stamina - PLAYER.staminaJumpCost)
      m.regenDelay = PLAYER.staminaRegenDelay
      if (immersion > 0.05) water.leap = Math.max(water.leap, immersion)
    }
    m.coyote = m.grounded ? PLAYER.coyoteTime : m.coyote - dt
    if (m.jumpBuffer > 0 && swimming && m.coyote <= 0) {

      m.jumpBuffer = 0
      m.velocity.y = Math.max(m.velocity.y, WATER.kickSpeed)
      water.kick = 1
    }
    if (m.jumpBuffer > 0 && m.coyote > 0 && !m.crouched && m.windup === 0) {
      m.jumpBuffer = 0
      if (m.grounded && !swimming) {
        const stride = Math.min(Math.hypot(m.velocity.x, m.velocity.z) / PLAYER.runSpeed, 1)
        m.windup = m.windupTotal = THREE.MathUtils.lerp(PLAYER.jumpWindup, PLAYER.jumpWindupRunning, stride)
      } else launch()
    }
    if (m.windup > 0) {
      m.windup = Math.max(0, m.windup - dt)
      if (m.windup === 0 && m.coyote > 0) launch()
      else if (m.windup > 0) drive.windup = 1 - m.windup / m.windupTotal
    }
    m.jumpBuffer = Math.max(0, m.jumpBuffer - dt)
    m.velocity.y = swimming
      ? THREE.MathUtils.damp(m.velocity.y, (waterLevel - (input.held.ascend ? 0.5 : 0.95) - WATER.pourDepth * pour + Math.sin(m.swimPhase) * 0.035 - position.y) * 5, 7, dt)
      : Math.max(m.velocity.y - PLAYER.gravity * dt, -PLAYER.maxFallSpeed)

    scratch.desired.copy(m.velocity).multiplyScalar(dt)
    controller.computeColliderMovement(collider, scratch.desired, rapier.QueryFilterFlags.EXCLUDE_SENSORS)
    const movement = controller.computedMovement()
    const wasGrounded = m.grounded
    m.grounded = controller.computedGrounded()

    if (m.grounded && wasGrounded && !swimming && Math.hypot(targetX, targetZ) < 1e-3 && Math.hypot(m.velocity.x, m.velocity.z) < 0.05) {
      const feet = body.translation()
      if (drive.ground(feet.x, feet.y + 0.3, feet.z, scratch.ground) && scratch.ground.normal.y > MIN_SLIDE_COS) {
        movement.x = 0
        movement.z = 0
        m.velocity.x = 0
        m.velocity.z = 0
      }
    }

    if (m.grounded && m.velocity.y <= 0) {
      if (!wasGrounded) {
        runtime.landingImpact = Math.max(runtime.landingImpact, -m.velocity.y)
        runtime.cameraImpact = Math.max(runtime.cameraImpact, -m.velocity.y)
      }
      m.velocity.y = 0
    } else if (m.velocity.y > 0 && movement.y < scratch.desired.y * 0.5) {
      m.velocity.y = 0
    }

    const feet = body.translation()
    scratch.next.set(feet.x + movement.x, feet.y + movement.y, feet.z + movement.z)
    scratch.next.x = clampWorld(scratch.next.x + runtime.origin.x) - runtime.origin.x
    scratch.next.z = clampWorld(scratch.next.z + runtime.origin.z) - runtime.origin.z
    const nextWorldX = scratch.next.x + runtime.origin.x, nextWorldZ = scratch.next.z + runtime.origin.z
    const surface = session.surfaceAt(nextWorldX, nextWorldZ)
    if (!Number.isFinite(scratch.next.y) || (surface !== null && scratch.next.y < surface - 12)) {
      runtime.arrival = { x: worldX, z: worldZ, mode: 'walk' }
      m.velocity.set(0, 0, 0)
      return
    }
    if (session.readyAt(nextWorldX, nextWorldZ)) body.setNextKinematicTranslation(scratch.next)
    else { m.velocity.set(0, 0, 0); body.setNextKinematicTranslation(feet) }
    runtime.distanceTraveled += Math.hypot(movement.x, movement.z)

    const horizontalSpeed = Math.hypot(movement.x, movement.z) / dt

    if ((running && horizontalSpeed > PLAYER.walkSpeed * 0.5) || crawling) {
      m.stamina = Math.max(0, m.stamina - PLAYER.staminaDrain * dt)
      m.regenDelay = PLAYER.staminaRegenDelay
      if (m.stamina === 0) m.exhausted = true
    } else if (m.regenDelay > 0) {
      m.regenDelay -= dt
    } else {
      m.stamina = Math.min(PLAYER.staminaMax, m.stamina + PLAYER.staminaRegen * dt)
    }

    runtime.playerVelocity.copy(m.velocity)
    runtime.speed = horizontalSpeed
    runtime.grounded = m.grounded
    drive.grounded = m.grounded && !swimming
    runtime.crouched = m.crouched
    runtime.running = running && horizontalSpeed > PLAYER.walkSpeed + 0.3
    runtime.stamina = m.stamina / PLAYER.staminaMax
    runtime.exhausted = m.exhausted
    runtime.movementState = swimming
      ? 'swim'
      : !m.grounded
      ? 'air'
      : m.crouched
        ? 'crouch'
        : horizontalSpeed < 0.3
          ? 'idle'
          : runtime.running
            ? 'run'
            : 'walk'
  })

  useFrame((_, delta) => {
    const anchor = anchorRef.current
    const rig = rigRef.current
    if (!anchor || !rig) return

    const dt = Math.min(delta, 0.1)
    const p = pose.current
    anchor.getWorldPosition(runtime.playerPosition)
    runtime.worldPosition.set(runtime.playerPosition.x + runtime.origin.x, runtime.playerPosition.y, runtime.playerPosition.z + runtime.origin.z)

    const { x: velocityX, z: velocityZ } = runtime.playerVelocity
    if (velocityX * velocityX + velocityZ * velocityZ > 0.09) {
      p.facing = dampAngle(p.facing, Math.atan2(velocityX, velocityZ), PLAYER.turnSpeed, dt)
    }
    anchor.rotation.y = p.facing

    runtime.bodyPosition.copy(runtime.playerPosition)
    runtime.bodyFacing = p.facing

    p.crouch = THREE.MathUtils.damp(p.crouch, runtime.crouched ? 1 : 0, 14, dt)
    runtime.crouchAmount = p.crouch

    if (runtime.landingImpact > 0) {
      p.squash = Math.min(runtime.landingImpact / 45, 0.16)
      runtime.landingImpact = 0
    }
    p.squash = THREE.MathUtils.damp(p.squash, 0, 9, dt)

    const speed = runtime.speed
    const striding = runtime.grounded && speed > 0.3
    const speedRatio = Math.min(speed / PLAYER.runSpeed, 1)
    if (striding) p.bobPhase += dt * speed * 2.6
    p.bob = THREE.MathUtils.damp(p.bob, striding ? Math.abs(Math.sin(p.bobPhase)) * speedRatio * 0.08 : 0, 20, dt)
    p.lean = THREE.MathUtils.damp(p.lean, speedRatio * 0.14, 8, dt)

    const height = THREE.MathUtils.lerp(1, CROUCH_SCALE, p.crouch) * (1 - p.squash)
    const width = 1 + p.squash * 0.6
    rig.scale.set(width, height, width)
    rig.position.y = p.bob
    rig.rotation.x = p.lean

    const visible = runtime.cameraBoom > 0.75
    rig.visible = visible && !runtime.survivorReady

    drive.position.copy(runtime.playerPosition)
    drive.velocity.copy(runtime.playerVelocity)
    drive.crouch = p.crouch
    drive.flying = runtime.mode === 'fly'
    drive.visible = visible
    drive.teleport = runtime.teleportVersion

    drive.lookYaw = runtime.cameraYaw + Math.PI
    drive.faceYaw = runtime.interaction.faceYaw
  }, -40)

  return (
    <>
      <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={SPAWN}>
        <CapsuleCollider ref={colliderRef} args={COLLIDER_ARGS} position={COLLIDER_OFFSET} />
        <group ref={anchorRef} rotation-y={Math.PI}>
          <group ref={rigRef}>
            <SurvivorBlockout />
          </group>
        </group>
      </RigidBody>
      <Suspense fallback={null}>
        <Survivor drive={drive} />
      </Suspense>
    </>
  )
})

function SurvivorBlockout() {
  return (
    <>
      <mesh position-y={STAND_HEIGHT / 2} material={getBlockoutMaterial(PALETTE.shirt, false)} castShadow receiveShadow>
        <capsuleGeometry args={[PLAYER.radius, PLAYER.standHalfHeight * 2, 6, 16]} />
      </mesh>
      <mesh
        geometry={getCylinderGeometry(0.355, 0.32, 0.78, 16)}
        material={getBlockoutMaterial(PALETTE.pants, false)}
        position-y={0.41}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={getBoxGeometry(0.34, 0.1, 0.14)}
        material={getBlockoutMaterial(PALETTE.visor, false)}
        position={[0, 1.56, 0.27]}
      />
      <mesh
        geometry={getBoxGeometry(0.46, 0.56, 0.22)}
        material={getBlockoutMaterial(PALETTE.pack, false)}
        position={[0, 1.12, -0.36]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={getCylinderGeometry(0.44, 0.44, 0.035, 20)}
        material={getBlockoutMaterial(PALETTE.hat, false)}
        position-y={1.73}
        castShadow
      />
      <mesh
        geometry={getCylinderGeometry(0.2, 0.25, 0.18, 16)}
        material={getBlockoutMaterial(PALETTE.hat, false)}
        position-y={1.83}
        castShadow
      />
    </>
  )
}
