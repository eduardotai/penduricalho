import { test } from "node:test";
import assert from "node:assert/strict";
import { MusicController, PRELOAD_LEAD_S, type MusicBackend, type VoiceEvents, type VoiceHandle } from "../src/audio/musicController";
import { CROSSFADE_MS, type MusicTrack } from "../src/audio/musicTracks";

const mk = (id: string, mood: "menu" | "run"): MusicTrack => ({
  id, title: id, author: "t", license: "CC0-1.0", source: "t", mood, src: [`/${id}.ogg`],
});
const TRACKS = [mk("menu", "menu"), mk("a", "run"), mk("b", "run"), mk("c", "run")];
const DUR = 30; // seconds per fake track

/** Simulated audio: voices advance with the fake clock while playing. */
class FakeVoice implements VoiceHandle {
  playing = false; vol = 0; target = 0; pos = 0; disposed = false; loaded = false;
  constructor(public id: string, public ev: VoiceEvents, public world: World) {}
  play() { if (!this.disposed && this.loaded) this.playing = true; }
  pause() { this.playing = false; }
  setVolume(v: number) { this.vol = v; this.target = v; }
  fadeTo(v: number) { this.target = v; this.vol = Math.max(this.vol, 0.0001) && v > this.vol ? Math.max(this.vol, v * 0.5) : this.vol; }
  position() { return this.pos; }
  duration() { return this.loaded ? this.world.durations[this.id] ?? DUR : 0; }
  isPlaying() { return this.playing; }
  dispose() { this.disposed = true; this.playing = false; }
  audible() { return this.playing && !this.disposed && Math.max(this.vol, this.target) > 0.01; }
}

class World {
  t = 0;
  voices: FakeVoice[] = [];
  loadMs = 300;
  failLoad = new Set<string>();
  durations: Record<string, number> = {};
  backend: MusicBackend = {
    create: (track, ev) => {
      const v = new FakeVoice(track.id, ev, this);
      const at = this.t + this.loadMs;
      this.timers.push({ at, fn: () => { if (v.disposed) return; if (this.failLoad.has(track.id)) ev.onError("load"); else { v.loaded = true; ev.onLoad(); } } });
      this.voices.push(v);
      return v;
    },
  };
  timers: { at: number; fn: () => void }[] = [];
  ctl = new MusicController(this.backend, () => this.t, TRACKS);
  /** Advance time in 100 ms steps; tick the controller every 200 ms. Returns silent stretches (ms). */
  run(ms: number, opts: { expectSilent?: boolean } = {}) {
    const gaps: number[] = []; let gap = 0;
    for (let s = 0; s < ms; s += 100) {
      this.t += 100;
      for (const v of this.voices) {
        if (v.playing) {
          v.vol = v.target;
          v.pos += 0.1;
          if (v.pos >= this.durationOf(v)) { v.pos = 0; v.playing = false; v.ev.onEnd(); }
        }
      }
      const due = this.timers.filter((x) => x.at <= this.t);
      this.timers = this.timers.filter((x) => x.at > this.t);
      due.forEach((x) => x.fn());
      if (this.t % 200 === 0) this.ctl.tick();
      const audible = this.voices.some((v) => v.audible());
      if (!audible && !opts.expectSilent) gap += 100; else { if (gap) gaps.push(gap); gap = 0; }
    }
    if (gap) gaps.push(gap);
    return gaps;
  }
  durationOf(v: FakeVoice) { return this.durations[v.id] ?? DUR; }
  playingIds() { return this.voices.filter((v) => v.audible()).map((v) => v.id); }
}

test("menu theme loops onto itself with an overlap, never a gap", () => {
  const w = new World();
  w.ctl.setLevel(0.6);
  const startup = w.run(1000);
  assert.ok(startup.every((g) => g <= 600), `startup gap ${startup}`);
  const gaps = w.run(5 * DUR * 1000);
  assert.deepEqual(gaps, []);
  assert.ok(w.voices.filter((v) => v.id === "menu").length >= 5, "menu voice re-created for each loop");
  assert.ok(w.voices.filter((v) => !v.disposed).length <= 2, "old voices are released");
});

