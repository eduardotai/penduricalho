import type { BobSkinDef } from "../types";
import { withAlpha, shadeColor } from "./bobRenderUtils";

export function drawBobSkinArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  switch (skin.id) {
    case "classic-oak":
      drawOakWood(ctx, x, y, r, skin);
      break;
    case "sunset-ember":
      drawEmberCore(ctx, x, y, r, skin);
      break;
    case "ocean-pearl":
      drawOceanPearl(ctx, x, y, r, skin);
      break;
    case "cherry-blossom":
      drawCherryBlossom(ctx, x, y, r, skin);
      break;
    case "neon-pulse":
      drawNeonPulse(ctx, x, y, r, skin);
      break;
    case "frost-crystal":
      drawFrostCrystal(ctx, x, y, r, skin);
      break;
    case "golden-comet":
      drawGoldenComet(ctx, x, y, r, skin);
      break;
    case "cosmic-void":
      drawCosmicVoid(ctx, x, y, r, skin);
      break;
    case "fireball":
      drawFireball(ctx, x, y, r, skin);
      break;
    case "dark-matter":
      drawDarkMatter(ctx, x, y, r, skin);
      break;
    case "plasma-storm":
      drawPlasmaStorm(ctx, x, y, r, skin);
      break;
    case "toxic-slime":
      drawToxicSlime(ctx, x, y, r, skin);
      break;
    case "lava-rock":
      drawLavaRock(ctx, x, y, r, skin);
      break;
    case "aurora-wave":
      drawAuroraWave(ctx, x, y, r, skin);
      break;
    case "rainbow-prism":
      drawRainbowPrism(ctx, x, y, r, skin);
      break;
    case "glitch-core":
      drawGlitchCore(ctx, x, y, r, skin);
      break;
    case "blood-moon":
      drawBloodMoon(ctx, x, y, r, skin);
      break;
    case "ghost-wisp":
      drawGhostWisp(ctx, x, y, r, skin);
      break;
    case "black-hole":
      drawBlackHole(ctx, x, y, r, skin);
      break;
    case "radioactive":
      drawRadioactive(ctx, x, y, r, skin);
      break;
    case "candy-swirl":
      drawCandySwirl(ctx, x, y, r, skin);
      break;
    case "thunder-core":
      drawThunderCore(ctx, x, y, r, skin);
      break;
    case "matrix-code":
      drawMatrixCode(ctx, x, y, r, skin);
      break;
    case "diamond-dust":
      drawDiamondDust(ctx, x, y, r, skin);
      break;
    case "solar-flare":
      drawSolarFlare(ctx, x, y, r, skin);
      break;
    case "void-leech":
      drawVoidLeech(ctx, x, y, r, skin);
      break;
    case "holo-shimmer":
      drawHoloShimmer(ctx, x, y, r, skin);
      break;
    default:
      drawBobPatternFallback(ctx, x, y, r, skin);
      break;
  }
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  ctx.strokeStyle = withAlpha(color, 0.95);
  ctx.lineWidth = Math.max(0.6, size * 0.22);
  ctx.beginPath();
  ctx.moveTo(cx - size, cy);
  ctx.lineTo(cx + size, cy);
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx, cy + size);
  ctx.stroke();
  ctx.fillStyle = withAlpha(color, 0.85);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function traceStarPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number,
  points: number
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? outerR : innerR;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawFlower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  petalFill: string,
  centerFill: string
) {
  ctx.fillStyle = petalFill;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(a) * size * 0.55;
    const py = cy + Math.sin(a) * size * 0.55;
    ctx.beginPath();
    ctx.ellipse(px, py, size * 0.38, size * 0.22, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = centerFill;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawBobPatternFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  switch (skin.pattern) {
    case "striped":
      ctx.strokeStyle = withAlpha(skin.highlight, 0.55);
      ctx.lineWidth = Math.max(1.2, r * 0.12);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x - r, y + i * r * 0.28);
        ctx.lineTo(x + r, y + i * r * 0.28);
        ctx.stroke();
      }
      break;
    case "band":
      ctx.fillStyle = withAlpha(skin.highlight, 0.45);
      ctx.fillRect(x - r, y - r * 0.18, r * 2, r * 0.36);
      break;
    case "starfield":
      ctx.fillStyle = withAlpha(skin.highlight, 0.85);
      for (let i = 0; i < 7; i++) {
        const a = i * 1.7 + r * 0.1;
        const dist = (0.25 + (i % 3) * 0.22) * r;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist, 0.8 + (i % 2) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "crystal":
      ctx.strokeStyle = withAlpha(skin.highlight, 0.5);
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
        ctx.stroke();
      }
      break;
    case "solid":
      break;
  }
}

// ── Classic skins (from render.ts) ──────────────────────────────────────────

