import fs from "fs";
import path from "path";

const TRANSCRIPT_ROOT =
  "C:/Users/taken/.cursor/projects/c-Users-taken-penduricalho/agent-transcripts";
const OUT_ROOT = "C:/Users/taken/penduricalho";

// Process oldest → newest; later wins
const UUID_ORDER = [
  "f8294938",
  "d51c3dc4",
  "5b0c0482",
  "cc948c37",
  "8682bb74",
  "87186795",
  "eb6e5989",
  "094493d0",
  "b3b9e1ae",
  "8682bb74",
  "c532651c",
  "7b1a34fa",
  "8d961461",
  "e25da613",
  "abc9431f",
];

const SKIP_REL_PREFIXES = ["src/game/rope/"];

const PENDULUM_PREF = (c) =>
  c.includes("applyAttachmentPhysics") && !c.includes("buildRope");

function relFromPath(p) {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.indexOf("/src/");
  return idx === -1 ? null : norm.slice(idx + 1);
}

function uuidRank(filePath) {
  const base = path.basename(path.dirname(filePath));
  const id = base.split("-")[0];
  const i = UUID_ORDER.indexOf(id);
  return i === -1 ? 0 : i + 1;
}

function walkJsonl(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJsonl(p, out);
    else if (p.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

const files = walkJsonl(TRANSCRIPT_ROOT).sort((a, b) => {
  const ra = uuidRank(a);
  const rb = uuidRank(b);
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
});

const latest = new Map();

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("Write")) continue;
    let j;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    for (const c of j.message?.content ?? []) {
      if (c.name !== "Write") continue;
      const rel = relFromPath(c.input?.path ?? "");
      if (!rel || !rel.startsWith("src/")) continue;
      if (SKIP_REL_PREFIXES.some((p) => rel.startsWith(p))) continue;
      const contents = c.input?.contents;
      if (typeof contents !== "string" || contents.length < 20) continue;

      if (rel === "src/game/pendulum.ts" && !PENDULUM_PREF(contents)) continue;

      latest.set(rel, {
        contents,
        source: `${file}:${i + 1}`,
      });
    }
  }
}

// Never overwrite patch-applied deploy files from generic writes
const PATCH_KEEP = new Set([
  "src/components/ControlPanel.tsx",
  "src/components/GameCanvas.tsx",
  "src/game/hitZones.ts",
  "src/state/store.ts",
]);

const written = [];
for (const [rel, { contents, source }] of latest) {
  if (PATCH_KEEP.has(rel)) continue;
  const dest = path.join(OUT_ROOT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
  written.push({ rel, source, bytes: contents.length });
}

console.log(JSON.stringify({ written }, null, 2));
