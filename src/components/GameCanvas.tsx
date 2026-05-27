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
import { createInputController } from "../game/input";
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
import type { ActiveModifier } from "../types";

const VIRTUAL_WIDTH = 1280;
const VIRTUAL_HEIGHT = 800;
const ANCHOR = { x: VIRTUAL_WIDTH / 2, y: 120 };

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const pendulum = useEquippedPendulum();
  const attachment = useEquippedAttachment();
  const site = useEquippedSite();
  const worldVersion = useGameStore((s) => s.worldVersion);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;

    const engineHandle = createEngine(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    setGravity(engineHandle, site.gravity);

    let pendulumHandle: PendulumHandle = buildPendulum(
      engineHandle.world,
      pendulum,
      attachment,
      ANCHOR,
      1
    );

    let field: HitZoneField = generateHitZones(
      engineHandle.world,
      site,
      { x: 60, y: 80, w: VIRTUAL_WIDTH - 120, h: VIRTUAL_HEIGHT - 160 },
      ANCHOR,
      attachment.length + (pendulum.bobSpacing * Math.max(0, pendulum.bobCount - 1))
    );

    const effects = createEffectsState();
    const maneuvers = createManeuverDetector();

    const input = createInputController(
      canvas,
      pendulumHandle,
      {
        twistPowerMult: 1,
        twistPowerBonus: attachment.bonuses.twistPowerBonus ?? 0,
        onTwist: (force) => {
          useGameStore.getState().registerSwing();
          const last = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
          const event = maneuvers.reportTwist(
            performance.now(),
            last,
            pendulumHandle.pivot.position,
            force
          );
          if (event) {
            useGameStore.getState().addMomentum(event.def.bonus);
            emitManeuver(
              effects,
              last.position,
              `${event.def.name} +${event.def.bonus}`,
              performance.now()
            );
          }
        },
      }
    );
    input.attach();

    function handleCollision(evt: Matter.IEventCollision<Matter.Engine>) {
      const now = performance.now();
      const state = useGameStore.getState();
      const effects$ = aggregateEffects(state.activeModifiers);
      for (const pair of evt.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        const zoneBody =
          a.label.startsWith("zone:") ? a : b.label.startsWith("zone:") ? b : null;
        const bobBody =
          a.label.startsWith("bob-") ? a : b.label.startsWith("bob-") ? b : null;
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
      const dt = now - lastT;
      lastT = now;
      const store = useGameStore.getState();
      store.expireModifiers(now);
      store.decayCombo(now, 1800);

      const effects$ = aggregateEffects(store.activeModifiers);
      input.setContext({
        twistPowerMult: effects$.twistPowerMult,
        twistPowerBonus: attachment.bonuses.twistPowerBonus ?? 0,
      });
      setPendulumWeightScale(pendulumHandle, effects$.weightMult);
      setGravity(engineHandle, site.gravity * effects$.accelerationMult);
      if (site.ambient) {
        applyAmbientForce(engineHandle, pendulumHandle.bobs, site.ambient);
      }

      const last = pendulumHandle.bobs[pendulumHandle.bobs.length - 1];
      const events = maneuvers.push(now, last, pendulumHandle.pivot.position);
      for (const ev of events) {
        useGameStore.getState().addMomentum(ev.def.bonus);
        emitManeuver(effects, last.position, `${ev.def.name} +${ev.def.bonus}`, now);
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
      input.detach();
      destroyHitZones(engineHandle.world, field);
      destroyPendulum(engineHandle.world, pendulumHandle);
      destroyEngine(engineHandle);
    };
    // Rebuild whenever equipped items change or worldVersion bumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendulum.id, attachment.id, site.id, worldVersion]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none select-none"
        style={{ cursor: "grab" }}
      />
    </div>
  );
}

// Force TS to treat ActiveModifier as used for any future refactor convenience.
export type _Touch = ActiveModifier;
