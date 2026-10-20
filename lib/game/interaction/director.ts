import * as THREE from 'three'
import { input } from '../input'
import { runtime } from '../runtime'
import { RARITY_LABELS } from '../resources/types'
import { footprintGap, type BuiltInteraction } from '../world/structure-streamer'
import { promptAnchor, pushToast, setPrompt, type PromptState } from './hud'
import { interactPose, survivorHands } from './pose'
import { buildingMatrix, interactionWorld, leafDirection, leafFront, leafKey, leafMatrix, leafPoint, lidAcceleration, lidBalance, pickupKey, toScene, toSceneDirection, type Building, type InteractionWorld, type LeafRef, type PickupRef } from './world'

const { clamp, damp, lerp, smoothstep } = THREE.MathUtils

export type Probe = { sight(from: THREE.Vector3, to: THREE.Vector3, slack: number): boolean; fits(feet: THREE.Vector3): boolean }
export type Glow = { ref: LeafRef; level: number; goal: number; since: number }
export type Spark = { ref: PickupRef; level: number; goal: number; focus: number; lit: number; point: THREE.Vector3; size: number; phase: number }

type Entry = { leaves: LeafRef[]; pickups: PickupRef[] }
type Candidate = { leaf: LeafRef | null; pickup: PickupRef | null; point: THREE.Vector3; score: number; slack: number }
type Phase = 'approach' | 'settle' | 'reach' | 'grip' | 'drive' | 'release' | 'lift' | 'stow' | 'recover'

const UP = new THREE.Vector3(0, 1, 0)
const ONE = new THREE.Vector3(1, 1, 1)
const REST = new THREE.Vector3()
const HINGE = new THREE.Vector3()
const SIDE = new THREE.Vector3()
const CHEST = 1.22
const HEAD = 1.6
const LEAF_RANGE = 2.1
const PICK_RANGE = 1.9
const GLOW_RANGE = 2.7
const SPARK_RANGE = 6.5
const MAX_GLOWS = 10
const MAX_SPARKS = 96
const MAX_CANDIDATES = 192
const COAST = { door: 2.3, drawer: 7.5, lid: 1.4 }
const RELEASE = { door: { open: 0.46, close: 0.6 }, drawer: { open: 0.82, close: 0.72 }, lid: { open: 0.82, close: 0.7 } }
const KIND_LABEL = { door: 'Porta', drawer: 'Gaveta', lid: 'Tampa' }
const SIDESTEP = [0, 0.22, -0.22, 0.4, -0.4]
const OUT_OF_REACH = 'Fora de alcance daqui. Tente chegar por outro lado.'
const SIDESTEP_ONE = [0, 0.2, 0.38]

const ease = (t: number) => {
  const x = clamp(t, 0, 1)
  return x * x * x * (10 + x * (6 * x - 15))
}
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
const hashOf = (text: string) => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

function hermite(a: number, b: number, va: number, vb: number, span: number, t: number) {
  const t2 = t * t, t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * span * va + (3 * t2 - 2 * t3) * b + (t3 - t2) * span * vb
}

function hermiteSlope(a: number, b: number, va: number, vb: number, span: number, t: number) {
  const t2 = t * t
  return ((6 * t2 - 6 * t) * a + (3 * t2 - 4 * t + 1) * span * va + (6 * t - 6 * t2) * b + (3 * t2 - 2 * t) * span * vb) / span
}

function bezier(out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, t: number) {
  const u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t
  return out.set(a.x * w0 + b.x * w1 + c.x * w2 + d.x * w3, a.y * w0 + b.y * w1 + c.y * w2 + d.y * w3, a.z * w0 + b.z * w1 + c.z * w2 + d.z * w3)
}

function spring(position: THREE.Vector3, velocity: THREE.Vector3, goal: THREE.Vector3, omega: number, dt: number) {
  const decay = Math.exp(-omega * dt)
  for (const axis of ['x', 'y', 'z'] as const) {
    const offset = position[axis] - goal[axis], speed = velocity[axis]
    const carry = (speed + omega * offset) * dt
    position[axis] = goal[axis] + (offset + carry) * decay
    velocity[axis] = (speed - omega * carry) * decay
  }
}

function turnToward(direction: THREE.Vector3, goal: THREE.Vector3, rate: number, dt: number) {
  direction.lerp(goal, 1 - Math.exp(-rate * dt))
  if (direction.lengthSq() < 1e-6) direction.copy(goal)
  return direction.normalize()
}

class Action {
  phase: Phase = 'settle'
  clock = 0
  arm = -1
  opening = true
  free = false
  span = 0.5
  from = 0
  rest = 0
  launch = 0
  drift = 0
  reach = 0
  scale = 1
  best = Infinity
  mark = 0
  readonly spot = new THREE.Vector3()
  readonly aim = new THREE.Vector3()
  readonly toward = new THREE.Vector3()
  readonly a = new THREE.Vector3()
  readonly b = new THREE.Vector3()
  readonly c = new THREE.Vector3()
  readonly d = new THREE.Vector3()
  readonly attach = new THREE.Matrix4()
  readonly center = new THREE.Vector3()
  readonly snug = new THREE.Vector3()
  readonly offset = new THREE.Vector3()

  constructor(readonly leaf: LeafRef | null, readonly pickup: PickupRef | null) {}

  enter(phase: Phase) {
    this.phase = phase
    this.clock = 0
  }
}

export class InteractionDirector {
  readonly glows = new Map<string, Glow>()
  readonly sparks = new Map<string, Spark>()
  cullRadius = 20
  private action: Action | null = null
  private holding: Action | null = null
  private focusLeaf: LeafRef | null = null
  private focusPickup: PickupRef | null = null
  private focusKey = ''
  private readonly focusPoint = new THREE.Vector3()
  private readonly entries = new WeakMap<BuiltInteraction, Entry>()
  private readonly candidates: Candidate[] = Array.from({ length: MAX_CANDIDATES }, () => ({ leaf: null, pickup: null, point: new THREE.Vector3(), score: 0, slack: 0.32 }))
  private count = 0
  private readonly searched = new Set<string>()
  private noticeAt = 0
  private cullClock = 0
  private time = 0
  private reachLevel = 0
  private handReady = false
  private readonly feet = new THREE.Vector3()
  private readonly chest = new THREE.Vector3()
  private readonly head = new THREE.Vector3()
  private readonly forward = new THREE.Vector3(0, 0, 1)
  private readonly left = new THREE.Vector3(1, 0, 0)
  private readonly ndc = new THREE.Vector3()
  private readonly view = new THREE.Vector3()
  private readonly hand = new THREE.Vector3()
  private readonly handVelocity = new THREE.Vector3()
  private readonly goal = new THREE.Vector3()
  private readonly want = { weight: 0, hand: 0, grip: 0, look: 0, lean: 1, bend: 0, twist: 0, shrug: 0, crouch: 0 }
  private readonly wantPalm = new THREE.Vector3(0, -1, 0)
  private readonly wantFinger = new THREE.Vector3(0, 0, 1)
  private readonly wantPole = new THREE.Vector3(0, -1, 0)
  private readonly wantLook = new THREE.Vector3()
  private readonly v = Array.from({ length: 14 }, () => new THREE.Vector3())
  private readonly m = Array.from({ length: 5 }, () => new THREE.Matrix4())
  private readonly q = new THREE.Quaternion()

