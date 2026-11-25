import type { FileRisk, ReverseHit, RiskLevel, TestPair } from "./types.js";
import { isTestFile } from "./tests.js";

function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

/**
 * Score blast-radius risk for each entry / changed file.
 *
 * Factors (additive, capped at 100):
 * - reverse dependent fan-out
 * - depth reach (deep chains)
 * - missing tests
 * - "core-ish" path hints (index, core, lib, shared, utils)
 * - file is itself a test (lower weight)
 */
export function scoreRisks(
  entries: string[],
  reverseHits: ReverseHit[],
  testPairs: TestPair[],
): FileRisk[] {
  const dependentsBySeed = new Map<string, ReverseHit[]>();

  // Attribute each reverse hit to nearest seed on its via path
  for (const hit of reverseHits) {
    const seed = hit.via[0];
    if (!seed) continue;
    const list = dependentsBySeed.get(seed) ?? [];
    list.push(hit);
    dependentsBySeed.set(seed, list);
  }

  const pairBySource = new Map(testPairs.map((p) => [p.source, p]));

  const risks: FileRisk[] = [];

  for (const file of entries) {
    const factors: string[] = [];
    let score = 10; // baseline for any touched file

    const deps = dependentsBySeed.get(file) ?? reverseHits.filter((h) =>
      h.via.includes(file),
    );
    const uniqueDeps = new Set(deps.map((d) => d.file));
    const reverseDependentCount = uniqueDeps.size;

    if (reverseDependentCount === 0) {
      factors.push("no reverse dependents detected");
    } else if (reverseDependentCount <= 2) {
      score += 15;
      factors.push(`${reverseDependentCount} reverse dependent(s)`);
    } else if (reverseDependentCount <= 8) {
      score += 30;
      factors.push(`${reverseDependentCount} reverse dependents (moderate fan-out)`);
    } else {
      score += 45;
      factors.push(`${reverseDependentCount} reverse dependents (wide fan-out)`);
    }

    const maxDepth = deps.reduce((m, d) => Math.max(m, d.depth), 0);
    if (maxDepth >= 3) {
      score += 15;
      factors.push(`deep reverse chain (depth ${maxDepth})`);
    } else if (maxDepth === 2) {
      score += 8;
      factors.push(`medium reverse chain (depth ${maxDepth})`);
    }

    const pair = pairBySource.get(file);
    let testCoverageHint: FileRisk["testCoverageHint"] = "missing";
    if (isTestFile(file)) {
      testCoverageHint = "covered";
      score = Math.max(5, score - 20);
      factors.push("file is a test — lower production blast weight");
    } else if (pair && pair.tests.length > 0) {
      if (pair.confidence === "high") {
        testCoverageHint = "covered";
        score -= 5;
        factors.push(`paired tests (${pair.confidence}): ${pair.tests.length}`);
      } else {
        testCoverageHint = "partial";
        factors.push(`weak test pairing (${pair.confidence})`);
        score += 8;
      }
    } else {
      score += 18;
      factors.push("no paired tests found");
    }

    const lower = file.toLowerCase();
    if (
      /(^|\/)(index|main|app|core|shared|common|lib|utils|util|hooks|store)\b/.test(
        lower,
      ) ||
      /\/(core|shared|common|lib)\//.test(lower)
    ) {
      score += 12;
      factors.push("path looks foundational (index/core/shared/lib)");
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    risks.push({
      file,
      score,
      level: levelFromScore(score),
      factors,
      reverseDependentCount,
      testCoverageHint,
    });
  }

  return risks.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
}

export function maxRiskLevel(risks: FileRisk[]): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "critical"];
  let max: RiskLevel = "low";
  for (const r of risks) {
    if (order.indexOf(r.level) > order.indexOf(max)) max = r.level;
  }
  return max;
}

export function averageRiskScore(risks: FileRisk[]): number {
  if (risks.length === 0) return 0;
  const sum = risks.reduce((a, r) => a + r.score, 0);
  return Number((sum / risks.length).toFixed(1));
}
