import type { AssetSpec, Category, LootKind, MaterialKey, Recipe, Vec3 } from './types'
import { SPECIALTY_ASSETS, SPECIALTY_OVERRIDES } from './specialty'
import { INTERIOR_ASSETS } from './interior-assets'

type Fixture = [string, string, Category, Recipe, Vec3, MaterialKey, LootKind?, boolean?]
const fixtures: Fixture[] = [
  ['shelf', 'Prateleira de depósito', 'Comércio', 'shelf', [1.5, 2.1, 0.5], 'steel', 'salvage'],
  ['pharmacy-shelf', 'Estante de farmácia', 'Comércio', 'shelf', [1.4, 2.0, 0.42], 'tile', 'medical'],
  ['grocery-shelf', 'Gôndola de mercado', 'Comércio', 'shelf', [1.7, 1.7, 0.65], 'steel', 'food'],
  ['bookcase', 'Estante de livros', 'Mobiliário', 'shelf', [1.3, 2.0, 0.4], 'wood', 'documents'],
  ['shoe-shelf', 'Expositor de calçados', 'Comércio', 'shelf', [1.5, 1.2, 0.5], 'wood', 'textiles'],
  ['gun-cabinet', 'Armeiro com gaveta oculta', 'Comércio', 'cabinet', [1.2, 1.95, 0.52], 'steel', 'weapons', true],
  ['medicine-cabinet', 'Armário de medicamentos', 'Serviços', 'cabinet', [0.9, 1.7, 0.45], 'tile', 'medical', true],
  ['locker', 'Armário de vestiário', 'Serviços', 'cabinet', [0.8, 1.85, 0.5], 'steel', 'textiles', true],
  ['wardrobe', 'Guarda-roupa', 'Mobiliário', 'cabinet', [1.4, 2.0, 0.6], 'wood', 'textiles', true],
  ['filing-cabinet', 'Arquivo de escritório', 'Mobiliário', 'cabinet', [0.75, 1.35, 0.55], 'steel', 'documents', true],
  ['safe', 'Cofre de piso', 'Comércio', 'cabinet', [0.65, 0.9, 0.55], 'steel', 'weapons', true],
  ['nightstand', 'Mesa de cabeceira', 'Mobiliário', 'cabinet', [0.55, 0.6, 0.45], 'wood', 'salvage', true],
  ['dresser', 'Cômoda de gavetas', 'Mobiliário', 'cabinet', [1.25, 0.95, 0.5], 'wood', 'textiles', true],
  ['counter', 'Balcão de atendimento', 'Comércio', 'counter', [1.8, 1.0, 0.65], 'wood', 'salvage'],
  ['checkout', 'Caixa de supermercado', 'Comércio', 'counter', [1.7, 0.95, 0.65], 'steel', 'electronics'],
  ['bakery-case', 'Vitrine de padaria sem vidro', 'Comércio', 'shelf', [1.65, 1.2, 0.55], 'tile', 'food'],
  ['reception', 'Balcão de recepção', 'Serviços', 'counter', [1.7, 1.15, 0.65], 'wood', 'documents'],
  ['desk', 'Escrivaninha', 'Mobiliário', 'table', [1.4, 0.76, 0.65], 'wood', 'documents'],
  ['dining-table', 'Mesa de jantar', 'Mobiliário', 'table', [1.5, 0.76, 0.85], 'wood', 'food'],
  ['school-desk', 'Carteira escolar', 'Serviços', 'table', [0.8, 0.74, 0.55], 'wood', 'documents'],
  ['workbench', 'Bancada de oficina', 'Comércio', 'table', [1.8, 0.9, 0.7], 'steel', 'tools'],
  ['lab-bench', 'Bancada de laboratório', 'Serviços', 'counter', [1.8, 0.92, 0.65], 'tile', 'medical'],
  ['dining-chair', 'Cadeira de madeira', 'Mobiliário', 'chair', [0.52, 0.95, 0.52], 'wood'],
  ['office-chair', 'Cadeira de escritório', 'Mobiliário', 'chair', [0.6, 1.0, 0.6], 'steel'],
  ['stool', 'Banqueta baixa', 'Mobiliário', 'table', [0.45, 0.5, 0.45], 'wood'],
  ['bench', 'Banco de praça', 'Infraestrutura', 'bench', [1.65, 0.9, 0.6], 'wood'],
  ['pew', 'Banco de igreja', 'Serviços', 'bench', [1.9, 1.0, 0.7], 'wood', 'documents'],
  ['sofa', 'Sofá de sala', 'Mobiliário', 'sofa', [1.8, 0.95, 0.8], 'fabric', 'textiles'],
  ['armchair', 'Poltrona', 'Mobiliário', 'sofa', [0.9, 1.0, 0.85], 'fabric', 'textiles'],
  ['booth', 'Banco de lanchonete', 'Comércio', 'sofa', [1.6, 1.1, 0.7], 'fabric', 'food'],
  ['single-bed', 'Cama de solteiro', 'Mobiliário', 'bed', [1.0, 0.75, 2.0], 'wood', 'textiles'],
  ['double-bed', 'Cama de casal', 'Mobiliário', 'bed', [1.6, 0.85, 2.0], 'wood', 'textiles'],
  ['bunk-bed', 'Beliche de abrigo', 'Mobiliário', 'bunk', [1.0, 1.85, 2.0], 'steel', 'textiles'],
  ['hospital-bed', 'Leito hospitalar', 'Serviços', 'bed', [1.0, 1.0, 2.0], 'steel', 'medical'],
  ['fridge', 'Geladeira aberta', 'Mobiliário', 'shelf', [0.8, 1.7, 0.65], 'tile', 'food'],
  ['freezer', 'Freezer horizontal aberto', 'Comércio', 'crate', [1.5, 0.9, 0.7], 'tile', 'food'],
  ['oven', 'Fogão industrial', 'Comércio', 'appliance', [1.0, 0.9, 0.7], 'steel', 'food'],
  ['washing-machine', 'Máquina de lavar', 'Mobiliário', 'appliance', [0.75, 0.9, 0.65], 'tile', 'salvage'],
  ['vending-machine', 'Máquina de vendas', 'Comércio', 'appliance', [0.9, 1.9, 0.7], 'steel', 'food'],
  ['arcade', 'Gabinete de fliperama', 'Comércio', 'machine', [0.8, 1.65, 0.65], 'wood', 'electronics'],
  ['sink', 'Pia com cuba aberta', 'Mobiliário', 'sink', [1.1, 0.88, 0.6], 'tile', 'salvage'],
  ['toilet', 'Vaso sanitário', 'Mobiliário', 'toilet', [0.6, 0.85, 0.8], 'tile'],
  ['bathtub', 'Banheira vazia', 'Mobiliário', 'tub', [0.85, 0.55, 1.7], 'tile', 'salvage'],
  ['clothes-rack', 'Arara de roupas', 'Comércio', 'rack', [1.6, 1.75, 0.5], 'steel', 'textiles'],
  ['tool-rack', 'Suporte de ferramentas', 'Comércio', 'rack', [1.4, 1.65, 0.5], 'steel', 'tools'],
  ['gun-rack', 'Rack de armamento', 'Comércio', 'rack', [1.3, 1.5, 0.5], 'steel', 'weapons'],
  ['generator', 'Gerador desativado', 'Infraestrutura', 'machine', [1.25, 1.0, 0.7], 'steel', 'tools'],
  ['radio-desk', 'Estação de rádio', 'Infraestrutura', 'machine', [1.3, 1.35, 0.65], 'steel', 'electronics'],
  ['server-rack', 'Rack de servidores', 'Infraestrutura', 'shelf', [0.9, 2.0, 0.65], 'steel', 'electronics'],
  ['electrical-panel', 'Quadro elétrico de piso', 'Infraestrutura', 'cabinet', [0.9, 1.6, 0.45], 'steel', 'electronics', true],
  ['fuel-pump', 'Bomba de combustível', 'Infraestrutura', 'machine', [0.85, 1.65, 0.6], 'paint', 'salvage'],
  ['crate', 'Caixote aberto', 'Rural', 'crate', [0.8, 0.6, 0.65], 'wood', 'agriculture'],
  ['medical-crate', 'Caixa de suprimentos', 'Serviços', 'crate', [0.7, 0.4, 0.5], 'tile', 'medical'],
  ['ammo-crate', 'Caixa militar', 'Infraestrutura', 'crate', [0.75, 0.45, 0.5], 'steel', 'weapons', true],
  ['pallet', 'Pallet de carga', 'Comércio', 'pallet', [1.2, 0.18, 0.9], 'wood', 'salvage'],
  ['water-tank', 'Reservatório retangular', 'Rural', 'tank', [1.4, 1.6, 1.2], 'steel', 'agriculture'],
  ['barrel', 'Tambor de contenção', 'Infraestrutura', 'tank', [0.6, 0.9, 0.6], 'steel', 'salvage'],
  ['dumpster', 'Caçamba aberta', 'Infraestrutura', 'crate', [1.7, 1.1, 1.0], 'steel', 'salvage'],
  ['planter', 'Canteiro elevado', 'Rural', 'crate', [1.6, 0.5, 0.65], 'wood', 'agriculture'],
  ['trough', 'Cocho de estábulo', 'Rural', 'tub', [1.65, 0.55, 0.65], 'wood', 'agriculture'],
  ['fence', 'Cerca rural', 'Rural', 'fence', [2.0, 1.2, 0.14], 'wood'],
  ['barricade', 'Barricada de tábuas', 'Infraestrutura', 'fence', [1.8, 1.4, 0.25], 'wood'],
  ['blackboard', 'Quadro escolar com suporte', 'Serviços', 'board', [1.7, 1.8, 0.5], 'charcoal'],
  ['noticeboard', 'Mural de avisos', 'Infraestrutura', 'board', [1.2, 1.7, 0.45], 'wood', 'documents'],
  ['sign', 'Placa de estabelecimento', 'Comércio', 'board', [1.5, 1.7, 0.45], 'paint'],
  ['kennel', 'Abrigo de animais', 'Rural', 'counter', [1.0, 0.8, 0.8], 'wood', 'agriculture'],
]

