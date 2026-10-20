import { FLOOR_HEIGHT, FOUNDATION_HEIGHT, hash, random, type BlockModel, type Condition, type LootSocket, type Room, type StructureModel } from '../blockout/types'
import { RESOURCES_BY_CONTAINER } from './catalog'
import { CONTAINER_BY_FAMILY, KIND_CONTAINER, KIND_PROFILE, ROOM_PROFILES, SITE_PROFILES, type SiteProfile } from './contexts'
import { RARITY_WEIGHT, type Container, type Resource, type ResourceCategory, type ResourceStack } from './types'

export type SocketContext = { container: Container; profile: SiteProfile; condition: Condition; room?: Room }
export type SocketLoot = SocketContext & { socket: LootSocket; items: ResourceStack[] }

const LOOTED: Record<Condition, number> = { weathered: 0.22, damaged: 0.3, burned: 0.42, ruined: 0.5, leveled: 0.6 }

const SURVIVAL: Record<Condition, Partial<Record<ResourceCategory, number>>> = {
  weathered: {},
  damaged: { bebida: 0.8, eletrico: 0.85 },
  burned: { tecido: 0.2, documento: 0.15, alimento: 0.3, higiene: 0.35, plastico: 0.5, medico: 0.5, bebida: 0.5, combustivel: 0.3, quimico: 0.6, sucata: 1.3, metal: 1.3 },
  ruined: { eletrico: 0.6, medico: 0.6, bebida: 0.5, alimento: 0.7, sucata: 1.4, construcao: 1.3, metal: 1.2 },
  leveled: { eletrico: 0.4, medico: 0.4, bebida: 0.4, alimento: 0.5, documento: 0.4, sucata: 1.6, construcao: 1.5, metal: 1.3 },
}
const FLAMMABLE = new Set<ResourceCategory>(['tecido', 'documento', 'alimento', 'higiene', 'plastico'])

const STOCK = new Set<Container>(['prateleira', 'gondola', 'farmacia', 'armeiro', 'caixote', 'refrigerado', 'ferramentas', 'remedios'])
const CAPACITY: Partial<Record<Container, number>> = { prateleira: 3, gondola: 3, farmacia: 3, armeiro: 3, caixote: 3, escombros: 3, despensa: 3, ferramentas: 3, bancada: 3 }

const levelOf = (y: number) => Math.max(0, Math.floor((y - FOUNDATION_HEIGHT + 0.25) / FLOOR_HEIGHT))

export function roomOf(socket: LootSocket, host?: BlockModel): Room | undefined {
  const rooms = (host as Partial<StructureModel> | undefined)?.rooms
  if (!rooms?.length) return undefined
  const level = levelOf(socket.position[1])
  let best: Room | undefined, distance = Infinity
  for (const room of rooms) {
    if (room.level !== level) continue
    const d = Math.hypot(room.center[0] - socket.position[0], room.center[2] - socket.position[2])
    if (d < distance) { distance = d; best = room }
  }
  return best
}

export function containerOf(socket: LootSocket, room?: Room): Container {
  const container = (socket.container && CONTAINER_BY_FAMILY.get(socket.container)) || KIND_CONTAINER[socket.kind]
  if (container === 'pia' && (room?.kind === 'bathroom' || /banheiro|lavabo/i.test(room?.label ?? ''))) return 'banheiro'
  return container
}

export function socketContext(socket: LootSocket, host?: BlockModel): SocketContext {
  const structure = host as Partial<StructureModel> | undefined
  const room = roomOf(socket, host)
  const base = (structure?.blueprint && SITE_PROFILES.get(structure.blueprint)) || KIND_PROFILE[socket.kind]
  const profile: SiteProfile = { ...base }
  for (const [tag, value] of Object.entries(room?.kind ? ROOM_PROFILES[room.kind] ?? {} : {})) profile[tag as keyof SiteProfile] = Math.max(profile[tag as keyof SiteProfile] ?? 0, value)
  return { container: containerOf(socket, room), profile, condition: structure?.condition ?? 'weathered', room }
}

export function affinity(resource: Resource, profile: SiteProfile) {
  let best = resource.sites['*'] ?? 0
  for (const [tag, strength] of Object.entries(profile)) best = Math.max(best, (strength ?? 0) * (resource.sites[tag as keyof SiteProfile] ?? 0))
  return best
}

function candidates(context: SocketContext, prop?: string) {
  const pool: { resource: Resource; weight: number; fit: number }[] = []
  for (const resource of RESOURCES_BY_CONTAINER.get(context.container) ?? []) {
    if (prop && resource.display !== prop) continue
    const fit = affinity(resource, context.profile)
    const weight = fit * RARITY_WEIGHT[resource.rarity] * (SURVIVAL[context.condition][resource.category] ?? 1)
    if (weight > 0) pool.push({ resource, weight, fit })
  }
  return pool
}

export function rollSocket(socket: LootSocket, seed: number, host?: BlockModel, context = socketContext(socket, host)): ResourceStack[] {
  const rng = random(hash(`${socket.id}|${seed}`))
  const dressed = Boolean(socket.prop)
  if (!dressed && context.container !== 'escombros' && rng() < LOOTED[context.condition] * (socket.concealed ? 0.55 : 1)) return []
  let pool = candidates(context, socket.prop)
  if (!pool.length && dressed) pool = candidates(context)
  if (!pool.length) return []
  const severe = context.condition === 'ruined' || context.condition === 'leveled'
  const slots = dressed ? 1 : 1 + Math.floor(rng() * Math.max(1, (CAPACITY[context.container] ?? 2) - (severe ? 1 : 0)))
  const items: ResourceStack[] = []
  for (let i = 0; i < slots && pool.length; i++) {
    let roll = rng() * pool.reduce((sum, entry) => sum + entry.weight, 0), index = 0
    while (index < pool.length - 1 && (roll -= pool[index].weight) > 0) index++
    const [{ resource, fit }] = pool.splice(index, 1)
    const [lo, hi] = resource.quantity
    let quantity = lo + Math.floor(rng() * (hi - lo + 1))
    if (STOCK.has(context.container) && fit >= 0.8) quantity = Math.min(resource.stack, Math.ceil(quantity * (1.5 + rng())))
    if (context.condition === 'burned' && FLAMMABLE.has(resource.category)) quantity = Math.max(1, Math.floor(quantity * 0.6))
    items.push({ resource, quantity })
  }
  return items
}

export function generateStructureLoot(structure: StructureModel, seed: number): SocketLoot[] {
  return structure.sockets.map((socket) => {
    const context = socketContext(socket, structure)
    return { ...context, socket, items: rollSocket(socket, seed, structure, context) }
  })
}
