import { assetFor } from './catalog'
import { buildAsset, type ModelBuilder } from './model'
import { hash, modelBounds, random, transformPoint, type Blueprint, type Condition, type StructureModel, type Vec3 } from './types'
import type { Architecture } from './architecture'

type Program = { label: string; equipment: string[] }
export function roomProgram(blueprint: Blueprint, profile: Architecture, zone: string, index: number, level: number): Program {
  const home = blueprint.category === 'Residências' || blueprint.id === 'farmhouse' || ['hunting-cabin', 'fishing-cabin'].includes(blueprint.id)
  if (home || ['motel', 'inn', 'apartment-building'].includes(blueprint.id)) {
    const programs: Record<string, Program> = {
      B: { label: 'Dormitório', equipment: [blueprint.id === 'motel' ? 'motel-bed' : 'single-bed', 'nightstand'] },
      A: { label: blueprint.id === 'apartment-building' ? 'Apartamento' : 'Banheiro', equipment: blueprint.id === 'apartment-building' ? ['double-bed', 'sofa'] : ['toilet', 'sink'] },
      K: { label: 'Cozinha', equipment: ['oven', 'sink', 'fridge'] },
      L: { label: 'Sala de estar', equipment: ['sofa', 'armchair', 'dining-table'] },
      E: { label: 'Entrada e convívio', equipment: ['dining-table', 'dining-chair'] },
      S: { label: 'Circulação e escada', equipment: [] },
      T: { label: 'Área de trabalho', equipment: [profile.specialty, 'tool-rack'] },
      R: { label: 'Armazenagem', equipment: ['pallet', 'workbench'] },
      F: { label: level === 0 ? 'Comércio no térreo' : 'Sala da residência', equipment: level === 0 ? ['counter', 'grocery-shelf'] : ['sofa', 'bookcase'] },
    }
    return programs[zone] ?? { label: 'Área de serviço', equipment: ['sink'] }
  }
  if (blueprint.id === 'hospital-building' || ['clinic', 'rural-clinic', 'dental-clinic', 'veterinary'].includes(blueprint.id)) {
    if (zone === 'S') return { label: 'Núcleo de circulação vertical', equipment: [] }
    if (zone === 'C') return { label: 'Corredor clínico', equipment: ['bench'] }
    if (zone === 'W') return { label: level > 0 ? 'Ala de internação' : 'Observação e tratamento', equipment: ['hospital-bed', 'iv-stand', 'patient-monitor'] }
    if (zone === 'D' || zone === 'T') return { label: index % 2 ? 'Diagnóstico por imagem' : 'Sala de exame', equipment: [index % 2 ? profile.specialty : 'exam-table', 'medicine-cabinet', 'patient-monitor'] }
    return { label: 'Recepção e espera', equipment: ['reception', 'wheelchair', 'bench'] }
  }
  if (blueprint.category === 'Fazendas') {
    if (blueprint.id === 'barn') return { label: zone === 'E' ? 'Acesso de máquinas' : 'Armazenagem de feno e ração', equipment: zone === 'E' ? ['tractor', 'tool-rack'] : ['hay-bale', index % 2 ? 'feed-hopper' : 'hay-bale'] }
    if (blueprint.id === 'stable') return { label: zone === 'E' ? 'Área de manejo' : 'Baias e alimentação', equipment: zone === 'E' ? ['trough', 'tool-rack'] : ['horse-stall', 'trough'] }
    if (blueprint.id === 'greenhouse') return { label: zone === 'E' ? 'Preparo de mudas' : 'Cultivo protegido', equipment: ['seedling-bench', 'planter'] }
    if (blueprint.id === 'sawmill') return { label: zone === 'T' ? 'Corte e processamento' : 'Recebimento de madeira', equipment: zone === 'T' ? ['saw-table', 'log-stack'] : ['log-stack', 'pallet'] }
    if (blueprint.id === 'grain-store') return { label: 'Movimentação de grãos', equipment: ['feed-hopper', 'pallet'] }
    return { label: zone === 'B' ? 'Alojamento do guarda' : 'Posto de trabalho rural', equipment: zone === 'B' ? ['single-bed', 'locker'] : [profile.specialty, 'tool-rack'] }
  }
  if (blueprint.id === 'church') return { label: zone === 'A' ? 'Altar e sacristia' : zone === 'E' ? 'Nártex de entrada' : 'Nave de bancos', equipment: zone === 'A' ? ['altar', 'bookcase'] : zone === 'E' ? ['noticeboard'] : ['pew', 'pew', 'pew', 'pew'] }
  if (blueprint.id === 'school' || blueprint.id === 'daycare') return { label: zone === 'T' ? 'Sala de aula' : zone === 'C' ? 'Corredor de acesso às salas' : zone === 'B' ? 'Repouso infantil' : 'Recepção escolar', equipment: zone === 'T' ? ['school-desk', 'school-desk', 'school-desk', 'teacher-desk'] : zone === 'C' ? ['locker'] : zone === 'B' ? ['single-bed', 'play-table'] : ['reception', 'noticeboard'] }
  if (blueprint.id === 'library' || blueprint.id === 'bookshop') return { label: zone === 'T' ? 'Sala de leitura' : zone === 'E' ? 'Empréstimos e informação' : 'Acervo e consulta', equipment: zone === 'T' ? ['reading-table', 'armchair'] : zone === 'E' ? ['counter', 'bookcase'] : ['bookcase', 'bookcase'] }
  if (blueprint.id === 'office-building' || blueprint.id === 'town-hall') return { label: zone === 'S' || zone === 'C' ? 'Circulação' : zone === 'E' ? 'Lobby e recepção' : 'Escritório', equipment: zone === 'S' || zone === 'C' ? [] : zone === 'E' ? ['reception', 'bench'] : ['computer-station', 'filing-cabinet'] }
  if (blueprint.id === 'police') return { label: zone === 'T' ? 'Custódia e armaria' : zone === 'C' ? 'Atendimento e registro' : 'Recepção policial', equipment: zone === 'T' ? ['holding-cell', 'gun-cabinet'] : ['desk', 'filing-cabinet'] }
  if (blueprint.id === 'fire-station') return { label: zone === 'T' ? 'Equipamentos de resposta' : zone === 'R' ? 'Alojamento de plantão' : 'Saída de viaturas', equipment: zone === 'T' ? ['fire-gear', 'tool-rack'] : zone === 'R' ? ['bunk-bed', 'locker'] : ['workbench'] }
  if (blueprint.id === 'shelter') return { label: zone === 'W' ? 'Alojamento coletivo' : zone === 'T' ? 'Cozinha e suprimentos' : 'Triagem', equipment: zone === 'W' ? ['bunk-bed', 'locker'] : zone === 'T' ? ['field-kitchen', 'water-tank'] : ['reception', 'medical-crate'] }
  if (['power-substation', 'water-works'].includes(blueprint.id)) return { label: zone === 'T' ? 'Pátio de equipamentos' : 'Operação e manutenção', equipment: zone === 'T' ? [profile.specialty, 'electrical-panel'] : ['workbench', 'tool-rack'] }
  if (zone === 'T') return { label: 'Área técnica e atividade principal', equipment: [profile.specialty, blueprint.equipment[1]] }
  if (zone === 'R') return { label: 'Reserva e recebimento', equipment: [blueprint.equipment[0], blueprint.equipment[3]] }
  if (zone === 'K') return { label: 'Cozinha e preparo', equipment: ['oven', 'sink', 'fridge'] }
  if (zone === 'O') return { label: 'Administração', equipment: ['desk', 'filing-cabinet'] }
  if (zone === 'E') return { label: 'Entrada e atendimento', equipment: [blueprint.category === 'Serviços públicos' ? 'reception' : 'counter', blueprint.equipment[2]] }
  return { label: 'Área de uso público', equipment: [blueprint.equipment[index % 2], blueprint.equipment[(index + 1) % 2]] }
}

