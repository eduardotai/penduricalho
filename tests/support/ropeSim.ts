// Headless rope rig that mirrors GameCanvas' physics wiring (engine options,
// per-step afterUpdate guards, per-frame mass sync + attachment tick) so tests
// and scripts can measure rope behavior without a browser.
import Matter from "matter-js";
import {
  attachmentConstraintIterations,
  buildPendulum,
  clampAngularVelocity,
  enforceRopeStretchLimit,
  setPendulumWeightScale,
  tickAttachmentPhysics,
  type PendulumHandle,
} from "../../src/game/pendulum";
import { GRAB_DAMPING, GRAB_STIFFNESS, pushPointerSample, throwVelocity, type PointerSample } from "../../src/game/ropeGrab";
import { PENDULUMS } from "../../src/data/pendulums";
import { ATTACHMENTS } from "../../src/data/attachments";

export const SIM_ANCHOR = { x: 1920, y: 1392 };
const STEP = 1000 / 60;

export interface SimRig {
  engine: Matter.Engine;
  h: PendulumHandle;
  frame(): void;
}

export function makeRig(pid: string, aid: string): SimRig {
  const pendulum = PENDULUMS.find((p) => p.id === pid);
  const attachment = ATTACHMENTS.find((a) => a.id === aid);
  if (!pendulum || !attachment) throw new Error(`unknown rig ${pid}/${aid}`);
  // Same options as createEngine() in src/game/engine.ts.
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 1, scale: 0.001 },
    enableSleeping: false,
    constraintIterations: 4,
    positionIterations: 10,
    velocityIterations: 8,
  });
  const h = buildPendulum(engine.world, pendulum, attachment, SIM_ANCHOR, 1);
  engine.constraintIterations = attachmentConstraintIterations(h);
  // Same afterUpdate order as GameCanvas: swing-speed clamp, then stretch guard.
  Matter.Events.on(engine, "afterUpdate", () => {
    clampAngularVelocity(h, pendulum.maxAngularVelocity);
    enforceRopeStretchLimit(h);
  });
  return {
    engine,
    h,
    frame() {
      // GameCanvas runs these every animation frame before the runner steps.
      setPendulumWeightScale(h, 1);
      tickAttachmentPhysics(h);
      Matter.Engine.update(engine, STEP);
    },
  };
}

export type Scenario = "rest" | "swing" | "grab" | "release";

export interface JitterStats {
  /** RMS of the third difference of node positions (world units / step³): smooth motion ≈ 0. */
  nodeJerk: number;
  /** Same for the tip bob. */
  bobJerk: number;
  /** Radial (along-rope) velocity sign flips of the tip bob per second. */
  bobRadialFlipsPerSec: number;
  /** RMS high-frequency link strain wobble (strain minus its neighbor average). */
  strainWobble: number;
  /** Peak tip speed during the measured window (swing sanity). */
  peakSpeed: number;
  /** Mean tip speed during the measured window. */
  meanSpeed: number;
}

function tipOf(h: PendulumHandle) {
  return h.bobs[h.bobs.length - 1];
}

function ropeLinks(h: PendulumHandle) {
  return h.constraints.filter((c) => c.bodyA && c.bodyB && /^rope-(\d+|bob)$/.test(c.label ?? ""));
}

/**
 * Run one scenario and return jitter metrics over its measured window.
 *  rest    – hanging still, 4 s
 *  swing   – free swing after a 40 u/step kick, measured from 1 s to 5 s
 *  grab    – hand holds the tip and sweeps it in a slow arc, then holds still (3 s)
 *  release – grab sweep, throw on release, measure the 1.5 s after release
 */