  get busy() {
    return this.action !== null
  }

  get preview() {
    return this.action?.pickup ?? this.focusPickup
  }

  get clock() {
    return this.time
  }

  update(dt: number, camera: THREE.Camera, probe: Probe | null) {
    const world = interactionWorld()
    this.time += dt
    if (this.noticeAt && this.time - this.noticeAt > 2.8) {
      if (runtime.notice === OUT_OF_REACH) runtime.notice = ''
      this.noticeAt = 0
    }
    this.measure()
    if (world) {
      world.step(dt)
      this.cull(world, dt)
      const ready = this.ready()
      this.scan(world, camera, probe, ready)
      if (input.interactQueued && ready && !this.action && (this.focusLeaf || this.focusPickup)) this.begin(world, probe)
      if (this.action) this.advance(world, dt)
    } else {
      this.clearFocus()
      if (this.action) this.finish()
    }
    input.interactQueued = false
    this.output(dt)
    this.fade(dt)
    this.frame(dt)
  }

  present(camera: THREE.Camera, width: number, height: number) {
    const world = interactionWorld()
    promptAnchor.busy = this.action !== null
    if (!world || this.action || (!this.focusLeaf && !this.focusPickup)) {
      promptAnchor.visible = false
      setPrompt(null)
      return
    }
    camera.updateMatrixWorld()
    const view = this.view.copy(this.focusPoint).applyMatrix4(camera.matrixWorldInverse)
    const visible = view.z < -0.05
    if (visible) {
      const ndc = this.ndc.copy(view).applyMatrix4((camera as THREE.PerspectiveCamera).projectionMatrix)
      promptAnchor.x = (ndc.x * 0.5 + 0.5) * width
      promptAnchor.y = (-ndc.y * 0.5 + 0.5) * height
    }
    promptAnchor.visible = visible
    setPrompt(this.describe(world))
  }

  heldMatrix(out: THREE.Matrix4) {
    const action = this.holding
    if (!action) return false
    this.palmMatrix(action.arm, out)
    const center = this.v[13].copy(action.center).add(action.offset)
    out.multiply(this.m[3].makeTranslation(center.x, center.y, center.z))
    out.multiply(this.m[4].makeScale(action.scale, action.scale, action.scale))
    out.multiply(this.m[3].makeTranslation(-action.center.x, -action.center.y, -action.center.z))
    out.multiply(action.attach)
    return true
  }

  heldRef() {
    return this.holding?.pickup ?? null
  }

  dispose() {
    const world = interactionWorld()
    if (world && this.holding?.pickup) world.drop(this.holding.pickup)
    this.holding = null
    this.action = null
    this.glows.clear()
    this.sparks.clear()
    const steer = runtime.interaction
    steer.moving = false
    steer.locked = false
    steer.active = false
    steer.focus = 0
    steer.faceYaw = Number.NaN
    interactPose.weight = 0
    interactPose.reach = 0
    promptAnchor.visible = false
    promptAnchor.busy = false
    setPrompt(null)
  }

  private ready() {
    return runtime.phase === 'playing' && input.enabled && runtime.mode === 'walk' && runtime.grounded && !runtime.water.swimming && runtime.terrainReady
  }

  private steering() {
    return input.held.forward || input.held.backward || input.held.left || input.held.right || input.moveX !== 0 || input.moveY !== 0
  }

  private measure() {
    const facing = runtime.bodyFacing
    this.forward.set(Math.sin(facing), 0, Math.cos(facing))
    this.left.set(Math.cos(facing), 0, -Math.sin(facing))
    this.feet.copy(runtime.bodyPosition)
    const crouch = runtime.crouchAmount
    this.chest.copy(this.feet)
    this.chest.y += lerp(CHEST, 0.85, crouch)
    const hands = survivorHands.current
    if (hands) hands.headPoint(this.head)
    else {
      this.head.copy(this.feet)
      this.head.y += lerp(HEAD, 1.1, crouch)
    }
  }

  private entry(building: Building) {
    let entry = this.entries.get(building.interaction)
    if (!entry) {
      const leaves: LeafRef[] = [], pickups: PickupRef[] = []
      building.interaction.interactables.forEach((host, h) => host.leaves.forEach((data, l) => leaves.push({ building, host, data, interactable: h, index: l, key: leafKey(building.seed, h, l) })))
      building.interaction.pickups.forEach((data, index) => pickups.push({ building, data, index, key: pickupKey(building.seed, data.key) }))
      entry = { leaves, pickups }
      this.entries.set(building.interaction, entry)
    }
    return entry
  }

  private cull(world: InteractionWorld, dt: number) {
    this.cullClock -= dt
    if (this.cullClock > 0) return
    this.cullClock = 0.4
    const far = this.cullRadius * this.cullRadius, near = far * 0.81
    for (const building of world.buildings()) for (const ref of this.entry(building).pickups) {
      if (world.collected.has(ref.key)) continue
      const distance = world.pickupPosition(ref, this.v[0]).distanceToSquared(this.feet)
      const hidden = world.distant.has(ref.key)
      if (!hidden && distance > far) {
        world.distant.add(ref.key)
        world.refresh(ref)
      } else if (hidden && distance < near) {
        world.distant.delete(ref.key)
        world.refresh(ref)
      }
    }
  }

  private onScreen(point: THREE.Vector3, camera: THREE.Camera) {
    const view = this.view.copy(point).applyMatrix4(camera.matrixWorldInverse)
    if (view.z > -0.05) return false
    this.ndc.copy(view).applyMatrix4((camera as THREE.PerspectiveCamera).projectionMatrix)
    return Math.abs(this.ndc.x) < 1.08 && Math.abs(this.ndc.y) < 1.08
  }

