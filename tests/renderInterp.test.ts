import { test } from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import {
  applyInterpolation,
  createInterpSnapshot,
  interpolationAlpha,
  restoreBodies,
  runnerAlpha,
  snapshotBodies,
} from "../src/game/renderInterp";

// A swinging pendulum driven the way the game drives it: a Matter 0.20 Runner
// with a fixed 60 Hz step, ticked once per animation frame of the given rate.
function simulate(hz: number, frames: number, interpolate: boolean) {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  const runner = Matter.Runner.create({ delta: 1000 / 60 });
  const pivot = { x: 400, y: 100 };
  const bob = Matter.Bodies.circle(650, 100, 20, { frictionAir: 0, density: 0.004 });
  const rope = Matter.Constraint.create({ pointA: pivot, bodyB: bob, length: 250, stiffness: 1 });
  Matter.Composite.add(engine.world, [bob, rope]);

  const snap = createInterpSnapshot();
  if (interpolate) {
    Matter.Events.on(engine, "beforeUpdate", () =>
      snapshotBodies(Matter.Composite.allBodies(engine.world), snap)
    );
  }
  const drawn: { x: number; y: number }[] = [];
  for (let i = 1; i <= frames; i++) {
    Matter.Runner.tick(runner, engine, (i * 1000) / hz);
    const saved = interpolate ? applyInterpolation(snap, runnerAlpha(runner), 160) : [];
    drawn.push({ x: bob.position.x, y: bob.position.y }); // the "draw" call
    restoreBodies(saved);
  }
  return {
    drawn,
    final: { x: bob.position.x, y: bob.position.y, vx: bob.velocity.x, vy: bob.velocity.y, a: bob.angle },
    steps: engine.timing.timestamp,
  };
}

// Coefficient of variation of the on-screen distance moved per frame: 0 is
// perfectly even motion; uneven step cadence (1,0,1,1,0…) pushes it up.
function judder(drawn: { x: number; y: number }[]) {
  const d: number[] = [];
  for (let i = 1; i < drawn.length; i++) {
    d.push(Math.hypot(drawn[i].x - drawn[i - 1].x, drawn[i].y - drawn[i - 1].y));
  }
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length);
  return sd / mean;
}

test("interpolation never changes physics results (bit-for-bit)", () => {
  for (const hz of [60, 120, 144, 165]) {
    const raw = simulate(hz, hz * 3, false);
    const smooth = simulate(hz, hz * 3, true);
    assert.deepEqual(smooth.final, raw.final, `${hz} Hz final state`);
    assert.equal(smooth.steps, raw.steps, `${hz} Hz step count`);
  }
});

test("144 Hz motion is far more even with interpolation", () => {
  const raw = judder(simulate(144, 144 * 2, false).drawn.slice(30, 60));
  const smooth = judder(simulate(144, 144 * 2, true).drawn.slice(30, 60));
  // Raw: frames with no step draw zero movement, so judder is large.
  assert.ok(raw > 0.5, `raw judder ${raw.toFixed(3)}`);
  assert.ok(smooth < raw / 4, `smooth ${smooth.toFixed(3)} vs raw ${raw.toFixed(3)}`);
});

test("alpha maps the runner's leftover buffer onto [0, 1]", () => {
  const d = 1000 / 60;
  assert.equal(interpolationAlpha(0.5 * d, d), 0);
  assert.ok(Math.abs(interpolationAlpha(d, d) - 0.5) < 1e-12);
  assert.ok(interpolationAlpha(1.5 * d, d) > 1 - 1e-12);
  assert.equal(interpolationAlpha(5 * d, d), 1);
  assert.equal(runnerAlpha({}), 1);
});

test("teleported bodies are drawn where they are, and restore is exact", () => {
  const a = { position: { x: 0, y: 0 }, angle: 0, isStatic: false };
  const b = { position: { x: 0, y: 0 }, angle: 0, isStatic: false };
  const wall = { position: { x: 5, y: 5 }, angle: 0, isStatic: true };
  const snap = createInterpSnapshot();
  snapshotBodies([a, b, wall], snap);
  assert.equal(snap.size, 2);
  a.position.x = 10.1;
  a.angle = 0.3;
  b.position.x = 900; // teleport
  const saved = applyInterpolation(snap, 0.25, 160);
  assert.ok(Math.abs(a.position.x - 2.525) < 1e-12);
  assert.equal(b.position.x, 900);
  restoreBodies(saved);
  assert.equal(a.position.x, 10.1);
  assert.equal(a.angle, 0.3);
});
