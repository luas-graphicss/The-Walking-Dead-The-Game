'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import type { MaterialKey } from '@/lib/game/blockout/types'
import { InteractionDirector, type Probe } from '@/lib/game/interaction/director'
import { buildingMatrix, interactionWorld, leafMatrix } from '@/lib/game/interaction/world'
import { runtime } from '@/lib/game/runtime'
import { trackShadowMover } from '@/lib/game/shadow'
import type { WorldSession } from '@/lib/game/world/session'
import type { Quality } from '@/lib/game/world/settings'
import { structureMaterial } from './structure-materials'

const CULL: Record<Quality, number> = { low: 13, balanced: 20, high: 28 }
const MAX_SPARKS = 96
const GLOW_MESHES = 28
const GLOW_COLOR = new THREE.Color('#ffd98e')
const SPARK_WARM = new THREE.Color('#ffc65c')
const SPARK_CORE = new THREE.Color('#fff6e0')

const GLOW_VERTEX = `
uniform float uBottom;
uniform float uTop;
varying vec3 vNormal;
varying vec3 vView;
varying float vHeight;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 view = viewMatrix * world;
  vNormal = normalize(normalMatrix * normal);
  vView = -view.xyz;
  vHeight = (world.y - uBottom) / max(uTop - uBottom, 0.001);
  gl_Position = projectionMatrix * view;
}
`

const GLOW_FRAGMENT = `
uniform vec3 uColor;
uniform float uLevel;
uniform float uTime;
uniform float uSweep;
varying vec3 vNormal;
varying vec3 vView;
varying float vHeight;
void main() {
  float facing = abs(dot(normalize(vNormal), normalize(vView)));
  float rim = pow(1.0 - facing, 2.4);
  float breath = 0.8 + 0.2 * sin(uTime * 2.4);
  float band = exp(-pow((vHeight - uSweep * 1.5 + 0.25) / 0.08, 2.0)) * (1.0 - uSweep);
  float alpha = uLevel * (0.045 + rim * 0.62 * breath + band * 0.5);
  gl_FragColor = vec4(uColor * 1.35, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const SPARK_VERTEX = `
attribute float aLevel;
attribute float aLit;
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uScale;
varying float vLevel;
varying float vLit;
varying float vTwinkle;
varying float vRing;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  float distance = max(-view.z, 0.1);
  view.xyz += normalize(-view.xyz) * min(0.14, aSize * 0.5 + 0.04);
  gl_Position = projectionMatrix * view;
  float twinkle = 0.5 + 0.5 * sin(uTime * (2.2 + aPhase * 1.6) + aPhase * 6.2831);
  float meters = mix(0.07, 0.17, aLit) * (0.85 + 0.3 * twinkle) * (0.75 + 0.5 * clamp(aSize / 0.3, 0.0, 1.0));
  gl_PointSize = clamp(meters * uScale / distance, 5.0, 96.0) * smoothstep(0.0, 0.35, aLevel);
  vLevel = aLevel;
  vLit = aLit;
  vTwinkle = twinkle;
  vRing = fract(uTime * 0.85 + aPhase);
}
`

const SPARK_FRAGMENT = `
uniform vec3 uWarm;
uniform vec3 uCore;
varying float vLevel;
varying float vLit;
varying float vTwinkle;
varying float vRing;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float core = exp(-r * r * 26.0);
  float halo = exp(-r * r * 5.5) * 0.32;
  float star = (exp(-abs(p.x) * 26.0) * exp(-abs(p.y) * 3.2) + exp(-abs(p.y) * 26.0) * exp(-abs(p.x) * 3.2)) * (0.25 + 0.75 * vTwinkle);
  float ring = smoothstep(0.06, 0.0, abs(r - mix(0.25, 0.95, vRing))) * (1.0 - vRing) * vLit;
  float edge = 1.0 - smoothstep(0.82, 1.0, r);
  float alpha = (core * 1.15 + halo + star * 0.55 + ring * 0.7) * vLevel * edge;
  gl_FragColor = vec4(mix(uWarm, uCore, clamp(core * 1.4, 0.0, 1.0)) * 1.6, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function glowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: GLOW_COLOR }, uLevel: { value: 0 }, uTime: { value: 0 }, uSweep: { value: 1 }, uBottom: { value: 0 }, uTop: { value: 1 } },
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  })
}

