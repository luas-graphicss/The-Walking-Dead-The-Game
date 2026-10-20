import { readFileSync, writeFileSync } from 'node:fs'
import * as THREE from 'three'
import { MotionDatabase, type FootLevel } from '../lib/game/character/motion-database'
import { BONE } from '../lib/game/character/motion-format'
import { MotionMatcher, fromScaledAngleAxis, scaledAngleAxis } from '../lib/game/character/motion-matching'
import { MOTION_BONES, HIPS_NODE } from '../lib/game/character/motion-format'

const OUT = 'lib/game/character/motion-mask.generated.json'
const file = readFileSync('public/models/survivor/locomotion.mmdb')

const CLIPS: string[] = JSON.parse(file.subarray(12, 12 + file.readUInt32LE(4)).toString()).takes
const EXCLUDED_TAKES = new Set<string>()

const INTRO_FRAMES = 0

const MARGIN = 8

const MIN_SEGMENT = 30

const glb = readFileSync('public/models/survivor/survivor.glb')
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString())
const objects: THREE.Object3D[] = gltf.nodes.map((n: { name: string; translation?: number[]; rotation?: number[] }) => {
  const o = new THREE.Object3D()
  o.name = n.name
  if (n.translation) o.position.fromArray(n.translation)
  if (n.rotation) o.quaternion.fromArray(n.rotation)
  return o
})
gltf.nodes.forEach((n: { children?: number[] }, i: number) => n.children?.forEach((c) => objects[i].add(objects[c])))
const scene = new THREE.Group()
scene.add(objects[gltf.scenes[0].nodes[0]])
const byName = new Map(objects.map((o) => [o.name, o]))
const bones = MOTION_BONES.map(([, name]) => byName.get(name)!)
const hipsNode = byName.get(HIPS_NODE)!
const rootInverse = hipsNode.parent!.quaternion.clone().invert()
const slot = new Map(bones.map((b, i) => [b, i]))
const UP = new THREE.Vector3(0, 1, 0)
const feet = [bones[BONE.leftFoot], bones[BONE.rightFoot]]
const toes = [bones[BONE.leftToe], bones[BONE.rightToe]]

scene.updateMatrixWorld(true)
const bindFootInverse = feet.map((foot) => foot.getWorldQuaternion(new THREE.Quaternion()).invert())
const bindToe = toes[0].getWorldPosition(new THREE.Vector3()).y

MotionDatabase.fromBuffer(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), { unmasked: true }).then(buildMask)