  private scan(world: InteractionWorld, camera: THREE.Camera, probe: Probe | null, ready: boolean) {
    for (const glow of this.glows.values()) glow.goal = 0
    for (const spark of this.sparks.values()) {
      spark.goal = 0
      spark.focus = 0
    }
    this.count = 0
    const action = this.action
    if (ready || action) {
      const x = runtime.worldPosition.x, z = runtime.worldPosition.z
      for (const building of world.buildings()) {
        if (footprintGap(building.record, x, z) > SPARK_RANGE) continue
        const entry = this.entry(building)
        for (const ref of entry.leaves) this.considerLeaf(world, ref, camera)
        for (const ref of entry.pickups) this.considerPickup(world, ref, camera)
      }
    }
    if (action) {
      for (const glow of this.glows.values()) glow.goal *= glow.ref === action.leaf ? 0 : 0.35
      if (action.pickup) {
        const spark = this.sparks.get(action.pickup.key)
        if (spark) spark.goal = 0
      }
      this.clearFocus()
      return
    }
    if (!ready) {
      this.clearFocus()
      return
    }
    this.choose(probe)
    if (this.focusLeaf) {
      const glow = this.glowOf(this.focusLeaf, true)
      if (glow) glow.goal = 1
    } else if (this.focusPickup) {
      const spark = this.sparks.get(this.focusPickup.key)
      if (spark) spark.focus = 1
    }
  }

  private considerLeaf(world: InteractionWorld, ref: LeafRef, camera: THREE.Camera) {
    const data = ref.data, record = ref.building.record
    const point = toScene(record, leafPoint(data, world.leafValue(ref.key, data), data.handle, this.v[0]), this.v[1])
    const dx = point.x - this.chest.x, dz = point.z - this.chest.z, flat = Math.hypot(dx, dz)
    if (flat > GLOW_RANGE) return
    const lift = point.y - this.feet.y
    if (lift < 0.02 || lift > 2.15) return
    const normal = toSceneDirection(record, leafFront(data, this.v[2]), this.v[2])
    const center = toScene(record, this.v[3].set(data.center[0], data.center[1], data.center[2]), this.v[3])
    if ((this.feet.x - center.x) * normal.x + (this.feet.z - center.z) * normal.z < 0.08) return
    if (!this.onScreen(point, camera)) return
    const glow = this.glowOf(ref, false)
    if (glow) glow.goal = Math.max(glow.goal, 0.32 * (1 - smoothstep(flat, GLOW_RANGE - 0.7, GLOW_RANGE)))
    if (flat > LEAF_RANGE || this.burdened(world, ref)) return
    const ahead = (dx * this.forward.x + dz * this.forward.z) / Math.max(flat, 1e-3)
    const stocked = !this.opens(world, ref) && !this.emptied(world, ref) ? 0.9 : 0
    this.push(ref, null, point, flat * 0.9 + Math.hypot(this.ndc.x, this.ndc.y * 0.85) * 1.15 + (ahead < -0.3 ? 0.7 : 0) + stocked - (this.focusKey === ref.key ? 0.18 : 0), 0.32)
  }

  private considerPickup(world: InteractionWorld, ref: PickupRef, camera: THREE.Camera) {
    if (world.collected.has(ref.key) || world.held === ref.key || !world.accessible(ref)) return
    const base = world.pickupPosition(ref, this.v[0])
    const dx = base.x - this.chest.x, dz = base.z - this.chest.z, flat = Math.hypot(dx, dz)
    if (flat > SPARK_RANGE) return
    const size = ref.data.size
    const top = this.v[1].copy(base)
    top.y += size[1] + 0.03
    if (!this.onScreen(top, camera)) return
    const spark = this.sparkOf(ref)
    if (spark) {
      spark.goal = 1 - smoothstep(flat, SPARK_RANGE - 1.6, SPARK_RANGE)
      spark.point.copy(top)
    }
    const lift = base.y - this.feet.y
    if (flat > PICK_RANGE || lift < -0.1 || lift > 2) return
    const ahead = (dx * this.forward.x + dz * this.forward.z) / Math.max(flat, 1e-3)
    this.push(null, ref, top, flat * 0.9 + Math.hypot(this.ndc.x, this.ndc.y * 0.85) * 1.15 + (ahead < -0.3 ? 0.7 : 0) - 0.25 - (this.focusKey === ref.key ? 0.18 : 0), ref.data.leaf >= 0 ? 0.62 : 0.32)
  }

  private push(leaf: LeafRef | null, pickup: PickupRef | null, point: THREE.Vector3, score: number, slack: number) {
    if (this.count >= MAX_CANDIDATES) return
    const candidate = this.candidates[this.count++]
    candidate.leaf = leaf
    candidate.pickup = pickup
    candidate.point.copy(point)
    candidate.score = score
    candidate.slack = slack
  }

  private choose(probe: Probe | null) {
    for (let checked = 0; checked < 4; checked++) {
      let best = -1, score = Infinity
      for (let i = 0; i < this.count; i++) if (this.candidates[i].score < score) { score = this.candidates[i].score; best = i }
      if (best < 0) break
      const candidate = this.candidates[best]
      candidate.score = Infinity
      if (probe && !probe.sight(this.head, candidate.point, candidate.slack)) continue
      this.focusLeaf = candidate.leaf
      this.focusPickup = candidate.pickup
      this.focusPoint.copy(candidate.point)
      const key = (candidate.leaf ?? candidate.pickup)!.key
      if (key !== this.focusKey) {
        const glow = candidate.leaf ? this.glows.get(key) : undefined
        if (glow) glow.since = this.time
      }
      this.focusKey = key
      return
    }
    this.clearFocus()
  }

  private clearFocus() {
    this.focusLeaf = null
    this.focusPickup = null
    this.focusKey = ''
  }

  private glowOf(ref: LeafRef, force: boolean) {
    let glow = this.glows.get(ref.key)
    if (!glow && (force || this.glows.size < MAX_GLOWS)) {
      glow = { ref, level: 0, goal: 0, since: this.time }
      this.glows.set(ref.key, glow)
    }
    return glow
  }

  private sparkOf(ref: PickupRef) {
    let spark = this.sparks.get(ref.key)
    if (!spark && this.sparks.size < MAX_SPARKS) {
      const size = ref.data.size
      spark = { ref, level: 0, goal: 0, focus: 0, lit: 0, point: new THREE.Vector3(), size: clamp(Math.max(size[0], size[1], size[2]), 0.06, 0.6), phase: hashOf(ref.key) }
      this.sparks.set(ref.key, spark)
    }
    return spark
  }

