import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  MUSIC_TRACKS,
  RUN_MOOD_LINGER_MS,
  musicLevel,
  nextTrackFor,
  resolveMood,
} from "../src/audio/musicTracks";

test("there is a menu theme and at least two arena tracks", () => {
  assert.ok(MUSIC_TRACKS.filter((t) => t.mood === "menu").length >= 1);
  assert.ok(MUSIC_TRACKS.filter((t) => t.mood === "run").length >= 2);
});

test("every track is CC0, streams from public/, and ships an ogg + mp3", () => {
  for (const t of MUSIC_TRACKS) {
    assert.equal(t.license, "CC0-1.0", t.id);
    assert.deepEqual(
      t.src.map((s) => s.split(".").pop()),
      ["ogg", "mp3"],
      t.id
    );
    for (const s of t.src) assert.ok(existsSync(`public${s}`), `missing public${s}`);
  }
});

test("arena tracks rotate without repeating the current one", () => {
  const run = MUSIC_TRACKS.filter((t) => t.mood === "run");
  assert.equal(nextTrackFor("run", null).id, run[0].id);
  assert.equal(nextTrackFor("run", run[0].id).id, run[1].id);
  assert.equal(nextTrackFor("run", run[run.length - 1].id).id, run[0].id);
  // a track from the other mood is not "current" for this mood
  assert.equal(nextTrackFor("run", "bench-at-rest").id, run[0].id);
});

test("mood: arena while running and for the linger window, menu after", () => {
  assert.equal(resolveMood(true, null, 0), "run");
  assert.equal(resolveMood(false, null, 1000), "menu");
  assert.equal(resolveMood(false, 1000, 1000 + RUN_MOOD_LINGER_MS - 1), "run");
  assert.equal(resolveMood(false, 1000, 1000 + RUN_MOOD_LINGER_MS), "menu");
});

test("music level respects mute, the music toggle and both volume sliders", () => {
  const base = { muted: false, musicEnabled: true, masterVolume: 0.5, musicVolume: 0.4 };
  assert.equal(musicLevel(base), 0.2);
  assert.equal(musicLevel({ ...base, muted: true }), 0);
  assert.equal(musicLevel({ ...base, musicEnabled: false }), 0);
  assert.equal(musicLevel({ ...base, masterVolume: 3, musicVolume: 1 }), 1);
});
