'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { waterfallUniforms } from '@/lib/game/assets/waterfall-material'
import { isMobileDevice } from '@/lib/game/device'
import { runtime } from '@/lib/game/runtime'
import { RippleField } from '@/lib/game/water/ripples'
import { DROPLET, MIST, SHEET, Splashes } from '@/lib/game/water/splashes'
import { CHUNK_SIZE, FALL_STRIDE } from '@/lib/game/world/settings'
import type { WorldSession } from '@/lib/game/world/session'

const TAU = Math.PI * 2
const random = (min: number, max: number) => min + Math.random() * (max - min)

const events = (rate: number, dt: number) => Math.floor(rate * dt + Math.random())
const { smoothstep } = THREE.MathUtils

const SPRAY_RANGE = 150
const DROP_RANGE = 70

const MIST_RATE = 1.8
const SPRAY_RATE = 6
const SHEET_RATE = 1.6

const RESERVE = 220

const HEAD = 1.62

function plunge(splashes: Splashes, field: RippleField, x: number, z: number, ox: number, oz: number, surface: number, impact: number) {
  const k = Math.min(impact / 6, 2)
  field.push(x + ox, z + oz, 0.5 + 0.3 * k, -0.04 * k, 0.5 + 0.2 * k)
  const sheets = Math.round(9 + 9 * k)
  for (let i = 0; i < sheets; i++) {
    const angle = (i / sheets) * TAU + random(-0.25, 0.25), out = random(0.18, 0.38)
    const radial = random(0.7, 1.7) * (0.7 + 0.3 * k), up = random(1.8, 3.2) * (0.6 + 0.4 * k)
    splashes.emit(
      x + Math.cos(angle) * out, surface + 0.04, z + Math.sin(angle) * out, Math.cos(angle) * radial, up, Math.sin(angle) * radial,
      random(0.08, 0.15) * (0.8 + 0.2 * k), random(0.45, 0.7), SHEET, surface,
    )
  }
  for (let i = 0, drops = Math.round(22 + 38 * k); i < drops; i++) {
    const angle = Math.random() * TAU, out = random(0.12, 0.45)
    const radial = random(0.6, 2.4) * (0.6 + 0.4 * k), up = random(1.6, 4.6) * (0.55 + 0.45 * k)
    splashes.emit(
      x + Math.cos(angle) * out, surface + 0.03, z + Math.sin(angle) * out, Math.cos(angle) * radial, up, Math.sin(angle) * radial,
      random(0.02, 0.05), random(0.8, 1.4), DROPLET, surface, true,
    )
  }
  for (let i = 0, puffs = 2 + Math.round(3 * k); i < puffs; i++) {
    splashes.emit(x + random(-0.35, 0.35), surface + 0.12, z + random(-0.35, 0.35), random(-0.5, 0.5), random(0.5, 1.3), random(-0.5, 0.5), random(0.35, 0.6), random(0.9, 1.4), MIST, surface)
  }
}

function leap(splashes: Splashes, field: RippleField, x: number, z: number, ox: number, oz: number, surface: number, depth: number) {
  const k = Math.min(depth / 0.6, 1)
  field.push(x + ox, z + oz, 0.35, -0.012 - 0.02 * k, 0.25)
  for (let i = 0, drops = Math.round(14 + 22 * k); i < drops; i++) {
    const angle = Math.random() * TAU, out = random(0.1, 0.3), radial = random(0.3, 1.3)
    splashes.emit(
      x + Math.cos(angle) * out, surface + random(0.02, 0.05 + 0.25 * k), z + Math.sin(angle) * out, Math.cos(angle) * radial, random(1.5, 4.2), Math.sin(angle) * radial,
      random(0.018, 0.045), random(0.8, 1.2), DROPLET, surface, true,
    )
  }
  for (let i = 0, sheets = 3 + Math.round(4 * k); i < sheets; i++) {
    const angle = Math.random() * TAU, radial = random(0.4, 1)
    splashes.emit(
      x + Math.cos(angle) * 0.2, surface + 0.05, z + Math.sin(angle) * 0.2, Math.cos(angle) * radial, random(1.6, 2.8), Math.sin(angle) * radial,
      random(0.07, 0.12), random(0.4, 0.6), SHEET, surface,
    )
  }
}

