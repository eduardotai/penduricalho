import "./memoryStorage";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRESTIGE_TUNING,
  allTimeMomentum,
  canPrestige,
  globalIncomeMult,
  momentumForTotalCogs,
  prestigeGain,
  prestigeMult,
  totalCogsFor,
} from "../src/game/prestige";
import { computeClickGain } from "../src/game/clickerEconomy";
import { SAVE_VERSION, migrateSave, mergeSave, useGameStore } from "../src/state/store";

test("cogs follow floor(sqrt(allTime / 100K))", () => {
  assert.equal(totalCogsFor(0), 0);
  assert.equal(totalCogsFor(-5), 0);
  assert.equal(totalCogsFor(99_999), 0);
  assert.equal(totalCogsFor(100_000), 1);
  assert.equal(totalCogsFor(1_000_000), 3);
  assert.equal(totalCogsFor(10_000_000), 10);
  assert.equal(totalCogsFor(100_000_000), 31);
  assert.equal(totalCogsFor(1_000_000_000), 100);
  assert.equal(momentumForTotalCogs(4), 1_600_000);
  assert.equal(totalCogsFor(momentumForTotalCogs(4)), 4);
  assert.equal(totalCogsFor(momentumForTotalCogs(4) - 1), 3);
});

test("gain only counts cogs not already held; threshold is 1M all-time", () => {
  assert.equal(prestigeGain(10_000_000, 0), 10);
  assert.equal(prestigeGain(10_000_000, 7), 3);
  assert.equal(prestigeGain(10_000_000, 12), 0);
  assert.equal(canPrestige(999_999, 0), false, "below the 1M minimum");
  assert.equal(canPrestige(PRESTIGE_TUNING.minAllTimeMomentum, 0), true);
  assert.equal(canPrestige(10_000_000, 10), false, "nothing new to gain");
  assert.equal(allTimeMomentum(2_000_000, 500_000), 2_500_000);
});

test("multiplier is +5% per cog and feeds the global income multiplier", () => {
  assert.equal(prestigeMult(0), 1);
  assert.equal(prestigeMult(10), 1.5);
  assert.ok(Math.abs(prestigeMult(31) - 2.55) < 1e-9);
  assert.equal(globalIncomeMult({ prestigeCogs: 10 }), 1.5);
});

test("click gain scales with the global multiplier", () => {
  const base = {
    baseClickPower: 10,
    clickUpgradeExtraBase: 0,
    clickMult: 1,
    clickComboStacks: 0,
    achievementCount: 0,
    isRunning: false,
    arcSurgeActive: false,
    arcSurgeMult: 7,
  };
  assert.equal(computeClickGain({ ...base, globalMult: 1 }), 10);
  assert.equal(computeClickGain({ ...base, globalMult: 1.5 }), 15);
});

function seedCycle() {
  const st = useGameStore.getState();
  st.reset();
  useGameStore.setState({
    momentum: 2_000_000,
    stats: { ...useGameStore.getState().stats, totalMomentum: 4_000_000, totalHits: 900 },
    owned: { ...useGameStore.getState().owned, pendulums: [...useGameStore.getState().owned.pendulums, "nitro-bob"] },
    itemLevels: { "wooden-bob": 12 },
    generatorCounts: { "wind-up-key": 30 },
    clickUpgradeLevels: { "reinforced-finger": 2 },
    unlockedAchievements: { "first-arc": 1 },
    ownedThemes: ["classic", "watchmaker"],
    themeId: "watchmaker",
    language: "pt",
    bestRunMomentum: 5_000,
    totalRuns: 40,
  });
  useGameStore.getState().recomputeWorkshop();
}

