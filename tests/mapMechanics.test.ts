import { test } from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { applyGust, createGustSchedule, gustAt, type GustMechanic } from "../src/game/mapMechanics";
import { SITE_MAP } from "../src/data/sites";
import { incomeTable } from "./support/incomeSim";
import { seeded } from "./support/incomeSim";

const M: GustMechanic = { kind: "gusts", calmMs: 3000, rampMs: 600, holdMs: 2200, accel: 14, maxTilt: 0.35 };

test("gusts cycle calm → rise → hold → fall, starting half a calm into the run", () => {
  const s = createGustSchedule(M, seeded(1));
  assert.equal(gustAt(s, 0).phase, "calm");
  assert.equal(gustAt(s, 0).nextInMs, 1500);
  assert.equal(gustAt(s, 1500 + 300).phase, "rising");
  assert.ok(Math.abs(gustAt(s, 1500 + 300).strength - 0.5) < 1e-9);
  assert.equal(gustAt(s, 1500 + 600 + 1000).strength, 1);
  assert.equal(gustAt(s, 1500 + 600 + 2200 + 300).phase, "falling");
  // Strength is continuous: no jumps bigger than a ramp step at 60 fps.
  let prev = gustAt(s, 0).strength;
  for (let t = 0; t < 30_000; t += 1000 / 60) {
    const g = gustAt(s, t);
    assert.ok(Math.abs(g.strength - prev) < 0.05, `jump at ${t}`);
    assert.ok(Math.abs(Math.hypot(g.dir.x, g.dir.y) - 1) < 1e-9);
    assert.ok(Math.abs(Math.atan2(g.dir.y, Math.abs(g.dir.x))) <= M.maxTilt + 1e-9);
    prev = g.strength;
  }
});

test("gust directions change between gusts and push both ways over a run", () => {
  const s = createGustSchedule(M, seeded(7));
  const cycle = M.calmMs + M.rampMs * 2 + M.holdMs;
  const sides = new Set<number>();
  for (let k = 0; k < 8; k++) sides.add(Math.sign(gustAt(s, k * cycle + 2500).dir.x));
  assert.deepEqual([...sides].sort(), [-1, 1]);
});

test("applyGust adds velocity along the gust, scaled by strength and dt, and skips static bodies", () => {
  const a = Matter.Bodies.circle(0, 0, 10);
  const pinned = Matter.Bodies.circle(0, 0, 10, { isStatic: true });
  applyGust([a, pinned], { dir: { x: 1, y: 0 }, strength: 0.5, phase: "rising", nextInMs: 0 }, 14, 1000);
  assert.ok(Math.abs(a.velocity.x - 7) < 1e-9, `${a.velocity.x}`);
  assert.equal(pinned.velocity.x, 0);
  applyGust([a], { dir: { x: -1, y: 0 }, strength: 0, phase: "calm", nextInMs: 100 }, 14, 1000);
  assert.ok(Math.abs(a.velocity.x - 7) < 1e-9);
});

test("Bumper Arena has gusts; the Workshop and other maps keep their rules", () => {
  assert.equal(SITE_MAP.get("bumper-arena")!.mechanic?.kind, "gusts");
  assert.equal(SITE_MAP.get("workshop")!.mechanic, undefined);
  assert.equal(SITE_MAP.get("workshop")!.walls, "none");
});

test("wind keeps income comparable to a windless field (income sim, launch runs)", () => {
  const ids = ["iron-bob", "tungsten-heavy"];
  const calm = incomeTable("titan-cable", "workshop", 10, {}, "launch", ids);
  const windy = incomeTable("titan-cable", "workshop", 10, {}, "launch", ids, { mechanic: SITE_MAP.get("bumper-arena")!.mechanic });
  for (let i = 0; i < ids.length; i++) {
    const r = windy[i].pointsPerSec / calm[i].pointsPerSec;
    assert.ok(r > 0.8 && r < 1.3, `${ids[i]} windy/calm ${r.toFixed(2)}`);
  }
});
