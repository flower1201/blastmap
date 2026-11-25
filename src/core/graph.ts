import path from "node:path";
import type { GraphStats, ImportEdge, ReverseHit } from "./types.js";
import { parseImports } from "./imports.js";
import { readFileSafe, walkSourceFiles } from "./walk.js";
import { toPosix } from "./pathutil.js";

export interface ImportGraph {
  files: string[];
  forward: Map<string, Set<string>>;
  reverse: Map<string, Set<string>>;
  edges: ImportEdge[];
  unresolved: Map<string, string[]>;
  stats: GraphStats;
}

function emptyAdj(): Map<string, Set<string>> {
  return new Map();
}

function ensure(map: Map<string, Set<string>>, key: string): Set<string> {
  let s = map.get(key);
  if (!s) {
    s = new Set();
    map.set(key, s);
  }
  return s;
}

/**
 * Build a lightweight forward + reverse import adjacency for a project root.
 */
export function buildGraph(rootDir: string): ImportGraph {
  const files = walkSourceFiles(rootDir);
  const known = new Set(files.map(toPosix));
  const forward = emptyAdj();
  const reverse = emptyAdj();
  const edges: ImportEdge[] = [];
  const unresolved = new Map<string, string[]>();

  for (const rel of files) {
    ensure(forward, rel);
    ensure(reverse, rel);
    const abs = path.join(rootDir, rel);
    const source = readFileSafe(abs);
    if (source === null) continue;

    const parsed = parseImports(rel, source, known);
    if (parsed.unresolved.length > 0) {
      unresolved.set(rel, parsed.unresolved);
    }
    for (const edge of parsed.edges) {
      edges.push(edge);
      ensure(forward, edge.from).add(edge.to);
      ensure(reverse, edge.to).add(edge.from);
    }
  }

  let orphanCount = 0;
  for (const f of files) {
    const out = forward.get(f)?.size ?? 0;
    const inn = reverse.get(f)?.size ?? 0;
    if (out === 0 && inn === 0) orphanCount += 1;
  }

  const filesWithEdges = files.filter(
    (f) => (forward.get(f)?.size ?? 0) + (reverse.get(f)?.size ?? 0) > 0,
  ).length;

  const stats: GraphStats = {
    fileCount: files.length,
    edgeCount: edges.length,
    orphanCount,
    coverageRatio:
      files.length === 0 ? 0 : Number((filesWithEdges / files.length).toFixed(4)),
  };

  return { files, forward, reverse, edges, unresolved, stats };
}

/**
 * Walk reverse dependents of seed files up to maxDepth.
 * Returns unique hits with shortest depth and one sample path.
 */
export function findReverseDependents(
  graph: ImportGraph,
  seeds: string[],
  maxDepth = 4,
): ReverseHit[] {
  const seedSet = new Set(seeds.map(toPosix));
  const best = new Map<string, ReverseHit>();

  type QueueItem = { file: string; depth: number; via: string[] };
  const queue: QueueItem[] = [];

  for (const seed of seedSet) {
    if (!graph.reverse.has(seed) && !graph.forward.has(seed)) {
      // still enqueue so we can find neighbors if key casing differs
    }
    queue.push({ file: seed, depth: 0, via: [seed] });
  }

  const visitedAt = new Map<string, number>();

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const prevDepth = visitedAt.get(cur.file);
    if (prevDepth !== undefined && prevDepth <= cur.depth) continue;
    visitedAt.set(cur.file, cur.depth);

    if (cur.depth > 0 && !seedSet.has(cur.file)) {
      const existing = best.get(cur.file);
      if (!existing || cur.depth < existing.depth) {
        best.set(cur.file, {
          file: cur.file,
          depth: cur.depth,
          via: cur.via,
        });
      }
    }

    if (cur.depth >= maxDepth) continue;

    const parents = graph.reverse.get(cur.file);
    if (!parents) continue;
    for (const parent of parents) {
      if (cur.via.includes(parent)) continue; // cycle guard
      queue.push({
        file: parent,
        depth: cur.depth + 1,
        via: [...cur.via, parent],
      });
    }
  }

  return [...best.values()].sort(
    (a, b) => a.depth - b.depth || a.file.localeCompare(b.file),
  );
}

export function sampleUnresolved(
  graph: ImportGraph,
  limit = 12,
): string[] {
  const samples: string[] = [];
  for (const [file, specs] of graph.unresolved) {
    for (const s of specs) {
      samples.push(`${file} → ${s}`);
      if (samples.length >= limit) return samples;
    }
  }
  return samples;
}
