import type { Architecture } from '../architecture'
import type { Blueprint, LootKind } from '../types'
import type { Program } from './room'

export type PlanCell = { x: number; z: number; zone: string }
export type PlanContext = { cells: PlanCell[]; floors: number; entrance: PlanCell }

type Shop = { floor: 'aisles' | 'walls' | 'racks' | 'tables' | 'showroom' | 'dining' | 'bays' | 'salon' | 'laundry' | 'arcade' | 'lan' | 'ceremony' | 'warehouse' | 'garden'; shelf: string; wall?: string; display?: string; counter: string; theme: LootKind; signature?: string[]; seats?: string }
const SHOPS: Record<string, Shop> = {
  pharmacy: { floor: 'aisles', shelf: 'pharmacy-shelf', counter: 'counter', theme: 'medical', signature: ['medicine-cabinet', 'medicine-cabinet'] },
  'gun-store': { floor: 'walls', shelf: 'gun-rack', wall: 'weapon-display', display: 'ammo-crate', counter: 'security-counter', theme: 'weapons', signature: ['gun-cabinet', 'gun-rack'] },
  grocery: { floor: 'aisles', shelf: 'grocery-shelf', wall: 'freezer', counter: 'checkout', theme: 'food', signature: ['crate', 'crate'] },
  bakery: { floor: 'walls', shelf: 'bakery-case', display: 'display-table', counter: 'counter', theme: 'food', signature: ['workbench', 'shelf'] },
  butcher: { floor: 'walls', shelf: 'freezer', counter: 'counter', theme: 'food', signature: ['lab-bench', 'freezer'] },
  produce: { floor: 'tables', shelf: 'produce-display', display: 'produce-display', counter: 'counter', theme: 'agriculture', signature: ['crate', 'crate'] },
  hardware: { floor: 'aisles', shelf: 'shelf', wall: 'tool-rack', counter: 'counter', theme: 'tools', signature: ['workbench', 'tool-rack'] },
  clothing: { floor: 'racks', shelf: 'clothes-rack', wall: 'shelf', display: 'display-table', counter: 'counter', theme: 'textiles', signature: ['fitting-booth', 'bench'] },
  'shoe-store': { floor: 'walls', shelf: 'shoe-shelf', display: 'bench', counter: 'counter', theme: 'textiles', signature: ['shoe-display', 'shoe-shelf'] },
  bookshop: { floor: 'aisles', shelf: 'bookcase', display: 'display-table', counter: 'counter', theme: 'documents', signature: ['armchair', 'bookcase'] },
  stationery: { floor: 'aisles', shelf: 'shelf', display: 'display-table', counter: 'counter', theme: 'documents', signature: ['desk', 'filing-cabinet'] },
  electronics: { floor: 'tables', shelf: 'shelf', display: 'display-table', counter: 'counter', theme: 'electronics', signature: ['workbench', 'shelf'] },
  'repair-shop': { floor: 'walls', shelf: 'shelf', display: 'workbench', counter: 'counter', theme: 'electronics', signature: ['workbench', 'electrical-panel'] },
  'furniture-store': { floor: 'showroom', shelf: 'wardrobe', counter: 'counter', theme: 'textiles', signature: ['double-bed', 'sofa'] },
  'thrift-store': { floor: 'racks', shelf: 'clothes-rack', wall: 'shoe-shelf', display: 'display-table', counter: 'counter', theme: 'textiles', signature: ['fitting-booth', 'dresser'] },
  pawnshop: { floor: 'tables', shelf: 'shelf', display: 'display-table', counter: 'counter', theme: 'salvage', signature: ['safe', 'filing-cabinet'] },
  jeweler: { floor: 'tables', shelf: 'shelf', display: 'counter', counter: 'counter', theme: 'tools', signature: ['safe', 'desk'] },
  optician: { floor: 'walls', shelf: 'shelf', display: 'display-table', counter: 'counter', theme: 'medical', signature: ['desk', 'medicine-cabinet'], seats: 'bench' },
  'pet-store': { floor: 'walls', shelf: 'grocery-shelf', display: 'kennel', counter: 'counter', theme: 'food', signature: ['animal-cages', 'sink'] },
  'flower-shop': { floor: 'garden', shelf: 'planter', display: 'display-table', counter: 'counter', theme: 'agriculture', signature: ['planter', 'sink'] },
  'garden-store': { floor: 'garden', shelf: 'planter', wall: 'tool-rack', counter: 'counter', theme: 'agriculture', signature: ['planter', 'water-tank'] },
  'fishing-store': { floor: 'walls', shelf: 'shelf', wall: 'fishing-rack', display: 'display-table', counter: 'counter', theme: 'tools', signature: ['fishing-rack', 'tool-rack'] },
  'camping-store': { floor: 'racks', shelf: 'clothes-rack', wall: 'shelf', display: 'display-table', counter: 'counter', theme: 'tools', signature: ['sleeping-bag', 'shelf'] },
  'sports-store': { floor: 'racks', shelf: 'clothes-rack', wall: 'shoe-shelf', display: 'sports-rack', counter: 'counter', theme: 'textiles', signature: ['sports-rack', 'locker'] },
  'toy-store': { floor: 'tables', shelf: 'shelf', display: 'toy-display', counter: 'counter', theme: 'salvage', signature: ['play-table', 'toy-display'] },
  'music-store': { floor: 'walls', shelf: 'shelf', display: 'radio-desk', counter: 'counter', theme: 'electronics', signature: ['radio-desk', 'stool'] },
  'photo-store': { floor: 'tables', shelf: 'shelf', display: 'display-table', counter: 'counter', theme: 'electronics', signature: ['electrical-panel', 'stool'] },
  'paint-store': { floor: 'aisles', shelf: 'shelf', display: 'pallet', counter: 'counter', theme: 'tools', signature: ['barrel', 'shelf'] },
  'construction-supply': { floor: 'warehouse', shelf: 'shelf', display: 'pallet', counter: 'counter', theme: 'tools', signature: ['pallet', 'barrel'] },
  'auto-parts': { floor: 'aisles', shelf: 'shelf', wall: 'tool-rack', counter: 'counter', theme: 'tools', signature: ['workbench', 'barrel'] },
  'motorcycle-shop': { floor: 'bays', shelf: 'tool-rack', display: 'bike-lift', counter: 'counter', theme: 'tools', signature: ['workbench', 'barrel'] },
  'bicycle-shop': { floor: 'bays', shelf: 'tool-rack', display: 'bicycle-stand', counter: 'counter', theme: 'tools', signature: ['workbench', 'tool-rack'] },
  'tire-shop': { floor: 'bays', shelf: 'tool-rack', display: 'barrel', counter: 'workbench', theme: 'tools', signature: ['generator', 'barrel'] },
  garage: { floor: 'bays', shelf: 'tool-rack', display: 'engine-stand', counter: 'counter', theme: 'tools', signature: ['workbench', 'tool-rack'] },
  'fuel-station': { floor: 'aisles', shelf: 'grocery-shelf', wall: 'freezer', counter: 'checkout', theme: 'food', signature: ['freezer', 'vending-machine'] },
  'car-wash': { floor: 'bays', shelf: 'shelf', display: 'water-tank', counter: 'counter', theme: 'tools', signature: ['water-tank', 'barrel'] },
  diner: { floor: 'dining', shelf: 'shelf', display: 'diner-booth', counter: 'counter', theme: 'food', seats: 'booth' },
  restaurant: { floor: 'dining', shelf: 'shelf', display: 'dining-table', counter: 'counter', theme: 'food' },
  cafe: { floor: 'dining', shelf: 'shelf', display: 'dining-table', counter: 'counter', theme: 'food', seats: 'armchair' },
  bar: { floor: 'dining', shelf: 'shelf', display: 'dining-table', counter: 'bar-tap', theme: 'food', seats: 'bar-stool' },
  pizzeria: { floor: 'dining', shelf: 'shelf', display: 'dining-table', counter: 'counter', theme: 'food' },
  'ice-cream': { floor: 'dining', shelf: 'freezer', display: 'dining-table', counter: 'counter', theme: 'food', seats: 'booth' },
  'tea-house': { floor: 'dining', shelf: 'shelf', display: 'coffee-table', counter: 'counter', theme: 'food', seats: 'armchair' },
  laundry: { floor: 'laundry', shelf: 'washing-machine', display: 'dining-table', counter: 'counter', theme: 'textiles', signature: ['laundry-drum', 'clothes-rack'] },
  barbershop: { floor: 'salon', shelf: 'barber-chair', counter: 'counter', theme: 'medical', seats: 'bench' },
  salon: { floor: 'salon', shelf: 'salon-station', counter: 'counter', theme: 'medical', seats: 'bench' },
  tailor: { floor: 'racks', shelf: 'clothes-rack', wall: 'dresser', display: 'display-table', counter: 'counter', theme: 'textiles', signature: ['workbench', 'fitting-booth'] },
  cobbler: { floor: 'walls', shelf: 'shoe-shelf', counter: 'counter', theme: 'tools', signature: ['shoe-shelf', 'stool'] },
  'print-shop': { floor: 'bays', shelf: 'shelf', display: 'paper-cutter', counter: 'counter', theme: 'documents', signature: ['workbench', 'filing-cabinet'] },
  'internet-cafe': { floor: 'lan', shelf: 'computer-station', counter: 'counter', theme: 'electronics', signature: ['server-rack', 'computer-station'] },
  'arcade-hall': { floor: 'arcade', shelf: 'arcade', display: 'pinball', counter: 'counter', theme: 'electronics', signature: ['pinball', 'vending-machine'] },
  'funeral-home': { floor: 'ceremony', shelf: 'pew', display: 'casket', counter: 'reception', theme: 'documents', signature: ['casket', 'potted-plant'] },
  warehouse: { floor: 'warehouse', shelf: 'shelf', display: 'pallet', counter: 'desk', theme: 'salvage' },
  'agro-store': { floor: 'aisles', shelf: 'shelf', wall: 'tool-rack', display: 'crate', counter: 'counter', theme: 'agriculture', signature: ['pallet', 'water-tank'] },
}
export function shopFor(id: string): Shop { return SHOPS[id] ?? { floor: 'walls', shelf: 'shelf', counter: 'counter', theme: 'salvage' } }