function drawOakWood(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  ctx.strokeStyle = withAlpha(skin.stroke, 0.35);
  ctx.lineWidth = Math.max(0.8, r * 0.045);
  for (let i = -3; i <= 3; i++) {
    const wave = i * r * 0.16;
    ctx.beginPath();
    for (let t = -r; t <= r; t += r * 0.08) {
      const px = x + t;
      const py = y + wave + Math.sin(t * 0.22 + i) * r * 0.05;
      if (t === -r) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  const knotX = x + r * 0.22;
  const knotY = y + r * 0.12;
  ctx.fillStyle = withAlpha(skin.stroke, 0.45);
  ctx.beginPath();
  ctx.ellipse(knotX, knotY, r * 0.14, r * 0.1, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha("#451a03", 0.5);
  ctx.lineWidth = r * 0.03;
  ctx.beginPath();
  ctx.ellipse(knotX, knotY, r * 0.08, r * 0.05, 0.4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.25);
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.arc(x - r * 0.15, y - r * 0.25, r * 0.55, 1.1, 2.1);
  ctx.stroke();
}

function drawEmberCore(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const core = ctx.createRadialGradient(x, y, 0, x, y, r * 0.7);
  core.addColorStop(0, "#fff7ed");
  core.addColorStop(0.25, "#fdba74");
  core.addColorStop(0.55, skin.color);
  core.addColorStop(1, withAlpha(skin.stroke, 0.2));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha("#fef3c7", 0.55);
  ctx.lineWidth = Math.max(1, r * 0.05);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15);
    ctx.lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
    ctx.stroke();
  }

  const bandGrad = ctx.createLinearGradient(x - r, y, x + r, y);
  bandGrad.addColorStop(0, withAlpha(skin.stroke, 0));
  bandGrad.addColorStop(0.35, withAlpha(skin.highlight, 0.75));
  bandGrad.addColorStop(0.65, withAlpha("#fef08a", 0.85));
  bandGrad.addColorStop(1, withAlpha(skin.stroke, 0));
  ctx.fillStyle = bandGrad;
  ctx.fillRect(x - r, y - r * 0.14, r * 2, r * 0.28);

  ctx.fillStyle = withAlpha("#fef08a", 0.9);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + 0.5;
    const dist = r * (0.78 + (i % 2) * 0.08);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist, r * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOceanPearl(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  for (let i = 0; i < 4; i++) {
    const rippleR = r * (0.35 + i * 0.18);
    ctx.strokeStyle = withAlpha(skin.highlight, 0.35 - i * 0.06);
    ctx.lineWidth = Math.max(0.6, r * 0.035);
    ctx.beginPath();
    ctx.arc(x + r * 0.08, y + r * 0.05, rippleR, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }

  ctx.strokeStyle = withAlpha("#ffffff", 0.35);
  ctx.lineWidth = r * 0.025;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.75, y + i * r * 0.22);
    ctx.lineTo(x + r * 0.75, y + i * r * 0.22 + r * 0.08);
    ctx.stroke();
  }

  const spots = [
    [0.35, -0.25, 0.12],
    [-0.2, 0.3, 0.08],
    [0.05, 0.45, 0.06],
  ] as const;
  for (const [ox, oy, sr] of spots) {
    const spot = ctx.createRadialGradient(
      x + ox * r,
      y + oy * r,
      0,
      x + ox * r,
      y + oy * r,
      r * sr
    );
    spot.addColorStop(0, withAlpha("#ffffff", 0.85));
    spot.addColorStop(0.5, withAlpha(skin.highlight, 0.45));
    spot.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(x + ox * r, y + oy * r, r * sr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = withAlpha(skin.highlight, 0.45);
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI) / 2.5 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75);
    ctx.stroke();
  }
}

function drawCherryBlossom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const flowers: [number, number, number][] = [
    [0, 0, 0.38],
    [-0.32, -0.18, 0.16],
    [0.28, 0.24, 0.14],
    [-0.15, 0.35, 0.12],
  ];
  for (const [ox, oy, scale] of flowers) {
    drawFlower(
      ctx,
      x + ox * r,
      y + oy * r,
      r * scale,
      withAlpha(skin.highlight, 0.9),
      withAlpha(skin.color, 0.55)
    );
  }

  ctx.fillStyle = withAlpha(skin.highlight, 0.75);
  for (let i = 0; i < 10; i++) {
    const a = i * 1.35;
    const dist = r * (0.55 + (i % 3) * 0.12);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist, r * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNeonPulse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.translate(-x, -y);

  for (let i = -3; i <= 3; i++) {
    const stripeY = y + i * r * 0.22;
    const glow = ctx.createLinearGradient(x - r, stripeY, x + r, stripeY);
    glow.addColorStop(0, withAlpha(skin.stroke, 0));
    glow.addColorStop(0.5, i % 2 === 0 ? withAlpha(skin.highlight, 0.85) : withAlpha("#f0abfc", 0.7));
    glow.addColorStop(1, withAlpha(skin.stroke, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, stripeY - r * 0.07, r * 2, r * 0.14);
  }
  ctx.restore();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.25);
  ctx.lineWidth = r * 0.025;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - r, y + i * r * 0.11);
    ctx.lineTo(x + r, y + i * r * 0.11);
    ctx.stroke();
  }

  ctx.strokeStyle = withAlpha(skin.highlight, 0.9);
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y - r * 0.55);
  ctx.lineTo(x + r * 0.55, y + r * 0.55);
  ctx.stroke();
  ctx.strokeStyle = withAlpha("#f0abfc", 0.85);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.55, y - r * 0.55);
  ctx.lineTo(x - r * 0.55, y + r * 0.55);
  ctx.stroke();

  ctx.fillStyle = withAlpha(skin.highlight, 0.95);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawFrostCrystal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const hexPoints = 6;
  ctx.strokeStyle = withAlpha(skin.highlight, 0.55);
  ctx.lineWidth = Math.max(0.8, r * 0.035);
  for (let ring = 0; ring < 2; ring++) {
    const hr = r * (0.45 + ring * 0.35);
    ctx.beginPath();
    for (let i = 0; i <= hexPoints; i++) {
      const a = (i / hexPoints) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * hr;
      const py = y + Math.sin(a) * hr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88);
    ctx.stroke();
  }

  ctx.strokeStyle = withAlpha("#ffffff", 0.4);
  ctx.lineWidth = r * 0.025;
  for (let i = 0; i < 4; i++) {
    const a = i * 0.9 + 0.3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
    ctx.lineTo(x + Math.cos(a) * r * 0.65, y + Math.sin(a) * r * 0.65);
    ctx.stroke();
  }

  const sparkles = [
    [0.55, -0.35],
    [-0.45, 0.2],
    [0.1, 0.5],
    [-0.2, -0.45],
  ] as const;
  for (const [sx, sy] of sparkles) {
    drawSparkle(ctx, x + sx * r, y + sy * r, r * 0.09, "#ffffff");
  }
}

