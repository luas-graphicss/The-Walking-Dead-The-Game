import { Vector3 } from 'three'
import { Raw, type V3 } from '../../blockout/sculpt/kit'

export function helmetShell(rx: number, h: number, rz: number, wall: number, frontCut = 0, fullFace = false) {
  const raw = new Raw(), seg = 64, rows = 20, rings: number[][][] = [], rim: V3[] = []
  for (let side = 0; side < 2; side++) {
    const grid: number[][] = [], rX = rx - side * wall, rZ = rz - side * wall, hh = h * (fullFace ? 0.53 : 1) - side * wall, centerY = fullFace ? h * 0.47 : 0
    const sign = side ? -1 : 1
    for (let i = 0; i <= rows; i++) {
      const row: number[] = []
      for (let j = 0; j <= seg; j++) {
        const a = j / seg * Math.PI * 2, front = Math.max(0, Math.sin(a))
        const transition = Math.max(0, Math.min(1, (front - 0.28) / 0.27))
        const cut = fullFace ? transition * transition * (3 - 2 * transition) : front ** 6
        const theta = ((fullFace ? 2.68 : Math.PI / 2) - frontCut * cut) * i / rows
        const rib = side ? 0 : 0.0012 * Math.exp(-((Math.cos(a) / 0.1) ** 2)) * Math.sin(theta)
        const x = (rX + rib) * Math.sin(theta) * Math.cos(a), y = 0.004 + centerY + hh * Math.cos(theta), z = (rZ + rib) * Math.sin(theta) * Math.sin(a)
        row.push(raw.v(x, y, z, sign * Math.sin(theta) * Math.cos(a) / rX, sign * Math.cos(theta) / hh, sign * Math.sin(theta) * Math.sin(a) / rZ, a * rx, theta * h, side ? 0.58 : 1))
        if (side === 0 && i === rows && j < seg) rim.push([x, y, z])
      }
      grid.push(row)
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) raw.quad(grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j])
    rings.push(grid)
  }
  for (let j = 0; j < seg; j++) raw.quad(rings[0][rows][j], rings[1][rows][j], rings[1][rows][j + 1], rings[0][rows][j + 1])
  return { raw: raw.smooth(65), rim }
}

export function leafRaw(length: number, width: number, bend: number) {
  const raw = new Raw(), n = 14, cols = 6
  for (let i = 0; i <= n; i++) for (let j = 0; j <= cols; j++) {
    const t = i / n, s = j / cols * 2 - 1, w = width * Math.sin(Math.PI * t) ** 0.8
    raw.v(s * w, length * t, bend * t * t + Math.abs(s) * w * 0.24 + 0.0015 * Math.sin(t * 30) * s, 0, -2 * bend * t / length, 1, s * width, t * length)
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < cols; j++) { const a = i * (cols + 1) + j; raw.quad(a, a + 1, a + cols + 2, a + cols + 1) }
  return raw.smooth(75)
}

export function fractureRaw(w: number, h: number, d: number, seed: number, sides = 9) {
  const raw = new Raw(), rings: number[][] = [], random = (n: number) => { const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x) }
  const levels = [0, 0.18, 0.68, 1], radii = [0.68, 1, 0.83, 0.4]
  for (let i = 0; i < levels.length; i++) {
    const ring: number[] = []
    for (let j = 0; j < sides; j++) {
      const a = j / sides * Math.PI * 2, rr = radii[i] * (0.75 + 0.25 * random(j * 3 + i))
      const y = h * (i === 0 ? 0 : levels[i] + (random(j + i * 20) - 0.5) * 0.1)
      ring.push(raw.v(Math.cos(a) * w * 0.5 * rr, y, Math.sin(a) * d * 0.5 * rr, Math.cos(a), i === 0 ? -0.6 : 0.3, Math.sin(a), a * w * 0.5, y, 0.8 + random(j + i) * 0.2))
    }
    rings.push(ring)
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < sides; j++) raw.quad(rings[i][j], rings[i][(j + 1) % sides], rings[i + 1][(j + 1) % sides], rings[i + 1][j])
  for (const [i, sign] of [[0, -1], [3, 1]]) {
    const c = raw.v(0, levels[i] * h, 0, 0, sign, 0, 0, 0)
    for (let j = 0; j < sides; j++) raw.tri(c, rings[i][j], rings[i][(j + 1) % sides])
  }
  const unwrapped = new Raw()
  for (let i = 0; i < raw.i.length; i += 3) {
    const ids = raw.i.slice(i, i + 3)
    const p = ids.map((id) => new Vector3(raw.p[id * 3], raw.p[id * 3 + 1], raw.p[id * 3 + 2]))
    const u = p[1].clone().sub(p[0]).normalize(), n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize(), v = n.clone().cross(u)
    const corners = p.map((point, j) => unwrapped.v(point.x, point.y, point.z, n.x, n.y, n.z, point.dot(u), point.dot(v), raw.c[ids[j]]))
    unwrapped.tri(corners[0], corners[1], corners[2])
  }
  return unwrapped
}
