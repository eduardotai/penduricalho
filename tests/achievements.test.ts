import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENT_MAP,
  evaluateAchievement,
  getAchievementMomentumMult,
  getAllAchievementProgress,
} from "../src/data/achievements";

const baseSnapshot = () => ({
  stats: { totalMomentum: 0, bestCombo: 0 } as any,
  owned: { pendulums: ["wooden-bob"], attachments: ["hemp-rope"], sites: ["workshop"], skins: [], shapes: [] } as any,
  totalGoldenSpent: 0,
  blackHoleCaptures: 0,
  totalRuns: 0,
  bestRunMomentum: 0,
  totalGoldenTokens: 0,
  cachedTotalCps: 0,
  totalArcSurges: 0,
  unlocked: {} as Record<string, number>,
});

test("First Arc unlocks once its requirement is met (100% means unlocked)", () => {
  const def = ACHIEVEMENT_MAP.get("first-arc")!;
  const snap = baseSnapshot();
  snap.stats.totalMomentum = 155;
  const p = evaluateAchievement(def, snap);
  assert.equal(p.percent, 1);
  assert.equal(p.unlocked, true);
});

test("below target stays locked", () => {
  const snap = baseSnapshot();
  snap.stats.totalMomentum = 99;
  const p = evaluateAchievement(ACHIEVEMENT_MAP.get("first-arc")!, snap);
  assert.equal(p.unlocked, false);
  assert.ok(p.percent < 1);
});

test("previously unlocked stays unlocked even if stats are lower", () => {
  const snap = baseSnapshot();
  snap.unlocked = { "first-arc": 1 };
  assert.equal(evaluateAchievement(ACHIEVEMENT_MAP.get("first-arc")!, snap).unlocked, true);
});

test("every achievement at 100% reports unlocked (no 100%-but-locked states)", () => {
  const snap = baseSnapshot();
  snap.stats.totalMomentum = 155;
  snap.totalRuns = 1;
  const all = getAllAchievementProgress(snap);
  for (const [id, p] of Object.entries(all)) {
    if (p.percent >= 1) assert.equal(p.unlocked, true, id);
  }
  assert.equal(all["first-arc"].unlocked, true);
});

test("momentum bonus grows with unlocked count and caps at 12%", () => {
  assert.equal(getAchievementMomentumMult(0), 1);
  assert.ok(Math.abs(getAchievementMomentumMult(2) - 1.005) < 1e-9);
  assert.equal(getAchievementMomentumMult(1000), 1.12);
});
