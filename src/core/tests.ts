import path from "node:path";
import type { TestPair } from "./types.js";
import { toPosix } from "./pathutil.js";

const TEST_DIR_HINTS = ["test", "tests", "__tests__", "spec", "__specs__"];
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const SOURCE_STRIP_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

export function isTestFile(filePath: string): boolean {
  const posix = toPosix(filePath);
  if (TEST_FILE_RE.test(posix)) return true;
  const parts = posix.split("/");
  return parts.some((p) => TEST_DIR_HINTS.includes(p.toLowerCase()));
}

function basenameNoExt(filePath: string): string {
  const base = path.basename(filePath);
  return base.replace(SOURCE_STRIP_RE, "").replace(/\.(test|spec)$/i, "");
}

function dirOf(filePath: string): string {
  return toPosix(path.dirname(filePath));
}

/**
 * Heuristic pairing of source files to likely co-located or mirrored tests.
 */
export function pairTests(
  sources: string[],
  allFiles: string[],
): TestPair[] {
  const testFiles = allFiles.filter(isTestFile);
  const pairs: TestPair[] = [];

  for (const source of sources) {
    if (isTestFile(source)) continue;

    const srcBase = basenameNoExt(source);
    const srcDir = dirOf(source);
    const hits: Array<{ test: string; confidence: TestPair["confidence"]; reason: string }> =
      [];

    for (const tf of testFiles) {
      const testBase = basenameNoExt(tf);
      const testDir = dirOf(tf);

      // Exact name match: foo.ts ↔ foo.test.ts / foo.spec.ts
      if (testBase === srcBase || testBase === `${srcBase}.test` || testBase === `${srcBase}.spec`) {
        const sameDir = testDir === srcDir;
        const mirrorDir =
          testDir.endsWith("/__tests__") &&
          testDir.replace(/\/__tests__$/, "") === srcDir;
        const testsMirror =
          (testDir.includes("/tests/") || testDir.startsWith("tests/")) &&
          testBase === srcBase;

        if (sameDir || mirrorDir) {
          hits.push({
            test: tf,
            confidence: "high",
            reason: sameDir
              ? "co-located same-basename test"
              : "__tests__ mirror of source directory",
          });
          continue;
        }
        if (testsMirror || testBase === srcBase) {
          hits.push({
            test: tf,
            confidence: "medium",
            reason: "basename match in tests/ tree",
          });
          continue;
        }
      }

      // Partial: test imports naming contains source basename
      if (
        testBase.includes(srcBase) &&
        srcBase.length >= 3 &&
        (testDir.includes("test") || TEST_FILE_RE.test(tf))
      ) {
        hits.push({
          test: tf,
          confidence: "low",
          reason: "partial basename overlap with test file",
        });
      }
    }

    // Deduplicate preferring higher confidence
    const rank = { high: 3, medium: 2, low: 1 } as const;
    hits.sort((a, b) => rank[b.confidence] - rank[a.confidence]);
    const seen = new Set<string>();
    const unique = hits.filter((h) => {
      if (seen.has(h.test)) return false;
      seen.add(h.test);
      return true;
    });

    if (unique.length === 0) {
      pairs.push({
        source,
        tests: [],
        confidence: "low",
        reason: "no heuristic test match found",
      });
    } else {
      const best = unique[0]!;
      pairs.push({
        source,
        tests: unique.map((u) => u.test),
        confidence: best.confidence,
        reason: best.reason,
      });
    }
  }

  return pairs;
}
