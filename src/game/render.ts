import type { AttachmentDef, BobShapeKind, BobSkinDef, PendulumDef, SiteDef, Vec2 } from "../types";
import { TOKEN_MAP } from "../data/tokens";
import { type WallField } from "./engine";
import type { PendulumHandle } from "./pendulum";
import { getEffectiveBobRadius, getOrderedBobBodies } from "./pendulum";
import type { HitZoneField } from "./hitZones";
import type { TokenField } from "./tokens";
import { getTokenLifeFraction } from "./tokens";
import type { EffectsState } from "./effects";
import { getShakeOffset } from "./effects";
import { drawBobSkinArt } from "./bobSkinArt";
import { clipBobShape, fillBobShape, strokeBobShape } from "./bobShapePath";
import { shadeColor, withAlpha } from "./bobRenderUtils";

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  now: number;
}

export interface EchoBobRender {
  x: number;
  y: number;
  radius: number;
}

const SITE_BACKGROUNDS: Record<string, [string, string]> = {
  workshop: ["#1e293b", "#0f172a"],
  "bumper-cage": ["#2a1233", "#120318"],
  "bumper-arena": ["#0f2a33", "#04161c"],
  "bumper-colosseum": ["#332512", "#1a1003"],
};

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridStep: number
) {
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

/** Fills the visible canvas in screen space (call before world camera transform). */
export function drawScreenBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  site: SiteDef
) {
  const [top, bottom] = SITE_BACKGROUNDS[site.background] ?? SITE_BACKGROUNDS.workshop;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, 60);
}

export function drawSiteBackground(rc: RenderContext, site: SiteDef) {
  const [top, bottom] = SITE_BACKGROUNDS[site.background] ?? SITE_BACKGROUNDS.workshop;
  const grad = rc.ctx.createLinearGradient(0, 0, 0, rc.height);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  rc.ctx.fillStyle = grad;
  rc.ctx.fillRect(0, 0, rc.width, rc.height);
  drawGrid(rc.ctx, rc.width, rc.height, 60);
}

export function drawSiteAnchor(rc: RenderContext, anchor: Vec2) {
  rc.ctx.save();
  rc.ctx.fillStyle = "#475569";
  rc.ctx.fillRect(anchor.x - 60, anchor.y - 24, 120, 16);
  rc.ctx.fillStyle = "#334155";
  rc.ctx.fillRect(anchor.x - 50, anchor.y - 10, 100, 6);
  rc.ctx.restore();
}

/**
 * Draws the boundary walls of a walled site as bars along the inner field
 * edges. Walls redden and crack as they take hits; broken walls leave a gap.
 * Wall-less sites pass an empty field and nothing is drawn.
 */
