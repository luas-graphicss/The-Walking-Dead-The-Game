import * as THREE from 'three'

export const ATMOSPHERE = {
  fog: '#bdbba3',
  fogDensity: 0.0007,
  skyTop: '#5b7fa6',

  skyHorizon: '#a3b6c6',

  sunGlow: '#ffd9a8',
  sun: '#ffd8a6',
  sunIntensity: 2.45,
  hemisphereSky: '#c8cebd',
  hemisphereGround: '#4c4535',
  hemisphereIntensity: 1.12,
  cloudLit: '#fff3e2',
  cloudShade: '#8a94a3',
  lakeShallow: '#62806b',
  lakeDeep: '#1d3a3b',
  riverDeep: '#2a3a2c',
  seaShallow: '#4f8f92',
  seaDeep: '#173f52',
  foam: '#eef2ee',

  waterBank: '#2e3527',
}

export const SKY_LIGHT = {

  brightness: 0.9,

  cloudCover: 0.35,

  groundAlbedo: '#74705a',
  groundSunlit: 0.75,

  overhead: 0.86,
  side: 0.5,
  enclosed: 0.8,

  foliage: 0.62,

  canopy: [0.04, 0.056, 0.017] as const,
  ceiling: [0.02, 0.018, 0.015] as const,
  facade: [0.1, 0.088, 0.07] as const,
}

export const FOG = {

  hazeDensity: 0.00056,
  hazeHeight: 320,
  groundDensity: 0.0007,
  groundHeight: 40,

  floorDrop: 15,

  edgeStart: 0.5,
}

export const CLOUDS = {
  base: 2_600,
  top: 4_100,

  coverage: 0.5,

  wind: [7.5, 2.8] as const,
}

export const SUN_OFFSET = new THREE.Vector3(-30, 24, -20)
export const SUN_DIRECTION = SUN_OFFSET.clone().normalize()

export const SUN_ANGULAR_DIAMETER = THREE.MathUtils.degToRad(0.53 * 1.4)
