// Headless modifier table: pts/s with each modifier active for a whole run,
// relative to no modifier (see tests/support/incomeSim.ts for what is modeled).
// Usage: node scripts/sim-modifiers.mjs [attachmentId] [siteId] [runs] [bobIds,comma,separated]
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [att = "hemp-rope", site = "workshop", runs = "12", bobs = "brass-bob,iron-bob,tungsten-heavy"] = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), "mod-sim-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `import { incomeTable } from "./tests/support/incomeSim";
import { MODIFIERS } from "./src/data/modifiers";
const ids = ${JSON.stringify(bobs.split(","))};
const base = new Map(incomeTable(${JSON.stringify(att)}, ${JSON.stringify(site)}, ${Number(runs)}, {}, "launch", ids).map((r) => [r.id, r]));
const table = {};
for (const m of MODIFIERS) {
  const rows = incomeTable(${JSON.stringify(att)}, ${JSON.stringify(site)}, ${Number(runs)}, {}, "launch", ids, {}, m.effects);
  table[m.id] = Object.fromEntries(rows.map((r) => [r.id, ((r.pointsPerSec / base.get(r.id).pointsPerSec - 1) * 100).toFixed(0) + "% (" + r.runSec.toFixed(1) + "s, snap " + r.snapRate.toFixed(2) + ")"]));
}
table["(none) pts/s"] = Object.fromEntries([...base].map(([id, r]) => [id, r.pointsPerSec.toFixed(1) + " (" + r.runSec.toFixed(1) + "s, snap " + r.snapRate.toFixed(2) + ")"]));
console.table(table);`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: out, bundle: true, platform: "node", format: "esm", logLevel: "warning",
});
try { await import(out); } finally { rmSync(dir, { recursive: true, force: true }); }
