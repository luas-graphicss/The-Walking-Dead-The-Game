import type { Blueprint } from './types'

export type RoofKind = 'gable' | 'gambrel' | 'flat' | 'sawtooth' | 'frame' | 'shed'
export type FacadeKind = 'domestic' | 'storefront' | 'institutional' | 'industrial' | 'timber' | 'open' | 'fortified'
export type Architecture = {
  plan: string[]
  roof: RoofKind
  bay: [number, number]
  wallHeight: number
  facade: FacadeKind
  feature: string
  specialty: string
  identity: string
  partitions: boolean
  entryWidth: number
}

const profiles = new Map<string, Architecture>()
function define(id: string, plan: string, roof: RoofKind, facade: FacadeKind, specialty: string, feature: string, identity: string, bay: [number, number] = [4.8, 5.2], height = 3, partitions = false, entryWidth = 1.8) {
  profiles.set(id, { plan: plan.split('|'), roof, facade, specialty, feature, identity, bay, wallHeight: height, partitions, entryWidth })
}
function home(id: string, plan: string, roof: RoofKind, feature: string, identity: string, specialty = 'hearth') {
  define(id, plan, roof, id === 'wood-house' || id === 'bungalow' ? 'timber' : 'domestic', specialty, feature, identity, [4.6, 5.2], 3, true, 1.2)
}
function shop(id: string, plan: string, roof: RoofKind, specialty: string, identity: string, feature = 'awning', bay: [number, number] = [4.6, 5.0]) {
  define(id, plan, roof, ['warehouse', 'construction-supply', 'garage', 'print-shop', 'auto-parts'].includes(id) ? 'industrial' : 'storefront', specialty, feature, identity, bay, roof === 'sawtooth' ? 4.6 : 3.2, false, 2.2)
}
function service(id: string, plan: string, roof: RoofKind, specialty: string, feature: string, identity: string, height = 3.2, partitions = true) {
  define(id, plan, roof, 'institutional', specialty, feature, identity, [5.2, 5.4], height, partitions, 2)
}
function rural(id: string, plan: string, roof: RoofKind, specialty: string, feature: string, identity: string, bay: [number, number], height: number, facade: FacadeKind = 'timber') {
  define(id, plan, roof, facade, specialty, feature, identity, bay, height, false, ['barn', 'stable', 'sawmill', 'grain-store'].includes(id) ? 3.2 : 1.2)
}

home('cottage', 'BK|LE', 'gable', 'porch', 'Casa pequena de duas águas, varanda de entrada e chaminé; cozinha e quarto separados.')
home('family-house', 'BBK|ALS| EE', 'gable', 'porch', 'Casa em L com ala íntima, cozinha nos fundos e varanda no recuo da fachada.')
home('duplex', 'BK|LS|EE', 'gable', 'balcony', 'Sobrado estreito com circulação vertical, sacada frontal e cumeeira alta.')
home('corner-house', 'BK |LKE| EE', 'shed', 'corner-porch', 'Casa de esquina com dois volumes deslocados e varanda lateral em retorno.')
home('rowhouse', 'B|K|L|E', 'gable', 'stoop', 'Moradia de vila estreita e profunda; empena frontal e pequeno alpendre.')
home('wood-house', 'BK|LE', 'gable', 'timber-porch', 'Cabana de tábuas com esteios aparentes, varanda de madeira e fogão a lenha.')
home('courtyard-house', 'BKB|A L|EEE', 'shed', 'courtyard', 'Casa em U em torno de um pátio aberto, com coberturas independentes por ala.', 'well')
home('boarding-house', 'BB|SS|BB|EE', 'gable', 'porch', 'Pensão alongada, quartos repetidos de forma funcional e acesso coletivo protegido.')
home('rental-room', 'BKB|ESE', 'flat', 'terrace', 'Quitinetes compactas, entradas individuais e platibanda baixa; não um galpão vazio.')
home('bungalow', 'BK|LE', 'gable', 'deep-porch', 'Bangalô baixo com varanda profunda, pilares robustos e sala voltada para a entrada.')
home('workshop-house', 'BKT|LST|EE ', 'gable', 'workshop', 'Residência em L ligada a uma oficina lateral com bancada, morsa e vão de serviço.', 'vice-bench')
home('shop-house', 'RK|FS|EE', 'flat', 'shop-balcony', 'Loja no térreo e moradia sobreposta; vitrine, marquise e sacada identificam os usos.', 'cash-register')
home('large-house', 'BBB|KSL| E ', 'gable', 'porch', 'Casa em T com alas de dormitórios e estar; entrada marcada por alpendre central.')
home('unfinished-house', 'RR |TSE| EE', 'flat', 'unfinished', 'Obra interrompida com pórticos, vãos sem esquadrias e cobertura ainda incompleta.', 'cement-mixer')
home('caretaker-house', 'BK|TE', 'shed', 'utility', 'Moradia de serviço compacta, abrigo técnico lateral e quadro de manutenção.', 'transformer')
home('residential-court', 'BBB|K K|EEE', 'gable', 'courtyard', 'Vila em U com pátio coletivo, varandas contínuas e alas de pequenas residências.', 'well')

