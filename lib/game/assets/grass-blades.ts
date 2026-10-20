import * as THREE from 'three'
import type { Quality } from '../world/settings'
import { lazy } from './pbr'

export const PATCH_RADIUS = 1.35

export const GRASS_LEVELS: Record<Quality, { tufts: number; fillers: number; bounds: number[] }> = {
  low: { tufts: 22, fillers: 60, bounds: [10, 20, 36, 60, 110] },
  balanced: { tufts: 36, fillers: 110, bounds: [14, 26, 46, 82, 160] },
  high: { tufts: 48, fillers: 150, bounds: [18, 32, 56, 100, 220] },
}
const BLADES_PER_TUFT = 6

const FULL_DENSITY = 10
const FALLOFF = 1.7

const TIER_MARGIN = 2
const keepAt = (distance: number) => Math.min(1, (FULL_DENSITY / distance) ** FALLOFF)

const TIER_ROWS = [[0, 0.36, 0.68], [0, 0.5], [0, 0.5], [0], [0]]

type Blade = { x: number; z: number; height: number; facing: number; lean: number; width: number; tone: number }
type Placed = { blade: Blade; rows: number[]; rank: number }

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function scatter(tufts: number) {
  const rng = random(0x51ed27)
  const pool: Blade[] = []
  while (pool.length < tufts * BLADES_PER_TUFT) {
    const radius = PATCH_RADIUS * Math.sqrt(rng()), angle = rng() * Math.PI * 2, edge = radius / PATCH_RADIUS
    if (rng() < edge ** 3 * 0.45) continue
    const cx = Math.cos(angle) * radius, cz = Math.sin(angle) * radius
    const tuftHeight = (0.68 + 0.32 * rng()) * (1 - 0.35 * edge * edge), spin = rng() * Math.PI * 2
    for (let k = 0; k < BLADES_PER_TUFT; k++) {
      const spread = k / (BLADES_PER_TUFT - 1), offset = rng() * 0.035, around = rng() * Math.PI * 2
      const direction = spin + (k * Math.PI * 2) / BLADES_PER_TUFT + (rng() - 0.5) * 0.7
      pool.push({
        x: cx + Math.cos(around) * offset,
        z: cz + Math.sin(around) * offset,
        height: tuftHeight * (1 - 0.38 * spread) * (0.82 + 0.18 * rng()),

        facing: direction - Math.PI / 2,
        lean: 0.05 + 0.36 * spread * (0.55 + 0.45 * rng()),
        width: 0.025 + 0.015 * rng(),
        tone: rng(),
      })
    }
  }
  return spreadOrder(pool)
}

function scatterFillers(count: number) {
  const rng = random(0x2f6a11)
  const pool: Blade[] = []
  while (pool.length < count) {
    const radius = PATCH_RADIUS * Math.sqrt(rng()), angle = rng() * Math.PI * 2
    if (rng() < (radius / PATCH_RADIUS) ** 3 * 0.4) continue
    pool.push({
      x: Math.cos(angle) * radius, z: Math.sin(angle) * radius,
      height: 0.3 + 0.25 * rng(), facing: rng() * Math.PI * 2, lean: 0.2 + 0.45 * rng(), width: 0.033 + 0.017 * rng(), tone: rng() * 0.7,
    })
  }
  return spreadOrder(pool)
}

function spreadOrder(pool: Blade[]) {
  const ordered = [pool.pop()!]
  const gap = pool.map((blade) => Math.hypot(blade.x - ordered[0].x, blade.z - ordered[0].z))
  while (pool.length) {
    let best = 0
    for (let i = 1; i < pool.length; i++) if (gap[i] > gap[best]) best = i
    const [next] = pool.splice(best, 1)
    gap.splice(best, 1)
    ordered.push(next)
    for (let i = 0; i < pool.length; i++) gap[i] = Math.min(gap[i], Math.hypot(pool[i].x - next.x, pool[i].z - next.z))
  }
  return ordered
}

