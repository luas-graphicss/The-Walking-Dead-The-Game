import type { ModelBuilder } from './model'
import { transformPoint, type BlockPart, type Condition, type MaterialKey, type Vec3 } from './types'
import type { Band, Sash, Style } from './style'

export type OpeningKind = 'window' | 'door' | 'storefront' | 'roll' | 'shopdoor'
export type Opening = { x0: number; x1: number; y0: number; y1: number; kind: OpeningKind; leaves?: 0 | 1 | 2; open?: number }
export type Run = { origin: Vec3; yaw: number; out: 1 | -1; length: number; height: number; level: number; material: MaterialKey; tint?: Vec3; relief?: 'siding' | 'battens' | 'flat'; lower?: { material: MaterialKey; tint: Vec3; height: number }; stripes?: Band[]; lining?: { material?: MaterialKey; tint?: Vec3 } }
export type EdgeRole = 'entrance' | 'windows' | 'high' | 'storefront' | 'storefront-entrance' | 'loading' | 'solid' | 'balcony'
export type DressOptions = { style: Style; condition: Condition; burned: boolean; rng: () => number }

const WALL = 0.1
const GLASS: Vec3 = [1.1, 1.18, 1.22]

export function planOpenings(role: EdgeRole, length: number, height: number, style: Style, rng: () => number, door = 1.2): Opening[] {
  const half = length / 2, w = style.window
  if (role === 'solid') return []
  if (role === 'loading') {
    const width = Math.min(length - 1, 3.4)
    return [{ x0: -width / 2, x1: width / 2, y0: 0, y1: Math.min(3.6, height - 0.55), kind: 'roll', open: rng() < 0.4 ? 0.3 + rng() * 0.3 : 0 }]
  }
  if (role === 'entrance') return [{ x0: -door / 2, x1: door / 2, y0: 0, y1: Math.min(2.3, height - 0.5), kind: 'door', leaves: door > 1.5 ? 2 : 1 }]
  if (role === 'balcony') return [{ x0: -0.55, x1: 0.55, y0: 0, y1: Math.min(2.2, height - 0.5), kind: 'door', leaves: 0 }]
  if (role === 'storefront' || role === 'storefront-entrance') {
    const roll = style.storefront === 'roll', top = Math.min(roll ? height - 0.95 : 2.55, height - 0.6), bottom = roll ? 0 : 0.45
    if (role === 'storefront') return [{ x0: -half + 0.35, x1: half - 0.35, y0: bottom, y1: top, kind: roll ? 'roll' : 'storefront', open: roll ? (rng() < 0.5 ? 0 : 0.4 + rng() * 0.8) : undefined }]
    const list: Opening[] = [{ x0: -door / 2, x1: door / 2, y0: 0, y1: top, kind: roll ? 'roll' : 'shopdoor', open: roll ? 1 : undefined }]
    for (const side of [-1, 1]) {
      const inner = door / 2 + 0.3, outer = half - 0.35
      if (outer - inner < 0.8) continue
      list.push({ x0: side < 0 ? -outer : inner, x1: side < 0 ? -inner : outer, y0: bottom, y1: top, kind: roll ? 'roll' : 'storefront', open: roll ? (rng() < 0.6 ? 0 : 0.3 + rng() * 0.5) : undefined })
    }
    return list
  }
  const high = role === 'high'
  const width = high ? Math.min(w.width > 1.6 ? w.width : 1.8, length - 1.4) : w.width
  const sill = high ? Math.max(w.sill, height - 1.3) : w.sill
  const tall = Math.min(high ? 0.75 : w.height, height - sill - (w.pediment ? 0.52 : 0.42))
  if (tall < 0.45 || width < 0.5) return []
  const shutter = w.shutters && !high ? Math.min(0.46, tall * 0.34) + 0.03 : 0
  const footprint = width + 2 * ((w.casing ? 0.07 : w.grille ? 0.03 : 0.01) + shutter)
  let count = 0
  for (let n = 1; n <= (high ? 1 : w.max); n++) if (length / n >= footprint + 0.6) count = n
  return Array.from({ length: count }, (_, i) => {
    const center = -half + (i + 0.5) * length / count
    return { x0: center - width / 2, x1: center + width / 2, y0: sill, y1: sill + tall, kind: 'window' as const }
  })
}

