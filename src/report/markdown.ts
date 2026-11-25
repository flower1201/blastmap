import fs from "node:fs";
import path from "node:path";
import type { AnalyzeResult, DoctorResult, Lang } from "../core/types.js";

function riskBadge(level: string): string {
  return `\`${level}\``;
}

function sectionEn(result: AnalyzeResult): string {
  const lines: string[] = [
    `# Blastmap Report`,
    ``,
    `Generated: ${result.generatedAt}  `,
    `Version: ${result.version}  `,
    `Root: \`${result.rootDir}\``,
    ``,
    `## Summary`,
    ``,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Entries | ${result.summary.entryCount} |`,
    `| Blast nodes | ${result.summary.blastCount} |`,
    `| Reverse dependents | ${result.summary.reverseCount} |`,
    `| Test pairs | ${result.summary.testPairCount} |`,
    `| Avg risk | ${result.summary.avgRiskScore} |`,
    `| Max risk | ${riskBadge(result.summary.maxRiskLevel)} |`,
    `| Graph files / edges | ${result.summary.graph.fileCount} / ${result.summary.graph.edgeCount} |`,
    `| Coverage ratio | ${result.summary.graph.coverageRatio} |`,
    ``,
    `## Entries / Changed files`,
    ``,
  ];

  for (const e of result.entries) {
    lines.push(`- \`${e}\``);
  }

  lines.push(``, `## Risk table`, ``);
  lines.push(`| File | Score | Level | Reverse deps | Tests |`);
  lines.push(`| --- | ---: | --- | ---: | --- |`);
  for (const r of result.risks) {
    lines.push(
      `| \`${r.file}\` | ${r.score} | ${riskBadge(r.level)} | ${r.reverseDependentCount} | ${r.testCoverageHint} |`,
    );
  }

  lines.push(``, `## Reverse dependents`, ``);
  if (result.reverseDependents.length === 0) {
    lines.push(`_None detected within max depth._`);
  } else {
    for (const hit of result.reverseDependents) {
      lines.push(
        `- \`${hit.file}\` (depth ${hit.depth}) ← ${hit.via.map((v) => `\`${v}\``).join(" ← ")}`,
      );
    }
  }

  lines.push(``, `## Test pairs`, ``);
  for (const p of result.testPairs) {
    if (p.tests.length === 0) {
      lines.push(`- \`${p.source}\` → _none_ (${p.reason})`);
    } else {
      lines.push(
        `- \`${p.source}\` → ${p.tests.map((t) => `\`${t}\``).join(", ")} [${p.confidence}]`,
      );
    }
  }

  lines.push(``, `## Agent checklist`, ``);
  for (const item of result.agentChecklist) {
    lines.push(`- [ ] ${item}`);
  }
  lines.push(``);
  return lines.join("\n");
}

function sectionZh(result: AnalyzeResult): string {
  const lines: string[] = [
    `# Blastmap 报告`,
    ``,
    `生成时间：${result.generatedAt}  `,
    `版本：${result.version}  `,
    `根目录：\`${result.rootDir}\``,
    ``,
    `## 摘要`,
    ``,
    `| 指标 | 值 |`,
    `| --- | --- |`,
    `| 入口文件 | ${result.summary.entryCount} |`,
    `| 爆炸半径节点 | ${result.summary.blastCount} |`,
    `| 反向依赖 | ${result.summary.reverseCount} |`,
    `| 测试配对 | ${result.summary.testPairCount} |`,
    `| 平均风险分 | ${result.summary.avgRiskScore} |`,
    `| 最高风险 | ${riskBadge(result.summary.maxRiskLevel)} |`,
    `| 图文件 / 边 | ${result.summary.graph.fileCount} / ${result.summary.graph.edgeCount} |`,
    `| 覆盖率 | ${result.summary.graph.coverageRatio} |`,
    ``,
    `## 入口 / 变更文件`,
    ``,
  ];

  for (const e of result.entries) {
    lines.push(`- \`${e}\``);
  }

  lines.push(``, `## 风险表`, ``);
  lines.push(`| 文件 | 分数 | 等级 | 反向依赖数 | 测试 |`);
  lines.push(`| --- | ---: | --- | ---: | --- |`);
  for (const r of result.risks) {
    lines.push(
      `| \`${r.file}\` | ${r.score} | ${riskBadge(r.level)} | ${r.reverseDependentCount} | ${r.testCoverageHint} |`,
    );
  }

  lines.push(``, `## 反向依赖`, ``);
  if (result.reverseDependents.length === 0) {
    lines.push(`_在最大深度内未检测到。_`);
  } else {
    for (const hit of result.reverseDependents) {
      lines.push(
        `- \`${hit.file}\`（深度 ${hit.depth}）← ${hit.via.map((v) => `\`${v}\``).join(" ← ")}`,
      );
    }
  }

  lines.push(``, `## 测试配对`, ``);
  for (const p of result.testPairs) {
    if (p.tests.length === 0) {
      lines.push(`- \`${p.source}\` → _无_（${p.reason}）`);
    } else {
      lines.push(
        `- \`${p.source}\` → ${p.tests.map((t) => `\`${t}\``).join(", ")} [${p.confidence}]`,
      );
    }
  }

  lines.push(``, `## Agent 检查清单`, ``);
  for (const item of result.agentChecklistZh) {
    lines.push(`- [ ] ${item}`);
  }
  lines.push(``);
  return lines.join("\n");
}

export function renderMarkdown(result: AnalyzeResult, lang: Lang = "both"): string {
  if (lang === "en") return sectionEn(result);
  if (lang === "zh") return sectionZh(result);
  return `${sectionEn(result)}\n---\n\n${sectionZh(result)}`;
}

export function writeMarkdownReport(
  outDir: string,
  result: AnalyzeResult,
  lang: Lang = "both",
  filename = "blastmap.md",
): string {
  const dest = path.join(outDir, filename);
  fs.writeFileSync(dest, renderMarkdown(result, lang), "utf8");
  return dest;
}

export function renderDoctorMarkdown(result: DoctorResult, lang: Lang = "both"): string {
  const en = [
    `# Blastmap Doctor`,
    ``,
    `Root: \`${result.rootDir}\``,
    `Status: ${result.ok ? "OK" : "Needs attention"}`,
    ``,
    `## Graph stats`,
    ``,
    `- Files: ${result.graph.fileCount}`,
    `- Edges: ${result.graph.edgeCount}`,
    `- Orphans: ${result.graph.orphanCount}`,
    `- Coverage: ${result.graph.coverageRatio}`,
    ``,
    `## Extensions`,
    ``,
    ...Object.entries(result.extensions).map(([k, v]) => `- ${k}: ${v}`),
    ``,
    `## Sample unresolved`,
    ``,
    ...(result.sampleUnresolved.length
      ? result.sampleUnresolved.map((s) => `- ${s}`)
      : ["_None_"]),
    ``,
    `## Recommendations`,
    ``,
    ...result.recommendations.map((r) => `- ${r}`),
    ``,
  ].join("\n");

  const zh = [
    `# Blastmap 诊断`,
    ``,
    `根目录：\`${result.rootDir}\``,
    `状态：${result.ok ? "正常" : "需要关注"}`,
    ``,
    `## 图统计`,
    ``,
    `- 文件：${result.graph.fileCount}`,
    `- 边：${result.graph.edgeCount}`,
    `- 孤立：${result.graph.orphanCount}`,
    `- 覆盖率：${result.graph.coverageRatio}`,
    ``,
    `## 扩展名`,
    ``,
    ...Object.entries(result.extensions).map(([k, v]) => `- ${k}: ${v}`),
    ``,
    `## 未解析抽样`,
    ``,
    ...(result.sampleUnresolved.length
      ? result.sampleUnresolved.map((s) => `- ${s}`)
      : ["_无_"]),
    ``,
    `## 建议`,
    ``,
    ...result.recommendationsZh.map((r) => `- ${r}`),
    ``,
  ].join("\n");

  if (lang === "en") return en;
  if (lang === "zh") return zh;
  return `${en}\n---\n\n${zh}`;
}

export function writeDoctorMarkdown(
  outDir: string,
  result: DoctorResult,
  lang: Lang = "both",
  filename = "doctor.md",
): string {
  const dest = path.join(outDir, filename);
  fs.writeFileSync(dest, renderDoctorMarkdown(result, lang), "utf8");
  return dest;
}
