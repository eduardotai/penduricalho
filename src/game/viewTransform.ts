import type { Vec2 } from "../types";

export interface ViewTransform {
  displayWidth: number;
  displayHeight: number;
  coverScale: number;
  fitX: number;
  fitY: number;
}

export function computeViewTransform(
  displayWidth: number,
  displayHeight: number,
  virtualWidth: number,
  virtualHeight: number
): ViewTransform {
  const coverScale = Math.max(
    displayWidth / virtualWidth,
    displayHeight / virtualHeight
  );
  return {
    displayWidth,
    displayHeight,
    coverScale,
    fitX: (displayWidth - virtualWidth * coverScale) / 2,
    fitY: (displayHeight - virtualHeight * coverScale) / 2,
  };
}

/** Zoom around the pendulum anchor; pan is in virtual world units. */
export function applyWorldCamera(
  ctx: CanvasRenderingContext2D,
  view: ViewTransform,
  anchor: Vec2,
  zoom: number,
  panX: number,
  panY: number
) {
  ctx.translate(view.fitX, view.fitY);
  ctx.scale(view.coverScale, view.coverScale);
  ctx.translate(anchor.x, anchor.y);
  ctx.scale(zoom, zoom);
  ctx.translate(-anchor.x + panX, -anchor.y + panY);
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  view: ViewTransform,
  anchor: Vec2,
  zoom: number,
  panX: number,
  panY: number
): Vec2 {
  let x = (screenX - view.fitX) / view.coverScale;
  let y = (screenY - view.fitY) / view.coverScale;
  x = (x - anchor.x) / zoom + anchor.x - panX;
  y = (y - anchor.y) / zoom + anchor.y - panY;
  return { x, y };
}

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The world-space rectangle currently on screen for this camera. */
export function visibleWorldRect(
  view: ViewTransform,
  anchor: Vec2,
  zoom: number,
  panX: number,
  panY: number
): WorldRect {
  const a = screenToWorld(0, 0, view, anchor, zoom, panX, panY);
  const b = screenToWorld(view.displayWidth, view.displayHeight, view, anchor, zoom, panX, panY);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/**
 * Where multiplier circles should spawn. On cages larger than the playfield
 * (cageScale > 1) most of the cage sits off camera, so spawn inside the part of
 * the cage that is on screen instead of wasting circles out of view. Falls back
 * to the full cage when the visible overlap is too small to be useful (e.g.
 * the camera is panned away). cageScale ≤ 1 maps (Workshop, Bumper Cage,
 * Layers) always use the full cage, unchanged.
 */
export function zoneSpawnRect(cage: WorldRect, visible: WorldRect, cageScale: number): WorldRect {
  if (cageScale <= 1) return cage;
  const x0 = Math.max(cage.x, visible.x);
  const y0 = Math.max(cage.y, visible.y);
  const x1 = Math.min(cage.x + cage.w, visible.x + visible.w);
  const y1 = Math.min(cage.y + cage.h, visible.y + visible.h);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0 || w * h < cage.w * cage.h * 0.15) return cage;
  return { x: x0, y: y0, w, h };
}
