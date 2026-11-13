/**
 * Prestige ("Engrenagens" / Cogs): reset the run-to-run economy in exchange
 * for a permanent income multiplier. Pure formulas — the reset itself lives in
 * the store (`prestige` action).
 *
 * Total cogs ever earned = floor(sqrt(allTimeMomentum / unit)). Each reset
 * grants the difference between that and the cogs already held, so the sqrt
 * keeps later resets from snowballing.
 */
export const PRESTIGE_TUNING = {
  /** Momentum per "cog²": 100K → 1 cog, 1M → 3, 10M → 10, 100M → 31, 1B → 100. */
  unit: 100_000,
  /** All-time Momentum needed before the first reset is allowed. */
  minAllTimeMomentum: 1_000_000,
  /** Permanent income bonus per cog (additive): 10 cogs = ×1.5. */
  multPerCog: 0.05,
} as const;

export function totalCogsFor(allTimeMomentum: number): number {
  if (!(allTimeMomentum > 0)) return 0;
  return Math.floor(Math.sqrt(allTimeMomentum / PRESTIGE_TUNING.unit));
}

/** Cogs a reset would grant right now (never negative). */
export function prestigeGain(allTimeMomentum: number, cogsHeld: number): number {
  return Math.max(0, totalCogsFor(allTimeMomentum) - Math.max(0, cogsHeld));
}

export function canPrestige(allTimeMomentum: number, cogsHeld: number): boolean {
  return (
    allTimeMomentum >= PRESTIGE_TUNING.minAllTimeMomentum &&
    prestigeGain(allTimeMomentum, cogsHeld) >= 1
  );
}

/** Permanent income multiplier from held cogs. */
export function prestigeMult(cogs: number): number {
  return 1 + Math.max(0, cogs) * PRESTIGE_TUNING.multPerCog;
}

/** All-time Momentum (earned before previous resets + this cycle). */
export function allTimeMomentum(prestigeLifetimeMomentum: number, cycleMomentum: number): number {
  return Math.max(0, prestigeLifetimeMomentum) + Math.max(0, cycleMomentum);
}

/** All-time Momentum at which the total cogs earned reaches `n`. */
export function momentumForTotalCogs(n: number): number {
  return Math.max(0, n) ** 2 * PRESTIGE_TUNING.unit;
}

export interface IncomeMultInput {
  prestigeCogs: number;
}

/**
 * Global income multiplier applied to every Momentum source that scales
 * (zone hits, workshop clicks, generator CPS and so offline idle). Multiplies
 * with the achievement bonus, item levels and workshop multipliers.
 */
export function globalIncomeMult(s: IncomeMultInput): number {
  return prestigeMult(s.prestigeCogs);
}
