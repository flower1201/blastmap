import { z } from "zod";

export const LangSchema = z.enum(["en", "zh", "both"]);
export type Lang = z.infer<typeof LangSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export interface ImportEdge {
  from: string;
  to: string;
  kind: "import" | "require" | "export-from" | "dynamic-import";
  specifier: string;
}

export interface GraphStats {
  fileCount: number;
  edgeCount: number;
  orphanCount: number;
  coverageRatio: number;
}

export interface ReverseHit {
  file: string;
  depth: number;
  via: string[];
}

export interface TestPair {
  source: string;
  tests: string[];
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface FileRisk {
  file: string;
  score: number;
  level: RiskLevel;
  factors: string[];
  reverseDependentCount: number;
  testCoverageHint: "covered" | "partial" | "missing";
}

export interface BlastNode {
  file: string;
  role: "entry" | "dependent" | "test";
  depth: number;
  risk?: FileRisk;
}

export interface AnalyzeOptions {
  rootDir: string;
  entries?: string[];
  baseRef?: string;
  maxDepth?: number;
  lang?: Lang;
  outDir?: string;
  useGit?: boolean;
}

export interface AnalyzeResult {
  version: string;
  generatedAt: string;
  rootDir: string;
  entries: string[];
  changedFiles: string[];
  blastRadius: BlastNode[];
  reverseDependents: ReverseHit[];
  testPairs: TestPair[];
  risks: FileRisk[];
  summary: {
    entryCount: number;
    blastCount: number;
    reverseCount: number;
    testPairCount: number;
    avgRiskScore: number;
    maxRiskLevel: RiskLevel;
    graph: GraphStats;
  };
  agentChecklist: string[];
  agentChecklistZh: string[];
}

export interface DoctorResult {
  rootDir: string;
  graph: GraphStats;
  sampleUnresolved: string[];
  extensions: Record<string, number>;
  recommendations: string[];
  recommendationsZh: string[];
  ok: boolean;
}
