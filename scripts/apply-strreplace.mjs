import fs from "fs";
import path from "path";

const TRANSCRIPT_DIRS = process.argv.slice(2);
const OUT_ROOT = "C:/Users/taken/penduricalho";

function relFromPath(p) {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.indexOf("/src/");
  return idx === -1 ? null : norm.slice(idx + 1);
}

const ops = [];

function collect(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("StrReplace")) continue;
    let j;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    for (const c of j.message?.content ?? []) {
      if (c.name !== "StrReplace") continue;
      const rel = relFromPath(c.input?.path ?? "");
      if (!rel || !rel.startsWith("src/")) continue;
      const { old_string: oldStr, new_string: newStr } = c.input ?? {};
      if (!oldStr || newStr === undefined) continue;
      ops.push({ rel, oldStr, newStr, source: `${file}:${i + 1}` });
    }
  }
}

for (const dir of TRANSCRIPT_DIRS) {
  if (fs.statSync(dir).isFile()) collect(dir);
  else {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        for (const f of fs.readdirSync(p)) {
          if (f.endsWith(".jsonl")) collect(path.join(p, f));
        }
      } else if (p.endsWith(".jsonl")) collect(p);
    }
  }
}

const applied = [];
const failed = [];

for (const { rel, oldStr, newStr, source } of ops) {
  const dest = path.join(OUT_ROOT, rel);
  if (!fs.existsSync(dest)) {
    failed.push({ rel, source, reason: "missing file" });
    continue;
  }
  let content = fs.readFileSync(dest, "utf8");
  if (!content.includes(oldStr)) {
    failed.push({ rel, source, reason: "old_string not found" });
    continue;
  }
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(dest, content);
  applied.push({ rel, source });
}

console.log(JSON.stringify({ applied: applied.length, failed: failed.length, failedSample: failed.slice(0, 30) }, null, 2));
