import type { ResourceFamily } from '../forms'
import { EVERYDAY_REFINED } from './everyday'
import { FIREARMS_REFINED } from './firearms'
import { GUN_PARTS_REFINED } from './gun-parts'
import { HAND_TOOLS_REFINED } from './hand-tools'
import { MELEE_REFINED } from './melee'
import { POWER_TOOLS_REFINED } from './power'
import { PROTECTIVE_REFINED } from './protective'
import { SCRAP_REFINED } from './scrap'

export const REFINED: ResourceFamily = {
  ...POWER_TOOLS_REFINED, ...PROTECTIVE_REFINED, ...HAND_TOOLS_REFINED, ...MELEE_REFINED,
  ...FIREARMS_REFINED, ...GUN_PARTS_REFINED, ...EVERYDAY_REFINED, ...SCRAP_REFINED,
}
