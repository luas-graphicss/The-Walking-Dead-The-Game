import type { ModelBuilder } from './model'
import type { AssetSpec, BlockPart, Category, LootKind, MaterialKey, Vec3 } from './types'

type Spec = [family: string, label: string, category: Category, size: Vec3, material: MaterialKey, loot?: LootKind, scales?: [number, number, number]]
const specs: Spec[] = [
  ['tv-stand', 'Rack com televisor de tubo', 'Mobiliário', [1.2, 1.0, 0.46], 'wood', 'electronics'],
  ['coffee-table', 'Mesa de centro', 'Mobiliário', [1.1, 0.44, 0.6], 'wood', 'documents'],
  ['kitchen-counter', 'Balcão de cozinha com armário', 'Mobiliário', [1.0, 0.9, 0.62], 'wood', 'food', [0.6, 1, 1.4]],
  ['wall-cabinet', 'Armário aéreo de cozinha', 'Mobiliário', [1.0, 0.7, 0.34], 'wood', 'food', [0.6, 1, 1.4]],
  ['display-table', 'Mesa expositora de loja', 'Comércio', [1.6, 0.86, 0.9], 'wood', 'salvage'],
  ['coat-rack', 'Cabideiro de pé', 'Mobiliário', [0.5, 1.8, 0.5], 'wood'],
  ['wall-art', 'Quadro emoldurado', 'Mobiliário', [0.9, 0.65, 0.045], 'paper', undefined, [0.62, 1, 1.35]],
  ['rug', 'Tapete', 'Mobiliário', [2.0, 0.012, 1.4], 'fabric', undefined, [0.8, 1, 1.18]],
  ['mattress', 'Colchão largado no chão', 'Mobiliário', [0.95, 0.2, 1.95], 'fabric', 'textiles'],
  ['sleeping-bag', 'Saco de dormir', 'Mobiliário', [0.8, 0.12, 2.0], 'fabric', 'textiles'],
  ['privacy-screen', 'Biombo hospitalar', 'Serviços', [1.8, 1.75, 0.45], 'fabric'],
  ['floor-lamp', 'Luminária de pé', 'Mobiliário', [0.42, 1.65, 0.42], 'steel'],
  ['bar-stool', 'Banqueta alta de bar', 'Comércio', [0.42, 0.78, 0.42], 'steel'],
  ['shopping-cart', 'Carrinho de compras', 'Comércio', [0.6, 1.0, 0.95], 'steel', 'food'],
  ['cardboard-boxes', 'Pilha de caixas de papelão', 'Comércio', [1.0, 0.78, 0.8], 'paper', 'salvage'],
  ['trash-bags', 'Sacos de lixo amontoados', 'Destroços', [1.0, 0.5, 0.8], 'rubber', 'salvage'],
  ['potted-plant', 'Vaso com planta seca', 'Mobiliário', [0.5, 1.1, 0.5], 'tile'],
  ['step-ladder', 'Escada de abrir', 'Comércio', [0.55, 1.6, 0.75], 'steel'],
]

const NAMES = ['compacto', 'padrão', 'amplo']
export const INTERIOR_ASSETS: AssetSpec[] = specs.flatMap(([family, label, category, size, material, loot, scales = [0.9, 1, 1.12]]) => [0, 1, 2].map((variant) => ({
  id: `${family}-${variant}`, family, label: `${label} · ${NAMES[variant]}`, category, recipe: 'interior' as const,
  size: [size[0] * scales[variant], size[1], size[2]] as Vec3, material, variant, loot,
})))
export const INTERIOR_FAMILIES = new Set(specs.map(([family]) => family))

