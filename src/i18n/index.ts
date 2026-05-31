import { useGameStore } from "../state/store";
import { STRINGS, type UIStrings } from "./strings";

export type { Lang } from "./lang";
export { LANGUAGES, DEFAULT_LANG, isLang } from "./lang";
export { locName, locDesc, type ContentCategory } from "./content";

/** Current UI language from the store. Re-renders on change. */
export function useLang() {
  return useGameStore((s) => s.language);
}

/** Localized UI string bundle for the active language. */
export function useT(): UIStrings {
  const lang = useGameStore((s) => s.language);
  return STRINGS[lang];
}
