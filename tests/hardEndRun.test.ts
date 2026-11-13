import "./memoryStorage";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useGameStore } from "../src/state/store";
import Matter from "matter-js";
import { ANCHOR, CAMERA_PAN_X_DEFAULT, CAMERA_PAN_Y_DEFAULT, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from "../src/game/worldConstants";
import { clearZonesAround, generateHitZones } from "../src/game/hitZones";
import { SITE_MAP } from "../src/data/sites";

test("Hard End Run rebuilds the arena but keeps earned momentum and ready golden tokens", () => {
  useGameStore.setState({
    isRunning: true,
    runMomentum: 1234,
    momentum: 50_000,
    pendingGoldenTokens: 2,
    cameraPanX: 420,
    cameraPanY: -310,
    cameraZoom: 0.7,
  });
  const before = useGameStore.getState();
  const wv = before.worldVersion;
  before.hardEndRun();
  const s = useGameStore.getState();
  assert.equal(s.worldVersion, wv + 1, "canvas world is torn down and rebuilt");
  assert.equal(s.isRunning, false);
  assert.equal(s.runMomentum, 0);
  assert.equal(s.momentum, 50_000, "earned momentum is kept");
  assert.equal(s.pendingGoldenTokens, 2, "ready golden tokens are kept");
  assert.equal(s.cameraPanX, CAMERA_PAN_X_DEFAULT);
  assert.equal(s.cameraPanY, CAMERA_PAN_Y_DEFAULT);
  assert.equal(s.cameraZoom, 0.7, "zoom is a saved preference");
  assert.equal(s.bestRunMomentum >= 1234, true, "the closed run still counts");
});

test("a freshly built field keeps circles off the resting rig", () => {
  const world = Matter.World.create({});
  const site = SITE_MAP.get("bumper-cage")!;
  const rest = { x: ANCHOR.x, y: ANCHOR.y + 900 };
  const field = generateHitZones(world, site, { x: 0, y: 0, w: VIRTUAL_WIDTH, h: VIRTUAL_HEIGHT }, ANCHOR, 900, 90);
  // Force a few circles right onto the rest pose.
  for (const h of field.zones.slice(0, 3)) h.zone.position = { ...rest };
  const moved = clearZonesAround(field, [rest], 90, 900, 90);
  assert.ok(moved >= 3);
  for (const h of field.zones) {
    assert.ok(Math.hypot(h.zone.position.x - rest.x, h.zone.position.y - rest.y) > 90 + h.zone.radius);
  }
});