const HOMES = new Set(['farmhouse'])
const isHome = (b: Blueprint) => b.category === 'Residências' || HOMES.has(b.id)
const p = (kind: string, label: string, extra: Record<string, unknown> = {}): Program => ({ kind, label, ...extra })

export function programFor(blueprint: Blueprint, profile: Architecture, cell: PlanCell, level: number, plan: PlanContext): Program {
  const id = blueprint.id, zone = cell.zone
  const same = plan.cells.filter((c) => c.zone === zone)
  const nth = same.findIndex((c) => c.x === cell.x && c.z === cell.z)
  const isEntrance = cell.x === plan.entrance.x && cell.z === plan.entrance.z
  const specialty = profile.specialty

  if (id.includes('-annex-')) return annexProgram(specialty, zone)
  if (id === 'apartment-building') {
    if (zone === 'S') return p('hall', 'Escada e corredor do prédio')
    if (zone === 'E' && level === 0) return isEntrance ? p('lobby', 'Portaria e caixas de correio', { mailboxes: true }) : p('apartment', 'Apartamento térreo')
    return p('apartment', `Apartamento ${level + 1}0${nth + 1}`)
  }
  if (id === 'office-building') {
    if (zone === 'S') return p('hall', 'Núcleo de escada')
    if (zone === 'E') return level === 0 ? (isEntrance ? p('lobby', 'Lobby e recepção') : p('waiting', 'Espera do lobby', { seat: 'bench' })) : p('meeting', 'Sala de reuniões')
    return p('office', 'Escritório aberto', { open: true })
  }
  if (id === 'hospital-building') {
    if (zone === 'S') return p('hall', 'Escada de emergência')
    if (zone === 'C') return p('corridor', 'Corredor clínico', { medical: true })
    if (zone === 'D') return level === 0 && nth === 0 ? p('exam', 'Tomografia', { main: 'ct-scanner' }) : p('exam', nth % 2 ? 'Sala de procedimentos' : 'Consultório', { main: nth % 2 ? 'hospital-bed' : 'exam-table' })
    return p('ward', level === 0 ? 'Pronto atendimento' : 'Enfermaria', { bed: 'hospital-bed' })
  }

  if (isHome(blueprint)) return homeProgram(blueprint, profile, cell, level, plan, nth, isEntrance)
  if (blueprint.category === 'Comércios') return shopProgram(blueprint, profile, cell, nth, isEntrance)
  if (blueprint.category === 'Fazendas') return ruralProgram(id, zone, nth)
  return serviceProgram(id, zone, nth, isEntrance, specialty)
}

