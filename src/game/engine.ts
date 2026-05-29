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
  /** Full durability for this wall — scales with the rig's bob weight. */
  maxHp: number;
  broken: boolean;
}

export interface CageBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface WallField {
  walls: BoundaryWall[];
  /** True only for the "breakable" mode — drives the shatter logic. */
  breakable: boolean;
  /**
   * Inner rectangle the walls enclose. Equals the full playfield at cageScale 1
   * and grows with it. Used to contain bobs and to detect when a freed bob has
   * actually escaped the arena.
   */
  bounds: CageBounds;
}

/** Baseline hits a breakable wall absorbs (at the lightest rig). */
export const WALL_MAX_HP = 3;

/**
 * Wall durability scales with the rig's bob weight — heavier bobs slam harder,
 * so the arena's walls are built proportionally tougher to match them. A
 * featherweight wooden bob meets a flimsy wall; a tungsten heavy meets a
 * bunker. The per-map `durabilityMult` lets each site dial that baseline down
 * (or up) so a given arena's walls break in fewer hits. Floored at 2 so even
 * the lightest rig on the flimsiest map has to crack a wall before shattering
 * it — a wall should never break on the first contact.
 */
export function wallHpForWeight(bobWeight: number, durabilityMult = 1): number {
  return Math.max(2, Math.round(bobWeight * 1.6 * durabilityMult));
}

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
  mode: WallMode = "none",
  bobWeight = 1,
  cageScale = 1,
  durabilityMult = 1
): WallField {
  // The cage rectangle is scaled around the playfield center. At cageScale 1 it
  // hugs the field edges (the original Bumper Cage); larger values push the
  // walls outward for a roomier arena.
  const centerX = width / 2;
  const centerY = height / 2;
  const halfW = (width / 2) * cageScale;
  const halfH = (height / 2) * cageScale;
  const bounds: CageBounds = {
    minX: centerX - halfW,
    minY: centerY - halfH,
    maxX: centerX + halfW,
    maxY: centerY + halfH,
  };
  if (mode === "none") return { walls: [], breakable: false, bounds };
  const breakable = mode === "breakable";
  const maxHp = wallHpForWeight(bobWeight, durabilityMult);
  const thickness = 200;
  const half = thickness / 2;
  const cageW = bounds.maxX - bounds.minX;
  const cageH = bounds.maxY - bounds.minY;
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
      body: Matter.Bodies.rectangle(centerX, bounds.minY - half, cageW + thickness * 2, thickness, opts),
    },
    {
      side: "bottom",
      normal: { x: 0, y: -1 },
      body: Matter.Bodies.rectangle(centerX, bounds.maxY + half, cageW + thickness * 2, thickness, opts),
    },
    {
      side: "left",
      normal: { x: 1, y: 0 },
      body: Matter.Bodies.rectangle(bounds.minX - half, centerY, thickness, cageH + thickness * 2, opts),
    },
    {
      side: "right",
      normal: { x: -1, y: 0 },
      body: Matter.Bodies.rectangle(bounds.maxX + half, centerY, thickness, cageH + thickness * 2, opts),
    },
  ];
  const walls: BoundaryWall[] = defs.map((d) => ({
    body: d.body,
    side: d.side,
    normal: d.normal,
    hp: maxHp,
    maxHp,
    broken: false,
  }));
  Matter.World.add(world, walls.map((w) => w.body));
  return { walls, breakable, bounds };
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

/**
 * Fully restore every wall in the field: shattered walls are re-added to the
 * world and all walls have their durability topped back up. Used when a Golden
 * Token is spent — the arena resets to pristine alongside the re-strung rope.
 */
export function regenerateWallField(world: Matter.World, field: WallField) {
  for (const wall of field.walls) {
    if (wall.broken) {
      Matter.World.add(world, wall.body);
      wall.broken = false;
    }
    wall.hp = wall.maxHp;
  }
}