type Local = { box: (size: Vec3, x: number, y: number, z: number, material: MaterialKey, name: string, tint?: Vec3, role?: BlockPart['role']) => BlockPart; prism: (points: [number, number][], depth: number, z: number, material: MaterialKey, name: string, tint?: Vec3) => BlockPart }
function local(b: ModelBuilder, run: Run): Local {
  return {
    box: (size, x, y, z, material, name, tint, role = 'fixture') => {
      const part = b.box(size, transformPoint([x, y, z], run.origin, run.yaw), material, role, run.yaw, run.level, name)
      if (tint) part.tint = tint
      return part
    },
    prism: (points, depth, z, material, name, tint) => {
      const part = b.prism(points, depth, z, material, 'fixture', name, run.level)
      part.position = transformPoint(part.position, run.origin, run.yaw)
      part.yaw = run.yaw
      if (tint) part.tint = tint
      return part
    },
  }
}

export function wallPanels(b: ModelBuilder, run: Run, openings: Opening[], name = 'exterior-wall') {
  const L = local(b, run), half = run.length / 2, H = run.height
  const stripes = (run.stripes ?? []).map((s) => ({ ...s, y0: s.y0 < 0 ? H + s.y0 : s.y0, y1: s.y1 <= 0 ? H + s.y1 : s.y1 })).filter((s) => s.y0 >= 0 && s.y1 <= H + 1e-6 && s.y1 - s.y0 > 0.02)
  const cuts = [...(run.lower ? [run.lower.height] : []), ...stripes.flatMap((s) => [s.y0, s.y1])]

  const bandMaterial: MaterialKey = run.material === 'steel' || run.material === 'concrete' || run.material === 'wood' ? run.material : 'plaster'
  const piece = (x0: number, x1: number, y0: number, y1: number) => {
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return
    const inner = cuts.filter((v) => v > y0 + 0.01 && v < y1 - 0.01).sort((p, q) => p - q).filter((v, i, list) => i === 0 || v - list[i - 1] > 0.005)
    const marks = [y0, ...inner, y1]
    for (let i = 0; i < marks.length - 1; i++) {
      const a = marks[i], c = marks[i + 1], mid = (a + c) / 2
      const stripe = stripes.find((s) => mid > s.y0 && mid < s.y1), lower = !stripe && Boolean(run.lower && mid < run.lower.height)
      const material = stripe ? stripe.material ?? bandMaterial : lower ? run.lower!.material : run.material
      const tint = stripe ? stripe.tint : lower ? run.lower!.tint : run.tint
      const part = L.box([x1 - x0, c - a, 0.2], (x0 + x1) / 2, (a + c) / 2, 0, material, name, tint, 'wall')
      if (run.relief && !lower && material === run.material) part.relief = { kind: run.relief, side: run.out }
      if (run.lining) part.finishes = [{ axis: [0, 0, -run.out], ...run.lining }]
    }
  }
  const sorted = [...openings].sort((a, c) => a.x0 - c.x0)
  let cursor = -half
  for (const o of sorted) {
    piece(cursor, o.x0, 0, H)
    if (o.y0 > 0.01) piece(o.x0, o.x1, 0, o.y0)
    if (H - o.y1 > 0.01) piece(o.x0, o.x1, o.y1, H)
    cursor = o.x1
  }
  piece(cursor, half, 0, H)
}

function glazing(condition: Condition, rng: () => number) {
  const keep = condition === 'weathered' ? 0.86 : condition === 'damaged' ? 0.45 : condition === 'burned' ? 0.08 : 0
  return () => rng() < keep
}

