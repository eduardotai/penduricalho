import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { useGameStore, CAMERA_ZOOM_MIN } from "../state/store";
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
  createRingObstacles,
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
  teleportRig,
  rigReach,
  feedBeltRope,
  reelBeltRope,
  beltPayoutRatio,
  resetBeltPayout,
  isBeltTunnelAttachment,
  feedBeltVirtual,
  reelBeltVirtual,
  beltVirtualPayoutRatio,
  resetBeltVirtual,
  type PendulumHandle,
} from "../game/pendulum";
import { PENDULUMS } from "../data/pendulums";
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
  drawObstacles,
  drawBlackHole,
  drawEchoBobs,
  drawBeltTunnel,
  type RenderContext,
  type EchoBobRender,
} from "../game/render";
import {
  advanceTunnelProgress,
  applyBeltLaunchKick,
  applyBeltTunnelContainment,
  applyStrictConveyorRail,
  generateBeltTunnelPath,
  sampleTunnel,
  sampleTunnelTangent,
  type BeltTunnelPath,
} from "../game/beltTunnel";
import {
  applyWorldCamera,
  computeViewTransform,
  type ViewTransform,
} from "../game/viewTransform";
import {
  ANCHOR,
  CAMERA_ZOOM_DEFAULT,
  COLLISION,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
  WORLD_SCALE,
} from "../game/worldConstants";
import {
  createEffectsState,
  emitHit,
  emitManeuver,
  tickEffects,
} from "../game/effects";

