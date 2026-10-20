import type { ModelBuilder } from './model'
import type { AssetSpec, Category, LootKind, MaterialKey, Vec3 } from './types'

type Spec = [string, string, Category, Vec3, LootKind?]
const specs: Spec[] = [
  ['ct-scanner', 'Tomógrafo com túnel e mesa', 'Serviços', [2.5, 2.2, 2.6], 'medical'],
  ['iv-stand', 'Suporte de soro e bolsas', 'Serviços', [0.65, 1.95, 0.6], 'medical'],
  ['patient-monitor', 'Monitor de sinais em carrinho', 'Serviços', [0.65, 1.4, 0.55], 'electronics'],
  ['exam-table', 'Mesa clínica de exame', 'Serviços', [0.85, 1.15, 1.9], 'medical'],
  ['dental-chair', 'Cadeira odontológica e braço', 'Serviços', [1.1, 1.8, 1.8], 'medical'],
  ['medicine-fridge', 'Refrigerador clínico', 'Serviços', [0.85, 1.8, 0.65], 'medical'],
  ['wheelchair', 'Cadeira de rodas', 'Serviços', [0.85, 1.05, 1], 'medical'],
  ['tractor', 'Trator agrícola desativado', 'Rural', [2, 2.5, 3.2], 'tools'],
  ['hay-bale', 'Fardo cilíndrico de feno', 'Rural', [1.3, 1.3, 1.25], 'agriculture'],
  ['horse-stall', 'Baia com portinhola e divisórias', 'Rural', [2.3, 1.7, 2.5], 'agriculture'],
  ['feed-hopper', 'Tremonha de ração e grãos', 'Rural', [1.7, 2.1, 1.5], 'agriculture'],
  ['seedling-bench', 'Bancada de mudas com bandejas', 'Rural', [1.8, 1, 0.9], 'agriculture'],
  ['potting-bench', 'Bancada de vasos', 'Rural', [1.6, 1.2, 0.7], 'agriculture'],
  ['saw-table', 'Serra e mesa de roletes', 'Rural', [1.8, 1.35, 1.5], 'tools'],
  ['log-stack', 'Toras apoiadas em berço', 'Rural', [1.8, 0.8, 2.4], 'salvage'],
  ['well', 'Poço rural coberto', 'Rural', [1.6, 2.5, 1.4], 'agriculture'],
  ['hearth', 'Lareira e fogão a lenha', 'Mobiliário', [1.2, 1.8, 0.65], 'salvage'],
  ['vice-bench', 'Bancada com morsa', 'Comércio', [1.6, 1.2, 0.7], 'tools'],
  ['cement-mixer', 'Betoneira em cavalete', 'Comércio', [1.4, 1.6, 1.2], 'tools'],
  ['cash-register', 'Caixa registradora em balcão', 'Comércio', [1.3, 1.25, 0.7], 'electronics'],
  ['weapon-display', 'Expositor de equipamento inerte', 'Comércio', [1.6, 1.8, 0.55], 'weapons'],
  ['produce-display', 'Banca escalonada de hortifrúti', 'Comércio', [1.7, 1.3, 0.9], 'food'],
  ['bread-oven', 'Forno de padaria com chaminé', 'Comércio', [1.6, 2.4, 1.2], 'food'],
  ['butcher-rail', 'Trilho de ganchos e bloco de corte', 'Comércio', [1.8, 2.2, 0.8], 'food'],
  ['fitting-booth', 'Cabine de prova com banco', 'Comércio', [1.2, 2.1, 1.2], 'textiles'],
  ['shoe-display', 'Expositor escalonado de calçados', 'Comércio', [1.5, 1.5, 0.65], 'textiles'],
  ['reading-table', 'Mesa de leitura com divisórias', 'Serviços', [1.8, 1.2, 1], 'documents'],
  ['paper-cutter', 'Guilhotina de papel em bancada', 'Comércio', [1.4, 1.25, 0.8], 'documents'],
  ['electronics-bench', 'Bancada de instrumentos e monitores', 'Comércio', [1.6, 1.4, 0.75], 'electronics'],
  ['display-platform', 'Plataforma de exposição', 'Comércio', [1.9, 0.22, 1.5], 'salvage'],
  ['security-counter', 'Balcão com grade de segurança', 'Comércio', [1.8, 2.1, 0.7], 'documents'],
  ['watch-bench', 'Bancada de relojoeiro com lupa', 'Comércio', [1.35, 1.4, 0.7], 'tools'],
  ['optical-chair', 'Cadeira e aparelho de exame óptico', 'Serviços', [0.95, 1.8, 1.1], 'medical'],
  ['animal-cages', 'Módulos de alojamento animal', 'Serviços', [1.6, 1.5, 0.85], 'food'],
  ['fishing-rack', 'Porta-varas de pesca', 'Comércio', [1.5, 2.25, 0.55], 'tools'],
  ['camp-tent', 'Barraca de duas águas', 'Infraestrutura', [2, 1.8, 2.3], 'textiles'],
  ['sports-rack', 'Carrinho de equipamento esportivo', 'Comércio', [1.4, 1.3, 0.75], 'textiles'],
  ['toy-display', 'Banca de brinquedos e objetos', 'Comércio', [1.4, 1.15, 0.8], 'salvage'],
  ['piano', 'Piano vertical', 'Comércio', [1.5, 1.35, 0.8], 'salvage'],
  ['studio-camera', 'Câmera de estúdio em suporte', 'Comércio', [0.8, 1.7, 0.8], 'electronics'],
  ['paint-mixer', 'Misturador de tintas', 'Comércio', [0.9, 1.4, 0.8], 'tools'],
  ['engine-stand', 'Motor em cavalete', 'Comércio', [1.4, 1.3, 1], 'tools'],
  ['bike-lift', 'Plataforma de manutenção de motos', 'Comércio', [1.1, 1.3, 2], 'tools'],
  ['bicycle-stand', 'Bicicleta em suporte de reparo', 'Comércio', [1.6, 1.4, 0.65], 'tools'],
  ['tire-changer', 'Desmontadora com pneu', 'Comércio', [1.1, 1.7, 0.9], 'tools'],
  ['vehicle-lift', 'Elevador automotivo de duas colunas', 'Comércio', [2.8, 2.7, 1.9], 'tools'],
  ['wash-gantry', 'Pórtico de lavagem', 'Comércio', [2.8, 2.8, 1.2], 'tools'],
  ['diner-booth', 'Conjunto de bancos e mesa de diner', 'Comércio', [1.8, 1.1, 1.6], 'food'],
  ['range-hood', 'Fogão com coifa e exaustão', 'Comércio', [1.7, 2.4, 0.85], 'food'],
  ['coffee-machine', 'Máquina de café em bancada', 'Comércio', [1.4, 1.5, 0.7], 'food'],
  ['bar-tap', 'Balcão de bar com torneiras', 'Comércio', [1.8, 1.5, 0.7], 'food'],
  ['pizza-oven', 'Forno de pizza em alvenaria', 'Comércio', [1.7, 2.2, 1.4], 'food'],
  ['ice-cream-case', 'Vitrine de sorvetes', 'Comércio', [1.7, 1.35, 0.8], 'food'],
  ['tea-counter', 'Bancada de chá e recipientes', 'Comércio', [1.5, 1.3, 0.7], 'food'],
  ['laundry-drum', 'Lavadora de tambor industrial', 'Comércio', [1.1, 1.3, 0.9], 'salvage'],
  ['barber-chair', 'Cadeira hidráulica de barbeiro', 'Comércio', [0.85, 1.2, 1.1], 'medical'],
  ['salon-station', 'Posto de salão com espelho', 'Comércio', [1.2, 1.9, 1.5], 'medical'],
  ['sewing-machine', 'Máquina de costura com mesa', 'Comércio', [1.4, 1.3, 0.75], 'textiles'],
  ['cobbler-bench', 'Bancada de sapateiro', 'Comércio', [1.3, 1.3, 0.7], 'tools'],
  ['printing-press', 'Prensa gráfica com roletes', 'Comércio', [1.8, 1.8, 1.4], 'documents'],
  ['computer-station', 'Posto de computador', 'Serviços', [1.35, 1.35, 0.7], 'electronics'],
  ['pinball', 'Mesa de pinball', 'Comércio', [0.8, 1.6, 1.6], 'electronics'],
  ['casket', 'Urna funerária sobre suportes', 'Serviços', [0.8, 0.95, 2], 'salvage'],
  ['motel-bed', 'Cama com cabeceira de motel', 'Mobiliário', [1.6, 1.15, 2], 'textiles'],
  ['reception-bell', 'Recepção com sino de balcão', 'Serviços', [1.7, 1.3, 0.7], 'documents'],
  ['forklift', 'Empilhadeira de depósito', 'Comércio', [1.5, 2.3, 2.3], 'tools'],
  ['teacher-desk', 'Mesa do professor com quadro', 'Serviços', [1.8, 2.1, 1.15], 'documents'],
  ['play-table', 'Mesa infantil de atividades', 'Serviços', [1.3, 0.8, 1], 'salvage'],
  ['holding-cell', 'Módulo de cela gradeada', 'Serviços', [2.2, 2.4, 2.2], 'salvage'],
  ['fire-gear', 'Suporte de mangueiras e equipamento', 'Serviços', [1.6, 2.1, 0.65], 'tools'],
  ['sorting-rack', 'Escaninhos de triagem postal', 'Serviços', [1.8, 1.9, 0.6], 'documents'],
  ['vault-door', 'Porta circular de cofre em pórtico', 'Serviços', [1.9, 2.35, 0.65], 'documents'],
  ['altar', 'Altar e ambão', 'Serviços', [1.9, 1.5, 1], 'documents'],
  ['stage', 'Palco com degrau', 'Serviços', [2.3, 0.5, 1.9], 'salvage'],
  ['council-desk', 'Bancada de plenário', 'Serviços', [2, 1.3, 0.8], 'documents'],
  ['ticket-gate', 'Bilheteria e torniquete inerte', 'Serviços', [1.6, 1.5, 0.85], 'documents'],
  ['signal-lever', 'Alavancas de sinalização ferroviária', 'Infraestrutura', [1.7, 1.3, 0.65], 'electronics'],
  ['field-kitchen', 'Cozinha de campanha', 'Infraestrutura', [1.8, 1.6, 0.9], 'food'],
  ['transformer', 'Transformador e isoladores', 'Infraestrutura', [1.8, 2.4, 1.3], 'electronics'],
  ['water-pump', 'Conjunto de bombeamento e válvula', 'Infraestrutura', [1.7, 1.5, 1], 'tools'],
  ['radio-console', 'Console de rádio com antena', 'Infraestrutura', [1.4, 1.8, 0.7], 'electronics'],
  ['lab-equipment', 'Bancada de análise laboratorial', 'Serviços', [1.8, 1.6, 0.8], 'medical'],
  ['mailboxes', 'Conjunto de caixas postais', 'Infraestrutura', [1.6, 1.6, 0.5], 'documents'],
]

