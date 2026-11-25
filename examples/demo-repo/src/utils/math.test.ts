import { add } from "./math.js";

export const cases = [{ a: 1, b: 1, expect: 2 }];

export function check(): boolean {
  return add(cases[0]!.a, cases[0]!.b) === cases[0]!.expect;
}
