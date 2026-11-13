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


const SHADE_STEPS: Shade[] = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (n: number, sh: number) => (n >> sh) & 255;
  const m = (sh: number) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t);
  return `#${((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)}`;
}

/**
 * Builds a full 50–950 ramp from anchor shades (any subset that includes 50
 * and 950), interpolating the missing ones in RGB between their neighbours.
 */
export function ramp(anchors: Partial<Palette> & { "50": string; "950": string }): Palette {
  const out = {} as Palette;
  const known = SHADE_STEPS.filter((s) => anchors[s]);
  for (const [i, s] of SHADE_STEPS.entries()) {
    if (anchors[s]) {
      out[s] = anchors[s]!;
      continue;
    }
    const lo = [...known].reverse().find((k) => SHADE_STEPS.indexOf(k) < i)!;
    const hi = known.find((k) => SHADE_STEPS.indexOf(k) > i)!;
    const li = SHADE_STEPS.indexOf(lo);
    const hiI = SHADE_STEPS.indexOf(hi);
    out[s] = mixHex(anchors[lo]!, anchors[hi]!, (i - li) / (hiI - li));
  }
  return out;
}

const SANS = '"Inter Variable", ui-sans-serif, system-ui, sans-serif';
const SERIF = '"Fraunces Variable", Georgia, ui-serif, serif';
const CINZEL = '"Cinzel Variable", Georgia, ui-serif, serif';
const ORBITRON = '"Orbitron Variable", "Inter Variable", ui-sans-serif, sans-serif';

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
  {
    id: "observatory",
    name: { en: "Observatory", pt: "Observatório" },
    description: {
      en: "Midnight sky and silver: twinkling stars, a turning star chart, an armillary pivot and planets for circles.",
      pt: "Céu da meia-noite e prata: estrelas cintilando, carta celeste girando, pivô armilar e planetas no lugar dos círculos.",
    },
    cost: 60_000,
    palette: {
      slate: ramp({
        "50": "#f4f6fd",
        "100": "#e6ebf8",
        "200": "#cdd5ee",
        "400": "#8d99c4",
        "600": "#4a5584",
        "800": "#1b2247",
        "900": "#10163a",
        "950": "#070a1f",
      }),
      // Starlight silver-blue.
      brand: ramp({
        "50": "#f1f6ff",
        "200": "#cfe0ff",
        "300": "#aac6ff",
        "400": "#82a7ff",
        "500": "#5f86f0",
        "600": "#4766d1",
        "800": "#2a3a86",
        "950": "#111842",
      }),
      amber: ramp({ "50": "#fffaf0", "300": "#ffe3a8", "500": "#f2c46b", "700": "#a87f35", "950": "#30220a" }),
      yellow: ramp({ "50": "#fffdf0", "300": "#fff0a8", "500": "#f2dc6b", "700": "#a89535", "950": "#302a0a" }),
    },
    fonts: { sans: SANS, display: CINZEL, heading: CINZEL },
    pageBackground:
      "radial-gradient(circle at 25% 15%, rgba(95, 134, 240, 0.12), transparent 55%), radial-gradient(circle at 80% 85%, rgba(176, 75, 214, 0.10), transparent 55%), #070a1f",
    metaColor: "#070a1f",
    swatch: ["#0d1433", "#82a7ff", "#f2c25c"],
  },
  {
    id: "neon",
    name: { en: "Neon Arcade", pt: "Fliperama Neon" },
    description: {
      en: "Synthwave night: striped sun, scrolling grid, scanlines, a neon-tube pivot and glowing rings.",
      pt: "Noite synthwave: sol listrado, grade em movimento, scanlines, pivô de tubo neon e anéis brilhantes.",
    },
    cost: 100_000,
    palette: {
      slate: ramp({
        "50": "#fbf3ff",
        "100": "#f3e3fb",
        "200": "#e2c6f2",
        "400": "#a77fc2",
        "600": "#5c3a78",
        "800": "#2a1240",
        "900": "#1a0a2a",
        "950": "#0c0316",
      }),
      // Hot magenta.
      brand: ramp({
        "50": "#fff0fb",
        "200": "#ffc2ee",
        "300": "#ff94e0",
        "400": "#ff5fd3",
        "500": "#f532c0",
        "600": "#d01ea0",
        "800": "#7c0f60",
        "950": "#33042a",
      }),
      // Accents go electric cyan so they pop against magenta.
      amber: ramp({ "50": "#effeff", "300": "#9ff6ff", "500": "#3fe0f2", "700": "#1a8a99", "950": "#062a30" }),
      yellow: ramp({ "50": "#f7fff0", "300": "#d6ff9f", "500": "#a8f23f", "700": "#5f991a", "950": "#1c3006" }),
    },
    fonts: { sans: SANS, display: ORBITRON, heading: ORBITRON },
    pageBackground:
      "radial-gradient(circle at 50% 70%, rgba(255, 63, 209, 0.14), transparent 55%), radial-gradient(circle at 20% 10%, rgba(63, 242, 255, 0.08), transparent 50%), #0c0316",
    metaColor: "#0c0316",
    swatch: ["#3a0a4a", "#ff3fd1", "#3ff2ff"],
  },
  {
    id: "greenhouse",
    name: { en: "Greenhouse", pt: "Estufa" },
    description: {
      en: "A Victorian glasshouse at dusk: iron arches, light shafts, swaying ferns, a copper hook and garden berries.",
      pt: "Uma estufa vitoriana ao entardecer: arcos de ferro, feixes de luz, samambaias balançando, gancho de cobre e frutinhas do jardim.",
    },
    cost: 150_000,
    palette: {
      slate: ramp({
        "50": "#f3f8f3",
        "100": "#e4efe5",
        "200": "#c9dccb",
        "400": "#8aa891",
        "600": "#4a6653",
        "800": "#1f3328",
        "900": "#14231b",
        "950": "#0a140f",
      }),
      // Polished copper.
      brand: ramp({
        "50": "#fdf4ee",
        "200": "#f6d2bb",
        "300": "#eeae88",
        "400": "#e28a5c",
        "500": "#cc6c3d",
        "600": "#ad552e",
        "800": "#6e3320",
        "950": "#2e140b",
      }),
      // Honey.
      amber: ramp({ "50": "#fffaeb", "300": "#f8de8a", "500": "#e6b445", "700": "#9c7525", "950": "#2c1f08" }),
      yellow: ramp({ "50": "#fbfdea", "300": "#e6f08a", "500": "#c4d645", "700": "#7f8f25", "950": "#232a08" }),
    },
    fonts: { sans: SANS, display: SERIF, heading: SERIF },
    pageBackground:
      "radial-gradient(circle at 25% 10%, rgba(243, 230, 176, 0.10), transparent 55%), radial-gradient(circle at 80% 85%, rgba(63, 143, 74, 0.12), transparent 55%), #0a140f",
    metaColor: "#0a140f",
    swatch: ["#16302a", "#cc6c3d", "#8f1028"],
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
