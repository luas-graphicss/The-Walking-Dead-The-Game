'use client'

import { Component, Suspense, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef, type ReactNode, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { CuboidCollider, Physics, RigidBody, TrimeshCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { modelBounds, type BlockModel, type BlockPart, type LootSocket, type MaterialKey, type StructureModel, type Vec3 } from '@/lib/game/blockout/types'
import { compileGeometry, type GeometryStats } from '@/lib/game/blockout/geometry'
import { hasSculpt, sculptGroups } from '@/lib/game/blockout/sculpt'
import { RESOURCE_ASSET_PREFIX } from '@/lib/game/resources/sculpts'
import { ASSET_BY_ID } from '@/lib/game/blockout/catalog'
import { fractureGroups } from '@/lib/game/blockout/fracture'
import { carveDamaged } from '@/lib/game/blockout/carve'
import { damageColliders } from '@/lib/game/blockout/damage'
import { BlockoutMaterial, WorkshopReflections } from './blockout-material'
import { applyWeather } from './weathering'
import { Button } from '@/components/ui/button'
import { BlockoutExplorer, type ExploreInput } from './blockout-explorer'

export type DisplayOptions = { textured: boolean; cutaway: boolean; wireframe: boolean; sockets: boolean; colliders: boolean; blockout: boolean; broken: boolean; floor: string }
export type CameraView = 'perspective' | 'top' | 'front'
type Props = { model: BlockModel; seed: number; options: DisplayOptions; exploring: boolean; cameraView: CameraView; cameraRevision: number; touch: RefObject<ExploreInput>; onExit: () => void; onReady: (stats: GeometryStats) => void; onPosition: (position: Vec3) => void; onNearby: (socket: LootSocket | null) => void; onInspect: (socket: LootSocket) => void }
type RenderGroup = { material: MaterialKey; surface?: string; geometry: THREE.BufferGeometry }

function renderGroups(model: BlockModel, visible: BlockPart[], blockout: boolean, levelLimit: number, broken: boolean, seed: number): RenderGroup[] {
  if (blockout) return compileGeometry(visible)
  const structure = model as Partial<StructureModel>
  if (!structure.blueprint) {
    const groups = hasSculpt(model.id) ? sculptGroups([{ asset: model.id }]) : compileGeometry(visible)
    if (!broken || ASSET_BY_ID.get(model.id)?.recipe === 'debris') return groups
    const fractured = fractureGroups(model.id, groups, seed)
    const kept = new Set(fractured.map((group) => group.geometry))
    groups.forEach((group) => { if (!kept.has(group.geometry)) group.geometry.dispose() })
    return fractured
  }
  const placed = (structure.instances ?? []).filter((instance) => instance.prefix && instance.level <= levelLimit && hasSculpt(instance.asset))
  const prefixes = placed.map((instance) => `${instance.prefix}/`)
  const rest = prefixes.length ? visible.filter((part) => !prefixes.some((prefix) => part.id.startsWith(prefix))) : visible
  const decor = (structure.decor ?? []).filter((item) => item.level <= levelLimit)
  const carved = rest.filter((part) => part.damage)
  const intact = carved.length ? rest.filter((part) => !part.damage) : rest
  const carvedGroups = carved.length ? carveDamaged(carved, `${model.id}:${levelLimit}:${carved.length}`) : []
  const buckets = new Map<string, RenderGroup[]>()
  for (const group of [...compileGeometry(intact), ...carvedGroups, ...sculptGroups(placed), ...sculptGroups(decor)]) {
    const key = group.surface ?? group.material
    buckets.set(key, [...(buckets.get(key) ?? []), group])
  }
  return [...buckets.values()].map((list) => {
    if (list.length === 1) return list[0]
    const geometry = mergeGeometries(list.map((group) => group.geometry), false)
    if (!geometry) return list[0]
    list.forEach((group) => group.geometry.dispose())
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    return { material: list[0].material, surface: list[0].surface, geometry }
  })
}

function BatchedModel({ groups, options, onReady }: { groups: RenderGroup[]; options: DisplayOptions; onReady: (stats: GeometryStats) => void }) {
  const rendered = useRef<RenderGroup[] | null>(null)
  const stats = useMemo(() => ({ triangles: groups.reduce((sum, group) => sum + group.geometry.getIndex()!.count / 3, 0), vertices: groups.reduce((sum, group) => sum + group.geometry.getAttribute('position').count, 0), drawCalls: groups.length }), [groups])
  useEffect(() => () => { groups.forEach(({ geometry }) => geometry.dispose()) }, [groups])
  return <group>{groups.map(({ material, surface, geometry }) => <mesh key={surface ?? material} geometry={geometry} castShadow receiveShadow onAfterRender={() => { if (rendered.current !== groups) { rendered.current = groups; onReady(stats) } }}><BlockoutMaterial material={material} surface={surface} wireframe={options.wireframe} textured={options.textured} /></mesh>)}</group>
}

function ModelColliders({ parts }: { parts: BlockPart[] }) {
  const groups = useMemo(() => compileGeometry(parts.flatMap((part) => (part.damage ? damageColliders(part) : [part])), 'collision'), [parts])
  useEffect(() => () => groups.forEach(({ geometry }) => geometry.dispose()), [groups])
  return <>{groups.map(({ material, geometry }) => <TrimeshCollider key={material} args={[geometry.getAttribute('position').array as Float32Array, geometry.getIndex()!.array as Uint32Array]} />)}</>
}

function CameraRig({ model, cameraView, cameraRevision }: Pick<Props, 'model' | 'cameraView' | 'cameraRevision'>) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera, invalidate } = useThree()
  useEffect(() => {
    const bounds = modelBounds(model), extent = Math.max(...bounds.size, 0.4), size = extent < 4 ? extent * 0.92 + 0.08 : extent
    const middle = new THREE.Vector3((bounds.min[0] + bounds.max[0]) / 2, bounds.min[1] + bounds.size[1] * 0.35, (bounds.min[2] + bounds.max[2]) / 2)
    if (cameraView === 'top') camera.position.set(0.001, size * 1.8 + bounds.size[1], 0)
    else if (cameraView === 'front') camera.position.set(0, bounds.size[1] * 0.55 + 0.5, size * 1.9)
    else camera.position.set(size * 1.12, size * 0.9 + bounds.size[1] * 0.3, size * 1.3)
    camera.position.x += middle.x
    camera.position.z += middle.z
    camera.lookAt(middle)
    controls.current?.target.copy(middle)
    controls.current?.update()
    invalidate()
  }, [model, camera, cameraView, cameraRevision, invalidate])
  return <OrbitControls ref={controls} makeDefault minDistance={0.2} maxDistance={100} maxPolarAngle={Math.PI / 2 - 0.025} enableDamping dampingFactor={0.12} />
}

