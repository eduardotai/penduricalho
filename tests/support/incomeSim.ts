// Headless income simulation: launch a rig on the Workshop field, let it swing
// out, and score zone hits with the same formula and combo rules as
// GameCanvas.scoreZoneHit (minus modifiers / tokens / achievements / item
// levels, which multiply every bob equally). Frenzy and Chaos run their real
// stat math from src/game/bobBehaviors.ts; Nitro's faster rope drain and the
// rope snap are modeled. Other behaviors (hunter, piercer, hydra, magnet,
// teleport, rocket, splitter shards) are NOT modeled — those bobs are scored as
// plain swings, so treat their rows as a floor, not their real value.
import Matter from "matter-js";
import {
  attachmentConstraintIterations,
  buildPendulum,
  clampAngularVelocity,
  dampPendulumMotion,
  enforceRopeStretchLimit,
  getEffectiveBobRadius,
  getOrderedBobBodies,
  positionChainBobs,
  resetPendulumToRest,
  rigReach,
  setBobRadiusScale,
  setPendulumWeightScale,
  setRopeLengthScale,
  snapRope,
  tickAttachmentPhysics,
} from "../../src/game/pendulum";
import { generateHitZones, relocateZone } from "../../src/game/hitZones";
import {
  chaosBounds,
  frenzyMultipliers,
  gildZone,
  lerpChaos,
  nearestZones,
  pushTrail,
  rollChaosTargets,
  singularityScale,
  zonesInRadius,
  zonesOnTrail,
  type ChaosStats,
  type TrailPoint,
} from "../../src/game/bobBehaviors";
import { durabilityDrainPerSec, resolveRopeMaterial, ropeChargeMult } from "../../src/game/rope";
import { GRAB_DAMPING, GRAB_STIFFNESS } from "../../src/game/ropeGrab";
import { ANCHOR, VIRTUAL_HEIGHT, VIRTUAL_WIDTH, WORLD_SCALE } from "../../src/game/worldConstants";
import { PENDULUMS } from "../../src/data/pendulums";
import { ATTACHMENTS } from "../../src/data/attachments";
import { SITE_MAP } from "../../src/data/sites";
import type { ModifierEffects, PendulumDef, SiteDef } from "../../src/types";
import { wallHpForWeight } from "../../src/game/engine";
import { applyGust, createBumperField, createGustSchedule, gustAt, springRebound } from "../../src/game/mapMechanics";

const STEP = 1000 / 60;
// Mirrors GameCanvas constants.
const COMBO_DECAY_MS = 1800;
const HIT_STOP_MS = 28;
const STALL_SPEED_THRESHOLD = 2.5;
const STALL_TIME_MS = 350;
const SETTLE_REF_SPEED = 4.0;
const SETTLE_PEAK_RATE = 1.8;
const MAX_RUN_MS = 45_000;

/** Deterministic PRNG (mulberry32) so balance numbers are reproducible. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How the player drives the rig:
 *  launch – press Launch / Auto-Run, let the swing play out until it stalls.
 *  hand   – grab the tip and keep circling it by hand (the #12 grab) for
 *           HAND_RUN_MS at a steady HAND_RAD_PER_STEP, then let go.
 */
export type PlayMode = "launch" | "hand";
const HAND_RUN_MS = 12_000;
const HAND_RAD_PER_STEP = 0.035; // ≈ 2 rad/s, an easy mouse circle
/** Dead time between runs (the Auto-Run countdown), charged to every run. */
export const RELAUNCH_OVERHEAD_MS = 1500;

export interface RunResult {
  points: number;
  hits: number;
  /** Wall-clock run time in ms, including hit-stop freezes. */
  ms: number;
  bestCombo: number;
  snapped: boolean;
}

export function simulateRun(
  pendulum: PendulumDef,
  attachmentId: string,
  siteId: string,
  seed: number,
  overrides: Partial<PendulumDef> = {},
  mode: PlayMode = "launch",
  siteOverride: SimSite = {},
  mods: ModifierEffects = {}
): RunResult {
  const realRandom = Math.random;
  Math.random = seeded(seed);
  try {
    return runOnce({ ...pendulum, ...overrides }, attachmentId, { ...SITE_MAP.get(siteId)!, ...siteOverride }, mode, mods);
  } finally {
    Math.random = realRandom;
  }
}

/**
 * Site overrides for the sim. `simWallBoost` turns on a cage-wall model (see
 * containInCage; breakable walls, no shards) with that slam rebound
 * multiplier. A "springWalls" site uses its own boost and aim automatically.
 */
