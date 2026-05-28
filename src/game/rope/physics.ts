import Matter from "matter-js";
import type { RopeMaterialProfile } from "./materials";

export interface RopePhysicsState {
  profile: RopeMaterialProfile;
  restLengths: Map<Matter.Constraint, number>;
  stretchRatio: number;
}

export function createRopePhysicsState(
  profile: RopeMaterialProfile,
  constraints: Matter.Constraint[]
): RopePhysicsState {
  const restLengths = new Map<Matter.Constraint, number>();
  for (const c of constraints) {
    if (!/^rope-\d+$/.test(c.label ?? "")) continue;
    restLengths.set(c, c.length ?? 1);
  }
  return { profile, restLengths, stretchRatio: 1 };
}

function linkLength(a: Matter.Vector, b: Matter.Vector) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Read-only stretch tracking for rope rendering. Matter constraints handle the physics. */
export function applyRopeMaterialForces(
  _segments: Matter.Body[],
  constraints: Matter.Constraint[],
  state: RopePhysicsState
): void {
  void _segments;
  let maxStretch = 1;

  for (const c of constraints) {
    if (!/^rope-\d+$/.test(c.label ?? "") || !c.bodyA || !c.bodyB) continue;
    const rest = state.restLengths.get(c) ?? c.length ?? 1;
    const len = linkLength(c.bodyA.position, c.bodyB.position);
    const strain = len / Math.max(1, rest);
    if (strain > maxStretch) maxStretch = strain;
  }

  state.stretchRatio = maxStretch;
}
