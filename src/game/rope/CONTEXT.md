# src/game/rope/ — Context

**Role**: Segmented rope physics, material definitions, and the four special rope behaviors (`flux`, `metronome`, `belt`, `bulwark`).

This is one of the most intricate subsystems because ropes are both **visual** and **physical constraints** that can change shape every frame.

---

## Files

- `index.ts` — Re-exports only.
- `materials.ts` — `RopeMaterialProfile` + base materials + per-item overrides.
- `physics.ts` — `RopePhysicsState` + `applyRopeMaterialForces` (the Hooke's law + damping implementation).

---

## RopeMaterialProfile (The Tuning Surface)

```ts
{
  segmentSpacing,      // how far apart nodes are placed
  nodeRadius,
  nodeMassRatio,
  stiffness,           // constraint stiffness (0.58 elastic → 1.0 rod)
  damping,
  maxStretchRatio,     // 1.002 (rod) → 1.35 (elastic)
  nonlinearGain,       // elastic only — extra force when stretched hard
  frictionAir,
  loadRating,          // used for durability scaling
  durabilitySeconds,   // base lifetime under reference weight
}
```

**BASE** defines the four `AttachmentType`s.
**BY_ID** contains targeted overrides for specific attachments (e.g. "micro-twine" is extra fragile).

Durability drain formula (simplified):
```
drain = (bobWeight / loadRating) * (1 / durabilitySeconds) * behaviorMult
```

---

## How a Normal Rope Is Built (`pendulum.ts` → `buildRopeChain`)

1. Create N lightweight circle bodies (`rope-${i}`) with `COLLISION.ROPE` category.
2. Create constraints between them (and from pivot to first node, last node to bob).
3. Store the original `restLengths` in `RopePhysicsState`.
4. Every frame: `applyRopeMaterialForces` measures current distance vs rest, applies corrective forces.

Rope nodes are **not** the visual line. The visual is drawn as a thick polyline in the renderer (with slight sag for heavy bobs).

---

## RopePhysicsState

Tracks per-constraint rest lengths + live `stretchRatio` (used for visuals and some behaviors).

`applyRopeMaterialForces` is the heart of the soft rope simulation. It implements a spring + damping model with an optional nonlinear region for elastic ropes.

---

## The Four Special Rope Behaviors

### 1. `flux` (Random Rope)
- Every `fluxRerollMs`, picks new target length and drain rate.
- Per-frame lerp toward the targets at `fluxLerpRate`.
- Implemented mostly in GameCanvas (length + durability scaling).
- Feels "alive" and unpredictable.

### 2. `metronome` (Pendulum Line)
- Treated as a **rigid rod** (see `isRigidPendulumAttachment`).
- Length oscillates sinusoidally with `swingPeriodMs` and `swingDepth`.
- Uses a single stiff pivot→bob constraint instead of segmented rope.
- The oscillation pumps a classic pendulum motion.

### 3. `belt` (Mechanic Belt) — Most Complex
- **No rope constraints at all** while active.
- On run start: `generateBeltTunnelPath` creates a random polyline of waypoints.
- The bob is a free body.
- Every frame:
  - Conveyor velocity is applied along the path.
  - Hard containment keeps the bob inside the corridor.
  - `feedBeltRope` / `reelBeltRope` still mutate the (invisible) constraint lengths for payout tracking.
- Repair tokens reel in slack (reduces payout).
- When payout stress gets too high → snaps.
- On snap, the bob is ejected at the current tunnel position with its carried velocity.

**Virtual belt helpers** exist because there are no real constraints to mutate in some code paths.

### 4. `bulwark` (Wall Rope)
- Every `wallIntervalMs`, a random segment stretch is "hardened" into a rigid wall.
- The bob can break the wall by swinging hard enough (`wallBreakSpeed`).
- When broken, that stretch is repaired (softened) after `wallRepairMs`.
- The rope cannot pick up repair tokens while bulwark is active.
- Visuals: hardened sections are drawn thicker/stiffer in the renderer.

---

## AttachmentPhysics (sibling file)

`src/game/attachmentPhysics.ts` handles the **constraint tuning** for the final bob-link (and rigid rods).

It calculates ideal stiffness/damping based on bob mass, gravity, and rest length so that heavy bobs don't cause catastrophic stretch or jitter.

`recommendedConstraintIterations` raises Matter's solver iterations for heavy rigs.

---

## Key Gotchas

- Rope segments use a different collision category on purpose. If you change masks, ropes will snag on ring obstacles.
- Belt has two completely different code paths in some places (real constraints vs virtual payout numbers).
- `resetBeltPayout` / `syncRopeConstraintLengths` must be called on launch and after certain token spends.
- The visual rope line is **not** the physics rope. The physics rope can be very short (many nodes) while the drawn line has slight artistic sag.

---

## When Touching Rope Code

You will almost always also touch:
- `src/game/pendulum.ts` (the big consumer of rope state)
- `src/components/GameCanvas.tsx` (behavior wiring + per-frame calls)
- `src/game/render.ts` (drawing the special states)

Test extreme cases: lightest bob on most fragile rope, heaviest bob on longest elastic, belt on very short corridors, bulwark + heavy nitro.

---

## Related

- `src/game/CONTEXT.md` (main simulation picture)
- `src/game/pendulum.ts` (where most rope handles are created and ticked)
- `src/game/beltTunnel.ts` (the tunnel generator and containment logic)