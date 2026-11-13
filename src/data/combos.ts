import type { RigComboDef } from "../types";

/**
 * Rig combos: a specific bob on a specific line. Bonuses are small, flat and
 * visible (Shop › Combos, item cards, the loadout line and a pop at launch).
 * Balance: see the combo table in tests/combos.test.ts / scripts/sim-combos.mjs.
 */
export const RIG_COMBOS: RigComboDef[] = [
  {
    id: "nunchaku",
    name: "Nunchaku",
    description: "Twin Bob on the Heavy Chain: +35% points.",
    icon: "🥢",
    pendulumId: "twin-bob",
    attachmentId: "heavy-chain",
    pointMult: 1.35,
  },
  {
    id: "javelin",
    name: "Javelin",
    description: "Piercer Bob on the Iron Rod: +40% points.",
    icon: "🎯",
    pendulumId: "piercer-bob",
    attachmentId: "iron-rod",
    pointMult: 1.4,
  },
  {
    id: "slingshot",
    name: "Slingshot",
    description: "Rocket Bob on the Spring Coil: +30% points and a 25% harder launch.",
    icon: "🚀",
    pendulumId: "rocket-bob",
    attachmentId: "spring-coil",
    pointMult: 1.3,
    kickMult: 1.25,
  },
  {
    id: "polarity",
    name: "Polarity",
    description: "Lodestone Bob on the Magnetic Tether: +15% points and 30% stronger pull.",
    icon: "🧲",
    pendulumId: "lodestone-bob",
    attachmentId: "magnetic-tether",
    pointMult: 1.15,
    pullMult: 1.3,
  },
  {
    id: "wrecking-ball",
    name: "Wrecking Ball",
    description: "Tungsten Heavy on the Anchor Chain: +25% points and 40% less rope wear.",
    icon: "⛓️",
    pendulumId: "tungsten-heavy",
    attachmentId: "anchor-chain",
    pointMult: 1.25,
    drainMult: 0.6,
  },
  {
    id: "shooting-star",
    name: "Shooting Star",
    description: "Comet Bob on the Silk Thread: +30% points and 50% less rope wear.",
    icon: "🌠",
    pendulumId: "comet-bob",
    attachmentId: "silk-thread",
    pointMult: 1.3,
    drainMult: 0.5,
  },
  {
    id: "overload",
    name: "Overload",
    description: "Frenzy Bob on the Plasma Tether: +25% points.",
    icon: "⚡",
    pendulumId: "frenzy-bob",
    attachmentId: "plasma-tether",
    pointMult: 1.25,
  },
  {
    id: "golden-scepter",
    name: "Golden Scepter",
    description: "Midas Bob on the Carbon Rod: +25% points.",
    icon: "👑",
    pendulumId: "midas-bob",
    attachmentId: "carbon-rod",
    pointMult: 1.25,
  },
];

export const RIG_COMBO_MAP = new Map(RIG_COMBOS.map((c) => [c.id, c]));

/** The combo formed by an equipped bob + line, or null. */
export function activeRigCombo(pendulumId: string, attachmentId: string): RigComboDef | null {
  return RIG_COMBOS.find((c) => c.pendulumId === pendulumId && c.attachmentId === attachmentId) ?? null;
}

/** Combos an item belongs to (as the bob or as the line). */
export function combosForItem(kind: "pendulum" | "attachment", id: string): RigComboDef[] {
  return RIG_COMBOS.filter((c) => (kind === "pendulum" ? c.pendulumId : c.attachmentId) === id);
}

/** How many combos the player owns both halves of. */
export function ownedComboCount(owned: { pendulums: string[]; attachments: string[] }): number {
  return RIG_COMBOS.filter((c) => owned.pendulums.includes(c.pendulumId) && owned.attachments.includes(c.attachmentId)).length;
}
