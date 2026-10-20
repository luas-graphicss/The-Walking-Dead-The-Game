import type { Band, Style } from './style'
import { hash, random, type Blueprint, type Condition, type MaterialKey, type Vec3, type WeatherProfile } from './types'

type Rng = () => number
const C = (r: number, g: number, b: number): Vec3 => [r, g, b]
const pick = <T,>(rng: Rng, list: readonly T[]) => list[Math.floor(rng() * list.length)]

const X = {
  coolWhite: C(1, 1.06, 1.22), white: C(1.02, 1.02, 1.04), cream: C(1, 0.94, 0.82), butter: C(1, 0.86, 0.52), ochre: C(0.95, 0.74, 0.36),
  stone: C(0.74, 0.72, 0.68), sand: C(0.95, 0.84, 0.66), lightGray: C(0.82, 0.85, 0.9), graphite: C(0.36, 0.37, 0.4), charcoal: C(0.22, 0.23, 0.26), black: C(0.1, 0.1, 0.11),
  sky: C(0.6, 0.76, 0.92), mint: C(0.66, 0.86, 0.74), sage: C(0.64, 0.74, 0.56), teal: C(0.3, 0.64, 0.66), lilac: C(0.8, 0.72, 0.9), rose: C(1, 0.7, 0.72),
  salmon: C(1.05, 0.66, 0.56), terracotta: C(0.86, 0.46, 0.32), coral: C(1, 0.6, 0.5), brownPaint: C(0.5, 0.36, 0.26), olive: C(0.46, 0.5, 0.32), khaki: C(0.86, 0.78, 0.56),
  forest: C(0.24, 0.42, 0.28), navy: C(0.16, 0.22, 0.46), burgundy: C(0.58, 0.18, 0.18), purple: C(0.4, 0.24, 0.55), colonialBlue: C(0.34, 0.54, 0.86),
  red: C(1.05, 0.22, 0.17), yellow: C(1.15, 0.9, 0.22), orange: C(1.15, 0.5, 0.18), green: C(0.34, 0.78, 0.36), blue: C(0.24, 0.5, 1.15), pink: C(1.1, 0.5, 0.74),
  medBlue: C(0.3, 0.6, 1), policeBlue: C(0.2, 0.34, 0.78), gold: C(0.95, 0.72, 0.3), brownSign: C(0.4, 0.26, 0.16),
}
const P = (tint: Vec3, relief?: 'siding' | 'battens'): Style['wall'] => ({ material: 'plaster', tint, relief })
const BR = (tint: Vec3 = C(1, 1, 1)): Style['wall'] => ({ material: 'brick', tint })
const ST = (tint: Vec3): Style['wall'] => ({ material: 'steel', tint })
const WD = (tint: Vec3, relief: 'siding' | 'battens' = 'siding'): Style['wall'] => ({ material: 'wood', tint, relief })
const CO = (tint: Vec3): Style['wall'] => ({ material: 'concrete', tint })
const T = (tint: Vec3, material: MaterialKey = 'plaster'): Style['trim'] => ({ material, tint })
const low = (material: MaterialKey, tint: Vec3, height: number): Style['lower'] => ({ material, tint, height })

const stripes = (y0: number, h: number, ...tints: Vec3[]): Band[] => tints.map((tint, i) => ({ y0: y0 + i * h, y1: y0 + (i + 1) * h, tint }))

const fascia = (h: number, ...tints: Vec3[]): Band[] => tints.map((tint, i) => ({ y0: -0.18 - (tints.length - i) * h, y1: -0.18 - (tints.length - i - 1) * h, tint }))
type RoofFinish = Pick<Style['roof'], 'material' | 'tint'>
const R = (material: MaterialKey, tint: Vec3): RoofFinish => ({ material, tint })
const ROOF = {
  asphalt: R('rubber', C(1.05, 1.05, 1.08)), charcoal: R('rubber', C(0.72, 0.72, 0.76)), black: R('rubber', C(0.46, 0.46, 0.5)), brown: R('rubber', C(1.32, 0.98, 0.74)), slate: R('rubber', C(0.86, 0.94, 1.08)),
  clay: R('plaster', C(0.8, 0.38, 0.24)), clayDark: R('plaster', C(0.62, 0.32, 0.22)), grayTile: R('plaster', C(0.5, 0.5, 0.52)), blackTile: R('plaster', C(0.24, 0.24, 0.26)), brownTile: R('plaster', C(0.48, 0.32, 0.22)),
  galvanized: R('steel', C(1, 1, 1)), red: R('steel', C(0.95, 0.42, 0.36)), green: R('steel', C(0.5, 0.74, 0.56)), blue: R('steel', C(0.5, 0.62, 0.95)), rust: R('steel', C(0.86, 0.56, 0.42)),
  cedar: R('wood', C(0.92, 0.82, 0.72)), fiber: R('concrete', C(0.98, 0.98, 0.95)),
}

type Brand = { wall?: Style['wall'][]; lower?: (Style['lower'] | null)[]; trim?: Style['trim'][]; sign?: Vec3[]; accent?: Vec3[]; roof?: RoofFinish[]; bands?: (Band[] | null)[]; plinth?: Vec3[] }

