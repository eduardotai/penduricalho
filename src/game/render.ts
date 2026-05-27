import type { AttachmentDef, PendulumDef, SiteDef, Vec2 } from "../types";
import type { PendulumHandle } from "./pendulum";
import { bobRadius } from "./pendulum";
import type { HitZoneField } from "./hitZones";
import type { EffectsState } from "./effects";
import { getShakeOffset } from "./effects";

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  now: number;
}

const SITE_BACKGROUNDS: Record<string, [string, string]> = {
  workshop: ["#1e293b", "#0f172a"],
  foundry: ["#3b1d12", "#1c0c08"],
  belfry: ["#1f1b3a", "#0c0a1f"],
  outdoor: ["#0f3320", "#04140a"],
  "zero-g": ["#0c1b3a", "#040716"],
};

export function drawSite(rc: RenderContext, site: SiteDef, anchor: Vec2) {
  const [top, bottom] = SITE_BACKGROUNDS[site.background] ?? SITE_BACKGROUNDS.workshop;
  const grad = rc.ctx.createLinearGradient(0, 0, 0, rc.height);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  rc.ctx.fillStyle = grad;
  rc.ctx.fillRect(0, 0, rc.width, rc.height);

  rc.ctx.save();
  rc.ctx.globalAlpha = 0.06;
  rc.ctx.strokeStyle = "#94a3b8";
  rc.ctx.lineWidth = 1;
  for (let x = 0; x < rc.width; x += 60) {
    rc.ctx.beginPath();
    rc.ctx.moveTo(x, 0);
    rc.ctx.lineTo(x, rc.height);
    rc.ctx.stroke();
  }
  for (let y = 0; y < rc.height; y += 60) {
    rc.ctx.beginPath();
    rc.ctx.moveTo(0, y);
    rc.ctx.lineTo(rc.width, y);
    rc.ctx.stroke();
  }
  rc.ctx.restore();

  rc.ctx.save();
  rc.ctx.fillStyle = "#475569";
  rc.ctx.fillRect(anchor.x - 60, anchor.y - 24, 120, 16);
  rc.ctx.fillStyle = "#334155";
  rc.ctx.fillRect(anchor.x - 50, anchor.y - 10, 100, 6);
  rc.ctx.restore();
}

export function drawHitZones(rc: RenderContext, field: HitZoneField) {
  for (const h of field.zones) {
    const z = h.zone;
    rc.ctx.save();
    rc.ctx.beginPath();
    rc.ctx.arc(z.position.x, z.position.y, z.radius, 0, Math.PI * 2);
    const flashActive = h.hitFlashUntil > rc.now;
    const alpha = flashActive ? 0.55 : 0.18;
    rc.ctx.fillStyle = flashActive
      ? `rgba(250, 204, 21, ${alpha})`
      : `rgba(56, 189, 248, ${alpha})`;
    rc.ctx.fill();
    rc.ctx.lineWidth = 2;
    rc.ctx.strokeStyle = flashActive ? "#fde68a" : "rgba(148, 197, 255, 0.65)";
    rc.ctx.stroke();

    rc.ctx.fillStyle = "rgba(255,255,255,0.85)";
    rc.ctx.font = "11px Inter, sans-serif";
    rc.ctx.textAlign = "center";
    rc.ctx.fillText(`x${z.multiplier.toFixed(2)}`, z.position.x, z.position.y + 4);
    rc.ctx.restore();
  }
}

