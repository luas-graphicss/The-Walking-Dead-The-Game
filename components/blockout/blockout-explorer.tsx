'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierCollider, type RapierContext, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import type { BlockModel, LootSocket, Vec3 } from '@/lib/game/blockout/types'

export type ExploreInput = { forward: boolean; back: boolean; left: boolean; right: boolean; turnLeft: boolean; turnRight: boolean }
export const emptyExploreInput = (): ExploreInput => ({ forward: false, back: false, left: false, right: false, turnLeft: false, turnRight: false })
type Props = { model: BlockModel; spawn: Vec3; touch: RefObject<ExploreInput>; onExit: () => void; onPosition: (position: Vec3) => void; onNearby: (socket: LootSocket | null) => void; onInspect: (socket: LootSocket) => void }

export function BlockoutExplorer({ model, spawn, touch, onExit, onPosition, onNearby, onInspect }: Props) {
  const { camera, gl } = useThree()
  const { world } = useRapier()
  const body = useRef<RapierRigidBody>(null), collider = useRef<RapierCollider>(null)
  const controller = useRef<ReturnType<RapierContext['world']['createCharacterController']> | null>(null)
  const look = useRef({ yaw: 0, pitch: 0, dragging: false, x: 0, y: 0 })
  const keys = useRef(new Set<string>())
  const velocityY = useRef(0)
  const nearby = useRef<LootSocket | null>(null)
  const lastReport = useRef(0)

  useEffect(() => {
    const next = world.createCharacterController(0.015)
    next.enableAutostep(0.3, 0.15, false)
    next.enableSnapToGround(0.32)
    next.setMaxSlopeClimbAngle(Math.PI / 4)
    next.setSlideEnabled(true)
    controller.current = next
    return () => { controller.current = null; world.removeCharacterController(next) }
  }, [world])

  useEffect(() => {
    const canvas = gl.domElement
    const ignored = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest('input,select,textarea,[role="combobox"]'))
    const down = (event: KeyboardEvent) => {
      if (ignored(event.target) || event.isComposing || event.keyCode === 229) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault()
      keys.current.add(event.code)
      if (event.code === 'Escape') onExit()
      if (event.code === 'KeyE' && !event.repeat && nearby.current) onInspect(nearby.current)
    }
    const up = (event: KeyboardEvent) => keys.current.delete(event.code)
    const clear = () => { keys.current.clear(); look.current.dragging = false; Object.assign(touch.current, emptyExploreInput()) }
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      look.current.dragging = true; look.current.x = event.clientX; look.current.y = event.clientY
      if (event.pointerType === 'mouse' && !document.pointerLockElement) {
        try { const request = canvas.requestPointerLock() as Promise<void> | undefined; request?.catch(() => {}) } catch {                                                          }
      }
      canvas.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      const locked = document.pointerLockElement === canvas
      if (!locked && !look.current.dragging) return
      const dx = locked ? event.movementX : event.clientX - look.current.x
      const dy = locked ? event.movementY : event.clientY - look.current.y
      look.current.x = event.clientX; look.current.y = event.clientY
      look.current.yaw -= dx * 0.0025
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - dy * 0.0025, -1.4, 1.4)
    }
    const release = () => { look.current.dragging = false }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear)
    canvas.addEventListener('pointerdown', pointerDown); window.addEventListener('pointermove', move); window.addEventListener('pointerup', release)
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear)
      canvas.removeEventListener('pointerdown', pointerDown); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', release)
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      clear()
    }
  }, [gl, touch, onExit, onInspect])

  useBeforePhysicsStep(() => {
    if (!body.current || !collider.current || !controller.current) return
    const dt = 1 / 60, k = keys.current, t = touch.current
    look.current.yaw += ((k.has('ArrowLeft') || t.turnLeft ? 1 : 0) - (k.has('ArrowRight') || t.turnRight ? 1 : 0)) * dt * 1.5
    let forward = Number(k.has('KeyW') || k.has('ArrowUp') || t.forward) - Number(k.has('KeyS') || k.has('ArrowDown') || t.back)
    let side = Number(k.has('KeyD') || t.right) - Number(k.has('KeyA') || t.left)
    const length = Math.hypot(forward, side) || 1
    forward /= length; side /= length
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? 5.2 : 2.8
    const yaw = look.current.yaw
    velocityY.current = controller.current.computedGrounded() ? -0.5 : Math.max(-20, velocityY.current - 20 * dt)
    if (k.has('Space') && controller.current.computedGrounded()) { velocityY.current = 5; k.delete('Space') }
    controller.current.computeColliderMovement(collider.current, { x: (-Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed * dt, y: velocityY.current * dt, z: (-Math.cos(yaw) * forward - Math.sin(yaw) * side) * speed * dt })
    const movement = controller.current.computedMovement(), position = body.current.translation()
    const next = { x: position.x + movement.x, y: position.y + movement.y, z: position.z + movement.z }
    if (next.y < -4) { body.current.setTranslation({ x: spawn[0], y: spawn[1] + 0.03, z: spawn[2] }, true); velocityY.current = 0 }
    else body.current.setNextKinematicTranslation(next)
  })

  useFrame(({ clock }) => {
    if (!body.current) return
    const position = body.current.translation()
    camera.position.set(position.x, position.y + 1.64, position.z)
    camera.rotation.set(look.current.pitch, look.current.yaw, 0, 'YXZ')
    if (clock.elapsedTime - lastReport.current < 0.2) return
    lastReport.current = clock.elapsedTime
    onPosition([position.x, position.y, position.z])
    let nearest: LootSocket | null = null, distance = 2.3
    for (const socket of model.sockets) {
      const d = Math.hypot(socket.position[0] - position.x, socket.position[1] - position.y - 0.8, socket.position[2] - position.z)
      if (d < distance) { distance = d; nearest = socket }
    }
    if (nearby.current?.id !== nearest?.id) { nearby.current = nearest; onNearby(nearest) }
  }, -10)

  return <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0], spawn[1] + 0.03, spawn[2]]}><CapsuleCollider ref={collider} args={[0.6, 0.28]} position={[0, 0.88, 0]} /></RigidBody>
}
