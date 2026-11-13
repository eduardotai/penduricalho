import type { SiteDef } from "../types";
import { HIT_ZONE_SCALE } from "../game/worldConstants";

/** Multiplier-circle radius range: 18–30 design px, scaled to the 3× world. */
const ZONE_RADIUS: [number, number] = [18 * HIT_ZONE_SCALE, 30 * HIT_ZONE_SCALE];

export const SITES: SiteDef[] = [
  {
    id: "workshop",
    name: "Workshop",
    description:
      "Open workbench — nothing cages the bobs. When the rope snaps they fly clear off the bench; once they're gone, just run again.",
    gravity: 1,
    hitZoneCount: 90,
    hitZoneRadius: ZONE_RADIUS,
    background: "workshop",
    walls: "none",
    cost: 0,
  },
  {
    id: "bumper-cage",
    name: "Bumper Cage",
    description:
      "A small arena walled with coiled springs. A rope snap sends the bobs ricocheting — every wall slam springs them back harder than a plain wall and back toward the middle, and a worn-out spring still shatters with an extra kick.",
    gravity: 1,
    hitZoneCount: 150,
    hitZoneRadius: ZONE_RADIUS,
    background: "bumper-cage",
    // Plain walls rebound at 1.22×. Tuned with the income sim's wall model
    // (tests/support/incomeSim.ts, simWallBoost) — see the PR table.
    mechanic: { kind: "springWalls", boost: 1.3, aim: 0.3 },
    walls: "breakable",
    cageScale: 1,
    wallDurabilityMult: 0.6,
    cost: 3_500,
    unlock: { stat: "totalMomentum", gte: 3000 },
  },
  {
    id: "bumper-arena",
    name: "Bumper Arena",
    description:
      "A medium walled arena swept by wind. Every few seconds a gust builds from a new direction and shoves the bob, the rope and any freed pieces — ride it to stretch the swing, or fight it. The gauge at the top shows the next gust.",
    gravity: 1,
    hitZoneCount: 150,
    hitZoneRadius: ZONE_RADIUS,
    background: "bumper-arena",
    walls: "breakable",
    cageScale: 1.45,
    wallDurabilityMult: 0.5,
    // Tuned with the income sim (scripts/sim-income.mjs): within about ±10% of
    // a windless field — launches run a bit longer, hand swings fight it a bit.
    mechanic: { kind: "gusts", calmMs: 3000, rampMs: 600, holdMs: 2200, accel: 14, maxTilt: 0.35 },
    cost: 12_000,
    unlock: { stat: "totalMomentum", gte: 9000 },
  },
  {
    id: "bumper-colosseum",
    name: "Bumper Colosseum",
    description:
      "A large walled arena with three bumpers orbiting just past the rope's reach. A freed bob (or one swung hard enough to stretch the rope into the orbit) that hits a bumper gets batted back with a kick, pinball style, and keeps scoring.",
    gravity: 1,
    hitZoneCount: 150,
    hitZoneRadius: ZONE_RADIUS,
    background: "bumper-colosseum",
    // Outside the swing circle, so strung play on a stiff rope is unchanged
    // (income sim: 0% on titan cable); stretchy ropes can reach them on hard
    // launches, and freed bobs get batted back in after a snap.
    mechanic: {
      kind: "bumpers",
      count: 3,
      orbitGap: 260,
      radius: 70,
      periodMs: -7000,
      boost: 1.15,
      maxSpeed: 165,
      cooldownMs: 250,
      minHitSpeed: 6,
    },
    walls: "breakable",
    cageScale: 1.9,
    wallDurabilityMult: 0.4,
    cost: 40_000,
    unlock: { stat: "totalMomentum", gte: 24000 },
  },
  {
    id: "layers",
    name: "The Layers",
    description:
      "An open field ringed by concentric circular walls centered on the mount. Multiplier circles spawn between the rings and deep inside the core — thread the bob through the rotating gaps to reach the richest layers, then watch the snap finale ricochet through every ring on the way out.",
    gravity: 1,
    hitZoneCount: 170,
    hitZoneRadius: ZONE_RADIUS,
    background: "layers",
    walls: "breakable",
    wallShape: "rings",
    ringCount: 5,
    wallDurabilityMult: 0.55,
    cost: 24_000,
    unlock: { stat: "totalMomentum", gte: 16000 },
  },
  {
    id: "black-hole",
    name: "Black Hole",
    description:
      "A singularity lurks somewhere off-center, dragging every bob toward its core with a relentless pull. Breakable walls keep the bobs ricocheting until they shatter — feed the bob into the event horizon and you can launch again from the brink.",
    gravity: 1,
    hitZoneCount: 150,
    hitZoneRadius: ZONE_RADIUS,
    background: "black-hole",
    walls: "breakable",
    cageScale: 1.45,
    wallDurabilityMult: 0.5,
    blackHole: true,
    cost: 80_000,
    unlock: { stat: "totalMomentum", gte: 32000 },
  },
  {
    id: "moon-base",
    name: "Moon Base",
    description:
      "A walled crater under a restless moon. Gravity rises and falls in slow tides — at low tide the bob floats into huge lazy loops, at high tide it whips back down. The gauge at the top shows the current pull.",
    gravity: 1,
    hitZoneCount: 150,
    hitZoneRadius: ZONE_RADIUS,
    background: "moon-base",
    walls: "breakable",
    cageScale: 1.45,
    wallDurabilityMult: 0.5,
    mechanic: { kind: "tides", periodMs: 9000, minGravity: 0.4, maxGravity: 1 },
    cost: 150_000,
    unlock: { stat: "totalMomentum", gte: 100_000 },
  },
  {
    id: "conveyor-yard",
    name: "Conveyor Yard",
    description:
      "A factory floor where every orb rides a conveyor. The whole field slides sideways under the swing and wraps around the edges, flipping direction every few seconds, so fresh orbs keep crossing the bob's path.",
    gravity: 1,
    hitZoneCount: 150,
    hitZoneRadius: ZONE_RADIUS,
    background: "conveyor-yard",
    walls: "breakable",
    cageScale: 1.45,
    wallDurabilityMult: 0.5,
    mechanic: { kind: "conveyor", speed: 70, flipMs: 6000, easeMs: 700 },
    cost: 500_000,
    unlock: { stat: "totalMomentum", gte: 350_000 },
  },
  {
    id: "magnet-storm",
    name: "Magnet Storm",
    description:
      "A charged arena where the air itself is magnetic. Every few seconds a pulse rolls through and drags nearby orbs and drops toward the bob — time your loops so the pulse feeds you a crowd. The gauge counts down to the next pulse.",
    gravity: 1,
    hitZoneCount: 140,
    hitZoneRadius: ZONE_RADIUS,
    background: "magnet-storm",
    walls: "breakable",
    cageScale: 1.45,
    wallDurabilityMult: 0.5,
    mechanic: { kind: "magnetPulses", calmMs: 3500, pulseMs: 1600, pullStrength: 1.6, radius: 900 },
    cost: 1_500_000,
    unlock: { stat: "totalMomentum", gte: 1_000_000 },
  },
];

export const SITE_MAP = new Map(SITES.map((s) => [s.id, s]));

export const STARTER_SITE_ID = "workshop";