function drawGoldenComet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const metal = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  metal.addColorStop(0, "#fef9c3");
  metal.addColorStop(0.35, skin.highlight);
  metal.addColorStop(0.55, skin.color);
  metal.addColorStop(0.8, "#92400e");
  metal.addColorStop(1, skin.stroke);
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha("#78350f", 0.35);
  ctx.lineWidth = r * 0.03;
  traceStarPath(ctx, x, y, r * 0.42, r * 0.2, 5);
  ctx.stroke();

  const tail = ctx.createLinearGradient(x - r, y - r * 0.2, x + r, y + r * 0.2);
  tail.addColorStop(0, withAlpha(skin.stroke, 0));
  tail.addColorStop(0.4, withAlpha(skin.highlight, 0.55));
  tail.addColorStop(0.7, withAlpha("#fef08a", 0.9));
  tail.addColorStop(1, withAlpha("#ffffff", 0.75));
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.95, y - r * 0.08);
  ctx.lineTo(x + r * 0.35, y - r * 0.08);
  ctx.lineTo(x + r * 0.95, y + r * 0.08);
  ctx.lineTo(x + r * 0.35, y + r * 0.08);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = withAlpha("#fef08a", 0.5);
  ctx.lineWidth = r * 0.025;
  ctx.beginPath();
  ctx.arc(x - r * 0.1, y - r * 0.35, r * 0.55, 2.2, 3.6);
  ctx.stroke();
}

