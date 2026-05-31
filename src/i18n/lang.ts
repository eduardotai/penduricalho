// Supported UI languages. Kept dependency-free so both the store and the i18n
// hooks can import the `Lang` type without a circular import.
export type Lang = "en" | "pt";

export const DEFAULT_LANG: Lang = "en";

export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "pt", label: "Português" },
];

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "pt";
}
