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
const SAVE_CODE_PREFIX = "PENDURICALHO-SAVE:";

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

function buildSaveEnvelope(): SaveEnvelope {
  return {
    magic: EXPORT_MAGIC,
    format: EXPORT_FORMAT,
    exportedAt: Date.now(),
    payload: readCurrentPersistRecord(),
  };
}

function encodeSaveCode(envelope: SaveEnvelope): string {
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return `${SAVE_CODE_PREFIX}${btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")}`;
}

function decodeSaveCode(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(SAVE_CODE_PREFIX)) return null;
  const body = trimmed.slice(SAVE_CODE_PREFIX.length).replace(/\s+/g, "");
  const padded = body
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(body.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Serialise the current save into a paste-friendly portable save code. */
export function exportSaveString(): string {
  return encodeSaveCode(buildSaveEnvelope());
}

/** Suggested download filename, timestamped so multiple exports don't collide. */
export function exportSaveFilename(now: number = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `penduricalho-save-${stamp}.txt`;
}

/** Trigger a browser download of the current save as a paste-friendly text file. */
export function downloadSaveFile(): void {
  const data = exportSaveString();
  const blob = new Blob([data], { type: "text/plain" });
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
    parsed = JSON.parse(decodeSaveCode(text) ?? text);
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