  private describe(world: InteractionWorld): PromptState {
    if (this.focusLeaf) {
      const ref = this.focusLeaf, data = ref.data
      const kind = data.kind === 'lid' && data.handle[1] - data.pivot[1] > 0.12 ? KIND_LABEL.door : KIND_LABEL[data.kind]
      const empty = this.searched.has(ref.key) && this.emptied(world, ref)
      return { visible: true, verb: this.opens(world, ref) ? 'Abrir' : 'Fechar', label: ref.host.label, detail: empty ? `${kind} · vazia` : kind, tone: 'leaf', rarity: '' }
    }
    const data = this.focusPickup!.data
    return { visible: true, verb: 'Pegar', label: data.quantity > 1 ? `${data.label} ×${data.quantity}` : data.label, detail: data.category, tone: 'pickup', rarity: RARITY_LABELS[data.rarity] }
  }

  private opens(world: InteractionWorld, ref: LeafRef) {
    const motion = world.motions.get(ref.key)
    const value = world.leafValue(ref.key, ref.data) + (motion && !motion.settled ? motion.velocity * 0.3 : 0)
    return value < ref.data.travel * 0.5
  }

  private burdened(world: InteractionWorld, ref: LeafRef) {
    const data = ref.data
    if (data.kind !== 'lid') return false
    HINGE.set(data.axis[0], data.axis[1], data.axis[2]).normalize()
    SIDE.set(data.up[1] * data.normal[2] - data.up[2] * data.normal[1], data.up[2] * data.normal[0] - data.up[0] * data.normal[2], data.up[0] * data.normal[1] - data.up[1] * data.normal[0])
    for (const pickup of this.entry(ref.building).pickups) {
      if (pickup.data.leaf >= 0 || world.collected.has(pickup.key) || world.held === pickup.key) continue
      const p = pickup.data.position
      REST.set(p[0] - data.pivot[0], p[1] - data.pivot[1], p[2] - data.pivot[2]).applyAxisAngle(HINGE, -data.initial)
      REST.x += data.pivot[0] - data.center[0]
      REST.y += data.pivot[1] - data.center[1]
      REST.z += data.pivot[2] - data.center[2]
      const lift = REST.x * data.normal[0] + REST.y * data.normal[1] + REST.z * data.normal[2]
      if (lift < data.depth / 2 - 0.03 || lift > data.depth / 2 + 0.12) continue
      if (Math.abs(REST.dot(SIDE)) > data.width / 2 + 0.03) continue
      if (Math.abs(REST.x * data.up[0] + REST.y * data.up[1] + REST.z * data.up[2]) > data.height / 2 + 0.03) continue
      return true
    }
    return false
  }

  private emptied(world: InteractionWorld, ref: LeafRef) {
    for (const pickup of this.entry(ref.building).pickups) {
      if (pickup.data.interactable === ref.interactable && pickup.data.leaf === ref.index && !world.collected.has(pickup.key)) return false
    }
    return true
  }

  private begin(world: InteractionWorld, probe: Probe | null) {
    const action = new Action(this.focusLeaf, this.focusPickup)
    if (action.leaf) this.planLeaf(world, action, probe)
    else this.planPickup(world, action, probe)
    action.free = !this.steering()
    this.action = action
    this.handReady = false
    this.reachLevel = 0
    if (interactPose.lookWeight < 0.01) interactPose.look.copy(action.aim)
    this.wantLook.copy(action.aim)
    const steer = runtime.interaction
    steer.locked = true
    steer.active = true
    steer.faceYaw = Math.atan2(action.aim.x - action.spot.x, action.aim.z - action.spot.z)
    this.clearFocus()
  }

  private flatten(direction: THREE.Vector3) {
    direction.y = 0
    if (direction.lengthSq() < 1e-6) direction.copy(this.forward).negate()
    return direction.normalize()
  }

  private place(action: Action, anchor: THREE.Vector3, direction: THREE.Vector3, distances: number[], probe: Probe | null, side = 0) {
    const spot = this.v[12]
    const lean = side || ((this.feet.z - anchor.z) * direction.x - (this.feet.x - anchor.x) * direction.z > 0 ? 1 : -1)
    for (const shift of side ? SIDESTEP_ONE : SIDESTEP) {
      for (const distance of distances) {
        spot.copy(anchor).addScaledVector(direction, distance)
        spot.x -= direction.z * shift * lean
        spot.z += direction.x * shift * lean
        spot.y = this.feet.y
        if (!probe || probe.fits(spot)) {
          action.spot.copy(spot)
          return true
        }
      }
    }
    action.spot.copy(anchor).addScaledVector(direction, distances[0])
    action.spot.y = this.feet.y
    return false
  }

  private side(action: Action, point: THREE.Vector3) {
    const facing = Math.atan2(action.aim.x - action.spot.x, action.aim.z - action.spot.z)
    const lateral = (point.x - action.spot.x) * Math.cos(facing) - (point.z - action.spot.z) * Math.sin(facing)
    action.arm = lateral > 0.04 ? 1 : -1
  }

  private commit(action: Action, comfortable: boolean, placed: boolean) {
    const player = runtime.playerPosition
    const gap = Math.hypot(action.spot.x - player.x, action.spot.z - player.z)
    const cornered = !placed && Math.hypot(action.aim.x - player.x, action.aim.z - player.z) < 0.8
    if (comfortable || cornered || gap < 0.2) {
      action.spot.set(player.x, this.feet.y, player.z)
      action.enter('settle')
    } else action.enter('approach')
  }

