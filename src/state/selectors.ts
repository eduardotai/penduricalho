import { useGameStore } from "./store";
import type { ModifierEffects } from "../types";
import { MODIFIER_MAP } from "../data/modifiers";
import { PENDULUM_MAP } from "../data/pendulums";
import { ATTACHMENT_MAP } from "../data/attachments";
import { SITE_MAP } from "../data/sites";
import { STARTER_SKIN_ID, SKIN_MAP, BOB_SKINS } from "../data/bobSkins";
import { STARTER_SHAPE_ID, SHAPE_MAP, BOB_SHAPES } from "../data/bobShapes";

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

export function useEquippedSkin() {
  const id = useGameStore((s) => s.equipped.skinId);
  return SKIN_MAP.get(id) ?? SKIN_MAP.get(STARTER_SKIN_ID) ?? BOB_SKINS[0];
}

export function useEquippedShape() {
  const id = useGameStore((s) => s.equipped.shapeId);
  return SHAPE_MAP.get(id) ?? SHAPE_MAP.get(STARTER_SHAPE_ID) ?? BOB_SHAPES[0];
}

export function aggregateModifierEffects(
  activeModifierIds: { defId: string; expiresAt: number }[]
): Required<ModifierEffects> {
  const eff: Required<ModifierEffects> = {
    twistPowerMult: 1,
    pointMult: 1,
    accelerationMult: 1,
    weightMult: 1,
    bobSizeMult: 1,
    ropeLengthMult: 1,
    echoCount: 0,
    velocityGrowthPerSec: 0,
  };
  for (const m of activeModifierIds) {
    const def = MODIFIER_MAP.get(m.defId);
    if (!def) continue;
    if (def.effects.twistPowerMult) eff.twistPowerMult *= def.effects.twistPowerMult;
    if (def.effects.pointMult) eff.pointMult *= def.effects.pointMult;
    if (def.effects.accelerationMult) eff.accelerationMult *= def.effects.accelerationMult;
    if (def.effects.weightMult) eff.weightMult *= def.effects.weightMult;
    if (def.effects.bobSizeMult) eff.bobSizeMult *= def.effects.bobSizeMult;
    if (def.effects.ropeLengthMult) eff.ropeLengthMult *= def.effects.ropeLengthMult;
    if (def.effects.echoCount) eff.echoCount = Math.max(eff.echoCount, def.effects.echoCount);
    if (def.effects.velocityGrowthPerSec) {
      eff.velocityGrowthPerSec = Math.max(
        eff.velocityGrowthPerSec,
        def.effects.velocityGrowthPerSec
      );
    }
  }
  return eff;
}
