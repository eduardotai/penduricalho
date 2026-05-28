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
  {
    id: "speed-ramp",
    name: "Speed Ramp",
    description: "Swing speed builds up to +40% over 8s (timed only).",
    color: "#2dd4bf",
    durationMs: 8000,
    effects: { velocityGrowthPerSec: 0.1 },
  },
  {
    id: "tiny-bob",
    name: "Tiny Bob",
    description: "-45% bob size for 8s. Darts through tight gaps.",
    color: "#818cf8",
    durationMs: 8000,
    effects: { bobSizeMult: 0.55 },
  },

  // ------- Token-granted physical modifiers -------
  {
    id: "bigger-bob",
    name: "Bigger Bob",
    description: "+80% bob size for 7s. Sweeps through more zones.",
    color: "#34d399",
    durationMs: 7000,
    effects: { bobSizeMult: 1.8 },
  },
  {
    id: "giant-bob",
    name: "Giant Bob",
    description: "+120% bob size for 6s. Huge arc coverage.",
    color: "#059669",
    durationMs: 6000,
    effects: { bobSizeMult: 2.2 },
  },
  {
    id: "velocity-surge",
    name: "Velocity Surge",
    description: "Big velocity kick + 25% twist power for 5s.",
    color: "#22d3ee",
    durationMs: 5000,
    effects: { twistPowerMult: 1.25 },
  },
  {
    id: "long-rope",
    name: "Long Rope",
    description: "+50% rope length for 7s. Wider, lower arc.",
    color: "#fb923c",
    durationMs: 7000,
    effects: { ropeLengthMult: 1.5 },
  },
  {
    id: "short-rope",
    name: "Short Rope",
    description: "-35% rope length for 7s. Faster, tighter swing.",
    color: "#f472b6",
    durationMs: 7000,
    effects: { ropeLengthMult: 0.65 },
  },
  {
    id: "multi-bob",
    name: "Multi-Bob",
    description: "+2 echo bobs land hits alongside you for 6s.",
    color: "#c084fc",
    durationMs: 6000,
    effects: { echoCount: 2 },
  },

  // The rare token's score multiplier component. Duration here is a fallback —
  // the actual lifetime is set when the token is collected, so the grindable
  // goldenTokenBonusMs can stretch it.
  {
    id: "token-bonus",
    name: "Token Bonus",
    description: "x3 points and re-launched pendulum.",
    color: "#fde047",
    durationMs: 6000,
    effects: { pointMult: 3, twistPowerMult: 1.5 },
  },
];

export const MODIFIER_MAP = new Map(MODIFIERS.map((m) => [m.id, m]));

// Modifiers eligible for the legacy "random buff from a zone" path. Token-
// granted physical modifiers are excluded — they only enter play via tokens.
const RANDOM_ROLLABLE_IDS = new Set([
  "power-twist",
  "heavy-air",
  "featherweight",
  "golden-hour",
  "overdrive",
  "speed-ramp",
  "bigger-bob",
  "tiny-bob",
]);
const ROLLABLE_MODIFIERS = MODIFIERS.filter((m) => RANDOM_ROLLABLE_IDS.has(m.id));

export function rollRandomModifier(): ModifierDef {
  return ROLLABLE_MODIFIERS[Math.floor(Math.random() * ROLLABLE_MODIFIERS.length)];
}