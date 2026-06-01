import type { TokenDef, TokenKind } from "../types";

export const TOKENS: TokenDef[] = [
  { kind: "bigger-bob", name: "Bigger Bob", description: "Swells the bob for 7s.", color: "#34d399", weight: 18, grantsModifierId: "bigger-bob" },
  { kind: "giant-bob", name: "Giant Bob", description: "Large bob for 6s.", color: "#059669", weight: 14, grantsModifierId: "giant-bob" },
  { kind: "tiny-bob", name: "Tiny Bob", description: "Shrinks the bob for 8s.", color: "#818cf8", weight: 16, grantsModifierId: "tiny-bob" },
  { kind: "velocity-surge", name: "Velocity Surge", description: "Slams the bob with extra speed for 5s.", color: "#22d3ee", weight: 18, grantsModifierId: "velocity-surge" },
  { kind: "speed-ramp", name: "Speed Ramp", description: "Speed builds to +40% over 8s.", color: "#2dd4bf", weight: 16, grantsModifierId: "speed-ramp" },
  { kind: "multi-bob", name: "Multi-Bob", description: "Spawns echo bobs that also score for 6s.", color: "#c084fc", weight: 16, grantsModifierId: "multi-bob" },
  { kind: "repair", name: "Rope Patch", description: "Restores rope durability, delaying the snap.", color: "#5eead4", weight: 18 },
  { kind: "golden", name: "Golden Token", description: "Re-launches the Bob and x3 points.", color: "#fde047", weight: 6, grantsModifierId: "token-bonus", isGolden: true },
];

export const TOKEN_MAP = new Map<TokenKind, TokenDef>(TOKENS.map((t) => [t.kind, t]));

// Tokens defined in the catalog but pulled from the random drop pool. Kept here
// (not deleted) so they stay wired up — type, render glyph, modifier — and can
// be dropped back into DROP_POOL later without re-adding anything.
const NON_DROPPABLE_KINDS: TokenKind[] = ["tiny-bob"];
const DROP_POOL = TOKENS.filter((t) => !NON_DROPPABLE_KINDS.includes(t.kind));
const TOTAL_WEIGHT = DROP_POOL.reduce((sum, t) => sum + t.weight, 0);

export function rollRandomToken(): TokenDef {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const t of DROP_POOL) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return DROP_POOL[DROP_POOL.length - 1];
}

// Tokens that count as a "buff" — beneficial swing modifiers. Excludes Tiny
// Bob (shrinks the bob), Rope Patch (utility), and the Golden Token (its own
// meta loop). Used by the Run Again guaranteed-buff roll.
export const BUFF_TOKEN_KINDS: TokenKind[] = [
  "bigger-bob",
  "giant-bob",
  "velocity-surge",
  "speed-ramp",
  "multi-bob",
];

const BUFF_TOKENS = TOKENS.filter((t) => BUFF_TOKEN_KINDS.includes(t.kind));
const BUFF_TOTAL_WEIGHT = BUFF_TOKENS.reduce((sum, t) => sum + t.weight, 0);

export function rollRandomBuffToken(): TokenDef {
  let r = Math.random() * BUFF_TOTAL_WEIGHT;
  for (const t of BUFF_TOKENS) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return BUFF_TOKENS[BUFF_TOKENS.length - 1];
}

export const GOLDEN_TOKEN_BASE_DURATION_MS = 6000;
export const TOKEN_LIFETIME_MS = 8000;
export const GOLDEN_TOKEN_LIFETIME_MS = 12000;

export function getTokenLifetime(kind: TokenKind): number {
  return kind === "golden" ? GOLDEN_TOKEN_LIFETIME_MS : TOKEN_LIFETIME_MS;
}
