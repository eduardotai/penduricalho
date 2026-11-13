# Full visual redesign — "Bancada de Ensaio" (test bench)

Status: **test branch** `redesign/full-visual`, draft PR, not for merge until the owner signs off.

## Art direction

**The whole UI is a physical lab instrument bolted around the arena.** Penduricalho is a
physics toy: a rig on a pivot, swung, measured, broken. So instead of floating glass
cards, every surface is a piece of test equipment:

| Element | Treatment | Why |
|---|---|---|
| Panels | Machined *faceplates*: matte gradient, 1px bevel highlight, four corner screws (CSS gradients, no DOM) | Gives the UI weight and a single material, like an instrument chassis |
| Labels | *Silkscreen*: JetBrains Mono, 10px, 0.16em tracking, uppercase, leading tick | Reads like printed legends on hardware; mono digits never jitter |
| Numbers | *LCD readouts*: inset glass, faint scanlines, phosphor glow in the theme's brand colour | Momentum is the hero number; it should look *measured* |
| Buttons | *Keycaps* with 3px travel (press moves down, shadow collapses) | Satisfying in a clicker; one consistent press feel everywhere |
| Toggles | Rocker switches with an *LED* | State visible at a glance, no iOS-style pills |
| Sliders | Mixing-desk *faders* (thumb with an index line, filled track) | Matches the instrument metaphor for audio/camera |
| Windows | *Drawers* that rise from the bench: ruler strip on the lid, catalogue code (`01 / SHOP`), icon well, title in Archivo expanded caps, index tabs | All windows share one shell (`components/ui/Window.tsx`) |
| Danger | Hazard stripes | End run / prestige confirm read as "are you sure" without extra copy |
| Type | **Archivo** (variable, width axis → expanded 118–125% for display caps) + **JetBrains Mono** for labels/digits | Industrial, wide, not the usual Inter/Space Grotesk look |
| Icons | **Lucide** line icons at one stroke weight (1.75) + a hand-drawn pendulum mark | Replaces every emoji UI icon with one coherent set |
| Background | Base theme: ink-blue *drafting sheet* — parallax millimetre grid, edge rulers with mono numbers, registration marks, a warm lamp pool, and a slowly drifting **phase-portrait trace** (the pendulum's θ/ω Lissajous) with a glowing write head | The pendulum's own signature as wallpaper; animated but calm |
| Motion | Drawer rise (280ms), scrim fade, staggered tab content, toast drop with overshoot, combo pop, swinging pendulum glyph while a run is live; all disabled under `prefers-reduced-motion` | Micro-feedback without noise |

What stays (the essence): the arena, rope physics, orbs, Momentum, the left console +
right workshop layout, every number and rule, the save format (no save-shape change;
UI prefs still live in their own key).

### Themes still work
Every bench colour is a theme CSS variable (`--c-slate-*`, `--c-brand-*`, `--c-amber-*`,
`--c-yellow-*`). The redesigned layout is the base; Watchmaker / Observatory / Neon /
Greenhouse recolour the faceplates, keys, LEDs and readouts and keep their own canvas
backdrops and display fonts. Only the **Classic** canvas art was redrawn (it *is* the
bench). Body text moves to Archivo for every theme.

## Screens changed
- Boot splash (index.html, pure CSS, until React mounts)
- **New** title screen (once per page load; doubles as the audio-unlock gate; Enter/Space/Esc or tap)
- HUD: Momentum readout, run card, golden-token card, Arc Surge, click streak, combo, buffs, first-run hint
- Left console: loadout, launch key, golden token key, countdown meter, Auto-run / Use tokens switches, Shop / Achievements / Prestige / Settings keys, End-run with hazard confirm, mobile More/Less
- Workshop: side tab (desktop) and pill (mobile), panel with round Pump key ringed by the Run Charge gauge, generators and upgrades lists
- Shop window and all 8 tabs (Bobs, Ropes, Sites, Skins, Shapes, Boosts, Themes, Stats)
- Achievements window (filters, progress meters, unlock tags)
- Prestige window (readouts, resets/keeps, hazard confirm)
- How to Play window
- Settings window and all 5 tabs (Audio with now-playing, Display, Controls, Language, Save)
- Toasts: achievement unlocked, while-you-were-away
- Canvas: Classic backdrop and pivot clamp

## Music
Original soundtrack, synthesised from scratch by `scripts/music/compose.py` (numpy:
additive saws, FM bells/e-piano, modal plucks, synthesised drums, FFT convolution
reverb, ping-pong delay). No samples, no third-party audio, released **CC0 1.0**.

| Track | Use | Tempo / key | File | Author | Licence |
|---|---|---|---|---|---|
| Bench at Rest | menu / idle | 72 BPM, D major (tick-tock clock motif) | `public/music/bench-at-rest.{ogg,mp3}` | Penduricalho (compose.py) | CC0 1.0 |
| Tightrope | arena | 116 BPM, A minor | `public/music/tightrope.{ogg,mp3}` | Penduricalho (compose.py) | CC0 1.0 |
| Amber Orbit | arena | 124 BPM, F♯ dorian | `public/music/amber-orbit.{ogg,mp3}` | Penduricalho (compose.py) | CC0 1.0 |
| Momentum | arena | 90 BPM, E♭ major | `public/music/momentum.{ogg,mp3}` | Penduricalho (compose.py) | CC0 1.0 |

Rebuild: `python3 scripts/music/compose.py && scripts/music/encode.sh` (needs numpy + ffmpeg).

Playback (`src/audio/musicDirector.ts`, rules in `musicTracks.ts`, tested):
- Streams with Howler `html5: true`, created on demand and unloaded after fade-out; nothing is in the JS bundle.
- Menu theme when idle; arena tracks rotate while runs are live and for 20s after (so Auto-run doesn't flip-flop); 1.8s crossfades.
- Level = master × music volume; 0 when muted (M), when the music toggle is off, or when the tab is hidden. The music volume slider already existed and is kept.

**Licence finding:** main's existing "Benkyou" loop (`public/sounds/benkyou-loop.*`) is credited in code as CC0, but its OpenGameArt page (https://opengameart.org/content/benkyou-lofi-loop) lists **CC-BY 4.0** (attribution required). The redesign no longer plays it and removes the files; CREDITS.md records the history.

## Dependencies added
- `lucide-react` 1.72.0 (ISC) — icons, tree-shaken per icon.
- `@fontsource-variable/archivo` 5.3.0 (OFL-1.1), `@fontsource-variable/jetbrains-mono` 5.3.0 (OFL-1.1) — self-hosted fonts.

## Known gaps / risks
- The soundtrack was checked by measurement (peaks, clipping ratio, spectrograms) but **not by ear** — it needs a listen.
- The title card adds one click per page load (by design for the audio gate); easy to turn into "first visit only".
- Some long labels in the Orbitron (Neon) theme are wide; launch key is `nowrap` but other keys may wrap on very small phones.
- Achievements still have a few hard-coded English strings from main (subtitle/footer now localised).
- GameCanvas overlays drawn on canvas (floating "+N" text, particles) are unchanged apart from the Classic font.
