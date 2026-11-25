import { clamp } from "./math.js";

export function percent(n: number): string {
  return `${clamp(Math.round(n * 100), 0, 100)}%`;
}
