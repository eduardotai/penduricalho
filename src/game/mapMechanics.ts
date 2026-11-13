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

// --- Spring walls (Bumper Cage) ------------------------------------------

/**
 * Steer a wall rebound part-way toward `target` (the mount), keeping its
 * speed. `aim` 0 = the plain mirror bounce, 1 = straight at the target.
 */
export function springRebound(pos: Vec2, vel: Vec2, target: Vec2, aim: number): Vec2 {
  const s = Math.hypot(vel.x, vel.y);
  if (s < 1e-9 || aim <= 0) return { x: vel.x, y: vel.y };
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const d = Math.hypot(dx, dy) || 1;
  const ax = (vel.x / s) * (1 - aim) + (dx / d) * aim;
  const ay = (vel.y / s) * (1 - aim) + (dy / d) * aim;
  const a = Math.hypot(ax, ay) || 1;
  return { x: (ax / a) * s, y: (ay / a) * s };
}

// --- Moon Base: gravity tides --------------------------------------------

export type TideMechanic = Extract<SiteMechanic, { kind: "tides" }>;

/**
 * Gravity multiplier `tMs` into a run. Starts at maxGravity (a normal launch),
 * eases down to minGravity at half a period and back. `frac` is 0 (min) … 1 (max).
 */
export function tideAt(m: TideMechanic, tMs: number): { mult: number; frac: number; falling: boolean } {
  const phase = ((Math.max(0, tMs) % m.periodMs) / m.periodMs) * Math.PI * 2;
  const frac = 0.5 + 0.5 * Math.cos(phase);
  return { mult: m.minGravity + (m.maxGravity - m.minGravity) * frac, frac, falling: phase < Math.PI };
}

// --- Conveyor Yard: drifting orbs ----------------------------------------

export type ConveyorMechanic = Extract<SiteMechanic, { kind: "conveyor" }>;

/**
 * Belt velocity `tMs` into a run: ±1 direction (first leg runs right), a
 * signed speed that eases through zero around each flip, and time to the flip.
 */
export function conveyorAt(m: ConveyorMechanic, tMs: number): { dir: 1 | -1; velocity: number; nextFlipMs: number } {
  const t = Math.max(0, tMs);
  const leg = Math.floor(t / m.flipMs);
  const dir: 1 | -1 = leg % 2 === 0 ? 1 : -1;
  const u = t - leg * m.flipMs;
  const toFlip = m.flipMs - u;
  // Ease out of the previous flip and into the next one.
  const ease = Math.min(1, (leg === 0 ? m.easeMs : u) / m.easeMs, toFlip / m.easeMs);
  return { dir, velocity: dir * m.speed * smooth(Math.max(0, ease)), nextFlipMs: toFlip };
}

/** Slide every orb by dx, wrapping across the field's x range. Keeps physics bodies in sync. */
export function shiftZones(
  zones: { zone: { position: Vec2 }; body: Matter.Body }[],
  dx: number,
  bounds: { x: number; w: number }
) {
  if (dx === 0) return;
  for (const h of zones) {
    let x = h.zone.position.x + dx;
    if (x > bounds.x + bounds.w) x -= bounds.w;
    else if (x < bounds.x) x += bounds.w;
    const y = h.zone.position.y;
    h.zone.position = { x, y };
    Matter.Body.setPosition(h.body, { x, y });
  }
}

// --- Magnet Storm: magnetic pulses ---------------------------------------

export type MagnetPulseMechanic = Extract<SiteMechanic, { kind: "magnetPulses" }>;

/** Pulse state: strength 0 (calm) … 1, eased in/out; first pulse after half a calm. */
export function magnetPulseAt(m: MagnetPulseMechanic, tMs: number): { strength: number; active: boolean; nextInMs: number } {
  const cycle = m.calmMs + m.pulseMs;
  const t = Math.max(0, tMs) + m.calmMs / 2;
  const u = t % cycle;
  if (u < m.calmMs) return { strength: 0, active: false, nextInMs: m.calmMs - u };
  const v = (u - m.calmMs) / m.pulseMs;
  return { strength: Math.sin(v * Math.PI), active: true, nextInMs: 0 };
}
