/** Small shared helpers for theme art. Pure canvas drawing. */

/** Deterministic PRNG (Park–Miller) so cached layers don't shimmer between rebuilds. */
export function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Returns an offscreen canvas built once per (key, size) and reused every
 * frame. One slot per caller, so alternating sizes (shop preview vs. game)
 * only rebuild when the size actually changes for that slot.
 */
export function cachedLayer(
  slot: { key: string; canvas: HTMLCanvasElement | null },
  key: string,
  width: number,
  height: number,
  paint: (g: CanvasRenderingContext2D, w: number, h: number) => void
): HTMLCanvasElement {
  const full = `${key}:${Math.ceil(width)}x${Math.ceil(height)}`;
  if (slot.canvas && slot.key === full) return slot.canvas;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(width));
  c.height = Math.max(1, Math.ceil(height));
  paint(c.getContext("2d")!, c.width, c.height);
  slot.key = full;
  slot.canvas = c;
  return c;
}

export type LayerSlot = { key: string; canvas: HTMLCanvasElement | null };

/** Device pixels per CSS unit of the current transform (1 if degenerate). */
export function deviceScale(ctx: CanvasRenderingContext2D): number {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

/** Rounds a screen offset (CSS units) to the nearest device pixel. */
export function snapToDevice(v: number, scale: number): number {
  return Math.round(v * scale) / scale;
}

/**
 * Draws a full-rect static layer covering (0,0)-(width,height) in the current
 * user space, painted once at device-pixel resolution and blitted 1:1 every
 * frame after that. Backdrops use it to flatten their static parts (gradients,
 * lamp pools, cached textures, vignettes) into a single copy: on software
 * raster a full-screen gradient fill costs far more than a pixel copy.
 *
 * `paint` draws in CSS units, exactly as it would onto `ctx`; `key` must
 * change whenever what it draws changes (site palette, snapped parallax
 * offsets). Only source-over content belongs here, so flattening is exact.
 */
export function drawStaticLayer(
  ctx: CanvasRenderingContext2D,
  slot: LayerSlot,
  key: string,
  width: number,
  height: number,
  paint: (g: CanvasRenderingContext2D, w: number, h: number) => void
): void {
  const m = ctx.getTransform();
  const W = Math.max(1, Math.round(width * (Math.hypot(m.a, m.b) || 1)));
  const H = Math.max(1, Math.round(height * (Math.hypot(m.c, m.d) || 1)));
  const full = `${key}@${W}x${H}`;
  let layer = slot.canvas;
  if (!layer || slot.key !== full) {
    // Reuse the backing canvas while the size holds (e.g. a camera drag
    // changes the parallax key every frame) instead of allocating a new one.
    if (!layer || layer.width !== W || layer.height !== H) {
      layer = document.createElement("canvas");
      layer.width = W;
      layer.height = H;
    }
    const g = layer.getContext("2d")!;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.scale(W / Math.max(1, width), H / Math.max(1, height));
    paint(g, width, height);
    g.restore();
    slot.key = full;
    slot.canvas = layer;
  }
  if (m.b === 0 && m.c === 0 && m.a > 0 && m.d > 0) {
    // Axis-aligned (the arena always is): copy without resampling.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, Math.round(m.e), Math.round(m.f));
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(layer, 0, 0, width, height);
  }
}

export function vignette(ctx: CanvasRenderingContext2D, width: number, height: number, strength: number) {
  const minSide = Math.min(width, height);
  const vig = ctx.createRadialGradient(
    width / 2,
    height / 2,
    minSide * 0.35,
    width / 2,
    height / 2,
    Math.hypot(width, height) * 0.62
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
}
