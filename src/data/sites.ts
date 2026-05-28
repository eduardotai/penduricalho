import type { SiteDef } from "../types";

export const SITES: SiteDef[] = [
  {
    id: "workshop",
    name: "Workshop",
    description: "A cozy workshop. Sparse multipliers — momentum comes slow.",
    gravity: 1,
    hitZoneCount: 90,
    hitZoneRadius: [18, 30],
    background: "workshop",
    cost: 0,
  },
  {
    id: "foundry",
    name: "Foundry",
    description: "Heavy iron forge. Higher gravity, hotter targets.",
    gravity: 1.3,
    hitZoneCount: 150,
    hitZoneRadius: [18, 30],
    background: "foundry",
    cost: 3500,
    unlock: { stat: "totalMomentum", gte: 4000 },
  },
  {
    id: "belfry",
    name: "Belfry",
    description: "A tall belltower. More room to swing big.",
    gravity: 0.9,
    hitZoneCount: 210,
    hitZoneRadius: [18, 32],
    background: "belfry",
    cost: 12000,
    unlock: { stat: "totalSwings", gte: 200 },
  },
  {
    id: "outdoor-field",
    name: "Outdoor Field",
    description: "Open field with wind that pushes your bob around.",
    gravity: 1,
    ambient: { x: 0.0006, y: 0 },
    hitZoneCount: 300,
    hitZoneRadius: [18, 32],
    background: "outdoor",
    cost: 40000,
    unlock: { stat: "totalHits", gte: 400 },
  },
  {
    id: "zero-g-lab",
    name: "Zero-G Lab",
    description: "Microgravity lab. Densest multiplier field in the game.",
    gravity: 0.25,
    hitZoneCount: 400,
    hitZoneRadius: [18, 32],
    background: "zero-g",
    cost: 150000,
    unlock: { stat: "bestCombo", gte: 40 },
  },
];

export const SITE_MAP = new Map(SITES.map((s) => [s.id, s]));

export const STARTER_SITE_ID = "workshop";
