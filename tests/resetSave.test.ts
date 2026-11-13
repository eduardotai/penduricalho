import "./memoryStorage";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useGameStore } from "../src/state/store";
import { DEFAULT_THEME_ID } from "../src/data/themes";
import { STRINGS } from "../src/i18n/strings";

// Decision: Settings → Reset Save stays a TRUE full reset (new game), themes
// included. The confirm text has to say so in every language.
test("Reset Save is a full wipe, purchased themes and prestige included", () => {
  useGameStore.setState({
    momentum: 9_999,
    ownedThemes: [DEFAULT_THEME_ID, "neon", "watchmaker"],
    themeId: "neon",
    prestigeCogs: 4,
    globalUpgrades: ["global-x2"],
  });
  useGameStore.getState().reset();
  const s = useGameStore.getState();
  assert.equal(s.momentum, 0);
  assert.deepEqual(s.ownedThemes, [DEFAULT_THEME_ID]);
  assert.equal(s.themeId, DEFAULT_THEME_ID);
  assert.equal(s.prestigeCogs, 0);
  assert.deepEqual(s.globalUpgrades, []);
});

test("the reset confirm warns about themes, Cogs and boosts in every language", () => {
  for (const [lang, t] of Object.entries(STRINGS)) {
    const msg = (t as any).customize.resetConfirm as string;
    assert.match(msg, /tem[ae]s|themes/i, `${lang}: themes`);
    assert.match(msg, /Cogs|Engrenagens/, `${lang}: prestige`);
    assert.match(msg, /×2\/×3/, `${lang}: boosts`);
  }
});
