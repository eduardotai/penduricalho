import Matter from "matter-js";

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