function homeProgram(blueprint: Blueprint, profile: Architecture, cell: PlanCell, level: number, plan: PlanContext, nth: number, isEntrance: boolean): Program {
  const id = blueprint.id, zone = cell.zone
  const hasLiving = plan.cells.some((c) => c.zone === 'L')
  const hearth = profile.specialty === 'hearth'
  if (level > 0) {
    if (zone === 'S') return p('hall', 'Corredor do andar de cima')
    if (zone === 'K' || zone === 'A') return p('bathroom', 'Banheiro social')
    if (zone === 'F') return p('living', 'Sala da residência', { hearth: false })
    if (zone === 'R') return p('kitchen', 'Cozinha da residência', { table: true })
    if (zone === 'B') return p('bedroom', 'Quarto do casal', { bed: 'double-bed' })
    if (zone === 'L') return p('bedroom', 'Quarto das crianças', { bed: 'single-bed', kids: true })
    return nth === 0 ? p('bedroom', 'Quarto de solteiro', { bed: 'single-bed' }) : p('study', 'Escritório da casa')
  }
  if (id === 'rental-room' && (zone === 'B' || zone === 'E')) return p('studio', 'Quitinete')
  if (id === 'boarding-house' && zone === 'B') return p('bedroom', 'Quarto de pensionista', { bed: 'single-bed', rental: true })
  if (id === 'shop-house') {
    if (zone === 'R') return p('stockroom', 'Estoque da mercearia', { theme: 'food' })
    if (zone === 'F') return p('sales', 'Mercearia no térreo', { shop: 'grocery' })
    if (zone === 'E') return isEntrance ? p('front', 'Caixa da mercearia', { shop: 'grocery', counter: 'cash-register' }) : p('sales', 'Mercearia no térreo', { shop: 'grocery' })
  }
  if (zone === 'B') {
    if (nth === 0) return p('bedroom', 'Quarto do casal', { bed: 'double-bed' })
    if (nth === 1) return p('bedroom', 'Quarto das crianças', { bed: id === 'large-house' ? 'bunk-bed' : 'single-bed', kids: true })
    return p('bedroom', 'Quarto de hóspedes', { bed: 'single-bed' })
  }
  if (zone === 'A') return p('bathroom', 'Banheiro e lavanderia', { laundry: true })
  if (zone === 'K') return p('kitchen', 'Cozinha', { table: !plan.cells.some((c) => c.zone === 'E') || nth > 0 })
  if (zone === 'L') return p('living', 'Sala de estar', { hearth })
  if (zone === 'S') return p('hall', 'Corredor e escada')
  if (zone === 'T') {
    if (id === 'workshop-house') return p('workshop', 'Oficina da casa', { main: 'vice-bench' })
    if (id === 'caretaker-house') return p('utility', 'Casa de máquinas')
    return p('construction', 'Cômodo em obra')
  }
  if (zone === 'R') return p('construction', 'Depósito de material de obra')
  if (zone === 'E') {
    if (id === 'unfinished-house') return p('construction', 'Sala sem acabamento')
    if (isEntrance) return hasLiving ? p('dining', 'Entrada e sala de jantar', { coat: true }) : p('living', 'Sala de estar', { hearth, coat: true })
    return nth % 2 ? p('study', 'Escritório da casa') : p('dining', 'Sala de jantar')
  }
  return p('hall', 'Circulação')
}

