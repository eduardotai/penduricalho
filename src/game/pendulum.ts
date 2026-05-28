import Matter from "matter-js";
import type { AttachmentDef, PendulumDef, Vec2 } from "../types";
import {
  applyAttachmentPhysics,
  attachmentMass,
  createAttachmentPhysicsState,
  recommendedConstraintIterations,
  resolveConstraintParams,
  type AttachmentPhysicsState,
} from "./attachmentPhysics";
import {
  applyRopeMaterialForces,
  createRopePhysicsState,
  resolveRopeMaterial,
  ropeSegmentCount,
  type RopePhysicsState,
} from "./rope";
import { WORLD_SCALE } from "./worldConstants";

const PIVOT_RADIUS = 8;
const DEFAULT_BOB_RADIUS = Math.round(16 * WORLD_SCALE);

export interface PendulumHandle {
  pivot: Matter.Body;
  /** Lightweight rope nodes between anchor and the bob chain. */
  ropeSegments: Matter.Body[];
  bobs: Matter.Body[];
  chainBobs: Matter.Body[];
  constraints: Matter.Constraint[];
  composite: Matter.Composite;
  attachment: AttachmentDef;
  pendulum: PendulumDef;
  baseMass: number;
  bobRadiusScale: number;
  ropeLengthScale: number;
  physics: AttachmentPhysicsState;
  ropePhysics: RopePhysicsState;
  /** True while the rope is broken and the bobs are flying free. */
  snapped: boolean;
  /** Bob-link constraints removed on snap, kept so restoreRope can re-add them. */
  savedLinks: Matter.Constraint[];
}

export function bobRadius(pendulum: PendulumDef): number {
  return pendulum.bobRadius ?? DEFAULT_BOB_RADIUS;
}

function buildRopeChain(
  composite: Matter.Composite,
  pivot: Matter.Body,
  anchor: Vec2,
  ropeLength: number,
  material: ReturnType<typeof resolveRopeMaterial>,
  nodeMass: number,
  stiffness: number,
  damping: number,
  constraints: Matter.Constraint[],
  ropeSegments: Matter.Body[],
  extraLinks: number = 0
): Matter.Body {
  const segCount = ropeSegmentCount(ropeLength, material, extraLinks);
  const segLen = ropeLength / segCount;
  let prev: Matter.Body = pivot;

  for (let i = 0; i < segCount; i++) {
    const y = anchor.y + segLen * (i + 1);
    const node = Matter.Bodies.circle(anchor.x, y, material.nodeRadius, {
      label: `rope-${i}`,
      frictionAir: material.frictionAir,
      restitution: 0.1,
    });
    Matter.Body.setMass(node, nodeMass);
    Matter.Composite.add(composite, node);
    ropeSegments.push(node);

    const link = Matter.Constraint.create({
      bodyA: prev,
      bodyB: node,
      length: segLen,
      stiffness: material.stiffness,
      damping: material.damping,
      label: `rope-${i}`,
    });
    Matter.Composite.add(composite, link);
    constraints.push(link);
    prev = node;
  }

  return prev;
}

