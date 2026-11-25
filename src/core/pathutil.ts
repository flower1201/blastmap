import path from "node:path";

const SOURCE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "out",
  "blastmap-out",
]);

export function isSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return (SOURCE_EXTS as readonly string[]).includes(ext);
}

export function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith(".");
}

export function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

export function relativePosix(from: string, to: string): string {
  return toPosix(path.relative(from, to));
}

export function normalizeRoot(rootDir: string): string {
  return path.resolve(rootDir);
}

/**
 * Resolve a relative import specifier against the importing file.
 * Tries common extension / index resolution patterns.
 */
export function resolveRelativeImport(
  fromFile: string,
  specifier: string,
  knownFiles: Set<string>,
): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return null;
  }

  const fromDir = path.dirname(fromFile);
  const raw = path.normalize(path.join(fromDir, specifier));
  const candidates: string[] = [];

  // Exact path
  candidates.push(raw);

  // With extensions
  for (const ext of SOURCE_EXTS) {
    candidates.push(raw + ext);
  }

  // Index files inside directory
  for (const ext of SOURCE_EXTS) {
    candidates.push(path.join(raw, `index${ext}`));
  }

  // Strip existing extension then re-add (foo.js -> foo.ts)
  const ext = path.extname(raw);
  if (ext) {
    const base = raw.slice(0, -ext.length);
    for (const e of SOURCE_EXTS) {
      candidates.push(base + e);
    }
  }

  for (const c of candidates) {
    const posix = toPosix(c);
    if (knownFiles.has(posix)) return posix;
    // also try absolute-normalized form as stored
    const abs = toPosix(path.resolve(c));
    if (knownFiles.has(abs)) return abs;
  }

  return null;
}

export { SOURCE_EXTS, SKIP_DIRS };
