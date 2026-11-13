/**
 * Visual themes sold in the Shop's Themes tab. A theme re-skins the UI (the
 * Tailwind palette families below are CSS variables, see tailwind.config.ts)
 * and the canvas (backdrop, pivot, hit circles: game/themes/). Themes are
 * purely cosmetic: no gameplay effect.
 *
 * Pure data. The canvas art for each id lives in game/themes/<id>.ts and is
 * looked up by `getRenderTheme` in game/themes/index.ts.
 */

/** Tailwind shade keys we remap per theme. */
export type Shade =
  | "50"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "950";

export type Palette = Record<Shade, string>;

/** Palette families the UI classes use that a theme can remap. */
export const THEMED_FAMILIES = ["slate", "brand", "amber", "yellow"] as const;
export type ThemedFamily = (typeof THEMED_FAMILIES)[number];

export interface ThemeDef {
  id: string;
  name: { en: string; pt: string };
  description: { en: string; pt: string };
  /** Momentum price; 0 = free/default. */
  cost: number;
  palette: Record<ThemedFamily, Palette>;
  /** CSS font-family stacks. */
  fonts: { sans: string; display: string; heading: string };
  /** Page background behind the canvas (body). */
  pageBackground: string;
  /** <meta name="theme-color">. */
  metaColor: string;
  /** Preview swatch colors for the shop card: background, accent, highlight. */
  swatch: [string, string, string];
}

const TAILWIND_SLATE: Palette = {
  "50": "#f8fafc",
  "100": "#f1f5f9",
  "200": "#e2e8f0",
  "300": "#cbd5e1",
  "400": "#94a3b8",
  "500": "#64748b",
  "600": "#475569",
  "700": "#334155",
  "800": "#1e293b",
  "900": "#0f172a",
  "950": "#020617",
};

const TAILWIND_AMBER: Palette = {
  "50": "#fffbeb",
  "100": "#fef3c7",
  "200": "#fde68a",
  "300": "#fcd34d",
  "400": "#fbbf24",
  "500": "#f59e0b",
  "600": "#d97706",
  "700": "#b45309",
  "800": "#92400e",
  "900": "#78350f",
  "950": "#451a03",
};

const TAILWIND_YELLOW: Palette = {
  "50": "#fefce8",
  "100": "#fef9c3",
  "200": "#fef08a",
  "300": "#fde047",
  "400": "#facc15",
  "500": "#eab308",
  "600": "#ca8a04",
  "700": "#a16207",
  "800": "#854d0e",
  "900": "#713f12",
  "950": "#422006",
};

/** The game's original orange brand ramp. */
const CLASSIC_BRAND: Palette = {
  "50": "#fff7ed",
  "100": "#ffedd5",
  "200": "#fed7aa",
  "300": "#fdba74",
  "400": "#fb923c",
  "500": "#f97316",
  "600": "#ea580c",
  "700": "#c2410c",
  "800": "#9a3412",
  "900": "#7c2d12",
  "950": "#431407",
};

const SANS = '"Inter Variable", ui-sans-serif, system-ui, sans-serif';
const SERIF = '"Fraunces Variable", Georgia, ui-serif, serif';

export const DEFAULT_THEME_ID = "classic";

export const THEMES: ThemeDef[] = [
  {
    id: DEFAULT_THEME_ID,
    name: { en: "Classic", pt: "Clássico" },
    description: {
      en: "The original night-blue lab with candy orbs.",
      pt: "O laboratório azul-noite original com orbes coloridos.",
    },
    cost: 0,
    palette: {
      slate: TAILWIND_SLATE,
      brand: CLASSIC_BRAND,
      amber: TAILWIND_AMBER,
      yellow: TAILWIND_YELLOW,
    },
    fonts: { sans: SANS, display: SANS, heading: SANS },
    pageBackground:
      "radial-gradient(circle at 30% 20%, rgba(249, 115, 22, 0.08), transparent 50%), radial-gradient(circle at 80% 80%, rgba(56, 189, 248, 0.06), transparent 50%), #020617",
    metaColor: "#020617",
    swatch: ["#0f172a", "#f97316", "#38bdf8"],
  },
  {
    id: "watchmaker",
    name: { en: "Watchmaker's Bench", pt: "Joalheria do Relojoeiro" },
    description: {
      en: "Walnut and brass: a lamp-lit bench, turning gears, a brass pivot and jewel-cut circles.",
      pt: "Nogueira e latão: bancada sob a luminária, engrenagens girando, pivô de latão e círculos lapidados.",
    },
    cost: 25_000,
    palette: {
      // Warm walnut/umber replaces slate, so every panel is re-skinned.
      slate: {
        "50": "#faf6ef",
        "100": "#f3ebdd",
        "200": "#e6d7bf",
        "300": "#cfb995",
        "400": "#a99272",
        "500": "#7f6a52",
        "600": "#5e4d3b",
        "700": "#46382b",
        "800": "#30261d",
        "900": "#221a14",
        "950": "#15100c",
      },
      // Polished brass.
      brand: {
        "50": "#fdf8ec",
        "100": "#f9edc9",
        "200": "#f2d98f",
        "300": "#e9c25a",
        "400": "#dcaa36",
        "500": "#c58f22",
        "600": "#a5721a",
        "700": "#835618",
        "800": "#6a4519",
        "900": "#583a18",
        "950": "#33210c",
      },
      // Amber/yellow accents become warm gold so they sit inside the brass palette.
      amber: {
        "50": "#fdf8ea",
        "100": "#f8ecc4",
        "200": "#f1d991",
        "300": "#e8c463",
        "400": "#ddb043",
        "500": "#c9962c",
        "600": "#a97a22",
        "700": "#875e1d",
        "800": "#6b4a1b",
        "900": "#553b19",
        "950": "#2f200c",
      },
      yellow: {
        "50": "#fefaee",
        "100": "#fbf1cf",
        "200": "#f6e3a0",
        "300": "#f0d272",
        "400": "#e8c24f",
        "500": "#d4a935",
        "600": "#b08728",
        "700": "#8b6720",
        "800": "#6e511d",
        "900": "#58411b",
        "950": "#31230d",
      },
    },
    fonts: { sans: SANS, display: SERIF, heading: SERIF },
    pageBackground:
      "radial-gradient(circle at 30% 20%, rgba(220, 170, 54, 0.10), transparent 55%), radial-gradient(circle at 80% 85%, rgba(131, 86, 24, 0.12), transparent 55%), #15100c",
    metaColor: "#15100c",
    swatch: ["#3b2a1b", "#dcaa36", "#a3122c"],
  },
];

export const THEME_MAP = new Map(THEMES.map((t) => [t.id, t]));

export function getTheme(id: string | undefined | null): ThemeDef {
  return (id && THEME_MAP.get(id)) || THEME_MAP.get(DEFAULT_THEME_ID)!;
}

/** "#rrggbb" → "r g b" (the CSS-variable form Tailwind's <alpha-value> needs). */
export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS custom properties for a theme (pure; applied to <html> by applyTheme). */
export function themeCssVars(theme: ThemeDef): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const fam of THEMED_FAMILIES) {
    for (const [shade, hex] of Object.entries(theme.palette[fam])) {
      vars[`--c-${fam}-${shade}`] = hexToRgbTriplet(hex);
    }
  }
  vars["--font-sans"] = theme.fonts.sans;
  vars["--font-display"] = theme.fonts.display;
  vars["--font-heading"] = theme.fonts.heading;
  vars["--page-bg"] = theme.pageBackground;
  return vars;
}