shop('pharmacy', 'RT|FE', 'flat', 'medicine-fridge', 'Farmácia com vitrine baixa, balcão de dispensação e cruz montada na fachada.', 'medical')
shop('gun-store', 'RT|FF|EE', 'flat', 'weapon-display', 'Loja protegida por grades, expositores de armas inertes e balcão de segurança.', 'security')
shop('grocery', 'RRR|FTF|FEE', 'flat', 'produce-display', 'Mercado com corredores de gôndolas, ilha de produtos e frente de caixas.', 'market')
shop('bakery', 'TK|FF|EE', 'gable', 'bread-oven', 'Padaria com forno alto e chaminé nos fundos; expositores baixos na área de venda.', 'chimney')
shop('butcher', 'TR|FE', 'flat', 'butcher-rail', 'Açougue com trilho de ganchos, bloco de corte e câmara de conservação.', 'awning')
shop('produce', 'TRR|FFE| EE', 'shed', 'produce-display', 'Hortifrúti aberto para a rua, bancas inclinadas e pátio de recebimento.', 'market')
shop('hardware', 'RRT|FFF|EEE', 'sawtooth', 'vice-bench', 'Ferragens sob cobertura industrial serrilhada; morsa e ferramentas em bancadas.')
shop('clothing', 'TR|FF|EE', 'flat', 'fitting-booth', 'Loja com provadores, araras espaçadas e vitrine de manequim em blocagem.')
shop('shoe-store', 'TR|FE', 'shed', 'shoe-display', 'Sapataria baixa com bancos de prova e expositores escalonados de calçados.')
shop('bookshop', 'TRR|FEE| E ', 'gable', 'reading-table', 'Livraria em L, mesas de leitura e estantes criando corredores legíveis.')
shop('stationery', 'TR|FE', 'flat', 'paper-cutter', 'Papelaria com guilhotina de papel, arquivo e mesa de atendimento.')
shop('electronics', 'TR|FF|EE', 'flat', 'electronics-bench', 'Eletrônicos com bancada de monitores, expositores técnicos e balcão de reparo.')
shop('repair-shop', 'TR|FE', 'shed', 'electronics-bench', 'Assistência técnica com instrumentos na bancada, peças organizadas e acesso de serviço.')
shop('furniture-store', 'TRR|FFF|EEE', 'sawtooth', 'display-platform', 'Showroom amplo com ilhas de móveis sobre plataformas e entrada de carga larga.')
shop('thrift-store', 'TR |FFE| EE', 'gable', 'fitting-booth', 'Brechó em duas alas, cabines de prova e araras com corredor central livre.')
shop('pawnshop', 'TR|FE', 'flat', 'security-counter', 'Penhores com balcão gradeado, cofre protegido e recepção compacta.', 'security')
shop('jeweler', 'TR|FE', 'gable', 'watch-bench', 'Joalheria estreita com vitrine baixa, posto de relojoeiro e cofre ao fundo.', 'security', [3.8, 4.6])
shop('optician', 'TR|FE', 'flat', 'optical-chair', 'Ótica com cadeira de exame, expositor e sala técnica separada da entrada.')
shop('pet-store', 'TRR|FEE', 'shed', 'animal-cages', 'Pet shop com módulos de alojamento, banheira de serviço e área de alimentação.')
shop('flower-shop', 'TF|EE', 'gable', 'potting-bench', 'Floricultura aberta, bancada de vasos e bancas baixas protegidas por toldo.')
shop('garden-store', 'TRT|F F|EEE', 'frame', 'potting-bench', 'Garden center em U, bancadas de cultivo e treliças em torno de pátio descoberto.', 'garden')
shop('fishing-store', 'TR|FF|EE', 'gable', 'fishing-rack', 'Loja de pesca com suportes de varas longas e banca de reparo de equipamento.')
shop('camping-store', 'RRT|FFF|EEE', 'gable', 'camp-tent', 'Loja de camping com tenda demonstrativa, área de equipamento e pé-direito aberto.')
shop('sports-store', 'RRT|FFF|EEE', 'flat', 'sports-rack', 'Loja esportiva com suportes de bolas, bancos e área de demonstração.')
shop('toy-store', 'TR|FE', 'gable', 'toy-display', 'Loja de brinquedos com expositor baixo, bancada infantil e vitrine recuada.')
shop('music-store', 'TR|FF|EE', 'flat', 'piano', 'Loja de música com piano em blocagem, expositores de instrumentos e amplificadores.')
shop('photo-store', 'TR |FOE| EE', 'flat', 'studio-camera', 'Estúdio com câmera de tripé, fundo elevado e sala técnica lateral.')
shop('paint-store', 'TR|FF|EE', 'shed', 'paint-mixer', 'Casa de tintas com misturador, tambores e bancada de amostras sólidas.')
shop('construction-supply', 'RTR|HHH|EEE', 'sawtooth', 'cement-mixer', 'Depósito de materiais com betoneira, vãos de carga e pátio frontal.', 'loading')
shop('auto-parts', 'RTR|FFF|EEE', 'sawtooth', 'engine-stand', 'Autopeças com motor em cavalete, bancadas técnicas e armazenagem de grande porte.', 'loading')
shop('motorcycle-shop', 'RT |TFE| EE', 'shed', 'bike-lift', 'Oficina de motos em L, plataforma de manutenção e bancada junto ao acesso largo.', 'garage')
shop('bicycle-shop', 'TR|FF|EE', 'gable', 'bicycle-stand', 'Bicicletaria com bicicleta em suporte, rodas e uma bancada de reparos.')
shop('tire-shop', 'TR|EE', 'shed', 'tire-changer', 'Borracharia com desmontadora de pneus, rodas empilhadas e abrigo aberto.', 'garage')
shop('garage', 'RTR|TTT|EEE', 'sawtooth', 'vehicle-lift', 'Oficina mecânica com elevador de duas colunas, boxes amplos e cobertura industrial.', 'garage', [5.6, 5.4])
shop('fuel-station', 'RT|FE', 'flat', 'fuel-pump', 'Posto com loja de apoio e grande cobertura independente sobre ilhas de abastecimento.', 'fuel-canopy')
shop('car-wash', 'RT|EE|EE', 'frame', 'wash-gantry', 'Lava-rápido com pórticos abertos, equipamento de lavagem e tanque técnico.', 'wash')
shop('diner', 'TK|FF|EE', 'gable', 'diner-booth', 'Diner alongado com bancos frente a frente, balcão e cozinha nos fundos.')
shop('restaurant', 'TKK|FFE| EE', 'gable', 'range-hood', 'Restaurante em L; salão de mesas separado da cozinha industrial e exaustão.', 'chimney')
shop('cafe', 'TK|FE', 'gable', 'coffee-machine', 'Café compacto com máquina sobre bancada, mesas pequenas e entrada sob toldo.')
shop('bar', 'TR |FFE| EE', 'flat', 'bar-tap', 'Bar de esquina com torneiras sobre balcão, salão lateral e marquise em retorno.')
shop('pizzeria', 'TK|FF|EE', 'gable', 'pizza-oven', 'Pizzaria identificada pelo forno abobadado em blocagem e chaminé de cozinha.', 'chimney')
shop('ice-cream', 'TR|FE', 'flat', 'ice-cream-case', 'Sorveteria com vitrine refrigerada escalonada e área de bancos baixa.')
shop('tea-house', 'TKT|F F|EEE', 'gable', 'tea-counter', 'Casa de chá em U, pátio central e pequenos salões voltados para o jardim.', 'garden')
shop('laundry', 'TR|FF|EE', 'flat', 'laundry-drum', 'Lavanderia com máquinas de tambores circulares, mesa de dobra e zona de serviço.')
shop('barbershop', 'TR|FE', 'flat', 'barber-chair', 'Barbearia com cadeira hidráulica, espelho volumétrico e lavatório por estação.')
shop('salon', 'TR|FF|EE', 'shed', 'salon-station', 'Salão com cadeiras, espelhos elevados e lavatórios nas laterais do corredor.')
shop('tailor', 'TR|FE', 'gable', 'sewing-machine', 'Ateliê com máquina de costura sobre mesa, corte de tecido e provador.')
shop('cobbler', 'TR|FE', 'shed', 'cobbler-bench', 'Sapataria de reparo com torno de trabalho e pequena bancada de sapateiro.')
shop('print-shop', 'RTR|TTT|EEE', 'sawtooth', 'printing-press', 'Gráfica com prensa, alimentação de papel e espaço para manutenção da máquina.', 'loading')
shop('internet-cafe', 'TR|FF|EE', 'flat', 'computer-station', 'Lan house com postos de computador orientados para bancadas e rack técnico.')
shop('arcade-hall', 'RTR|FFF|EEE', 'flat', 'pinball', 'Fliperama com máquinas inclinadas, gabinetes altos e passagem entre fileiras.')
shop('funeral-home', 'TR|FF|EE', 'gable', 'casket', 'Funerária com sala de cerimônia, suporte de urna e recepção separada.', 'portico')
shop('motel', 'BBB|B B|EEE', 'flat', 'motel-bed', 'Motel em U com quartos voltados ao pátio e galeria externa de circulação.', 'motel-gallery')
shop('inn', 'BBB|KSL| E ', 'gable', 'reception-bell', 'Pousada em T, volume central de recepção e alas de quartos sob telhados próprios.', 'porch')
shop('warehouse', 'RRR|RHR|EEE', 'sawtooth', 'forklift', 'Armazém alto com empilhadeira, corredores de pallets e doca de expedição.', 'loading', [6, 6])
shop('agro-store', 'RTR|FFF|EEE', 'gable', 'feed-hopper', 'Agropecuária com tremonha de ração, equipamentos agrícolas e recebimento coberto.', 'loading')

