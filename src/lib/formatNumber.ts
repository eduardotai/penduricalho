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

/** Full -illion names aligned with {@link SUFFIXES}. */
const SUFFIX_NAMES = [
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
] as const;

const MIN_ABBREV = 1_000;

export type NumberDisplayStyle = "short" | "words";

function stripTrailingZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatSmall(abs: number): string {
  if (abs >= 100 || Number.isInteger(abs)) {
    return Math.round(abs).toLocaleString("en-US");
  }
  if (abs >= 10) return stripTrailingZeros(abs.toFixed(1));
  return stripTrailingZeros(abs.toFixed(2));
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
): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (abs < MIN_ABBREV) return sign + formatSmall(abs);

  const tier = Math.floor(Math.log10(abs) / 3);

  if (tier >= SUFFIXES.length) {
    const exponent = Math.floor(Math.log10(abs));
    const mantissa = abs / Math.pow(10, exponent);
    const mantissaStr = stripTrailingZeros(mantissa.toFixed(2));
    if (style === "words") {
      return `${sign}${mantissaStr} × 10^${exponent.toLocaleString("en-US")}`;
    }
    return (
      sign +
      mantissaStr +
      "e" +
      exponent.toLocaleString("en-US")
    );
  }

  const scaled = abs / Math.pow(10, tier * 3);
  const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  const mantissaStr = stripTrailingZeros(scaled.toFixed(decimals));

  if (style === "words") {
    const name = SUFFIX_NAMES[tier];
    return name ? `${sign}${mantissaStr} ${name}` : sign + mantissaStr;
  }

  return sign + mantissaStr + SUFFIXES[tier];
}
