import * as THREE from 'three'
import { PLAYER } from '../config'
import type { MotionDatabase } from './motion-database'
import { BONE, HIPS_NODE, MOTION_BONES } from './motion-format'
import { MotionMatcher, decayVector, stepFacing, type TrajectoryInput } from './motion-matching'
import { SwimLayer } from './swim-pose'
import type { InteractPose } from '../interaction/pose'

export type GroundHit = { y: number; normal: THREE.Vector3 }

export type SurvivorDrive = {

  position: THREE.Vector3
  velocity: THREE.Vector3

  desired: THREE.Vector3

  response: number

  maxAcceleration: number

  windup: number
  grounded: boolean

  swimming: boolean

  waterLevel: number
  crouch: number
  flying: boolean
  visible: boolean

  teleport: number

  lookYaw: number
  faceYaw: number
  interact: InteractPose | null

  ground: (x: number, top: number, z: number, out: GroundHit) => boolean
}

const UNLOCK_RADIUS = 0.15
const UNLOCK_GROWTH = 0.015
const CONTACT_HALFLIFE = 0.07

const ADJUST_HALFLIFE = 0.12

const MAX_LAG = 0.2
const MAX_LAG_GROWTH = 0.03

const YAW_HALFLIFE = 0.1
const MAX_YAW_LAG = 0.5

const TURN_RATE_WALK = 5.5
const TURN_RATE_RUN = 2.3
const TURN_GRIP = 1.45

const CARRY_ABDUCTION = 0.14
const CARRY_KEEP = 0.45
const CARRY_LIFT = 0.6

const HAND_CLEARANCE = 0.25

const ELBOW_REST = 0.35

const IDLE_UNLOCK_RADIUS = 0.26

const IDLE_MIN_STANCE = 0.16
const IDLE_STANCE_SLACK = 0.08

const KNEE_MIN_FLEX = 0.035

const SWIM_DEPTH = 1.2
const SWIM_DEPTH_STILL = 1.5
const SWIM_DEPTH_SLACK = 0.15

const SWIM_TURN_HALFLIFE = 0.38
const SWIM_TURN_RATE = 1.7

const SOLE_OFF_HEIGHT = 0.02

const TOE_DOWN_HEIGHT = 0.045

const TOUCHDOWN_HEIGHT = 0.015

const HEEL_STRIKE = 0.008
const HEEL_OFF = 0.015
const PIVOT_HEEL = 0
const PIVOT_TOE = 1
const PIVOT_TIP = 2

const SETTLE_DEPTH = 0.015

const FLATTEN_TIME = 0.06
const FLATTEN_MAX = 0.5

const FOOT_EASE = 22

const SWING_CLEARANCE_SPEED = 1
const SWING_CLEARANCE_GAIN = 0.01
const SWING_CLEARANCE_MAX = 0.035

const STEP_HEIGHT = 0.07
const STEP_MIN = 0.012
const STEP_RISE = 0.05

const FINGER_CURL = [[0.12, 0.22, 0.18], [0.3, 0.45, 0.25], [0.38, 0.55, 0.3], [0.45, 0.6, 0.3], [0.55, 0.62, 0.3]]
const FINGER_GRIP = [[0.5, 0.6, 0.45], [1.05, 1.3, 0.85], [1.15, 1.4, 0.9], [1.2, 1.45, 0.9], [1.25, 1.5, 0.95]]
const FINGER_OPEN = [[-0.08, 0.02, 0.02], [0.02, 0.05, 0.03], [0.04, 0.06, 0.04], [0.06, 0.08, 0.05], [0.09, 0.1, 0.06]]
const CROUCH_DROP = 0.44

const JUMP_CROUCH = 0.17

const LANDING_ABSORB = 0.5

const COMPRESS_FREQUENCY = 12

const LANDING_FREQUENCY = 8.5

const GAIT: readonly (readonly [number, number])[] = [[0, 0], [1.5, 1.25], [PLAYER.walkSpeed, 2.75], [PLAYER.runSpeed, 3.3]]

const RUN_GAIT_FROM = 2
const RUN_GAIT_TO = 3.2

const CADENCE_SHARE = 0.45
const MIN_RATE = 0.8
const MAX_RATE = 1.4
const MIN_STRIDE = 0.8
const MAX_STRIDE = 1.55

const MAX_REACH_DROP = 0.045

const MAX_TOE_PIVOT = 0.75

const KNEE_CLEARANCE = 0.1
const KNEE_OVER_ANKLE = 0.1
const GRAVITY = 9.81
const UP = new THREE.Vector3(0, 1, 0)

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = THREE.MathUtils.clamp

function speedScale(speed: number) {
  if (speed < 0.05) return GAIT[1][0] / GAIT[1][1]
  let i = 1
  while (i < GAIT.length - 1 && speed > GAIT[i][0]) i++
  const [s0, c0] = GAIT[i - 1], [s1, c1] = GAIT[i]
  return speed / (c0 + ((speed - s0) / (s1 - s0)) * (c1 - c0))
}

type Spring = { x: number; v: number }

function stepSpring(s: Spring, target: number, frequency: number, dt: number) {
  const e = Math.exp(-frequency * dt), j0 = s.x - target, j1 = s.v + j0 * frequency
  s.x = target + e * (j0 + j1 * dt)
  s.v = e * (s.v - j1 * frequency * dt)
}

function stepOscillator(s: Spring, target: number, frequency: number, damping: number, dt: number) {
  const steps = Math.ceil(dt * frequency * 4), h = dt / steps
  for (let i = 0; i < steps; i++) {
    s.v += (frequency * frequency * (target - s.x) - 2 * damping * frequency * s.v) * h
    s.x += s.v * h
  }
}

type BindBone = { bone: THREE.Object3D; bind: THREE.Quaternion }

type Arm = {

  side: number
  clavicle: BindBone
  upper: BindBone
  fore: BindBone
  hand: BindBone

  upperDir: THREE.Vector3
  flexAxis: THREE.Vector3

  bindFlex: number

  swing: Spring
  bend: Spring
  palmOffset: THREE.Vector3
  palmBind: THREE.Vector3
  fingerBind: THREE.Vector3
  handRest: THREE.Quaternion
  fingers: { bone: THREE.Object3D; base: THREE.Quaternion; axis: THREE.Vector3; finger: number; joint: number }[]
}

class Leg {
  contact = false
  locked = false

  pivot = PIVOT_TOE

  readonly point = new THREE.Vector3()
  readonly position = new THREE.Vector3()
  readonly target = new THREE.Vector3()
  readonly offset = new THREE.Vector3()
  readonly offsetVelocity = new THREE.Vector3()

  readonly heelLast = new THREE.Vector3(NaN, 0, NaN)

  stance = 0

  solePitch = 0

  rise = 0

  reachDrop = 0

  kneeRaise = 0

  stepFrom = 0

  stepTime = 0
  stepLift = 0
  fresh = true

  readonly heel = new THREE.Vector3()
  readonly ball = new THREE.Vector3()
  readonly tip = new THREE.Vector3()
  readonly edges = [new THREE.Vector3(), new THREE.Vector3()]

  readonly toeOffset = new THREE.Vector3()

  readonly hinge = new THREE.Vector3()

  readonly thighAxis = new THREE.Vector3()

  restep = false

  flatWeight = 0
  pivotWeight = 0
  constructor(readonly thigh: THREE.Object3D, readonly calf: THREE.Object3D, readonly foot: THREE.Object3D, readonly toe: THREE.Object3D, readonly bit: number) {}
  reset() {
    this.contact = false; this.locked = false; this.pivot = PIVOT_TOE; this.heelLast.set(NaN, 0, NaN)
    this.offset.set(0, 0, 0); this.offsetVelocity.set(0, 0, 0); this.stepFrom = 0; this.stepLift = 0; this.fresh = true
    this.flatWeight = 0; this.pivotWeight = 0
  }
}

export class SurvivorRig {
  readonly object = new THREE.Group()
  readonly matcher: MotionMatcher
  readonly legs: Leg[]
  private bones: THREE.Object3D[]
  private hips: THREE.Object3D
  private rootInverse: THREE.Quaternion

  private spine1: BindBone
  private spine2: BindBone
  private neck: BindBone
  private head: BindBone
  private arms: Arm[]

  private runBlend = 0

  private armBlend = 0
  private bank = 0
  private euler = new THREE.Euler()
  private pq = Array.from({ length: 18 }, () => new THREE.Quaternion())

  private legLength: number
  private position = new THREE.Vector3()
  private yaw = 0
  private facing = 0
  private facingVelocity = 0
  private facingGoal = 0
  private hipDrop = 0

  private kneeRaise = 0
  private plant = 0
  private headYaw = 0
  private teleport = -1

  private playback = 1

  private strideWarp = 1
  private travel = new THREE.Vector3(0, 0, 1)

  private hipOffset = 0

  private air = 0
  private airTime = 0
  private airborne = false

  private inFlight = false

  private idle = false

  private jumped = false

  private support = true

  private floating = false

  private swimLayer: SwimLayer
  private swim = 0
  private hipsBind: THREE.Quaternion
  private fallSpeed = 0

  private stride = 0
  private leadLeg = 0

