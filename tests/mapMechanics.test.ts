import { test } from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import {
  applyGust,
  bumperBounce,
  bumperPositions,
  createBumperField,
  createGustSchedule,
  gustAt,
  springRebound,
  type GustMechanic,
} from "../src/game/mapMechanics";
import { PENDULUMS } from "../src/data/pendulums";
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

// --- Orbiting bumpers (Bumper Colosseum) ---

const BUMPERS = {
  kind: "bumpers" as const,
  count: 3,
  orbitGap: 260,
  radius: 70,
  periodMs: -7000,
  boost: 1.15,
  maxSpeed: 165,
  cooldownMs: 250,
  minHitSpeed: 6,
};

test("bumpers sit evenly on one orbit just outside the swing circle and move along it", () => {
  const c = { x: 1000, y: 800 };
  const a = bumperPositions(BUMPERS, c, 900, 0);
  assert.equal(a.length, 3);
  for (const b of a) assert.ok(Math.abs(Math.hypot(b.x - c.x, b.y - c.y) - 1160) < 1e-6);
  const d01 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  const d12 = Math.hypot(a[1].x - a[2].x, a[1].y - a[2].y);
  assert.ok(Math.abs(d01 - d12) < 1e-6);
  // Reported surface velocity matches one physics step of motion.
  const b = bumperPositions(BUMPERS, c, 900, 1000 / 60);
  assert.ok(Math.abs(b[0].x - a[0].x - a[0].vx) < 0.5);
  assert.ok(Math.abs(b[0].y - a[0].y - a[0].vy) < 0.5);
});

test("a bumper bats an incoming body back, never slower, and pushes it clear", () => {
  const still = { x: 0, y: 0, vx: 0, vy: 0 };
  const res = bumperBounce({ x: 100, y: 0 }, { x: -20, y: 0 }, 40, still, BUMPERS)!;
  assert.ok(res);
  assert.ok(res.velocity.x > 0, "reflected away from the bumper");
  assert.ok(Math.hypot(res.velocity.x, res.velocity.y) >= 20 * BUMPERS.boost - 1e-9);
  assert.ok(Math.hypot(res.position.x, res.position.y) > 40 + BUMPERS.radius);
  assert.equal(res.impact, 20);
  // Speed cap.
  const fast = bumperBounce({ x: 100, y: 0 }, { x: -200, y: 0 }, 40, still, BUMPERS)!;
  assert.ok(Math.hypot(fast.velocity.x, fast.velocity.y) <= BUMPERS.maxSpeed + 1e-9);
  // No touch, separating, or too slow: nothing happens.
  assert.equal(bumperBounce({ x: 200, y: 0 }, { x: -20, y: 0 }, 40, still, BUMPERS), null);
  assert.equal(bumperBounce({ x: 100, y: 0 }, { x: 20, y: 0 }, 40, still, BUMPERS), null);
  assert.equal(bumperBounce({ x: 100, y: 0 }, { x: -3, y: 0 }, 40, still, BUMPERS), null);
});

test("the bumper field bats a body once per cooldown and ignores static bodies", () => {
  const field = createBumperField({ ...BUMPERS, count: 1, periodMs: 1e12 });
  const c = { x: 0, y: 0 };
  // Single bumper starts at angle π: (-(reach+gap), 0).
  const bx = -(100 + BUMPERS.orbitGap);
  const ball = Matter.Bodies.circle(bx + 90, 0, 30);
  Matter.Body.setVelocity(ball, { x: -20, y: 0 });
  const wall = Matter.Bodies.circle(bx + 80, 0, 30, { isStatic: true });
  const first = field.tick([ball, wall], () => 30, c, 100, 0, 0);
  assert.equal(first.length, 1);
  assert.ok(ball.velocity.x > 0);
  Matter.Body.setPosition(ball, { x: bx + 80, y: 0 });
  Matter.Body.setVelocity(ball, { x: -20, y: 0 });
  assert.equal(field.tick([ball], () => 30, c, 100, 100, 100).length, 0, "still cooling down");
  assert.equal(field.tick([ball], () => 30, c, 100, 300, 300).length, 1);
  assert.ok(field.flashUntil[0] > 300);
});

test("the Colosseum bumpers orbit clear of every strung bob's swing", () => {
  const site = SITE_MAP.get("bumper-colosseum")!;
  assert.equal(site.mechanic?.kind, "bumpers");
  if (site.mechanic?.kind !== "bumpers") return;
  const maxBobR = Math.max(...PENDULUMS.map((p) => p.bobRadius));
  // The tip rides at the rig reach, so the orbit gap must fit a bumper + the biggest bob.
  assert.ok(site.mechanic.orbitGap - site.mechanic.radius - maxBobR > 0);
});

test("Colosseum bumpers leave strung income unchanged (income sim, titan cable)", () => {
  const ids = ["iron-bob", "tungsten-heavy"];
  const on = incomeTable("titan-cable", "bumper-colosseum", 6, {}, "launch", ids);
  const off = incomeTable("titan-cable", "bumper-colosseum", 6, {}, "launch", ids, { mechanic: undefined });
  for (let i = 0; i < ids.length; i++) {
    const d = on[i].pointsPerSec / off[i].pointsPerSec - 1;
    assert.ok(Math.abs(d) < 0.05, `${ids[i]} moved ${(d * 100).toFixed(1)}%`);
  }
});

// --- Spring walls (Bumper Cage) ---

test("spring rebound keeps speed and steers part-way toward the mount", () => {
  const target = { x: 0, y: 0 };
  const pos = { x: 100, y: 0 };
  const vel = { x: 0, y: 10 }; // sliding along the wall
  const plain = springRebound(pos, vel, target, 0);
  assert.deepEqual(plain, vel);
  const half = springRebound(pos, vel, target, 0.5);
  assert.ok(Math.abs(Math.hypot(half.x, half.y) - 10) < 1e-9, "speed kept");
  assert.ok(half.x < 0, "now heading toward the mount");
  const full = springRebound(pos, vel, target, 1);
  assert.ok(Math.abs(full.x + 10) < 1e-9 && Math.abs(full.y) < 1e-9);
});

test("the Bumper Cage has spring walls and they stay near plain-wall income on a stiff rope", () => {
  const site = SITE_MAP.get("bumper-cage")!;
  assert.equal(site.mechanic?.kind, "springWalls");
  const ids = ["iron-bob", "tungsten-heavy"];
  const on = incomeTable("titan-cable", "bumper-cage", 6, {}, "launch", ids);
  const off = incomeTable("titan-cable", "bumper-cage", 6, {}, "launch", ids, { mechanic: undefined, simWallBoost: 1.22 });
  for (let i = 0; i < ids.length; i++) {
    const d = on[i].pointsPerSec / off[i].pointsPerSec - 1;
    assert.ok(Math.abs(d) < 0.25, `${ids[i]} moved ${(d * 100).toFixed(1)}%`);
  }
});
