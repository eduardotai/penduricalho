# Changelog

All notable changes to **Pendulum Clicker** are documented here. Tagged releases
exist in git as `v<version>` (see [Versioning](docs/VERSIONING.md)); pre-1.0 and
post-1.0.1 entries below are reconstructed from the project's commit history.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] - Behavior Bobs, Behavior Ropes & Belt Tunnel - 2026-05-31

The biggest content drop since launch: special-behavior bobs and ropes that each
rewrite a slice of the run, two new sites, and a full conveyor-tunnel mechanic.

### Added

- **Ten special bob behaviors** — each special-cased at a few game-loop hook points
  (snap finale, durability drain, zone scoring, echo bobs, per-frame steering):
  - **Ravager** (`hunter`) — after a snap, freed bobs home onto live multiplier
    circles and devour as many as they can ("Pac-Man").
  - **Arrow** (`piercer`) — periodic straight-line dash that spears a whole row of
    circles instead of only clipping along the arc.
  - **Mutant** (`hydra`) — permanently grows an extra scoring echo "head" on each
    combo milestone, snowballing coverage across a run.
  - **Glass Cannon** (`nitro`) — huge points/reach but the rope drains far faster,
    so it snaps early; built around the snap finale.
  - **Lodestone** (`magnet`) — passively drags nearby circles and loose tokens
    toward the bob's swing arc.
  - **Berserker** (`frenzy`) — swing speed and bob size scale up with the live
    combo, then snap back to baseline when the combo drops.
  - **TP** (`teleport`) — blinks to random spots; the rope reels it back within its
    reach, so shorter ropes yank harder than long ones.
  - **Rocket** (`rocket`) — no launch kick; builds speed under continuous thrust
    (stacks hard with Speed Ramp), and its rope only wears while flung out at the
    limit of its reach.
  - **Breakable** (`splitter`) — every circle it hits sheds a free-flying scoring
    piece; as it loses mass it shrinks, shortens, and speeds up.
  - **Random** (`chaos`) — every stat (size, weight, speed, reach) churns through
    the run, bounded by the lightest/heaviest values in the roster.
- **Four special rope behaviors** — the rope analog of bob behaviors:
  - **Random Rope** (`flux`) — effective length and durability-drain speed churn
    through the run, mirroring the Chaos bob.
  - **Pendulum Rope** (`metronome`) — a rigid pivot→bob rod whose length oscillates
    sinusoidally, pumping a classic pendulum swing.
  - **Mechanic Rope / Belt** (`belt`) — a real conveyor: it feeds rope off the
    anchor and stretches the line until stress snaps it; repair drops reel slack
    back in. The shortest rope in the game; while strung, the bob rides a randomly
    generated tunnel path (see Belt Tunnel below).
  - **Wall Rope** (`bulwark`) — every half-second it hardens a random stretch into a
    rigid "wall"; it can't pick up repair drops, but a hard-enough whip breaks the
    wall, re-softening that stretch before the cycle restarts.
- **Belt Tunnel mechanic** (`src/game/beltTunnel.ts`, 518 lines) — for the Mechanic
  Belt rope: a free-body conveyor ride along a procedurally generated tunnel route
  (re-rolled each run and on every spent token) with an initial launch kick,
  conveyor carry along the route, centerline tracking, and hard corridor-wall
  containment instead of pivot-spin steering.
- **Two new sites** — **The Layers** (concentric circular walls ringing the mount,
  with multiplier circles between rings and a snap finale that ricochets through
  every ring on the way out) and **Black Hole** (gravity-well site).
- **Save export / import** (`src/state/saveTransfer.ts`, new **Save** tab in
  Settings) — move your progress between browsers and devices. Export downloads a
  timestamped JSON file or copies the save to the clipboard; import loads it from
  a file or pasted text, replaces the local save, and reloads. The save still
  lives only in the player's own browser `localStorage`; transfer is entirely
  player-driven and never leaves the device on its own.

### Changed

- Retuned rope durability and Matter.js collision categories across the new
  behaviors; refined the snap finale's freed-bob handling.
- Reworked `pendulum.ts`, `render.ts`, `engine.ts`, and `GameCanvas.tsx` to host the
  behavior hook points and the belt's free-body ride path.