  private planLeaf(world: InteractionWorld, action: Action, probe: Probe | null) {
    const ref = action.leaf!, data = ref.data, record = ref.building.record
    const value = world.leafValue(ref.key, data)
    action.opening = this.opens(world, ref)
    const normal = this.flatten(toSceneDirection(record, leafFront(data, this.v[0]), this.v[0]))
    const handle = toScene(record, leafPoint(data, value, data.handle, this.v[1]), this.v[1])
    const center = toScene(record, this.v[2].set(data.center[0], data.center[1], data.center[2]), this.v[2])
    const anchor = this.v[3]
    if (data.kind === 'drawer') {
      const facing = Math.atan2(-normal.x, -normal.z)
      anchor.copy(handle).addScaledVector(this.v[4].set(Math.cos(facing), 0, -Math.sin(facing)), 0.12)
      const standoff = action.opening ? 0.17 + data.travel : 0.4 + data.travel * 0.2
      const placed = this.place(action, anchor, normal, [standoff, standoff + 0.12, standoff + 0.26], probe)
      action.aim.copy(handle)
      const comfortable = this.reachable(handle, normal, standoff - 0.1, standoff + 0.08)
      this.side(action, handle)
      this.commit(action, comfortable, placed)
      return
    }
    if (data.kind === 'lid') {
      const facing = Math.atan2(-normal.x, -normal.z)
      const closed = toScene(record, leafPoint(data, 0, data.handle, this.v[5]), this.v[5])
      const hinge = toScene(record, this.v[6].set(data.pivot[0], data.pivot[1], data.pivot[2]), this.v[6])
      const standoff = 0.38 + clamp(closed.y - hinge.y, 0, 0.9) * 0.5
      anchor.copy(closed).addScaledVector(this.v[4].set(Math.cos(facing), 0, -Math.sin(facing)), 0.1)
      const placed = this.place(action, anchor, normal, [standoff, standoff + 0.12, standoff + 0.26], probe)
      action.aim.copy(handle)
      this.side(action, handle)
      this.commit(action, this.reachable(closed, normal, standoff - 0.14, standoff + 0.14), placed)
      return
    }
    let placed: boolean
    if (action.opening) {
      const pivot = toScene(record, this.v[4].set(data.pivot[0], data.pivot[1], data.pivot[2]), this.v[4])
      const closed = toScene(record, leafPoint(data, 0, data.handle, this.v[5]), this.v[5])
      const away = this.flatten(this.v[6].subVectors(closed, pivot))
      anchor.copy(closed).addScaledVector(away, 0.26)
      placed = this.place(action, anchor, normal, [0.46, 0.58, 0.72], probe, away.z * normal.x - away.x * normal.z > 0 ? 1 : -1)
    } else {
      const turned = this.flatten(toSceneDirection(record, leafDirection(data, value, data.normal, this.v[4]), this.v[4]))
      const bisector = this.flatten(this.v[5].addVectors(normal, turned))
      anchor.copy(handle)
      placed = this.place(action, anchor, bisector, [0.5, 0.62, 0.76], probe)
    }
    action.aim.lerpVectors(handle, center, action.opening ? 0.35 : 0)
    this.side(action, handle)
    this.commit(action, false, placed)
  }

  private reachable(point: THREE.Vector3, normal: THREE.Vector3, near: number, far: number) {
    const dx = this.feet.x - point.x, dz = this.feet.z - point.z
    const flat = Math.hypot(dx, dz)
    return flat > near && flat < far && (dx * normal.x + dz * normal.z) / Math.max(flat, 1e-3) > 0.55
  }

  private planPickup(world: InteractionWorld, action: Action, probe: Probe | null) {
    const ref = action.pickup!
    const base = world.pickupPosition(ref, this.v[0])
    const toBody = this.flatten(this.v[1].set(this.feet.x - base.x, 0, this.feet.z - base.z))
    const lift = base.y - this.feet.y
    const facing = Math.atan2(-toBody.x, -toBody.z)
    const anchor = this.v[2].copy(base).addScaledVector(this.v[3].set(Math.cos(facing), 0, -Math.sin(facing)), 0.1)
    const standoff = lift < 0.3 ? 0.36 : lift < 0.6 ? 0.42 : lift > 1.5 ? 0.38 : 0.44
    const placed = this.place(action, anchor, toBody, [standoff, standoff + 0.14, standoff + 0.3, standoff + 0.48], probe)
    action.aim.copy(base)
    action.aim.y += ref.data.size[1] * 0.5
    action.toward.copy(toBody)
    this.side(action, base)
    this.commit(action, this.reachable(base, toBody, standoff - 0.14, standoff + 0.1), placed)
  }

  private alive(world: InteractionWorld, action: Action) {
    const interaction = (action.leaf ?? action.pickup)!.building.interaction
    for (const building of world.buildings()) if (building.interaction === interaction) return true
    return false
  }

  private advance(world: InteractionWorld, dt: number) {
    const action = this.action!
    action.clock += dt
    if (action.phase !== 'recover' && !this.alive(world, action)) {
      this.abort(world)
      return
    }
    if (!this.steering()) action.free = true
    switch (action.phase) {
      case 'approach': this.approach(world, action); break
      case 'settle': this.settle(world, action); break
      case 'reach': this.reach(world, action); break
      case 'grip': this.grip(world, action); break
      case 'drive': this.drive(world, action); break
      case 'release': this.release(action); break
      case 'lift': this.lift(action); break
      case 'stow': this.stow(world, action); break
      case 'recover': this.recover(action); break
    }
  }

  private approach(world: InteractionWorld, action: Action) {
    const steer = runtime.interaction
    steer.moving = true
    steer.target.copy(action.spot)
    steer.speed = 1.4
    steer.faceYaw = Math.atan2(action.aim.x - action.spot.x, action.aim.z - action.spot.z)
    this.want.weight = 0.3
    this.want.look = 0.55
    this.want.lean = 0.5
    this.wantLook.copy(action.aim)
    if (action.free && this.steering()) {
      this.abort(world)
      return
    }
    const player = runtime.playerPosition
    const gap = Math.hypot(player.x - action.spot.x, player.z - action.spot.z)
    if (gap < action.best - 0.012) {
      action.best = gap
      action.mark = action.clock
    }
    if (gap < 0.06 || action.clock - action.mark > 0.32 || action.clock > 2.4) {
      steer.moving = false
      action.enter('settle')
    }
  }

  private settle(world: InteractionWorld, action: Action) {
    const steer = runtime.interaction
    steer.moving = false
    steer.faceYaw = Math.atan2(action.aim.x - this.feet.x, action.aim.z - this.feet.z)
    this.want.weight = 1
    this.want.look = 0.85
    this.wantLook.copy(action.aim)
    this.stance(action.aim.y - this.feet.y)
    if (action.free && this.steering()) {
      this.abort(world)
      return
    }
    const turn = Math.abs(wrap(runtime.bodyFacing - steer.faceYaw))
    if ((turn < 0.3 && runtime.speed < 0.35) || action.clock > 0.85) {
      const missed = Math.hypot(action.spot.x - this.feet.x, action.spot.z - this.feet.z) > 0.3
      if (missed && Math.hypot(action.aim.x - this.feet.x, action.aim.z - this.feet.z) > 0.95) {
        runtime.notice = OUT_OF_REACH
        this.noticeAt = this.time
        this.abort(world)
      } else this.startReach(world, action)
    }
  }

