import type { Architecture } from './architecture'
import { brandStyle } from './identity'
import { hash, random, type Blueprint, type MaterialKey, type Vec3 } from './types'

export type RoofForm = 'gable' | 'hip' | 'gambrel' | 'flat' | 'shed' | 'sawtooth' | 'frame'
export type Finish = { material: MaterialKey; tint: Vec3 }
export type Sash = [columns: number, rows: number]
export type WindowStyle = { width: number; height: number; sill: number; top: Sash; bottom?: Sash; shutters: boolean; casing: boolean; grille: boolean; pediment: boolean; max: number }
export type Style = {
  id: string
  label: string
  wall: Finish & { relief?: 'siding' | 'battens' }
  lower?: Finish & { height: number }
  trim: Finish
  accent: Vec3
  plinth: Finish & { height: number }
  roof: Finish & { form: RoofForm; pitch: number; overhang: number; courses: 'shingle' | 'tile' | 'seam' | 'none'; ridge: boolean }
  parapet: Finish & { height: number }
  window: WindowStyle
  corners: 'boards' | 'quoins' | 'none'
  door: 'panel' | 'glass' | 'roll'
  storefront: 'glass' | 'roll'
  sign?: Vec3

  bands?: Band[]
}
export type Band = { y0: number; y1: number; tint: Vec3; material?: MaterialKey }

const C = (r: number, g: number, b: number): Vec3 => [r, g, b]

export const PAINT = {
  white: C(1.02, 1.02, 1.04), cream: C(1, 0.94, 0.82), butter: C(1, 0.86, 0.52), mustard: C(0.96, 0.7, 0.3), sage: C(0.64, 0.74, 0.56),
  mint: C(0.66, 0.86, 0.74), sky: C(0.6, 0.76, 0.92), slate: C(0.44, 0.54, 0.66), coral: C(1, 0.62, 0.5), terracotta: C(0.86, 0.46, 0.32),
  rose: C(1, 0.7, 0.72), stone: C(0.74, 0.72, 0.68), graphite: C(0.36, 0.37, 0.4), colonialBlue: C(0.34, 0.54, 0.86), ochre: C(0.95, 0.74, 0.36),
  teal: C(0.34, 0.66, 0.66), lilac: C(0.8, 0.72, 0.9), olive: C(0.56, 0.6, 0.4), brown: C(0.58, 0.44, 0.34),
} as const
const TRIM = { white: C(1.05, 1.05, 1.06), ivory: C(1, 0.96, 0.88), dark: C(0.26, 0.26, 0.28), bronze: C(0.42, 0.34, 0.26) }
const ACCENT = [C(0.2, 0.36, 0.27), C(0.14, 0.14, 0.15), C(0.18, 0.25, 0.42), C(0.62, 0.17, 0.14), C(0.16, 0.42, 0.44), C(0.45, 0.3, 0.2)]
const ROOF = {
  asphalt: { material: 'rubber' as MaterialKey, tint: C(1.05, 1.05, 1.08) }, charcoal: { material: 'rubber' as MaterialKey, tint: C(0.72, 0.72, 0.76) },
  brownAsphalt: { material: 'rubber' as MaterialKey, tint: C(1.25, 1.02, 0.84) }, slate: { material: 'rubber' as MaterialKey, tint: C(0.86, 0.94, 1.08) },
  clay: { material: 'plaster' as MaterialKey, tint: C(0.8, 0.38, 0.24) }, clayDark: { material: 'plaster' as MaterialKey, tint: C(0.62, 0.32, 0.22) },
  galvanized: { material: 'steel' as MaterialKey, tint: C(1, 1, 1) }, redMetal: { material: 'steel' as MaterialKey, tint: C(0.95, 0.42, 0.36) },
  greenMetal: { material: 'steel' as MaterialKey, tint: C(0.5, 0.74, 0.56) }, cedar: { material: 'wood' as MaterialKey, tint: C(0.92, 0.82, 0.72) },
}

type Rng = () => number
const pick = <T,>(rng: Rng, list: readonly T[]) => list[Math.floor(rng() * list.length)]
const plaster = (tint: Vec3, relief?: 'siding' | 'battens'): Style['wall'] => ({ material: 'plaster', tint, relief })
const parapet = (tint: Vec3 = TRIM.ivory): Style['parapet'] => ({ material: 'concrete', tint, height: 0.7 })

