'use client'

import { useEffect, useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { NoColorSpace, PMREMGenerator, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2 } from 'three'
import type { MaterialKey } from '@/lib/game/blockout/types'
import { surfaceFor } from '@/lib/game/blockout/surfaces'
import { weatherCacheKey, weatherShader } from './weathering'

export function BlockoutMaterial({ material, surface, wireframe, textured }: { material: MaterialKey; surface?: string; wireframe: boolean; textured: boolean }) {
  const spec = surfaceFor({ material, surface })
  const gl = useThree((state) => state.gl)
  const loaded = useLoader(TextureLoader, [`${spec.texture}/albedo.webp`, `${spec.texture}/normal.webp`, `${spec.texture}/orm.webp`])
  const [albedo, normal, orm] = useMemo(() => loaded.map((source, i) => {
    const texture = source.clone()
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.colorSpace = i === 0 ? SRGBColorSpace : NoColorSpace
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    texture.needsUpdate = true
    return texture
  }), [loaded, gl])
  const normalScale = useMemo(() => new Vector2(spec.normalStrength, spec.normalStrength), [spec.normalStrength])
  useEffect(() => () => {
    albedo.dispose(); normal.dispose(); orm.dispose()
    if (surface) useLoader.clear(TextureLoader, [`${spec.texture}/albedo.webp`, `${spec.texture}/normal.webp`, `${spec.texture}/orm.webp`])
  }, [albedo, normal, orm, surface, spec.texture])
  return <meshStandardMaterial key={textured ? 'pbr' : 'clay'} vertexColors map={textured ? albedo : null} normalMap={textured ? normal : null} normalScale={normalScale} roughnessMap={textured ? orm : null} metalnessMap={textured ? orm : null} aoMap={textured ? orm : null} aoMapIntensity={0.8} color={textured ? '#ffffff' : spec.color} roughness={textured ? 1 : 0.8} metalness={textured ? spec.metalness : 0} envMapIntensity={0.5} wireframe={wireframe} onBeforeCompile={weatherShader} customProgramCacheKey={weatherCacheKey} />
}

export function WorkshopReflections() {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const generator = new PMREMGenerator(gl), room = new RoomEnvironment()
    const environment = generator.fromScene(room, 0.04)
    const previous = scene.environment
    scene.environment = environment.texture
    room.dispose(); generator.dispose(); invalidate()
    return () => { scene.environment = previous; environment.dispose() }
  }, [gl, scene, invalidate])
  return null
}