const RUN_END_SPEED_THRESHOLD = 0.45;
const RUN_END_IDLE_MS = 1500;
const AUTO_RUN_DELAY_MS = 1500;
// Grace window after a Mechanic Belt ejects its bob at the conveyor exit, during
// which the escape check can't hard-end the run — lets the thrown bob fly its
// full arc / bounce around the cage instead of being reset the instant it clips
// past the field margin.
const BELT_EJECT_FLY_MS = 2200;
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
// Breakable Bob shed pieces chip walls slowly — ~3 shard slams ≈ one full bob hit.
const WALL_SHARD_DAMAGE = 1 / 3;
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
  // Orientation-aware framing: set true the first time the player touches the
  // camera (wheel/pinch/drag) so we stop auto-fitting the default zoom on resize.
  const userAdjustedCameraRef = useRef(false);
  // Tracks the last zoom we auto-applied, so a portrait↔landscape rotation can
  // re-fit even though the stored zoom no longer equals the persisted default.
  const lastAutoZoomRef = useRef<number | null>(null);
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
      userAdjustedCameraRef.current = true;
      useGameStore.getState().adjustCameraZoom(factor);
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Multi-touch camera gestures plus the desktop space+drag fallback. All
    // coordinates are CSS display pixels (matching viewTransform's fit/cover),
    // so pan tracks the finger 1:1 regardless of devicePixelRatio.
    const PAN_THRESHOLD = 4; // css px before a touch drag starts panning
    const spaceHeld = { current: false };
    const pointers = new Map<number, { x: number; y: number }>();
    let panning = false; // a single-pointer pan gesture is active
    let panStarted = false; // crossed the movement threshold (touch) / immediate (mouse)
    let downPoint = { x: 0, y: 0 };
    let lastPan = { x: 0, y: 0 };
    let pinchPrevDist = 0;
    let pinchPrevMid = { x: 0, y: 0 };

    function blockedTarget(target: EventTarget | null) {
      return (target as HTMLElement | null)?.closest?.(
        "input, textarea, select, [data-no-camera-zoom]"
      );
    }

    function cssPoint(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function setPanCursor(active: boolean) {
      container!.style.cursor = active ? "grab" : "";
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
      panning = false;
      panStarted = false;
      setPanCursor(false);
    }

    function onPointerDown(e: PointerEvent) {
      if (blockedTarget(e.target)) return;
      const pt = cssPoint(e.clientX, e.clientY);
      if (!pt) return;
      const touch = e.pointerType === "touch";
      // Mouse/pen only pan while Space is held (preserve desktop behavior);
      // touch always drives the camera since the canvas has no tap action.
      if (!touch && !spaceHeld.current) return;

      pointers.set(e.pointerId, pt);
      container!.setPointerCapture?.(e.pointerId);
      e.preventDefault();

      if (pointers.size === 1) {
        panning = true;
        downPoint = pt;
        lastPan = pt;
        panStarted = !touch; // mouse+space starts immediately; touch waits for threshold
        if (panStarted) container!.style.cursor = "grabbing";
      } else if (pointers.size === 2) {
        // Two fingers down — switch from pan to pinch.
        panning = false;
        panStarted = false;
        const [a, b] = [...pointers.values()];
        pinchPrevDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchPrevMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      const pt = cssPoint(e.clientX, e.clientY);
      if (!pt) return;
      pointers.set(e.pointerId, pt);
      const view = viewRef.current;
      const cover = view.coverScale;
      const store = useGameStore.getState();

      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (pinchPrevDist > 0) {
          userAdjustedCameraRef.current = true;
          const factor = dist / pinchPrevDist;
          if (factor !== 1) {
            const focalU = (mid.x - view.fitX) / cover;
            const focalV = (mid.y - view.fitY) / cover;
            store.zoomAtScreenPoint(factor, focalU, focalV);
          }
          const mdx = mid.x - pinchPrevMid.x;
          const mdy = mid.y - pinchPrevMid.y;
          if (mdx !== 0 || mdy !== 0) store.panCamera(mdx / cover, mdy / cover);
        }
        pinchPrevDist = dist;
        pinchPrevMid = mid;
        return;
      }

      if (!panning) return;
      if (!panStarted) {
        if (Math.hypot(pt.x - downPoint.x, pt.y - downPoint.y) < PAN_THRESHOLD) return;
        panStarted = true;
        lastPan = pt; // reset origin so the camera doesn't jump by the threshold
        return;
      }
      const dx = pt.x - lastPan.x;
      const dy = pt.y - lastPan.y;
      lastPan = pt;
      if (dx !== 0 || dy !== 0) {
        userAdjustedCameraRef.current = true;
        store.panCamera(dx / cover, dy / cover);
      }
    }

    function endPointer(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      container!.releasePointerCapture?.(e.pointerId);
      if (pointers.size === 1) {
        // One finger lifted after a pinch — resume single-finger pan.
        const [p] = [...pointers.values()];
        panning = true;
        panStarted = true;
        downPoint = p;
        lastPan = p;
        pinchPrevDist = 0;
      } else if (pointers.size === 0) {
        panning = false;
        panStarted = false;
        pinchPrevDist = 0;
        setPanCursor(spaceHeld.current);
      }
    }

    function onBlur() {
      spaceHeld.current = false;
      panning = false;
      panStarted = false;
      pointers.clear();
      pinchPrevDist = 0;
      setPanCursor(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", endPointer);
    container.addEventListener("pointercancel", endPointer);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", endPointer);
      container.removeEventListener("pointercancel", endPointer);
      window.removeEventListener("blur", onBlur);
      setPanCursor(false);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;

    // Auto-frame the playfield for the current aspect ratio: portrait screens
    // crop the wide (1.6:1) world heavily at the desktop default zoom, so fit the
    // full world width — but never zoom in past the tuned default. Only runs
    // while the player hasn't manually adjusted the camera; once they pinch/drag
    // we leave their framing alone.
    function applyAutoFitZoom(view: ViewTransform) {
      if (userAdjustedCameraRef.current) return;
      const store = useGameStore.getState();
      const z = store.cameraZoom;
      const ours = lastAutoZoomRef.current;
      // Respect a returning player's persisted custom zoom: only auto-fit from
      // the default, or from a value we set ourselves on a previous resize.
      if (z !== CAMERA_ZOOM_DEFAULT && (ours === null || Math.abs(z - ours) > 1e-4)) {
        return;
      }
      const fit = Math.min(
        CAMERA_ZOOM_DEFAULT,
        Math.max(CAMERA_ZOOM_MIN, view.displayWidth / (view.coverScale * VIRTUAL_WIDTH))
      );
      lastAutoZoomRef.current = fit;
      if (Math.abs(fit - z) > 1e-4) store.setCameraZoom(fit);
    }

    function resizeCanvas() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const view = computeViewTransform(w, h, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      viewRef.current = view;
      applyAutoFitZoom(view);
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

    // Layers map: concentric ring walls centered on the mount, so the bob's
    // orbit threads through their rotating gaps. Stored on the wall field so
    // they're drawn each frame and torn down with everything else on unmount.
    if (site.wallShape === "rings") {
      wallField.obstacles = createRingObstacles(
        engineHandle.world,
        ANCHOR,
        site.ringCount ?? 4,
        Math.round(115 * WORLD_SCALE), // ring spacing (design px × world scale)
        Math.round(12 * WORLD_SCALE) // wall thickness
      );
    }

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

    // --- Behavior-bob run-local state (all reset on every fresh launch) ---
    const behavior = pendulum.behavior;
    // hunter (Ravager): the freed bob is actively homing onto live circles.
    let homingActive = false;
    let homingEats = 0;
    let homingStartedAt = 0;
    // When the rope last snapped (0 = currently strung). Behavior bobs keep
    // their identity through the finale; the re-energizing effects (piercer
    // dash, teleport blink, rocket thrust) only fire for this long after the
    // snap so the freed bob still coasts to a natural escape/idle end.
    let snappedAt = 0;
    const POST_SNAP_BEHAVIOR_MS = 4000;
    // piercer (Arrow): straight-line dash cadence + per-run count.
    let lastDashAt = 0;
    let dashCount = 0;
    // hydra (Mutant): heads grown this run + the hit counter that feeds them.
    let hydraBonusEcho = 0;
    let hydraHits = 0;
    // frenzy (Berserker): the velocity multiplier we've currently applied, so
    // combo-driven scaling ramps up and bleeds back down without compounding.
    let frenzyAppliedMult = 1;
    // teleport (TP): cadence of the random blinks.
    let lastTeleportAt = 0;
    // rocket (Rocket): when the current thrust ramp started.
    let rocketLaunchAt = 0;
    // splitter (Breakable): free-flying shed pieces + how many we've lost.
    const shards: Matter.Body[] = [];
    let shedCount = 0;
    // chaos (Random): current + target stat multipliers (relative to this bob's
    // own base stats), lerped toward fresh random targets each reroll.
    let chaosSizeCur = 1;
    let chaosSizeTarget = 1;
    let chaosWeightCur = 1;
    let chaosWeightTarget = 1;
    let chaosCapCur = 1;
    let chaosCapTarget = 1;
    let chaosRopeCur = 1;
    let chaosRopeTarget = 1;
    let lastChaosRollAt = 0;

    // Roster-wide stat extremes — the Chaos Bob's random churn is bounded by
    // the lightest/heaviest, smallest/largest, slowest/fastest rigs that exist.
    const rosterRadii = PENDULUMS.map((p) => p.bobRadius);
    const rosterWeights = PENDULUMS.map((p) => p.weight);
    const rosterAngVels = PENDULUMS.map((p) => p.maxAngularVelocity);
    const minRosterRadius = Math.min(...rosterRadii);
    const maxRosterRadius = Math.max(...rosterRadii);
    const minRosterWeight = Math.min(...rosterWeights);
    const maxRosterWeight = Math.max(...rosterWeights);
    const minRosterAngVel = Math.min(...rosterAngVels);
    const maxRosterAngVel = Math.max(...rosterAngVels);

    // --- Behavior-rope run-local state (the rope analog of the bob behaviors) ---
    const ropeBehavior = attachment.behavior;
    // belt (Mechanic): conveyor tunnel. Ride ends only when grip fades (bob slows down).
    // Repair drops refuel grip + give short speed boost. Stress retired.
    // flux (Random Rope): current + target length / drain-rate multipliers,
    // lerped toward fresh random targets each reroll (mirrors the Chaos bob).
    let fluxLenCur = 1;
    let fluxLenTarget = 1;
    let fluxDrainCur = 1;
    let fluxDrainTarget = 1;
    let lastFluxRollAt = 0;
    // metronome (Pendulum Rope): epoch the length oscillation is measured from,
    // re-zeroed each launch so every run's pump starts from full extension.
    let ropeEpoch = 0;
    // belt (Mechanic Rope): a random tunnel path rerolled each run and on
    // every spent token; the bob rides it on a conveyor instead of pivot-spin.
    // The bob is fully unattached (no rope constraints). Stress is tracked virtually.
    let beltTunnel: BeltTunnelPath | null = null;
    let beltPathT = 0;
    // Kept for legacy non-Mechanic-Belt ropes and for any future use.
    // The true Mechanic Belt no longer uses payout/stress (feature retired).
    let beltVirtualPayout = 1;
    const BELT_MAX_PAYOUT = 1.65;
    let beltGrip = 1; // 1 = full conveyor control, 0 = released into the strict tube (bounce until exit)
    let beltLowSpeedFrames = 0;

    // When true, the physical tunnel walls remain as a hard multilayer hitbox
    // even after the conveyor power/grip has failed ("snapped"). The bob
    // stays constrained inside the tunnel geometry.
    let beltTunnelWallsActive = false;

    // Prevents the strict rail from automatically re-attaching bobs after they
    // have ejected at the end of the path. Once a ride has started, we don't
    // want to loop the bob back onto the conveyor forever.
    let beltRailRideInitialized = false;

    // The Mechanic Belt bob is a fully FREE body (createPendulum builds no rope
    // and no constraints for it — see pendulum.ts isBeltTunnelAttachment). So the
    // conveyor ride is purely `applyStrictConveyorRail` hard-locking the bob onto
    // the path with setPosition. The exit-eject just STOPS doing that and flings
    // the bob; there is nothing to detach.
    //
    // `beltRideEjected` latches true the moment a bob is thrown out of the exit.
    // While it's true, beltConveyor returns immediately and never touches the
    // bob again — it can't re-rail it or snap it back to the conveyor start.
    // It clears only on the next launch. `beltEjectAt` is when the throw happened
    // (drives the escape-end grace; 0 = not ejected this run).
    let beltRideEjected = false;
    let beltEjectAt = 0;

    function rerollBeltTunnel() {
      if (ropeBehavior?.kind !== "belt") {
        beltTunnel = null;
        beltPathT = 0;
        beltTunnelWallsActive = false;
        return;
      }
      beltTunnel = generateBeltTunnelPath(
        cageBounds,
        ANCHOR,
        ropeBehavior.beltWaypointCount ?? 9
      );
      beltPathT = 0;
      beltTunnelWallsActive = true;
    }
    // bulwark (Wall Rope): how many rope segments (from the anchor) are currently
    // hardened into a rigid wall, whether the wall is up, and when a broken wall
    // may re-harden. `bulwarkSaved` keeps each hardened constraint's original
    // softness so breaking the wall restores (repairs) exactly that stretch.
    let bulwarkActive = false;
    let bulwarkBrokenUntil = 0;
    let lastBulwarkRollAt = 0;
    const bulwarkSaved = new Map<Matter.Constraint, { stiffness: number; damping: number }>();

    // --- Black Hole map run-local state ---
    // The singularity's position (random + off-center, rerolled each launch) and
    // whether the bob has been captured by its core this run (which lights up
    // Run Again). `null` on every non-black-hole site.
    const BLACK_HOLE_CORE_R = Math.round(70 * WORLD_SCALE);
    const BLACK_HOLE_REACH = Math.round(620 * WORLD_SCALE);
    let blackHole: { x: number; y: number } | null = null;
    let blackHoleCaptured = false;

    function clearShards() {
      for (const b of shards) Matter.World.remove(engineHandle.world, b);
      shards.length = 0;
    }

    /** Breakable Bob: clear shed pieces and regrow the core to full size/weight/reach. */
    function resetSplitterProgress() {
      clearShards();
      shedCount = 0;
    }

    // bulwark: un-harden every wall-hardened rope constraint, restoring the
    // softness saved when it was hardened. This is the "repair" — the broken
    // stretch goes back to a normal flexible rope.
    function restoreBulwarkWall() {
      for (const [c, saved] of bulwarkSaved) {
        c.stiffness = saved.stiffness;
        c.damping = saved.damping;
      }
      bulwarkSaved.clear();
    }

    // Black Hole: pick a fresh singularity position for this run — anywhere in
    // the cage except a wide central exclusion zone, so it never sits on top of
    // the mount ("never spawns close to middle area").
    function rerollBlackHole() {
      if (!site.blackHole) {
        blackHole = null;
        return;
      }
      const { minX, minY, maxX, maxY } = wallField.bounds;
      const pad = BLACK_HOLE_CORE_R + 40 * WORLD_SCALE;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const exclude = Math.min(maxX - minX, maxY - minY) * 0.26;
      for (let attempt = 0; attempt < 40; attempt++) {
        const x = minX + pad + Math.random() * (maxX - minX - pad * 2);
        const y = minY + pad + Math.random() * (maxY - minY - pad * 2);
        if (Math.hypot(x - cx, y - cy) >= exclude) {
          blackHole = { x, y };
          return;
        }
      }
      // Fallback: shove it into a random corner well off-center.
      blackHole = {
        x: Math.random() < 0.5 ? minX + pad : maxX - pad,
        y: Math.random() < 0.5 ? minY + pad : maxY - pad,
      };
    }

    function resetBehaviorRunState() {
      homingActive = false;
      homingEats = 0;
      homingStartedAt = 0;
      snappedAt = 0;
      lastDashAt = 0;
      dashCount = 0;
      hydraBonusEcho = 0;
      hydraHits = 0;
      frenzyAppliedMult = 1;
      lastTeleportAt = 0;
      rocketLaunchAt = 0;
      resetSplitterProgress();
      chaosSizeCur = chaosSizeTarget = 1;
      chaosWeightCur = chaosWeightTarget = 1;
      chaosCapCur = chaosCapTarget = 1;
      chaosRopeCur = chaosRopeTarget = 1;
      lastChaosRollAt = 0;
      // Rope behaviors.
      fluxLenCur = fluxLenTarget = 1;
      fluxDrainCur = fluxDrainTarget = 1;
      lastFluxRollAt = 0;
      ropeEpoch = performance.now();
      rerollBeltTunnel();
      beltVirtualPayout = resetBeltVirtual();
      beltGrip = 1;
      beltLowSpeedFrames = 0;
      beltTunnelWallsActive = true;
      beltRailRideInitialized = false;

      // Clear the exit-eject state so the next launch rides the conveyor again
      // from the start instead of treating the bob as already thrown.
      beltRideEjected = false;
      beltEjectAt = 0;
      for (const bob of pendulumHandle.bobs) {
        delete (bob as any)._beltEjected;
        delete (bob as any)._beltRailT;
      }

      restoreBulwarkWall();
      bulwarkActive = false;
      bulwarkBrokenUntil = 0;
      lastBulwarkRollAt = 0;
      // Black hole: fresh singularity + clear capture.
      rerollBlackHole();
      blackHoleCaptured = false;
    }

    // Seed an initial tunnel so the Mechanic Belt route renders before launch.
    rerollBeltTunnel();
    beltVirtualPayout = resetBeltVirtual();
    beltGrip = 1;
    beltLowSpeedFrames = 0;
    beltTunnelWallsActive = true;
    beltRailRideInitialized = false;

    // Clear any previous belt ejection markers so a fresh ride can start cleanly.
    for (const bob of pendulumHandle.bobs) {
      delete (bob as any)._beltEjected;
    }

    // very first launch (subsequent runs reroll it via resetBehaviorRunState).
    rerollBlackHole();

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

      // Breakable's shed pieces score too, at half value (isEcho) so a swarm of
      // shards doesn't snowball combos/drops. Each carries its own radius.
      const hitters: { body: Matter.Body; isEcho: boolean; radius: number }[] = [
        ...getOrderedBobBodies(pendulumHandle).map((body) => ({
          body,
          isEcho: false,
          radius: bobRadius,
        })),
        ...echoBobs.map((e) => ({ body: e.body, isEcho: true, radius: bobRadius })),
        ...shards.map((body) => ({
          body,
          isEcho: true,
          radius: body.circleRadius ?? bobRadius,
        })),
      ];

      for (const hitter of hitters) {
        for (const handle of field.zones) {
          const z = handle.zone;
          const dx = hitter.body.position.x - z.position.x;
          const dy = hitter.body.position.y - z.position.y;
          if (Math.hypot(dx, dy) > hitter.radius + z.radius) continue;
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

        // Hydra (Mutant): every milestone of real hits this run sprouts a new
        // scoring head (echo), snowballing coverage until the per-run cap.
        if (behavior?.kind === "hydra") {
          hydraHits += 1;
          const milestone = behavior.milestoneHits ?? 8;
          const per = behavior.echoPerMilestone ?? 1;
          const max = behavior.maxBonusEchoes ?? 5;
          if (hydraHits % milestone === 0 && hydraBonusEcho < max) {
            hydraBonusEcho = Math.min(max, hydraBonusEcho + per);
            playGameSound("token-spawn");
            emitManeuver(
              effects,
              bobBody.position,
              `MUTATION! ${hydraBonusEcho} head${hydraBonusEcho === 1 ? "" : "s"}`,
              now
            );
          }
        }

        // Ravager (hunter): each circle the freed bob devours counts toward
        // satiation and re-energizes the chase so the hunt keeps its pace.
        if (homingActive && behavior?.kind === "hunter") {
          homingEats += 1;
          const maxSpeed = behavior.chaseMaxSpeed ?? 60;
          const sp = Math.hypot(bobBody.velocity.x, bobBody.velocity.y) || 1;
          Matter.Body.setVelocity(bobBody, {
            x: (bobBody.velocity.x / sp) * maxSpeed,
            y: (bobBody.velocity.y / sp) * maxSpeed,
          });
        }

        // Breakable (splitter): chip off a free-flying scoring piece on each
        // real hit; the core shrinks/speeds up as it loses mass (via the
        // per-frame scale factors keyed on shedCount).
        if (behavior?.kind === "splitter") {
          shedShard(now, { x: bobBody.position.x, y: bobBody.position.y });
        }

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
        // Wall Rope (bulwark) can't pick up repair drops — its rope is repaired
        // only by whipping through its own hardened wall. The drop is consumed
        // but does nothing.
        if (ropeBehavior?.kind === "bulwark") {
          emitManeuver(effects, handle.token.position, "No Patch", now);
          void bobBody;
          return;
        }
        // Mechanic Belt (conveyor): Repair drops now act as refuels.
        // They recover grip and give a short speed boost so the bob can keep riding longer.
        if (ropeBehavior?.kind === "belt") {
          if (isBeltTunnelAttachment(attachment)) {
            // Grip recovery + temporary riding stability
            beltLowSpeedFrames = Math.max(0, beltLowSpeedFrames - 30);
            beltGrip = Math.min(1, beltGrip + 0.65);

            // Small forward kick along the current path direction to help it keep momentum
            const tip = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
            if (beltTunnel && tip) {
              const tan = sampleTunnelTangent(beltTunnel, beltPathT);
              const boost = 9 * WORLD_SCALE;
              Matter.Body.setVelocity(tip, {
                x: tip.velocity.x + tan.x * boost,
                y: tip.velocity.y + tan.y * boost,
              });
            }
          } else {
            reelBeltRope(pendulumHandle, ropeBehavior.beltReelFraction ?? 0.4);
          }
          playGameSound("token-collect", { variant: def.kind });
          emitHit(effects, handle.token.position, now, {
            color: def.color,
            points: 0,
            intensity: 1.5,
          });
          emitManeuver(effects, handle.token.position, "Conveyor Refueled!", now);
          void bobBody;
          return;
        }
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

      const isShard = bobBody.label.startsWith("bob-shard-");
      const wallDamage = isShard ? WALL_SHARD_DAMAGE : 1;
      const shattered = damageWall(engineHandle.world, wallField, wall, wallDamage);
      // A bob thrown free of the conveyor exit is a FREE body with no rope to
      // bleed energy. The normal wall bounce MULTIPLIES speed (WALL_*_BOOST > 1),
      // which on a ropeless bob compounds every hit until it exceeds the cage
      // wall thickness and tunnels straight out of the field (then "escapes" and
      // the run relaunches it back to the conveyor start). So we DON'T apply the
      // energy-pumping bounce to it — Matter resolves the hit with the bob's own
      // restitution (0.5), so it loses energy, settles, and stays in play.
      const isEjectedBelt = (bobBody as any)._beltEjected === true;
      if (!isEjectedBelt) {
        bounceBobOffWall(bobBody, wall, shattered ? WALL_BREAK_BOOST : WALL_BOUNCE_BOOST);
      }
      emitHit(effects, { x: bobBody.position.x, y: bobBody.position.y }, now, {
        color: shattered ? "#f87171" : "#fbbf24",
        points: 0,
        intensity: shattered ? 1.8 : isShard ? 0.55 : 0.9,
      });
      if (shattered) {
        // Flat reward for breaking a wall, on top of the ricochet impulse.
        useGameStore.getState().addMomentum(WALL_BREAK_BONUS);
        playGameSound("bonus-zones-spawn", { volume: 0.7 });
        emitManeuver(effects, bobBody.position, `WALL BREAK! +${WALL_BREAK_BONUS}`, now);
      } else {
        playGameSound("zone-hit", { pitch: isShard ? 0.85 : 0.7, volume: isShard ? 0.25 : 0.4 });
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

    // --- Behavior bobs ---------------------------------------------------

    // hunter (Ravager): steer every freed bob toward the nearest live circle so
    // a snapped Ravager devours zones Pac-Man style. Runs only while snapped and
    // homing; ends after `satiationEats` eats or `satiationMs`, after which the
    // freed bobs coast and the normal escape/idle end-of-run logic takes over.
    function steerHomingBobs(now: number) {
      if (!homingActive || !behavior) return;
      const satEats = behavior.satiationEats ?? 16;
      const satMs = behavior.satiationMs ?? 3500;
      if (homingEats >= satEats || now - homingStartedAt > satMs) {
        homingActive = false;
        return;
      }
      const accel = behavior.chaseAccel ?? 0.09;
      const maxSpeed = behavior.chaseMaxSpeed ?? 60;
      for (const bob of getOrderedBobBodies(pendulumHandle)) {
        let best: HitZoneHandle | null = null;
        let bestD = Infinity;
        for (const h of field.zones) {
          const dx = h.zone.position.x - bob.position.x;
          const dy = h.zone.position.y - bob.position.y;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = h;
          }
        }
        if (!best) {
          homingActive = false;
          return;
        }
        const dx = best.zone.position.x - bob.position.x;
        const dy = best.zone.position.y - bob.position.y;
        const len = Math.hypot(dx, dy) || 1;
        const desiredX = (dx / len) * maxSpeed;
        const desiredY = (dy / len) * maxSpeed;
        Matter.Body.setVelocity(bob, {
          x: bob.velocity.x + (desiredX - bob.velocity.x) * accel,
          y: bob.velocity.y + (desiredY - bob.velocity.y) * accel,
        });
      }
    }

    // piercer (Arrow): every `dashIntervalMs` of live swing, fire a straight-
    // line burst along the bob's current heading so it spears through a row of
    // circles instead of only grazing the arc. The rope reels it back after.
    function dashPiercer(now: number) {
      if (!behavior) return;
      const interval = behavior.dashIntervalMs ?? 1400;
      const maxPerRun = behavior.dashMaxPerRun ?? 0;
      if (now - lastDashAt < interval) return;
      if (maxPerRun > 0 && dashCount >= maxPerRun) return;
      const dashSpeed = behavior.dashSpeed ?? 78;
      const cap = 72 * WORLD_SCALE;
      const tip = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
      const sp = Math.hypot(tip.velocity.x, tip.velocity.y);
      // Only fire when there's a real swing to spear along.
      if (sp < 2) return;
      const ux = tip.velocity.x / sp;
      const uy = tip.velocity.y / sp;
      for (const bob of pendulumHandle.bobs) {
        const nx = bob.velocity.x + ux * dashSpeed;
        const ny = bob.velocity.y + uy * dashSpeed;
        Matter.Body.setVelocity(bob, {
          x: Math.max(-cap, Math.min(cap, nx)),
          y: Math.max(-cap, Math.min(cap, ny)),
        });
      }
      // Post-snap the rope is detached, so there's nothing to whip — the dash
      // just flings the freed bob along its heading.
      if (!pendulumHandle.snapped) propagateRopeWhip(pendulumHandle, tip.velocity, 0.05);
      lastDashAt = now;
      dashCount += 1;
      playGameSound("maneuver", { variant: "pierce" });
      emitManeuver(effects, tip.position, "PIERCE!", now);
    }

    // magnet (Lodestone): drag nearby circles and loose tokens toward the tip
    // bob's arc. Circles relocate when hit (so they never permanently collapse
    // onto the bob); tokens just get easier to scoop. Pull eases with distance.
    function magnetPull(dt: number) {
      if (!behavior || dt <= 0) return;
      const radius = behavior.pullRadius ?? 780;
      const zoneStrength = (behavior.pullStrength ?? 2.4) * (dt / 1000);
      const tokenStrength = (behavior.tokenPullStrength ?? 4) * (dt / 1000);
      const tip = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
      const radiusSq = radius * radius;

      for (const h of field.zones) {
        const dx = tip.position.x - h.zone.position.x;
        const dy = tip.position.y - h.zone.position.y;
        const dSq = dx * dx + dy * dy;
        if (dSq > radiusSq || dSq < 1) continue;
        const d = Math.sqrt(dSq);
        const k = Math.min(0.5, zoneStrength * (1 - d / radius));
        const nx = h.zone.position.x + dx * k;
        const ny = h.zone.position.y + dy * k;
        h.zone.position = { x: nx, y: ny };
        Matter.Body.setPosition(h.body, { x: nx, y: ny });
      }

      // Tokens: nudge the canonical base position; tickTokens re-syncs the body
      // (and its idle bob) from it later this frame.
      for (const t of tokenField.tokens) {
        if (t.token.consumed) continue;
        const dx = tip.position.x - t.token.position.x;
        const dy = tip.position.y - t.token.position.y;
        const dSq = dx * dx + dy * dy;
        if (dSq > radiusSq || dSq < 1) continue;
        const d = Math.sqrt(dSq);
        const k = Math.min(0.6, tokenStrength * (1 - d / radius));
        t.token.position.x += dx * k;
        t.token.position.y += dy * k;
      }
    }

    // frenzy (Berserker): scale swing speed with the live combo, ramping up as
    // the chain grows and bleeding back down when it drops. Returns nothing —
    // size scaling is applied separately via setBobRadiusScale. Bidirectional
    // (unlike Speed Ramp) so a broken combo visibly cools the bob back off.
    function applyFrenzyScale(targetMult: number) {
      if (Math.abs(targetMult - frenzyAppliedMult) < 0.001) return;
      const delta = targetMult / frenzyAppliedMult;
      const cap = 60 * WORLD_SCALE;
      for (const bob of pendulumHandle.bobs) {
        let vx = bob.velocity.x * delta;
        let vy = bob.velocity.y * delta;
        const speed = Math.hypot(vx, vy);
        if (speed > cap) {
          const s = cap / speed;
          vx *= s;
          vy *= s;
        }
        Matter.Body.setVelocity(bob, { x: vx, y: vy });
      }
      frenzyAppliedMult = targetMult;
    }

    // frenzy combo stacks → (speedMult, sizeMult). Shared by the speed scaler
    // and the per-frame bob-size scaling so both track the same combo count.
    function frenzyMultipliers(): { speed: number; size: number } {
      if (behavior?.kind !== "frenzy") return { speed: 1, size: 1 };
      const maxStacks = behavior.maxComboStacks ?? 20;
      const stacks = Math.min(useGameStore.getState().combo.count, maxStacks);
      return {
        speed: 1 + stacks * (behavior.comboSpeedPerStack ?? 0.015),
        size: 1 + stacks * (behavior.comboSizePerStack ?? 0.015),
      };
    }

    // splitter (Breakable): the more pieces it has shed, the smaller, shorter,
    // lighter, and faster the core becomes. Identity (all 1) for other bobs.
    function splitterFactors(): {
      size: number;
      rope: number;
      weight: number;
      cap: number;
    } {
      if (behavior?.kind !== "splitter") {
        return { size: 1, rope: 1, weight: 1, cap: 1 };
      }
      const shed = shedCount;
      const shrink = behavior.shrinkPerShard ?? 0.06;
      return {
        size: Math.max(0.4, 1 - shed * shrink),
        rope: Math.max(0.45, 1 - shed * shrink),
        weight: Math.max(0.3, 1 - shed * (behavior.weightDropPerShard ?? 0.07)),
        cap: 1 + shed * (behavior.speedupPerShard ?? 0.12),
      };
    }

    // Combined per-frame stat multipliers from every active scaling behavior
    // (frenzy size, splitter shed-down, chaos churn). Applied on top of modifier
    // effects when scaling the rig each frame.
    function behaviorScales(): { size: number; rope: number; weight: number } {
      const f = frenzyMultipliers();
      const s = splitterFactors();
      return {
        size: f.size * s.size * chaosSizeCur,
        rope: s.rope * chaosRopeCur,
        weight: s.weight * chaosWeightCur,
      };
    }

    // Angular-speed-cap multiplier from the same behaviors. Kept separate so the
    // afterUpdate clamp can read it without recomputing the frame's full scales.
    function behaviorCapMult(): number {
      return frenzyMultipliers().speed * splitterFactors().cap * chaosCapCur;
    }

    // teleport (TP): blink the rig to a random spot in the cage on a cadence.
    // teleportRig drops the bob at that spot — out past the rope's reach, in
    // open field — and the stretched rope reels it back in, so a short rope
    // hauls it home hard and a long rope lets it roam.
    function teleportTick(now: number) {
      if (behavior?.kind !== "teleport") return;
      if (now - lastTeleportAt < (behavior.teleportIntervalMs ?? 1100)) return;
      lastTeleportAt = now;
      const cage = wallField.bounds;
      const tx = cage.minX + Math.random() * (cage.maxX - cage.minX);
      const ty = cage.minY + Math.random() * (cage.maxY - cage.minY);
      const speed = behavior.teleportSpeed ?? 42;
      if (pendulumHandle.snapped) {
        // No rope to re-lay — blink the freed bob straight to the spot and fling
        // it off in a random direction so it keeps ricocheting and scoring.
        for (const bob of getOrderedBobBodies(pendulumHandle)) {
          Matter.Body.setPosition(bob, { x: tx, y: ty });
          const ang = Math.random() * Math.PI * 2;
          Matter.Body.setVelocity(bob, {
            x: Math.cos(ang) * speed,
            y: Math.sin(ang) * speed,
          });
        }
      } else {
        teleportRig(pendulumHandle, tx, ty, speed);
      }
      const at = pendulumHandle.bobs[pendulumHandle.bobs.length - 1].position;
      playGameSound("token-spawn", { pitch: 1.4, volume: 0.4 });
      emitHit(effects, { x: at.x, y: at.y }, now, {
        color: "#a78bfa",
        points: 0,
        intensity: 1,
      });
      emitManeuver(effects, { x: at.x, y: at.y }, "BLINK!", now);
    }

    // rocket (Rocket): continuous thrust along the bob's heading that ramps up
    // from launch and stacks hard with an active Speed Ramp. No launch kick —
    // the bob starts near-still (see the launch handler) and builds speed here.
    function rocketTick(now: number, dt: number) {
      if (behavior?.kind !== "rocket" || dt <= 0) return;
      const tip = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
      const pivot = pendulumHandle.pivot.position;
      const sp = Math.hypot(tip.velocity.x, tip.velocity.y);
      let tx: number;
      let ty: number;
      if (sp > 0.5) {
        tx = tip.velocity.x / sp;
        ty = tip.velocity.y / sp;
      } else {
        // Stalled: thrust along the orbital tangent so it spins back up.
        const rx = tip.position.x - pivot.x;
        const ry = tip.position.y - pivot.y;
        const r = Math.hypot(rx, ry) || 1;
        tx = -ry / r;
        ty = rx / r;
      }
      const ramp = Math.min(1, (now - rocketLaunchAt) / (behavior.rocketRampMs ?? 3500));
      let thrust = (behavior.rocketAccel ?? 120) * (dt / 1000) * ramp;
      const rampMult = getSpeedRampMultiplier(useGameStore.getState().activeModifiers, now);
      if (rampMult > 1) thrust *= 1 + (rampMult - 1) * (behavior.rampSynergy ?? 3);
      const cap = behavior.rocketMaxSpeed ?? 138;
      for (const bob of pendulumHandle.bobs) {
        let nx = bob.velocity.x + tx * thrust;
        let ny = bob.velocity.y + ty * thrust;
        const mag = Math.hypot(nx, ny);
        if (mag > cap) {
          const s = cap / mag;
          nx *= s;
          ny *= s;
        }
        Matter.Body.setVelocity(bob, { x: nx, y: ny });
      }
    }

    // rocket durability: the rope only frays while the bob is flung out at the
    // very edge of its reach. Returns true when wear should accrue this frame.
    function rocketRopeAtLimit(): boolean {
      if (behavior?.kind !== "rocket") return true;
      const tip = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
      const pivot = pendulumHandle.pivot.position;
      const dist = Math.hypot(tip.position.x - pivot.x, tip.position.y - pivot.y);
      const reach =
        rigReach(pendulumHandle) + Math.max(4, getEffectiveBobRadius(pendulumHandle) * 0.35);
      return dist >= reach * (behavior.limitDrainFraction ?? 0.95);
    }

    // splitter: chip a free-flying piece off the core, flung in a random
    // direction. Pieces carry a `bob-shard-*` label so the existing wall/token
    // collision paths treat them as bobs, and they're added to the zone-hit
    // sweep as half-value (echo) hitters so they score without snowballing.
    function shedShard(now: number, fromPos: { x: number; y: number }) {
      if (behavior?.kind !== "splitter") return;
      if (shedCount >= (behavior.maxShards ?? 10)) return;
      shedCount += 1;
      const baseR = getEffectiveBobRadius(pendulumHandle);
      const r = Math.max(6, baseR * (behavior.shardRadiusFraction ?? 0.45));
      const ang = Math.random() * Math.PI * 2;
      const speed = behavior.shedSpeed ?? 48;
      const body = Matter.Bodies.circle(fromPos.x, fromPos.y, r, {
        label: `bob-shard-${shedCount}`,
        frictionAir: 0.006,
        restitution: 0.5,
        friction: 0.05,
        // Shed pieces are scoring bobs, so they bounce off in-field ring walls.
        collisionFilter: { category: COLLISION.BOB },
      });
      const mass = Math.max(0.5, pendulumHandle.baseMass * 0.5);
      Matter.Body.setMass(body, mass);
      Matter.Body.setInertia(body, Math.max(1, mass * r * r));
      Matter.World.add(engineHandle.world, body);
      Matter.Body.setVelocity(body, {
        x: Math.cos(ang) * speed,
        y: Math.sin(ang) * speed,
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.4);
      shards.push(body);
      playGameSound("rope-snap", { volume: 0.35, pitch: 1.3 });
      emitHit(effects, fromPos, now, { color: "#fca5a5", points: 0, intensity: 1.1 });
    }

    // chaos (Random): every reroll, pick fresh random targets bounded by the
    // roster's stat extremes (relative to this bob's own base), then smoothly
    // blend the current multipliers toward them so the rig is in constant flux.
    function chaosTick(now: number, dt: number) {
      if (behavior?.kind !== "chaos") return;
      const baseR = bobRadius(pendulum);
      const baseW = pendulum.weight;
      const baseAV = pendulum.maxAngularVelocity;
      const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
      if (now - lastChaosRollAt > (behavior.chaosRerollMs ?? 900)) {
        lastChaosRollAt = now;
        chaosSizeTarget = rand(minRosterRadius, maxRosterRadius) / baseR;
        chaosWeightTarget = rand(minRosterWeight, maxRosterWeight) / baseW;
        chaosCapTarget = rand(minRosterAngVel, maxRosterAngVel) / baseAV;
        chaosRopeTarget = rand(0.6, 1.5);
      }
      const a = 1 - Math.exp(-(behavior.chaosLerpRate ?? 3) * (dt / 1000));
      chaosSizeCur += (chaosSizeTarget - chaosSizeCur) * a;
      chaosWeightCur += (chaosWeightTarget - chaosWeightCur) * a;
      chaosCapCur += (chaosCapTarget - chaosCapCur) * a;
      chaosRopeCur += (chaosRopeTarget - chaosRopeCur) * a;
    }

    // --- Behavior ropes --------------------------------------------------

    // flux (Random Rope): churn the length + durability-drain multipliers toward
    // fresh random targets, mirroring the Chaos bob but for the line. The drain
    // multiplier feeds the durability tick; the length feeds ropeBehaviorLenMult.
    function fluxTick(now: number, dt: number) {
      if (ropeBehavior?.kind !== "flux" || dt <= 0) return;
      if (now - lastFluxRollAt > (ropeBehavior.fluxRerollMs ?? 850)) {
        lastFluxRollAt = now;
        fluxLenTarget = 0.55 + Math.random() * 1.15; // 0.55× … 1.7× reach
        fluxDrainTarget = 0.5 + Math.random() * 2.5; // 0.5× … 3× wear speed
      }
      const a = 1 - Math.exp(-(ropeBehavior.fluxLerpRate ?? 3) * (dt / 1000));
      fluxLenCur += (fluxLenTarget - fluxLenCur) * a;
      fluxDrainCur += (fluxDrainTarget - fluxDrainCur) * a;
    }

    // The per-frame length multiplier contributed by the rope's own behavior,
    // multiplied into setRopeLengthScale alongside the modifier + bob factors.
    //   metronome — sinusoidal pump in/out on a steady beat (self-pumping rig).
    //   flux      — the random length churn above.
    // 1 (a no-op) for every other rope.
    function ropeBehaviorLenMult(now: number): number {
      if (ropeBehavior?.kind === "metronome") {
        const period = ropeBehavior.swingPeriodMs ?? 2600;
        const depth = ropeBehavior.swingDepth ?? 0.28;
        return 1 + depth * Math.sin((2 * Math.PI * (now - ropeEpoch)) / period);
      }
      if (ropeBehavior?.kind === "flux") return fluxLenCur;
      return 1;
    }

    // Legacy belt feed for non-Mechanic-Belt ropes only.
    // The true Mechanic Belt no longer uses payout/stress — the ride only ends
    // when the bob naturally loses speed and grip fades.
    function beltFeed(dt: number) {
      if (ropeBehavior?.kind !== "belt" || pendulumHandle.snapped || dt <= 0) return;

      if (isBeltTunnelAttachment(attachment)) {
        // Stress retired for Mechanic Belt. No payout accumulation.
        return;
      }

      const payoutRate = ropeBehavior.beltPayoutRate ?? 0.07;
      const delta = payoutRate * (dt / 1000);
      const baseLen = attachment.length * pendulumHandle.ropeLengthScale;
      feedBeltRope(pendulumHandle, baseLen * delta);
    }

    // Helper: reset rest pose but leave bobs that were ejected from a Mechanic Belt
    // ride completely alone (they should keep flying as free projectiles).
    function resetPendulumToRestExcludingEjected(handle: PendulumHandle) {
      const originalBobs = handle.bobs;
      handle.bobs = originalBobs.filter((b: any) => !(b as any)._beltEjected);
      resetPendulumToRest(handle);
      handle.bobs = originalBobs;
    }

    // belt conveyor + hard walls: the bob is completely unattached.
    // It gets an initial kick and rides the physical tunnel. The conveyor keeps
    // pushing as long as speed is maintained. When speed drops, grip fades and
    // the bob transitions to bouncing inside the strict tube until the exit.
    function beltConveyor(dt: number, now: number) {
      if (ropeBehavior?.kind !== "belt" || !beltTunnel || pendulumHandle.snapped || dt <= 0)
        return;
      // Once the bob has been thrown out of the exit this run, the conveyor is
      // done with it — never re-rail it or pull it back to the start. It stays a
      // free projectile until the next launch (which clears beltRideEjected).
      if (beltRideEjected) return;

      const trackAccel = ropeBehavior.beltTrackAccel ?? 0.07;
      const conveyorSpeed = (ropeBehavior.beltConveyorSpeed ?? 22) * WORLD_SCALE;
      const lookahead = ropeBehavior.beltLookahead ?? 0.035;
      const tip = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];

      // --- Grip fade: when bob speed is low for a while, the conveyor loses its hold ---
      const currentSpeed = Math.hypot(tip.velocity.x, tip.velocity.y);
      const MIN_CONVEYOR_SPEED = conveyorSpeed * 0.35;
      const LOW_SPEED_FRAMES_TO_RELEASE = 28; // ~0.45s at 60fps physics

      if (currentSpeed < MIN_CONVEYOR_SPEED) {
        beltLowSpeedFrames++;
      } else {
        beltLowSpeedFrames = Math.max(0, beltLowSpeedFrames - 2);
      }

      // Decay grip when stuck slow; recover quickly when moving well.
      // Slower decay helps light bobs (wooden etc.) not feel like they
      // "suddenly snap" off the conveyor.
      if (beltLowSpeedFrames > LOW_SPEED_FRAMES_TO_RELEASE) {
        beltGrip = Math.max(0, beltGrip - 0.011);
      } else if (currentSpeed > MIN_CONVEYOR_SPEED * 1.1) {
        beltGrip = Math.min(1, beltGrip + 0.09);
      }

      // When grip is very low, the powered conveyor has mostly failed, but we
      // still want the physical tunnel walls to constrain the bob (user request).
      // We switch to "degraded / loose in tunnel" mode: almost no propulsion,
      // but full multilayer wall containment keeps the bob inside the hitbox.
      const degraded = beltGrip < 0.18;
      if (beltGrip < 0.04) {
        beltGrip = 0;
      }

      // Golden Token bonus: extra speed along the conveyor while the token-bonus
      // modifier is active. This is specific to the Mechanic Belt experience.
      const activeMods = useGameStore.getState().activeModifiers;
      const hasGoldenBoost = activeMods.some((m) => m.defId === "token-bonus");
      const goldenSpeedMult = hasGoldenBoost ? 1.58 : 1.0;

      const grip = beltGrip; // 0..1 multiplier on all conveyor effects
      const effectiveGrip = degraded ? Math.min(0.09, grip) : grip;

      // Advance the "head" of the conveyor ride (extra speed from Golden Token)
      beltPathT = advanceTunnelProgress(
        beltTunnel,
        beltPathT,
        tip.position.x,
        tip.position.y,
        conveyorSpeed * effectiveGrip * goldenSpeedMult * (dt / 1000)
      );

      // === Strict mid-line conveyor rail (constant speed following) ===
      // The bobs are hard-locked onto the center of the generated path and step
      // along it at a constant conveyor speed (driven by `_beltRailT`, not by
      // velocity). At the exit they're thrown free.
      const activeConveyorSpeed = conveyorSpeed * goldenSpeedMult * Math.max(1.5, effectiveGrip);

      // Only initialize the strict rail once per conveyor activation (on launch).
      // After bobs eject at the end, we do NOT want to automatically re-attach them
      // to the start of the path (that was causing the infinite loop).
      const anyOnRail = pendulumHandle.bobs.some((b: any) => typeof (b as any)._beltRailT === 'number');
      if (!anyOnRail && !beltRailRideInitialized) {
        // Place each bob at the path entry and put it on the rail. Position +
        // velocity are then owned entirely by applyStrictConveyorRail (called
        // just below this frame), so we don't apply a launch kick here — that
        // only fed the old runaway-velocity path.
        const entry = sampleTunnel(beltTunnel, 0);
        for (let i = 0; i < pendulumHandle.bobs.length; i++) {
          const bob = pendulumHandle.bobs[i];
          // Small negative offset so a chain of bobs looks like a short train entering together
          (bob as any)._beltRailT = -i * 0.018;
          Matter.Body.setPosition(bob, entry);
          Matter.Body.setVelocity(bob, { x: 0, y: 0 });
        }
        beltPathT = 0;
        beltRailRideInitialized = true;   // Mark that this conveyor ride has started. No more auto re-attach after ejection.
      }

      // Apply strict center-line following + constant speed.
      // When any bob reaches the end of the path, it is released (ejected) with its current
      // velocity and flies freely into the field like an ejector.
      const didEject = applyStrictConveyorRail(
        beltTunnel,
        pendulumHandle.bobs,
        activeConveyorSpeed,
        dt,
        0.98
      );

      if (didEject) {
        // A bob reached the conveyor exit and was flung free (position + velocity
        // already set on it by applyStrictConveyorRail). The belt bob is a free
        // body with no rope, so there is nothing to detach — we just latch the
        // ejected state so beltConveyor never re-rails it, and finalize the
        // free-projectile physics.
        beltRideEjected = true;
        beltEjectAt = now;

        // Clamp to a strong-but-safe throw: a free body faster than the 200-thick
        // cage wall jumps clean through it in one Matter step (no continuous
        // collision) and vanishes. Well under that, the thrown bob ricochets and
        // stays in play (a normal launch is ~60/step, so this still reads hard).
        const MAX_EJECT_SPEED = 30 * WORLD_SCALE;
        for (const b of pendulumHandle.bobs) {
          delete (b as any)._beltRailT;
          (b as any)._beltEjected = true;
          const sp = Math.hypot(b.velocity.x, b.velocity.y);
          if (sp > MAX_EJECT_SPEED) {
            const k = MAX_EJECT_SPEED / sp;
            Matter.Body.setVelocity(b, { x: b.velocity.x * k, y: b.velocity.y * k });
          }
          b.restitution = 0.5;
          b.friction = 0.05;
          b.frictionAir = 0.006;
          Matter.Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.4);
        }
        syncEchoBobs(0);
        playGameSound("rope-snap");
        const tip = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
        emitManeuver(effects, tip.position, "EJECTED!", now);
      }

      // IMPORTANT: During active strict rail mode, we do NOT touch the bob with containment/walls.
      // All behavior (position on the exact mid line + high velocity from the kick) is handled
      // exclusively by applyStrictConveyorRail on the bob itself.
      // This prevents anything else from fighting the strong kick and speed the bob needs.
      // (Containment is only used in the loose/bouncy phase after the conveyor power ends.)
    }

    // bulwark: harden a fresh random stretch of rope (from the anchor toward the
    // bob) into a rigid wall by stiffening that many leading rope constraints.
    function bulwarkHardenRandomStretch() {
      const ropeLinks = pendulumHandle.constraints.filter(
        (c) => /^rope-\d+$/.test(c.label ?? "")
      );
      if (ropeLinks.length === 0) return;
      const count = 1 + Math.floor(Math.random() * ropeLinks.length);
      for (let i = 0; i < count; i++) {
        const c = ropeLinks[i];
        if (!bulwarkSaved.has(c)) {
          bulwarkSaved.set(c, { stiffness: c.stiffness ?? 0.9, damping: c.damping ?? 0.02 });
        }
        c.stiffness = 1;
        c.damping = 0.18;
      }
      bulwarkActive = true;
    }

    // bulwark (Wall Rope): every wallIntervalMs it hardens a random stretch into
    // a wall; it can't pick up repair drops (handled in collectToken). When the
    // bob whips fast enough it "breaks" the wall — the hardened stretch is
    // repaired (re-softened) and, after a short cooldown, a new wall forms.
    function bulwarkTick(now: number) {
      if (ropeBehavior?.kind !== "bulwark" || pendulumHandle.snapped) return;
      const interval = ropeBehavior.wallIntervalMs ?? 500;
      const breakSpeed = (ropeBehavior.wallBreakSpeed ?? 30) * WORLD_SCALE;
      const repairMs = ropeBehavior.wallRepairMs ?? 700;
      const tip = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
      const tipSpeed = Math.hypot(tip.velocity.x, tip.velocity.y);
      if (bulwarkActive && tipSpeed >= breakSpeed) {
        restoreBulwarkWall();
        bulwarkActive = false;
        bulwarkBrokenUntil = now + repairMs;
        playGameSound("rope-snap", { volume: 0.4, pitch: 1.5 });
        emitManeuver(effects, tip.position, "WALL BREAK!", now);
        return;
      }
      if (!bulwarkActive && now >= bulwarkBrokenUntil && now - lastBulwarkRollAt > interval) {
        lastBulwarkRollAt = now;
        bulwarkHardenRandomStretch();
      }
    }

    // Black Hole map: drag every bob (and Breakable's shed shards) toward the
    // singularity with an inverse-ish pull that strengthens near the core, and
    // "capture" the tip bob when it reaches the event horizon — killing its
    // motion and lighting Run Again so the player can relaunch from the brink.
    // Shards that cross the core are consumed outright.
    function blackHolePullBody(body: Matter.Body, seconds: number) {
      if (!blackHole) return;
      const dx = blackHole.x - body.position.x;
      const dy = blackHole.y - body.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > BLACK_HOLE_REACH) return;
      // Falloff: gentle at the rim, fierce near the core (clamped so it never
      // explodes into a NaN at dist→0).
      const norm = 1 - dist / BLACK_HOLE_REACH;
      const pull = 26 * WORLD_SCALE * (0.25 + norm * norm) * seconds;
      Matter.Body.setVelocity(body, {
        x: body.velocity.x + (dx / dist) * pull,
        y: body.velocity.y + (dy / dist) * pull,
      });
    }

    function blackHoleTick(dt: number) {
      if (!blackHole || dt <= 0) return;
      const seconds = dt / 1000;
      for (const bob of getOrderedBobBodies(pendulumHandle)) {
        blackHolePullBody(bob, seconds);
      }
      for (const shard of shards) {
        blackHolePullBody(shard, seconds);
      }
      // Consume shed pieces that reach the core.
      for (let i = shards.length - 1; i >= 0; i--) {
        const shard = shards[i];
        if (
          Math.hypot(blackHole.x - shard.position.x, blackHole.y - shard.position.y) <=
          BLACK_HOLE_CORE_R
        ) {
          Matter.World.remove(engineHandle.world, shard);
          shards.splice(i, 1);
        }
      }
      // Capture check on the tip bob (the one the player tracks).
      const tip = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
      if (Math.hypot(blackHole.x - tip.position.x, blackHole.y - tip.position.y) <= BLACK_HOLE_CORE_R) {
        if (!blackHoleCaptured) {
          blackHoleCaptured = true;
          playGameSound("token-spawn", { pitch: 0.6, volume: 0.6 });
          emitManeuver(effects, { x: blackHole.x, y: blackHole.y }, "EVENT HORIZON!", performance.now());
          useGameStore.getState().markRunStalled();
        }
        // Drain its motion so it settles into the core (and the idle timer can
        // still close the run if the player doesn't relaunch).
        for (const bob of getOrderedBobBodies(pendulumHandle)) {
          Matter.Body.setVelocity(bob, { x: bob.velocity.x * 0.85, y: bob.velocity.y * 0.85 });
        }
        for (const shard of shards) {
          Matter.Body.setVelocity(shard, {
            x: shard.velocity.x * 0.85,
            y: shard.velocity.y * 0.85,
          });
        }
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
      // Sweep up any of Breakable's shed pieces still bouncing around.
      clearShards();
      // Drop any standing Wall Rope wall so the rig hangs soft between runs.
      restoreBulwarkWall();
      bulwarkActive = false;
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
      // Mechanic Belt rides a conveyor tunnel — not a pivot orbit — so the
      // angular cap would fight the path follower every step.
      if (ropeBehavior?.kind === "belt") return;
      // Behavior bobs raise their own swing-speed ceiling (Frenzy with combo,
      // Breakable as it sheds, Chaos at random) so their speed scaling isn't
      // immediately clamped back down. behaviorCapMult is 1 for plain bobs.
      const cap = pendulum.maxAngularVelocity * behaviorCapMult();
      clampAngularVelocity(pendulumHandle, cap);
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
      // Behavior bobs scale their rig on top of modifier effects: Frenzy grows
      // with the combo, Breakable shrinks as it sheds, Chaos churns everything.
      // For a plain bob every factor is 1 (a no-op).
      const scales = behaviorScales();
      const sizeScaleNow = effects$.bobSizeMult * scales.size;
      const weightScaleNow = effects$.weightMult * scales.weight;
      // Apply the radius scale BEFORE the weight scale: Matter.Body.scale()
      // recomputes mass from area, so if it ran last it would drag the bob's
      // mass with its size and the two could never diverge. Setting weight last
      // makes mass = baseMass * weightScale the final authority (inertia stays
      // geometry-consistent), so the Chaos Bob can roll a tiny-but-heavy
      // wrecking ball or a huge-but-light balloon independently.
      // Rope behaviors churn the effective length too: flux randomly, metronome
      // sinusoidally. `ropeBehaviorLenMult` is 1 for ordinary ropes.
      fluxTick(now, dt);
      setBobRadiusScale(pendulumHandle, sizeScaleNow);
      setPendulumWeightScale(pendulumHandle, weightScaleNow);
      setRopeLengthScale(
        pendulumHandle,
        effects$.ropeLengthMult * scales.rope * ropeBehaviorLenMult(now)
      );
      setGravity(engineHandle, site.gravity * effects$.accelerationMult);
      // Mass-per-area: how dense the bob currently is relative to a plain rig.
      // >1 reads heavy (dark core), <1 reads hollow. Drives the render cue so a
      // small heavy bob looks distinct from a small light one.
      const bobDensity = weightScaleNow / Math.max(0.15, sizeScaleNow * sizeScaleNow);

      // Conveyor feeds rope before physics reads stretch for this frame.
      if (store.isRunning && !pendulumHandle.snapped && dt > 0) {
        beltFeed(dt);
      }

      // --- Rope durability: drain while swinging, snap at zero ---
      if (store.isRunning && !pendulumHandle.snapped && dt > 0) {
        if (ropeBehavior?.kind !== "belt") {
          // Heavier bobs (and the weight-mult modifier) wear the rope faster. A
          // Nitro (glass-cannon) bob multiplies the drain so it snaps early; the
          // Random Rope (flux) multiplies it by its churning drain factor.
          const wearWeight = pendulum.weight * effects$.weightMult;
          const drainMult =
            (behavior?.durabilityDrainMult ?? 1) *
            (ropeBehavior?.kind === "flux" ? fluxDrainCur : 1);
          // Rocket's rope only wears while the bob is flung out at the very edge
          // of its reach — gentle near the pivot, frays hard at full extension.
          if (rocketRopeAtLimit()) {
            durability -=
              durabilityDrainPerSec(ropeMaterial, wearWeight) * drainMult * (dt / 1000);
          }
        }
        if (durability <= 0 && ropeBehavior?.kind !== "belt") {
          durability = 0;
          snappedAt = now;
          // A Ravager (hunter) keeps its momentum with no random scatter so the
          // homing steering can immediately aim the freed bob at live circles.
          const hunting = behavior?.kind === "hunter";
          snapRope(pendulumHandle, { scatter: !hunting });
          if (hunting) {
            homingActive = true;
            homingEats = 0;
            homingStartedAt = now;
          }
          syncEchoBobs(0);
          playGameSound("rope-snap");
          emitManeuver(
            effects,
            pendulumHandle.bobs[pendulumHandle.bobs.length - 1].position,
            hunting ? "FEAST!" : "SNAP!",
            now
          );
        }
      }

      // While snapped the rope is detached — its constraint forces and the
      // chain-bob repositioning no longer apply to the free-flying bobs.
      if (!pendulumHandle.snapped) tickAttachmentPhysics(pendulumHandle);

      // Stress-based snap for the Mechanic Belt has been retired.
      // The conveyor ride now only ends naturally when grip decays (bob loses speed).
      const snapped = pendulumHandle.snapped;

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
      // Behavior identity carries through the snap finale: these keep driving
      // the freed bob (or the field around it) after a snap too, not just while
      // strung. The passive churns (frenzy speed-bleed, magnet pull, chaos
      // stat-churn) run for the whole finale; the re-energizing effects
      // (piercer dash, teleport blink, rocket thrust) re-add speed, so they only
      // fire within POST_SNAP_BEHAVIOR_MS of the snap — past that the freed bob
      // coasts so the normal escape/idle end-of-run logic can still close it.
      if (store.isRunning && dt > 0) {
        const reenergize = !snapped || now - snappedAt < POST_SNAP_BEHAVIOR_MS;
        // Frenzy: ramp swing speed with the combo (bidirectional — bleeds back
        // down when the chain breaks). No-op (target 1) for non-frenzy bobs.
        applyFrenzyScale(frenzyMultipliers().speed);
        // Lodestone: drag nearby circles + loose tokens toward the bob.
        if (behavior?.kind === "magnet") magnetPull(dt);
        // Chaos: stat churn (size/weight/cap), applied via the per-frame scales.
        if (behavior?.kind === "chaos") chaosTick(now, dt);
        // Rope behaviors: belt conveyor steering + bulwark wall cycle (both
        // self-guard to the strung phase). Black hole pull runs whole-field on
        // its map (strung and freed alike).
        if (ropeBehavior?.kind === "belt") beltConveyor(dt, now);

        // Always keep the bob constrained inside the conveyor tunnel walls
        // (the physical "tube" hitbox). After the conveyor snaps we switch to
        // bouncy mode so the bob ricochets energetically off the walls instead
        // of sliding gently.
        if (ropeBehavior?.kind === "belt" && beltTunnel && beltTunnelWallsActive) {
          const corridor = (ropeBehavior.beltCorridorWidth ?? 39) * WORLD_SCALE;
          const isLoose = beltGrip < 0.22; // after conveyor snap / loose phase

          // Only keep walls for bobs still on the conveyor rail.
          // Once a bob reaches the end of the path it is ejected and should fly free.
          const activeBobs = pendulumHandle.bobs.filter((b: any) => typeof b._beltRailT === 'number');

          for (const bob of activeBobs) {
            applyBeltTunnelContainment(beltTunnel, [bob], corridor * 0.5, {
              restitution: isLoose ? 0.72 : 0.32,
              bouncy: isLoose,
              strict: isLoose,
            });
          }
        }

        if (ropeBehavior?.kind === "bulwark") bulwarkTick(now);
        blackHoleTick(dt);
        if (reenergize) {
          // Piercer: periodic straight-line dash through a row of circles.
          if (behavior?.kind === "piercer") dashPiercer(now);
          // TP: random blinks. Rocket: continuous thrust.
          if (behavior?.kind === "teleport") teleportTick(now);
          if (behavior?.kind === "rocket") rocketTick(now, dt);
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
      // Hydra grows its own scoring "heads" (echoes) as it hits, on top of any
      // Multi-Bob echoes. `hydraBonusEcho` is 0 for every other bob.
      syncEchoBobs(snapped ? 0 : effects$.echoCount + hydraBonusEcho);
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
        if (ropeBehavior?.kind === "belt") {
          if (isBeltTunnelAttachment(attachment)) {
            beltVirtualPayout = resetBeltVirtual();
          } else {
            resetBeltPayout(pendulumHandle);
          }
        }
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
        resetBehaviorRunState();
        if (ropeBehavior?.kind === "belt" && beltTunnel) {
          resetPendulumToRest(pendulumHandle);
          beltVirtualPayout = resetBeltVirtual();
          applyBeltLaunchKick(
            pendulumHandle,
            beltTunnel,
            ropeBehavior.beltKickSpeed ?? 20
          );
        } else {
          launchPendulum(pendulumHandle, attachment, pendulum, effects$);
        }
        store.registerSwing();
        runIdleMs = 0;
        runStallLowMs = 0;
        speedRampAppliedMult = 1;
        syncEchoBobs(0);
        maneuvers.reset();
        // Rocket has no launch slingshot: bleed the kick down to a seed so the
        // continuous thrust (rocketTick) builds the swing from near-still. We
        // keep a sliver of the launch direction so the first thrust has a
        // tangent to push along.
        if (behavior?.kind === "rocket") {
          for (const bob of pendulumHandle.bobs) {
            Matter.Body.setVelocity(bob, {
              x: bob.velocity.x * 0.1,
              y: bob.velocity.y * 0.1,
            });
          }
          rocketLaunchAt = now;
        }
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
            // The rig is whole again — a Ravager mid-feast stops hunting.
            homingActive = false;
          }
          // Mechanic Rope: spending a token re-rolls its tunnel route. Wall
          // Rope: the re-strung rope drops any standing wall so it re-cycles.
          rerollBeltTunnel();
          restoreBulwarkWall();
          bulwarkActive = false;
          if (ropeBehavior?.kind === "belt") {
          if (isBeltTunnelAttachment(attachment)) {
            beltVirtualPayout = resetBeltVirtual();
          } else {
            resetBeltPayout(pendulumHandle);
          }
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
          // Breakable Bob: same fresh core as a new launch — full mass, can shed
          // again on the next zone hits (shards from before the spend are cleared).
          if (behavior?.kind === "splitter") {
            resetSplitterProgress();
            const freshScales = behaviorScales();
            setBobRadiusScale(
              pendulumHandle,
              boostedEffects.bobSizeMult * freshScales.size
            );
            setPendulumWeightScale(
              pendulumHandle,
              boostedEffects.weightMult * freshScales.weight
            );
            setRopeLengthScale(
              pendulumHandle,
              boostedEffects.ropeLengthMult *
                freshScales.rope *
                ropeBehaviorLenMult(now)
            );
          }
          if (ropeBehavior?.kind === "belt" && beltTunnel) {
            // Un-eject so a token spent after the bob was thrown out of the exit
            // puts it back on a fresh conveyor ride from the start, then give it a
            // much stronger launch kick along the path.
            beltRideEjected = false;
            beltEjectAt = 0;
            for (const b of pendulumHandle.bobs) {
              delete (b as any)._beltEjected;
              delete (b as any)._beltRailT;
            }
            beltRailRideInitialized = false;
            resetPendulumToRest(pendulumHandle);
            applyBeltLaunchKick(
              pendulumHandle,
              beltTunnel,
              (ropeBehavior.beltKickSpeed ?? 20) * 1.75
            );
          } else {
            relaunchPendulum(pendulumHandle, attachment, boostedEffects);
          }
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
        // Ravager: while the freed bob is still hunting, steer it onto live
        // circles before measuring speed / escape so the homing actually
        // counts toward this frame's motion.
        if (snapped && homingActive) steerHomingBobs(now);

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
        // The Mechanic Belt throws its bob free at the conveyor exit without
        // entering the global `snapped` state, so the escape check must also
        // close the run for an ejected belt bob that flies clear of the field
        // (e.g. a wall-less site) — otherwise it would hang forever. Give the
        // freshly-thrown bob a grace window first so it flies its arc / bounces
        // around the cage instead of ending the instant it clips the margin.
        const beltEjected = beltEjectAt > 0;
        const beltEjectFlying =
          beltEjected && now - beltEjectAt < BELT_EJECT_FLY_MS;
        if ((snapped || beltEjected) && !beltEjectFlying) {
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
            // Skip ejected belt bobs so they aren't pulled back toward the platform
            // while still in their ejector arc.
            const originalBobs = pendulumHandle.bobs;
            pendulumHandle.bobs = originalBobs.filter((b: any) => !(b as any)._beltEjected);
            settlePendulumTowardRest(pendulumHandle, alpha);
            pendulumHandle.bobs = originalBobs;
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
          //
          // For Mechanic Belt ejector bobs, we skip the platform rest pose so they
          // can enjoy their free-flight ejection arc instead of being yanked back.
          resetPendulumToRestExcludingEjected(pendulumHandle);
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
        if (blackHole) {
          drawBlackHole(rc, blackHole.x, blackHole.y, BLACK_HOLE_CORE_R, BLACK_HOLE_REACH, now);
        }
        drawWalls(rc, wallField);
        drawObstacles(rc, wallField);
        drawHitZones(rc, field);
        if (beltTunnel && ropeBehavior?.kind === "belt" && !pendulumHandle.snapped) {
          drawBeltTunnel(rc, beltTunnel, beltPathT, now);
        }
        drawTokens(rc, tokenField);
        const echoRender: EchoBobRender[] = [
          ...echoBobs.map((e) => ({
            x: e.body.position.x,
            y: e.body.position.y,
            radius: getEffectiveBobRadius(pendulumHandle),
          })),
          // Breakable's shed pieces ride along as extra echo-styled circles.
          ...shards.map((b) => ({
            x: b.position.x,
            y: b.position.y,
            radius: b.circleRadius ?? getEffectiveBobRadius(pendulumHandle),
          })),
        ];
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
          durability,
          bobDensity
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
      clearShards();
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
