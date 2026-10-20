'use client'

import { use, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { MAX_PHYSICS_STEPS, PHYSICS_STEP } from '@/lib/game/config'
import { MotionDatabase } from '@/lib/game/character/motion-database'
import { SurvivorRig, type SurvivorDrive } from '@/lib/game/character/survivor-rig'
import { isMobileDevice } from '@/lib/game/device'
import { survivorHands } from '@/lib/game/interaction/pose'
import { runtime } from '@/lib/game/runtime'
import { trackShadowMover } from '@/lib/game/shadow'

const modelUrl = () => `/models/survivor/survivor${isMobileDevice() ? '.mobile' : ''}.glb`
const MOTION_URL = '/models/survivor/locomotion.mmdb'

let motion: Promise<MotionDatabase | null> | null = null

function loadMotion() {
  motion ??= MotionDatabase.load(MOTION_URL).catch((error) => {
    console.error('[survivor] motion database failed to load', error)
    return null
  })
  return motion
}

export function Survivor({ drive }: { drive: SurvivorDrive }) {
  const database = use(loadMotion())
  return database ? <SurvivorModel drive={drive} database={database} /> : null
}

function SurvivorModel({ drive, database }: { drive: SurvivorDrive; database: MotionDatabase }) {
  const { scene } = useGLTF(modelUrl())

  const rig = useMemo(() => new SurvivorRig(clone(scene), database), [scene, database])

  useEffect(() => {
    runtime.survivorReady = true
    survivorHands.current = rig
    ;(window as unknown as { __survivorRig: SurvivorRig }).__survivorRig = rig

    const untrack = trackShadowMover(rig.object)
    return () => {
      runtime.survivorReady = false
      if (survivorHands.current === rig) survivorHands.current = null
      untrack()
    }
  }, [rig])

  useFrame((_, delta) => {
    rig.update(Math.min(delta, PHYSICS_STEP * MAX_PHYSICS_STEPS), drive)
    runtime.bodyPosition.copy(rig.object.position)
    runtime.bodyFacing = 2 * Math.atan2(rig.object.quaternion.y, rig.object.quaternion.w)
  }, -39)

  return <primitive object={rig.object} />
}

if (typeof window !== 'undefined') useGLTF.preload(modelUrl())
