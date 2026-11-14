import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCloudSave,
  formatCloudCode,
  parseCloudCode,
  shouldRestore,
  CLOUD_META_KEY,
  PENDING_RESTORE_KEY,
  PLAYER_ID_KEY,
  SAVE_STORAGE_KEY,
  type FetchLike,
} from "../src/state/cloudSave";
import { handleApi, type ApiEnv } from "../worker/api";

// Client side of cloud saves (src/state/cloudSave.ts), wired to the real
// worker handler over an in-memory KV so the two halves are tested together.
function memStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

function server() {
  const kv = new Map<string, string>();
  const env: ApiEnv = { SAVES: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v) } };
  let online = true;
  const fetch: FetchLike = async (input, init) => {
    if (!online) throw new TypeError("Failed to fetch");
    return handleApi(new Request(new URL(input, "https://game.example"), init as RequestInit), env);
  };
  return { kv, fetch, setOnline: (v: boolean) => (online = v) };
}

let clock = 1_000;
let seed = 1;
function device(fetch: FetchLike) {
  const storage = memStorage();
  const session = memStorage();
  const client = createCloudSave({
    storage,
    session,
    fetch,
    now: () => clock,
    randomBytes: (n) => Uint8Array.from({ length: n }, (_, i) => (seed * 31 + i * 7) & 0xff),
  });
  seed++;
  return { storage, session, client };
}

const save = (momentum: number) => JSON.stringify({ state: { momentum, totalRuns: 1 }, version: 9 });

test("cloud codes format for humans and parse back from messy input", () => {
  const id = "0123456789abcdef0123456789abcdef";
  const code = formatCloudCode(id);
  assert.equal(code, "0123-4567-89AB-CDEF-0123-4567-89AB-CDEF");
  assert.equal(parseCloudCode(` ${code.toLowerCase()} `), id);
  assert.equal(parseCloudCode(id.replace(/(.{8})/g, "$1 ")), id);
  assert.equal(parseCloudCode("0123-4567"), null);
  assert.equal(parseCloudCode("PENDURICALHO-SAVE:abc"), null);
});

test("restore only when local is missing or the cloud copy is newer", () => {
  const cloud = { updatedAt: 200, record: { state: { momentum: 5 } } };
  assert.equal(shouldRestore(null, 0, cloud), true);
  assert.equal(shouldRestore("garbage", 0, cloud), true);
  assert.equal(shouldRestore(save(1), 100, cloud), true);
  assert.equal(shouldRestore(save(1), 200, cloud), false);
  assert.equal(shouldRestore(save(1), 300, cloud), false);
  assert.equal(shouldRestore(null, 0, null), false);
});

test("the player id is a stable random 128-bit hex id", () => {
  const { client, storage } = device(server().fetch);
  const id = client.playerId();
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(client.playerId(), id);
  assert.equal(storage.getItem(PLAYER_ID_KEY), id);
});

test("sync uploads only changed saves with progress, and survives being offline", async () => {
  const srv = server();
  const { client, storage } = device(srv.fetch);
  await client.checkOnLoad(null);

  storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ state: { momentum: 0, totalRuns: 0 } }));
  assert.equal(await client.sync(), false, "fresh save without progress is not uploaded");
  assert.equal(srv.kv.size, 0);

  clock = 2_000;
  storage.setItem(SAVE_STORAGE_KEY, save(10));
  assert.equal(await client.sync(), true);
  assert.equal(srv.kv.size, 1);
  assert.equal(await client.sync(), false, "unchanged save is not re-uploaded");

  srv.setOnline(false);
  clock = 3_000;
  storage.setItem(SAVE_STORAGE_KEY, save(20));
  assert.equal(await client.sync(), false);
  assert.equal(client.getStatus().kind, "offline");
  assert.equal(storage.getItem(SAVE_STORAGE_KEY), save(20), "local save untouched");

  srv.setOnline(true);
  assert.equal(await client.sync({ keepalive: true }), true, "retried once back online");
  const stored = JSON.parse([...srv.kv.values()][0]);
  assert.equal(stored.record.state.momentum, 20);
  assert.equal(stored.updatedAt, 3_000);
});

test("a cleared browser gets its save back from the cloud on load", async () => {
  const srv = server();
  const a = device(srv.fetch);
  await a.client.checkOnLoad(null);
  clock = 5_000;
  a.storage.setItem(SAVE_STORAGE_KEY, save(77));
  await a.client.sync();

  // Same browser after "clear site data" except the id was kept (e.g. linked).
  const id = a.client.playerId();
  a.storage.clear();
  a.storage.setItem(PLAYER_ID_KEY, id);
  assert.equal(await a.client.checkOnLoad(null), "restored");
  assert.equal(a.storage.getItem(SAVE_STORAGE_KEY), save(77));
  assert.ok(a.session.getItem(PENDING_RESTORE_KEY), "staged for the next boot");

  // Next boot: the live store overwrote localStorage before unload; the staged copy wins.
  a.storage.setItem(SAVE_STORAGE_KEY, save(0));
  const reborn = createCloudSave({
    storage: a.storage,
    session: a.session,
    fetch: srv.fetch,
    now: () => clock,
    randomBytes: () => new Uint8Array(16),
  });
  reborn.applyPendingRestore();
  assert.equal(a.storage.getItem(SAVE_STORAGE_KEY), save(77));
  assert.equal(a.session.getItem(PENDING_RESTORE_KEY), null);
  assert.equal(await reborn.checkOnLoad(a.storage.getItem(SAVE_STORAGE_KEY)), "kept", "no reload loop");
});

test("a newer local save is kept and pushed; offline load keeps local", async () => {
  const srv = server();
  const a = device(srv.fetch);
  await a.client.checkOnLoad(null);
  clock = 6_000;
  a.storage.setItem(SAVE_STORAGE_KEY, save(5));
  await a.client.sync();
  clock = 7_000;
  a.storage.setItem(SAVE_STORAGE_KEY, save(9));
  await a.client.sync();
  assert.equal(await a.client.checkOnLoad(a.storage.getItem(SAVE_STORAGE_KEY)), "kept");

  srv.setOnline(false);
  assert.equal(await a.client.checkOnLoad(a.storage.getItem(SAVE_STORAGE_KEY)), "offline");
  assert.equal(a.storage.getItem(SAVE_STORAGE_KEY), save(9));
});

test("pasting a cloud code on another device loads and shares that save", async () => {
  const srv = server();
  const a = device(srv.fetch);
  const b = device(srv.fetch);
  await a.client.checkOnLoad(null);
  clock = 8_000;
  a.storage.setItem(SAVE_STORAGE_KEY, save(123));
  await a.client.sync();

  assert.deepEqual(await b.client.linkCode("nope"), { ok: false, reason: "invalid" });
  assert.deepEqual(await b.client.linkCode(formatCloudCode("f".repeat(32))), { ok: false, reason: "not_found" });

  assert.deepEqual(await b.client.linkCode(a.client.cloudCode()), { ok: true });
  assert.equal(b.storage.getItem(SAVE_STORAGE_KEY), save(123));
  assert.equal(b.client.playerId(), a.client.playerId());
  assert.equal(JSON.parse(b.storage.getItem(CLOUD_META_KEY)!).updatedAt, 8_000);
  assert.equal(await b.client.sync(), false, "suspended until the page reloads");

  srv.setOnline(false);
  assert.deepEqual(await b.client.linkCode(a.client.cloudCode()), { ok: false, reason: "offline" });
});
