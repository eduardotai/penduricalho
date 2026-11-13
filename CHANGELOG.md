# Changelog

All notable changes to **Pendulum Clicker** are documented here. Tagged releases
exist in git as `v<version>` (see [Versioning](docs/VERSIONING.md)); pre-1.0 and
post-1.0.1 entries below are reconstructed from the project's commit history.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] - New ropes

### Added
- **Five new lines**, each trading along a different axis: **Silk Thread** (35k, longest reach L340, ×1.9, fragile: heavy bobs snap it), **Spring Coil** (60k, elastic, 1.45 max stretch, ×1.7 with a big velocity kick), **Anchor Chain** (150k, chain, load rating 14 / 45s life, ×3), **Plasma Tether** (400k, ×2.4, new `charge` behavior: +4% points per live combo stack up to +60%, "PLASMA CHARGED" when full) and **Carbon Rod** (900k, rigid rod L290, ×2.3, strongest twist).
- `scripts/sim-ropes.mjs`: headless pts/s per rope for a set of bobs.

## [Unreleased] - Late-game bobs

### Added
- **Five late-game bobs past the 150k Chaos Bob**, each with its own behavior: **Pulsar** (300k, shockwave every 1.5s pops nearby orbs at 50%), **Comet** (750k, wide tail pops orbs at 80%), **Midas** (1.5M, each pop gilds the nearest orb +1x, up to +3x), **Prism** (3M, each pop arcs to the 2 nearest orbs at 50%) and **Singularity** (5M, Lodestone-style pull and +2.5% size per hit up to +80%). Sim (titan cable, Workshop, launches): 117 / 122 / 148 / 185 / 251 pts/s vs Chaos 87.
- Achievements **Neutron Star** (own Pulsar) and **Event Horizon** (own Singularity), with a new `owns` requirement type.
- The income sim now models Lodestone's pull (zones only); it puts the 28k Lodestone at ~155 pts/s, about 2x Tungsten.

## [Unreleased] - Orb drops

### Added (wave 2)
- **Six new orb-drop modifiers** with their own effect channels: **Combo Lock** (combo window x4, 8s), **Lucky Charm** (orbs drop tokens 2.5x as often, 8s), **Rope Guard** (no rope wear, 6s), **Glass Cannon** (x2.5 points but 4x rope wear, 5s; marked ⚠ in the HUD), **Moon Gravity** (55% gravity, 7s; replaces Heavy Air and vice versa) and **Orb Magnet** (nearby orbs and tokens drift to the bob, 6s). Golden stays at ~5.5% of drops and Rope Patch at ~17%.
- `scripts/sim-modifiers.mjs`: headless table of pts/s with each modifier active for a whole run.

### Added
- **Five more orb drops.** Popping a multiplier orb can now also drop **Power Twist** (kick on pickup, +50% twist power 7s), **Heavy Air** (+25% gravity, +20% points 7s), **Featherweight** (-30% bob mass 6s), **Golden Hour** (x2 points 5s) and **Overdrive** (hard kick, +75% twist power, +50% points 4s). These modifiers existed but nothing granted them. Rope Patch and Golden Token weights were raised with the pool so their share of drops stays about the same (Golden 5.5%, Patch 17%).

## [Unreleased] - Global boosts

### Fixed
- **Offline workshop income**: closing the page now always credits workshop generator income for the time away (CPS recomputed from the loaded save, including workshop upgrades, prestige Cogs and global boosts), with the "while you were away" toast. Before, nothing was credited unless Auto-Run was on. The arena's smoothed rate is still added only with Auto-Run, and that rate no longer includes generator income, so nothing is counted twice.

### Changed
- **Run charge**: each pump adds 0.5 charge (was 0.05), so the full ×3 run burst takes 200 pumps instead of 2,000.
- **Workshop panel collapsed by default**: on desktop it hides off the right edge behind a small `‹ 🔧` tab, slides in on click, and a `›` button tucks it away again, so the arena gets the room. On mobile a small **Oficina / Workshop** pill above the controls opens and closes it. The open/closed choice is kept in a separate `penduricalho-ui-prefs` localStorage key (the game save is untouched). The tab pulses until the workshop has been opened once, and the tutorial says where it is.

