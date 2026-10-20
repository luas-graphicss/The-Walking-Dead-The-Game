import * as THREE from 'three'
import { SUN_DIRECTION } from '../atmosphere'
import type { Quality } from '../world/settings'
import { TERRAIN_LAYERS } from './catalog'
import { groundTextures } from './ground-textures'
import { noiseTexture } from './noise-texture'

export const TEXTURE_PERIOD = 4096

export const worldUniforms = {
  terrainOrigin: { value: new THREE.Vector2() },
  time: { value: 0 },
}
const wrap = (value: number) => ((value % TEXTURE_PERIOD) + TEXTURE_PERIOD) % TEXTURE_PERIOD
export function setWorldOrigin(x: number, z: number) {
  worldUniforms.terrainOrigin.value.set(wrap(x), wrap(z))
}

const VERTEX_PARS =            `
attribute vec4 splatA;
attribute vec4 splatB;
attribute vec4 splatC;
uniform vec2 terrainOrigin;
varying vec4 vSplatA;
varying vec4 vSplatB;
varying vec4 vSplatC;
varying vec3 vTerrainWorld;
varying vec3 vTerrainNormal;
varying vec3 vTerrainView;
`

const VERTEX_MAIN =            `
  vec4 terrainWorld = modelMatrix * vec4( transformed, 1.0 );
  vTerrainWorld = vec3( terrainWorld.x + terrainOrigin.x, terrainWorld.y, terrainWorld.z + terrainOrigin.y );
  vTerrainNormal = normalize( mat3( modelMatrix ) * objectNormal );
  vTerrainView = cameraPosition - terrainWorld.xyz;
  vSplatA = splatA;
  vSplatB = splatB;
  vSplatC = splatC;
  #include <project_vertex>
`

