import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActiveModifier, ItemKind, PersistentBonus, Stats } from "../types";
import {
  STARTER_PENDULUM_ID,
  PENDULUM_MAP,
} from "../data/pendulums";
import {
  STARTER_ATTACHMENT_ID,
  ATTACHMENT_MAP,
} from "../data/attachments";
import { STARTER_SITE_ID, SITE_MAP } from "../data/sites";
import { STARTER_SKIN_ID, SKIN_MAP, BOB_SKINS } from "../data/bobSkins";
import { STARTER_SHAPE_ID, SHAPE_MAP, BOB_SHAPES } from "../data/bobShapes";
import { MODIFIER_MAP } from "../data/modifiers";
import {
  cappedAdditiveDuration,
  sumPersistentRemainingMs,
} from "../game/modifiers";
import {
  DEFAULT_AUDIO_SETTINGS,
  type AudioSettingsSnapshot,
} from "../audio/types";
import {
  ANCHOR,
  CAMERA_PAN_X_DEFAULT,
  CAMERA_PAN_Y_DEFAULT,
  CAMERA_ZOOM_DEFAULT,
} from "../game/worldConstants";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

interface Owned {
  pendulums: string[];
  attachments: string[];
  sites: string[];
  skins: string[];
  shapes: string[];
}

interface Equipped {
  pendulumId: string;
  attachmentId: string;
  siteId: string;
  skinId: string;
  shapeId: string;
}

interface ComboState {
  count: number;
  lastHitAt: number;
}

export interface GameState {
  momentum: number;
  stats: Stats;
  owned: Owned;
  equipped: Equipped;
  activeModifiers: ActiveModifier[];
  // Bonuses earned from multiplier-circle drops (regular tokens) and from
  // spent Golden Tokens that persist across runs. Each entry has an
  // expiresAt timestamp; the same defId can appear multiple times so
  // identical pickups stack instead of refreshing.
  persistentBonuses: PersistentBonus[];
  combo: ComboState;
  worldVersion: number;
  isRunning: boolean;
  runStartId: number;
  runMomentum: number;
  totalRuns: number;
  bestRunMomentum: number;
  // True once the current run has decelerated enough that the pendulum can no
  // longer realistically reach a hit zone. Stays true while !isRunning so the
  // "Run Again" button is always clickable between runs.
  runStalled: boolean;
  // Extra duration (in ms) added to the Golden Token's bonus modifier when
  // collected. Grindable via future meta-upgrades — the field is persisted so
  // those upgrades can compound across runs.
  goldenTokenBonusMs: number;
  // Total Golden Tokens the player has ever caught. Surfaced in the HUD and
  // can later gate meta-upgrades.
  totalGoldenTokens: number;
  // Golden Tokens the player has caught but not yet spent. The Use Token
  // button decrements this and triggers a mid-run re-launch + bonus modifier.
  // Persisted so a token survives a page reload.
  pendingGoldenTokens: number;
  // Monotonic counter bumped each time spendGoldenToken() actually consumes a
  // token. The canvas effect watches this (React-side) to know when to fire
  // the physical re-launch on the live pendulum. Not persisted.
  goldenTokenConsumeEpoch: number;
  // True when the current run was launched via the "Run Again" button and won
  // the 70% lucky roll: the first hit-zone strike of the run will be forced
  // to drop a token, regardless of that zone's normal modifierChance. The
  // canvas consumes (and clears) this flag the first time a real bob lands a
  // zone hit. Transient — never persisted, always cleared on reset.
  guaranteedFirstDrop: boolean;
  // True when the current run was launched via "Run Again" and won the 40%
  // buff roll: the first token dropped from a multiplier circle this run is
  // forced to be a beneficial buff. Consumed by the canvas the first time a
  // token actually spawns. Transient — never persisted, always cleared on reset.
  guaranteedFirstBuff: boolean;
  cameraZoom: number;
  cameraPanX: number;
  cameraPanY: number;
  audio: AudioSettingsSnapshot;
  autoRun: boolean;
  autoToken: boolean;
  // Active UI language. Persisted so the player's choice survives reloads.
  language: Lang;
  // Whether the player has dismissed the first-time "How to Play" tutorial.
  // Persisted so it only auto-opens once; it stays reopenable from the controls.
  tutorialSeen: boolean;
  // --- Idle / background accrual ---------------------------------------------
  // Smoothed Momentum-per-second earned during live foreground play (an EMA fed
  // by the idle engine). Drives how much the pendulum "earns" while the tab is
  // hidden or the page is closed. Persisted so the rate survives a reload.
  idleRatePerSec: number;
  // Wall-clock (Date.now) timestamp the idle engine last reconciled. The gap
  // between this and "now" on the next reconcile is the time to credit (capped
  // only by reality — earnings are uncapped per the chosen design). Persisted
  // so offline progress can be granted across full page reloads.
  lastActiveAt: number;
  // Transient one-shot payload for the "while you were away" toast. Never
  // persisted; `seq` bumps each time so the UI can re-trigger the banner.
  lastIdleReport: { momentum: number; ms: number; seq: number } | null;

