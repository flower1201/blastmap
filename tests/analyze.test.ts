import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyze, doctor } from "../src/core/analyze.js";
import { renderHtml } from "../src/report/html.js";
import { renderMarkdown } from "../src/report/markdown.js";
import { writeJsonReport } from "../src/report/json.js";

const demoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../examples/demo-repo",
);

describe("analyze orchestration", () => {
  it("maps blast radius for an entry file", () => {
    const result = analyze({
      rootDir: demoRoot,
      entries: ["src/utils/math.ts"],
      useGit: false,
      maxDepth: 4,
    });

    expect(result.entries).toEqual(["src/utils/math.ts"]);
    expect(result.reverseDependents.length).toBeGreaterThan(0);
    expect(result.risks[0]?.file).toBe("src/utils/math.ts");
    expect(result.agentChecklist.length).toBeGreaterThan(0);
    expect(result.agentChecklistZh.length).toBeGreaterThan(0);
    expect(result.summary.graph.fileCount).toBeGreaterThan(0);
  });

  it("doctor reports coverage for demo-repo", () => {
    const d = doctor(demoRoot);
    expect(d.graph.fileCount).toBeGreaterThan(0);
    expect(d.recommendations.length).toBeGreaterThan(0);
    expect(d.recommendationsZh.length).toBeGreaterThan(0);
  });

  it("emits bilingual markdown and html + json", () => {
    const result = analyze({
      rootDir: demoRoot,
      entries: ["src/utils/math.ts"],
      useGit: false,
    });

    const md = renderMarkdown(result, "both");
    expect(md).toContain("Blastmap Report");
    expect(md).toContain("Blastmap 报告");

    const html = renderHtml(result, "both");
    expect(html).toContain("blastmap");
    expect(html).toContain("中文报告");
    expect(html).toContain("<svg");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blastmap-"));
    const jsonPath = writeJsonReport(tmp, result);
    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    expect(parsed.version).toBe(result.version);
  });
});
