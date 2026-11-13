import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTACHMENT_MAP } from "../src/data/attachments";
import { PENDULUM_MAP } from "../src/data/pendulums";
import { resolveRopeMaterial, ropeChargeMult } from "../src/game/rope";
import { locName } from "../src/i18n";
import { simulateRun } from "./support/incomeSim";

const NEW = ["silk-thread", "spring-coil", "anchor-chain", "plasma-tether", "carbon-rod"];

test("Plasma Tether charge grows with the combo and caps at +60%", () => {
  const b = ATTACHMENT_MAP.get("plasma-tether")!.behavior;
  assert.equal(ropeChargeMult(b, 0), 1);
  assert.ok(Math.abs(ropeChargeMult(b, 5) - 1.2) < 1e-9);
  assert.ok(Math.abs(ropeChargeMult(b, 15) - 1.6) < 1e-9);
  assert.ok(Math.abs(ropeChargeMult(b, 99) - 1.6) < 1e-9);
  assert.equal(ropeChargeMult(ATTACHMENT_MAP.get("titan-cable")!.behavior, 30), 1);
});

test("new ropes exist with pt names and their own material tuning", () => {
  for (const id of NEW) {
    const a = ATTACHMENT_MAP.get(id);
    assert.ok(a, id);
    assert.notEqual(locName("pt", "attachment", id, "__"), "__", id);
  }
  const silk = resolveRopeMaterial(ATTACHMENT_MAP.get("silk-thread")!);
  const anchor = resolveRopeMaterial(ATTACHMENT_MAP.get("anchor-chain")!);
  assert.ok(anchor.loadRating * anchor.durabilitySeconds > 10 * silk.loadRating * silk.durabilitySeconds);
  const spring = resolveRopeMaterial(ATTACHMENT_MAP.get("spring-coil")!);
  const elastic = resolveRopeMaterial(ATTACHMENT_MAP.get("elastic-cord")!);
  assert.ok(spring.maxStretchRatio > elastic.maxStretchRatio);
});

test("sim: silk snaps under Tungsten, Anchor Chain carries it", () => {
  const t = PENDULUM_MAP.get("tungsten-heavy")!;
  const seeds = [1000, 8919, 16838];
  const snaps = (rope: string) => seeds.filter((s) => simulateRun(t, rope, "workshop", s).snapped).length;
  assert.equal(snaps("silk-thread"), seeds.length);
  assert.equal(snaps("anchor-chain"), 0);
});