function colonial(rng: Rng): Style {
  const brick = rng() < 0.35
  return {
    id: 'colonial', label: 'Colonial americana',
    wall: brick ? { material: 'brick', tint: pick(rng, [C(1, 1, 1), C(0.86, 0.78, 0.74), C(1.08, 0.94, 0.86)]) } : plaster(pick(rng, [PAINT.white, PAINT.sky, PAINT.butter, PAINT.sage, PAINT.slate, PAINT.cream]), 'siding'),
    trim: { material: 'plaster', tint: TRIM.white }, accent: pick(rng, ACCENT.slice(0, 4)),
    plinth: { material: 'brick', tint: C(0.86, 0.8, 0.76), height: 0.42 },
    roof: { ...pick(rng, [ROOF.asphalt, ROOF.charcoal, ROOF.slate]), form: 'gable', pitch: 0.62 + rng() * 0.1, overhang: 0.42, courses: 'shingle', ridge: true },
    parapet: parapet(),
    window: { width: 0.92, height: 1.48, sill: 0.86, top: [3, 2], bottom: [3, 2], shutters: true, casing: true, grille: false, pediment: rng() < 0.4, max: 2 },
    corners: 'boards', door: 'panel', storefront: 'glass',
  }
}
function craftsman(rng: Rng): Style {
  return {
    id: 'craftsman', label: 'Craftsman',
    wall: plaster(pick(rng, [PAINT.sage, PAINT.olive, PAINT.brown, PAINT.mustard, PAINT.slate]), 'siding'),
    lower: { material: 'brick', tint: pick(rng, [C(0.78, 0.74, 0.7), C(0.95, 0.85, 0.8)]), height: 0.9 },
    trim: { material: 'plaster', tint: pick(rng, [TRIM.ivory, TRIM.bronze]) }, accent: pick(rng, ACCENT),
    plinth: { material: 'concrete', tint: C(0.8, 0.78, 0.74), height: 0.3 },
    roof: { ...pick(rng, [ROOF.brownAsphalt, ROOF.charcoal, ROOF.asphalt]), form: 'gable', pitch: 0.42 + rng() * 0.08, overhang: 0.62, courses: 'shingle', ridge: true },
    parapet: parapet(),
    window: { width: 1.02, height: 1.4, sill: 0.9, top: [3, 1], bottom: [1, 1], shutters: false, casing: true, grille: false, pediment: false, max: 2 },
    corners: 'boards', door: 'panel', storefront: 'glass',
  }
}
function ranch(rng: Rng): Style {
  const brick = rng() < 0.55
  return {
    id: 'ranch', label: 'Rancho térreo',
    wall: brick ? { material: 'brick', tint: pick(rng, [C(0.92, 0.84, 0.8), C(1, 1, 1), C(0.8, 0.7, 0.66)]) } : plaster(pick(rng, [PAINT.cream, PAINT.stone, PAINT.sky, PAINT.white])),
    trim: { material: 'plaster', tint: TRIM.white }, accent: pick(rng, ACCENT),
    plinth: { material: 'concrete', tint: C(0.78, 0.76, 0.72), height: 0.28 },
    roof: { ...pick(rng, [ROOF.asphalt, ROOF.brownAsphalt, ROOF.charcoal]), form: 'hip', pitch: 0.4 + rng() * 0.06, overhang: 0.55, courses: 'shingle', ridge: false },
    parapet: parapet(),
    window: { width: 1.18, height: 1.2, sill: 1.0, top: [1, 1], bottom: [1, 1], shutters: rng() < 0.5, casing: true, grille: false, pediment: false, max: 2 },
    corners: 'none', door: 'panel', storefront: 'glass',
  }
}
function farmhouse(rng: Rng): Style {
  return {
    id: 'farmhouse', label: 'Casa de fazenda vitoriana',
    wall: plaster(pick(rng, [PAINT.white, PAINT.cream, PAINT.butter, PAINT.sky]), 'battens'),
    trim: { material: 'plaster', tint: TRIM.white }, accent: pick(rng, [ACCENT[1], ACCENT[3], ACCENT[0]]),
    plinth: { material: 'concrete', tint: C(0.74, 0.72, 0.68), height: 0.36 },
    roof: { ...pick(rng, [ROOF.galvanized, ROOF.redMetal, ROOF.greenMetal]), form: 'gable', pitch: 0.82 + rng() * 0.12, overhang: 0.38, courses: 'seam', ridge: true },
    parapet: parapet(),
    window: { width: 0.86, height: 1.62, sill: 0.82, top: [2, 1], bottom: [2, 1], shutters: rng() < 0.6, casing: true, grille: false, pediment: false, max: 2 },
    corners: 'boards', door: 'panel', storefront: 'glass',
  }
}
function brazilian(rng: Rng): Style {
  return {
    id: 'brazilian', label: 'Casa de bairro brasileira',
    wall: plaster(pick(rng, [PAINT.coral, PAINT.butter, PAINT.colonialBlue, PAINT.mint, PAINT.rose, PAINT.ochre, PAINT.teal, PAINT.lilac, PAINT.white])),
    trim: { material: 'plaster', tint: pick(rng, [TRIM.white, TRIM.ivory]) }, accent: pick(rng, [ACCENT[4], ACCENT[3], ACCENT[5], ACCENT[2]]),
    plinth: { material: 'plaster', tint: pick(rng, [PAINT.graphite, PAINT.terracotta, PAINT.slate]), height: 0.5 },
    roof: { ...pick(rng, [ROOF.clay, ROOF.clayDark]), form: 'hip', pitch: 0.5 + rng() * 0.06, overhang: 0.5, courses: 'tile', ridge: false },
    parapet: parapet(),
    window: { width: 1.18, height: 1.2, sill: 1.0, top: [2, 1], bottom: [2, 1], shutters: false, casing: false, grille: true, pediment: false, max: 2 },
    corners: 'none', door: 'panel', storefront: 'roll',
  }
}
function modern(rng: Rng): Style {
  return {
    id: 'modern', label: 'Moderna de laje',
    wall: plaster(pick(rng, [PAINT.white, PAINT.stone, PAINT.graphite, PAINT.cream])),
    trim: { material: 'steel', tint: TRIM.dark }, accent: pick(rng, [ACCENT[1], ACCENT[5]]),
    plinth: { material: 'concrete', tint: C(0.7, 0.7, 0.7), height: 0.22 },
    roof: { ...ROOF.charcoal, form: 'flat', pitch: 0, overhang: 0, courses: 'none', ridge: false },
    parapet: parapet(pick(rng, [PAINT.white, PAINT.stone])),
    window: { width: 1.5, height: 1.5, sill: 0.8, top: [2, 1], shutters: false, casing: false, grille: false, pediment: false, max: 2 },
    corners: 'none', door: 'glass', storefront: 'glass',
  }
}
function cabin(rng: Rng): Style {
  return {
    id: 'cabin', label: 'Cabana de troncos',
    wall: { material: 'wood', tint: pick(rng, [C(1, 0.94, 0.86), C(0.84, 0.72, 0.62), C(1.08, 0.98, 0.86)]), relief: 'siding' },
    trim: { material: 'wood', tint: C(0.7, 0.6, 0.5) }, accent: C(0.5, 0.36, 0.24),
    plinth: { material: 'concrete', tint: C(0.72, 0.7, 0.66), height: 0.4 },
    roof: { ...pick(rng, [ROOF.cedar, ROOF.greenMetal, ROOF.charcoal]), form: 'gable', pitch: 0.7 + rng() * 0.1, overhang: 0.5, courses: 'shingle', ridge: true },
    parapet: parapet(),
    window: { width: 0.82, height: 1.1, sill: 1.0, top: [2, 1], bottom: [2, 1], shutters: rng() < 0.5, casing: true, grille: false, pediment: false, max: 1 },
    corners: 'none', door: 'panel', storefront: 'glass',
  }
}
function mainStreet(rng: Rng): Style {
  const brick = rng() < 0.6
  return {
    id: 'main-street', label: 'Comércio de rua principal',
    wall: brick ? { material: 'brick', tint: pick(rng, [C(1, 1, 1), C(0.84, 0.76, 0.72), C(1.1, 0.96, 0.84)]) } : plaster(pick(rng, [PAINT.cream, PAINT.butter, PAINT.stone, PAINT.sage])),
    trim: { material: 'plaster', tint: TRIM.ivory }, accent: pick(rng, ACCENT),
    plinth: { material: 'concrete', tint: C(0.66, 0.66, 0.66), height: 0.2 },
    roof: { ...ROOF.charcoal, form: 'flat', pitch: 0, overhang: 0, courses: 'none', ridge: false },
    parapet: { material: brick ? 'brick' : 'plaster', tint: brick ? C(0.92, 0.86, 0.82) : TRIM.ivory, height: 0.95 },
    window: { width: 1.0, height: 1.55, sill: 0.95, top: [1, 1], bottom: [1, 1], shutters: false, casing: true, grille: false, pediment: false, max: 2 },
    corners: brick ? 'none' : 'quoins', door: 'glass', storefront: 'glass', sign: pick(rng, [C(0.62, 0.17, 0.14), C(0.18, 0.25, 0.42), C(0.2, 0.36, 0.27), C(0.14, 0.14, 0.15)]),
  }
}
function bairroShop(rng: Rng): Style {
  return {
    id: 'bairro-shop', label: 'Comércio de bairro com porta de aço',
    wall: plaster(pick(rng, [PAINT.butter, PAINT.coral, PAINT.mint, PAINT.sky, PAINT.white, PAINT.ochre, PAINT.rose])),
    trim: { material: 'plaster', tint: TRIM.white }, accent: pick(rng, ACCENT),
    plinth: { material: 'plaster', tint: pick(rng, [PAINT.graphite, PAINT.terracotta]), height: 0.45 },
    roof: { ...ROOF.clay, form: 'flat', pitch: 0, overhang: 0, courses: 'none', ridge: false },
    parapet: parapet(TRIM.white),
    window: { width: 1.2, height: 1.1, sill: 1.1, top: [2, 1], shutters: false, casing: false, grille: true, pediment: false, max: 2 },
    corners: 'none', door: 'roll', storefront: 'roll', sign: pick(rng, [C(0.86, 0.2, 0.16), C(0.16, 0.36, 0.72), C(0.2, 0.55, 0.3), C(0.95, 0.72, 0.18)]),
  }
}
function industrial(rng: Rng): Style {
  return {
    id: 'industrial', label: 'Galpão industrial',
    wall: { material: 'steel', tint: pick(rng, [C(1, 1, 1), C(0.7, 0.82, 0.92), C(0.92, 0.9, 0.82), C(0.95, 0.6, 0.52)]) },
    lower: { material: 'concrete', tint: C(0.86, 0.84, 0.8), height: 1.2 },
    trim: { material: 'steel', tint: TRIM.dark }, accent: pick(rng, [C(0.95, 0.68, 0.14), C(0.62, 0.17, 0.14), C(0.18, 0.25, 0.42)]),
    plinth: { material: 'concrete', tint: C(0.7, 0.7, 0.7), height: 0.2 },
    roof: { ...ROOF.galvanized, form: 'sawtooth', pitch: 0.3, overhang: 0.3, courses: 'seam', ridge: false },
    parapet: parapet(C(0.8, 0.8, 0.8)),
    window: { width: 2.2, height: 0.75, sill: 2.4, top: [4, 1], shutters: false, casing: false, grille: false, pediment: false, max: 1 },
    corners: 'none', door: 'roll', storefront: 'roll',
  }
}
function civic(rng: Rng, classical: boolean): Style {
  const brick = !classical && rng() < 0.5
  return {
    id: classical ? 'classical' : 'civic', label: classical ? 'Cívico clássico' : 'Institucional',
    wall: brick ? { material: 'brick', tint: pick(rng, [C(1, 1, 1), C(0.9, 0.82, 0.78)]) } : classical ? plaster(pick(rng, [PAINT.cream, PAINT.stone, PAINT.white])) : { material: 'concrete', tint: pick(rng, [C(1, 1, 1), C(1.05, 1, 0.92), C(0.9, 0.94, 1)]) },
    trim: { material: classical ? 'plaster' : 'concrete', tint: TRIM.ivory }, accent: pick(rng, [ACCENT[2], ACCENT[0], ACCENT[5]]),
    plinth: { material: 'concrete', tint: C(0.72, 0.7, 0.66), height: classical ? 0.6 : 0.36 },
    roof: classical ? { ...ROOF.slate, form: 'hip', pitch: 0.42, overhang: 0.35, courses: 'shingle', ridge: false } : { ...ROOF.charcoal, form: 'flat', pitch: 0, overhang: 0, courses: 'none', ridge: false },
    parapet: { material: 'concrete', tint: TRIM.ivory, height: classical ? 0.9 : 0.75 },
    window: classical ? { width: 1.0, height: 1.7, sill: 0.95, top: [2, 2], bottom: [2, 2], shutters: false, casing: true, grille: false, pediment: true, max: 2 }
      : { width: 2.2, height: 1.35, sill: 1.0, top: [3, 1], shutters: false, casing: false, grille: false, pediment: false, max: 1 },
    corners: classical ? 'quoins' : 'none', door: 'glass', storefront: 'glass',
  }
}
function barnStyle(rng: Rng): Style {
  return {
    id: 'barn', label: 'Celeiro rural',
    wall: { material: 'wood', tint: pick(rng, [C(1.7, 0.62, 0.5), C(1.5, 0.56, 0.46), C(1.1, 1.05, 1)]), relief: 'battens' },
    trim: { material: 'plaster', tint: TRIM.white }, accent: C(1.02, 1.02, 1.02),
    plinth: { material: 'concrete', tint: C(0.72, 0.7, 0.66), height: 0.5 },
    roof: { ...pick(rng, [ROOF.galvanized, ROOF.redMetal]), form: 'gambrel', pitch: 1, overhang: 0.32, courses: 'seam', ridge: true },
    parapet: parapet(),
    window: { width: 0.8, height: 0.8, sill: 1.8, top: [2, 2], shutters: false, casing: true, grille: false, pediment: false, max: 1 },
    corners: 'boards', door: 'roll', storefront: 'roll',
  }
}