export type SimSite = Partial<SiteDef> & { simWallBoost?: number };
const WALL_HIT_MIN_SPEED = 3.5 * WORLD_SCALE;
const WALL_BOUNCE_MAX_SPEED = 55 * WORLD_SCALE;

type Side = "left" | "right" | "top" | "bottom";
const WALL_BREAK_BOOST = 1.5;
const WALL_BREAK_BONUS = 70;

/**
 * Bounce bodies off the cage, like GameCanvas.handleWallHit: a slam (speed ≥
 * WALL_HIT_MIN_SPEED) costs the wall 1 hp and rebounds at `boost`, or at 1.5×
 * plus a flat bonus when it shatters; softer touches rebound at 0.5. A
 * shattered side is open, so bobs escape through it. Returns bonus points.
 */
function containInCage(
  bodies: Matter.Body[],
  r: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
  boost: number,
  hp: Record<Side, number>,
  aim = 0,
  aimAt: { x: number; y: number } = { x: 0, y: 0 }
): number {
  let bonus = 0;
  for (const body of bodies) {
    let { x, y } = body.position;
    let vx = body.velocity.x;
    let vy = body.velocity.y;
    let hit = false;
    const bounce = (side: Side) => {
      const fast = Math.hypot(vx, vy) >= WALL_HIT_MIN_SPEED;
      if (side === "left" || side === "right") vx = -vx;
      else vy = -vy;
      let k = 0.5;
      if (fast) {
        hp[side] -= 1;
        if (hp[side] <= 0) {
          k = WALL_BREAK_BOOST;
          bonus += WALL_BREAK_BONUS;
        } else k = boost;
      }
      vx *= k;
      vy *= k;
      hit = true;
    };
    if (hp.left > 0 && x - r < b.minX && vx < 0) { x = b.minX + r; bounce("left"); }
    if (hp.right > 0 && x + r > b.maxX && vx > 0) { x = b.maxX - r; bounce("right"); }
    if (hp.top > 0 && y - r < b.minY && vy < 0) { y = b.minY + r; bounce("top"); }
    if (hp.bottom > 0 && y + r > b.maxY && vy > 0) { y = b.maxY - r; bounce("bottom"); }
    if (!hit) continue;
    if (aim > 0) {
      // Spring walls: steer the rebound toward `aimAt`, keeping its speed.
      const v = springRebound({ x, y }, { x: vx, y: vy }, aimAt, aim);
      vx = v.x;
      vy = v.y;
    }
    const sp = Math.hypot(vx, vy);
    if (sp > WALL_BOUNCE_MAX_SPEED) {
      vx *= WALL_BOUNCE_MAX_SPEED / sp;
      vy *= WALL_BOUNCE_MAX_SPEED / sp;
    }
    Matter.Body.setPosition(body, { x, y });
    Matter.Body.setVelocity(body, { x: vx, y: vy });
  }
  return bonus;
}

/**
 * `mods` applies modifier effects for the WHOLE run (an upper bound on a timed
 * pickup): pointMult, accelerationMult (gravity), weightMult (rope wear),
 * durabilityDrainMult and comboWindowMult are modeled; drop chance, orb pull,
 * size and echoes are not.
 */
