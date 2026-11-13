import "./memoryStorage";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useUiPrefs, UI_PREFS_KEY } from "../src/state/uiPrefs";

test("workshop is collapsed by default and not yet seen", () => {
  const s = useUiPrefs.getState();
  assert.equal(s.workshopOpen, false);
  assert.equal(s.workshopSeen, false);
});

test("toggling the workshop persists under its own key, not the game save", () => {
  useUiPrefs.getState().toggleWorkshop();
  assert.equal(useUiPrefs.getState().workshopOpen, true);
  assert.equal(useUiPrefs.getState().workshopSeen, true);
  const raw = JSON.parse(localStorage.getItem(UI_PREFS_KEY) ?? "{}");
  assert.equal(raw.state.workshopOpen, true);
  assert.equal(raw.state.workshopSeen, true);
  useUiPrefs.getState().toggleWorkshop();
  assert.equal(useUiPrefs.getState().workshopOpen, false);
  assert.equal(useUiPrefs.getState().workshopSeen, true, "seen flag sticks after closing");
  assert.notEqual(UI_PREFS_KEY, "pendulum-clicker-save");
});