- Rebalanced **Arrow**, **TP**, and **Rocket** around the rope economy: removed the
  per-run cap on the Arrow dash and TP blink (and the fixed 6s post-snap window) so
  their powers now fire for the whole run, limited only by rope durability. Post-snap
  the effects decay per use (Rocket per second) so the freed bob still winds down to a
  clean end. To offset the buff, **Rope Patch** drops are rarer (drop weight 32 → 18)
  and heal less (35% → 18% of full durability).
- **Hard End Run** now fully stops the run instead of auto-launching a fresh one.
  It still clears active modifiers and persistent bonuses, but leaves the launch
  button ready so the player starts the next run themselves (store action renamed
  `hardEndAndRestartRun` → `hardEndRun`).

## [Post-1.0.1] - Systems Expansion - 2026-05-28

### Added

- Expanded pendulum/rope physics, procedural audio cues, and bob customization.
- Richer canvas interactions, HUD, and an expanded token economy.
- Additional engine-side maneuver and modifier handling.

### Changed

- Retuned modifiers, pendulums, sites, and rope materials; updated store/selectors
  for the broader progression and customization flow.

## [1.0.1] - 2026-05-28

### Changed

- Pendulum bob radii scale with the virtual world so each purchasable bob has a
  distinct in-game size.
- Customize shop shows size-accurate bob previews and a Size stat per pendulum.
- Hit-zone layout respects bob clearance for larger bobs.

## [1.0.0] - 2026-05-28

First tagged release.

### Added

- Scaled virtual world (`worldConstants`) with default camera pan/zoom for
  upper/lower multiplier bands.
- Attachment physics integration and expanded attachment/pendulum/site data.
- Adaptive hit-zone spawning in upper/lower bands with dynamic grid spacing.
- Semver tagging docs and changelog so deployments can be rolled back safely.

### Changed

- Customize UI, game canvas layout, pendulum simulation, and render pipeline
  aligned to the scaled world.
- Store/selectors updated for MVP progression and customization flow.

## [0.3.0] - Polished Milestone - 2026-05-28

### Added

- **Rope physics** — segmented rope simulation with material-derived stiffness and
  damping (Hooke's law + damping ratio).
- **Procedural audio** — `AudioManager`, procedural sound synthesis, a sound map,
  and looping background music.
- **Bob customization** — bob shapes and skins (`bobShapes`, `bobSkins`).
- **Token economy** — collectible tokens that grant timed modifiers (Bigger/Giant/
  Tiny Bob, Velocity Surge, Speed Ramp, Multi-Bob, Rope Patch, Golden Token).
- **Settings panel** and a richer HUD / `FormattedNumber` display.

## [0.2.0] - Idle Run Loop - 2026-05-27

### Changed

- Converted gameplay from manual click-to-twist into **pinball-style idle runs**:
  a tangential launch impulse on Start Run, a small boost on each zone hit, and an
  automatic run end once bob motion settles.
- Replaced the right sidebar with a centered **ControlPanel** (Start Run +
  Customize) and a tabbed **Customize** modal (Pendulum / Attachment / Site / Stats).
- HUD shows a run-status card (per-run momentum, best run, total runs).

### Added

- `runState` (isRunning / runMomentum / totalRuns / bestRunMomentum) plus
  `startRun` / `endRun` store actions.

### Removed

- Dead pointer-drag input module and the standalone Shop / Inventory / Stats
  components.

## [0.1.0] - Initial MVP - 2026-05-27

### Added

- Physics-based pendulum clicker MVP: Matter.js pendulum, HTML5 canvas rendering,
  and Zustand state.
- Core data: attachments, maneuvers, modifiers, pendulums, sites.
- Game systems: effects, engine, hit zones, pointer input, maneuvers, modifiers,
  render pipeline.
- Shop / Inventory / Stats UI and a HUD.
- Claude Code Review + PR Assistant GitHub workflows.

[1.0.1]: https://github.com/eduardotai/pendulum-clicker/releases/tag/v1.0.1
[1.0.0]: https://github.com/eduardotai/pendulum-clicker/releases/tag/v1.0.0
