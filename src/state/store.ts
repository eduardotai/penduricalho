import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActiveModifier, ItemKind, Stats } from "../types";
import {
  STARTER_PENDULUM_ID,
  PENDULUM_MAP,
} from "../data/pendulums";
import {
  STARTER_ATTACHMENT_ID,
  ATTACHMENT_MAP,
} from "../data/attachments";
import { STARTER_SITE_ID, SITE_MAP } from "../data/sites";
import { MODIFIER_MAP } from "../data/modifiers";

interface Owned {
  pendulums: string[];
  attachments: string[];
  sites: string[];
}

interface Equipped {
  pendulumId: string;
  attachmentId: string;
  siteId: string;
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
  combo: ComboState;
  worldVersion: number;

  addMomentum: (n: number) => void;
  registerHit: (points: number, now: number) => void;
  registerSwing: () => void;
  spend: (n: number) => boolean;
  buy: (kind: ItemKind, id: string) => boolean;
  equip: (kind: ItemKind, id: string) => void;
  pushModifier: (defId: string, now: number) => void;
  expireModifiers: (now: number) => void;
  decayCombo: (now: number, decayMs: number) => void;
  reset: () => void;
}

const COMBO_DECAY_MS = 1800;

const initialOwned: Owned = {
  pendulums: [STARTER_PENDULUM_ID],
  attachments: [STARTER_ATTACHMENT_ID],
  sites: [STARTER_SITE_ID],
};

const initialEquipped: Equipped = {
  pendulumId: STARTER_PENDULUM_ID,
  attachmentId: STARTER_ATTACHMENT_ID,
  siteId: STARTER_SITE_ID,
};

const initialStats: Stats = {
  totalMomentum: 0,
  totalSwings: 0,
  totalHits: 0,
  bestCombo: 0,
};

function getCost(kind: ItemKind, id: string): number | null {
  if (kind === "pendulum") return PENDULUM_MAP.get(id)?.cost ?? null;
  if (kind === "attachment") return ATTACHMENT_MAP.get(id)?.cost ?? null;
  if (kind === "site") return SITE_MAP.get(id)?.cost ?? null;
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
      combo: { count: 0, lastHitAt: 0 },
      worldVersion: 0,

      addMomentum: (n) =>
        set((s) => ({
          momentum: s.momentum + n,
          stats: { ...s.stats, totalMomentum: s.stats.totalMomentum + n },
        })),

      registerHit: (points, now) =>
        set((s) => {
          const stillInCombo = now - s.combo.lastHitAt < COMBO_DECAY_MS;
          const newCount = stillInCombo ? s.combo.count + 1 : 1;
          const bestCombo = Math.max(s.stats.bestCombo, newCount);
          return {
            momentum: s.momentum + points,
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
              : s.owned.sites;
        if (ownedList.includes(id)) return false;
        if (s.momentum < cost) return false;
        set((prev) => {
          const owned = { ...prev.owned };
          if (kind === "pendulum") owned.pendulums = [...prev.owned.pendulums, id];
          if (kind === "attachment") owned.attachments = [...prev.owned.attachments, id];
          if (kind === "site") owned.sites = [...prev.owned.sites, id];
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
                : s.owned.sites;
          if (!ownedList.includes(id)) return s;
          const equipped: Equipped = { ...s.equipped };
          if (kind === "pendulum") equipped.pendulumId = id;
          if (kind === "attachment") equipped.attachmentId = id;
          if (kind === "site") equipped.siteId = id;
          return { equipped, worldVersion: s.worldVersion + 1 };
        });
      },

      pushModifier: (defId, now) => {
        const def = MODIFIER_MAP.get(defId);
        if (!def) return;
        set((s) => {
          const others = s.activeModifiers.filter((m) => m.defId !== defId);
          return {
            activeModifiers: [
              ...others,
              { defId, expiresAt: now + def.durationMs },
            ],
          };
        });
      },

      expireModifiers: (now) =>
        set((s) => {
          const remaining = s.activeModifiers.filter((m) => m.expiresAt > now);
          if (remaining.length === s.activeModifiers.length) return s;
          return { activeModifiers: remaining };
        }),

      decayCombo: (now, decayMs) =>
        set((s) => {
          if (s.combo.count === 0) return s;
          if (now - s.combo.lastHitAt < decayMs) return s;
          return { combo: { count: 0, lastHitAt: s.combo.lastHitAt } };
        }),

      reset: () =>
        set({
          momentum: 0,
          stats: initialStats,
          owned: initialOwned,
          equipped: initialEquipped,
          activeModifiers: [],
          combo: { count: 0, lastHitAt: 0 },
          worldVersion: 0,
        }),
    }),
    {
      name: "pendulum-clicker-save",
      version: 1,
      partialize: (state) => ({
        momentum: state.momentum,
        stats: state.stats,
        owned: state.owned,
        equipped: state.equipped,
      }),
    }
  )
);

export const COMBO_DECAY_WINDOW_MS = COMBO_DECAY_MS;
