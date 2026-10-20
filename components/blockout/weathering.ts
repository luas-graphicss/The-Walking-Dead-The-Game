import { Vector3, type WebGLProgramParametersWithUniforms } from 'three'
import { FLOOR_HEIGHT, FOUNDATION_HEIGHT, type Condition, type WeatherProfile } from '@/lib/game/blockout/types'

export const WEATHER_UNIFORMS = {
  uGrime: { value: 1 },
  uDust: { value: 1 },
  uSoot: { value: 0 },
  uMoss: { value: 0.6 },
  uRust: { value: 0.1 },
  uSplash: { value: 0.5 },
  uStreak: { value: 0.8 },
  uDamp: { value: 1 },
  uFade: { value: 0.6 },
  uSalt: { value: 0.15 },
  uOil: { value: 0 },
  uWTint: { value: new Vector3(0.36, 0.31, 0.23) },
  uWSeed: { value: new Vector3() },
  uWScale: { value: 1 },
  uFloorBase: { value: 0 },
  uFloorHeight: { value: 1000 },
}

export type WeatherKind = { kind: 'structure'; condition: Condition; profile?: WeatherProfile } | { kind: 'module' | 'resource'; broken: boolean }

const CONDITION: Record<Condition, { grime: number; dust: number; soot: number; moss: number; streak: number }> = {
  weathered: { grime: 1, dust: 1, soot: 0, moss: 1, streak: 1 },
  damaged: { grime: 1.12, dust: 1.2, soot: 0.06, moss: 0.95, streak: 1.1 },
  burned: { grime: 1.1, dust: 0.9, soot: 0.9, moss: 0.3, streak: 0.8 },
  ruined: { grime: 1.3, dust: 1.4, soot: 0.1, moss: 1.35, streak: 1.25 },
  leveled: { grime: 1.35, dust: 1.5, soot: 0.1, moss: 1.3, streak: 1.2 },
}
const MODULE: WeatherProfile = { grime: 0.9, dust: 0.9, soot: 0.03, moss: 0.45, rust: 0.15, splash: 0.2, streak: 0.6, damp: 0.6, fade: 0.5, salt: 0.1, oil: 0, tint: [0.36, 0.31, 0.23], scale: 1, seed: [0, 0, 0] }

const RESOURCE: WeatherProfile = { grime: 0.3, dust: 0.35, soot: 0, moss: 0, rust: 0.02, splash: 0, streak: 0.08, damp: 0.05, fade: 0.15, salt: 0, oil: 0, tint: [0.36, 0.31, 0.23], scale: 1, seed: [0, 0, 0] }

export function applyWeather(target: WeatherKind) {
  const base = target.kind === 'structure' ? target.profile ?? MODULE : target.kind === 'resource' ? RESOURCE : MODULE
  const k = target.kind === 'structure' ? CONDITION[target.condition] : target.broken ? { grime: 1.2, dust: 1.25, soot: 0.04, moss: 1.2, streak: 1.1 } : { grime: 1, dust: 1, soot: 0, moss: 1, streak: 1 }
  const u = WEATHER_UNIFORMS
  u.uGrime.value = base.grime * k.grime
  u.uDust.value = base.dust * k.dust
  u.uSoot.value = Math.min(1, base.soot + k.soot)
  u.uMoss.value = base.moss * k.moss
  u.uStreak.value = base.streak * k.streak
  u.uRust.value = base.rust
  u.uSplash.value = base.splash
  u.uDamp.value = base.damp
  u.uFade.value = base.fade
  u.uSalt.value = base.salt
  u.uOil.value = base.oil
  u.uWTint.value.set(...base.tint)
  u.uWSeed.value.set(...base.seed)
  u.uWScale.value = base.scale
  u.uFloorBase.value = target.kind === 'structure' ? FOUNDATION_HEIGHT : 0
  u.uFloorHeight.value = target.kind === 'structure' ? FLOOR_HEIGHT : 1000
}