function warmMaterials(gl: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene, keys: MaterialKey[]) {
  const geometry = new THREE.BoxGeometry(0.001, 0.001, 0.001)
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3))
  const probe = new THREE.Group()
  for (const key of keys) {
    const mesh = new THREE.Mesh(geometry, structureMaterial(key, true))
    mesh.castShadow = true
    mesh.receiveShadow = true
    probe.add(mesh)
  }
  gl.compileAsync(probe, camera, scene).catch(() => undefined).finally(() => geometry.dispose())
}

export function InteractionLayer({ session }: { session: WorldSession }) {
  const { world, rapier } = useRapier()
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const director = useMemo(() => new InteractionDirector(), [])
  useEffect(() => () => director.dispose(), [director])

  const probe = useMemo<Probe>(() => {
    const ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })
    const body = new rapier.Capsule(0.5, 0.28)
    const flags = rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_DYNAMIC
    const origin = { x: 0, y: 0, z: 0 }, direction = { x: 0, y: 0, z: 0 }, center = { x: 0, y: 0, z: 0 }, rotation = { x: 0, y: 0, z: 0, w: 1 }
    return {
      sight(from, to, slack) {
        const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, length = Math.hypot(dx, dy, dz)
        if (length <= slack) return true
        origin.x = from.x; origin.y = from.y; origin.z = from.z
        direction.x = dx / length; direction.y = dy / length; direction.z = dz / length
        ray.origin = origin
        ray.dir = direction
        return !world.castRay(ray, length - slack, true, flags, undefined, runtime.playerCollider ?? undefined, runtime.playerBody ?? undefined)
      },
      fits(feet) {
        center.x = feet.x; center.y = feet.y + 0.92; center.z = feet.z
        return world.intersectionWithShape(center, rotation, body, flags, undefined, runtime.playerCollider ?? undefined, runtime.playerBody ?? undefined) === null
      },
    }
  }, [world, rapier])

  useFrame((_, delta) => {
    director.cullRadius = CULL[session.quality]
    director.update(Math.min(delta, 0.1), camera, probe)
  }, -41)

  useFrame(() => {
    director.present(camera, gl.domElement.clientWidth, gl.domElement.clientHeight)
  }, -25)

  return (
    <>
      <LeafGlow director={director} />
      <ResourceSparks director={director} />
      <HeldResource director={director} />
    </>
  )
}

function LeafGlow({ director }: { director: InteractionDirector }) {
  const { group, pool } = useMemo(() => {
    const group = new THREE.Group()
    group.name = 'interaction-glow'
    const pool = Array.from({ length: GLOW_MESHES }, () => {
      const mesh = new THREE.Mesh(undefined, glowMaterial())
      mesh.matrixAutoUpdate = false
      mesh.frustumCulled = false
      mesh.visible = false
      mesh.renderOrder = 2
      group.add(mesh)
      return mesh
    })
    return { group, pool }
  }, [])
  useEffect(() => () => {
    for (const mesh of pool) (mesh.material as THREE.Material).dispose()
  }, [pool])
  const scratch = useMemo(() => ({ building: new THREE.Matrix4(), leaf: new THREE.Matrix4() }), [])

  useFrame((state) => {
    const world = interactionWorld()
    let used = 0
    if (world) for (const glow of director.glows.values()) {
      if (glow.level < 0.004) continue
      const { ref } = glow, data = ref.data, record = ref.building.record
      const matrix = buildingMatrix(record, scratch.building)
      if (leafMatrix(data, world.leafValue(ref.key, data), scratch.leaf)) matrix.multiply(scratch.leaf)
      const bottom = record.y + data.center[1] - data.height / 2
      for (const piece of data.pieces) {
        const source = ref.building.interaction.pieces[piece]
        if (!source || used >= pool.length) continue
        const mesh = pool[used++]
        mesh.geometry = source.geometry
        mesh.matrix.copy(matrix)
        mesh.matrixWorldNeedsUpdate = true
        const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms
        uniforms.uLevel.value = glow.level
        uniforms.uTime.value = state.clock.elapsedTime
        uniforms.uSweep.value = Math.min(1, (director.clock - glow.since) / 0.9)
        uniforms.uBottom.value = bottom
        uniforms.uTop.value = bottom + data.height
        mesh.visible = true
      }
    }
    for (let i = used; i < pool.length; i++) pool[i].visible = false
  }, -37)

  return <primitive object={group} />
}

