import type { SiteDef, Vec2 } from "../../types";

/** Camera info the screen-space backdrop can use for parallax. */
export interface BackdropCamera {
  panX: number;
  panY: number;
  /** World → screen px factor (coverScale × zoom). */
  scale: number;
  now: number;
}

export interface ZoneTierColors {
  fill: string;
  glow: string;
  core: string;
}

export interface ZoneDrawArgs {
  x: number;
  y: number;
  r: number;
  tier: ZoneTierColors;
  flash: boolean;
  /** 0..1 slow breathing value. */
  pulse: number;
  /** Stable per-zone phase (radians). */
  phase: number;
  now: number;
}

/**
 * Canvas art for one Shop theme. Everything here is cosmetic: it must not read
 * or write gameplay state.
 */
export interface RenderTheme {
  id: string;
  /** Screen-space backdrop, drawn before the world camera transform. */
  drawBackdrop(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    site: SiteDef,
    cam?: BackdropCamera
  ): void;
  /** Rope pivot mount, world units. Keep within ~±85 × (−55..+25) of the anchor. */
  drawPivot(ctx: CanvasRenderingContext2D, anchor: Vec2, now: number): void;
  zone: {
    /** Five tiers, lowest to highest base points. */
    tiers: readonly ZoneTierColors[];
    /** "soft" = classic halo; "bloom" = larger additive glow that flares on hit. */
    glow: "soft" | "bloom";
    /** Sets strokeStyle/lineWidth for the circle's rim (path already built). */
    rim(ctx: CanvasRenderingContext2D, a: ZoneDrawArgs): void;
    /** Classic crosshair ticks in the middle of the circle. */
    crosshair: boolean;
    /** Optional extra flourish on top of the circle body. */
    decorate?(ctx: CanvasRenderingContext2D, a: ZoneDrawArgs): void;
  };
  /** Draw particles with additive blending. */
  additiveParticles: boolean;
  /** CSS font for the floating "+N" text, without the size, e.g. `bold`/`"Inter Variable"`. */
  floatFont: { weight: string; family: string };
}
