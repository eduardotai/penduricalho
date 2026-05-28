import Matter from "matter-js";
import type { AttachmentDef } from "../types";
import type { PendulumHandle } from "./pendulum";

const GRAVITY_SCALE = 0.001;

export interface AttachmentMaterialProfile {
  youngsModulus: number;
  crossSection: number;
  linearDensity: number;
  dampingRatio: number;
  maxStretchRatio: number;
  equilibriumStretchFraction: number;
  rigid?: boolean;
  nonlinearStretchGain?: number;
  axialVelocityDamping?: number;
  limitStiffness?: number;
}

export const ATTACHMENT_MATERIALS: Record<string, AttachmentMaterialProfile> = {
  "micro-twine": {
    youngsModulus: 1.4,
    crossSection: 0.45,
    linearDensity: 0.001,
    dampingRatio: 0.11,
    maxStretchRatio: 1.05,
    equilibriumStretchFraction: 0.4,
  },
  "short-hemp": {
    youngsModulus: 1.8,
    crossSection: 0.75,
    linearDensity: 0.0014,
    dampingRatio: 0.1,
    maxStretchRatio: 1.048,
    equilibriumStretchFraction: 0.48,
  },
  "compact-rope": {
    youngsModulus: 2.0,
    crossSection: 0.9,
    linearDensity: 0.0016,
    dampingRatio: 0.095,
    maxStretchRatio: 1.046,
    equilibriumStretchFraction: 0.52,
  },
  "hemp-rope": {
    youngsModulus: 2.2,
    crossSection: 1.0,
    linearDensity: 0.0018,
    dampingRatio: 0.09,
    maxStretchRatio: 1.045,
    equilibriumStretchFraction: 0.55,
  },
  "steel-rope": {
    youngsModulus: 180,
    crossSection: 0.55,
    linearDensity: 0.0042,
    dampingRatio: 0.018,
    maxStretchRatio: 1.006,
    equilibriumStretchFraction: 0.6,
  },
  "iron-rod": {
    youngsModulus: 210,
    crossSection: 2.4,
    linearDensity: 0.0065,
    dampingRatio: 0.008,
    maxStretchRatio: 1.001,
    equilibriumStretchFraction: 0.2,
    rigid: true,
  },
  "heavy-chain": {
    youngsModulus: 8,
    crossSection: 1.6,
    linearDensity: 0.012,
    dampingRatio: 0.16,
    maxStretchRatio: 1.025,
    equilibriumStretchFraction: 0.45,
    axialVelocityDamping: 0.035,
  },
  "elastic-cord": {
    youngsModulus: 0.08,
    crossSection: 0.7,
    linearDensity: 0.0012,
    dampingRatio: 0.045,
    maxStretchRatio: 1.85,
    equilibriumStretchFraction: 0.35,
    nonlinearStretchGain: 28,
    limitStiffness: 0.12,
  },
  "braided-rope": {
    youngsModulus: 3.2,
    crossSection: 1.15,
    linearDensity: 0.002,
    dampingRatio: 0.085,
    maxStretchRatio: 1.042,
    equilibriumStretchFraction: 0.58,
  },
  "tow-rope": {
    youngsModulus: 4.5,
    crossSection: 1.35,
    linearDensity: 0.0026,
    dampingRatio: 0.08,
    maxStretchRatio: 1.04,
    equilibriumStretchFraction: 0.6,
  },
  "titan-cable": {
    youngsModulus: 140,
    crossSection: 0.7,
    linearDensity: 0.0038,
    dampingRatio: 0.016,
    maxStretchRatio: 1.008,
    equilibriumStretchFraction: 0.62,
  },
  "magnetic-tether": {
    youngsModulus: 120,
    crossSection: 0.15,
    linearDensity: 0.0004,
    dampingRatio: 0.004,
    maxStretchRatio: 1.012,
    equilibriumStretchFraction: 0.5,
  },
};

export function getMaterialProfile(attachment: AttachmentDef): AttachmentMaterialProfile {
  return ATTACHMENT_MATERIALS[attachment.id] ?? ATTACHMENT_MATERIALS["hemp-rope"];
}

export function axialSpringConstant(
  profile: AttachmentMaterialProfile,
  restLength: number
): number {
  return (profile.youngsModulus * profile.crossSection) / Math.max(1, restLength);
}

export function resolveConstraintParams(
  profile: AttachmentMaterialProfile,
  restLength: number,
  bobMass: number,
  gravityY: number
): { stiffness: number; damping: number } {
  if (profile.rigid) {
    return { stiffness: 1, damping: Math.min(0.02, profile.dampingRatio * 0.5) };
  }

  const weight = bobMass * gravityY * GRAVITY_SCALE;
  const maxStretch = restLength * Math.max(0, profile.maxStretchRatio - 1);
  const targetStretch = Math.max(0.15, maxStretch * profile.equilibriumStretchFraction);
  const kNeeded = weight / targetStretch;
  const kMaterial = axialSpringConstant(profile, restLength);
  const kEffective = Math.sqrt(kMaterial * kNeeded);
  const STIFFNESS_GAIN = 0.022;
  const stiffness = Math.max(
    0.04,
    Math.min(0.995, (kEffective * STIFFNESS_GAIN) / (1 + kEffective * STIFFNESS_GAIN))
  );
  const damping = Math.min(0.45, profile.dampingRatio * 2.8);
  return { stiffness, damping };
}

export function attachmentMass(
  profile: AttachmentMaterialProfile,
  restLength: number
): number {
  return profile.linearDensity * restLength;
}

export function recommendedConstraintIterations(profile: AttachmentMaterialProfile): number {
  if (profile.rigid) return 2;
  if (profile.maxStretchRatio > 1.2) return 6;
  if (profile.maxStretchRatio > 1.02) return 4;
  return 3;
}

