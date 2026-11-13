import { withAlpha } from "../bobRenderUtils";
import type { SiteDef } from "../../types";
import { cachedLayer, vignette } from "./artUtils";
import type { BackdropCamera, RenderTheme } from "./types";

/**
 * Base look, redesigned as "Bancada de Ensaio" (the test bench, see
 * docs/redesign.md): a drafting-sheet field in deep ink with a millimetre
 * grid, ruler ticks on the edges, corner registration marks and a slow,
 * faint phase-portrait trace (the pendulum's own Lissajous signature) that
 * breathes behind the arena. Static layers are cached; per frame we only
 * blit them and stroke one ~180-point path.
 */

const SITE_BACKGROUNDS: Record<string, [string, string]> = {
  workshop: ["#141c2b", "#070b14"],
  "bumper-cage": ["#1e1226", "#0a050f"],
  "bumper-arena": ["#0d1f26", "#030d11"],
  "bumper-colosseum": ["#231a10", "#0d0904"],
  layers: ["#0b1f22", "#030c0e"],
  "black-hole": ["#0a0a12", "#010103"],
  "moon-base": ["#14172a", "#05060c"],
  "conveyor-yard": ["#1f1a0e", "#0b0803"],
  "magnet-storm": ["#1f0d1c", "#09030a"],
};

const MINOR = 12;
const MAJOR = 96;
const gridSlot = { key: "", canvas: null as HTMLCanvasElement | null };
const frameSlot = { key: "", canvas: null as HTMLCanvasElement | null };

/** One tile (MAJOR×MAJOR) of the millimetre grid, repeated with parallax. */
function gridTile(): HTMLCanvasElement {
  return cachedLayer(gridSlot, "grid", MAJOR, MAJOR, (g, w, h) => {
    g.strokeStyle = "rgba(148,163,184,0.055)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = MINOR; x < w; x += MINOR) {
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, h);
    }
    for (let y = MINOR; y < h; y += MINOR) {
      g.moveTo(0, y + 0.5);
      g.lineTo(w, y + 0.5);
    }
    g.stroke();
    g.strokeStyle = "rgba(148,163,184,0.12)";
    g.beginPath();
    g.moveTo(0.5, 0);
    g.lineTo(0.5, h);
    g.moveTo(0, 0.5);
    g.lineTo(w, 0.5);
    g.stroke();
    // A tiny cross at every major intersection.
    g.strokeStyle = "rgba(251,146,60,0.28)";
    g.beginPath();
    g.moveTo(0, 0.5);
    g.lineTo(4, 0.5);
    g.moveTo(0.5, 0);
    g.lineTo(0.5, 4);
    g.stroke();
  });
}

/** Screen-fixed frame: vignette, edge rulers, registration marks. */
function frameLayer(width: number, height: number): HTMLCanvasElement {
  return cachedLayer(frameSlot, "frame", width, height, (g, w, h) => {
    vignette(g, w, h, 0.62);
    g.fillStyle = "rgba(148,163,184,0.22)";
    for (let x = 0; x < w; x += MINOR) {
      const long = x % MAJOR === 0;
      g.fillRect(x, 0, 1, long ? 9 : 4);
      g.fillRect(x, h - (long ? 9 : 4), 1, long ? 9 : 4);
    }
    for (let y = 0; y < h; y += MINOR) {
      const long = y % MAJOR === 0;
      g.fillRect(0, y, long ? 9 : 4, 1);
      g.fillRect(w - (long ? 9 : 4), y, long ? 9 : 4, 1);
    }
    g.font = '600 8px "JetBrains Mono Variable", ui-monospace, monospace';
    g.fillStyle = "rgba(148,163,184,0.32)";
    g.textBaseline = "top";
    for (let x = MAJOR; x < w - 30; x += MAJOR) g.fillText(String(x / MINOR), x + 3, 11);
    g.textBaseline = "alphabetic";
    for (let y = MAJOR; y < h - 20; y += MAJOR) g.fillText(String(y / MINOR), 12, y - 3);
    // Registration marks.
    g.strokeStyle = "rgba(251,146,60,0.35)";
    g.lineWidth = 1;
    const m = 26;
    for (const [cx, cy] of [
      [m, m],
      [w - m, m],
      [m, h - m],
      [w - m, h - m],
    ]) {
      g.beginPath();
      g.arc(cx, cy, 6, 0, Math.PI * 2);
      g.moveTo(cx - 11, cy);
      g.lineTo(cx + 11, cy);
      g.moveTo(cx, cy - 11);
      g.lineTo(cx, cy + 11);
      g.stroke();
    }
  });
}

