import * as THREE from 'three'
import { approachVelocity } from '../math'
import { RANGE_END_MARGIN, type MotionDatabase } from './motion-database'
import { BONE, BONE_COUNT, FEATURE, MIRROR_BONE, TRAJECTORY_FRAMES } from './motion-format'

const SEARCH_INTERVAL = 0.1

const BLEND_HALFLIFE = 0.11

const SWITCH_RATIO = 0.82
const SWITCH_MARGIN = 0.08

const MAX_OUTWARD = 2.5
const MAX_SIDEWAYS = 2.5
const OVERSHOOT = 1.5

const LEG_LIMITS: readonly (readonly [number, number])[] = [[BONE.leftThigh, 0.5], [BONE.rightThigh, 0.5], [BONE.leftCalf, 0.6], [BONE.rightCalf, 0.6]]

const LEG_MIN_DOT = LEG_LIMITS.map(([, limit]) => Math.cos(limit / 2))

export type Pose = {

  rotations: THREE.Quaternion[]

  hips: THREE.Vector3

  root: THREE.Vector3

  contacts: number
}

export type SkeletonInfo = {
  bindLocal: THREE.Quaternion[]

  parent: number[]

  hipsGlobal: THREE.Quaternion
}

export type TrajectoryInput = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  desired: THREE.Vector3

  response: number

  maxAcceleration: number
  facing: number
  facingVelocity: number
  facingGoal: number
  facingHalflife: number

  facingMaxRate: number
}

const createPose = (): Pose => ({ rotations: Array.from({ length: BONE_COUNT }, () => new THREE.Quaternion()), hips: new THREE.Vector3(), root: new THREE.Vector3(), contacts: 3 })
const dampingOf = (halflife: number) => (2 * Math.LN2) / (halflife + 1e-5)
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export function scaledAngleAxis(q: THREE.Quaternion, out: THREE.Vector3) {
  const sign = q.w < 0 ? -1 : 1
  const x = q.x * sign, y = q.y * sign, z = q.z * sign, w = q.w * sign
  const length = Math.hypot(x, y, z)
  if (length < 1e-8) return out.set(x * 2, y * 2, z * 2)
  const angle = 2 * Math.atan2(length, w)
  return out.set((x / length) * angle, (y / length) * angle, (z / length) * angle)
}

export function fromScaledAngleAxis(v: THREE.Vector3, out: THREE.Quaternion) {
  const angle = v.length()
  if (angle < 1e-8) return out.set(v.x / 2, v.y / 2, v.z / 2, 1).normalize()
  const s = Math.sin(angle / 2) / angle
  return out.set(v.x * s, v.y * s, v.z * s, Math.cos(angle / 2))
}

export function decayVector(x: THREE.Vector3, v: THREE.Vector3, halflife: number, dt: number) {
  const y = dampingOf(halflife), e = Math.exp(-y * dt)
  const jx = v.x + x.x * y, jy = v.y + x.y * y, jz = v.z + x.z * y
  x.set(e * (x.x + jx * dt), e * (x.y + jy * dt), e * (x.z + jz * dt))
  v.set(e * (v.x - jx * y * dt), e * (v.y - jy * y * dt), e * (v.z - jz * y * dt))
}

const decayScratch = new THREE.Vector3()
function decayRotation(q: THREE.Quaternion, v: THREE.Vector3, halflife: number, dt: number) {
  const y = dampingOf(halflife), e = Math.exp(-y * dt)
  const j0 = scaledAngleAxis(q, decayScratch)
  const jx = v.x + j0.x * y, jy = v.y + j0.y * y, jz = v.z + j0.z * y
  fromScaledAngleAxis(j0.set(e * (j0.x + jx * dt), e * (j0.y + jy * dt), e * (j0.z + jz * dt)), q)
  v.set(e * (v.x - jx * y * dt), e * (v.y - jy * y * dt), e * (v.z - jz * y * dt))
}

function limitOffsetVelocity(offset: THREE.Vector3, velocity: THREE.Vector3, damping: number) {
  const size = offset.length()
  if (size < 1e-6) {
    const speed = velocity.length()
    if (speed > MAX_OUTWARD) velocity.multiplyScalar(MAX_OUTWARD / speed)
    return
  }
  const radial = velocity.dot(offset) / size
  const sideways = velocity.addScaledVector(offset, -radial / size)
  const sidewaysSpeed = sideways.length()
  if (sidewaysSpeed > MAX_SIDEWAYS) sideways.multiplyScalar(MAX_SIDEWAYS / sidewaysSpeed)
  velocity.addScaledVector(offset, THREE.MathUtils.clamp(radial, -(damping * size + OVERSHOOT), MAX_OUTWARD) / size)
}

