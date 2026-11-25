import path from "node:path";
import type { AnalyzeResult, Lang } from "../core/types.js";
import { ensureOutDir } from "../core/analyze.js";
import { writeJsonReport } from "../report/json.js";
import { writeMarkdownReport } from "../report/markdown.js";
import { writeHtmlReport } from "../report/html.js";

export interface EmitOptions {
  outDir: string;
  lang: Lang;
}

export function emitReports(
  result: AnalyzeResult,
  options: EmitOptions,
): { json: string; md: string; html: string; outDir: string } {
  const outDir = ensureOutDir(options.outDir);
  const json = writeJsonReport(outDir, result);
  const md = writeMarkdownReport(outDir, result, options.lang);
  const html = writeHtmlReport(outDir, result, options.lang);
  return { json, md, html, outDir };
}

export function printEmitSummary(paths: {
  json: string;
  md: string;
  html: string;
  outDir: string;
}): void {
  console.log(`Wrote reports to ${paths.outDir}`);
  console.log(`  JSON     ${path.basename(paths.json)}`);
  console.log(`  Markdown ${path.basename(paths.md)}`);
  console.log(`  HTML     ${path.basename(paths.html)}`);
}

export function parseEntries(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
}

export function resolveRoot(dir?: string): string {
  return path.resolve(dir ?? process.cwd());
}