const variants = ['estreita', 'padrão', 'larga']
export const ASSETS: AssetSpec[] = fixtures.flatMap(([family, label, category, recipe, size, material, loot, concealed]) =>
  variants.map((name, variant) => ({ id: `${family}-${variant}`, family, label: `${label} · ${name}`, category, recipe: SPECIALTY_OVERRIDES.has(family) ? 'specialty' : recipe, size: [size[0] * [0.8, 1, 1.15][variant], size[1], size[2]] as Vec3, material, variant, loot, concealed })),
)

for (const material of ['concrete', 'brick', 'wood'] as const) {
  for (const [recipe, label] of [['wall', 'Parede cega'], ['doorway', 'Parede com porta'], ['window', 'Parede com janela'], ['broken-wall', 'Parede fraturada']] as const) {
    for (const [variant, width] of [2, 3, 3.8].entries()) ASSETS.push({ id: `${recipe}-${material}-${variant}`, family: recipe, label: `${label} · ${material === 'wood' ? 'madeira' : material === 'brick' ? 'alvenaria' : 'concreto'} · ${width} m`, category: 'Arquitetura', recipe, size: [width, 3, 0.2], material, variant })
  }
}
for (const [family, label, recipe, material] of [
  ['plank-wall', 'Parede de tábuas', 'wall', 'wood'],
  ['log-wall', 'Parede de toras', 'wall', 'wood'],
  ['boarded-window', 'Janela tapada com tábuas', 'wall', 'wood'],
  ['shutter-window', 'Janela com venezianas', 'window', 'plaster'],
  ['arched-window', 'Janela em arco', 'window', 'brick'],
  ['corrugated-wall', 'Parede de chapa ondulada', 'wall', 'steel'],
  ['half-timber-wall', 'Parede enxaimel', 'wall', 'plaster'],
  ['cobogo-wall', 'Parede de cobogó', 'wall', 'concrete'],
  ['stone-wall', 'Parede de pedra', 'wall', 'concrete'],
  ['arched-doorway', 'Passagem em arco', 'doorway', 'brick'],
] satisfies [string, string, Recipe, MaterialKey][]) {
  for (const [variant, width] of [2, 3, 3.8].entries()) ASSETS.push({ id: `${family}-${variant}`, family, label: `${label} · ${width} m`, category: 'Arquitetura', recipe, size: [width, 3, 0.2], material, variant })
}
for (const [family, label, recipe, size, material] of [
  ['foundation', 'Fundação', 'slab', [4, 0.24, 4], 'concrete'],
  ['floor', 'Laje de pavimento', 'slab', [4, 0.2, 4], 'concrete'],
  ['tile-floor', 'Piso de cerâmica', 'slab', [4, 0.2, 4], 'tile'],
  ['roof', 'Cobertura plana', 'slab', [4, 0.2, 4], 'concrete'],
  ['wood-roof', 'Cobertura de madeira', 'slab', [4, 0.2, 4], 'wood'],
  ['pillar', 'Pilar estrutural', 'pillar', [0.2, 3, 0.2], 'concrete'],
  ['wood-post', 'Esteio de madeira', 'pillar', [0.2, 3, 0.2], 'wood'],
  ['stairs', 'Escada de 16 degraus', 'stairs', [1.4, 3.2, 4.8], 'concrete'],
] satisfies [string, string, Recipe, Vec3, MaterialKey][]) {
  for (let variant = 0; variant < 3; variant++) ASSETS.push({ id: `${family}-${variant}`, family, label: `${label} · ${variants[variant]}`, category: 'Arquitetura', recipe, size: [size[0] * [0.85, 1, 1.15][variant], size[1], size[2]], material, variant })
}
for (const [family, label, material] of [
  ['brick-rubble', 'Tijolos quebrados', 'brick'], ['concrete-rubble', 'Fragmentos de concreto', 'concrete'], ['planks', 'Tábuas soltas', 'wood'], ['metal-scrap', 'Sucata metálica', 'steel'], ['burned-debris', 'Destroços carbonizados', 'charcoal'], ['tile-rubble', 'Cerâmica quebrada', 'tile'], ['plaster-rubble', 'Reboco caído', 'plaster'], ['collapsed-beam', 'Viga desabada', 'concrete'],
] satisfies [string, string, MaterialKey][]) {
  for (let variant = 0; variant < 4; variant++) ASSETS.push({ id: `${family}-${variant}`, family, label: `${label} · conjunto ${variant + 1}`, category: 'Destroços', recipe: 'debris', size: [1.3 + variant * 0.13, 0.35 + variant * 0.07, 0.7], material, variant, loot: 'salvage' })
}
for (const [family, label, material, loot] of [
  ['medicine', 'Frascos de medicamento', 'tile', 'medical'], ['bandages', 'Pacotes de ataduras', 'fabric', 'medical'], ['cans', 'Latas de conserva', 'steel', 'food'], ['food-box', 'Caixas de alimento', 'wood', 'food'], ['bottles', 'Recipientes de água', 'tile', 'food'], ['ammo', 'Caixas de munição', 'steel', 'weapons'], ['handgun', 'Arma curta inerte', 'steel', 'weapons'], ['toolbox', 'Ferramentas embaladas', 'steel', 'tools'], ['cloth', 'Tecidos dobrados', 'fabric', 'textiles'], ['battery', 'Pilhas e componentes', 'charcoal', 'electronics'], ['seeds', 'Pacotes de sementes', 'wood', 'agriculture'], ['papers', 'Pilhas de documentos', 'plaster', 'documents'], ['plastic', 'Embalagens descartadas', 'paint', 'salvage'],
] satisfies [string, string, MaterialKey, LootKind][]) {
  for (let variant = 0; variant < 3; variant++) ASSETS.push({ id: `${family}-${variant}`, family, label: `${label} · ${variant + 1}`, category: 'Recursos', recipe: 'resource', size: [0.22 + variant * 0.07, 0.12 + variant * 0.05, 0.2], material, variant, loot })
}

ASSETS.push(...SPECIALTY_ASSETS, ...INTERIOR_ASSETS)

export const ASSET_BY_ID = new Map(ASSETS.map((asset) => [asset.id, asset]))
export const CATEGORIES = [...new Set(ASSETS.map((asset) => asset.category))]
export function assetFor(family: string, variant = 1): AssetSpec {
  const spec = ASSET_BY_ID.get(`${family}-${variant}`)
  if (!spec) throw new Error(`Módulo desconhecido: ${family}-${variant}`)
  return spec
}
