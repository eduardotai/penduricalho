import { CROSSFADE_MS, nextTrackFor, type MusicMood, type MusicTrack } from "./musicTracks";

/**
 * The soundtrack state machine, free of audio APIs so it can be unit-tested
 * with a fake backend and a fake clock (musicDirector.ts wires it to Howler).
 *
 * Rules that keep the music continuous:
 * - The next voice is preloaded PRELOAD_LEAD_S before the current one ends and
 *   started CROSSFADE_MS before the end, so tracks (and a single-track mood
 *   looping onto itself) overlap instead of leaving a gap. Nothing depends on
 *   the file's exact end (MP3 encoder padding, html5 'ended' timing).
 * - A mood switch or skip loads the new track while the old one keeps playing
 *   at full level; the crossfade starts only once the new one is ready.
 * - Level 0 (mute, music off, hidden tab) fades and pauses the current voice;
 *   raising the level resumes it where it was.
 * - A voice that should be playing but isn't (ended early, stalled, autoplay
 *   refused) is restarted or replaced by the watchdog on the next tick.
 */

export interface VoiceEvents {
  onLoad(): void;
  onEnd(): void;
  onError(kind: "load" | "play"): void;
}

export interface VoiceHandle {
  /** Starts, or resumes after pause(). Safe to call repeatedly. */
  play(): void;
  pause(): void;
  setVolume(v: number): void;
  fadeTo(v: number, ms: number): void;
  /** Seconds into the track. */
  position(): number;
  /** Track length in seconds, 0 while unknown. */
  duration(): number;
  isPlaying(): boolean;
  dispose(): void;
}

export interface MusicBackend {
  create(track: MusicTrack, events: VoiceEvents): VoiceHandle;
}

/** Start loading the follow-up voice this many seconds before the current one ends. */
export const PRELOAD_LEAD_S = 12;
/** First fade-in (nothing to crossfade from). */
export const FADE_IN_MS = 900;
/** Fade before pausing for mute / hidden tab. */
export const FADE_OUT_MS = 400;
/** A voice that should be playing but isn't for this long gets kicked. */
export const STALL_MS = 1200;
const EPS = 0.0001;

interface Voice {
  track: MusicTrack;
  handle: VoiceHandle;
  loaded: boolean;
  started: boolean;
  ended: boolean;
  /** Paused on purpose (level 0). */
  paused: boolean;
  pauseAt: number | null;
  stalledSince: number | null;
}

interface Outgoing {
  voice: Voice;
  disposeAt: number;
}

type Listener = (trackId: string | null) => void;

export class MusicController {
  private level = 0;
  private mood: MusicMood = "menu";
  private current: Voice | null = null;
  private pending: Voice | null = null;
  /** "switch": replace current as soon as loaded; "handoff": at the end of current. */
  private pendingKind: "switch" | "handoff" = "handoff";
  private outgoing: Outgoing[] = [];
  private retryAt = 0;
  private failures = 0;
  private lastTrackId: string | null = null;
  private listeners = new Set<Listener>();

  constructor(
    private backend: MusicBackend,
    private now: () => number,
    private tracks: readonly MusicTrack[] | undefined = undefined
  ) {}

  get nowPlaying(): string | null {
    return this.level > EPS && this.current ? this.current.track.id : null;
  }

