import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { gzipSync } from 'fflate'
import * as THREE from 'three'
import { MOTION_BONES, MOTION_CHANNELS, MOTION_FEATURE_SCALE, MOTION_FPS, MOTION_MAGIC, TRAJECTORY_FRAMES, undelta } from '../lib/game/character/motion-format'

const [bandaiDir, styleDir] = process.argv.slice(2)
if (!bandaiDir || !styleDir) throw new Error('usage: build-motion-database.ts <Bandai-Namco-Research-Motiondataset dir> <100STYLE dir>')
const OUT = 'public/models/survivor'
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const Q = () => new THREE.Quaternion()
const UP = V(0, 1, 0)
const FORWARD = V(0, 0, 1)
const CANONICAL = MOTION_BONES.map(([name]) => name as string)
const slot = (name: string) => CANONICAL.indexOf(name)
const yawQuat = (yaw: number) => Q().setFromAxisAngle(UP, yaw)
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

type GltfNode = { name: string; children?: number[]; translation?: number[]; rotation?: number[] }
const glb = readFileSync(join(OUT, 'survivor.glb'))
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString())
const nodes: GltfNode[] = gltf.nodes
const parentOf = new Map<number, number>()
nodes.forEach((node, i) => node.children?.forEach((child) => parentOf.set(child, i)))
const nodeIndex = (name: string) => {
  const index = nodes.findIndex((node) => node.name === name)
  if (index < 0) throw new Error(`missing node ${name}`)
  return index
}
const rootIndex = gltf.scenes[gltf.scene ?? 0].nodes[0] as number

const bind = (() => {
  const rot: THREE.Quaternion[] = [], pos: THREE.Vector3[] = []
  const visit = (i: number) => {
    if (rot[i]) return
    const node = nodes[i], local = Q().fromArray(node.rotation ?? [0, 0, 0, 1]), offset = V().fromArray(node.translation ?? [0, 0, 0])
    const parent = parentOf.get(i)
    if (parent === undefined) { rot[i] = local; pos[i] = offset; return }
    visit(parent)
    rot[i] = rot[parent].clone().multiply(local)
    pos[i] = pos[parent].clone().add(offset.applyQuaternion(rot[parent]))
  }
  nodes.forEach((_, i) => visit(i))
  return { rot, pos }
})()
{
  const toes = bind.pos[nodeIndex('Bip01 L Toe0')].clone().add(bind.pos[nodeIndex('Bip01 R Toe0')])
  const feet = bind.pos[nodeIndex('Bip01 L Foot')].clone().add(bind.pos[nodeIndex('Bip01 R Foot')])
  const facing = toes.sub(feet).setY(0).normalize()
  if (facing.z < 0.95) throw new Error(`survivor.glb does not face +Z (${facing.toArray().map((v) => v.toFixed(2))})`)
}
const targetBones = MOTION_BONES.map(([, name]) => nodeIndex(name))
const bindLocal = targetBones.map((i) => Q().fromArray(nodes[i].rotation ?? [0, 0, 0, 1]))
const hipsNode = nodeIndex('Bip01')
if (parentOf.get(targetBones[0]) !== hipsNode) throw new Error('expected Bip01 → Bip01 Pelvis')
const legLength = (pos: THREE.Vector3[], a: number, b: number, c: number) => pos[a].distanceTo(pos[b]) + pos[b].distanceTo(pos[c])
const targetLeg = legLength(bind.pos, nodeIndex('Bip01 L Thigh'), nodeIndex('Bip01 L Calf'), nodeIndex('Bip01 L Foot'))

