import type { SiteDef, Vec2 } from "../../types";
import { withAlpha } from "../bobRenderUtils";
import { cachedLayer, deviceScale, drawStaticLayer, snapToDevice, vignette } from "./artUtils";
import type { BackdropCamera, RenderTheme } from "./types";

/**
 * "Neon Arcade" theme: a synthwave horizon (striped sun, scrolling
 * perspective grid, skyline silhouette, scanlines), a neon-tube pivot, and
 * hollow neon rings for hit circles with additive bloom. Cosmetic only.
 */

const SKIES: Record<string, { top: string; mid: string; grid: string; sun: [string, string] }> = {
  workshop: { top: "#12021f", mid: "#3a0a4a", grid: "#ff3fd1", sun: ["#ffe45c", "#ff3f8e"] },
  "bumper-cage": { top: "#1f0210", mid: "#4a0a26", grid: "#ff5a5a", sun: ["#ffd35c", "#ff3f5a"] },
  "bumper-arena": { top: "#021a1f", mid: "#0a3a4a", grid: "#3ff2ff", sun: ["#c8ff5c", "#3fffc0"] },
  "bumper-colosseum": { top: "#1f1202", mid: "#4a2a0a", grid: "#ffa23f", sun: ["#fff35c", "#ff8a3f"] },
  layers: { top: "#020f1f", mid: "#0a224a", grid: "#3fa2ff", sun: ["#5cf2ff", "#a23fff"] },
  "black-hole": { top: "#08020f", mid: "#1e0a3a", grid: "#a23fff", sun: ["#d65cff", "#5a3fff"] },
};

const scanSlot = { key: "", canvas: null as HTMLCanvasElement | null };
const skylineSlot = { key: "", canvas: null as HTMLCanvasElement | null };
const baseSlot = { key: "", canvas: null as HTMLCanvasElement | null };
const overlaySlot = { key: "", canvas: null as HTMLCanvasElement | null };

function drawNeonBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  site: SiteDef,
  cam?: BackdropCamera
) {
  const pal = SKIES[site.background] ?? SKIES.workshop;
  const horizon = height * 0.62;
  const t = (cam?.now ?? 0) / 1000;
  const px = cam ? cam.panX * cam.scale : 0;

  // Static base (sky, ground, striped sun, halo, skyline) flattened into one
  // layer; sun and skyline parallax are snapped to a device pixel so the base
  // only rebuilds when the camera moves.
  const ds = deviceScale(ctx);
  const sunDx = snapToDevice(px * 0.02, ds);
  const skyDx = snapToDevice(px * 0.03, ds);
  drawStaticLayer(ctx, baseSlot, `base:${site.background}:${sunDx}:${skyDx}`, width, height, (g, w, h) => {
    const hz = h * 0.62;
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, pal.top);
    sky.addColorStop(1, pal.mid);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, hz);
    g.fillStyle = "#07010d";
    g.fillRect(0, hz, w, h - hz);

    // Striped sun sitting on the horizon.
    const sunR = Math.min(w, h) * 0.22;
    const sx = w * 0.5 + sunDx;
    const sy = hz - sunR * 0.35;
    g.save();
    g.beginPath();
    g.arc(sx, sy, sunR, 0, Math.PI * 2);
    g.clip();
    const sun = g.createLinearGradient(0, sy - sunR, 0, sy + sunR);
    sun.addColorStop(0, pal.sun[0]);
    sun.addColorStop(1, pal.sun[1]);
    g.globalAlpha = 0.55;
    g.fillStyle = sun;
    g.fillRect(sx - sunR, sy - sunR, sunR * 2, sunR * 2);
    g.globalAlpha = 1;
    g.fillStyle = pal.mid;
    for (let i = 0; i < 7; i++) {
      const f = i / 7;
      const yy = sy + sunR * (0.05 + f * 0.95);
      g.fillRect(sx - sunR, yy, sunR * 2, 2 + f * sunR * 0.09);
    }
    g.restore();
    const halo = g.createRadialGradient(sx, sy, sunR * 0.8, sx, sy, sunR * 2.2);
    halo.addColorStop(0, withAlpha(pal.sun[1], 0.18));
    halo.addColorStop(1, withAlpha(pal.sun[1], 0));
    g.fillStyle = halo;
    g.fillRect(0, 0, w, hz);

    // Skyline silhouette (cached).
    const sk = cachedLayer(skylineSlot, `sky:${site.background}`, w, h * 0.2, (sg, sw, sh) => {
      let seed = 31;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      sg.fillStyle = "#0b0214";
      let x = 0;
      while (x < sw) {
        const bw = 18 + rnd() * 46;
        const bh = sh * (0.25 + rnd() * 0.75);
        sg.fillRect(x, sh - bh, bw, bh);
        sg.fillStyle = withAlpha(pal.grid, 0.35);
        for (let wy = sh - bh + 6; wy < sh - 4; wy += 9) {
          for (let wx = x + 4; wx < x + bw - 4; wx += 8) {
            if (rnd() < 0.22) sg.fillRect(wx, wy, 3, 3);
          }
        }
        sg.fillStyle = "#0b0214";
        x += bw + 2 + rnd() * 8;
      }
    });
    g.drawImage(sk, skyDx, hz - h * 0.2, w, h * 0.2);
  });

  // Perspective grid floor, scrolling toward the viewer.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, width, height - horizon);
  ctx.clip();
  ctx.strokeStyle = withAlpha(pal.grid, 0.45);
  ctx.lineWidth = 1.2;
  const vx = width * 0.5 + px * 0.06;
  for (let i = -14; i <= 14; i++) {
    ctx.beginPath();
    ctx.moveTo(vx + i * width * 0.012, horizon);
    ctx.lineTo(vx + i * width * 0.16, height);
    ctx.stroke();
  }
  const scroll = (t * 0.35) % 1;
  for (let i = 0; i < 12; i++) {
    const f = (i + scroll) / 12;
    const yy = horizon + (height - horizon) * f * f;
    ctx.globalAlpha = 0.25 + f * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(width, yy);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // Horizon glow line, scanlines and vignette, flattened into one layer.
  drawStaticLayer(ctx, overlaySlot, `over:${site.background}`, width, height, (g, w, h) => {
    g.fillStyle = withAlpha(pal.grid, 0.8);
    g.fillRect(0, h * 0.62 - 1, w, 2);
    const scan = cachedLayer(scanSlot, "scan", w, h, (sg, sw, sh) => {
      sg.fillStyle = "rgba(0,0,0,0.16)";
      for (let y = 0; y < sh; y += 3) sg.fillRect(0, y, sw, 1);
    });
    g.drawImage(scan, 0, 0, w, h);
    vignette(g, w, h, 0.5);
  });
}

