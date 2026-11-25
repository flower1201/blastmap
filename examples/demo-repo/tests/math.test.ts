import { add, clamp } from "../src/utils/math.js";

export function run(): void {
  if (add(1, 2) !== 3) throw new Error("add failed");
  if (clamp(5, 0, 3) !== 3) throw new Error("clamp failed");
}
