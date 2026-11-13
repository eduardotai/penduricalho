import "./memoryStorage";
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateEffects } from "../src/game/modifiers";
import { MODIFIER_MAP } from "../src/data/modifiers";
import { PENDULUM_MAP } from "../src/data/pendulums";
import { simulateRun } from "./support/incomeSim";

const { useGameStore, COMBO_DECAY_MS, conflictingModifierIds } = await import("../src/state/store");

const fx = (...ids: string[]) => aggregateEffects(ids.map((defId) => ({ defId, expiresAt: 1e12 })));

test("new effect channels default to no-ops", () => {
  const e = fx();
  assert.equal(e.comboWindowMult, 1);
  assert.equal(e.dropChanceMult, 1);
  assert.equal(e.durabilityDrainMult, 1);
  assert.equal(e.orbPullStrength, 0);
});

test("wave-2 modifiers set their channels and combine sanely", () => {
  assert.equal(fx("combo-lock").comboWindowMult, 4);
  assert.equal(fx("lucky-charm").dropChanceMult, 2.5);
  assert.equal(fx("rope-guard").durabilityDrainMult, 0);
  const glass = fx("glass-cannon");
  assert.equal(glass.pointMult, 2.5);
  assert.equal(glass.durabilityDrainMult, 4);
  // Rope Guard cancels Glass Cannon's wear but keeps its points.
  const both = fx("glass-cannon", "rope-guard");
  assert.equal(both.durabilityDrainMult, 0);
  assert.equal(both.pointMult, 2.5);
  assert.equal(fx("moon-gravity").accelerationMult, 0.55);
  assert.equal(fx("orb-magnet").orbPullStrength, 1.6);
  assert.ok(MODIFIER_MAP.get("glass-cannon")!.risky);
});

test("Heavy Air and Moon Gravity replace each other instead of cancelling", () => {
  assert.deepEqual(conflictingModifierIds("moon-gravity"), ["heavy-air"]);
  const s = useGameStore.getState();
  s.pushModifier("heavy-air", 0);
  s.pushModifier("moon-gravity", 10);
  const ids = useGameStore.getState().activeModifiers.map((m) => m.defId);
  assert.ok(ids.includes("moon-gravity") && !ids.includes("heavy-air"), ids.join());
});

test("registerHit keeps the combo alive inside a widened Combo Lock window", () => {
  const gap = COMBO_DECAY_MS + 500;
  useGameStore.setState({ combo: { count: 0, lastHitAt: -1e9 } });
  const s = useGameStore.getState();
  s.registerHit(10, 1000);
  s.registerHit(10, 1000 + gap); // default window: chain broken
  assert.equal(useGameStore.getState().combo.count, 1);
  s.registerHit(10, 1000 + 2 * gap, COMBO_DECAY_MS * 4); // Combo Lock: chain holds
  assert.equal(useGameStore.getState().combo.count, 2);
});

test("sim: Glass Cannon snaps a mid rig early, Rope Guard keeps a heavy rig strung", () => {
  const iron = PENDULUM_MAP.get("iron-bob")!;
  const tung = PENDULUM_MAP.get("tungsten-heavy")!;
  const seeds = [1000, 8919, 16838];
  const snaps = (p: typeof iron, mods: object) =>
    seeds.filter((sd) => simulateRun(p, "hemp-rope", "workshop", sd, {}, "launch", {}, mods).snapped).length;
  assert.equal(snaps(iron, {}), 0);
  assert.equal(snaps(iron, MODIFIER_MAP.get("glass-cannon")!.effects), seeds.length);
  assert.equal(snaps(tung, {}), seeds.length);
  assert.equal(snaps(tung, MODIFIER_MAP.get("rope-guard")!.effects), 0);
});
