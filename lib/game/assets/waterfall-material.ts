import * as THREE from 'three'
import { ATMOSPHERE, SUN_DIRECTION } from '../atmosphere'
import { isMobileDevice } from '../device'
import { noiseTexture } from './noise-texture'
import { worldUniforms } from './terrain-material'

export const waterfallUniforms = {
  pour: { value: new THREE.Vector4() },
  pourDir: { value: new THREE.Vector2(1, 0) },
}

const vertexShader =            `
#include <common>
#include <fog_pars_vertex>
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vScene;
varying vec4 vFall;
varying vec2 vAcross;
void main() {
  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  vScene = worldPosition.xyz;
  vView = cameraPosition - worldPosition.xyz;
  vNormal = normalize( mat3( modelMatrix ) * normal );
  #ifdef USE_COLOR_ALPHA
    vFall = color;
  #else
    vFall = vec4( color.rgb, 0.0 );
  #endif
  vAcross = uv;
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const fragmentShader =            `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D noiseMap;
uniform float time;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform float sunIntensity;
uniform vec3 zenithColor;
uniform vec3 horizonColor;
uniform vec3 ambientColor;
uniform vec3 bodyColor;
uniform vec3 foamColor;
uniform vec4 pour;
uniform vec2 pourDir;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vScene;
varying vec4 vFall;
varying vec2 vAcross;

const float LIP_SPEED = 1.6;

float fallTime( float drop ) {
  return ( sqrt( LIP_SPEED * LIP_SPEED + 19.62 * max( drop, 0.0 ) ) - LIP_SPEED ) / 9.81;
}

vec3 ribbons( float across, float clock ) {
  float tongues = texture2D( noiseMap, vec2( across / 8.0, clock * 0.35 - fract( time * 0.35 ) ) ).r;
  float strands = texture2D( noiseMap, vec2( across / 3.2 + 0.37, clock * 0.8 - fract( time * 0.8 ) ) ).g;
  #ifdef FALL_LITE
    float threads = strands;
  #else
    float threads = texture2D( noiseMap, vec2( across / 0.8 + 0.71, clock * 1.9 - fract( time * 1.9 ) ) ).a;
  #endif
  return vec3( tongues, strands, threads );
}

vec3 relief( vec3 position, vec3 normal, float height ) {
  vec3 sigmaX = dFdx( position ), sigmaY = dFdy( position );
  vec3 r1 = cross( sigmaY, normal ), r2 = cross( normal, sigmaX );
  float det = dot( sigmaX, r1 );
  vec3 gradient = sign( det ) * ( dFdx( height ) * r1 + dFdy( height ) * r2 );
  return normalize( abs( det ) * normal - gradient );
}

void main() {
  float depth = vFall.x, drop = vFall.y, rest = vFall.z, turn = vFall.w;
  float clock = fallTime( drop );
  vec3 sheet;
  if ( turn < 0.01 ) sheet = ribbons( vAcross.x, clock );
  else if ( turn > 0.99 ) sheet = ribbons( vAcross.y, clock );
  else sheet = mix( ribbons( vAcross.x, clock ), ribbons( vAcross.y, clock ), turn );
  float body = sheet.x * 0.55 + sheet.y * 0.3 + sheet.z * 0.15;

  float aerated = smoothstep( 0.0, 3.5, drop );
  float white = smoothstep( 0.68 - 0.42 * aerated, 0.86 - 0.3 * aerated, body );
  white = max( white, smoothstep( 0.8, 0.95, sheet.z ) * ( 0.3 + 0.7 * aerated ) );
  float churn = 1.0 - smoothstep( 0.0, 2.2, rest );
  white = max( white, churn * ( 0.55 + 0.45 * sheet.z ) );

  float lee = 0.0;
  if ( pour.w > 0.0 ) {
    vec2 offset = vScene.xz - pour.xz;
    float near = pour.w * ( 1.0 - smoothstep( 1.5, 4.5, abs( vScene.y - pour.y ) ) );
    float burst = ( 1.0 - smoothstep( 0.3, 1.2, length( offset ) ) ) * near;
    float along = dot( offset, pourDir );
    float side = abs( offset.x * pourDir.y - offset.y * pourDir.x );
    lee = ( 1.0 - smoothstep( 0.2, 0.55, side ) ) * smoothstep( 0.3, 0.9, along ) * ( 1.0 - smoothstep( 1.6, 4.0, along ) ) * near;
    white = max( white, burst * ( 0.65 + 0.35 * sheet.z ) );
  }

  vec3 N = normalize( vNormal );
  if ( ! gl_FrontFacing ) N = - N;
  #ifndef FALL_LITE
    N = relief( vScene, N, body * 0.09 );
  #endif
  vec3 V = normalize( vView );
  vec3 L = sunDirection;
  vec3 sun = sunColor * sunIntensity;
  float NdV = clamp( abs( dot( N, V ) ), 0.0, 1.0 );
  float NdL = dot( N, L );
  float fresnel = 0.02 + 0.98 * pow( 1.0 - NdV, 5.0 );
  vec3 R = reflect( - V, N );
  vec3 sky = mix( horizonColor, zenithColor, sqrt( max( R.y, 0.0 ) ) );

  vec3 glass = bodyColor * ( ambientColor * 0.55 + sun * 0.25 * max( NdL, 0.0 ) ) + sky * fresnel;
  vec3 H = normalize( L + V );
  glass += sun * pow( max( dot( N, H ), 0.0 ), 220.0 ) * 1.6;

  float wrap = clamp( ( NdL + 0.6 ) / 1.6, 0.0, 1.0 );
  float through = pow( clamp( dot( V, - L ), 0.0, 1.0 ), 3.0 );
  vec3 foam = foamColor * ( ambientColor * 0.8 + sun * ( 0.12 + 0.5 * wrap + 0.3 * through ) ) * ( 0.8 + 0.2 * sheet.y );

  vec3 color = mix( glass, foam, white );
  float alpha = mix( 0.62 + 0.33 * fresnel, 0.97, white ) * smoothstep( 0.0, 0.35, depth );
  alpha *= 1.0 - 0.6 * lee * ( 1.0 - white );
  gl_FragColor = vec4( color, alpha );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

let material: THREE.ShaderMaterial | null = null

export function waterfallMaterial() {
  if (material) return material
  const color = (hex: string) => new THREE.Color(hex)
  material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      sunDirection: { value: SUN_DIRECTION.clone() },
      sunColor: { value: color(ATMOSPHERE.sun) },
      sunIntensity: { value: ATMOSPHERE.sunIntensity },
      zenithColor: { value: color(ATMOSPHERE.skyTop) },
      horizonColor: { value: color(ATMOSPHERE.fog) },
      ambientColor: { value: color(ATMOSPHERE.hemisphereSky).multiplyScalar(ATMOSPHERE.hemisphereIntensity) },
      bodyColor: { value: color(ATMOSPHERE.riverDeep) },
      foamColor: { value: color(ATMOSPHERE.foam) },
    }]),
    vertexShader, fragmentShader,
    defines: isMobileDevice() ? { FALL_LITE: '' } : {},
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  })

  Object.assign(material.uniforms, {
    noiseMap: { value: noiseTexture() },
    time: worldUniforms.time,
    pour: waterfallUniforms.pour,
    pourDir: waterfallUniforms.pourDir,
  })
  return material
}
