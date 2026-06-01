# Hit Zones, Tokens & Modifiers — Quick Context

This is a focused supplement to `src/game/CONTEXT.md`. Read that first.

---

## Hit Zones (`hitZones.ts`)

**What they are**: The multiplier circles the bob scores by sweeping through.

**Key functions**:
- `generateHitZones(site)` — creates the full field for a run based on site density + radius range.
- `regenerateHitZones` — Golden Token "refreshes" the field (keeps some, moves others).
- `spawnExtraZones` — Hydra behavior adds permanent new circles on combo milestones.
- Detection happens in GameCanvas every frame using distance checks + a swept tunneling guard (important for fast bobs on the Layers map).

Each zone carries `basePoints * currentMultiplier * modifier pointMult`.

Zones are **static** during a normal run. Only Golden + Hydra mutate them.

---

## Tokens (`tokens.ts` + `data/tokens.ts`)

Physical drifting objects that appear in the field.

**Two layers**:
1. `TokenDef` (data) — kind, weight for random rolling, `grantsModifierId`
2. `TokenInstance` (runtime) — position, lifetime, drift phase, consumed flag

**Special tokens** (direct effects, not modifiers):
- `golden` — re-launches pendulum + powerful timed bonus
- `repair` — restores rope durability fraction
- `velocity-surge` — instant speed kick

**Normal tokens** grant entries in `activeModifiers[]`.

Token spawning is weighted random, biased by site and some "guaranteed first drop" flags from "Run Again".

---

## Modifiers (`modifiers.ts` + `data/modifiers.ts`)

**`ModifierDef`**: id, duration, `effects: ModifierEffects`

**`ModifierEffects`** (the important shape):
```ts
{
  pointMult?, twistPowerMult?, accelerationMult?, weightMult?,
  bobSizeMult?, ropeLengthMult?, echoCount?,
  velocityGrowthPerSec?
}
```

**Two persistence models**:
- `ActiveModifier[]` — normal timed pickups. Die at end of run or when duration expires.
- `PersistentBonus[]` — spawned by spending Golden Tokens. Survive across multiple runs until their `expiresAt`.

`aggregateEffects()` is called every frame in the game loop to produce the final combined multipliers that all systems read.

**Capped additive duration** helper exists so stacking the same buff doesn't go infinite.

---

## Interaction With Behaviors

- Magnet bob pulls both zones (visually) and loose tokens toward the arc.
- Many size/reach behaviors (`bigger-bob`, `giant-bob`, `frenzy`, `chaos`) work by mutating `bobRadiusScale` / `ropeLengthScale` on the PendulumHandle, which the game loop then applies via the setter functions.
- Speed Ramp token feeds into the rocket synergy and the general `velocityGrowthPerSec` path.

---

## Where The Logic Lives

Most of the orchestration is in **GameCanvas.tsx** (the big frame loop), not in these three files.

These three modules are mostly "data containers + helpers".

When debugging "why didn't my token do anything?", the answer is almost always in the main loop or in how `aggregateEffects` is being applied (or not applied) to a particular system.

---

See also: `src/game/CONTEXT.md` (Behavior hook table) and `src/data/CONTEXT.md`.