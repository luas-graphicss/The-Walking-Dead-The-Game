import { random, type Blueprint, type Condition, type Layout, type LootKind } from './types'

type Row = [id: string, label: string, layout: Layout, equipment: string[], loot: LootKind]
const homes: Row[] = [
  ['cottage', 'Casa térrea compacta', 'compact', ['sofa', 'single-bed', 'sink', 'dining-table'], 'food'],
  ['family-house', 'Casa familiar', 'l-shaped', ['double-bed', 'wardrobe', 'fridge', 'sofa'], 'food'],
  ['duplex', 'Sobrado geminado', 'tower', ['single-bed', 'dresser', 'oven', 'desk'], 'food'],
  ['corner-house', 'Casa de esquina', 'l-shaped', ['dining-table', 'fridge', 'armchair', 'double-bed'], 'textiles'],
  ['rowhouse', 'Casa de vila', 'long', ['single-bed', 'sink', 'nightstand', 'bookcase'], 'food'],
  ['wood-house', 'Casa de madeira', 'compact', ['single-bed', 'crate', 'dining-table', 'wood-post'], 'tools'],
  ['courtyard-house', 'Casa com pátio', 'courtyard', ['sofa', 'planter', 'double-bed', 'sink'], 'food'],
  ['boarding-house', 'Pensão', 'long', ['single-bed', 'locker', 'nightstand', 'dining-table'], 'textiles'],
  ['rental-room', 'Conjunto de quitinetes', 'long', ['single-bed', 'fridge', 'sink', 'wardrobe'], 'food'],
  ['bungalow', 'Bangalô', 'compact', ['armchair', 'double-bed', 'bookcase', 'oven'], 'documents'],
  ['workshop-house', 'Casa com oficina', 'l-shaped', ['single-bed', 'workbench', 'tool-rack', 'sink'], 'tools'],
  ['shop-house', 'Casa sobre comércio', 'tower', ['counter', 'grocery-shelf', 'single-bed', 'desk'], 'food'],
  ['large-house', 'Casa de família extensa', 't-shaped', ['double-bed', 'bunk-bed', 'dining-table', 'sofa'], 'textiles'],
  ['unfinished-house', 'Casa inacabada', 'l-shaped', ['pallet', 'workbench', 'crate', 'water-tank'], 'tools'],
  ['caretaker-house', 'Casa de zelador', 'compact', ['single-bed', 'electrical-panel', 'sink', 'desk'], 'electronics'],
  ['residential-court', 'Vila residencial', 'courtyard', ['single-bed', 'washing-machine', 'sofa', 'fridge'], 'food'],
]
const shops: Row[] = [
  ['pharmacy', 'Farmácia de bairro', 'compact', ['pharmacy-shelf', 'medicine-cabinet', 'counter', 'medical-crate'], 'medical'],
  ['gun-store', 'Loja de armas', 'long', ['gun-rack', 'gun-cabinet', 'ammo-crate', 'counter'], 'weapons'],
  ['grocery', 'Mercadinho', 'hall', ['grocery-shelf', 'checkout', 'freezer', 'crate'], 'food'],
  ['bakery', 'Padaria', 'long', ['bakery-case', 'oven', 'workbench', 'counter'], 'food'],
  ['butcher', 'Açougue', 'compact', ['freezer', 'lab-bench', 'sink', 'counter'], 'food'],
  ['produce', 'Hortifrúti', 'l-shaped', ['crate', 'grocery-shelf', 'counter', 'planter'], 'agriculture'],
  ['hardware', 'Loja de ferragens', 'hall', ['shelf', 'tool-rack', 'workbench', 'counter'], 'tools'],
  ['clothing', 'Loja de roupas', 'long', ['clothes-rack', 'dresser', 'counter', 'locker'], 'textiles'],
  ['shoe-store', 'Sapataria', 'compact', ['shoe-shelf', 'bench', 'counter', 'shelf'], 'textiles'],
  ['bookshop', 'Livraria', 'l-shaped', ['bookcase', 'desk', 'armchair', 'counter'], 'documents'],
  ['stationery', 'Papelaria', 'compact', ['shelf', 'filing-cabinet', 'counter', 'school-desk'], 'documents'],
  ['electronics', 'Loja de eletrônicos', 'long', ['shelf', 'radio-desk', 'workbench', 'counter'], 'electronics'],
  ['repair-shop', 'Assistência técnica', 'compact', ['workbench', 'electrical-panel', 'shelf', 'desk'], 'electronics'],
  ['furniture-store', 'Loja de móveis', 'hall', ['sofa', 'wardrobe', 'dining-table', 'double-bed'], 'textiles'],
  ['thrift-store', 'Brechó', 'l-shaped', ['clothes-rack', 'shoe-shelf', 'crate', 'counter'], 'textiles'],
  ['pawnshop', 'Casa de penhores', 'compact', ['safe', 'counter', 'shelf', 'filing-cabinet'], 'salvage'],
  ['jeweler', 'Relojoaria e joalheria', 'compact', ['safe', 'counter', 'workbench', 'desk'], 'tools'],
  ['optician', 'Ótica', 'compact', ['counter', 'medicine-cabinet', 'desk', 'shelf'], 'medical'],
  ['pet-store', 'Pet shop', 'l-shaped', ['kennel', 'grocery-shelf', 'sink', 'counter'], 'food'],
  ['flower-shop', 'Floricultura', 'compact', ['planter', 'crate', 'counter', 'sink'], 'agriculture'],
  ['garden-store', 'Loja de jardinagem', 'courtyard', ['planter', 'tool-rack', 'water-tank', 'crate'], 'agriculture'],
  ['fishing-store', 'Loja de pesca', 'long', ['tool-rack', 'shelf', 'counter', 'crate'], 'tools'],
  ['camping-store', 'Loja de camping', 'hall', ['clothes-rack', 'shelf', 'bunk-bed', 'counter'], 'tools'],
  ['sports-store', 'Loja de esportes', 'hall', ['shoe-shelf', 'locker', 'shelf', 'counter'], 'textiles'],
  ['toy-store', 'Loja de brinquedos', 'compact', ['shelf', 'counter', 'crate', 'school-desk'], 'salvage'],
  ['music-store', 'Loja de música', 'long', ['radio-desk', 'shelf', 'workbench', 'counter'], 'electronics'],
  ['photo-store', 'Estúdio fotográfico', 'l-shaped', ['desk', 'shelf', 'electrical-panel', 'counter'], 'electronics'],
  ['paint-store', 'Loja de tintas', 'long', ['shelf', 'barrel', 'counter', 'pallet'], 'tools'],
  ['construction-supply', 'Depósito de construção', 'hall', ['pallet', 'workbench', 'shelf', 'crate'], 'tools'],
  ['auto-parts', 'Autopeças', 'hall', ['shelf', 'tool-rack', 'counter', 'pallet'], 'tools'],
  ['motorcycle-shop', 'Oficina de motos', 'l-shaped', ['workbench', 'tool-rack', 'barrel', 'locker'], 'tools'],
  ['bicycle-shop', 'Bicicletaria', 'long', ['tool-rack', 'workbench', 'counter', 'crate'], 'tools'],
  ['tire-shop', 'Borracharia', 'compact', ['workbench', 'barrel', 'generator', 'tool-rack'], 'tools'],
  ['garage', 'Oficina mecânica', 'hall', ['workbench', 'tool-rack', 'generator', 'barrel'], 'tools'],
  ['fuel-station', 'Posto de combustível', 'l-shaped', ['fuel-pump', 'grocery-shelf', 'counter', 'barrel'], 'food'],
  ['car-wash', 'Lava-rápido', 'hall', ['water-tank', 'electrical-panel', 'barrel', 'sink'], 'tools'],
  ['diner', 'Lanchonete', 'long', ['booth', 'counter', 'oven', 'fridge'], 'food'],
  ['restaurant', 'Restaurante familiar', 'l-shaped', ['dining-table', 'oven', 'sink', 'freezer'], 'food'],
  ['cafe', 'Cafeteria', 'compact', ['dining-table', 'counter', 'sink', 'armchair'], 'food'],
  ['bar', 'Bar de esquina', 'l-shaped', ['counter', 'stool', 'fridge', 'dining-table'], 'food'],
  ['pizzeria', 'Pizzaria', 'long', ['oven', 'workbench', 'dining-table', 'freezer'], 'food'],
  ['ice-cream', 'Sorveteria', 'compact', ['freezer', 'counter', 'booth', 'sink'], 'food'],
  ['tea-house', 'Casa de chá', 'courtyard', ['dining-table', 'planter', 'counter', 'sink'], 'food'],
  ['laundry', 'Lavanderia', 'long', ['washing-machine', 'counter', 'clothes-rack', 'sink'], 'textiles'],
  ['barbershop', 'Barbearia', 'compact', ['office-chair', 'sink', 'counter', 'medicine-cabinet'], 'medical'],
  ['salon', 'Salão de beleza', 'long', ['office-chair', 'sink', 'counter', 'shelf'], 'medical'],
  ['tailor', 'Ateliê de costura', 'compact', ['workbench', 'clothes-rack', 'dresser', 'desk'], 'textiles'],
  ['cobbler', 'Conserto de calçados', 'compact', ['workbench', 'shoe-shelf', 'counter', 'crate'], 'tools'],
  ['print-shop', 'Gráfica', 'hall', ['workbench', 'shelf', 'filing-cabinet', 'electrical-panel'], 'documents'],
  ['internet-cafe', 'Lan house', 'long', ['desk', 'office-chair', 'server-rack', 'counter'], 'electronics'],
  ['arcade-hall', 'Salão de jogos', 'hall', ['arcade', 'vending-machine', 'booth', 'counter'], 'electronics'],
  ['funeral-home', 'Funerária', 'long', ['reception', 'pew', 'medicine-cabinet', 'desk'], 'medical'],
  ['motel', 'Motel de estrada', 'courtyard', ['double-bed', 'nightstand', 'sink', 'reception'], 'food'],
  ['inn', 'Pousada', 't-shaped', ['single-bed', 'reception', 'dining-table', 'wardrobe'], 'textiles'],
  ['warehouse', 'Armazém de distribuição', 'hall', ['shelf', 'pallet', 'crate', 'electrical-panel'], 'salvage'],
  ['agro-store', 'Loja agropecuária', 'hall', ['crate', 'tool-rack', 'shelf', 'water-tank'], 'agriculture'],
]
const services: Row[] = [
  ['clinic', 'Posto de saúde', 'l-shaped', ['hospital-bed', 'medicine-cabinet', 'sink', 'reception'], 'medical'],
  ['dental-clinic', 'Clínica odontológica', 'compact', ['hospital-bed', 'lab-bench', 'sink', 'medicine-cabinet'], 'medical'],
  ['veterinary', 'Clínica veterinária', 'long', ['kennel', 'lab-bench', 'medicine-cabinet', 'sink'], 'medical'],
  ['school', 'Escola primária', 't-shaped', ['school-desk', 'blackboard', 'bookcase', 'locker'], 'documents'],
  ['daycare', 'Creche', 'courtyard', ['single-bed', 'school-desk', 'shelf', 'sink'], 'food'],
  ['library', 'Biblioteca pública', 'hall', ['bookcase', 'desk', 'armchair', 'filing-cabinet'], 'documents'],
  ['police', 'Delegacia', 'l-shaped', ['gun-cabinet', 'desk', 'locker', 'filing-cabinet'], 'weapons'],
  ['fire-station', 'Quartel de bombeiros', 'hall', ['locker', 'bunk-bed', 'tool-rack', 'radio-desk'], 'tools'],
  ['post-office', 'Agência dos correios', 'long', ['counter', 'shelf', 'filing-cabinet', 'crate'], 'documents'],
  ['bank', 'Agência bancária', 'l-shaped', ['safe', 'counter', 'desk', 'filing-cabinet'], 'documents'],
  ['church', 'Igreja comunitária', 'long', ['pew', 'bookcase', 'counter', 'noticeboard'], 'documents'],
  ['community-center', 'Centro comunitário', 'hall', ['bench', 'dining-table', 'shelf', 'noticeboard'], 'food'],
  ['town-hall', 'Prefeitura', 't-shaped', ['desk', 'filing-cabinet', 'reception', 'bookcase'], 'documents'],
  ['bus-depot', 'Terminal rodoviário', 'hall', ['bench', 'vending-machine', 'counter', 'locker'], 'food'],
  ['train-station', 'Estação ferroviária', 'long', ['bench', 'counter', 'radio-desk', 'shelf'], 'electronics'],
  ['shelter', 'Abrigo emergencial', 'hall', ['bunk-bed', 'medical-crate', 'grocery-shelf', 'water-tank'], 'medical'],
  ['power-substation', 'Subestação elétrica', 'courtyard', ['electrical-panel', 'generator', 'tool-rack', 'server-rack'], 'electronics'],
  ['water-works', 'Estação de água', 'hall', ['water-tank', 'electrical-panel', 'workbench', 'barrel'], 'tools'],
]
const rural: Row[] = [
  ['farmhouse', 'Sede de fazenda isolada', 'l-shaped', ['dining-table', 'single-bed', 'crate', 'fridge'], 'food'],
  ['barn', 'Celeiro', 'hall', ['pallet', 'crate', 'tool-rack', 'trough'], 'agriculture'],
  ['stable', 'Estábulo', 'long', ['trough', 'fence', 'crate', 'water-tank'], 'agriculture'],
  ['greenhouse', 'Estufa sem vidros', 'long', ['planter', 'water-tank', 'workbench', 'crate'], 'agriculture'],
  ['hunting-cabin', 'Cabana de caça', 'compact', ['single-bed', 'gun-cabinet', 'workbench', 'crate'], 'weapons'],
  ['ranger-cabin', 'Posto de guarda florestal', 'compact', ['radio-desk', 'single-bed', 'tool-rack', 'desk'], 'tools'],
  ['fishing-cabin', 'Cabana de pescador', 'compact', ['single-bed', 'tool-rack', 'crate', 'sink'], 'food'],
  ['sawmill', 'Serraria abandonada', 'hall', ['workbench', 'generator', 'pallet', 'tool-rack'], 'tools'],
  ['grain-store', 'Depósito de grãos', 'long', ['crate', 'pallet', 'shelf', 'barrel'], 'agriculture'],
  ['rural-clinic', 'Enfermaria rural', 'compact', ['hospital-bed', 'medicine-cabinet', 'sink', 'crate'], 'medical'],
]

