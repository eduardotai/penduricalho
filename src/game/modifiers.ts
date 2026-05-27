import type { ActiveModifier, ModifierEffects } from "../types";
import { MODIFIER_MAP } from "../data/modifiers";

export function isExpired(mod: ActiveModifier, now: number): boolean {
  return mod.expiresAt <= now;
}

export function getRemainingMs(mod: ActiveModifier, now: number): number {
  return Math.max(0, mod.expiresAt - now);
}

export function aggregateEffects(active: ActiveModifier[]): Required<ModifierEffects> {
  const eff: Required<ModifierEffects> = {
    twistPowerMult: 1,
    pointMult: 1,
    accelerationMult: 1,
    weightMult: 1,
  };
  for (const m of active) {
    const def = MODIFIER_MAP.get(m.defId);
    if (!def) continue;
    if (def.effects.twistPowerMult) eff.twistPowerMult *= def.effects.twistPowerMult;
    if (def.effects.pointMult) eff.pointMult *= def.effects.pointMult;
    if (def.effects.accelerationMult) eff.accelerationMult *= def.effects.accelerationMult;
    if (def.effects.weightMult) eff.weightMult *= def.effects.weightMult;
  }
  return eff;
}