  private startReach(world: InteractionWorld, action: Action) {
    this.palmAt(action.arm, action.a)
    if (action.pickup) {
      const base = world.pickupPosition(action.pickup, this.v[0])
      action.toward.copy(this.flatten(this.v[1].set(this.feet.x - base.x, 0, this.feet.z - base.z)))
    }
    const grasp = this.grasp(world, action, this.v[2])
    action.span = clamp(0.34 + 0.34 * action.a.distanceTo(grasp), 0.42, 0.85)
    action.b.copy(action.a).lerp(grasp, 0.3).addScaledVector(UP, 0.07).addScaledVector(this.left, action.arm * 0.05)
    this.goal.copy(action.a)
    if (!this.handReady) {
      this.hand.copy(action.a)
      this.handVelocity.set(0, 0, 0)
      this.handReady = true
    }
    action.enter('reach')
  }

  private reach(world: InteractionWorld, action: Action) {
    const t = action.clock / action.span
    const grasp = this.grasp(world, action, this.v[1])
    const toward = this.approachOf(world, action, grasp, this.v[2])
    const pre = this.v[3].copy(grasp).addScaledVector(toward, 0.1)
    bezier(this.goal, action.a, action.b, pre, grasp, ease(t))
    this.reachLevel = ease(t / 0.85)
    this.want.weight = 1
    this.want.hand = ease(t)
    this.want.grip = t < 0.55 ? -0.55 * ease(t / 0.55) : lerp(-0.55, 0.3, ease((t - 0.55) / 0.45))
    this.want.look = 0.9
    this.wantLook.copy(grasp)
    this.stance(grasp.y - this.feet.y)
    this.orient(action, grasp, toward)
    if (t < 1) return
    if (action.pickup) this.grab(world, action)
    action.enter('grip')
  }

  private grip(world: InteractionWorld, action: Action) {
    const span = action.pickup ? 0.15 : 0.12
    const t = clamp(action.clock / span, 0, 1)
    const grasp = this.grasp(world, action, this.v[1])
    const toward = this.approachOf(world, action, grasp, this.v[2])
    if (action.leaf) this.goal.copy(grasp).addScaledVector(toward, -0.004)
    else this.goal.copy(grasp).addScaledVector(UP, -0.012 * Math.sin(Math.PI * t))
    this.reachLevel = 1
    this.want.hand = 1
    this.want.grip = action.leaf ? 1 : this.holdGrip(action)
    this.orient(action, grasp, toward)
    if (t < 1) return
    if (action.leaf) this.startDrive(world, action)
    else this.startLift(action)
  }

  private startDrive(world: InteractionWorld, action: Action) {
    const ref = action.leaf!, data = ref.data
    const motion = world.motion(ref)
    action.from = motion.value
    action.launch = motion.settled ? 0 : motion.velocity
    const final = action.opening ? data.travel : 0
    action.rest = action.from + (final - action.from) * RELEASE[data.kind][action.opening ? 'open' : 'close']
    if (data.kind === 'lid') {
      const balance = lidBalance(data)
      if (action.opening) action.rest = Math.min(data.travel, Math.max(action.rest, balance + 0.14))
      else if (lidAcceleration(data, action.rest) > 0) action.rest = 0
      else action.rest = Math.min(action.rest, Math.max(0, balance - 0.3))
    }
    action.drift = (final - action.rest) * COAST[data.kind] * 1.08
    const span = 1.5 * Math.abs(action.rest - action.from) / Math.max(Math.abs(action.drift), 1e-3)
    action.span = data.kind === 'lid' ? clamp(0.45 + 0.28 * Math.abs(action.rest - action.from), 0.5, 0.95) : clamp(span, 0.3, data.kind === 'door' ? 0.75 : 0.62)
    action.enter('drive')
  }

  private drive(world: InteractionWorld, action: Action) {
    const ref = action.leaf!, data = ref.data
    const t = Math.min(1, action.clock / action.span)
    const value = hermite(action.from, action.rest, action.launch, action.drift, action.span, t)
    const speed = hermiteSlope(action.from, action.rest, action.launch, action.drift, action.span, t)
    world.drive(ref, value, speed)
    const grasp = this.grasp(world, action, this.v[1])
    const toward = this.approachOf(world, action, grasp, this.v[2])
    this.goal.copy(grasp).addScaledVector(toward, -0.004)
    this.reachLevel = 1
    this.want.hand = 1
    this.want.grip = 1
    this.want.look = 0.8
    this.wantLook.copy(grasp)
    this.stance(grasp.y - this.feet.y)
    const pull = action.opening ? 1 : -1
    if (data.kind === 'door') this.want.twist = action.arm * 0.07 * pull
    else this.want.bend -= (data.kind === 'lid' ? 0.03 : 0.05) * pull
    this.orient(action, grasp, toward)
    const assisted = data.kind !== 'lid' || (action.opening ? lidAcceleration(data, value) > 1 : lidAcceleration(data, value) < -1)
    const slip = t > 0.3 && assisted && this.palmAt(action.arm, this.v[6]).distanceTo(this.goal) > 0.075
    if (t < 1 && !slip) return
    const left = (action.opening ? data.travel : 0) - value
    world.release(ref, slip ? Math.sign(left) * Math.min(Math.abs(left) * COAST[data.kind] * 1.08, Math.abs(speed) * 1.3) : action.drift)
    this.searched.add(ref.key)
    action.c.copy(this.goal)
    action.d.copy(toward)
    action.enter('release')
  }

  private release(action: Action) {
    const t = action.clock / 0.2, s = ease(t)
    this.goal.copy(action.c).addScaledVector(action.d, 0.055 * s).addScaledVector(UP, 0.012 * s)
    this.reachLevel = 1
    this.want.grip = -0.3
    this.want.look = 0.6
    this.want.twist = 0
    if (t >= 1) this.startRecover(action)
  }

  private startLift(action: Action) {
    action.a.copy(this.goal)
    const shoulder = this.shoulderAt(action.arm, this.v[0])
    const medial = this.v[1].copy(this.left).multiplyScalar(-action.arm)
    action.d.copy(shoulder).addScaledVector(this.forward, 0.3).addScaledVector(UP, -0.18).addScaledVector(medial, 0.06)
    action.b.copy(action.a).addScaledVector(UP, 0.16)
    action.c.copy(action.d).addScaledVector(this.forward, 0.05).addScaledVector(UP, -0.06)
    action.span = clamp(0.26 + 0.18 * action.a.distanceTo(action.d), 0.28, 0.42)
    action.enter('lift')
  }

