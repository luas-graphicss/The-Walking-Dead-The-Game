import { rollSocket, socketContext } from '../resources/spawn'
import { CATEGORY_LABELS, CONTAINER_LABELS, RARITY_LABELS } from '../resources/types'
import type { BlockModel, LootKind, LootSocket } from './types'

export type LootRoll = { id: string; label: string; rarity: string; quantity: number; category: string }
export type SocketReport = { container: string; room?: string; items: LootRoll[] }

export const LOOT_LABELS: Record<LootKind, string> = {
  salvage: 'Sucata', food: 'Alimentos', medical: 'Medicamentos', weapons: 'Armamento', tools: 'Ferramentas', textiles: 'Tecidos', electronics: 'Eletrônicos', agriculture: 'Suprimentos rurais', documents: 'Documentos',
}

export function inspectSocket(socket: LootSocket, seed: number, host?: BlockModel): LootRoll[] {
  return rollSocket(socket, seed, host).map(({ resource, quantity }) => ({ id: resource.id, label: resource.label, rarity: RARITY_LABELS[resource.rarity], quantity, category: CATEGORY_LABELS[resource.category] }))
}

export function describeSocket(socket: LootSocket, seed: number, host?: BlockModel): SocketReport {
  const context = socketContext(socket, host)
  return { container: CONTAINER_LABELS[context.container], room: context.room?.label, items: inspectSocket(socket, seed, host) }
}