function drawCosmicVoid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const nebula = ctx.createRadialGradient(x - r * 0.2, y + r * 0.1, 0, x, y, r);
  nebula.addColorStop(0, withAlpha("#7c3aed", 0.55));
  nebula.addColorStop(0.45, withAlpha(skin.color, 0.85));
  nebula.addColorStop(1, "#020617");
  ctx.fillStyle = nebula;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha("#c4b5fd", 0.25);
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.arc(x + r * 0.05, y - r * 0.05, r * 0.55, 0.8, 2.6);
  ctx.stroke();

  const starSizes = [1, 0.6, 1.2, 0.5, 0.9, 1.4, 0.7, 1.1, 0.55, 0.85, 1.3, 0.65];
  for (let i = 0; i < starSizes.length; i++) {
    const a = i * 1.17 + 0.4;
    const dist = r * (0.22 + (i % 4) * 0.17);
    const sx = x + Math.cos(a) * dist;
    const sy = y + Math.sin(a) * dist;
    const size = r * 0.035 * starSizes[i];
    if (i % 3 === 0) {
      drawSparkle(ctx, sx, sy, size, skin.highlight);
    } else {
      ctx.fillStyle = withAlpha(skin.highlight, 0.65 + (i % 2) * 0.25);
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = withAlpha(skin.highlight, 0.35);
  ctx.lineWidth = r * 0.025;
  ctx.beginPath();
  ctx.ellipse(x + r * 0.28, y + r * 0.32, r * 0.22, r * 0.08, -0.5, 0, Math.PI * 2);
  ctx.stroke();
}

// ── Crazy skins ─────────────────────────────────────────────────────────────

function drawFireball(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const core = ctx.createRadialGradient(x, y, 0, x, y, r * 0.55);
  core.addColorStop(0, "#ffffff");
  core.addColorStop(0.15, skin.highlight);
  core.addColorStop(0.45, "#f97316");
  core.addColorStop(0.75, skin.color);
  core.addColorStop(1, withAlpha(skin.stroke, 0.3));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha("#fef08a", 0.7);
  ctx.lineWidth = Math.max(1, r * 0.04);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.15;
    const inner = r * (0.2 + (i % 3) * 0.05);
    const outer = r * (0.75 + (i % 2) * 0.12);
    const wobble = Math.sin(i * 2.1) * r * 0.08;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.quadraticCurveTo(
      x + Math.cos(a + 0.3) * (outer * 0.6 + wobble),
      y + Math.sin(a + 0.3) * (outer * 0.6 - wobble),
      x + Math.cos(a) * outer,
      y + Math.sin(a) * outer
    );
    ctx.stroke();
  }

  ctx.fillStyle = withAlpha("#fde047", 0.85);
  for (let i = 0; i < 8; i++) {
    const a = i * 0.78 + 0.4;
    const dist = r * (0.55 + (i % 2) * 0.2);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDarkMatter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const warp = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
  warp.addColorStop(0, "#000000");
  warp.addColorStop(0.35, withAlpha(skin.color, 0.95));
  warp.addColorStop(0.65, withAlpha("#581c87", 0.7));
  warp.addColorStop(0.85, withAlpha(skin.highlight, 0.35));
  warp.addColorStop(1, withAlpha(skin.highlight, 0.15));
  ctx.fillStyle = warp;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.4);
  ctx.lineWidth = r * 0.06;
  for (let ring = 0; ring < 3; ring++) {
    const lr = r * (0.35 + ring * 0.18);
    ctx.beginPath();
    ctx.ellipse(x + r * 0.05, y - r * 0.03, lr, lr * 0.55, -0.4 + ring * 0.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 14; i++) {
    const a = i * 0.9 + 0.2;
    const dist = r * (0.25 + (i % 5) * 0.13);
    const sx = x + Math.cos(a) * dist;
    const sy = y + Math.sin(a) * dist;
    if (i % 4 === 0) {
      drawSparkle(ctx, sx, sy, r * 0.06, skin.highlight);
    } else {
      ctx.fillStyle = withAlpha(skin.highlight, 0.4 + (i % 3) * 0.15);
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = withAlpha("#e879f9", 0.25);
  ctx.lineWidth = r * 0.02;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.25;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15);
    ctx.bezierCurveTo(
      x + Math.cos(a + 0.5) * r * 0.5,
      y + Math.sin(a + 0.5) * r * 0.5,
      x + Math.cos(a + 1) * r * 0.7,
      y + Math.sin(a + 1) * r * 0.7,
      x + Math.cos(a + 1.5) * r * 0.85,
      y + Math.sin(a + 1.5) * r * 0.85
    );
    ctx.stroke();
  }
}

function drawPlasmaStorm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const storm = ctx.createRadialGradient(x, y, 0, x, y, r * 0.9);
  storm.addColorStop(0, withAlpha("#fdf4ff", 0.9));
  storm.addColorStop(0.3, withAlpha(skin.highlight, 0.75));
  storm.addColorStop(0.6, skin.color);
  storm.addColorStop(1, withAlpha(skin.stroke, 0.5));
  ctx.fillStyle = storm;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.85);
  ctx.lineWidth = Math.max(0.8, r * 0.035);
  const bolts: [number, number, number, number][] = [
    [-0.6, -0.3, 0.1, 0.5],
    [0.5, -0.5, -0.2, 0.3],
    [-0.3, 0.4, 0.4, -0.2],
    [0.2, 0.6, -0.5, -0.1],
    [-0.7, 0.1, 0.3, -0.4],
  ];
  for (const [sx, sy, mx, my] of bolts) {
    ctx.beginPath();
    ctx.moveTo(x + sx * r, y + sy * r);
    ctx.lineTo(x + mx * r, y + my * r);
    ctx.lineTo(x + (mx + 0.15) * r, y + (my - 0.1) * r);
    ctx.lineTo(x + (-sx * 0.3) * r, y + (-sy * 0.3) * r);
    ctx.stroke();
  }

  ctx.strokeStyle = withAlpha("#e879f9", 0.35);
  ctx.lineWidth = r * 0.025;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    for (let t = -r; t <= r; t += r * 0.12) {
      const px = x + t;
      const py = y + i * r * 0.18 + Math.sin(t * 0.15 + i) * r * 0.06;
      if (t === -r) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.fillStyle = withAlpha("#fae8ff", 0.7);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawToxicSlime(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const slime = ctx.createRadialGradient(x - r * 0.15, y - r * 0.2, 0, x, y, r);
  slime.addColorStop(0, withAlpha(skin.highlight, 0.85));
  slime.addColorStop(0.4, skin.color);
  slime.addColorStop(0.75, shadeColor(skin.color, -0.15));
  slime.addColorStop(1, withAlpha(skin.stroke, 0.6));
  ctx.fillStyle = slime;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
  ctx.fill();

  const bubbles: [number, number, number][] = [
    [-0.25, -0.3, 0.14],
    [0.35, -0.15, 0.1],
    [-0.1, 0.35, 0.12],
    [0.2, 0.4, 0.08],
    [-0.4, 0.15, 0.07],
    [0.45, 0.25, 0.06],
  ];
  for (const [bx, by, br] of bubbles) {
    const bGrad = ctx.createRadialGradient(
      x + bx * r - br * r * 0.2,
      y + by * r - br * r * 0.2,
      0,
      x + bx * r,
      y + by * r,
      br * r
    );
    bGrad.addColorStop(0, withAlpha("#ecfccb", 0.7));
    bGrad.addColorStop(0.5, withAlpha(skin.highlight, 0.4));
    bGrad.addColorStop(1, withAlpha(skin.color, 0.2));
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(x + bx * r, y + by * r, br * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(skin.highlight, 0.35);
    ctx.lineWidth = r * 0.015;
    ctx.beginPath();
    ctx.arc(x + bx * r, y + by * r, br * r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = withAlpha(skin.highlight, 0.3);
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y + r * 0.55);
  ctx.quadraticCurveTo(x - r * 0.2, y + r * 0.75, x + r * 0.1, y + r * 0.6);
  ctx.quadraticCurveTo(x + r * 0.35, y + r * 0.45, x + r * 0.55, y + r * 0.65);
  ctx.stroke();
}

function drawLavaRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const rock = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  rock.addColorStop(0, withAlpha(skin.highlight, 0.3));
  rock.addColorStop(0.5, skin.color);
  rock.addColorStop(1, withAlpha(skin.stroke, 0.95));
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.85);
  ctx.lineWidth = Math.max(1, r * 0.04);
  const veins: [number, number, number, number][] = [
    [-0.5, -0.2, 0.3, 0.4],
    [0.2, -0.45, -0.3, 0.2],
    [-0.15, 0.3, 0.4, -0.1],
    [0.4, 0.15, -0.2, -0.35],
  ];
  for (const [sx, sy, ex, ey] of veins) {
    ctx.beginPath();
    ctx.moveTo(x + sx * r, y + sy * r);
    ctx.lineTo(x + ex * r, y + ey * r);
    ctx.stroke();
    const glow = ctx.createRadialGradient(
      x + ex * r,
      y + ey * r,
      0,
      x + ex * r,
      y + ey * r,
      r * 0.12
    );
    glow.addColorStop(0, withAlpha("#fef08a", 0.9));
    glow.addColorStop(0.5, withAlpha(skin.highlight, 0.6));
    glow.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x + ex * r, y + ey * r, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = withAlpha(skin.stroke, 0.5);
  ctx.lineWidth = r * 0.025;
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + 0.3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3);
    ctx.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75);
    ctx.stroke();
  }
}

