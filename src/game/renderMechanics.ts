import type { Bumper, GustState } from "./mapMechanics";
import type { WallField } from "./engine";
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

/**
 * Orbiting bumpers: a faint orbit track plus pinball-style studs that flash
 * when they bat the bob. World space. Deliberately NOT a zone colour: every
 * theme's scoring circles are green/blue/purple/orange/pink discs, so bumpers
 * are chrome rings with a dark rim, a red cap and a spinning white stripe —
 * a different shape and palette on every backdrop.
 */
export function drawBumpers(
  rc: RenderContext,
  center: { x: number; y: number },
  orbitRadius: number,
  bumpers: Bumper[],
  radius: number,
  flashUntil: number[]
) {
  const { ctx, now } = rc;
  ctx.save();
  ctx.setLineDash([18, 26]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(226, 232, 240, 0.2)";
  ctx.beginPath();
  ctx.arc(center.x, center.y, orbitRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  bumpers.forEach((b, i) => {
    const flash = Math.max(0, Math.min(1, (flashUntil[i] - now) / 220));
    const r = radius * (1 + 0.18 * flash);
    if (flash > 0) {
      const glow = ctx.createRadialGradient(b.x, b.y, r * 0.6, b.x, b.y, r * 1.8);
      glow.addColorStop(0, `rgba(255, 255, 255, ${0.7 * flash})`);
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Chrome body.
    const chrome = ctx.createLinearGradient(b.x - r, b.y - r, b.x + r, b.y + r);
    chrome.addColorStop(0, "#f8fafc");
    chrome.addColorStop(0.5, "#94a3b8");
    chrome.addColorStop(1, "#e2e8f0");
    ctx.fillStyle = chrome;
    ctx.strokeStyle = "#0b1220";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Spinning stripe ring.
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(now * 0.004 + i);
    ctx.setLineDash([r * 0.5, r * 0.32]);
    ctx.lineWidth = r * 0.16;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Red cap.
    ctx.fillStyle = flash > 0 ? "#fecaca" : "#dc2626";
    ctx.strokeStyle = "#450a0a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

/** Small screen-space pill at the top centre naming the map's mechanic. */
export function drawMapHint(ctx: CanvasRenderingContext2D, screenWidth: number, text: string, pulse = 0) {
  const cx = screenWidth / 2;
  const y = 18;
  ctx.save();
  ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
  const boxW = Math.ceil(ctx.measureText(text).width) + 40;
  ctx.fillStyle = `rgba(11, 18, 32, ${0.6 + 0.25 * pulse})`;
  ctx.strokeStyle = `rgba(226, 232, 240, ${0.4 + 0.5 * pulse})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, y - 12, boxW, 26, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(cx - boxW / 2 + 15, y + 1, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(241, 245, 249, 0.95)";
  ctx.fillText(text, cx - boxW / 2 + 27, y + 1);
  ctx.restore();
}

const SPRING_SQUASH_MS = 260;

/**
 * Coil springs along the inner edge of every standing cage wall. A side that
 * was just slammed squashes toward the wall and springs back. World space.
 */
export function drawSpringWalls(
  rc: RenderContext,
  field: WallField,
  hitAt: Partial<Record<string, number>>
) {
  const { ctx, now } = rc;
  const { minX, minY, maxX, maxY } = field.bounds;
  const depth = 46;
  const pitch = 70;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const wall of field.walls) {
    if (wall.broken || wall.side === "ring") continue;
    const since = now - (hitAt[wall.side] ?? -1e9);
    const u = Math.max(0, 1 - since / SPRING_SQUASH_MS);
    // Squash, then a little overshoot as it springs back.
    const squash = u > 0 ? Math.sin(u * Math.PI) * 0.55 - (1 - u) * u * 0.25 : 0;
    const d = depth * (1 - squash);
    const horizontal = wall.side === "top" || wall.side === "bottom";
    const len = horizontal ? maxX - minX : maxY - minY;
    const n = Math.max(2, Math.floor(len / pitch));
    // Edge line + inward offset for this side.
    const edge = (t: number, off: number) => {
      if (wall.side === "top") return { x: minX + t, y: minY + off };
      if (wall.side === "bottom") return { x: minX + t, y: maxY - off };
      if (wall.side === "left") return { x: minX + off, y: minY + t };
      return { x: maxX - off, y: minY + t };
    };
    ctx.strokeStyle = u > 0 ? "rgba(253, 230, 138, 0.95)" : "rgba(148, 163, 184, 0.75)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const t = (i / (n * 2)) * len;
      const p = edge(t, i % 2 === 0 ? 4 : d);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    // Bumper plate the bob actually bounces off.
    ctx.strokeStyle = u > 0 ? "#fde68a" : "#cbd5e1";
    ctx.lineWidth = 6;
    ctx.beginPath();
    const a = edge(0, d);
    const b = edge(len, d);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Generic screen-space map gauge at the top centre (same pill as the wind
 * gauge): an icon, a label and a 0…1 bar in the map's accent colour.
 */
export function drawMapGauge(
  ctx: CanvasRenderingContext2D,
  screenWidth: number,
  text: string,
  frac: number,
  color: string,
  icon: string
) {
  const cx = screenWidth / 2;
  const y = 18;
  const f = Math.max(0, Math.min(1, frac));
  ctx.save();
  ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
  const boxW = Math.max(150, Math.ceil(ctx.measureText(text).width) + 56);
  ctx.fillStyle = "rgba(8, 14, 28, 0.72)";
  ctx.strokeStyle = color.replace(/[\d.]+\)$/, "0.6)");
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, y - 12, boxW, 34, 9);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = "700 14px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = color;
  ctx.fillText(icon, cx - boxW / 2 + 20, y + 5);
  ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(241, 245, 249, 0.95)";
  ctx.fillText(text, cx - boxW / 2 + 38, y);
  const bx = cx - boxW / 2 + 38;
  const bw = boxW - 50;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(bx, y + 11, bw, 4);
  ctx.fillStyle = color;
  ctx.fillRect(bx, y + 11, bw * f, 4);
  ctx.restore();
}

/**
 * Conveyor Yard: rows of faint chevrons that scroll with the belt, so the
 * floor visibly moves (and shows its direction) even between pops. World space.
 */
export function drawConveyorChevrons(
  rc: RenderContext,
  bounds: { x: number; y: number; w: number; h: number },
  offset: number,
  dir: number
) {
  const { ctx } = rc;
  const pitch = 240;
  const rowGap = 320;
  const size = 34;
  const shift = ((offset % pitch) + pitch) % pitch;
  ctx.save();
  ctx.strokeStyle = "rgba(251, 191, 36, 0.13)";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let y = bounds.y + rowGap / 2; y < bounds.y + bounds.h; y += rowGap) {
    ctx.fillStyle = "rgba(251, 191, 36, 0.04)";
    ctx.fillRect(bounds.x, y - size * 1.6, bounds.w, size * 3.2);
    for (let x = bounds.x - pitch + shift; x < bounds.x + bounds.w + pitch; x += pitch) {
      ctx.beginPath();
      ctx.moveTo(x - dir * size, y - size);
      ctx.lineTo(x, y);
      ctx.lineTo(x - dir * size, y + size);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Magnet Storm: a pink field ring around the bob while a pulse is pulling. World space. */
export function drawMagnetPulse(rc: RenderContext, at: { x: number; y: number }, radius: number, strength: number) {
  const { ctx, now } = rc;
  const s = Math.max(0, Math.min(1, strength));
  ctx.save();
  const glow = ctx.createRadialGradient(at.x, at.y, radius * 0.2, at.x, at.y, radius);
  glow.addColorStop(0, `rgba(244, 114, 182, ${0.1 * s})`);
  glow.addColorStop(1, "rgba(244, 114, 182, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fill();
  // Inward-travelling rings read as "pulling".
  ctx.lineWidth = 8;
  for (let i = 0; i < 3; i++) {
    const u = 1 - (((now / 700) + i / 3) % 1);
    ctx.strokeStyle = `rgba(244, 114, 182, ${0.45 * s * (1 - u * 0.6)})`;
    ctx.beginPath();
    ctx.arc(at.x, at.y, radius * u, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
