import type { MaterialKey, Vec3 } from '../blockout/types'

export type ResourceCategory = 'metal' | 'construcao' | 'plastico' | 'quimico' | 'combustivel' | 'eletrico' | 'medico' | 'higiene' | 'alimento' | 'bebida' | 'arma' | 'peca-arma' | 'municao' | 'ferramenta' | 'tecido' | 'agricola' | 'utilidade' | 'documento' | 'sucata'
export type Rarity = 'comum' | 'incomum' | 'raro' | 'muito-raro'

export type Use = 'armas' | 'municao' | 'explosivos' | 'armadilhas' | 'paredes' | 'tetos' | 'barricadas' | 'ferramentas' | 'medicina' | 'alimentacao' | 'agua' | 'eletrica' | 'iluminacao' | 'fogo' | 'vestuario' | 'armadura' | 'armazenamento' | 'veiculos' | 'agricultura' | 'comunicacao' | 'informacao' | 'troca' | 'higiene' | 'abrigo'

export type Container = 'prateleira' | 'gondola' | 'farmacia' | 'remedios' | 'refrigerado' | 'despensa' | 'pia' | 'banheiro' | 'gaveta' | 'roupeiro' | 'cama' | 'mesa' | 'escritorio' | 'estante' | 'bancada' | 'ferramentas' | 'armeiro' | 'cofre' | 'caixa' | 'eletrico' | 'maquina' | 'tambor' | 'clinico' | 'salao' | 'caixote' | 'lixo' | 'escombros'

export type SiteTag = 'casa' | 'hospedagem' | 'farmacia' | 'clinica' | 'hospital' | 'veterinaria' | 'mercado' | 'restaurante' | 'ferragens' | 'construcao' | 'oficina' | 'posto' | 'armas' | 'policia' | 'militar' | 'bombeiros' | 'eletronicos' | 'vestuario' | 'esportes' | 'papelaria' | 'escritorio' | 'escola' | 'agro' | 'fazenda' | 'cabana' | 'serraria' | 'utilidade' | 'beleza' | 'joalheria' | 'brinquedos' | 'funeraria' | 'igreja' | 'transporte' | 'armazem' | 'abrigo' | 'pesquisa' | 'lavanderia' | 'pet' | 'moveis' | 'optica'

export type PropFamily = 'medicine' | 'bandages' | 'cans' | 'food-box' | 'bottles' | 'ammo' | 'handgun' | 'toolbox' | 'cloth' | 'battery' | 'seeds' | 'papers' | 'plastic'

export type BlockoutShape = 'box' | 'pack' | 'can' | 'bottle' | 'jar' | 'jug' | 'sack' | 'bundle' | 'stack' | 'coil' | 'roll' | 'tube' | 'tank' | 'device' | 'tool' | 'bar' | 'blade' | 'longgun' | 'pistol' | 'mag' | 'pouch' | 'pile' | 'sheet' | 'spool' | 'bag'

export type ResourceModel =
  | { status: 'pronto'; family: PropFamily }
  | { status: 'esculpido' | 'pendente'; shape: BlockoutShape; size: Vec3; material: MaterialKey }

export type Resource = {
  id: string
  label: string
  category: ResourceCategory
  rarity: Rarity

  weight: number

  quantity: [number, number]
  stack: number
  uses: Use[]
  containers: Container[]

  sites: Partial<Record<SiteTag | '*', number>>
  display: PropFamily
  model: ResourceModel
}

export type ResourceStack = { resource: Resource; quantity: number }

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  metal: 'Metais', construcao: 'Construção', plastico: 'Plásticos e borracha', quimico: 'Químicos', combustivel: 'Combustíveis e óleos', eletrico: 'Elétrica e eletrônica',
  medico: 'Medicamentos e socorro', higiene: 'Higiene e limpeza', alimento: 'Alimentos', bebida: 'Bebidas', arma: 'Armas', 'peca-arma': 'Peças de armas', municao: 'Munição e recarga',
  ferramenta: 'Ferramentas', tecido: 'Tecidos, couro e cordas', agricola: 'Agrícola e animal', utilidade: 'Utilidades e sobrevivência', documento: 'Documentos e informação', sucata: 'Sucata e componentes',
}