export function dressWindow(b: ModelBuilder, run: Run, o: Opening, opts: DressOptions) {
  const { style, burned, rng } = opts, L = local(b, run), out = run.out
  const trimM: MaterialKey = burned ? 'charcoal' : style.trim.material, trimT = burned ? undefined : style.trim.tint
  const w = o.x1 - o.x0, h = o.y1 - o.y0, cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2
  const fw = 0.06, fd = 0.1, fz = out * (WALL - 0.035 - fd / 2)
  L.box([fw, h, fd], o.x0 + fw / 2, cy, fz, trimM, 'window-jamb', trimT)
  L.box([fw, h, fd], o.x1 - fw / 2, cy, fz, trimM, 'window-jamb', trimT)
  L.box([w - 2 * fw, fw, fd], cx, o.y1 - fw / 2, fz, trimM, 'window-head', trimT)
  L.box([w - 2 * fw, fw, fd], cx, o.y0 + fw / 2, fz, trimM, 'window-bottom-rail', trimT)
  const intact = glazing(opts.condition, rng)
  const region = (x0: number, x1: number, y0: number, y1: number, [cols, rows]: Sash) => {
    const bar = 0.032, pw = (x1 - x0 - (cols - 1) * bar) / cols, ph = (y1 - y0 - (rows - 1) * bar) / rows
    for (let c = 1; c < cols; c++) L.box([bar, y1 - y0, 0.05], x0 + c * pw + (c - 0.5) * bar, (y0 + y1) / 2, fz, trimM, 'muntin', trimT)
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const px = x0 + c * (pw + bar) + pw / 2
      if (r > 0) L.box([pw, bar, 0.05], px, y0 + r * ph + (r - 0.5) * bar, fz, trimM, 'muntin', trimT)
      if (!burned && intact()) L.box([pw, ph, 0.014], px, y0 + r * (ph + bar) + ph / 2, fz, 'glass', 'window-glass', GLASS)
    }
  }
  const ix0 = o.x0 + fw, ix1 = o.x1 - fw, iy0 = o.y0 + fw, iy1 = o.y1 - fw
  if (style.window.bottom && iy1 - iy0 > 0.7) {
    const mid = (iy0 + iy1) / 2
    L.box([ix1 - ix0, 0.05, 0.08], cx, mid, fz, trimM, 'meeting-rail', trimT)
    region(ix0, ix1, mid + 0.025, iy1, style.window.top)
    region(ix0, ix1, iy0, mid - 0.025, style.window.bottom)
  } else region(ix0, ix1, iy0, iy1, style.window.top)

  L.box([w + 0.12, 0.05, 0.07], cx, o.y0 - 0.025, out * (WALL + 0.035), trimM, 'window-sill', trimT)
  const w0 = style.window, casing = w0.casing ? 0.07 : 0
  if (w0.casing) {
    for (const x of [o.x0 - 0.035, o.x1 + 0.035]) L.box([0.07, h, 0.025], x, cy, out * (WALL + 0.0125), trimM, 'window-casing', trimT)
    L.box([w + 0.16, 0.09, 0.04], cx, o.y1 + 0.045, out * (WALL + 0.02), trimM, 'window-crown', trimT)
    if (w0.pediment) L.prism([[cx - (w + 0.16) / 2, o.y1 + 0.09], [cx + (w + 0.16) / 2, o.y1 + 0.09], [cx, o.y1 + 0.27]], 0.04, out * (WALL + 0.02), trimM, 'window-pediment', trimT)
  }
  if (w0.shutters && o.y0 < 1.6) {
    const sw = Math.min(0.46, h * 0.34), shutterT = burned ? undefined : style.accent
    for (const side of [-1, 1]) {
      if (opts.condition !== 'weathered' && rng() < 0.25) continue
      const sx = side < 0 ? o.x0 - casing - 0.02 - sw / 2 : o.x1 + casing + 0.02 + sw / 2
      L.box([sw, h, 0.025], sx, cy, out * (WALL + 0.0125), burned ? 'charcoal' : 'plaster', 'shutter', shutterT)
      for (const t of [0.12, 0.5, 0.88]) L.box([sw - 0.08, 0.08, 0.014], sx, o.y0 + h * t, out * (WALL + 0.025 + 0.007), burned ? 'charcoal' : 'plaster', 'shutter-rail', shutterT)
    }
  }
  if (w0.grille) {
    const gm: MaterialKey = 'steel', gt: Vec3 = burned ? [0.3, 0.3, 0.3] : style.accent
    for (const x of [o.x0 - 0.0125, o.x1 + 0.0125]) L.box([0.025, h, 0.025], x, cy, out * (WALL + 0.0125), gm, 'grille-frame', gt)
    L.box([w + 0.05, 0.025, 0.025], cx, o.y1 + 0.0125, out * (WALL + 0.0125), gm, 'grille-frame', gt)
    const bars = Math.max(2, Math.round(w / 0.12)), step = w / bars, mid = o.y0 + h * 0.5
    for (let i = 1; i < bars; i++) L.box([0.016, h, 0.016], o.x0 + i * step, cy, out * (WALL + 0.012), gm, 'grille-bar', gt)
    for (let i = 0; i < bars; i++) {
      const a = o.x0 + (i === 0 ? 0 : i * step + 0.008), c = o.x0 + (i === bars - 1 ? w : (i + 1) * step - 0.008)
      if (c - a > 0.02) L.box([c - a, 0.016, 0.016], (a + c) / 2, mid, out * (WALL + 0.012), gm, 'grille-bar', gt)
    }
  }
  if (w0.casing && !w0.shutters && !w0.grille && opts.condition !== 'burned' && rng() < 0.22) {
    const boards = Math.max(2, Math.round(h / 0.38))
    for (let i = 0; i < boards; i++) {
      const y = o.y0 + 0.12 + (h - 0.24) * (boards === 1 ? 0.5 : i / (boards - 1))
      const board = L.box([w + 0.1, 0.16, 0.02], cx + (rng() - 0.5) * 0.04, y, out * (WALL + 0.025 + 0.01), 'wood', 'boarded-plank', [0.9 + rng() * 0.2, 0.86, 0.78])
      board.roll = (rng() - 0.5) * 0.08
    }
  }
}

