import type { BobBehavior } from "../types";

/**
 * Pure stat math for the combo- and churn-driven bobs, shared by GameCanvas
 * and the headless income simulation (tests/support/incomeSim.ts) so the
 * balance numbers measure exactly what the game runs.
 */

/** Frenzy: combo stacks → swing-speed and bob-size multipliers (1,1 for other bobs). */
export function frenzyMultipliers(
  behavior: BobBehavior | undefined,
  comboCount: number
): { speed: number; size: number } {
  if (behavior?.kind !== "frenzy") return { speed: 1, size: 1 };
  const stacks = Math.max(0, Math.min(comboCount, behavior.maxComboStacks ?? 20));
  return {
    speed: 1 + stacks * (behavior.comboSpeedPerStack ?? 0.015),
    size: 1 + stacks * (behavior.comboSizePerStack ?? 0.015),
  };
}

export interface ChaosBounds {
  minRadius: number;
  maxRadius: number;
  minWeight: number;
  maxWeight: number;
  minAngVel: number;
  maxAngVel: number;
}

export interface ChaosStats {
  size: number;
  weight: number;
  cap: number;
  rope: number;
}

/** Roster-wide stat extremes that bound the Chaos Bob's churn. */
export function chaosBounds(
  roster: { bobRadius: number; weight: number; maxAngularVelocity: number }[]
): ChaosBounds {
  const r = roster.map((p) => p.bobRadius);
  const w = roster.map((p) => p.weight);
  const a = roster.map((p) => p.maxAngularVelocity);
  return {
    minRadius: Math.min(...r),
    maxRadius: Math.max(...r),
    minWeight: Math.min(...w),
    maxWeight: Math.max(...w),
    minAngVel: Math.min(...a),
    maxAngVel: Math.max(...a),
  };
}

/** Fresh random churn targets relative to the Chaos Bob's own base stats. */
export function rollChaosTargets(
  bounds: ChaosBounds,
  base: { radius: number; weight: number; angVel: number },
  random: () => number = Math.random
): ChaosStats {
  const rand = (lo: number, hi: number) => lo + random() * (hi - lo);
  return {
    size: rand(bounds.minRadius, bounds.maxRadius) / base.radius,
    weight: rand(bounds.minWeight, bounds.maxWeight) / base.weight,
    cap: rand(bounds.minAngVel, bounds.maxAngVel) / base.angVel,
    rope: rand(0.6, 1.5),
  };
}

/** Blend the live churn toward its targets (frame-rate independent). */
export function lerpChaos(cur: ChaosStats, target: ChaosStats, lerpRate: number, dtMs: number): ChaosStats {
  const a = 1 - Math.exp(-lerpRate * (dtMs / 1000));
  return {
    size: cur.size + (target.size - cur.size) * a,
    weight: cur.weight + (target.weight - cur.weight) * a,
    cap: cur.cap + (target.cap - cur.cap) * a,
    rope: cur.rope + (target.rope - cur.rope) * a,
  };
}
