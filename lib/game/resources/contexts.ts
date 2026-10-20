import type { LootKind } from '../blockout/types'
import { SITE_LABELS, type Container, type SiteTag } from './types'

export type SiteProfile = Partial<Record<SiteTag, number>>

function profile(text: string): SiteProfile {
  const out: SiteProfile = {}
  for (const token of text.split(/\s+/).filter(Boolean)) {
    const [tag, value] = token.split(':')
    if (!(tag in SITE_LABELS)) throw new Error(`Perfil de estrutura com etiqueta desconhecida "${tag}"`)
    out[tag as SiteTag] = Number(value)
  }
  return out
}

const CONTAINER_GROUPS: [Container, string][] = [
  ['prateleira', 'shelf display-table display-platform cardboard-boxes pallet sorting-rack toy-display'],
  ['gondola', 'grocery-shelf produce-display shopping-cart'],
  ['farmacia', 'pharmacy-shelf'],
  ['remedios', 'medicine-cabinet medical-crate'],
  ['refrigerado', 'fridge freezer vending-machine bakery-case ice-cream-case medicine-fridge butcher-rail'],
  ['despensa', 'kitchen-counter wall-cabinet oven bread-oven pizza-oven range-hood coffee-machine tea-counter bar-tap field-kitchen hearth'],
  ['pia', 'sink washing-machine laundry-drum'],
  ['banheiro', 'bathtub toilet'],
  ['gaveta', 'nightstand dresser tv-stand'],
  ['roupeiro', 'wardrobe locker clothes-rack fitting-booth shoe-shelf shoe-display sports-rack'],
  ['cama', 'single-bed double-bed bunk-bed motel-bed mattress sleeping-bag sofa armchair camp-tent holding-cell'],
  ['mesa', 'dining-table coffee-table school-desk reading-table play-table booth diner-booth'],
  ['escritorio', 'desk filing-cabinet reception reception-bell council-desk teacher-desk mailboxes noticeboard'],
  ['estante', 'bookcase pew altar'],
  ['bancada', 'workbench vice-bench electronics-bench watch-bench cobbler-bench saw-table sewing-machine paper-cutter'],
  ['ferramentas', 'tool-rack fishing-rack fire-gear'],
  ['armeiro', 'gun-cabinet gun-rack weapon-display security-counter ammo-crate'],
  ['cofre', 'safe vault-door'],
  ['caixa', 'counter checkout cash-register ticket-gate'],
  ['eletrico', 'electrical-panel server-rack radio-desk radio-console computer-station arcade pinball transformer signal-lever studio-camera'],
  ['maquina', 'generator tractor forklift engine-stand bike-lift bicycle-stand tire-changer vehicle-lift wash-gantry cement-mixer paint-mixer printing-press water-pump piano'],
  ['tambor', 'barrel fuel-pump water-tank well'],
  ['clinico', 'lab-bench hospital-bed exam-table dental-chair iv-stand ct-scanner patient-monitor lab-equipment optical-chair wheelchair'],
  ['salao', 'barber-chair salon-station'],
  ['caixote', 'crate planter trough kennel animal-cages hay-bale feed-hopper horse-stall seedling-bench potting-bench'],
  ['lixo', 'trash-bags dumpster'],
  ['escombros', 'foundation log-stack casket stage brick-rubble concrete-rubble planks metal-scrap burned-debris tile-rubble plaster-rubble collapsed-beam'],
]
export const CONTAINER_BY_FAMILY = new Map<string, Container>(CONTAINER_GROUPS.flatMap(([container, families]) => families.split(' ').map((family) => [family, container] as const)))

export const KIND_CONTAINER: Record<LootKind, Container> = {
  salvage: 'prateleira', food: 'despensa', medical: 'remedios', weapons: 'armeiro', tools: 'bancada', textiles: 'roupeiro', electronics: 'eletrico', agriculture: 'caixote', documents: 'escritorio',
}

