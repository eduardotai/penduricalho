import Matter from "matter-js";
import type { HitZone, SiteDef, Vec2 } from "../types";

// Probability (per zone hit) of spawning a Token on the canvas. Tokens are a
// visible, collectable thing now — not a silent buff — so we lean higher to
// keep the playfield lively and feed the Golden Token combo loop.
const MODIFIER_CHANCE_BASE = 0.18;

// Tightened automatically when a spawn band is shallow.
const GRID_SPACING_DEFAULT = 88;
const GRID_SPACING_MIN = 32;

interface SpawnBand {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

function computeGridSpacing(
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
  count: number
): number {
  const usableW = xMax - xMin;
  const usableH = yMax - yMin;
  if (usableW <= 0 || usableH <= 0) return GRID_SPACING_DEFAULT;

  for (let spacing = GRID_SPACING_DEFAULT; spacing >= GRID_SPACING_MIN; spacing -= 4) {
    const cols = Math.max(1, Math.floor(usableW / spacing));
    const rows = Math.max(1, Math.floor(usableH / spacing));
    if (cols * rows >= count * 1.15) return spacing;
  }
  return GRID_SPACING_MIN;
}

function bandArea(band: SpawnBand): number {
  return Math.max(0, band.xMax - band.xMin) * Math.max(0, band.yMax - band.yMin);
}

/** Upper + lower bands (full width), separated by the mount block. */
function spawnBands(
  bounds: { x: number; y: number; w: number; h: number },
  anchor: Vec2,
  maxRadius: number
): { upper: SpawnBand; lower: SpawnBand } {
  const inset = maxRadius;
  const mountPad = 4 + maxRadius * 0.45;
  const mountTop = anchor.y - 24;
  const mountFloor = anchor.y + 14 + mountPad;
  const xMin = bounds.x + inset;
  const xMax = bounds.x + bounds.w - inset;

  return {
    upper: {
      xMin,
      yMin: bounds.y + inset,
      xMax,
      yMax: mountTop - mountPad,
    },
    lower: {
      xMin,
      yMin: mountFloor,
      xMax,
      yMax: bounds.y + bounds.h - inset,
    },
  };
}

function pickBand(bands: { upper: SpawnBand; lower: SpawnBand }): SpawnBand {
  const upperArea = bandArea(bands.upper);
  const lowerArea = bandArea(bands.lower);
  const total = upperArea + lowerArea;
  if (total <= 0) return bands.upper;
  if (lowerArea <= 0) return bands.upper;
  if (upperArea <= 0) return bands.lower;
  return Math.random() < upperArea / total ? bands.upper : bands.lower;
}

function splitCountByArea(
  count: number,
  upperArea: number,
  lowerArea: number
): [number, number] {
  const total = upperArea + lowerArea;
  if (total <= 0) return [Math.ceil(count / 2), Math.floor(count / 2)];
  if (lowerArea <= 0) return [count, 0];
  if (upperArea <= 0) return [0, count];
  const upper = Math.round(count * (upperArea / total));
  return [upper, count - upper];
}

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

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Keep circles off the mount block — both upper and lower bands stay clear. */
function isValidZonePosition(
  pos: Vec2,
  anchor: Vec2,
  maxRadius: number,
  spawnYMin: number
): boolean {
  if (pos.y < spawnYMin) return false;
  const pad = 4 + maxRadius * 0.45;
  return !(
    pos.x >= anchor.x - 58 - pad &&
    pos.x <= anchor.x + 58 + pad &&
    pos.y >= anchor.y - 22 - pad &&
    pos.y <= anchor.y + 14 + pad
  );
}

function gridSlotsInRect(
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
  spacing: number,
  anchor: Vec2,
  maxRadius: number,
  spawnYMin: number
): Vec2[] {
  const usableW = xMax - xMin;
  const usableH = yMax - yMin;
  if (usableW <= 0 || usableH <= 0) return [];

  const cols = Math.max(1, Math.floor(usableW / spacing));
  const rows = Math.max(1, Math.floor(usableH / spacing));
  const cellW = usableW / cols;
  const cellH = usableH / rows;
  const jitterX = cellW * 0.28;
  const jitterY = cellH * 0.28;
  const slots: Vec2[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pos = {
        x: xMin + (col + 0.5) * cellW + (Math.random() - 0.5) * jitterX * 2,
        y: yMin + (row + 0.5) * cellH + (Math.random() - 0.5) * jitterY * 2,
      };
      if (isValidZonePosition(pos, anchor, maxRadius, spawnYMin)) slots.push(pos);
    }
  }
  return slots;
}

