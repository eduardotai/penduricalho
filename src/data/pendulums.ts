import type { PendulumDef } from "../types";
import { WORLD_SCALE } from "../game/worldConstants";

const S = (spacing: number) => Math.round(spacing * WORLD_SCALE);
/** Bob collision/render radius in virtual world units (design px × world scale). */
const R = (radius: number) => Math.round(radius * WORLD_SCALE);

export const PENDULUMS: PendulumDef[] = [
  {
    id: "wooden-bob",
    name: "Wooden Bob",
    description: "A simple carved bob. Light, forgiving, and small — only the closest multipliers are within reach.",
    weight: 1.2,
    bobCount: 1,
    bobSpacing: 0,
    bobRadius: R(12),
    maxAngularVelocity: 0.5,
    basePointMultiplier: 1.1,
    rarity: "common",
    cost: 0,
  },
  {
    id: "brass-bob",
    name: "Brass Bob",
    description: "Polished brass with a satisfying heft. A touch wider than wood — clips a few more zones per swing.",
    weight: 2.2,
    bobCount: 1,
    bobSpacing: 0,
    bobRadius: R(20),
    maxAngularVelocity: 0.55,
    basePointMultiplier: 1.4,
    rarity: "common",
    cost: 150,
  },
  {
    id: "iron-bob",
    name: "Iron Bob",
    description: "Heavy iron core, builds serious momentum. Noticeably larger than brass — sweeps through multipliers brass simply can't touch.",
    weight: 4,
    bobCount: 1,
    bobSpacing: 0,
    bobRadius: R(30),
    maxAngularVelocity: 0.45,
    basePointMultiplier: 2.0,
    rarity: "rare",
    cost: 850,
    unlock: { stat: "totalHits", gte: 75 },
  },
  {
    id: "twin-bob",
    name: "Twin Bob",
    description: "Two bobs chained vertically. Each is modest, but together they cover a long swept arc.",
    weight: 3,
    bobCount: 2,
    bobSpacing: S(60),
    bobRadius: R(18),
    maxAngularVelocity: 0.5,
    basePointMultiplier: 1.7,
    rarity: "rare",
    cost: 2400,
    unlock: { stat: "totalMomentum", gte: 3000 },
  },
  {
    id: "triple-bob",
    name: "Triple Bob",
    description: "Three bobs. Catastrophically effective coverage along the entire chain.",
    weight: 4.5,
    bobCount: 3,
    bobSpacing: S(55),
    bobRadius: R(15),
    maxAngularVelocity: 0.55,
    basePointMultiplier: 2.6,
    rarity: "epic",
    cost: 12000,
    unlock: { stat: "totalMomentum", gte: 18000 },
  },
  {
    id: "tungsten-heavy",
    name: "Tungsten Heavy",
    description: "Dense as a planet core. Crushes everything in a massive swept circle — almost no zone is safe.",
    weight: 9,
    bobCount: 1,
    bobSpacing: 0,
    bobRadius: R(42),
    maxAngularVelocity: 0.4,
    basePointMultiplier: 4.5,
    rarity: "legendary",
    cost: 60000,
    unlock: { stat: "bestCombo", gte: 25 },
  },
];

export const PENDULUM_MAP = new Map(PENDULUMS.map((p) => [p.id, p]));

export const STARTER_PENDULUM_ID = "wooden-bob";