export function dressDoor(b: ModelBuilder, run: Run, o: Opening, opts: DressOptions & { hood: boolean }) {
  const { style, burned, rng } = opts, L = local(b, run), out = run.out
  const trimM: MaterialKey = burned ? 'charcoal' : style.trim.material, trimT = burned ? undefined : style.trim.tint
  const w = o.x1 - o.x0, h = o.y1 - o.y0, cx = (o.x0 + o.x1) / 2, fw = 0.08
  for (const x of [o.x0 + fw / 2, o.x1 - fw / 2]) L.box([fw, h, 0.14], x, h / 2, 0, trimM, 'door-jamb', trimT)
  L.box([w - 2 * fw, fw, 0.14], cx, h - fw / 2, 0, trimM, 'door-head', trimT)
  for (const x of [o.x0 - 0.05, o.x1 + 0.05]) L.box([0.1, h, 0.03], x, h / 2, out * (WALL + 0.015), trimM, 'door-casing', trimT)
  L.box([w + 0.24, 0.12, 0.045], cx, h + 0.06, out * (WALL + 0.0225), trimM, 'door-crown', trimT)
  if (opts.hood && run.height - h > 0.55) {
    const hy = h + 0.16, depth = 0.62, hw = w + 0.7
    L.box([hw, 0.09, depth], cx, hy + 0.045, out * (WALL + depth / 2), trimM, 'door-hood', trimT)
    for (const side of [-1, 1]) L.box([0.07, 0.3, 0.3], cx + side * (hw / 2 - 0.12), hy - 0.15, out * (WALL + 0.15), trimM, 'hood-bracket', trimT)
  }
  const clear = w - 2 * fw, leaves = o.leaves ?? 1
  if (!leaves || (opts.condition !== 'weathered' && rng() < 0.35)) return
  const leafW = Math.min(clear / leaves, run.length / 2 + o.x0 + fw - 0.12), leafH = h - fw - 0.02, leafM: MaterialKey = burned ? 'charcoal' : style.door === 'glass' ? 'steel' : 'wood'
  const leafT = burned ? undefined : style.door === 'glass' ? [0.5, 0.5, 0.52] as Vec3 : style.accent
  const iz = -out * (WALL + 0.0225)
  for (const side of leaves === 2 ? [-1, 1] : [-1]) {
    const hinge = side < 0 ? o.x0 + fw : o.x1 - fw, lx = hinge + side * leafW / 2
    if (style.door === 'glass') {
      for (const x of [lx - leafW / 2 + 0.05, lx + leafW / 2 - 0.05]) L.box([0.1, leafH, 0.045], x, 0.01 + leafH / 2, iz, leafM, 'door-stile', leafT)
      for (const y of [0.01 + 0.06, 0.01 + leafH - 0.06]) L.box([leafW - 0.2, 0.12, 0.045], lx, y, iz, leafM, 'door-rail', leafT)
      if (!burned && rng() < 0.6) L.box([leafW - 0.2, leafH - 0.24, 0.014], lx, 0.01 + leafH / 2, iz, 'glass', 'door-glass', GLASS)
    } else {
      L.box([leafW, leafH, 0.045], lx, 0.01 + leafH / 2, iz, leafM, 'door-leaf', leafT)
      for (const y of [0.01 + leafH * 0.28, 0.01 + leafH * 0.72]) L.box([leafW - 0.26, leafH * 0.34, 0.014], lx, y, iz - out * 0.0295, leafM, 'door-panel', leafT)
    }
  }
}

