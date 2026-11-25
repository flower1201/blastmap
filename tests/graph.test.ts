import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGraph, findReverseDependents } from "../src/core/graph.js";

const demoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../examples/demo-repo",
);

describe("import graph", () => {
  it("builds forward and reverse edges for demo-repo", () => {
    const graph = buildGraph(demoRoot);
    expect(graph.stats.fileCount).toBeGreaterThanOrEqual(6);
    expect(graph.stats.edgeCount).toBeGreaterThanOrEqual(4);
    expect(graph.forward.get("src/core.ts")?.has("src/utils/math.ts")).toBe(
      true,
    );
    expect(graph.reverse.get("src/utils/math.ts")?.has("src/core.ts")).toBe(
      true,
    );
  });

  it("finds reverse dependents of math.ts", () => {
    const graph = buildGraph(demoRoot);
    const hits = findReverseDependents(graph, ["src/utils/math.ts"], 4);
    const files = hits.map((h) => h.file);
    expect(files).toContain("src/utils/format.ts");
    expect(files).toContain("src/core.ts");
    expect(files.some((f) => f.includes("service") || f.includes("index"))).toBe(
      true,
    );
  });
});
