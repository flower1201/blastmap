import type { ImportEdge } from "./types.js";
import { resolveRelativeImport, toPosix } from "./pathutil.js";

/** Strip block comments and line comments (naive but effective for import hunting). */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const PATTERNS: Array<{
  kind: ImportEdge["kind"];
  re: RegExp;
}> = [
  {
    kind: "import",
    re: /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  },
  {
    kind: "export-from",
    re: /\bexport\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*\s*(?:as\s+\w+\s+)?)\s*from\s*['"]([^'"]+)['"]/g,
  },
  {
    kind: "require",
    re: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  },
  {
    kind: "dynamic-import",
    re: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  },
];

/**
 * Extract relative import/require/export-from specifiers from source text.
 */
export function extractSpecifiers(
  source: string,
): Array<{ specifier: string; kind: ImportEdge["kind"] }> {
  const cleaned = stripComments(source);
  const found: Array<{ specifier: string; kind: ImportEdge["kind"] }> = [];
  const seen = new Set<string>();

  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned)) !== null) {
      const specifier = m[1];
      if (!specifier) continue;
      // Relative only — package imports are out of scope for blast radius
      if (!specifier.startsWith(".")) continue;
      const key = `${kind}::${specifier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ specifier, kind });
    }
  }

  return found;
}

/**
 * Parse imports from a file and resolve them against the known file set.
 * `fromFile` and keys in `knownFiles` should be root-relative POSIX paths.
 */
export function parseImports(
  fromFile: string,
  source: string,
  knownFiles: Set<string>,
): { edges: ImportEdge[]; unresolved: string[] } {
  const edges: ImportEdge[] = [];
  const unresolved: string[] = [];
  const specs = extractSpecifiers(source);

  // Build absolute-ish lookup set: knownFiles already relative; also index by basename path
  const lookup = new Set<string>();
  for (const f of knownFiles) {
    lookup.add(toPosix(f));
  }

  for (const { specifier, kind } of specs) {
    const resolved = resolveRelativeImport(fromFile, specifier, lookup);
    if (resolved) {
      edges.push({
        from: fromFile,
        to: resolved,
        kind,
        specifier,
      });
    } else {
      unresolved.push(specifier);
    }
  }

  return { edges, unresolved };
}
