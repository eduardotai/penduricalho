// Minimal test runner: bundles tests/*.test.ts with esbuild (already used by
// Vite) and runs them with Node's built-in test runner. No extra test deps.
import { build } from "esbuild";
import { readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const testDir = "tests";
const files = readdirSync(testDir).filter((f) => f.endsWith(".test.ts"));
const outDir = mkdtempSync(join(tmpdir(), "penduricalho-tests-"));
try {
  await build({
    entryPoints: files.map((f) => join(testDir, f)),
    outdir: outDir,
    bundle: true,
    platform: "node",
    format: "esm",
    outExtension: { ".js": ".mjs" },
    logLevel: "warning",
  });
  const outs = files.map((f) => join(outDir, f.replace(/\.ts$/, ".mjs")));
  const r = spawnSync(process.execPath, ["--test", ...outs], { stdio: "inherit" });
  process.exitCode = r.status ?? 1;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
