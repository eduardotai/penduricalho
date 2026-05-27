import Matter from "matter-js";
import type { HitZone, SiteDef, Vec2 } from "../types";

const MODIFIER_CHANCE_BASE = 0.07;

export interface HitZoneHandle {
  zone: HitZone;
  body: Matter.Body;
  hitFlashUntil: number;
}

export interface HitZoneField {
  zones: HitZoneHandle[];
  bounds: { x: number; y: number; w: number; h: number };
  site: SiteDef;
  anchor: Vec2;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function generateHitZones(
  world: Matter.World,
  site: SiteDef,
  bounds: { x: number; y: number; w: number; h: number },
  anchor: Vec2,
  pendulumLength: number
): HitZoneField {
  const zones: HitZoneHandle[] = [];
  for (let i = 0; i < site.hitZoneCount; i++) {
    zones.push(createZone(world, site, bounds, anchor, pendulumLength, i));
  }
  return { zones, bounds, site, anchor };
}

function createZone(
  world: Matter.World,
  site: SiteDef,
  bounds: { x: number; y: number; w: number; h: number },
  anchor: Vec2,
  pendulumLength: number,
  index: number
): HitZoneHandle {
  const [rmin, rmax] = site.hitZoneRadius;
  const radius = randomBetween(rmin, rmax);
  const pos = pickZonePosition(bounds, anchor, pendulumLength, radius);
  const basePoints = Math.round(randomBetween(1, 5));
  const multiplier = +(randomBetween(1, 1.5) + index * 0.02).toFixed(2);
  const zone: HitZone = {
    id: `z-${index}-${Math.random().toString(36).slice(2, 7)}`,
    position: pos,
    radius,
    basePoints,
    multiplier,
    modifierChance: MODIFIER_CHANCE_BASE + Math.random() * 0.08,
  };
  const body = Matter.Bodies.circle(pos.x, pos.y, radius, {
    isStatic: true,
    isSensor: true,
    label: `zone:${zone.id}`,
  });
  Matter.World.add(world, body);
  return { zone, body, hitFlashUntil: 0 };
}

function pickZonePosition(
  bounds: { x: number; y: number; w: number; h: number },
  anchor: Vec2,
  pendulumLength: number,
  radius: number
): Vec2 {
  const safeMargin = 28 + radius;
  const innerExclusion = Math.max(60, pendulumLength * 0.4);
  for (let attempt = 0; attempt < 16; attempt++) {
    const x = randomBetween(bounds.x + safeMargin, bounds.x + bounds.w - safeMargin);
    const y = randomBetween(
      anchor.y + 40,
      bounds.y + bounds.h - safeMargin
    );
    const dx = x - anchor.x;
    const dy = y - anchor.y;
    const dist = Math.hypot(dx, dy);
    if (dist < innerExclusion) continue;
    if (dist > pendulumLength * 1.7) continue;
    return { x, y };
  }
  return {
    x: anchor.x + (Math.random() < 0.5 ? -1 : 1) * pendulumLength * 0.9,
    y: anchor.y + pendulumLength * 0.9,
  };
}

export function relocateZone(
  field: HitZoneField,
  handle: HitZoneHandle,
  pendulumLength: number
) {
  const [rmin, rmax] = field.site.hitZoneRadius;
  const radius = randomBetween(rmin, rmax);
  const pos = pickZonePosition(field.bounds, field.anchor, pendulumLength, radius);
  Matter.Body.setPosition(handle.body, pos);
  handle.zone.position = pos;
  handle.zone.radius = radius;
  handle.zone.basePoints = Math.round(randomBetween(1, 5));
  handle.zone.multiplier = +(randomBetween(1, 1.5)).toFixed(2);
  handle.zone.modifierChance = MODIFIER_CHANCE_BASE + Math.random() * 0.08;
}

export function destroyHitZones(world: Matter.World, field: HitZoneField) {
  for (const h of field.zones) Matter.World.remove(world, h.body);
}

export function findZoneByBody(field: HitZoneField, body: Matter.Body): HitZoneHandle | null {
  return field.zones.find((z) => z.body === body) ?? null;
}
