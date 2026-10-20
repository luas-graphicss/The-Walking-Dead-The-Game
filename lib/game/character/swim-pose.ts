import * as THREE from 'three'

const clamp = THREE.MathUtils.clamp
const smoothstep = THREE.MathUtils.smoothstep
const damp = THREE.MathUtils.damp
const TAU = Math.PI * 2

const TREAD_RATE = 0.95
const BREAST_RATE = 0.72
const CRAWL_RATE = 0.84

const BREAST_SPEED = 1.4
const CRAWL_SPEED = 2.17

const MOVE_FROM = 0.2
const MOVE_TO = 0.9
const CRAWL_FROM = 1.6
const CRAWL_TO = 2.0

const BREAST_ENTRY = 0.36
const CRAWL_ENTRY = 0

const CLAVICLE_LIFT = 0.32
const CLAVICLE_PUSH = 0.16

const FOREARM_TWIST = 0.5

const BREAST_ARM = [
  [0.0, 0.07, 0.5, 0.2, 1, -0.1, -0.45, 0.15, 0, 1, 0.05],
  [0.1, 0.3, 0.44, 0.2, 1, 0.1, -0.6, 0.85, -0.15, 0.55, 0.12],
  [0.2, 0.38, 0.28, 0.3, 1, 0.25, -0.75, 0.35, -0.7, 0.6, 0.2],
  [0.28, 0.21, 0.12, 0.34, 1, 0.15, -0.65, -0.45, -0.65, 0.6, 0.22],
  [0.34, 0.06, 0.12, 0.27, 1, -0.05, -0.5, -0.85, -0.1, 0.5, 0.1],
  [0.43, 0.05, 0.31, 0.22, 1, -0.2, -0.45, -0.35, 0, 1, 0],
  [0.52, 0.06, 0.49, 0.2, 1, -0.1, -0.45, 0.1, 0, 1, 0.04],
  [0.76, 0.07, 0.505, 0.195, 1, -0.1, -0.45, 0.15, 0, 1, 0.05],
] as const
const BREAST_LEG = [
  [0.0, 0.075, -0.79, 0.03, 0.1, 0, 1, 0.95, 0.1],
  [0.3, 0.075, -0.785, 0.02, 0.2, 0, 1, 0.85, 0.15],
  [0.4, 0.17, -0.42, -0.22, 0.5, -0.1, 1, 0.15, 0.55],
  [0.47, 0.36, -0.6, -0.1, 0.65, -0.1, 1, -0.2, 0.85],
  [0.55, 0.2, -0.75, 0, 0.3, 0, 1, 0.5, 0.35],
  [0.62, 0.075, -0.79, 0.03, 0.1, 0, 1, 0.9, 0.1],
] as const
const BREAST_BODY = [
  [0.0, 1.24, 0.27, 0.28, -0.1, -0.72],
  [0.15, 1.18, 0.29, 0.28, -0.16, -0.78],
  [0.3, 1.02, 0.34, 0.25, -0.3, -0.85],
  [0.4, 1.06, 0.33, 0.26, -0.26, -0.82],
  [0.52, 1.26, 0.27, 0.31, -0.1, -0.7],
  [0.7, 1.3, 0.26, 0.29, -0.06, -0.68],
] as const
const CRAWL_ARM = [
  [0.0, 0.17, 0.43, -0.02, 1, 0, -0.5, 0.5, 0, 0.85, 0],
  [0.1, 0.15, 0.53, 0.1, 1, 0, -0.5, 0.1, 0, 1, 0.05],
  [0.2, 0.17, 0.4, 0.3, 1, 0, -0.9, 0, -0.7, 0.7, 0.2],
  [0.32, 0.07, 0.1, 0.38, 1, -0.1, -0.8, -0.2, -1, 0.1, 0.15],
  [0.43, 0.14, -0.25, 0.3, 1, -0.2, -0.6, 0, -0.4, -0.9, 0],
  [0.5, 0.24, -0.4, 0.08, 1, -0.2, -0.5, -0.8, 0, -0.6, -0.1],
  [0.58, 0.36, -0.28, -0.02, 0.9, -0.5, -0.8, -0.9, 0.1, -0.3, 0.15],
  [0.7, 0.5, 0, -0.02, 0.9, -0.1, -0.7, -0.5, -0.85, 0, 0.25],
  [0.85, 0.36, 0.3, -0.02, 1, 0.1, -0.5, 0.2, -0.3, 0.9, 0.1],
] as const

