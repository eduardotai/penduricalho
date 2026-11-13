import type { AchievementDef, AchievementCategory, ItemKind } from "../types";
import { PENDULUM_MAP } from "./pendulums";
import { ATTACHMENT_MAP } from "./attachments";
import { SKIN_MAP } from "./bobSkins";
import { SHAPE_MAP } from "./bobShapes";
import { ownedComboCount } from "./combos";
import type { Stats, Owned } from "../types"; // reuse existing for the view

export type AchievementProgress = {
  unlocked: boolean;
  progress: number;
  target: number;
  percent: number; // 0..1
};

export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = [
  "momentum",
  "combo",
  "gold",
  "runs",
  "collection",
  "feats",
  "workshop",
  "secret",
] as const;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // === MOMENTUM (7) ===
  {
    id: "first-arc",
    category: "momentum",
    icon: "🪀",
    requirement: { type: "stat", stat: "totalMomentum", gte: 100 },
  },
  {
    id: "gaining-momentum",
    category: "momentum",
    icon: "📈",
    requirement: { type: "stat", stat: "totalMomentum", gte: 1_000 },
  },
  {
    id: "arc-welder",
    category: "momentum",
    icon: "🔥",
    requirement: { type: "stat", stat: "totalMomentum", gte: 10_000 },
  },
  {
    id: "perpetual-swing",
    category: "momentum",
    icon: "♾️",
    requirement: { type: "stat", stat: "totalMomentum", gte: 50_000 },
  },
  {
    id: "gravity-tyrant",
    category: "momentum",
    icon: "🌀",
    requirement: { type: "stat", stat: "totalMomentum", gte: 250_000 },
  },
  {
    id: "event-horizon-momentum",
    category: "momentum",
    icon: "🌌",
    requirement: { type: "stat", stat: "totalMomentum", gte: 1_000_000 },
  },
  {
    id: "big-bang-bob",
    category: "momentum",
    icon: "💥",
    requirement: { type: "stat", stat: "totalMomentum", gte: 5_000_000 },
  },

  // === COMBO (5) ===
  {
    id: "hot-streak",
    category: "combo",
    icon: "🔥",
    requirement: { type: "stat", stat: "bestCombo", gte: 5 },
  },
  {
    id: "combo-king",
    category: "combo",
    icon: "👑",
    requirement: { type: "stat", stat: "bestCombo", gte: 10 },
  },
  {
    id: "unbreakable-rhythm",
    category: "combo",
    icon: "🎵",
    requirement: { type: "stat", stat: "bestCombo", gte: 25 },
  },
  {
    id: "hyperswing",
    category: "combo",
    icon: "⚡",
    requirement: { type: "stat", stat: "bestCombo", gte: 50 },
  },
  {
    id: "zen-pendulum",
    category: "combo",
    icon: "🧘",
    hidden: true,
    requirement: { type: "stat", stat: "bestCombo", gte: 100 },
  },

  // === GOLD (4) ===
  {
    id: "first-gleam",
    category: "gold",
    icon: "✨",
    requirement: { type: "topLevel", key: "totalGoldenTokens", gte: 1 },
  },
  {
    id: "token-hoarder",
    category: "gold",
    icon: "💰",
    requirement: { type: "topLevel", key: "totalGoldenTokens", gte: 5 },
  },
  {
    id: "golden-age",
    category: "gold",
    icon: "🏆",
    requirement: { type: "topLevel", key: "totalGoldenTokens", gte: 15 },
  },
  {
    id: "lucky-lode",
    category: "gold",
    icon: "🌟",
    requirement: { type: "topLevel", key: "totalGoldenTokens", gte: 30 },
  },

  // === RUNS (3) ===
  {
    id: "maiden-flight",
    category: "runs",
    icon: "🛫",
    requirement: { type: "topLevel", key: "totalRuns", gte: 1 },
  },
  {
    id: "veteran-swinger",
    category: "runs",
    icon: "🧓",
    requirement: { type: "topLevel", key: "totalRuns", gte: 10 },
  },
  {
    id: "endless-arc",
    category: "runs",
    icon: "🔄",
    requirement: { type: "topLevel", key: "totalRuns", gte: 50 },
  },

  // === COLLECTION (4) ===
  {
    id: "kit-builder",
    category: "collection",
    icon: "🧰",
    requirement: { type: "ownedCount", kind: "pendulum", min: 3 },
  },
  {
    id: "full-workshop",
    category: "collection",
    icon: "🏭",
    requirement: { type: "ownedCount", kind: "pendulum", min: 8 },
  },
  {
    id: "neutron-star",
    category: "collection",
    icon: "💫",
    requirement: { type: "owns", kind: "pendulum", id: "pulsar-bob" },
  },
  {
    id: "event-horizon-bob",
    category: "collection",
    icon: "🕳️",
    requirement: { type: "owns", kind: "pendulum", id: "singularity-bob" },
  },
  {
    id: "perfect-match",
    category: "collection",
    icon: "🔗",
    requirement: { type: "ownedCombos", min: 1 },
  },
  {
    id: "set-collector",
    category: "collection",
    icon: "🧩",
    requirement: { type: "ownedCombos", min: 5 },
  },
  {
    id: "legendary-finder",
    category: "collection",
    icon: "💎",
    requirement: { type: "custom", id: "hasLegendary" },
  },
  {
    id: "behavior-pioneer",
    category: "collection",
    icon: "🧪",
    requirement: { type: "custom", id: "hasAnyBehaviorBob" },
  },

  // === FEATS (4) ===
  {
    id: "token-spender",
    category: "feats",
    icon: "🎟️",
    requirement: { type: "counter", counter: "totalGoldenSpent", gte: 1 },
  },
  {
    id: "black-hole-diver",
    category: "feats",
    icon: "🕳️",
    requirement: { type: "counter", counter: "blackHoleCaptures", gte: 1 },
  },
  {
    id: "first-snap",
    category: "feats",
    icon: "💥",
    requirement: { type: "topLevel", key: "bestRunMomentum", gte: 500 },
  },
  {
    id: "arc-reactor",
    category: "feats",
    icon: "⚛️",
    requirement: { type: "custom", id: "hasAnyBehaviorAttachment" },
  },

  // === WORKSHOP (4) ===
  {
    id: "first-pump",
    category: "workshop",
    icon: "👆",
    requirement: { type: "stat", stat: "totalClicks", gte: 100 },
  },
  {
    id: "factory-floor",
    category: "workshop",
    icon: "🏭",
    requirement: { type: "stat", stat: "totalGenerators", gte: 25 },
  },
  {
    id: "passive-tycoon",
    category: "workshop",
    icon: "📊",
    requirement: { type: "workshopCps", gte: 100 },
  },
  {
    id: "surge-rider",
    category: "workshop",
    icon: "⚡",
    requirement: { type: "counter", counter: "totalArcSurges", gte: 5 },
  },

  // === SECRET (2) ===
  {
    id: "zen-master",
    category: "secret",
    icon: "🪷",
    hidden: true,
    requirement: { type: "stat", stat: "bestCombo", gte: 150 },
  },
  {
    id: "momentum-singularity",
    category: "secret",
    icon: "🌀",
    hidden: true,
    requirement: { type: "stat", stat: "totalMomentum", gte: 25_000_000 },
  },
];

