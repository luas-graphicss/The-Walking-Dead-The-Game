export const LOD_FADE_SECONDS = 0.75

export const LOD_FADE_GLSL =            `
float lodFadeDither() {
  const float bayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  ivec2 cell = ivec2(mod(gl_FragCoord.xy, 4.0));
  return (bayer[cell.x + cell.y * 4] + 0.5) / 16.0;
}
bool lodFadeDiscard(float code) {
  if (code > 0.999 && code < 1.001) return false;
  float dither = lodFadeDither();
  return code < 1.0 ? dither >= code : dither < code - 1.0;
}
`

export const fadeIn = (t: number) => (t >= 1 ? 1 : Math.max(0, t))

export const fadeOut = (t: number) => (t <= 0 ? 1 : 1 + Math.min(1, t))
export const HIDDEN = 2
