import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { useGameStore } from "../state/store";
import {
  resolveEquippedCosmetics,
  useEquippedAttachment,
  useEquippedPendulum,
  useEquippedSite,
} from "../state/selectors";
import {
  createEngine,
  destroyEngine,
  setGravity,
  applyAmbientForce,
  createWallField,
  destroyWallField,
  regenerateWallField,
  findWallByBody,
  damageWall,
  type BoundaryWall,
  type WallSide,
} from "../game/engine";
import {
  bobRadius,
  buildPendulum,
  destroyPendulum,
  setPendulumWeightScale,
  setBobRadiusScale,
  setRopeLengthScale,
  getEffectiveBobRadius,
  getOrderedBobBodies,
  positionChainBobs,
  tickAttachmentPhysics,
  propagateRopeWhip,
  resetPendulumToRest,
  settleEmptyRope,
  dampPendulumMotion,
  settlePendulumTowardRest,
  applySpeedRampDelta,
  clampAngularVelocity,
  snapRope,
  restoreRope,
  type PendulumHandle,
} from "../game/pendulum";
import { resolveRopeMaterial, durabilityDrainPerSec } from "../game/rope";
import {
  destroyHitZones,
  generateHitZones,
  regenerateHitZones,
  relocateZone,
  spawnExtraZones,
  type HitZoneField,
  type HitZoneHandle,
} from "../game/hitZones";
import { aggregateEffects, getSpeedRampMultiplier } from "../game/modifiers";
import { createManeuverDetector } from "../game/maneuvers";
import {
  createTokenField,
  destroyTokenField,
  findTokenByBody,
  isTokenBody,
  reapTokens,
  spawnToken,
  tickTokens,
  type TokenField,
  type TokenHandle,
} from "../game/tokens";
import {
  GOLDEN_TOKEN_BASE_DURATION_MS,
  rollRandomToken,
  rollRandomBuffToken,
} from "../data/tokens";
import { playGameSound } from "../audio/soundMap";
import {
  applyShake,
  drawEffects,
  drawHitZones,
  drawPendulum,
  drawScreenBackdrop,
  drawSiteAnchor,
  drawTokens,
  drawWalls,
  drawEchoBobs,
  type RenderContext,
  type EchoBobRender,
} from "../game/render";
import {
  applyWorldCamera,
  computeViewTransform,
  type ViewTransform,
} from "../game/viewTransform";
import { ANCHOR, VIRTUAL_HEIGHT, VIRTUAL_WIDTH, WORLD_SCALE } from "../game/worldConstants";
import {
  createEffectsState,
  emitHit,
  emitManeuver,
  tickEffects,
} from "../game/effects";

