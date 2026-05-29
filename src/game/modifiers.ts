import type { ActiveModifier, ModifierEffects, PersistentBonus } from "../types";
import { MODIFIER_MAP } from "../data/modifiers";

export function isExpired(mod: ActiveModifier, now: number): boolean {
  return mod.expiresAt <= now;
}

export function getRemainingMs(mod: ActiveModifier, now: number): number {
  return Math.max(0, mod.expiresAt - now);
}

export function getPersistentRemainingMs(
  bonus: PersistentBonus,
  now: number
): number {
  return Math.max(0, bonus.expiresAt - now);
}

export function isPersistentExpired(bonus: PersistentBonus, now: number): boolean {
  return bonus.expiresAt <= now;
}

/** Sum remaining ms across all live persistent layers for one modifier defId. */
export function sumPersistentRemainingMs(
  bonuses: PersistentBonus[],
  defId: string,
  now: number
): number {
  return bonuses
    .filter((b) => b.defId === defId)
    .reduce((sum, b) => sum + getPersistentRemainingMs(b, now), 0);
}

export function cappedAdditiveDuration(
  currentRemainingMs: number,
  addMs: number,
  maxMs: number
): number {
  if (addMs <= 0 || maxMs <= 0) return 0;
  return Math.min(maxMs, currentRemainingMs + addMs);
}

function applyDefEffects(
  eff: Required<ModifierEffects>,
  effects: ModifierEffects,
  opts: { includeEcho?: boolean; includeSpeedRamp?: boolean } = {}
) {
  const includeEcho = opts.includeEcho !== false;
  const includeSpeedRamp = opts.includeSpeedRamp !== false;
  if (effects.twistPowerMult) eff.twistPowerMult *= effects.twistPowerMult;
  if (effects.pointMult) eff.pointMult *= effects.pointMult;
  if (effects.accelerationMult) eff.accelerationMult *= effects.accelerationMult;
  if (effects.weightMult) eff.weightMult *= effects.weightMult;
  if (effects.bobSizeMult) eff.bobSizeMult *= effects.bobSizeMult;
  if (effects.ropeLengthMult) eff.ropeLengthMult *= effects.ropeLengthMult;
  if (includeEcho && effects.echoCount) {
    eff.echoCount = Math.max(eff.echoCount, effects.echoCount);
  }
  if (includeSpeedRamp && effects.velocityGrowthPerSec) {
    eff.velocityGrowthPerSec = Math.max(
      eff.velocityGrowthPerSec,
      effects.velocityGrowthPerSec
    );
  }
}

export function aggregateEffects(
  active: ActiveModifier[],
  persistentBonuses: PersistentBonus[] = []
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
  // Apply each modifier's effects exactly once per defId. Active and persistent
  // layers only govern *how long* a buff lasts — they must not re-multiply its
  // magnitude, otherwise the same buff compounds with itself (e.g. an active
  // Giant Bob plus its persistent layer would square the size multiplier).
  const inActive = new Set<string>();
  for (const m of active) {
    if (MODIFIER_MAP.has(m.defId)) inActive.add(m.defId);
  }
  const seen = new Set<string>(inActive);
  for (const b of persistentBonuses) {
    if (MODIFIER_MAP.has(b.defId)) seen.add(b.defId);
  }
  for (const defId of seen) {
    const def = MODIFIER_MAP.get(defId);
    if (!def) continue;
    // Echo bobs and speed ramp are strictly timed — a persistent-only layer
    // (no live active window) must not keep them alive across runs.
    const live = inActive.has(defId);
    applyDefEffects(eff, def.effects, {
      includeEcho: live,
      includeSpeedRamp: live,
    });
  }
  return eff;
}

/** Linear speed boost for the active Speed Ramp window (no compounding). */
export function getSpeedRampMultiplier(
  active: ActiveModifier[],
  now: number
): number {
  const mod = active.find((m) => m.defId === "speed-ramp");
  if (!mod) return 1;
  const def = MODIFIER_MAP.get("speed-ramp");
  if (!def?.effects.velocityGrowthPerSec) return 1;
  const elapsed = def.durationMs - getRemainingMs(mod, now);
  const progress = Math.max(0, Math.min(1, elapsed / def.durationMs));
  const maxBoost = Math.min(
    0.4,
    def.effects.velocityGrowthPerSec * (def.durationMs / 1000)
  );
  return 1 + maxBoost * progress;
}