function fillBandLayout(
  band: SpawnBand,
  count: number,
  anchor: Vec2,
  maxRadius: number
): Vec2[] {
  if (count <= 0) return [];
  const { xMin, yMin, xMax, yMax } = band;
  const spacing = computeGridSpacing(xMin, yMin, xMax, yMax, count);
  const slots = gridSlotsInRect(
    xMin,
    yMin,
    xMax,
    yMax,
    spacing,
    anchor,
    maxRadius,
    yMin
  );

  shuffle(slots);
  if (slots.length >= count) return slots.slice(0, count);

  const picked = [...slots];
  while (picked.length < count) {
    const pos = {
      x: xMin + Math.random() * (xMax - xMin),
      y: yMin + Math.random() * (yMax - yMin),
    };
    if (isValidZonePosition(pos, anchor, maxRadius, yMin)) picked.push(pos);
  }
  return picked.slice(0, count);
}

/** Evenly tile upper and lower canvas (full width, mount gap excluded). */
function computeEvenLayout(
  bounds: { x: number; y: number; w: number; h: number },
  anchor: Vec2,
  count: number,
  maxRadius: number,
  _pendulumLength: number
): Vec2[] {
  const bands = spawnBands(bounds, anchor, maxRadius);
  const [upperCount, lowerCount] = splitCountByArea(
    count,
    bandArea(bands.upper),
    bandArea(bands.lower)
  );
  return [
    ...fillBandLayout(bands.upper, upperCount, anchor, maxRadius),
    ...fillBandLayout(bands.lower, lowerCount, anchor, maxRadius),
  ];
}

function pickZonePosition(
  bounds: { x: number; y: number; w: number; h: number },
  anchor: Vec2,
  _pendulumLength: number,
  radius: number
): Vec2 {
  const bands = spawnBands(bounds, anchor, radius);
  for (let attempt = 0; attempt < 48; attempt++) {
    const band = pickBand(bands);
    const { xMin, yMin, xMax, yMax } = band;
    const pos = {
      x: xMin + Math.random() * (xMax - xMin),
      y: yMin + Math.random() * (yMax - yMin),
    };
    if (isValidZonePosition(pos, anchor, radius, yMin)) return pos;
  }
  const fallback = pickBand(bands);
  return {
    x: fallback.xMin + Math.random() * (fallback.xMax - fallback.xMin),
    y: fallback.yMin + Math.random() * (fallback.yMax - fallback.yMin),
  };
}

export function generateHitZones(
  world: Matter.World,
  site: SiteDef,
  bounds: { x: number; y: number; w: number; h: number },
  anchor: Vec2,
  pendulumLength: number
): HitZoneField {
  const [, rmax] = site.hitZoneRadius;
  const layout = computeEvenLayout(
    bounds,
    anchor,
    site.hitZoneCount,
    rmax,
    pendulumLength
  );
  const zones: HitZoneHandle[] = [];
  for (let i = 0; i < site.hitZoneCount; i++) {
    zones.push(
      createZone(world, site, bounds, anchor, pendulumLength, i, layout[i])
    );
  }
  return { zones, bounds, site, anchor };
}