function drawAuroraWave(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const bands = [
    { color: "#5eead4", yOff: -0.25, alpha: 0.55 },
    { color: "#818cf8", yOff: -0.05, alpha: 0.45 },
    { color: "#34d399", yOff: 0.15, alpha: 0.5 },
    { color: skin.highlight, yOff: 0.3, alpha: 0.4 },
  ];
  for (const band of bands) {
    ctx.beginPath();
    for (let t = -r; t <= r; t += r * 0.06) {
      const px = x + t;
      const py = y + band.yOff * r + Math.sin(t * 0.08) * r * 0.12 + Math.cos(t * 0.04) * r * 0.06;
      if (t === -r) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = withAlpha(band.color, band.alpha);
    ctx.lineWidth = r * 0.14;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  ctx.fillStyle = withAlpha(skin.color, 0.35);
  ctx.beginPath();
  ctx.arc(x, y + r * 0.35, r * 0.55, Math.PI, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + 0.5;
    const dist = r * (0.4 + (i % 3) * 0.15);
    drawSparkle(ctx, x + Math.cos(a) * dist, y + Math.sin(a) * dist, r * 0.05, "#a7f3d0");
  }
}

function drawRainbowPrism(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < colors.length; i++) {
    ctx.rotate((Math.PI * 2) / colors.length);
    const band = ctx.createLinearGradient(-r, 0, r, 0);
    band.addColorStop(0, withAlpha(colors[i], 0));
    band.addColorStop(0.35, withAlpha(colors[i], 0.75));
    band.addColorStop(0.65, withAlpha(colors[i], 0.75));
    band.addColorStop(1, withAlpha(colors[i], 0));
    ctx.fillStyle = band;
    ctx.fillRect(-r, -r * 0.08, r * 2, r * 0.16);
  }
  ctx.restore();

  ctx.strokeStyle = withAlpha("#ffffff", 0.4);
  ctx.lineWidth = r * 0.03;
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI / 3) + 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
    ctx.stroke();
  }

  const prism = ctx.createRadialGradient(x, y, 0, x, y, r * 0.25);
  prism.addColorStop(0, withAlpha("#ffffff", 0.95));
  prism.addColorStop(0.5, withAlpha(skin.highlight, 0.5));
  prism.addColorStop(1, withAlpha(skin.color, 0.2));
  ctx.fillStyle = prism;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlitchCore(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  ctx.fillStyle = withAlpha(skin.color, 0.9);
  ctx.fillRect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);

  const slices = 8;
  for (let i = 0; i < slices; i++) {
    const sy = y - r * 0.8 + (i / slices) * r * 1.6;
    const sh = r * 0.18;
    const offset = (i % 3 === 0 ? r * 0.08 : i % 3 === 1 ? -r * 0.06 : 0);
    ctx.fillStyle = i % 2 === 0 ? withAlpha("#ef4444", 0.35) : withAlpha(skin.highlight, 0.3);
    ctx.fillRect(x - r * 0.85 + offset, sy, r * 1.7, sh * 0.4);
    if (i % 2 === 1) {
      ctx.fillStyle = withAlpha("#22c55e", 0.25);
      ctx.fillRect(x - r * 0.85 - offset * 0.5, sy + sh * 0.2, r * 1.7, sh * 0.25);
    }
  }

  ctx.strokeStyle = withAlpha(skin.highlight, 0.7);
  ctx.lineWidth = r * 0.03;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.4, y - r * 0.3);
  ctx.lineTo(x + r * 0.5, y - r * 0.1);
  ctx.lineTo(x - r * 0.2, y + r * 0.4);
  ctx.stroke();

  ctx.fillStyle = withAlpha("#ffffff", 0.15);
  for (let i = 0; i < 12; i++) {
    const px = x + (Math.sin(i * 3.7) * 0.7) * r;
    const py = y + (Math.cos(i * 2.3) * 0.7) * r;
    ctx.fillRect(px, py, r * 0.06, r * 0.03);
  }

  ctx.fillStyle = withAlpha(skin.highlight, 0.9);
  ctx.fillRect(x - r * 0.08, y - r * 0.08, r * 0.16, r * 0.16);
}