export function drawPendulum(
  rc: RenderContext,
  handle: PendulumHandle,
  pendulum: PendulumDef,
  attachment: AttachmentDef
) {
  rc.ctx.save();
  rc.ctx.strokeStyle = attachmentColor(attachment);
  rc.ctx.lineWidth = attachmentLineWidth(attachment);

  rc.ctx.beginPath();
  rc.ctx.moveTo(handle.pivot.position.x, handle.pivot.position.y);
  for (const bob of handle.bobs) {
    rc.ctx.lineTo(bob.position.x, bob.position.y);
  }
  rc.ctx.stroke();

  rc.ctx.fillStyle = "#94a3b8";
  rc.ctx.beginPath();
  rc.ctx.arc(handle.pivot.position.x, handle.pivot.position.y, 7, 0, Math.PI * 2);
  rc.ctx.fill();
  rc.ctx.fillStyle = "#1e293b";
  rc.ctx.beginPath();
  rc.ctx.arc(handle.pivot.position.x, handle.pivot.position.y, 3, 0, Math.PI * 2);
  rc.ctx.fill();

  const r = bobRadius(pendulum);
  for (const bob of handle.bobs) {
    const grad = rc.ctx.createRadialGradient(
      bob.position.x - r * 0.3,
      bob.position.y - r * 0.3,
      r * 0.2,
      bob.position.x,
      bob.position.y,
      r
    );
    grad.addColorStop(0, pendulumHighlight(pendulum));
    grad.addColorStop(1, pendulumColor(pendulum));
    rc.ctx.fillStyle = grad;
    rc.ctx.beginPath();
    rc.ctx.arc(bob.position.x, bob.position.y, r, 0, Math.PI * 2);
    rc.ctx.fill();
    rc.ctx.lineWidth = 1.5;
    rc.ctx.strokeStyle = "rgba(15, 23, 42, 0.65)";
    rc.ctx.stroke();
  }
  rc.ctx.restore();
}

export function drawEffects(rc: RenderContext, eff: EffectsState) {
  for (const p of eff.particles) {
    const a = 1 - p.life / p.maxLife;
    rc.ctx.fillStyle = withAlpha(p.color, a);
    rc.ctx.beginPath();
    rc.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    rc.ctx.fill();
  }
  rc.ctx.font = "bold 14px Inter, sans-serif";
  rc.ctx.textAlign = "center";
  for (const f of eff.floats) {
    const a = 1 - f.life / f.maxLife;
    rc.ctx.fillStyle = withAlpha(f.color, a);
    rc.ctx.fillText(f.value, f.x, f.y);
  }
  for (const h of eff.hitFlashes) {
    const remaining = (h.until - rc.now) / 220;
    rc.ctx.strokeStyle = withAlpha(h.color, remaining * 0.6);
    rc.ctx.lineWidth = 3;
    rc.ctx.beginPath();
    rc.ctx.arc(h.x, h.y, h.radius + (1 - remaining) * 60, 0, Math.PI * 2);
    rc.ctx.stroke();
  }
}

export function applyShake(rc: RenderContext, eff: EffectsState) {
  const o = getShakeOffset(eff, rc.now);
  if (o.x !== 0 || o.y !== 0) rc.ctx.translate(o.x, o.y);
}

function attachmentColor(a: AttachmentDef) {
  switch (a.type) {
    case "rope":
      return "#a16207";
    case "rod":
      return "#94a3b8";
    case "chain":
      return "#64748b";
    case "elastic":
      return "#a78bfa";
  }
}

function attachmentLineWidth(a: AttachmentDef) {
  switch (a.type) {
    case "rope":
      return 3;
    case "rod":
      return 5;
    case "chain":
      return 4;
    case "elastic":
      return 2.5;
  }
}

function pendulumColor(p: PendulumDef) {
  switch (p.id) {
    case "wooden-bob":
      return "#92400e";
    case "brass-bob":
      return "#ca8a04";
    case "iron-bob":
      return "#475569";
    case "twin-bob":
      return "#1e40af";
    case "triple-bob":
      return "#7c3aed";
    case "tungsten-heavy":
      return "#0f172a";
    default:
      return "#92400e";
  }
}

function pendulumHighlight(p: PendulumDef) {
  switch (p.id) {
    case "wooden-bob":
      return "#fbbf24";
    case "brass-bob":
      return "#fde68a";
    case "iron-bob":
      return "#cbd5e1";
    case "twin-bob":
      return "#60a5fa";
    case "triple-bob":
      return "#c4b5fd";
    case "tungsten-heavy":
      return "#94a3b8";
    default:
      return "#fbbf24";
  }
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
  }
  return color;
}
