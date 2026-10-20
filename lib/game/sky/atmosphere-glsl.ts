import * as THREE from 'three'
import { ATMOSPHERE, FOG, SUN_DIRECTION } from '../atmosphere'

const float = (value: number) => {
  const text = value.toPrecision(7)
  return /[.e]/.test(text) ? text : `${text}.0`
}
const vec3 = (x: number, y: number, z: number) => `vec3( ${float(x)}, ${float(y)}, ${float(z)} )`

const linear = (hex: string, scale = 1) => {
  const color = new THREE.Color(hex)
  return vec3(color.r * scale, color.g * scale, color.b * scale)
}

export const ATMOSPHERE_GLSL =            `
#ifndef TWD_ATMOSPHERE
#define TWD_ATMOSPHERE
const vec3 ATMO_SUN_DIR = ${vec3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z)};
const vec3 ATMO_ZENITH = ${linear(ATMOSPHERE.skyTop)};
const vec3 ATMO_HORIZON = ${linear(ATMOSPHERE.skyHorizon)};
const vec3 ATMO_HAZE = ${linear(ATMOSPHERE.fog)};
const vec3 ATMO_GLOW = ${linear(ATMOSPHERE.sunGlow)};
const float ATMO_HAZE_DENSITY = ${float(FOG.hazeDensity)};
const float ATMO_HAZE_HEIGHT = ${float(FOG.hazeHeight)};
const float ATMO_GROUND_DENSITY = ${float(FOG.groundDensity)};
const float ATMO_GROUND_HEIGHT = ${float(FOG.groundHeight)};
const float ATMO_EDGE_START = ${float(FOG.edgeStart)};

float atmoLayer( float y, float dy, float dist, float base, float height, float density ) {
	float a = - max( ( y - base ) / height, -2.0 );
	float b = - max( ( y + dy * dist - base ) / height, -2.0 );
	float d = a - b;
	float mean = abs( d ) < 1e-3 ? exp( 0.5 * ( a + b ) ) : ( exp( a ) - exp( b ) ) / d;
	return density * dist * mean;
}

float atmoDepth( float y, vec3 dir, float dist, float floorY ) {
	return atmoLayer( y, dir.y, dist, floorY, ATMO_HAZE_HEIGHT, ATMO_HAZE_DENSITY )
		+ atmoLayer( y, dir.y, dist, floorY, ATMO_GROUND_HEIGHT, ATMO_GROUND_DENSITY );
}

float atmoDepthToSpace( float y, vec3 dir, float floorY ) {
	float rise = max( dir.y, 1e-4 );
	return ( ATMO_HAZE_DENSITY * ATMO_HAZE_HEIGHT * exp( - max( ( y - floorY ) / ATMO_HAZE_HEIGHT, -2.0 ) )
		+ ATMO_GROUND_DENSITY * ATMO_GROUND_HEIGHT * exp( - max( ( y - floorY ) / ATMO_GROUND_HEIGHT, -2.0 ) ) ) / rise;
}

vec3 atmoHaze( vec3 dir ) {
	float mu = dot( dir, ATMO_SUN_DIR );
	float toward = max( mu, 0.0 );
	float t2 = toward * toward;
	float t4 = t2 * t2;
	float t8 = t4 * t4;
	return ATMO_HAZE * ( 1.0 - 0.12 * max( - mu, 0.0 ) ) + ATMO_GLOW * ( t4 * 0.2 + t8 * t8 * 0.45 );
}

vec3 atmoClearSky( vec3 dir ) {
	float up = max( dir.y, 0.0 );
	float mu = dot( dir, ATMO_SUN_DIR );
	vec3 sky = mix( ATMO_HORIZON, ATMO_ZENITH, pow( up, 0.42 ) );

	sky *= 1.0 - 0.1 * ( 1.0 - mu * mu ) * up;

	float toward = max( mu, 0.0 );
	return sky + ATMO_GLOW * ( exp( ( toward - 1.0 ) * 6.0 ) * 0.1 + exp( ( toward - 1.0 ) * 60.0 ) * 0.32 );
}

vec3 atmoSky( vec3 dir, vec3 haze, float y, float floorY ) {
	if ( dir.y <= 0.0 ) return haze;
	return mix( atmoClearSky( dir ), haze, 1.0 - exp( - atmoDepthToSpace( y, dir, floorY ) ) );
}
#endif
`