function drawBloodMoon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const moon = ctx.createRadialGradient(x - r * 0.2, y - r * 0.15, 0, x, y, r);
  moon.addColorStop(0, withAlpha(skin.highlight, 0.6));
  moon.addColorStop(0.4, skin.color);
  moon.addColorStop(0.8, shadeColor(skin.color, -0.2));
  moon.addColorStop(1, withAlpha(skin.stroke, 0.9));
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.fill();

  const craters: [number, number, number][] = [
    [-0.25, -0.2, 0.14],
    [0.3, 0.15, 0.1],
    [-0.1, 0.35, 0.08],
    [0.15, -0.35, 0.07],
    [-0.35, 0.2, 0.06],
  ];
  for (const [cx, cy, cr] of craters) {
    const cGrad = ctx.createRadialGradient(
      x + cx * r,
      y + cy * r,
      0,
      x + cx * r,
      y + cy * r,
      cr * r
    );
    cGrad.addColorStop(0, withAlpha(skin.stroke, 0.7));
    cGrad.addColorStop(0.6, withAlpha("#450a0a", 0.5));
    cGrad.addColorStop(1, withAlpha(skin.highlight, 0.15));
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(x + cx * r, y + cy * r, cr * r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = withAlpha(skin.highlight, 0.35);
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.arc(x + r * 0.05, y - r * 0.05, r * 0.7, 0.5, 2.8);
  ctx.stroke();

  ctx.fillStyle = withAlpha("#fca5a5", 0.5);
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.2, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawGhostWisp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const wisp = ctx.createRadialGradient(x, y - r * 0.1, 0, x, y, r);
  wisp.addColorStop(0, withAlpha("#ffffff", 0.55));
  wisp.addColorStop(0.35, withAlpha(skin.highlight, 0.4));
  wisp.addColorStop(0.7, withAlpha(skin.color, 0.35));
  wisp.addColorStop(1, withAlpha(skin.color, 0.1));
  ctx.fillStyle = wisp;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.35);
  ctx.lineWidth = r * 0.05;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.25 + 0.3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
    ctx.bezierCurveTo(
      x + Math.cos(a + 0.4) * r * 0.55,
      y + Math.sin(a + 0.4) * r * 0.55 - r * 0.1,
      x + Math.cos(a + 0.8) * r * 0.75,
      y + Math.sin(a + 0.8) * r * 0.75 + r * 0.05,
      x + Math.cos(a + 1.2) * r * 0.85,
      y + Math.sin(a + 1.2) * r * 0.85
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = withAlpha(skin.highlight, 0.6);
  ctx.beginPath();
  ctx.ellipse(x + r * 0.25, y + r * 0.15, r * 0.35, r * 0.5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.1, r * 0.28, r * 0.42, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = withAlpha("#ffffff", 0.7);
  ctx.beginPath();
  ctx.arc(x - r * 0.12, y - r * 0.18, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.1, y - r * 0.15, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawBlackHole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const disk = ctx.createRadialGradient(x, y, r * 0.15, x, y, r * 0.95);
  disk.addColorStop(0, "#000000");
  disk.addColorStop(0.2, withAlpha(skin.stroke, 0.9));
  disk.addColorStop(0.35, withAlpha(skin.highlight, 0.85));
  disk.addColorStop(0.5, withAlpha("#f97316", 0.7));
  disk.addColorStop(0.65, withAlpha(skin.highlight, 0.55));
  disk.addColorStop(0.8, withAlpha(skin.stroke, 0.4));
  disk.addColorStop(1, withAlpha(skin.color, 0.2));
  ctx.fillStyle = disk;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.6);
  ctx.lineWidth = r * 0.04;
  for (let ring = 0; ring < 4; ring++) {
    const lr = r * (0.4 + ring * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.02, lr, lr * 0.28, 0.15, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }

  for (let i = 0; i < 8; i++) {
    const a = i * 0.785;
    ctx.strokeStyle = withAlpha(skin.highlight, 0.2 + (i % 2) * 0.1);
    ctx.lineWidth = r * 0.015;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3);
    ctx.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
    ctx.stroke();
  }

  drawSparkle(ctx, x + r * 0.55, y - r * 0.15, r * 0.06, skin.highlight);
}

function drawRadioactive(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 6);
  for (let i = -4; i <= 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? withAlpha(skin.highlight, 0.75) : withAlpha(skin.color, 0.85);
    ctx.fillRect(-r, i * r * 0.22 - r * 0.1, r * 2, r * 0.2);
  }
  ctx.restore();

  ctx.strokeStyle = withAlpha("#000000", 0.4);
  ctx.lineWidth = r * 0.02;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - r, y + i * r * 0.22);
    ctx.lineTo(x + r, y + i * r * 0.22);
    ctx.stroke();
  }

  ctx.fillStyle = withAlpha(skin.color, 0.9);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = withAlpha(skin.highlight, 0.95);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const cx = x + Math.cos(a) * r * 0.18;
    const cy = y + Math.sin(a) * r * 0.18;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = withAlpha(skin.color, 0.95);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.5);
  ctx.lineWidth = r * 0.03;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCandySwirl(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const slices = 12;
  for (let i = 0; i < slices; i++) {
    const a0 = (i / slices) * Math.PI * 2;
    const a1 = ((i + 1) / slices) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? withAlpha(skin.color, 0.85) : withAlpha(skin.highlight, 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r * 0.88, a0, a1);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = withAlpha("#ffffff", 0.3);
  ctx.lineWidth = r * 0.025;
  for (let i = 0; i < 4; i++) {
    const sr = r * (0.2 + i * 0.18);
    ctx.beginPath();
    ctx.arc(x, y, sr, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = withAlpha("#ffffff", 0.85);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(skin.stroke, 0.4);
  ctx.lineWidth = r * 0.02;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.88);
  ctx.lineTo(x, y - r * 1.05);
  ctx.stroke();
}

function drawThunderCore(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const cloud = ctx.createRadialGradient(x, y - r * 0.1, 0, x, y, r);
  cloud.addColorStop(0, withAlpha("#475569", 0.8));
  cloud.addColorStop(0.5, skin.color);
  cloud.addColorStop(1, withAlpha(skin.stroke, 0.95));
  ctx.fillStyle = cloud;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = withAlpha("#64748b", 0.5);
  ctx.beginPath();
  ctx.ellipse(x - r * 0.2, y - r * 0.25, r * 0.35, r * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.25, y - r * 0.15, r * 0.3, r * 0.18, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.95);
  ctx.lineWidth = Math.max(1.2, r * 0.05);
  ctx.lineJoin = "miter";
  const lightning: [number, number][] = [
    [0.05, -0.5],
    [-0.15, -0.05],
    [0.1, -0.05],
    [-0.2, 0.55],
    [0.15, 0.0],
    [-0.05, 0.0],
    [0.05, 0.45],
  ];
  ctx.beginPath();
  ctx.moveTo(x + lightning[0][0] * r, y + lightning[0][1] * r);
  for (let i = 1; i < lightning.length; i++) {
    ctx.lineTo(x + lightning[i][0] * r, y + lightning[i][1] * r);
  }
  ctx.stroke();

  ctx.strokeStyle = withAlpha("#ffffff", 0.4);
  ctx.lineWidth = r * 0.02;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.3, y - r * 0.35);
  ctx.lineTo(x + r * 0.45, y - r * 0.15);
  ctx.lineTo(x + r * 0.35, y - r * 0.05);
  ctx.stroke();
}

function drawMatrixCode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  ctx.fillStyle = withAlpha(skin.color, 0.95);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.fill();

  const cols = 7;
  const glyphs = "01アイウエオカキクケコ";
  ctx.font = `bold ${Math.max(6, r * 0.14)}px monospace`;
  ctx.textAlign = "center";
  for (let c = 0; c < cols; c++) {
    const cx = x - r * 0.75 + (c / (cols - 1)) * r * 1.5;
    for (let row = 0; row < 6; row++) {
      const cy = y - r * 0.65 + row * r * 0.22;
      const ch = glyphs[(c * 3 + row * 5) % glyphs.length];
      const fade = 0.3 + (row / 6) * 0.65;
      ctx.fillStyle = row === 0 ? withAlpha("#ffffff", 0.9) : withAlpha(skin.highlight, fade);
      ctx.fillText(ch, cx, cy);
    }
  }

  ctx.strokeStyle = withAlpha(skin.highlight, 0.2);
  ctx.lineWidth = r * 0.015;
  for (let c = 0; c < cols; c++) {
    const cx = x - r * 0.75 + (c / (cols - 1)) * r * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, y - r * 0.7);
    ctx.lineTo(cx, y + r * 0.7);
    ctx.stroke();
  }
}