service('clinic', 'DW |CCE| EE', 'gable', 'exam-table', 'medical', 'Posto de saúde em L, recepção protegida e alas de consultas identificáveis.')
service('dental-clinic', 'DT|CE', 'flat', 'dental-chair', 'medical', 'Clínica odontológica com cadeira articulada, braço de iluminação e bancada de esterilização.')
service('veterinary', 'DT|WW|EE', 'gable', 'animal-cages', 'medical', 'Veterinária com baias clínicas, mesa de exame e acesso de serviço.')
service('school', 'TTTT|CCCC| EE ', 'gable', 'teacher-desk', 'school', 'Escola com alas de salas, corredor longitudinal e entrada central sob pórtico.')
service('daycare', 'BBB|T T|EEE', 'gable', 'play-table', 'school', 'Creche em U com quartos baixos, sala de atividades e pátio protegido.')
service('library', 'RTR|FFF|EEE', 'sawtooth', 'reading-table', 'library', 'Biblioteca com nave de leitura alta, iluminação zenital e estantes em corredores.', 4.4, false)
service('police', 'TT |CCE| EE', 'flat', 'holding-cell', 'security', 'Delegacia em L com área de atendimento, celas gradeadas e armaria protegida.')
service('fire-station', 'RTR|TTE|EEE', 'gable', 'fire-gear', 'fire-tower', 'Quartel com bays altos de viatura, equipamentos de combate e torre de secagem.', 4.6, false)
service('post-office', 'TR|FF|EE', 'flat', 'sorting-rack', 'portico', 'Correios com triagem postal, nichos de correspondência e balcões de atendimento.')
service('bank', 'TT |CCE| EE', 'flat', 'vault-door', 'bank', 'Banco com fachada de pilares, área de caixas e porta circular de cofre.')
service('church', ' A |WWW|WWW| E ', 'gable', 'altar', 'bell-tower', 'Igreja com nave alta, transepto, altar e campanário; não um comércio alongado.', 5.4, false)
service('community-center', 'RTR|FFF|EEE', 'gable', 'stage', 'portico', 'Centro comunitário de grande vão, palco nos fundos e praça de entrada.', 4.4, false)
service('town-hall', 'OTO|CSC| E ', 'flat', 'council-desk', 'civic', 'Prefeitura com entrada solene, alas administrativas e salão de reuniões.')
service('bus-depot', 'RTT|EEE', 'shed', 'ticket-gate', 'platform', 'Rodoviária com bilheteria e marquise ampla cobrindo plataformas abertas.', 4.2, false)
service('train-station', 'RT|FE|EE', 'gable', 'signal-lever', 'platform', 'Estação com plataforma longitudinal, cobertura de espera e sala de sinalização.', 3.6, false)
service('shelter', 'RTR|WWW|EEE', 'gable', 'field-kitchen', 'relief', 'Abrigo coletivo com alojamentos, cozinha de campanha e triagem de suprimentos.', 3.8, false)
service('power-substation', 'TTT|E E|EEE', 'frame', 'transformer', 'substation', 'Pátio técnico aberto com transformadores, isoladores e pórticos de distribuição.', 3.4, false)
service('water-works', 'RTR|TTT|EEE', 'shed', 'water-pump', 'water-tower', 'Estação hidráulica com bombas, válvulas, tanques e reservatório elevado.', 4.4, false)