function kick(splashes: Splashes, field: RippleField, x: number, z: number, ox: number, oz: number, surface: number, hx: number, hz: number) {
  field.push(x + ox, z + oz, 0.55, -0.02, 0.35)
  for (let i = 0; i < 26; i++) {
    const angle = Math.random() * TAU, radial = random(0.4, 1.8)
    splashes.emit(
      x + Math.cos(angle) * 0.3, surface + 0.05, z + Math.sin(angle) * 0.3,
      Math.cos(angle) * radial + hx * 0.8, random(1.8, 3.8), Math.sin(angle) * radial + hz * 0.8,
      random(0.02, 0.045), random(0.8, 1.2), DROPLET, surface, true,
    )
  }
  for (let i = 0; i < 7; i++) {
    const angle = Math.random() * TAU, radial = random(0.5, 1.2)
    splashes.emit(
      x + Math.cos(angle) * 0.35, surface + 0.05, z + Math.sin(angle) * 0.35, Math.cos(angle) * radial, random(1.4, 2.4), Math.sin(angle) * radial,
      random(0.08, 0.13), random(0.4, 0.6), SHEET, surface,
    )
  }
}

function pourOver(
  splashes: Splashes, field: RippleField, x: number, head: number, z: number, ox: number, oz: number,
  surface: number, dirX: number, dirZ: number, pour: number, dt: number, thin: number,
) {
  for (let n = events(95 * pour * thin, dt); n > 0; n--) {
    const angle = Math.random() * TAU, out = random(0.08, 0.3), radial = random(1, 3)
    splashes.emit(
      x + Math.cos(angle) * out, head + random(-0.15, 0.1), z + Math.sin(angle) * out,
      Math.cos(angle) * radial + dirX * 1.2, random(0.4, 2.2), Math.sin(angle) * radial + dirZ * 1.2,
      random(0.02, 0.045), random(0.7, 1.1), DROPLET, surface, true,
    )
  }
  for (let n = events(16 * pour * thin, dt); n > 0; n--) {
    const angle = Math.random() * TAU, radial = random(0.8, 2)
    splashes.emit(
      x + Math.cos(angle) * 0.25, head - random(0.1, 0.4), z + Math.sin(angle) * 0.25,
      Math.cos(angle) * radial + dirX, random(0.5, 1.5), Math.sin(angle) * radial + dirZ,
      random(0.1, 0.18), random(0.35, 0.55), SHEET, surface,
    )
  }
  for (let n = events(5 * pour * thin, dt); n > 0; n--) {
    splashes.emit(
      x + random(-0.5, 0.5), head - random(0, 0.6), z + random(-0.5, 0.5), dirX * random(0.3, 1) + random(-0.3, 0.3), random(0.2, 0.7), dirZ * random(0.3, 1) + random(-0.3, 0.3),
      random(0.45, 0.8), random(1, 1.6), MIST, surface,
    )
  }

  if (Math.random() < pour * 0.8) {
    const angle = Math.random() * TAU, out = random(0.3, 0.9)
    field.push(x + Math.cos(angle) * out + ox, z + Math.sin(angle) * out + oz, random(0.15, 0.3), -0.012 * pour, 0.25 * pour)
  }
}

