import type { SiteDef, Vec2 } from "../../types";
import { withAlpha } from "../bobRenderUtils";
import { cachedLayer, seededRandom, vignette } from "./artUtils";
import type { BackdropCamera, RenderTheme, ZoneDrawArgs } from "./types";

/**
 * "Greenhouse" theme: a Victorian glasshouse at dusk — arched iron mullions
 * over fogged glass, light shafts, swaying fern silhouettes and drifting
 * pollen; a copper hook with a vine for the pivot; dew-drop berries with a
 * leaf for hit circles. Cosmetic only.
 */

const GLASS: Record<string, { top: string; bottom: string; light: string; leaf: string }> = {
  workshop: { top: "#16302a", bottom: "#050d0b", light: "#f3e6b0", leaf: "#0b1f19" },
  "bumper-cage": { top: "#33201a", bottom: "#0d0706", light: "#f5c9a0", leaf: "#1f110c" },
  "bumper-arena": { top: "#123236", bottom: "#040d0f", light: "#c9f0e0", leaf: "#08201f" },
  "bumper-colosseum": { top: "#2e2a14", bottom: "#0b0a04", light: "#f7e7a0", leaf: "#1c1a0a" },
  layers: { top: "#14302f", bottom: "#040c0c", light: "#d0f0e0", leaf: "#0a1e1e" },
  "black-hole": { top: "#1a1630", bottom: "#05040c", light: "#d8ccf5", leaf: "#100c20" },
};

const frameSlot = { key: "", canvas: null as HTMLCanvasElement | null };

/** Iron glasshouse frame: arched bays + vertical/horizontal mullions. */
function paintFrame(g: CanvasRenderingContext2D, w: number, h: number) {
  const bays = Math.max(3, Math.round(w / 260));
  const bw = w / bays;
  g.strokeStyle = "rgba(8,16,13,0.55)";
  g.lineCap = "round";
  for (let i = 0; i < bays; i++) {
    const x0 = i * bw;
    const cx = x0 + bw / 2;
    // Column.
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(x0, h);
    g.lineTo(x0, h * 0.28);
    g.stroke();
    // Gothic arch.
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x0, h * 0.28);
    g.quadraticCurveTo(x0, h * 0.02, cx, -h * 0.02);
    g.quadraticCurveTo(x0 + bw, h * 0.02, x0 + bw, h * 0.28);
    g.stroke();
    // Panes.
    g.lineWidth = 2;
    for (const f of [0.25, 0.5, 0.75]) {
      g.beginPath();
      g.moveTo(x0 + bw * f, h);
      g.lineTo(x0 + bw * f, h * (0.12 + Math.abs(f - 0.5) * 0.3));
      g.stroke();
    }
    for (let yy = h * 0.4; yy < h; yy += h * 0.15) {
      g.beginPath();
      g.moveTo(x0, yy);
      g.lineTo(x0 + bw, yy);
      g.stroke();
    }
    // Rosette in the arch.
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, h * 0.15, bw * 0.08, 0, Math.PI * 2);
    g.stroke();
  }
}

interface Frond {
  fx: number;
  len: number;
  side: 1 | -1;
  phase: number;
  top: boolean;
}
const rndF = seededRandom(909);
const FRONDS: Frond[] = Array.from({ length: 9 }, (_, i) => ({
  fx: i < 5 ? rndF() * 0.3 : 0.7 + rndF() * 0.3,
  len: 0.25 + rndF() * 0.25,
  side: i < 5 ? 1 : -1,
  phase: rndF() * Math.PI * 2,
  top: rndF() < 0.45,
}));

