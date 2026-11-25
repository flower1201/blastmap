import { add } from "./utils/math.js";
import { percent } from "./utils/format.js";

export function score(parts: number[]): string {
  const total = parts.reduce((a, b) => add(a, b), 0);
  const avg = parts.length ? total / parts.length : 0;
  return percent(avg / 100);
}
