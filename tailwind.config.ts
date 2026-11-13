import type { Config } from "tailwindcss";

// Palette families a theme can remap (see src/data/themes.ts). Each shade is a
// CSS variable holding "r g b", set on <html> by src/lib/applyTheme.ts, so
// opacity modifiers like `bg-slate-900/60` keep working.
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
function themed(family: string) {
  return Object.fromEntries(
    SHADES.map((s) => [s, `rgb(var(--c-${family}-${s}) / <alpha-value>)`])
  );
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: themed("slate"),
        brand: themed("brand"),
        amber: themed("amber"),
        yellow: themed("yellow"),
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
