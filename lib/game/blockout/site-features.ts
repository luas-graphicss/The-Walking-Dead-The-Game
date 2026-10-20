import { assetFor } from './catalog'
import { buildAsset, type ModelBuilder } from './model'
import { FOUNDATION_HEIGHT, FLOOR_HEIGHT, hash, random, type Blueprint, type MaterialKey, type PartRole, type StructureModel, type Vec3 } from './types'
import type { Architecture } from './architecture'
import type { PlanCell } from './roofs'
import type { RoofResult } from './roofs'
import type { OutlineEdge } from './outline'
import type { Opening } from './facade'
import { outlineStrip } from './outline'
import { plate } from './polygon'
import type { Style } from './style'

export type FacadeRecord = { edge: OutlineEdge; level: number; openings: Opening[]; role: string; length: number; height: number; floorY: number }
export type PorchPlan = { x0: number; x1: number; depth: number; top: number; slope: number; posts: 'square' | 'round' | 'craftsman' }
export type ChimneyPlan = { edge: OutlineEdge; x0: number; x1: number; z0: number; z1: number; material: MaterialKey }
type Site = {
  x0: number; x1: number; z0: number; z1: number; bay: [number, number]; wallHeight: number; cells: PlanCell[]; frontX0: number; frontX1: number
  style: Style; edges: OutlineEdge[]; roof: RoofResult; eave: number; plinthTop: number; facades: FacadeRecord[]; porch: PorchPlan | null; chimney: ChimneyPlan | null; floors: number
}

const F = FOUNDATION_HEIGHT
const WHITE: Vec3 = [1.05, 1.05, 1.06], RED: Vec3 = [0.86, 0.12, 0.1], GREEN: Vec3 = [0.12, 0.62, 0.3], YELLOW: Vec3 = [1.1, 0.82, 0.16], BLUE: Vec3 = [0.16, 0.3, 0.7]
const PORCH_FEATURES = ['porch', 'deep-porch', 'timber-porch', 'corner-porch', 'farmstead', 'cabin', 'fishing', 'medical-porch', 'stoop']

export function planPorch(blueprint: Blueprint, profile: Architecture, style: Style, roof: RoofResult, front: { x0: number; x1: number; line: number }, floors: number, condition: string): PorchPlan | null {
  if (!PORCH_FEATURES.includes(profile.feature) || condition === 'leveled') return null
  const depth = ['deep-porch', 'farmstead'].includes(profile.feature) ? 2.8 : profile.feature === 'stoop' ? 1.5 : 2.2
  const inset = style.corners === 'quoins' ? 0.36 : 0.22
  const x0 = front.x0 + inset, x1 = front.x1 - inset, face = front.line + 0.1, slope = 0.2
  let top = F + 2.64
  if (floors > 1) top = Math.min(top, F + FLOOR_HEIGHT - 0.25)
  for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 8) for (let d = 0; d <= depth + 0.3; d += 0.1) {
    const bottom = roof.bottomAt(x, face + d)
    if (Number.isFinite(bottom)) top = Math.min(top, bottom - 0.24 + slope * d)
  }
  if (top - 0.08 - F < 2.25) return null
  const rng = random(hash(`${blueprint.id}:${style.id}:porch`))
  return { x0, x1, depth, top, slope, posts: style.id === 'craftsman' ? 'craftsman' : style.id === 'farmhouse' || style.id === 'colonial' ? (rng() < 0.6 ? 'round' : 'square') : 'square' }
}

export function planChimney(blueprint: Blueprint, profile: Architecture, style: Style, edges: OutlineEdge[], frontLine: number, condition: string): ChimneyPlan | null {
  const wants = ['farmstead', 'cabin', 'fishing', 'porch', 'deep-porch', 'timber-porch', 'chimney', 'corner-porch', 'stoop', 'workshop'].includes(profile.feature)
  if (!wants || style.roof.form === 'flat' || condition === 'leveled') return null
  const candidates = edges.filter((e) => e.running === 'z' && e.start !== 'concave' && e.end !== 'concave').sort((a, b) => a.s0 - b.s0)
  const back = edges.filter((e) => e.running === 'x' && e.out < 0 && e.start !== 'concave' && e.end !== 'concave')
  const edge = candidates[0] ?? back[0]
  if (!edge || edge.line === frontLine) return null
  const mid = (edge.s0 + edge.s1) / 2, w = 0.86, d = 0.72, face = edge.line + edge.out * 0.1
  const material: MaterialKey = style.id === 'cabin' ? 'concrete' : 'brick'
  const a = face, c = face + edge.out * (0.06 + d)
  return edge.running === 'z' ? { edge, x0: Math.min(a, c), x1: Math.max(a, c), z0: mid - w / 2, z1: mid + w / 2, material } : { edge, x0: mid - w / 2, x1: mid + w / 2, z0: Math.min(a, c), z1: Math.max(a, c), material }
}

