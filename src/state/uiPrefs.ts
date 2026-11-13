import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Small UI preferences kept apart from the game save (own localStorage key),
 * so layout choices never touch the save schema or its migrations.
 */
export interface UiPrefs {
  /** Workshop panel open (right side on desktop, bottom on mobile). Collapsed by default. */
  workshopOpen: boolean;
  /** Player has opened the workshop at least once (stops the tab's attention pulse). */
  workshopSeen: boolean;
  setWorkshopOpen: (open: boolean) => void;
  toggleWorkshop: () => void;
}

export const UI_PREFS_KEY = "penduricalho-ui-prefs";

export const useUiPrefs = create<UiPrefs>()(
  persist(
    (set) => ({
      workshopOpen: false,
      workshopSeen: false,
      setWorkshopOpen: (open) =>
        set((s) => ({ workshopOpen: open, workshopSeen: s.workshopSeen || open })),
      toggleWorkshop: () =>
        set((s) => ({ workshopOpen: !s.workshopOpen, workshopSeen: true })),
    }),
    {
      name: UI_PREFS_KEY,
      version: 1,
      partialize: (s) => ({ workshopOpen: s.workshopOpen, workshopSeen: s.workshopSeen }),
    }
  )
);