export function buildPendulum(
  world: Matter.World,
  pendulum: PendulumDef,
  attachment: AttachmentDef,
  anchor: Vec2,
  weightScale: number = 1,
  gravityY: number = 1
): PendulumHandle {
  const composite = Matter.Composite.create({ label: "rope-rig" });
  const profile = createAttachmentPhysicsState(
    attachment,
    attachment.length,
    pendulum.weight * weightScale,
    gravityY
  ).profile;
  const ropeMaterial = resolveRopeMaterial(attachment);

  const pivot = Matter.Bodies.circle(anchor.x, anchor.y, PIVOT_RADIUS, {
    isStatic: true,
    label: "pivot",
    render: { visible: false },
  });
  Matter.Composite.add(composite, pivot);

  const bobs: Matter.Body[] = [];
  const ropeSegments: Matter.Body[] = [];
  const chainBobs: Matter.Body[] = [];
  const constraints: Matter.Constraint[] = [];
  const baseMass = pendulum.weight / pendulum.bobCount;
  const attachMass = attachmentMass(profile, attachment.length);
  const ropeNodeMass = Math.max(0.15, baseMass * ropeMaterial.nodeMassRatio * weightScale);
  const radius = bobRadius(pendulum);
  const extraLinks = Math.max(0, pendulum.bobCount - 1);
  const restLength =
    extraLinks === 0
      ? attachment.length
      : attachment.length + pendulum.bobSpacing * extraLinks;
  const { stiffness, damping } = resolveConstraintParams(
    profile,
    restLength,
    pendulum.weight * weightScale,
    gravityY
  );

  if (extraLinks === 0) {
    const bobLinkLen = Math.max(radius * 0.35, 4);
    const bob = Matter.Bodies.circle(
      anchor.x,
      anchor.y + attachment.length + bobLinkLen,
      radius,
      {
        label: "bob-0",
        density: 0.001 * baseMass * weightScale,
        frictionAir: 0.005,
        restitution: 0.3,
      }
    );
    Matter.Body.setMass(bob, baseMass * weightScale + attachMass);
    Matter.Composite.add(composite, bob);
    bobs.push(bob);

    const ropeTail = buildRopeChain(
      composite,
      pivot,
      anchor,
      attachment.length,
      ropeMaterial,
      ropeNodeMass,
      stiffness,
      damping,
      constraints,
      ropeSegments
    );

    const bobLink = Matter.Constraint.create({
      bodyA: ropeTail,
      bodyB: bob,
      length: bobLinkLen,
      stiffness: Math.min(1, stiffness + 0.05),
      damping,
      label: "rope-bob",
    });
    Matter.Composite.add(composite, bobLink);
    constraints.push(bobLink);
  } else {
    const chainLen = pendulum.bobSpacing * extraLinks;
    const totalRopeLength = attachment.length + chainLen;

    for (let i = 0; i < extraLinks; i++) {
      const chainBob = Matter.Bodies.circle(
        anchor.x,
        anchor.y + attachment.length + pendulum.bobSpacing * i,
        radius,
        { label: `bob-${i}`, isSensor: true, isStatic: true, frictionAir: 0 }
      );
      Matter.Composite.add(composite, chainBob);
      chainBobs.push(chainBob);
    }

    const tipBob = Matter.Bodies.circle(anchor.x, anchor.y + totalRopeLength, radius, {
      label: `bob-${pendulum.bobCount - 1}`,
      density: 0.001 * pendulum.weight * weightScale,
      frictionAir: 0.005,
      restitution: 0.3,
    });
    Matter.Body.setMass(tipBob, pendulum.weight * weightScale + attachMass);
    Matter.Composite.add(composite, tipBob);
    bobs.push(tipBob);

    const bobLinkLen = Math.max(radius * 0.35, 4);
    const ropeTail = buildRopeChain(
      composite,
      pivot,
      anchor,
      totalRopeLength,
      ropeMaterial,
      ropeNodeMass,
      stiffness,
      damping,
      constraints,
      ropeSegments,
      extraLinks
    );

    const tipLink = Matter.Constraint.create({
      bodyA: ropeTail,
      bodyB: tipBob,
      length: bobLinkLen,
      stiffness: Math.min(1, stiffness + 0.05),
      damping,
      label: "rope-bob",
    });
    Matter.Composite.add(composite, tipLink);
    constraints.push(tipLink);
  }

  Matter.World.add(world, composite);

  const physics = createAttachmentPhysicsState(
    attachment,
    restLength,
    pendulum.weight * weightScale,
    gravityY
  );

  const ropePhysics = createRopePhysicsState(
    ropeMaterial,
    constraints.filter((c) => c.label?.startsWith("rope-"))
  );

  return {
    pivot,
    ropeSegments,
    bobs,
    chainBobs,
    constraints,
    composite,
    attachment,
    pendulum,
    baseMass,
    bobRadiusScale: 1,
    ropeLengthScale: 1,
    physics,
    ropePhysics,
    snapped: false,
    savedLinks: [],
  };
}

