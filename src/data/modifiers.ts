import type { ModifierDef } from "../types";

export const MODIFIERS: ModifierDef[] = [
  {
    id: "power-twist",
    name: "Power Twist",
    description: "+50% twist power for 10s.",
    color: "#f97316",
    durationMs: 10000,
    effects: { twistPowerMult: 1.5 },
  },
  {
    id: "heavy-air",
    name: "Heavy Air",
    description: "+25% acceleration for 8s.",
    color: "#38bdf8",
    durationMs: 8000,
    effects: { accelerationMult: 1.25 },
  },
  {
    id: "featherweight",
    name: "Featherweight",
    description: "-30% bob mass for 6s. Swings wider.",
    color: "#a78bfa",
    durationMs: 6000,
    effects: { weightMult: 0.7 },
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    description: "x2 points for 5s.",
    color: "#facc15",
    durationMs: 5000,
    effects: { pointMult: 2 },
  },
  {
    id: "overdrive",
    name: "Overdrive",
    description: "+75% twist power, +50% points for 4s.",
    color: "#ef4444",
    durationMs: 4000,
    effects: { twistPowerMult: 1.75, pointMult: 1.5 },
  },
];

export const MODIFIER_MAP = new Map(MODIFIERS.map((m) => [m.id, m]));

export function rollRandomModifier(): ModifierDef {
  return MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
}