function tierGeometry(placed: Placed[]) {
  const vertices = placed.reduce((sum, { rows }) => sum + rows.length * 2 + 1, 0)
  const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3)
  const blade = new Float32Array(vertices * 4), shape = new Float32Array(vertices * 4), row = new Float32Array(vertices * 2)
  const index: number[] = []
  let first = 0
  for (const { blade: b, rows, rank } of placed) {
    const perBlade = rows.length * 2 + 1
    for (let v = 0; v < perBlade; v++) {
      const tip = v === perBlade - 1, t = tip ? 1 : rows[v >> 1], side = tip ? 0 : v % 2 ? 1 : -1
      const half = side * b.width * 0.5 * (1 - t) ** 0.7, o = first + v
      position.set([b.x + Math.cos(b.facing) * half, t * b.height * 0.6, b.z + Math.sin(b.facing) * half], o * 3)
      normal.set([0, 1, 0], o * 3)
      blade.set([b.x, b.z, b.height, rank], o * 4)
      shape.set([b.facing, b.lean, b.width, b.tone], o * 4)
      row.set([t, side], o * 2)
    }
    for (let k = 0; k < rows.length - 1; k++) {
      const a = first + k * 2
      index.push(a, a + 1, a + 3, a, a + 3, a + 2)
    }
    const last = first + (rows.length - 1) * 2
    index.push(last, last + 1, first + perBlade - 1)
    first += perBlade
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  geometry.setAttribute('aBlade', new THREE.BufferAttribute(blade, 4))
  geometry.setAttribute('aShape', new THREE.BufferAttribute(shape, 4))
  geometry.setAttribute('aRow', new THREE.BufferAttribute(row, 2))
  geometry.setIndex(index)

  const reach = PATCH_RADIUS + 1.2
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-reach, -0.2, -reach), new THREE.Vector3(reach, 2.6, reach))
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere())
  return geometry
}

const tiers = new Map<Quality, THREE.BufferGeometry[]>()

export function grassTiers(quality: Quality) {
  let result = tiers.get(quality)
  if (!result) {
    const level = GRASS_LEVELS[quality], blades = scatter(level.tufts), total = blades.length
    const fillers = scatterFillers(level.fillers), fillerRank = keepAt(level.bounds[0] - TIER_MARGIN)
    result = TIER_ROWS.map((rows, tier) => {
      const count = tier === 0 ? total : Math.max(2, Math.ceil(total * keepAt(level.bounds[tier - 1] - TIER_MARGIN)))
      const placed: Placed[] = blades.slice(0, count).map((blade, i) => ({ blade, rows, rank: (i + 0.5) / total }))
      if (tier === 0) placed.push(...fillers.map((blade, i) => ({ blade, rows: [0], rank: fillerRank + (1 - fillerRank) * (i + 0.5) / fillers.length })))
      return tierGeometry(placed)
    })
    tiers.set(quality, result)
  }
  return result
}

export const GRASS_UNIFORMS = {
  grassTime: { value: 0 },
  grassWind: { value: new THREE.Vector3(0.8, 0.6, 1) },
  grassOrigin: { value: new THREE.Vector2() },
  grassFade: { value: new THREE.Vector2(FULL_DENSITY, GRASS_LEVELS.balanced.bounds[4]) },
  grassEye: { value: new THREE.Vector3() },
  grassRoot: { value: new THREE.Color('#25311a') },
  grassMid: { value: new THREE.Color('#53683a') },
  grassTip: { value: new THREE.Color('#8a9a52') },
  dryRoot: { value: new THREE.Color('#463d27') },
  dryMid: { value: new THREE.Color('#8a7a4f') },
  dryTip: { value: new THREE.Color('#b8a572') },
}

const BLADE_INPUTS =            `
attribute vec4 aBlade;
attribute vec4 aShape;
attribute vec2 aRow;
attribute vec4 aPatch;
uniform float grassTime;
uniform vec3 grassWind;
uniform vec2 grassOrigin;
uniform vec2 grassFade;
uniform vec3 grassEye;
`

const BLADE_PALETTE =            `
uniform vec3 grassRoot;
uniform vec3 grassMid;
uniform vec3 grassTip;
uniform vec3 dryRoot;
uniform vec3 dryMid;
uniform vec3 dryTip;
varying vec3 vGrassColor;
`

