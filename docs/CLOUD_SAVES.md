# Cloud saves

Players' saves are backed up to Workers KV so the game owner holds a copy and a
future migration (new domain, new host) can't lose them.

## How it works

- Worker: `worker/index.ts` serves `./dist` as before; only `/api/*` runs the
  Worker first (`run_worker_first`). API in `worker/api.ts`:
  - `GET /api/save/<playerId>` → `{ updatedAt, receivedAt, record }` or 404.
  - `PUT` (or `POST`) `/api/save/<playerId>` with `{ updatedAt, record }`.
  - `playerId` must be 32 lowercase hex chars (400 otherwise). Bodies over
    256 KB → 413. Uploads older than the stored copy → 409. Browser writes from
    another origin → 403. Per-player rate limits (≈20 writes / 30 reads per
    minute per Cloudflare location) → 429.
- KV namespace `penduricalho-saves`, id `7919aa396e984961aa59b0ea4690476d`,
  binding `SAVES`. One key per player: `save:<playerId>`, with metadata
  `{ updatedAt, receivedAt, bytes }`.
- Client: `src/state/cloudSave.ts` (+ `cloudBoot.ts`, first import in
  `main.tsx`). A random 128-bit player id is kept in localStorage
  (`penduricalho-player-id`). The save is uploaded right after load when it
  changed, then at most every 45 s while the tab is visible, and once on
  hide/close (`fetch` keepalive). On load a newer cloud copy (or any cloud copy
  when there is no local save) replaces the local save. Settings → Save shows
  the player's cloud code and lets them paste one from another device. All
  failures are silent; offline the game works from localStorage as before.
- Saves without progress (momentum, runs and prestige all 0) are not uploaded.

## Export / inspect all saves

```sh
# all saves into one JSON file ({ count, saves: { <playerId>: {...} } })
npm run export-saves -- penduricalho-saves.json

# list keys (with updatedAt metadata)
npx wrangler kv key list --namespace-id 7919aa396e984961aa59b0ea4690476d --remote --prefix save:

# one save
npx wrangler kv key get "save:<playerId>" --namespace-id 7919aa396e984961aa59b0ea4690476d --remote
```

To move to another KV namespace/account, export, then `wrangler kv bulk put`
a file of `[{ "key": "save:<id>", "value": "<JSON string>" }]`.

## Costs

Included in Workers Paid: 10M KV reads and 1M writes per month. An active
player writes roughly once a minute while the tab is open (~60/hour), so
~1M writes ≈ 16k player-hours per month. Above that, KV writes cost
US$5 per extra million.