test("prestige resets the economy, keeps the meta, and grants cogs", () => {
  seedCycle();
  const before = useGameStore.getState();
  const worldVersion = before.worldVersion;
  const gained = useGameStore.getState().prestige();
  assert.equal(gained, 6, "sqrt(4M/100K) = 6.32 → 6");
  const s = useGameStore.getState();
  // persists
  assert.equal(s.prestigeCogs, 6);
  assert.equal(s.prestigeCount, 1);
  assert.equal(s.prestigeLifetimeMomentum, 4_000_000);
  const achBefore = Object.keys(before.unlockedAchievements);
  assert.ok(achBefore.includes("first-arc"));
  for (const id of achBefore) assert.ok(id in s.unlockedAchievements, `kept ${id}`);
  assert.deepEqual(s.ownedThemes, ["classic", "watchmaker"]);
  assert.equal(s.themeId, "watchmaker");
  assert.equal(s.language, "pt");
  assert.equal(s.bestRunMomentum, 5_000);
  assert.equal(s.totalRuns, 40);
  // resets
  assert.equal(s.momentum, 0);
  assert.equal(s.stats.totalMomentum, 0);
  assert.ok(!s.owned.pendulums.includes("nitro-bob"));
  assert.deepEqual(s.itemLevels, {});
  assert.deepEqual(s.generatorCounts, {});
  assert.deepEqual(s.clickUpgradeLevels, {});
  assert.equal(s.cachedTotalCps, 0);
  assert.equal(s.worldVersion, worldVersion + 1);
});

test("a second prestige needs new cogs; all-time momentum carries over", () => {
  seedCycle();
  useGameStore.getState().prestige(); // 6 cogs at 4M
  assert.equal(useGameStore.getState().prestige(), 0, "nothing earned since");
  useGameStore.setState({
    stats: { ...useGameStore.getState().stats, totalMomentum: 5_000_000 },
  });
  // all-time 9M → 9 total cogs, 6 held → +3
  assert.equal(useGameStore.getState().prestige(), 3);
  assert.equal(useGameStore.getState().prestigeCogs, 9);
  assert.equal(useGameStore.getState().prestigeLifetimeMomentum, 9_000_000);
});

test("prestige is refused below the threshold or during a run", () => {
  useGameStore.getState().reset();
  useGameStore.setState({ stats: { ...useGameStore.getState().stats, totalMomentum: 900_000 }, momentum: 900_000 });
  assert.equal(useGameStore.getState().prestige(), 0);
  assert.equal(useGameStore.getState().momentum, 900_000);
  useGameStore.setState({ stats: { ...useGameStore.getState().stats, totalMomentum: 2_000_000 }, isRunning: true });
  assert.equal(useGameStore.getState().prestige(), 0);
  useGameStore.setState({ isRunning: false });
});

test("prestige multiplies generator CPS", () => {
  seedCycle();
  const cpsBefore = useGameStore.getState().cachedTotalCps;
  assert.ok(cpsBefore > 0);
  useGameStore.setState({ prestigeCogs: 10 });
  useGameStore.getState().recomputeWorkshop();
  assert.ok(Math.abs(useGameStore.getState().cachedTotalCps - cpsBefore * 1.5) < 1e-9);
});

test("v23 and v24 saves migrate to v25 with zeroed prestige fields", () => {
  const v23 = { momentum: 50, stats: { totalMomentum: 3_000_000 }, audio: {} };
  for (const [save, ver] of [
    [v23, 23],
    [{ ...v23, ownedThemes: ["classic", "neon"], themeId: "neon" }, 24],
  ] as const) {
    const m = migrateSave(structuredClone(save), ver) as Record<string, unknown>;
    assert.equal(m.prestigeCogs, 0);
    assert.equal(m.prestigeCount, 0);
    assert.equal(m.prestigeLifetimeMomentum, 0);
    const merged = mergeSave(m, useGameStore.getState());
    assert.equal(merged.momentum, 50);
    assert.equal(merged.prestigeCogs, 0);
    // The old save's lifetime Momentum counts toward the first prestige.
    assert.equal(allTimeMomentum(merged.prestigeLifetimeMomentum, merged.stats.totalMomentum), 3_000_000);
    if (ver === 24) assert.equal(merged.themeId, "neon");
  }
  // Garbage values are sanitized.
  const bad = migrateSave({ prestigeCogs: -3, prestigeCount: "x", prestigeLifetimeMomentum: NaN }, 24) as Record<string, unknown>;
  assert.equal(bad.prestigeCogs, 0);
  assert.equal(bad.prestigeCount, 0);
  assert.equal(bad.prestigeLifetimeMomentum, 0);
  assert.equal(SAVE_VERSION, 25);
});
