import type Matter from "matter-js";
import type { ManeuverDef, Vec2 } from "../types";
import { MANEUVERS } from "../data/maneuvers";

interface Snapshot {
  t: number;
  angle: number;
  angularVel: number;
  altitude: number;
  signedAngVel: number;
}

interface ManeuverEvent {
  def: ManeuverDef;
  at: number;
}

export interface ManeuverDetector {
  push(now: number, bob: Matter.Body, pivot: Vec2): ManeuverEvent[];
  reportTwist(now: number, bob: Matter.Body, pivot: Vec2, twistForce: Vec2): ManeuverEvent | null;
  reset(): void;
}

const BUFFER_MS = 2400;
const ROTATION_THRESHOLD = Math.PI * 2 * 0.95;
const ZERO_CROSS_WINDOW_MS = 600;
const HIGH_ARC_COOLDOWN_MS = 1200;
const ROTATION_COOLDOWN_MS = 1400;
const DOUBLE_SWING_COOLDOWN_MS = 900;
const PERFECT_TWIST_COOLDOWN_MS = 700;

export function createManeuverDetector(): ManeuverDetector {
  const buffer: Snapshot[] = [];
  let lastAngle: number | null = null;
  let accumulatedRotation = 0;
  let rotationDirection: 0 | 1 | -1 = 0;
  let lastRotationAt = 0;
  let lastHighArcAt = 0;
  let lastDoubleSwingAt = 0;
  let lastPerfectTwistAt = 0;

  function compactBuffer(now: number) {
    while (buffer.length && now - buffer[0].t > BUFFER_MS) buffer.shift();
  }

  return {
    push(now, bob, pivot) {
      const dx = bob.position.x - pivot.x;
      const dy = bob.position.y - pivot.y;
      const angle = Math.atan2(dy, dx);
      const altitude = pivot.y - bob.position.y;
      const angularVel = bob.angularVelocity;
      const signedAngVel = angularVel;

      const events: ManeuverEvent[] = [];

      if (lastAngle != null) {
        let delta = angle - lastAngle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const dir: 0 | 1 | -1 = delta > 0 ? 1 : delta < 0 ? -1 : 0;
        if (dir !== 0 && rotationDirection !== 0 && dir !== rotationDirection) {
          accumulatedRotation = 0;
        }
        if (dir !== 0) rotationDirection = dir;
        accumulatedRotation += Math.abs(delta);
        if (
          accumulatedRotation >= ROTATION_THRESHOLD &&
          now - lastRotationAt > ROTATION_COOLDOWN_MS
        ) {
          events.push({ def: MANEUVERS.fullRotation, at: now });
          accumulatedRotation = 0;
          lastRotationAt = now;
        }
      }
      lastAngle = angle;

      if (altitude > 30 && now - lastHighArcAt > HIGH_ARC_COOLDOWN_MS) {
        events.push({ def: MANEUVERS.highArc, at: now });
        lastHighArcAt = now;
      }

      buffer.push({ t: now, angle, angularVel, altitude, signedAngVel });
      compactBuffer(now);

      let crossings = 0;
      for (let i = 1; i < buffer.length; i++) {
        const prev = buffer[i - 1].signedAngVel;
        const cur = buffer[i].signedAngVel;
        if (prev === 0 && cur === 0) continue;
        if ((prev < 0 && cur > 0) || (prev > 0 && cur < 0)) {
          if (now - buffer[i].t < ZERO_CROSS_WINDOW_MS) crossings++;
        }
      }
      if (crossings >= 2 && now - lastDoubleSwingAt > DOUBLE_SWING_COOLDOWN_MS) {
        events.push({ def: MANEUVERS.doubleSwing, at: now });
        lastDoubleSwingAt = now;
      }

      return events;
    },

    reportTwist(now, bob, pivot, force) {
      const rx = bob.position.x - pivot.x;
      const ry = bob.position.y - pivot.y;
      const len = Math.hypot(rx, ry) || 1;
      const tx = -ry / len;
      const ty = rx / len;
      const fmag = Math.hypot(force.x, force.y);
      if (fmag < 1e-5) return null;
      const fx = force.x / fmag;
      const fy = force.y / fmag;
      const dot = Math.abs(fx * tx + fy * ty);
      if (dot > 0.92 && now - lastPerfectTwistAt > PERFECT_TWIST_COOLDOWN_MS) {
        lastPerfectTwistAt = now;
        return { def: MANEUVERS.perfectTwist, at: now };
      }
      return null;
    },

    reset() {
      buffer.length = 0;
      lastAngle = null;
      accumulatedRotation = 0;
      rotationDirection = 0;
      lastRotationAt = 0;
      lastHighArcAt = 0;
      lastDoubleSwingAt = 0;
      lastPerfectTwistAt = 0;
    },
  };
}