type JointMap = Record<string, string | readonly [string, string, number]>
const BANDAI: JointMap = {
  Hips: 'Hips', Spine: 'Spine', Spine1: ['Spine', 'Chest', 0.5], Spine2: 'Chest', Neck: 'Neck', Head: 'Head',
  LeftShoulder: 'Shoulder_L', LeftArm: 'UpperArm_L', LeftForeArm: 'LowerArm_L', LeftHand: 'Hand_L',
  RightShoulder: 'Shoulder_R', RightArm: 'UpperArm_R', RightForeArm: 'LowerArm_R', RightHand: 'Hand_R',
  LeftUpLeg: 'UpperLeg_L', LeftLeg: 'LowerLeg_L', LeftFoot: 'Foot_L', LeftToe: 'Toes_L',
  RightUpLeg: 'UpperLeg_R', RightLeg: 'LowerLeg_R', RightFoot: 'Foot_R', RightToe: 'Toes_R',
}
const STYLE100: JointMap = {
  Hips: 'Hips', Spine: 'Chest', Spine1: ['Chest2', 'Chest3', 0.5], Spine2: 'Chest4', Neck: 'Neck', Head: 'Head',
  LeftShoulder: 'LeftCollar', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftElbow', LeftHand: 'LeftWrist',
  RightShoulder: 'RightCollar', RightArm: 'RightShoulder', RightForeArm: 'RightElbow', RightHand: 'RightWrist',
  LeftUpLeg: 'LeftHip', LeftLeg: 'LeftKnee', LeftFoot: 'LeftAnkle', LeftToe: 'LeftToe',
  RightUpLeg: 'RightHip', RightLeg: 'RightKnee', RightFoot: 'RightAnkle', RightToe: 'RightToe',
}

function findFiles(dir: string, test: (name: string) => boolean, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) findFiles(path, test, out)
    else if (test(entry)) out.push(path)
  }
  return out.sort((a, b) => basename(a).localeCompare(basename(b)))
}

const AXES = { X: V(1, 0, 0), Y: V(0, 1, 0), Z: V(0, 0, 1) } as const
type Bvh = { names: string[]; frames: number; frameTime: number; rot: THREE.Quaternion[][]; pos: THREE.Vector3[][] }

function readBvh(path: string, from = 0, to = Infinity, step = 1): Bvh {
  const [head, motion] = readFileSync(path, 'utf8').split('MOTION')
  const names: string[] = [], parents: number[] = [], offsets: THREE.Vector3[] = [], channels: string[][] = []
  const stack: number[] = []
  let last = -1
  for (const line of head.split('\n').map((l) => l.trim())) {
    if (line.startsWith('ROOT') || line.startsWith('JOINT')) { names.push(line.split(/\s+/)[1]); parents.push(stack.length ? stack[stack.length - 1] : -1); last = names.length - 1; channels[last] = [] }
    else if (line.startsWith('End Site')) last = -2
    else if (line === '{') stack.push(last)
    else if (line === '}') stack.pop()
    else if (line.startsWith('OFFSET') && last >= 0) offsets[last] = V(...line.split(/\s+/).slice(1, 4).map((v) => Number(v) / 100) as [number, number, number])
    else if (line.startsWith('CHANNELS') && last >= 0) channels[last] = line.split(/\s+/).slice(2)
  }
  const lines = motion.trim().split('\n')
  const total = Number(lines[0].split(':')[1]), frameTime = Number(lines[1].split(':')[1])
  const rot: THREE.Quaternion[][] = [], pos: THREE.Vector3[][] = []
  const turn = Q()
  for (let f = from; f < Math.min(to, total); f += step) {
    const row = lines[f + 2].trim().split(/\s+/).map(Number)
    const r: THREE.Quaternion[] = [], p: THREE.Vector3[] = []
    let k = 0
    for (let j = 0; j < names.length; j++) {
      const local = Q(), offset = offsets[j].clone()
      for (const channel of channels[j]) {
        const value = row[k++]
        if (channel.endsWith('position')) offset.setComponent('XYZ'.indexOf(channel[0]), value / 100)
        else local.multiply(turn.setFromAxisAngle(AXES[channel[0] as 'X' | 'Y' | 'Z'], (value * Math.PI) / 180))
      }
      const parent = parents[j]
      if (parent < 0) { r.push(local); p.push(offset); continue }
      r.push(r[parent].clone().multiply(local))
      p.push(p[parent].clone().add(offset.applyQuaternion(r[parent])))
    }
    rot.push(r); pos.push(p)
  }
  return { names, frames: rot.length, frameTime: frameTime * step, rot, pos }
}

