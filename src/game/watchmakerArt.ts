import type { SiteDef, Vec2 } from "../types";

/**
 * Watchmaker-workshop art pass (visual experiment): warm wood backdrop with
 * parallax gear silhouettes and a vignette, plus a drawn brass pivot bracket.
 * Pure canvas drawing, no gameplay state.
 */

const BACKDROPS: Record<string, { top: string; bottom: string; grain: string; gear: string }> = {
  workshop: { top: "#3b2a1b", bottom: "#140d08", grain: "#e9c25a", gear: "#dcaa36" },
  "bumper-cage": { top: "#3a1914", bottom: "#130605", grain: "#f2b28f", gear: "#e08a5a" },
  "bumper-arena": { top: "#1d322d", bottom: "#08130f", grain: "#9fd6b8", gear: "#b8cf8f" },
  "bumper-colosseum": { top: "#3f2d16", bottom: "#170f06", grain: "#f2d98f", gear: "#e9c25a" },
  layers: { top: "#1a2b29", bottom: "#081110", grain: "#b9e0d4", gear: "#cdb46e" },
  "black-hole": { top: "#141019", bottom: "#030204", grain: "#b8a6d9", gear: "#9d86c9" },
};

export interface BackdropCamera {
  panX: number;
  panY: number;
  /** World → screen px factor (coverScale × zoom). */
  scale: number;
  now: number;
}

let grainCache: { key: string; canvas: HTMLCanvasElement } | null = null;