export function buildInterior(b: ModelBuilder, spec: AssetSpec) {
  const { family, size: [w, h, d], material: m, loot } = spec
  const box = (size: Vec3, x: number, bottom: number, z: number, mat: MaterialKey = m, name = family): BlockPart => b.box(size, [x, bottom + size[1] / 2, z], mat, 'fixture', 0, 0, name)
  const cylinder = (width: number, height: number, depth: number, x: number, bottom: number, z: number, mat: MaterialKey = m) => b.solid('cylinder', [width, height, depth], [x, bottom + height / 2, z], mat, 'fixture', family)
  const legs = (height: number, t: number, inset: number) => { for (const x of [-1, 1]) for (const z of [-1, 1]) box([t, height, t], x * (w / 2 - inset - t / 2), 0, z * (d / 2 - inset - t / 2)) }
  const stock = (part: BlockPart, concealed: boolean, label: string, x = 0, z = 0) => { if (loot) b.socket(part, loot, concealed, label, x, z) }

  switch (family) {
    case 'tv-stand': {
      const cabinet = box([w, 0.5, d], 0, 0, 0)
      stock(cabinet, true, 'Gavetas do rack', w * 0.32, 0)
      const tv = box([0.64, 0.46, 0.4], -w * 0.04, 0.5, -d / 2 + 0.2 + 0.02, 'charcoal', 'crt-body')
      box([0.5, 0.36, 0.016], tv.position[0], 0.55, tv.position[2] + 0.2 + 0.008, 'glass', 'crt-screen')
      break
    }
    case 'coffee-table': {
      legs(0.4, 0.05, 0.04)
      box([w - 0.18, 0.025, d - 0.08], 0, 0.08, 0)
      stock(box([w, 0.04, d], 0, 0.4, 0), false, 'Revistas e controles')
      break
    }
    case 'kitchen-counter': {
      box([w - 0.04, 0.1, d - 0.1], 0, 0, -0.05)
      const carcass = box([w, 0.76, d - 0.04], 0, 0.1, -0.02)
      const top = box([w, 0.04, d], 0, 0.86, 0, 'tile', 'worktop')
      const leaves = w > 0.8 ? 2 : 1, leafW = (w - 0.03) / leaves - (leaves > 1 ? 0.005 : 0)
      for (let i = 0; i < leaves; i++) box([leafW, 0.68, 0.018], -w / 2 + 0.015 + leafW / 2 + i * (leafW + 0.01), 0.14, d / 2 - 0.04 + 0.009, m, 'cabinet-door')
      stock(carcass, true, 'Armário sob a bancada')
      stock(top, false, 'Bancada da cozinha', 0, 0.05)
      break
    }
    case 'wall-cabinet': {
      const carcass = box([w, h, d - 0.02], 0, 0, -0.01)
      const leaves = w > 0.7 ? 2 : 1, leafW = (w - 0.02) / leaves - (leaves > 1 ? 0.005 : 0)
      for (let i = 0; i < leaves; i++) box([leafW, h - 0.04, 0.018], -w / 2 + 0.01 + leafW / 2 + i * (leafW + 0.01), 0.02, d / 2 - 0.02 + 0.009, m, 'cabinet-door')
      stock(carcass, true, 'Armário aéreo')
      break
    }
    case 'display-table': {
      legs(0.8, 0.06, 0.03)
      box([w - 0.18, 0.03, d - 0.06], 0, 0.14, 0)
      const top = box([w, 0.06, d], 0, 0.8, 0)
      box([0.42, 0.2, 0.32], -w * 0.25, 0.86, -0.12, 'paper', 'goods-stack')
      box([0.34, 0.12, 0.28], w * 0.24, 0.86, 0.16, 'paper', 'goods-stack')
      stock(top, false, 'Mercadorias expostas', w * 0.1, -0.2)
      break
    }
    case 'coat-rack': {
      box([0.08, 0.08, 0.08], 0, 0, 0)
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) box([x ? w / 2 - 0.04 : 0.05, 0.04, z ? d / 2 - 0.04 : 0.05], x * (w / 4 + 0.02), 0, z * (d / 4 + 0.02))
      box([0.045, h - 0.08, 0.045], 0, 0.08, 0)
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) box([x ? 0.1 : 0.025, 0.025, z ? 0.1 : 0.025], x * 0.0725, h - 0.2, z * 0.0725, m, 'coat-hook')
      break
    }
    case 'wall-art': {
      const bar = 0.04
      box([w, bar, d], 0, 0, 0, 'wood', 'frame')
      box([w, bar, d], 0, h - bar, 0, 'wood', 'frame')
      for (const x of [-1, 1]) box([bar, h - 2 * bar, d], x * (w / 2 - bar / 2), bar, 0, 'wood', 'frame')
      box([w - 2 * bar, h - 2 * bar, 0.02], 0, bar, -d / 2 + 0.01, m, 'canvas')
      break
    }
    case 'rug': box([w, h, d], 0, 0, 0); break
    case 'mattress': {
      const body = box([w, 0.2, d], 0, 0, 0)
      box([w * 0.58, 0.1, 0.34], 0, 0.2, -d / 2 + 0.26, m, 'pillow')
      stock(body, false, 'Colchão e cobertas', 0, d * 0.22)
      break
    }
    case 'sleeping-bag': {
      const body = box([w, 0.1, d - 0.26], 0, 0, 0.13)
      box([w * 0.82, h, 0.26], 0, 0, -d / 2 + 0.13, m, 'hood')
      stock(body, false, 'Saco de dormir e pertences', 0, 0.2)
      break
    }
    case 'privacy-screen': {
      const post = 0.035, panels = 3, panel = (w - (panels + 1) * post) / panels
      for (let i = 0; i <= panels; i++) {
        const x = -w / 2 + post / 2 + i * (panel + post)
        box([0.07, 0.04, d], x, 0, 0, 'steel', 'screen-foot')
        box([post, h - 0.04, post], x, 0.04, 0, 'steel', 'screen-post')
        if (i < panels) box([panel, 1.3, 0.012], x + post / 2 + panel / 2, 0.34, 0, m, 'screen-panel')
      }
      break
    }
    case 'floor-lamp': {
      cylinder(w * 0.7, 0.04, w * 0.7, 0, 0, 0)
      cylinder(0.03, h - 0.34, 0.03, 0, 0.04, 0)
      b.solid('cone', [w, 0.3, w], [0, h - 0.15, 0], 'fabric', 'fixture', 'lamp-shade')
      break
    }
    case 'bar-stool': {
      cylinder(w * 0.9, 0.03, w * 0.9, 0, 0, 0)
      cylinder(0.05, h - 0.1, 0.05, 0, 0.03, 0)
      cylinder(w * 0.85, 0.07, w * 0.85, 0, h - 0.07, 0, 'leather')
      break
    }
    case 'shopping-cart': {
      for (const x of [-1, 1]) for (const z of [-1, 1]) box([0.05, 0.1, 0.05], x * (w / 2 - 0.08), 0, z * (d / 2 - 0.08), 'rubber', 'caster')
      box([w - 0.11, 0.04, d - 0.11], 0, 0.1, 0, m, 'chassis')
      for (const x of [-1, 1]) for (const z of [-1, 1]) box([0.025, 0.31, 0.025], x * (w / 2 - 0.1), 0.14, z * (d / 2 - 0.1), m, 'basket-post')
      const floor = box([w, 0.02, d - 0.1], 0, 0.45, 0, m, 'basket-floor')
      for (const x of [-1, 1]) box([0.015, 0.4, d - 0.1], x * (w / 2 - 0.0075), 0.47, 0, m, 'basket-side')
      for (const z of [-1, 1]) box([w - 0.03, 0.4, 0.015], 0, 0.47, z * ((d - 0.1) / 2 - 0.0075), m, 'basket-end')
      box([w - 0.03, 0.03, 0.03], 0, 0.87, -(d - 0.1) / 2 + 0.0075, m, 'push-handle')
      stock(floor, false, 'Compras abandonadas no carrinho', 0, 0.05)
      break
    }
    case 'cardboard-boxes': {
      box([0.5, 0.36, 0.42], -0.24, 0, -0.15)
      box([0.44, 0.3, 0.38], -0.22, 0.36, -0.14, m, 'box')
      const top = box([0.3, 0.12, 0.25], -0.2, 0.66, -0.12, m, 'box')
      const side = box([0.46, 0.32, 0.4], 0.26, 0, 0.12, m, 'box')
      stock(side, false, 'Caixa de papelão aberta')
      stock(top, true, 'Caixa lacrada')
      break
    }
    case 'trash-bags': {
      box([0.45, 0.5, 0.42], -0.25, 0, -0.15, m, 'bag')
      const bag = box([0.42, 0.44, 0.4], 0.25, 0, -0.12, m, 'bag')
      box([0.4, 0.38, 0.36], 0, 0, 0.27, m, 'bag')
      stock(bag, true, 'Saco de lixo rasgado')
      break
    }
    case 'potted-plant': {
      cylinder(w * 0.8, 0.42, w * 0.8, 0, 0, 0)
      box([w * 0.56, 0.02, w * 0.56], 0, 0.42, 0, 'charcoal', 'soil')
      for (const [x, z, tall] of [[-0.06, 0.03, 0.62], [0.07, -0.04, 0.5], [0.01, 0.08, 0.42]]) box([0.022, tall, 0.022], x, 0.44, z, 'wood', 'dry-stem')
      break
    }
    case 'step-ladder': {
      for (const z of [-1, 1]) for (const x of [-1, 1]) box([0.04, h - 0.05, 0.06], x * (w / 2 - 0.02), 0, z * (d / 2 - 0.03), m, 'ladder-rail')
      box([w, 0.05, d], 0, h - 0.05, 0, m, 'ladder-top')
      for (let i = 1; i <= 3; i++) box([w - 0.08, 0.03, 0.1], 0, i * (h - 0.05) / 4, d / 2 - 0.05, m, 'ladder-step')
      break
    }
    default: throw new Error(`Módulo interior sem blocagem: ${family}`)
  }
}