type Clip = { name: string; frames: number; rot: THREE.Quaternion[][]; pos: THREE.Vector3[][] }
function canonical(bvh: Bvh, joints: JointMap, name: string): Clip {
  const index = (joint: string) => {
    const i = bvh.names.indexOf(joint)
    if (i < 0) throw new Error(`${name}: no joint ${joint}`)
    return i
  }
  const map = CANONICAL.map((c) => {
    const joint = joints[c]
    return typeof joint === 'string' ? [index(joint), index(joint), 0] as const : [index(joint[0]), index(joint[1]), joint[2]] as const
  })
  const rot = bvh.rot.map((r) => map.map(([a, b, t]) => (t ? r[a].clone().slerp(r[b], t) : r[a].clone())))
  const pos = bvh.pos.map((p) => map.map(([a, b, t]) => (t ? p[a].clone().lerp(p[b], t) : p[a].clone())))
  return { name, frames: bvh.frames, rot, pos }
}

function gaussian(values: number[], sigma: number) {
  const radius = Math.ceil(sigma * 3), weights = Array.from({ length: radius * 2 + 1 }, (_, k) => Math.exp(-((k - radius) ** 2) / (2 * sigma * sigma)))
  return values.map((_, i) => {
    let sum = 0, total = 0
    for (let k = -radius; k <= radius; k++) {
      const j = Math.min(values.length - 1, Math.max(0, i + k))
      sum += values[j] * weights[k + radius]; total += weights[k + radius]
    }
    return sum / total
  })
}

const HORIZON = TRAJECTORY_FRAMES[TRAJECTORY_FRAMES.length - 1]

function simulationRoot(clip: Clip) {
  const chest = slot('Spine2'), left = slot('LeftUpLeg'), right = slot('RightUpLeg')
  const x = gaussian(clip.pos.map((p) => p[chest].x), 2.5), z = gaussian(clip.pos.map((p) => p[chest].z), 2.5)
  const fx = gaussian(clip.pos.map((p) => -(p[left].z - p[right].z)), 5), fz = gaussian(clip.pos.map((p) => p[left].x - p[right].x), 5)
  const yaw = fx.map((v, i) => Math.atan2(v, fz[i]))
  const n = clip.frames, span = Math.min(10, n - 1)
  const vx = (x[n - 1] - x[n - 1 - span]) / span, vz = (z[n - 1] - z[n - 1 - span]) / span, turn = wrap(yaw[n - 1] - yaw[n - 1 - span]) / span
  for (let i = 1; i <= HORIZON; i++) { x.push(x[n - 1] + vx * i); z.push(z[n - 1] + vz * i); yaw.push(wrap(yaw[n - 1] + turn * i)) }
  return { x, z, yaw }
}
type Root = ReturnType<typeof simulationRoot>

function contacts(clip: Clip, scale: number) {
  const toes = [slot('LeftToe'), slot('RightToe')]
  const heights = clip.pos.flatMap((p) => toes.map((t) => p[t].y)).sort((a, b) => a - b)
  const floor = heights[Math.floor(heights.length * 0.05)]
  return toes.map((toe) => {
    const raw = clip.pos.map((p, f) => {
      const a = clip.pos[Math.max(0, f - 1)][toe], b = clip.pos[Math.min(clip.frames - 1, f + 1)][toe]
      const span = Math.min(clip.frames - 1, f + 1) - Math.max(0, f - 1)
      return a.distanceTo(b) * scale * MOTION_FPS / span < 0.2 && p[toe].y < floor + 0.05
    })
    return raw.map((_, f) => {
      let on = 0
      for (let k = -2; k <= 2; k++) on += raw[Math.min(clip.frames - 1, Math.max(0, f + k))] ? 1 : 0
      return on >= 3
    })
  })
}

