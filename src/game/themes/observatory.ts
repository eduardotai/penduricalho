import type { SiteDef, Vec2 } from "../../types";
import { withAlpha } from "../bobRenderUtils";
import { cachedLayer, seededRandom, vignette } from "./artUtils";
import type { BackdropCamera, RenderTheme, ZoneDrawArgs, ZoneTierColors } from "./types";

/**
 * "Observatory" theme: a midnight sky with a cached star field (gentle
 * twinkle on the brightest stars), nebula haze, a faint constellation and a
 * slowly turning star-chart ring; a silver armillary pivot; planets as hit
 * circles (terminator shadow, rings on the big tiers). Cosmetic only.
 */

const SKIES: Record<string, { top: string; bottom: string; nebula: [string, string] }> = {
  workshop: { top: "#0d1433", bottom: "#03050f", nebula: ["#5b4bd6", "#1f8fb8"] },
  "bumper-cage": { top: "#1d0f33", bottom: "#05030c", nebula: ["#b04bd6", "#d65b8f"] },
  "bumper-arena": { top: "#0a2430", bottom: "#02080c", nebula: ["#2fb8a5", "#4b7bd6"] },
  "bumper-colosseum": { top: "#251a0c", bottom: "#070402", nebula: ["#d6994b", "#b84b4b"] },
  layers: { top: "#0a1f2a", bottom: "#02070a", nebula: ["#4bd6c4", "#4b6bd6"] },
  "black-hole": { top: "#0b0716", bottom: "#010003", nebula: ["#7b4bd6", "#4b2b8a"] },
};

const starSlot = { key: "", canvas: null as HTMLCanvasElement | null };
const nebulaSlot = { key: "", canvas: null as HTMLCanvasElement | null };

interface TwinkleStar {
  fx: number;
  fy: number;
  r: number;
  phase: number;
}
const rndBright = seededRandom(4242);
const BRIGHT_STARS: TwinkleStar[] = Array.from({ length: 26 }, () => ({
  fx: rndBright(),
  fy: rndBright(),
  r: 0.8 + rndBright() * 1.4,
  phase: rndBright() * Math.PI * 2,
}));

// A loose "Pendulum" constellation (fractions of the screen).
const CONSTELLATION: [number, number][] = [
  [0.76, 0.12],
  [0.81, 0.19],
  [0.88, 0.17],
  [0.9, 0.27],
  [0.84, 0.33],
  [0.81, 0.19],
];

function drawObservatoryBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  site: SiteDef,
  cam?: BackdropCamera
) {
  const pal = SKIES[site.background] ?? SKIES.workshop;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, pal.top);
  grad.addColorStop(1, pal.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const px = cam ? cam.panX * cam.scale : 0;
  const py = cam ? cam.panY * cam.scale : 0;
  const t = (cam?.now ?? 0) / 1000;

  // Nebula haze (cached), drifts very slightly with the camera.
  const neb = cachedLayer(nebulaSlot, `neb:${site.background}`, width, height, (g, w, h) => {
    const rnd = seededRandom(77);
    for (let i = 0; i < 7; i++) {
      const cx = w * (0.1 + rnd() * 0.8);
      const cy = h * (0.1 + rnd() * 0.8);
      const r = Math.max(w, h) * (0.18 + rnd() * 0.25);
      const col = i % 2 === 0 ? pal.nebula[0] : pal.nebula[1];
      const ng = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      ng.addColorStop(0, withAlpha(col, 0.1));
      ng.addColorStop(1, withAlpha(col, 0));
      g.fillStyle = ng;
      g.fillRect(0, 0, w, h);
    }
  });
  ctx.drawImage(neb, px * 0.03, py * 0.03, width, height);

  // Dim star field (cached), slight parallax.
  const stars = cachedLayer(starSlot, "stars", width, height, (g, w, h) => {
    const rnd = seededRandom(1999);
    const n = Math.round((w * h) / 2600);
    for (let i = 0; i < n; i++) {
      const a = 0.15 + rnd() * 0.5;
      const r = rnd() < 0.9 ? 0.6 : 1.1;
      g.fillStyle = rnd() < 0.15 ? `rgba(255,226,190,${a})` : `rgba(210,225,255,${a})`;
      g.beginPath();
      g.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2);
      g.fill();
    }
  });
  ctx.drawImage(stars, px * 0.05, py * 0.05, width, height);

  // Bright twinkling stars with a soft cross glint.
  ctx.save();
  for (const s of BRIGHT_STARS) {
    const x = s.fx * width + px * 0.08;
    const y = s.fy * height + py * 0.08;
    const tw = 0.55 + 0.45 * Math.sin(t * 1.3 + s.phase);
    ctx.fillStyle = `rgba(235,242,255,${0.5 + tw * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(200,220,255,${0.12 * tw})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - s.r * 4, y);
    ctx.lineTo(x + s.r * 4, y);
    ctx.moveTo(x, y - s.r * 4);
    ctx.lineTo(x, y + s.r * 4);
    ctx.stroke();
  }

  // Constellation.
  ctx.strokeStyle = "rgba(170,195,255,0.16)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  CONSTELLATION.forEach(([fx, fy], i) => {
    const x = fx * width + px * 0.08;
    const y = fy * height + py * 0.08;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [fx, fy] of CONSTELLATION) {
    ctx.fillStyle = "rgba(225,235,255,0.75)";
    ctx.beginPath();
    ctx.arc(fx * width + px * 0.08, fy * height + py * 0.08, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Star-chart ring: a large, slowly turning graduated circle.
  const minSide = Math.min(width, height);
  const cx = width * 0.18 + px * 0.04;
  const cy = height * 0.85 + py * 0.04;
  const R = minSide * 0.7;
  const rot = t * 0.01;
  ctx.strokeStyle = "rgba(190,205,240,0.07)";
  ctx.lineWidth = 1.2;
  for (const k of [1, 0.82, 0.6]) {
    ctx.beginPath();
    ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const a = rot + (i / 72) * Math.PI * 2;
    const len = i % 6 === 0 ? 0.05 : 0.02;
    ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.lineTo(cx + Math.cos(a) * R * (1 - len), cy + Math.sin(a) * R * (1 - len));
  }
  ctx.stroke();
  ctx.restore();

  vignette(ctx, width, height, 0.55);
}

function silver(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#f4f7fb");
  g.addColorStop(0.4, "#a9b4c6");
  g.addColorStop(0.7, "#5d6a80");
  g.addColorStop(1, "#d5dce8");
  return g;
}

/** Silver armillary mount: crossbar, two tilted rings and a glowing star at the bearing. */
function drawArmillaryPivot(ctx: CanvasRenderingContext2D, anchor: Vec2, now: number) {
  const { x, y } = anchor;
  ctx.save();
  // Crossbar plate.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.roundRect(x - 74, y - 42, 152, 18, 9);
  ctx.fill();
  ctx.fillStyle = silver(ctx, x - 76, y - 48, x + 76, y - 30);
  ctx.beginPath();
  ctx.roundRect(x - 76, y - 48, 152, 18, 9);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,28,45,0.9)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (const bx of [x - 60, x + 60]) {
    ctx.fillStyle = "#e8eef8";
    ctx.beginPath();
    ctx.arc(bx, y - 39, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Stem.
  ctx.fillStyle = silver(ctx, x - 6, 0, x + 6, 0);
  ctx.fillRect(x - 5, y - 30, 10, 14);
  // Two rings, the inner one slowly precessing.
  const spin = now / 4000;
  ctx.lineWidth = 3;
  ctx.strokeStyle = silver(ctx, x - 24, y - 24, x + 24, y + 24);
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 24, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 9 + 6 * Math.abs(Math.sin(spin)), spin * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, 8 + 5 * Math.abs(Math.cos(spin)), 24, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Glowing star bearing.
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 16);
  glow.addColorStop(0, "rgba(220,235,255,0.95)");
  glow.addColorStop(0.3, "rgba(140,180,255,0.55)");
  glow.addColorStop(1, "rgba(140,180,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Gas-giant bands + night-side terminator, clipped to the disc at (x, y). */
function paintPlanetSurface(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tier: ZoneTierColors,
  flash: boolean
) {
  ctx.save();
  // Surface bands (gas-giant stripes), clipped to the disc.
  ctx.beginPath();
  ctx.arc(x, y, r * 0.98, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = withAlpha(tier.core, flash ? 0.25 : 0.14);
  ctx.lineWidth = Math.max(1, r * 0.09);
  for (const k of [-0.45, -0.1, 0.3]) {
    ctx.beginPath();
    ctx.ellipse(x, y + r * k, r * 1.1, r * 0.12, 0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Night-side terminator.
  const shade = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  shade.addColorStop(0.45, "rgba(2,4,16,0)");
  shade.addColorStop(1, `rgba(2,4,16,${flash ? 0.2 : 0.55})`);
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/**
 * The clipped planet surface is the most expensive thing this theme draws
 * (a clip per circle, every frame), but it only changes with tier, flash and
 * on-screen size. Paint it once per (tier, flash, device-pixel size) into a
 * small sprite and blit that instead. Bounded; cleared wholesale when full
 * (zoom changes add sizes).
 */
const surfaceSprites = new Map<string, HTMLCanvasElement>();
const SURFACE_SPRITE_MAX = 96;
const SURFACE_SPRITE_MAX_PX = 512;

function planetSurfaceSprite(
  ctx: CanvasRenderingContext2D,
  r: number,
  tier: ZoneTierColors,
  flash: boolean
): { canvas: HTMLCanvasElement; half: number } | null {
  if (typeof document === "undefined" || typeof ctx.getTransform !== "function") return null;
  const m = ctx.getTransform();
  const s = Math.hypot(m.a, m.b);
  if (!(s > 0) || !(r > 0)) return null;
  // 1 device px of padding on each side so the anti-aliased edge isn't cut.
  const n = Math.ceil(2 * r * s) + 2;
  if (n > SURFACE_SPRITE_MAX_PX) return null;
  const half = r + 1 / s;
  const key = `${tier.core}|${tier.fill}|${flash ? 1 : 0}|${n}`;
  let canvas = surfaceSprites.get(key);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    const g = canvas.getContext("2d");
    if (!g) return null;
    const k = n / (2 * half);
    g.setTransform(k, 0, 0, k, n / 2, n / 2);
    paintPlanetSurface(g, 0, 0, r, tier, flash);
    if (surfaceSprites.size >= SURFACE_SPRITE_MAX) surfaceSprites.clear();
    surfaceSprites.set(key, canvas);
  }
  return { canvas, half };
}

function planetDecor(ctx: CanvasRenderingContext2D, a: ZoneDrawArgs) {
  const { x, y, r, flash, tier, phase } = a;
  const sprite = planetSurfaceSprite(ctx, r, tier, flash);
  if (sprite) {
    ctx.drawImage(sprite.canvas, x - sprite.half, y - sprite.half, sprite.half * 2, sprite.half * 2);
  } else {
    paintPlanetSurface(ctx, x, y, r, tier, flash);
  }
  // Rings for the two highest tiers.
  if (tier === OBS_TIERS[3] || tier === OBS_TIERS[4]) {
    ctx.save();
    ctx.strokeStyle = withAlpha(tier.core, flash ? 0.9 : 0.55);
    ctx.lineWidth = Math.max(1.2, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.55, r * 0.42, -0.35 + Math.sin(phase) * 0.05, Math.PI * 0.05, Math.PI * 0.95, true);
    ctx.stroke();
    ctx.restore();
  }
}

const OBS_TIERS = [
  { fill: "#3a4a63", glow: "#9fb2cf", core: "#eef3fb" }, // moon grey
  { fill: "#0f5d6b", glow: "#4fc7c9", core: "#e2fbff" }, // ocean world
  { fill: "#253c9a", glow: "#6f8dff", core: "#e6ecff" }, // ice giant
  { fill: "#8a3b1c", glow: "#f08a55", core: "#fff0e6" }, // red planet
  { fill: "#8a6512", glow: "#f2c25c", core: "#fff7e0" }, // gas giant
] as const;

export const observatoryTheme: RenderTheme = {
  id: "observatory",
  drawBackdrop: drawObservatoryBackdrop,
  drawPivot: drawArmillaryPivot,
  zone: {
    tiers: OBS_TIERS,
    glow: "bloom",
    rim(ctx, { flash, tier }) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = flash ? "#ffffff" : withAlpha(tier.glow, 0.75);
    },
    crosshair: false,
    decorate: planetDecor,
  },
  additiveParticles: true,
  floatFont: { weight: "600", family: '"Cinzel Variable", Georgia, serif' },
};