export const SPECIALTY_ASSETS: AssetSpec[] = specs.flatMap(([family, label, category, size, loot]) => [0, 1, 2].map((variant) => ({
  id: `${family}-${variant}`, family, label: `${label} · ${['compacta', 'padrão', 'ampla'][variant]}`, category, recipe: 'specialty',
  size: [size[0] * [0.92, 1, 1.08][variant], size[1], size[2]] as Vec3, material: (['hay-bale', 'horse-stall', 'seedling-bench', 'potting-bench', 'log-stack', 'well'].includes(family) ? 'wood' : 'steel') as MaterialKey, variant, loot,
})))
export const SPECIALTY_OVERRIDES = new Set(['hospital-bed', 'washing-machine', 'fuel-pump', 'generator', 'water-tank', 'barrel', 'oven', 'fridge'])

export function buildSpecialty(b: ModelBuilder, spec: AssetSpec) {
  const { family, size: [w, h, d], material: m, loot } = spec
  const box = (width: number, height: number, depth: number, x = 0, bottom = 0, z = 0, mat: MaterialKey = m, name = family) => b.box([width, height, depth], [x, bottom + height / 2, z], mat, 'fixture', 0, 0, name)
  const cylinder = (width: number, height: number, depth: number, x = 0, bottom = 0, z = 0, mat: MaterialKey = m) => b.solid('cylinder', [width, height, depth], [x, bottom + height / 2, z], mat, 'fixture', family)
  const disc = (radius: number, thickness: number, x: number, y: number, z: number, axis: 'x' | 'z', mat: MaterialKey = 'charcoal') => {
    const part = b.solid('cylinder', [radius * 2, thickness, radius * 2], [x, y, z], mat, 'fixture', family)
    if (axis === 'x') part.roll = Math.PI / 2
    else part.pitch = Math.PI / 2
    return part
  }
  const stock = (part: ReturnType<typeof box>, label = spec.label) => { if (loot) b.socket(part, loot, true, label) }
  const table = (top = 0.82, width = w, depth = d) => {
    for (const x of [-1, 1]) for (const z of [-1, 1]) box(0.07, top - 0.08, 0.07, x * (width - 0.07) / 2, 0, z * (depth - 0.07) / 2)
    const surface = box(width, 0.08, depth, 0, top - 0.08)
    stock(surface)
    return top
  }
  const pedestal = (top: number, width = w * 0.65, depth = d * 0.65) => {
    box(width, 0.08, depth)
    box(width * 0.3, top - 0.08, depth * 0.3, 0, 0.08)
  }
  const monitor = (x: number, bottom: number, z: number, width = 0.48) => {
    box(width * 0.5, 0.04, 0.2, x, bottom, z)
    box(0.07, 0.17, 0.07, x, bottom + 0.04, z)
    box(width, 0.34, 0.1, x, bottom + 0.21, z, 'charcoal')
  }

  if (family === 'hospital-bed' || family === 'exam-table' || family === 'motel-bed') {
    const wheel = family === 'hospital-bed', base = wheel ? 0.25 : 0.2, top = family === 'exam-table' ? 0.7 : 0.45
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      if (wheel) disc(0.125, 0.065, x * (w / 2 - 0.08), 0.125, z * (d / 2 - 0.15), 'x')
      else box(0.08, base, 0.08, x * (w / 2 - 0.08), 0, z * (d / 2 - 0.15))
    }
    box(w, 0.1, d, 0, base)
    box(w * 0.65, top - base - 0.1, d * 0.65, 0, base + 0.1)
    const mattress = box(w - 0.12, 0.14, d - 0.16, 0, top, 0, 'fabric'); stock(mattress)
    box(w, h - base - 0.1, 0.07, 0, base + 0.1, -d / 2 + 0.035)
    box(w * 0.6, 0.07, 0.3, 0, top + 0.14, -d / 2 + 0.32, 'fabric')
    if (wheel) for (const x of [-1, 1]) {
      for (const z of [-0.45, 0.45]) box(0.035, 0.42, 0.035, x * (w / 2 - 0.035), base + 0.1, z)
      box(0.035, 0.045, 0.94, x * (w / 2 - 0.035), base + 0.52)
    }
  } else if (family === 'ct-scanner') {
    box(w, 0.12, 1, 0, 0, -d / 2 + 0.5)
    const shell = b.ring(w, h - 0.12, 1, 0, 0.33, 'tile')
    for (const part of shell) {
      const [x, y, z] = part.position
      part.position = [x, -z + 0.12 + (h - 0.12) / 2, y - d / 2]
      part.pitch = Math.PI
    }
    box(0.45, 0.65, d - 1, 0, 0, 0.5)
    stock(box(0.74, 0.13, d - 0.16, 0, 0.65, 0.08, 'fabric'))
    box(0.18, 0.16, 0.04, w / 2 - 0.16, h * 0.55, -d / 2 + 1.02, 'glass')
  } else if (family === 'iv-stand') {
    box(w, 0.06, 0.1); box(0.1, 0.06, (d - 0.1) / 2, 0, 0, (d + 0.1) / 4); box(0.1, 0.06, (d - 0.1) / 2, 0, 0, -(d + 0.1) / 4)
    cylinder(0.05, h - 0.11, 0.05, 0, 0.06)
    box(w * 0.8, 0.05, 0.05, 0, h - 0.05)
    for (const x of [-1, 1]) stock(box(0.14, 0.28, 0.08, x * w * 0.26, h - 0.33, 0, 'tile'))
  } else if (family === 'patient-monitor') {
    table(0.82); monitor(0, 0.82, 0, w * 0.8)
  } else if (['dental-chair', 'optical-chair', 'barber-chair', 'wheelchair'].includes(family)) {
    if (family === 'wheelchair') {
      for (const x of [-1, 1]) disc(0.31, 0.06, x * (w - 0.06) / 2, 0.31, -0.1, 'x')
      box(w - 0.12, 0.1, 0.6, 0, 0.35, -0.1)
    } else { pedestal(0.43); box(w * 0.75, 0.1, d * 0.6, 0, 0.43) }
    const seatY = family === 'wheelchair' ? 0.45 : 0.53
    stock(box(w * 0.75, 0.1, d * 0.5, 0, seatY, 0, 'fabric'))
    box(w * 0.75, Math.min(0.55, h - seatY - 0.1), 0.1, 0, seatY + 0.1, -d * 0.2, 'fabric')
    if (family === 'dental-chair' || family === 'optical-chair') {
      const side = w / 2 - 0.05
      box(0.1, h - 0.1, 0.1, side, 0, -d * 0.35)
      box(w * 0.7, 0.07, 0.1, side - w * 0.35 + 0.05, h - 0.1, -d * 0.35)
      box(0.25, 0.12, 0.22, side - w * 0.65 + 0.05, h - 0.22, -d * 0.35, 'tile')
    }
  } else if (family === 'tractor' || family === 'forklift') {
    const rw = family === 'tractor' ? 0.53 : 0.3, fw = 0.3, bodyW = w - 0.52
    for (const x of [-1, 1]) {
      disc(rw, 0.26, x * (bodyW + 0.26) / 2, rw, d * 0.24, 'x')
      disc(fw, 0.26, x * (bodyW + 0.26) / 2, fw, -d * 0.31, 'x')
    }
    box(bodyW, 0.3, d * 0.88, 0, 0.35)
    box(bodyW * (family === 'forklift' ? 0.6 : 0.8), 0.5, d * 0.4, 0, 0.65, -d * 0.23, 'paint', 'rounded-engine-hood').bevel = 0.045
    box(bodyW * 0.65, 0.35, d * 0.22, 0, 0.65, d * 0.22)
    stock(box(bodyW * 0.7, 0.1, d * 0.25, 0, 1, d * 0.22, 'fabric'))
    box(bodyW * 0.7, 0.45, 0.08, 0, 1.1, d * 0.32, 'fabric')
    cylinder(0.08, 0.65, 0.08, -bodyW * 0.3, 1.15, -d * 0.25)
    if (family === 'tractor') {
      for (const x of [-1, 1]) {
        box(0.07, h - 0.715, 0.07, x * (bodyW - 0.07) / 2, 0.65, d * 0.39, 'steel', 'rollover-post')
        box(0.05, 2 * rw + 0.048 - 0.65, 0.15, x * (bodyW / 2 - 0.025), 0.65, d * 0.24 - 0.2, 'steel', 'fender-bracket')
        box(0.34, 0.03, 1.15, x * (bodyW / 2 + 0.17), 2 * rw + 0.018, d * 0.24, 'paint', 'wheel-fender').bevel = 0.008
        box(0.12, 0.02, 0.2, x * 0.28, 0.65, 0.1, 'rubber', 'pedal')
      }
      box(bodyW + 0.18, 0.065, d * 0.48, 0, h - 0.065, d * 0.18, 'paint', 'formed-canopy').bevel = 0.014
      cylinder(0.045, 0.478, 0.045, 0, 0.65, 0.1, 'steel')
      cylinder(0.08, 0.016, 0.08, 0, 1.128, 0.1, 'steel')
      box(0.38, 0.016, 0.018, 0, 1.144, 0.1, 'steel', 'steering-spoke')
      for (const z of [-1, 1]) box(0.018, 0.016, 0.181, 0, 1.144, 0.1 + z * 0.0995, 'steel', 'steering-spoke')
      b.ring(0.38, 0.38, 0.02, 1.16, 0.027, 'rubber', 0, 0.1, 24)
    } else for (const x of [-1, 1]) {
      box(0.1, h - 0.65, 0.14, x * bodyW * 0.42, 0.65, -d * 0.4)
      box(0.1, 0.08, 0.9, x * bodyW * 0.42, 0, -d * 0.4 + 0.38)
      box(0.1, 0.27, 0.14, x * bodyW * 0.42, 0.08, -d * 0.4)
    }
  } else if (family === 'hay-bale') {
    const part = b.solid('cylinder', [w, d, h], [0, h / 2, 0], 'wood', 'fixture', family)
    part.pitch = Math.PI / 2
  } else if (['horse-stall', 'holding-cell', 'animal-cages', 'fitting-booth'].includes(family)) {
    const t = 0.07, barred = family === 'holding-cell' || family === 'animal-cages'
    const floor = box(w, t, d); stock(floor)
    for (const x of [-1, 1]) box(t, h - t, d, x * (w - t) / 2, t)
    box(w - 2 * t, h - t, t, 0, t, -(d - t) / 2)
    if (barred) {
      box(w - 2 * t, 0.08, t, 0, h - 0.08, (d - t) / 2)
      for (let i = 0; i < 6; i++) box(0.035, h - t - 0.08, t, -(w - 2 * t) / 2 + (i + 0.5) * (w - 2 * t) / 6, t, (d - t) / 2)
    } else {
      const gate = (w - 2 * t) * 0.38
      box(gate, h * 0.48, t, -w / 2 + t + gate / 2, t, (d - t) / 2)
      box(w * 0.45, 0.12, d * 0.35, 0, t, -d * 0.1)
    }
  } else if (family === 'feed-hopper') {
    for (const x of [-1, 1]) for (const z of [-1, 1]) box(0.08, h * 0.5, 0.08, x * (w - 0.08) / 2, 0, z * (d - 0.08) / 2)
    box(w, 0.1, d, 0, h * 0.5)
    const body = cylinder(w * 0.9, h * 0.5 - 0.1, d * 0.9, 0, h * 0.5 + 0.1); stock(body)
    box(0.3, h * 0.25, 0.3, 0, h * 0.25)
  } else if (family === 'seedling-bench' || family === 'potting-bench') {
    const y = table(0.8)
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + (i + 0.5) * w / 4
      const pot = cylinder(w / 5, family === 'seedling-bench' ? 0.12 : 0.28, d * 0.62, x, y, 0, 'wood'); stock(pot)
    }
  } else if (family === 'log-stack') {
    for (const z of [-1, 1]) box(w, 0.15, 0.18, 0, 0, z * (d - 0.18) / 2)
    for (const x of [-0.6, 0, 0.6]) {
      const log = b.solid('cylinder', [0.5, d, 0.5], [x * w / 1.8, 0.4, 0], 'wood', 'fixture', family)
      log.pitch = Math.PI / 2
    }
  } else if (family === 'well') {
    const curb = box(w, 0.08, d, 0, 0, 0, 'brick'); stock(curb)
    for (const x of [-1, 1]) box(0.16, 0.57, d, x * (w - 0.16) / 2, 0.08, 0, 'brick')
    for (const z of [-1, 1]) box(w - 0.32, 0.57, 0.16, 0, 0.08, z * (d - 0.16) / 2, 'brick')
    for (const x of [-1, 1]) box(0.1, h - 0.8, 0.1, x * (w - 0.1) / 2, 0.65, 0, 'wood')
    box(w, 0.15, d, 0, h - 0.15, 0, 'wood')
    const spindle = b.solid('cylinder', [0.07, w - 0.2, 0.07], [0, 1.15, 0], 'wood', 'fixture', 'well-winch')
    spindle.roll = Math.PI / 2
  } else if (family === 'hearth' || family === 'bread-oven' || family === 'pizza-oven') {
    const base = h * 0.32
    stock(box(w, base, d, 0, 0, 0, 'brick'))
    for (const x of [-1, 1]) box(w * 0.22, h * 0.3, d, x * w * 0.39, base, 0, 'brick')
    box(w * 0.56, h * 0.3, 0.1, 0, base, -(d - 0.1) / 2, 'charcoal')
    box(w, h * 0.12, d, 0, base + h * 0.3, 0, 'brick')
    box(w * 0.28, h * 0.26, d * 0.38, 0, h * 0.74, -d * 0.2, 'brick')
  } else if (family === 'camp-tent') {
    b.prism([[-w / 2, 0], [0, h - 0.08], [0, h], [-w / 2, 0.08]], d, 0, 'fabric', 'fixture', 'tent-left')
    b.prism([[0, h - 0.08], [w / 2, 0], [w / 2, 0.08], [0, h]], d, 0, 'fabric', 'fixture', 'tent-right')
  } else if (family === 'vehicle-lift' || family === 'wash-gantry') {
    for (const x of [-1, 1]) {
      const column = box(0.3, h, d, x * (w - 0.3) / 2); stock(column)
      if (family === 'vehicle-lift') box(w * 0.25, 0.13, d * 0.4, x * (w * 0.375 - 0.3), 0.45)
    }
    box(w - 0.6, 0.2, d * 0.5, 0, h - 0.2)
    if (family === 'wash-gantry') for (const x of [-1, 1]) cylinder(0.35, h * 0.65, 0.35, x * (w / 2 - 0.475), h * 0.15, 0, 'charcoal')
  } else if (['washing-machine', 'laundry-drum', 'paint-mixer', 'medicine-fridge', 'fridge', 'fuel-pump', 'generator'].includes(family)) {
    const body = box(w, h * 0.7, d * 0.8); stock(body)
    if (family === 'washing-machine' || family === 'laundry-drum') {
      disc(Math.min(w * 0.35, h * 0.28), d * 0.2, 0, h * 0.37, d * 0.5, 'z', 'charcoal')
      box(w, h * 0.3, d * 0.8, 0, h * 0.7, 0, 'tile')
    } else if (family === 'fuel-pump') {
      box(w * 0.85, h * 0.3, d * 0.8, 0, h * 0.7, 0, 'tile')
      box(w * 0.65, h * 0.12, 0.04, 0, h * 0.79, d * 0.4 + 0.02, 'charcoal')
      box(0.06, h * 0.6, 0.06, w / 2 + 0.03, h * 0.1, 0, 'charcoal')
    } else if (family === 'fridge' || family === 'medicine-fridge') {
      box(w, h * 0.3, d * 0.8, 0, h * 0.7, 0, 'tile')
      box(w * 0.8, h * 0.85, 0.05, 0, h * 0.075, d * 0.4 + 0.025, 'tile')
      box(0.04, h * 0.3, 0.05, w * 0.29, h * 0.45, d * 0.4 + 0.075)
    } else if (family === 'paint-mixer') {
      cylinder(w * 0.65, h * 0.2, d * 0.55, 0, h * 0.7, 0, 'paint')
      box(w, h * 0.1, d * 0.8, 0, h * 0.9)
      box(0.08, h * 0.2, 0.08, -w / 2 + 0.04, h * 0.7, -d * 0.3)
    } else {
      cylinder(w * 0.55, h * 0.3, d * 0.55, 0, h * 0.7)
    }
  } else if (family === 'barrel' || family === 'water-tank') {
    const body = cylinder(w, h - 0.07, d); stock(body)
    cylinder(w * 0.32, 0.07, d * 0.32, 0, h - 0.07)
  } else if (family === 'transformer') {
    box(w, 0.2, d)
    box(w * 0.7, h * 0.55, d * 0.7, 0, 0.2)
    for (const x of [-1, 1]) for (let i = 0; i < 5; i++) box(w * 0.12, h * 0.4, d * 0.07, x * w * 0.41, 0.3, -d * 0.3 + i * d * 0.15)
    for (const x of [-0.25, 0, 0.25]) {
      let y = 0.2 + h * 0.55
      for (let i = 0; i < 4; i++) { cylinder(0.15, 0.08, 0.15, x * w, y, 0, 'tile'); y += 0.08; cylinder(0.09, 0.055, 0.09, x * w, y, 0); y += 0.055 }
    }
  } else if (family === 'vault-door') {
    const radius = Math.min(w * 0.39, h * 0.38)
    box(w, 0.2, d)
    for (const x of [-1, 1]) box(0.16, h - 0.2, d, x * (w - 0.16) / 2, 0.2)
    box(w - 0.32, 0.16, d, 0, h - 0.16)
    disc(radius, d * 0.7, 0, 0.2 + radius, 0, 'z', 'steel')
    box(0.07, 0.5, 0.08, 0, radius - 0.05, d * 0.35 + 0.04, 'paint')
  } else if (family === 'stage' || family === 'display-platform') {
    stock(box(w, h, d * 0.75, 0, 0, -d * 0.125, 'wood'))
    box(w * 0.5, h * 0.5, d * 0.25, 0, 0, d * 0.375, 'wood')
  } else if (['weapon-display', 'fishing-rack', 'fire-gear', 'sports-rack'].includes(family)) {
    box(w, 0.12, d)
    for (const x of [-1, 1]) box(0.07, h - 0.12, 0.07, x * (w - 0.07) / 2, 0.12, -(d - 0.07) / 2)
    box(w - 0.14, 0.09, 0.07, 0, h - 0.09, -(d - 0.07) / 2)
    const count = family === 'sports-rack' ? 3 : 4
    for (let i = 0; i < count; i++) {
      const x = -w * 0.35 + i * w * 0.7 / (count - 1)
      if (family === 'fire-gear') {
        box(w * 0.17, h * 0.6, d * 0.3, x, 0.12, 0, 'fabric')
      } else if (family === 'sports-rack') cylinder(w * 0.22, 0.24, d * 0.65, x, 0.12, 0, 'fabric')
      else { box(0.055, h * 0.83, 0.06, x, 0.12, 0); if (family === 'weapon-display') box(0.11, 0.4, 0.06, x + 0.0825, 0.12, 0, 'wood') }
    }
  } else if (family === 'sorting-rack' || family === 'mailboxes') {
    const t = 0.05, nx = family === 'mailboxes' ? 4 : 5, ny = 5
    for (let i = 0; i <= nx; i++) box(t, h, d, -w / 2 + t / 2 + i * (w - t) / nx)
    for (let i = 0; i < nx; i++) for (let j = 0; j <= ny; j++) {
      const p = box((w - t) / nx - t, t, d, -w / 2 + t + ((w - t) / nx - t) / 2 + i * (w - t) / nx, j * (h - t) / ny)
      if (j === 2) stock(p)
    }
  } else if (family === 'piano') {
    box(w, 0.15, d)
    box(w, h - 0.15, d * 0.42, 0, 0.15, -d * 0.29, 'wood')
    for (const x of [-1, 1]) box(0.1, h * 0.5 - 0.15, d * 0.45, x * (w - 0.1) / 2, 0.15, d * 0.275, 'wood')
    box(w, 0.1, d * 0.58, 0, h * 0.5, d * 0.21, 'wood')
    for (let i = 0; i < 14; i++) box((w - 0.12) / 14 - 0.009, 0.035, d * 0.35, -w / 2 + 0.06 + (i + 0.5) * (w - 0.12) / 14, h * 0.5 + 0.1, d * 0.22, i % 3 ? 'tile' : 'charcoal')
  } else if (family === 'bicycle-stand') {
    box(w, 0.08, d)
    box(0.08, 0.45, 0.08, 0, 0.08)
    box(w * 0.65, 0.09, 0.09, 0, 0.53)
    for (const x of [-1, 1]) disc(w * 0.23, 0.06, x * w * 0.27, 0.53, 0.075, 'z')
    box(0.08, 0.45, 0.08, -w * 0.17, 0.62)
    box(0.26, 0.06, 0.2, -w * 0.17, 1.07, 0, 'fabric')
    box(0.07, 0.62, 0.07, w * 0.22, 0.62)
    box(0.07, 0.06, 0.4, w * 0.22, 1.24)
  } else if (family === 'diner-booth') {
    for (const z of [-1, 1]) {
      box(w, 0.45, d * 0.25, 0, 0, z * d * 0.375, 'fabric')
      box(w, h - 0.45, 0.1, 0, 0.45, z * (d / 2 - 0.05), 'fabric')
    }
    pedestal(0.72, w * 0.5, d * 0.2)
    stock(box(w * 0.8, 0.08, d * 0.35, 0, 0.72, 0, 'wood'))
  } else if (family === 'vice-bench' || family === 'cobbler-bench') {
    const y = table(0.84)
    box(w * 0.42, 0.05, d * 0.52, 0, y, 0, 'steel', 'vice-base')
    box(w * 0.3, 0.08, d * 0.18, 0, y + 0.05, 0, 'steel', 'vice-slide')
    for (const z of [-1, 1]) {
      box(w * 0.26, 0.18, d * 0.075, 0, y + 0.13, z * d * 0.0525, 'steel', 'vice-jaw')
      box(w * 0.26, 0.035, d * 0.075, 0, y + 0.31, z * d * 0.0525, 'rubber', 'jaw-liner')
    }
    const screw = b.solid('cylinder', [0.045, 0.15, 0.045], [0, y + 0.09, d * 0.09 + 0.075], 'steel', 'fixture', 'vice-screw')
    screw.pitch = Math.PI / 2
    const handle = b.solid('cylinder', [0.02, 0.19, 0.02], [0, y + 0.09, d * 0.09 + 0.16], 'steel', 'fixture', 'vice-handle')
    handle.roll = Math.PI / 2
  } else if (family === 'casket') {
    for (const z of [-1, 1]) box(w * 0.8, 0.5, 0.15, 0, 0, z * d * 0.28)
    stock(box(w, h - 0.5, d, 0, 0.5, 0, 'wood'))
  } else if (family === 'studio-camera') {
    pedestal(h * 0.6)
    const camera = box(w * 0.6, h * 0.3, d * 0.55, 0, h * 0.6); stock(camera)
    disc(w * 0.2, d * 0.35, 0, h * 0.75, d * 0.45, 'z', 'charcoal')
  } else if (family === 'tire-changer') {
    box(w * 0.7, h * 0.5, d * 0.7)
    cylinder(w * 0.8, 0.25, d * 0.85, 0, h * 0.5, 0, 'charcoal')
    box(0.08, h - 0.08, 0.08, -w * 0.3, 0, -d * 0.49)
    box(w * 0.6 + 0.08, 0.08, 0.08, 0, h - 0.08, -d * 0.49)
  } else if (family === 'salon-station') {
    const surface = table(0.78, w, d * 0.55)
    box(w * 0.85, h - surface, 0.08, 0, surface, -d * 0.23, 'tile')
  } else {
    const y = table(family === 'play-table' ? 0.55 : family === 'pinball' ? 0.7 : 0.82)
    if (['computer-station', 'electronics-bench', 'radio-console', 'lab-equipment'].includes(family)) {
      monitor(-w * 0.15, y, -d * 0.12, w * 0.55)
      box(w * 0.55, 0.04, d * 0.23, -w * 0.1, y, d * 0.31, 'charcoal')
      if (family !== 'computer-station') box(w * 0.2, 0.3, d * 0.5, w * 0.36, y)
    } else if (family === 'sewing-machine') {
      box(w * 0.6, 0.045, d * 0.65, 0, y, 0, 'tile')
      box(w * 0.14, 0.28, d * 0.4, w * 0.23, y + 0.045, 0, 'tile')
      box(w * 0.48, 0.1, d * 0.4, w * 0.06, y + 0.325, 0, 'tile')
      box(0.03, 0.24, 0.03, -w * 0.13, y + 0.085)
    } else if (['coffee-machine', 'bar-tap', 'tea-counter', 'reception-bell'].includes(family)) {
      if (family === 'coffee-machine') { box(w * 0.75, 0.44, d * 0.5, 0, y); for (const x of [-1, 1]) box(0.055, 0.06, d * 0.2, x * w * 0.22, y + 0.15, d * 0.35) }
      else for (const x of [-0.25, 0.25]) { cylinder(0.1, 0.32, 0.1, w * x, y); box(0.06, 0.05, 0.15, w * x, y + 0.32, 0.05) }
    } else if (['oven', 'range-hood', 'field-kitchen'].includes(family)) {
      for (const x of [-0.25, 0.25]) for (const z of [-0.23, 0.23]) cylinder(w * 0.22, 0.045, d * 0.23, x * w, y, z * d, 'charcoal')
      if (family === 'range-hood') { for (const x of [-1, 1]) box(0.06, h - y - 0.22, 0.06, x * (w - 0.06) / 2, y, -d / 2 + 0.03); box(w, 0.22, d, 0, h - 0.22) }
    } else if (['printing-press', 'saw-table', 'engine-stand', 'cement-mixer', 'water-pump'].includes(family)) {
      const base = box(w * 0.8, 0.15, d * 0.7, 0, y)
      if (family === 'saw-table') disc(0.3, 0.04, 0, y + 0.15 + 0.3, 0, 'z', 'steel')
      else { cylinder(w * 0.55, h - y - 0.15, d * 0.55, 0, y + 0.15); stock(base) }
    } else if (['security-counter', 'butcher-rail', 'teacher-desk'].includes(family)) {
      for (const x of [-1, 1]) box(0.06, h - y, 0.06, x * (w - 0.06) / 2, y, -d / 2 + 0.03)
      box(w - 0.12, 0.1, 0.06, 0, h - 0.1, -d / 2 + 0.03)
      if (family === 'teacher-desk') box(w - 0.12, 0.6, 0.06, 0, h - 0.7, -d / 2 + 0.03, 'charcoal')
      else for (let i = 0; i < 5; i++) box(0.035, family === 'butcher-rail' ? 0.2 : h - y - 0.1, 0.035, -w * 0.35 + i * w * 0.175, family === 'butcher-rail' ? h - 0.3 : y, -d / 2 + 0.03)
    } else if (family === 'pinball') {
      b.prism([[-w / 2, y], [w / 2, y], [w / 2, y + 0.18], [-w / 2, y + 0.18]], d * 0.8, d * 0.1, 'paint', 'fixture', 'pinball-deck')
      box(w, h - y, d * 0.2, 0, y, -d * 0.4, 'charcoal')
    } else if (['produce-display', 'shoe-display', 'ice-cream-case', 'toy-display'].includes(family)) {
      for (let i = 0; i < 3; i++) stock(box(w, 0.09 + i * 0.13, d / 3, 0, y, d / 3 - i * d / 3, i % 2 ? 'wood' : 'tile'))
    } else if (family === 'reading-table' || family === 'council-desk') {
      box(w, Math.max(0.1, h - y), 0.05, 0, y, -d * 0.28, 'wood')
    } else if (family === 'signal-lever') {
      for (let i = 0; i < 4; i++) box(0.06, h - y, 0.06, -w * 0.3 + i * w * 0.2, y, 0, 'paint')
    } else if (family === 'altar') {
      box(0.12, h - y, 0.1, 0, y, -d * 0.3, 'wood')
      box(w * 0.25, 0.08, d * 0.2, 0, h, -d * 0.3, 'wood')
    } else if (family === 'watch-bench') {
      box(0.05, 0.3, 0.05, w * 0.25, y, 0)
      box(w * 0.35, 0.06, 0.15, w * 0.1, y + 0.3, 0, 'tile')
    } else {
      box(w * 0.5, 0.1, d * 0.55, 0, y)
      box(w * 0.2, Math.max(0.12, h - y - 0.1), d * 0.4, w * 0.15, y + 0.1, 0, 'charcoal')
    }
  }
}
