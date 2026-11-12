import type { Vec2 } from "../types";
import { WORLD_SCALE } from "./worldConstants";

/**
 * Effects are drawn in world space, which is WORLD_SCALE× the original
 * 1280×800 design field. Every size, speed, and offset below is authored in
 * design px and multiplied by this so particles, flashes, and floating text
 * keep their designed on-screen size instead of shrinking to 1–2 px.
 */
export const EFFECT_SCALE = WORLD_SCALE;
const E = (designPx: number) => designPx * EFFECT_SCALE;

/** Floating "+N" / maneuver label font size in world units (18 design px; the
 * old 14 px read too small once the default camera zooms out to ~0.3×). */
export const FLOAT_TEXT_FONT_SIZE = E(18);
/** Hit-flash ring stroke width and expansion, in world units. */
export const HIT_FLASH_LINE_WIDTH = E(3);
export const HIT_FLASH_EXPAND = E(60);

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatText {
  x: number;
  y: number;
  value: string;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface EffectsState {
  particles: Particle[];
  floats: FloatText[];
  shake: { magnitude: number; until: number };
  hitFlashes: { x: number; y: number; radius: number; until: number; color: string }[];
}

export function createEffectsState(): EffectsState {
  return { particles: [], floats: [], shake: { magnitude: 0, until: 0 }, hitFlashes: [] };
}

export function emitHit(
  state: EffectsState,
  at: Vec2,
  now: number,
  options: { color: string; points: number; intensity?: number } = { color: "#fbbf24", points: 1 }
) {
  const count = 12 + Math.floor((options.intensity ?? 1) * 6);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = E(1.5 + Math.random() * 3 * (options.intensity ?? 1));
    state.particles.push({
      x: at.x,
      y: at.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 500 + Math.random() * 300,
      color: options.color,
      size: E(2 + Math.random() * 3),
    });
  }
  state.floats.push({
    x: at.x,
    y: at.y - E(8),
    value: `+${options.points}`,
    vy: E(-0.35),
    life: 0,
    maxLife: 700,
    color: options.color,
  });
  state.hitFlashes.push({
    x: at.x,
    y: at.y,
    radius: E(6),
    until: now + 220,
    color: options.color,
  });
  triggerShake(state, 4 + (options.intensity ?? 1) * 2, 180, now);
}

export function emitManeuver(state: EffectsState, at: Vec2, label: string, now: number) {
  state.floats.push({
    x: at.x,
    y: at.y - E(16),
    value: label,
    vy: E(-0.5),
    life: 0,
    maxLife: 1100,
    color: "#fde68a",
  });
  triggerShake(state, 5, 220, now);
}

export function triggerShake(state: EffectsState, magnitude: number, durationMs: number, now: number) {
  const until = now + durationMs;
  if (until > state.shake.until || magnitude > state.shake.magnitude) {
    state.shake.magnitude = Math.max(state.shake.magnitude, magnitude);
    state.shake.until = Math.max(state.shake.until, until);
  }
}

export function tickEffects(state: EffectsState, dtMs: number, now: number) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life += dtMs;
    p.x += p.vx * (dtMs / 16);
    p.y += p.vy * (dtMs / 16);
    p.vy += E(0.05) * (dtMs / 16);
    p.vx *= 0.985;
    if (p.life >= p.maxLife) state.particles.splice(i, 1);
  }
  for (let i = state.floats.length - 1; i >= 0; i--) {
    const f = state.floats[i];
    f.life += dtMs;
    f.y += f.vy * (dtMs / 16);
    if (f.life >= f.maxLife) state.floats.splice(i, 1);
  }
  for (let i = state.hitFlashes.length - 1; i >= 0; i--) {
    const h = state.hitFlashes[i];
    if (h.until <= now) state.hitFlashes.splice(i, 1);
  }
  if (state.shake.until <= now) {
    state.shake.magnitude = 0;
    state.shake.until = 0;
  }
}

export function getShakeOffset(state: EffectsState, now: number): Vec2 {
  if (state.shake.until <= now || state.shake.magnitude <= 0) return { x: 0, y: 0 };
  const remaining = (state.shake.until - now) / 200;
  const m = state.shake.magnitude * Math.min(1, remaining);
  return {
    x: (Math.random() - 0.5) * m,
    y: (Math.random() - 0.5) * m,
  };
}
