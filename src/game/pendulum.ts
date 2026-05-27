import Matter from "matter-js";
import type { AttachmentDef, PendulumDef, Vec2 } from "../types";

const BOB_BASE_RADIUS = 14;
const PIVOT_RADIUS = 8;

export interface PendulumHandle {
  pivot: Matter.Body;
  bobs: Matter.Body[];
  constraints: Matter.Constraint[];
  composite: Matter.Composite;
  attachment: AttachmentDef;
  pendulum: PendulumDef;
  baseMass: number;
}

export function bobRadius(pendulum: PendulumDef): number {
  return BOB_BASE_RADIUS + Math.min(10, Math.sqrt(pendulum.weight) * 2.2);
}

export function buildPendulum(
  world: Matter.World,
  pendulum: PendulumDef,
  attachment: AttachmentDef,
  anchor: Vec2,
  weightScale: number = 1
): PendulumHandle {
  const composite = Matter.Composite.create({ label: "pendulum" });

  const pivot = Matter.Bodies.circle(anchor.x, anchor.y, PIVOT_RADIUS, {
    isStatic: true,
    label: "pivot",
    render: { visible: false },
  });
  Matter.Composite.add(composite, pivot);

  const bobs: Matter.Body[] = [];
  const constraints: Matter.Constraint[] = [];
  const baseMass = pendulum.weight / pendulum.bobCount;
  const radius = bobRadius(pendulum);

  let prev: Matter.Body = pivot;
  for (let i = 0; i < pendulum.bobCount; i++) {
    const segmentLength = i === 0 ? attachment.length : pendulum.bobSpacing;
    const bob = Matter.Bodies.circle(
      anchor.x,
      anchor.y + (i === 0 ? attachment.length : attachment.length + pendulum.bobSpacing * i),
      radius,
      {
        label: `bob-${i}`,
        density: 0.001 * baseMass * weightScale,
        frictionAir: 0.01,
        restitution: 0.3,
      }
    );
    Matter.Body.setMass(bob, baseMass * weightScale);
    Matter.Composite.add(composite, bob);
    bobs.push(bob);

    const constraint = Matter.Constraint.create({
      bodyA: prev,
      bodyB: bob,
      length: segmentLength,
      stiffness: attachment.stiffness,
      damping: attachment.damping,
      label: `link-${i}`,
    });
    Matter.Composite.add(composite, constraint);
    constraints.push(constraint);

    prev = bob;
  }

  Matter.World.add(world, composite);

  return {
    pivot,
    bobs,
    constraints,
    composite,
    attachment,
    pendulum,
    baseMass,
  };
}

export function destroyPendulum(world: Matter.World, handle: PendulumHandle) {
  Matter.World.remove(world, handle.composite, true);
}

export function setPendulumWeightScale(handle: PendulumHandle, scale: number) {
  for (const bob of handle.bobs) {
    Matter.Body.setMass(bob, handle.baseMass * scale);
  }
}

export function nudgeBob(bob: Matter.Body, force: Vec2) {
  Matter.Body.applyForce(bob, bob.position, force);
}
