import "./memoryStorage";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOBAL_UPGRADES, globalUpgradeMult } from "../src/data/globalUpgrades";
import { getAchievementMomentumMult } from "../src/data/achievements";
import { globalIncomeMult, prestigeMult } from "../src/game/prestige";
import { computeClickGain } from "../src/game/clickerEconomy";
import { SAVE_VERSION, migrateSave, mergeSave, useGameStore } from "../src/state/store";

test("×2 then ×3, priced above the gear shop's 150K top", () => {
  const [x2, x3] = GLOBAL_UPGRADES;
  assert.equal(x2.mult, 2);
  assert.equal(x3.mult, 3);
  assert.equal(x3.requires, x2.id);
  assert.ok(x2.cost >= 1_000_000);
  assert.ok(x3.cost > x2.cost);
});

test("upgrade multipliers stack multiplicatively, ignore unknown/duplicate ids", () => {
  assert.equal(globalUpgradeMult([]), 1);
  assert.equal(globalUpgradeMult(undefined), 1);
  assert.equal(globalUpgradeMult(["global-x2"]), 2);
  assert.equal(globalUpgradeMult(["global-x2", "global-x3"]), 6);
  assert.equal(globalUpgradeMult(["global-x2", "global-x2", "bogus"]), 2);
});

test("global income = prestige × boosts; achievements stack on top in each source", () => {
  assert.equal(globalIncomeMult({ prestigeCogs: 10, globalUpgrades: ["global-x2", "global-x3"] }), 1.5 * 6);
  const input = {
    baseClickPower: 100,
    clickUpgradeExtraBase: 0,
    clickMult: 1,
    clickComboStacks: 0,
    achievementCount: 20,
    isRunning: false,
    arcSurgeActive: false,
    arcSurgeMult: 7,
  };
  const g = globalIncomeMult({ prestigeCogs: 10, globalUpgrades: ["global-x2", "global-x3"] });
  assert.equal(
    computeClickGain({ ...input, globalMult: g }),
    Math.floor(100 * getAchievementMomentumMult(20) * prestigeMult(10) * 6)
  );
});

function fresh(momentum: number) {
  useGameStore.getState().reset();
  useGameStore.setState({ momentum, generatorCounts: { counterweight: 10 } });
  useGameStore.getState().recomputeWorkshop();
}

test("buying: needs Momentum, needs ×2 before ×3, once each, and rescales CPS", () => {
  const [x2, x3] = GLOBAL_UPGRADES;
  fresh(x2.cost + x3.cost);
  const cps0 = useGameStore.getState().cachedTotalCps;
  assert.ok(cps0 > 0);
  assert.equal(useGameStore.getState().buyGlobalUpgrade(x3.id), false, "×3 locked before ×2");
  assert.equal(useGameStore.getState().buyGlobalUpgrade(x2.id), true);
  assert.equal(useGameStore.getState().buyGlobalUpgrade(x2.id), false, "no double buy");
  assert.ok(Math.abs(useGameStore.getState().cachedTotalCps - cps0 * 2) < 1e-9);
  assert.equal(useGameStore.getState().buyGlobalUpgrade(x3.id), true);
  assert.ok(Math.abs(useGameStore.getState().cachedTotalCps - cps0 * 6) < 1e-9);
  assert.equal(useGameStore.getState().momentum, 0);
  assert.deepEqual(useGameStore.getState().globalUpgrades, [x2.id, x3.id]);

  fresh(x2.cost - 1);
  assert.equal(useGameStore.getState().buyGlobalUpgrade(x2.id), false, "can't afford");
  assert.equal(useGameStore.getState().buyGlobalUpgrade("bogus"), false);
});

test("prestige resets boosts and the cogs bonus stacks with new ones", () => {
  const [x2] = GLOBAL_UPGRADES;
  fresh(x2.cost);
  useGameStore.getState().buyGlobalUpgrade(x2.id);
  useGameStore.setState({ stats: { ...useGameStore.getState().stats, totalMomentum: 10_000_000 } });
  assert.equal(useGameStore.getState().prestige(), 10);
  assert.deepEqual(useGameStore.getState().globalUpgrades, []);
  useGameStore.setState({ momentum: x2.cost, generatorCounts: { counterweight: 10 } });
  useGameStore.getState().recomputeWorkshop();
  const cpsPrestigeOnly = useGameStore.getState().cachedTotalCps;
  useGameStore.getState().buyGlobalUpgrade(x2.id);
  assert.ok(Math.abs(useGameStore.getState().cachedTotalCps - cpsPrestigeOnly * 2) < 1e-9);
  assert.equal(globalIncomeMult(useGameStore.getState()), 1.5 * 2);
});

test("v25 (and v23) saves migrate to v26 with no boosts; junk ids dropped", () => {
  const m25 = migrateSave({ momentum: 7, prestigeCogs: 4, audio: {} }, 25) as Record<string, unknown>;
  assert.deepEqual(m25.globalUpgrades, []);
  const merged = mergeSave(m25, useGameStore.getState());
  assert.equal(merged.prestigeCogs, 4);
  assert.deepEqual(merged.globalUpgrades, []);
  const m23 = migrateSave({ momentum: 7, audio: {} }, 23) as Record<string, unknown>;
  assert.deepEqual(m23.globalUpgrades, []);
  assert.equal(m23.prestigeCogs, 0);
  const junk = mergeSave({ globalUpgrades: ["global-x2", "nope", "global-x2", 5] }, useGameStore.getState());
  assert.deepEqual(junk.globalUpgrades, ["global-x2"]);
  assert.equal(SAVE_VERSION, 26);
});
