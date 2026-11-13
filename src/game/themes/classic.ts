import { withAlpha } from "../bobRenderUtils";
import type { RenderTheme } from "./types";

/** The original look: night-blue gradient + grid, grey pivot, candy orbs. */

const SITE_BACKGROUNDS: Record<string, [string, string]> = {
  workshop: ["#1e293b", "#0f172a"],
  "bumper-cage": ["#2a1233", "#120318"],
  "bumper-arena": ["#0f2a33", "#04161c"],
  "bumper-colosseum": ["#332512", "#1a1003"],
  layers: ["#0b2a2f", "#04141a"],
  "black-hole": ["#0a0a14", "#010103"],
  "moon-base": ["#1c1f2e", "#07080f"],
  "conveyor-yard": ["#2a2310", "#100c03"],
  "magnet-storm": ["#2a0f26", "#0d030c"],
};

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, gridStep: number) {
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

export const classicTheme: RenderTheme = {
  id: "classic",
  drawBackdrop(ctx, width, height, site) {
    const [top, bottom] = SITE_BACKGROUNDS[site.background] ?? SITE_BACKGROUNDS.workshop;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    drawGrid(ctx, width, height, 60);
  },
  drawPivot(ctx, anchor) {
    ctx.save();
    ctx.fillStyle = "#475569";
    ctx.fillRect(anchor.x - 60, anchor.y - 24, 120, 16);
    ctx.fillStyle = "#334155";
    ctx.fillRect(anchor.x - 50, anchor.y - 10, 100, 6);
    ctx.restore();
  },
  zone: {
    tiers: [
      { fill: "#34d399", glow: "#6ee7b7", core: "#ecfdf5" },
      { fill: "#38bdf8", glow: "#7dd3fc", core: "#f0f9ff" },
      { fill: "#a78bfa", glow: "#c4b5fd", core: "#f5f3ff" },
      { fill: "#fb923c", glow: "#fdba74", core: "#fff7ed" },
      { fill: "#f472b6", glow: "#f9a8d4", core: "#fdf2f8" },
    ],
    glow: "soft",
    rim(ctx, a) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = a.flash ? "#fef3c7" : withAlpha(a.tier.fill, 0.9);
    },
    crosshair: true,
  },
  additiveParticles: false,
  floatFont: { weight: "bold", family: '"Inter Variable", Inter, sans-serif' },
};
