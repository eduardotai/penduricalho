import { useGameStore } from "./store";

// Key the Zustand `persist` middleware writes the save under (see store.ts).
// The save lives ONLY here, in the player's own browser localStorage — it is
// never sent anywhere. Export/import below is the only way to move it between
// browsers or devices, and it stays fully under the player's control (a file
// they download, or text they copy).
export const SAVE_STORAGE_KEY = "pendulum-clicker-save";

// Envelope wrapper around the raw persisted record. The magic + format let us
// recognise our own files and reject unrelated JSON a player might paste in.
const EXPORT_MAGIC = "penduricalho-save";
const EXPORT_FORMAT = 1;

interface SaveEnvelope {
  magic: typeof EXPORT_MAGIC;
  format: number;
  // Wall-clock time the file was produced, for the player's reference.
  exportedAt: number;
  // The Zustand persist record verbatim: `{ state: {...}, version: N }`.
  payload: PersistRecord;
}

interface PersistRecord {
  state: Record<string, unknown>;
  version?: number;
}

export type ImportResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "invalid" | "unrecognized" };

function isPersistRecord(value: unknown): value is PersistRecord {
  return (
    !!value &&
    typeof value === "object" &&
    "state" in value &&
    typeof (value as { state: unknown }).state === "object" &&
    (value as { state: unknown }).state !== null
  );
}

/**
 * Flush the live store to localStorage, then return the raw persisted record.
 * Zustand's persist writes synchronously on each state change, but a brand-new
 * player who has never triggered a write may not have a stored entry yet — a
 * no-op set guarantees one exists and is current before we read it.
 */
function readCurrentPersistRecord(): PersistRecord {
  useGameStore.setState((s) => ({ lastActiveAt: s.lastActiveAt }));
  const raw = localStorage.getItem(SAVE_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isPersistRecord(parsed)) return parsed;
    } catch {
      // fall through to an empty record below
    }
  }
  return { state: {} };
}

/** Serialise the current save into a portable, human-readable JSON string. */
export function exportSaveString(): string {
  const envelope: SaveEnvelope = {
    magic: EXPORT_MAGIC,
    format: EXPORT_FORMAT,
    exportedAt: Date.now(),
    payload: readCurrentPersistRecord(),
  };
  return JSON.stringify(envelope, null, 2);
}

/** Suggested download filename, timestamped so multiple exports don't collide. */
export function exportSaveFilename(now: number = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `penduricalho-save-${stamp}.json`;
}

/** Trigger a browser download of the current save as a .json file. */
export function downloadSaveFile(): void {
  const data = exportSaveString();
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportSaveFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Pull a persisted record out of arbitrary text. Accepts either one of our
 * exported envelopes or a bare persist record (so a player can paste the raw
 * localStorage value too). Returns null when the text isn't a recognisable
 * save.
 */
function parseImport(text: string): PersistRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  // Our own envelope.
  if (
    parsed &&
    typeof parsed === "object" &&
    (parsed as { magic?: unknown }).magic === EXPORT_MAGIC
  ) {
    const payload = (parsed as SaveEnvelope).payload;
    return isPersistRecord(payload) ? payload : null;
  }
  // A bare persist record pasted directly.
  if (isPersistRecord(parsed)) return parsed;
  return null;
}

/**
 * Validate and apply an imported save. On success the new save is written to
 * localStorage and the caller should reload the page so the store rehydrates
 * cleanly (migrations + cosmetic normalisation run on load). We deliberately
 * reload rather than live-patch so an in-progress run, camera, and world state
 * can't end up in a half-updated state.
 */
export function importSaveString(text: string): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  const record = parseImport(trimmed);
  if (!record) return { ok: false, reason: "invalid" };
  // Light sanity check: a real save carries at least one known field.
  const knownKeys = ["momentum", "owned", "equipped", "stats"];
  if (!knownKeys.some((k) => k in record.state)) {
    return { ok: false, reason: "unrecognized" };
  }
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true };
}