### Added
- **Boosts / Multiplicadores tab in the Shop**: one-time global income upgrades. **Mola Mestra / Master Mainspring ×2** (1M) and **Turbilhão / Tourbillon ×3** (25M, needs ×2) — ×6 together. They multiply zone hits, pumps and generator CPS (and so offline idle) together with the prestige Cogs bonus and the achievement bonus; the tab shows the live breakdown. Prestige resets them.

### Migration
- Save v26: `globalUpgrades` (default `[]`; unknown ids dropped on load).

## [Unreleased] - Prestige

### Added
- **Prestige ("Engrenagens" / Cogs).** New 🌟 Prestígio button and panel. Total cogs ever earned = floor(sqrt(all-time Momentum / 100K)) (1M → 3, 10M → 10, 100M → 31, 1B → 100); a reset grants the cogs not yet held, needs at least 1M all-time Momentum and no live run, and asks for confirmation. Each cog is a permanent +5% income multiplier on zone hits, workshop clicks and generator CPS (and so offline idle), multiplying with the achievement bonus, item levels and workshop multipliers.
- Resets Momentum, gear and levels, workshop machines/upgrades/Run Charge, Golden Token bonus time/ready tokens/buffs, and this cycle's stats. Keeps cogs, achievements, themes, settings, best run and lifetime counters.

### Migration
- Save v25: `prestigeCogs`, `prestigeCount`, `prestigeLifetimeMomentum` (all 0). An existing save's lifetime Momentum counts toward the first reset.

## [Unreleased] - Shop themes

### Added
- **Themes tab in the Shop.** Visual themes are bought with Momentum and equipped like any other item. "Classic" (the original look) is free; **Watchmaker's Bench / Joalheria do Relojoeiro** (walnut and brass UI, Fraunces + Inter fonts, wood/lamp/gear backdrop, brass pivot with a ruby bearing, jewel-cut circles in brass bezels, additive particles) costs 25K. Ported from the `experiment/visual-watchmaker` draft into a theme system: Tailwind `slate`/`brand`/`amber`/`yellow` are CSS variables per theme (so the amber/yellow buttons now follow the theme too), and the canvas art comes from `src/game/themes/`.

- **Three more Shop themes**: **Observatório / Observatory** (60K: midnight sky, twinkling stars, turning star chart, silver armillary pivot, planets with rings; Cinzel headings), **Fliperama Neon / Neon Arcade** (100K: synthwave sun, scrolling grid, skyline, scanlines, neon-tube pivot, glowing rings; Orbitron headings), **Estufa / Greenhouse** (150K: Victorian glasshouse at dusk, light shafts, swaying ferns, pollen, copper hook with a vine, garden berries with leaves; Fraunces italic headings).

### Migration
- Save v24: new `ownedThemes` (default `["classic"]`) and `themeId` (default `"classic"`). v23 saves load unchanged otherwise.

## [Unreleased] - Workshop / Arena Separation (Plan C) - 2026-06-xx

### Changed
- **Clean separation of clicker from arena** (executed Plan C from design session). The Workshop now has a dedicated, prominent **Pump** button as the primary high-frequency active earner (Momentum + Run Charge + click combos + Arc Surge). The physics arena is a deliberate launchable spectacle: "Start Run" actually launches the swing; zone earnings during runs are amplified by workshop CPS synergy and Run Charge, but canvas clicks no longer award workshop Momentum or drive the main grind.
- Removed all "bob is the cookie" hybrid machinery: `bobInteractRef`, `hitTestCookieBob`, `applyCookieKick`, cookiePumpEpoch watchers, pending cookie arming logic, and the special "arm then click bob to start" flow.
- Deleted `cookieKick.ts`. Auto-pump behavior in `clickerEngine` (tied to arena runs) removed.
- **WorkshopPanel**: Big Pump button + live streak / Run Charge feedback at the top. The panel is now the clear home of active + passive workshop progression.
- Updated all tutorial, hint, control, and achievement-adjacent strings (EN + PT) to describe the separated model ("Pump the workshop, launch arena swings").
- Deleted `ArenaClickHint` component.
- `cookiePump` / `registerClick` are now pure workshop actions (no longer auto-start runs).
- **Workshop hidden behind a feature flag**: the entire workshop clicker layer (right-side panel, mobile panel, passive CPS engine, Arc Surge procs, HUD CPS/surge/streak readouts, "Workshop power" control hint) is disabled via `WORKSHOP_CLICKER_ENABLED` in `src/config/features.ts`. All code and persisted save data remain intact — flip the flag to `true` to restore everything.

