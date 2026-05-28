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
