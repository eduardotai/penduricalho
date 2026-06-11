# src/components/ — Context

**Role**: React UI layer. Very thin for game logic.

The only component that matters for the simulation is `GameCanvas.tsx` — it is effectively the game engine's host.

---

## File Overview

| Component          | Purpose |
|--------------------|---------|
| `GameCanvas.tsx`   | The entire game. Owns Matter world, pendulum, all per-frame systems, custom rendering, input (drag to swing + click zones). ~1000+ lines. |
| `HUD.tsx`          | Top bar (momentum, combo, golden count, run stats). |
| `ControlPanel.tsx` | Start/Run Again, equipment picker, token use button, shop access. |
| `Customize.tsx`    | Skins + shapes grid (cosmetic shop). |
| `Settings.tsx`     | Audio, language, auto-run/token toggles, reset, tutorial. |
| `IdleToast.tsx`    | Shows offline earnings on return. |
| `FormattedNumber.tsx` | Tiny helper for nice number display. |

---

## GameCanvas.tsx — The Heart of Everything

This is the file an AI will spend the most time in when changing gameplay.

### What it owns (all created in a `useEffect` that depends on `worldVersion` + equipped items):

- `EngineHandle` (Matter engine + runner + walls)
- `PendulumHandle`
- `HitZoneField`
- `TokenField`
- `WallField` (including ring obstacles)
- `EffectsState`
- `BeltTunnelPath` (when on belt)
- Maneuver detector
- Various refs for live imperative state (drag, launch pending, token launch queue, camera, user-adjusted flags, stall timers, hit-stop cooldowns, etc.)

### The Main Loop (inside the effect, using `requestAnimationFrame` + `Matter.Runner`)

Rough per-frame order (very important to preserve):

1. Read fresh state from Zustand (`useGameStore.getState()`)
2. Compute aggregate `ModifierEffects` (from active + persistent)
3. Tick physics (Matter runner is already running; we do custom work on top)
4. Apply behavior forces (magnet, rocket, frenzy, chaos, piercer dashes, teleport, etc.)
5. Tick belt tunnel (containment + conveyor) if active
6. Tick tokens (drift + lifetime + collection)
7. Tick modifiers (expiration)
8. Durability drain + snap detection
9. Zone hit detection + scoring + combo + token drops + maneuvers
10. Post-snap behavior (hunter homing, splitter shards, etc.)
11. Wall collision + breakable wall damage
12. Custom settling / damping when the run is winding down
13. Camera following / constraints (optional)
14. Render everything via the custom `draw*` functions in `render.ts`
15. Write back to store (runMomentum, combo, activeModifiers, etc.)
16. Check stall / end-run conditions

### Input Model (Post Plan C)

- **Drag to swing**: Grab the bob/rope to manually influence the swing (fun flavor during spectator runs).
- **Launch**: "Start Run" from the control panel actually launches the rig with impulse. The arena is a spectator physics spectacle.
- Workshop pumping happens exclusively via the dedicated Pump button in `WorkshopPanel` (not on the canvas bob).
- Golden token spend is detected via `goldenTokenConsumeEpoch` changing.

There is also a "suppress launch impulse" path for pure manual drags.

### Special Timers & Cooldowns (many of these are refs, not in store)

- Run end detection (speed below threshold for N ms)
- Stall detection (faster threshold, enables "Run Again" early)
- Hit-stop (brief freeze on big hits)
- Auto-run delay after run ends
- Various behavior cooldowns (piercer dash, teleport, chaos reroll, bulwark hardening, etc.)
- Golden token re-launch queue (at most one per frame)

### Why So Many Refs? (The "Imperative Game Loop in React" Pattern)

`GameCanvas.tsx` is ~3200 lines for a reason. It is a **React component that owns a full 60 fps imperative simulation**.

Refs exist because you cannot put this kind of state in React state or even Zustand without destroying performance or creating feedback loops:

- `pendulumHandleRef`, `engineHandle`, `wallField`, `field` (hit zones), `tokenField`, `effects` — the live Matter + game objects
- `dragRef`, `dragConstraint` (live spring while player is hand-swinging)
- `launchPendingRef`, `tokenLaunchPendingRef`, `lastTokenEpochRef` — cross-frame action queues
- `userAdjustedCameraRef`, `lastAutoZoomRef` — camera behavior flags
- `runIdleMs`, `runStallLowMs`, `hitStopUntil`, `snappedAt`, and dozens of per-behavior counters (`lastDashAt`, `homingEats`, `durability`, `beltGrip`, etc.)
- `beltTunnel`, `maneuvers`, etc.

**Rule of thumb**:
- If it must be read or written **every frame** at 60 fps → ref (or local var inside the effect).
- If React or the HUD needs to react to it → put it in the Zustand store.
- The store is the **boundary** between the imperative world and the reactive UI world.

This pattern is the main reason the component is so large and why almost all gameplay code ends up either in this file or in helpers it calls.

---

## Communication With The Store

**Read**:
- Via hooks at the top of the component (`useEquippedXxx()`, `useGameStore(s => s.xxx)`)
- Via `useGameStore.getState()` inside the animation loop (never during render)

**Write**:
- Call store actions (`store.addMomentum(...)`, `store.applyModifier(...)`, etc.)
- Bump `worldVersion` when you need to force a full physics teardown/rebuild

---

## Rendering Strategy

- Canvas is sized to the container + device pixel ratio.
- Every frame we compute a fresh `ViewTransform` and apply it.
- All drawing happens in `src/game/render.ts` functions.
- The canvas is **never** cleared with CSS — we draw a full backdrop + site background every frame.

---

## Other Components — Rules of Thumb

- They should be **mostly presentational**.
- They read from the store via hooks/selectors.
- They call store actions.
- They rarely (ideally never) import anything from `src/game/` except types.
- They should not contain gameplay math or simulation logic.

`ControlPanel` and `HUD` are the two that are most tightly coupled to run state.

---

## When You Need to Change The Loop

Expect to touch:
1. `GameCanvas.tsx` (the wiring)
2. One or more files in `src/game/` (new helper or behavior)
3. Possibly `src/game/render.ts` (new visuals)
4. `src/state/store.ts` (new action or piece of state)
5. `src/types.ts` (if you're adding a new behavior kind or effect)

---

## Testing / Debugging Tips

- `worldVersion` changes are the nuclear option for "everything is broken after equipment swap".
- Add temporary `console.log` in the frame loop with a frame counter — it's the only reliable way to debug timing.
- The stall + end-run logic is subtle; changing thresholds usually requires playtesting.
- Hit-stop and settle damping interact; be careful when adjusting both.

---

## Related Context Files

- `src/game/CONTEXT.md` — what functions and abstractions the canvas is orchestrating
- `src/state/CONTEXT.md` — the data the canvas is reading and writing
- Root `CONTEXT.md` — the behavior hook philosophy