function shopProgram(blueprint: Blueprint, profile: Architecture, cell: PlanCell, nth: number, isEntrance: boolean): Program {
  const id = blueprint.id, zone = cell.zone, shop = shopFor(id), specialty = profile.specialty
  if (id === 'motel') return zone === 'B' ? p('motel-room', 'Quarto de motel') : isEntrance ? p('reception', 'Recepção do motel', { desk: 'reception-bell', seat: 'bench' }) : p('motel-room', 'Quarto de motel')
  if (id === 'inn') {
    if (zone === 'B') return p('bedroom', 'Quarto de hóspedes', { bed: nth % 2 ? 'double-bed' : 'single-bed', guest: true })
    if (zone === 'K') return p('kitchen', 'Cozinha da pousada', { table: true })
    if (zone === 'L') return p('living', 'Salão de convivência', { hearth: true })
    if (zone === 'S') return p('hall', 'Corredor dos quartos')
    return p('reception', 'Recepção da pousada', { desk: 'reception-bell', seat: 'armchair' })
  }
  if (zone === 'R') return p('stockroom', 'Estoque e recebimento', { theme: shop.theme, safe: ['jeweler', 'pawnshop', 'gun-store'].includes(id) })
  if (zone === 'K') return p('pro-kitchen', 'Cozinha de produção', { theme: shop.theme })
  if (zone === 'O') return p('office', 'Escritório da loja')
  if (zone === 'H') return p('warehouse', id === 'warehouse' ? 'Corredor de pallets' : 'Pátio coberto de materiais', { forklift: id === 'warehouse' })
  if (zone === 'T') {
    if (shop.floor === 'dining') {
      if (id === 'restaurant' || id === 'pizzeria' || id === 'bakery') return p('pro-kitchen', 'Cozinha e forno', { main: specialty, theme: 'food' })
      if (id === 'diner') return p('dining-room', 'Salão de bancos', { shop: id, booths: true })
      return p('service-bar', 'Balcão de preparo', { main: specialty, shop: id })
    }
    if (shop.floor === 'bays') return p('bay', 'Box de serviço', { main: specialty, shop: id })
    if (shop.floor === 'warehouse') return p('warehouse', 'Pátio de materiais', { main: specialty })
    if (id === 'bakery') return p('pro-kitchen', 'Produção da padaria', { main: specialty, theme: 'food' })
    return p('signature', signatureLabel(id), { main: specialty, shop: id })
  }
  if (shop.floor === 'dining') return isEntrance ? p('dining-room', 'Salão e caixa', { shop: id, register: true }) : p('dining-room', 'Salão de mesas', { shop: id })
  if (shop.floor === 'bays') return isEntrance ? p('front', 'Recepção da oficina', { shop: id }) : p('bay', 'Box de serviço', { main: shop.display, shop: id })
  if (shop.floor === 'warehouse') return isEntrance ? p('front', 'Expedição e balcão', { shop: id }) : p('warehouse', 'Área de carga', {})
  if (zone === 'E' && (isEntrance || nth === 0)) return p('front', 'Caixa e atendimento', { shop: id })
  return p('sales', 'Área de vendas', { shop: id })
}