const BRANDS: Record<string, Brand> = {

  pharmacy: { wall: [P(X.coolWhite), P(X.mint)], sign: [X.green, X.blue], bands: [fascia(0.24, X.green), fascia(0.24, X.blue)], trim: [T(X.coolWhite)] },
  'gun-store': { wall: [P(X.olive), P(X.charcoal), BR(C(0.8, 0.7, 0.66))], sign: [X.black, X.orange], trim: [T(X.charcoal, 'steel')] },
  grocery: { wall: [P(X.butter), P(X.cream), P(X.salmon)], sign: [X.red, X.forest], bands: [fascia(0.26, X.red), fascia(0.26, X.forest), null] },
  bakery: { wall: [P(X.ochre), P(X.cream), BR(C(1.08, 0.94, 0.86))], sign: [X.brownSign, X.burgundy], trim: [T(X.cream)] },
  butcher: { wall: [P(X.coolWhite), P(X.cream)], lower: [low('tile', C(0.98, 0.98, 1), 1.2), low('tile', C(0.62, 0.22, 0.2), 1)], sign: [X.red, X.burgundy] },
  produce: { wall: [P(X.sage), P(X.forest), P(X.mint)], lower: [low('wood', C(0.95, 0.82, 0.7), 0.9), null], sign: [X.forest, X.orange] },
  hardware: { wall: [ST(C(0.95, 0.6, 0.32)), ST(C(0.92, 0.9, 0.82)), ST(C(0.6, 0.7, 0.9))], sign: [X.orange, X.red] },
  clothing: { wall: [P(X.charcoal), P(X.black), P(X.white)], trim: [T(X.black, 'steel')], sign: [X.black, X.burgundy] },
  'shoe-store': { wall: [P(X.rose), P(X.salmon), P(X.stone)], sign: [X.navy, X.burgundy] },
  bookshop: { wall: [P(X.forest), P(X.navy), P(X.burgundy)], trim: [T(X.cream)], sign: [X.gold, X.black] },
  stationery: { wall: [P(X.sky), P(X.butter)], sign: [X.blue, X.red], bands: [fascia(0.2, X.blue), null] },
  electronics: { wall: [P(X.charcoal), P(X.lightGray)], sign: [X.blue, X.red], bands: [fascia(0.2, X.blue), fascia(0.2, X.red)] },
  'repair-shop': { wall: [BR(), P(X.ochre)], sign: [X.yellow, X.navy] },
  'furniture-store': { wall: [ST(C(0.92, 0.88, 0.8)), ST(C(0.75, 0.62, 0.5))], sign: [X.brownSign] },
  'thrift-store': { wall: [P(X.lilac), P(X.teal), P(X.ochre)], sign: [X.pink, X.forest] },
  pawnshop: { wall: [BR(C(0.78, 0.66, 0.6)), P(X.burgundy)], sign: [X.gold, X.black] },
  jeweler: { wall: [P(X.stone), P(X.black), P(X.cream)], trim: [T(X.gold), T(X.black, 'steel')], sign: [X.black, X.gold] },
  optician: { wall: [P(X.coolWhite), P(X.sky)], sign: [X.navy, X.blue] },
  'pet-store': { wall: [P(X.mint), P(X.butter), P(X.sky)], sign: [X.orange, X.green], bands: [stripes(0.34, 0.18, X.orange, X.green), null] },
  'flower-shop': { wall: [P(X.rose), P(X.lilac), P(X.white)], trim: [T(X.white)], sign: [X.forest, X.pink] },
  'garden-store': { wall: [P(X.sage), P(X.forest)], sign: [X.forest, X.ochre] },
  'fishing-store': { wall: [P(X.colonialBlue, 'siding'), P(X.white, 'siding'), WD(C(0.85, 0.92, 1.02))], trim: [T(X.white)], sign: [X.navy, X.red] },
  'camping-store': { wall: [P(X.olive), WD(C(0.9, 0.78, 0.64)), P(X.khaki)], sign: [X.forest, X.orange] },
  'sports-store': { wall: [P(X.charcoal), P(X.white)], bands: [fascia(0.18, X.red, X.white), stripes(0.4, 0.2, X.blue)], sign: [X.red, X.blue] },
  'toy-store': { wall: [P(X.butter), P(X.sky), P(X.coolWhite)], bands: [stripes(0.3, 0.16, X.red, X.yellow, X.green, X.blue)], sign: [X.red, X.blue] },
  'music-store': { wall: [P(X.black), P(X.burgundy), P(X.lilac)], sign: [X.gold, X.pink] },
  'photo-store': { wall: [P(X.yellow), P(X.white)], bands: [fascia(0.26, X.red), fascia(0.26, X.yellow)], sign: [X.red, X.yellow] },
  'paint-store': { wall: [P(X.white), P(X.coolWhite)], bands: [fascia(0.12, X.red, X.orange, X.yellow, X.green, X.blue)], sign: [X.navy] },
  'construction-supply': { wall: [ST(C(1, 0.86, 0.42)), ST(C(0.92, 0.9, 0.82))], accent: [X.yellow], sign: [X.orange] },
  'auto-parts': { wall: [ST(C(0.58, 0.68, 0.95)), ST(C(0.95, 0.5, 0.45))], sign: [X.red, X.blue] },
  'motorcycle-shop': { wall: [P(X.charcoal), P(X.graphite)], bands: [fascia(0.22, X.orange)], sign: [X.orange, X.black] },
  'bicycle-shop': { wall: [P(X.teal), P(X.mint), P(X.butter)], sign: [X.green, X.navy] },
  'tire-shop': { wall: [P(X.charcoal), BR(C(0.7, 0.6, 0.56))], bands: [fascia(0.24, X.yellow)], sign: [X.yellow, X.black] },
  garage: { wall: [ST(C(0.66, 0.74, 0.9)), ST(C(0.92, 0.9, 0.86)), ST(C(0.75, 0.82, 0.7))], sign: [X.blue, X.red] },
  'fuel-station': { wall: [P(X.coolWhite)], bands: [fascia(0.3, X.red), fascia(0.18, X.green, X.yellow), fascia(0.28, X.blue)], sign: [X.red, X.green, X.blue], trim: [T(X.coolWhite)] },
  'car-wash': { wall: [P(X.sky), P(X.coolWhite)], bands: [stripes(0.3, 0.2, X.blue, X.coolWhite, X.blue)], sign: [X.blue] },
  restaurant: { wall: [P(X.terracotta), P(X.cream), P(X.burgundy)], trim: [T(X.cream)], sign: [X.burgundy, X.forest] },
  cafe: { wall: [P(X.brownPaint), P(X.cream), P(X.forest)], trim: [T(X.cream)], sign: [X.forest, X.brownSign] },
  bar: { wall: [P(X.charcoal), P(X.burgundy), BR(C(0.72, 0.6, 0.56))], sign: [X.gold, X.red] },
  pizzeria: { wall: [P(X.cream), P(X.terracotta)], bands: [fascia(0.14, X.green, X.coolWhite, X.red)], sign: [X.red, X.forest] },
  'ice-cream': { wall: [P(X.coolWhite), P(X.rose)], bands: [stripes(0.3, 0.14, X.pink, X.coolWhite, X.mint, X.coolWhite, X.pink)], sign: [X.pink] },
  'tea-house': { wall: [WD(C(0.9, 0.8, 0.68)), P(X.sage)], sign: [X.forest] },
  laundry: { wall: [P(X.sky), P(X.coolWhite)], bands: [fascia(0.22, X.blue)], sign: [X.blue] },
  barbershop: { wall: [P(X.white), P(X.charcoal)], bands: [fascia(0.12, X.red, X.coolWhite, X.blue)], sign: [X.red, X.navy] },
  salon: { wall: [P(X.rose), P(X.lilac), BR(C(1.02, 0.86, 0.82))], sign: [X.pink, X.black] },
  tailor: { wall: [BR(), P(X.stone)], trim: [T(X.cream)], sign: [X.navy, X.black] },
  cobbler: { wall: [BR(C(0.8, 0.68, 0.62)), P(X.brownPaint)], sign: [X.brownSign] },
  'print-shop': { wall: [ST(C(1.05, 1.05, 1.05)), ST(C(0.7, 0.8, 0.92))], sign: [X.blue, X.black] },
  'internet-cafe': { wall: [P(X.navy), P(X.charcoal)], bands: [fascia(0.2, X.blue)], sign: [X.blue, X.green] },
  'arcade-hall': { wall: [P(X.black), P(X.purple)], bands: [fascia(0.16, X.pink, X.blue)], sign: [X.pink, X.blue] },
  'funeral-home': { wall: [P(X.stone), P(X.graphite), P(X.white)], trim: [T(X.black, 'steel'), T(X.stone)], sign: [X.black] },
  motel: { wall: [P(X.salmon), P(X.teal), P(X.butter)], bands: [fascia(0.22, X.teal), fascia(0.22, X.coral), null], sign: [X.pink, X.blue] },
  inn: { wall: [P(X.cream, 'siding'), P(X.white, 'siding'), BR()], trim: [T(X.white)], accent: [C(0.2, 0.36, 0.27), C(0.45, 0.16, 0.14)], sign: [X.forest, X.burgundy] },
  warehouse: { wall: [ST(C(0.92, 0.9, 0.82)), ST(C(0.7, 0.8, 0.7)), ST(C(0.8, 0.84, 0.9)), ST(C(0.95, 0.62, 0.5))] },
  'agro-store': { wall: [P(C(0.5, 0.75, 0.42)), P(X.butter)], bands: [fascia(0.26, X.yellow), fascia(0.26, X.green)], sign: [X.forest, X.yellow] },

  clinic: { wall: [P(X.coolWhite)], bands: [fascia(0.24, X.teal), stripes(0.9, 0.12, X.medBlue)], trim: [T(X.coolWhite)], sign: [X.medBlue, X.green] },
  'dental-clinic': { wall: [P(X.coolWhite), P(X.sky)], bands: [fascia(0.2, X.medBlue)], sign: [X.medBlue] },
  veterinary: { wall: [P(X.coolWhite), P(X.mint)], bands: [fascia(0.22, X.green)], sign: [X.green] },
  school: { wall: [P(X.butter), P(X.cream), BR()], lower: [low('plaster', C(0.36, 0.58, 0.4), 1.1), low('plaster', C(0.7, 0.5, 0.32), 1), null], trim: [T(X.white)], roof: [ROOF.clay, ROOF.fiber, ROOF.red] },
  daycare: { wall: [P(X.coolWhite), P(X.butter), P(X.mint)], bands: [stripes(0.42, 0.22, X.red, X.yellow, X.green, X.blue), stripes(0.46, 0.26, X.blue, X.yellow, X.pink), [...stripes(0.42, 0.24, X.green, X.yellow), ...fascia(0.22, X.red, X.blue)]], roof: [ROOF.red, ROOF.blue, ROOF.green], trim: [T(X.coolWhite)] },
  library: { wall: [BR(), BR(C(0.86, 0.78, 0.74)), P(X.stone)], trim: [T(X.cream)], accent: [C(0.2, 0.36, 0.27), C(0.18, 0.25, 0.42)] },
  police: { wall: [P(X.coolWhite), BR(C(0.9, 0.82, 0.78))], bands: [fascia(0.3, X.policeBlue), stripes(0.9, 0.18, X.policeBlue)], trim: [T(X.navy, 'steel')], sign: [X.policeBlue] },
  'fire-station': { wall: [BR(C(0.95, 0.8, 0.74)), BR()], trim: [T(X.white)], accent: [X.red], sign: [X.red], bands: [fascia(0.3, X.red), null] },
  'post-office': { wall: [BR(), P(X.cream)], bands: [fascia(0.22, X.navy), fascia(0.22, X.yellow)], sign: [X.navy, X.yellow] },
  bank: { wall: [P(X.stone), CO(C(1.02, 1, 0.96)), P(X.cream)], trim: [T(X.stone, 'concrete')], sign: [X.navy, X.forest] },
  church: { wall: [P(X.coolWhite), P(X.cream), CO(C(0.92, 0.9, 0.86))], roof: [ROOF.slate, ROOF.black, ROOF.clayDark] },
  'community-center': { wall: [CO(C(1.05, 1, 0.92)), P(X.sand)], bands: [fascia(0.3, X.orange), fascia(0.3, X.teal)], sign: [X.orange, X.teal] },
  'town-hall': { wall: [P(X.cream), P(X.stone), P(X.coolWhite)], trim: [T(X.white)], roof: [ROOF.slate, ROOF.green] },
  'bus-depot': { wall: [CO(C(0.92, 0.92, 0.94))], bands: [fascia(0.3, X.yellow), stripes(0.3, 0.3, X.yellow)], sign: [X.yellow] },
  'train-station': { wall: [BR(C(0.86, 0.72, 0.66)), BR()], trim: [T(X.cream)], roof: [ROOF.green, ROOF.slate, ROOF.black], accent: [C(0.2, 0.36, 0.27)] },
  shelter: { wall: [BR(), CO(C(0.96, 0.94, 0.9))], bands: [fascia(0.24, X.red), null] },
  'power-substation': { wall: [CO(C(0.85, 0.85, 0.86))], bands: [stripes(0.12, 0.1, X.yellow, X.black, X.yellow, X.black, X.yellow)] },
  'water-works': { wall: [CO(C(0.95, 0.96, 0.98))], bands: [fascia(0.3, X.medBlue)], sign: [X.medBlue] },

  farmhouse: { wall: [P(X.white, 'siding'), P(X.cream, 'siding'), P(X.butter, 'siding'), WD(C(1, 0.94, 0.86))], trim: [T(X.white)], roof: [ROOF.galvanized, ROOF.red, ROOF.green, ROOF.black] },
  stable: { wall: [WD(C(0.82, 0.62, 0.46), 'battens'), WD(C(1.4, 0.6, 0.48), 'battens'), WD(C(1, 0.96, 0.9), 'battens')] },
  'hunting-cabin': { wall: [WD(C(0.62, 0.5, 0.4)), WD(C(0.75, 0.62, 0.5))], roof: [ROOF.green, ROOF.rust, ROOF.charcoal] },
  'ranger-cabin': { wall: [WD(C(0.7, 0.82, 0.6)), WD(C(0.85, 0.75, 0.6))], roof: [ROOF.green, ROOF.red] },
  'fishing-cabin': { wall: [WD(C(0.82, 0.9, 1.05)), WD(C(1.05, 1, 0.95)), P(X.colonialBlue, 'siding')], roof: [ROOF.galvanized, ROOF.rust] },
  sawmill: { wall: [ST(C(0.9, 0.55, 0.42)), ST(C(0.85, 0.82, 0.72))], roof: [ROOF.rust, ROOF.galvanized] },
  'grain-store': { wall: [ST(C(1, 1, 1)), ST(C(1.05, 1.02, 0.95))], roof: [ROOF.galvanized] },
  'rural-clinic': { wall: [P(X.coolWhite, 'siding')], trim: [T(X.coolWhite)], bands: [stripes(0.9, 0.16, X.red)], roof: [ROOF.red, ROOF.galvanized] },

  'abandoned-base': { wall: [CO(C(0.72, 0.76, 0.6)), P(X.olive), CO(C(0.86, 0.82, 0.7))], bands: [stripes(0.2, 0.12, X.yellow, X.black, X.yellow)], trim: [T(X.olive, 'steel')] },
  'research-outpost': { wall: [P(X.coolWhite), ST(C(1.1, 1.1, 1.12))], bands: [fascia(0.24, X.orange)], trim: [T(X.charcoal, 'steel')] },
  'apartment-building': { wall: [P(X.salmon), P(X.sand), P(X.stone), P(X.sky), P(X.butter), BR()], bands: [fascia(0.24, X.white), null], trim: [T(X.white)] },
  'office-building': { wall: [CO(C(0.86, 0.9, 0.98)), P(X.charcoal), CO(C(1.02, 1, 0.96))], trim: [T(X.charcoal, 'steel')], bands: [fascia(0.3, X.navy), null] },
  'hospital-building': { wall: [P(X.coolWhite)], bands: [fascia(0.3, X.medBlue), fascia(0.3, X.teal), stripes(1, 0.14, X.medBlue)], trim: [T(X.coolWhite)], sign: [X.medBlue, X.red] },
}

