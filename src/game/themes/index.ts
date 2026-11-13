import { DEFAULT_THEME_ID } from "../../data/themes";
import { classicTheme } from "./classic";
import { watchmakerTheme } from "./watchmaker";
import type { RenderTheme } from "./types";

export type { BackdropCamera, RenderTheme, ZoneDrawArgs, ZoneTierColors } from "./types";

/** Canvas art by theme id. Every id in data/themes.ts must have an entry (tested). */
export const RENDER_THEMES: Record<string, RenderTheme> = {
  [classicTheme.id]: classicTheme,
  [watchmakerTheme.id]: watchmakerTheme,
};

let active: RenderTheme = RENDER_THEMES[DEFAULT_THEME_ID];

/** Selects the theme the canvas draws with (module-level; read every frame). */
export function setRenderTheme(id: string | undefined | null): void {
  active = (id && RENDER_THEMES[id]) || RENDER_THEMES[DEFAULT_THEME_ID];
}

export function getRenderTheme(): RenderTheme {
  return active;
}
