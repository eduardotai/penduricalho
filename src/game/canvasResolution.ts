/**
 * Backing-store scale for the arena canvas.
 *
 * A full-screen 1366×820 canvas at devicePixelRatio 2 is ~4.5 megapixels.
 * Headless Chrome at that size holds only ~19 fps, even though JS draw time
 * stays ~2 ms — the extra pixels are spent in raster and compositing. We cap
 * the product of CSS size and scale so the backing store stays around
 * 1.5 MPx: a 1366×820 laptop lands near 1.16×, a 390×844 phone keeps 2×, and
 * a 4K window is allowed to drop slightly below 1× rather than rasterizing
 * eight million pixels every frame.
 */
export const CANVAS_MAX_PIXELS = 1_500_000;
export const CANVAS_MAX_DPR = 2;
export const CANVAS_MIN_DPR = 0.75;

export function canvasDpr(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  opts?: { maxPixels?: number; maxDpr?: number; minDpr?: number }
): number {
  const maxPixels = opts?.maxPixels ?? CANVAS_MAX_PIXELS;
  const maxDpr = opts?.maxDpr ?? CANVAS_MAX_DPR;
  const minDpr = opts?.minDpr ?? CANVAS_MIN_DPR;
  const area = Math.max(1, cssWidth * cssHeight);
  const dpr = Math.min(devicePixelRatio || 1, maxDpr, Math.sqrt(maxPixels / area));
  return Math.max(minDpr, dpr);
}