function createZone(
  world: Matter.World,
  site: SiteDef,
  bounds: { x: number; y: number; w: number; h: number },
  anchor: Vec2,
  pendulumLength: number,
  index: number,
  fixedPosition?: Vec2
): HitZoneHandle {
  const [rmin, rmax] = site.hitZoneRadius;
  const radius = randomBetween(rmin, rmax);
  const pos =
    fixedPosition ??
    pickZonePosition(bounds, anchor, pendulumLength, radius);
  const basePoints = Math.round(randomBetween(1, 5));
  const multiplier = +(randomBetween(1, 1.5) + index * 0.02).toFixed(2);
  const zone: HitZone = {
    id: `z-${index}-${Math.random().toString(36).slice(2, 7)}`,
    position: pos,
    radius,
    basePoints,
    multiplier,
    modifierChance: MODIFIER_CHANCE_BASE + Math.random() * 0.1,
  };
  const body = Matter.Bodies.circle(pos.x, pos.y, radius, {
    isStatic: true,
    isSensor: true,
    label: `zone:${zone.id}`,
  });
  Matter.World.add(world, body);
  return { zone, body, hitFlashUntil: 0 };
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
  handle.zone.modifierChance = MODIFIER_CHANCE_BASE + Math.random() * 0.1;
}

// Rerolls every hit zone in the field with a fresh random position, radius,
// base points, and multiplier — used when a new run is launched so the player
// gets a brand new layout each time they hit "Run Again". Any bonus zones
// added mid-run (via spawnExtraZones) are removed first so the new run
// starts from the canonical site layout.
export function regenerateHitZones(
  world: Matter.World,
  field: HitZoneField,
  pendulumLength: number
) {
  while (field.zones.length > field.site.hitZoneCount) {
    const extra = field.zones.pop()!;
    Matter.World.remove(world, extra.body);
  }
  const [, rmax] = field.site.hitZoneRadius;
  const layout = computeEvenLayout(
    field.bounds,
    field.anchor,
    field.zones.length,
    rmax,
    pendulumLength
  );
  for (let i = 0; i < field.zones.length; i++) {
    const handle = field.zones[i];
    const [rmin, rmax] = field.site.hitZoneRadius;
    const radius = randomBetween(rmin, rmax);
    const pos = layout[i];
    Matter.Body.setPosition(handle.body, pos);
    handle.zone.position = pos;
    handle.zone.radius = radius;
    handle.zone.basePoints = Math.round(randomBetween(1, 5));
    handle.zone.multiplier = +(randomBetween(1, 1.5)).toFixed(2);
    handle.zone.modifierChance = MODIFIER_CHANCE_BASE + Math.random() * 0.1;
    handle.hitFlashUntil = 0;
  }
}

// Append N additional hit zones to the field for the remainder of the run.
// Called when a Golden Token is consumed so the player gets a denser
// playfield to feed back into the boosted spin. Extras are reaped at the
// start of the next run by regenerateHitZones, and a per-site cap keeps the
// canvas readable while letting late-game sites absorb more golden-token fuel.
const GOLDEN_ZONE_HEADROOM = 48;

export function maxTotalZonesForSite(site: SiteDef): number {
  return site.hitZoneCount + GOLDEN_ZONE_HEADROOM;
}

export function spawnExtraZones(
  world: Matter.World,
  field: HitZoneField,
  count: number,
  pendulumLength: number
): HitZoneHandle[] {
  const added: HitZoneHandle[] = [];
  const cap = maxTotalZonesForSite(field.site);
  const room = Math.max(0, cap - field.zones.length);
  const toAdd = Math.min(count, room);
  for (let i = 0; i < toAdd; i++) {
    const handle = createZone(
      world,
      field.site,
      field.bounds,
      field.anchor,
      pendulumLength,
      field.zones.length
    );
    field.zones.push(handle);
    added.push(handle);
  }
  return added;
}

export function destroyHitZones(world: Matter.World, field: HitZoneField) {
  for (const h of field.zones) Matter.World.remove(world, h.body);
}

export function findZoneByBody(field: HitZoneField, body: Matter.Body): HitZoneHandle | null {
  return field.zones.find((z) => z.body === body) ?? null;
}