function drawFrond(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.3, len * 0.1, len, len * 0.35);
  ctx.stroke();
  const leaves = 14;
  for (let i = 1; i < leaves; i++) {
    const f = i / leaves;
    const lx = len * f;
    const ly = len * 0.35 * f * f + len * 0.1 * f * (1 - f) * 2;
    const ll = len * 0.16 * (1 - f * 0.7);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(lx + ll * 0.3, ly + s * ll * 0.5, ll * 0.55, ll * 0.14, s * 0.9 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

const rndP = seededRandom(5150);
const POLLEN = Array.from({ length: 40 }, () => ({
  fx: rndP(),
  fy: rndP(),
  speed: 0.004 + rndP() * 0.01,
  r: 0.8 + rndP() * 1.6,
  phase: rndP() * Math.PI * 2,
}));

function drawGreenhouseBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  site: SiteDef,
  cam?: BackdropCamera
) {
  const pal = GLASS[site.background] ?? GLASS.workshop;
  const t = (cam?.now ?? 0) / 1000;
  const px = cam ? cam.panX * cam.scale : 0;
  const py = cam ? cam.panY * cam.scale : 0;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, pal.top);
  grad.addColorStop(1, pal.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Warm dusk light coming through the glass, upper left.
  const sun = ctx.createRadialGradient(width * 0.25, -height * 0.1, 0, width * 0.25, -height * 0.1, Math.max(width, height) * 0.9);
  sun.addColorStop(0, withAlpha(pal.light, 0.16));
  sun.addColorStop(1, withAlpha(pal.light, 0));
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);

  // Light shafts.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 4; i++) {
    const x0 = width * (0.08 + i * 0.17) + px * 0.03;
    const sway = Math.sin(t * 0.2 + i) * width * 0.01;
    const shaft = ctx.createLinearGradient(x0, 0, x0 + width * 0.25, height);
    shaft.addColorStop(0, withAlpha(pal.light, 0.06));
    shaft.addColorStop(1, withAlpha(pal.light, 0));
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + width * 0.06, 0);
    ctx.lineTo(x0 + width * 0.34 + sway, height);
    ctx.lineTo(x0 + width * 0.2 + sway, height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Iron frame (cached), slight parallax.
  const frame = cachedLayer(frameSlot, "frame", width * 1.1, height, paintFrame);
  ctx.drawImage(frame, -width * 0.05 + px * 0.04, py * 0.02, width * 1.1, height);

  // Swaying fern silhouettes from the edges.
  for (const f of FRONDS) {
    const sway = Math.sin(t * 0.6 + f.phase) * 0.06;
    const x = f.fx * width + px * 0.08;
    const y = f.top ? -height * 0.02 + py * 0.08 : height * 1.02 + py * 0.08;
    const len = Math.min(width, height) * f.len;
    const base = f.top ? Math.PI / 2 : -Math.PI / 2;
    const angle = base - f.side * (f.top ? -0.6 : 0.6) + sway;
    drawFrond(ctx, x, y, len, angle - (f.side < 0 ? (f.top ? 0.4 : -0.4) : 0), pal.leaf);
  }

  // Drifting pollen.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of POLLEN) {
    const x = (((p.fx + Math.sin(t * 0.3 + p.phase) * 0.02) % 1) + 1) % 1;
    const y = (((p.fy - t * p.speed) % 1) + 1) % 1;
    ctx.fillStyle = withAlpha(pal.light, 0.12 + 0.1 * Math.sin(t + p.phase));
    ctx.beginPath();
    ctx.arc(x * width + px * 0.1, y * height + py * 0.1, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  vignette(ctx, width, height, 0.55);
}

function copper(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#f2b48a");
  g.addColorStop(0.4, "#b8643a");
  g.addColorStop(0.7, "#7a3a1e");
  g.addColorStop(1, "#d98b5f");
  return g;
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, fill: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.45, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.45, 0, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(len * 0.1, 0);
  ctx.lineTo(len * 0.9, 0);
  ctx.stroke();
  ctx.restore();
}

/** Copper bar with a verdigris patina, a ring hook and a vine winding over it. */
function drawCopperHook(ctx: CanvasRenderingContext2D, anchor: Vec2, now: number) {
  const { x, y } = anchor;
  const sway = Math.sin(now / 1400) * 0.08;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.roundRect(x - 76, y - 44, 156, 20, 10);
  ctx.fill();
  ctx.fillStyle = copper(ctx, x - 78, y - 50, x + 78, y - 30);
  ctx.beginPath();
  ctx.roundRect(x - 78, y - 50, 156, 20, 10);
  ctx.fill();
  // Verdigris patina blotches.
  ctx.fillStyle = "rgba(90,190,160,0.35)";
  for (const [dx, r] of [
    [-52, 6],
    [-18, 4],
    [30, 7],
    [60, 4],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x + dx, y - 40, r * 1.6, r * 0.7, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(50,22,10,0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - 78, y - 50, 156, 20, 10);
  ctx.stroke();
  // Hook stem + ring.
  ctx.fillStyle = copper(ctx, x - 6, 0, x + 6, 0);
  ctx.fillRect(x - 5, y - 31, 10, 16);
  ctx.lineWidth = 5;
  ctx.strokeStyle = copper(ctx, x - 14, y - 14, x + 14, y + 14);
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.stroke();
  // Vine with leaves along the bar.
  ctx.strokeStyle = "#2f6b3a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 82, y - 34);
  for (let i = 0; i <= 16; i++) {
    const vx = x - 82 + i * 10.5;
    ctx.lineTo(vx, y - 40 + Math.sin(i * 1.2) * 8);
  }
  ctx.stroke();
  leaf(ctx, x - 64, y - 30, 16, 0.9 + sway, "#3f8f4a");
  leaf(ctx, x - 30, y - 52, 13, -1.2 + sway, "#4fa35a");
  leaf(ctx, x + 22, y - 30, 15, 1.1 - sway, "#3f8f4a");
  leaf(ctx, x + 58, y - 52, 13, -0.8 - sway, "#5bb366");
  leaf(ctx, x + 84, y - 32, 18, 0.5 + sway * 2, "#3f8f4a");
  ctx.restore();
}

function berryDecor(ctx: CanvasRenderingContext2D, a: ZoneDrawArgs) {
  const { x, y, r, flash, phase } = a;
  // Small leaf + stem at the top of each berry.
  ctx.save();
  ctx.strokeStyle = "#5a3a1a";
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.92);
  ctx.quadraticCurveTo(x + r * 0.05, y - r * 1.2, x + r * 0.18, y - r * 1.3);
  ctx.stroke();
  leaf(ctx, x + r * 0.1, y - r * 1.08, r * 0.7, -0.5 + Math.sin(phase) * 0.15, flash ? "#8fe09a" : "#3f9a4c");
  // Dew droplet.
  ctx.fillStyle = withAlpha("#ffffff", flash ? 0.9 : 0.55);
  ctx.beginPath();
  ctx.arc(x + r * 0.38, y + r * 0.3, Math.max(1, r * 0.09), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const greenhouseTheme: RenderTheme = {
  id: "greenhouse",
  drawBackdrop: drawGreenhouseBackdrop,
  drawPivot: drawCopperHook,
  zone: {
    // Garden berries: gooseberry → blueberry → plum → apricot → cherry.
    tiers: [
      { fill: "#4f7a1c", glow: "#a8d65a", core: "#f4ffe0" },
      { fill: "#26407a", glow: "#7f9de0", core: "#eef2ff" },
      { fill: "#5a1f5e", glow: "#c47fd0", core: "#fbeefd" },
      { fill: "#b5651a", glow: "#f5b25a", core: "#fff3e0" },
      { fill: "#8f1028", glow: "#f2546e", core: "#ffe6ea" },
    ],
    glow: "soft",
    rim(ctx, { flash, tier, r }) {
      ctx.lineWidth = Math.max(1.5, r * 0.07);
      ctx.strokeStyle = flash ? "#fffbe6" : withAlpha(tier.fill, 0.95);
    },
    crosshair: false,
    decorate: berryDecor,
  },
  additiveParticles: false,
  floatFont: { weight: "600", family: '"Fraunces Variable", Georgia, serif' },
};