  addMomentum: (n: number) => void;
  registerHit: (points: number, now: number) => void;
  registerSwing: () => void;
  spend: (n: number) => boolean;
  buy: (kind: ItemKind, id: string) => boolean;
  equip: (kind: ItemKind, id: string) => void;
  pushModifier: (defId: string, now: number, addMs?: number) => void;
  // Stack one cross-run bonus for the given modifier defId. Each layer lasts
  // the modifier's durationMs (or an explicit override). Multiple calls for
  // the same defId stack — they do NOT refresh — so chained pickups compound.
  // Total stacked time per defId is capped at MODIFIER_DURATION_CAP_MS.
  addPersistentBonus: (defId: string, now: number, durationMs?: number) => void;
  expireModifiers: (now: number) => void;
  decayCombo: (now: number, decayMs: number) => void;
  startRun: () => void;
  // Player-initiated emergency reset: closes the current run immediately
  // (even before stall detection) and launches a fresh one with all timed
  // modifiers, persistent bonus stacks, and ready/spawned tokens cleared.
  hardEndAndRestartRun: () => void;
  endRun: () => void;
  markRunStalled: () => void;
  // Called by the canvas when a Golden Token is physically picked up. Adds
  // one to the ready charge slot — the player still has to spend it.
  claimGoldenToken: () => void;
  // Player-initiated. Decrements pendingGoldenTokens and bumps the consume
  // epoch so the canvas applies a fresh impulse + bonus modifier. No-op if
  // the player has no charges or there's no live run to boost.
  spendGoldenToken: () => boolean;
  grantGoldenTokenBonus: (ms: number) => void;
  // Returns true exactly once per qualifying run, on the first call after a
  // successful "Run Again" lucky roll. Clears the flag as a side effect so
  // subsequent hits this run roll modifierChance normally. The canvas calls
  // this from scoreZoneHit on each real-bob zone strike.
  consumeFirstDropGuarantee: () => boolean;
  // Like consumeFirstDropGuarantee but for the guaranteed-buff roll. Returns
  // true exactly once per qualifying run, on the first call after a successful
  // "Run Again" buff roll, and clears the flag. The canvas calls this when the
  // first token actually drops so it can force that token to be a buff.
  consumeFirstBuffGuarantee: () => boolean;
  setCameraZoom: (zoom: number) => void;
  adjustCameraZoom: (factor: number) => void;
  // Zoom by `factor` while keeping the world point under a focal screen point
  // fixed (pinch-to-zoom toward the fingers). focalU/focalV are the focal point
  // in virtual/world-cover units: (screenCssPx - view.fit) / view.coverScale.
  zoomAtScreenPoint: (factor: number, focalU: number, focalV: number) => void;
  panCamera: (screenDx: number, screenDy: number) => void;
  resetCameraPan: () => void;
  resetDisplaySettings: () => void;
  toggleAutoRun: () => void;
  toggleAutoToken: () => void;
  setLanguage: (lang: Lang) => void;
  // Marks the first-time tutorial as seen so it stops auto-opening.
  dismissTutorial: () => void;
  setAudioMasterVolume: (volume: number) => void;
  setAudioSfxVolume: (volume: number) => void;
  setAudioUiVolume: (volume: number) => void;
  setAudioMusicVolume: (volume: number) => void;
  setAudioMuted: (muted: boolean) => void;
  toggleAudioMuted: () => void;
  setAudioMusicEnabled: (enabled: boolean) => void;
  setAudioAmbientEnabled: (enabled: boolean) => void;
  // Idle engine hooks (see state/idleEngine.ts):
  // Replace the smoothed earn rate (Momentum/sec) used for background accrual.
  setIdleRate: (ratePerSec: number) => void;
  // Anchor the offline clock to `now` without crediting anything.
  touchActive: (now: number) => void;
  // Credit `amount` Momentum earned while idle and re-anchor the clock. When
  // `reportMs > 0` also raises a "while you were away" toast for that span.
  applyIdleEarnings: (amount: number, reportMs: number) => void;
  reset: () => void;
}

const COMBO_DECAY_MS = 1800;

// Max stacked duration (active or persistent) for ordinary buffs. Hard ceiling:
// no ordinary buff can ever hold longer than this, no matter how often it's
// re-collected.
export const MODIFIER_DURATION_CAP_MS = 7_000;

// The Golden Token bonus is exempt from the 7s ceiling — its duration is a
// grindable upgrade (goldenTokenBonusMs), so it keeps its own high cap so each
// spent token can still extend the boost.
export const TOKEN_BONUS_DURATION_CAP_MS = 120_000;

/** Per-defId duration ceiling. Golden Token is exempt; everything else is 7s. */
export function modifierDurationCapMs(defId: string): number {
  return defId === "token-bonus"
    ? TOKEN_BONUS_DURATION_CAP_MS
    : MODIFIER_DURATION_CAP_MS;
}

// Modifiers that share the same "channel" — picking one cancels the others so
// their effects (e.g. bob size) can never multiply together. Bigger Bob and
// Giant Bob are size buffs of the same family, so only the freshest one holds.
const MUTUALLY_EXCLUSIVE_GROUPS: readonly (readonly string[])[] = [
  ["bigger-bob", "giant-bob"],
];

/** Modifier ids that must be cleared when `defId` becomes active. */
export function conflictingModifierIds(defId: string): string[] {
  const out: string[] = [];
  for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
    if (group.includes(defId)) {
      for (const id of group) if (id !== defId) out.push(id);
    }
  }
  return out;
}