export interface AttachmentPhysicsState {
  profile: AttachmentMaterialProfile;
  restLength: number;
  bobMass: number;
  gravityY: number;
  stretchRatio: number;
}

export function createAttachmentPhysicsState(
  attachment: AttachmentDef,
  restLength: number,
  bobMass: number,
  gravityY: number
): AttachmentPhysicsState {
  return {
    profile: getMaterialProfile(attachment),
    restLength,
    bobMass,
    gravityY,
    stretchRatio: 1,
  };
}

function ropeUnit(pivot: Matter.Vector, bob: Matter.Vector) {
  const dx = bob.x - pivot.x;
  const dy = bob.y - pivot.y;
  const len = Math.hypot(dx, dy) || 1;
  return { len, ux: dx / len, uy: dy / len };
}

function applyForceClamped(
  bob: Matter.Body,
  fx: number,
  fy: number,
  maxMag: number
) {
  if (!Number.isFinite(fx) || !Number.isFinite(fy) || maxMag <= 0) return;
  const mag = Math.hypot(fx, fy);
  if (mag === 0) return;
  const scale = mag > maxMag ? maxMag / mag : 1;
  Matter.Body.applyForce(bob, bob.position, { x: fx * scale, y: fy * scale });
}

function resetBobToRest(bob: Matter.Body, pivot: Matter.Vector, restLength: number) {
  Matter.Body.setPosition(bob, { x: pivot.x, y: pivot.y + restLength });
  Matter.Body.setVelocity(bob, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(bob, 0);
}

const MAX_BOB_SPEED = 110;

export function applyAttachmentPhysics(
  handle: PendulumHandle,
  state: AttachmentPhysicsState
) {
  const constraint =
    handle.constraints.find((c) => c.label === "rope-bob" || c.label === "link-0") ??
    handle.constraints[handle.constraints.length - 1];
  const bob = handle.bobs[handle.bobs.length - 1];
  if (!constraint || !bob) return;

  const pivot = handle.pivot.position;
  const restLength = Math.max(
    1,
    handle.ropeSegments.length > 0
      ? handle.attachment.length * handle.ropeLengthScale +
          (handle.pendulum.bobCount > 1
            ? handle.pendulum.bobSpacing * Math.max(0, handle.pendulum.bobCount - 1)
            : 0)
      : constraint.length
  );

  if (
    !Number.isFinite(bob.position.x) ||
    !Number.isFinite(bob.position.y) ||
    !Number.isFinite(bob.velocity.x) ||
    !Number.isFinite(bob.velocity.y)
  ) {
    resetBobToRest(bob, pivot, restLength);
    state.stretchRatio = 1;
    return;
  }

  const { len, ux, uy } = ropeUnit(pivot, bob.position);
  state.stretchRatio = len / restLength;

  const weight = bob.mass * state.gravityY * GRAVITY_SCALE;
  const maxForce = Math.max(weight * 40, 0.003);
  const profile = state.profile;
  const stretch = len - restLength;
  const strain = stretch / restLength;

  const maxLen = restLength * profile.maxStretchRatio;
  if (len > maxLen) {
    const overrunStrain = (len - maxLen) / restLength;
    const limitK = (profile.limitStiffness ?? 0.08) * bob.mass * overrunStrain;
    applyForceClamped(bob, -ux * limitK, -uy * limitK, maxForce);
  }

  if (profile.rigid) return;

  if (profile.nonlinearStretchGain && stretch > 0) {
    const nl = profile.nonlinearStretchGain * strain * strain * weight;
    applyForceClamped(bob, -ux * nl, -uy * nl, maxForce);
  }

  if (profile.axialVelocityDamping) {
    const vAxial = bob.velocity.x * ux + bob.velocity.y * uy;
    const damp = profile.axialVelocityDamping * bob.mass * vAxial * GRAVITY_SCALE;
    applyForceClamped(bob, -ux * damp, -uy * damp, maxForce);
  }

  if (profile.nonlinearStretchGain && strain > 0.02) {
    const vAxial = bob.velocity.x * ux + bob.velocity.y * uy;
    if (vAxial < 0) {
      const tx = -uy;
      const ty = ux;
      const vTan = bob.velocity.x * tx + bob.velocity.y * ty;
      const snap = strain * profile.nonlinearStretchGain * weight * 0.35;
      const sign = vTan >= 0 ? 1 : -1;
      applyForceClamped(bob, tx * snap * sign, ty * snap * sign, maxForce * 0.5);
    }
  }

  const speed = Math.hypot(bob.velocity.x, bob.velocity.y);
  if (speed > MAX_BOB_SPEED) {
    const scale = MAX_BOB_SPEED / speed;
    Matter.Body.setVelocity(bob, {
      x: bob.velocity.x * scale,
      y: bob.velocity.y * scale,
    });
  }
}

export function formatStretchBudget(profile: AttachmentMaterialProfile): string {
  const pct = (profile.maxStretchRatio - 1) * 100;
  if (profile.rigid) return "rigid";
  if (pct >= 50) return `+${pct.toFixed(0)}%`;
  if (pct >= 1) return `+${pct.toFixed(1)}%`;
  return `+${(pct * 10).toFixed(0)}‰`;
}

export const REFERENCE_BOB_MASS = 2.2;
export const REFERENCE_GRAVITY = 1;

export function resolveAttachmentDefPhysics(
  attachment: AttachmentDef
): Pick<AttachmentDef, "stiffness" | "damping"> {
  const profile = getMaterialProfile(attachment);
  return resolveConstraintParams(
    profile,
    attachment.length,
    REFERENCE_BOB_MASS,
    REFERENCE_GRAVITY
  );
}
