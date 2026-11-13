import { test } from "node:test";
import assert from "node:assert/strict";
import { createEffectsState, emitHit } from "../src/game/effects";
import { drawEffects } from "../src/game/render";

// A 2D context stub that throws like Chrome does on a negative arc radius.
function strictCtx() {
  const radii: number[] = [];
  const noop = () => {};
  const ctx = new Proxy(
    {
      arc: (_x: number, _y: number, r: number) => {
        if (r < 0) throw new Error(`IndexSizeError: The radius provided (${r}) is negative.`);
        radii.push(r);
      },
    } as Record<string, unknown>,
    { get: (t, k) => (k in t ? t[k as string] : noop), set: () => true }
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, radii };
}

test("a hit stamped after the frame clock (hit-stop / collision time) never draws a negative flash radius", () => {
  const eff = createEffectsState();
  const frameNow = 1000;
  // Collisions use performance.now(), which can be ~40 ms ahead of the frame's
  // clock (and further during hit-stop): the flash's `until` is > now + 220.
  emitHit(eff, { x: 10, y: 10 }, frameNow + 60);
  const { ctx, radii } = strictCtx();
  assert.doesNotThrow(() => drawEffects({ ctx, width: 100, height: 100, now: frameNow }, eff));
  assert.ok(radii.length > 0);
  assert.ok(radii.every((r) => r >= 0));
});
