import type { TextureSet } from './catalog'

export const ATLAS_TEXTURES = new Set<TextureSet>(['leaves', 'endgrain', 'rock-atlas', 'asphalt-debris', 'foliage-broadleaf', 'foliage-pine', 'grass', 'tree-impostors'])
export const WORLD_TEXTURE_SCALE: Partial<Record<TextureSet, { authoredMeters: number; meters: number }>> = {
  asphalt: { authoredMeters: 4, meters: 1.28 },
  'asphalt-cracked': { authoredMeters: 4, meters: 1.28 },
  dirt: { authoredMeters: 4, meters: 2.56 },
  paint: { authoredMeters: 2, meters: 0.64 },
  sidewalk: { authoredMeters: 1.2, meters: 1.2 },
  concrete: { authoredMeters: 2, meters: 1.28 },
  steel: { authoredMeters: 1, meters: 0.5 },
  'leaf-litter': { authoredMeters: 2, meters: 1.28 },
  'pine-needles': { authoredMeters: 2, meters: 1.28 },
  bark: { authoredMeters: 0.5, meters: 0.5 },
  'pine-bark': { authoredMeters: 0.8, meters: 0.64 },
  'birch-bark': { authoredMeters: 0.6, meters: 0.48 },
  deadwood: { authoredMeters: 0.6, meters: 0.6 },
  soil: { authoredMeters: 2, meters: 1.28 },
  rock: { authoredMeters: 2, meters: 2 },
  moss: { authoredMeters: 2, meters: 1.28 },
}

export function textureRepeat(set: TextureSet) {
  if (ATLAS_TEXTURES.has(set)) return 1
  const scale = WORLD_TEXTURE_SCALE[set]
  return scale ? scale.authoredMeters / scale.meters : 1
}

export const BARK_INSTANCE_UV =            `
  #if defined( USE_BATCHING ) || defined( USE_INSTANCING )
    #ifdef USE_BATCHING
      mat4 surfaceInstance = batchingMatrix;
    #else
      mat4 surfaceInstance = instanceMatrix;
    #endif
    vec3 surfaceInstanceScale = vec3(length(surfaceInstance[0].xyz), length(surfaceInstance[1].xyz), length(surfaceInstance[2].xyz));
    vec2 surfaceRepeat = vec2(sqrt(surfaceInstanceScale.x * surfaceInstanceScale.z), surfaceInstanceScale.y);
    #ifdef USE_MAP
      vMapUv *= surfaceRepeat;
    #endif
    #ifdef USE_NORMALMAP
      vNormalMapUv *= surfaceRepeat;
    #endif
    #ifdef USE_AOMAP
      vAoMapUv *= surfaceRepeat;
    #endif
    #ifdef USE_ROUGHNESSMAP
      vRoughnessMapUv *= surfaceRepeat;
    #endif
    #ifdef USE_METALNESSMAP
      vMetalnessMapUv *= surfaceRepeat;
    #endif
  #endif
`
