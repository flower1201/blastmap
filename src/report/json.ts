import fs from "node:fs";
import path from "node:path";
import type { AnalyzeResult, DoctorResult } from "../core/types.js";

export function writeJsonReport(
  outDir: string,
  result: AnalyzeResult,
  filename = "blastmap.json",
): string {
  const dest = path.join(outDir, filename);
  fs.writeFileSync(dest, JSON.stringify(result, null, 2) + "\n", "utf8");
  return dest;
}

export function writeDoctorJson(
  outDir: string,
  result: DoctorResult,
  filename = "doctor.json",
): string {
  const dest = path.join(outDir, filename);
  fs.writeFileSync(dest, JSON.stringify(result, null, 2) + "\n", "utf8");
  return dest;
}