function rootLocal(clip: Clip, root: Root, f: number) {
  const inverse = yawQuat(root.yaw[f]).invert(), origin = V(root.x[f], 0, root.z[f])
  return {
    rot: clip.rot[f].map((r) => inverse.clone().multiply(r)),
    pos: clip.pos[f].map((p) => p.clone().sub(origin).applyQuaternion(inverse)),
  }
}

function restFrame(clip: Clip) {
  const root = simulationRoot(clip), [left, right] = contacts(clip, 1)
  let best = -1, bestScore = Infinity
  for (let f = 2; f < clip.frames - 2; f++) {
    if (!left[f] || !right[f]) continue
    const speed = Math.hypot(root.x[f + 1] - root.x[f - 1], root.z[f + 1] - root.z[f - 1]) * MOTION_FPS / 2
    let motion = 0
    for (let j = 0; j < CANONICAL.length; j++) motion += clip.pos[f + 1][j].distanceTo(clip.pos[f - 1][j])
    if (speed + motion < bestScore) { bestScore = speed + motion; best = f }
  }
  if (best < 0) throw new Error(`${clip.name}: no standing frame`)
  return best
}

const frameOf = (primary: THREE.Vector3, hint: THREE.Vector3) => {
  const x = primary.clone().normalize()
  const y = hint.clone().sub(x.clone().multiplyScalar(hint.dot(x))).normalize()
  return Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, V().crossVectors(x, y)))
}

const AIM: Record<string, [string, string] | null> = {
  Hips: ['Spine', 'Bip01 Spine'], Spine: ['Spine1', 'Bip01 Spine1'], Spine1: ['Spine2', 'Bip01 Spine2'], Spine2: ['Neck', 'Bip01 Neck'],
  Neck: ['Head', 'Bip01 Head'], Head: null,
  LeftShoulder: ['LeftArm', 'Bip01 L UpperArm'], LeftArm: ['LeftForeArm', 'Bip01 L Forearm'], LeftForeArm: ['LeftHand', 'Bip01 L Hand'], LeftHand: null,
  RightShoulder: ['RightArm', 'Bip01 R UpperArm'], RightArm: ['RightForeArm', 'Bip01 R Forearm'], RightForeArm: ['RightHand', 'Bip01 R Hand'], RightHand: null,
  LeftUpLeg: ['LeftLeg', 'Bip01 L Calf'], LeftLeg: ['LeftFoot', 'Bip01 L Foot'], LeftFoot: null, LeftToe: null,
  RightUpLeg: ['RightLeg', 'Bip01 R Calf'], RightLeg: ['RightFoot', 'Bip01 R Foot'], RightFoot: null, RightToe: null,
}

function calibrate(reference: Clip) {
  const rest = rootLocal(reference, simulationRoot(reference), restFrame(reference))
  const swings: THREE.Quaternion[] = []
  return MOTION_BONES.map(([source, target], b) => {
    const aim = AIM[source]
    let swing: THREE.Quaternion
    if (/Foot|Toe|Neck|Head/.test(source)) swing = Q()
    else if (aim) {
      const t = nodeIndex(target), tc = nodeIndex(aim[1]), sc = slot(aim[0])
      swing = frameOf(bind.pos[tc].clone().sub(bind.pos[t]), FORWARD).multiply(frameOf(rest.pos[sc].clone().sub(rest.pos[b]), FORWARD).invert())
    } else swing = swings[b - 1].clone()
    swings.push(swing)
    return swing.clone().multiply(rest.rot[b]).invert().multiply(bind.rot[targetBones[b]])
  })
}