/** Two glowing tubes (stroke drawn wide+faint, then thin+bright). */
function tube(ctx: CanvasRenderingContext2D, color: string, draw: () => void, w = 3) {
  ctx.strokeStyle = withAlpha(color, 0.22);
  ctx.lineWidth = w * 4;
  draw();
  ctx.stroke();
  ctx.strokeStyle = withAlpha(color, 0.9);
  ctx.lineWidth = w;
  draw();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1, w * 0.35);
  draw();
  ctx.stroke();
}

function drawNeonPivot(ctx: CanvasRenderingContext2D, anchor: Vec2, now: number) {
  const { x, y } = anchor;
  const flicker = 0.85 + 0.15 * Math.sin(now / 90) * Math.sin(now / 1300);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = "rgba(10,2,20,0.85)";
  ctx.beginPath();
  ctx.roundRect(x - 80, y - 52, 160, 26, 6);
  ctx.fill();
  ctx.globalAlpha = flicker;
  tube(ctx, "#ff3fd1", () => {
    ctx.beginPath();
    ctx.roundRect(x - 76, y - 48, 152, 18, 6);
  });
  tube(
    ctx,
    "#3ff2ff",
    () => {
      ctx.beginPath();
      ctx.moveTo(x, y - 30);
      ctx.lineTo(x, y - 12);
    },
    2.5
  );
  tube(ctx, "#3ff2ff", () => {
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const neonTheme: RenderTheme = {
  id: "neon",
  drawBackdrop: drawNeonBackdrop,
  drawPivot: drawNeonPivot,
  zone: {
    // Hollow-looking rings: very dark fill so the neon rim carries the color.
    tiers: [
      { fill: "#062a1c", glow: "#39ff9e", core: "#0b3d2a" },
      { fill: "#04223a", glow: "#3fd2ff", core: "#0a3352" },
      { fill: "#1c0838", glow: "#b06bff", core: "#2a0f52" },
      { fill: "#3a1c04", glow: "#ffb03f", core: "#52290a" },
      { fill: "#3a0422", glow: "#ff3fa6", core: "#520a33" },
    ],
    glow: "bloom",
    rim(ctx, { flash, tier, r }) {
      ctx.lineWidth = Math.max(2, r * 0.14);
      ctx.strokeStyle = flash ? "#ffffff" : tier.glow;
    },
    crosshair: false,
    decorate(ctx, { x, y, r, tier, flash, pulse }) {
      // Outer soft tube + inner thin ring.
      ctx.strokeStyle = withAlpha(tier.glow, flash ? 0.5 : 0.18 + pulse * 0.08);
      ctx.lineWidth = Math.max(4, r * 0.4);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(tier.glow, flash ? 0.9 : 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  additiveParticles: true,
  floatFont: { weight: "700", family: '"Orbitron Variable", "Inter Variable", sans-serif' },
};
