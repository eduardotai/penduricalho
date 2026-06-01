import Matter from "matter-js";
import type { AttachmentDef } from "../types";
import type { PendulumHandle } from "./pendulum";
import { propagateRopeWhip } from "./pendulum";
import { COOKIE_KICK_BASE } from "./clickerEconomy";
import { WORLD_SCALE } from "./worldConstants";

/**
 * Small tangential impulse per cookie-style bob click (not a full launch).
 */
export function applyCookieKick(
  handle: PendulumHandle,
  attachment: AttachmentDef,
  effects$: { twistPowerMult: number },
  clickComboStacks: number
) {
  const last = handle.bobs[handle.bobs.length - 1];
  if (!last) return;
  const rx = last.position.x - handle.pivot.position.x;
  const ry = last.position.y - handle.pivot.position.y;
  const posTangentX = -ry;
  const posTangentY = rx;
  const dot = last.velocity.x * posTangentX + last.velocity.y * posTangentY;
  const dir = dot >= 0 ? 1 : -1;

  const twistBonus = attachment.bonuses.twistPowerBonus ?? 0;
  const velBonus = attachment.bonuses.velocityBonus ?? 0;
  const comboBoost = 1 + Math.min(50, clickComboStacks) * 0.02;
  const kick =
    COOKIE_KICK_BASE *
    WORLD_SCALE *
    comboBoost *
    (1 + twistBonus) *
    (1 + velBonus) *
    effects$.twistPowerMult;

  for (let i = 0; i < handle.bobs.length; i++) {
    const bob = handle.bobs[i];
    const bx = bob.position.x - handle.pivot.position.x;
    const by = bob.position.y - handle.pivot.position.y;
    const len = Math.hypot(bx, by) || 1;
    const tx = -by / len;
    const ty = bx / len;
    const segmentBoost = 1 - i * 0.05;
    const nextX = bob.velocity.x + tx * dir * kick * segmentBoost;
    const nextY = bob.velocity.y + ty * dir * kick * segmentBoost;
    const cap = 48 * WORLD_SCALE;
    Matter.Body.setVelocity(bob, {
      x: Math.max(-cap, Math.min(cap, nextX)),
      y: Math.max(-cap, Math.min(cap, nextY)),
    });
    if (i === handle.bobs.length - 1) {
      propagateRopeWhip(handle, { x: nextX, y: nextY }, 0.04);
    }
  }
}