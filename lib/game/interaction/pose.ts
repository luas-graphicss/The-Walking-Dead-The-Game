import * as THREE from 'three'

export type InteractPose = {
  weight: number
  arm: number
  reach: number
  hand: number
  grip: number
  target: THREE.Vector3
  palm: THREE.Vector3
  finger: THREE.Vector3
  pole: THREE.Vector3
  look: THREE.Vector3
  lookWeight: number
  lean: number
  bend: number
  twist: number
  shrug: number
  crouch: number
}

export type SurvivorHands = {
  palmPoint(side: number, out: THREE.Vector3): THREE.Vector3
  handPose(side: number, position: THREE.Vector3, quaternion: THREE.Quaternion): void
  shoulderPoint(side: number, out: THREE.Vector3): THREE.Vector3
  headPoint(out: THREE.Vector3): THREE.Vector3
}

export const interactPose: InteractPose = {
  weight: 0, arm: -1, reach: 0, hand: 0, grip: 0,
  target: new THREE.Vector3(), palm: new THREE.Vector3(0, -1, 0), finger: new THREE.Vector3(0, 0, 1), pole: new THREE.Vector3(0, -1, 0),
  look: new THREE.Vector3(), lookWeight: 0, lean: 0, bend: 0, twist: 0, shrug: 0, crouch: 0,
}

export const survivorHands: { current: SurvivorHands | null } = { current: null }
