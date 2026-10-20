import type { MaterialKey } from '../../lib/game/blockout/types'

export type Finish = 'p' | 'm' | 'r'

export type Sheet = {
  file: string
  base: MaterialKey | [MaterialKey, MaterialKey, MaterialKey, MaterialKey]
  names?: [string, string, string, string]
  finish?: string
  tags?: string[]
}

export const FAMILY_TAGS: [RegExp, string][] = [
  [/hospital|iv-stand|exam|dental|optical|patient|lab-|medic|ct-scanner/, 'medical'],
  [/oven|range-hood|kitchen|coffee|bar-tap|tea-counter|ice-cream|butcher|fridge|freezer/, 'kitchen'],
  [/filing|council|teacher|computer|reading|reception|cash-register|checkout|paper-cutter|mailbox|security-counter|desk/, 'office'],
  [/tractor|feed-hopper|water-tank|water-pump|animal-cage|trough/, 'rural'],
  [/ammo|gun|handgun|weapon|holding-cell/, 'military'],
  [/electrical|transformer|server|radio|signal-lever|studio-camera|generator/, 'electrical'],
  [/safe|vault/, 'vault'],
  [/shelf|tool-rack|sorting|sports-rack|locker|toolbox|clothes-rack|shoe-display|toy-display|produce|fishing-rack/, 'storage'],
  [/pinball|play-table|vending|salon|barber|fitting|ticket-gate|altar/, 'retail'],
  [/scrap|dumpster|barrel|cans|bicycle/, 'scrap'],
  [/cement|engine|forklift|vehicle-lift|tire|saw|vice|printing|paint-mixer|wash|bike-lift|electronics|sewing|cobbler|watch|laundry/, 'industrial'],
]

const numbered = (prefix: string, count: number, base: MaterialKey): Sheet[] =>
  Array.from({ length: count }, (_, i) => ({ file: `${prefix}-${String(i + 1).padStart(2, '0')}`, base }))

