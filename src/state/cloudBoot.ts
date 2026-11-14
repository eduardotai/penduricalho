// Imported FIRST in main.tsx, before anything that loads the store, so it runs
// before Zustand hydrates from localStorage:
// 1. applies a cloud restore staged by the previous page load, and
// 2. snapshots the save as it was on disk, which startCloudSave compares with
//    the cloud copy (the store rewrites the record as soon as it hydrates).
import { cloudSave, SAVE_STORAGE_KEY } from "./cloudSave";

let startupRaw: string | null = null;
try {
  cloudSave()?.applyPendingRestore();
  startupRaw = localStorage.getItem(SAVE_STORAGE_KEY);
} catch {
  startupRaw = null;
}

export const STARTUP_SAVE_RAW = startupRaw;
