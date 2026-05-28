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
      "A walled arena. A rope snap sends the bobs ricocheting — slam a wall hard enough and it shatters, kicking the bob with an extra impulse.",
    gravity: 1,
    hitZoneCount: 150,
    hitZoneRadius: [18, 30],
    background: "bumper-cage",
    walls: "breakable",
    cost: 3000,
    unlock: { stat: "totalMomentum", gte: 3000 },
  },
];

export const SITE_MAP = new Map(SITES.map((s) => [s.id, s]));

export const STARTER_SITE_ID = "workshop";