  /** For tests/diagnostics. */
  get debug() {
    return {
      level: this.level,
      mood: this.mood,
      current: this.current?.track.id ?? null,
      pending: this.pending?.track.id ?? null,
      pendingKind: this.pendingKind,
      outgoing: this.outgoing.length,
    };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.nowPlaying);
  }

  /** Tracks that failed to load are skipped for a while. */
  private failedUntil = new Map<string, number>();

  private next(mood: MusicMood, currentId: string | null) {
    const now = this.now();
    let t = nextTrackFor(mood, currentId, this.tracks);
    const first = t;
    while ((this.failedUntil.get(t.id) ?? 0) > now) {
      t = nextTrackFor(mood, t.id, this.tracks);
      if (t.id === first.id) break; // everything failed: try anyway (retryAt throttles)
    }
    return t;
  }

  setLevel(level: number) {
    const next = Math.max(0, Math.min(1, level));
    const was = this.level;
    this.level = next;
    if (next <= EPS) {
      if (was > EPS) {
        this.dropPending();
        for (const o of this.outgoing) this.dispose(o.voice);
        this.outgoing = [];
        const c = this.current;
        if (c && c.started && !c.paused) {
          c.handle.fadeTo(0, FADE_OUT_MS);
          c.pauseAt = this.now() + FADE_OUT_MS;
        }
      }
      this.emit();
      return;
    }
    const c = this.current;
    if (!c) {
      this.tick();
      this.emit();
      return;
    }
    if (c.paused || c.pauseAt !== null) {
      const wasPaused = c.paused;
      c.paused = false;
      c.pauseAt = null;
      c.stalledSince = null;
      if (wasPaused) c.handle.setVolume(0);
      if (c.loaded) c.handle.play();
      c.handle.fadeTo(next, FADE_OUT_MS);
    } else if (c.started) {
      c.handle.fadeTo(next, 250);
    }
    this.tick();
    this.emit();
  }

  setMood(mood: MusicMood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this.level <= EPS) {
      // Silent: drop everything so the next unmute starts in the new mood.
      this.dropPending();
      if (this.current) this.dispose(this.current);
      this.current = null;
      this.lastTrackId = null;
      return;
    }
    this.requestSwitch(this.next(mood, null));
  }

  /** Skip to the next track of the current mood. */
  skip() {
    if (this.level <= EPS) return;
    this.requestSwitch(this.next(this.mood, this.current?.track.id ?? null));
  }

  private requestSwitch(track: MusicTrack) {
    this.dropPending();
    this.pending = this.create(track);
    this.pendingKind = "switch";
  }

  private create(track: MusicTrack): Voice {
    const voice: Voice = {
      track,
      handle: null as unknown as VoiceHandle,
      loaded: false,
      started: false,
      ended: false,
      paused: false,
      pauseAt: null,
      stalledSince: null,
    };
    voice.handle = this.backend.create(track, {
      onLoad: () => {
        voice.loaded = true;
        this.tick();
      },
      onEnd: () => {
        voice.ended = true;
        this.tick();
      },
      onError: (kind) => this.onError(voice, kind),
    });
    return voice;
  }

  private start(v: Voice, fadeMs: number) {
    v.started = true;
    v.handle.setVolume(0);
    v.handle.play();
    v.handle.fadeTo(this.level, fadeMs);
  }

  /** Crossfades from current to pending. */
  private promote() {
    const v = this.pending;
    if (!v) return;
    this.pending = null;
    const old = this.current;
    this.start(v, old ? CROSSFADE_MS : FADE_IN_MS);
    if (old) this.retire(old, CROSSFADE_MS);
    this.current = v;
    this.lastTrackId = v.track.id;
    this.failures = 0;
    this.emit();
  }

  private retire(v: Voice, ms: number) {
    if (v.started && !v.ended && !v.paused) {
      v.handle.fadeTo(0, ms);
      this.outgoing.push({ voice: v, disposeAt: this.now() + ms + 150 });
    } else {
      this.dispose(v);
    }
  }

  private dropPending() {
    if (this.pending) this.dispose(this.pending);
    this.pending = null;
  }

  private dispose(v: Voice) {
    v.ended = true;
    v.handle.dispose();
  }

  private onError(v: Voice, kind: "load" | "play") {
    if (kind === "play") {
      // Autoplay refused or the element hiccuped: the watchdog retries play().
      v.stalledSince ??= this.now();
      return;
    }
    this.failures++;
    this.failedUntil.set(v.track.id, this.now() + 60_000);
    this.retryAt = this.now() + Math.min(10_000, 1500 * this.failures);
    if (v === this.pending) {
      this.dispose(v);
      this.pending = null;
    } else if (v === this.current) {
      this.dispose(v);
      this.current = null;
    }
  }

  /** Advances the machine; call every ~200 ms and after any event. */
  tick() {
    const now = this.now();
    // Finished crossfades.
    if (this.outgoing.length) {
      const keep: Outgoing[] = [];
      for (const o of this.outgoing) {
        if (now >= o.disposeAt || o.voice.ended) this.dispose(o.voice);
        else keep.push(o);
      }
      this.outgoing = keep;
    }
    const c = this.current;
    if (c && c.pauseAt !== null && now >= c.pauseAt) {
      c.pauseAt = null;
      c.paused = true;
      c.handle.pause();
    }
    if (this.level <= EPS) return;

    if (!c && !this.pending) {
      if (now < this.retryAt) return;
      this.pending = this.create(this.next(this.mood, this.lastTrackId));
      this.pendingKind = "switch";
    }

    const cur = this.current;
    if (cur && cur.started && !cur.ended && !cur.paused && cur.pauseAt === null) {
      const dur = cur.handle.duration();
      const rem = dur > 0 ? dur - cur.handle.position() : Infinity;
      if (!this.pending && rem <= PRELOAD_LEAD_S) {
        this.pending = this.create(this.next(this.mood, cur.track.id));
        this.pendingKind = "handoff";
      }
      // Watchdog: should be playing but isn't. At the very end, treat it as
      // ended even if the backend never reported it.
      if (!cur.handle.isPlaying() && rem <= 0.25) {
        cur.ended = true;
      } else if (!cur.handle.isPlaying()) {
        cur.stalledSince ??= now;
        if (now - cur.stalledSince >= STALL_MS) {
          cur.stalledSince = now;
          cur.handle.play();
          cur.handle.fadeTo(this.level, 250);
        }
      } else {
        cur.stalledSince = null;
      }
      if (this.pending?.loaded && this.pendingKind === "handoff" && rem <= CROSSFADE_MS / 1000 + 0.1) {
        this.promote();
        return;
      }
    }

    if (this.pending?.loaded) {
      const curGone = !this.current || this.current.ended;
      if (this.pendingKind === "switch" || curGone) this.promote();
    } else if (cur && cur.ended && !this.pending) {
      // Ended with nothing queued (preload missed): queue the follow-up now.
      this.pending = this.create(this.next(this.mood, cur.track.id));
      this.pendingKind = "handoff";
    }
  }
}
