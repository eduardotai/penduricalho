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

// ---------------------------------------------------------------------------
// Late-game bobs (Pulsar, Comet, Midas, Prism, Singularity). Pure helpers
// shared by GameCanvas and the headless income sim.
// ---------------------------------------------------------------------------

interface ZoneLike {
  zone: { id: string; position: { x: number; y: number }; radius: number; multiplier: number };
}

/** Zones whose circle overlaps a disc of `radius` around `at` (Pulsar shockwave). */
export function zonesInRadius<T extends ZoneLike>(zones: readonly T[], at: { x: number; y: number }, radius: number): T[] {
  return zones.filter((h) => Math.hypot(h.zone.position.x - at.x, h.zone.position.y - at.y) <= radius + h.zone.radius);
}

/** Up to `count` nearest other zones within `maxDist` of `from` (Prism arc chain). */
export function nearestZones<T extends ZoneLike>(
  zones: readonly T[],
  from: T,
  count: number,
  maxDist: number
): T[] {
  const p = from.zone.position;
  return zones
    .filter((h) => h !== from)
    .map((h) => ({ h, d: Math.hypot(h.zone.position.x - p.x, h.zone.position.y - p.y) }))
    .filter((e) => e.d <= maxDist)
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(0, count))
    .map((e) => e.h);
}

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

/** Comet: append the bob's position and drop points older than `trailMs`. */
export function pushTrail(trail: TrailPoint[], at: { x: number; y: number }, now: number, trailMs: number) {
  trail.push({ x: at.x, y: at.y, t: now });
  while (trail.length && now - trail[0].t > trailMs) trail.shift();
}

/** Zones touched by any trail point (each point is a circle of `radius`). */
export function zonesOnTrail<T extends ZoneLike>(zones: readonly T[], trail: readonly TrailPoint[], radius: number): T[] {
  if (!trail.length) return [];
  return zones.filter((h) =>
    trail.some((p) => Math.hypot(h.zone.position.x - p.x, h.zone.position.y - p.y) <= radius + h.zone.radius)
  );
}

/**
 * Midas: add one gild stack to a zone (each stack adds `gildStep` to its
 * multiplier, up to `maxGild` stacks). A relocated zone keeps its stacks'
 * worth only until it is popped: relocateZone rerolls the multiplier, and the
 * caller clears `gild` then. Returns true if a stack was added.
 */
export function gildZone(zone: { multiplier: number; gild?: number }, behavior: BobBehavior): boolean {
  const max = behavior.maxGild ?? 3;
  const cur = zone.gild ?? 0;
  if (cur >= max) return false;
  zone.gild = cur + 1;
  zone.multiplier = +(zone.multiplier + (behavior.gildStep ?? 1)).toFixed(2);
  return true;
}

/** Singularity: size multiplier after `hits` real hits this run. */
export function singularityScale(behavior: BobBehavior | undefined, hits: number): number {
  if (behavior?.kind !== "singularity") return 1;
  return 1 + Math.min(behavior.growthMax ?? 0.8, Math.max(0, hits) * (behavior.growthPerHit ?? 0.025));
}
