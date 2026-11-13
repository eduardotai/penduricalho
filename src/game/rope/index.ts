export {
  resolveRopeMaterial,
  ropeSegmentCount,
  durabilityDrainPerSec,
  DURABILITY_REFERENCE_WEIGHT,
  type RopeMaterialProfile,
} from "./materials";
export {
  applyRopeMaterialForces,
  createRopePhysicsState,
  type RopePhysicsState,
} from "./physics";

/** Plasma Tether: points multiplier from the live combo (1 for other ropes). */
export function ropeChargeMult(
  behavior: import("../../types").RopeBehavior | undefined,
  comboCount: number
): number {
  if (behavior?.kind !== "charge") return 1;
  return 1 + Math.min(behavior.maxCharge ?? 0.6, Math.max(0, comboCount) * (behavior.chargePerStack ?? 0.04));
}
