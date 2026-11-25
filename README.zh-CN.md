# blastmap

**[English](./README.md#english)** · **[中文](#blastmap)**

# blastmap

**在 Agent 提交改动之前，先看清爆炸半径。**

`blastmap` 是一款本地优先的变更爆炸半径映射 CLI。给定 git 变更或入口文件，它会构建轻量 JS/TS 导入图、查找反向依赖、配对可能的测试、计算风险分，并输出 **Agent 可读的 JSON**、Markdown 与离线双语 HTML 报告。全程无网络、无 LLM API。

[![License: MIT](https://img.shields.io/badge/License-MIT-0f6b5c.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.12%20%7C%7C%20%5E24-1c1b19.svg)](./package.json)
[![Version](https://img.shields.io/badge/version-0.1.0--rc.1-b45309.svg)](./package.json)
[![npm](https://img.shields.io/badge/npm-%E6%9C%AA%E5%8F%91%E5%B8%83-6b6560.svg)](#预发布安装)

> **公开测试版 `v0.1.0-rc.1`** — npm Registry **暂不发布（HOLD）**。请使用本地 tarball 或源码安装。

## 为什么需要 blastmap？

AI 编码工作流里，改动来得快，审查却容易漏。blastmap 用便宜、可重复的静态启发式回答：「这个改动大概会波及谁？该跑哪些测试？风险高不高？」结果可直接喂给 Agent，也可给人打开 HTML 浏览。

## 功能特性

- Git 感知分析（未暂存 / 已暂存 / 未跟踪源文件，或 `--base`）
- 显式 `--entry` 与 `blastmap file` 单文件模式
- 相对路径导入图（import / require / export-from / dynamic import）
- 可配置深度的反向依赖遍历
- 启发式测试配对与风险评分
- JSON + Markdown + 离线双语 HTML（摘要、图、风险表、检查清单）
- `doctor` 覆盖率体检
- 可程序化调用的库 API

## 快速开始

```bash
git clone https://github.com/flower1201/blastmap.git
cd blastmap
npm install
npm run build
npm test
npm run demo
```

```bash
blastmap analyze .
# 打开 ./blastmap-out/blastmap.html
```

## 预发布安装

```bash
npm install && npm run build && npm pack
npm install ./blastmap-0.1.0-rc.1.tgz
npx blastmap --version
```

**请勿** 指望 `npm install -g blastmap`——Registry 尚未发布。

## 命令行

```text
blastmap analyze [dir]
  --entry <file...>
  --out <dir>              # 默认 ./blastmap-out
  --max-depth <n>          # 默认 4
  --lang en|zh|both        # 默认 both
  --base <ref>
  --no-git

blastmap file <path>
blastmap doctor [dir]
blastmap --version
```

### 示例

```bash
blastmap analyze .
blastmap analyze . --base main
blastmap file src/utils/math.ts --root .
blastmap analyze . --lang zh
blastmap doctor . --out ./blastmap-out
```

## 输出

| 文件 | 说明 |
| --- | --- |
| `blastmap.json` | 结构化结果，适合 Agent / 脚本 |
| `blastmap.md` | 双语 Markdown 报告与检查清单 |
| `blastmap.html` | 离线可视化：图、风险表、清单 |

## 限制

1. 仅解析**相对导入**，暂不支持 `paths` / `@/` 别名  
2. 基于正则的轻量解析，非完整类型系统分析  
3. 测试配对与风险分为启发式信号  
4. 当前聚焦 JS/TS  

## 开发

```bash
npm run build
npm test
npm run demo
npm run typecheck
```

引擎：Node `^22.12.0 || ^24.0.0`。

## 许可证

[MIT](./LICENSE) © flower1201

仓库：https://github.com/flower1201/blastmap