  private tuck = 0
  private reach = 0

  private compress: Spring = { x: 0, v: 0 }

  private armSwing: Spring = { x: 0, v: 0 }
  private input: TrajectoryInput
  private hit: GroundHit = { y: 0, normal: new THREE.Vector3() }
  private v = Array.from({ length: 11 }, () => new THREE.Vector3())
  private q = Array.from({ length: 6 }, () => new THREE.Quaternion())
  private tq = Array.from({ length: 3 }, () => new THREE.Quaternion())
  private iv = Array.from({ length: 11 }, () => new THREE.Vector3())
  private kv = Array.from({ length: 2 }, () => new THREE.Vector3())
  private kq = new THREE.Quaternion()
  private iq = Array.from({ length: 6 }, () => new THREE.Quaternion())
  private cv = Array.from({ length: 10 }, () => new THREE.Vector3())
  private cq = Array.from({ length: 5 }, () => new THREE.Quaternion())
  private sv = Array.from({ length: 4 }, () => new THREE.Vector3())
  private sq = Array.from({ length: 2 }, () => new THREE.Quaternion())
  private rv = Array.from({ length: 4 }, () => new THREE.Vector3())
  private xv = Array.from({ length: 16 }, () => new THREE.Vector3())
  private xq = Array.from({ length: 14 }, () => new THREE.Quaternion())
  private xm = Array.from({ length: 2 }, () => new THREE.Matrix4())
  private crouchNow = 0
  private fingersPosed = false

  constructor(model: THREE.Object3D, database: MotionDatabase) {

    const byName = new Map<string, THREE.Object3D>()
    model.traverse((node) => {
      byName.set(node.name.replace(/_/g, ' '), node)
      const mesh = node as THREE.SkinnedMesh
      if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false }
    })
    const bone = (name: string) => {
      const found = byName.get(name)
      if (!found) throw new Error(`survivor: missing bone ${name}`)
      return found
    }
    this.bones = MOTION_BONES.map(([, name]) => bone(name))
    this.hips = bone(HIPS_NODE)
    const root = this.hips.parent!
    this.rootInverse = root.quaternion.clone().invert()
    this.legs = [
      new Leg(this.bones[BONE.leftThigh], this.bones[BONE.leftCalf], this.bones[BONE.leftFoot], this.bones[BONE.leftToe], 1),
      new Leg(this.bones[BONE.rightThigh], this.bones[BONE.rightCalf], this.bones[BONE.rightFoot], this.bones[BONE.rightToe], 2),
    ]
    this.legLength = this.legs[0].calf.position.length() + this.legs[0].foot.position.length()
    model.updateMatrixWorld(true)