export function dressRoll(b: ModelBuilder, run: Run, o: Opening, opts: DressOptions) {
  const { style, burned } = opts, L = local(b, run), out = run.out
  const w = o.x1 - o.x0, cx = (o.x0 + o.x1) / 2, steel: MaterialKey = burned ? 'charcoal' : 'steel'
  if (style.id === 'barn') {
    const h = o.y1 - o.y0, trimM: MaterialKey = burned ? 'charcoal' : 'plaster', white = burned ? undefined : style.trim.tint
    const leaves = (o.open ?? 0) > 0.2 ? [-1] : [-1, 1]
    for (const side of leaves) {
      const lx = cx + side * w / 4
      const leaf = L.box([w / 2, h, 0.06], lx, o.y0 + h / 2, out * 0.03, burned ? 'charcoal' : 'wood', 'barn-door-leaf', burned ? undefined : style.wall.tint, 'wall')
      leaf.relief = { kind: 'battens', side: out }
      for (const y of [o.y0 + 0.12, o.y1 - 0.12]) L.box([w / 2 - 0.08, 0.14, 0.03], lx, y, out * 0.075, trimM, 'barn-door-rail', white)
      const iw = w / 2 - 0.08, ih = h - 0.38, angle = Math.atan2(ih, iw) * side
      const brace = L.box([Math.hypot(iw, ih) - 0.42, 0.14, 0.03], lx, o.y0 + h / 2, out * 0.075, trimM, 'barn-door-brace', white)
      brace.roll = angle
    }
    for (const x of [o.x0 - 0.06, o.x1 + 0.06]) L.box([0.12, h, 0.03], x, o.y0 + h / 2, out * (WALL + 0.015), trimM, 'barn-door-casing', white)
    if (run.height - o.y1 > 0.2) L.box([w + 0.24, 0.14, 0.035], cx, o.y1 + 0.07, out * (WALL + 0.0175), trimM, 'barn-door-head', white)
    return
  }
  const tint: Vec3 | undefined = burned ? undefined : style.id === 'industrial' ? style.accent : [0.9, 0.9, 0.92]
  const open = Math.min(1, o.open ?? 0), bottom = o.y0 + (o.y1 - o.y0 - 0.3) * open
  if (open < 0.98 && o.y1 - bottom > 0.4) {
    L.box([w, 0.07, 0.08], cx, bottom + 0.035, out * 0.03, steel, 'roll-bottom-bar', [0.4, 0.4, 0.42])
    L.box([w, o.y1 - bottom - 0.07, 0.06], cx, (bottom + 0.07 + o.y1) / 2, out * 0.03, steel, 'roll-curtain', tint, 'wall')
  }
  for (const x of [o.x0 - 0.03, o.x1 + 0.03]) L.box([0.06, o.y1 - o.y0, 0.05], x, (o.y0 + o.y1) / 2, out * (WALL + 0.025), steel, 'roll-guide', [0.5, 0.5, 0.52])
  if (run.height - o.y1 >= 0.36) L.box([w + 0.2, 0.32, 0.28], cx, o.y1 + 0.16, out * (WALL + 0.14), steel, 'roll-housing', tint)
}