const bandaiFiles = findFiles(bandaiDir, (name) => /^dataset-2_(walk|walk-turn-left|walk-turn-right|run)_normal_\d+\.bvh$/.test(name))
const bandaiReference = findFiles(bandaiDir, (name) => name === 'dataset-2_raise-up-right-hand_normal_001.bvh')[0]
const styleFile = (kind: string) => {
  const path = findFiles(styleDir, (name) => name === `Neutral_${kind}.bvh`)[0]
  if (!path) throw new Error(`100STYLE: Neutral_${kind}.bvh not found`)
  return path
}
const cutsPath = findFiles(styleDir, (name) => name === 'Frame_Cuts.csv')[0]
if (!bandaiFiles.length || !bandaiReference) throw new Error('Bandai Namco: normal-style takes or dataset-2_raise-up-right-hand_normal_001.bvh not found')
if (!cutsPath) throw new Error('100STYLE: Frame_Cuts.csv not found')
const cutRow = readFileSync(cutsPath, 'utf8').split('\n').map((line) => line.trim().split(','))
const cutHeader = cutRow[0], neutral = cutRow.find((row) => row[0] === 'Neutral')!
const cut = (kind: string) => [Number(neutral[cutHeader.indexOf(`${kind}_START`)]), Number(neutral[cutHeader.indexOf(`${kind}_STOP`)])] as const

const readStyle = (kind: string) => {
  const [from, to] = cut(kind)
  const bvh = readBvh(styleFile(kind), from, to, 2)
  if (Math.abs(bvh.frameTime - 1 / MOTION_FPS) > 1e-3) throw new Error(`100STYLE ${kind}: unexpected frame time`)
  return canonical(bvh, STYLE100, `100style_neutral_${kind.toLowerCase()}`)
}
const readBandai = (path: string) => canonical(readBvh(path), BANDAI, basename(path, '.bvh'))

const sources = [
  { label: 'Bandai Namco', offsets: calibrate(readBandai(bandaiReference)), clips: bandaiFiles.map(readBandai).filter((clip) => clip.frames >= 45) },
  { label: '100STYLE', offsets: calibrate(readStyle('ID')), clips: ['ID', 'TR1', 'FW'].map(readStyle) },
]

const featureChains = ['Bip01 L Foot', 'Bip01 R Foot', 'Bip01 L Toe0', 'Bip01 R Toe0'].map((name) => {
  const chain: number[] = []
  for (let i: number | undefined = nodeIndex(name); i !== undefined && i !== hipsNode; i = parentOf.get(i)) chain.unshift(i)
  return chain
})
const hipsGlobal = Q().fromArray(nodes[rootIndex].rotation ?? [0, 0, 0, 1]).multiply(Q().fromArray(nodes[hipsNode].rotation ?? [0, 0, 0, 1]))
const bindToe = bind.pos[nodeIndex('Bip01 L Toe0')].y

