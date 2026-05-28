import Matter from "matter-js";
import type { TokenDef, TokenInstance, TokenKind, Vec2 } from "../types";
import { getTokenLifetime } from "../data/tokens";

const TOKEN_RADIUS = 18;
const GOLDEN_TOKEN_RADIUS = 22;
const TOKEN_LABEL_PREFIX = "token:";

export interface TokenHandle {
  token: TokenInstance;
  body: Matter.Body;
  def: TokenDef;
}

export interface TokenField {
  tokens: TokenHandle[];
}

export function createTokenField(): TokenField {
  return { tokens: [] };
}

let nextTokenSeq = 0;

export function spawnToken(
  world: Matter.World,
  field: TokenField,
  def: TokenDef,
  at: Vec2,
  now: number
): TokenHandle {
  const radius = def.kind === "golden" ? GOLDEN_TOKEN_RADIUS : TOKEN_RADIUS;
  const id = `tok-${++nextTokenSeq}`;
  const token: TokenInstance = {
    id,
    kind: def.kind,
    position: { x: at.x, y: at.y },
    radius,
    spawnedAt: now,
    expiresAt: now + getTokenLifetime(def.kind),
    driftPhase: Math.random() * Math.PI * 2,
    consumed: false,
  };
  const body = Matter.Bodies.circle(at.x, at.y, radius, {
    isStatic: true,
    isSensor: true,
    label: `${TOKEN_LABEL_PREFIX}${id}`,
  });
  Matter.World.add(world, body);
  const handle: TokenHandle = { token, body, def };
  field.tokens.push(handle);
  return handle;
}

export function isTokenBody(body: Matter.Body): boolean {
  return body.label.startsWith(TOKEN_LABEL_PREFIX);
}

export function findTokenByBody(
  field: TokenField,
  body: Matter.Body
): TokenHandle | null {
  return field.tokens.find((t) => t.body === body) ?? null;
}

// Idle floating animation — tokens gently bob in place to draw the eye, the
// same way Cookie Clicker's golden cookie wiggles. Pure visual; we still
// keep the physics body in sync so collision detection stays accurate.
export function tickTokens(field: TokenField, now: number) {
  for (const h of field.tokens) {
    if (h.token.consumed) continue;
    const elapsed = now - h.token.spawnedAt;
    const offsetY = Math.sin(h.token.driftPhase + elapsed / 320) * 4;
    const baseY = h.token.position.y;
    Matter.Body.setPosition(h.body, { x: h.token.position.x, y: baseY + offsetY });
  }
}

// Remove tokens that have either been consumed (by a bob) or expired off the
// canvas. Returns the list of removed expired-but-not-consumed kinds so the
// caller can play a "tsss, faded away" feedback if it wants to.
export function reapTokens(
  world: Matter.World,
  field: TokenField,
  now: number
): { expired: TokenKind[]; consumed: TokenKind[] } {
  const expired: TokenKind[] = [];
  const consumed: TokenKind[] = [];
  for (let i = field.tokens.length - 1; i >= 0; i--) {
    const h = field.tokens[i];
    if (h.token.consumed) {
      Matter.World.remove(world, h.body);
      field.tokens.splice(i, 1);
      consumed.push(h.token.kind);
      continue;
    }
    if (h.token.expiresAt <= now) {
      Matter.World.remove(world, h.body);
      field.tokens.splice(i, 1);
      expired.push(h.token.kind);
    }
  }
  return { expired, consumed };
}

export function destroyTokenField(world: Matter.World, field: TokenField) {
  for (const h of field.tokens) {
    Matter.World.remove(world, h.body);
  }
  field.tokens.length = 0;
}

export function getTokenLifeFraction(token: TokenInstance, now: number): number {
  const total = token.expiresAt - token.spawnedAt;
  if (total <= 0) return 0;
  const remaining = token.expiresAt - now;
  return Math.max(0, Math.min(1, remaining / total));
}