const HOME_ROOFS: Record<string, RoofFinish[]> = {
  brazilian: [ROOF.clay, ROOF.clayDark, ROOF.grayTile, ROOF.blackTile, ROOF.brownTile],
  colonial: [ROOF.asphalt, ROOF.charcoal, ROOF.black, ROOF.brown, ROOF.slate],
  ranch: [ROOF.asphalt, ROOF.brown, ROOF.black, ROOF.charcoal],
  craftsman: [ROOF.brown, ROOF.charcoal, ROOF.black],
  farmhouse: [ROOF.galvanized, ROOF.red, ROOF.green, ROOF.black],
  cabin: [ROOF.cedar, ROOF.green, ROOF.charcoal, ROOF.rust],
  'main-street': [ROOF.charcoal, ROOF.black],
}
const HOME_WALLS: Record<string, Style['wall'][]> = {
  brazilian: [P(X.coral), P(X.butter), P(X.colonialBlue), P(X.mint), P(X.rose), P(X.ochre), P(X.teal), P(X.lilac), P(X.white), P(X.sand), P(X.salmon), P(X.sage), P(X.stone), P(X.terracotta)],
  colonial: [P(X.white, 'siding'), P(X.sky, 'siding'), P(X.butter, 'siding'), P(X.sage, 'siding'), P(C(0.44, 0.54, 0.66), 'siding'), P(X.cream, 'siding'), P(X.graphite, 'siding'), BR(), BR(C(0.86, 0.78, 0.74))],
}