export function dressStorefront(b: ModelBuilder, run: Run, o: Opening, opts: DressOptions) {
  const { burned, rng } = opts, L = local(b, run), out = run.out
  const frameM: MaterialKey = burned ? 'charcoal' : 'steel', frameT: Vec3 = [0.32, 0.32, 0.34]
  const w = o.x1 - o.x0, h = o.y1 - o.y0, cx = (o.x0 + o.x1) / 2, fw = 0.07, fd = 0.12, fz = out * (WALL - 0.03 - fd / 2)
  const door = o.kind === 'shopdoor'
  for (const x of [o.x0 + fw / 2, o.x1 - fw / 2]) L.box([fw, h, fd], x, o.y0 + h / 2, fz, frameM, 'shopfront-frame', frameT)
  L.box([w - 2 * fw, fw, fd], cx, o.y1 - fw / 2, fz, frameM, 'shopfront-frame', frameT)
  if (!door) L.box([w - 2 * fw, fw, fd], cx, o.y0 + fw / 2, fz, frameM, 'shopfront-frame', frameT)
  const intact = glazing(opts.condition, rng)
  const transom = Math.min(o.y1 - fw - 0.5, o.y0 + (door ? 2.25 : 1.85)), ix0 = o.x0 + fw, ix1 = o.x1 - fw, iy0 = door ? o.y0 : o.y0 + fw
  const barred = transom - iy0 > 0.5 && o.y1 - fw - transom - 0.06 > 0.2
  if (barred) L.box([ix1 - ix0, 0.06, fd], cx, transom + 0.03, fz, frameM, 'shopfront-transom', frameT)
  const lower = door ? [] : [[iy0, barred ? transom : o.y1 - fw]], upper = barred ? [[transom + 0.06, o.y1 - fw]] : door ? [] : []
  const cols = door ? 1 : Math.max(1, Math.round((ix1 - ix0) / 1.2)), pane = (ix1 - ix0 - (cols - 1) * 0.06) / cols
  for (let c = 1; c < cols; c++) {
    const x = ix0 + c * pane + (c - 0.5) * 0.06
    if (!barred) { L.box([0.06, o.y1 - fw - iy0, fd], x, (iy0 + o.y1 - fw) / 2, fz, frameM, 'shopfront-mullion', frameT); continue }
    L.box([0.06, transom - iy0, fd], x, (iy0 + transom) / 2, fz, frameM, 'shopfront-mullion', frameT)
    L.box([0.06, o.y1 - fw - transom - 0.06, fd], x, (transom + 0.06 + o.y1 - fw) / 2, fz, frameM, 'shopfront-mullion', frameT)
  }
  for (let c = 0; c < cols; c++) for (const [a, z] of [...lower, ...upper]) {
    if (z - a < 0.1 || burned || !intact()) continue
    L.box([pane, z - a, 0.016], ix0 + c * (pane + 0.06) + pane / 2, (a + z) / 2, fz, 'glass', 'shopfront-glass', GLASS)
  }
  if (!door) L.box([w + 0.06, 0.04, 0.09], cx, o.y0 - 0.02, out * (WALL + 0.045), frameM, 'shopfront-sill', frameT)
}

export function groundCuts(openings: Opening[]): [number, number][] {
  return openings.filter((o) => o.y0 < 0.05).map((o) => [o.x0 - 0.16, o.x1 + 0.16] as [number, number])
}