function fallSpray(splashes: Splashes, session: WorldSession, px: number, pz: number, ox: number, oz: number, dt: number, thin: number) {
  for (const chunk of session.chunks.values()) {
    const spray = chunk.spray
    if (!spray?.length) continue
    const bx = chunk.cx * CHUNK_SIZE - ox, bz = chunk.cz * CHUNK_SIZE - oz
    if (Math.hypot(bx + CHUNK_SIZE / 2 - px, bz + CHUNK_SIZE / 2 - pz) > SPRAY_RANGE + CHUNK_SIZE * 0.71) continue
    for (let i = 0; i < spray.length; i += FALL_STRIDE) {
      if (splashes.room < RESERVE) return
      const x = bx + spray[i], y = spray[i + 1], z = bz + spray[i + 2]
      const distance = Math.hypot(x - px, z - pz)
      if (distance > SPRAY_RANGE) continue
      const dirX = spray[i + 3], dirZ = spray[i + 4], height = spray[i + 5]
      const size = Math.min(Math.max(height / 12, 0.35), 1.6)
      const strength = size * (1 - smoothstep(distance, SPRAY_RANGE * 0.45, SPRAY_RANGE)) * thin
      for (let n = events(MIST_RATE * strength, dt); n > 0; n--) {
        const side = random(-1.2, 1.2), ahead = random(0.2, 2.5)
        splashes.emit(
          x + dirX * ahead - dirZ * side, y + random(0.2, 1.4), z + dirZ * ahead + dirX * side,
          dirX * random(0.6, 2) - dirZ * random(-0.4, 0.4), random(0.3, 1.1), dirZ * random(0.6, 2) + dirX * random(-0.4, 0.4),
          random(0.8, 1.7) * (0.75 + 0.25 * size), random(2.2, 3.4), MIST, y,
        )
      }
      if (distance > DROP_RANGE) continue
      const near = distance < 12
      for (let n = events(SPRAY_RATE * strength, dt); n > 0; n--) {
        const side = random(-1, 1), ahead = random(0, 1)
        splashes.emit(
          x + dirX * ahead - dirZ * side, y + random(0, 0.5), z + dirZ * ahead + dirX * side,
          dirX * random(0.8, 3.5) - dirZ * random(-1.2, 1.2), random(1.8, 4.8) * Math.min(height / 10, 1.4), dirZ * random(0.8, 3.5) + dirX * random(-1.2, 1.2),
          random(0.022, 0.05), random(0.9, 1.5), DROPLET, y, near,
        )
      }
      for (let n = events(SHEET_RATE * strength, dt); n > 0; n--) {
        const side = random(-1, 1)
        splashes.emit(
          x - dirZ * side, y + 0.1, z + dirX * side, dirX * random(0.5, 2) + random(-0.6, 0.6), random(1.6, 3.4) * Math.min(height / 10, 1.3), dirZ * random(0.5, 2) + random(-0.6, 0.6),
          random(0.12, 0.24), random(0.5, 0.8), SHEET, y,
        )
      }
    }
  }
}

