import { test } from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS } from "../src/data/achievements";
import { GENERATORS } from "../src/data/generators";
import { CLICK_UPGRADES } from "../src/data/clickUpgrades";
import { GLOBAL_UPGRADES } from "../src/data/globalUpgrades";
import {
  ACHIEVEMENT_ICONS,
  CLICK_UPGRADE_ICONS,
  GENERATOR_ICONS,
  GLOBAL_UPGRADE_ICONS,
  iconFor,
} from "../src/components/ui/icons";

// The redesign replaces emoji with one SVG icon set; every content id must
// have a mapped icon so nothing silently falls back.
test("every achievement, generator and upgrade has an SVG icon", () => {
  for (const a of ACHIEVEMENTS) assert.ok(ACHIEVEMENT_ICONS[a.id], `achievement ${a.id}`);
  for (const g of GENERATORS) assert.ok(GENERATOR_ICONS[g.id], `generator ${g.id}`);
  for (const u of CLICK_UPGRADES) assert.ok(CLICK_UPGRADE_ICONS[u.id], `click upgrade ${u.id}`);
  for (const u of GLOBAL_UPGRADES) assert.ok(GLOBAL_UPGRADE_ICONS[u.id], `global upgrade ${u.id}`);
});

test("unknown ids get a fallback icon instead of throwing", () => {
  assert.ok(iconFor("achievement", "nope"));
  assert.ok(iconFor("generator", undefined));
});
