# src/audio/ — Context

**Role**: All sound — procedural Web Audio synthesis for SFX, Howler-based background music, and a central mapping + playback manager.

---

## Architecture

Two parallel systems:

1. **Procedural SFX** (`AudioManager` + `proceduralSounds.ts`)
   - Uses raw `AudioContext` (unlocked on first user gesture).
   - Purely synthesized tones, noise bursts, filtered noise, etc.
   - Designed as temporary high-quality placeholders until real audio assets are added.

2. **Background Music** (`backgroundMusic.ts`)
   - Uses **Howler.js** (looping ogg/mp3).
   - Simple play/pause + volume control.
   - One track currently (`benkyou-loop`).

A thin `soundMap.ts` + `playGameSound()` function gives the rest of the game a stable, named API.

---

## AudioManager (The SFX Engine)

- Singleton class (instantiated once in the module).
- Handles:
  - Lazy `AudioContext` creation + resume
  - Master gain + per-group volumes (sfx / ui / ambient)
  - Cooldowns per sound id (prevents ear-bleeding spam)
  - Concurrent SFX cap
  - Light pitch jitter for organic feel
- `unlock()` must be called on first user interaction (the app does this on canvas pointer down, button clicks, etc.).

Settings come from the Zustand store (`audio: AudioSettingsSnapshot`).

---

## Procedural Sound Profiles (`proceduralSounds.ts`)

Each `SYNTH_PROFILES[SoundId]` entry has:

```ts
{
  group: "sfx" | "ui" | "ambient",
  duration: number,
  play: (ctx, destination, pitch, volume, variant?) => void
}
```

The `play` function builds the full AudioNode graph for that sound (oscillators, noise, filters, envelopes).

Current notable sounds:
- `hit` / `hit-heavy` / `hit-golden` — zone contact
- `snap` — rope break (important emotional beat)
- `token` variants — pickup
- `launch`, `repair`, `golden-launch`
- `wall-break`, `maneuver`
- `ui-*` — button / menu sounds
- `ambient-*` — low-level wind/whoosh layers during runs

Many use the shared `tone()` and `noiseBurst()` helpers.

---

## Sound Mapping (`soundMap.ts`)

```ts
export function playGameSound(id: SoundId, opts?: PlayOptions)
```

Options include:
- `volume`
- `pitch`
- `variant`
- `cooldownKey` (for custom grouping)

This is the function the game loop and UI should call. It respects global mute/volume settings.

---

## Background Music

- Created once, controlled via `playBackgroundMusic()`, `stopBackgroundMusic()`, `setMusicVolume()`.
- Currently a single chill electronic loop.
- Volume is affected by the `ambientEnabled` + `sfxVolume` settings (see AudioManager volume resolution).

---

## Integration Points

- GameCanvas calls `playGameSound` for hits, snaps, token pickups, golden spends, wall breaks, maneuvers.
- UI components call it for clicks and toggles.
- The first real pointer event on the canvas (or any major button) triggers `audio.unlock()`.

---

## Adding a New Sound

1. Add the `SoundId` literal to `types.ts`.
2. Implement a profile in `proceduralSounds.ts` (copy an existing one and tweak).
3. (Optional) Add a mapping or alias in `soundMap.ts`.
4. Call `playGameSound("your-new-id", { pitch?, volume? })` from the appropriate place.
5. If it's a major gameplay moment (snap, golden, big wall break), consider a distinct heavier sound.

---

## Future Migration Path (Documented in Code)

The entire procedural system is explicitly marked as "placeholders until real sprite assets land in `public/sounds/`".

When real audio files arrive:
- The `AudioManager` can be extended or replaced with a Howler-based SFX manager.
- The `play` functions become thin wrappers that trigger preloaded sprites with pitch/volume variation.
- The public API (`playGameSound`) stays stable.

---

## Gotchas

- You **must** call `unlock()` before any sound can play (browser autoplay policy).
- The manager has a hard cap on concurrent SFX to avoid destroying the audio thread.
- Pitch is in **semitones** (0 = normal, +12 = octave up).
- Ambient sounds are intentionally quieter and can be toggled off separately from master SFX volume.

---

## Related

- `src/components/GameCanvas.tsx` (biggest caller of gameplay sounds)
- `src/state/store.ts` (audio settings live here and are persisted)
- `src/audio/types.ts` (the SoundId union and settings shape)