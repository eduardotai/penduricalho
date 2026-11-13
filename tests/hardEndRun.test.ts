import "./memoryStorage";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useGameStore } from "../src/state/store";
import { CAMERA_PAN_X_DEFAULT, CAMERA_PAN_Y_DEFAULT } from "../src/game/worldConstants";

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