const ARM = [0, 10] as const
const LEG = [20, 28] as const
const PITCH = 36, ROLL = 37, DEPTH = 38, BACK = 39, FLEX = 40, TWIST = 41, HEAD_PITCH = 42, HEAD_YAW = 43
const AIM_SIZE = 44

class Loop {
  private readonly times: number[]
  private readonly values: number[][]
  private readonly slopes: number[][]
  constructor(keys: readonly (readonly number[])[]) {
    const n = keys.length
    this.times = keys.map((key) => key[0])
    this.values = keys.map((key) => key.slice(1))
    this.slopes = this.values.map((value, i) => {
      const prev = (i + n - 1) % n, next = (i + 1) % n
      let span = this.times[next] - this.times[prev]
      if (next <= i) span += 1
      if (prev >= i) span += 1
      return value.map((_, d) => (this.values[next][d] - this.values[prev][d]) / span)
    })
  }

  sample(time: number, out: Float64Array, at: number) {
    const t = time - Math.floor(time), n = this.times.length
    let i = n - 1
    for (let k = 0; k < n; k++) if (this.times[k] > t) { i = (k + n - 1) % n; break }
    const j = (i + 1) % n, t0 = this.times[i]
    let t1 = this.times[j], u = t
    if (t1 <= t0) t1 += 1
    if (u < t0) u += 1
    const h = t1 - t0, s = (u - t0) / h, s2 = s * s, s3 = s2 * s
    const a = 2 * s3 - 3 * s2 + 1, b = (s3 - 2 * s2 + s) * h, c = 3 * s2 - 2 * s3, d = (s3 - s2) * h
    const p0 = this.values[i], p1 = this.values[j], m0 = this.slopes[i], m1 = this.slopes[j]
    for (let k = 0; k < p0.length; k++) out[at + k] = a * p0[k] + b * m0[k] + c * p1[k] + d * m1[k]
  }
}

const breastArm = new Loop(BREAST_ARM)
const breastLeg = new Loop(BREAST_LEG)
const breastBody = new Loop(BREAST_BODY)
const crawlArm = new Loop(CRAWL_ARM)

const NAMES = [
  'Bip01 Pelvis', 'Bip01 Spine', 'Bip01 Spine1', 'Bip01 Spine2', 'Bip01 Neck', 'Bip01 Head',
  'Bip01 L Clavicle', 'Bip01 L UpperArm', 'Bip01 L Forearm', 'Bip01 L Hand',
  'Bip01 R Clavicle', 'Bip01 R UpperArm', 'Bip01 R Forearm', 'Bip01 R Hand',
  'Bip01 L Thigh', 'Bip01 L Calf', 'Bip01 L Foot', 'Bip01 L Toe0',
  'Bip01 R Thigh', 'Bip01 R Calf', 'Bip01 R Foot', 'Bip01 R Toe0',
] as const
const PELVIS = 0, SPINE = 1, SPINE1 = 2, SPINE2 = 3, NECK = 4, HEAD = 5
const CLAVICLE = [6, 10], UPPER = [7, 11], FORE = [8, 12], HAND = [9, 13]
const THIGH = [14, 18], CALF = [15, 19], FOOT = [16, 20], TOE = [17, 21]

type Joint = {
  bone: THREE.Object3D

  parent: number

  bind: THREE.Quaternion

  offset: THREE.Vector3

  global: THREE.Quaternion
  local: THREE.Quaternion
  position: THREE.Vector3
}

type Side = {

  upper: THREE.Vector3
  fore: THREE.Vector3
  elbow: THREE.Vector3

  hand: THREE.Vector3
  palm: THREE.Vector3
  thigh: THREE.Vector3
  shin: THREE.Vector3

  knee: THREE.Vector3
  armLengths: [number, number]
  legLengths: [number, number]

  shoulderOut: number
  hipOut: number
}

export type SwimInput = {

  effort: number

  turnRate: number

  look: number

  surface: number
}

const v = () => new THREE.Vector3()
const q = () => new THREE.Quaternion()
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)

const basisFrom = new THREE.Matrix4(), basisTo = new THREE.Matrix4()
const side0 = v(), side1 = v(), cross0 = v(), cross1 = v()