export function brandStyle(style: Style, blueprint: Blueprint, rng: Rng): Style {
  let next = style
  if (blueprint.category === 'Residências') {
    const walls = HOME_WALLS[style.id], roofs = HOME_ROOFS[style.id]
    if (walls && rng() < 0.6) next = { ...next, wall: pick(rng, walls) }
    if (roofs) next = { ...next, roof: { ...next.roof, ...pick(rng, roofs) } }
  }
  const brand = BRANDS[blueprint.id]
  if (!brand) return next
  if (brand.wall) next = { ...next, wall: pick(rng, brand.wall) }
  if (brand.lower) next = { ...next, lower: pick(rng, brand.lower) ?? undefined }
  if (brand.trim) next = { ...next, trim: pick(rng, brand.trim) }
  if (brand.sign) next = { ...next, sign: pick(rng, brand.sign) }
  if (brand.accent) next = { ...next, accent: pick(rng, brand.accent) }
  if (brand.roof) next = { ...next, roof: { ...next.roof, ...pick(rng, brand.roof) } }
  if (brand.bands) next = { ...next, bands: pick(rng, brand.bands) ?? undefined }

  if (next.wall.relief && next.wall.material !== 'plaster' && next.wall.material !== 'wood') next = { ...next, wall: { ...next.wall, relief: undefined } }

  if (next.parapet.material === 'brick' && next.wall.material !== 'brick') next = { ...next, parapet: { ...next.parapet, material: 'plaster', tint: next.trim.material === 'plaster' ? next.trim.tint : next.wall.tint } }
  return next
}