export function drawWalls(rc: RenderContext, field: WallField) {
  if (field.walls.length === 0) return;
  const t = 9;
  // Draw at the actual cage rectangle so larger arenas render their walls in
  // the right place, not at the playfield edges.
  const { minX, minY, maxX, maxY } = field.bounds;
  const cageW = maxX - minX;
  const cageH = maxY - minY;

  for (const wall of field.walls) {
    if (wall.broken) continue;
    const wear = 1 - wall.hp / wall.maxHp;
    const fill = mixHex("#475569", "#b91c1c", wear);
    const edge = mixHex("#94a3b8", "#fca5a5", wear);

    let x = 0;
    let y = 0;
    let bw = 0;
    let bh = 0;
    if (wall.side === "top") {
      x = minX;
      y = minY;
      bw = cageW;
      bh = t;
    } else if (wall.side === "bottom") {
      x = minX;
      y = maxY - t;
      bw = cageW;
      bh = t;
    } else if (wall.side === "left") {
      x = minX;
      y = minY;
      bw = t;
      bh = cageH;
    } else {
      x = maxX - t;
      y = minY;
      bw = t;
      bh = cageH;
    }

    rc.ctx.save();
    rc.ctx.globalAlpha = 0.82;
    rc.ctx.fillStyle = fill;
    rc.ctx.fillRect(x, y, bw, bh);
    rc.ctx.globalAlpha = 1;
    rc.ctx.strokeStyle = withAlpha(edge, 0.7);
    rc.ctx.lineWidth = 1.5;
    rc.ctx.strokeRect(x + 0.75, y + 0.75, bw - 1.5, bh - 1.5);

    // Cracks build up as the wall takes hits, hinting it's about to shatter.
    // Capped to a clean visual count regardless of how high the wall's max HP
    // scaled with the rig's weight.
    const cracks = Math.round(wear * 6);
    if (cracks > 0) {
      const horizontal = wall.side === "top" || wall.side === "bottom";
      const span = horizontal ? cageW : cageH;
      rc.ctx.strokeStyle = withAlpha("#fee2e2", 0.6);
      rc.ctx.lineWidth = 1;
      for (let i = 0; i < cracks; i++) {
        const f = (i + 1) / (cracks + 1);
        rc.ctx.beginPath();
        if (horizontal) {
          const cx = minX + span * f;
          rc.ctx.moveTo(cx, y);
          rc.ctx.lineTo(cx + (i % 2 === 0 ? 5 : -5), y + bh);
        } else {
          const cy = minY + span * f;
          rc.ctx.moveTo(x, cy);
          rc.ctx.lineTo(x + bw, cy + (i % 2 === 0 ? 5 : -5));
        }
        rc.ctx.stroke();
      }
    }
    rc.ctx.restore();
  }
}

/** @deprecated Use drawSiteBackground + drawSiteAnchor for camera zoom support. */
export function drawSite(rc: RenderContext, site: SiteDef, anchor: Vec2) {
  drawSiteBackground(rc, site);
  drawSiteAnchor(rc, anchor);
}

const ZONE_TIERS = [
  { fill: "#34d399", glow: "#6ee7b7", core: "#ecfdf5" },
  { fill: "#38bdf8", glow: "#7dd3fc", core: "#f0f9ff" },
  { fill: "#a78bfa", glow: "#c4b5fd", core: "#f5f3ff" },
  { fill: "#fb923c", glow: "#fdba74", core: "#fff7ed" },
  { fill: "#f472b6", glow: "#f9a8d4", core: "#fdf2f8" },
] as const;

function zoneTier(basePoints: number) {
  return ZONE_TIERS[Math.max(0, Math.min(ZONE_TIERS.length - 1, basePoints - 1))];
}

function zonePhase(x: number, y: number) {
  return (x * 0.017 + y * 0.023) % (Math.PI * 2);
}

