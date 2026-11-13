import Matter from "matter-js";
import type { SiteMechanic, Vec2 } from "../types";

/**
 * Map mechanics that are pure enough to share between GameCanvas and the
 * headless income sim (tests/support/incomeSim.ts).
 */

export type GustMechanic = Extract<SiteMechanic, { kind: "gusts" }>;

export interface GustSchedule {
  mechanic: GustMechanic;
  /** Gust direction per cycle (unit vectors), rolled lazily. */
  dirs: Vec2[];
  random: () => number;
}

export interface GustState {
  /** Unit direction of the current (or next) gust. */
  dir: Vec2;
  /** 0 (calm) … 1 (full gust). */
  strength: number;
  phase: "calm" | "rising" | "gust" | "falling";
  /** Time until the next gust starts rising (0 while a gust is blowing). */
  nextInMs: number;
}

export function createGustSchedule(mechanic: GustMechanic, random: () => number = Math.random): GustSchedule {
  return { mechanic, dirs: [], random };
}

function gustDir(s: GustSchedule, cycle: number): Vec2 {
  while (s.dirs.length <= cycle) {
    const prev = s.dirs[s.dirs.length - 1];
    // Mostly alternate sides so the swing gets pushed both ways, with a random
    // tilt so it never feels like the same gust twice.
    const side = prev ? (s.random() < 0.75 ? -Math.sign(prev.x) : Math.sign(prev.x)) : s.random() < 0.5 ? -1 : 1;
    const tilt = (s.random() * 2 - 1) * s.mechanic.maxTilt;
    s.dirs.push({ x: side * Math.cos(tilt), y: Math.sin(tilt) });
  }
  return s.dirs[cycle];
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * Gust state `tMs` after the run started. Each cycle is calm → rise → hold →
 * fall; the first gust starts rising after half a calm.
 */
export function gustAt(s: GustSchedule, tMs: number): GustState {
  const { calmMs, rampMs, holdMs } = s.mechanic;
  const cycleMs = calmMs + rampMs * 2 + holdMs;
  // Start half-way through the first calm so a gust arrives early in a run.
  const t = Math.max(0, tMs) + calmMs / 2;
  const cycle = Math.floor(t / cycleMs);
  const u = t - cycle * cycleMs;
  const dir = gustDir(s, cycle);
  if (u < calmMs) return { dir, strength: 0, phase: "calm", nextInMs: calmMs - u };
  const v = u - calmMs;
  if (v < rampMs) return { dir, strength: smooth(v / rampMs), phase: "rising", nextInMs: 0 };
  if (v < rampMs + holdMs) return { dir, strength: 1, phase: "gust", nextInMs: 0 };
  return { dir, strength: smooth(1 - (v - rampMs - holdMs) / rampMs), phase: "falling", nextInMs: 0 };
}

/**
 * Push bodies with the gust. Velocity-based (like the Black Hole pull), so a
 * heavy and a light bob drift the same and the rope bows with them.
 */
export function applyGust(bodies: Matter.Body[], g: GustState, accel: number, dtMs: number) {
  if (g.strength <= 0 || dtMs <= 0) return;
  const dv = accel * g.strength * (dtMs / 1000);
  for (const b of bodies) {
    if (b.isStatic) continue;
    Matter.Body.setVelocity(b, { x: b.velocity.x + g.dir.x * dv, y: b.velocity.y + g.dir.y * dv });
  }
}
