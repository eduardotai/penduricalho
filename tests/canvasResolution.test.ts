import { test } from "node:test";
import assert from "node:assert/strict";
import { CANVAS_MAX_PIXELS, canvasDpr } from "../src/game/canvasResolution";

test("a 1366×820 laptop stays at 1× when the display is 1×", () => {
  assert.equal(canvasDpr(1366, 820, 1), 1);
});

test("a 1366×820 retina display is capped near the pixel budget, not 2×", () => {
  const dpr = canvasDpr(1366, 820, 2);
  assert.ok(dpr < 1.3, `dpr=${dpr}`);
  assert.ok(dpr > 1.05, `dpr=${dpr}`);
  assert.ok(1366 * 820 * dpr * dpr <= CANVAS_MAX_PIXELS + 1);
});

test("a phone-sized canvas keeps a 2× backing store", () => {
  assert.equal(canvasDpr(390, 844, 2), 2);
  assert.equal(canvasDpr(390, 844, 3), 2, "still clamped to max 2×");
});

test("a 1080p retina window drops to ~1× instead of 4 million pixels", () => {
  const dpr = canvasDpr(1920, 1080, 2);
  assert.ok(dpr < 1, `dpr=${dpr}`);
  assert.ok(dpr > 0.8, `dpr=${dpr}`);
  assert.ok(1920 * 1080 * dpr * dpr <= CANVAS_MAX_PIXELS + 1);
});

test("a 4K window does not go below the 0.75 floor", () => {
  assert.equal(canvasDpr(3840, 2160, 2), 0.75);
});

test("bogus sizes and ratios stay finite and inside the clamp", () => {
  const dpr = canvasDpr(0, 0, 2);
  assert.ok(Number.isFinite(dpr));
  assert.ok(dpr >= 0.75 && dpr <= 2);
  assert.equal(canvasDpr(800, 600, 0), 1, "a missing device ratio is treated as 1×");
});
