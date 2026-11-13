import { test } from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { JITTER_RIGS, makeRig, runScenario } from "./support/ropeSim";

// Regression for the rope "tremelique": rope nodes used to collide with the bob
// they hold (the bob overlaps the last node), so the contact solver and the
// links fought every step and the rig trembled even hanging still.

test("rope nodes never collide with bobs or with each other", () => {
  const { h } = makeRig("tungsten-heavy", "steel-rope");
  const tip = h.bobs[h.bobs.length - 1];
  for (const node of h.ropeSegments) {
    assert.equal(Matter.Detector.canCollide(node.collisionFilter, tip.collisionFilter), false, node.label);
    assert.equal(Matter.Detector.canCollide(node.collisionFilter, h.ropeSegments[0].collisionFilter), false);
    // Boundary walls (DEFAULT category) still stop the rope.
    assert.equal(Matter.Detector.canCollide(node.collisionFilter, { category: 0x0001, mask: 0xffffffff, group: 0 }), true);
  }
});

for (const [pid, aid] of JITTER_RIGS) {
  test(`${pid} on ${aid}: hangs still, swings and whips without jitter`, () => {
    const rest = runScenario(pid, aid, "rest");
    // Was 7–24 u/step peak and ~6–8 bob jerk before the fix.
    assert.ok(rest.peakSpeed < 4, `rest peak ${rest.peakSpeed}`);
    assert.ok(rest.bobJerk < 0.2, `rest bob jerk ${rest.bobJerk}`);

    const swing = runScenario(pid, aid, "swing");
    assert.ok(swing.bobJerk < 1, `swing bob jerk ${swing.bobJerk}`);
    // The fix must not kill the swing.
    assert.ok(swing.meanSpeed > 3, `swing mean speed ${swing.meanSpeed}`);

    const release = runScenario(pid, aid, "release");
    assert.ok(release.bobJerk < 0.5, `release bob jerk ${release.bobJerk}`);
    assert.ok(release.peakSpeed > 10, `release peak ${release.peakSpeed}`);

    const grab = runScenario(pid, aid, "grab");
    assert.ok(grab.bobRadialFlipsPerSec <= 3, `grab radial flips ${grab.bobRadialFlipsPerSec}/s`);
  });
}
