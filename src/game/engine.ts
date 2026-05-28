import Matter from "matter-js";
import type { WallMode } from "../types";

export interface EngineHandle {
  engine: Matter.Engine;
  world: Matter.World;
  runner: Matter.Runner;
  width: number;
  height: number;
}

export function createEngine(width: number, height: number): EngineHandle {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 1, scale: 0.001 },
    enableSleeping: false,
    constraintIterations: 4,
    positionIterations: 10,
    velocityIterations: 8,
  });
  const runner = Matter.Runner.create({
    isFixed: true,
    delta: 1000 / 60,
  });
  Matter.Runner.run(runner, engine);

  return {
    engine,
    world: engine.world,
    runner,
    width,
    height,
  };
}

export function destroyEngine(handle: EngineHandle) {
  Matter.Runner.stop(handle.runner);
  Matter.World.clear(handle.world, false);
  Matter.Engine.clear(handle.engine);
}

export function setGravity(handle: EngineHandle, gravityY: number) {
  handle.engine.gravity.y = gravityY;
}

export function applyAmbientForce(
  handle: EngineHandle,
  bodies: Matter.Body[],
  force: { x: number; y: number }
) {
  for (const body of bodies) {
    Matter.Body.applyForce(body, body.position, force);
  }
}

export type WallSide = "top" | "bottom" | "left" | "right";

export interface BoundaryWall {
  body: Matter.Body;
  side: WallSide;
  /** Inward unit normal — the direction that pushes a bob back into the field. */
  normal: { x: number; y: number };
  /** Remaining hits before a breakable wall shatters. */
  hp: number;
  broken: boolean;
}

export interface WallField {
  walls: BoundaryWall[];
  /** True only for the "breakable" mode — drives the shatter logic. */
  breakable: boolean;
}

/** Hits a breakable wall absorbs before it shatters. */
export const WALL_MAX_HP = 3;

/**
 * Static boundary walls just inside the virtual playfield. Freed bobs from a
 * rope snap bounce off these instead of escaping into the void. Walls are
 * deliberately thick so fast bobs can't tunnel through between physics steps.
 * `mode` controls whether walls exist at all and whether they can be shattered.
 */
export function createWallField(
  world: Matter.World,
  width: number,
  height: number,
  mode: WallMode = "none"
): WallField {
  if (mode === "none") return { walls: [], breakable: false };
  const breakable = mode === "breakable";
  const thickness = 200;
  const half = thickness / 2;
  const opts = {
    isStatic: true,
    restitution: 0.6,
    friction: 0.05,
    label: "wall",
  };
  const defs: { side: WallSide; normal: { x: number; y: number }; body: Matter.Body }[] = [
    {
      side: "top",
      normal: { x: 0, y: 1 },
      body: Matter.Bodies.rectangle(width / 2, -half, width + thickness * 2, thickness, opts),
    },
    {
      side: "bottom",
      normal: { x: 0, y: -1 },
      body: Matter.Bodies.rectangle(width / 2, height + half, width + thickness * 2, thickness, opts),
    },
    {
      side: "left",
      normal: { x: 1, y: 0 },
      body: Matter.Bodies.rectangle(-half, height / 2, thickness, height + thickness * 2, opts),
    },
    {
      side: "right",
      normal: { x: -1, y: 0 },
      body: Matter.Bodies.rectangle(width + half, height / 2, thickness, height + thickness * 2, opts),
    },
  ];
  const walls: BoundaryWall[] = defs.map((d) => ({
    body: d.body,
    side: d.side,
    normal: d.normal,
    hp: WALL_MAX_HP,
    broken: false,
  }));
  Matter.World.add(world, walls.map((w) => w.body));
  return { walls, breakable };
}

export function destroyWallField(world: Matter.World, field: WallField) {
  for (const wall of field.walls) {
    if (!wall.broken) Matter.World.remove(world, wall.body);
  }
  field.walls = [];
}

export function findWallByBody(
  field: WallField,
  body: Matter.Body
): BoundaryWall | null {
  for (const wall of field.walls) {
    if (wall.body === body) return wall;
  }
  return null;
}

/**
 * Land one hit on a breakable wall. Returns true if the wall shattered (and was
 * removed from the world). No-op on solid/none fields or an already-broken wall.
 */
export function damageWall(
  world: Matter.World,
  field: WallField,
  wall: BoundaryWall
): boolean {
  if (!field.breakable || wall.broken) return false;
  wall.hp -= 1;
  if (wall.hp > 0) return false;
  wall.broken = true;
  Matter.World.remove(world, wall.body);
  return true;
}