function frameRotation(from: THREE.Vector3, fromSide: THREE.Vector3, to: THREE.Vector3, toSide: THREE.Vector3, out: THREE.Quaternion) {
  side0.copy(fromSide).addScaledVector(from, -fromSide.dot(from)).normalize()
  side1.copy(toSide).addScaledVector(to, -toSide.dot(to)).normalize()
  basisFrom.makeBasis(from, side0, cross0.crossVectors(from, side0))
  basisTo.makeBasis(to, side1, cross1.crossVectors(to, side1))
  return out.setFromRotationMatrix(basisTo.multiply(basisFrom.transpose()))
}

const reachLine = v(), reachPole = v()

function reach(root: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3, l1: number, l2: number, upper: THREE.Vector3, lower: THREE.Vector3, hinge: THREE.Vector3) {
  const line = reachLine.subVectors(target, root)
  const d = clamp(line.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4)
  line.normalize()
  const p = reachPole.copy(pole).addScaledVector(line, -pole.dot(line))
  if (p.lengthSq() < 1e-8) p.set(-line.y, line.x, 0)
  p.normalize()
  const cos = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)
  upper.copy(line).multiplyScalar(cos).addScaledVector(p, Math.sqrt(1 - cos * cos))
  lower.copy(line).multiplyScalar(d).addScaledVector(upper, -l1).normalize()
  hinge.crossVectors(p, line).normalize()
}

export class SwimLayer {

  readonly hipsRotation = new THREE.Quaternion()
  readonly hipsPosition = new THREE.Vector3()

  readonly strokes = { tread: 1, breast: 0, crawl: 0 }
  readonly cycles = { tread: 0, breast: BREAST_ENTRY, crawl: CRAWL_ENTRY }
  private joints: Joint[]
  private sides: Side[]
  private hipsBind: THREE.Quaternion
  private move = 0
  private sprint = 0
  private look = 0
  private bank = 0
  private aim = new Float64Array(AIM_SIZE)
  private part = new Float64Array(AIM_SIZE)
  private body = new Float64Array(5)

  private palmRoll = [0, 0]
  private euler = new THREE.Euler()
  private qa = Array.from({ length: 6 }, q)
  private va = Array.from({ length: 9 }, v)

  constructor(bone: (name: string) => THREE.Object3D, readonly hips: THREE.Object3D, bindOf: (node: THREE.Object3D) => THREE.Quaternion, at: (node: THREE.Object3D) => THREE.Vector3) {
    this.hipsBind = hips.quaternion.clone()
    const nodes = NAMES.map((name) => bone(name))
    this.joints = nodes.map((node) => ({
      bone: node,
      parent: node.parent === hips ? -1 : nodes.indexOf(node.parent!),
      bind: bindOf(node),
      offset: node.position.clone(),
      global: q(),
      local: q(),
      position: v(),
    }))
    this.sides = [0, 1].map((s) => {
      const letter = s === 0 ? 'L' : 'R'
      const shoulder = at(nodes[UPPER[s]]), elbow = at(nodes[FORE[s]]), wrist = at(nodes[HAND[s]])
      const hip = at(nodes[THIGH[s]]), kneeAt = at(nodes[CALF[s]]), ankle = at(nodes[FOOT[s]])
      const index = at(bone(`Bip01 ${letter} Finger1`)), middle = at(bone(`Bip01 ${letter} Finger2`)), little = at(bone(`Bip01 ${letter} Finger4`))
      const upper = elbow.clone().sub(shoulder).normalize(), fore = wrist.clone().sub(elbow).normalize()
      const palm = new THREE.Vector3().crossVectors(index.clone().add(little).multiplyScalar(0.5).sub(wrist), index.clone().sub(little)).normalize()

      if (palm.dot(new THREE.Vector3(-wrist.x, -1, 0)) < 0) palm.negate()
      const thigh = kneeAt.clone().sub(hip).normalize()
      return {
        upper, fore, elbow: new THREE.Vector3().crossVectors(upper, fore).normalize(),
        hand: middle.sub(wrist).normalize(), palm,
        thigh, shin: ankle.clone().sub(kneeAt).normalize(),
        knee: X_AXIS.clone().addScaledVector(thigh, -thigh.x).normalize(),
        armLengths: [shoulder.distanceTo(elbow), elbow.distanceTo(wrist)],
        legLengths: [hip.distanceTo(kneeAt), kneeAt.distanceTo(ankle)],
        shoulderOut: Math.abs(shoulder.x), hipOut: Math.abs(hip.x),
      }
    })
  }

