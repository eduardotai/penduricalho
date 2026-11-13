// Headless map table: pts/s per site for a few bobs on one line.
// Usage: node scripts/sim-maps.mjs [attachmentId] [bobIds,comma] [runs] [launch|hand]
// SITES=a,b limits the sites. Wall bounces are not modeled (same for every walled map).
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [att = "titan-cable", bobs = "tungsten-heavy,chaos-bob,midas-bob", runs = "10", mode = "launch"] = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), "map-sim-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `import { incomeTable } from "./tests/support/incomeSim";
import { SITES } from "./src/data/sites";
const ids = ${JSON.stringify(bobs.split(","))};
const only = ${JSON.stringify(process.env.SITES ?? "")}.split(",").filter(Boolean);
const table = {};
for (const s of SITES.filter((s) => !only.length || only.includes(s.id))) {
  const rows = incomeTable(${JSON.stringify(att)}, s.id, ${Number(runs)}, {}, ${JSON.stringify(mode)}, ids);
  table[s.id + " (" + s.cost + ")"] = Object.fromEntries(rows.map((r) => [r.id, r.pointsPerSec.toFixed(1)]));
}
console.table(table);`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: out, bundle: true, platform: "node", format: "esm", logLevel: "warning",
});
try { await import(out); } finally { rmSync(dir, { recursive: true, force: true }); }