const facingStep = { facing: 0, velocity: 0 }

export function stepFacing(facing: number, velocity: number, goal: number, halflife: number, maxRate: number, dt: number) {
  const y = dampingOf(halflife), e = Math.exp(-y * dt)
  const j0 = wrap(facing - goal), j1 = velocity + j0 * y
  let next = goal + e * (j0 + j1 * dt), rate = e * (velocity - j1 * y * dt)
  if (Math.abs(rate) > maxRate) {
    rate = Math.sign(rate) * maxRate
    const before = wrap(goal - facing)
    next = facing + rate * dt
    if (before !== 0 && Math.sign(wrap(goal - next)) !== Math.sign(before)) { next = goal; rate = 0 }
  }
  facingStep.facing = wrap(next)
  facingStep.velocity = rate
  return facingStep
}

export class MotionMatcher {
  frame: number
  readonly pose = createPose()

  private angular = Array.from({ length: BONE_COUNT }, () => new THREE.Vector3())
  private hipsVelocity = new THREE.Vector3()
  private offsetRotations = Array.from({ length: BONE_COUNT }, () => new THREE.Quaternion())
  private offsetAngular = Array.from({ length: BONE_COUNT }, () => new THREE.Vector3())
  private offsetHips = new THREE.Vector3()
  private offsetHipsVelocity = new THREE.Vector3()
  private offsetRoot = new THREE.Vector3()
  private offsetRootVelocity = new THREE.Vector3()
  private target = createPose()
  private next = createPose()
  private previous = createPose()
  private query = new Float32Array(FEATURE.count)
  private raw = new Float32Array(FEATURE.count)
  private searchTimer = 0
  private searchedDesired = new THREE.Vector3()
  private correction: THREE.Quaternion[]
  private correctionInverse: THREE.Quaternion[]
  private globals = Array.from({ length: BONE_COUNT }, () => new THREE.Quaternion())
  private mirrored = Array.from({ length: BONE_COUNT }, () => new THREE.Quaternion())
  private qa = new THREE.Quaternion()
  private qb = new THREE.Quaternion()
  private va = new THREE.Vector3()
  private vb = new THREE.Vector3()
  private predicted = new THREE.Vector3()

  lastCost = 0
  transitions = 0

  vetoes = 0
  private readonly legsFit = (index: number) => {
    if (this.legsWithinReach(index)) return true
    this.vetoes++
    return false
  }

  constructor(readonly db: MotionDatabase, readonly skeleton: SkeletonInfo) {

    const bind = skeleton.bindLocal.map(() => new THREE.Quaternion())
    skeleton.bindLocal.forEach((local, b) => bind[b].copy(this.parentGlobal(bind, b)).multiply(local))
    this.correction = bind.map((global, b) => {
      const partner = bind[MIRROR_BONE[b]]
      return new THREE.Quaternion(partner.x, -partner.y, -partner.z, partner.w).invert().multiply(global)
    })
    this.correctionInverse = this.correction.map((q) => q.clone().invert())
    this.frame = this.calmestFrame()
    this.sample(this.frame, this.pose)
    this.copyPose(this.pose, this.previous)
  }

  private parentGlobal(globals: THREE.Quaternion[], b: number) {
    const p = this.skeleton.parent[b]
    return p < 0 ? this.skeleton.hipsGlobal : globals[p]
  }

  private calmestFrame() {
    let best = 0, bestScore = Infinity
    for (const [start, stop] of this.db.ranges) {
      if (start >= this.db.frames) continue
      for (let f = start + 30; f < stop - 60; f++) {
        if (this.db.contacts[f] !== 3) continue
        const score = Math.hypot(this.db.root[f * 3], this.db.root[f * 3 + 1]) + Math.abs(this.db.root[f * 3 + 2]) * 0.3
        if (score < bestScore) { bestScore = score; best = f }
      }
    }
    return best
  }

  private copyPose(from: Pose, to: Pose) {
    from.rotations.forEach((q, b) => to.rotations[b].copy(q))
    to.hips.copy(from.hips); to.root.copy(from.root); to.contacts = from.contacts
  }

