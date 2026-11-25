import { describe, expect, it } from "vitest";
import { pairTests, isTestFile } from "../src/core/tests.js";
import { scoreRisks, maxRiskLevel } from "../src/core/risk.js";
import type { ReverseHit } from "../src/core/types.js";

describe("test pairing", () => {
  it("detects test files and pairs co-located tests", () => {
    expect(isTestFile("src/utils/math.test.ts")).toBe(true);
    expect(isTestFile("tests/math.test.ts")).toBe(true);
    expect(isTestFile("src/utils/math.ts")).toBe(false);

    const pairs = pairTests(
      ["src/utils/math.ts"],
      [
        "src/utils/math.ts",
        "src/utils/math.test.ts",
        "tests/math.test.ts",
        "src/core.ts",
      ],
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.tests.length).toBeGreaterThan(0);
    expect(pairs[0]!.confidence).toMatch(/high|medium/);
  });
});

describe("risk scoring", () => {
  it("scores higher when fan-out is wide and tests are missing", () => {
    const reverse: ReverseHit[] = Array.from({ length: 10 }, (_, i) => ({
      file: `src/dep${i}.ts`,
      depth: i % 4 === 0 ? 3 : 1,
      via: ["src/core.ts", `src/dep${i}.ts`],
    }));

    const risky = scoreRisks(
      ["src/core.ts"],
      reverse,
      [
        {
          source: "src/core.ts",
          tests: [],
          confidence: "low",
          reason: "none",
        },
      ],
    );

    const safe = scoreRisks(
      ["src/lonely.ts"],
      [],
      [
        {
          source: "src/lonely.ts",
          tests: ["src/lonely.test.ts"],
          confidence: "high",
          reason: "co-located",
        },
      ],
    );

    expect(risky[0]!.score).toBeGreaterThan(safe[0]!.score);
    expect(maxRiskLevel(risky)).not.toBe("low");
  });
});
