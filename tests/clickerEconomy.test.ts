import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotalCps, generatorCost, generatorCps } from "../src/game/clickerEconomy";
import { GENERATORS } from "../src/data/generators";
import { WORKSHOP_CLICKER_ENABLED } from "../src/config/features";

test("generator CPS is linear in the number owned", () => {
  assert.equal(generatorCps(4, 0), 0);
  assert.equal(generatorCps(4, 1), 4);
  assert.equal(generatorCps(4, 10), 40);
  assert.equal(generatorCps(4, 100), 400);
});

test("total CPS = sum(n × base) × workshop multiplier", () => {
  const counts = { "wind-up-key": 10, counterweight: 3 };
  assert.ok(Math.abs(computeTotalCps(counts, GENERATORS, 1.25) - (10 * 0.1 + 3 * 1) * 1.25) < 1e-9);
});

test("buying more copies never makes a copy's payback time shrink", () => {
  for (const g of GENERATORS) {
    let prevPayback = 0;
    for (let n = 0; n < 60; n++) {
      const marginal = generatorCps(g.baseCps, n + 1) - generatorCps(g.baseCps, n);
      const payback = generatorCost(g.baseCost, g.costMult, n) / marginal;
      assert.ok(payback >= prevPayback - 1e-9, `${g.id} n=${n}`);
      prevPayback = payback;
    }
  }
});

test("workshop clicker layer is enabled", () => {
  assert.equal(WORKSHOP_CLICKER_ENABLED, true);
});