function runOnce(pendulum: PendulumDef, attachmentId: string, site: SimSite, mode: PlayMode, mods: ModifierEffects = {}): RunResult {
  const attachment = ATTACHMENTS.find((a) => a.id === attachmentId)!;
  const comboWindow = COMBO_DECAY_MS * (mods.comboWindowMult ?? 1);
  const modPoints = mods.pointMult ?? 1;
  const modDrain = (mods.durabilityDrainMult ?? 1);
  const wearWeight = pendulum.weight * (mods.weightMult ?? 1);
  const gusts = site.mechanic?.kind === "gusts" ? createGustSchedule(site.mechanic) : null;
  const bumpers = site.mechanic?.kind === "bumpers" ? createBumperField(site.mechanic) : null;
  const wallBoost = site.simWallBoost ?? (site.mechanic?.kind === "springWalls" ? site.mechanic.boost : undefined);
  const aim = site.mechanic?.kind === "springWalls" ? site.mechanic.aim : 0;
  const cs = site.cageScale ?? 1;
  const cage = {
    minX: VIRTUAL_WIDTH / 2 - (VIRTUAL_WIDTH * cs) / 2,
    maxX: VIRTUAL_WIDTH / 2 + (VIRTUAL_WIDTH * cs) / 2,
    minY: VIRTUAL_HEIGHT / 2 - (VIRTUAL_HEIGHT * cs) / 2,
    maxY: VIRTUAL_HEIGHT / 2 + (VIRTUAL_HEIGHT * cs) / 2,
  };
  const hp0 = wallHpForWeight(pendulum.weight, site.wallDurabilityMult ?? 1);
  const wallHp: Record<Side, number> = { left: hp0, right: hp0, top: hp0, bottom: hp0 };
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: site.gravity * (mods.accelerationMult ?? 1), scale: 0.001 },
    enableSleeping: false,
    constraintIterations: 4,
    positionIterations: 10,
    velocityIterations: 8,
  });
  const h = buildPendulum(engine.world, pendulum, attachment, ANCHOR, 1);
  engine.constraintIterations = attachmentConstraintIterations(h);
  const behavior = pendulum.behavior;
  const reach = attachment.length + pendulum.bobSpacing * Math.max(0, pendulum.bobCount - 1);
  const clearance = Math.max(site.hitZoneRadius[1], pendulum.bobRadius);
  const field = generateHitZones(
    engine.world,
    site,
    { x: 0, y: 0, w: VIRTUAL_WIDTH, h: VIRTUAL_HEIGHT },
    ANCHOR,
    reach,
    clearance
  );

  let combo = 0;
  let lastHitAt = -1e9;
  let bestCombo = 0;
  let now = 0;
  let points = 0;
  let hits = 0;
  let durability = 1;
  const material = resolveRopeMaterial(attachment);
  const bounds = chaosBounds(PENDULUMS);
  let chaosCur: ChaosStats = { size: 1, weight: 1, cap: 1, rope: 1 };
  let chaosTarget: ChaosStats = { ...chaosCur };
  let lastChaosRollAt = -1e9;
  let frenzyApplied = 1;
  let singularityHits = 0;
  let lastPulseAt = 0;
  const trail: TrailPoint[] = [];
  const popValue = behavior?.popValue ?? 0.5;
  type Handle = (typeof field.zones)[number];
  /** Score one zone like GameCanvas.scoreZoneHit; `factor` < 1 = echo/behavior pop. */
  const scoreHit = (handle: Handle, factor: number, primary: boolean) => {
    const z = handle.zone;
    const stacks = combo + 1;
    const base =
      z.basePoints * z.multiplier * pendulum.basePointMultiplier * (attachment.bonuses.momentumMult ?? 1) *
      ropeChargeMult(attachment.behavior, combo) * factor;
    points += Math.max(1, Math.round(base * modPoints * (1 + Math.min(20, stacks) * 0.05)));
    combo = now - lastHitAt < comboWindow ? combo + 1 : 1;
    lastHitAt = now;
    bestCombo = Math.max(bestCombo, combo);
    hits++;
    if (primary) {
      if (combo > 1 && combo % 5 === 0) points += 5 * combo;
      if (behavior?.kind === "singularity") singularityHits++;
      if (behavior?.kind === "prism") {
        for (const t of nearestZones(field.zones, handle, behavior.chainCount ?? 2, behavior.chainRange ?? 900)) scoreHit(t, popValue, false);
      }
    }
    if (primary && behavior?.kind === "midas") {
      // Golden touch spreads: the nearest other orb gains a gild stack.
      for (const t of nearestZones(field.zones, handle, 1, Infinity)) gildZone(t.zone, behavior);
    }
    relocateZone(field, handle, reach, clearance);
  };
  const capMult = () => frenzyMultipliers(behavior, combo).speed * chaosCur.cap;

  Matter.Events.on(engine, "afterUpdate", () => {
    if (!h.snapped) clampAngularVelocity(h, pendulum.maxAngularVelocity * capMult());
    enforceRopeStretchLimit(h);
  });

  // Launch exactly like GameCanvas.relaunchPendulum from rest (dir = CCW).
  resetPendulumToRest(h);
  const twist = attachment.bonuses.twistPowerBonus ?? 0;
  const vel = attachment.bonuses.velocityBonus ?? 0;
  const kick = 17 * WORLD_SCALE * (1 + twist) * (1 + vel) * (0.95 + Math.random() * 0.1);
  h.bobs.forEach((bob, i) => {
    const bx = bob.position.x - h.pivot.position.x;
    const by = bob.position.y - h.pivot.position.y;
    const len = Math.hypot(bx, by) || 1;
    Matter.Body.setVelocity(bob, { x: (-by / len) * kick * (1 - i * 0.05), y: (bx / len) * kick * (1 - i * 0.05) });
  });

  const overlaps = new Set<string>();
  let stallMs = 0;
  const tipBody = h.bobs[h.bobs.length - 1];
  let grab: Matter.Constraint | null = null;
  let handAngle = Math.PI / 2;
  const handReach = Math.hypot(tipBody.position.x - ANCHOR.x, tipBody.position.y - ANCHOR.y);
  if (mode === "hand") {
    grab = Matter.Constraint.create({ pointA: { ...tipBody.position }, bodyB: tipBody, stiffness: GRAB_STIFFNESS, damping: GRAB_DAMPING, length: 0 });
    Matter.Composite.add(engine.world, grab);
  }
  while (now < MAX_RUN_MS) {
    if (grab) {
      if (h.snapped || now >= HAND_RUN_MS) {
        Matter.Composite.remove(engine.world, grab);
        grab = null;
      } else {
        handAngle -= HAND_RAD_PER_STEP;
        grab.pointA = { x: ANCHOR.x + Math.cos(handAngle) * handReach, y: ANCHOR.y + Math.sin(handAngle) * handReach };
      }
    }
    // --- per-frame behavior + scaling (GameCanvas.frame order) ---
    if (now - lastHitAt >= comboWindow) combo = 0;
    const f = frenzyMultipliers(behavior, combo);
    if (behavior?.kind === "chaos") {
      if (now - lastChaosRollAt > (behavior.chaosRerollMs ?? 900)) {
        lastChaosRollAt = now;
        chaosTarget = rollChaosTargets(bounds, {
          radius: pendulum.bobRadius,
          weight: pendulum.weight,
          angVel: pendulum.maxAngularVelocity,
        });
      }
      chaosCur = lerpChaos(chaosCur, chaosTarget, behavior.chaosLerpRate ?? 3, STEP);
    }
    setBobRadiusScale(h, f.size * chaosCur.size * singularityScale(behavior, singularityHits));
    setPendulumWeightScale(h, chaosCur.weight);
    setRopeLengthScale(h, chaosCur.rope);
    if (!h.snapped) {
      durability -= durabilityDrainPerSec(material, wearWeight) * modDrain * (behavior?.durabilityDrainMult ?? 1) * (STEP / 1000);
      if (durability <= 0) snapRope(h, { scatter: true });
    }
    if (!h.snapped) tickAttachmentPhysics(h);
    if (gusts) {
      const bodies = h.snapped ? getOrderedBobBodies(h) : [...getOrderedBobBodies(h), ...h.ropeSegments];
      applyGust(bodies, gustAt(gusts, now), gusts.mechanic.accel, STEP);
    }
    if (Math.abs(f.speed - frenzyApplied) > 0.001) {
      const d = f.speed / frenzyApplied;
      for (const bob of h.bobs) Matter.Body.setVelocity(bob, { x: bob.velocity.x * d, y: bob.velocity.y * d });
      frenzyApplied = f.speed;
    }
    Matter.Engine.update(engine, STEP);
    now += STEP;
    if (!h.snapped) positionChainBobs(h);
    if (wallBoost != null) {
      points += containInCage(h.snapped ? getOrderedBobBodies(h) : [tipBody], getEffectiveBobRadius(h), cage, wallBoost, wallHp, aim, ANCHOR);
    }
    if (bumpers) {
      const r0 = getEffectiveBobRadius(h);
      bumpers.tick(h.snapped ? getOrderedBobBodies(h) : [tipBody], () => r0, ANCHOR, rigReach(h), now, now);
    }

    // --- zone hits (GameCanvas.tickBobZoneHits + scoreZoneHit) ---
    const r = getEffectiveBobRadius(h);
    const next = new Set<string>();
    let hitThisStep = false;
    for (const body of getOrderedBobBodies(h)) {
      for (const handle of field.zones) {
        const z = handle.zone;
        if (Math.hypot(body.position.x - z.position.x, body.position.y - z.position.y) > r + z.radius) continue;
        const key = `${body.id}:${z.id}`;
        next.add(key);
        if (overlaps.has(key)) continue;
        hitThisStep = true;
        scoreHit(handle, 1, true);
      }
    }
    // --- Lodestone / Singularity pull (GameCanvas.magnetPull, zones only) ---
    if (behavior?.kind === "magnet" || behavior?.kind === "singularity") {
      const tip = h.bobs[h.bobs.length - 1];
      const radius = behavior.pullRadius ?? 780;
      const strength = (behavior.pullStrength ?? 2.4) * (STEP / 1000);
      for (const zh of field.zones) {
        const dx = tip.position.x - zh.zone.position.x;
        const dy = tip.position.y - zh.zone.position.y;
        const d = Math.hypot(dx, dy);
        if (d > radius || d < 1) continue;
        const k = Math.min(0.5, strength * (1 - d / radius));
        zh.zone.position = { x: zh.zone.position.x + dx * k, y: zh.zone.position.y + dy * k };
      }
    }
    // --- behavior pops (GameCanvas.lateBobTick) ---
    const tipNow = h.bobs[h.bobs.length - 1];
    const speedNow = Math.hypot(tipNow.velocity.x, tipNow.velocity.y);
    if (behavior?.kind === "pulsar" && speedNow > STALL_SPEED_THRESHOLD && now - lastPulseAt >= (behavior.pulseMs ?? 1500)) {
      lastPulseAt = now;
      for (const zh of zonesInRadius(field.zones, tipNow.position, behavior.pulseRadius ?? 600)) scoreHit(zh, popValue, false);
    }
    if (behavior?.kind === "comet") {
      pushTrail(trail, tipNow.position, now, behavior.trailMs ?? 400);
      if (speedNow > STALL_SPEED_THRESHOLD) {
        // The head itself scores normally; only the tail behind it pops extra.
        const tail = trail.slice(0, Math.max(0, trail.length - 3));
        for (const zh of zonesOnTrail(field.zones, tail, r * (behavior.trailRadiusFraction ?? 0.6))) scoreHit(zh, popValue, false);
      }
    }
    overlaps.clear();
    for (const k of next) overlaps.add(k);
    if (hitThisStep) now += HIT_STOP_MS;

    // --- run end: stalled swing, or the freed bob left the field ---
    const speed = Math.max(...h.bobs.map((b) => Math.hypot(b.velocity.x, b.velocity.y)));
    if (h.snapped) {
      const m = 200;
      const out = h.bobs.every((b) =>
        wallBoost != null
          ? b.position.x < cage.minX - m || b.position.x > cage.maxX + m || b.position.y < cage.minY - m || b.position.y > cage.maxY + m
          : b.position.x < -m || b.position.x > VIRTUAL_WIDTH + m || b.position.y < -m || b.position.y > VIRTUAL_HEIGHT + m
      );
      if (out || speed < 0.45) break;
      continue;
    }
    if (speed < SETTLE_REF_SPEED) {
      const t = (SETTLE_REF_SPEED - speed) / SETTLE_REF_SPEED;
      dampPendulumMotion(h, STEP, SETTLE_PEAK_RATE * t * t);
    }
    if (grab) continue;
    stallMs = speed < STALL_SPEED_THRESHOLD ? stallMs + STEP : 0;
    if (stallMs >= STALL_TIME_MS) break;
  }
  void rigReach;
  return { points, hits, ms: now, bestCombo, snapped: h.snapped };
}

