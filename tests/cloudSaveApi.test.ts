import { test } from "node:test";
import assert from "node:assert/strict";
import { handleApi, MAX_SAVE_BYTES, saveKey, type ApiEnv } from "../worker/api";

// Cloud save API (worker/api.ts) against an in-memory KV.
function memoryEnv(opts: { limited?: boolean } = {}) {
  const data = new Map<string, string>();
  const env: ApiEnv = {
    SAVES: {
      get: async (k) => data.get(k) ?? null,
      put: async (k, v) => void data.set(k, v),
    },
    SAVE_WRITE_LIMITER: { limit: async () => ({ success: !opts.limited }) },
  };
  return { env, data };
}

const ID = "0123456789abcdef0123456789abcdef";
const URL_BASE = "https://penduricalho.example/api/save/";
const record = { state: { momentum: 42, totalRuns: 3 }, version: 9 };

const put = (env: ApiEnv, body: unknown, id = ID, headers: Record<string, string> = {}) =>
  handleApi(
    new Request(URL_BASE + id, {
      method: "PUT",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
    () => 1_000
  );
const get = (env: ApiEnv, id = ID) => handleApi(new Request(URL_BASE + id), env);

test("PUT then GET round-trips the persist record with its timestamps", async () => {
  const { env, data } = memoryEnv();
  const res = await put(env, { updatedAt: 500, record });
  assert.equal(res.status, 200);
  assert.ok(data.has(saveKey(ID)));
  const back = await get(env);
  assert.equal(back.status, 200);
  assert.equal(back.headers.get("cache-control"), "no-store");
  assert.deepEqual(await back.json(), { updatedAt: 500, receivedAt: 1_000, record });
});

test("GET of an unknown player is 404, malformed ids are 400", async () => {
  const { env } = memoryEnv();
  assert.equal((await get(env)).status, 404);
  for (const bad of ["abc", ID.toUpperCase(), ID + "0", "zz" + ID.slice(2)]) {
    assert.equal((await get(env, bad)).status, 400, bad);
    assert.equal((await put(env, { updatedAt: 1, record }, bad)).status, 400, bad);
  }
});

test("bodies over the cap are rejected with 413 and nothing is stored", async () => {
  const { env, data } = memoryEnv();
  const huge = JSON.stringify({ updatedAt: 1, record: { state: { pad: "x".repeat(MAX_SAVE_BYTES) } } });
  const res = await put(env, huge);
  assert.equal(res.status, 413);
  assert.equal(data.size, 0);
});

test("non-save JSON is rejected", async () => {
  const { env, data } = memoryEnv();
  for (const body of ["not json", { record }, { updatedAt: 1 }, { updatedAt: 1, record: { state: [] } }, { updatedAt: "1", record }]) {
    assert.equal((await put(env, body)).status, 400, JSON.stringify(body));
  }
  assert.equal(data.size, 0);
});

test("an older upload never rolls back a newer cloud save", async () => {
  const { env } = memoryEnv();
  await put(env, { updatedAt: 900, record });
  const stale = await put(env, { updatedAt: 800, record: { state: { momentum: 1 } } });
  assert.equal(stale.status, 409);
  const back = (await (await get(env)).json()) as { record: typeof record };
  assert.equal(back.record.state.momentum, 42);
});

test("cross-origin writes, rate-limited writes and other methods are refused", async () => {
  const { env } = memoryEnv();
  assert.equal((await put(env, { updatedAt: 1, record }, ID, { origin: "https://evil.example" })).status, 403);
  assert.equal((await put(env, { updatedAt: 1, record }, ID, { origin: "https://penduricalho.example" })).status, 200);
  assert.equal((await put(memoryEnv({ limited: true }).env, { updatedAt: 1, record })).status, 429);
  assert.equal((await handleApi(new Request(URL_BASE + ID, { method: "DELETE" }), env)).status, 405);
  assert.equal((await handleApi(new Request("https://penduricalho.example/api/other"), env)).status, 404);
});
