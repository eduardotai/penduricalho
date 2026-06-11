# src/game/ — Context

**Role**: The entire simulation, rules engine, physics wrappers, and custom rendering.

This is where **all gameplay behavior** lives. React components should almost never import directly from here except for types and the thin canvas bridge.

---

## High-Level Architecture

```
Matter.js (low-level physics)
    ↑
PendulumHandle + EngineHandle + WallField + HitZoneField + TokenField
    ↑
Per-frame systems (durability, behaviors, tokens, modifiers, belt tunnel, effects)
    ↑
GameCanvas.tsx (the actual game loop — React effect + requestAnimationFrame)
    ↑
Custom Canvas2D rendering (never uses Matter.Render)
```

**GameCanvas owns the loop**. `src/game/` provides pure(ish) functions and state containers.

---

## Key Abstractions

### EngineHandle (`engine.ts`)
- Thin wrapper around `Matter.Engine` + `Matter.Runner` (fixed 60Hz).
- Also owns all **boundary walls** and in-field obstacles (breakable walls, Layers rings).
- Functions: `createEngine`, `createWallField`, `createRingObstacles`, `damageWall`, `regenerateWallField`.

**Important**: Ring obstacles use a special collision mask (`COLLISION.OBSTACLE` only hits `COLLISION.BOB`). Rope nodes use `COLLISION.ROPE` so they thread through rings cleanly.

### PendulumHandle (`pendulum.ts`)
The most important data structure in the game.

Contains:
- `pivot`, `bobs[]`, `chainBobs[]`, `ropeSegments[]`
- All `constraints`
- References to the original `PendulumDef` + `AttachmentDef`
- Live scales (`bobRadiusScale`, `ropeLengthScale`)
- `physics: AttachmentPhysicsState` and `ropePhysics: RopePhysicsState`
- `snapped: boolean` + `savedLinks` (for restore)

**Key exported functions** (you will use many of these):
- `buildPendulum(...)`
- `snapRope(handle, { scatter? })`
- `restoreRope(handle)`
- `resetPendulumToRest(handle)`
- `tickAttachmentPhysics(handle)` — called every frame
- `setBobRadiusScale`, `setRopeLengthScale`, `setPendulumWeightScale`
- `clampAngularVelocity`, `dampPendulumMotion`, `settlePendulumTowardRest`
- Belt-specific: `feedBeltRope`, `reelBeltRope`, `beltPayoutRatio`
- Teleport: `teleportRig`
- Various getters: `rigReach`, `getEffectiveBobRadius`, `getOrderedBobBodies`

There are also **virtual belt helpers** (`feedBeltVirtual` etc.) because the Mechanic Belt has no real rope constraints.

### Rope System (`rope/`)
See dedicated `src/game/rope/CONTEXT.md`.

### Hit Zones (`hitZones.ts`)
- `generateHitZones(site)` — creates the multiplier circles for a run.
- `regenerateHitZones` — used by Golden Token.
- `spawnExtraZones` — hydra behavior grows new ones.
- `relocateZone` — some behaviors move zones.
- Swept collision + tunneling guard for fast bobs.

Zones have `basePoints * multiplier * current pointMult from modifiers`.

### Tokens & Modifiers (`tokens.ts`, `modifiers.ts`)
- `TokenField` manages the drifting physical pickups.
- `ActiveModifier[]` in the store are the live effects.
- `aggregateEffects()` combines all active + persistent bonuses into one `ModifierEffects` object.
- Some tokens (golden, repair, velocity-surge) have direct special handling outside the modifier system.

**Persistent bonuses** (from Golden Token) are stored separately in the store and survive across runs until they expire.

**Plan C separation note**: The workshop clicker (Pump + generators) is now cleanly separated from the arena physics loop. Workshop pumps no longer drive canvas bob taps or auto-arm runs. Arena scoring still receives `activeWorkshopSynergyMult` and Run Charge burst on launch.

### Belt Tunnel (`beltTunnel.ts`)
Completely separate movement model for the "Mechanic Belt" rope behavior.

- Generates a random polyline path (waypoints) once per run (or on certain token spends).
- `applyBeltTunnelContainment`, `applyStrictConveyorRail`, `advanceTunnelProgress`.
- The bob is a free body; the tunnel walls + conveyor velocity are applied as forces every frame.
- No rope constraints exist while on belt.

### Effects (`effects.ts`)
- Very small particle / hit flash / screen shake system.
- `createEffectsState()`, `emitHit()`, `emitManeuver()`, `tickEffects()`.
- Consumed by the custom renderer.

### Rendering (`render.ts`)
**Custom Canvas2D**, not Matter's renderer.

Main entry: `drawPendulum(...)`, `drawHitZones(...)`, `drawTokens(...)`, `drawWalls(...)`, `drawBeltTunnel(...)`, `drawEchoBobs(...)`, `drawBlackHole(...)`, etc.

All drawing functions receive a `RenderContext` that already has the current view transform applied.

Bob visuals are heavily customized via `bobShapePath.ts` + `bobSkinArt.ts` + `bobRenderUtils.ts`.

---

## Behavior Implementation Locations (Current)

Search for `behavior?.kind ===` or `ropeBehavior?.kind ===` inside `GameCanvas.tsx` (mostly inside the giant `frame()` function starting ~line 2493).