function drawDiamondDust(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const ice = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, 0, x, y, r);
  ice.addColorStop(0, withAlpha("#ffffff", 0.95));
  ice.addColorStop(0.35, skin.color);
  ice.addColorStop(0.7, shadeColor(skin.color, -0.1));
  ice.addColorStop(1, withAlpha(skin.stroke, 0.6));
  ctx.fillStyle = ice;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha("#ffffff", 0.6);
  ctx.lineWidth = Math.max(0.6, r * 0.025);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15);
    ctx.lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
    ctx.stroke();
    const fx = x + Math.cos(a + 0.4) * r * 0.55;
    const fy = y + Math.sin(a + 0.4) * r * 0.55;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + Math.cos(a + 1.2) * r * 0.12, fy + Math.sin(a + 1.2) * r * 0.12);
    ctx.lineTo(fx + Math.cos(a + 2.4) * r * 0.12, fy + Math.sin(a + 2.4) * r * 0.12);
    ctx.closePath();
    ctx.stroke();
  }

  const dust = [
    [0.4, -0.3],
    [-0.35, 0.25],
    [0.1, 0.45],
    [-0.2, -0.4],
    [0.5, 0.15],
    [-0.45, -0.15],
  ] as const;
  for (const [dx, dy] of dust) {
    drawSparkle(ctx, x + dx * r, y + dy * r, r * 0.07, "#ffffff");
  }
}