function signatureLabel(id: string) {
  const labels: Record<string, string> = {
    pharmacy: 'Dispensação e geladeira de vacinas', 'gun-store': 'Armaria trancada', grocery: 'Banca de hortifrúti', butcher: 'Sala de cortes', produce: 'Bancas de frutas',
    hardware: 'Bancada de corte e chaves', clothing: 'Provadores', 'shoe-store': 'Vitrine de calçados', bookshop: 'Canto de leitura', stationery: 'Guilhotina e encadernação',
    electronics: 'Bancada de testes', 'repair-shop': 'Bancada de conserto', 'furniture-store': 'Ambiente decorado', 'thrift-store': 'Provadores', pawnshop: 'Balcão gradeado e cofre',
    jeweler: 'Bancada do relojoeiro', optician: 'Sala de exame de vista', 'pet-store': 'Viveiros e banho', 'flower-shop': 'Bancada de arranjos', 'garden-store': 'Estufa de mudas',
    'fishing-store': 'Parede de varas', 'camping-store': 'Barraca de demonstração', 'sports-store': 'Equipamento esportivo', 'toy-store': 'Mesa de brincar', 'music-store': 'Sala do piano',
    'photo-store': 'Estúdio fotográfico', 'paint-store': 'Máquina de tintas', 'auto-parts': 'Bancada de motores', 'fuel-station': 'Geladeiras e café', laundry: 'Lavadoras industriais',
    barbershop: 'Cadeiras de barbeiro', salon: 'Estações de cabeleireiro', tailor: 'Mesa de corte e costura', cobbler: 'Bancada de sapateiro', 'internet-cafe': 'Sala dos computadores',
    'arcade-hall': 'Fileira de pinballs', 'funeral-home': 'Sala de velório', 'agro-store': 'Silo de ração',
  }
  return labels[id] ?? 'Área técnica'
}