  private lift(action: Action) {
    const t = action.clock / action.span, s = ease(t)
    bezier(this.goal, action.a, action.b, action.c, action.d, s)
    action.offset.subVectors(action.snug, action.center).multiplyScalar(s)
    this.reachLevel = 1
    this.want.hand = 1
    this.want.grip = this.holdGrip(action)
    this.want.crouch = 0
    this.want.bend = 0
    this.want.look = 0.75
    this.wantLook.copy(this.goal)
    const medial = this.v[0].copy(this.left).multiplyScalar(-action.arm)
    const outward = this.v[1].copy(this.left).multiplyScalar(action.arm)
    this.wantFinger.copy(this.forward).multiplyScalar(0.55).addScaledVector(UP, 0.6).normalize()
    this.wantPalm.copy(medial)
    this.wantPole.copy(UP).multiplyScalar(-0.7).addScaledVector(outward, 0.65).normalize()
    if (t >= 1) this.startStow(action)
  }

  private startStow(action: Action) {
    action.a.copy(this.goal)
    const shoulder = this.shoulderAt(action.arm, this.v[0])
    const outward = this.v[1].copy(this.left).multiplyScalar(action.arm)
    action.c.copy(shoulder).addScaledVector(UP, 0.2).addScaledVector(this.forward, 0.02).addScaledVector(outward, 0.15)
    action.d.copy(shoulder).addScaledVector(UP, 0.1).addScaledVector(this.forward, -0.2).addScaledVector(outward, 0.05)
    action.b.copy(action.a).addScaledVector(UP, 0.17).addScaledVector(outward, 0.05)
    action.span = 0.5
    action.enter('stow')
  }

  private stow(world: InteractionWorld, action: Action) {
    const t = action.clock / action.span, s = ease(t)
    bezier(this.goal, action.a, action.b, action.c, action.d, s)
    action.offset.subVectors(action.snug, action.center)
    this.reachLevel = 1
    this.want.hand = 0.85
    this.want.grip = this.holdGrip(action)
    this.want.lean = lerp(1, 0.5, s)
    this.want.twist = action.arm * 0.1 * s
    this.want.shrug = 0.12 * s
    const medial = this.v[0].copy(this.left).multiplyScalar(-action.arm)
    const outward = this.v[1].copy(this.left).multiplyScalar(action.arm)
    this.wantPole.copy(UP).multiplyScalar(0.55).addScaledVector(this.forward, 0.5).addScaledVector(outward, 0.65).normalize()
    this.wantFinger.copy(this.forward).multiplyScalar(-0.65).addScaledVector(UP, -0.55).normalize()
    this.wantPalm.copy(medial)
    this.wantLook.copy(this.head).addScaledVector(this.forward, 0.7).addScaledVector(outward, 0.3).addScaledVector(UP, -0.15)
    this.want.look = lerp(0.75, 0.25, s)
    if (t > 0.78) action.scale = 1 - ease((t - 0.78) / 0.22)
    if (t < 1) return
    const ref = action.pickup!
    world.collect(ref)
    pushToast({ label: ref.data.label, quantity: ref.data.quantity, category: ref.data.category, rarity: RARITY_LABELS[ref.data.rarity] })
    this.holding = null
    this.want.grip = -0.3
    this.startRecover(action)
  }

  private startRecover(action: Action) {
    action.reach = this.reachLevel
    action.c.copy(this.goal)
    const steer = runtime.interaction
    steer.locked = false
    steer.moving = false
    steer.faceYaw = Number.NaN
    action.enter('recover')
  }

  private recover(action: Action) {
    const t = action.clock / 0.5, s = ease(t)
    this.reachLevel = action.reach * (1 - s)
    const rest = this.v[0].copy(this.feet).addScaledVector(UP, 0.9).addScaledVector(this.left, action.arm * 0.24).addScaledVector(this.forward, 0.05)
    this.goal.lerpVectors(action.c, rest, s)
    this.want.weight = 1 - ease((t - 0.15) / 0.85)
    this.want.look = 0
    this.want.grip = 0
    this.want.hand = 1 - s
    this.want.crouch = 0
    this.want.bend = 0
    this.want.twist = 0
    this.want.shrug = 0
    this.want.lean = 1
    if (t >= 1) this.finish()
  }

  private abort(world: InteractionWorld) {
    const action = this.action
    if (!action) return
    if (this.holding?.pickup) world.drop(this.holding.pickup)
    this.holding = null
    if (action.leaf && action.phase === 'drive') world.release(action.leaf, world.motion(action.leaf).velocity)
    if (action.phase === 'approach' || action.phase === 'settle' || action.phase === 'recover') {
      const steer = runtime.interaction
      steer.locked = false
      steer.moving = false
      steer.faceYaw = Number.NaN
      if (action.phase !== 'recover') this.finish()
      return
    }
    this.startRecover(action)
  }

  private finish() {
    this.action = null
    this.reachLevel = 0
    this.handReady = false
    const steer = runtime.interaction
    steer.active = false
    steer.locked = false
    steer.moving = false
    steer.faceYaw = Number.NaN
    Object.assign(this.want, { weight: 0, hand: 0, grip: 0, look: 0, lean: 1, bend: 0, twist: 0, shrug: 0, crouch: 0 })
  }

  private stance(height: number) {
    this.want.crouch = clamp((1 - height) / 0.6, 0, 1.18) * 0.95
    this.want.bend = clamp((1 - height) / 0.75, 0, 1) * 0.16
    this.want.shrug = clamp((height - 1.55) / 0.4, 0, 1) * 0.16
    this.want.lean = 1
  }

  private holdGrip(action: Action) {
    const size = action.pickup!.data.size, largest = Math.max(size[0], size[1], size[2])
    return largest < 0.12 ? 1 : largest < 0.3 ? 0.82 : 0.62
  }

  private grasp(world: InteractionWorld, action: Action, out: THREE.Vector3) {
    if (action.leaf) {
      const ref = action.leaf, data = ref.data
      return toScene(ref.building.record, leafPoint(data, world.leafValue(ref.key, data), data.handle, out), out)
    }
    const ref = action.pickup!, size = ref.data.size
    world.pickupPosition(ref, out)
    out.y += size[1] + 0.006
    return out.addScaledVector(action.toward, Math.min(0.05, Math.min(size[0], size[2]) * 0.3))
  }

