/**
 * Soundtrack catalogue + the pure rules the music director follows. No audio
 * APIs here so it is unit-testable; playback lives in musicDirector.ts.
 *
 * Every track is composed for this game by scripts/music/compose.py and
 * released CC0 1.0 (pure synthesis, no samples). Sources and licences:
 * CREDITS.md. (main's old "Benkyou" loop is CC-BY 4.0, not CC0, so the
 * redesign does not ship it in the rotation.)
 */

export type MusicMood = "menu" | "run";

export interface MusicTrack {
  id: string;
  title: string;
  author: string;
  license: "CC0-1.0";
  source: string;
  mood: MusicMood;
  /** Streamed in order of preference (Howler picks the first playable). */
  src: string[];
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "bench-at-rest",
    title: "Bench at Rest",
    author: "Penduricalho (original, scripts/music/compose.py)",
    license: "CC0-1.0",
    source: "scripts/music/compose.py",
    mood: "menu",
    src: ["/music/bench-at-rest.ogg", "/music/bench-at-rest.mp3"],
  },
  {
    id: "tightrope",
    title: "Tightrope",
    author: "Penduricalho (original, scripts/music/compose.py)",
    license: "CC0-1.0",
    source: "scripts/music/compose.py",
    mood: "run",
    src: ["/music/tightrope.ogg", "/music/tightrope.mp3"],
  },
  {
    id: "amber-orbit",
    title: "Amber Orbit",
    author: "Penduricalho (original, scripts/music/compose.py)",
    license: "CC0-1.0",
    source: "scripts/music/compose.py",
    mood: "run",
    src: ["/music/amber-orbit.ogg", "/music/amber-orbit.mp3"],
  },
  {
    id: "momentum",
    title: "Momentum",
    author: "Penduricalho (original, scripts/music/compose.py)",
    license: "CC0-1.0",
    source: "scripts/music/compose.py",
    mood: "run",
    src: ["/music/momentum.ogg", "/music/momentum.mp3"],
  },
];

export const MUSIC_TRACK_MAP = new Map(MUSIC_TRACKS.map((t) => [t.id, t]));

/** How long the arena music lingers after a run ends before the menu theme returns. */
export const RUN_MOOD_LINGER_MS = 20_000;
/** Crossfade length between tracks. */
export const CROSSFADE_MS = 1800;

/**
 * Next track for a mood: rotates through that mood's tracks in order,
 * starting from the first, never repeating the current one when there is a
 * choice.
 */
export function nextTrackFor(
  mood: MusicMood,
  currentId: string | null,
  tracks: readonly MusicTrack[] = MUSIC_TRACKS
): MusicTrack {
  const pool = tracks.filter((t) => t.mood === mood);
  if (pool.length === 0) throw new Error(`no tracks for mood ${mood}`);
  const i = pool.findIndex((t) => t.id === currentId);
  return pool[(i + 1) % pool.length];
}

/**
 * Which mood should play: the arena set while a run is live and for a short
 * linger after it ends (so auto-run doesn't bounce between themes), the menu
 * theme otherwise.
 */
export function resolveMood(isRunning: boolean, lastRunEndedAt: number | null, now: number): MusicMood {
  if (isRunning) return "run";
  if (lastRunEndedAt != null && now - lastRunEndedAt < RUN_MOOD_LINGER_MS) return "run";
  return "menu";
}

/** Linear music level from the audio settings (0 when muted or disabled). */
export function musicLevel(s: { muted: boolean; musicEnabled: boolean; masterVolume: number; musicVolume: number }): number {
  if (s.muted || !s.musicEnabled) return 0;
  return Math.max(0, Math.min(1, s.masterVolume * s.musicVolume));
}
