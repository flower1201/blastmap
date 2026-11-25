import fs from "node:fs";
import path from "node:path";
import type { AnalyzeResult, Lang } from "../core/types.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function levelClass(level: string): string {
  return `lvl-${esc(level)}`;
}

/**
 * Build a simple SVG force-ish layout (deterministic circular) for blast nodes.
 */
function renderGraphSvg(result: AnalyzeResult): string {
  const nodes = result.blastRadius.slice(0, 40);
  if (nodes.length === 0) {
    return `<p class="muted">No nodes to visualize.</p>`;
  }

  const W = 720;
  const H = 420;
  const cx = W / 2;
  const cy = H / 2;
  const entries = nodes.filter((n) => n.role === "entry");
  const others = nodes.filter((n) => n.role !== "entry");

  const positions = new Map<string, { x: number; y: number }>();

  // Entries near center
  entries.forEach((n, i) => {
    const angle = (i / Math.max(entries.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const r = entries.length === 1 ? 0 : 48;
    positions.set(n.file, {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  });

  others.forEach((n, i) => {
    const angle = (i / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const ring = 90 + Math.min(n.depth, 4) * 42;
    positions.set(n.file, {
      x: cx + Math.cos(angle) * ring,
      y: cy + Math.sin(angle) * ring,
    });
  });

  // Edges from via paths
  const edgeSet = new Set<string>();
  const edgeLines: string[] = [];
  for (const hit of result.reverseDependents) {
    for (let i = 0; i < hit.via.length - 1; i++) {
      const a = hit.via[i]!;
      const b = hit.via[i + 1]!;
      const key = `${a}=>${b}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      const pa = positions.get(a);
      const pb = positions.get(b);
      if (!pa || !pb) continue;
      edgeLines.push(
        `<line x1="${pa.x.toFixed(1)}" y1="${pa.y.toFixed(1)}" x2="${pb.x.toFixed(1)}" y2="${pb.y.toFixed(1)}" class="edge" />`,
      );
    }
  }

  const circles = nodes
    .map((n) => {
      const p = positions.get(n.file)!;
      const short = n.file.split("/").pop() ?? n.file;
      const cls =
        n.role === "entry"
          ? "node entry"
          : n.role === "test"
            ? "node test"
            : "node dep";
      return [
        `<g class="${cls}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})">`,
        `<circle r="${n.role === "entry" ? 10 : 7}" />`,
        `<title>${esc(n.file)} (${n.role}, depth ${n.depth})</title>`,
        `<text y="22" text-anchor="middle">${esc(short.slice(0, 18))}</text>`,
        `</g>`,
      ].join("");
    })
    .join("\n");

  return `
<svg viewBox="0 0 ${W} ${H}" class="graph" role="img" aria-label="Blast radius graph">
  <rect width="${W}" height="${H}" class="graph-bg" rx="8" />
  ${edgeLines.join("\n")}
  ${circles}
</svg>
<div class="legend">
  <span><i class="dot entry"></i> Entry</span>
  <span><i class="dot dep"></i> Dependent</span>
  <span><i class="dot test"></i> Test</span>
</div>`;
}

function riskRows(result: AnalyzeResult): string {
  return result.risks
    .map(
      (r) => `
<tr>
  <td><code>${esc(r.file)}</code></td>
  <td class="num">${r.score}</td>
  <td><span class="pill ${levelClass(r.level)}">${esc(r.level)}</span></td>
  <td class="num">${r.reverseDependentCount}</td>
  <td>${esc(r.testCoverageHint)}</td>
  <td class="factors">${r.factors.map((f) => esc(f)).join("; ")}</td>
</tr>`,
    )
    .join("\n");
}

function checklistHtml(items: string[]): string {
  return `<ul class="checklist">${items
    .map((i) => `<li><label><input type="checkbox" /> ${esc(i)}</label></li>`)
    .join("\n")}</ul>`;
}

function reverseList(result: AnalyzeResult): string {
  if (result.reverseDependents.length === 0) {
    return `<p class="muted">None within max depth.</p>`;
  }
  return `<ul class="path-list">${result.reverseDependents
    .map(
      (h) =>
        `<li><code>${esc(h.file)}</code> <span class="muted">depth ${h.depth}</span><div class="via">${h.via
          .map((v) => `<code>${esc(v)}</code>`)
          .join(' <span class="arrow">←</span> ')}</div></li>`,
    )
    .join("\n")}</ul>`;
}

function testPairsHtml(result: AnalyzeResult): string {
  return `<ul class="pair-list">${result.testPairs
    .map((p) => {
      const tests =
        p.tests.length === 0
          ? `<span class="muted">none</span>`
          : p.tests.map((t) => `<code>${esc(t)}</code>`).join(", ");
      return `<li><code>${esc(p.source)}</code> → ${tests} <span class="pill soft">${esc(p.confidence)}</span></li>`;
    })
    .join("\n")}</ul>`;
}

const CSS = `
:root {
  --bg: #f6f4ef;
  --bg-elev: #ffffff;
  --ink: #1c1b19;
  --muted: #6b6560;
  --line: #e4dfd6;
  --accent: #0f6b5c;
  --accent-2: #b45309;
  --danger: #9f1239;
  --warn: #a16207;
  --ok: #166534;
  --font: "Segoe UI", "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
  --mono: "Cascadia Code", "SF Mono", Consolas, ui-monospace, monospace;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: var(--font);
  color: var(--ink);
  background:
    radial-gradient(900px 420px at 10% -10%, #e8f2ef 0%, transparent 55%),
    radial-gradient(700px 380px at 100% 0%, #f3ebe0 0%, transparent 50%),
    var(--bg);
  line-height: 1.55;
}
a { color: var(--accent); }
header.app {
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg-elev) 88%, transparent);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.wrap { max-width: 1080px; margin: 0 auto; padding: 1.25rem 1.5rem; }
header .brand {
  display: flex; align-items: baseline; gap: .75rem; flex-wrap: wrap;
}
header h1 {
  font-size: 1.35rem; margin: 0; letter-spacing: -0.02em; font-weight: 700;
}
header .tag {
  font-size: .75rem; color: var(--muted);
  border: 1px solid var(--line); border-radius: 999px; padding: .15rem .55rem;
}
.meta { color: var(--muted); font-size: .9rem; margin-top: .35rem; }
nav.langs { margin-left: auto; display: flex; gap: .5rem; }
nav.langs a {
  text-decoration: none; font-size: .85rem; padding: .25rem .6rem;
  border-radius: 6px; border: 1px solid var(--line); color: var(--ink); background: var(--bg-elev);
}
nav.langs a:hover { border-color: var(--accent); color: var(--accent); }
.bar {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
}
main { padding-bottom: 3rem; }
section {
  background: var(--bg-elev);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1.25rem 1.35rem;
  margin: 1.1rem 0;
  box-shadow: 0 1px 0 rgba(28,27,25,.03);
}
section h2 {
  margin: 0 0 .85rem;
  font-size: 1.05rem;
  letter-spacing: -0.015em;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: .75rem;
}
.stat {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: .75rem .85rem;
}
.stat .k { font-size: .75rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.stat .v { font-size: 1.35rem; font-weight: 650; margin-top: .15rem; font-variant-numeric: tabular-nums; }
table {
  width: 100%; border-collapse: collapse; font-size: .9rem;
}
th, td {
  text-align: left; padding: .55rem .45rem; border-bottom: 1px solid var(--line);
  vertical-align: top;
}
th { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); font-weight: 600; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
td.factors { color: var(--muted); font-size: .82rem; }
code {
  font-family: var(--mono); font-size: .84em;
  background: #f0ebe3; padding: .1rem .3rem; border-radius: 4px;
}
.pill {
  display: inline-block; font-size: .72rem; font-weight: 650;
  padding: .12rem .45rem; border-radius: 999px; text-transform: uppercase; letter-spacing: .03em;
}
.pill.soft { background: #efeae2; color: var(--muted); text-transform: none; font-weight: 550; }
.lvl-low { background: #dcfce7; color: var(--ok); }
.lvl-medium { background: #fef3c7; color: var(--warn); }
.lvl-high { background: #ffedd5; color: var(--accent-2); }
.lvl-critical { background: #ffe4e6; color: var(--danger); }
.muted { color: var(--muted); }
.checklist { list-style: none; padding: 0; margin: 0; }
.checklist li { margin: .4rem 0; }
.checklist label { display: flex; gap: .5rem; align-items: flex-start; cursor: pointer; }
.path-list, .pair-list { list-style: none; padding: 0; margin: 0; }
.path-list li, .pair-list li {
  padding: .55rem 0; border-bottom: 1px solid var(--line);
}
.via { margin-top: .25rem; font-size: .85rem; }
.arrow { color: var(--muted); }
.graph { width: 100%; height: auto; display: block; }
.graph-bg { fill: #faf8f4; stroke: var(--line); }
.edge { stroke: #c4bbb0; stroke-width: 1.25; opacity: .85; }
.node circle { stroke: #fff; stroke-width: 2; }
.node text { font-size: 10px; fill: var(--muted); font-family: var(--font); }
.node.entry circle { fill: var(--accent); }
.node.dep circle { fill: #57534e; }
.node.test circle { fill: var(--accent-2); }
.legend { display: flex; gap: 1rem; margin-top: .6rem; font-size: .85rem; color: var(--muted); }
.legend .dot {
  display: inline-block; width: .65rem; height: .65rem; border-radius: 50%; margin-right: .35rem;
}
.legend .dot.entry { background: var(--accent); }
.legend .dot.dep { background: #57534e; }
.legend .dot.test { background: var(--accent-2); }
footer {
  color: var(--muted); font-size: .8rem; text-align: center; padding: 1rem 0 2rem;
}
.lang-block { scroll-margin-top: 72px; }
@media (max-width: 700px) {
  .wrap { padding: 1rem; }
  td.factors { display: none; }
}
`;

function renderLangBlock(
  id: string,
  title: string,
  result: AnalyzeResult,
  checklist: string[],
  labels: {
    summary: string;
    graph: string;
    risk: string;
    reverse: string;
    tests: string;
    agent: string;
    entries: string;
    file: string;
    score: string;
    level: string;
    rev: string;
    testsCol: string;
    factors: string;
  },
): string {
  return `
<section class="lang-block" id="${id}">
  <h2>${esc(title)}</h2>
  <p class="muted">${esc(labels.entries)}: ${result.entries.map((e) => `<code>${esc(e)}</code>`).join(" ")}</p>

  <h3 style="margin-top:1.1rem;font-size:.95rem">${esc(labels.summary)}</h3>
  <div class="grid">
    <div class="stat"><div class="k">Entries</div><div class="v">${result.summary.entryCount}</div></div>
    <div class="stat"><div class="k">Blast</div><div class="v">${result.summary.blastCount}</div></div>
    <div class="stat"><div class="k">Reverse</div><div class="v">${result.summary.reverseCount}</div></div>
    <div class="stat"><div class="k">Avg risk</div><div class="v">${result.summary.avgRiskScore}</div></div>
    <div class="stat"><div class="k">Max</div><div class="v"><span class="pill ${levelClass(result.summary.maxRiskLevel)}">${esc(result.summary.maxRiskLevel)}</span></div></div>
    <div class="stat"><div class="k">Edges</div><div class="v">${result.summary.graph.edgeCount}</div></div>
  </div>

  <h3 style="margin-top:1.25rem;font-size:.95rem">${esc(labels.graph)}</h3>
  ${renderGraphSvg(result)}

  <h3 style="margin-top:1.25rem;font-size:.95rem">${esc(labels.risk)}</h3>
  <div style="overflow-x:auto">
  <table>
    <thead>
      <tr>
        <th>${esc(labels.file)}</th>
        <th>${esc(labels.score)}</th>
        <th>${esc(labels.level)}</th>
        <th>${esc(labels.rev)}</th>
        <th>${esc(labels.testsCol)}</th>
        <th>${esc(labels.factors)}</th>
      </tr>
    </thead>
    <tbody>
      ${riskRows(result)}
    </tbody>
  </table>
  </div>

  <h3 style="margin-top:1.25rem;font-size:.95rem">${esc(labels.reverse)}</h3>
  ${reverseList(result)}

  <h3 style="margin-top:1.25rem;font-size:.95rem">${esc(labels.tests)}</h3>
  ${testPairsHtml(result)}

  <h3 style="margin-top:1.25rem;font-size:.95rem">${esc(labels.agent)}</h3>
  ${checklistHtml(checklist)}
</section>`;
}

export function renderHtml(result: AnalyzeResult, lang: Lang = "both"): string {
  const showEn = lang === "en" || lang === "both";
  const showZh = lang === "zh" || lang === "both";

  const enBlock = showEn
    ? renderLangBlock("en", "English report", result, result.agentChecklist, {
        summary: "Summary",
        graph: "Blast graph",
        risk: "Risk table",
        reverse: "Reverse dependents",
        tests: "Test pairs",
        agent: "Agent checklist",
        entries: "Entries",
        file: "File",
        score: "Score",
        level: "Level",
        rev: "Rev deps",
        testsCol: "Tests",
        factors: "Factors",
      })
    : "";

  const zhBlock = showZh
    ? renderLangBlock("zh", "中文报告", result, result.agentChecklistZh, {
        summary: "摘要",
        graph: "爆炸半径图",
        risk: "风险表",
        reverse: "反向依赖",
        tests: "测试配对",
        agent: "Agent 检查清单",
        entries: "入口",
        file: "文件",
        score: "分数",
        level: "等级",
        rev: "反向依赖",
        testsCol: "测试",
        factors: "因素",
      })
    : "";

  const nav =
    lang === "both"
      ? `<nav class="langs"><a href="#en">English</a><a href="#zh">中文</a></nav>`
      : lang === "zh"
        ? `<nav class="langs"><a href="#zh">中文</a></nav>`
        : `<nav class="langs"><a href="#en">English</a></nav>`;

  return `<!DOCTYPE html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="generator" content="blastmap ${esc(result.version)}" />
<title>blastmap — blast radius report</title>
<style>${CSS}</style>
</head>
<body>
<header class="app">
  <div class="wrap bar">
    <div>
      <div class="brand">
        <h1>blastmap</h1>
        <span class="tag">v${esc(result.version)}</span>
        <span class="tag">offline</span>
      </div>
      <div class="meta">${esc(result.generatedAt)} · <code>${esc(result.rootDir)}</code></div>
    </div>
    ${nav}
  </div>
</header>
<main class="wrap">
${enBlock}
${zhBlock}
</main>
<footer>blastmap — local-first change blast-radius mapper · MIT · no network</footer>
</body>
</html>`;
}

export function writeHtmlReport(
  outDir: string,
  result: AnalyzeResult,
  lang: Lang = "both",
  filename = "blastmap.html",
): string {
  const dest = path.join(outDir, filename);
  fs.writeFileSync(dest, renderHtml(result, lang), "utf8");
  return dest;
}