export const ACHIEVEMENT_MAP = new Map<string, AchievementDef>(
  ACHIEVEMENTS.map((a) => [a.id, a] as const)
);

/**
 * Pure evaluator. Takes a snapshot of the relevant state pieces (avoids pulling
 * the entire Zustand store into pure data land).
 */
export function evaluateAchievement(
  def: AchievementDef,
  snapshot: {
    stats: Stats;
    owned: Owned;
    totalGoldenSpent: number;
    blackHoleCaptures: number;
    unlocked: Record<string, number>; // for the unlocked flag
  }
): AchievementProgress {
  const alreadyUnlocked = !!snapshot.unlocked[def.id];
  const req = def.requirement;

  let progress = 0;
  let target = 1;

  switch (req.type) {
    case "stat": {
      const val = snapshot.stats[req.stat] ?? 0;
      progress = Math.max(0, Math.min(val, req.gte));
      target = req.gte;
      break;
    }
    case "topLevel": {
      let val = 0;
      if (req.key === "totalRuns") val = (snapshot as any).totalRuns ?? 0; // passed via extra if needed, but we add below
      // We augment the snapshot shape at call site for topLevel convenience.
      // For cleanliness the caller will put bestRunMomentum / totalGoldenTokens / totalRuns on the snapshot.
      const anySnap = snapshot as any;
      if (req.key === "totalRuns") val = anySnap.totalRuns ?? 0;
      else if (req.key === "bestRunMomentum") val = anySnap.bestRunMomentum ?? 0;
      else if (req.key === "totalGoldenTokens") val = anySnap.totalGoldenTokens ?? 0;
      progress = Math.max(0, Math.min(val, req.gte));
      target = req.gte;
      break;
    }
    case "ownedCount": {
      let list: string[] = [];
      if (req.kind === "pendulum") list = snapshot.owned.pendulums;
      else if (req.kind === "attachment") list = snapshot.owned.attachments;
      else if (req.kind === "site") list = snapshot.owned.sites;
      else if (req.kind === "skin") list = snapshot.owned.skins ?? [];
      else if (req.kind === "shape") list = snapshot.owned.shapes ?? [];
      else {
        // total across all
        list = [
          ...snapshot.owned.pendulums,
          ...snapshot.owned.attachments,
          ...snapshot.owned.sites,
          ...(snapshot.owned.skins ?? []),
          ...(snapshot.owned.shapes ?? []),
        ];
      }
      progress = Math.min(list.length, req.min);
      target = req.min;
      break;
    }
    case "workshopCps": {
      const val = (snapshot as { cachedTotalCps?: number }).cachedTotalCps ?? 0;
      progress = Math.max(0, Math.min(val, req.gte));
      target = req.gte;
      break;
    }
    case "counter": {
      const anySnap = snapshot as {
        totalGoldenSpent: number;
        blackHoleCaptures: number;
        totalArcSurges?: number;
      };
      const val =
        req.counter === "totalGoldenSpent"
          ? anySnap.totalGoldenSpent
          : req.counter === "totalArcSurges"
            ? anySnap.totalArcSurges ?? 0
            : anySnap.blackHoleCaptures;
      progress = Math.max(0, Math.min(val, req.gte));
      target = req.gte;
      break;
    }
    case "ownedCombos": {
      progress = Math.min(ownedComboCount(snapshot.owned), req.min);
      target = req.min;
      break;
    }
    case "owns": {
      progress = isOwned(snapshot.owned, req.id, req.kind) ? 1 : 0;
      target = 1;
      break;
    }
    case "custom": {
      if (req.id === "hasLegendary") {
        // Check each catalogue against its own owned list (the old version
        // mapped every priced item to "pendulum", so legendary ropes never counted).
        const legendaryIn = (defs: Iterable<{ id: string; rarity?: string }>, kind: ItemKind) =>
          [...defs].some((d) => d.rarity === "legendary" && isOwned(snapshot.owned, d.id, kind));
        const hasLeg =
          legendaryIn(PENDULUM_MAP.values(), "pendulum") ||
          legendaryIn(ATTACHMENT_MAP.values(), "attachment") ||
          legendaryIn(SKIN_MAP.values(), "skin") ||
          legendaryIn(SHAPE_MAP.values(), "shape");
        progress = hasLeg ? 1 : 0;
        target = 1;
      } else if (req.id === "hasAnyBehaviorBob") {
        const has = [...PENDULUM_MAP.values()].some((p) => p.behavior && snapshot.owned.pendulums.includes(p.id));
        progress = has ? 1 : 0;
        target = 1;
      } else if (req.id === "hasAnyBehaviorAttachment") {
        const has = [...ATTACHMENT_MAP.values()].some((a) => a.behavior && snapshot.owned.attachments.includes(a.id));
        progress = has ? 1 : 0;
        target = 1;
      } else {
        progress = 0; target = 1;
      }
      break;
    }
  }

  // An achievement is unlocked once its requirement is met (or it was unlocked
  // earlier — unlocks are permanent even if a stat later drops). Previously this
  // only echoed the saved map, so checkAchievements() never unlocked anything:
  // the panel showed 100% while the count and the Momentum bonus stayed at 0.
  const unlocked = alreadyUnlocked || (target > 0 && progress >= target);
  const percent = target > 0 ? Math.min(1, progress / target) : (unlocked ? 1 : 0);
  return { unlocked, progress: Math.floor(progress), target, percent };
}

