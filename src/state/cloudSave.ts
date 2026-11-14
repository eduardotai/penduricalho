// Cloud saves. The game still runs entirely from localStorage (see
// saveTransfer.ts); this module keeps a copy of the persisted record on the
// game's own server (a Cloudflare Worker backed by Workers KV, see
// worker/api.ts) so progress survives a cleared browser, a new device, or a
// change of site address.
//
// - Each browser gets a random 128-bit player id (no account, no personal
//   data). Formatted for humans it is the player's "cloud code".
// - While the tab is visible the save is uploaded at most every
//   SYNC_INTERVAL_MS when it changed, plus once when the tab is hidden/closed.
// - On load, a cloud copy that is newer than the local save (or any cloud copy
//   when there is no local save) replaces it.
// - Pasting a cloud code on another device links it to the same save.
// Every network failure is swallowed: offline the game behaves as before.
//
// Deliberately free of store imports so it can run before the store hydrates.

export const SAVE_STORAGE_KEY = "pendulum-clicker-save";
export const PLAYER_ID_KEY = "penduricalho-player-id";
export const CLOUD_META_KEY = "penduricalho-cloud-meta";
/** sessionStorage hand-off applied before the store hydrates on the next load. */
export const PENDING_RESTORE_KEY = "penduricalho-pending-restore";

export const SYNC_INTERVAL_MS = 45_000;
export const FETCH_TIMEOUT_MS = 5_000;
/** fetch keepalive bodies are capped at 64 KiB by browsers. */
const KEEPALIVE_MAX_BYTES = 60 * 1024;

const PLAYER_ID_RE = /^[0-9a-f]{32}$/;

export interface PersistRecord {
  state: Record<string, unknown>;
  version?: number;
}

export interface CloudSave {
  updatedAt: number;
  receivedAt?: number;
  record: PersistRecord;
}

interface CloudMeta {
  /** Wall-clock ms when the local save content last changed. */
  updatedAt: number;
  /** Wall-clock ms of the last successful upload or download. */
  syncedAt?: number;
}

export type CloudStatus =
  | { kind: "idle" }
  | { kind: "synced"; at: number }
  | { kind: "offline" };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface CloudDeps {
  storage: Storage;
  session?: Storage;
  fetch: FetchLike;
  now: () => number;
  randomBytes: (n: number) => Uint8Array;
  apiBase?: string;
}

// ---------------------------------------------------------------- pure helpers

export function isPlayerId(value: unknown): value is string {
  return typeof value === "string" && PLAYER_ID_RE.test(value);
}

/** `3f9a…` → `3F9A-0C1D-…` (8 groups of 4) for display and copying. */
export function formatCloudCode(playerId: string): string {
  return playerId.toUpperCase().match(/.{1,4}/g)!.join("-");
}

/** Accept a pasted cloud code with any spacing, dashes or case. */
export function parseCloudCode(text: string): string | null {
  const hex = text.replace(/[\s-]/g, "").toLowerCase();
  return isPlayerId(hex) ? hex : null;
}

function isPersistRecord(value: unknown): value is PersistRecord {
  return (
    !!value &&
    typeof value === "object" &&
    !!(value as { state?: unknown }).state &&
    typeof (value as { state?: unknown }).state === "object"
  );
}

function parseRecord(raw: string | null): PersistRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isPersistRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** A save worth keeping on the server (skips players who just bounced). */
export function hasProgress(record: PersistRecord | null): boolean {
  if (!record) return false;
  const s = record.state as Record<string, unknown>;
  const num = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : 0);
  return num("momentum") > 0 || num("totalRuns") > 0 || num("prestigeCount") > 0;
}

/**
 * Should the cloud copy replace the local save on load? Yes when there is no
 * local save at all, or when the cloud copy changed strictly later.
 */
export function shouldRestore(
  localRaw: string | null,
  localUpdatedAt: number,
  cloud: CloudSave | null
): boolean {
  if (!cloud || !isPersistRecord(cloud.record)) return false;
  if (!parseRecord(localRaw)) return true;
  return cloud.updatedAt > localUpdatedAt;
}

// ------------------------------------------------------------------- client