export function drawHitZones(rc: RenderContext, field: HitZoneField) {
  for (const h of field.zones) {
    const z = h.zone;
    const { x, y } = z.position;
    const tier = zoneTier(z.basePoints);
    const phase = zonePhase(x, y);
    const pulse = 0.5 + 0.5 * Math.sin(rc.now / 520 + phase);
    const flashActive = h.hitFlashUntil > rc.now;
    const bonusRings = z.multiplier >= 1.35 ? 2 : z.multiplier >= 1.2 ? 1 : 0;
    const tokenGlow = z.modifierChance >= 0.24;

    rc.ctx.save();

    const glowR = z.radius + 8 + pulse * 4;
    const glow = rc.ctx.createRadialGradient(x, y, z.radius * 0.35, x, y, glowR);
    glow.addColorStop(0, withAlpha(tier.glow, flashActive ? 0.5 : 0.22 + pulse * 0.1));
    glow.addColorStop(1, withAlpha(tier.glow, 0));
    rc.ctx.fillStyle = glow;
    rc.ctx.beginPath();
    rc.ctx.arc(x, y, glowR, 0, Math.PI * 2);
    rc.ctx.fill();

    for (let i = 0; i < bonusRings; i++) {
      const ringR = z.radius + 5 + i * 4 + pulse * 1.5;
      rc.ctx.beginPath();
      rc.ctx.arc(x, y, ringR, 0, Math.PI * 2);
      rc.ctx.strokeStyle = withAlpha(tier.glow, flashActive ? 0.7 : 0.28 + pulse * 0.12);
      rc.ctx.lineWidth = 1.5;
      rc.ctx.stroke();
    }

    rc.ctx.beginPath();
    rc.ctx.arc(x, y, z.radius, 0, Math.PI * 2);
    const bodyGrad = rc.ctx.createRadialGradient(
      x - z.radius * 0.32,
      y - z.radius * 0.32,
      z.radius * 0.12,
      x,
      y,
      z.radius
    );
    if (flashActive) {
      bodyGrad.addColorStop(0, "#fffbeb");
      bodyGrad.addColorStop(0.5, "#fde68a");
      bodyGrad.addColorStop(1, tier.fill);
    } else {
      bodyGrad.addColorStop(0, tier.core);
      bodyGrad.addColorStop(0.4, tier.glow);
      bodyGrad.addColorStop(1, tier.fill);
    }
    rc.ctx.fillStyle = bodyGrad;
    rc.ctx.fill();
    rc.ctx.lineWidth = 2;
    rc.ctx.strokeStyle = flashActive ? "#fef3c7" : withAlpha(tier.fill, 0.9);
    rc.ctx.stroke();

    rc.ctx.beginPath();
    rc.ctx.ellipse(
      x - z.radius * 0.2,
      y - z.radius * 0.26,
      z.radius * 0.24,
      z.radius * 0.15,
      -0.5,
      0,
      Math.PI * 2
    );
    rc.ctx.fillStyle = withAlpha("#ffffff", flashActive ? 0.8 : 0.45 + pulse * 0.06);
    rc.ctx.fill();

    // Tier gem — bright center pip sized by value (arcade target, not a bet label)
    const gemR = 2 + z.basePoints * 0.55;
    rc.ctx.beginPath();
    rc.ctx.arc(x, y + z.radius * 0.06, gemR, 0, Math.PI * 2);
    rc.ctx.fillStyle = flashActive ? "#fff7ed" : withAlpha("#ffffff", 0.92);
    rc.ctx.fill();

    // Reticle marks these as score targets (distinct from floating loot pickups).
    rc.ctx.beginPath();
    rc.ctx.arc(x, y, z.radius * 0.58, 0, Math.PI * 2);
    rc.ctx.strokeStyle = withAlpha("#ffffff", flashActive ? 0.55 : 0.18 + pulse * 0.08);
    rc.ctx.lineWidth = 1;
    rc.ctx.stroke();

    const tickLen = z.radius * 0.22;
    rc.ctx.strokeStyle = withAlpha("#ffffff", flashActive ? 0.5 : 0.2);
    rc.ctx.beginPath();
    rc.ctx.moveTo(x - tickLen, y);
    rc.ctx.lineTo(x + tickLen, y);
    rc.ctx.moveTo(x, y - tickLen);
    rc.ctx.lineTo(x, y + tickLen);
    rc.ctx.stroke();

    // Zones that can drop loot: dashed arc on the rim (not a separate floating orb).
    if (tokenGlow && !flashActive) {
      rc.ctx.setLineDash([3, 5]);
      rc.ctx.beginPath();
      rc.ctx.arc(x, y, z.radius + 4, phase, phase + Math.PI * 0.85);
      rc.ctx.strokeStyle = withAlpha("#fef08a", 0.42 + pulse * 0.1);
      rc.ctx.lineWidth = 1.5;
      rc.ctx.stroke();
      rc.ctx.setLineDash([]);
    }

    rc.ctx.restore();
  }
}

