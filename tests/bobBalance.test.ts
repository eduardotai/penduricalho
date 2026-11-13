import { test } from "node:test";
import assert from "node:assert/strict";
import { chaosBounds, frenzyMultipliers, lerpChaos, rollChaosTargets } from "../src/game/bobBehaviors";
import { PENDULUM_MAP, PENDULUMS } from "../src/data/pendulums";
import { incomeTable } from "./support/incomeSim";

test("frenzy multipliers ramp with the combo and stop at the stack cap", () => {
  const b = PENDULUM_MAP.get("frenzy-bob")!.behavior;
  assert.deepEqual(frenzyMultipliers(b, 0), { speed: 1, size: 1 });
  const cap = b!.maxComboStacks!;
  const full = frenzyMultipliers(b, cap);
  assert.ok(full.speed > 1.5 && full.size >= 2 - 1e-9, JSON.stringify(full));
  assert.deepEqual(frenzyMultipliers(b, cap + 50), full);
  // Other bobs are untouched.
  assert.deepEqual(frenzyMultipliers(PENDULUM_MAP.get("tungsten-heavy")!.behavior, 30), { speed: 1, size: 1 });
});

test("chaos churn stays inside the roster's stat extremes and lerps toward them", () => {
  const chaos = PENDULUM_MAP.get("chaos-bob")!;
  const bounds = chaosBounds(PENDULUMS);
  const base = { radius: chaos.bobRadius, weight: chaos.weight, angVel: chaos.maxAngularVelocity };
  for (const r of [0, 0.5, 0.999]) {
    const t = rollChaosTargets(bounds, base, () => r);
    const radius = t.size * base.radius;
    assert.ok(radius >= bounds.minRadius - 1e-9 && radius <= bounds.maxRadius + 1e-9);
    assert.ok(t.weight * base.weight >= bounds.minWeight - 1e-9 && t.weight * base.weight <= bounds.maxWeight + 1e-9);
    assert.ok(t.rope >= 0.6 && t.rope <= 1.5);
  }
  const cur = { size: 1, weight: 1, cap: 1, rope: 1 };
  const tgt = { size: 2, weight: 0.5, cap: 1.5, rope: 1.2 };
  const half = lerpChaos(cur, tgt, 3, 231); // 1 - e^(-3·0.231) ≈ 0.5
  assert.ok(Math.abs(half.size - 1.5) < 0.01, `${half.size}`);
  assert.deepEqual(lerpChaos(cur, tgt, 3, 0), cur);
});

// Balance guard from the headless income sim (titan cable, Workshop, launch
// runs). Each pricier late bob must earn more per second on average than the
// cheaper Nitro, and Chaos (the priciest) must top the late tier. Frenzy is a
// combo bet: within ±15% of Tungsten on plain launches.
test("late-tier bobs sit on the cost curve in the income sim", () => {
  const ids = ["nitro-bob", "tungsten-heavy", "frenzy-bob", "chaos-bob"];
  const rows = new Map(incomeTable("titan-cable", "workshop", 10, {}, "launch", ids).map((r) => [r.id, r.pointsPerSec]));
  const nitro = rows.get("nitro-bob")!;
  const tungsten = rows.get("tungsten-heavy")!;
  const frenzy = rows.get("frenzy-bob")!;
  const chaos = rows.get("chaos-bob")!;
  const msg = JSON.stringify(Object.fromEntries(rows));
  assert.ok(tungsten > nitro, msg);
  assert.ok(frenzy > nitro, msg);
  assert.ok(Math.abs(frenzy / tungsten - 1) < 0.15, msg);
  assert.ok(chaos > tungsten && chaos > frenzy, msg);
});

test("Triple Bob (12k) no longer out-earns the 60k Tungsten by hand", () => {
  const ids = ["twin-bob", "triple-bob", "tungsten-heavy"];
  const hand = Object.fromEntries(incomeTable("titan-cable", "workshop", 8, {}, "hand", ids).map((r) => [r.id, r.pointsPerSec]));
  const launch = Object.fromEntries(incomeTable("titan-cable", "workshop", 8, {}, "launch", ids).map((r) => [r.id, r.pointsPerSec]));
  assert.ok(hand["triple-bob"] < hand["tungsten-heavy"] * 0.85, `triple ${hand["triple-bob"]} vs tungsten ${hand["tungsten-heavy"]}`);
  const blend = (id: string) => (hand[id] + launch[id]) / 2;
  assert.ok(blend("triple-bob") > blend("twin-bob"), "still an upgrade over Twin");
  assert.ok(blend("triple-bob") < blend("tungsten-heavy"));
});