export function getMainAttachmentConstraint(handle: PendulumHandle): Matter.Constraint | null {
  return (
    handle.constraints.find((c) => c.label === "rope-bob") ??
    handle.constraints[handle.constraints.length - 1] ??
    null
  );
}

export function getOrderedBobBodies(handle: PendulumHandle): Matter.Body[] {
  return handle.chainBobs.length > 0
    ? [...handle.chainBobs, ...handle.bobs]
    : handle.bobs;
}

function ropePolyline(handle: PendulumHandle): Vec2[] {
  const pivot = handle.pivot.position;
  const points: Vec2[] = [{ x: pivot.x, y: pivot.y }];
  for (const node of handle.ropeSegments) {
    if (
      !Number.isFinite(node.position.x) ||
      !Number.isFinite(node.position.y)
    ) {
      continue;
    }
    points.push({ x: node.position.x, y: node.position.y });
  }
  return points;
}

function polylineArcLength(points: Vec2[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );
  }
  return len;
}

/** Point and tangent angle at a given arc length along a polyline. */
function samplePolyline(
  points: Vec2[],
  targetDist: number
): { x: number; y: number; angle: number } {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1 || targetDist <= 0) {
    const next = points[Math.min(1, points.length - 1)];
    const angle = Math.atan2(next.y - points[0].y, next.x - points[0].x);
    return { x: points[0].x, y: points[0].y, angle };
  }

  let traveled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (traveled + segLen >= targetDist || i === points.length - 1) {
      const t = segLen > 0 ? Math.min(1, (targetDist - traveled) / segLen) : 0;
      return { x: a.x + dx * t, y: a.y + dy * t, angle: Math.atan2(dy, dx) };
    }
    traveled += segLen;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    x: last.x,
    y: last.y,
    angle: Math.atan2(last.y - prev.y, last.x - prev.x),
  };
}