const streams: number[][] = Array.from({ length: MOTION_CHANNELS.total }, () => [])
const ranges: [number, number][] = []
const takes: string[] = []
const speeds: number[] = []
const speedsByKind = new Map<string, number[]>()
let total = 0
for (const { label, offsets, clips } of sources) for (const clip of clips) {
  const sourceLeg = legLength(clip.pos[0], slot('LeftUpLeg'), slot('LeftLeg'), slot('LeftFoot'))
  const k = targetLeg / sourceLeg
  const root = simulationRoot(clip)
  const [left, right] = contacts(clip, k)
  const frames = clip.frames
  const hips: THREE.Vector3[] = [], locals: THREE.Quaternion[][] = [], feet: THREE.Vector3[][] = []
  for (let f = 0; f < frames; f++) {
    const pose = rootLocal(clip, root, f)
    const target = offsets.map((offset, b) => pose.rot[b].clone().multiply(offset))
    const hip = pose.pos[slot('Hips')].clone().multiplyScalar(k)

    const global = new Map<number, THREE.Quaternion>([[hipsNode, hipsGlobal]])
    const position = new Map<number, THREE.Vector3>([[hipsNode, hip]])
    const local = targetBones.map((node, b) => {
      const parentGlobal = global.get(parentOf.get(node)!)
      if (!parentGlobal) throw new Error(`parent of ${nodes[node].name} not mapped`)
      global.set(node, target[b])
      return parentGlobal.clone().invert().multiply(target[b])
    })
    for (const chain of featureChains) for (const node of chain) {
      if (position.has(node)) continue
      const parent = parentOf.get(node)!
      const parentGlobal = global.get(parent)!
      if (!global.has(node)) global.set(node, parentGlobal.clone().multiply(Q().fromArray(nodes[node].rotation ?? [0, 0, 0, 1])))
      position.set(node, position.get(parent)!.clone().add(V().fromArray(nodes[node].translation ?? [0, 0, 0]).applyQuaternion(parentGlobal)))
    }
    hips.push(hip); locals.push(local)
    feet.push(featureChains.map((chain) => position.get(chain[chain.length - 1])!))
  }

  const planted: number[] = []
  for (let f = 0; f < frames; f++) { if (left[f]) planted.push(feet[f][2].y); if (right[f]) planted.push(feet[f][3].y) }
  planted.sort((a, b) => a - b)
  const lift = planted.length ? bindToe - planted[Math.floor(planted.length / 2)] : 0

  const world = (f: number, p: THREE.Vector3) => p.clone().applyQuaternion(yawQuat(root.yaw[f])).add(V(root.x[f] * k, 0, root.z[f] * k))
  const velocity = (f: number, at: (f: number) => THREE.Vector3) => {
    const a = Math.max(0, f - 1), b = Math.min(frames - 1, f + 1)
    return world(b, at(b)).sub(world(a, at(a))).multiplyScalar(MOTION_FPS / (b - a)).applyQuaternion(yawQuat(root.yaw[f]).invert())
  }
  const kind = clip.name.replace(/^dataset-\d_/, '').replace(/_normal_\d+$/, '')
  const kindSpeeds = speedsByKind.get(kind) ?? []
  speedsByKind.set(kind, kindSpeeds)
  const start = total
  for (let f = 0; f < frames; f++) {
    const write = (channel: number, value: number) => streams[channel].push(value)
    locals[f].forEach((q, b) => {
      const rel = bindLocal[b].clone().invert().multiply(q)
      if (rel.w < 0) rel.set(-rel.x, -rel.y, -rel.z, -rel.w)
      write(MOTION_CHANNELS.rotations + b * 4, rel.x); write(MOTION_CHANNELS.rotations + b * 4 + 1, rel.y)
      write(MOTION_CHANNELS.rotations + b * 4 + 2, rel.z); write(MOTION_CHANNELS.rotations + b * 4 + 3, rel.w)
    })
    write(MOTION_CHANNELS.hips, hips[f].x); write(MOTION_CHANNELS.hips + 1, hips[f].y + lift); write(MOTION_CHANNELS.hips + 2, hips[f].z)
    const a = Math.max(0, f - 1), b = Math.min(frames - 1, f + 1)
    const rootVelocity = V((root.x[b] - root.x[a]) * k, 0, (root.z[b] - root.z[a]) * k).multiplyScalar(MOTION_FPS / (b - a)).applyQuaternion(yawQuat(root.yaw[f]).invert())
    write(MOTION_CHANNELS.root, rootVelocity.x); write(MOTION_CHANNELS.root + 1, rootVelocity.z)
    write(MOTION_CHANNELS.root + 2, wrap(root.yaw[b] - root.yaw[a]) * MOTION_FPS / (b - a))
    speeds.push(rootVelocity.length()); kindSpeeds.push(rootVelocity.length())
    write(MOTION_CHANNELS.contacts, (left[f] ? 1 : 0) | (right[f] ? 2 : 0))

    let c = MOTION_CHANNELS.features
    for (const foot of [0, 1]) { const p = feet[f][foot]; write(c++, p.x); write(c++, p.y + lift); write(c++, p.z) }
    for (const foot of [0, 1]) { const v = velocity(f, (g) => feet[g][foot]); write(c++, v.x); write(c++, v.y); write(c++, v.z) }
    { const v = velocity(f, (g) => hips[g]); write(c++, v.x); write(c++, v.y); write(c++, v.z) }
    const inverse = yawQuat(root.yaw[f]).invert()
    for (const ahead of TRAJECTORY_FRAMES) {
      const g = f + ahead
      const p = V((root.x[g] - root.x[f]) * k, 0, (root.z[g] - root.z[f]) * k).applyQuaternion(inverse)
      write(c++, p.x); write(c++, p.z)
    }
    for (const ahead of TRAJECTORY_FRAMES) {
      const turn = root.yaw[f + ahead] - root.yaw[f]
      write(c++, Math.sin(turn)); write(c++, Math.cos(turn))
    }
  }
  total += frames
  ranges.push([start, total])
  takes.push(clip.name)
  console.log(`${label.padEnd(13)} ${clip.name.padEnd(40)} ${String(frames).padStart(5)} frames, scale ${k.toFixed(3)}, toe lift ${lift.toFixed(3)} m`)
}

