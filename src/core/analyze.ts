import fs from "node:fs";
import path from "node:path";
import { VERSION } from "../version.js";
import { listChangedFiles, toRootRelative } from "./git.js";
import { buildGraph, findReverseDependents } from "./graph.js";
import { pairTests, isTestFile } from "./tests.js";
import { averageRiskScore, maxRiskLevel, scoreRisks } from "./risk.js";
import { normalizeRoot, toPosix } from "./pathutil.js";
import type {
  AnalyzeOptions,
  AnalyzeResult,
  BlastNode,
  DoctorResult,
  Lang,
} from "./types.js";
import { sampleUnresolved } from "./graph.js";
import { countByExtension } from "./walk.js";

function buildChecklist(
  result: Omit<AnalyzeResult, "agentChecklist" | "agentChecklistZh">,
): { en: string[]; zh: string[] } {
  const high = result.risks.filter(
    (r) => r.level === "high" || r.level === "critical",
  );
  const missingTests = result.testPairs.filter((p) => p.tests.length === 0);

  const en: string[] = [
    `Review ${result.entries.length} entry/changed file(s) before merging.`,
    `Inspect ${result.reverseDependents.length} reverse dependent(s) for unintended breakage.`,
  ];
  const zh: string[] = [
    `合并前复查 ${result.entries.length} 个入口/变更文件。`,
    `检查 ${result.reverseDependents.length} 个反向依赖，防止意外破坏。`,
  ];

  if (high.length > 0) {
    en.push(
      `Prioritize high/critical risk files: ${high.map((h) => h.file).join(", ")}.`,
    );
    zh.push(
      `优先处理高/严重风险文件：${high.map((h) => h.file).join(", ")}。`,
    );
  }

  if (missingTests.length > 0) {
    en.push(
      `Add or locate tests for: ${missingTests
        .slice(0, 5)
        .map((m) => m.source)
        .join(", ")}${missingTests.length > 5 ? "…" : ""}.`,
    );
    zh.push(
      `为以下文件补充或定位测试：${missingTests
        .slice(0, 5)
        .map((m) => m.source)
        .join(", ")}${missingTests.length > 5 ? "…" : ""}。`,
    );
  } else {
    en.push("Run paired tests listed in the report before shipping.");
    zh.push("发布前运行报告中列出的配对测试。");
  }

  en.push(
    "Treat this map as a heuristic — verify critical paths manually or with CI.",
  );
  zh.push("本图为启发式结果，关键路径请人工或 CI 复核。");

  return { en, zh };
}

/**
 * Orchestrate blast-radius analysis for a project directory.
 */
export function analyze(options: AnalyzeOptions): AnalyzeResult {
  const rootDir = normalizeRoot(options.rootDir);
  const maxDepth = options.maxDepth ?? 4;
  const useGit = options.useGit !== false;

  let changedFiles: string[] = [];
  if (useGit) {
    try {
      changedFiles = listChangedFiles(rootDir, { baseRef: options.baseRef });
    } catch (err) {
      // If git fails and entries provided, continue with entries only
      if (!options.entries?.length) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `${msg} Pass --entry <file...> or ensure the directory is a git repo.`,
        );
      }
    }
  }

  const entrySet = new Set<string>();
  for (const e of options.entries ?? []) {
    entrySet.add(toRootRelative(rootDir, e));
  }
  for (const c of changedFiles) {
    entrySet.add(toPosix(c));
  }

  const entries = [...entrySet].sort();
  if (entries.length === 0) {
    throw new Error(
      "No entry or changed files found. Modify sources, pass --entry, or use --base <ref>.",
    );
  }

  const graph = buildGraph(rootDir);
  const reverseDependents = findReverseDependents(graph, entries, maxDepth);

  const testPairs = pairTests(
    entries.filter((e) => !isTestFile(e)),
    graph.files,
  );
  const risks = scoreRisks(entries, reverseDependents, testPairs);

  const blastRadius: BlastNode[] = [];
  for (const e of entries) {
    blastRadius.push({
      file: e,
      role: isTestFile(e) ? "test" : "entry",
      depth: 0,
      risk: risks.find((r) => r.file === e),
    });
  }
  for (const hit of reverseDependents) {
    blastRadius.push({
      file: hit.file,
      role: isTestFile(hit.file) ? "test" : "dependent",
      depth: hit.depth,
    });
  }

  // Include paired tests as blast nodes if not already present
  const present = new Set(blastRadius.map((b) => b.file));
  for (const pair of testPairs) {
    for (const t of pair.tests) {
      if (!present.has(t)) {
        blastRadius.push({ file: t, role: "test", depth: 0 });
        present.add(t);
      }
    }
  }

  const partial: Omit<AnalyzeResult, "agentChecklist" | "agentChecklistZh"> = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    rootDir,
    entries,
    changedFiles,
    blastRadius,
    reverseDependents,
    testPairs,
    risks,
    summary: {
      entryCount: entries.length,
      blastCount: blastRadius.length,
      reverseCount: reverseDependents.length,
      testPairCount: testPairs.filter((p) => p.tests.length > 0).length,
      avgRiskScore: averageRiskScore(risks),
      maxRiskLevel: maxRiskLevel(risks),
      graph: graph.stats,
    },
  };

  const checklist = buildChecklist(partial);

  return {
    ...partial,
    agentChecklist: checklist.en,
    agentChecklistZh: checklist.zh,
  };
}

/**
 * Sanity-check graph coverage for a directory.
 */
export function doctor(rootDirInput: string): DoctorResult {
  const rootDir = normalizeRoot(rootDirInput);
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new Error(`Not a directory: ${rootDir}`);
  }

  const graph = buildGraph(rootDir);
  const sample = sampleUnresolved(graph, 15);
  const extensions = countByExtension(graph.files);

  const recommendations: string[] = [];
  const recommendationsZh: string[] = [];

  if (graph.stats.fileCount === 0) {
    recommendations.push(
      "No JS/TS source files found. Check the directory path and extensions.",
    );
    recommendationsZh.push(
      "未找到 JS/TS 源文件。请检查目录路径与扩展名。",
    );
  } else if (graph.stats.coverageRatio < 0.2) {
    recommendations.push(
      "Low import-edge coverage — many files look isolated. Prefer relative imports for local modules.",
    );
    recommendationsZh.push(
      "导入边覆盖率偏低——许多文件看似孤立。本地模块请优先使用相对路径导入。",
    );
  } else {
    recommendations.push("Import graph coverage looks reasonable for a heuristic scanner.");
    recommendationsZh.push("启发式扫描下的导入图覆盖率看起来合理。");
  }

  if (sample.length > 0) {
    recommendations.push(
      `${sample.length}+ unresolved relative imports sampled — check path aliases (not supported yet).`,
    );
    recommendationsZh.push(
      `抽样到 ${sample.length}+ 个未解析相对导入——路径别名暂不支持。`,
    );
  }

  if (graph.stats.orphanCount > graph.stats.fileCount * 0.5) {
    recommendations.push(
      "More than half of files have zero edges — consider entry flags for key modules.",
    );
    recommendationsZh.push(
      "超过一半文件没有任何边——可对关键模块使用 --entry。",
    );
  }

  const ok =
    graph.stats.fileCount > 0 &&
    (graph.stats.edgeCount > 0 || graph.stats.fileCount < 3);

  return {
    rootDir,
    graph: graph.stats,
    sampleUnresolved: sample,
    extensions,
    recommendations,
    recommendationsZh,
    ok,
  };
}

export function ensureOutDir(outDir: string): string {
  const abs = path.resolve(outDir);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

export type { Lang };
