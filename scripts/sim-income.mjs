// Prints the headless income table (see tests/support/incomeSim.ts).
// Usage: node scripts/sim-income.mjs [attachmentId] [siteId] [runs] [launch|hand]
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [att = "titan-cable", site = "workshop", runs = "16", mode = "launch"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dir = mkdtempSync(join(tmpdir(), "income-sim-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `import { incomeTable } from "./tests/support/incomeSim";
const rows = incomeTable(${JSON.stringify(att)}, ${JSON.stringify(site)}, ${Number(runs)}, {}, ${JSON.stringify(mode)}).sort((a, b) => a.cost - b.cost);
const fmt = rows.map((r) => ({ bob: r.id + (r.modeled ? "" : " *"), cost: r.cost, mult: r.mult, "pts/s": +r.pointsPerSec.toFixed(1), "pts/run": Math.round(r.pointsPerRun), "hits/s": +r.hitsPerSec.toFixed(2), "run s": +r.runSec.toFixed(1), combo: +r.bestCombo.toFixed(1), snap: r.snapRate, "pts/s per 1k": r.cost ? +(r.pointsPerSec / (r.cost / 1000)).toFixed(3) : null }));
if (process.argv.includes("--json")) console.log(JSON.stringify(rows)); else console.table(fmt);`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: out, bundle: true, platform: "node", format: "esm", logLevel: "warning",
});
try { await import(out); } finally { rmSync(dir, { recursive: true, force: true }); }