function buildMask(db: MotionDatabase) {
const matcher = new MotionMatcher(db, {
  bindLocal: bones.map((b) => b.quaternion.clone()),
  parent: bones.map((b) => (b.parent && slot.has(b.parent) ? slot.get(b.parent)! : -1)),
  hipsGlobal: hipsNode.parent!.quaternion.clone().multiply(hipsNode.quaternion),
})
const pose = { rotations: bones.map(() => new THREE.Quaternion()), hips: new THREE.Vector3(), root: new THREE.Vector3(), contacts: 0 }
const [spine, neck, pelvis, leftHand, rightHand] = Array.from({ length: 5 }, () => new THREE.Vector3())

const G = 9.81
const speedOf = (frame: number) => Math.hypot(db.root[frame * 3], db.root[frame * 3 + 1])

function place(frame: number) {
  matcher.sample(frame, pose)
  pose.rotations.forEach((q, b) => bones[b].quaternion.copy(q))
  hipsNode.position.copy(pose.hips).applyQuaternion(rootInverse)
  scene.updateMatrixWorld(true)
}

function reject(frame: number, start: number, stop: number) {
  place(frame)
  bones[BONE.spine].getWorldPosition(spine); bones[BONE.neck].getWorldPosition(neck); bones[BONE.pelvis].getWorldPosition(pelvis)
  bones[9].getWorldPosition(leftHand); bones[13].getWorldPosition(rightHand)
  const height = neck.y - spine.y
  const pitch = THREE.MathUtils.radToDeg(Math.atan2(neck.z - spine.z, height))
  const roll = THREE.MathUtils.radToDeg(Math.atan2(neck.x - spine.x, height))

  const speed = Math.hypot(pose.root.x, pose.root.z)
  const turn = Math.abs(pose.root.y)
  const a = Math.max(start, frame - 4), b = Math.min(stop - 1, frame + 4)
  const acceleration = (speedOf(b) - speedOf(a)) * 30 / Math.max(1, b - a)
  const spread = Math.max(Math.abs(leftHand.x - spine.x), Math.abs(rightHand.x - spine.x))
  const handUp = Math.max(leftHand.y, rightHand.y) - neck.y

  const leanForward = THREE.MathUtils.radToDeg(Math.atan(Math.max(0, acceleration) / G))
  const bank = THREE.MathUtils.radToDeg(Math.atan((speed * turn) / G))

  const gaitLean = 2.5 * Math.min(speed, 2) + 3.5 * THREE.MathUtils.clamp(speed - 2, 0, 4)
  if (pitch > 18 + gaitLean + 0.8 * leanForward || pitch < -4) return 'pitch'
  if (Math.abs(roll) > 9 + bank * 1.1) return 'roll'
  if (pelvis.y < 0.74 - 0.025 * Math.min(speed, 4)) return 'low'
  if (spread > 0.48 || handUp > -0.04) return 'arms'

  if (speed > 0.6 && turn < 1.5 && (Math.abs(pose.root.x) > 0.64 * speed || pose.root.z < -0.3 * speed)) return 'strafe'
  if (turn > 9) return 'spin'

  bones[BONE.leftFoot].getWorldPosition(leftHand); bones[BONE.rightFoot].getWorldPosition(rightHand)
  if (leftHand.x - rightHand.x < 0.01 - 0.035 * THREE.MathUtils.clamp((speed - 1.8) / 1.7, 0, 1)) return 'cross'
  return null
}

function* standing() {
  for (let take = 0; take < CLIPS.length; take++) {
    if (EXCLUDED_TAKES.has(CLIPS[take])) continue
    const [start, stop] = db.ranges[take * 2]
    for (let f = start + INTRO_FRAMES; f < stop; f++) {
      if (db.contacts[f] !== 3 || speedOf(f) > 0.15 || Math.abs(db.root[f * 3 + 2]) > 0.3) continue
      if (!reject(f, start, stop)) yield f
    }
  }
}

function measureFootLevel(): { level: FootLevel; tilt: number[]; count: number } {
  const sums = [new THREE.Vector3(), new THREE.Vector3()], tilts = [0, 0]
  const world = new THREE.Quaternion(), level = new THREE.Quaternion(), fix = new THREE.Quaternion(), up = new THREE.Vector3(), axis = new THREE.Vector3()
  let count = 0
  for (const _ of standing()) {
    feet.forEach((foot, side) => {
      foot.getWorldQuaternion(world)
      up.copy(UP).applyQuaternion(level.copy(world).multiply(bindFootInverse[side]))
      tilts[side] += THREE.MathUtils.radToDeg(up.angleTo(UP))
      fix.setFromUnitVectors(up, UP)
      sums[side].add(scaledAngleAxis(level.copy(world).invert().multiply(fix).multiply(world), axis))
    })
    count++
  }
  const [left, right] = sums.map((sum) => fromScaledAngleAxis(sum.divideScalar(Math.max(count, 1)), new THREE.Quaternion()).toArray().map((v) => +v.toFixed(6)))
  return { level: { left, right }, tilt: tilts.map((t) => t / Math.max(count, 1)), count }
}

function measureLift() {
  const p = new THREE.Vector3()
  return CLIPS.map((_, take) => {
    const [start, stop] = db.ranges[take * 2], planted: number[] = []
    for (let f = start + INTRO_FRAMES; f < stop; f++) {
      if (!db.contacts[f]) continue
      place(f)
      toes.forEach((toe, side) => { if (db.contacts[f] & (side ? 2 : 1)) planted.push(toe.getWorldPosition(p).y) })
    }
    planted.sort((a, b) => a - b)
    return planted.length ? +(bindToe - planted[Math.floor(planted.length / 2)]).toFixed(4) : 0
  })
}

const IDENTITY = [0, 0, 0, 1]
const before = measureFootLevel()
db.levelFeet(before.level, CLIPS.map(() => 0))
const lift = measureLift()
db.levelFeet({ left: IDENTITY, right: IDENTITY }, lift)
const after = measureFootLevel()
console.log(`foot tilt over ${before.count} standing frames: ${before.tilt.map((t) => t.toFixed(1)).join('° / ')}° → ${after.tilt.map((t) => t.toFixed(1)).join('° / ')}°; hip lift ${lift.map((v) => (v * 100).toFixed(1)).join(', ')} cm`)

const segments: [number, number][] = []
let kept = 0
const coverage = [0, 0, 0, 0, 0]
const SPEED_BINS = [0.3, 1, 2, 3.5, Infinity]

const PERSISTENCE = 0.4
const WINDOW = 6
for (let take = 0; take < CLIPS.length; take++) {
  const [start, stop] = db.ranges[take * 2]
  const length = stop - start
  const failed = new Uint8Array(length)
  const bad = new Uint8Array(length)
  const reasons: Record<string, number> = {}
  if (!EXCLUDED_TAKES.has(CLIPS[take])) {
    for (let f = start; f < stop; f++) {
      const reason = f - start < INTRO_FRAMES ? 'intro' : reject(f, start, stop)
      if (!reason) continue
      reasons[reason] = (reasons[reason] ?? 0) + 1
      failed[f - start] = reason === 'intro' ? 2 : 1
    }
    for (let i = 0; i < length; i++) {
      let count = 0, total = 0
      for (let k = Math.max(0, i - WINDOW); k <= Math.min(length - 1, i + WINDOW); k++) { total++; if (failed[k]) count++ }
      if (failed[i] === 2 || (failed[i] && count / total >= PERSISTENCE)) {
        for (let k = Math.max(0, i - MARGIN); k <= Math.min(length - 1, i + MARGIN); k++) bad[k] = 1
      }
    }
  } else bad.fill(1)
  for (let i = 0; i < length; i++) if (!bad[i]) coverage[SPEED_BINS.findIndex((limit) => speedOf(start + i) < limit)]++
  let takeKept = 0
  for (let i = 0; i < bad.length;) {
    if (bad[i]) { i++; continue }
    let j = i
    while (j < bad.length && !bad[j]) j++
    if (j - i >= MIN_SEGMENT) { segments.push([start + i, start + j]); takeKept += j - i }
    i = j
  }
  kept += takeKept
  console.log(`${CLIPS[take].padEnd(18)} kept ${(takeKept / (stop - start) * 100).toFixed(1).padStart(5)}%  ${JSON.stringify(reasons)}`)
}

console.log(`kept frames by speed (m/s) <0.3: ${coverage[0]}, <1: ${coverage[1]}, <2: ${coverage[2]}, <3.5: ${coverage[3]}, faster: ${coverage[4]}`)
{
  const keptFrame = new Uint8Array(db.frames)
  for (const [start, end] of segments) keptFrame.fill(1, start, end)
  const bins = [1, 2, 3, 4.5, 6.5, Infinity], all = bins.map(() => 0), kept = bins.map(() => 0)
  for (let f = 0; f < db.frames; f++) {
    const turn = Math.abs(db.root[f * 3 + 2])
    if (speedOf(f) < 0.3 && turn < 1) continue
    const bin = bins.findIndex((limit) => turn < limit)
    all[bin]++
    kept[bin] += keptFrame[f]
  }
  console.log(`kept frames by turn rate (rad/s) <1, <2, <3, <4.5, <6.5, faster: ${kept.map((k, i) => `${k}/${all[i]}`).join(', ')}`)
}
writeFileSync(OUT, JSON.stringify({ frames: db.frames, segments, feet: after.count ? before.level : undefined, lift }) + '\n')
console.log(`${segments.length} segments, ${kept} of ${db.frames} frames (${(kept / db.frames * 100).toFixed(1)}%, ${(kept / 30 / 60).toFixed(1)} min) → ${OUT}`)
}