  reset(effort: number) {
    this.move = smoothstep(effort, MOVE_FROM, MOVE_TO)
    this.sprint = smoothstep(effort, CRAWL_FROM, CRAWL_TO)
    this.look = 0; this.bank = 0; this.palmRoll[0] = this.palmRoll[1] = 0
    this.cycles.breast = BREAST_ENTRY; this.cycles.crawl = CRAWL_ENTRY
  }

  update(dt: number, input: SwimInput) {

    const effort = input.effort
    const move = smoothstep(effort, MOVE_FROM, MOVE_TO), sprint = smoothstep(effort, CRAWL_FROM, CRAWL_TO)
    this.move = damp(this.move, move, move > this.move ? 3 : 1.6, dt)
    this.sprint = damp(this.sprint, sprint, sprint > this.sprint ? 2.5 : 1.8, dt)
    const strokes = this.strokes
    strokes.tread = 1 - this.move
    strokes.breast = this.move * (1 - this.sprint)
    strokes.crawl = this.move * this.sprint
    const cycles = this.cycles
    cycles.tread += dt * TREAD_RATE
    if (strokes.breast > 0.002) cycles.breast += dt * BREAST_RATE * clamp(effort / BREAST_SPEED, 0.6, 1.3)
    else cycles.breast = Math.ceil(cycles.breast - BREAST_ENTRY) + BREAST_ENTRY
    if (strokes.crawl > 0.002) cycles.crawl += dt * CRAWL_RATE * clamp(effort / CRAWL_SPEED, 0.75, 1.2)
    else cycles.crawl = Math.ceil(cycles.crawl - CRAWL_ENTRY) + CRAWL_ENTRY
    this.look = damp(this.look, clamp(input.look, -1.05, 1.05), 3, dt)
    this.bank = damp(this.bank, clamp(-input.turnRate * 0.22, -0.3, 0.3) * this.move, 4, dt)

    const aim = this.aim.fill(0)
    if (strokes.tread > 0.001) this.add(this.tread(cycles.tread), strokes.tread)
    if (strokes.breast > 0.001) this.add(this.breast(cycles.breast), strokes.breast)
    if (strokes.crawl > 0.001) this.add(this.crawl(cycles.crawl), strokes.crawl)
    aim[ROLL] += this.bank
    this.pose(input.surface)
  }

  apply(weight: number) {
    for (const joint of this.joints) joint.bone.quaternion.slerp(joint.local, weight)
    this.hips.quaternion.copy(this.hipsBind).slerp(this.hipsRotation, weight)
    this.hips.position.lerp(this.hipsPosition, weight)
  }

  private add(part: Float64Array, weight: number) {
    for (let i = 0; i < AIM_SIZE; i++) this.aim[i] += part[i] * weight
  }

  private tread(cycle: number) {
    const out = this.part.fill(0)
    const phase = cycle * TAU
    for (let s = 0; s < 2; s++) {
      const a = ARM[s]

      out[a] = 0.34 + 0.12 * Math.sin(phase)
      out[a + 1] = -0.24 + 0.02 * Math.sin(2 * phase)
      out[a + 2] = 0.3 + 0.05 * Math.cos(2 * phase)
      out[a + 3] = 1; out[a + 4] = -1.1; out[a + 5] = -0.35
      out[a + 6] = 0.45 * Math.cos(phase); out[a + 7] = -1; out[a + 8] = 0.12
      out[a + 9] = 0.12

      const l = LEG[s], kick = phase * 1.08 + s * Math.PI
      out[l] = 0.28 + 0.13 * Math.cos(kick)
      out[l + 1] = -0.5 + 0.05 * Math.sin(kick)
      out[l + 2] = 0.13 + 0.13 * Math.sin(kick)
      out[l + 3] = 0.8; out[l + 4] = 0.25; out[l + 5] = 1
      out[l + 6] = 0.1 + 0.22 * Math.sin(kick + 1)
      out[l + 7] = 0.55
    }
    out[PITCH] = 0.26 + 0.025 * Math.sin(phase + 0.6)
    out[DEPTH] = 0.55 + 0.018 * Math.sin(2 * phase + 0.4)
    out[BACK] = 0.04
    out[FLEX] = 0.06
    out[HEAD_PITCH] = -0.2
    out[HEAD_YAW] = this.look
    return out
  }

