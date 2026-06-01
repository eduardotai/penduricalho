# src/state/ — Context

**Role**: The single source of truth for all persistent progress and transient run state. Built on Zustand + persist middleware.

---

## Philosophy

- **One store** (`useGameStore`).
- Almost everything that needs to survive a reload lives here.
- GameCanvas reads from it every frame (via selectors) and writes back (via actions).
- React UI is almost entirely derived from this store.

---

## Major State Groups

### Persistent / Progress
- `momentum` — the main currency
- `stats: Stats` — totalMomentum, totalSwings, totalHits, bestCombo (used for unlocks)
- `owned` — arrays of unlocked item ids per category
- `equipped` — current rig + cosmetics
- `goldenTokenBonusMs` — meta-upgradeable extra duration on golden effects
- `totalGoldenTokens`, `pendingGoldenTokens`
- `idleRatePerSec` — EMA of earnings rate, used for offline progress
- `language`, `tutorialSeen`, `audio` settings, `autoRun`, `autoToken`

### Run State (mostly transient)
- `isRunning`, `runStartId`, `runMomentum`, `runStalled`
- `activeModifiers[]` — current timed effects (with expiresAt)
- `persistentBonuses[]` — golden-spawned bonuses that survive runs
- `combo` — count + lastHitAt (for frenzy, hydra, UI)
- `guaranteedFirstDrop`, `guaranteedFirstBuff` — "Run Again" lucky rolls (consumed on first use)
- `goldenTokenConsumeEpoch` — bump counter that tells GameCanvas "a golden was spent, re-launch now"

### Camera
- `cameraZoom`, `cameraPanX`, `cameraPanY`
- GameCanvas has its own refs for live manipulation; the store values are the "committed" ones.

### Internal
- `worldVersion` — bumped to force full re-creation of Matter world + pendulum (used on equipment change while running, or certain big state resets).

---

## Important Actions (called from UI and from GameCanvas)

- Equipment changes (`equipPendulum`, `equipAttachment`, etc.)
- Purchases (`buyItem`)
- Run control: `startRun`, `endRun`, `resetRunState`
- `addMomentum`, `recordSwingStats`
- Modifier system: `applyModifier`, `tickModifiers`, `clearExpiredModifiers`
- Golden token: `addGoldenToken`, `spendGoldenToken` (the epoch bump lives here)
- `reconcileIdle` — the offline progress engine
- Camera actions

Many of these are thin wrappers that also do side effects (sound, etc.).

---

## Selectors (`selectors.ts`)

**Preferred way** for components and GameCanvas to read derived data:

```ts
const pendulum = useEquippedPendulum();   // returns the full PendulumDef
const attachment = useEquippedAttachment();
const site = useEquippedSite();
const cosmetics = resolveEquippedCosmetics();
```

These do the map lookups from `src/data/` using the ids in the store.

There are also raw selectors for when you need the id only.

---

## Idle Engine (`idleEngine.ts`)

- Runs a simple EMA to track "momentum per second" during foreground play.
- On tab hidden / reload, `reconcileIdle` uses the stored `idleRatePerSec` + wall time delta to grant offline earnings.
- Capped only by real elapsed time (no artificial offline cap).

This is why `idleRatePerSec` and the last reconciliation timestamp are persisted.

---

## Persistence Strategy

Zustand `persist` is configured to save almost everything except pure transients (`isRunning`, `activeModifiers` during a run, the various epoch/flag fields that are only meaningful in one session).

If you add a new field that should survive reloads, make sure it is **not** listed in any `partialize` or skip logic.

---

## WorldVersion Pattern

Changing equipped items while a run is active is dangerous (different bob mass, different rope length, different site walls).

`worldVersion++` tells GameCanvas's effect to tear down the entire Matter world + pendulum + walls + zones + tokens and rebuild everything fresh.

Used in equipment actions and in some golden token paths.

---

## Common Patterns

**From a component**:
```ts
const momentum = useGameStore(s => s.momentum);
const buy = useGameStore(s => s.buyItem);
```

**From GameCanvas** (inside the effect, not during render):
```ts
const store = useGameStore.getState();
store.addMomentum(earned);
store.recordSwingStats(...);
```

Direct `.getState()` is the safe way to read/write from imperative loops.

---

## Gotchas

- `activeModifiers` and `persistentBonuses` have `expiresAt` timestamps (Date.now() based).
- Combo state is intentionally simple (just count + timestamp). The "frenzy" scaling logic lives in the game loop, not here.
- `pendingGoldenTokens` can be > 0 while not in a run. The "Use Token" button is enabled in that state.
- Camera values in the store are the ones saved to localStorage. Live dragging updates the store on pointer up (or throttled).

### Achievements (v20+)
- `unlockedAchievements: Record<id, timestamp>` — the core collection. Drives toasts, panel, and the permanent global Momentum mult.
- `totalGoldenSpent` + `blackHoleCaptures` — lightweight feat counters for specific achievements.
- `lastAchievementUnlock` (transient) — drives the unlock toast exactly like `lastIdleReport`.
- `checkAchievements()` is called from key mutation points (buy, golden spend/catch, endRun, black-hole capture) and is cheap enough to be safe.
- Pure evaluator + declarative defs live in `src/data/achievements.ts`.
- Small permanent bonus: `getAchievementMomentumMult(count)` applied in the scoring hot path (GameCanvas).

---

## Related

- `src/CONTEXT.md` (top level mental model)
- `src/game/CONTEXT.md` (what the game loop actually writes into this store)
- `src/components/` (the UI that drives most of the actions)