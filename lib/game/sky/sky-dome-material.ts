import * as THREE from 'three'
import { ATMOSPHERE } from '../atmosphere'
import { ATMOSPHERE_GLSL } from './atmosphere-glsl'
import { CLOUD_SAMPLE_GLSL, cloudUniforms } from './clouds'
import { atmosphereUniforms } from './fog'

const SUN_RADIUS = THREE.MathUtils.degToRad(0.75)
const sun = new THREE.Color(ATMOSPHERE.sun).multiplyScalar(9)

const vertexShader =            `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize( position );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

const fragmentShader =            `
  uniform float fogFloor;
  varying vec3 vDirection;
  ${ATMOSPHERE_GLSL}
  ${CLOUD_SAMPLE_GLSL}
  const vec3 SUN_DISC = vec3( ${sun.r.toFixed(4)}, ${sun.g.toFixed(4)}, ${sun.b.toFixed(4)} );
  const float SUN_RADIUS = ${SUN_RADIUS.toFixed(6)};

  void main() {
    vec3 dir = normalize( vDirection );
    float y = cameraPosition.y;
    vec3 haze = atmoHaze( dir );
    vec3 sky = atmoSky( dir, haze, y, fogFloor );

    float mu = dot( dir, ATMO_SUN_DIR );
    float r = sqrt( max( 2.0 * ( 1.0 - mu ), 0.0 ) ) / SUN_RADIUS;
    float limb = 1.0 - 0.6 * ( 1.0 - sqrt( max( 1.0 - r * r, 0.0 ) ) );
    float through = exp( - atmoDepthToSpace( y, ATMO_SUN_DIR, fogFloor ) );
    vec3 sun = SUN_DISC * ( 1.0 - smoothstep( 0.9, 1.0, r ) ) * limb * through;
    sun += ATMO_GLOW * ( exp( ( mu - 1.0 ) * 4000.0 ) * 0.9 + exp( ( mu - 1.0 ) * 500.0 ) * 0.22 ) * through;

    if ( dir.y > -0.06 ) {

      vec4 clouds = cloudSample( dir );
      float veil = 1.0 - exp( - atmoDepth( y, dir, cloudDistance( dir ), fogFloor ) );
      sky = sky * ( 1.0 - clouds.a ) + mix( clouds.rgb, haze * clouds.a, veil );
      sun *= ( 1.0 - clouds.a ) * ( 1.0 - clouds.a );
    }

    gl_FragColor = vec4( sky + sun, 1.0 );
    #include <colorspace_fragment>

    gl_FragColor.rgb += ( fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5 ) / 255.0;
  }
`

export function skyDomeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...cloudUniforms, fogFloor: atmosphereUniforms.fogFloor },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  })
}