  private breast(cycle: number) {
    const out = this.part.fill(0)
    for (let s = 0; s < 2; s++) {
      breastArm.sample(cycle, out, ARM[s])
      breastLeg.sample(cycle, out, LEG[s])
    }
    const body = this.body
    breastBody.sample(cycle, body, 0)
    out[PITCH] = body[0]; out[DEPTH] = body[1]; out[BACK] = body[2]; out[FLEX] = body[3]; out[HEAD_PITCH] = body[4]

    out[BACK] -= 0.05 * Math.sin(TAU * (cycle - 0.42))
    return out
  }

  private crawl(cycle: number) {
    const out = this.part.fill(0)
    crawlArm.sample(cycle, out, ARM[0])
    crawlArm.sample(cycle + 0.5, out, ARM[1])
    for (let s = 0; s < 2; s++) {
      const l = LEG[s], beat = cycle * 3 * TAU + s * Math.PI
      out[l] = 0.085
      out[l + 1] = -0.772 + 0.03 * (0.5 + 0.5 * Math.cos(beat + 1.3))
      out[l + 2] = 0.12 * Math.sin(beat)
      out[l + 3] = 0; out[l + 4] = 0; out[l + 5] = 1
      out[l + 6] = 0.95 + 0.12 * Math.sin(beat + 0.9)
      out[l + 7] = -0.12
    }

    const half = (cycle - CRAWL_ENTRY - 0.03) * 2, stroke = Math.floor(half), progress = half - stroke
    const breathing = ((stroke % 3) + 3) % 3 === 0
    const breath = breathing ? smoothstep(progress, 0.05, 0.35) * (1 - smoothstep(progress, 0.6, 0.95)) : 0
    const side = stroke % 2 === 0 ? -1 : 1
    const roll = -0.55 * Math.sin(TAU * (cycle - CRAWL_ENTRY - 0.05)) + side * 0.12 * breath
    out[PITCH] = 1.49 + 0.02 * Math.sin(2 * TAU * cycle)
    out[ROLL] = roll
    out[DEPTH] = 0.12 + 0.015 * Math.sin(2 * TAU * cycle + 0.5)
    out[BACK] = 0.33
    out[FLEX] = 0.02
    out[TWIST] = roll * 0.3
    out[HEAD_PITCH] = -0.28 - 0.12 * breath

    out[HEAD_YAW] = -roll * 0.7 + side * 1.05 * breath
    return out
  }

