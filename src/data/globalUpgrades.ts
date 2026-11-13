/**
 * Global income upgrades sold in the Shop's Boosts tab. One-time purchases
 * that multiply every scaling Momentum source (see game/prestige.ts
 * `globalIncomeMult`). Bought with Momentum, so a prestige resets them.
 * Pure data.
 */
export interface GlobalUpgradeDef {
  id: string;
  name: { en: string; pt: string };
  description: { en: string; pt: string };
  icon: string;
  cost: number;
  /** Multiplies global income; owned upgrades stack multiplicatively. */
  mult: number;
  /** Must own this upgrade first. */
  requires?: string;
}

export const GLOBAL_UPGRADES: GlobalUpgradeDef[] = [
  {
    id: "global-x2",
    name: { en: "Master Mainspring", pt: "Mola Mestra" },
    description: {
      en: "Doubles all Momentum income: hits, pumps and machines.",
      pt: "Dobra toda a renda de Momentum: acertos, bombeadas e máquinas.",
    },
    icon: "🌀",
    cost: 1_000_000,
    mult: 2,
  },
  {
    id: "global-x3",
    name: { en: "Tourbillon", pt: "Turbilhão" },
    description: {
      en: "Triples all Momentum income again (×6 with the Mainspring).",
      pt: "Triplica de novo toda a renda de Momentum (×6 com a Mola Mestra).",
    },
    icon: "⚙️",
    cost: 25_000_000,
    mult: 3,
    requires: "global-x2",
  },
];

export const GLOBAL_UPGRADE_MAP = new Map(GLOBAL_UPGRADES.map((u) => [u.id, u]));

/** Product of the owned upgrades' multipliers (unknown ids ignored). */
export function globalUpgradeMult(owned: readonly string[] | undefined): number {
  let m = 1;
  for (const id of new Set(owned ?? [])) m *= GLOBAL_UPGRADE_MAP.get(id)?.mult ?? 1;
  return m;
}
