// Export every cloud save from Workers KV into one JSON file.
//   node scripts/export-saves.mjs [out.json]
// Needs `npx wrangler login` on the account that owns the namespace.
// Output: { exportedAt, count, saves: { "<playerId>": { updatedAt, receivedAt, record } } }
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NAMESPACE_ID = "7919aa396e984961aa59b0ea4690476d";
const out = process.argv[2] ?? `penduricalho-saves-${new Date().toISOString().slice(0, 10)}.json`;
const wrangler = (args) =>
  execFileSync("npx", ["wrangler", ...args, "--namespace-id", NAMESPACE_ID, "--remote"], {
    encoding: "utf8",
    maxBuffer: 1 << 30,
    stdio: ["ignore", "pipe", "inherit"],
  });

// `kv key list` pages through every key itself.
const keys = JSON.parse(wrangler(["kv", "key", "list", "--prefix", "save:"])).map((k) => k.name);
const saves = {};
const tmp = mkdtempSync(join(tmpdir(), "penduricalho-export-"));
try {
  // `kv bulk get` reads up to 100 keys per call.
  for (let i = 0; i < keys.length; i += 100) {
    const file = join(tmp, "keys.json");
    writeFileSync(file, JSON.stringify(keys.slice(i, i + 100)));
    const batch = JSON.parse(wrangler(["kv", "bulk", "get", file]));
    for (const [key, entry] of Object.entries(batch)) {
      const value = typeof entry === "string" ? entry : entry?.value;
      if (!value) continue;
      saves[key.slice("save:".length)] = typeof value === "string" ? JSON.parse(value) : value;
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
writeFileSync(out, JSON.stringify({ exportedAt: new Date().toISOString(), count: Object.keys(saves).length, saves }, null, 2));
console.log(`Exported ${Object.keys(saves).length} saves to ${out}`);
