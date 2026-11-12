import Matter from "matter-js";
import type { Vec2 } from "../types";
import type { PendulumHandle } from "./pendulum";

/**
 * Hand-grab helpers for the rope rig. The grab holds the rope node nearest the
 * pointer with a stiff temporary constraint (not a weak spring on the tip bob),
 * and on release throws that node with the pointer's recent velocity so the
 * rest of the rope whips through.
 */

/** Stiff enough to "hold" the rope, soft enough to avoid solver jitter. */
export const GRAB_STIFFNESS = 0.75;
export const GRAB_DAMPING = 0.1;
/** Pointer history window averaged into the release throw. */
export const THROW_WINDOW_MS = 70;
/** Release speed cap in Matter velocity units (world units per 1000/60 ms step). */
export const MAX_THROW_SPEED = 52;
const STEP_MS = 1000 / 60;

export interface GrabTarget {
  body: Matter.Body;
  /** Max distance from the pivot this body can reach along a taut rope. */
  reach: number;
}

/**
 * Pick the rope node (or tip bob) nearest `world`. `tipReach` is the reach of
 * the tip bob (rope + bob link). Rope node reach is the summed rest length of
 * the links between the pivot and that node.
 */
export function pickGrabTarget(handle: PendulumHandle, world: Vec2, tipReach: number): GrabTarget | null {
  const tip = handle.bobs[handle.bobs.length - 1];
  if (!tip) return null;
  let best: GrabTarget = { body: tip, reach: tipReach };
  let bestD = Math.hypot(world.x - tip.position.x, world.y - tip.position.y);

  const reachByBody = new Map<Matter.Body, number>();
  let acc = 0;
  for (const c of handle.constraints) {
    if (!/^rope-\d+$/.test(c.label ?? "") || !c.bodyB) continue;
    acc += c.length ?? 0;
    reachByBody.set(c.bodyB, acc);
  }
  for (const node of handle.ropeSegments) {
    const d = Math.hypot(world.x - node.position.x, world.y - node.position.y);
    if (d < bestD) {
      bestD = d;
      best = { body: node, reach: reachByBody.get(node) ?? tipReach };
    }
  }
  return best;
}

export interface PointerSample {
  t: number;
  x: number;
  y: number;
}

/** Record a pointer sample and drop anything older than the throw window. */
export function pushPointerSample(samples: PointerSample[], s: PointerSample, windowMs = THROW_WINDOW_MS) {
  samples.push(s);
  while (samples.length > 2 && s.t - samples[0].t > windowMs) samples.shift();
}

/**
 * Average pointer velocity over the window, in Matter velocity units, capped
 * at `maxSpeed`. Returns zero with fewer than two samples or no elapsed time.
 */
export function throwVelocity(samples: PointerSample[], maxSpeed = MAX_THROW_SPEED): Vec2 {
  if (samples.length < 2) return { x: 0, y: 0 };
  const a = samples[0];
  const b = samples[samples.length - 1];
  const dt = b.t - a.t;
  if (dt <= 0) return { x: 0, y: 0 };
  let vx = ((b.x - a.x) / dt) * STEP_MS;
  let vy = ((b.y - a.y) / dt) * STEP_MS;
  const speed = Math.hypot(vx, vy);
  if (speed > maxSpeed) {
    vx *= maxSpeed / speed;
    vy *= maxSpeed / speed;
  }
  return { x: vx, y: vy };
}
