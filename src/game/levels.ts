// ---------------------------------------------------------------------------
// Per-item leveling (Cookie Clicker–style grind loop)
//
// Every owned bob and rope can be leveled up repeatedly with Momentum. Each
// level grants a small permanent score multiplier for that item *when
// equipped*, with bonus ×2 jumps at the milestone levels (10 / 50 / 100).
//
// This module is the single source of truth for the cost curve and the bonus
// math, so the store (spend), the canvas (scoring), and the shop UI all agree.
// All tuning lives here — balancing is a one-line edit. Mirrors the pure
// `getAchievementMomentumMult` helper in data/achievements.ts.
// ---------------------------------------------------------------------------

/** Levels at which the item earns an extra ×2 score jump. */
export const LEVEL_MILESTONES = [10, 50, 100] as const;

/** Linear score gain per level (+2% each). */
const PER_LEVEL = 0.02;
/** Extra multiplier granted at each milestone reached (compounds). */
const MILESTONE_MULT = 2;
/** Exponential cost growth per level (classic idle-game curve). */
const COST_GROWTH = 1.15;
/** Floor for the first level-up price, so cost-0 starter gear is still levelable. */
const COST_FLOOR = 50;

/**
 * Base price of the *first* level-up for an item, anchored on its purchase
 * cost (10%) and floored so the free starter bob/rope can still be leveled.
 */
export function levelBaseCost(purchaseCost: number): number {
  return Math.max(COST_FLOOR, Math.round(purchaseCost * 0.1));
}

/**
 * Momentum cost to buy the upgrade that takes the item from `currentLevel` to
 * `currentLevel + 1`. Grows exponentially: base × GROWTH^level.
 */
export function levelUpCost(purchaseCost: number, currentLevel: number): number {
  const base = levelBaseCost(purchaseCost);
  return Math.round(base * Math.pow(COST_GROWTH, Math.max(0, currentLevel)));
}

/**
 * Total Momentum to buy `count` levels at once, starting from `currentLevel`.
 * Sums the individual (rounded) per-level prices so it always matches the cost
 * of buying the same levels one click at a time. `count` is small (≤100).
 */
export function bulkLevelUpCost(
  purchaseCost: number,
  currentLevel: number,
  count: number
): number {
  const steps = Math.max(1, Math.floor(count));
  let total = 0;
  for (let i = 0; i < steps; i++) {
    total += levelUpCost(purchaseCost, currentLevel + i);
  }
  return total;
}

/** How many milestones a given level has reached (0..LEVEL_MILESTONES.length). */
export function milestonesReached(level: number): number {
  let count = 0;
  for (const m of LEVEL_MILESTONES) if (level >= m) count += 1;
  return count;
}

/**
 * Score multiplier an item contributes at the given level. Combines the linear
 * per-level gain with the compounding milestone bonuses. Level 0 → 1.0.
 */
export function itemScoreMult(level: number): number {
  const lvl = Math.max(0, level);
  const linear = 1 + PER_LEVEL * lvl;
  return linear * Math.pow(MILESTONE_MULT, milestonesReached(lvl));
}

/** The next milestone level above `level`, or null if all are reached. */
export function nextMilestone(level: number): number | null {
  for (const m of LEVEL_MILESTONES) if (level < m) return m;
  return null;
}
