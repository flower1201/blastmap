import { execFileSync } from "node:child_process";
import path from "node:path";
import { isSourceFile, toPosix } from "./pathutil.js";

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GitError(`git ${args.join(" ")} failed: ${msg}`);
  }
}

export function isGitRepo(dir: string): boolean {
  try {
    const out = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * List changed source files relative to a base ref, or unstaged+staged vs HEAD.
 * Paths are returned as repo-relative POSIX paths.
 */
export function listChangedFiles(
  rootDir: string,
  options: { baseRef?: string } = {},
): string[] {
  if (!isGitRepo(rootDir)) {
    throw new GitError(
      `Not a git repository: ${rootDir}. Use --entry or run inside a git repo.`,
    );
  }

  const files = new Set<string>();

  if (options.baseRef) {
    const diff = runGit(rootDir, [
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      options.baseRef,
    ]);
    for (const line of diff.split(/\r?\n/)) {
      const t = line.trim();
      if (t) files.add(t);
    }
  } else {
    // Unstaged changes
    const unstaged = runGit(rootDir, [
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
    ]);
    // Staged changes
    const staged = runGit(rootDir, [
      "diff",
      "--name-only",
      "--cached",
      "--diff-filter=ACMR",
    ]);
    // Untracked source files (often part of WIP)
    const untracked = runGit(rootDir, [
      "ls-files",
      "--others",
      "--exclude-standard",
    ]);

    for (const chunk of [unstaged, staged, untracked]) {
      for (const line of chunk.split(/\r?\n/)) {
        const t = line.trim();
        if (t) files.add(t);
      }
    }
  }

  return [...files]
    .filter((f) => isSourceFile(f))
    .map((f) => toPosix(f))
    .sort();
}

/**
 * Resolve a user-provided path (absolute or relative) into a root-relative POSIX path.
 */
export function toRootRelative(rootDir: string, filePath: string): string {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(rootDir, filePath);
  return toPosix(path.relative(rootDir, abs));
}