export function positionChainBobs(handle: PendulumHandle) {
  if (handle.chainBobs.length === 0) return;
  const tip = handle.bobs[handle.bobs.length - 1];
  const pivot = handle.pivot.position;
  const scaledAttach = handle.attachment.length * handle.ropeLengthScale;
  const nominalTotal =
    scaledAttach + handle.pendulum.bobSpacing * handle.chainBobs.length;

  const polyline = ropePolyline(handle);
  const ropeArcLen = polylineArcLength(polyline);

  if (ropeArcLen > 1 && polyline.length > 1) {
    for (let i = 0; i < handle.chainBobs.length; i++) {
      const nominalAlong = scaledAttach + handle.pendulum.bobSpacing * i;
      const targetDist = (nominalAlong / nominalTotal) * ropeArcLen;
      const sample = samplePolyline(polyline, targetDist);
      const bob = handle.chainBobs[i];
      Matter.Body.setPosition(bob, { x: sample.x, y: sample.y });
      Matter.Body.setAngle(bob, sample.angle);
      Matter.Body.setVelocity(bob, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(bob, 0);
    }
    return;
  }

  // Fallback: straight pivot-to-tip line when rope nodes are unavailable.
  const dx = tip.position.x - pivot.x;
  const dy = tip.position.y - pivot.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const stretch = dist / nominalTotal;

  for (let i = 0; i < handle.chainBobs.length; i++) {
    const nominalAlong = scaledAttach + handle.pendulum.bobSpacing * i;
    const r = nominalAlong * stretch;
    const bob = handle.chainBobs[i];
    Matter.Body.setPosition(bob, { x: pivot.x + ux * r, y: pivot.y + uy * r });
    Matter.Body.setAngle(bob, Math.atan2(dy, dx));
    Matter.Body.setVelocity(bob, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(bob, 0);
  }
}

export function destroyPendulum(world: Matter.World, handle: PendulumHandle) {
  Matter.World.remove(world, handle.composite, true);
}

function setBodySensor(body: Matter.Body, isSensor: boolean) {
  body.isSensor = isSensor;
  for (const part of body.parts) part.isSensor = isSensor;
}

// Outward + random scatter kick layered on top of each bob's carried momentum
// when the rope breaks. World-scaled so it reads the same at any zoom.
const SNAP_BASE_KICK = 6 * WORLD_SCALE;
const SNAP_RANDOM_KICK = 8 * WORLD_SCALE;

/**
 * Break the rope: detach the bob chain from the line and fling every scoring
 * bob free, keeping the momentum it had plus an outward scatter so the bobs
 * spray across the playfield. Freed bobs stay labelled `bob-*` so the existing
 * zone-hit and token-collection paths keep scoring them as they bounce.
 */
export function snapRope(handle: PendulumHandle) {
  if (handle.snapped) return;
  handle.snapped = true;

  const pivot = handle.pivot.position;
  const tip = handle.bobs[handle.bobs.length - 1];
  const tipVel = tip ? { x: tip.velocity.x, y: tip.velocity.y } : { x: 0, y: 0 };

  // Detach the bob-link constraint(s) so the tip bob is no longer held by the
  // rope. Keep them so restoreRope can re-string the rig between runs.
  for (let i = handle.constraints.length - 1; i >= 0; i--) {
    const c = handle.constraints[i];
    if (c.label === "rope-bob") {
      Matter.Composite.remove(handle.composite, c, true);
      handle.savedLinks.push(c);
      handle.constraints.splice(i, 1);
    }
  }

  // Chain bobs were static sensors riding the rope — turn them into free
  // dynamic projectiles that inherit a share of the swing's momentum.
  for (const chainBob of handle.chainBobs) {
    Matter.Body.setStatic(chainBob, false);
    setBodySensor(chainBob, false);
    chainBob.frictionAir = 0.006;
    chainBob.restitution = 0.5;
    // A body *created* with `isStatic: true` carries a bogus inertia that
    // setStatic(false) "restores" as null → NaN. Matter then silently skips
    // that body's collision response, so a freed chain bob falls straight
    // through the boundary walls and out of the world: it never bounces back
    // to score, and its endless free-fall keeps the run from ever stalling or
    // ending (Run Again stays disabled). Re-derive a real circle inertia +
    // friction so the freed bob collides, bounces, and stays in play.
    const r = chainBob.circleRadius ?? getEffectiveBobRadius(handle);
    const mass = Math.max(0.5, handle.baseMass);
    Matter.Body.setMass(chainBob, mass);
    Matter.Body.setInertia(chainBob, Math.max(1, mass * r * r));
    chainBob.friction = 0.05;
    Matter.Body.setVelocity(chainBob, { x: tipVel.x * 0.6, y: tipVel.y * 0.6 });
    Matter.Body.setAngularVelocity(chainBob, (Math.random() - 0.5) * 0.4);
  }

  for (const bob of getOrderedBobBodies(handle)) {
    bob.restitution = 0.5;
    const rx = bob.position.x - pivot.x;
    const ry = bob.position.y - pivot.y;
    const r = Math.hypot(rx, ry) || 1;
    const ang = Math.random() * Math.PI * 2;
    Matter.Body.setVelocity(bob, {
      x: bob.velocity.x + (rx / r) * SNAP_BASE_KICK + Math.cos(ang) * SNAP_RANDOM_KICK,
      y: bob.velocity.y + (ry / r) * SNAP_BASE_KICK + Math.sin(ang) * SNAP_RANDOM_KICK,
    });
  }
}

/** Re-string a snapped rig back to its intact, at-rest pose for the next run. */
export function restoreRope(handle: PendulumHandle) {
  if (!handle.snapped) return;

  for (const c of handle.savedLinks) {
    Matter.Composite.add(handle.composite, c);
    handle.constraints.push(c);
  }
  handle.savedLinks.length = 0;

  for (const chainBob of handle.chainBobs) {
    Matter.Body.setStatic(chainBob, true);
    setBodySensor(chainBob, true);
    chainBob.frictionAir = 0;
  }
  for (const bob of handle.bobs) {
    bob.restitution = 0.3;
  }

  handle.snapped = false;
  resetPendulumToRest(handle);
}

export function syncAttachmentConstraintPhysics(
  handle: PendulumHandle,
  bobMass: number,
  gravityY: number
) {
  const link = getMainAttachmentConstraint(handle);
  if (!link) return;
  handle.physics.bobMass = bobMass;
  handle.physics.gravityY = gravityY;
  const restLength =
    handle.attachment.length * handle.ropeLengthScale +
    handle.pendulum.bobSpacing * Math.max(0, handle.pendulum.bobCount - 1);
  const { stiffness, damping } = resolveConstraintParams(
    handle.physics.profile,
    restLength,
    bobMass,
    gravityY
  );
  link.stiffness = stiffness;
  link.damping = damping;
}

export function tickAttachmentPhysics(handle: PendulumHandle) {
  if (handle.ropeSegments.length > 0) {
    applyRopeMaterialForces(
      handle.ropeSegments,
      handle.constraints,
      handle.ropePhysics
    );
    handle.physics.stretchRatio = handle.ropePhysics.stretchRatio;
    stabilizeRopeBodies(handle);
    return;
  }

  applyAttachmentPhysics(handle, handle.physics);
}

export function attachmentConstraintIterations(handle: PendulumHandle): number {
  return recommendedConstraintIterations(handle.physics.profile);
}

export function setPendulumWeightScale(handle: PendulumHandle, scale: number) {
  const material = handle.ropePhysics.profile;
  const nodeMass = Math.max(0.15, handle.baseMass * material.nodeMassRatio * scale);
  for (const node of handle.ropeSegments) {
    Matter.Body.setMass(node, nodeMass);
  }

  const attachMass = attachmentMass(
    handle.physics.profile,
    getMainAttachmentConstraint(handle)?.length ?? handle.attachment.length
  );
  if (handle.chainBobs.length > 0) {
    Matter.Body.setMass(handle.bobs[0], handle.pendulum.weight * scale + attachMass);
  } else {
    for (const bob of handle.bobs) {
      Matter.Body.setMass(bob, handle.baseMass * scale + attachMass / handle.bobs.length);
    }
  }
  syncAttachmentConstraintPhysics(handle, handle.pendulum.weight * scale, handle.physics.gravityY);
}

export function setBobRadiusScale(handle: PendulumHandle, targetScale: number) {
  const clamped = Math.max(0.4, Math.min(3, targetScale));
  if (Math.abs(clamped - handle.bobRadiusScale) < 0.001) return;
  const factor = clamped / handle.bobRadiusScale;
  for (const bob of getOrderedBobBodies(handle)) {
    Matter.Body.scale(bob, factor, factor);
  }
  handle.bobRadiusScale = clamped;
}

export function setRopeLengthScale(handle: PendulumHandle, targetScale: number) {
  const clamped = Math.max(0.3, Math.min(2.5, targetScale));
  if (Math.abs(clamped - handle.ropeLengthScale) < 0.001) return;

  const extraLinks = Math.max(0, handle.pendulum.bobCount - 1);
  const chainLen = handle.pendulum.bobSpacing * extraLinks;
  const scaledAttach = handle.attachment.length * clamped;
  const totalRopeLen = scaledAttach + chainLen;
  const segCount = handle.ropeSegments.length;
  if (segCount > 0) {
    const segLen = totalRopeLen / segCount;
    for (const c of handle.constraints) {
      if (!c.label?.startsWith("rope-")) continue;
      c.length = segLen;
      handle.ropePhysics.restLengths.set(c, segLen);
    }
  }

  const link = getMainAttachmentConstraint(handle);
  if (link) {
    link.length = Math.max(getEffectiveBobRadius(handle) * 0.35, 4);
    handle.physics.restLength = totalRopeLen;
    syncAttachmentConstraintPhysics(
      handle,
      handle.physics.bobMass,
      handle.physics.gravityY
    );
  }

  handle.ropeLengthScale = clamped;
}

export function getEffectiveBobRadius(handle: PendulumHandle): number {
  return bobRadius(handle.pendulum) * handle.bobRadiusScale;
}

/** Hang the rig straight down with zero motion — used before Start / Run Again. */
export function resetPendulumToRest(handle: PendulumHandle) {
  const pivot = handle.pivot.position;
  const bob = handle.bobs[handle.bobs.length - 1];
  if (!bob) return;

  const extraLinks = Math.max(0, handle.pendulum.bobCount - 1);
  const chainLen = handle.pendulum.bobSpacing * extraLinks;
  const restLength = handle.attachment.length * handle.ropeLengthScale;
  const totalRopeLen = restLength + chainLen;
  const segCount = handle.ropeSegments.length;
  const segLen = segCount > 0 ? totalRopeLen / segCount : totalRopeLen;
  const bobLinkLen =
    getMainAttachmentConstraint(handle)?.length ??
    Math.max(4, getEffectiveBobRadius(handle) * 0.35);
  const tipRestY = pivot.y + totalRopeLen + bobLinkLen;

  for (let i = 0; i < segCount; i++) {
    const node = handle.ropeSegments[i];
    Matter.Body.setPosition(node, {
      x: pivot.x,
      y: pivot.y + segLen * (i + 1),
    });
    Matter.Body.setVelocity(node, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(node, 0);
  }

  Matter.Body.setPosition(bob, { x: pivot.x, y: tipRestY });
  Matter.Body.setVelocity(bob, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(bob, 0);

  for (const chainBob of handle.chainBobs) {
    Matter.Body.setVelocity(chainBob, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(chainBob, 0);
  }
  for (const other of handle.bobs) {
    if (other === bob) continue;
    Matter.Body.setVelocity(other, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(other, 0);
  }

  positionChainBobs(handle);
  handle.physics.stretchRatio = 1;
  handle.ropePhysics.stretchRatio = 1;
}

/**
 * Idle pose for a snapped rig on a wall-less site (the Workshop): the bobs have
 * flown clean off the field, so there's nothing to bring back. We leave the rig
 * snapped and present a clean, empty rope hanging straight down from the pivot,
 * while freezing the freed bobs in place (off-field) so the runner's gravity
 * doesn't drift them to infinity. Call every idle frame — like
 * resetPendulumToRest it overwrites the runner's between-frame jitter, but
 * unlike it, it deliberately does NOT pull the bobs back onto the rope.
 */
export function settleEmptyRope(handle: PendulumHandle) {
  const pivot = handle.pivot.position;
  const restLength = handle.attachment.length * handle.ropeLengthScale;
  const segCount = handle.ropeSegments.length;
  const segLen = segCount > 0 ? restLength / segCount : restLength;
  for (let i = 0; i < segCount; i++) {
    const node = handle.ropeSegments[i];
    Matter.Body.setPosition(node, { x: pivot.x, y: pivot.y + segLen * (i + 1) });
    Matter.Body.setVelocity(node, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(node, 0);
  }
  // Freeze the escaped bobs where they are (off-field) so they read as "gone"
  // and don't accelerate to huge coordinates while the rig idles.
  for (const bob of getOrderedBobBodies(handle)) {
    Matter.Body.setVelocity(bob, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(bob, 0);
  }
  handle.physics.stretchRatio = 1;
  handle.ropePhysics.stretchRatio = 1;
}

function stabilizeRopeBodies(handle: PendulumHandle) {
  const bob = handle.bobs[handle.bobs.length - 1];
  if (!bob) return;

  const bobBad =
    !Number.isFinite(bob.position.x) ||
    !Number.isFinite(bob.position.y) ||
    !Number.isFinite(bob.velocity.x) ||
    !Number.isFinite(bob.velocity.y);

  let ropeBad = false;
  for (const node of handle.ropeSegments) {
    if (
      !Number.isFinite(node.position.x) ||
      !Number.isFinite(node.position.y) ||
      !Number.isFinite(node.velocity.x) ||
      !Number.isFinite(node.velocity.y)
    ) {
      ropeBad = true;
      break;
    }
  }

  if (!bobBad && !ropeBad) return;
  resetPendulumToRest(handle);
}

/** Apply only the new portion of a linear speed-ramp boost (never compounds). */
export function applySpeedRampDelta(
  handle: PendulumHandle,
  targetMult: number,
  appliedMult: number
) {
  if (targetMult <= appliedMult + 0.0001) return appliedMult;
  const delta = targetMult / appliedMult;
  const MAX_RAMP_SPEED = 52;
  for (const bob of handle.bobs) {
    let vx = bob.velocity.x * delta;
    let vy = bob.velocity.y * delta;
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_RAMP_SPEED) {
      const scale = MAX_RAMP_SPEED / speed;
      vx *= scale;
      vy *= scale;
    }
    Matter.Body.setVelocity(bob, { x: vx, y: vy });
  }
  return targetMult;
}

/**
 * Cap how fast each bob may rotate around the pivot. `maxAngularVelocity` is in
 * radians per physics step: ω = tangential_speed / radius, so we only throttle
 * the rotational (tangential) part of the velocity and leave the radial part
 * (rope stretch/contraction) untouched. This is what makes small bobs feel
 * quick and heavy bobs feel slow — the swing top-speed is bounded per pendulum.
 */
export function clampAngularVelocity(handle: PendulumHandle, maxAngularVelocity: number) {
  if (!(maxAngularVelocity > 0)) return;
  const pivot = handle.pivot.position;
  for (const bob of handle.bobs) {
    const rx = bob.position.x - pivot.x;
    const ry = bob.position.y - pivot.y;
    const r = Math.hypot(rx, ry);
    if (r < 1) continue;
    const ux = rx / r;
    const uy = ry / r;
    const vx = bob.velocity.x;
    const vy = bob.velocity.y;
    // Split velocity into radial (along rope) + tangential (around pivot).
    const vRad = vx * ux + vy * uy;
    const tvx = vx - vRad * ux;
    const tvy = vy - vRad * uy;
    const tMag = Math.hypot(tvx, tvy);
    if (tMag < 1e-6) continue;
    const omega = tMag / r;
    if (omega <= maxAngularVelocity) continue;
    const scale = (maxAngularVelocity * r) / tMag;
    Matter.Body.setVelocity(bob, {
      x: vRad * ux + tvx * scale,
      y: vRad * uy + tvy * scale,
    });
  }
}

/** Tiny impulse on the rope tail — bob velocity already drives the swing. */
export function propagateRopeWhip(handle: PendulumHandle, force: Vec2, gain = 0.05) {
  if (handle.ropeSegments.length === 0) return;
  const tail = handle.ropeSegments[handle.ropeSegments.length - 1];
  const mag = Math.hypot(force.x, force.y);
  const cap = 2;
  const scale = mag > cap ? cap / mag : 1;
  Matter.Body.applyForce(tail, tail.position, {
    x: force.x * gain * scale,
    y: force.y * gain * scale,
  });
}

export function nudgeBob(bob: Matter.Body, force: Vec2) {
  Matter.Body.applyForce(bob, bob.position, force);
}

/**
 * Natural air resistance for a winding-down rig. Soft rope constraints under
 * gravity never fully come to rest on their own — they trade a little energy
 * back and forth and jitter ("bounce") indefinitely at low speed. Real air drag
 * is a gentle velocity-proportional force, so we bleed velocity on an
 * exponential envelope: `rate` is the decay constant in 1/seconds (≈1.2 gives a
 * ~0.8s time constant, i.e. amplitude visibly coasting down over a few seconds,
 * the way a real pendulum settles — not an abrupt brake). `dt` is the frame
 * delta in ms, so the decay is frame-rate independent.
 */
export function dampPendulumMotion(handle: PendulumHandle, dt: number, rate = 1.2) {
  const keep = Math.exp(-rate * (dt / 1000));
  const damp = (body: Matter.Body) => {
    Matter.Body.setVelocity(body, {
      x: body.velocity.x * keep,
      y: body.velocity.y * keep,
    });
    Matter.Body.setAngularVelocity(body, body.angularVelocity * keep);
  };
  for (const bob of handle.bobs) damp(bob);
  for (const node of handle.ropeSegments) damp(node);
}

/**
 * Smoothly pull the rig toward its hanging-rest pose. Velocity damping alone
 * cannot fully kill the residual rope-spring jitter at the tail of a run: the
 * constraint solver keeps trickling kinetic energy back from gravity-vs-spring
 * trade-back, so the rope appears to "bounce" forever even when the bob is
 * essentially still. Blending each rope node and the bob toward their straight-
 * down rest positions neutralizes that potential-energy oscillation directly.
 *
 * `alpha` is the per-frame blend toward rest in [0, 1]; small values (<0.1)
 * give a soft visual settle that tracks ambient damping rather than snapping.
 * Velocity is bled in lockstep so the constraint solver can't immediately undo
 * the position update on the next step.
 */
export function settlePendulumTowardRest(handle: PendulumHandle, alpha: number) {
  if (!(alpha > 0)) return;
  const a = Math.min(1, alpha);
  const keep = 1 - a;
  const tipBob = handle.bobs[handle.bobs.length - 1];
  if (!tipBob) return;

  const pivot = handle.pivot.position;
  const extraLinks = Math.max(0, handle.pendulum.bobCount - 1);
  const chainLen = handle.pendulum.bobSpacing * extraLinks;
  const restLength = handle.attachment.length * handle.ropeLengthScale;
  const totalRopeLen = restLength + chainLen;
  const segCount = handle.ropeSegments.length;
  const segLen = segCount > 0 ? totalRopeLen / segCount : totalRopeLen;
  const bobLinkLen =
    getMainAttachmentConstraint(handle)?.length ??
    Math.max(4, getEffectiveBobRadius(handle) * 0.35);
  const tipRestY = pivot.y + totalRopeLen + bobLinkLen;

  const lerpTo = (body: Matter.Body, restX: number, restY: number) => {
    Matter.Body.setPosition(body, {
      x: body.position.x + (restX - body.position.x) * a,
      y: body.position.y + (restY - body.position.y) * a,
    });
    Matter.Body.setVelocity(body, {
      x: body.velocity.x * keep,
      y: body.velocity.y * keep,
    });
    Matter.Body.setAngularVelocity(body, body.angularVelocity * keep);
  };

  for (let i = 0; i < segCount; i++) {
    lerpTo(handle.ropeSegments[i], pivot.x, pivot.y + segLen * (i + 1));
  }
  lerpTo(tipBob, pivot.x, tipRestY);

  // Other bobs (multi-bob chain head) ride the rope via positionChainBobs,
  // so we only need to bleed their velocity here.
  for (const other of handle.bobs) {
    if (other === tipBob) continue;
    Matter.Body.setVelocity(other, {
      x: other.velocity.x * keep,
      y: other.velocity.y * keep,
    });
    Matter.Body.setAngularVelocity(other, other.angularVelocity * keep);
  }
}

/** Total reach from anchor through rope and bob chain. */
export function rigReach(handle: PendulumHandle): number {
  return (
    handle.attachment.length * handle.ropeLengthScale +
    handle.pendulum.bobSpacing * Math.max(0, handle.pendulum.bobCount - 1)
  );
}
