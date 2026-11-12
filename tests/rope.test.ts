import { test } from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import {
  attachmentConstraintIterations,
  buildPendulum,
  enforceRopeStretchLimit,
  type PendulumHandle,
} from "../src/game/pendulum";
import { pickGrabTarget, pushPointerSample, throwVelocity, MAX_THROW_SPEED, GRAB_STIFFNESS, GRAB_DAMPING, type PointerSample } from "../src/game/ropeGrab";
import { PENDULUMS } from "../src/data/pendulums";
import { ATTACHMENTS } from "../src/data/attachments";

const ANCHOR = { x: 1920, y: 1392 };

function rig(pid: string, aid: string) {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  const h = buildPendulum(engine.world, PENDULUMS.find((p) => p.id === pid)!, ATTACHMENTS.find((a) => a.id === aid)!, ANCHOR, 1);
  engine.constraintIterations = attachmentConstraintIterations(h);
  Matter.Events.on(engine, "afterUpdate", () => enforceRopeStretchLimit(h));
  return { engine, h };
}

function maxLinkStrain(h: PendulumHandle) {
  let m = 1;
  for (const c of h.constraints) {
    if (!c.bodyA || !c.bodyB || !/^rope-(\d+|bob)$/.test(c.label ?? "")) continue;
    const d = Math.hypot(c.bodyB.position.x - c.bodyA.position.x, c.bodyB.position.y - c.bodyA.position.y);
    m = Math.max(m, d / (c.length || 1));
  }
  return m;
}

for (const [pid, aid] of [
  ["wooden-bob", "hemp-rope"],
  ["tungsten-heavy", "steel-rope"],
  ["nitro-bob", "braided-rope"],
  ["tungsten-heavy", "heavy-chain"],
]) {
  test(`${pid} on ${aid}: hard swing stays within the material stretch limit`, () => {
    const { engine, h } = rig(pid, aid);
    const tip = h.bobs[h.bobs.length - 1];
    Matter.Body.setVelocity(tip, { x: 40, y: 0 });
    const limit = h.ropePhysics.profile.maxStretchRatio;
    let worst = 1;
    let peakSpeed = 0;
    for (let i = 0; i < 360; i++) {
      Matter.Engine.update(engine, 1000 / 60);
      worst = Math.max(worst, maxLinkStrain(h));
      if (i > 120) peakSpeed = Math.max(peakSpeed, Math.hypot(tip.velocity.x, tip.velocity.y));
    }
    assert.ok(worst <= limit + 1e-6, `strain ${worst} > ${limit}`);
    // Sanity: the guard must not blow up or kill the swing.
    assert.ok(Number.isFinite(peakSpeed) && peakSpeed > 3 && peakSpeed < 60, `peak speed ${peakSpeed}`);
  });
}

test("rope links are never softer than the material tuning", () => {
  const { h } = rig("tungsten-heavy", "steel-rope");
  const k = h.ropePhysics.profile.stiffness;
  for (const c of h.constraints) {
    if (/^rope-(\d+|bob)$/.test(c.label ?? "")) assert.ok((c.stiffness ?? 0) >= k - 1e-9, `${c.label} ${c.stiffness}`);
  }
});

test("long ropes get more solver iterations than the old fixed 4", () => {
  const { h } = rig("wooden-bob", "hemp-rope");
  assert.ok(h.ropeSegments.length >= 20);
  assert.ok(attachmentConstraintIterations(h) >= 8);
});

test("grab picks the rope node under the pointer, with its own reach", () => {
  const { h } = rig("wooden-bob", "hemp-rope");
  const mid = h.ropeSegments[Math.floor(h.ropeSegments.length / 2)];
  const g = pickGrabTarget(h, { x: mid.position.x + 3, y: mid.position.y }, 9999)!;
  assert.equal(g.body, mid);
  const dist = Math.hypot(mid.position.x - ANCHOR.x, mid.position.y - ANCHOR.y);
  assert.ok(Math.abs(g.reach - dist) < 2, `reach ${g.reach} vs ${dist}`);
  const tip = h.bobs[h.bobs.length - 1];
  assert.equal(pickGrabTarget(h, tip.position, 9999)!.body, tip);
});

test("throw velocity averages the recent window and is capped", () => {
  const s: PointerSample[] = [];
  for (let t = 0; t <= 200; t += 16) pushPointerSample(s, { t, x: t * 0.6, y: 0 });
  const v = throwVelocity(s);
  assert.ok(Math.abs(v.x - 0.6 * (1000 / 60)) < 0.5, `vx ${v.x}`);
  assert.ok(s[s.length - 1].t - s[0].t <= 80);
  const fast: PointerSample[] = [{ t: 0, x: 0, y: 0 }, { t: 16, x: 5000, y: 0 }];
  assert.ok(Math.hypot(throwVelocity(fast).x, throwVelocity(fast).y) <= MAX_THROW_SPEED + 1e-9);
  assert.deepEqual(throwVelocity([{ t: 0, x: 0, y: 0 }]), { x: 0, y: 0 });
});

test("held tip follows the hand closely and whips on release", () => {
  const { engine, h } = rig("wooden-bob", "hemp-rope");
  const tip = h.bobs[h.bobs.length - 1];
  const reach = Math.hypot(tip.position.x - ANCHOR.x, tip.position.y - ANCHOR.y);
  const target = { ...tip.position };
  const grab = Matter.Constraint.create({ pointA: target, bodyB: tip, stiffness: GRAB_STIFFNESS, damping: GRAB_DAMPING, length: 0 });
  Matter.Composite.add(engine.world, grab);
  const samples: PointerSample[] = [];
  let lagSum = 0;
  let t = 0;
  for (let i = 0; i < 40; i++) {
    const ang = Math.PI / 2 - i * 0.03; // sweep the hand to the right and up
    grab.pointA = { x: ANCHOR.x + Math.cos(ang) * reach, y: ANCHOR.y + Math.sin(ang) * reach };
    Matter.Engine.update(engine, 1000 / 60);
    t += 1000 / 60;
    pushPointerSample(samples, { t, x: grab.pointA.x, y: grab.pointA.y });
    lagSum += Math.hypot(tip.position.x - grab.pointA.x, tip.position.y - grab.pointA.y);
  }
  // Mean lag behind the hand under ~5% of the rope length.
  assert.ok(lagSum / 40 < reach * 0.05, `lag ${lagSum / 40} reach ${reach}`);
  Matter.Composite.remove(engine.world, grab);
  const v = throwVelocity(samples);
  Matter.Body.setVelocity(tip, v);
  const hand = Math.hypot(v.x, v.y);
  assert.ok(hand > 5, `throw ${hand}`);
  Matter.Engine.update(engine, 1000 / 60);
  assert.ok(Math.hypot(tip.velocity.x, tip.velocity.y) > hand * 0.6);
});