export type SurfaceFinish = { material: MaterialKey; surface?: string; tint?: Vec3 }

export type Interior = { wall: Vec3; ceiling?: Vec3; floor: SurfaceFinish; wet: SurfaceFinish; quiet: SurfaceFinish; store: SurfaceFinish; lining: boolean; timber: boolean }

const WALL = {
  white: C(1, 1.06, 1.22), offWhite: C(1, 0.98, 0.94), lightGray: C(0.8, 0.83, 0.9), gray: C(0.62, 0.64, 0.7), beige: C(0.98, 0.9, 0.8),
  paleBlue: C(0.8, 0.9, 1.08), paleGreen: C(0.84, 0.95, 0.86), paleYellow: C(1.02, 0.97, 0.78), peach: C(1.02, 0.86, 0.78), lilac: C(0.9, 0.86, 1.06),
  mint: C(0.76, 0.95, 0.92), hospital: C(0.8, 0.94, 0.96), sand: C(0.94, 0.86, 0.74), olive: C(0.66, 0.7, 0.56),
}

const FLOOR = {
  hardwood: { material: 'wood', surface: 'wood-display-platform-0', tint: C(0.9, 2.2, 3) },
  oak: { material: 'wood', tint: C(2.4, 1.75, 1.15) },
  pine: { material: 'wood', surface: 'wood-dining-table-0' },
  carpetBeige: { material: 'fabric', tint: C(2.1, 1.65, 1.55) }, carpetBlue: { material: 'fabric', tint: C(0.62, 0.8, 1.9) },
  carpetGray: { material: 'fabric', tint: C(1.2, 1.1, 1.4) }, carpetRed: { material: 'fabric', tint: C(1.7, 0.36, 0.4) }, carpetGreen: { material: 'fabric', tint: C(0.6, 0.9, 0.72) },
  tileWhite: { material: 'tile' }, tileCream: { material: 'tile', tint: C(1, 0.9, 0.72) }, tileTerracotta: { material: 'tile', tint: C(0.56, 0.21, 0.11) },
  tileGray: { material: 'tile', tint: C(0.5, 0.51, 0.53) }, tileBlue: { material: 'tile', tint: C(0.56, 0.74, 0.92) }, tileGreen: { material: 'tile', tint: C(0.6, 0.82, 0.66) },
  terrazzo: { material: 'concrete', surface: 'concrete-stone-wall-0', tint: C(1.1, 1.08, 1.05) },
  concrete: { material: 'concrete' }, slab: { material: 'concrete', surface: 'concrete-floor-0' },
  vinylGray: { material: 'plaster', tint: C(0.5, 0.55, 0.66) }, vinylGreen: { material: 'plaster', tint: C(0.36, 0.6, 0.58) }, vinylBlue: { material: 'plaster', tint: C(0.34, 0.52, 0.86) },
  vinylBeige: { material: 'plaster', tint: C(0.68, 0.62, 0.56) }, matRed: { material: 'plaster', tint: C(0.72, 0.12, 0.1) }, matYellow: { material: 'plaster', tint: C(0.92, 0.72, 0.14) },
  matBlue: { material: 'plaster', tint: C(0.14, 0.4, 1.1) }, matGreen: { material: 'plaster', tint: C(0.2, 0.66, 0.32) },
  straw: { material: 'straw' },
} satisfies Record<string, SurfaceFinish>

