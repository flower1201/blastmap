import { Command } from "commander";
import { z } from "zod";
import { VERSION } from "../version.js";
import { analyze, doctor, ensureOutDir } from "../core/analyze.js";
import { LangSchema } from "../core/types.js";
import { writeDoctorJson } from "../report/json.js";
import { writeDoctorMarkdown } from "../report/markdown.js";
import {
  emitReports,
  parseEntries,
  printEmitSummary,
  resolveRoot,
} from "./helpers.js";

const program = new Command();

program
  .name("blastmap")
  .description(
    "Local-first change blast-radius mapper for AI coding workflows",
  )
  .version(VERSION, "-V, --version", "print blastmap version");

program
  .command("analyze")
  .description(
    "Map blast radius from git changes (default) and/or explicit --entry files",
  )
  .argument("[dir]", "project root", ".")
  .option(
    "--entry <file...>",
    "explicit entrypoint file(s) (relative or absolute)",
  )
  .option("--out <dir>", "output directory", "./blastmap-out")
  .option("--max-depth <n>", "reverse dependency walk depth", "4")
  .option("--lang <lang>", "report language: en | zh | both", "both")
  .option(
    "--base <ref>",
    "diff against git ref instead of unstaged+staged vs HEAD",
  )
  .option("--no-git", "do not read git changes (require --entry)")
  .action((dir: string, opts: Record<string, unknown>) => {
    try {
      const lang = LangSchema.parse(opts.lang ?? "both");
      const maxDepth = z.coerce.number().int().min(1).max(32).parse(opts.maxDepth);
      const rootDir = resolveRoot(dir);
      const entries = parseEntries(opts.entry);

      const result = analyze({
        rootDir,
        entries: entries.length ? entries : undefined,
        baseRef: opts.base ? String(opts.base) : undefined,
        maxDepth,
        lang,
        outDir: String(opts.out),
        useGit: opts.git !== false,
      });

      const paths = emitReports(result, {
        outDir: String(opts.out),
        lang,
      });

      console.log(
        `blastmap analyze · entries=${result.summary.entryCount} · reverse=${result.summary.reverseCount} · maxRisk=${result.summary.maxRiskLevel} (${result.summary.avgRiskScore})`,
      );
      printEmitSummary(paths);
    } catch (err) {
      console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });

program
  .command("file")
  .description("Compute blast radius for a single file")
  .argument("<path>", "source file path")
  .option("--out <dir>", "output directory", "./blastmap-out")
  .option("--max-depth <n>", "reverse dependency walk depth", "4")
  .option("--lang <lang>", "report language: en | zh | both", "both")
  .option(
    "--root <dir>",
    "project root (default: cwd, or parent guess)",
  )
  .action((filePath: string, opts: Record<string, unknown>) => {
    try {
      const lang = LangSchema.parse(opts.lang ?? "both");
      const maxDepth = z.coerce.number().int().min(1).max(32).parse(opts.maxDepth);
      const rootDir = resolveRoot(opts.root ? String(opts.root) : undefined);

      const result = analyze({
        rootDir,
        entries: [filePath],
        maxDepth,
        lang,
        useGit: false,
      });

      const paths = emitReports(result, {
        outDir: String(opts.out),
        lang,
      });

      console.log(
        `blastmap file · ${result.entries[0]} · reverse=${result.summary.reverseCount} · risk=${result.risks[0]?.level ?? "n/a"}`,
      );
      printEmitSummary(paths);
    } catch (err) {
      console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });

program
  .command("doctor")
  .description("Sanity-check import graph coverage for a directory")
  .argument("[dir]", "project root", ".")
  .option("--out <dir>", "optional output directory for doctor reports")
  .option("--lang <lang>", "report language: en | zh | both", "both")
  .action((dir: string, opts: Record<string, unknown>) => {
    try {
      const lang = LangSchema.parse(opts.lang ?? "both");
      const rootDir = resolveRoot(dir);
      const result = doctor(rootDir);

      console.log(`blastmap doctor · ${result.ok ? "OK" : "ATTENTION"}`);
      console.log(`  root      ${result.rootDir}`);
      console.log(
        `  files     ${result.graph.fileCount}  edges ${result.graph.edgeCount}  orphans ${result.graph.orphanCount}`,
      );
      console.log(`  coverage  ${result.graph.coverageRatio}`);
      for (const r of result.recommendations) {
        console.log(`  • ${r}`);
      }

      if (opts.out) {
        const outDir = ensureOutDir(String(opts.out));
        writeDoctorJson(outDir, result);
        writeDoctorMarkdown(outDir, result, lang);
        console.log(`  wrote doctor reports to ${outDir}`);
      }

      if (!result.ok) process.exitCode = 2;
    } catch (err) {
      console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