| Kind       | Primary location(s) in GameCanvas + notes |
|------------|-------------------------------------------|
| hunter     | Post-snap only: `steerHomingBobs(now)`. Snap called with `{ scatter: false }`. `homingActive` + `homingEats` counters. |
| piercer    | `dashPiercer(now)` — gated behind `reenergize` window after snap. |
| hydra      | Combo milestone path → `spawnExtraZones` + `hydraBonusEcho` accumulation. |
| nitro      | Durability wear formula (multiplies `durabilityDrainMult`). |
| magnet     | `magnetPull(dt)` every frame (affects both zones and tokens). |
| frenzy     | `applyFrenzyScale(...)` — reads combo, applies to size + speed (bleeds down too). |
| teleport   | `teleportTick(now)` → `teleportRig(...)`. |
| rocket     | `rocketTick(now, dt)` + special `rocketRopeAtLimit()` durability rule + no-launch-kick handling. |
| splitter   | On every zone hit: sheds shards, reduces mass/size, increases speed cap. Reset on golden spend. |
| chaos      | `chaosTick(now, dt)` — rerolls targets + lerps stats. |
| flux       | `fluxTick(now, dt)` — length + drain rate lerp. |
| metronome  | Mostly in `pendulum.ts` (rigid rod + oscillation in build + length tick). |
| belt       | Entirely different path: `beltConveyor`, `applyBeltTunnelContainment`, `beltTunnel` path + virtual payout. See dedicated file. |
| bulwark    | `bulwarkTick(now)` — periodic hardening + break detection on rope segments. |

**When adding a new kind, you will almost always touch GameCanvas.tsx the most.**

---

## The Frame Loop — Exact Order You Must Respect

The single most important piece of knowledge in the entire codebase for gameplay changes.

Located in `src/components/GameCanvas.tsx`, function `frame(now)` starting ~line 2493.

**Canonical order (do not reorder lightly)**:

1. Store read + `expireModifiers` + `decayCombo` + hit-stop timeScale
2. Manual drag spring (temporary constraint while player is grabbing)
3. `aggregateEffects(...)` + `behaviorScales()` + apply size/weight/length scales + `fluxTick`
4. Belt payout feed (before physics stretch read)
5. Durability drain + snap decision (the big block that calls `snapRope`)
6. `tickAttachmentPhysics` (skipped when snapped)
7. Speed ramp application
8. **The big behavior block** (frenzy, magnet, chaos, belt containment, bulwark, blackhole, re-energize window for piercer/teleport/rocket)
9. Ambient forces
10. Echo / multi-bob sync + `positionChainBobs` + `containRopeBobsInWalls`
11. `tickBobZoneHits` (scoring heart) + `tickTokens` + `reapTokens`
12. `launchPendingRef` handling (fresh run setup, wall regen, zone regen, launch impulse or belt kick)
13. `tokenLaunchPendingRef` handling (golden spend re-launch + bonus zones + arena reset)
14. Post-snap finale logic (hunter homing, speed/escape calc)
15. Run end / stall / idle detection (with special belt eject grace window)
16. Custom rendering + shake
17. Store writes + side effects

This order explains why certain things only work after the snap, why golden spends feel crisp, why belt behaves differently, etc.

When you add new per-frame logic, decide which numbered bucket it belongs in.

---

## World Constants & Scaling (`worldConstants.ts`, `viewTransform.ts`)

- `WORLD_SCALE = 3`
- `ANCHOR` = pivot position in virtual world
- `COLLISION` categories (critical for ring obstacles)
- `computeViewTransform`, `applyWorldCamera`, `screenToWorld`

Camera is fully controllable by the player (drag + wheel/pinch). GameCanvas has refs to track user-adjusted state.

---

## Durability & Snap Model

- Durability drains every frame: `weight * material.drainRate * behaviorMult * modifierMult`
- When it hits 0 (or goes negative), `snapRope()` is called.
- Snap detaches bob-link constraints, gives an outward kick, and hands control to behavior finale logic.
- Many behaviors (especially hunter, splitter, rocket) only become powerful **after** the snap.

Rope Patch tokens restore a fraction of durability.

---

## Performance / Stability Notes

- Matter constraint iterations are raised for heavy rigs (`recommendedConstraintIterations`).
- `stabilizeRopeBodies` + `resetPendulumToRest` are safety nets against NaN from extreme stretch.
- `clampAngularVelocity` is the main "feel" control — small bobs feel zippy, heavy ones feel weighty.
- Custom settling (`settlePendulumTowardRest`) is required because soft rope springs never truly rest under gravity.

---

## Common Tasks

**Add a new per-frame behavior**:
1. Add to `BobBehaviorKind` / `RopeBehaviorKind` in types.
2. Add fields to the Behavior interface.
3. Put data in a `data/*.ts` file.
4. Add the if-check + logic in the main frame loop inside GameCanvas.
5. (Optional) Extract to a helper file in `src/game/` if it gets big.

**Change rope feel**:
- Mostly `src/game/rope/materials.ts` (BASE + BY_ID overrides).
- Also `attachmentPhysics.ts` for rod/elastic constraint tuning.

**Change how the snap finale works**:
- `snapRope` in `pendulum.ts` (the kick + cleanup).
- Then the post-snap behavior code in GameCanvas.

---

## What NOT to do here

- Do not import React or Zustand directly in most game/ files (a few do for types only).
- Do not put UI strings or React components here.
- Keep files relatively focused. GameCanvas is already the "god file" — push behavior logic down when it makes sense.

---

## Related Context

- `src/game/rope/CONTEXT.md` (very important)
- `src/components/CONTEXT.md` (how the loop actually runs)
- `src/state/CONTEXT.md` (what state the game loop reads/writes)