  sample(index: number, out: Pose) {
    const db = this.db
    const mirrored = index >= db.frames
    const local = mirrored ? index - db.frames : index
    const f0 = Math.floor(local), f1 = Math.min(f0 + 1, db.stop[f0] - 1), a = local - f0
    for (let b = 0; b < BONE_COUNT; b++) {
      db.rotation(f0, b, this.qa)
      db.rotation(f1, b, this.qb)
      out.rotations[b].copy(this.skeleton.bindLocal[b]).multiply(this.qa.slerp(this.qb, a))
    }
    const h = db.hips, r = db.root
    out.hips.set(h[f0 * 3] + (h[f1 * 3] - h[f0 * 3]) * a, h[f0 * 3 + 1] + (h[f1 * 3 + 1] - h[f0 * 3 + 1]) * a, h[f0 * 3 + 2] + (h[f1 * 3 + 2] - h[f0 * 3 + 2]) * a)
    out.root.set(r[f0 * 3] + (r[f1 * 3] - r[f0 * 3]) * a, r[f0 * 3 + 2] + (r[f1 * 3 + 2] - r[f0 * 3 + 2]) * a, r[f0 * 3 + 1] + (r[f1 * 3 + 1] - r[f0 * 3 + 1]) * a)
    out.contacts = db.contacts[a < 0.5 ? f0 : f1]
    if (mirrored) this.mirror(out)
    return out
  }

  private mirror(pose: Pose) {
    const { globals, mirrored } = this
    for (let b = 0; b < BONE_COUNT; b++) globals[b].copy(this.parentGlobal(globals, b)).multiply(pose.rotations[b])
    for (let b = 0; b < BONE_COUNT; b++) {
      const q = globals[MIRROR_BONE[b]]
      mirrored[b].set(q.x, -q.y, -q.z, q.w).multiply(this.correction[b])
    }
    for (let b = 0; b < BONE_COUNT; b++) pose.rotations[b].copy(this.parentGlobal(mirrored, b)).invert().multiply(mirrored[b])
    pose.hips.x = -pose.hips.x
    pose.root.x = -pose.root.x
    pose.root.y = -pose.root.y
    pose.contacts = ((pose.contacts & 1) << 1) | ((pose.contacts & 2) >> 1)
  }

  private current() {
    return Math.min(Math.round(this.frame), this.db.rangeStop(Math.floor(this.frame)) - 1)
  }

  private buildQuery(current: number, yaw: number, position: THREE.Vector3, input: TrajectoryInput) {
    const { db, query, raw } = this
    query.set(db.features.subarray(current * FEATURE.count, current * FEATURE.count + FEATURE.trajectoryPosition))
    const cos = Math.cos(yaw), sin = Math.sin(yaw), step = 1 / db.fps

    const h = FEATURE.hipVelocity
    const clipSideways = query[h] / db.scale[h] + db.mean[h]
    raw[h] = THREE.MathUtils.lerp(clipSideways, input.velocity.x * cos - input.velocity.z * sin, 0.5)
    raw[h + 2] = input.velocity.x * sin + input.velocity.z * cos
    query[h] = (raw[h] - db.mean[h]) * db.scale[h]
    query[h + 2] = (raw[h + 2] - db.mean[h + 2]) * db.scale[h + 2]

    const velocity = this.predicted.set(input.velocity.x, 0, input.velocity.z)
    let x = input.position.x, z = input.position.z, sample = 0
    let heading = input.facing, turnRate = input.facingVelocity
    for (let frame = 1; frame <= TRAJECTORY_FRAMES[TRAJECTORY_FRAMES.length - 1]; frame++) {
      approachVelocity(velocity, input.desired.x, input.desired.z, Math.max(input.response, 0.5), input.maxAcceleration, step)
      x += velocity.x * step; z += velocity.z * step
      ;({ facing: heading, velocity: turnRate } = stepFacing(heading, turnRate, input.facingGoal, input.facingHalflife, input.facingMaxRate, step))
      if (frame !== TRAJECTORY_FRAMES[sample]) continue
      const dx = x - position.x, dz = z - position.z
      raw[FEATURE.trajectoryPosition + sample * 2] = dx * cos - dz * sin
      raw[FEATURE.trajectoryPosition + sample * 2 + 1] = dx * sin + dz * cos
      const facing = heading - yaw
      raw[FEATURE.trajectoryDirection + sample * 2] = Math.sin(facing)
      raw[FEATURE.trajectoryDirection + sample * 2 + 1] = Math.cos(facing)
      sample++
    }
    db.normaliseInto(raw, query, FEATURE.trajectoryPosition, FEATURE.count)
  }

