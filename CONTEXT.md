# Penduricalho — AI Context Guide

**Purpose**: This file + the `context.md` files scattered through `src/` let an AI (or future you) understand the architecture **without reading every file line-by-line**.

Read only the relevant context file(s) for the area you're working in.

---

## Core Mental Model

This is a **physics-driven idle clicker** built on real Matter.js simulation, not a scripted animation.

### Quick Task → File Map

| Task you need to do                              | Read these first (in order) |
|--------------------------------------------------|-----------------------------|
| Add new bob/rope/site/skin/shape                 | `data/CONTEXT.md` → types.ts → the one data/*.ts file |
| Modify or add a behavior (bob or rope)           | Root → `game/CONTEXT.md` → `components/CONTEXT.md` (frame loop) |
| Change rope feel, belt, bulwark, flux, etc.      | `game/rope/CONTEXT.md` → `game/pendulum.ts` |
| Change scoring, tokens, golden, modifiers        | `game/hit-tokens-modifiers.md` + `game/CONTEXT.md` |
| Change camera, view math, or rendering           | `game/CONTEXT.md` (view + render section) + `render.ts` |
| Change what persists or idle/offline earnings    | `state/CONTEXT.md` + store.ts |
| Change UI layout or add a new panel              | `components/CONTEXT.md` (the thin parts) |
| Add or change sounds                             | `audio/CONTEXT.md` |
| Understand the entire 60fps game loop            | `components/CONTEXT.md` + `game/CONTEXT.md` |

---

## Core Mental Model

This is a **physics-driven idle clicker** built on real Matter.js simulation, not a scripted animation.

The entire experience revolves around one core loop:

1. Player equips a **rig** (PendulumDef + AttachmentDef + SiteDef)
2. **Start Run** → physics simulation runs until the rope snaps or motion dies
3. Multiplier circles (HitZones) award points + momentum + combo during the swing
4. **Tokens** drop and grant timed **Modifiers**
5. Rope has **durability** that drains based on bob weight + material
6. On snap → special **behavior finale** (hunter, piercer, hydra, etc.)
7. Earn momentum → buy better gear → repeat

**Key architectural decision**: Almost all special gameplay ("behaviors") is implemented via **explicit hook points**, not class inheritance or deep polymorphism.

---

## The Four Layers (Strict Separation)

| Layer       | Location          | What lives here                          | Mutability                  | AI Rule |
|-------------|-------------------|------------------------------------------|-----------------------------|--------|
| **Data**    | `src/data/`       | Pure declarative definitions + lookup maps | Never mutated at runtime   | Add new content here only |
| **Game**    | `src/game/`       | All physics, rules, hit detection, rendering logic, behavior implementations | Pure functions + Matter bodies | Core simulation lives here |
| **State**   | `src/state/`      | Zustand store (progress, equipped, run state, camera, persistence) | The single source of truth | Most UI and persistence logic |
| **UI**      | `src/components/` | React components. **GameCanvas owns the entire game loop** | Thin reactive layer        | Almost never put game logic here |

**Never** put gameplay rules in components or data files. Never mutate data definitions at runtime.

---

## The Behavior Hook System (Most Important Concept)

Special bobs and ropes declare a `behavior: { kind: "hunter" | "piercer" | ... }` in their data definition.

The game loop (almost entirely inside `GameCanvas.tsx`) checks `behavior.kind` at specific moments and calls the corresponding logic in `src/game/`.

**Current hook points** (search for `behavior?.kind ===` or `ropeBehavior?.kind ===` in GameCanvas.tsx:2675+ and related helpers):

**Bob behaviors** (wired mostly in the big `frame()` function):
- `hunter` (Ravager): Post-snap homing steering (`steerHomingBobs`). Special snap with `scatter: false`.
- `piercer`: Periodic straight dashes (`dashPiercer`) — only within POST_SNAP_BEHAVIOR_MS after snap for finale power.
- `hydra`: On combo milestones, calls `spawnExtraZones` + grows `hydraBonusEcho`.
- `nitro`: Multiplies `durabilityDrainMult` during the wear calculation (around line 2608).
- `magnet`: `magnetPull(dt)` every frame — attracts both HitZones and loose Tokens.
- `frenzy`: `applyFrenzyScale(...)` — combo-driven size + speed scaling (bidirectional bleed).
- `teleport`: `teleportTick` → `teleportRig(...)` at intervals.
- `rocket`: `rocketTick` continuous thrust (no launch kick). Special durability rule (`rocketRopeAtLimit`).
- `splitter`: On zone hits, sheds shards (`tickSplitterShards` or equivalent). Shrinks + speeds up.
- `chaos`: `chaosTick(now, dt)` — periodic reroll + lerp of size/weight/speed/reach.

**Rope behaviors**:
- `flux`: `fluxTick` mutates effective length + drain rate every frame.
- `metronome`: Special rigid-rod path in `buildPendulum` + sinusoidal length oscillation.
- `belt`: Completely different movement model. See dedicated `beltTunnel.ts` + `beltConveyor`, `applyBeltTunnelContainment`. No real rope constraints during ride.
- `bulwark`: `bulwarkTick` hardens random rope segments into temporary walls.

**When adding a new behavior**:
1. Add kind to `BobBehaviorKind` or `RopeBehaviorKind` union in `src/types.ts`.
2. Extend the matching `*Behavior` interface with tuning params (document units!).
3. Add declarative entry in the right `src/data/*.ts` (with `behavior: { kind: "...", ... }`).
4. Add the if-check + implementation inside the `frame()` function in `GameCanvas.tsx:2675` (or a helper you extract to `src/game/`).
5. Update scales / sync functions if it affects size/weight/length (see `behaviorScales()`).
6. Add visuals/effects in `render.ts` + `effects.ts` if the behavior needs them.
7. Handle any special snap / launch / golden-spend reset logic.

See `src/game/CONTEXT.md` (has the full current behavior table) and `src/components/CONTEXT.md` for the exact shape of the frame loop.

---

## Coordinate Systems (Critical)

- **Virtual world**: `1280 × 800` design units, scaled by `WORLD_SCALE = 3` → `VIRTUAL_WIDTH/HEIGHT`
- `ANCHOR` (pivot point) lives in `src/game/worldConstants.ts`
- All pendulum/rope/bob sizes, speeds, and reach are expressed in **virtual world units**
- Rendering uses `src/game/viewTransform.ts` (camera pan/zoom) to map world → screen
- `GameCanvas` maintains a `viewRef` and applies the transform every frame

When working with positions, radii, forces, or speeds, you are almost always in **world units**, not pixels.

---

## Run Lifecycle (High Level)

Managed primarily in `GameCanvas.tsx` effect + frame loop:

- Idle (no physics runner needed for the rig)
- `startRun()` → builds fresh pendulum + walls + hit zones + token field, applies launch impulse
- Every frame: Matter step (via Runner) + custom per-frame systems (tokens, modifiers, behaviors, durability, effects, belt tunnel, etc.)
- `endRun()` or auto-stall detection → snap if needed, award final momentum, clean up transient fields
- `restoreRope()` for "Run Again"

Golden Token spends can re-launch mid-run.

---

## Persistence

- Zustand `persist` middleware (see `src/state/store.ts`)
- Everything under `owned`, `equipped`, `stats`, `goldenTokenBonusMs`, audio settings, language, tutorialSeen, idleRatePerSec, etc. survives reload
- Transient run state (`isRunning`, `activeModifiers`, `combo`, camera during run, etc.) is **not** persisted

---

## Where to Find Things (Quick Map)

| I want to...                        | Go here first                              | Then read |
|-------------------------------------|--------------------------------------------|-----------|
| Add new bob / rope / site / cosmetic | `src/data/` files                          | `src/data/CONTEXT.md` |
| Understand how ropes work           | `src/game/rope/`                           | `src/game/rope/CONTEXT.md` |
| Add or modify a behavior            | Search behavior kind in `GameCanvas.tsx` + `src/game/` | `src/game/CONTEXT.md` |
| Change store shape or persistence   | `src/state/store.ts`                       | `src/state/CONTEXT.md` |
| Change rendering / visuals          | `src/game/render.ts`                       | `src/game/CONTEXT.md` (render section) |
| Touch the main game loop            | `src/components/GameCanvas.tsx`            | `src/components/CONTEXT.md` |
| Work on audio / procedural sounds   | `src/audio/`                               | `src/audio/CONTEXT.md` |
| Understand hit zones / token spawning | `src/game/hitZones.ts`, `src/game/tokens.ts` | `src/game/CONTEXT.md` |
| Change camera / view math           | `src/game/viewTransform.ts`                | `src/game/CONTEXT.md` |

---

## How to Use These Docs (Token-Saving Workflow)

**Golden rule**: Never read the whole codebase for a task. Read the smallest relevant slice.

**Typical flow for a task**:

1. Read **root `CONTEXT.md`** (this file) — 2 minutes, gives the map.
2. Read the **one or two area `CONTEXT.md`** files (e.g. `game/` + `game/rope/`).
3. Read `src/types.ts` (the contracts — especially the Behavior interfaces).
4. Jump to **2-4 concrete source files** the context docs point you to.
5. Make the change.
6. (Optional) Re-read only the changed context file(s) and update them if the architecture shifted.

**What each file is optimized for**:
- Root → "Where do I even start?"
- `game/CONTEXT.md` → "How does the simulation actually work on every frame?"
- `game/rope/CONTEXT.md` → "Why is the belt completely different from everything else?"
- `components/CONTEXT.md` → "Why is GameCanvas 3200 lines and full of refs?"
- `state/CONTEXT.md` → "What can I persist vs what must be transient?"

---

## Recommended Reading Order for a New Area

1. Root [CONTEXT.md](./CONTEXT.md) (this file)
2. The most specific area `CONTEXT.md` (data / game / rope / state / components)
3. `src/types.ts` (the source of truth for all `*Def` and `*Behavior` shapes)
4. 1-3 pointed-to implementation files in `src/game/` or `src/components/GameCanvas.tsx`

This pattern routinely gives 85-90% understanding while touching < 12% of total source tokens.

---

## Other Context Files in This Repo

- `src/data/CONTEXT.md`
- `src/game/CONTEXT.md` (core simulation)
- `src/game/rope/CONTEXT.md`
- `src/game/render.md` (custom Canvas2D renderer)
- `src/game/hit-tokens-modifiers.md` (focused supplement)
- `src/state/CONTEXT.md`
- `src/components/CONTEXT.md`
- `src/audio/CONTEXT.md`

Read the smallest set possible for your task.

---

**Last updated**: 2026 (structure is stable since 1.0 behavior-bob release)

If the architecture changes significantly, update this file and the child context files.