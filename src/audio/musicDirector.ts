import { Howl } from "howler";
import { MUSIC_TRACK_MAP, type MusicMood } from "./musicTracks";
import { MusicController, type MusicBackend, type VoiceHandle } from "./musicController";

/**
 * Howler backend for the soundtrack. Each voice is its own html5 Howl so the
 * file streams (nothing decoded up front) and is created lazily, one track
 * ahead at most; voices are unloaded once they fade out. All sequencing lives
 * in MusicController (unit-tested).
 */
const howlerBackend: MusicBackend = {
  create(track, events): VoiceHandle {
    let id: number | undefined;
    let wantPlaying = false;
    // Howler 2.2 html5 quirk: while a play() promise is pending it queues
    // volume()/fade()/pause() calls, but its 'play' event only drains queued
    // *play* tasks, so a queued fade never runs and the track plays at volume
    // 0 (the "music stops" bug). The getter also returns the Howl instead of a
    // number then. So we hold our own ops until our 'play' event arrives.
    let locked = false;
    let held: (() => void)[] = [];
    const whenReady = (fn: () => void) => {
      if (locked) held.push(fn);
      else fn();
    };
    const release = () => {
      locked = false;
      const ops = held;
      held = [];
      ops.forEach((fn) => fn());
    };
    const current = () => {
      if (id === undefined) return 0;
      const v = howl.volume(id) as unknown;
      return typeof v === "number" && Number.isFinite(v) ? v : 0;
    };
    const howl = new Howl({
      src: track.src,
      html5: true,
      preload: true,
      loop: false,
      volume: 0,
      onload: () => events.onLoad(),
      onplay: () => release(),
      onend: () => events.onEnd(),
      onloaderror: () => events.onError("load"),
      onplayerror: () => {
        release();
        events.onError("play");
        howl.once("unlock", () => {
          if (wantPlaying && id !== undefined && !howl.playing(id)) howl.play(id);
        });
      },
    });
    return {
      play() {
        wantPlaying = true;
        whenReady(() => {
          if (!wantPlaying) return;
          if (id === undefined) {
            locked = true;
            id = howl.play();
          } else if (!howl.playing(id)) {
            locked = true;
            howl.play(id);
          }
        });
      },
      pause() {
        wantPlaying = false;
        whenReady(() => {
          if (id !== undefined && !wantPlaying) howl.pause(id);
        });
      },
      setVolume(v) {
        whenReady(() => {
          if (id !== undefined) howl.volume(v, id);
          else howl.volume(v);
        });
      },
      fadeTo(v, ms) {
        whenReady(() => {
          if (id === undefined) {
            howl.volume(v);
            return;
          }
          howl.fade(current(), v, ms, id);
        });
      },
      position() {
        if (id === undefined) return 0;
        const s = howl.seek(id);
        return typeof s === "number" ? s : 0;
      },
      duration() {
        return howl.duration() || 0;
      },
      isPlaying() {
        return id !== undefined && howl.playing(id);
      },
      dispose() {
        wantPlaying = false;
        howl.unload();
      },
    };
  },
};

class MusicDirectorImpl {
  private ctl = new MusicController(howlerBackend, () => performance.now());
  private timer: number | null = null;

  get nowPlaying() {
    return this.ctl.nowPlaying;
  }

  subscribe(fn: (trackId: string | null) => void) {
    return this.ctl.subscribe(fn);
  }

  private ensureTimer() {
    if (this.timer === null && typeof window !== "undefined") {
      this.timer = window.setInterval(() => this.ctl.tick(), 200);
    }
  }

  /** Target loudness 0..1; 0 fades out and pauses (mute, music off, hidden tab). */
  setLevel(level: number) {
    if (level > 0) this.ensureTimer();
    this.ctl.setLevel(level);
  }

  setMood(mood: MusicMood) {
    this.ctl.setMood(mood);
  }

  next() {
    this.ctl.skip();
  }

  /** Diagnostics (window.__music in the console). */
  get debug() {
    return this.ctl.debug;
  }
}

export const MusicDirector = new MusicDirectorImpl();
if (typeof window !== "undefined") (window as unknown as { __music?: unknown }).__music = MusicDirector;

export function trackTitle(id: string | null): string | null {
  return id ? (MUSIC_TRACK_MAP.get(id)?.title ?? null) : null;
}