export interface IncomeRow {
  id: string;
  cost: number;
  mult: number;
  pointsPerSec: number;
  pointsPerRun: number;
  hitsPerSec: number;
  runSec: number;
  bestCombo: number;
  snapRate: number;
  /** Run-to-run spread: std dev / mean of points per run. */
  cv: number;
  modeled: boolean;
}

const MODELED = new Set([undefined, "frenzy", "chaos", "nitro", "pulsar", "comet", "midas", "prism", "magnet", "singularity"]);

export function incomeTable(
  attachmentId = "titan-cable",
  siteId = "workshop",
  runs = 16,
  overrides: Record<string, Partial<PendulumDef>> = {},
  mode: PlayMode = "launch",
  onlyIds?: string[],
  siteOverride: SimSite = {},
  mods: ModifierEffects = {}
): IncomeRow[] {
  return PENDULUMS.filter((p) => !onlyIds || onlyIds.includes(p.id)).map((p) => {
    let pts = 0;
    let ms = 0;
    let hits = 0;
    let combo = 0;
    let snaps = 0;
    const per: number[] = [];
    for (let i = 0; i < runs; i++) {
      const r = simulateRun(p, attachmentId, siteId, 1000 + i * 7919, overrides[p.id], mode, siteOverride, mods);
      pts += r.points;
      per.push(r.points);
      ms += r.ms + RELAUNCH_OVERHEAD_MS;
      hits += r.hits;
      combo += r.bestCombo;
      if (r.snapped) snaps++;
    }
    const pdef = { ...p, ...overrides[p.id] };
    return {
      id: p.id,
      cost: pdef.cost,
      mult: pdef.basePointMultiplier,
      pointsPerSec: pts / (ms / 1000),
      pointsPerRun: pts / runs,
      hitsPerSec: hits / (ms / 1000),
      runSec: ms / runs / 1000,
      bestCombo: combo / runs,
      snapRate: snaps / runs,
      cv: Math.sqrt(per.reduce((a, x) => a + (x - pts / runs) ** 2, 0) / runs) / Math.max(1, pts / runs),
      modeled: MODELED.has(p.behavior?.kind),
    };
  });
}
