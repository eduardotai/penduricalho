import type { ClickUpgradeDef } from "../types";

export const CLICK_UPGRADES: readonly ClickUpgradeDef[] = [
  {
    id: "reinforced-finger",
    name: "Reinforced Finger",
    description: "+1 Momentum per pump click.",
    icon: "👆",
    baseCost: 50,
    costMult: 2,
    effect: { kind: "addBaseClick", amount: 1 },
  },
  {
    id: "grip-tape",
    name: "Grip Tape",
    description: "×1.5 click power.",
    icon: "🩹",
    baseCost: 500,
    costMult: 2,
    effect: { kind: "multClick", factor: 1.5 },
    unlock: { stat: "totalClicks", gte: 25 },
  },
  {
    id: "double-tap",
    name: "Double Tap",
    description: "×2 click power.",
    icon: "✌️",
    baseCost: 5_000,
    costMult: 2,
    effect: { kind: "multClick", factor: 2 },
    unlock: { stat: "totalClicks", gte: 200 },
  },
  {
    id: "arc-resonance",
    name: "Arc Resonance",
    description: "Clicks hum louder; workshop feels it.",
    icon: "〰️",
    baseCost: 50_000,
    costMult: 2,
    effect: { kind: "multAllWorkshop", factor: 1.25 },
    unlock: { stat: "totalMomentum", gte: 10_000 },
  },
  {
    id: "momentum-condenser",
    name: "Momentum Condenser",
    description: "×1.25 all workshop income.",
    icon: "🔋",
    baseCost: 500_000,
    costMult: 2,
    effect: { kind: "multAllWorkshop", factor: 1.25 },
    unlock: { stat: "totalMomentum", gte: 100_000 },
  },
] as const;

export const CLICK_UPGRADE_MAP = new Map(CLICK_UPGRADES.map((u) => [u.id, u]));

export const CLICK_UPGRADE_EFFECTS: Record<string, ClickUpgradeDef["effect"]> =
  Object.fromEntries(CLICK_UPGRADES.map((u) => [u.id, u.effect]));