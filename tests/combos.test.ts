import { test } from "node:test";
import assert from "node:assert/strict";
import { RIG_COMBOS, activeRigCombo, combosForItem, ownedComboCount } from "../src/data/combos";
import { PENDULUM_MAP } from "../src/data/pendulums";
import { ATTACHMENT_MAP } from "../src/data/attachments";
import { evaluateAchievement, ACHIEVEMENT_MAP } from "../src/data/achievements";
import { locName, locDesc } from "../src/i18n";
import { simulateRun } from "./support/incomeSim";

test("every combo points at a real bob and line, with pt strings", () => {
  assert.ok(RIG_COMBOS.length >= 5 && RIG_COMBOS.length <= 8);
  const pairs = new Set<string>();
  for (const c of RIG_COMBOS) {
    assert.ok(PENDULUM_MAP.has(c.pendulumId), c.pendulumId);
    assert.ok(ATTACHMENT_MAP.has(c.attachmentId), c.attachmentId);
    const key = c.pendulumId + "|" + c.attachmentId;
    assert.ok(!pairs.has(key), "duplicate pair " + key);
    pairs.add(key);
    assert.ok(c.pointMult > 1 && c.pointMult <= 1.5, c.id);
    if (c.drainMult !== undefined) assert.ok(c.drainMult > 0 && c.drainMult < 1, c.id);
    assert.notEqual(locName("pt", "combo", c.id, "__"), "__", c.id);
    assert.notEqual(locDesc("pt", "combo", c.id, "__"), "__", c.id);
  }
});

test("activeRigCombo needs the exact bob + line pair", () => {
  assert.equal(activeRigCombo("tungsten-heavy", "anchor-chain")?.id, "wrecking-ball");
  assert.equal(activeRigCombo("anchor-chain", "tungsten-heavy"), null);
  assert.equal(activeRigCombo("tungsten-heavy", "titan-cable"), null);
  assert.deepEqual(combosForItem("attachment", "silk-thread").map((c) => c.id), ["shooting-star"]);
  assert.deepEqual(combosForItem("pendulum", "wooden-bob"), []);
});

test("owned combo count and the combo achievements", () => {
  const owned = (pendulums: string[], attachments: string[]) => ({ pendulums, attachments, sites: [], skins: [], shapes: [] });
  assert.equal(ownedComboCount(owned(["twin-bob"], ["silk-thread"])), 0);
  assert.equal(ownedComboCount(owned(["twin-bob", "comet-bob"], ["heavy-chain", "silk-thread"])), 2);
  const snap = (o: ReturnType<typeof owned>) => ({
    stats: { totalMomentum: 0, totalHits: 0, totalSwings: 0, bestCombo: 0, totalClicks: 0, totalGenerators: 0 },
    owned: o,
    totalGoldenSpent: 0,
    blackHoleCaptures: 0,
    unlocked: {},
  });
  const first = ACHIEVEMENT_MAP.get("perfect-match")!;
  const five = ACHIEVEMENT_MAP.get("set-collector")!;
  assert.equal(evaluateAchievement(first, snap(owned(["twin-bob"], [])) as never).unlocked, false);
  assert.equal(evaluateAchievement(first, snap(owned(["twin-bob"], ["heavy-chain"])) as never).unlocked, true);
  const all = owned(RIG_COMBOS.map((c) => c.pendulumId), RIG_COMBOS.map((c) => c.attachmentId));
  const four = owned(RIG_COMBOS.slice(0, 4).map((c) => c.pendulumId), RIG_COMBOS.slice(0, 4).map((c) => c.attachmentId));
  assert.equal(evaluateAchievement(five, snap(four) as never).unlocked, false);
  assert.equal(evaluateAchievement(five, snap(all) as never).unlocked, true);
});

test("sim: the combo bonus raises income on its own rig", () => {
  const bob = PENDULUM_MAP.get("tungsten-heavy")!;
  let on = 0;
  let off = 0;
  for (let i = 0; i < 4; i++) {
    const seed = 500 + i * 31;
    on += simulateRun(bob, "anchor-chain", "workshop", seed, {}, "launch", {}, {}, true).points;
    off += simulateRun(bob, "anchor-chain", "workshop", seed, {}, "launch", {}, {}, false).points;
  }
  assert.ok(on > off * 1.1, `combo ${on} vs plain ${off}`);
});
