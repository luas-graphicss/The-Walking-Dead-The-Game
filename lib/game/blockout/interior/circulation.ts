import { partBounds, type BlockPart } from '../types'
import type { Box2 } from './placer'

const RES = 0.1

const RADIUS = 0.38
const BAND_LOW = 0.245, BAND_HIGH = 2.05
const MIN_REACH = 40

export class Circulation {
  readonly nx: number
  readonly nz: number
  private blocked: Uint8Array
  private scratch: Uint8Array
  private visited: Int32Array
  private queue: Int32Array
  private generation = 0
  private zoneOf: Int16Array
  private zoneMin: number[] = []
  private zoneCount: number[] = []
  private required: number[] = []
  private root = -1

  constructor(readonly area: Box2, readonly floorY: number) {
    this.nx = Math.max(1, Math.ceil((area.x1 - area.x0) / RES))
    this.nz = Math.max(1, Math.ceil((area.z1 - area.z0) / RES))
    const n = this.nx * this.nz
    this.blocked = new Uint8Array(n).fill(1)
    this.scratch = new Uint8Array(n)
    this.visited = new Int32Array(n)
    this.queue = new Int32Array(n)
    this.zoneOf = new Int16Array(n).fill(-1)
  }

  private cx(i: number) { return this.area.x0 + ((i % this.nx) + 0.5) * RES }
  private cz(i: number) { return this.area.z0 + (Math.floor(i / this.nx) + 0.5) * RES }
  index(x: number, z: number) {
    const ix = Math.floor((x - this.area.x0) / RES), iz = Math.floor((z - this.area.z0) / RES)
    return ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz ? -1 : iz * this.nx + ix
  }

  addFloor(part: BlockPart) {
    const b = partBounds(part)
    if (Math.abs(b.max[1] - this.floorY) > 0.006) return
    const c = Math.cos(part.yaw), s = Math.sin(part.yaw), hw = part.size[0] / 2 - 0.04, hd = part.size[2] / 2 - 0.04
    this.forCells(b.min[0], b.max[0], b.min[2], b.max[2], (i, x, z) => {
      const dx = x - part.position[0], dz = z - part.position[2]
      if (Math.abs(c * dx - s * dz) <= hw && Math.abs(s * dx + c * dz) <= hd && this.blocked[i] === 1) this.blocked[i] = 0
    })
  }

