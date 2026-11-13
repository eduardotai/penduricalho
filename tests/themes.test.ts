import "./memoryStorage";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_THEME_ID,
  THEMES,
  THEMED_FAMILIES,
  hexToRgbTriplet,
  themeCssVars,
} from "../src/data/themes";
import { RENDER_THEMES } from "../src/game/themes";
import { SAVE_VERSION, migrateSave, mergeSave, useGameStore } from "../src/state/store";

const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

test("every theme has canvas art, a full palette and fonts", () => {
  for (const theme of THEMES) {
    assert.ok(RENDER_THEMES[theme.id], `missing art for ${theme.id}`);
    assert.equal(RENDER_THEMES[theme.id].zone.tiers.length, 5, theme.id);
    for (const fam of THEMED_FAMILIES) {
      for (const shade of SHADES) {
        assert.match(theme.palette[fam][shade as "50"], /^#[0-9a-f]{6}$/i, `${theme.id} ${fam}-${shade}`);
      }
    }
    const vars = themeCssVars(theme);
    assert.equal(vars["--c-slate-950"], hexToRgbTriplet(theme.palette.slate["950"]));
    assert.ok(vars["--font-sans"] && vars["--font-display"] && vars["--font-heading"]);
  }
});

test("only the default theme is free and prices rise along the list", () => {
  assert.equal(THEMES[0].id, DEFAULT_THEME_ID);
  assert.equal(THEMES[0].cost, 0);
  for (let i = 1; i < THEMES.length; i++) {
    assert.ok(THEMES[i].cost > THEMES[i - 1].cost, THEMES[i].id);
  }
  assert.equal(new Set(THEMES.map((t) => t.id)).size, THEMES.length);
});

test("hexToRgbTriplet", () => {
  assert.equal(hexToRgbTriplet("#020617"), "2 6 23");
  assert.equal(hexToRgbTriplet("#fff"), "255 255 255");
});

test("buying a theme spends Momentum once; equip needs ownership", () => {
  const st = useGameStore.getState();
  st.reset();
  const watch = THEMES.find((t) => t.id === "watchmaker")!;
  useGameStore.setState({ momentum: watch.cost - 1 });
  assert.equal(useGameStore.getState().buyTheme("watchmaker"), false);
  useGameStore.getState().equipTheme("watchmaker");
  assert.equal(useGameStore.getState().themeId, DEFAULT_THEME_ID, "cannot equip unowned");

  useGameStore.setState({ momentum: watch.cost + 10 });
  assert.equal(useGameStore.getState().buyTheme("watchmaker"), true);
  assert.equal(useGameStore.getState().momentum, 10);
  assert.deepEqual(useGameStore.getState().ownedThemes, [DEFAULT_THEME_ID, "watchmaker"]);
  assert.equal(useGameStore.getState().buyTheme("watchmaker"), false, "no double buy");
  assert.equal(useGameStore.getState().momentum, 10);

  useGameStore.getState().equipTheme("watchmaker");
  assert.equal(useGameStore.getState().themeId, "watchmaker");
  useGameStore.getState().equipTheme("no-such-theme");
  assert.equal(useGameStore.getState().themeId, "watchmaker");
  assert.equal(useGameStore.getState().buyTheme("no-such-theme"), false);
});

/** A save as v23 wrote it (no theme fields). */
function v23Save() {
  return {
    momentum: 12_345,
    stats: { totalMomentum: 99_000, totalSwings: 10, totalHits: 50, bestCombo: 7, totalClicks: 3, totalGenerators: 1 },
    owned: {
      pendulums: ["wooden-bob"],
      attachments: ["hemp-rope"],
      sites: ["workshop"],
      skins: ["classic"],
      shapes: ["circle"],
    },
    equipped: {
      pendulumId: "wooden-bob",
      attachmentId: "hemp-rope",
      siteId: "workshop",
      skinId: "classic",
      shapeId: "circle",
    },
    unlockedAchievements: { "first-arc": 1 },
    generatorCounts: { "wind-up-key": 4 },
    audio: {},
  };
}

test("v23 save migrates to v24 with the default theme and keeps progress", () => {
  const migrated = migrateSave(v23Save(), 23) as Record<string, unknown>;
  assert.deepEqual(migrated.ownedThemes, [DEFAULT_THEME_ID]);
  assert.equal(migrated.themeId, DEFAULT_THEME_ID);
  const merged = mergeSave(migrated, useGameStore.getInitialState?.() ?? useGameStore.getState());
  assert.equal(merged.momentum, 12_345);
  assert.equal(merged.stats.totalMomentum, 99_000);
  assert.deepEqual(merged.unlockedAchievements, { "first-arc": 1 });
  assert.equal(merged.generatorCounts["wind-up-key"], 4);
  assert.deepEqual(merged.ownedThemes, [DEFAULT_THEME_ID]);
  assert.equal(merged.themeId, DEFAULT_THEME_ID);
});

test("merge drops unknown themes and never equips an unowned one", () => {
  const merged = mergeSave(
    { ...v23Save(), ownedThemes: ["bogus", "watchmaker"], themeId: "bogus" },
    useGameStore.getState()
  );
  assert.deepEqual(merged.ownedThemes, [DEFAULT_THEME_ID, "watchmaker"]);
  assert.equal(merged.themeId, DEFAULT_THEME_ID);
  const merged2 = mergeSave({ ...v23Save(), ownedThemes: ["watchmaker"], themeId: "watchmaker" }, useGameStore.getState());
  assert.equal(merged2.themeId, "watchmaker");
});

test("the persisted save is the current version (>= v24) and carries the theme fields", () => {
  useGameStore.getState().reset();
  useGameStore.setState({ momentum: 1_000_000 });
  useGameStore.getState().buyTheme("watchmaker");
  useGameStore.getState().equipTheme("watchmaker");
  const raw = JSON.parse(localStorage.getItem("pendulum-clicker-save")!);
  assert.equal(raw.version, SAVE_VERSION);
  assert.ok(SAVE_VERSION >= 24);
  assert.deepEqual(raw.state.ownedThemes, [DEFAULT_THEME_ID, "watchmaker"]);
  assert.equal(raw.state.themeId, "watchmaker");
});

test("ramp keeps anchors and interpolates the gaps", async () => {
  const { ramp } = await import("../src/data/themes");
  const r = ramp({ "50": "#ffffff", "950": "#000000", "500": "#808080" });
  assert.equal(r["50"], "#ffffff");
  assert.equal(r["500"], "#808080");
  assert.equal(r["950"], "#000000");
  assert.equal(Object.keys(r).length, 11);
  // 700 is 2 of the 5 shade steps from 500 (#808080, 128) to 950 (#000000): 128 × 0.6 ≈ 77 = 0x4d.
  assert.equal(r["700"], "#4d4d4d");
});

test("the shop sells at least four paid themes", () => {
  assert.ok(THEMES.filter((t) => t.cost > 0).length >= 4);
});
