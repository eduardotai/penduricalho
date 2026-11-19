import { test } from "node:test";
import assert from "node:assert/strict";
import { drawStaticLayer, snapToDevice, type LayerSlot } from "../src/game/themes/artUtils";

type Call = [string, ...unknown[]];

// Records every call; getTransform returns the matrix given at creation.
function recordingCtx(m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) {
  const calls: Call[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, k) =>
      k === "getTransform" ? () => m : (...args: unknown[]) => void calls.push([String(k), ...args]),
    set: () => true,
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

// Offscreen canvases created by cachedLayer().
const created: { width: number; height: number; calls: Call[] }[] = [];
(globalThis as { document?: unknown }).document = {
  createElement: () => {
    const rec = recordingCtx();
    const c = { width: 0, height: 0, calls: rec.calls, getContext: () => rec.ctx };
    created.push(c);
    return c;
  },
};

test("a static layer is painted once at device pixels and blitted 1:1 afterwards", () => {
  created.length = 0;
  const slot: LayerSlot = { key: "", canvas: null };
  let paints = 0;
  const paint = (g: CanvasRenderingContext2D, w: number, h: number) => {
    paints++;
    assert.equal(w, 683);
    assert.equal(h, 410);
    g.fillRect(0, 0, w, h);
  };
  const frame = recordingCtx({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
  for (let i = 0; i < 5; i++) drawStaticLayer(frame.ctx, slot, "base:a", 683, 410, paint);

  assert.equal(paints, 1);
  assert.equal(created.length, 1);
  assert.equal(created[0].width, 1366);
  assert.equal(created[0].height, 820);
  // The painter draws in CSS units onto a context scaled to device pixels.
  assert.ok(created[0].calls.some((c) => c[0] === "scale" && c[1] === 2 && c[2] === 2));
  // Each frame: reset to an unscaled transform and copy without resampling.
  const blits = frame.calls.filter((c) => c[0] === "drawImage");
  assert.equal(blits.length, 5);
  for (const b of blits) assert.deepEqual(b.slice(2), [0, 0]);
  assert.ok(frame.calls.some((c) => c[0] === "setTransform" && c[1] === 1 && c[4] === 1));
});

test("a static layer repaints when its key or the device scale changes", () => {
  created.length = 0;
  const slot: LayerSlot = { key: "", canvas: null };
  let paints = 0;
  const paint = () => void paints++;
  const at1 = recordingCtx();
  const at116 = recordingCtx({ a: 1.16, b: 0, c: 0, d: 1.16, e: 0, f: 0 });
  drawStaticLayer(at1.ctx, slot, "base:a", 100, 50, paint);
  drawStaticLayer(at1.ctx, slot, "base:a", 100, 50, paint);
  drawStaticLayer(at1.ctx, slot, "base:b", 100, 50, paint);
  drawStaticLayer(at116.ctx, slot, "base:b", 100, 50, paint);
  drawStaticLayer(at116.ctx, slot, "base:b", 100, 50, paint);
  assert.equal(paints, 3);
  // Same size, new key: the backing canvas is cleared and reused, not reallocated.
  assert.equal(created.length, 2);
  assert.equal(created.at(-1)!.width, 116);
  assert.equal(created.at(-1)!.height, 58);
  assert.ok(created[0].calls.some((c) => c[0] === "clearRect"));
});

test("a rotated transform falls back to a scaled draw", () => {
  const slot: LayerSlot = { key: "", canvas: null };
  const rot = recordingCtx({ a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 });
  drawStaticLayer(rot.ctx, slot, "k", 40, 30, () => {});
  const blit = rot.calls.find((c) => c[0] === "drawImage")!;
  assert.deepEqual(blit.slice(2), [0, 0, 40, 30]);
});

test("snapToDevice rounds parallax offsets to whole device pixels", () => {
  assert.equal(snapToDevice(10.3, 1), 10);
  assert.equal(snapToDevice(10.3, 2), 10.5);
  assert.equal(snapToDevice(-0.2, 2), -0);
  assert.equal(snapToDevice(7.24, 1.16) * 1.16, 8);
});