export function drawTokens(rc: RenderContext, field: TokenField) {
  for (const h of field.tokens) {
    if (h.token.consumed) continue;
    const def = TOKEN_MAP.get(h.token.kind);
    if (!def) continue;
    const life = getTokenLifeFraction(h.token, rc.now);
    const urgency = life < 0.25 ? 1 : 0;
    const pulse = 0.5 + 0.5 * Math.sin(rc.now / (urgency ? 90 : 220));
    const fade = Math.min(1, life * 4);
    const baseR = h.token.radius;
    const x = h.body.position.x;
    const y = h.body.position.y;
    const spin = rc.now / (def.isGolden ? 520 : 680) + h.token.driftPhase;
    const bob = Math.sin(rc.now / 280 + h.token.driftPhase) * 2.5;
    const scale = 1 + pulse * (def.isGolden ? 0.1 : 0.07);

    rc.ctx.save();
    rc.ctx.globalAlpha = fade;
    rc.ctx.translate(x, y + bob);
    rc.ctx.rotate(spin);
    rc.ctx.scale(scale, scale);

    // Drop shadow — loot floats above the playfield, unlike anchored score orbs.
    rc.ctx.fillStyle = "rgba(0,0,0,0.35)";
    rc.ctx.beginPath();
    tracePickupShape(rc.ctx, 0, baseR * 0.18, baseR * 0.72, def.isGolden ?? false);
    rc.ctx.fill();

    const glowR = baseR + 8 + pulse * 5;
    const glow = rc.ctx.createRadialGradient(0, 0, baseR * 0.25, 0, 0, glowR);
    glow.addColorStop(0, withAlpha(def.color, 0.55));
    glow.addColorStop(1, withAlpha(def.color, 0));
    rc.ctx.fillStyle = glow;
    rc.ctx.beginPath();
    rc.ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    rc.ctx.fill();

    rc.ctx.setLineDash([4, 4]);
    rc.ctx.beginPath();
    tracePickupShape(rc.ctx, 0, 0, baseR + 4 + pulse * 3, def.isGolden ?? false);
    rc.ctx.strokeStyle = withAlpha(def.color, 0.55);
    rc.ctx.lineWidth = 1.5;
    rc.ctx.stroke();
    rc.ctx.setLineDash([]);

    const grad = rc.ctx.createLinearGradient(-baseR, -baseR, baseR, baseR);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.45, def.color);
    grad.addColorStop(1, shadeColor(def.color, -0.35));
    rc.ctx.fillStyle = grad;
    rc.ctx.beginPath();
    tracePickupShape(rc.ctx, 0, 0, baseR, def.isGolden ?? false);
    rc.ctx.fill();
    rc.ctx.lineWidth = def.isGolden ? 2.5 : 2;
    rc.ctx.strokeStyle = "rgba(15,23,42,0.75)";
    rc.ctx.stroke();

    rc.ctx.rotate(-spin);
    rc.ctx.fillStyle = "rgba(15,23,42,0.88)";
    rc.ctx.font = `bold ${def.isGolden ? 12 : 10}px Inter, sans-serif`;
    rc.ctx.textAlign = "center";
    rc.ctx.textBaseline = "middle";
    rc.ctx.fillText(tokenGlyph(def.kind), 0, 0.5);

    rc.ctx.restore();
  }
}

export function drawEchoBobs(
  rc: RenderContext,
  _pivot: Vec2,
  echoes: EchoBobRender[],
  skin: BobSkinDef,
  shape: BobShapeKind = "circle"
) {
  void _pivot;
  for (const e of echoes) {
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
    rc.ctx.save();
    rc.ctx.globalAlpha = 0.5;
    drawBobBody(rc.ctx, e.x, e.y, e.radius, skin, shape);
    rc.ctx.restore();
  }
}

