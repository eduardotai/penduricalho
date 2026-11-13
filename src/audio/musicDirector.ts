import { Howl } from "howler";
import {
  CROSSFADE_MS,
  MUSIC_TRACK_MAP,
  nextTrackFor,
  type MusicMood,
  type MusicTrack,
} from "./musicTracks";

/**
 * Plays the soundtrack: one track at a time per mood, crossfading between
 * tracks and moods. Tracks are streamed (Howler html5 mode, created lazily
 * on first use and unloaded after they fade out), so nothing is decoded or
 * downloaded until it is about to play.
 */

interface Voice {
  track: MusicTrack;
  howl: Howl;
  dead: boolean;
}

type Listener = (trackId: string | null) => void;

class MusicDirectorImpl {
  private level = 0;
  private mood: MusicMood = "menu";
  private current: Voice | null = null;
  private listeners = new Set<Listener>();

  /** Track id currently audible (null when silent). */
  get nowPlaying(): string | null {
    return this.level > 0 && this.current ? this.current.track.id : null;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.nowPlaying);
  }

  /** Sets the target loudness (0..1). 0 fades out and pauses. */
  setLevel(level: number) {
    const next = Math.max(0, Math.min(1, level));
    const was = this.level;
    this.level = next;
    if (next <= 0.0001) {
      if (this.current && was > 0.0001) this.fadeOut(this.current, 400, false);
      this.emit();
      return;
    }
    if (!this.current || this.current.dead) {
      this.start(nextTrackFor(this.mood, null));
      return;
    }
    const h = this.current.howl;
    if (!h.playing()) {
      h.volume(0);
      h.play();
      h.fade(0, next, 400);
    } else {
      h.volume(next);
    }
    this.emit();
  }

  /** Switches mood (menu/run); crossfades only when the mood actually changes. */
  setMood(mood: MusicMood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this.level <= 0.0001) {
      // Silent: just drop the old voice so the next unmute starts in the new mood.
      if (this.current) this.kill(this.current);
      this.current = null;
      return;
    }
    this.start(nextTrackFor(mood, null));
  }

  /** Skips to the next track of the current mood. */
  next() {
    if (this.level <= 0.0001) return;
    this.start(nextTrackFor(this.mood, this.current?.track.id ?? null));
  }

  private start(track: MusicTrack) {
    const old = this.current;
    if (old) this.fadeOut(old, CROSSFADE_MS, true);
    const howl = new Howl({
      src: track.src,
      html5: true, // stream; don't download/decode the whole file up front
      preload: true,
      loop: false,
      volume: 0,
    });
    const voice: Voice = { track, howl, dead: false };
    this.current = voice;
    howl.once("load", () => {
      if (voice.dead || this.current !== voice || this.level <= 0.0001) return;
      howl.play();
      howl.fade(0, this.level, old ? CROSSFADE_MS : 900);
    });
    howl.on("end", () => {
      if (voice.dead || this.current !== voice) return;
      const next = nextTrackFor(this.mood, track.id);
      if (next.id === track.id) howl.play(); // single-track mood: just loop
      else this.start(next);
    });
    howl.once("loaderror", () => {
      if (this.current === voice) this.current = null;
      this.kill(voice);
    });
    this.emit();
  }

  private fadeOut(voice: Voice, ms: number, unload: boolean) {
    const h = voice.howl;
    if (!h.playing()) {
      if (unload) this.kill(voice);
      return;
    }
    h.fade(h.volume(), 0, ms);
    window.setTimeout(() => {
      if (unload) this.kill(voice);
      else if (this.level <= 0.0001) h.pause();
    }, ms + 50);
  }

  private kill(voice: Voice) {
    voice.dead = true;
    voice.howl.stop();
    voice.howl.unload();
  }
}

export const MusicDirector = new MusicDirectorImpl();

export function trackTitle(id: string | null): string | null {
  return id ? (MUSIC_TRACK_MAP.get(id)?.title ?? null) : null;
}
