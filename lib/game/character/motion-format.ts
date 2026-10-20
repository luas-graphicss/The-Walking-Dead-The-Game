export const MOTION_MAGIC = 0x4244_4d4d
export const MOTION_FPS = 30

export const TRAJECTORY_FRAMES = [10, 20, 30] as const

export const MOTION_BONES = [
  ['Hips', 'Bip01 Pelvis'],
  ['Spine', 'Bip01 Spine'], ['Spine1', 'Bip01 Spine1'], ['Spine2', 'Bip01 Spine2'], ['Neck', 'Bip01 Neck'], ['Head', 'Bip01 Head'],
  ['LeftShoulder', 'Bip01 L Clavicle'], ['LeftArm', 'Bip01 L UpperArm'], ['LeftForeArm', 'Bip01 L Forearm'], ['LeftHand', 'Bip01 L Hand'],
  ['RightShoulder', 'Bip01 R Clavicle'], ['RightArm', 'Bip01 R UpperArm'], ['RightForeArm', 'Bip01 R Forearm'], ['RightHand', 'Bip01 R Hand'],
  ['LeftUpLeg', 'Bip01 L Thigh'], ['LeftLeg', 'Bip01 L Calf'], ['LeftFoot', 'Bip01 L Foot'], ['LeftToe', 'Bip01 L Toe0'],
  ['RightUpLeg', 'Bip01 R Thigh'], ['RightLeg', 'Bip01 R Calf'], ['RightFoot', 'Bip01 R Foot'], ['RightToe', 'Bip01 R Toe0'],
] as const
export const BONE_COUNT = MOTION_BONES.length
export const HIPS_NODE = 'Bip01'

export const BONE = {
  pelvis: 0, spine: 1, spine1: 2, spine2: 3, neck: 4, head: 5,
  leftThigh: 14, leftCalf: 15, leftFoot: 16, leftToe: 17,
  rightThigh: 18, rightCalf: 19, rightFoot: 20, rightToe: 21,
} as const

export const MIRROR_BONE = MOTION_BONES.map(([name]) => {
  const partner = name.startsWith('Left') ? `Right${name.slice(4)}` : name.startsWith('Right') ? `Left${name.slice(5)}` : name
  return MOTION_BONES.findIndex(([other]) => other === partner)
})

export const FEATURE = {
  leftFootPosition: 0, rightFootPosition: 3, leftFootVelocity: 6, rightFootVelocity: 9, hipVelocity: 12,
  trajectoryPosition: 15, trajectoryDirection: 21, count: 27,
} as const

export const MOTION_CHANNELS = {
  rotations: 0,
  hips: BONE_COUNT * 4,
  root: BONE_COUNT * 4 + 3,
  contacts: BONE_COUNT * 4 + 6,
  features: BONE_COUNT * 4 + 7,
  total: BONE_COUNT * 4 + 7 + FEATURE.count,
} as const

export function MOTION_FEATURE_SCALE(channel: number) {
  if (channel < MOTION_CHANNELS.hips) return 4096
  if (channel < MOTION_CHANNELS.root) return 1000
  if (channel < MOTION_CHANNELS.contacts) return 500
  if (channel === MOTION_CHANNELS.contacts) return 1
  const feature = channel - MOTION_CHANNELS.features
  if (feature >= FEATURE.trajectoryDirection) return 2000
  if (feature >= FEATURE.trajectoryPosition) return 500
  return feature >= FEATURE.leftFootVelocity ? 200 : 500
}

export function undelta(data: Int16Array, frames: number, channels: number) {
  for (let c = 0; c < channels; c++) {
    let value = 0, slope = 0
    for (let f = 0, i = c * frames; f < frames; f++, i++) {
      slope = (slope + data[i]) << 16 >> 16
      value = (value + slope) << 16 >> 16
      data[i] = value
    }
  }
  return data
}