const HOMES: Record<string, ((rng: Rng) => Style)[]> = {
  default: [colonial, craftsman, ranch, brazilian, brazilian, modern, farmhouse],
  'wood-house': [cabin], bungalow: [craftsman], 'rental-room': [brazilian, modern], 'shop-house': [bairroShop, mainStreet], 'unfinished-house': [brazilian],
  'residential-court': [brazilian, colonial], 'boarding-house': [colonial, brazilian], rowhouse: [brazilian, colonial, mainStreet], 'caretaker-house': [brazilian, ranch],
}

export function styleFor(blueprint: Blueprint, profile: Architecture, seed: number): Style {
  const rng = random(hash(`${blueprint.id}:${seed}:style`))
  const id = blueprint.id
  let style: Style
  if (profile.roof === 'sawtooth' || profile.facade === 'industrial') {
    style = industrial(rng)
    if (profile.roof !== 'sawtooth') style = { ...style, roof: { ...style.roof, form: profile.roof === 'flat' ? 'flat' : 'gable', pitch: 0.36, overhang: 0.35 } }
  }
  else if (id === 'barn' || id === 'stable') style = barnStyle(rng)
  else if (profile.facade === 'timber' && blueprint.category !== 'Residências') style = cabin(rng)
  else if (id === 'diner') style = { ...mainStreet(rng), id: 'diner', label: 'Diner americano', wall: { material: 'steel', tint: C(1.05, 1.05, 1.08) }, lower: { material: 'plaster', tint: C(0.86, 0.16, 0.14), height: 0.45 } }
  else if (blueprint.category === 'Residências') style = pick(rng, HOMES[id] ?? HOMES.default)(rng)
  else if (['farmhouse'].includes(id)) style = farmhouse(rng)
  else if (['hunting-cabin', 'ranger-cabin', 'fishing-cabin'].includes(id)) style = cabin(rng)
  else if (['bank', 'town-hall', 'library', 'church', 'funeral-home', 'post-office'].includes(id)) style = civic(rng, true)
  else if (blueprint.category === 'Serviços públicos' || ['hospital-building', 'office-building', 'research-outpost'].includes(id)) style = civic(rng, false)
  else if (id === 'apartment-building') style = modern(rng)
  else if (blueprint.category === 'Comércios') style = rng() < 0.5 ? bairroShop(rng) : mainStreet(rng)
  else if (blueprint.category === 'Fazendas') style = rng() < 0.5 ? farmhouse(rng) : cabin(rng)
  else style = civic(rng, false)
  if (profile.roof === 'sawtooth' || profile.roof === 'frame') style = { ...style, roof: { ...style.roof, form: profile.roof } }
  else if (profile.roof === 'gambrel') style = { ...style, roof: { ...style.roof, form: 'gambrel' } }
  if (id === 'church') style = { ...style, roof: { ...ROOF.slate, form: 'gable', pitch: 1.0, overhang: 0.3, courses: 'shingle', ridge: true }, window: { ...style.window, width: 0.9, height: 2.1, sill: 1.2, top: [2, 3], bottom: undefined, pediment: true } }
  if (id === 'rural-clinic' || id === 'greenhouse') style = { ...style, roof: { ...style.roof, form: id === 'greenhouse' ? 'frame' : 'gable' } }
  return brandStyle(style, blueprint, rng)
}