  private forCells(x0: number, x1: number, z0: number, z1: number, fn: (i: number, x: number, z: number) => void) {
    const ix0 = Math.max(0, Math.floor((x0 - this.area.x0) / RES - 0.5)), ix1 = Math.min(this.nx - 1, Math.ceil((x1 - this.area.x0) / RES - 0.5))
    const iz0 = Math.max(0, Math.floor((z0 - this.area.z0) / RES - 0.5)), iz1 = Math.min(this.nz - 1, Math.ceil((z1 - this.area.z0) / RES - 0.5))
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const i = iz * this.nx + ix
      fn(i, this.area.x0 + (ix + 0.5) * RES, this.area.z0 + (iz + 0.5) * RES)
    }
  }

  private mark(target: Uint8Array, part: BlockPart) {
    const b = partBounds(part)
    if (b.max[1] <= this.floorY + BAND_LOW || b.min[1] >= this.floorY + BAND_HIGH) return 0
    let changed = 0
    const r2 = RADIUS * RADIUS
    this.forCells(b.min[0] - RADIUS, b.max[0] + RADIUS, b.min[2] - RADIUS, b.max[2] + RADIUS, (i, x, z) => {
      if (target[i]) return
      const dx = Math.max(b.min[0] - x, 0, x - b.max[0]), dz = Math.max(b.min[2] - z, 0, z - b.max[2])
      if (dx * dx + dz * dz <= r2) { target[i] = 2; changed++ }
    })
    return changed
  }

  commit(parts: BlockPart[]) { for (const part of parts) this.mark(this.blocked, part) }

  private anchor(x: number, z: number) {
    let best = -1, bestD = 0.36
    this.forCells(x - 0.6, x + 0.6, z - 0.6, z + 0.6, (i, cx, cz) => {
      const d = (cx - x) ** 2 + (cz - z) ** 2
      if (!this.blocked[i] && d < bestD) { bestD = d; best = i }
    })
    return best
  }

  setRoot(x: number, z: number) { this.root = this.anchor(x, z); return this.root >= 0 }
  require(x: number, z: number) { const i = this.anchor(x, z); if (i >= 0) this.required.push(i) }
  zone(box: Box2) {
    const id = this.zoneMin.length
    this.zoneMin.push(0); this.zoneCount.push(0)
    this.forCells(box.x0 + 0.01, box.x1 - 0.01, box.z0 + 0.01, box.z1 - 0.01, (i) => { this.zoneOf[i] = id })
  }

  private bfs(grid: Uint8Array) {
    const gen = ++this.generation, { nx, nz, visited, queue } = this
    this.zoneCount.fill(0)
    if (this.root < 0 || grid[this.root]) return gen
    let head = 0, tail = 0
    queue[tail++] = this.root; visited[this.root] = gen
    while (head < tail) {
      const i = queue[head++], ix = i % nx
      const zone = this.zoneOf[i]
      if (zone >= 0) this.zoneCount[zone]++
      if (ix + 1 < nx && !grid[i + 1] && visited[i + 1] !== gen) { visited[i + 1] = gen; queue[tail++] = i + 1 }
      if (ix > 0 && !grid[i - 1] && visited[i - 1] !== gen) { visited[i - 1] = gen; queue[tail++] = i - 1 }
      if (i + nx < nx * nz && !grid[i + nx] && visited[i + nx] !== gen) { visited[i + nx] = gen; queue[tail++] = i + nx }
      if (i - nx >= 0 && !grid[i - nx] && visited[i - nx] !== gen) { visited[i - nx] = gen; queue[tail++] = i - nx }
    }
    return gen
  }

  baseline() {
    const gen = this.bfs(this.blocked)
    this.required = this.required.filter((i) => this.visited[i] === gen)
    this.zoneMin = this.zoneCount.map((count) => Math.min(count, MIN_REACH))
  }

  allows(parts: BlockPart[]) {
    if (this.root < 0) return true
    this.scratch.set(this.blocked)
    let changed = 0
    for (const part of parts) changed += this.mark(this.scratch, part)
    if (!changed) return true
    const gen = this.bfs(this.scratch)
    if (this.visited[this.root] !== gen) return false
    for (const i of this.required) if (this.visited[i] !== gen) return false
    for (let z = 0; z < this.zoneMin.length; z++) if (this.zoneCount[z] < this.zoneMin[z]) return false
    return true
  }

  routes(): [number, number, number, number][] {
    if (this.root < 0) return []
    const { nx, nz, visited, queue, blocked } = this
    const parent = new Int32Array(nx * nz).fill(-1), distance = new Int32Array(nx * nz).fill(-1)
    const gen = ++this.generation
    let head = 0, tail = 0
    queue[tail++] = this.root; visited[this.root] = gen; distance[this.root] = 0
    while (head < tail) {
      const i = queue[head++], ix = i % nx
      for (const j of [ix + 1 < nx ? i + 1 : -1, ix > 0 ? i - 1 : -1, i + nx < nx * nz ? i + nx : -1, i - nx]) {
        if (j < 0 || blocked[j] || visited[j] === gen) continue
        visited[j] = gen; parent[j] = i; distance[j] = distance[i] + 1; queue[tail++] = j
      }
    }
    const targets = new Set(this.required.filter((i) => visited[i] === gen))
    const best = new Map<number, number>()
    for (let i = 0; i < nx * nz; i++) {
      const zone = this.zoneOf[i]
      if (zone < 0 || visited[i] !== gen) continue
      const current = best.get(zone)
      if (current === undefined || distance[i] > distance[current]) best.set(zone, i)
    }
    for (const i of best.values()) targets.add(i)
    const covered = new Uint8Array(nx * nz)
    covered[this.root] = 1
    const free = (x: number, z: number) => { const i = this.index(x, z); return i >= 0 && !blocked[i] }
    const sight = (a: number, b: number) => {
      const ax = this.cx(a), az = this.cz(a), bx = this.cx(b), bz = this.cz(b), steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.04)
      for (let s = 1; s < steps; s++) if (!free(ax + (bx - ax) * s / steps, az + (bz - az) * s / steps)) return false
      return true
    }
    const segments: [number, number, number, number][] = []
    for (const target of [...targets].sort((a, b) => distance[a] - distance[b])) {
      const path: number[] = []
      for (let i = target; i >= 0; i = parent[i]) { path.push(i); if (covered[i]) break }
      for (const i of path) covered[i] = 1
      if (path.length < 2) continue
      let anchor = 0
      while (anchor < path.length - 1) {
        let next = anchor + 1
        while (next + 1 < path.length && sight(path[anchor], path[next + 1])) next++
        segments.push([this.cx(path[anchor]), this.cz(path[anchor]), this.cx(path[next]), this.cz(path[next])])
        anchor = next
      }
    }
    return segments
  }
}