export function createCloudSave(deps: CloudDeps) {
  const { storage, session, now } = deps;
  const apiBase = deps.apiBase ?? "/api/save/";
  let lastSeenRaw: string | null = null;
  let lastUploadedRaw: string | null = null;
  let suspended = false;
  let status: CloudStatus = { kind: "idle" };
  const listeners = new Set<() => void>();

  function setStatus(next: CloudStatus) {
    status = next;
    listeners.forEach((l) => l());
  }

  function readMeta(): CloudMeta | null {
    try {
      const m = JSON.parse(storage.getItem(CLOUD_META_KEY) ?? "null");
      return m && typeof m.updatedAt === "number" ? m : null;
    } catch {
      return null;
    }
  }

  function writeMeta(meta: CloudMeta) {
    try {
      storage.setItem(CLOUD_META_KEY, JSON.stringify(meta));
    } catch {
      // storage full / blocked: cloud sync is best effort
    }
  }

  /** When the local save last changed (falls back to the save's own clock). */
  function localUpdatedAt(raw: string | null): number {
    const meta = readMeta();
    if (meta) return meta.updatedAt;
    const at = parseRecord(raw)?.state.lastActiveAt;
    return typeof at === "number" ? at : 0;
  }

  function playerId(): string {
    const existing = storage.getItem(PLAYER_ID_KEY);
    if (isPlayerId(existing)) return existing;
    const id = Array.from(deps.randomBytes(16), (b) => b.toString(16).padStart(2, "0")).join("");
    try {
      storage.setItem(PLAYER_ID_KEY, id);
    } catch {
      // ignore: a new id next load just starts a new cloud slot
    }
    return id;
  }

  async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : null;
    try {
      return await deps.fetch(url, { ...init, signal: ctrl?.signal, cache: "no-store" });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** GET the cloud copy. null = no save there; throws on network/server error. */
  async function fetchCloud(id: string): Promise<CloudSave | null> {
    const res = await timedFetch(apiBase + id, { headers: { accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`cloud ${res.status}`);
    const body = (await res.json()) as CloudSave;
    if (!body || typeof body.updatedAt !== "number" || !isPersistRecord(body.record)) {
      throw new Error("cloud bad body");
    }
    return body;
  }

  /** Stage a record to be applied on the next load (before the store hydrates). */
  function stageRestore(cloud: CloudSave, id: string) {
    const raw = JSON.stringify(cloud.record);
    storage.setItem(SAVE_STORAGE_KEY, raw);
    storage.setItem(PLAYER_ID_KEY, id);
    writeMeta({ updatedAt: cloud.updatedAt, syncedAt: now() });
    // The live store may still write its old state before the page unloads;
    // the session copy wins on the next boot.
    try {
      session?.setItem(PENDING_RESTORE_KEY, JSON.stringify({ raw, updatedAt: cloud.updatedAt }));
    } catch {
      // ignore
    }
    suspended = true;
  }

  /**
   * Run as the very first thing on boot, before the store module hydrates:
   * applies a restore staged by the previous page.
   */
  function applyPendingRestore(): void {
    if (!session) return;
    let pending: { raw?: unknown; updatedAt?: unknown } | null = null;
    try {
      pending = JSON.parse(session.getItem(PENDING_RESTORE_KEY) ?? "null");
      session.removeItem(PENDING_RESTORE_KEY);
    } catch {
      return;
    }
    if (!pending || typeof pending.raw !== "string" || typeof pending.updatedAt !== "number") return;
    if (!parseRecord(pending.raw)) return;
    try {
      storage.setItem(SAVE_STORAGE_KEY, pending.raw);
      writeMeta({ updatedAt: pending.updatedAt, syncedAt: now() });
    } catch {
      // ignore
    }
  }

  /** Track local changes: stamp the meta clock whenever the save content moved. */
  function noteLocalChange(): string | null {
    const raw = storage.getItem(SAVE_STORAGE_KEY);
    if (raw !== lastSeenRaw) {
      lastSeenRaw = raw;
      writeMeta({ ...(readMeta() ?? {}), updatedAt: now() });
    }
    return raw;
  }

  /** Upload when the save changed since the last successful upload. */
  async function sync(opts: { keepalive?: boolean } = {}): Promise<boolean> {
    if (suspended) return false;
    const raw = noteLocalChange();
    if (!raw || raw === lastUploadedRaw) return false;
    const record = parseRecord(raw);
    if (!hasProgress(record)) return false;
    const meta = readMeta();
    const body = JSON.stringify({ updatedAt: meta?.updatedAt ?? now(), record });
    const keepalive = !!opts.keepalive && body.length <= KEEPALIVE_MAX_BYTES;
    try {
      const init: RequestInit = {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body,
        keepalive,
      };
      const res = keepalive ? await deps.fetch(apiBase + playerId(), init) : await timedFetch(apiBase + playerId(), init);
      // 409 = the server already holds a newer copy (another device); keep
      // playing locally, the next change will be newer than it.
      if (res.ok || res.status === 409) {
        lastUploadedRaw = raw;
        if (res.ok) {
          writeMeta({ ...(readMeta() ?? { updatedAt: now() }), syncedAt: now() });
          setStatus({ kind: "synced", at: now() });
        }
        return res.ok;
      }
      setStatus({ kind: "offline" });
      return false;
    } catch {
      setStatus({ kind: "offline" });
      return false;
    }
  }

  /**
   * On load: compare with the cloud copy. Returns "restored" when the cloud
   * copy was staged and the page must reload.
   */
  async function checkOnLoad(startupRaw: string | null): Promise<"restored" | "kept" | "offline"> {
    lastSeenRaw = startupRaw;
    const id = playerId();
    let cloud: CloudSave | null;
    try {
      cloud = await fetchCloud(id);
    } catch {
      setStatus({ kind: "offline" });
      return "offline";
    }
    if (shouldRestore(startupRaw, localUpdatedAt(startupRaw), cloud)) {
      stageRestore(cloud!, id);
      return "restored";
    }
    if (cloud && startupRaw && JSON.stringify(cloud.record) === startupRaw) {
      lastUploadedRaw = startupRaw;
    }
    setStatus(cloud ? { kind: "synced", at: readMeta()?.syncedAt ?? now() } : { kind: "idle" });
    return "kept";
  }

  /** Link this device to another device's cloud code (caller reloads on ok). */
  async function linkCode(
    text: string
  ): Promise<{ ok: true } | { ok: false; reason: "invalid" | "not_found" | "offline" }> {
    const id = parseCloudCode(text);
    if (!id) return { ok: false, reason: "invalid" };
    let cloud: CloudSave | null;
    try {
      cloud = await fetchCloud(id);
    } catch {
      return { ok: false, reason: "offline" };
    }
    if (!cloud) return { ok: false, reason: "not_found" };
    stageRestore(cloud, id);
    return { ok: true };
  }

  /** A manual import/reset replaced the local save: it is now the newest. */
  function markLocalChanged() {
    writeMeta({ ...(readMeta() ?? {}), updatedAt: now() });
    lastSeenRaw = storage.getItem(SAVE_STORAGE_KEY);
  }

  return {
    playerId,
    cloudCode: () => formatCloudCode(playerId()),
    applyPendingRestore,
    checkOnLoad,
    sync,
    linkCode,
    markLocalChanged,
    getStatus: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type CloudSaveClient = ReturnType<typeof createCloudSave>;

// ----------------------------------------------------------- browser wiring

let browserClient: CloudSaveClient | null = null;

/** The app-wide client (null outside a browser, e.g. in Node tests). */
export function cloudSave(): CloudSaveClient | null {
  if (browserClient) return browserClient;
  if (typeof window === "undefined" || typeof localStorage === "undefined" || typeof fetch === "undefined") {
    return null;
  }
  let session: Storage | undefined;
  try {
    session = window.sessionStorage;
  } catch {
    session = undefined;
  }
  browserClient = createCloudSave({
    storage: localStorage,
    session,
    fetch: (input, init) => fetch(input, init),
    now: Date.now,
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
  });
  return browserClient;
}

/**
 * Start background sync. `startupRaw` is the save as it was in localStorage
 * before the store hydrated (captured by cloudBoot.ts).
 */
export function startCloudSave(startupRaw: string | null): void {
  const client = cloudSave();
  if (!client) return;
  void client.checkOnLoad(startupRaw).then((result) => {
    if (result === "restored") {
      window.location.reload();
      return;
    }
    // Push a local save that is newer than the cloud copy right away.
    void client.sync();
    setInterval(() => {
      if (document.visibilityState === "visible") void client.sync();
    }, SYNC_INTERVAL_MS);
    const flush = () => void client.sync({ keepalive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);
  });
}