const BLADE_SHAPE =            `
mat4 grassInstance = mat4(1.0);
#ifdef USE_INSTANCING
  grassInstance = instanceMatrix;
#endif

mat3 grassToLocal = transpose(mat3(grassInstance));
vec3 grassUp = grassToLocal * vec3(0.0, 1.0, 0.0);
vec3 grassRootPoint = vec3(aBlade.x, -0.05, aBlade.y);
vec3 grassRootWorld = (modelMatrix * grassInstance * vec4(grassRootPoint, 1.0)).xyz;
float grassDistance = distance(grassEye, grassRootWorld);
float grassKeep = pow(grassFade.x / max(grassDistance, 0.01), ${FALLOFF.toFixed(2)});
float grassGrow = clamp((grassKeep - aBlade.w) / (0.35 * min(grassKeep, 1.0)), 0.0, 1.0);
grassGrow *= 1.0 - smoothstep(grassFade.y * 0.7, grassFade.y, grassDistance);
float grassWiden = clamp(inversesqrt(min(grassKeep, 1.0)), 1.0, 7.0);
float grassReeds = aPatch.z;
float grassT = aRow.x;
float grassHeight = aPatch.x * aBlade.z * grassGrow;
float grassWidth = aShape.z * grassWiden * mix(1.0, 2.3, grassReeds) * grassGrow;
vec3 grassAcross = vec3(cos(aShape.x), 0.0, sin(aShape.x));
grassAcross = normalize(grassAcross - grassUp * dot(grassAcross, grassUp));
vec3 grassFace = cross(grassAcross, grassUp);
vec2 grassWorld = grassRootWorld.xz + grassOrigin;
float grassWave = dot(grassWorld, grassWind.xy);
float grassGust = 0.5 + 0.5 * sin(grassWave * 0.12 - grassTime * 1.8 + 1.6 * sin(grassWorld.x * 0.021 - grassWorld.y * 0.027 + grassTime * 0.23));
float grassFlutter = sin(grassTime * (2.4 + 2.2 * aShape.w) + aShape.w * 31.0 + grassWave * 0.8) * 0.06;
vec3 grassWindLocal = grassToLocal * vec3(grassWind.x, 0.0, grassWind.y);
vec3 grassBend = grassFace * aShape.y * mix(1.0, 0.3, grassReeds)
  + grassWindLocal * (grassWind.z * (0.03 + 0.22 * grassGust * grassGust) + grassFlutter) * mix(1.0, 0.45, grassReeds);
grassBend -= grassUp * dot(grassBend, grassUp);
float grassBendSq = dot(grassBend, grassBend);
vec3 grassCenter = grassRootPoint + grassUp * (grassHeight * grassT * (1.0 - 0.3 * grassBendSq * grassT)) + grassBend * (grassHeight * grassT * grassT);
vec3 grassPosition = grassCenter + grassAcross * (aRow.y * grassWidth * 0.5 * pow(max(1.0 - grassT, 0.0), 0.7));
`

const BLADE_SHADING =            `
vec3 grassTangent = normalize(grassUp * (1.0 - 0.6 * grassBendSq * grassT) + grassBend * (2.0 * grassT));
vec3 grassSurface = normalize(cross(grassAcross, grassTangent));
if (dot(grassSurface, grassBend) > 0.0) grassSurface = -grassSurface;

vec3 objectNormal = normalize(grassSurface * 0.55 + grassUp * 0.8 + grassAcross * (aRow.y * 0.3));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
float grassDry = clamp(aPatch.y + (fract(aShape.w * 7.31 + aPatch.w) - 0.5) * 0.36, 0.0, 1.0);
vec3 grassColor = mix(mix(grassRoot, dryRoot, grassDry), mix(grassMid, dryMid, grassDry), smoothstep(0.0, 0.55, grassT));
grassColor = mix(grassColor, mix(grassTip, dryTip, grassDry), smoothstep(0.55, 1.0, grassT));
vGrassColor = grassColor * (0.8 + 0.4 * aShape.w) * mix(0.5, 1.0, smoothstep(0.0, 0.35, grassT));
`

export const grassMaterial = lazy(() => {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, side: THREE.DoubleSide })
  material.name = 'grass_blades'
  material.defines = { ...material.defines, SUN_RING_LIFT: '0.05' }
  material.customProgramCacheKey = () => 'grass-blades-v2'
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, GRASS_UNIFORMS)
    shader.vertexShader = BLADE_INPUTS + BLADE_PALETTE + shader.vertexShader
      .replace('#include <beginnormal_vertex>', BLADE_SHAPE + BLADE_SHADING)
      .replace('#include <begin_vertex>', 'vec3 transformed = grassPosition;')
    shader.fragmentShader = `varying vec3 vGrassColor;\n${shader.fragmentShader
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vGrassColor;')
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'))}`
  }
  return material
})

const CAST_SHARE: Record<Quality, number> = { low: 0.75, balanced: 1, high: 1 }

const BLADE_CAST =            `
#ifdef USE_INSTANCING
  vec4 grassCastRoot = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  if (aBlade.w > grassCastShare || max(abs(grassCastRoot.x), abs(grassCastRoot.y)) > grassCastRoot.w + grassCastReach) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
#endif
`

const depthMaterials = new Map<Quality, THREE.MeshDepthMaterial>()

export function grassDepthMaterial(quality: Quality, ringExtent: number) {
  let material = depthMaterials.get(quality)
  if (material) return material
  material = new THREE.MeshDepthMaterial()
  material.name = 'grass_blades_depth'
  material.customProgramCacheKey = () => 'grass-blades-depth-v1'

  const cast = { grassCastShare: { value: CAST_SHARE[quality] }, grassCastReach: { value: (PATCH_RADIUS + 1.2) / ringExtent } }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, GRASS_UNIFORMS, cast)
    shader.vertexShader = `${BLADE_INPUTS}uniform float grassCastShare;\nuniform float grassCastReach;\n${shader.vertexShader
      .replace('#include <begin_vertex>', `${BLADE_CAST}${BLADE_SHAPE}\nvec3 transformed = grassPosition;`)}`
  }
  depthMaterials.set(quality, material)
  return material
}
