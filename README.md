# blastmap

**[English](#english)** · **[中文](#中文)**

---

<a id="english"></a>

# blastmap

**See the blast radius of every change before your agent ships it.**

`blastmap` is a local-first CLI that turns git diffs (or explicit entry files) into a lightweight JS/TS import graph, walks reverse dependents, pairs likely tests, scores risk, and emits **agent-readable JSON**, Markdown, and a rich offline bilingual HTML report — no network, no LLM API.

[![License: MIT](https://img.shields.io/badge/License-MIT-0f6b5c.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.12%20%7C%7C%20%5E24-1c1b19.svg)](./package.json)
[![Version](https://img.shields.io/badge/version-0.1.0--rc.1-b45309.svg)](./package.json)
[![npm](https://img.shields.io/badge/npm-not%20published-6b6560.svg)](#pre-release-install)

> **Public beta [`v0.1.0-rc.1`](https://github.com/flower1201/blastmap/releases/tag/v0.1.0-rc.1)** — npm Registry HOLD. Install from GitHub Pre-release tarball.

## Why blastmap?

AI coding agents edit files fast. Humans (and agents) still need a cheap answer to: *what else breaks?* Full language servers and heavy ASTs are overkill for a quick pre-commit map. blastmap stays small, offline, and report-first so you can paste outputs into a review prompt or open the HTML beside your diff.

## Features

- **Git-aware analyze** — unstaged + staged (+ untracked sources) vs `HEAD`, or `--base <ref>`
- **Explicit entries** — `--entry` / `blastmap file` for surgical blast radius
- **Lightweight import graph** — relative `import` / `require` / `export … from` / `import()`
- **Reverse dependents** — configurable `--max-depth` walk with cycle guards
- **Heuristic test pairing** — co-located `*.test.*`, `__tests__`, and `tests/` mirrors
- **Risk scoring** — fan-out, depth, missing tests, foundational path hints
- **Triple output** — `blastmap.json` + `blastmap.md` + offline `blastmap.html` (EN+ZH)
- **Doctor** — coverage sanity check before you trust the map
- **Library API** — import `analyze` / `doctor` from `blastmap` in Node tooling

## Quick start

```bash
git clone https://github.com/flower1201/blastmap.git
cd blastmap
npm install
npm run build
npm test
npm run demo
```

Then against your own repo:

```bash
node /path/to/blastmap/dist/cli/index.js analyze .
# or, after npm link / tgz install:
blastmap analyze .
```

Open `./blastmap-out/blastmap.html` in a browser (fully offline).

## Pre-release install

npm Registry is **not** published. Install from the GitHub Release asset:

```bash
curl -L -o blastmap.tgz \
  https://github.com/flower1201/blastmap/releases/download/v0.1.0-rc.1/blastmap-0.1.0-rc.1.tgz

npm install ./blastmap.tgz
npx blastmap --version   # 0.1.0-rc.1
```

Or build from source and `npm pack` locally.

## CLI

```text
blastmap analyze [dir]     # default: git changed files vs HEAD
  --entry <file...>        # explicit entrypoints
  --out <dir>              # default ./blastmap-out
  --max-depth <n>          # reverse walk depth (default 4)
  --lang en|zh|both        # report language (default both)
  --base <ref>             # diff against a git ref
  --no-git                 # require --entry; skip git

blastmap file <path>       # blast radius for one file
  --root <dir>             # project root (default cwd)
  --out / --max-depth / --lang

blastmap doctor [dir]      # sanity-check graph coverage
  --out <dir>              # optional doctor.json / doctor.md

blastmap --version
```

### Examples

```bash
# Map current working tree changes
blastmap analyze .

# Compare against main
blastmap analyze . --base main

# Single module
blastmap file src/core/auth.ts --root .

# Chinese-only HTML/Markdown
blastmap analyze . --lang zh --out ./review-out

# Graph health
blastmap doctor . --out ./blastmap-out
```

## Outputs

| File | Purpose |
| --- | --- |
| `blastmap.json` | Structured result for agents / scripts |
| `blastmap.md` | Human + LLM-friendly checklist |
| `blastmap.html` | Offline bilingual UI: summary, SVG graph, risk table, checklist |

JSON includes entries, reverse dependents (with `via` paths), test pairs, per-file risk factors, graph stats, and bilingual agent checklists.

## Limitations

- **Relative imports only** — path aliases (`@/…`, `tsconfig` paths) are not resolved yet
- **Regex-based parsing** — good enough for blast radius; not a full TypeScript program analysis
- **Heuristic tests & risk** — signals, not guarantees; always verify critical paths in CI
- **JS/TS focus** — other languages are out of scope for v0.1

## Development

```bash
npm run build      # tsup → dist/
npm test           # vitest
npm run demo       # file + doctor against examples/demo-repo
npm run typecheck  # tsc --noEmit
```

Requires Node `^22.12.0 || ^24.0.0`.

## License

[MIT](./LICENSE) © flower1201

---

<a id="中文"></a>

# blastmap

**在 Agent 提交改动之前，先看清爆炸半径。**

`blastmap` 是一款本地优先的 CLI：根据 git 变更（或显式入口文件）构建轻量 JS/TS 导入图，反查依赖方、配对可能的测试、打风险分，并输出 **Agent 可读的 JSON**、Markdown，以及离线双语 HTML 报告——无网络、无 LLM API。

[![License: MIT](https://img.shields.io/badge/License-MIT-0f6b5c.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.12%20%7C%7C%20%5E24-1c1b19.svg)](./package.json)
[![Version](https://img.shields.io/badge/version-0.1.0--rc.1-b45309.svg)](./package.json)
[![npm](https://img.shields.io/badge/npm-%E6%9C%AA%E5%8F%91%E5%B8%83-6b6560.svg)](#预发布安装)

> **公开测试版 `v0.1.0-rc.1`** — npm Registry **暂不发布**。请通过本地 tarball / 源码安装。

## 为什么需要 blastmap？

AI 编码 Agent 改文件很快，人和 Agent 仍需要一个便宜的问题答案：*还会波及什么？* 完整语言服务与重型 AST 对提交前快查往往过重。blastmap 保持小巧、离线、以报告为中心，方便把结果贴进审查提示词，或在 diff 旁打开 HTML。

## 功能特性

- **感知 Git 的 analyze** — 相对 `HEAD` 的未暂存 + 已暂存（及未跟踪源文件），或 `--base <ref>`
- **显式入口** — `--entry` / `blastmap file` 精确计算爆炸半径
- **轻量导入图** — 相对路径的 `import` / `require` / `export … from` / `import()`
- **反向依赖遍历** — 可配置 `--max-depth`，带环路保护
- **启发式测试配对** — 同目录 `*.test.*`、`__tests__`、`tests/` 镜像
- **风险评分** — 扇出、深度、缺测试、基础路径提示
- **三份输出** — `blastmap.json` + `blastmap.md` + 离线 `blastmap.html`（中英）
- **doctor 诊断** — 信任地图前先看覆盖率
- **库 API** — 可在 Node 工具中 `import { analyze } from 'blastmap'`

## 快速开始

```bash
git clone https://github.com/flower1201/blastmap.git
cd blastmap
npm install
npm run build
npm test
npm run demo
```

分析你自己的仓库：

```bash
node /path/to/blastmap/dist/cli/index.js analyze .
blastmap analyze .
```

用浏览器打开 `./blastmap-out/blastmap.html`（完全离线）。

## 预发布安装

本版本 **不** 发布到 npm Registry。请打 tarball：

```bash
cd blastmap
npm install && npm run build && npm pack
npm install /path/to/blastmap-0.1.0-rc.1.tgz
npx blastmap --version
```

## 命令行

```text
blastmap analyze [dir]     # 默认：相对 HEAD 的 git 变更
  --entry <file...>        # 显式入口
  --out <dir>              # 默认 ./blastmap-out
  --max-depth <n>          # 反向遍历深度（默认 4）
  --lang en|zh|both        # 报告语言（默认 both）
  --base <ref>             # 相对某 git 引用做 diff
  --no-git                 # 跳过 git，必须提供 --entry

blastmap file <path>       # 单文件爆炸半径
blastmap doctor [dir]      # 导入图覆盖率体检
blastmap --version
```

## 输出物

| 文件 | 用途 |
| --- | --- |
| `blastmap.json` | 给 Agent / 脚本的结构化结果 |
| `blastmap.md` | 人类与 LLM 友好的清单 |
| `blastmap.html` | 离线双语界面：摘要、SVG 图、风险表、检查清单 |

## 限制

- **仅相对导入** — 暂不解析路径别名（`@/…`、`tsconfig` paths）
- **正则解析** — 适合爆炸半径快查，不是完整 TypeScript 程序分析
- **测试与风险为启发式** — 信号而非保证；关键路径请用 CI 复核
- **聚焦 JS/TS** — 其他语言不在 v0.1 范围

## 开发

```bash
npm run build
npm test
npm run demo
```

需要 Node `^22.12.0 || ^24.0.0`。

## 许可证

[MIT](./LICENSE) © flower1201

完整中文说明另见 [README.zh-CN.md](./README.zh-CN.md)。