function ruralProgram(id: string, zone: string, nth: number): Program {
  if (id === 'barn') return zone === 'E' ? p('barn-bay', 'Acesso de máquinas') : p('hayloft', 'Armazenagem de feno e ração')
  if (id === 'stable') return zone === 'E' ? p('tack-room', 'Selaria e manejo') : p('stalls', 'Baias dos cavalos')
  if (id === 'greenhouse') return zone === 'E' ? p('potting', 'Preparo de mudas') : p('beds', 'Canteiros de cultivo')
  if (id === 'sawmill') return zone === 'T' ? p('sawmill', nth === 0 ? 'Serra principal' : 'Corte e aplainamento') : zone === 'R' ? p('lumber', 'Pilha de tábuas') : p('lumber', 'Recebimento de toras', { logs: true })
  if (id === 'grain-store') return zone === 'H' ? p('grain', 'Tremonhas de grãos') : zone === 'R' ? p('stockroom', 'Sacaria e pallets', { theme: 'agriculture' }) : p('front', 'Balança e expedição', { shop: 'agro-store' })
  if (id === 'rural-clinic') return zone === 'D' ? p('exam', 'Sala de atendimento', { main: 'exam-table' }) : zone === 'W' ? p('ward', 'Leitos de observação', { bed: 'hospital-bed' }) : zone === 'C' ? p('corridor', 'Espera da enfermaria', { medical: true }) : p('reception', 'Recepção da enfermaria', { desk: 'reception', seat: 'bench' })
  if (id === 'hunting-cabin') return zone === 'B' ? p('bedroom', 'Catre do caçador', { bed: 'single-bed', rustic: true }) : zone === 'K' ? p('cabin-kitchen', 'Fogão a lenha e despensa') : zone === 'L' ? p('trophy', 'Sala de armas e troféus') : p('mudroom', 'Entrada e equipamento')
  if (id === 'fishing-cabin') return zone === 'B' ? p('bedroom', 'Beliche do pescador', { bed: 'bunk-bed', rustic: true }) : zone === 'K' ? p('cabin-kitchen', 'Cozinha da cabana') : zone === 'T' ? p('tackle', 'Depósito de varas e redes') : p('mudroom', 'Entrada e botas')
  if (id === 'ranger-cabin') return zone === 'B' ? p('bedroom', 'Alojamento do guarda', { bed: 'bunk-bed', rustic: true }) : zone === 'T' ? p('radio-room', 'Sala de rádio') : p('mudroom', 'Entrada e equipamento de campo', { office: true })
  return p('stockroom', 'Depósito rural', { theme: 'agriculture' })
}

