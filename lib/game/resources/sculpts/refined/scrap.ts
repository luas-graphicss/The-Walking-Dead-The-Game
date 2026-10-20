import { noise3, type V2, type V3 } from '../../../blockout/sculpt/kit'
import { fillet2, rrect, seeded, sweepRaw, type ResourceFamily } from '../forms'

const CONCRETE: V3 = [0.66, 0.65, 0.62], BRICK: V3 = [0.72, 0.4, 0.26], GLASS: V3 = [0.72, 0.8, 0.8], COPPER: V3 = [0.78, 0.46, 0.3]

const fractured = (amount: number, seed: number) => (face: number, s: number, t: number) => {
  const facet = (noise3(s * 14 + face * 3.1, t * 14, seed) - 0.5) * amount, grit = (noise3(s * 60, t * 60 + face, seed + 5) - 0.5) * amount * 0.25
  return face === 3 ? -Math.abs(facet) * 0.5 : facet + grit
}

const brickHoles: V2[][] = [-0.042, 0, 0.042].flatMap((x) => [-0.021, 0.021].map((y) => rrect(0.032, 0.026, 0.004, 3, x, y)))

export const SCRAP_REFINED: ResourceFamily = {
  'concrete-chunks': (k) => {

    k.box('concrete', [0.2, 0.11, 0.16], [-0.07, 0.056, -0.03], { yaw: 0.3, r: 0.008, seg: [10, 6, 8], disp: fractured(0.016, 2), tint: CONCRETE })
    k.box('concrete', [0.15, 0.09, 0.12], [0.1, 0.051, 0.06], { yaw: -0.5, roll: 0.08, r: 0.008, seg: [8, 5, 7], disp: fractured(0.014, 7), tint: CONCRETE })
    k.box('concrete', [0.1, 0.06, 0.09], [0.11, 0.032, -0.09], { yaw: 0.9, r: 0.006, seg: [6, 4, 5], disp: fractured(0.012, 11), tint: CONCRETE })
    const rng = seeded(17)
    for (let i = 0; i < 5; i++) { const s = 0.025 + rng() * 0.025; k.box('concrete', [s, s * 0.7, s * 0.85], [-0.16 + rng() * 0.34, s * 0.35 + 0.001, 0.08 + rng() * 0.06], { yaw: rng() * 3, r: 0.003, seg: [3, 2, 3], disp: fractured(0.006, 20 + i), tint: CONCRETE }) }
    const rebar = (path: V3[]) => k.put(sweepRaw(path, 0.005, { seg: 8, radius: (s) => 1 + 0.12 * Math.max(0, Math.cos(s * 620)) }), 'steel', { tint: [0.45, 0.32, 0.25] })
    rebar([[-0.11, 0.062, -0.05], [-0.19, 0.068, -0.045], [-0.235, 0.05, -0.02], [-0.25, 0.03, 0.0]])
    rebar([[-0.1, 0.075, 0.012], [-0.165, 0.088, 0.016], [-0.2, 0.108, 0.034], [-0.212, 0.132, 0.05]])
  },

  'broken-bricks': (k) => {

    const ragged = (len: number, seed: number) => (x: number, y: number, z: number): V3 => [0, 0, z > len / 2 - 0.004 ? (noise3(x * 60, y * 60, seed) - 0.5) * 0.045 - 0.012 : 0]
    k.extrude('brick', rrect(0.14, 0.09, 0.003), 0.17, [-0.065, 0.045, -0.01], { yaw: 0.25, holes: brickHoles, bevel: 0.0025, tint: BRICK, warp: ragged(0.17, 3) })
    k.extrude('brick', rrect(0.14, 0.09, 0.003), 0.09, [0.085, 0.045, 0.045], { yaw: -1.1, holes: brickHoles, bevel: 0.0025, tint: BRICK, warp: ragged(0.09, 8) })
    const rng = seeded(5)
    for (let i = 0; i < 5; i++) { const s = 0.02 + rng() * 0.03; k.box('brick', [s, s * 0.45, s * 0.8], [-0.12 + rng() * 0.26, s * 0.24, 0.07 + rng() * 0.02], { yaw: rng() * 3, r: 0.002, seg: [3, 2, 3], disp: fractured(0.005, 30 + i), tint: BRICK }) }
  },

  'glass-shards': (k) => {

    const rng = seeded(23)
    const shard = (r: number, n: number): V2[] => {
      const angles = Array.from({ length: n }, () => rng() * Math.PI * 2).sort((a, b) => a - b)
      return angles.map((a, i): V2 => { const rr = r * (i % 2 ? 0.45 + rng() * 0.3 : 0.8 + rng() * 0.45); return [Math.cos(a) * rr, Math.sin(a) * rr] })
    }
    const big: [number, number, number, number, number][] = [[-0.07, -0.04, 0.06, 0.4, 0], [0.05, -0.05, 0.055, 1.6, 0], [0.06, 0.06, 0.045, 2.4, 0], [-0.06, 0.055, 0.05, 3.3, 0], [-0.01, 0.0, 0.05, 0.9, 0.28]]
    for (const [x, z, r, yaw, tilt] of big) k.extrude('glass', fillet2(shard(r, 6), 0.0008, 1, true), 0.004, [x, tilt ? 0.013 : 0.002, z], { axis: 'y', yaw, pitch: tilt, bevel: 0.0004, tint: GLASS })
    for (let i = 0; i < 7; i++) k.extrude('glass', shard(0.012 + rng() * 0.01, 5), 0.003, [-0.11 + rng() * 0.22, 0.0015, -0.09 + rng() * 0.18], { axis: 'y', yaw: rng() * 6, bevel: 0.0003, tint: GLASS })
  },

  'copper-pipe': (k) => k.frame({ at: [0.036, 0, -0.014] }, () => {

    const y = 0.0105
    k.lathe('steel', [[0.0088, 0], [0.0105, 0], [0.0105, 0.512], [0.0088, 0.512], [0.0088, 0]], [-0.3, y, 0], { axis: 'x', seg: 32, tint: COPPER })
    k.torus('steel', 0.016, 0.0118, [0.2, y, 0.016], { seg: 16, segR: 20, arc: Math.PI / 2, tint: COPPER })
    for (const [at, axis] of [[[0.2, y, 0], 'x'], [[0.216, y, 0.016], 'z']] as const) k.lathe('steel', [[0.0105, -0.0035], [0.0124, -0.0035], [0.0124, 0.0005], [0.0105, 0.0005], [0.0105, -0.0035]], at as V3, { axis, seg: 32, tint: COPPER })
    k.lathe('paint', [[0.0105, 0], [0.0112, 0], [0.0112, 0.0012], [0.0105, 0.0012], [0.0105, 0]], [0.1953, y, 0], { axis: 'x', seg: 32, tint: [0.75, 0.72, 0.6] })
    k.lathe('steel', [[0.0088, 0], [0.0105, 0], [0.0105, 0.044], [0.0088, 0.044], [0.0088, 0]], [0.216, y, 0.012], { axis: 'z', seg: 32, tint: COPPER })
  }),
}