test("arena playlist chains back-to-back and wraps around", () => {
  const w = new World();
  w.ctl.setLevel(0.6);
  w.run(1000);
  w.ctl.setMood("run");
  const order: string[] = [];
  let last = "";
  for (let i = 0; i < 4 * DUR * 10 + 50; i++) {
    const g = w.run(100);
    assert.deepEqual(g, [], `gap at t=${w.t}`);
    const cur = w.ctl.nowPlaying!;
    if (cur !== last) { order.push(cur); last = cur; }
  }
  assert.deepEqual(order.slice(order.indexOf("a"), order.indexOf("a") + 5), ["a", "b", "c", "a", "b"]);
});

test("mood switch keeps the old track audible until the new one is loaded", () => {
  const w = new World();
  w.loadMs = 2500; // slow network
  w.ctl.setLevel(0.6);
  w.run(3000);
  w.ctl.setMood("run");
  assert.deepEqual(w.run(2000), []);
  assert.equal(w.ctl.nowPlaying, "menu", "still on the menu track while 'a' loads");
  w.run(1500);
  assert.equal(w.ctl.nowPlaying, "a");
  w.ctl.setMood("menu");
  assert.deepEqual(w.run(DUR * 1000), []);
  assert.equal(w.ctl.nowPlaying, "menu");
});

test("mute / hidden tab pauses, unmute resumes the same voice where it was", () => {
  const w = new World();
  w.ctl.setLevel(0.6);
  w.run(5000);
  const v = w.voices.find((x) => x.playing)!;
  const pos = v.pos;
  w.ctl.setLevel(0);
  w.run(3000, { expectSilent: true });
  assert.equal(v.playing, false);
  assert.equal(w.ctl.nowPlaying, null);
  w.ctl.setLevel(0.6);
  assert.deepEqual(w.run(500), []);
  assert.equal(v.playing, true, "same voice resumed");
  assert.ok(v.pos >= pos, "resumed where it paused, not restarted");
  assert.deepEqual(w.run(DUR * 2000), []);
});

test("mood changes while muted start the new mood on unmute", () => {
  const w = new World();
  w.ctl.setLevel(0.6);
  w.run(2000);
  w.ctl.setLevel(0);
  w.run(1000, { expectSilent: true });
  w.ctl.setMood("run");
  w.ctl.setLevel(0.6);
  w.run(1000);
  assert.equal(w.ctl.nowPlaying, "a");
});

test("a track that fails to load is skipped; the music keeps going", () => {
  const w = new World();
  w.failLoad.add("b");
  w.ctl.setLevel(0.6);
  w.run(1000);
  w.ctl.setMood("run");
  const gaps = w.run(4 * DUR * 1000);
  // At most the retry delay of silence once 'a' ends and 'b' failed during preload.
  assert.ok(gaps.every((g) => g <= 2000), `gaps ${gaps}`);
  assert.ok(w.voices.some((v) => v.id === "c" && v.loaded), "moved on to c");
});

test("a voice that stops on its own is restarted by the watchdog", () => {
  const w = new World();
  w.ctl.setLevel(0.6);
  w.run(4000);
  const v = w.voices.find((x) => x.playing)!;
  v.playing = false; // e.g. the browser paused the element
  const gaps = w.run(4000);
  assert.ok(gaps.every((g) => g <= 1600), `gaps ${gaps}`);
  assert.equal(v.playing, true);
});

test("skip crossfades to the next arena track", () => {
  const w = new World();
  w.ctl.setLevel(0.6);
  w.run(1000);
  w.ctl.setMood("run");
  w.run(2000);
  w.ctl.skip();
  assert.deepEqual(w.run(2000), []);
  assert.equal(w.ctl.nowPlaying, "b");
});

test("constants keep a crossfade shorter than the preload lead", () => {
  assert.ok(CROSSFADE_MS / 1000 < PRELOAD_LEAD_S);
});