### Fixed
- **Bobs no longer tunnel through boundary walls during a mouse hand-swing** (all walled maps). Matter.js solves constraints *before* collision detection, so a hard yank from the manual-drag spring could move the bob farther than the wall's 200px thickness in a single step — ending the step beyond the wall with no collision event ever generated (a shallower overshoot buried it past the wall midline and the resolver expelled it outward). Two-layer fix: the drag-spring target is now clamped inside the cage bounds (inset by bob radius, broken walls stay open), and a new per-step `containDynamicBobsInBounds` guard snaps any dynamic bob whose center crossed a standing wall's inner face back to the surface, landing the standard wall hit on a fresh crossing.
- Re-wired bob grab/hand-swing: the Plan C refactor left `tryBeginBobDrag` defined but never called from `onPointerDown`, so the drag spring (and its grab-starts-a-run path) was unreachable and clicking the bob just fell through to camera handling.
- Start Run / Run Again / Auto-Run actually launch again: restored the launch-impulse branch (normal slingshot via `launchPendulum`, belt entry kick, rocket velocity bleed, launch sound + "LAUNCH!" text) that the intermediate no-auto-launch commit removed — Plan C's "the arena is a spectacle you launch into" had the comment but not the code.
- Removed the dead `setIdleRate` store action, which set `idleRatePerSec` without the workshop CPS contribution; all idle-rate writers now share one `combinedIdleRate` helper so the two income sources can't drift.
- `syncIdleRateFromWorkshop` no longer notifies the store every 100ms tick when the rate is unchanged; `cookiePump` folds its two `set` calls into one.
- Workshop panel rendered its subtitle twice; `Customize` had a private copy of `meetsUnlock` (now imported from `clickerEconomy`); dropped the orphaned `clickBobToSwing` / `clickBobArenaHint` strings left from the deleted `ArenaClickHint`.

### Migration
- Legacy transient fields (`pendingCookiePump`, related arming state) cleaned from the store. Existing saves continue to work.

## [Unreleased] - Workshop Clicker Layer (Path A) - 2026-06-01

### Added
- **Workshop panel**: Pump button (always-on clicks), 8 generators (passive CPS), 5 click upgrades.
- **Run Charge**: clicks fill a bar consumed on Start Run for up to ×3 arena multiplier.
- **Arc Surge**: random ×7 click frenzy windows (Cookie Clicker-style golden cookie).
- Combined offline idle: workshop CPS always accrues away; arena EMA adds when auto-run is on.
- Save migration v21 → v22; 4 new Workshop achievements.
- Branch: `feature/pendulum-cookie` (merge when ready — `main` unchanged until then).
- **Cookie-click swing**: Start Run only arms the arena; click the bob on the canvas to earn Momentum and push the physics swing (no auto-launch). (This tight hybrid was later cleanly separated in Plan C.)

## [Unreleased] - Achievements System (Cookie Clicker inspired) - 2026-06-xx

### Added
- Full achievements system with 24 starter badges across Momentum, Combo, Gold, Runs, Collection, Feats, and Secret categories.
- Persistent tracking (`unlockedAchievements`, `totalGoldenSpent`, `blackHoleCaptures`).
- Live progress bars, hidden (shadow) achievements, unlock toasts with celebratory sound, and a global permanent Momentum multiplier (~0.25% per unlocked achievement, capped at 12%).
- New Achievements panel (🏆) accessible from the control bar + full bilingual (EN/PT) strings.
- Special feat hooks (Black Hole capture) and scoring integration.
- Save migration v19 → v20 with full backward compatibility.

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

[1.0.1]: https://github.com/eduardotai/penduricalho/releases/tag/v1.0.1
[1.0.0]: https://github.com/eduardotai/penduricalho/releases/tag/v1.0.0
