import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { useGameStore } from "../state/store";
import {
  resolveEquippedCosmetics,
  useEquippedAttachment,
  useEquippedPendulum,
  useEquippedSite,
} from "../state/selectors";
import { createEngine, destroyEngine, setGravity, applyAmbientForce } from "../game/engine";
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
  applySpeedRampDelta,
  type PendulumHandle,
} from "../game/pendulum";
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
// Once the pendulum's fastest bob drops below this for STALL_TIME_MS while
// still in a run, we treat the run as "no more circles reachable" — the
// pendulum is clearly decelerating and unlikely to land more hits. We use this
// to enable the "Run Again" button before the full auto end-of-run kicks in.
const STALL_SPEED_THRESHOLD = 2.5;
const STALL_TIME_MS = 350;
// Hit-stop: brief whole-scene freeze on contact to sell the impact. Physics
// and effects both pause for this many ms, but no velocity is shed — the bob
// resumes with the exact same momentum (and twist) it had at impact.
// Only one pulse per burst: rapid multi-zone contacts must not stack freezes.
const HIT_STOP_MS = 28;
const HIT_STOP_COOLDOWN_MS = 90;
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

  useEffect(() => {
    if (runStartId === 0) return;
    launchPendingRef.current = true;
  }, [runStartId]);

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

    const field: HitZoneField = generateHitZones(
      engineHandle.world,
      site,
      { x: 0, y: 0, w: VIRTUAL_WIDTH, h: VIRTUAL_HEIGHT },
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
          const def = rollRandomToken();
          spawnToken(engineHandle.world, tokenField, def, z.position, now);
          playGameSound(
            def.kind === "golden" ? "token-spawn-golden" : "token-spawn"
          );
          emitManeuver(
            effects,
            z.position,
            guaranteed
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

      if (def.isGolden) {
        // Golden Tokens are NOT auto-fired. They go straight into the player's
        // ready slot so the player chooses when to spend them — e.g. when a
        // multi-bob is active, or just before the pendulum stalls. The actual
        // re-launch + bonus modifier happens in the consume-epoch handler.
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

        const tokenBody = isTokenBody(a) ? a : isTokenBody(b) ? b : null;
        if (!tokenBody) continue;
        const tHandle = findTokenByBody(tokenField, tokenBody);
        if (tHandle) collectToken(tHandle, bobBody, now);
      }
    }

    Matter.Events.on(engineHandle.engine, "collisionStart", handleCollision);

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
      tickAttachmentPhysics(pendulumHandle);
      if (store.isRunning && dt > 0) {
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
        applyAmbientForce(engineHandle, pendulumHandle.ropeSegments, {
          x: site.ambient.x * 0.35,
          y: site.ambient.y * 0.35,
        });
      }

      // Spawn / despawn echo sensor bodies to match the active Multi-Bob
      // modifier, then snap them onto the rope line trailing the real bob.
      syncEchoBobs(effects$.echoCount);
      syncEchoBobScales();
      positionChainBobs(pendulumHandle);
      positionEchoBobs();
      tickBobZoneHits(now);
      tickTokens(tokenField, now);
      const reaped = reapTokens(engineHandle.world, tokenField, now);
      if (reaped.expired.length > 0) {
        playGameSound("token-expire", { volume: 0.7 });
      }

      if (launchPendingRef.current) {
        launchPendingRef.current = false;
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
        const events = maneuvers.push(now, last, pendulumHandle.pivot.position);
        for (const ev of events) {
          useGameStore.getState().addMomentum(ev.def.bonus);
          playGameSound("maneuver", { variant: ev.def.id });
          emitManeuver(effects, last.position, `${ev.def.name} +${ev.def.bonus}`, now);
        }

        let maxSpeed = 0;
        for (const bob of pendulumHandle.bobs) {
          const s = Math.hypot(bob.velocity.x, bob.velocity.y);
          if (s > maxSpeed) maxSpeed = s;
        }
        if (maxSpeed < RUN_END_SPEED_THRESHOLD) {
          runIdleMs += dt;
        } else {
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
        if (runStallLowMs >= STALL_TIME_MS && !store.runStalled) {
          useGameStore.getState().markRunStalled();
          playGameSound("run-stall", { volume: 0.6 });
        }
        if (runIdleMs >= RUN_END_IDLE_MS) {
          runIdleMs = 0;
          useGameStore.getState().endRun();
          playGameSound("run-complete");
          emitManeuver(effects, last.position, "Run Complete", now);
        }
      } else {
        maneuvers.reset();
        runIdleMs = 0;
        runStallLowMs = 0;
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
          activeShape.shape
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
      destroyHitZones(engineHandle.world, field);
      destroyTokenField(engineHandle.world, tokenField);
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