  private approachOf(world: InteractionWorld, action: Action, grasp: THREE.Vector3, out: THREE.Vector3) {
    if (action.leaf) {
      const ref = action.leaf, data = ref.data
      if (data.kind === 'lid') return toSceneDirection(ref.building.record, leafFront(data, out), out).addScaledVector(UP, 0.55).normalize()
      return this.flatten(toSceneDirection(ref.building.record, leafDirection(data, world.leafValue(ref.key, data), data.normal, out), out))
    }
    const lift = grasp.y - this.feet.y
    const rise = action.pickup!.data.attached ? 0.9 : lift > 1.45 ? 0.35 : 0.75
    return out.copy(action.toward).multiplyScalar(1 - rise * 0.6).addScaledVector(UP, rise).normalize()
  }

  private orient(action: Action, grasp: THREE.Vector3, toward: THREE.Vector3) {
    const medial = this.v[4].copy(this.left).multiplyScalar(-action.arm)
    const outward = this.v[5].copy(this.left).multiplyScalar(action.arm)
    const high = grasp.y - this.feet.y > 1.45
    this.wantPole.copy(UP).multiplyScalar(high ? -0.3 : -0.75).addScaledVector(outward, high ? 0.95 : 0.6).addScaledVector(this.forward, -0.15).normalize()
    if (action.leaf?.data.kind === 'door') {
      this.wantFinger.copy(toward).negate().addScaledVector(UP, -0.1).normalize()
      this.wantPalm.copy(medial)
    } else if (action.leaf) {
      this.wantFinger.copy(toward).negate().addScaledVector(UP, -0.3).normalize()
      this.wantPalm.copy(UP).negate().addScaledVector(toward, -0.25).normalize()
    } else {
      const away = this.v[6].copy(action.toward).negate()
      this.wantFinger.copy(away).addScaledVector(UP, -0.45).normalize()
      this.wantPalm.copy(UP).negate().addScaledVector(away, 0.1).normalize()
    }
  }

  private grab(world: InteractionWorld, action: Action) {
    const ref = action.pickup!, data = ref.data, record = ref.building.record
    const item = buildingMatrix(record, this.m[0])
    if (data.attached) {
      const leaf = ref.building.interaction.interactables[data.interactable]?.leaves[data.leaf]
      if (leaf && leafMatrix(leaf, world.leafValue(leafKey(ref.building.seed, data.interactable, data.leaf), leaf), this.m[1])) item.multiply(this.m[1])
    }
    const inverse = this.palmMatrix(action.arm, this.m[2]).invert()
    action.attach.multiplyMatrices(inverse, item)
    const center = world.pickupPosition(ref, action.center)
    center.y += data.size[1] * 0.5
    center.applyMatrix4(inverse)
    const radius = Math.max(data.size[0], data.size[1], data.size[2]) * 0.5
    const distance = center.length()
    action.snug.copy(center)
    if (distance > radius + 0.02) action.snug.multiplyScalar((radius + 0.02) / distance)
    action.offset.set(0, 0, 0)
    action.scale = 1
    world.hold(ref)
    this.holding = action
  }

  private palmMatrix(arm: number, out: THREE.Matrix4) {
    const hands = survivorHands.current
    if (hands) {
      hands.handPose(arm, this.v[11], this.q)
      return out.compose(this.v[11], this.q, ONE)
    }
    this.q.setFromAxisAngle(UP, runtime.bodyFacing)
    return out.compose(this.hand, this.q, ONE)
  }

  private palmAt(arm: number, out: THREE.Vector3) {
    const hands = survivorHands.current
    if (hands) return hands.palmPoint(arm, out)
    return out.copy(this.feet).addScaledVector(UP, 0.92).addScaledVector(this.left, arm * 0.24)
  }

  private shoulderAt(arm: number, out: THREE.Vector3) {
    const hands = survivorHands.current
    if (hands) return hands.shoulderPoint(arm, out)
    return out.copy(this.feet).addScaledVector(UP, 1.42).addScaledVector(this.left, arm * 0.18)
  }

  private output(dt: number) {
    const pose = interactPose, want = this.want
    pose.weight = damp(pose.weight, want.weight, want.weight > pose.weight ? 5 : 4, dt)
    if (!this.action && pose.weight < 0.002) pose.weight = 0
    pose.reach = this.reachLevel
    pose.hand = damp(pose.hand, want.hand, 10, dt)
    pose.grip = damp(pose.grip, want.grip, 14, dt)
    pose.lookWeight = damp(pose.lookWeight, want.look, 5, dt)
    pose.lean = damp(pose.lean, want.lean, 6, dt)
    pose.bend = damp(pose.bend, want.bend, 5, dt)
    pose.twist = damp(pose.twist, want.twist, 5, dt)
    pose.shrug = damp(pose.shrug, want.shrug, 6, dt)
    pose.crouch = damp(pose.crouch, want.crouch, 4, dt)
    if (this.action) pose.arm = this.action.arm
    if (this.handReady) {
      const phase = this.action?.phase
      if (phase === 'grip' || phase === 'drive') {
        this.handVelocity.subVectors(this.goal, this.hand).divideScalar(Math.max(dt, 1e-4))
        this.hand.copy(this.goal)
      } else spring(this.hand, this.handVelocity, this.goal, 32, dt)
      pose.target.copy(this.hand)
    } else pose.target.copy(this.wantLook)
    turnToward(pose.palm, this.wantPalm, 9, dt)
    turnToward(pose.finger, this.wantFinger, 9, dt)
    turnToward(pose.pole, this.wantPole, 7, dt)
    const follow = 1 - Math.exp(-9 * dt)
    pose.look.lerp(this.wantLook, follow)
  }

  private fade(dt: number) {
    for (const [key, glow] of this.glows) {
      glow.level = damp(glow.level, glow.goal, glow.goal > glow.level ? 7 : 4.5, dt)
      if (glow.goal === 0 && glow.level < 0.004) this.glows.delete(key)
    }
    for (const [key, spark] of this.sparks) {
      spark.level = damp(spark.level, spark.goal, spark.goal > spark.level ? 5 : 6, dt)
      spark.lit = damp(spark.lit, spark.focus, 8, dt)
      if (spark.goal === 0 && spark.level < 0.004) this.sparks.delete(key)
    }
  }

  private frame(dt: number) {
    const steer = runtime.interaction
    const engaged = this.action && this.action.phase !== 'recover' ? 1 : 0
    steer.focus = damp(steer.focus, engaged, engaged ? 2.4 : 1.8, dt)
    if (steer.focus < 0.002) steer.focus = 0
    const point = this.action ? this.action.aim : this.focusPoint
    if (steer.focus === 0) steer.focusPoint.copy(point)
    else steer.focusPoint.lerp(point, 1 - Math.exp(-4 * dt))
  }
}
