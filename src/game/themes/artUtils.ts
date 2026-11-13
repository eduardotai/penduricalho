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
