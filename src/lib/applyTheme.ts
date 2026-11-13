import { getTheme, themeCssVars } from "../data/themes";

/** Writes a theme's CSS variables onto <html> and tags it with data-theme. */
export function applyTheme(themeId: string | undefined | null): void {
  if (typeof document === "undefined") return;
  const theme = getTheme(themeId);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeCssVars(theme))) {
    root.style.setProperty(k, v);
  }
  root.dataset.theme = theme.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.metaColor);
}
