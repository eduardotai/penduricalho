import type { TokenDef, TokenKind } from "../types";

export const TOKENS: TokenDef[] = [
  { kind: "bigger-bob", name: "Bigger Bob", description: "Swells the bob for 7s.", color: "#34d399", weight: 18, grantsModifierId: "bigger-bob" },
  { kind: "giant-bob", name: "Giant Bob", description: "Massive bob for 6s.", color: "#059669", weight: 14, grantsModifierId: "giant-bob" },
  { kind: "tiny-bob", name: "Tiny Bob", description: "Shrinks the bob for 8s.", color: "#818cf8", weight: 16, grantsModifierId: "tiny-bob" },
  { kind: "velocity-surge", name: "Velocity Surge", description: "Slams the bob with extra speed for 5s.", color: "#22d3ee", weight: 18, grantsModifierId: "velocity-surge" },
  { kind: "speed-ramp", name: "Speed Ramp", description: "Speed builds to +40% over 8s.", color: "#2dd4bf", weight: 16, grantsModifierId: "speed-ramp" },
  { kind: "long-rope", name: "Long Rope", description: "Stretches the rope for 7s.", color: "#fb923c", weight: 16, grantsModifierId: "long-rope" },
  { kind: "short-rope", name: "Short Rope", description: "Shrinks the rope for 7s.", color: "#f472b6", weight: 16, grantsModifierId: "short-rope" },
  { kind: "multi-bob", name: "Multi-Bob", description: "Spawns echo bobs that also score for 6s.", color: "#c084fc", weight: 16, grantsModifierId: "multi-bob" },
  { kind: "golden", name: "Golden Token", description: "Re-launches the pendulum and x3 points.", color: "#fde047", weight: 50, grantsModifierId: "token-bonus", isGolden: true },
];

export const TOKEN_MAP = new Map<TokenKind, TokenDef>(TOKENS.map((t) => [t.kind, t]));
const TOTAL_WEIGHT = TOKENS.reduce((sum, t) => sum + t.weight, 0);

export function rollRandomToken(): TokenDef {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const t of TOKENS) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return TOKENS[TOKENS.length - 1];
}

export const GOLDEN_TOKEN_BASE_DURATION_MS = 6000;
export const TOKEN_LIFETIME_MS = 8000;
export const GOLDEN_TOKEN_LIFETIME_MS = 12000;

export function getTokenLifetime(kind: TokenKind): number {
  return kind === "golden" ? GOLDEN_TOKEN_LIFETIME_MS : TOKEN_LIFETIME_MS;
}
