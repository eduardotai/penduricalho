import { test } from "node:test";
import assert from "node:assert/strict";
import { computeViewTransform, visibleWorldRect, zoneSpawnRect } from "../src/game/viewTransform";

const ANCHOR = { x: 1920, y: 1392 };

test("visible rect at zoom 1 / no pan is the covered world", () => {
  const view = computeViewTransform(1280, 800, 3840, 2400);
  const r = visibleWorldRect(view, ANCHOR, 1, 0, 0);
  assert.ok(Math.abs(r.x) < 1e-6 && Math.abs(r.y) < 1e-6);
  assert.ok(Math.abs(r.w - 3840) < 1e-6 && Math.abs(r.h - 2400) < 1e-6);
});

test("cageScale 1 maps keep the full cage", () => {
  const cage = { x: 0, y: 0, w: 3840, h: 2400 };
  assert.deepEqual(zoneSpawnRect(cage, { x: 500, y: 500, w: 100, h: 100 }, 1), cage);
});

test("big cages spawn inside the on-screen part of the cage", () => {
  const cage = { x: -1728, y: -1080, w: 7296, h: 4560 }; // colosseum 1.9x
  const view = computeViewTransform(1280, 800, 3840, 2400);
  const vis = visibleWorldRect(view, ANCHOR, 0.9, 0, 0);
  const r = zoneSpawnRect(cage, vis, 1.9);
  assert.ok(r.x >= vis.x - 1e-6 && r.x + r.w <= vis.x + vis.w + 1e-6);
  assert.ok(r.y >= vis.y - 1e-6 && r.y + r.h <= vis.y + vis.h + 1e-6);
  assert.ok(r.w * r.h < cage.w * cage.h);
});

test("falls back to the cage when the camera is panned away", () => {
  const cage = { x: 0, y: 0, w: 1000, h: 1000 };
  assert.deepEqual(zoneSpawnRect(cage, { x: 990, y: 990, w: 500, h: 500 }, 1.45), cage);
});
