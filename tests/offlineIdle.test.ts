import "./memoryStorage";
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLICKER_TUNING, computeRunBurstMult } from "../src/game/clickerEconomy";

// Minimal browser surface for startIdleEngine (no Worker → setInterval fallback).
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => {};
g.document ??= { hidden: false, addEventListener: noop, removeEventListener: noop };
g.window ??= {
  addEventListener: noop,
  removeEventListener: noop,
  setInterval: () => 0,
  clearInterval: noop,
};

const { useGameStore } = await import("../src/state/store");
const { startIdleEngine, offlineGain, legacyArenaRate } = await import("../src/state/idleEngine");
const { computeTotalCps } = await import("../src/game/clickerEconomy");
const { GENERATORS } = await import("../src/data/generators");
const { globalIncomeMult } = await import("../src/game/prestige");

const HOUR = 3_600_000;

test("offlineGain: generators always, arena only with Auto-Run", () => {
  const r = { workshopCps: 10, arenaRatePerSec: 4, autoRun: false };
  assert.equal(offlineGain(r, HOUR), 36_000);
  assert.equal(offlineGain({ ...r, autoRun: true }, HOUR), 36_000 + 14_400);
  assert.equal(offlineGain(r, 0), 0);
  assert.equal(offlineGain(r, -5), 0);
  assert.equal(offlineGain({ workshopCps: 0, arenaRatePerSec: 4, autoRun: false }, HOUR), 0);
});

test("legacy saves recover the arena share without counting CPS twice", () => {
  assert.equal(legacyArenaRate(7, 100, 3), 7);
  assert.equal(legacyArenaRate(0, 12, 3), 9);
  assert.equal(legacyArenaRate(0, 2, 3), 0);
});

function seedAndLoad(autoRun: boolean) {
  const gens = { "wind-up-key": 20, counterweight: 5 };
  useGameStore.setState({
    momentum: 0,
    autoRun,
    generatorCounts: gens,
    clickUpgradeLevels: { "momentum-condenser": 1 }, // ×1.25 workshop
    prestigeCogs: 10,
    globalUpgrades: ["global-x2"],
    cachedTotalCps: 0, // stale on purpose: reconcile must recompute
    arenaIdleRatePerSec: 5,
    idleRatePerSec: 5,
    lastActiveAt: Date.now() - HOUR,
    lastIdleReport: null,
  });
  const expectedCps =
    computeTotalCps(gens, GENERATORS, 1.25) *
    globalIncomeMult({ prestigeCogs: 10, globalUpgrades: ["global-x2"] });
  const stop = startIdleEngine();
  stop();
  return expectedCps;
}

test("reload without Auto-Run credits workshop CPS (upgrades + Cogs + boosts) for the gap and toasts", () => {
  const cps = seedAndLoad(false);
  assert.ok(cps > 0);
  const s = useGameStore.getState();
  const expected = cps * 3600;
  assert.ok(Math.abs(s.momentum - expected) <= 2, `${s.momentum} vs ${expected}`);
  assert.ok(s.lastIdleReport && s.lastIdleReport.momentum === s.momentum);
  assert.ok(s.lastIdleReport!.ms >= HOUR);
  assert.ok(Math.abs(s.cachedTotalCps - cps) < 1e-9);
});

test("reload with Auto-Run adds the arena EMA on top, once", () => {
  const cps = seedAndLoad(true);
  const expected = (cps + 5) * 3600;
  assert.ok(Math.abs(useGameStore.getState().momentum - expected) <= 2);
});

test("run burst: x3 reached in 150-250 pumps", () => {
  const pumps = Math.ceil(CLICKER_TUNING.runChargeMax / CLICKER_TUNING.runChargePerClick);
  assert.ok(pumps >= 150 && pumps <= 250, `${pumps}`);
  assert.equal(computeRunBurstMult(pumps * CLICKER_TUNING.runChargePerClick), 3);
  const st = useGameStore;
  st.setState({ runCharge: 0, isRunning: false });
  for (let i = 0; i < pumps; i++) st.getState().cookiePump();
  assert.equal(st.getState().runCharge, CLICKER_TUNING.runChargeMax);
});
