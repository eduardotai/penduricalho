import type { GustState } from "./mapMechanics";
import type { RenderContext } from "./render";

/**
 * Wind streaks drifting across the cage in the gust direction. Drawn in world
 * space. Faint while calm so the map reads as "windy" before a gust lands.
 */
export function drawWindStreaks(
  rc: RenderContext,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  g: GustState
) {
  const { ctx, now } = rc;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const s = g.strength;
  const alpha = 0.05 + 0.3 * s;
  const len = 60 + 260 * s;
  const speed = 0.25 + 2.2 * s; // world units per ms
  ctx.save();
  ctx.strokeStyle = `rgba(200, 235, 255, ${alpha.toFixed(3)})`;
  ctx.lineCap = "round";
  ctx.lineWidth = 6;
  for (let i = 0; i < 70; i++) {
    // Stable pseudo-random lane per streak.
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 12345.6789;
    const fx = a - Math.floor(a);
    const fy = b - Math.floor(b);
    const travel = (now * speed * (0.7 + fx * 0.6)) % (w + len);
    const along = ((fx * (w + len) + travel) % (w + len)) - len;
    const x0 = g.dir.x >= 0 ? bounds.minX + along : bounds.maxX - along;
    const y0 = bounds.minY + fy * h + g.dir.y * along * 0.3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 - g.dir.x * len, y0 - g.dir.y * len);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Screen-space wind gauge at the top centre: an arrow in the gust direction
 * with a strength bar, and a countdown to the next gust while calm.
 */
export function drawWindIndicator(
  ctx: CanvasRenderingContext2D,
  screenWidth: number,
  g: GustState,
  labels: { gust: string; next: (seconds: number) => string; idle: string },
  idle = false
) {
  const cx = screenWidth / 2;
  const y = 18;
  const s = g.strength;
  ctx.save();
  ctx.textBaseline = "middle";
  const text = idle ? labels.idle : g.phase === "calm" ? labels.next(Math.ceil(g.nextInMs / 1000)) : labels.gust;
  const boxW = 150;
  ctx.fillStyle = `rgba(8, 20, 30, ${0.55 + 0.25 * s})`;
  ctx.strokeStyle = `rgba(160, 220, 255, ${0.35 + 0.55 * s})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, y - 12, boxW, 34, 9);
  ctx.fill();
  ctx.stroke();
  // Arrow.
  ctx.save();
  ctx.translate(cx - boxW / 2 + 22, y + 5);
  ctx.rotate(Math.atan2(g.dir.y, g.dir.x));
  ctx.strokeStyle = `rgba(200, 240, 255, ${0.45 + 0.55 * s})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(9, 0);
  ctx.moveTo(4, -5);
  ctx.lineTo(9, 0);
  ctx.lineTo(4, 5);
  ctx.stroke();
  ctx.restore();
  ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = `rgba(220, 245, 255, ${0.7 + 0.3 * s})`;
  ctx.fillText(text, cx - boxW / 2 + 40, y);
  // Strength bar.
  const bx = cx - boxW / 2 + 40;
  const bw = boxW - 52;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(bx, y + 11, bw, 4);
  ctx.fillStyle = "rgba(125, 211, 252, 0.95)";
  ctx.fillRect(bx, y + 11, bw * s, 4);
  ctx.restore();
}