function ResourceSparks({ director }: { director: InteractionDirector }) {
  const gl = useThree((state) => state.gl)
  const parts = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const attribute = (size: number) => new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * size), size).setUsage(THREE.DynamicDrawUsage)
    const position = attribute(3), level = attribute(1), lit = attribute(1), size = attribute(1), phase = attribute(1)
    geometry.setAttribute('position', position)
    geometry.setAttribute('aLevel', level)
    geometry.setAttribute('aLit', lit)
    geometry.setAttribute('aSize', size)
    geometry.setAttribute('aPhase', phase)
    geometry.setDrawRange(0, 0)
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uWarm: { value: SPARK_WARM }, uCore: { value: SPARK_CORE } },
      vertexShader: SPARK_VERTEX,
      fragmentShader: SPARK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.renderOrder = 3
    points.name = 'interaction-sparks'
    return { geometry, material, points, position, level, lit, size, phase, buffer: new THREE.Vector2() }
  }, [])
  useEffect(() => () => {
    parts.geometry.dispose()
    parts.material.dispose()
  }, [parts])

  useFrame((state) => {
    let count = 0
    for (const spark of director.sparks.values()) {
      if (count >= MAX_SPARKS || spark.level < 0.004) continue
      parts.position.setXYZ(count, spark.point.x, spark.point.y, spark.point.z)
      parts.level.setX(count, spark.level)
      parts.lit.setX(count, spark.lit)
      parts.size.setX(count, spark.size)
      parts.phase.setX(count, spark.phase)
      count++
    }
    for (const attribute of [parts.position, parts.level, parts.lit, parts.size, parts.phase]) attribute.needsUpdate = true
    parts.geometry.setDrawRange(0, count)
    parts.points.visible = count > 0
    const camera = state.camera as THREE.PerspectiveCamera
    gl.getDrawingBufferSize(parts.buffer)
    parts.material.uniforms.uScale.value = parts.buffer.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
    parts.material.uniforms.uTime.value = state.clock.elapsedTime
  }, -37)

  return <primitive object={parts.points} />
}

function HeldResource({ director }: { director: InteractionDirector }) {
  const group = useMemo(() => {
    const group = new THREE.Group()
    group.name = 'interaction-held'
    group.matrixAutoUpdate = false
    group.visible = false
    return group
  }, [])
  const current = useRef<string | null>(null)
  const warmed = useRef(new Set<MaterialKey>())
  useEffect(() => trackShadowMover(group), [group])

  useFrame(({ gl, camera, scene }) => {
    const preview = director.preview
    if (preview) {
      const missing: MaterialKey[] = []
      for (const piece of preview.data.pieces) {
        const material = preview.building.interaction.pieces[piece]?.material
        if (!material || warmed.current.has(material)) continue
        warmed.current.add(material)
        missing.push(material)
      }
      if (missing.length) warmMaterials(gl, camera, scene, missing)
    }
    const ref = director.heldRef()
    const key = ref?.key ?? null
    if (key !== current.current) {
      group.clear()
      if (ref) for (const piece of ref.data.pieces) {
        const source = ref.building.interaction.pieces[piece]
        if (!source) continue
        const mesh = new THREE.Mesh(source.geometry, structureMaterial(source.material, true))
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.matrixAutoUpdate = false
        mesh.frustumCulled = false
        group.add(mesh)
      }
      current.current = key
    }
    group.visible = ref !== null && director.heldMatrix(group.matrix)
    if (group.visible) group.matrixWorldNeedsUpdate = true
  }, -37)

  return <primitive object={group} />
}
