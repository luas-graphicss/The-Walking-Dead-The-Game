'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAYER } from '@/lib/game/config'
import { approachVelocity } from '@/lib/game/math'
import type { SurvivorDrive } from '@/lib/game/character/survivor-rig'
import { Survivor } from '@/components/game/survivor'

function groundHeight(x: number, z: number) {
  if (x > 4 && x < 9 && z > -6 && z < 6) return Math.min(1.2, Math.max(0, (z + 6) * 0.25))
  if (x > -9 && x < -4 && z > -4 && z < 4) return Math.floor(Math.max(0, z + 4) / 0.6) * 0.16
  return 0
}

const SCRIPT: [number, number, number][] = [
  [2, 0, 0], [6, PLAYER.walkSpeed, 0], [8.5, PLAYER.walkSpeed, 120], [10, 0, 120], [14, PLAYER.runSpeed, 200],
  [17, PLAYER.runSpeed, 300], [18.5, 0, 300], [22, PLAYER.walkSpeed, 30], [24, PLAYER.walkSpeed, -60], [26, 0, -60],
]

type Status = { speed: number; frame: number; cost: number; mode: string }

function Bench({ onStatus }: { onStatus: (status: Status) => void }) {
  const camera = useThree((state) => state.camera)
  const keys = useRef(new Set<string>())
  const clock = useRef(0)
  const drive = useMemo<SurvivorDrive>(() => ({
    position: new THREE.Vector3(0, 0, -8), velocity: new THREE.Vector3(), desired: new THREE.Vector3(), response: PLAYER.groundAcceleration,
    maxAcceleration: PLAYER.groundMaxAcceleration, windup: 0,
    grounded: true, swimming: false, waterLevel: 0, crouch: 0, flying: false, visible: true, teleport: 0, lookYaw: 0, faceYaw: Number.NaN, interact: null,
    ground(x, _top, z, out) { out.y = groundHeight(x, z); out.normal.set(0, 1, 0); return true },
  }), [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.code)
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    clock.current += dt
    const k = keys.current
    const manual = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((code) => k.has(code))
    let speed: number, heading: number
    if (manual) {
      const forward = Number(k.has('KeyW')) - Number(k.has('KeyS')), strafe = Number(k.has('KeyD')) - Number(k.has('KeyA'))
      heading = Math.atan2(-strafe, forward) * (180 / Math.PI)
      speed = k.has('ShiftLeft') ? PLAYER.runSpeed : PLAYER.walkSpeed
    } else {
      const t = clock.current % SCRIPT[SCRIPT.length - 1][0]
      ;[, speed, heading] = SCRIPT.find(([until]) => t < until)!
    }
    drive.crouch = THREE.MathUtils.damp(drive.crouch, k.has('KeyC') ? 1 : 0, 10, dt)
    if (drive.crouch > 0.5) speed = Math.min(speed, PLAYER.crouchSpeed)
    const h = (heading * Math.PI) / 180
    drive.desired.set(Math.sin(h) * speed, 0, Math.cos(h) * speed)
    drive.response = speed > 0 ? PLAYER.groundAcceleration : PLAYER.groundDeceleration
    drive.maxAcceleration = speed > 0 ? PLAYER.groundMaxAcceleration : PLAYER.groundMaxDeceleration
    approachVelocity(drive.velocity, drive.desired.x, drive.desired.z, drive.response, drive.maxAcceleration, dt)
    drive.position.addScaledVector(drive.velocity, dt)
    if (drive.position.length() > 13) drive.position.multiplyScalar(13 / drive.position.length())
    drive.position.y = groundHeight(drive.position.x, drive.position.z)

    const target = drive.position
    camera.position.lerp(new THREE.Vector3(target.x + 3.2, target.y + 2.1, target.z + 4.2), 1 - Math.exp(-4 * dt))
    camera.lookAt(target.x, target.y + 1, target.z)
    drive.lookYaw = Math.atan2(target.x - camera.position.x, target.z - camera.position.z)
    if (Math.floor(clock.current * 4) !== Math.floor((clock.current - dt) * 4)) {
      onStatus({ speed: Math.hypot(drive.velocity.x, drive.velocity.z), frame: 0, cost: 0, mode: manual ? 'manual' : 'roteiro' })
    }
  })

  return (
    <>
      <hemisphereLight args={['#c9d6e2', '#4a4036', 0.9]} />
      <directionalLight position={[6, 10, 4]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#6f6a5e" roughness={0.95} />
      </mesh>
      <gridHelper args={[40, 40, '#3a372f', '#56524a']} position-y={0.002} />
      <mesh position={[6.5, 0.6, 0]} rotation-x={-Math.atan(0.25)} receiveShadow castShadow>
        <boxGeometry args={[5, 0.05, 12.4]} />
        <meshStandardMaterial color="#8a8478" roughness={0.9} />
      </mesh>
      <mesh position={[6.5, 0.6, 6.6]} receiveShadow castShadow>
        <boxGeometry args={[5, 1.2, 1.2]} />
        <meshStandardMaterial color="#8a8478" roughness={0.9} />
      </mesh>
      {Array.from({ length: 13 }, (_, i) => (
        <mesh key={i} position={[-6.5, ((i + 1) * 0.16) / 2, -4 + i * 0.6 + 0.3]} receiveShadow castShadow>
          <boxGeometry args={[5, (i + 1) * 0.16, 0.6]} />
          <meshStandardMaterial color="#7d776c" roughness={0.9} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        <Survivor drive={drive} />
      </Suspense>
    </>
  )
}

export function SurvivorLab() {
  const [status, setStatus] = useState<Status>({ speed: 0, frame: 0, cost: 0, mode: 'roteiro' })
  return (
    <main className="relative h-dvh w-full bg-background text-foreground">
      <h1 className="sr-only">Laboratório do sobrevivente: motion matching e IK</h1>
      <Canvas shadows camera={{ fov: 50, position: [3, 2, -4] }} dpr={[1, 1.5]}>
        <color attach="background" args={['#9aa5ad']} />
        <Bench onStatus={setStatus} />
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1 rounded-md bg-card/80 px-3 py-2 text-sm text-card-foreground">
        <p className="font-medium">Motion matching · Bandai Namco + 100STYLE · IK de pernas</p>
        <p className="text-muted-foreground">{`Modo ${status.mode} · ${status.speed.toFixed(2)} m/s`}</p>
        <p className="text-muted-foreground">WASD mover · Shift correr · C agachar</p>
      </div>
    </main>
  )
}