const FRAGMENT_PARS =            `
uniform sampler2DArray terrainAlbedo;
uniform sampler2DArray terrainMaterial;
uniform sampler2D terrainNoise;
uniform float terrainTile[ TERRAIN_LAYERS ];
uniform float terrainDepth[ TERRAIN_LAYERS ];
uniform float terrainTriplanar[ TERRAIN_LAYERS ];
uniform vec3 terrainSun;
varying vec4 vSplatA;
varying vec4 vSplatB;
varying vec4 vSplatC;
varying vec3 vTerrainWorld;
varying vec3 vTerrainNormal;
varying vec3 vTerrainView;

struct TerrainTap { vec4 albedo; vec3 normal; float rough; float ao; };

vec2 terrainShift( float index ) { return sin( vec2( 3.0, 7.0 ) * index ); }

vec3 terrainUnpack( vec4 material ) {
  vec2 xy = material.rg * 2.0 - 1.0;
  return vec3( xy, sqrt( max( 0.0, 1.0 - dot( xy, xy ) ) ) );
}

float terrainHeight( int layer, vec2 uv, vec2 dx, vec2 dy, float variation ) {
  float l = float( layer );
  #if TERRAIN_ANTITILE
    float v = variation * 8.0 + l * 1.37;
    float ia = floor( v );
    float ha = textureGrad( terrainAlbedo, vec3( uv + terrainShift( ia ), l ), dx, dy ).a;
    float hb = textureGrad( terrainAlbedo, vec3( uv + terrainShift( ia + 1.0 ), l ), dx, dy ).a;
    return mix( ha, hb, smoothstep( 0.2, 0.8, fract( v ) ) );
  #else
    return textureGrad( terrainAlbedo, vec3( uv, l ), dx, dy ).a;
  #endif
}

TerrainTap terrainPlanar( int layer, vec2 uv, vec2 dx, vec2 dy, float variation, vec3 T, vec3 B, vec3 N ) {
  float l = float( layer );
  vec4 albedo, material;
  #if TERRAIN_ANTITILE
    float v = variation * 8.0 + l * 1.37;
    float ia = floor( v );
    vec2 oa = terrainShift( ia ), ob = terrainShift( ia + 1.0 );
    vec4 aa = textureGrad( terrainAlbedo, vec3( uv + oa, l ), dx, dy );
    vec4 ab = textureGrad( terrainAlbedo, vec3( uv + ob, l ), dx, dy );
    float t = smoothstep( 0.2, 0.8, fract( v ) - 0.1 * dot( aa.rgb - ab.rgb, vec3( 1.0 ) ) );
    albedo = mix( aa, ab, t );
    material = mix( textureGrad( terrainMaterial, vec3( uv + oa, l ), dx, dy ), textureGrad( terrainMaterial, vec3( uv + ob, l ), dx, dy ), t );
  #else
    albedo = textureGrad( terrainAlbedo, vec3( uv, l ), dx, dy );
    material = textureGrad( terrainMaterial, vec3( uv, l ), dx, dy );
  #endif
  vec3 n = terrainUnpack( material );
  TerrainTap tap;
  tap.albedo = albedo;
  tap.normal = normalize( T * n.x + B * n.y + N * n.z );
  tap.rough = material.b;
  tap.ao = material.a;
  return tap;
}

TerrainTap terrainTriplanarTap( int layer, vec3 p, vec3 dx, vec3 dy, vec3 N ) {
  float l = float( layer );
  vec3 w = pow( abs( N ), vec3( 4.0 ) );
  w /= w.x + w.y + w.z;
  vec4 ax = textureGrad( terrainAlbedo, vec3( p.zy, l ), dx.zy, dy.zy );
  vec4 ay = textureGrad( terrainAlbedo, vec3( p.xz, l ), dx.xz, dy.xz );
  vec4 az = textureGrad( terrainAlbedo, vec3( p.xy, l ), dx.xy, dy.xy );
  vec4 mx = textureGrad( terrainMaterial, vec3( p.zy, l ), dx.zy, dy.zy );
  vec4 my = textureGrad( terrainMaterial, vec3( p.xz, l ), dx.xz, dy.xz );
  vec4 mz = textureGrad( terrainMaterial, vec3( p.xy, l ), dx.xy, dy.xy );
  vec3 nx = terrainUnpack( mx ), ny = terrainUnpack( my ), nz = terrainUnpack( mz );
  TerrainTap tap;
  tap.albedo = ax * w.x + ay * w.y + az * w.z;
  vec3 detailSlope = w.x * vec3( 0.0, -nx.y, nx.x ) / max( nx.z, 0.2 )
    + w.y * vec3( ny.x, 0.0, -ny.y ) / max( ny.z, 0.2 )
    + w.z * vec3( nz.x, -nz.y, 0.0 ) / max( nz.z, 0.2 );
  tap.normal = normalize( N + detailSlope - N * dot( N, detailSlope ) );
  tap.rough = mx.b * w.x + my.b * w.y + mz.b * w.z;
  tap.ao = mx.a * w.x + my.a * w.y + mz.a * w.z;
  return tap;
}

TerrainTap terrainTap( int layer, vec2 world, vec3 dPx, vec3 dPy, float variation, vec3 T, vec3 B, vec3 N ) {
  float tile = terrainTile[ layer ];
  if ( terrainTriplanar[ layer ] > 0.5 || abs( N.y ) < 0.72 ) return terrainTriplanarTap( layer, vec3( world.x, vTerrainWorld.y, world.y ) * tile, dPx * tile, dPy * tile, N );
  return terrainPlanar( layer, world * tile, dPx.xz * tile, dPy.xz * tile, variation, T, B, N );
}
`