type InteriorKit = { wall: Vec3[]; floor: SurfaceFinish[]; quiet?: SurfaceFinish[]; wet?: SurfaceFinish[]; store?: SurfaceFinish[]; ceiling?: Vec3 | null; lining?: boolean }
const KITS: Record<string, InteriorKit> = {
  home: { wall: [WALL.white, WALL.offWhite, WALL.beige, WALL.paleBlue, WALL.paleGreen, WALL.paleYellow, WALL.peach, WALL.lightGray, WALL.lilac], floor: [FLOOR.hardwood, FLOOR.oak, FLOOR.tileCream, FLOOR.tileTerracotta, FLOOR.pine, FLOOR.tileGray], quiet: [FLOOR.carpetBeige, FLOOR.carpetBlue, FLOOR.carpetGray, FLOOR.hardwood, FLOOR.oak, FLOOR.carpetGreen], wet: [FLOOR.tileWhite, FLOOR.tileBlue, FLOOR.tileGreen, FLOOR.tileCream] },
  cabin: { wall: [WALL.offWhite], floor: [FLOOR.oak, FLOOR.hardwood, FLOOR.pine], quiet: [FLOOR.oak, FLOOR.carpetRed, FLOOR.carpetGreen], wet: [FLOOR.tileTerracotta, FLOOR.oak] },
  health: { wall: [WALL.white, WALL.hospital, WALL.mint, WALL.paleBlue], floor: [FLOOR.vinylGray, FLOOR.vinylGreen, FLOOR.terrazzo, FLOOR.vinylBlue], wet: [FLOOR.tileWhite, FLOOR.tileBlue] },
  school: { wall: [WALL.paleYellow, WALL.paleGreen, WALL.offWhite, WALL.peach], floor: [FLOOR.terrazzo, FLOOR.vinylBeige, FLOOR.tileGray, FLOOR.oak], wet: [FLOOR.tileWhite] },
  kids: { wall: [WALL.paleYellow, WALL.peach, WALL.mint, WALL.paleBlue, WALL.lilac], floor: [FLOOR.matRed, FLOOR.matBlue, FLOOR.matYellow, FLOOR.matGreen, FLOOR.vinylGreen], quiet: [FLOOR.carpetBlue, FLOOR.carpetGreen, FLOOR.matBlue], wet: [FLOOR.tileWhite, FLOOR.tileBlue] },
  office: { wall: [WALL.lightGray, WALL.offWhite, WALL.beige, WALL.white], floor: [FLOOR.carpetGray, FLOOR.carpetBlue, FLOOR.terrazzo, FLOOR.vinylGray, FLOOR.tileGray] },
  worship: { wall: [WALL.white, WALL.offWhite, WALL.beige], floor: [FLOOR.hardwood, FLOOR.terrazzo, FLOOR.carpetRed, FLOOR.tileTerracotta] },
  library: { wall: [WALL.beige, WALL.paleGreen, WALL.offWhite, WALL.sand], floor: [FLOOR.hardwood, FLOOR.carpetGreen, FLOOR.carpetRed, FLOOR.oak] },
  food: { wall: [WALL.offWhite, WALL.white, WALL.paleYellow, WALL.peach, WALL.mint], floor: [FLOOR.tileTerracotta, FLOOR.tileWhite, FLOOR.tileGray, FLOOR.tileCream, FLOOR.hardwood], wet: [FLOOR.tileWhite, FLOOR.tileGray] },
  boutique: { wall: [WALL.white, WALL.offWhite, WALL.lightGray, WALL.beige, WALL.lilac, WALL.peach], floor: [FLOOR.hardwood, FLOOR.pine, FLOOR.tileGray, FLOOR.carpetGray, FLOOR.terrazzo, FLOOR.vinylGray] },
  shop: { wall: [WALL.white, WALL.offWhite, WALL.lightGray, WALL.paleYellow, WALL.paleBlue, WALL.sand], floor: [FLOOR.tileWhite, FLOOR.tileGray, FLOOR.vinylGray, FLOOR.terrazzo, FLOOR.tileCream, FLOOR.slab] },
  industrial: { wall: [WALL.gray, WALL.lightGray], floor: [FLOOR.concrete, FLOOR.slab], ceiling: null, lining: false },
  barn: { wall: [WALL.offWhite], floor: [FLOOR.straw, FLOOR.concrete], ceiling: null, lining: false },
  military: { wall: [WALL.gray, WALL.olive, WALL.lightGray], floor: [FLOOR.concrete, FLOOR.slab, FLOOR.vinylGray], ceiling: WALL.lightGray },
}
const KIT_OF: Record<string, string> = {
  clinic: 'health', 'dental-clinic': 'health', veterinary: 'health', 'rural-clinic': 'health', 'hospital-building': 'health', pharmacy: 'health', optician: 'health',
  school: 'school', daycare: 'kids', 'toy-store': 'kids',
  police: 'office', 'post-office': 'office', 'town-hall': 'office', bank: 'office', 'office-building': 'office', 'community-center': 'office', shelter: 'office', 'research-outpost': 'office', 'train-station': 'office', 'internet-cafe': 'office',
  church: 'worship', 'funeral-home': 'worship', library: 'library', bookshop: 'library',
  restaurant: 'food', cafe: 'food', bar: 'food', pizzeria: 'food', diner: 'food', bakery: 'food', butcher: 'food', 'ice-cream': 'food', 'tea-house': 'food', grocery: 'food', produce: 'food',
  clothing: 'boutique', 'shoe-store': 'boutique', jeweler: 'boutique', salon: 'boutique', barbershop: 'boutique', tailor: 'boutique', 'flower-shop': 'boutique', 'music-store': 'boutique', 'photo-store': 'boutique', pawnshop: 'boutique', 'thrift-store': 'boutique', 'arcade-hall': 'boutique', inn: 'boutique', motel: 'home',
  warehouse: 'industrial', hardware: 'industrial', 'construction-supply': 'industrial', 'print-shop': 'industrial', 'furniture-store': 'industrial', 'auto-parts': 'industrial', garage: 'industrial', 'tire-shop': 'industrial', 'repair-shop': 'industrial', 'motorcycle-shop': 'industrial', 'car-wash': 'industrial', 'fuel-station': 'shop',
  'bus-depot': 'industrial', 'fire-station': 'industrial', 'power-substation': 'industrial', 'water-works': 'industrial', sawmill: 'industrial', 'grain-store': 'industrial', greenhouse: 'industrial',
  barn: 'barn', stable: 'barn', 'abandoned-base': 'military', 'survivor-camp': 'cabin', 'apartment-building': 'home',
}