function drawSolarFlare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const sun = ctx.createRadialGradient(x, y, 0, x, y, r * 0.65);
  sun.addColorStop(0, "#ffffff");
  sun.addColorStop(0.2, skin.highlight);
  sun.addColorStop(0.5, "#fbbf24");
  sun.addColorStop(0.75, skin.color);
  sun.addColorStop(1, withAlpha(skin.stroke, 0.4));
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.7);
  ctx.lineWidth = Math.max(1, r * 0.035);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    ctx.quadraticCurveTo(
      x + Math.cos(a + 0.4) * r * 0.85,
      y + Math.sin(a + 0.4) * r * 0.85,
      x + Math.cos(a + 0.2) * r * 0.95,
      y + Math.sin(a + 0.2) * r * 0.95
    );
    ctx.stroke();
  }

  ctx.strokeStyle = withAlpha("#fca5a5", 0.45);
  ctx.lineWidth = r * 0.05;
  for (let loop = 0; loop < 3; loop++) {
    const lr = r * (0.35 + loop * 0.15);
    ctx.beginPath();
    ctx.arc(x + r * 0.05, y - r * 0.05, lr, 0.6 + loop * 0.3, 2.5 + loop * 0.2);
    ctx.stroke();
  }

  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + 0.2;
    drawSparkle(ctx, x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, r * 0.05, "#fff1f2");
  }
}

function drawVoidLeech(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const voidCore = ctx.createRadialGradient(x, y, 0, x, y, r * 0.5);
  voidCore.addColorStop(0, withAlpha(skin.highlight, 0.8));
  voidCore.addColorStop(0.4, withAlpha(skin.color, 0.95));
  voidCore.addColorStop(1, "#000000");
  ctx.fillStyle = voidCore;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(skin.highlight, 0.75);
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
    ctx.bezierCurveTo(
      x + Math.cos(a + 0.5) * r * 0.55,
      y + Math.sin(a + 0.5) * r * 0.55,
      x + Math.cos(a + 1) * r * 0.75,
      y + Math.sin(a + 1) * r * 0.75,
      x + Math.cos(a + 1.4) * r * 0.9,
      y + Math.sin(a + 1.4) * r * 0.9
    );
    ctx.stroke();
  }

  ctx.strokeStyle = withAlpha(skin.highlight, 0.35);
  ctx.lineWidth = r * 0.025;
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + 0.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
    ctx.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
    ctx.stroke();
  }

  ctx.fillStyle = withAlpha(skin.highlight, 0.6);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + 0.8;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.65, y + Math.sin(a) * r * 0.65, r * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHoloShimmer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef
) {
  const holoColors = ["#f472b6", "#a78bfa", "#22d3ee", "#4ade80", "#fbbf24", "#818cf8"];
  for (let i = 0; i < holoColors.length; i++) {
    const a0 = (i / holoColors.length) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / holoColors.length) * Math.PI * 2 - Math.PI / 2;
    const grad = ctx.createLinearGradient(
      x + Math.cos(a0) * r,
      y + Math.sin(a0) * r,
      x + Math.cos(a1) * r,
      y + Math.sin(a1) * r
    );
    grad.addColorStop(0, withAlpha(holoColors[i], 0.65));
    grad.addColorStop(1, withAlpha(holoColors[(i + 1) % holoColors.length], 0.65));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r * 0.88, a0, a1);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = withAlpha("#ffffff", 0.35);
  ctx.lineWidth = r * 0.02;
  for (let i = 0; i < 5; i++) {
    const a = i * 0.7 + 0.3;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + Math.sin(a * 3) * r * 0.3);
    ctx.bezierCurveTo(
      x - r * 0.2,
      y + Math.cos(a * 2) * r * 0.4,
      x + r * 0.2,
      y + Math.sin(a * 2.5) * r * 0.35,
      x + r * 0.7,
      y + Math.cos(a * 3) * r * 0.25
    );
    ctx.stroke();
  }

  const sheen = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  sheen.addColorStop(0, withAlpha("#ffffff", 0.45));
  sheen.addColorStop(0.4, withAlpha(skin.highlight, 0.15));
  sheen.addColorStop(0.6, withAlpha("#ffffff", 0));
  sheen.addColorStop(1, withAlpha(skin.highlight, 0.25));
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.1, y - r * 0.15, r * 0.55, r * 0.35, -0.5, 0, Math.PI * 2);
  ctx.fill();

  drawSparkle(ctx, x - r * 0.2, y - r * 0.25, r * 0.08, "#ffffff");
  drawSparkle(ctx, x + r * 0.3, y + r * 0.2, r * 0.06, skin.highlight);
}