const FRAGMENT_MAIN =            `
vec3 terrainNormalOut;
float terrainRoughOut;
float terrainAOOut;
float terrainSelfShadow = 1.0;
{
  vec3 Ng = normalize( vTerrainNormal );
  vec3 T = normalize( vec3( 1.0, 0.0, 0.0 ) - Ng * Ng.x );
  vec3 B = cross( Ng, T );
  vec2 world = vTerrainWorld.xz;
  float dist = length( vTerrainView );
  vec4 broadNoise = texture( terrainNoise, world / 1024.0 );
  vec4 fineNoise = texture( terrainNoise, world / 128.0 );
  float variation = broadNoise.a * 0.6 + fineNoise.r * 0.4;

  float w[ TERRAIN_LAYERS ];
  w[ 0 ] = vSplatA.x; w[ 1 ] = vSplatA.y; w[ 2 ] = vSplatA.z; w[ 3 ] = vSplatA.w;
  w[ 4 ] = vSplatB.x; w[ 5 ] = vSplatB.y; w[ 6 ] = vSplatB.z; w[ 7 ] = vSplatB.w;
  w[ 8 ] = vSplatC.x; w[ 9 ] = vSplatC.y; w[ 10 ] = vSplatC.z;
  float wet = vSplatC.w;

  vec4 breakup = vec4( fineNoise.g, fineNoise.b, broadNoise.a, fineNoise.a ) * 2.0 - 1.0;
  int i0 = 0, i1 = 0, i2 = 0;
  float b0 = -1.0, b1 = -1.0, b2 = -1.0, b3 = 0.0;
  for ( int i = 0; i < TERRAIN_LAYERS; i ++ ) {
    int k = i - ( i / 4 ) * 4;
    float fray = k == 0 ? breakup.x : k == 1 ? breakup.y : k == 2 ? breakup.z : breakup.w;
    float v = max( 0.0, w[ i ] * ( 1.0 + 0.9 * fray ) );
    if ( v > b0 ) { b3 = b2; i2 = i1; b2 = b1; i1 = i0; b1 = b0; i0 = i; b0 = v; }
    else if ( v > b1 ) { b3 = b2; i2 = i1; b2 = b1; i1 = i; b1 = v; }
    else if ( v > b2 ) { b3 = b2; i2 = i; b2 = v; }
    else if ( v > b3 ) { b3 = v; }
  }

  b0 = max( b0 - b3, 0.0 ); b1 = max( b1 - b3, 0.0 ); b2 = max( b2 - b3, 0.0 );
  float bs = b0 + b1 + b2 + 1e-5;
  b0 /= bs; b1 /= bs; b2 /= bs;

  vec3 dPx = dFdx( vTerrainWorld ), dPy = dFdy( vTerrainWorld );
  vec2 dWx = dPx.xz, dWy = dPy.xz;
  vec2 shift = vec2( 0.0 );
  #if TERRAIN_PARALLAX
    float detail = 1.0 - smoothstep( 14.0, 38.0, dist );
    if ( detail > 0.0 && terrainTriplanar[ i0 ] < 0.5 ) {

      vec3 V = normalize( vTerrainView );
      float vn = max( dot( V, Ng ), 0.22 );
      vec2 dir = -( V.xz - Ng.xz * dot( V, Ng ) ) / vn;
      float depth = terrainDepth[ i0 ] * detail * smoothstep( 0.15, 0.6, b0 );
      float tile = terrainTile[ i0 ];
      vec2 tdx = dWx * tile, tdy = dWy * tile;
      const float stepSize = 1.0 / float( TERRAIN_PARALLAX );
      float ray = 1.0, prevRay = 1.0;
      float h = terrainHeight( i0, world * tile, tdx, tdy, variation ), prevH = h;
      vec2 cur = vec2( 0.0 ), prevCur = vec2( 0.0 );
      for ( int k = 0; k < TERRAIN_PARALLAX; k ++ ) {
        if ( ray <= h ) break;
        prevH = h; prevRay = ray; prevCur = cur;
        ray -= stepSize;
        cur += dir * depth * stepSize;
        h = terrainHeight( i0, ( world + cur ) * tile, tdx, tdy, variation );
      }
      float after = h - ray, before = prevH - prevRay;
      float t = clamp( after / ( after - before + 1e-5 ), 0.0, 1.0 );
      shift = mix( cur, prevCur, t );
      float surface = mix( ray, prevRay, t );

      float facing = dot( terrainSun, Ng );
      if ( facing > 0.0 ) {
        vec2 toSun = ( terrainSun.xz - Ng.xz * facing ) / max( facing, 0.12 );
        float lit = 1.0;
        for ( int k = 1; k <= 4; k ++ ) {
          float rise = float( k ) * 0.25 * ( 1.0 - surface );
          float above = terrainHeight( i0, ( world + shift + toSun * depth * rise ) * tile, tdx, tdy, variation ) - surface - rise;
          lit = min( lit, 1.0 - clamp( above * 6.0, 0.0, 1.0 ) );
        }
        terrainSelfShadow = mix( 1.0, lit, detail * 0.85 );
      }
    }
  #endif

  vec2 at = world + shift;
  TerrainTap t0 = terrainTap( i0, at, dPx, dPy, variation, T, B, Ng );

  bool terrainLead = b0 > 0.0;
  TerrainTap t1;
  if ( b1 > 0.0 || ! terrainLead ) t1 = terrainTap( i1, at, dPx, dPy, variation, T, B, Ng );
  else { t1.albedo = vec4( 0.0 ); t1.normal = Ng; t1.rough = 0.0; t1.ao = 0.0; }
  TerrainTap t2;
  if ( b2 > 0.0 || ! terrainLead ) t2 = terrainTap( i2, at, dPx, dPy, variation, T, B, Ng );
  else { t2.albedo = vec4( 0.0 ); t2.normal = Ng; t2.rough = 0.0; t2.ao = 0.0; }

  float h0 = b0 + t0.albedo.a * 0.5 * smoothstep( 0.0, 0.15, b0 );
  float h1 = b1 + t1.albedo.a * 0.5 * smoothstep( 0.0, 0.15, b1 );
  float h2 = b2 + t2.albedo.a * 0.5 * smoothstep( 0.0, 0.15, b2 );
  float top = max( max( h0, h1 ), h2 ) - 0.1;
  float c0 = max( h0 - top, 0.0 ), c1 = max( h1 - top, 0.0 ), c2 = max( h2 - top, 0.0 );
  float cs = c0 + c1 + c2 + 1e-5;
  c0 /= cs; c1 /= cs; c2 /= cs;

  vec3 albedo = t0.albedo.rgb * c0 + t1.albedo.rgb * c1 + t2.albedo.rgb * c2;
  float height = t0.albedo.a * c0 + t1.albedo.a * c1 + t2.albedo.a * c2;
  terrainNormalOut = normalize( t0.normal * c0 + t1.normal * c1 + t2.normal * c2 );
  terrainRoughOut = t0.rough * c0 + t1.rough * c1 + t2.rough * c2;
  terrainAOOut = t0.ao * c0 + t1.ao * c1 + t2.ao * c2;

  vec4 macro = texture( terrainNoise, world / 2048.0 );
  albedo *= 0.86 + 0.28 * ( macro.g * 0.55 + broadNoise.r * 0.45 );

  float puddle = smoothstep( 0.55, 0.9, wet ) * ( 1.0 - smoothstep( 0.28, 0.45, height ) );
  albedo *= mix( 1.0, 0.56, wet );
  terrainRoughOut = mix( terrainRoughOut, 0.3, wet * 0.8 );
  terrainRoughOut = mix( terrainRoughOut, 0.05, puddle );
  terrainNormalOut = normalize( mix( terrainNormalOut, Ng, max( wet * 0.35, puddle ) ) );
  diffuseColor.rgb = albedo;
}
`