export function WaterEffects({ session }: { session: WorldSession }) {
  const gl = useThree((state) => state.gl)
  const field = useMemo(() => new RippleField(gl), [gl])
  const splashes = useMemo(() => new Splashes(), [])
  const thin = useMemo(() => (isMobileDevice() ? 0.5 : 1), [])
  const memory = useRef({ shifts: -1, stride: 0, stroke: 0, tread: 0, idle: 0, side: 1, rings: 0, ox: 0, oz: 0 })

  const onDrop = useMemo(() => (x: number, z: number) => {
    const m = memory.current
    if (m.rings++ < 3) field.push(x + m.ox, z + m.oz, 0.09, -0.003, 0.02)
  }, [field])
  useEffect(() => () => { field.dispose(); splashes.dispose(); waterfallUniforms.pour.value.w = 0 }, [field, splashes])

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05)
    const water = runtime.water
    const m = memory.current

    if (m.shifts !== runtime.originShifts) { m.shifts = runtime.originShifts; splashes.clear() }
    splashes.setPixelScale((camera as THREE.PerspectiveCamera).fov, gl.domElement.height)
    const ox = runtime.origin.x, oz = runtime.origin.z
    m.ox = ox; m.oz = oz; m.rings = 0
    const { x: px, y: py, z: pz } = runtime.playerPosition
    const wx = px + ox, wz = pz + oz
    const speed = runtime.speed
    const velocity = runtime.playerVelocity
    const planar = Math.hypot(velocity.x, velocity.z)
    const hx = planar > 1e-3 ? velocity.x / planar : 0, hz = planar > 1e-3 ? velocity.z / planar : 0
    const walking = runtime.mode === 'walk'
    const surface = water.level

    if (walking && water.splash > 0) plunge(splashes, field, px, pz, ox, oz, surface, water.splash)
    if (walking && water.leap > 0) leap(splashes, field, px, pz, ox, oz, surface, water.leap)
    if (walking && water.kick > 0) kick(splashes, field, px, pz, ox, oz, surface, hx, hz)
    water.splash = 0; water.leap = 0; water.kick = 0

    if (walking && water.immersion > 0.02) {
      if (water.swimming) {
        if (speed > 0.25) {

          field.push(wx + hx * 0.4, wz + hz * 0.4, 0.4, speed * dt * 0.045, speed * dt * 0.1)
          field.push(wx - hx * 0.2, wz - hz * 0.2, 0.45, -speed * dt * 0.055, 0)
          m.stroke += dt
          if (m.stroke > 0.8) {
            m.stroke = 0
            m.side = -m.side
            const sx = px + hx * 0.55 - hz * 0.32 * m.side, sz = pz + hz * 0.55 + hx * 0.32 * m.side
            field.push(sx + ox, sz + oz, 0.22, -0.014, 0.25)
            for (let i = 0; i < 8; i++) {
              splashes.emit(
                sx, surface + 0.05, sz, hx * random(0.3, 1.1) + random(-0.4, 0.4), random(0.8, 2.2), hz * random(0.3, 1.1) + random(-0.4, 0.4),
                random(0.016, 0.034), 0.9, DROPLET, surface, true,
              )
            }
          }
        } else {

          m.tread += dt
          if (m.tread > 1.25) { m.tread = 0; field.push(wx, wz, 0.55, -0.007, 0.03) }
        }
      } else if (speed > 0.2) {

        const depth = Math.min(water.immersion / 0.8, 1)
        field.push(wx + hx * 0.12, wz + hz * 0.12, 0.2 + 0.15 * depth, -speed * dt * 0.04 * depth, speed * dt * 0.08 * depth)
        m.stride += speed * dt
        if (m.stride > 0.7) {
          m.stride = 0
          m.side = -m.side
          const fx = px + hx * 0.25 - hz * 0.12 * m.side, fz = pz + hz * 0.25 + hx * 0.12 * m.side
          const kickSize = Math.min(speed / 3.5, 1.6)
          field.push(fx + ox, fz + oz, 0.16, -0.018 * kickSize * (0.4 + depth), 0.22 * kickSize)
          for (let i = 0, count = Math.round((3 + 9 * kickSize) * (0.5 + depth)); i < count; i++) {
            splashes.emit(
              fx, surface + 0.03, fz,
              hx * speed * random(0.25, 0.6) + random(-0.5, 0.5), random(0.6, 1.8) * (0.6 + kickSize * 0.5), hz * speed * random(0.25, 0.6) + random(-0.5, 0.5),
              random(0.016, 0.034), 0.8, DROPLET, surface, true,
            )
          }
        }
      } else {

        m.idle += dt
        if (m.idle > 1.8) { m.idle = 0; field.push(wx, wz, 0.4, -0.004 * Math.min(water.immersion / 0.5, 1), 0) }
      }
    }

    const pour = walking ? water.pour : 0
    const head = py + HEAD * (1 - 0.35 * runtime.crouchAmount)
    waterfallUniforms.pour.value.set(px, head, pz, pour)
    waterfallUniforms.pourDir.value.set(water.pourX, water.pourZ)
    if (pour > 0.02) pourOver(splashes, field, px, head, pz, ox, oz, surface, water.pourX, water.pourZ, pour, dt, thin)

    fallSpray(splashes, session, px, pz, ox, oz, dt, thin)
    splashes.update(dt, onDrop)
    field.update(gl, dt, wx, wz, ox, oz, water.currentX, water.currentZ)
  }, -15)

  return <primitive object={splashes.mesh} />
}
