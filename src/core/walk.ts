import fs from "node:fs";
import path from "node:path";
import { isSourceFile, shouldSkipDir, toPosix } from "./pathutil.js";

/**
 * Recursively walk a directory and collect source files as root-relative POSIX paths.
 */
export function walkSourceFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(absDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      const name = ent.name;
      if (ent.isDirectory()) {
        if (shouldSkipDir(name)) continue;
        walk(path.join(absDir, name));
        continue;
      }
      if (!ent.isFile()) continue;
      if (!isSourceFile(name)) continue;
      const abs = path.join(absDir, name);
      const rel = toPosix(path.relative(rootDir, abs));
      results.push(rel);
    }
  }

  walk(rootDir);
  return results.sort();
}

export function readFileSafe(absPath: string): string | null {
  try {
    return fs.readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
}

export function countByExtension(files: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const ext = path.extname(f).toLowerCase() || "(none)";
    counts[ext] = (counts[ext] ?? 0) + 1;
  }
  return counts;
}