  private pose(surface: number) {
    const aim = this.aim, joints = this.joints
    const [chest, waist, head, turn, pitchRoll, carry] = this.qa
    const [line, pole, palm, upper, lower, hinge, hand, palmDir, target] = this.va
    const euler = this.euler
    const set = (slot: number, rotation: THREE.Quaternion) => joints[slot].global.copy(rotation).multiply(joints[slot].bind)

    waist.setFromEuler(euler.set(aim[FLEX] * 0.45, aim[TWIST] * 0.45, 0, 'XZY'))
    chest.setFromEuler(euler.set(aim[FLEX], aim[TWIST], 0, 'XZY'))
    joints[PELVIS].global.copy(joints[PELVIS].bind)
    joints[SPINE].global.copy(joints[SPINE].bind)
    set(SPINE1, waist)
    set(SPINE2, chest)
    set(NECK, turn.copy(chest).multiply(head.setFromEuler(euler.set(aim[HEAD_PITCH] * 0.4, aim[HEAD_YAW] * 0.45, 0, 'YXZ'))))
    set(HEAD, turn.copy(chest).multiply(head.setFromEuler(euler.set(aim[HEAD_PITCH], aim[HEAD_YAW], 0, 'YXZ'))))
    for (let s = 0; s < 2; s++) {
      const sign = s === 0 ? 1 : -1, a = ARM[s]
      const lift = CLAVICLE_LIFT * smoothstep(aim[a + 1], 0.12, 0.5), push = CLAVICLE_PUSH * smoothstep(aim[a + 1], 0.2, 0.5)
      set(CLAVICLE[s], turn.copy(chest).multiply(head.setFromAxisAngle(Z_AXIS, sign * lift)).multiply(carry.setFromAxisAngle(Y_AXIS, -sign * push)))
    }
    this.forward()

    for (let s = 0; s < 2; s++) {
      const side = this.sides[s], sign = s === 0 ? 1 : -1, a = ARM[s], l = LEG[s]

      target.set(sign * (aim[a] - side.shoulderOut), aim[a + 1], aim[a + 2]).applyQuaternion(chest).add(joints[UPPER[s]].position)
      pole.set(sign * aim[a + 3], aim[a + 4], aim[a + 5]).applyQuaternion(chest)
      reach(joints[UPPER[s]].position, target, pole, side.armLengths[0], side.armLengths[1], upper, lower, hinge)
      set(UPPER[s], frameRotation(side.upper, side.elbow, upper, hinge, turn))
      const forearm = frameRotation(side.fore, side.elbow, lower, hinge, carry)

      line.copy(side.palm).applyQuaternion(forearm)
      line.addScaledVector(lower, -line.dot(lower)).normalize()
      palm.set(sign * aim[a + 6], aim[a + 7], aim[a + 8]).applyQuaternion(chest).normalize()
      palm.addScaledVector(lower, -palm.dot(lower))
      const sure = smoothstep(palm.length(), 0.15, 0.45)
      const aimed = Math.atan2(hand.crossVectors(line, palm).dot(lower), line.dot(palm))
      const last = this.palmRoll[s]
      this.palmRoll[s] = clamp(last + Math.atan2(Math.sin(aimed - last), Math.cos(aimed - last)), -2.4, 2.4)
      const roll = this.palmRoll[s] * sure
      palm.copy(line).applyAxisAngle(lower, roll)
      set(FORE[s], turn.setFromAxisAngle(lower, roll * FOREARM_TWIST).multiply(forearm))
      const flex = aim[a + 9]
      hand.copy(lower).multiplyScalar(Math.cos(flex)).addScaledVector(palm, Math.sin(flex))
      palmDir.copy(palm).multiplyScalar(Math.cos(flex)).addScaledVector(lower, -Math.sin(flex))
      set(HAND[s], frameRotation(side.hand, side.palm, hand, palmDir, turn))

      target.set(sign * (aim[l] - side.hipOut), aim[l + 1], aim[l + 2]).add(joints[THIGH[s]].position)
      pole.set(sign * aim[l + 3], aim[l + 4], aim[l + 5])
      reach(joints[THIGH[s]].position, target, pole, side.legLengths[0], side.legLengths[1], upper, lower, hinge)
      set(THIGH[s], frameRotation(side.thigh, side.knee, upper, hinge, turn))
      const shin = frameRotation(side.shin, side.knee, lower, hinge, carry)
      set(CALF[s], shin)

      set(FOOT[s], turn.copy(shin).multiply(head.setFromAxisAngle(side.knee, aim[l + 6])).multiply(pitchRoll.setFromAxisAngle(Y_AXIS, sign * aim[l + 7])))
      joints[TOE[s]].global.copy(joints[FOOT[s]].global).multiply(head.copy(joints[FOOT[s]].bind).invert()).multiply(joints[TOE[s]].bind)
    }

    for (const joint of joints) {
      const parent = joint.parent < 0 ? this.hipsBind : joints[joint.parent].global
      joint.local.copy(parent).invert().multiply(joint.global)
    }

    pitchRoll.setFromAxisAngle(X_AXIS, aim[PITCH]).multiply(head.setFromAxisAngle(Y_AXIS, aim[ROLL]))
    this.hipsRotation.copy(pitchRoll).multiply(this.hipsBind)
    this.hipsPosition.set(0, surface - aim[DEPTH], -aim[BACK])
  }

  private forward() {
    const joints = this.joints
    for (const slot of [PELVIS, SPINE, SPINE1, SPINE2, NECK, CLAVICLE[0], UPPER[0], CLAVICLE[1], UPPER[1], THIGH[0], THIGH[1]]) {
      const joint = joints[slot]
      if (joint.parent < 0) joint.position.copy(joint.offset).applyQuaternion(this.hipsBind)
      else joint.position.copy(joint.offset).applyQuaternion(joints[joint.parent].global).add(joints[joint.parent].position)
    }
  }
}