export function drawPendulum(
  rc: RenderContext,
  handle: PendulumHandle,
  _pendulum: PendulumDef,
  attachment: AttachmentDef,
  skin: BobSkinDef,
  stretchRatio: number = 1,
  shape: BobShapeKind = "circle",
  durability: number = 1
) {
  const stretch = Math.max(0.85, Math.min(1.75, stretchRatio));
  const ordered = getOrderedBobBodies(handle);
  const pivot = handle.pivot.position;
  const defaultRadius = getEffectiveBobRadius(handle);
  const snapped = handle.snapped;

  // The rope frays, thins, and reddens as durability drains. Near zero it
  // shimmers a danger pulse; once snapped the broken line dangles slack.
  const dur = Math.max(0, Math.min(1, durability));
  const wear = 1 - dur;
  const baseColor = attachmentColor(attachment, stretch);
  const ropeColor = mixHex(baseColor, "#7f1d1d", Math.pow(wear, 1.4) * 0.85);
  const ropeWidth = attachmentLineWidth(attachment, stretch) * (0.55 + 0.45 * dur);
  const dangerShimmer =
    !snapped && dur < 0.12
      ? 0.55 + 0.45 * Math.sin(rc.now / 70)
      : 1;

  rc.ctx.save();
  rc.ctx.globalAlpha = snapped ? 0.4 : dangerShimmer;
  rc.ctx.strokeStyle = ropeColor;
  rc.ctx.lineWidth = ropeWidth;
  rc.ctx.lineCap = "round";
  rc.ctx.lineJoin = "round";

  rc.ctx.beginPath();
  rc.ctx.moveTo(pivot.x, pivot.y);
  let drewSegment = false;
  for (const node of handle.ropeSegments ?? []) {
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) continue;
    rc.ctx.lineTo(node.position.x, node.position.y);
    drewSegment = true;
  }
  // While snapped the bob chain has torn free of the rope — only the dangling
  // line from the pivot is still drawn, never a line out to the flying bobs.
  if (!snapped) {
    if (handle.chainBobs.length > 0) {
      // Rope nodes already span the chain — only the short link to the tip remains.
      const tip = handle.bobs[handle.bobs.length - 1];
      if (tip && Number.isFinite(tip.position.x) && Number.isFinite(tip.position.y)) {
        rc.ctx.lineTo(tip.position.x, tip.position.y);
        drewSegment = true;
      }
    } else {
      for (const bob of ordered) {
        if (!Number.isFinite(bob.position.x) || !Number.isFinite(bob.position.y)) continue;
        rc.ctx.lineTo(bob.position.x, bob.position.y);
        drewSegment = true;
      }
    }
  }
  if (drewSegment) rc.ctx.stroke();
  rc.ctx.globalAlpha = 1;

  // Loose frayed strands branch off the rope as it nears failure.
  if (!snapped && dur < 0.35) {
    drawRopeFray(rc, handle, ropeColor, ropeWidth, dur);
  }

  // Chain bobs sit on the rope polyline — draw a small crimp so they read as attached.
  if (!snapped && handle.chainBobs.length > 0) {
    rc.ctx.save();
    rc.ctx.strokeStyle = ropeColor;
    rc.ctx.lineWidth = Math.max(2, attachmentLineWidth(attachment, stretch) * 0.85);
    rc.ctx.lineCap = "round";
    for (const bob of handle.chainBobs) {
      if (!Number.isFinite(bob.position.x) || !Number.isFinite(bob.position.y)) continue;
      const r = bob.circleRadius ?? defaultRadius;
      const inset = r * 0.42;
      const ax = bob.position.x - Math.cos(bob.angle) * inset;
      const ay = bob.position.y - Math.sin(bob.angle) * inset;
      rc.ctx.beginPath();
      rc.ctx.moveTo(ax, ay);
      rc.ctx.lineTo(bob.position.x, bob.position.y);
      rc.ctx.stroke();
    }
    rc.ctx.restore();
  }

  for (const node of handle.ropeSegments ?? []) {
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) continue;
    const r = node.circleRadius ?? 3.5;
    rc.ctx.fillStyle = ropeColor;
    rc.ctx.globalAlpha = snapped ? 0.3 : 0.65;
    rc.ctx.beginPath();
    rc.ctx.arc(node.position.x, node.position.y, r, 0, Math.PI * 2);
    rc.ctx.fill();
    rc.ctx.globalAlpha = 1;
  }

  rc.ctx.fillStyle = "#94a3b8";
  rc.ctx.beginPath();
  rc.ctx.arc(pivot.x, pivot.y, 7, 0, Math.PI * 2);
  rc.ctx.fill();
  rc.ctx.fillStyle = "#1e293b";
  rc.ctx.beginPath();
  rc.ctx.arc(pivot.x, pivot.y, 3, 0, Math.PI * 2);
  rc.ctx.fill();

  for (const bob of ordered) {
    const bx = bob.position.x;
    const by = bob.position.y;
    if (!Number.isFinite(bx) || !Number.isFinite(by)) continue;

    const r = bob.circleRadius ?? defaultRadius;
    drawBobBody(rc.ctx, bx, by, r, skin, shape);
  }
  rc.ctx.restore();
}