export function interiorFor(blueprint: Blueprint, style: Style, seed: number, condition: Condition): Interior {
  const rng = random(hash(`${blueprint.id}:${seed}:interior`))
  const timber = style.wall.material === 'wood'
  const name = KIT_OF[blueprint.id] ?? (blueprint.category === 'Residências' || blueprint.category === 'Fazendas' ? (timber ? 'cabin' : 'home') : blueprint.category === 'Comércios' ? 'shop' : 'office')
  const kit = KITS[name]
  const floor = pick(rng, kit.floor)
  let interior: Interior = {
    wall: pick(rng, kit.wall), ceiling: kit.ceiling === null ? undefined : kit.ceiling ?? pick(rng, [WALL.white, WALL.offWhite, C(1, 1.02, 1.08)]),
    floor, wet: pick(rng, kit.wet ?? [floor]), quiet: pick(rng, kit.quiet ?? [floor]), store: pick(rng, [FLOOR.concrete, FLOOR.slab]),
    lining: kit.lining ?? true, timber,
  }
  if (condition === 'burned') {
    const char = (f: SurfaceFinish): SurfaceFinish => f.material === 'wood' || f.material === 'fabric' || f.material === 'straw' ? { material: 'charcoal' } : { ...f, tint: (f.tint ?? [1, 1, 1]).map((v) => v * 0.38) as Vec3 }
    interior = { ...interior, wall: interior.wall.map((v) => v * 0.42) as Vec3, ceiling: interior.ceiling && (interior.ceiling.map((v) => v * 0.3) as Vec3), floor: char(interior.floor), wet: char(interior.wet), quiet: char(interior.quiet), store: char(interior.store) }
  }
  return interior
}

export function floorFinish(interior: Interior, zone: string, residential: boolean): SurfaceFinish {
  if (zone === 'K' || zone === 'A') return interior.wet
  if (zone === 'B' || zone === 'L' || zone === 'D' || (residential && zone === 'R')) return interior.quiet
  if (zone === 'H' || zone === 'R') return interior.store
  return interior.floor
}

