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

// --- Orbiting bumpers (Bumper Colosseum) ---------------------------------

export type BumperMechanic = Extract<SiteMechanic, { kind: "bumpers" }>;

export interface Bumper {
  x: number;
  y: number;
  /** Surface velocity in world units per physics step (1000/60 ms). */
  vx: number;
  vy: number;
}

const STEP_MS = 1000 / 60;

/** Orbit radius: just outside the rig's swing circle. */
export function bumperOrbitRadius(m: BumperMechanic, reach: number): number {
  return reach + m.orbitGap;
}

/** Bumper centres `tMs` into the run, evenly spaced on one orbit around `center`. */
export function bumperPositions(m: BumperMechanic, center: Vec2, reach: number, tMs: number): Bumper[] {
  const R = bumperOrbitRadius(m, reach);
  const w = (Math.PI * 2) / m.periodMs; // rad per ms (sign = direction)
  const out: Bumper[] = [];
  for (let i = 0; i < m.count; i++) {
    const a = w * tMs + Math.PI + (i * Math.PI * 2) / m.count;
    out.push({
      x: center.x + Math.cos(a) * R,
      y: center.y + Math.sin(a) * R,
      vx: -Math.sin(a) * R * w * STEP_MS,
      vy: Math.cos(a) * R * w * STEP_MS,
    });
  }
  return out;
}

export interface BumperBounce {
  position: Vec2;
  velocity: Vec2;
  /** Approach speed along the contact normal (> 0). */
  impact: number;
}

/**
 * Bounce a body of radius `r` off a moving bumper. Returns null when they
 * don't touch, are already separating, or the body is slower than
 * `minHitSpeed` (it passes through, so a dying swing can still stall). The relative velocity is mirrored
 * across the contact normal, the bumper's own motion is added back, the speed
 * is raised to at least `boost` × the incoming speed (capped at `maxSpeed`),
 * and the body is moved just outside the bumper.
 */
export function bumperBounce(
  pos: Vec2,
  vel: Vec2,
  r: number,
  b: Bumper,
  m: Pick<BumperMechanic, "radius" | "boost" | "maxSpeed" | "minHitSpeed">
): BumperBounce | null {
  if (Math.hypot(vel.x, vel.y) < m.minHitSpeed) return null;
  const dx = pos.x - b.x;
  const dy = pos.y - b.y;
  const d = Math.hypot(dx, dy);
  const reach = r + m.radius;
  if (d >= reach) return null;
  const nx = d > 1e-6 ? dx / d : 0;
  const ny = d > 1e-6 ? dy / d : -1;
  const rvx = vel.x - b.vx;
  const rvy = vel.y - b.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return null;
  let ox = rvx - 2 * vn * nx + b.vx;
  let oy = rvy - 2 * vn * ny + b.vy;
  // A bumper never steals speed: the bat leaves the body at least `boost`
  // times as fast as it arrived (a slow bounce off a receding bumper would
  // otherwise stall the swing and end the run).
  const sp = Math.hypot(ox, oy) || 1;
  const target = Math.min(m.maxSpeed, Math.max(sp, Math.hypot(vel.x, vel.y) * m.boost));
  ox = (ox / sp) * target;
  oy = (oy / sp) * target;
  return {
    position: { x: b.x + nx * (reach + 1), y: b.y + ny * (reach + 1) },
    velocity: { x: ox, y: oy },
    impact: -vn,
  };
}

/**
 * Stateful helper shared by GameCanvas and the sim: bounces each body off any
 * bumper it touches (one bat per bumper/body per cooldown). Returns the hits so
 * the caller can draw / play them.
 */
export function createBumperField(m: BumperMechanic) {
  const lastHit = new Map<string, number>();
  const flashUntil: number[] = new Array(m.count).fill(0);
  return {
    mechanic: m,
    flashUntil,
    reset() {
      lastHit.clear();
      flashUntil.fill(0);
    },
    tick(
      bodies: Matter.Body[],
      radiusOf: (b: Matter.Body) => number,
      center: Vec2,
      reach: number,
      tMs: number,
      now: number
    ): { bumper: number; at: Vec2; impact: number }[] {
      const bumpers = bumperPositions(m, center, reach, tMs);
      const hits: { bumper: number; at: Vec2; impact: number }[] = [];
      for (const body of bodies) {
        if (body.isStatic) continue;
        bumpers.forEach((b, i) => {
          const key = `${i}:${body.id}`;
          if (now - (lastHit.get(key) ?? -1e9) < m.cooldownMs) return;
          const res = bumperBounce(body.position, body.velocity, radiusOf(body), b, m);
          if (!res) return;
          Matter.Body.setPosition(body, res.position);
          Matter.Body.setVelocity(body, res.velocity);
          lastHit.set(key, now);
          flashUntil[i] = now + 220;
          hits.push({ bumper: i, at: { x: b.x, y: b.y }, impact: res.impact });
        });
      }
      return hits;
    },
  };
}
