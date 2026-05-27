import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { useGameStore } from "../state/store";
import {
  useEquippedAttachment,
  useEquippedPendulum,
  useEquippedSite,
} from "../state/selectors";
import { createEngine, destroyEngine, setGravity, applyAmbientForce } from "../game/engine";
import {
  buildPendulum,
  destroyPendulum,
  setPendulumWeightScale,
  type PendulumHandle,
} from "../game/pendulum";
import {
  destroyHitZones,
  findZoneByBody,
  generateHitZones,
  relocateZone,
  type HitZoneField,
} from "../game/hitZones";
import { aggregateEffects } from "../game/modifiers";
import { createManeuverDetector } from "../game/maneuvers";
import { rollRandomModifier } from "../data/modifiers";
import {
  applyShake,
  drawEffects,
  drawHitZones,
  drawPendulum,
  drawSite,
  type RenderContext,
} from "../game/render";
import {
  createEffectsState,
  emitHit,
  emitManeuver,
  tickEffects,
} from "../game/effects";

const VIRTUAL_WIDTH = 1280;
const VIRTUAL_HEIGHT = 800;
const ANCHOR = { x: VIRTUAL_WIDTH / 2, y: 120 };
const RUN_END_SPEED_THRESHOLD = 0.45;
const RUN_END_IDLE_MS = 1500;
const HIT_BOOST_BASE = 2.2;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendulumHandleRef = useRef<PendulumHandle | null>(null);
  const launchPendingRef = useRef(false);

  const pendulum = useEquippedPendulum();
  const attachment = useEquippedAttachment();
  const site = useEquippedSite();
  const worldVersion = useGameStore((s) => s.worldVersion);
  const runStartId = useGameStore((s) => s.runStartId);

  useEffect(() => {
    if (runStartId === 0) return;
    launchPendingRef.current = true;
  }, [runStartId]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;

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

    const field: HitZoneField = generateHitZones(
      engineHandle.world,
      site,
      { x: 60, y: 80, w: VIRTUAL_WIDTH - 120, h: VIRTUAL_HEIGHT - 160 },
      ANCHOR,
      attachment.length + pendulum.bobSpacing * Math.max(0, pendulum.bobCount - 1)
    );

    const effects = createEffectsState();
    const maneuvers = createManeuverDetector();

    let runIdleMs = 0;

    function handleCollision(evt: Matter.IEventCollision<Matter.Engine>) {
      const now = performance.now();
      const state = useGameStore.getState();
      const effects$ = aggregateEffects(state.activeModifiers);
      for (const pair of evt.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        const zoneBody = a.label.startsWith("zone:")
          ? a
          : b.label.startsWith("zone:")
            ? b
            : null;
        const bobBody = a.label.startsWith("bob-")
          ? a
          : b.label.startsWith("bob-")
            ? b
            : null;
        if (!zoneBody || !bobBody) continue;
        const handle = findZoneByBody(field, zoneBody);
        if (!handle) continue;
        const z = handle.zone;
        const base =
          z.basePoints *
          z.multiplier *
          pendulum.basePointMultiplier *
          (attachment.bonuses.momentumMult ?? 1) *
          effects$.pointMult;
        const comboStacks = useGameStore.getState().combo.count + 1;
        const comboBonus = Math.min(20, comboStacks) * 0.05;
        const total = Math.max(1, Math.round(base * (1 + comboBonus)));

        useGameStore.getState().registerHit(total, now);
        handle.hitFlashUntil = now + 240;

        emitHit(effects, z.position, now, {
          color: "#facc15",
          points: total,
          intensity: 1 + Math.min(2, comboStacks / 12),
        });

        applyHitBoost(pendulumHandle, bobBody, z.multiplier, effects$);

        if (comboStacks > 1 && comboStacks % 5 === 0) {
          const bonus = 5 * comboStacks;
          useGameStore.getState().addMomentum(bonus);
          emitManeuver(
            effects,
            bobBody.position,
            `Combo x${comboStacks} +${bonus}`,
            now
          );
        }

        if (Math.random() < z.modifierChance) {
          const mod = rollRandomModifier();
          useGameStore.getState().pushModifier(mod.id, now);
        }

        relocateZone(
          field,
          handle,
          attachment.length +
            pendulum.bobSpacing * Math.max(0, pendulum.bobCount - 1)
        );
      }
    }

    Matter.Events.on(engineHandle.engine, "collisionStart", handleCollision);

    let lastT = performance.now();
    let raf = 0;
    const ctx = canvas.getContext("2d")!;

    function frame(now: number) {
      const dt = Math.min(64, now - lastT);
      lastT = now;
      const store = useGameStore.getState();
      store.expireModifiers(now);
      store.decayCombo(now, 1800);

      const effects$ = aggregateEffects(store.activeModifiers);
      setPendulumWeightScale(pendulumHandle, effects$.weightMult);
      setGravity(engineHandle, site.gravity * effects$.accelerationMult);
      if (site.ambient && store.isRunning) {
        applyAmbientForce(engineHandle, pendulumHandle.bobs, site.ambient);
      }

      if (launchPendingRef.current) {
        launchPendingRef.current = false;
        launchPendulum(pendulumHandle, attachment, pendulum, effects$);
        store.registerSwing();
        runIdleMs = 0;
        maneuvers.reset();
        emitManeuver(effects, pendulumHandle.bobs[0].position, "LAUNCH!", now);
      }

      const last = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];

      if (store.isRunning) {
        const events = maneuvers.push(now, last, pendulumHandle.pivot.position);
        for (const ev of events) {
          useGameStore.getState().addMomentum(ev.def.bonus);
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
        if (runIdleMs >= RUN_END_IDLE_MS) {
          runIdleMs = 0;
          useGameStore.getState().endRun();
          emitManeuver(effects, last.position, "Run Complete", now);
        }
      } else {
        maneuvers.reset();
        runIdleMs = 0;
      }

      tickEffects(effects, dt, now);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const rc: RenderContext = { ctx, width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT, now };
      applyShake(rc, effects);
      drawSite(rc, site, ANCHOR);
      drawHitZones(rc, field);
      drawPendulum(rc, pendulumHandle, pendulum, attachment);
      drawEffects(rc, effects);
      ctx.restore();

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      Matter.Events.off(engineHandle.engine, "collisionStart", handleCollision);
      destroyHitZones(engineHandle.world, field);
      destroyPendulum(engineHandle.world, pendulumHandle);
      destroyEngine(engineHandle);
      pendulumHandleRef.current = null;
    };
    // Rebuild whenever equipped items change or worldVersion bumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendulum.id, attachment.id, site.id, worldVersion]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="h-full w-full select-none"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}

function launchPendulum(
  handle: PendulumHandle,
  attachment: import("../types").AttachmentDef,
  pendulum: import("../types").PendulumDef,
  effects$: { twistPowerMult: number }
) {
  const dir = Math.random() < 0.5 ? -1 : 1;
  const twistBonus = attachment.bonuses.twistPowerBonus ?? 0;
  const velBonus = attachment.bonuses.velocityBonus ?? 0;
  const baseSpeed = 20;
  const speed =
    baseSpeed *
    (1 + twistBonus) *
    (1 + velBonus) *
    effects$.twistPowerMult *
    (0.9 + Math.random() * 0.25);

  for (let i = 0; i < handle.bobs.length; i++) {
    const bob = handle.bobs[i];
    const rx = bob.position.x - handle.pivot.position.x;
    const ry = bob.position.y - handle.pivot.position.y;
    const len = Math.hypot(rx, ry) || 1;
    const tx = -ry / len;
    const ty = rx / len;
    const segmentBoost = 1 - i * 0.05;
    Matter.Body.setVelocity(bob, {
      x: tx * dir * speed * segmentBoost,
      y: ty * dir * speed * segmentBoost,
    });
    Matter.Body.setAngularVelocity(bob, 0);
  }
  void pendulum;
}

function applyHitBoost(
  handle: PendulumHandle,
  bob: Matter.Body,
  zoneMultiplier: number,
  effects$: { twistPowerMult: number }
) {
  const rx = bob.position.x - handle.pivot.position.x;
  const ry = bob.position.y - handle.pivot.position.y;
  const len = Math.hypot(rx, ry) || 1;
  const tx = -ry / len;
  const ty = rx / len;
  const sign = bob.angularVelocity >= 0 ? 1 : -1;
  const speedNow = Math.hypot(bob.velocity.x, bob.velocity.y);
  const boost = HIT_BOOST_BASE * zoneMultiplier * effects$.twistPowerMult;
  const nextSpeed = speedNow + boost;
  Matter.Body.setVelocity(bob, {
    x: bob.velocity.x + tx * sign * boost,
    y: bob.velocity.y + ty * sign * boost,
  });
  void nextSpeed;
}