export function drawBobSkin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef,
  shape: BobShapeKind = "circle"
) {
  drawBobBody(ctx, x, y, r, skin, shape);
}

function drawBobBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef,
  shape: BobShapeKind = "circle"
) {
  if (skin.rarity === "epic" || skin.rarity === "legendary") {
    ctx.save();
    ctx.shadowColor = withAlpha(skin.highlight, 0.55);
    ctx.shadowBlur = r * 0.45;
    ctx.fillStyle = withAlpha(skin.highlight, 0.18);
    fillBobShape(ctx, x, y, r * 0.92, shape);
    ctx.restore();
  }

  const grad = ctx.createRadialGradient(
    x - r * 0.35,
    y - r * 0.38,
    r * 0.08,
    x + r * 0.12,
    y + r * 0.18,
    r * 1.05
  );
  grad.addColorStop(0, skin.highlight);
  grad.addColorStop(0.45, skin.color);
  grad.addColorStop(1, shadeColor(skin.color, -0.22));
  ctx.fillStyle = grad;
  fillBobShape(ctx, x, y, r, shape);

  ctx.save();
  clipBobShape(ctx, x, y, r, shape);
  drawBobSkinArt(ctx, x, y, r, skin);
  ctx.restore();

  ctx.save();
  clipBobShape(ctx, x, y, r, shape);
  const shade = ctx.createLinearGradient(x, y - r, x, y + r);
  shade.addColorStop(0, "rgba(255,255,255,0.12)");
  shade.addColorStop(0.55, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  drawBobSpecular(ctx, x, y, r, skin, shape);

  ctx.lineWidth = Math.max(1.2, r * 0.07);
  ctx.strokeStyle = withAlpha(skin.stroke, 0.85);
  strokeBobShape(ctx, x, y, r, shape);

  ctx.lineWidth = Math.max(0.6, r * 0.035);
  ctx.strokeStyle = withAlpha(skin.highlight, 0.35);
  strokeBobShape(ctx, x, y, r * 0.88, shape);
}

function drawBobSpecular(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: BobSkinDef,
  shape: BobShapeKind
) {
  ctx.save();
  clipBobShape(ctx, x, y, r, shape);
  const spec = ctx.createRadialGradient(
    x - r * 0.38,
    y - r * 0.42,
    0,
    x - r * 0.38,
    y - r * 0.42,
    r * 0.55
  );
  spec.addColorStop(0, withAlpha("#ffffff", skin.rarity === "legendary" ? 0.75 : 0.5));
  spec.addColorStop(0.35, withAlpha(skin.highlight, 0.25));
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
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

const ROPE_COLORS: Record<string, string> = {
  "micro-twine": "#d4a574",
  "short-hemp": "#b8860b",
  "compact-rope": "#a16207",
  "hemp-rope": "#ca8a04",
  "steel-rope": "#64748b",
  "braided-rope": "#92400e",
  "tow-rope": "#78716c",
  "titan-cable": "#475569",
  "magnetic-tether": "#22d3ee",
};

const ROPE_LINE_WIDTH: Record<string, number> = {
  "micro-twine": 2,
  "short-hemp": 2.25,
  "compact-rope": 2.5,
  "hemp-rope": 3,
  "steel-rope": 2.5,
  "braided-rope": 3.25,
  "tow-rope": 3.5,
  "titan-cable": 3,
  "magnetic-tether": 1.5,
};

function parseHex(color: string): [number, number, number] | null {
  if (!color.startsWith("#") || color.length < 7) return null;
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
}

/** Linear blend between two hex colors; falls back to `a` if either isn't hex. */
function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const k = Math.max(0, Math.min(1, t));
  const m = (i: number) => Math.round(ca[i] + (cb[i] - ca[i]) * k);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

/**
 * Short jittered strands peeling off the rope polyline as it nears failure.
 * The jitter animates off `rc.now` so the fray visibly trembles, and the count
 * grows as durability drops toward zero.
 */
function drawRopeFray(
  rc: RenderContext,
  handle: PendulumHandle,
  color: string,
  width: number,
  durability: number
) {
  const nodes = handle.ropeSegments ?? [];
  if (nodes.length < 2) return;
  const intensity = Math.max(0, Math.min(1, (0.35 - durability) / 0.35));
  const strandLen = (4 + intensity * 7);

  rc.ctx.save();
  rc.ctx.strokeStyle = color;
  rc.ctx.lineWidth = Math.max(0.75, width * 0.4);
  rc.ctx.lineCap = "round";
  rc.ctx.globalAlpha = 0.35 + intensity * 0.4;

  for (let i = 1; i < nodes.length; i++) {
    // Skip some nodes at low intensity so fray builds up gradually.
    if ((i % 2 === 0) && intensity < 0.55) continue;
    const n = nodes[i];
    if (!Number.isFinite(n.position.x) || !Number.isFinite(n.position.y)) continue;
    const wobble = Math.sin(rc.now / 90 + i * 1.7) * (0.5 + intensity);
    const ang = i * 2.4 + wobble;
    rc.ctx.beginPath();
    rc.ctx.moveTo(n.position.x, n.position.y);
    rc.ctx.lineTo(
      n.position.x + Math.cos(ang) * strandLen,
      n.position.y + Math.sin(ang) * strandLen
    );
    rc.ctx.stroke();
  }
  rc.ctx.restore();
}

function attachmentColor(attachment: AttachmentDef, stretch = 1): string {
  if (attachment.type === "rope") {
    return ROPE_COLORS[attachment.id] ?? "#a16207";
  }
  switch (attachment.type) {
    case "rod":
      return "#94a3b8";
    case "chain":
      return "#64748b";
    case "elastic":
      return stretch > 1.08 ? "#c084fc" : "#a78bfa";
    default:
      return "#a16207";
  }
}

function attachmentLineWidth(attachment: AttachmentDef, stretch = 1): number {
  if (attachment.type === "rope") {
    return ROPE_LINE_WIDTH[attachment.id] ?? 3;
  }
  switch (attachment.type) {
    case "rod":
      return 5;
    case "chain":
      return 4;
    case "elastic":
      return Math.max(1, 2.8 / stretch);
  }
}

function tracePickupShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  isGolden: boolean
) {
  if (isGolden) {
    traceStar(ctx, x, y, r, r * 0.48, 5);
    return;
  }
  traceDiamond(ctx, x, y, r);
}

function traceDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
) {
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

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
    const r = i % 2 === 0 ? outerR : innerR;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function tokenGlyph(kind: string): string {
  switch (kind) {
    case "bigger-bob":
      return "B+";
    case "giant-bob":
      return "B++";
    case "tiny-bob":
      return "B-";
    case "velocity-surge":
      return ">>";
    case "speed-ramp":
      return "^";
    case "multi-bob":
      return "x3";
    case "repair":
      return "+";
    case "golden":
      return "*";
    default:
      return "?";
  }
}