const NOISE =            `
uniform float uGrime;
uniform float uDust;
uniform float uSoot;
uniform float uMoss;
uniform float uRust;
uniform float uSplash;
uniform float uStreak;
uniform float uDamp;
uniform float uFade;
uniform float uSalt;
uniform float uOil;
uniform vec3 uWTint;
uniform vec3 uWSeed;
uniform float uWScale;
uniform float uFloorBase;
uniform float uFloorHeight;
varying vec3 vWeatherPos;
varying vec3 vWeatherNormal;
float wHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float wNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(wHash(i), wHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(wHash(i + vec3(0.0, 1.0, 0.0)), wHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(wHash(i + vec3(0.0, 0.0, 1.0)), wHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(wHash(i + vec3(0.0, 1.0, 1.0)), wHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float wFbm(vec3 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 4; i++) { sum += amp * wNoise(p); p = p * 2.03 + vec3(17.1, 3.7, 9.2); amp *= 0.5; }
  return sum / 0.9375;
}
`

const ALBEDO =            `
vec3 rp = vWeatherPos;
vec3 wp = rp * uWScale + uWSeed;
vec3 wn = normalize(vWeatherNormal);
float wUp = wn.y;
float wSide = 1.0 - abs(wUp);
float hb = rp.y < uFloorBase ? 0.0 : mod(rp.y - uFloorBase, uFloorHeight);
float hg = max(rp.y - uFloorBase, 0.0);
float nBig = wFbm(wp * 0.42 + vec3(3.1, 7.7, 1.3));
float nMid = wFbm(wp * 1.85 + vec3(11.0, 2.0, 5.0));
float nFine = wNoise(wp * 9.0);
float nGrit = wNoise(wp * 38.0);
float g = clamp(uGrime, 0.0, 1.4);
float tide = (0.22 + nMid * 0.7) * uDamp;
float rising = uDamp > 0.01 ? 1.0 - smoothstep(tide * 0.4, tide + 0.01, hb) : 0.0;
float hcoord = (wp.x + wp.z) * 6.5;
float topRun = 0.55 + 0.75 * smoothstep(1.2, 2.9, hb);
float streak = smoothstep(0.45, 0.85, wNoise(vec3(hcoord, wp.y * 0.45, 1.7)) * 0.7 + nBig * 0.45) * wSide * topRun;
streak *= smoothstep(0.15, 0.6, wNoise(vec3(hcoord * 0.21, wp.y * 0.11, 4.3))) * uStreak;
float stain = smoothstep(0.42, 0.74, nBig);
float patchy = smoothstep(0.55, 0.82, nMid);
float cavity = 0.0;
#ifdef USE_AOMAP
  cavity = 1.0 - texture2D(aoMap, vAoMapUv).r;
#endif
float underside = smoothstep(0.2, 0.9, -wUp);
float grime = clamp((rising * 0.9 + streak * 0.95 + stain * 0.45 + patchy * 0.3 + cavity * 1.6 + underside * 0.4) * g, 0.0, 1.0);
vec3 grimeTint = uWTint * mix(1.0, 0.78, nMid);
float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
float fade = clamp(uFade * (0.45 + nBig * 0.7), 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(1.04, 1.0, 0.93), fade * 0.42);
diffuseColor.rgb *= mix(1.0, 0.8 + nFine * 0.12 + nGrit * 0.08, min(g, 1.0) * 0.8);
diffuseColor.rgb *= mix(1.0, 0.8, smoothstep(0.45, 0.95, lum) * min(g, 1.0) * 0.55);
vec3 blotch = mix(vec3(1.0), mix(vec3(0.84), grimeTint * 2.2, 0.5), smoothstep(0.4, 0.72, nBig));
diffuseColor.rgb *= mix(vec3(1.0), blotch, min(g, 1.0) * 0.75);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * grimeTint * 2.0, grime * 0.85);
float splash = (1.0 - smoothstep(0.04, 0.28 + nMid * 0.4, hg)) * smoothstep(0.3, 0.72, nFine * 0.55 + nGrit * 0.55) * wSide * uSplash;
diffuseColor.rgb = mix(diffuseColor.rgb, uWTint * (0.75 + nFine * 0.45), clamp(splash, 0.0, 1.0) * 0.8);
float waterStain = (smoothstep(0.6, 0.64, nBig + nFine * 0.05) - smoothstep(0.64, 0.74, nBig)) * g;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * mix(vec3(0.62, 0.52, 0.36), grimeTint * 1.7, 0.4), waterStain * (wSide + underside) * 0.7);
float rust = smoothstep(0.6, 0.9, wNoise(vec3(hcoord * 1.9, rp.y * 0.32, 8.1)) * 0.7 + nBig * 0.4) * wSide * uRust * (0.4 + topRun * 0.6);
rust = max(rust, smoothstep(0.66, 0.86, nMid + nGrit * 0.2) * uRust * 0.5);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.19, 0.08) * (0.7 + nFine * 0.5), clamp(rust, 0.0, 1.0) * 0.75);
float salt = smoothstep(0.52, 0.8, nMid + nFine * 0.25) * (1.0 - smoothstep(0.15, 1.3, hb)) * wSide * uSalt;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.85, 0.8), clamp(salt, 0.0, 1.0) * 0.55);
float moss = smoothstep(0.58, 0.86, nMid * 0.7 + rising * 0.42 + stain * 0.22) * wSide * uMoss;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.15, 0.18, 0.1) * (0.75 + nFine * 0.5), clamp(moss, 0.0, 1.0) * 0.65);
float soot = clamp(uSoot * (0.35 + smoothstep(0.3, 2.6, hb) * 0.75 + underside * 0.4) * (0.5 + nBig * 0.8), 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.032, 0.03, 0.028), soot * 0.88);
float wFlat = smoothstep(0.9, 0.995, wUp);
float roofAge = smoothstep(0.55, 0.9, wUp) * (1.0 - wFlat);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.78, 0.74), roofAge * (0.25 + nBig * 0.35) * g);
float oil = clamp(smoothstep(0.56, 0.8, nBig * 0.75 + nFine * 0.35) * (wFlat + wSide * (1.0 - smoothstep(0.0, 0.5, hb)) * 0.4) * uOil, 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.04, 0.035), oil * 0.7);
float dust = clamp(wFlat * (0.45 + nMid * 0.8) * uDust + nGrit * 0.1 * uDust * step(0.3, wUp), 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.37, 0.34, 0.29), uWTint * 1.15, 0.35) * (0.85 + nFine * 0.25), dust * 0.45);
float puddle = smoothstep(0.55, 0.62, nBig * 0.8 + nMid * 0.35) * wFlat * g;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.45, 0.42, 0.36), puddle * 0.4);
float lichen = smoothstep(0.7, 0.86, nMid + nFine * 0.15) * wFlat * uMoss;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.22, 0.13) * (0.8 + nGrit * 0.4), clamp(lichen, 0.0, 1.0) * 0.3);
float weatherRough = max(dust, grime * 0.75);
`

const SURFACE =            `
roughnessFactor = mix(roughnessFactor, 1.0, clamp(weatherRough * 0.85 + soot * 0.5 + rust * 0.4, 0.0, 1.0));
roughnessFactor = mix(roughnessFactor, 0.32, oil * 0.6);
metalnessFactor *= clamp(1.0 - dust * 0.8 - grime * 0.3 - soot * 0.4 - rust * 0.7, 0.0, 1.0);
`

export function weatherShader(shader: WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, WEATHER_UNIFORMS)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWeatherPos;\nvarying vec3 vWeatherNormal;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvWeatherPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWeatherNormal = normalize(mat3(modelMatrix) * objectNormal);')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${NOISE}`)
    .replace('#include <color_fragment>', `#include <color_fragment>\n${ALBEDO}`)
    .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${SURFACE}`)
}

export const weatherCacheKey = () => 'workshop-weather-v3'