rural('farmhouse', 'BBK|ALS|EE ', 'gable', 'hearth', 'farmstead', 'Sede rural em L: varanda profunda, chaminé, poço, cercado e equipamentos no terreiro.', [4.8, 5.2], 3)
rural('barn', 'HH|HH|EE', 'gambrel', 'tractor', 'barn', 'Celeiro de pé-direito alto e telhado mansarda rural, portão duplo, mezanino de feno e silo.', [6, 6], 4.6)
rural('stable', 'SS|SS|EE', 'gable', 'horse-stall', 'paddock', 'Estábulo comprido com baias, cochos, corredor de manejo e cercado exterior.', [5, 5.4], 3.4)
rural('greenhouse', 'GG|GG|EE', 'frame', 'seedling-bench', 'greenhouse', 'Estufa de estrutura leve: pórticos inclinados sem vidros, canteiros e reservatório.', [3.4, 4.4], 2.4, 'open')
rural('hunting-cabin', 'BK|LE', 'gable', 'weapon-display', 'cabin', 'Cabana de caça com alpendre estreito, fogão a lenha e suporte de equipamento.', [3.8, 4.4], 2.8)
rural('ranger-cabin', 'BT|EE', 'shed', 'radio-console', 'lookout', 'Posto florestal com varanda de observação, bancada de rádio e torre de vigilância baixa.', [4, 4.8], 3)
rural('fishing-cabin', 'BK|TE', 'gable', 'fishing-rack', 'fishing', 'Cabana de pescador com abrigo para ferramentas, varas e deque de trabalho.', [3.8, 4.4], 2.8)
rural('sawmill', 'RT|TT|EE', 'sawtooth', 'saw-table', 'sawmill', 'Serraria com galpão ventilado, serra de bancada, rolos de transporte e toras.', [6, 6], 4.2, 'industrial')
rural('grain-store', 'RH|HE', 'shed', 'feed-hopper', 'silos', 'Armazenagem de grãos com silos cilíndricos, cobertura cônica e tremonha de carga.', [5, 6], 4, 'industrial')
rural('rural-clinic', 'DW|CE', 'gable', 'exam-table', 'medical-porch', 'Enfermaria rural térrea, varanda de espera, cruz e sala de atendimento funcional.', [4.4, 5], 3)

