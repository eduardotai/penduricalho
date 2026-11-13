import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chaosBounds,
  gildZone,
  nearestZones,
  pushTrail,
  singularityScale,
  zonesInRadius,
  zonesOnTrail,
  type TrailPoint,
} from "../src/game/bobBehaviors";
import { PENDULUM_MAP, PENDULUMS } from "../src/data/pendulums";
import { locName } from "../src/i18n";
import { evaluateAchievement, ACHIEVEMENT_MAP } from "../src/data/achievements";
import { incomeTable } from "./support/incomeSim";

const LATE = ["pulsar-bob", "comet-bob", "midas-bob", "prism-bob", "singularity-bob"];
const zone = (id: string, x: number, y: number, radius = 10, multiplier = 1) => ({
  zone: { id, position: { x, y }, radius, multiplier } as { id: string; position: { x: number; y: number }; radius: number; multiplier: number; gild?: number },
});

test("pulsar radius and prism chain pick the right orbs", () => {
  const zs = [zone("a", 0, 0), zone("b", 50, 0), zone("c", 120, 0), zone("d", 400, 0)];
  assert.deepEqual(zonesInRadius(zs, { x: 0, y: 0 }, 110).map((h) => h.zone.id), ["a", "b", "c"]);
  assert.deepEqual(nearestZones(zs, zs[0], 2, 1000).map((h) => h.zone.id), ["b", "c"]);
  assert.deepEqual(nearestZones(zs, zs[0], 5, 100).map((h) => h.zone.id), ["b"]);
});

test("comet tail forgets old points and touches orbs along its path", () => {
  const trail: TrailPoint[] = [];
  pushTrail(trail, { x: 0, y: 0 }, 0, 600);
  pushTrail(trail, { x: 100, y: 0 }, 300, 600);
  pushTrail(trail, { x: 200, y: 0 }, 700, 600);
  assert.deepEqual(trail.map((p) => p.x), [100, 200]);
  const zs = [zone("on", 100, 15), zone("off", 100, 200)];
  assert.deepEqual(zonesOnTrail(zs, trail, 10).map((h) => h.zone.id), ["on"]);
  assert.deepEqual(zonesOnTrail(zs, [], 10), []);
});

test("midas gild stacks up to its cap and singularity growth caps", () => {
  const midas = PENDULUM_MAP.get("midas-bob")!.behavior!;
  const z = { multiplier: 1.2 } as { multiplier: number; gild?: number };
  assert.ok(gildZone(z, midas) && gildZone(z, midas) && gildZone(z, midas));
  assert.equal(gildZone(z, midas), false);
  assert.equal(z.gild, 3);
  assert.equal(z.multiplier, 4.2);
  const sing = PENDULUM_MAP.get("singularity-bob")!.behavior;
  assert.equal(singularityScale(sing, 0), 1);
  assert.equal(singularityScale(sing, 1000), 1.8);
  assert.equal(singularityScale(PENDULUM_MAP.get("chaos-bob")!.behavior, 50), 1);
});

test("late bobs keep the Chaos Bob's churn bounds unchanged", () => {
  const old = chaosBounds(PENDULUMS.filter((p) => !LATE.includes(p.id)));
  assert.deepEqual(chaosBounds(PENDULUMS), old);
});

test("late bobs are priced past Chaos, have pt names and earn more as they cost more (sim)", () => {
  const ids = ["chaos-bob", ...LATE];
  const rows = incomeTable("titan-cable", "workshop", 8, {}, "launch", ids).sort((a, b) => a.cost - b.cost);
  const msg = JSON.stringify(rows.map((r) => [r.id, r.cost, +r.pointsPerSec.toFixed(1)]));
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].cost > rows[i - 1].cost, msg);
    assert.ok(rows[i].pointsPerSec > rows[i - 1].pointsPerSec, msg);
  }
  for (const id of LATE) {
    assert.ok(PENDULUM_MAP.get(id)!.cost >= 300_000, id);
    assert.notEqual(locName("pt", "pendulum", id, "__"), "__", id);
  }
});

test("ownership achievements unlock when the bob is owned", () => {
  const def = ACHIEVEMENT_MAP.get("event-horizon-bob")!;
  const snap = (pendulums: string[]) => ({
    stats: { totalMomentum: 0, totalHits: 0, totalSwings: 0, bestCombo: 0, totalClicks: 0, totalGenerators: 0 },
    owned: { pendulums, attachments: [], sites: [], skins: [], shapes: [] },
    totalGoldenSpent: 0,
    blackHoleCaptures: 0,
    unlocked: {},
  });
  assert.equal(evaluateAchievement(def, snap(["wooden-bob"]) as never).unlocked, false);
  assert.equal(evaluateAchievement(def, snap(["singularity-bob"]) as never).unlocked, true);
});