function group(rows: Row[], category: Blueprint['category'], context: Blueprint['context']): Blueprint[] {
  return rows.map(([id, label, layout, equipment, loot]) => ({ id, label, category, context, layout, equipment, loot, floors: layout === 'tower' ? 2 : 1, rarity: 'comum' }))
}

export const BLUEPRINTS: Blueprint[] = [
  ...group(homes, 'Residências', 'bairro'), ...group(shops, 'Comércios', 'cidade-pequena'), ...group(services, 'Serviços públicos', 'cidade-pequena'), ...group(rural, 'Fazendas', 'rural'),
  { id: 'abandoned-base', label: 'Base abandonada murada', category: 'Estruturas raras', context: 'base', layout: 'compound', equipment: ['bunk-bed', 'ammo-crate', 'medical-crate', 'radio-desk'], loot: 'weapons', floors: 1, rarity: 'rara' },
  { id: 'research-outpost', label: 'Posto de pesquisa isolado', category: 'Estruturas raras', context: 'base', layout: 'compound', equipment: ['lab-bench', 'server-rack', 'hospital-bed', 'medicine-cabinet'], loot: 'medical', floors: 1, rarity: 'rara' },
  { id: 'survivor-camp', label: 'Refúgio fortificado', category: 'Estruturas raras', context: 'base', layout: 'compound', equipment: ['bunk-bed', 'grocery-shelf', 'workbench', 'water-tank'], loot: 'food', floors: 1, rarity: 'rara' },
  { id: 'apartment-building', label: 'Prédio residencial', category: 'Estruturas raras', context: 'urbano', layout: 'tower', equipment: ['double-bed', 'sofa', 'fridge', 'wardrobe'], loot: 'food', floors: 3, rarity: 'rara' },
  { id: 'office-building', label: 'Prédio comercial', category: 'Estruturas raras', context: 'urbano', layout: 'tower', equipment: ['desk', 'filing-cabinet', 'server-rack', 'reception'], loot: 'electronics', floors: 4, rarity: 'rara' },
  { id: 'hospital-building', label: 'Hospital urbano', category: 'Estruturas raras', context: 'urbano', layout: 'tower', equipment: ['hospital-bed', 'medicine-cabinet', 'lab-bench', 'reception'], loot: 'medical', floors: 3, rarity: 'rara' },
]

export const BLUEPRINT_BY_ID = new Map(BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]))
const severity: Condition[] = ['weathered', 'damaged', 'burned', 'ruined', 'leveled']
export function chooseCondition(blueprint: Blueprint, seed: number, district: Condition = 'weathered'): Condition {
  const roll = random(seed)()
  const protectedSite = blueprint.context === 'rural' || blueprint.context === 'base'
  const chosen = roll < (protectedSite ? 0.58 : 0.13) ? 0 : roll < (protectedSite ? 0.82 : 0.56) ? 1 : roll < 0.76 ? 2 : roll < 0.94 ? 3 : 4
  return severity[Math.max(chosen, severity.indexOf(district))]
}
