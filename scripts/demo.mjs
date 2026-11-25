#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli", "index.js");
const demoRepo = path.join(root, "examples", "demo-repo");
const outDir = path.join(root, "blastmap-out", "demo");

if (!fs.existsSync(cli)) {
  console.error("dist/cli/index.js missing — run npm run build first");
  process.exit(1);
}

function run(args) {
  console.log(`\n> node dist/cli/index.js ${args.join(" ")}`);
  const r = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run([
  "file",
  "src/utils/math.ts",
  "--root",
  demoRepo,
  "--out",
  outDir,
  "--lang",
  "both",
]);

run(["doctor", demoRepo, "--out", outDir]);

console.log("\nDemo complete.");
console.log(`Open: ${path.join(outDir, "blastmap.html")}`);