function isOwned(owned: Owned, id: string, kind: ItemKind): boolean {
  if (kind === "pendulum") return owned.pendulums.includes(id);
  if (kind === "attachment") return owned.attachments.includes(id);
  if (kind === "site") return owned.sites.includes(id);
  if (kind === "skin") return (owned.skins ?? []).includes(id);
  if (kind === "shape") return (owned.shapes ?? []).includes(id);
  return false;
}

/** Convenience: evaluate every achievement against a full-ish snapshot. */
export function getAllAchievementProgress(snapshot: {
  stats: Stats;
  owned: Owned;
  totalGoldenSpent: number;
  blackHoleCaptures: number;
  totalRuns: number;
  bestRunMomentum: number;
  totalGoldenTokens: number;
  cachedTotalCps?: number;
  totalArcSurges?: number;
  unlocked: Record<string, number>;
}): Record<string, AchievementProgress> {
  const out: Record<string, AchievementProgress> = {};
  for (const def of ACHIEVEMENTS) {
    out[def.id] = evaluateAchievement(def, {
      stats: snapshot.stats,
      owned: snapshot.owned,
      totalGoldenSpent: snapshot.totalGoldenSpent,
      blackHoleCaptures: snapshot.blackHoleCaptures,
      // @ts-expect-error - augment for topLevel convenience
      totalRuns: snapshot.totalRuns,
      bestRunMomentum: snapshot.bestRunMomentum,
      totalGoldenTokens: snapshot.totalGoldenTokens,
      cachedTotalCps: snapshot.cachedTotalCps,
      totalArcSurges: snapshot.totalArcSurges,
      unlocked: snapshot.unlocked,
    });
  }
  return out;
}

/** Current global momentum multiplier from achievements (small permanent bonus). */
export function getAchievementMomentumMult(count: number): number {
  // ~0.25% per achievement, hard cap at 12% for the starter roster (~48 theoretical max before more content).
  const per = 0.0025;
  const max = 0.12;
  return 1 + Math.min(count * per, max);
}
