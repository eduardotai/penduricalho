import Matter from "matter-js";
import type { WallMode } from "../types";
import { COLLISION } from "./worldConstants";

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

export type BoundarySide = "top" | "bottom" | "left" | "right";
export type WallSide = BoundarySide | "ring";

export interface BoundaryWall {
  body: Matter.Body;
  side: WallSide;
  /** Inward unit normal — the direction that pushes a bob back into the field. */
  normal: { x: number; y: number };
  /** Remaining durability before a breakable wall shatters (may be fractional). */
  hp: number;
  /** Full durability for this wall — scales with the rig's bob weight. */
  maxHp: number;
  broken: boolean;
  /**
   * Ring-wall only: the segment's center angle (radians) around the field
   * center. Used by the swept tunneling guard to tell whether a fast bob
   * crossed a live segment or slipped through the ring's open gap.
   */
  angle?: number;
}

/**
 * One concentric ring of the Layers map, grouped for the swept (CCD) tunneling
 * guard. Because every ring is a circle centered on the mount, a bob tunneling
 * through shows up as its distance-from-center jumping across `radius` in a
 * single physics step.
 */
export interface RingDescriptor {
  /** Radius of this ring from the field center. */
  radius: number;
  /** Half a segment's tangential length — its reach along the ring's arc. */
  segHalfLen: number;
  /** Every segment on this ring; check `.broken` to find the live ones. */
  segments: BoundaryWall[];
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
  /**
   * Indestructible in-field obstacle bodies (the Layers map's concentric ring
   * walls). Empty on every ordinary site. These are masked to collide only with
   * BOB-category bodies, so the rope threads through them while bobs bounce off.
   */
  obstacles: BoundaryWall[];
  /**
   * Field center for the ring obstacles (the rope pivot). Set only on the
   * Layers map; undefined everywhere else.
   */
  ringCenter?: { x: number; y: number };
  /**
   * Concentric ring descriptors driving the swept tunneling guard. Empty on
   * every site that has no ring obstacles.
   */
  rings: RingDescriptor[];
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
  if (mode === "none") return { walls: [], breakable: false, bounds, obstacles: [], rings: [] };
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
  const defs: { side: BoundarySide; normal: { x: number; y: number }; body: Matter.Body }[] = [
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
  return { walls, breakable, bounds, obstacles: [], rings: [] };
}

/**
 * Pick the radii for the Layers map's rings — re-rolled every run so the layout
 * is never the same twice. Ring 0 is pinned at `innerRadius` and the last ring
 * at `outerRadius` (the edge); the interior rings get random fractions biased
 * toward the inner side by `spacingFalloff` (so the "cluster in the middle, wide
 * empty band out to the edge ring" shape holds on average while every gap still
 * varies). `minSpacing` floors the center-to-center gap, and each interior ring
 * is also capped so it can never crowd out the room reserved for the rings still
 * to be placed — guaranteeing a strictly increasing, never-glued set.
 */
export function computeRingRadii(
  ringCount: number,
  innerRadius: number,
  outerRadius: number,
  spacingFalloff = 1,
  minSpacing = 0
): number[] {
  if (ringCount <= 0) return [];
  if (ringCount === 1) return [outerRadius];
  const span = outerRadius - innerRadius;
  const interior: number[] = [];
  for (let i = 0; i < ringCount - 2; i++) {
    interior.push(Math.pow(Math.random(), spacingFalloff));
  }
  interior.sort((a, b) => a - b);

  const radii = [innerRadius];
  let prev = innerRadius;
  for (let i = 0; i < interior.length; i++) {
    const remainingAfter = interior.length - 1 - i; // interior rings still to place
    let r = innerRadius + span * interior[i];
    r = Math.max(r, prev + minSpacing); // never glue to the previous ring
    r = Math.min(r, outerRadius - minSpacing * (remainingAfter + 1)); // reserve room for the rest + edge
    radii.push(r);
    prev = r;
  }
  radii.push(outerRadius);
  return radii;
}

/**
 * Build the Layers map's concentric ring walls, centered on `center` (the rope
 * pivot, so the bob's orbit naturally crosses them). Each ring is a circle of
 * short rectangular segments with one rotating gap left open, so a swinging or
 * freed bob can thread through to the richer inner rings. Rings are static and
 * indestructible, and masked to COLLISION.OBSTACLE → BOB so the rope's segment
 * nodes pass straight through while the bobs ricochet. The created bodies are
 * added to the world and returned alongside per-ring descriptors for storage on
 * `WallField.obstacles` / `WallField.rings` (the latter drives the swept
 * tunneling guard so fast bobs can't slip through a layer between steps).
 */
export function createRingObstacles(
  world: Matter.World,
  center: { x: number; y: number },
  ringCount: number,
  innerRadius: number,
  outerRadius: number,
  thickness: number,
  bobWeight = 1,
  durabilityMult = 1,
  spacingFalloff = 1,
  minSpacing = 0
): { walls: BoundaryWall[]; rings: RingDescriptor[] } {
  const walls: BoundaryWall[] = [];
  const rings: RingDescriptor[] = [];
  const maxHp = wallHpForWeight(bobWeight, durabilityMult);
  // Radii are randomized per run (see computeRingRadii) so no two runs share a
  // layout, while still honoring the inner-cluster / outer-band shape and the
  // minimum spacing.
  const radii = computeRingRadii(ringCount, innerRadius, outerRadius, spacingFalloff, minSpacing);
  const opts = {
    isStatic: true,
    restitution: 0.7,
    friction: 0.02,
    label: "ring-wall",
    collisionFilter: { category: COLLISION.OBSTACLE, mask: COLLISION.BOB },
  };
  for (let ring = 0; ring < radii.length; ring++) {
    const radius = radii[ring];
    // A wedge left open so bobs can pass inward; rotate it per ring so the gaps
    // don't line up into a single straight corridor.
    const gapHalf = 0.55; // radians → ~63° opening
    const gapCenter = (ring * 1.7) % (Math.PI * 2) + Math.random() * 0.6;
    const circumference = 2 * Math.PI * radius;
    const segCount = Math.max(10, Math.round(circumference / (thickness * 4)));
    const step = (Math.PI * 2) / segCount;
    const segLen = step * radius * 1.08; // slight overlap so there are no seams
    const TAU = Math.PI * 2;
    const ringSegments: BoundaryWall[] = [];
    for (let i = 0; i < segCount; i++) {
      const a = i * step;
      // Smallest absolute angle between this segment and the gap center, kept in
      // [0, π] so the JS modulo never trips on a negative operand.
      const diff = (((a - gapCenter) % TAU) + TAU) % TAU;
      const da = Math.min(diff, TAU - diff);
      if (da < gapHalf) continue;
      const seg = Matter.Bodies.rectangle(
        center.x + Math.cos(a) * radius,
        center.y + Math.sin(a) * radius,
        segLen,
        thickness,
        { ...opts, angle: a + Math.PI / 2 }
      );
      const wall: BoundaryWall = {
        body: seg,
        side: "ring",
        normal: { x: Math.cos(a), y: Math.sin(a) },
        hp: maxHp,
        maxHp,
        broken: false,
        angle: a,
      };
      walls.push(wall);
      ringSegments.push(wall);
    }
    rings.push({ radius, segHalfLen: segLen / 2, segments: ringSegments });
  }
  Matter.World.add(world, walls.map((w) => w.body));
  return { walls, rings };
}

export function destroyWallField(world: Matter.World, field: WallField) {
  for (const wall of field.walls) {
    if (!wall.broken) Matter.World.remove(world, wall.body);
  }
  field.walls = [];
  for (const obstacle of field.obstacles) {
    if (!obstacle.broken) Matter.World.remove(world, obstacle.body);
  }
  field.obstacles = [];
}

export function findWallByBody(
  field: WallField,
  body: Matter.Body
): BoundaryWall | null {
  for (const wall of field.walls) {
    if (wall.body === body) return wall;
  }
  for (const wall of field.obstacles) {
    if (wall.body === body) return wall;
  }
  return null;
}

/**
 * Land damage on a breakable wall. Returns true if the wall shattered (and was
 * removed from the world). No-op on solid/none fields or an already-broken wall.
 * `amount` defaults to 1 (a full bob slam); shed shards pass a smaller fraction.
 */
export function damageWall(
  world: Matter.World,
  field: WallField,
  wall: BoundaryWall,
  amount = 1
): boolean {
  if (!field.breakable || wall.broken) return false;
  wall.hp -= amount;
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
  for (const wall of field.obstacles) {
    if (wall.broken) {
      Matter.World.add(world, wall.body);
      wall.broken = false;
    }
    wall.hp = wall.maxHp;
  }
}