/** Faint, slowly drifting phase portrait (θ vs ω of a damped pendulum). */
function drawPhaseTrace(ctx: CanvasRenderingContext2D, width: number, height: number, now: number) {
  const t = now / 1000;
  const cx = width * 0.5;
  const cy = height * 0.52;
  const R = Math.min(width, height) * 0.36;
  const drift = t * 0.05;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let layer = 0; layer < 2; layer++) {
    const ratio = layer === 0 ? 2 : 3;
    const phase = drift * (layer === 0 ? 1 : -0.7) + layer * 1.3;
    ctx.beginPath();
    const N = 90;
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * Math.PI * 2;
      const decay = 0.82 + 0.18 * Math.cos(u * 0.5 + phase);
      const x = cx + Math.sin(u + phase) * R * decay * 1.25;
      const y = cy + Math.sin(u * ratio + phase * 0.6) * R * 0.62 * decay;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = layer === 0 ? "rgba(251,146,60,0.07)" : "rgba(56,189,248,0.05)";
    ctx.lineWidth = layer === 0 ? 1.5 : 1;
    ctx.stroke();
  }
  // A small "write head" dot travelling along the first trace.
  const u = (t * 0.35) % (Math.PI * 2);
  const decay = 0.82 + 0.18 * Math.cos(u * 0.5 + drift);
  const hx = cx + Math.sin(u + drift) * R * decay * 1.25;
  const hy = cy + Math.sin(u * 2 + drift * 0.6) * R * 0.62 * decay;
  const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14);
  glow.addColorStop(0, "rgba(251,146,60,0.35)");
  glow.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(hx - 14, hy - 14, 28, 28);
  ctx.restore();
}

function drawBenchBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  site: SiteDef,
  cam?: BackdropCamera
) {
  const [top, bottom] = SITE_BACKGROUNDS[site.background] ?? SITE_BACKGROUNDS.workshop;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Warm lamp pool from the top, like a bench lamp over the arena.
  const lamp = ctx.createRadialGradient(width * 0.5, -height * 0.1, 0, width * 0.5, -height * 0.1, height * 0.95);
  lamp.addColorStop(0, "rgba(251,146,60,0.10)");
  lamp.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, width, height);

  // Parallax grid (moves at 35% of the camera pan).
  const tile = gridTile();
  const ox = cam ? -((cam.panX * cam.scale * 0.35) % MAJOR) : 0;
  const oy = cam ? -((cam.panY * cam.scale * 0.35) % MAJOR) : 0;
  for (let x = ox - MAJOR; x < width; x += MAJOR) {
    for (let y = oy - MAJOR; y < height; y += MAJOR) ctx.drawImage(tile, x, y);
  }

  drawPhaseTrace(ctx, width, height, cam?.now ?? 0);
  ctx.drawImage(frameLayer(width, height), 0, 0, width, height);
}

export const classicTheme: RenderTheme = {
  id: "classic",
  drawBackdrop: drawBenchBackdrop,
  drawPivot(ctx, anchor) {
    // Machined clamp: a dark steel bar with two hex bolts and an orange
    // index mark at the pivot, matching the UI faceplates.
    ctx.save();
    const bar = ctx.createLinearGradient(0, anchor.y - 26, 0, anchor.y - 6);
    bar.addColorStop(0, "#64748b");
    bar.addColorStop(0.5, "#334155");
    bar.addColorStop(1, "#1e293b");
    ctx.fillStyle = bar;
    ctx.beginPath();
    ctx.roundRect(anchor.x - 64, anchor.y - 26, 128, 18, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(anchor.x - 60, anchor.y - 24, 120, 1.5);
    for (const bx of [anchor.x - 48, anchor.x + 48]) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = bx + Math.cos(a) * 5;
        const py = anchor.y - 17 + Math.sin(a) * 5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = "#94a3b8";
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(anchor.x - 14, anchor.y - 8, 28, 9);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(anchor.x - 1.5, anchor.y - 25, 3, 10);
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
  floatFont: { weight: "800", family: '"Archivo Variable", "Inter Variable", sans-serif' },
};