type Recipe = Partial<Omit<WeatherProfile, 'seed'>>
const BASE: Omit<WeatherProfile, 'seed'> = { grime: 0.85, dust: 0.85, soot: 0.04, moss: 0.5, rust: 0.12, splash: 0.55, streak: 0.8, damp: 1, fade: 0.6, salt: 0.15, oil: 0, tint: C(0.36, 0.31, 0.23), scale: 1 }
const RECIPES: Record<string, Recipe> = {
  health: { grime: 0.55, streak: 1, moss: 0.3, fade: 0.2, splash: 0.3, salt: 0.05, tint: C(0.4, 0.4, 0.35) },
  school: { fade: 0.6, grime: 0.75, splash: 0.65, streak: 0.7, tint: C(0.4, 0.33, 0.24) },
  kids: { fade: 0.35, grime: 0.6, splash: 0.55, streak: 0.6, tint: C(0.4, 0.34, 0.25) },
  office: { streak: 1.25, grime: 0.7, moss: 0.3, fade: 0.4, salt: 0.3, tint: C(0.3, 0.3, 0.29) },
  worship: { streak: 1.4, moss: 0.75, salt: 0.45, fade: 0.35, tint: C(0.27, 0.27, 0.25) },
  library: { streak: 1.2, moss: 0.65, salt: 0.5, fade: 0.4, tint: C(0.3, 0.28, 0.24) },
  food: { soot: 0.2, oil: 0.25, grime: 0.95, streak: 0.95, tint: C(0.3, 0.25, 0.17) },
  boutique: { grime: 0.75, fade: 0.75, splash: 0.45, streak: 0.85, tint: C(0.34, 0.31, 0.27) },
  shop: { grime: 0.85, fade: 0.7, splash: 0.55, tint: C(0.35, 0.31, 0.25) },
  industrial: { rust: 0.95, grime: 1, streak: 1.15, oil: 0.35, moss: 0.25, fade: 0.5, tint: C(0.26, 0.2, 0.14) },
  auto: { oil: 1, soot: 0.14, grime: 1.05, rust: 0.5, splash: 0.5, tint: C(0.15, 0.14, 0.13) },
  barn: { splash: 1.3, moss: 0.85, dust: 1.3, damp: 1.25, rust: 0.45, fade: 0.8, tint: C(0.42, 0.31, 0.18) },
  cabin: { moss: 1.3, damp: 1.35, splash: 0.85, fade: 0.4, streak: 0.9, tint: C(0.24, 0.26, 0.16) },
  home: {},
  military: { dust: 1.35, grime: 1.1, rust: 0.7, moss: 0.4, splash: 0.9, fade: 0.7, tint: C(0.4, 0.37, 0.26) },
}
const AUTO = new Set(['garage', 'auto-parts', 'tire-shop', 'fuel-station', 'motorcycle-shop', 'car-wash', 'repair-shop', 'bus-depot', 'fire-station'])
const COAST = new Set(['fishing-store', 'fishing-cabin'])

const MOODS: Recipe[] = [
  { moss: 1.1, damp: 1.4, streak: 1.1, tint: C(0.28, 0.29, 0.2) },
  { fade: 1.15, dust: 1.2, moss: 0.25, damp: 0.6, tint: C(0.44, 0.37, 0.26) },
  { soot: 0.16, streak: 1.2, grime: 1, tint: C(0.24, 0.23, 0.22) },
  { splash: 1, salt: 0.5, tint: C(0.38, 0.3, 0.2) },
  {},
]

export function weatherFor(blueprint: Blueprint, style: Style, seed: number): WeatherProfile {
  const rng = random(hash(`${blueprint.id}:${seed}:weather`))
  const timber = style.wall.material === 'wood'
  const kit = AUTO.has(blueprint.id) ? 'auto' : KIT_OF[blueprint.id] ?? (blueprint.category === 'Residências' ? (timber ? 'cabin' : 'home') : blueprint.category === 'Fazendas' ? (timber ? 'cabin' : 'barn') : blueprint.category === 'Comércios' ? 'shop' : 'office')
  let profile: Omit<WeatherProfile, 'seed'> = { ...BASE, ...RECIPES[kit] }
  if (kit === 'home' || kit === 'cabin') profile = { ...profile, ...pick(rng, MOODS) }
  if (COAST.has(blueprint.id)) profile = { ...profile, salt: 1, rust: 0.7, moss: 0.8, tint: C(0.34, 0.36, 0.33) }
  if (blueprint.context === 'rural' && kit !== 'barn') profile = { ...profile, splash: profile.splash + 0.35, dust: profile.dust + 0.15 }
  if (blueprint.context === 'urbano') profile = { ...profile, soot: profile.soot + 0.08, streak: profile.streak + 0.15 }
  if (style.wall.material === 'brick') profile = { ...profile, salt: profile.salt + 0.55, moss: profile.moss + 0.12 }
  if (style.wall.material === 'steel') profile = { ...profile, rust: profile.rust + 0.45 }
  if (style.roof.material === 'steel') profile = { ...profile, rust: profile.rust + 0.15 }
  const jitter = (v: number) => v * (0.8 + rng() * 0.4)
  return {
    grime: jitter(profile.grime), dust: jitter(profile.dust), soot: jitter(profile.soot), moss: jitter(profile.moss), rust: jitter(profile.rust), splash: jitter(profile.splash),
    streak: jitter(profile.streak), damp: jitter(profile.damp), fade: jitter(profile.fade), salt: jitter(profile.salt), oil: jitter(profile.oil),
    tint: profile.tint.map((v) => v * (0.9 + rng() * 0.2)) as Vec3, scale: 0.75 + rng() * 0.6, seed: [rng() * 200 - 100, rng() * 50, rng() * 200 - 100],
  }
}
