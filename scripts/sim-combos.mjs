// Headless rig-combo table: each combo's bob on its line, with vs without the
// combo bonus, plus the same bob on the best non-combo line for context.
// Usage: node scripts/sim-combos.mjs [siteId] [runs] [launch|hand]
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [site = "workshop", runs = "12", mode = "launch"] = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), "combo-sim-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `import { incomeTable } from "./tests/support/incomeSim";
import { RIG_COMBOS } from "./src/data/combos";
import { ATTACHMENTS } from "./src/data/attachments";
const lines = ATTACHMENTS.filter((a) => a.behavior?.kind !== "belt");
const table = {};
const only = ${JSON.stringify(process.env.ONLY ?? "")}.split(",").filter(Boolean);
for (const c of RIG_COMBOS.filter((c) => !only.length || only.includes(c.id))) {
  const pps = (rope, on) => incomeTable(rope, ${JSON.stringify(site)}, ${Number(runs)}, {}, ${JSON.stringify(mode)}, [c.pendulumId], {}, {}, on)[0];
  const off = pps(c.attachmentId, false);
  const on = pps(c.attachmentId, true);
  let best = { id: "-", pps: 0 };
  for (const a of lines) {
    if (a.id === c.attachmentId) continue;
    const r = pps(a.id, true);
    if (r.pointsPerSec > best.pps) best = { id: a.id, pps: r.pointsPerSec };
  }
  table[c.id] = {
    rig: c.pendulumId + " + " + c.attachmentId,
    "off pts/s": off.pointsPerSec.toFixed(1),
    "combo pts/s": on.pointsPerSec.toFixed(1),
    gain: ((on.pointsPerSec / off.pointsPerSec - 1) * 100).toFixed(0) + "%",
    "snap off→on": off.snapRate.toFixed(2) + "→" + on.snapRate.toFixed(2),
    "best other line": best.id + " " + best.pps.toFixed(1),
  };
}
console.table(table);`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: out, bundle: true, platform: "node", format: "esm", logLevel: "warning",
});
try { await import(out); } finally { rmSync(dir, { recursive: true, force: true }); }