export const SHEETS: Sheet[] = [
  ...numbered('wood', 22, 'wood'),
  ...numbered('brick', 6, 'brick'),
  { file: 'concrete-01', base: 'concrete', names: ['Concreto liso com bolhas', 'Concreto com marca de tábua', 'Agregado exposto', 'Concreto vassourado'] },
  { file: 'concrete-02', base: 'concrete', names: ['Concreto polido', 'Concreto rachado', 'Concreto manchado de água', 'Concreto com musgo'] },
  { file: 'concrete-03', base: 'concrete', names: ['Concreto com fuligem', 'Concreto pintado de amarelo', 'Concreto pintado de cinza', 'Piso de garagem com óleo'] },
  { file: 'concrete-04', base: 'concrete', names: ['Bloco de concreto', 'Bloco split', 'Chapisco cinza', 'Chapisco branco'] },
  { file: 'concrete-05', base: 'concrete', names: ['Concreto com ferrugem', 'Pré-moldado envelhecido', 'Concreto desplacado', 'Concreto projetado'] },
  { file: 'concrete-06', base: 'concrete', names: ['Concreto úmido', 'Reboco de cimento', 'Concreto tingido', 'Concreto de obra empoeirado'] },
  { file: 'tile-01', base: 'tile', names: ['Porcelana branca', 'Esmalte craquelado marfim', 'Esmalte celadon', 'Esmalte azul-claro'] },
  { file: 'tile-02', base: 'tile', names: ['Terracota', 'Cerâmica vermelha', 'Cerâmica ardósia', 'Esmalte preto'] },
  { file: 'tile-03', base: 'tile', names: ['Porcelana hospitalar manchada', 'Porcelana bege', 'Porcelana menta', 'Porcelana amarelo-clara'] },
  { file: 'tile-04', base: 'tile', names: ['Mármore branco', 'Travertino', 'Mármore verde', 'Mármore preto'] },
  { file: 'tile-05', base: 'tile', names: ['Granilite branco', 'Granilite cinza', 'Esmalte escorrido', 'Esmalte marrom'] },
  { file: 'tile-06', base: 'tile', names: ['Esmalte com ferrugem', 'Cerâmica com calcário', 'Porcelana lascada', 'Porcelana amarelada'] },
  { file: 'tile-07', base: 'tile', names: ['Esmalte cobalto', 'Esmalte verde-garrafa', 'Esmalte mostarda', 'Esmalte sangue-de-boi'] },
  { file: 'tile-08', base: 'tile', names: ['Cerâmica rosa fosca', 'Cerâmica areia', 'Cerâmica cinza-pomba', 'Cerâmica branca fosca'] },
  { file: 'tile-09', base: 'tile', names: ['Epóxi de laboratório', 'Cerâmica cinza-clara', 'Resina preta de bancada', 'Cerâmica creme pontilhada'] },
  { file: 'fabric-01', base: 'fabric', names: ['Lona crua', 'Jeans desbotado', 'Tweed cinza', 'Lona militar'] },
  { file: 'fabric-02', base: 'fabric', names: ['Veludo marrom', 'Linho bege', 'Cobertor de lã vermelho', 'Juta'] },
  { file: 'fabric-03', base: 'fabric', names: ['Náilon azul-marinho', 'Matelassê creme', 'Flanela xadrez', 'Estofado floral'] },
  { file: 'leather-01', base: 'leather', names: ['Couro marrom gasto', 'Couro preto', 'Couro bordô', 'Camurça caramelo'] },
  { file: 'leather-02', base: 'leather', names: ['Vinil vermelho rachado', 'Vinil turquesa rachado', 'Couro de sela', 'Vinil preto rachado'] },
  { file: 'paint-01', base: 'paint', finish: 'pppp', names: ['Placa amarela', 'Placa vermelha', 'Placa azul', 'Placa verde'] },
  { file: 'paint-02', base: 'paint', finish: 'pppp', names: ['Plástico branco', 'Plástico cinza', 'Plástico preto texturizado', 'Plástico laranja'] },
  { file: 'paper-01', base: 'paper', names: ['Papelão ondulado', 'Papel kraft', 'Papel amarelado', 'Papel amassado'] },
  { file: 'paper-02', base: 'paper', names: ['Polpa moldada', 'Papel manilha', 'Papel-jornal', 'Papelão cinza'] },
  { file: 'rubber-01', base: 'rubber', names: ['Borracha preta', 'Lousa verde-escura', 'Borracha de pneu', 'Tapete de borracha'] },
  { file: 'charstraw-01', base: ['charcoal', 'charcoal', 'straw', 'straw'], names: ['Madeira carbonizada', 'Madeira com cinzas', 'Palha dourada', 'Palha envelhecida'] },
  { file: 'plaster-01', base: 'plaster', names: ['Reboco de cal', 'Reboco rachado', 'Reboco rosa', 'Reboco azul'] },
  ...steel([
    ['pppp', 'industrial', 'Verde de máquina gasto', 'Cinza de máquina riscado', 'Azul de maquinário desbotado', 'Laranja de segurança gasto'],
    ['pppp', 'industrial retail', 'Vermelho lascado', 'Amarelo lascado', 'Creme lascado', 'Preto lascado'],
    ['rrrr', 'scrap rural', 'Ferrugem superficial', 'Ferrugem em lâminas', 'Escorrido de ferrugem', 'Ferro corroído'],
    ['mmmm', 'rural storage scrap', 'Galvanizado novo', 'Zinco envelhecido', 'Galvanizado com ferrugem branca', 'Galvanizado riscado'],
    ['mmmm', 'kitchen medical', 'Inox escovado', 'Inox riscado', 'Inox acetinado', 'Inox jateado'],
    ['mmmm', 'electrical office', 'Alumínio escovado', 'Alumínio oxidado', 'Alumínio anodizado bronze', 'Alumínio anodizado preto'],
    ['mrpm', 'industrial kitchen', 'Ferro fundido bruto', 'Ferro fundido enferrujado', 'Ferro fundido pintado', 'Ferro fundido grafite'],
    ['mmmm', 'retail kitchen', 'Cromo picado', 'Niquelado fosco', 'Latão oxidado', 'Cobre oxidado'],
    ['pppp', 'kitchen medical', 'Esmalte branco lascado', 'Esmalte creme', 'Esmalte verde-menta', 'Esmalte vermelho'],
    ['pppp', 'industrial storage', 'Martelado cinza', 'Martelado verde', 'Pintura enrugada preta', 'Pintura texturizada azul'],
    ['pppp', 'storage retail', 'Eletrostática preta', 'Eletrostática branca', 'Amarelo de segurança', 'Vermelho sinal'],
    ['pppp', 'medical', 'Branco hospitalar', 'Azul hospitalar', 'Verde institucional', 'Bege hospitalar'],
    ['pppp', 'military', 'Verde-oliva militar', 'Cáqui', 'Cinza de campanha', 'Areia do deserto'],
    ['pppp', 'retail industrial', 'Azul automotivo oxidado', 'Vermelho automotivo oxidado', 'Branco com bolhas de ferrugem', 'Turquesa automotivo'],
    ['mmmm', 'retail', 'Cobre com azinhavre', 'Bronze envelhecido', 'Gunmetal', 'Latão gasto'],
    ['mmmm', 'military', 'Aço oxidado azul', 'Aço cementado', 'Aço fosfatizado', 'Óxido preto oleado'],
    ['mpmm', 'kitchen', 'Inox engordurado', 'Esmalte de forno', 'Alumínio amassado', 'Folha de flandres'],
    ['pppp', 'office', 'Bege de escritório', 'Cinza de mesa de aço', 'Verde de escritório', 'Cinza-claro arranhado'],
    ['pppp', 'rural', 'Verde de caixa-d’água', 'Vermelho de trator', 'Verde de trator', 'Amarelo de implemento'],
    ['pppm', 'storage', 'Cinza martelado de estante', 'Azul de porta-palete', 'Laranja de porta-palete', 'Zincado amarelo'],
    ['pppm', 'electrical', 'Cinza de quadro elétrico', 'Verde de transformador', 'Grafite de gabinete', 'Barramento de cobre'],
    ['pppp', 'storage', 'Azul de armário', 'Verde de armário', 'Cinza de armário', 'Vermelho de armário'],
    ['ppmp', 'vault', 'Verde de cofre', 'Preto de cofre', 'Aço polido de cofre-forte', 'Bordô'],
    ['pppp', 'retail', 'Vermelho brilhante riscado', 'Azul royal brilhante', 'Preto brilhante riscado', 'Branco brilhante lascado'],
    ['mmrm', 'scrap industrial', 'Aço com fuligem', 'Aço manchado de óleo', 'Aço com respingos de lama', 'Aço empoeirado'],
    ['rrrr', 'scrap', 'Ferrugem laranja', 'Ferrugem marrom', 'Carepa de ferrugem', 'Ferrugem preta'],
    ['mmmm', 'industrial', 'Carepa de laminação', 'Aço laminado a quente', 'Aço laminado a frio', 'Aço decapado'],
    ['mppm', 'scrap kitchen', 'Aço com têmpera colorida', 'Aço queimado', 'Tinta empolada pelo fogo', 'Inox descolorido pelo calor'],
    ['pppp', 'scrap rural', 'Branco descascando', 'Verde descascando', 'Azul descascando', 'Amarelo descascando'],
    ['mrmp', 'industrial storage', 'Chapa xadrez de alumínio', 'Chapa xadrez enferrujada', 'Alumínio estucado', 'Aço gofrado'],
    ['pppp', 'industrial', 'Verde-petróleo industrial', 'Primer marrom', 'Zarcão', 'Primer de zinco'],
    ['pppp', 'retail kitchen', 'Rosa de eletrodoméstico', 'Turquesa de eletrodoméstico', 'Amarelo-manteiga', 'Verde-água'],
    ['pppp', 'industrial retail', 'Vermelho de bombeiro', 'Laranja de emergência', 'Amarelo de risco', 'Verde de resgate'],
    ['mmmm', 'medical', 'Inox cirúrgico', 'Aço de autoclave', 'Alumínio polido', 'Titânio fosco'],
    ['pppp', 'storage industrial', 'Caixa de ferramentas vermelha', 'Caixa de ferramentas preta', 'Caixa de ferramentas azul', 'Caixa de ferramentas verde'],
    ['pppp', 'industrial office', 'Verde de impressora', 'Esmalte preto de máquina', 'Azul-marinho de máquina', 'Bordô de máquina'],
    ['mmmm', 'industrial', 'Alumínio fundido', 'Zamac', 'Estanho', 'Chumbo fosco'],
    ['mmmm', 'retail', 'Niquelado gasto', 'Latonado gasto', 'Bronze gasto', 'Cobreado gasto'],
    ['pppp', 'retail', 'Azul-celeste desbotado', 'Verde-limão desbotado', 'Lilás desbotado', 'Salmão desbotado'],
    ['rrmm', 'rural scrap', 'Galvanizado enferrujado', 'Galvanizado manchado', 'Zinco com marcas d’água', 'Estanho fosco'],
    ['pppp', 'retail', 'Bronze eletrostático', 'Champanhe metálico', 'Prata metálico descascado', 'Dourado gasto'],
    ['mmmm', 'vault', 'Ferro preto com pátina', 'Ferro forjado', 'Aço forjado escurecido', 'Ferro martelado'],
    ['mmmm', 'industrial', 'Aço com marcas de giz', 'Aço esmerilhado', 'Aço com respingos de solda', 'Aço lixado'],
    ['pppp', 'kitchen retail', 'Branco amarelado de eletrodoméstico', 'Amêndoa', 'Dourado-colheita', 'Verde-abacate'],
    ['pppp', 'industrial', 'Vermelho industrial', 'Bordô industrial', 'Marrom-chocolate', 'Grafite industrial'],
    ['rrrr', 'scrap rural', 'Aço corten', 'Corten enferrujado', 'Aço patinável', 'Corten escuro'],
    ['mppp', 'electrical office', 'Alumínio fosco', 'Preto texturizado', 'Cinza texturizado', 'Bege texturizado'],
  ]),

  ...['wood-23', 'wood-24', 'wood-25'].map((file): Sheet => ({ file, base: 'wood', tags: ['architecture'] })),
  ...['brick-07', 'brick-08'].map((file): Sheet => ({ file, base: 'brick', tags: ['architecture'] })),
  { file: 'concrete-07', base: 'concrete', tags: ['architecture'], names: ['Bloco de concreto aerado', 'Bloco pintado descascando', 'Concreto com fôrma de tábua', 'Concreto escorrido com musgo'] },
  { file: 'concrete-08', base: 'concrete', tags: ['architecture'], names: ['Chapisco espatulado', 'Concreto com fuligem de incêndio', 'Concreto bege rachado', 'Agregado com ferrugem'] },
  { file: 'concrete-09', base: 'concrete', tags: ['architecture'], names: ['Concreto aparente com bolhas', 'Concreto escuro escorrido', 'Reboco grosso de areia', 'Concreto verde descascando'] },
  { file: 'plaster-02', base: 'plaster', tags: ['architecture'], names: ['Reboco branco craquelado', 'Reboco ocre', 'Reboco manchado de umidade', 'Reboco rosa espatulado'] },
  { file: 'steel-48', base: 'steel', finish: 'mrpr', tags: ['architecture', 'scrap'], names: ['Galvanizado cristalizado', 'Galvanizado com escorridos de ferrugem', 'Vermelho descascando com ferrugem', 'Ferrugem pesada'] },

  { file: 'fabric-04', base: 'fabric', tags: ['interior'], names: ['Tapete persa desbotado', 'Tecido listrado de colchão', 'Náilon acolchoado oliva', 'Cortina hospitalar menta'] },
  { file: 'fabric-05', base: 'fabric', tags: ['interior'], names: ['Tapete trançado de retalhos', 'Matelassê adamascado manchado', 'Náilon ripstop laranja', 'Cortina hospitalar azul'] },
  { file: 'steel-49', base: 'steel', finish: 'mmpm', tags: ['interior'], names: ['Cromado riscado', 'Latão com pátina', 'Aço pintado de preto lascado', 'Alumínio com respingos de tinta'] },
  { file: 'paper-03', base: 'paper', tags: ['interior'], names: ['Pintura a óleo em tela', 'Cartaz desbotado', 'Aquarela amarelada', 'Papelão kraft com fita'] },
  { file: 'rubber-02', base: 'rubber', tags: ['interior'], names: ['Saco de lixo preto', 'Saco de lixo verde', 'Lona plástica azul', 'Borracha industrial cinza'] },
]

function steel(rows: [string, string, string, string, string, string][]): Sheet[] {
  return rows.map(([finish, tags, a, b, c, d], i) => ({ file: `steel-${String(i + 1).padStart(2, '0')}`, base: 'steel', finish, tags: tags.split(' '), names: [a, b, c, d] }))
}