export const SHAPE_LABELS: Record<BlockoutShape, string> = {
  box: 'caixa', pack: 'embalagem', can: 'lata', bottle: 'garrafa', jar: 'pote', jug: 'galão', sack: 'saco', bundle: 'feixe', stack: 'pilha', coil: 'rolo', roll: 'bobina', tube: 'tubo',
  tank: 'cilindro', device: 'aparelho', tool: 'ferramenta de cabo', bar: 'barra', blade: 'lâmina', longgun: 'arma longa', pistol: 'arma curta', mag: 'carregador', pouch: 'estojo', pile: 'monte',
  sheet: 'chapa', spool: 'carretel', bag: 'bolsa',
}

export const RARITY_LABELS: Record<Rarity, string> = { comum: 'Comum', incomum: 'Incomum', raro: 'Raro', 'muito-raro': 'Muito raro' }
export const RARITY_WEIGHT: Record<Rarity, number> = { comum: 1, incomum: 0.42, raro: 0.14, 'muito-raro': 0.04 }

export const USE_LABELS: Record<Use, string> = {
  armas: 'Armas', municao: 'Munição', explosivos: 'Explosivos', armadilhas: 'Armadilhas', paredes: 'Paredes', tetos: 'Tetos', barricadas: 'Barricadas', ferramentas: 'Ferramentas',
  medicina: 'Medicina', alimentacao: 'Alimentação', agua: 'Água', eletrica: 'Elétrica', iluminacao: 'Iluminação', fogo: 'Fogo', vestuario: 'Vestuário', armadura: 'Armadura',
  armazenamento: 'Armazenamento', veiculos: 'Veículos', agricultura: 'Agricultura', comunicacao: 'Comunicação', informacao: 'Informação', troca: 'Troca', higiene: 'Higiene', abrigo: 'Abrigo',
}

export const CONTAINER_LABELS: Record<Container, string> = {
  prateleira: 'Prateleira de estoque', gondola: 'Gôndola de mercado', farmacia: 'Estante de farmácia', remedios: 'Armário de remédios', refrigerado: 'Geladeira e freezer', despensa: 'Armário de cozinha',
  pia: 'Pia e área de serviço', banheiro: 'Banheiro', gaveta: 'Gavetas', roupeiro: 'Guarda-roupa e armário', cama: 'Cama e estofados', mesa: 'Mesas', escritorio: 'Arquivo e escrivaninha',
  estante: 'Estante de livros', bancada: 'Bancada de oficina', ferramentas: 'Painel de ferramentas', armeiro: 'Armeiro', cofre: 'Cofre', caixa: 'Balcão e caixa', eletrico: 'Painéis e eletrônicos',
  maquina: 'Máquinas e motores', tambor: 'Tambores e tanques', clinico: 'Equipamento clínico', salao: 'Estação de beleza', caixote: 'Caixotes e cochos', lixo: 'Lixo', escombros: 'Escombros',
}

export const SITE_LABELS: Record<SiteTag, string> = {
  casa: 'Residências', hospedagem: 'Hospedagem', farmacia: 'Farmácias', clinica: 'Clínicas', hospital: 'Hospitais', veterinaria: 'Veterinárias', mercado: 'Mercados', restaurante: 'Restaurantes e bares',
  ferragens: 'Ferragens', construcao: 'Material de construção', oficina: 'Oficinas', posto: 'Postos de combustível', armas: 'Lojas de armas', policia: 'Delegacias', militar: 'Bases militares',
  bombeiros: 'Bombeiros', eletronicos: 'Eletrônicos', vestuario: 'Vestuário', esportes: 'Esporte, pesca e camping', papelaria: 'Papelarias e livrarias', escritorio: 'Escritórios', escola: 'Escolas',
  agro: 'Agropecuárias', fazenda: 'Fazendas', cabana: 'Cabanas', serraria: 'Serrarias', utilidade: 'Infraestrutura', beleza: 'Salões', joalheria: 'Joalherias e penhores', brinquedos: 'Brinquedos',
  funeraria: 'Funerárias', igreja: 'Igrejas e centros comunitários', transporte: 'Terminais', armazem: 'Armazéns', abrigo: 'Abrigos', pesquisa: 'Pesquisa', lavanderia: 'Lavanderias', pet: 'Pet shops',
  moveis: 'Lojas de móveis', optica: 'Óticas',
}