export function runScenario(pid: string, aid: string, scenario: Scenario): JitterStats {
  const rig = makeRig(pid, aid);
  const { h, engine } = rig;
  const tip = tipOf(h);
  const bodies = [...h.ropeSegments];
  const links = ropeLinks(h);
  const reach = Math.hypot(tip.position.x - SIM_ANCHOR.x, tip.position.y - SIM_ANCHOR.y);

  const hist: { x: number; y: number }[][] = bodies.map(() => []);
  const bobHist: { x: number; y: number }[] = [];
  const strainHist: number[][] = links.map(() => []);
  const radial: number[] = [];
  const speeds: number[] = [];
  const record = () => {
    bodies.forEach((b, i) => hist[i].push({ x: b.position.x, y: b.position.y }));
    bobHist.push({ x: tip.position.x, y: tip.position.y });
    links.forEach((c, i) => {
      const d = Math.hypot(c.bodyB!.position.x - c.bodyA!.position.x, c.bodyB!.position.y - c.bodyA!.position.y);
      strainHist[i].push(d / (c.length || 1));
    });
    const rx = tip.position.x - SIM_ANCHOR.x;
    const ry = tip.position.y - SIM_ANCHOR.y;
    const r = Math.hypot(rx, ry) || 1;
    radial.push((tip.velocity.x * rx + tip.velocity.y * ry) / r);
    speeds.push(Math.hypot(tip.velocity.x, tip.velocity.y));
  };

  if (scenario === "rest") {
    for (let i = 0; i < 240; i++) {
      rig.frame();
      record();
    }
  } else if (scenario === "swing") {
    Matter.Body.setVelocity(tip, { x: 40, y: 0 });
    for (let i = 0; i < 300; i++) {
      rig.frame();
      if (i >= 60) record();
    }
  } else {
    const grab = Matter.Constraint.create({
      pointA: { ...tip.position },
      bodyB: tip,
      stiffness: GRAB_STIFFNESS,
      damping: GRAB_DAMPING,
      length: 0,
      label: "manual-drag",
    });
    Matter.Composite.add(engine.world, grab);
    const samples: PointerSample[] = [];
    // grab: ease the hand ~100° up to the right over 1 s (smoothstep, so the
    // hand itself has no velocity jumps), then hold it still for 1 s.
    // release: a fast constant-speed flick over 0.75 s, then let go.
    const frames = scenario === "grab" ? 120 : 45;
    for (let i = 0; i < frames; i++) {
      const u = Math.min(1, i / 60);
      const k = scenario === "grab" ? u * u * (3 - 2 * u) : i / 45;
      const ang = Math.PI / 2 - k * (scenario === "grab" ? 1.75 : 1.4);
      grab.pointA = { x: SIM_ANCHOR.x + Math.cos(ang) * reach, y: SIM_ANCHOR.y + Math.sin(ang) * reach };
      pushPointerSample(samples, { t: i * STEP, x: grab.pointA.x, y: grab.pointA.y });
      rig.frame();
      if (scenario === "grab") record();
    }
    if (scenario === "release") {
      Matter.Composite.remove(engine.world, grab);
      const v = throwVelocity(samples);
      Matter.Body.setVelocity(tip, v);
      for (let i = 0; i < 90; i++) {
        rig.frame();
        record();
      }
    }
  }

  const jerk = (s: { x: number; y: number }[]) => {
    let sum = 0;
    let n = 0;
    for (let t = 3; t < s.length; t++) {
      const jx = s[t].x - 3 * s[t - 1].x + 3 * s[t - 2].x - s[t - 3].x;
      const jy = s[t].y - 3 * s[t - 1].y + 3 * s[t - 2].y - s[t - 3].y;
      sum += jx * jx + jy * jy;
      n++;
    }
    return n ? Math.sqrt(sum / n) : 0;
  };
  const nodeJerk = hist.length ? hist.reduce((a, s) => a + jerk(s), 0) / hist.length : 0;
  let flips = 0;
  for (let t = 1; t < radial.length; t++) {
    if (Math.abs(radial[t]) > 0.05 && Math.abs(radial[t - 1]) > 0.05 && Math.sign(radial[t]) !== Math.sign(radial[t - 1])) flips++;
  }
  let wob = 0;
  let wn = 0;
  for (const s of strainHist) {
    for (let t = 1; t < s.length - 1; t++) {
      const d = s[t] - (s[t - 1] + s[t + 1]) / 2;
      wob += d * d;
      wn++;
    }
  }
  return {
    nodeJerk,
    bobJerk: jerk(bobHist),
    bobRadialFlipsPerSec: flips / (radial.length / 60),
    strainWobble: wn ? Math.sqrt(wob / wn) : 0,
    peakSpeed: Math.max(0, ...speeds),
    meanSpeed: speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length),
  };
}

export const JITTER_RIGS: [string, string][] = [
  ["wooden-bob", "hemp-rope"],
  ["tungsten-heavy", "steel-rope"],
  ["tungsten-heavy", "heavy-chain"],
  ["nitro-bob", "braided-rope"],
  ["wooden-bob", "elastic-cord"],
  ["iron-bob", "elastic-cord"],
  ["triple-bob", "hemp-rope"],
];