define('apartment-building', 'AAA|AS |EE ', 'flat', 'domestic', 'mailboxes', 'balconies', 'Prédio residencial em L, sacadas por pavimento e circulação vertical protegida.', [5.4, 6], 3, true)
define('office-building', 'OOO|OSO|EEE', 'flat', 'institutional', 'computer-station', 'office', 'Edifício comercial com fachada ritmada por caixilhos, lobby e pavimentos de escritórios.', [5.4, 6], 3, false)
define('hospital-building', 'WW WW|DDCDD|WWCWW|  S  ', 'flat', 'institutional', 'ct-scanner', 'hospital', 'Hospital em H com alas de internação, conexão central, entrada de ambulâncias, cruz danificada e tomografia.', [4.8, 6], 3, true, 2.4)
define('abandoned-base', 'TT|EE', 'flat', 'fortified', 'field-kitchen', 'military', 'Base murada com guarita, alojamentos, portão e pátio operacional.', [6, 6], 3, false, 2.4)
define('research-outpost', 'DT|EE', 'shed', 'institutional', 'lab-equipment', 'research', 'Posto de pesquisa com laboratórios, antena de comunicação e pátio técnico cercado.', [6, 6], 3, true, 2.4)
define('survivor-camp', 'BT|EE', 'gable', 'timber', 'camp-tent', 'camp', 'Refúgio de sobreviventes com barracas, abrigo de suprimentos e barricadas de madeira.', [6, 6], 3, false, 2.4)

export function architectureFor(blueprint: Blueprint | string): Architecture {
  const id = typeof blueprint === 'string' ? blueprint : blueprint.id
  const profile = profiles.get(id)
  if (!profile) throw new Error(`Identidade arquitetônica não definida: ${id}`)
  return profile
}

export function planCells(profile: Architecture) {
  return profile.plan.flatMap((row, z) => [...row].flatMap((zone, x) => zone === ' ' ? [] : [{ x, z, zone }]))
}