const quantised = new Int16Array(MOTION_CHANNELS.total * total)
for (let c = 0; c < MOTION_CHANNELS.total; c++) {
  const s = MOTION_FEATURE_SCALE(c)
  let previous = 0, slope = 0
  for (let f = 0; f < total; f++) {
    const q = Math.max(-32767, Math.min(32767, Math.round(streams[c][f] * s)))
    const nextSlope = (q - previous) << 16 >> 16
    quantised[c * total + f] = (nextSlope - slope) << 16 >> 16
    slope = nextSlope
    previous = q
  }
}
{
  const check = undelta(quantised.slice(), total, MOTION_CHANNELS.total)
  for (let c = 0; c < MOTION_CHANNELS.total; c += 17) {
    const s = MOTION_FEATURE_SCALE(c), f = Math.floor(total * 0.61)
    if (Math.abs(check[c * total + f] / s - streams[c][f]) > 1.5 / s) throw new Error(`round trip failed on channel ${c}`)
  }
}
const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)]
const header = new TextEncoder().encode(JSON.stringify({
  version: 2, fps: MOTION_FPS, frames: total, ranges, takes,
  bones: MOTION_BONES.map(([, name]) => name),
  speed: { p50: percentile(speeds, 0.5), p90: percentile(speeds, 0.9), p99: percentile(speeds, 0.99) },
  source: 'Bandai Namco Research Motion Dataset (CC BY-NC 4.0); 100STYLE, Ian Mason (CC BY 4.0)',
}))
const payload = gzipSync(new Uint8Array(quantised.buffer), { level: 9 })
const file = new Uint8Array(12 + header.length + payload.length)
const view = new DataView(file.buffer)
view.setUint32(0, MOTION_MAGIC, true); view.setUint32(4, header.length, true); view.setUint32(8, payload.length, true)
file.set(header, 12); file.set(payload, 12 + header.length)
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'locomotion.mmdb'), file)
for (const [kind, values] of speedsByKind) console.log(`speed ${kind.padEnd(24)} p10 ${percentile(values, 0.1).toFixed(2)}  p50 ${percentile(values, 0.5).toFixed(2)}  p90 ${percentile(values, 0.9).toFixed(2)}  max ${percentile(values, 1).toFixed(2)} m/s`)
console.log(`database: ${takes.length} takes, ${total} frames (${(total / MOTION_FPS / 60).toFixed(1)} min), ${(file.length / 1e6).toFixed(2)} MB`)