const materials = new Map<Quality, THREE.MeshStandardMaterial>()

export function terrainMaterial(quality: Quality) {
  let material = materials.get(quality)
  if (material) return material
  const { albedo, material: maps } = groundTextures()
  material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide })

  const parallax = quality === 'high' ? 10 : quality === 'balanced' ? 7 : 0
  material.defines = { TERRAIN_LAYERS: TERRAIN_LAYERS.length, TERRAIN_PARALLAX: parallax, TERRAIN_ANTITILE: 1, SUN_RING_SOLID: '' }
  material.customProgramCacheKey = () => `terrain-v2-${quality}`
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      terrainOrigin: worldUniforms.terrainOrigin,
      terrainAlbedo: { value: albedo },
      terrainMaterial: { value: maps },
      terrainNoise: { value: noiseTexture() },
      terrainTile: { value: TERRAIN_LAYERS.map((layer) => 1 / layer.tile) },
      terrainDepth: { value: TERRAIN_LAYERS.map((layer) => layer.depth) },
      terrainTriplanar: { value: TERRAIN_LAYERS.map((layer) => (layer.triplanar ? 1 : 0)) },
      terrainSun: { value: SUN_DIRECTION },
    })
    shader.vertexShader = `${VERTEX_PARS}\n${shader.vertexShader.replace('#include <project_vertex>', VERTEX_MAIN)}`
    shader.fragmentShader = `${FRAGMENT_PARS}\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', FRAGMENT_MAIN)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = terrainRoughOut;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize( ( viewMatrix * vec4( terrainNormalOut, 0.0 ) ).xyz ) * faceDirection;')
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
        'getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= terrainSelfShadow * clamp( abs( dot( geometryNormal, directLight.direction ) ) + 2.0 * terrainAOOut * terrainAOOut - 1.0, 0.0, 1.0 );',
      ))
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= terrainAOOut;\n\treflectedLight.indirectSpecular *= terrainAOOut;')
  }
  materials.set(quality, material)
  return material
}
