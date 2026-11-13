import { test } from "node:test";
import assert from "node:assert/strict";
import { incomeBreakdown, scaleFlatBonus, globalIncomeMult } from "../src/game/prestige";

// Decision: flat Momentum bonuses (wall break 70, combo milestones,
// maneuvers) scale with Prestige Cogs × global boosts, like hits do.
test("flat bonuses are untouched with no Cogs and no boosts", () => {
  assert.equal(scaleFlatBonus(70, { prestigeCogs: 0, globalUpgrades: [] }), 70);
  assert.equal(scaleFlatBonus(25, { prestigeCogs: 0 }), 25);
});

test("flat bonuses scale with Cogs and ×2/×3 boosts", () => {
  // 10 cogs = ×1.5, ×2 ×3 = ×6 → ×9
  const s = { prestigeCogs: 10, globalUpgrades: ["global-x2", "global-x3"] };
  assert.equal(globalIncomeMult(s), 9);
  assert.equal(scaleFlatBonus(70, s), 630);
  assert.equal(scaleFlatBonus(5, { prestigeCogs: 1 }), 5); // 5.25 rounds to 5
  assert.equal(scaleFlatBonus(70, { prestigeCogs: 1 }), 74); // 73.5 → 74
});

test("income breakdown multiplies prestige, boosts and achievements", () => {
  const b = incomeBreakdown({ prestigeCogs: 4, globalUpgrades: ["global-x2"], achievementMult: 1.1 });
  assert.equal(b.prestige, 1.2);
  assert.equal(b.boosts, 2);
  assert.equal(b.achievements, 1.1);
  assert.ok(Math.abs(b.total - 2.64) < 1e-9);
});
