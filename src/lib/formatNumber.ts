import type { Lang } from "../i18n/lang";

/** Suffix every 10³ (thousand) — standard idle / incremental notation. */
const SUFFIXES = [
  "",
  "K",
  "M",
  "B",
  "T",
  "Qa",
  "Qi",
  "Sx",
  "Sp",
  "Oc",
  "No",
  "Dc",
  "Ud",
  "Dd",
  "Td",
  "Qad",
  "Qid",
  "Sxd",
  "Spd",
  "Ocd",
  "Nod",
  "Vg",
] as const;

/** Full tier names aligned with {@link SUFFIXES}. */
const SUFFIX_NAMES: Record<Lang, readonly string[]> = {
  en: [
    "",
    "thousand",
    "million",
    "billion",
    "trillion",
    "quadrillion",
    "quintillion",
    "sextillion",
    "septillion",
    "octillion",
    "nonillion",
    "decillion",
    "undecillion",
    "duodecillion",
    "tredecillion",
    "quattuordecillion",
    "quindecillion",
    "sexdecillion",
    "septendecillion",
    "octodecillion",
    "novemdecillion",
    "vigintillion",
  ],
  pt: [
    "",
    "mil",
    "milhão",
    "bilhão",
    "trilhão",
    "quadrilhão",
    "quintilhão",
    "sextilhão",
    "septilhão",
    "octilhão",
    "nonilhão",
    "decilhão",
    "undecilhão",
    "duodecilhão",
    "tredecilhão",
    "quatuordecilhão",
    "quindecilhão",
    "sexdecilhão",
    "septendecilhão",
    "octodecilhão",
    "novendecilhão",
    "vigintilhão",
  ],
};

const MIN_ABBREV = 1_000;

export type NumberDisplayStyle = "short" | "words";

function stripTrailingZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function decimalSeparator(lang: Lang): "." | "," {
  return lang === "pt" ? "," : ".";
}

function localizeDecimal(value: string, lang: Lang): string {
  return decimalSeparator(lang) === "," ? value.replace(".", ",") : value;
}

function localeFor(lang: Lang): string {
  return lang === "pt" ? "pt-BR" : "en-US";
}

function formatSmall(abs: number, lang: Lang): string {
  if (abs >= 100 || Number.isInteger(abs)) {
    return Math.round(abs).toLocaleString(localeFor(lang));
  }
  if (abs >= 10) return localizeDecimal(stripTrailingZeros(abs.toFixed(1)), lang);
  return localizeDecimal(stripTrailingZeros(abs.toFixed(2)), lang);
}

/** True when the value can toggle between short suffix and full name. */
export function hasAbbrevTier(n: number): boolean {
  if (!Number.isFinite(n)) return false;
  const abs = Math.abs(n);
  return abs >= MIN_ABBREV;
}

/**
 * Compact, readable number for HUD / shop / stats (e.g. 4.66 No, 1.2M).
 * With `words`, uses full names (e.g. 4.66 nonillion).
 */
export function formatNumber(
  n: number,
  style: NumberDisplayStyle = "short",
  lang: Lang = "en",
): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (abs < MIN_ABBREV) return sign + formatSmall(abs, lang);

  const tier = Math.floor(Math.log10(abs) / 3);

  if (tier >= SUFFIXES.length) {
    const exponent = Math.floor(Math.log10(abs));
    const mantissa = abs / Math.pow(10, exponent);
    const mantissaStr = localizeDecimal(stripTrailingZeros(mantissa.toFixed(2)), lang);
    if (style === "words") {
      return `${sign}${mantissaStr} × 10^${exponent.toLocaleString(localeFor(lang))}`;
    }
    return (
      sign +
      mantissaStr +
      "e" +
      exponent.toLocaleString(localeFor(lang))
    );
  }

  const scaled = abs / Math.pow(10, tier * 3);
  const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  const mantissaStr = localizeDecimal(stripTrailingZeros(scaled.toFixed(decimals)), lang);

  if (style === "words") {
    const name = SUFFIX_NAMES[lang][tier];
    return name ? `${sign}${mantissaStr} ${name}` : sign + mantissaStr;
  }

  return sign + mantissaStr + SUFFIXES[tier];
}
