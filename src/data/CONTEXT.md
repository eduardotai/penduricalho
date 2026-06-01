# src/data/ — Context

**Role**: Pure declarative game content. No runtime behavior, no side effects, no mutation.

This is the **single place** to add new bobs, ropes, sites, cosmetics, tokens, or modifiers.

---

## Philosophy

- Everything here is **data**.
- All gameplay rules that use this data live in `src/game/` or the main loop in `GameCanvas.tsx`.
- Data files export both **arrays** (for iteration, shops, etc.) and **maps** (for fast lookup by id).
- Unlock gates are declarative (`{ stat: "totalHits", gte: 420 }`).

---

## File Map

| File                | Exports                              | Contains |
|---------------------|--------------------------------------|----------|
| `pendulums.ts`      | `PENDULUMS`, `PENDULUM_MAP`, `STARTER_PENDULUM_ID` | All bob definitions + behavior params |
| `attachments.ts`    | `ATTACHMENTS`, `ATTACHMENT_MAP`, `STARTER_ATTACHMENT_ID` | All rope/rod/chain/elastic defs + behavior params |
| `sites.ts`          | `SITES`, `SITE_MAP`, `STARTER_SITE_ID` | Arena definitions (gravity, walls, rings, black hole, etc.) |
| `tokens.ts`         | `TOKENS`, token roll helpers         | Token kinds, weights, which modifier they grant |
| `modifiers.ts`      | `MODIFIERS`, `MODIFIER_MAP`          | Timed effects (bigger bob, speed ramp, etc.) |
| `maneuvers.ts`      | `MANEUVERS`                          | (Currently simple; bonus scoring actions) |
| `bobShapes.ts`      | `BOB_SHAPES`, `SHAPE_MAP`, starter   | Visual shapes (circle, star, cog, ring, etc.) |
| `bobSkins.ts`       | `BOB_SKINS`, `SKIN_MAP`, starter     | Visual palettes + patterns (28 entries) |

---

## The `*Def` Shape Pattern

All major content follows this rough shape:

```ts
interface XxxDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  rarity?: Rarity;
  unlock?: UnlockGate;           // { stat: StatKey, gte: number }
  // ... domain fields ...
  behavior?: SomeBehavior;       // optional special rules
}
```

`UnlockGate` is evaluated against the persistent `Stats` in the store.

---

## How Behaviors Are Declared Here

Example (from pendulums.ts):

```ts
{
  id: "ravager",
  behavior: {
    kind: "hunter",
    chaseAccel: 0.9,
    chaseMaxSpeed: 9,
    satiationEats: 18,
    satiationMs: 6500,
  },
  ...
}
```

The actual implementation of "hunter" lives elsewhere (search for `kind === "hunter"` or `behavior?.kind` in `GameCanvas.tsx` and `src/game/`).

**Rule**: Never put implementation logic in a data file.

---

## Lookup Pattern (Very Common)

```ts
import { PENDULUM_MAP } from "../data/pendulums";

const def = PENDULUM_MAP[equippedId];
if (!def) { /* fallback */ }
```

The maps are built once at module load with `Object.fromEntries(...)`.

---

## Adding New Content — Checklist

1. Add the new object to the array in the appropriate file.
2. If it has an `id`, make sure it appears in the corresponding `MAP`.
3. Add `unlock` gate if it should be progression-locked.
4. If it has a `behavior`, add the params to the matching interface in `src/types.ts` first.
5. Update any starter constants if this should be the new default for new players.
6. Add a changelog entry.
7. (Optional) Add strings/translations in `src/i18n/`.

For new **behavior kinds**, see the main `CONTEXT.md` and `src/game/CONTEXT.md`.

---

## Tokens vs Modifiers (Important Distinction)

- `TokenDef` (in `tokens.ts`): The physical pickup that drops in the field. Has `kind`, `weight`, `grantsModifierId`.
- `ModifierDef` (in `modifiers.ts`): The actual effect (`effects: ModifierEffects`) and duration.

Some tokens are "direct" (velocity-surge, repair, golden) and don't go through the modifier system.

Golden Token is special: it both re-launches the pendulum and grants a powerful temporary modifier.

---

## Invariants & Gotchas

- IDs are stable. Do not rename existing ids after release (breaks saves).
- `basePointMultiplier` on pendulums is a direct multiplier on zone points.
- Site `hitZoneCount` + `hitZoneRadius` range heavily influence difficulty and token drop rate.
- Rope `behavior` kinds (`belt`, `bulwark`, etc.) are much more invasive than most bob behaviors because they affect the rope itself every frame.

---

## Related Files

- `src/types.ts` — Source of truth for all `*Def` and `*Behavior` interfaces.
- `src/state/selectors.ts` — `useEquippedPendulum()`, etc. (they do the lookup using these maps).