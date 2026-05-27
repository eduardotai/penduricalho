import Matter from "matter-js";
import type { Vec2 } from "../types";
import type { PendulumHandle } from "./pendulum";

type TwistContext = {
  twistPowerMult: number;
  twistPowerBonus: number;
  onTwist: (vec: Vec2) => void;
};

const CLICK_TANGENT_IMPULSE = 0.05;
const DRAG_FORCE_SCALE = 0.0012;

export interface InputController {
  attach(): void;
  detach(): void;
  setHandle(handle: PendulumHandle | null): void;
  setContext(ctx: Partial<TwistContext>): void;
}

export function createInputController(
  canvas: HTMLCanvasElement,
  initialHandle: PendulumHandle | null,
  initialCtx: TwistContext
): InputController {
  let handle: PendulumHandle | null = initialHandle;
  let ctx: TwistContext = { ...initialCtx };
  let dragging: { bob: Matter.Body; startX: number; startY: number; lastX: number; lastY: number; pointerId: number } | null = null;

  function rectToWorld(e: PointerEvent): Vec2 {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function findBobAt(p: Vec2): Matter.Body | null {
    if (!handle) return null;
    for (const bob of handle.bobs) {
      const dx = bob.position.x - p.x;
      const dy = bob.position.y - p.y;
      const radius = (bob.circleRadius ?? 14) + 12;
      if (dx * dx + dy * dy <= radius * radius) return bob;
    }
    return null;
  }

  function applyDragForce(bob: Matter.Body, dx: number, dy: number) {
    const scale = DRAG_FORCE_SCALE * (1 + ctx.twistPowerBonus) * ctx.twistPowerMult;
    const force = { x: dx * scale, y: dy * scale };
    Matter.Body.applyForce(bob, bob.position, force);
    ctx.onTwist(force);
  }

  function applyTangentImpulse(bob: Matter.Body) {
    if (!handle) return;
    const pivot = handle.pivot.position;
    const rx = bob.position.x - pivot.x;
    const ry = bob.position.y - pivot.y;
    const len = Math.hypot(rx, ry) || 1;
    const tx = -ry / len;
    const ty = rx / len;
    const sign = bob.angularVelocity >= 0 ? 1 : -1;
    const magnitude = CLICK_TANGENT_IMPULSE * (1 + ctx.twistPowerBonus) * ctx.twistPowerMult;
    const force = { x: tx * sign * magnitude, y: ty * sign * magnitude };
    Matter.Body.applyForce(bob, bob.position, force);
    ctx.onTwist(force);
  }

  function onPointerDown(e: PointerEvent) {
    const p = rectToWorld(e);
    const bob = findBobAt(p);
    if (!bob) return;
    canvas.setPointerCapture(e.pointerId);
    dragging = {
      bob,
      startX: p.x,
      startY: p.y,
      lastX: p.x,
      lastY: p.y,
      pointerId: e.pointerId,
    };
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || dragging.pointerId !== e.pointerId) return;
    const p = rectToWorld(e);
    const dx = p.x - dragging.lastX;
    const dy = p.y - dragging.lastY;
    if (dx === 0 && dy === 0) return;
    applyDragForce(dragging.bob, dx, dy);
    dragging.lastX = p.x;
    dragging.lastY = p.y;
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging || dragging.pointerId !== e.pointerId) return;
    const totalDx = dragging.lastX - dragging.startX;
    const totalDy = dragging.lastY - dragging.startY;
    const dist = Math.hypot(totalDx, totalDy);
    if (dist < 6) {
      applyTangentImpulse(dragging.bob);
    }
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {}
    dragging = null;
  }

  function onPointerCancel(e: PointerEvent) {
    if (dragging && dragging.pointerId === e.pointerId) dragging = null;
  }

  return {
    attach() {
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerCancel);
    },
    detach() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
    },
    setHandle(h) {
      handle = h;
      dragging = null;
    },
    setContext(partial) {
      ctx = { ...ctx, ...partial };
    },
  };
}
