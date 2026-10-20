import { HIDDEN, LOD_FADE_SECONDS, fadeIn, fadeOut } from '../lod-fade'

export const MASSING = -1
type Transition = { from: number; to: number; t: number }

export class LodFader {

  private readonly settled = new Map<number, number>()
  private readonly transitions = new Map<number, Transition>()

  readonly models = new Map<number, number>()

  readonly massing = new Map<number, number>()
  version = 0

  constructor(private readonly seconds = LOD_FADE_SECONDS) {}

  update(shown: Map<number, number>, dt: number) {
    const step = dt / this.seconds
    let changed = false
    const seeds = new Set<number>([...shown.keys(), ...this.settled.keys(), ...this.transitions.keys()])
    for (const seed of seeds) {
      const target = shown.get(seed) ?? MASSING
      const transition = this.transitions.get(seed)
      if (transition) {
        changed = true
        if (transition.to !== target) {

          if (transition.from === target) this.transitions.set(seed, { from: transition.to, to: target, t: 1 - transition.t })
          else this.transitions.set(seed, { from: transition.t < 0.5 ? transition.from : transition.to, to: target, t: 0 })
          continue
        }
        transition.t += step
        if (transition.t >= 1) {
          this.transitions.delete(seed)
          if (target === MASSING) this.settled.delete(seed)
          else this.settled.set(seed, target)
        }
        continue
      }
      const current = this.settled.get(seed) ?? MASSING
      if (current !== target) { this.transitions.set(seed, { from: current, to: target, t: 0 }); changed = true }
    }
    if (!changed) return false
    this.models.clear(); this.massing.clear()
    for (const [seed, key] of this.settled) {
      if (this.transitions.has(seed)) continue
      this.models.set(key, 1)
      this.massing.set(seed, HIDDEN)
    }
    for (const [seed, { from, to, t }] of this.transitions) {
      const put = (level: number, code: number) => { if (level === MASSING) this.massing.set(seed, code); else this.models.set(level, code) }
      put(from, fadeOut(t))
      put(to, fadeIn(t))
      if (from !== MASSING && to !== MASSING) this.massing.set(seed, HIDDEN)
    }
    this.version++
    return true
  }

  keys() { return this.models.keys() }
}