export function furnishRoom(b: ModelBuilder, model: StructureModel, program: Program, center: Vec3, bay: [number, number], seed: number, condition: Condition, level: number, signature?: string) {
  if (condition === 'leveled') return
  const rng = random(hash(`${seed}:${model.blueprint}:${center.join(',')}`))
  const equipment = signature ? [signature, ...program.equipment.filter((family) => family !== signature)].slice(0, 4) : program.equipment
  for (const [slot, family] of equipment.entries()) {
    if (condition === 'ruined' && (slot === 3 || slot > 0 && rng() < 0.6)) continue
    let placed = false
    for (const variant of [Math.floor(rng() * 2), 0]) {
      const spec = assetFor(family, variant), source = buildAsset(spec), bounds = modelBounds(source)
      for (const turn of [0, Math.PI / 2]) {
        const yaw = turn + (slot > 1 ? Math.PI : 0)
        const corners = [bounds.min[0], bounds.max[0]].flatMap((x) => [bounds.min[2], bounds.max[2]].map((z) => transformPoint([x, 0, z], [0, 0, 0], yaw)))
        const minX = Math.min(...corners.map((p) => p[0])), maxX = Math.max(...corners.map((p) => p[0])), minZ = Math.min(...corners.map((p) => p[2])), maxZ = Math.max(...corners.map((p) => p[2]))
        if (maxX - minX > bay[0] / 2 - 0.72 || maxZ - minZ > bay[1] / 2 - 0.72) continue
        const position: Vec3 = [center[0] + (slot % 2 === 0 ? -bay[0] / 2 + 0.34 - minX : bay[0] / 2 - 0.34 - maxX), center[1] - bounds.min[1], center[2] + (slot < 2 ? -bay[1] / 2 + 0.34 - minZ : bay[1] / 2 - 0.34 - maxZ)]
        const offset = b.model.parts.length
        const prefix = b.append(source, position, yaw, level)
        const burned = condition === 'burned' && slot % 2 === 0
        if (burned) for (const part of b.model.parts.slice(offset)) if (['wood', 'fabric', 'paint'].includes(part.material)) part.material = 'charcoal'
        model.instances.push({ asset: spec.id, position, yaw, level, prefix, burned })
        placed = true
        break
      }
      if (placed) break
    }
    if (!placed && signature === family) throw new Error(`${model.blueprint}: espaço insuficiente para ${family}.`)
  }
}
