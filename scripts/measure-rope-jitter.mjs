// Prints rope jitter metrics for the rigs in tests/support/ropeSim.ts.
// Usage: node scripts/measure-rope-jitter.mjs
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "rope-jitter-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `import { runScenario, JITTER_RIGS } from "./tests/support/ropeSim";
const rows = [];
for (const [p, a] of JITTER_RIGS) for (const s of ["rest", "swing", "grab", "release"]) {
  const r = runScenario(p, a, s);
  rows.push({ rig: p + "/" + a, scenario: s, nodeJerk: +r.nodeJerk.toFixed(3), bobJerk: +r.bobJerk.toFixed(3), flipsPerSec: +r.bobRadialFlipsPerSec.toFixed(1), strainWobble: +r.strainWobble.toFixed(4), peak: +r.peakSpeed.toFixed(1), mean: +r.meanSpeed.toFixed(1) });
}
if (process.argv.includes("--json")) console.log(JSON.stringify(rows)); else console.table(rows);`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: out, bundle: true, platform: "node", format: "esm", logLevel: "warning",
});
try { await import(out); } finally { rmSync(dir, { recursive: true, force: true }); }
