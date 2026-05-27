import { useGameStore } from "./store";
import type { ModifierEffects } from "../types";
import { MODIFIER_MAP } from "../data/modifiers";
import { PENDULUM_MAP } from "../data/pendulums";
import { ATTACHMENT_MAP } from "../data/attachments";
import { SITE_MAP } from "../data/sites";

export function useEquippedPendulum() {
  const id = useGameStore((s) => s.equipped.pendulumId);
  return PENDULUM_MAP.get(id)!;
}

export function useEquippedAttachment() {
  const id = useGameStore((s) => s.equipped.attachmentId);
  return ATTACHMENT_MAP.get(id)!;
}

export function useEquippedSite() {
  const id = useGameStore((s) => s.equipped.siteId);
  return SITE_MAP.get(id)!;
}

export function aggregateModifierEffects(
  activeModifierIds: { defId: string; expiresAt: number }[]
): Required<ModifierEffects> {
  const eff: Required<ModifierEffects> = {
    twistPowerMult: 1,
    pointMult: 1,
    accelerationMult: 1,
    weightMult: 1,
  };
  for (const m of activeModifierIds) {
    const def = MODIFIER_MAP.get(m.defId);
    if (!def) continue;
    if (def.effects.twistPowerMult) eff.twistPowerMult *= def.effects.twistPowerMult;
    if (def.effects.pointMult) eff.pointMult *= def.effects.pointMult;
    if (def.effects.accelerationMult) eff.accelerationMult *= def.effects.accelerationMult;
    if (def.effects.weightMult) eff.weightMult *= def.effects.weightMult;
  }
  return eff;
}