const RUN_END_SPEED_THRESHOLD = 0.45;
const RUN_END_IDLE_MS = 1500;
const AUTO_RUN_DELAY_MS = 1500;
// Once the pendulum's fastest bob drops below this for STALL_TIME_MS while
// still in a run, we treat the run as "no more circles reachable" — the
// pendulum is clearly decelerating and unlikely to land more hits. We use this
// to enable the "Run Again" button before the full auto end-of-run kicks in.
const STALL_SPEED_THRESHOLD = 2.5;
const STALL_TIME_MS = 350;
// Earth-like air resistance for the spent swing. Instead of a hard binary
// "stall switch" that suddenly clamps onto the rig (and yanks the soft rope
// into a bounce that registers as a phantom maneuver), we apply a smooth,
// speed-aware decay every frame: barely felt at full swing, easing up only as
// the rig naturally winds down. The bobs' built-in frictionAir handles the
// high-speed regime; this just settles the soft-rope jitter at low speeds.
//   `SETTLE_REF_SPEED` — above this max-bob-speed, no extra drag is applied.
//   `SETTLE_PEAK_RATE` — decay constant (1/s) at zero speed; ~0.55s time
//     constant settles the rig cleanly without an abrupt brake.
const SETTLE_REF_SPEED = 4.0;
const SETTLE_PEAK_RATE = 1.8;
// Velocity damping alone can't kill the rope's gravity-vs-constraint trade-back
// — the bob keeps "bouncing" against the spring even after KE is gone. So once
// the rig is genuinely slow we *also* lerp every rope node and the bob toward
// their hanging rest positions, neutralizing the potential-energy oscillation
// directly. The blend is feathered against `SETTLE_REST_THRESHOLD` so it's
// imperceptible while the swing still has any real motion left, and only locks
// the rope in place once the rig has effectively stopped.
//   `SETTLE_REST_THRESHOLD` — max-bob-speed below which the lerp engages.
//   `SETTLE_REST_RATE` — per-second pull toward rest at zero speed (1/s).
const SETTLE_REST_THRESHOLD = 0.7;
const SETTLE_REST_RATE = 6;
// Hit-stop: brief whole-scene freeze on contact to sell the impact. Physics
// and effects both pause for this many ms, but no velocity is shed — the bob
// resumes with the exact same momentum (and twist) it had at impact.
// Only one pulse per burst: rapid multi-zone contacts must not stack freezes.
const HIT_STOP_MS = 28;
const HIT_STOP_COOLDOWN_MS = 90;
// Durability restored by collecting a Rope Patch token (fraction of full).
const REPAIR_AMOUNT = 0.35;
// --- Breakable-wall (Bumper Cage) tuning ---
// Minimum freed-bob speed to count as a "slam" worth a bumper kick / break.
const WALL_HIT_MIN_SPEED = 3.5 * WORLD_SCALE;
// Velocity multiplier on a normal bounce vs. a wall-shattering hit.
const WALL_BOUNCE_BOOST = 1.22;
const WALL_BREAK_BOOST = 1.5;
// Flat momentum bonus for shattering a wall.
const WALL_BREAK_BONUS = 70;
// How far past the field edge a freed bob must drift to count as "escaped".
// Once every bob is out (and the rope has snapped), the run is over: there's
// nothing left to achieve, so we end it and light up Run Again.
const FIELD_ESCAPE_MARGIN = 240;
// Multiplier circles spawned per Golden Token spend. Scales with site density
// so the starter workshop cannot snowball into a late-game playfield.
function bonusZonesPerGolden(hitZoneCount: number): number {
  if (hitZoneCount < 130) return 10;
  if (hitZoneCount < 230) return 14;
  return 20;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<ViewTransform>({
    displayWidth: VIRTUAL_WIDTH,
    displayHeight: VIRTUAL_HEIGHT,
    coverScale: 1,
    fitX: 0,
    fitY: 0,
  });
  const pendulumHandleRef = useRef<PendulumHandle | null>(null);
  const launchPendingRef = useRef(false);
  // Counts how many Golden Token spends are queued up waiting for the frame
  // loop to apply them. We process at most one per frame so back-to-back
  // spends each produce their own visible re-launch impulse, but rapid
  // presses between renders still all land (using lastTokenEpochRef to
  // diff against the previously-observed epoch).
  const tokenLaunchPendingRef = useRef(0);
  const lastTokenEpochRef = useRef(0);

  const pendulum = useEquippedPendulum();
  const attachment = useEquippedAttachment();
  const site = useEquippedSite();
  const worldVersion = useGameStore((s) => s.worldVersion);
  const runStartId = useGameStore((s) => s.runStartId);
  const goldenTokenConsumeEpoch = useGameStore((s) => s.goldenTokenConsumeEpoch);
  const isRunning = useGameStore((s) => s.isRunning);
  const runStalled = useGameStore((s) => s.runStalled);
  const autoRun = useGameStore((s) => s.autoRun);
  const autoToken = useGameStore((s) => s.autoToken);
  const pendingGoldenTokens = useGameStore((s) => s.pendingGoldenTokens);

  useEffect(() => {
    if (runStartId === 0) return;
    launchPendingRef.current = true;
  }, [runStartId]);

  // Auto-Run: kick a new run as soon as the launch button would be available —
  // either no run is active or the current run has stalled past the point of
  // landing more hits. We don't wait for the hard end-of-run because the
  // stalled tail is just dead air for the player.
  useEffect(() => {
    const canLaunch = !isRunning || runStalled;
    if (!autoRun || !canLaunch) return;
    const id = window.setTimeout(() => {
      useGameStore.getState().startRun();
    }, AUTO_RUN_DELAY_MS);
    return () => clearTimeout(id);
  }, [autoRun, isRunning, runStalled]);

  // Auto-Token: any time a ready golden token sits in the slot during a live
  // run, spend it immediately. spendGoldenToken increments the consume epoch
  // which the existing handler turns into a re-launch on the next frame.
  useEffect(() => {
    if (!autoToken || !isRunning || pendingGoldenTokens <= 0) return;
    useGameStore.getState().spendGoldenToken();
  }, [autoToken, isRunning, pendingGoldenTokens]);

  useEffect(() => {
    if (goldenTokenConsumeEpoch === 0) {
      lastTokenEpochRef.current = 0;
      tokenLaunchPendingRef.current = 0;
      return;
    }
    const delta = goldenTokenConsumeEpoch - lastTokenEpochRef.current;
    if (delta > 0) {
      tokenLaunchPendingRef.current += delta;
      lastTokenEpochRef.current = goldenTokenConsumeEpoch;
    }
  }, [goldenTokenConsumeEpoch]);

  useEffect(() => {
    function onWheel(e: WheelEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [data-no-camera-zoom]")) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      useGameStore.getState().adjustCameraZoom(factor);
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const spaceHeld = { current: false };
    const panning = { current: false };
    const lastPointer = { x: 0, y: 0 };

    function blockedTarget(target: EventTarget | null) {
      return (target as HTMLElement | null)?.closest?.(
        "input, textarea, select, [data-no-camera-zoom]"
      );
    }

    function canvasPoint(clientX: number, clientY: number) {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height,
      };
    }

    function setPanCursor(active: boolean) {
      const container = containerRef.current;
      if (!container) return;
      container.style.cursor = active ? "grab" : "";
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      if (blockedTarget(e.target)) return;
      e.preventDefault();
      if (spaceHeld.current) return;
      spaceHeld.current = true;
      setPanCursor(true);
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      spaceHeld.current = false;
      panning.current = false;
      setPanCursor(false);
    }

    function onPointerDown(e: PointerEvent) {
      if (!spaceHeld.current || blockedTarget(e.target)) return;
      const pt = canvasPoint(e.clientX, e.clientY);
      if (!pt) return;
      e.preventDefault();
      panning.current = true;
      lastPointer.x = pt.x;
      lastPointer.y = pt.y;
      const container = containerRef.current;
      if (container) container.style.cursor = "grabbing";
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (!panning.current) return;
      const pt = canvasPoint(e.clientX, e.clientY);
      if (!pt) return;
      const dx = pt.x - lastPointer.x;
      const dy = pt.y - lastPointer.y;
      lastPointer.x = pt.x;
      lastPointer.y = pt.y;
      if (dx !== 0 || dy !== 0) {
        const cover = viewRef.current.coverScale;
        useGameStore.getState().panCamera(dx / cover, dy / cover);
      }
    }

    function endPan(e: PointerEvent) {
      if (!panning.current) return;
      panning.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      setPanCursor(spaceHeld.current);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const container = containerRef.current;
    if (!container) {
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      };
    }
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", endPan);
    container.addEventListener("pointercancel", endPan);
    window.addEventListener("blur", () => {
      spaceHeld.current = false;
      panning.current = false;
      setPanCursor(false);
    });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", endPan);
      container.removeEventListener("pointercancel", endPan);
      setPanCursor(false);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;

    function resizeCanvas() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      viewRef.current = computeViewTransform(w, h, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);

    const engineHandle = createEngine(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    setGravity(engineHandle, site.gravity);
    // Boundary walls only matter for the bobs freed by a rope snap — a strung
    // pendulum never reaches them. A wall-less site ("none") lets the freed
    // bobs fly off into the void; a breakable site lets them shatter the walls
    // for an extra impulse before they can escape.
    // Wall durability scales with the rig's bob weight — heavier bobs face
    // proportionally tougher walls.
    const wallField = createWallField(
      engineHandle.world,
      VIRTUAL_WIDTH,
      VIRTUAL_HEIGHT,
      site.walls ?? "none",
      pendulum.weight,
      site.cageScale ?? 1,
      site.wallDurabilityMult ?? 1
    );
    // A wall-less site (the Workshop) keeps its snapped rig on display — empty
    // rope, bobs gone — between runs instead of auto-restoring it.
    const wallless = wallField.walls.length === 0;
    const ropeMaterial = resolveRopeMaterial(attachment);

    const pendulumHandle: PendulumHandle = buildPendulum(
      engineHandle.world,
      pendulum,
      attachment,
      ANCHOR,
      1
    );
    pendulumHandleRef.current = pendulumHandle;

    const pendulumReach =
      attachment.length + pendulum.bobSpacing * Math.max(0, pendulum.bobCount - 1);
    const [, zoneRmax] = site.hitZoneRadius;
    const spawnClearance = Math.max(zoneRmax, bobRadius(pendulum));

    // Spawn hit circles across the full cage, not just the central playfield.
    // The cage matches the playfield at cageScale 1 and grows past it for
    // larger arenas, so deriving the spawn rectangle from the wall field's
    // bounds keeps circles spread over the whole enclosed area.
    const cageBounds = wallField.bounds;
    const field: HitZoneField = generateHitZones(
      engineHandle.world,
      site,
      {
        x: cageBounds.minX,
        y: cageBounds.minY,
        w: cageBounds.maxX - cageBounds.minX,
        h: cageBounds.maxY - cageBounds.minY,
      },
      ANCHOR,
      pendulumReach,
      spawnClearance
    );

    const tokenField: TokenField = createTokenField();
    const effects = createEffectsState();
    const maneuvers = createManeuverDetector();

    let runIdleMs = 0;
    let runStallLowMs = 0;
    let speedRampAppliedMult = 1;
    // Rope durability for the current run (1 = full). Drains while swinging;
    // at 0 the rope snaps. Per-run only — reset to full at every fresh launch.
    let durability = 1;

    // While `now` is below this timestamp the engine is frozen for hit-stop.
    let hitStopUntil = 0;
    let lastHitStopAt = -Infinity;
    function requestHitStop(now: number, ms: number) {
      // Already frozen, or still inside the cooldown window — skip so sweeping
      // through several multiplier circles doesn't stack into fake lag.
      if (now < hitStopUntil) return;
      if (now - lastHitStopAt < HIT_STOP_COOLDOWN_MS) return;
      lastHitStopAt = now;
      hitStopUntil = now + ms;
    }

    // Echo bobs are sensor circles that trail the real last-bob along the
    // rope direction — stacked vertically at rest and staying aligned with
    // the rope as the pendulum swings. Each echo sits a step farther from
    // the pivot than the one above it, so every echo sweeps a unique
    // (larger) arc instead of bunching up sideways at the same radius the
    // player's bob already covers. Lifecycle is driven by the aggregated
    // `echoCount` from active modifiers — see syncEchoBobs.
    interface EchoBob {
      body: Matter.Body;
      index: number;
    }
    const echoBobs: EchoBob[] = [];
    // Per-bob zone overlap keys — each bob (chain link or echo) tracks its
    // own contact state so every body on the rope scores independently.
    const zoneOverlapKeys = new Set<string>();

    function zoneOverlapKey(bodyId: number, zoneId: string) {
      return `${bodyId}:${zoneId}`;
    }

    function tickBobZoneHits(now: number) {
      const nextOverlaps = new Set<string>();
      const newHits: {
        handle: HitZoneHandle;
        body: Matter.Body;
        isEcho: boolean;
      }[] = [];
      const bobRadius = getEffectiveBobRadius(pendulumHandle);

      const hitters: { body: Matter.Body; isEcho: boolean }[] = [
        ...getOrderedBobBodies(pendulumHandle).map((body) => ({
          body,
          isEcho: false,
        })),
        ...echoBobs.map((e) => ({ body: e.body, isEcho: true })),
      ];

      for (const hitter of hitters) {
        for (const handle of field.zones) {
          const z = handle.zone;
          const dx = hitter.body.position.x - z.position.x;
          const dy = hitter.body.position.y - z.position.y;
          if (Math.hypot(dx, dy) > bobRadius + z.radius) continue;
          const key = zoneOverlapKey(hitter.body.id, z.id);
          nextOverlaps.add(key);
          if (!zoneOverlapKeys.has(key)) {
            newHits.push({ handle, body: hitter.body, isEcho: hitter.isEcho });
          }
        }
      }

      for (const hit of newHits) {
        scoreZoneHit(hit.handle, hit.body, now, hit.isEcho);
      }

      zoneOverlapKeys.clear();
      for (const key of nextOverlaps) zoneOverlapKeys.add(key);
    }

    function echoLinkSpacing(): number {
      const radius = getEffectiveBobRadius(pendulumHandle);
      return pendulum.bobCount > 1 ? pendulum.bobSpacing : radius * 2.4;
    }

    function syncEchoBobs(desired: number) {
      while (echoBobs.length < desired) {
        const radius = getEffectiveBobRadius(pendulumHandle);
        const body = Matter.Bodies.circle(
          pendulumHandle.pivot.position.x,
          pendulumHandle.pivot.position.y + 50,
          radius,
          {
            isStatic: true,
            isSensor: true,
            frictionAir: 0,
            label: `echo-${echoBobs.length}`,
          }
        );
        Matter.World.add(engineHandle.world, body);
        echoBobs.push({ body, index: echoBobs.length });
      }
      while (echoBobs.length > desired) {
        const e = echoBobs.pop()!;
        Matter.World.remove(engineHandle.world, e.body);
      }
    }

    function syncEchoBobScales() {
      const radius = getEffectiveBobRadius(pendulumHandle);
      for (const e of echoBobs) {
        const current = e.body.circleRadius ?? radius;
        if (Math.abs(current - radius) < 0.001) continue;
        Matter.Body.scale(e.body, radius / current, radius / current);
      }
    }

    function positionEchoBobs() {
      if (echoBobs.length === 0) return;
      const tip = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
      const pivot = pendulumHandle.pivot.position;
      const dx = tip.position.x - pivot.x;
      const dy = tip.position.y - pivot.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const chainLinks = pendulumHandle.chainBobs.length;
      const spacing = echoLinkSpacing();

      if (chainLinks > 0) {
        const scaledAttach = attachment.length * pendulumHandle.ropeLengthScale;
        const nominalTotal = scaledAttach + pendulum.bobSpacing * chainLinks;
        const stretch = dist / nominalTotal;
        for (const e of echoBobs) {
          const nominalAlong =
            scaledAttach + pendulum.bobSpacing * (chainLinks + 1 + e.index);
          const r = nominalAlong * stretch;
          Matter.Body.setPosition(e.body, {
            x: pivot.x + ux * r,
            y: pivot.y + uy * r,
          });
        }
      } else {
        for (const e of echoBobs) {
          const r = dist + spacing * (e.index + 1);
          Matter.Body.setPosition(e.body, {
            x: pivot.x + ux * r,
            y: pivot.y + uy * r,
          });
        }
      }
    }

    function scoreZoneHit(
      handle: HitZoneHandle,
      bobBody: Matter.Body,
      now: number,
      isEcho: boolean
    ) {
      const state = useGameStore.getState();
      const effects$ = aggregateEffects(state.activeModifiers, state.persistentBonuses);
      const z = handle.zone;
      // Echo hits land at 50% value so Multi-Bob feels strong but doesn't
      // dwarf the player's actual swing.
      const echoFactor = isEcho ? 0.5 : 1;
      const base =
        z.basePoints *
        z.multiplier *
        pendulum.basePointMultiplier *
        (attachment.bonuses.momentumMult ?? 1) *
        effects$.pointMult *
        echoFactor;
      const comboStacks = state.combo.count + 1;
      const comboBonus = Math.min(20, comboStacks) * 0.05;
      const total = Math.max(1, Math.round(base * (1 + comboBonus)));

      state.registerHit(total, now);
      handle.hitFlashUntil = now + 240;

      emitHit(effects, z.position, now, {
        color: isEcho ? "#c084fc" : "#facc15",
        points: total,
        intensity: (1 + Math.min(2, comboStacks / 12)) * (isEcho ? 0.6 : 1),
      });

      playGameSound(isEcho ? "zone-hit-echo" : "zone-hit", {
        pitch: 0.9 + Math.min(comboStacks, 20) * 0.025,
        volume: isEcho ? 0.55 : 0.5 + Math.min(z.multiplier, 5) * 0.08,
      });

      // Hit-stop on every real-bob impact: brief whole-scene freeze so the
      // contact reads as a physical hit. No velocity is changed — the bob
      // (and any spin/twist it has) resumes exactly where it was, so the
      // pendulum no longer "decelerates" off a multiplier circle.
      if (!isEcho) {
        requestHitStop(now, HIT_STOP_MS);

        if (comboStacks > 1 && comboStacks % 5 === 0) {
          const bonus = 5 * comboStacks;
          state.addMomentum(bonus);
          playGameSound("combo-milestone", { pitch: 1 + comboStacks * 0.02 });
          emitManeuver(
            effects,
            bobBody.position,
            `Combo x${comboStacks} +${bonus}`,
            now
          );
        }

        // Run Again lucky-drop: the very first real-bob zone hit of a run
        // launched via Run Again has a 70% chance (rolled at startRun) of
        // being forced to drop a token regardless of the zone's normal
        // modifierChance. We consume the guarantee here so subsequent hits
        // this run roll the normal chance. Whether or not the guarantee
        // fires, the zone's own modifierChance is also rolled — so a lucky
        // zone with a high modifierChance can still double up.
        const guaranteed = state.consumeFirstDropGuarantee();
        if (guaranteed || Math.random() < z.modifierChance) {
          // Spawn an on-canvas token instead of silently buffing the player.
          // The bob has to actually swing through the token to collect it.
          // On a Run Again that won the 40% buff roll, the very first token to
          // actually drop is forced to be a beneficial buff. consumeFirstBuff-
          // Guarantee fires (and clears) only once, so later drops this run
          // roll normally.
          const buffGuaranteed = state.consumeFirstBuffGuarantee();
          const def = buffGuaranteed ? rollRandomBuffToken() : rollRandomToken();
          spawnToken(engineHandle.world, tokenField, def, z.position, now);
          playGameSound(
            def.kind === "golden" ? "token-spawn-golden" : "token-spawn"
          );
          emitManeuver(
            effects,
            z.position,
            buffGuaranteed
              ? "GUARANTEED BUFF!"
              : guaranteed
                ? "LUCKY DROP!"
                : def.kind === "golden"
                  ? "GOLDEN TOKEN!"
                  : `${def.name} appeared`,
            now
          );
        }
      }

      relocateZone(field, handle, pendulumReach, spawnClearance);
    }

    function collectToken(handle: TokenHandle, bobBody: Matter.Body, now: number) {
      if (handle.token.consumed) return;
      handle.token.consumed = true;
      const def = handle.def;
      const state = useGameStore.getState();

      if (def.kind === "repair") {
        // Rope Patch: top the current rope's durability back up, capped at full.
        durability = Math.min(1, durability + REPAIR_AMOUNT);
        playGameSound("token-collect", { variant: def.kind });
        emitHit(effects, handle.token.position, now, {
          color: def.color,
          points: 0,
          intensity: 1.4,
        });
        emitManeuver(effects, handle.token.position, "Rope Patched", now);
        void bobBody;
        return;
      }

      if (def.isGolden) {
        state.claimGoldenToken();
        playGameSound("token-collect-golden");
        emitHit(effects, handle.token.position, now, {
          color: def.color,
          points: 0,
          intensity: 2.5,
        });
        emitManeuver(
          effects,
          handle.token.position,
          "GOLDEN TOKEN READY!",
          now
        );
        void bobBody;
        return;
      }

      if (def.grantsModifierId) {
        state.pushModifier(def.grantsModifierId, now);
        // Carry the same modifier for a stacked time window so a hot streak's
        // buffs don't evaporate the moment the pendulum stalls. Each pickup
        // stacks rather than refreshing — chaining the same token twice
        // genuinely doubles up. Multi-Bob and Speed Ramp are timed-only — they
        // must not linger via cross-run stacks.
        if (
          def.grantsModifierId !== "multi-bob" &&
          def.grantsModifierId !== "speed-ramp"
        ) {
          state.addPersistentBonus(def.grantsModifierId, now);
        }
      }

      if (def.kind === "velocity-surge") {
        // Velocity Surge gives an instant impulse on top of its modifier so
        // the player feels the kick immediately.
        applyVelocityKick(pendulumHandle);
      }

      playGameSound("token-collect", { variant: def.kind });
      emitHit(effects, handle.token.position, now, {
        color: def.color,
        points: 0,
        intensity: 1.4,
      });
      emitManeuver(effects, handle.token.position, `+ ${def.name}`, now);

      void bobBody;
    }

    // Reflect a freed bob off a wall and amplify it — the "extra impulse" of a
    // bumper hit. We reflect the into-wall velocity component so the bob always
    // heads back into the field, then scale the whole vector by `boost`. A floor
    // on the inward component keeps near-tangent grazes feeling punchy too.
    function bounceBobOffWall(bob: Matter.Body, wall: BoundaryWall, boost: number) {
      const n = wall.normal;
      let rx = bob.velocity.x;
      let ry = bob.velocity.y;
      const vn = rx * n.x + ry * n.y;
      if (vn < 0) {
        rx -= 2 * vn * n.x;
        ry -= 2 * vn * n.y;
      }
      rx *= boost;
      ry *= boost;
      const MIN_INWARD = 7 * WORLD_SCALE;
      const inward = rx * n.x + ry * n.y;
      if (inward < MIN_INWARD) {
        rx += n.x * (MIN_INWARD - inward);
        ry += n.y * (MIN_INWARD - inward);
      }
      Matter.Body.setVelocity(bob, { x: rx, y: ry });
    }

    // One discrete wall hit: fired on a fresh bob→wall contact (collisionStart).
    // Each separate impact lands exactly one point of damage — a bob resting or
    // grinding against the wall does NOT keep wearing it down over time; it has
    // to pull away and slam in again to deal another hit.
    function handleWallHit(
      wallBody: Matter.Body,
      bobBody: Matter.Body,
      now: number
    ) {
      const wall = findWallByBody(wallField, wallBody);
      if (!wall || wall.broken) return;
      // Gentle grazes just bounce off Matter's own restitution — only a real
      // slam triggers the bumper kick / break event.
      const speed = Math.hypot(bobBody.velocity.x, bobBody.velocity.y);
      if (speed < WALL_HIT_MIN_SPEED) return;

      const shattered = damageWall(engineHandle.world, wallField, wall);
      bounceBobOffWall(bobBody, wall, shattered ? WALL_BREAK_BOOST : WALL_BOUNCE_BOOST);
      emitHit(effects, { x: bobBody.position.x, y: bobBody.position.y }, now, {
        color: shattered ? "#f87171" : "#fbbf24",
        points: 0,
        intensity: shattered ? 1.8 : 0.9,
      });
      if (shattered) {
        // Flat reward for breaking a wall, on top of the ricochet impulse.
        useGameStore.getState().addMomentum(WALL_BREAK_BONUS);
        playGameSound("bonus-zones-spawn", { volume: 0.7 });
        emitManeuver(effects, bobBody.position, `WALL BREAK! +${WALL_BREAK_BONUS}`, now);
      } else {
        playGameSound("zone-hit", { pitch: 0.7, volume: 0.4 });
      }
    }

    // Standing (unbroken) wall on a given side, or null when that side is open.
    function wallForSide(side: WallSide): BoundaryWall | null {
      for (const w of wallField.walls) {
        if (w.side === side && !w.broken) return w;
      }
      return null;
    }

    // Land one discrete hit on a breakable wall from a rope-riding bob. Chain
    // links and echo bobs are kinematically positioned, so Matter never resolves
    // their wall contacts and their `velocity` is zeroed each frame — we derive a
    // slam speed from frame-to-frame motion. This is only called on a *new*
    // contact (see containKinematicBobInWalls), so a bob held against the wall by
    // the rope deals a single hit, not continuous time-based wear.
    function wearWallFromKinematicBob(
      wall: BoundaryWall,
      bobPos: { x: number; y: number },
      speed: number,
      now: number
    ) {
      if (!wallField.breakable || wall.broken) return;
      if (speed < WALL_HIT_MIN_SPEED) return;

      const shattered = damageWall(engineHandle.world, wallField, wall);
      emitHit(effects, { x: bobPos.x, y: bobPos.y }, now, {
        color: shattered ? "#f87171" : "#fbbf24",
        points: 0,
        intensity: shattered ? 1.8 : 0.9,
      });
      if (shattered) {
        useGameStore.getState().addMomentum(WALL_BREAK_BONUS);
        playGameSound("bonus-zones-spawn", { volume: 0.7 });
        emitManeuver(effects, bobPos, `WALL BREAK! +${WALL_BREAK_BONUS}`, now);
      }
    }

    // Previous-frame positions for the kinematic bobs, used to estimate how
    // hard a rope-riding bob is pushing into a wall (its body.velocity is 0).
    const kinematicWallLastPos = new Map<number, { x: number; y: number }>();
    // Which wall sides each kinematic bob was already touching last frame, so a
    // sustained press only counts as a hit on the frame it first makes contact —
    // not on every frame it stays pinned. Cleared per side as the bob pulls away.
    const kinematicWallContact = new Map<number, Set<WallSide>>();

    // Keep one rope-riding bob (a twin/triple chain link or a Multi-Bob echo)
    // inside the wall cage. These bodies are positioned by hand to track the
    // rope, so they'd otherwise sail straight through the static walls. We clamp
    // the position against every standing wall (giving them a real hitbox) and,
    // on breakable sites, wear the wall down when the push is hard enough.
    function containKinematicBobInWalls(
      body: Matter.Body,
      radius: number,
      now: number,
      dt: number
    ) {
      const { minX, minY, maxX, maxY } = wallField.bounds;
      // Speed is derived from the *unclamped* rope-desired position so a bob
      // pinned against a wall still reads its true sweep speed (its clamped
      // position barely moves). Expressed in per-physics-step units to match
      // `body.velocity` and the WALL_HIT_MIN_SPEED threshold the freed bobs use.
      const incomingX = body.position.x;
      const incomingY = body.position.y;
      const prev = kinematicWallLastPos.get(body.id);
      let speed = 0;
      if (prev && dt > 0) {
        const dist = Math.hypot(incomingX - prev.x, incomingY - prev.y);
        speed = (dist / dt) * (1000 / 60);
      }

      let x = incomingX;
      let y = incomingY;
      const hits: BoundaryWall[] = [];

      const left = wallForSide("left");
      if (left && x - radius < minX) {
        x = minX + radius;
        hits.push(left);
      }
      const right = wallForSide("right");
      if (right && x + radius > maxX) {
        x = maxX - radius;
        hits.push(right);
      }
      const top = wallForSide("top");
      if (top && y - radius < minY) {
        y = minY + radius;
        hits.push(top);
      }
      const bottom = wallForSide("bottom");
      if (bottom && y + radius > maxY) {
        y = maxY - radius;
        hits.push(bottom);
      }

      if (x !== incomingX || y !== incomingY) {
        Matter.Body.setPosition(body, { x, y });
        Matter.Body.setVelocity(body, { x: 0, y: 0 });
      }

      // Only count a hit on the frame a bob *newly* touches a given wall side. A
      // bob the rope keeps pressed against the wall stays in `prevSides`, so it
      // never re-damages until it pulls off and slams back in.
      const prevSides = kinematicWallContact.get(body.id);
      const curSides = new Set<WallSide>();
      for (const wall of hits) {
        curSides.add(wall.side);
        if (!prevSides || !prevSides.has(wall.side)) {
          wearWallFromKinematicBob(wall, { x, y }, speed, now);
        }
      }
      if (curSides.size > 0) kinematicWallContact.set(body.id, curSides);
      else kinematicWallContact.delete(body.id);

      // Track the unclamped rope position so next frame's speed reflects how
      // fast the rope is sweeping the bob, not the clamped wall-pinned spot.
      kinematicWallLastPos.set(body.id, { x: incomingX, y: incomingY });
    }

    // Contain every rope-riding bob (chain links + echoes) after they've been
    // snapped onto the rope line for this frame. Only relevant while strung —
    // once the rope breaks these become free dynamic bodies that Matter and
    // handleWallHit resolve against the walls directly.
    function containRopeBobsInWalls(now: number, dt: number) {
      if (wallField.walls.length === 0) return;
      const radius = getEffectiveBobRadius(pendulumHandle);
      for (const chainBob of pendulumHandle.chainBobs) {
        containKinematicBobInWalls(
          chainBob,
          chainBob.circleRadius ?? radius,
          now,
          dt
        );
      }
      for (const e of echoBobs) {
        containKinematicBobInWalls(e.body, e.body.circleRadius ?? radius, now, dt);
      }
    }

    // Auto end-of-run (the "hard end" — idle timeout or every freed bob having
    // escaped the cage). On top of stopping the run, this rebuilds the arena:
    // every shattered wall is restored and all durability topped back to
    // pristine, so the next run starts against whole walls.
    function hardEndRun(at: { x: number; y: number }, now: number) {
      useGameStore.getState().endRun();
      if (wallField.breakable) {
        regenerateWallField(engineHandle.world, wallField);
      }
      playGameSound("run-complete");
      emitManeuver(effects, at, "Run Complete", now);
    }

    function handleCollision(evt: Matter.IEventCollision<Matter.Engine>) {
      const now = performance.now();
      for (const pair of evt.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        const bobBody = a.label.startsWith("bob-")
          ? a
          : b.label.startsWith("bob-")
            ? b
            : null;
        if (!bobBody) continue;

        // Walls have a live hitbox at all times — both during the run (a long
        // swing or an extended Multi-Bob can drive a bob into the cage) and
        // while the freed bobs ricochet after a snap. The dynamic tip/free bobs
        // resolve here via Matter; the kinematic chain/echo bobs that ride the
        // rope are contained separately in containRopeBobsInWalls.
        if (wallField.walls.length > 0) {
          const wallBody = a.label === "wall" ? a : b.label === "wall" ? b : null;
          if (wallBody) {
            handleWallHit(wallBody, bobBody, now);
            continue;
          }
        }

        const tokenBody = isTokenBody(a) ? a : isTokenBody(b) ? b : null;
        if (!tokenBody) continue;
        const tHandle = findTokenByBody(tokenField, tokenBody);
        if (tHandle) collectToken(tHandle, bobBody, now);
      }
    }

    Matter.Events.on(engineHandle.engine, "collisionStart", handleCollision);

    // Enforce the pendulum's max swing speed every physics step. Done here
    // (not in the RAF loop) so velocity can never escape the cap between the
    // Runner's fixed steps and the next animation frame.
    const clampSwingSpeed = () => {
      // While snapped the bobs are free projectiles, not orbiting the pivot —
      // the angular-velocity clamp assumes an orbit and would mangle them.
      if (pendulumHandle.snapped) return;
      clampAngularVelocity(pendulumHandle, pendulum.maxAngularVelocity);
    };
    Matter.Events.on(engineHandle.engine, "afterUpdate", clampSwingSpeed);

    let lastT = performance.now();
    let raf = 0;
    const ctx = canvas.getContext("2d")!;

    function frame(now: number) {
      const inHitStop = now < hitStopUntil;
      // During hit-stop we still keep `lastT` moving forward so we don't
      // dump a huge accumulated delta into particles/effects the frame the
      // freeze ends — instead we just feed dt=0 to everything.
      const dt = inHitStop ? 0 : Math.min(64, now - lastT);
      lastT = now;
      engineHandle.engine.timing.timeScale = inHitStop ? 0 : 1;
      const store = useGameStore.getState();
      store.expireModifiers(now);
      store.decayCombo(now, 1800);

      const effects$ = aggregateEffects(store.activeModifiers, store.persistentBonuses);
      setPendulumWeightScale(pendulumHandle, effects$.weightMult);
      setBobRadiusScale(pendulumHandle, effects$.bobSizeMult);
      setRopeLengthScale(pendulumHandle, effects$.ropeLengthMult);
      setGravity(engineHandle, site.gravity * effects$.accelerationMult);

      // --- Rope durability: drain while swinging, snap at zero ---
      if (store.isRunning && !pendulumHandle.snapped && dt > 0) {
        // Heavier bobs (and the weight-mult modifier) wear the rope faster.
        const wearWeight = pendulum.weight * effects$.weightMult;
        durability -= durabilityDrainPerSec(ropeMaterial, wearWeight) * (dt / 1000);
        if (durability <= 0) {
          durability = 0;
          snapRope(pendulumHandle);
          syncEchoBobs(0);
          playGameSound("rope-snap");
          emitManeuver(
            effects,
            pendulumHandle.bobs[pendulumHandle.bobs.length - 1].position,
            "SNAP!",
            now
          );
        }
      }
      const snapped = pendulumHandle.snapped;

      // While snapped the rope is detached — its constraint forces and the
      // chain-bob repositioning no longer apply to the free-flying bobs.
      if (!snapped) tickAttachmentPhysics(pendulumHandle);
      if (store.isRunning && dt > 0 && !snapped) {
        const targetRampMult = getSpeedRampMultiplier(store.activeModifiers, now);
        if (targetRampMult <= 1) {
          speedRampAppliedMult = 1;
        } else {
          speedRampAppliedMult = applySpeedRampDelta(
            pendulumHandle,
            targetRampMult,
            speedRampAppliedMult
          );
        }
      }
      if (site.ambient && store.isRunning) {
        applyAmbientForce(engineHandle, pendulumHandle.bobs, site.ambient);
        if (!snapped) {
          applyAmbientForce(engineHandle, pendulumHandle.ropeSegments, {
            x: site.ambient.x * 0.35,
            y: site.ambient.y * 0.35,
          });
        }
      }

      // Spawn / despawn echo sensor bodies to match the active Multi-Bob
      // modifier, then snap them onto the rope line trailing the real bob.
      // Echoes are rope-relative, so they're suppressed during a free-fly.
      syncEchoBobs(snapped ? 0 : effects$.echoCount);
      syncEchoBobScales();
      if (!snapped) {
        positionChainBobs(pendulumHandle);
        positionEchoBobs();
        // Give the rope-riding bobs (twin/triple links + Multi-Bob echoes) a
        // real wall hitbox during the run: clamp them inside the cage and let
        // them wear down breakable walls, just like the freed bobs after a snap.
        containRopeBobsInWalls(now, dt);
      }
      tickBobZoneHits(now);
      tickTokens(tokenField, now);
      const reaped = reapTokens(engineHandle.world, tokenField, now);
      if (reaped.expired.length > 0) {
        playGameSound("token-expire", { volume: 0.7 });
      }

      if (launchPendingRef.current) {
        launchPendingRef.current = false;
        // A snapped rig (e.g. Run Again pressed mid-finale) must be re-strung
        // before it can swing again, and the fresh run starts at full durability.
        if (pendulumHandle.snapped) restoreRope(pendulumHandle);
        durability = 1;
        // Every fresh run starts against a pristine arena: rebuild any walls
        // shattered last run and top all durability back up. This runs on every
        // launch (manual Run Again or Auto-Run), which bypass the hard-end
        // timeout, so walls always reset between runs — not only on a hard end.
        if (wallField.breakable) {
          regenerateWallField(engineHandle.world, wallField);
        }
        // Reroll every hit zone (new positions and new multipliers) so each
        // new run gets a fresh playfield. Stale tokens from a prior run go
        // with it — they shouldn't survive into a new launch.
        regenerateHitZones(
          engineHandle.world,
          field,
          pendulumReach,
          spawnClearance
        );
        destroyTokenField(engineHandle.world, tokenField);
        launchPendulum(pendulumHandle, attachment, pendulum, effects$);
        store.registerSwing();
        runIdleMs = 0;
        runStallLowMs = 0;
        speedRampAppliedMult = 1;
        maneuvers.reset();
        playGameSound("launch");
        emitManeuver(effects, pendulumHandle.bobs[0].position, "LAUNCH!", now);
      }

      if (tokenLaunchPendingRef.current > 0) {
        // Drain one queued spend per frame. Any extras stay in the counter
        // and fire on subsequent frames, so spending N tokens produces N
        // sequential re-launch impulses instead of collapsing into one beat.
        tokenLaunchPendingRef.current -= 1;
        // The store's spendGoldenToken() already guarded on isRunning, but the
        // run may have ended in the gap before the next frame fired. Double-
        // check so we never apply a re-launch to a stopped pendulum.
        if (store.isRunning) {
          // A Golden Token re-strings a snapped rig and refills durability, so
          // any bobs freed by the snap finale come back onto the rope and the
          // run keeps going on a whole rope — on top of the usual re-launch +
          // bonus below.
          if (pendulumHandle.snapped) {
            restoreRope(pendulumHandle);
          }
          durability = 1;
          // Spending the token also resets the arena: every shattered wall is
          // rebuilt and all durability topped back up to pristine.
          if (wallField.breakable) {
            regenerateWallField(engineHandle.world, wallField);
          }

          // Each spent Golden Token extends the active bonus and stacks a
          // matching persistent layer — both capped per modifier defId.
          const bonusMs =
            GOLDEN_TOKEN_BASE_DURATION_MS + store.goldenTokenBonusMs;
          store.pushModifier("token-bonus", now, bonusMs);
          useGameStore.getState().addPersistentBonus("token-bonus", now, bonusMs);

          const boostedState = useGameStore.getState();
          const boostedEffects = aggregateEffects(
            boostedState.activeModifiers,
            boostedState.persistentBonuses
          );
          relaunchPendulum(pendulumHandle, attachment, boostedEffects);
          useGameStore.getState().registerSwing();
          // The pendulum is alive again — clear stall state so Run Again doesn't
          // stay falsely lit during the boost.
          runIdleMs = 0;
          runStallLowMs = 0;
          if (store.runStalled) {
            useGameStore.setState({ runStalled: false });
          }

          // Drop a fresh batch of multiplier circles into the run for the
          // boosted spin to gobble up. Stacking tokens stacks playfield
          // density too — up to the field cap — so the snowball loop has
          // more fuel each successive spend.
          const newZones = spawnExtraZones(
            engineHandle.world,
            field,
            bonusZonesPerGolden(site.hitZoneCount),
            pendulumReach,
            spawnClearance
          );
          for (const nz of newZones) {
            emitHit(effects, nz.zone.position, now, {
              color: "#fde047",
              points: 0,
              intensity: 1.1,
            });
          }
          playGameSound("bonus-zones-spawn");
          playGameSound("token-relaunch");

          emitManeuver(
            effects,
            pendulumHandle.bobs[pendulumHandle.bobs.length - 1].position,
            "TOKEN RE-LAUNCH!",
            now
          );
        }
      }

      const last = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];

      if (store.isRunning) {
        let maxSpeed = 0;
        // Include the freed chain bobs while snapped so the run only ends once
        // every flying bob has settled, not just the tip.
        for (const bob of getOrderedBobBodies(pendulumHandle)) {
          const s = Math.hypot(bob.velocity.x, bob.velocity.y);
          if (s > maxSpeed) maxSpeed = s;
        }

        // Escape end: once the rope has snapped and every freed bob has flown
        // clear off the field, the run can produce nothing more. End it now so
        // Run Again lights up — without this, the accelerating bobs falling
        // into the void never drop below the idle-speed threshold and the run
        // would hang forever (the wall-less Workshop relies entirely on this).
        if (snapped) {
          // Escape is measured against the cage rectangle (which grows with the
          // site's cageScale), so a bob still ricocheting inside a large arena
          // isn't mistaken for one that has flown clear of the field.
          const cage = wallField.bounds;
          let allEscaped = true;
          for (const bob of getOrderedBobBodies(pendulumHandle)) {
            if (
              bob.position.x >= cage.minX - FIELD_ESCAPE_MARGIN &&
              bob.position.x <= cage.maxX + FIELD_ESCAPE_MARGIN &&
              bob.position.y >= cage.minY - FIELD_ESCAPE_MARGIN &&
              bob.position.y <= cage.maxY + FIELD_ESCAPE_MARGIN
            ) {
              allEscaped = false;
              break;
            }
          }
          if (allEscaped) {
            hardEndRun(last.position, now);
          }
        }
        // Idle timer with hysteresis: count up once the rig is below the rest
        // threshold, but only zero it back out on a genuine re-swing (a token
        // re-launch crossing the stall speed) — NOT on the low-amplitude rope
        // jitter that lingers as the swing dies. Without the hysteresis a single
        // jitter spike above 0.45 would keep resetting the timer and the run
        // would never auto-end.
        if (maxSpeed < RUN_END_SPEED_THRESHOLD) {
          runIdleMs += dt;
        } else if (maxSpeed > STALL_SPEED_THRESHOLD) {
          runIdleMs = 0;
        }
        // Soft stall detection: pendulum has decelerated past its prime and
        // can no longer reasonably reach a hit zone. This flips the launch
        // button into a clickable "Run Again" state before the harder auto
        // end-of-run condition fires.
        if (maxSpeed < STALL_SPEED_THRESHOLD) {
          runStallLowMs += dt;
        } else {
          runStallLowMs = 0;
        }
        // The "dead tail": the swing is spent and the run is just waiting to
        // auto-end. We key this off the local stall timer (not store.runStalled)
        // so a Golden Token re-launch — which resets runStallLowMs to 0 above —
        // immediately pulls us back out of it.
        const inDeadTail = runStallLowMs >= STALL_TIME_MS;
        if (inDeadTail && !store.runStalled) {
          useGameStore.getState().markRunStalled();
          playGameSound("run-stall", { volume: 0.6 });
        }

        // Only score maneuvers while the swing is still live. Past the stall
        // point the rope is just soft-constraint jitter settling out, and that
        // jitter flips the bob's spin sign back and forth fast enough — with the
        // odd residual speed spike — to register phantom "double swing" events.
        // Stop detecting once the run is spent. Snapped bobs aren't orbiting
        // the pivot any more, so maneuver detection is meaningless then too.
        if (!inDeadTail && !snapped) {
          const events = maneuvers.push(now, last, pendulumHandle.pivot.position);
          for (const ev of events) {
            useGameStore.getState().addMomentum(ev.def.bonus);
            playGameSound("maneuver", { variant: ev.def.id });
            emitManeuver(effects, last.position, `${ev.def.name} +${ev.def.bonus}`, now);
          }
        }

        // Natural air resistance: a smooth, speed-aware decay applied every
        // frame instead of a binary stall switch. Above SETTLE_REF_SPEED no
        // extra drag is applied (the swing breathes freely on its built-in
        // frictionAir); below it the decay rate eases up quadratically toward
        // SETTLE_PEAK_RATE, so the soft rope settles cleanly without ever
        // feeling a sudden grab — and without springing back hard enough to
        // register phantom Double Swings on the way down.
        // Skip all rest-settling while snapped: it pulls bodies toward the rope
        // rest pose, which would teleport the free-flying bobs back to the line.
        if (!snapped && dt > 0 && maxSpeed < SETTLE_REF_SPEED) {
          const t = (SETTLE_REF_SPEED - maxSpeed) / SETTLE_REF_SPEED;
          const rate = SETTLE_PEAK_RATE * t * t;
          if (rate > 1e-4) {
            dampPendulumMotion(pendulumHandle, dt, rate);
          }
        }
        // Then, once the rig is essentially still, also lerp rope+bob toward
        // their hanging rest pose. This is the only thing that actually kills
        // the gravity-vs-spring "bounce" loop: damping bleeds KE, but the
        // constraint solver keeps re-injecting it from the bob's weight. The
        // pull strength fades with speed so it's invisible above the rest
        // threshold and feels like the rig naturally settling, not snapping.
        if (!snapped && dt > 0 && maxSpeed < SETTLE_REST_THRESHOLD) {
          const t = (SETTLE_REST_THRESHOLD - maxSpeed) / SETTLE_REST_THRESHOLD;
          const alpha = 1 - Math.exp(-SETTLE_REST_RATE * t * t * (dt / 1000));
          if (alpha > 1e-4) {
            settlePendulumTowardRest(pendulumHandle, alpha);
          }
        }
        if (runIdleMs >= RUN_END_IDLE_MS) {
          runIdleMs = 0;
          hardEndRun(last.position, now);
        }
      } else {
        maneuvers.reset();
        runIdleMs = 0;
        runStallLowMs = 0;
        if (pendulumHandle.snapped && wallless) {
          // Workshop: the snap threw the bobs clean off the bench, so there's
          // nothing to bring back. By design we do NOT auto-restore here —
          // we hold the snapped pose (empty rope dangling, bobs gone) until the
          // player hits Run Again, which re-strings the rope and relaunches.
          settleEmptyRope(pendulumHandle);
        } else {
          // The run ended on a snapped rig in a walled arena: re-string the rope
          // so the between-runs idle pose is whole again, and restore full
          // durability for the next launch.
          if (pendulumHandle.snapped) {
            restoreRope(pendulumHandle);
            durability = 1;
          }
          // Between runs the engine keeps stepping, and the rope is a chain of
          // soft spring constraints — under gravity those light, whippy links
          // never fully settle, so the bob/rope jitter ("bounce") forever in
          // repose. Runs only ever end after the rig has already gone quiet, so
          // we can simply pin it to its rest pose every idle frame: the residual
          // constraint jitter the runner introduces between frames is overwritten
          // before it's ever rendered.
          resetPendulumToRest(pendulumHandle);
        }
      }

      tickEffects(effects, dt, now);

      try {
        const view = viewRef.current;
        const dpr = canvas.width / Math.max(1, view.displayWidth);
        const { cameraZoom: zoom, cameraPanX, cameraPanY } = useGameStore.getState();

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        drawScreenBackdrop(ctx, view.displayWidth, view.displayHeight, site);

        ctx.save();
        applyShake(
          { ctx, width: view.displayWidth, height: view.displayHeight, now },
          effects
        );
        applyWorldCamera(ctx, view, ANCHOR, zoom, cameraPanX, cameraPanY);

        const rc: RenderContext = { ctx, width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT, now };
        drawSiteAnchor(rc, ANCHOR);
        drawWalls(rc, wallField);
        drawHitZones(rc, field);
        drawTokens(rc, tokenField);
        const echoRender: EchoBobRender[] = echoBobs.map((e) => ({
          x: e.body.position.x,
          y: e.body.position.y,
          radius: getEffectiveBobRadius(pendulumHandle),
        }));
        const { skin: activeSkin, shape: activeShape } = resolveEquippedCosmetics(
          store.equipped
        );
        drawEchoBobs(rc, pendulumHandle.pivot.position, echoRender, activeSkin, activeShape.shape);
        drawPendulum(
          rc,
          pendulumHandle,
          pendulum,
          attachment,
          activeSkin,
          pendulumHandle.physics.stretchRatio,
          activeShape.shape,
          durability
        );
        drawEffects(rc, effects);
        ctx.restore();
        ctx.restore();
      } catch (err) {
        console.error("[GameCanvas] render frame failed:", err);
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      Matter.Events.off(engineHandle.engine, "collisionStart", handleCollision);
      Matter.Events.off(engineHandle.engine, "afterUpdate", clampSwingSpeed);
      destroyHitZones(engineHandle.world, field);
      destroyTokenField(engineHandle.world, tokenField);
      destroyWallField(engineHandle.world, wallField);
      for (const e of echoBobs) Matter.World.remove(engineHandle.world, e.body);
      echoBobs.length = 0;
      destroyPendulum(engineHandle.world, pendulumHandle);
      destroyEngine(engineHandle);
      pendulumHandleRef.current = null;
    };
    // Rebuild whenever equipped items change or worldVersion bumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendulum.id, attachment.id, site.id, worldVersion]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block h-full w-full select-none"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}

// Start Run / Run Again use the same capped relaunch as a Golden Token spend,
// after settling the rope so leftover motion from the prior run cannot whip it.
function launchPendulum(
  handle: PendulumHandle,
  attachment: import("../types").AttachmentDef,
  pendulum: import("../types").PendulumDef,
  effects$: { twistPowerMult: number }
) {
  resetPendulumToRest(handle);
  relaunchPendulum(handle, attachment, effects$);
  void pendulum;
}

// Golden Token spend: re-launch the pendulum WITHOUT throwing away its
// current swing. The token never resets velocity — it STACKS it. We:
//   1. Pick the direction that matches the bob's current motion so we
//      never fight the player's existing impulse.
//   2. Multiply each bob's existing velocity by VELOCITY_STACK_MULT so
//      consecutive spends genuinely compound (chain N tokens → velocity
//      multiplied by MULT^N, capped per-bob so physics stays sane).
//   3. Add a tangential kick on top of that so even a fully stalled
//      pendulum gets a usable fresh swing from a single spend.
function relaunchPendulum(
  handle: PendulumHandle,
  attachment: import("../types").AttachmentDef,
  effects$: { twistPowerMult: number }
) {
  const last = handle.bobs[handle.bobs.length - 1];
  const rx = last.position.x - handle.pivot.position.x;
  const ry = last.position.y - handle.pivot.position.y;
  // Tangent for positive (CCW) rotation around the pivot.
  const posTangentX = -ry;
  const posTangentY = rx;
  const dot = last.velocity.x * posTangentX + last.velocity.y * posTangentY;
  // Threshold avoids flipping direction when the bob is essentially still —
  // we just pick CCW arbitrarily so dead pendulums still get a kick.
  const dir = dot >= 0 ? 1 : -1;

  const twistBonus = attachment.bonuses.twistPowerBonus ?? 0;
  const velBonus = attachment.bonuses.velocityBonus ?? 0;
  // Modestly stronger than a regular launch — enough to reach circles without
  // the old token slingshot feel.
  const baseSpeed = 17 * WORLD_SCALE;
  const kick =
    baseSpeed *
    (1 + twistBonus) *
    (1 + velBonus) *
    effects$.twistPowerMult *
    (0.95 + Math.random() * 0.1);
  // Preserve and nudge existing velocity per spend; lower mult keeps chains
  // from snowballing while still compounding on back-to-back spends.
  const VELOCITY_STACK_MULT = 1.28;
  const MAX_SPEED_PER_AXIS = 72 * WORLD_SCALE;

  for (let i = 0; i < handle.bobs.length; i++) {
    const bob = handle.bobs[i];
    const bx = bob.position.x - handle.pivot.position.x;
    const by = bob.position.y - handle.pivot.position.y;
    const len = Math.hypot(bx, by) || 1;
    const tx = -by / len;
    const ty = bx / len;
    const segmentBoost = 1 - i * 0.05;
    const stackedX = bob.velocity.x * VELOCITY_STACK_MULT;
    const stackedY = bob.velocity.y * VELOCITY_STACK_MULT;
    const nextX = stackedX + tx * dir * kick * segmentBoost;
    const nextY = stackedY + ty * dir * kick * segmentBoost;
    Matter.Body.setVelocity(bob, {
      x: Math.max(-MAX_SPEED_PER_AXIS, Math.min(MAX_SPEED_PER_AXIS, nextX)),
      y: Math.max(-MAX_SPEED_PER_AXIS, Math.min(MAX_SPEED_PER_AXIS, nextY)),
    });
    if (i === handle.bobs.length - 1) {
      propagateRopeWhip(handle, { x: nextX, y: nextY }, 0.05);
    }
  }
}

// Velocity Surge token: amplifies every bob's current velocity in-place. We
// keep the direction the bob is already moving in (so we don't fight against
// the swing) and add a modest multiplicative kick plus a small floor for stalled bobs.
function applyVelocityKick(
  handle: PendulumHandle,
  opts: { mult?: number; floor?: number } = {}
) {
  const KICK_MULT = opts.mult ?? 1.28;
  const FLOOR = opts.floor ?? 4.5;
  for (const bob of handle.bobs) {
    const vx = bob.velocity.x;
    const vy = bob.velocity.y;
    const speed = Math.hypot(vx, vy);
    if (speed < 0.001) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      Matter.Body.setVelocity(bob, { x: FLOOR * dir, y: 0 });
      continue;
    }
    const scale = KICK_MULT + (FLOOR / Math.max(speed, 1)) * 0.35;
    Matter.Body.setVelocity(bob, { x: vx * scale, y: vy * scale });
    propagateRopeWhip(handle, { x: vx * scale, y: vy * scale }, 0.04);
  }
}