const SITES: Record<string, string> = {
  cottage: 'casa:1', 'family-house': 'casa:1', duplex: 'casa:1', 'corner-house': 'casa:1', rowhouse: 'casa:1', 'wood-house': 'casa:1 cabana:.3', 'courtyard-house': 'casa:1',
  'boarding-house': 'hospedagem:1 casa:.6', 'rental-room': 'casa:1 hospedagem:.4', bungalow: 'casa:1', 'workshop-house': 'casa:1 oficina:.6', 'shop-house': 'casa:1 mercado:.8',
  'large-house': 'casa:1', 'unfinished-house': 'construcao:1 casa:.3', 'caretaker-house': 'casa:1 utilidade:.5', 'residential-court': 'casa:1', 'apartment-building': 'casa:1',
  pharmacy: 'farmacia:1', 'gun-store': 'armas:1', grocery: 'mercado:1', bakery: 'restaurante:1 mercado:.3', butcher: 'restaurante:1', produce: 'mercado:.7 agro:.4', hardware: 'ferragens:1',
  clothing: 'vestuario:1', 'shoe-store': 'vestuario:1', bookshop: 'papelaria:1', stationery: 'papelaria:1', electronics: 'eletronicos:1', 'repair-shop': 'eletronicos:1', 'furniture-store': 'moveis:1',
  'thrift-store': 'vestuario:1 casa:.3', pawnshop: 'joalheria:.8 eletronicos:.5 armas:.2', jeweler: 'joalheria:1', optician: 'optica:1', 'pet-store': 'pet:1', 'flower-shop': 'agro:.8',
  'garden-store': 'agro:1', 'fishing-store': 'esportes:1', 'camping-store': 'esportes:1', 'sports-store': 'esportes:1', 'toy-store': 'brinquedos:1', 'music-store': 'eletronicos:.8',
  'photo-store': 'eletronicos:.8', 'paint-store': 'ferragens:.8 construcao:.5', 'construction-supply': 'construcao:1 ferragens:.5', 'auto-parts': 'oficina:1', 'motorcycle-shop': 'oficina:1',
  'bicycle-shop': 'oficina:.7 esportes:.4', 'tire-shop': 'oficina:.9', garage: 'oficina:1', 'fuel-station': 'posto:1 mercado:.5', 'car-wash': 'oficina:.5 posto:.3',
  diner: 'restaurante:1', restaurant: 'restaurante:1', cafe: 'restaurante:1', bar: 'restaurante:1', pizzeria: 'restaurante:1', 'ice-cream': 'restaurante:1', 'tea-house': 'restaurante:1',
  laundry: 'lavanderia:1', barbershop: 'beleza:1', salon: 'beleza:1', tailor: 'vestuario:.9', cobbler: 'vestuario:.5 ferragens:.3', 'print-shop': 'papelaria:1', 'internet-cafe': 'eletronicos:1',
  'arcade-hall': 'eletronicos:.7 brinquedos:.4', 'funeral-home': 'funeraria:1', motel: 'hospedagem:1', inn: 'hospedagem:1 restaurante:.4', warehouse: 'armazem:1', 'agro-store': 'agro:1 fazenda:.4',
  clinic: 'clinica:1', 'dental-clinic': 'clinica:.8', veterinary: 'veterinaria:1', school: 'escola:1', daycare: 'escola:.8 casa:.3', library: 'papelaria:.6 escola:.6', police: 'policia:1',
  'fire-station': 'bombeiros:1', 'post-office': 'escritorio:.8 papelaria:.4', bank: 'escritorio:1 joalheria:.2', church: 'igreja:1', 'community-center': 'igreja:.6 abrigo:.3',
  'town-hall': 'escritorio:1', 'bus-depot': 'transporte:1', 'train-station': 'transporte:1', shelter: 'abrigo:1 clinica:.3', 'power-substation': 'utilidade:1', 'water-works': 'utilidade:1',
  farmhouse: 'casa:1 fazenda:.7', barn: 'fazenda:1', stable: 'fazenda:1', greenhouse: 'fazenda:.8 agro:.6', 'hunting-cabin': 'cabana:1', 'ranger-cabin': 'cabana:.8 bombeiros:.3',
  'fishing-cabin': 'cabana:1', sawmill: 'serraria:1', 'grain-store': 'fazenda:1', 'rural-clinic': 'clinica:.8',
  'abandoned-base': 'militar:1', 'research-outpost': 'pesquisa:1 clinica:.5', 'survivor-camp': 'abrigo:1', 'office-building': 'escritorio:1', 'hospital-building': 'hospital:1 clinica:1',
}
export const SITE_PROFILES = new Map(Object.entries(SITES).map(([id, text]) => [id, profile(text)]))

export const KIND_PROFILE: Record<LootKind, SiteProfile> = {
  medical: profile('farmacia:1 clinica:1 hospital:1'), food: profile('mercado:1 casa:1 restaurante:1'), weapons: profile('armas:1 policia:1 militar:1'), tools: profile('ferragens:1 oficina:1'),
  textiles: profile('vestuario:1 casa:1 hospedagem:1'), electronics: profile('eletronicos:1 escritorio:1 utilidade:1'), agriculture: profile('agro:1 fazenda:1'),
  documents: profile('escritorio:1 papelaria:1 escola:1'), salvage: profile('armazem:1 construcao:1 casa:.5'),
}

export const ROOM_PROFILES: Record<string, SiteProfile> = {
  workshop: profile('oficina:.7'), utility: profile('utilidade:.6'), construction: profile('construcao:.8'), study: profile('escritorio:.4 papelaria:.3'),
  office: profile('escritorio:.5'), bathroom: profile('casa:.25'),
}
