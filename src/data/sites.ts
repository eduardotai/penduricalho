import type { SiteDef } from "../types";

export const SITES: SiteDef[] = [
  {
    id: "workshop",
    name: "Workshop",
    description:
      "Open workbench — nothing cages the bobs. When the rope snaps they fly clear off the bench; once they're gone, just run again.",
    gravity: 1,
    hitZoneCount: 90,
    hitZoneRadius: [18, 30],
    background: "workshop",
    walls: "none",
    cost: 0,
  },
  {
    id: "bumper-cage",
    name: "Bumper Cage",
    description:
      "A small walled arena. A rope snap sends the bobs ricocheting — slam a wall hard enough and it shatters, kicking the bob with an extra impulse.",
    gravity: 1,
    hitZoneCount: 150,
    hitZoneRadius: [18, 30],
    background: "bumper-cage",
    walls: "breakable",
    cageScale: 1,
    wallDurabilityMult: 0.6,
    cost: 3000,
    unlock: { stat: "totalMomentum", gte: 3000 },
  },
  {
    id: "bumper-arena",
    name: "Bumper Arena",
    description:
      "A medium walled arena — same shatter-and-ricochet rules as the Bumper Cage, but with a roomier cage that lets freed bobs carom further before they break out.",
    gravity: 1,
    hitZoneCount: 150,
    hitZoneRadius: [18, 30],
    background: "bumper-arena",
    walls: "breakable",
    cageScale: 1.45,
    wallDurabilityMult: 0.5,
    cost: 9000,
    unlock: { stat: "totalMomentum", gte: 9000 },
  },
  {
    id: "bumper-colosseum",
    name: "Bumper Colosseum",
    description:
      "A large walled arena — the same breakable walls, now wrapped around a sprawling cage. Freed bobs ricochet for ages, racking up wall breaks before they finally escape.",
    gravity: 1,
    hitZoneCount: 150,
    hitZoneRadius: [18, 30],
    background: "bumper-colosseum",
    walls: "breakable",
    cageScale: 1.9,
    wallDurabilityMult: 0.4,
    cost: 24000,
    unlock: { stat: "totalMomentum", gte: 24000 },
  },
];

export const SITE_MAP = new Map(SITES.map((s) => [s.id, s]));

export const STARTER_SITE_ID = "workshop";