    const rootWorldInverse = root.getWorldQuaternion(new THREE.Quaternion()).invert()
    const rootMatrixInverse = root.matrixWorld.clone().invert()
    const bind = (node: THREE.Object3D): BindBone => ({ bone: node, bind: rootWorldInverse.clone().multiply(node.getWorldQuaternion(new THREE.Quaternion())) })
    const at = (node: THREE.Object3D) => node.getWorldPosition(new THREE.Vector3()).applyMatrix4(rootMatrixInverse)
    this.spine1 = bind(this.bones[BONE.spine1])
    this.spine2 = bind(this.bones[BONE.spine2])
    this.neck = bind(this.bones[BONE.neck])
    this.head = bind(this.bones[BONE.head])
    this.arms = (['L', 'R'] as const).map((s) => {
      const clavicle = bone(`Bip01 ${s} Clavicle`), upper = bone(`Bip01 ${s} UpperArm`), fore = bone(`Bip01 ${s} Forearm`), hand = bone(`Bip01 ${s} Hand`)
      const elbow = at(fore)
      const upperDir = elbow.clone().sub(at(upper)).normalize()
      const foreDir = at(hand).sub(elbow).normalize()
      const flexAxis = new THREE.Vector3().crossVectors(upperDir, foreDir)
      if (flexAxis.lengthSq() < 1e-6) flexAxis.crossVectors(new THREE.Vector3(0, 0, 1), upperDir)
      return {
        side: s === 'L' ? 1 : -1, clavicle: bind(clavicle), upper: bind(upper), fore: bind(fore), hand: bind(hand),
        upperDir, flexAxis: flexAxis.normalize(), bindFlex: upperDir.angleTo(foreDir), swing: { x: 0, v: 0 }, bend: { x: 0.3, v: 0 },
        palmOffset: new THREE.Vector3(), palmBind: new THREE.Vector3(), fingerBind: new THREE.Vector3(), handRest: hand.quaternion.clone(), fingers: [],
      }
    })
    database.canonicaliseTwist((['L', 'R'] as const).map((s) => {
      const chain = [`Bip01 ${s} Clavicle`, `Bip01 ${s} UpperArm`, `Bip01 ${s} Forearm`, `Bip01 ${s} Hand`]
      const child = [`Bip01 ${s} UpperArm`, `Bip01 ${s} Forearm`, `Bip01 ${s} Hand`, `Bip01 ${s} Finger2`]
      return {
        slots: chain.map((name) => MOTION_BONES.findIndex(([, target]) => target === name)),
        bind: chain.map((name) => bone(name).quaternion.clone()),
        axis: child.map((name) => bone(name).position.clone().normalize()),
      }
    }))
    this.relaxHands(bone)
    this.measureHands(bone, rootWorldInverse)
    this.hipsBind = this.hips.quaternion.clone()
    this.swimLayer = new SwimLayer(bone, this.hips, (node) => rootWorldInverse.clone().multiply(node.getWorldQuaternion(new THREE.Quaternion())), at)
    for (const leg of this.legs) {
      this.measureSole(leg, model)
      leg.thighAxis.copy(leg.calf.position).normalize()
      const thighInverse = leg.thigh.getWorldQuaternion(new THREE.Quaternion()).invert()
      leg.hinge.set(1, 0, 0).applyQuaternion(rootWorldInverse.clone().invert()).applyQuaternion(thighInverse)
      leg.hinge.addScaledVector(leg.thighAxis, -leg.hinge.dot(leg.thighAxis)).normalize()
    }
    const slot = new Map(this.bones.map((b, i) => [b, i]))
    this.matcher = new MotionMatcher(database, {
      bindLocal: this.bones.map((b) => b.quaternion.clone()),
      parent: this.bones.map((b) => (b.parent && slot.has(b.parent) ? slot.get(b.parent)! : -1)),
      hipsGlobal: root.quaternion.clone().multiply(this.hips.quaternion),
    })
    this.object.add(model)
    this.input = {
      position: new THREE.Vector3(), velocity: new THREE.Vector3(), desired: new THREE.Vector3(), response: 8,
      maxAcceleration: PLAYER.groundMaxAcceleration, facing: 0, facingVelocity: 0, facingGoal: 0, facingHalflife: 0.2,
      facingMaxRate: TURN_RATE_WALK,
    }
  }

  get root() { return { position: this.position, yaw: this.yaw } }

  private relaxHands(bone: (name: string) => THREE.Object3D) {
    const [hand, index, little, at, next, palm, axis] = this.v
    const [world, parent, turn] = this.q
    for (const side of ['L', 'R']) {
      bone(`Bip01 ${side} Hand`).getWorldPosition(hand)
      bone(`Bip01 ${side} Finger1`).getWorldPosition(index)
      bone(`Bip01 ${side} Finger4`).getWorldPosition(little)
      palm.crossVectors(at.copy(index).add(little).multiplyScalar(0.5).sub(hand), next.copy(index).sub(little)).normalize()

      if (palm.dot(at.set(-hand.x, -1, 0)) < 0) palm.negate()
      FINGER_CURL.forEach((curl, finger) => curl.forEach((angle, joint) => {
        const phalanx = bone(`Bip01 ${side} Finger${finger}${joint || ''}`)
        phalanx.getWorldPosition(at)

        if (joint < 2) bone(`Bip01 ${side} Finger${finger}${joint + 1}`).getWorldPosition(next).sub(at)
        else next.copy(at).sub(phalanx.parent!.getWorldPosition(axis))
        axis.crossVectors(next.normalize(), palm).normalize()
        phalanx.getWorldQuaternion(world)
        phalanx.parent!.getWorldQuaternion(parent)
        this.arms[side === 'L' ? 0 : 1].fingers.push({ bone: phalanx, base: phalanx.quaternion.clone(), axis: axis.clone().applyQuaternion(parent.clone().invert()).normalize(), finger, joint })
        phalanx.quaternion.copy(parent.invert().multiply(turn.setFromAxisAngle(axis, angle).multiply(world)))
        phalanx.updateMatrixWorld(true)
      }))
    }
  }

  private measureSole(leg: Leg, model: THREE.Object3D) {
    const points: THREE.Vector3[] = []
    const vertex = new THREE.Vector3()
    model.traverse((node) => {
      const mesh = node as THREE.SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      const joints = [mesh.skeleton.bones.indexOf(leg.foot as THREE.Bone), mesh.skeleton.bones.indexOf(leg.toe as THREE.Bone)]
      const index = mesh.geometry.getAttribute('skinIndex'), weight = mesh.geometry.getAttribute('skinWeight')
      for (let i = 0; i < index.count; i++) {
        let dominant = -1, most = 0
        for (let k = 0; k < 4; k++) if (weight.getComponent(i, k) > most) { most = weight.getComponent(i, k); dominant = index.getComponent(i, k) }
        if (joints.includes(dominant)) points.push(mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld).clone())
      }
    })
    const footAt = leg.foot.getWorldPosition(new THREE.Vector3()), toeAt = leg.toe.getWorldPosition(new THREE.Vector3())
    const footInverse = leg.foot.getWorldQuaternion(new THREE.Quaternion()).invert()
    const toeInverse = leg.toe.getWorldQuaternion(new THREE.Quaternion()).invert()
    leg.toeOffset.copy(toeAt).sub(footAt).applyQuaternion(footInverse)
    if (!points.length) return
    const bottom = Math.min(...points.map((p) => p.y))
    const forward = toeAt.clone().sub(footAt).setY(0).normalize()
    const sole = points.filter((p) => p.y < bottom + 0.015)
    const farthest = (direction: THREE.Vector3) => sole.reduce((a, b) => (b.dot(direction) > a.dot(direction) ? b : a))
    const side = new THREE.Vector3().crossVectors(UP, forward)
    const heel = farthest(forward.clone().negate())
    leg.solePitch = Math.asin(clamp((toeAt.y - heel.y) / Math.max(toeAt.distanceTo(heel), 1e-4), -1, 1))
    leg.heel.copy(heel).sub(footAt).applyQuaternion(footInverse)
    leg.ball.set(toeAt.x, bottom, toeAt.z).sub(toeAt).applyQuaternion(toeInverse)
    leg.tip.copy(farthest(forward)).sub(toeAt).applyQuaternion(toeInverse)
    leg.edges[0].copy(farthest(side)).sub(toeAt).applyQuaternion(toeInverse)
    leg.edges[1].copy(farthest(side.negate())).sub(toeAt).applyQuaternion(toeInverse)
  }

  private steer(drive: SurvivorDrive, dt: number) {
    const speed = Math.hypot(drive.desired.x, drive.desired.z)
    if (speed > 0.1) this.facingGoal = Math.atan2(drive.desired.x, drive.desired.z)
    if (Number.isFinite(drive.faceYaw) && speed < 0.7) this.facingGoal = drive.faceYaw
    const halflife = this.floating
      ? SWIM_TURN_HALFLIFE
      : THREE.MathUtils.lerp(0.17, 0.24, clamp((speed - RUN_GAIT_FROM) / (PLAYER.walkSpeed - RUN_GAIT_FROM), 0, 1))
    const maxRate = this.floating
      ? SWIM_TURN_RATE
      : clamp((TURN_GRIP * PLAYER.groundMaxAcceleration) / Math.max(speed, 0.1), TURN_RATE_RUN, TURN_RATE_WALK)
    const step = stepFacing(this.facing, this.facingVelocity, this.facingGoal, halflife, maxRate, dt)
    this.facing = step.facing
    this.facingVelocity = step.velocity
    const input = this.input
    input.facing = this.facing; input.facingVelocity = this.facingVelocity; input.facingGoal = this.facingGoal
    input.facingHalflife = halflife; input.facingMaxRate = maxRate

    const scale = speedScale(Math.hypot(drive.velocity.x, drive.velocity.z))
    if (drive.flying) {
      input.position.copy(this.position); input.velocity.set(0, 0, 0); input.desired.set(0, 0, 0)
    } else {
      input.position.copy(drive.position).sub(this.position).divideScalar(scale).add(this.position)
      input.velocity.copy(drive.velocity).divideScalar(scale)
      input.desired.copy(drive.desired).divideScalar(speedScale(speed))
    }
    input.response = drive.response
    input.maxAcceleration = drive.maxAcceleration / scale
  }

  private follow(drive: SurvivorDrive, root: THREE.Vector3, clipDt: number) {
    const dt = clipDt / this.playback

    const land = 1 - this.swim
    this.yaw = wrap(this.yaw + root.y * clipDt * land)
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw)

    const step = clipDt * this.strideWarp * land
    this.position.x += (root.x * cos + root.z * sin) * step
    this.position.z += (-root.x * sin + root.z * cos) * step
    if (drive.flying) { this.position.copy(drive.position); return }
    if (this.swim > 0) {
      const k = (1 - Math.exp(-8 * dt)) * this.swim
      this.position.x += (drive.position.x - this.position.x) * k
      this.position.z += (drive.position.z - this.position.z) * k
    }

    if (this.inFlight) {

      const k = 1 - Math.exp(-30 * dt)
      this.position.x += (drive.position.x - this.position.x) * k
      this.position.z += (drive.position.z - this.position.z) * k
    } else {
      const speed = Math.hypot(root.x, root.z) * this.playback * this.strideWarp
      const blend = 1 - Math.exp((-Math.LN2 * dt) / ADJUST_HALFLIFE)
      let ax = (drive.position.x - this.position.x) * blend, az = (drive.position.z - this.position.z) * blend
      const limit = (0.5 * speed + 0.1) * dt, length = Math.hypot(ax, az)
      if (length > limit) { ax *= limit / length; az *= limit / length }
      this.position.x += ax; this.position.z += az
    }
    const dx = drive.position.x - this.position.x, dz = drive.position.z - this.position.z, lag = Math.hypot(dx, dz)
    const maxLag = MAX_LAG + MAX_LAG_GROWTH * Math.hypot(drive.velocity.x, drive.velocity.z)
    if (lag > maxLag) { this.position.x += dx * (1 - maxLag / lag); this.position.z += dz * (1 - maxLag / lag) }

    let turn = wrap(this.facing - this.yaw) * (1 - Math.exp((-Math.LN2 * dt) / YAW_HALFLIFE))
    const turnLimit = (0.75 * Math.abs(root.y) * this.playback * land + 1.5 + 2 * this.swim) * dt
    turn = clamp(turn, -turnLimit, turnLimit)
    this.yaw = wrap(this.yaw + turn)
    const behind = wrap(this.facing - this.yaw)
    if (Math.abs(behind) > MAX_YAW_LAG) this.yaw = wrap(this.facing - Math.sign(behind) * MAX_YAW_LAG)

    const dy = drive.position.y - this.position.y
    this.position.y = this.inFlight || Math.abs(dy) > 1.2 ? drive.position.y : THREE.MathUtils.damp(this.position.y, drive.position.y, 18, dt)
  }

  update(dt: number, drive: SurvivorDrive) {
    this.object.visible = drive.visible
    if (dt <= 0) return
    const interact = drive.interact
    this.crouchNow = Math.max(drive.crouch, interact ? interact.crouch * interact.weight : 0)
    if (drive.teleport !== this.teleport || this.position.distanceToSquared(drive.position) > 9) {
      this.teleport = drive.teleport
      this.position.copy(drive.position)
      if (drive.velocity.lengthSq() > 0.01) this.facing = this.facingGoal = this.yaw = Math.atan2(drive.velocity.x, drive.velocity.z)
      this.legs.forEach((leg) => leg.reset())
      this.resetJump()
      this.swim = 0
      this.floating = false
    }
    this.updateFloating(drive, dt)
    this.support = drive.grounded || (drive.swimming && !this.floating)
    this.updateJump(drive, dt)
    this.steer(drive, dt)

    const capsuleSpeed = Math.hypot(drive.velocity.x, drive.velocity.z)
    const clipSpeed = Math.hypot(this.matcher.pose.root.x, this.matcher.pose.root.z)
    this.idle = !drive.flying && Math.hypot(drive.desired.x, drive.desired.z) < 0.05 && capsuleSpeed < 0.2
    let rate = 1, stride = 1
    if (!this.inFlight && capsuleSpeed > 0.3 && clipSpeed > 0.3) {
      const ratio = capsuleSpeed / clipSpeed
      rate = clamp(ratio ** CADENCE_SHARE, MIN_RATE, MAX_RATE)
      stride = clamp(ratio / rate, MIN_STRIDE, MAX_STRIDE)
    }
    this.playback = THREE.MathUtils.damp(this.playback, rate, 5, dt)
    this.strideWarp = THREE.MathUtils.damp(this.strideWarp, stride, 5, dt)

    const pose = this.matcher.update(dt, this.yaw, this.position, this.input, this.playback * (1 - 0.55 * this.air))
    const travel = Math.hypot(pose.root.x, pose.root.z)
    if (travel > 0.05) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw)
      this.travel.set((pose.root.x * cos + pose.root.z * sin) / travel, 0, (-pose.root.x * sin + pose.root.z * cos) / travel)
    }
    this.follow(drive, pose.root, dt * this.playback)

    pose.rotations.forEach((q, b) => this.bones[b].quaternion.copy(q))
    for (const leg of this.legs) this.limitKnee(leg)
    this.hips.quaternion.copy(this.hipsBind)
    this.hips.position.copy(pose.hips).applyQuaternion(this.rootInverse)
    this.hipOffset = this.hipDrop - this.crouchNow * CROUCH_DROP + this.compress.x + this.kneeRaise
    this.hips.position.y += this.hipOffset
    this.object.position.copy(this.position)
    this.object.quaternion.setFromAxisAngle(UP, this.yaw)
    this.object.updateMatrixWorld(true)

    const grounded = (this.support || !this.inFlight) && !drive.flying && !this.floating
    this.plant = THREE.MathUtils.damp(this.plant, grounded ? 1 : 0, 10, dt)
    const [left, right] = this.legs
    if (this.idle && left.locked && right.locked) {
      const spacing = Math.hypot(left.position.x - right.position.x, left.position.z - right.position.z)
      const wanted = Math.hypot(left.target.x - right.target.x, left.target.z - right.target.z)
      if (spacing < IDLE_MIN_STANCE && spacing < wanted - IDLE_STANCE_SLACK) {
        const off = (leg: Leg) => Math.hypot(leg.position.x - leg.target.x, leg.position.z - leg.target.z)
        ;(off(left) > off(right) ? left : right).restep = true
      }
    }
    for (const leg of this.legs) this.solveLeg(leg, pose.contacts, drive, dt)

    const settle = grounded ? Math.min(0, Math.min(left.rise, right.rise) + this.crouchNow * CROUCH_DROP) - Math.max(left.reachDrop, right.reachDrop) : 0
    this.hipDrop = THREE.MathUtils.damp(this.hipDrop, settle, settle < this.hipDrop ? 14 : 7, dt)
    const raise = grounded ? Math.min(Math.max(left.kneeRaise, right.kneeRaise), this.crouchNow * CROUCH_DROP - Math.min(0, this.hipDrop)) : 0

    this.kneeRaise = THREE.MathUtils.damp(this.kneeRaise, raise, raise > this.kneeRaise ? 14 : 1.1, dt)
    this.posture(drive, Math.hypot(pose.root.x, pose.root.z), dt)
    if (interact && interact.weight > 0.001 && this.swim < 0.5) this.interactLayer(interact)
    else if (this.fingersPosed) this.relaxFingers()
    if (this.swim > 0.001) {
      const look = wrap(drive.lookYaw - this.yaw)
      this.swimLayer.update(dt, {
        effort: Math.hypot(drive.desired.x, drive.desired.z),
        turnRate: this.facingVelocity,
        look: Math.abs(look) < 1.9 ? look : 0,
        surface: drive.waterLevel - this.position.y,
      })
      this.swimLayer.apply(this.swim)
      this.object.updateMatrixWorld(true)
    } else this.swimLayer.reset(Math.hypot(drive.desired.x, drive.desired.z))
  }

  private updateFloating(drive: SurvivorDrive, dt: number) {
    let floating = false
    if (drive.swimming && !drive.flying) {
      const still = Math.hypot(drive.desired.x, drive.desired.z) < 0.3
      const bed = drive.ground(drive.position.x, drive.waterLevel + 0.2, drive.position.z, this.hit) ? drive.waterLevel - this.hit.y : Infinity
      floating = bed > (still ? SWIM_DEPTH_STILL : SWIM_DEPTH) - (this.floating ? SWIM_DEPTH_SLACK : 0)
    }
    this.floating = floating
    this.swim = THREE.MathUtils.damp(this.swim, floating ? 1 : 0, floating ? 3.2 : 4, dt)
  }

  private resetJump() {
    this.air = 0; this.airTime = 0; this.airborne = false; this.jumped = false; this.fallSpeed = 0
    this.tuck = 0; this.reach = 0
    this.compress.x = this.compress.v = 0
    this.armSwing.x = this.armSwing.v = 0
  }

  private updateJump(drive: SurvivorDrive, dt: number) {
    const airborne = !this.support && !drive.flying && !this.floating
    const vy = drive.velocity.y
    if (airborne && !this.airborne) {
      this.jumped = vy > 1.5
      this.airTime = 0
      this.stride = clamp((Math.hypot(drive.velocity.x, drive.velocity.z) - 1) / 2.5, 0, 1)

      const [a, b] = this.v
      this.legs[0].toe.getWorldPosition(a); this.legs[1].toe.getWorldPosition(b)
      this.leadLeg = (a.x - b.x) * Math.sin(this.yaw) + (a.z - b.z) * Math.cos(this.yaw) >= 0 ? 0 : 1
    }
    if (airborne) {
      this.airTime += dt
      this.fallSpeed = Math.max(0, -vy)
    } else if (this.inFlight && !drive.flying && !this.floating) {

      this.compress.v -= Math.min(this.fallSpeed, 14) * LANDING_ABSORB
      this.fallSpeed = 0
    }
    this.airborne = airborne
    this.inFlight = airborne && (this.jumped || this.airTime > 0.12 || vy < -2.5)
    const flight = this.inFlight
    this.air = THREE.MathUtils.damp(this.air, flight ? 1 : 0, flight ? 16 : 24, dt)

    let height = Infinity
    if (flight && drive.ground(this.position.x, this.position.y + 0.5, this.position.z, this.hit)) height = this.position.y - this.hit.y

    const untilLanding = vy < -0.1 ? height / -vy : Infinity
    this.reach = flight ? clamp(1 - (untilLanding - 0.05) / 0.17, 0, 1) : 0
    const folding = THREE.MathUtils.smoothstep(this.airTime, 0.04, 0.28)
    const tuck = flight ? (this.jumped ? 1 : 0.35) * folding * (1 - this.reach) : 0
    this.tuck = THREE.MathUtils.damp(this.tuck, tuck, tuck < this.tuck ? 24 : 12, dt)

    const windup = Math.min(drive.windup, 1)
    const frequency = windup > 0 ? COMPRESS_FREQUENCY * 2.6 : flight ? COMPRESS_FREQUENCY : LANDING_FREQUENCY
    stepSpring(this.compress, flight ? 0 : -JUMP_CROUCH * Math.sin(windup * Math.PI * 0.5), frequency, dt)
    this.compress.x = clamp(this.compress.x, -0.26, 0.05)

    const rising = clamp(vy / PLAYER.jumpSpeed, 0, 1)
    const swing = windup > 0
      ? -0.5 * windup
      : flight
        ? (this.jumped ? 0.18 + 0.6 * rising : 0.15)
        : clamp(-this.compress.x / JUMP_CROUCH, 0, 1) * 0.3
    stepSpring(this.armSwing, swing * (1 - 0.5 * this.stride), windup > 0 ? 26 : 13, dt)
  }

  palmPoint(side: number, out: THREE.Vector3) {
    const arm = this.arms[side > 0 ? 0 : 1]
    return out.copy(arm.palmOffset).applyQuaternion(arm.hand.bone.getWorldQuaternion(this.xq[12])).add(arm.hand.bone.getWorldPosition(this.xv[15]))
  }

  handPose(side: number, position: THREE.Vector3, quaternion: THREE.Quaternion) {
    const arm = this.arms[side > 0 ? 0 : 1]
    arm.hand.bone.getWorldQuaternion(quaternion)
    position.copy(arm.palmOffset).applyQuaternion(quaternion).add(arm.hand.bone.getWorldPosition(this.xv[15]))
  }

  shoulderPoint(side: number, out: THREE.Vector3) {
    return this.arms[side > 0 ? 0 : 1].upper.bone.getWorldPosition(out)
  }

  headPoint(out: THREE.Vector3) {
    return this.head.bone.getWorldPosition(out)
  }

  private measureHands(bone: (name: string) => THREE.Object3D, rootWorldInverse: THREE.Quaternion) {
    const [hand, index, middle, little, palm, center, mid, across] = this.xv
    for (const arm of this.arms) {
      const s = arm.side > 0 ? 'L' : 'R'
      arm.hand.bone.getWorldPosition(hand)
      bone(`Bip01 ${s} Finger1`).getWorldPosition(index)
      bone(`Bip01 ${s} Finger2`).getWorldPosition(middle)
      bone(`Bip01 ${s} Finger4`).getWorldPosition(little)
      palm.crossVectors(mid.copy(index).add(little).multiplyScalar(0.5).sub(hand), across.copy(index).sub(little)).normalize()
      if (palm.dot(center.set(-hand.x, -1, 0)) < 0) palm.negate()
      arm.palmBind.copy(palm).applyQuaternion(rootWorldInverse).normalize()
      arm.fingerBind.copy(middle).sub(hand).applyQuaternion(rootWorldInverse).normalize()
      center.copy(middle).sub(hand).multiplyScalar(0.55).addScaledVector(palm, 0.014)
      arm.palmOffset.copy(center).applyQuaternion(arm.hand.bone.getWorldQuaternion(this.xq[0]).invert())
    }
  }

  private interactLayer(pose: InteractPose) {
    const w = pose.weight
    const rootWorld = this.hips.parent!.getWorldQuaternion(this.xq[0])
    const rootInverse = this.xq[1].copy(rootWorld).invert()
    const toward = this.spine2.bone.getWorldPosition(this.xv[0])
    toward.subVectors(pose.target, toward).applyQuaternion(rootInverse)
    const flat = Math.hypot(toward.x, toward.z)
    const shoulder = this.arms[pose.arm > 0 ? 0 : 1].upper.bone.getWorldPosition(this.xv[1])
    const shortfall = pose.reach * Math.max(0, shoulder.distanceTo(pose.target) - 0.5) * (toward.z > 0 || toward.y < -0.35 ? 1 : 0.25)
    const pitch = (clamp(Math.atan2(-toward.y, Math.max(flat, 0.2)) * 0.5, -0.15, 0.7) * pose.lean + pose.bend + Math.min(1.05, shortfall * 2.3)) * w
    const yaw = (clamp(Math.atan2(toward.x, Math.max(toward.z, 0.08)) * 0.3, -0.4, 0.4) * pose.lean + pose.twist) * w
    if (Math.abs(pitch) + Math.abs(yaw) > 1e-4) {
      this.turn(this.spine1.bone, this.xq[2].setFromEuler(this.euler.set(pitch * 0.4, yaw * 0.45, 0, 'YXZ')), rootWorld)
      this.turn(this.spine2.bone, this.xq[2].setFromEuler(this.euler.set(pitch * 0.6, yaw * 0.55, 0, 'YXZ')), rootWorld)
      this.spine1.bone.updateMatrixWorld(true)
    }
    if (pose.lookWeight > 0.001) this.lookAt(pose.look, pose.lookWeight * w, rootWorld, rootInverse)
    const arm = this.arms[pose.arm > 0 ? 0 : 1], other = this.arms[pose.arm > 0 ? 1 : 0]
    if (pose.reach > 0.001) this.reachArm(arm, pose, pose.reach * w, rootWorld, rootInverse)
    this.poseFingers(arm, pose.grip * w)
    this.poseFingers(other, 0)
    arm.clavicle.bone.updateMatrixWorld(true)
    other.hand.bone.updateMatrixWorld(true)
    this.fingersPosed = true
  }

  private lookAt(target: THREE.Vector3, weight: number, rootWorld: THREE.Quaternion, rootInverse: THREE.Quaternion) {
    const at = this.head.bone.getWorldPosition(this.xv[1])
    const want = this.xv[2].subVectors(target, at).applyQuaternion(rootInverse).normalize()
    const now = this.head.bone.getWorldQuaternion(this.xq[3]).premultiply(rootInverse).multiply(this.xq[4].copy(this.head.bind).invert())
    const face = this.xv[3].set(0, 0, 1).applyQuaternion(now)
    const yaw = clamp(wrap(Math.atan2(want.x, want.z) - Math.atan2(face.x, face.z)), -1.25, 1.25) * weight
    const pitch = clamp(Math.asin(clamp(face.y, -1, 1)) - Math.asin(clamp(want.y, -1, 1)), -0.6, 0.85) * weight
    this.turn(this.neck.bone, this.xq[2].setFromEuler(this.euler.set(pitch * 0.4, yaw * 0.4, 0, 'YXZ')), rootWorld)
    this.turn(this.head.bone, this.xq[2].setFromEuler(this.euler.set(pitch * 0.6, yaw * 0.6, 0, 'YXZ')), rootWorld)
    this.neck.bone.updateMatrixWorld(true)
  }

  private reachArm(arm: Arm, pose: InteractPose, weight: number, rootWorld: THREE.Quaternion, rootInverse: THREE.Quaternion) {
    const [shoulder, elbow, wrist, goal, dir, bend, upper, fore, offset, local, hinge, twistAxis] = this.xv.slice(4)
    const [delta, frame, hand, upperWorld, foreWorld, spare, twist, half] = this.xq.slice(2)
    arm.upper.bone.getWorldPosition(shoulder)
    local.subVectors(pose.target, shoulder).applyQuaternion(rootInverse)
    const lift = (clamp((local.y + 0.1) / 0.5, 0, 1) * 0.2 + pose.shrug) * weight
    const protract = clamp((local.length() - 0.3) / 0.3, 0, 1) * 0.18 * clamp(local.z * 4, -1, 1) * weight
    if (Math.abs(lift) + Math.abs(protract) > 1e-4) {
      this.turn(arm.clavicle.bone, delta.setFromEuler(this.euler.set(0, -arm.side * protract, arm.side * lift, 'YXZ')), rootWorld)
      arm.clavicle.bone.updateMatrixWorld(true)
      arm.upper.bone.getWorldPosition(shoulder)
    }
    this.frameBetween(arm.fingerBind, arm.palmBind, pose.finger, pose.palm, frame)
    hand.copy(frame).multiply(arm.hand.bind)
    goal.copy(pose.target).sub(offset.copy(arm.palmOffset).applyQuaternion(hand))
    arm.fore.bone.getWorldPosition(elbow)
    arm.hand.bone.getWorldPosition(wrist)
    const l1 = shoulder.distanceTo(elbow), l2 = elbow.distanceTo(wrist)
    dir.subVectors(goal, shoulder)
    const span = dir.length()
    if (span < 1e-5 || l1 < 1e-5 || l2 < 1e-5) return
    dir.divideScalar(span)
    const reach = clamp(span, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999)
    const along = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach), out = Math.sqrt(Math.max(0, l1 * l1 - along * along))
    bend.copy(pose.pole).addScaledVector(dir, -pose.pole.dot(dir))
    if (bend.lengthSq() < 1e-6) bend.set(0, -1, 0).addScaledVector(dir, dir.y)
    bend.normalize()
    upper.copy(dir).multiplyScalar(along).addScaledVector(bend, out)
    fore.copy(dir).multiplyScalar(reach).sub(upper)
    const phi = upper.angleTo(fore)
    upper.normalize()
    fore.normalize()
    hinge.crossVectors(upper, fore)
    if (hinge.lengthSq() < 1e-8) hinge.crossVectors(upper, bend)
    hinge.normalize()
    this.frameBetween(arm.upperDir, arm.flexAxis, upper, hinge, frame)
    upperWorld.copy(frame).multiply(arm.upper.bind)
    foreWorld.copy(frame).multiply(spare.setFromAxisAngle(arm.flexAxis, phi - arm.bindFlex)).multiply(arm.fore.bind)
    const clavicle = arm.clavicle.bone.getWorldQuaternion(this.xq[10])
    arm.upper.bone.quaternion.slerp(clavicle.invert().multiply(upperWorld), weight)
    const foreLocal = this.xq[11].copy(upperWorld).invert().multiply(foreWorld)
    const handLocal = spare.copy(foreWorld).invert().multiply(hand)
    twistAxis.copy(arm.hand.bone.position).normalize()
    const rel = this.xq[13].copy(handLocal).multiply(this.xq[12].copy(arm.handRest).invert())
    const dot = rel.x * twistAxis.x + rel.y * twistAxis.y + rel.z * twistAxis.z
    twist.set(twistAxis.x * dot, twistAxis.y * dot, twistAxis.z * dot, rel.w)
    if (twist.lengthSq() > 1e-8) {
      twist.normalize()
      half.identity().slerp(twist, 0.5)
      foreLocal.multiply(half)
      handLocal.premultiply(half.invert())
    }
    arm.fore.bone.quaternion.slerp(foreLocal, weight)
    arm.hand.bone.quaternion.slerp(handLocal, weight * pose.hand)
  }

  private frameBetween(a0: THREE.Vector3, b0: THREE.Vector3, a1: THREE.Vector3, b1: THREE.Vector3, out: THREE.Quaternion) {
    const [x0, y0, z0, x1, y1, z1] = this.cv
    x0.copy(a0).normalize()
    y0.copy(b0).addScaledVector(x0, -b0.dot(x0)).normalize()
    z0.crossVectors(x0, y0)
    x1.copy(a1).normalize()
    y1.copy(b1).addScaledVector(x1, -b1.dot(x1))
    if (y1.lengthSq() < 1e-8) y1.copy(z0).cross(x1)
    y1.normalize()
    z1.crossVectors(x1, y1)
    out.setFromRotationMatrix(this.xm[1].makeBasis(x1, y1, z1))
    return out.multiply(this.cq[4].setFromRotationMatrix(this.xm[0].makeBasis(x0, y0, z0)).invert())
  }

  private poseFingers(arm: Arm, grip: number) {
    for (const joint of arm.fingers) {
      const relaxed = FINGER_CURL[joint.finger][joint.joint]
      const angle = grip >= 0
        ? relaxed + (FINGER_GRIP[joint.finger][joint.joint] - relaxed) * Math.min(grip, 1)
        : relaxed + (FINGER_OPEN[joint.finger][joint.joint] - relaxed) * Math.min(-grip, 1)
      joint.bone.quaternion.setFromAxisAngle(joint.axis, angle).multiply(joint.base)
    }
  }

  private relaxFingers() {
    for (const arm of this.arms) {
      this.poseFingers(arm, 0)
      arm.hand.bone.updateMatrixWorld(true)
    }
    this.fingersPosed = false
  }

  private turn(bone: THREE.Object3D, delta: THREE.Quaternion, rootWorld: THREE.Quaternion) {
    const [parent, world, inverse] = this.tq
    bone.parent!.getWorldQuaternion(parent)
    world.copy(rootWorld).multiply(delta).multiply(inverse.copy(rootWorld).invert())
    bone.quaternion.premultiply(inverse.copy(parent).invert().multiply(world).multiply(parent))
  }

  private carryArms(rootWorld: THREE.Quaternion) {
    const [shoulder, elbow, wrist, center, forward, up, left, upper, reach, swung] = this.cv
    const [rootInverse, chest, delta, upperRelative] = this.cq
    rootInverse.copy(rootWorld).invert()
    this.spine2.bone.getWorldQuaternion(chest).premultiply(rootInverse).multiply(delta.copy(this.spine2.bind).invert())
    forward.set(0, 0, 1).applyQuaternion(chest)
    up.set(0, 1, 0).applyQuaternion(chest)
    left.set(1, 0, 0).applyQuaternion(chest)
    this.bones[BONE.pelvis].getWorldPosition(center)
    for (const arm of this.arms) {
      arm.upper.bone.getWorldPosition(shoulder)
      arm.fore.bone.getWorldPosition(elbow)
      arm.hand.bone.getWorldPosition(wrist)
      upper.copy(elbow).sub(shoulder).applyQuaternion(rootInverse)
      const flex = upper.angleTo(reach.copy(wrist).sub(elbow).applyQuaternion(rootInverse))
      const abduction = Math.atan2(arm.side * upper.dot(left), -upper.dot(up))
      const goal = abduction > CARRY_ABDUCTION
        ? CARRY_ABDUCTION + (abduction - CARRY_ABDUCTION) * CARRY_KEEP
        : abduction + (CARRY_ABDUCTION - abduction) * CARRY_LIFT
      let turn = goal - abduction
      if (turn < 0) {

        reach.copy(wrist).sub(shoulder).applyQuaternion(rootInverse)
        shoulder.sub(center).applyQuaternion(rootInverse)
        const clearance = (angle: number) => {
          swung.copy(reach).applyAxisAngle(forward, arm.side * angle).add(shoulder)
          const ahead = THREE.MathUtils.smoothstep(swung.dot(forward), 0.08, 0.28)
          return arm.side * swung.dot(left) - THREE.MathUtils.lerp(HAND_CLEARANCE, 0.1, ahead)
        }
        if (clearance(turn) < 0) {
          let lo = turn, hi = 0
          if (clearance(0) < 0) lo = hi
          for (let i = 0; i < 6 && lo < hi; i++) { const mid = (lo + hi) / 2; if (clearance(mid) < 0) lo = mid; else hi = mid }
          turn = hi
        }
      }
      if (Math.abs(turn) > 1e-4) this.turn(arm.upper.bone, delta.setFromAxisAngle(forward, arm.side * turn), rootWorld)
      if (flex < ELBOW_REST) {

        arm.upper.bone.getWorldQuaternion(upperRelative).premultiply(rootInverse).multiply(this.cq[4].copy(arm.upper.bind).invert())
        const hinge = swung.copy(arm.flexAxis).applyQuaternion(upperRelative)
        const ease = 1 - flex / ELBOW_REST
        this.turn(arm.fore.bone, delta.setFromAxisAngle(hinge, ELBOW_REST * ease * ease), rootWorld)
      }
    }
  }

  private posture(drive: SurvivorDrive, clipSpeed: number, dt: number) {
    const [a, b, hang, axis] = this.v
    const q = this.pq
    const lerp = THREE.MathUtils.lerp, damp = THREE.MathUtils.damp
    const speed = Math.hypot(drive.velocity.x, drive.velocity.z)
    const grounded = (this.support || !this.inFlight) && !drive.flying && !this.floating
    this.runBlend = damp(this.runBlend, THREE.MathUtils.smoothstep(speed, RUN_GAIT_FROM, RUN_GAIT_TO), 5, dt)
    const run = this.runBlend
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw)

    const fold = this.crouchNow * 0.38 - this.compress.x * 1.6 + 0.06 * this.air * this.stride * this.tuck

    const bank = grounded ? clamp(Math.atan((speed * this.facingVelocity) / GRAVITY) * 0.6, -0.14, 0.14) : 0
    this.bank = damp(this.bank, bank, 6, dt)

    const relative = wrap(drive.lookYaw - this.yaw)
    const goal = Math.abs(relative) < 1.9 ? clamp(relative, -1.05, 1.05) * (1 - clamp(clipSpeed / 2.4, 0, 0.8)) : 0
    this.headYaw = damp(this.headYaw, goal, 4, dt)

    const e = this.euler
    const rootWorld = this.hips.parent!.getWorldQuaternion(q[0])
    this.turn(this.spine1.bone, q[1].setFromEuler(e.set(fold * 0.45, 0, -this.bank * 0.5, 'YZX')), rootWorld)
    this.turn(this.spine2.bone, q[1].setFromEuler(e.set(fold * 0.55, 0, -this.bank * 0.5, 'YZX')), rootWorld)
    this.turn(this.neck.bone, q[1].setFromEuler(e.set(-fold * 0.35, this.headYaw * 0.4, this.bank * 0.3, 'YZX')), rootWorld)
    this.turn(this.head.bone, q[1].setFromEuler(e.set(-fold * 0.3, this.headYaw * 0.6, this.bank * 0.2, 'YZX')), rootWorld)
    this.carryArms(rootWorld)

    const thigh = (leg: Leg) => {
      leg.thigh.getWorldPosition(a)
      leg.calf.getWorldPosition(b).sub(a)
      return Math.atan2(b.x * sin + b.z * cos, -b.y)
    }

    const stride = (thigh(this.legs[1]) - thigh(this.legs[0])) * 0.5
    const jumping = Math.max(this.air, drive.windup > 0 ? 1 : 0, clamp(-this.compress.x / JUMP_CROUCH, 0, 1))
    this.armBlend = damp(this.armBlend, jumping, jumping > this.armBlend ? 16 : 5, dt)
    const blend = this.armBlend

    const gain = lerp(0.9, 1.6, run) * (1 - 0.4 * this.air)
    const bias = lerp(0, -0.15, run) * (1 - this.air)
    const outward = lerp(0.22, 0.3, run) + 0.2 * this.air * (this.jumped ? 1 : 0.5)
    const plane = lerp(0.12, 0.2, run)
    const chestWorld = this.spine2.bone.getWorldQuaternion(q[10]).multiply(q[12].copy(this.spine2.bind).invert())
    const neckWorld = this.neck.bone.getWorldQuaternion(q[8])
    for (const arm of this.arms) {
      stepOscillator(arm.swing, clamp(arm.side * stride * gain + bias + this.armSwing.x, -1, 1.3), lerp(18, 28, run), 0.6, dt)
      const swing = clamp(arm.swing.x, -1.1, 1.4)
      const bendGoal = lerp(0.26 + 0.9 * Math.max(0, swing), 1.4 + 0.45 * swing, run) + 0.35 * this.air * (1 - run)
      stepOscillator(arm.bend, clamp(bendGoal, 0.15, 1.9), lerp(14, 24, run), 0.5, dt)
      if (blend < 0.001) continue
      const bend = clamp(arm.bend.x, 0.1, 2)

      const inward = 0.05 + 0.2 * run * THREE.MathUtils.smoothstep(swing, 0, 0.5)
      hang.set(arm.side * Math.sin(outward), -Math.cos(outward), 0)
      axis.set(Math.cos(plane), 0, arm.side * Math.sin(plane))

      const frame = q[11].copy(chestWorld)
        .multiply(q[12].setFromAxisAngle(axis, -swing))
        .multiply(q[12].setFromAxisAngle(hang, arm.side * inward))
        .multiply(q[12].setFromUnitVectors(arm.upperDir, hang))

      const clavicleWorld = q[13].copy(chestWorld).multiply(q[12].setFromAxisAngle(UP, -arm.side * 0.12 * swing)).multiply(arm.clavicle.bind)
      arm.clavicle.bone.quaternion.slerp(q[14].copy(neckWorld).invert().multiply(clavicleWorld), blend)
      const upperWorld = q[15].copy(frame).multiply(arm.upper.bind)
      arm.upper.bone.quaternion.slerp(q[14].copy(clavicleWorld).invert().multiply(upperWorld), blend)
      frame.multiply(q[12].setFromAxisAngle(arm.flexAxis, bend - arm.bindFlex))
      const foreWorld = q[16].copy(frame).multiply(arm.fore.bind)
      arm.fore.bone.quaternion.slerp(q[14].copy(upperWorld).invert().multiply(foreWorld), blend)
      arm.hand.bone.quaternion.slerp(q[14].copy(foreWorld).invert().multiply(q[13].copy(frame).multiply(arm.hand.bind)), blend)
    }
    this.spine1.bone.updateMatrixWorld(true)
  }

  private solveLeg(leg: Leg, contacts: number, drive: SurvivorDrive, dt: number) {
    const [toe, ankle, input, target, normal, toToe, , , floor] = this.v
    const [tip, sole, heel] = this.sv
    const [footClip, toeClip] = this.sq
    leg.toe.getWorldPosition(toe)
    leg.foot.getWorldPosition(ankle)
    leg.foot.getWorldQuaternion(footClip)
    leg.toe.getWorldQuaternion(toeClip)

    const along = ((toe.x - this.position.x) * this.travel.x + (toe.z - this.position.z) * this.travel.z) * (this.strideWarp - 1)
    const footX = toe.x + this.travel.x * along, footZ = toe.z + this.travel.z * along
    const planted = (this.support || !this.inFlight) && !drive.flying && this.swim < 0.5
    normal.copy(UP)
    let rise = 0, onGround = false
    if (planted && drive.ground(footX, this.position.y + 0.9, footZ, this.hit)) {
      rise = clamp(this.hit.y - this.position.y, -0.6, 0.6)
      if (this.hit.normal.y > 0.5) normal.copy(this.hit.normal)
      floor.set(footX, this.position.y + rise, footZ)
      onGround = true
    }
    leg.rise = rise

    input.set(footX, toe.y - this.hipOffset + rise, footZ)
    if (leg.fresh) { leg.target.copy(input); leg.position.copy(input); leg.fresh = false }

    const base = this.position.y + this.hipOffset
    const clearance = toe.y - base
    tip.copy(leg.tip).applyQuaternion(toeClip)
    heel.copy(leg.heel).applyQuaternion(footClip).add(ankle).sub(toe)
    const tipHeight = clearance + tip.y, heelHeight = clearance + heel.y
    const ballHeight = sole.copy(leg.ball).applyQuaternion(toeClip).add(toe).y - base
    const soleHeight = Math.min(tipHeight, ballHeight, heelHeight)

    const ahead = (footX - this.position.x) * this.travel.x + (footZ - this.position.z) * this.travel.z
    const step = Math.max(dt, 1e-4)
    const heelX = input.x + heel.x, heelZ = input.z + heel.z
    if (Number.isNaN(leg.heelLast.x)) leg.heelLast.set(heelX, 0, heelZ)
    const landing = Math.min(Math.hypot(input.x - leg.target.x, input.z - leg.target.z), Math.hypot(heelX - leg.heelLast.x, heelZ - leg.heelLast.z)) / step
    leg.heelLast.set(heelX, 0, heelZ)
    const touchdown = soleHeight < TOUCHDOWN_HEIGHT && ahead > 0.05 && landing < 1.5 * Math.hypot(drive.velocity.x, drive.velocity.z) + 0.5
    const contact = planted && ((contacts & leg.bit) !== 0 || (leg.locked ? soleHeight < SOLE_OFF_HEIGHT : touchdown) || (this.idle && clearance < TOE_DOWN_HEIGHT))
    const forefoot = Math.min(ballHeight, tipHeight)
    const roll = heelHeight < forefoot - HEEL_STRIKE ? PIVOT_HEEL : heelHeight > forefoot + HEEL_OFF ? PIVOT_TIP : PIVOT_TOE
    const radius = this.idle ? IDLE_UNLOCK_RADIUS : UNLOCK_RADIUS + UNLOCK_GROWTH * Math.hypot(drive.velocity.x, drive.velocity.z)
    this.updateContact(leg, input, contact, clearance, roll, radius, planted, dt)

    target.copy(ankle).add(toToe.copy(leg.position).sub(toe))
    if (drive.flying) target.y += 0.16 * (1 - this.plant)
    else if (this.air > 0.001) this.airborneTarget(leg, target, planted)
    const [footWorld, slope, identity, calfWorld, point] = this.q
    footWorld.copy(footClip)
    slope.setFromUnitVectors(UP, normal)
    const tilt = 2 * Math.acos(clamp(slope.w, -1, 1))
    slope.slerp(identity.identity(), 1 - Math.min(1, 0.45 / Math.max(tilt, 1e-4)) * this.plant)
    footWorld.premultiply(slope)
    if (this.air > 0.001 && !drive.flying) {

      const angle = 0.5 * this.air * (1 - this.reach) * (this.jumped ? 1 : 0.6)
      footWorld.premultiply(point.setFromAxisAngle(this.v[7].set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), angle))
    }

    const holding = leg.locked && planted
    leg.flatWeight = THREE.MathUtils.damp(leg.flatWeight, holding && leg.pivot !== PIVOT_TIP ? 1 : 0, FOOT_EASE, dt)
    leg.pivotWeight = THREE.MathUtils.damp(leg.pivotWeight, holding ? 1 : 0, FOOT_EASE, dt)
    if (leg.flatWeight > 0.001) this.flatten(leg, target, footWorld, normal, leg.flatWeight)
    if (leg.pivotWeight > 0.001) this.pivotOnToe(leg, target, footWorld, leg.pivotWeight)
    if (onGround) {

      const lift = leg.locked ? 0 : Math.max(leg.stepLift, clamp((landing - SWING_CLEARANCE_SPEED) * SWING_CLEARANCE_GAIN, 0, SWING_CLEARANCE_MAX))
      const settle = leg.locked ? 1 - THREE.MathUtils.smoothstep(soleHeight, TOUCHDOWN_HEIGHT, SOLE_OFF_HEIGHT) : 0
      this.keepSoleAbove(leg, target, footWorld, floor, drive, lift, settle)
    }

    const hip = leg.thigh.getWorldPosition(this.v[7])
    const reach = this.legLength * 0.985, flat = (target.x - hip.x) ** 2 + (target.z - hip.z) ** 2
    const vertical = flat < reach * reach ? Math.sqrt(reach * reach - flat) : 0
    leg.reachDrop = planted && leg.locked ? clamp(hip.y - this.kneeRaise - target.y - vertical, 0, MAX_REACH_DROP) : 0
    this.twoBone(leg, target)
    leg.calf.getWorldQuaternion(calfWorld)
    leg.foot.quaternion.copy(calfWorld.invert().multiply(footWorld))
    leg.thigh.updateMatrixWorld(true)
    leg.kneeRaise = onGround ? this.kneeRaiseFor(leg, target, floor.y, drive) : 0
  }

  private kneeRaiseFor(leg: Leg, ankle: THREE.Vector3, floorY: number, drive: SurvivorDrive) {
    const [hip, knee, bend, line] = this.rv
    leg.thigh.getWorldPosition(hip)
    leg.calf.getWorldPosition(knee)

    if (!drive.ground(knee.x, this.position.y + 0.9, knee.z, this.hit) || this.hit.y > floorY + 0.4) return 0
    const normal = this.hit.normal.y > 0.5 ? this.hit.normal : UP
    const groundX = knee.x, groundY = this.hit.y, groundZ = knee.z
    const thigh = hip.distanceTo(knee), shin = knee.distanceTo(leg.foot.getWorldPosition(line))
    line.copy(ankle).sub(hip).normalize()
    bend.copy(knee).sub(hip)
    bend.addScaledVector(line, -bend.dot(line))
    if (bend.lengthSq() < 1e-8) bend.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    hip.y -= this.kneeRaise
    const overAnkle = leg.locked ? KNEE_OVER_ANKLE : -Infinity
    const clear = (raise: number) => {
      line.copy(ankle).sub(hip)
      line.y -= raise
      const reach = clamp(line.length(), Math.abs(thigh - shin) + 1e-3, thigh + shin - 1e-3)
      line.normalize()
      const along = (thigh * thigh - shin * shin + reach * reach) / (2 * reach)
      const out = Math.sqrt(Math.max(0, thigh * thigh - along * along))
      knee.copy(bend).addScaledVector(line, -bend.dot(line)).normalize().multiplyScalar(out).addScaledVector(line, along).add(hip)
      knee.y += raise
      const gap = (knee.x - groundX) * normal.x + (knee.y - groundY) * normal.y + (knee.z - groundZ) * normal.z
      return gap >= KNEE_CLEARANCE && knee.y - ankle.y >= overAnkle
    }
    if (clear(0)) return 0
    let lo = 0, hi = CROUCH_DROP + 0.2
    if (!clear(hi)) return hi
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      if (clear(mid)) hi = mid
      else lo = mid
    }
    return hi
  }

  private airborneTarget(leg: Leg, target: THREE.Vector3, grounded: boolean) {
    const hip = leg.thigh.getWorldPosition(this.v[7])
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), lx = fz, lz = -fx
    const tuck = this.tuck, lead = this.legs[this.leadLeg] === leg
    const side = clamp((target.x - hip.x) * lx + (target.z - hip.z) * lz, -0.16, 0.16)
    const ahead = this.stride * (lead ? 0.06 + 0.22 * tuck : -0.03 - 0.2 * tuck) + (1 - this.stride) * (0.03 + 0.1 * tuck)
    const reach = this.legLength * (0.97 - (lead || this.stride < 0.5 ? 0.36 : 0.3) * tuck)
    const down = Math.sqrt(Math.max(0.01, reach * reach - ahead * ahead - side * side))
    const w = this.air

    const y = grounded ? Math.max(hip.y - down, target.y) : hip.y - down
    target.x += (hip.x + lx * side + fx * ahead - target.x) * w
    target.y += (y - target.y) * w
    target.z += (hip.z + lz * side + fz * ahead - target.z) * w
  }

  private flatten(leg: Leg, ankle: THREE.Vector3, footWorld: THREE.Quaternion, normal: THREE.Vector3, weight: number) {
    const [heel, sole, axis] = this.cv
    const turn = this.cq[0]
    heel.copy(leg.heel).applyQuaternion(footWorld).add(ankle)
    sole.copy(leg.toeOffset).sub(leg.heel).applyQuaternion(footWorld)
    const length = sole.length()
    if (length < 1e-4) return
    const pitch = Math.asin(clamp(sole.dot(normal) / length, -1, 1)) - leg.solePitch
    if (pitch <= 0) return
    axis.crossVectors(normal, sole)
    if (axis.lengthSq() < 1e-8) return
    turn.setFromAxisAngle(axis.normalize(), Math.min(pitch, FLATTEN_MAX) * THREE.MathUtils.smoothstep(leg.stance, 0, FLATTEN_TIME) * weight)
    ankle.sub(heel).applyQuaternion(turn).add(heel)
    footWorld.premultiply(turn)
  }

  private pivotOnToe(leg: Leg, ankle: THREE.Vector3, footWorld: THREE.Quaternion, weight: number) {
    const [hip, toe, back, axis, moved, tip] = this.cv
    const [turn, toeWorld] = this.cq
    leg.thigh.getWorldPosition(hip)
    const reach = this.legLength * 0.99
    if (ankle.distanceToSquared(hip) <= reach * reach) return
    if ((ankle.x - hip.x) * Math.sin(this.yaw) + (ankle.z - hip.z) * Math.cos(this.yaw) > 0) return
    toe.copy(leg.toeOffset).applyQuaternion(footWorld).add(ankle)
    axis.copy(toe).sub(ankle).setY(0)
    if (axis.lengthSq() < 1e-6) return
    axis.crossVectors(UP, axis.normalize()).normalize()
    if (leg.pivot === PIVOT_TIP) toe.add(tip.copy(leg.tip).applyQuaternion(toeWorld.copy(footWorld).multiply(leg.toe.quaternion)))
    back.copy(ankle).sub(toe)
    const within = (angle: number) => moved.copy(back).applyQuaternion(turn.setFromAxisAngle(axis, angle)).add(toe).distanceToSquared(hip) <= reach * reach
    let lo = 0, hi = MAX_TOE_PIVOT
    if (within(hi)) for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (within(mid)) hi = mid; else lo = mid }
    ankle.copy(back).applyQuaternion(turn.setFromAxisAngle(axis, hi * weight)).add(toe)
    footWorld.premultiply(turn)
  }

  private keepSoleAbove(leg: Leg, ankle: THREE.Vector3, footWorld: THREE.Quaternion, floor: THREE.Vector3, drive: SurvivorDrive, lift: number, settle: number) {
    const toe = this.v[9], point = this.v[10]
    const toeWorld = this.q[5].copy(footWorld).multiply(leg.toe.quaternion)
    toe.copy(leg.toeOffset).applyQuaternion(footWorld).add(ankle)
    const depth = Math.max(
      floor.y - point.copy(leg.ball).applyQuaternion(toeWorld).add(toe).y,
      floor.y - point.copy(leg.edges[0]).applyQuaternion(toeWorld).add(toe).y,
      floor.y - point.copy(leg.edges[1]).applyQuaternion(toeWorld).add(toe).y,
      this.depthBelowGround(point.copy(leg.heel).applyQuaternion(footWorld).add(ankle), floor.y, drive),
      this.depthBelowGround(point.copy(leg.tip).applyQuaternion(toeWorld).add(toe), floor.y, drive),
    )
    if (depth + lift > 0) ankle.y += depth + lift
    else if (settle > 0) ankle.y += Math.max(depth, -SETTLE_DEPTH) * settle
  }

  private depthBelowGround(point: THREE.Vector3, toeGround: number, drive: SurvivorDrive) {
    const hit = drive.ground(point.x, this.position.y + 0.9, point.z, this.hit) && this.hit.y < toeGround + 0.22
    return (hit ? this.hit.y : toeGround) - point.y
  }

  private pivotOffset(pivot: number, axis: 'x' | 'z') {
    return pivot === PIVOT_HEEL ? this.sv[2][axis] : pivot === PIVOT_TIP ? this.sv[0][axis] : 0
  }

  private updateContact(leg: Leg, input: THREE.Vector3, contact: boolean, clearance: number, roll: number, radius: number, grounded: boolean, dt: number) {
    const velocity = this.v[6].copy(input).sub(leg.target).divideScalar(Math.max(dt, 1e-4))
    leg.target.copy(input)
    decayVector(leg.offset, leg.offsetVelocity, CONTACT_HALFLIFE, dt)
    if (leg.locked && roll > leg.pivot) {
      leg.point.x += this.pivotOffset(roll, 'x') - this.pivotOffset(leg.pivot, 'x')
      leg.point.z += this.pivotOffset(roll, 'z') - this.pivotOffset(leg.pivot, 'z')
      leg.pivot = roll
    }

    const held = this.sv[3].set(leg.point.x - this.pivotOffset(leg.pivot, 'x'), leg.point.y + clearance, leg.point.z - this.pivotOffset(leg.pivot, 'z'))
    leg.position.copy(leg.locked ? held : input).add(leg.offset)
    const unlock = leg.locked && (leg.restep || held.distanceTo(input) > radius)
    leg.restep = false
    if (!leg.locked && contact && (!leg.contact || leg.offset.lengthSq() < 1e-4)) {

      leg.locked = true
      leg.pivot = roll
      leg.stance = 0
      leg.point.set(leg.position.x + this.pivotOffset(roll, 'x'), input.y - clearance, leg.position.z + this.pivotOffset(roll, 'z'))
      leg.offset.set(0, leg.offset.y, 0)
      leg.offsetVelocity.set(0, leg.offsetVelocity.y, 0)
      leg.stepFrom = 0
    } else if ((leg.locked && !contact) || unlock) {
      leg.locked = false
      leg.offset.add(held).sub(input)
      leg.offsetVelocity.x -= velocity.x
      leg.offsetVelocity.z -= velocity.z
      leg.stepFrom = Math.hypot(leg.offset.x, leg.offset.z)
      leg.stepTime = 0
    }
    if (leg.locked) leg.stance += dt
    leg.contact = contact

    leg.stepLift = 0
    if (leg.stepFrom > STEP_MIN && grounded) {
      leg.stepTime += dt
      const remaining = Math.hypot(leg.offset.x, leg.offset.z) / leg.stepFrom
      const smooth = THREE.MathUtils.smoothstep
      leg.stepLift = Math.min(STEP_HEIGHT, leg.stepFrom * 0.45) * smooth(leg.stepTime, 0, STEP_RISE) * smooth(remaining, 0, 0.35)
      if (remaining < 0.03) leg.stepFrom = 0
    }
  }

  private limitKnee(leg: Leg) {
    const [shin, cross] = this.kv
    shin.copy(leg.foot.position).applyQuaternion(leg.calf.quaternion).normalize()
    const flex = Math.atan2(cross.crossVectors(leg.thighAxis, shin).dot(leg.hinge), leg.thighAxis.dot(shin))
    if (flex < KNEE_MIN_FLEX) leg.calf.quaternion.premultiply(this.kq.setFromAxisAngle(leg.hinge, KNEE_MIN_FLEX - flex))
  }

  private twoBone(leg: Leg, target: THREE.Vector3) {
    const [a, b, c, ac, ab, at, axis0, axis1, ba, bc, cross] = this.iv
    const [aGr, bGr, w0, w1, w2, parent] = this.iq
    leg.thigh.getWorldPosition(a); leg.calf.getWorldPosition(b); leg.foot.getWorldPosition(c)
    leg.thigh.getWorldQuaternion(aGr); leg.calf.getWorldQuaternion(bGr)
    const lab = a.distanceTo(b), lcb = b.distanceTo(c)
    const lat = clamp(a.distanceTo(target), 0.01, lab + lcb - 0.002)
    ac.subVectors(c, a).normalize(); ab.subVectors(b, a).normalize(); at.subVectors(target, a).normalize()
    ba.subVectors(a, b).normalize(); bc.subVectors(c, b).normalize()

    const hinge = axis1.copy(leg.hinge).applyQuaternion(aGr).negate()
    hinge.addScaledVector(ac, -hinge.dot(ac)).normalize()
    axis0.crossVectors(ac, ab)
    const bent = axis0.length()
    const trust = axis0.dot(hinge) > 0 ? THREE.MathUtils.smoothstep(bent, 0.03, 0.12) : 0
    axis0.multiplyScalar(trust / Math.max(bent, 1e-9)).addScaledVector(hinge, 1 - trust).normalize()
    const acAb0 = Math.atan2(cross.crossVectors(ac, ab).dot(axis0), ac.dot(ab))
    const baBc0 = Math.PI + Math.atan2(cross.crossVectors(ab, bc).dot(axis0), ab.dot(bc))
    const acAt0 = Math.acos(clamp(ac.dot(at), -1, 1))
    const acAb1 = Math.acos(clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1))
    const baBc1 = Math.acos(clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1))
    axis1.crossVectors(ac, at)
    w0.setFromAxisAngle(axis0, acAb1 - acAb0)
    w1.setFromAxisAngle(axis0, baBc1 - baBc0)
    if (axis1.lengthSq() > 1e-10) w2.setFromAxisAngle(axis1.normalize(), acAt0)
    else w2.identity()
    const swing = w2.multiply(w0)
    aGr.premultiply(swing)
    bGr.premultiply(w1).premultiply(swing)
    leg.thigh.parent!.getWorldQuaternion(parent)
    leg.thigh.quaternion.copy(parent.invert().multiply(aGr))
    leg.calf.quaternion.copy(aGr.invert().multiply(bGr))
  }
}
