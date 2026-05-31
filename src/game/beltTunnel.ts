import Matter from "matter-js";
import type { Vec2 } from "../types";
import type { PendulumHandle } from "./pendulum";
import { propagateRopeWhip } from "./pendulum";
import { WORLD_SCALE } from "./worldConstants";

/** Random outward spray added on top of the directed exit fling (mirrors the
 * rope snap's SNAP_RANDOM_KICK) so ejected bobs scatter across the field. */
const EJECT_SCATTER = 8 * WORLD_SCALE;

/** Dense polyline sample of a random winding tunnel route. */
export interface BeltTunnelPath {
  samples: Vec2[];
  cumulativeLength: number[];
  totalLength: number;
}

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function clampToRect(
  x: number,
  y: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Vec2 {
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

/** Roll a fresh random tunnel through the cage, starting at the rope mount. */
export function generateBeltTunnelPath(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  start: Vec2,
  waypointCount = 9
): BeltTunnelPath {
  const pad = 90 * WORLD_SCALE;
  const minX = bounds.minX + pad;
  const minY = bounds.minY + pad;
  const maxX = bounds.maxX - pad;
  const maxY = bounds.maxY - pad;

  const waypoints: Vec2[] = [start];
  let angle = Math.random() * Math.PI * 2;
  let x = start.x;
  let y = start.y;
  const stepMin = 200 * WORLD_SCALE;
  const stepMax = 340 * WORLD_SCALE;

  for (let i = 0; i < waypointCount; i++) {
    angle += (Math.random() - 0.5) * Math.PI * 0.9;
    const step = stepMin + Math.random() * (stepMax - stepMin);
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
    const clamped = clampToRect(x, y, minX, minY, maxX, maxY);
    if (clamped.x !== x) angle = Math.PI - angle;
    if (clamped.y !== y) angle = -angle;
    x = clamped.x;
    y = clamped.y;
    waypoints.push({ x, y });
  }

  const samples: Vec2[] = [];
  const cumulativeLength: number[] = [0];
  let totalLength = 0;
  const perSeg = 24;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[Math.max(0, i - 1)];
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const p3 = waypoints[Math.min(waypoints.length - 1, i + 2)];
    const startJ = i === 0 ? 0 : 1;
    for (let j = startJ; j <= perSeg; j++) {
      const t = j / perSeg;
      const pt = catmullRom(p0, p1, p2, p3, t);
      const prev = samples[samples.length - 1];
      if (prev) {
        const seg = Math.hypot(pt.x - prev.x, pt.y - prev.y);
        if (seg > 0.5) {
          totalLength += seg;
          cumulativeLength.push(totalLength);
          samples.push(pt);
        }
      } else {
        samples.push(pt);
      }
    }
  }

  return { samples, cumulativeLength, totalLength: Math.max(1, totalLength) };
}

function sampleAtDistance(path: BeltTunnelPath, dist: number): Vec2 {
  const { samples, cumulativeLength, totalLength } = path;
  const d = Math.max(0, Math.min(totalLength, dist));
  if (samples.length <= 1) return samples[0] ?? { x: 0, y: 0 };

  let lo = 0;
  let hi = cumulativeLength.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulativeLength[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  const idx = Math.max(1, lo);
  const prevLen = cumulativeLength[idx - 1] ?? 0;
  const nextLen = cumulativeLength[idx] ?? prevLen;
  const span = Math.max(1e-6, nextLen - prevLen);
  const t = (d - prevLen) / span;
  const a = samples[idx - 1];
  const b = samples[idx] ?? a;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Normalized progress 0..1 along the tunnel. */
export function sampleTunnel(path: BeltTunnelPath, t: number): Vec2 {
  return sampleAtDistance(path, t * path.totalLength);
}

export function sampleTunnelTangent(path: BeltTunnelPath, t: number): Vec2 {
  const look = 18 * WORLD_SCALE;
  const d = t * path.totalLength;
  const a = sampleAtDistance(path, d - look);
  const b = sampleAtDistance(path, d + look);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

/** 
 * Closest progress along the tunnel (0..1).
 * Uses a local search around a hint for stability on windy paths.
 * Without a good hint it falls back to global (slower + can jump on self-proximate paths).
 */
export function nearestTunnelProgress(
  path: BeltTunnelPath, 
  x: number, 
  y: number, 
  hintT?: number
): number {
  const n = path.samples.length;
  if (n === 0) return 0;

  // If no hint, do full search (only used in a few places at startup)
  if (hintT === undefined) {
    let bestD = Infinity;
    let bestT = 0;
    for (let i = 0; i < n; i++) {
      const s = path.samples[i];
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        bestT = (path.cumulativeLength[i] ?? 0) / path.totalLength;
      }
    }
    return bestT;
  }

  // Local search with hysteresis window (~18% of total length on each side)
  const searchRadius = 0.18;
  const centerIdx = Math.floor(hintT * (n - 1));

  let bestD = Infinity;
  let bestT = hintT;
  const start = Math.max(0, Math.floor((hintT - searchRadius) * (n - 1)));
  const end = Math.min(n - 1, Math.floor((hintT + searchRadius) * (n - 1)));

  for (let i = start; i <= end; i++) {
    const s = path.samples[i];
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      bestT = (path.cumulativeLength[i] ?? 0) / path.totalLength;
    }
  }

  // If the local search didn't find anything reasonable, allow a slightly wider search
  // (prevents getting stuck if the bob is pushed far off the path)
  if (bestD > (80 * WORLD_SCALE) ** 2) {
    const wider = 0.28;
    const wStart = Math.max(0, Math.floor((hintT - wider) * (n - 1)));
    const wEnd = Math.min(n - 1, Math.floor((hintT + wider) * (n - 1)));
    for (let i = wStart; i <= wEnd; i++) {
      const s = path.samples[i];
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        bestT = (path.cumulativeLength[i] ?? 0) / path.totalLength;
      }
    }
  }

  return bestT;
}

/** Advance tracked progress: conveyor feed + bob projection, never rewinding. */
export function advanceTunnelProgress(
  path: BeltTunnelPath,
  currentT: number,
  bobX: number,
  bobY: number,
  conveyorAdvance: number
): number {
  const projected = nearestTunnelProgress(path, bobX, bobY, currentT);
  const forward = currentT + conveyorAdvance / path.totalLength;
  return Math.min(1, Math.max(currentT, projected, forward));
}

/** Launch kick along the tunnel tangent at its start — not a pivot spin. */
export function applyBeltLaunchKick(
  handle: PendulumHandle,
  path: BeltTunnelPath,
  kickSpeed: number
) {
  const tan = sampleTunnelTangent(path, 0);
  const velBonus = handle.attachment.bonuses.velocityBonus ?? 0;
  const speed = kickSpeed * WORLD_SCALE * (1 + velBonus) * (0.95 + Math.random() * 0.1);
  const vx = tan.x * speed;
  const vy = tan.y * speed;
  const MAX = 72 * WORLD_SCALE;

  for (let i = 0; i < handle.bobs.length; i++) {
    const bob = handle.bobs[i];
    const segmentBoost = 1 - i * 0.05;
    Matter.Body.setVelocity(bob, {
      x: Math.max(-MAX, Math.min(MAX, vx * segmentBoost)),
      y: Math.max(-MAX, Math.min(MAX, vy * segmentBoost)),
    });
    if (i === handle.bobs.length - 1) {
      propagateRopeWhip(handle, { x: vx, y: vy }, 0.05);
    }
  }
}

/**
 * Strict center-line rail following — EVERYTHING IS DONE TO THE BOB.
 * The bob is locked exactly onto the mid-line center of the path every frame.
 *
 * - Hard setPosition directly on the bob to the precise center point.
 * - The powerful initial kick (applied directly to the bob at the entry arrow point)
 *   is preserved at high strength so the bob itself carries serious velocity and
 *   runs through the entire conveyor at speed.
 * - Forward assist is applied to the bob along the exact tangent.
 *
 * At the end of the path the bob is released with its current high velocity (ejector).
 */
export function applyStrictConveyorRail(
  path: BeltTunnelPath,
  bobs: Matter.Body[],
  conveyorSpeed: number,
  dt: number,
  ejectThreshold = 0.98
): boolean {
  if (!path || bobs.length === 0) return false;

  const dtSec = dt / 1000;

  // How fast the bob travels ALONG the path. The conveyor speed alone crawls a
  // long winding tunnel for over a minute, so the bob would almost never reach
  // the exit. We floor the rail speed so even a long path is run through in a
  // couple of seconds — then the bob hits the exit and gets ejected.
  const minTraverseSpeed = path.totalLength / 2.2; // whole path in ~2.2s
  const railSpeed = Math.max(conveyorSpeed * 4, minTraverseSpeed);
  const progressDelta = (railSpeed * dtSec) / path.totalLength;

  let anyEjected = false;

  for (let i = 0; i < bobs.length; i++) {
    const bob = bobs[i];
    if (!bob) continue;

    // A bob that already shot out of the exit flies free under normal physics.
    // Never pull it back onto the rail (that was the old infinite re-loop).
    if ((bob as any)._beltEjected) continue;

    let t = (bob as any)._beltRailT ?? 0;

    // Advance progress along the path
    t = Math.min(1, t + progressDelta);
    (bob as any)._beltRailT = t;

    if (t >= ejectThreshold) {
      // === EJECTOR BEHAVIOR (snap-style) ===
      // When the bob completes the conveyor path it is THROWN AWAY from the
      // exit, just like the rope snap flings its bobs free: a strong directed
      // launch along the path's final tangent (so it keeps following the route
      // it was riding) PLUS a random outward scatter + spin, and full
      // free-projectile collision physics so it bounces and scores across the
      // field. It never resets to the start.
      // Place the bob exactly at the exit before flinging it. The rail hard-
      // locks position with setPosition every frame, so the bob must be put on
      // the exit point here too — otherwise it launches from wherever its
      // between-frame velocity left it (off-field) and vanishes.
      const exit = sampleTunnel(path, Math.min(1, t));
      Matter.Body.setPosition(bob, exit);

      const tan = sampleTunnelTangent(path, Math.min(0.999, t));
      // Strong but safe: a *free* body faster than the cage wall thickness
      // (~200/step) tunnels straight through and vanishes, so cap well under it.
      const MAX_EJECT = 30 * WORLD_SCALE;
      const ejectSpeed = Math.min(
        MAX_EJECT,
        Math.max(conveyorSpeed * 2.6, railSpeed * 0.6)
      );

      const ang = Math.random() * Math.PI * 2;
      Matter.Body.setVelocity(bob, {
        x: tan.x * ejectSpeed + Math.cos(ang) * EJECT_SCATTER,
        y: tan.y * ejectSpeed + Math.sin(ang) * EJECT_SCATTER,
      });
      Matter.Body.setAngularVelocity(bob, (Math.random() - 0.5) * 0.4);

      // Same free-projectile collision response a snapped bob gets, so it
      // ricochets off the cage walls and keeps scoring instead of sliding.
      bob.restitution = 0.5;
      bob.friction = 0.05;
      bob.frictionAir = 0.006;

      anyEjected = true;
      (bob as any)._beltEjected = true;   // Mark so rest-pose logic and re-attachment can ignore this bob
      delete (bob as any)._beltRailT;
      continue;
    }

    const pos = sampleTunnel(path, t);
    const tan = sampleTunnelTangent(path, t);

    // Hard position lock: the bob is forced exactly onto the mid-line center
    // every frame, so its progress along the path is driven entirely by `t`
    // (advanced by progressDelta above) — NOT by its velocity.
    Matter.Body.setPosition(bob, pos);

    // Give it a MODEST tangent velocity, only so the grip-fade check in
    // beltConveyor still sees it "moving" and the ride doesn't release early.
    // It must stay sane: the Matter Runner integrates this between animation
    // frames, and the old "absurdly high" velocity compounded every frame into
    // a runaway that flung the bob far off-field (then snapped it back), which
    // left it stranded off-screen the instant the eject branch stopped
    // re-positioning it. Position is locked anyway, so magnitude is cosmetic.
    Matter.Body.setVelocity(bob, {
      x: tan.x * conveyorSpeed,
      y: tan.y * conveyorSpeed,
    });
  }

  return anyEjected;
}

/**
 * Multilayer containment for the conveyor tunnel ("second floor" hitbox).
 *
 * Modes:
 * - Guided (default): soft bumper so the bob slides while being conveyed.
 * - Bouncy + strict (after snap): the tunnel becomes a strict physical tube.
 *   The bob can only properly enter at the start and exit at the very end of
 *   the generated path. Sides are hard; it bounces inside the tube until it
 *   reaches the designed exit.
 */
export function applyBeltTunnelContainment(
  path: BeltTunnelPath,
  bobs: Matter.Body[],
  corridorHalfWidth: number,
  options: {
    restitution?: number;
    /** Bouncy elastic walls (used after conveyor snap) */
    bouncy?: boolean;
    /** Much stricter tube: bob is forced to stay on the path and can only exit near the very end */
    strict?: boolean;
  } = {}
): void {
  const restitution = options.restitution ?? 0.25;
  const bouncy = options.bouncy ?? false;
  const strict = options.strict ?? bouncy; // strict implies bouncy behavior for now

  if (!path || bobs.length === 0 || corridorHalfWidth <= 1) return;

  const effectiveHalfWidth = strict
    ? corridorHalfWidth * 0.82   // narrower effective tube in strict mode
    : corridorHalfWidth;

  // Layer ratios
  const bumperStart   = effectiveHalfWidth * (strict ? 0.45 : bouncy ? 0.48 : 0.52);
  const hardThreshold = effectiveHalfWidth * (strict ? 0.88 : bouncy ? 0.92 : 0.96);
  const maxCorrectionPerFrame = strict ? 18 * WORLD_SCALE : 14 * WORLD_SCALE;

  // In strict mode we want a clear "exit zone" near the end of the path
  const exitStartT = 0.88;

  for (const bob of bobs) {
    if (!bob || bob.isStatic) continue;

    // Use the previous bob progress as hint for stable nearest-point lookup.
    // This prevents catastrophic jumps when the winding path folds close to itself.
    const prevT = (bob as any)._lastBeltT ?? undefined;
    const bobT = nearestTunnelProgress(path, bob.position.x, bob.position.y, prevT);
    (bob as any)._lastBeltT = bobT; // cache for next frame

    const center = sampleTunnel(path, bobT);
    const tan = sampleTunnelTangent(path, bobT);

    const nx = -tan.y;
    const ny = tan.x;

    const dx = bob.position.x - center.x;
    const dy = bob.position.y - center.y;
    const lateral = dx * nx + dy * ny;
    const dist = Math.abs(lateral);

    // Near the designed exit → fade containment so the bob can leave the tunnel
    let exitFade = 1;
    if (strict && bobT > exitStartT) {
      exitFade = Math.max(0, 1 - (bobT - exitStartT) / (1 - exitStartT));
    }

    if (exitFade <= 0.05) continue; // bob has reached the exit zone, let it go free

    const bobMass = Math.max(0.1, (bob.mass as number) || 1);
    const massFactor = Math.min(1, Math.max(0.32, bobMass / 2.8));

    if (dist <= bumperStart) continue;

    const sign = lateral >= 0 ? 1 : -1;
    const penetration = dist - bumperStart;

    // Stronger clamping in strict tube mode
    const surfaceDist = Math.min(dist, hardThreshold);
    const targetX = center.x + nx * surfaceDist * sign;
    const targetY = center.y + ny * surfaceDist * sign;

    const deltaX = targetX - bob.position.x;
    const deltaY = targetY - bob.position.y;
    const deltaLen = Math.hypot(deltaX, deltaY);

    const posStrength = strict ? 0.92 : (bouncy ? 0.55 : 0.65);
    const moveLen = Math.min(
      deltaLen,
      Math.max(strict ? 3 : (bouncy ? 2 : 1.5), penetration * posStrength * massFactor),
      maxCorrectionPerFrame * (strict ? 1.1 : (bouncy ? 0.9 : 1)) * massFactor
    ) * exitFade;

    if (moveLen > (strict ? 1.2 : (bouncy ? 0.8 : 0.3))) {
      const k = moveLen / (deltaLen || 1);
      Matter.Body.setPosition(bob, {
        x: bob.position.x + deltaX * k,
        y: bob.position.y + deltaY * k,
      });
    }

    // Velocity
    const vx = bob.velocity.x;
    const vy = bob.velocity.y;

    const vNormal = vx * nx + vy * ny;
    const vTangentX = vx - nx * vNormal;
    const vTangentY = vy - ny * vNormal;

    if (vNormal * sign > 0.02) {
      const isHardLayer = dist > hardThreshold;

      let newNormalVel: number;

      if (bouncy || strict) {
        // Bouncy + strict: energetic bounces inside the tube, but only until the exit
        const bounceRest = strict
          ? (isHardLayer ? 0.82 : 0.65)
          : (isHardLayer ? Math.max(0.55, restitution) : 0.45);
        newNormalVel = -Math.abs(vNormal) * bounceRest * exitFade;
      } else {
        let normalDamping = isHardLayer ? (0.12 + restitution * 0.55) : 0.06;
        normalDamping *= massFactor;
        newNormalVel = vNormal * (1 - normalDamping);
      }

      // In strict mode we also slightly damp excessive backtracking so the bob
      // doesn't just rattle backward out the entrance
      let finalTangentX = vTangentX;
      let finalTangentY = vTangentY;

      if (strict) {
        // Mild forward bias when deep in the tube
        const forwardBias = 0.15 * exitFade;
        const speedAlong = Math.hypot(vTangentX, vTangentY);
        if (speedAlong > 2) {
          finalTangentX = vTangentX * (1 - forwardBias) + tan.x * speedAlong * forwardBias * 0.3;
          finalTangentY = vTangentY * (1 - forwardBias) + tan.y * speedAlong * forwardBias * 0.3;
        }
      }

      Matter.Body.setVelocity(bob, {
        x: finalTangentX + nx * newNormalVel,
        y: finalTangentY + ny * newNormalVel,
      });
    }
  }
}

// Back-compat alias (old name still works during transition)
export { applyBeltTunnelContainment as applyBeltTunnelWalls };
