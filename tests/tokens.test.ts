import { test } from "node:test";
import assert from "node:assert/strict";
import { BUFF_TOKEN_KINDS, TOKENS, dropShare, rollRandomToken } from "../src/data/tokens";
import { MODIFIERS, MODIFIER_MAP } from "../src/data/modifiers";
import { tokenGlyph } from "../src/game/render";
import { locName } from "../src/i18n";
import { seeded } from "./support/incomeSim";

// Modifiers that are deliberately not dropped by orbs: the Golden Token's own
// score layer, and Tiny Bob (pulled from the pool, kept wired).
const NOT_DROPPED = new Set(["token-bonus", "tiny-bob"]);

test("every droppable modifier has an orb-drop token source", () => {
  const granted = new Set(TOKENS.filter((t) => dropShare(t.kind) > 0).map((t) => t.grantsModifierId));
  const orphans = MODIFIERS.filter((m) => !NOT_DROPPED.has(m.id) && !granted.has(m.id)).map((m) => m.id);
  assert.deepEqual(orphans, []);
});

test("every token grants a real modifier, has a glyph and a pt name", () => {
  for (const t of TOKENS) {
    if (t.grantsModifierId) assert.ok(MODIFIER_MAP.has(t.grantsModifierId), t.kind);
    assert.notEqual(tokenGlyph(t.kind), "?", t.kind);
    assert.notEqual(locName("pt", "token", t.kind, "__missing__"), "__missing__", t.kind);
  }
});

test("Golden and Rope Patch keep their share of drops as the pool grows", () => {
  // Before the orphan modifiers joined the pool: golden 6/106, repair 18/106.
  const golden = dropShare("golden");
  const repair = dropShare("repair");
  assert.ok(golden > 0.05 && golden < 0.065, `golden ${golden}`);
  assert.ok(repair > 0.15 && repair < 0.19, `repair ${repair}`);
  assert.equal(dropShare("tiny-bob"), 0);
});

test("seeded rolls hit every droppable kind at roughly its weight", () => {
  const real = Math.random;
  Math.random = seeded(42);
  try {
    const counts = new Map<string, number>();
    const N = 40_000;
    for (let i = 0; i < N; i++) {
      const k = rollRandomToken().kind;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const t of TOKENS) {
      const want = dropShare(t.kind);
      const got = (counts.get(t.kind) ?? 0) / N;
      assert.ok(Math.abs(got - want) < 0.01, `${t.kind} ${got} vs ${want}`);
    }
  } finally {
    Math.random = real;
  }
});

test("the new orb buffs count as buffs for the Run Again guarantee", () => {
  for (const k of ["power-twist", "heavy-air", "featherweight", "golden-hour", "overdrive"] as const) {
    assert.ok(BUFF_TOKEN_KINDS.includes(k), k);
  }
});
