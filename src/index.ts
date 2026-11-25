/**
 * Public library API for blastmap.
 * Prefer the CLI for day-to-day agent workflows.
 */
export { VERSION } from "./version.js";
export { analyze, doctor, ensureOutDir } from "./core/analyze.js";
export { buildGraph, findReverseDependents } from "./core/graph.js";
export { listChangedFiles, isGitRepo } from "./core/git.js";
export { walkSourceFiles } from "./core/walk.js";
export { parseImports, extractSpecifiers, stripComments } from "./core/imports.js";
export { pairTests, isTestFile } from "./core/tests.js";
export { scoreRisks, maxRiskLevel, averageRiskScore } from "./core/risk.js";
export { writeJsonReport, writeDoctorJson } from "./report/json.js";
export { writeMarkdownReport, renderMarkdown } from "./report/markdown.js";
export { writeHtmlReport, renderHtml } from "./report/html.js";

export type {
  AnalyzeOptions,
  AnalyzeResult,
  DoctorResult,
  FileRisk,
  GraphStats,
  ImportEdge,
  Lang,
  ReverseHit,
  RiskLevel,
  TestPair,
  BlastNode,
} from "./core/types.js";
