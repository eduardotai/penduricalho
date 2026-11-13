import { test } from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { SITE_MAP } from "../src/data/sites";
import { PENDULUM_MAP } from "../src/data/pendulums";
import { conveyorAt, magnetPulseAt, shiftZones, tideAt } from "../src/game/mapMechanics";
import { evaluateAchievement, ACHIEVEMENT_MAP } from "../src/data/achievements";
import { locName, locDesc } from "../src/i18n";
import { simulateRun } from "./support/incomeSim";

const NEW = ["moon-base", "conveyor-yard", "magnet-storm"];
const mech = <K extends string>(id: string, kind: K) => {
  const m = SITE_MAP.get(id)!.mechanic!;
  assert.equal(m.kind, kind);
  return m as Extract<typeof m, { kind: K }>;
};

test("new maps exist, are priced past Black Hole, and have pt strings", () => {
  let last = SITE_MAP.get("black-hole")!.cost;
  for (const id of NEW) {
    const s = SITE_MAP.get(id)!;
    assert.ok(s.cost > last, id);
    last = s.cost;
    assert.ok(s.unlock && s.unlock.gte < s.cost, id);
    assert.notEqual(locName("pt", "site", id, "__"), "__");
    assert.notEqual(locDesc("pt", "site", id, "__"), "__");
  }
});

test("tides start at full gravity and bottom out at half a period", () => {
  const m = mech("moon-base", "tides");
  assert.ok(Math.abs(tideAt(m, 0).mult - m.maxGravity) < 1e-9);
  assert.ok(Math.abs(tideAt(m, m.periodMs / 2).mult - m.minGravity) < 1e-9);
  assert.equal(tideAt(m, m.periodMs / 4).falling, true);
  assert.equal(tideAt(m, (m.periodMs * 3) / 4).falling, false);
});

test("conveyor runs right, eases through each flip, then runs left", () => {
  const m = mech("conveyor-yard", "conveyor");
  assert.equal(conveyorAt(m, m.flipMs / 2).velocity, m.speed);
  assert.ok(Math.abs(conveyorAt(m, m.flipMs - 1).velocity) < m.speed * 0.01);
  assert.equal(conveyorAt(m, m.flipMs * 1.5).dir, -1);
  assert.equal(conveyorAt(m, m.flipMs * 1.5).velocity, -m.speed);
  assert.ok(Math.abs(conveyorAt(m, 0).nextFlipMs - m.flipMs) < 1e-9);
});

test("shiftZones wraps orbs across the field and moves their bodies", () => {
  const body = Matter.Bodies.circle(990, 50, 10, { isSensor: true });
  const zones = [{ zone: { position: { x: 990, y: 50 } }, body }];
  shiftZones(zones, 20, { x: 0, w: 1000 });
  assert.equal(zones[0].zone.position.x, 10);
  assert.equal(body.position.x, 10);
  shiftZones(zones, -30, { x: 0, w: 1000 });
  assert.equal(zones[0].zone.position.x, 980);
});

test("magnet pulses: calm, then an eased pulse, on a fixed cycle", () => {
  const m = mech("magnet-storm", "magnetPulses");
  const calm = magnetPulseAt(m, 0);
  assert.equal(calm.active, false);
  assert.ok(Math.abs(calm.nextInMs - m.calmMs / 2) < 1e-9);
  const peak = magnetPulseAt(m, m.calmMs / 2 + m.pulseMs / 2);
  assert.equal(peak.active, true);
  assert.ok(peak.strength > 0.99);
  assert.equal(magnetPulseAt(m, m.calmMs / 2 + m.pulseMs + 10).active, false);
});

test("map achievements unlock on owning the site", () => {
  const def = ACHIEVEMENT_MAP.get("moonwalker")!;
  const snap = (sites: string[]) => ({
    stats: { totalMomentum: 0, totalHits: 0, totalSwings: 0, bestCombo: 0, totalClicks: 0, totalGenerators: 0 },
    owned: { pendulums: [], attachments: [], sites, skins: [], shapes: [] },
    totalGoldenSpent: 0,
    blackHoleCaptures: 0,
    unlocked: {},
  });
  assert.equal(evaluateAchievement(def, snap(["workshop"]) as never).unlocked, false);
  assert.equal(evaluateAchievement(def, snap(["moon-base"]) as never).unlocked, true);
});

test("sim: each new map earns within 0.5x-2x of the Bumper Arena on launches", () => {
  const bob = PENDULUM_MAP.get("tungsten-heavy")!;
  const pps = (site: string) => {
    let pts = 0;
    let ms = 0;
    for (let i = 0; i < 4; i++) {
      const r = simulateRun(bob, "titan-cable", site, 1000 + i * 7919);
      pts += r.points;
      ms += r.ms;
    }
    return pts / ms;
  };
  const arena = pps("bumper-arena");
  for (const id of NEW) {
    const ratio = pps(id) / arena;
    assert.ok(ratio > 0.5 && ratio < 2, `${id} ${ratio.toFixed(2)}x arena`);
  }
});