  private boneAt(index: number, bone: number, out: THREE.Quaternion) {
    const { db, skeleton } = this
    if (index < db.frames) {
      db.rotation(index, bone, out)
      return out.premultiply(skeleton.bindLocal[bone])
    }
    const partner = MIRROR_BONE[bone]
    db.rotation(index - db.frames, partner, out)
    out.premultiply(skeleton.bindLocal[partner])
    out.set(out.x, -out.y, -out.z, out.w)
    return out.premultiply(this.correctionInverse[skeleton.parent[bone]]).multiply(this.correction[bone])
  }

  private legsWithinReach(index: number) {
    for (let k = 0; k < LEG_LIMITS.length; k++) {
      const bone = LEG_LIMITS[k][0]
      if (Math.abs(this.pose.rotations[bone].dot(this.boneAt(index, bone, this.qa))) < LEG_MIN_DOT[k]) return false
    }
    return true
  }

  private transition(index: number, rate: number) {
    const { db, pose } = this
    this.sample(index, this.target)
    this.sample(Math.min(index + 1, db.rangeStop(index) - 1), this.next)
    const damping = dampingOf(BLEND_HALFLIFE)
    for (let b = 0; b < BONE_COUNT; b++) {
      const offset = this.offsetRotations[b].copy(pose.rotations[b]).multiply(this.qa.copy(this.target.rotations[b]).invert())
      if (offset.w < 0) offset.set(-offset.x, -offset.y, -offset.z, -offset.w)
      const velocity = scaledAngleAxis(this.qb.copy(this.next.rotations[b]).multiply(this.qa.copy(this.target.rotations[b]).invert()), this.va).multiplyScalar(db.fps * rate)
      limitOffsetVelocity(scaledAngleAxis(offset, this.vb), this.offsetAngular[b].copy(this.angular[b]).sub(velocity), damping)
    }
    this.offsetHips.copy(pose.hips).sub(this.target.hips)
    this.offsetHipsVelocity.copy(this.hipsVelocity).sub(this.va.copy(this.next.hips).sub(this.target.hips).multiplyScalar(db.fps * rate))
    this.offsetRoot.copy(pose.root).sub(this.target.root)
    this.offsetRootVelocity.set(0, 0, 0)
    this.frame = index
    this.transitions++
  }

  update(dt: number, yaw: number, position: THREE.Vector3, input: TrajectoryInput, rate = 1) {
    const { db } = this
    this.searchTimer -= dt
    const current = this.current()
    const end = db.rangeStop(current) - 1
    if (this.searchTimer <= 0 || this.frame >= end - 1 || input.desired.distanceToSquared(this.searchedDesired) > 0.36) {
      this.buildQuery(current, yaw, position, input)
      const forced = current >= end + 1 - RANGE_END_MARGIN
      const continuing = forced ? Infinity : db.cost(this.query, current)
      const best = { index: -1, cost: continuing * SWITCH_RATIO - SWITCH_MARGIN }
      db.search(this.query, current, best, this.legsFit)
      if (forced && best.index < 0) db.search(this.query, current, best)
      this.lastCost = best.index >= 0 ? best.cost : continuing
      this.searchTimer = SEARCH_INTERVAL
      if (best.index >= 0 && best.index !== current) this.transition(best.index, rate)
      this.searchedDesired.copy(input.desired)
    }

    this.frame = Math.min(this.frame + dt * db.fps * rate, db.rangeStop(Math.floor(this.frame)) - 1)
    this.sample(this.frame, this.target)

    const { pose, previous } = this
    const step = Math.max(dt, 1e-4)
    for (let b = 0; b < BONE_COUNT; b++) {
      decayRotation(this.offsetRotations[b], this.offsetAngular[b], BLEND_HALFLIFE, dt)
      pose.rotations[b].copy(this.offsetRotations[b]).multiply(this.target.rotations[b])
      scaledAngleAxis(this.qa.copy(pose.rotations[b]).multiply(this.qb.copy(previous.rotations[b]).invert()), this.angular[b]).divideScalar(step)
    }
    decayVector(this.offsetHips, this.offsetHipsVelocity, BLEND_HALFLIFE, dt)
    pose.hips.copy(this.target.hips).add(this.offsetHips)
    this.hipsVelocity.copy(pose.hips).sub(previous.hips).divideScalar(step)
    decayVector(this.offsetRoot, this.offsetRootVelocity, BLEND_HALFLIFE, dt)
    pose.root.copy(this.target.root).add(this.offsetRoot)
    pose.contacts = this.target.contacts
    this.copyPose(pose, previous)
    return pose
  }
}