// Modifiers where re-picking the same token should REFRESH the timer rather
// than extend/accumulate it. Bob-size buffs are one-at-a-time effects, so
// grabbing the same one again just resets its window instead of stacking
// duration (active layer) or piling up persistent layers.
const NON_STACKING_MODIFIER_IDS = new Set<string>([
  "bigger-bob",
  "giant-bob",
  "tiny-bob",
]);

export function isNonStackingModifier(defId: string): boolean {
  return NON_STACKING_MODIFIER_IDS.has(defId);
}

/** @deprecated Used only for save migration from run-based bonuses. */
const LEGACY_PERSISTENT_BONUS_MS = 30_000;

// Probability that a "Run Again" launch guarantees at least one token drop
// from the very first hit-zone strike of the new run. Only rolled when the
// launch is a re-launch (totalRuns > 0 OR a stalled run is being restarted);
// the player's very first Start Run never gets this bonus.
export const RUN_AGAIN_GUARANTEED_DROP_CHANCE = 0.7;

// Probability that a "Run Again" launch forces the very first token dropped
// from a multiplier circle to be a guaranteed buff (a beneficial swing
// modifier) instead of a normal random roll. Same Run Again gating as the
// lucky-drop chance above; the player's first Start Run never gets it.
export const RUN_AGAIN_GUARANTEED_BUFF_CHANCE = 0.4;

export const CAMERA_ZOOM_MIN = 0.5;
export const CAMERA_ZOOM_MAX = 2;

export { CAMERA_PAN_X_DEFAULT, CAMERA_PAN_Y_DEFAULT, CAMERA_ZOOM_DEFAULT };

function clampCameraZoom(zoom: number) {
  return Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, zoom));
}

function clampVolume(volume: number) {
  return Math.min(1, Math.max(0, volume));
}

/** Trim persistent layers so total remaining per defId stays within the cap. */
function clampPersistentBonuses(
  bonuses: PersistentBonus[],
  now: number
): PersistentBonus[] {
  const byDef = new Map<string, PersistentBonus[]>();
  for (const bonus of bonuses) {
    if (bonus.expiresAt <= now) continue;
    const list = byDef.get(bonus.defId) ?? [];
    list.push(bonus);
    byDef.set(bonus.defId, list);
  }

  const clamped: PersistentBonus[] = [];
  for (const [defId, layers] of byDef) {
    layers.sort((a, b) => b.expiresAt - a.expiresAt);
    let budget = modifierDurationCapMs(defId);
    for (const layer of layers) {
      if (budget <= 0) break;
      const remaining = layer.expiresAt - now;
      const granted = Math.min(remaining, budget);
      if (granted <= 0) continue;
      clamped.push({ defId, expiresAt: now + granted });
      budget -= granted;
    }
  }
  return clamped;
}

const initialOwned: Owned = {
  pendulums: [STARTER_PENDULUM_ID],
  attachments: [STARTER_ATTACHMENT_ID],
  sites: [STARTER_SITE_ID],
  skins: [STARTER_SKIN_ID],
  shapes: [STARTER_SHAPE_ID],
};

const initialEquipped: Equipped = {
  pendulumId: STARTER_PENDULUM_ID,
  attachmentId: STARTER_ATTACHMENT_ID,
  siteId: STARTER_SITE_ID,
  skinId: STARTER_SKIN_ID,
  shapeId: STARTER_SHAPE_ID,
};

const initialStats: Stats = {
  totalMomentum: 0,
  totalSwings: 0,
  totalHits: 0,
  bestCombo: 0,
};

function normalizeCosmeticState(state: Record<string, unknown>): Record<string, unknown> {
  const owned = (state.owned as Owned | undefined) ?? initialOwned;
  const equipped = (state.equipped as Equipped | undefined) ?? initialEquipped;
  // The site roster was culled down to Workshop + Bumper Cage. Drop any sites
  // (e.g. the retired foundry/belfry/etc.) that no longer exist, always keep
  // the starter, and reset the equipped site if it points at a removed one.
  const sites =
    Array.isArray(owned.sites) && owned.sites.length > 0
      ? owned.sites.filter((id) => SITE_MAP.has(id))
      : [STARTER_SITE_ID];
  if (!sites.includes(STARTER_SITE_ID)) sites.unshift(STARTER_SITE_ID);
  const siteId =
    typeof equipped.siteId === "string" && SITE_MAP.has(equipped.siteId)
      ? equipped.siteId
      : STARTER_SITE_ID;
  const skins =
    Array.isArray(owned.skins) && owned.skins.length > 0
      ? owned.skins.filter((id) => SKIN_MAP.has(id))
      : [STARTER_SKIN_ID];
  if (!skins.includes(STARTER_SKIN_ID)) skins.unshift(STARTER_SKIN_ID);
  const skinId =
    typeof equipped.skinId === "string" && SKIN_MAP.has(equipped.skinId)
      ? equipped.skinId
      : STARTER_SKIN_ID;
  const shapes =
    Array.isArray(owned.shapes) && owned.shapes.length > 0
      ? owned.shapes.filter((id) => SHAPE_MAP.has(id))
      : [STARTER_SHAPE_ID];
  if (!shapes.includes(STARTER_SHAPE_ID)) shapes.unshift(STARTER_SHAPE_ID);
  const shapeId =
    typeof equipped.shapeId === "string" && SHAPE_MAP.has(equipped.shapeId)
      ? equipped.shapeId
      : STARTER_SHAPE_ID;
  return {
    ...state,
    owned: { ...owned, sites, skins, shapes },
    equipped: { ...equipped, siteId, skinId, shapeId },
  };
}