function SceneContent(props: Props) {
  const { model, options, exploring } = props
  const visible = useMemo(() => model.parts.filter((part) => (exploring || !options.cutaway || part.role !== 'roof') && (exploring || options.floor === 'all' || part.level <= Number(options.floor))), [model, options.cutaway, options.floor, exploring])
  const levelLimit = exploring || options.floor === 'all' ? Infinity : Number(options.floor)
  const structure = model as Partial<StructureModel>
  const broken = useDeferredValue(!structure.blueprint && options.broken)
  const fractureSeed = broken ? props.seed : 0
  const groups = useMemo(() => renderGroups(model, visible, options.blockout, levelLimit, broken, fractureSeed), [model, visible, options.blockout, levelLimit, broken, fractureSeed])
  const invalidate = useThree((state) => state.invalidate)
  const condition = structure.blueprint ? structure.condition : undefined
  const weather = structure.blueprint ? structure.weather : undefined
  const resource = model.id.startsWith(RESOURCE_ASSET_PREFIX)
  useLayoutEffect(() => {
    applyWeather(condition ? { kind: 'structure', condition, profile: weather } : { kind: resource ? 'resource' : 'module', broken })
    invalidate()
  }, [condition, weather, broken, resource, invalidate])
  const bounds = modelBounds(model)
  const spawn: Vec3 = structure.entrance ?? [0, 0, bounds.max[2] + 2]
  return <>
    <color attach="background" args={['#2a2b23']} />
    <WorkshopReflections />
    <hemisphereLight args={['#ebe6d6', '#484c42', 0.65]} />
    <ambientLight intensity={0.08} />
    <directionalLight position={[14, 24, 18]} intensity={1.8} color="#ebe6d6" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-Math.max(3, bounds.size[0], bounds.size[2])} shadow-camera-right={Math.max(3, bounds.size[0], bounds.size[2])} shadow-camera-top={Math.max(3, bounds.size[0], bounds.size[2])} shadow-camera-bottom={-Math.max(3, bounds.size[0], bounds.size[2])} shadow-camera-far={100} shadow-normalBias={0.002} shadow-bias={-0.00002} />
    <directionalLight position={[-18, 10, -8]} intensity={0.8} color="#a3a08d" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow><planeGeometry args={[240, 240]} /><meshStandardMaterial color="#2a2b23" roughness={1} /></mesh>
    <gridHelper args={[120, 120, '#a3a08d', '#a3a08d']} position={[0, -0.001, 0]} material-transparent material-opacity={0.12} material-depthWrite={false} />
    <Suspense fallback={null}>
      <BatchedModel groups={groups} options={options} onReady={props.onReady} />
      {(exploring || options.colliders) && <Physics gravity={[0, -20, 0]} timeStep={1 / 60} interpolate={false} updatePriority={-50} debug={options.colliders} paused={!exploring}>
        <RigidBody type="fixed" colliders={false}><CuboidCollider args={[120, 0.5, 120]} position={[0, -0.502, 0]} /><ModelColliders parts={model.parts} /></RigidBody>
        {exploring && <BlockoutExplorer key={model.id} model={model} spawn={spawn} touch={props.touch} onExit={props.onExit} onPosition={props.onPosition} onNearby={props.onNearby} onInspect={props.onInspect} />}
      </Physics>}
    </Suspense>
    {!exploring && <CameraRig model={model} cameraView={props.cameraView} cameraRevision={props.cameraRevision} />}
    {options.sockets && model.sockets.map((socket, index) => <Html key={socket.id} position={[socket.position[0], socket.position[1] + 0.15, socket.position[2]]} center distanceFactor={exploring ? 5 : 18} zIndexRange={[10, 0]}><button type="button" className="lab-socket-marker" title={`${socket.label} · ${socket.concealed ? 'oculto' : 'visível'}`} aria-label={`Inspecionar ${socket.label}, ponto ${index + 1}`} onClick={() => props.onInspect(socket)}>{index + 1}</button></Html>)}
  </>
}

class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error: error.message } }
  render() {
    if (this.state.error) return <div className="lab-canvas-error" role="alert"><h2 className="font-heading text-2xl">A cena 3D não pôde ser aberta</h2><p>Confira se a aceleração gráfica e o WebGL 2 estão habilitados.</p><p className="text-sm text-muted-foreground">{this.state.error}</p><Button onClick={() => window.location.reload()}>Recarregar oficina</Button></div>
    return this.props.children
  }
}

const initialCamera = { fov: 42, near: 0.035, far: 250, position: [18, 16, 22] as Vec3 }

export function BlockoutScene(props: Props) {
  return <SceneBoundary><Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 1.5]} frameloop={props.exploring ? 'always' : 'demand'} camera={initialCamera} gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }} aria-label={`Inspeção 3D de ${props.model.label}; arraste para girar, use a roda para aproximar`} style={{ touchAction: 'none' }}><SceneContent {...props} /></Canvas></SceneBoundary>
}