function serviceProgram(id: string, zone: string, nth: number, isEntrance: boolean, specialty: string): Program {
  switch (id) {
    case 'clinic': return zone === 'D' ? p('exam', 'Consultório', { main: 'exam-table' }) : zone === 'W' ? p('ward', 'Observação e soro', { bed: 'hospital-bed' }) : zone === 'C' ? p('corridor', 'Corredor de espera', { medical: true }) : p('reception', 'Recepção e triagem', { desk: 'reception', seat: 'bench' })
    case 'dental-clinic': return zone === 'D' || zone === 'T' ? p('exam', zone === 'T' ? 'Consultório odontológico' : 'Esterilização e raio-x', { main: zone === 'T' ? 'dental-chair' : 'lab-bench' }) : zone === 'C' ? p('corridor', 'Sala de espera', { medical: true }) : p('reception', 'Recepção', { desk: 'reception', seat: 'bench' })
    case 'veterinary': return zone === 'D' ? p('exam', 'Mesa de exame veterinário', { main: 'exam-table', vet: true }) : zone === 'T' ? p('exam', 'Internação de pequenos animais', { main: 'animal-cages', vet: true }) : zone === 'W' ? p('kennels', 'Canil clínico') : p('reception', 'Recepção veterinária', { desk: 'reception', seat: 'bench' })
    case 'school': return zone === 'T' ? p('classroom', `Sala de aula ${nth + 1}`) : zone === 'C' ? p('corridor', 'Corredor de armários', { lockers: true }) : p('reception', 'Secretaria escolar', { desk: 'reception', seat: 'bench', office: true })
    case 'daycare': return zone === 'B' ? p('nap-room', 'Sala de soneca') : zone === 'T' ? p('playroom', 'Sala de atividades') : p('reception', 'Recepção da creche', { desk: 'reception', seat: 'bench', toys: true })
    case 'library': return zone === 'R' ? p('archive', 'Arquivo e acervo fechado') : zone === 'T' ? p('reading', 'Salão de leitura') : isEntrance ? p('front', 'Balcão de empréstimos', { shop: 'library' }) : p('stacks', 'Estantes do acervo')
    case 'police': return zone === 'T' ? (nth === 0 ? p('cells', 'Celas de custódia') : p('armory', 'Armaria')) : zone === 'C' ? p('office', 'Sala dos investigadores', { police: true }) : p('reception', 'Atendimento ao público', { desk: 'security-counter', seat: 'bench' })
    case 'fire-station': return zone === 'R' ? p('barracks', 'Alojamento de plantão', { bed: 'bunk-bed' }) : zone === 'T' ? p('gear-room', 'Vestiário de combate') : p('apparatus', 'Garagem das viaturas')
    case 'post-office': return zone === 'T' ? p('sorting', 'Triagem de correspondência') : zone === 'R' ? p('stockroom', 'Malotes e encomendas', { theme: 'documents' }) : isEntrance || zone === 'E' ? p('front', 'Balcão de atendimento', { shop: 'post-office' }) : p('waiting', 'Caixas postais e espera', { mailboxes: true, seat: 'bench' })
    case 'bank': return zone === 'T' ? (nth === 0 ? p('vault', 'Cofre-forte') : p('office', 'Gerência', { manager: true })) : zone === 'C' ? p('tellers', 'Caixas de atendimento') : p('waiting', 'Saguão de espera', { seat: 'bench' })
    case 'church': return zone === 'A' ? p('altar', 'Altar e sacristia') : zone === 'E' ? p('narthex', 'Nártex de entrada') : p('nave', 'Nave de bancos')
    case 'community-center': return zone === 'R' ? p('stockroom', 'Depósito de cadeiras e mesas', { theme: 'food' }) : zone === 'T' ? p('stage-room', 'Palco') : zone === 'F' ? p('assembly', 'Plateia') : p('canteen', 'Cantina comunitária')
    case 'town-hall': return zone === 'O' ? p('office', 'Gabinete administrativo', { manager: true }) : zone === 'T' ? p('council', 'Câmara de vereadores') : zone === 'S' ? p('hall', 'Hall da escadaria') : zone === 'C' ? p('corridor', 'Corredor administrativo', { lockers: false }) : p('lobby', 'Hall de entrada')
    case 'bus-depot': return zone === 'R' ? p('office', 'Despacho da rodoviária') : zone === 'T' ? p('ticketing', 'Bilheteria') : p('waiting', 'Sala de espera', { seat: 'bench', vending: true })
    case 'train-station': return zone === 'R' ? p('office', 'Chefia da estação') : zone === 'T' ? p('signal-room', 'Cabine de sinalização') : zone === 'F' ? p('waiting', 'Sala de espera', { seat: 'pew' }) : p('ticketing', 'Bilheteria e guarda-volumes')
    case 'shelter': return zone === 'R' ? p('stockroom', 'Depósito de doações', { theme: 'food', relief: true }) : zone === 'T' ? p('relief-kitchen', 'Cozinha de campanha') : zone === 'W' ? p('barracks', 'Alojamento coletivo', { bed: nth % 2 ? 'mattress' : 'bunk-bed' }) : p('triage', 'Triagem e enfermaria')
    case 'power-substation': return zone === 'T' ? p('plant', 'Pátio de transformadores', { main: specialty }) : p('maintenance', 'Manutenção elétrica')
    case 'water-works': return zone === 'T' ? p('plant', 'Casa de bombas', { main: specialty }) : zone === 'R' ? p('stockroom', 'Depósito de produtos químicos', { theme: 'tools' }) : p('maintenance', 'Controle e manutenção')
    default: return p('stockroom', 'Depósito', { theme: 'salvage' })
  }
}

