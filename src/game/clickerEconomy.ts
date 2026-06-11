// ---------------------------------------------------------------------------
// Workshop / clicker economy (Path A — Pendulum Cookie)
// Single source of truth for click gain, generator CPS, costs, and run burst.
// ---------------------------------------------------------------------------

import type { ClickUpgradeEffect, Stats, UnlockGate } from "../types";
import { getAchievementMomentumMult } from "../data/achievements";

export const CLICKER_TUNING = {
  baseClickPowerDefault: 1,
  clickComboMax: 100,
  clickComboDecayMs: 800,
  clickComboBonusPerStack: 0.01,
  runChargePerClick: 0.05,
  runChargeMax: 100,
  runBurstMaxMult: 2,
  clickDuringRunFactor: 0.75,
  arcSurgeDurationMs: 10_000,
  arcSurgeMult: 7,
  arcSurgeMinIntervalMs: 60_000,
  arcSurgeMaxIntervalMs: 180_000,
  workshopCpsLogFactor: 0.1,
} as const;

export function generatorCost(baseCost: number, costMult: number, owned: number): number {
  return Math.floor(baseCost * Math.pow(costMult, Math.max(0, owned)));
}

export function clickUpgradeCost(baseCost: number, costMult: number, level: number): number {
  return Math.floor(baseCost * Math.pow(costMult, Math.max(0, level)));
}

export function generatorCps(
  baseCps: number,
  owned: number,
  growth = 1.15
): number {
  if (owned <= 0) return 0;
  return baseCps * Math.pow(growth, owned);
}

export function clickUpgradeMultFromLevels(
  levels: Record<string, number>,
  effects: Record<string, ClickUpgradeEffect>
): { clickMult: number; workshopMult: number; extraBaseClick: number } {
  let clickMult = 1;
  let workshopMult = 1;
  let extraBaseClick = 0;
  for (const [id, level] of Object.entries(levels)) {
    if (level <= 0) continue;
    const effect = effects[id];
    if (!effect) continue;
    switch (effect.kind) {
      case "addBaseClick":
        extraBaseClick += effect.amount * level;
        break;
      case "multClick":
        clickMult *= Math.pow(effect.factor, level);
        break;
      case "multAllWorkshop":
        workshopMult *= Math.pow(effect.factor, level);
        break;
      case "cpsPerClickLevel":
        break;
    }
  }
  return { clickMult, workshopMult, extraBaseClick };
}

export function computeTotalCps(
  generatorCounts: Record<string, number>,
  generators: readonly { id: string; baseCps: number }[],
  workshopMult: number
): number {
  let total = 0;
  for (const g of generators) {
    const n = generatorCounts[g.id] ?? 0;
    if (n > 0) total += generatorCps(g.baseCps, n);
  }
  return total * workshopMult;
}

export function workshopSynergyMult(totalCps: number): number {
  if (totalCps <= 0) return 1;
  return 1 + Math.log10(1 + totalCps) * CLICKER_TUNING.workshopCpsLogFactor;
}

export function computeRunBurstMult(runCharge: number): number {
  const t = Math.min(CLICKER_TUNING.runChargeMax, Math.max(0, runCharge));
  const frac = t / CLICKER_TUNING.runChargeMax;
  return 1 + frac * CLICKER_TUNING.runBurstMaxMult;
}

export interface ClickGainInput {
  baseClickPower: number;
  clickUpgradeExtraBase: number;
  clickMult: number;
  clickComboStacks: number;
  achievementCount: number;
  isRunning: boolean;
  arcSurgeActive: boolean;
  arcSurgeMult: number;
}

export function computeClickGain(input: ClickGainInput): number {
  const comboBonus =
    1 +
    Math.min(CLICKER_TUNING.clickComboMax, input.clickComboStacks) *
      CLICKER_TUNING.clickComboBonusPerStack;
  const ach = getAchievementMomentumMult(input.achievementCount);
  const surge = input.arcSurgeActive ? input.arcSurgeMult : 1;
  const runFactor = input.isRunning ? CLICKER_TUNING.clickDuringRunFactor : 1;
  const raw =
    (input.baseClickPower + input.clickUpgradeExtraBase) *
    input.clickMult *
    comboBonus *
    ach *
    surge *
    runFactor;
  return Math.max(1, Math.floor(raw));
}

export function nextArcSurgeAt(now: number, lastProcAt: number): number {
  const span =
    CLICKER_TUNING.arcSurgeMaxIntervalMs - CLICKER_TUNING.arcSurgeMinIntervalMs;
  const wait =
    CLICKER_TUNING.arcSurgeMinIntervalMs + Math.floor(Math.random() * (span + 1));
  return (lastProcAt > 0 ? lastProcAt : now) + wait;
}

export function isArcSurgeActive(until: number, now: number): boolean {
  return until > now;
}

export function meetsUnlock(gate: UnlockGate | undefined, stats: Stats): boolean {
  if (!gate) return true;
  const v = stats[gate.stat];
  return typeof v === "number" && v >= gate.gte;
}