export function buildSiteFeatures(b: ModelBuilder, model: StructureModel, blueprint: Blueprint, profile: Architecture, site: Site) {
  const { x0, x1, z0, z1, bay, style, roof, eave } = site
  const { condition } = model, severe = condition === 'ruined' || condition === 'leveled', burned = condition === 'burned'
  const rng = random(hash(`${model.id}:site`))
  const timber: MaterialKey = burned ? 'charcoal' : 'wood', steel: MaterialKey = burned ? 'charcoal' : 'steel'
  const face = z1 + 0.1
  const solid = (size: Vec3, position: Vec3, material: MaterialKey, name: string, role: PartRole = 'fixture', tint?: Vec3, level = 0) => {
    const part = b.box(size, position, material, role, 0, level, name)
    if (tint && !(burned && material === 'charcoal')) part.tint = tint
    return part
  }
  const stand = (size: Vec3, x: number, bottom: number, z: number, material: MaterialKey, name: string, role: PartRole = 'fixture', tint?: Vec3) => solid(size, [x, bottom + size[1] / 2, z], material, name, role, tint)
  const cylinder = (d: number, h: number, x: number, bottom: number, z: number, material: MaterialKey, name: string, tint?: Vec3, role: PartRole = 'fixture') => {
    const part = b.solid('cylinder', [d, h, d], [x, bottom + h / 2, z], material, role, name)
    if (tint) part.tint = tint
    return part
  }
  const asset = (family: string, position: Vec3, yaw = 0, variant = 1) => {
    const spec = assetFor(family, variant)
    const prefix = b.append(buildAsset(spec), position, yaw, 0, `${model.id}/site-${family}-${model.instances.length}`)
    model.instances.push({ asset: spec.id, position, yaw, level: 0, prefix })
  }

  const signboard = (cx: number, y: number, width: number, height: number, colour: Vec3, symbol?: 'cross-red' | 'cross-green', zFace = face) => {
    if (severe) return
    solid([width, height, 0.06], [cx, y + height / 2, zFace + 0.03], 'plaster', 'signboard', 'fixture', burned ? [0.2, 0.2, 0.2] : colour)
    if (burned) return
    let cursor = cx - width / 2 + 0.18
    if (symbol) {
      const s = Math.min(height * 0.72, 0.6), sx = cursor + s / 2
      solid([s, s, 0.02], [sx, y + height / 2, zFace + 0.07], 'plaster', 'sign-symbol-back', 'fixture', WHITE)
      const tint = symbol === 'cross-red' ? RED : GREEN
      solid([s * 0.26, s * 0.8, 0.02], [sx, y + height / 2, zFace + 0.09], 'plaster', 'sign-cross', 'fixture', tint)
      for (const side of [-1, 1]) solid([s * 0.27, s * 0.26, 0.02], [sx + side * s * 0.265, y + height / 2, zFace + 0.09], 'plaster', 'sign-cross', 'fixture', tint)
      cursor += s + 0.16
    }
    const end = cx + width / 2 - 0.18, letterH = height * 0.42
    while (cursor < end - 0.12) {
      const w = Math.min(end - cursor, 0.1 + rng() * 0.22)
      if (w < 0.08) break
      solid([w, letterH, 0.02], [cursor + w / 2, y + height / 2, zFace + 0.07], 'plaster', 'sign-letter', 'fixture', WHITE)
      cursor += w + (rng() < 0.18 ? 0.22 : 0.06)
    }
  }
  const frontRuns = site.facades.filter((f) => f.level === 0 && f.edge.running === 'x' && f.edge.out > 0)

  const porch = site.porch
  if (porch) {
    const { depth, top, slope } = porch, px0 = porch.x0, px1 = porch.x1, deckZ0 = z1 + 0.16, deckZ1 = deckZ0 + depth
    const deck = solid([px1 - px0, F, depth], [(px0 + px1) / 2, F / 2, (deckZ0 + deckZ1) / 2], style.id === 'brazilian' || style.id === 'modern' ? 'concrete' : 'wood', 'porch-deck', 'floor', style.id === 'brazilian' ? [0.86, 0.5, 0.36] : undefined)
    deck.tint = deck.tint ?? (deck.material === 'wood' ? [0.92, 0.84, 0.76] : undefined)
    const ex = model.entrance[0]
    solid([1.7, F / 2, 0.34], [ex, F / 4, deckZ1 + 0.17], 'concrete', 'porch-step', 'floor')
    model.entrance = [ex, 0, deckZ1 + 1.1]
    const roofZ1 = deckZ1 + 0.28, postZ = deckZ1 - 0.14
    const plateBottom = (z: number) => top - 0.08 - slope * (z - face)
    const beamTop = plateBottom(postZ + 0.1), beamBottom = beamTop - 0.2
    const count = Math.max(2, Math.round((px1 - px0) / 2.6)), postXs: number[] = []
    for (let i = 0; i <= count; i++) {
      const px = px0 + 0.14 + i * (px1 - px0 - 0.28) / count
      if (Math.abs(px - ex) < 0.95) continue
      postXs.push(px)
    }
    const trimM: MaterialKey = burned ? 'charcoal' : 'plaster', trimT = burned ? undefined : style.trim.tint
    const postH = severe ? 0.5 : beamBottom - F
    for (const px of postXs) {
      if (porch.posts === 'craftsman') {
        stand([0.42, Math.min(0.95, postH - 0.3), 0.42], px, F, postZ, 'brick', 'porch-pier', 'column', [0.85, 0.78, 0.72])
        if (!severe) stand([0.24, postH - 0.95, 0.24], px, F + 0.95, postZ, trimM, 'porch-post', 'column', trimT)
      } else if (porch.posts === 'round') {
        stand([0.3, 0.16, 0.3], px, F, postZ, trimM, 'porch-post-base', 'column', trimT)
        if (!severe) {
          cylinder(0.22, postH - 0.32, px, F + 0.16, postZ, trimM, 'porch-column', trimT, 'column')
          stand([0.3, 0.16, 0.3], px, beamBottom - 0.16, postZ, trimM, 'porch-post-cap', 'column', trimT)
        }
      } else {
        stand([0.18, postH, 0.18], px, F, postZ, burned ? 'charcoal' : style.id === 'modern' ? 'steel' : trimM, 'porch-post', 'column', style.id === 'modern' ? [0.3, 0.3, 0.32] : trimT)
      }
    }
    if (!severe) {
      solid([px1 - px0 - 0.04, 0.2, 0.2], [(px0 + px1) / 2, beamBottom + 0.1, postZ], trimM, 'porch-beam', 'roof', trimT)
      const roofTint = burned ? undefined : style.roof.material === 'steel' ? style.roof.tint : [0.8, 0.8, 0.82] as Vec3
      const roofPlane: [number, number, number] = [0, -slope, top + slope * face]
      plate(b, [[px0 - 0.04, face], [px1 + 0.04, face], [px1 + 0.04, roofZ1], [px0 - 0.04, roofZ1]], roofPlane, [0, -slope, top + slope * face - 0.08], burned ? 'charcoal' : style.roof.material === 'steel' ? 'steel' : 'rubber', 'roof', 'porch-roof', 0, roofTint)
      plate(b, [[px0 - 0.04, roofZ1 - 0.03], [px1 + 0.04, roofZ1 - 0.03], [px1 + 0.04, roofZ1], [px0 - 0.04, roofZ1]], [0, -slope, top + slope * face - 0.08], [0, -slope, top + slope * face - 0.24], trimM, 'roof', 'porch-fascia', 0, trimT)
      if (style.id !== 'modern' && style.id !== 'brazilian') {
        const railY0 = F + 0.1, railY1 = F + 0.9
        const rails = (a: number, c: number, along: 'x' | 'z', fixed: number) => {
          const len = c - a
          if (len < 0.5) return
          const center = (a + c) / 2
          for (const [y, h] of [[railY0, 0.06], [railY1 - 0.06, 0.06]] as const) solid(along === 'x' ? [len, h, 0.07] : [0.07, h, len], along === 'x' ? [center, y + h / 2, fixed] : [fixed, y + h / 2, center], trimM, 'porch-rail', 'fixture', trimT)
          const n = Math.floor(len / 0.14)
          for (let i = 1; i < n; i++) {
            const t = a + i * len / n
            solid([0.04, railY1 - 0.06 - railY0 - 0.06, 0.04], along === 'x' ? [t, (railY0 + 0.06 + railY1 - 0.06) / 2, fixed] : [fixed, (railY0 + 0.06 + railY1 - 0.06) / 2, t], trimM, 'porch-baluster', 'fixture', trimT)
          }
        }
        const halfPost = porch.posts === 'craftsman' ? 0.21 : porch.posts === 'round' ? 0.15 : 0.09
        const sorted = [...postXs].sort((a, c) => a - c)
        for (let i = 0; i < sorted.length - 1; i++) {
          const a = sorted[i] + halfPost, c = sorted[i + 1] - halfPost
          if (ex > a && ex < c) continue
          rails(a, c, 'x', postZ)
        }
        if (sorted.length) {
          rails(deckZ0 + 0.02, postZ - halfPost, 'z', sorted[0])
          rails(deckZ0 + 0.02, postZ - halfPost, 'z', sorted[sorted.length - 1])
        }
      }
    }
  }

  const chimney = site.chimney
  if (chimney) {
    const e = chimney.edge, out = e.out, wallFace = e.line + out * 0.1
    let roofTop = eave
    for (let dx = -3; dx <= 3; dx += 0.5) for (let dz = -3; dz <= 3; dz += 0.5) {
      const h = roof.heightAt((chimney.x0 + chimney.x1) / 2 + dx, (chimney.z0 + chimney.z1) / 2 + dz)
      if (Number.isFinite(h)) roofTop = Math.max(roofTop, h)
    }
    const topY = severe ? F + 1.1 : roofTop + 0.7
    const cx = (chimney.x0 + chimney.x1) / 2, cz = (chimney.z0 + chimney.z1) / 2
    const across = e.running === 'z' ? 'x' : 'z', base0 = wallFace + out * 0.06
    const baseC = across === 'x' ? [(base0 + (chimney.x0 + chimney.x1 - wallFace)) / 2, cz] : [cx, (base0 + (chimney.z0 + chimney.z1 - wallFace)) / 2]
    const baseD = Math.abs((across === 'x' ? chimney.x1 - chimney.x0 : chimney.z1 - chimney.z0) - 0.06)
    const width = across === 'x' ? chimney.z1 - chimney.z0 : chimney.x1 - chimney.x0
    const tint: Vec3 | undefined = chimney.material === 'brick' ? [0.92, 0.82, 0.76] : [0.8, 0.78, 0.74]
    stand(across === 'x' ? [baseD, site.plinthTop, width] : [width, site.plinthTop, baseD], baseC[0], 0, baseC[1], chimney.material, 'chimney-base', 'wall', tint)
    const stackH = topY - site.plinthTop
    stand([chimney.x1 - chimney.x0, stackH, chimney.z1 - chimney.z0], cx, site.plinthTop, cz, burned ? 'charcoal' : chimney.material, 'chimney-stack', 'wall', tint)
    if (!severe) {
      stand([chimney.x1 - chimney.x0 + 0.14, 0.16, chimney.z1 - chimney.z0 + 0.14], cx, topY, cz, 'concrete', 'chimney-crown', 'roof')
      for (const off of [-0.16, 0.16]) cylinder(0.18, 0.32, cx + (across === 'z' ? off : 0), topY + 0.16, cz + (across === 'x' ? off : 0), 'tile', 'chimney-pot', [0.86, 0.5, 0.36], 'roof')
    }
  }

  const shop = blueprint.category === 'Comércios' || blueprint.id === 'shop-house'
  if (shop && !severe) {
    for (const run of frontRuns) {
      if (!run.role.startsWith('storefront')) continue
      const e = run.edge, cx = (e.s0 + e.s1) / 2, top = Math.max(...run.openings.map((o) => o.y1)), roll = run.openings.some((o) => o.kind === 'roll')
      let signY = F + top + (roll ? 0.38 : 0.1)
      if (!roll && !burned && style.id === 'main-street') {
        for (const o of run.openings) {
          if (o.kind !== 'storefront') continue
          const ox0 = cx + o.x0 - 0.06, ox1 = cx + o.x1 + 0.06, y = F + o.y1 + 0.12, depth = 1.05, drop = 0.42, stripes = Math.max(3, Math.round((ox1 - ox0) / 0.32))
          const colour = style.sign ?? RED
          for (let i = 0; i < stripes; i++) {
            const a = ox0 + i * (ox1 - ox0) / stripes, c = ox0 + (i + 1) * (ox1 - ox0) / stripes, tint = i % 2 ? WHITE : colour
            const top3: [number, number, number] = [0, -drop / depth, y + drop / depth * face]
            plate(b, [[a, face], [c, face], [c, face + depth], [a, face + depth]], top3, [0, -drop / depth, y + drop / depth * face - 0.03], 'fabric', 'roof', 'awning-canvas', 0, tint)
            plate(b, [[a, face + depth - 0.025], [c, face + depth - 0.025], [c, face + depth], [a, face + depth]], [0, -drop / depth, y + drop / depth * face - 0.03], [0, -drop / depth, y + drop / depth * face - 0.25], 'fabric', 'roof', 'awning-valance', 0, tint)
          }
          signY = Math.max(signY, y + 0.06)
        }
      }
      const limit = Math.min(eave - 0.06 - (roof.flatTop ? 0 : 0.35), F + site.wallHeight - 0.06)
      const height = Math.min(0.62, limit - signY)
      if (height > 0.3) signboard(cx, signY, run.length - 0.7, height, style.sign ?? [0.3, 0.3, 0.32], blueprint.id === 'pharmacy' || blueprint.id === 'optician' ? 'cross-green' : undefined)
    }
  }

  const entranceRun = frontRuns.find((run) => run.role === 'entrance' || run.role === 'storefront-entrance')
  let porticoBuilt = false
  const entranceSign = (colour: Vec3, symbol?: 'cross-red' | 'cross-green') => {
    if (porch && !severe) {
      const sx = porch.x1 + 1.4 > x1 + 0.6 ? x0 - 1.2 : porch.x1 + 1.4, sz = z1 + 0.16 + porch.depth + 1.4
      for (const dx of [-0.8, 0.8]) stand([0.1, 1.9, 0.1], sx + dx, 0, sz, 'wood', 'yard-sign-post', 'fixture', [0.7, 0.62, 0.52])
      signboard(sx, 1.2, 1.5, 0.62, colour, symbol, sz + 0.05 - 0.03 - 0.03)
      return
    }
    if (!entranceRun || porticoBuilt) return
    const top = Math.max(...entranceRun.openings.map((o) => o.y1)) + 0.12 + 0.12
    const height = Math.min(0.6, Math.min(eave, F + site.wallHeight) - 0.08 - (F + top))
    if (height > 0.3) signboard((entranceRun.edge.s0 + entranceRun.edge.s1) / 2, F + top, Math.min(3.6, entranceRun.length - 0.8), height, colour, symbol)
  }
  const flagpole = (x: number, z: number) => {
    stand([0.7, 0.3, 0.7], x, 0, z, 'concrete', 'flagpole-base', 'foundation')
    cylinder(0.09, severe ? 1.2 : 7.6, x, 0.3, z, steel, 'flagpole', [0.8, 0.8, 0.82])
    if (!severe && !burned) solid([1.3, 0.82, 0.02], [x + 0.045 + 0.65, 0.3 + 7.6 - 0.5, z], 'fabric', 'flag', 'fixture', blueprint.id === 'police' ? BLUE : GREEN)
  }
  const sidewalk = (zEnd: number) => {
    const depth = zEnd - (z1 + 0.16)
    if (depth > 0.3) solid([x1 - x0 + 0.32, 0.12, depth], [(x0 + x1) / 2, 0.06, z1 + 0.16 + depth / 2], 'concrete', 'sidewalk', 'foundation', [0.86, 0.85, 0.82])
  }
  const portico = (columns: number, deep: number) => {
    if (!entranceRun) return
    const e = entranceRun.edge, px0 = e.s0 + 0.46, px1 = e.s1 - 0.46, z0p = z1 + 0.16, z1p = z0p + deep
    porticoBuilt = true
    const deckH = F
    solid([px1 - px0 + 0.3, deckH, deep], [(px0 + px1) / 2, deckH / 2, (z0p + z1p) / 2], 'concrete', 'portico-podium', 'floor', [0.92, 0.9, 0.86])
    solid([px1 - px0 + 0.3, deckH / 2, 0.36], [(px0 + px1) / 2, deckH / 4, z1p + 0.18], 'concrete', 'portico-step', 'floor', [0.92, 0.9, 0.86])
    model.entrance = [model.entrance[0], 0, z1p + 1.2]
    if (severe) return
    let lowest = eave
    for (let x = px0; x <= px1; x += 0.4) for (let d = 0; d <= 0.8; d += 0.05) { const bt = roof.bottomAt(x, face + d); if (Number.isFinite(bt)) lowest = Math.min(lowest, bt - 0.26) }
    const entTop = Math.min(F + 3.1, lowest), colTop = entTop - 0.42, colZ = z1p - 0.32, ex = model.entrance[0]
    const xs = (columns >= 4 ? [-1.75, -0.9, 0.9, 1.75] : [-1.4, 1.4]).map((k) => ex + k).filter((cx) => cx > px0 + 0.26 && cx < px1 - 0.26)
    for (const cx of xs) {
      stand([0.52, 0.18, 0.52], cx, deckH, colZ, 'concrete', 'column-plinth', 'column', [0.95, 0.93, 0.88])
      cylinder(0.4, colTop - deckH - 0.36, cx, deckH + 0.18, colZ, 'plaster', 'classical-column', [1.02, 1, 0.95], 'column')
      stand([0.54, 0.18, 0.54], cx, colTop - 0.18, colZ, 'concrete', 'column-capital', 'column', [0.95, 0.93, 0.88])
    }
    solid([px1 - px0 + 0.24, 0.42, 0.66], [(px0 + px1) / 2, colTop + 0.21, colZ], 'plaster', 'entablature', 'roof', [1.02, 1, 0.95])
    signboard((px0 + px1) / 2, colTop + 0.07, px1 - px0 - 0.4, 0.28, blueprint.id === 'bank' ? [0.18, 0.25, 0.42] : [0.3, 0.3, 0.32], undefined, colZ + 0.33)
    plate(b, [[px0, face], [px1, face], [px1, colZ - 0.33], [px0, colZ - 0.33]], [0, 0, colTop + 0.42], [0, 0, colTop + 0.24], 'plaster', 'roof', 'portico-ceiling', 0, [1, 0.98, 0.94])
    const pediment = b.prism([[px0 - 0.12, 0], [px1 + 0.12, 0], [(px0 + px1) / 2, Math.min(1.3, (px1 - px0) * 0.22)]], 0.62, colZ, 'plaster', 'roof', 'pediment', 0)
    pediment.position = [pediment.position[0], colTop + 0.42 + pediment.size[1] / 2, colZ]
    pediment.tint = [1.02, 1, 0.95]
  }

  const id = blueprint.id, feature = profile.feature
  if (['clinic', 'rural-clinic', 'dental-clinic', 'veterinary'].includes(id)) entranceSign(WHITE, 'cross-red')
  const band = (y0: number, y1: number, tint: Vec3, name: string) => {
    if (severe || site.floors > 1) return
    for (const edge of site.edges) {
      const cuts: [number, number][] = [[edge.s0 - 0.3, edge.s0 + 0.3], [edge.s1 - 0.3, edge.s1 + 0.3]]
      for (const f of site.facades) if (f.edge === edge && f.level === 0) {
        if (f.role.includes('entrance')) cuts.push([edge.s0 + 0.3, edge.s1 - 0.3])
        for (const o of f.openings) if (o.y1 + 0.3 > y0 - F) cuts.push([(edge.s0 + edge.s1) / 2 + Math.min(o.x0, -o.x1) - 0.3, (edge.s0 + edge.s1) / 2 + Math.max(o.x1, -o.x0) + 0.3])
      }
      outlineStrip(b, edge, 0.1, 0.13, y0, y1, 'plaster', 'fixture', name, 0, burned ? [0.2, 0.2, 0.2] : tint, cuts)
    }
  }
  if (id === 'police') {
    band(F + site.wallHeight - 0.56, F + site.wallHeight - 0.34, BLUE, 'police-band')
    entranceSign(BLUE)
    flagpole(x0 - 1.4, z1 + 2)
  }
  if (id === 'post-office') {
    band(F + site.wallHeight - 0.5, F + site.wallHeight - 0.3, YELLOW, 'post-band')
    entranceSign(BLUE)
    if (!severe) { stand([0.12, 0.9, 0.12], x1 - 0.8, 0, z1 + 1.4, steel, 'mailbox-post'); stand([0.5, 0.62, 0.44], x1 - 0.8, 0.9, z1 + 1.4, 'steel', 'mailbox', 'fixture', YELLOW) }
  }
  if (['bank', 'town-hall', 'library'].includes(id)) portico(4, 2.4)
  if (id === 'town-hall') { flagpole(x0 - 1.2, z1 + 3); flagpole(x1 + 1.2, z1 + 3) }
  if (id === 'school' || id === 'daycare') { flagpole(x1 + 1.5, z1 + 2.5); entranceSign([0.2, 0.36, 0.27]) }
  if (id === 'bank' || id === 'library' || id === 'community-center' || id === 'shelter') entranceSign(id === 'bank' ? [0.18, 0.25, 0.42] : [0.3, 0.3, 0.32])
  if (id === 'office-building' || id === 'apartment-building') entranceSign([0.18, 0.2, 0.24])
  if (id === 'fire-station') entranceSign(RED)

  if (id === 'hospital-building') {
    sidewalk(z1 + 1.6)
    const lotZ0 = z1 + 1.6, lotZ1 = lotZ0 + 7.5, lotX0 = x0 - 0.5, lotX1 = x1 + 0.5
    solid([lotX1 - lotX0, 0.05, lotZ1 - lotZ0], [(lotX0 + lotX1) / 2, 0.025, (lotZ0 + lotZ1) / 2], 'rubber', 'parking-lot', 'foundation', [0.95, 0.95, 0.98])
    for (let x = lotX0 + 3.2; x < lotX1 - 0.5; x += 2.6) if (Math.abs(x - model.entrance[0]) > 4.2) solid([0.1, 0.012, 4.6], [x, 0.05 + 0.006, lotZ1 - 2.45], 'plaster', 'parking-stripe', 'fixture', WHITE)
    if (!severe) {
      const ex = model.entrance[0], cw = 7.2, cz0 = lotZ0 + 0.4, cz1 = cz0 + 5.6, ch = 4.1
      for (const dx of [-1, 1]) for (const z of [cz0 + 0.4, cz1 - 0.4]) cylinder(0.42, ch - 0.05, ex + dx * (cw / 2 - 0.4), 0.05, z, 'concrete', 'canopy-column', [0.95, 0.94, 0.92], 'column')
      solid([cw, 0.45, cz1 - cz0], [ex, ch + 0.225, (cz0 + cz1) / 2], 'concrete', 'emergency-canopy', 'roof', [0.95, 0.94, 0.92])
      solid([cw + 0.04, 0.3, 0.04], [ex, ch + 0.225, cz1 + 0.02], 'plaster', 'canopy-band', 'fixture', burned ? [0.2, 0.2, 0.2] : RED)
      solid([cw + 0.04, 0.3, 0.04], [ex, ch + 0.225, cz0 - 0.02], 'plaster', 'canopy-band', 'fixture', burned ? [0.2, 0.2, 0.2] : RED)
      for (const dx of [-2.2, 2.2]) cylinder(0.18, 0.9, ex + dx, 0.12, z1 + 1.35, 'steel', 'bollard', YELLOW)
      if (roof.flatTop && condition !== 'burned') {
        const sy = roof.flatTop, sx = (x0 + x1) / 2, sz = z1 - 1.6
        for (const dx of [-1.2, 1.2]) stand([0.12, 2.6, 0.12], sx + dx, sy, sz, 'steel', 'roof-sign-post', 'roof', [0.6, 0.6, 0.62])
        solid([3, 2.2, 0.08], [sx, sy + 2.6 + 1.1, sz], 'plaster', 'roof-sign-panel', 'roof', WHITE)
        solid([0.56, 1.7, 0.04], [sx, sy + 3.7, sz + 0.06], 'plaster', 'roof-sign-cross', 'roof', RED)
        for (const dx of [-1, 1]) solid([0.57, 0.56, 0.04], [sx + dx * 0.565, sy + 3.7, sz + 0.06], 'plaster', 'roof-sign-cross', 'roof', RED)
      }
    }
    entranceSign(WHITE, 'cross-red')
  }

  if (feature === 'balconies' && !severe) {
    for (const run of site.facades) {
      if (run.level === 0 || run.edge.running !== 'x' || run.edge.out < 0) continue
      const balconyDoor = run.openings.find((o) => o.kind === 'door')
      if (!balconyDoor) continue
      const cx = (run.edge.s0 + run.edge.s1) / 2 + (balconyDoor.x0 + balconyDoor.x1) / 2, w = Math.min(run.length - 0.9, 2.6), y = run.floorY
      const zb0 = run.edge.line + 0.16, zb1 = zb0 + 1.25
      solid([w, 0.2, zb1 - zb0], [cx, y - 0.1, (zb0 + zb1) / 2], 'concrete', 'balcony-slab', 'floor', [0.92, 0.9, 0.86], run.level)
      for (const dx of [-1, 1]) solid([0.05, 1, 0.05], [cx + dx * (w / 2 - 0.025), y + 0.5, zb1 - 0.025], steel, 'balcony-post', 'fixture', [0.3, 0.3, 0.32], run.level)
      solid([w, 0.06, 0.06], [cx, y + 1.03, zb1 - 0.03], steel, 'balcony-handrail', 'fixture', [0.3, 0.3, 0.32], run.level)
      for (let i = 1; i < Math.floor(w / 0.12); i++) solid([0.025, 0.94, 0.025], [cx - w / 2 + i * w / Math.floor(w / 0.12), y + 0.47, zb1 - 0.03], steel, 'balcony-bar', 'fixture', [0.3, 0.3, 0.32], run.level)
    }
  }

  if (id === 'church' && !severe) {
    const corner = !site.cells.some((c) => c.x === 0 && c.z === Math.max(...site.cells.map((q) => q.z)))
    const tx = corner ? x0 + bay[0] / 2 : x0 - 1.7, tz = corner ? z1 - bay[1] / 2 : z1 - 1.5, tw = 2.6, th = Math.max(roof.peak - F + 3.6, 11)
    solid([tw + 0.3, F, tw + 0.3], [tx, F / 2, tz], 'concrete', 'tower-foundation', 'foundation')
    stand([tw, th - 3.2, tw], tx, F, tz, burned ? 'charcoal' : style.wall.material, 'bell-tower-shaft', 'wall', style.wall.tint)
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) stand([0.42, 2.4, 0.42], tx + dx * (tw / 2 - 0.21), F + th - 3.2, tz + dz * (tw / 2 - 0.21), 'concrete', 'belfry-pier', 'column', [0.95, 0.93, 0.88])
    solid([tw + 0.24, 0.3, tw + 0.24], [tx, F + th - 0.8 + 0.15, tz], 'concrete', 'belfry-cornice', 'roof', [0.95, 0.93, 0.88])
    b.solid('cylinder', [0.9, 0.7, 0.9], [tx, F + th - 3.2 + 0.85, tz], 'paint', 'fixture', 'church-bell')
    stand([0.08, 1.2, 0.08], tx, F + th - 2.0, tz, steel, 'bell-hanger')
    b.solid('cone', [tw + 0.1, 4.2, tw + 0.1], [tx, F + th - 0.5 + 2.1, tz], burned ? 'charcoal' : 'rubber', 'roof', 'church-spire').tint = [0.86, 0.94, 1.08]
    stand([0.08, 1.1, 0.08], tx, F + th + 3.7, tz, steel, 'spire-cross', 'roof', [0.9, 0.8, 0.4])
    for (const side of [-1, 1]) solid([0.24, 0.08, 0.08], [tx + side * 0.16, F + th + 4.45, tz], steel, 'spire-cross-arm', 'roof', [0.9, 0.8, 0.4])
    const gx = model.entrance[0], gyTop = roof.heightAt(gx, face + 0.01)
    if (Number.isFinite(gyTop)) {
      const clear = gyTop - roof.thickness - eave
      if (clear > 1.6) {
        const r = Math.min(0.75, clear * 0.24), cy = eave + clear * 0.4
        const ring = b.solid('cylinder', [r * 2 + 0.18, 0.03, r * 2 + 0.18], [gx, cy, face + 0.015], 'plaster', 'fixture', 'rose-frame')
        ring.pitch = Math.PI / 2; ring.tint = [1.02, 1, 0.95]
        const rose = b.solid('cylinder', [r * 2, 0.03, r * 2], [gx, cy, face + 0.045], 'glass', 'fixture', 'rose-window')
        rose.pitch = Math.PI / 2; rose.tint = [0.55, 0.45, 0.95]
      }
    }
  }
  if (id === 'fire-station' && !severe) {
    const tx = x0 - 1.6, tz = z1 - 1.6, tw = 2.4, th = 9
    solid([tw + 0.3, F, tw + 0.3], [tx, F / 2, tz], 'concrete', 'tower-foundation', 'foundation')
    stand([tw, th, tw], tx, F, tz, burned ? 'charcoal' : 'brick', 'hose-tower', 'wall', [0.95, 0.85, 0.8])
    solid([tw + 0.2, 0.2, tw + 0.2], [tx, F + th + 0.1, tz], 'concrete', 'hose-tower-cap', 'roof')
    for (const dz of [-0.6, 0.6]) stand([0.04, 0.9, 0.5], tx + tw / 2 + 0.02, F + th - 1.6, tz + dz, 'plaster', 'tower-louver', 'fixture', [0.3, 0.3, 0.32])
    cylinder(0.12, 3.2, tx, F + th + 0.2, tz, steel, 'siren-mast', [0.7, 0.7, 0.72])
    b.solid('cylinder', [0.5, 0.32, 0.5], [tx, F + th + 0.2 + 3.2 + 0.16, tz], 'paint', 'fixture', 'siren').tint = RED
  }
  if (id === 'motel' && !severe) {
    const px = x1 + 1.6, pz = z1 + 3
    stand([0.8, 0.4, 0.8], px, 0, pz, 'concrete', 'pylon-base', 'foundation')
    cylinder(0.24, 6.2, px, 0.4, pz, steel, 'pylon-pole', [0.75, 0.2, 0.18])
    solid([2.6, 1.5, 0.3], [px, 0.4 + 6.2 + 0.75, pz], 'plaster', 'pylon-sign', 'fixture', burned ? [0.2, 0.2, 0.2] : [0.95, 0.85, 0.3])
  }

  if (style.id === 'brazilian' && !severe && blueprint.category === 'Residências') {
    const wz = z1 + (porch ? 0.16 + porch.depth + 0.34 + 2.6 : 3.4), gate = model.entrance[0], h = 1.3
    const wallTint = style.wall.tint, cap: Vec3 = [1.02, 1, 0.96]
    for (const [a, c] of [[x0 - 0.6, gate - 1.66], [gate + 1.66, x1 + 0.6]] as const) {
      if (c - a < 0.8) continue
      stand([c - a, h, 0.18], (a + c) / 2, 0, wz, 'plaster', 'front-wall', 'wall', wallTint)
      stand([c - a, 0.06, 0.26], (a + c) / 2, h, wz, 'concrete', 'front-wall-cap', 'fixture', cap)
    }
    for (const x of [gate - 1.48, gate + 1.48]) {
      stand([0.36, h + 0.3, 0.36], x, 0, wz, 'plaster', 'gate-pillar', 'column', style.trim.tint)
      stand([0.44, 0.07, 0.44], x, h + 0.3, wz, 'concrete', 'gate-pillar-cap', 'fixture', cap)
    }
    if (condition !== 'burned') {
      stand([2.6, 0.06, 0.05], gate, 0, wz, 'steel', 'gate-track', 'fixture', [0.3, 0.3, 0.3])
      if (rng() < 0.7) {
        for (let i = 0; i < 18; i++) stand([0.025, 1.36, 0.025], gate - 1.25 + i * 2.5 / 17, 0.06, wz, 'steel', 'gate-bar', 'fixture', style.accent)
        stand([2.6, 0.05, 0.04], gate, 1.42, wz, 'steel', 'gate-rail', 'fixture', style.accent)
      }
    }
  }
  if ((style.id === 'colonial' || style.id === 'farmhouse') && !severe && blueprint.category === 'Residências') {
    const fz = z1 + (porch ? 0.16 + porch.depth + 0.34 + 2.4 : 3.2), gate = model.entrance[0]
    for (const [a, c] of [[x0 - 0.4, gate - 0.8], [gate + 0.8, x1 + 0.4]] as const) {
      const len = c - a
      if (len < 0.6) continue
      for (const y of [0.25, 0.75]) solid([len, 0.07, 0.04], [(a + c) / 2, y, fz - 0.035], 'plaster', 'picket-rail', 'fixture', WHITE)
      const n = Math.floor(len / 0.13)
      for (let i = 0; i <= n; i++) stand([0.07, 0.95, 0.022], a + 0.035 + i * (len - 0.07) / n, 0, fz - 0.055 - 0.011, 'plaster', 'picket', 'fixture', WHITE)
    }
    stand([0.1, 1.05, 0.1], gate + 1.3, 0, fz + 0.6, 'wood', 'mailbox-post')
    stand([0.26, 0.24, 0.5], gate + 1.3, 1.05, fz + 0.6, 'steel', 'mailbox', 'fixture', style.accent)
  }

  const silo = (px: number, pz: number, height: number, raised = false) => {
    const diameter = 3.2, pad = 3.6, lift = raised && !severe ? 3.4 : 0
    solid([pad, 0.18, pad], [px, 0.09, pz], 'concrete', 'silo-pad', 'foundation')
    if (lift) {
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) stand([0.22, lift - 0.18, 0.22], px + dx * 1.35, 0.18, pz + dz * 1.35, steel, 'water-tower-leg', 'column')
      solid([pad, 0.18, pad], [px, lift + 0.09, pz], steel, 'water-tower-platform', 'floor')
    }
    let y = 0.18 + lift
    const tall = severe ? condition === 'leveled' ? 0.4 : 2.2 : height
    const sections = severe ? 1 : 4, each = (tall - (sections - 1) * 0.07) / sections
    for (let i = 0; i < sections; i++) {
      b.solid('cylinder', [diameter, each, diameter], [px, y + each / 2, pz], steel, 'fixture', 'silo-shell'); y += each
      if (i < sections - 1) { b.solid('cylinder', [diameter + 0.1, 0.07, diameter + 0.1], [px, y + 0.035, pz], 'concrete', 'fixture', 'silo-joint'); y += 0.07 }
    }
    if (!severe) b.solid('cone', [diameter, 1.1, diameter], [px, y + 0.55, pz], steel, 'roof', 'silo-conical-roof')
  }
  const fencePosts = new Set<string>()
  const fence = (from: [number, number], to: [number, number], height = 1.2) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]), count = Math.max(1, Math.ceil(length / 2.5)), yaw = Math.atan2(from[1] - to[1], to[0] - from[0])
    for (let i = 0; i <= count; i++) {
      const px = from[0] + (to[0] - from[0]) * i / count, pz = from[1] + (to[1] - from[1]) * i / count, key = `${px.toFixed(4)},${pz.toFixed(4)}`
      if (!fencePosts.has(key)) { stand([0.12, severe ? height * 0.55 : height, 0.12], px, 0, pz, timber, 'rural-fence-post'); fencePosts.add(key) }
      if (i === count || severe && i % 2 === 0 || condition === 'damaged' && i === 2) continue
      for (const y of [0.32, severe ? 0.58 : height - 0.18]) b.box([length / count - 0.12, 0.08, 0.08], [from[0] + (to[0] - from[0]) * (i + 0.5) / count, y, from[1] + (to[1] - from[1]) * (i + 0.5) / count], timber, 'fixture', yaw, 0, 'rural-fence-rail')
    }
  }
  const porchFront = porch ? z1 + 0.16 + porch.depth + 0.34 : z1 + 0.16
  if (['barn', 'silos'].includes(feature)) {
    silo(x1 + 2.45, z0 + 2.4, feature === 'barn' ? 7 : 8.4)
    if (feature === 'silos') silo(x1 + 2.45, z0 + 6.5, 6.6)
  }
  if (feature === 'water-tower') silo(x1 + 2.45, z0 + 2.4, 3, true)
  if (feature === 'barn' && !severe) {
    const loftY = F + 3.2, loftDepth = 2.4, width = x1 - x0 - 0.2
    for (const px of [x0 + 0.2, x1 - 0.2]) stand([0.15, 3.2, 0.15], px, F, z0 + loftDepth, timber, 'hayloft-support', 'column')
    solid([width, 0.18, loftDepth], [(x0 + x1) / 2, loftY + 0.09, z0 + 0.1 + loftDepth / 2], timber, 'hayloft-deck', 'floor')
    for (let i = 0; i < 4; i++) asset('hay-bale', [x0 + width * (i + 1) / 5, loftY + 0.18, z0 + 1.25], 0, 0)
  }
  if (['farmstead', 'paddock', 'barn', 'fishing'].includes(feature)) {
    const yardFront = Math.max(z1 + 5, porchFront + 2), gate = model.entrance[0]
    fence([x0 - 1.5, z0 - 1.5], [x0 - 1.5, yardFront])
    fence([x0 - 1.5, yardFront], [gate - 1.6, yardFront])
    fence([gate + 1.6, yardFront], [x1 + 6, yardFront])
    if (feature === 'paddock') fence([x1 + 6, yardFront], [x1 + 6, z0 - 1.5])
    if (feature === 'farmstead') {
      asset('well', [x1 + 2, 0, z1 - 3])
      asset('seedling-bench', [x1 + 2, 0, z1 - 6])
    }
  }
  if (feature === 'greenhouse' && !severe) asset('water-tank', [x1 + 1.1, 0, z0 + 1.5])
  if (feature === 'sawmill' || feature === 'cabin' || id === 'wood-house') {
    for (let i = 0; i < (feature === 'sawmill' ? 3 : 1); i++) asset('log-stack', [x1 + 1.5, 0, z0 + 2 + i * 3], 0, 0)
  }
  if (feature === 'lookout' && !severe) {
    const px = x0 - 1.8, pz = z1 - 2, width = 2.4, height = 7
    solid([width, F, width], [px, F / 2, pz], 'concrete', 'tower-foundation', 'foundation')
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) stand([0.24, height, 0.24], px + dx * (width - 0.24) / 2, F, pz + dz * (width - 0.24) / 2, timber, 'tower-corner', 'column')
    solid([width + 0.4, 0.15, width + 0.4], [px, F + height + 0.075, pz], timber, 'tower-roof', 'roof')
  }
  if (feature === 'platform') {
    const width = x1 - x0, depth = 4.2, pz0 = z1 + 0.16
    solid([width, F, depth], [(x0 + x1) / 2, F / 2, pz0 + depth / 2], 'concrete', 'station-platform', 'floor', [0.88, 0.86, 0.82])
    solid([width, 0.012, 0.3], [(x0 + x1) / 2, F + 0.006, pz0 + depth - 0.15], 'plaster', 'platform-edge-line', 'fixture', YELLOW)
    model.entrance = [model.entrance[0], 0, pz0 + depth + 1.2]
    if (!severe) {
      let lowest = F + 3.4
      for (let x = x0; x <= x1; x += 0.5) { const bt = roof.bottomAt(x, face + 0.4); if (Number.isFinite(bt)) lowest = Math.min(lowest, bt - 0.3) }
      const canopy = Math.max(F + 2.7, lowest)
      for (let x = x0 + 1.2; x <= x1 - 1.1; x += 3.4) cylinder(0.22, canopy - F - 0.2, x, F, pz0 + depth - 0.6, steel, 'platform-column', [0.3, 0.42, 0.36], 'column')
      solid([width + 0.4, 0.2, depth - 0.6], [(x0 + x1) / 2, canopy - 0.1, pz0 + (depth - 0.6) / 2 + 0.3], steel, 'platform-canopy', 'roof', [0.3, 0.42, 0.36])
      for (const px of [x0 + 2.4, x1 - 2.4]) asset('bench', [px, F, pz0 + 1.6], Math.PI)
    }
  }
  if (feature === 'fuel-canopy') {
    const cx = x1 + 5.4, cz = (z0 + z1) / 2, width = 7.4, depth = 10.4, roofY = severe ? 1 : 4.3
    solid([width + 1, 0.12, depth + 1], [cx, 0.06, cz], 'concrete', 'fuel-forecourt', 'foundation', [0.82, 0.82, 0.8])
    for (const dz of [-1, 1]) solid([1.2, 0.18, 3.4], [cx, 0.12 + 0.09, cz + dz * 2.2], 'concrete', 'pump-island', 'floor', [1, 0.95, 0.4])
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) stand([0.36, roofY - 0.12, 0.36], cx + dx * 2.9, 0.12, cz + dz * 4.3, 'plaster', 'fuel-canopy-column', 'column', WHITE)
    if (!severe) {
      solid([width, 0.32, depth], [cx, roofY + 0.16, cz], 'plaster', 'fuel-canopy-roof', 'roof', WHITE)
      for (const side of [-1, 1]) solid([width + 0.04, 0.5, 0.04], [cx, roofY + 0.16, cz + side * (depth / 2 + 0.02)], 'plaster', 'canopy-fascia', 'fixture', burned ? [0.2, 0.2, 0.2] : style.sign ?? RED)
      for (const side of [-1, 1]) solid([0.04, 0.5, depth], [cx + side * (width / 2 + 0.02), roofY + 0.16, cz], 'plaster', 'canopy-fascia', 'fixture', burned ? [0.2, 0.2, 0.2] : style.sign ?? RED)
      for (const dz of [-1, 1]) asset('fuel-pump', [cx, 0.3, cz + dz * 2.2], Math.PI / 2)
      const px = cx + width / 2 + 1.8, pz = z1 + 1.5
      stand([0.9, 0.3, 0.6], px, 0, pz, 'concrete', 'price-pylon-base', 'foundation')
      stand([0.5, 5.2, 0.3], px, 0.3, pz, 'plaster', 'price-pylon', 'fixture', style.sign ?? RED)
      for (let i = 0; i < 3; i++) solid([0.4, 0.32, 0.02], [px, 2.4 + i * 0.5, pz + 0.16], 'plaster', 'price-panel', 'fixture', [0.1, 0.1, 0.12])
    }
  }
}

export function plinthHeight(style: Style, facades: FacadeRecord[]) {
  let height = style.plinth.height
  for (const f of facades) if (f.level === 0) for (const o of f.openings) if (o.y0 > 0.05) height = Math.min(height, o.y0 - 0.1)
  return Math.max(0.12, height)
}