function annexProgram(specialty: string, zone: string): Program {
  if (specialty === 'radio-console') return zone === 'T' ? p('radio-room', 'Comunicações e comando') : zone === 'R' ? p('stockroom', 'Baterias e peças', { theme: 'electronics' }) : p('office', 'Mesa de comando', { police: true })
  if (specialty === 'bunk-bed') return zone === 'E' ? p('mudroom', 'Entrada do alojamento', { office: false }) : p('barracks', 'Alojamento', { bed: 'bunk-bed' })
  if (specialty === 'weapon-display') return zone === 'T' ? p('armory', 'Armaria da base') : zone === 'R' ? p('stockroom', 'Munição e suprimentos', { theme: 'weapons' }) : p('mudroom', 'Controle de acesso', { office: true })
  if (specialty === 'lab-equipment') return zone === 'T' ? p('lab', 'Laboratório de análise') : zone === 'R' ? p('archive', 'Amostras e registros') : p('lab', 'Bancadas de pesquisa', { light: true })
  if (specialty === 'medicine-fridge') return zone === 'T' ? p('exam', 'Enfermaria da base', { main: 'hospital-bed' }) : zone === 'R' ? p('stockroom', 'Farmácia da base', { theme: 'medical' }) : p('triage', 'Triagem')
  if (specialty === 'hearth') return zone === 'T' ? p('cabin-kitchen', 'Fogo comunitário') : zone === 'R' ? p('stockroom', 'Despensa do refúgio', { theme: 'food', relief: true }) : p('barracks', 'Colchões do refúgio', { bed: 'mattress' })
  if (specialty === 'camp-tent') return zone === 'T' ? p('stockroom', 'Lonas e equipamento', { theme: 'textiles', relief: true }) : p('barracks', 'Alojamento improvisado', { bed: 'mattress' })
  return zone === 'T' ? p('relief-kitchen', 'Cozinha do refúgio') : zone === 'R' ? p('stockroom', 'Água e mantimentos', { theme: 'food', relief: true }) : p('triage', 'Distribuição de suprimentos')
}
