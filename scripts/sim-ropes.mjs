// Headless rope table: pts/s (and snap rate) for each rope with a few bobs.
// Usage: node scripts/sim-ropes.mjs [bobIds,comma,separated] [siteId] [runs] [launch|hand]
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [bobs = "iron-bob,tungsten-heavy,chaos-bob,prism-bob", site = "workshop", runs = "10", mode = "launch"] = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), "rope-sim-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `import { incomeTable } from "./tests/support/incomeSim";
import { ATTACHMENTS } from "./src/data/attachments";
const ids = ${JSON.stringify(bobs.split(","))};
const table = {};
for (const a of [...ATTACHMENTS].filter((a) => a.behavior?.kind !== "belt").sort((x, y) => x.cost - y.cost)) {
  const rows = incomeTable(a.id, ${JSON.stringify(site)}, ${Number(runs)}, {}, ${JSON.stringify(mode)}, ids);
  table[a.id + " (" + a.cost + ")"] = Object.fromEntries(rows.map((r) => [r.id, r.pointsPerSec.toFixed(1) + (r.snapRate ? " s" + r.snapRate.toFixed(1) : "")]));
}
console.table(table);`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: out, bundle: true, platform: "node", format: "esm", logLevel: "warning",
});
try { await import(out); } finally { rmSync(dir, { recursive: true, force: true }); }
