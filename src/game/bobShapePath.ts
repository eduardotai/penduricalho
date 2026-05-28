import type { BobShapeKind } from "../types";

function traceStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number,
  points: number
) {
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

function traceRegularPolygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  sides: number,
  rotation = -Math.PI / 2
) {
  for (let i = 0; i <= sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
}

function traceHeart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const top = y - r * 0.15;
  ctx.moveTo(x, y + r * 0.85);
  ctx.bezierCurveTo(x + r * 1.1, y + r * 0.2, x + r * 0.75, y - r * 0.55, x, top);
  ctx.bezierCurveTo(x - r * 0.75, y - r * 0.55, x - r * 1.1, y + r * 0.2, x, y + r * 0.85);
  ctx.closePath();
}

function traceBolt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.moveTo(x + r * 0.08, y - r);
  ctx.lineTo(x - r * 0.35, y - r * 0.05);
  ctx.lineTo(x + r * 0.02, y - r * 0.05);
  ctx.lineTo(x - r * 0.12, y + r);
  ctx.lineTo(x + r * 0.42, y + r * 0.08);
  ctx.lineTo(x + r * 0.05, y + r * 0.08);
  ctx.closePath();
}

function traceFlame(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.moveTo(x, y + r * 0.92);
  ctx.bezierCurveTo(x + r * 0.75, y + r * 0.35, x + r * 0.55, y - r * 0.35, x, y - r);
  ctx.bezierCurveTo(x - r * 0.55, y - r * 0.35, x - r * 0.75, y + r * 0.35, x, y + r * 0.92);
  ctx.closePath();
}

function traceCog(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const teeth = 8;
  const inner = r * 0.62;
  const outer = r * 0.98;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 2 === 0 ? outer : inner;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function traceCross(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const t = r * 0.32;
  ctx.moveTo(x - t, y - r);
  ctx.lineTo(x + t, y - r);
  ctx.lineTo(x + t, y - t);
  ctx.lineTo(x + r, y - t);
  ctx.lineTo(x + r, y + t);
  ctx.lineTo(x + t, y + t);
  ctx.lineTo(x + t, y + r);
  ctx.lineTo(x - t, y + r);
  ctx.lineTo(x - t, y + t);
  ctx.lineTo(x - r, y + t);
  ctx.lineTo(x - r, y - t);
  ctx.lineTo(x - t, y - t);
  ctx.closePath();
}

function traceMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.55, y - r * 0.12, r * 0.78, 0, Math.PI * 2, true);
}

export function traceBobShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  shape: BobShapeKind
) {
  switch (shape) {
    case "circle":
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(x - r * 0.92, y - r * 0.92, r * 1.84, r * 1.84);
      break;
    case "diamond":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case "star":
      traceStar(ctx, x, y, r, r * 0.46, 5);
      break;
    case "hex":
      traceRegularPolygon(ctx, x, y, r, 6);
      break;
    case "triangle":
      traceRegularPolygon(ctx, x, y, r, 3);
      break;
    case "heart":
      traceHeart(ctx, x, y, r);
      break;
    case "bolt":
      traceBolt(ctx, x, y, r);
      break;
    case "flame":
      traceFlame(ctx, x, y, r);
      break;
    case "cog":
      traceCog(ctx, x, y, r);
      break;
    case "cross":
      traceCross(ctx, x, y, r);
      break;
    case "moon":
      traceMoon(ctx, x, y, r);
      break;
    case "ring":
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.arc(x, y, r * 0.48, 0, Math.PI * 2, true);
      break;
  }
}

export function fillBobShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  shape: BobShapeKind
) {
  ctx.beginPath();
  traceBobShape(ctx, x, y, r, shape);
  if (shape === "ring" || shape === "moon") ctx.fill("evenodd");
  else ctx.fill();
}

export function strokeBobShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  shape: BobShapeKind
) {
  ctx.beginPath();
  traceBobShape(ctx, x, y, r, shape);
  if (shape === "ring" || shape === "moon") ctx.stroke();
  else ctx.stroke();
}

export function clipBobShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  shape: BobShapeKind
) {
  ctx.beginPath();
  traceBobShape(ctx, x, y, r, shape);
  ctx.clip();
}