function grainLayer(width: number, height: number, color: string): HTMLCanvasElement {
  const key = `${width}x${height}:${color}`;
  if (grainCache?.key === key) return grainCache.canvas;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(width));
  c.height = Math.max(1, Math.ceil(height));
  const g = c.getContext("2d")!;
  // Deterministic pseudo-random so the grain doesn't shimmer between rebuilds.
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.strokeStyle = color;
  for (let y = 0; y < height; y += 5 + rnd() * 6) {
    g.globalAlpha = 0.018 + rnd() * 0.03;
    g.lineWidth = 0.6 + rnd() * 1.6;
    g.beginPath();
    const amp = 2 + rnd() * 6;
    const freq = 0.002 + rnd() * 0.004;
    const phase = rnd() * Math.PI * 2;
    for (let x = 0; x <= width; x += 16) {
      const yy = y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.3;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  grainCache = { key, canvas: c };
  return c;
}

/** Gear outline path: `teeth` trapezoid teeth around a ring. */
export function gearPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number, rot: number) {
  const inner = r * 0.84;
  const step = (Math.PI * 2) / teeth;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step;
    const pts: [number, number][] = [
      [a, inner],
      [a + step * 0.12, r],
      [a + step * 0.42, r],
      [a + step * 0.54, inner],
    ];
    for (const [ang, rad] of pts) {
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad;
      if (i === 0 && ang === a) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

const GEARS = [
  // fx, fy (fraction of screen), r (fraction of min side), teeth, spin dir, depth
  { fx: 0.12, fy: 0.22, r: 0.24, teeth: 22, dir: 1, depth: 0.08 },
  { fx: 0.31, fy: 0.05, r: 0.11, teeth: 12, dir: -1, depth: 0.08 },
  { fx: 0.88, fy: 0.78, r: 0.3, teeth: 28, dir: -1, depth: 0.05 },
  { fx: 0.7, fy: 0.98, r: 0.13, teeth: 14, dir: 1, depth: 0.05 },
  { fx: 0.95, fy: 0.12, r: 0.16, teeth: 16, dir: 1, depth: 0.12 },
  { fx: 0.04, fy: 0.9, r: 0.14, teeth: 15, dir: -1, depth: 0.12 },
];

/** Screen-space backdrop: wood gradient + grain, parallax gears, vignette. */
export function drawWatchmakerBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  site: SiteDef,
  cam?: BackdropCamera
) {
  const pal = BACKDROPS[site.background] ?? BACKDROPS.workshop;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, pal.top);
  grad.addColorStop(1, pal.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.drawImage(grainLayer(width, height, pal.grain), 0, 0, width, height);

  // Warm work-lamp pool above the mount.
  const lamp = ctx.createRadialGradient(width * 0.5, height * 0.38, 0, width * 0.5, height * 0.38, Math.max(width, height) * 0.6);
  lamp.addColorStop(0, "rgba(255, 214, 140, 0.10)");
  lamp.addColorStop(1, "rgba(255, 214, 140, 0)");
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, width, height);

  const minSide = Math.min(width, height);
  const t = (cam?.now ?? 0) / 1000;
  ctx.save();
  ctx.lineJoin = "round";
  for (const g of GEARS) {
    // Far gears drift a little with the camera pan, near ones a bit more.
    const px = (cam ? cam.panX * cam.scale : 0) * g.depth;
    const py = (cam ? cam.panY * cam.scale : 0) * g.depth;
    const x = g.fx * width + px;
    const y = g.fy * height + py;
    const r = g.r * minSide * 1.6;
    const rot = t * 0.05 * g.dir * (12 / g.teeth);
    gearPath(ctx, x, y, r, g.teeth, rot);
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    ctx.fill();
    ctx.strokeStyle = pal.gear;
    ctx.globalAlpha = 0.07;
    ctx.lineWidth = Math.max(1, r * 0.012);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.moveTo(x + r * 0.16, y);
    ctx.arc(x, y, r * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    // Spokes
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.16, y + Math.sin(a) * r * 0.16);
      ctx.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  const vig = ctx.createRadialGradient(width / 2, height / 2, minSide * 0.35, width / 2, height / 2, Math.hypot(width, height) * 0.62);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
}

function brassGradient(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#f6dc8c");
  g.addColorStop(0.35, "#c9952e");
  g.addColorStop(0.65, "#8a5e1c");
  g.addColorStop(1, "#d8b05a");
  return g;
}

/**
 * Brass bracket + gear hub at the rope pivot (world units). Stays inside the
 * mount clearance hitZones.ts keeps free of circles.
 */
export function drawBrassBracket(ctx: CanvasRenderingContext2D, anchor: Vec2, now: number) {
  const { x, y } = anchor;
  ctx.save();
  // Soft drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.roundRect(x - 78, y - 46, 160, 26, 8);
  ctx.fill();
  // Mounting plate
  ctx.fillStyle = brassGradient(ctx, x - 80, y - 52, x + 80, y - 26);
  ctx.beginPath();
  ctx.roundRect(x - 80, y - 52, 160, 26, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(60, 36, 8, 0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // Bolts with slots
  for (const bx of [x - 62, x + 62]) {
    ctx.fillStyle = "#6b4614";
    ctx.beginPath();
    ctx.arc(bx, y - 39, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e9c25a";
    ctx.beginPath();
    ctx.arc(bx - 1, y - 40, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a3a10";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx - 4, y - 40);
    ctx.lineTo(bx + 3, y - 40);
    ctx.stroke();
  }
  // Stem
  ctx.fillStyle = brassGradient(ctx, x - 8, 0, x + 8, 0);
  ctx.fillRect(x - 7, y - 28, 14, 22);
  // Hub gear (slowly ticking)
  const tick = Math.floor(now / 1000) * ((Math.PI * 2) / 12);
  gearPath(ctx, x, y, 22, 12, tick);
  ctx.fillStyle = brassGradient(ctx, x - 22, y - 22, x + 22, y + 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(60, 36, 8, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Ruby jewel bearing
  const jewel = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8);
  jewel.addColorStop(0, "#ffd1d6");
  jewel.addColorStop(0.4, "#e0314b");
  jewel.addColorStop(1, "#5c0a17");
  ctx.fillStyle = jewel;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