function normalizeSkinState(state: Record<string, unknown>): Record<string, unknown> {
  return normalizeCosmeticState(state);
}

function ownedSkinsList(owned: { skins?: string[] }): string[] {
  return Array.isArray(owned.skins) && owned.skins.length > 0
    ? owned.skins
    : [STARTER_SKIN_ID];
}

function ownedShapesList(owned: { shapes?: string[] }): string[] {
  return Array.isArray(owned.shapes) && owned.shapes.length > 0
    ? owned.shapes
    : [STARTER_SHAPE_ID];
}

function getCost(kind: ItemKind, id: string): number | null {
  if (kind === "pendulum") return PENDULUM_MAP.get(id)?.cost ?? null;
  if (kind === "attachment") return ATTACHMENT_MAP.get(id)?.cost ?? null;
  if (kind === "site") return SITE_MAP.get(id)?.cost ?? null;
  if (kind === "skin") return SKIN_MAP.get(id)?.cost ?? null;
  if (kind === "shape") return SHAPE_MAP.get(id)?.cost ?? null;
  return null;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      momentum: 0,
      stats: initialStats,
      owned: initialOwned,
      equipped: initialEquipped,
      activeModifiers: [],
      persistentBonuses: [],
      combo: { count: 0, lastHitAt: 0 },
      worldVersion: 0,
      isRunning: false,
      runStartId: 0,
      runMomentum: 0,
      totalRuns: 0,
      bestRunMomentum: 0,
      runStalled: true,
      goldenTokenBonusMs: 0,
      totalGoldenTokens: 0,
      pendingGoldenTokens: 0,
      goldenTokenConsumeEpoch: 0,
      guaranteedFirstDrop: false,
      guaranteedFirstBuff: false,
      cameraZoom: CAMERA_ZOOM_DEFAULT,
      cameraPanX: CAMERA_PAN_X_DEFAULT,
      cameraPanY: CAMERA_PAN_Y_DEFAULT,
      audio: { ...DEFAULT_AUDIO_SETTINGS },
      autoRun: false,
      autoToken: false,
      language: DEFAULT_LANG,
      tutorialSeen: false,
      idleRatePerSec: 0,
      lastActiveAt: 0,
      lastIdleReport: null,

      addMomentum: (n) =>
        set((s) => ({
          momentum: s.momentum + n,
          runMomentum: s.isRunning ? s.runMomentum + n : s.runMomentum,
          stats: { ...s.stats, totalMomentum: s.stats.totalMomentum + n },
        })),

      registerHit: (points, now) =>
        set((s) => {
          const stillInCombo = now - s.combo.lastHitAt < COMBO_DECAY_MS;
          const newCount = stillInCombo ? s.combo.count + 1 : 1;
          const bestCombo = Math.max(s.stats.bestCombo, newCount);
          return {
            momentum: s.momentum + points,
            runMomentum: s.isRunning ? s.runMomentum + points : s.runMomentum,
            stats: {
              ...s.stats,
              totalMomentum: s.stats.totalMomentum + points,
              totalHits: s.stats.totalHits + 1,
              bestCombo,
            },
            combo: { count: newCount, lastHitAt: now },
          };
        }),

      registerSwing: () =>
        set((s) => ({
          stats: { ...s.stats, totalSwings: s.stats.totalSwings + 1 },
        })),

      spend: (n) => {
        const s = get();
        if (s.momentum < n) return false;
        set({ momentum: s.momentum - n });
        return true;
      },

      buy: (kind, id) => {
        const cost = getCost(kind, id);
        if (cost == null) return false;
        const s = get();
        const ownedList =
          kind === "pendulum"
            ? s.owned.pendulums
            : kind === "attachment"
              ? s.owned.attachments
              : kind === "site"
                ? s.owned.sites
                : kind === "skin"
                  ? ownedSkinsList(s.owned)
                  : ownedShapesList(s.owned);
        if (ownedList.includes(id)) return false;
        if (s.momentum < cost) return false;
        set((prev) => {
          const owned = { ...prev.owned };
          if (kind === "pendulum") owned.pendulums = [...prev.owned.pendulums, id];
          if (kind === "attachment") owned.attachments = [...prev.owned.attachments, id];
          if (kind === "site") owned.sites = [...prev.owned.sites, id];
          if (kind === "skin") owned.skins = [...ownedSkinsList(prev.owned), id];
          if (kind === "shape") owned.shapes = [...ownedShapesList(prev.owned), id];
          return { momentum: prev.momentum - cost, owned };
        });
        return true;
      },

      equip: (kind, id) => {
        set((s) => {
          const ownedList =
            kind === "pendulum"
              ? s.owned.pendulums
              : kind === "attachment"
                ? s.owned.attachments
                : kind === "site"
                  ? s.owned.sites
                  : kind === "skin"
                    ? ownedSkinsList(s.owned)
                    : ownedShapesList(s.owned);
          if (!ownedList.includes(id)) return s;
          const equipped: Equipped = { ...s.equipped };
          if (kind === "pendulum") equipped.pendulumId = id;
          if (kind === "attachment") equipped.attachmentId = id;
          if (kind === "site") equipped.siteId = id;
          if (kind === "skin") equipped.skinId = id;
          if (kind === "shape") equipped.shapeId = id;
          const cosmeticChange = kind === "skin" || kind === "shape";
          return {
            equipped,
            worldVersion: cosmeticChange ? s.worldVersion : s.worldVersion + 1,
          };
        });
      },

      pushModifier: (defId, now, addMsOverride) => {
        const def = MODIFIER_MAP.get(defId);
        if (!def) return;
        const addMs = addMsOverride ?? def.durationMs;
        if (addMs <= 0) return;
        const conflicts = conflictingModifierIds(defId);
        set((s) => {
          const existing = s.activeModifiers.find((m) => m.defId === defId);
          const others = s.activeModifiers.filter(
            (m) => m.defId !== defId && !conflicts.includes(m.defId)
          );
          // Clear any lingering conflicting buff (active or persistent) so the
          // mutually-exclusive size families never compound.
          const persistentBonuses = conflicts.length
            ? s.persistentBonuses.filter((b) => !conflicts.includes(b.defId))
            : s.persistentBonuses;
          // Speed Ramp's boost curve is tied to a fixed ramp window, and the
          // non-stacking buffs (e.g. bob-size) are one-at-a-time — both refresh
          // the timer to the base duration instead of extending/accumulating.
          if (defId === "speed-ramp" || isNonStackingModifier(defId)) {
            return {
              activeModifiers: [...others, { defId, expiresAt: now + def.durationMs }],
              persistentBonuses,
            };
          }
          const currentRemaining = existing
            ? Math.max(0, existing.expiresAt - now)
            : 0;
          const total = cappedAdditiveDuration(
            currentRemaining,
            addMs,
            modifierDurationCapMs(defId)
          );
          if (total <= 0) return { activeModifiers: others, persistentBonuses };
          return {
            activeModifiers: [...others, { defId, expiresAt: now + total }],
            persistentBonuses,
          };
        });
      },

      addPersistentBonus: (defId, now, durationMs) => {
        const def = MODIFIER_MAP.get(defId);
        if (!def) return;
        const layerMs = durationMs ?? def.durationMs;
        if (layerMs <= 0) return;
        const conflicts = conflictingModifierIds(defId);
        set((s) => {
          // Drop any conflicting buff so mutually-exclusive families don't
          // linger and compound across active + persistent layers.
          const basePersistent = conflicts.length
            ? s.persistentBonuses.filter((b) => !conflicts.includes(b.defId))
            : s.persistentBonuses;
          const activeModifiers = conflicts.length
            ? s.activeModifiers.filter((m) => !conflicts.includes(m.defId))
            : s.activeModifiers;
          // Non-stacking buffs keep a single refreshed persistent layer rather
          // than piling up duration each time the same token is grabbed.
          if (isNonStackingModifier(defId)) {
            const withoutSelf = basePersistent.filter((b) => b.defId !== defId);
            return {
              activeModifiers,
              persistentBonuses: clampPersistentBonuses(
                [...withoutSelf, { defId, expiresAt: now + layerMs }],
                now
              ),
            };
          }
          const currentTotal = sumPersistentRemainingMs(
            basePersistent,
            defId,
            now
          );
          const granted = cappedAdditiveDuration(
            currentTotal,
            layerMs,
            modifierDurationCapMs(defId)
          ) - currentTotal;
          if (granted <= 0) {
            if (!conflicts.length) return s;
            return {
              activeModifiers,
              persistentBonuses: clampPersistentBonuses(basePersistent, now),
            };
          }
          return {
            activeModifiers,
            persistentBonuses: clampPersistentBonuses(
              [
                ...basePersistent,
                { defId, expiresAt: now + granted },
              ],
              now
            ),
          };
        });
      },

      expireModifiers: (now) =>
        set((s) => {
          const activeModifiers = s.activeModifiers.filter((m) => m.expiresAt > now);
          const persistentBonuses = s.persistentBonuses.filter((b) => b.expiresAt > now);
          if (
            activeModifiers.length === s.activeModifiers.length &&
            persistentBonuses.length === s.persistentBonuses.length
          ) {
            return s;
          }
          return { activeModifiers, persistentBonuses };
        }),

      decayCombo: (now, decayMs) =>
        set((s) => {
          if (s.combo.count === 0) return s;
          if (now - s.combo.lastHitAt < decayMs) return s;
          return { combo: { count: 0, lastHitAt: s.combo.lastHitAt } };
        }),

      startRun: () =>
        set((s) => {
          // The launch button is gated so this only fires when no run is
          // running, or when the current run is already stalled. In the latter
          // case we close out the previous run cleanly first so stats stay
          // accurate when the player triggers an early restart.
          const closingPrevious = s.isRunning;
          // "Run Again" click means the player has either completed at least
          // one run, or is restarting a stalled run mid-flight. Both cases
          // show the "Run Again" label in the UI and both qualify for the
          // 70% lucky-drop roll. The very first Start Run does not.
          const isRunAgainLaunch = s.totalRuns > 0 || s.isRunning;
          const guaranteedFirstDrop =
            isRunAgainLaunch && Math.random() < RUN_AGAIN_GUARANTEED_DROP_CHANCE;
          const guaranteedFirstBuff =
            isRunAgainLaunch && Math.random() < RUN_AGAIN_GUARANTEED_BUFF_CHANCE;
          return {
            isRunning: true,
            runStartId: s.runStartId + 1,
            runMomentum: 0,
            combo: { count: 0, lastHitAt: 0 },
            runStalled: false,
            totalRuns: closingPrevious ? s.totalRuns + 1 : s.totalRuns,
            bestRunMomentum: closingPrevious
              ? Math.max(s.bestRunMomentum, s.runMomentum)
              : s.bestRunMomentum,
            guaranteedFirstDrop,
            guaranteedFirstBuff,
          };
        }),

      hardEndAndRestartRun: () =>
        set((s) => {
          const closingPrevious = s.isRunning;
          const isRunAgainLaunch = s.totalRuns > 0 || s.isRunning;
          const guaranteedFirstDrop =
            isRunAgainLaunch && Math.random() < RUN_AGAIN_GUARANTEED_DROP_CHANCE;
          const guaranteedFirstBuff =
            isRunAgainLaunch && Math.random() < RUN_AGAIN_GUARANTEED_BUFF_CHANCE;
          return {
            activeModifiers: [],
            persistentBonuses: [],
            // Ready golden tokens survive a hard reset — spend them first if
            // you want a clean slate. Reset the consume epoch so queued canvas
            // relaunches from a prior spend don't fire on the fresh run.
            goldenTokenConsumeEpoch: 0,
            guaranteedFirstDrop,
            guaranteedFirstBuff,
            isRunning: true,
            runStartId: s.runStartId + 1,
            runMomentum: 0,
            combo: { count: 0, lastHitAt: 0 },
            runStalled: false,
            totalRuns: closingPrevious ? s.totalRuns + 1 : s.totalRuns,
            bestRunMomentum: closingPrevious
              ? Math.max(s.bestRunMomentum, s.runMomentum)
              : s.bestRunMomentum,
          };
        }),

      endRun: () =>
        set((s) => ({
          isRunning: false,
          totalRuns: s.totalRuns + 1,
          bestRunMomentum: Math.max(s.bestRunMomentum, s.runMomentum),
          runStalled: true,
          // Drop any unused first-drop guarantee at end-of-run so an unhit
          // run never silently funnels its bonus into the next launch — the
          // 70% roll is re-evaluated fresh every Run Again.
          guaranteedFirstDrop: false,
          // Likewise drop any unused buff guarantee — re-rolled each Run Again.
          guaranteedFirstBuff: false,
        })),

      markRunStalled: () =>
        set((s) => (s.runStalled ? s : { runStalled: true })),

      claimGoldenToken: () =>
        set((s) => ({
          totalGoldenTokens: s.totalGoldenTokens + 1,
          pendingGoldenTokens: s.pendingGoldenTokens + 1,
        })),

      // Spend one ready Golden Token. Refuses to fire if the player has no
      // charge or if there's no running pendulum to boost — we don't want a
      // wasted token on the menu/idle screen.
      spendGoldenToken: () => {
        const s = get();
        if (s.pendingGoldenTokens <= 0) return false;
        if (!s.isRunning) return false;
        set({
          pendingGoldenTokens: s.pendingGoldenTokens - 1,
          goldenTokenConsumeEpoch: s.goldenTokenConsumeEpoch + 1,
        });
        return true;
      },

      // Hook for future meta-upgrades. Adds `ms` to the persisted bonus pool
      // that stretches every Golden Token's effect duration. Negative values
      // are clamped to keep the bonus non-negative.
      grantGoldenTokenBonus: (ms) =>
        set((s) => ({
          goldenTokenBonusMs: Math.max(0, s.goldenTokenBonusMs + ms),
        })),

      consumeFirstDropGuarantee: () => {
        const s = get();
        if (!s.guaranteedFirstDrop) return false;
        set({ guaranteedFirstDrop: false });
        return true;
      },

      consumeFirstBuffGuarantee: () => {
        const s = get();
        if (!s.guaranteedFirstBuff) return false;
        set({ guaranteedFirstBuff: false });
        return true;
      },

      setCameraZoom: (zoom) => set({ cameraZoom: clampCameraZoom(zoom) }),

      adjustCameraZoom: (factor) =>
        set((s) => ({ cameraZoom: clampCameraZoom(s.cameraZoom * factor) })),

      zoomAtScreenPoint: (factor, focalU, focalV) =>
        set((s) => {
          const z0 = s.cameraZoom;
          const z1 = clampCameraZoom(z0 * factor);
          if (z1 === z0) return {};
          // Keep the world point under (focalU, focalV) stationary across the
          // zoom change. worldX = (focalU - anchor) / zoom + anchor - panX, so
          // holding worldX constant gives panX += (focal - anchor)(1/z1 - 1/z0).
          const inv = 1 / z1 - 1 / z0;
          return {
            cameraZoom: z1,
            cameraPanX: s.cameraPanX + (focalU - ANCHOR.x) * inv,
            cameraPanY: s.cameraPanY + (focalV - ANCHOR.y) * inv,
          };
        }),

      panCamera: (screenDx, screenDy) =>
        set((s) => ({
          cameraPanX: s.cameraPanX + screenDx / s.cameraZoom,
          cameraPanY: s.cameraPanY + screenDy / s.cameraZoom,
        })),

      resetCameraPan: () =>
        set({ cameraPanX: CAMERA_PAN_X_DEFAULT, cameraPanY: CAMERA_PAN_Y_DEFAULT }),

      resetDisplaySettings: () =>
        set({
          cameraZoom: CAMERA_ZOOM_DEFAULT,
          cameraPanX: CAMERA_PAN_X_DEFAULT,
          cameraPanY: CAMERA_PAN_Y_DEFAULT,
        }),

      toggleAutoRun: () => set((s) => ({ autoRun: !s.autoRun })),
      toggleAutoToken: () => set((s) => ({ autoToken: !s.autoToken })),

      setLanguage: (lang) => set({ language: lang }),

      dismissTutorial: () => set({ tutorialSeen: true }),

      setAudioMasterVolume: (volume) =>
        set((s) => ({
          audio: { ...s.audio, masterVolume: clampVolume(volume) },
        })),

      setAudioSfxVolume: (volume) =>
        set((s) => ({
          audio: { ...s.audio, sfxVolume: clampVolume(volume) },
        })),

      setAudioUiVolume: (volume) =>
        set((s) => ({
          audio: { ...s.audio, uiVolume: clampVolume(volume) },
        })),

      setAudioMusicVolume: (volume) =>
        set((s) => ({
          audio: { ...s.audio, musicVolume: clampVolume(volume) },
        })),

      setAudioMuted: (muted) =>
        set((s) => ({ audio: { ...s.audio, muted } })),

      toggleAudioMuted: () =>
        set((s) => ({ audio: { ...s.audio, muted: !s.audio.muted } })),

      setAudioMusicEnabled: (enabled) =>
        set((s) => ({ audio: { ...s.audio, musicEnabled: enabled } })),

      setAudioAmbientEnabled: (enabled) =>
        set((s) => ({ audio: { ...s.audio, ambientEnabled: enabled } })),

      setIdleRate: (ratePerSec) =>
        set({ idleRatePerSec: Math.max(0, ratePerSec) }),

      touchActive: (now) => set({ lastActiveAt: now }),

      applyIdleEarnings: (amount, reportMs) =>
        set((s) => {
          const gain = Math.max(0, Math.floor(amount));
          const next: Partial<GameState> = { lastActiveAt: Date.now() };
          if (gain > 0) {
            next.momentum = s.momentum + gain;
            // Crediting mid-run keeps the run's tally honest with the bank.
            next.runMomentum = s.isRunning ? s.runMomentum + gain : s.runMomentum;
            next.stats = {
              ...s.stats,
              totalMomentum: s.stats.totalMomentum + gain,
            };
          }
          if (reportMs > 0 && gain > 0) {
            next.lastIdleReport = {
              momentum: gain,
              ms: reportMs,
              seq: (s.lastIdleReport?.seq ?? 0) + 1,
            };
          }
          return next;
        }),

      reset: () =>
        set({
          momentum: 0,
          stats: initialStats,
          owned: initialOwned,
          equipped: initialEquipped,
          activeModifiers: [],
          persistentBonuses: [],
          combo: { count: 0, lastHitAt: 0 },
          worldVersion: 0,
          isRunning: false,
          runStartId: 0,
          runMomentum: 0,
          totalRuns: 0,
          bestRunMomentum: 0,
          runStalled: true,
          goldenTokenBonusMs: 0,
          totalGoldenTokens: 0,
          pendingGoldenTokens: 0,
          goldenTokenConsumeEpoch: 0,
          guaranteedFirstDrop: false,
          guaranteedFirstBuff: false,
          cameraZoom: CAMERA_ZOOM_DEFAULT,
          cameraPanX: CAMERA_PAN_X_DEFAULT,
          cameraPanY: CAMERA_PAN_Y_DEFAULT,
          audio: { ...DEFAULT_AUDIO_SETTINGS },
          idleRatePerSec: 0,
          lastActiveAt: 0,
          lastIdleReport: null,
        }),
    }),
    {
      name: "pendulum-clicker-save",
      version: 19,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        const audio = (state.audio as Record<string, unknown> | undefined) ?? {};
        const mergedAudio = {
          ...DEFAULT_AUDIO_SETTINGS,
          ...audio,
        };
        if (version < 6) {
          return {
            ...state,
            audio: mergedAudio,
            cameraZoom: CAMERA_ZOOM_DEFAULT,
          };
        }
        if (version < 7 && state.cameraZoom == null) {
          return { ...state, audio: mergedAudio, cameraZoom: CAMERA_ZOOM_DEFAULT };
        }
        if (version < 8) {
          return {
            ...state,
            audio: {
              ...mergedAudio,
              musicVolume:
                typeof audio.musicVolume === "number" ? audio.musicVolume : 0.22,
              musicEnabled:
                typeof audio.musicEnabled === "boolean" ? audio.musicEnabled : true,
            },
          };
        }
        if (version < 9) {
          const now = Date.now();
          const legacyRunsPerStack = 5;
          const rawBonuses = (state.persistentBonuses as
            | { defId: string; runsRemaining?: number; expiresAt?: number }[]
            | undefined) ?? [];
          const persistentBonuses = rawBonuses
            .map((bonus) => {
              if (typeof bonus.expiresAt === "number") return bonus;
              const runsRemaining =
                typeof bonus.runsRemaining === "number" ? bonus.runsRemaining : 0;
              if (runsRemaining <= 0) return null;
              const msPerRun = LEGACY_PERSISTENT_BONUS_MS / legacyRunsPerStack;
              return {
                defId: bonus.defId,
                expiresAt: now + runsRemaining * msPerRun,
              };
            })
            .filter((bonus): bonus is PersistentBonus => bonus != null);
          return { ...state, audio: mergedAudio, persistentBonuses };
        }
        if (version < 10) {
          const now = Date.now();
          const rawBonuses = (state.persistentBonuses as PersistentBonus[] | undefined) ?? [];
          const persistentBonuses = clampPersistentBonuses(rawBonuses, now);
          return { ...state, audio: mergedAudio, persistentBonuses };
        }
        if (version < 11) {
          return normalizeSkinState({ ...state, audio: mergedAudio });
        }
        if (version < 12) {
          const owned = (state.owned as Owned | undefined) ?? initialOwned;
          const equipped = (state.equipped as Equipped | undefined) ?? initialEquipped;
          return normalizeCosmeticState({
            ...state,
            audio: mergedAudio,
            owned: { ...owned, shapes: owned.shapes ?? [STARTER_SHAPE_ID] },
            equipped: { ...equipped, shapeId: equipped.shapeId ?? STARTER_SHAPE_ID },
          });
        }
        if (version < 13) {
          return {
            ...state,
            audio: mergedAudio,
            cameraPanX: CAMERA_PAN_X_DEFAULT,
            cameraPanY: CAMERA_PAN_Y_DEFAULT,
            worldVersion: ((state.worldVersion as number | undefined) ?? 0) + 1,
          };
        }
        if (version < 14) {
          return {
            ...state,
            audio: mergedAudio,
            cameraPanX: CAMERA_PAN_X_DEFAULT,
            cameraPanY: CAMERA_PAN_Y_DEFAULT,
            worldVersion: ((state.worldVersion as number | undefined) ?? 0) + 1,
          };
        }
        if (version < 15) {
          return {
            ...state,
            audio: mergedAudio,
            cameraPanX: CAMERA_PAN_X_DEFAULT,
            cameraPanY: CAMERA_PAN_Y_DEFAULT,
            worldVersion: ((state.worldVersion as number | undefined) ?? 0) + 1,
          };
        }
        if (version < 16) {
          return {
            ...state,
            audio: mergedAudio,
            cameraZoom: CAMERA_ZOOM_DEFAULT,
            cameraPanX: CAMERA_PAN_X_DEFAULT,
            cameraPanY: CAMERA_PAN_Y_DEFAULT,
          };
        }
        if (version < 17) {
          // Site roster culled to Workshop + Bumper Cage. normalizeCosmeticState
          // drops any retired sites the save still owns and resets the equipped
          // site if it pointed at one.
          return normalizeCosmeticState({ ...state, audio: mergedAudio });
        }
        if (version < 18) {
          // Idle/background accrual fields added — they default safely via the
          // merge with current state, so this is a pass-through.
          return normalizeCosmeticState({ ...state, audio: mergedAudio });
        }
        if (version < 19) {
          // UI `language` field added — defaults safely via the merge with the
          // current state, so this is a pass-through.
          return normalizeCosmeticState({ ...state, audio: mergedAudio });
        }
        return normalizeCosmeticState({ ...state, audio: mergedAudio });
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<GameState>;
        const current = currentState as GameState;
        const owned = { ...current.owned, ...persisted.owned };
        const equipped = { ...current.equipped, ...persisted.equipped };
        return normalizeCosmeticState({
          ...current,
          ...persisted,
          owned,
          equipped,
        }) as unknown as GameState;
      },
      partialize: (state) => ({
        momentum: state.momentum,
        stats: state.stats,
        owned: state.owned,
        equipped: state.equipped,
        totalRuns: state.totalRuns,
        bestRunMomentum: state.bestRunMomentum,
        goldenTokenBonusMs: state.goldenTokenBonusMs,
        totalGoldenTokens: state.totalGoldenTokens,
        pendingGoldenTokens: state.pendingGoldenTokens,
        // Surviving cross-run bonuses persist with the rest of the save so
        // a stack the player has built up isn't lost on reload.
        persistentBonuses: state.persistentBonuses,
        audio: state.audio,
        cameraZoom: state.cameraZoom,
        autoRun: state.autoRun,
        autoToken: state.autoToken,
        language: state.language,
        tutorialSeen: state.tutorialSeen,
        // Idle accrual: keep the earn rate and the offline clock across reloads
        // so progress can be granted for time the page was fully closed.
        idleRatePerSec: state.idleRatePerSec,
        lastActiveAt: state.lastActiveAt,
      }),
    }
  )
);

export const COMBO_DECAY_WINDOW_MS = COMBO_DECAY_MS;
