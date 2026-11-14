// Cloud save API for Penduricalho. Stores each player's Zustand persist record
// in Workers KV (binding SAVES) under `save:<playerId>`, so the game owner
// keeps a server-side copy of every save. No accounts, no PII: the playerId is
// a random 128-bit id generated in the browser, and knowing it is what lets a
// device read or write that save (it doubles as the player's "cloud code").

/** Minimal slice of the Workers KV API we use (keeps this file dependency-free). */
export interface SavesKV {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { metadata?: unknown }
  ): Promise<void>;
}

/** Workers Rate Limiting binding (optional: the API still works without it). */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ApiEnv {
  SAVES: SavesKV;
  SAVE_WRITE_LIMITER?: RateLimiter;
  SAVE_READ_LIMITER?: RateLimiter;
}

/** 128-bit id as 32 lowercase hex characters. */
export const PLAYER_ID_RE = /^[0-9a-f]{32}$/;
/** Upper bound on an uploaded save body. Real saves are a few KB. */
export const MAX_SAVE_BYTES = 256 * 1024;

export const saveKey = (playerId: string) => `save:${playerId}`;

/** What is stored in KV and returned by GET. */
export interface StoredSave {
  /** Client wall-clock ms when this save content was last changed. */
  updatedAt: number;
  /** Server ms when the write was accepted. */
  receivedAt: number;
  /** The Zustand persist record verbatim: `{ state: {...}, version: N }`. */
  record: { state: Record<string, unknown>; version?: number };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

const error = (status: number, code: string) => json({ error: code }, status);

/** Read at most `limit` bytes of the body; null when it is larger. */
async function readCapped(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseUpload(text: string): Pick<StoredSave, "updatedAt" | "record"> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { updatedAt, record } = parsed as { updatedAt?: unknown; record?: unknown };
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || updatedAt <= 0) {
    return null;
  }
  if (!record || typeof record !== "object") return null;
  const state = (record as { state?: unknown }).state;
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const version = (record as { version?: unknown }).version;
  if (version !== undefined && typeof version !== "number") return null;
  return {
    updatedAt,
    record: { state: state as Record<string, unknown>, ...(version !== undefined ? { version } : {}) },
  };
}

/** Same-origin writes only when the browser tells us the origin (curl sends none). */
function crossOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== url.host;
  } catch {
    return true;
  }
}

/** Handle `/api/*`. Everything else is served by the static assets. */
export async function handleApi(
  request: Request,
  env: ApiEnv,
  now: () => number = Date.now
): Promise<Response> {
  const url = new URL(request.url);
  const match = /^\/api\/save\/([^/]+)\/?$/.exec(url.pathname);
  if (!match) return error(404, "not_found");
  const playerId = match[1];
  if (!PLAYER_ID_RE.test(playerId)) return error(400, "invalid_player_id");

  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    if (env.SAVE_READ_LIMITER) {
      const { success } = await env.SAVE_READ_LIMITER.limit({ key: playerId });
      if (!success) return error(429, "rate_limited");
    }
    const value = await env.SAVES.get(saveKey(playerId));
    if (!value) return error(404, "no_save");
    return new Response(method === "HEAD" ? null : value, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  // POST is accepted too because navigator.sendBeacon can only POST.
  if (method === "PUT" || method === "POST") {
    if (crossOrigin(request, url)) return error(403, "cross_origin");
    if (env.SAVE_WRITE_LIMITER) {
      const { success } = await env.SAVE_WRITE_LIMITER.limit({ key: playerId });
      if (!success) return error(429, "rate_limited");
    }
    const text = await readCapped(request, MAX_SAVE_BYTES);
    if (text === null) return error(413, "too_large");
    const upload = parseUpload(text);
    if (!upload) return error(400, "invalid_save");

    const key = saveKey(playerId);
    // Never let a late/stale upload (e.g. a beacon from an old tab) roll a
    // newer save back.
    const existingRaw = await env.SAVES.get(key);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as StoredSave;
        if (typeof existing.updatedAt === "number" && existing.updatedAt > upload.updatedAt) {
          return json({ error: "stale", updatedAt: existing.updatedAt }, 409);
        }
      } catch {
        // Corrupt entry: overwrite it.
      }
    }
    const stored: StoredSave = { ...upload, receivedAt: now() };
    const value = JSON.stringify(stored);
    await env.SAVES.put(key, value, {
      metadata: { updatedAt: stored.updatedAt, receivedAt: stored.receivedAt, bytes: value.length },
    });
    return json({ ok: true, updatedAt: stored.updatedAt, receivedAt: stored.receivedAt });
  }

  return new Response(JSON.stringify({ error: "method_not_allowed" }), {
    status: 405,
    headers: { allow: "GET, HEAD, PUT, POST", "content-type": "application/json; charset=utf-8" },
  });
}
